'use strict';
// Current main only. Every network request intercepted; fictitious players and ETag store.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const original=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const hook=`
window.histTest={
 parity(rule,penalties,results,decisions=[]){
  const config={name:'Parity',date:'2024-05-11',format:'groups_sko',playerIds:['p1','p2','p3','p4'],discipline:'9-ball',raceTo:5,groupCount:1,advance:2,tieRule:rule,penalties};
  let historical=historicalCreateStructure(config,config.playerIds,data.tournamentSeries[0]);
  const ordinary=generateHybridTournament(config.name,config.playerIds,config.discipline,5,'alternate',1,2,'sko',{},1,'manual',false);
  ordinary.groupAdvanceTieRule=rule;ordinary.groupPenaltyTieBreak=penalties;
  const play=(t,m,a,b)=>processTournamentResult({id:null,tournamentLink:{tournamentId:t.id,tournamentMatchId:m.id},playerIds:[m.player1Id,m.player2Id],scores:[a,b],winner:a>b?0:1,endedAt:'2024-05-11T12:00:00.000Z'},t);
  for(const [p1,p2,a,b] of results){
   const slot=historicalStructureSlots(historical).find(s=>[s.m.player1Id,s.m.player2Id].includes(p1)&&[s.m.player1Id,s.m.player2Id].includes(p2));
   const m=ordinary.groups[0].matches.find(m=>[m.player1Id,m.player2Id].includes(p1)&&[m.player1Id,m.player2Id].includes(p2));
   play(ordinary,m,m.player1Id===p1?a:b,m.player1Id===p1?b:a);
   historical=historicalPlanScore(historical,slot.key,slot.m.player1Id===p1?a:b,slot.m.player1Id===p1?b:a,'owner').t;
  }
  const blocked=[unresolvedGroupPenaltyTie(ordinary)?.candidates||[],unresolvedGroupPenaltyTie(historical)?.candidates||[]];
  if(decisions.length){ordinary.groupPenaltyWinners={A:decisions};historical.historicalStructure.initial.groupPenaltyWinners={A:decisions};historical=historicalReplay(historical).t;}
  const orders=[groupStandings(ordinary.groups[0],ordinary).map(r=>r.id),groupStandings(historical.groups[0],historical).map(r=>r.id)];
  const seeds=[groupPlayoffSeeds(ordinary),groupPlayoffSeeds(historical)];
  const unresolved=[!!unresolvedGroupPenaltyTie(ordinary),!!unresolvedGroupPenaltyTie(historical)];
  if(unresolved.some(Boolean))return {orders,seeds,blocked,unresolved};
  startHybridPlayoff(ordinary,seeds[0]);historical.historicalStructure.playoffOrder=seeds[1];historical=historicalReplay(historical).t;
  for(let i=0;i<20;i++){
   const hs=historicalStructureSlots(historical).find(s=>!s.key.startsWith('g_')&&s.m.status!=='done');if(!hs)break;
   const m=allTournamentMatches(ordinary).find(m=>m.status!=='done'&&m.player1Id===hs.m.player1Id&&m.player2Id===hs.m.player2Id);if(!m)throw Error('Different playoff pairing');
   play(ordinary,m,5,1);historical=historicalPlanScore(historical,hs.key,5,1,'owner').t;
  }
  const series=data.tournamentSeries[0],placements=[ordinary,historical].map(t=>seriesTournamentPlacementRecords(series,t));
  return {orders,seeds,blocked,unresolved,status:[ordinary.status,historical.status],placements,points:placements.map((rows,i)=>rows.map(r=>({id:r.playerId,points:seriesPointsForPlacement(series,r,[ordinary,historical][i])})))};
 },
 setup(){cloudAuthenticated=true;cloudUid='owner';cloudEmailVerified=true;cloudIdToken='mock';cloudTokenExpiresAt=Date.now()+3600000;currentUserRole='system_admin';data=defaultData();
 for(let i=1;i<=8;i++)data.players['p'+i]={id:'p'+i,name:'Hráč '+i,firstName:'Hráč',lastName:String(i)};
 data.players.hidden={id:'hidden',name:'Skrytý',hiddenFromPlayers:true};data.players.inactive={id:'inactive',name:'Neaktivní',active:false};
 data.tournamentSeries=[{id:'s',name:'Lounská test',createdByUid:'owner',managerUids:{manager:true},tournamentIds:[],placementTieBreak:'score_h2h_group',scoringMode:'custom',customPointsText:'1=10,2=8,3=6,4=5,5=4,6=3,7=2,8=1',historicalTournaments:[{id:'legacy',name:'Starý historický',results:[{playerId:'p8',place:1}],matches:[]}]}];
 document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));localStorage.setItem(DB_KEY,JSON.stringify(data));},
 series(){selectedSeriesId='s';renderSeriesModal();$('seriesModal').classList.add('show');},
 auth(uid,role='player'){cloudUid=uid;currentUserRole=role;},
 get data(){return data},get match(){return match},
 slots(id){return historicalStructureSlots(data.tournaments.find(t=>t.id===id))},
 async create(config,order){const t=historicalCreateStructure(config,order,data.tournamentSeries[0]);await historicalPersist(t);return t.id;},
 async retryCreate(config,id){const t=historicalCreateStructure(config,config.playerIds,data.tournamentSeries[0]);t.id=id;t.historicalStructure.initial.id=id;t.historicalStructure.creationKey=id;await historicalPersist(t);return t.id;},
 async score(id,key,a,b){const t=data.tournaments.find(t=>t.id===id);await historicalAcceptPlan(t,historicalPlanScore(t,key,a,b,cloudUid));},
 plan(id,key,a,b){return historicalPlanScore(data.tournaments.find(t=>t.id===id),key,a,b,cloudUid)},
 async reload(){await loadSecureTournaments();},
 points(){return seriesStandings(data.tournamentSeries[0]);},
 placements(id){return seriesTournamentPlacementRecords(data.tournamentSeries[0],data.tournaments.find(t=>t.id===id));},
 baseline(id){const t=historicalClone(data.tournaments.find(t=>t.id===id));delete t.historicalStructure;return seriesTournamentPlacementRecords(data.tournamentSeries[0],t);},
 oldPoints(id){const s=historicalClone(data.tournamentSeries[0]),t=data.tournaments.find(t=>t.id===id);s.id='old-comparison';s.tournamentIds=[];s.historicalTournaments=[{id,mode:'full',statsComplete:true,name:t.name,results:seriesTournamentPlacementRecords(data.tournamentSeries[0],t).map(r=>({playerId:r.playerId,place:r.value})),matches:[]}];return seriesStandings(s).map(r=>({playerId:r.playerId,points:r.points,place:r.results[0].value})).sort((a,b)=>a.playerId.localeCompare(b.playerId));},
 oldAutoPoints(id){const t=data.tournaments.find(t=>t.id===id),s=historicalClone(data.tournamentSeries[0]);const matches=allTournamentMatches(t).map(m=>({...m,stage:m.bracket==='F'?'final':m.bracket==='3P'?'third':'semi'}));const results=historicalAutoPlacements(matches,new Map(t.playerIds.map(id=>[id,{displayName:tournamentPlayerName(id,t)}])));s.id='auto-comparison';s.tournamentIds=[];s.historicalTournaments=[{id,name:t.name,results,matches}];return seriesStandings(s).map(r=>({playerId:r.playerId,points:r.points,place:r.results[0].value})).sort((a,b)=>a.playerId.localeCompare(b.playerId));},
 newPoints(id){return seriesStandings(data.tournamentSeries[0]).map(r=>({playerId:r.playerId,result:r.results.find(x=>x.tournamentId===id)})).filter(r=>r.result).map(r=>({playerId:r.playerId,points:r.result.points,place:r.result.value})).sort((a,b)=>a.playerId.localeCompare(b.playerId));},
 async clear(id,key){const t=data.tournaments.find(t=>t.id===id),next=historicalClone(t);delete next.historicalStructure.results[key];next.historicalStructure.manualPlaces=null;await historicalAcceptPlan(t,historicalReplay(next));},
 async seeds(id,order){const t=data.tournaments.find(t=>t.id===id),next=historicalClone(t);historicalValidateOrder(order,groupPlayoffSeeds(t));next.historicalStructure.playoffOrder=order;next.historicalStructure.seedReview=false;await historicalAcceptPlan(t,historicalReplay(next));},
 qualifiers(id){return groupPlayoffSeeds(data.tournaments.find(t=>t.id===id));},
 restore(){cloudAuthenticated=true;cloudUid='owner';currentUserRole='system_admin';cloudEmailVerified=true;cloudIdToken='mock';cloudTokenExpiresAt=Date.now()+3600000;},
 alias(id,oldId,newId){const t=data.tournaments.find(t=>t.id===id);replaceTournamentParticipantId(t,oldId,newId);return historicalReplay(t).t;},
};
`;
const html=original.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
const clone=x=>JSON.parse(JSON.stringify(x));
// RTDB omits null/empty children and serializes populated numeric maps as arrays.
function firebase(x){if(x==null)return null;if(typeof x!=='object')return x;const out=Array.isArray(x)?[]:{};for(const [k,v] of Object.entries(x)){const value=firebase(v);if(value!==null)out[k]=value;}return Object.keys(out).length?out:null;}
(async()=>{
 const browser=await chromium.launch({channel:process.env.FC_BROWSER_CHANNEL||'chrome',headless:true});
 try{
 const context=await browser.newContext({serviceWorkers:'block'}),db={},versions={},writes=[],errors=[];let mode='',readCount=0,answer=true;const confirmations=[];
 await context.route('**/*',async route=>{if(require('./helpers/federal-statistics.cjs').serve(route))return;
  const request=route.request(),u=new URL(request.url());if(u.href==='https://historical-isolated.local/')return route.fulfill({contentType:'text/html',body:html});
  const m=u.pathname.match(/^\/tournaments(?:\/([^/]+))?\.json$/);
  if(!m)return route.abort();
  const id=m[1],method=request.method();
  if(method==='GET'){readCount++;if(mode==='unverified'){mode='';return route.fulfill({status:503,body:'unavailable'});}return route.fulfill({contentType:'application/json',headers:{'Access-Control-Expose-Headers':'ETag',ETag:'"'+(versions[id]||0)+'"'},body:JSON.stringify(id?db[id]||null:db)});}
  assert.equal(method,'PUT');assert.ok(id,'No whole-store write');
  if(mode==='deny')return route.fulfill({status:403,body:'denied'});
  if(mode==='race'){versions[id]=(versions[id]||0)+1;mode='';}
  if(request.headers()['if-match']!=='"'+(versions[id]||0)+'"')return route.fulfill({status:412,body:'conflict'});
  db[id]=firebase(request.postDataJSON());versions[id]=(versions[id]||0)+1;writes.push({id,body:clone(db[id])});
  if(mode==='lostAck')mode='unverified';
  return route.fulfill({contentType:'application/json',body:JSON.stringify(db[id])});
 });
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async d=>{confirmations.push(d.message());await (answer?d.accept():d.dismiss());});
 await page.goto('https://historical-isolated.local/');await page.waitForFunction(()=>!!window.histTest);await page.locator('#cloudLoginModal.show').waitFor();await page.evaluate(()=>histTest.setup());
 const run=(fn,arg)=>page.evaluate(fn,arg);
 const get=id=>run(id=>histTest.data.tournaments.find(t=>t.id===id),id);
 const slots=id=>run(id=>histTest.slots(id),id);
 const cfg=(format,players=4,extra={})=>({name:'Historický '+format,date:'2024-05-11',format,playerIds:Array.from({length:players},(_,i)=>'p'+(i+1)),discipline:'9-ball',raceTo:5,groupCount:format.startsWith('groups_')?2:1,advance:2,...extra});
 const create=c=>run(c=>histTest.create(c,c.playerIds),c);
 const score=(id,key,a=5,b=1)=>run(({id,key,a,b})=>histTest.score(id,key,a,b),{id,key,a,b});
 async function finish(id,groupsOnly=false){for(let i=0;i<160;i++){const next=(await slots(id)).find(s=>s.m.status!=='done'&&(!groupsOnly||s.key.startsWith('g_')));if(!next)return;await score(id,next.key);}throw Error('Tournament did not finish');}
 const points=()=>run(()=>histTest.points());
 const legacyBefore=await run(()=>JSON.stringify(histTest.data.tournamentSeries[0].historicalTournaments));
 // Actual setup UI: no random draw; empty/duplicate positions rejected, draft survives reload.
 await run(()=>{histTest.series();openHistoricalStructureSetup('s');});
 const choices=await page.evaluate(()=>{const read=id=>({options:[...document.getElementById(id).options].map(o=>({value:o.value,label:o.textContent.trim()})),value:document.getElementById(id).value});return [read('tournamentGroupAdvanceTieRule'),read('hsTie')];});
 assert.deepEqual(choices[0],choices[1]);assert.equal(choices[1].value,'points');
 assert.equal(await page.locator('#hsPenalties').isChecked(),await page.locator('#tournamentPenaltyTieBreak').isChecked());
 await page.locator('#hsTie').selectOption('head_to_head');
 assert.equal(await page.locator('.hsPlayer[value="hidden"],.hsPlayer[value="inactive"]').count(),0);
 await page.locator('#hsName').fill('UI skupina');await page.locator('#hsDate').fill('2024-05-11');
 for(const id of ['p1','p2','p3'])await page.locator('.hsPlayer[value="'+id+'"]').check();
 await page.getByRole('button',{name:'PŘIPRAVIT RUČNÍ NASAZENÍ',exact:true}).click();
 await page.getByRole('button',{name:'VYTVOŘIT ZÁPASY A ULOŽIT ROZPRACOVANÝ TURNAJ'}).click();await page.waitForFunction(()=>document.querySelector('#historicalStructureMessage').textContent.includes('právě jednou'));assert.equal(writes.length,0);
 await page.locator('.hsSeed').nth(0).selectOption('p1');await page.locator('.hsSeed').nth(1).selectOption('p1');await page.locator('.hsSeed').nth(2).selectOption('p3');
 await page.getByRole('button',{name:'VYTVOŘIT ZÁPASY A ULOŽIT ROZPRACOVANÝ TURNAJ'}).click();await page.waitForFunction(()=>document.querySelector('#historicalStructureMessage').textContent.includes('právě jednou'));assert.equal(writes.length,0);
 await page.reload();await page.waitForFunction(()=>!!histTest);await page.locator('#cloudLoginModal.show').waitFor();await run(()=>{histTest.restore();document.querySelector('#cloudLoginModal').classList.remove('show');openHistoricalStructureSetup('s');});assert.equal(await page.locator('.hsSeed').nth(0).inputValue(),'p1');
 await page.locator('.hsSeed').nth(1).selectOption('p2');await page.getByRole('button',{name:'VYTVOŘIT ZÁPASY A ULOŽIT ROZPRACOVANÝ TURNAJ'}).click();await page.waitForFunction(()=>document.querySelector('#historicalStructureMessage').textContent!=='Ukládám…');assert.equal(await run(()=>histTest.data.tournaments.length),1,await page.locator('#historicalStructureMessage').innerText());
 const group=await run(()=>histTest.data.tournaments[0].id);assert.equal((await slots(group)).length,3);assert.equal((await points()).find(r=>r.playerId==='p1'),undefined);
 assert.equal((await get(group)).groupAdvanceTieRule,'head_to_head');assert.equal((await get(group)).groupPenaltyTieBreak,false);
 await page.locator('[data-historical-slot] button').first().click();await page.waitForFunction(()=>document.querySelector('#historicalStructureMessage').textContent.includes('Vyplň obě'));assert.equal(writes.length,1);
 await page.locator('#hs1_g_0_0').fill('5');await page.locator('#hs2_g_0_0').fill('1');await page.locator('[data-historical-slot="g_0_0"] button').first().click();await page.waitForFunction(()=>histTest.data.tournaments[0].historicalStructure.results?.g_0_0?.s1===5);
 const unfinished=clone(await get(group));assert.equal(unfinished.status,'active');
 await page.reload();await page.waitForFunction(()=>!!histTest);await page.locator('#cloudLoginModal.show').waitFor();await run(async()=>{histTest.restore();document.querySelector('#cloudLoginModal').classList.remove('show');await histTest.reload();});assert.deepEqual(await get(group),unfinished);
 await finish(group);assert.equal((await get(group)).status,'complete');assert.deepEqual(await run(id=>histTest.placements(id),group),await run(id=>histTest.baseline(id),group));
 const repeatedCount=writes.length;await score(group,'g_0_0',5,1);assert.equal(writes.length,repeatedCount);
 await score(group,'g_0_0',5,3);await score(group,'g_0_0',2,5);assert.equal((await get(group)).historicalStructure.audit.at(-1).previous.s1,5);
 const pt=await points();await page.reload();await page.waitForFunction(()=>!!histTest);await page.locator('#cloudLoginModal.show').waitFor();await run(async()=>{histTest.restore();document.querySelector('#cloudLoginModal').classList.remove('show');await histTest.reload();});assert.deepEqual(await points(),pt);assert.equal(await run(()=>histTest.match),null);
 console.log('PASS groups, real manual setup, duplicate/incomplete validation, draft/results reload, no scoreboard, automatic completion');
 // SKO with odd field/byes: preserve same-winner scores, explain invalidation BEFORE write.
 const ko=await create(cfg('sko',5));await finish(ko);assert.equal((await get(ko)).status,'complete');
 const completedBefore=await get(ko),countBefore=writes.length;answer=false;await score(ko,'ko_0_0',1,5);assert.equal(writes.length,countBefore);assert.deepEqual(await get(ko),completedBefore);assert.match(confirmations.at(-1),/zneplatní/);
 answer=true;await score(ko,'ko_0_0',5,2);assert.equal((await get(ko)).status,'complete');assert.equal(Object.keys((await get(ko)).historicalStructure.results).length,Object.keys(completedBefore.historicalStructure.results).length);
 const plan=await run(id=>histTest.plan(id,'ko_0_0',1,5),ko);assert.ok(plan.invalid.length>0);await score(ko,'ko_0_0',1,5);assert.equal((await get(ko)).status,'active');assert.ok(!(await points()).some(r=>r.results.some(x=>x.tournamentId===ko)));await finish(ko);
 const afterCorrection=await get(ko);for(const [key,value] of Object.entries(completedBefore.historicalStructure.results)){if(key==='ko_0_0')continue;const current=afterCorrection.historicalStructure.results[key];if(current?.p1===value.p1&&current?.p2===value.p2)assert.deepEqual(current,value,'Unaffected result preserved exactly');else assert.ok(afterCorrection.historicalStructure.audit.some(a=>a.invalidated?.some(r=>r.key===key&&r.p1===value.p1&&r.p2===value.p2)),'Affected result invalidation audited');}
 await run(id=>histTest.clear(id,'ko_0_0'),ko);assert.equal((await get(ko)).status,'active');await finish(ko);assert.ok((await points()).every(r=>r.results.filter(x=>x.tournamentId===ko).length<=1));
 console.log('PASS SKO/byes, completed score/winner correction, canceled impact confirmation, selective invalidation, remove/recompute points, repeat completion');
 // Hybrid: manual playoff order persists across group recalculation; changed qualifiers require review.
 const hybrid=await create(cfg('groups_sko',8,{thirdPlace:true}));await finish(hybrid,true);assert.equal((await get(hybrid)).playoffStarted||false,false);
 const q=await run(id=>histTest.qualifiers(id),hybrid),custom=[q[2],q[0],q[3],q[1]];
 await assert.rejects(run(({id,q})=>histTest.seeds(id,[q[0],q[0],q[2],q[3]]),{id:hybrid,q}),/právě jednou/);
 await run(id=>openHistoricalStructure(id),hybrid);for(let i=0;i<custom.length;i++)await page.locator('.hsPlayoffSeed').nth(i).selectOption(custom[i]);await page.getByRole('button',{name:'POTVRDIT RUČNÍ NASAZENÍ'}).click();await page.waitForFunction(id=>histTest.data.tournaments.find(t=>t.id===id).playoffStarted,hybrid);await finish(hybrid);assert.equal((await get(hybrid)).status,'complete');
 const harmless=await run(id=>histTest.slots(id).filter(s=>s.key.startsWith('g_')).map(s=>({key:s.key,plan:histTest.plan(id,s.key,5,2)})).find(x=>!x.plan.invalid.length&&!x.plan.t.historicalStructure.seedReview),hybrid);assert.ok(harmless);await score(hybrid,harmless.key,5,2);assert.deepEqual((await get(hybrid)).historicalStructure.playoffOrder,custom);assert.equal((await get(hybrid)).status,'complete');
 assert.deepEqual(await run(id=>histTest.placements(id),hybrid),await run(id=>histTest.baseline(id),hybrid));
 assert.deepEqual(await run(id=>histTest.newPoints(id),hybrid),await run(id=>histTest.oldPoints(id),hybrid));
 const changing=await run(id=>histTest.slots(id).filter(s=>s.key.startsWith('g_')).map(s=>({key:s.key,plan:histTest.plan(id,s.key,1,5)})).find(x=>x.plan.t.historicalStructure.seedReview),hybrid);assert.ok(changing);await score(hybrid,changing.key,1,5);
 assert.equal((await get(hybrid)).historicalStructure.seedReview,true);assert.equal((await get(hybrid)).status,'active');
 const newOrder=(await get(hybrid)).historicalStructure.playoffOrder;await run(({id,order})=>histTest.seeds(id,order),{id:hybrid,order:newOrder});await finish(hybrid);assert.equal((await get(hybrid)).status,'complete');
 const dko=await create(cfg('dko',4));await finish(dko);assert.equal((await get(dko)).status,'complete');
 const hdko=await create(cfg('groups_dko',4,{groupCount:2,advance:2}));await finish(hdko,true);await run(id=>histTest.seeds(id,histTest.qualifiers(id)),hdko);await finish(hdko);assert.equal((await get(hdko)).status,'complete');
 console.log('PASS groups → SKO including bronze, persistent custom seeding, changed qualifier review, same Lounská engine placement; DKO and groups → DKO');
 // Multi-group-only requires explicit final order (confirmed by Dominik).
 const multi=await create(cfg('groups',4,{groupCount:2}));await finish(multi);assert.equal((await get(multi)).status,'active');await run(id=>openHistoricalStructure(id),multi);
 await page.getByText('Ruční konečné pořadí (alternativa',{exact:false}).click();
 for(let i=0;i<4;i++)await page.locator('.hsPlace').nth(i).fill(String(i<2?1:i+1));
 await page.locator('.hsPlace').first().evaluate(el=>el.closest('details').open=true);
 await page.getByRole('button',{name:'POTVRDIT KONEČNÉ POŘADÍ'}).click();await page.waitForFunction(id=>histTest.data.tournaments.find(t=>t.id===id).status==='complete',multi);
 const mp=await run(id=>histTest.placements(id),multi);assert.equal(mp.filter(r=>r.value===1&&r.sharedPlace).length,2);
 assert.deepEqual(await run(id=>histTest.newPoints(id),multi),await run(id=>histTest.oldPoints(id),multi));
 // Penalty tie remains active until the required decisions have been entered.
 const penalty=await create(cfg('groups',3,{penalties:true,tieRule:'head_to_head'}));const pairs=await slots(penalty);
 for(const s of pairs){const w=({'p1':'p2','p2':'p3','p3':'p1'}[s.m.player1Id]===s.m.player2Id)?s.m.player1Id:s.m.player2Id;await score(penalty,s.key,w===s.m.player1Id?5:4,w===s.m.player2Id?5:4);}
 assert.equal((await get(penalty)).status,'active');for(let i=0;i<3;i++){await run(id=>openHistoricalStructure(id),penalty);if(!await page.locator('#hsPenalty').count())break;await page.getByRole('button',{name:'POTVRDIT PENALTY'}).click();await page.waitForFunction(()=>!document.querySelector('#historicalStructureMessage').textContent.includes('Ukládám'));}
 assert.equal((await get(penalty)).status,'complete');console.log('PASS multi-group manual final placement/shared points; unresolved penalty tie and persisted decisions');
 // Immutable legacy/unrelated data and no-double-count equivalence of old placement entry.
 assert.equal(await run(()=>JSON.stringify(histTest.data.tournamentSeries[0].historicalTournaments)),legacyBefore);
 const stable=clone(db[group]);const savedPoints=await points();await run(()=>histTest.reload());assert.deepEqual(await points(),savedPoints);assert.deepEqual(db[group],stable);
 await run(()=>histTest.auth('intruder'));await assert.rejects(score(group,'g_0_0',5,0),/oprávnění/);await assert.rejects(create(cfg('sko',2)),/oprávnění/);await run(()=>histTest.auth('manager'));await score(group,'g_0_0',5,0);await run(()=>histTest.restore());
 const old=await get(group);db[group].name='Změna druhého zařízení';versions[group]++;await assert.rejects(score(group,'g_0_0',5,1),/změněn jinde/);await run(()=>histTest.reload());
 await run(id=>{const forged=JSON.parse(JSON.stringify(histTest.data.tournaments.find(t=>t.id===id)));forged.id='forged-series-link';forged.createdByUid='intruder';histTest.data.tournaments.push(forged);},group);assert.ok(!(await points()).some(r=>r.results.some(x=>x.tournamentId==='forged-series-link')),'Self-declared series link cannot grant points');
 mode='deny';await assert.rejects(score(group,'g_0_0',5,2),/selhalo/);mode='race';await assert.rejects(score(group,'g_0_0',5,2),/Souběžná/);mode='';
 db[group].managerUids.newManager=true;versions[group]++;await run(()=>histTest.reload());await score(group,'g_0_0',5,2);assert.equal(db[group].managerUids.newManager,true);assert.equal(db[group].name,'Změna druhého zařízení');
 mode='lostAck';await assert.rejects(create(cfg('sko',2)),/503/);const createdId=writes.at(-1).id,n=writes.length;await run(({c,id})=>histTest.retryCreate(c,id),{c:cfg('sko',2),id:createdId});assert.equal(writes.length,n);assert.equal(await run(id=>histTest.data.tournaments.filter(t=>t.id===id).length,createdId),1);
 const guest=await create(cfg('sko',2,{playerIds:['p1','guest_demo'],guests:{guest_demo:{name:'Fiktivní host'}}}));await finish(guest);assert.equal((await get(guest)).guests.guest_demo.preserveGuest,true);const linked=await run(id=>histTest.alias(id,'guest_demo','p9'),guest);assert.deepEqual(linked.playerIds,['p1','p9']);assert.equal(linked.status,'complete');assert.equal(linked.historicalStructure.results.ko_0_0.p2,'p9');console.log('PASS stable guest identity and participant relink in saved seed/result source');
 const parity=await create(cfg('sko',4));await finish(parity);assert.deepEqual(await run(id=>histTest.newPoints(id),parity),await run(id=>histTest.oldAutoPoints(id),parity));assert.equal((await run(id=>histTest.placements(id),parity)).filter(r=>r.value===3&&r.sharedPlace).length,2);console.log('PASS independent old automatic historical placement + Lounská points parity, including shared semifinal place');
 const fixtures=[
  {name:'two tied players',results:[['p1','p2',5,4],['p1','p3',5,4],['p4','p1',5,0],['p2','p3',5,0],['p2','p4',5,0],['p3','p4',5,0]],points:['p2','p1','p3','p4'],head:['p1','p2','p3','p4']},
  {name:'three-player circular tie',results:[['p1','p2',5,4],['p2','p3',5,1],['p3','p1',5,2],['p1','p4',5,0],['p2','p4',5,1],['p3','p4',5,3]],points:['p2','p1','p3','p4'],head:['p1','p2','p3','p4']},
  {name:'equal difference resolved by scored racks',results:[['p1','p2',5,4],['p2','p3',5,3],['p3','p1',5,2],['p1','p4',5,0],['p2','p4',5,2],['p3','p4',5,3]],points:['p2','p3','p1','p4'],head:['p1','p2','p3','p4']}
 ];
 for(const f of fixtures)for(const rule of ['points','head_to_head'])for(const penalties of [false,true]){
  const decisions=penalties&&rule==='head_to_head'&&f.name!=='two tied players'?['p3','p1']:[];
  const result=await run(({rule,penalties,f,decisions})=>histTest.parity(rule,penalties,f.results,decisions),{rule,penalties,f,decisions});
  assert.deepEqual(result.orders[0],decisions.length?['p3','p1','p2','p4']:rule==='points'?f.points:f.head,f.name+' '+rule);
  assert.deepEqual(result.orders[0],result.orders[1]);assert.deepEqual(result.seeds[0],result.seeds[1]);assert.deepEqual(result.blocked[0],result.blocked[1]);assert.deepEqual(result.unresolved,[false,false]);assert.deepEqual(result.status,['complete','complete']);assert.deepEqual(result.placements[0],result.placements[1]);assert.deepEqual(result.points[0],result.points[1]);
 }
 const blocked=await run(f=>histTest.parity('head_to_head',true,f.results),fixtures[1]);assert.deepEqual(blocked.unresolved,[true,true]);assert.deepEqual(blocked.blocked,[['p1','p2','p3'],['p1','p2','p3']]);
 console.log('PASS ordinary/historical parity: both criteria and penalty settings, two/three-player ties, scored-rack fallback, playoff pairing, final placements/series points; unfinished reload preserves saved rule/results');
 assert.equal(await run(()=>histTest.data.matches.length),0);assert.deepEqual(errors,[]);console.log('PASS manager/unauthorized checks, stale snapshot/403/ETag412 protection, no legacy/unrelated changes, no matches/statistics/live writes; 0 page errors');
 console.log('Mock tournament writes: '+writes.length+'; reads: '+readCount);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
