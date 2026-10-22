'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const fixture=require('./fixtures/federal-team-breaker-correction.json');
const copy=x=>JSON.parse(JSON.stringify(x));
function fn(name){const start=html.indexOf('  function '+name+'(');assert.ok(start>=0,name);const end=html.indexOf('\n  }',start);return html.slice(start,end+4);}
function harness(m){
 const ctx={match:copy(m),events:[],toasts:[],renders:0,
   Number,JSON,Math,Object,Array,
   logEvent(text,meta){ctx.events.push({text,meta})},
   toast(text){ctx.toasts.push(text)},renderMatch(){ctx.renders++},resetClock(){},syncWinnerTableSlots(){},stopTimer(){},
   saveManualEntryUndoSnapshot(){ctx.manualSnapshot=copy(ctx.match)}};
 vm.createContext(ctx);
 vm.runInContext(['streamLagPending','detailedCounterActive','ensureDetailedPlay','snapshot','restoreSnapshot','addActionEvent','changeRackBreaker','beginRack','breakStats'].map(fn).join('\n'),ctx);
 return ctx;
}
function before(){return {...copy(fixture.saved),...copy(fixture.beforeManualBreaker),events:[],endedAt:null,status:'playing'};}

test('preserved 200% case: rack 1 changed breaker but its break remained assigned to Slovakia',()=>{
 const m=fixture.saved,h=harness(m);
 const br=h.breakStats(m,1);
 assert.equal(m.id,fixture.sourceMatchId);
 assert.deepEqual(m.stats.map(s=>s.breaks),[4,2]);
 assert.equal(br.total,2);assert.equal(br.successful,1);assert.equal(br.pct,50);
 assert.equal(m.stats[1].breakAndRun/br.successful*100,200,'original fixture remains unchanged');
 assert.equal(m.federalTeam.racks[0].breaker,1);
 assert.deepEqual(m.federalTeam.racks[0].stats.map(s=>s.breaks),[1,0]);
 assert.equal(m.federalTeam.racks[0].players[1].name,'Filip Ukázkový CZ');
 assert.equal(m.federalTeam.racks[0].stats[1].breakAndRun,1);
});

test('actual main handler transfers an existing break; undo restores exactly the pre-change snapshot',()=>{
 const h=harness(before()),beforeState=h.snapshot();
 h.changeRackBreaker();
 assert.equal(h.match.breaker,1);assert.equal(h.match.turn,1);
 assert.deepEqual(Array.from(h.match.stats,s=>s.breaks),[0,1]);
 assert.deepEqual(Array.from(h.match.federalTeam.baseline,s=>s.breaks),[0,0]);
 assert.equal(h.events.length,1);
 assert.deepEqual(h.manualSnapshot.stats.map(s=>s.breaks),[1,0]);
 h.restoreSnapshot(h.events[0].meta.undoSnapshot);
 assert.equal(h.snapshot(),beforeState);
 h.changeRackBreaker();h.changeRackBreaker();
 assert.deepEqual(Array.from(h.match.stats,s=>s.breaks),[1,0],'two changes never add a second attempt');
});

test('Team correction before player selection counts nothing until beginRack and attributes it to chosen player',()=>{
 const m=before();m.federalTeam.pending=true;m.federalTeam.players=[null,null];m.stats=copy(m.federalTeam.baseline);
 const h=harness(m);h.changeRackBreaker();
 assert.deepEqual(Array.from(h.match.stats,s=>s.breaks),[0,0]);
 h.match.federalTeam.players=copy(fixture.saved.federalTeam.racks[0].players);h.match.federalTeam.pending=false;h.beginRack();
 assert.deepEqual(Array.from(h.match.stats,s=>s.breaks),[0,1]);
 assert.equal(h.match.federalTeam.players[1].name,'Filip Ukázkový CZ');
 assert.deepEqual(Array.from(h.match.federalTeam.baseline,s=>s.breaks),[0,0]);
});

test('Federal Cup disallows changing breaker after a resolved break without changing any saved state',()=>{
 for(const kind of ['OK','dry','soft','foul']){
  const m=before();m.isBreakShot=false;m.federalTeam.pending=false;
  const h=harness(m),state=h.snapshot();h.changeRackBreaker();
  assert.equal(h.snapshot(),state,kind);assert.equal(h.events.length,0);assert.equal(h.toasts.length,1);
 }
});

test('Singles and Doubles transfer the same existing attempt when correcting opening breaker',()=>{
 for(const type of ['singles','doubles']){
  const m=before();m.federalTeam=null;m.federalCupLink.type=type;m.doublesMode=type==='doubles';
  const h=harness(m);h.changeRackBreaker();
  assert.deepEqual(Array.from(h.match.stats,s=>s.breaks),[0,1],type);
  h.changeRackBreaker();assert.deepEqual(Array.from(h.match.stats,s=>s.breaks),[1,0],type);
 }
});

test('rack audit gives 3 Czech breaks, 2 successful breaks and 2 B&R; no percentage capping',()=>{
 const m=copy(fixture.saved),beforeStats=copy(m.stats);
 for(const r of m.federalTeam.racks){
  for(let side=0;side<2;side++){
   const corrected=side===r.breaker?1:0;
   m.stats[side].breaks+=corrected-r.stats[side].breaks;
   r.stats[side].breaks=corrected;
  }
 }
 const h=harness(m);
 assert.deepEqual(m.stats.map(s=>s.breaks),fixture.expected.breaks);
 assert.deepEqual(m.stats.map((_,i)=>h.breakStats(m,i).successful),fixture.expected.successful);
 assert.deepEqual(m.stats.map((_,i)=>h.breakStats(m,i).pct),fixture.expected.breakPct);
 assert.equal(m.stats[1].breakAndRun/h.breakStats(m,1).successful*100,100);
 assert.deepEqual(m.stats.map(s=>s.breakAndRun),[0,2]);
 assert.deepEqual(m.stats.map(s=>s.breakPottedBalls),[0,5]);
 assert.deepEqual(m.stats.map(s=>s.breakPottedTracked),[3,3]);
 assert.equal(h.breakStats(m,1).pottedAvg,5/3);
 for(let side=0;side<2;side++){
  const withoutBreaks=({...s})=>{delete s.breaks;return s};
  assert.deepEqual(withoutBreaks(m.stats[side]),withoutBreaks(beforeStats[side]));
  for(const key of Object.keys(m.stats[side]))assert.equal(m.federalTeam.racks.reduce((sum,r)=>sum+(r.stats[side][key]||0),0),m.stats[side][key],key);
 }
 const filip=m.federalTeam.racks.flatMap(r=>r.players.map((p,i)=>({p,s:r.stats[i]}))).filter(x=>x.p.id==='__FC26_2026_b_1__');
 assert.equal(filip.reduce((n,x)=>n+x.s.breaks,0),2);
 assert.equal(filip.reduce((n,x)=>n+x.s.breakAndRun,0),1);
 assert.equal(filip.reduce((n,x)=>n+x.s.breakFouls,0),1);
 assert.equal(m.federalTeam.racks[2].players[1].name,'Hynek Zkušební CZ');
 assert.equal(m.federalTeam.racks[2].stats[1].breaks,1);
 assert.equal(m.federalTeam.racks[2].stats[1].breakAndRun,1);
});

test('soft+dry overlap is counted once; break foul is unsuccessful but still tracks pocketed balls',()=>{
 const h=harness(before());
 for(const [stats,successful] of [
  [{breaks:1,dryBreaks:0,softBreaks:0,breakFouls:0},1],
  [{breaks:1,dryBreaks:1,softBreaks:1,softDryBreaks:1,breakFouls:0},0],
  [{breaks:1,dryBreaks:0,softBreaks:1,breakFouls:0},0],
  [{breaks:1,dryBreaks:1,softBreaks:0,breakFouls:0},0],
  [{breaks:1,dryBreaks:0,softBreaks:0,breakFouls:1,breakPottedBalls:1,breakPottedTracked:1},0]
 ])assert.equal(h.breakStats({stats:[stats]},0).successful,successful);
});
