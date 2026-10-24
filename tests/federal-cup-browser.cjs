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
  get preparedLink(){return pendingFederalCupLink},
  get clockRunning(){return timerRunning},
  breakStats,
  start:startMatch,undo,beginRack,snapshot,restoreSnapshot,calculate:federalCalculateMatch,
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
  loadMatches:loadSecureMatches,
  report(){return federalReportData(data.matches,data.federalCup2026,2026)},
  reviewConfig(c){data.federalCup2026=c},
  saveReview:saveSecureMatch,
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
  if(!process.env.FC_FIXTURE9_ONLY){
  await setup();let m=await state();assert.ok(m.federalTeam.pending);assert.deepEqual(m.stats.map(s=>s.breaks),[0,0]);
  assert.equal(m.lagWinner,0);assert.deepEqual(m.stats.map(s=>s.lagWins),[1,0]);
  if(process.env.FC_SCREENSHOT_DIR){await page.setViewportSize({width:390,height:844});await page.locator('#fc26RackPlayers').screenshot({path:path.join(process.env.FC_SCREENSHOT_DIR,'team-rack-selection.png')});await page.setViewportSize({width:1280,height:720});}
  assert.equal(await page.locator('#setupModeChoice').isVisible(),false);
  await run(()=>{winRack(0);});assert.deepEqual((await state()).scores,[0,0]);
  // Partial selection and the active rack survive a real browser reload.
  await run(()=>fc26PickRackPlayer(0,'SK2'));await page.reload();await page.waitForSelector('#cloudLoginModal.show');
  await run(async()=>{fcTest.admin();await fcTest.resume()});m=await state();assert.equal(m.federalTeam.players[0].name,'SK2');assert.ok(m.federalTeam.pending);
  await select();m=await state();assert.deepEqual(m.stats.map(s=>s.breaks),[1,0]);
  await run(()=>{actionSoftBreak();finishBreakPotCount(0)});m=await state();assert.equal(m.turn,1);assert.equal(m.stats[0].softBreaks,1);assert.equal(m.stats[0].breakFouls,0);assert.equal(m.softBreakReturnEligibleFor,1);
  assert.ok(await page.locator('#acceptSoftBreakBtn').isVisible());assert.equal(await page.locator('#actionTwoWayBtn').isVisible(),false);
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});
  m=await state();assert.equal(m.softBreakReturnEligibleFor,1);assert.equal(m.federalTeam.players[1].name,'CZ4');
  await run(()=>acceptTableAfterSoftBreak());m=await state();assert.equal(m.turn,1);assert.equal(m.pushOutEligibleFor,null);assert.equal(m.softBreakReturnEligibleFor,null);
  await run(()=>fcTest.undo());assert.equal((await state()).softBreakReturnEligibleFor,1);
  await run(()=>returnTableAfterSoftBreak());m=await state();assert.equal(m.turn,0);assert.equal(m.pushOutEligibleFor,0);
  await run(()=>{actionPushOut();confirmPushOutBalls('none');});m=await state();assert.equal(m.pushOutDecisionFor,1);assert.equal(m.stats[0].pushOuts,1);
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});
  m=await state();assert.equal(m.pushOutDecisionFor,1);assert.equal(m.stats[0].pushOuts,1);
  await run(()=>fcTest.undo());assert.equal((await state()).pushOutEligibleFor,0);
  await run(()=>fcTest.undo());assert.equal((await state()).softBreakReturnEligibleFor,1);
  await run(()=>fcTest.undo());m=await state();assert.equal(m.isBreakShot,true);assert.equal(m.stats[0].softBreaks,0);
  await run(()=>{actionDryBreak()});m=await state();assert.equal(m.turn,1);assert.equal(m.pushOutEligibleFor,1);assert.equal(m.stats[0].dryBreaks,1);
  await run(()=>winRack(1));m=await state();assert.deepEqual(m.scores,[0,1]);assert.equal(m.breaker,1);assert.ok(m.federalTeam.pending);assert.equal(m.federalTeam.racks[0].players[0].name,'SK2');assert.equal(m.federalTeam.racks[0].stats[0].breaks,1);
  await run(()=>fcTest.undo());m=await state();assert.deepEqual(m.scores,[0,0]);assert.equal(m.federalTeam.racks.length,0);assert.equal(m.federalTeam.pending,false);
  await run(()=>winRack(1));await select('SK5','CZ1');await run(()=>{actionBreakFoul();finishBreakPotCount(0)});m=await state();assert.equal(m.stats[1].breakFouls,1);assert.equal(m.turn,0);assert.equal(m.pushOutEligibleFor,null);
  await run(()=>winRack(0));await select('SK1','CZ5');await run(()=>{actionBreakOk();toggleBreakBall(1)});await page.locator('#breakBallSelectConfirmBtn').click();m=await state();assert.equal(m.turn,0);assert.equal(m.pushOutEligibleFor,0);
  // Complete one fixture, never one fixture per rack.
  for(let i=0;i<4;i++){await run(()=>winRack(0));if(i<3)await select('SK3','CZ2');}
  m=await state();assert.deepEqual(m.scores,[5,1]);assert.equal(m.federalTeam.racks.length,6);assert.ok(m.endedAt);
  assert.equal(await run(()=>fcTest.persist()),true);
  await run(()=>renderFederalCup2026());
  assert.match(await page.locator('#fc26ViewerScoreboard').innerText(),/1/);
  await run(()=>fcTest.showStats());assert.match(await page.locator('#matchStatsBody').innerText(),/SK2 × CZ4/);
  assert.equal(await run(()=>fc26CanStartMatch(1)),false);
  const savedTeamWrites=writes.filter(w=>w.key.startsWith('/matches/')&&w.value?.federalTeam);
  assert.ok(savedTeamWrites.some(w=>w.value.federalTeam.racks.length===6));
  assert.deepEqual(await run(()=>fcTest.data.matches.filter(m=>m.federalCupLink?.fixtureNo===1).map(m=>m.id)),[m.id]);
  console.log('PASS Team selection, four breaks, soft accept/return, push out, undo, reload, rack attribution, completion');
  for(const n of [2,3]){await setup(n);m=await state();assert.equal(m.discipline,'9-ball');assert.equal(m.target,5);assert.equal(m.counterMode,'full');assert.equal(m.breakMode,'alternate');assert.equal(m.doublesMode,n===2);assert.equal(m.ghostMode,false);await run(()=>winRack(0));assert.equal((await state()).breaker,1);}
  console.log('PASS Singles/Doubles fixed setup and alternating break');
  // A completed Doubles fixture must retain its link through actual secure PUT/GET
  // and a browser reload, not just show a final score in the counter.
  await setup(2);
  for(const side of [0,1,0,1,0,1,0,0])await run(side=>winRack(side),side);
  const doubles=await state();assert.deepEqual(doubles.scores,[5,3]);assert.ok(doubles.endedAt);
  assert.equal(doubles.federalCupLink.fixtureNo,2);assert.equal(doubles.federalCupLink.type,'doubles');
  assert.equal(doubles.federalEvidence.racks.length,8);
  assert.equal(await run(()=>fcTest.persist()),true);
  const stored=writes.filter(w=>w.key==='/matches/'+doubles.id+'.json').at(-1).value;
  assert.deepEqual(stored.federalCupLink,doubles.federalCupLink);
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');
  await run(async()=>{fcTest.admin();await fcTest.loadMatches();renderFederalCup2026();fcTest.screen('federal-cup-2026')});
  const row=page.locator('.fc26-view-match').filter({has:page.locator('.fc26-view-match-type strong',{hasText:/^#2$/})});
  assert.match(await row.innerText(),/5\s*:\s*3/);assert.equal(await row.locator('button',{hasText:'STATISTIKY ZÁPASU'}).count(),1);
  const report=await run(()=>fcTest.report());assert.ok(report.selected.some(s=>s.matchId===doubles.id));
  assert.equal(report.people[doubles.federalCupLink.lineupParticipants[0][0].id].wins>=1,true);
  assert.deepEqual(report.season.fixtures.filter(f=>f.fixtureNo===2).map(f=>f.matchId),[doubles.id]);
  console.log('PASS completed Doubles 5:3: secure save, cloud GET, reload, schedule, team/participant result and report source');
  for(const n of [1,2,3]){
    if(process.env.FC_DEBUG)console.log('Controls fixture',n);
    await setup(n);if(n===1)await select();
    const before=(await state()).stats.map(s=>s.breaks);
    await page.locator('#actionBreakOkBtn').click();await run(()=>toggleBreakBall(1));await page.locator('#breakBallSelectConfirmBtn').click();
    m=await state();assert.deepEqual(m.stats.map(s=>s.breaks),before);assert.equal(m.stats[0].breakBall1,1);assert.equal(m.rackRemainingBalls.includes(1),false);assert.equal(m.turn,0);
    await run(()=>fcTest.undo());assert.equal((await state()).isBreakShot,true);
    await page.locator('#actionDryBreakBtn').click();m=await state();assert.equal(m.turn,1);assert.equal(m.stats[0].dryBreaks,1);
    await run(()=>fcTest.undo());
    await page.locator('#actionBreakFoulBtn').click();await page.locator('#breakBallSelectConfirmBtn').click();m=await state();assert.equal(m.turn,1);assert.equal(m.stats[0].breakFouls,1);assert.equal(m.stats[0].fouls,1);assert.equal(m.pushOutEligibleFor,null);
    await run(()=>fcTest.undo());
    await page.locator('#actionSoftBreakBtn').click();await run(()=>toggleBreakBall(9));await page.locator('#breakBallSelectConfirmBtn').click();m=await state();assert.equal(m.stats[0].breakFouls,0);assert.equal(m.stats[0].softBreaks,1);assert.equal(m.rackRemainingBalls.includes(9),true);assert.equal(m.pushOutEligibleFor,null);
    await page.locator('#acceptSoftBreakBtn').click();assert.equal((await state()).turn,1);assert.equal(await page.locator('#actionPushOutBtn').isVisible(),false);
    await run(()=>fcTest.undo());await page.locator('#returnTableBtn').click();m=await state();assert.equal(m.turn,0);assert.equal(m.pushOutEligibleFor,0);
    await page.locator('#actionPushOutBtn').click();await page.locator('#pushOutNoBallsBtn').click();await page.locator('#returnPushOutBtn').click();assert.equal((await state()).turn,0);
    await run(()=>fcTest.undo());await page.locator('#acceptPushOutBtn').click();assert.equal((await state()).turn,1);
  }
  console.log('PASS Team/Doubles/Singles through actual break/decision controls, spotted 9, push acceptance and return');
  await run(async()=>{fcTest.reset();const c=fcTest.data.federalCup2026;for(let n=1;n<=11;n++){
    if([1,5,10].includes(n))c.teamResults[n]={a:5,b:2,done:true};
    else fcTest.data.matches.push({id:'fixture-'+n,federalCupLink:{year:2026,fixtureNo:n},endedAt:'2026-10-19T12:00:00Z',status:'complete',scores:[5,0]});
  }renderFederalCup2026()});
  assert.equal(await run(()=>fc26CanStartMatch(12)),false);
  const editorText=await page.locator('#fc26Schedule').innerText();assert.equal((editorText.match(/5 : 2/g)||[]).length,3);
  assert.match(await page.locator('#fc26ViewerScoreboard').innerText(),/11:0/);
  console.log('PASS legacy manual Team results remain visible after 11 wins');
  await setup(3);
  await run(()=>{fcTest.data.matches=[{...fcTest.match,endedAt:'2026-10-19T12:00:00Z',status:'incomplete',scores:[1,0]}];renderFederalCup2026()});
  assert.equal(await run(()=>fc26CanStartMatch(3)),true);
  // Attempt to tamper with every hidden setting immediately before actual start.
  await run(async()=>{fcTest.reset();fcTest.data.federalCup2026.lineups[2]={a:['SK1','SK2'],b:['CZ1','CZ2']};await fc26StartFixture(2);
    for(const [id,value] of Object.entries({discipline:'14.1',counterMode:'simple',raceTo:'99',breakMode:'winner',nineBallBreakRule:'none'}))document.getElementById(id).value=value;
    for(const id of ['ghostMode','solo14','winnerTableMode','useHandicap'])document.getElementById(id).checked=true;
    document.getElementById('doublesMode').checked=false;document.getElementById('useLag').checked=false;document.getElementById('fc26LagWinner').value='0';fcTest.start()});
  m=await state();assert.equal(m.discipline,'9-ball');assert.equal(m.counterMode,'full');assert.equal(m.target,5);assert.equal(m.breakMode,'alternate');assert.equal(m.nineBallBreakRule,'kitchen');assert.equal(m.doublesMode,true);assert.equal(m.ghostMode,false);assert.equal(m.winnerTableMode,false);
  console.log('PASS incomplete fixtures do not score and start enforces Federal Cup settings');
  for(const n of [1,2,3]){
    await run(async n=>{fcTest.reset();if(n!==1)fcTest.data.federalCup2026.lineups[n]=n===2?{a:['SK1','SK2'],b:['CZ1','CZ2']}:{a:['SK3'],b:['CZ3']};await fc26StartFixture(n);document.getElementById('useLag').checked=false;document.getElementById('useClock').checked=true;},n);
    await page.locator('#fc26LagWinner').selectOption('1');
    await page.locator('#startMatch').click();
    assert.equal(await page.locator('#lagModal').isVisible(),false);
    if(n===1){assert.equal(await run(()=>fcTest.clockRunning),false);await select();}
    m=await state();assert.equal(m.breaker,1);assert.equal(m.lagWinner,1);assert.equal(m.useLag,true);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,1]);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);assert.equal(await run(()=>fcTest.clockRunning),true);
    const id=m.id;await run(n=>fc26StartFixture(n),n);assert.equal((await state()).id,id);
    await run(()=>winRack(0));assert.equal((await state()).breaker,0);
  }
  console.log('PASS lag chooses either opening side, Team waits before starting clock, existing fixture resumes');
  await run(()=>{fcTest.reset();fc26StartFixture(1);document.getElementById('streamEnabled').checked=false;fcTest.start()});
  assert.equal(await state(),null,'Federal Cup without streaming still requires the lag result before start');
  assert.equal(await page.locator('#fc26LagSetup').isVisible(),true);
  await page.locator('#fc26LagWinner').selectOption('1');await page.locator('#startMatch').click();
  await select();m=await state();assert.equal(m.lagWinner,1);assert.equal(m.breaker,1);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});
  m=await state();assert.equal(m.lagWinner,1);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,1]);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);
  await run(()=>{fcTest.reset();fc26StartFixture(1)});assert.equal(await page.locator('#fc26LagWinner').inputValue(),'','a new fixture never inherits an earlier lag result');
  console.log('PASS required pre-match lag result, no inherited default, correct side and reload without double-counting');
  for(const n of [1,2,3]){
    await run(async n=>{fcTest.reset();if(n!==1)fcTest.data.federalCup2026.lineups[n]=n===2?{a:['SK1','SK2'],b:['CZ1','CZ2']}:{a:['SK3'],b:['CZ3']};await fc26StartFixture(n);document.getElementById('streamEnabled').checked=true;document.getElementById('fc26LagWinner').value='';fcTest.start()},n);
    m=await state();const streamId=m.id;assert.equal(m.breaker,null);assert.equal(m.turn,null);assert.deepEqual(m.stats.map(s=>s.breaks),[0,0]);assert.equal(m.detailedPlay.records.length,0);
    assert.equal(await page.locator('#streamDirectorPanel').isVisible(),true);
    assert.deepEqual(await run(()=>fcTest.calculate(fcTest.match).sides.map(s=>s.metrics.breakSuccess.denominator)),[0,0]);
    await page.locator('#streamLagP2').click();m=await state();assert.equal(m.breaker,1);assert.equal(m.lagWinner,1);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,1]);
    await page.locator('#streamLagP1').click();m=await state();assert.deepEqual(m.stats.map(s=>s.lagWins),[1,0]);assert.equal(m.id,streamId);
    await page.locator('#streamLagUndo').click();if(n===1)await select();m=await state();assert.equal(m.lagWinner,1);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);
    assert.deepEqual(await run(()=>fcTest.calculate(fcTest.match).sides.map(s=>s.metrics.breakSuccess.denominator)),[0,0]);
    await run(()=>actionDryBreak());assert.equal(await page.locator('#streamLagP1').isEnabled(),false);assert.equal((await state()).detailedPlay.records.length,1);
    assert.deepEqual(await run(()=>fcTest.calculate(fcTest.match).sides.map(s=>s.metrics.breakSuccess.denominator)),[0,1]);
    await run(()=>fcTest.undo());assert.equal(await page.locator('#streamLagP1').isEnabled(),true);
    assert.deepEqual(await run(()=>fcTest.calculate(fcTest.match).sides.map(s=>s.metrics.breakSuccess.denominator)),[0,0]);
    const beforeReload=await run(()=>fcTest.calculate(fcTest.match));await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});assert.deepEqual(await run(()=>fcTest.calculate(fcTest.match)),beforeReload);assert.equal((await state()).id,streamId);
  }
  await run(()=>{document.getElementById('streamEnabled').checked=false});
  console.log('PASS streamed Federal Cup Team/Doubles/Singles: pending lag without shot/stat, correction/undo, same matchId, first break lock');
  // The setup UI must also recover from a previous Ghost session.
  await run(()=>{fcTest.reset();document.getElementById('setupGhostBtn').click();fc26StartFixture(1)});
  assert.equal(await page.locator('#setupGhostBtn').isVisible(),false);
  assert.equal(await page.locator('#startMatch').innerText(),'ZAHÁJIT ZÁPAS');
  assert.equal(await page.locator('#p1Name').isVisible(),false);
  if(process.env.FC_SCREENSHOT_DIR){await page.setViewportSize({width:390,height:844});await page.locator('#screen-setup').screenshot({path:path.join(process.env.FC_SCREENSHOT_DIR,'federal-team-setup.png')});await page.setViewportSize({width:1280,height:720});}
  // Ordinary starts keep their existing options.
  await run(()=>{fcTest.reset();fcTest.screen('home');fcTest.screen('setup');document.getElementById('p1Name').value='Outside A';document.getElementById('p2Name').value='Outside B';document.getElementById('doublesMode').checked=false;document.getElementById('discipline').value='8-ball';document.getElementById('raceTo').value='7';document.getElementById('counterMode').value='simple';document.getElementById('breakMode').value='winner';fcTest.start()});
  m=await state();assert.equal(m.discipline,'8-ball');assert.equal(m.target,7);assert.equal(m.counterMode,'simple');assert.equal(m.breakMode,'winner');assert.equal(m.federalCupLink,null);
  assert.equal(await page.locator('#fc26LagSetup').isVisible(),false);
  console.log('PASS ordinary 8-ball simple counter settings');
  for(const mode of ['10-ball','14.1','ghost','winner-table','doubles']){
    await run(mode=>{fcTest.reset();fcTest.screen('home');fcTest.screen('setup');document.getElementById('setupStandardBtn').click();
      for(const id of ['ghostMode','solo14','solo14GhostMode','winnerTableMode','doublesMode','useLag'])document.getElementById(id).checked=false;
      document.getElementById('discipline').value=['10-ball','14.1'].includes(mode)?mode:'9-ball';document.getElementById('counterMode').value='full';document.getElementById('raceTo').value=mode==='14.1'?'100':'7';
      document.getElementById('p1Name').value='Mode A';document.getElementById('p2Name').value='Mode B';document.getElementById('p3Name').value='Mode C';
      if(mode==='ghost')document.getElementById('ghostMode').checked=true;
      if(mode==='winner-table')document.getElementById('winnerTableMode').checked=true;
      if(mode==='doubles'){document.getElementById('doublesMode').checked=true;document.getElementById('p1PartnerName').value='Partner A';document.getElementById('p2PartnerName').value='Partner B'}
      fcTest.start();},mode);
    m=await state();assert.ok(m);assert.equal(m.federalCupLink,null);assert.equal(m.federalTeam,null);
    assert.equal(m.ghostMode,mode==='ghost');assert.equal(m.winnerTableMode,mode==='winner-table');assert.equal(m.doublesMode,mode==='doubles');
    if(mode==='14.1')assert.equal(m.target,100);
  }
  console.log('PASS ordinary 10-ball, 14.1, Ghost, winner-on-table and doubles starts');
  // Replay the preserved manual test case through current UI. No user preview
  // server/storage is accessed: this browser still uses its own intercepted mock.
  await run(f=>{fcTest.admin();fcTest.reset();fcTest.setMatch({...f.saved,...f.beforeManualBreaker,events:[],endedAt:null,status:'playing'});fcTest.screen('match');fcTest.render()},breakCase);
  await page.locator('#manualBreaker').click();assert.deepEqual((await state()).stats.map(s=>s.breaks),[0,1]);
  await page.locator('#fullUndoBtn').click();assert.deepEqual((await state()).stats.map(s=>s.breaks),[1,0]);
  await page.locator('#manualBreaker').click();
  async function exactBreak(button,balls){await page.locator(button).click();for(const ball of balls)await run(n=>toggleBreakBall(n),ball);await page.locator('#breakBallSelectConfirmBtn').click();}
  async function originalPlayers(index){const r=breakCase.saved.federalTeam.racks[index];await select(r.players[0].name,r.players[1].name);}
  await exactBreak('#actionBreakOkBtn',[2]);
  assert.equal(await page.locator('#manualBreaker').isVisible(),false);
  await page.locator('#quickRunoutBtn').click();
  m=await state();assert.deepEqual(m.federalTeam.racks[0].stats.map(s=>s.breaks),[0,1]);assert.equal(m.federalTeam.racks[0].stats[1].breakAndRun,1);
  await page.locator('#fullUndoBtn').click();m=await state();assert.equal(m.federalTeam.racks.length,0);assert.equal(m.stats[1].breakAndRun,0);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);
  await page.locator('#quickRunoutBtn').click();assert.equal((await state()).stats[1].breakAndRun,1);
  // Reload immediately after the corrected first rack before choosing players.
  await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});
  assert.deepEqual((await state()).stats.map(s=>s.breaks),[0,1]);
  await originalPlayers(1);await exactBreak('#actionSoftBreakBtn',[]);await page.locator('#acceptSoftBreakBtn').click();await run(()=>winRack(0));
  await originalPlayers(2);await exactBreak('#actionBreakOkBtn',[2,7,8]);await page.locator('#quickRunoutBtn').click();
  await originalPlayers(3);await page.locator('#actionDryBreakBtn').click();await page.locator('#quickRunoutBtn').click();
  await originalPlayers(4);await exactBreak('#actionBreakFoulBtn',[1]);await run(()=>winRack(1));
  await originalPlayers(5);await page.locator('#actionDryBreakBtn').click();await page.locator('#quickRunoutBtn').click();
  m=await state();assert.deepEqual(m.scores,[1,5]);assert.deepEqual(m.stats.map(s=>s.breaks),[3,3]);assert.deepEqual(m.stats.map(s=>s.breakAndRun),[0,2]);
  const metrics=await run(()=>[0,1].map(i=>{const br=fcTest.breakStats(fcTest.match,i);return {successful:br.successful,pct:br.pct,conversion:br.successful?fcTest.match.stats[i].breakAndRun/br.successful*100:null}}));
  assert.deepEqual(metrics,[{successful:0,pct:0,conversion:null},{successful:2,pct:67,conversion:100}]);
  assert.deepEqual(m.federalTeam.racks.map(r=>r.stats.map(s=>s.breaks)),[[0,1],[1,0],[0,1],[1,0],[0,1],[1,0]]);
  assert.equal(m.federalTeam.racks[0].players[1].name,'Filip Ukázkový CZ');assert.equal(m.federalTeam.racks[2].players[1].name,'Hynek Zkušební CZ');
  assert.deepEqual(m.stats.map(s=>s.breakPottedBalls),[0,5]);assert.deepEqual(m.stats.map(s=>s.breakPottedTracked),[3,3]);
  assert.equal(await run(()=>fcTest.persist()),true);
  console.log('PASS preserved six-rack case replay: corrected breaker, undo/reload, Team/player attribution, 67% break success and 100% B&R conversion');
  async function requestEscapePot(){
    await page.locator('#actionSafetyEscapeBtn').click();await page.locator('#safetyEscapeSuccessBtn').click();await page.locator('#safetyEscapeContinueBtn').click();
    assert.equal(await page.locator('#shotBallSelectModal').isVisible(),true);
  }
  for(const n of [1,2,3]){
    await setup(n);if(n===1)await select();
    await exactBreak('#actionBreakOkBtn',[2]);await page.locator('#actionSafeBtn').click();await page.locator('#safetySuccessBtn').click();
    await requestEscapePot();await page.locator('#shotBallConfirmBtn').click();
    assert.equal(await page.locator('#shotBallSelectModal').isVisible(),true,'empty pot selection is rejected');assert.equal((await state()).stats[1].safetyEscapes,0);
    await page.locator('#shotBallCancelBtn').click();m=await state();assert.equal(m.stats[1].safetyEscapes,0);assert.equal(m.rackRemainingBalls.includes(1),true);
    await requestEscapePot();await run(()=>toggleShotBallSelection(1));await page.locator('#shotBallConfirmBtn').click();
    m=await state();assert.equal(m.turn,1);assert.equal(m.rackRemainingBalls.includes(1),false);assert.equal(m.stats[1].safetyEscapes,1);assert.equal(m.stats[1].successfulSafetyEscapes,1);assert.match(m.events.at(-1).text,/spadly: 1/);
    await page.locator('#fullUndoBtn').click();m=await state();assert.equal(m.rackRemainingBalls.includes(1),true);assert.equal(m.stats[1].safetyEscapes,0);
    await requestEscapePot();await run(()=>toggleShotBallSelection(1));await page.locator('#shotBallConfirmBtn').click();
    await run(()=>fcTest.undo());m=await state();assert.equal(m.rackRemainingBalls.includes(1),true);assert.equal(m.stats[1].safetyEscapes,0);
    await requestEscapePot();await run(()=>toggleShotBallSelection(1));await page.locator('#shotBallConfirmBtn').click();
    await page.reload();await page.waitForSelector('#cloudLoginModal.show');await run(async()=>{fcTest.admin();await fcTest.resume()});
    m=await state();assert.equal(m.rackRemainingBalls.includes(1),false);assert.equal(m.stats[1].safetyEscapes,1);assert.equal(m.turn,1);
    await page.locator('#actionLegalBtn').click();assert.equal(await page.locator('#shotBallSelectButtons [aria-label="Koule 1"]').count(),0,'the next shot cannot pot the escape ball again');await page.locator('#shotBallCancelBtn').click();
    await run(()=>winRack(1));m=await state();if(n===1){assert.equal(m.federalTeam.racks[0].players[1].name,'CZ4');assert.equal(m.federalTeam.racks[0].stats[1].successfulSafetyEscapes,1)}
  }
  await setup();await select();await exactBreak('#actionBreakOkBtn',[2]);await page.locator('#actionSafeBtn').click();await page.locator('#safetySuccessBtn').click();
  await requestEscapePot();await run(()=>toggleShotBallSelection(9));await page.locator('#shotBallConfirmBtn').click();m=await state();assert.deepEqual(m.scores,[0,1]);assert.equal(m.federalTeam.racks[0].stats[1].successfulSafetyEscapes,1);assert.equal(m.stats[1].breakAndRun,0);
  await run(()=>fcTest.undo());m=await state();assert.deepEqual(m.scores,[0,0]);assert.equal(m.stats[1].successfulSafetyEscapes,0);assert.equal(m.rackRemainingBalls.includes(9),true);assert.equal(m.federalTeam.racks.length,0);
  console.log('PASS safety escape exact pot: Singles/Doubles/Team, required selection/cancel, ball removal, event/full undo, reload, next shot and winning 9');
  }
  if(process.env.FC_FIXTURE9_BACKUP){
    const {plan}=require('../scripts/plan-federal-fixture-9-link.cjs');
    const input=JSON.parse(fs.readFileSync(process.env.FC_FIXTURE9_BACKUP,'utf8')),review=plan(input);
    for(const key of Object.keys(mock))delete mock[key];
    mock.matches=Object.fromEntries(Object.values(input.matches).map(m=>[m.id,m]));
    await run(async c=>{fcTest.admin();fcTest.reviewConfig(c);await fcTest.loadMatches();fcTest.screen('federal-cup-2026');renderFederalCup2026()},input.federalCup2026);
    const row9=page.locator('.fc26-view-match').filter({has:page.locator('.fc26-view-match-type strong',{hasText:/^#9$/})});
    assert.match(await row9.innerText(),/ČEKÁ SE/);
    assert.deepEqual((await run(()=>fcTest.report())).series,[6,2]);
    await run(m=>fcTest.saveReview(m),review.after);
    await page.reload();await page.waitForSelector('#cloudLoginModal.show');
    await run(async()=>{fcTest.admin();await fcTest.loadMatches();fcTest.screen('federal-cup-2026');renderFederalCup2026()});
    const actualReport=await run(()=>fcTest.report());assert.deepEqual(actualReport.series,[7,2]);
    assert.match(await row9.innerText(),/5\s*:\s*3/);assert.doesNotMatch(await row9.innerText(),/ČEKÁ SE/);
    assert.equal(await row9.locator('[data-fc-report="match"]').getAttribute('data-match-id'),review.before.id);
    for(const side of [0,1])for(const p of review.after.federalCupLink.lineupParticipants[side])assert.ok(actualReport.people[p.id].sources.some(s=>s.matchId===review.before.id));
    const restored=await run(id=>fcTest.data.matches.find(m=>m.id===id),review.before.id);delete restored.federalCupLink;delete restored.updatedAt;
    const expected=JSON.parse(JSON.stringify(review.before));delete expected.updatedAt;assert.deepEqual(restored,expected);
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
      await page.setViewportSize(viewport);assert.equal(await row9.locator('[data-fc-report="match"]').count(),1);
      if(process.env.FC_FIXTURE9_SCREENSHOTS){fs.mkdirSync(process.env.FC_FIXTURE9_SCREENSHOTS,{recursive:true});await row9.screenshot({path:path.join(process.env.FC_FIXTURE9_SCREENSHOTS,'fixture-9-'+viewport.width+'.png')});}
      await row9.locator('[data-fc-report="match"]').click();await page.waitForSelector('#fcReportDialog[open]');
      assert.match(await page.locator('#fcReportDialog').innerText(),/ZÁPAS #9/);await page.keyboard.press('Escape');
    }
    // Mock rollback removes only the proposed association; original records stay intact.
    delete mock.matches[review.before.id].federalCupLink;
    await run(async()=>{await fcTest.loadMatches();renderFederalCup2026()});
    assert.match(await row9.innerText(),/ČEKÁ SE/);assert.deepEqual((await run(()=>fcTest.report())).series,[6,2]);
    console.log('PASS actual backup #9: missing-link reproduction; link-only mock save/reload, 7:2, A1 desktop/mobile, participant results, unchanged play and rollback');
    // The same real nomination is valid when launched through the schedule.
    await run(async c=>{fcTest.reviewConfig(c);await fc26StartFixture(9);document.getElementById('fc26LagWinner').value='0';fcTest.start()},input.federalCup2026);
    const launched=await state();assert.ok(launched,JSON.stringify(await run(()=>({prepared:fcTest.preparedLink,canStart:fc26CanStartMatch(9),toast:document.querySelector('#toast')?.textContent,screen:document.querySelector('.screen.active')?.id}))));assert.equal(launched.federalCupLink.fixtureNo,9);assert.equal(launched.nineBallBreakRule,'kitchen');assert.equal(launched.federalEvidence.fromStart,true);
    for(const side of [0,1,0,1,0,1,0,0])await run(side=>winRack(side),side);
    assert.equal(await run(()=>fcTest.persist()),true);
    await page.reload();await page.waitForSelector('#cloudLoginModal.show');
    await run(async()=>{fcTest.admin();await fcTest.loadMatches();fcTest.screen('federal-cup-2026');renderFederalCup2026()});
    assert.match(await row9.innerText(),/5\s*:\s*3/);assert.deepEqual((await run(()=>fcTest.report())).series,[7,2]);
    assert.equal(await row9.locator('[data-fc-report="match"]').getAttribute('data-match-id'),launched.id);
    console.log('PASS actual #9 nomination: new schedule launch, completion, cloud save/reload, correct team score/report identity (isolated mock only)');
  }
  assert.deepEqual(errors,[]);
  console.log('Mock requests:',external,'mock writes:',writes.length,'page errors:',errors.length);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
