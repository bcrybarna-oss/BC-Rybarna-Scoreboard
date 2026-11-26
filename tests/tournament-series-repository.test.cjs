'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../assets/js/tournament-series-repository.js'),{plan}=require('../scripts/series-migration-dry-run.cjs');
const legacy=()=>({id:'s',createdByUid:'owner',managerUids:{manager:true},name:'Synthetic',tournamentIds:['a','missing','a'],updatedAt:'2026-11-24',pointsTop:[100,80],scoringMode:'bands',historicalTournaments:[{id:'h',results:[{place:1}]}],future:{nested:42}});
test('preparation is off by default, makes no requests',async()=>{let calls=0;const r=api.create({identity:()=>({uid:'owner',authenticated:true,emailVerified:true}),authorize:async()=>true,url:()=>'',fetch:async()=>calls++});await assert.rejects(r.read('s'),{code:'SERIES_AUTHORITY_DISABLED'});assert.equal(calls,0);r.dispose();r.dispose();assert.equal(r.snapshot().activeJobs,0);});
test('lossless legacy mapping preserves histories, unknown fields and duplicates without mutating input',()=>{const s=legacy(),before=JSON.stringify(s);const packed=api.encodeLegacy(s);assert.deepEqual(api.decodeRecord(packed,'s'),s);assert.equal(JSON.stringify(s),before);assert.deepEqual(packed.preserved.future,s.future);assert.equal(packed.content.createdByUid,undefined);assert.equal(packed.content.managerUids,undefined);});
test('Firebase empty maps and sparse numeric references decode without changing stored record',()=>{const p=api.encodeLegacy(legacy());p.content.tournamentIds={'0':'a','3':'b'};const before=JSON.stringify(p);assert.deepEqual(api.decodeRecord(p,'s').tournamentIds,['a','b']);assert.equal(JSON.stringify(p),before);assert.deepEqual(api.canonical({ids:[]}),api.canonical({}));assert.deepEqual(api.canonical({ids:['a',null,'b']}),api.canonical({ids:{'0':'a','2':'b'}}));});
test('foreign schema and ID cannot be accepted',()=>{const p=api.encodeLegacy(legacy());assert.throws(()=>api.decodeRecord(p,'other'),{code:'INVALID_SERIES_RECORD'});p.schemaVersion=2;assert.throws(()=>api.decodeRecord(p,'s'),{code:'INVALID_SERIES_RECORD'});assert.throws(()=>api.encodeLegacy({...legacy(),createdByUid:''}),{code:'MISSING_SERIES_OWNER'});});
test('dry run reports counts, ACL, scoring, missing refs, history, unknowns, target conflicts; repairs nothing',()=>{const a=legacy(),b={...legacy(),id:'t',tournamentIds:['b']},before=JSON.stringify([a,b]),target={s:api.encodeLegacy(a),t:{different:true},extra:{id:'extra'}};const r=plan([a,b],target,{a:{},b:{}});assert.equal(JSON.stringify([a,b]),before);assert.deepEqual(r.counts,{legacySeries:2,targetSeries:3,links:4,historicalTournaments:2,missingTarget:0,identical:1,conflict:1,invalid:0});assert.deepEqual(r.rows[0].missingReferences,['missing']);assert.deepEqual(r.rows[0].duplicateLinks,['a']);assert.deepEqual(r.rows[0].managers,['manager']);assert.ok(r.rows[0].unknownFields.includes('future'));assert.deepEqual(r.orphanTargetIds,['extra']);assert.equal(r.productionWrites,0);assert.equal(r.automaticRepair,false);});
test('dry run detects duplicate IDs and missing owners without invented repairs',()=>{const r=plan([legacy(),legacy(),{id:'bad'}],{});assert.ok(r.rows[1].issues.includes('DUPLICATE_SERIES_ID'));assert.equal(r.rows[2].status,'invalid');assert.ok(r.rows[2].issues.includes('MISSING_SERIES_OWNER'));});
test('scoring input cannot smuggle ACL or unknown fields, zero fetches',()=>{let calls=0;const r=api.create({identity:()=>({uid:'owner',authenticated:true,emailVerified:true}),enabled:()=>true,authorize:async()=>true,url:()=>'',fetch:async()=>calls++});for(const key of ['createdByUid','id','managerUids','preserved','future'])assert.throws(()=>r.mutate('s',{type:'scoring',fields:{[key]:'bad'}}),{code:'FORBIDDEN_SCORING_FIELD'});assert.equal(calls,0);r.dispose();});
test('credential must belong to captured verified owner before URL construction',async()=>{let urls=0;const r=api.create({identity:()=>({uid:'A',authenticated:true,emailVerified:true,generation:1}),enabled:()=>true,authorize:async()=>({uid:'B',idToken:'not-a-real-token'}),url:()=>urls++,fetch:async()=>{throw Error('must not fetch');}});await assert.rejects(r.read('s'),{code:'SERIES_CREDENTIAL_OWNER_MISMATCH'});assert.equal(urls,0);assert.equal(r.snapshot().activeJobs,0);r.dispose();});

test('CLI dry run preserves inputs and refuses existing output, wrong paths and old backup authority',()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),{spawnSync}=require('child_process'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'series-dry-'));
 const l=path.join(dir,'legacy.json'),t=path.join(dir,'target.json'),out=path.join(dir,'report.json'),script=path.resolve(__dirname,'../scripts/series-migration-dry-run.cjs');
 fs.writeFileSync(l,JSON.stringify([legacy()]));fs.writeFileSync(t,'{}');const before=[fs.readFileSync(l,'utf8'),fs.readFileSync(t,'utf8')];
 const args=['--legacy',l,'--target',t,'--source-kind','synthetic','--out',out];
 assert.equal(spawnSync(process.execPath,[script,...args]).status,0);const report=fs.readFileSync(out,'utf8');
 assert.equal(spawnSync(process.execPath,[script,...args]).status,1);assert.equal(fs.readFileSync(out,'utf8'),report);
 assert.deepEqual([fs.readFileSync(l,'utf8'),fs.readFileSync(t,'utf8')],before);
 assert.equal(spawnSync(process.execPath,[script,'--legacy',l,'--target',t,'--source-kind','server-snapshot']).status,1);
 const capture={databaseUrl:'https://synthetic.invalid',capturedAt:'2026-11-24',etag:'synthetic',path:'/wrong'};
 fs.writeFileSync(l,JSON.stringify({capture,value:{tournamentSeries:[]}}));fs.writeFileSync(t,JSON.stringify({capture:{...capture,path:'/tournamentSeries'},value:{}}));
 const wrong=spawnSync(process.execPath,[script,'--legacy',l,'--target',t,'--source-kind','server-snapshot']);assert.equal(wrong.status,1);assert.match(wrong.stderr.toString(),/Snapshot path mismatch/);
});

test('authorization wait is invalidated by UID, generation, profile, role, verification or logout without GET',async()=>{
 for(const change of [{uid:'B'},{generation:2},{profileId:'other'},{role:'system_admin'},{emailVerified:false},{authenticated:false}]){
  let who={uid:'A',authenticated:true,emailVerified:true,generation:1,profileId:'profile',role:'player'},resolve,calls=0;const credential=new Promise(r=>resolve=r);
  const r=api.create({enabled:()=>true,identity:()=>who,authorize:()=>credential,url:()=>'',fetch:()=>calls++});
  const reading=r.read('s');who={...who,...change};r.syncIdentity();resolve({uid:'A',idToken:'synthetic'});
  await assert.rejects(reading,{code:'SERIES_SESSION_CHANGED'});assert.equal(calls,0);assert.equal(r.snapshot().activeJobs,0);r.dispose();
 }
});
test('old readAll finalizer cannot clear newer single flight',async()=>{
 let who={uid:'owner',authenticated:true,emailVerified:true,generation:1},resolveOld,resolveNew,calls=0,auth=0;
 const old=new Promise(r=>resolveOld=r),next=new Promise(r=>resolveNew=r);
 const r=api.create({enabled:()=>true,identity:()=>who,authorize:()=>++auth===1?old:next,url:()=> 'http://synthetic.invalid',fetch:async()=>{calls++;return new Response(JSON.stringify({s:api.encodeLegacy(legacy())}));}});
 const a=r.readAll();await new Promise(r=>setImmediate(r));who={...who,generation:2};r.syncIdentity();const b=r.readAll();await new Promise(r=>setImmediate(r));
 resolveOld({uid:'owner',idToken:'synthetic'});await assert.rejects(a,{code:'SERIES_SESSION_CHANGED'});assert.equal(r.readAll(),b);
 resolveNew({uid:'owner',idToken:'synthetic'});assert.equal((await b).length,1);assert.equal(calls,1);assert.equal(r.snapshot().activeJobs,0);r.dispose();
});

test('new authority rejects unsafe rendered identifiers without dropping or repairing source data',()=>{
 const raw={...legacy(),id:"unsafe'"},before=JSON.stringify(raw),report=plan([raw],{});assert.equal(report.counts.invalid,1);assert.ok(report.rows[0].issues.includes('UNSAFE_SERIES_IDENTIFIER'));assert.equal(JSON.stringify(raw),before);
 assert.throws(()=>api.decodeRecord(api.encodeLegacy(raw),raw.id),{code:'UNSAFE_SERIES_IDENTIFIER'});
 let calls=0;const r=api.create({enabled:()=>true,identity:()=>({uid:'owner',authenticated:true,emailVerified:true}),authorize:async()=>{},fetch:()=>calls++,url:()=>''});assert.throws(()=>r.mutate('s',{type:'manager-add',uid:"unsafe'"}),{code:'UNSAFE_SERIES_IDENTIFIER'});assert.equal(calls,0);r.dispose();
});
