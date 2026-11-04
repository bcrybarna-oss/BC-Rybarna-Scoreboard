'use strict';
// Browser-only geometry acceptance test. Completely isolated: all real app scripts removed
// so no Auth, persistence, Firebase, remote requests or production writes can occur.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');

async function show(page,mode){
 await page.setContent(html,{waitUntil:'domcontentloaded'});
 await page.evaluate(mode=>{
  document.body.classList.add('modern-test');
  document.querySelectorAll('.screen.active').forEach(e=>e.classList.remove('active'));
  document.getElementById('screen-match').classList.add('active');
  const show=id=>document.getElementById(id).classList.remove('hidden');
  const hide=id=>document.getElementById(id).classList.add('hidden');
  for(const id of ['solo14ScoreRow','solo14StatsPanel','classic14Overview',
    'fourteenActions','ghostActions','simpleCounterActions','normalActions',
    'eightBallResultPanel','p1ScoreAdjust','p2ScoreAdjust','clockWrap','rackBallStatePanel'])hide(id);
  document.getElementById('p1Display').textContent='Jaroslav Tichý';
  document.getElementById('p2Display').textContent='Dominik Mencl';
  document.getElementById('matchMeta').textContent=mode==='classic14'?'14.1 • DO 100':'9-BALL • RACE TO 7';
  document.getElementById('turnText').textContent='Na tahu: Jaroslav Tichý';
  document.getElementById('p1Score').textContent='5';
  document.getElementById('p2Score').textContent='3';
  if(mode==='classic14'){show('classic14Overview');show('fourteenActions');}
  if(mode==='ghost'){show('ghostActions');show('ghostAceBtn');}
  if(mode==='simple'){show('simpleCounterActions');}
  if(mode==='normal'||mode==='eightball'){
    show('normalActions');
    for(const id of ['actionLegalBtn','actionFoulBtn','actionSafeBtn','actionMissBtn',
      'actionJumpBtn','actionBankBtn','actionRunoutBtn','actionBreakRunBtn'])show(id);
  }
  if(mode==='eightball'){show('eightBallResultPanel');}
  if(mode==='winner'){show('normalActions');show('winnerTablePanel');for(const id of ['actionLegalBtn','actionFoulBtn','actionSafeBtn','actionMissBtn'])show(id);}
  if(mode==='normal-clock'){show('normalActions');show('clockWrap');for(const id of ['actionLegalBtn','actionFoulBtn','actionSafeBtn','actionMissBtn','actionJumpBtn','actionBankBtn'])show(id);}
  if(mode==='normal-detailed'){
    show('normalActions');show('rackBallStatePanel');
    for(const id of ['actionLegalBtn','actionFoulBtn','actionSafeBtn','actionMissBtn','actionJumpBtn','actionBankBtn'])show(id);
    const grid=document.getElementById('rackBallStateBalls');
    grid.innerHTML=Array.from({length:10},(_,i)=>'<span class="badge">'+(i+1)+'</span>').join('');
  }
  // Keep full width name profile and bottom history but no test data.
 },mode);
}
async function measure(page,ids){
 return page.evaluate(ids=>{
  const out={height:innerHeight,width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
  for(const id of ids){
   const e=document.getElementById(id);
   const r=e.getBoundingClientRect();
   out[id]={top:r.top,bottom:r.bottom,height:r.height,width:r.width,
    display:getComputedStyle(e).display};
  }
  out.gridColumns=getComputedStyle(document.querySelector('#normalActions .action-grid')).gridTemplateColumns.split(' ').length;
  out.endColumns=getComputedStyle(document.querySelector('#fourteenPanel .fourteen-end-grid')).gridTemplateColumns.split(' ').length;
  out.eightColumns=getComputedStyle(document.querySelector('#eightBallResultPanel .eightball-result-grid')).gridTemplateColumns.split(' ').length;
  return out;
 },ids);
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const cases=[
   ['simple',['p1Score','p2Score','simpleAddP1','simpleAddP2','simpleBreakRunBtn','simpleUndoBtn']],
   ['normal',['p1Score','p2Score','actionLegalBtn','actionFoulBtn','actionSafeBtn','actionMissBtn','undoBtn']],
   ['eightball',['p1Score','p2Score','eightBallWin0','eightBallWin1','eightBallClean0','eightBallRunout1']],
   ['ghost',['p1Score','p2Score','ghostCleanRunoutBtn','ghostBIHRunoutBtn','ghostAceBtn','ghostFailedRackBtn']],
   ['classic14',['p1Score','p2Score','ballsOnTableDisplay','addRack14','endMiss14','endSafe14','endFoul14','undo14Btn']],
   ['winner',['p1Score','p2Score','wtWaitingName','actionLegalBtn','actionFoulBtn']],
   ['normal-clock',['p1Score','p2Score','clock','clockStartStop','actionLegalBtn','actionFoulBtn','actionMissBtn']],
   ['normal-detailed',['p1Score','p2Score','rackBallStateBalls','actionLegalBtn','actionFoulBtn','actionMissBtn']]
  ];
  for(const [mode,ids] of cases){
   const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
   await show(page,mode);
   const m=await measure(page,ids);
   assert.ok(m.scrollWidth<=m.width,'horizontal overflow in '+mode+': '+JSON.stringify(m));
   for(const id of ids){
    assert.ok(m[id].height>0,mode+' missing '+id+': '+JSON.stringify(m));
    assert.ok(m[id].bottom<=m.height-5,mode+' requires scroll to '+id+': '+JSON.stringify(m));
   }
   if(mode==='normal')assert.equal(m.gridColumns,2);
   if(mode==='classic14')assert.equal(m.endColumns,3);
   if(mode==='eightball')assert.equal(m.eightColumns,2);
   console.log('PASS mobile',mode,'viewport 390x844','last',Math.round(Math.max(...ids.map(id=>m[id].bottom))));
   await page.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
