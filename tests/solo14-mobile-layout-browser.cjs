'use strict';
// Izolovaný vizuální kontrakt: bez načtení API, Firebase nebo produkčních zápisů.
// Skutečné body/tlačítka jsou z aktuálního produkčního HTML, mění se jen stav DOM.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');

async function fixture(page,{ghost=false,solo=true}={}){
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  await page.evaluate(({ghost,solo})=>{
    document.body.classList.add('modern-test');
    document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
    document.querySelector('#screen-match').classList.add('active');
    document.querySelector('#fourteenActions').classList.remove('hidden');
    document.querySelector('#fourteenPanel').classList.toggle('solo14-actions',solo);
    document.querySelector('#player2Card').classList.toggle('hidden',solo);
    document.querySelector('#p1Score').classList.toggle('hidden',solo);
    document.querySelector('#p1ScoreAdjust').classList.add('hidden');
    document.querySelector('#turnText').textContent='Sólo trénink: Jaroslav Tichý';
    document.querySelector('#p1Display').textContent='Jaroslav Tichý';
    document.querySelector('#matchMeta').textContent='14.1 • DO 100';
    document.querySelector('#solo14ScoreRow').classList.toggle('hidden',!solo);
    document.querySelector('#solo14ScoreRow').classList.toggle('ghost-enabled',ghost);
    document.querySelector('#solo14StatsPanel').classList.toggle('hidden',!solo);
    document.querySelector('#solo14GhostScoreTile').classList.toggle('hidden',!ghost);
    document.querySelector('#normalActions').classList.add('hidden');
    document.querySelector('#ghostActions').classList.add('hidden');
    document.querySelector('#simpleCounterActions').classList.add('hidden');
    document.querySelector('#p1BreakBadge').classList.remove('hidden');
  },{ghost,solo});
}
const rects=page=>page.evaluate(()=>{
  const rect=id=>{
    const el=document.querySelector(id);
    const r=el.getBoundingClientRect();
    return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height,width:r.width};
  };
  return {
    score:rect('#solo14TotalScore'),balls:rect('#solo14BallsTop'),
    addRack:rect('#addRack14'),miss:rect('#endMiss14'),
    safe:rect('#endSafe14'),foul:rect('#endFoul14'),
    undo:rect('#undo14Btn'),breakFoul:rect('#openingBreakFoul14'),
    viewport:innerHeight,scrollWidth:document.documentElement.scrollWidth,innerWidth,
    endColumns:getComputedStyle(document.querySelector('.fourteen-end-grid')).gridTemplateColumns.split(' ').length,
    utilityColumns:getComputedStyle(document.querySelector('.fourteen-utility-grid')).gridTemplateColumns.split(' ').length,
    ghostColumns:getComputedStyle(document.querySelector('#solo14ScoreRow')).gridTemplateColumns.split(' ').length,
    compactHead:getComputedStyle(document.querySelector('.theme-corner')).display,
  };
});

test('Mobile solo 14.1: score, +14, MISS, SAFE, FAUL and UNDO share a portrait screen',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    await fixture(page);
    const r=await rects(page);
    assert.equal(r.compactHead,'none','large theme header must not consume match space');
    assert.equal(r.endColumns,3,'MISS, SAFE and FAUL must share one row');
    assert.equal(r.utilityColumns,2,'UNDO and break foul must share one row');
    assert.equal(r.ghostColumns,2,'solo without ghost has two score tiles');
    assert.ok(r.score.bottom<r.addRack.top,'score remains above actions');
    for(const id of ['addRack','miss','safe','foul','undo','breakFoul']){
      assert.ok(r[id].height>=44,id+' must be touch sized');
      assert.ok(r[id].bottom<=r.viewport-6,id+' must fit screen: '+JSON.stringify(r));
    }
    assert.ok(Math.abs(r.miss.top-r.safe.top)<1 && Math.abs(r.safe.top-r.foul.top)<1,'end buttons aligned');
    assert.ok(r.scrollWidth<=r.innerWidth,'no horizontal overflow');
  }finally{await browser.close();}
});

test('Solo against Ghost keeps all 3 score tiles on one mobile row',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await fixture(page,{ghost:true});
    const r=await rects(page);
    assert.equal(r.ghostColumns,3);
    assert.ok(r.foul.bottom<=r.viewport-6);
    assert.ok(r.scrollWidth<=r.innerWidth);
  }finally{await browser.close();}
});

test('Compact rules are inactive outside solo 14.1',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    await fixture(page,{solo:false});
    const r=await rects(page);
    assert.notEqual(r.compactHead,'none');
    assert.equal(r.endColumns,1,'ordinary 14.1 keeps its existing layout');
  }finally{await browser.close();}
});
