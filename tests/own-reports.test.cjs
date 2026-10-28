'use strict';
const fs=require('node:fs'),path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../assets/js/own-reports.js');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const row=(id,uid='A',date='2026-01-01')=>({id,createdByUid:uid,createdAt:date,description:id});
const response=raw=>({ok:true,json:async()=>raw});
function harness(extra={}){
 let uid='A',visible=true,next=0;const intervals=new Map(),listeners=new Set(),applied=[],errors=[],success=[],legacy=[],mirrors=[],warnings=[];let rows=[];
 const options={clock:{setInterval(fn){const id=next++;intervals.set(id,fn);return id;},clearInterval(id){intervals.delete(id);}},pageTarget:{addEventListener(n,fn){listeners.add(fn);},removeEventListener(n,fn){listeners.delete(fn);}},identity:()=>uid,screenActive:()=>visible,intervalMs:5000,authorize:async()=>true,indexUrl:owner=>'/index/'+owner,fetch:async()=>response({}),readLegacy:async(id,ctx)=>{legacy.push([id,ctx.owner]);return row(id);},mirrorLegacy:async(item,ctx)=>mirrors.push([item.id,ctx.owner]),legacyError:(id,e)=>warnings.push([id,e]),rows:()=>rows,apply(r){rows=r;applied.push(r);},success:n=>success.push(n),error:(e,n)=>errors.push([e,n]),...extra};
 const c=create(options);return {c,options,intervals,listeners,applied,errors,success,legacy,mirrors,warnings,setUid(v){uid=v;},leave(){visible=false;c.stop();},enter(){visible=true;c.start();}};
}
test('one interval including id zero, one listener, idempotent starts and complete stop/dispose',async()=>{
 const h=harness();h.c.start();h.c.start();assert.equal(h.intervals.size,1);assert.equal(h.listeners.size,1);h.c.stop();assert.equal(h.intervals.size,0);assert.equal(h.listeners.size,0);assert.equal(h.c.snapshot().pending,false);h.enter();h.c.dispose();h.c.start();assert.equal(h.intervals.size,0);assert.equal(h.c.snapshot().disposed,true);
});
test('reserve before authorization and share manual/automatic reads with foreground notification',async()=>{
 const gate=deferred();let gets=0;const h=harness({authorize:()=>gate.promise,fetch:async()=>{gets++;return response({one:row('one')});}});h.enter();const a=h.c.refresh(true),b=h.c.refresh(false);assert.equal(a,b);gate.resolve(true);await a;assert.equal(gets,1);assert.deepEqual(h.success,[true]);assert.equal(h.applied.length,1);
});
test('authorization completed after stop or same-account re-entry cannot start an old request',async()=>{
 const gate=deferred();let gets=0,context;const h=harness({authorize:c=>{context=c;return gate.promise;},fetch:async()=>{gets++;return response({});}});h.enter();const p=h.c.refresh();await new Promise(setImmediate);h.leave();h.enter();assert.equal(context.current(),false);assert.equal(context.signal.aborted,true);gate.resolve(true);await p;assert.equal(gets,0);assert.equal(h.applied.length,0);assert.equal(h.errors.length,0);
});
test('legacy true records, object mirrors, owner filtering and newest-first order retain existing semantics',async()=>{
 const h=harness({fetch:async()=>response({early:row('early'),late:row('late','A','2026-02-01'),foreign:row('foreign','B'),old:true,ignored:false,null:null})});h.enter();assert.deepEqual((await h.c.refresh()).map(r=>r.id),['late','early','old']);assert.deepEqual(h.legacy,[['old','A']]);assert.deepEqual(h.mirrors,[['old','A']]);
});
test('late index body after leaving screen never applies, notifies, or falls back to legacy writes',async()=>{
 const gate=deferred();const h=harness({fetch:async()=>({ok:true,json:()=>gate.promise})});h.enter();const p=h.c.refresh();await new Promise(setImmediate);h.leave();gate.resolve({old:true});assert.deepEqual(await p,[]);assert.equal(h.applied.length,0);assert.equal(h.mirrors.length,0);assert.equal(h.success.length,0);assert.equal(h.intervals.size,0);
});
test('late legacy read cannot mirror or render after logout',async()=>{
 const gate=deferred();const h=harness({fetch:async()=>response({old:true}),readLegacy:()=>gate.promise});h.enter();const p=h.c.refresh();await new Promise(setImmediate);h.setUid(null);h.c.stop();gate.resolve(row('old'));await p;assert.equal(h.applied.length,0);assert.equal(h.mirrors.length,0);
});
test('A/B and same UID re-entry reject old replies; old finally does not clear a newer flight',async()=>{
 for(const next of ['A','B']){const old=deferred(),fresh=deferred();let calls=0;const h=harness({fetch:()=>++calls===1?old.promise:fresh.promise});h.enter();const a=h.c.refresh();await new Promise(setImmediate);h.leave();h.setUid(next);h.enter();const b=h.c.refresh();await new Promise(setImmediate);old.resolve(response({old:row('old')}));await a;assert.equal(h.c.snapshot().pending,true);fresh.resolve(response({new:row('new',next)}));await b;assert.deepEqual(h.applied.map(rs=>rs.map(r=>r.id)),[['new']]);}
});
test('network errors keep current rows, timer retries; inactive reads do no work',async()=>{
 let fail=false,gets=0;const h=harness({fetch:async()=>{gets++;if(fail)throw Error('network');return response({one:row('one')});}});h.enter();await h.c.refresh();fail=true;await h.c.refresh();assert.equal(h.errors.length,1);assert.deepEqual(h.applied.at(-1).map(r=>r.id),['one']);fail=false;for(const fn of h.intervals.values())fn();await new Promise(setImmediate);assert.equal(h.applied.length,2);h.leave();await h.c.refresh();assert.equal(gets,3);
});
test('unauthorized, partial legacy errors and pagehide cleanup have no dangling resources',async()=>{
 const h=harness({authorize:async()=>false});h.enter();await h.c.refresh();assert.equal(h.applied.length,0);for(const fn of h.listeners)fn({persisted:true});assert.equal(h.c.snapshot().active,true);for(const fn of [...h.listeners])fn({persisted:false});assert.equal(h.c.snapshot().disposed,true);assert.equal(h.listeners.size,0);
 const x=harness({fetch:async()=>response({good:row('good'),bad:true}),readLegacy:async()=>{throw Error('denied');}});x.enter();assert.deepEqual((await x.c.refresh()).map(r=>r.id),['good']);assert.equal(x.warnings.length,1);x.c.dispose();
});
test('stop aborts transport and stale error cannot show failure on another screen/session',async()=>{
 const gate=deferred();let signal;const h=harness({fetch:(_,opts)=>{signal=opts.signal;return gate.promise;}});h.enter();const p=h.c.refresh();await new Promise(setImmediate);h.leave();assert.equal(signal.aborted,true);gate.reject(Error('old failure'));await p;assert.equal(h.errors.length,0);assert.equal(h.applied.length,0);
});
test('actual core legacy adapters cannot send a GET or mirror PUT after authorization becomes stale',async()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),fn=name=>{const a=html.indexOf('  async function '+name+'(');assert.ok(a>0,name);return html.slice(a,html.indexOf('\n  }',a)+4);};
 for(const mirror of [false,true]){const gate=deferred(),requests=[];let valid=true;const context={owner:'A',signal:new AbortController().signal,current:()=>valid};
 const adapter=new Function('ensureCloudToken','fetch','cloudUrl','currentIdToken',"const FIREBASE_DB_URL='https://isolated.invalid',cloudIdToken='isolated';"+fn(mirror?'writeReportUserMirror':'reportRequest')+'return '+(mirror?'writeReportUserMirror':'reportRequest')+';')(async ctx=>{assert.equal(ctx,context);return gate.promise;},async(...args)=>{requests.push(args);return {ok:true,json:async()=>({})};},s=>s,()=>{throw Error('Must not renew outside screen context');});
 const p=mirror?adapter({id:'legacy',createdByUid:'A'},context):adapter('legacy','GET',null,context);valid=false;gate.resolve(true);await assert.rejects(p,/REPORT_REQUEST_CANCELLED/);assert.equal(requests.length,0);
 }
});
