'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const {firebaseJsonRoundtrip}=require('./fixtures/firebase-json-roundtrip.cjs');
const html=process.env.FC_ZERO_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.FC_ZERO_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
function fn(name){const a=html.indexOf('  function '+name+'(');assert.ok(a>=0,name);return html.slice(a,html.indexOf('\n  }',a)+4);}
function harness(){const ctx={match:{counterMode:'full',discipline:'9-ball',rackNumber:1,turn:1,playerIds:['a','b'],playerNames:['A','B'],stats:[{},{}],federalCupLink:{lineupParticipants:[[{id:'a'}],[{id:'b'}]]},rackRemainingBalls:[1,2,3,4,5,6,7,8,9]},uid:()=>Math.random().toString(36),cloneForUndo:copy};vm.createContext(ctx);vm.runInContext('let detailedAction=null;'+['detailedCounterActive','ensureDetailedPlay','detailedActor','federalShotEvidence','recordDetailedShot','knownQuickRackBalls','recordQuickRackCompletion'].map(fn).join('\n'),ctx);ctx.ensureDetailedPlay(true);return ctx;}

test('new explicit zero and positive pot evidence survives JSON and empty-array-dropping cloud format',()=>{
 for(const kind of ['escape','pot','break'])for(const balls of [[],[2]]){
  const h=harness(),r=h.recordDetailedShot(kind,{balls,strokeCount:1});assert.equal(r.pottedCount,balls.length);
  const saved=firebaseJsonRoundtrip(r);assert.equal(saved.pottedCount,balls.length);if(!balls.length)assert.equal(Object.hasOwn(saved,'balls'),false);
 }
});
test('missing, explicit unknown and inferred unknown counts never acquire fabricated zero',()=>{
 const h=harness();for(const [kind,info]of [['escape',{}],['escape',{balls:[],pottedCount:null}],['inferred_pots',{balls:[],derivationSafe:false}],['push_out',{}],['table_correction',{}],['break',{balls:[],ballNumbersKnown:false,ballCount:1}]]){
  const r=h.recordDetailedShot(kind,info);assert.equal(r.pottedCount==null,true);assert.equal(firebaseJsonRoundtrip(r).pottedCount,undefined);
 }
});

test('only explicitly classified safe MISS inference adds one attempt/success per derived ball',()=>{
 const h=harness(),r=h.recordDetailedShot('inferred_pots',{balls:[6],strokeCount:1,intent:'pot',entry:'sequential_inference',source:'inning_end',derivationSafe:true,pottedCount:1});
 assert.equal(r.pottingAttempts,1);assert.equal(r.successfulPottingStrokes,1);assert.equal(r.potsEvidence,'derived');assert.equal(firebaseJsonRoundtrip(r).pottedCount,1);
 for(const info of [{balls:[6],strokeCount:null,source:'inning_end',derivationSafe:true},{balls:[6],strokeCount:null,source:'inning_end',derivationSafe:false},{balls:[],strokeCount:null,source:'rack_completion_unknown',derivationSafe:false}]){
  const u=h.recordDetailedShot('inferred_pots',info);assert.equal(u.successfulPottingStrokes==null||u.successfulPottingStrokes===0,true);assert.notEqual(u.entry,'sequential_inference');
 }
});

test('MISS on 7 infers 6 once, while foul/unsafe/unknown table do not acquire the MISS convention',()=>{
 function tracked(){const h=harness();h.logEvent=()=>{};h.exactBallTrackingDiscipline=()=>true;vm.runInContext(fn('rotationInference')+'\n'+fn('applyRotationInference'),h);h.match.rackRemainingBalls=[6,7,8,9];return h;}
 const h=tracked();h.applyRotationInference(7,'miss');h.applyRotationInference(7,'miss');assert.equal(h.match.detailedPlay.records.length,1);assert.equal(h.match.stats[1].regularPottedBalls,1);assert.equal(h.match.detailedPlay.records[0].pottingAttempts,1);assert.equal(h.match.detailedPlay.records[0].successfulPottingStrokes,1);
 const f=tracked();f.applyRotationInference(7,'foul');assert.equal(f.match.detailedPlay.records[0].pottingAttempts,null);assert.equal(f.match.detailedPlay.records[0].entry,undefined);
 const u=tracked();u.match.detailedPlay.inning.safeInference=false;assert.equal(u.applyRotationInference(7,'miss'),false);assert.equal(u.match.detailedPlay.records.length,0);
 const unknown=tracked();unknown.match.detailedPlay.tableKnown=false;unknown.applyRotationInference(7,'miss');assert.equal(unknown.match.detailedPlay.records[0].pottingAttempts,null);
});
