'use strict';
// Real production counter + real overlay, sharing an isolated in-memory REST backend.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`window.streamTest={
 get match(){return match},get authenticated(){return cloudAuthenticated&&cloudUid==='isolated-stream'},start:startMatch,login:cloudLoginFromModal,backup:saveActiveMatchCloudBackupNow,
 admin(){cloudUserEmail='bcrybarna@gmail.com';cloudAuthenticated=true;cloudUid='isolated-stream';cloudEmailVerified=true;currentUserRole='system_admin';cloudIdToken='mock-token';cloudTokenExpiresAt=Date.now()+3600000;document.getElementById('cloudLoginModal').classList.remove('show');},
 reset(){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);match=null;data=defaultData();pendingFederalCupLink=null;pendingTournamentLink=null;pendingLeagueLink=null;document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));for(const key of [LOCAL_ACTIVE_MATCH_KEY,LOCAL_ACTIVE_MATCHES_KEY,LOCAL_ACTIVE_MATCH_RECOVERY_KEY])localStorage.removeItem(key);},
 resume:resumeLocalMatch,
 save:autosaveCurrent,render:renderMatch,send:sendStreamState,choose:chooseLagWinner,undo,breaker:changeRackBreaker,begin:beginRack
};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.streamTest='));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 const store=new Map(),writes=[],errors=[];
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.origin==='http://stream-isolated.local')return route.fulfill({contentType:'text/html',body:u.pathname==='/overlay.html'?fs.readFileSync(path.join(root,'overlay.html'),'utf8'):html});
  if(u.hostname==='identitytoolkit.googleapis.com')return route.fulfill({contentType:'application/json',body:JSON.stringify(u.pathname.includes('accounts:lookup')?{users:[{localId:'isolated-stream',email:'bcrybarna@gmail.com',emailVerified:true}]}:{localId:'isolated-stream',email:'bcrybarna@gmail.com',idToken:'mock-token',refreshToken:'mock-refresh',expiresIn:'3600'})});
  if(u.hostname==='securetoken.googleapis.com')return route.fulfill({contentType:'application/json',body:JSON.stringify({user_id:'isolated-stream',id_token:'mock-token',refresh_token:'mock-refresh',expires_in:'3600'})});
  if(u.pathname.endsWith('.json')){
   if(['PUT','PATCH'].includes(req.method())){const value=req.postDataJSON();store.set(u.pathname,req.method()==='PATCH'?{...store.get(u.pathname),...value}:value);writes.push({path:u.pathname,value});}
   if(req.method()==='DELETE')store.delete(u.pathname);
   let value=store.get(u.pathname);
   if(value===undefined){const prefix=u.pathname.replace(/\.json$/,'')+'/';const children=[...store].filter(([key])=>key.startsWith(prefix));if(children.length)value=Object.fromEntries(children.map(([key,v])=>[key.slice(prefix.length).replace(/\.json$/,''),v]));}
   return route.fulfill({contentType:'application/json',headers:{ETag:'"mock"'},body:JSON.stringify(value??null)});
  }
  return route.abort();
 });
 context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());});
 const page=await context.newPage(),overlay=await context.newPage();
 page.setDefaultTimeout(8000);overlay.setDefaultTimeout(8000);
 await page.goto('http://stream-isolated.local/');
 await page.waitForFunction(()=>!!window.streamTest);
 await overlay.goto('http://stream-isolated.local/overlay.html?uid=isolated-stream');
 await page.waitForFunction(()=>document.querySelector('#cloudLoginModal.show'));
 async function setup(mode='simple',breakMode='alternate',enabled=true,discipline='9-ball',winnerTable=false){
  await page.evaluate(({mode,breakMode,enabled,discipline,winnerTable})=>{
   streamTest.reset();streamTest.admin();const el=id=>document.getElementById(id);
   el('p1Name').value='Stream Alpha';el('p2Name').value='Stream Beta';el('discipline').value=discipline;el('counterMode').value=mode;el('raceTo').value='9';el('useClock').checked=false;el('useLag').checked=true;el('ghostMode').checked=false;el('winnerTableMode').checked=false;el('doublesMode').checked=false;el('streamEnabled').checked=enabled;el('breakMode').value=breakMode;
   el('p3Name').value='Stream Gamma';el('winnerTableMode').checked=winnerTable;
   streamTest.start();
  },{mode,breakMode,enabled,discipline,winnerTable});
  await page.waitForFunction(()=>!!streamTest.match);
  if(enabled){const url=new URL(await page.locator('#matchStreamOverlayUrl').inputValue());url.protocol='http:';url.host='stream-isolated.local';url.pathname='/overlay.html';await overlay.goto(url.toString());assert.equal((await state()).streamMode,'soon');await page.locator('#streamModeLiveBtn').click();await sync();}
 }
 const state=()=>page.evaluate(()=>JSON.parse(JSON.stringify(streamTest.match)));
 async function sync(){await page.evaluate(()=>streamTest.send(true));await overlay.waitForFunction(()=>!!document.querySelector('#overlay .scoreboard'));}
 async function side(expected,label='BREAK'){
  await sync();await overlay.waitForFunction(expected=>{const cards=[...document.querySelectorAll('.player')];return cards.length===2&&cards.findIndex(e=>e.classList.contains('turn'))===expected},expected);
  if(expected>=0)assert.equal(await overlay.locator('.player.turn').evaluate(e=>getComputedStyle(e,'::after').content),'"'+label+'"');
 }
 async function reload(){
  const savedId=await page.evaluate(()=>{streamTest.save();return streamTest.match.id;});
  await page.reload();await page.waitForFunction(()=>!!window.streamTest);await page.waitForFunction(()=>streamTest.authenticated||document.querySelector('#cloudLoginModal.show'));
  await page.evaluate(async id=>{streamTest.admin();await streamTest.resume(id)},savedId);
  assert.equal((await state()).id,savedId);
 }
 try{
  for(const mode of ['simple','full']){
   await setup(mode);let m=await state();const id=m.id,url=await page.locator('#matchStreamOverlayUrl').inputValue();
   assert.equal(m.lagWinner,null);assert.equal(m.breaker,null);assert.equal(m.turn,null);assert.deepEqual(m.stats.map(s=>s.breaks),[0,0]);assert.equal(m.events.filter(e=>e.text.startsWith('Rack ')).length,0);assert.equal(m.detailedPlay?.records.length||0,0);assert.equal(m.detailedPlay?.inning,undefined);
   await side(-1);assert.equal(await page.locator('#simpleCounterActions').isVisible(),false);assert.equal(await page.locator('#normalActions').isVisible(),false);
   await page.evaluate(()=>{actionDryBreak();winRack(0);simpleAddPoint(0)});assert.deepEqual((await state()).stats,m.stats);assert.deepEqual((await state()).scores,[0,0]);
   await page.locator('#streamModeSoonBtn').click();await page.evaluate(()=>streamTest.send(true));await overlay.waitForFunction(()=>document.querySelector('.intermission-main')?.textContent==='BRZY ZAČÍNÁME');
   await page.locator('#streamModeLiveBtn').click();await side(-1);
   await reload();assert.equal((await state()).breaker,null);await side(-1);
   await page.locator('#streamLagP2').click();await side(1,mode==='simple'?'BREAK':'U STOLU');m=await state();assert.equal(m.lagWinner,1);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,1]);
   await page.locator('#streamLagUndo').click();await side(-1);m=await state();assert.equal(m.lagWinner,null);assert.deepEqual(m.stats.map(s=>s.breaks),[0,0]);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,0]);await page.locator('#streamLagP2').click();
   await page.locator('#streamLagP1').click();m=await state();assert.deepEqual(m.stats.map(s=>s.breaks),[1,0]);assert.deepEqual(m.stats.map(s=>s.lagWins),[1,0]);
   await page.locator('#streamLagUndo').click();m=await state();assert.equal(m.lagWinner,1);assert.deepEqual(m.stats.map(s=>s.breaks),[0,1]);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,1]);await side(1,mode==='simple'?'BREAK':'U STOLU');
   await page.evaluate(()=>streamTest.breaker());await side(0,mode==='simple'?'BREAK':'U STOLU');await page.evaluate(()=>streamTest.undo());await side(1,mode==='simple'?'BREAK':'U STOLU');
   await reload();await overlay.reload();m=await state();assert.equal(m.lagWinner,1);assert.deepEqual(m.stats.map(s=>s.lagWins),[0,1]);assert.equal(await page.locator('#lagModal').isVisible(),false);assert.equal(await page.locator('#matchStreamOverlayUrl').inputValue(),url);await side(1,mode==='simple'?'BREAK':'U STOLU');
   if(mode==='simple'){
    await page.evaluate(()=>{streamTest.match.turn=0;streamTest.render()});await side(1);
    await page.locator('#streamLagLock').click();assert.equal(await page.locator('#streamLagP1').isEnabled(),false);
    await page.evaluate(()=>streamTest.choose(0));assert.equal((await state()).lagWinner,1);
    await reload();assert.equal(await page.locator('#streamLagP1').isEnabled(),false);
    await page.locator('#simpleAddP1').click();await side(0);assert.equal(await page.locator('#streamLagP1').isEnabled(),false);
   }else{
    await page.locator('#actionDryBreakBtn').click();await side(0,'U STOLU');assert.equal((await state()).breaker,1);assert.equal(await page.locator('#streamLagP1').isEnabled(),false);
   }
   m=await state();await page.evaluate(()=>streamTest.choose(0));assert.equal((await state()).lagWinner,1);assert.deepEqual((await state()).stats,m.stats);assert.equal((await state()).id,id);
   await page.evaluate(()=>streamTest.undo());if(mode==='simple')await page.evaluate(()=>streamTest.undo());assert.equal(await page.locator('#streamLagP1').isEnabled(),true);await page.locator('#streamLagP1').click();await side(0,mode==='simple'?'BREAK':'U STOLU');
   await page.setViewportSize({width:390,height:844});for(const button of ['streamLagP1','streamLagP2']){const r=await page.locator('#'+button).boundingBox();assert.ok(r.width>40&&r.x>=0&&r.x+r.width<=391);}await page.setViewportSize({width:1280,height:900});
   console.log('PASS '+mode+': pre-lag stream SOON/LIVE, no implicit player/shot/stats, choice/correction/undo/lock, reload and fixed URL, mobile');
  }
  for(const mode of ['alternate','alternate2','winner']){
   await setup('simple',mode);await page.locator('#streamLagP2').click();await side(1);await page.locator('#streamLagLock').click();
   await page.locator('#simpleAddP1').click();await side(mode==='alternate2'?1:0);
   await page.locator('#simpleAddP2').click();await side(mode==='alternate'?1:mode==='alternate2'?0:1);
   console.log('PASS simple BREAK: '+mode+' uses actual next rack breaker');
  }
  await setup('simple','alternate',true,'8-ball');await page.locator('#streamLagP2').click();await page.locator('#simpleStreamBreaker').click();await side(0);assert.deepEqual((await state()).stats.map(s=>s.breaks),[1,0]);
  await setup('simple','alternate',true,'9-ball',true);await side(0);await page.locator('#simpleAddP1').click();await side(1);await page.locator('#simpleAddP2').click();await side(0);assert.equal((await state()).breakMode,'winner-table');
  await setup('full','alternate',true,'14.1');await page.locator('#streamLagP2').click();assert.equal((await state()).breaker,null);await reload();await side(-1);await page.locator('#streamLagP2').click();await page.locator('#lagPassBreak14').click();await side(0,'U STOLU');assert.deepEqual((await state()).stats.map(s=>s.breaks),[1,0]);assert.deepEqual((await state()).stats.map(s=>s.lagWins),[0,1]);
  await setup('full','alternate',false);assert.equal(await page.locator('#lagModal').isVisible(),true);await page.locator('#lagP2').click();assert.equal((await state()).lagWinner,1);assert.deepEqual((await state()).stats.map(s=>s.breaks),[0,1]);assert.equal(await page.locator('#streamDirectorPanel').isVisible(),false);
  assert.deepEqual(errors,[]);assert.ok(writes.some(w=>w.path==='/stream/users/isolated-stream.json'));
  console.log('PASS no-overlay legacy lag, 8-ball, 14.1 opening choice, 0 JS errors; every request isolated');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
