'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
function body(name){const m=html.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));assert.ok(m,name);return m[0];}
const race=new Function(['tournamentMatchIsGroupMatch','tournamentRoundContainingMatch','tournamentStageForMatch','tournamentRaceForMatch'].map(body).join('\n')+'\nreturn tournamentRaceForMatch;')();
test('hybrid phase race, round overrides and legacy tournaments use the production resolver',()=>{
 const g={id:'g'},f={id:'f',bracket:'F'},t={format:'groups_sko',raceTo:3,playoffRaceTo:7,groups:[{matches:[g]}]};
 assert.equal(race(t,g),3);assert.equal(race(t,f),7);
 assert.equal(race({...t,variableRaceEnabled:true,raceByStage:{groups:4,final:9}},g),4);
 assert.equal(race({...t,variableRaceEnabled:true,raceByStage:{groups:4,final:9}},f),9);
 assert.equal(race({...t,variableRaceEnabled:true,raceByStage:{final:null}},f),7);
 const old={...t};delete old.playoffRaceTo;assert.equal(race(old,f),3);
 assert.equal(race({...t,format:'groups_dko'},f),7);assert.equal(race({...t,format:'dko'},f),3);
});
test('failed historical storage keeps the current draft, reports volatility and can recover',()=>{
 const warning={textContent:''},draft={seriesId:'s',config:{playerIds:['a','b'],raceTo:3,playoffRaceTo:7},order:['b','a']};let stored='previous',full=true;
 const save=new Function('localStorage','$','historicalBuildDraft',"const historicalDraftKey='draft';let historicalDraftVolatile=false;"+body('historicalDraftStorageStatus')+body('historicalSaveDraft')+'return historicalSaveDraft;')({setItem(k,v){if(full)throw Error('quota');stored=v;}},()=>warning,draft);
 assert.equal(save(),false);assert.equal(stored,'previous');assert.deepEqual(draft.order,['b','a']);assert.match(warning.textContent,/pouze v paměti/);assert.match(warning.textContent,/neobnoví/);
 full=false;assert.equal(save(),true);assert.deepEqual(JSON.parse(stored),draft);assert.equal(warning.textContent,'');
});
test('ordinary phase draft includes configuration and stable player selection, quota failure stays explicit',()=>{
 const controls={tournamentFormat:{value:'groups_dko'},tournamentDiscipline:{value:'8-ball'},tournamentPlayoffDiscipline:{value:'10-ball'},tournamentRace:{value:'3'},tournamentPlayoffRace:{value:'7'},tournamentDraftStorageWarning:{textContent:''}};let saved,full=false;
 const save=new Function('$','localStorage',"const TOURNAMENT_CHECKIN_DRAFT_KEY='ordinary',TOURNAMENT_PHASE_FIELDS=['tournamentFormat','tournamentDiscipline','tournamentPlayoffDiscipline','tournamentRace','tournamentPlayoffRace'];const tournamentSelectedPlayerIds=['a','b'],tournamentGuestDrafts=[],tournamentCheckin={a:{paid:true}},tournamentCheckinClosed=true,tournamentPrizeMoney={},tournamentDrawNumbers={},manualTournamentSeedOrder=['b','a'];const tournamentHandicapEnabled=()=>false;"+body('tournamentPhaseFormSnapshot')+body('saveTournamentCheckinDraft')+'return saveTournamentCheckinDraft;')(id=>controls[id],{setItem(k,v){if(full)throw Error('quota');saved=JSON.parse(v);}});
 save();assert.deepEqual(saved.phaseSetup,{tournamentFormat:'groups_dko',tournamentDiscipline:'8-ball',tournamentPlayoffDiscipline:'10-ball',tournamentRace:'3',tournamentPlayoffRace:'7'});assert.deepEqual(saved.playerIds,['a','b']);assert.deepEqual(saved.manualSeedOrder,['b','a']);full=true;save();assert.match(controls.tournamentDraftStorageWarning.textContent,/pouze v paměti/);assert.equal(saved.phaseSetup.tournamentPlayoffRace,'7');
});
