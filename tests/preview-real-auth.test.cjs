'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const preview=read('test-modular/index.html');
const core=read('test-modular/assets/js/pool-core.js');
const mock=read('test-modular/mock-cloud.js');

test('TEST MODULAR authenticates with real Firebase identity, never production RTDB',()=>{
  const prod=read('index.html');
  const key=s=>s.match(/const FIREBASE_API_KEY = '([^']+)'/)?.[1];
  assert.equal(key(core),key(prod));
  assert.notEqual(key(core),'TEST_CLOUD_DISABLED');
  assert.match(core,/const FIREBASE_DB = 'https:\/\/poolcitalo-test\.invalid'/);
  assert.doesNotMatch(core,/bc-rybarna-scrbrd-default-rtdb\.europe-west1\.firebasedatabase\.app/);
  assert.doesNotThrow(()=>new Function(core));
  assert.match(core,/TEST_REGISTRATION_DISABLED/);
  assert.match(core,/poolTestSetRole/);
  assert.match(core,/if\(window\.POOL_TEST_MODE\)return currentUserRole==='system_admin'/);
  assert.match(core,/TEST_VERIFICATION_EMAIL_DISABLED/);
  const csp=preview.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]||'';
  assert.match(csp,/connect-src https:\/\/identitytoolkit\.googleapis\.com https:\/\/securetoken\.googleapis\.com/);
  assert.doesNotMatch(csp,/firebaseio|firebasedatabase|unsafe-inline|\*/);
  assert.match(preview,/id="poolTestRole"/);
  assert.ok(preview.indexOf('poolcitadlo-test-isolation')<preview.indexOf('mock-cloud.js'));
  assert.ok(preview.indexOf('mock-cloud.js')<preview.indexOf('assets/js/pool-core.js'));
  assert.match(preview,/poolcitadlo_test_modular_v45175__/);
});

test('Offline datastore handles local CRUD without making any external requests',async()=>{
  const data=new Map();
  data.set('bc_rybarna_scoreboard_v1',JSON.stringify({players:{'demo-1':{id:'demo-1',name:'Demo'}}}));
  const storage={
    getItem:key=>data.has(key)?data.get(key):null,
    setItem:(key,value)=>data.set(key,String(value))
  };
  let realRequests=0;
  const window={
    POOL_TEST_MODE:true,
    location:{href:'https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/test-modular/'},
    fetch:async()=>{realRequests++;return new Response('{"ok":true}',{status:200});}
  };
  const context={window,localStorage:storage,Response,URL,JSON,Math,Date,console};
  vm.runInNewContext(mock,context);
  const base='https://poolcitalo-test.invalid/';
  async function request(route,method='GET',body){
    const r=await window.fetch(base+route+'.json?auth=unused',{method,...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.equal(r.status,200);
    return await r.json();
  }
  assert.equal((await request('players/demo-1')).name,'Demo');
  await request('matches/demo-match','PUT',{id:'demo-match',scores:[1,0]});
  assert.equal((await request('matches/demo-match')).scores[0],1);
  await request('matches/demo-match','PATCH',{status:'complete'});
  assert.equal((await request('matches/demo-match')).status,'complete');
  await request('matches/demo-match','DELETE');
  assert.equal(await request('matches/demo-match'),null);
  assert.equal(realRequests,0);
  await window.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup');
  assert.equal(realRequests,1);
  assert.equal(window.poolTestCloudInfo.database,'LOCAL_STORAGE_ONLY');
});
