'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const core=fs.readFileSync(path.join(__dirname,'..','test-modular','assets','js','pool-core.js'),'utf8');
const start=core.indexOf('  function discardForeignLocalActiveMatch(){');
const end=core.indexOf('  function liveTimestampMs(',start);
assert.ok(start>0 && end>start,'Match-recovery helper is available');
const recoveryModule=core.slice(start,end);

function harness({uid='',authenticated=false,current=null,saved=[],recovery={},completed=[],deleted=[]}={}){
  const store=new Map([['recovery',JSON.stringify(recovery)]]);
  const calls={remove:[],clear:[],save:[],screens:[],renders:0,clocks:[],heartbeat:0,toast:[]};
  const contexts={
    window:{POOL_TEST_MODE:true},
    cloudAuthenticated:authenticated,cloudUid:uid,match:current,
    data:{currentMatch:null,matches:completed,deletedMatchIds:deleted},
    LOCAL_ACTIVE_MATCH_RECOVERY_KEY:'recovery',
    console:{warn:()=>{}},
    localStorage:{getItem:key=>store.get(key)||null},
    loadDeviceActiveMatch:()=>saved[0]||null,
    loadDeviceActiveMatches:()=>Object.fromEntries(saved.map(m=>[m.id,m])),
    removeDeviceActiveMatch:id=>calls.remove.push(id),
    saveDeviceActiveMatch:m=>{calls.save.push(m ? JSON.parse(JSON.stringify(m)) : null);},
    editableMatchOwnedByCurrentUser:m=>!!contexts.cloudUid && m.createdByUid===contexts.cloudUid,
    betterResumableState:(a,b)=>{
      if(!a)return JSON.parse(JSON.stringify(b));
      const time=x=>Date.parse(x.localUpdatedAt||x.startedAt||'')||0;
      return JSON.parse(JSON.stringify(time(a)>=time(b)?a:b));
    },
    showScreen:where=>calls.screens.push(where),
    resetClock:(a,b)=>calls.clocks.push([a,b]),
    renderMatch:()=>{calls.renders++;},
    startLiveHeartbeat:()=>{calls.heartbeat++;},
    toast:t=>calls.toast.push(t)
  };
  vm.runInNewContext(recoveryModule,contexts);
  return {ctx:contexts,calls,storage:store};
}

const mk=(id,uid,score=[3,2],time='2026-10-15T09:00:00.000Z')=>({
  id,createdByUid:uid,discipline:'8-ball',status:'playing',endedAt:null,
  scores:score,turn:1,events:[{text:'break'}],startedAt:time,localUpdatedAt:time,
  useClock:true,clock:{normal:30}
});

test('reloading while Firebase identity is unavailable detaches but never deletes a saved match',()=>{
  const live=mk('test-1','owner');
  const h=harness({current:live,saved:[live],authenticated:false});
  assert.equal(h.ctx.discardForeignLocalActiveMatch(),true);
  assert.equal(h.ctx.match,null,'do not allow edits without identity');
  assert.equal(h.calls.remove.length,0,'saved match map must survive authentication delay');
  assert.equal(h.calls.save.length,0,'current match pointer must survive authentication delay');
  assert.equal(h.ctx.data.currentMatch,null);
});

test('verified owner can resume latest saved match with its score and shot clock paused',()=>{
  const live=mk('test-2','owner',[4,3]);
  const h=harness({uid:'owner',authenticated:true,saved:[live]});
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),true);
  assert.equal(h.ctx.match.id,'test-2');
  assert.deepEqual(Array.from(h.ctx.match.scores),[4,3]);
  assert.equal(h.ctx.match.turn,1);
  assert.deepEqual(h.calls.screens,['match']);
  assert.equal(h.calls.renders,1);
  assert.equal(h.calls.heartbeat,1);
  assert.deepEqual(h.calls.clocks,[[false,false]]);
  assert.equal(h.calls.save[0].id,'test-2');
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),false,'do not reopen/re-save repeatedly');
});

test('an orphaned match deleted by the previous bug can be recovered from the recovery history',()=>{
  const live=mk('orphan-1','owner',[6,5]);
  const h=harness({uid:'owner',authenticated:true,recovery:{'orphan-1':[live]}});
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),true);
  assert.equal(h.ctx.match.id,'orphan-1');
  assert.deepEqual(Array.from(h.ctx.match.scores),[6,5]);
  assert.equal(h.calls.save.length,1,'recovered copy must be re-persisted to active storage');
});

test('different account cannot edit somebody else\'s local or recovery match',()=>{
  const live=mk('other-account','owner');
  const h=harness({uid:'stranger',authenticated:true,saved:[live],recovery:{'other-account':[live]}});
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),false);
  assert.equal(h.ctx.match,null);
  assert.equal(h.calls.save.length,0);
  assert.equal(h.calls.screens.length,0);
});

test('recovery must skip explicitly deleted and finished matches',()=>{
  const done=mk('finished','owner');
  const deleted=mk('removed','owner');
  const h=harness({
    uid:'owner',authenticated:true,
    recovery:{finished:[done],removed:[deleted]},
    completed:[{id:'finished',endedAt:'2026-10-15T10:00:00Z',status:'complete'}],
    deleted:['removed']
  });
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),false);
  assert.equal(h.calls.save.length,0);
});

test('manual and automatic login load saved data before recovery and preserve tournament fallback',async()=>{
  // Execute both real post-login sequences with isolated dependencies. This
  // checks ordering and fallback behavior rather than one exact call spelling.
  const sequences=[...core.matchAll(/await initialCloudMerge\(\);[\s\S]*?if\(!matchRestored\)restoreTestTournamentAfterLogin\(\);/g)].map(m=>m[0]);
  assert.equal(sequences.length,2,'manual and automatic login must both recover');
  for(const sequence of sequences){
    for(const restored of [true,false]){
      const calls=[];
      const context={};
      for(const name of ['initialCloudMerge','loadSecurePlayers','loadSecureMatches','loadSecureTournaments','promoteLegacyTournamentGuestsToProfiles']){
        context[name]=async()=>{await Promise.resolve();calls.push(name);};
      }
      context.restoreOwnedTestMatchAfterLogin=()=>{calls.push('match');return restored;};
      context.restoreTestTournamentAfterLogin=()=>calls.push('tournament');
      await vm.runInNewContext('(async()=>{'+sequence+'})()',context);
      assert.deepEqual(calls,[
        'initialCloudMerge','loadSecurePlayers','loadSecureMatches','loadSecureTournaments',
        'promoteLegacyTournamentGuestsToProfiles','match',...(!restored?['tournament']:[])
      ]);
    }
  }
  assert.doesNotThrow(()=>new Function(core));
});

test('delayed identity keeps the snapshot recoverable only by its verified owner',()=>{
  const live=mk('delayed-owner','owner',[5,4]);
  const h=harness({uid:'owner',authenticated:false,current:live,saved:[live]});
  assert.equal(h.ctx.discardForeignLocalActiveMatch(),true);
  assert.equal(h.ctx.match,null,'a stale UID does not authorize editing');
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),false);
  h.ctx.cloudAuthenticated=true;
  h.ctx.cloudUid='stranger';
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),false);
  assert.equal(h.calls.remove.length,0);
  assert.equal(h.calls.save.length,0);
  h.ctx.cloudUid='owner';
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),true);
  assert.deepEqual(Array.from(h.ctx.match.scores),[5,4]);
  assert.deepEqual(h.calls.clocks,[[false,false]]);
});

test('active secure test-database backup is discoverable even if local snapshot is absent',()=>{
  const h=harness({uid:'owner',authenticated:true});
  h.ctx.data.matches=[{...mk('secure-only','owner',[7,6]),activeResumeBackup:true}];
  assert.equal(h.ctx.restoreOwnedTestMatchAfterLogin(),true);
  assert.equal(h.ctx.match.id,'secure-only');
  assert.deepEqual(Array.from(h.ctx.match.scores),[7,6]);
  assert.equal(h.calls.save.length,1);
});

test('restoration diagnostics list only unfinished non-deleted backups',()=>{
  const h=harness({uid:'owner',authenticated:true,
    recovery:{'old-1':[mk('old-1','owner')],gone:[mk('gone','owner')]},
    deleted:['gone']});
  h.ctx.data.matches=[mk('secure-2','owner'),{...mk('done','owner'),status:'complete',endedAt:'2026-10-15T09:30:00Z'}];
  const list=Array.from(h.ctx.testMatchRecoveryCandidates());
  assert.deepEqual(list.map(x=>x.id),['old-1','secure-2']);
});

test('modular preview exposes the backup diagnostic button and status panel',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','test-modular','index.html'),'utf8');
  assert.match(html,/id="poolTestRecoveryPanel"/);
  assert.match(html,/id="poolTestRecoveryStatus"/);
  assert.match(html,/poolTestOpenRecovery\?\.\(\)/);
  assert.match(core,/window\.poolTestOpenRecovery=function\(\)/);
  assert.match(core,/renderTestMatchRecoveryStatus\(\);/);
});
