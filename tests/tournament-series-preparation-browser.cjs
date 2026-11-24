'use strict';
// Opt-in prospective UI wiring only inside this isolated harness. Production is not switched.
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
 data=defaultData();data.players=Object.fromEntries(['a','b','c','d'].map(id=>[id,{id,name:id,active:true}]));
 data.tournaments=['previous1','previous2','november'].map(id=>{const t=generateGroupTournament(id,['a','b','c','d'],'9-ball',5,'alternate',1,{},1,'manual');t.id=id;t.createdByUid='owner';t.status='complete';for(const m of t.groups[0].matches){m.status='done';m.winnerId=m.player1Id;m.loserId=m.player2Id;m.score1=5;m.score2=2;}return t;});
 data.tournamentSeries=[{id:'s',createdByUid:'owner',managerUids:{manager:true},name:'Lounská testovací série',tournamentIds:['previous1','previous2'],scoringMode:'bands',placementTieBreak:'legacy',pointsTop:[100,80,65,55],pointsBands:[45,25,10,5],updatedAt:'2026-11-24T00:00:00Z',future:{keep:42}},
 {id:'standard',createdByUid:'owner',name:'Standardní série',tournamentIds:['november'],pointsTop:[100,80,65,55]}];
 data=normalizeDataObject(saved||data);showScreen('tournament');document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));return JSON.parse(JSON.stringify(data));},
 async connect(base,token){
 this.repo=TournamentSeriesRepository.create({enabled:()=>true,identity:()=>({uid:cloudUid,authenticated:cloudAuthenticated,emailVerified:cloudEmailVerified,role:currentUserRole,generation:cloudSessionGeneration}),authorize:async()=>({uid:cloudUid,idToken:token}),
 url:(p,c)=>base+'/'+p+'.json?ns=demo-pool-series&auth='+encodeURIComponent(c),fetch:(...args)=>fetch(...args)});
 const loaded=await this.repo.read('s');data.tournamentSeries[0]=loaded.series;
 this.published=0;let status=document.getElementById('seriesPreparedStatus');if(!status){status=document.createElement('p');status.id='seriesPreparedStatus';status.setAttribute('role','status');document.getElementById('seriesModalBody').parentElement.append(status);}
 this.actions=TournamentSeriesRepository.createActions({repository:this.repo,identity:()=>({uid:cloudUid,authenticated:cloudAuthenticated,emailVerified:cloudEmailVerified,role:currentUserRole,generation:cloudSessionGeneration}),
 pending:busy=>{document.querySelectorAll('#seriesModalBody button[onclick*="TournamentToSeries"],#seriesModalBody button[onclick*="saveSeriesScoring"]').forEach(b=>b.disabled=busy);},message:message=>status.textContent=message,
 confirmed:series=>{this.published++;data.tournamentSeries[0]=series;renderSeriesModal();localStorage.setItem('isolated-series-confirmed',JSON.stringify(series));}});
 window.addTournamentToSeries=(s,t)=>this.actions.run(s,{type:'add',tournamentId:t}).catch(()=>null);
 window.removeTournamentFromSeries=(s,t)=>this.actions.run(s,{type:'remove',tournamentId:t}).catch(()=>null);
 window.saveSeriesScoring=s=>this.actions.run(s,{type:'scoring',fields:{scoringMode:$('seriesEditScoringMode_'+s).value,placementTieBreak:$('seriesEditPlacementTieBreak_'+s).value,
 bestCount:Number($('seriesEditBestCount_'+s).value),pointsTop:parsePointList($('seriesEditTop_'+s).value,[100,80,65,55]),pointsBands:parsePointList($('seriesEditBandsPts_'+s).value,[45,25,10,5]),
 customPointsText:$('seriesEditCustomPts_'+s).value,customPoints:parseCustomSeriesPoints($('seriesEditCustomPts_'+s).value)}}).catch(()=>null);
 openTournamentSeries('s');
 },
 state(){return {ids:data.tournamentSeries[0].tournamentIds,points:seriesStandings(data.tournamentSeries[0]).map(r=>[r.playerId,r.points]),standard:seriesStandings(data.tournamentSeries[1]).map(r=>[r.playerId,r.points]),
 tournaments:JSON.stringify(data.tournaments),unknown:data.tournamentSeries[0].future,published:this.published,top:data.tournamentSeries[0].pointsTop};},
 storage(mode){if(!this.originalStorage)this.originalStorage=Storage.prototype.setItem;const original=this.originalStorage;Storage.prototype.setItem=function(...args){if(mode)throw new DOMException(mode,mode==='quota'?'QuotaExceededError':'SecurityError');return original.apply(this,args);};}
};`;
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>'<script src="/assets/js/tournament-series-repository.js"></script>'+a+b+hook+c);
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
(async()=>{
 await control('.settings/rules',JSON.parse(fs.readFileSync(file,'utf8')));
 const browser=await chromium.launch({channel:'chrome',headless:true}),report=[];
 try{for(const width of [1440,390,320]){
  let hold=deferred(),holding=true,localPuts=0;const errors=[],otherWrites=[];
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:1000}});
  await context.route('**/*',async route=>{const q=route.request(),u=new URL(q.url());
   if(u.origin===base){
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const f=path.resolve(root,'.'+u.pathname);if(f.startsWith(root+path.sep)&&fs.existsSync(f))return route.fulfill({path:f,contentType:f.endsWith('.js')?'application/javascript':undefined});
    assert.equal(u.searchParams.get('ns'),ns);if(q.method()==='PUT'){localPuts++;if(holding)await hold.promise;}return route.continue();
   }
   // Existing unrelated app services are mocked, never sent to production.
   if(/firebaseio|firebasedatabase|googleapis/.test(u.hostname)){if(q.method()!=='GET')otherWrites.push({method:q.method(),path:u.pathname});return route.fulfill({json:null});}
   return route.abort();
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
  async function start(){await p.goto(base+'/');await p.locator('#cloudLoginModal.show').waitFor();await p.locator('#cloudOfflineBtn').click();return p.evaluate(()=>seriesUI.make());}
  const initial=await start();await control('',{users:{owner:{uid:'owner',email:'owner@example.invalid',role:'player'}},tournaments:Object.fromEntries(initial.tournaments.map(t=>[t.id,t])),tournamentSeries:{s:api.encodeLegacy(initial.tournamentSeries[0])}});
  await p.evaluate(({base,token})=>seriesUI.connect(base,token),{base,token});const before=await p.evaluate(()=>seriesUI.state());
  await p.locator('button[onclick="addTournamentToSeries(\'s\',\'november\')"]').click();
  await p.waitForFunction(()=>document.getElementById('seriesPreparedStatus').textContent==='UKLÁDÁM…');
  assert.deepEqual((await p.evaluate(()=>seriesUI.state())).ids,before.ids,'pending does not publish optimistic membership');
  await p.evaluate(()=>{addTournamentToSeries('s','november');addTournamentToSeries('s','november');});
  holding=false;hold.resolve();await p.waitForFunction(()=>seriesUI.state().ids.includes('november'));
  assert.equal(localPuts,1);assert.equal((await p.evaluate(()=>seriesUI.state())).published,1);assert.equal(await p.locator('#seriesPreparedStatus').innerText(),'ZMĚNY BYLY ULOŽENY');
  let after=await p.evaluate(()=>seriesUI.state());assert.equal(after.tournaments,before.tournaments);assert.deepEqual(after.standard,before.standard);assert.deepEqual(after.unknown,{keep:42});
  await p.screenshot({path:path.join(out,width+'-confirmed.png')});
  // Actual reload: rebuild UI from the unchanged tournament fixture, then read server authority.
  await p.reload();await p.locator('#cloudLoginModal.show').waitFor();await p.locator('#cloudOfflineBtn').click();await p.evaluate(initial=>seriesUI.make(initial),initial);await p.evaluate(({base,token})=>seriesUI.connect(base,token),{base,token});assert.ok((await p.evaluate(()=>seriesUI.state())).ids.includes('november'));
  await p.locator('button[onclick="removeTournamentFromSeries(\'s\',\'november\')"]').click();await p.waitForFunction(()=>!seriesUI.state().ids.includes('november'));
  await p.locator('#seriesEditTop_s').fill('111,80,65,55');await p.locator('button[onclick="saveSeriesScoring(\'s\')"]').click();await p.waitForFunction(()=>seriesUI.state().top[0]===111);
  for(const mode of ['quota','denied']){
   await p.evaluate(mode=>seriesUI.storage(mode),mode);await p.locator('button[onclick="addTournamentToSeries(\'s\',\'november\')"]').click();await p.waitForFunction(()=>seriesUI.state().ids.includes('november'));
   assert.match(await p.locator('#seriesPreparedStatus').innerText(),/potvrzen/);
   await p.locator('button[onclick="removeTournamentFromSeries(\'s\',\'november\')"]').click();await p.waitForFunction(()=>!seriesUI.state().ids.includes('november'));
  }
  after=await p.evaluate(()=>seriesUI.state());assert.deepEqual(after.standard,before.standard);assert.equal(after.tournaments,before.tournaments);assert.deepEqual(errors,[]);
  report.push({width,localPuts,errors,otherMockedWrites:otherWrites,productionWrites:0,actualRulesEngine:true,liveAuth:false,tournamentsUnchanged:true,otherSeriesUnchanged:true});
  await context.close();console.log('PASS browser/emulator',width,'confirmed UI, single PUT, reload, scoring, quota/denied, scoped statistics; no production writes');
 }}finally{await browser.close();}
 fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
