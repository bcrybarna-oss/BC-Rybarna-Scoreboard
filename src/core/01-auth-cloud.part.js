  function canWriteGlobalAppData(){
    // /appData je společná globální konfigurace. Běžný hráč ji pouze čte.
    // Zápasy, profily, turnaje, liga a stream se zapisují do vlastních zabezpečených větví.
    return currentUserIsSystemAdmin();
  }

  function cloudUrl(path){
    return FIREBASE_DB+'/'+path+'.json?auth='+encodeURIComponent(cloudIdToken);
  }

  async function uploadCloudData(){
    if(cloudSyncInProgress) return;
    if(!await ensureCloudToken()) return;
    // Globální /appData smí měnit pouze systémový administrátor.
    // Tím běžný registrovaný uživatel nemůže přepsat společnou konfiguraci aplikace.
    if(!canWriteGlobalAppData()) return;
    cloudSyncInProgress=true;
    try{
      // Nejdřív vždy přečteme cloud a sloučíme ho s lokálními daty.
      // Tím zařízení nemůže vymazat zápasy/hráče, které samo lokálně nezná.
      let remote=null;
      let remoteTs=0;
      try{
        const gr=await fetch(cloudUrl('appData')+'&t='+Date.now(),{cache:'no-store'});
        if(gr.ok){
          remote=await gr.json();
          remoteTs=Number(remote&&remote.updatedAt||0);
        }
      }catch(e){}

      if(remote && remote.data){
        saveSafetyBackup('before cloud upload merge');
        cloudApplyingRemote=true;
        try{
          // Hráči už žijí pouze v zabezpečené větvi /players.
          const remoteAppData=JSON.parse(JSON.stringify(remote.data));
          delete remoteAppData.players;
          delete remoteAppData.matches;
          delete remoteAppData.deletedMatchIds;
          delete remoteAppData.tournaments;
          delete remoteAppData.leagues;

          // Lokální změna je právě ta, kterou uploadujeme, proto při shodném ID preferujeme lokální verzi.
          data=mergeDataObjects(data,remoteAppData,false);
          try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
        }finally{
          cloudApplyingRemote=false;
        }
      }

      const updatedAt=Math.max(Date.now(),remoteTs+1);
      const cloudData=JSON.parse(JSON.stringify(data));
      delete cloudData.players;
      delete cloudData.matches;
      delete cloudData.deletedMatchIds;
      delete cloudData.tournaments;
      delete cloudData.leagues;
      cloudData.currentMatch=null;
      const payload={updatedAt,data:cloudData};
      const r=await fetch(cloudUrl('appData'),{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),
        cache:'no-store'
      });
      if(!r.ok) throw new Error('CLOUD_WRITE_'+r.status);
      try{localStorage.setItem(CLOUD_LOCAL_TS_KEY,String(updatedAt));}catch(e){}
      cloudLastError='';
      setCloudStatus('ONLINE • AUTO',true);
    }catch(e){
      cloudLastError=String(e.message||e);
      setCloudStatus('CHYBA',false);
      console.warn('Cloud sync:',e);
    }finally{
      cloudSyncInProgress=false;
    }
  }

  function scheduleCloudDataSync(){
    if(!cloudAuthenticated || cloudApplyingRemote || !canWriteGlobalAppData()) return;
    if(cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer=setTimeout(uploadCloudData,450);
  }

  async function pollCloudData(){
    if(cloudPollInProgress || cloudSyncInProgress || cloudApplyingRemote) return;
    if(!document.hidden && await ensureCloudToken()){
      cloudPollInProgress=true;
      try{
        const r=await fetch(cloudUrl('appData')+'&t='+Date.now(),{cache:'no-store'});
        if(!r.ok) throw new Error('CLOUD_READ_'+r.status);
        const cloud=await r.json();
        if(!cloud || !cloud.data) return;

        const cloudTs=Number(cloud.updatedAt||0);
        const localTs=localCloudTimestamp();

        // Jiný telefon/PC uložil novější stav -> automaticky ho převezmeme.
        // Pokud máme čerstvější lokální změnu čekající na upload, nepřepisujeme ji.
        if(cloudTs>localTs+500){
          saveSafetyBackup('before cloud download');
          cloudApplyingRemote=true;
          try{
            const remoteAppData=JSON.parse(JSON.stringify(cloud.data));
            delete remoteAppData.players;
            delete remoteAppData.matches;
            delete remoteAppData.deletedMatchIds;
            delete remoteAppData.tournaments;
            delete remoteAppData.leagues;
              const merged=mergeDataObjects(data,remoteAppData,true);
            writeLocalWithoutCloudSync(merged,cloudTs);
            refreshViewsAfterCloudLoad();
          }finally{
            cloudApplyingRemote=false;
          }
          setCloudStatus('ONLINE • AUTO',true);
        }else{
          setCloudStatus('ONLINE • AUTO',true);
        }
        cloudLastError='';
      }catch(e){
        cloudLastError=String(e.message||e);
        console.warn('Cloud auto sync:',e);
      }finally{
        cloudPollInProgress=false;
      }
    }
  }

  function startCloudAutoSync(){
    if(cloudPollTimer) clearInterval(cloudPollTimer);
    cloudPollTimer=setInterval(pollCloudData,CLOUD_POLL_MS);
    setTimeout(pollCloudData,700);
    setCloudStatus('ONLINE • AUTO',true);
  }

  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden && cloudAuthenticated){
      pollCloudData();
      Promise.all([loadSecureMatches(),loadSecureTournaments()])
        .then(()=>{try{renderHistory();renderStats();renderPlayers();renderTournament();}catch(e){}})
        .catch(()=>{});
    }
  });

  async function initialCloudMerge(){
    if(!await ensureCloudToken()) return false;
    setCloudStatus('SYNC…',true);

    const r=await fetch(cloudUrl('appData')+'&t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('CLOUD_READ_'+r.status);
    const cloud=await r.json();

    // Prázdný globální cloud smí inicializovat pouze systémový administrátor.
    // Běžný hráč nesmí vytvořit/přepsat společnou /appData větev.
    if(!cloud || !cloud.data){
      if(canWriteGlobalAppData()) await uploadCloudData();
      return true;
    }

    const cloudTs=Number(cloud.updatedAt||0);
    const localTs=localCloudTimestamp();

    // Pokud byly na tomto zařízení po poslední cloud synchronizaci provedeny offline změny,
    // lokální verze vyhraje. Jinak je hlavním zdrojem cloud.
    if(localTs>cloudTs+1500){
      await uploadCloudData();
    }else{
      saveSafetyBackup('before initial cloud merge');
      cloudApplyingRemote=true;
      try{
        const remoteAppData=JSON.parse(JSON.stringify(cloud.data));
        delete remoteAppData.players;
        delete remoteAppData.matches;
        delete remoteAppData.deletedMatchIds;
        delete remoteAppData.tournaments;
        const merged=mergeDataObjects(data,remoteAppData,true);
        writeLocalWithoutCloudSync(merged,cloudTs);
        refreshViewsAfterCloudLoad();
      }finally{
        cloudApplyingRemote=false;
      }
      setCloudStatus('ONLINE • AUTO',true);
    }
    startCloudAutoSync();
    return true;
  }

  async function cloudLoginFromModal(){
    const email=$('cloudEmail').value.trim();
    const password=$('cloudPassword').value;
    if(!email || !password){
      $('cloudLoginMessage').textContent='Vyplň e-mail i heslo.';
      return;
    }

    $('cloudLoginBtn').disabled=true;
    $('cloudLoginMessage').textContent='Přihlašuji…';
    try{
      await firebaseSignIn(email,password);

      if(!await ensureVerifiedBeforeApp()){
        $('cloudLoginMessage').textContent='Nejdřív ověř svůj e-mail.';
        return;
      }

      await ensureUserAccessRecord(true);
      await loadOwnProfileClaim();
      $('cloudLoginMessage').textContent='Přihlášeno. Synchronizuji data…';
      await initialCloudMerge();
      await loadSecurePlayers();
      await loadSecureMatches();
      await loadSecureTournaments();
      await promoteLegacyTournamentGuestsToProfiles();
      $('cloudLoginModal').classList.remove('show');
      $('cloudPassword').value='';
      refreshAccountUI();
      renderPlayers();
      toast('Cloud synchronizace aktivní.');
    }catch(e){
      console.warn('Firebase login error:',e);
      const code=String(e && e.message ? e.message : e || 'UNKNOWN_ERROR');
      let msg='Přihlášení se nepodařilo.';

      if(code.includes('INVALID_LOGIN_CREDENTIALS') || code.includes('INVALID_PASSWORD')){
        msg='Nesprávný e-mail nebo heslo.';
      }else if(code.includes('EMAIL_NOT_FOUND')){
        msg='Tento e-mail ve Firebase Authentication neexistuje.';
      }else if(code.includes('OPERATION_NOT_ALLOWED')){
        msg='Email/Password přihlašování není ve Firebase povolené.';
      }else if(code.includes('USER_DISABLED')){
        msg='Tento Firebase uživatel je zakázaný.';
      }else if(code.includes('API_KEY_INVALID') || code.includes('INVALID_API_KEY')){
        msg='Firebase API key není platný.';
      }else if(code.includes('TOO_MANY_ATTEMPTS')){
        msg='Příliš mnoho pokusů. Zkus to později.';
      }else if(code.includes('NETWORK') || code.includes('Failed to fetch')){
        msg='Nepodařilo se spojit s Firebase. Zkontroluj internet.';
      }

      $('cloudLoginMessage').innerHTML =
        msg +
        '<div style="margin-top:8px;font-size:12px;word-break:break-word;color:#ffb3b3">' +
        'Firebase: <strong>' + code.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</strong>' +
        '</div>';

      clearRuntimeCloudIdentity();
      setCloudStatus('OFFLINE',false);
    }finally{
      $('cloudLoginBtn').disabled=false;
    }
  }

  async function autoCloudInit(){
    setCloudStatus('PŘIPOJUJI…',false);

    const persisted=persistedCloudSession();
    let savedEmail=persisted.email||'';
    let savedRefresh=persisted.refresh||'';

    $('cloudEmail').value=savedEmail;

    if(persisted.expiredAdminPersistence){
      $('cloudLoginMessage').textContent='Admin účet byl z bezpečnostních důvodů odhlášen. Přihlas se znovu.';
    }

    if(savedRefresh){
      try{
        cloudRefreshToken=savedRefresh;
        cloudUserEmail=savedEmail||'';
        await firebaseRefreshAuth(savedRefresh);

        if(!await ensureVerifiedBeforeApp()){
          return;
        }

        await ensureUserAccessRecord(true);
        await loadOwnProfileClaim();
        await initialCloudMerge();
      await loadSecurePlayers();
      await loadSecureMatches();
      await loadSecureTournaments();
      await promoteLegacyTournamentGuestsToProfiles();
        return;
      }catch(e){
        console.warn('Cloud auto login:',e);
        clearRuntimeCloudIdentity();
      }
    }

    clearRuntimeCloudIdentity();
    setCloudStatus('PŘIHLÁSIT',false);
    $('cloudLoginMessage').textContent='';
    $('cloudLoginModal').classList.add('show');
  }



  $('emailVerifyResendBtn').onclick=async()=>{
    $('emailVerifyResendBtn').disabled=true;
    $('emailVerifyMessage').textContent='Odesílám ověřovací e-mail…';
    try{
      const result=await sendVerificationEmail();
      if(result&&result.alreadyVerified){
        $('emailVerifyMessage').textContent='Tento e-mail už je ověřený.';
      }else{
        $('emailVerifyMessage').textContent='Firebase přijal požadavek na odeslání pro '+((result&&result.email)||cloudUserEmail||'tento účet')+'. Pokud zpráva nepřijde během několika minut, dej mi vědět.';
      }
    }catch(e){
      $('emailVerifyMessage').textContent='Odeslání se nepodařilo: '+String(e.message||e);
    }finally{
      $('emailVerifyResendBtn').disabled=false;
    }
  };

  $('emailVerifyCheckBtn').onclick=async()=>{
    $('emailVerifyCheckBtn').disabled=true;
    $('emailVerifyMessage').textContent='Kontroluji ověření…';

    try{
      if(!await ensureVerifiedBeforeApp()){
        $('emailVerifyMessage').textContent='E-mail zatím není ověřený. Klikni na odkaz v e-mailu a zkus to znovu.';
        return;
      }

      await ensureUserAccessRecord(true);
      await loadOwnProfileClaim();
      await initialCloudMerge();
      await loadSecurePlayers();
      await loadSecureMatches();
      await loadSecureTournaments();
      await promoteLegacyTournamentGuestsToProfiles();

      $('emailVerifyModal').classList.remove('show');
      setCloudStatus('ONLINE • AUTO',true);
      startCloudAutoSync();
      refreshAccountUI();
      renderPlayers();
      toast('E-mail je ověřen. Vítej v Poolčítadle.');
    }catch(e){
      $('emailVerifyMessage').textContent='Kontrola se nepodařila: '+String(e.message||e);
    }finally{
      $('emailVerifyCheckBtn').disabled=false;
    }
  };

  $('emailVerifyLogoutBtn').onclick=()=>{
    if(confirm('Odhlásit tento účet?')){
      logoutFromApp();
      $('emailVerifyModal').classList.remove('show');
    }
  };

  $('cloudRegisterBtn').onclick=async()=>{
    const email=$('cloudEmail').value.trim();
    const password=$('cloudPassword').value;
    if(!email || !password){
      $('cloudLoginMessage').textContent='Pro registraci vyplň e-mail i heslo.';
      return;
    }
    if(password.length<6){
      $('cloudLoginMessage').textContent='Heslo musí mít alespoň 6 znaků.';
      return;
    }

    $('cloudRegisterBtn').disabled=true;
    $('cloudLoginMessage').textContent='Vytvářím účet…';
    try{
      await firebaseRegister(email,password);
      $('cloudLoginMessage').textContent='Účet vytvořen. Ověř prosím svůj e-mail.';
      $('cloudPassword').value='';
      showEmailVerificationGate();
      toast('Firebase přijal požadavek na ověřovací e-mail.');
    }catch(e){
      const code=String(e&&e.message?e.message:e||'');
      if(code.includes('EMAIL_EXISTS')) $('cloudLoginMessage').textContent='Účet s tímto e-mailem už existuje.';
      else if(code.includes('WEAK_PASSWORD')) $('cloudLoginMessage').textContent='Heslo je příliš slabé.';
      else $('cloudLoginMessage').textContent='Registrace se nepodařila: '+code;
    }finally{
      $('cloudRegisterBtn').disabled=false;
    }
  };

  if($('refreshRegisteredUsersBtn'))$('refreshRegisteredUsersBtn').onclick=()=>renderRegisteredUsersAdmin(true);

  $('cloudRestoreBackupBtn').onclick=restoreSafetyBackup;

  function logoutFromApp(){
    // Rozehraný zápas je lokální a zůstává zachovaný.
    if(match) saveDeviceActiveMatch(match);

    cloudRefreshToken='';
    clearRuntimeCloudIdentity();

    if(cloudPollTimer){
      clearInterval(cloudPollTimer);
      cloudPollTimer=null;
    }

    try{
      localStorage.removeItem(CLOUD_REFRESH_KEY);
      localStorage.removeItem(CLOUD_EMAIL_KEY);
      sessionStorage.removeItem(CLOUD_ADMIN_SESSION_REFRESH_KEY);
      sessionStorage.removeItem(CLOUD_ADMIN_SESSION_EMAIL_KEY);
    }catch(e){}

    setCloudStatus('OFFLINE',false);
    refreshAccountUI();
    renderPlayers();

    $('cloudEmail').value='';
    $('cloudPassword').value='';
    $('cloudLoginMessage').textContent='Byl jsi odhlášen. Přihlas se nebo si vytvoř nový účet.';
    if($('cloudRegisterBtn')){
      $('cloudRegisterBtn').style.display='';
      $('cloudRegisterBtn').disabled=false;
    }
    if($('cloudLoginBtn')){
      $('cloudLoginBtn').style.display='';
      $('cloudLoginBtn').disabled=false;
    }
    $('cloudLoginModal').classList.add('show');
    toast('Odhlášeno.');
  }

  $('logoutBtn').onclick=()=>{
    if(confirm('Opravdu se odhlásit? Lokální data ani rozehraný zápas se nesmažou.')){
      logoutFromApp();
    }
  };

  $('cloudLoginBtn').onclick=cloudLoginFromModal;
  $('cloudPassword').addEventListener('keydown',e=>{if(e.key==='Enter')cloudLoginFromModal();});

  $('cloudOfflineBtn').onclick=()=>{
    $('cloudLoginModal').classList.remove('show');
    clearRuntimeCloudIdentity();
    setCloudStatus('OFFLINE',false);
    toast('Scoreboard běží pouze lokálně.');
  };

  $('cloudStatusBtn').onclick=async()=>{
    if(cloudAuthenticated){
      try{
        setCloudStatus('SYNC…',true);
        await initialCloudMerge();
        toast('Cloud data synchronizována.');
      }catch(e){
        setCloudStatus('CHYBA',false);
        toast('Cloud synchronizace selhala.');
      }
    }else{
      $('cloudLoginMessage').textContent='';
      $('cloudLoginModal').classList.add('show');
    }
  };

  function toast(msg){
    $('toast').textContent = msg; $('toast').classList.add('show');
    setTimeout(()=> $('toast').classList.remove('show'),1800);
  }
  function esc(s=''){ return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

  document.querySelectorAll('[data-nav]').forEach(btn => btn.addEventListener('click',()=>{
    showScreen(btn.dataset.nav);
    if(btn.dataset.nav==='admin'){renderProfileClaimsAdmin();renderRegisteredUsersAdmin(false);}
  }));
  $('backToMatchNav').addEventListener('click',()=>{
    if(match && !editableMatchOwnedByCurrentUser(match)){
      discardForeignLocalActiveMatch();
      showScreen('live');
      toast('Cizí zápas je dostupný pouze přes LIVESCORE.');
      return;
    }
    if(match){
      showScreen('match');
      renderMatch();
    }
  });
  function showScreen(name){
    // Navigace nesmí měnit stav zápasu; před opuštěním skóre pouze vytvoříme záchranný snapshot.
    try{if(match&&!match.endedAt&&name!=='match')recordActiveMatchRecoverySnapshot(match);}catch(e){}
    // Po dokončení turnajového zápasu nesmí žádné pozdější volání
    // shodit uživatele zpět do hlavního seznamu turnajů.
    if(name==='tournament' && forcedTournamentReturnId){
      const targetId=forcedTournamentReturnId;
      selectedTournamentId=targetId;

      const t=(data.tournaments||[]).find(x=>x.id===targetId);
      if(t){
        name='tournament-detail';
      }
    }

    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    if(name==='federal-cup-editor' && !currentUserIsSystemAdmin())name='federal-cup-2026';
    $('screen-'+name).classList.add('active');

    // Mobilní spodní navigace je užitečná pro běžné sekce,
    // ale při přípravě a samotném hraní zápasu zbytečně zabírá místo.
    // Po opuštění zápasových obrazovek se automaticky znovu zobrazí.
    const mobileNav=document.querySelector('.modern-mobile-nav');
    if(mobileNav){
      mobileNav.classList.toggle('hidden', name==='setup' || name==='match');
    }

    const backBtn=$('backToMatchNav');
    if(backBtn){
      backBtn.classList.toggle('hidden', !match || name==='match');
      if(match) backBtn.textContent='← ZPĚT NA SKÓRE '+match.scores[0]+':'+match.scores[1];
    }

    if(name==='results'){
      Promise.allSettled([loadSecureMatches(),loadSecureTournaments()])
        .then(()=>{
          try{reconcileTournamentResultsFromMatches();}catch(e){}
        })
        .catch(()=>{});
    }
    if(name==='results-tournaments') renderResultsTournaments();
    if(name==='results-series') renderResultsSeries();
    if(name==='history') renderHistory();
    if(name==='players') renderPlayers();
    if(name==='reports'){
      loadOwnReports();
      startOwnReportsPolling();
    }else{
      stopOwnReportsPolling();
    }
    if(name==='stats') renderStats();
    if(name==='my-stats') renderMyStats();
    if(name==='federal-cup-2026' || name==='federal-cup-editor'){
      try{if(typeof window.renderFederalCup2026==='function')window.renderFederalCup2026();}catch(e){console.warn('Federal Cup 2026:',e);}
      if(name==='federal-cup-2026'){
        try{window.refreshFederalCupViewer?.();}catch(e){console.warn('Federal Cup viewer refresh:',e);}
      }
    }
    if(name==='challenges'){
      try{if(typeof window.openMatchChallengesScreen==='function')window.openMatchChallengesScreen();}catch(e){console.warn('Challenges screen:',e);}
    }
    if(name==='tournament') renderTournament();
    if(name==='league'){
      renderLeague();
      Promise.allSettled([loadSecureMatches(),loadLeagueCloud()])
        .then(()=>renderLeague())
        .catch(e=>console.warn('League load:',e));
    }
    if(name==='tournament-detail' && selectedTournamentId) renderTournamentDetail();
    if(name==='live'){
      discardForeignLocalActiveMatch();
      renderLive();
      Promise.allSettled([loadSecureMatches(),loadSecureTournaments(),cleanupStaleLiveMatches(false),loadCloudLiveMatches(true)])
        .then(()=>renderLive())
        .catch(()=>{});
    }
    if(name==='admin'){populateAdminProfileOwnerSelect();populateMergePlayerSelectors();loadReportsAdmin();}
    if(name==='home'){
      try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
      try{if(typeof window.refreshModernHomeData==='function')window.refreshModernHomeData(false);}catch(e){}
    }

  }

  


  async function openResultsSection(section){
    try{
      if(section==='history'){
        await loadSecureMatches();
        renderHistory();
        showScreen('history');
        return;
      }

      if(section==='results-tournaments'){
        await Promise.allSettled([loadSecureMatches(),loadSecureTournaments()]);
        reconcileTournamentResultsFromMatches();
        renderResultsTournaments();
        showScreen('results-tournaments');
        return;
      }

      if(section==='results-series'){
        await Promise.allSettled([loadSecureMatches(),loadSecureTournaments()]);
        reconcileTournamentResultsFromMatches();
        renderResultsSeries();
        showScreen('results-series');
        return;
      }

      showScreen('results');
    }catch(e){
      console.error('Results load:',e);
      // I při chybě cloudu zobrazíme lokální data.
      if(section==='history')renderHistory();
      if(section==='results-tournaments')renderResultsTournaments();
      if(section==='results-series')renderResultsSeries();
      showScreen(section||'results');
      toast('Výsledky se nepodařilo plně synchronizovat, zobrazují se dostupná data.');
    }
  }

  if($('resultsMatchesBtn'))$('resultsMatchesBtn').onclick=()=>openResultsSection('history');
  if($('resultsTournamentsBtn'))$('resultsTournamentsBtn').onclick=()=>openResultsSection('results-tournaments');
  if($('resultsSeriesBtn'))$('resultsSeriesBtn').onclick=()=>openResultsSection('results-series');

  document.querySelectorAll('.resultsBackBtn').forEach(btn=>{
    btn.onclick=()=>showScreen('results');
  });

  if($('backToTournamentListBtn')){
    $('backToTournamentListBtn').onclick=()=>{
      forcedTournamentReturnId=null;
      const target=tournamentDetailReturnScreen||'tournament';
      tournamentDetailReturnScreen='tournament';
      if(target==='results-tournaments')renderResultsTournaments();
      else renderTournament();
      showScreen(target);
    };
  }

  if($('currentTournamentNavBtn')){
    $('currentTournamentNavBtn').onclick=async()=>{
      if(!selectedTournamentId){
        toast('Není vybraný žádný aktuální turnaj.');
        return;
      }
      await openTournamentDetail(selectedTournamentId);
    };
  }

$('useClock').addEventListener('change',e=>$('clockSettings').classList.toggle('hidden',!e.target.checked));
  $('solo14').addEventListener('change',()=>{
    const on=$('solo14').checked && $('discipline').value==='14.1';
    $('solo14GhostRow')?.classList.toggle('hidden',!on);
    if(!on){
      if($('solo14GhostMode'))$('solo14GhostMode').checked=false;
      if($('ghostMode'))$('ghostMode').checked=false;
      $('solo14GhostSettings')?.classList.add('hidden');
    }
    if(on){
      if($('ghostMode'))$('ghostMode').checked=!!$('solo14GhostMode')?.checked;
      $('winnerTableMode').checked=false;
      $('doublesMode').checked=false;
    }
    updateDisciplineSetup();
    if(on){
      $('p2Name').value='';
      $('p1PartnerName').value='';
      $('p2PartnerName').value='';
      $('useLag').checked=false;
    }
  });


  $('solo14GhostMode')?.addEventListener('change',()=>{
    const on=!!$('solo14GhostMode').checked;
    $('solo14GhostSettings')?.classList.toggle('hidden',!on);
    if($('discipline').value==='14.1' && $('solo14').checked && $('ghostMode')){
      $('ghostMode').checked=on;
    }
    updateDisciplineSetup();
  });

  $('solo14GhostDifficulty')?.addEventListener('change',()=>{
    $('solo14GhostCustomRow')?.classList.toggle('hidden',$('solo14GhostDifficulty').value!=='custom');
  });

  $('ghostMode').addEventListener('change',()=>{
    const d=$('discipline').value;
    const wantsGhost=$('ghostMode').checked;

    if(d==='14.1'){
      if(wantsGhost){
        $('solo14').checked=true;
        if($('solo14GhostMode'))$('solo14GhostMode').checked=true;
        $('winnerTableMode').checked=false;
        $('doublesMode').checked=false;
        $('p2Name').value='';
        $('p1PartnerName').value='';
        $('p2PartnerName').value='';
        $('useLag').checked=false;
      }else{
        if($('solo14GhostMode'))$('solo14GhostMode').checked=false;
        // Sólo 14.1 necháváme zapnuté, aby šlo snadno pokračovat bez Ghosta.
      }
      updateDisciplineSetup();
      return;
    }

    const on=wantsGhost && (d==='8-ball'||d==='9-ball'||d==='10-ball');
    if(on){
      $('solo14').checked=false;
      $('winnerTableMode').checked=false;
      $('doublesMode').checked=false;
      $('p2Name').value='';
      $('p1PartnerName').value='';
      $('p2PartnerName').value='';
    }
    updateDisciplineSetup();
  });

  $('winnerTableMode').addEventListener('change',()=>{
    const d=$('discipline').value;
    const allowed=d==='8-ball'||d==='9-ball'||d==='10-ball';
    const on=$('winnerTableMode').checked && allowed;
    if(on){
      $('ghostMode').checked=false;
      $('solo14').checked=false;
      $('doublesMode').checked=false;
      $('useLag').checked=false;
      $('p1PartnerName').value='';
      $('p2PartnerName').value='';
    }
    updateDisciplineSetup();
  });

  $('doublesMode').addEventListener('change',()=>{
    const d=$('discipline').value;
    const allowed=(d==='8-ball'||d==='9-ball'||d==='10-ball') && !pendingTournamentLink;
    const on=$('doublesMode').checked && allowed;
    if(on){
      $('ghostMode').checked=false;
      $('winnerTableMode').checked=false;
      $('solo14').checked=false;
    }
    updateDisciplineSetup();
  });

  $('discipline').addEventListener('change', updateDisciplineSetup);

  $('counterMode')?.addEventListener('change', updateCounterModeSetup);

  function applySimpleCounterVisibility(){
    const simple=$('counterMode')?.value==='simple';
    $('advancedSetupOptions')?.classList.remove('hidden');
    $('simpleSetupInfo')?.classList.toggle('hidden',!simple);
    if(!simple)return;

    // V jednoduchém režimu ponecháváme základní parametry zápasu a také VÍTĚZ NA STOLE.
    // Schováme pouze detailní herní automatiku, kterou jednoduché počítadlo nepoužívá.
    ['nineBallBreakRuleField','tenBallRuleField','solo14Row','solo14GhostRow','solo14GhostSettings',
     'doublesRow','ghostRow','ghostBallCountField','fourteenBreakInfo',
     'threeFoulRow','shotClockRow','clockSettings']
      .forEach(id=>$(id)?.classList.add('hidden'));
  }

  function updateCounterModeSetup(){
    const simple=$('counterMode')?.value==='simple';
    $('advancedSetupOptions')?.classList.remove('hidden');
    $('simpleSetupInfo')?.classList.toggle('hidden',!simple);

    if(simple){
      // Jednoduché počítadlo nepoužívá detailní herní automatiku.
      if($('solo14'))$('solo14').checked=false;
      if($('solo14GhostMode'))$('solo14GhostMode').checked=false;
      if($('ghostMode'))$('ghostMode').checked=false;
      if($('doublesMode'))$('doublesMode').checked=false;
      if($('useThreeFoul'))$('useThreeFoul').checked=false;
      if($('useClock'))$('useClock').checked=false;
      updateDisciplineSetup();
      applySimpleCounterVisibility();
    }else{
      updateDisciplineSetup();
    }
  }


  let pendingGhostMissResolution=null;

  function ghostAvailableMissBalls(){
    const maxBall=match?.discipline==='10-ball'?10:(match?.discipline==='8-ball'?8:9);
    const trackedRotation=match?.discipline==='9-ball'||match?.discipline==='10-ball';
    const rem=trackedRotation && Array.isArray(match?.rackRemainingBalls) && match.rackRemainingBalls.length
      ? match.rackRemainingBalls.slice().map(Number).filter(n=>n>=1&&n<=maxBall).sort((a,b)=>a-b)
      : Array.from({length:maxBall},(_,i)=>i+1);
    return [...new Set(rem)];
  }

  function closeGhostMissBallPicker(){
    pendingGhostMissResolution=null;
    $('ghostMissInline')?.classList.add('hidden');
    $('ghostMissBallModal')?.classList.remove('show');
  }

  function openGhostMissBallPicker(onPicked){
    pendingGhostMissResolution=onPicked;
    const balls=ghostAvailableMissBalls();

    if(!balls.length){
      const cb=pendingGhostMissResolution;
      pendingGhostMissResolution=null;
      if(typeof cb==='function')cb(null);
      return;
    }

    // V aktivním Ghostu používáme inline volbu přímo pod výsledkovými tlačítky.
    // Na mobilu je spolehlivější než samostatný modal a uživatel okamžitě vidí,
    // že tlačítko NEDOHRÁNO zareagovalo.
    const inline=$('ghostMissInline');
    const inlineHost=$('ghostMissInlineChoices');
    if(match?.ghostMode && inline && inlineHost){
      inlineHost.innerHTML=balls.map(n=>
        '<button type="button" class="'+exactBallVisualClass(n)+'" onclick="selectGhostMissBall('+n+')" aria-label="Koule '+n+'"><span class="ball-number">'+n+'</span></button>'
      ).join('');
      inline.classList.remove('hidden');
      try{inline.scrollIntoView({behavior:'smooth',block:'nearest'});}catch(e){}
      return;
    }

    // Fallback pro starší uložené stavy / kompatibilitu.
    const host=$('ghostMissBallChoices');
    if(host){
      host.innerHTML=balls.map(n=>
        exactBallButtonHtml(n,{onclick:'selectGhostMissBall('+n+')'})
      ).join('');
    }
    $('ghostMissBallModal')?.classList.add('show');
  }

  window.selectGhostMissBall=function(ball){
    const cb=pendingGhostMissResolution;
    pendingGhostMissResolution=null;
    $('ghostMissInline')?.classList.add('hidden');
    $('ghostMissBallModal')?.classList.remove('show');
    if(typeof cb==='function')cb(Number(ball));
  };

  if($('ghostMissInlineCancel'))$('ghostMissInlineCancel').onclick=closeGhostMissBallPicker;
  if($('ghostMissBallCancel'))$('ghostMissBallCancel').onclick=closeGhostMissBallPicker;

  function ghostFullBallCountForDiscipline(d){
    if(d==='9-ball')return 9;
    if(d==='10-ball')return 10;
    return null;
  }

  function refreshGhostBallCountOptions(){
    const sel=$('ghostBallCount');
    if(!sel)return;

    const d=$('discipline')?.value||'';
    const max=ghostFullBallCountForDiscipline(d);
    if(!max){
      sel.innerHTML='';
      return;
    }

    const previous=parseInt(sel.value||'',10);
    const selected=Number.isFinite(previous) && previous>=3 && previous<=max ? previous : max;

    sel.innerHTML='';
    for(let n=3;n<=max;n++){
      const opt=document.createElement('option');
      opt.value=String(n);
      opt.textContent=n===max ? n+' koulí • plná disciplína' : n+' koulí';
      if(n===selected)opt.selected=true;
      sel.appendChild(opt);
    }
  }

  function ghostBallCountLabel(m){
    if(!m?.ghostMode)return '';
    if(m.discipline!=='9-ball' && m.discipline!=='10-ball')return '';
    const full=ghostFullBallCountForDiscipline(m.discipline);
    const count=Math.max(3,Math.min(full,Number(m.ghostBallCount||full)));
    return count+' '+(count>=5?'KOULÍ':'KOULE');
  }

  function solo14GhostDifficultyLabel(m,includePoints=true){
    if(!m?.solo14GhostMode)return '';
    const resume=m.resumeState||null;
    const raw=String(m.solo14GhostDifficulty ?? resume?.solo14GhostDifficulty ?? '').toLowerCase();
    const pts=Math.max(0,Number(m.solo14GhostPointsPerError ?? resume?.solo14GhostPointsPerError ?? 0));
    let level='';
    if(raw==='5')level='LEHKÁ';
    else if(raw==='10')level='STŘEDNÍ';
    else if(raw==='15')level='TĚŽKÁ';
    else if(raw==='custom')level='VLASTNÍ';
    else if(pts===5)level='LEHKÁ';
    else if(pts===10)level='STŘEDNÍ';
    else if(pts===15)level='TĚŽKÁ';
    else level='VLASTNÍ';
    return 'ÚROVEŇ: '+level+(includePoints && pts ? ' (+'+pts+' / chyba)' : '');
  }

  function updateDisciplineSetup(){
    const d=$('discipline').value;
    const is14 = d==='14.1';
    const standardAllowed=d==='8-ball'||d==='9-ball'||d==='10-ball';
    const tournamentSetup=!!pendingTournamentLink;

    if(is14 || tournamentSetup){
      $('doublesMode').checked=false;
    }

    const ghost14On=is14 && $('solo14').checked && !!$('solo14GhostMode')?.checked;
    if(is14 && $('ghostMode'))$('ghostMode').checked=ghost14On;
    const ghostOn=$('ghostMode').checked && standardAllowed;
    const winnerTableOn=$('winnerTableMode').checked && standardAllowed;
    const doublesOn=$('doublesMode').checked && standardAllowed && !tournamentSetup;

    refreshGhostBallCountOptions();
    if($('ghostBallCountField')){
      $('ghostBallCountField').classList.toggle('hidden',
        !ghostOn || (d!=='9-ball' && d!=='10-ball')
      );
    }

    $('raceLabel').textContent = is14 ? 'Cílové skóre' : 'Race to';
    $('raceTo').value = is14 ? 100 : ($('raceTo').value==100 ? 7 : $('raceTo').value);

    $('breakModeField').classList.toggle('hidden', is14 || ghostOn || winnerTableOn);
    if($('nineBallBreakRuleField')){
      $('nineBallBreakRuleField').classList.toggle('hidden', d!=='9-ball' || ghostOn || winnerTableOn);
    }
    if($('tenBallRuleField')){
      $('tenBallRuleField').classList.toggle('hidden', d!=='10-ball' || ghostOn);
    }
    $('raceField').classList.toggle('hidden', winnerTableOn);
    $('p3SetupField').classList.toggle('hidden', !winnerTableOn);
    $('p1PartnerField').classList.toggle('hidden', !doublesOn);
    $('p2PartnerField').classList.toggle('hidden', !doublesOn);
    $('p1Label').textContent=doublesOn?'Dvojice 1 • hráč A':'Hráč 1';
    $('p2Label').textContent=doublesOn?'Dvojice 2 • hráč A':'Hráč 2';

    $('fourteenBreakInfo').classList.toggle('hidden', !is14);
    $('solo14Row').classList.toggle('hidden', !is14);
    const solo14On=is14 && $('solo14').checked;
    $('solo14GhostRow')?.classList.toggle('hidden',!solo14On);
    $('solo14GhostSettings')?.classList.toggle('hidden',!solo14On || !$('solo14GhostMode')?.checked);
    $('solo14GhostCustomRow')?.classList.toggle('hidden',$('solo14GhostDifficulty')?.value!=='custom');

    $('ghostRow').classList.remove('hidden');
    $('ghostRow').style.display = ((standardAllowed || is14) && !tournamentSetup) ? 'flex' : 'none';
    $('winnerTableRow').classList.toggle('hidden', !standardAllowed || tournamentSetup);
    $('doublesRow').classList.toggle('hidden', !standardAllowed || tournamentSetup);

    if(!is14){
      $('solo14').checked=false;
      if($('solo14GhostMode'))$('solo14GhostMode').checked=false;
      $('solo14GhostRow')?.classList.add('hidden');
      $('solo14GhostSettings')?.classList.add('hidden');
    }
    if((!standardAllowed && !is14) || tournamentSetup){
      $('ghostMode').checked=false;
      $('winnerTableMode').checked=false;
      $('doublesMode').checked=false;
    }

    const singlePlayer=(is14 && $('solo14').checked) || ghostOn || ghost14On;
    $('p2SetupField').classList.toggle('hidden', singlePlayer);
    const handicapAllowed=!is14 && standardAllowed && !ghostOn && !winnerTableOn && !doublesOn;
    $('handicapMatchRow')?.classList.toggle('hidden',!handicapAllowed);
    if(!handicapAllowed && $('useHandicap'))$('useHandicap').checked=false;
    $('handicapMatchFields')?.classList.toggle('hidden',!handicapAllowed || !$('useHandicap')?.checked);
    $('lagRow').classList.toggle('hidden', (is14 && $('solo14').checked) || winnerTableOn);
    if((is14 && $('solo14').checked) || winnerTableOn)$('useLag').checked=false;

    const threeAllowed=d==='9-ball'||d==='10-ball';
    $('threeFoulRow').classList.toggle('hidden', !threeAllowed);
    if(d==='9-ball')$('useThreeFoul').checked=true;
    if(!threeAllowed)$('useThreeFoul').checked=false;

    if($('counterMode')?.value==='simple') applySimpleCounterVisibility();
  }

  updateCounterModeSetup();
  $('useHandicap')?.addEventListener('change',updateDisciplineSetup);
  $('tournamentHandicapEnabled')?.addEventListener('change',()=>{
    renderTournamentPlayerPicker();
    saveTournamentCheckinDraft();
  });

  function currentUserPlayerPriority(p){
    return !!(p && currentUserPlayerId && p.id===currentUserPlayerId);
  }

  function refreshPlayerList(){
    const dl=$('playersList'); if(!dl)return; dl.innerHTML='';
    Object.values(data.players)
      .filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)
      .sort((a,b)=>{
        const ap=currentUserPlayerPriority(a)?0:1;
        const bp=currentUserPlayerPriority(b)?0:1;
        if(ap!==bp)return ap-bp;
        return (a.name||'').localeCompare(b.name||'','cs');
      })
      .forEach(p=>{
        const o=document.createElement('option');
        o.value=p.name;
        dl.appendChild(o);
      });
  }

  function playerNeedsIdentifierDisplay(p){
    if(!p || !p.identifier)return false;
    const nameKey=normalizePersonName(p.name);
    const clubKey=normalizeClubName(p.club);
    if(!nameKey || !clubKey)return false;

    return Object.values(data.players||{}).filter(other=>
      other &&
      normalizePersonName(other.name)===nameKey &&
      normalizeClubName(other.club)===clubKey
    ).length>1;
  }

  function playerSelectionLabel(p){
    if(!p)return '';
    let label=playerDisplayName(p);
    if(p.club)label+=' • '+p.club;
    if(playerNeedsIdentifierDisplay(p))label+=' • '+p.identifier;
    return label;
  }

  function playerDisplayName(p){
    if(!p) return '';
    return (p.useNicknameInMatch && p.nickname) ? p.nickname : p.name;
  }

  function playerSubname(p){
    if(!p) return '';
    if(p.useNicknameInMatch && p.nickname){
      return [p.name,p.club].filter(Boolean).join(' • ');
    }
    return [p.nickname,p.club].filter(Boolean).join(' • ');
  }

  function findPlayerByName(name){
    const key=String(name||'').trim().toLowerCase();
    if(!key)return null;
    return Object.values(data.players||{}).find(p=>
      p && String(p.name||'').trim().toLowerCase()===key
    )||null;
  }

  function playerNameIsUnavailable(name){
    const key=String(name||'').trim().toLowerCase();
    if(!key)return false;
    const sameName=Object.values(data.players||{}).filter(p=>
      p && String(p.name||'').trim().toLowerCase()===key
    );
    if(!sameName.length)return false;

    // Pokud existuje alespoň jeden aktivní a viditelný profil stejného jména,
    // jméno samo o sobě neblokujeme. Definitivně to později vyřeší playerId výběr.
    return !sameName.some(p=>p.active!==false && p.hiddenFromPlayers!==true);
  }

  function getOrCreatePlayer(name, selectedPlayerId=null){
    const key=String(name||'').trim().toLocaleLowerCase('cs');
    // Profil se vybírá podle ID. Při ručním zadání nedovolíme tiché
    // přiřazení nesprávného profilu u dvou lidí stejného jména.
    if(selectedPlayerId){
      const selected=data.players?.[selectedPlayerId];
      if(!selected || selected.active===false || selected.hiddenFromPlayers===true ||
          String(selected.name||'').trim().toLocaleLowerCase('cs')!==key){
        throw new Error('PLAYER_SELECTION_STALE');
      }
      return selected;
    }
    const candidates=Object.values(data.players||{}).filter(p=>
      p && p.active!==false && p.hiddenFromPlayers!==true &&
      String(p.name||'').trim().toLocaleLowerCase('cs')===key
    );
    if(candidates.length>1)throw new Error('PLAYER_AMBIGUOUS');
    if(candidates.length===1)return candidates[0];

    const sameNameExists=Object.values(data.players||{}).some(p=>
      p && String(p.name||'').trim().toLowerCase()===key
    );
    if(sameNameExists) throw new Error('PLAYER_UNAVAILABLE');

    const p={id:uid(),name:name.trim(),nickname:'',useNicknameInMatch:false,club:'',note:'',equipment:'',achievements:'',photo:'',active:true,hiddenFromPlayers:false,createdAt:new Date().toISOString()};
    data.players[p.id]=p; saveData(); return p;
  }


  function selectedSetupPlayerId(inputId,typedName){
    const el=$(inputId);
    const selectedId=String(el?.dataset?.selectedPlayerId||'').trim();
    const selectedName=String(el?.dataset?.selectedPlayerName||'').trim();
    return selectedId && selectedName===String(typedName||'').trim() ? selectedId : null;
  }

  // Jednotný čtecí seznam pro vlastní vyhledávací dialog zápasů.
  // Nepředává soukromé údaje, jen ID, jméno a viditelný popisek hráče.
  window.poolMatchPickerPlayers=function(){
    return Object.values(data.players||{})
      .filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)
      .sort((a,b)=>{
        const ap=currentUserPlayerPriority(a)?0:1;
        const bp=currentUserPlayerPriority(b)?0:1;
        if(ap!==bp)return ap-bp;
        return String(a.name||'').localeCompare(String(b.name||''),'cs') ||
          String(a.club||'').localeCompare(String(b.club||''),'cs');
      })
      .map(p=>({id:p.id,value:p.name,label:playerSelectionLabel(p)}));
  };

  function savedDoublesSideNames(m,side){
    if(!m)return [];
    const idx=Number(side)||0;

    const ids=Array.isArray(m.teamPlayerIds?.[idx])
      ? m.teamPlayerIds[idx]
      : [];
    const stored=Array.isArray(m.teamPlayerNames?.[idx])
      ? m.teamPlayerNames[idx]
      : [];

    // U dvojic kombinujeme oba zdroje po pozicích.
    // Když partner nemá uložené playerId, nesmíme kvůli tomu zahodit
    // jeho jméno z teamPlayerNames.
    const maxLen=Math.max(ids.length,stored.length,2);
    const merged=[];
    for(let pos=0;pos<maxLen;pos++){
      const id=ids[pos]||'';
      const p=id ? data.players?.[id] : null;
      const fallback=String(stored[pos]||'').trim();
      const name=p ? playerDisplayName(p) : fallback;
      if(name)merged.push(name);
    }
    if(merged.length)return merged;

    // Novější zápasy mohou mít "A + B" rovnou v playerNames.
    const packed=String(m.playerNames?.[idx]||'')
      .split(' + ')
      .map(x=>x.trim())
      .filter(Boolean);
    if(packed.length)return packed;

    return m.playerNames?.[idx] ? [String(m.playerNames[idx])] : [];
  }

  function savedMatchSideDisplayName(m,side){
    if(matchIsDoubles(m)){
      const names=savedDoublesSideNames(m,side);
      if(names.length)return names.join(' + ');
    }
    return String(m?.playerNames?.[side]||'');
  }

  function matchHandicapScores(m){
    const h=Array.isArray(m?.handicapScores)?m.handicapScores:[0,0];
    return [Math.max(0,Number(h[0]||0)),Math.max(0,Number(h[1]||0))];
  }

  function actualRackScores(m){
    const h=matchHandicapScores(m);
    return [Math.max(0,Number(m?.scores?.[0]||0)-h[0]),Math.max(0,Number(m?.scores?.[1]||0)-h[1])];
  }

  function handicapInfoHtml(m){
    if(!matchHasHandicap(m))return '';
    const hs=matchHandicapScores(m);
    return `<div class="subpanel" style="margin-bottom:10px;padding:9px 12px;border-color:rgba(212,175,55,.35)">
      <strong>HANDICAP • POČÁTEČNÍ SKÓRE ${esc(String(hs[0]))}:${esc(String(hs[1]))}</strong>
      <div class="muted" style="margin-top:4px;font-size:12px">
        ${esc(savedMatchSideDisplayName(m,0)||'Hráč 1')} začínal na ${esc(String(hs[0]))} •
        ${esc(savedMatchSideDisplayName(m,1)||'Hráč 2')} začínal na ${esc(String(hs[1]))}
      </div>
    </div>`;
  }

  function blankMatchStats(){
    return {breaks:0,dryBreaks:0,softBreaks:0,softDryBreaks:0,breakFouls:0,breakPottedBalls:0,breakPottedTracked:0,aces:0,breakAndRun:0,runouts:0,pushOuts:0,pushOutsReturned:0,twoWayAttempts:0,twoWaySuccessful:0,twoWayPotSuccess:0,twoWaySafetySuccess:0,nineBallCombos:0,nineBallCaroms:0,tenBallCombos:0,tenBallCaroms:0,missBall1:0,missBall2:0,missBall3:0,missBall4:0,missBall5:0,missBall6:0,missBall7:0,missBall8:0,missBall9:0,missBall10:0,breakBall1:0,breakBall2:0,breakBall3:0,breakBall4:0,breakBall5:0,breakBall6:0,breakBall7:0,breakBall8:0,breakBall9:0,breakBall10:0,fouls:0,safeties:0,successfulSafeties:0,trackedSafeties:0,accidentalSafeties:0,safetyEscapes:0,successfulSafetyEscapes:0,resafes:0,misses:0,matchOnlyMisses:0,matchOnlyMissBadPosition:0,matchOnlyMissPot:0,threeFoulLosses:0,lagWins:0,openingBreakFouls14:0,threeFoulPenalties14:0,foulPenaltyPoints14:0,innings14:0,highRun14:0,ghostSessions:0,ghostDryBreaks:0,ghostSoftBreaks:0,ghostBreakFouls:0,ghostAces:0,ghostFailedRacks:0,ghostBIHRunouts:0,ghostCleanRunouts:0};
  }

  function syncWinnerTableSlots(){
    if(!match || !match.winnerTableMode || !match.winnerTable) return;
    const wt=match.winnerTable;
    const a=wt.active;
    match.playerIds=[wt.players[a[0]].id,wt.players[a[1]].id];
    match.playerNames=[wt.players[a[0]].displayName,wt.players[a[1]].displayName];
    match.playerRealNames=[wt.players[a[0]].realName,wt.players[a[1]].realName];
    match.scores=[wt.wins[a[0]]||0,wt.wins[a[1]]||0];
    match.stats=[wt.stats[a[0]],wt.stats[a[1]]];
  }

  $('startMatch').addEventListener('click', ()=>{ ensureAudio(); startMatch(); });
  function startMatch(){
    try{
    if(!pendingTournamentLink)forcedTournamentReturnId=null;
    const scheduledChallenge=window.pendingScheduledChallenge ? JSON.parse(JSON.stringify(window.pendingScheduledChallenge)) : null;
    window.pendingScheduledChallenge=null;
    const federalCupLink=pendingFederalCupLink ? JSON.parse(JSON.stringify(pendingFederalCupLink)) : null;
    if(federalCupLink&&typeof window.fc26CanStartMatch==='function'&&!window.fc26CanStartMatch(federalCupLink.fixtureNo)){
      pendingFederalCupLink=null;
      toast('Federal Cup je již rozhodnutý nebo má tento zápas uložený výsledek. Nový zápas nelze zahájit.');
      return;
    }
    const discipline=$('discipline').value;
    const counterMode=$('counterMode')?.value||'full';
    const simpleCounter=counterMode==='simple';
    const solo14 = !simpleCounter && discipline==='14.1' && $('solo14').checked;
    const solo14GhostMode = solo14 && !!$('solo14GhostMode')?.checked;
    const solo14GhostDifficulty = $('solo14GhostDifficulty')?.value||'5';
    const solo14GhostPointsPerError = solo14GhostMode
      ? Math.max(1,Math.min(100,solo14GhostDifficulty==='custom'
          ? parseInt($('solo14GhostCustomPoints')?.value||'10',10)
          : parseInt(solo14GhostDifficulty,10)))
      : 0;
    const ghostMode = !simpleCounter && (discipline==='8-ball'||discipline==='9-ball'||discipline==='10-ball') && $('ghostMode').checked;
    const winnerTableMode = (discipline==='8-ball'||discipline==='9-ball'||discipline==='10-ball') && $('winnerTableMode').checked;
    const doublesMode = !simpleCounter && (pendingLeagueLink?.doubles === true || (!pendingTournamentLink && !pendingLeagueLink && (discipline==='8-ball'||discipline==='9-ball'||discipline==='10-ball') && !!$('doublesMode')?.checked));
    const singlePlayer = solo14 || ghostMode;
    const p1=$('p1Name').value.trim(), p2=$('p2Name').value.trim(), p3=$('p3Name').value.trim();
    const p1Partner=$('p1PartnerName').value.trim(), p2Partner=$('p2PartnerName').value.trim();

    if(!p1){ toast('Vyplň hráče.'); return; }
    if(!singlePlayer && !p2){ toast('Vyplň oba hráče.'); return; }
    if(winnerTableMode && !p3){ toast('Vyplň všechny tři hráče.'); return; }
    if(doublesMode && (!p1Partner || !p2Partner)){
      toast('U dvojic vyplň všechny čtyři hráče.');
      return;
    }
    const namesCheck=doublesMode
      ? [p1,p1Partner,p2,p2Partner]
      : (winnerTableMode ? [p1,p2,p3] : (singlePlayer?[p1]:[p1,p2]));
    const p1Id=pendingTournamentLink?.p1ParticipantId && !pendingTournamentLink?.p1Guest
      ? pendingTournamentLink.p1ParticipantId : selectedSetupPlayerId('p1Name',p1);
    const p2Id=pendingTournamentLink?.p2ParticipantId && !pendingTournamentLink?.p2Guest
      ? pendingTournamentLink.p2ParticipantId : selectedSetupPlayerId('p2Name',p2);
    const p1PartnerId=selectedSetupPlayerId('p1PartnerName',p1Partner);
    const p2PartnerId=selectedSetupPlayerId('p2PartnerName',p2Partner);
    const p3Id=selectedSetupPlayerId('p3Name',p3);
    const identityKey=(name,id)=>id ? 'id:'+id : 'name:'+name.toLocaleLowerCase('cs');
    const identityCheck=doublesMode
      ? [identityKey(p1,p1Id),identityKey(p1Partner,p1PartnerId),identityKey(p2,p2Id),identityKey(p2Partner,p2PartnerId)]
      : (winnerTableMode ? [identityKey(p1,p1Id),identityKey(p2,p2Id),identityKey(p3,p3Id)]
                         : (singlePlayer?[identityKey(p1,p1Id)]:[identityKey(p1,p1Id),identityKey(p2,p2Id)]));
    if(new Set(identityCheck).size!==identityCheck.length){ toast('Hráči musí být různí.'); return; }

    // Hráči Federal Cupu jsou nezávislí hosté a neblokují je existující/skryté profily.
    const unavailableSelected=federalCupLink ? null : namesCheck.find(name=>playerNameIsUnavailable(name));
    if(unavailableSelected){
      toast('Hráč „'+unavailableSelected+'“ je neaktivní nebo skrytý a nelze ho vybrat do nového zápasu.');
      refreshPlayerList();
      return;
    }

    function federalCupGuestPlayer(side,name){
      const names=side==='a'?federalCupLink?.rosterA:federalCupLink?.rosterB;
      const index=(names||[]).findIndex(n=>String(n||'').trim().toLocaleLowerCase('cs')===String(name||'').trim().toLocaleLowerCase('cs'));
      if(index<0)throw new Error('Vybraný hráč není na soupisce Federal Cupu: '+name);
      return {id:'__FC26_2026_'+side+'_'+(index+1)+'__',name,nickname:'',club:'',active:true};
    }
    const p1obj=federalCupLink ? federalCupGuestPlayer('a',p1) : ((pendingTournamentLink && pendingTournamentLink.p1Guest)
      ? {id:pendingTournamentLink.p1ParticipantId,name:p1,nickname:'',club:'',showNickname:false}
      : getOrCreatePlayer(p1,p1Id));
    const p2obj=federalCupLink ? federalCupGuestPlayer('b',p2) : (solo14
      ? {id:(solo14GhostMode?'__SOLO14_GHOST__':'__SOLO__'),name:(solo14GhostMode?'GHOST':'Sólo trénink')}
      : (ghostMode
        ? {id:'__GHOST__',name:'GHOST'}
        : ((pendingTournamentLink && pendingTournamentLink.p2Guest)
          ? {id:pendingTournamentLink.p2ParticipantId,name:p2,nickname:'',club:'',showNickname:false}
          : getOrCreatePlayer(p2,p2Id))));
    const p1PartnerObj=doublesMode ? (federalCupLink ? federalCupGuestPlayer('a',p1Partner) : getOrCreatePlayer(p1Partner,p1PartnerId)) : null;
    const p2PartnerObj=doublesMode ? (federalCupLink ? federalCupGuestPlayer('b',p2Partner) : getOrCreatePlayer(p2Partner,p2PartnerId)) : null;
    const p3obj=winnerTableMode ? getOrCreatePlayer(p3,p3Id) : null;
    // Textové jméno a vybrané ID mohou vypadat různě, proto kontrolujeme
    // i výsledné identity. Jeden profil nesmí hrát současně za obě strany.
    const resolvedIds=doublesMode
      ? [p1obj.id,p1PartnerObj.id,p2obj.id,p2PartnerObj.id]
      : (winnerTableMode ? [p1obj.id,p2obj.id,p3obj.id]
                         : (singlePlayer ? [p1obj.id] : [p1obj.id,p2obj.id]));
    if(new Set(resolvedIds).size!==resolvedIds.length){
      toast('Stejný hráč nemůže být v zápasu vícekrát. Vyber rozdílné profily.');
      return;
    }

    const side1Name=doublesMode
      ? playerDisplayName(p1obj)+' + '+playerDisplayName(p1PartnerObj)
      : playerDisplayName(p1obj);
    const side2Name=doublesMode
      ? playerDisplayName(p2obj)+' + '+playerDisplayName(p2PartnerObj)
      : (solo14 ? (solo14GhostMode?'GHOST':'Sólo trénink') : (ghostMode ? 'GHOST' : playerDisplayName(p2obj)));

    const handicapAllowed=!solo14 && !ghostMode && !winnerTableMode && !doublesMode && (discipline==='8-ball'||discipline==='9-ball'||discipline==='10-ball');
    const handicapEnabled=handicapAllowed && (!!pendingTournamentLink?.handicapEnabled || (!pendingTournamentLink && !!$('useHandicap')?.checked));
    const matchTargetSource=(pendingTournamentLink && pendingTournamentLink.raceTo!=null) ? pendingTournamentLink.raceTo : $('raceTo').value;
    const handicapTarget=Math.max(1,parseInt(String(matchTargetSource||'1'),10)||1);
    const h1=handicapEnabled ? Math.max(0,Math.floor(Number(pendingTournamentLink?.p1Handicap ?? $('p1Handicap')?.value ?? 0))) : 0;
    const h2=handicapEnabled ? Math.max(0,Math.floor(Number(pendingTournamentLink?.p2Handicap ?? $('p2Handicap')?.value ?? 0))) : 0;
    if(handicapEnabled && (h1>=handicapTarget || h2>=handicapTarget)){
      toast('Handicap musí být nižší než Race to '+handicapTarget+'.');
      return;
    }

    // Před spuštěním dalšího zápasu zachováme celý stav předchozího.
    if(match && !match.endedAt){
      saveDeviceActiveMatch(match);
    }

    match={
      id:uid(),
      createdByUid:cloudUid||'',
      startedAt:new Date().toISOString(),
      endedAt:null,
      playerIds:[p1obj.id,p2obj.id],
      playerNames:[side1Name,side2Name],
      playerRealNames:[side1Name,side2Name],
      doublesMode:doublesMode,
      teamPlayerIds:doublesMode
        ? [[p1obj.id,p1PartnerObj.id],[p2obj.id,p2PartnerObj.id]]
        : null,
      teamPlayerNames:doublesMode
        ? [[playerDisplayName(p1obj),playerDisplayName(p1PartnerObj)],[playerDisplayName(p2obj),playerDisplayName(p2PartnerObj)]]
        : null,
      solo14:solo14,
      solo14GhostMode:solo14GhostMode,
      solo14GhostPointsPerError:solo14GhostPointsPerError,
      solo14GhostDifficulty:solo14GhostMode ? solo14GhostDifficulty : null,
      solo14GhostErrors:0,
      ghostMode:ghostMode,
      winnerTableMode:winnerTableMode,
      winnerTable: winnerTableMode ? {
        players:[
          {id:p1obj.id,displayName:playerDisplayName(p1obj),realName:p1obj.name},
          {id:p2obj.id,displayName:playerDisplayName(p2obj),realName:p2obj.name},
          {id:p3obj.id,displayName:playerDisplayName(p3obj),realName:p3obj.name}
        ],
        active:[0,1],
        waiting:2,
        wins:[0,0,0],
        rackHistory:[],
        stats:[blankMatchStats(),blankMatchStats(),blankMatchStats()]
      } : null,
      ghostRackNumber: ghostMode ? 1 : null,
      ghostRackHistory: ghostMode ? [] : null,
      ghostBallCount: ghostMode && (discipline==='9-ball'||discipline==='10-ball')
        ? Math.max(3,Math.min(
            ghostFullBallCountForDiscipline(discipline),
            parseInt($('ghostBallCount')?.value||String(ghostFullBallCountForDiscipline(discipline)),10)
          ))
        : null,
      streamEnabled:$('streamEnabled').checked,
      streamMode:'live',
      streamMatchTitle:$('streamMatchTitle').value.trim(),
      scheduledChallengeId:scheduledChallenge?.id||null,
      scheduledChallengePublic:scheduledChallenge?.isPublic===true,
      tournamentLink:pendingTournamentLink ? JSON.parse(JSON.stringify(pendingTournamentLink)) : null,
      leagueLink:pendingLeagueLink ? JSON.parse(JSON.stringify(pendingLeagueLink)) : null,
      federalCupLink:federalCupLink,
      isBreakShot:true,
      discipline,
      counterMode,
      target:winnerTableMode ? null : (()=>{
        const source=(pendingTournamentLink && pendingTournamentLink.raceTo!=null)
          ? pendingTournamentLink.raceTo
          : ((pendingLeagueLink && pendingLeagueLink.raceTo!=null) ? pendingLeagueLink.raceTo : $('raceTo').value);
        const parsed=parseInt(String(source??''),10);
        return Number.isFinite(parsed) && parsed>0 ? Math.floor(parsed) : 1;
      })(),
      breakMode: discipline==='14.1' ? 'first-only' : (ghostMode ? 'ghost-player-breaks' : (winnerTableMode ? 'winner-table' : $('breakMode').value)),
      nineBallBreakRule: discipline==='9-ball' && !ghostMode && !winnerTableMode
        ? ((pendingTournamentLink && pendingTournamentLink.nineBallBreakRule) || (pendingLeagueLink && pendingLeagueLink.nineBallBreakRule) || $('nineBallBreakRule')?.value || 'none')
        : 'none',
      tenBallRule: discipline==='10-ball'
        ? ($('tenBallRule')?.value || 'spot')
        : 'spot',
      softBreakOriginalBreaker:null,
      softBreakReturnEligibleFor:null,
      breakAndRunEligible:true,
      runoutEligibleFor:null,
      runoutEligibleReason:null,
      pushOutEligibleFor:null,
      pushOutBy:null,
      pushOutDecisionFor:null,
      safetyEscapeEligibleFor:null,
      breakPocketedBalls:[],
      rackRemainingBalls:[],
      lastMissBall:null,
      useLag: (solo14 || ghostMode || winnerTableMode) ? false : ($('useLag')?.checked ?? true),
      lagWinner:null,
      useThreeFoul:simpleCounter ? false : ($('useThreeFoul')?.checked ?? true),
      useClock:simpleCounter ? false : ($('useClock')?.checked ?? false),
      clock:{
        first:Math.max(5,parseInt($('clockFirst').value||'60',10)),
        normal:Math.max(5,parseInt($('clockNormal').value||'30',10)),
        warn:Math.max(1,parseInt($('clockWarn').value||'10',10)),
        countdown:Math.max(1,parseInt($('clockCountdown').value||'5',10)),
        extensionsPerRack:Math.max(0,parseInt($('extensionsPerRack').value||'1',10))
      },
      handicapEnabled:handicapEnabled,
      handicapScores:[h1,h2],
      scores:[h1,h2],
      ballsOnTable: discipline==='14.1' ? 15 : null,
      reracksInInning14: 0,
      inningsHistory14: [],
      pendingEndReason14: null,
      openingBreakAvailable14: discipline==='14.1',
      consecutiveFouls14:[0,0],
      turn:0,
      breaker:0,
      rackNumber:1,
      consecutiveFouls:[0,0],
      warnedTwoFouls:[false,false],
      extensionsUsed:[0,0],
      stats:winnerTableMode ? [] : [blankMatchStats(),blankMatchStats()],
      events:[]
    };
    if(match.handicapEnabled && (h1||h2)){
      logEvent('Handicap • počáteční skóre '+h1+':'+h2);
    }
    if(match.discipline==='10-ball'){
      logEvent('10-ball pravidlo • '+(match.tenBallRule==='early_win'
        ? 'předčasná 10 = výhra racku'
        : 'předčasná 10 = vrací se na bod'));
    }
    if(match.doublesMode){
      logEvent('DVOJICE • systém rozstřelu: '+breakModeLabel(match.breakMode));
    }
    if(match.winnerTableMode) syncWinnerTableSlots();
    pendingTournamentLink=null;
    pendingLeagueLink=null;
    pendingFederalCupLink=null;
    autosaveCurrent();
    startLiveHeartbeat();

    // Počítadlo otevřeme vždy okamžitě. Tempo je pouze překryv nad ním,
    // takže uživatel nikdy nezůstane po STARTU viset na obrazovce založení zápasu.
    openMatchScreen();

    // Pojistka: pokud by se během otevření počítadla zápas z jakéhokoli důvodu odpojil,
    // nepokračujeme s přístupem na null objekt.
    if(!match)return;

    if(match.useLag){
      $('lagP1').textContent=match.playerNames[0];
      $('lagP2').textContent=match.playerNames[1];
      $('lagHelp').textContent = match.discipline==='14.1'
        ? 'Vyber vítěze tempa. U 14.1 pak vítěz rozhodne, kdo provede úvodní rozstřel.'
        : 'Vyber vítěze tempa. Ten získá první rozstřel.';
      $('lagModal').classList.add('show');
    }else{
      match.breaker=0; match.turn=0;
      logEvent(match.winnerTableMode
        ? 'VÍTĚZ NA STOLE • první rozstřel '+match.playerNames[0]+' • čeká '+match.winnerTable.players[match.winnerTable.waiting].displayName
        : 'První rozstřel ručně nastaven na '+match.playerNames[0]);
      beginRack();
      renderMatch();
    }
    }catch(err){
      console.error(err);
      if(err?.message==='PLAYER_AMBIGUOUS'){
        toast('Existuje více hráčů se stejným jménem. Použij tlačítko VYBRAT a zvol konkrétní profil.');
        return;
      }
      if(err?.message==='PLAYER_SELECTION_STALE'){
        toast('Vybraný profil už není dostupný nebo se změnil. Vyber hráče znovu.');
        return;
      }
      alert('Nepodařilo se zahájit zápas. Zkus stránku znovu načíst v běžném prohlížeči (Chrome / Safari). Chyba: '+(err && err.message ? err.message : err));
    }
  }

  $('lagP1').onclick=()=>chooseLagWinner(0);
  $('lagP2').onclick=()=>chooseLagWinner(1);
  function chooseLagWinner(i){
    match.lagWinner=i;
    match.stats[i].lagWins++;
    logEvent('Tempo vyhrál '+match.playerNames[i]);
    $('lagModal').classList.remove('show');

    if(match.discipline==='14.1'){
      $('lagChoice14Text').textContent=match.playerNames[i]+' vyhrál tempo. Kdo bude provádět úvodní rozstřel?';
      $('lagChoice14Modal').classList.add('show');
      return;
    }

    match.breaker=i;
    match.turn=i;
    beginRack();
    openMatchScreen();
  }

  function finishLagChoice14(breaker){
    if(!match || match.discipline!=='14.1') return;
    match.breaker=breaker;
    match.turn=breaker;
    const winner=match.lagWinner;
    if(breaker===winner){
      logEvent(match.playerNames[winner]+' po vítězství v tempu zvolil vlastní úvodní rozstřel.');
    }else{
      logEvent(match.playerNames[winner]+' po vítězství v tempu přenechal úvodní rozstřel hráči '+match.playerNames[breaker]+'.');
    }
    $('lagChoice14Modal').classList.remove('show');
    beginRack();
    openMatchScreen();
  }

  $('lagBreakSelf14').onclick=()=>{
    if(!match || match.lagWinner==null) return;
    finishLagChoice14(match.lagWinner);
  };

  $('lagPassBreak14').onclick=()=>{
    if(!match || match.lagWinner==null) return;
    finishLagChoice14(1-match.lagWinner);
  };

  function openMatchScreen(){
    showScreen('match'); renderMatch();
  }

  function beginRack(){
    if(match.winnerTableMode) syncWinnerTableSlots();
    match.isBreakShot=true;
    match.softBreakOriginalBreaker=null;
    match.softBreakReturnEligibleFor=null;
    match.breakAndRunEligible=true;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.pushOutEligibleFor=null;
    match.pushOutBy=null;
    match.pushOutDecisionFor=null;
    match.safetyEscapeEligibleFor=null;
    match.breakPocketedBalls=[];
    match.rackRemainingBalls=(match.discipline==='9-ball'||match.discipline==='10-ball')
      ? Array.from({length:match.discipline==='9-ball'?9:10},(_,k)=>k+1)
      : [];
    match.lastMissBall=null;
    match.consecutiveFouls=[0,0];
    match.warnedTwoFouls=[false,false];
    match.extensionsUsed=[0,0];
    match.turn=match.breaker;
    match.stats[match.breaker].breaks++;
    logEvent('Rack '+match.rackNumber+' • rozstřel '+match.playerNames[match.breaker]);
    if(match.useClock) resetClock(true,true);
  }


  const STREAM_OVERLAY_BASE_URL = 'https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/overlay.html?v=12';
  let streamSendTimer=null;
  let lastStreamPayload='';

  function currentStreamDbPath(){
    return cloudUid ? 'stream/users/'+cloudUid : null;
  }

  function currentStreamOverlayUrl(){
    if(!cloudUid) return '';
    const sep = STREAM_OVERLAY_BASE_URL.includes('?') ? '&' : '?';
    const enc = encodeURIComponent(cloudUid);
    // UID je schválně v query i hash části. Některé mobilní WebView při otočení
    // zahodí query parametry, ale hash zachovají.
    return STREAM_OVERLAY_BASE_URL + sep + 'uid=' + enc + '#uid=' + enc;
  }

  function refreshStreamOverlayUrl(){
    const url=currentStreamOverlayUrl();
    const input=$('streamOverlayUrl');
    if(input)input.value=url;
    const help=$('helpStreamOverlayUrl');
    if(help)help.textContent=url || 'Po přihlášení se zde zobrazí tvoje vlastní adresa overlaye.';
  }

  function streamPlayerSub(i){
    if(!match) return '';
    if(match.doublesMode && Array.isArray(match.teamPlayerIds?.[i])){
      return match.teamPlayerIds[i]
        .map(id=>data.players[id])
        .filter(Boolean)
        .map(p=>p.club||'')
        .filter(Boolean)
        .filter((v,idx,arr)=>arr.indexOf(v)===idx)
        .join(' • ');
    }
    const p=data.players[match.playerIds[i]];
    if(!p) return '';
    if(p.useNicknameInMatch && p.nickname){
      return [p.name,p.club].filter(Boolean).join(' • ');
    }
    return [p.nickname,p.club].filter(Boolean).join(' • ');
  }

  function buildStreamState(){
    if(!match) return null;
    const exactRack=exactBallTrackingDiscipline() && match.counterMode!=='simple';
    const maxBall=match.discipline==='9-ball'?9:(match.discipline==='10-ball'?10:0);
    const remainingBalls=exactRack
      ? [...new Set((Array.isArray(match.rackRemainingBalls)?match.rackRemainingBalls:[]).map(Number).filter(n=>n>=1 && n<=maxBall))].sort((a,b)=>a-b)
      : [];
    return {
      active:true,
      table:1,
      matchId:match.id,
      matchTitle:match.streamMatchTitle||'',
      streamMode:match.streamMode||'live',
      discipline:match.discipline,
      target:match.target,
      breakMode:match.breakMode||'',
      breakModeLabel:breakModeLabel(match.breakMode||''),
      scores:[Number(match.scores[0]||0),Number(match.scores[1]||0)],
      playerNames:match.doublesMode
        ? [doublesSideNames(0).join(' + '),doublesSideNames(1).join(' + ')]
        : [match.playerNames[0]||'',match.playerNames[1]||''],
      playerSubs:[streamPlayerSub(0),match.ghostMode||match.solo14?'':streamPlayerSub(1)],
      turn:Number(match.turn||0),
      breaker:Number(match.breaker||0),
      isBreakShot:!!match.isBreakShot,
      useClock:!!match.useClock,
      clockRemaining:match.useClock ? Number(timeLeft||0) : 0,
      ghostMode:!!match.ghostMode,
      ghostBallCount:match.ghostBallCount||null,
      winnerTableMode:!!match.winnerTableMode,
      waitingPlayer:match.winnerTableMode ? match.winnerTable.players[match.winnerTable.waiting].displayName : '',
      waitingWins:match.winnerTableMode ? Number(match.winnerTable.wins[match.winnerTable.waiting]||0) : 0,
      solo14:!!match.solo14,
      rackNumber:Number(match.ghostMode ? (match.ghostRackNumber||1) : (match.rackNumber||1)),
      exactRackTracking:exactRack,
      maxBall:maxBall||null,
      remainingBalls:exactRack?remainingBalls:null,
      updatedAt:Date.now()
    };
  }

  async function sendStreamState(force=false){
    if(!match || !match.streamEnabled) return false;
    if(!cloudUid || !currentStreamDbPath())return false;
    if(!await ensureCloudToken()){
      setCloudStatus('PŘIHLÁSIT',false);
      lastStreamPayload='';
      return false;
    }
    const payload=buildStreamState();
    if(!payload) return false;
    const key=JSON.stringify(payload);
    if(!force && key===lastStreamPayload) return true;
    try{
      const res=await fetch(cloudUrl(currentStreamDbPath()),{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:key,
        cache:'no-store'
      });
      if(!res.ok){
        lastStreamPayload='';
        console.warn('Stream sync HTTP:',res.status);
        setCloudStatus('CHYBA',false);
        return false;
      }
      lastStreamPayload=key;
      return true;
    }catch(err){
      lastStreamPayload='';
      console.warn('Stream sync:',err);
      setCloudStatus('CHYBA',false);
      return false;
    }
  }

  function scheduleStreamState(){
    if(!match || !match.streamEnabled) return;
    if(streamSendTimer) clearTimeout(streamSendTimer);
    streamSendTimer=setTimeout(()=>sendStreamState(),80);
  }

  // Záloha pro mobilní prohlížeče/obnovení aplikace:
  // pokud jednorázový zápis streamu selže při přihlášení nebo návratu z pozadí,
  // každých 5 s se aktivní stav zkusí znovu poslat.
  setInterval(()=>{
    if(match && match.streamEnabled) sendStreamState(true);
  },5000);

  function refreshStreamDirector(){
    const panel=$('streamDirectorPanel');
    if(!panel)return;
    const visible=!!(match && match.streamEnabled);
    panel.classList.toggle('hidden',!visible);
    if(!visible)return;
    const mode=match.streamMode||'live';
    const map={live:'LIVE',pause:'PAUZA',soon:'BRZY ZAČÍNÁME',end:'KONEC'};
    const info=$('streamModeInfo');
    if(info)info.textContent='Aktuálně: '+(map[mode]||'LIVE');
    [['streamModeLiveBtn','live'],['streamModePauseBtn','pause'],['streamModeSoonBtn','soon'],['streamModeEndBtn','end']].forEach(([id,m])=>{
      const b=$(id); if(!b)return; b.classList.toggle('primary',mode===m);
    });
  }

  async function setStreamMode(mode){
    if(!match || !match.streamEnabled)return;
    match.streamMode=['live','pause','soon','end'].includes(mode)?mode:'live';
    refreshStreamDirector();
    await sendStreamState(true);
    autosaveCurrent();
  }

  if($('streamModeLiveBtn'))$('streamModeLiveBtn').onclick=()=>setStreamMode('live');
  if($('streamModePauseBtn'))$('streamModePauseBtn').onclick=()=>setStreamMode('pause');
  if($('streamModeSoonBtn'))$('streamModeSoonBtn').onclick=()=>setStreamMode('soon');
  if($('streamModeEndBtn'))$('streamModeEndBtn').onclick=()=>setStreamMode('end');

  async function clearStreamState(){
    lastStreamPayload='';
    try{
      if(!cloudUid || !currentStreamDbPath())return;
      if(!await ensureCloudToken())return;
      await fetch(cloudUrl(currentStreamDbPath()),{
        method:'PUT',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({active:false,updatedAt:Date.now()}),
        cache:'no-store'
      });
    }catch(e){
      console.warn('Stream clear:',e);
    }
  }

  const copyStreamOverlayBtn=$('copyStreamOverlayUrl');
  if(copyStreamOverlayBtn){
    copyStreamOverlayBtn.onclick=async()=>{
      const url=currentStreamOverlayUrl();
      if(!url){
        toast('Nejdřív se přihlas ke svému účtu.');
        return;
      }
      try{
        await navigator.clipboard.writeText(url);
        toast('Adresa overlaye zkopírována.');
      }catch(e){
        const input=$('streamOverlayUrl');
        if(input){input.focus();input.select();}
        toast('Adresa je označená – zkopíruj ji ručně.');
      }
    };
  }

  function initials(name=''){
    return name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('') || 'HR';
  }
  function applyMatchAvatar(i,p){
    const img=$(i===0?'p1Avatar':'p2Avatar');
    const fb=$(i===0?'p1AvatarFallback':'p2AvatarFallback');
    if(p && p.photo){
      img.src=p.photo; img.alt=p.name||''; img.classList.remove('hidden'); fb.classList.add('hidden');
    }else{
      img.removeAttribute('src'); img.classList.add('hidden'); fb.classList.remove('hidden'); fb.textContent=initials(p && p.name||(match && match.playerNames ? match.playerNames[i] : '')||'');
    }
  }
  function avatarHTML(p,large=false){
    if(p.photo) return `<img class="avatar${large?' large':''}" src="${p.photo}" alt="${esc(p.name)}">`;
    return `<div class="avatar initials${large?' large':''}">${esc(initials(p.name))}</div>`;
  }

  function normalRaceTarget(m=match){
    const n=Number(m?.target);
    return Number.isFinite(n) && n>0 ? Math.floor(n) : 1;
  }

  function checkNormalRaceTarget(){
    if(!match || match.endedAt || match.status==='complete')return false;
    if(match.discipline==='14.1' || match.ghostMode || match.winnerTableMode)return false;

    const target=normalRaceTarget(match);
    match.target=target;

    const s0=Number(match.scores?.[0]||0);
    const s1=Number(match.scores?.[1]||0);

    if(s0>=target || s1>=target){
      const winner=s0>=target && s1>=target ? (s0>=s1?0:1) : (s0>=target?0:1);
      finishMatch(winner);
      return true;
    }
    return false;
  }

  function checkFourteenOneTarget(){
    if(!match || match.endedAt || match.status==='complete')return false;
    if(match.discipline!=='14.1')return false;

    const target=normalRaceTarget(match);
    match.target=target;

    const s0=Number(match.scores?.[0]||0);
    const s1=Number(match.scores?.[1]||0);

    if(match.solo14 && match.solo14GhostMode){
      if(s0>=target || s1>=target){
        const winner=s0>=target && s1>=target ? (s0>=s1?0:1) : (s0>=target?0:1);
        finishMatch(winner);
        return true;
      }
      return false;
    }

    if(s0>=target || (!match.solo14 && s1>=target)){
      const winner=match.solo14 ? 0 : (s0>=target && s1>=target ? (s0>=s1?0:1) : (s0>=target?0:1));
      finishMatch(winner);
      return true;
    }
    return false;
  }

  function breakModeLabel(mode){
    if(mode==='alternate')return 'STŘÍDAVÝ BREAK PO 1';
    if(mode==='alternate2')return 'STŘÍDÁNÍ PO 2 BREAKÁCH';
    if(mode==='winner')return 'VÍTĚZ BREAK';
    if(mode==='first-only')return 'POUZE PRVNÍ ROZSTŘEL';
    if(mode==='ghost-player-breaks')return 'HRÁČ BREAKUJE KAŽDÝ RACK';
    return 'BREAK';
  }

  function liveBreakModeLabel(m){
    if(!m)return '';
    const mode=m.breakMode||'';
    if(mode==='alternate')return 'STŘÍDAVÝ ROZSTŘEL';
    if(mode==='alternate2')return 'STŘÍDÁNÍ PO 2 ROZSTŘELECH';
    if(mode==='winner')return 'VÍTĚZ ROZSTŘELUJE';
    if(mode==='first-only')return 'POUZE ÚVODNÍ ROZSTŘEL';
    if(mode==='ghost-player-breaks')return 'HRÁČ ROZSTŘELUJE KAŽDÝ RACK';
    if(mode==='winner-table')return 'NOVĚ PŘÍCHOZÍ ROZSTŘELUJE';
    return '';
  }

  function nineBallBreakRuleLabel(rule){
    if(rule==='kitchen')return 'KITCHEN RULE';
    if(rule==='box')return 'BREAK BOX';
    if(rule==='kitchen_box')return 'KITCHEN RULE + BREAK BOX';
    return '';
  }

  function consumeSoftBreakReturnOnShot(playerIndex){
    if(!match)return;
    if(match.softBreakReturnEligibleFor===playerIndex){
      match.softBreakReturnEligibleFor=null;
      match.softBreakOriginalBreaker=null;
      match.breakAndRunEligible=false;
    }
  }

  function consumePushOutOptionOnAction(playerIndex){
    if(!match)return;
    if(match.pushOutEligibleFor===playerIndex){
      match.pushOutEligibleFor=null;
    }
  }


  function doublesSideNames(side){
    if(!match?.doublesMode)return [];
    const ids=Array.isArray(match.teamPlayerIds?.[side]) ? match.teamPlayerIds[side] : [];
    const fallback=Array.isArray(match.teamPlayerNames?.[side]) ? match.teamPlayerNames[side] : [];
    const names=ids.map((id,idx)=>{
      const p=data.players?.[id];
      return p ? playerDisplayName(p) : (fallback[idx]||'Hráč');
    }).filter(Boolean);
    if(names.length)return names;
    return String(match.playerNames?.[side]||'').split(' + ').map(s=>s.trim()).filter(Boolean);
  }

  function renderMatchSideName(el,side){
    if(!el)return;
    if(match?.doublesMode){
      const names=doublesSideNames(side);
      el.classList.add('doubles-name');
      el.innerHTML=names.map((name,idx)=>
        (idx?'<span class="doubles-plus">+</span>':'')+
        '<span class="doubles-player">'+esc(name)+'</span>'
      ).join('');
    }else{
      el.classList.remove('doubles-name');
      el.textContent=match?.playerNames?.[side]||'';
    }
  }


  function fourteenReasonLabel(reason){
    if(reason==='safe')return 'SAFE';
    if(reason==='foul')return 'FAUL';
    if(reason==='opening_break_foul')return 'FAUL Z BREAKU';
    return 'MISS';
  }

  function fourteenInningsRows(m){
    return Array.isArray(m?.inningsHistory14)?m.inningsHistory14:[];
  }

  function fourteenInningsTimelineHtml(m){
    const rows=fourteenInningsRows(m);
    if(!rows.length){
      return `<div class="subpanel" style="margin-top:12px">
        <div style="font-size:17px;font-weight:950">PRŮBĚH NÁBĚHŮ</div>
        <div class="muted" style="margin-top:7px">U tohoto zápasu není uložen detail jednotlivých náběhů.</div>
      </div>`;
    }
    return `<div class="subpanel" style="margin-top:12px">
      <div style="font-size:17px;font-weight:950;margin-bottom:9px">PRŮBĚH NÁBĚHŮ • TAH PO TAHU</div>
      <div style="display:grid;gap:6px">
        ${rows.map((r,idx)=>`
          <div style="display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 9px;border:1px solid #2d2d31;border-radius:10px;background:#101012">
            <strong style="color:var(--gold2)">#${idx+1}</strong>
            <div style="min-width:0">
              <strong>${esc(r.playerName||m.playerNames?.[r.player]||'Hráč')}</strong>
              <span class="muted" style="font-size:11px;margin-left:5px">${esc(fourteenReasonLabel(r.reason))}</span>
            </div>
            <div style="text-align:right"><span class="muted" style="font-size:10px">NÁBĚH</span><br><strong>${esc(String(r.run||0))}</strong></div>
            <div style="text-align:right"><span class="muted" style="font-size:10px">CELKEM</span><br><strong>${esc(String(r.total??0))}</strong></div>
          </div>`).join('')}
      </div>
    </div>`;
  }

  function renderFourteenInningsHistory(){
    const host=$('fourteenInningsHistory');
    const panel=$('fourteenInningsHistoryPanel');
    if(!host||!panel||!match)return;
    const show=match.discipline==='14.1';
    panel.classList.toggle('hidden',!show);
    if(!show)return;
    const rows=fourteenInningsRows(match);
    host.innerHTML=rows.length
      ? rows.slice().reverse().map((r,revIdx)=>{
          const n=rows.length-revIdx;
          return `<div style="display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:7px;align-items:center;padding:7px 8px;border:1px solid #2b2b2f;border-radius:9px">
            <strong style="color:var(--gold2)">#${n}</strong>
            <div><strong>${esc(r.playerName||match.playerNames?.[r.player]||'Hráč')}</strong> <span class="muted" style="font-size:10px">${esc(fourteenReasonLabel(r.reason))}</span></div>
            <div style="text-align:right"><span class="muted" style="font-size:9px">NÁBĚH</span><br><strong>${esc(String(r.run||0))}</strong></div>
            <div style="text-align:right"><span class="muted" style="font-size:9px">CELKEM</span><br><strong>${esc(String(r.total??0))}</strong></div>
          </div>`;
        }).join('')
      : '<div class="muted">Zatím není zapsán žádný náběh.</div>';
  }

  function basicMatchSummaryCard(m){
    const started=m.startedAt?new Date(m.startedAt):null;
    const ended=m.endedAt?new Date(m.endedAt):null;
    let duration='—';
    if(started && ended && !isNaN(started) && !isNaN(ended)){
      const mins=Math.max(0,Math.round((ended-started)/60000));
      duration=mins<60?mins+' min':Math.floor(mins/60)+' h '+(mins%60)+' min';
    }
    const br0=Number(m.stats?.[0]?.breakAndRun||0), br1=Number(m.stats?.[1]?.breakAndRun||0);
    const ro0=Number(m.stats?.[0]?.runouts||0), ro1=Number(m.stats?.[1]?.runouts||0);
    return `<div class="subpanel" style="margin-top:12px">
      <div style="font-size:17px;font-weight:950;margin-bottom:9px">ZÁKLADNÍ SOUHRN</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(115px,1fr));gap:8px">
        ${statBox('SKÓRE',String(m.scores?.[0]??0)+' : '+String(m.scores?.[1]??0))}
        ${statBox('DISCIPLÍNA',String(m.discipline||'—').toUpperCase())}
        ${statBox('DÉLKA',duration)}
        ${m.target?statBox('RACE TO',m.target):''}
      </div>

      <div style="margin-top:12px;font-size:13px;font-weight:950;color:var(--gold2)">RYCHLÉ STATISTIKY</div>
      <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px">
        <div class="subpanel" style="margin:0;padding:10px;text-align:center">
          <strong>${esc(savedMatchSideDisplayName(m,0)||'Hráč 1')}</strong>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px">
            ${statBox('ČISTÉ HRY',br0)}
            ${statBox('DOHRÁVKY',ro0)}
          </div>
        </div>
        <div class="subpanel" style="margin:0;padding:10px;text-align:center">
          <strong>${esc(savedMatchSideDisplayName(m,1)||'Hráč 2')}</strong>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px">
            ${statBox('ČISTÉ HRY',br1)}
            ${statBox('DOHRÁVKY',ro1)}
          </div>
        </div>
      </div>

      <div class="muted" style="margin-top:10px;line-height:1.45">
        Zápas byl veden v jednoduchém počítadle. Evidují se pouze Čisté hry a Dohrávky.
      </div>
    </div>`;
  }

  function finishEightBallRackQuick(player,type='win'){
    if(!match || match.discipline!=='8-ball' || match.counterMode==='simple' || match.ghostMode || match.solo14)return;
    if(match.endedAt || match.status==='complete')return;

    player=Number(player);
    if(player!==0 && player!==1)return;

    if(type==='clean'){
      const cleanAllowed =
        player===Number(match.breaker||0) &&
        player===Number(match.turn||0) &&
        match.breakAndRunEligible!==false;
      if(!cleanAllowed){
        toast('ČISTÁ je pouze Break & Run hráče, který rozstřeloval. Po dry breaku soupeře použij DOHRÁVKA.');
        return;
      }
    }

    if(type==='runout'){
      const runoutAllowed =
        match.runoutEligibleFor===player ||
        (player!==Number(match.breaker||0) && match.breakAndRunEligible===false);
      if(!runoutAllowed){
        toast('DOHRÁVKA je určena pro dohrání stolu po dry breaku nebo jiném předání stolu.');
        return;
      }
    }

    const label=type==='clean'?'Čistá hra':(type==='runout'?'Dohrávka':'Vyhrál rack');
    saveManualEntryUndoSnapshot('8-ball • '+label);

    match.stats[player]=match.stats[player]||blankMatchStats();

    if(type==='clean'){
      match.stats[player].breakAndRun=Number(match.stats[player].breakAndRun||0)+1;
      addActionEvent('⭐ ČISTÁ HRA • '+match.playerNames[player]+' • 8-ball');
      playSpecialSound();
    }else if(type==='runout'){
      match.stats[player].runouts=Number(match.stats[player].runouts||0)+1;
      addActionEvent('DOHRÁVKA • '+match.playerNames[player]+' • 8-ball');
    }else{
      addActionEvent('VYHRÁL RACK • '+match.playerNames[player]+' • 8-ball');
    }

    winRack(player,true,'8-ball • '+label);
  }

  if($('eightBallWin0'))$('eightBallWin0').onclick=()=>finishEightBallRackQuick(0,'win');
  if($('eightBallWin1'))$('eightBallWin1').onclick=()=>finishEightBallRackQuick(1,'win');
  if($('eightBallClean0'))$('eightBallClean0').onclick=()=>finishEightBallRackQuick(0,'clean');
  if($('eightBallClean1'))$('eightBallClean1').onclick=()=>finishEightBallRackQuick(1,'clean');
  if($('eightBallRunout0'))$('eightBallRunout0').onclick=()=>finishEightBallRackQuick(0,'runout');
  if($('eightBallRunout1'))$('eightBallRunout1').onclick=()=>finishEightBallRackQuick(1,'runout');

