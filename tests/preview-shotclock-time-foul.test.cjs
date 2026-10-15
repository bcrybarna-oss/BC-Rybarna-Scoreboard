'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const core=fs.readFileSync(path.join(__dirname,'..','test-modular','assets','js','pool-core.js'),'utf8');
function section(start,end){
  const at=core.indexOf(start);
  assert.notEqual(at,-1,'Missing start: '+start);
  const until=core.indexOf(end,at+start.length);
  assert.ok(until>at,'Missing end: '+end);
  return core.slice(at,until);
}
const foul=section("  window.actionFoul = function(reason='manual')", "  let pendingSafetyPlayer=null;");
const timer=section("  function resetClock(firstShot=false,autoStart=true)", "  function renderClock(){");

function createGame(discipline='8-ball',opts={}){
  const fired=[];
  const announcements=[];
  const events=[];
  const snapshots=[];
  const wins=[];
  const renders=[];
  const match={
    discipline,
    counterMode:'full',
    ghostMode:false,
    useClock:true,
    useThreeFoul:false,
    status:'live',
    endedAt:null,
    playerNames:['Hráč A','Hráč B'],
    turn:0,
    breaker:0,
    isBreakShot:false,
    stats:[{fouls:0,threeFoulLosses:0},{fouls:0,threeFoulLosses:0}],
    consecutiveFouls:[0,0],
    warnedTwoFouls:[false,false],
    clock:{first:60,normal:30,warn:10,countdown:5},
    ...opts
  };
  const context={
    match,timeLeft:1,clockPhase:'normal',timerRunning:false,timer:null,
    window:{},
    setInterval:fn=>{fired.push(fn);return fired.length;},
    clearInterval:()=>{},
    renderClock:()=>renders.push('clock'),
    renderMatch:()=>renders.push('match'),
    autosaveCurrent:()=>renders.push('save'),
    beep:()=>{},
    toast:s=>announcements.push(s),
    saveManualEntryUndoSnapshot:label=>snapshots.push({
      label,turn:match.turn,foils:match.stats[0].fouls
    }),
    consumeSoftBreakReturnOnShot:()=>{},
    consumePushOutOptionOnAction:()=>{},
    addActionEvent:event=>events.push(event),
    winRack:(who,force,reason)=>wins.push({who,force,reason})
  };
  vm.runInNewContext(foul+timer+'\nstartTimer();',context);
  return {context,match,fired,announcements,events,snapshots,wins,renders};
}

for(const discipline of ['8-ball','9-ball','10-ball']){
  test(discipline+' clock expiration is a foul, changes the turn and automatically restarts at normal shot time',()=>{
    const state=createGame(discipline);
    state.fired[0]();
    assert.equal(state.match.turn,1);
    assert.equal(state.match.stats[0].fouls,1);
    assert.equal(state.match.stats[1].fouls,0);
    assert.equal(state.match.consecutiveFouls[0],1);
    assert.equal(state.context.timeLeft,30);
    assert.equal(state.context.timerRunning,true);
    assert.equal(state.fired.length,2,'opponent receives a new running timer');
    assert.match(state.events[0],/Časový faul • Hráč A/);
    assert.deepEqual(state.snapshots,[{label:'Časový faul',turn:0,foils:0}]);
    assert.ok(state.renders.includes('save'),'the match must be persisted');
    assert.ok(state.announcements.some(s=>s.includes('TIME')));
    state.fired[1]();
    // The second callback represents the new timer, not a duplicate timeout.
    assert.equal(state.context.timeLeft,29);
    assert.equal(state.match.stats[1].fouls,0);
  });
}

test('normal manual foul still uses existing behavior',()=>{
  const x=createGame('8-ball');
  x.context.window.actionFoul();
  assert.equal(x.match.turn,1);
  assert.equal(x.match.stats[0].fouls,1);
  assert.match(x.events[0],/^Faul • /);
  assert.equal(x.context.timeLeft,30);
});

test('third shot-clock foul in 9-ball follows the existing 3-foul rule',()=>{
  const x=createGame('9-ball',{useThreeFoul:true,consecutiveFouls:[2,0]});
  x.fired[0]();
  assert.equal(x.match.stats[0].fouls,1);
  assert.equal(x.match.stats[0].threeFoulLosses,1);
  assert.equal(x.match.consecutiveFouls[0],0);
  assert.equal(x.wins.length,1);
  assert.equal(x.wins[0].who,1);
  assert.equal(x.wins[0].reason,'3 Foul Rule');
});

test('14.1 and Ghost do not silently use rack game foul/turn rules',()=>{
  for(const opts of [{discipline:'14.1'},{discipline:'8-ball',ghostMode:true}]){
    const {discipline,...extra}=opts;
    const x=createGame(discipline,extra);
    x.fired[0]();
    assert.equal(x.match.turn,0);
    assert.equal(x.match.stats[0].fouls,0);
    assert.equal(x.context.timerRunning,false);
    assert.ok(x.announcements.some(s=>s.includes('TIME')));
  }
});

test('source checks protect against reverting to a toast-only time-out',()=>{
  assert.match(timer,/window\.actionFoul\('time'\)/);
  assert.match(foul,/timeFoul\?'Časový faul':'Faul'/);
  assert.match(timer,/!match\.ghostMode/);
});
