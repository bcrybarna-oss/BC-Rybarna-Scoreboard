'use strict';
// Offline read-only diagnostic. Outputs an allowlist, never the complete backup or auth state.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function diagnose(input,matchId){
 const rows=x=>Array.isArray(x)?x:Object.values(x||{}),ms=input.federalCupLink?[input]:rows(input.matches);
 const candidates=ms.filter(m=>Number(m.federalCupLink?.year)===2026&&Number(m.federalCupLink?.fixtureNo)===1&&m.federalCupLink?.type==='team');
 const identity=m=>({matchId:m.id,year:m.federalCupLink?.year,fixtureNo:m.federalCupLink?.fixtureNo,type:m.federalCupLink?.type,scores:m.scores,startedAt:m.startedAt,endedAt:m.endedAt,status:m.status});
 if(!matchId)return {mode:'candidates_only',note:'Verify identity and timestamps; no newest-match assumption. Pass an exact matchId to calculate.',candidates:candidates.map(identity)};
 const found=ms.filter(m=>m.id===matchId);if(found.length!==1)throw Error('Exact matchId must select exactly one saved record');const m=found[0];
 if(!candidates.includes(m))throw Error('Expected Federal Cup 2026 fixture #1 Team');
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),a=html.indexOf('  function federalRackScoresAgree('),b=html.indexOf('\n  }',a)+4;
 const ctx={fetch(){throw Error('Network disabled');},localStorage:{setItem(){throw Error('Writes disabled');}}};vm.createContext(ctx);
 vm.runInContext(html.slice(a,b)+html.slice(html.indexOf('  // Federal Cup calculation contract v1.'),html.indexOf('  function detailedCounterActive()')),ctx);
 const calculated=ctx.federalCalculateMatch(m),racks=rows(m.federalTeam?.racks),records=rows(m.detailedPlay?.records),ids=records.map(r=>r.id);
 return {mode:'saved_record',identity:identity(m),tableKnown:m.detailedPlay?.tableKnown,coverage:m.detailedPlay?.coverage,
  sides:calculated.sides.map((s,side)=>({side,pottingSuccess:s.metrics.pottingSuccess,pottedBalls:s.metrics.pottedBalls,referenceIssues:ctx.federalStatsShotIssues(m,side)})),
  unattributed:calculated.unattributed,
  records:records.map(r=>({id:r.id,rack:r.rack,side:r.side,actorId:r.actor?.id,kind:r.kind,source:r.source,entry:r.entry,intent:r.intent,potsEvidence:r.potsEvidence,pottingAttempts:r.pottingAttempts,successfulPottingStrokes:r.successfulPottingStrokes,strokeCount:r.strokeCount,ballNumbersKnown:r.ballNumbersKnown,balls:r.balls,pottedCount:r.pottedCount,derivationSafe:r.derivationSafe,foulId:r.foulId,safetyId:r.safetyId,
   expectedRackActorIds:racks.filter(k=>k.rack===r.rack).map(k=>k.players?.[r.side]?.id).filter(Boolean),linkedReferences:['safetyId','foulId'].filter(k=>r[k]).map(k=>({kind:k,id:r[k],exists:ids.includes(r[k])})),rackReferences:racks.filter(k=>rows(k.shotIds).includes(r.id)).map(k=>k.rack)})),
  missingReferences:racks.flatMap(k=>rows(k.shotIds).filter(id=>!ids.includes(id)).map(id=>({rack:k.rack,shotId:id}))) };
}
module.exports={diagnose};
if(require.main===module){try{if(!process.argv[2])throw Error('Usage: node scripts/diagnose-federal-evidence.cjs backup.json [exact-matchId]');let input;try{input=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));}catch{throw Error('Cannot read or parse the JSON input; no input content printed');}console.log(JSON.stringify(diagnose(input,process.argv[3]),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
