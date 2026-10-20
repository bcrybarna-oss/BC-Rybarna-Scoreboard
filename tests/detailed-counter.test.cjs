'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
function fn(name){const start=html.indexOf('  function '+name+'(');assert.ok(start>=0,name);return html.slice(start,html.indexOf('\n  }',start)+4);}
const clone=x=>JSON.parse(JSON.stringify(x));
function harness(){
 let id=0;
 const ctx={match:{counterMode:'full',discipline:'9-ball',rackNumber:1,turn:0,playerIds:['a','b'],playerNames:['A','B'],stats:[{},{}],rackRemainingBalls:[1,2,3,4,5,6,7,8,9]},
   detailedAction:null,uid:()=>String(++id),cloneForUndo:clone,matchEvidenceMode:f=>f.evidenceMode,logEvent(){},toast(){},$(){return {classList:{toggle(){}},setAttribute(){}}}};
 vm.createContext(ctx);vm.runInContext(['exactBallTrackingDiscipline','detailedCounterActive','ensureDetailedPlay','detailedActor','recordDetailedShot','recordDetailedSafety','resolveDetailedEscape','rotationInference','applyRotationInference','applyFoulPocketedBalls','detailedRatio','aggregateDetailedTags','detailedShotSummary'].map(fn).join('\n'),ctx);
 ctx.ensureDetailedPlay(true);return ctx;
}
test('inferred pots leave break ball ownership intact and never consume a shot tag',()=>{
 const h=harness();h.recordDetailedShot('break',{balls:[1],side:0});h.match.rackRemainingBalls.shift();h.match.detailedPlay.tag={type:'bank',side:0,rack:1};
 h.applyRotationInference(5);h.recordDetailedShot('miss',{ball:5,strokeCount:1});
 assert.deepEqual(clone(h.match.rackRemainingBalls),[5,6,7,8,9]);
 const records=h.match.detailedPlay.records;assert.deepEqual(clone(records[1].balls),[2,3,4]);assert.equal(records[1].tag,undefined);assert.equal(records[1].strokeCount,null);
 assert.equal(records[2].tag.success,false);assert.equal(h.match.stats[0].bankShotAttempts,1);
 assert.equal(h.detailedShotSummary(h.match,0).regularPots,3);assert.equal(h.detailedShotSummary(h.match,0).breakPots,1);
});
test('known missing balls never get credited again in a later inning',()=>{
 const h=harness();h.match.rackRemainingBalls=[4,5,6,7,8,9];h.match.turn=1;h.ensureDetailedPlay();h.applyRotationInference(6);
 assert.deepEqual(clone(h.match.detailedPlay.records[0].balls),[4,5]);assert.equal(h.match.detailedPlay.records[0].side,1);
});
test('unknown resumed history, newly spotted ball and manual correction cannot imply past pots',()=>{
 const h=harness();delete h.match.detailedPlay;h.ensureDetailedPlay();assert.equal(h.rotationInference(5),null);
 h.ensureDetailedPlay(true);h.match.detailedPlay.inning.startBalls=[3,4,5,6,7,8,9];assert.equal(h.rotationInference(5),null);
 h.match.detailedPlay.inning.safeInference=false;assert.equal(h.applyRotationInference(5),false);assert.equal(h.match.detailedPlay.records.length,0);
});
test('foul pots stay separate and the game ball is spotted in both rotation disciplines',()=>{
 for(const discipline of ['9-ball','10-ball']){const h=harness();h.match.discipline=discipline;if(discipline==='10-ball')h.match.rackRemainingBalls.push(10);const game=discipline==='9-ball'?9:10;h.applyFoulPocketedBalls([2,game]);h.recordDetailedShot('foul',{foulBalls:[2,game]});assert.ok(h.match.rackRemainingBalls.includes(game));assert.ok(!h.match.rackRemainingBalls.includes(2));const s=h.detailedShotSummary(h.match,0);assert.equal(s.regularPots,0);assert.equal(s.foulPots,2);assert.equal(s.misses,0);}
});
test('safeties and reactions have stable links, including a RESAFE chain',()=>{
 const h=harness();h.recordDetailedSafety(true);const first=h.match.detailedPlay.pendingSafety.id;h.match.turn=1;h.resolveDetailedEscape(true);assert.equal(h.match.detailedPlay.records[1].safetyId,first);h.recordDetailedSafety(true);const second=h.match.detailedPlay.pendingSafety.id;h.match.turn=0;h.resolveDetailedEscape(false,true);
 assert.equal(h.match.detailedPlay.records[3].safetyId,second);assert.equal(h.match.detailedPlay.pendingSafety,null);
 const s=h.detailedShotSummary(h.match,0);assert.equal(s.successfulEscapes+s.failedEscapes,s.escapes);
});
test('Team actor is a frozen per-rack selection; Doubles has no invented individual',()=>{
 const h=harness();h.match.federalTeam={players:[{id:'sk2',name:'SK2',team:0},{id:'cz4',name:'CZ4',team:1}]};h.recordDetailedShot('pot',{balls:[2]});h.match.federalTeam.players[0].name='SK3';assert.equal(h.match.detailedPlay.records[0].actor.name,'SK2');delete h.match.federalTeam;h.match.doublesMode=true;h.recordDetailedShot('miss',{ball:3});assert.equal(h.match.detailedPlay.records[1].actor,null);assert.equal(h.match.detailedPlay.records[1].sideId,'a');
});
test('new ratios distinguish missing evidence from an observed zero',()=>{
 const h=harness();assert.equal(h.detailedRatio({},'jump'),'—');assert.equal(h.detailedRatio({jumpShotAttempts:0},'jump'),'0/0');assert.equal(h.detailedShotSummary({},0),null);
});
test('simple, Ghost and 14.1 do not create the shared rotation record model',()=>{
 for(const field of [{counterMode:'simple'},{ghostMode:true},{discipline:'14.1'}]){const h=harness();delete h.match.detailedPlay;Object.assign(h.match,field);assert.equal(h.ensureDetailedPlay(),null);assert.equal(h.recordDetailedShot('pot',{balls:[1]}),null);assert.equal(h.match.detailedPlay,undefined);}
});
test('Firebase omission of empty arrays/nulls does not break resumed records or summaries',()=>{
 const h=harness();h.match.detailedPlay={version:1,coverage:'complete',nextInning:0};h.ensureDetailedPlay();h.recordDetailedShot('escape',{success:true});
 delete h.match.detailedPlay.records[0].balls;assert.equal(h.detailedShotSummary(h.match,0).regularPots,0);
 h.match.detailedPlay.records={'0':h.match.detailedPlay.records[0]};h.ensureDetailedPlay();h.recordDetailedShot('miss',{ball:2});assert.equal(h.match.detailedPlay.records.length,2);
});
test('aggregate jump/bank ratios retain unknown historical coverage instead of counting it as zero',()=>{
 const h=harness(),old={evidenceMode:'full',playerIds:['a','b'],stats:[{},{}]},current={...old,stats:[{jumpShotAttempts:3,jumpShotSuccessful:1,bankShotAttempts:0},{}]};
 assert.equal(h.detailedRatio(h.aggregateDetailedTags([old],'a'),'jump'),'—');
 assert.equal(h.detailedRatio(h.aggregateDetailedTags([current],'a'),'jump'),'1/3');
 assert.equal(h.detailedRatio(h.aggregateDetailedTags([old,current],'a'),'jump'),'1/3 (část)');
 assert.equal(h.detailedRatio(h.aggregateDetailedTags([current],'a'),'bank'),'0/0');
});
