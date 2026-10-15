'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','test-modular');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const core=fs.readFileSync(path.join(root,'assets/js/pool-core.js'),'utf8');

test('14.1 displays the potted-ball shot-clock control only with a running match using shot clock',()=>{
  assert.equal((html.match(/id="fourteenPotClockBtn"/g)||[]).length,1);
  assert.match(html,/id="fourteenPotClockBtn"[^>]*class="[^"]*hidden[^"]*"/);
  assert.match(html,/POTOPENÁ KOULE • NOVÝ ČAS/);
  assert.match(html,/assets\/js\/pool-core\.js\?v=20261015-match-reload/);
  assert.match(core,/\$\('fourteenPotClockBtn'\)\?\.classList\.toggle\('hidden',!isFourteen \|\| !match\.useClock\)/);
  assert.doesNotThrow(()=>new Function(core));
});

test('14.1 potted-ball button starts the normal shot clock without changing points or the inning',()=>{
  const found=core.match(/\$\('fourteenPotClockBtn'\)\.onclick=\(\)=>\{([\s\S]*?)\n  \};/);
  assert.ok(found,'14.1 potted-ball click handler must exist');
  const calls=[];
  const match={discipline:'14.1',useClock:true,scores:[21,10],ballsOnTable:7,inningsHistory14:[],endedAt:null};
  const click=new Function('match','resetClock', 'return ()=>{'+found[1]+'};')(match,(...args)=>calls.push(args));
  click();
  click();
  assert.deepEqual(calls,[[false,true],[false,true]],'each pot should reset and resume the normal shot clock');
  assert.deepEqual(match.scores,[21,10],'no points are credited until the end of an inning');
  assert.equal(match.ballsOnTable,7,'do not double-count potted balls');
  assert.deepEqual(match.inningsHistory14,[],'do not close or change an inning');

  match.useClock=false;
  click();
  match.useClock=true;
  match.discipline='9-ball';
  click();
  match.discipline='14.1';
  match.endedAt='2026-10-15T08:00:00Z';
  click();
  assert.equal(calls.length,2,'other disciplines, disabled clock, or ended matches must not restart the timer');
});

test('normal clock reset returns configured shot duration and auto-starts',()=>{
  assert.match(core,/clockPhase = firstShot \? 'first' : 'normal'/);
  assert.match(core,/timeLeft = firstShot \? match\.clock\.first : match\.clock\.normal/);
  assert.match(core,/if\(autoStart\) startTimer\(\)/);
});
