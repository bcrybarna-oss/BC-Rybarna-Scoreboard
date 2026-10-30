'use strict';
// End-to-end synthetic camera -> canvas overlay -> MediaRecorder -> WebSocket
// -> real FFmpeg -> local FLV file. NEVER accesses Facebook or external APIs.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {createApp}=require('../server.js');

(async()=>{
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pool-live-relay-'));
  const sink=path.join(tmp,'synthetic-output.flv');
  const pwd='1234567890-abcdefghijklmnopqrstuvwxyz';
  const app=createApp({token:pwd,port:0,testSink:sink});
  await app.listen();
  let browser=null;
  try{
    browser=await chromium.launch({headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
    const context=await browser.newContext({permissions:['camera'],viewport:{width:1180,height:900}});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:'+app.server.address().port+'/');
    await page.locator('#startCamera').click();
    await page.waitForFunction(()=>document.querySelector('#camera')?.readyState>=2);
    await page.locator('#plusA').click();
    await page.locator('[data-scene="pause"]').click();
    await page.locator('[data-scene="camera"]').click();
    const capture=await page.evaluate(()=>{
      const canvas=document.querySelector('#output');
      return {enabled:typeof canvas.captureStream==='function',formats:['video/mp4','video/webm'].filter(x=>MediaRecorder.isTypeSupported(x))};
    });
    assert.equal(capture.enabled,true,'Browser must support canvas.captureStream');
    assert.ok(capture.formats.length>0,'Browser must support MediaRecorder');
    await page.locator('#adminPassword').fill(pwd);
    await page.locator('#fbServer').fill('rtmps://live-api-s.facebook.com:443/rtmp/');
    await page.locator('#fbKey').fill('syntheticFakeNotReal12345');
    await page.locator('#startLive').click();
    await page.waitForFunction(()=>document.querySelector('#liveStatus')?.textContent.includes('Odesílám video'),{timeout:15000});
    await page.waitForTimeout(6000);
    await page.locator('#stopLive').click();
    await page.waitForFunction(()=>document.querySelector('#liveStatus')?.textContent.includes('Odesílání ukončeno'),{timeout:12000});
    await page.waitForTimeout(500);
    assert.equal(errors.length,0,'No browser JavaScript errors: '+errors.join(' | '));
    assert.ok(fs.existsSync(sink),'FFmpeg must write FLV file');
    const file=fs.readFileSync(sink);
    assert.ok(file.length>5000,'FLV should contain encoded video');
    assert.equal(file.subarray(0,3).toString(),'FLV');
    const probe=execFileSync('ffprobe',['-v','quiet','-show_entries','stream=codec_type,codec_name','-of','json',sink],{encoding:'utf8'});
    const streams=JSON.parse(probe).streams;
    assert.ok(streams.some(x=>x.codec_type==='video'&&x.codec_name==='h264'),'H.264 video required');
    assert.ok(streams.some(x=>x.codec_type==='audio'&&x.codec_name==='aac'),'AAC silent audio required');
    await context.close();
    console.log('PASS browser to FFmpeg via WebSocket: real synthetic video+canvas overlay recorded as FLV H.264/AAC ('+file.length+' bytes)');
  }finally{
    if(browser)await browser.close();
    await app.close();
    fs.rmSync(tmp,{recursive:true,force:true});
  }
})().catch(err=>{console.error(err);process.exitCode=1;});
