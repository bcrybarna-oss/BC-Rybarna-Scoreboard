'use strict';
// Two real publishers + an OBS page, all REST traffic isolated in memory.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.join(__dirname,'..'),origin='https://stream-isolation.local';
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`window.publisherTest={
 get match(){return match},send:sendStreamState,clear:clearStreamState,
 suspend(){match.streamEnabled=false;clearTimeout(streamSendTimer);},
 async resume(){match.streamEnabled=true;renderMatch();return sendStreamState(true);},
 start(owner,name){cloudUserEmail='bcrybarna@gmail.com';cloudAuthenticated=true;cloudUid=owner;cloudEmailVerified=true;currentUserRole='system_admin';cloudIdToken='isolated-token';cloudTokenExpiresAt=Date.now()+3600000;document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));data=defaultData();const el=id=>document.getElementById(id);el('p1Name').value=name;el('p2Name').value=name+' opponent';el('discipline').value='8-ball';el('counterMode').value='simple';el('raceTo').value='5';for(const id of ['useClock','useLag','ghostMode','winnerTableMode','doublesMode'])el(id).checked=false;el('streamEnabled').checked=true;startMatch();}
};`;
const html=index.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes('window.publisherTest='));
const baseline=process.env.ISOLATION_BASELINE==='1';
const overlaySource=baseline?execFileSync('git',['show','5244c3c:overlay.html'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'overlay.html'),'utf8');
const overlayHtml=overlaySource.replace('</script>','window.overlayIsolationTest={poll};</script>');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const store=new Map(),versions=new Map(),requests=[],errors=[];let rootReads=0,race=null,failStatus=0,invalidJson=false,networkDown=false;
 const keyA='/stream/users/publisher-A.json',keyB='/stream/users/publisher-B.json';
 const put=(key,value)=>{store.set(key,structuredClone(value));versions.set(key,(versions.get(key)||0)+1);};
 let now=Date.parse('2026-10-22T12:00:00Z');
 async function context(){
  const c=await browser.newContext({serviceWorkers:'block'});
  await c.addInitScript(value=>{window.testNow=value;Date.now=()=>window.testNow;},now);
  c.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());});
  await c.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),key=u.pathname;
   if(u.origin===origin){if(key==='/')return route.fulfill({contentType:'text/html',body:html});if(key==='/overlay.html')return route.fulfill({contentType:'text/html',body:overlayHtml});return route.abort();}
   if(!key.endsWith('.json'))return route.abort();
   requests.push({key,method:r.method(),headers:r.headers()});
   if(key==='/stream/users.json'){rootReads++;return route.fulfill({contentType:'application/json',body:JSON.stringify(Object.fromEntries([...store].filter(([k])=>k.startsWith('/stream/users/')).map(([k,v])=>[k.split('/').at(-1).replace('.json',''),v])))});}
   if(r.method()==='GET'&&key.startsWith('/stream/users/')){
    if(networkDown)return route.abort();
    if(failStatus)return route.fulfill({status:failStatus,body:'null'});
    if(invalidJson)return route.fulfill({contentType:'application/json',body:'{broken'});
   }
   const etag='"'+(versions.get(key)||0)+'"';
   if(r.method()==='PUT'||r.method()==='PATCH'){
    if(r.headers()['if-match']&&r.headers()['if-match']!==etag)return route.fulfill({status:412,body:'null'});
    const value=r.postDataJSON();put(key,r.method()==='PATCH'?{...store.get(key),...value}:value);
   }
   if(r.method()==='DELETE')store.delete(key);
   let value=store.get(key);
   if(value===undefined){const prefix=key.replace(/\.json$/,'')+'/';const children=[...store].filter(([k])=>k.startsWith(prefix));if(children.length)value=Object.fromEntries(children.map(([k,v])=>[k.slice(prefix.length).replace(/\.json$/,''),v]));}
   if(r.method()==='GET'&&race&&key===keyA&&r.headers()['x-firebase-etag']){const change=race;race=null;change();}
   return route.fulfill({contentType:'application/json',headers:{ETag:etag,'Access-Control-Expose-Headers':'ETag'},body:JSON.stringify(value??null)});
  });
  return c;
 }
 const aContext=await context(),bContext=await context(),cContext=await context(),obsContext=await context();
 async function publisher(c,uid,name){const p=await c.newPage();await p.goto(origin+'/');await p.waitForFunction(()=>!!window.publisherTest);await p.waitForSelector('#cloudLoginModal.show');await p.evaluate(value=>window.testNow=value,now);await p.evaluate(({uid,name})=>publisherTest.start(uid,name),{uid,name});await p.waitForFunction(()=>!!publisherTest.match);await p.evaluate(()=>publisherTest.send(true));return p;}
 const a=await publisher(aContext,'publisher-A','Alpha A'),matchA=await a.evaluate(()=>publisherTest.match.id);
 const aState=structuredClone(store.get(keyA));
 const explicit=await a.locator('#matchStreamOverlayUrl').inputValue();
 assert.equal(new URL(explicit).searchParams.get('uid'),'publisher-A');assert.equal(new URL(explicit).searchParams.get('matchId'),matchA);
 assert.equal(new URLSearchParams(new URL(explicit).hash.slice(1)).get('matchId'),matchA);
 await a.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{async writeText(value){window.copiedStreamUrl=value;}}}));
 await a.locator('#copyMatchStreamOverlayUrl').click();assert.equal(await a.evaluate(()=>window.copiedStreamUrl),explicit);
 const obs=await obsContext.newPage();
 async function open(p,query){await p.goto(origin+'/overlay.html'+query);await p.evaluate(value=>window.testNow=value,now);await p.waitForFunction(()=>!!window.overlayIsolationTest);await p.evaluate(()=>overlayIsolationTest.poll());}
 async function poll(p=obs){await p.evaluate(()=>overlayIsolationTest.poll());}
 async function alpha(p=obs){await p.waitForFunction(()=>document.querySelector('#overlay .name')?.textContent==='Alpha A');assert.deepEqual(await p.locator('#overlay .name').allTextContents(),['Alpha A','Alpha A opponent']);}
 async function unavailable(p=obs){await p.waitForFunction(()=>!!document.querySelector('#overlay .offline'));const t=await p.locator('#overlay').innerText();assert.ok(!t.includes('Beta B')&&!t.includes('Alpha second'),t);assert.equal(await p.locator('#overlay .scoreboard').count(),0);}
  await open(obs,'?uid=publisher-A&matchId='+matchA);await alpha();
  const b=await publisher(bContext,'publisher-B','Beta B');await poll();await alpha();
  console.log('PASS A live, B activates another stream: A unchanged');
  await a.evaluate(()=>publisherTest.suspend());
  now+=21001;
  for(const p of [a,b,obs])await p.evaluate(value=>window.testNow=value,now);
  await b.evaluate(()=>publisherTest.send(true));await poll();
  assert.ok(!(await obs.locator('#overlay').innerText()).includes('Beta B'),'OBS A must never switch to B after >20 seconds');
  await unavailable();await obs.setViewportSize({width:390,height:844});await unavailable();
  await a.evaluate(()=>publisherTest.resume());await poll();await alpha();
  console.log('PASS >21 seconds simulated silence for A, B fresh, unavailable/rotation, then original A restored');

  const legacy=await obsContext.newPage(),legacyUrl='?uid=publisher-A';await open(legacy,legacyUrl);await alpha(legacy);
  assert.equal(new URL(legacy.url()).searchParams.get('matchId'),matchA,'legacy URL becomes an explicit match URL');
  await a.evaluate(()=>publisherTest.suspend());
  const c=await publisher(cContext,'publisher-A','Alpha second'),matchC=await c.evaluate(()=>publisherTest.match.id),cState=structuredClone(store.get(keyA));
  await c.evaluate(()=>publisherTest.suspend());await poll();await unavailable();
  await obs.reload();await obs.evaluate(value=>window.testNow=value,now);await poll();await unavailable();
  await open(legacy,legacyUrl);await unavailable(legacy);
  const before=structuredClone(store.get(keyA));assert.equal(await a.evaluate(id=>publisherTest.clear(id),matchA),false);assert.deepEqual(store.get(keyA),before);
  await a.evaluate(()=>publisherTest.resume());await poll();await alpha();await poll(legacy);await alpha(legacy);
  console.log('PASS same UID/different match cannot take over; explicit and legacy original URL reload remain pinned; old tab cannot clear new match');

  await a.evaluate(()=>publisherTest.suspend());put(keyA,{...aState,updatedAt:now});
  race=()=>put(keyA,{...cState,updatedAt:now});
  assert.equal(await a.evaluate(id=>publisherTest.clear(id),matchA),false,'ETag rejects clear after another match takes slot');
  assert.equal(store.get(keyA).matchId,matchC);assert.equal(store.get(keyA).active,true);
  assert.ok(requests.some(r=>r.method==='PUT'&&r.headers['if-match']));
  await poll();await unavailable();
  await a.evaluate(()=>publisherTest.resume());await poll();await alpha();
  // A live publisher can change its own ETag too. Rejection preserves newer data.
  await a.evaluate(()=>publisherTest.suspend());
  race=()=>put(keyA,{...store.get(keyA),updatedAt:now});
  assert.equal(await a.evaluate(id=>publisherTest.clear(id),matchA),false,'own heartbeat race must also preserve the newer state');
  assert.equal(store.get(keyA).matchId,matchA);assert.equal(store.get(keyA).active,true);
  // Verify successful clear separately with no concurrent publisher update.
  assert.equal(await a.evaluate(id=>publisherTest.clear(id),matchA),true);await poll();await unavailable();
  await a.evaluate(()=>publisherTest.resume());await poll();await alpha();
  console.log('PASS conditional clear: foreign-match and own-heartbeat/412 preserved; idle own match clears and resumes');

  for(const status of [403,404,500]){failStatus=status;await poll();await unavailable();failStatus=0;await poll();await alpha();}
  invalidJson=true;await poll();await unavailable();invalidJson=false;await poll();await alpha();
  networkDown=true;await poll();await unavailable();await obs.setViewportSize({width:844,height:390});await unavailable();networkDown=false;await poll();await alpha();
  for(const value of [null,{...aState,active:false},{...aState,updatedAt:now-20000},{...aState,updatedAt:now+6000},{...aState,matchId:null}]){await a.evaluate(()=>publisherTest.suspend());put(keyA,value);await poll();await unavailable();}
  await a.evaluate(()=>publisherTest.resume());await poll();await alpha();
  console.log('PASS missing/inactive/stale/invalid payload, HTTP failures, invalid JSON, network loss and viewport cannot show a foreign or old frame');

  const hash=await obsContext.newPage();await open(hash,'#uid=publisher-A&matchId='+matchA);await alpha(hash);
  const bare=await obsContext.newPage();await bare.addInitScript(()=>localStorage.setItem('bcOverlayUid','publisher-B'));await open(bare,'');await unavailable(bare);
  const ambiguous=await obsContext.newPage();await open(ambiguous,'?uid=publisher-A&matchId='+matchA+'#uid=publisher-B');await unavailable(ambiguous);
  const storageBlocked=await obsContext.newPage();await storageBlocked.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('blocked')};Storage.prototype.setItem=()=>{throw Error('blocked')};});await open(storageBlocked,'?uid=publisher-A&matchId='+matchA);await alpha(storageBlocked);
  assert.equal(rootReads,0,'no stream enumeration/discovery anywhere');
  assert.deepEqual(errors,[]);
  console.log('PASS query/hash, explicit binding without storage, no UID ignores unsafe old cache, conflicting URL rejected; 0 root enumeration, 0 page errors; all network intercepted');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
