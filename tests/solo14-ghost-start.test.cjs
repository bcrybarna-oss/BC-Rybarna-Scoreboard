'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

const openingFn=(html.match(/  function openingBreakAvailableForAction14\(m\)\{[\s\S]*?\n  \}/)||[])[0];
const rackFn=(html.match(/  function beginRack\(\)\{[\s\S]*?\n  \}/)||[])[0];
assert.ok(openingFn,'Missing production opening break eligibility function');
assert.ok(rackFn,'Missing production beginRack function');
const active=new Function(openingFn+'\nreturn openingBreakAvailableForAction14')();

function match({ghost=false,solo=true}={}){
 return {
  discipline:'14.1',solo14:solo,solo14GhostMode:ghost,endedAt:null,
  openingBreakAvailable14:true,ballsOnTable:15,reracksInInning14:0,inningsHistory14:[],
  isBreakShot:true,playerNames:['Hráč','Ghost'],breaker:0,turn:0,
  rackNumber:1,consecutiveFouls:[],warnedTwoFouls:[],extensionsUsed:[],
  stats:[{breaks:0},{}],useClock:true,events:[],scores:[0,0]
 };
}
function begin(m){
 const events=[],clocks=[];
 const context={
  match:m,streamLagPending:()=>false,stopTimer:()=>{},syncWinnerTableSlots:()=>{},
  ensureDetailedPlay:()=>{},logEvent:(line)=>events.push(line),
  resetClock:(...args)=>clocks.push(args),
  console
 };
 vm.createContext(context);
 vm.runInContext(rackFn+'\nbeginRack();',context);
 return {events,clocks};
}

test('14.1 Ghost: even restored legacy break flags must not offer opening break',()=>{
 const ghost=match({ghost:true});
 assert.equal(active(ghost),false);
 const normal=match({ghost:false});
 assert.equal(active(normal),true);
 assert.equal(active({...normal,solo14:false}),true,'classic 14.1 retains legal opening break');
 assert.equal(active({...ghost,solo14GhostMode:false}),true);
});

test('New Ghost 14.1 game starts with 15 balls and no opening-break prompt',()=>{
 assert.match(html,/ballsOnTable:\s*discipline==='14\.1' \? 15 : null/);
 assert.match(html,/openingBreakAvailable14:\s*discipline==='14\.1' && !solo14GhostMode/);
 assert.match(html,/isBreakShot:!solo14GhostMode/);
 assert.match(html,/openingBreakAvailableForAction14\(match\)/);
 assert.match(html,/\$\('openingBreakOk14'\)\.classList\.toggle\('hidden', !openingBreakActive\)/);
 assert.match(html,/\$\('openingBreakFoul14'\)\.classList\.toggle\('hidden', !openingBreakActive\)/);
});

test('Ghost 14.1 begins a run without recording a break or allocating a break-shot clock',()=>{
 const ghost=match({ghost:true});
 const r=begin(ghost);
 assert.equal(ghost.isBreakShot,false);
 assert.equal(ghost.stats[0].breaks,0);
 assert.deepEqual(r.events,['14.1 Ghost • začátek náběhu • 14 koulí v trojúhelníku + brejková koule']);
 assert.deepEqual(r.clocks,[[false,true]]);
 assert.equal(ghost.ballsOnTable,15);
});

test('Classic 14.1 and solo training keep their existing opening-break behavior',()=>{
 for(const solo of [true,false]){
  const ordinary=match({solo,ghost:false});
  const r=begin(ordinary);
  assert.equal(ordinary.isBreakShot,true);
  assert.equal(ordinary.stats[0].breaks,1);
  assert.deepEqual(r.clocks,[[true,true]]);
  assert.match(r.events[0],/rozstřel/);
  assert.equal(active(ordinary),true);
 }
});

test('Ghost tiles display player, table balls and Ghost in that order with intact IDs',()=>{
 const section=html.match(/<div id="solo14ScoreRow" class="solo14-score-row hidden">([\s\S]*?)<div id="p1ScoreAdjust"/)?.[1];
 assert.ok(section,'Missing solo score panel');
 const indices=['solo14TotalScore','solo14BallsTop','solo14GhostScore'].map(id=>section.indexOf('id="'+id+'"'));
 assert.ok(indices.every(x=>x>=0));
 assert.ok(indices[0]<indices[1]&&indices[1]<indices[2],'Order must be player → balls → Ghost');
 assert.match(html,/#solo14ScoreRow\.ghost-enabled\s*\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
});

test('In Ghost mode Undo remains available without two irrelevant break actions',()=>{
 assert.match(html,/\.fourteen-utility-grid:not\(:has\(#openingBreakOk14:not\(\.hidden\)\)\)\s*\{\s*grid-template-columns:1fr;/);
 assert.match(html,/\$\('undo14Btn'\)\.onclick=undo/);
});
