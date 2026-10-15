
(() => {
  const $ = id => document.getElementById(id);
  const nowTime = () => new Date().toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const uid = () => {
    try{
      if(window.crypto && typeof window.crypto.randomUUID==='function') return window.crypto.randomUUID();
    }catch(e){}
    return Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  };

  const DB_KEY = 'bc_rybarna_scoreboard_v1';
  const CLOUD_LOCAL_TS_KEY = 'bc_rybarna_cloud_local_updated_at';
  const CLOUD_REFRESH_KEY = 'bc_rybarna_cloud_refresh_token';
  const CLOUD_EMAIL_KEY = 'bc_rybarna_cloud_email';
  // SYSTEM ADMIN session se z bezpečnostních důvodů neukládá trvale.
  // sessionStorage přežije reload stejné karty, ale ne zavření prohlížeče/karty.
  const CLOUD_ADMIN_SESSION_REFRESH_KEY = 'bc_rybarna_admin_session_refresh_token';
  const CLOUD_ADMIN_SESSION_EMAIL_KEY = 'bc_rybarna_admin_session_email';
  const CLOUD_BACKUP_KEY = 'bc_rybarna_local_backup_v1';
  const LOCAL_ACTIVE_MATCH_KEY = 'bc_rybarna_device_active_match_v1';
  const LOCAL_ACTIVE_MATCHES_KEY = 'bc_rybarna_device_active_matches_v2';
  const LOCAL_ACTIVE_MATCH_RECOVERY_KEY = 'bc_rybarna_device_active_match_recovery_v1';
  // Pouze lokální UI filtr Livescore. Nezasahuje do cloudu, zápasů ani identity.
  const LOCAL_HIDDEN_LIVE_IDS_KEY = 'bc_rybarna_hidden_live_ids_v1';

  // Firebase project configuration.
  // Web API key is intentionally client-side; access is protected by Firebase Authentication + Database Rules.
  const FIREBASE_API_KEY = 'AIzaSyDwbY_hOmhf6tfotV5RO-msCoOUUXNqXAQ';
  const FIREBASE_DB = 'https://bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app';
  const FIREBASE_DB_URL = FIREBASE_DB;
  const MAIN_ADMIN_EMAIL='bcrybarna@gmail.com';

  let cloudIdToken='';
  let cloudRefreshToken='';
  let cloudTokenExpiresAt=0;
  let cloudEmailVerified=false;
  let currentUserProfileClaimId=null;
  let currentUserClubId=null;
  let currentUserPlayerId=null;
  let currentUserRole='player';
  let adminRegisteredUsersCache={};
  let adminRegisteredUsersLoading=false;
  let adminRegisteredUsersGlobalReadDenied=false;
  let adminCreatePlayerTargetUid=null;
  let cloudUserEmail='';
  let cloudUid='';
  let cloudAuthenticated=false;
  let cloudSyncTimer=null;
  let cloudSyncInProgress=false;
  let cloudPollTimer=null;
  let cloudPollInProgress=false;
  let cloudApplyingRemote=false;
  let cloudLastError='';
  const CLOUD_POLL_MS=2500;

  function normalizeDataObject(parsed){
    if(!parsed || typeof parsed!=='object') parsed=defaultData();
    if(!parsed.players) parsed.players={};
    if(!Array.isArray(parsed.matches)) parsed.matches=[];
    if(!Array.isArray(parsed.tournaments)) parsed.tournaments=[];
    if(!Array.isArray(parsed.tournamentSeries)) parsed.tournamentSeries=[];
    if(!Array.isArray(parsed.leagues)) parsed.leagues=[];
    if(!parsed.federalCup2026 || typeof parsed.federalCup2026!=='object') parsed.federalCup2026=defaultFederalCup2026();
    parsed.federalCup2026={...defaultFederalCup2026(),...parsed.federalCup2026};
    if(!Array.isArray(parsed.federalCup2026.rosterA))parsed.federalCup2026.rosterA=['','','','',''];
    if(!Array.isArray(parsed.federalCup2026.rosterB))parsed.federalCup2026.rosterB=['','','','',''];
    parsed.federalCup2026.rosterA=parsed.federalCup2026.rosterA.slice(0,5);while(parsed.federalCup2026.rosterA.length<5)parsed.federalCup2026.rosterA.push('');
    parsed.federalCup2026.rosterB=parsed.federalCup2026.rosterB.slice(0,5);while(parsed.federalCup2026.rosterB.length<5)parsed.federalCup2026.rosterB.push('');
    if(!parsed.federalCup2026.lineups || typeof parsed.federalCup2026.lineups!=='object')parsed.federalCup2026.lineups={};
    if(!parsed.federalCup2026.teamResults || typeof parsed.federalCup2026.teamResults!=='object')parsed.federalCup2026.teamResults={};
    parsed.tournaments.forEach(t=>{if(t && (!t.managerUids || typeof t.managerUids!=='object' || Array.isArray(t.managerUids)))t.managerUids={};});
    parsed.tournamentSeries.forEach(s=>{if(s && (!s.managerUids || typeof s.managerUids!=='object' || Array.isArray(s.managerUids)))s.managerUids={};});
    if(!Array.isArray(parsed.deletedMatchIds)) parsed.deletedMatchIds=[];
    if(!Array.isArray(parsed.deletedTournamentIds)) parsed.deletedTournamentIds=[];
    // currentMatch je pouze lokální pro konkrétní zařízení/stůl.
    parsed.currentMatch=null;

    Object.values(parsed.players||{}).forEach(p=>{
      if(p.nickname==null)p.nickname='';
      if(p.club==null)p.club='';
      if(p.note==null)p.note='';
      if(p.photo==null)p.photo='';
      if(p.identifier==null)p.identifier='';
      if(p.useNicknameInMatch==null)p.useNicknameInMatch=false;
    });
    (parsed.matches||[]).forEach(m=>{if(m.status==null)m.status='complete';});
    try{applyKnownHistoricalMatchMetadataRepairs(parsed.matches||[]);}catch(e){}
    const deletedMatchSet=new Set(parsed.deletedMatchIds||[]);
    const deletedTournamentSet=new Set(parsed.deletedTournamentIds||[]);
    parsed.matches=(parsed.matches||[]).filter(m=>!deletedMatchSet.has(m.id));
    parsed.tournaments=(parsed.tournaments||[]).filter(t=>!deletedTournamentSet.has(t.id));
    return parsed;
  }

  function loadDeviceActiveMatches(){
    try{
      const raw=localStorage.getItem(LOCAL_ACTIVE_MATCHES_KEY);
      const parsed=raw ? JSON.parse(raw) : {};
      const map=(parsed && typeof parsed==='object' && !Array.isArray(parsed)) ? parsed : {};

      // Migrace starší verze, která uměla držet jen jeden rozehraný zápas.
      const legacyRaw=localStorage.getItem(LOCAL_ACTIVE_MATCH_KEY);
      if(legacyRaw){
        try{
          const legacy=JSON.parse(legacyRaw);
          if(legacy?.id && !legacy.endedAt && !map[legacy.id])map[legacy.id]=legacy;
        }catch(e){}
      }

      localStorage.setItem(LOCAL_ACTIVE_MATCHES_KEY,JSON.stringify(map));
      return map;
    }catch(e){return {};}
  }

  function loadDeviceActiveMatch(){
    try{
      const raw=localStorage.getItem(LOCAL_ACTIVE_MATCH_KEY);
      if(raw)return JSON.parse(raw);

      // Pokud není určen právě otevřený zápas, vezmeme naposledy upravený.
      const all=Object.values(loadDeviceActiveMatches())
        .filter(m=>m && m.id && !m.endedAt)
        .sort((a,b)=>new Date(b.localUpdatedAt||b.startedAt||0)-new Date(a.localUpdatedAt||a.startedAt||0));
      return all[0]||null;
    }catch(e){return null;}
  }

  function activeMatchStateMetrics(m){
    if(!m)return {events:0,rack:0,score:0,stats:0,ts:0};
    const events=Array.isArray(m.events)?m.events.length:0;
    const rack=Number(m.rackNumber||0);
    const score=(Array.isArray(m.scores)?m.scores:[]).reduce((a,b)=>a+Math.max(0,Number(b||0)),0);
    let stats=0;
    (Array.isArray(m.stats)?m.stats:[]).forEach(s=>{
      if(!s||typeof s!=='object')return;
      Object.values(s).forEach(v=>{if(Number.isFinite(Number(v)))stats+=Math.max(0,Number(v));});
    });
    const rawTs=m.localUpdatedAt||m.updatedAt||m.endedAt||m.startedAt||'';
    const ts=Date.parse(rawTs)||0;
    return {events,rack,score,stats,ts};
  }

  function catastrophicActiveMatchRegression(newer,older){
    if(!newer||!older||newer.id!==older.id)return false;
    const n=activeMatchStateMetrics(newer),o=activeMatchStateMetrics(older);
    const scoreCollapse=o.score>=3 && n.score<=1 && o.score-n.score>=3;
    const eventCollapse=o.events>=4 && n.events+3<=o.events;
    const rackCollapse=o.rack>=3 && n.rack+2<=o.rack;
    const statsCollapse=o.stats>=4 && n.stats+3<=o.stats;
    return scoreCollapse && (eventCollapse||rackCollapse||statsCollapse);
  }

  function loadActiveMatchRecovery(matchId){
    try{
      const raw=localStorage.getItem(LOCAL_ACTIVE_MATCH_RECOVERY_KEY);
      const all=raw?JSON.parse(raw):{};
      const arr=Array.isArray(all?.[matchId])?all[matchId]:[];
      return arr.filter(x=>x&&x.id===matchId).map(x=>JSON.parse(JSON.stringify(x)));
    }catch(e){return [];}
  }

  function recordActiveMatchRecoverySnapshot(m){
    if(!m||!m.id)return;
    try{
      const raw=localStorage.getItem(LOCAL_ACTIVE_MATCH_RECOVERY_KEY);
      const all=raw?JSON.parse(raw):{};
      const arr=Array.isArray(all[m.id])?all[m.id]:[];
      const copy=JSON.parse(JSON.stringify(m));
      copy.recoverySavedAt=new Date().toISOString();
      const sig=JSON.stringify({s:copy.scores,e:(copy.events||[]).length,r:copy.rackNumber,t:copy.turn});
      const last=arr[arr.length-1];
      const lastSig=last?JSON.stringify({s:last.scores,e:(last.events||[]).length,r:last.rackNumber,t:last.turn}):'';
      if(sig!==lastSig)arr.push(copy);
      all[m.id]=arr.slice(-12);
      localStorage.setItem(LOCAL_ACTIVE_MATCH_RECOVERY_KEY,JSON.stringify(all));
    }catch(e){}
  }

  function removeActiveMatchRecovery(matchId){
    if(!matchId)return;
    try{
      const raw=localStorage.getItem(LOCAL_ACTIVE_MATCH_RECOVERY_KEY);
      const all=raw?JSON.parse(raw):{};
      if(all && typeof all==='object'){
        delete all[matchId];
        localStorage.setItem(LOCAL_ACTIVE_MATCH_RECOVERY_KEY,JSON.stringify(all));
      }
    }catch(e){}
  }

  function betterResumableState(a,b){
    if(!a)return b?JSON.parse(JSON.stringify(b)):null;
    if(!b)return JSON.parse(JSON.stringify(a));
    const am=activeMatchStateMetrics(a),bm=activeMatchStateMetrics(b);
    const newer=am.ts>=bm.ts?a:b;
    const older=newer===a?b:a;
    if(catastrophicActiveMatchRegression(newer,older))return JSON.parse(JSON.stringify(older));
    return JSON.parse(JSON.stringify(newer));
  }

  function saveDeviceActiveMatch(m){
    try{
      if(!m){
        localStorage.removeItem(LOCAL_ACTIVE_MATCH_KEY);
        return;
      }

      const map=loadDeviceActiveMatches();
      const existing=map[m.id]?JSON.parse(JSON.stringify(map[m.id])):null;
      if(existing)recordActiveMatchRecoverySnapshot(existing);

      m.localUpdatedAt=new Date().toISOString();
      recordActiveMatchRecoverySnapshot(m);
      localStorage.setItem(LOCAL_ACTIVE_MATCH_KEY,JSON.stringify(m));
      map[m.id]=JSON.parse(JSON.stringify(m));
      localStorage.setItem(LOCAL_ACTIVE_MATCHES_KEY,JSON.stringify(map));
    }catch(e){}
  }

  function removeDeviceActiveMatch(matchId){
    if(!matchId)return;
    try{
      const map=loadDeviceActiveMatches();
      delete map[matchId];
      localStorage.setItem(LOCAL_ACTIVE_MATCHES_KEY,JSON.stringify(map));

      const current=loadDeviceActiveMatch();
      if(current?.id===matchId)localStorage.removeItem(LOCAL_ACTIVE_MATCH_KEY);
    }catch(e){}
  }

  function getDeviceActiveMatch(matchId){
    if(!matchId)return null;
    try{
      const map=loadDeviceActiveMatches();
      return map[matchId] ? JSON.parse(JSON.stringify(map[matchId])) : null;
    }catch(e){return null;}
  }

  async function liveMatchRequest(matchId,method,body=null){
    if(!matchId)throw new Error('LIVE_MATCH_INVALID');
    if(!await ensureCloudToken())throw new Error('NO_AUTH');

    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null)opts.body=JSON.stringify(body);

    const r=await fetch(cloudUrl('stream/liveMatches/'+matchId),opts);
    if(!r.ok)throw new Error('LIVE_MATCH_'+r.status);
    try{return await r.json();}catch(e){return null;}
  }

  async function loadCloudLiveMatches(force=false){
    if(liveMatchLoadInProgress)return cloudLiveMatches;
    if(!await ensureCloudToken())return cloudLiveMatches;

    const now=Date.now();
    if(!force && now-liveLastCloudPollAt<700)return cloudLiveMatches;

    liveMatchLoadInProgress=true;
    liveLastCloudPollAt=now;

    try{
      const url=cloudUrl('stream/liveMatches')+'&_live='+now;
      const r=await fetch(url,{
        method:'GET',
        cache:'no-store',
        headers:{
          'Cache-Control':'no-cache, no-store, must-revalidate',
          'Pragma':'no-cache'
        }
      });

      if(!r.ok)throw new Error('LIVE_MATCHES_READ_'+r.status);

      const raw=await r.json()||{};
      const all=Object.values(raw).filter(m=>m && m.id && !m.endedAt);

      const fresh=[];
      const stale=[];

      all.forEach(m=>{
        const ts=Date.parse(m.updatedAt||m.startedAt||'');
        const age=Number.isFinite(ts)?now-ts:Infinity;
        if(age>LIVE_STALE_MS) stale.push(m);
        else fresh.push(m);
      });

      cloudLiveMatches=fresh;

      // Osiřelé LIVE záznamy po pádu/zavření aplikace čistíme automaticky.
      if(stale.length){
        // Cizí LIVE zápas nesmí běžný uživatel mazat. Rules dovolí mazání jen
        // vlastníkovi záznamu nebo systémovému administrátorovi.
        const deletable=stale.filter(m=>currentUserIsSystemAdmin() || m.createdByUid===cloudUid);
        if(deletable.length){
          Promise.allSettled(deletable.map(m=>liveMatchRequest(m.id,'DELETE')))
            .catch(()=>{});
        }
      }

      return cloudLiveMatches;
    }catch(e){
      console.error('Load live matches:',e);
      return cloudLiveMatches;
    }finally{
      liveMatchLoadInProgress=false;
    }
  }


  function liveMomentumSnapshotFromMatch(m){
    if(!m)return {scores:[],winners:[]};

    // Veřejný LIVE používá jen odvozený průběh skóre. Interní eventy se neposílají.
    const events=Array.isArray(m.events)?m.events:[];
    const h=Array.isArray(m.handicapScores)?[Number(m.handicapScores[0]||0),Number(m.handicapScores[1]||0)]:[0,0];
    let prev=[Math.max(0,h[0]),Math.max(0,h[1])];
    const scores=[prev[0]+':'+prev[1]];
    const winners=[];

    events.forEach(e=>{
      const mt=String(e?.text||'').match(/^Skóre\s+(\d+)\s*:\s*(\d+)/i);
      if(!mt)return;
      const cur=[Number(mt[1]),Number(mt[2])];
      let winner=null;
      if(cur[0]>prev[0] && cur[1]===prev[1])winner=0;
      else if(cur[1]>prev[1] && cur[0]===prev[0])winner=1;
      // Ruční korekce skóre nechceme vydávat za vyhraný rack.
      if(winner!==null){
        scores.push(cur[0]+':'+cur[1]);
        winners.push(winner);
      }
      prev=cur;
    });

    // Zamezíme zbytečně velkému veřejnému payloadu i u velmi dlouhého zápasu.
    return {scores:scores.slice(-30),winners:winners.slice(-29)};
  }

  function liveMatchPayload(m){
    if(!m||!m.id)return null;
    const momentum=liveMomentumSnapshotFromMatch(m);

    return {
      id:m.id,
      createdByUid:m.createdByUid||cloudUid||'',
      updatedAt:new Date().toISOString(),
      startedAt:m.startedAt||null,
      endedAt:m.endedAt||null,
      status:m.endedAt?'complete':'playing',

      playerIds:Array.isArray(m.playerIds)?m.playerIds.slice(0,3):[],
      playerNames:Array.isArray(m.playerNames)?m.playerNames.slice(0,3):[],
      scores:Array.isArray(m.scores)?m.scores.slice(0,3):[0,0],

      discipline:m.discipline||'',
      target:m.target??m.raceTo??null,
      raceTo:m.target??m.raceTo??null,
      turn:typeof m.turn==='number'?m.turn:null,
      breaker:typeof m.breaker==='number'?m.breaker:null,
      rackNumber:m.rackNumber||null,
      breakMode:m.breakMode||'',

      tournamentLink:m.tournamentLink?JSON.parse(JSON.stringify(m.tournamentLink)):null,
      leagueLink:m.leagueLink?JSON.parse(JSON.stringify(m.leagueLink)):null,

      // Veřejný LIVE payload nikdy neobsahuje plný rozehraný stav.
      // Bezpečná resume kopie je uložena pouze v chráněné větvi /matches/{id}.
      solo14:!!m.solo14,
      solo14GhostMode:!!m.solo14GhostMode,
      solo14GhostDifficulty:m.solo14GhostMode ? (m.solo14GhostDifficulty??null) : null,
      solo14GhostPointsPerError:m.solo14GhostMode ? Number(m.solo14GhostPointsPerError||0) : 0,
      solo14PlayerId:m.solo14 ? (m.playerIds?.[0]||'') : '',

      shotClockRemaining:m.useClock && typeof timeLeft==='number'?timeLeft:null,
      clockRunning:!!m.useClock && !!timerRunning,
      useClock:!!m.useClock,

      // Pouze veřejný, read-only vývoj skóre pro Livescore.
      liveScoreProgress:momentum.scores,
      liveRackWinners:momentum.winners
    };
  }

  async function pushLiveMatchNow(m=match){
    const payload=liveMatchPayload(m);
    if(!payload||payload.endedAt)return;

    try{
      await liveMatchRequest(payload.id,'PUT',payload);
      const i=cloudLiveMatches.findIndex(x=>x.id===payload.id);
      if(i>=0)cloudLiveMatches[i]=payload;
      else cloudLiveMatches.push(payload);
    }catch(e){
      console.error('Live match write:',e);
    }
  }

  function scheduleLiveMatchPush(){
    if(!match||match.endedAt)return;

    clearTimeout(liveMatchSendTimer);
    liveMatchSendTimer=setTimeout(()=>{
      pushLiveMatchNow(match);
    },180);
  }


  async function saveActiveMatchCloudBackupNow(m=match){
    if(!m || !m.id || m.endedAt || !cloudUid)return false;
    if(!editableMatchOwnedByCurrentUser(m))return false;

    const copy=JSON.parse(JSON.stringify(m));
    copy.endedAt=null;
    copy.status='playing';
    copy.winner=null;
    copy.updatedAt=new Date().toISOString();
    copy.activeResumeBackup=true;

    try{
      // Pojistka proti katastrofickému přepsání: pokud už cloud obsahuje
      // výrazně pokročilejší stav stejného zápasu, nulový/resetovaný stav ho nesmí přepsat.
      const existing=await secureMatchRequest(copy.id,'GET').catch(()=>null);
      if(existing && !existing.endedAt && catastrophicActiveMatchRegression(copy,existing)){
        console.error('BLOCKED REGRESSIVE ACTIVE MATCH BACKUP',copy.id,copy.scores,existing.scores);
        recordActiveMatchRecoverySnapshot(existing);
        return false;
      }
      await secureMatchRequest(copy.id,'PUT',copy);
      return true;
    }catch(e){
      console.warn('Active match cloud backup:',e);
      return false;
    }
  }

  function scheduleActiveMatchCloudBackup(){
    if(!match || match.endedAt || !cloudUid)return;
    clearTimeout(activeMatchCloudSaveTimer);
    activeMatchCloudSaveTimer=setTimeout(()=>{
      saveActiveMatchCloudBackupNow(match);
    },420);
  }

  async function removeActiveMatchCloudBackup(matchId){
    if(!matchId || !cloudUid)return false;
    try{
      const stored=await secureMatchRequest(matchId,'GET');
      if(!stored)return false;

      // Bezpečnostní pojistka: nikdy nemažeme dokončený / historický zápas jen proto,
      // že po něm zůstal osiřelý LIVE záznam. Maže se pouze aktivní resume záloha.
      const activeBackup=!!stored.activeResumeBackup || ['playing','active'].includes(stored.status);
      if(!activeBackup || stored.endedAt)return false;

      await secureMatchRequest(matchId,'DELETE');
      return true;
    }catch(e){
      console.warn('Active match cloud backup delete:',e);
      return false;
    }
  }

  function stopLiveHeartbeat(){
    if(liveHeartbeatTimer){
      clearInterval(liveHeartbeatTimer);
      liveHeartbeatTimer=null;
    }
  }

  function startLiveHeartbeat(){
    stopLiveHeartbeat();
    if(!match||match.endedAt)return;

    // Okamžitě po startu pošleme první stav.
    pushLiveMatchNow(match);

    // Pak udržujeme zápas živý i když se 20 minut nezmění skóre.
    liveHeartbeatTimer=setInterval(()=>{
      if(!match||match.endedAt){
        stopLiveHeartbeat();
        return;
      }
      pushLiveMatchNow(match);
    },LIVE_HEARTBEAT_MS);
  }


  async function removeLiveMatch(matchId){
    if(!matchId)return;
    try{
      await liveMatchRequest(matchId,'DELETE');
    }catch(e){
      console.error('Live match delete:',e);
    }
    cloudLiveMatches=cloudLiveMatches.filter(m=>m.id!==matchId);
  }


  let postMatchReturnScreen=null;
  let postMatchTournamentId=null;
  let liveScoreSelectedId=null;
  let liveRefreshTimer=null;
  let cloudLiveMatches=[];
  let liveMatchSendTimer=null;
  let activeMatchCloudSaveTimer=null;
  let liveMatchLoadInProgress=false;
  let liveLastCloudPollAt=0;
  let liveHeartbeatTimer=null;
  const LIVE_HEARTBEAT_MS=30*1000;
  const LIVE_STALE_MS=3*60*1000;
  const LIVE_WARNING_MS=90*1000;
  let selectedTournamentId=null;
  let forcedTournamentReturnId=null;
  let manualTournamentSeedOrder=[];

  let data = loadData();
  let match = loadDeviceActiveMatch();
  if(!match && data.currentMatch){
    match=JSON.parse(JSON.stringify(data.currentMatch));
    saveDeviceActiveMatch(match);
  }
  // Aktivní zápas necestuje přes společný data.currentMatch sync.
  // Plný rozehraný stav se ale bezpečně zálohuje do /matches/{id}, aby šel obnovit i na jiném zařízení.
  data.currentMatch=null;
  let timer = null;
  let timerRunning = false;
  let timeLeft = 30;
  let clockPhase = 'normal';
  let pendingThreeFoulLoser = null;
  let pendingTournamentLink = null;
  let pendingLeagueLink = null;
  let pendingFederalCupLink = null;
  let selectedLeagueFixtureId = null;
  let tournamentGuestDrafts=[];
  let tournamentSelectedPlayerIds=[];
  let tournamentDrawNumbers={};
  let tournamentCheckin={};
  let tournamentCheckinClosed=false;
  let tournamentPrizeMoney={mode:'percent',returnPercent:100,fixedAmount:0,bonus:0,payouts:[
    {label:'1. místo',count:1,percent:50},
    {label:'2. místo',count:1,percent:30},
    {label:'3. místo',count:1,percent:20}
  ]};
  const TOURNAMENT_CHECKIN_DRAFT_KEY='bcRybarnaTournamentCheckinDraft_v1';
  let tournamentCheckinDraftRestored=false;
  let guestAssignContext=null;

  // Jeden trvale používaný audio kontext.
  let audioCtx = null;
  function ensureAudio(){
    try{
      if(!audioCtx){
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if(audioCtx.state === 'suspended') audioCtx.resume();
    }catch(e){}
  }

  // Odemknutí zvuku uživatelským kliknutím / dotykem.
  document.addEventListener('touchstart', ensureAudio, {passive:true});
  document.addEventListener('click', ensureAudio, false);

  // Backward compatibility for data from older versions.
  Object.values(data.players||{}).forEach(p=>{if(p.nickname==null)p.nickname='';if(p.identifier==null)p.identifier='';if(p.club==null)p.club='';if(p.note==null)p.note='';if(p.equipment==null)p.equipment='';if(p.achievements==null)p.achievements='';if(p.photo==null)p.photo='';if(p.useNicknameInMatch==null)p.useNicknameInMatch=false;});
  (data.matches||[]).forEach(m=>{if(m.status==null)m.status='complete';});

  function defaultFederalCup2026(){
    return {
      year:2026,
      teamAName:'Slovensko',
      teamBName:'Česko',
      rosterA:['','','','',''],
      rosterB:['','','','',''],
      lineups:{},
      teamResults:{},
      updatedAt:0
    };
  }
  function defaultData(){ return {players:{}, matches:[], tournaments:[], tournamentSeries:[], leagues:[], federalCup2026:defaultFederalCup2026(), deletedMatchIds:[], deletedTournamentIds:[], currentMatch:null}; }
  function loadData(){
    try{
      const raw = window.localStorage ? window.localStorage.getItem(DB_KEY) : null;
      const parsed = raw ? JSON.parse(raw) : defaultData();
      return normalizeDataObject(parsed);
    }catch(e){
      return defaultData();
    }
  }
  function cloneForBackup(obj){
    const c=JSON.parse(JSON.stringify(obj||defaultData()));
    // Fotky profilů mohou být velmi velké. Pro bezpečnostní zálohu statistik je nepotřebujeme.
    Object.values(c.players||{}).forEach(p=>{if(p && p.photo)p.photo='';});
    return c;
  }

  function saveSafetyBackup(reason='cloud merge'){
    try{
      const payload={
        createdAt:Date.now(),
        reason,
        data:cloneForBackup(data)
      };
      localStorage.setItem(CLOUD_BACKUP_KEY,JSON.stringify(payload));
    }catch(e){
      console.warn('Safety backup:',e);
    }
  }

  function arrayMergeById(localArr,remoteArr,preferRemote){
    const out=new Map();
    (localArr||[]).forEach(x=>{if(x&&x.id)out.set(x.id,JSON.parse(JSON.stringify(x)));});
    (remoteArr||[]).forEach(x=>{
      if(!x||!x.id)return;
      if(!out.has(x.id) || preferRemote) out.set(x.id,JSON.parse(JSON.stringify(x)));
    });
    return [...out.values()];
  }

  function tournamentStatusRank(status){
    return {pending:0,assigned:1,playing:2,done:3}[status] ?? 0;
  }

  function mergeTournamentMatch(a,b,preferRemote=true){
    if(!a) return JSON.parse(JSON.stringify(b));
    if(!b) return JSON.parse(JSON.stringify(a));

    const ar=tournamentStatusRank(a.status), br=tournamentStatusRank(b.status);

    // Dokončený výsledek má vždy přednost před starším rozehraným/čekajícím stavem.
    if(ar!==br){
      return JSON.parse(JSON.stringify(ar>br ? a : b));
    }

    const preferred=preferRemote ? b : a;
    const other=preferRemote ? a : b;
    const out={...JSON.parse(JSON.stringify(other)),...JSON.parse(JSON.stringify(preferred))};

    // Číslo stolu zachováme, dokud zápas není dokončen.
    if(out.status!=='done') out.tableNumber=preferred.tableNumber || other.tableNumber || null;
    else out.tableNumber=null;

    return out;
  }

  function mergeTournamentRound(a,b,preferRemote=true){
    if(!a) return JSON.parse(JSON.stringify(b));
    if(!b) return JSON.parse(JSON.stringify(a));
    const preferred=preferRemote?b:a, other=preferRemote?a:b;
    const out={...JSON.parse(JSON.stringify(other)),...JSON.parse(JSON.stringify(preferred))};

    const byId=new Map();
    (a.matches||[]).forEach(m=>byId.set(m.id,JSON.parse(JSON.stringify(m))));
    (b.matches||[]).forEach(m=>{
      byId.set(m.id,mergeTournamentMatch(byId.get(m.id),m,preferRemote));
    });
    out.matches=[...byId.values()];

    const byeMap=new Map();
    [...(a.byes||[]),...(b.byes||[])].forEach(x=>{
      if(x) byeMap.set(String(x.playerId)+'|'+String(x.bracket||''),JSON.parse(JSON.stringify(x)));
    });
    out.byes=[...byeMap.values()];
    return out;
  }

  function recomputeDKOState(t){
    if(!t || t.format!=='dko' || !t.dko) return t;

    const losses={};
    (t.playerIds||[]).forEach(id=>losses[id]=0);
    let championId=null;
    let finalResetNeeded=false;

    for(const r of (t.dko.rounds||[])){
      for(const m of (r.matches||[])){
        if(m.status!=='done' || !m.loserId || !m.winnerId) continue;
        losses[m.loserId]=(losses[m.loserId]||0)+1;

        if(m.bracket==='GF'){
          if((losses[m.loserId]||0)>=2){
            championId=m.winnerId;
            finalResetNeeded=false;
          }else{
            const wl=losses[m.winnerId]||0;
            const ll=losses[m.loserId]||0;
            if(wl===1 && ll===1) finalResetNeeded=true;
          }
        }
      }
    }

    t.dko.losses=losses;
    t.dko.championId=championId;
    t.dko.finalResetNeeded=finalResetNeeded;
    t.status=championId?'complete':'active';

    if(!championId){
      // Pokud současně doběhly poslední zápasy kola na různých telefonech,
      // po sloučení výsledků vytvoříme další vlnu právě jednou.
      dkoCreateWave(t);
      assignTournamentTables(t);
    }
    return t;
  }

  function mergeTournamentObject(a,b,preferRemote=true){
    if(!a)return JSON.parse(JSON.stringify(b));
    if(!b)return JSON.parse(JSON.stringify(a));

    const preferred=preferRemote?b:a, other=preferRemote?a:b;
    const out={...JSON.parse(JSON.stringify(other)),...JSON.parse(JSON.stringify(preferred))};
    out.guests={...(a.guests||{}),...(b.guests||{})};
    if(!out.schedule && (a.schedule||b.schedule))out.schedule=JSON.parse(JSON.stringify(preferred.schedule||other.schedule));

    if(tournamentHasGroups(out)){
      const groups=new Map();
      (a.groups||[]).forEach(g=>groups.set(g.id,JSON.parse(JSON.stringify(g))));
      (b.groups||[]).forEach(g=>{
        const old=groups.get(g.id);
        if(!old){groups.set(g.id,JSON.parse(JSON.stringify(g)));return;}
        const merged={...old,...JSON.parse(JSON.stringify(g))};
        const mm=new Map();
        (old.matches||[]).forEach(m=>mm.set(m.id,JSON.parse(JSON.stringify(m))));
        (g.matches||[]).forEach(m=>mm.set(m.id,mergeTournamentMatch(mm.get(m.id),m,preferRemote)));
        merged.matches=[...mm.values()];
        groups.set(g.id,merged);
      });
      out.groups=[...groups.values()];
    }

    const mergePlayoff=(key)=>{
      if(!a[key]&&!b[key])return;
      const aa=a[key]||{},bb=b[key]||{};
      const base={...JSON.parse(JSON.stringify(aa)),...JSON.parse(JSON.stringify(bb))};
      const rounds=new Map();
      (aa.rounds||[]).forEach(r=>rounds.set(r.id,JSON.parse(JSON.stringify(r))));
      (bb.rounds||[]).forEach(r=>rounds.set(r.id,mergeTournamentRound(rounds.get(r.id),r,preferRemote)));
      base.rounds=[...rounds.values()];
      out[key]=base;
    };
    mergePlayoff('ko');
    mergePlayoff('dko');

    if(a.swiss||b.swiss){
      const aa=a.swiss||{},bb=b.swiss||{};
      const base={...JSON.parse(JSON.stringify(aa)),...JSON.parse(JSON.stringify(bb))};
      const rounds=new Map();
      (aa.rounds||[]).forEach(r=>rounds.set(r.id,JSON.parse(JSON.stringify(r))));
      (bb.rounds||[]).forEach(r=>rounds.set(r.id,mergeTournamentRound(rounds.get(r.id),r,preferRemote)));
      base.rounds=[...rounds.values()].sort((x,y)=>Number(x.number||0)-Number(y.number||0));
      out.swiss=base;
    }

    return out;
  }

  function mergeTournamentArrays(localArr,remoteArr,preferRemote=true){
    const map=new Map();
    (localArr||[]).forEach(t=>{if(t&&t.id)map.set(t.id,JSON.parse(JSON.stringify(t)));});
    (remoteArr||[]).forEach(t=>{
      if(!t||!t.id)return;
      map.set(t.id,mergeTournamentObject(map.get(t.id),t,preferRemote));
    });
    return [...map.values()];
  }

  function leagueFixtureStatusRank(status){ return {pending:0,playing:1,needs_decider:2,done:3}[status] ?? 0; }

  function mergeLeagueObject(a,b,preferRemote=true){
    if(!a)return JSON.parse(JSON.stringify(b));
    if(!b)return JSON.parse(JSON.stringify(a));
    const out=preferRemote ? {...JSON.parse(JSON.stringify(a)),...JSON.parse(JSON.stringify(b))} : {...JSON.parse(JSON.stringify(b)),...JSON.parse(JSON.stringify(a))};
    const fm=new Map();
    (a.fixtures||[]).forEach(f=>{if(f?.id)fm.set(f.id,JSON.parse(JSON.stringify(f)));});
    (b.fixtures||[]).forEach(f=>{
      if(!f?.id)return;
      const old=fm.get(f.id);
      if(!old){fm.set(f.id,JSON.parse(JSON.stringify(f)));return;}
      const or=leagueFixtureStatusRank(old.status), nr=leagueFixtureStatusRank(f.status);
      if(nr>or){fm.set(f.id,JSON.parse(JSON.stringify(f)));return;}
      if(nr<or)return;
      const ot=Date.parse(old.updatedAt||old.completedAt||old.startedAt||'')||0;
      const nt=Date.parse(f.updatedAt||f.completedAt||f.startedAt||'')||0;
      if(nt>ot || (nt===ot && preferRemote))fm.set(f.id,JSON.parse(JSON.stringify(f)));
    });
    out.fixtures=[...fm.values()];
    return out;
  }

  function mergeLeagueArrays(localArr,remoteArr,preferRemote=true){
    const map=new Map();
    (localArr||[]).forEach(l=>{if(l?.id)map.set(l.id,JSON.parse(JSON.stringify(l)));});
    (remoteArr||[]).forEach(l=>{if(l?.id)map.set(l.id,mergeLeagueObject(map.get(l.id),l,preferRemote));});
    return [...map.values()];
  }

  function mergeDataObjects(localData,remoteData,preferRemote=true){
    const l=normalizeDataObject(JSON.parse(JSON.stringify(localData||defaultData())));
    const r=normalizeDataObject(JSON.parse(JSON.stringify(remoteData||defaultData())));

    const players={};
    Object.entries(l.players||{}).forEach(([id,p])=>players[id]=JSON.parse(JSON.stringify(p)));
    Object.entries(r.players||{}).forEach(([id,p])=>{
      if(!players[id]) players[id]=JSON.parse(JSON.stringify(p));
      else players[id]=preferRemote
        ? {...players[id],...JSON.parse(JSON.stringify(p))}
        : {...JSON.parse(JSON.stringify(p)),...players[id]};
    });

    const deletedMatchIds=[...new Set([...(l.deletedMatchIds||[]),...(r.deletedMatchIds||[])])];
    const deletedTournamentIds=[...new Set([...(l.deletedTournamentIds||[]),...(r.deletedTournamentIds||[])])];
    const deletedMatchSet=new Set(deletedMatchIds);
    const deletedTournamentSet=new Set(deletedTournamentIds);

    const merged={
      players,
      matches:arrayMergeById(l.matches,r.matches,preferRemote).filter(m=>!deletedMatchSet.has(m.id)),
      tournaments:mergeTournamentArrays(l.tournaments,r.tournaments,preferRemote).filter(t=>!deletedTournamentSet.has(t.id)),
      tournamentSeries:arrayMergeById(l.tournamentSeries,r.tournamentSeries,preferRemote),
      leagues:mergeLeagueArrays(l.leagues,r.leagues,preferRemote),
      federalCup2026:JSON.parse(JSON.stringify(preferRemote ? r.federalCup2026 : l.federalCup2026)),
      deletedMatchIds,
      deletedTournamentIds,
      currentMatch:null
    };

    return normalizeDataObject(merged);
  }

  function restoreSafetyBackup(){
    let raw='';
    try{raw=localStorage.getItem(CLOUD_BACKUP_KEY)||'';}catch(e){}
    if(!raw){toast('Žádná lokální záloha zatím není k dispozici.');return;}
    let b;
    try{b=JSON.parse(raw);}catch(e){toast('Zálohu se nepodařilo načíst.');return;}
    if(!b || !b.data){toast('Záloha je neplatná.');return;}

    const when=b.createdAt ? new Date(b.createdAt).toLocaleString('cs-CZ') : '';
    if(!confirm('Obnovit lokální zálohu'+(when?' z '+when:'')+'? Současná data se nejdřív znovu zazálohují.')) return;

    saveSafetyBackup('before manual restore');
    cloudApplyingRemote=true;
    try{
      const activeBefore=match ? JSON.parse(JSON.stringify(match)) : loadDeviceActiveMatch();
      data=normalizeDataObject(b.data);
      data.currentMatch=null;
      match=activeBefore;
      saveDeviceActiveMatch(match);
      localStorage.setItem(DB_KEY,JSON.stringify(data));
      localStorage.setItem(CLOUD_LOCAL_TS_KEY,String(Date.now()));
      refreshViewsAfterCloudLoad();
    }finally{
      cloudApplyingRemote=false;
    }
    scheduleCloudDataSync();
    toast('Lokální záloha obnovena.');
  }

  function markLocalDataChanged(){
    if(cloudApplyingRemote) return;
    try{ localStorage.setItem(CLOUD_LOCAL_TS_KEY,String(Date.now())); }catch(e){}
  }

  function saveData(){
    data.currentMatch=null;
    try{
      if(window.localStorage) window.localStorage.setItem(DB_KEY, JSON.stringify(data));
    }catch(e){}
    markLocalDataChanged();
    scheduleCloudDataSync();
    refreshPlayerList();
  }

  function autosaveCurrent(){
    data.currentMatch=null;
    saveDeviceActiveMatch(match);
    try{
      if(window.localStorage) window.localStorage.setItem(DB_KEY, JSON.stringify(data));
    }catch(e){
      // Zápas zůstává v paměti zařízení i při omezeném localStorage.
    }

    // Read-only stav se publikuje pro LIVE. Plný stav se zároveň bezpečně zálohuje
    // do vlastního záznamu zápasu, aby šlo pokračovat i po ztrátě lokálního snapshotu.
    scheduleLiveMatchPush();
    scheduleActiveMatchCloudBackup();
  }

  function updateLoggedInUserBadge(){
    refreshStreamOverlayUrl();
    const el=$('loggedInUserBadge');
    const modernEl=$('modernLoggedInUserBadge');
    const modernRole=$('modernAccountRole');

    try{discardForeignLocalActiveMatch();}catch(e){}

    const applyBadge=(label,title,role)=>{
      if(el){
        el.textContent=label;
        el.title=title||label;
      }
      if(modernEl){
        modernEl.textContent=label.replace(/^Přihlášen:\s*/,'');
        modernEl.title=title||label;
      }
      if(modernRole) modernRole.textContent=role||'—';
    };

    if(!cloudAuthenticated || !cloudUid){
      applyBadge('Nepřihlášen','Není aktivní přihlášení','OFFLINE');
      return;
    }

    let name='';
    if(currentUserPlayerId && data.players?.[currentUserPlayerId]){
      name=playerDisplayName(data.players[currentUserPlayerId]);
    }

    if(!name){
      const email=typeof cloudUserEmail==='string' ? cloudUserEmail.trim() : '';
      name=email || 'Přihlášený účet';
    }

    const roleLabel=currentUserRole==='system_admin'
      ? 'ADMIN'
      : (currentUserRole==='club_admin' ? 'CLUB ADMIN' : 'HRÁČ');
    const adminSuffix=currentUserIsSystemAdmin() ? ' ★' : '';
    applyBadge('Přihlášen: '+name+adminSuffix,name+adminSuffix,roleLabel);
  }

  function setCloudStatus(label,ok=false){
    const b=$('cloudStatusBtn');
    const dot=$('modernCloudDot');
    const raw=String(label||'').trim();
    const upper=raw.toUpperCase();
    if(b){
      b.title='Cloud: '+(raw||'stav neznámý');
      b.setAttribute('aria-label','Cloud: '+(raw||'stav neznámý'));
    }
    if(dot){
      dot.classList.remove('online','busy');
      if(ok || upper.includes('ONLINE') || upper.includes('AUTO')) dot.classList.add('online');
      else if(upper.includes('PŘIPOJUJI') || upper.includes('SYNC') || upper.includes('NAČÍT')) dot.classList.add('busy');
    }
    try{updateLoggedInUserBadge();}catch(e){}
  }

  function localCloudTimestamp(){
    try{return Number(localStorage.getItem(CLOUD_LOCAL_TS_KEY)||0);}catch(e){return 0;}
  }

  function writeLocalWithoutCloudSync(newData,cloudTs){
    const activeBefore=match ? JSON.parse(JSON.stringify(match)) : loadDeviceActiveMatch();
    data=normalizeDataObject(newData);
    data.currentMatch=null;
    match=activeBefore;
    saveDeviceActiveMatch(match);
    try{
      localStorage.setItem(DB_KEY,JSON.stringify(data));
      localStorage.setItem(CLOUD_LOCAL_TS_KEY,String(cloudTs||Date.now()));
    }catch(e){}
  }


  let cloudReports=[];
  let ownReportsPollTimer=null;
  const OWN_REPORTS_POLL_MS=5000;
  function reportTypeLabel(type){return {bug:'Chyba aplikace',feature:'Návrh na zlepšení',data:'Chybná data / výsledek',account:'Účet / profil',other:'Ostatní'}[type]||'Ostatní';}
  function reportStatusLabel(status){return {new:'NOVÉ',in_progress:'ŘEŠÍ SE',resolved:'VYŘEŠENO'}[status]||'NOVÉ';}

  async function writeReportUserMirror(report){
    if(!report || !report.id || !report.createdByUid)return false;
    if(!await ensureCloudToken())throw new Error('NO_AUTH');

    const token=await currentIdToken();
    if(!token)throw new Error('NO_AUTH');

    const mirror={
      id:report.id,
      createdByUid:report.createdByUid,
      createdByPlayerId:report.createdByPlayerId||'',
      createdByName:report.createdByName||'',
      type:report.type||'other',
      area:report.area||'',
      description:report.description||'',
      appVersion:report.appVersion||'',
      createdAt:report.createdAt||new Date().toISOString(),
      updatedAt:report.updatedAt||new Date().toISOString(),
      status:report.status||'new',
      adminNote:report.adminNote||''
    };

    const url=`${FIREBASE_DB_URL}/reportIndexByUser/${encodeURIComponent(report.createdByUid)}/${encodeURIComponent(report.id)}.json?auth=${encodeURIComponent(token)}`;
    const r=await fetch(url,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify(mirror),
      cache:'no-store'
    });
    if(!r.ok){
      const body=await r.text().catch(()=> '');
      throw new Error('REPORT_MIRROR_'+r.status+(body?': '+body:''));
    }
    return true;
  }

  async function reportRequest(reportId,method,body=null){
    if(!await ensureCloudToken())throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null)opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('reports/'+reportId),opts);
    if(!r.ok){
      const body=await r.text().catch(()=> '');
      throw new Error('REPORT_'+r.status+(body?': '+body:''));
    }
    try{return await r.json();}catch(e){return null;}
  }

  function stopOwnReportsPolling(){
    if(ownReportsPollTimer){
      clearInterval(ownReportsPollTimer);
      ownReportsPollTimer=null;
    }
  }

  function startOwnReportsPolling(){
    stopOwnReportsPolling();
    ownReportsPollTimer=setInterval(()=>{
      const screen=$('screen-reports');
      if(!screen || !screen.classList.contains('active')){
        stopOwnReportsPolling();
        return;
      }
      loadOwnReports(true);
    },OWN_REPORTS_POLL_MS);
  }

  async function loadOwnReports(silent=false){
    if(!await ensureCloudToken())return [];
    try{
      const r=await fetch(cloudUrl('reportIndexByUser/'+cloudUid)+'&t='+Date.now(),{
        cache:'no-store',
        headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}
      });
      if(!r.ok)throw new Error('REPORT_INDEX_'+r.status);

      const raw=await r.json()||{};
      const rows=[];

      for(const [id,value] of Object.entries(raw)){
        if(value && typeof value==='object'){
          rows.push({...value,id:value.id||id});
          continue;
        }

        // Zpětná kompatibilita pro staré indexy uložené pouze jako true.
        if(value===true){
          try{
            const item=await reportRequest(id,'GET');
            if(item){
              rows.push(item);
              // Starý záznam rovnou převedeme na nový mirror.
              try{await writeReportUserMirror(item);}catch(e){}
            }
          }catch(e){
            console.warn('Load legacy report',id,e);
          }
        }
      }

      cloudReports=rows
        .filter(r=>r && r.createdByUid===cloudUid)
        .sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));

      renderMyReports();
      if(!silent && $('reportSubmitInfo')){
        $('reportSubmitInfo').textContent='Hlášení aktualizována • '+new Date().toLocaleTimeString('cs-CZ',{hour:'2-digit',minute:'2-digit'});
      }
      return cloudReports;
    }catch(e){
      console.error('Load own reports:',e);
      if(!silent && $('reportSubmitInfo'))$('reportSubmitInfo').textContent='Moje hlášení se nepodařilo obnovit.';
      renderMyReports();
      return cloudReports;
    }
  }

  function renderMyReports(){
    const wrap=$('myReportsList');if(!wrap)return;
    const rows=(cloudReports||[]).filter(r=>r&&r.createdByUid===cloudUid);
    if(!rows.length){wrap.innerHTML='<div class="muted">Zatím jsi neposlal žádné hlášení.</div>';return;}
    wrap.innerHTML=rows.map(r=>`<div class="subpanel" style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap"><div><strong>${esc(reportTypeLabel(r.type))}</strong>${r.area?' • '+esc(r.area):''}<div class="muted" style="margin-top:4px">${esc(new Date(r.createdAt).toLocaleString('cs-CZ'))}</div></div><span class="tournament-badge ${r.status==='resolved'?'gold':''}">${esc(reportStatusLabel(r.status))}</span></div><div style="margin-top:9px;white-space:pre-wrap">${esc(r.description||'')}</div>${r.adminNote?`<div class="subpanel" style="margin-top:10px"><strong>Odpověď admina:</strong><div style="margin-top:5px;white-space:pre-wrap">${esc(r.adminNote)}</div></div>`:''}</div>`).join('');
  }

  async function submitProblemReport(){
    const type=$('reportType')?.value||'other',area=($('reportArea')?.value||'').trim(),description=($('reportDescription')?.value||'').trim();
    if(description.length<5){toast('Popiš prosím problém trochu podrobněji.');return;}
    if(!cloudUid){toast('Pro odeslání hlášení musíš být přihlášen.');return;}
    const btn=$('submitReportBtn');if(btn)btn.disabled=true;
    try{
      const id=uid(),p=currentUserPlayerId?data.players?.[currentUserPlayerId]:null;
      const report={id,createdByUid:cloudUid,createdByPlayerId:currentUserPlayerId||'',createdByName:p?playerSelectionLabel(p):(cloudUserEmail||'Uživatel'),email:cloudUserEmail||'',type,area,description,appVersion:'v4.51.75 RC',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'new',adminNote:''};
      await reportRequest(id,'PUT',report);
      try{
        await writeReportUserMirror(report);
      }catch(indexError){
        console.warn('Report mirror write:',indexError);
      }
      $('reportDescription').value='';$('reportArea').value='';$('reportSubmitInfo').textContent='Hlášení bylo odesláno adminovi.';toast('Hlášení bylo odesláno.');await loadOwnReports();if(currentUserIsSystemAdmin())await loadReportsAdmin();
    }catch(e){
      console.error('Submit report:',e);
      const msg=String(e&&e.message||e||'');
      if(msg.includes('REPORT_401')||msg.includes('REPORT_403')){
        toast('Firebase zápis odmítl. Nasad nová Realtime Database Rules.');
        if($('reportSubmitInfo'))$('reportSubmitInfo').textContent='Firebase nemá povolený zápis do /reports. Nasad aktuální Realtime Database Rules.';
      }else{
        toast('Hlášení se nepodařilo odeslat.');
        if($('reportSubmitInfo'))$('reportSubmitInfo').textContent='Chyba: '+msg;
      }
    }finally{if(btn)btn.disabled=false;}
  }

  async function loadReportsAdmin(){
    const wrap=$('reportsAdminList');if(!currentUserIsSystemAdmin()){if(wrap)wrap.innerHTML='<div class="muted">Pouze pro systémového administrátora.</div>';return [];}
    try{if(!await ensureCloudToken())throw new Error('NO_AUTH');const r=await fetch(cloudUrl('reports')+'&t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('REPORTS_ADMIN_'+r.status);const raw=await r.json()||{};const order={new:0,in_progress:1,resolved:2};const rows=Object.values(raw).filter(Boolean).sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||new Date(b.createdAt||0)-new Date(a.createdAt||0));renderReportsAdmin(rows);return rows;}catch(e){console.error('Load reports admin:',e);if(wrap)wrap.innerHTML='<div class="muted">Hlášení se nepodařilo načíst.</div>';return [];}
  }

  function renderReportsAdmin(rows){
    const wrap=$('reportsAdminList');if(!wrap)return;if(!rows.length){wrap.innerHTML='<div class="muted">Žádná hlášení.</div>';return;}
    wrap.innerHTML=rows.map(r=>`<div class="subpanel" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><strong>${esc(r.createdByName||r.email||'Uživatel')}</strong><div class="muted">${esc(reportTypeLabel(r.type))}${r.area?' • '+esc(r.area):''} • ${esc(r.appVersion||'')}</div><div class="muted">${esc(new Date(r.createdAt).toLocaleString('cs-CZ'))}</div></div><select id="reportStatus_${r.id}" onchange="updateReportStatus('${r.id}',this.value)"><option value="new" ${r.status==='new'?'selected':''}>NOVÉ</option><option value="in_progress" ${r.status==='in_progress'?'selected':''}>ŘEŠÍ SE</option><option value="resolved" ${r.status==='resolved'?'selected':''}>VYŘEŠENO</option></select></div><div style="margin-top:10px;white-space:pre-wrap">${esc(r.description||'')}</div><div style="margin-top:10px"><label>Odpověď / poznámka pro uživatele</label><textarea id="reportNote_${r.id}" rows="3">${esc(r.adminNote||'')}</textarea><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:7px"><button class="btn report-save-note-btn" data-report-id="${r.id}">ULOŽIT ODPOVĚĎ</button><button class="btn danger report-delete-btn" data-report-id="${r.id}">SMAZAT</button></div></div></div>`).join('');

    wrap.querySelectorAll('.report-save-note-btn').forEach(btn=>{
      btn.addEventListener('click',()=>window.saveReportAdminNote(btn.dataset.reportId));
    });
    wrap.querySelectorAll('.report-delete-btn').forEach(btn=>{
      btn.addEventListener('click',()=>window.deleteProblemReport(btn.dataset.reportId));
    });
  }

  window.updateReportStatus=async function(id,status){
    if(!currentUserIsSystemAdmin())return;
    try{
      const report=await reportRequest(id,'GET');
      if(!report)return;
      report.status=status;
      report.updatedAt=new Date().toISOString();
      await reportRequest(id,'PUT',report);
      await writeReportUserMirror(report);
      await loadReportsAdmin();
      toast('Stav hlášení byl uložen.');
    }catch(e){
      console.error('Update report status:',e);
      toast('Stav hlášení se nepodařilo uložit.');
    }
  };
  window.saveReportAdminNote=async function(id){
    if(!currentUserIsSystemAdmin())return;
    try{
      const report=await reportRequest(id,'GET');
      if(!report)return;
      report.adminNote=($('reportNote_'+id)?.value||'').trim();
      if(report.adminNote&&report.status==='new')report.status='in_progress';
      report.updatedAt=new Date().toISOString();

      await reportRequest(id,'PUT',report);
      await writeReportUserMirror(report);

      toast('Odpověď byla odeslána uživateli.');
      await loadReportsAdmin();
    }catch(e){
      console.error('Save report admin note:',e);
      toast('Odpověď se nepodařilo odeslat uživateli.');
    }
  };
  async function deleteProblemReportAction(id){
    if(!currentUserIsSystemAdmin()){
      toast('Tuto akci může provést pouze admin.');
      return;
    }
    if(!confirm('Opravdu toto hlášení smazat?'))return;

    let report=null;
    try{
      report=await reportRequest(id,'GET');
    }catch(e){
      console.error('Read report before delete:',e);
    }

    try{
      // 1) Smažeme hlavní report v /reports.
      await reportRequest(id,'DELETE');

      // 2) Smažeme i hráčský mirror/index.
      if(report?.createdByUid){
        if(!await ensureCloudToken())throw new Error('NO_AUTH');
        const token=await currentIdToken();
        if(!token)throw new Error('NO_AUTH');

        const mirrorUrl=`${FIREBASE_DB_URL}/reportIndexByUser/${encodeURIComponent(report.createdByUid)}/${encodeURIComponent(id)}.json?auth=${encodeURIComponent(token)}`;
        const mr=await fetch(mirrorUrl,{
          method:'DELETE',
          cache:'no-store',
          headers:{'Cache-Control':'no-cache, no-store, must-revalidate'}
        });

        if(!mr.ok && mr.status!==404){
          const body=await mr.text().catch(()=> '');
          throw new Error('REPORT_MIRROR_DELETE_'+mr.status+(body?': '+body:''));
        }
      }

      // Lokálně hned odebereme záznam, aby nezůstal viset do dalšího refresh.
      const wrap=$('reportsAdminList');
      if(wrap){
        const btn=wrap.querySelector(`.report-delete-btn[data-report-id="${CSS.escape(id)}"]`);
        const panel=btn?.closest('.subpanel');
        if(panel)panel.remove();
      }

      toast('Hlášení bylo smazáno.');
      await loadReportsAdmin();
    }catch(e){
      console.error('Delete problem report:',e);
      const code=String(e&&e.message?e.message:e||'');
      if(code.includes('401')||code.includes('403')||code.includes('PERMISSION_DENIED')){
        toast('Smazání odmítla Firebase pravidla. Je potřeba upravit oprávnění pro admina.');
      }else{
        toast('Hlášení se nepodařilo smazat.');
      }
    }
  }
  window.deleteProblemReport=deleteProblemReportAction;

  function refreshViewsAfterCloudLoad(){
    refreshPlayerList();
    updateLoggedInUserBadge();
    try{ renderPlayers(); }catch(e){}
    try{ renderHistory(); }catch(e){}
    try{ renderStats(); }catch(e){}
    try{ renderTournament(); renderSeriesList(); renderTournamentSeriesSelect(); }catch(e){}
    try{window.renderFederalCup2026?.();}catch(e){}
    updateDisciplineSetup();
    setTimeout(maybeShowPendingResultConfirmation,100);

    if(match && !match.endedAt){
      if(match.discipline==='14.1' && match.ballsOnTable==null) match.ballsOnTable=15;
      if(match.discipline==='14.1' && match.reracksInInning14==null) match.reracksInInning14=0;
      if(match.discipline==='14.1' && !match.consecutiveFouls14) match.consecutiveFouls14=[0,0];
      if(match.discipline==='14.1' && match.openingBreakAvailable14==null) match.openingBreakAvailable14=false;
      if(match.streamEnabled==null) match.streamEnabled=false;
      if(match.streamMatchTitle==null) match.streamMatchTitle='';
      if(!match.streamMode) match.streamMode='live';
      if(match.isBreakShot==null) match.isBreakShot=false;
      if(match.nineBallBreakRule==null) match.nineBallBreakRule='none';
      if(match.tenBallRule==null) match.tenBallRule='spot';
      if(match.ghostMode && (match.discipline==='9-ball'||match.discipline==='10-ball') && match.ghostBallCount==null){
        match.ghostBallCount=ghostFullBallCountForDiscipline(match.discipline);
      }
      if(match.softBreakOriginalBreaker===undefined) match.softBreakOriginalBreaker=null;
      if(match.softBreakReturnEligibleFor===undefined) match.softBreakReturnEligibleFor=null;
      if(match.breakAndRunEligible===undefined) match.breakAndRunEligible=true;
      if(!Array.isArray(match.inningsHistory14)) match.inningsHistory14=[];
      if(match.runoutEligibleFor===undefined) match.runoutEligibleFor=null;
      if(match.runoutEligibleReason===undefined) match.runoutEligibleReason=null;
      if(match.pushOutEligibleFor===undefined) match.pushOutEligibleFor=null;
      if(match.pushOutBy===undefined) match.pushOutBy=null;
      if(match.pushOutDecisionFor===undefined) match.pushOutDecisionFor=null;
      if(match.safetyEscapeEligibleFor===undefined) match.safetyEscapeEligibleFor=null;
      showScreen('match');
      if(match.useClock) resetClock(false,false);
      renderMatch();
    }
  }

  async function currentIdToken(forceRefresh=false){
    if(forceRefresh){
      let refresh=cloudRefreshToken;
      if(!refresh){
        const saved=persistedCloudSession();
        refresh=saved.refresh||'';
        if(!cloudUserEmail)cloudUserEmail=saved.email||'';
      }
      if(!refresh)return '';
      await firebaseRefreshAuth(refresh);
    }else if(!await ensureCloudToken()){
      return '';
    }
    return cloudIdToken||'';
  }

  async function firebaseAccountLookup(){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');

    const r=await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key='+encodeURIComponent(FIREBASE_API_KEY),
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({idToken:cloudIdToken})
      }
    );
    const j=await r.json();
    if(!r.ok) throw new Error((j.error&&j.error.message)||'LOOKUP_FAILED');

    const user=(j.users&&j.users[0])||null;
    if(user){
      cloudUid=user.localId||cloudUid||'';
      cloudUserEmail=user.email||cloudUserEmail||'';
      cloudEmailVerified=!!user.emailVerified;
    }
    return user;
  }

  function friendlyVerificationError(code){
    code=String(code||'');
    if(code.includes('TOO_MANY_ATTEMPTS_TRY_LATER')) return 'Příliš mnoho pokusů. Počkej několik minut a zkus odeslání znovu.';
    if(code.includes('USER_DISABLED')) return 'Tento účet je ve Firebase zablokovaný.';
    if(code.includes('EMAIL_NOT_FOUND')) return 'Firebase tento účet nenašel.';
    if(code.includes('INVALID_ID_TOKEN') || code.includes('TOKEN_EXPIRED')) return 'Přihlášení vypršelo. Přihlas se znovu a zkus odeslání znovu.';
    if(code.includes('OPERATION_NOT_ALLOWED')) return 'Ověřování e-mailu není ve Firebase správně povolené.';
    return code || 'VERIFY_SEND_FAILED';
  }

  async function sendVerificationEmail(){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');

    // Před odesláním ověříme skutečný účet a cílovou adresu.
    const account=await firebaseAccountLookup();
    if(!account || !cloudUserEmail) throw new Error('EMAIL_NOT_FOUND');
    if(cloudEmailVerified) return {alreadyVerified:true,email:cloudUserEmail};

    async function doSend(){
      const r=await fetch(
        'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key='+encodeURIComponent(FIREBASE_API_KEY),
        {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            requestType:'VERIFY_EMAIL',
            idToken:cloudIdToken
          })
        }
      );
      const j=await r.json().catch(()=>({}));
      if(!r.ok){
        const code=(j.error&&j.error.message)||('HTTP_'+r.status);
        throw new Error(code);
      }
      return j;
    }

    try{
      const response=await doSend();
      return {ok:true,email:cloudUserEmail,response};
    }catch(e){
      const code=String(e&&e.message?e.message:e||'');
      // Jednou zkusíme obnovit token, pokud Firebase hlásí problém s tokenem.
      if((code.includes('INVALID_ID_TOKEN') || code.includes('TOKEN_EXPIRED')) && cloudRefreshToken){
        await firebaseRefreshAuth(cloudRefreshToken);
        const response=await doSend();
        return {ok:true,email:cloudUserEmail,response};
      }
      throw new Error(friendlyVerificationError(code));
    }
  }

  function showEmailVerificationGate(){
    $('cloudLoginModal').classList.remove('show');
    $('emailVerifyInfo').textContent='Ověřovací e-mail posíláme na '+(cloudUserEmail||'tvůj e-mail')+'.';
    $('emailVerifyMessage').textContent='';
    $('emailVerifyModal').classList.add('show');
  }

  async function ensureVerifiedBeforeApp(){
    const user=await firebaseAccountLookup();
    if(!user) return false;

    // Bezpečnost: ověřený e-mail vyžadujeme i u hlavního administrátora.
    if(!cloudEmailVerified){
      showEmailVerificationGate();
      return false;
    }

    $('emailVerifyModal').classList.remove('show');
    return true;
  }

  function isMainAdminEmail(email){
    return String(email||'').trim().toLowerCase()===MAIN_ADMIN_EMAIL;
  }

  function persistCloudSession(email,refreshToken,forceSessionOnly=false){
    const sessionOnly=forceSessionOnly || currentUserRole==='system_admin' || isMainAdminEmail(email);
    try{
      if(sessionOnly){
        sessionStorage.setItem(CLOUD_ADMIN_SESSION_REFRESH_KEY,refreshToken||'');
        sessionStorage.setItem(CLOUD_ADMIN_SESSION_EMAIL_KEY,email||'');
        localStorage.removeItem(CLOUD_REFRESH_KEY);
        localStorage.removeItem(CLOUD_EMAIL_KEY);
      }else{
        localStorage.setItem(CLOUD_REFRESH_KEY,refreshToken||'');
        localStorage.setItem(CLOUD_EMAIL_KEY,email||'');
        sessionStorage.removeItem(CLOUD_ADMIN_SESSION_REFRESH_KEY);
        sessionStorage.removeItem(CLOUD_ADMIN_SESSION_EMAIL_KEY);
      }
    }catch(e){}
  }

  function persistedCloudSession(){
    let sessionEmail='',sessionRefresh='',localEmail='',localRefresh='';
    try{
      sessionEmail=sessionStorage.getItem(CLOUD_ADMIN_SESSION_EMAIL_KEY)||'';
      sessionRefresh=sessionStorage.getItem(CLOUD_ADMIN_SESSION_REFRESH_KEY)||'';
      localEmail=localStorage.getItem(CLOUD_EMAIL_KEY)||'';
      localRefresh=localStorage.getItem(CLOUD_REFRESH_KEY)||'';
    }catch(e){}

    if(sessionRefresh){
      return {email:sessionEmail,refresh:sessionRefresh,sessionOnly:true};
    }

    // Migrace starého chování: hlavní admin nesmí být automaticky obnoven
    // z dlouhodobého localStorage tokenu.
    if(localRefresh && isMainAdminEmail(localEmail)){
      try{
        localStorage.removeItem(CLOUD_REFRESH_KEY);
        localStorage.removeItem(CLOUD_EMAIL_KEY);
      }catch(e){}
      return {email:localEmail,refresh:'',sessionOnly:true,expiredAdminPersistence:true};
    }

    return {email:localEmail,refresh:localRefresh,sessionOnly:false};
  }

  function enforceAdminSessionPersistence(){
    if(currentUserRole!=='system_admin' || !cloudRefreshToken)return;
    persistCloudSession(cloudUserEmail,cloudRefreshToken,true);
  }

  async function firebaseRegister(email,password){
    const r=await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+encodeURIComponent(FIREBASE_API_KEY),
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password,returnSecureToken:true})
      }
    );
    const j=await r.json();
    if(!r.ok) throw new Error((j.error&&j.error.message)||'REGISTER_FAILED');

    cloudUid=j.localId||'';
    cloudUserEmail=j.email||email||'';
    cloudIdToken=j.idToken;
    cloudRefreshToken=j.refreshToken;
    cloudTokenExpiresAt=Date.now()+(Number(j.expiresIn||3600)*1000)-60000;
    cloudAuthenticated=true;

    persistCloudSession(email,cloudRefreshToken,isMainAdminEmail(email));

    // Do Realtime Database ještě nezapisujeme. Bezpečnostní Rules povolují
    // zápisy až po ověření e-mailu; uživatelský záznam vznikne po ověření.
    cloudEmailVerified=false;
    await sendVerificationEmail();
    setCloudStatus('OVĚŘ E-MAIL',false);
    return true;
  }


  async function firebaseSignIn(email,password){
    const r=await fetch(
      'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key='+encodeURIComponent(FIREBASE_API_KEY),
      {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({email,password,returnSecureToken:true})
      }
    );
    const j=await r.json();
    if(!r.ok) throw new Error((j.error&&j.error.message)||'LOGIN_FAILED');

    cloudIdToken=j.idToken;
    cloudRefreshToken=j.refreshToken;
    cloudTokenExpiresAt=Date.now()+(Number(j.expiresIn||3600)*1000)-60000;
    cloudAuthenticated=true;
    cloudLastError='';

    persistCloudSession(email,cloudRefreshToken,isMainAdminEmail(email));
    setCloudStatus('ONLINE • AUTO',true);
    startCloudAutoSync();
    return true;
  }


  async function firebaseRefreshAuth(refreshToken){
    if(!refreshToken) return false;
    const body='grant_type=refresh_token&refresh_token='+encodeURIComponent(refreshToken);
    const r=await fetch(
      'https://securetoken.googleapis.com/v1/token?key='+encodeURIComponent(FIREBASE_API_KEY),
      {
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body
      }
    );
    const j=await r.json();
    if(!r.ok) throw new Error((j.error&&j.error.message)||'REFRESH_FAILED');

    cloudIdToken=j.id_token;
    cloudRefreshToken=j.refresh_token||refreshToken;
    cloudTokenExpiresAt=Date.now()+(Number(j.expires_in||3600)*1000)-60000;
    cloudAuthenticated=true;
    cloudLastError='';
    persistCloudSession(cloudUserEmail,cloudRefreshToken,currentUserRole==='system_admin' || isMainAdminEmail(cloudUserEmail));
    setCloudStatus('ONLINE • AUTO',true);
    startCloudAutoSync();
    return true;
  }



  async function securePlayerRequest(playerId,method,body=null){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null) opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('players/'+playerId),opts);
    if(!r.ok) throw new Error('PLAYER_SECURE_'+r.status);
    return await r.json();
  }




  async function secureTournamentRequest(tournamentId,method,body=null){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null) opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('tournaments/'+tournamentId),opts);
    if(!r.ok) throw new Error('TOURNAMENT_SECURE_'+r.status);
    return await r.json();
  }

  async function loadSecureTournaments(){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const r=await fetch(cloudUrl('tournaments')+'&t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('TOURNAMENTS_READ_'+r.status);
    const raw=await r.json()||{};
    data.tournaments=Object.values(raw).filter(Boolean);
    const repaired=[];
    data.tournaments.forEach(t=>{
      if(!t.managerUids||typeof t.managerUids!=='object'||Array.isArray(t.managerUids))t.managerUids={};
      try{
        if(repairHybridWaitingState(t))repaired.push(t);
      }catch(e){}
    });
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

    // Opravu starého chybného stavu zapíšeme i do cloudu, pokud má uživatel oprávnění.
    for(const t of repaired){
      try{
        if(canManageTournament(t))await secureTournamentRequest(t.id,'PUT',t);
      }catch(e){
        console.warn('Hybrid waiting-state repair save:',e);
      }
    }

    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
    return data.tournaments;
  }

  async function saveSecureTournament(tournament){
    if(!tournament || !tournament.id) throw new Error('TOURNAMENT_INVALID');

    const copy=JSON.parse(JSON.stringify(tournament));
    if(!copy.createdByUid) copy.createdByUid=cloudUid||'';
    copy.updatedAt=new Date().toISOString();

    // JEDINÝ zápis do /tournaments/{id}. Žádné rekurzivní volání.
    await secureTournamentRequest(copy.id,'PUT',copy);

    const i=(data.tournaments||[]).findIndex(t=>t.id===copy.id);
    if(i>=0) data.tournaments[i]=copy;
    else data.tournaments.push(copy);

    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
    return copy;
  }

  async function deleteSecureTournament(tournamentId){
    await secureTournamentRequest(tournamentId,'DELETE');
    data.tournaments=(data.tournaments||[]).filter(t=>t.id!==tournamentId);
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
  }

  function matchConfirmationUids(m){
    if(!m || m.solo14 || m.ghostMode || m.winnerTableMode || m.doublesMode)return [];
    if(!Array.isArray(m.playerIds) || m.playerIds.length<2)return [];
    const p1=data.players?.[m.playerIds[0]];
    const p2=data.players?.[m.playerIds[1]];
    const u1=String(p1?.ownerUid||'').trim();
    const u2=String(p2?.ownerUid||'').trim();
    if(!u1 || !u2 || u1===u2)return [];
    return [u1,u2];
  }

  function matchNeedsDualConfirmation(m){
    if(currentUserIsSystemAdmin())return false;
    if(m?.tournamentLink || m?.leagueLink)return false;
    return matchConfirmationUids(m).length===2;
  }

  function matchConfirmationComplete(m){
    if(m?.adminConfirmation?.confirmed===true)return true;
    if(!m?.confirmationRequired)return true;
    const uids=Array.isArray(m.confirmationUids)&&m.confirmationUids.length===2
      ? m.confirmationUids
      : matchConfirmationUids(m);
    if(uids.length!==2)return false;
    return uids.every(uid=>m.confirmations?.[uid]==='confirmed');
  }

  function matchConfirmationRejected(m){
    if(m?.adminConfirmation?.confirmed===true)return false;
    return !!(m?.confirmationRequired && Object.values(m.confirmations||{}).includes('rejected'));
  }

  function applyEffectiveConfirmationStatus(m){
    if(!m)return m;
    if(m.adminConfirmation?.confirmed===true){
      m.status='complete';
      m.confirmationState='admin_confirmed';
      return m;
    }
    if(!m.confirmationRequired)return m;
    if(matchConfirmationRejected(m)){
      m.status='needs_correction';
      m.confirmationState='needs_correction';
    }else if(matchConfirmationComplete(m)){
      m.status='complete';
      m.confirmationState='confirmed';
    }else{
      m.status='pending_confirmation';
      m.confirmationState='pending';
    }
    return m;
  }

  async function secureMatchConfirmationRequest(matchId,uid,value){
    if(!matchId || !uid)throw new Error('CONFIRMATION_INVALID');

    // Před každým potvrzením obnovíme token, aby Firebase neposuzovala starou session.
    let token=await currentIdToken(true);
    if(!token)throw new Error('NO_AUTH');

    // Ověříme skutečné UID účtu, kterým je požadavek autorizovaný.
    const account=await firebaseAccountLookup();
    const actualUid=String(account?.localId||cloudUid||'').trim();
    const expectedUid=String(uid||'').trim();
    if(!actualUid)throw new Error('NO_AUTH_UID');
    if(actualUid!==expectedUid){
      throw new Error('CONFIRMATION_UID_MISMATCH|expected='+expectedUid+'|actual='+actualUid);
    }

    // firebaseAccountLookup mohl obnovit údaje session; vezmeme aktuální token ještě jednou.
    token=cloudIdToken||token;
    const url=`${FIREBASE_DB_URL}/matches/${encodeURIComponent(matchId)}/confirmations/${encodeURIComponent(expectedUid)}.json?auth=${encodeURIComponent(token)}`;
    const r=await fetch(url,{
      method:'PUT',
      headers:{'Content-Type':'application/json'},
      cache:'no-store',
      body:JSON.stringify(value)
    });
    if(!r.ok)throw new Error('MATCH_CONFIRM_'+r.status+': '+await r.text().catch(()=>''));
    return {ok:true,uid:actualUid};
  }

  let pendingOwnResultConfirmationResolve=null;
  let pendingInboxConfirmationMatchId=null;
  const postponedResultConfirmationIds=new Set();

  function showOwnResultConfirmation(m){
    return new Promise(resolve=>{
      pendingOwnResultConfirmationResolve=resolve;
      pendingInboxConfirmationMatchId=null;
      $('resultConfirmationText').textContent=
        m.playerNames[0]+' '+m.scores[0]+' : '+m.scores[1]+' '+m.playerNames[1];
      $('resultConfirmationHelp').textContent=
        'Potvrď, že zadaný výsledek odpovídá skutečně odehranému zápasu. Soupeř s propojeným účtem ho následně musí potvrdit také.';
      $('resultConfirmationReject').textContent='VRÁTIT SE';
      $('resultConfirmationAccept').textContent='POTVRDIT VÝSLEDEK';
      if($('resultConfirmationLater'))$('resultConfirmationLater').classList.add('hidden');
      $('resultConfirmationReject').disabled=false;
      $('resultConfirmationAccept').disabled=false;
      $('resultConfirmationModal').classList.add('show');
    });
  }

  function pendingConfirmationMatchesForCurrentUser(){
    if(!cloudUid)return [];
    return (data.matches||[]).filter(m=>{
      if(!m?.confirmationRequired || m.tournamentLink || m.status==='needs_correction')return false;
      if(postponedResultConfirmationIds.has(m.id))return false;
      const uids=Array.isArray(m.confirmationUids)?m.confirmationUids:[];
      if(!uids.includes(cloudUid))return false;
      if(m.confirmations?.[cloudUid])return false;
      return !matchConfirmationComplete(m);
    });
  }

  function maybeShowPendingResultConfirmation(){
    if(pendingOwnResultConfirmationResolve || $('resultConfirmationModal')?.classList.contains('show'))return;
    const m=pendingConfirmationMatchesForCurrentUser()[0];
    if(!m)return;

    pendingInboxConfirmationMatchId=m.id;
    $('resultConfirmationText').textContent=
      (m.playerNames?.[0]||'Hráč 1')+' '+(m.scores?.[0]||0)+' : '+(m.scores?.[1]||0)+' '+(m.playerNames?.[1]||'Hráč 2');
    $('resultConfirmationHelp').textContent=
      'Druhý hráč zadal tento výsledek. Potvrď ho pouze tehdy, pokud souhlasí.';
    $('resultConfirmationReject').textContent='ODMÍTNOUT';
    $('resultConfirmationAccept').textContent='POTVRDIT';
    if($('resultConfirmationLater'))$('resultConfirmationLater').classList.add('hidden');
    $('resultConfirmationReject').disabled=false;
    $('resultConfirmationAccept').disabled=false;
    $('resultConfirmationModal').classList.add('show');
  }

  async function respondToInboxMatchConfirmation(value){
    const id=pendingInboxConfirmationMatchId;
    const m=(data.matches||[]).find(x=>x.id===id);
    if(!id || !m || !cloudUid)return;

    const acceptBtn=$('resultConfirmationAccept');
    const rejectBtn=$('resultConfirmationReject');
    const laterBtn=$('resultConfirmationLater');
    if(acceptBtn)acceptBtn.disabled=true;
    if(rejectBtn)rejectBtn.disabled=true;
    if(laterBtn)laterBtn.classList.add('hidden');
    $('resultConfirmationHelp').textContent='Ukládám rozhodnutí…';

    try{
      await secureMatchConfirmationRequest(id,cloudUid,value);
      m.confirmations=m.confirmations||{};
      m.confirmations[cloudUid]=value;
      applyEffectiveConfirmationStatus(m);
      $('resultConfirmationModal').classList.remove('show');
      pendingInboxConfirmationMatchId=null;

      await loadSecureMatches();
      try{
        reconcileTournamentResultsFromMatches();
        renderTournament();
      }catch(e){}

      renderHistory();
      renderStats();
      toast(value==='confirmed'
        ? (matchConfirmationComplete(m)?'Výsledek byl potvrzen oběma hráči.':'Tvoje potvrzení bylo uloženo.')
        : 'Výsledek byl odmítnut a vrácen zapisujícímu hráči k opravě.');

      setTimeout(maybeShowPendingResultConfirmation,120);
    }catch(e){
      console.error('Match confirmation:',e);
      if(acceptBtn)acceptBtn.disabled=false;
      if(rejectBtn)rejectBtn.disabled=false;
      if(laterBtn)laterBtn.classList.remove('hidden');

      const msg=String(e?.message||e||'');
      const permission=/MATCH_CONFIRM_(401|403)|PERMISSION_DENIED/i.test(msg);
      const mismatch=/CONFIRMATION_UID_MISMATCH/i.test(msg);
      let detail='';
      if(mismatch){
        const expected=(msg.match(/expected=([^|]+)/)||[])[1]||cloudUid||'—';
        const actual=(msg.match(/actual=([^|]+)/)||[])[1]||'—';
        detail=' Očekávané UID: '+expected+' • Přihlášené UID: '+actual;
      }
      $('resultConfirmationHelp').textContent=mismatch
        ? 'Přihlášený Firebase účet neodpovídá hráči, který má výsledek potvrdit.'+detail+' Můžeš dát POZDĚJI / ZAVŘÍT a znovu se přihlásit správným účtem.'
        : (permission
          ? 'Firebase nepovolila zápis potvrzení. Výsledek se nezměnil. Můžeš to zkusit znovu nebo dát POZDĚJI / ZAVŘÍT. UID účtu je v pořádku, takže je potřeba zkontrolovat databázová oprávnění.'
          : 'Potvrzení se nepodařilo uložit. Výsledek se nezměnil. Můžeš to zkusit znovu nebo dát POZDĚJI / ZAVŘÍT. Chyba: '+msg);
      toast(mismatch?'Přihlášený účet neodpovídá potvrzujícímu hráči.':(permission?'Firebase nepovolila zápis potvrzení.':'Potvrzení výsledku se nepodařilo uložit.'));
    }
  }

  async function secureMatchRequest(matchId,method,body=null){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null) opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('matches/'+matchId),opts);
    if(!r.ok) throw new Error('MATCH_SECURE_'+r.status);
    return await r.json();
  }


  function applyKnownHistoricalMatchMetadataRepairs(matches){
    let changed=false;
    (matches||[]).forEach(m=>{
      if(!m)return;
      if(m.id==='6a0a8d43-e9c9-404d-adbc-9584e086e587' && !matchIsDoubles(m)){
        const a1=findPlayerByName('Jaroslav Tichý');
        const a2=findPlayerByName('René Kulas');
        const b1=findPlayerByName('Roman Kára');
        const b2=findPlayerByName('Michael Vlk');

        m.doublesMode=true;
        m.teamPlayerNames=[['Jaroslav Tichý','René Kulas'],['Roman Kára','Michael Vlk']];
        m.teamPlayerIds=[
          [a1?.id||m.playerIds?.[0]||'',a2?.id||''],
          [b1?.id||m.playerIds?.[1]||'',b2?.id||'']
        ];
        m.playerNames=['Jaroslav Tichý + René Kulas','Roman Kára + Michael Vlk'];
        if(a1?.id && b1?.id)m.playerIds=[a1.id,b1.id];
        m.metadataCompatibilityRepair='MR_DOUBLES_2026_09_19';
        changed=true;
      }
    });
    return changed;
  }

  async function loadSecureMatches(){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const r=await fetch(cloudUrl('matches')+'&t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('MATCHES_READ_'+r.status);
    const raw=await r.json()||{};
    data.matches=Object.values(raw).filter(Boolean);
    const compatibilityRepaired=applyKnownHistoricalMatchMetadataRepairs(data.matches);
    data.matches.forEach(m=>{
      if(m.status==null)m.status='complete';
      applyEffectiveConfirmationStatus(m);
    });
    if(compatibilityRepaired && currentUserIsSystemAdmin()){
      data.matches
        .filter(m=>m?.metadataCompatibilityRepair==='MR_DOUBLES_2026_09_19')
        .forEach(m=>secureMatchRequest(m.id,'PUT',m).catch(e=>console.warn('Historical metadata repair save:',e)));
    }
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    setTimeout(maybeShowPendingResultConfirmation,80);
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
    return data.matches;
  }

  async function saveSecureMatch(savedMatch){
    const copy=JSON.parse(JSON.stringify(savedMatch));
    if(!copy.id) throw new Error('MATCH_INVALID');
    if(!copy.createdByUid) copy.createdByUid=cloudUid;
    copy.updatedAt=new Date().toISOString();
    await secureMatchRequest(copy.id,'PUT',copy);
    const i=(data.matches||[]).findIndex(m=>m.id===copy.id);
    if(i>=0)data.matches[i]=copy; else data.matches.push(copy);
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    try{renderHistory();}catch(e){}
    try{renderResultsTournaments();}catch(e){}
    try{renderResultsSeries();}catch(e){}
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
    try{if(typeof window.completeScheduledChallengeForMatch==='function')window.completeScheduledChallengeForMatch(copy);}catch(e){console.warn('Challenge completion:',e);}
    try{if(typeof window.renderFederalCup2026==='function')window.renderFederalCup2026();}catch(e){}
    return copy;
  }

  async function deleteSecureMatch(matchId){
    // Defense in depth: i přímé zavolání funkce z konzole musí projít admin kontrolou.
    if(!currentUserIsSystemAdmin()) throw new Error('ADMIN_ONLY');
    await secureMatchRequest(matchId,'DELETE');
    data.matches=(data.matches||[]).filter(m=>m.id!==matchId);
    try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
  }

  async function loadSecurePlayers(){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const r=await fetch(cloudUrl('players')+'&t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('PLAYERS_READ_'+r.status);
    const players=await r.json()||{};
    data.players=players;
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
    return players;
  }

  async function saveSecurePlayer(player){
    if(!player||!player.id) throw new Error('PLAYER_INVALID');
    await securePlayerRequest(player.id,'PUT',player);
    data.players[player.id]=player;
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
  }

  async function clearUserPlayerLink(uid,playerId){
    if(!uid || !playerId)return;

    // /users/{uid}/playerId is only an auxiliary account mapping.
    // Removing it lets that account stop pointing at the released profile.
    const token=await currentIdToken();
    if(!token)throw new Error('Chybí přihlášení.');

    const url=`${FIREBASE_DB_URL}/users/${encodeURIComponent(uid)}/playerId.json?auth=${encodeURIComponent(token)}`;
    const res=await fetch(url,{method:'DELETE'});
    if(!res.ok){
      const body=await res.text().catch(()=> '');
      throw new Error(body||('HTTP '+res.status));
    }
  }


  async function deleteSecurePlayer(playerId){
    if(!playerId) return;
    await securePlayerRequest(playerId,'DELETE');
    delete data.players[playerId];
    try{if(typeof window.renderModernHome==='function')window.renderModernHome();}catch(e){}
  }

  async function migratePlayersToSecureBranch(){
    if(currentUserRole!=='system_admin'){
      toast('Migraci může spustit pouze SYSTEM ADMIN.');
      return;
    }

    const btn=$('migratePlayersBtn');
    const status=$('playersMigrationStatus');
    const players=Object.values(data.players||{});

    if(!players.length){
      status.textContent='Nejsou žádní hráči k migraci.';
      return;
    }

    if(!confirm(
      'Zkopírovat '+players.length+' hráčských profilů do nové zabezpečené větve /players?\n\n'+
      'Původní /appData zůstane beze změny.'
    )) return;

    btn.disabled=true;
    let ok=0,failed=0;

    try{
      for(let i=0;i<players.length;i++){
        const p=players[i];
        status.textContent='Migruji hráče '+(i+1)+' / '+players.length+'…';
        try{
          const copy=JSON.parse(JSON.stringify(p));
          copy.id=p.id;
          if(copy.active===undefined) copy.active=true;
          await securePlayerRequest(p.id,'PUT',copy);
          ok++;
        }catch(e){
          console.error('Player migration',p&&p.id,e);
          failed++;
        }
      }

      status.textContent='Hotovo: '+ok+' profilů migrováno'+(failed?' • '+failed+' chyb':'')+'.';
      toast(failed?'Migrace dokončena s chybami.':'Hráči byli úspěšně migrováni.');
    }finally{
      btn.disabled=false;
    }
  }

  async function profileClaimRequest(uid,method,body=null){
    if(!await ensureCloudToken()) throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null) opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('profileClaims/'+uid),opts);
    if(!r.ok) throw new Error('PROFILE_CLAIM_'+r.status);
    return await r.json();
  }

  async function createProfileClaim(playerId){
    const p=data.players[playerId];
    if(!p) throw new Error('PLAYER_NOT_FOUND');
    const claim={
      uid:cloudUid,
      email:cloudUserEmail||'',
      playerId:p.id,
      playerName:p.name,
      status:'pending',
      requestedAt:new Date().toISOString()
    };
    await profileClaimRequest(cloudUid,'PUT',claim);
    currentUserProfileClaimId=p.id;
    refreshAccountUI();
  }

  async function loadOwnProfileClaim(){
    if(!cloudAuthenticated||!cloudUid)return null;
    try{
      const c=await profileClaimRequest(cloudUid,'GET');
      currentUserProfileClaimId=(c&&c.status==='pending')?c.playerId:null;
      refreshAccountUI();
      return c;
    }catch(e){
      console.warn('profile claim',e);
      return null;
    }
  }

  async function loadAllProfileClaims(){
    if(currentUserRole!=='system_admin')return {};
    if(!await ensureCloudToken())throw new Error('NO_AUTH');
    const r=await fetch(cloudUrl('profileClaims'),{cache:'no-store'});
    if(!r.ok)throw new Error('CLAIMS_'+r.status);
    return await r.json()||{};
  }

  async function renderProfileClaimsAdmin(){
    const wrap=$('profileClaimsAdminList');
    if(!wrap)return;
    if(currentUserRole!=='system_admin'){
      wrap.innerHTML='<div class="muted">Nemáš oprávnění.</div>';
      return;
    }
    wrap.innerHTML='<div class="muted">Načítám žádosti…</div>';
    try{
      const claims=await loadAllProfileClaims();
      const rows=Object.values(claims).filter(c=>c&&c.status==='pending')
        .sort((a,b)=>new Date(a.requestedAt||0)-new Date(b.requestedAt||0));
      if(!rows.length){
        wrap.innerHTML='<div class="muted">Žádné čekající žádosti.</div>';
        return;
      }
      wrap.innerHTML=rows.map(c=>{
        const p=data.players[c.playerId];
        const pn=p?p.name:(c.playerName||'Neznámý profil');
        return `<div class="subpanel" style="margin-bottom:10px">
          <div><strong>${esc(c.email||c.uid)}</strong></div>
          <div style="margin-top:5px">žádá o profil: <strong>${esc(pn)}</strong></div>
          <div class="muted" style="margin-top:4px">${c.requestedAt?new Date(c.requestedAt).toLocaleString('cs-CZ'):''}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <button class="btn primary" onclick="approveProfileClaim('${c.uid}')">SCHVÁLIT</button>
            <button class="btn danger" onclick="rejectProfileClaim('${c.uid}')">ZAMÍTNOUT</button>
          </div>
        </div>`;
      }).join('');
    }catch(e){
      wrap.innerHTML='<div class="muted">Načtení selhalo: '+esc(String(e.message||e))+'</div>';
    }
  }

  window.approveProfileClaim=async function(uid){
    if(currentUserRole!=='system_admin')return toast('Nemáš oprávnění.');
    try{
      const c=await profileClaimRequest(uid,'GET');
      if(!c||c.status!=='pending')return toast('Žádost už není aktivní.');
      const p=data.players[c.playerId];
      if(!p)return toast('Profil hráče nebyl nalezen.');
      if(p.ownerUid&&p.ownerUid!==uid)return toast('Profil už má jiného vlastníka.');
      if(!confirm('Přiřadit profil „'+p.name+'“ účtu '+(c.email||uid)+'?'))return;

      p.ownerUid=uid;
      p.placeholderProfile=false;
      p.profileSource=p.profileSource||'claimed_existing';
      p.claimedAt=new Date().toISOString();
      await saveSecurePlayer(p);

      if(!await ensureCloudToken())throw new Error('NO_AUTH');
      const url=cloudUrl('users/'+uid);
      const gr=await fetch(url,{cache:'no-store'});
      if(!gr.ok)throw new Error('USER_GET_'+gr.status);
      const u=await gr.json()||{};
      u.uid=uid;
      u.email=c.email||u.email||'';
      u.role=u.role||'player';
      u.playerId=p.id;
      u.clubId=p.clubId||u.clubId||'';
      const wr=await fetch(url,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(u)});
      if(!wr.ok)throw new Error('USER_WRITE_'+wr.status);

      c.status='approved';
      c.decidedAt=new Date().toISOString();
      c.decidedBy=cloudUid;
      await profileClaimRequest(uid,'PUT',c);

      saveData();
      await renderProfileClaimsAdmin();
      renderPlayers();
      toast('Profil byl přiřazen.');
    }catch(e){
      console.error(e);
      toast('Schválení selhalo: '+String(e.message||e));
    }
  };

  window.rejectProfileClaim=async function(uid){
    if(currentUserRole!=='system_admin')return toast('Nemáš oprávnění.');
    try{
      const c=await profileClaimRequest(uid,'GET');
      if(!c)return;
      if(!confirm('Zamítnout žádost účtu '+(c.email||uid)+'?'))return;
      c.status='rejected';
      c.decidedAt=new Date().toISOString();
      c.decidedBy=cloudUid;
      await profileClaimRequest(uid,'PUT',c);
      await renderProfileClaimsAdmin();
      toast('Žádost zamítnuta.');
    }catch(e){
      toast('Zamítnutí selhalo: '+String(e.message||e));
    }
  };

  async function loadAllRegisteredUsers(force=false){
    if(!currentUserIsSystemAdmin())return {};
    if(adminRegisteredUsersGlobalReadDenied && !force)return adminRegisteredUsersCache||{};
    if(adminRegisteredUsersLoading && !force)return adminRegisteredUsersCache||{};
    if(!await ensureCloudToken())throw new Error('NO_AUTH');

    adminRegisteredUsersLoading=true;
    try{
      const r=await fetch(cloudUrl('users')+'&t='+Date.now(),{cache:'no-store'});

      if(r.status===401 || r.status===403){
        adminRegisteredUsersGlobalReadDenied=true;
        const fallback={};

        Object.values(data.players||{}).forEach(p=>{
          if(!p?.ownerUid)return;
          fallback[p.ownerUid]={
            uid:p.ownerUid,
            email:'',
            role:'player',
            playerId:p.id,
            clubId:p.clubId||'',
            inferredFromPlayer:true
          };
        });

        Object.values(leagueConfigTeams||{}).forEach(t=>{
          if(!t?.captainUid)return;
          if(!fallback[t.captainUid]){
            fallback[t.captainUid]={
              uid:t.captainUid,
              email:'',
              role:'player',
              playerId:t.captainPlayerId||'',
              inferredFromLeague:true
            };
          }
        });

        adminRegisteredUsersCache=fallback;
        return adminRegisteredUsersCache;
      }

      if(!r.ok)throw new Error('USERS_'+r.status);

      const users=await r.json()||{};
      adminRegisteredUsersGlobalReadDenied=false;
      adminRegisteredUsersCache=users && typeof users==='object' ? users : {};
      return adminRegisteredUsersCache;
    }finally{
      adminRegisteredUsersLoading=false;
    }
  }
  function registeredUserLinkedPlayer(uid,rec=null){
    const r=rec||adminRegisteredUsersCache?.[uid]||{};
    if(r.playerId&&data.players?.[r.playerId])return data.players[r.playerId];
    return Object.values(data.players||{}).find(p=>p?.ownerUid===uid)||null;
  }
  function registeredUserLabel(uid,rec=null){
    const r=rec||adminRegisteredUsersCache?.[uid]||{};
    const p=registeredUserLinkedPlayer(uid,r);
    return p?playerSelectionLabel(p):(r.email||uid);
  }
  async function renderRegisteredUsersAdmin(force=false){
    const wrap=$('registeredUsersAdminList');
    if(!wrap)return;
    if(!currentUserIsSystemAdmin()){
      wrap.innerHTML='<div class="muted">Nemáš oprávnění.</div>';
      return;
    }

    wrap.innerHTML='<div class="muted">Načítám registrované účty…</div>';
    try{
      const users=await loadAllRegisteredUsers(force);
      const rows=Object.entries(users||{})
        .filter(([,u])=>u&&typeof u==='object')
        .sort((a,b)=>registeredUserLabel(a[0],a[1]).localeCompare(registeredUserLabel(b[0],b[1]),'cs'));

      const fallbackNotice=adminRegisteredUsersGlobalReadDenied
        ? `<div class="subpanel" style="margin-bottom:10px;border-color:rgba(212,175,55,.4)">
            <strong>OMEZENÉ ZOBRAZENÍ ÚČTŮ</strong>
            <div class="muted" style="margin-top:5px;line-height:1.45">
              Firebase nepovoluje globální čtení <strong>/users</strong>. Zobrazuji proto účty dohledatelné
              z propojených hráčských profilů a z nastavení kapitánů. Ostatní administrace zůstává funkční.
            </div>
          </div>`
        : '';

      if(!rows.length){
        wrap.innerHTML=fallbackNotice+'<div class="muted">Žádný dostupný účet se nepodařilo dohledat.</div>';
        return;
      }

      wrap.innerHTML=fallbackNotice+rows.map(([uid,u])=>{
        const p=registeredUserLinkedPlayer(uid,u);
        const role=u.role==='system_admin'?'SYSTEM ADMIN':(u.role==='club_admin'?'CLUB ADMIN':'HRÁČ');
        const teams=LEAGUE_SEVER_TEAMS
          .filter(t=>leagueConfigTeams?.[t.id]?.captainUid===uid)
          .map(t=>t.name);

        return `<div class="history-item" style="margin-bottom:8px">
          <div class="history-line">
            <div style="min-width:0">
              <strong>${esc(p?playerSelectionLabel(p):(u.email||'Registrovaný účet'))}</strong>
              ${u.email?`<div class="muted" style="margin-top:3px">${esc(u.email)}</div>`:''}
              <div class="muted" style="font-size:11px;margin-top:3px">UID: ${esc(uid)}</div>
            </div>
            <div style="text-align:right"><span class="badge gold">${esc(role)}</span></div>
          </div>
          <div class="muted" style="margin-top:7px">
            Hráčský profil: ${p?'<strong>'+esc(playerSelectionLabel(p))+'</strong>':'<strong style="color:#f1d67a">NEPŘIŘAZEN</strong>'}
            ${teams.length?' • Kapitán: <strong>'+esc(teams.join(', '))+'</strong>':''}
          </div>
          ${(!p && !adminRegisteredUsersGlobalReadDenied)
            ? `<div class="item-actions" style="margin-top:8px">
                <button class="btn primary" onclick="openAdminCreatePlayerForUser('${esc(uid)}')">VYTVOŘIT HRÁČSKÝ PROFIL</button>
              </div>`
            : ''}
        </div>`;
      }).join('');

      try{renderLeagueCaptainAdmin();}catch(e){}
    }catch(e){
      wrap.innerHTML='<div class="muted">Seznam účtů se nepodařilo načíst. Ostatní administrace zůstává funkční.</div>';
    }
  }


  async function adminUserRecordRequest(targetUid,method,body=null){
    if(!currentUserIsSystemAdmin())throw new Error('NO_ADMIN');
    if(!targetUid || !await ensureCloudToken())throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null)opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('users/'+targetUid),opts);
    if(!r.ok)throw new Error('ADMIN_USER_RECORD_'+r.status);
    try{return await r.json();}catch(e){return null;}
  }

  window.openAdminCreatePlayerForUser=function(targetUid){
    if(!currentUserIsSystemAdmin())return toast('Nemáš oprávnění.');
    const rec=adminRegisteredUsersCache?.[targetUid];
    if(!rec)return toast('Registrovaný účet nebyl nalezen.');

    const existing=registeredUserLinkedPlayer(targetUid,rec);
    if(existing){
      toast('Tento účet už má přiřazený profil.');
      return;
    }

    adminCreatePlayerTargetUid=targetUid;
    $('adminCreatePlayerFirstName').value='';
    $('adminCreatePlayerLastName').value='';
    $('adminCreatePlayerClub').value='';
    $('adminCreatePlayerForUserMessage').textContent='';
    $('adminCreatePlayerForUserInfo').textContent=
      'Účet: '+(rec.email||targetUid);
    $('adminCreatePlayerForUserModal').classList.add('show');
    setTimeout(()=>$('adminCreatePlayerFirstName')?.focus(),50);
  };

  function closeAdminCreatePlayerForUser(){
    adminCreatePlayerTargetUid=null;
    $('adminCreatePlayerForUserModal')?.classList.remove('show');
  }

  if($('adminCreatePlayerForUserCancel')){
    $('adminCreatePlayerForUserCancel').onclick=closeAdminCreatePlayerForUser;
  }

  if($('adminCreatePlayerForUserConfirm')){
    $('adminCreatePlayerForUserConfirm').onclick=async()=>{
      if(!currentUserIsSystemAdmin() || !adminCreatePlayerTargetUid)return;

      const targetUid=adminCreatePlayerTargetUid;
      const rec=adminRegisteredUsersCache?.[targetUid]||{};
      const first=String($('adminCreatePlayerFirstName')?.value||'').trim();
      const last=String($('adminCreatePlayerLastName')?.value||'').trim();
      const club=String($('adminCreatePlayerClub')?.value||'').trim();
      const fullName=[first,last].filter(Boolean).join(' ').trim();
      const msg=$('adminCreatePlayerForUserMessage');
      const btn=$('adminCreatePlayerForUserConfirm');

      if(!first || !last){
        if(msg)msg.textContent='Vyplň jméno i příjmení.';
        return;
      }

      const existingByOwner=Object.values(data.players||{}).find(p=>p?.ownerUid===targetUid);
      if(existingByOwner){
        if(msg)msg.textContent='Tento účet už má profil: '+(existingByOwner.name||existingByOwner.id);
        return;
      }

      const exactName=Object.values(data.players||{}).find(p=>
        p && String(p.name||'').trim().toLowerCase()===fullName.toLowerCase() &&
        String(p.club||'').trim().toLowerCase()===club.toLowerCase()
      );
      if(exactName){
        const ok=confirm(
          'Už existuje profil „'+fullName+'“'+(club?' • '+club:'')+'.\n\n'+
          'Chceš přesto vytvořit NOVÝ profil pro tento registrovaný účet?'
        );
        if(!ok)return;
      }

      btn.disabled=true;
      if(msg)msg.textContent='Vytvářím profil…';

      try{
        const p={
          id:uid(),
          name:fullName,
          firstName:first,
          lastName:last,
          nickname:'',
          identifier:'',
          useNicknameInMatch:false,
          club:club,
          clubId:rec.clubId||'',
          ownerUid:targetUid,
          note:'',
          equipment:'',
          achievements:'',
          photo:'',
          active:true,
          createdAt:new Date().toISOString(),
          createdByAdminUid:cloudUid||''
        };

        await securePlayerRequest(p.id,'PUT',p);

        const freshUser=await adminUserRecordRequest(targetUid,'GET')||{};
        const updatedUser={
          ...freshUser,
          uid:targetUid,
          email:freshUser.email||rec.email||'',
          role:freshUser.role||'player',
          playerId:p.id,
          clubId:p.clubId||freshUser.clubId||'',
          updatedAt:new Date().toISOString()
        };
        await adminUserRecordRequest(targetUid,'PUT',updatedUser);

        data.players[p.id]=p;
        adminRegisteredUsersCache[targetUid]=updatedUser;
        try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}

        closeAdminCreatePlayerForUser();
        renderPlayers();
        refreshPlayerList();
        try{renderTournamentPlayerPicker();}catch(e){}
        try{renderLeagueCaptainAdmin();}catch(e){}
        await renderRegisteredUsersAdmin(false);

        toast('Hráčský profil byl vytvořen a propojen s účtem.');
      }catch(e){
        console.error(e);
        if(msg){
          msg.textContent='Vytvoření profilu selhalo: '+String(e.message||e)+
            '. Pokud chyba obsahuje 401/403, zkontroluj Firebase Rules pro /players a /users.';
        }
      }finally{
        btn.disabled=false;
      }
    };
  }

  async function userRecordRequest(method,body=null){
    if(!cloudUid || !await ensureCloudToken()) throw new Error('NO_AUTH');
    const opts={method,headers:{'Content-Type':'application/json'},cache:'no-store'};
    if(body!==null) opts.body=JSON.stringify(body);
    const r=await fetch(cloudUrl('users/'+cloudUid),opts);
    if(!r.ok) throw new Error('USER_RECORD_'+r.status);
    return await r.json();
  }

  async function ensureUserAccessRecord(createIfMissing=false){
    if(!cloudUid) return null;
    try{
      let rec=await userRecordRequest('GET');
      if(!rec && createIfMissing){
        rec={
          uid:cloudUid,
          email:cloudUserEmail||'',
          role:(String(cloudUserEmail||'').toLowerCase()===MAIN_ADMIN_EMAIL?'system_admin':'player'),
          playerId:null,
          clubId:null,
          createdAt:new Date().toISOString()
        };
        await userRecordRequest('PUT',rec);
      }

      // Hlavní účet BC Rybárna je bootstrap SYSTEM ADMIN.
      if(rec && String(cloudUserEmail||rec.email||'').toLowerCase()===MAIN_ADMIN_EMAIL && rec.role!=='system_admin'){
        rec.role='system_admin';
        await userRecordRequest('PUT',rec);
      }

      if(rec){
        currentUserRole=rec.role||'player';
        currentUserPlayerId=rec.playerId||null;
        currentUserClubId=rec.clubId||null;
        if(!cloudUserEmail) cloudUserEmail=rec.email||'';
        // Jakmile se potvrdí role SYSTEM ADMIN, token se smí držet jen v sessionStorage.
        enforceAdminSessionPersistence();
      }
      refreshAccountUI();
      return rec;
    }catch(e){
      console.warn('User access record:',e);
      refreshAccountUI();
      return null;
    }
  }

  async function updateUserAccessRecord(patch){
    let rec=await ensureUserAccessRecord(true) || {};

    // Běžný klient nesmí měnit vlastní roli. Role se spravují odděleně administrátorem.
    const safePatch={...patch};
    delete safePatch.role;

    rec={...rec,...safePatch,uid:cloudUid,email:cloudUserEmail||rec.email||''};

    if(String(cloudUserEmail||rec.email||'').toLowerCase()===MAIN_ADMIN_EMAIL){
      rec.role='system_admin';
    }

    await userRecordRequest('PUT',rec);
    currentUserRole=rec.role||'player';
    currentUserPlayerId=rec.playerId||null;
    currentUserClubId=rec.clubId||null;
    refreshAccountUI();
    return true;
  }

  function canEditPlayer(p){
    if(!p || !cloudAuthenticated || !cloudUid) return false;
    if(currentUserRole==='system_admin') return true;
    if(p.ownerUid && p.ownerUid===cloudUid) return true;
    if(currentUserRole==='club_admin' && currentUserClubId && p.clubId===currentUserClubId) return true;
    return false;
  }

  function refreshAccountUI(){
    const el=$('accountPlayerStatus');
    const btn=$('myPlayerProfileBtn');
    const adminBtn=$('adminNavBtn');
    if(adminBtn)adminBtn.classList.toggle('hidden',currentUserRole!=='system_admin');
    if(!el||!btn)return;

    if(!cloudAuthenticated || !cloudUid){
      el.textContent='Pro vlastnictví profilu se přihlas do cloudu.';
      btn.textContent='PŘIHLÁSIT SE';
      updateLoggedInUserBadge();
      return;
    }

    const roleLabel=currentUserRole==='system_admin'
      ? 'SYSTEM ADMIN'
      : (currentUserRole==='club_admin'?'CLUB ADMIN':'HRÁČ');

    if(currentUserPlayerId && data.players[currentUserPlayerId]){
      el.textContent=(cloudUserEmail||'Přihlášen')+' • '+roleLabel+' • OVĚŘENÝ E-MAIL • profil: '+data.players[currentUserPlayerId].name;
      btn.textContent='MŮJ PROFIL';
    }else if(currentUserProfileClaimId && data.players[currentUserProfileClaimId]){
      el.textContent=(cloudUserEmail||'Přihlášen')+' • '+roleLabel+' • OVĚŘENÝ E-MAIL • čeká na schválení profilu: '+data.players[currentUserProfileClaimId].name;
      btn.textContent='ČEKÁ NA SCHVÁLENÍ';
    }else{
      el.textContent=(cloudUserEmail||'Přihlášen')+' • '+roleLabel+' • OVĚŘENÝ E-MAIL • profil zatím není vytvořen';
      btn.textContent='VYTVOŘIT MŮJ PROFIL';
    }
    updateLoggedInUserBadge();
    // Po načtení/propojení účtu přesuň přihlášeného hráče na první místo výběrů.
    try{ refreshPlayerList(); }catch(e){}
    try{ renderTournamentPlayerPicker(); }catch(e){}
  }

  function clearRuntimeCloudIdentity(){
    cloudAuthenticated=false;
    cloudIdToken='';
    cloudTokenExpiresAt=0;
    cloudUid='';
    cloudUserEmail='';
    currentUserRole='player';
    currentUserPlayerId=null;
    currentUserClubId=null;
    currentUserProfileClaimId=null;
    cloudEmailVerified=false;
    try{refreshAccountUI();}catch(e){}
    try{updateLoggedInUserBadge();}catch(e){}
  }

  async function ensureCloudToken(){
    if(cloudAuthenticated && cloudIdToken && Date.now()<cloudTokenExpiresAt) return true;

    let refresh=cloudRefreshToken;
    if(!refresh){
      const saved=persistedCloudSession();
      refresh=saved.refresh||'';
      if(!cloudUserEmail)cloudUserEmail=saved.email||'';
    }
    if(!refresh) return false;

    try{
      await firebaseRefreshAuth(refresh);
      return true;
    }catch(e){
      cloudRefreshToken='';
      try{
        localStorage.removeItem(CLOUD_REFRESH_KEY);
        localStorage.removeItem(CLOUD_EMAIL_KEY);
        sessionStorage.removeItem(CLOUD_ADMIN_SESSION_REFRESH_KEY);
        sessionStorage.removeItem(CLOUD_ADMIN_SESSION_EMAIL_KEY);
      }catch(err){}
      clearRuntimeCloudIdentity();
      setCloudStatus('OFFLINE',false);
      return false;
    }
  }


