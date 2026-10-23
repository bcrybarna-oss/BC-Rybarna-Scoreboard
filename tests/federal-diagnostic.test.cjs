'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{diagnose}=require('../scripts/diagnose-federal-evidence.cjs'),{sample}=require('./fixtures/federal-review-reference.cjs');
test('diagnostic requires exact identity, reports only allowlisted fields, does not mutate or leak backup auth',()=>{
 const m=sample();m.id='new-team';m.scores=[1,5];const input={matches:[m],token:'DO_NOT_OUTPUT_SECRET',email:'PRIVATE_EMAIL'},before=JSON.stringify(input);
 const list=diagnose(input);assert.equal(list.mode,'candidates_only');assert.equal(list.candidates[0].matchId,'new-team');
 const r=diagnose(input,'new-team');assert.equal(r.identity.type,'team');assert.ok(r.sides[1].pottingSuccess.components);assert.ok(r.records.length);assert.doesNotMatch(JSON.stringify(r),/DO_NOT_OUTPUT_SECRET|PRIVATE_EMAIL/);assert.equal(JSON.stringify(input),before);assert.throws(()=>diagnose(input,'missing'),/exactly one/);
});
