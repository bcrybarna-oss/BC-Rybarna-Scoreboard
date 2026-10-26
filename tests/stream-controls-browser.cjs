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
 save:autosaveCurrent,screen:showScreen,undo
};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.streamTest='));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({serviceWorkers:'block'});
 const store=new Map(),writes=[],errors=[];
 await context.route('**/*',async route=>{if(require('./helpers/federal-statistics.cjs').serve(route))return;
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
 const ids={soon:'streamModeSoonBtn',live:'streamModeLiveBtn',pause:'streamModePauseBtn',end:'streamModeEndBtn'};
 async function setup(mode,enabled){
  await page.evaluate(({mode,enabled})=>{
   streamTest.admin();streamTest.reset();
   const el=id=>document.getElementById(id);
   el('p1Name').value='Stream Alpha';el('p2Name').value='Stream Beta';el('discipline').value='8-ball';el('counterMode').value=mode;el('raceTo').value='5';el('useClock').checked=false;el('useLag').checked=false;el('ghostMode').checked=false;el('winnerTableMode').checked=false;el('doublesMode').checked=false;el('streamEnabled').checked=enabled;
   streamTest.start();
  },{mode,enabled});
  await page.waitForFunction(()=>!!streamTest.match);
  assert.equal(await page.locator('#streamDirectorPanel').isVisible(),enabled);
  if(enabled){
   assert.equal(await page.evaluate(()=>streamTest.match.streamMode),'soon');
   assert.equal(await page.locator('#streamModeSoonBtn').getAttribute('aria-pressed'),'true');
   const matchId=await page.evaluate(()=>streamTest.match.id);
   const explicitUrl=await page.locator('#matchStreamOverlayUrl').inputValue();
   assert.equal(new URL(explicitUrl).searchParams.get('matchId'),matchId);
   // Each newly selected match has its own URL. Do not silently rebind the old OBS source.
   const localUrl=new URL(explicitUrl);localUrl.protocol='http:';localUrl.host='stream-isolated.local';localUrl.pathname='/overlay.html';
   await overlay.goto(localUrl.toString());assert.equal(writes.find(w=>w.path==='/stream/users/isolated-stream.json'&&w.value.matchId===matchId)?.value.streamMode,'soon','first OBS publication is SOON');
  }
 }
 async function checkMode(mode){
  await page.locator('#'+ids[mode]).click();
  await page.waitForFunction(mode=>document.getElementById('streamMode'+({live:'Live',soon:'Soon',pause:'Pause',end:'End'}[mode])+'Btn').getAttribute('aria-pressed')==='true',mode);
  await overlay.waitForFunction(mode=>mode==='live'?!!document.querySelector('#overlay .scoreboard'):document.querySelector('#overlay .intermission-main')?.textContent===({soon:'BRZY ZAČÍNÁME',pause:'PAUZA',end:'KONEC STREAMU'}[mode]),mode);
  const payload=store.get('/stream/users/isolated-stream.json');
  assert.equal(payload.streamMode,mode);assert.deepEqual(payload.playerNames,['Stream Alpha','Stream Beta']);assert.deepEqual(payload.scores,[1,0]);
  assert.equal(await page.locator('#streamDirectorPanel .primary').count(),1);
  assert.equal(await page.locator('#'+ids[mode]).getAttribute('aria-pressed'),'true');
  if(mode==='live'){assert.deepEqual(await overlay.locator('.name').allTextContents(),['Stream Alpha','Stream Beta']);assert.deepEqual(await overlay.locator('.score').allTextContents(),['1','0']);}
 }
 try{
  assert.equal(await page.locator('#streamEnabled').isChecked(),false);
  await page.evaluate(()=>{streamTest.admin();streamTest.screen('setup');});
  assert.equal(await page.locator('#setupStreamOptionsPanel').isVisible(),true);
  assert.equal(await page.locator('#streamOverlayUrl').isVisible(),false);
  if(process.env.STREAM_SCREENSHOT_DIR){fs.mkdirSync(process.env.STREAM_SCREENSHOT_DIR,{recursive:true});await page.locator('#setupStreamOptionsPanel').screenshot({path:path.join(process.env.STREAM_SCREENSHOT_DIR,'stream-setup-off.png')});await page.screenshot({path:path.join(process.env.STREAM_SCREENSHOT_DIR,'stream-setup-screen.png'),fullPage:true});}
  await page.locator('#streamEnabled + .slider').click();await page.reload();await page.waitForFunction(()=>!!window.streamTest);await page.waitForSelector('#cloudLoginModal.show');
  assert.equal(await page.locator('#streamEnabled').isChecked(),true);await page.evaluate(()=>{streamTest.admin();streamTest.screen('setup');});
  assert.equal(await page.locator('#setupStreamDetails').isVisible(),true);
  if(process.env.STREAM_SCREENSHOT_DIR)await page.locator('#setupStreamOptionsPanel').screenshot({path:path.join(process.env.STREAM_SCREENSHOT_DIR,'stream-setup-on.png')});
  for(const mode of ['simple','full']){
   const streamWrites=()=>writes.filter(w=>w.path.startsWith('/stream/users/')).length,initialWrites=streamWrites();
   await setup(mode,false);assert.equal(await page.locator('#streamDirectorPanel button:visible').count(),0);assert.equal(await page.locator('#matchStreamOverlayUrl').inputValue(),'');
   await page.locator(mode==='simple'?'#simpleAddP1':'#eightBallWin0').click();assert.deepEqual(await page.evaluate(()=>streamTest.match.scores),[1,0]);await page.locator(mode==='simple'?'#simpleUndoBtn':'#undoBtn').click();assert.deepEqual(await page.evaluate(()=>streamTest.match.scores),[0,0]);
   const unstreamed=await page.evaluate(()=>{streamTest.save();return streamTest.match.id;});await page.reload();await page.waitForFunction(()=>!!window.streamTest);await page.waitForFunction(()=>streamTest.authenticated||document.querySelector('#cloudLoginModal.show'));await page.evaluate(async id=>{streamTest.admin();await streamTest.resume(id);},unstreamed);
   assert.equal(await page.evaluate(()=>!!streamTest.match.streamEnabled),false);assert.equal(await page.locator('#streamDirectorPanel').isVisible(),false);assert.equal(streamWrites(),initialWrites,'no stream publications during play, undo or reload');
   // Missing legacy flag defaults off; enabled legacy record without a mode retains LIVE compatibility.
   await page.evaluate(async id=>{delete streamTest.match.streamEnabled;streamTest.save();await streamTest.resume(id);},unstreamed);assert.equal(await page.evaluate(()=>!!streamTest.match.streamEnabled),false);

   await setup(mode,true);
   await page.locator(mode==='simple'?'#simpleAddP1':'#eightBallWin0').click();
   assert.deepEqual(await page.evaluate(()=>streamTest.match.scores),[1,0]);
   for(const viewport of [{width:1280,height:900},{width:390,height:844},{width:844,height:390},{width:320,height:568}]){
    await page.setViewportSize(viewport);
    for(const next of (viewport.width===1280||viewport.width===390?['soon','live','pause','live','end']:['live','end']))await checkMode(next);
    for(const id of Object.values(ids)){
     const rect=await page.locator('#'+id).boundingBox();assert.ok(rect.width>40&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=viewport.width+1);
    }
    const panel=await page.locator('#streamDirectorPanel').boundingBox(),score=await page.locator(mode==='simple'?'#simpleAddP1':'#eightBallWin0').boundingBox();
    assert.ok(panel.y>=score.y+score.height,'stream panel must follow scoring');
    assert.equal(await page.locator('#streamDirectorPanel').evaluate(e=>['undoBtn','simpleUndoBtn','manualBreaker','simpleStreamBreaker','streamLagControls'].every(id=>!!(document.getElementById(id).compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING))),true);
   }
   const savedId=await page.evaluate(async()=>{streamTest.save();await streamTest.backup();return streamTest.match.id;});
   await page.reload();await page.waitForFunction(()=>!!window.streamTest);
   await page.waitForFunction(()=>streamTest.authenticated||document.querySelector('#cloudLoginModal.show'));
   await page.evaluate(async id=>{if(!streamTest.authenticated){document.getElementById('cloudEmail').value='bcrybarna@gmail.com';document.getElementById('cloudPassword').value='isolated-password';await streamTest.login();}await streamTest.resume(id);},savedId);
   assert.equal(await page.locator('#streamDirectorPanel').isVisible(),true);
   assert.equal(await page.locator('#streamModeEndBtn').getAttribute('aria-pressed'),'true');
   assert.deepEqual(await page.evaluate(()=>streamTest.match.scores),[1,0]);
   await checkMode('live');
   await page.evaluate(async()=>{delete streamTest.match.streamMode;streamTest.save();await streamTest.resume(streamTest.match.id);});assert.equal(await page.evaluate(()=>streamTest.match.streamEnabled),true);assert.equal(await page.locator('#streamModeLiveBtn').getAttribute('aria-pressed'),'true');
   await page.setViewportSize({width:390,height:844});
   if(process.env.STREAM_SCREENSHOT_DIR){fs.mkdirSync(process.env.STREAM_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.STREAM_SCREENSHOT_DIR,'stream-counter-'+mode+'.png'),fullPage:true});}
   console.log('PASS '+mode+': ON/OFF, score, all modes through real overlay, desktop/mobile/orientation/320px, reload/resume');
  }
  assert.deepEqual(errors,[]);assert.ok(writes.some(w=>w.path==='/stream/users/isolated-stream.json'));
  console.log('PASS 0 page errors; every network request intercepted; no production writes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
