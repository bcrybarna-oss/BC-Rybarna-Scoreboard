'use strict';
// Actual production HTML and UI; all network traffic, including every PUT, stays in RAM.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.MULTI_OUT||'output/hybrid-sko-multigroup');
fs.mkdirSync(out,{recursive:true});
const ref=process.env.MULTI_SOURCE_REF;
const source=ref?execFileSync('git',['show',ref+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10e6}):fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`window.multiProbe={
 auth(){clearRuntimeCloudIdentity();cloudUid='isolated-owner';cloudAuthenticated=true;cloudEmailVerified=true;
 cloudIdToken='mock';cloudTokenExpiresAt=Date.now()+3600000;currentUserRole='system_admin';
 document.querySelectorAll('.modal.show').forEach(e=>e.classList.remove('show'));},
 setup(players){this.auth();data=defaultData();data.players=players;showScreen('tournament');},
 async restore(players){this.auth();data=defaultData();data.players=players;await loadSecureTournaments();await openTournamentDetail(data.tournaments[0].id);},
 snapshot(){const t=data.tournaments[0];return {t,rows:t.groups.map(g=>groupStandings(g,t)),seeds:groupPlayoffSeeds(t),
 placements:tournamentPlacementRecords(t),stats:buildTournamentStats(),matches:data.matches};}
};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,a,b,c)=>a+b+hook+c);
assert.notEqual(html,source);
function firebase(x){
 if(x==null||typeof x!=='object')return x??null;
 const entries=Object.entries(x).map(([k,v])=>[k,firebase(v)]).filter(([,v])=>v!==null);
 return entries.length?Object.assign(Array.isArray(x)?[]:{},Object.fromEntries(entries)):null;
}
const patterns={4:[1,4,3,2],8:[1,8,4,5,3,6,2,7],16:[1,16,8,9,4,13,5,12,3,14,6,11,2,15,7,10]};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true}),report={ref:ref||null,scenarios:[]};
 try{
  for(const width of (process.env.BYE_WIDTHS||'1440,390,320').split(',').map(Number)){
   const cases=process.env.MULTI_CASES?process.env.MULTI_CASES.split(',').map(s=>s.split('x').map(Number)):[[2,2],[2,3],[3,2],[3,4],[4,2]];
   for(const [groups,advance] of cases){
    const db={},writes=[],errors=[],ids=Array.from({length:groups},(_,i)=>Array.from({length:advance},(_,j)=>String.fromCharCode(65+i)+(j+1))).flat();
    const players=Object.fromEntries(ids.map(id=>[id,{id,name:id,firstName:id,lastName:'',active:true}]));
    const ranked=Array.from({length:advance},(_,j)=>Array.from({length:groups},(_,i)=>String.fromCharCode(65+i)+(j+1))).flat();
    const pattern=patterns[2**Math.ceil(Math.log2(ids.length))],standard=pattern.filter(r=>r<=ids.length).map(r=>ranked[r-1]);
    const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===1440?1000:844}});
    await context.route('**/*',route=>{
     const q=route.request(),u=new URL(q.url());
     if(u.origin==='https://multi.local'){
      if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
      const file=path.resolve(root,'.'+u.pathname);
      if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file,contentType:file.endsWith('.js')?'application/javascript':undefined});
     }
     if(/firebaseio|firebasedatabase/.test(u.hostname)){
      const m=u.pathname.match(/^\/tournaments(?:\/([^/]+))?\.json$/);
      if(q.method()!=='GET')writes.push({method:q.method(),path:u.pathname});
      if(m){
       if(q.method()==='PUT'){assert.ok(m[1]);db[m[1]]=firebase(q.postDataJSON());return route.fulfill({json:db[m[1]]});}
       if(q.method()==='GET')return route.fulfill({json:m[1]?db[m[1]]??null:db});
      }
      // The existing global presence module removes its own admin device heartbeat.
      // Record it separately; this is not a tournament/repository mutation.
      if(q.method()==='DELETE' && /^\/presence\/isolated-owner\/[^/]+\.json$/.test(u.pathname))return route.fulfill({json:null});
      assert.equal(q.method(),'GET','unexpected mock write '+u.pathname);
      return route.fulfill({json:u.pathname==='/players.json'?players:null});
     }
     return route.abort();
    });
    const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
    const snap=()=>p.evaluate(()=>multiProbe.snapshot());
    await p.goto('https://multi.local');await p.locator('#cloudLoginModal.show').waitFor();await p.evaluate(x=>multiProbe.setup(x),players);
    await p.locator('#tournamentHubCreateBtn').click();await p.locator('#tournamentName').fill('Skupiny '+groups+' × '+advance);
    await p.locator('#tournamentFormat').selectOption('groups_sko');await p.locator('#tournamentSeedingMode').selectOption('manual');
    await p.locator('#tournamentGroupCount').fill(String(groups));await p.locator('#tournamentAdvanceCount').fill(String(advance));
    await p.locator('#tournamentDiscipline').selectOption('9-ball');await p.locator('#tournamentRace').fill('5');await p.locator('#tournamentPlayoffRace').fill('5');
    for(const id of ids){await p.locator('#tournamentPlayerChooseBtn').click();await p.getByRole('option',{name:id,exact:true}).click();}
    await p.locator('#tournamentMarkAllPaidBtn').click();await p.locator('#tournamentCloseCheckinBtn').click();await p.locator('#createTournamentBtn').click();
    await p.locator('#screen-tournament-detail.active').waitFor();const id=(await snap()).t.id;
    async function score(m,reverseWinner=false){
     await p.locator(`#tournamentDetailBody button[onclick="openHistoricalTournamentScore('${id}','${m.id}')"]`).click();
     const first=reverseWinner?m.player1Id>m.player2Id:m.player1Id<m.player2Id;
     await p.locator('#historicalTournamentScore1').fill(first?'5':'1');await p.locator('#historicalTournamentScore2').fill(first?'1':'5');
     await p.locator('#historicalTournamentScoreSaveBtn').click();await p.locator('#historicalTournamentScoreModal').waitFor({state:'hidden'});
     if(await p.locator('#tournamentResultModal.show').count())await p.locator('#tournamentResultOk').click();
    }
    for(const m of (await snap()).t.groups.flatMap(g=>g.matches))await score(m);
    assert.deepEqual((await snap()).rows.flatMap(g=>g.map(r=>r.id)),ids);
    // Both manual editors must preserve the explicitly selected standard order,
    // even when it includes the C1–C2 regression pair. No hidden automatic correction.
    const inline=p.locator('.inline-manual-playoff-slot');assert.equal(await inline.count(),ids.length);
    for(let i=0;i<standard.length;i++)await inline.nth(i).selectOption(standard[i]);
    await p.locator('.inline-manual-playoff-apply').click();await p.waitForFunction(()=>!!multiProbe.snapshot().t.playoffStarted);
    const manualInline=(await snap()).t.ko.seedSlots;assert.deepEqual(manualInline,pattern.map(r=>ranked[r-1]||null));
    async function openDialog(){
     await p.getByRole('button',{name:'UPRAVIT TURNAJ',exact:true}).click();
     await p.getByRole('button',{name:'RUČNĚ PŘENASADIT PLAY-OFF',exact:true}).click();await p.locator('#groupPlayoffSeedModal.show').waitFor();
    }
    await openDialog();const fields=p.locator('.manual-playoff-slot');assert.equal(await fields.count(),ids.length);
    for(let i=0;i<standard.length;i++)await fields.nth(i).selectOption(standard[i]);
    await p.locator('#groupPlayoffSeedApplyBtn').click();await p.locator('#groupPlayoffSeedModal').waitFor({state:'hidden'});
    assert.deepEqual((await snap()).t.ko.seedSlots,manualInline);
    await openDialog();await p.locator('#groupPlayoffSeedMode').selectOption('rules');await p.locator('#groupPlayoffTieRule').selectOption('points');await p.locator('#groupPlayoffPenaltyTieBreak').uncheck();
    await p.locator('#groupPlayoffSeedApplyBtn').click();await p.locator('#groupPlayoffSeedModal').waitFor({state:'hidden'});
    const seeded=(await snap()).t,first=seeded.ko.rounds[0],byes=first.byes||[];
    const result={groups,advance,width,manualInline,seeded,byes,writes,errors};
    fs.writeFileSync(path.join(out,'latest.json'),JSON.stringify(result,null,2));
    assert.ok(first.matches.every(m=>m.player1Id[0]!==m.player2Id[0]),'avoidable same-group rematch');
    assert.deepEqual(byes.map(b=>b.playerId).sort(),ranked.slice(0,pattern.length-ids.length).sort());
    for(let slot=0;slot<pattern.length;slot++)if(!ranked[pattern[slot]-1]||!ranked[pattern[slot^1]-1])assert.equal(seeded.ko.seedSlots[slot],ranked[pattern[slot]-1]||null);
    const koBefore=JSON.stringify(firebase(seeded.ko));
    async function reload(){await p.reload();await p.locator('#cloudLoginModal.show').waitFor();await p.evaluate(x=>multiProbe.restore(x),players);}
    await reload();assert.equal(JSON.stringify(firebase((await snap()).t.ko)),koBefore);
    if(groups===3&&advance===2){
     await p.evaluate(id=>openSKOBracket(id),id);await p.locator('#bracketModal.show').waitFor();
     await p.screenshot({path:path.join(out,'3x2-'+width+'-bracket.png')});await p.locator('#bracketCloseBtn').click();
    }
    // Complete with alternating winner directions across cases; reverse the order
    // of results at 390 px. Node additionally compares both orders on identical inputs.
    const scored=[];
    await score(first.matches[0],groups%2===0);scored.push(first.matches[0].id);
    const partial=JSON.stringify(firebase((await snap()).t.ko));await reload();assert.equal(JSON.stringify(firebase((await snap()).t.ko)),partial);
    for(let pass=0;pass<20;pass++){
     const t=(await snap()).t;if(t.status==='complete')break;
     const pending=t.ko.rounds.flatMap(r=>r.matches).filter(m=>m.status!=='done');assert.ok(pending.length);
     for(const m of width===390?pending.reverse():pending){await score(m,groups%2===0);scored.push(m.id);}
    }
    const done=await snap();assert.equal(done.t.status,'complete');assert.equal(new Set(scored).size,ids.length-1);
    assert.equal(done.t.ko.rounds.flatMap(r=>r.matches).length,ids.length-1);
    assert.ok(done.t.ko.rounds.slice(1).every(r=>!r.byes?.length));assert.equal(done.matches.length,0);
    const played=done.t.groups.flatMap(g=>g.matches).concat(done.t.ko.rounds.flatMap(r=>r.matches));
    for(const stat of done.stats){
     const actual=played.filter(m=>[m.player1Id,m.player2Id].includes(stat.playerId));
     assert.equal(stat.tournamentMatches,actual.length);assert.equal(stat.tournamentMatchWins,actual.filter(m=>m.winnerId===stat.playerId).length);
    }
    const champion=done.placements.find(r=>r.playerId===done.t.ko.championId);assert.equal(champion.value,1);
    result.complete=done;assert.deepEqual(errors,[]);report.scenarios.push(result);
    fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
    console.log('PASS multi-group',groups+'x'+advance,width,'pairs',JSON.stringify(first.matches.map(m=>[m.player1Id,m.player2Id])),'byes',JSON.stringify(byes.map(b=>b.playerId)));
    await context.close();
   }
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
