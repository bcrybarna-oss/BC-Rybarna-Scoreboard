'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const helper=html.match(/  function streamLagResolved\(\)\{[\s\S]*?\n  \}/)?.[0];
assert.ok(helper,'The test must execute the actual streamLagResolved from production index.html');
const check=m=>new Function('match',helper+'\nreturn streamLagResolved();')(m);
const state=(discipline,lagWinner=1,breaker=1)=>({
 deferredLag:true,discipline,lagWinner,breaker,streamLagLocked:false,
 rackNumber:1,isBreakShot:true,endedAt:null
});

test('8/9/10-ball: one completed streamed lag is final, regardless of legacy lock flag',()=>{
 for(const discipline of ['8-ball','9-ball','10-ball']){
  assert.equal(check(state(discipline)),true,discipline);
  assert.equal(check({...state(discipline),streamLagLocked:true}),true,discipline);
  assert.equal(check(state(discipline,null,null)),false,discipline);
  assert.equal(check(state(discipline,0,null)),false,discipline);
  assert.equal(check({...state(discipline),deferredLag:false}),false,discipline);
 }
});

test('Classic 14.1 and all other modes retain the established separate decision flow',()=>{
 for(const discipline of ['14.1','8-ball ghost','unknown'])
  assert.equal(check(state(discipline)),false,discipline);
});

test('Production render hides the entire lag panel after one selection, while restoring it on UNDO',()=>{
 assert.match(html,/\$\('streamLagControls'\)\.classList\.toggle\('hidden',!match\.deferredLag \|\| streamLagResolved\(\)\)/);
 assert.match(html,/\$\('streamLagStatus'\)\.textContent=streamLagPending\(\)/);
 assert.match(html,/\$\('streamLagLock'\)\.classList\.toggle\('hidden',!waitingForLagLock \|\| streamLagPending\(\)\)/);
 assert.match(html,/const waitingForLagLock=simpleCounter && match\.deferredLag && match\.rackNumber===1 && !match\.streamLagLocked && !streamLagResolved\(\)/);
 assert.match(html,/match\.breaker=i;\s*match\.turn=i;\s*beginRack\(\);\s*if\(streamLagResolved\(\)\)match\.streamLagLocked=true;/);
 assert.match(html,/if\(match\?\.deferredLag && match\.rackNumber===1 && !match\.streamLagLocked && !streamLagResolved\(\)\)return toast/);
 assert.match(html,/return !!match\?\.deferredLag && !streamLagResolved\(\) && !match\.streamLagLocked && !match\.endedAt/);
 assert.match(html,/\$\('streamLagUndo'\)\.onclick=undo/);
});

test('Selecting lag once does not alter player score or give a second rack break',()=>{
 const matchFunction=html.match(/  function chooseLagWinner\(i\)\{[\s\S]*?\n  \}/)?.[0];
 assert.ok(matchFunction);
 assert.match(matchFunction,/if\(match\.lagRackStarted\)match\.stats\[match\.breaker\]\.breaks--/);
 assert.match(matchFunction,/if\(match\.lagWinner!=null\)match\.stats\[match\.lagWinner\]\.lagWins--/);
 assert.match(matchFunction,/if\(streamLagResolved\(\)\)match\.streamLagLocked=true/);
 assert.doesNotMatch(matchFunction,/match\.scores\s*\[/);
});
