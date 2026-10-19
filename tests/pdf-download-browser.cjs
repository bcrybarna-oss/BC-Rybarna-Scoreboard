'use strict';
// Actual current generators + pinned real libraries; every network request is intercepted.
// PDF_LIB_DIR must contain html2canvas.min.js (1.4.1) and jspdf.umd.min.js (2.5.2).
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const original=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fixture=require('./fixtures/federal-team-breaker-correction.json').saved;
const libDir=process.env.PDF_LIB_DIR;if(!libDir)throw Error('Set PDF_LIB_DIR to pinned local PDF libraries');
const libs={'html2canvas.min.js':fs.readFileSync(path.join(libDir,'html2canvas.min.js')),'jspdf.umd.min.js':fs.readFileSync(path.join(libDir,'jspdf.umd.min.js'))};
const hook=`
window.pdfTest={
 setup(m){data=defaultData();data.matches=[m];currentUserPlayerId='pdf-player';cloudAuthenticated=true;cloudUid='pdf-local';currentUserRole='player';
 data.players['pdf-player']={id:'pdf-player',name:'Dominik Test',firstName:'Dominik',lastName:'Test'};
 document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));showScreen('history');renderHistory();},
 details(){openMatchStatsCard(data.matches[0],false)},
 club(){document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));showScreen('stats')},
 personal(){showScreen('my-stats')},
};
`;
const html=original.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.pdfTest='));
(async()=>{
 const browser=await chromium.launch({channel:process.env.FC_BROWSER_CHANNEL||'chrome',headless:true});
 try{
 const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});let blocked=0;
 await context.route('**/*',async route=>{
  const u=route.request().url();if(u==='https://pdf-isolated.local/')return route.fulfill({contentType:'text/html',body:html});
  const lib=Object.keys(libs).find(k=>u===('https://cdn.jsdelivr.net/npm/'+(k==='html2canvas.min.js'?'html2canvas@1.4.1/dist/':'jspdf@2.5.2/dist/')+k));
  if(lib)return route.fulfill({contentType:'application/javascript',body:libs[lib]});
  blocked++;return route.abort();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.pdfShareCalls=0;Object.defineProperty(navigator,'canShare',{value:()=>true});Object.defineProperty(navigator,'share',{value:async()=>{window.pdfShareCalls++;throw Error('Unexpected sharing');}});
  const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.lastPdfBlob=blob;return create(blob);};
 });
 await page.goto('https://pdf-isolated.local/');await page.waitForFunction(()=>!!window.pdfTest);
 await page.evaluate(m=>pdfTest.setup(m),fixture);
 async function download(selector,pattern,label){
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator(selector).click()]);
  assert.match(file.suggestedFilename(),pattern);assert.equal(await file.failure(),null);
  const bytes=fs.readFileSync(await file.path());assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const blobBytes=await page.evaluate(async()=>Array.from(new Uint8Array(await lastPdfBlob.arrayBuffer())));assert.ok(bytes.equals(Buffer.from(blobBytes)),'Downloaded bytes equal original generated PDF');
  assert.equal(await page.evaluate(()=>pdfShareCalls),0);assert.match(bytes.toString('latin1'),/\/Type\s*\/Page\b/);
  if(process.env.PDF_OUTPUT_DIR){fs.mkdirSync(process.env.PDF_OUTPUT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.PDF_OUTPUT_DIR,label+'.pdf'),bytes);}
  console.log('PASS '+label+': '+file.suggestedFilename()+' ('+bytes.length+' bytes)');
 }
 const safe=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'report';
 const expected='BC_Rybarna_'+new Date(fixture.startedAt).toISOString().slice(0,10)+'_'+safe(fixture.discipline)+'_'+safe(fixture.playerNames[0])+'.pdf';
 assert.equal(await page.locator('#historyList [onclick^="generateSavedMatchPdf"]').innerText(),'ULOŽIT PDF');
 await download('#historyList [onclick^="generateSavedMatchPdf"]',/^BC_Rybarna_.*\.pdf$/,'history');
 assert.equal(await page.evaluate(()=>document.querySelector('a[download]')===null),true);
 await page.evaluate(()=>pdfTest.details());await download('#matchStatsPdf',new RegExp('^'+expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'),'match-detail');
 await page.evaluate(()=>pdfTest.club());await download('#statsPdfBtn',/^Poolcitadlo_statistiky_\d{4}-\d{2}-\d{2}\.pdf$/,'statistics');
 await page.evaluate(()=>pdfTest.personal());await download('#myStatsPdfBtn',/^Poolcitadlo_moje_statistiky_Dominik_Test_\d{4}-\d{2}-\d{2}\.pdf$/,'my-statistics');
 assert.deepEqual(errors,[]);console.log('PASS 4 actual PDF downloads; no system sharing; original bytes and names; 0 page errors; all other network blocked ('+blocked+')');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
