'use strict';
// Exercises the CURRENT index.html. All network traffic is intercepted;
// Firebase REST calls use an in-memory mock, never the production service.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const breakCase=require('./fixtures/federal-team-breaker-correction.json');
const original=process.env.FC_UNKNOWN_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.FC_UNKNOWN_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const hook=`
window.fcTest={
  get match(){return match},get data(){return data},
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
     if(['PUT','PATCH'].includes(request.method())){const value=request.postDataJSON();writes.push({key,value});parent[leaf]=request.method()==='PATCH'?{...parent[leaf],...value}:value;}
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
  const reportCases=[];
  const metrics=async()=>run(()=>fcTest.calculate(fcTest.match).sides.map(s=>s.metrics));
  // SYNTHETIC diagnostic: safe MISS inference follows the user-confirmed one-ball/one-success rule.
  await setup(1);await select();await run(()=>{actionDryBreak();actionMiss();selectRotationFailureBall(3);confirmRotationFailure();});
  const diagnostic=await run(()=>{const m=fcTest.match,r=fcTest.calculate(m);return {synthetic:true,notTheReportedProductionMatch:true,scenario:'Team: dry break, MISS on 3 infers balls 1 and 2',metrics:r.sides.map(s=>({pottingSuccess:s.metrics.pottingSuccess,pottedBalls:s.metrics.pottedBalls})),records:m.detailedPlay.records.map(({id,rack,kind,source,entry,intent,potsEvidence,pottingAttempts,successfulPottingStrokes,balls,actor})=>({id,rack,kind,source,entry,intent,potsEvidence,pottingAttempts,successfulPottingStrokes,balls,actorId:actor?.id}))};});
  assert.equal(diagnostic.metrics[1].pottingSuccess.coverage,'complete');assert.equal(diagnostic.metrics[1].pottingSuccess.numerator,2);assert.equal(diagnostic.metrics[1].pottingSuccess.denominator,3);assert.equal(diagnostic.metrics[1].pottedBalls.components.derived,2);
  if(process.env.FC_UNKNOWN_DIAGNOSTIC_FILE)fs.writeFileSync(process.env.FC_UNKNOWN_DIAGNOSTIC_FILE,JSON.stringify(diagnostic,null,2));
  if(process.env.FC_UNKNOWN_DIAGNOSTIC_ONLY){console.log(JSON.stringify(diagnostic));return;}

  if(process.env.FC_UNKNOWN_GUARD_ONLY){await setup(1);await select();const before=await state();await run(()=>fcTest.unknownBreak());assert.equal(await page.locator('#breakPotCountModal').evaluate(e=>e.classList.contains('show')),true,'Exact break must request ball numbers before committing');assert.deepEqual((await state()).detailedPlay.records,before.detailedPlay.records);console.log('PASS count-only exact break blocked before commit');return;}
  // User's successful 4:5 Singles is a CONTROL, not evidence against clean runs.
  // Repeat identical rack inputs in Team and verify canonical rack and yearly aggregation.
  for(const fixture of [3,1]){
   await setup(fixture,1);
   for(let rack=0;rack<9;rack++){
    if(fixture===1)await select();
    await run(()=>fcTest.cleanBreak());
    const side=(await state()).turn;
    if(side===1)await page.locator('#actionBreakRunBtn').click();
    else for(let n=2;n<=9;n++){await run(n=>{actionLegal();fcTest.chooseShot([n]);},n);if(await page.locator('#shotSequenceSequentialBtn').isVisible())await page.locator('#shotSequenceSequentialBtn').click();}
    if(rack===3){const before=await state();await run(()=>fcTest.save());await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});assert.deepEqual((await state()).detailedPlay,before.detailedPlay);assert.deepEqual((await state()).federalTeam,before.federalTeam);}
   }
   const m=await state();assert.deepEqual(m.scores,[4,5]);
   const control=await run(()=>{const m=JSON.parse(JSON.stringify(fcTest.match));m.endedAt=m.endedAt||new Date().toISOString();m.status='complete';const c=fcTest.calculate(m),year=fcTest.season([m],fcTest.data.federalCup2026,2026);return {c,year,m,config:JSON.parse(JSON.stringify(fcTest.data.federalCup2026))};});
   for(const side of [0,1]){const x=control.c.sides[side].metrics;assert.equal(x.pottingSuccess.coverage,'complete');assert.equal(x.pottingSuccess.value,100);assert.equal(x.breakSuccess.value,100);assert.equal(x.breakBallAverage.value,1);assert.equal(x.cleanRuns.count,side?5:4);assert.equal(x.pottedBalls.count,side?40:32);assert.equal(control.year.teams[side].metrics.pottingSuccess.coverage,'complete');assert.equal(control.year.teams[side].metrics.pottedBalls.count,x.pottedBalls.count);}
   for(const entry of Object.values(control.c.individuals)){assert.equal(entry.metrics.pottingSuccess.coverage,'complete');assert.equal(entry.metrics.pottedBalls.coverage,'complete');assert.equal(control.year.individuals[entry.owner.id].metrics.pottingSuccess.coverage,'complete');}
   const wire=JSON.parse(JSON.stringify(control.m));wire.detailedPlay.records=Object.assign({},wire.detailedPlay.records);if(wire.federalTeam)wire.federalTeam.racks=Object.assign({},wire.federalTeam.racks);assert.deepEqual(await run(m=>fcTest.calculate(m),wire),control.c,'Firebase array/object serialization must retain all canonical evidence and Team aggregation');
   if(fixture===1){for(const rack of m.federalTeam.racks){assert.equal(rack.shotIds.length,rack.shots.length);for(const id of rack.shotIds)assert.equal(m.detailedPlay.records.filter(r=>r.id===id).length,1);}assert.equal(control.c.unattributed.length,0);}
   if(fixture===1)reportCases.push({match:control.m,config:control.config,complete:true});
   if(process.env.FC_UNKNOWN_CONTROL_FILE&&fixture===1)fs.writeFileSync(process.env.FC_UNKNOWN_CONTROL_FILE,JSON.stringify({synthetic:true,scenario:'4:5 known breaks, same Singles/Team control',match:control.m,config:null},null,2));
  }
  // Count-only break must not commit partial evidence in the exact counter.
  for(const fixture of [1,2,3]){
   await setup(fixture);if(fixture===1)await select();const before=await state();await run(()=>fcTest.unknownBreak());
   assert.equal(await page.locator('#breakPotCountModal').evaluate(e=>e.classList.contains('show')),true,'Exact break must request ball numbers before committing');
   assert.deepEqual((await state()).detailedPlay.records,before.detailedPlay.records);assert.equal((await state()).isBreakShot,true);
   await run(()=>fcTest.exactBreak());assert.equal((await state()).detailedPlay.tableKnown,true);await page.locator('#actionBreakRunBtn').click();let x=(await metrics())[0];assert.equal(x.pottingSuccess.denominator,8);assert.equal(x.pottingSuccess.coverage,'complete');assert.equal((await state()).stats[0].breakAndRun,1);
  }
  // Resumed unknown tables must never award a rack or invent attempts; all three actions.
  for(const action of ['quick','clean','runout']){
   await setup(1);await select();await run(action=>{if(action==='clean')fcTest.cleanBreak();else actionDryBreak();fcTest.match.detailedPlay.tableKnown=false;fcTest.render();},action);
   const before=await state();const button=action==='quick'?'#quickRunoutBtn':action==='clean'?'#actionBreakRunBtn':'#actionRunoutBtn';
   if(action==='quick')assert.match(await page.locator(button).innerText(),/DOPLNIT STAV/);
   await page.locator(button).click();assert.equal(await page.locator('#detailedTableCorrectionModal').evaluate(e=>e.classList.contains('show')),true,'Unknown table opens explicit correction before any completion');
   let m=await state();assert.deepEqual(m.scores,[0,0]);assert.deepEqual(m.detailedPlay.records,before.detailedPlay.records);assert.deepEqual(m.stats,before.stats);
   await page.locator('#detailedTableCorrectionModal .modal-actions button').last().click();await run(()=>fcTest.save());const id=m.id;await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});assert.equal((await state()).id,id);assert.equal((await state()).detailedPlay.tableKnown,false);
   await page.locator(button).click();await page.locator('#detailedTableCorrectionModal .modal-actions button').first().click(); // explicit confirmation of listed remaining balls; no historic attempts filled
   assert.equal((await state()).detailedPlay.tableKnown,true);await page.locator(button).click();m=await state();assert.deepEqual(m.scores,action==='clean'?[1,0]:[0,1]);
   const pot=m.detailedPlay.records.filter(r=>r.kind==='pot').at(-1);assert.equal(pot.entry,'sequential_batch');assert.equal(pot.pottingAttempts,pot.balls.length);assert.equal(pot.actor.id,m.federalTeam.racks[0].players[pot.side].id);
   if(action==='runout')reportCases.push(await run(()=>{const m=JSON.parse(JSON.stringify(fcTest.match));m.endedAt=new Date().toISOString();m.status='complete';return {match:m,config:JSON.parse(JSON.stringify(fcTest.data.federalCup2026)),complete:false};}));
   const x=(await metrics())[pot.side];assert.equal(x.pottingSuccess.coverage,'partial');assert.ok(x.pottingSuccess.reasons.includes('unassigned_correction'),'Past unknown history must remain incomplete');
   await run(()=>fcTest.undo());assert.deepEqual((await state()).scores,[0,0]);await run(()=>fcTest.undo());assert.equal((await state()).detailedPlay.tableKnown,false);
  }
  if(process.env.FC_UNKNOWN_REPORT_CASES_FILE)fs.writeFileSync(process.env.FC_UNKNOWN_REPORT_CASES_FILE,JSON.stringify(reportCases,null,2));
  assert.deepEqual(errors,[]);console.log('PASS exact break requires IDs before commit; unknown quick/clean/runout correction/cancel/undo/reload/Team actor; safe inferred MISS gets one attempt per ball; isolated network only');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
