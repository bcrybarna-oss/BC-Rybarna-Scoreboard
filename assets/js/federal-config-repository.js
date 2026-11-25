// Only the Federal Cup configuration child. No root writes, polling, storage or fallback.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FederalConfigRepository=api;})(globalThis,function(){
 'use strict';const path='appData/data/federalCup2026',clone=x=>JSON.parse(JSON.stringify(x)),error=(code,extra={})=>Object.assign(new Error(code),{code,...extra});
 function create(o){
  const clock=o.clock||globalThis;let epoch=0,disposed=false,scope=key(),reading=null,writing=null,revision=0;const jobs=new Set(),uncertain=new Set(),inspections=new Map();let nonce=0;
  function identity(){const w=o.identity();return {uid:w?.uid||'',authenticated:w?.authenticated===true,emailVerified:w?.emailVerified===true,profileId:w?.profileId||'',role:w?.role||'',generation:w?.generation??null};}
  function key(){return JSON.stringify(identity());}const actor=w=>JSON.stringify([w.uid,w.profileId]);
  function syncIdentity(){if(scope!==key()){scope=key();invalidate();}}
  function invalidate(){epoch++;revision++;reading=null;writing=null;inspections.clear();for(const j of jobs){j.controller.abort();for(const cancel of j.cancelRequests)cancel();}jobs.clear();}
  function ticket(){syncIdentity();const who=identity();if(disposed||o.enabled?.()!==true)throw error('FC_AUTHORITY_DISABLED');if(!who.uid||!who.authenticated||!who.emailVerified)throw error('FC_AUTH_REQUIRED');const generation=epoch,j={who,controller:new AbortController(),cancelRequests:new Set(),current:()=>{syncIdentity();return !disposed&&generation===epoch&&key()===JSON.stringify(who)&&o.enabled?.()===true;}};jobs.add(j);return j;}
  function guard(j){if(!j.current())throw error('FC_SESSION_CHANGED');}
  async function request(j,method='GET',body,etag){
   guard(j);const c=await o.authorize({current:j.current,signal:j.controller.signal});guard(j);if(c?.uid!==j.who.uid||!c.idToken)throw error('FC_CREDENTIAL_MISMATCH');
   const encoded=method==='PUT'?JSON.stringify(body):undefined,url=o.url(path,c.idToken);guard(j);let timer,cancel;const cancelled=new Promise((_,reject)=>{cancel=()=>reject(error('FC_SESSION_CHANGED',{writeSent:method==='PUT'}));j.cancelRequests.add(cancel);});
   const timeout=new Promise((_,reject)=>{timer=clock.setTimeout(()=>{j.controller.abort();reject(error(method==='PUT'?'FC_WRITE_UNCERTAIN':'FC_READ_TIMEOUT'));},o.timeoutMs||15000);});
   const operation=(async()=>{let r;try{r=await o.fetch(url,{method,cache:'no-store',signal:method==='GET'?j.controller.signal:undefined,headers:method==='GET'?{'X-Firebase-ETag':'true'}:{'Content-Type':'application/json','if-match':etag},...(method==='PUT'?{body:encoded}:{})});}catch(e){if(method==='PUT')throw error('FC_WRITE_UNCERTAIN');guard(j);throw error('FC_READ_FAILED');}
    if(method==='PUT'&&!j.current())throw error('FC_SESSION_CHANGED',{writeSent:true,acknowledged:r.ok});guard(j);
    if(!r.ok)throw error(method==='PUT'&&r.status>=500?'FC_WRITE_UNCERTAIN':r.status===412?'FC_CONFLICT':r.status===401||r.status===403?'FC_ACCESS_DENIED':'FC_REQUEST_FAILED',{status:r.status});
    let value;try{value=await r.json();}catch(e){throw error(method==='PUT'?'FC_WRITE_UNCERTAIN':'FC_INVALID_JSON');}guard(j);return {value,etag:r.headers.get('ETag')};})();
   try{return await Promise.race([operation,timeout,cancelled]);}finally{clock.clearTimeout(timer);j.cancelRequests.delete(cancel);}
  }
  function read(){syncIdentity();if(reading)return reading.promise;if(writing)return Promise.reject(error('FC_BUSY'));const j=ticket(),at=revision;reading=j;
   j.promise=Promise.resolve().then(async()=>{const r=await request(j);if(at!==revision)throw error('FC_READ_SUPERSEDED');return o.normalize(r.value);}).finally(()=>{jobs.delete(j);if(reading===j)reading=null;});return j.promise;
  }
  function save(next,expected){syncIdentity();const input=clone(next),base=clone(expected),signature=JSON.stringify([input,base]);if(writing)return writing.signature===signature?writing.promise:Promise.reject(error('FC_BUSY'));
   const j=ticket(),actorKey=actor(j.who);if(uncertain.has(actorKey)){jobs.delete(j);throw error('FC_WRITE_UNCERTAIN_PENDING');}
   revision++;j.signature=signature;writing=j;
   j.promise=Promise.resolve().then(async()=>{
    if(!o.canWrite(j.who))throw error('FC_ACCESS_DENIED');const remote=await request(j);if(!remote.etag)throw error('FC_ETAG_MISSING');
    if(o.fingerprint(remote.value)!==o.fingerprint(base))throw error('FC_CONFLICT');
    if(o.fingerprint(input)===o.fingerprint(remote.value))return {outcome:'unchanged',config:o.normalize(remote.value)};
    const previous=Number(remote.value?.updatedAt||0);if(!Number.isSafeInteger(previous)||previous<0||previous>=Number.MAX_SAFE_INTEGER)throw error('FC_INVALID_REVISION');
    const config=o.normalize({...remote.value,...input});config.updatedAt=Math.max(o.now?.()||Date.now(),previous+1);
    const ack=await request(j,'PUT',config,remote.etag);if(o.fingerprint(ack.value)!==o.fingerprint(config))throw error('FC_WRITE_UNCERTAIN');return {outcome:'saved',config:o.normalize(ack.value)};
   }).catch(e=>{if(e.code==='FC_WRITE_UNCERTAIN'||(e.code==='FC_SESSION_CHANGED'&&e.writeSent))uncertain.add(actorKey);throw e;}).finally(()=>{jobs.delete(j);if(writing===j)writing=null;});return j.promise;
  }
  async function inspect(){const j=ticket();try{const r=await request(j),config=o.normalize(r.value),inspection=String(++nonce);inspections.set(actor(j.who),{inspection,scope});return {config,inspection,currentStateOnly:true};}finally{jobs.delete(j);}}
  function acknowledge(inspection){syncIdentity();const a=actor(identity()),old=inspections.get(a);if(!old||old.scope!==scope||old.inspection!==inspection)throw error('FC_INSPECTION_REQUIRED');uncertain.delete(a);inspections.delete(a);}
  function dispose(){if(disposed)return;disposed=true;invalidate();}
  function snapshot(){syncIdentity();return {disposed,activeJobs:jobs.size,reading:!!reading,writing:!!writing,uncertain:uncertain.has(actor(identity()))};}
  return Object.freeze({read,save,inspect,acknowledge,syncIdentity,dispose,snapshot});
 }
 return Object.freeze({create,path});
});
