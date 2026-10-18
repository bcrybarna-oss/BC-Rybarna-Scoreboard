  function defaultLeagueFixtures(){
    return LEAGUE_SEVER_DRAW.map((x,i)=>({
      id:'LS26_'+String(i+1).padStart(2,'0'),round:x[0],homeId:x[1],awayId:x[2],status:'pending',
      lineup:null,legs:[],decider:null,homeScore:0,awayScore:0,resultRevision:0,adminOverride:false,
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    }));
  }
  function defaultLeagueConfigTeams(){
    const out={};
    LEAGUE_SEVER_TEAMS.forEach(t=>out[t.id]={id:t.id,name:t.name,captainUid:'',captainPlayerId:'',captainName:''});
    return out;
  }
  function ensureLeagueSever(){
    if(!Array.isArray(data.leagues))data.leagues=[];
    let l=data.leagues.find(x=>x?.id===LEAGUE_SEVER_ID);
    if(!l){
      l={id:LEAGUE_SEVER_ID,name:'POOL LIGA SEVER 2026',season:2026,teams:JSON.parse(JSON.stringify(LEAGUE_SEVER_TEAMS)),fixtures:defaultLeagueFixtures()};
      data.leagues.push(l);
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    }
    if(!Array.isArray(l.fixtures))l.fixtures=[];
    if(!l.fixtures.length)l.fixtures=defaultLeagueFixtures();
    return l;
  }
  function leagueTeamName(id){return LEAGUE_SEVER_TEAMS.find(t=>t.id===id)?.name||id||'—';}
  function leagueFixtureScore(f){
    let h=0,a=0;
    (f.legs||[]).forEach(x=>{if(x?.winner===0)h++;if(x?.winner===1)a++;});
    if(f.decider?.winner===0)h++;if(f.decider?.winner===1)a++;
    f.homeScore=h;f.awayScore=a;
    return [h,a];
  }
  function leagueConfirmationFor(f,teamId){
    const c=leagueConfirmations?.[f.id]?.[teamId];
    return c&&Number(c.revision||0)===Number(f.resultRevision||0)?c:null;
  }
  function leagueFixtureConfirmed(f){
    if(!f||f.status!=='done')return false;
    if(f.adminOverride===true)return true;
    const hc=leagueConfirmationFor(f,f.homeId),ac=leagueConfirmationFor(f,f.awayId);
    return hc?.status==='confirmed'&&ac?.status==='confirmed';
  }
  function leagueFixtureComplete(f){return leagueFixtureConfirmed(f);}
  function leagueCurrentCaptainTeamIds(){
    if(!cloudUid)return [];
    return Object.values(leagueConfigTeams||{}).filter(t=>t?.captainUid===cloudUid).map(t=>t.id);
  }
  function canEditLeagueFixture(f){
    if(currentUserIsSystemAdmin())return true;
    const ids=new Set(leagueCurrentCaptainTeamIds());
    return !!(f&&ids.size&&(ids.has(f.homeId)||ids.has(f.awayId)));
  }
  function canPrepareLeagueFixture(f){return canEditLeagueFixture(f);}
  function canConfirmLeagueSide(f,teamId){
    if(currentUserIsSystemAdmin())return true;
    return !!(cloudUid&&leagueConfigTeams?.[teamId]?.captainUid===cloudUid&&(teamId===f.homeId||teamId===f.awayId));
  }
  function leagueEditablePendingFixtures(){
    const l=ensureLeagueSever();
    return (l.fixtures||[]).filter(f=>f.status==='pending'&&canPrepareLeagueFixture(f));
  }
  function remainingLeagueFixture(homeId,awayId){
    const l=ensureLeagueSever();
    return (l.fixtures||[]).find(f=>f.homeId===homeId&&f.awayId===awayId&&f.status==='pending')||null;
  }
  function activeLeagueFixtures(){
    const l=ensureLeagueSever();
    return (l.fixtures||[]).filter(f=>['playing','needs_decider','done'].includes(f.status)&&(!leagueFixtureConfirmed(f)||f.status!=='done'));
  }
  async function leagueCloudRequest(path,method='GET',body=null){
    if(!await ensureCloudToken())throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null)opts.body=JSON.stringify(body);
    const suffix=path?'/'+path:'';
    const r=await fetch(cloudUrl(LEAGUE_CLOUD_ROOT+suffix)+(method==='GET'?'&t='+Date.now():''),opts);
    if(!r.ok)throw new Error('LEAGUE_CLOUD_'+r.status);
    return await r.json();
  }
  function leagueCloudPayload(){
    const l=ensureLeagueSever();
    const fixtures={};(l.fixtures||[]).forEach(f=>fixtures[f.id]=JSON.parse(JSON.stringify(f)));
    return {config:{id:LEAGUE_SEVER_ID,name:l.name,season:l.season,teams:leagueConfigTeams&&Object.keys(leagueConfigTeams).length?leagueConfigTeams:defaultLeagueConfigTeams(),playerAliases:leaguePlayerAliases||{}},fixtures,confirmations:leagueConfirmations||{}};
  }
  async function bootstrapLeagueCloudIfNeeded(){
    if(!currentUserIsSystemAdmin())return false;
    const existing=await leagueCloudRequest('','GET');
    if(existing)return true;
    leagueConfigTeams=defaultLeagueConfigTeams();leagueConfirmations={};leaguePlayerAliases={};
    await leagueCloudRequest('','PUT',leagueCloudPayload());
    return true;
  }
  async function loadLeagueCloud(force=false){
    if(leagueCloudLoading)return;
    if(!cloudAuthenticated||!cloudUid){
      leagueCloudLoaded=false;
      if($('leagueCloudStatusText'))$('leagueCloudStatusText').textContent='Pro společná online data se přihlas do aplikace.';
      renderLeague();return;
    }
    leagueCloudLoading=true;
    try{
      let raw=await leagueCloudRequest('','GET');
      if(!raw&&currentUserIsSystemAdmin()){
        await bootstrapLeagueCloudIfNeeded();
        raw=await leagueCloudRequest('','GET');
      }
      if(raw){
        leagueConfigTeams=raw.config?.teams||defaultLeagueConfigTeams();
        leaguePlayerAliases=(raw.config?.playerAliases&&typeof raw.config.playerAliases==='object')?raw.config.playerAliases:{};
        leagueConfirmations=raw.confirmations||{};
        const fixtures=Object.values(raw.fixtures||{}).filter(Boolean);
        const l=ensureLeagueSever();
        if(fixtures.length)l.fixtures=fixtures;
        leagueCloudLoaded=true;
        try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
        if($('leagueCloudStatusText'))$('leagueCloudStatusText').textContent='ONLINE • výsledky, tabulka a rozpis jsou společné pro všechny přihlášené uživatele.';
      }else{
        leagueCloudLoaded=false;
        if($('leagueCloudStatusText'))$('leagueCloudStatusText').textContent='Online liga ještě není založená. Musí ji jednou otevřít systémový administrátor.';
      }
    }catch(e){
      console.error('League cloud load:',e);
      leagueCloudLoaded=false;
      if($('leagueCloudStatusText'))$('leagueCloudStatusText').textContent='Online data se nepodařilo načíst. Zobrazuji poslední lokální stav.';
    }finally{
      leagueCloudLoading=false;renderLeague();
    }
  }
  async function saveLeagueFixtureCloud(f){
    if(!leagueCloudLoaded)throw new Error('LEAGUE_NOT_ONLINE');
    f.updatedAt=new Date().toISOString();
    await leagueCloudRequest('fixtures/'+f.id,'PUT',f);
  }
  async function saveLeagueConfirmationCloud(f,teamId,status){
    const rev=Number(f.resultRevision||0);
    const payload={status,revision:rev,uid:cloudUid,at:new Date().toISOString()};
    await leagueCloudRequest('confirmations/'+f.id+'/'+teamId,'PUT',payload);
    if(!leagueConfirmations[f.id])leagueConfirmations[f.id]={};
    leagueConfirmations[f.id][teamId]=payload;
  }
  async function saveLeagueConfigTeamsCloud(){
    await leagueCloudRequest('config/teams','PUT',leagueConfigTeams);
  }
  function updateLeagueSelectors(){
    const home=$('leagueHomeTeam'),away=$('leagueAwayTeam');if(!home||!away)return;
    const oldH=home.value,oldA=away.value;
    const fixtures=leagueEditablePendingFixtures();
    const homes=[...new Set(fixtures.map(f=>f.homeId))];
    home.innerHTML='<option value="">— domácí —</option>'+homes.map(id=>`<option value="${esc(id)}">${esc(leagueTeamName(id))}</option>`).join('');
    if(homes.includes(oldH))home.value=oldH;
    const awayIds=[...new Set(fixtures.filter(f=>!home.value||f.homeId===home.value).map(f=>f.awayId))];
    away.innerHTML='<option value="">— hosté —</option>'+awayIds.map(id=>`<option value="${esc(id)}">${esc(leagueTeamName(id))}</option>`).join('');
    if(awayIds.includes(oldA))away.value=oldA;
    const f=remainingLeagueFixture(home.value,away.value);
    if($('leagueFixtureHint'))$('leagueFixtureHint').textContent=f?`Neodehrané utkání z losu: kolo ${f.round}. Po dokončení se tato konkrétní položka uzamkne.`:(fixtures.length?'Vyber dvojici svého týmu, která má ještě neodehrané utkání.':'Nemáš žádné neodehrané utkání, které smíš připravit.');
    const can=!!f&&canPrepareLeagueFixture(f);
    ['leagueDate','leaguePlace','leagueH1','leagueH2','leagueH3','leagueA1','leagueA2','leagueA3','leaguePrepareBtn'].forEach(id=>{if($(id))$(id).disabled=!can;});
  }
  function leagueAliasKey(name){
    return String(name||'').trim().toLowerCase().replace(/\s+/g,' ');
  }
  function leagueCanonicalAliasName(name){
    let current=String(name||'').trim();
    const seen=new Set();
    for(let i=0;i<8;i++){
      const key=leagueAliasKey(current);
      if(!key||seen.has(key))break;
      seen.add(key);
      const next=String(leaguePlayerAliases?.[key]||'').trim();
      if(!next)break;
      current=next;
    }
    return current;
  }
  function leagueRawPlayerNames(){
    const out=new Set();
    const l=ensureLeagueSever();
    (l.fixtures||[]).forEach(f=>{
      ['home','away'].forEach(side=>{
        (f.lineup?.[side]||[]).forEach(p=>{
          const n=String(p?.displayName||p?.name||'').trim();
          if(n)out.add(n);
        });
      });
      ['homePlayers','awayPlayers'].forEach(k=>{
        (f.decider?.[k]||[]).forEach(p=>{
          const n=String(p?.displayName||p?.name||'').trim();
          if(n)out.add(n);
        });
      });
    });
    return [...out].sort((a,b)=>a.localeCompare(b,'cs'));
  }
  async function saveLeaguePlayerAliasesCloud(){
    await leagueCloudRequest('config/playerAliases','PUT',leaguePlayerAliases||{});
  }
  function renderLeaguePlayerAliasesAdmin(){
    const panel=$('leaguePlayerAliasesAdmin'),sel=$('leagueAliasSource'),list=$('leagueAliasList');
    if(!panel||!sel||!list)return;
    panel.classList.toggle('hidden',!currentUserIsSystemAdmin());
    if(!currentUserIsSystemAdmin())return;

    const raw=leagueRawPlayerNames();
    const old=sel.value;
    sel.innerHTML='<option value="">— vyber zadané jméno —</option>'+raw.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('');
    if(raw.includes(old))sel.value=old;

    const entries=Object.entries(leaguePlayerAliases||{});
    list.innerHTML=entries.length?entries.map(([key,target])=>`<div class="history-item" style="margin-bottom:6px">
      <div class="history-line"><div><strong>${esc(key)}</strong> → <strong>${esc(target)}</strong></div>
      <button class="btn danger" onclick="deleteLeagueAlias('${esc(key)}')">SMAZAT</button></div>
    </div>`).join(''):'<div class="muted">Žádné ruční aliasy nejsou nastavené.</div>';
  }
  window.deleteLeagueAlias=async function(key){
    if(!currentUserIsSystemAdmin())return;
    delete leaguePlayerAliases[key];
    try{await saveLeaguePlayerAliasesCloud();renderLeague();toast('Alias byl smazán.');}
    catch(e){console.error(e);toast('Alias se nepodařilo smazat.');}
  };

  function leaguePlayerFromName(name){
    const n=String(name||'').trim();if(!n)return null;
    const p=getOrCreatePlayer(n);return {id:p.id,name:p.name,displayName:playerDisplayName(p)};
  }
  async function prepareLeagueFixture(){
    const homeId=$('leagueHomeTeam')?.value||'',awayId=$('leagueAwayTeam')?.value||'';
    const f=remainingLeagueFixture(homeId,awayId);
    if(!f||!canPrepareLeagueFixture(f)){toast('Na toto utkání nemáš oprávnění.');return;}
    const hn=[$('leagueH1').value,$('leagueH2').value,$('leagueH3').value].map(x=>x.trim());
    const an=[$('leagueA1').value,$('leagueA2').value,$('leagueA3').value].map(x=>x.trim());
    if(hn.some(x=>!x)||an.some(x=>!x)){toast('Vyplň všechny tři hráče obou týmů.');return;}
    const all=[...hn,...an].map(x=>x.toLowerCase());if(new Set(all).size!==all.length){toast('V sestavách nesmí být stejný hráč dvakrát.');return;}
    try{f.lineup={home:hn.map(leaguePlayerFromName),away:an.map(leaguePlayerFromName)};}catch(e){toast('Některého hráče nelze použít.');return;}
    f.date=$('leagueDate').value||'';f.place=$('leaguePlace').value.trim();f.status='playing';f.startedAt=new Date().toISOString();f.updatedAt=f.startedAt;
    f.legs=LEAGUE_LEG_MAP.map((pair,i)=>({index:i+1,homeSlot:pair[0],awaySlot:pair[1],status:'pending',matchId:null,winner:null,score:null}));
    f.decider=null;f.resultRevision=Number(f.resultRevision||0)+1;f.adminOverride=false;selectedLeagueFixtureId=f.id;
    try{await saveLeagueFixtureCloud(f);}catch(e){console.error(e);toast('Utkání se nepodařilo uložit online.');return;}
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}renderLeague();toast('Ligové utkání připraveno.');
  }
  function startLeagueLeg(fixtureId,legIndex){
    const l=ensureLeagueSever(),f=l.fixtures.find(x=>x.id===fixtureId);if(!f||!f.lineup)return;
    if(!canEditLeagueFixture(f)){toast('Na toto utkání nemáš oprávnění.');return;}
    const leg=(f.legs||[]).find(x=>x.index===legIndex);if(!leg||leg.status==='done'){toast('Tento zápas už je odehraný.');return;}
    const hp=f.lineup.home[leg.homeSlot],ap=f.lineup.away[leg.awaySlot];
    pendingLeagueLink={leagueId:l.id,fixtureId:f.id,legIndex:leg.index,type:'singles',raceTo:3,doubles:false};
    $('p1Name').value=hp.name;$('p2Name').value=ap.name;$('discipline').value='8-ball';$('raceTo').value='3';$('breakMode').value='alternate';
    if($('doublesMode'))$('doublesMode').checked=false;if($('ghostMode'))$('ghostMode').checked=false;if($('winnerTableMode'))$('winnerTableMode').checked=false;
    if($('useLag'))$('useLag').checked=true;if($('streamMatchTitle'))$('streamMatchTitle').value=`Liga Sever • ${leagueTeamName(f.homeId)} – ${leagueTeamName(f.awayId)} • zápas ${leg.index}`;
    leg.status='playing';f.updatedAt=new Date().toISOString();saveLeagueFixtureCloud(f).catch(e=>console.warn('League leg cloud:',e));startMatch();
  }
  function leagueValidateScore(a,b,race){
    a=Number(a);b=Number(b);race=Number(race);return Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a!==b&&Math.max(a,b)===race&&Math.min(a,b)<race;
  }
  async function manualLeagueLegResult(fixtureId,legIndex){
    const l=ensureLeagueSever(),f=l.fixtures.find(x=>x.id===fixtureId);if(!f||!canEditLeagueFixture(f))return toast('Nemáš oprávnění.');
    const leg=(f.legs||[]).find(x=>x.index===legIndex);if(!leg)return;
    const hp=f.lineup.home[leg.homeSlot],ap=f.lineup.away[leg.awaySlot];
    const old=leg.score||[3,0];
    const hs=prompt(`Výsledek • ${hp.displayName||hp.name}\nPočet racků domácího:`,String(old[0]??3));if(hs===null)return;
    const as=prompt(`Výsledek • ${ap.displayName||ap.name}\nPočet racků hosta:`,String(old[1]??0));if(as===null)return;
    if(!leagueValidateScore(Number(hs),Number(as),3)){toast('8-ball je Race to 3. Jeden hráč musí mít 3 a skóre nesmí být shodné.');return;}
    leg.status='done';leg.matchId=leg.matchId||null;leg.score=[Number(hs),Number(as)];leg.winner=Number(hs)>Number(as)?0:1;leg.completedAt=new Date().toISOString();
    f.resultRevision=Number(f.resultRevision||0)+1;f.adminOverride=currentUserIsSystemAdmin();
    const completed=(f.legs||[]).filter(x=>x.status==='done').length;const [h,a]=leagueFixtureScore(f);
    if(completed===6){if(h===3&&a===3)f.status='needs_decider';else{f.status='done';f.completedAt=new Date().toISOString();}}else f.status='playing';
    try{await saveLeagueFixtureCloud(f);}catch(e){console.error(e);toast('Výsledek se nepodařilo uložit online.');return;}
    renderLeague();toast('Výsledek zapsán.');
  }
  function leagueSelectedDeciderPlayers(fixtureId){
    const l=ensureLeagueSever(),f=l.fixtures.find(x=>x.id===fixtureId);if(!f)return null;
    const picks=[0,1].map(side=>[0,1,2].filter(i=>$(`leagueDec_${fixtureId}_${side}_${i}`)?.checked));
    if(picks[0].length!==2||picks[1].length!==2)return null;
    return {f,h:picks[0].map(i=>f.lineup.home[i]),a:picks[1].map(i=>f.lineup.away[i])};
  }
  function startLeagueDecider(fixtureId){
    const sel=leagueSelectedDeciderPlayers(fixtureId);if(!sel)return toast('Do dvojiceu vyber přesně dva hráče z každého týmu.');
    const {f,h,a}=sel;if(!canEditLeagueFixture(f))return toast('Nemáš oprávnění.');
    const race=Math.max(1,parseInt($(`leagueDecRace_${fixtureId}`)?.value||'3',10));
    pendingLeagueLink={leagueId:LEAGUE_SEVER_ID,fixtureId:f.id,type:'decider',raceTo:race,doubles:true,nineBallBreakRule:'kitchen'};
    $('p1Name').value=h[0].name;$('p1PartnerName').value=h[1].name;$('p2Name').value=a[0].name;$('p2PartnerName').value=a[1].name;
    $('discipline').value='9-ball';$('raceTo').value=String(race);$('breakMode').value='alternate';
    if($('doublesMode'))$('doublesMode').checked=true;if($('ghostMode'))$('ghostMode').checked=false;if($('winnerTableMode'))$('winnerTableMode').checked=false;
    if($('nineBallBreakRule'))$('nineBallBreakRule').value='kitchen';if($('useLag'))$('useLag').checked=true;
    if($('streamMatchTitle'))$('streamMatchTitle').value=`Liga Sever • DVOJICE • ${leagueTeamName(f.homeId)} – ${leagueTeamName(f.awayId)}`;
    f.decider={status:'playing',homePlayers:h,awayPlayers:a,raceTo:race,winner:null,matchId:null};f.updatedAt=new Date().toISOString();saveLeagueFixtureCloud(f).catch(e=>console.warn(e));startMatch();
  }
  async function manualLeagueDeciderResult(fixtureId){
    const sel=leagueSelectedDeciderPlayers(fixtureId);if(!sel)return toast('Do dvojiceu vyber přesně dva hráče z každého týmu.');
    const {f,h,a}=sel;if(!canEditLeagueFixture(f))return toast('Nemáš oprávnění.');
    const race=Math.max(1,parseInt($(`leagueDecRace_${fixtureId}`)?.value||'3',10));
    const hs=prompt('Dvojice 9-ball • počet racků domácích:',String(race));if(hs===null)return;
    const as=prompt('Dvojice 9-ball • počet racků hostů:','0');if(as===null)return;
    if(!leagueValidateScore(Number(hs),Number(as),race)){toast(`Dvojice je Race to ${race}. Jeden tým musí mít ${race}.`);return;}
    f.decider={status:'done',homePlayers:h,awayPlayers:a,raceTo:race,winner:Number(hs)>Number(as)?0:1,score:[Number(hs),Number(as)],matchId:null,completedAt:new Date().toISOString()};
    leagueFixtureScore(f);f.status='done';f.completedAt=new Date().toISOString();f.resultRevision=Number(f.resultRevision||0)+1;f.adminOverride=currentUserIsSystemAdmin();
    try{await saveLeagueFixtureCloud(f);}catch(e){console.error(e);toast('Dvojice se nepodařilo uložit online.');return;}
    renderLeague();toast('Rozhodující dvojice zapsán.');
  }
  async function processLeagueResult(finished){
    const link=finished?.leagueLink;if(!link)return null;
    const l=ensureLeagueSever();if(link.leagueId!==l.id)throw new Error('LEAGUE_NOT_FOUND');
    const f=l.fixtures.find(x=>x.id===link.fixtureId);if(!f)throw new Error('FIXTURE_NOT_FOUND');
    if(link.type==='decider'){
      if(f.decider?.status==='done'&&f.decider.matchId===finished.id)return f;
      f.decider={...(f.decider||{}),status:'done',matchId:finished.id,winner:finished.winner,score:[...finished.scores],completedAt:finished.endedAt||new Date().toISOString()};
      leagueFixtureScore(f);f.status='done';f.completedAt=finished.endedAt||new Date().toISOString();
    }else{
      const leg=(f.legs||[]).find(x=>x.index===link.legIndex);if(!leg)throw new Error('LEG_NOT_FOUND');
      if(leg.status==='done'&&leg.matchId===finished.id)return f;
      leg.status='done';leg.matchId=finished.id;leg.winner=finished.winner;leg.score=[...finished.scores];leg.completedAt=finished.endedAt||new Date().toISOString();
      const completed=(f.legs||[]).filter(x=>x.status==='done').length;const [h,a]=leagueFixtureScore(f);
      if(completed===6){if(h===3&&a===3)f.status='needs_decider';else{f.status='done';f.completedAt=finished.endedAt||new Date().toISOString();}}else f.status='playing';
    }
    f.resultRevision=Number(f.resultRevision||0)+1;f.adminOverride=currentUserIsSystemAdmin();f.updatedAt=new Date().toISOString();
    try{await saveLeagueFixtureCloud(f);}catch(e){console.error('League fixture save:',e);throw e;}
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}return f;
  }
  async function confirmLeagueFixture(fixtureId,teamId,status='confirmed'){
    const l=ensureLeagueSever(),f=l.fixtures.find(x=>x.id===fixtureId);if(!f||f.status!=='done')return;
    if(!canConfirmLeagueSide(f,teamId))return toast('Tuto stranu utkání nemůžeš potvrdit.');
    if(currentUserIsSystemAdmin()){
      f.adminOverride=true;f.updatedAt=new Date().toISOString();
      try{await saveLeagueFixtureCloud(f);}catch(e){return toast('Admin potvrzení se nepodařilo uložit.');}
      renderLeague();toast('Výsledek potvrzen administrátorem.');return;
    }
    try{await saveLeagueConfirmationCloud(f,teamId,status);}catch(e){console.error(e);toast('Potvrzení se nepodařilo uložit.');return;}
    renderLeague();toast(status==='confirmed'?'Výsledek potvrzen.':'Nesouhlas byl uložen. Výsledek je potřeba opravit.');
  }

  function leaguePlayerNameFromRef(ref){
    if(!ref)return 'Neznámý hráč';
    const id=ref.id||ref.playerId||'';
    const p=id?data.players?.[id]:null;
    const raw=p?playerDisplayName(p):(ref.displayName||ref.name||'Neznámý hráč');
    return leagueCanonicalAliasName(raw)||raw;
  }

  function leaguePlayerIdFromRef(ref){
    if(!ref)return '';
    if(ref.id&&data.players?.[ref.id])return ref.id;
    if(ref.playerId&&data.players?.[ref.playerId])return ref.playerId;
    const name=String(ref.displayName||ref.name||'').trim();
    if(!name)return '';
    return findPlayerByLooseName(name)?.id||'';
  }

  function leagueSavedMatches(){
    return (data.matches||[])
      .filter(m=>
        m &&
        (m.status||'complete')==='complete' &&
        m.leagueLink?.leagueId===LEAGUE_SEVER_ID
      )
      .sort((a,b)=>new Date(a.endedAt||a.startedAt||0)-new Date(b.endedAt||b.startedAt||0));
  }

  function leagueFixtureMatchFacts(){
    const l=ensureLeagueSever();
    const savedById=new Map(leagueSavedMatches().map(m=>[m.id,m]));
    const facts=[];

    (l.fixtures||[]).forEach(f=>{
      // Singles legs
      (f.legs||[]).forEach(leg=>{
        if(leg?.status!=='done' || !Array.isArray(leg.score))return;

        const saved=leg.matchId?savedById.get(leg.matchId):null;
        if(saved){
          facts.push({
            key:'M:'+saved.id,
            source:'saved',
            doubles:false,
            match:saved,
            playerIds:[saved.playerIds?.[0]||'',saved.playerIds?.[1]||''],
            playerNames:[savedMatchSideDisplayName(saved,0),savedMatchSideDisplayName(saved,1)],
            scores:[Number(saved.scores?.[0]||0),Number(saved.scores?.[1]||0)],
            winner:Number(saved.winner),
            endedAt:saved.endedAt||saved.startedAt||'',
            stats:saved.stats||[]
          });
          return;
        }

        const hp=f.lineup?.home?.[leg.homeSlot];
        const ap=f.lineup?.away?.[leg.awaySlot];
        if(!hp||!ap)return;
        facts.push({
          key:'F:'+f.id+':L:'+leg.index,
          source:'fixture',
          doubles:false,
          match:null,
          playerIds:[leaguePlayerIdFromRef(hp),leaguePlayerIdFromRef(ap)],
          playerNames:[leaguePlayerNameFromRef(hp),leaguePlayerNameFromRef(ap)],
          scores:[Number(leg.score[0]||0),Number(leg.score[1]||0)],
          winner:Number(leg.winner),
          endedAt:leg.completedAt||f.completedAt||f.updatedAt||'',
          stats:[null,null]
        });
      });

      // Deciding doubles
      const d=f.decider;
      if(d?.status==='done' && Array.isArray(d.score)){
        const saved=d.matchId?savedById.get(d.matchId):null;
        if(saved){
          const side0Ids=Array.isArray(saved.teamPlayerIds?.[0])?saved.teamPlayerIds[0].filter(Boolean):[];
          const side1Ids=Array.isArray(saved.teamPlayerIds?.[1])?saved.teamPlayerIds[1].filter(Boolean):[];
          const side0Names=savedDoublesSideNames(saved,0);
          const side1Names=savedDoublesSideNames(saved,1);
          facts.push({
            key:'M:'+saved.id,
            source:'saved',
            doubles:true,
            match:saved,
            teamPlayerIds:[side0Ids,side1Ids],
            teamPlayerNames:[side0Names,side1Names],
            scores:[Number(saved.scores?.[0]||0),Number(saved.scores?.[1]||0)],
            winner:Number(saved.winner),
            endedAt:saved.endedAt||saved.startedAt||'',
            stats:saved.stats||[]
          });
          return;
        }

        const home=(d.homePlayers||[]).filter(Boolean);
        const away=(d.awayPlayers||[]).filter(Boolean);
        if(home.length&&away.length){
          facts.push({
            key:'F:'+f.id+':D',
            source:'fixture',
            doubles:true,
            match:null,
            teamPlayerIds:[home.map(leaguePlayerIdFromRef),away.map(leaguePlayerIdFromRef)],
            teamPlayerNames:[home.map(leaguePlayerNameFromRef),away.map(leaguePlayerNameFromRef)],
            scores:[Number(d.score[0]||0),Number(d.score[1]||0)],
            winner:Number(d.winner),
            endedAt:d.completedAt||f.completedAt||f.updatedAt||'',
            stats:[null,null]
          });
        }
      }
    });

    // Add league-linked saved matches that the fixture structure does not reference.
    const known=new Set(facts.map(x=>x.key));
    leagueSavedMatches().forEach(saved=>{
      const key='M:'+saved.id;
      if(known.has(key))return;
      if(matchIsDoubles(saved)){
        facts.push({
          key,
          source:'saved',
          doubles:true,
          match:saved,
          teamPlayerIds:[
            Array.isArray(saved.teamPlayerIds?.[0])?saved.teamPlayerIds[0].filter(Boolean):[],
            Array.isArray(saved.teamPlayerIds?.[1])?saved.teamPlayerIds[1].filter(Boolean):[]
          ],
          teamPlayerNames:[savedDoublesSideNames(saved,0),savedDoublesSideNames(saved,1)],
          scores:[Number(saved.scores?.[0]||0),Number(saved.scores?.[1]||0)],
          winner:Number(saved.winner),
          endedAt:saved.endedAt||saved.startedAt||'',
          stats:saved.stats||[]
        });
      }else{
        facts.push({
          key,
          source:'saved',
          doubles:false,
          match:saved,
          playerIds:[saved.playerIds?.[0]||'',saved.playerIds?.[1]||''],
          playerNames:[savedMatchSideDisplayName(saved,0),savedMatchSideDisplayName(saved,1)],
          scores:[Number(saved.scores?.[0]||0),Number(saved.scores?.[1]||0)],
          winner:Number(saved.winner),
          endedAt:saved.endedAt||saved.startedAt||'',
          stats:saved.stats||[]
        });
      }
    });

    // Deduplicate and preserve chronological order.
    const uniq=new Map();
    facts.forEach(f=>{if(f?.key&&!uniq.has(f.key))uniq.set(f.key,f);});
    return [...uniq.values()].sort((a,b)=>new Date(a.endedAt||0)-new Date(b.endedAt||0));
  }

  function normalizedPersonNameParts(name){
    return String(name||'')
      .trim()
      .toLowerCase()
      .replace(/\s+/g,' ')
      .split(' ')
      .filter(Boolean);
  }

  function samePersonNameLoose(a,b){
    const pa=normalizedPersonNameParts(a);
    const pb=normalizedPersonNameParts(b);
    if(!pa.length || !pb.length)return false;
    if(pa.join(' ')===pb.join(' '))return true;
    return pa.length===2 && pb.length===2 && pa[0]===pb[1] && pa[1]===pb[0];
  }

  function findPlayerByLooseName(name){
    return Object.values(data.players||{}).find(p=>
      p && (
        samePersonNameLoose(p.name,name) ||
        samePersonNameLoose(playerDisplayName(p),name)
      )
    )||null;
  }

  function leagueCanonicalPlayerKey(id,name){
    const cleanId=String(id||'').trim();
    if(cleanId && data.players?.[cleanId])return 'id:'+cleanId;

    const canonicalName=leagueCanonicalAliasName(name);
    const normalized=leagueAliasKey(canonicalName);
    if(normalized){
      const p=findPlayerByLooseName(canonicalName);
      if(p?.id)return 'id:'+p.id;

      // Pokud nejde o profil, prosté prohození jména/příjmení je stále jedna osoba.
      // "Robert Paťcha" a "Paťcha Robert" proto dostanou stejný klíč.
      const parts=normalized.split(' ').filter(Boolean);
      if(parts.length===2)return 'name2:'+parts.slice().sort((a,b)=>a.localeCompare(b,'cs')).join('|');
    }
    return 'name:'+normalized;
  }

  function leaguePlayerStatsRows(){
    const facts=leagueFixtureMatchFacts();
    const rows=new Map();
    const elo=new Map();

    function ensureRow(id,name){
      const key=leagueCanonicalPlayerKey(id,name);
      const profileId=key.startsWith('id:')?key.slice(3):'';
      const p=profileId?data.players?.[profileId]:null;
      const canonicalName=leagueCanonicalAliasName(name)||name;
      const display=p?playerDisplayName(p):(canonicalName||'Neznámý hráč');

      if(!rows.has(key)){
        rows.set(key,{
          key,id:profileId||id||'',name:display,
          played:0,wins:0,losses:0,racksFor:0,racksAgainst:0,
          breakAndRun:0,runouts:0,elo:1500,singlesForElo:0
        });
      }else if(p){
        rows.get(key).id=p.id;
        rows.get(key).name=playerDisplayName(p);
      }

      if(!elo.has(key))elo.set(key,1500);
      return rows.get(key);
    }

    facts.forEach(f=>{
      const s0=Number(f.scores?.[0]||0),s1=Number(f.scores?.[1]||0);

      if(f.doubles){
        [0,1].forEach(side=>{
          const ids=f.teamPlayerIds?.[side]||[];
          const names=f.teamPlayerNames?.[side]||[];
          const n=Math.max(ids.length,names.length);
          for(let pos=0;pos<n;pos++){
            const id=ids[pos]||'';
            const name=(id&&data.players?.[id])?playerDisplayName(data.players[id]):(names[pos]||'Neznámý hráč');
            const r=ensureRow(id,name);
            r.played++;
            if(Number(f.winner)===side)r.wins++;else r.losses++;
            r.racksFor+=side===0?s0:s1;
            r.racksAgainst+=side===0?s1:s0;
          }
        });
        return;
      }

      const id0=f.playerIds?.[0]||'', id1=f.playerIds?.[1]||'';
      const n0=(id0&&data.players?.[id0])?playerDisplayName(data.players[id0]):(f.playerNames?.[0]||'Neznámý hráč');
      const n1=(id1&&data.players?.[id1])?playerDisplayName(data.players[id1]):(f.playerNames?.[1]||'Neznámý hráč');

      const r0=ensureRow(id0,n0), r1=ensureRow(id1,n1);

      r0.played++;r1.played++;
      if(Number(f.winner)===0){r0.wins++;r1.losses++;}else{r1.wins++;r0.losses++;}
      r0.racksFor+=s0;r0.racksAgainst+=s1;
      r1.racksFor+=s1;r1.racksAgainst+=s0;

      if(f.match && Array.isArray(f.stats)){
        r0.breakAndRun+=Number(f.stats?.[0]?.breakAndRun||0);
        r1.breakAndRun+=Number(f.stats?.[1]?.breakAndRun||0);
        r0.runouts+=Number(f.stats?.[0]?.runouts||0);
        r1.runouts+=Number(f.stats?.[1]?.runouts||0);
      }

      const k0=r0.key,k1=r1.key;
      const e0=elo.get(k0)??1500,e1=elo.get(k1)??1500;
      const exp0=1/(1+Math.pow(10,(e1-e0)/400));
      const score0=Number(f.winner)===0?1:0;
      elo.set(k0,e0+32*(score0-exp0));
      elo.set(k1,e1+32*((1-score0)-(1-exp0)));
      r0.singlesForElo++;r1.singlesForElo++;
    });

    rows.forEach(r=>{
      r.elo=Math.round(elo.get(r.key)??1500);
      r.winPct=r.played?Math.round(r.wins/r.played*100):0;
      r.rackDiff=r.racksFor-r.racksAgainst;
    });

    return {
      facts,
      rows:[...rows.values()].sort((a,b)=>
        b.wins-a.wins ||
        b.winPct-a.winPct ||
        b.rackDiff-a.rackDiff ||
        b.racksFor-a.racksFor ||
        a.name.localeCompare(b.name,'cs')
      )
    };
  }

  function renderLeaguePlayerStats(){
    const host=$('leaguePlayerStats');
    const count=$('leaguePlayerStatsCount');
    if(!host)return;
    const {facts,rows}=leaguePlayerStatsRows();
    if(count)count.textContent=facts.length+' '+(facts.length===1?'zápas':'zápasů');

    if(!rows.length){
      host.innerHTML='<div class="empty">Zatím není dohledatelný žádný odehraný zápas Ligy Sever.</div>';
      return;
    }

    const l=ensureLeagueSever();
    const completeFixtures=(l.fixtures||[]).filter(f=>
      (f.legs||[]).filter(x=>x?.status==='done'&&Array.isArray(x.score)).length===6
    ).length;
    const singlesCount=facts.filter(f=>!f.doubles).length;

    host.innerHTML=`<div class="subpanel" style="margin:0 0 10px;padding:8px 10px">
      <div class="muted" style="font-size:11px">
        Započítáno <strong>${singlesCount}</strong> dvouher z <strong>${completeFixtures}</strong> kompletních týmových utkání.
        Každé kompletní utkání obsahuje 6 dvouher, tedy 2 dvouhry na každého hráče v tříčlenné sestavě.
      </div>
    </div>
    <div style="overflow:auto">
      <table class="stats-table">
        <thead>
          <tr>
            <th>#</th><th>Hráč</th><th>O</th><th>V</th><th>P</th><th>Úsp.</th>
            <th>Racky</th><th>+/-</th><th>Čisté</th><th>Dohrávky</th><th>Ligové ELO</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r,i)=>`<tr>
            <td>${i+1}</td>
            <td class="${i===0?'league-standing-lead':''}"><strong>${esc(r.name)}</strong></td>
            <td>${r.played}</td>
            <td>${r.wins}</td>
            <td>${r.losses}</td>
            <td>${r.winPct} %</td>
            <td>${r.racksFor}:${r.racksAgainst}</td>
            <td>${r.rackDiff>0?'+':''}${r.rackDiff}</td>
            <td>${r.breakAndRun}</td>
            <td>${r.runouts}</td>
            <td>${r.elo}${r.singlesForElo?'':'*'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="muted" style="font-size:11px;margin-top:7px">
      * Bez odehrané dvouhry zůstává ligové ELO na výchozí hodnotě 1500.
      Čisté hry a dohrávky se zobrazí jen u zápasů, kde byly skutečně evidované počítadlem.
    </div>`;
  }

  function leagueStandingsRows(){
    const l=ensureLeagueSever();const rows=LEAGUE_SEVER_TEAMS.map(t=>({id:t.id,name:t.name,p:0,w:0,l:0,for:0,against:0}));const by=new Map(rows.map(r=>[r.id,r]));
    (l.fixtures||[]).filter(leagueFixtureComplete).forEach(f=>{const [h,a]=leagueFixtureScore(f),rh=by.get(f.homeId),ra=by.get(f.awayId);if(!rh||!ra)return;rh.p++;ra.p++;rh.for+=h;rh.against+=a;ra.for+=a;ra.against+=h;if(h>a){rh.w++;ra.l++;}else if(a>h){ra.w++;rh.l++;}});
    rows.sort((a,b)=>b.w-a.w||((b.for-b.against)-(a.for-a.against))||b.for-a.for||a.name.localeCompare(b.name,'cs'));return rows;
  }
  function renderLeagueStandings(){
    const el=$('leagueStandings');if(!el)return;const rows=leagueStandingsRows();
    el.innerHTML=`<div style="overflow:auto"><table class="stats-table"><thead><tr><th>#</th><th>Tým</th><th>O</th><th>V</th><th>P</th><th>Skóre</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td class="${i===0?'league-standing-lead':''}">${esc(r.name)}</td><td>${r.p}</td><td>${r.w}</td><td>${r.l}</td><td>${r.for}:${r.against}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function leagueLegDisplayName(f,leg,side){
    const ref=side===0?f.lineup?.home?.[leg.homeSlot]:f.lineup?.away?.[leg.awaySlot];
    return leaguePlayerNameFromRef(ref);
  }

  function leagueFixtureDetailRow(f,leg){
    const hn=leagueLegDisplayName(f,leg,0);
    const an=leagueLegDisplayName(f,leg,1);
    const done=leg.status==='done'&&Array.isArray(leg.score);
    const score=done?`${leg.score[0]} : ${leg.score[1]}`:'—';
    const saved=leg.matchId?(data.matches||[]).find(m=>m.id===leg.matchId):null;
    return `<div class="history-item" style="margin-bottom:8px">
      <div class="history-line">
        <div style="min-width:0">
          <div class="muted" style="font-size:10px">ZÁPAS ${esc(String(leg.index||''))} • 8-BALL</div>
          <div style="font-weight:900;margin-top:3px">${esc(hn)} vs ${esc(an)}</div>
        </div>
        <div class="history-score">${esc(score)}</div>
      </div>
      <div class="muted" style="margin-top:5px">${done?'DOKONČENO':(leg.status==='playing'?'ROZEHRÁNO':'ČEKÁ')}</div>
      ${saved?`<div class="item-actions" style="margin-top:8px"><button class="btn" onclick="showSavedMatchStats('${esc(saved.id)}')">STATISTIKY ZÁPASU</button></div>`:''}
    </div>`;
  }

  function leagueDeciderDetailRow(f){
    const d=f.decider;if(!d)return '';
    const home=(d.homePlayers||[]).map(leaguePlayerNameFromRef).join(' + ')||'Domácí dvojice';
    const away=(d.awayPlayers||[]).map(leaguePlayerNameFromRef).join(' + ')||'Hostující dvojice';
    const done=d.status==='done'&&Array.isArray(d.score);
    const score=done?`${d.score[0]} : ${d.score[1]}`:'—';
    const saved=d.matchId?(data.matches||[]).find(m=>m.id===d.matchId):null;
    return `<div class="history-item" style="margin-top:10px;border-color:rgba(212,175,55,.5)">
      <div class="history-line">
        <div style="min-width:0">
          <div class="muted" style="font-size:10px">ROZHODUJÍCÍ DVOJICE • 9-BALL</div>
          <div style="font-weight:900;margin-top:3px">${esc(home)} vs ${esc(away)}</div>
        </div>
        <div class="history-score">${esc(score)}</div>
      </div>
      <div class="muted" style="margin-top:5px">${done?'DOKONČENO':(d.status==='playing'?'ROZEHRÁNO':'ČEKÁ')}</div>
      ${saved?`<div class="item-actions" style="margin-top:8px"><button class="btn" onclick="showSavedMatchStats('${esc(saved.id)}')">STATISTIKY ZÁPASU</button></div>`:''}
    </div>`;
  }

  window.openLeagueFixtureDetail=function(fixtureId){
    const l=ensureLeagueSever();
    const f=(l.fixtures||[]).find(x=>x.id===fixtureId);
    if(!f)return toast('Ligové utkání nebylo nalezeno.');
    const [h,a]=leagueFixtureScore(f);
    $('leagueFixtureDetailTitle').textContent=leagueTeamName(f.homeId)+' '+h+' : '+a+' '+leagueTeamName(f.awayId);
    const legs=(f.legs||[]).slice().sort((x,y)=>Number(x.index||0)-Number(y.index||0));
    $('leagueFixtureDetailBody').innerHTML=`
      <div class="subpanel"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px">
        ${statBox('KOLO',f.round||'—')}${statBox('DATUM',f.date||'—')}${statBox('MÍSTO',f.place||'—')}${statBox('STAV',leagueResultStatusLabel(f))}
      </div></div>
      <div style="margin-top:12px"><div style="font-weight:950;font-size:17px;margin-bottom:8px">JEDNOTLIVÉ ZÁPASY</div>
        ${legs.length?legs.map(leg=>leagueFixtureDetailRow(f,leg)).join(''):'<div class="empty">Sestava ještě nebyla připravena.</div>'}
        ${f.decider?leagueDeciderDetailRow(f):''}
      </div>`;
    $('leagueFixtureDetailModal').classList.add('show');
  };

  if($('leagueFixtureDetailClose'))$('leagueFixtureDetailClose').onclick=()=>$('leagueFixtureDetailModal').classList.remove('show');

  function leagueResultStatusLabel(f){
    if(f.status==='pending')return 'ČEKÁ NA TERMÍN';if(f.status==='playing')return 'ROZEHRÁNO';if(f.status==='needs_decider')return '3:3 • ČEKÁ DVOJICE';
    if(f.status==='done'&&leagueFixtureConfirmed(f))return f.adminOverride?'POTVRZENO ADMINEM':'POTVRZENO OBĚMA KAPITÁNY';
    if(f.status==='done')return 'ČEKÁ NA POTVRZENÍ';return String(f.status||'');
  }
  function renderLeagueConfirmationActions(f){
    if(f.status!=='done'||leagueFixtureConfirmed(f))return '';
    if(currentUserIsSystemAdmin())return `<button class="btn primary" onclick="confirmLeagueFixture('${f.id}','${f.homeId}','confirmed')">POTVRDIT ADMINEM</button>`;
    const buttons=[];
    [f.homeId,f.awayId].forEach(teamId=>{
      if(!canConfirmLeagueSide(f,teamId))return;
      const c=leagueConfirmationFor(f,teamId);
      if(c?.status==='confirmed')buttons.push(`<span class="status-badge complete">${esc(leagueTeamName(teamId))}: potvrzeno</span>`);
      else buttons.push(`<button class="btn primary" onclick="confirmLeagueFixture('${f.id}','${teamId}','confirmed')">POTVRDIT ZA ${esc(leagueTeamName(teamId))}</button><button class="btn danger" onclick="confirmLeagueFixture('${f.id}','${teamId}','rejected')">NESOUHLASÍM</button>`);
    });
    return buttons.join(' ');
  }
  function renderLeagueFixture(f){
    const [hs,as]=leagueFixtureScore(f),canEdit=canEditLeagueFixture(f),confirmed=leagueFixtureConfirmed(f),locked=confirmed&&!currentUserIsSystemAdmin();
    const legs=(f.legs||[]).map(leg=>{const hp=f.lineup?.home?.[leg.homeSlot],ap=f.lineup?.away?.[leg.awaySlot];const done=leg.status==='done';let action='';
      if(done)action=`<strong>${leg.score?.[0]??0}:${leg.score?.[1]??0}</strong>${canEdit&&!locked?` <button class="btn ghost" style="padding:5px 8px" onclick="manualLeagueLegResult('${f.id}',${leg.index})">UPRAVIT</button>`:''}`;
      else if(canEdit)action=`<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><button class="btn primary" onclick="startLeagueLeg('${f.id}',${leg.index})">HRÁT</button><button class="btn" onclick="manualLeagueLegResult('${f.id}',${leg.index})">ZAPSAT</button></div>`;
      else action='<span class="muted">čeká</span>';
      return `<div class="league-leg"><div class="league-num"><strong>${leg.index}.</strong></div><div class="league-p1">${esc(hp?.displayName||hp?.name||'—')}</div><div class="league-vs muted">vs</div><div class="league-p2">${esc(ap?.displayName||ap?.name||'—')}</div><div class="league-start">${action}</div></div>`;}).join('');
    let dec='';
    if(f.status==='needs_decider'){
      const side=(arr,side)=>arr.map((p,i)=>`<label style="display:flex;align-items:center;gap:7px;margin:6px 0"><input style="width:auto" type="checkbox" id="leagueDec_${f.id}_${side}_${i}" ${canEdit?'':'disabled'}>${esc(p.displayName||p.name)}</label>`).join('');
      dec=`<div class="subpanel" style="margin-top:12px;border-color:#705820"><strong>Rozhodující dvojice • 9-ball • Kitchen rule</strong><div class="grid two" style="margin-top:10px"><div><div class="muted">${esc(leagueTeamName(f.homeId))} – vyber 2</div>${side(f.lineup.home,0)}</div><div><div class="muted">${esc(leagueTeamName(f.awayId))} – vyber 2</div>${side(f.lineup.away,1)}</div></div><div style="max-width:180px;margin-top:8px"><label>Race to</label><input id="leagueDecRace_${f.id}" type="number" min="1" value="3" ${canEdit?'':'disabled'}></div>${canEdit?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn primary big" onclick="startLeagueDecider('${f.id}')">HRÁT DVOJICE</button><button class="btn big" onclick="manualLeagueDeciderResult('${f.id}')">ZAPSAT RUČNĚ</button></div>`:''}</div>`;
    }else if(f.decider?.status==='done')dec=`<div class="subpanel" style="margin-top:10px"><strong>Dvojice:</strong> ${esc((f.decider.homePlayers||[]).map(x=>x.displayName||x.name).join(' + '))} <strong>${f.decider.score?.[0]??0}:${f.decider.score?.[1]??0}</strong> ${esc((f.decider.awayPlayers||[]).map(x=>x.displayName||x.name).join(' + '))}</div>`;
    const hc=leagueConfirmationFor(f,f.homeId),ac=leagueConfirmationFor(f,f.awayId);
    const conf=f.status==='done'?`<div class="muted" style="margin-top:8px">Potvrzení: ${esc(leagueTeamName(f.homeId))} ${hc?.status==='confirmed'?'✓':(hc?.status==='rejected'?'✕':'…')} • ${esc(leagueTeamName(f.awayId))} ${ac?.status==='confirmed'?'✓':(ac?.status==='rejected'?'✕':'…')}</div>`:'';
    const actions=renderLeagueConfirmationActions(f);
    return `<div class="league-fixture ${esc(f.status||'')}"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap"><div><span class="tournament-badge">kolo ${f.round}</span> <span class="tournament-badge ${confirmed?'gold':''}">${esc(leagueResultStatusLabel(f))}</span><div style="font-size:19px;font-weight:950;margin-top:7px">${esc(leagueTeamName(f.homeId))} <span class="league-team-score">${hs}:${as}</span> ${esc(leagueTeamName(f.awayId))}</div><div class="muted" style="margin-top:3px">${esc(f.date||'termín dle dohody')}${f.place?' • '+esc(f.place):''}</div>${conf}</div><div>${actions}</div></div>${legs?`<div style="margin-top:10px">${legs}</div>`:''}${dec}</div>`;
  }
  function renderLeagueCaptainAdmin(){
    const panel=$('leagueAdminCaptains'),wrap=$('leagueCaptainSelectors'); if(!panel||!wrap)return;
    panel.classList.toggle('hidden',!currentUserIsSystemAdmin()); if(!currentUserIsSystemAdmin())return;
    const accountMap=new Map();
    Object.entries(adminRegisteredUsersCache||{}).forEach(([uid,u])=>{
      if(!uid||!u||typeof u!=='object')return; const p=registeredUserLinkedPlayer(uid,u);
      accountMap.set(uid,{uid,playerId:p?.id||u.playerId||'',label:p?playerSelectionLabel(p):(u.email||uid),hasProfile:!!p});
    });
    Object.values(data.players||{}).filter(p=>p&&p.ownerUid&&p.active!==false&&p.hiddenFromPlayers!==true).forEach(p=>{
      if(!accountMap.has(p.ownerUid))accountMap.set(p.ownerUid,{uid:p.ownerUid,playerId:p.id,label:playerSelectionLabel(p),hasProfile:true});
    });
    const candidates=[...accountMap.values()].sort((a,b)=>a.label.localeCompare(b.label,'cs'));
    wrap.innerHTML=LEAGUE_SEVER_TEAMS.map(t=>{const cfg=leagueConfigTeams?.[t.id]||{};return `<div><label>${esc(t.name)}</label><select id="leagueCaptain_${t.id}"><option value="">— bez kapitána —</option>${candidates.map(c=>`<option value="${esc(c.uid)}" data-player-id="${esc(c.playerId||'')}" data-user-label="${esc(c.label)}" ${cfg.captainUid===c.uid?'selected':''}>${esc(c.label)}${c.hasProfile?'':' • ÚČET BEZ PROFILU'}</option>`).join('')}</select></div>`;}).join('');
    if(!Object.keys(adminRegisteredUsersCache||{}).length&&!adminRegisteredUsersLoading){loadAllRegisteredUsers(false).then(()=>renderLeagueCaptainAdmin()).catch(e=>console.warn('League users:',e));}
  }
  async function saveLeagueCaptains(){
    if(!currentUserIsSystemAdmin())return;
    LEAGUE_SEVER_TEAMS.forEach(t=>{const sel=$(`leagueCaptain_${t.id}`),opt=sel?.selectedOptions?.[0];const uidv=sel?.value||'';const pid=opt?.dataset?.playerId||'';const p=pid?data.players?.[pid]:null;const lbl=opt?.dataset?.userLabel||'';leagueConfigTeams[t.id]={id:t.id,name:t.name,captainUid:uidv,captainPlayerId:pid,captainName:p?playerSelectionLabel(p):lbl};});
    try{await saveLeagueConfigTeamsCloud();toast('Kapitáni byli uloženi.');renderLeague();try{renderRegisteredUsersAdmin(false);}catch(e){}}catch(e){console.error(e);toast('Kapitány se nepodařilo uložit. Zkontroluj Firebase Rules.');}
  }
  function renderLeague(){
    const l=ensureLeagueSever();
    if(currentUserIsSystemAdmin()&&!Object.keys(adminRegisteredUsersCache||{}).length&&!adminRegisteredUsersLoading){loadAllRegisteredUsers(false).then(()=>renderLeagueCaptainAdmin()).catch(e=>console.warn('League users:',e));}
    renderLeagueCaptainAdmin();renderLeaguePlayerAliasesAdmin();updateLeagueSelectors();renderLeagueStandings();renderLeaguePlayerStats();
    const myTeams=leagueCurrentCaptainTeamIds().map(leagueTeamName);
    if($('leagueEditPermissionInfo'))$('leagueEditPermissionInfo').textContent=currentUserIsSystemAdmin()?'Jsi systémový administrátor • můžeš zapisovat všechna utkání.':(myTeams.length?'Jsi kapitán: '+myTeams.join(', ')+' • můžeš zapisovat pouze utkání svého týmu.':'Výsledky může zapisovat pouze kapitán některého z týmů nebo administrátor.');
    const confirmed=(l.fixtures||[]).filter(leagueFixtureConfirmed).length, waiting=(l.fixtures||[]).filter(f=>f.status==='done'&&!leagueFixtureConfirmed(f)).length,active=(l.fixtures||[]).filter(f=>f.status==='playing'||f.status==='needs_decider').length,remaining=(l.fixtures||[]).filter(f=>f.status==='pending').length;
    if($('leagueSummary'))$('leagueSummary').innerHTML=`<div class="league-kpi"><strong>${confirmed}</strong><span class="muted">potvrzeno</span></div><div class="league-kpi"><strong>${waiting}</strong><span class="muted">čeká potvrzení</span></div><div class="league-kpi"><strong>${active}</strong><span class="muted">rozehráno</span></div><div class="league-kpi"><strong>${remaining}</strong><span class="muted">zbývá</span></div>`;
    const act=(l.fixtures||[]).filter(f=>f.status!=='pending'&&!leagueFixtureConfirmed(f));if($('leagueActiveFixtures'))$('leagueActiveFixtures').innerHTML=act.length?act.map(renderLeagueFixture).join(''):'<div class="empty">Žádné rozehrané ani nepotvrzené ligové utkání.</div>';
    if($('leagueSchedule'))$('leagueSchedule').innerHTML=(l.fixtures||[]).slice().sort((a,b)=>a.round-b.round||a.id.localeCompare(b.id)).map(f=>{const [h,a]=leagueFixtureScore(f);return `<div class="history-item"><div class="history-line"><div><span class="tournament-badge">kolo ${f.round}</span><div style="font-weight:900;margin-top:5px">${esc(leagueTeamName(f.homeId))} – ${esc(leagueTeamName(f.awayId))}</div></div><div class="history-score">${f.status==='pending'?'—':h+':'+a}</div></div><div class="muted" style="margin-top:5px">${esc(leagueResultStatusLabel(f))}</div><div class="item-actions" style="margin-top:8px"><button class="btn" onclick="openLeagueFixtureDetail('${f.id}')">DETAIL UTKÁNÍ</button></div></div>`;}).join('');
  }
  window.startLeagueLeg=startLeagueLeg;window.startLeagueDecider=startLeagueDecider;window.manualLeagueLegResult=manualLeagueLegResult;window.manualLeagueDeciderResult=manualLeagueDeciderResult;window.confirmLeagueFixture=confirmLeagueFixture;
  if($('leagueHomeTeam'))$('leagueHomeTeam').onchange=updateLeagueSelectors;
  if($('leagueAwayTeam'))$('leagueAwayTeam').onchange=updateLeagueSelectors;
  if($('leaguePrepareBtn'))$('leaguePrepareBtn').onclick=prepareLeagueFixture;
  if($('leagueSaveCaptainsBtn'))$('leagueSaveCaptainsBtn').onclick=saveLeagueCaptains;
  if($('leagueAliasSource'))$('leagueAliasSource').onchange=()=>{
    const src=$('leagueAliasSource').value||'';
    if(src && $('leagueAliasTarget') && !$('leagueAliasTarget').value)$('leagueAliasTarget').value=leagueCanonicalAliasName(src)||src;
  };
  if($('leagueAliasSaveBtn'))$('leagueAliasSaveBtn').onclick=async()=>{
    if(!currentUserIsSystemAdmin())return;
    const source=String($('leagueAliasSource')?.value||'').trim();
    const target=String($('leagueAliasTarget')?.value||'').trim();
    if(!source||!target)return toast('Vyber chybné jméno a zadej správné jméno.');
    if(leagueAliasKey(source)===leagueAliasKey(target))return toast('Zdroj a cílové jméno jsou stejné.');
    leaguePlayerAliases[leagueAliasKey(source)]=target;
    try{
      await saveLeaguePlayerAliasesCloud();
      $('leagueAliasTarget').value='';
      renderLeague();
      toast('Ligový alias byl uložen a statistiky přepočítány.');
    }catch(e){console.error(e);toast('Alias se nepodařilo uložit.');}
  };

  if($('leagueRefreshBtn'))$('leagueRefreshBtn').onclick=async()=>{
    await Promise.allSettled([loadSecureMatches(),loadLeagueCloud(true)]);
    renderLeague();
    toast('Liga a statistiky hráčů byly obnoveny z cloudu.');
  };


  if($('activeTournamentSaveRulesBtn'))$('activeTournamentSaveRulesBtn').onclick=saveActiveTournamentRules;
  if($('activeTournamentEditCancelBtn'))$('activeTournamentEditCancelBtn').onclick=closeActiveTournamentEdit;

  if($('groupPlayoffSeedMode'))$('groupPlayoffSeedMode').onchange=()=>{
    const manual=$('groupPlayoffSeedMode').value==='manual';
    $('groupPlayoffSeedRulesBox').classList.toggle('hidden',manual);
    $('groupPlayoffManualBox').classList.toggle('hidden',!manual);

    if(manual){
      const t=(data.tournaments||[]).find(x=>x.id===groupPlayoffSeedTournamentId);
      if(t)buildManualGroupSeedEditor(t);
    }
  };
  // Handler tlačítka NASADIT DO PLAY-OFF se váže přímo při otevření modalu.
  // Tím se eliminuje problém se ztraceným/pozdně vytvořeným globálním handlerem.
  if($('groupPlayoffSeedCancelBtn'))$('groupPlayoffSeedCancelBtn').onclick=()=>{
    $('groupPlayoffSeedModal').classList.remove('show');
    groupPlayoffSeedTournamentId=null;
  };

  if($('swissScoreSaveBtn'))$('swissScoreSaveBtn').onclick=saveSwissScore;
  if($('swissScoreCancelBtn'))$('swissScoreCancelBtn').onclick=()=>{
    $('swissScoreModal').classList.remove('show');
    swissScoreContext=null;
  };

  if($('historicalEditApplyBtn'))$('historicalEditApplyBtn').onclick=applyHistoricalTournamentReseed;
  if($('historicalEditCancelBtn'))$('historicalEditCancelBtn').onclick=()=>{
    $('tournamentHistoricalEditModal').classList.remove('show');
    historicalEditTournamentId=null;
  };
  if($('historicalTournamentScoreSaveBtn'))$('historicalTournamentScoreSaveBtn').onclick=saveHistoricalTournamentScore;
  if($('historicalTournamentScoreCancelBtn'))$('historicalTournamentScoreCancelBtn').onclick=()=>{
    $('historicalTournamentScoreModal').classList.remove('show');
    historicalScoreContext=null;
  };

  async function refreshTournamentById(tournamentId,buttonEl=null){
    if(!tournamentId)return;
    const btn=buttonEl||null;
    if(btn)btn.disabled=true;

    try{
      await loadSecureMatches();
      await loadSecureTournaments();

      let repaired=reconcileTournamentResultsFromMatches(tournamentId);
      const syncedTournament=(data.tournaments||[]).find(x=>x.id===tournamentId);

      if(syncedTournament && rebuildSKOStateFromFinishedMatches(syncedTournament)){
        repaired=true;
      }

      if(repaired && syncedTournament){
        try{
          await saveSecureTournament(syncedTournament);
        }catch(e){
          console.error('Tournament repair save:',e);
        }
      }

      renderTournament();
      renderResultsTournaments();
      if(selectedTournamentId===tournamentId){
        renderTournamentDetail();
      }

      toast(syncedTournament?.status==='complete'
        ? 'Turnaj dokončen • konečné výsledky byly obnoveny.'
        : 'Aktuální výsledky turnaje byly načteny.');
    }catch(e){
      console.error('Tournament refresh:',e);
      toast('Turnaj se nepodařilo aktualizovat.');
    }finally{
      if(btn)btn.disabled=false;
    }
  }

  window.refreshTournamentById=refreshTournamentById;

  function renderTournament(){
    if(!$('tournamentPlayerDropdown')) return;
    if(!tournamentCheckinDraftRestored){
      restoreTournamentCheckinDraft();
      tournamentCheckinDraftRestored=true;
    }
    reconcileTournamentResultsFromMatches();
    renderTournamentPlayerPicker();
    renderSeriesList();
    renderTournamentSeriesSelect();
    updateTournamentCreateButtonLabel();
    updateTournamentNineBallBreakRuleVisibility();

    const tournamentFormatValue=$('tournamentFormat').value;
    const groupMode=['groups','groups_sko','groups_dko'].includes(tournamentFormatValue);
    $('tournamentGroupCountField').classList.toggle('hidden',!groupMode || tournamentFormatValue==='groups');
    const hybridGroupMode=['groups_sko','groups_dko'].includes(tournamentFormatValue);
    if($('tournamentPlayoffDisciplineField'))$('tournamentPlayoffDisciplineField').classList.toggle('hidden',!hybridGroupMode);
    if($('tournamentDisciplineLabel'))$('tournamentDisciplineLabel').textContent=groupMode?'Disciplína skupin':'Disciplína';
    if($('tournamentAdvanceField'))$('tournamentAdvanceField').classList.toggle('hidden',!hybridGroupMode);
    if($('tournamentThirdPlaceField'))$('tournamentThirdPlaceField').classList.toggle('hidden',tournamentFormatValue==='groups');
    renderTournamentSeriesSelect();

    const tournaments=(data.tournaments||[]).slice().sort((a,b)=>
      new Date(b.createdAt||0)-new Date(a.createdAt||0)
    );
    const active=tournaments.filter(t=>t.status!=='complete');

    const activeWrap=$('tournamentActiveList');

    const cardHtml=(t,archived=false)=>{
      const all=allTournamentMatches(t);
      const done=all.filter(m=>m.status==='done'||m.winnerId||m.loserId).length;
      const playing=all.filter(m=>m.status==='playing').length;
      const status=archived?'DOKONČENO':(playing?'PROBÍHÁ':'PŘIPRAVENO');
      const created=t.createdAt
        ? new Date(t.createdAt).toLocaleDateString('cs-CZ')
        : '';

      return `<div class="subpanel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:220px">
            <div style="font-size:23px;font-weight:950">${esc(t.name||'Turnaj')}</div>
            <div class="muted" style="margin-top:5px">
              ${esc(tournamentFormatLabel(t))} • ${esc(tournamentDisciplineSummary(t))} • Race to ${t.raceTo}${t.nineBallBreakRule&&t.nineBallBreakRule!=='none'?' • '+esc(nineBallBreakRuleLabel(t.nineBallBreakRule)):''}
              • odehráno ${done}/${all.length}${playing?` • právě hraje ${playing}`:''}${created?` • ${created}`:''}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <span class="tournament-badge ${archived?'gold':''}">${status}</span>
            ${archived?'':`<button class="btn" onclick="refreshTournamentById('${t.id}',this)">↻ AKTUALIZOVAT</button>`}
            <button class="btn primary" onclick="openTournamentDetail('${t.id}')">${archived?'VÝSLEDKY':'OTEVŘÍT TURNAJ'}</button>
          </div>
        </div>
      </div>`;
    };

    if(activeWrap){
      activeWrap.innerHTML=active.length
        ? active.map(t=>cardHtml(t,false)).join('')
        : '<div class="muted">Momentálně není rozehraný žádný turnaj.</div>';
    }


  }

  $('tournamentFormat').addEventListener('change',()=>{
    const f=$('tournamentFormat').value;
    const groupMode=['groups_sko','groups_dko'].includes(f);
    const swissMode=f==='swiss';
    $('tournamentGroupCountField').classList.toggle('hidden',!groupMode);
    $('tournamentSwissRoundsField')?.classList.toggle('hidden',!swissMode);
    $('tournamentThirdPlaceField')?.classList.toggle('hidden',swissMode);
    $('tournamentDkoSkoCutField')?.classList.toggle('hidden',f!=='dko');
    if($('tournamentAdvanceField'))$('tournamentAdvanceField').classList.toggle('hidden',!groupMode);
    if($('tournamentPlayoffDisciplineField'))$('tournamentPlayoffDisciplineField').classList.toggle('hidden',!groupMode);
    if($('tournamentDisciplineLabel'))$('tournamentDisciplineLabel').textContent=groupMode?'Disciplína skupin':'Disciplína';
    if(groupMode && $('tournamentPlayoffDiscipline') && !$('tournamentPlayoffDiscipline').dataset.touched){
      $('tournamentPlayoffDiscipline').value=$('tournamentDiscipline').value;
    }
    renderTournamentSeedOrder();
  });

  if($('tournamentPlayoffDiscipline')){
    $('tournamentPlayoffDiscipline').addEventListener('change',()=>{
      $('tournamentPlayoffDiscipline').dataset.touched='1';
      updateTournamentNineBallBreakRuleVisibility();
    });
  }
  if($('tournamentDiscipline')){
    $('tournamentDiscipline').addEventListener('change',()=>{
      updateTournamentNineBallBreakRuleVisibility();
      if($('tournamentPlayoffDiscipline') && !$('tournamentPlayoffDiscipline').dataset.touched){
        $('tournamentPlayoffDiscipline').value=$('tournamentDiscipline').value;
      }
    });
  }

  

  function currentUserIsSystemAdmin(){
    // Administrátorská práva platí jen pro aktivně přihlášený a ověřený účet.
    // Nestačí zbytková role nebo e-mail uložený v runtime/localStorage.
    if(!cloudAuthenticated || !cloudUid || !cloudEmailVerified) return false;
    if(currentUserRole==='system_admin') return true;
    const email=typeof cloudUserEmail==='string' ? cloudUserEmail.trim().toLowerCase() : '';
    return email===MAIN_ADMIN_EMAIL;
  }

  function populateMergePlayerSelectors(){
    const src=$('mergePlayerSource'),dst=$('mergePlayerTarget');
    if(!src||!dst)return;
    const players=Object.values(data.players||{}).filter(Boolean).sort((a,b)=>playerSelectionLabel(a).localeCompare(playerSelectionLabel(b),'cs'));
    const html='<option value="">— vyber profil —</option>'+players.map(p=>`<option value="${esc(p.id)}">${esc(playerSelectionLabel(p))}${p.active===false?' • NEAKTIVNÍ':''}</option>`).join('');
    src.innerHTML=html; dst.innerHTML=html;
  }

  function replacePlayerIdDeep(obj,sourceId,targetId,targetName){
    if(!obj || typeof obj!=='object')return false;
    let changed=false;
    const walk=(x,key,parent)=>{
      if(Array.isArray(x)){
        for(let i=0;i<x.length;i++){
          if(x[i]===sourceId){x[i]=targetId;changed=true;}
          else if(x[i]&&typeof x[i]==='object')walk(x[i],i,x);
        }
      }else if(x&&typeof x==='object'){
        Object.keys(x).forEach(k=>{
          if((k==='playerId'||k==='id'||k==='winnerId'||k==='loserId') && x[k]===sourceId){x[k]=targetId;changed=true;}
          else if(x[k]&&typeof x[k]==='object')walk(x[k],k,x);
        });
      }
    };
    walk(obj,null,null);
    return changed;
  }

  async function mergePlayerProfiles(sourceId,targetId){
    if(!currentUserIsSystemAdmin())throw new Error('NO_ADMIN');
    if(!sourceId||!targetId||sourceId===targetId)throw new Error('INVALID_PLAYER_MERGE');
    const source=data.players?.[sourceId],target=data.players?.[targetId];
    if(!source||!target)throw new Error('PLAYER_NOT_FOUND');
    const targetName=playerDisplayName(target);

    for(const m of (data.matches||[])){
      let changed=false;
      if(Array.isArray(m.playerIds)){
        m.playerIds=m.playerIds.map(id=>{if(id===sourceId){changed=true;return targetId;}return id;});
      }
      if(Array.isArray(m.teamPlayerIds)){
        m.teamPlayerIds=m.teamPlayerIds.map(side=>Array.isArray(side)?side.map(id=>{if(id===sourceId){changed=true;return targetId;}return id;}):side);
      }
      if(changed){
        if(Array.isArray(m.playerNames)&&Array.isArray(m.playerIds))m.playerNames=m.playerNames.map((n,i)=>m.playerIds[i]===targetId?targetName:n);
        if(Array.isArray(m.teamPlayerNames)&&Array.isArray(m.teamPlayerIds))m.teamPlayerNames=m.teamPlayerNames.map((side,si)=>Array.isArray(side)?side.map((n,pi)=>m.teamPlayerIds?.[si]?.[pi]===targetId?targetName:n):side);
        try{await saveSecureMatch(m);}catch(e){console.warn('merge match',m.id,e);}
      }
    }

    for(const t of (data.tournaments||[])){
      const copy=JSON.parse(JSON.stringify(t));
      if(replacePlayerIdDeep(copy,sourceId,targetId,targetName)){
        try{await saveSecureTournament(copy);}catch(e){console.warn('merge tournament',t.id,e);}
      }
    }

    const league=ensureLeagueSever();
    for(const f of (league.fixtures||[])){
      const copy=JSON.parse(JSON.stringify(f));
      let changed=replacePlayerIdDeep(copy,sourceId,targetId,targetName);
      ['home','away'].forEach(side=>{
        (copy.lineup?.[side]||[]).forEach(p=>{
          if(p && (p.id===targetId||p.playerId===targetId)){
            p.name=targetName;p.displayName=targetName;changed=true;
          }
        });
      });
      if(changed){Object.assign(f,copy);try{await saveLeagueFixtureCloud(f);}catch(e){console.warn('merge league',f.id,e);}}
    }

    if(source.ownerUid){
      try{const rec=await adminUserRecordRequest(source.ownerUid,'GET')||{};rec.playerId=targetId;await adminUserRecordRequest(source.ownerUid,'PUT',rec);}catch(e){console.warn('merge user',e);}
    }
    if(!target.ownerUid&&source.ownerUid)target.ownerUid=source.ownerUid;
    target.active=true;
    await saveSecurePlayer(target);

    source.active=false;
    source.hiddenFromPlayers=true;
    source.mergedIntoPlayerId=targetId;
    source.mergedAt=new Date().toISOString();
    source.mergedByUid=cloudUid||'';
    await saveSecurePlayer(source);
    data.players[targetId]=target;data.players[sourceId]=source;
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
  }

  if($('mergePlayersBtn'))$('mergePlayersBtn').onclick=async()=>{
    const sourceId=$('mergePlayerSource')?.value||'';
    const targetId=$('mergePlayerTarget')?.value||'';
    const info=$('mergePlayersInfo');
    if(!sourceId||!targetId){if(info)info.textContent='Vyber oba profily.';return;}
    if(sourceId===targetId){if(info)info.textContent='Musí jít o dva různé profily.';return;}
    const s=data.players?.[sourceId],t=data.players?.[targetId];
    if(!s||!t)return;
    if(!confirm('Sloučit „'+playerSelectionLabel(s)+'“ do „'+playerSelectionLabel(t)+'“?'))return;
    $('mergePlayersBtn').disabled=true;if(info)info.textContent='Slučuji…';
    try{
      await mergePlayerProfiles(sourceId,targetId);
      await Promise.allSettled([loadSecurePlayers(),loadSecureMatches(),loadSecureTournaments(),loadLeagueCloud(true)]);
      renderPlayers();renderStats();renderLeague();populateMergePlayerSelectors();
      if(info)info.textContent='Profily byly sloučeny.';
      toast('Duplicitní hráč byl sloučen.');
    }catch(e){console.error(e);if(info)info.textContent='Sloučení selhalo: '+String(e.message||e);}
    finally{$('mergePlayersBtn').disabled=false;}
  };

  function populateAdminProfileOwnerSelect(){
    const sel=$('adminProfileOwnerSelect');
    const info=$('adminProfileOwnerInfo');
    if(!sel || !info)return;

    const entries=Object.values(data.players||{})
      .filter(Boolean)
      .sort((a,b)=>playerDisplayName(a).localeCompare(playerDisplayName(b),'cs'));

    const previous=sel.value;
    sel.innerHTML=entries.map(p=>{
      const inactive=p.active===false?' • NEAKTIVNÍ':'';
      const hidden=p.hiddenFromPlayers===true?' • SKRYTÝ':'';
      return `<option value="${esc(p.id)}">${esc(playerDisplayName(p))}${inactive}${hidden} • ${esc(p.id)}</option>`;
    }).join('');

    if(previous && entries.some(p=>p.id===previous)) sel.value=previous;

    const update=()=>{
      const p=data.players?.[sel.value];
      if(!p){
        info.value='—';
        if($('adminRepairFirstName')) $('adminRepairFirstName').value='';
        if($('adminRepairLastName')) $('adminRepairLastName').value='';
        if($('adminRepairClub')) $('adminRepairClub').value='';
        return;
      }

      info.value=p.ownerUid ? 'Přiřazen k účtu • UID '+p.ownerUid : 'Profil je volný';
      $('adminRepairFirstName').value=p.firstName||p.name?.split(' ')?.[0]||'';
      $('adminRepairLastName').value=p.lastName||((p.name||'').split(' ').slice(1).join(' '))||'';
      $('adminRepairClub').value=p.club||'';
      const hideBtn=$('adminToggleHiddenProfileBtn');
      if(hideBtn){
        hideBtn.textContent=p.hiddenFromPlayers===true ? 'ZOBRAZIT PROFIL MEZI HRÁČI' : 'SKRÝT PROFIL Z HRÁČŮ';
      }
    };

    sel.onchange=update;
    update();
  }

  async function saveAdminProfileRepair(){
    if(!currentUserIsSystemAdmin()){
      toast('Tuto akci může provést pouze systémový administrátor.');
      return;
    }

    const sel=$('adminProfileOwnerSelect');
    const playerId=sel?.value;
    const p=data.players?.[playerId];
    if(!p){
      toast('Vyber profil.');
      return;
    }

    const firstName=($('adminRepairFirstName').value||'').trim();
    const lastName=($('adminRepairLastName').value||'').trim();
    const club=($('adminRepairClub').value||'').trim();

    if(!firstName || !lastName){
      toast('Vyplň jméno a příjmení.');
      return;
    }

    const updated={
      ...p,
      firstName,
      lastName,
      name:(firstName+' '+lastName).trim(),
      club,
      active:p.active!==false,
      updatedAt:new Date().toISOString()
    };

    try{
      await saveSecurePlayer(updated);
      data.players[playerId]=updated;
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      populateAdminProfileOwnerSelect();
      renderPlayers();
      refreshPlayerList();
      updateLoggedInUserBadge();

      toast('Profil byl opraven.');
    }catch(e){
      console.error('Admin profile repair:',e);
      toast('Profil se nepodařilo uložit: '+String(e.message||e));
    }
  }



  async function toggleSelectedProfileHidden(){
    if(!currentUserIsSystemAdmin()){
      toast('Tuto akci může provést pouze systémový administrátor.');
      return;
    }

    const sel=$('adminProfileOwnerSelect');
    const playerId=sel?.value;
    const p=data.players?.[playerId];
    if(!p){
      toast('Vyber profil.');
      return;
    }

    const hide=p.hiddenFromPlayers!==true;
    const updated={
      ...p,
      hiddenFromPlayers:hide,
      updatedAt:new Date().toISOString()
    };

    try{
      await saveSecurePlayer(updated);
      data.players[playerId]=updated;
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      populateAdminProfileOwnerSelect();
      refreshPlayerList();
      renderPlayers();
      renderStats();
      renderTournament();
      renderLive();

      toast(hide ? 'Profil je skrytý z běžných seznamů hráčů.' : 'Profil je znovu viditelný mezi hráči.');
    }catch(e){
      console.error('Toggle hidden profile:',e);
      toast('Změnu se nepodařilo uložit: '+String(e.message||e));
    }
  }

  async function releaseSelectedProfileOwner(){
    if(!currentUserIsSystemAdmin()){
      toast('Tuto akci může provést pouze systémový administrátor.');
      return;
    }

    const sel=$('adminProfileOwnerSelect');
    const playerId=sel?.value;
    const p=data.players?.[playerId];

    if(!p){
      toast('Vyber profil.');
      return;
    }

    if(!p.ownerUid){
      toast('Tento profil už je volný.');
      return;
    }

    if(!confirm('Opravdu uvolnit vlastníka profilu „'+playerDisplayName(p)+'“? Profil pak nebude patřit žádnému účtu, dokud si ho správný uživatel znovu nenárokuje.'))return;

    const oldOwnerUid=p.ownerUid;

    try{
      const updated={...p};
      delete updated.ownerUid;
      updated.updatedAt=new Date().toISOString();

      await saveSecurePlayer(updated);

      data.players[playerId]=updated;

      // Pokud je v uživatelském mapování nějaký účet navázaný na tento profil,
      // zkusíme vazbu odstranit pouze pokud to dovolí stávající backend.
      try{
        await clearUserPlayerLink(oldOwnerUid, playerId);
      }catch(e){
        console.warn('User/player link cleanup skipped:',e);
      }

      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      populateAdminProfileOwnerSelect();
      renderPlayers();
      toast('Profil byl uvolněn. Správný uživatel si ho nyní může nárokovat svým účtem.');
    }catch(e){
      console.error('Release profile owner:',e);
      toast('Profil se nepodařilo uvolnit: '+String(e.message||e));
    }
  }


  if($('adminSaveProfileRepairBtn')){
    $('adminSaveProfileRepairBtn').onclick=saveAdminProfileRepair;
  }

  if($('adminToggleHiddenProfileBtn')){
    $('adminToggleHiddenProfileBtn').onclick=toggleSelectedProfileHidden;
  }

  if($('adminReleaseProfileBtn')){
    $('adminReleaseProfileBtn').onclick=releaseSelectedProfileOwner;
  }

  if($('cleanupEmptyTournamentsBtn')){
    $('cleanupEmptyTournamentsBtn').onclick=cleanupEmptyTournaments;
  }

  if($('submitReportBtn'))$('submitReportBtn').onclick=submitProblemReport;
  if($('refreshMyReportsBtn'))$('refreshMyReportsBtn').onclick=()=>loadOwnReports();
  if($('refreshReportsAdminBtn'))$('refreshReportsAdminBtn').onclick=loadReportsAdmin;

  if($('toggleSeriesCreateBtn'))$('toggleSeriesCreateBtn').onclick=()=> $('seriesCreatePanel').classList.toggle('hidden');
  if($('seriesModalClose'))$('seriesModalClose').onclick=()=> $('seriesModal').classList.remove('show');
  if($('seriesModal'))$('seriesModal').addEventListener('click',e=>{if(e.target===$('seriesModal'))$('seriesModal').classList.remove('show');});
  function updateSeriesScoringCreateUI(){
    const custom=$('seriesScoringMode')?.value==='custom';
    $('seriesBandsScoringFields')?.classList.toggle('hidden',custom);
    $('seriesCustomScoringFields')?.classList.toggle('hidden',!custom);
  }
  if($('seriesScoringMode')){
    $('seriesScoringMode').addEventListener('change',updateSeriesScoringCreateUI);
    updateSeriesScoringCreateUI();
  }

  if($('createSeriesBtn'))$('createSeriesBtn').onclick=()=>{
    const name=$('seriesName').value.trim();
    const club=$('seriesClub').value.trim();
    const season=$('seriesSeason').value.trim();
    if(!name||!club){toast('Vyplň název série a klub.');return;}
    const scoringMode=$('seriesScoringMode')?.value||'bands';
    const customPointsText=($('seriesCustomPoints')?.value||'').trim();
    if(scoringMode==='custom' && !Object.keys(parseCustomSeriesPoints(customPointsText).exact).length && !parseCustomSeriesPoints(customPointsText).ranges.length){
      toast('Zadej alespoň jedno vlastní bodové pravidlo, např. 1=100.');
      return;
    }
    const s={
      id:uid(),createdByUid:cloudUid||'',managerUids:{},name,club,season,
      bestCount:Math.max(0,Number($('seriesBestCount').value||0)),
      placementTieBreak:$('seriesPlacementTieBreak')?.value||'legacy',
      scoringMode,
      pointsTop:parsePointList($('seriesPointsTop').value,[100,80,65,55]),
      pointsBands:parsePointList($('seriesPointsBands').value,[45,25,10,5]),
      customPointsText,
      customPoints:parseCustomSeriesPoints(customPointsText),
      tournamentIds:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()
    };
    data.tournamentSeries.push(s);
    saveData();
    $('seriesCreatePanel').classList.add('hidden');
    renderSeriesList();renderTournamentSeriesSelect();
    toast('Série byla vytvořena.');
  };

  function ensureTournamentParticipants(t,selectedIds){
    if(!t || !Array.isArray(selectedIds))return false;
    const expected=[...new Set(selectedIds.filter(Boolean))];
    let changed=false;

    if(!Array.isArray(t.playerIds))t.playerIds=[];
    expected.forEach(id=>{
      if(!t.playerIds.includes(id)){
        t.playerIds.push(id);
        changed=true;
      }
    });

    // U již vytvořených počátečních stavů opravíme seznam účastníků.
    if(t.ko){
      t.ko.participantIds=Array.isArray(t.ko.participantIds)?t.ko.participantIds:[];
      expected.forEach(id=>{
        if(!t.ko.participantIds.includes(id)){
          t.ko.participantIds.push(id);
          changed=true;
        }
      });
    }

    if(t.dko){
      t.dko.participantIds=Array.isArray(t.dko.participantIds)?t.dko.participantIds:[];
      t.dko.losses=t.dko.losses||{};
      expected.forEach(id=>{
        if(!t.dko.participantIds.includes(id)){
          t.dko.participantIds.push(id);
          changed=true;
        }
        if(t.dko.losses[id]==null)t.dko.losses[id]=0;
      });
    }

    return changed;
  }

  if($('tournamentEntryFee'))$('tournamentEntryFee').addEventListener('input',()=>{renderTournamentCheckinSummary();});
  if($('tournamentPrizeMode'))$('tournamentPrizeMode').addEventListener('change',()=>{tournamentPrizeMoney.mode=$('tournamentPrizeMode').value==='fixed'?'fixed':'percent';syncTournamentPrizeMoneyForm();});
  if($('tournamentPrizeReturnPercent'))$('tournamentPrizeReturnPercent').addEventListener('input',()=>{tournamentPrizeMoney.returnPercent=Math.max(0,Math.min(100,Number($('tournamentPrizeReturnPercent').value||0)));renderTournamentPrizeMoney();});
  if($('tournamentPrizeFixedAmount'))$('tournamentPrizeFixedAmount').addEventListener('input',()=>{tournamentPrizeMoney.fixedAmount=Math.max(0,Number($('tournamentPrizeFixedAmount').value||0));renderTournamentPrizeMoney();});
  if($('tournamentPrizeBonus'))$('tournamentPrizeBonus').addEventListener('input',()=>{tournamentPrizeMoney.bonus=Math.max(0,Number($('tournamentPrizeBonus').value||0));renderTournamentPrizeMoney();});
  if($('tournamentAddPrizePlaceBtn'))$('tournamentAddPrizePlaceBtn').onclick=()=>{normalizeTournamentPrizeMoney();tournamentPrizeMoney.payouts.push({label:(tournamentPrizeMoney.payouts.length+1)+'. místo',count:1,percent:0});renderTournamentPrizeMoney();};
  if($('tournamentCloseCheckinBtn'))$('tournamentCloseCheckinBtn').onclick=()=>{
    const ids=tournamentAllCheckinIds();
    if(!ids.length){toast('Nejdřív zapiš příchozí hráče.');return;}
    const paid=tournamentPaidPlayerIds();
    const unpaid=ids.filter(id=>!paid.includes(id));
    if(unpaid.length && !confirm('Nezaplaceno má '+unpaid.length+' hráčů. Po uzavření prezence nebudou zařazeni do turnaje. Pokračovat?'))return;
    if(paid.length<2){toast('Zaplaceno musí mít alespoň 2 hráči.');return;}
    tournamentCheckinClosed=true;
    manualTournamentSeedOrder=[...paid];
    tournamentDrawNumbers={};
    renderTournamentPlayerPicker();
    updateTournamentCreateButtonLabel();
    toast('Prezence uzavřena • účastníků: '+paid.length);
  };
  if($('tournamentReopenCheckinBtn'))$('tournamentReopenCheckinBtn').onclick=()=>{
    if(Object.keys(tournamentDrawNumbers).length && !confirm('Znovu otevřít prezenci? Dosavadní elektronický los bude zrušen.'))return;
    tournamentCheckinClosed=false;
    tournamentDrawNumbers={};
    manualTournamentSeedOrder=[];
    renderTournamentPlayerPicker();
    updateTournamentCreateButtonLabel();
    toast('Prezence znovu otevřena.');
  };
  if($('tournamentMarkAllPaidBtn'))$('tournamentMarkAllPaidBtn').onclick=()=>{
    if(tournamentCheckinClosed)return;
    tournamentAllCheckinIds().forEach(id=>{ensureTournamentCheckinEntry(id);tournamentCheckin[id].paid=true;});
    invalidateTournamentDraw();
    renderTournamentPlayerPicker();
  };

$('createTournamentBtn').onclick=async()=>{
    if(!tournamentCheckinClosed){toast('Nejdřív uzavři prezenci.');return;}
    normalizeTournamentPrizeMoney();
    const prizePct=tournamentPrizeTotalPercent();
    if(tournamentPrizePool()>0 && Math.abs(prizePct-100)>0.001){toast('Rozdělení prize money musí být přesně 100 %. Aktuálně: '+prizePct.toLocaleString('cs-CZ',{maximumFractionDigits:2})+' %.');return;}
    if(tournamentPrizeMoney.mode==='fixed' && tournamentPrizeMoney.fixedAmount>tournamentPrizeCollected()){
      toast('Pevná částka ze startovného je vyšší než aktuálně vybrané startovné. Rozdíl zadej jako bonus klubu / sponzora.');return;
    }
    let ids=tournamentPaidPlayerIds(),format=$('tournamentFormat').value;
    const seedingMode=$('tournamentSeedingMode')?.value||'random';
    const thirdPlacePlayoff=['sko','dko','groups_sko','groups_dko'].includes(format) && $('tournamentThirdPlacePlayoff')?.value==='yes';

    if(seedingMode==='manual'){
      const selectedSet=new Set(ids);
      const ordered=manualTournamentSeedOrder.filter(id=>selectedSet.has(id));
      ids.forEach(id=>{if(!ordered.includes(id))ordered.push(id);});
      // Ruční nasazení se použije přesně v pořadí zobrazeném v seznamu.
      // V této větvi se hráči už nikde náhodně nemíchají.
      ids=ordered;
    }

    if(seedingMode==='draw' || seedingMode==='draw_individual'){
      if(!tournamentDrawIsComplete(ids)){
        toast('Nejdřív vylosuj čísla pro všechny vybrané hráče.');
        renderTournamentSeedOrder();
        return;
      }
      ids=tournamentIdsSortedByDraw(ids);
    }

    if(['dko','sko'].includes(format)&&ids.length<4){toast('Pro vyřazovací turnaj vyber alespoň 4 hráče.');return;}
    if(format==='groups'&&ids.length<2){toast('Pro formát každý s každým vyber alespoň 2 hráče.');return;}
    if(['groups_sko','groups_dko'].includes(format)&&ids.length<4){toast('Pro skupinový turnaj vyber alespoň 4 hráče.');return;}
    if(format==='swiss'&&ids.length<4){toast('Pro švýcarský systém vyber alespoň 4 hráče.');return;}
    if(format==='swiss'){
      const swissAdvance=Math.max(0,parseInt($('tournamentSwissAdvanceCount')?.value||'0',10));
      if(swissAdvance>ids.length){
        toast('Do SKO nemůže postupovat více hráčů, než je účastníků turnaje.');
        return;
      }
    }
    const name=$('tournamentName').value.trim()||('Turnaj '+new Date().toLocaleDateString('cs-CZ'));
    const discipline=$('tournamentDiscipline').value;
    const playoffDiscipline=['groups_sko','groups_dko'].includes(format)
      ? ($('tournamentPlayoffDiscipline')?.value||discipline)
      : discipline;
    const raceTo=Math.max(1,parseInt($('tournamentRace').value||'5',10)),breakMode=$('tournamentBreakMode').value;
    const handicapTournament=!!$('tournamentHandicapEnabled')?.checked;
    if(handicapTournament){
      const stageVals=[$('tournamentRace')?.value,$('raceGroup')?.value,$('raceLast32')?.value,$('raceLast16')?.value,$('raceLast8')?.value,$('raceSemifinal')?.value,$('raceFinal')?.value]
        .map(v=>Number(v||0)).filter(v=>Number.isFinite(v)&&v>0);
      const minRace=stageVals.length?Math.min(...stageVals):raceTo;
      const invalid=ids.find(id=>tournamentPlayerHandicap(id)>=minRace);
      if(invalid){toast('Handicap hráče '+tournamentPlayerName(invalid)+' musí být nižší než nejnižší Race to ('+minRace+').');return;}
    }
    const tableCount=Math.max(1,Math.min(32,parseInt($('tournamentTableCount').value||'1',10)));
    const selectedGuestIds=new Set(ids.filter(id=>id.startsWith('guest_')));
    const guests={};
    tournamentGuestDrafts.forEach(g=>{
      if(selectedGuestIds.has(g.id)) guests[g.id]={name:g.name,preserveGuest:true};
    });
    let groupCount=Math.max(1,parseInt($('tournamentGroupCount').value||'2',10));
    if(format==='groups')groupCount=1;
    let advancePerGroup=Math.max(1,parseInt($('tournamentAdvanceCount').value||'2',10));
    if(['groups_sko','groups_dko'].includes(format)){
      const smallestGroup=Math.floor(ids.length/groupCount);
      if(smallestGroup<1){toast('Počet skupin je příliš vysoký.');return;}
      advancePerGroup=Math.min(advancePerGroup,smallestGroup);
    }
    const dkoSkoCut=format==='dko' ? Math.max(0,Number($('tournamentDkoSkoCut')?.value||0)) : 0;
    if(format==='dko' && dkoSkoCut>0 && dkoSkoCut>=ids.length){
      toast('Přechod na SKO musí být nižší než počet účastníků. Pro '+ids.length+' hráčů zvol menší Last X nebo celý turnaj DKO.');
      return;
    }
    let t;
    const manualBracketOrder=seedingMode==='manual' ? [...ids] : [];
    if(format==='dko') t=generateDKOTournament(name,ids,discipline,raceTo,breakMode,guests,tableCount,seedingMode,thirdPlacePlayoff,dkoSkoCut);
    else if(format==='sko') t=generateSKOTournament(name,ids,discipline,raceTo,breakMode,guests,tableCount,seedingMode,thirdPlacePlayoff);
    else if(format==='swiss') t=generateSwissTournament(
      name,ids,discipline,raceTo,breakMode,guests,tableCount,seedingMode,
      Math.max(0,parseInt($('tournamentSwissRounds')?.value||'0',10)),
      Math.max(0,parseInt($('tournamentSwissAdvanceCount')?.value||'0',10))
    );
    else if(format==='groups') t=generateGroupTournament(name,ids,discipline,raceTo,breakMode,groupCount,guests,tableCount,seedingMode);
    else if(format==='groups_dko') t=generateHybridTournament(name,ids,discipline,raceTo,breakMode,groupCount,advancePerGroup,'dko',guests,tableCount,seedingMode,thirdPlacePlayoff);
    else t=generateHybridTournament(name,ids,discipline,raceTo,breakMode,groupCount,advancePerGroup,'sko',guests,tableCount,seedingMode,thirdPlacePlayoff);

    ensureTournamentParticipants(t,ids);
    t.handicapEnabled=handicapTournament;
    t.playerHandicaps={};
    if(handicapTournament) ids.forEach(id=>{t.playerHandicaps[id]=tournamentPlayerHandicap(id);});

    if(seedingMode==='draw' || seedingMode==='draw_individual'){
      t.drawNumbers={};
      ids.forEach(id=>t.drawNumbers[id]=Number(tournamentDrawNumbers[id]));
      t.drawOrder=[...ids];
    }

    // Bezpečnostní kontrola: každý vybraný účastník musí být uložen v turnaji.
    const missingParticipants=ids.filter(id=>!t.playerIds.includes(id));
    if(missingParticipants.length){
      toast('Chyba při rozlosování: některý hráč se nepodařil zařadit.');
      console.error('Missing tournament participants:',missingParticipants);
      return;
    }

    if(manualBracketOrder.length)t.manualSeedOrder=[...manualBracketOrder];
    if(seedingMode==='manual' && ['groups','groups_sko','groups_dko'].includes(format)){
      t.manualGroupSeedOrder=[...ids];
    }

    if(['groups_sko','groups_dko'].includes(format)){
      t.groupDiscipline=discipline;
      t.playoffDiscipline=playoffDiscipline;
      // t.discipline zůstává kvůli zpětné kompatibilitě disciplínou skupin.
      t.discipline=discipline;
    }

    t.nineBallBreakRule=$('tournamentNineBallBreakRule')?.value||'none';
    t.variableRaceEnabled=!!$('tournamentVariableRace')?.checked;
    t.raceByStage=tournamentRaceStageSettingsFromForm()||{};
    t.groupAdvanceTieRule=$('tournamentGroupAdvanceTieRule')?.value||'points';
    t.groupPenaltyTieBreak=!!$('tournamentPenaltyTieBreak')?.checked && ['groups_sko','groups_dko'].includes(format);
    t.groupPenaltyWinners={};
    t.checkin={
      closed:true,
      entryFee:Math.max(0,Number($('tournamentEntryFee')?.value||0)),
      totalArrived:tournamentAllCheckinIds().length,
      paidPlayerIds:[...ids],
      unpaidPlayerIds:tournamentAllCheckinIds().filter(id=>!ids.includes(id)),
      paidCount:ids.length,
      closedAt:new Date().toISOString()
    };
    const prizeCollected=tournamentPrizeCollected();
    const prizeFromEntries=tournamentPrizeBaseFromEntries(prizeCollected);
    const prizeBonus=Math.max(0,Number(tournamentPrizeMoney.bonus||0));
    const prizePool=prizeFromEntries+prizeBonus;
    t.prizeMoney={
      mode:tournamentPrizeMoney.mode,
      entryFee:t.checkin.entryFee,
      collected:prizeCollected,
      returnPercent:tournamentPrizeMoney.returnPercent,
      fixedAmount:tournamentPrizeMoney.fixedAmount,
      fromEntries:prizeFromEntries,
      organizerAmount:Math.max(0,prizeCollected-prizeFromEntries),
      bonus:prizeBonus,
      total:prizePool,
      payouts:tournamentPrizeMoney.payouts.map(row=>({label:String(row.label||''),count:Math.max(1,Number(row.count||1)),percent:Math.max(0,Number(row.percent||0)),amountPerPlayer:prizePool*Math.max(0,Number(row.percent||0))/100})),
      configuredAt:new Date().toISOString()
    };


    t.publicInfo={
      date:String($('tournamentPublicDate')?.value||''),
      time:String($('tournamentPublicTime')?.value||''),
      venue:String($('tournamentPublicVenue')?.value||'').trim(),
      address:String($('tournamentPublicAddress')?.value||'').trim(),
      capacity:Math.max(0,Number($('tournamentPublicCapacity')?.value||0)),
      registrationUrl:String($('tournamentPublicRegistrationUrl')?.value||'').trim(),
      contact:String($('tournamentPublicContact')?.value||'').trim(),
      prizes:String($('tournamentPublicPrizes')?.value||'').trim(),
      description:String($('tournamentPublicDescription')?.value||'').trim()
    };
    if(!Array.isArray(t.registrations))t.registrations=[];

    const selectedSeriesId=$('tournamentSeriesSelect')?.value||'';
    // Nejprve vytvořený turnaj držíme lokálně, aby nezmizel z UI.
    const existingIndex=(data.tournaments||[]).findIndex(x=>x.id===t.id);
    if(existingIndex>=0) data.tournaments[existingIndex]=t;
    else data.tournaments.push(t);

    tournamentGuestDrafts=[];
    tournamentSelectedPlayerIds=[];
    manualTournamentSeedOrder=[];
    tournamentDrawNumbers={};
    tournamentCheckin={};
    tournamentCheckinClosed=false;
    if($('tournamentHandicapEnabled'))$('tournamentHandicapEnabled').checked=false;
    tournamentPrizeMoney={mode:'percent',returnPercent:100,fixedAmount:0,bonus:0,payouts:[{label:'1. místo',count:1,percent:50},{label:'2. místo',count:1,percent:30},{label:'3. místo',count:1,percent:20}]};
    clearTournamentCheckinDraft();
    if($('tournamentEntryFee'))$('tournamentEntryFee').value='0';
    syncTournamentPrizeMoneyForm();
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    renderTournament();

    const btn=$('createTournamentBtn');
    if(btn)btn.disabled=true;
    toast(seedingMode==='manual'
      ? 'Vytvářím turnaj dle ručního nasazení…'
      : (seedingMode==='elo'
          ? 'Vytvářím turnaj dle ELO…'
          : ((seedingMode==='draw'||seedingMode==='draw_individual') ? 'Vytvářím turnaj dle vylosovaných čísel…' : 'Rozlosovávám turnaj…')));

    try{
      const saved=await saveSecureTournament(t);

      if(selectedSeriesId){
        const s=(data.tournamentSeries||[]).find(x=>x.id===selectedSeriesId);
        if(s && !s.tournamentIds.includes(saved.id)){
          s.tournamentIds.push(saved.id);
          s.updatedAt=new Date().toISOString();
          saveData();
        }
      }

      selectedTournamentId=saved.id;
      updateCurrentTournamentShortcut();

      renderTournament();
      await openTournamentDetail(saved.id);

      toast(seedingMode==='manual'
        ? 'Turnaj byl nasazen dle ručního pořadí a uložen.'
        : (seedingMode==='elo'
            ? 'Turnaj byl nasazen dle ELO a uložen.'
            : ((seedingMode==='draw'||seedingMode==='draw_individual') ? 'Turnaj byl nasazen podle vylosovaných čísel a uložen.' : 'Turnaj byl rozlosován a uložen.')));
    }catch(e){
      console.error('Tournament save:',e);

      // Lokální kopii ponecháme zobrazenou. Uživatel ji neztratí.
      renderTournament();
      toast('Turnaj se nepodařilo uložit do cloudu. Zůstává lokálně – zkontroluj připojení a zkus SYNCHRONIZOVAT.');
    }finally{
      updateTournamentCreateButtonLabel();
    }

    saveData();
  };

  window.deleteTournament=async function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t)return;

    if(!canManageTournamentOrganizers(t)){
      toast('Turnaj může smazat pouze jeho zakladatel nebo administrátor.');
      return;
    }

    if(!confirm('Opravdu smazat turnaj „'+t.name+'“? Uložené jednotlivé zápasy v historii zůstanou zachované.'))return;

    try{
      await deleteSecureTournament(tid);
      data.tournaments=(data.tournaments||[]).filter(x=>x.id!==tid);
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      await loadSecureTournaments();

      if(selectedTournamentId===tid) selectedTournamentId=null;
      renderTournament();
      showScreen('tournament');
      toast('Turnaj byl smazán.');
    }catch(e){
      console.error('Tournament delete:',e);
      toast('Turnaj se nepodařilo smazat: '+String(e.message||e));
    }
  };

  window.deleteTournamentWithMatches=async function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t)return;

    if(!canManageTournamentOrganizers(t)){
      toast('Turnaj může smazat pouze jeho zakladatel nebo administrátor.');
      return;
    }

    const linked=(data.matches||[]).filter(m=>m.tournamentLink && m.tournamentLink.tournamentId===tid);
    const count=linked.length;

    if(!confirm(
      'Opravdu smazat turnaj „'+t.name+'“ VČETNĚ '+count+' uložených zápasů?'+
      (count ? '\n\nTím se odstraní i jejich statistiky a ELO.' : '')
    ))return;

    try{
      // Nejprve smažeme případné samostatně uložené zápasy.
      for(const m of linked){
        await deleteSecureMatch(m.id);
      }

      // Potom smažeme samotný turnaj z /tournaments.
      await deleteSecureTournament(tid);

      data.matches=(data.matches||[]).filter(m=>!(m.tournamentLink && m.tournamentLink.tournamentId===tid));
      data.tournaments=(data.tournaments||[]).filter(x=>x.id!==tid);

      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      // Ověření skutečného stavu cloudu.
      await Promise.all([
        loadSecureMatches(),
        loadSecureTournaments()
      ]);

      if(selectedTournamentId===tid) selectedTournamentId=null;
      renderTournament();
      showScreen('tournament');
      renderHistory();
      renderStats();
      renderPlayers();

      toast(count ? 'Turnaj i jeho zápasy byly smazány.' : 'Turnaj byl smazán.');
    }catch(e){
      console.error('Tournament delete with matches:',e);
      toast('Mazání se nepodařilo dokončit: '+String(e.message||e));
    }
  };

  window.startTournamentMatch=async function(tid,tmid){
    // Pokud na telefonu zůstal ukončený zápas, bezpečně ho zahodíme.
    if(match && match.endedAt){
      removeDeviceActiveMatch(match.id);
      match=null;
      saveDeviceActiveMatch(null);
    }

    if(match){
      toast('Na tomto telefonu už je rozehraný zápas. Pro další stůl použij jiný telefon.');
      return;
    }

    let t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t){
      try{
        await loadSecureTournaments();
        t=(data.tournaments||[]).find(x=>x.id===tid);
      }catch(e){}
    }
    if(!t){
      toast('Turnaj nebyl nalezen.');
      return;
    }

    if(!canManageTournament(t)){
      toast('Tento turnaj může ovládat pouze jeho zakladatel nebo administrátor.');
      return;
    }

    // Pevná návratová vazba pro celý sled turnajových zápasů.
    forcedTournamentReturnId=t.id;
    selectedTournamentId=t.id;

    let tm=findTournamentMatch(t,tmid);
    if(!tm){
      // Jednorázově načteme čerstvou verzi turnaje a zkusíme stejný zápas znovu.
      try{
        await loadSecureTournaments();
        t=(data.tournaments||[]).find(x=>x.id===tid);
        tm=t ? findTournamentMatch(t,tmid) : null;
      }catch(e){}
    }
    if(!tm){
      toast('Turnajový zápas nebyl nalezen. Obnovuji turnaj.');
      renderTournament();
      return;
    }

    if(tm.status==='done' || tm.winnerId || tm.loserId){
      toast('Tento turnajový zápas už je dohraný.');
      return;
    }

    if(tournamentMatchHasBusyPlayer(t,tm)){
      const busyNames=[];
      if(tournamentPlayerBusy(t,tm.player1Id,tm.id)) busyNames.push(tournamentPlayerName(tm.player1Id,t));
      if(tournamentPlayerBusy(t,tm.player2Id,tm.id)) busyNames.push(tournamentPlayerName(tm.player2Id,t));

      toast('Zápas nelze zahájit. '+busyNames.join(' a ')+' už '+(busyNames.length>1?'hrají':'hraje')+' na jiném stole.');
      assignTournamentTables(t);
      renderTournament();
      return;
    }

    // Znovu přepočítáme doporučené stoly.
    assignTournamentTables(t);

    // Stůl je skutečně obsazený pouze zápasem se stavem playing.
    const busyTables=tournamentBusyTables(t);
    if(tm.tableNumber && busyTables.has(Number(tm.tableNumber))){
      tm.tableNumber=null;
      tm.status='pending';
    }

    if(!tm.tableNumber){
      const free=nextFreeTournamentTable(t);
      if(free){
        tm.tableNumber=free;
        tm.status='assigned';
      }
    }

    if(!tm.tableNumber){
      toast('Všechny stoly jsou právě obsazené rozehranými zápasy.');
      return;
    }

    if(t.dko){
      repairDKOInvalidFutureMatches(t);
      if(dkoPlayerIsOut(t,tm.player1Id)||dkoPlayerIsOut(t,tm.player2Id)){
        toast('Tento zápas je neplatný – jeden z hráčů už je z DKO vyřazen.');
        return;
      }
    }

    const p1=tournamentParticipant(t,tm.player1Id);
    const p2=tournamentParticipant(t,tm.player2Id);

    pendingTournamentLink={
      tournamentId:t.id,
      tournamentMatchId:tm.id,
      p1ParticipantId:tm.player1Id,
      p2ParticipantId:tm.player2Id,
      p1Guest:!!p1.guest,
      p2Guest:!!p2.guest,
      tableNumber:tm.tableNumber,
      raceTo:tournamentRaceForMatch(t,tm),
      discipline:tournamentDisciplineForMatch(t,tm),
      nineBallBreakRule:t.nineBallBreakRule||'none',
      handicapEnabled:!!t.handicapEnabled,
      p1Handicap:Math.max(0,Number(t.playerHandicaps?.[tm.player1Id]||0)),
      p2Handicap:Math.max(0,Number(t.playerHandicaps?.[tm.player2Id]||0))
    };

    $('p1Name').value=p1.name;
    $('p2Name').value=p2.name;
    $('p1PartnerName').value='';
    $('p2PartnerName').value='';
    $('doublesMode').checked=false;
    $('p3Name').value='';
    const matchDiscipline=tournamentDisciplineForMatch(t,tm);
    $('discipline').value=matchDiscipline;
    const matchRaceTo=tournamentRaceForMatch(t,tm);
    $('raceTo').value=matchRaceTo;
    $('breakMode').value=t.breakMode;
    if($('nineBallBreakRule'))$('nineBallBreakRule').value=t.nineBallBreakRule||'none';
    $('ghostMode').checked=false;
    $('winnerTableMode').checked=false;
    $('solo14').checked=false;
    $('useLag').checked=true;
    $('ghostRow').style.display='none';
    $('winnerTableRow').classList.add('hidden');
    $('streamMatchTitle').value=t.name+' • '+(tm.roundLabel||'turnaj')+' • Stůl '+tm.tableNumber;

    updateDisciplineSetup();

    tm.status='playing';

    // Jakmile se tento zápas skutečně rozběhne, ostatním čekajícím zápasům
    // odebereme případnou stejnou vizuální rezervaci stolu.
    allTournamentMatches(t).forEach(other=>{
      if(other.id!==tm.id && other.status!=='playing' && Number(other.tableNumber||0)===Number(tm.tableNumber||0)){
        other.tableNumber=null;
        if(other.status==='assigned')other.status='pending';
      }
    });

    // Turnajový zápas používá pravidla turnaje automaticky.
    // Není potřeba znovu potvrzovat disciplínu, Race to ani rozstřel v obecném setupu.
    saveData();

    // Cloud uložení nesmí blokovat samotné spuštění zápasu.
    saveSecureTournament(t).catch(e=>{
      console.error('Tournament playing save:',e);
      toast('Zápas běží, ale stav turnaje se nepodařilo uložit do cloudu.');
    });

    ensureAudio();
    startMatch();
  };

  function showTournamentResultMessage(title,html){
    postMatchReturnScreen='tournament';
    $('tournamentResultTitle').textContent=title||'';
    $('tournamentResultBody').innerHTML=html||'';
    $('tournamentResultModal').classList.add('show');
  }

  $('tournamentResultOk').onclick=()=>{
    $('tournamentResultModal').classList.remove('show');

    const targetTournamentId=postMatchTournamentId||selectedTournamentId||null;

    renderTournament();

    if(targetTournamentId){
      selectedTournamentId=targetTournamentId;
      forcedTournamentReturnId=targetTournamentId;
      updateCurrentTournamentShortcut();

      const t=(data.tournaments||[]).find(x=>x.id===targetTournamentId);
      if(t){
        renderTournamentDetail();
        showScreen('tournament-detail');
        if(t.groupPenaltyTieBreak && groupPhaseComplete(t) && !t.playoffStarted){
          setTimeout(()=>openGroupPenaltyPrompt(t),80);
        }
      }else{
        showScreen('tournament');
        toast('Turnaj se nepodařilo znovu načíst.');
      }

      Promise.allSettled([loadSecureMatches(),loadSecureTournaments()])
        .then(()=>{
          try{
            reconcileTournamentResultsFromMatches(targetTournamentId);
            if(selectedTournamentId===targetTournamentId){
              renderTournament();
              renderTournamentDetail();
            }
          }catch(e){
            console.error('Tournament result background refresh:',e);
          }
        });
    }else{
      showScreen('tournament');
    }

    postMatchReturnScreen=null;
    postMatchTournamentId=null;
    // forcedTournamentReturnId zůstává pro navazující zápasy stejného turnaje.
  };

  function dkoPlacementRange(place){
    const p=Math.max(1,Number(place||0));
    if(p<=2)return {from:p,to:p};

    if(p<=4)return {from:3,to:4};

    let upper=8;
    while(p>upper)upper*=2;
    return {from:(upper/2)+1,to:upper};
  }

  function dkoPlacementLabel(t,place,playerId=null){
    const p=Math.max(1,Number(place||0));

    if(p===1)return '1. místo';
    if(p===2)return '2. místo';

    // Pokud se nehraje bronze match, 3. a 4. pozice jsou dvě rovnocenná 3. místa.
    if(p<=4 && !t?.dko?.thirdPlacePlayoff)return '3. místo';

    // Při zápasu o 3. místo známe 3./4. přesně až po jeho dohrání.
    if(p<=4 && t?.dko?.thirdPlacePlayoff){
      if(playerId && t.dko.thirdPlaceWinnerId===playerId)return '3. místo';
      if(playerId && t.dko.thirdPlaceLoserId===playerId)return '4. místo';
      return 'čeká na zápas o 3. místo';
    }

    const r=dkoPlacementRange(p);
    return r.from+'.–'+r.to+'. místo';
  }

  function dkoThirdPlaceCandidates(t){
    if(!t?.dko?.eliminations)return [];

    // Poslední dva hráči vyřazení před Grand Final tvoří dvojici pro bronze match.
    return [...t.dko.eliminations]
      .filter(e=>e && e.playerId)
      .sort((a,b)=>Number(a.place||999)-Number(b.place||999))
      .filter(e=>Number(e.place||999)<=4)
      .slice(0,2)
      .map(e=>e.playerId);
  }

  function dkoThirdPlaceMatch(t){
    if(!t?.dko?.rounds)return null;
    for(const r of t.dko.rounds){
      const m=(r.matches||[]).find(x=>x.bracket==='3P');
      if(m)return m;
    }
    return null;
  }

