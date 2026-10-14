/* Poolčítadlo TEST MODULAR: real Firebase Authentication, local-only fake RTDB.
   The fake host is not a network endpoint; every request to it is intercepted
   before fetch. No production database host is present in the test core. */
(function(){
  'use strict';
  if(window.POOL_TEST_MODE!==true)throw Error('TEST_CLOUD_SHIM_MUST_BE_ISOLATED');
  const fakeHost='poolcitalo-test.invalid';
  const storageKey='poolcitadlo_test_modular_cloud_v1';
  const originalFetch=window.fetch.bind(window);
  const demoKey='bc_rybarna_scoreboard_v1';
  function clone(value){return value===undefined?null:JSON.parse(JSON.stringify(value));}
  function seed(){
    try{
      const data=JSON.parse(localStorage.getItem(demoKey)||'{}');
      return {players:data.players||{},matches:{},tournaments:{},users:{},appData:null};
    }catch(_){return {players:{},matches:{},tournaments:{},users:{},appData:null};}
  }
  function read(){
    try{
      const raw=localStorage.getItem(storageKey);
      if(raw){const x=JSON.parse(raw);if(x&&typeof x==='object')return x;}
    }catch(e){console.warn('TEST CLOUD READ',e);}
    const state=seed();
    try{localStorage.setItem(storageKey,JSON.stringify(state));}catch(e){}
    return state;
  }
  function write(state){localStorage.setItem(storageKey,JSON.stringify(state));}
  function resolve(state,parts){
    let node=state;
    for(const p of parts){
      if(node===null||typeof node!=='object'||!Object.hasOwn(node,p))return null;
      node=node[p];
    }
    return clone(node);
  }
  function put(state,parts,value,mode){
    if(!parts.length){
      if(mode==='PATCH')Object.assign(state,value||{});
      else throw Error('TEST_ROOT_WRITE_BLOCKED');
      return;
    }
    let node=state;
    for(const p of parts.slice(0,-1)){
      if(!node[p]||typeof node[p]!=='object'||Array.isArray(node[p]))node[p]={};
      node=node[p];
    }
    const leaf=parts[parts.length-1];
    if(mode==='DELETE'||value===null){delete node[leaf];return;}
    if(mode==='PATCH'&&value&&typeof value==='object'&&!Array.isArray(value)){
      node[leaf]={...(node[leaf]&&typeof node[leaf]==='object'?node[leaf]:{}),...value};
    }else{node[leaf]=clone(value);}
  }
  function response(value,status=200){
    return new Response(JSON.stringify(value),{
      status,headers:{'Content-Type':'application/json; charset=utf-8'}
    });
  }
  window.fetch=async function testCloudFetch(input,options){
    const rawUrl=typeof input==='string'?input:input?.url;
    let url;
    try{url=new URL(rawUrl,window.location.href);}catch(e){return originalFetch(input,options);}
    if(url.hostname!==fakeHost)return originalFetch(input,options);
    const parts=url.pathname.replace(/\\/g,'/').replace(/\\.json$/,'').split('/').filter(Boolean).map(decodeURIComponent);
    const method=String(options?.method||input?.method||'GET').toUpperCase();
    try{
      const state=read();
      if(method==='GET'||method==='HEAD')return response(resolve(state,parts));
      const parsed=options?.body?JSON.parse(options.body):null;
      if(method==='PUT'||method==='PATCH'||method==='DELETE'){
        put(state,parts,parsed,method);
        write(state);
        return response(method==='DELETE'?null:resolve(state,parts));
      }
      if(method==='POST'){
        const generated='test-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
        put(state,parts.concat(generated),parsed,'PUT');
        write(state);
        return response({name:generated});
      }
      return response({error:'TEST_METHOD_UNSUPPORTED'},405);
    }catch(e){
      console.error('Poolčítadlo TEST local datastore:',e);
      return response({error:String(e.message||e)},507);
    }
  };
  window.poolTestCloudInfo=Object.freeze({
    mode:'REAL_FIREBASE_AUTH_LOCAL_DATA',
    database:'LOCAL_STORAGE_ONLY',
    fakeHost
  });
})();
