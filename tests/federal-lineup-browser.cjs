'use strict';
// Exercises the CURRENT index.html. All network traffic is intercepted;
// Firebase REST calls use an in-memory mock, never the production service.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {config}=require('./fixtures/federal-lineups.cjs');
const original=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const hook=`
window.fcTest={
  get match(){return match},get data(){return data},
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
     return route.fulfill({headers:{ETag:'"mock"','Access-Control-Expose-Headers':'ETag'},contentType:'application/json',body:JSON.stringify(parent[leaf]??null)});
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
 try{
  const load=async c=>{mock.appData={updatedAt:1,data:{federalCup2026:c}};return page.evaluate(c=>{fcTest.admin();fcTest.reset();fcTest.data.federalCup2026=c;fcTest.screen('federal-cup-editor');},c);};
  const fixture=n=>page.locator('#fc26Schedule .fc26-fixture').nth(n-1);
  let c=config();await load(c);assert.equal(await fixture(2).locator('button').last().isEnabled(),true);
  // Both the same and reversed pair on each representation, across all Doubles slots.
  for(const n of [4,7,9,12,14])for(const reverse of [false,true]){c=config();c.lineups[n]={a:reverse?['a2','a1']:['a1','a2'],b:reverse?['b2','b1']:['b1','b2']};await load(c);const text=await fixture(n).innerText();assert.match(text,/Slovensko:.*Stejná dvojice/);assert.match(text,/Česko:.*Stejná dvojice/);assert.equal(await fixture(n).locator('button').last().isDisabled(),true);}
  if(process.env.FC_LINEUP_SCREENSHOT_DIR){fs.mkdirSync(process.env.FC_LINEUP_SCREENSHOT_DIR,{recursive:true});await fixture(14).screenshot({path:path.join(process.env.FC_LINEUP_SCREENSHOT_DIR,'federal-lineup-both-teams.png')});}
  // A stale enabled DOM button cannot bypass fresh validation.
  await load(config());await page.evaluate(()=>{fcTest.data.federalCup2026.lineups[7]={a:['a2','a1'],b:['b2','b1']};});await fixture(7).locator('button').last().click();assert.equal(await page.evaluate(()=>fcTest.match),null);assert.equal(await page.locator('#screen-federal-cup-editor').isVisible(),true);
  // A nomination changed after setup was prepared also cannot start the old snapshot.
  await load(config());await fixture(7).locator('button').last().click();await page.evaluate(()=>{fcTest.data.federalCup2026.lineups[7]={a:['a2','a1'],b:['b2','b1']};document.getElementById('fc26LagWinner').value='0';fcTest.start();});assert.equal(await page.evaluate(()=>fcTest.match),null);
  // A different but individually legal lineup still requires a fresh preparation.
  await load(config());await fixture(6).locator('button').last().click();await page.evaluate(()=>{fcTest.data.federalCup2026.lineups[6]={a:['a2'],b:['b2']};document.getElementById('fc26LagWinner').value='0';fcTest.start();});assert.equal(await page.evaluate(()=>fcTest.match),null);
  // Real roster rename + reorder retains IDs and pair violations after a real reload.
  c=config();c.lineups[7]={a:['a2','a1'],b:['b2','b1']};await load(c);const ids=await page.evaluate(()=>fcTest.data.federalCup2026.rosterParticipantIdsA.slice());
  await page.locator('#fc26APlayer0').fill('Přejmenovaný hráč');await page.locator('#fc26BPlayer0').fill('Jiné jméno');await page.locator('#fc26SaveSettings').click();await page.waitForTimeout(500);await page.locator('#fc26APlayer0').locator('..').locator('[data-fc-move="1"]').click();await page.locator('#fc26SaveSettings').click();await page.waitForTimeout(500);
  const saved=await page.evaluate(()=>fcTest.data.federalCup2026);assert.equal(saved.rosterParticipantIdsA[1],ids[0]);assert.match(await fixture(7).innerText(),/Slovensko:.*Stejná dvojice/);assert.match(await fixture(7).innerText(),/Česko:.*Stejná dvojice/);
  assert.deepEqual(mock.appData.data.federalCup2026.rosterParticipantIdsA,saved.rosterParticipantIdsA);await page.reload();await page.waitForSelector('#cloudLoginModal.show');await page.evaluate(()=>{fcTest.admin();fcTest.screen('federal-cup-editor');});await page.locator('#fc26Refresh').click();await page.waitForFunction(()=>document.getElementById('fc26APlayer1').value==='Přejmenovaný hráč');assert.match(await fixture(7).innerText(),/Slovensko:.*Stejná dvojice/);assert.match(await fixture(7).innerText(),/Česko:.*Stejná dvojice/);
  assert.deepEqual(errors,[]);console.log('PASS both teams/all Doubles/order, stale button and changed prepared nominations, actual rename/reorder/save/reload; 0 JS errors; all requests isolated');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
