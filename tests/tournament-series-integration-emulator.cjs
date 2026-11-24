'use strict';
// Every request stays on the demo loopback engine; candidate Rules remain private.
const assert=require('assert/strict'),{api,client,control,fixture,token,url,rules,test,defer}=require('./tournament-series-repository-emulator.cjs');
const fields={name:'Synthetic created',club:'Test',season:'2026',scoringMode:'bands',pointsTop:[100,80,65,55],pointsBands:[45,25,10,5],placementTieBreak:'legacy'};
const history={id:'synthetic-h',name:'Synthetic past',date:'2026-01-01',mode:'placements',results:[{playerId:'a',displayName:'Synthetic A',place:1},{playerId:'b',displayName:'Synthetic B',place:2}],matches:[],statsComplete:false,manualPlacement:true,createdAt:'2026-11-24',createdByUid:'not-trusted'};
async function rest(who,path,method,data){return fetch(url(path,token({uid:who,emailVerified:true})),{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});}
(async()=>{
 await control('.settings/rules','PUT',rules);
 for(const who of ['owner','manager','admin'])await test('create '+who+' own series and second-device read',async()=>{
  const c=client(who),result=await c.repo.mutate('new-'+who,{type:'create',fields});assert.equal(result.series.createdByUid,who);assert.equal(result.series.name,fields.name);
  const reload=client(who);assert.equal((await reload.repo.read('new-'+who)).series.createdByUid,who);
  await assert.rejects(c.repo.mutate('new-'+who,{type:'create',fields}),{code:'SERIES_ALREADY_EXISTS'});assert.equal(c.state.calls.filter(x=>x.method==='PUT').length,1);c.repo.dispose();reload.repo.dispose();
 });
 await test('owner manages ACL; manager cannot grant rights or change owner via raw REST',async()=>{
  const owner=client();await owner.repo.mutate('s',{type:'manager-add',uid:'stranger'});assert.equal((await owner.repo.read('s')).series.managerUids.stranger,true);
  await owner.repo.mutate('s',{type:'manager-remove',uid:'stranger'});assert.equal((await owner.repo.read('s')).series.managerUids.stranger,undefined);
  const manager=client('manager');await assert.rejects(manager.repo.mutate('s',{type:'manager-add',uid:'stranger'}),{code:'SERIES_ACCESS_DENIED'});
  for(const [path,value] of [['managerUids/stranger',true],['createdByUid','manager'],['preserved/futureSystem',{bad:true}]])assert.notEqual((await rest('manager','tournamentSeries/s/'+path,'PUT',value)).status,200);
  manager.state.who.role='system_admin';await assert.rejects(manager.repo.mutate('s',{type:'manager-add',uid:'stranger'}),{code:'SERIES_ACCESS_DENIED'});owner.repo.dispose();manager.repo.dispose();
 });
 await test('owner creation cannot smuggle managers, unknown fields or another owner',async()=>{
  const raw=api.encodeLegacy({...fields,id:'bad',createdByUid:'owner',updatedAt:'now',futureSystem:{bad:true}});
  assert.notEqual((await rest('owner','tournamentSeries/bad','PUT',raw)).status,200);
  delete raw.preserved.futureSystem;raw.managerUids={stranger:true};assert.notEqual((await rest('owner','tournamentSeries/bad','PUT',raw)).status,200);
  delete raw.managerUids;raw.id="bad'";assert.notEqual((await rest('owner',"tournamentSeries/bad'",'PUT',raw)).status,200);raw.id='bad';raw.createdByUid='stranger';assert.notEqual((await rest('owner','tournamentSeries/bad','PUT',raw)).status,200);
 });
 for(const who of ['owner','manager','admin'])await test('history append/remove '+who+' preserves old history and unknown metadata',async()=>{
  const c=client(who),before=(await c.repo.read('s')).record;let r=await c.repo.mutate('s',{type:'history-add',record:history});assert.equal(r.series.historicalTournaments.length,2);
  assert.equal(r.series.historicalTournaments[1].createdByUid,who);assert.deepEqual(r.series.historicalTournaments[0],before.preserved.historicalTournaments[0]);
  assert.deepEqual(r.record.preserved.futureSystem,before.preserved.futureSystem);assert.deepEqual(r.record.content,before.content);
  r=await c.repo.mutate('s',{type:'history-remove',historicalId:history.id});assert.deepEqual(r.series.historicalTournaments,before.preserved.historicalTournaments);c.repo.dispose();
 });
 await test('concurrent ACL writes use child ETag and never retry',async()=>{
  await control('users/one','PUT',{uid:'one',role:'player'});await control('users/two','PUT',{uid:'two',role:'player'});const gate=defer();let writes=0;const transport=async(u,o)=>{if(o.method==='PUT'){if(++writes===2)gate.resolve();await gate.promise;}return fetch(u,o);};const a=client('owner',transport),b=client('owner',transport);
  const results=await Promise.allSettled([a.repo.mutate('s',{type:'manager-add',uid:'one'}),b.repo.mutate('s',{type:'manager-add',uid:'two'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'SERIES_CONFLICT');assert.equal(writes,2);a.repo.dispose();b.repo.dispose();
 });
 await test('readAll is single-flight and cannot publish data predating confirmed write',async()=>{
  const gate=defer(),seen=defer();let delaying=true;const c=client('owner',async(u,o)=>{const r=await fetch(u,o);if(delaying&&new URL(u).pathname==='/tournamentSeries.json'){seen.resolve();return {ok:r.ok,status:r.status,headers:r.headers,json:async()=>{await gate.promise;return r.json();}};}return r;});
  const first=c.repo.readAll(),second=c.repo.readAll();assert.equal(first,second);await seen.promise;
  await c.repo.mutate('s',{type:'scoring',fields:{bestCount:2}});delaying=false;gate.resolve();await assert.rejects(first,{code:'SERIES_READ_SUPERSEDED'});assert.equal((await c.repo.readAll())[0].bestCount,2);assert.equal(c.repo.snapshot().activeJobs,0);c.repo.dispose();
 });
 await test('transition freezes all appData writes including admin; direct series paths remain independent',async()=>{
  await control('appData','PUT',{updatedAt:1,data:{tournamentSeries:[{id:'old'}],other:{keep:42}}});
  for(const who of ['owner','manager','admin'])for(const path of ['appData','appData/data','appData/data/tournamentSeries','appData/data/federalCup2026'])assert.notEqual((await rest(who,path,'PUT',{stale:true})).status,200);
  for(const method of ['PATCH','DELETE'])assert.notEqual((await rest('admin','appData',method,method==='PATCH'?{data:{stale:true}}:null)).status,200);
  assert.notEqual((await rest('admin','','PATCH',{'appData/data/tournamentSeries':[{id:'stale'}]})).status,200);
  assert.equal((await rest('admin','appData','GET')).status,200);
  const a=client('owner');await a.repo.mutate('s',{type:'scoring',fields:{bestCount:3}});assert.equal((await a.repo.read('s')).series.bestCount,3);a.repo.dispose();
 });
 await test('proof: child false does NOT revoke granted parent write',async()=>{
  const inherited=JSON.parse(JSON.stringify(rules));inherited.rules.appData['.write']='auth != null';inherited.rules.appData.data={tournamentSeries:{'.write':false}};
  await control('.settings/rules','PUT',inherited);
  try{assert.equal((await rest('admin','appData','PUT',{data:{tournamentSeries:[{id:'stale'}]}})).status,200);}finally{await control('.settings/rules','PUT',rules);}
 });
 await test('rendered scoring baseline detects stale editor before PUT',async()=>{
  const a=client(),b=client('manager');const old=(await a.repo.read('s')).record.content,expected={};for(const k of api.fields.filter(k=>!['tournamentIds','updatedAt'].includes(k)))if(Object.prototype.hasOwnProperty.call(old,k))expected[k]=old[k];
  await b.repo.mutate('s',{type:'scoring',fields:{bestCount:5}});
  await assert.rejects(a.repo.mutate('s',{type:'scoring',expected,fields:{pointsTop:[1,2,3,4]}}),{code:'SERIES_CONFLICT'});assert.equal(a.state.calls.filter(c=>c.method==='PUT').length,0);a.repo.dispose();b.repo.dispose();
 });
 await test('snapshot tool reads exact appData wrapper and runs only synthetic migration dry-run',async()=>{
  const snapshots=require('../scripts/series-readonly-snapshots.js'),{plan}=require('../scripts/series-migration-dry-run.cjs');
  const c=client();const source=(await c.repo.read('s')).series;await control('appData','PUT',{updatedAt:1,data:{tournamentSeries:[source]}});
  let calls=0;const capture=snapshots.create({databaseUrl:new URL(url('')).origin,allowLocalEmulator:true,identity:()=>c.state.who,authorize:async()=>({uid:'owner',idToken:token(c.state.who)}),fetch:(u,o)=>{assert.equal(o.method,'GET');calls++;return fetch(u,o);}});
  const files=await capture.capture({approval:'READ ONLY SERIES SNAPSHOTS'});assert.equal(calls,3);assert.ok(files.every(f=>f.snapshot.capture.etag));assert.ok(!JSON.stringify(files).includes('idToken'));
  const r=plan(files[0].snapshot.value.data.tournamentSeries,files[1].snapshot.value,files[2].snapshot.value);assert.equal(r.counts.legacySeries,1);assert.equal(r.counts.links,2);assert.equal(r.counts.historicalTournaments,1);assert.equal(r.productionWrites,0);capture.dispose();c.repo.dispose();
 });
 await test('migration lock blocks ordinary writes, permits conditional admin copy under stable ID',async()=>{
  const fs=require('fs'),file=process.env.SERIES_LOCK_RULES_FILE;if(!file)throw Error('SERIES_LOCK_RULES_FILE required; no skipped lock test');
  await control('.settings/rules','PUT',JSON.parse(fs.readFileSync(file,'utf8')));
  try{
   const owner=client();await assert.rejects(owner.repo.mutate('s',{type:'scoring',fields:{bestCount:9}}),{code:'SERIES_ACCESS_DENIED'});
   await assert.rejects(owner.repo.mutate('locked-create',{type:'create',fields}),{code:'SERIES_ACCESS_DENIED'});owner.repo.dispose();
   const value=api.encodeLegacy({...fields,id:'stable-migration-id',createdByUid:'owner',updatedAt:'now',future:{keep:42}});
   const read=await fetch(url('tournamentSeries/stable-migration-id',token({uid:'admin',emailVerified:true})),{headers:{'X-Firebase-ETag':'true'}});const etag=read.headers.get('ETag');assert.ok(etag);assert.equal(await read.json(),null);
   const put=()=>fetch(url('tournamentSeries/stable-migration-id',token({uid:'admin',emailVerified:true})),{method:'PUT',headers:{'Content-Type':'application/json','if-match':etag},body:JSON.stringify(value)});
   assert.equal((await put()).status,200);assert.equal((await put()).status,412);
   const c=client('admin');assert.deepEqual(api.canonical((await c.repo.read('stable-migration-id')).record),api.canonical(value));c.repo.dispose();
  }finally{await control('.settings/rules','PUT',rules);}
 });
 await test('absent current state after ambiguous create is not proof and never retries',async()=>{
  let puts=0;const c=client('owner',async(u,o)=>{if(o.method==='PUT'){puts++;throw Error('injected uncertain transport before arrival');}return fetch(u,o);});
  await assert.rejects(c.repo.mutate('uncertain-absent',{type:'create',fields}),{code:'SERIES_WRITE_UNCERTAIN'});assert.equal(c.repo.isUncertain('uncertain-absent'),true);
  const view=await c.repo.inspectUncertain('uncertain-absent');assert.equal(view.series,null);assert.equal(view.uncertain,true);assert.match(view.message,/not confirmation/);assert.equal(puts,1);
  c.repo.acknowledgeUncertainty('uncertain-absent',view.inspection);assert.equal(puts,1);assert.equal(c.repo.isUncertain('uncertain-absent'),false);c.repo.dispose();
 });
 console.log('PASS 16 integration engine scenarios; no production access; synthetic Auth, not live Rules');
})().catch(e=>{console.error(e);process.exitCode=1;});
