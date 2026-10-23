'use strict';
// Current production entry point; every request intercepted, no real Firebase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {taggedReference}=require('./fixtures/federal-tags.cjs');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`window.reportTest={get data(){return data},load(c,ms){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);cloudAuthenticated=false;cloudUid=null;match=null;data=defaultData();data.federalCup2026=c;data.matches=ms;document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));showScreen('federal-cup-2026');refreshFederalCupViewer();},screen:showScreen};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
function fixtures(){const ms=['team','doubles','singles'].map(type=>{const m=taggedReference(type,type);m.discipline='9-ball';m.counterMode='full';m.target=5;m.breakMode='alternate';m.startedAt='2026-10-21T09:00:00Z';m.useClock=false;m.federalCupLink.rosterParticipants=[0,1].map(side=>Array.from({length:5},(_,i)=>({id:(side?'b':'a')+(i+1),name:(side?'Boris':'Alexandra')+' '+(i+1),team:side?'b':'a',year:2026})));return m;});return ms;}
function config(ms){const c={year:2026,reportHost:'SK',teamAName:'Slovensko',teamBName:'Česko',rosterMode:'manual',participants:{},lineups:{},teamResults:{}};for(const side of [0,1]){const ps=ms[0].federalCupLink.rosterParticipants[side],key=side?'B':'A';c['roster'+key]=ps.map(p=>p.name);c['rosterParticipantIds'+key]=ps.map(p=>p.id);for(const p of ps)c.participants[p.id]={...p};}return c;}
const libDir=process.env.PDF_LIB_DIR;if(!libDir)throw Error('Set PDF_LIB_DIR to pinned html2canvas 1.4.1 and jsPDF 2.5.2');
const out=path.resolve(process.env.FC_ARTIFACT_DIR||path.join(__dirname,'../output/pdf/federal-quick91'));
const libs={'html2canvas.min.js':fs.readFileSync(path.join(libDir,'html2canvas.min.js')),'jspdf.umd.min.js':fs.readFileSync(path.join(libDir,'jspdf.umd.min.js'))};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];let writes=0,firebase=0;
 async function client(mobile=false){const c=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:mobile?{width:390,height:844}:{width:2042,height:1280},deviceScaleFactor:mobile?3:1,isMobile:mobile});
  await c.route('**/*',route=>{const q=route.request(),u=q.url();if(u==='http://fc-reports.local/')return route.fulfill({contentType:'text/html',body:html});
   const lib=Object.keys(libs).find(k=>u==='https://cdn.jsdelivr.net/npm/'+(k==='html2canvas.min.js'?'html2canvas@1.4.1/dist/':'jspdf@2.5.2/dist/')+k);if(lib)return route.fulfill({contentType:'application/javascript',body:libs[lib]});
   for(const [file,type]of [['assets/federal-report-billiards.webp','image/webp'],['assets/federal-report-pool-logo.png','image/png'],['bc-rybarna-logo.png','image/png']])if(u==='http://fc-reports.local/'+file)return route.fulfill({contentType:type,body:fs.readFileSync(path.join(__dirname,'..',file))});
   if(!['GET','HEAD'].includes(q.method()))writes++;if(/firebaseio|firebasedatabase|identitytoolkit|securetoken/.test(u))firebase++;return route.abort();});
  const p=await c.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://fc-reports.local/');await p.waitForSelector('#cloudLoginModal.show');await p.waitForFunction(()=>!!window.html2canvas&&!!window.jspdf);
  const ms=fixtures(),conf=config(ms);conf.participants.a1.name='Alexandra Žluťoučká Šťastná Černá';
  await p.evaluate(({c,ms})=>reportTest.load(c,ms),{c:conf,ms});
  await p.evaluate(()=>{window.exportCaptures=[];const render=window.html2canvas;window.realReportRenderer=render;window.html2canvas=async(root,opts)=>{const hook=opts.onclone;const canvas=await render(root,{...opts,onclone:async doc=>{await hook(doc);const s=doc.querySelector('#fcReportExportSurface .fc-report-sheet');exportCaptures.push({width:opts.width,height:opts.height,scale:opts.scale,rows:[...s.querySelectorAll('[data-report-metric]')].map(e=>[e.dataset.reportMetric,e.innerText]),logos:[...s.querySelectorAll('img')].map(i=>i.naturalWidth),flags:s.querySelectorAll('svg path').length,boxes:[...s.querySelectorAll('[data-report-metric]')].map(e=>{const r=e.getBoundingClientRect(),b=s.getBoundingClientRect();return {x:Math.ceil(r.x-b.x),y:Math.ceil(r.y-b.y),width:Math.floor(r.width),height:Math.floor(r.height)};})});}});const cap=exportCaptures.at(-1);cap.rowInk=cap.boxes.map(b=>{const a=canvas.getContext('2d').getImageData(b.x,b.y,b.width,b.height).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i]>160&&a[i+1]>160&&a[i+2]>160)n++;return n;});window.lastReportCanvas=canvas;return canvas;};});
  return {c,p};
 }
 async function download(p,format,name){const waiting=p.waitForEvent('download');await p.locator(format==='png'?'#fcReportPng':'#fcReportPdf').click();let d;try{d=await waiting;}catch(e){throw Error(format+' export: '+await p.locator('#fcReportExportStatus').innerText()+'; '+e.message);}assert.equal(await d.failure(),null);await d.saveAs(path.join(out,name+'.'+format));await p.waitForFunction(()=>!document.getElementById('fcReportPng').disabled);return fs.readFileSync(path.join(out,name+'.'+format));}
 try{
  const cases=JSON.parse(fs.readFileSync(process.env.FC_QUICK_FIXTURE_FILE||path.join(__dirname,'../tmp/quick91-cases.json'),'utf8'));
  const {c,p}=await client();
  for(const scenario of cases){
   const m=scenario.match,conf=scenario.config,type=m.federalCupLink.type;m.endedAt='2026-10-23T12:00:00Z';m.status='complete';conf.year=2026;conf.reportHost='SK';
   // Reproducible Czech/Slovak display identities, retaining every original participant ID.
   for(const side of [0,1]){const ps=m.federalCupLink.rosterParticipants[side];for(let i=0;i<ps.length;i++){const name=(side?['Matouš Vlk','Kryštof Šťastný Novotný','Bedřich Řehoř','Bohumil Dvořák','Václav Černohorský']:['Ján Meisner','Kristián Štefánik Šťastný','Ľubomír Ďuríček','Jakub Žitňanský','Michal Červený'])[i];ps[i].name=name;conf.participants[ps[i].id].name=name;conf[side?'rosterB':'rosterA'][i]=name;}for(const person of m.federalCupLink.lineupParticipants[side])person.name=conf.participants[person.id].name;}
   await p.evaluate(({c,ms})=>reportTest.load(c,ms),{c:conf,ms:[m]});await p.locator('[data-fc-report="match"]').click();let sheet=p.locator('#fcReportContent article');
   assert.equal(await sheet.locator('[data-report-metric="pottingSuccess"] .fc-report-value').last().innerText(),'100 %');assert.equal(await sheet.locator('[data-report-metric="pottingSuccess"] .fc-report-value').first().innerText(),'0 / 0');assert.equal(await sheet.locator('[data-report-metric="pottedBalls"] .fc-report-value').last().innerText(),'9');assert.doesNotMatch(await sheet.innerText(),/Doloženo|\(část\)|bez pokusů/);
   if(type==='doubles'){assert.equal(await sheet.locator('.fc-report-name-line').count(),4);assert.equal(await sheet.locator('.fc-report-name-line').evaluateAll(es=>es.every(e=>getComputedStyle(e).whiteSpace==='nowrap'&&e.scrollWidth<=e.parentElement.clientWidth+1)),true);}
   await download(p,'png','A1-'+type);await download(p,'pdf','A1-'+type);await p.locator('#fcReportClose').click();
   // A2 uses the exact same formatter and does not change the official API.
   await p.locator('[data-fc-report="team"]').first().click();assert.equal(await p.locator('[data-report-metric="pottingSuccess"] .fc-report-value').last().innerText(),'100 %');await p.locator('#fcReportClose').click();
   if(type==='team'){
    const actor=m.detailedPlay.records.find(r=>r.kind==='pot').actor.id;await p.locator('[data-fc-report="player"][data-person="'+actor+'"]').click();sheet=p.locator('#fcReportContent article');assert.match(await sheet.locator('[data-report-metric="pottingSuccess"]').innerText(),/100 %/);assert.match(await sheet.locator('[data-report-metric="pottedBalls"]').innerText(),/9/);await download(p,'png','B-player');await download(p,'pdf','B-player');await p.locator('#fcReportClose').click();
   }
   // Partial values and unknown evidence remain marked, without an official bar.
   m.detailedPlay.coverage='partial';await p.evaluate(({c,ms})=>reportTest.load(c,ms),{c:conf,ms:[m]});await p.locator('[data-fc-report="match"]').click();assert.equal(await p.locator('[data-report-metric="pottingSuccess"] .fc-report-value').last().innerText(),'9 / 9*');assert.equal(await p.locator('[data-report-metric="pottedBalls"] .fc-report-value').last().innerText(),'9*');assert.equal(await p.locator('[data-report-metric="pottingSuccess"] .fc-report-track').count(),0);await p.locator('#fcReportClose').click();
  }
  await p.setViewportSize({width:390,height:844});await p.locator('[data-fc-report="team"]').first().click();assert.equal(await p.locator('[data-report-metric="pottingSuccess"] .fc-report-value').last().innerText(),'9 / 9*');assert.equal(await p.locator('#fcReportDialog').evaluate(e=>e.scrollWidth<=e.clientWidth),true);await p.keyboard.press('Escape');
  assert.equal(firebase,0);assert.equal(writes,0);assert.deepEqual(errors,[]);await c.close();console.log('PASS actual quick-action snapshots in A1 Singles/Doubles/Team, A2/B: 9 balls/9 attempts/100%, 0/0, partial*, no partial bar; whole long Czech/Slovak names, actual FullHD PNG and 16:9 PDF, mobile; no Firebase/writes/JS errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
