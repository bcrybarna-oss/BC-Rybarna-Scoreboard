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
 function safeKey(value){return typeof value==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value);}
 function decodeRecord(s,expectedId){
  if(!safeKey(expectedId)||Object.keys(s?.managerUids||{}).some(k=>!safeKey(k))||Object.values(s?.preserved?.historicalTournaments||{}).some(h=>h&&!safeKey(h.id)))throw fail('UNSAFE_SERIES_IDENTIFIER');
  if(Object.values(s?.content?.tournamentIds||{}).some(v=>v!==null&&!safeKey(v)))throw fail('UNSAFE_SERIES_IDENTIFIER');
  for(const h of Object.values(s?.preserved?.historicalTournaments||{}))for(const row of [...Object.values(h?.results||{}),...Object.values(h?.matches||{})])for(const key of ['playerId','player1Id','player2Id','winnerId','loserId'])if(row?.[key]!=null&&!safeKey(row[key]))throw fail('UNSAFE_SERIES_IDENTIFIER');
  if(!s||s.schemaVersion!==1||s.id!==id(expectedId)||typeof s.createdByUid!=='string'||!s.createdByUid)throw fail('INVALID_SERIES_RECORD');
  const view={...copy(s.preserved||{}),...copy(s.content||{}),id:s.id,createdByUid:s.createdByUid,...(own(s,'managerUids')?{managerUids:copy(s.managerUids)}:{})};
  if(view.tournamentIds)view.tournamentIds=Object.entries(view.tournamentIds).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,v])=>v).filter(v=>v!==null);
  if(view.historicalTournaments)view.historicalTournaments=Object.entries(view.historicalTournaments).sort((a,b)=>Number(a[0])-Number(b[0])).map(([,v])=>v).filter(Boolean);
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
 function pick(source,keys){const out={};for(const k of Object.keys(source||{})){if(!keys.includes(k))throw fail('FORBIDDEN_SERIES_FIELD');out[k]=copy(source[k]);}return out;}
 function captureOperation(op){
  if(op?.type==='create')return {type:'create',fields:pick(op.fields,['name','club','season',...SCORING])};
  if(op?.type==='manager-add'||op?.type==='manager-remove'){if(!safeKey(op.uid))throw fail('UNSAFE_SERIES_IDENTIFIER');return {type:op.type,uid:id(op.uid)};}
  if(op?.type==='history-remove')return {type:op.type,historicalId:id(op.historicalId)};
  if(op?.type==='history-add'){
   const h=pick(op.record,['id','name','date','mode','statsComplete','manualPlacement','results','matches','createdAt','createdByUid']);id(h.id);if(!safeKey(h.id))throw fail('UNSAFE_SERIES_IDENTIFIER');
   h.results=(h.results||[]).map(r=>pick(r,['place','playerId','displayName','sharedPlace']));
   h.matches=(h.matches||[]).map(m=>pick(m,['id','stage','stageLabel','group','player1Id','player2Id','player1Name','player2Name','score1','score2','winnerId','loserId']));
   return {type:op.type,record:h};
  }
  if(!op||!['add','remove','scoring'].includes(op.type))throw fail('INVALID_SERIES_OPERATION');
  if(op.type!=='scoring'){if(!safeKey(op.tournamentId))throw fail('UNSAFE_SERIES_IDENTIFIER');return {type:op.type,tournamentId:id(op.tournamentId)};}
  if(!op.fields||typeof op.fields!=='object'||Array.isArray(op.fields))throw fail('INVALID_SCORING_FIELDS');
  const fields={};for(const k of Object.keys(op.fields)){if(!SCORING.includes(k))throw fail('FORBIDDEN_SCORING_FIELD');fields[k]=copy(op.fields[k]);}
  return {type:'scoring',fields,...(op.expected?{expected:pick(op.expected,SCORING)}:{})};
 }
 function create(options){
  let disposed=false,scope=JSON.stringify(captureIdentity(options.identity())),epoch=0,revision=0,listJob=null;
  const pending=new Map(),uncertain=new Map(),inspections=new Map(),activeJobs=new Set();let inspectionSequence=0;
  function invalidate(){epoch++;revision++;listJob=null;for(const job of activeJobs)job.controller.abort();activeJobs.clear();pending.clear();inspections.clear();}
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
  function readAll(){
   active();if(pending.size) return Promise.reject(fail('SERIES_BUSY'));if(listJob)return listJob.promise;
   const job=ticket(),atRevision=revision;listJob=job;
   job.promise=Promise.resolve().then(async()=>{const r=await request(job,'tournamentSeries');if(atRevision!==revision)throw fail('SERIES_READ_SUPERSEDED');
    const records=r.value||{};return Object.entries(records).map(([key,value])=>decodeRecord(value,key));
   }).finally(()=>{activeJobs.delete(job);if(listJob===job)listJob=null;});return job.promise;
  }
  function mutate(key,input){
   id(key);const op=captureOperation(input);if(op.type==='create'&&!safeKey(key))throw fail('UNSAFE_SERIES_IDENTIFIER');const who=active(),jobKey=actorKey(who)+':'+key,signature=JSON.stringify(op);
   const old=pending.get(jobKey);if(old){if(old.signature===signature)return old.promise;throw fail('SERIES_BUSY');}
   if(uncertain.has(jobKey))throw fail('SERIES_WRITE_UNCERTAIN_PENDING');
   revision++;const job=ticket();job.signature=signature;pending.set(jobKey,job);
   job.promise=Promise.resolve().then(async()=>{
    let raw,child='content',current,next;
    if(op.type==='create'){
     current=await request(job,'tournamentSeries/'+key);if(current.value!==null)throw fail('SERIES_ALREADY_EXISTS');
     if(!op.fields.name||!op.fields.club)throw fail('INVALID_SERIES_DETAILS');
     const stamp=options.now?.()||new Date().toISOString();
     next=encodeLegacy({...op.fields,id:key,createdByUid:job.who.uid,createdAt:stamp,updatedAt:stamp,tournamentIds:[],managerUids:{}});
    }else{
     raw=await record(job,key);
     if(job.who.role!=='system_admin'&&raw.createdByUid!==job.who.uid&&raw.managerUids?.[job.who.uid]!==true)throw fail('SERIES_ACCESS_DENIED');
     child=op.type.startsWith('manager-')?'managerUids':op.type.startsWith('history-')?'preserved/historicalTournaments':'content';
     if(child==='managerUids'&&raw.createdByUid!==job.who.uid&&job.who.role!=='system_admin')throw fail('SERIES_ACCESS_DENIED');
     current=await request(job,'tournamentSeries/'+key+'/'+child);next=copy(current.value||{});
     if(child==='managerUids'){
      if(op.type==='manager-add')Object.defineProperty(next,op.uid,{value:true,enumerable:true,writable:true,configurable:true});else delete next[op.uid];
     }else if(op.type==='history-add'||op.type==='history-remove'){
      const entries=Object.entries(current.value||{}).filter(([,v])=>v!==null);
      if(entries.some(([k])=>!/^\d+$/.test(k)))throw fail('INVALID_HISTORY_POSITIONS');
      next=Object.fromEntries(entries);
      if(op.type==='history-add'){
       if(entries.some(([,v])=>v.id===op.record.id))throw fail('SERIES_HISTORY_ID_EXISTS');
       const value={...op.record,createdByUid:job.who.uid};
       next[entries.length?Math.max(...entries.map(([k])=>Number(k)))+1:0]=value;
      }else next=Object.fromEntries(entries.filter(([,v])=>v.id!==op.historicalId));
     }else if(op.type==='scoring'){
      if(op.expected){const actual={};for(const field of SCORING)if(own(current.value||{},field))actual[field]=copy(current.value[field]);if(!equal(actual,op.expected))throw fail('SERIES_CONFLICT',{current:decodeRecord({...raw,content:current.value},key)});}
      Object.assign(next,op.fields);
     }
     else{
      const entries=Object.entries(next.tournamentIds||{}).filter(([,v])=>v!==null);if(entries.some(([k,v])=>!/^\d+$/.test(k)||typeof v!=='string'))throw fail('INVALID_TOURNAMENT_REFERENCES');
      const exists=entries.some(([,v])=>v===op.tournamentId);
      if(op.type==='add'&&!exists){
       const t=await request(job,'tournaments/'+op.tournamentId);if(!t.value||t.value.id!==op.tournamentId||t.value.status!=='complete')throw fail('SERIES_TOURNAMENT_NOT_COMPLETE');
       const map=Object.fromEntries(entries);map[entries.length?Math.max(...entries.map(([k])=>Number(k)))+1:0]=op.tournamentId;next.tournamentIds=map;
      }
      if(op.type==='remove'&&exists)next.tournamentIds=Object.fromEntries(entries.filter(([,v])=>v!==op.tournamentId));
     }
     if(equal(current.value,next))return {outcome:'unchanged',record:copy(raw),series:decodeRecord(raw,key)};
     if(child==='content')next.updatedAt=options.now?.()||new Date().toISOString();
    }
    if(!current.etag)throw fail('SERIES_ETAG_MISSING');
    try{
     const ack=await request(job,'tournamentSeries/'+key+(op.type==='create'?'':'/'+child),'PUT',next,current.etag);
     if(!equal(ack.value,next))throw fail('SERIES_WRITE_UNCERTAIN');
     const confirmed=op.type==='create'?ack.value:child==='content'?{...raw,content:ack.value||{}}:child==='managerUids'?{...raw,managerUids:ack.value||{}}:{...raw,preserved:{...raw.preserved,historicalTournaments:ack.value||{}}};
     return {outcome:'saved',record:copy(confirmed),series:decodeRecord(confirmed,key)};
    }catch(error){
     if(error.code==='SERIES_WRITE_UNCERTAIN'){uncertain.set(jobKey,true);if(job.current()){try{error.current=decodeRecord(await record(job,key),key);error.currentStateOnly=true;}catch(readError){error.readError=readError.code;}}throw error;}
     if(error.code==='SERIES_CONFLICT'&&job.current()){try{error.current=decodeRecord(await record(job,key),key);}catch(readError){error.readError=readError.code;}}
     throw error;
    }
   }).finally(()=>{activeJobs.delete(job);if(pending.get(jobKey)===job)pending.delete(jobKey);});
   return job.promise;
  }
  function isUncertain(key){syncIdentity();const who=captureIdentity(options.identity());return !disposed&&who.authenticated&&options.enabled?.()===true&&uncertain.has(actorKey(who)+':'+id(key));}
  async function inspectUncertain(key){const who=active(),jobKey=actorKey(who)+':'+id(key),job=ticket();try{
   const result=await request(job,'tournamentSeries/'+key),value=result.value,series=value?decodeRecord(value,key):null;const inspection=String(++inspectionSequence);inspections.set(jobKey,{inspection,scope});
   return {record:value?copy(value):null,series,inspection,uncertain:uncertain.has(jobKey),message:'Current server state only; this is not confirmation of a past operation.'};
  }finally{activeJobs.delete(job);}}
  // Explicit user decision after inspection. Never called automatically, no write/retry.
  function acknowledgeUncertainty(key,inspection){const who=active(),jobKey=actorKey(who)+':'+id(key),seen=inspections.get(jobKey);if(!seen||seen.scope!==scope||seen.inspection!==inspection)throw fail('SERIES_INSPECTION_REQUIRED');uncertain.delete(jobKey);inspections.delete(jobKey);}
  function dispose(){if(disposed)return;disposed=true;invalidate();}
  function snapshot(){syncIdentity();const prefix=actorKey(captureIdentity(options.identity()))+':';return Object.freeze({disposed,pending:pending.size,activeJobs:activeJobs.size,uncertain:[...uncertain.keys()].filter(k=>k.startsWith(prefix)).length,epoch});}
  return Object.freeze({read,readAll,mutate,isUncertain,inspectUncertain,acknowledgeUncertainty,syncIdentity,invalidate,dispose,snapshot});
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
   catch(error){if(current())message(['SERIES_WRITE_UNCERTAIN','SERIES_WRITE_UNCERTAIN_PENDING'].includes(error.code)?'Výsledek uložení není jistý. Neopakuj zápis naslepo; ověř aktuální stav. Reload zápis neruší.':error.code==='SERIES_CONFLICT'?'Série se mezitím změnila. Načti aktuální stav a znovu rozhodni.':'Změna nebyla potvrzena: '+error.code);throw error;}
   finally{if(jobs.get(jobKey)===job)jobs.delete(jobKey);if(current())pending(false);}});return job.promise;
  }
  function dispose(){if(disposed)return;disposed=true;invalidate();repository.dispose();}
  return Object.freeze({run,invalidate,dispose});
 }
 return Object.freeze({create,createActions,encodeLegacy,decodeRecord,canonical,fields:FIELDS});
});
