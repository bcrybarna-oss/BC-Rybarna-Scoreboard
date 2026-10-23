'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const {reference,counters,copy}=require('./fixtures/federal-calculation.cjs');
const html=process.env.FC_PUSH_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.FC_PUSH_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  // Federal Cup calculation contract v1.'),end=html.indexOf('  function detailedCounterActive()',start);
assert.ok(start>0&&end>start);const rackStart=html.indexOf('  function federalRackScoresAgree('),rackEnd=html.indexOf('\n  }',rackStart)+4;
const ctx={};vm.createContext(ctx);vm.runInContext(html.slice(rackStart,rackEnd)+'\n'+html.slice(start,end),ctx);
const calculate=m=>copy(ctx.federalCalculateMatch(copy(m))),season=(ms,c={},y=2026)=>copy(ctx.federalCalculateSeason(copy(ms),copy(c),y));
function metric(m,side,key){return calculate(m).sides[side].metrics[key];}
test('push-out counts are excluded by kind, without converting absent physical counts into zero',()=>{
 for(const info of [{},{balls:[],pottedCount:0},{balls:[2,9],pottedCount:2},{pottedCount:null}]){const m=reference(),r={id:'push',kind:'push_out',side:0,rack:1,evidenceVersion:2,intent:'other',pottingAttempts:0,successfulPottingStrokes:0,potsEvidence:'not_applicable',...info};m.detailedPlay.records.push(r);const x=calculate(m).sides[0].metrics;assert.equal(x.pottedBalls.coverage,'complete');assert.equal(x.pottedBalls.count,7);assert.equal(x.pottingSuccess.numerator,5);assert.equal(x.pottingSuccess.denominator,7);assert.equal(Object.hasOwn(r,'pottedCount'),Object.hasOwn(info,'pottedCount'));const annual=season([m]),baseline=season([reference()]);assert.deepEqual(annual.teams[0].metrics.pottedBalls,baseline.teams[0].metrics.pottedBalls);assert.deepEqual(annual.individuals.a1.metrics.pottedBalls,baseline.individuals.a1.metrics.pottedBalls);}
});
test('unknown foul intent stays partial; selected pot foul adds exactly one failed attempt',()=>{
 for(const intent of ['unknown','pot','safety','other']){const m=reference();m.detailedPlay.records.push({id:'foul-new',kind:'foul',side:0,rack:1,evidenceVersion:2,intent,pottingAttempts:intent==='unknown'?null:intent==='pot'?1:0,successfulPottingStrokes:0,potsEvidence:'not_applicable',ball:5});const x=calculate(m).sides[0].metrics;assert.equal(x.pottedBalls.count,7);assert.equal(x.pottingSuccess.numerator,5);assert.equal(x.pottingSuccess.denominator,intent==='pot'?8:7);assert.equal(x.pottingSuccess.coverage,intent==='unknown'?'partial':'complete');}
});
