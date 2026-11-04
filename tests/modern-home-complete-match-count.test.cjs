'use strict';
// Runs the real cloud reader, dashboard snapshot and card renderer with a fake Firebase
// response. Never calls production Auth, Firebase or external URLs.
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

function extract(start,end){
  const i=html.indexOf(start);
  assert.ok(i>=0,'missing '+start);
  const j=html.indexOf(end,i);
  assert.ok(j>i,'missing end '+end);
  return html.slice(i,j);
}
const loader=extract('  let dashboardMatchesLoadedUid=null,dashboardMatchesFailedUid=null;',
  '  async function saveSecureMatch(savedMatch){');
const snapshot=extract('  window.getModernDashboardSnapshot=function(){',
  '  window.refreshModernDashboardCloud=async function(){');
const home=extract('  window.renderModernHome=function(){',
  '  window.refreshModernHomeData=async function(){');
const makeMatches=n=>Object.fromEntries(Array.from({length:n},(_,i)=>[
  'match-'+i,{id:'match-'+i,status:'complete',discipline:'9-ball',scores:[7,5],playerNames:['A','B'],endedAt:'2026-10-01'}
]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function fixture(){
  const requests=[],stats={innerHTML:''},renderCalls=[];
  const ctx={
    console,Date,Number,Math,Array,Object,JSON,String,
    data:{players:{},matches:Object.values(makeMatches(102)),tournaments:[]},
    match:null,
    cloudAuthenticated:true,cloudUid:'user-A',
    currentUserIsSystemAdmin:()=>false,
    calculateEloRatings:()=>({}),
    playerAggregate:()=>({matches:0,wins:0}),
    savedMatchSideDisplayName:m=>m.playerNames?.[0]||'',
    applyKnownHistoricalMatchMetadataRepairs:()=>false,
    applyEffectiveConfirmationStatus:()=>{},
    localStorage:{setItem:()=>{}},
    DB_KEY:'test',
    maybeShowPendingResultConfirmation:()=>{},
    setTimeout:()=>{},
    cloudUrl:p=>'https://fake.invalid/'+p,
    ensureCloudToken:async()=>true,
    fetch:(...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject})),
    document:{getElementById:id=>id==='modernClubStats'?stats:null},
    window:{}
  };
  const context=vm.createContext(ctx);
  vm.runInContext(loader+'\n'+snapshot+'\nfunction snapshot(){return window.getModernDashboardSnapshot();}\n'+home,context);
  const oldRender=context.window.renderModernHome;
  context.window.renderModernHome=()=>{oldRender();renderCalls.push(stats.innerHTML)};
  const snapshotNow=()=>context.window.getModernDashboardSnapshot();
  const render=()=>{context.window.renderModernHome();return stats.innerHTML};
  return {ctx:context,requests,stats,renderCalls,snapshotNow,render};
}

test('cached 102 is hidden until full cloud /matches returns 199, then displayed once',async()=>{
  const f=fixture();
  assert.equal(f.snapshotNow().stats.completedMatches,102,'cached partial source exists');
  assert.equal(f.snapshotNow().stats.completedMatchesReady,false,'not yet fetched');
  const before=f.render();
  assert.match(before,/Načítám…/);
  assert.doesNotMatch(before,/<b>102<\/b>/);
  const p=f.ctx.loadSecureMatches?f.ctx.loadSecureMatches():f.ctx.window.loadSecureMatches();
  await tick();
  assert.equal(f.requests.length,1);
  const mid=f.render();assert.match(mid,/Načítám…/);assert.doesNotMatch(mid,/<b>102<\/b>/);
  f.requests[0].resolve({ok:true,json:async()=>makeMatches(199)});
  await p;
  const after=f.render();
  assert.equal(f.snapshotNow().stats.completedMatches,199);
  assert.equal(f.snapshotNow().stats.completedMatchesReady,true);
  assert.match(after,/<b>199<\/b>/);
  assert.doesNotMatch(after,/Načítám…/);
  assert.ok(f.renderCalls.some(x=>x.includes('<b>199</b>')));
});

test('failed cloud read never converts cached partial count into official total',async()=>{
  const f=fixture(),p=f.ctx.loadSecureMatches();
  await tick();
  f.requests[0].reject(new Error('network unavailable'));
  await assert.rejects(p,/network unavailable/);
  const s=f.snapshotNow();
  assert.equal(s.stats.completedMatches,102);
  assert.equal(s.stats.completedMatchesReady,false);
  assert.equal(s.stats.completedMatchesFailed,true);
  assert.match(f.render(),/Historie dočasně nedostupná/);
  assert.doesNotMatch(f.stats.innerHTML,/<b>102<\/b>/);
  // A later successful retry replaces the error with complete history.
  const retry=f.ctx.loadSecureMatches();await tick();
  assert.equal(f.requests.length,2);
  f.requests[1].resolve({ok:true,json:async()=>makeMatches(199)});
  await retry;
  assert.equal(f.snapshotNow().stats.completedMatchesReady,true);
  assert.match(f.render(),/<b>199<\/b>/);
});

test('old account response cannot enable a count for a different signed-in user',async()=>{
  const f=fixture(),a=f.ctx.loadSecureMatches();
  await tick();
  f.ctx.cloudUid='user-B';
  f.requests[0].resolve({ok:true,json:async()=>makeMatches(199)});
  await assert.rejects(a,/MATCHES_IDENTITY_CHANGED/);
  assert.equal(f.snapshotNow().stats.completedMatchesReady,false);
  assert.equal(f.snapshotNow().stats.completedMatchesFailed,false);
  assert.match(f.render(),/Načítám…/);
  const b=f.ctx.loadSecureMatches();await tick();
  f.requests[1].resolve({ok:true,json:async()=>makeMatches(199)});
  await b;
  assert.equal(f.snapshotNow().stats.completedMatchesReady,true);
  f.ctx.cloudUid='user-C';
  assert.equal(f.snapshotNow().stats.completedMatchesReady,false,'new UID must re-validate cloud history');
});

test('signed-out dashboard never advertises cached local matches as full cloud total',()=>{
  const f=fixture();
  f.ctx.cloudAuthenticated=false;
  const s=f.snapshotNow();
  assert.equal(s.stats.completedMatchesReady,false);
  const content=f.render();
  assert.match(content,/Přihlas se pro počet zápasů/);
  assert.doesNotMatch(content,/<b>102<\/b>/);
});

test('logout clears the matches-ready identity and keeps full count authoritative',()=>{
  assert.match(html,/cloudAuthenticated=false;\s*dashboardMatchesLoadedUid=null;\s*dashboardMatchesFailedUid=null;/);
  assert.match(html,/dashboardMatchesLoadedUid=requestUid;\s*dashboardMatchesFailedUid=null;/);
  assert.match(html,/data\.matches=Object\.values\(raw\)\.filter\(Boolean\);/);
  assert.match(html,/if\(cloudUid!==requestUid\)throw new Error\('MATCHES_IDENTITY_CHANGED'\)/);
});
