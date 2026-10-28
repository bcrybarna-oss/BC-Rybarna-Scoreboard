'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});try{
 for(const missing of [false,'statistics','cloud','reports'])for(const mobile of [false,true]){
  const context=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:390,height:844}:{width:1440,height:1000}}),errors=[],requests=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());requests.push(url.pathname);if(url.origin!=='http://module-isolated.local')return route.abort();
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
   if((url.pathname==='/assets/js/federal-statistics.js'&&missing==='statistics')||(url.pathname==='/assets/js/cloud-refresh.js'&&missing==='cloud')||(url.pathname==='/assets/js/own-reports.js'&&missing==='reports'))return route.fulfill({status:404,body:'not found'});
   const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.svg')?'image/svg+xml':'image/png'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://module-isolated.local/');
  assert.equal(requests.filter(u=>u==='/assets/js/federal-statistics.js').length,1);
  if(missing){const cloud=missing==='cloud',reports=missing==='reports';assert.equal(await page.locator(reports?'#ownReportsLoadError[role=alert]':cloud?'#cloudRefreshLoadError[role=alert]':'#federalStatisticsLoadError[role=alert]').count(),1);assert.ok(errors.includes(reports?'OWN_REPORTS_MODULE_UNAVAILABLE':cloud?'CLOUD_REFRESH_MODULE_UNAVAILABLE':'FEDERAL_STATISTICS_MODULE_UNAVAILABLE'));assert.equal(await page.evaluate(name=>typeof window[name],reports?'OwnReports':cloud?'CloudRefresh':'FederalStatistics'),'undefined');}
  else{assert.deepEqual(errors,[]);assert.equal(requests.filter(u=>u==='/assets/js/cloud-refresh.js').length,1);assert.equal(await page.evaluate(()=>typeof CloudRefresh.create),'function');assert.equal(requests.filter(u=>u==='/assets/js/own-reports.js').length,1);assert.equal(await page.evaluate(()=>typeof OwnReports.create),'function');assert.equal(await page.evaluate(()=>Object.keys(FederalStatistics).length),24);assert.equal(await page.locator('#federalStatisticsLoadError,#cloudRefreshLoadError,#ownReportsLoadError').count(),0);}
  await context.close();console.log('PASS module bootstrap',mobile?'mobile':'desktop',missing?'explicit missing-module error':'one production module');
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
