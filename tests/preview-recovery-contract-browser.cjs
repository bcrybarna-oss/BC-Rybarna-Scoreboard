'use strict';
// Preview orchestration contract in Chromium. Actual source functions; mocked IO/render boundaries.
// This is deliberately NOT a production runtime or a live Firebase Auth test.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright'),{topFunction}=require('./helpers/source-functions.cjs');
const root=path.resolve(__dirname,'..'),core=fs.readFileSync(path.join(root,'test-modular/assets/js/pool-core.js'),'utf8');
const start=core.indexOf('  function discardForeignLocalActiveMatch(){'),end=core.indexOf('  function liveTimestampMs(',start);
assert.ok(start>=0&&end>start);
const functions=core.slice(start,end)+'\n'+['restoreTestTournamentAfterLogin','cloudLoginFromModal','autoCloudInit'].map(n=>topFunction(core,n)).join('\n');
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true}),results=[];try{
for(const mode of ['manual','automatic'])for(const hasMatch of [true,false]){
 const context=await browser.newContext({serviceWorkers:'block'});await context.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<input id="cloudEmail" value="owner@example.invalid"><input id="cloudPassword" value="synthetic"><div id="cloudLoginModal"></div><div id="cloudLoginMessage"></div><button id="cloudLoginBtn"></button><main id="screen"></main>'}));
 const page=await context.newPage();await page.goto('https://preview-contract.local/');
 const result=await page.evaluate(async({mode,hasMatch,functions})=>{
  window.POOL_TEST_MODE=true;const events=[],saved={id:'synthetic-preview-match',createdByUid:'owner',scores:[4,3],turn:1,useClock:true,clock:{normal:37},status:'playing',endedAt:null,startedAt:'2026-10-20T10:00:00Z'};
  Object.assign(window,{cloudAuthenticated:false,cloudUid:'owner',match:null,data:{currentMatch:null,matches:[],deletedMatchIds:[],tournaments:[]},LOCAL_ACTIVE_MATCH_RECOVERY_KEY:'recovery',selectedTournamentId:null,
   $:id=>document.getElementById(id),loadDeviceActiveMatch:()=>hasMatch?saved:null,loadDeviceActiveMatches:()=>hasMatch?{[saved.id]:saved}:{},removeDeviceActiveMatch:()=>{throw Error('unexpected delete');},saveDeviceActiveMatch:m=>events.push('save:'+m.id),editableMatchOwnedByCurrentUser:m=>cloudAuthenticated&&m.createdByUid===cloudUid,betterResumableState:(a,b)=>structuredClone(a||b),resetClock:()=>events.push('clock'),renderMatch:()=>events.push('match-render'),startLiveHeartbeat:()=>events.push('heartbeat'),toast(){},
   persistedCloudSession:()=>({email:'owner@example.invalid',refresh:'mock-refresh'}),firebaseSignIn:async()=>{cloudAuthenticated=true;events.push('identity');},firebaseRefreshAuth:async()=>{cloudAuthenticated=true;events.push('identity');},ensureVerifiedBeforeApp:async()=>true,ensureUserAccessRecord:async()=>events.push('access'),loadOwnProfileClaim:async()=>events.push('profile'),initialCloudMerge:async()=>events.push('appData'),loadSecurePlayers:async()=>events.push('players'),loadSecureMatches:async()=>{await new Promise(r=>setTimeout(r,30));events.push('matches');},loadSecureTournaments:async()=>{await new Promise(r=>setTimeout(r,30));data.tournaments=[{id:'synthetic-cup',status:'active'}];events.push('tournaments');},promoteLegacyTournamentGuestsToProfiles:async()=>events.push('guests'),
   showScreen:s=>{events.push('screen:'+s);document.getElementById('screen').textContent=s;},updateCurrentTournamentShortcut:()=>events.push('shortcut'),renderTournamentDetail:()=>events.push('tournament-render'),refreshAccountUI(){},renderPlayers(){},setCloudStatus(){},clearRuntimeCloudIdentity(){cloudAuthenticated=false;}});
  localStorage.clear();sessionStorage.clear();(0,eval)(functions);await window[mode==='manual'?'cloudLoginFromModal':'autoCloudInit']();
  return {events,score:match?.scores||null,tournament:selectedTournamentId,screen:document.getElementById('screen').textContent};
 },{mode,hasMatch,functions});
 assert.deepEqual(result.events.slice(0,8),['identity','access','profile','appData','players','matches','tournaments','guests']);assert.equal(result.screen,hasMatch?'match':'tournament-detail');assert.deepEqual(result.score,hasMatch?[4,3]:null);assert.equal(result.tournament,hasMatch?null:'synthetic-cup');assert.equal(result.events.filter(x=>x==='tournament-render').length,hasMatch?0:1);results.push({mode,hasMatch,...result});await context.close();console.log('PASS preview browser contract '+mode+' hasMatch='+hasMatch);
}
const out=path.resolve(process.env.IDENTITY_REVIEW_OUT||'output/stage6-identity-review');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'preview-contract.json'),JSON.stringify({runtime:'Chromium actual extracted preview functions; IO and renderer mocked',realAuthVerified:false,productionWrites:0,results},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
