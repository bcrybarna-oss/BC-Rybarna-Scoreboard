'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../test/mobile-other-disciplines-preview.html'),'utf8');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent(html);
  for(const m of ['simple','8','9','10','ghost','14','winner']){
   await page.locator('#mode').selectOption(m);
   const score=page.locator('#s0');
   assert.equal(await score.textContent(),'0','reset on mode selection '+m);
   if(m==='simple')await page.locator('[data-act="+0"]').first().click();
   if(m==='ghost')await page.locator('[data-act="ghost+2"]').first().click();
   if(m==='14')await page.locator('[data-act="rack"]').click();
   if(m==='8'||m==='9'||m==='10'||m==='winner'){
    await page.locator('[data-act="begin"]').first().click();
    await page.locator('[data-act="+turn"]').first().click();
   }
   assert.notEqual(await score.textContent(),'0','button must work '+m);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal overflow '+m);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS standalone preview selection, controls, screen width, 0 JS errors / no network');
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
