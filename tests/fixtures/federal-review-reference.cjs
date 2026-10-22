'use strict';
// Independent five-rack review reproduction; hand-checked expectations in regression tests.
const clone=x=>JSON.parse(JSON.stringify(x));
const stats=()=>Object.fromEntries(['breaks','dryBreaks','softBreaks','softDryBreaks','breakFouls','breakPottedBalls','breakPottedTracked','aces','breakAndRun','fouls','safeties','successfulSafeties','trackedSafeties','safetyEscapes','successfulSafetyEscapes','resafes'].map(k=>[k,0]));
function sample(type='team',id='independent'){
 const m={id,status:'complete',endedAt:'2026-10-21T09:00:00Z',scores:[5,0],counterMode:'full',discipline:'9-ball',stats:[stats(),stats()],federalCupLink:{year:2026,fixtureNo:type==='team'?1:type==='doubles'?2:3,type,lineupParticipants:[[{id:'red',name:'Same',year:2026}],[{id:'blue',name:'Blue',year:2026}]]},federalEvidence:{version:1,fromStart:true},detailedPlay:{version:1,coverage:'complete',records:[]}};
 if(type==='doubles'){m.doublesMode=true;m.federalCupLink.lineupParticipants[0].push({id:'red2',name:'Same',year:2026});m.federalCupLink.lineupParticipants[1].push({id:'blue2',name:'Blue2',year:2026});}
 const ledger=[];let seq=0;
 function shot(side,rack,kind,x={}){const r={id:id+'-shot-'+(++seq),side,rack,kind,balls:[],evidenceVersion:2,intent:'other',pottingAttempts:0,successfulPottingStrokes:0,potsEvidence:'not_applicable',...x};m.detailedPlay.records.push(r);return r;}
 const breakers=[0,1,0,1,0],results=['ace','soft_break','break_foul','break_ok','break_ok'],balls=[[9],[],[1,9],[1],[1,2]];
 for(let i=0;i<5;i++){const side=breakers[i],s=[stats(),stats()];s[side].breaks=1;s[side].breakPottedTracked=1;s[side].breakPottedBalls=balls[i].length;
  if(i===0)s[0].aces=1;if(i===1)Object.assign(s[1],{dryBreaks:1,softBreaks:1,softDryBreaks:1});if(i===2)Object.assign(s[0],{fouls:1,breakFouls:1});if(i===4)s[0].breakAndRun=1;
  ledger.push({id:id+'-rack-'+(i+1),matchId:id,year:2026,rack:i+1,breaker:side,winner:0,ace:i===0,breakAndRun:i===4,stats:s});
  shot(side,i+1,'break',{result:results[i],balls:balls[i],ballCount:balls[i].length,foul:i===2});
 }
 const pot=(side,rack,balls,n=1)=>shot(side,rack,'pot',{balls,intent:'pot',pottingAttempts:n,successfulPottingStrokes:n,potsEvidence:'explicit',strokeCount:n,entry:n>1?'sequential_batch':'single'});
 pot(0,2,[1,2],2);shot(0,2,'miss',{intent:'pot',pottingAttempts:1});shot(0,2,'foul',{intent:'pot',pottingAttempts:1});shot(0,2,'foul',{intent:'safety'});
 shot(0,2,'escape',{intent:'escape',success:true,balls:[3],potsEvidence:'explicit'});shot(0,2,'escape',{intent:'escape',success:false,foul:true,potsEvidence:'explicit'});shot(0,2,'escape',{intent:'escape',success:true,potsEvidence:'explicit'});
 for(const success of [true,false,true])shot(0,2,'safety',{intent:'safety',success});
 shot(1,2,'escape',{intent:'escape',success:true,potsEvidence:'explicit'});shot(1,2,'safety',{intent:'safety',success:true});pot(0,2,[4,9]);
 for(let i=0;i<3;i++)shot(1,3,'foul');
 pot(1,4,[2]);shot(1,4,'miss',{intent:'pot',pottingAttempts:1});shot(1,4,'foul',{intent:'safety'});pot(0,4,[3,4,5,6,7,8,9]);pot(0,5,[3,4,5,6,7,8,9]);
 Object.assign(ledger[1].stats[0],{fouls:3,safeties:3,trackedSafeties:3,successfulSafeties:2,safetyEscapes:3,successfulSafetyEscapes:2,resafes:1});Object.assign(ledger[1].stats[1],{safeties:1,trackedSafeties:1,successfulSafeties:1,safetyEscapes:1,successfulSafetyEscapes:1});ledger[2].stats[1].fouls=3;ledger[3].stats[1].fouls=1;
 for(const r of ledger){for(const side of [0,1])for(const [k,n]of Object.entries(r.stats[side]))m.stats[side][k]+=n;r.shotIds=m.detailedPlay.records.filter(x=>x.rack===r.rack).map(x=>x.id);}
 if(type==='team'){m.federalTeam={racks:ledger};for(const r of ledger){const first=[1,2,5].includes(r.rack);r.players=[{id:first?'red':'red2',name:'Same',identityStatus:'stable',year:2026},{id:r.rack%2?'blue':'blue2',name:'Blue',identityStatus:'stable',year:2026}];r.participantIds=r.players.map(p=>[p.id]);for(const x of m.detailedPlay.records.filter(x=>x.rack===r.rack))x.actor=clone(r.players[x.side]);r.shots=clone(m.detailedPlay.records.filter(x=>x.rack===r.rack));}}
 else {m.federalEvidence.racks=ledger;for(const r of m.detailedPlay.records)r.actor=type==='doubles'?null:{...m.federalCupLink.lineupParticipants[r.side][0],identityStatus:'stable'};}
 return m;
}

module.exports={sample,clone,stats};
