'use strict';
// Administrative transport only. Import/construction perform no network calls.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const PROJECT='bc-rybarna-scrbrd',DATABASE='https://bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app';
const fail=code=>Object.assign(new Error(code),{code});
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const clone=x=>JSON.parse(JSON.stringify(x));
function cliCredentials({projectId,principal,firebaseToolsDir}){
 let options,api;
 return async({method='GET'}={})=>{
  if(!options){
   if(typeof firebaseToolsDir!=='string'||!path.isAbsolute(firebaseToolsDir))throw fail('FIREBASE_TOOLS_PATH_REQUIRED');
   const dir=path.join(firebaseToolsDir,'lib');
   // Never enable Firebase HTTP debug logging or read configstore/token files ourselves.
   require(path.join(dir,'logger')).logger.debug=()=>{};
   const {Command}=require(path.join(dir,'command')),{requireAuth}=require(path.join(dir,'requireAuth'));
   const candidate={project:projectId,account:principal,nonInteractive:true};
   await new Command('approved-series-migration').prepare(candidate);
   if(candidate.project!==projectId||candidate.projectId!==projectId)throw fail('CLI_PROJECT_MISMATCH');
   await requireAuth(candidate);
   if(candidate.user?.email!==principal)throw fail('CLI_PRINCIPAL_MISMATCH');
   options=candidate;api=require(path.join(dir,'apiv2'));
  }
  if(options.user?.email!==principal)throw fail('CLI_PRINCIPAL_MISMATCH');
  // CLI requirePermissions intentionally tolerates IAM lookup errors; this migrator must not.
  const permissions=await require(path.join(firebaseToolsDir,'lib','gcp','iam')).testIamPermissions(projectId,['firebase.projects.get','firebasedatabase.instances.get',...(method==='PUT'?['firebasedatabase.instances.update']:[])]);
  if(permissions.passed!==true)throw fail('IAM_PERMISSION_CHECK_FAILED');
  return {principal,projectId,accessToken:await api.getAccessToken()}; // RAM only; never included in receipts.
 };
}
function create({projectId,databaseUrl,principal,readApproval,writeApproval,evidenceDir,
 firebaseToolsDir,credentialProvider,fetch:network=globalThis.fetch,now=Date.now,port=19006}={}){
 if(projectId!==PROJECT||databaseUrl!==DATABASE)throw fail('PRODUCTION_TARGET_MISMATCH');
 if(typeof principal!=='string'||!principal.includes('@'))throw fail('OPERATOR_PRINCIPAL_REQUIRED');
 const read=clone(readApproval||{}),write=writeApproval?clone(writeApproval):null;
 const check=a=>{if(!a||a.approved!==true||a.projectId!==PROJECT||a.databaseUrl!==DATABASE||a.principal!==principal||typeof a.approvalId!=='string'||!a.approvalId||!Number.isFinite(Date.parse(a.expiresAt))||Date.parse(a.expiresAt)<=now()||a.administrativeBypassAcknowledged!==true)throw fail('EXPLICIT_CURRENT_APPROVAL_REQUIRED');};
 check(read);
 if(!Number.isInteger(read.sourceIndex)||read.sourceIndex<0||read.sourceIndex>100000||typeof read.seriesId!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(read.seriesId)||['__proto__','constructor','prototype'].includes(read.seriesId))throw fail('INVALID_APPROVED_SELECTOR');
 const source='appData/data/tournamentSeries/'+read.sourceIndex,target='tournamentSeries/'+read.seriesId;
 if(typeof evidenceDir!=='string'||!path.isAbsolute(evidenceDir))throw fail('PRIVATE_EVIDENCE_DIRECTORY_REQUIRED');
 const directory=fs.realpathSync(evidenceDir),repo=fs.realpathSync(path.resolve(__dirname,'..'));
 if(directory.toLowerCase()===repo.toLowerCase()||directory.toLowerCase().startsWith(repo.toLowerCase()+path.sep))throw fail('EVIDENCE_MUST_BE_OUTSIDE_REPOSITORY');
 const credential=credentialProvider||cliCredentials({projectId,principal,firebaseToolsDir});
 const runId=crypto.randomUUID(),receipts=[];let sent=false,approvedPlan=null,sequence=0;
 function record(info,bytes){
  const stem=runId+'-'+String(sequence++).padStart(3,'0');
  if(bytes!==undefined){const file=path.join(directory,stem+'.json'),fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}info={...info,file:path.basename(file),sha256:digest(bytes)};}
  receipts.push({...info,time:new Date(now()).toISOString()});
  // Immutable successive manifests let a second custodian retain any version.
  const filename=path.join(directory,stem+'-manifest.json'),fd=fs.openSync(filename,'wx');
  try{fs.writeFileSync(fd,JSON.stringify({runId,projectId,databaseUrl,principal,readApprovalId:read.approvalId,writeApprovalId:write?.approvalId||null,source,target,receipts},null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 }
 function guardRun(s){check(read);if(s.source!==source||s.target!==target)throw fail('SELECTOR_NOT_APPROVED');}
 function approve(options,s,p,targetEtag){
  guardRun(s);check(write);
  if(options.approval!=='PRODUCTION CREATE ONLY'||write.sourceIndex!==read.sourceIndex||write.seriesId!==read.seriesId||write.sourceHash!==p.sourceHash||write.sourceEtag!==p.sourceEtag||write.targetHash!==p.targetHash||write.targetEtag!==targetEtag||write.sourceRulesVerified!==true||write.writerQuietReviewed!==true||write.independentReviewerApproved!==true||write.metadataInventoryVerified!==true||typeof write.snapshotManifestSHA256!=='string'||!/^[a-f0-9]{64}$/.test(write.snapshotManifestSHA256)||typeof write.reviewerEvidenceRef!=='string'||!write.reviewerEvidenceRef)throw fail('WRITE_PLAN_NOT_APPROVED');
  approvedPlan={...p,targetEtag,quietExpiresAt:options.quiescence?.expiresAt};
 }
 async function transport(virtual,options){
  check(read);const u=new URL(virtual),route=u.pathname.slice(1,-5),method=options.method;
  if(u.origin!=='http://127.0.0.1:'+port||u.pathname!==('/'+route+'.json')||u.search!=='?ns=demo-pool-series'||![source,target].includes(route)||!['GET','PUT'].includes(method))throw fail('TRANSPORT_PATH_DENIED');
  if(method==='PUT'){
   check(write);
   if(route!==target||!approvedPlan||sent||options.headers?.['if-match']!==approvedPlan.targetEtag||require('./series-trusted-migration.cjs').hash(JSON.parse(options.body))!==approvedPlan.targetHash)throw fail('TRANSPORT_WRITE_DENIED');
  }
  const auth=await credential({method});check(read);if(method==='PUT')check(write);
  if(method==='PUT'&&(!Number.isFinite(Date.parse(approvedPlan.quietExpiresAt))||Date.parse(approvedPlan.quietExpiresAt)<=now()))throw fail('WRITER_QUIET_EXPIRED');
  if(auth?.principal!==principal||auth?.projectId!==PROJECT||typeof auth.accessToken!=='string'||!auth.accessToken)throw fail('AUTHORIZATION_IDENTITY_MISMATCH');
  if(options.signal?.aborted)throw fail('REQUEST_ABORTED_BEFORE_SEND');
  record({stage:'request-intent',method,path:route,conditionalEtag:method==='PUT'?approvedPlan.targetEtag:null});
  if(method==='PUT')sent=true;
  let response;
  try{response=await network(DATABASE+'/'+route+'.json',{method,redirect:'error',cache:'no-store',signal:options.signal,headers:{Authorization:'Bearer '+auth.accessToken,...(method==='GET'?{'X-Firebase-ETag':'true'}:{'Content-Type':'application/json','if-match':approvedPlan.targetEtag})},...(method==='PUT'?{body:options.body}:{})});}
  catch{record({stage:'transport-failed',method,path:route});throw fail(method==='PUT'?'WRITE_UNCERTAIN':'READ_FAILED');}
  if(response.ok){const bytes=await response.clone().text();record({stage:'response',method,path:route,status:response.status,etag:response.headers.get('etag')},bytes);}
  else record({stage:'response',method,path:route,status:response.status});
  return response;
 }
 return Object.freeze({fetch:transport,guardRun,approve});
}
module.exports={create,cliCredentials,PROJECT,DATABASE};
