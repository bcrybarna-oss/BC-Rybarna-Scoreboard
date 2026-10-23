'use strict';
// Current production entry point; every request intercepted, no real Firebase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {taggedReference}=require('./fixtures/federal-tags.cjs');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`window.reportTest={get data(){return data},load(c,ms){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);cloudAuthenticated=false;cloudUid=null;match=null;data=defaultData();data.federalCup2026=c;data.matches=ms;document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));showScreen('federal-cup-2026');refreshFederalCupViewer();},screen:showScreen};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
function fixtures(){const ms=['team','doubles','singles'].map(type=>{const m=taggedReference(type,type);m.discipline='9-ball';m.counterMode='full';m.target=5;m.breakMode='alternate';m.startedAt='2026-10-21T09:00:00Z';m.useClock=false;m.federalCupLink.rosterParticipants=[0,1].map(side=>Array.from({length:5},(_,i)=>({id:(side?'b':'a')+(i+1),name:(side?'Boris':'Alexandra')+' '+(i+1),team:side?'b':'a',year:2026})));return m;});return ms;}
function config(ms){const c={year:2026,reportHost:'SK',teamAName:'Slovensko',teamBName:'Česko',rosterMode:'manual',participants:{},lineups:{},teamResults:{}};for(const side of [0,1]){const ps=ms[0].federalCupLink.rosterParticipants[side],key=side?'B':'A';c['roster'+key]=ps.map(p=>p.name);c['rosterParticipantIds'+key]=ps.map(p=>p.id);for(const p of ps)c.participants[p.id]={...p};}return c;}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),context=await browser.newContext({serviceWorkers:'block',viewport:{width:2042,height:1280}});let writes=0,requests=0;const errors=[];
 await context.route('**/*',route=>{if(route.request().url()==='http://fc-reports.local/')return route.fulfill({contentType:'text/html',body:html});requests++;if(!['GET','HEAD'].includes(route.request().method()))writes++;return route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
 try{
  await page.goto('http://fc-reports.local/');await page.waitForFunction(()=>!!window.reportTest);await page.waitForSelector('#cloudLoginModal.show');
  let ms=fixtures(),c=config(ms);await page.evaluate(({c,ms})=>reportTest.load(c,ms),{c,ms});
  const modal=page.locator('#fcReportDialog'),content=page.locator('#fcReportContent'),close=async()=>{await page.locator('#fcReportClose').click();await modal.waitFor({state:'hidden'});};
  const snapshot=()=>page.evaluate(()=>JSON.stringify({data:reportTest.data,storage:{...localStorage}}));
  assert.equal(await page.locator('#fc26ViewerSchedule [data-fc-report="match"]').count(),3);assert.equal(await page.locator('#fc26ViewerRosters [data-fc-report="player"]').count(),10);assert.equal(await page.locator('#fc26ViewerScoreboard [data-fc-report="team"]').count(),1);
  assert.equal(await page.locator('[data-fc-report]').evaluateAll(es=>es.every(e=>e.closest('#screen-federal-cup-2026'))),true);const before=await snapshot();
  await page.evaluate(()=>{window.reportFetchCalls=0;window.fetch=()=>{window.reportFetchCalls++;throw Error('Reports must not fetch');};});
  for(const [n,type]of [[3,'singles'],[2,'doubles'],[1,'team']]){
   const button=page.locator('[data-fc-report="match"][data-fixture="'+n+'"]');assert.equal(await button.getAttribute('data-match-id'),type);await button.click();assert.equal(await content.locator('[data-report-metric]').count(),13);assert.match(await content.innerText(),new RegExp('ZÁPAS #'+n));assert.match(await content.locator('.fc-report-context').textContent(),new RegExp('ID zápasu '+type));assert.doesNotMatch(await content.locator('article').innerText(),/kanonická|API 13|ID zápasu|VYBRANÁ REPREZENTACE/);assert.equal(await content.locator('.fc-report-score-value text:last-child').textContent(),'3 : 5');
   if(type==='doubles'){assert.deepEqual(await content.locator('.fc-report-head h2').first().locator('.fc-report-name-line').allTextContents(),['Anna','+ Alena']);assert.deepEqual(await content.locator('.fc-report-head h2').last().locator('.fc-report-name-line').allTextContents(),['Boris','+ Bedřich']);}
   if(type==='singles'&&process.env.FC_ARTIFACT_DIR){fs.mkdirSync(process.env.FC_ARTIFACT_DIR,{recursive:true});await content.locator('article').screenshot({path:path.join(process.env.FC_ARTIFACT_DIR,'match.png')});}
   await close();assert.equal(await button.evaluate(e=>e===document.activeElement),true);
  }
  assert.equal(await page.locator('[data-fc-report="match"][data-fixture="4"]').count(),0);
  await page.locator('[data-fc-report="player"][data-person="a1"]').click();assert.equal(await content.locator('[data-report-metric]').count(),13);assert.equal(await content.locator('.fc-report-card').count(),4);assert.equal(await content.locator('.fc-report-card strong').nth(1).innerText(),'3');assert.equal(await content.locator('.fc-report-card strong').nth(2).innerText(),'0 %');assert.equal((await content.locator('header').textContent()).trim(),'Alexandra 1');assert.match(await content.locator('details').textContent(),/Doubles strky se osobám nepřipisují/);
  const widths=await content.locator('.fc-report-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().width));assert.ok(Math.max(...widths)-Math.min(...widths)<1);assert.equal(await content.locator('[data-report-metric="breakBallAverage"] .fc-report-track').count(),0);assert.equal(await content.locator('[data-report-metric="pottedBalls"] .fc-report-track').count(),0);
  if(process.env.FC_ARTIFACT_DIR)await content.locator('article').screenshot({path:path.join(process.env.FC_ARTIFACT_DIR,'player.png')});await content.locator('details summary').click();assert.equal(await content.locator('details dt').count(),13);assert.equal(await content.locator('details').getAttribute('open'),'');await close();
  await page.locator('[data-fc-report="player"][data-person="a5"]').click();assert.equal(await content.locator('.fc-report-card strong').nth(1).innerText(),'1');assert.equal(await content.locator('[data-report-metric="pottedBalls"]').innerText(),'Potopené koule\n—');await close();
  await page.locator('[data-fc-report="team"]').click();assert.equal(await content.locator('[data-report-metric]').count(),13);assert.match(await content.locator('.fc-report-score-value text:last-child').textContent(),/0 : 3/);assert.equal(await content.locator('.selected h2').count(),0);
  if(process.env.FC_ARTIFACT_DIR)await content.locator('article').screenshot({path:path.join(process.env.FC_ARTIFACT_DIR,'teams.png')});await close();assert.equal(await snapshot(),before);assert.equal(await page.evaluate(()=>reportFetchCalls),0);
  // Change host without swapping source sides, colors, scores or canonical metric values.
  c.reportHost='CZ';await page.evaluate(({c,ms})=>reportTest.load(c,ms),{c,ms});await page.locator('[data-fc-report="team"]').click();assert.equal(await content.locator('.fc-report-head h2').first().textContent(),'Česko');assert.equal(await content.locator('.fc-report-score-value text:last-child').textContent(),'3 : 0');assert.equal(await content.locator('[data-report-metric="jumpShots"] .fc-report-value').first().evaluate(e=>e.style.getPropertyValue('--rep-color')),'#488edf');await close();
  // Partial, unknown, 0/0 and long names are explicit and mobile remains readable.
  c.participants.a1.name='Alexandra Velmi dlouhé jméno hráčky '.repeat(7)+'<img src=x onerror=alert(1)>';
  ms[2].detailedPlay.coverage='partial';delete ms[0].federalCupLink.rosterParticipants;
  await page.evaluate(({c,ms})=>reportTest.load(c,ms),{c,ms});await page.setViewportSize({width:390,height:844});await page.locator('[data-fc-report="player"][data-person="a1"]').click();assert.equal(await content.locator('img:not(.fc-report-pool-logo):not(.fc-report-pushout-logo):not(.fc-report-club-logo):not(.fc-report-backdrop):not(.fc-report-flag)').count(),0);assert.doesNotMatch(await content.locator('article').innerText(),/\*/);assert.doesNotMatch(await content.locator('article').innerText(),/Doloženo|\(část\)|bez pokusů/);assert.equal(await content.locator('[data-coverage="partial"]').count()>0,true);assert.equal(await content.locator('.fc-report-card strong').nth(2).innerText(),'0 %');assert.ok((await content.locator('article').boundingBox()).width<=390);assert.equal(await page.evaluate(()=>document.getElementById('fcReportDialog').scrollWidth<=document.getElementById('fcReportDialog').clientWidth),true);
  if(process.env.FC_ARTIFACT_DIR)await page.screenshot({path:path.join(process.env.FC_ARTIFACT_DIR,'player-mobile.png')});await page.keyboard.press('Escape');await modal.waitFor({state:'hidden'});
  ms=fixtures();c=config(ms);const older=JSON.parse(JSON.stringify(ms[2]));older.id='older-match';older.endedAt='2026-10-20T10:00:00Z';ms.push(older);await page.evaluate(({c,ms})=>reportTest.load(c,ms),{c,ms});
  const stable=page.locator('[data-fc-report="match"][data-fixture="3"]');assert.equal(await stable.getAttribute('data-match-id'),'singles');await stable.evaluate(e=>e.dataset.matchId='older-match');await stable.click();assert.match(await content.innerText(),/nahrazen novějším/);await close();
  await page.evaluate(c=>reportTest.load(c,[]),c);await page.locator('[data-fc-report="team"]').click();assert.equal(await content.locator('[data-coverage="unknown"]').count(),26);assert.doesNotMatch(await content.locator('article').innerText(),/Dokončený zápas|Statistiky vycházejí/);await close();await page.locator('[data-fc-report="player"][data-person="a1"]').click();assert.equal(await content.locator('.fc-report-card strong').nth(2).innerText(),'—');await close();
  c.year=2027;delete c.reportHost;await page.evaluate(c=>reportTest.load(c,[]),c);await page.locator('[data-fc-report="team"]').click();assert.match(await content.innerText(),/hostitelskou reprezentaci/);await close();
  // Availability follows the existing report selector, without changing scores or data.
  for(const variant of ['active','missing-end','draw','invalid-type','manual-only','unknown-host','after-clinch']){
   const rows=fixtures(),conf=config(rows);
   if(variant==='active')rows[2].status='active';
   if(variant==='missing-end')delete rows[2].endedAt;
   if(variant==='draw')rows[2].scores=[5,5];
   if(variant==='invalid-type')rows[2].federalCupLink.type='invalid';
   if(variant==='manual-only'){rows.length=0;conf.teamResults={1:{done:true,a:5,b:3}};}
   if(variant==='unknown-host'){conf.year=2027;delete conf.reportHost;}
   if(variant==='after-clinch'){
    rows.length=0;for(let n=1;n<=12;n++){const m=fixtures()[2];m.id='clinch-'+n;m.federalCupLink.fixtureNo=n;m.scores=[5,0];rows.push(m);}
   }
   await page.evaluate(({c,ms})=>reportTest.load(c,ms),{c:conf,ms:rows});
   assert.equal(await page.locator('[data-fc-report="match"][data-fixture="'+(variant==='manual-only'?1:variant==='after-clinch'?12:3)+'"]').count(),0,variant);
   if(variant==='after-clinch'){assert.equal(await page.locator('[data-fc-report="match"]').count(),11);assert.match(await page.locator('#fc26ViewerSchedule .fc26-view-match').nth(11).innerText(),/5 : 0/);}
  }
  // Legacy detailed statistics remain accessible through the actual History button.
  ms=fixtures();c=config(ms);await page.evaluate(({c,ms})=>reportTest.load(c,ms),{c,ms});await page.evaluate(()=>reportTest.screen('history'));
  await page.locator('#historyList [onclick^="showSavedMatchStats"]').first().click();assert.equal(await page.locator('#matchStatsModal').isVisible(),true);assert.equal(await page.locator('#matchStatsPdf').isVisible(),true);
  await page.evaluate(()=>document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show')));
  for(const screen of ['home','setup','history','players','tournament','league']){await page.evaluate(s=>reportTest.screen(s),screen);assert.equal(await page.locator('[data-fc-report]:visible').count(),0);assert.equal(await modal.isVisible(),false);}
  assert.deepEqual(errors,[]);assert.equal(writes,0);console.log('PASS all three FC-only entry points, exact match IDs, 13 metrics, Team five/Doubles two, switching, host/colors, partial/unknown, sources, long names/mobile, focus/Escape; immutable data/storage, 0 report fetches, 0 writes, 0 JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
