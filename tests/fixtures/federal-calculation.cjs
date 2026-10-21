'use strict';
const copy=x=>JSON.parse(JSON.stringify(x));
function counters(){return {breaks:0,dryBreaks:0,softBreaks:0,softDryBreaks:0,breakFouls:0,breakPottedBalls:0,breakPottedTracked:0,aces:0,breakAndRun:0,fouls:0,safeties:0,successfulSafeties:0,trackedSafeties:0,safetyEscapes:0,successfulSafetyEscapes:0,resafes:0};}
function reference(type='singles',id='reference'){
 const m={id,endedAt:'2026-10-21T10:00:00Z',status:'complete',scores:[3,5],stats:[counters(),counters()],playerIds:['a1','b1'],playerNames:['Anna','Boris'],federalCupLink:{year:2026,fixtureNo:type==='team'?1:type==='doubles'?2:3,type,lineupParticipants:[[{id:'a1',name:'Anna',year:2026}],[{id:'b1',name:'Boris',year:2026}]]},federalEvidence:{version:1,fromStart:true,racks:[]},detailedPlay:{version:1,coverage:'complete',records:[]}};
 let seq=0;const add=(side,rack,kind,extra={})=>{const r={id:id+':shot:'+(++seq),side,rack,kind,evidenceVersion:2,balls:[],intent:'other',pottingAttempts:0,successfulPottingStrokes:0,potsEvidence:'not_applicable',...extra};m.detailedPlay.records.push(r);return r;};
 const breakers=[0,1,0,1,0,1,0,1],winners=[0,1,1,1,0,0,1,1],results=['ace','dry_break','break_ok','soft_break','soft_break','break_foul','break_foul','break_ok'],balls=[[9],[],[1,2],[1,2],[],[1],[3],[1]];
 for(let i=0;i<8;i++){
  const side=breakers[i],rs=[counters(),counters()],s=rs[side],result=results[i];s.breaks=1;s.breakPottedTracked=1;s.breakPottedBalls=balls[i].length;
  if(result==='dry_break'||result==='soft_break'&&!balls[i].length)s.dryBreaks=1;
  if(result==='soft_break'){s.softBreaks=1;if(!balls[i].length)s.softDryBreaks=1;}
  if(result==='break_foul'){s.breakFouls=1;s.fouls=1;}
  if(i===0)s.aces=1;if(i===4||i===7)s.breakAndRun=1;
  const r=add(side,i+1,'break',{result,balls:balls[i],ballCount:balls[i].length,foul:result==='break_foul'});
  m.federalEvidence.racks.push({id:id+':rack:'+(i+1),rack:i+1,breaker:side,winner:winners[i],ace:i===0,breakAndRun:i===4||i===7,stats:rs,shotIds:[r.id]});
 }
 const pot=(side,rack,balls,attempts=1)=>add(side,rack,'pot',{balls,intent:'pot',strokeCount:attempts===1?1:balls.length,entry:attempts===1?'single':'sequential_batch',pottingAttempts:attempts,successfulPottingStrokes:attempts,potsEvidence:'explicit'});
 pot(0,3,[3,9]);pot(0,3,[9]);pot(0,3,[4,5,6],3);add(0,3,'miss',{intent:'pot',pottingAttempts:1});add(0,3,'foul',{intent:'pot',pottingAttempts:1});add(0,3,'foul',{intent:'safety'});
 add(0,3,'escape',{intent:'escape',success:false,foul:true,potsEvidence:'explicit'});add(0,3,'escape',{intent:'escape',success:true,balls:[7],potsEvidence:'explicit'});add(0,3,'escape',{intent:'escape',success:true,potsEvidence:'explicit',safetyId:'resafe-origin'});
 add(0,3,'safety',{intent:'safety',success:true});add(0,3,'safety',{intent:'safety',success:false});add(0,3,'safety',{intent:'safety',success:true});
 pot(1,2,[2]);add(1,2,'miss',{intent:'pot',pottingAttempts:1});add(1,2,'miss',{intent:'pot',pottingAttempts:1});add(1,2,'foul');add(1,2,'safety',{intent:'safety',success:false});add(1,2,'escape',{intent:'escape',success:false,potsEvidence:'explicit'});
 Object.assign(m.federalEvidence.racks[2].stats[0],{fouls:3,safeties:3,trackedSafeties:3,successfulSafeties:2,safetyEscapes:3,successfulSafetyEscapes:2,resafes:1});
 Object.assign(m.federalEvidence.racks[1].stats[1],{fouls:1,safeties:1,trackedSafeties:1,safetyEscapes:1});
 for(const rack of m.federalEvidence.racks)for(const side of [0,1])for(const [k,v]of Object.entries(rack.stats[side]))m.stats[side][k]+=v;
 if(type==='doubles'){m.doublesMode=true;m.federalCupLink.lineupParticipants[0].push({id:'a2',name:'Alena',year:2026});m.federalCupLink.lineupParticipants[1].push({id:'b2',name:'Bedřich',year:2026});}
 if(type==='team'){
  m.federalTeam={racks:m.federalEvidence.racks};delete m.federalEvidence.racks;
  for(const rack of m.federalTeam.racks){const slot=[1,5].includes(rack.rack)?1:2;rack.players=[{id:'a'+slot,name:'A'+slot,identityStatus:'stable'},{id:'b'+slot,name:'B'+slot,identityStatus:'stable'}];rack.participantIds=rack.players.map(p=>[p.id]);for(const r of m.detailedPlay.records.filter(r=>r.rack===rack.rack))r.actor=copy(rack.players[r.side]);rack.shots=copy(m.detailedPlay.records.filter(r=>r.rack===rack.rack));}
 }
 return m;
}
module.exports={reference,counters,copy};
