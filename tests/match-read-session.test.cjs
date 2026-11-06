'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const {topFunction}=require('./helpers/source-functions.cjs');

const source=fs.readFileSync(process.env.D4_BASELINE_SOURCE||path.join(__dirname,'../index.html'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function deferred(){
  let resolve,reject;
  const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});
  return {promise,resolve,reject};
}
const ok=value=>({ok:true,json:async()=>value});
const repairId='6a0a8d43-e9c9-404d-adbc-9584e086e587';
const historical=()=>({old:{id:repairId,playerIds:['p1','p2'],scores:[5,3],futureField:{keep:[0,null,false]}}});

function setup(){
  const gets=[],puts=[],renders=[],cache=[],timers=[],confirmations=[],auth=[];
  let tokenReply=async()=>ok({id_token:'renewed-A',refresh_token:'refresh-A',expires_in:3600});
  let authorizeRepair;
  const c={
    cloudSessionGeneration:0,cloudUid:'A',cloudAuthenticated:true,cloudIdToken:'id-A',
    cloudRefreshToken:'refresh-A',cloudTokenExpiresAt:Date.now()+3600000,cloudUserEmail:'',
    currentUserRole:'system_admin',currentUserPlayerId:null,currentUserClubId:null,
    currentUserProfileClaimId:null,cloudEmailVerified:true,cloudLastError:'',
    FIREBASE_API_KEY:'mock',DB_KEY:'db',
    CLOUD_REFRESH_KEY:'refresh',CLOUD_EMAIL_KEY:'email',
    CLOUD_ADMIN_SESSION_REFRESH_KEY:'admin-refresh',CLOUD_ADMIN_SESSION_EMAIL_KEY:'admin-email',
    data:{matches:[{id:'current'}]},cloudAutoSync:null,ownReportsSync:null,adminReportsSync:null,
    invalidateFederalReport(){},refreshAccountUI(){},updateLoggedInUserBadge(){},
    setCloudStatus(){},startCloudAutoSync(){},persistCloudSession(){},
    persistedCloudSession:()=>({}),isMainAdminEmail:()=>false,
    matchIsDoubles:m=>!!m.doublesMode,findPlayerByName:()=>null,
    currentUserIsSystemAdmin:()=>c.currentUserRole==='system_admin',
    cloudUrl:resource=>'https://mock.invalid/'+resource+'?auth='+c.cloudIdToken,
    window:{renderModernHome:()=>renders.push(c.data.matches[0]?.id)},
    console:{warn(){}},localStorage:{setItem:(key,value)=>cache.push({key,value}),removeItem(){}},
    sessionStorage:{removeItem(){}},setTimeout:fn=>timers.push(fn),
    maybeShowPendingResultConfirmation:()=>confirmations.push(c.cloudUid),
    async fetch(url,options){
      const u=new URL(url);
      if(u.hostname==='identitytoolkit.googleapis.com')return ok({idToken:'login-A',refreshToken:'refresh-A'});
      if(u.hostname==='securetoken.googleapis.com'){auth.push(url);return tokenReply();}
      if(options.method==='PUT'){puts.push({path:u.pathname,body:JSON.parse(options.body)});return ok(null);}
      const response=deferred();
      gets.push({url,options,...response});
      return response.promise;
    }
  };
  const a=source.indexOf('  let secureMatchesLoad=');
  const b=source.indexOf('  async function saveSecureMatch(',a);
  assert.ok(a>=0&&b>a);
  vm.createContext(c);
  vm.runInContext(source.slice(a,b)+'\n'+[
    'firebaseSignIn','firebaseRefreshAuth','ensureCloudToken','clearRuntimeCloudIdentity',
    'secureMatchRequest','applyKnownHistoricalMatchMetadataRepairs','applyEffectiveConfirmationStatus',
    'matchConfirmationComplete','matchConfirmationRejected'
  ].map(name=>topFunction(source,name)).join('\n'),c);
  const originalEnsure=c.ensureCloudToken;
  c.ensureCloudToken=context=>authorizeRepair&&renders.length===0&&c.data.matches[0]?.id===repairId
    ?authorizeRepair.promise:originalEnsure(context);
  function change(uid){
    c.clearRuntimeCloudIdentity();
    c.cloudUid=uid;
    c.cloudAuthenticated=!!uid;
    c.cloudIdToken=uid?'id-'+uid:'';
    c.cloudRefreshToken=uid?'refresh-'+uid:'';
    c.cloudTokenExpiresAt=Date.now()+3600000;
    c.currentUserRole='system_admin';
    c.data.matches=[{id:uid?'fresh-'+uid:'offline'}];
  }
  async function delayedDecode(){
    const read=c.loadSecureMatches();
    read.catch(()=>{});
    await tick();
    const decoded=deferred();
    gets.at(-1).resolve({ok:true,json:()=>decoded.promise});
    await tick();
    return {read,decoded};
  }
  return {c,gets,puts,renders,cache,timers,confirmations,auth,change,delayedDecode,
    holdToken(reply){c.cloudTokenExpiresAt=0;tokenReply=()=>reply.promise;},
    holdRepair(reply){authorizeRepair=reply;}
  };
}

for(const sequence of [['B','A'],['','A'],['B']]){
  test('delayed decode after A → '+sequence.map(x=>x||'logout').join(' → ')+' cannot publish or repair',async()=>{
    const h=setup();
    const {read,decoded}=await h.delayedDecode();
    sequence.forEach(h.change);
    // The mock always completes the old response, independent of cancellation.
    decoded.resolve(historical());
    await assert.rejects(read,/MATCHES_IDENTITY_CHANGED/);
    assert.equal(h.c.data.matches[0].id,'fresh-'+sequence.at(-1));
    assert.deepEqual([h.cache.length,h.renders.length,h.timers.length,h.puts.length],[0,0,0,0]);
  });
}

test('successful login of the same UID invalidates a read without needing an intervening logout',async()=>{
  const h=setup();
  const {read,decoded}=await h.delayedDecode();
  await h.c.firebaseSignIn('a@example.invalid','mock-password');
  decoded.resolve(historical());
  await assert.rejects(read,/MATCHES_IDENTITY_CHANGED/);
  assert.equal(h.c.cloudUid,'A');
  assert.equal(h.c.data.matches[0].id,'current');
});

test('new A gets its own pending read and the old finalizer cannot clear it',async()=>{
  const h=setup();
  const old=h.c.loadSecureMatches();
  old.catch(()=>{});
  await tick();
  h.change('B');
  h.change('A');
  const fresh=h.c.loadSecureMatches();
  assert.notEqual(fresh,old);
  await tick();
  assert.equal(h.gets.length,2);
  h.gets[0].resolve(ok(historical()));
  await assert.rejects(old,/MATCHES_IDENTITY_CHANGED/);
  assert.equal(h.c.loadSecureMatches(),fresh);
  h.gets[1].resolve(ok({new:{id:'new'}}));
  await fresh;
  assert.equal(h.gets.length,2);
  assert.equal(h.c.data.matches[0].id,'new');
});

for(const failure of [false,true]){
  test('old token refresh '+(failure?'failure':'success')+' cannot change later session or dispatch GET',async()=>{
    const h=setup();
    const refresh=deferred();
    h.holdToken(refresh);
    const old=h.c.loadSecureMatches();
    old.catch(()=>{});
    await tick();
    assert.equal(h.auth.length,1);
    h.change('B');
    if(failure)refresh.reject(Error('old refresh failed'));
    else refresh.resolve(ok({id_token:'obsolete-A',refresh_token:'obsolete-A',expires_in:3600}));
    await tick();
    assert.equal(h.gets.length,0);
    await assert.rejects(old,/NO_AUTH|MATCHES_IDENTITY_CHANGED/);
    assert.equal(h.c.cloudUid,'B');
    assert.equal(h.c.cloudIdToken,'id-B');
    assert.equal(h.c.cloudRefreshToken,'refresh-B');
  });
}

test('20 valid callers share authorization and one GET after token renewal',async()=>{
  const h=setup();
  const refresh=deferred();
  h.holdToken(refresh);
  const reads=Array.from({length:20},()=>h.c.loadSecureMatches());
  assert.ok(reads.every(read=>read===reads[0]));
  await tick();
  assert.equal(h.auth.length,1);
  assert.equal(h.gets.length,0);
  refresh.resolve(ok({id_token:'renewed-A',refresh_token:'refresh-A',expires_in:3600}));
  await tick();
  assert.equal(h.gets.length,1);
  assert.match(h.gets[0].url,/auth=renewed-A&t=\d+$/);
  assert.equal(h.gets[0].options.cache,'no-store');
  h.gets[0].resolve(ok(historical()));
  await Promise.all(reads);
  await tick();
  const [match]=h.c.data.matches;
  assert.equal(match.status,'complete');
  assert.equal(match.doublesMode,true);
  assert.deepEqual(h.puts,[{path:'/matches/'+repairId,body:JSON.parse(JSON.stringify(match))}]);
  assert.deepEqual(match.futureField,{keep:[0,null,false]});
  assert.equal(h.cache.length,1);
  assert.deepEqual(JSON.parse(h.cache[0].value).matches[0],h.puts[0].body);
  assert.deepEqual(h.renders,[repairId]);
  h.timers[0]();
  assert.deepEqual(h.confirmations,['A']);
});

test('identity change during authorization of repair prevents PUT and old confirmation timer',async()=>{
  const h=setup();
  const repair=deferred();
  h.holdRepair(repair);
  const read=h.c.loadSecureMatches();
  await tick();
  h.gets[0].resolve(ok(historical()));
  await read;
  h.change('B');
  repair.resolve(true);
  await tick();
  h.timers[0]();
  assert.deepEqual(h.puts,[]);
  assert.deepEqual(h.confirmations,[]);
});

test('regular player keeps local historical normalization without repair PUT',async()=>{
  const h=setup();
  h.c.currentUserRole='player';
  const read=h.c.loadSecureMatches();
  await tick();
  h.gets[0].resolve(ok(historical()));
  await read;
  assert.equal(h.c.data.matches[0].doublesMode,true);
  assert.equal(h.puts.length,0);
});

test('valid collection reads retain completed and pending match confirmation semantics',async()=>{
  const h=setup();
  const read=h.c.loadSecureMatches();
  await tick();
  const match={confirmationRequired:true,confirmationUids:['A','B'],createdByUid:'A'};
  h.gets[0].resolve(ok({
    empty:null,
    complete:{...match,id:'complete',adminConfirmation:{confirmed:true}},
    pending:{...match,id:'pending'},
    rejected:{...match,id:'rejected',confirmations:{B:'rejected'}}
  }));
  await read;
  assert.equal(h.c.data.matches.map(m=>m.status).join(','),'complete,pending_confirmation,needs_correction');
  assert.equal(h.puts.length,0);
});

test('401, 403, offline and malformed JSON keep existing errors and allow a fresh read',async()=>{
  const h=setup();
  for(const status of [401,403,'offline','decode']){
    const read=h.c.loadSecureMatches();
    read.catch(()=>{});
    await tick();
    const req=h.gets.at(-1);
    if(status==='offline')req.reject(Error('offline'));
    else if(status==='decode')req.resolve({ok:true,json:async()=>{throw SyntaxError('invalid JSON');}});
    else req.resolve({ok:false,status});
    await assert.rejects(read,new RegExp(typeof status==='number'?'MATCHES_READ_'+status:status==='decode'?'invalid JSON':status));
  }
  assert.equal(h.cache.length,0);
  assert.equal(h.c.data.matches[0].id,'current');
  const next=h.c.loadSecureMatches();
  await tick();
  h.gets.at(-1).resolve(ok({fresh:{id:'fresh'}}));
  await next;
  assert.equal(h.gets.length,5);
  assert.equal(h.c.data.matches[0].id,'fresh');
});
