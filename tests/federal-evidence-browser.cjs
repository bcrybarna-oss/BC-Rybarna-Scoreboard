'use strict';
// Exercises the CURRENT index.html. All network traffic is intercepted;
// Firebase REST calls use an in-memory mock, never the production service.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const breakCase=require('./fixtures/federal-team-breaker-correction.json');
const original=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const hook=`
window.fcTest={
  get match(){return match},get data(){return data},
  get clockRunning(){return timerRunning},
  soft(){actionSoftBreak();pendingBreakBalls=[1];finishExactBreakBalls();},
  breakStats,
  evidence:federalEvidenceSummary,ensureParticipants:ensureFederalParticipants,participant:federalParticipantSnapshot,recordRack:recordFederalRack,
  load:loadSecureMatches,login:cloudLoginFromModal,logout:logoutFromApp,backup:saveActiveMatchCloudBackupNow,
  summary:detailedShotSummary,
  exactBreak(balls){actionBreakOk();pendingBreakBalls=balls;finishExactBreakBalls();},
  chooseShot(balls){pendingShotBallSelection=balls;finishShotBallSelection();},
  get detail(){return match.detailedPlay},
  simple(){match.counterMode='simple';renderMatch();},
  legacy(){delete match.detailedPlay;for(const st of match.stats){delete st.jumpShotAttempts;delete st.bankShotAttempts;}renderMatch();},

  start:startMatch,undo,beginRack,snapshot,restoreSnapshot,
  save:autosaveCurrent,
  admin(){cloudAuthenticated=true;cloudUid='isolated-admin';cloudEmailVerified=true;currentUserRole='system_admin';cloudIdToken='mock-token';cloudTokenExpiresAt=Date.now()+3600000;$('cloudLoginModal').classList.remove('show');},
  reset(){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);match=null;data=defaultData();pendingFederalCupLink=null;pendingTournamentLink=null;pendingLeagueLink=null;
    document.querySelectorAll('.modal.show').forEach(el=>el.classList.remove('show'));
    for(const key of [LOCAL_ACTIVE_MATCH_KEY,LOCAL_ACTIVE_MATCHES_KEY,LOCAL_ACTIVE_MATCH_RECOVERY_KEY])localStorage.removeItem(key);
    data.federalCup2026.rosterMode='manual';data.federalCup2026.rosterA=['SK1','SK2','SK3','SK4','SK5'];data.federalCup2026.rosterB=['CZ1','CZ2','CZ3','CZ4','CZ5'];},
  setMatch(m){match=m},
  finish(){finishMatch(0)},
  async resume(){const m=loadDeviceActiveMatch();if(m)await resumeLocalMatch(m.id);return m;},
  showStats(){openMatchStatsCard(match,false)},
  persist:persistFinishedMatch,
  screen:showScreen,
  render:renderMatch,
};
`;
const html=original.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.fcTest='));
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.FC_BROWSER_CHANNEL||'chrome'});
 const context=await browser.newContext({serviceWorkers:'block'});
 let external=0;const mock={};const writes=[];
 await context.route('**/*',async route=>{
   const request=route.request(),url=request.url();
   if(url==='http://fc-isolated.local/')return route.fulfill({contentType:'text/html',body:html});
   external++;
   if(url.includes('identitytoolkit.googleapis.com'))return route.fulfill({contentType:'application/json',body:JSON.stringify(url.includes('accounts:lookup')?{users:[{localId:'isolated-admin',email:'bcrybarna@gmail.com',emailVerified:true}]}:{localId:'isolated-admin',email:'bcrybarna@gmail.com',idToken:'mock-token',refreshToken:'mock-refresh',expiresIn:'3600'})});
   if(url.includes('securetoken.googleapis.com'))return route.fulfill({contentType:'application/json',body:JSON.stringify({user_id:'isolated-admin',id_token:'mock-token',refresh_token:'mock-refresh',expires_in:'3600'})});
   if(url.includes('.json')){
     const key=new URL(url).pathname;
     const parts=key.replace(/\.json$/,'').split('/').filter(Boolean);let parent=mock;
     for(const part of parts.slice(0,-1))parent=parent[part]??=( {} );
     const leaf=parts.at(-1);
     if(['PUT','PATCH'].includes(request.method())){const value=request.postDataJSON();writes.push({key,value});parent[leaf]=request.method()==='PATCH'?{...parent[leaf],...value}:value;}
     if(request.method()==='DELETE')delete parent[leaf];
     return route.fulfill({contentType:'application/json',body:JSON.stringify(parent[leaf]??null)});
   }
   return route.abort();
 });
 const page=await context.newPage();const errors=[];
 page.setDefaultTimeout(5000);
 if(process.env.FC_DEBUG)page.on('console',msg=>console.log(msg.type(),msg.text()));
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.dismiss());
 await page.goto('http://fc-isolated.local/');
 await page.waitForFunction(()=>!!window.fcTest);
 await page.waitForSelector('#cloudLoginModal.show');
 async function run(fn,arg){return page.evaluate(fn,arg)}
 async function setup(n=1){await run(n=>{fcTest.admin();fcTest.reset();
   if(n!==1)fcTest.data.federalCup2026.lineups[n]=n===2?{a:['SK1','SK2'],b:['CZ1','CZ2']}:{a:['SK3'],b:['CZ3']};
   fc26StartFixture(n);document.getElementById('fc26LagWinner').value='0';document.getElementById('useLag').checked=false;fcTest.start();},n);}
 async function state(){return run(()=>JSON.parse(JSON.stringify(fcTest.match)))}
 async function select(a='SK2',b='CZ4'){
   await page.locator('#fc26RackPlayers select').nth(0).selectOption(a);
   await page.locator('#fc26RackPlayers select').nth(1).selectOption(b);
   await page.locator('#fc26RackPlayers button').click();
 }

 try{
  const records=(m,kind)=>m.detailedPlay.records.filter(r=>r.kind===kind);
  async function base(n=3){await setup(n);await run(()=>fcTest.exactBreak([1]));}
  async function foul(intent){await run(intent=>{actionFoul();selectRotationFailureBall(2);document.getElementById('rotationFoulIntent').value=intent;confirmRotationFailure();},intent);}
  // Real roster editor: rename keeps ID, move buttons carry identity, replacement does not.
  await setup(3);const original=await state();const firstId=original.playerIds[0];
  await run(()=>{fcTest.screen('federal-cup-editor');});
  await page.locator('#fc26APlayer2').fill('Přejmenovaný');await page.locator('#fc26SaveSettings').click();
  await run(()=>{fcTest.data.federalCup2026.lineups[6]={a:[fcTest.data.federalCup2026.rosterParticipantIdsA[2]],b:['CZ1']};fc26StartFixture(6);document.getElementById('fc26LagWinner').value='0';fcTest.start();});
  let m=await state();assert.equal(m.playerIds[0],firstId);assert.equal(m.playerNames[0],'Přejmenovaný');assert.equal(original.playerNames[0],'SK3');
  await run(()=>fcTest.screen('federal-cup-editor'));
  await page.locator('#fc26APlayer2').locator('..').locator('[data-fc-move="-1"]').click();await page.locator('#fc26SaveSettings').click();
  assert.equal(await run(()=>fcTest.data.federalCup2026.rosterParticipantIdsA[1]),firstId);
  await page.locator('#fc26APlayer0').fill('Přejmenovaný');await page.locator('#fc26SaveSettings').click();
  const ids=await run(()=>fcTest.data.federalCup2026.rosterParticipantIdsA);assert.notEqual(ids[0],ids[1]);
  await run(()=>{const c=fcTest.data.federalCup2026;c.lineups[8]={a:[c.rosterParticipantIdsA[0]],b:['CZ1']};fc26StartFixture(8);document.getElementById('fc26LagWinner').value='0';fcTest.start();});
  assert.equal((await state()).playerIds[0],ids[0]);
  await run(()=>{const c=fcTest.data.federalCup2026;c.lineups[2]={a:[c.rosterParticipantIdsA[0],c.rosterParticipantIdsA[1]],b:['CZ1','CZ2']};fc26StartFixture(2);document.getElementById('fc26LagWinner').value='0';fcTest.start();});
  assert.equal((await state()).doublesMode,true);assert.deepEqual((await state()).teamPlayerIds[0],[ids[0],ids[1]]);
  await run(()=>fcTest.screen('federal-cup-editor'));await page.locator('#fc26APlayer0').locator('..').locator('[data-fc-new]').click();await page.locator('#fc26APlayer0').fill('Přejmenovaný');await page.locator('#fc26SaveSettings').click();assert.notEqual(await run(()=>fcTest.data.federalCup2026.rosterParticipantIdsA[0]),ids[0]);
  console.log('PASS stable identities: real rename, reorder, duplicate names, replacement, frozen historical name and lineup IDs');
  await base();await run(()=>{actionLegal();fcTest.chooseShot([2]);});m=await state();assert.equal(records(m,'pot')[0].pottingAttempts,1);assert.equal(records(m,'pot')[0].successfulPottingStrokes,1);
  await run(()=>fcTest.undo());assert.equal(records(await state(),'pot').length,0);
  await run(()=>{actionLegal();fcTest.chooseShot([2,3]);document.getElementById('shotSequenceTogetherBtn').click();document.getElementById('higherBallComboBtn').click();});m=await state();assert.equal(records(m,'pot')[0].pottingAttempts,1);assert.equal(records(m,'pot')[0].balls.length,2);
  await base();await run(()=>{actionLegal();fcTest.chooseShot([2,3]);document.getElementById('shotSequenceSequentialBtn').click();});m=await state();assert.equal(records(m,'pot')[0].pottingAttempts,2);assert.equal(records(m,'pot')[0].strokeCount,2);
  await base();await run(()=>{actionLegal();fcTest.chooseShot([2]);actionLegal();fcTest.chooseShot([9]);document.getElementById('higherBallComboBtn').click();});m=await state();assert.deepEqual(records(m,'pot')[1].balls,[9]);assert.equal(m.federalEvidence.racks[0].winner,0);assert.equal(m.federalEvidence.racks[0].breaker,0);assert.equal(m.federalEvidence.racks[0].breakAndRun,true);
  console.log('PASS explicit single/multipot/3→9 combination vs confirmed sequential strokes, rack B&R and individual undo');
  for(const intent of ['pot','safety','other','unknown']){await base();await foul(intent);m=await state();const f=records(m,'foul')[0];assert.equal(f.intent,intent);assert.equal(f.pottingAttempts,intent==='pot'?1:intent==='unknown'?null:0);assert.equal(f.successfulPottingStrokes,0);assert.equal(m.stats[0].fouls,1);}
  await base();await run(()=>{actionMiss();selectRotationFailureBall(2);confirmRotationFailure();});assert.equal(records(await state(),'miss')[0].pottingAttempts,1);
  await base();await run(()=>{actionSafe();document.getElementById('safetySuccessBtn').click();actionFoul();});m=await state();assert.equal(records(m,'escape')[0].intent,'escape');assert.equal(records(m,'escape')[0].pottingAttempts,0);assert.equal(m.stats[1].fouls,1);assert.equal(m.stats[1].safetyEscapes,1);
  await base();await run(()=>{actionSafe();document.getElementById('safetySuccessBtn').click();actionSafetyEscape();document.getElementById('safetyEscapeSuccessBtn').click();document.getElementById('safetyEscapeResafeBtn').click();});m=await state();assert.equal(m.stats[1].resafes,1);assert.equal(m.stats[1].successfulSafetyEscapes,1);assert.equal(records(m,'escape').length,1);assert.equal(records(m,'safety').length,2);await run(()=>fcTest.undo());assert.equal((await state()).stats[1].resafes,0);
  console.log('PASS attacking/defensive/other/unknown foul, MISS, escape foul, safety/RESAFE and undo without double counting');
  await base();await run(()=>actionBreakAndRun());m=await state();assert.equal(records(m,'inferred_pots')[0].strokeCount,null);assert.equal(records(m,'inferred_pots')[0].pottingAttempts,null);assert.equal(m.stats[0].regularPottedBalls,8);assert.equal(await run(()=>fcTest.evidence(fcTest.match,0).pots.total),8);assert.equal(await run(()=>fcTest.evidence(fcTest.match,0).potting.coverage),'partial');await run(()=>fcTest.undo());assert.equal((await state()).federalEvidence.racks.length,0);
  for(const mode of ['soft','push']){await setup(3);await run(mode=>{if(mode==='soft'){fcTest.soft();returnTableAfterSoftBreak();}else{fcTest.exactBreak([1]);actionPushOut();returnPushOut();}actionBreakAndRun();},mode);m=await state();assert.equal(m.stats[0].breakAndRun,1);assert.equal(m.federalEvidence.racks[0].breakAndRun,true);}
  await setup(3);await run(()=>{fcTest.exactBreak([9]);});m=await state();assert.equal(m.stats[0].aces,1);assert.equal(m.stats[0].breakAndRun,0);assert.equal(m.federalEvidence.racks[0].ace,true);assert.equal(m.federalEvidence.racks[0].breakAndRun,false);
  const rackId=m.federalEvidence.racks[0].id;assert.equal(await run(()=>{const n=fcTest.match.rackNumber;fcTest.match.rackNumber=1;const result=fcTest.recordRack(0,'duplicate');fcTest.match.rackNumber=n;return result;}),false); // current next rack is a distinct rack
  // Restore through UNDO, not inference from the final score.
  await setup(3);await run(()=>{document.getElementById('manualBreaker').click();});await run(()=>{actionDryBreak();winRack(1);});m=await state();assert.equal(m.federalEvidence.racks[0].breaker,1);assert.equal(m.federalEvidence.racks[0].winner,1);
  console.log('PASS inferred completion has unknown attempts; existing returned soft/push B&R, separate ace, actual corrected breaker');
  await setup(1);await select('SK2','CZ4');await run(()=>{fcTest.exactBreak([1]);actionBreakAndRun();});m=await state();const actor=m.federalTeam.racks[0].players[0];assert.equal(actor.identityStatus,'stable');assert.equal(m.federalEvidence.racks,undefined);assert.deepEqual(m.federalTeam.racks[0].participantIds[0],[actor.id]);assert.deepEqual(m.federalTeam.racks[0].shotIds,m.federalTeam.racks[0].shots.map(r=>r.id));
  await select('SK3','CZ1');await run(()=>{actionDryBreak();winRack(0);});m=await state();assert.notEqual(m.federalTeam.racks[1].players[0].id,actor.id);assert.equal(m.federalTeam.racks[0].stats[0].breakAndRun,1);assert.equal(m.federalTeam.racks[1].stats[0].breakAndRun,0);
  await setup(2);await run(()=>{fcTest.exactBreak([1]);actionLegal();fcTest.chooseShot([2]);});m=await state();assert.equal(m.detailedPlay.records.at(-1).actor,null);assert.notEqual(m.teamPlayerIds[0][0],m.teamPlayerIds[0][1]);
  console.log('PASS Team per-rack stable actors and baseline, reference-only canonical IDs, Doubles no invented shooter');
  await base();await run(async()=>{toggleDetailedShotTag('jump');fcTest.save();await fcTest.backup();});m=await state();const matchId=m.id;
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{document.getElementById('cloudEmail').value='bcrybarna@gmail.com';document.getElementById('cloudPassword').value='isolated-password';await fcTest.login();await fcTest.resume();});
  m=await state();assert.equal(m.id,matchId);assert.equal(m.detailedPlay.tag.type,'jump');assert.equal(m.federalEvidence.fromStart,true);
  await run(()=>{toggleDetailedShotTag('jump');while(fcTest.match.scores[0]<5){if(fcTest.match.isBreakShot)actionDryBreak();winRack(0);}});m=await state();const ledger=JSON.parse(JSON.stringify(m.federalEvidence.racks));assert.equal(ledger.length,5);await run(()=>winRack(0));assert.equal((await state()).federalEvidence.racks.length,5);
  await run(()=>fcTest.persist());assert.ok(mock.matches[matchId]);assert.deepEqual(mock.matches[matchId].federalEvidence.racks,ledger);
  await run(()=>fcTest.logout());await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{document.getElementById('cloudEmail').value='bcrybarna@gmail.com';document.getElementById('cloudPassword').value='isolated-password';await fcTest.login();});const saved=await run(id=>fcTest.data.matches.find(m=>m.id===id),matchId);assert.deepEqual(saved.federalEvidence.racks,ledger);assert.equal(saved.detailedPlay.records[0].evidenceVersion,2);
  await setup(3);await run(()=>{delete fcTest.match.federalEvidence;delete fcTest.match.detailedPlay;fcTest.render();});assert.notEqual(await run(()=>fcTest.evidence(fcTest.match,0).potting.coverage),'complete');assert.equal(await run(()=>fcTest.evidence(fcTest.match,0).pots.total),null);
  assert.deepEqual(errors,[]);console.log('PASS real mocked Auth login/reload/resume, cloud backup, idempotent completion, full PUT/GET and legacy unknown; 0 page errors, all requests intercepted');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
