'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const h=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),{taggedReference}=require('./fixtures/federal-tags.cjs');
function api(){return require('./helpers/federal-statistics.cjs').instrumented();}

const copy=x=>JSON.parse(JSON.stringify(x));
test('fixture and report selection does not calculate shot metrics, and full report calculates each selected match once',()=>{
 const c=api(),m=taggedReference('singles','perf-match'),cfg={year:2026,reportHost:'SK'},original=c.federalCalculateMatch;let count=0;c.__observe=(name)=>{if(name==='federalCalculateMatch')count++;};
 const before=JSON.stringify(m),selection=copy(c.federalReportSelection([m],cfg));assert.equal(count,0);assert.equal(selection.selected.length,1);assert.equal(selection.selected[0].matchId,m.id);
 const report=copy(c.federalReportData([m],cfg));assert.equal(count,1);assert.deepEqual(report.selected,selection.selected);assert.deepEqual(report.series,selection.series);assert.equal(JSON.stringify(m),before);
});
test('metadata selection keeps latest fixture, duplicate handling, manual Team, partial results and clinch exclusion',()=>{
 const c=api(),matches=Array.from({length:13},(_,i)=>{const m=taggedReference('singles','match-'+i);m.federalCupLink.fixtureNo=i+1;m.scores=[5,0];m.endedAt='2026-10-25T12:'+String(i).padStart(2,'0')+':00Z';return m;});
 let r=copy(c.federalReportSelection(matches,{year:2026}));assert.equal(r.series[0],11);assert.deepEqual(r.selected.map(x=>x.fixtureNo),Array.from({length:11},(_,i)=>i+1));assert.deepEqual(r.excluded.map(x=>x.fixtureNo),[12,13]);
 const old=copy(matches[0]);old.id='older';old.endedAt='2026-10-24T12:00:00Z';r=copy(c.federalReportSelection([old,...matches],{year:2026}));assert.equal(r.selected[0].matchId,matches[0].id);assert.equal(r.duplicates.length,1);
 r=copy(c.federalReportSelection([],{year:2026,teamResults:{1:{done:true,a:5,b:3}}}));assert.equal(r.selected[0].source,'manual');assert.deepEqual(r.series,[1,0]);
 const bad=copy(matches[0]);bad.scores=[2,2];r=copy(c.federalReportSelection([bad],{year:2026}));assert.deepEqual(r.resultIssues,[1]);assert.equal(r.decided,false);
});
const cloudSource=process.env.PERF_UNIT_BASELINE?fs.readFileSync(path.join(__dirname,'../tmp/performance-before.html'),'utf8'):h;
function cloudContext(quota=true){
 const saved=new Map([['ts','1000']]);let writes=0,backups=0,renders=0;
 const c={data:{matches:[],players:{}},match:null,DB_KEY:'db',CLOUD_LOCAL_TS_KEY:'ts',cloudPollInProgress:false,cloudSyncInProgress:false,cloudApplyingRemote:false,document:{hidden:false},cloudLastError:'',
 localStorage:{getItem:k=>saved.get(k)||null,setItem(k,v){if(k==='db'&&quota)throw Error('QuotaExceededError');saved.set(k,v);writes++;}},
 normalizeDataObject:x=>x,loadDeviceActiveMatch:()=>null,saveDeviceActiveMatch(){},ensureCloudToken:async()=>true,cloudUrl:()=>'',fetch:async()=>({ok:true,json:async()=>({updatedAt:11000,data:{federalCup2026:{year:2026}}})}),saveSafetyBackup(){backups++;},mergeDataObjects:(a,b)=>({...a,...b}),refreshViewsAfterCloudLoad(){renders++;},setCloudStatus(){},console};
 vm.createContext(c);const start=cloudSource.includes('let cloudRuntimeDataTs=0')?cloudSource.indexOf('  // Applied in this tab'):cloudSource.indexOf('  function localCloudTimestamp(');
 const end=cloudSource.indexOf('  let cloudReports',start);vm.runInContext(cloudSource.slice(start,end),c);
 if(cloudSource.includes('window.CloudRefresh.create')){
   c.cloudAuthenticated=true;c.cloudUid='unit-session';c.CLOUD_POLL_MS=2500;c.cloudAutoSync=null;c.ownReportsSync=null;
   c.document.addEventListener=()=>{};c.document.removeEventListener=()=>{};
   c.window={addEventListener(){},removeEventListener(){},CloudRefresh:{create:options=>require('../assets/js/cloud-refresh.js').create({...options,clock:{setInterval:()=>1,clearInterval(){},setTimeout:()=>2,clearTimeout(){}}})}};
   const a=cloudSource.indexOf('  // Session-owned /appData auto-refresh.'),b=cloudSource.indexOf('  // Secure-list refresh',a);vm.runInContext(cloudSource.slice(a,b),c);c.startCloudAutoSync();
 }else{const a=cloudSource.indexOf('  async function pollCloudData('),b=cloudSource.indexOf('  function startCloudAutoSync()',a);vm.runInContext(cloudSource.slice(a,b),c);}
 return {c,saved,counts:()=>({writes,backups,renders})};
}
test('quota: repeated polling applies an already received revision once without persisting an unsafe timestamp',async()=>{
 const {c,saved,counts}=cloudContext(true);await c.pollCloudData();await c.pollCloudData();await c.pollCloudData();assert.equal(counts().renders,1);assert.equal(counts().backups,1);assert.equal(c.localCloudTimestamp(),11000);assert.equal(saved.get('ts'),'1000');assert.equal(saved.has('db'),false);
 const fresh=cloudContext(true);assert.equal(fresh.c.localCloudTimestamp(),1000,'new tab/reload must retry data not cached on disk');
});
test('successful cache and newer cloud revisions still apply, transient network failures remain retryable',async()=>{
 const {c,saved,counts}=cloudContext(false);await c.pollCloudData();assert.equal(saved.get('ts'),'11000');assert.ok(saved.has('db'));
 c.fetch=async()=>({ok:true,json:async()=>({updatedAt:21000,data:{federalCup2026:{year:2026}}})});await c.pollCloudData();assert.equal(c.localCloudTimestamp(),21000);assert.equal(counts().renders,2);
 c.fetch=async()=>{throw Error('offline')};await c.pollCloudData();assert.equal(c.cloudAutoSync?c.cloudAutoSync.snapshot().pending:c.cloudPollInProgress,false);assert.equal(c.localCloudTimestamp(),21000);
});
test('concurrent match refreshes share one read, retry after failure and never apply another session response',async()=>{
 let calls=0,resolve;const c={cloudUid:'A',ensureCloudToken:async()=>true,cloudUrl:()=>'',fetch:()=>{calls++;return new Promise(r=>resolve=r)},data:{matches:[]},applyKnownHistoricalMatchMetadataRepairs:()=>false,currentUserIsSystemAdmin:()=>false,applyEffectiveConfirmationStatus(){},localStorage:{setItem(){}},DB_KEY:'db',setTimeout(){},maybeShowPendingResultConfirmation(){},window:{}};
 vm.createContext(c);const a=h.indexOf('  let secureMatchesLoad='),b=h.indexOf('  async function saveSecureMatch(',a);vm.runInContext(h.slice(a,b),c);
 const reads=[c.loadSecureMatches(),c.loadSecureMatches(),c.loadSecureMatches()];await new Promise(r=>setImmediate(r));assert.equal(calls,1);resolve({ok:true,json:async()=>({m:{id:'m',status:'complete'}})});await Promise.all(reads);assert.equal(c.data.matches[0].id,'m');
 const failed=c.loadSecureMatches();await new Promise(r=>setImmediate(r));resolve({ok:false,status:503});await assert.rejects(failed,/MATCHES_READ_503/);
 const changed=c.loadSecureMatches();await new Promise(r=>setImmediate(r));c.cloudUid='B';resolve({ok:true,json:async()=>({old:{id:'old'}})});await assert.rejects(changed,/MATCHES_IDENTITY_CHANGED/);assert.equal(c.data.matches[0].id,'m');
 const retry=c.loadSecureMatches();await new Promise(r=>setImmediate(r));resolve({ok:true,json:async()=>({fresh:{id:'fresh'}})});await retry;assert.equal(c.data.matches[0].id,'fresh');assert.equal(calls,4);
});
