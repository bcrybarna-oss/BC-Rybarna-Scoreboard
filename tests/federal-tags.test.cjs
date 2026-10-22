'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {taggedReference}=require('./fixtures/federal-tags.cjs'),{reference,copy}=require('./fixtures/federal-calculation.cjs');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),a=html.indexOf('  function federalRackScoresAgree('),b=html.indexOf('\n  }',a)+4;
const ctx={fetch(){throw Error('No network')},localStorage:{setItem(){throw Error('No writes')}}};vm.createContext(ctx);vm.runInContext(html.slice(a,b)+html.slice(html.indexOf('  // Federal Cup calculation contract v1.'),html.indexOf('  function detailedCounterActive()')),ctx);
const calc=m=>copy(ctx.federalCalculateMatch(m)),season=ms=>copy(ctx.federalCalculateSeason(ms,{year:2026},2026));
test('13 metrics: tagged pot/miss/foul/escape are attributes, original eleven stay unchanged',()=>{
 const m=taggedReference(),base=calc(reference()),r=calc(m);
 assert.equal(Object.keys(r.sides[0].metrics).length,13);
 for(const side of [0,1])for(const [key,x]of Object.entries(base.sides[side].metrics))if(!['jumpShots','bankShots'].includes(key))assert.deepEqual(r.sides[side].metrics[key],x,key);
 for(const [side,key,n,d]of [[0,'jumpShots',2,3],[0,'bankShots',1,3],[1,'jumpShots',0,1],[1,'bankShots',1,2]]){const x=r.sides[side].metrics[key];assert.equal(x.kind,'ratio');assert.equal(x.numerator,n);assert.equal(x.denominator,d);assert.equal(x.value,n/d);assert.equal(x.coverage,'complete');}
});
test('annual ratios add numerators and denominators, including stable participant identity',()=>{
 const a=taggedReference('singles','first'),b=taggedReference('singles','second',1),before=JSON.stringify([a,b]);const r=season([a,b]).individuals.a1.metrics;
 assert.equal(r.jumpShots.numerator,3);assert.equal(r.jumpShots.denominator,5);assert.equal(r.bankShots.numerator,3);assert.equal(r.bankShots.denominator,7);assert.equal(r.bankShots.value,3/7);assert.equal(r.bankShots.coverage,'complete');assert.equal(JSON.stringify([a,b]),before);
});
test('Team players use actual rack actors and canonical strokes; Doubles remain pairs only',()=>{
 const m=taggedReference('team'),r=calc(m);assert.equal(r.individuals.a2.metrics.jumpShots.numerator,2);assert.equal(r.individuals.a2.metrics.jumpShots.denominator,3);assert.equal(r.individuals.a1.metrics.jumpShots.denominator,0);
 for(const rack of m.federalTeam.racks)rack.shots.push(...copy(m.detailedPlay.records));assert.deepEqual(calc(m),r);
 const d=calc(taggedReference('doubles'));assert.deepEqual(d.individuals,{});assert.equal(Object.values(d.pairs)[0].metrics.jumpShots.numerator,2);
 const y=season([m,taggedReference('singles','s')]);assert.equal(y.individuals.a2.metrics.jumpShots.denominator,3);
});
test('partial history and missing reference retain canonical tag subtotals and never official value',()=>{
 const m=taggedReference('team');m.detailedPlay.coverage='partial';let x=calc(m).individuals.a2.metrics.jumpShots;assert.equal(x.numerator,2);assert.equal(x.denominator,3);assert.equal(x.coverage,'partial');assert.equal(x.value,null);assert.equal(season([m]).individuals.a2.metrics.jumpShots.value,null);
 const n=taggedReference(),lost=n.detailedPlay.records.find(r=>r.tag?.type==='jump'&&r.kind==='pot');n.detailedPlay.records=n.detailedPlay.records.filter(r=>r.id!==lost.id);x=calc(n).sides[0].metrics.jumpShots;assert.equal(x.numerator,1);assert.equal(x.denominator,2);assert.equal(x.value,null);assert.ok(x.reasons.includes('missing_shot_reference'));
});
test('duplicates never add attempts; conflicting canonical tags are excluded and exposed',()=>{
 const m=taggedReference(),r=m.detailedPlay.records.find(r=>r.tag?.type==='jump');m.detailedPlay.records.push(copy(r));let x=calc(m).sides[0].metrics.jumpShots;assert.equal(x.denominator,3);assert.equal(x.value,null);
 m.detailedPlay.records.at(-1).tag.success=false;x=calc(m).sides[0].metrics.jumpShots;assert.equal(x.numerator,1);assert.equal(x.denominator,2);assert.ok(x.reasons.includes('conflicting_shot_record'));assert.equal(x.value,null);
});
test('missing Jump counter degrades only Jump; counter mismatch does not override canonical strokes',()=>{
 const m=taggedReference();delete m.stats[0].jumpShotAttempts;let x=calc(m).sides[0].metrics;assert.equal(x.jumpShots.coverage,'partial');assert.equal(x.jumpShots.denominator,3);assert.equal(x.bankShots.coverage,'complete');assert.equal(x.pottingSuccess.coverage,'complete');
 m.stats[0].jumpShotAttempts=100;x=calc(m).sides[0].metrics;assert.equal(x.jumpShots.denominator,3);assert.ok(x.jumpShots.reasons.includes('tag_counter_mismatch'));assert.equal(x.jumpShots.value,null);
});
test('true zero, zero denominator and unknown historic tags are distinct',()=>{
 const m=taggedReference();for(const r of m.detailedPlay.records)delete r.tag;for(const st of m.stats)for(const t of ['jump','bank'])st[t+'ShotAttempts']=st[t+'ShotSuccessful']=0;
 const x=calc(m).sides[0].metrics.jumpShots;assert.equal(x.numerator,0);assert.equal(x.denominator,0);assert.equal(x.coverage,'complete');assert.equal(x.value,null);assert.ok(x.reasons.includes('zero_denominator'));
 const y=calc(reference()).sides[0].metrics.jumpShots;assert.equal(y.numerator,null);assert.equal(y.denominator,null);assert.equal(y.coverage,'unknown');assert.equal(y.value,null);
});
test('historic aggregate-only tag counters stay partial for side, never manufacture personal strokes',()=>{
 const m=taggedReference();delete m.detailedPlay;const r=calc(m);assert.equal(r.sides[0].metrics.jumpShots.numerator,2);assert.equal(r.sides[0].metrics.jumpShots.denominator,3);assert.equal(r.sides[0].metrics.jumpShots.coverage,'partial');assert.equal(r.individuals.a1.metrics.jumpShots.coverage,'unknown');assert.equal(r.individuals.a1.metrics.jumpShots.numerator,null);
 const t=taggedReference('team');for(const r of t.detailedPlay.records)delete r.tag;assert.equal(calc(t).individuals.a2.metrics.jumpShots.coverage,'unknown');assert.equal(calc(t).individuals.a2.metrics.jumpShots.denominator,null);
});
test('inconsistent result and Bank escape cannot be published as complete',()=>{
 const m=taggedReference(),r=m.detailedPlay.records.find(r=>r.tag?.type==='jump'&&r.kind==='miss');r.tag.success=true;assert.equal(calc(m).sides[0].metrics.jumpShots.value,null);assert.ok(calc(m).sides[0].metrics.jumpShots.reasons.includes('tag_result_conflict'));
 const e=m.detailedPlay.records.find(r=>r.tag?.type==='jump'&&r.kind==='escape');e.tag.type='bank';assert.equal(calc(m).sides[0].metrics.bankShots.value,null);assert.ok(calc(m).sides[0].metrics.bankShots.reasons.includes('invalid_tag_action'));
});

test('invalid counters and unassigned Team rack tags propagate uncertainty to the year',()=>{
 const m=taggedReference();m.stats[0].jumpShotAttempts=-1;let x=calc(m).sides[0].metrics.jumpShots;assert.equal(x.denominator,3);assert.ok(x.reasons.includes('invalid_tag_counter'));assert.equal(x.value,null);
 const t=taggedReference('team'),r=t.detailedPlay.records.find(r=>r.tag?.type==='jump');r.rack=99;
 x=calc(t).individuals.a2.metrics.jumpShots;assert.equal(x.denominator,2);assert.equal(x.coverage,'partial');assert.ok(x.reasons.includes('unassigned_shot_rack'));assert.equal(season([t]).individuals.a2.metrics.jumpShots.value,null);
});
