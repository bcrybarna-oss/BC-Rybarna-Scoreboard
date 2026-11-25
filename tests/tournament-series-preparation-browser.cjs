'use strict';
// Actual application handlers; only build switch and endpoint are changed for local isolation.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright');
const api=require('../assets/js/tournament-series-repository.js'),root=path.resolve(__dirname,'..');
const file=process.env.SERIES_RULES_FILE;if(!file)throw Error('SERIES_RULES_FILE required; no mock fallback for Rules');
const base='http://127.0.0.1:'+Number(process.env.SERIES_EMULATOR_PORT||19006),ns='demo-pool-series';
const out=path.resolve(process.env.SERIES_UI_OUT||'output/series-preparation-ui');fs.mkdirSync(out,{recursive:true});
const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
const now=Math.floor(Date.now()/1000),token=enc({alg:'none',typ:'JWT'})+'.'+enc({iss:'https://securetoken.google.com/'+ns,aud:ns,sub:'owner',user_id:'owner',iat:now,exp:now+3600,auth_time:now,email:'owner@example.invalid',email_verified:true,firebase:{sign_in_provider:'custom',identities:{}}})+'.';
async function control(p,data){const r=await fetch(base+'/'+p+'.json?ns='+ns,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(data)});assert.equal(r.status,200);}
const hook=`
window.seriesUI={
 make(saved){clearRuntimeCloudIdentity();cloudUid='owner';cloudAuthenticated=true;cloudEmailVerified=true;currentUserRole='player';cloudIdToken='isolated-not-a-real-token';cloudTokenExpiresAt=Date.now()+3600000;
 data=defaultData();data.players=Object.fromEntries(['a','b','c','d'].map(id=>[id,{id,name:id,active:true,...(id==='b'?{ownerUid:'helper'}:{})}]));
 data.tournaments=['previous1','previous2','november'].map(id=>{const t=generateGroupTournament(id,['a','b','c','d'],'9-ball',5,'alternate',1,{},1,'manual');t.id=id;t.createdByUid='owner';t.status='complete';for(const m of t.groups[0].matches){m.status='done';m.winnerId=m.player1Id;m.loserId=m.player2Id;m.score1=5;m.score2=2;}return t;});
 data.tournamentSeries=[{id:'s',createdByUid:'owner',managerUids:{manager:true},name:'Lounská testovací série',tournamentIds:['previous1','previous2'],scoringMode:'bands',placementTieBreak:'legacy',pointsTop:[100,80,65,55],pointsBands:[45,25,10,5],updatedAt:'2026-11-24T00:00:00Z',future:{keep:42}},
 {id:'standard',createdByUid:'owner',name:'Standardní série',tournamentIds:['november'],pointsTop:[100,80,65,55]}];
 data=normalizeDataObject(saved||data);document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));return JSON.parse(JSON.stringify(data));},
 async connect(base,token){
 cloudIdToken=token;syncSecureSeriesIdentity();await loadSecureSeries();showScreen('tournament');openTournamentSeries('s');
 },
 state(){return {ids:data.tournamentSeries[0].tournamentIds,points:seriesStandings(data.tournamentSeries[0]).map(r=>[r.playerId,r.points]),standard:seriesStandings(data.tournamentSeries[1]).map(r=>[r.playerId,r.points]),
 tournaments:JSON.stringify(data.tournaments),unknown:data.tournamentSeries[0].future,top:data.tournamentSeries[0].pointsTop};},
 storage(mode){if(!this.originalStorage)this.originalStorage=Storage.prototype.setItem;const original=this.originalStorage;Storage.prototype.setItem=function(...args){if(mode)throw new DOMException(mode,mode==='quota'?'QuotaExceededError':'SecurityError');return original.apply(this,args);};}
};window.seriesTestRun=(source,arg)=>eval('('+source+')')(arg);`;
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const isolated=source.replace('const SERIES_AUTHORITY_ENABLED=false;','const SERIES_AUTHORITY_ENABLED=true;').replace(/https:\/\/bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app/g,base);
const html=isolated.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
const app=(page,fn,arg)=>page.evaluate(({source,arg})=>seriesTestRun(source,arg),{source:String(fn),arg});
const sport=x=>api.canonical(JSON.parse(x).sort((a,b)=>a.id.localeCompare(b.id)));
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{
 await control('.settings/rules',JSON.parse(fs.readFileSync(file,'utf8')));
 const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
 try{for(const width of [1440,390,320]){
  let hold=deferred(),holding=true,localPuts=0,loseCreateAck=false;const errors=[],otherWrites=[];
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:1000}});
  await context.route('**/*',async route=>{const q=route.request(),u=new URL(q.url());
   if(u.origin===base){
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const f=path.resolve(root,'.'+u.pathname);if(f.startsWith(root+path.sep)&&fs.existsSync(f))return route.fulfill({path:f,contentType:f.endsWith('.js')?'application/javascript':undefined});
    u.searchParams.set('ns',ns);if(q.method()!=='GET'&&!u.pathname.startsWith('/tournamentSeries/'))otherWrites.push({method:q.method(),path:u.pathname});if(q.method()==='PUT'){localPuts++;if(holding)await hold.promise;if(loseCreateAck&&/^\/tournamentSeries\/[^/]+\.json$/.test(u.pathname)){loseCreateAck=false;const committed=await route.fetch({url:u.toString()});assert.equal(committed.status(),200);return route.abort('failed');}}return route.continue({url:u.toString()});
   }
   // Existing unrelated app services are mocked, never sent to production.
   if(/firebaseio|firebasedatabase|googleapis/.test(u.hostname)){if(q.method()!=='GET')otherWrites.push({method:q.method(),path:u.pathname});return route.fulfill({json:null});}
   return route.abort();
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
  async function start(){await p.goto(base+'/');await p.locator('#cloudLoginModal.show').waitFor();await p.locator('#cloudOfflineBtn').click();return p.evaluate(()=>seriesUI.make());}
  const initial=await start();await control('',{players:initial.players,users:{owner:{uid:'owner',email:'owner@example.invalid',role:'player'},helper:{uid:'helper',email:'helper@example.invalid',role:'player'}},tournaments:Object.fromEntries(initial.tournaments.map(t=>[t.id,t])),tournamentSeries:Object.fromEntries(initial.tournamentSeries.map(s=>[s.id,api.encodeLegacy(s)]))});
  await p.evaluate(({base,token})=>seriesUI.connect(base,token),{base,token});const before=await p.evaluate(()=>seriesUI.state());
  await p.locator('button[onclick="addTournamentToSeries(\'s\',\'november\')"]').click();
  await p.waitForFunction(()=>document.getElementById('seriesPersistenceStatus').textContent==='UKLÁDÁM…');
  assert.deepEqual((await p.evaluate(()=>seriesUI.state())).ids,before.ids,'pending does not publish optimistic membership');
  await p.evaluate(()=>{addTournamentToSeries('s','november');addTournamentToSeries('s','november');});
  holding=false;hold.resolve();await p.waitForFunction(()=>seriesUI.state().ids.includes('november'));
  assert.equal(localPuts,1);assert.equal(await p.locator('#seriesPersistenceStatus').innerText(),'ZMĚNY BYLY ULOŽENY');
  let after=await p.evaluate(()=>seriesUI.state());assert.deepEqual(sport(after.tournaments),sport(before.tournaments));assert.deepEqual(after.standard,before.standard);assert.deepEqual(after.unknown,{keep:42});
  await p.screenshot({path:path.join(out,width+'-confirmed.png')});
  // Actual reload: rebuild UI from the unchanged tournament fixture, then read server authority.
  await p.reload();await p.locator('#cloudLoginModal.show').waitFor();await p.locator('#cloudOfflineBtn').click();await p.evaluate(initial=>seriesUI.make(initial),initial);await p.evaluate(({base,token})=>seriesUI.connect(base,token),{base,token});assert.ok((await p.evaluate(()=>seriesUI.state())).ids.includes('november'));
  await p.locator('button[onclick="removeTournamentFromSeries(\'s\',\'november\')"]').click();await p.waitForFunction(()=>!seriesUI.state().ids.includes('november'));
  await p.locator('#seriesEditTop_s').fill('111,80,65,55');await p.locator('button[onclick="saveSeriesScoring(\'s\')"]').click();await p.waitForFunction(()=>seriesUI.state().top[0]===111);
  // Another authorized device changes scoring while this user's draft remains open.
  await p.locator('#seriesEditTop_s').fill('777,80,65,55');
  const other=require('./tournament-series-repository-emulator.cjs').client('manager');await other.repo.mutate('s',{type:'scoring',fields:{pointsTop:[222,80,65,55]}});other.repo.dispose();
  await app(p,()=>loadSecureSeries());assert.equal(await p.locator('#seriesEditTop_s').inputValue(),'777,80,65,55');
  const beforeConflict=localPuts;await p.locator('button[onclick="saveSeriesScoring(\'s\')"]').click();
  await p.waitForFunction(()=>document.getElementById('seriesPersistenceStatus').textContent.includes('mezitím změnila'));
  assert.equal(localPuts,beforeConflict);assert.equal((await p.evaluate(()=>seriesUI.state())).top[0],222);assert.equal(await p.locator('#seriesEditTop_s').inputValue(),'777,80,65,55');
  await app(p,()=>renderSeriesModal());
  for(const mode of ['quota','denied']){
   await p.evaluate(mode=>seriesUI.storage(mode),mode);await p.locator('button[onclick="addTournamentToSeries(\'s\',\'november\')"]').click();await p.waitForFunction(()=>seriesUI.state().ids.includes('november'));
   assert.match(await p.locator('#seriesPersistenceStatus').innerText(),/potvrzen/);
   await p.locator('button[onclick="removeTournamentFromSeries(\'s\',\'november\')"]').click();await p.waitForFunction(()=>!seriesUI.state().ids.includes('november'));
  }
  after=await p.evaluate(()=>seriesUI.state());assert.deepEqual(after.standard,before.standard);assert.deepEqual(sport(after.tournaments),sport(before.tournaments));assert.deepEqual(errors,[]);
  // Install the manual snapshot adapter in the real lexical scope; no copied credentials.
  const factory=fs.readFileSync(path.join(root,'scripts/series-readonly-snapshots.js'),'utf8');await p.addScriptTag({content:factory});
  const adapter=fs.readFileSync(path.join(root,'scripts/series-snapshot-console-adapter.js'),'utf8').replace('})()','})({allowLocalEmulator:true})');
  const beforeInstall=localPuts;const installed=await app(p,source=>eval(source),adapter);assert.equal(installed.requestsSent,0);assert.equal(localPuts,beforeInstall);
  const download=await p.evaluate(()=>seriesSnapshotHelper.plan());assert.equal(download.readOnly,true);
  const downloads=[];p.on('download',d=>downloads.push(d));
  const manifest=await p.evaluate(async()=>{const files=await seriesSnapshotHelper.capture({approval:'READ ONLY SERIES SNAPSHOTS'});return seriesSnapshotHelper.save(files);});
  for(let i=0;i<50&&downloads.length<4;i++)await p.waitForTimeout(20);assert.equal(downloads.length,4);assert.equal(manifest.length,3);
  for(const d of downloads){const destination=path.join(out,String(width)+'-'+d.suggestedFilename());await d.saveAs(destination);if(d.suggestedFilename().endsWith('-snapshot-manifest.json'))continue;
   const bytes=fs.readFileSync(destination),row=manifest.find(m=>m.filename===d.suggestedFilename());assert.equal(require('crypto').createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(bytes.length,row.bytes);
   const parsed=JSON.parse(bytes);assert.ok(parsed.capture.etag);assert.equal(parsed.capture.databaseUrl,base);assert.ok(!bytes.includes(Buffer.from(token)));}
  assert.equal(localPuts,beforeInstall,'snapshot capture/save performs no PUT');

  // Exercise actual remaining form handlers, not replacement callbacks.
  await app(p,()=>seriesUI.storage(''));
  await app(p,async()=>{document.getElementById('seriesOrganizerSelect_s').value='helper';await addSeriesOrganizer('s');});
  assert.equal(await app(p,()=>data.tournamentSeries.find(s=>s.id==='s').managerUids.helper),true);
  await app(p,()=>removeSeriesOrganizer('s','helper'));
  assert.equal(await app(p,()=>data.tournamentSeries.find(s=>s.id==='s').managerUids.helper),undefined);
  await app(p,async()=>{
   $('seriesHistoricalName_s').value='Synthetic history';$('seriesHistoricalDate_s').value='2026-01-01';$('seriesHistoricalMode_s').value='placements';toggleSeriesHistoricalMode('s');
   if(!$('seriesHistoricalPlacementRows_s').children.length){addHistoricalPlacementRow('s');addHistoricalPlacementRow('s');}
   [...$('seriesHistoricalPlacementRows_s').children].forEach((row,i)=>{row.querySelector('.historical-place').value=String(i+1);row.querySelector('select').value=['a','b','c','d'][i];});await addHistoricalTournamentToSeries('s');
  });
  const historicalId=await app(p,()=>data.tournamentSeries.find(s=>s.id==='s').historicalTournaments?.at(-1)?.id);assert.ok(historicalId);
  p.once('dialog',d=>d.accept());await app(p,id=>deleteHistoricalSeriesTournament('s',id),historicalId);
  assert.equal(await app(p,()=>data.tournamentSeries.find(s=>s.id==='s').historicalTournaments.length),0);
  await app(p,async()=>{
   $('seriesHistoricalName_s').value='Synthetic full history';$('seriesHistoricalDate_s').value='2026-01-02';$('seriesHistoricalMode_s').value='full';toggleSeriesHistoricalMode('s');
   if(!$('seriesHistoricalMatchRows_s').children.length)addHistoricalMatchRow('s');
   for(const row of $('seriesHistoricalMatchRows_s').children){row.querySelector('.historical-stage').value='final';const players=row.querySelectorAll('.historical-player-select');players[0].value='a';players[1].value='b';row.querySelector('.historical-score1').value='5';row.querySelector('.historical-score2').value='2';}
   await addHistoricalTournamentToSeries('s');
  });
  const full=await app(p,()=>data.tournamentSeries.find(s=>s.id==='s').historicalTournaments.at(-1));assert.ok(full);assert.equal(full.statsComplete,true);assert.ok(full.matches.length>0);assert.equal(full.results.length,2);
  p.once('dialog',d=>d.accept());await app(p,id=>deleteHistoricalSeriesTournament('s',id),full.id);
  const created=await app(p,async()=>{
   $('seriesName').value='Synthetic created';$('seriesClub').value='Test';$('seriesSeason').value='2026';
   const first=$('createSeriesBtn').onclick(),second=$('createSeriesBtn').onclick();await Promise.all([first,second]);return data.tournamentSeries.filter(s=>s.name==='Synthetic created').map(s=>s.id);
  });assert.equal(created.length,1,'same pending create uses one stable ID');
  // Lost ACK creation: stable ID and unsaved form survive A->B->A in memory; no blind retry.
  const beforeLost=localPuts;loseCreateAck=true;
  await app(p,async()=>{$('seriesName').value='Uncertain synthetic';await $('createSeriesBtn').onclick();});
  const uncertainId=await app(p,()=>secureSeriesCreateDraft.id);assert.equal(await app(p,id=>secureSeriesRepository.isUncertain(id),uncertainId),true);assert.equal(localPuts,beforeLost+1);
  const bToken=require('./tournament-series-repository-emulator.cjs').token({uid:'helper',emailVerified:true});
  await app(p,async token=>{cloudUid='helper';cloudIdToken=token;cloudSessionGeneration++;syncSecureSeriesIdentity();await loadSecureSeries();},bToken);
  assert.equal(await p.locator('#seriesName').inputValue(),'');await app(p,()=>{$('seriesName').value='Helper independent draft';});
  await app(p,async token=>{cloudUid='owner';cloudIdToken=token;cloudSessionGeneration++;syncSecureSeriesIdentity();await loadSecureSeries();},token);
  assert.equal(await p.locator('#seriesName').inputValue(),'Uncertain synthetic');assert.equal(await app(p,()=>secureSeriesCreateDraft.id),uncertainId);
  await app(p,()=>$('createSeriesBtn').onclick());assert.equal(localPuts,beforeLost+1);await app(p,()=>$('tournamentSeriesTabBtn').click());
  await p.getByRole('button',{name:'PROHLÉDNOUT AKTUÁLNÍ STAV',exact:true}).click();const release=p.getByRole('button',{name:'POKRAČOVAT PO VLASTNÍM OVĚŘENÍ',exact:true});await release.waitFor();
  for(let i=0;i<100&&await release.isDisabled();i++)await p.waitForTimeout(10);assert.equal(await release.isDisabled(),false);
  p.once('dialog',d=>d.dismiss());await release.click();assert.equal(await app(p,id=>secureSeriesRepository.isUncertain(id),uncertainId),true);
  p.once('dialog',d=>d.accept());await release.click();assert.equal(await app(p,id=>secureSeriesRepository.isUncertain(id),uncertainId),false);assert.equal(localPuts,beforeLost+1);
  await app(p,()=>{if($('seriesCreatePanel').classList.contains('hidden'))$('toggleSeriesCreateBtn').click();});const abandon=p.getByRole('button',{name:'OPUSTIT NEPOTVRZENOU PŘÍPRAVU SÉRIE',exact:true});
  p.once('dialog',d=>d.dismiss());await abandon.click();assert.equal(await app(p,()=>secureSeriesCreateDraft.id),uncertainId);
  p.once('dialog',d=>d.accept());await abandon.click();assert.equal(await app(p,()=>secureSeriesCreateDraft),null);assert.equal(localPuts,beforeLost+1);
  const beforeBlocked=localPuts;
  await app(p,()=>{deleteTournamentSeries('s');openHistoricalStructureSetup('s');});
  const blocked=await app(p,async()=>{const previous=tournamentCreationPending;tournamentCreationPending={tournament:{id:'synthetic-old-pending',createdByUid:'owner'},seriesId:'s'};await $('createTournamentBtn').onclick();tournamentCreationPending=previous;await uploadCloudData();restoreSafetyBackup();await historicalUiAction(()=>{throw Error('must not run');});try{await saveFederalConfig({},{});}catch(e){return e.message;}});assert.match(blocked,/oprávnění/);
  const idsBeforeImport=await app(p,()=>data.tournamentSeries.map(s=>s.id));
  await p.locator('#importFile').setInputFiles({name:'synthetic-stale.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({players:{},matches:[],tournamentSeries:[{id:'stale'}]}))});
  assert.deepEqual(await app(p,()=>data.tournamentSeries.map(s=>s.id)),idsBeforeImport);
  assert.equal(localPuts,beforeBlocked);assert.match(await p.locator('#seriesPersistenceStatus').innerText(),/blokovan/);
  assert.deepEqual(sport(await app(p,()=>JSON.stringify(data.tournaments))),sport(before.tournaments));
  await app(p,async()=>{for(let i=0;i<12;i++){showScreen('home');showScreen('tournament');}await loadSecureSeries();});
  assert.equal((await app(p,()=>secureSeriesRepository.snapshot())).activeJobs,0);
  await app(p,()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
  assert.equal((await app(p,()=>secureSeriesRepository.snapshot())).disposed,false);
  // Revoked collaborator retains unsaved text but cannot use stale edit controls.
  const ownerClient=require('./tournament-series-repository-emulator.cjs').client('owner');await ownerClient.repo.mutate('s',{type:'manager-add',uid:'helper'});
  const helperToken=require('./tournament-series-repository-emulator.cjs').token({uid:'helper',emailVerified:true});
  await app(p,async token=>{cloudUid='helper';cloudIdToken=token;cloudSessionGeneration++;syncSecureSeriesIdentity();await loadSecureSeries();openTournamentSeries('s');},helperToken);
  await p.locator('#seriesEditTop_s').fill('888,80,65,55');await ownerClient.repo.mutate('s',{type:'manager-remove',uid:'helper'});ownerClient.repo.dispose();await app(p,()=>loadSecureSeries());
  assert.equal(await p.locator('#seriesEditTop_s').inputValue(),'888,80,65,55');assert.equal(await p.locator('button[onclick="saveSeriesScoring(\'s\')"]').isDisabled(),true);
  // Stale global merges cannot become series authority. Account change clears old view.
  const mergedIds=await app(p,()=>mergeDataObjects(data,{...defaultData(),tournamentSeries:[{id:'stale'}]},true).tournamentSeries.map(s=>s.id));assert.ok(!mergedIds.includes('stale'));
  await app(p,()=>{cloudUid='helper';cloudSessionGeneration++;syncSecureSeriesIdentity();});assert.equal(await app(p,()=>data.tournamentSeries.length),0);
  await app(p,()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));assert.equal((await app(p,()=>secureSeriesRepository.snapshot())).disposed,true);
  assert.deepEqual(errors,[]);
  report.push({width,localPuts,errors,otherMockedWrites:otherWrites,productionWrites:0,actualRulesEngine:true,liveAuth:false,tournamentsUnchanged:true,otherSeriesUnchanged:true});
  await context.close();console.log('PASS integrated browser/emulator',width,'membership/scoring/create/managers/history, reload, quota/denied, identity, blocked paths, scoped statistics; no production writes');
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
