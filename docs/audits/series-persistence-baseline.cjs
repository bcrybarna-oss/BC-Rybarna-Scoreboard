'use strict';
// Audit of known defects, NOT an acceptance suite claiming these behaviours are correct.
// Actual production HTML/modules; ALL traffic intercepted, no live Auth/Rules or writes.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.env.SERIES_AUDIT_OUT||'output/series-persistence');
fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`
window.seriesAudit={
 identity(role){
  clearRuntimeCloudIdentity();
  cloudRefreshToken='';cloudUserEmail='';
  if(role!=='logout'){cloudUid=role==='owner'?window.auditOwner:role;cloudAuthenticated=true;cloudEmailVerified=true;
   currentUserRole=role==='admin'?'system_admin':role==='club'?'club_admin':'player';
   cloudIdToken='isolated-'+role;cloudTokenExpiresAt=Date.now()+3600000;}
  document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));
 },
 synthetic(){
  data=defaultData();const ids=['a','b','c','d'];data.players=Object.fromEntries(ids.map(id=>[id,{id,name:id,active:true}]));
  data.tournaments=['october1','october2','november'].map((id,k)=>{
   const t=generateGroupTournament(k===2?'Audit – třetí turnaj':id,ids,'9-ball',5,'alternate',1,{},1,'manual');
   t.id=id;t.createdByUid='owner';t.status='complete';
   for(const m of t.groups[0].matches){m.status='done';m.winnerId=m.player1Id;m.loserId=m.player2Id;m.score1=5;m.score2=2;}
   return t;
  });
  data.tournamentSeries=[{id:'series',name:'Lounská testovací série',createdByUid:'owner',managerUids:{manager:true},tournamentIds:['october1','october2'],pointsTop:[100,80,65,55],pointsBands:[45,25,10,5]}];
  return JSON.parse(JSON.stringify(data));
 },
 seed(fixture,role){data=normalizeDataObject(JSON.parse(JSON.stringify(fixture)));window.auditOwner=data.tournamentSeries[0].createdByUid;
  this.identity(role);cloudRuntimeDataTs=0;localStorage.setItem(CLOUD_LOCAL_TS_KEY,'0');localStorage.setItem(DB_KEY,JSON.stringify(data));return this.snapshot();},
 open(){openTournamentSeries(data.tournamentSeries[0].id);},
 snapshot(){const s=data.tournamentSeries[0];let cached=null;try{cached=JSON.parse(localStorage.getItem(DB_KEY)||'null');}catch(e){}
  return {uid:cloudUid,role:currentUserRole,allowed:canManageSeries(s),global:canWriteGlobalAppData(),series:JSON.parse(JSON.stringify(s)),
   points:seriesStandings(s).map(r=>({player:r.playerId,points:r.points})),tournaments:JSON.parse(JSON.stringify(data.tournaments)),
   cachedIds:cached?.tournamentSeries?.[0]?.tournamentIds||[],cloudError:cloudLastError,status:$('cloudStatus')?.textContent||'',ui:$('seriesModalBody').innerText};},
 async refresh(){cloudAutoSync.start();await cloudAutoSync.refresh();cloudAutoSync.stop();return this.snapshot();},
 async loginReload(role){this.identity(role);if(role!=='logout'){await initialCloudMerge();cloudAutoSync.stop();await loadSecureTournaments();}this.open();return this.snapshot();},
 async tournamentsReload(){await loadSecureTournaments();return this.snapshot();},
 storage(mode){const original=Storage.prototype.setItem;Storage.prototype.setItem=function(...a){if(mode)throw new DOMException(mode==='quota'?'full':'denied',mode==='quota'?'QuotaExceededError':'SecurityError');return original.apply(this,a);};}
};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.notEqual(html,source);
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const report={auditOfDefects:true,sha256:crypto.createHash('sha256').update(source).digest('hex'),liveAuthRules:false,scenarios:[]};
 async function client(fixture,role,{status=200,storage='',width=1440,timeoutAfterPut=false}={}){
  const app={};for(const k of ['tournamentSeries','federalCup2026','deletedTournamentIds','currentMatch'])if(fixture[k]!==undefined)app[k]=clone(fixture[k]);
  const state={cloud:{updatedAt:Date.now()-10000,data:app},etag:1,requests:[],responses:[],otherWrites:[],errors:[],status,timeoutAfterPut};
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:1000}});
  await context.route('**/*',async route=>{
   const q=route.request(),u=new URL(q.url());
   if(u.origin==='https://series-audit.local'){
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
    const f=path.resolve(root,'.'+u.pathname);if(f.startsWith(root+path.sep)&&fs.existsSync(f))return route.fulfill({path:f,contentType:f.endsWith('.js')?'application/javascript':undefined});
   }
   if(/firebaseio|firebasedatabase/.test(u.hostname)){
    if(u.pathname==='/appData.json'){
     state.requests.push({method:q.method(),path:u.pathname,role:u.searchParams.get('auth')?.replace('isolated-',''),ifMatch:q.headers()['if-match']||null});
     if(q.method()==='GET'){const snapshot=clone(state.cloud),etag=state.etag;if(state.getBarrier&&(!state.holdPlainOnly||!q.headers()['x-firebase-etag']))await state.getBarrier;return route.fulfill({json:snapshot,headers:{ETag:'"'+etag+'"','Access-Control-Expose-Headers':'ETag'}});}
     if(q.method()==='PUT'){
      if(state.status!==200){state.responses.push(state.status);return route.fulfill({status:state.status,json:{error:'isolated refusal'}});}
      if(u.searchParams.get('auth')!=='isolated-admin'){state.responses.push(403);return route.fulfill({status:403,json:{error:'mock policy, not live Rules'}});}
      if(q.headers()['if-match']!=='"'+state.etag+'"'){state.responses.push(412);return route.fulfill({status:412,json:{error:'conflict'}});}
      state.responses.push(200);
      state.cloud=q.postDataJSON();state.etag++;
      if(state.timeoutAfterPut)return route.abort();
      return route.fulfill({json:state.cloud});
     }
    }
    if(q.method()!=='GET')state.otherWrites.push({method:q.method(),path:u.pathname});
    if(u.pathname==='/tournaments.json')return route.fulfill({json:Object.fromEntries(fixture.tournaments.map(t=>[t.id,t]))});
    if(u.pathname==='/players.json')return route.fulfill({json:fixture.players});
    return route.fulfill({json:null});
   }
   return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>state.errors.push(e.message));
  page.setDefaultTimeout(8000);
  await page.goto('https://series-audit.local/');await page.waitForFunction(()=>!!window.seriesAudit);
  await page.locator('#cloudLoginModal.show').waitFor();await page.locator('#cloudOfflineBtn').click();
  await page.evaluate(({fixture,role})=>seriesAudit.seed(fixture,role),{fixture,role});
  if(storage)await page.evaluate(mode=>seriesAudit.storage(mode),storage);
  await page.evaluate(()=>seriesAudit.open());
  return {page,state,context};
 }
 let fixture;
 // Build realistic completed fixtures with the production tournament generator.
 {const empty={players:{},matches:[],tournaments:[],tournamentSeries:[{id:'x',name:'x',createdByUid:'owner',tournamentIds:[]}]};
  const c=await client(empty,'owner');fixture=await c.page.evaluate(()=>seriesAudit.synthetic());await c.context.close();}
 async function add(c,tournamentId){const s=await c.page.evaluate(()=>seriesAudit.snapshot());await c.page.locator('button[onclick="addTournamentToSeries(\''+s.series.id+'\',\''+tournamentId+'\')"]').click();}
 async function audit(role,options={}){
  const f=options.fixture||fixture,c=await client(f,role,options),target=f.tournaments.find(t=>!f.tournamentSeries[0].tournamentIds.includes(t.id)).id;
  const before=await c.page.evaluate(()=>seriesAudit.snapshot());
  if(role==='owner'&&!options.fixture&&!options.storage)await c.page.locator('#seriesModalBody table').first().screenshot({path:path.join(out,'owner-'+(options.width||1440)+'-before.png')});
  const button=c.page.locator('button[onclick="addTournamentToSeries(\''+before.series.id+'\',\''+target+'\')"]');
  assert.equal(await button.count(),before.allowed?1:0);
  if(before.allowed)await add(c,target);else await c.page.evaluate(([s,t])=>addTournamentToSeries(s,t),[before.series.id,target]);
  const immediate=await c.page.evaluate(()=>seriesAudit.snapshot());
  if(role==='owner'&&!options.fixture&&!options.storage)await c.page.locator('#seriesModalBody table').first().screenshot({path:path.join(out,'owner-'+(options.width||1440)+'-after.png')});
  if(role==='admin')for(let n=0;n<500&&!c.state.responses.length;n++)await new Promise(r=>setTimeout(r,10));
  await c.page.waitForTimeout(650);
  const after=await c.page.evaluate(()=>seriesAudit.snapshot()),puts=c.state.requests.filter(r=>r.method==='PUT');
  const games=x=>x.tournaments.map(t=>{const copy=clone(t);delete copy.seriesPlacementTieBreak;return copy;});assert.deepEqual(games(after),games(before),'adding membership does not change game data');
  assert.equal(puts.length,role==='admin'?1:0,JSON.stringify({role,allowed:before.allowed,afterRole:after.role,error:after.cloudError,requests:c.state.requests}));
  assert.equal(after.series.tournamentIds.includes(target),before.allowed);
  if(before.allowed){assert.notDeepEqual(after.points,before.points);assert.equal(immediate.ui.includes('UKLÁDÁM'),false);}
  if(options.storage&&before.allowed)assert.equal(after.cachedIds.includes(target),false);
  const serverLinked=c.state.cloud.data.tournamentSeries[0].tournamentIds.includes(target);
  assert.equal(serverLinked,role==='admin'&&(!options.status||options.status===200));
  if(before.allowed&&!serverLinked){c.state.cloud.updatedAt=Date.now()+10000;await c.page.evaluate(()=>seriesAudit.refresh());const fresh=await c.page.evaluate(()=>seriesAudit.snapshot());assert.equal(fresh.series.tournamentIds.includes(target),false);assert.deepEqual(fresh.points,before.points);}
  if(role==='admin'&&serverLinked){const t=await c.page.evaluate(()=>seriesAudit.tournamentsReload());assert.equal(t.tournaments.find(x=>x.id===target).seriesPlacementTieBreak,undefined,'tournament marker was never persisted to secure tournaments');}
  const result={role,width:options.width||1440,storage:options.storage||'normal',status:options.status||200,actualBackup:!!options.fixture,allowed:before.allowed,global:before.global,
   beforeIds:before.series.tournamentIds.length,immediateIds:immediate.series.tournamentIds.length,serverLinked,puts:puts.length,cloudError:after.cloudError,
   cachedLinked:after.cachedIds.includes(target),pointsBefore:before.points.reduce((n,r)=>n+r.points,0),pointsAfter:after.points.reduce((n,r)=>n+r.points,0),
   requests:c.state.requests,otherWrites:c.state.otherWrites,errors:c.state.errors};
  assert.deepEqual(c.state.errors,[]);report.scenarios.push(result);
  // Independent device, fresh cache: load server authority through actual startup merge.
  const second=await client({...f,tournamentSeries:clone(c.state.cloud.data.tournamentSeries)},role);
  second.state.cloud=clone(c.state.cloud);await second.page.evaluate(r=>seriesAudit.loginReload(r),role);
  const secondState=await second.page.evaluate(()=>seriesAudit.snapshot());assert.equal(secondState.series.tournamentIds.includes(target),serverLinked);
  await second.context.close();
  if(before.allowed){await c.page.reload();await c.page.waitForFunction(()=>!!window.seriesAudit);await c.page.locator('#cloudLoginModal.show').waitFor();await c.page.locator('#cloudOfflineBtn').click();await c.page.evaluate(({f,role})=>{window.auditOwner=f.tournamentSeries[0].createdByUid;seriesAudit.identity(role);}, {f,role});
   const reload=await c.page.evaluate(r=>seriesAudit.loginReload(r),role);assert.equal(reload.series.tournamentIds.includes(target),serverLinked);}
  await c.context.close();console.log('AUDIT confirmed',role,options.storage||'normal',options.status||200,'UI',beforeIds(result),'PUT',puts.length,'cloud',serverLinked);
 }
 const beforeIds=r=>r.beforeIds+'→'+r.immediateIds;
 try{
  for(const role of ['admin','owner','manager','club','player','logout'])await audit(role);
  for(const storage of ['quota','denied']){await audit('owner',{storage});await audit('admin',{storage});}
  for(const status of [401,403,412,500])await audit('admin',{status});
  await audit('admin',{timeoutAfterPut:true});
  for(const width of [390,320])await audit('owner',{width});
  const until=async predicate=>{for(let n=0;n<400;n++){if(predicate())return;await new Promise(r=>setTimeout(r,10));}throw Error('audit barrier timed out');};
  // ETag limits a simultaneous pair of admin writes; rejected UI still stays optimistic.
  {const a=await client(fixture,'admin'),b=await client(fixture,'admin');
   for(const key of ['cloud','etag'])Object.defineProperty(b.state,key,{get:()=>a.state[key],set:v=>a.state[key]=v});
   let release;const gate=new Promise(r=>release=r);a.state.getBarrier=gate;b.state.getBarrier=gate;
   await add(a,'november');await b.page.locator('#seriesEditTop_series').fill('111,80,65,55');await b.page.evaluate(()=>saveSeriesScoring('series'));
   await until(()=>a.state.requests.some(q=>q.method==='GET')&&b.state.requests.some(q=>q.method==='GET'));release();
   await until(()=>a.state.responses.length&&b.state.responses.length);assert.deepEqual([...a.state.responses,...b.state.responses].sort(),[200,412]);
   report.concurrentAdmins={statuses:[...a.state.responses,...b.state.responses],noBlindOverwrite:true};await a.context.close();await b.context.close();}
  // An already-started upload is not scoped to its captured UID before PUT.
  {const c=await client(fixture,'admin');let release;c.state.getBarrier=new Promise(r=>release=r);await add(c,'november');
   await until(()=>c.state.requests.some(q=>q.method==='GET'));await c.page.evaluate(()=>seriesAudit.identity('player'));release();
   await until(()=>c.state.responses.length);assert.equal(c.state.requests.find(q=>q.method==='PUT').role,'player');assert.deepEqual(c.state.responses,[403]);
   report.uidDuringUpload={putUsesNewIdentity:true,mockPolicyRefused:true,liveRulesNotTested:true};await c.context.close();}
  // A delayed read older than the confirmed upload cannot undo that upload.
  {const c=await client(fixture,'admin');let release;c.state.getBarrier=new Promise(r=>release=r);c.state.holdPlainOnly=true;
   const late=c.page.evaluate(()=>seriesAudit.refresh());await until(()=>c.state.requests.some(q=>q.method==='GET'));await add(c,'november');
   await until(()=>c.state.responses.includes(200));await c.page.waitForTimeout(100);release();await late;
   assert.ok((await c.page.evaluate(()=>seriesAudit.snapshot())).series.tournamentIds.includes('november'));
   report.delayedRead={olderReadAfterConfirmedUploadIgnored:true};await c.context.close();}
  // Other mutations share the same unsaved route, including the explicit false success toast.
  {const c=await client(fixture,'owner');await c.page.locator('#seriesEditTop_series').fill('111,80,65,55');
   await c.page.evaluate(()=>saveSeriesScoring('series'));assert.equal((await c.page.evaluate(()=>seriesAudit.snapshot())).series.pointsTop[0],111);assert.equal(await c.page.locator('#toast').innerText(),'Nastavení série bylo uloženo.');
   await c.page.evaluate(()=>removeTournamentFromSeries('series','october1'));await c.page.waitForTimeout(650);assert.equal(c.state.requests.filter(x=>x.method==='PUT').length,0);
   c.state.cloud.updatedAt=Date.now()+10000;await c.page.evaluate(()=>seriesAudit.refresh());const s=await c.page.evaluate(()=>seriesAudit.snapshot());assert.equal(s.series.pointsTop[0],100);assert.ok(s.series.tournamentIds.includes('october1'));
   report.otherMutations={scoringAndRemovalLost:true};await c.context.close();}
  {const c=await client(fixture,'owner');await add(c,'november');const once=await c.page.evaluate(()=>seriesAudit.snapshot());
   await c.page.evaluate(()=>{addTournamentToSeries('series','november');addTournamentToSeries('series','november');});
   const repeated=await c.page.evaluate(()=>seriesAudit.snapshot());assert.equal(repeated.series.tournamentIds.filter(id=>id==='november').length,1);assert.deepEqual(repeated.points,once.points);
   report.duplicates={oneLocalMembershipAndOneSetOfPoints:true,notProofOfCloudPersistence:true};await c.context.close();}
  // Session change after admin schedules a timer: it is not a transaction tied to the click.
  {const c=await client(fixture,'owner');await add(c,'november');await c.page.evaluate(()=>{seriesAudit.identity('player');seriesAudit.identity('owner');});assert.equal((await c.page.evaluate(()=>seriesAudit.snapshot())).series.tournamentIds.includes('november'),true);
   c.state.cloud.updatedAt=Date.now()+10000;await c.page.evaluate(()=>seriesAudit.refresh());assert.equal((await c.page.evaluate(()=>seriesAudit.snapshot())).series.tournamentIds.includes('november'),false);
   report.accountRoundTrip={localOnlyThenLost:true};await c.context.close();}
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
  console.log('AUDIT ONLY:',report.scenarios.length,'known-defect scenarios; no application fix, no live Auth/Rules, no production writes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
