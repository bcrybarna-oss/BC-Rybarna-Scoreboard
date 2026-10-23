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
  const cases=[];
  const metrics=()=>run(()=>fcTest.calculate(fcTest.match).sides[1].metrics);
  async function safe(){await run(()=>actionSafe());await page.locator('#safetySuccessBtn').click();}
  async function escape(outcome){await run(()=>actionSafetyEscape());if(outcome==='fail')await page.locator('#safetyEscapeLegalFailBtn').click();else if(outcome==='foul')await page.locator('#safetyEscapeFailBtn').click();else{await page.locator('#safetyEscapeSuccessBtn').click();await page.locator(outcome==='resafe'?'#safetyEscapeResafeBtn':'#safetyEscapeEndBtn').click();}}
  async function cloudReload(){
   const before=await state(),conf=await run(()=>JSON.parse(JSON.stringify(fcTest.data.federalCup2026)));await run(()=>fcTest.cloudPut());const stored=mock.matches[before.id];assert.ok(stored);
   const zero=Object.values(stored.detailedPlay.records).filter(r=>r.kind==='escape'&&r.pottedCount===0);assert.ok(zero.length);for(const r of zero)assert.equal(Object.hasOwn(r,'balls'),false,'The cloud model must actually drop empty balls');
   await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async ({id,conf})=>{fcTest.admin();fcTest.data.federalCup2026=conf;await fcTest.cloudResume(id);},{id:before.id,conf});
   assert.equal((await state()).id,before.id);assert.deepEqual((await state()).scores,before.scores);assert.equal((await metrics()).pottedBalls.coverage,'complete');
  }
  // All zero-pot escape controls, including RESAFE. No production Auth/Firebase is used.
  for(const outcome of ['resafe','end','fail','foul']){
   await setup(1);await select();await run(()=>fcTest.cleanBreak());await safe();await escape(outcome);
   const m=await state(),r=m.detailedPlay.records.filter(r=>r.kind==='escape').at(-1);assert.equal(r.pottedCount,0);assert.equal((await metrics()).pottedBalls.coverage,'complete');await cloudReload();assert.equal((await metrics()).pottedBalls.count,0);
   await run(()=>fcTest.undo());assert.equal((await state()).detailedPlay.records.filter(r=>r.kind==='escape').length,0);
  }
  // Reproduce the relevant actions from the real Team match, using synthetic identities.
  await setup(1);await select();await run(()=>fcTest.cleanBreak());await safe();await run(()=>actionSafetyEscape());await page.locator('#safetyEscapeSuccessBtn').click();await page.locator('#safetyEscapeContinueBtn').click();await run(()=>fcTest.chooseShot([2]));
  for(let n=3;n<=5;n++){await run(n=>{actionLegal();fcTest.chooseShot([n]);},n);if(await page.locator('#shotSequenceSequentialBtn').isVisible())await page.locator('#shotSequenceSequentialBtn').click();}
  await run(()=>{actionMiss();selectRotationFailureBall(7);confirmRotationFailure();});let x=await metrics();assert.equal(x.pottingSuccess.coverage,'complete');assert.equal(x.pottedBalls.components.derived,1);
  await page.locator('#quickRunoutBtn').click();await select();await run(()=>fcTest.cleanBreak());await page.locator('#actionBreakRunBtn').click();
  await select();await run(()=>{actionBreakOk();toggleBreakBall(2);});await page.locator('#breakBallSelectConfirmBtn').click();await safe();await escape('resafe');await run(()=>actionSafetyEscape());await page.locator('#safetyEscapeFailBtn').click();await page.locator('#quickRunoutBtn').click();
  x=await metrics();assert.equal(x.pottingSuccess.numerator,20);assert.equal(x.pottingSuccess.denominator,21);assert.equal(x.pottingSuccess.coverage,'complete');assert.equal(x.pottedBalls.count,21);assert.equal(x.pottedBalls.coverage,'complete');await cloudReload();
  x=await metrics();assert.equal(x.pottingSuccess.coverage,'complete');assert.equal(x.pottedBalls.count,21);assert.equal(x.pottedBalls.coverage,'complete');
  cases.push(await run(()=>{const m=JSON.parse(JSON.stringify(fcTest.match));m.endedAt=new Date().toISOString();m.status='complete';return {match:m,config:JSON.parse(JSON.stringify(fcTest.data.federalCup2026))};}));
  // Legacy/malformed absence must not be normalized to zero by loading or calculating.
  await run(()=>{const r=Object.values(fcTest.match.detailedPlay.records).find(r=>r.side===1&&r.kind==='escape'&&r.pottedCount===0);delete r.pottedCount;delete r.balls;});
  assert.ok((await metrics()).pottedBalls.reasons.includes('unknown_pots'));await run(()=>fcTest.cloudPut());const id=(await state()).id;await page.evaluate(()=>localStorage.clear());await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async id=>{fcTest.admin();await fcTest.cloudResume(id)},id);assert.ok((await metrics()).pottedBalls.reasons.includes('unknown_pots'));assert.equal((await metrics()).pottingSuccess.coverage,'complete');
  if(process.env.FC_ZERO_REPORT_CASES_FILE)fs.writeFileSync(process.env.FC_ZERO_REPORT_CASES_FILE,JSON.stringify(cases,null,2));
  assert.deepEqual(errors,[]);console.log('PASS actual escape controls → secureMatchRequest JSON → empty-array-dropping isolated cloud → GET and real reload; known zero complete, missing still unknown, safe inferred6/MISS7 adds exactly one success and one MISS; missing pots remain partial; Team actor/undo intact');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
