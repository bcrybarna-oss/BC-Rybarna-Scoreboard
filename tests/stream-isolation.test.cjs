'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','overlay.html'),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/\r?\npoll\(\);\r?\nsetInterval\(poll,1000\);/,'\nglobalThis.initialPoll=poll();\nsetInterval(poll,1000);');
assert.ok(script.includes('globalThis.initialPoll=poll()'));
const now=Date.parse('2026-10-22T12:00:00Z');
const state=(matchId='match-A',name='Alpha')=>({active:true,matchId,playerNames:[name,'Opponent'],scores:[2,1],streamMode:'live',updatedAt:now});
function load(query,store={state:state()},storage=new Map(),options={}){
 const location=new URL('https://isolated.local/overlay.html'+query),urls=[];
 const el=()=>({className:'',innerHTML:'',textContent:'',classList:{add(){},remove(){}},querySelector(){return offline;}}),offline=el(),overlay=el(),diag=el();
 const audio={paused:true,volume:.72,pause(){},play(){return Promise.resolve();}};
 const localStorage={getItem(k){if(options.blockStorage)throw Error('storage');return storage.get(k)??null;},setItem(k,v){if(options.blockStorage)throw Error('storage');storage.set(k,String(v));}};
 const sandbox={URL,URLSearchParams,AbortController,console,location,localStorage,
  Date:class extends Date{static now(){return now;}},
  document:{getElementById(id){return {overlay,diag,pauseAudio:audio,stage:el()}[id]||null;}},
  navigator:{locks:options.noLocks?undefined:{request:async(k,fn)=>fn()}},
  history:{replaceState(a,b,url){location.href=String(url);}},
  setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},clearInterval(){},requestAnimationFrame(fn){fn();},innerWidth:1280,innerHeight:720,
  async fetch(url){urls.push(String(url));if(store.pending)await store.pending;if(store.error)throw Error('offline');return {ok:!store.status,status:store.status||200,json:async()=>structuredClone(store.state)};}
 };
 sandbox.window={addEventListener(){}};
 vm.createContext(sandbox);vm.runInContext(script+'\nglobalThis.api={poll,rerenderForViewport,get pinned(){return boundMatchId},get last(){return lastState}};',sandbox);
 return {ready:sandbox.initialPoll,api:sandbox.api,frame:overlay,urls,location,storage};
}
test('Explicit stream is pinned to both UID and match; another match is never rendered',async()=>{
 const store={state:state()},s=load('?uid=A&matchId=match-A',store);await s.ready;assert.match(s.frame.innerHTML,/Alpha/);
 store.state=state('match-B','Foreign');await s.api.poll();assert.doesNotMatch(s.frame.innerHTML,/Foreign/);assert.equal(s.api.last,null);
 store.state=state();await s.api.poll();assert.match(s.frame.innerHTML,/Alpha/);assert.ok(s.urls.every(u=>new URL(u).pathname==='/stream/users/A.json'));
});
test('Stale and absent A never cause global discovery, even with another stream available',async()=>{
 const store={state:{...state(),updatedAt:now-21001}},s=load('?uid=A&matchId=match-A',store);await s.ready;assert.equal(s.api.last,null);
 store.state=null;await s.api.poll();assert.equal(s.api.last,null);assert.ok(s.urls.every(u=>u.includes('/stream/users/A.json')));assert.doesNotMatch(s.frame.innerHTML,/scoreboard/);
});
test('Failure forgets the last frame so resize cannot resurrect it; recovery stays on A',async()=>{
 const store={state:state()},s=load('?uid=A&matchId=match-A',store);await s.ready;
 for(const failure of ['error','status']){store[failure]=failure==='status'?403:true;await s.api.poll();s.api.rerenderForViewport();assert.equal(s.api.last,null);assert.doesNotMatch(s.frame.innerHTML,/scoreboard/);delete store[failure];store.state=state();await s.api.poll();assert.match(s.frame.innerHTML,/Alpha/);}
});
test('Legacy UID URL pins once, persists across the original URL reload, and accepts hash UID',async()=>{
 const storage=new Map(),first=load('#uid=A',{state:state()},storage);await first.ready;assert.equal(first.api.pinned,'match-A');assert.equal(first.location.searchParams.get('matchId'),'match-A');
 const second=load('?uid=A',{state:state('match-B','Foreign')},storage);await second.ready;assert.equal(second.api.pinned,'match-A');assert.equal(second.api.last,null);assert.doesNotMatch(second.frame.innerHTML,/Foreign/);
});
test('Missing UID ignores the unsafe old auto-discovery cache',async()=>{
 const s=load('',{state:state('match-B','Foreign')},new Map([['bcOverlayUid','B']]));await s.ready;assert.equal(s.urls.length,0);assert.equal(s.api.last,null);
});
test('Conflicting URL identities and invalid path characters fail closed; matching query/hash work',async()=>{
 for(const query of ['?uid=A#uid=B','?uid=A&uid=B','?uid=A&matchId=match-A#matchId=match-B','?uid=A%2FB','?uid=']){const s=load(query);await s.ready;assert.equal(s.urls.length,0,query);}
 const s=load('?uid=A&matchId=match-A#uid=A&matchId=match-A');await s.ready;assert.match(s.frame.innerHTML,/Alpha/);
});
test('Explicit URLs need no storage; legacy first binding requires durable serialized pinning',async()=>{
 const explicit=load('?uid=A&matchId=match-A',undefined,undefined,{blockStorage:true,noLocks:true});await explicit.ready;assert.match(explicit.frame.innerHTML,/Alpha/);
 for(const options of [{blockStorage:true},{noLocks:true}]){const legacy=load('?uid=A',undefined,undefined,options);await legacy.ready;assert.equal(legacy.api.last,null);assert.doesNotMatch(legacy.frame.innerHTML,/scoreboard/);}
});
test('Invalid/missing identity, timestamps and inactive data cannot be displayed as live',async()=>{
 for(const broken of [{active:false},{matchId:null},{updatedAt:0},{updatedAt:'bad'},{updatedAt:now-20000},{updatedAt:now+6000}]){const s=load('?uid=A&matchId=match-A',{state:{...state(),...broken}});await s.ready;assert.equal(s.api.last,null,JSON.stringify(broken));}
});
test('Only one poll is in flight, so delayed older responses cannot overtake later polls',async()=>{
 let release;const store={state:state(),pending:new Promise(r=>{release=r;})},s=load('?uid=A&matchId=match-A',store);
 await s.api.poll();await s.api.poll();assert.equal(s.urls.length,1);release();await s.ready;assert.match(s.frame.innerHTML,/Alpha/);
});
