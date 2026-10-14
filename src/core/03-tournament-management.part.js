  async function autoFinalizeTournamentMatch(){
    if(tournamentAutoFinalizeInProgress || !match?.tournamentLink)return;
    tournamentAutoFinalizeInProgress=true;

    const tournamentId=match.tournamentLink.tournamentId;
    forcedTournamentReturnId=tournamentId;
    postMatchReturnScreen='tournament';
    postMatchTournamentId=tournamentId;

    try{
      const ok=await persistFinishedMatch();
      if(!ok){
        // Nenechávat uživatele na zamrzlém ukončeném zápase.
        if(match){
          match.endedAt=null;
          match.status=null;
          match.winner=null;
          startLiveHeartbeat();
          renderMatch();
          autosaveCurrent();
        }
        tournamentAutoFinalizeInProgress=false;
        toast('Výsledek se nepodařilo uložit do turnaje. Zápas jsem znovu odemkl.');
        return;
      }

      removeDeviceActiveMatch(statsCardMatch?.id || match?.id);
      const justSavedWasIncomplete=(match.status==='incomplete');
      match=null;
      // U NEDOHRANÉHO ponechává persistFinishedMatch snapshot v mapě rozehraných zápasů.
      // Pouze zrušíme ukazatel právě otevřeného zápasu.
      saveDeviceActiveMatch(null);
      statsCardMatch=null;
      statsCardIsCurrent=false;
      $('matchStatsModal').classList.remove('show');
      $('winnerModal').classList.remove('show');

      renderHistory();
      renderStats();
      renderPlayers();

      try{
        await loadSecureMatches();
        await loadSecureTournaments();
        reconcileTournamentResultsFromMatches(tournamentId);
      }catch(e){
        console.error('Tournament auto-finalize refresh:',e);
      }

      renderTournament();
      await returnToTournamentDetail(tournamentId);

      // Pokud processTournamentResult vytvořil informační okno výsledku,
      // necháme jej nad detailem turnaje zobrazené.
      toast('Výsledek uložen. Pokračuj v turnaji.');
    }finally{
      tournamentAutoFinalizeInProgress=false;
      postMatchReturnScreen=null;
      postMatchTournamentId=null;
    }
  }


  function linkedTournamentIdForMatch(m){
    return m?.tournamentLink?.tournamentId || null;
  }

  function showTournamentReturnButtonForMatch(m){
    const btn=$('backToTournamentAfterMatchBtn');
    if(!btn)return;
    const tid=linkedTournamentIdForMatch(m);
    btn.classList.toggle('hidden',!tid);
    if(tid){
      btn.textContent='ZPĚT DO TURNAJE';
      btn.dataset.tournamentId=tid;
    }else{
      delete btn.dataset.tournamentId;
    }
  }

  function returnToTournamentAfterMatch(){
    const btn=$('backToTournamentAfterMatchBtn');
    const tid=btn?.dataset?.tournamentId || linkedTournamentIdForMatch(match);
    if(!tid){
      toast('Turnaj se nepodařilo určit.');
      return;
    }

    selectedTournamentId=tid;
    forcedTournamentReturnId=tid;

    // Zavřeme případné výsledkové okno.
    document.querySelectorAll('.modal.show').forEach(el=>el.classList.remove('show'));

    // Načteme detail turnaje a zobrazíme jej.
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(t){
      showScreen('tournament-detail');
      renderTournamentDetail();
    }else{
      showScreen('tournament');
      renderTournament();
      toast('Turnaj se obnovuje. Pokud se detail nezobrazí, použij AKTUALIZOVAT.');
    }
  }

  if($('backToTournamentAfterMatchBtn')){
    $('backToTournamentAfterMatchBtn').onclick=returnToTournamentAfterMatch;
  }

  function finishMatch(winner,manual=false){
    if(!match)return;
    if(match.endedAt && match.status==='complete')return;
    stopTimer();
    stopLiveHeartbeat();
    match.endedAt=new Date().toISOString();
    if(!manual) match.status='complete';
    if(!match.status) match.status=manual?'incomplete':'complete';
    if(winner!==null) match.winner=winner;
    else match.winner=null;
    logEvent(manual?'Zápas ukončen ručně':'Zápas dokončen');
        showTournamentReturnButtonForMatch(match);

$('winnerText').textContent = match.solo14
      ? (match.solo14GhostMode
          ? (match.status==='incomplete'
              ? '14.1 sólo proti Ghostovi ukončeno za stavu '+match.scores[0]+':'+match.scores[1]+'.'
              : (match.winner===0
                  ? match.playerNames[0]+' poráží Ghosta • '+solo14GhostDifficultyLabel(match,false)+' • '+match.scores[0]+':'+match.scores[1]
                  : 'Ghost vítězí • '+solo14GhostDifficultyLabel(match,false)+' • '+match.scores[1]+':'+match.scores[0]))
          : (match.status==='incomplete'
              ? 'Sólo trénink ukončen se skóre '+match.scores[0]+'.'
              : 'Sólo 14.1 dokončeno • '+match.playerNames[0]+' • '+match.scores[0]+' bodů'))
      : (match.ghostMode
          ? 'Ghost session ukončena • '+match.playerNames[0]+' '+match.scores[0]+' : '+match.scores[1]+' GHOST'
          : (match.winnerTableMode
            ? 'Vítěz na stole ukončen • '+match.winnerTable.players.map((p,i)=>p.displayName+' '+(match.winnerTable.wins[i]||0)+' výher').join(' • ')
            : (match.status==='incomplete'
          ? 'Nedohraný zápas bude uložen za stavu '+match.scores[0]+':'+match.scores[1]+' a nebude započítán do dlouhodobých statistik.'
          : (winner===null
            ? 'Zápas ukončen za stavu '+match.scores[0]+':'+match.scores[1]
            : match.playerNames[winner]+' vítězí '+match.scores[0]+':'+match.scores[1]))));

    // Nejdřív překreslíme FINÁLNÍ skóre. renderMatch() už zápas znovu
    // neukončí, protože endedAt/status jsou nastavené výše. Tím se nestane,
    // že při race to 7 zůstane na počítadle vizuálně posledních 6 bodů.
    renderMatch();

    // Každý dokončený zápas potom automaticky ukáže finální rekapitulaci.
    // Analytický panel je doplněk; případná chyba v něm nesmí zablokovat
    // samotné dokončení ani zobrazení výsledku.
    try{
      openMatchStatsCard(match,true);
    }catch(err){
      console.error('Finální rekapitulace zápasu se nepodařila vykreslit:',err);
      try{
        statsCardMatch=match;
        statsCardIsCurrent=true;
        $('matchStatsTitle').textContent='REKAPITULACE ZÁPASU';
        $('matchStatsResult').textContent=match.playerNames[0]+' '+match.scores[0]+' : '+match.scores[1]+' '+match.playerNames[1];
        $('matchStatsBody').innerHTML=
          '<div class="subpanel" style="text-align:center">'+
          '<div style="font-size:20px;font-weight:950">🏆 '+esc(match.winner===0?match.playerNames[0]:match.playerNames[1])+'</div>'+
          '<div class="muted" style="margin-top:6px">Zápas dokončen • '+esc(String(match.scores[0]))+':'+esc(String(match.scores[1]))+'</div>'+
          '</div>'+playerStatsCardNormal(match,0)+playerStatsCardNormal(match,1);
        $('matchStatsUndo').classList.remove('hidden');
        $('matchStatsClose').textContent=match.tournamentLink?'ULOŽIT VÝSLEDEK A ZPĚT DO TURNAJE':'ULOŽIT A ZAVŘÍT';
        $('winnerModal').classList.remove('show');
        $('matchStatsModal').classList.add('show');
      }catch(fallbackErr){
        console.error('Ani záložní rekapitulaci se nepodařilo vykreslit:',fallbackErr);
        $('winnerModal').classList.add('show');
      }
    }
  }

  $('winnerShare').onclick=()=>shareMatchStats(match);

  $('winnerUndo').onclick=()=>{
    if(!match) return;
    // Re-open the match and undo the scoring action that caused the finish.
    match.endedAt=null;
    match.status=null;
    match.winner=null;
    $('winnerModal').classList.remove('show');
    undo();
    autosaveCurrent();
    startLiveHeartbeat();
  };
  $('winnerClose').onclick=async()=>{
    const completedTournamentId=
      match?.tournamentLink?.tournamentId ||
      forcedTournamentReturnId ||
      null;
    const completedLeagueId=match?.leagueLink?.leagueId || null;

    postMatchReturnScreen=completedTournamentId?'tournament':(completedLeagueId?'league':'history');
    postMatchTournamentId=completedTournamentId;
    if(completedTournamentId)forcedTournamentReturnId=completedTournamentId;

    $('winnerModal').classList.remove('show');

    const ok=await persistFinishedMatch();
    if(!ok){
      $('winnerModal').classList.add('show');
      return;
    }

    match=null;
    saveDeviceActiveMatch(null);

    renderHistory();
    renderStats();
    renderPlayers();

    if(postMatchReturnScreen==='tournament'){
      try{
        await loadSecureMatches();
        await loadSecureTournaments();
        reconcileTournamentResultsFromMatches(postMatchTournamentId);
      }catch(e){
        console.error('Tournament post-match refresh:',e);
      }

      const targetTournamentId=postMatchTournamentId||selectedTournamentId||null;
      renderTournament();
      await returnToTournamentDetail(targetTournamentId);
      toast('Výsledek uložen. Pokračuj v turnaji.');
    }else if(postMatchReturnScreen==='league'){
      renderLeague();
      showScreen('league');
      toast('Výsledek zapsán do Ligy Sever.');
    }else{
      showScreen('history');
    }

    postMatchReturnScreen=null;
    postMatchTournamentId=null;
  };

  async function persistFinishedMatch(){
    if(!match) return false;

    const finished=JSON.parse(JSON.stringify(match));
    if(!finished.createdByUid) finished.createdByUid=cloudUid||'';

    const confirmationUids=matchConfirmationUids(finished);
    const dualConfirmation=
      finished.status==='complete' &&
      !currentUserIsSystemAdmin() &&
      !finished.tournamentLink &&
      !finished.leagueLink &&
      confirmationUids.length===2;

    if(dualConfirmation){
      const accepted=await showOwnResultConfirmation(finished);
      if(!accepted){
        toast('Výsledek zatím nebyl uložen.');
        return false;
      }

      finished.confirmationRequired=true;
      finished.confirmationUids=confirmationUids;
      finished.confirmations=finished.confirmations||{};

      // Pokud zapisuje jeden z hráčů, jeho potvrzení se uloží rovnou.
      if(confirmationUids.includes(cloudUid)){
        finished.confirmations[cloudUid]='confirmed';
      }

      finished.originalStatus='complete';
      finished.status='pending_confirmation';
      finished.confirmationState='pending';
    }else{
      // Nedohraný zápas se nikdy nepotvrzuje jako výsledek.
      // U dokončeného zápasu zůstává současný způsob bez čekání.
      finished.confirmationRequired=false;
      finished.confirmationState=finished.status==='incomplete'?'not_applicable':'not_required';
    }

    try{
      await saveSecureMatch(finished);
    }catch(e){
      console.error(e);
      toast('Zápas se nepodařilo uložit do cloudu: '+String(e.message||e));
      return false;
    }

    if(finished.tournamentLink && (finished.status||'complete')==='complete' && finished.winner!==null){
      let linkedTournament=null;
      try{
        linkedTournament=processTournamentResult(finished);
        if(!linkedTournament){
          toast('Zápas je uložený, ale nepodařilo se propojit výsledek s turnajem.');
          return false;
        }

        if(linkedTournament.ko)ensureSKOState(linkedTournament);

        const linkedTm=findTournamentMatch(linkedTournament,finished.tournamentLink.tournamentMatchId);
        forceFinalizeTournamentIfResolved(linkedTournament,linkedTm);

        // Lokální turnaj uložíme ještě před cloudem, aby výsledek nezmizel
        // ani u staršího pavouka.
        try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

        await saveSecureTournament(linkedTournament);
      }catch(e){
        console.error('Tournament result processing/save:',e);
        toast('Chyba při ukládání výsledku turnaje: '+String(e.message||e));
        return false;
      }
    }

    if(finished.leagueLink && (finished.status||'complete')==='complete' && finished.winner!==null){
      try{
        await processLeagueResult(finished);
      }catch(e){
        console.error('League result processing:',e);
        toast('Zápas je uložený, ale nepodařilo se zapsat do Ligy Sever.');
        return false;
      }
    }

    data.currentMatch=null;

    const isIncomplete=(finished.status==='incomplete');

    if(isIncomplete){
      // NEDOHRANÝ není definitivně ukončený. Uložíme archivní snapshot do Výsledků,
      // ale zároveň zachováme plný stav pro pozdější pokračování.
      const resumable=JSON.parse(JSON.stringify(finished));
      resumable.endedAt=null;
      resumable.status='playing';
      resumable.winner=null;
      resumable.updatedAt=new Date().toISOString();

      if(Array.isArray(resumable.events) && resumable.events.length){
        const last=resumable.events[resumable.events.length-1];
        if(last && /Zápas ukončen ručně/i.test(String(last.text||''))){
          resumable.events.pop();
        }
      }

      saveDeviceActiveMatch(resumable);
      // Právě otevřený ukazatel odstraníme, ale snapshot v mapě zůstane.
      try{localStorage.removeItem(LOCAL_ACTIVE_MATCH_KEY);}catch(e){}
    }else{
      removeDeviceActiveMatch(finished.id);
      saveDeviceActiveMatch(null);
    }

    stopLiveHeartbeat();

    // Po opuštění počítadla musí být streamový overlay prázdný.
    if(finished.streamEnabled)await clearStreamState();

    // Z obrazovky LIVE ho po ručním odchodu odstraníme; pokračovat lze z Výsledků.
    await removeLiveMatch(finished.id);

    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    saveData();
    return true;
  }





  function editableMatchOwnedByCurrentUser(m){
    if(!m)return false;
    if(currentUserIsSystemAdmin())return true;

    // Offline režim: zápas vytvořený bez přihlášení patří tomuto zařízení.
    // Bez této výjimky se nově založený offline zápas vyhodnotil jako cizí,
    // renderMatch ho zrušil a následný kód pak mohl narazit na null objekt.
    if(!cloudUid && !m.createdByUid)return true;

    // Tvůrce běžného zápasu ho musí mít vždy možnost řídit, i když sám není hráčem.
    // To je důležité pro zapisovatele / pořadatele, kteří počítají cizí zápas.
    if(cloudUid && m.createdByUid===cloudUid)return true;

    // Turnajové zápasy může řídit pořadatel / spolupořadatel turnaje.
    if(m.tournamentLink?.tournamentId){
      const t=(data.tournaments||[]).find(x=>x.id===m.tournamentLink.tournamentId);
      return !!(t && canManageTournament(t));
    }

    // U běžného zápasu smí pokračovat pouze přihlášený hráč,
    // který je skutečně jedním z účastníků zápasu.
    if(!currentUserPlayerId)return false;

    const participantIds=new Set();

    (m.playerIds||[]).forEach(id=>{
      if(id && id!=='__SOLO__' && id!=='__GHOST__')participantIds.add(id);
    });

    // Dvojice mají všechny čtyři hráče v teamPlayerIds.
    (m.teamPlayerIds||[]).forEach(team=>{
      (team||[]).forEach(id=>{if(id)participantIds.add(id);});
    });

    // Režim vítěz na stole má třetího hráče ve winnerTable.players.
    (m.winnerTable?.players||[]).forEach(p=>{
      if(p?.id)participantIds.add(p.id);
    });

    return participantIds.has(currentUserPlayerId);
  }

  function discardForeignLocalActiveMatch(){
    if(!match)return false;
    if(editableMatchOwnedByCurrentUser(match))return false;

    const foreignId=match.id;
    match=null;
    data.currentMatch=null;
    removeDeviceActiveMatch(foreignId);
    saveDeviceActiveMatch(null);

    console.warn('Foreign active match removed from editable state:',foreignId);
    return true;
  }

  function liveTimestampMs(value){
    const ts=Date.parse(value||'');
    return Number.isFinite(ts)?ts:null;
  }

  function liveStartedLabel(m){
    const ts=liveTimestampMs(m?.startedAt);
    if(ts===null)return '—';
    return new Date(ts).toLocaleString('cs-CZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function liveUpdatedAgeMs(m){
    const ts=liveTimestampMs(m?.updatedAt||m?.startedAt);
    return ts===null?Infinity:Math.max(0,Date.now()-ts);
  }

  function liveUpdatedLabel(m){
    const age=liveUpdatedAgeMs(m);
    if(!Number.isFinite(age))return 'neznámý čas';
    const sec=Math.floor(age/1000);
    if(sec<10)return 'právě teď';
    if(sec<60)return 'před '+sec+' s';
    const min=Math.floor(sec/60);
    if(min<60)return 'před '+min+' min';
    const h=Math.floor(min/60);
    if(h<24)return 'před '+h+' h';
    const d=Math.floor(h/24);
    return 'před '+d+' d';
  }

  function liveMayBeStale(m){
    return liveUpdatedAgeMs(m)>LIVE_WARNING_MS;
  }

  function updateLiveNavStatus(){
    const btn=$('liveNavBtn');
    const modernTile=$('modernLiveTile');
    const modernText=$('modernLiveTileText');
    const count=activeLiveMatches().length;
    const isLive=count>0;
    const liveTitle=isLive
      ? ('Právě probíhá '+count+' '+(count===1?'zápas':count<5?'zápasy':'zápasů'))
      : 'Momentálně není evidovaný žádný LIVE zápas';

    if(btn){
      btn.classList.toggle('live-active',isLive);
      btn.innerHTML=isLive
        ? '<span class="live-nav-dot"></span>LIVESCORE • '+count+' LIVE'
        : 'Livescore';
      btn.title=liveTitle;
    }

    if(modernTile){
      modernTile.classList.toggle('live-active',isLive);
      modernTile.title=liveTitle;
      modernTile.setAttribute('aria-label',isLive ? ('Livescore, '+count+' LIVE') : 'Livescore');
    }
    if(modernText){
      modernText.textContent=isLive
        ? (count===1 ? 'Právě probíhá 1 zápas LIVE' : 'Právě probíhají '+count+' zápasy LIVE')
        : 'Živé zápasy a stream';
    }
  }

  function hiddenLiveIdSet(){
    try{
      const raw=localStorage.getItem(LOCAL_HIDDEN_LIVE_IDS_KEY);
      const arr=raw?JSON.parse(raw):[];
      return new Set(Array.isArray(arr)?arr.filter(Boolean):[]);
    }catch(e){
      return new Set();
    }
  }

  function saveHiddenLiveIdSet(set){
    try{
      localStorage.setItem(LOCAL_HIDDEN_LIVE_IDS_KEY,JSON.stringify([...set]));
    }catch(e){}
  }

  window.hideLiveFromThisDevice=function(matchId){
    if(!matchId)return;
    const live=activeLiveMatches().find(m=>m?.id===matchId);
    const label=live
      ? (liveMatchPlayerName(live,0)+' '+liveMatchScore(live,0)+' : '+liveMatchScore(live,1)+' '+liveMatchPlayerName(live,1))
      : 'tento LIVE zápas';

    if(!confirm(
      'Skrýt '+label+' z Livescore na tomto zařízení?\n\n'+
      'Nic se nemaže z Firebase, historie ani rozehraného zápasu. Záznam lze kdykoli vrátit tlačítkem ZOBRAZIT SKRYTÉ.'
    ))return;

    const set=hiddenLiveIdSet();
    set.add(matchId);
    saveHiddenLiveIdSet(set);
    renderLive();
    updateLiveNavStatus();
    toast('LIVE zápas byl na tomto zařízení skryt.');
  };

  window.restoreHiddenLivesOnThisDevice=async function(){
    const set=hiddenLiveIdSet();
    if(!set.size){
      toast('Žádné LIVE zápasy nejsou skryté.');
      return;
    }
    if(!confirm('Znovu zobrazit '+set.size+' skrytých LIVE záznamů?'))return;
    saveHiddenLiveIdSet(new Set());
    try{await loadCloudLiveMatches(true);}catch(e){}
    renderLive();
    updateLiveNavStatus();
    toast('Skryté LIVE zápasy byly znovu zobrazeny.');
  };

  function activeLiveMatches(){
    const secure=(data.matches||[]).filter(m=>m && !m.endedAt && (m.status==='playing' || m.status==='active'));
    const local=Object.values(loadDeviceActiveMatches()).filter(m=>m && m.id && !m.endedAt);
    const current=(match && !match.endedAt) ? [match] : [];
    const map=new Map();

    // Cloud poskytne LIVE z jiných zařízení, ale vlastní lokální snapshot má přednost,
    // protože obsahuje kompletní editovatelný stav zápasu.
    [...secure,...cloudLiveMatches,...local,...current].forEach(m=>{
      if(m && m.id) map.set(m.id,m);
    });

    const hidden=hiddenLiveIdSet();
    return [...map.values()].filter(m=>!hidden.has(m.id));
  }

  function liveMatchPlayerName(m,index){
    try{
      if(m.playerIds && m.playerIds[index]){
        const p=data.players?.[m.playerIds[index]];
        if(p) return playerDisplayName(p);
      }
    }catch(e){}
    return m.players?.[index] || m.playerNames?.[index] || ('Hráč '+(index+1));
  }

  function liveMatchPlayerClub(m,index){
    try{
      if(m.playerIds && m.playerIds[index]){
        const p=data.players?.[m.playerIds[index]];
        return p?.club || '';
      }
    }catch(e){}
    return '';
  }

  function liveMatchScore(m,index){
    if(Array.isArray(m.scores)) return Number(m.scores[index]||0);
    if(Array.isArray(m.score)) return Number(m.score[index]||0);
    return 0;
  }

  function liveMatchDiscipline(m){
    return m.discipline || m.game || '';
  }

  function liveMatchRaceTo(m){
    return m.raceTo || m.target || '';
  }

  function activeLiveTournaments(){
    const liveMatches=activeLiveMatches();

    return (data.tournaments||[]).filter(t=>{
      if(!t)return false;

      // Jasně dokončený turnaj už mezi LIVE nepatří.
      if(t.status==='complete')return false;

      const all=allTournamentMatches(t);

      // Turnaj je LIVE, pokud má alespoň jeden nedohraný zápas...
      const hasUnfinished=all.some(m=>
        m &&
        m.status!=='done' &&
        !m.winnerId &&
        !m.loserId
      );

      // ...nebo pokud k němu existuje právě rozehraný live zápas.
      const hasLiveMatch=liveMatches.some(m=>
        m?.tournamentLink?.tournamentId===t.id
      );

      const awaitingPlayoff=!!(
        ['groups_sko','groups_dko'].includes(t.format) &&
        groupPhaseComplete(t) &&
        !t.playoffStarted
      );

      return hasUnfinished || hasLiveMatch || awaitingPlayoff;
    });
  }


  async function cleanupStaleLiveMatches(showToast=true){
    if(!await ensureCloudToken()){
      if(showToast)toast('Pro vyčištění Livescore je potřeba přihlášení.');
      return 0;
    }

    try{
      const now=Date.now();
      const r=await fetch(cloudUrl('stream/liveMatches')+'&_cleanup='+now,{cache:'no-store'});
      if(!r.ok)throw new Error('LIVE_CLEANUP_READ_'+r.status);

      const raw=await r.json()||{};
      const stale=Object.values(raw).filter(m=>{
        if(!m||!m.id)return false;
        // Bezpečnost: běžný uživatel smí uklízet jen vlastní LIVE záznamy.
        if(!currentUserIsSystemAdmin() && m.createdByUid!==cloudUid)return false;
        if(m.endedAt)return true;
        const ts=Date.parse(m.updatedAt||m.startedAt||'');
        return !Number.isFinite(ts) || (now-ts)>LIVE_STALE_MS;
      });

      for(const m of stale){
        try{await liveMatchRequest(m.id,'DELETE');}catch(e){}
      }

      await loadCloudLiveMatches(true);
      renderLive();

      if(showToast){
        toast(stale.length
          ? 'Obnoveno • odstraněno '+stale.length+' neaktivních LIVE zápasů.'
          : 'Obnoveno • skóre je aktuální.');
      }

      return stale.length;
    }catch(e){
      console.error('Livescore cleanup:',e);
      if(showToast)toast('Livescore se nepodařilo vyčistit.');
      return 0;
    }
  }

  window.cleanupStaleLiveMatches=cleanupStaleLiveMatches;

  function resumableMatchState(matchId){
    if(!matchId)return null;
    let best=null;

    const current=(match&&match.id===matchId&&!match.endedAt)?match:null;
    const local=getDeviceActiveMatch(matchId);
    const archived=(data.matches||[]).find(m=>m&&m.id===matchId&& !['complete','pending_confirmation','needs_correction'].includes(m.status||''));
    const recovery=loadActiveMatchRecovery(matchId);

    [current,local,archived,...recovery].filter(Boolean).forEach(c=>{
      best=betterResumableState(best,c);
    });

    if(!best)return null;
    best.endedAt=null;
    best.status='playing';
    best.winner=null;
    return JSON.parse(JSON.stringify(best));
  }

  function canResumeIncompleteMatch(m){
    if(!m || (m.status||'complete')==='complete')return false;
    if(['pending_confirmation','needs_correction'].includes(m.status))return false;
    const state=resumableMatchState(m.id);
    return !!(state && editableMatchOwnedByCurrentUser(state));
  }

  window.resumeLocalMatch=async function(matchId){
    let saved=resumableMatchState(matchId);

    // Před obnovením porovnáme i chráněnou cloudovou kopii /matches/{id}.
    // LIVE payload je záměrně zkrácený a pro resume se nikdy nepoužívá.
    try{
      const cloud=await secureMatchRequest(matchId,'GET');
      if(cloud && !cloud.endedAt && !['complete','pending_confirmation','needs_correction'].includes(cloud.status||'')){
        saved=betterResumableState(saved,cloud);
        if(cloud)recordActiveMatchRecoverySnapshot(cloud);
      }
    }catch(e){
      console.warn('Resume cloud check:',e);
    }

    if(!saved){
      toast('Tento nedohraný zápas už nemá obnovitelný stav.');
      return;
    }
    if(!editableMatchOwnedByCurrentUser(saved)){
      toast('Tento zápas může upravovat pouze hráč, který je jeho účastníkem.');
      return;
    }

    if(match && !match.endedAt && match.id!==matchId){
      saveDeviceActiveMatch(match);
    }

    if(match?.useClock)stopTimer();
    stopLiveHeartbeat();

    match=JSON.parse(JSON.stringify(saved));
    match.endedAt=null;
    match.status='playing';
    match.winner=null;
    match.resumedSafelyAt=new Date().toISOString();
    data.currentMatch=null;
    saveDeviceActiveMatch(match);

    timer=null;
    timerRunning=false;
    timeLeft=match?.clock?.normal || match?.clock?.first || 30;
    clockPhase='normal';

    showScreen('match');
    renderMatch();
    startLiveHeartbeat();
    autosaveCurrent();
    toast('Rozehraný zápas byl bezpečně obnoven • '+(match.scores?.[0]||0)+':'+(match.scores?.[1]||0)+'.');
  };

  function renderLive(){
    const matchesWrap=$('liveMatchesList');
    const tournamentsWrap=$('liveTournamentsList');
    if(!matchesWrap || !tournamentsWrap)return;

    const matches=activeLiveMatches();
    updateLiveNavStatus();
    if(!matches.length){
      matchesWrap.innerHTML='<div class="muted">Momentálně není rozehraný žádný zápas.</div>';
    }else{
      matchesWrap.innerHTML=matches.map(m=>{
        const p1=esc(liveMatchPlayerName(m,0));
        const p2=esc(liveMatchPlayerName(m,1));
        const s1=liveMatchScore(m,0);
        const s2=liveMatchScore(m,1);
        const disc=esc(liveMatchDiscipline(m));
        const rt=liveMatchRaceTo(m);
        const table=m.tournamentLink?.tableNumber || '';
        const tournamentName=m.tournamentLink
          ? esc((data.tournaments||[]).find(t=>t.id===m.tournamentLink.tournamentId)?.name || 'Turnaj')
          : '';
        return `<div class="tournament-match">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
            <span class="tournament-badge gold">${disc||'ZÁPAS'}</span>
            <span class="muted">${table?'STŮL '+table:(rt?'RACE TO '+rt:'')}</span>
          </div>
          <div class="tm-row">
            <div class="tm-p">${p1}</div>
            <div class="tm-score">${s1} : ${s2}</div>
            <div class="tm-p">${p2}</div>
          </div>
          ${tournamentName?`<div class="muted" style="margin-top:7px;text-align:center">${tournamentName}</div>`:''}
          ${m.solo14GhostMode?`<div style="margin-top:7px;text-align:center;font-size:12px;font-weight:950;color:var(--gold2)">${esc(solo14GhostDifficultyLabel(m,true))}</div>`:''}
          ${liveBreakModeLabel(m)?`<div style="margin-top:7px;text-align:center;font-size:11px;font-weight:950">ROZSTŘEL: ${esc(liveBreakModeLabel(m))}</div>`:''}
          <div class="muted" style="margin-top:7px;text-align:center;font-size:11px;line-height:1.55">
            Začátek: <strong>${esc(liveStartedLabel(m))}</strong> • Aktualizováno: <strong>${esc(liveUpdatedLabel(m))}</strong>
            ${liveMayBeStale(m)?`<div class="live-stale-note">⚠ MOŽNÁ NEAKTUÁLNÍ</div>`:''}
          </div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
            ${canResumeIncompleteMatch(m) || (resumableMatchState(m.id) && editableMatchOwnedByCurrentUser(resumableMatchState(m.id)))
              ? `<button class="btn primary" onclick="resumeLocalMatch('${m.id}')">POKRAČOVAT</button>`
              : ''}
            <button class="btn" onclick="openLiveScore('${m.id}')">LIVESCORE</button>
            <button class="btn" onclick="hideLiveFromThisDevice('${m.id}')">SKRÝT Z LIVE</button>
            ${currentUserIsSystemAdmin()
              ? `<button class="btn danger" onclick="deleteTestMatchCompletely('${m.id}')">SMAZAT TEST ZCELA</button>`
              : ''}
            ${editableMatchOwnedByCurrentUser(m)
              ? `<button class="btn danger" onclick="deleteLiveMatchFromLivescore('${m.id}')">SMAZAT Z LIVE</button>`
              : ''}
          </div>
        </div>`;
      }).join('');
    }

    const tours=activeLiveTournaments();
    if(!tours.length){
      tournamentsWrap.innerHTML='<div class="muted">Momentálně neprobíhá žádný turnaj.</div>';
    }else{
      tournamentsWrap.innerHTML=tours.map(t=>{
        const all=allTournamentMatches(t);
        const done=all.filter(m=>m.status==='done').length;
        const linkedLive=matches.filter(m=>m.tournamentLink?.tournamentId===t.id);
        const playingIds=new Set(linkedLive.map(m=>m.tournamentLink?.tournamentMatchId).filter(Boolean));
        const playing=Math.max(
          all.filter(m=>m.status==='playing').length,
          playingIds.size
        );
        const total=all.length;
        return `<div class="tournament-match">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${esc(t.name||'Turnaj')}</strong>
            <span class="tournament-badge gold">PROBÍHÁ</span>
          </div>
          <div class="muted" style="margin-top:8px">
            ${esc(tournamentDisciplineSummary(t))} • odehráno ${done}/${total}
            ${playing?` • právě hraje ${playing}`:''}
            ${['groups_sko','groups_dko'].includes(t.format) && groupPhaseComplete(t) && !t.playoffStarted
              ? ' • ČEKÁ NA NASAZENÍ PLAY-OFF'
              : ''}
            ${canManageTournament(t)?'':' • pouze ke sledování'}
          </div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
            <button class="btn" onclick="openTournamentFromLive('${t.id}')">${canManageTournament(t)?'OTEVŘÍT TURNAJ':'NÁHLED TURNAJE'}</button>
            <button class="btn primary" onclick="openTournamentLiveScores('${t.id}')">LIVESCORE</button>
          </div>
        </div>`;
      }).join('');
    }
  }

  window.deleteTestMatchCompletely=async function(matchId){
    if(!currentUserIsSystemAdmin()){
      toast('Kompletní smazání testu může provést pouze SYSTEM ADMIN.');
      return;
    }

    const live=activeLiveMatches().find(x=>x?.id===matchId)
      || cloudLiveMatches.find(x=>x?.id===matchId)
      || (data.matches||[]).find(x=>x?.id===matchId)
      || getDeviceActiveMatch(matchId);

    if(!live){
      toast('Zápas s tímto ID už nebyl nalezen.');
      return;
    }

    if(live.tournamentLink || live.leagueLink){
      alert('Tento zápas je navázaný na turnaj nebo ligu. Kompletní servisní smazání je z bezpečnostních důvodů zablokované, aby se nerozbila soutěžní struktura.');
      return;
    }

    const label=(liveMatchPlayerName(live,0)||'Hráč 1')+' '+liveMatchScore(live,0)+' : '+liveMatchScore(live,1)+' '+(liveMatchPlayerName(live,1)||'Hráč 2');
    const ok=confirm(
      'SMAZAT TESTOVACÍ ZÁPAS KOMPLETNĚ?\n\n'+
      label+'\nID: '+matchId+
      '\n\nBude odstraněn z LIVE, /matches, historie, lokálních aktivních stavů i recovery záloh. Tuto operaci nelze vrátit.'
    );
    if(!ok)return;

    const typed=prompt('Pro potvrzení napiš přesně: SMAZAT');
    if(typed!=='SMAZAT'){
      toast('Mazání bylo zrušeno.');
      return;
    }

    const errors=[];
    const deletingCurrent=!!(match && match.id===matchId);

    try{
      if(deletingCurrent){
        try{if(match.useClock)stopTimer();}catch(e){}
        try{stopLiveHeartbeat();}catch(e){}
        try{if(match.streamEnabled)await clearStreamState();}catch(e){}
      }

      try{
        await liveMatchRequest(matchId,'DELETE');
      }catch(e){
        errors.push('LIVE: '+String(e.message||e));
      }

      try{
        await secureMatchRequest(matchId,'DELETE');
      }catch(e){
        errors.push('/matches: '+String(e.message||e));
      }

      try{removeDeviceActiveMatch(matchId);}catch(e){errors.push('lokální aktivní stav');}
      try{removeActiveMatchRecovery(matchId);}catch(e){errors.push('recovery');}

      try{
        const hidden=hiddenLiveIdSet();
        if(hidden.delete(matchId))saveHiddenLiveIdSet(hidden);
      }catch(e){}

      data.matches=(data.matches||[]).filter(m=>m?.id!==matchId);
      if(!Array.isArray(data.deletedMatchIds))data.deletedMatchIds=[];
      if(!data.deletedMatchIds.includes(matchId))data.deletedMatchIds.push(matchId);

      if(deletingCurrent){
        match=null;
        data.currentMatch=null;
        try{localStorage.removeItem(LOCAL_ACTIVE_MATCH_KEY);}catch(e){}
      }

      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      cloudLiveMatches=cloudLiveMatches.filter(m=>m?.id!==matchId);

      if(liveScoreSelectedId===matchId){
        $('liveScoreModal')?.classList.remove('show');
        liveScoreSelectedId=null;
      }

      try{await loadCloudLiveMatches(true);}catch(e){}
      try{await loadSecureMatches();}catch(e){}

      // loadSecureMatches může znovu načíst starou cache jen pokud DELETE selhal.
      data.matches=(data.matches||[]).filter(m=>m?.id!==matchId);
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

      renderLive();
      renderHistory();
      updateLiveNavStatus();
      if(deletingCurrent)showScreen('setup');

      const stillLive=activeLiveMatches().some(m=>m?.id===matchId);
      if(stillLive || errors.length){
        alert(
          'Mazání nebylo dokončeno úplně.\n\n'+
          (errors.length?errors.join('\n'):'Zápas se po smazání znovu objevil.')+
          '\n\nID: '+matchId
        );
        return;
      }

      toast('Testovací zápas byl kompletně smazán.');
    }catch(e){
      console.error('Complete test match delete:',e);
      alert('Kompletní smazání selhalo: '+String(e.message||e)+'\n\nID: '+matchId);
    }
  };

  window.deleteLiveMatchFromLivescore=async function(matchId){
    const live=activeLiveMatches().find(x=>x.id===matchId);
    if(!live){
      toast('Tento LIVE zápas už není aktivní.');
      await loadCloudLiveMatches(true);
      renderLive();
      return;
    }
    if(!editableMatchOwnedByCurrentUser(live)){
      toast('Tento LIVE zápas nemáš oprávnění smazat.');
      return;
    }

    const label=(liveMatchPlayerName(live,0)||'Hráč 1')+' '+liveMatchScore(live,0)+' : '+liveMatchScore(live,1)+' '+(liveMatchPlayerName(live,1)||'Hráč 2');
    if(!confirm('Opravdu odstranit rozehraný zápas z LIVESCORE?\n\n'+label+'\n\nRozehraný stav bude odstraněn a nepůjde v něm pokračovat.'))return;

    const deletingCurrent=!!(match && match.id===matchId);
    const hadStream=deletingCurrent && !!match.streamEnabled;

    if(deletingCurrent){
      if(match.useClock)stopTimer();
      stopLiveHeartbeat();
    }

    clearTimeout(activeMatchCloudSaveTimer);
    removeDeviceActiveMatch(matchId);

    // Pokud už byla plná aktivní záloha načtena v data.matches, odstraníme ji i lokálně.
    data.matches=(data.matches||[]).filter(m=>!(m?.id===matchId && ['playing','active'].includes(m.status)));
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

    try{await removeLiveMatch(matchId);}catch(e){}
    await removeActiveMatchCloudBackup(matchId);

    if(deletingCurrent){
      if(hadStream)try{await clearStreamState();}catch(e){}
      match=null;
      data.currentMatch=null;
      saveDeviceActiveMatch(null);
    }

    if(liveScoreSelectedId===matchId){
      $('liveScoreModal')?.classList.remove('show');
      liveScoreSelectedId=null;
    }

    await loadCloudLiveMatches(true);
    try{await loadSecureMatches();}catch(e){}
    renderLive();
    renderHistory();

    if(deletingCurrent)showScreen('setup');
    toast('Rozehraný LIVE zápas byl odstraněn.');
  };

  window.openTournamentFromLive=function(tid){
    openTournamentDetail(tid);
  };

  window.openTournamentLiveScores=function(tid){
    const live=activeLiveMatches().filter(m=>m.tournamentLink?.tournamentId===tid);
    if(!live.length){
      toast('V tomto turnaji právě není rozehraný žádný zápas.');
      return;
    }
    openLiveScore(live[0].id);
  };

  window.openLiveScore=async function(matchId){
    liveScoreSelectedId=matchId;
    $('liveScoreModal').classList.add('show');

    try{
      await loadCloudLiveMatches(true);
    }catch(e){}

    renderLiveScoreModal();

    // Běžně je LIVESCORE pouze náhled.
    // Výjimkou je vlastní rozehraná 14.1 sólo hra, do které se její hráč může přímo vrátit.
  };

  function canEditSolo14FromLive(m){
    if(!m || !m.solo14 || !currentUserPlayerId)return false;

    // Úmyslně zde NENÍ admin výjimka:
    // návrat do editace 14.1 sólo smí vždy jen hráč, který tuto sólo hru hraje.
    const soloPlayerId=m.solo14PlayerId || m.playerIds?.[0] || '';
    return !!soloPlayerId && soloPlayerId===currentUserPlayerId;
  }

  window.editSolo14FromLiveScore=async function(){
    const live=activeLiveMatches().find(x=>x.id===liveScoreSelectedId);
    if(!live || !canEditSolo14FromLive(live)){
      toast('Tuto sólo hru může upravovat pouze hráč, který ji hraje.');
      return;
    }

    // Preferujeme stav z tohoto zařízení. Na jiném vlastním zařízení načteme
    // plnou resume kopii z chráněné /matches/{id}; do veřejného LIVE ji neposíláme.
    let resume=getDeviceActiveMatch(live.id);
    if(!resume){
      try{ resume=await secureMatchRequest(live.id,'GET'); }catch(e){ console.warn('Secure solo14 resume:',e); }
    }

    if(!resume || resume.id!==live.id || !resume.solo14){
      toast('Rozehraný stav 14.1 sólo se nepodařilo načíst.');
      return;
    }

    // Kontrola hráče znovu i nad plným stavem.
    const resumePlayerId=resume.playerIds?.[0]||'';
    if(!currentUserPlayerId || resumePlayerId!==currentUserPlayerId){
      toast('Tuto sólo hru může upravovat pouze hráč, který ji hraje.');
      return;
    }

    match=resume;
    saveDeviceActiveMatch(match);
    $('liveScoreModal').classList.remove('show');
    liveScoreSelectedId=null;
    showScreen('match');
    renderMatch();
    toast('14.1 sólo je znovu otevřené k editaci.');
  };

  function liveMomentumData(m){
    let scores=Array.isArray(m?.liveScoreProgress)?m.liveScoreProgress.filter(x=>/^\d+\s*:\s*\d+$/.test(String(x))):[];
    let winners=Array.isArray(m?.liveRackWinners)?m.liveRackWinners.map(Number).filter(x=>x===0||x===1):[];

    // Vlastní lokální/secure aktivní zápas může mít eventy, i když starší veřejný payload momentum ještě nemá.
    if(!scores.length && Array.isArray(m?.events)){
      const snap=liveMomentumSnapshotFromMatch(m);
      scores=snap.scores;
      winners=snap.winners;
    }
    return {scores,winners};
  }

  function liveMomentumHtml(m,p1,p2){
    const md=liveMomentumData(m);
    if(md.scores.length<2){
      return `<div class="subpanel" style="margin-top:12px;padding:10px;text-align:center">
        <div style="font-size:12px;font-weight:950">VÝVOJ SKÓRE</div>
        <div class="muted" style="font-size:11px;margin-top:5px">Průběh rack po racku zatím není k dispozici.</div>
      </div>`;
    }

    // Livescore momentum má být statický a čitelný i u dlouhého zápasu.
    // Zobrazíme začátek + posledních 5 stavů; bez horizontálního scrollování.
    let displayScores=md.scores.slice();
    let compacted=false;
    if(displayScores.length>7){
      displayScores=[displayScores[0],...displayScores.slice(-5)];
      compacted=true;
    }
    const progressParts=[];
    displayScores.forEach((x,idx)=>{
      if(compacted && idx===1){
        progressParts.push('<span class="muted" style="font-weight:900">…</span>');
      }
      progressParts.push(`<span style="white-space:nowrap;font-weight:900">${esc(String(x))}</span>`);
    });
    const progress=progressParts.join('<span class="muted" style="padding:0 4px">→</span>');
    const recent=md.winners.slice(-8);
    const dotRow=(player,name)=>{
      const dots=recent.map(w=>`<span title="${esc(name)}${w===player?' vyhrál':' nevyhrál'} rack" style="display:inline-block;width:10px;height:10px;border-radius:50%;margin:0 2px;${w===player?'background:var(--gold2);':'border:1px solid var(--muted);opacity:.38;'}"></span>`).join('');
      return `<div style="display:flex;align-items:center;justify-content:center;gap:7px;margin-top:4px"><span class="muted" style="font-size:10px;min-width:72px;text-align:right">${esc(name)}</span><span style="white-space:nowrap">${dots}</span></div>`;
    };

    let streakWinner=null,streak=0;
    for(let i=md.winners.length-1;i>=0;i--){
      if(streakWinner===null){streakWinner=md.winners[i];streak=1;}
      else if(md.winners[i]===streakWinner)streak++;
      else break;
    }
    const streakText=streakWinner===0||streakWinner===1
      ? `Aktuální série: <strong>${esc(streakWinner===0?p1:p2)} • ${streak} ${streak===1?'rack':'racky'}</strong>`
      : '';

    return `<div class="subpanel" style="margin-top:12px;padding:10px;text-align:center">
      <div style="font-size:12px;font-weight:950">VÝVOJ SKÓRE</div>
      <div style="margin-top:6px;font-size:12px;line-height:1.65;display:flex;align-items:center;justify-content:center;gap:0;flex-wrap:wrap;white-space:normal">${progress}</div>
      ${recent.length?`<div style="margin-top:7px">${dotRow(0,p1)}${dotRow(1,p2)}</div>`:''}
      ${streakText?`<div class="muted" style="font-size:11px;margin-top:7px">${streakText}</div>`:''}
    </div>`;
  }

  function renderLiveScoreModal(){
    const m=activeLiveMatches().find(x=>x.id===liveScoreSelectedId);
    if(!m){
      $('liveScoreEditSolo14')?.classList.add('hidden');
      if($('liveScoreModeLabel'))$('liveScoreModeLabel').textContent='LIVESCORE • POUZE KE SLEDOVÁNÍ';
      $('liveScoreTitle').textContent='Zápas už není aktivní';
      $('liveScoreMeta').textContent='';
      $('liveScoreP1').textContent='—';
      $('liveScoreP2').textContent='—';
      $('liveScoreP1Club').textContent='';
      $('liveScoreP2Club').textContent='';
      $('liveScoreValue').textContent='—';
      $('liveScoreRace').textContent='';
      $('liveScoreExtra').innerHTML='<div class="muted">Zápas už byl ukončen nebo není dostupný.</div>';
      return;
    }

    const canSoloEdit=canEditSolo14FromLive(m);
    $('liveScoreEditSolo14')?.classList.toggle('hidden',!canSoloEdit);
    if($('liveScoreModeLabel')){
      $('liveScoreModeLabel').textContent=canSoloEdit
        ? 'LIVESCORE • TVOJE ROZEHRANÁ 14.1 SÓLO'
        : 'LIVESCORE • POUZE KE SLEDOVÁNÍ';
    }

    const p1=liveMatchPlayerName(m,0);
    const p2=liveMatchPlayerName(m,1);
    const s1=liveMatchScore(m,0);
    const s2=liveMatchScore(m,1);
    const discipline=liveMatchDiscipline(m);
    const raceTo=liveMatchRaceTo(m);

    $('liveScoreTitle').textContent=(m.tournamentLink?'Turnajový zápas':'Aktuální zápas');
    $('liveScoreMeta').textContent=[
      discipline,
      raceTo ? 'Race to '+raceTo : '',
      m.solo14GhostMode ? solo14GhostDifficultyLabel(m,true) : '',
      liveBreakModeLabel(m) ? 'Rozstřel: '+liveBreakModeLabel(m) : '',
      m.tournamentLink?.tableNumber ? 'Stůl '+m.tournamentLink.tableNumber : ''
    ].filter(Boolean).join(' • ');

    $('liveScoreP1').textContent=p1;
    $('liveScoreP2').textContent=p2;
    $('liveScoreP1Club').textContent=liveMatchPlayerClub(m,0);
    $('liveScoreP2Club').textContent=liveMatchPlayerClub(m,1);
    $('liveScoreValue').textContent=s1+' : '+s2;
    $('liveScoreRace').textContent=raceTo ? 'Race to '+raceTo : '';

    const turnIndex=(typeof m.turn==='number'?m.turn:(typeof m.currentPlayer==='number'?m.currentPlayer:null));
    const turnText=turnIndex===0 ? p1 : turnIndex===1 ? p2 : '';
    const clock=(m.clock?.remaining ?? m.shotClockRemaining ?? null);
    const clockText=(clock!==null && clock!==undefined) ? String(clock)+' s' : '';

    $('liveScoreExtra').innerHTML=`
      <div style="display:flex;justify-content:${m.useClock?'space-between':'center'};gap:12px;flex-wrap:wrap">
        <div><span class="muted">Na tahu:</span> <strong>${esc(turnText||'—')}</strong></div>
        ${m.useClock?`<div><span class="muted">Shot clock:</span> <strong>${esc(clockText||'—')}</strong></div>`:''}
      </div>
      <div class="muted" style="margin-top:12px;text-align:center;font-size:12px;line-height:1.6">
        Začátek: <strong>${esc(liveStartedLabel(m))}</strong><br>
        Aktualizováno: <strong>${esc(liveUpdatedLabel(m))}</strong>
        ${liveMayBeStale(m)?`<div class="live-stale-note" style="margin-top:3px">⚠ MOŽNÁ NEAKTUÁLNÍ</div>`:''}
      </div>
      ${liveMomentumHtml(m,p1,p2)}
    `;
  }

  if($('cleanupStaleLiveBtn')){
    $('cleanupStaleLiveBtn').onclick=()=>cleanupStaleLiveMatches(true);
  }
  if($('restoreHiddenLiveBtn')){
    $('restoreHiddenLiveBtn').onclick=()=>restoreHiddenLivesOnThisDevice();
  }

    if($('liveScoreEditSolo14'))$('liveScoreEditSolo14').onclick=editSolo14FromLiveScore;

$('liveScoreClose').onclick=()=>{
    $('liveScoreModal').classList.remove('show');
    liveScoreSelectedId=null;
  };

  // ===== TURNAJOVÝ MÓD =====
  function shuffleArray(arr){
    const a=[...arr];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function tournamentPlayerName(id,t=null){
    const p=data.players[id];
    if(p) return playerDisplayName(p);
    if(t && t.guests && t.guests[id]) return t.guests[id].name;
    for(const tour of (data.tournaments||[])){
      if(tour.guests && tour.guests[id]) return tour.guests[id].name;
    }
    const draft=tournamentGuestDrafts.find(g=>g.id===id);
    return draft ? draft.name : 'Neznámý hráč';
  }

  function tournamentParticipant(t,id){
    const p=data.players[id];
    if(p) return {id,name:p.name,displayName:playerDisplayName(p),guest:false};
    if(t && t.guests && t.guests[id]) return {id,name:t.guests[id].name,displayName:t.guests[id].name,guest:true};
    const draft=tournamentGuestDrafts.find(g=>g.id===id);
    if(draft) return {id,name:draft.name,displayName:draft.name,guest:true};
    return {id,name:'Neznámý hráč',displayName:'Neznámý hráč',guest:true};
  }

  function normalizePlaceholderPlayerName(name){
    return String(name||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }

  function splitPlaceholderName(name){
    const parts=String(name||'').replace(/\s+/g,' ').trim().split(' ').filter(Boolean);
    if(parts.length<=1)return {firstName:parts[0]||'',lastName:''};
    return {firstName:parts.slice(0,-1).join(' '),lastName:parts[parts.length-1]};
  }

  function findReusablePlaceholderPlayer(name){
    const key=normalizePlaceholderPlayerName(name);
    if(!key)return null;
    return Object.values(data.players||{}).find(p=>
      p &&
      !p.ownerUid &&
      normalizePlaceholderPlayerName(p.name)===key
    )||null;
  }

  function buildPlaceholderPlayer(name){
    const clean=String(name||'').replace(/\s+/g,' ').trim();
    const parts=splitPlaceholderName(clean);
    return {
      id:uid(),
      name:clean,
      firstName:parts.firstName,
      lastName:parts.lastName,
      nickname:'',
      identifier:'',
      useNicknameInMatch:false,
      club:'',
      clubId:'',
      ownerUid:'',
      note:'Profil byl předpřipraven z turnajového výsledku. Po registraci si ho hráč může převzít.',
      equipment:'',
      achievements:'',
      photo:'',
      active:true,
      placeholderProfile:true,
      profileSource:'tournament_guest',
      createdAt:new Date().toISOString()
    };
  }

  async function ensurePlaceholderPlayer(name){
    const existing=findReusablePlaceholderPlayer(name);
    if(existing)return existing;

    const p=buildPlaceholderPlayer(name);
    data.players[p.id]=p;

    try{
      await saveSecurePlayer(p);
    }catch(e){
      delete data.players[p.id];
      throw e;
    }

    return p;
  }

  let legacyGuestPromotionInProgress=false;
  async function promoteLegacyTournamentGuestsToProfiles(){
    if(legacyGuestPromotionInProgress)return 0;
    if(!cloudAuthenticated || !currentUserIsSystemAdmin())return 0;

    const tournaments=(data.tournaments||[]).filter(t=>t && t.guests && Object.keys(t.guests).length);
    if(!tournaments.length)return 0;

    legacyGuestPromotionInProgress=true;
    let converted=0;

    try{
      for(const t of tournaments){
        let tournamentChanged=false;
        const guestEntries=Object.entries(t.guests||{});

        for(const [guestId,guest] of guestEntries){
          // Nové hosty necháváme jako hosty konkrétního turnaje.
          // Automatická migrace je pouze pro stará data.
          if(guest?.preserveGuest===true)continue;

          const guestName=String(guest?.name||'').trim();
          if(!guestName)continue;

          let p=findReusablePlaceholderPlayer(guestName);
          if(!p){
            p=buildPlaceholderPlayer(guestName);
            data.players[p.id]=p;
            try{
              await saveSecurePlayer(p);
            }catch(e){
              console.warn('Legacy guest profile save:',guestName,e);
              delete data.players[p.id];
              continue;
            }
          }

          const affectedMatches=(data.matches||[]).filter(m=>
            m?.tournamentLink?.tournamentId===t.id &&
            Array.isArray(m.playerIds) &&
            m.playerIds.includes(guestId)
          );

          replaceTournamentParticipantId(t,guestId,p.id);
          relinkHistoricalGuestMatches(t,guestId,p.id);
          delete t.guests[guestId];
          tournamentChanged=true;
          converted++;

          for(const m of affectedMatches){
            try{
              await saveSecureMatch(m);
            }catch(e){
              console.warn('Legacy guest historical match save:',m?.id,e);
            }
          }
        }

        if(tournamentChanged){
          t.updatedAt=new Date().toISOString();
          try{
            await saveSecureTournament(t);
          }catch(e){
            console.warn('Legacy guest tournament save:',t.id,e);
          }
        }
      }

      if(converted){
        try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
        renderPlayers();
        renderTournament();
        renderResultsTournaments();
        renderResultsSeries();
        renderSeriesList();
      }

      return converted;
    }finally{
      legacyGuestPromotionInProgress=false;
    }
  }

  function renderTournamentGuestDrafts(){
    const wrap=$('tournamentGuestDraftList');
    if(!wrap) return;
    if(!tournamentGuestDrafts.length){
      wrap.innerHTML='<div class="muted">Žádní hosté zatím nepřidáni.</div>';
      return;
    }
    tournamentGuestDrafts.forEach(g=>ensureTournamentCheckinEntry(g.id));
    wrap.innerHTML=tournamentGuestDrafts.map(g=>`
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border:1px solid #303034;border-radius:10px;margin-top:6px">
        <label style="display:flex;align-items:center;gap:9px;flex:1">
          <input type="checkbox" class="tournament-player-check tournament-guest-check" value="${esc(g.id)}" checked>
          <span><strong>${esc(g.name)}</strong><br><span class="muted">HOST</span></span>
        </label>
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
          ${tournamentHandicapEnabled()?`<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:900">HCP <input type="number" min="0" value="${tournamentPlayerHandicap(g.id)}" style="width:72px" onchange="setTournamentPlayerHandicap('${g.id}',this.value)" ${tournamentCheckinClosed?'disabled':''}></label>`:''}
          <button class="btn ${tournamentCheckin[g.id]?.paid?'primary':''}" onclick="toggleTournamentPaid('${g.id}')" ${tournamentCheckinClosed?'disabled':''}>${tournamentCheckin[g.id]?.paid?'✓ ZAPLACENO':'NEZAPLACENO'}</button>
          <button class="btn danger" onclick="removeTournamentGuestDraft('${g.id}')" ${tournamentCheckinClosed?'disabled':''}>ODEBRAT</button>
        </div>
      </div>
    `).join('');
    wrap.querySelectorAll('.tournament-guest-check').forEach(x=>x.addEventListener('change',()=>{invalidateTournamentDraw();updateTournamentSelectedCount();renderTournamentSeedOrder();}));
  }

  function renderTournamentPlayerPicker(){
    const select=$('tournamentPlayerDropdown');
    if(!select)return;

    const players=Object.values(data.players||{})
      .filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)
      .sort((a,b)=>{
        const ap=currentUserPlayerPriority(a)?0:1;
        const bp=currentUserPlayerPriority(b)?0:1;
        if(ap!==bp)return ap-bp;
        return String(a.club||'').localeCompare(String(b.club||''),'cs') ||
          playerDisplayName(a).localeCompare(playerDisplayName(b),'cs') ||
          String(a.identifier||'').localeCompare(String(b.identifier||''),'cs');
      });

    const available=players.filter(p=>!tournamentSelectedPlayerIds.includes(p.id));

    select.innerHTML='<option value="">— vyber hráče —</option>'+
      available.map(p=>`<option value="${esc(p.id)}">${esc(playerSelectionLabel(p))}</option>`).join('');

    renderTournamentSelectedPlayers();
    renderTournamentGuestDrafts();
    updateTournamentSelectedCount();
    renderTournamentSeedOrder();
  }

  function tournamentAllCheckinIds(){
    const guestIds=[...document.querySelectorAll('.tournament-guest-check:checked')]
      .map(x=>x.value).filter(Boolean);
    return [...tournamentSelectedPlayerIds,...guestIds];
  }

  function ensureTournamentCheckinEntry(id){
    if(!id)return;
    if(!tournamentCheckin[id]) tournamentCheckin[id]={paid:false,arrived:true,handicap:0};
    if(tournamentCheckin[id].handicap==null)tournamentCheckin[id].handicap=0;
  }

  function tournamentHandicapEnabled(){
    return !!$('tournamentHandicapEnabled')?.checked;
  }

  function tournamentPlayerHandicap(id){
    ensureTournamentCheckinEntry(id);
    return Math.max(0,Math.floor(Number(tournamentCheckin[id]?.handicap||0)));
  }

  window.setTournamentPlayerHandicap=function(id,value){
    if(tournamentCheckinClosed){toast('Nejdřív znovu otevři prezenci.');return;}
    ensureTournamentCheckinEntry(id);
    tournamentCheckin[id].handicap=Math.max(0,Math.floor(Number(value||0)));
    saveTournamentCheckinDraft();
  };

  function tournamentPaidPlayerIds(){
    return tournamentAllCheckinIds().filter(id=>tournamentCheckin[id]?.paid===true);
  }

  function saveTournamentCheckinDraft(){
    try{
      localStorage.setItem(TOURNAMENT_CHECKIN_DRAFT_KEY,JSON.stringify({
        playerIds:tournamentSelectedPlayerIds,
        guestDrafts:tournamentGuestDrafts,
        checkin:tournamentCheckin,
        closed:tournamentCheckinClosed,
        entryFee:Number($('tournamentEntryFee')?.value||0),
        prizeMoney:tournamentPrizeMoney,
        drawNumbers:tournamentDrawNumbers,
        manualSeedOrder:manualTournamentSeedOrder,
        handicapEnabled:tournamentHandicapEnabled()
      }));
    }catch(e){}
  }

  function clearTournamentCheckinDraft(){
    try{localStorage.removeItem(TOURNAMENT_CHECKIN_DRAFT_KEY);}catch(e){}
  }

  function restoreTournamentCheckinDraft(){
    try{
      const raw=localStorage.getItem(TOURNAMENT_CHECKIN_DRAFT_KEY);
      if(!raw)return;
      const d=JSON.parse(raw);
      if(Array.isArray(d.playerIds)) tournamentSelectedPlayerIds=[...d.playerIds];
      if(Array.isArray(d.guestDrafts)){
        tournamentGuestDrafts=d.guestDrafts
          .filter(g=>g&&g.id&&g.name)
          .map(g=>({id:String(g.id),name:String(g.name),createdAt:g.createdAt||''}));
      }
      if(d.checkin && typeof d.checkin==='object') tournamentCheckin=d.checkin;
      tournamentCheckinClosed=!!d.closed;
      if(d.drawNumbers && typeof d.drawNumbers==='object') tournamentDrawNumbers=d.drawNumbers;
      if($('tournamentHandicapEnabled'))$('tournamentHandicapEnabled').checked=!!d.handicapEnabled;
      if(Array.isArray(d.manualSeedOrder)) manualTournamentSeedOrder=d.manualSeedOrder;
      if(d.prizeMoney && typeof d.prizeMoney==='object') tournamentPrizeMoney=d.prizeMoney;
      if($('tournamentEntryFee') && Number.isFinite(Number(d.entryFee))) $('tournamentEntryFee').value=String(Math.max(0,Number(d.entryFee)));
      syncTournamentPrizeMoneyForm();
    }catch(e){console.warn('Tournament check-in draft restore:',e);}
  }

  function normalizeTournamentPrizeMoney(){
    tournamentPrizeMoney=tournamentPrizeMoney&&typeof tournamentPrizeMoney==='object'?tournamentPrizeMoney:{};
    tournamentPrizeMoney.mode=tournamentPrizeMoney.mode==='fixed'?'fixed':'percent';
    tournamentPrizeMoney.returnPercent=Math.max(0,Math.min(100,Number(tournamentPrizeMoney.returnPercent??100)||0));
    tournamentPrizeMoney.fixedAmount=Math.max(0,Number(tournamentPrizeMoney.fixedAmount||0));
    tournamentPrizeMoney.bonus=Math.max(0,Number(tournamentPrizeMoney.bonus||0));
    if(!Array.isArray(tournamentPrizeMoney.payouts)||!tournamentPrizeMoney.payouts.length){
      tournamentPrizeMoney.payouts=[{label:'1. místo',count:1,percent:50},{label:'2. místo',count:1,percent:30},{label:'3. místo',count:1,percent:20}];
    }
    tournamentPrizeMoney.payouts=tournamentPrizeMoney.payouts.map((x,i)=>({
      label:String(x?.label||((i+1)+'. místo')),
      count:Math.max(1,Math.floor(Number(x?.count||1))),
      percent:Math.max(0,Number(x?.percent||0))
    }));
  }

  function syncTournamentPrizeMoneyForm(){
    normalizeTournamentPrizeMoney();
    if($('tournamentPrizeMode'))$('tournamentPrizeMode').value=tournamentPrizeMoney.mode;
    if($('tournamentPrizeReturnPercent'))$('tournamentPrizeReturnPercent').value=String(tournamentPrizeMoney.returnPercent);
    if($('tournamentPrizeFixedAmount'))$('tournamentPrizeFixedAmount').value=String(tournamentPrizeMoney.fixedAmount);
    if($('tournamentPrizeBonus'))$('tournamentPrizeBonus').value=String(tournamentPrizeMoney.bonus);
    $('tournamentPrizePercentField')?.classList.toggle('hidden',tournamentPrizeMoney.mode!=='percent');
    $('tournamentPrizeFixedField')?.classList.toggle('hidden',tournamentPrizeMoney.mode!=='fixed');
    renderTournamentPrizeMoney();
  }

  function tournamentPrizeCollected(){
    const fee=Math.max(0,Number($('tournamentEntryFee')?.value||0));
    return tournamentPaidPlayerIds().length*fee;
  }

  function tournamentPrizeBaseFromEntries(collected=tournamentPrizeCollected()){
    normalizeTournamentPrizeMoney();
    return tournamentPrizeMoney.mode==='fixed'
      ? Math.min(collected,Math.max(0,Number(tournamentPrizeMoney.fixedAmount||0)))
      : collected*Math.max(0,Math.min(100,Number(tournamentPrizeMoney.returnPercent||0)))/100;
  }

  function tournamentPrizeTotalPercent(){
    normalizeTournamentPrizeMoney();
    return tournamentPrizeMoney.payouts.reduce((sum,row)=>sum+(Math.max(1,Number(row.count||1))*Math.max(0,Number(row.percent||0))),0);
  }

  function tournamentPrizePool(){
    return tournamentPrizeBaseFromEntries()+Math.max(0,Number(tournamentPrizeMoney.bonus||0));
  }

  function renderTournamentPrizeMoney(){
    normalizeTournamentPrizeMoney();
    const collected=tournamentPrizeCollected();
    const fromEntries=tournamentPrizeBaseFromEntries(collected);
    const bonus=Math.max(0,Number(tournamentPrizeMoney.bonus||0));
    const pool=fromEntries+bonus;
    const organizer=Math.max(0,collected-fromEntries);
    const pct=tournamentPrizeTotalPercent();
    if($('tournamentPrizeMoneySummary')){
      $('tournamentPrizeMoneySummary').innerHTML=`
        <div class="grid four">
          <div>${statBox('VYBRÁNO',Math.round(collected).toLocaleString('cs-CZ')+' Kč')}</div>
          <div>${statBox('ZE STARTOVNÉHO DO PRIZE',Math.round(fromEntries).toLocaleString('cs-CZ')+' Kč')}</div>
          <div>${statBox('BONUS',Math.round(bonus).toLocaleString('cs-CZ')+' Kč')}</div>
          <div>${statBox('PRIZE MONEY CELKEM',Math.round(pool).toLocaleString('cs-CZ')+' Kč')}</div>
        </div>
        <div class="muted" style="margin-top:8px">Na náklady / pořadateli zůstává ze startovného: <strong>${Math.round(organizer).toLocaleString('cs-CZ')} Kč</strong>.</div>`;
    }
    if($('tournamentPrizeMoneyStatus')){
      $('tournamentPrizeMoneyStatus').textContent=Math.abs(pct-100)<0.001?'100 % ROZDĚLENO':(pct<100?'CHYBÍ '+(100-pct).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' %':'PŘEKROČENO O '+(pct-100).toLocaleString('cs-CZ',{maximumFractionDigits:2})+' %');
      $('tournamentPrizeMoneyStatus').classList.toggle('gold',Math.abs(pct-100)<0.001);
    }
    const rows=$('tournamentPrizePayoutRows');
    if(rows){
      rows.innerHTML=tournamentPrizeMoney.payouts.map((row,i)=>{
        const each=pool*Math.max(0,Number(row.percent||0))/100;
        const total=each*Math.max(1,Number(row.count||1));
        return `<div style="display:grid;grid-template-columns:minmax(130px,1.6fr) 90px 110px minmax(120px,1fr) auto;gap:8px;align-items:end;margin-top:8px">
          <div><label>Umístění</label><input value="${esc(row.label)}" onchange="updateTournamentPrizePayout(${i},'label',this.value)"></div>
          <div><label>Hráčů</label><input type="number" min="1" step="1" value="${Math.max(1,Number(row.count||1))}" onchange="updateTournamentPrizePayout(${i},'count',this.value)"></div>
          <div><label>% / hráč</label><input type="number" min="0" max="100" step="0.5" value="${Number(row.percent||0)}" onchange="updateTournamentPrizePayout(${i},'percent',this.value)"></div>
          <div style="padding-bottom:9px"><strong>${Math.round(each).toLocaleString('cs-CZ')} Kč / hráč</strong>${Number(row.count||1)>1?`<div class="muted">celkem ${Math.round(total).toLocaleString('cs-CZ')} Kč</div>`:''}</div>
          <button class="btn danger" onclick="removeTournamentPrizePayout(${i})" ${tournamentPrizeMoney.payouts.length<=1?'disabled':''}>×</button>
        </div>`;
      }).join('');
    }
    saveTournamentCheckinDraft();
  }

  window.updateTournamentPrizePayout=function(i,key,value){
    normalizeTournamentPrizeMoney();
    const row=tournamentPrizeMoney.payouts[i]; if(!row)return;
    if(key==='label')row.label=String(value||'').trim()||((i+1)+'. místo');
    else if(key==='count')row.count=Math.max(1,Math.floor(Number(value||1)));
    else if(key==='percent')row.percent=Math.max(0,Number(value||0));
    renderTournamentPrizeMoney();
  };
  window.removeTournamentPrizePayout=function(i){
    normalizeTournamentPrizeMoney();
    if(tournamentPrizeMoney.payouts.length<=1)return;
    tournamentPrizeMoney.payouts.splice(i,1);
    renderTournamentPrizeMoney();
  };

  function renderTournamentCheckinSummary(){
    const ids=tournamentAllCheckinIds();
    ids.forEach(ensureTournamentCheckinEntry);
    Object.keys(tournamentCheckin).forEach(id=>{if(!ids.includes(id))delete tournamentCheckin[id];});
    const paid=ids.filter(id=>tournamentCheckin[id]?.paid).length;
    const fee=Math.max(0,Number($('tournamentEntryFee')?.value||0));
    if($('tournamentCheckinPresent'))$('tournamentCheckinPresent').textContent=String(ids.length);
    if($('tournamentCheckinPaid'))$('tournamentCheckinPaid').textContent=paid+' / '+ids.length;
    if($('tournamentCheckinMoney'))$('tournamentCheckinMoney').textContent='Vybráno: '+(paid*fee).toLocaleString('cs-CZ')+' Kč'+(fee>0?' • očekáváno při platbě všech: '+(ids.length*fee).toLocaleString('cs-CZ')+' Kč':'');
    if($('tournamentCheckinState')){
      $('tournamentCheckinState').textContent=tournamentCheckinClosed?'UZAVŘENO':'OTEVŘENO';
      $('tournamentCheckinState').classList.toggle('gold',tournamentCheckinClosed);
    }
    $('tournamentCloseCheckinBtn')?.classList.toggle('hidden',tournamentCheckinClosed);
    $('tournamentReopenCheckinBtn')?.classList.toggle('hidden',!tournamentCheckinClosed);
    if($('tournamentMarkAllPaidBtn'))$('tournamentMarkAllPaidBtn').disabled=tournamentCheckinClosed || ids.length===0;
    if($('addTournamentPlayerBtn'))$('addTournamentPlayerBtn').disabled=tournamentCheckinClosed;
    if($('addTournamentGuestBtn'))$('addTournamentGuestBtn').disabled=tournamentCheckinClosed;
    if($('tournamentPlayerDropdown'))$('tournamentPlayerDropdown').disabled=tournamentCheckinClosed;
    if($('tournamentGuestName'))$('tournamentGuestName').disabled=tournamentCheckinClosed;
    if($('tournamentCheckinHint'))$('tournamentCheckinHint').textContent=tournamentCheckinClosed
      ? 'Prezence uzavřena • do nasazení vstupuje '+paid+' zaplacených hráčů.'
      : 'Po uzavření prezence se odemkne nasazení a elektronický los.';
    renderTournamentPrizeMoney();
    saveTournamentCheckinDraft();
  }

  window.toggleTournamentPaid=function(id){
    if(tournamentCheckinClosed){toast('Nejdřív znovu otevři prezenci.');return;}
    ensureTournamentCheckinEntry(id);
    tournamentCheckin[id].paid=!tournamentCheckin[id].paid;
    invalidateTournamentDraw();
    renderTournamentPlayerPicker();
  };

  function renderTournamentSelectedPlayers(){
    const wrap=$('tournamentSelectedPlayersList');
    if(!wrap)return;

    if(!tournamentSelectedPlayerIds.length){
      wrap.innerHTML='<div class="muted">Zatím není zapsaný žádný příchozí hráč.</div>';
      renderTournamentCheckinSummary();
      return;
    }

    tournamentSelectedPlayerIds.forEach(ensureTournamentCheckinEntry);
    wrap.innerHTML=tournamentSelectedPlayerIds.map((id,i)=>{
      const paid=!!tournamentCheckin[id]?.paid;
      return `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #29292d;flex-wrap:wrap">
        <span>
          <strong>${i+1}.</strong> ${esc(tournamentPlayerName(id))}
          ${data.players?.[id]?.placeholderProfile && !data.players?.[id]?.ownerUid
            ? '<span class="tournament-badge" style="margin-left:6px">PROFIL K PŘEVZETÍ</span>'
            : ''}
        </span>
        <div style="display:flex;gap:7px;align-items:center;flex-wrap:wrap">
          ${tournamentHandicapEnabled()?`<label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:900">HCP <input type="number" min="0" value="${tournamentPlayerHandicap(id)}" style="width:72px" onchange="setTournamentPlayerHandicap('${id}',this.value)" ${tournamentCheckinClosed?'disabled':''}></label>`:''}
          <button class="btn ${paid?'primary':''}" onclick="toggleTournamentPaid('${id}')" ${tournamentCheckinClosed?'disabled':''}>${paid?'✓ ZAPLACENO':'NEZAPLACENO'}</button>
          <button class="btn danger" onclick="removeTournamentSelectedPlayer('${id}')" ${tournamentCheckinClosed?'disabled':''}>ODEBRAT</button>
        </div>
      </div>`;
    }).join('');
    renderTournamentCheckinSummary();
  }

  window.removeTournamentSelectedPlayer=function(id){
    if(tournamentCheckinClosed){toast('Nejdřív znovu otevři prezenci.');return;}
    tournamentSelectedPlayerIds=tournamentSelectedPlayerIds.filter(x=>x!==id);
    manualTournamentSeedOrder=manualTournamentSeedOrder.filter(x=>x!==id);
    delete tournamentCheckin[id];
    invalidateTournamentDraw();
    renderTournamentPlayerPicker();
  };


  function updateTournamentSelectedCount(){
    const guestCount=document.querySelectorAll('.tournament-guest-check:checked').length;
    const n=tournamentSelectedPlayerIds.length+guestCount;
    if($('tournamentSelectedCount')) $('tournamentSelectedCount').textContent=n+' příchozích';
    renderTournamentCheckinSummary();
  }

  $('addTournamentPlayerBtn').onclick=()=>{
    const select=$('tournamentPlayerDropdown');
    const id=select?.value||'';
    if(!id)return;

    if(!tournamentSelectedPlayerIds.includes(id)){
      tournamentSelectedPlayerIds.push(id);
      ensureTournamentCheckinEntry(id);
      invalidateTournamentDraw();
    }

    renderTournamentPlayerPicker();
  };

  $('tournamentPlayerDropdown').addEventListener('keydown',e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      $('addTournamentPlayerBtn').click();
    }
  });


  $('addTournamentGuestBtn').onclick=async()=>{
    const input=$('tournamentGuestName');
    const btn=$('addTournamentGuestBtn');
    const name=String(input?.value||'').replace(/\s+/g,' ').trim();

    if(!name){toast('Zadej jméno neregistrovaného hráče.');return;}

    const normalized=normalizePlaceholderPlayerName(name);
    const exactProfiles=Object.values(data.players||{}).filter(p=>
      normalizePlaceholderPlayerName(p?.name)===normalized
    );

    // Pokud už skutečný profil existuje, hosta neduplikujeme.
    if(exactProfiles.length){
      toast('Hráč s tímto jménem už má profil. Vyber ho ze seznamu hráčů.');
      return;
    }

    // Stejného hosta nepřidáme do rozepsané prezence dvakrát.
    if(tournamentGuestDrafts.some(g=>normalizePlaceholderPlayerName(g?.name)===normalized)){
      toast('Tento host už je v seznamu příchozích.');
      return;
    }

    btn.disabled=true;
    try{
      const guest={
        id:'guest_'+uid(),
        name,
        createdAt:new Date().toISOString()
      };
      tournamentGuestDrafts.push(guest);
      ensureTournamentCheckinEntry(guest.id);
      invalidateTournamentDraw();
      input.value='';
      saveTournamentCheckinDraft();
      renderTournamentPlayerPicker();
      toast('Host byl přidán do turnaje.');
    }catch(e){
      console.error('Create tournament guest:',e);
      toast('Hosta se nepodařilo přidat.');
    }finally{
      btn.disabled=false;
    }
  };

  $('tournamentGuestName').addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();$('addTournamentGuestBtn').click();}
  });

  window.removeTournamentGuestDraft=function(id){
    if(tournamentCheckinClosed){toast('Nejdřív znovu otevři prezenci.');return;}
    tournamentGuestDrafts=tournamentGuestDrafts.filter(g=>g.id!==id);
    manualTournamentSeedOrder=manualTournamentSeedOrder.filter(x=>x!==id);
    delete tournamentCheckin[id];
    delete tournamentDrawNumbers[id];
    invalidateTournamentDraw();
    saveTournamentCheckinDraft();
    renderTournamentGuestDrafts();
    updateTournamentSelectedCount();
    renderTournamentSeedOrder();
  };


  function selectedTournamentPlayerIds(){
    const guestIds=[...document.querySelectorAll('.tournament-guest-check:checked')]
      .map(x=>x.value)
      .filter(Boolean);
    return [...tournamentSelectedPlayerIds,...guestIds];
  }

  function tournamentSeedingPlayerIds(){
    return tournamentCheckinClosed ? tournamentPaidPlayerIds() : [];
  }

  function invalidateTournamentDraw(){
    tournamentDrawNumbers={};
  }

  function tournamentDrawIsComplete(ids=selectedTournamentPlayerIds()){
    const selected=[...(ids||[])];
    if(!selected.length)return false;
    const nums=selected.map(id=>Number(tournamentDrawNumbers[id]));
    if(nums.some(n=>!Number.isInteger(n) || n<1 || n>selected.length))return false;
    return new Set(nums).size===selected.length;
  }

  function tournamentIdsSortedByDraw(ids){
    return [...(ids||[])].sort((a,b)=>
      Number(tournamentDrawNumbers[a]||999999)-Number(tournamentDrawNumbers[b]||999999)
    );
  }

  window.drawTournamentNumbers=function(){
    if(!tournamentCheckinClosed){toast('Nejdřív uzavři prezenci.');return;}
    const ids=tournamentSeedingPlayerIds();
    if(ids.length<2){
      toast('Pro losování vyber alespoň 2 hráče.');
      return;
    }

    const numbers=Array.from({length:ids.length},(_,i)=>i+1);
    for(let i=numbers.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [numbers[i],numbers[j]]=[numbers[j],numbers[i]];
    }

    tournamentDrawNumbers={};
    ids.forEach((id,i)=>tournamentDrawNumbers[id]=numbers[i]);
    renderTournamentSeedOrder();
    updateTournamentCreateButtonLabel();
    toast('Čísla byla vylosována.');
  };

  window.drawTournamentNumberFor=function(id){
    const ids=tournamentSeedingPlayerIds();
    if(!tournamentCheckinClosed){toast('Nejdřív uzavři prezenci.');return;}
    if(!ids.includes(id)){toast('Hráč není mezi potvrzenými účastníky.');return;}
    if(tournamentDrawNumbers[id])return;
    const used=new Set(Object.values(tournamentDrawNumbers).map(Number).filter(Boolean));
    const available=Array.from({length:ids.length},(_,i)=>i+1).filter(n=>!used.has(n));
    if(!available.length)return;
    const n=available[Math.floor(Math.random()*available.length)];
    tournamentDrawNumbers[id]=n;
    saveTournamentCheckinDraft();
    renderTournamentSeedOrder();
    updateTournamentCreateButtonLabel();
    toast(tournamentPlayerName(id)+' • vylosováno číslo '+n);
  };

  window.resetTournamentIndividualDraw=function(){
    if(!confirm('Zrušit dosavadní elektronický los?'))return;
    tournamentDrawNumbers={};
    saveTournamentCheckinDraft();
    renderTournamentSeedOrder();
    updateTournamentCreateButtonLabel();
  };

  function tournamentEloValue(id){
    // ELO nasazení používá stejné celkové ELO, které se zobrazuje v profilech hráčů.
    // Host / neregistrovaný hráč nemá historii a dostane výchozí hodnotu 1500.
    if(String(id||'').startsWith('guest_') || !data.players?.[id])return ELO_START;
    return playerElo(id);
  }

  function tournamentIdsSortedByElo(ids){
    return [...(ids||[])].sort((a,b)=>{
      const ea=tournamentEloValue(a), eb=tournamentEloValue(b);
      if(eb!==ea)return eb-ea;
      return tournamentPlayerName(a).localeCompare(tournamentPlayerName(b),'cs');
    });
  }

  function eloSnakeGroups(ids,groupCount){
    const sorted=tournamentIdsSortedByElo(ids);
    const count=Math.max(1,Math.min(Number(groupCount||1),sorted.length||1));
    const groups=Array.from({length:count},()=>[]);
    let index=0,dir=1;

    sorted.forEach(id=>{
      groups[index].push(id);
      if(count===1)return;
      if(dir===1){
        if(index===count-1)dir=-1;
        else index++;
      }else{
        if(index===0)dir=1;
        else index--;
      }
    });
    return groups;
  }

  function updateTournamentCreateButtonLabel(){
    const btn=$('createTournamentBtn');
    if(!btn)return;
    const mode=$('tournamentSeedingMode')?.value||'random';
    btn.textContent=mode==='manual'
      ? 'NASADIT DLE RUČNÍHO POŘADÍ'
      : (mode==='elo'
          ? 'NASADIT DLE ELO'
          : ((mode==='draw'||mode==='draw_individual') ? 'VYTVOŘIT TURNAJ DLE LOSU' : 'ROZLOSOVAT TURNAJ'));
    btn.disabled=!tournamentCheckinClosed;
  }

  function manualGroupSeedLayout(ids,groupCount){
    const count=Math.max(1,Math.min(Number(groupCount||1),ids.length||1));
    const base=Math.floor(ids.length/count);
    const remainder=ids.length%count;
    const groups=[];
    let offset=0;

    for(let gi=0;gi<count;gi++){
      const size=base+(gi<remainder?1:0);
      groups.push({
        index:gi,
        label:String.fromCharCode(65+gi),
        ids:ids.slice(offset,offset+size)
      });
      offset+=size;
    }
    return groups;
  }

  function renderTournamentSeedOrder(){
    const panel=$('tournamentManualSeedingPanel');
    const wrap=$('tournamentSeedOrder');
    if(!panel || !wrap)return;

    const mode=$('tournamentSeedingMode')?.value||'random';
    const manual=mode==='manual';
    const eloMode=mode==='elo';
    const drawMode=mode==='draw';
    const drawIndividualMode=mode==='draw_individual';
    panel.classList.toggle('hidden',!(manual||eloMode||drawMode||drawIndividualMode));
    if(!(manual||eloMode||drawMode||drawIndividualMode))return;

    const selected=tournamentSeedingPlayerIds();
    if(!tournamentCheckinClosed){
      wrap.innerHTML='<div class="muted">Nejdřív uzavři prezenci. Potom se odemkne nasazení a los.</div>';
      return;
    }

    if(drawIndividualMode){
      const help=$('tournamentManualSeedingHelp');
      const complete=tournamentDrawIsComplete(selected);
      panel.querySelector('strong').textContent='INDIVIDUÁLNÍ ELEKTRONICKÝ LOS';
      if(help)help.textContent='Hráči losují postupně. Každý dostane jedno náhodné číslo z dosud volných čísel 1 až '+selected.length+'.';
      const ordered=[...selected].sort((a,b)=>{
        const na=Number(tournamentDrawNumbers[a]||999999), nb=Number(tournamentDrawNumbers[b]||999999);
        if(na!==nb)return na-nb;
        return tournamentPlayerName(a).localeCompare(tournamentPlayerName(b),'cs');
      });
      wrap.innerHTML=`
        <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <span class="muted">Vylosováno ${selected.filter(id=>tournamentDrawNumbers[id]).length} / ${selected.length}</span>
          <button class="btn" onclick="resetTournamentIndividualDraw()" ${Object.keys(tournamentDrawNumbers).length?'':'disabled'}>↻ ZRUŠIT LOS</button>
        </div>
        ${ordered.map(id=>{
          const n=Number(tournamentDrawNumbers[id]||0);
          return `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid #29292d;flex-wrap:wrap">
            <strong>${esc(tournamentPlayerName(id))}</strong>
            ${n
              ? `<span class="tournament-badge gold" style="font-size:15px">ČÍSLO ${n}</span>`
              : `<button class="btn primary" onclick="drawTournamentNumberFor('${id}')">🎲 LOSOVAT</button>`}
          </div>`;
        }).join('')}
        ${complete?'<div style="margin-top:12px;font-weight:950;color:var(--gold2)">✓ LOS JE KOMPLETNÍ</div>':''}
      `;
      return;
    }

    if(drawMode){
      const help=$('tournamentManualSeedingHelp');
      const complete=tournamentDrawIsComplete(selected);
      panel.querySelector('strong').textContent='LOSOVÁNÍ ČÍSEL';
      if(help)help.textContent='Každý hráč dostane náhodně jedno unikátní číslo od 1 do počtu účastníků. Podle vylosovaného čísla se následně určí pořadí nasazení.';
      wrap.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
          <span class="muted">${selected.length ? 'Rozsah losu: 1–'+selected.length : 'Nejdřív vyber hráče.'}</span>
          <button class="btn primary" onclick="drawTournamentNumbers()" ${selected.length<2?'disabled':''}>🎲 ${complete?'LOSOVAT ZNOVU':'VYLOSOVAT ČÍSLA'}</button>
        </div>
        ${complete
          ? tournamentIdsSortedByDraw(selected).map(id=>`
              <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #29292d">
                <span>${esc(tournamentPlayerName(id))}</span>
                <span class="tournament-badge gold" style="font-size:15px">ČÍSLO ${Number(tournamentDrawNumbers[id])}</span>
              </div>`).join('')
          : '<div class="muted">Čísla zatím nejsou vylosována.</div>'}
      `;
      return;
    }

    panel.querySelector('strong').textContent=manual?'RUČNÍ NASAZENÍ':'NASAZENÍ DLE ELO';

    if(eloMode){
      const sorted=tournamentIdsSortedByElo(selected);
      const format=$('tournamentFormat')?.value||'dko';
      const groupMode=['groups','groups_sko','groups_dko'].includes(format);
      const groupCount=format==='groups'
        ? 1
        : Math.max(1,parseInt($('tournamentGroupCount')?.value||'2',10));

      $('tournamentManualSeedingHelp').textContent=groupMode && groupCount>1
        ? 'Hráči jsou seřazeni podle celkového ELO od nejvyššího. Do skupin se rozdělí hadovitě, aby byly co nejvyrovnanější.'
        : (['sko','dko'].includes(format)
            ? 'Hráči jsou seřazeni podle celkového ELO. Nejvýše nasazení jsou rozmístěni do různých částí pavouka.'
            : 'Hráči jsou seřazeni podle celkového ELO od nejvyššího. Toto pořadí určuje výchozí nasazení.');

      if(groupMode && groupCount>1){
        const groups=eloSnakeGroups(sorted,groupCount);
        wrap.innerHTML=groups.map((ids,gi)=>`
          <div class="subpanel" style="margin-bottom:12px;border-color:rgba(212,175,55,.38)">
            <strong style="color:var(--gold2)">SKUPINA ${String.fromCharCode(65+gi)}</strong>
            <div style="margin-top:7px">
              ${ids.map((id,pos)=>`
                <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #29292d">
                  <span><strong>${pos+1}.</strong> ${esc(tournamentPlayerName(id))}</span>
                  <span class="elo-badge">ELO ${tournamentEloValue(id)}</span>
                </div>`).join('')}
            </div>
          </div>`).join('');
      }else{
        wrap.innerHTML=sorted.map((id,pos)=>`
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #29292d">
            <span><strong>${pos+1}.</strong> ${esc(tournamentPlayerName(id))}</span>
            <span class="elo-badge">ELO ${tournamentEloValue(id)}</span>
          </div>`).join('');
      }
      return;
    }

    
    manualTournamentSeedOrder=manualTournamentSeedOrder.filter(id=>selected.includes(id));
    selected.forEach(id=>{if(!manualTournamentSeedOrder.includes(id))manualTournamentSeedOrder.push(id);});

    const format=$('tournamentFormat')?.value||'dko';
    const directKO=['sko','dko'].includes(format);
    const swissMode=format==='swiss';
    const groupMode=['groups','groups_sko','groups_dko'].includes(format);
    const help=$('tournamentManualSeedingHelp');

    if(help){
      help.textContent=directKO
        ? 'Pořadí určuje přímo pozice v 1. kole pavouka: 1 vs 2, 3 vs 4, 5 vs 6… Hráče můžeš posouvat nahoru a dolů.'
        : (swissMode
            ? 'Pořadí určuje výchozí nasazení pro 1. kolo. V dalších kolech se hráči párují podle aktuálních bodů a pokud možno bez opakovaného soupeře.'
            : 'Každá skupina má vlastní nasazení od pozice 1. Hráče řadíš zvlášť ve skupině A, B, C…');
    }

    if(groupMode){
      const groupCount=format==='groups'
        ? 1
        : Math.max(1,parseInt($('tournamentGroupCount')?.value||'2',10));
      const groups=manualGroupSeedLayout(manualTournamentSeedOrder,groupCount);

      wrap.innerHTML=groups.map(g=>`
        <div class="subpanel" style="margin-bottom:12px;border-color:rgba(212,175,55,.38)">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
            <strong style="color:var(--gold2);font-size:17px">SKUPINA ${g.label}</strong>
            <span class="muted">${g.ids.length} hráčů</span>
          </div>
          ${g.ids.map((id,pos)=>{
            const globalIndex=manualTournamentSeedOrder.indexOf(id);
            const firstGlobal=manualTournamentSeedOrder.indexOf(g.ids[0]);
            const lastGlobal=manualTournamentSeedOrder.indexOf(g.ids[g.ids.length-1]);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid #29292d">
                <span><strong>${pos+1}.</strong> ${esc(tournamentPlayerName(id))}</span>
                <span style="display:flex;gap:6px">
                  <button class="btn" ${globalIndex===firstGlobal?'disabled':''} onclick="moveTournamentSeedInGroup('${id}',-1)">↑</button>
                  <button class="btn" ${globalIndex===lastGlobal?'disabled':''} onclick="moveTournamentSeedInGroup('${id}',1)">↓</button>
                </span>
              </div>`;
          }).join('')}
        </div>
      `).join('');
      return;
    }

    wrap.innerHTML=manualTournamentSeedOrder.map((id,i)=>{
      const matchNo=Math.floor(i/2)+1;
      const side=i%2===0?'A':'B';
      const slotLabel=directKO?`Zápas ${matchNo} • pozice ${side}`:`Pozice ${i+1}`;
      return `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #29292d">
          <span>
            <strong>${i+1}.</strong> ${esc(tournamentPlayerName(id))}
            <span class="muted" style="margin-left:8px">${esc(slotLabel)}</span>
          </span>
          <span style="display:flex;gap:6px">
            <button class="btn" ${i===0?'disabled':''} onclick="moveTournamentSeed('${id}',-1)">↑</button>
            <button class="btn" ${i===manualTournamentSeedOrder.length-1?'disabled':''} onclick="moveTournamentSeed('${id}',1)">↓</button>
          </span>
        </div>`;
    }).join('');

    if(directKO && manualTournamentSeedOrder.length){
      const pairs=[];
      for(let i=0;i<manualTournamentSeedOrder.length;i+=2){
        const a=manualTournamentSeedOrder[i];
        const b=manualTournamentSeedOrder[i+1];
        pairs.push(`<div style="padding:6px 0;border-bottom:1px solid #29292d">
          <strong>Zápas ${Math.floor(i/2)+1}:</strong>
          ${esc(tournamentPlayerName(a))} <span class="muted">vs</span> ${b?esc(tournamentPlayerName(b)):'BYE'}
        </div>`);
      }
      wrap.innerHTML+=`<div class="subpanel" style="margin-top:10px">
        <strong>NÁHLED 1. KOLA</strong>
        <div style="margin-top:6px">${pairs.join('')}</div>
      </div>`;
    }
  }

  window.moveTournamentSeed=function(id,dir){
    const i=manualTournamentSeedOrder.indexOf(id);
    const j=i+dir;
    if(i<0||j<0||j>=manualTournamentSeedOrder.length)return;
    [manualTournamentSeedOrder[i],manualTournamentSeedOrder[j]]=[manualTournamentSeedOrder[j],manualTournamentSeedOrder[i]];
    renderTournamentSeedOrder();
  };

  window.moveTournamentSeedInGroup=function(id,dir){
    const groupCount=Math.max(1,parseInt($('tournamentGroupCount')?.value||'2',10));
    const groups=manualGroupSeedLayout(manualTournamentSeedOrder,groupCount);
    const group=groups.find(g=>g.ids.includes(id));
    if(!group)return;

    const localIndex=group.ids.indexOf(id);
    const targetLocal=localIndex+dir;
    if(targetLocal<0||targetLocal>=group.ids.length)return;

    const otherId=group.ids[targetLocal];
    const i=manualTournamentSeedOrder.indexOf(id);
    const j=manualTournamentSeedOrder.indexOf(otherId);
    if(i<0||j<0)return;

    [manualTournamentSeedOrder[i],manualTournamentSeedOrder[j]]=[manualTournamentSeedOrder[j],manualTournamentSeedOrder[i]];
    renderTournamentSeedOrder();
  };

  $('tournamentSeedingMode').addEventListener('change',()=>{
    renderTournamentSeedOrder();
    updateTournamentCreateButtonLabel();
  });
  if($('tournamentGroupCount')){
    $('tournamentGroupCount').addEventListener('change',renderTournamentSeedOrder);
    $('tournamentGroupCount').addEventListener('input',renderTournamentSeedOrder);
  }
  if($('tournamentVariableRace')){
    $('tournamentVariableRace').addEventListener('change',()=>{
      $('tournamentVariableRaceFields')?.classList.toggle('hidden',!$('tournamentVariableRace').checked);
    });
  }


  function tournamentMatchObject(player1Id,player2Id,roundLabel,bracket=''){
    return {id:uid(),player1Id,player2Id,roundLabel,bracket,status:'pending',tableNumber:null,score1:null,score2:null,winnerId:null,loserId:null,scoreboardMatchId:null};
  }

  function tournamentRaceStageSettingsFromForm(){
    if(!$('tournamentVariableRace')?.checked)return null;
    const read=id=>{
      const raw=String($(id)?.value||'').trim();
      if(!raw)return null;
      const n=parseInt(raw,10);
      return Number.isFinite(n)&&n>0?n:null;
    };
    return {
      groups:read('raceStageGroups'),
      last32:read('raceStage32'),
      last16:read('raceStage16'),
      last8:read('raceStage8'),
      semifinal:read('raceStage4'),
      final:read('raceStage2'),
      bronze:read('raceStageBronze')
    };
  }

  function tournamentMatchIsGroupMatch(t,m){
    if(!t||!m||!Array.isArray(t.groups))return false;
    return t.groups.some(g=>(g.matches||[]).some(x=>x.id===m.id));
  }

  function tournamentRoundContainingMatch(t,m){
    if(!t||!m)return null;
    for(const r of (t.ko?.rounds||[])){
      if((r.matches||[]).some(x=>x.id===m.id))return r;
    }
    for(const r of (t.dko?.rounds||[])){
      if((r.matches||[]).some(x=>x.id===m.id))return r;
    }
    for(const r of (t.swiss?.rounds||[])){
      if((r.matches||[]).some(x=>x.id===m.id))return r;
    }
    return null;
  }

  function tournamentStageForMatch(t,m){
    if(!t||!m)return null;
    if(tournamentMatchIsGroupMatch(t,m))return 'groups';
    if(m.bracket==='3P')return 'bronze';
    if(m.bracket==='F'||m.bracket==='GF')return 'final';

    const round=tournamentRoundContainingMatch(t,m);
    if(round){
      const ids=new Set();
      (round.matches||[]).forEach(x=>{
        if(x.player1Id)ids.add(x.player1Id);
        if(x.player2Id)ids.add(x.player2Id);
      });
      (round.byes||[]).forEach(x=>{if(x.playerId)ids.add(x.playerId);});
      const count=ids.size;
      if(count<=2)return 'final';
      if(count<=4)return 'semifinal';
      if(count<=8)return 'last8';
      if(count<=16)return 'last16';
      if(count<=32)return 'last32';
    }

    // Záloha pro dynamické DKO vlny: počet dosud aktivních hráčů.
    let activeCount=0;
    if(t.dko){
      activeCount=(t.dko.participantIds||t.playerIds||[]).filter(id=>(t.dko.losses?.[id]||0)<2).length;
    }else if(t.ko){
      activeCount=(t.ko.participantIds||t.playerIds||[]).filter(id=>!(t.ko.eliminatedIds||[]).includes(id)).length;
    }
    if(activeCount<=2)return 'final';
    if(activeCount<=4)return 'semifinal';
    if(activeCount<=8)return 'last8';
    if(activeCount<=16)return 'last16';
    if(activeCount<=32)return 'last32';
    return null;
  }

  function tournamentHandicapForPlayer(t,id){
    return t?.handicapEnabled ? Math.max(0,Number(t.playerHandicaps?.[id]||0)) : 0;
  }

  function tournamentRaceForMatch(t,m){
    const base=Math.max(1,Number(t?.raceTo||1));
    if(!t?.variableRaceEnabled || !t?.raceByStage)return base;
    const stage=tournamentStageForMatch(t,m);
    const n=stage?Number(t.raceByStage[stage]||0):0;
    return Number.isFinite(n)&&n>0?n:base;
  }

  function tournamentDisciplineForMatch(t,m){
    if(!t)return '9-ball';
    const base=t.groupDiscipline||t.discipline||'9-ball';
    const isHybrid=['groups_sko','groups_dko'].includes(t.format);
    if(!isHybrid)return t.discipline||base;

    return tournamentMatchIsGroupMatch(t,m)
      ? base
      : (t.playoffDiscipline||t.discipline||base);
  }

  function tournamentDisciplineSummary(t){
    if(!t)return '';
    const base=(t.groupDiscipline||t.discipline||'').toUpperCase();
    const isHybrid=['groups_sko','groups_dko'].includes(t.format);
    if(!isHybrid)return (t.discipline||base||'').toUpperCase();

    const playoff=(t.playoffDiscipline||t.discipline||base||'').toUpperCase();
    return base===playoff
      ? base
      : ('SKUPINY '+base+' → PAVOUK '+playoff);
  }

  function tournamentStageLabel(stage){
    return {
      groups:'Skupiny',
      last32:'Last 32',
      last16:'Last 16',
      last8:'Last 8',
      semifinal:'Semifinále',
      final:'Finále',
      bronze:'O 3. místo'
    }[stage]||'';
  }


  function tournamentHasGroups(t){
    return !!(t && ['groups','groups_sko','groups_dko'].includes(t.format));
  }

  function tournamentHasSwiss(t){
    return !!(t && t.format==='swiss' && t.swiss);
  }

  function tournamentHasSKO(t){
    return !!(t && (t.format==='sko'||t.format==='groups_sko'||(t.format==='dko'&&t.ko)) && t.ko);
  }

  function tournamentHasDKO(t){
    return !!(t && (t.format==='dko'||t.format==='groups_dko') && t.dko);
  }

  function tournamentFormatLabel(t){
    if(!t)return '';
    if(t.format==='swiss' && Number(t.swiss?.advanceToSko||0)>=2){
      return 'Švýcarský systém → SKO';
    }
    if(t.format==='dko' && Number(t.dko?.skoCut||0)>0){
      return 'DKO → SKO • Last '+Number(t.dko.skoCut);
    }
    return {
      sko:'SKO – jedna prohra',
      dko:'DKO – dvojité vyřazení',
      groups:'Skupiny – každý s každým',
      groups_sko:'Skupiny → SKO',
      groups_dko:'Skupiny → DKO',
      swiss:'Švýcarský systém'
    }[t.format]||t.format||'Turnaj';
  }

