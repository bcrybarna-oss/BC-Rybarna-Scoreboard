'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=fs.readFileSync(path.join(__dirname,'../test-modular/assets/js/pool-core.js'),'utf8');
const start=core.indexOf('  let pendingCancelMatchId=null;');
const end=core.indexOf('  let tournamentAutoFinalizeInProgress',start);
assert.ok(start>0 && end>start);
function harness(){
  const elements=new Map();
  const calls=[];
  const live={id:'cancel-me',createdByUid:'owner',status:'playing',scores:[3,2]};
  let persisted;
  const context={
    $:id=>{if(!elements.has(id))elements.set(id,{classList:{add:()=>{},remove:()=>{}}});return elements.get(id);},
    match:live,data:{matches:[live,{id:'keep-me',status:'complete'}],deletedMatchIds:[]},
    cloudUid:'owner',cloudAuthenticated:true,
    editableMatchOwnedByCurrentUser:m=>context.cloudAuthenticated && m.createdByUid===context.cloudUid,
    stopTimer:()=>{},stopLiveHeartbeat:()=>{},clearTimeout:()=>{},activeMatchCloudSaveTimer:1,liveMatchSendTimer:2,
    removeDeviceActiveMatch:id=>calls.push(['active',id]),
    removeActiveMatchRecovery:id=>calls.push(['recovery',id]),
    saveDeviceActiveMatch:m=>calls.push(['pointer',m]),
    saveData:()=>{persisted=JSON.parse(JSON.stringify(context.data));},
    showScreen:()=>{},renderLive:()=>{},toast:()=>{},clearStreamState:async()=>{},
    removeLiveMatch:async id=>{
      assert.ok(persisted.deletedMatchIds.includes(id),'cancellation must be durable before async cleanup');
      calls.push(['live',id]);
    },
    removeActiveMatchCloudBackup:async id=>calls.push(['backup',id])
  };
  vm.runInNewContext(core.slice(start,end),context);
  return {ctx:context,calls,click:id=>context.$(id).onclick(),snapshot:()=>persisted};
}
test('inline cancellation removes only the chosen active match and all recovery sources',async()=>{
  const h=harness();h.click('cancelMatch');await h.click('cancelMatchDiscard');
  assert.equal(h.ctx.match,null);
  assert.deepEqual(h.snapshot().matches,[{id:'keep-me',status:'complete'}]);
  assert.deepEqual(h.snapshot().deletedMatchIds,['cancel-me']);
  assert.deepEqual(h.calls,[['active','cancel-me'],['recovery','cancel-me'],['pointer',null],['live','cancel-me'],['backup','cancel-me']]);
});
test('keeping the match leaves it and its backups unchanged',async()=>{
  const h=harness();h.click('cancelMatch');h.click('cancelMatchKeep');await h.click('cancelMatchDiscard');
  assert.equal(h.ctx.match.id,'cancel-me');assert.equal(h.calls.length,0);
});
test('cancel confirmation cannot delete after account or match changes',async()=>{
  for(const change of [h=>h.ctx.cloudUid='stranger',h=>h.ctx.cloudAuthenticated=false,h=>h.ctx.match={...h.ctx.match,id:'different'}]){
    const h=harness();h.click('cancelMatch');change(h);await h.click('cancelMatchDiscard');
    assert.equal(h.calls.length,0);assert.ok(h.ctx.match);
  }
});
test('cancelled match cannot be resurrected from a stale recovery copy after reload',async()=>{
  const h=harness();const old={...h.ctx.match};h.click('cancelMatch');await h.click('cancelMatchDiscard');
  const a=core.indexOf('  function testMatchRecoveryCandidates(){');
  const b=core.indexOf('  // Záchranný přehled:',a);
  const context={window:{POOL_TEST_MODE:true},data:h.snapshot(),
    loadDeviceActiveMatch:()=>old,loadDeviceActiveMatches:()=>({[old.id]:old}),
    LOCAL_ACTIVE_MATCH_RECOVERY_KEY:'recovery',localStorage:{getItem:()=>JSON.stringify({[old.id]:[old]})},
    betterResumableState:(a,b)=>b,console};
  vm.runInNewContext(core.slice(a,b),context);
  assert.equal(context.testMatchRecoveryCandidates().length,0);
});
test('inline confirmation controls exist before core event handlers are bound',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../test-modular/index.html'),'utf8');
  for(const id of ['cancelMatchConfirm','cancelMatchKeep','cancelMatchDiscard']){
    assert.ok(html.includes('id="'+id+'"'));
    assert.ok(html.indexOf('id="'+id+'"')<html.indexOf('<script src="assets/js/pool-core.js'));
  }
});
