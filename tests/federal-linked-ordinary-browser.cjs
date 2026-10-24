'use strict';
// Current production entry point; every request intercepted, no real Firebase.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {taggedReference}=require('./fixtures/federal-tags.cjs');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`window.reportTest={get data(){return data},load(c,ms){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);cloudAuthenticated=false;cloudUid=null;match=null;data=defaultData();data.federalCup2026=c;data.matches=ms;document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));showScreen('federal-cup-2026');refreshFederalCupViewer();},screen:showScreen,calculate:federalCalculateMatch,pushout:federalPushoutModel};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
function fixtures(){const ms=['team','doubles','singles'].map(type=>{const m=taggedReference(type,type);m.discipline='9-ball';m.counterMode='full';m.target=5;m.breakMode='alternate';m.startedAt='2026-10-21T09:00:00Z';m.useClock=false;m.federalCupLink.rosterParticipants=[0,1].map(side=>Array.from({length:5},(_,i)=>({id:(side?'b':'a')+(i+1),name:(side?'Boris':'Alexandra')+' '+(i+1),team:side?'b':'a',year:2026})));return m;});return ms;}
function config(ms){const c={year:2026,reportHost:'SK',teamAName:'Slovensko',teamBName:'Česko',rosterMode:'manual',participants:{},lineups:{},teamResults:{}};for(const side of [0,1]){const ps=ms[0].federalCupLink.rosterParticipants[side],key=side?'B':'A';c['roster'+key]=ps.map(p=>p.name);c['rosterParticipantIds'+key]=ps.map(p=>p.id);for(const p of ps)c.participants[p.id]={...p};}return c;}
const libDir=process.env.PDF_LIB_DIR;if(!libDir)throw Error('Set PDF_LIB_DIR to pinned html2canvas 1.4.1 and jsPDF 2.5.2');
const out=path.resolve(process.env.FC_ARTIFACT_DIR||path.join(__dirname,'../output/pdf/federal-linked-96'));
const libs={'html2canvas.min.js':fs.readFileSync(path.join(libDir,'html2canvas.min.js')),'jspdf.umd.min.js':fs.readFileSync(path.join(libDir,'jspdf.umd.min.js'))};
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true}),errors=[];let writes=0,firebase=0;
 async function client(mobile=false){const c=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:mobile?{width:390,height:844}:{width:2042,height:1280},deviceScaleFactor:mobile?3:1,isMobile:mobile});
  await c.route('**/*',route=>{const q=route.request(),u=q.url();if(u==='http://fc-reports.local/assets/pushout-xlsx.js')return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(path.join(__dirname,'../assets/pushout-xlsx.js'))});if(u==='http://fc-reports.local/')return route.fulfill({contentType:'text/html',body:html});
   if(u.startsWith('http://fc-reports.local/assets/federal-cup/')){const file=new URL(u).pathname.slice(1);return route.fulfill({contentType:file.endsWith('.svg')?'image/svg+xml':'image/png',body:fs.readFileSync(path.join(__dirname,'..',file))});}
   const lib=Object.keys(libs).find(k=>u==='https://cdn.jsdelivr.net/npm/'+(k==='html2canvas.min.js'?'html2canvas@1.4.1/dist/':'jspdf@2.5.2/dist/')+k);if(lib)return route.fulfill({contentType:'application/javascript',body:libs[lib]});
   for(const [file,type]of [['assets/federal-report-billiards.webp','image/webp'],['assets/federal-report-pool-logo.png','image/png'],['assets/pushout-sports-logo-yellow.png','image/png'],['bc-rybarna-logo.png','image/png']])if(u==='http://fc-reports.local/'+file)return route.fulfill({contentType:type,body:fs.readFileSync(path.join(__dirname,'..',file))});
   if(!['GET','HEAD'].includes(q.method()))writes++;if(/firebaseio|firebasedatabase|identitytoolkit|securetoken/.test(u))firebase++;return route.abort();});
  const p=await c.newPage();p.setDefaultTimeout(20000);p.on('pageerror',e=>errors.push(e.message));await p.goto('http://fc-reports.local/');await p.waitForSelector('#cloudLoginModal.show');await p.waitForFunction(()=>!!window.html2canvas&&!!window.jspdf);
  const ms=fixtures(),conf=config(ms);conf.participants.a1.name='Alexandra Žluťoučká Šťastná Černá';
  await p.evaluate(({c,ms})=>reportTest.load(c,ms),{c:conf,ms});
  await p.evaluate(()=>{window.exportCaptures=[];const render=window.html2canvas;window.realReportRenderer=render;window.html2canvas=async(root,opts)=>{const hook=opts.onclone;const canvas=await render(root,{...opts,onclone:async doc=>{await hook(doc);const s=doc.querySelector('#fcReportExportSurface .fc-report-sheet');exportCaptures.push({width:opts.width,height:opts.height,scale:opts.scale,rows:[...s.querySelectorAll('[data-report-metric]')].map(e=>[e.dataset.reportMetric,e.innerText]),logos:[...s.querySelectorAll('img')].map(i=>i.naturalWidth),flags:s.querySelectorAll('svg path').length,boxes:[...s.querySelectorAll('[data-report-metric]')].map(e=>{const r=e.getBoundingClientRect(),b=s.getBoundingClientRect();return {x:Math.ceil(r.x-b.x),y:Math.ceil(r.y-b.y),width:Math.floor(r.width),height:Math.floor(r.height)};})});}});const cap=exportCaptures.at(-1);cap.rowInk=cap.boxes.map(b=>{const a=canvas.getContext('2d').getImageData(b.x,b.y,b.width,b.height).data;let n=0;for(let i=0;i<a.length;i+=4)if(a[i]>160&&a[i+1]>160&&a[i+2]>160)n++;return n;});window.lastReportCanvas=canvas;return canvas;};});
  return {c,p};
 }
 async function download(p,format,name){const waiting=p.waitForEvent('download');await p.locator(format==='png'?'#fcReportPng':'#fcReportPdf').click();let d;try{d=await waiting;}catch(e){throw Error(format+' export: '+await p.locator('#fcReportExportStatus').innerText()+'; '+e.message);}assert.equal(await d.failure(),null);await d.saveAs(path.join(out,name+'.'+format));await p.waitForFunction(()=>!document.getElementById('fcReportPng').disabled);return fs.readFileSync(path.join(out,name+'.'+format));}
 try{
  const {c,p}=await client(),crypto=require('node:crypto');
  const file=process.env.FC_RELINK_BACKUP;if(!file)throw Error('Set FC_RELINK_BACKUP to actual post-link backup');
  const original=fs.readFileSync(file),data=JSON.parse(original),m=Object.values(data.matches).find(m=>m.id==='3d4c35e6-e336-49d5-a9b3-9955cec59c3d');assert.ok(m);assert.deepEqual(m.scores,[5,3]);
  const cfg=data.federalCup2026,before=JSON.stringify(m);
  await p.evaluate(({c,m})=>reportTest.load(c,[m]),{c:cfg,m});
  const expected={breakSuccess:['100 %','25 %'],breakBallAverage:['1,8','0,3'],aces:['0','0'],ownBreakWins:['—','—'],cleanRuns:['2','0'],pottedBalls:['48','12'],pottingSuccess:['94 %','86 %'],safetySuccess:['60 %','100 %'],escapeSuccess:['100 %','33 %'],resafes:['1','0'],fouls:['0','2'],jumpShots:['0 / 0','0 / 1'],bankShots:['0 / 1','0 / 0']};
  const snapshots=[];
  for(const mode of ['desktop','mobile']){
   await p.setViewportSize(mode==='desktop'?{width:2042,height:1280}:{width:390,height:844});
   const row=p.locator('.fc26-view-match').filter({has:p.locator('[data-fc-report="match"][data-fixture="9"]')});assert.match(await row.innerText(),/5\s*:\s*3/);
   await row.screenshot({path:path.join(out,'fixture-9-'+mode+'.png')});
   await row.locator('[data-fc-report="match"]').click();const sheet=p.locator('#fcReportContent article');
   assert.equal(await sheet.locator('[data-report-metric]').count(),13);
   for(const [key,values]of Object.entries(expected))assert.deepEqual(await sheet.locator('[data-report-metric="'+key+'"] .fc-report-value').allTextContents(),values,key);
   assert.match(await sheet.innerText(),/Mark Szabo/i);assert.match(await sheet.innerText(),/Jakub Koniar/i);assert.match(await sheet.innerText(),/Tom Kurz/i);assert.match(await sheet.innerText(),/Jan Meisner/i);
   const png=await download(p,'png','A1-'+mode);assert.equal(png.readUInt32BE(16),1920);assert.equal(png.readUInt32BE(20),1080);await download(p,'pdf','A1-'+mode);
   await p.screenshot({path:path.join(out,'dialog-'+mode+'.png')});await p.locator('#fcReportClose').click();
   const waiting=p.waitForEvent('download');await row.locator('[data-fc-pushout]').click();const d=await waiting;assert.equal(await d.failure(),null);assert.match(d.suggestedFilename(),/match-9-doubles-mark-szabo-jakub-koniar-vs-tom-kurz-jan-meisner/);
   await d.saveAs(path.join(out,'Pushout-'+mode+'.xlsx'));await p.waitForFunction(()=>[...document.querySelectorAll('[data-fc-pushout]')].every(b=>!b.disabled));
   const model=await p.evaluate(m=>reportTest.pushout(m),m);assert.deepEqual(model.sheets.map(s=>s.name),['Pushout','Metadata']);
   assert.deepEqual(model.sheets[0].rows.slice(5).map(r=>r.map(c=>c.value)),[['Pot percentage',.94,.86],['Missed pots',3,2],['Fouls',0,2],['Successful breaks',4,1],['Dry/soft breaks',0,3],['Foul breaks',0,0],['Break and runs',2,0],['Break and win','—','—'],['Break and lose','—','—']]);
   assert.equal(await p.evaluate(()=>JSON.stringify(reportTest.data.matches[0])),before);snapshots.push({mode,all13Metrics:expected,pushoutRows:model.sheets[0].rows.slice(5).map(r=>r.map(c=>c.value))});
  }
  // The representation report uses the same recovered pair contributions, while
  // individual player reports must not inherit Doubles potting performance.
  await p.locator('[data-fc-report="team"]').click();assert.deepEqual(await p.locator('#fcReportContent [data-report-metric="pottedBalls"] .fc-report-value').allTextContents(),['48','12']);await p.locator('#fcReportClose').click();
  const api=await p.evaluate(m=>reportTest.calculate(m),m);assert.deepEqual(api.individuals,{});assert.equal(Object.keys(api.pairs).length,2);
  assert.deepEqual(fs.readFileSync(file),original);assert.equal(writes,0);assert.equal(firebase,0);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify({matchId:m.id,sourceSha256:crypto.createHash('sha256').update(original).digest('hex'),snapshots,writes,firebase,pageErrors:errors,sourceUnchanged:true},null,2));await c.close();
  console.log('PASS actual linked #9: all13 A1 metrics, A2 totals, correct pair ownership, desktop/mobile real PNG/PDF/XLSX, unchanged records and 0 Firebase/writes/errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
