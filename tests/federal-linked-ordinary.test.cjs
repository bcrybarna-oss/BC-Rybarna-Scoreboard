'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const sample=require('./fixtures/federal-linked-ordinary-doubles.json'),{canonical,roundTrip}=require('./helpers/firebase-json.cjs'),copy=x=>JSON.parse(JSON.stringify(x));
const root=path.join(__dirname,'..'),html=process.env.FC_LEGACY_BASELINE?execFileSync('git',['show','origin/main:index.html'],{cwd:root,encoding:'utf8',maxBuffer:10*1024*1024}):fs.readFileSync(path.join(root,'index.html'),'utf8');
const a=html.indexOf('  function federalRackScoresAgree('),b=html.indexOf('\n  }',a)+4,c={};vm.createContext(c);vm.runInContext(html.slice(a,b)+html.slice(html.indexOf('  // Federal Cup calculation contract v1.'),html.indexOf('  function detailedCounterActive()')),c);
const calc=m=>copy(c.federalCalculateMatch(m)),metric=(m,key)=>calc(m).sides[0].metrics[key],format=m=>c.federalReportMetric(m).text;
function withRecords(records){const m=copy(sample);m.detailedPlay.records=records;return m;}
const pot=(id,n=1,extra={})=>({id,kind:'pot',side:0,pottedCount:n,strokeCount:1,...extra});
test('actual #9 ordinary Doubles: 48/51 and 12/14, 48/12 pots; pair ownership, not personal stats',()=>{
 const before=canonical(sample),r=calc(sample);assert.equal(sample.detailedPlay.records.length,46);assert.ok(sample.detailedPlay.records.every(r=>!r.evidenceVersion&&r.sideId===sample.playerIds[r.side]&&!r.actor));
 for(const [side,n,d,p,miss]of [[0,48,51,48,3],[1,12,14,12,2]]){const s=r.sides[side];assert.equal(s.owner.kind,'pair');assert.equal(s.metrics.pottedBalls.count,p);assert.equal(s.metrics.pottingSuccess.numerator,n);assert.equal(s.metrics.pottingSuccess.denominator,d);assert.equal(s.metrics.missedPots.count,miss);assert.equal(s.metrics.pottingSuccess.coverage,'partial');assert.equal(format(s.metrics.pottingSuccess),side?'86 %':'94 %');assert.equal(s.metrics.ownBreakWins.coverage,'unknown');assert.equal(s.metrics.ownBreakWins.numerator,null);}
 assert.deepEqual(r.individuals,{});assert.equal(Object.keys(r.pairs).length,2);assert.equal(canonical(sample),before);assert.deepEqual(calc(roundTrip(sample)),r);
});
test('known sequential batch versus one-stroke multipot and explicit MISS never double counted',()=>{
 const m=withRecords([pot('batch',3,{entry:'sequential_batch',strokeCount:null}),pot('multi',2),{id:'miss',kind:'miss',side:0,ball:7,strokeCount:1}]);
 assert.equal(metric(m,'pottedBalls').count,5);assert.equal(metric(m,'pottingSuccess').numerator,4);assert.equal(metric(m,'pottingSuccess').denominator,5);assert.equal(metric(m,'missedPots').count,1);
});
test('missing legacy pots/attempts are unknown, never fabricated zero or 0/0',()=>{
 const m=withRecords([{id:'unknown',kind:'pot',side:0}]);assert.equal(metric(m,'pottedBalls').count,null);assert.equal(format(metric(m,'pottedBalls')),'—');assert.equal(metric(m,'pottingSuccess').numerator,null);assert.equal(metric(m,'pottingSuccess').denominator,null);assert.equal(format(metric(m,'pottingSuccess')),'—');
 const knownBalls=withRecords([{id:'balls-only',kind:'pot',side:0,pottedCount:2}]);assert.equal(metric(knownBalls,'pottedBalls').count,2);assert.equal(format(metric(knownBalls,'pottingSuccess')),'—','two fallen balls do not prove two strokes');
});
test('unknown v2 remains unknown; v2 markers and explicit null fields are not repaired by the reader',()=>{
 const m=withRecords([{id:'v2',kind:'pot',side:0,evidenceVersion:2,intent:'unknown',potsEvidence:'unknown',pottingAttempts:null,successfulPottingStrokes:null}]);
 assert.equal(format(metric(m,'pottedBalls')),'—');assert.equal(format(metric(m,'pottingSuccess')),'—');
 const old=withRecords([pot('explicit-null',1,{pottingAttempts:null,successfulPottingStrokes:null})]);assert.equal(format(metric(old,'pottingSuccess')),'—');
});
test('push out and defensive/foul actions do not invent attacking misses; explicit attack foul counts once',()=>{
 const base=[pot('pot'),{id:'push',kind:'push_out',side:0,balls:[2,3],pottedCount:2},{id:'resafe',kind:'escape',side:0,pottedCount:0,success:true}];
 let m=withRecords([...base,{id:'foul',kind:'foul',side:0,intent:'safety',strokeCount:1}]);assert.equal(metric(m,'pottedBalls').count,1);assert.equal(metric(m,'pottingSuccess').denominator,1);assert.equal(metric(m,'missedPots').count,0);
 m=withRecords([{id:'unknown-foul',kind:'foul',side:0,strokeCount:1}]);assert.equal(metric(m,'pottingSuccess').denominator,null);assert.equal(format(metric(m,'pottingSuccess')),'—');
 m=withRecords([...base,{id:'attack-foul',kind:'foul',side:0,intent:'pot',strokeCount:1}]);assert.equal(metric(m,'pottingSuccess').numerator,1);assert.equal(metric(m,'pottingSuccess').denominator,2);assert.equal(metric(m,'missedPots').count,1);
});
test('deduplication/reference conflicts remain visible and compatibility does not certify completeness',()=>{
 const m=withRecords([pot('same'),pot('same')]),r=metric(m,'pottedBalls');assert.equal(r.count,1);assert.ok(r.reasons.includes('duplicate_record'));assert.equal(r.coverage,'partial');
 const future=withRecords([pot('future',3,{evidenceVersion:99})]);assert.equal(format(metric(future,'pottedBalls')),'—');assert.equal(format(metric(future,'pottingSuccess')),'—');
});
test('known v2 zero/zero remains the approved convention; no implicit fromStart or fabricated racks',()=>{
 const m=withRecords([{id:'safe',kind:'safety',side:0,evidenceVersion:2,intent:'safety',potsEvidence:'not_applicable',pottingAttempts:0,successfulPottingStrokes:0}]);assert.equal(format(metric(m,'pottingSuccess')),'0 / 0');assert.equal(format(metric(m,'pottedBalls')),'0');assert.equal(m.federalEvidence,undefined);assert.equal(metric(m,'ownBreakWins').coverage,'unknown');
});
test('three actual backups: current record differs ONLY by approved link; new reader is immutable', {skip:!process.env.FC_RELINK_BACKUP},()=>{
 const base=path.dirname(process.env.FC_RELINK_BACKUP),files=[path.join(base,'BC_Rybarna_Scoreboard_Backup_2026-10-24 (1).json'),process.env.FC_RELINK_BACKUP,path.join(base,'FC2026-9-'+sample.id+'-BEFORE-1792870706190.json')],buffers=files.map(p=>fs.readFileSync(p)),ds=buffers.map(b=>JSON.parse(b));
 const find=d=>Object.values(d.matches).find(m=>m.id===sample.id),old=find(ds[0]),now=find(ds[1]),saved=ds[2].match;
 assert.equal(canonical(old),canonical(saved));assert.equal(canonical(Object.fromEntries(Object.entries(now).filter(([k])=>k!=='federalCupLink'))),canonical(old));
 const approved=JSON.parse(fs.readFileSync(path.join(root,'docs/federal-fixture-9-link-proposal.json'),'utf8'));assert.equal(canonical(now.federalCupLink),canonical(approved.patch.federalCupLink));
 for(const k of Object.keys(sample))assert.deepEqual(now[k],sample[k],k);const before=canonical(now),r=calc(now);assert.equal(r.sides[0].metrics.pottedBalls.count,48);assert.equal(r.sides[1].metrics.pottingSuccess.denominator,14);assert.equal(canonical(now),before);
 for(const [i,p]of files.entries())assert.equal(crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),crypto.createHash('sha256').update(buffers[i]).digest('hex'));
});

const history=require('./fixtures/federal-linked-doubles-history.json');
const historyRows=m=>copy(c.federalStatsHistoricalRacks(m));
test('real #9 surviving history proves all eight actual breakers and rack winners, immutable after Firebase roundtrip',()=>{
 const before=canonical(history),rows=historyRows(history),r=calc(history);
 assert.deepEqual(rows.map(x=>[x.rack,x.breaker,x.winner]),[[1,1,0],[2,0,1],[3,1,1],[4,0,0],[5,1,0],[6,0,1],[7,1,0],[8,0,0]]);
 for(const [i,w,l]of [[0,2,2],[1,1,3]]){const a=r.sides[i].metrics;assert.equal(a.ownBreakWins.numerator,w);assert.equal(a.ownBreakWins.denominator,4);assert.equal(a.ownBreakLosses.count,l);assert.equal(a.ownBreakWins.coverage,'complete');assert.equal(a.ownBreakWins.components.source,'surviving_history');}
 assert.equal(r.sides[0].metrics.pottedBalls.count,48);assert.equal(r.sides[1].metrics.pottingSuccess.denominator,14);
 assert.equal(canonical(history),before);assert.deepEqual(calc(roundTrip(history)),r);
});
test('canonical rack ledger always wins, even incomplete or conflicting; history is never appended',()=>{
 const m=copy(history);m.federalEvidence={racks:[{id:'canonical',rack:1,breaker:0,winner:0}]};
 assert.deepEqual(historyRows(m),[]);const r=calc(m);assert.equal(r.sides[0].metrics.ownBreakWins.numerator,1);assert.equal(r.sides[0].metrics.ownBreakWins.denominator,1);assert.notEqual(r.sides[0].metrics.ownBreakWins.coverage,'complete');
 m.federalEvidence.racks=[];assert.deepEqual(historyRows(m),[]);
});
test('missing snapshot or break or legal terminal stroke never inferred from final score or pot count',()=>{
 for(const rack of [1,3,8])for(const kind of ['snapshots','break','terminal']){const m=copy(history);
  if(kind==='snapshots')m.events=m.events.filter(e=>!e.meta?.undoSnapshot||JSON.parse(e.meta.undoSnapshot).rackNumber!==rack);
  else m.detailedPlay.records=m.detailedPlay.records.filter(r=>!(r.rack===rack&&(kind==='break'?r.kind==='break':r.balls?.includes(9))));
  assert.deepEqual(historyRows(m),[],rack+kind);assert.equal(calc(m).sides[0].metrics.ownBreakWins.numerator,null);
 }
});
test('returned or conflicting undo branches, duplicate events and backward scores cannot become additional played racks',()=>{
 const variants=[m=>{m.events.push(copy(m.events.find(e=>e.meta?.undoSnapshot)));},m=>{const e=m.events.find(e=>e.meta?.undoSnapshot),s=JSON.parse(e.meta.undoSnapshot);s.breaker=0;e.meta.undoSnapshot=JSON.stringify(s);},m=>{m.events.find(e=>e.text==='Skóre 1:0').text='Skóre 0:1';},m=>{const e=m.events.find(e=>e.meta?.undoSnapshot),s=JSON.parse(e.meta.undoSnapshot);s.detailedPlay.records=[{id:'undone',rack:1,kind:'pot',side:0}];e.meta.undoSnapshot=JSON.stringify(s);}];
 for(const change of variants){const m=copy(history);change(m);assert.deepEqual(historyRows(m),[]);}
});
test('manual corrections, ace/foul terminal changes, malformed snapshots and partial rack service stay unknown',()=>{
 const variants=[m=>{m.events.splice(5,0,{id:'correction',text:'Oprava skóre −1'});},m=>{m.federalEvidence={serviceChanges:[{coverage:{racks:'partial'}}]};},m=>{m.detailedPlay.records.at(-1).kind='foul';},m=>{m.detailedPlay.records.at(-1).foul=true;},m=>{m.detailedPlay.records.at(-1).kind='break';m.detailedPlay.records.at(-1).result='ace';},m=>{m.events.find(e=>e.meta?.undoSnapshot).meta.undoSnapshot='broken';}];
 for(const change of variants){const m=copy(history);change(m);assert.deepEqual(historyRows(m),[]);assert.equal(calc(m).sides[0].metrics.ownBreakWins.numerator,null);}
});
test('actual complete export carries identical surviving history, including all undo snapshots', {skip:!process.env.FC_RELINK_BACKUP},()=>{
 const d=JSON.parse(fs.readFileSync(process.env.FC_RELINK_BACKUP)),m=Object.values(d.matches).find(m=>m.id===history.id);
 assert.deepEqual(m.events,history.events);assert.deepEqual(historyRows(m),historyRows(history));assert.deepEqual(calc(m).sides.map(s=>[s.metrics.ownBreakWins.numerator,s.metrics.ownBreakLosses.count]),[[2,2],[1,3]]);
});
