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
 get exportData(){return pdfExportData},
};
`;
const html=original.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.pdfTest='));
(async()=>{
 const browser=await chromium.launch({channel:process.env.FC_BROWSER_CHANNEL||'chrome',headless:true});
 try{
 const context=await browser.newContext({acceptDownloads:true,serviceWorkers:'block'});let blocked=0;
 await context.route('**/*',async route=>{if(require('./helpers/federal-statistics.cjs').serve(route))return;
  const u=route.request().url();if(u==='https://pdf-isolated.local/')return route.fulfill({contentType:'text/html',body:html});
  const lib=Object.keys(libs).find(k=>u===('https://cdn.jsdelivr.net/npm/'+(k==='html2canvas.min.js'?'html2canvas@1.4.1/dist/':'jspdf@2.5.2/dist/')+k));
  if(lib)return route.fulfill({contentType:'application/javascript',body:libs[lib]});
  blocked++;return route.abort();
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  window.pdfShareCalls=0;window.pdfShareMode='success';window.pdfShareSupported=true;
  Object.defineProperty(navigator,'canShare',{value:()=>window.pdfShareSupported});
  Object.defineProperty(navigator,'share',{value:async data=>{window.pdfShareCalls++;window.sharedPdf=data.files[0];window.shareActivated=navigator.userActivation.isActive;if(window.pdfShareMode==='cancel')throw new DOMException('Canceled','AbortError');if(window.pdfShareMode==='error')throw new DOMException('Blocked','NotAllowedError');}});
  const create=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.lastPdfBlob=blob;return create(blob);};
 });
 await page.goto('https://pdf-isolated.local/');await page.waitForFunction(()=>!!window.pdfTest);
 await page.locator('#cloudLoginModal.show').waitFor(); // Finish boot before establishing the mocked session.
 await page.evaluate(m=>pdfTest.setup(m),fixture);
 async function download(selector,pattern,label){
  if(selector){await page.locator(selector).click();await page.locator('#pdfExportModal.show').waitFor();}
  const displayed=await page.locator('#pdfExportFilename').innerText();
  assert.match(displayed,pattern);
  const previousCalls=await page.evaluate(()=>pdfShareCalls);
  await page.locator('#pdfExportShare').click();await page.waitForFunction(()=>document.querySelector('#pdfExportStatus').textContent.includes('dokončeno'));
  assert.equal(await page.evaluate(()=>shareActivated),true);
  await page.evaluate(()=>pdfShareMode='cancel');await page.locator('#pdfExportShare').click();await page.waitForFunction(()=>document.querySelector('#pdfExportStatus').textContent.includes('zrušeno'));
  assert.equal(await page.locator('#pdfExportModal').isVisible(),true);
  await page.evaluate(()=>pdfShareMode='success');
  const [file]=await Promise.all([page.waitForEvent('download'),page.locator('#pdfExportSave').click()]);
  assert.match(file.suggestedFilename(),pattern);assert.equal(await file.failure(),null);
  const bytes=fs.readFileSync(await file.path());assert.ok(bytes.length>1000);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const blobBytes=await page.evaluate(async()=>Array.from(new Uint8Array(await lastPdfBlob.arrayBuffer())));assert.ok(bytes.equals(Buffer.from(blobBytes)),'Downloaded bytes equal original generated PDF');
  const shared=await page.evaluate(async()=>({name:sharedPdf.name,type:sharedPdf.type,bytes:Array.from(new Uint8Array(await sharedPdf.arrayBuffer()))}));
  assert.equal(shared.name,file.suggestedFilename());assert.equal(shared.type,'application/pdf');assert.ok(bytes.equals(Buffer.from(shared.bytes)));assert.equal(file.suggestedFilename(),displayed);
  assert.equal(await page.evaluate(()=>pdfShareCalls),previousCalls+2);assert.match(bytes.toString('latin1'),/\/Type\s*\/Page\b/);assert.equal(await page.locator('#pdfExportModal').isVisible(),true);
  if(process.env.PDF_OUTPUT_DIR){fs.mkdirSync(process.env.PDF_OUTPUT_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.PDF_OUTPUT_DIR,label+'.pdf'),bytes);}
  console.log('PASS '+label+': share/cancel/download, identical bytes/name '+file.suggestedFilename()+' ('+bytes.length+' bytes)');
  return bytes;
 }
 const safe=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,80)||'report';
 const expected='BC_Rybarna_'+new Date(fixture.startedAt).toISOString().slice(0,10)+'_'+safe(fixture.discipline)+'_'+safe(fixture.playerNames[0])+'.pdf';
 assert.equal(await page.locator('#historyList [onclick^="generateSavedMatchPdf"]').innerText(),'EXPORT PDF');
 const historyBytes=await download('#historyList [onclick^="generateSavedMatchPdf"]',/^BC_Rybarna_.*\.pdf$/,'history');
 const repeated=await download(null,/^BC_Rybarna_.*\.pdf$/,'history-repeat');assert.ok(historyBytes.equals(repeated));
 await page.locator('#pdfExportClose').click();assert.equal(await page.locator('#pdfExportModal').isVisible(),false);
 assert.equal(await page.evaluate(()=>document.querySelector('a[download]')===null),true);
 await page.evaluate(()=>pdfTest.details());await download('#matchStatsPdf',new RegExp('^'+expected.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'),'match-detail');await page.locator('#pdfExportClose').click();
 await page.evaluate(()=>pdfTest.club());await download('#statsPdfBtn',/^Poolcitadlo_statistiky_\d{4}-\d{2}-\d{2}\.pdf$/,'statistics');await page.locator('#pdfExportClose').click();
 await page.evaluate(()=>pdfTest.personal());await download('#myStatsPdfBtn',/^Poolcitadlo_moje_statistiky_Dominik_Test_\d{4}-\d{2}-\d{2}\.pdf$/,'my-statistics');
 await page.evaluate(()=>pdfShareMode='error');await page.locator('#pdfExportShare').click();await page.waitForFunction(()=>document.querySelector('#pdfExportStatus').textContent.includes('nepodařilo'));
 assert.equal(await page.locator('#pdfExportSave').isEnabled(),true);await page.locator('#pdfExportClose').click();
 await page.evaluate(()=>pdfShareSupported=false);await page.locator('#myStatsPdfBtn').click();await page.locator('#pdfExportModal.show').waitFor();assert.equal(await page.locator('#pdfExportShare').isEnabled(),false);assert.match(await page.locator('#pdfExportSupport').innerText(),/nepodporuje/);
 const [unsupportedDownload]=await Promise.all([page.waitForEvent('download'),page.locator('#pdfExportSave').click()]);assert.equal(await unsupportedDownload.failure(),null);assert.equal(await page.locator('#pdfExportModal').isVisible(),true);
 const session=await context.newCDPSession(page),target=await session.send('Target.getTargetInfo');
 const behavior={browserContextId:target.targetInfo.browserContextId,eventsEnabled:true};
 await session.send('Browser.setDownloadBehavior',{...behavior,behavior:'deny'});
 const [canceled]=await Promise.all([page.waitForEvent('download'),page.locator('#pdfExportSave').click()]);assert.equal(await canceled.failure(),'canceled');assert.equal(await page.locator('#pdfExportModal').isVisible(),true);
 await session.send('Browser.setDownloadBehavior',{...behavior,behavior:'allowAndName',downloadPath:path.dirname(await unsupportedDownload.path())});
 const [retry]=await Promise.all([page.waitForEvent('download'),page.locator('#pdfExportSave').click()]);assert.equal(await retry.failure(),null);assert.ok(fs.readFileSync(await retry.path()).equals(fs.readFileSync(await unsupportedDownload.path())));await session.detach();
 console.log('PASS canceled browser download leaves dialog open; retry downloads identical bytes');
 if(process.env.PDF_OUTPUT_DIR)await page.screenshot({path:path.join(process.env.PDF_OUTPUT_DIR,'export-dialog.png')});
 await page.locator('#pdfExportClose').press('Escape');assert.equal(await page.locator('#pdfExportModal').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS all 4 exports; real downloads + mocked share success/cancel/error; repeat identical PDF, unsupported sharing, Close/Escape; 0 page errors; other network blocked ('+blocked+')');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
