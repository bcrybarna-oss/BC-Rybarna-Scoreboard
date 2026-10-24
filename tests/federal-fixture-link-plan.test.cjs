'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {plan,MATCH_ID,SOURCE_SHA256,digest}=require('../scripts/plan-federal-fixture-9-link.cjs');
const fixture=require('./fixtures/federal-fixture-9-link-metadata.json'),copy=x=>JSON.parse(JSON.stringify(x));
test('explicit match ID/time/score and stable nomination, link-only reversible offline proposal',()=>{
 const input=copy(fixture),before=copy(input),p=plan(input);
 assert.deepEqual(input,before);assert.equal(p.proposal.requiresApproval,true);
 assert.deepEqual(p.proposal.rollback,{federalCupLink:null});assert.equal(p.after.id,MATCH_ID);
 assert.equal(p.after.federalCupLink.year,2026);assert.equal(p.after.federalCupLink.fixtureNo,9);assert.equal(p.after.federalCupLink.type,'doubles');
 const unchanged=copy(p.after);delete unchanged.federalCupLink;assert.deepEqual(unchanged,p.before);
 assert.equal(p.after.federalEvidence,undefined,'never invent fromStart/racks to improve coverage');
 assert.deepEqual(p.after.federalCupLink.lineupParticipants.map(ps=>ps.map(p=>p.id)),[input.federalCup2026.lineups[9].a,input.federalCup2026.lineups[9].b]);
});
test('same names alone never allow a different record or changed player IDs',()=>{
 for(const change of [m=>m.id='other',m=>m.startedAt='2026-10-24T15:54:10Z',m=>m.scores=[3,5],m=>m.teamPlayerIds[0].reverse(),m=>m.status='playing']){
  const d=copy(fixture);change(d.matches[0]);assert.throws(()=>plan(d));
 }
});
test('existing/conflicting associations, duplicate IDs/fixture and changed nomination block proposal',()=>{
 for(const change of [d=>d.matches.push(copy(d.matches[0])),d=>d.matches[0].federalCupLink={year:2026,fixtureNo:9},d=>d.matches.push({id:'other',federalCupLink:{year:2026,fixtureNo:9}}),d=>d.federalCup2026.lineups[9].a.reverse(),d=>d.federalCup2026.year=2025,d=>d.matches[0].federalEvidence={fromStart:true},d=>d.deletedMatchIds={[MATCH_ID]:true},d=>d.federalCup2026.rosterParticipantIdsA.pop()]){const d=copy(fixture);change(d);assert.throws(()=>plan(d));}
});
test('actual backup: exact source hash, no duplicate and only link changes selection 6:2 to 7:2', {skip:!process.env.FC_FIXTURE9_BACKUP},()=>{
 const bytes=fs.readFileSync(process.env.FC_FIXTURE9_BACKUP);assert.equal(digest(bytes),SOURCE_SHA256);
 const d=JSON.parse(bytes),original=JSON.stringify(d),p=plan(d),html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
 const a=html.indexOf('  function federalRackScoresAgree('),b=html.indexOf('\n  }',a)+4,c={};vm.createContext(c);vm.runInContext(html.slice(a,b)+html.slice(html.indexOf('  // Federal Cup calculation contract v1.'),html.indexOf('  function detailedCounterActive()')),c);
 const before=copy(c.federalReportData(d.matches,d.federalCup2026,2026)),after=copy(c.federalReportData(d.matches.map(m=>m.id===MATCH_ID?p.after:m),d.federalCup2026,2026));
 assert.deepEqual(before.series,[6,2]);assert.deepEqual(after.series,[7,2]);assert.deepEqual(after.duplicates,[]);
 assert.deepEqual(after.selected.filter(f=>f.fixtureNo===9),[{fixtureNo:9,matchId:MATCH_ID,source:'detailed'}]);
 assert.deepEqual(copy(c.federalCalculateMatch(p.before)).sides.map(s=>s.metrics),copy(c.federalCalculateMatch(p.after)).sides.map(s=>s.metrics),'link repair changes owners/results, never shot statistics');
 assert.equal(JSON.stringify(d),original);assert.equal(digest(fs.readFileSync(process.env.FC_FIXTURE9_BACKUP)),SOURCE_SHA256);
});
