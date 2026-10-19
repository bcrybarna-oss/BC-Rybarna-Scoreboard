'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert.ok(start>=0,name);return html.slice(start,html.indexOf('\n  }',start)+4)}
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(discipline='9-ball'){
 const elements=new Map();const el=id=>{if(!elements.has(id))elements.set(id,{classList:{add(){},remove(){}},textContent:''});return elements.get(id)};
 const ctx={match:{discipline,counterMode:'full',turn:1,breaker:0,isBreakShot:false,playerNames:['SK','CZ'],stats:[{},{}],scores:[0,0],events:[],rackRemainingBalls:[1,2,3,4,5,6,7,8,9],safetyEscapeEligibleFor:1,breakAndRunEligible:false,runoutEligibleFor:null,consecutiveFouls:[0,1],warnedTwoFouls:[false,false],useClock:false},pendingSafetyEscapePlayer:1,lastManualEntrySnapshot:null,$:el,
   cloneForUndo:clone,exactBallTrackingDiscipline:()=>discipline==='9-ball'||discipline==='10-ball',
   snapshot:()=>JSON.stringify(ctx.match),
   saveManualEntryUndoSnapshot:()=>{ctx.lastManualEntrySnapshot={match:clone(ctx.match)}},
   logEvent:(text,meta={})=>ctx.match.events.push({text,meta}),
   addActionEvent:text=>ctx.logEvent(text,{undoSnapshot:ctx.snapshot()}),
   openShotBallSelector:req=>{ctx.request=req},renderMatch(){ctx.rendered=true},resetClock(){},autosaveCurrent(){ctx.saved=true},
   finishGameBallFromTrackedPlay(i,ball){ctx.gameBall=ball;ctx.match.scores[i]++;ctx.addActionEvent('game ball');}};
 vm.createContext(ctx);vm.runInContext(['ensureSafetyEscapeStats','safetyEscapeSuccessful','finishSafetyEscapeSuccess'].map(fn).join('\n'),ctx);
 ctx.confirm=balls=>{ctx.match.rackRemainingBalls=ctx.match.rackRemainingBalls.filter(n=>!balls.includes(n));ctx.request.onDone(balls)};
 return ctx;
}
test('potted safety escape requests exact ball selection before changing stats or turn',()=>{
 const h=harness(),before=JSON.stringify(h.match);h.finishSafetyEscapeSuccess('continue');
 assert.ok(h.request);assert.equal(h.request.requirePot,true);assert.equal(h.request.player,1);
 assert.equal(JSON.stringify(h.match),before);assert.equal(h.lastManualEntrySnapshot,null);
});
test('selected escape balls are logged once and both undo snapshots precede ball removal',()=>{
 const h=harness(),before=clone(h.match);h.finishSafetyEscapeSuccess('continue');h.confirm([1,3]);
 assert.deepEqual(h.match.rackRemainingBalls,[2,4,5,6,7,8,9]);assert.equal(h.match.turn,1);
 assert.equal(h.match.stats[1].safetyEscapes,1);assert.equal(h.match.stats[1].successfulSafetyEscapes,1);
 assert.match(h.match.events[0].text,/spadly: 1, 3/);
 assert.deepEqual(JSON.parse(h.match.events[0].meta.undoSnapshot),before);
 assert.deepEqual(h.lastManualEntrySnapshot.match,before);
 h.request.onDone([1,3]);assert.equal(h.match.stats[1].safetyEscapes,1,'a stale callback cannot record another attempt');
});
test('non-pot, resafe and 8-ball keep their existing flow without an exact-ball dialog',()=>{
 for(const outcome of ['end','resafe']){const h=harness();h.finishSafetyEscapeSuccess(outcome);assert.equal(h.request,undefined);assert.equal(h.match.turn,0);assert.equal(h.match.stats[1].successfulSafetyEscapes,1);if(outcome==='resafe'){assert.equal(h.match.stats[1].resafes,1);assert.equal(h.match.safetyEscapeEligibleFor,0)}}
 const h=harness('8-ball');h.finishSafetyEscapeSuccess('continue');assert.equal(h.request,undefined);assert.equal(h.match.turn,1);assert.equal(h.match.stats[1].safetyEscapes,1);
});
test('game-winning escape remains one undoable action and never creates B&R',()=>{
 const h=harness(),before=clone(h.match);h.finishSafetyEscapeSuccess('continue');h.confirm([9]);
 assert.equal(h.gameBall,9);assert.equal(h.match.scores[1],1);assert.equal(h.match.stats[1].safetyEscapes,1);assert.equal(h.match.stats[1].breakAndRun,undefined);
 assert.deepEqual(JSON.parse(h.match.events[0].meta.undoSnapshot),before);assert.equal(h.match.events[1].meta.undoSnapshot,undefined);assert.equal(h.saved,true);
});
test('early 10 on spot rules is restored while other selected balls stay removed',()=>{
 const h=harness('10-ball');h.match.rackRemainingBalls.push(10);h.match.tenBallRule='spot';h.finishSafetyEscapeSuccess('continue');h.confirm([1,10]);
 assert.equal(h.gameBall,undefined);assert.ok(h.match.rackRemainingBalls.includes(10));assert.equal(h.match.rackRemainingBalls.includes(1),false);assert.equal(h.match.stats[1].safetyEscapes,1);
});
