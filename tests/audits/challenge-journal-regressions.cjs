'use strict';
// Historical audit: preserved failing requirements for removed journal implementation at213f87f. Manual run exits1; not a production or experimental suite.
const test=require('node:test'),assert=require('node:assert/strict'),api=require('../fixtures/challenge-actions-journal-213f87f.js');
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(){const entries=new Map();let requestBody=null,remote={id:'profile-A',ownerUid:'A',name:'Original profile'};
 const input={challenge:{id:'challenge-1',senderUid:'A',recipientUid:'B',senderPlayerId:'profile-A',recipientPlayerId:'profile-B',status:'pending',discipline:'9-ball',raceTo:5,flexibleTime:true,note:'Synthetic note'}};
 const controller=api.create({identity:()=>({authenticated:true,uid:'A',profileId:'profile-A',scope:'player'}),profile:()=>({id:'profile-A',ownerUid:'A',name:'Original profile'}),nowIso:()=> '2026-10-31T19:00:00.123Z',operationId:()=> 'receipt-1',journal:{keys:()=>[...entries.keys()],getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},authorize:async()=>true,beginWrite:()=>()=>{},write:async body=>{requestBody=clone(body);throw Error('lost response; request may still arrive');},readProfile:async()=>clone(remote),commit(){},refresh:async()=>{}});
 return {controller,entries,input,get body(){return requestBody;},set remote(value){remote=value;}};
}
test('journal must not clear an unresolved PUT or claim terminal verification merely because one leaf currently matches',async()=>{
 const h=harness();const first=await h.controller.run('send',h.input);assert.equal(first.status,'unknown');assert.equal(h.entries.size,1);
 // Another client has the same leaf, but newer unrelated profile data. The original whole-profile PUT is not known to be terminal.
 h.remote={...h.body,name:'Newer profile edited elsewhere'};const observed=await h.controller.run('send',h.input);
 assert.notEqual(observed.verified,true,'GET equality establishes current state only; operationId is absent from server and original PUT can still arrive');
 assert.equal(h.entries.size,1,'unresolved original request must retain its journal marker');h.controller.dispose();
});
test('journal must whitelist challenge fields instead of copying injected credential properties from a cached sender record',async()=>{
 const h=harness();h.input.challenge.idToken='FAKE_TOKEN_SENTINEL';h.input.challenge.password='FAKE_PASSWORD_SENTINEL';await h.controller.run('send',h.input);const receipt=JSON.parse([...h.entries.values()][0]);
 assert.equal(Object.hasOwn(receipt.value,'idToken'),false,'out-of-schema credential property must not enter durable journal');
 assert.equal(Object.hasOwn(receipt.value,'password'),false,'out-of-schema credential property must not enter durable journal');h.controller.dispose();
});
