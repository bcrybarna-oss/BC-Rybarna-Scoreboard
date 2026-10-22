'use strict';
// Two independent browser storage/auth contexts; all HTTP is intercepted.
// FC_SOURCE_REF lets the same scenarios demonstrate the original four regressions.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {execFileSync}=require('child_process');
const source=process.env.FC_SOURCE_REF?execFileSync('git',['show',process.env.FC_SOURCE_REF+':index.html'],{encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`window.reg={
 get data(){return data},get match(){return match},get error(){return cloudLastError},
 admin(){cloudUserEmail='bcrybarna@gmail.com';cloudAuthenticated=true;cloudUid='isolated-admin';cloudEmailVerified=true;currentUserRole='system_admin';cloudIdToken='mock';cloudTokenExpiresAt=Date.now()+3600000;$('cloudLoginModal').classList.remove('show');},
 config(c){data.federalCup2026=c;},normalized(c){return normalizeDataObject({...defaultData(),federalCup2026:c}).federalCup2026},
 async pull(){const r=await fetch(cloudUrl('appData'));data.federalCup2026=this.normalized((await r.json()).data.federalCup2026);renderFederalCup2026();},
 save:typeof saveFederalConfig==='function'?saveFederalConfig:null,upload:uploadCloudData,
 render:renderFederalCup2026,screen:showScreen,start:startMatch,undo,autosave:autosaveCurrent,backup:saveActiveMatchCloudBackupNow,persist:persistFinishedMatch,
 calculate:typeof federalCalculateMatch==='function'?federalCalculateMatch:null,summary:federalEvidenceSummary,participant:federalParticipantSnapshot,ensure:ensureFederalParticipants,
 clear(){document.querySelectorAll('.fc26-roster-player').forEach(e=>{delete e.dataset.dirty;delete e.dataset.newParticipant;});stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);match=null;data=defaultData();pendingFederalCupLink=null;for(const k of [LOCAL_ACTIVE_MATCH_KEY,LOCAL_ACTIVE_MATCHES_KEY,LOCAL_ACTIVE_MATCH_RECOVERY_KEY])localStorage.removeItem(k);document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));},
 async resume(){const m=loadDeviceActiveMatch();if(m)await resumeLocalMatch(m.id);},
 correct(a,b){$('manualScoreCorrectionP1').value=a;$('manualScoreCorrectionP2').value=b;$('manualScoreCorrectionConfirmBtn').click();},
 pot(){actionBreakOk();pendingBreakBalls=[1];finishExactBreakBalls();actionLegal();pendingShotBallSelection=[9];finishShotBallSelection();$('higherBallComboBtn').click();},
 sparseTeam(){match.federalCupLink.rosterA={4:'SK5'};match.federalCupLink.rosterParticipants[0]={4:{id:'a5',name:'SK5',team:'a'}};match.federalTeam.players=[null,null];match.federalTeam.pending=true;renderMatch();}
};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
const copy=x=>JSON.parse(JSON.stringify(x));
// RTDB removes nulls/empty nodes and can return sparse numeric keys as objects.
function wire(v){if(v===null||v===undefined)return null;if(typeof v!=='object')return v;const out={};for(const [k,x]of Object.entries(v)){const y=wire(x);if(y!==null)out[k]=y;}const keys=Object.keys(out);if(!keys.length)return null;if(keys.every(k=>/^\d+$/.test(k))){const max=Math.max(...keys.map(Number));if(keys.length>max/2){const a=Array(max+1).fill(null);for(const k of keys)a[k]=out[k];return a;}}return out;}
function config(){const c={year:2026,teamAName:'Slovensko',teamBName:'Česko',rosterMode:'manual',rosterA:[],rosterB:[],rosterParticipantIdsA:[],rosterParticipantIdsB:[],participants:{},lineups:{3:{a:['a3'],b:['b3']}},teamResults:{},updatedAt:0};for(const [side,prefix]of [['A','SK'],['B','CZ']])for(let i=1;i<=5;i++){const id=side.toLowerCase()+i;c['roster'+side].push(prefix+i);c['rosterParticipantIds'+side].push(id);c.participants[id]={id,name:prefix+i,team:side.toLowerCase(),year:2026};}return c;}
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});let db={},version=0,appWrites=[],race=null,deny=false,omitEtag=false;const errors=[],clients=[];
 function seed(c=config()){db={appData:{updatedAt:1,data:{federalCup2026:copy(c),unrelated:{keep:'server'}}}};version++;appWrites=[];race=null;deny=false;omitEtag=false;}
 async function routeHandler(route){const q=route.request(),u=q.url();if(u==='http://fc-conflicts.local/')return route.fulfill({contentType:'text/html',body:html});if(u.includes('identitytoolkit.googleapis.com'))return route.fulfill({contentType:'application/json',body:JSON.stringify({users:[{localId:'isolated-admin',email:'bcrybarna@gmail.com',emailVerified:true}]})});if(!u.includes('.json'))return route.abort();const parts=new URL(u).pathname.replace(/\.json$/,'').split('/').filter(Boolean);let parent=db;for(const p of parts.slice(0,-1))parent=parent[p]??={};const leaf=parts.at(-1),app=leaf==='appData';
  if(app&&deny)return route.fulfill({status:403,body:'null'});
  if(q.method()==='PUT'||q.method()==='PATCH'){
   if(app){if(race){const fn=race;race=null;fn();version++;}const tag=q.headers()['if-match'];appWrites.push({tag,accepted:!tag||tag==='"'+version+'"'});if(tag&&tag!=='"'+version+'"')return route.fulfill({status:412,body:JSON.stringify(wire(parent[leaf]))});version++;}
   const value=q.postDataJSON();parent[leaf]=q.method()==='PATCH'?{...parent[leaf],...value}:value;
  }
  if(q.method()==='DELETE')delete parent[leaf];
  return route.fulfill({contentType:'application/json',headers:app&&!omitEtag?{ETag:'"'+version+'"','Access-Control-Expose-Headers':'ETag'}:{},body:JSON.stringify(wire(parent[leaf]))});
 }
 async function client(){const ctx=await browser.newContext({serviceWorkers:'block'});await ctx.route('**/*',routeHandler);const p=await ctx.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.dismiss());await p.goto('http://fc-conflicts.local/');await p.waitForFunction(()=>!!window.reg);await p.waitForSelector('#cloudLoginModal.show');await p.evaluate(()=>reg.admin());clients.push(p);return p;}
 const a=await client(),b=await client();
 async function reset(c=config()){seed(c);for(const p of clients)await p.evaluate(async()=>{reg.clear();reg.admin();await reg.pull();reg.admin();});appWrites=[];}
 async function editor(p){await p.evaluate(()=>reg.screen('federal-cup-editor'));}
 async function saveUI(p){await p.evaluate(()=>document.getElementById('toast').textContent='');await p.locator('#fc26SaveSettings').click();await p.waitForFunction(()=>document.getElementById('toast').textContent);if(process.env.FC_SOURCE_REF)await p.waitForTimeout(800);}
 async function start(p,n=3){await p.evaluate(async n=>{await fc26StartFixture(n);document.getElementById('fc26LagWinner').value='0';document.getElementById('useLag').checked=false;reg.start();},n);assert.ok(await p.evaluate(()=>reg.match?.federalCupLink));}
 const results=[];
 async function scenario(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(e){results.push({name,ok:false});console.error('FAIL '+name+': '+e.stack);}}
 try{
 await scenario('P1 resume/display never overwrite a newer lineup from isolated client B',async()=>{
  await reset();await start(a);await a.evaluate(()=>reg.autosave());
  await editor(b);await b.evaluate(async()=>{const base=JSON.parse(JSON.stringify(reg.data.federalCup2026)),next=JSON.parse(JSON.stringify(base));next.lineups[6]={a:['a4'],b:['b4']};if(reg.save)await reg.save(next,base);else {reg.config(next);await reg.upload();}});
  const expected=copy(db.appData.data.federalCup2026);appWrites=[];
  await a.evaluate(async()=>{reg.screen('federal-cup-2026');reg.render();await fc26StartFixture(3);});await a.waitForTimeout(800);
  assert.deepEqual(db.appData.data.federalCup2026,expected);assert.equal(appWrites.length,0,'resume must not PUT appData');
 });
 await scenario('P1 dirty rename + remote reorder is rejected with every identity intact',async()=>{
  for(const poll of [true,false]){await reset();await editor(a);await a.locator('#fc26APlayer0').fill('Rozpracované');
  await editor(b);await b.locator('#fc26APlayer0').locator('..').locator('[data-fc-move="1"]').click();await saveUI(b);
  const expected=copy(db.appData.data.federalCup2026);if(poll)await a.evaluate(()=>reg.pull());else await a.evaluate(()=>reg.render());await saveUI(a);
  assert.deepEqual(db.appData.data.federalCup2026,expected);assert.equal(Object.keys(expected.participants).length,10);assert.equal(expected.rosterParticipantIdsA[0],'a2');}
 });
 await scenario('P1 score correction: winner distribution, missing attacks, undo, reload and finished PUT/GET',async()=>{
  await reset();await start(a);await a.evaluate(()=>reg.pot());let m=await a.evaluate(()=>reg.match);assert.deepEqual(m.scores,[1,0]);assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).potting.attempts),1);
  await a.evaluate(()=>reg.correct(0,1));assert.equal(await a.evaluate(()=>reg.calculate?reg.calculate(reg.match).sides[0].metrics.ownBreakWins.value:null),null);assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).racks.coverage),'partial');
  assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).potting.coverage),'complete','winner attribution does not erase observed strokes');
  await a.evaluate(()=>reg.undo());assert.deepEqual(await a.evaluate(()=>reg.match.scores),[1,0]);assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).racks.coverage),'complete');
  await a.evaluate(()=>reg.correct(4,0));assert.equal(await a.evaluate(()=>reg.calculate?reg.calculate(reg.match).sides[0].metrics.pottingSuccess.value:null),null);assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).potting.coverage),'partial');assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).potting.attempts),1);assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).pots.total),null);
  await a.evaluate(async()=>{reg.autosave();await reg.backup();});const markers=await a.evaluate(()=>reg.match.federalEvidence.serviceChanges);
  await a.reload();await a.waitForFunction(()=>!!window.reg);await a.waitForSelector('#cloudLoginModal.show');await a.evaluate(async()=>{reg.admin();await reg.resume();});assert.deepEqual(await a.evaluate(()=>reg.match.federalEvidence.serviceChanges),markers);assert.equal(await a.evaluate(()=>reg.summary(reg.match,0).potting.coverage),'partial');
  const id=await a.evaluate(()=>reg.match.id);await a.evaluate(()=>{winRack(0);if(reg.match)reg.persist();});await a.waitForTimeout(250);assert.ok(db.matches[id]);const restored=wire(db.matches[id]);assert.equal(await b.evaluate(m=>reg.summary(m,0).racks.coverage,restored),'partial');assert.equal(await b.evaluate(m=>reg.summary(m,0).potting.coverage,restored),'partial');
 });
 await scenario('P2 sparse RTDB positions, selection, Team restore and reserialization preserve ID',async()=>{
  const c=config();c.rosterA={4:'SK5'};c.rosterParticipantIdsA={4:'a5'};assert.equal(await a.evaluate(c=>reg.participant(c,'a','a5').id,c),'a5');await reset(c);
  const snapshot=await a.evaluate(()=>reg.participant(reg.data.federalCup2026,'a','a5'));assert.equal(snapshot.id,'a5');assert.equal(await a.evaluate(()=>reg.data.federalCup2026.rosterA[4]),'SK5');
  await editor(a);assert.equal(await a.locator('#fc26APlayer4').inputValue(),'SK5');assert.equal(await a.locator('#fc26APlayer0').inputValue(),'');
  const normalized=await a.evaluate(()=>reg.data.federalCup2026);await a.evaluate(()=>reg.ensure(reg.data.federalCup2026));assert.deepEqual(await a.evaluate(()=>reg.data.federalCup2026.rosterParticipantIdsA),[null,null,null,null,'a5']);
  assert.equal(wire(normalized).rosterParticipantIdsA[4],'a5');
  await reset();await start(a,1);await a.evaluate(()=>{reg.sparseTeam();fc26PickRackPlayer(0,'a5');reg.autosave();});assert.equal(await a.evaluate(()=>reg.match.federalTeam.players[0].id),'a5');await a.reload();await a.waitForFunction(()=>!!window.reg);await a.waitForSelector('#cloudLoginModal.show');await a.evaluate(async()=>{reg.admin();await reg.resume();});assert.equal(await a.evaluate(()=>reg.match.federalTeam.players[0].id),'a5');
 });
 if(!process.env.FC_SOURCE_REF){
 await scenario('legacy IDs migrate only on explicit action with CAS; sparse lineup slots persist',async()=>{
  const c=config();delete c.participants;delete c.rosterParticipantIdsA;delete c.rosterParticipantIdsB;c.lineups={1:{a:['SK1'],b:['CZ1']},2:{a:{1:'SK2'},b:['CZ1','CZ2']},3:{a:['SK3'],b:['CZ3']}};await reset(c);
  await editor(a);await a.evaluate(()=>reg.render());assert.equal(appWrites.length,0);assert.equal(await a.evaluate(()=>reg.data.federalCup2026.participants&&Object.keys(reg.data.federalCup2026.participants).length),0);
  await start(a);assert.ok(appWrites.at(-1).tag);const ids=copy(db.appData.data.federalCup2026.rosterParticipantIdsA);assert.equal(new Set(ids).size,5);await b.evaluate(()=>reg.pull());assert.deepEqual(await b.evaluate(()=>reg.data.federalCup2026.rosterParticipantIdsA),ids);assert.equal(await b.evaluate(()=>reg.data.federalCup2026.lineups[2].a[1]),'SK2');
 });
 await scenario('CAS guards GET/PUT race, rejected reads, missing ETag and unrelated remote fields',async()=>{
  await reset();await a.evaluate(()=>fc26SetLineup(3,'a',0,'a3'));assert.equal(appWrites.length,0,'selecting unchanged participant is read-only');const base=await a.evaluate(()=>reg.data.federalCup2026),next=copy(base);next.lineups[6]={a:['a4'],b:['b4']};
  race=()=>{db.appData.data.federalCup2026.lineups[8]={a:['a5'],b:['b5']};};
  const err=await a.evaluate(async({base,next})=>{try{await reg.save(next,base);return '';}catch(e){return e.message;}},{base,next});assert.match(err,/Konflikt/);assert.ok(db.appData.data.federalCup2026.lineups[8]);assert.equal(appWrites.at(-1).accepted,false);
  for(const mode of ['deny','etag']){await reset();if(mode==='deny')deny=true;else omitEtag=true;const msg=await a.evaluate(async()=>{try{const base=reg.data.federalCup2026;await reg.save({...base,updatedAt:2},base);return '';}catch(e){return e.message;}});assert.ok(msg);assert.equal(appWrites.length,0);}
  await reset();await a.evaluate(async()=>{const base=reg.data.federalCup2026;await reg.save({...base,lineups:{6:{a:['a4'],b:['b4']}}},base);});assert.deepEqual(db.appData.data.unrelated,{keep:'server'});assert.ok(appWrites.every(w=>w.tag&&w.accepted));
  await b.evaluate(()=>reg.upload());assert.ok(db.appData.data.federalCup2026.lineups[6]);
  race=()=>{db.appData.data.federalCup2026.lineups[8]={a:['a5'],b:['b5']};};await b.evaluate(()=>reg.upload());assert.ok(db.appData.data.federalCup2026.lineups[8]);assert.equal(appWrites.at(-1).accepted,false);assert.match(await b.evaluate(()=>reg.error),/412/);
 });
 await scenario('concurrent rename/removal/new participant conflict; explicit reload, rename, move and duplicate names',async()=>{
  for(const kind of ['rename','remove','new']){await reset();await editor(a);await a.locator('#fc26APlayer0').fill('Draft');await editor(b);if(kind==='new')await b.locator('#fc26APlayer0').locator('..').locator('[data-fc-new]').click();await b.locator('#fc26APlayer0').fill(kind==='remove'?'':'Changed');await saveUI(b);const expected=copy(db.appData.data.federalCup2026);await a.evaluate(()=>reg.pull());await saveUI(a);assert.deepEqual(db.appData.data.federalCup2026,expected);assert.equal(await a.locator('#fc26APlayer0').inputValue(),'Draft');}
  await reset();await editor(a);await a.locator('#fc26APlayer0').fill('CZ1');await saveUI(a);assert.equal(db.appData.data.federalCup2026.rosterParticipantIdsA[0],'a1');
  await a.locator('#fc26APlayer1').fill('CZ1');await saveUI(a);assert.equal(db.appData.data.federalCup2026.rosterParticipantIdsA[1],'a2');
  await a.locator('#fc26APlayer0').locator('..').locator('[data-fc-move="1"]').click();await saveUI(a);assert.equal(db.appData.data.federalCup2026.rosterParticipantIdsA[1],'a1');
  await a.locator('#fc26APlayer0').locator('..').locator('[data-fc-new]').click();await a.locator('#fc26APlayer0').fill('CZ1');await saveUI(a);assert.notEqual(db.appData.data.federalCup2026.rosterParticipantIdsA[0],'a2');assert.equal(db.appData.data.federalCup2026.rosterParticipantIdsA[1],'a1');
 });
 }
 if(errors.length)throw Error('Page errors: '+errors.join('; '));
 console.log(results.filter(r=>r.ok).length+'/'+results.length+' scenarios passed; 2 isolated clients, no production network');if(results.some(r=>!r.ok))process.exitCode=1;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
