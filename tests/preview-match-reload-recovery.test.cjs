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

// Execute the actual preview login entry points, not a source-order regex.
for(const mode of ['manual','automatic'])for(const hasMatch of [true,false])test('preview '+mode+' login restores match first or actual tournament fallback after data loads ('+hasMatch+')',async()=>{
  const {topFunction}=require('./helpers/source-functions.cjs');
  const live=mk('login-match','owner',[4,3]);
  const h=harness({uid:'owner',authenticated:false,saved:hasMatch?[live]:[]}),events=[],els=new Map();
  Object.assign(h.ctx,{
    $:id=>{if(!els.has(id))els.set(id,{value:id==='cloudEmail'?'mock@example.invalid':'mock-password',textContent:'',classList:{add(){},remove(){}}});return els.get(id);},
    persistedCloudSession:()=>({email:'mock@example.invalid',refresh:'mock-refresh'}),
    firebaseSignIn:async()=>{h.ctx.cloudAuthenticated=true;events.push('identity');},firebaseRefreshAuth:async()=>{h.ctx.cloudAuthenticated=true;events.push('identity');},
    ensureVerifiedBeforeApp:async()=>true,ensureUserAccessRecord:async()=>events.push('access'),loadOwnProfileClaim:async()=>events.push('profile'),initialCloudMerge:async()=>events.push('appData'),loadSecurePlayers:async()=>events.push('players'),loadSecureMatches:async()=>{await new Promise(setImmediate);events.push('matches');},loadSecureTournaments:async()=>{await new Promise(setImmediate);events.push('tournaments');h.ctx.data.tournaments=[{id:'cup',status:'active'}];},promoteLegacyTournamentGuestsToProfiles:async()=>events.push('guests'),
    showScreen:where=>{h.calls.screens.push(where);events.push('screen:'+where);},
    sessionStorage:{getItem:()=>null},selectedTournamentId:null,updateCurrentTournamentShortcut:()=>events.push('shortcut'),renderTournamentDetail:()=>events.push('tournament-render'),refreshAccountUI(){},renderPlayers(){},setCloudStatus(){},clearRuntimeCloudIdentity(){h.ctx.cloudAuthenticated=false;}
  });
  for(const name of ['restoreTestTournamentAfterLogin','cloudLoginFromModal','autoCloudInit'])vm.runInContext(topFunction(core,name),vm.isContext(h.ctx)?h.ctx:vm.createContext(h.ctx));
  // Recovery slice originally ran in the same context via runInNewContext; declarations remain available.
  await h.ctx[mode==='manual'?'cloudLoginFromModal':'autoCloudInit']();
  assert.deepEqual(events.slice(0,8),['identity','access','profile','appData','players','matches','tournaments','guests']);
  assert.deepEqual(h.calls.screens,[hasMatch?'match':'tournament-detail']);
  if(hasMatch){assert.deepEqual(Array.from(h.ctx.match.scores),[4,3]);assert.equal(h.ctx.selectedTournamentId,null);assert.equal(events.includes('tournament-render'),false);}
  else{assert.equal(h.ctx.match,null);assert.equal(h.ctx.selectedTournamentId,'cup');assert.equal(events.filter(x=>x==='tournament-render').length,1);}
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

test('experimental contract: stale UID without authenticated identity must not authorize the saved owner',()=>{
  const {topFunction}=require('./helpers/source-functions.cjs');
  const c={cloudAuthenticated:false,cloudUid:'owner',currentUserPlayerId:'stale-profile',currentUserIsSystemAdmin:()=>false,data:{tournaments:[]},canManageTournament:()=>false};
  vm.runInNewContext(topFunction(core,'editableMatchOwnedByCurrentUser'),c);
  assert.equal(c.editableMatchOwnedByCurrentUser(mk('stale-identity','owner')),false,'runtime UID alone is not authenticated ownership');
});
