'use strict';
// Offline proposal ONLY. No network, no production executor, never rewrites the input.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const MATCH_ID='3d4c35e6-e336-49d5-a9b3-9955cec59c3d';
const SOURCE_SHA256='0aa18c9b610709025150ef55fd6fd177f1972612d72703635cbdd74e8b52f7eb';
const copy=x=>JSON.parse(JSON.stringify(x)),rows=x=>Object.values(x||{});
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function plan(input){
 const ms=rows(input.matches),found=ms.filter(m=>m.id===MATCH_ID),c=input.federalCup2026;
 if(found.length!==1)throw Error('Expected exactly one target matchId');
 const m=found[0];
 if(Object.hasOwn(input.deletedMatchIds||{},MATCH_ID)||rows(input.deletedMatchIds).includes(MATCH_ID))throw Error('Target has a deletion marker');
 if(m.federalCupLink!=null||m.federalEvidence!=null||m.tournamentLink||m.leagueLink)throw Error('Existing association/evidence: manual review required');
 if(m.startedAt!=='2026-10-24T15:54:09.777Z'||m.endedAt!=='2026-10-24T16:27:05.963Z'||m.status!=='complete'||JSON.stringify(m.scores)!=='[5,3]'||!m.doublesMode||m.discipline!=='9-ball')throw Error('Target identity/state changed');
 if(Number(c?.year)!==2026||ms.some(x=>x!==m&&Number(x.federalCupLink?.year)===2026&&Number(x.federalCupLink?.fixtureNo)===9))throw Error('Wrong season or fixture already associated');
 const ids=[['fc-ef1400d4-fcb4-4926-985e-1e8d2a823f14','fc-b43ebda0-4628-4217-8b5f-cdf1747038e2'],['fc-35818099-c4c1-4e03-8165-4b1bd5f7fe94','fc-d37a2dab-8117-48fd-bd8f-e237f49e9803']];
 const ordinary=[['efbf5977-f3ea-4c43-a2e6-94cef082228e','a94f12a3-4c68-46eb-a2e1-9d99db0e072b'],['df600b07-1899-401c-91bd-962717e3a050','a702701b-157d-4b16-ac04-0bd366e9149e']];
 if(JSON.stringify(m.teamPlayerIds)!==JSON.stringify(ordinary)||JSON.stringify([c.lineups?.[9]?.a,c.lineups?.[9]?.b])!==JSON.stringify(ids))throw Error('Saved player IDs or fixture nomination changed');
 const rosterParticipants=['a','b'].map(side=>rows(c[side==='a'?'rosterParticipantIdsA':'rosterParticipantIdsB']).map(id=>c.participants?.[id]));
 if(rosterParticipants.some((ps,i)=>ps.length!==5||new Set(ps.map(p=>p?.id)).size!==5||ps.some(p=>!p||p.team!==(i?'b':'a')||Number(p.year)!==2026)))throw Error('Invalid roster snapshot');
 const lineupParticipants=ids.map((side,i)=>side.map(id=>{const p=c.participants?.[id];if(!p||p.team!==(i?'b':'a')||Number(p.year)!==2026)throw Error('Invalid nominated identity');return copy(p);}));
 const link={year:2026,fixtureNo:9,block:2,type:'doubles',teamAName:c.teamAName,teamBName:c.teamBName,rosterA:copy(c.rosterA),rosterB:copy(c.rosterB),rosterParticipants:copy(rosterParticipants),lineupParticipants,lineupA:ids[0],lineupB:ids[1]};
 const after={...copy(m),federalCupLink:link};
 return {before:copy(m),after,proposal:{mode:'PROPOSAL_ONLY_NOT_APPLIED',matchId:MATCH_ID,path:'/matches/'+MATCH_ID+'/federalCupLink',beforeMatchSha256:digest(JSON.stringify(m)),afterMatchSha256:digest(JSON.stringify(after)),requiresApproval:true,identityMapping:ordinary.map((side,i)=>side.map((id,j)=>({savedPlayerId:id,federalParticipantId:ids[i][j]}))),patch:{federalCupLink:link},rollback:{federalCupLink:null},warning:'Nomination snapshot comes from supplied backup, not proven launch-time metadata. No rack evidence is reconstructed. Re-read live record and check concurrency/duplicate fixture before any approved write.'}};
}
module.exports={plan,MATCH_ID,SOURCE_SHA256,digest};
if(require.main===module){
 try{const [source,out]=process.argv.slice(2);if(!source||!out)throw Error('Usage: node scripts/plan-federal-fixture-9-link.cjs backup.json NEW-private-output-directory');
  const bytes=fs.readFileSync(source);if(digest(bytes)!==SOURCE_SHA256)throw Error('Source backup hash differs; review a fresh export explicitly');
  const result=plan(JSON.parse(bytes));fs.mkdirSync(path.resolve(out));
  for(const [name,value]of Object.entries({'proposal.json':result.proposal,'before-match.private.json':result.before,'after-match.private.json':result.after}))fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2),{flag:'wx'});
  console.log(JSON.stringify({mode:result.proposal.mode,matchId:MATCH_ID,sourceSha256:digest(bytes),changedFields:['federalCupLink'],productionWrites:0}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
