'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.HYBRID_OUT||path.join(root,'output/hybrid-sko-byes'));
fs.mkdirSync(out,{recursive:true});
const baseline=process.env.HYBRID_BASELINE_REF;
const format=process.env.HYBRID_FORMAT||'groups_sko';
const source=baseline?execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10e6}):fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`
window.byeProbe={
  auth(){clearRuntimeCloudIdentity();cloudUid='isolated-owner';cloudAuthenticated=true;cloudEmailVerified=true;
    cloudIdToken='mock';cloudTokenExpiresAt=Date.now()+3600000;currentUserRole='system_admin';
    document.querySelectorAll('.modal.show').forEach(el=>el.classList.remove('show'));},
  setup(players){this.auth();data=defaultData();data.players=players;showScreen('tournament');},
  async restore(players){this.auth();data=defaultData();data.players=players;await loadSecureTournaments();await openTournamentDetail(data.tournaments[0].id);},
  name(id,name){Object.assign(data.players[id],{name,firstName:name,lastName:''});renderTournamentDetail();},

  historical(t){return historicalReplay(t).t;},
  snapshot(){
    const t=data.tournaments[0];
    return {t:JSON.parse(JSON.stringify(t)),order:groupStandings(t.groups[0],t),seeds:groupPlayoffSeeds(t),
      placements:tournamentPlacementRecords(t),stats:buildTournamentStats(),scoreboardMatches:data.matches,
      active:t.ko?.participantIds.filter(id=>!t.ko.eliminatedIds.includes(id))};
  }
};`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,
  (_,a,b,c)=>a+b+hook+c);
assert.notEqual(html,source);
const host='https://seven-player.local';
function firebase(x){
  if(x==null||typeof x!=='object')return x??null;
  const entries=Object.entries(x).map(([k,v])=>[k,firebase(v)]).filter(([,v])=>v!==null);
  return entries.length?Object.assign(Array.isArray(x)?[]:{},Object.fromEntries(entries)):null;
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const report={baseline:baseline||null,version:baseline?'v4.51.120 RC':'candidate',scenarios:[]};
  try{
    const widths=process.env.BYE_WIDTHS?process.env.BYE_WIDTHS.split(',').map(Number):[1440,390,320];
    for(const width of widths){
      for(const n of (process.env.HYBRID_COUNTS||'7,8,6,5,4').split(',').map(Number)){
        const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:width===1440?1000:844}});
        const db={},requests=[],errors=[],dialogs=[];
        const players=Object.fromEntries('ABCDEFGH'.slice(0,n).split('').map(id=>[id,{id,name:id,firstName:id,lastName:'',active:true}]));
        await context.route('**/*',route=>{
          const q=route.request(),u=new URL(q.url());
          if(u.origin===host){
            if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
            const file=path.resolve(root,'.'+u.pathname);
            if(file.startsWith(root+path.sep)&&fs.existsSync(file))return route.fulfill({path:file,contentType:file.endsWith('.js')?'application/javascript':undefined});
          }
          if(/firebaseio|firebasedatabase/.test(u.hostname)){
            requests.push({method:q.method(),path:u.pathname});
            const m=u.pathname.match(/^\/tournaments(?:\/([^/]+))?\.json$/);
            if(m){
              const id=m[1];
              if(q.method()==='PUT'){assert.ok(id);db[id]=firebase(q.postDataJSON());return route.fulfill({json:db[id]});}
              if(q.method()==='GET')return route.fulfill({json:id?db[id]??null:db});
            }
            return route.fulfill({json:u.pathname==='/players.json'?players:null});
          }
          return route.abort();
        });
        const page=await context.newPage();page.setDefaultTimeout(15000);
        page.on('pageerror',e=>errors.push(e.message));
        page.on('dialog',async d=>{dialogs.push(d.message());await d.accept();});
        const snap=()=>page.evaluate(()=>byeProbe.snapshot());
        await page.goto(host);
        await page.locator('#cloudLoginModal.show').waitFor();
        await page.evaluate(players=>byeProbe.setup(players),players);
        await page.locator('#tournamentHubCreateBtn').click();
        await page.locator('#tournamentName').fill('Diagnostika '+n+' hráčů');
        await page.locator('#tournamentFormat').selectOption(format);
        await page.locator('#tournamentSeedingMode').selectOption('manual');
        await page.locator('#tournamentGroupCount').fill('1');
        await page.locator('#tournamentAdvanceCount').fill(String(n));
        await page.locator('#tournamentDiscipline').selectOption('9-ball');
        await page.locator('#tournamentRace').fill('5');
        await page.locator('#tournamentPlayoffRace').fill('5');
        for(const id of Object.keys(players)){
          await page.locator('#tournamentPlayerChooseBtn').click();
          await page.getByRole('option',{name:id,exact:true}).click();
        }
        await page.locator('#tournamentMarkAllPaidBtn').click();
        await page.locator('#tournamentCloseCheckinBtn').click();
        await page.locator('#createTournamentBtn').click();
        await page.locator('#screen-tournament-detail.active').waitFor();
        const id=(await snap()).t.id;
        async function score(m,targetId=id){
          await page.locator(`#tournamentDetailBody button[onclick="openHistoricalTournamentScore('${targetId}','${m.id}')"]`).click();
          const winner=m.player1Id<m.player2Id?0:1;
          await page.locator('#historicalTournamentScore1').fill(winner===0?'5':'1');
          await page.locator('#historicalTournamentScore2').fill(winner===0?'1':'5');
          await page.locator('#historicalTournamentScoreSaveBtn').click();
          await page.locator('#historicalTournamentScoreModal').waitFor({state:'hidden'});
          if(await page.locator('#tournamentResultModal.show').count())await page.locator('#tournamentResultOk').click();
        }
        const matches=(await snap()).t.groups.flatMap(g=>g.matches);
        assert.equal(matches.length,n*(n-1)/2);
        for(const m of matches)await score(m);
        const s={width,n,stages:{},screenshots:[],requests,errors,dialogs};
        async function capture(stage,bracket=false){
          const state=await snap();
          s.stages[stage]=state;
          if(n!==7)return;
          if(bracket){
            await page.evaluate(id=>openSKOBracket(id),id);
            const modal=page.locator('#bracketModal.show');
            await modal.waitFor();
            const file=path.join(out,n+'-'+width+'-'+stage+'-bracket.png');
            await page.screenshot({path:file});
            s.screenshots.push(file);
            s.stages[stage].bracketText=await page.locator('#bracketModalBody').innerText();
            if(!baseline){assert.doesNotMatch(s.stages[stage].bracketText,/\bBYE\b/i);if(state.t.ko?.rounds.some(r=>r.byes?.length))assert.match(s.stages[stage].bracketText,/VOLNÝ LOS/);}
            s.stages[stage].layout=await page.locator('#bracketModalBody').evaluate(el=>({client:el.clientWidth,scroll:el.scrollWidth,viewport:innerWidth}));
            if(stage==='seeded'&&width<1440){
              await modal.locator('.knockout-preview').first().scrollIntoViewIfNeeded();
              const future=path.join(out,n+'-'+width+'-seeded-semifinal.png');
              await page.screenshot({path:future});s.screenshots.push(future);
              assert.ok(await modal.locator('.knockout-preview').first().getByText('A',{exact:true}).isVisible());
            }
            await page.locator('#bracketCloseBtn').click();
          }
          const detail=path.join(out,n+'-'+width+'-'+stage+'-detail.png');
          if(stage==='seeded'||stage==='quarterfinals'||stage==='complete'){
            const heading=page.getByRole('heading',{name:'PLAY-OFF • SKO',exact:true});
            if(await heading.count())await heading.scrollIntoViewIfNeeded();
          }
          await page.screenshot({path:detail,fullPage:true});s.screenshots.push(detail);
          s.stages[stage].detailText=await page.locator('#tournamentDetailBody').innerText();
          if(!baseline)assert.doesNotMatch(s.stages[stage].detailText,/\bBYE\b/i);
        }
        await capture('groups');
        assert.deepEqual((await snap()).order.map(r=>[r.id,r.v]),Object.keys(players).map((id,i)=>[id,n-i-1]));
        s.manualSlots=await page.locator('.inline-manual-playoff-slot').count();
        if(!baseline)assert.doesNotMatch(await page.locator('.manual-playoff-positions').innerText(),/\bBYE\b/i);
        if(!baseline&&n===7&&format==='groups_sko'){
          const special='A & <img src=x onerror="window.injected=true"> \' " >';
          await page.evaluate(s=>byeProbe.name('A',s),special);
          const summary=page.locator('.manual-playoff-bye p').first();
          assert.match(await summary.innerText(),/A & <img/);
          assert.equal(await page.locator('.manual-playoff-positions img').count(),0);
          assert.equal(await page.evaluate(()=>window.injected),undefined);
          await page.evaluate(()=>byeProbe.name('A','A'));
        }
        if(!baseline){
          const inline=page.locator('.inline-manual-playoff-slot');
          const second=await inline.nth(1).inputValue();
          await inline.nth(1).selectOption(await inline.first().inputValue());
          await page.locator('.inline-manual-playoff-apply').click();
          await page.waitForFunction(()=>!document.querySelector('.inline-manual-playoff-apply')?.disabled);
          assert.match(await page.locator('[id^="inlineManualPlayoffStatus_"]').innerText(),/vícekrát/);
          assert.equal((await snap()).t.playoffStarted,false);
          await inline.nth(1).selectOption(second);
        }
        const seeds=(await snap()).seeds;
        for(let i=0;i<s.manualSlots;i++)await page.locator('.inline-manual-playoff-slot').nth(i).selectOption(seeds[i]);
        await page.locator('.inline-manual-playoff-apply').click();
        await page.waitForFunction(()=>!document.querySelector('.inline-manual-playoff-apply')?.disabled);
        if(baseline){
          assert.equal(n,7);
          assert.equal(s.manualSlots,6);
          assert.equal((await snap()).t.playoffStarted,false);
          s.blockedMessage=await page.locator('[id^="inlineManualPlayoffStatus_"]').innerText();
          assert.match(s.blockedMessage,/Vyber hráče do všech pozic/);
          try{await page.evaluate(id=>openGroupPlayoffSeedModal(id),id);}
          catch(e){s.modalError=e.message;}
          assert.match(s.modalError,/escapeHtml is not defined/);
          await capture('blocked-ui');
          report.scenarios.push(s);
          fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(report,null,2));
          console.log('BASELINE reproduced inline and dialog blockers',width);
          await context.close();
          continue;
        }
        assert.equal(s.manualSlots,n);
        assert.equal((await snap()).t.playoffStarted,true);
        s.inlineSeeded=(await snap()).t.ko;
        // Open the standalone dialog through the supported UI for explicit reseeding.
        if(n===7)await page.evaluate(()=>byeProbe.name('A',`A & <img src=x onerror="window.injected=true"> ' " >`));
        await page.getByRole('button',{name:'UPRAVIT TURNAJ',exact:true}).click();
        await page.getByRole('button',{name:'RUČNĚ PŘENASADIT PLAY-OFF',exact:true}).click();
        await page.locator('#groupPlayoffSeedModal.show').waitFor();
        assert.equal(await page.locator('.manual-playoff-slot').count(),n);
        assert.doesNotMatch(await page.locator('#groupPlayoffManualList').innerText(),/\bBYE\b/i);
        if(n===7){
          assert.match(await page.locator('.manual-playoff-slot').first().innerText(),/A & <img/);
          assert.equal(await page.locator('#groupPlayoffManualList img').count(),0);
          assert.equal(await page.evaluate(()=>window.injected),undefined);
          await page.evaluate(()=>byeProbe.name('A','A'));
        }
        // An intentional duplicate must be refused without creating any playoff.
        const fields=page.locator('.manual-playoff-slot');
        const originalSecond=await fields.nth(1).inputValue();
        await fields.nth(1).selectOption(await fields.first().inputValue());
        await page.locator('#groupPlayoffSeedApplyBtn').click();
        await page.waitForFunction(()=>!document.getElementById('groupPlayoffSeedApplyBtn').disabled);
        assert.match(await page.locator('#groupPlayoffSeedStatus').innerText(),/dvakrát/);
        assert.equal((await snap()).t.playoffStarted,false);
        await fields.nth(1).selectOption(originalSecond);
        if(format==='groups_dko'){
          await page.locator('#groupPlayoffSeedApplyBtn').click();
          await page.locator('#groupPlayoffSeedModal').waitFor({state:'hidden'});
          const state=await snap();
          assert.equal(state.t.ko,null);
          assert.equal(new Set(state.t.dko.participantIds).size,n);
          assert.equal(state.t.dko.seedSlots,undefined);
          s.stages.seeded=state;
          const expected=JSON.stringify(firebase(state.t.dko));
          await page.reload();await page.locator('#cloudLoginModal.show').waitFor();
          await page.evaluate(players=>byeProbe.restore(players),players);
          assert.equal(JSON.stringify(firebase((await snap()).t.dko)),expected);
          assert.deepEqual(errors,[]);
          report.scenarios.push(s);
          fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(report,null,2));
          console.log('PASS DKO odd inline/dialog/reload',n,width);
          await context.close();
          continue;
        }
        if(n===7){
          // Swap A and G, explicitly giving G the first branch BYE.
          await fields.first().selectOption('G');
          const oldG=await fields.evaluateAll(fields=>fields.find(el=>el!==fields[0]&&el.value==='G')?.dataset.slot);
          const gField=page.locator('.manual-playoff-slot[data-slot="'+oldG+'"]');
          await gField.selectOption('A');
          assert.match(await page.locator('#groupPlayoffManualList .manual-playoff-bye').innerText(),/G.*postupuje/s);
          await page.locator('#groupPlayoffSeedApplyBtn').click();
          await page.locator('#groupPlayoffSeedModal').waitFor({state:'hidden'});
          assert.equal((await snap()).t.ko.rounds[0].byes[0].playerId,'G');
          s.dialogManualChanged=(await snap()).t.ko;
          await page.getByRole('button',{name:'UPRAVIT TURNAJ',exact:true}).click();
          await page.getByRole('button',{name:'RUČNĚ PŘENASADIT PLAY-OFF',exact:true}).click();
          await page.locator('#groupPlayoffSeedModal.show').waitFor();
        }
        await page.locator('#groupPlayoffSeedMode').selectOption('rules');
        await page.locator('#groupPlayoffTieRule').selectOption('points');
        await page.locator('#groupPlayoffPenaltyTieBreak').uncheck();
        await page.locator('#groupPlayoffSeedApplyBtn').click();
        await page.locator('#groupPlayoffSeedModal').waitFor({state:'hidden'});
        s.generationRoute='actual inline and dialog actions, final rules seeding';
        assert.equal((await snap()).t.playoffStarted,true);
        await capture('seeded',true);
        const expected=JSON.stringify(firebase((await snap()).t.ko));
        await page.reload();await page.locator('#cloudLoginModal.show').waitFor();
        await page.evaluate(players=>byeProbe.restore(players),players);
        s.reloadSeededEqual=JSON.stringify(firebase((await snap()).t.ko))===expected;
        s.reloadSeededState=(await snap()).t.ko;
        const first=(await snap()).t.ko.rounds[0].matches;
        const byes=(await snap()).t.ko.rounds[0].byes||[];
        const expectedByes={7:['A'],6:['A','B'],5:['A','C','B'],4:[],8:[]};
        assert.deepEqual(byes.map(b=>b.playerId),expectedByes[n]);
        assert.equal(first.length,n-2**Math.ceil(Math.log2(n))/2);
        if(n===7){
          assert.deepEqual(first.map(m=>[m.player1Id,m.player2Id]),[['D','E'],['C','F'],['B','G']]);
          assert.match(s.stages.seeded.bracketText,/A/);
          assert.match(s.stages.seeded.bracketText,/Vítěz čtvrtfinále 2/);
          assert.match(s.stages.seeded.bracketText,/Postupuje přímo do semifinále 1/);
        }
        await score(first[0]);await capture('one-quarterfinal');
        const partial=JSON.stringify(firebase((await snap()).t.ko));
        await page.reload();await page.locator('#cloudLoginModal.show').waitFor();
        await page.evaluate(players=>byeProbe.restore(players),players);
        s.reloadPlayingEqual=JSON.stringify(firebase((await snap()).t.ko))===partial;
        s.reloadPlayingState=(await snap()).t.ko;
        for(const m of first.slice(1).reverse())await score(m);
        await capture('quarterfinals',true);
        for(let i=0;i<20;i++){
          const current=await snap();
          if(current.t.status==='complete')break;
          const m=current.t.ko.rounds.flatMap(r=>r.matches).find(m=>m.status!=='done');
          assert.ok(m,'pending real match exists');await score(m);
        }
        assert.equal((await snap()).t.status,'complete');
        await capture('complete',true);
        s.finalMatches=(await snap()).t.ko.rounds.flatMap(r=>r.matches).length;
        assert.equal(s.finalMatches,n-1);
        assert.equal((await snap()).t.ko.championId,'A');
        assert.ok((await snap()).t.ko.rounds.slice(1).every(r=>!r.byes?.length));
        assert.ok(s.reloadSeededEqual&&s.reloadPlayingEqual);
        if(n===7){
          const semi=s.stages.quarterfinals.t.ko.rounds[1].matches;
          assert.deepEqual(semi.map(m=>[m.player1Id,m.player2Id]),[['A','D'],['C','B']]);
          const stat=s.stages.complete.stats.find(p=>p.playerId==='A');
          assert.equal(stat.tournamentMatches,8);
          assert.equal(stat.tournamentMatchWins,8);
        }
        assert.equal((await snap()).scoreboardMatches.length,0);
        assert.deepEqual(errors,[]);
        if(!baseline&&n===7){
          const legacy=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/hybrid-sko-legacy.json'),'utf8'));
          s.legacy=[];
          for(const stage of ['seeded','one-quarterfinal','complete']){
            const saved=legacy[stage];
            for(const key of Object.keys(db))delete db[key];
            db[saved.t.id]=firebase(saved.t);
            const cloudBefore=JSON.stringify(db[saved.t.id]);
            await page.reload();await page.locator('#cloudLoginModal.show').waitFor();
            await page.evaluate(players=>byeProbe.restore(players),players);
            const state=await snap();
            assert.deepEqual(firebase(state.t.ko),firebase(saved.t.ko));
            assert.deepEqual(state.placements,saved.placements);
            assert.deepEqual(state.stats,saved.stats);
            assert.equal(JSON.stringify(db[saved.t.id]),cloudBefore);
            assert.equal(state.t.ko.seedSlots,undefined);
            assert.doesNotMatch(await page.locator('#tournamentDetailBody').innerText(),/\bBYE\b/i);
            await page.evaluate(id=>openSKOBracket(id),saved.t.id);
            const legacyText=await page.locator('#bracketModalBody').innerText();
            assert.doesNotMatch(legacyText,/\bBYE\b/i);assert.match(legacyText,/VOLNÝ LOS/);
            await page.locator('#bracketCloseBtn').click();
            s.legacy.push({stage,unchanged:true});
          }
          const historical=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/hybrid-sko-legacy-historical.json'),'utf8'));
          const shape=t=>({rounds:t.ko.rounds.map(r=>({label:r.label,byes:r.byes,matches:r.matches.map(m=>({
            a:m.player1Id,b:m.player2Id,status:m.status,winner:m.winnerId,score1:m.score1,score2:m.score2
          }))})),champion:t.ko.championId,eliminated:t.ko.eliminatedIds});
          for(const [stage,saved] of Object.entries(historical.cases)){
            const restored=await page.evaluate(t=>byeProbe.historical(t),firebase(saved));
            assert.equal(restored.ko.seedSlots,undefined);
            assert.deepEqual(shape(restored),shape(saved),'legacy historical '+stage);
          }
          s.legacyHistorical=['seeded','partial'];
          assert.deepEqual(errors,[]);
        }
        report.scenarios.push(s);
        fs.writeFileSync(path.join(out,'diagnostic.json'),JSON.stringify(report,null,2));
        console.log('PASS isolated',n,width,'seeds',JSON.stringify(s.stages.seeded.seeds),'BYE',JSON.stringify(s.stages.seeded.t.ko.rounds[0].byes),'manual',JSON.stringify(s.generationRoute));
        await context.close();
      }
    }
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
