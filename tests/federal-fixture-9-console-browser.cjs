'use strict';
// Runs the EXACT manual console file, installed in the CURRENT app's real
// paused closure through Chrome's debug()/undebug() command-line utilities.
// Every browser request is intercepted. No real Firebase/Auth traffic allowed.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {store,wire,roundTrip,canonical}=require('./helpers/firebase-json.cjs');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),copy=x=>JSON.parse(JSON.stringify(x));
const sha=x=>crypto.createHash('sha256').update(canonical(x)).digest('hex'),fileSha=x=>crypto.createHash('sha256').update(x).digest('hex');
const snippet=read('scripts/federal-fixture-9-console.js'),proposal=JSON.parse(read('docs/federal-fixture-9-link-proposal.json'));
const approved=JSON.parse(snippet.slice(snippet.indexOf('const approved=')+'const approved='.length,snippet.indexOf('\n};',snippet.indexOf('const approved='))+2));
const source=process.env.FC_FIXTURE9_BACKUP;
assert.ok(source,'Set FC_FIXTURE9_BACKUP to the approved PRIVATE 24 October backup; never commit it.');
const inputBytes=fs.readFileSync(source),input=JSON.parse(inputBytes);
assert.equal(fileSha(inputBytes),'0aa18c9b610709025150ef55fd6fd177f1972612d72703635cbdd74e8b52f7eb');
const id=proposal.matchId,original=input.matches.find(m=>m.id===id),link=proposal.patch.federalCupLink;
assert.deepEqual(approved.link,link);assert.equal(approved.matchId,id);
assert.equal(fileSha(JSON.stringify(original)),proposal.beforeMatchSha256);
assert.equal(fileSha(JSON.stringify({...original,...proposal.patch})),proposal.afterMatchSha256);
assert.equal(sha(original),approved.beforeCanonicalSha256);assert.equal(sha({...original,federalCupLink:link}),approved.afterCanonicalSha256);
assert.deepEqual(roundTrip(original),original);assert.equal(sha(roundTrip({...original,federalCupLink:link})),approved.afterCanonicalSha256);
assert.deepEqual(roundTrip({balls:[],pottedCount:0,absent:null,empty:{}}),{pottedCount:0});
assert.deepEqual(roundTrip({0:'a',2:'b'}),['a',null,'b']);assert.deepEqual(roundTrip({0:'a',9:'b'}),{0:'a',9:'b'});
if(process.env.FC9_HASH_ONLY){
 console.log(JSON.stringify({matchId:id,beforeCanonicalSha256:sha(original),afterCanonicalSha256:sha(roundTrip({...original,federalCupLink:link})),proposalOriginalObjectSha256:proposal.beforeMatchSha256,proposalAfterObjectSha256:proposal.afterMatchSha256,linkCanonicalSha256:sha(link),approvedLinkExactlyEqual:true,helperSha256:fileSha(snippet),sourceBackupSha256:fileSha(inputBytes),realProductionRequests:0},null,2));process.exit(0);
}
const origin='https://bcrybarna-oss.github.io',appUrl=origin+'/BC-Rybarna-Scoreboard/',dbHost='bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app';
const out=path.resolve(process.env.FC9_CONSOLE_ARTIFACTS||path.join(root,'output/fixture-9-console-tests'));fs.mkdirSync(out,{recursive:true});
const results=[],baseline={matches:Object.fromEntries(input.matches.filter(m=>m.id===id||m.federalCupLink).map(m=>[m.id,m])),appData:{data:{federalCup2026:input.federalCup2026,deletedMatchIds:input.deletedMatchIds||{}}}};
// Stop background intervals in the TEST page only. The functions under test and
// public debugger entry point remain those from index.html, without replacements.
const hook=`window.fc9Harness={ready(){stopTimer();stopLiveHeartbeat();clearTimeout(activeMatchCloudSaveTimer);window.poolPresenceContext=async()=>null;match=null;cloudAuthenticated=true;cloudUid='isolated-admin';cloudEmailVerified=true;currentUserRole='system_admin';cloudIdToken='fc9-isolated-token';cloudTokenExpiresAt=Date.now()+3600000;document.querySelectorAll('.modal.show').forEach(x=>x.classList.remove('show'));},revoke(){currentUserRole='player';}};`;
const html=read('index.html').replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.ok(html.includes(hook));
let browser;
async function client(label){
 const state={db:store(copy(baseline)),requests:[],puts:[],applied:0,unexpected:[],fail412:false,loseResponse:false,competeBeforePut:false,missingETag:false,denyWrites:false};
 const get=parts=>parts.reduce((o,p)=>o?.[p],state.db)??null;
 function set(parts,value){let p=state.db;for(const part of parts.slice(0,-1))p=p[part]??={};const last=parts.at(-1),v=store(value);if(v===null)delete p[last];else p[last]=v;}
 state.get=key=>copy(wire(get(key.split('/'))));state.change=(key,fn)=>{const x=state.get(key);fn(x);set(key.split('/'),x);};
 const ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
 await ctx.addInitScript(()=>{window.setInterval=()=>0;});
 const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'content-type,if-match,x-firebase-etag','Access-Control-Allow-Methods':'GET,PUT,OPTIONS','Access-Control-Expose-Headers':'ETag'};
 await ctx.route('**/*',async route=>{if(require('./helpers/federal-statistics.cjs').serve(route))return;
  const q=route.request(),u=new URL(q.url());
  if(q.url()===appUrl)return route.fulfill({contentType:'text/html',body:html});
  if(u.hostname===dbHost){
   const key=decodeURIComponent(u.pathname.replace(/^\//,'').replace(/\.json$/,'')),parts=key.split('/'),method=q.method(),headers=q.headers();
   if(method==='OPTIONS')return route.fulfill({status:204,headers:cors});
   state.requests.push({key,method,etag:headers['if-match']||null});
   if(!['matches','appData/data/federalCup2026','appData/data/deletedMatchIds','matches/'+id].includes(key)){
    if(method!=='GET')state.unexpected.push({key,method});return route.fulfill({status:200,headers:cors,contentType:'application/json',body:'null'});
   }
   if(method==='PUT'){
    assert.equal(key,'matches/'+id);state.puts.push({key,body:q.postDataJSON(),etag:headers['if-match']});
    if(state.denyWrites)return route.fulfill({status:403,headers:cors,contentType:'application/json',body:'{"error":"Permission denied"}'});
    if(state.competeBeforePut){state.change(key,x=>{x.updatedAt='2026-10-24T19:00:00.000Z'});state.competeBeforePut=false;}
    if(state.fail412||headers['if-match']!=='"'+sha(wire(get(parts)))+'"')return route.fulfill({status:412,headers:cors,contentType:'application/json',body:JSON.stringify(wire(get(parts)))});
    assert.ok(headers['if-match'],'unconditional PUT forbidden');set(parts,q.postDataJSON());state.applied++;
    if(state.loseResponse){state.loseResponse=false;return route.abort('failed');}
   }else assert.equal(method,'GET','no extra write methods');
   const value=wire(get(parts)),etag='"'+sha(value)+'"';
   return route.fulfill({status:200,headers:{...cors,...(headers['x-firebase-etag']==='true'&&!state.missingETag?{ETag:etag}:{})},contentType:'application/json',body:JSON.stringify(value)});
  }
  // Assets or third party scripts cannot reach a network. They are unnecessary
  // for the helper; original app's calculation and debugger scope remain real.
  if(!['GET','HEAD'].includes(q.method()))state.unexpected.push({host:u.hostname,method:q.method()});
  return route.abort();
 });
 const page=await ctx.newPage(),logs=[],errors=[];page.on('console',m=>{if(m.type()==='log')logs.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(appUrl);await page.waitForFunction(()=>!!window.fc9Harness);await page.waitForSelector('#cloudLoginModal.show');await page.evaluate(()=>fc9Harness.ready());
 const cdp=await ctx.newCDPSession(page);await cdp.send('Runtime.enable');await cdp.send('Debugger.enable');
 const outside=await cdp.send('Runtime.evaluate',{expression:snippet,returnByValue:true});
 assert.match(outside.exceptionDetails?.exception?.description||'',/konzole není v aplikačním scope/);
 assert.equal(await page.evaluate(()=>Object.hasOwn(window,'fc9Repair')),false);
 await cdp.send('Runtime.evaluate',{expression:'debug(window.getModernDashboardSnapshot)',includeCommandLineAPI:true});
 const paused=new Promise(resolve=>cdp.once('Debugger.paused',resolve));
 const invocation=cdp.send('Runtime.evaluate',{expression:'void window.getModernDashboardSnapshot()',includeCommandLineAPI:true});
 const pause=await paused;assert.ok(pause.callFrames[0].scopeChain.some(s=>s.type==='closure'));
 const frame=pause.callFrames[0].callFrameId;
 const scope=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:frame,expression:'[typeof ensureCloudToken,typeof cloudUrl,typeof currentUserIsSystemAdmin,typeof federalReportData]',returnByValue:true});
 assert.deepEqual(scope.result.value,['function','function','function','function']);
 const countBefore=state.requests.length;
 const installed=await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:frame,expression:snippet,includeCommandLineAPI:true,returnByValue:true});
 assert.equal(installed.exceptionDetails,undefined,'actual snippet must install in selected real closure');
 await cdp.send('Debugger.evaluateOnCallFrame',{callFrameId:frame,expression:'undebug(window.getModernDashboardSnapshot)',includeCommandLineAPI:true});
 await cdp.send('Debugger.resume');await invocation;await cdp.send('Debugger.disable');
 assert.equal(state.requests.length,countBefore,'installation must not make requests');assert.equal(state.puts.length,0);
 const invoke=(method,args)=>page.evaluate(async({method,args})=>{try{return {ok:true,value:await window.fc9Repair[method](args)}}catch(e){return {ok:false,error:e.message}}},{method,args});
 async function prepare(method='prepare'){
  const downloaded=page.waitForEvent('download');downloaded.catch(()=>{});const value=await invoke(method);assert.equal(value.ok,true,value.error);
  const dl=await downloaded,file=await dl.path();assert.ok(file);const bytes=fs.readFileSync(file),json=JSON.parse(bytes);
  assert.equal(json.matchId,id);assert.equal(bytes.includes(Buffer.from('fc9-isolated-token')),false);
  fs.writeFileSync(path.join(out,label+'-'+method+'.private.json'),bytes);
  return {value:value.value,json};
 }
 const opts={backupSaved:true,exclusiveMaintenance:true};
 return {state,page,invoke,prepare,opts,logs,errors,async close(){assert.deepEqual(state.unexpected,[],'no writes outside the target in the mock or externally');assert.deepEqual(errors,[]);assert.ok(logs.every(x=>!x.includes('fc9-isolated-token')));await ctx.close();}};
}
async function run(label,fn){const c=await client(label);try{await fn(c);results.push({name:label,status:'PASS',putsAttempted:c.state.puts.length,putsApplied:c.state.applied});console.log('PASS',label);}finally{await c.close();}}
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  await run('prepare-backup-zero-writes',async c=>{
   const p=await c.prepare();assert.equal(c.state.puts.length,0);assert.deepEqual(p.json.match,original);assert.deepEqual(p.json.approvedLink,link);
   assert.equal(p.json.matchETag,'"'+sha(original)+'"');assert.equal(p.json.beforeCanonicalSha256,approved.beforeCanonicalSha256);
   assert.equal(p.json.afterCanonicalSha256,approved.afterCanonicalSha256);assert.deepEqual(p.value.change,{operation:'add',path:'/federalCupLink',before:'pole chybí',after:link});
   assert.ok(c.state.requests.every(r=>r.method==='GET'));assert.deepEqual(c.state.get('matches/'+id),original);
  });
  await run('commit-link-only-and-rollback',async c=>{
   await c.prepare();const r=await c.invoke('commit',c.opts);assert.equal(r.ok,true,r.error);assert.deepEqual(r.value.teamScore,[7,2]);assert.equal(r.value.allOtherFieldsUnchanged,true);
   assert.deepEqual(c.state.get('matches/'+id),roundTrip({...original,federalCupLink:link}));assert.equal(c.state.puts.length,1);
   assert.equal(c.state.puts[0].etag,'"'+sha(original)+'"');const p=await c.prepare('prepareRollback');assert.deepEqual(p.json.match,c.state.get('matches/'+id));
   const undo=await c.invoke('rollback',c.opts);assert.equal(undo.ok,true,undo.error);assert.deepEqual(c.state.get('matches/'+id),original);assert.deepEqual(undo.value.teamScore,[6,2]);
   assert.equal(c.state.puts.length,2);assert.equal(c.state.puts[1].etag,'"'+approved.afterCanonicalSha256+'"');
  });
  const mutations={match:s=>s.change('matches/'+id,m=>{m.stats[0].fouls++;}),nomination:s=>s.change('appData/data/federalCup2026',c=>{c.lineups[9].a.reverse();}),duplicate:s=>s.change('matches',m=>{m.other={id:'other',status:'playing',federalCupLink:{year:2026,fixtureNo:9,type:'doubles'}};})};
  for(const [kind,change]of Object.entries(mutations)){
   await run('prepare-stops-'+kind,async c=>{change(c.state);const r=await c.invoke('prepare');assert.equal(r.ok,false);assert.equal(c.state.puts.length,0);});
   await run('commit-stops-'+kind,async c=>{await c.prepare();change(c.state);const r=await c.invoke('commit',c.opts);assert.equal(r.ok,false);assert.equal(c.state.puts.length,0);});
  }
  await run('etag-412-no-retry',async c=>{await c.prepare();c.state.competeBeforePut=true;const r=await c.invoke('commit',c.opts);assert.equal(r.ok,false);assert.match(r.error,/412/);assert.equal(c.state.applied,0);
   const again=await c.invoke('commit',c.opts);assert.equal(again.ok,false);assert.equal(c.state.puts.length,1);assert.equal(c.state.get('matches/'+id).federalCupLink,undefined);});
  await run('success-response-lost-verify-detects-applied',async c=>{await c.prepare();c.state.loseResponse=true;const r=await c.invoke('commit',c.opts);assert.equal(r.ok,false);assert.match(r.error,/neznámý/);assert.equal(c.state.applied,1);
   const v=await c.invoke('verify');assert.equal(v.ok,true,v.error);assert.equal(v.value.onlyFederalCupLinkChanged,true);assert.deepEqual(v.value.teamScore,[7,2]);
   assert.equal((await c.invoke('commit',c.opts)).ok,false);assert.equal(c.state.puts.length,1);});
  await run('verify-detects-original-without-put',async c=>{const r=await c.invoke('verify');assert.equal(r.ok,true,r.error);assert.equal(r.value.onlyFederalCupLinkChanged,false);assert.deepEqual(r.value.teamScore,[6,2]);assert.equal(c.state.puts.length,0);});
  await run('rollback-stops-later-change-before-prepare',async c=>{await c.prepare();assert.equal((await c.invoke('commit',c.opts)).ok,true);c.state.change('matches/'+id,m=>{m.stats[0].fouls++;});const changed=c.state.get('matches/'+id);
   assert.equal((await c.invoke('prepareRollback')).ok,false);assert.equal((await c.invoke('rollback',c.opts)).ok,false);assert.equal(c.state.puts.length,1);assert.deepEqual(c.state.get('matches/'+id),changed);});
  await run('rollback-stops-later-change-after-prepare',async c=>{await c.prepare();assert.equal((await c.invoke('commit',c.opts)).ok,true);await c.prepare('prepareRollback');c.state.change('matches/'+id,m=>{m.stats[0].fouls++;});const changed=c.state.get('matches/'+id);
   assert.equal((await c.invoke('rollback',c.opts)).ok,false);assert.equal(c.state.puts.length,1);assert.deepEqual(c.state.get('matches/'+id),changed);});
  await run('missing-etag-and-revoked-role-stop',async c=>{c.state.missingETag=true;assert.equal((await c.invoke('prepare')).ok,false);c.state.missingETag=false;await c.prepare();await c.page.evaluate(()=>fc9Harness.revoke());assert.equal((await c.invoke('commit',c.opts)).ok,false);assert.equal(c.state.puts.length,0);});
  await run('server-permission-denied-no-bypass-or-retry',async c=>{await c.prepare();c.state.denyWrites=true;const r=await c.invoke('commit',c.opts);assert.equal(r.ok,false);assert.match(r.error,/403/);assert.equal(c.state.applied,0);assert.equal((await c.invoke('commit',c.opts)).ok,false);assert.equal(c.state.puts.length,1);assert.deepEqual(c.state.get('matches/'+id),original);});
  assert.equal(fileSha(fs.readFileSync(source)),fileSha(inputBytes));
  const evidence={helperSha256:fileSha(snippet),appSha256:fileSha(read('index.html')),sourceBackupSha256:fileSha(inputBytes),approvedProposalSha256:fileSha(read('docs/federal-fixture-9-link-proposal.json')),proposalOriginalObjectSha256:proposal.beforeMatchSha256,proposalAfterObjectSha256:proposal.afterMatchSha256,beforeCanonicalSha256:sha(original),afterCanonicalSha256:sha(roundTrip({...original,federalCupLink:link})),linkCanonicalSha256:sha(link),approvedLinkExactlyEqual:true,realisticFirebaseSerialization:true,debuggerInstallation:'Chrome debug()/paused call frame/exact snippet/undebug()/resume; original application closures',realProductionRequests:0,realProductionWrites:0,results};
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(evidence,null,2));console.log('PASS',results.length,'scenarios; 0 real production requests/writes');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
