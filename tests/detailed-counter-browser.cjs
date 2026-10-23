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
  breakStats,
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
    data.federalCup2026.rosterMode='manual';data.federalCup2026.rosterA=['SK1','SK2','SK3','SK4','SK5'];data.federalCup2026.rosterB=['CZ1','CZ2','CZ3','CZ4','CZ5'];ensureFederalParticipants(data.federalCup2026);},
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
 async function setup(n=1){await run(async n=>{fcTest.admin();fcTest.reset();
   if(n!==1)fcTest.data.federalCup2026.lineups[n]=n===2?{a:['SK1','SK2'],b:['CZ1','CZ2']}:{a:['SK3'],b:['CZ3']};
   await fc26StartFixture(n);document.getElementById('fc26LagWinner').value='0';document.getElementById('useLag').checked=false;fcTest.start();},n);}
 async function state(){return run(()=>JSON.parse(JSON.stringify(fcTest.match)))}
 async function select(a='SK2',b='CZ4'){
   await page.locator('#fc26RackPlayers select').nth(0).selectOption(a);
   await page.locator('#fc26RackPlayers select').nth(1).selectOption(b);
   await page.locator('#fc26RackPlayers button').click();
 }

 try{
  async function base(){await setup(3);await run(()=>fcTest.exactBreak([1]));}
  async function failure(kind,ball,pots=[]){await run(({kind,ball,pots})=>{kind==='miss'?actionMiss():actionFoul();selectRotationFailureBall(ball);for(const b of pots)toggleFoulPocketedBall(b);confirmRotationFailure();},{kind,ball,pots});}
  async function safe(success=true){await run(success=>{actionSafe();document.getElementById(success?'safetySuccessBtn':'safetyFailBtn').click();},success);}
  const records=(m,kind)=>m.detailedPlay.records.filter(r=>r.kind===kind);
  await base();let before=await state();await failure('miss',5);let m=await state();
  assert.deepEqual(m.rackRemainingBalls,[5,6,7,8,9]);assert.equal(m.stats[0].breakPottedBalls,1);assert.equal(m.stats[0].regularPottedBalls,3);assert.equal(m.stats[0].matchOnlyMisses,1);assert.equal(m.stats[0].fouls,0);assert.equal(m.turn,1);
  assert.deepEqual(records(m,'inferred_pots')[0].balls,[2,3,4]);assert.equal(records(m,'inferred_pots')[0].strokeCount,3);assert.equal(records(m,'miss')[0].ball,5);assert.equal(records(m,'break')[0].balls[0],1);
  const afterMissRecords=m.detailedPlay.records;
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});m=await state();assert.deepEqual(m.detailedPlay.records,afterMissRecords);assert.deepEqual(m.rackRemainingBalls,[5,6,7,8,9]);
  await run(()=>fcTest.undo());m=await state();assert.deepEqual(m.rackRemainingBalls,before.rackRemainingBalls);assert.deepEqual(m.stats,before.stats);assert.deepEqual(m.detailedPlay,before.detailedPlay);
  console.log('PASS break 1 → MISS 5: inferred 2/3/4, typed evidence, one miss, turn, real reload and complete undo');
  await base();before=await state();await failure('foul',5,[5,9]);m=await state();assert.deepEqual(m.rackRemainingBalls,[6,7,8,9]);assert.equal(m.stats[0].regularPottedBalls,3);assert.equal(m.stats[0].foulPottedBalls,2);assert.equal(m.stats[0].fouls,1);assert.equal(m.stats[0].matchOnlyMisses,0);assert.deepEqual(records(m,'foul')[0].foulBalls,[5,9]);assert.equal(records(m,'foul')[0].ballInHand,true);assert.deepEqual(m.scores,[0,0]);
  await run(()=>fcTest.undo());assert.deepEqual((await state()).stats,before.stats);
  await run(()=>{actionFoul();selectRotationFailureBall(5);toggleFoulPocketedBall(3);confirmRotationFailure();});assert.equal(await page.locator('#rotationFailureModal').evaluate(e=>e.classList.contains('show')),true);assert.deepEqual((await state()).stats,before.stats);await run(()=>cancelRotationFailure());
  console.log('PASS ordinary foul 5, separate foul pots, spotting game ball, BIH, no miss, undo, rejected contradictory pot classification');
  // A safety is successful independently of whether its one subsequent escape succeeds.
  for(const outcome of ['success','fail','foul','resafe']){
   await base();await safe();m=await state();const sid=records(m,'safety')[0].id;assert.equal(m.detailedPlay.pendingSafety.id,sid);assert.equal(m.stats[1].safetyEscapes,0);
   if(outcome==='foul')await run(()=>actionFoul());
   else {await run(()=>actionSafetyEscape());if(outcome==='fail')await page.locator('#safetyEscapeLegalFailBtn').click();else{await page.locator('#safetyEscapeSuccessBtn').click();await page.locator(outcome==='resafe'?'#safetyEscapeResafeBtn':'#safetyEscapeEndBtn').click();}}
   m=await state();assert.equal(records(m,'escape').length,1);assert.equal(records(m,'escape')[0].safetyId,sid);assert.equal(m.stats[1].safetyEscapes,1);assert.equal(m.stats[1].successfulSafetyEscapes+m.stats[1].failedSafetyEscapes,1);assert.equal(m.stats[0].successfulSafeties,1);assert.equal(m.stats[1].fouls,outcome==='foul'?1:0);assert.equal(await page.locator('#rotationFailureModal').evaluate(e=>e.classList.contains('show')),false);
   if(outcome==='resafe'){assert.equal(m.stats[1].successfulSafeties,1);assert.equal(m.detailedPlay.pendingSafety.respondingSide,0);await run(()=>actionFoul());m=await state();assert.equal(records(m,'escape').length,2);assert.equal(m.stats[0].safetyEscapes,1);assert.equal(records(m,'escape')[1].safetyId,records(m,'safety')[1].id);}
   await run(()=>fcTest.undo());m=await state();assert.ok(m.safetyEscapeEligibleFor!=null);
  }
  await base();await safe(false);m=await state();assert.equal(m.safetyEscapeEligibleFor,null);assert.equal(m.stats[1].safetyEscapes,0);assert.equal(m.detailedPlay.pendingSafety,null);
  await base();await safe();await run(()=>{actionSafetyEscape();document.getElementById('safetyEscapeSuccessBtn').click();cancelSafetyEntry();});assert.equal((await state()).stats[1].safetyEscapes,0);assert.ok((await state()).detailedPlay.pendingSafety);
  await run(()=>{actionFoul();openDetailedTableCorrection();toggleDetailedTableBall(3);document.getElementById('tableCorrectionFoul').checked=true;saveDetailedTableCorrection();});m=await state();assert.equal(m.stats[1].foulPottedBalls,1);assert.equal(m.rackRemainingBalls.includes(3),false);assert.equal(m.stats[1].regularPottedBalls,0);await run(()=>fcTest.undo());assert.equal((await state()).rackRemainingBalls.includes(3),true);
  console.log('PASS successful/failed/foul escape, one linked response, no ball prompt, RESAFE chain, pending/cancel, failed safety, explicit foul-table correction and undo');
  // Tags apply to one explicit stroke and clear on cancellation and survive pending reload, never batch inferred pots.
  for(const type of ['jump','bank']){
   await base();await run(type=>{toggleDetailedShotTag(type);toggleDetailedShotTag(type);},type);assert.equal((await state()).detailedPlay.tag,null);
   await run(type=>toggleDetailedShotTag(type),type);await run(()=>{actionLegal();document.getElementById('shotBallCancelBtn').click();});assert.equal((await state()).stats[0][type+'ShotAttempts'],0);assert.equal((await state()).detailedPlay.tag,null);await run(type=>toggleDetailedShotTag(type),type);
   await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});assert.equal((await state()).detailedPlay.tag.type,type);
   await run(()=>{actionLegal();fcTest.chooseShot([2]);});m=await state();assert.equal(m.stats[0][type+'ShotAttempts'],1);assert.equal(m.stats[0][type+'ShotSuccessful'],1);assert.equal(m.detailedPlay.tag,null);assert.equal(records(m,'pot')[0].tag.type,type);
   await run(()=>fcTest.undo());m=await state();assert.equal(m.stats[0][type+'ShotAttempts'],0);assert.equal(m.rackRemainingBalls.includes(2),true);assert.equal(m.detailedPlay.tag.type,type);
   await failure('miss',5);m=await state();assert.equal(m.stats[0][type+'ShotAttempts'],1);assert.equal(m.stats[0][type+'ShotSuccessful'],0);assert.deepEqual(records(m,'inferred_pots')[0].balls,[2,3,4]);assert.equal(records(m,'inferred_pots')[0].tag,undefined);
   await base();await run(type=>toggleDetailedShotTag(type),type);await failure('foul',2);m=await state();assert.equal(m.stats[0][type+'ShotAttempts'],1);assert.equal(m.stats[0][type+'ShotSuccessful'],0);
  }
  await base();await safe();await run(()=>{toggleDetailedShotTag('bank')});assert.equal((await state()).detailedPlay.tag,null);await run(()=>{toggleDetailedShotTag('jump');actionSafetyEscape();document.getElementById('safetyEscapeSuccessBtn').click();document.getElementById('safetyEscapeEndBtn').click();});m=await state();assert.equal(m.stats[1].jumpShotSuccessful,1);assert.equal(records(m,'escape')[0].tag.success,true);
  await base();await run(()=>{toggleDetailedShotTag('jump');actionSafe();actionRunout();document.getElementById('quickRunoutBtn').click();});assert.equal((await state()).stats[0].jumpShotAttempts,0);assert.equal((await state()).detailedPlay.records.length,1);
  await run(()=>switchTurn());assert.equal((await state()).detailedPlay.tag,null);
  console.log('PASS jump/bank toggle, success/miss/foul, cancel, one attempt vs inferred batch, reload/undo, jump legal escape, rejection of bank escape and ambiguous actions, no tag carry to opponent');
  // Real combinations, multipots and inning boundaries preserve known ownership.
  await base();await run(()=>{actionLegal();fcTest.chooseShot([2,4]);document.getElementById('higherBallComboBtn').click();});m=await state();assert.deepEqual(m.rackRemainingBalls,[3,5,6,7,8,9]);assert.equal(records(m,'pot')[0].shotType,'combo');assert.equal(records(m,'pot')[0].strokeCount,1);
  await failure('miss',5);await failure('miss',7);m=await state();assert.deepEqual(records(m,'inferred_pots').map(r=>[r.side,r.balls]),[[0,[3]],[1,[5,6]]]);assert.equal(m.stats[0].regularPottedBalls,3);assert.equal(m.stats[1].regularPottedBalls,2);
  await base();await run(()=>{actionLegal();fcTest.chooseShot([2,3]);document.getElementById('shotSequenceCancelBtn').click();});assert.deepEqual((await state()).rackRemainingBalls,[2,3,4,5,6,7,8,9]);assert.equal(records(await state(),'pot').length,0);
  await base();await run(()=>{actionLegal();fcTest.chooseShot([4]);document.getElementById('higherBallTypeCancelBtn').click();});assert.equal((await state()).rackRemainingBalls.includes(4),true);
  await base();await run(()=>{openDetailedTableCorrection();toggleDetailedTableBall(2);saveDetailedTableCorrection();actionMiss();selectRotationFailureBall(5);});assert.match(await page.locator('#rotationInferenceText').innerText(),/nelze bezpečně/);await run(()=>confirmRotationFailure());m=await state();assert.equal(m.stats[0].regularPottedBalls,0);assert.equal(m.rackRemainingBalls.includes(3),true);
  console.log('PASS combination/multipot, no duplicated or stolen opponent pots, nested dialog cancel rolls back selection, ambiguous correction does not invent pots');
  await setup(1);await select('SK2','CZ4');await run(()=>fcTest.exactBreak([1]));await run(()=>toggleDetailedShotTag('jump'));await failure('miss',5);m=await state();assert.equal(records(m,'miss')[0].actor.name,'SK2');assert.equal(records(m,'inferred_pots')[0].actor.name,'SK2');await run(()=>winRack(1));m=await state();assert.equal(m.federalTeam.racks[0].stats[0].jumpShotAttempts,1);assert.equal(m.federalTeam.racks[0].shots.find(r=>r.kind==='miss').actor.name,'SK2');await select('SK3','CZ1');assert.equal((await state()).detailedPlay.tag,null);assert.equal((await state()).rackNumber,2);
  await setup(2);await run(()=>fcTest.exactBreak([1]));await failure('miss',5);assert.equal(records(await state(),'miss')[0].actor,null);
  await base();await run(()=>fcTest.legacy());assert.equal(await run(()=>fcTest.summary({},0)),null);await failure('miss',5);m=await state();assert.equal(m.detailedPlay.coverage,'partial');assert.equal(records(m,'inferred_pots').length,0);assert.equal(m.rackRemainingBalls.includes(2),true);
  await base();await run(()=>fcTest.simple());assert.equal(await page.locator('#actionJumpBtn').isVisible(),false);assert.equal(await page.locator('#normalActions').isVisible(),false);
  console.log('PASS Team actor/rack/team stats, Doubles pair without invented shooter, legacy unknown coverage and simple controls');
  async function ordinary(discipline){await run(discipline=>{fcTest.admin();fcTest.reset();fcTest.screen('home');fcTest.screen('setup');document.getElementById('setupStandardBtn').click();
    for(const id of ['ghostMode','solo14','solo14GhostMode','winnerTableMode','doublesMode','useLag'])document.getElementById(id).checked=false;
    document.getElementById('discipline').value=discipline;document.getElementById('counterMode').value='full';document.getElementById('raceTo').value=discipline==='14.1'?'100':'7';document.getElementById('p1Name').value='Fictional A';document.getElementById('p2Name').value='Fictional B';fcTest.start();},discipline);}
  await ordinary('10-ball');await run(()=>fcTest.exactBreak([1]));await failure('miss',5);m=await state();assert.deepEqual(m.rackRemainingBalls,[5,6,7,8,9,10]);assert.equal(m.stats[0].regularPottedBalls,3);
  await ordinary('10-ball');await run(()=>fcTest.exactBreak([1]));await failure('foul',5,[5,10]);m=await state();assert.deepEqual(m.rackRemainingBalls,[6,7,8,9,10]);assert.equal(m.stats[0].foulPottedBalls,2);assert.equal(m.stats[0].matchOnlyMisses,0);
  await ordinary('10-ball');await run(()=>{fcTest.exactBreak([1]);actionLegal();fcTest.chooseShot([2,10]);document.getElementById('higherBallComboBtn').click();});m=await state();assert.ok(m.rackRemainingBalls.includes(10));assert.equal(m.rackRemainingBalls.includes(2),false);assert.deepEqual(m.scores,[0,0]);await run(()=>fcTest.undo());assert.ok((await state()).rackRemainingBalls.includes(2));
  await base();await run(()=>{toggleDetailedShotTag('bank');actionLegal();fcTest.chooseShot([2,3]);document.getElementById('higherBallComboBtn').click();});m=await state();assert.equal(m.stats[0].bankShotAttempts,1);assert.equal(m.stats[0].bankShotSuccessful,1);assert.equal(records(m,'pot')[0].strokeCount,1);
  await ordinary('8-ball');await run(()=>actionDryBreak());await page.locator('#actionBankBtn').click();assert.equal(await page.locator('#actionBankBtn').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#actionLegalBtn').innerText(),'POTOPENÁ KOULE');await page.locator('#actionLegalBtn').click();m=await state();assert.equal(m.stats[1].bankShotSuccessful,1);assert.deepEqual(m.rackRemainingBalls,[]);await run(()=>fcTest.undo());assert.equal((await state()).stats[1].bankShotAttempts,0);await run(()=>toggleDetailedShotTag('bank'));await run(()=>actionMiss());m=await state();assert.equal(m.stats[1].matchOnlyMisses,1);assert.equal(records(m,'inferred_pots').length,0);assert.equal(await page.locator('#missReasonModal').evaluate(e=>e.classList.contains('show')),false);
  await ordinary('14.1');m=await state();assert.equal(m.detailedPlay,undefined);assert.equal(await page.locator('#actionJumpBtn').isVisible(),false);assert.equal(m.ballsOnTable,15);
  await page.locator('#endMiss14').click();await run(()=>{document.getElementById('ballsRemaining14').value='12';document.getElementById('confirmBalls14').click();});m=await state();assert.equal(m.scores[0],3);assert.equal(m.stats[0].innings14,1);assert.equal(m.turn,1);
  await page.locator('#endFoul14').click();await page.locator('#confirmBalls14').click();m=await state();assert.equal(m.scores[1],-1);assert.equal(m.stats[1].fouls,1);assert.equal(m.detailedPlay,undefined);await run(()=>fcTest.undo());assert.equal((await state()).scores[1],0);
  await base();await page.setViewportSize({width:390,height:844});await page.locator('#actionJumpBtn').click();await page.locator('#actionMissBtn').click();await page.locator('#rotationFailureBalls [aria-label="Koule 5"]').click();assert.equal(await page.locator('#rotationFailureModal').isVisible(),true);assert.equal(await page.locator('#rotationFailureBalls [aria-label="Koule 1"]').count(),0);assert.ok((await page.locator('#rotationFailureModal .modal-card').boundingBox()).width<=390);await run(()=>cancelRotationFailure());await page.setViewportSize({width:1280,height:720});
  assert.deepEqual(errors,[]);console.log('PASS 10-ball inference/foul/early-10 spotting and undo, tagged multipot is one stroke, 8-ball/no ordered inference, 14.1 untouched, mobile viewport controls; 0 page errors, all network intercepted');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
