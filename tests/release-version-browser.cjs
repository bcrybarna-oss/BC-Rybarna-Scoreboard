'use strict';
// Current production HTML; every network request intercepted, report saved only in memory.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`
window.releaseTest={
 saved:[],legacy:{id:'old-report',appVersion:'v4.51.80 RC'},
 setup(){cloudUid='isolated-owner';currentUserRole='player';currentUserPlayerId='';cloudUserEmail='';
 reportRequest=async(id,method,report)=>{window.releaseTest.saved.push(JSON.parse(JSON.stringify(report)));};
 writeReportUserMirror=async()=>{};loadOwnReports=async()=>{};
 document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));},
 send:submitProblemReport,screen:showScreen
};
`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.releaseTest='));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({serviceWorkers:'block'});let remoteWrites=0;
  await context.route('**/*',route=>{const r=route.request();if(!['GET','HEAD'].includes(r.method()))remoteWrites++;return r.url()==='https://release-isolated.local/'?route.fulfill({contentType:'text/html',body:html}):route.abort();});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('https://release-isolated.local/');await page.locator('#cloudLoginModal.show').waitFor();await page.evaluate(()=>releaseTest.setup());
  assert.equal((await page.locator('.modern-brand-version').textContent()).trim(),'v4.51.85 RC');
  await page.evaluate(()=>releaseTest.screen('about'));assert.ok((await page.locator('#screen-about').innerText()).includes('v4.51.85 RC'));
  assert.ok((await page.locator('#groupPlayoffSeedModal').textContent()).includes('RC v4.51.85'));
  const legacy=await page.evaluate(()=>JSON.stringify(releaseTest.legacy));
  await page.evaluate(async()=>{document.getElementById('reportDescription').value='Izolované ověření verze hlášení';await releaseTest.send();});
  assert.equal(await page.evaluate(()=>releaseTest.saved.length),1);assert.equal(await page.evaluate(()=>releaseTest.saved[0].appVersion),'v4.51.85 RC');assert.equal(await page.evaluate(()=>JSON.stringify(releaseTest.legacy)),legacy);
  assert.deepEqual(errors,[]);assert.equal(remoteWrites,0);
  console.log('PASS release UI/header/about/playoff dialog and actual new report: v4.51.85 RC; 0 page errors, 0 remote writes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
