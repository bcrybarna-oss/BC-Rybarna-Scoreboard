'use strict';
// Exercises the CURRENT index.html. All network traffic is intercepted;
// Firebase REST calls use an in-memory mock, never the production service.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const breakCase=require('./fixtures/federal-team-breaker-correction.json');
const original=process.env.FC_QUICK_SOURCE_REF?require('node:child_process').execFileSync('git',['show',process.env.FC_QUICK_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const hook=`
window.fcTest={
  get match(){return match},get data(){return data},
  get clockRunning(){return timerRunning},
  breakStats,
  start:startMatch,undo,beginRack,snapshot,restoreSnapshot,calculate:federalCalculateMatch,
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
 await context.route('**/*',async route=>{if(require('./helpers/federal-statistics.cjs').serve(route))return;
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
  const reportCases=[];
  const metrics=async side=>run(side=>fcTest.calculate(fcTest.match).sides[side].metrics,side);
  const check=async(side,n,clean=false)=>{const m=await state(),x=await metrics(side);assert.equal(x.pottingSuccess.numerator,n);assert.equal(x.pottingSuccess.denominator,n);assert.equal(x.pottingSuccess.coverage,'complete');assert.equal(x.pottingSuccess.value,100);assert.equal(x.pottedBalls.count,n);assert.deepEqual(m.scores,side===0?[1,0]:[0,1]);assert.equal(m.stats[side].runouts,clean?0:1);assert.equal(m.stats[side].breakAndRun,clean?1:0);return m;};
  if(process.env.FC_QUICK_SOURCE_REF){await setup(3);await run(()=>actionDryBreak());await page.locator('#actionRunoutBtn').click();const x=await metrics(1);assert.equal(x.pottingSuccess.coverage,'partial');assert.equal(x.pottingSuccess.denominator,0);assert.equal(x.pottedBalls.count,9);console.log('REPRODUCED on original main with SYNTHETIC data: 9 pots, 0/0 partial; reasons='+x.pottingSuccess.reasons.join(','));return;}
  // Every suffix of the rack, including a single 9, is a sequential batch.
  for(let n=1;n<=9;n++){await setup(3);await run(n=>{actionDryBreak();if(n<9)fcTest.sequential(1,Array.from({length:9-n},(_,i)=>i+1),fcTest.match.rackRemainingBalls.slice());},n);const before=await state();await page.locator('#quickRunoutBtn').click();let m=await check(1,9);const last=m.detailedPlay.records.filter(r=>r.kind==='pot').at(-1);assert.equal(last.entry,'sequential_batch');assert.equal(last.pottingAttempts,n);assert.equal(last.successfulPottingStrokes,n);assert.equal(last.potsEvidence,'explicit');await run(()=>fcTest.undo());m=await state();assert.deepEqual(m.scores,[0,0]);assert.deepEqual(m.detailedPlay.records,before.detailedPlay.records);}
  for(const fixture of [3,2,1]){
   await setup(fixture);if(fixture===1)await select();await run(()=>actionDryBreak());const before=await state();await page.locator('#actionRunoutBtn').click();let m=await check(1,9);const rec=m.detailedPlay.records.filter(r=>r.kind==='pot').at(-1);assert.equal(rec.pottingAttempts,9);assert.equal(rec.strokeCount,9);assert.equal(rec.balls.length,9);assert.equal(rec.intent,'pot');
   if(fixture===2)assert.equal(rec.actor,null);else assert.ok(rec.actor?.id);
   reportCases.push(await run(()=>({match:JSON.parse(JSON.stringify(fcTest.match)),config:JSON.parse(JSON.stringify(fcTest.data.federalCup2026))})));
   if(fixture===1){const r=await run(()=>fcTest.calculate(fcTest.match));const id=rec.actor.id;assert.equal(r.individuals[id].metrics.pottingSuccess.denominator,9);assert.equal(m.federalTeam.racks[0].players[1].id,id);}
   await run(()=>fcTest.save());const id=m.id;await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});assert.equal((await state()).id,id);assert.equal((await metrics(1)).pottingSuccess.denominator,9);await run(()=>fcTest.undo());assert.deepEqual((await state()).detailedPlay.records,before.detailedPlay.records);
  }
  await setup(3);await run(()=>{fcTest.cleanBreak();});await page.locator('#actionBreakRunBtn').click();await check(0,8,true);
  for(const reason of ['break_foul','push_out_return']){await setup(3);await run(reason=>{if(reason==='break_foul'){fcTest.foulBreak();}else{actionDryBreak();actionPushOut();confirmPushOutBalls('none');returnPushOut();}},reason);const m=await state(),side=m.turn,expected=m.rackRemainingBalls.length;await page.locator('#actionRunoutBtn').click();const result=await metrics(side);assert.equal(result.pottingSuccess.denominator,expected);assert.equal(result.pottingSuccess.numerator,expected);assert.equal((await state()).stats[side].runouts,1);assert.equal((await state()).stats[side].breakAndRun,0);}
  for(const action of ['runout','quick','clean']){await setup(3);await run(action=>{actionDryBreak();if(action==='clean'){fcTest.match.turn=0;fcTest.match.breakAndRunEligible=true;}fcTest.match.detailedPlay.tableKnown=false;fcTest.match.rackRemainingBalls=null;},action);await page.locator(action==='runout'?'#actionRunoutBtn':action==='quick'?'#quickRunoutBtn':'#actionBreakRunBtn').evaluate(e=>e.click());assert.deepEqual((await state()).scores,[0,0]);assert.equal(await page.locator('#detailedTableCorrectionModal').evaluate(e=>e.classList.contains('show')),true);assert.equal((await state()).detailedPlay.records.filter(r=>r.source==='rack_completion_unknown').length,0);}
  // Actual manual multipot is one stroke; a miss is one failed attempt, never inferred successes.
  await setup(3);await run(()=>{actionDryBreak();actionLegal();fcTest.chooseShot([1,2]);});
  if(await page.locator('#shotSequenceTogetherBtn').isVisible())await page.locator('#shotSequenceTogetherBtn').click();if(await page.locator('#higherBallComboBtn').isVisible())await page.locator('#higherBallComboBtn').click();
  let x=await metrics(1);assert.equal(x.pottedBalls.count,2);assert.equal(x.pottingSuccess.denominator,1);assert.equal(x.pottingSuccess.numerator,1);
  await run(()=>{actionMiss();selectRotationFailureBall(3);confirmRotationFailure();});x=await metrics(1);assert.equal(x.pottedBalls.count,2);assert.equal(x.pottingSuccess.denominator,2);assert.equal(x.pottingSuccess.numerator,1);assert.equal(x.pottingSuccess.value,50);assert.equal((await state()).rackRemainingBalls.length,7);
  await run(()=>actionRunout());assert.deepEqual((await state()).scores,[0,0]);assert.equal((await metrics(1)).pottedBalls.count,2);
  if(process.env.FC_QUICK_FIXTURE_FILE){fs.mkdirSync(path.dirname(process.env.FC_QUICK_FIXTURE_FILE),{recursive:true});fs.writeFileSync(process.env.FC_QUICK_FIXTURE_FILE,JSON.stringify(reportCases,null,2));}
  assert.deepEqual(errors,[]);console.log('PASS quick suffix 1–9, clean/runout eligibility/reasons, Singles/Doubles/Team actor, canonical attempts/pots, no double count, unknown table partial, undo/save/reload; every network request isolated');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
