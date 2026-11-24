'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');

async function geometry(locator){
 return locator.evaluate(root=>{
  const rect=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,c:r.y+r.height/2,right:r.right};};
  const rounds=[...root.querySelectorAll('[data-sko-round]')].map(round=>({
   index:Number(round.dataset.skoRound),slots:[...round.querySelectorAll('.sko-slot')].map(slot=>({
    slot:Number(slot.dataset.skoSlot),kind:slot.dataset.skoKind,text:slot.innerText,box:rect(slot.firstElementChild),
    actions:slot.querySelectorAll('button,input,select').length,scores:slot.querySelectorAll('.bracket-score,.tm-score').length
   }))
  }));
  const edges=[...root.querySelectorAll('path[data-sko-from]')].map(edge=>{
   const point=n=>{const p=edge.getPointAtLength(n).matrixTransform(edge.getScreenCTM());return {x:p.x,y:p.y};};
   return {lane:Number(edge.getAttribute('d').match(/H([\d.]+)/)[1]),from:edge.dataset.skoFrom,to:edge.dataset.skoTo,start:point(0),end:point(edge.getTotalLength())};
  });
  return {rounds,edges,viewport:innerWidth,pageWidth:document.documentElement.scrollWidth};
 });
}

function assertGeometry(g,t){
 const size=2**Math.ceil(Math.log2(t.ko.participantIds.length)),leaves=size/2;
 assert.equal(g.rounds.length,Math.log2(size));
 const lookup=new Map();
 for(const [ri,round] of g.rounds.entries()){
  assert.equal(round.index,ri);
  assert.deepEqual(round.slots.map(s=>s.slot),Array.from({length:leaves/2**ri},(_,i)=>i),'actual DOM slot order');
  for(const slot of round.slots){
   lookup.set(ri+':'+slot.slot,slot);
   assert.ok(slot.box.h>90&&slot.box.w>=200,'readable card size');
   const bye=t.ko.rounds[ri]?.byes?.find(b=>b.slot===slot.slot);
   const match=t.ko.rounds[ri]?.matches?.find(m=>m.slot===slot.slot);
   assert.equal(slot.kind,bye?'bye':match?'match':'preview');
   if(bye){assert.match(slot.text,/VOLNÝ LOS/);assert.ok(slot.text.includes(bye.playerId));assert.equal(slot.actions,0);assert.equal(slot.scores,0);assert.doesNotMatch(slot.text,/DOHRÁNO|STŮL/);}
   if(match){assert.ok(slot.text.includes(match.player1Id)&&slot.text.includes(match.player2Id),'same stored participants');}
   if(slot.kind==='preview'){assert.equal(slot.actions,0);assert.equal(slot.scores,0);assert.match(slot.text,/NÁHLED/);}
   assert.doesNotMatch(slot.text,/\bBYE\b/);
  }
  for(let i=1;i<round.slots.length;i++)assert.ok(round.slots[i].box.y>=round.slots[i-1].box.y+round.slots[i-1].box.h,'no vertical card overlap');
 }
 assert.equal(g.edges.length,size-2);
 for(const edge of g.edges){
  const [ri,slot]=edge.from.split(':').map(Number),[next,target]=edge.to.split(':').map(Number);
  assert.equal(next,ri+1);
  let order=Array.from({length:leaves/2**ri},(_,i)=>i);
  if(ri===0&&leaves===4){if(t.ko.semifinalRouting==='cross13')order=[0,2,1,3];if(t.ko.semifinalRouting==='cross14')order=[0,3,1,2];}
  assert.equal(target,Math.floor(order.indexOf(slot)/2),'edge follows the actual routing');
  const a=lookup.get(edge.from).box,b=lookup.get(edge.to).box;
  assert.ok(Math.abs(edge.start.x-a.right)<1.5&&Math.abs(edge.start.y-a.c)<1.5,'edge starts at source card centre');
  assert.ok(Math.abs(edge.end.x-b.x)<1.5&&Math.abs(edge.end.y-b.c)<1.5,'edge reaches target card centre');
 }
 if(['cross13','cross14'].includes(t.ko.semifinalRouting)&&leaves===4){
  const lanes=new Map(g.edges.filter(e=>e.from.startsWith('0:')).map(e=>[e.to,e.lane]));
  assert.equal(new Set(lanes.values()).size,2,'unrelated custom branches never share a vertical bus');
 }
 if(!['cross13','cross14'].includes(t.ko.semifinalRouting)){
  for(let ri=1;ri<g.rounds.length;ri++)for(const target of g.rounds[ri].slots){
   const a=g.rounds[ri-1].slots[target.slot*2].box,b=g.rounds[ri-1].slots[target.slot*2+1].box;
   assert.ok(Math.abs(target.box.c-(a.c+b.c)/2)<1.5,'next round centred between its actual sources');
  }
 }
 assert.ok(g.pageWidth<=g.viewport+1,'no document-level horizontal overflow');
}

async function checkSkoLayout(page,t,{out,label,fullscreen=false,baseline=false}={}){
 fs.mkdirSync(out,{recursive:true});
 const detail=page.locator('#tournamentDetailBody .sko-fixed-columns');
 if(baseline){
  await page.locator('#tournamentDetailBody .tournament-columns').last().screenshot({path:path.join(out,label+'-detail-before.png')});
  await page.evaluate(id=>openSKOBracket(id),t.id);
  await page.screenshot({path:path.join(out,label+'-before.png')});
  const texts=await page.locator('#bracketModalBody .bracket-round').first().locator('.bracket-match,.bracket-bye').allTextContents();
  fs.writeFileSync(path.join(out,label+'-before-order.json'),JSON.stringify(texts,null,2));
  const first=t.ko.rounds[0].byes.find(b=>b.slot===0);
  assert.ok(texts[0].includes(first.playerId),'slot 0 must display the stored free-pass player, not a later match');
  return;
 }
 if(!t.ko.seedSlots){assert.equal(await detail.count(),0);return;}
 assert.equal(await detail.count(),1);
 assert.equal(await page.evaluate(()=>(window.byeProbe||window.multiProbe).layoutAudit()),true,'renderers do not mutate tournament data');
 const d=await geometry(detail);assertGeometry(d,t);
 await page.evaluate(id=>openSKOBracket(id),t.id);
 const modal=page.locator('#bracketModalBody .sko-fixed-columns');
 const m=await geometry(modal);assertGeometry(m,t);
 const result={detail:d,modal:m};
 if(fullscreen){
  await page.screenshot({path:path.join(out,label+'-modal.png')});
  const toolbar=await page.locator('#bracketModal .bracket-toolbar').boundingBox();
  const scroll=modal.locator('..');
  const moved=await scroll.evaluate(el=>{el.scrollLeft=180;return el.scrollLeft;});
  if(page.viewportSize().width<800){assert.ok(moved>0);const after=await page.locator('#bracketModal .bracket-toolbar').boundingBox();assert.ok(Math.abs(after.x-toolbar.x)<1,'horizontal pan does not move toolbar');await page.screenshot({path:path.join(out,label+'-scrolled.png')});}
  await scroll.evaluate(el=>{el.scrollLeft=0;});
  await page.locator('#bracketFullscreenBtn').click();await page.waitForFunction(()=>!!document.fullscreenElement);
  result.fullscreen=await geometry(modal);assertGeometry(result.fullscreen,t);
  await page.screenshot({path:path.join(out,label+'-fullscreen.png')});
  await page.locator('#bracketFullscreenBtn').click();await page.waitForFunction(()=>!document.fullscreenElement);
 }
 await page.locator('#bracketCloseBtn').click();
 if(fullscreen)await detail.locator('..').screenshot({path:path.join(out,label+'-detail.png')});
 fs.writeFileSync(path.join(out,label+'-layout.json'),JSON.stringify(result,null,2));
}
module.exports={checkSkoLayout,assertGeometry};
