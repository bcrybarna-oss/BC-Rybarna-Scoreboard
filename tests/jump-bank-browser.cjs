'use strict';
// Exercises the CURRENT index.html. All network traffic is intercepted;
// Firebase REST calls use an in-memory mock, never the production service.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const breakCase=require('./fixtures/federal-team-breaker-correction.json');
const original=process.env.FC_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.FC_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const hook=`
window.fcTest={
  get match(){return match},get data(){return data},
  get clockRunning(){return timerRunning},
  breakStats,
  summary:detailedShotSummary,calculate:federalCalculateMatch,season:federalCalculateSeason,
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
 const page=await context.newPage();const errors=[],samples=[];
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
  await setup(3);await run(()=>fcTest.exactBreak([1]));
  await page.locator('#actionJumpBtn').click();await run(()=>{actionLegal();fcTest.chooseShot([2]);});
  let m=await state();const r=m.detailedPlay.records.find(r=>r.tag?.type==='jump');assert.ok(r&&r.tag.success);assert.equal(m.stats[0].jumpShotAttempts,1);
  assert.equal(await page.locator('#eventLog [data-shot-id="'+r.id+'"]').count(),1,'canonical Jump stroke must be visible in played-shot history');
  assert.match(await page.locator('#eventLog').innerText(),/JUMP SHOT/);
  async function base(){await setup(3);await run(()=>fcTest.exactBreak([1]));}
  async function visible(type,kind,success,side=0){
   const m=await state(),rs=m.detailedPlay.records.filter(r=>r.tag?.type===type);assert.equal(rs.length,1);
   const r=rs[0];assert.equal(r.kind,kind);assert.equal(r.side,side);assert.equal(r.strokeCount,1);assert.equal(r.tag.success,success);assert.ok(r.id&&r.rack&&r.inning);
   assert.equal(m.stats[side][type+'ShotAttempts'],1);assert.equal(m.stats[side][type+'ShotSuccessful'],Number(success));assert.equal(m.detailedPlay.tag,null);
   const row=page.locator('#eventLog [data-shot-id="'+r.id+'"]');assert.equal(await row.count(),1);assert.match(await row.innerText(),new RegExp(type.toUpperCase()+' SHOT'));assert.match(await row.innerText(),new RegExp(success?' • úspěšný':' • neúspěšný'));
   const summary=await run(side=>fcTest.summary(fcTest.match,side),side);assert.equal(summary[type+'Attempts'],1);assert.equal(summary[type+'Successful'],Number(success));
   samples.push(r);
   return r;
  }
  for(const type of ['jump','bank'])for(const kind of ['pot','miss','foul']){
   await base();await page.locator(type==='jump'?'#actionJumpBtn':'#actionBankBtn').click();
   if(kind==='pot')await run(()=>{actionLegal();fcTest.chooseShot([2]);});
   else await run(kind=>{if(kind==='miss')actionMiss();else actionFoul();selectRotationFailureBall(2);confirmRotationFailure();},kind);
   await visible(type,kind,kind==='pot');
  }
  for(const outcome of ['success','fail','foul']){
   const success=outcome==='success';
   await base();await run(outcome=>{actionSafe();document.getElementById('safetySuccessBtn').click();toggleDetailedShotTag('jump');actionSafetyEscape();document.getElementById(outcome==='success'?'safetyEscapeSuccessBtn':outcome==='foul'?'safetyEscapeFailBtn':'safetyEscapeLegalFailBtn').click();if(outcome==='success')document.getElementById('safetyEscapeEndBtn').click();},outcome);
   await visible('jump','escape',success,1);m=await state();assert.equal(m.stats[1].regularPottedBalls,0);
   const metric=await run(()=>fcTest.calculate(fcTest.match).sides[1].metrics);assert.equal(metric.jumpShots.numerator,Number(success));assert.equal(metric.jumpShots.denominator,1);assert.equal(metric.pottingSuccess.denominator,0);
  }
  await base();await run(()=>{toggleDetailedShotTag('bank');actionLegal();fcTest.chooseShot([2,3]);document.getElementById('higherBallComboBtn').click();});await visible('bank','pot',true);assert.deepEqual((await state()).detailedPlay.records.find(r=>r.tag).balls,[2,3]);
  for(const cancel of ['shotBallCancelBtn','higherBallTypeCancelBtn']){
   await base();await run(cancel=>{toggleDetailedShotTag('jump');actionLegal();if(cancel==='higherBallTypeCancelBtn')fcTest.chooseShot([4]);document.getElementById(cancel).click();},cancel);
   m=await state();assert.equal(m.detailedPlay.tag,null);assert.equal(m.stats[0].jumpShotAttempts,0);assert.equal(m.detailedPlay.records.filter(r=>r.tag).length,0);
   await run(()=>{actionLegal();fcTest.chooseShot([2]);});assert.equal((await state()).detailedPlay.records.some(r=>r.tag),false);
  }
  for(const kind of ['miss','foul']){
   await base();await run(kind=>{toggleDetailedShotTag('bank');if(kind==='miss')actionMiss();else actionFoul();selectRotationFailureBall(5);cancelRotationFailure();},kind);
   m=await state();assert.equal(m.detailedPlay.tag,null);assert.equal(m.stats[0].bankShotAttempts,0);assert.equal(m.detailedPlay.records.filter(r=>r.tag).length,0);assert.ok(m.rackRemainingBalls.includes(2));
  }
  await base();await run(()=>{actionSafe();document.getElementById('safetySuccessBtn').click();toggleDetailedShotTag('jump');actionSafetyEscape();document.getElementById('safetyEscapeSuccessBtn').click();cancelSafetyEntry();});m=await state();assert.equal(m.detailedPlay.tag,null);assert.equal(m.stats[1].jumpShotAttempts,0);assert.ok(m.detailedPlay.pendingSafety);
  await base();await run(()=>{toggleDetailedShotTag('jump');toggleDetailedShotTag('bank');});assert.equal((await state()).detailedPlay.tag.type,'bank');await page.locator('#actionBankBtn').click();assert.equal((await state()).detailedPlay.tag,null);
  await base();await run(()=>{toggleDetailedShotTag('jump');actionLegal();fcTest.chooseShot([2]);});const before=await visible('jump','pot',true);
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume();});assert.deepEqual((await state()).detailedPlay.records.find(r=>r.tag),before);await visible('jump','pot',true);
  await run(()=>fcTest.undo());assert.equal(await page.locator('#eventLog [data-tagged-shot-history]').count(),0);assert.equal((await state()).detailedPlay.tag.type,'jump');
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume();});assert.equal((await state()).detailedPlay.tag.type,'jump');await run(()=>{actionLegal();fcTest.chooseShot([2]);});await visible('jump','pot',true);
  await setup(1);await select('SK2','CZ4');await run(()=>{fcTest.exactBreak([1]);toggleDetailedShotTag('bank');actionLegal();fcTest.chooseShot([2]);});const team=await visible('bank','pot',true);assert.equal(team.actor.name,'SK2');await run(()=>winRack(0));
  const personal=await run(id=>fcTest.calculate(fcTest.match).individuals[id].metrics.bankShots,team.actor.id);assert.equal(personal.numerator,1);assert.equal(personal.denominator,1);
  await setup(2);await run(()=>{fcTest.exactBreak([1]);toggleDetailedShotTag('jump');actionMiss();selectRotationFailureBall(2);confirmRotationFailure();});const pair=await visible('jump','miss',false);assert.equal(pair.actor,null);assert.deepEqual(await run(()=>fcTest.calculate(fcTest.match).individuals),{});
  await page.setViewportSize({width:390,height:844});assert.match(await page.locator('#eventLog [data-tagged-shot-history]').innerText(),/JUMP SHOT/);assert.ok((await page.locator('#eventLog [data-tagged-shot-history]').boundingBox()).width<=390);
  if(process.env.FC_ARTIFACT_DIR){fs.mkdirSync(process.env.FC_ARTIFACT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.FC_ARTIFACT_DIR,'records.json'),JSON.stringify(samples,null,2));await page.locator('#eventLog').screenshot({path:path.join(process.env.FC_ARTIFACT_DIR,'tagged-history-mobile.png')});}
  await run(()=>{const r=fcTest.match.detailedPlay.records.find(r=>r.tag);fcTest.match.detailedPlay.records.push(JSON.parse(JSON.stringify(r)));fcTest.render();});assert.equal(await page.locator('#eventLog [data-shot-id]').count(),1);
  await run(()=>{fcTest.match.detailedPlay.records.at(-1).tag.success=true;fcTest.render();});assert.equal(await page.locator('#eventLog [data-shot-id]').count(),0,'conflicting ID variants cannot be shown as a confirmed stroke');
  assert.deepEqual(errors,[]);console.log('PASS canonical tagged stroke is displayed exactly once in played-shot history');
  console.log('PASS Jump/Bank pot, MISS, foul; legal/failed Jump escape without attack; multipot; cancel/toggle; undo/reload; summary/history; Singles/Team actor/Doubles, no real network');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

