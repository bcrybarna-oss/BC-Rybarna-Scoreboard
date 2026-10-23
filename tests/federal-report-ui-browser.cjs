'use strict';
// Current production entry point; every request intercepted, no real Firebase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {taggedReference}=require('./fixtures/federal-tags.cjs');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`window.reportTest={get data(){return data},load(c,ms){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);cloudAuthenticated=false;cloudUid=null;match=null;data=defaultData();data.federalCup2026=c;data.matches=ms;document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));showScreen('federal-cup-2026');refreshFederalCupViewer();},screen:showScreen};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
function fixtures(){const ms=['team','doubles','singles'].map(type=>{const m=taggedReference(type,type);m.discipline='9-ball';m.counterMode='full';m.target=5;m.breakMode='alternate';m.startedAt='2026-10-21T09:00:00Z';m.useClock=false;m.federalCupLink.rosterParticipants=[0,1].map(side=>Array.from({length:5},(_,i)=>({id:(side?'b':'a')+(i+1),name:(side?'Boris':'Alexandra')+' '+(i+1),team:side?'b':'a',year:2026})));if(type==='team')m.playerNames=['Slovensko','Česko'];if(type==='doubles')m.playerNames=['Anna + Alena','Boris + Bedřich'];return m;});return ms;}
function config(ms){const c={year:2026,reportHost:'SK',teamAName:'Slovensko',teamBName:'Česko',rosterMode:'manual',participants:{},lineups:{},teamResults:{}};for(const side of [0,1]){const ps=ms[0].federalCupLink.rosterParticipants[side],key=side?'B':'A';c['roster'+key]=ps.map(p=>p.name);c['rosterParticipantIds'+key]=ps.map(p=>p.id);for(const p of ps)c.participants[p.id]={...p};}return c;}
(async()=>{
 const out=path.resolve(process.env.FC_UI_ARTIFACT_DIR||path.join(__dirname,'../docs/screenshots'));fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true});let writes=0,firebase=0;const errors=[];
 async function client(mobile=false){const c=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:390,height:844}:{width:1440,height:1000},deviceScaleFactor:1,isMobile:mobile});
  await c.route('**/*',route=>{const q=route.request(),u=q.url();if(u==='http://fc-reports.local/')return route.fulfill({contentType:'text/html',body:html});
   for(const [file,type]of [['assets/federal-report-billiards.webp','image/webp'],['assets/federal-report-pool-logo.png','image/png'],['assets/pushout-sports-logo-yellow.png','image/png'],['bc-rybarna-logo.png','image/png'],['assets/poolcitadlo-logo.webp','image/webp']])if(u==='http://fc-reports.local/'+file)return route.fulfill({contentType:type,body:fs.readFileSync(path.join(__dirname,'..',file))});
   if(!['GET','HEAD'].includes(q.method()))writes++;if(/firebaseio|firebasedatabase|identitytoolkit|securetoken/.test(u))firebase++;return route.abort();});
  const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://fc-reports.local/');await p.waitForSelector('#cloudLoginModal.show');const ms=fixtures();await p.evaluate(({c,ms})=>reportTest.load(c,ms),{c:config(ms),ms});return {c,p};
 }
 async function scroll(p,selector){await p.locator(selector).evaluate(e=>window.scrollTo(0,Math.max(0,e.getBoundingClientRect().top+scrollY-90)));}
 async function shot(p,name){await p.screenshot({path:path.join(out,name+'.png')});}
 try{const {c,p}=await client();
  const snapshot=p=>p.evaluate(()=>JSON.stringify({data:reportTest.data,storage:{...localStorage}}));const before=await snapshot(p);
  async function controls(p){
   const root=p.locator('#screen-federal-cup-2026');
   assert.equal(await root.locator('[data-fc26-view-match],#fc26ViewerStats,.fc26-stat-table').count(),0);
   assert.doesNotMatch(await root.innerText(),/DETAILNÍ STATISTIKY ZÁPASU|Statistiky obou týmů|Ruční Team výsledky obsahují pouze skóre/);
   assert.equal(await p.locator('#fc26ViewerSchedule').evaluate(e=>e.nextElementSibling.textContent.trim()==='Soupisky týmů'&&e.nextElementSibling.nextElementSibling.id==='fc26ViewerRosters'),true);
   assert.equal(await p.locator('#fc26ViewerSchedule .fc26-view-match').evaluateAll(es=>es.every((e,i)=>{const bs=e.querySelectorAll('button');return bs.length===(i<3?1:0)&&Array.from(bs).every(b=>b.textContent==='STATISTIKY ZÁPASU'&&b.dataset.fcReport==='match');})),true);
   assert.equal(await p.locator('[data-fc-report]').evaluateAll(es=>es.every(e=>e.closest('#screen-federal-cup-2026')&&e.getBoundingClientRect().height>=44)),true);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true);
  }
  await controls(p);assert.equal(await p.locator('[data-fc-report="match"]').count(),3);assert.equal(await p.locator('[data-fc-report="player"]').count(),10);assert.equal(await p.locator('[data-fc-report="team"]').count(),2);
  await p.screenshot({path:path.join(out,'federal-ui-desktop-overview.png'),fullPage:true});
  const edges=await p.locator('#fc26ViewerRosters .fc26-view-roster').first().locator('[data-fc-report]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().right));assert.ok(Math.max(...edges)-Math.min(...edges)<1);
  await scroll(p,'#screen-federal-cup-2026 .fc26-view-head');await shot(p,'federal-ui-desktop-teams');
  await scroll(p,'#fc26ViewerSchedule');await shot(p,'federal-ui-desktop-matches');
  await scroll(p,'#fc26ViewerRosters');await shot(p,'federal-ui-desktop-players');
  await p.locator('[data-fc-report="match"][data-fixture="3"]').click();await p.locator('#fcReportContent article img').evaluateAll(es=>Promise.all(es.map(i=>i.decode())));await shot(p,'federal-ui-desktop-dialog');
  // Native modal may yield focus to browser chrome (body active), never to underlying page controls.
  for(let i=0;i<8;i++){await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement===document.body||!!document.activeElement.closest('#fcReportDialog')),true);}
  await p.locator('#fcReportContent details summary').click();assert.equal(await p.locator('#fcReportContent details dt').count(),13);assert.match(await p.locator('.fc-report-context').innerText(),/ID zápasu singles/);assert.doesNotMatch(await p.locator('#fcReportContent article').innerText(),/kanonick|API 13|ID zápasu/);await p.locator('#fcReportClose').click();assert.equal(await p.locator('[data-fc-report="match"][data-fixture="3"]').evaluate(e=>e===document.activeElement),true);
  assert.equal(await p.locator('[data-fc-report="match"][data-fixture="4"]').count(),0);assert.equal(await snapshot(p),before);
  const mobile=await client(true);const mbefore=await snapshot(mobile.p);await controls(mobile.p);await mobile.p.screenshot({path:path.join(out,'federal-ui-mobile-entries.png'),fullPage:true});
  for(const [s,n]of [['#fc26ViewerScoreboard','teams'],['#fc26ViewerSchedule','matches'],['#fc26ViewerRosters','players']]){await scroll(mobile.p,s);await shot(mobile.p,'federal-ui-mobile-'+n);}
  await mobile.p.locator('[data-fc-report="player"][data-person="a1"]').click();await mobile.p.locator('#fcReportContent article img').evaluateAll(es=>Promise.all(es.map(i=>i.decode())));await shot(mobile.p,'federal-ui-mobile-dialog');
  await mobile.p.locator('#fcReportZoom').click();assert.equal(await mobile.p.locator('#fcReportZoom').innerText(),'ZMENŠIT NÁHLED');const viewport=mobile.p.locator('.fc-report-preview-viewport');assert.equal(await viewport.evaluate(e=>e.scrollWidth>e.clientWidth),true);await viewport.evaluate(e=>e.scrollLeft=600);assert.ok((await mobile.p.locator('#fcReportClose').boundingBox()).x>=0);assert.equal(await mobile.p.evaluate(()=>document.getElementById('fcReportDialog').scrollWidth<=document.getElementById('fcReportDialog').clientWidth),true);await mobile.p.locator('#fcReportZoom').click();assert.equal(await viewport.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await mobile.p.locator('#fcReportContent details summary').click();assert.match(await mobile.p.locator('.fc-report-context').innerText(),/Doubles strky se osobám nepřipisují/);await mobile.p.keyboard.press('Escape');assert.equal(await mobile.p.locator('[data-fc-report="player"][data-person="a1"]').evaluate(e=>e===document.activeElement),true);assert.equal(await snapshot(mobile.p),mbefore);
  assert.equal(writes,0);assert.equal(firebase,0);assert.deepEqual(errors,[]);await mobile.c.close();await c.close();console.log('PASS 3/10/2 FC-only 44px controls/alignment, completed-only reports, removed legacy presentation, details, native focus trap/Close/Escape, mobile zoom/pan with fixed controls, immutable data/storage, actual desktop/mobile UI screenshots; 0 Firebase/writes/page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
