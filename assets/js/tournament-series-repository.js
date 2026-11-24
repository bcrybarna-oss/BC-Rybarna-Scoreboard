// Prepared series authority. No bootstrap, polling, storage, or automatic activation.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TournamentSeriesRepository=api;})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const FIELDS=Object.freeze(['tournamentIds','scoringMode','placementTieBreak','bestCount','pointsTop','pointsBands','customPointsText','customPoints','updatedAt']);
 const SCORING=FIELDS.filter(k=>!['tournamentIds','updatedAt'].includes(k));
 const copy=x=>JSON.parse(JSON.stringify(x));
 const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
 const fail=(code,extra={})=>Object.assign(new Error(code),{code,...extra});
 function id(value){if(typeof value!=='string'||!value||value.length>128||/[.#$\[\]/\u0000-\u001f\u007f]/.test(value))throw fail('INVALID_SERIES_ID');return value;}
 function encodeLegacy(s){
  id(s?.id);if(typeof s.createdByUid!=='string'||!s.createdByUid)throw fail('MISSING_SERIES_OWNER');
  const content={},preserved={};
  for(const k of Object.keys(s)){
   if(FIELDS.includes(k))Object.defineProperty(content,k,{value:copy(s[k]),enumerable:true,writable:true,configurable:true});
   else if(!['id','createdByUid','managerUids'].includes(k))Object.defineProperty(preserved,k,{value:copy(s[k]),enumerable:true,writable:true,configurable:true});
  }
  const result={schemaVersion:1,id:s.id,createdByUid:s.createdByUid,content,preserved};
  if(own(s,'managerUids'))result.managerUids=copy(s.managerUids);
  return result;
 }
 function decodeRecord(s,expectedId){
  if(!s||s.schemaVersion!==1||s.id!==id(expectedId)||typeof s.createdByUid!=='string'||!s.createdByUid)throw fail('INVALID_SERIES_RECORD');
  const view={...copy(s.preserved||{}),...copy(s.content||{}),id:s.id,createdByUid:s.createdByUid,...(own(s,'managerUids')?{managerUids:copy(s.managerUids)}:{})};
  if(view.tournamentIds)view.tournamentIds=Object.entries(view.tournamentIds).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,v])=>v).filter(v=>v!==null);
  return view;
 }
 // Comparison only: Firebase omits null/empty containers and may return numeric maps.
 function canonical(x){
  if(x===null||x===undefined)return null;if(typeof x!=='object')return x;
  const entries=Object.keys(x).sort().map(k=>[k,canonical(x[k])]).filter(([,v])=>v!==null);
  return entries.length?Object.fromEntries(entries):null;
 }
 const equal=(a,b)=>JSON.stringify(canonical(a))===JSON.stringify(canonical(b));
 function captureIdentity(x){return {uid:x?.uid||'',authenticated:x?.authenticated===true,emailVerified:x?.emailVerified===true,role:x?.role||'',profileId:x?.profileId||'',generation:x?.generation??null};}
 function captureOperation(op){
  if(!op||!['add','remove','scoring'].includes(op.type))throw fail('INVALID_SERIES_OPERATION');
  if(op.type!=='scoring')return {type:op.type,tournamentId:id(op.tournamentId)};
  if(!op.fields||typeof op.fields!=='object'||Array.isArray(op.fields))throw fail('INVALID_SCORING_FIELDS');
  const fields={};for(const k of Object.keys(op.fields)){if(!SCORING.includes(k))throw fail('FORBIDDEN_SCORING_FIELD');fields[k]=copy(op.fields[k]);}
  return {type:'scoring',fields};
 }
 function create(options){
  let disposed=false,scope=JSON.stringify(captureIdentity(options.identity())),epoch=0;
  const pending=new Map(),uncertain=new Map(),inspections=new Map(),activeJobs=new Set();let inspectionSequence=0;
  function invalidate(){epoch++;for(const job of activeJobs)job.controller.abort();activeJobs.clear();pending.clear();inspections.clear();}
  function syncIdentity(){const next=JSON.stringify(captureIdentity(options.identity()));if(next!==scope){scope=next;invalidate();}}
  function active(){syncIdentity();if(disposed)throw fail('SERIES_REPOSITORY_DISPOSED');if(options.enabled?.()!==true)throw fail('SERIES_AUTHORITY_DISABLED');
   const who=captureIdentity(options.identity());if(!who.authenticated||!who.emailVerified||!who.uid)throw fail('SERIES_AUTH_REQUIRED');return who;}
  const actorKey=who=>JSON.stringify([who.uid,who.profileId]);
  function ticket(){const who=active(),generation=epoch,job={who,controller:new AbortController(),current:()=>{syncIdentity();return !disposed&&generation===epoch&&JSON.stringify(captureIdentity(options.identity()))===JSON.stringify(who)&&options.enabled?.()===true;}};activeJobs.add(job);return job;}
  const guard=job=>{if(!job.current())throw fail('SERIES_SESSION_CHANGED');};
  async function request(job,path,method='GET',body,etag){
   guard(job);const credential=await options.authorize({current:job.current,signal:job.controller.signal});guard(job);
   if(!credential||typeof credential.idToken!=='string'||!credential.idToken)throw fail('SERIES_AUTH_REQUIRED');
   if(credential.uid!==job.who.uid)throw fail('SERIES_CREDENTIAL_OWNER_MISMATCH');
   const headers=method==='GET'?{'X-Firebase-ETag':'true'}:{'Content-Type':'application/json','if-match':etag};
   const url=options.url(path,credential.idToken);guard(job);
   let response;try{response=await options.fetch(url,{method,headers,cache:'no-store',...(method==='GET'?{signal:job.controller.signal}:{body:JSON.stringify(body)})});}
   catch(error){if(method==='PUT')throw fail('SERIES_WRITE_UNCERTAIN');guard(job);throw fail('SERIES_READ_FAILED');}
   // A sent PUT is never claimed to have been rolled back by session invalidation.
   if(method==='PUT'&&(!response.ok)&&response.status>=500)throw fail('SERIES_WRITE_UNCERTAIN',{status:response.status});
   if(method==='PUT'&&!job.current())throw fail('SERIES_SESSION_CHANGED',{writeSent:true,acknowledged:response.ok});
   guard(job);
   if(!response.ok)throw fail(response.status===412?'SERIES_CONFLICT':response.status===401||response.status===403?'SERIES_ACCESS_DENIED':'SERIES_REQUEST_FAILED',{status:response.status});
   let value;try{value=await response.json();}catch(error){throw fail(method==='PUT'?'SERIES_WRITE_UNCERTAIN':'SERIES_INVALID_JSON');}guard(job);
   return {value,etag:response.headers.get('ETag')};
  }
  async function record(job,key){const r=await request(job,'tournamentSeries/'+key);if(!r.value)throw fail('SERIES_NOT_FOUND');decodeRecord(r.value,key);return r.value;}
  async function read(key){id(key);const job=ticket();try{const raw=await record(job,key);return {record:copy(raw),series:decodeRecord(raw,key)};}finally{activeJobs.delete(job);}}
  function mutate(key,input){
   id(key);const op=captureOperation(input),who=active(),jobKey=actorKey(who)+':'+key,signature=JSON.stringify(op);
   const old=pending.get(jobKey);if(old){if(old.signature===signature)return old.promise;throw fail('SERIES_BUSY');}
   if(uncertain.has(jobKey))throw fail('SERIES_WRITE_UNCERTAIN_PENDING');
   const job=ticket();job.signature=signature;pending.set(jobKey,job);
   job.promise=Promise.resolve().then(async()=>{
    const raw=await record(job,key);
    if(job.who.role!=='system_admin'&&raw.createdByUid!==job.who.uid&&raw.managerUids?.[job.who.uid]!==true)throw fail('SERIES_ACCESS_DENIED');
    const current=await request(job,'tournamentSeries/'+key+'/content');if(!current.etag)throw fail('SERIES_ETAG_MISSING');
    const content=copy(current.value||{}),next=copy(content);
    if(op.type==='scoring')Object.assign(next,op.fields);
    else{
     const entries=Object.entries(content.tournamentIds||{}).filter(([,v])=>v!==null);if(entries.some(([k,v])=>!/^\d+$/.test(k)||typeof v!=='string'))throw fail('INVALID_TOURNAMENT_REFERENCES');
     const exists=entries.some(([,v])=>v===op.tournamentId);
     if(op.type==='add'&&!exists){
      const t=await request(job,'tournaments/'+op.tournamentId);if(!t.value||t.value.id!==op.tournamentId||t.value.status!=='complete')throw fail('SERIES_TOURNAMENT_NOT_COMPLETE');
      const map=Object.fromEntries(entries);map[entries.length?Math.max(...entries.map(([k])=>Number(k)))+1:0]=op.tournamentId;next.tournamentIds=map;
     }
     if(op.type==='remove'&&exists)next.tournamentIds=Object.fromEntries(entries.filter(([,v])=>v!==op.tournamentId));
    }
    if(equal(content,next))return {outcome:'unchanged',record:copy({...raw,content}),series:decodeRecord({...raw,content},key)};
    next.updatedAt=options.now?.()||new Date().toISOString();
    try{
     const ack=await request(job,'tournamentSeries/'+key+'/content','PUT',next,current.etag);
     if(!equal(ack.value,next))throw fail('SERIES_WRITE_UNCERTAIN');
     const confirmed={...raw,content:ack.value||{}};return {outcome:'saved',record:copy(confirmed),series:decodeRecord(confirmed,key)};
    }catch(error){
     if(error.code==='SERIES_WRITE_UNCERTAIN'){uncertain.set(jobKey,true);if(job.current()){try{error.current=decodeRecord(await record(job,key),key);error.currentStateOnly=true;}catch(readError){error.readError=readError.code;}}throw error;}
     if(error.code==='SERIES_CONFLICT'&&job.current()){try{error.current=decodeRecord(await record(job,key),key);}catch(readError){error.readError=readError.code;}}
     throw error;
    }
   }).finally(()=>{activeJobs.delete(job);if(pending.get(jobKey)===job)pending.delete(jobKey);});
   return job.promise;
  }
  async function inspectUncertain(key){const who=active(),jobKey=actorKey(who)+':'+id(key);const current=await read(key);const inspection=String(++inspectionSequence);inspections.set(jobKey,{inspection,scope});
   return {...current,inspection,uncertain:uncertain.has(jobKey),message:'Current server state only; this is not confirmation of a past operation.'};}
  // Explicit user decision after inspection. Never called automatically, no write/retry.
  function acknowledgeUncertainty(key,inspection){const who=active(),jobKey=actorKey(who)+':'+id(key),seen=inspections.get(jobKey);if(!seen||seen.scope!==scope||seen.inspection!==inspection)throw fail('SERIES_INSPECTION_REQUIRED');uncertain.delete(jobKey);inspections.delete(jobKey);}
  function dispose(){if(disposed)return;disposed=true;invalidate();}
  function snapshot(){syncIdentity();const prefix=actorKey(captureIdentity(options.identity()))+':';return Object.freeze({disposed,pending:pending.size,activeJobs:activeJobs.size,uncertain:[...uncertain.keys()].filter(k=>k.startsWith(prefix)).length,epoch});}
  return Object.freeze({read,mutate,inspectUncertain,acknowledgeUncertainty,syncIdentity,invalidate,dispose,snapshot});
 }
 function createActions({repository,identity,pending,confirmed,message}){
  let generation=0,disposed=false;const jobs=new Map();
  function invalidate(){generation++;repository.invalidate();jobs.clear();}
  function run(key,op){if(disposed)return Promise.reject(fail('SERIES_ACTIONS_DISPOSED'));const captured=generation,scope=JSON.stringify(captureIdentity(identity())),operation=captureOperation(op),signature=JSON.stringify(operation),jobKey=scope+':'+key;
   const old=jobs.get(jobKey);if(old)return old.signature===signature?old.promise:Promise.reject(fail('SERIES_BUSY'));
   const job={signature,promise:null};jobs.set(jobKey,job);
   const current=()=>!disposed&&captured===generation&&scope===JSON.stringify(captureIdentity(identity()));
   if(current()){pending(true);message('UKLÁDÁM…');}
   job.promise=Promise.resolve().then(async()=>{try{const result=await repository.mutate(key,operation);if(current()){
    try{confirmed(result.series);}catch(error){message('Cloudový stav byl potvrzen, ale místní zobrazení nebo cache selhalo. Místní obnova po reloadu není zaručená.');return {...result,localPresentationError:true};}
    message(result.outcome==='saved'?'ZMĚNY BYLY ULOŽENY':'ZOBRAZEN AKTUÁLNÍ ULOŽENÝ STAV');}return result;}
   catch(error){if(current())message(error.code==='SERIES_WRITE_UNCERTAIN'?'Výsledek uložení není jistý. Neopakuj zápis naslepo; ověř aktuální stav. Reload zápis neruší.':error.code==='SERIES_CONFLICT'?'Série se mezitím změnila. Načti aktuální stav a znovu rozhodni.':'Změna nebyla potvrzena: '+error.code);throw error;}
   finally{if(jobs.get(jobKey)===job)jobs.delete(jobKey);if(current())pending(false);}});return job.promise;
  }
  function dispose(){if(disposed)return;disposed=true;invalidate();repository.dispose();}
  return Object.freeze({run,invalidate,dispose});
 }
 return Object.freeze({create,createActions,encodeLegacy,decodeRecord,canonical,fields:FIELDS});
});
