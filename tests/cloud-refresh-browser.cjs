'use strict';
// Production HTML and actual modules, private backup in memory, all requests mocked.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{chromium}=require('playwright');
const root=path.join(__dirname,'..'),baseline=process.env.CLOUD_BASELINE==='1',source=fs.readFileSync(process.env.CLOUD_SOURCE||path.join(root,'index.html'),'utf8'),out=path.resolve(process.env.CLOUD_OUT||'output/modularization-99/lifecycle-after');fs.mkdirSync(out,{recursive:true});
const file=process.env.PERF_BACKUP||'C:/Users/mencl/Downloads/BC_Rybarna_Scoreboard_Backup_2026-10-25.json',raw=fs.readFileSync(file),backup=JSON.parse(raw);
const hook=`
const lifeCounts={applied:0};const realApply=writeLocalWithoutCloudSync;
writeLocalWithoutCloudSync=function(...args){lifeCounts.applied++;return realApply(...args);};
window.life={load(d){stopTimer();stopLiveHeartbeat();match=null;data=normalizeDataObject(d);data.currentMatch=null;showScreen('home');},
 login(id){clearRuntimeCloudIdentity();cloudUid=id;cloudAuthenticated=true;cloudIdToken='isolated-'+id;cloudTokenExpiresAt=Date.now()+86400000;cloudRefreshToken='';currentUserRole='player';document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));startCloudAutoSync();},
 logout:logoutFromApp,restart:startCloudAutoSync,show:showScreen,
 begin(n=1){window.lifeReads=Promise.all(Array.from({length:n},()=>pollCloudData()));},
 expire(){cloudTokenExpiresAt=0;cloudRefreshToken='isolated-refresh';},
 state(){return {authenticated:cloudAuthenticated,uid:cloudUid,applied:lifeCounts.applied,screen:document.querySelector('.screen.active')?.id,controller:typeof cloudAutoSync!=='undefined'&&cloudAutoSync?cloudAutoSync.snapshot():null,dbMatches:data.matches.length,players:Object.keys(data.players).length};},
 readMatches(){window.lifeMatchReads=Promise.all([loadSecureMatches(),loadSecureMatches(),loadSecureMatches()]);}
};
`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
function probe(){const native={interval:setInterval.bind(window),timeout:setTimeout.bind(window),clearInterval:clearInterval.bind(window),clearTimeout:clearTimeout.bind(window)},virtual=new Map(),others=new Map();let next=-1;window.cloudProbe={virtual,others,intervals(){return [...virtual.values()].filter(x=>x.kind==='interval').length;},timeouts(){return [...virtual.values()].filter(x=>x.kind==='timeout').length;},fire(){for(const [id,j]of [...virtual])if(j.kind==='timeout'){virtual.delete(id);j.fn();}},tick(){for(const j of [...virtual.values()])if(j.kind==='interval')j.fn();},stopOthers(){for(const [id,kind]of others){(kind==='interval'?native.clearInterval:native.clearTimeout)(id);}others.clear();}};
 window.setInterval=(fn,ms,...args)=>{if(ms===2500){const id=next--;virtual.set(id,{kind:'interval',fn:()=>fn(...args)});return id;}const id=native.interval(fn,ms,...args);others.set(id,'interval');return id;};
 window.setTimeout=(fn,ms,...args)=>{if(ms===700){const id=next--;virtual.set(id,{kind:'timeout',fn:()=>fn(...args)});return id;}const id=native.timeout(fn,ms,...args);others.set(id,'timeout');return id;};
 window.clearInterval=id=>{virtual.delete(id);others.delete(id);native.clearInterval(id);};window.clearTimeout=id=>{virtual.delete(id);others.delete(id);native.clearTimeout(id);};
}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});let phase='boot',hold=null,offline=false,revision=1000;const requests=[],gates=[],errors=[],writes=[];let inflightMatches=0,maxMatches=0;
try{const c=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});await c.addInitScript(probe);
 await c.route('**/*',async route=>{if(require('./helpers/federal-statistics.cjs').serve(route))return;const q=route.request(),u=new URL(q.url());
  if(u.origin==='http://cloud-life.local'){if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const f=path.resolve(root,'.'+u.pathname);if(f.startsWith(root+path.sep)&&fs.existsSync(f))return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'application/javascript':f.endsWith('.svg')?'image/svg+xml':'image/png'});}
  const isToken=u.hostname==='securetoken.googleapis.com',isDb=/firebaseio|firebasedatabase/.test(u.hostname);if(!isToken&&!isDb)return route.abort();
  const kind=isToken?'token':u.pathname;requests.push({phase,kind,method:q.method()});
  if(isDb&&!['GET','HEAD'].includes(q.method())){writes.push({phase,kind,method:q.method()});return route.abort();}
  if(offline&&kind==='/appData.json')return route.abort();
  if(hold===kind){let release;const pending=new Promise(r=>release=r);gates.push({kind,phase,release});await pending;}
  const value=isToken?{user_id:'A',id_token:'isolated-renewed',refresh_token:'isolated-refresh',expires_in:3600}:kind==='/appData.json'?{updatedAt:revision,data:{federalCup2026:backup.federalCup2026,tournamentSeries:backup.tournamentSeries}}:kind==='/matches.json'?backup.matches:kind==='/tournaments.json'?backup.tournaments:kind==='/players.json'?backup.players:null;
  if(kind==='/matches.json'){inflightMatches++;maxMatches=Math.max(maxMatches,inflightMatches);await delay(60);}
  try{await route.fulfill({contentType:'application/json',body:JSON.stringify(value)});}catch{}finally{if(kind==='/matches.json')inflightMatches--;}
 });
 const p=await c.newPage();p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});p.setDefaultTimeout(120000);await p.goto('http://cloud-life.local/');await p.waitForFunction(()=>!!window.life,{},{timeout:10000});await p.evaluate(d=>{life.load(d);cloudProbe.stopOthers();},backup);
 const state=()=>p.evaluate(()=>({...life.state(),intervals:cloudProbe.intervals(),timeouts:cloudProbe.timeouts()}));
 const count=kind=>requests.filter(r=>r.phase===phase&&r.kind===kind).length;
 async function waitRequest(kind,n=1){const limit=Date.now()+10000;while(count(kind)<n&&Date.now()<limit)await delay(20);assert.ok(count(kind)>=n,phase+' request '+kind);await delay(50);}
 function release(){hold=null;for(const g of gates.splice(0))g.release();}
 const result={baseline,sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),backupSha256:crypto.createHash('sha256').update(raw).digest('hex'),backupBytes:raw.length,scope:'Only /appData 2500ms interval and 700ms warm-up use a controllable clock. Other background timers paused to attribute requests. Full real-timer navigation measured separately.',cases:{}};
 await p.evaluate(()=>{life.login('A');life.restart();life.restart();});result.cases.repeatedStart=await state();assert.equal(result.cases.repeatedStart.intervals,1);assert.equal(result.cases.repeatedStart.timeouts,baseline?3:1);
 phase='concurrent';hold='/appData.json';revision=11000;await p.evaluate(()=>life.begin(3));await waitRequest('/appData.json',baseline?3:1);result.cases.concurrentReads=count('/appData.json');assert.equal(result.cases.concurrentReads,baseline?3:1);release();await p.evaluate(()=>lifeReads);
 phase='same-revision';const same=(await state()).applied;await p.evaluate(()=>life.begin());await p.evaluate(()=>lifeReads);assert.equal((await state()).applied,same);result.cases.sameRevisionAppliedAgain=false;
 phase='matches';await p.evaluate(()=>life.readMatches());await p.evaluate(()=>lifeMatchReads);assert.equal(count('/matches.json'),1);assert.equal(maxMatches,1);result.cases.sharedMatches=1;
 phase='navigation';const resources=[];for(let i=0;i<6;i++){for(const screen of ['home','results','stats','federal-cup-2026'])await p.evaluate(s=>life.show(s),screen);resources.push(await state());}assert.ok(resources.every(r=>r.intervals===1));result.cases.navigation={transitions:24,resources:resources.map(r=>({intervals:r.intervals,timeouts:r.timeouts,controller:r.controller}))};
 phase='leave-screen';hold='/appData.json';revision=21000;const leftBefore=(await state()).applied;await p.evaluate(()=>life.begin());await waitRequest('/appData.json');await p.evaluate(()=>life.show('home'));release();await p.evaluate(()=>lifeReads);assert.equal((await state()).screen,'screen-home');assert.equal((await state()).applied,leftBefore+1);result.cases.leaveScreen={active:'screen-home',validSharedRevisionAppliedOnce:true};
 phase='logout-pending';hold='/appData.json';revision=31000;const beforeLogout=(await state()).applied;await p.evaluate(()=>life.begin());await waitRequest('/appData.json');await p.evaluate(()=>life.logout());release();await p.evaluate(()=>lifeReads);result.cases.lateAfterLogout={...await state(),appliedAfterLogout:(await state()).applied-beforeLogout};assert.equal(result.cases.lateAfterLogout.appliedAfterLogout,baseline?1:0);assert.equal((await state()).intervals,0);
 phase='sessions';const sessions=[];for(let i=0;i<6;i++){await p.evaluate(id=>life.login(id),i%2?'B':'A');await p.evaluate(()=>life.restart());const on=await state();await p.evaluate(()=>life.logout());const off=await state();sessions.push({on:{intervals:on.intervals,timeouts:on.timeouts,listeners:on.controller?.listeners},off:{intervals:off.intervals,timeouts:off.timeouts,listeners:off.controller?.listeners}});assert.equal(on.intervals,1);assert.equal(off.intervals,0);if(!baseline){assert.equal(on.timeouts,1);assert.equal(off.timeouts,0);assert.equal(on.controller.listeners,2);assert.equal(off.controller.listeners,0);}}result.cases.sessionCycles=sessions;
 // Discard old baseline warm-ups before the focused retry/auth tests.
 await p.evaluate(()=>{cloudProbe.fire();});await delay(50);await p.evaluate(()=>life.login('A'));
 phase='offline';offline=true;await p.evaluate(()=>cloudProbe.tick());await waitRequest('/appData.json');await delay(100);const beforeRetry=(await state()).applied;offline=false;phase='reconnected';revision=41000;await p.evaluate(()=>cloudProbe.tick());await waitRequest('/appData.json');const retryLimit=Date.now()+10000;while((await state()).applied===beforeRetry&&Date.now()<retryLimit)await delay(50);assert.equal((await state()).applied,beforeRetry+1);result.cases.recovery={offlineRequests:requests.filter(r=>r.phase==='offline'&&r.kind==='/appData.json').length,reconnectedAppliedOnce:true,viaScheduledInterval:true};
 phase='auth-late';hold='token';await p.evaluate(()=>{life.expire();life.begin();});await waitRequest('token');await p.evaluate(()=>life.logout());release();await p.evaluate(()=>lifeReads);result.cases.lateToken=await state();assert.equal(result.cases.lateToken.authenticated,baseline);assert.equal(result.cases.lateToken.intervals,baseline?1:0);
 await p.evaluate(()=>life.logout());assert.deepEqual(errors,[]);assert.equal(writes.length,0);assert.equal((await state()).dbMatches,backup.matches.length);assert.deepEqual(fs.readFileSync(file),raw);result.requests=requests;result.maxConcurrentMatches=maxMatches;result.pageErrors=errors;result.writes=writes;result.final=await state();fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(result,null,2));await c.close();console.log('PASS',baseline?'baseline reproduces duplicate warm-up/read and late-data/auth bugs':'module lifecycle, navigation, logout/login, stale replies, retry, shared reads',out);
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
