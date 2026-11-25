'use strict';
// EMULATOR ONLY. No production endpoint, credentials, retries, deletes or Rules deployment.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const contract=require('../assets/js/tournament-series-repository.js');
const stable=x=>contract.canonical(x),hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
const fail=code=>Object.assign(new Error(code),{code});
function journal(filename){
 const file=path.resolve(filename),repo=path.resolve(__dirname,'..');
 if(file===repo||file.toLowerCase().startsWith(repo.toLowerCase()+path.sep))throw fail('AUDIT_MUST_BE_OUTSIDE_REPOSITORY');
 if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw fail('AUDIT_SYMLINK_DENIED');
 let rows=[],expected='';const lock=file+'.lock';if(fs.existsSync(lock))throw fail('AUDIT_LOCKED_MANUAL_CHECK');
 if(fs.existsSync(file)){
  const text=fs.readFileSync(file,'utf8');expected=text;if(text&&!text.endsWith('\n'))throw fail('AUDIT_INCOMPLETE_BLOCKED');
  try{rows=text.trim()?text.trim().split('\n').map(s=>JSON.parse(s)):[];}catch{throw fail('AUDIT_INVALID_BLOCKED');}
  for(let i=0;i<rows.length;i++){const {digest,...body}=rows[i];if(body.seq!==i||body.previous!==(i?rows[i-1].digest:null)||digest!==hash(body))throw fail('AUDIT_INVALID_BLOCKED');}
 }
 return {rows,append(event){let guard;try{guard=fs.openSync(lock,'wx');}catch{throw fail('AUDIT_LOCKED_MANUAL_CHECK');}
  try{if((fs.existsSync(file)?fs.readFileSync(file,'utf8'):'')!==expected)throw fail('AUDIT_CHANGED_BLOCKED');const body={...event,seq:rows.length,previous:rows.at(-1)?.digest||null},row={...body,digest:hash(body)},line=JSON.stringify(row)+'\n',fd=fs.openSync(file,'a');try{fs.writeFileSync(fd,line,'utf8');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}expected+=line;rows.push(row);return row;}
  finally{fs.closeSync(guard);fs.unlinkSync(lock);}
 }};
}
function create({port=19006,auditFile,fetch:transport=globalThis.fetch,now=Date.now,timeoutMs=15000}={}){
 if(!Number.isInteger(port)||port<1024||port>65535||typeof auditFile!=='string')throw fail('EMULATOR_CONFIGURATION_REQUIRED');
 const base='http://127.0.0.1:'+port,ns='demo-pool-series',audit=journal(auditFile);let busy=false;
 const log=(type,fields={})=>audit.append({type,time:new Date(now()).toISOString(),...fields});
 const selector=({sourceIndex,seriesId}={})=>{
  if(!Number.isInteger(sourceIndex)||sourceIndex<0||sourceIndex>100000||typeof seriesId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(seriesId)||['__proto__','constructor','prototype'].includes(seriesId))throw fail('INVALID_SELECTOR');
  return {sourceIndex,seriesId,source:'appData/data/tournamentSeries/'+sourceIndex,target:'tournamentSeries/'+seriesId};
 };
 async function request(route,method='GET',body,etag){
  if(!/^(appData\/data\/tournamentSeries\/\d+|tournamentSeries\/[A-Za-z0-9_-]+)$/.test(route))throw fail('PATH_DENIED');
  log('request',{method,path:route});const controller=new AbortController();let timer;
  try{
   const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(fail(method==='PUT'?'WRITE_UNCERTAIN':'READ_TIMEOUT'));},timeoutMs);});
   const operation=(async()=>{let r;try{r=await transport(base+'/'+route+'.json?ns='+ns,{method,redirect:'error',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer owner',...(method==='GET'?{'X-Firebase-ETag':'true'}:{'Content-Type':'application/json','if-match':etag})},...(method==='PUT'?{body:JSON.stringify(body)}:{})});}catch{throw fail(method==='PUT'?'WRITE_UNCERTAIN':'READ_FAILED');}
    if(!r.ok)throw fail(r.status===412?'ETAG_CONFLICT':method==='PUT'&&r.status>=500?'WRITE_UNCERTAIN':'HTTP_'+r.status);
    let value;try{value=await r.json();}catch{throw fail(method==='PUT'?'WRITE_UNCERTAIN':'INVALID_JSON');}
    const tag=r.headers.get('ETag');if(method==='GET'&&!tag)throw fail('ETAG_MISSING');return {value,etag:tag};})();
   const result=await Promise.race([operation,timeout]);log('response',{method,path:route,sha256:hash(result.value),etag:result.etag});return result;
  }finally{clearTimeout(timer);}
 }
 function quiet(q){
  if(!q||!['clientsLocked','systemAdminsPaused','oldClientsStopped','adminProcessesPaused'].every(k=>q[k]===true)||typeof q.attestedBy!=='string'||!q.attestedBy.trim()||!Array.isArray(q.evidenceRefs)||!q.evidenceRefs.length||q.evidenceRefs.some(x=>typeof x!=='string'||!x)||!Number.isFinite(Date.parse(q.expiresAt))||Date.parse(q.expiresAt)<=now())throw fail('WRITER_QUIET_NOT_ATTESTED');
  // An operator assertion is not technical proof that Admin SDK/IAM writers stopped.
 }
 function proposal(src,s){
  if(!src.value||src.value.id!==s.seriesId)throw fail('SOURCE_ID_MISMATCH');
  const value=contract.encodeLegacy(src.value),roundtrip=contract.decodeRecord(value,s.seriesId);
  if(hash(roundtrip)!==hash(src.value))throw fail('LOSSLESS_ROUNDTRIP_FAILED');
  return {value,sourceHash:hash(src.value),targetHash:hash(value),sourceEtag:src.etag};
 }
 const intentFor=s=>audit.rows.findLast(r=>r.type==='write-intent'&&r.source===s.source&&r.target===s.target);
 async function inspect(s,intent){
  const src=await request(s.source),dst=await request(s.target);
  const sourceSame=src.etag===intent.sourceEtag&&hash(src.value)===intent.sourceHash;
  const state=dst.value===null?'ABSENT_NOT_PROOF_OF_NO_WRITE':hash(dst.value)===intent.targetHash?'CURRENT_MATCHES_NOT_OPERATION_RECEIPT':'CONFLICT_OR_PARTIAL_TARGET';
  log('inspection',{source:s.source,target:s.target,sourceSame,state});return {mode:'verify',state,sourceSame,writes:0,manualDecisionRequired:true};
 }
 async function run(options={}){
  if(busy)throw fail('MIGRATION_BUSY');busy=true;let sent=false;
  try{
   const s=selector(options),mode=options.mode||'dry-run';if(!['dry-run','apply','verify'].includes(mode))throw fail('INVALID_MODE');
   log('start',{mode,source:s.source,target:s.target,emulatorOnly:true});const old=intentFor(s);
   if(mode==='verify'){if(!old)throw fail('NO_PRIOR_INTENT');return await inspect(s,old);}
   if(old){if(mode==='apply')throw fail('PRIOR_ATTEMPT_VERIFY_ONLY');return await inspect(s,old);}
   const src=await request(s.source),p=proposal(src,s),dst=await request(s.target);
   log('prepared',{source:s.source,target:s.target,sourceEtag:p.sourceEtag,sourceHash:p.sourceHash,targetHash:p.targetHash,targetEtag:dst.etag});
   if(dst.value!==null){if(hash(dst.value)!==p.targetHash)throw fail('EXISTING_TARGET_CONFLICT');return {mode,state:'ALREADY_PRESENT_NOT_OPERATION_RECEIPT',writes:0};}
   if(mode==='dry-run')return {mode,state:'EMPTY_TARGET_PLAN_ONLY',writes:0,sourceHash:p.sourceHash,targetHash:p.targetHash};
   if(options.approval!=='EMULATOR CREATE ONLY')throw fail('EXPLICIT_EMULATOR_APPROVAL_REQUIRED');quiet(options.quiescence);
   const fresh=await request(s.source);if(fresh.etag!==p.sourceEtag||hash(fresh.value)!==p.sourceHash)throw fail('SOURCE_CHANGED_BEFORE_WRITE');
   quiet(options.quiescence);
   log('write-intent',{source:s.source,target:s.target,sourceEtag:p.sourceEtag,sourceHash:p.sourceHash,targetHash:p.targetHash,targetEtag:dst.etag,quietEvidence:{attestedBy:options.quiescence.attestedBy,evidenceRefs:options.quiescence.evidenceRefs,expiresAt:options.quiescence.expiresAt}});
   sent=true;const ack=await request(s.target,'PUT',p.value,dst.etag);if(hash(ack.value)!==p.targetHash)throw fail('WRITE_UNCERTAIN');
   log('direct-ack',{target:s.target,targetHash:p.targetHash});
   const after=await request(s.source);if(after.etag!==p.sourceEtag||hash(after.value)!==p.sourceHash)throw fail('SOURCE_CHANGED_AFTER_WRITE');
   const readback=await request(s.target);if(hash(readback.value)!==p.targetHash||hash(contract.decodeRecord(readback.value,s.seriesId))!==p.sourceHash)throw fail('TARGET_READBACK_MISMATCH');
   const final=await request(s.source);if(final.etag!==p.sourceEtag||hash(final.value)!==p.sourceHash)throw fail('SOURCE_CHANGED_AFTER_WRITE');quiet(options.quiescence);
   log('verified',{source:s.source,target:s.target,sourceHash:p.sourceHash,targetHash:p.targetHash,sourceEtag:p.sourceEtag});return {mode,state:'DIRECT_ACK_AND_READBACK_VERIFIED',writes:1};
  }catch(e){const code=e.code||'PROCESS_STOPPED';try{log('stopped',{code,writeMayHaveBeenSent:sent});}catch{}throw fail(code);
  }finally{busy=false;}
 }
 return Object.freeze({run});
}
async function cli(args){
 const v={};for(let i=0;i<args.length;i+=2){if(!['--mode','--source-index','--series-id','--port','--audit','--approval','--quiet-file'].includes(args[i])||!args[i+1]||Object.hasOwn(v,args[i]))throw fail('INVALID_ARGUMENTS');v[args[i]]=args[i+1];}
 const tool=create({port:v['--port']?Number(v['--port']):19006,auditFile:v['--audit']});
 const result=await tool.run({mode:v['--mode']||'dry-run',sourceIndex:Number(v['--source-index']),seriesId:v['--series-id'],approval:v['--approval'],quiescence:v['--quiet-file']?JSON.parse(fs.readFileSync(v['--quiet-file'],'utf8')):undefined});console.log(JSON.stringify(result));return result;
}
if(require.main===module)cli(process.argv.slice(2)).catch(e=>{console.error(e.code||'PROCESS_STOPPED');process.exitCode=1;});
module.exports={create,journal,hash,cli};
