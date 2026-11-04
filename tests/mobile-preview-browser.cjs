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
  // JUMP/BANK only tag the next shot. Both are mutually exclusive and neither
  // may change the player, score or number of played racks.
  for(const discipline of ['8','9','10','winner']){
   await page.locator('#mode').selectOption(discipline);
   await page.locator('[data-act="begin"]').first().click();
   const beforeTurn=await page.locator('#turn').textContent();
   const before0=await page.locator('#s0').textContent();
   const before1=await page.locator('#s1').textContent();
   const jump=page.locator('[data-act="tag-jump"]'),bank=page.locator('[data-act="tag-bank"]');
   await jump.click();
   assert.equal(await page.locator('[data-act="tag-jump"]').getAttribute('aria-pressed'),'true',discipline+' jump selected');
   assert.equal(await page.locator('#turn').textContent(),beforeTurn,discipline+' jump must not change player');
   assert.equal(await page.locator('#s0').textContent(),before0,discipline+' jump must not score');
   assert.equal(await page.locator('#s1').textContent(),before1,discipline+' jump must not score opponent');
   await page.locator('[data-act="tag-jump"]').click();
   assert.equal(await page.locator('[data-act="tag-jump"]').getAttribute('aria-pressed'),'false',discipline+' jump toggles off');
   await page.locator('[data-act="tag-jump"]').click();
   await page.locator('[data-act="tag-bank"]').click();
   assert.equal(await page.locator('[data-act="tag-jump"]').getAttribute('aria-pressed'),'false',discipline+' selecting bank clears jump');
   assert.equal(await page.locator('[data-act="tag-bank"]').getAttribute('aria-pressed'),'true',discipline+' bank selected');
   assert.equal(await page.locator('#turn').textContent(),beforeTurn,discipline+' bank must not change player');
   await page.locator('#undoTop').click();
   assert.equal(await page.locator('[data-act="tag-jump"]').getAttribute('aria-pressed'),'true',discipline+' undo restores jump tag');
   assert.equal(await page.locator('[data-act="tag-bank"]').getAttribute('aria-pressed'),'false',discipline+' undo removes bank');
   assert.equal(await page.locator('#turn').textContent(),beforeTurn,discipline+' undo of tag keeps player');
  }
  await page.locator('#mode').selectOption('14');
  const legal=page.locator('[data-act="break14ok"]');
  const openingFoul=page.locator('[data-act="foul2"]');
  assert.equal(await openingFoul.count(),1,'initial −2 foul is offered before opening');
  await legal.click();
  assert.equal(await openingFoul.count(),0,'legal opening break hides −2');
  assert.equal(await page.locator('#s0').textContent(),'0');
  await page.locator('#undoTop').click();
  assert.equal(await openingFoul.count(),1,'undo restores opening choices');
  await page.locator('[data-act="rack"]').click();
  assert.equal(await openingFoul.count(),0,'first +14 hides opening break choices');
  await page.locator('#undoTop').click();
  assert.equal(await openingFoul.count(),1,'undo after +14 restores opening choices');
  await openingFoul.click();
  assert.equal(await page.locator('#s0').textContent(),'-2');
  assert.equal(await openingFoul.count(),0,'−2 opening foul is offered only once');
  assert.deepEqual(errors,[]);

  const soloHtml=fs.readFileSync(path.join(__dirname,'../test/solo14-mobile-compact-preview.html'),'utf8');
  const solo=await browser.newPage({viewport:{width:390,height:844}});
  const soloErrors=[];solo.on('pageerror',e=>soloErrors.push(e.message));
  await solo.setContent(soloHtml);
  assert.equal(await solo.locator('#breakFoul').isVisible(),true);
  await solo.locator('#breakOk').click();
  assert.equal(await solo.locator('#breakFoul').isVisible(),false,'solo legal break hides foul');
  await solo.locator('#undo').click();
  assert.equal(await solo.locator('#breakFoul').isVisible(),true,'solo UNDO restores opening');
  await solo.locator('#add').click();
  assert.equal(await solo.locator('#breakFoul').isVisible(),false,'solo +14 hides foul');
  await solo.locator('#undo').click();
  assert.equal(await solo.locator('#breakFoul').isVisible(),true,'solo +14 undo restores opening');
  await solo.locator('#breakFoul').click();
  assert.equal(await solo.locator('#breakFoul').isVisible(),false,'solo opening foul is one-shot');
  assert.equal(await solo.locator('#total').textContent(),'-2');
  assert.deepEqual(soloErrors,[]);
  await solo.close();
  console.log('PASS standalone preview selection, JUMP/BANK and 14.1 opening-break invariants, controls, screen width, 0 JS errors / no network');
  await page.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
