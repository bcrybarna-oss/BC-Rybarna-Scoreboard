'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const {sample,clone}=require('./fixtures/federal-review-reference.cjs');
const ctx=require('./helpers/federal-statistics.cjs').load(process.env.FC_SOURCE_REF);
const calc=m=>clone(ctx.federalCalculateMatch(m)),season=ms=>clone(ctx.federalCalculateSeason(ms,{year:2026},2026));
test('P1 Team partial canonical history stays partial in personal and annual attack, independent fouls stay complete',()=>{
 const m=sample();m.detailedPlay.coverage='partial';const r=calc(m),x=r.individuals.red.metrics;
 assert.equal(x.pottingSuccess.coverage,'partial');assert.equal(x.pottingSuccess.value,null);assert.equal(x.pottingSuccess.numerator,4);assert.equal(x.pottingSuccess.denominator,6);
 assert.equal(x.fouls.coverage,'complete');const s=season([sample('singles','single'),m]).individuals.red.metrics;
 assert.equal(s.pottingSuccess.coverage,'partial');assert.equal(s.pottingSuccess.value,null);assert.equal(s.pottingSuccess.numerator,9);assert.equal(s.pottingSuccess.denominator,13);
});
test('P1 missing canonical MISS referenced by shotIds never becomes 100 percent, including personal and season',()=>{
 const m=sample(),missing=m.detailedPlay.records.find(r=>r.side===1&&r.kind==='miss');assert.equal(calc(m).sides[1].metrics.pottingSuccess.value,50);
 m.detailedPlay.records=m.detailedPlay.records.filter(r=>r.id!==missing.id);assert.ok(m.federalTeam.racks.some(r=>r.shotIds.includes(missing.id)));const before=JSON.stringify(m),r=calc(m);
 for(const x of [r.sides[1].metrics,r.individuals.blue2.metrics,season([m]).individuals.blue2.metrics]){assert.equal(x.pottingSuccess.value,null);assert.equal(x.pottingSuccess.coverage,'partial');assert.equal(x.pottingSuccess.numerator,1);assert.equal(x.pottingSuccess.denominator,1);assert.ok(x.pottingSuccess.reasons.includes('missing_shot_reference'));}
 assert.equal(JSON.stringify(m),before);assert.equal(r.individuals.red.metrics.pottingSuccess.coverage,'complete');assert.equal(r.sides[1].metrics.fouls.coverage,'complete');
});
test('P2 one absent rack counter preserves known Team and annual foul subtotal',()=>{
 const m=sample();delete m.federalTeam.racks[0].stats[0].fouls;const x=calc(m).individuals.red.metrics;
 assert.equal(x.fouls.count,3);assert.equal(x.fouls.coverage,'partial');assert.equal(x.fouls.value,null);assert.equal(x.pottingSuccess.coverage,'complete');
 assert.equal(calc(m).individuals.red2.metrics.fouls.coverage,'complete');assert.equal(calc(m).individuals.blue.metrics.fouls.coverage,'complete');
 const s=season([sample('singles','single'),m]).individuals.red.metrics;assert.equal(s.fouls.count,7);assert.equal(s.fouls.coverage,'partial');assert.equal(s.fouls.value,null);
});
test('known attack subtotal 2/3 + 1/1 + unknown remains 3/4 partial, across matches too',()=>{
 const m=sample();const rows=m.detailedPlay.records.filter(r=>r.side===0&&[1,2,5].includes(r.rack));for(const r of rows){r.pottingAttempts=0;r.successfulPottingStrokes=0;}
 Object.assign(rows.find(r=>r.rack===1),{intent:'pot',kind:'pot',pottingAttempts:3,successfulPottingStrokes:2});Object.assign(rows.find(r=>r.rack===2),{intent:'pot',kind:'pot',pottingAttempts:1,successfulPottingStrokes:1});Object.assign(rows.find(r=>r.rack===5),{intent:'unknown',pottingAttempts:null,successfulPottingStrokes:null});
 const x=calc(m).individuals.red.metrics.pottingSuccess;assert.equal(x.numerator,3);assert.equal(x.denominator,4);assert.equal(x.coverage,'partial');assert.equal(x.value,null);
 assert.equal(calc(m).individuals.red2.metrics.pottingSuccess.coverage,'complete');assert.equal(calc(m).individuals.red.metrics.fouls.coverage,'complete');
 const s=season([m,sample('singles','single')]).individuals.red.metrics.pottingSuccess;assert.equal(s.numerator,8);assert.equal(s.denominator,11);assert.equal(s.coverage,'partial');assert.equal(s.value,null);
});
test('missing failure counter never invents a successful break; provable ratios retain known parts',()=>{
 const m=sample();delete m.federalTeam.racks[4].stats[0].dryBreaks;const x=calc(m).individuals.red.metrics.breakSuccess;
 assert.equal(x.numerator,1);assert.equal(x.denominator,2);assert.equal(x.coverage,'partial');assert.equal(x.value,null);
 assert.equal(calc(m).individuals.red2.metrics.breakSuccess.coverage,'complete');
});
test('missing one rack preserves known subtotals independently across other counter metrics',()=>{
 for(const [counter,key,n,d]of [['successfulSafeties','safetySuccess',2,3],['successfulSafetyEscapes','escapeSuccess',2,3],['resafes','resafes',1,null],['breakPottedBalls','breakBallAverage',2,2],['aces','aces',0,null],['breakAndRun','cleanRuns',1,null]]){
  const m=sample();delete m.federalTeam.racks[0].stats[0][counter];const x=calc(m).individuals.red.metrics[key];
  assert.equal(x.numerator,n,key);assert.equal(x.denominator,d,key);assert.equal(x.coverage,'partial',key);assert.equal(x.value,null,key);
  assert.equal(calc(m).individuals.blue.metrics[key].coverage,'complete',key);
 }
});
test('missing actor on the opposite side does not invalidate independently attributed rack counters',()=>{
 const m=sample();m.federalTeam.racks[0].players[1].identityStatus='legacy';const x=calc(m).individuals.red.metrics;
 assert.equal(x.fouls.value,3);assert.equal(x.breakSuccess.coverage,'complete');assert.equal(x.pottingSuccess.coverage,'complete');
});
test('missing/duplicate/conflicting references and foreign rack/match/actor are explicit integrity failures',()=>{
 for(const kind of ['duplicate_reference','duplicate_record','wrong_rack','wrong_match','wrong_actor']){
  const m=sample(),r=m.detailedPlay.records.find(r=>r.side===1&&r.kind==='miss'),rack=m.federalTeam.racks.find(x=>x.rack===r.rack);
  if(kind==='duplicate_reference')rack.shotIds.push(r.id);if(kind==='duplicate_record')m.detailedPlay.records.push({...clone(r),pottingAttempts:7});if(kind==='wrong_rack')r.rack=2;if(kind==='wrong_match')r.matchId='foreign';if(kind==='wrong_actor')r.actor.id='red';
  const x=calc(m).sides[1].metrics.pottingSuccess;assert.equal(x.value,null,kind);assert.equal(x.coverage,'partial',kind);assert.ok(x.reasons.some(s=>/reference|record|actor/.test(s)),kind);if(kind==='duplicate_record')assert.ok(x.reasons.includes('conflicting_shot_record'));
 }
});
test('legacy references absent do not fabricate history; true zero and unknown counters remain different',()=>{
 const m=sample();for(const r of m.federalTeam.racks)delete r.shotIds;assert.equal(calc(m).individuals.red.metrics.fouls.value,3);
 for(const r of m.federalTeam.racks.filter(r=>r.players[0].id==='red'))delete r.stats[0].fouls;
 const x=calc(m).individuals.red.metrics.fouls;assert.equal(x.count,null);assert.equal(x.coverage,'unknown');assert.equal(x.value,null);
 assert.equal(calc(sample()).individuals.red2.metrics.resafes.value,0);
});
test('conflicting canonical ID across two rack actors stays partial in both personal and annual outputs',()=>{
 const m=sample(),r=m.detailedPlay.records.find(r=>r.side===0&&r.kind==='pot'),other={...clone(r),rack:4,actor:clone(m.federalTeam.racks[3].players[0]),pottingAttempts:7};
 m.detailedPlay.records.push(other);m.federalTeam.racks[3].shotIds.push(other.id);
 for(const id of ['red','red2'])for(const x of [calc(m).individuals[id],season([m]).individuals[id]]){
  assert.equal(x.metrics.pottingSuccess.coverage,'partial',id);assert.equal(x.metrics.pottingSuccess.value,null,id);assert.ok(x.metrics.pottingSuccess.reasons.includes('conflicting_shot_record'),id);
 }
 const reversed=clone(m);reversed.detailedPlay.records.reverse();assert.deepEqual(calc(m).sides[0].metrics.pottingSuccess,calc(reversed).sides[0].metrics.pottingSuccess);
});
test('independent five-rack reference: all 11 metrics, both sides, stable actors and immutable deterministic input',()=>{
 const m=sample(),before=JSON.stringify(m),r=calc(m),keys=['breakSuccess','breakBallAverage','ownBreakWins','aces','cleanRuns','pottedBalls','pottingSuccess','safetySuccess','escapeSuccess','resafes','fouls'];
 const expected=[[200/3,5/3,1,1,1,19,500/7,200/3,200/3,1,4],[50,.5,0,0,0,1,50,100,100,0,4]];
 for(const side of [0,1])for(let i=0;i<keys.length;i++){const x=r.sides[side].metrics[keys[i]];assert.equal(x.coverage,'complete',keys[i]);assert.ok(Math.abs(x.value-expected[side][i])<1e-10,keys[i]);}
 assert.equal(JSON.stringify(m),before);assert.deepEqual(calc(m),r);assert.deepEqual(season([m]),season([m]));
});
test('independent annual player red: all known Singles plus actual Team rack contributions',()=>{
 const x=season([sample(),sample('singles','single')]).individuals.red.metrics;
 const expected={breakSuccess:[4,5],breakBallAverage:[8,5],ownBreakWins:[5,5],aces:2,cleanRuns:2,pottedBalls:31,pottingSuccess:[9,13],safetySuccess:[4,6],escapeSuccess:[4,6],resafes:2,fouls:7};
 for(const [key,want]of Object.entries(expected)){assert.equal(x[key].coverage,'complete',key);if(Array.isArray(want)){assert.equal(x[key].numerator,want[0],key);assert.equal(x[key].denominator,want[1],key);}else assert.equal(x[key].value,want,key);}
});
