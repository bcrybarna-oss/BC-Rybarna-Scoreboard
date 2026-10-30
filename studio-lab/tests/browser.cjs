'use strict';

// Real Chromium test of the standalone LIVE lab. All media is synthetic.
// No account, Firebase, LiveKit, or live video stream is accessed.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.resolve(__dirname,'..','index.html'));
const output=process.env.LIVE_LAB_SCREENSHOTS || '';

(async()=>{
 const server=http.createServer((req,res)=>{
   if(req.url!=='/' && req.url!=='/index.html'){
     res.writeHead(404,{'content-type':'text/plain'});res.end('not found');return;
   }
   res.writeHead(200,{
     'content-type':'text/html; charset=utf-8',
     'cache-control':'no-store',
     'permissions-policy':'camera=(self), microphone=()'
   });
   res.end(html);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
   browser=await chromium.launch({
     headless:true,
     args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']
   });
   const context=await browser.newContext({
     viewport:{width:1280,height:900},
     permissions:['camera'],
     locale:'cs-CZ'
   });
   const page=await context.newPage();
   const errors=[], external=[];
   page.on('pageerror',error=>errors.push(String(error)));
   page.on('request',request=>{
     if(!request.url().startsWith('http://127.0.0.1:'))external.push(request.url());
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/');
   await page.locator('#startCamera').click();
   await page.waitForFunction(()=>{
     const video=document.querySelector('#cameraVideo');
     return !!video.srcObject && video.srcObject.active && video.readyState>=2;
   });
   assert.equal(await page.locator('#status').getAttribute('data-kind'),'ok');
   await page.locator('#playerLeft').fill('Jarda Tichý');
   await page.locator('#playerRight').fill('René Kulas');
   await page.locator('#leftPlus').click();
   await page.locator('#leftPlus').click();
   await page.locator('#rightPlus').click();
   assert.equal(await page.locator('#scoreLeftPreview').innerText(),'2');
   assert.equal(await page.locator('#scoreRightPreview').innerText(),'1');
   await page.locator('#colorLeft').fill('#00aacc');
   assert.equal(await page.locator('#stage').evaluate(el=>el.style.getPropertyValue('--left')),'#00aacc');
   if(output){
     fs.mkdirSync(output,{recursive:true});
     await page.locator('#stage').screenshot({path:path.join(output,'desktop-camera.png')});
   }
   await page.locator('[data-scene-button="pause"]').click();
   assert.equal(await page.locator('#cardTitle').innerText(),'PAUZA');
   assert.equal(await page.locator('#stage').getAttribute('data-scene'),'pause');
   const pausedTrackAlive=await page.locator('#cameraVideo').evaluate(v=>v.srcObject && v.srcObject.getVideoTracks()[0].readyState==='live');
   assert.equal(pausedTrackAlive,true,'Scene switch does not stop the camera');
   if(output)await page.locator('#stage').screenshot({path:path.join(output,'desktop-pause.png')});
   await page.locator('[data-scene-button="camera"]').click();
   await page.setViewportSize({width:390,height:844});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
   assert.equal(overflow,false,'Mobile UI must have no horizontal overflow');
   if(output)await page.screenshot({path:path.join(output,'mobile-camera.png'),fullPage:true});
   await page.locator('#stopCamera').click();
   const released=await page.locator('#cameraVideo').evaluate(v=>v.srcObject===null);
   assert.equal(released,true,'Video source is detached when stopped');
   assert.deepEqual(errors,[],'No browser JavaScript errors');
   assert.deepEqual(external,[],'Lab makes no external requests');
   await context.close();

   // Dedicated denial scenario in a clean browser context
   const deniedContext=await browser.newContext({permissions:[]});
   const deniedPage=await deniedContext.newPage();
   await deniedPage.goto('http://127.0.0.1:'+server.address().port+'/');
   // Explicitly reject camera permission, not an accidental user-gesture failure.
   await deniedPage.addInitScript(()=>{
     if(navigator.mediaDevices){
       navigator.mediaDevices.getUserMedia=async()=>{throw Object.assign(new Error('denied'),{name:'NotAllowedError'});};
     }
   });
   await deniedPage.reload();
   await deniedPage.locator('#startCamera').click();
   assert.equal(await deniedPage.locator('#status').getAttribute('data-kind'),'error');
   assert.equal(await deniedPage.locator('#cameraVideo').evaluate(v=>v.srcObject),null);
   await deniedContext.close();
   console.log('PASS LIVE lab Chromium: fake camera, scoreboard, color, scene continuity, mobile 390px, safe shutdown, denied permission, zero external requests/errors');
 }finally{
   if(browser)await browser.close();
   await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
