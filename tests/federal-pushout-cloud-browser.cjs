'use strict';
// Exercises the CURRENT index.html. All network traffic is intercepted;
// Firebase REST calls use an in-memory mock, never the production service.
const {chromium}=require('playwright');
const {firebaseJsonRoundtrip}=require('./fixtures/firebase-json-roundtrip.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const breakCase=require('./fixtures/federal-team-breaker-correction.json');
const original=process.env.FC_ZERO_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.FC_ZERO_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const hook=`
window.fcTest={
  get match(){return match},get data(){return data},
  cloudPut(){return secureMatchRequest(match.id,'PUT',JSON.parse(JSON.stringify(match)));},cloudResume:resumeLocalMatch,record:recordDetailedShot,
  get clockRunning(){return timerRunning},
  breakStats,unknownBreak(){actionBreakOk();finishBreakPotCount(1);},exactBreak(){pendingBreakBalls=[1];finishExactBreakBalls();},
  start:startMatch,undo,beginRack,snapshot,restoreSnapshot,calculate:federalCalculateMatch,season:federalCalculateSeason,format:federalReportMetric,
  chooseShot(balls){pendingShotBallSelection=balls;finishShotBallSelection();},save:autosaveCurrent,sequential:processSequentialCleanShots,cleanBreak(){actionBreakOk();pendingBreakBalls=[1];finishExactBreakBalls();},foulBreak(){actionBreakFoul();finishBreakPotCount(0);},
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
     if(['PUT','PATCH'].includes(request.method())){const value=request.postDataJSON();writes.push({key,value});parent[leaf]=firebaseJsonRoundtrip(request.method()==='PATCH'?{...parent[leaf],...value}:value);}
     if(request.method()==='DELETE')delete parent[leaf];
     return route.fulfill({contentType:'application/json',body:JSON.stringify(parent[leaf]??null)});
   }
   return route.abort();
 });
 const page=await context.newPage();const errors=[];
 page.setDefaultTimeout(15000);
 if(process.env.FC_DEBUG)page.on('console',msg=>console.log(msg.type(),msg.text()));
 page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.dismiss());
 await page.goto('http://fc-isolated.local/');
 await page.waitForFunction(()=>!!window.fcTest);
 await page.waitForSelector('#cloudLoginModal.show');
 async function run(fn,arg){return page.evaluate(fn,arg)}
 async function setup(n=1,opening=0){await run(async ({n,opening})=>{fcTest.admin();fcTest.reset();
   if(n!==1)fcTest.data.federalCup2026.lineups[n]=n===2?{a:['SK1','SK2'],b:['CZ1','CZ2']}:{a:['SK3'],b:['CZ3']};
   await fc26StartFixture(n);document.getElementById('fc26LagWinner').value=String(opening);document.getElementById('useLag').checked=false;fcTest.start();},{n,opening});}
 async function state(){return run(()=>JSON.parse(JSON.stringify(fcTest.match)))}
 async function select(a='SK2',b='CZ4'){
   await page.locator('#fc26RackPlayers select').nth(0).selectOption(a);
   await page.locator('#fc26RackPlayers select').nth(1).selectOption(b);
   await page.locator('#fc26RackPlayers button').click();
 }


 try{
  const metrics=()=>run(()=>fcTest.calculate(fcTest.match).sides[0].metrics);
  async function cloudReload(){const before=await state(),conf=await run(()=>JSON.parse(JSON.stringify(fcTest.data.federalCup2026)));await run(()=>fcTest.cloudPut());const saved=mock.matches[before.id];await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async({id,conf})=>{fcTest.admin();fcTest.data.federalCup2026=conf;await fcTest.cloudResume(id)},{id:before.id,conf});assert.equal((await state()).id,before.id);assert.deepEqual((await state()).scores,before.scores);return saved;}
  // No implicit default: opening/cancelling the dialog cannot create a push-out.
  await setup(3);await run(()=>fcTest.cleanBreak());const before=await state();await page.locator('#actionPushOutBtn').click();assert.equal(await page.locator('#pushOutBallsModal').isVisible(),true);assert.equal(await page.locator('#pushOutBallsModal').getByText('NEVÍM',{exact:true}).count(),0);assert.deepEqual(await state(),before);await run(()=>cancelPushOutBalls());assert.deepEqual(await state(),before);
  // Explicit zero is retained even when the mock removes balls: [].
  await page.locator('#actionPushOutBtn').click();await page.locator('#pushOutNoBallsBtn').click();let m=await state(),r=m.detailedPlay.records.find(r=>r.kind==='push_out');assert.equal(r.pottedCount,0);assert.equal(r.pottingAttempts,0);assert.equal(r.successfulPottingStrokes,0);assert.equal((await metrics()).pottedBalls.count,0);assert.equal((await metrics()).pottedBalls.coverage,'complete');const zero=await cloudReload();assert.equal(Object.hasOwn(Object.values(zero.detailedPlay.records).find(r=>r.kind==='push_out'),'balls'),false);assert.equal((await metrics()).pottedBalls.coverage,'complete');await run(()=>fcTest.undo());assert.equal((await state()).stats[0].pushOuts,0);assert.equal((await state()).detailedPlay.records.some(r=>r.kind==='push_out'),false);
  // Pocketed push-out balls affect only table state. Game ball returns to the spot.
  for(const discipline of ['9-ball','10-ball']){
   await setup(3);if(discipline==='10-ball')await run(()=>{fcTest.match.discipline='10-ball';fcTest.match.rackRemainingBalls=[1,2,3,4,5,6,7,8,9,10];fcTest.beginRack();});await run(()=>fcTest.cleanBreak());await page.locator('#actionPushOutBtn').click();await page.locator('#pushOutSelectBallsBtn').click();assert.equal(await page.locator('#pushOutConfirmBallsBtn').isDisabled(),true);await run(game=>{togglePushOutBall(2);togglePushOutBall(game)},discipline==='9-ball'?9:10);await page.locator('#pushOutConfirmBallsBtn').click();await run(()=>confirmPushOutBalls('selected'));m=await state();r=m.detailedPlay.records.find(r=>r.kind==='push_out');assert.equal(m.detailedPlay.records.filter(r=>r.kind==='push_out').length,1);assert.equal(r.pottedCount,2);assert.equal(m.rackRemainingBalls.includes(2),false);assert.equal(m.rackRemainingBalls.includes(discipline==='9-ball'?9:10),true);assert.equal(m.stats[0].regularPottedBalls||0,0);assert.equal((await metrics()).pottedBalls.count,0);assert.equal((await metrics()).pottingSuccess.denominator,0);await cloudReload();assert.equal((await state()).rackRemainingBalls.includes(2),false);await run(()=>returnPushOut());assert.equal((await state()).turn,0);await page.locator('#actionBreakRunBtn').click();m=await state();assert.equal(m.stats[0].breakAndRun,1);assert.equal(m.detailedPlay.records.filter(r=>r.kind==='pot').at(-1).balls.includes(2),false);assert.equal((await metrics()).pottedBalls.count,discipline==='9-ball'?7:8);
  }
  // Foul intent is explicitly selected in the existing UI; selecting a ball alone is not intent.
  for(const intent of ['unknown','pot','safety','other']){
   await setup(3);await run(()=>fcTest.cleanBreak());await run(()=>actionFoul());await page.locator('#rotationFoulIntent').selectOption(intent);await run(()=>{selectRotationFailureBall(2);confirmRotationFailure()});r=(await state()).detailedPlay.records.find(r=>r.kind==='foul');assert.equal(r.intent,intent);assert.equal(r.successfulPottingStrokes,0);assert.equal(r.pottingAttempts,intent==='unknown'?null:intent==='pot'?1:0);await cloudReload();const x=await metrics();assert.equal(x.pottingSuccess.coverage,intent==='unknown'?'partial':'complete');assert.equal(x.pottingSuccess.denominator,intent==='pot'?1:0);assert.equal(x.pottedBalls.coverage,'complete');if(intent==='unknown'){assert.ok(x.pottingSuccess.reasons.includes('unknown_attempts'));assert.ok(x.pottingSuccess.reasons.includes('unknown_intent'));}await run(()=>fcTest.undo());assert.equal((await state()).stats[0].fouls,0);
  }
  assert.deepEqual(errors,[]);console.log('PASS explicit push-out zero/selected balls, 9/10 spotting, no pot/attempt credit, cancel/double-confirm, cloud JSON/GET/reload/UNDO, returned B&R; foul pot/safety/other/unknown intents preserved');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
