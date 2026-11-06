'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'..');
const baseline='f68098c7212425907e33699b577c530685093b77';
const oldSource=execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10e6});
const source=fs.readFileSync(path.join(root,'index.html'),'utf8');
const anchor='  cacheLoad();renderHome();renderNotificationCenter();';
const origin='https://match-read-isolated.local';
const hook=`
window.matchReadProbe={
  async login(uid){
    clearRuntimeCloudIdentity();
    cloudRefreshToken='';
    // Keep startup dashboard refreshes and polling out of the controlled race.
    startCloudAutoSync=()=>{};
    window.refreshModernHomeData=()=>Promise.resolve();
    await firebaseSignIn(uid+'@example.invalid','mock-password');
    await firebaseAccountLookup();
    currentUserRole='system_admin';
    data.matches=[];
    data.players={p1:{id:'p1',name:'New A'},p2:{id:'p2',name:'Opponent'}};
    window.renderModernHome();
  },
  start(name){
    const promise=loadSecureMatches();
    this.promises[name]=promise;
    this.results[name]='pending';
    promise.then(()=>{this.results[name]='fulfilled';},e=>{this.results[name]=e.message;});
  },
  promises:{},results:{},screen:showScreen,
  save:saveSecureMatch,
  confirm:()=>secureMatchConfirmationRequest('fresh','A','confirmed'),
  snapshot(){return {matches:data.matches,cache:localStorage.getItem(DB_KEY),home:$('screen-home').innerText};}
};`;

async function exercise(browser,before,mobile){
  const html=before?oldSource:source;
  assert.ok(html.includes(anchor));
  const context=await browser.newContext({serviceWorkers:'block',viewport:mobile?{width:390,height:844}:{width:1280,height:900}});
  const gets=[],repairs=[],errors=[];
  let releaseOld;
  const oldGate=new Promise(resolve=>{releaseOld=resolve;});
  const oldMatch={id:'6a0a8d43-e9c9-404d-adbc-9584e086e587',playerIds:['p1','p2'],playerNames:['Old A','Opponent'],scores:[5,3],winner:0,startedAt:'2026-09-19T18:00:00Z',endedAt:'2026-09-19T19:00:00Z',discipline:'9-ball',target:5};
  const fresh={...oldMatch,id:'fresh',playerNames:['New A','Opponent'],futureField:{retained:[0,null,false]}};
  const json=(route,value)=>route.fulfill({contentType:'application/json',body:JSON.stringify(value)});
  await context.route('**/*',async route=>{
    const request=route.request();
    const u=new URL(request.url());
    if(u.origin===origin){
      if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html.replace(anchor,hook+'\n'+anchor)});
      const file=path.resolve(root,'.'+u.pathname);
      if(file.startsWith(root+path.sep)&&fs.existsSync(file)){
        return route.fulfill({path:file,contentType:file.endsWith('.js')?'application/javascript':undefined});
      }
    }
    if(u.hostname==='identitytoolkit.googleapis.com'){
      const body=request.postDataJSON();
      if(u.pathname.endsWith(':signInWithPassword')){
        const uid=body.email.split('@')[0];
        return json(route,{localId:uid,idToken:'mock-'+uid,refreshToken:'mock-refresh-'+uid,expiresIn:3600});
      }
      const uid=body.idToken.slice(5);
      return json(route,{users:[{localId:uid,email:uid+'@example.invalid',emailVerified:true}]});
    }
    if(u.hostname==='securetoken.googleapis.com'){
      return json(route,{id_token:'mock-A',refresh_token:'mock-refresh-A',expires_in:3600});
    }
    if(/firebaseio|firebasedatabase/.test(u.hostname)){
      if(u.pathname==='/matches.json'&&request.method()==='GET'){
        gets.push(u.searchParams.get('auth'));
        if(gets.length===1){
          await oldGate;
          return json(route,{old:oldMatch});
        }
        return json(route,{fresh});
      }
      if(u.pathname.startsWith('/matches/')&&request.method()==='PUT'){
        repairs.push({path:u.pathname,body:request.postDataJSON()});
      }
      return json(route,null);
    }
    return route.abort();
  });
  try{
    const page=await context.newPage();
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin);
    await page.locator('#cloudLoginModal.show').waitFor();
    const request=page.waitForRequest(req=>new URL(req.url()).pathname==='/matches.json');
    await page.evaluate(async()=>{await matchReadProbe.login('A');matchReadProbe.start('old');});
    await request;
    await page.evaluate(async()=>{await matchReadProbe.login('B');await matchReadProbe.login('A');});
    const initial=await page.evaluate(()=>matchReadProbe.snapshot());
    await page.evaluate(()=>{matchReadProbe.start('fresh');matchReadProbe.start('coalesced');});
    const shared=await page.evaluate(()=>({
      old:matchReadProbe.promises.old===matchReadProbe.promises.fresh,
      current:matchReadProbe.promises.fresh===matchReadProbe.promises.coalesced
    }));
    assert.equal(shared.current,true);
    assert.equal(shared.old,before);
    if(!before){
      await page.waitForFunction(()=>matchReadProbe.results.fresh==='fulfilled');
      const published=await page.evaluate(()=>matchReadProbe.snapshot());
      assert.deepEqual(published.matches[0].futureField,fresh.futureField);
      assert.equal(published.matches[0].id,'fresh');
      releaseOld();
      await page.waitForFunction(()=>matchReadProbe.results.old==='MATCHES_IDENTITY_CHANGED');
      assert.deepEqual(await page.evaluate(()=>matchReadProbe.snapshot()),published);
      assert.deepEqual(gets,['mock-A','mock-A']);
      assert.deepEqual(repairs,[]);
      await page.evaluate(()=>matchReadProbe.screen('history'));
      assert.match(await page.locator('#historyList').innerText(),/New A[^]*5\s*:\s*3/);
      await page.evaluate(()=>matchReadProbe.screen('stats'));
      assert.match(await page.locator('#statsView').innerText(),/New A/);
    }else{
      const repair=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname.startsWith('/matches/'));
      releaseOld();
      await page.waitForFunction(()=>matchReadProbe.results.old==='fulfilled');
      await repair;
      await page.waitForFunction(()=>matchReadProbe.snapshot().cache?.includes('MR_DOUBLES_2026_09_19'));
      const stale=await page.evaluate(()=>matchReadProbe.snapshot());
      assert.notDeepEqual(stale,initial);
      assert.equal(stale.matches[0].id,oldMatch.id);
      assert.equal(stale.matches[0].metadataCompatibilityRepair,'MR_DOUBLES_2026_09_19');
      assert.deepEqual(gets,['mock-A']);
      assert.equal(repairs.length,1);
    }
    const beforeSave=repairs.length;
    await page.evaluate(match=>matchReadProbe.save({...match,status:'complete'}),fresh);
    assert.deepEqual(await page.evaluate(()=>matchReadProbe.confirm()),{ok:true,uid:'A'});
    assert.equal(repairs.length,beforeSave+2);
    assert.equal(repairs[beforeSave].path,'/matches/fresh.json');
    assert.deepEqual(repairs[beforeSave].body.scores,[5,3]);
    assert.deepEqual(repairs[beforeSave].body.futureField,fresh.futureField);
    assert.deepEqual(repairs[beforeSave+1],{path:'/matches/fresh/confirmations/A.json',body:'confirmed'});
    assert.deepEqual(errors,[]);
    console.log((before?'REPRODUCED stale publish/repair':'PASS protected matches/cache/dashboard')+' '+(mobile?'mobile':'desktop'));
  }finally{
    releaseOld();
    await context.close();
  }
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const mobile of [false,true]){
      await exercise(browser,true,mobile);
      await exercise(browser,false,mobile);
    }
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
