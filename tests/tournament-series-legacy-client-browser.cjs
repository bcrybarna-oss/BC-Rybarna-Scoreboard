'use strict';
// Execute the actual deployed v122 uploader, exclusively against the private local transition Rules.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{execFileSync}=require('child_process'),{chromium}=require('playwright');
const {control,fixture,rules,client,token}=require('./tournament-series-repository-emulator.cjs');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:'+Number(process.env.SERIES_EMULATOR_PORT||19006),ns='demo-pool-series';
const baseline='e29b5ed31c002b7a6b3911b20cec37ae404cba66';
const source=execFileSync('git',['show',baseline+':index.html'],{encoding:'utf8',maxBuffer:12e6,cwd:root});
assert.ok(source.includes('v4.51.122 RC'));
const hook=`window.runLegacySeriesUpload=async token=>{clearRuntimeCloudIdentity();cloudUid='admin';cloudAuthenticated=true;cloudEmailVerified=true;currentUserRole='system_admin';cloudIdToken=token;cloudTokenExpiresAt=Date.now()+3600000;data=defaultData();data.tournamentSeries=[{id:'s',name:'STALE CLIENT',createdByUid:'owner'}];await uploadCloudData();return {error:cloudLastError,status:cloudSyncInProgress};};window.runLegacyFederalWrite=async()=>{const expected=data.federalCup2026,next=JSON.parse(JSON.stringify(expected));next.rosterA[0]='Synthetic';try{await saveFederalConfig(next,expected);return 'unexpected success';}catch(e){return e.message;}};`;
const html=source.replace(/https:\/\/bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app/g,base).replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
(async()=>{
 await control('.settings/rules','PUT',rules);const f=fixture();f.appData={updatedAt:1,data:{tournamentSeries:[{id:'s',name:'LEGACY ARCHIVE'}],other:{keep:42}}};await control('','PUT',f);
 const browser=await chromium.launch({channel:'chrome',headless:true});let puts=0;const errors=[];
 try{const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:900}});
 await context.route('**/*',route=>{const q=route.request(),u=new URL(q.url());if(u.origin!==base)return route.abort();if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});const file=path.resolve(root,'.'+u.pathname);if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});u.searchParams.set('ns',ns);if(q.method()==='PUT'){assert.equal(u.pathname,'/appData.json');puts++;}return route.continue({url:u.toString()});});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/');await page.locator('#cloudLoginModal.show').waitFor();await page.locator('#cloudOfflineBtn').click();
 const result=await page.evaluate(t=>runLegacySeriesUpload(t),token({uid:'admin',emailVerified:true}));assert.equal(puts,1);assert.match(result.error,/CLOUD_WRITE_401/);assert.equal(result.status,false);assert.deepEqual(errors,[]);const federal=await page.evaluate(()=>runLegacyFederalWrite());assert.match(federal,/Uložení konfigurace selhalo/);assert.equal(puts,2);
 const c=client();assert.equal((await c.repo.read('s')).series.name,'Lounská syntetická série');c.repo.dispose();
 console.log('PASS actual v4.51.122 uploader: generic and Federal Cup full appData PUT denied, new authority unchanged, no production access; baseline '+baseline);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
