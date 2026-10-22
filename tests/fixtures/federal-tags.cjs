'use strict';
const {reference,copy}=require('./federal-calculation.cjs');
function taggedReference(type='singles',id='tagged',variant=0){
 const m=reference(type,id),racks=m.federalTeam?.racks||m.federalEvidence.racks;
 if(variant)m.federalCupLink.fixtureNo=6;
 const keys=['jumpShotAttempts','jumpShotSuccessful','bankShotAttempts','bankShotSuccessful'];
 for(const st of m.stats)for(const k of keys)st[k]=0;for(const rack of racks)for(const st of rack.stats)for(const k of keys)st[k]=0;
 const rows=m.detailedPlay.records.filter(r=>r.side===0),pots=rows.filter(r=>r.kind==='pot'),miss=rows.find(r=>r.kind==='miss'),fouls=rows.filter(r=>r.kind==='foul'),escapes=rows.filter(r=>r.kind==='escape');
 const mark=(r,type,success)=>{r.tag={type,success};r.strokeCount=1;};
 if(!variant){mark(pots[0],'jump',true);mark(miss,'jump',false);mark(escapes.find(r=>r.success),'jump',true);mark(pots[1],'bank',true);mark(fouls[0],'bank',false);mark(fouls[1],'bank',false);}
 else{mark(escapes.find(r=>r.success),'jump',true);mark(escapes.find(r=>!r.success),'jump',false);mark(pots[0],'bank',true);mark(pots[1],'bank',true);mark(miss,'bank',false);mark(fouls[0],'bank',false);}
 const other=m.detailedPlay.records.filter(r=>r.side===1);mark(other.find(r=>r.kind==='pot'),'bank',true);const misses=other.filter(r=>r.kind==='miss');mark(misses[0],'bank',false);mark(misses[1],'jump',false);
 for(const rack of racks){rack.shotIds=m.detailedPlay.records.filter(r=>r.rack===rack.rack).map(r=>r.id);for(const r of m.detailedPlay.records.filter(r=>r.rack===rack.rack)){
  if(type==='singles')r.actor={...m.federalCupLink.lineupParticipants[r.side][0],identityStatus:'stable'};
  if(r.tag){const p=r.tag.type+'Shot';for(const st of [m.stats[r.side],rack.stats[r.side]]){st[p+'Attempts']++;if(r.tag.success)st[p+'Successful']++;}}
 }if(type==='team')rack.shots=copy(m.detailedPlay.records.filter(r=>r.rack===rack.rack));}
 return m;
}
module.exports={taggedReference};