  function activePlayerOptionsHtml(selectedId=''){
    return Object.values(data.players||{})
      .filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)
      .sort((a,b)=>playerSelectionLabel(a).localeCompare(playerSelectionLabel(b),'cs'))
      .map(p=>`<option value="${esc(p.id)}" ${p.id===selectedId?'selected':''}>${esc(playerSelectionLabel(p))}</option>`)
      .join('');
  }

  function playerIdByStoredName(name){
    return findPlayerByLooseName(name)?.id||'';
  }

  function matchPrimaryPlayerId(m,side){
    if(Array.isArray(m?.teamPlayerIds?.[side]) && m.teamPlayerIds[side][0])return m.teamPlayerIds[side][0];
    if(Array.isArray(m?.playerIds) && m.playerIds[side])return m.playerIds[side];
    const names=savedDoublesSideNames(m,side);
    return playerIdByStoredName(names[0]||m?.playerNames?.[side]||'');
  }

  function matchPartnerPlayerId(m,side){
    if(Array.isArray(m?.teamPlayerIds?.[side]) && m.teamPlayerIds[side][1])return m.teamPlayerIds[side][1];
    const names=savedDoublesSideNames(m,side);
    return playerIdByStoredName(names[1]||'');
  }

  function refreshMatchMetadataVisibility(){
    $('matchMetadataDoublesFields')?.classList.toggle('hidden',!$('matchMetadataDoubles')?.checked);
    $('matchMetadataHandicapFields')?.classList.toggle('hidden',!$('matchMetadataHandicap')?.checked);
  }

  window.openMatchMetadataAdmin=function(id){
    if(!currentUserIsSystemAdmin())return toast('Nemáš oprávnění.');
    const m=(data.matches||[]).find(x=>x.id===id);
    if(!m)return toast('Zápas nebyl nalezen.');

    metadataAdminMatchId=id;
    $('matchMetadataAdminInfo').textContent=
      (m.playerNames?.[0]||'Strana A')+' vs '+(m.playerNames?.[1]||'Strana B')+
      ' • '+String(m.discipline||'').toUpperCase()+' • '+id;

    const selections=[
      ['matchMetadataA1',matchPrimaryPlayerId(m,0)],
      ['matchMetadataA2',matchPartnerPlayerId(m,0)],
      ['matchMetadataB1',matchPrimaryPlayerId(m,1)],
      ['matchMetadataB2',matchPartnerPlayerId(m,1)]
    ];
    selections.forEach(([eid,selected])=>{
      const el=$(eid);
      if(!el)return;
      el.innerHTML='<option value="">— vyber hráče —</option>'+activePlayerOptionsHtml(selected);
      if(selected)el.value=selected;
    });

    $('matchMetadataDoubles').checked=matchIsDoubles(m);
    $('matchMetadataHandicap').checked=matchHasHandicap(m);
    const hs=matchHandicapScores(m);
    $('matchMetadataH1').value=hs[0];
    $('matchMetadataH2').value=hs[1];
    $('matchMetadataAdminMessage').textContent='';
    refreshMatchMetadataVisibility();
    $('matchMetadataAdminModal').classList.add('show');
  };

  $('matchMetadataDoubles')?.addEventListener('change',refreshMatchMetadataVisibility);
  $('matchMetadataHandicap')?.addEventListener('change',refreshMatchMetadataVisibility);

  $('matchMetadataAdminCancel').onclick=()=>{
    metadataAdminMatchId=null;
    $('matchMetadataAdminModal').classList.remove('show');
  };

  $('matchMetadataAdminSave').onclick=async()=>{
    if(!currentUserIsSystemAdmin() || !metadataAdminMatchId)return;
    const m=(data.matches||[]).find(x=>x.id===metadataAdminMatchId);
    if(!m)return;

    const doubles=!!$('matchMetadataDoubles').checked;
    const handicap=!!$('matchMetadataHandicap').checked;
    const h1=Math.max(0,parseInt($('matchMetadataH1').value||'0',10)||0);
    const h2=Math.max(0,parseInt($('matchMetadataH2').value||'0',10)||0);
    const msg=$('matchMetadataAdminMessage');
    const btn=$('matchMetadataAdminSave');

    if(doubles){
      const ids=[
        $('matchMetadataA1').value,$('matchMetadataA2').value,
        $('matchMetadataB1').value,$('matchMetadataB2').value
      ];
      if(ids.some(x=>!x)){msg.textContent='U dvojic vyber všechny čtyři hráče.';return;}
      if(new Set(ids).size!==4){msg.textContent='Každý hráč může být v zápase dvojic pouze jednou.';return;}

      const [a1,a2,b1,b2]=ids.map(id=>data.players?.[id]);
      if([a1,a2,b1,b2].some(x=>!x)){msg.textContent='Některý vybraný hráč nebyl nalezen.';return;}

      m.doublesMode=true;
      m.teamPlayerIds=[[a1.id,a2.id],[b1.id,b2.id]];
      m.teamPlayerNames=[[playerDisplayName(a1),playerDisplayName(a2)],[playerDisplayName(b1),playerDisplayName(b2)]];
      m.playerIds=[a1.id,b1.id];
      m.playerNames=[playerDisplayName(a1)+' + '+playerDisplayName(a2),playerDisplayName(b1)+' + '+playerDisplayName(b2)];
    }else{
      m.doublesMode=false;
      delete m.teamPlayerIds;
      delete m.teamPlayerNames;
      m.playerNames=(m.playerNames||[]).map(n=>String(n||'').split(' + ')[0].trim());
    }

    m.handicapEnabled=handicap;
    m.handicapScores=handicap?[h1,h2]:[0,0];
    m.metadataEditedAt=new Date().toISOString();
    m.metadataEditedByUid=cloudUid||'';

    btn.disabled=true;
    msg.textContent='Ukládám…';
    try{
      await saveSecureMatch(m);
      metadataAdminMatchId=null;
      $('matchMetadataAdminModal').classList.remove('show');
      await loadSecureMatches();
      renderHistory();
      renderStats();
      toast('Informace zápasu byly opraveny.');
    }catch(e){
      console.error('Match metadata repair:',e);
      msg.textContent='Uložení selhalo: '+String(e.message||e);
    }finally{
      btn.disabled=false;
    }
  };

  window.openMatchCorrection=function(id){
    const m=(data.matches||[]).find(x=>x.id===id);
    if(!m || m.tournamentLink || m.status!=='needs_correction' || m.createdByUid!==cloudUid)return;

    correctionMatchId=id;
    $('matchCorrectionPlayers').textContent=(m.playerNames?.[0]||'Hráč 1')+' vs '+(m.playerNames?.[1]||'Hráč 2');
    $('matchCorrectionP1Label').textContent=m.playerNames?.[0]||'Hráč 1';
    $('matchCorrectionP2Label').textContent=m.playerNames?.[1]||'Hráč 2';
    $('matchCorrectionScore1').value=Number(m.scores?.[0]||0);
    $('matchCorrectionScore2').value=Number(m.scores?.[1]||0);
    $('matchCorrectionModal').classList.add('show');
  };

  $('matchCorrectionCancel').onclick=()=>{
    correctionMatchId=null;
    $('matchCorrectionModal').classList.remove('show');
  };

  $('matchCorrectionSave').onclick=async()=>{
    const m=(data.matches||[]).find(x=>x.id===correctionMatchId);
    if(!m || m.createdByUid!==cloudUid)return;

    const s1=Math.max(0,parseInt($('matchCorrectionScore1').value||'0',10));
    const s2=Math.max(0,parseInt($('matchCorrectionScore2').value||'0',10));

    if(s1===s2){
      toast('Výsledek zápasu nemůže skončit remízou.');
      return;
    }

    const winner=s1>s2?0:1;
    m.scores=[s1,s2];
    m.winner=winner;
    m.status='pending_confirmation';
    m.confirmationState='pending';
    m.confirmations={};

    // Zapisující hráč musí opravený výsledek potvrdit znovu.
    if(Array.isArray(m.confirmationUids) && m.confirmationUids.includes(cloudUid)){
      m.confirmations[cloudUid]='confirmed';
    }

    m.correctedAt=new Date().toISOString();
    m.updatedAt=new Date().toISOString();

    try{
      await saveSecureMatch(m);
      correctionMatchId=null;
      $('matchCorrectionModal').classList.remove('show');
      await loadSecureMatches();
      renderHistory();
      renderStats();
      toast('Opravený výsledek byl znovu odeslán soupeři k potvrzení.');
    }catch(e){
      console.error('Match correction save:',e);
      toast('Opravený výsledek se nepodařilo uložit.');
    }
  };

  window.adminConfirmMatchResult=async function(id){
    if(!currentUserIsSystemAdmin()){
      toast('Tuto akci může provést pouze administrátor.');
      return;
    }

    let m=(data.matches||[]).find(x=>x.id===id);
    if(!m)return;
    if(m.tournamentLink){
      toast('Turnajové zápasy potvrzení hráčů nevyžadují.');
      return;
    }

    if(!confirm(
      'Potvrdit jako administrátor výsledek '+m.playerNames[0]+' '+m.scores[0]+' : '+m.scores[1]+' '+m.playerNames[1]+'?\n\n'+
      'Výsledek bude okamžitě platný a započítá se do statistik.'
    ))return;

    const wasAlreadyComplete=(m.status==='complete' && m.adminConfirmation?.confirmed===true);

    m.adminConfirmation={
      confirmed:true,
      uid:cloudUid||'',
      email:cloudUserEmail||'',
      confirmedAt:new Date().toISOString()
    };
    m.confirmationState='admin_confirmed';
    m.status='complete';

    try{
      m=await saveSecureMatch(m);

      // Nepotvrzený turnajový zápas zatím pavouk neposunul.
      // Po admin potvrzení ho proto zpracujeme stejně jako běžně potvrzený výsledek.
      if(!wasAlreadyComplete && m.tournamentLink && m.winner!==null){
        const tournamentId=m.tournamentLink.tournamentId;
        let t=(data.tournaments||[]).find(x=>x.id===tournamentId);

        const tm=t ? findTournamentMatch(t,m.tournamentLink.tournamentMatchId) : null;
        const alreadyApplied=!!(tm && (tm.status==='done'||tm.winnerId||tm.loserId));

        if(!alreadyApplied){
          const linkedTournament=processTournamentResult(m);
          if(linkedTournament){
            await saveSecureTournament(linkedTournament);
          }
        }
      }

      await loadSecureMatches();
      renderHistory();
      renderStats();
      renderPlayers();
      renderTournament();
      renderResultsTournaments();
      renderResultsSeries();

      toast('Výsledek byl potvrzen administrátorem.');
    }catch(e){
      console.error('Admin match confirmation:',e);
      toast('Admin potvrzení se nepodařilo uložit: '+String(e.message||e));
    }
  };

  window.deleteMatch=async function(id){
    if(!currentUserIsSystemAdmin()){
      toast('Mazání zápasů je dostupné pouze SYSTEM ADMINOVI.');
      return;
    }
    const m=data.matches.find(x=>x.id===id);
    if(!m) return;
    const tournamentNote=m.tournamentLink
      ? '\n\nPozor: tento zápas patří do turnaje. Smazání z Historie odstraní statistiky a ELO, ale samotný turnajový pavouk zůstane beze změny.'
      : '';
    if(!confirm(`Opravdu smazat zápas ${m.playerNames[0]} ${m.scores[0]} : ${m.scores[1]} ${m.playerNames[1]}? Tím se odstraní i všechny statistiky z tohoto zápasu.${tournamentNote}`)) return;
    try{
      await deleteSecureMatch(id);
    }catch(e){
      toast('Zápas se nepodařilo smazat: '+String(e.message||e));
      return;
    }
    renderHistory(); renderStats(); renderPlayers();
    toast('Zápas byl trvale smazán ze statistik a ELO.');
  };

  // ===== ELO RATING =====
  const ELO_START=1500;
  const ELO_K=32;

  function calculateEloRatings(discipline=null){
    const ratings={};
    Object.keys(data.players||{}).forEach(id=>ratings[id]=ELO_START);

    const eligible=completedRealMatchFacts()
      .filter(f=>{
        if(!f || !f.winnerId) return false;
        if(!Array.isArray(f.playerIds) || f.playerIds.length<2) return false;
        if(!data.players[f.playerIds[0]] || !data.players[f.playerIds[1]]) return false;
        if(discipline && f.discipline!==discipline) return false;
        return true;
      })
      .sort((a,b)=>new Date(a.endedAt||0)-new Date(b.endedAt||0));

    eligible.forEach(f=>{
      const a=f.playerIds[0],b=f.playerIds[1];
      const ra=ratings[a]??ELO_START, rb=ratings[b]??ELO_START;
      const ea=1/(1+Math.pow(10,(rb-ra)/400));
      const eb=1-ea;
      const sa=f.winnerId===a?1:0;
      const sb=f.winnerId===b?1:0;

      ratings[a]=ra+ELO_K*(sa-ea);
      ratings[b]=rb+ELO_K*(sb-eb);
    });

    Object.keys(ratings).forEach(id=>ratings[id]=Math.round(ratings[id]));
    return ratings;
  }

  function playerElo(pid,discipline=null){
    return calculateEloRatings(discipline)[pid] ?? ELO_START;
  }

  function matchEvidenceMode(matchLike){
    if(!matchLike) return 'basic';
    if(matchLike.evidenceMode==='full' || matchLike.evidenceMode==='basic') return matchLike.evidenceMode;
    if(matchLike.counterMode==='simple') return 'basic';
    if(matchLike.counterMode==='full') return 'full';
    // Ručně zapsané turnajové výsledky neobsahují akční statistiky.
    if(matchLike.source==='tournament' || matchLike.savedMatchId===null) return 'basic';
    // Starší uložené zápasy vznikly před explicitním označením režimu; bereme je jako rozšířené.
    return 'full';
  }

  function evidenceModeLabel(mode){
    return mode==='full' ? 'ROZŠÍŘENÉ' : 'ZÁKLADNÍ';
  }

  function evidenceModeBadge(mode){
    const full=mode==='full';
    return `<span class="elo-badge" style="margin-left:6px;${full?'':'opacity:.72'}">${full?'ROZŠÍŘENÉ STATISTIKY':'ZÁKLADNÍ SKÓRE'}</span>`;
  }

  function completedRealMatchFacts(){
    const byKey=new Map();

    // Nejdřív vezmeme uložené /matches. U turnajových zápasů deduplikujeme
    // podle tournamentId + tournamentMatchId, ne podle id archivního záznamu.
    (data.matches||[]).forEach(m=>{
      if(!m || (m.status||'complete')!=='complete')return;
      if(m.solo14 || m.ghostMode || m.winnerTableMode || m.doublesMode)return;
      if(!Array.isArray(m.playerIds) || m.playerIds.length<2)return;

      const tournamentId=m.tournamentLink?.tournamentId||'';
      const tournamentMatchId=m.tournamentLink?.tournamentMatchId||'';
      const key=(tournamentId && tournamentMatchId)
        ? 'T:'+tournamentId+'|'+tournamentMatchId
        : 'M:'+String(m.id||uid());

      const endedAt=m.endedAt||m.finishedAt||m.startedAt||'';
      const fact={
        key,
        source:'saved',
        evidenceMode:matchEvidenceMode(m),
        savedMatchId:m.id||null,
        tournamentId:tournamentId||null,
        tournamentMatchId:tournamentMatchId||null,
        tournamentName:tournamentId
          ? ((data.tournaments||[]).find(t=>t.id===tournamentId)?.name||'Turnaj')
          : '',
        playerIds:[m.playerIds[0],m.playerIds[1]],
        playerNames:Array.isArray(m.playerNames)?[m.playerNames[0]||'',m.playerNames[1]||'']:['',''],
        scores:[Number(m.scores?.[0]||0),Number(m.scores?.[1]||0)],
        handicapEnabled:matchHasHandicap(m),
        handicapScores:matchHandicapScores(m),
        doublesMode:matchIsDoubles(m),
        winnerId:(m.winner===0||m.winner===1)?m.playerIds[m.winner]:null,
        discipline:m.discipline||'',
        roundLabel:'',
        endedAt,
        stats:m.stats||null
      };

      const prev=byKey.get(key);
      if(!prev || new Date(fact.endedAt||0)>new Date(prev.endedAt||0)){
        byKey.set(key,fact);
      }
    });

    // Potom doplníme turnajové zápasy, které v /matches vůbec nejsou
    // (např. ručně zapsané výsledky play-off).
    (data.tournaments||[]).forEach(t=>{
      if(!t)return;
      allTournamentMatches(t).forEach(tm=>{
        if(!tm || !tm.player1Id || !tm.player2Id)return;
        if(!(tm.status==='done' || tm.winnerId || tm.loserId))return;

        const key='T:'+t.id+'|'+tm.id;
        if(byKey.has(key))return;

        let winnerId=tm.winnerId||null;
        if(!winnerId && Number.isFinite(Number(tm.score1)) && Number.isFinite(Number(tm.score2))){
          if(Number(tm.score1)>Number(tm.score2))winnerId=tm.player1Id;
          else if(Number(tm.score2)>Number(tm.score1))winnerId=tm.player2Id;
        }

        byKey.set(key,{
          key,
          source:'tournament',
          evidenceMode:'basic',
          savedMatchId:null,
          tournamentId:t.id,
          tournamentMatchId:tm.id,
          tournamentName:t.name||'Turnaj',
          playerIds:[tm.player1Id,tm.player2Id],
          playerNames:[
            tournamentPlayerName(tm.player1Id,t),
            tournamentPlayerName(tm.player2Id,t)
          ],
          scores:[Number(tm.score1||0),Number(tm.score2||0)],
          handicapEnabled:!!t.handicapEnabled,
          handicapScores:[tournamentHandicapForPlayer(t,tm.player1Id),tournamentHandicapForPlayer(t,tm.player2Id)],
          winnerId,
          discipline:tournamentDisciplineForMatch(t,tm),
          roundLabel:tm.roundLabel||tm.bracket||'',
          endedAt:tm.finishedAt||t.updatedAt||t.createdAt||'',
          stats:null
        });
      });
    });

    return [...byKey.values()];
  }

  function playerMatchHistoryFacts(pid){
    return completedRealMatchFacts()
      .filter(f=>f.playerIds.includes(pid))
      .sort((a,b)=>new Date(b.endedAt||0)-new Date(a.endedAt||0));
  }

  function playerAggregate(pid){
    const facts=playerMatchHistoryFacts(pid);
    let wins=0,losses=0,racksFor=0,racksAgainst=0;
    let detailedMatches=0;
    let soloSessions14=0,ghostSessions=0;

    let extras={
      breaks:0,dryBreaks:0,softBreaks:0,softDryBreaks:0,breakFouls:0,breakPottedBalls:0,breakPottedTracked:0,aces:0,breakAndRun:0,runouts:0,pushOuts:0,pushOutsReturned:0,twoWayAttempts:0,twoWaySuccessful:0,twoWayPotSuccess:0,twoWaySafetySuccess:0,nineBallCombos:0,nineBallCaroms:0,tenBallCombos:0,tenBallCaroms:0,missBall1:0,missBall2:0,missBall3:0,missBall4:0,missBall5:0,missBall6:0,missBall7:0,missBall8:0,missBall9:0,missBall10:0,breakBall1:0,breakBall2:0,breakBall3:0,breakBall4:0,breakBall5:0,breakBall6:0,breakBall7:0,breakBall8:0,breakBall9:0,breakBall10:0,fouls:0,
      safeties:0,successfulSafeties:0,trackedSafeties:0,accidentalSafeties:0,safetyEscapes:0,
      successfulSafetyEscapes:0,resafes:0,misses:0,matchOnlyMisses:0,
      matchOnlyMissBadPosition:0,matchOnlyMissPot:0,threeFoulLosses:0,
      lagWins:0,openingBreakFouls14:0,threeFoulPenalties14:0,
      foulPenaltyPoints14:0,innings14:0,highRun14:0,
      ghostDryBreaks:0,ghostFailedRacks:0,ghostBIHRunouts:0,ghostCleanRunouts:0
    };

    // W/L a skóre počítáme z jednotného deduplikovaného seznamu,
    // který zahrnuje i ručně zapsané turnajové play-off.
    facts.forEach(f=>{
      const i=f.playerIds.indexOf(pid);
      if(i<0)return;
      const j=1-i;

      const actual=actualRackScores(f);
      racksFor+=Number(actual[i]||0);
      racksAgainst+=Number(actual[j]||0);

      if(f.winnerId===pid)wins++;
      else if(f.winnerId && f.winnerId===f.playerIds[j])losses++;

      // Detailní akční statistiky bereme pouze ze zápasů vedených rozšířeným počítadlem.
      // Základní skóre a ručně zadané turnajové výsledky ovlivňují W/L, ELO a racky, ale ne detailní procenta.
      if(matchEvidenceMode(f)!=='full')return;
      const statRow=(f.stats && f.stats[i]) ? f.stats[i] : null;
      if(!statRow)return;
      detailedMatches++;

      Object.keys(extras).forEach(k=>{
        if((k==='breaks' || k==='dryBreaks') &&
           !Object.prototype.hasOwnProperty.call(statRow,'dryBreaks')){
          return;
        }
        const v=Number(statRow[k]||0);
        if(k==='highRun14')extras[k]=Math.max(extras[k],v);
        else extras[k]+=v;
      });
    });

    // Sólo/Ghost zůstávají vedené z uložené historie /matches a nejsou součástí W/L.
    (data.matches||[]).forEach(m=>{
      if(!m || (m.status||'complete')!=='complete' || !Array.isArray(m.playerIds) || !m.playerIds.includes(pid))return;
      if(m.solo14)soloSessions14++;
      if(m.ghostMode)ghostSessions++;
    });

    return {
      matches:facts.length,
      detailedMatches,
      wins,
      losses,
      racksFor,
      racksAgainst,
      soloSessions14,
      ghostSessions,
      ...extras
    };
  }

  let editingPlayerId=null;
  let pendingProfilePhoto=null;

  $('refreshProfileClaimsBtn').onclick=renderProfileClaimsAdmin;
  $('migratePlayersBtn').onclick=migratePlayersToSecureBranch;


  function normalizePersonName(s){
    return String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
  }

  function findNameDuplicates(firstName,lastName){
    const full=normalizePersonName((firstName||'')+' '+(lastName||''));
    if(!full)return [];
    return Object.values(data.players||{}).filter(p=>normalizePersonName(p.name)===full);
  }

  function normalizeClubName(s){
    return String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
  }

  function findNameAndClubDuplicates(firstName,lastName,club){
    const full=normalizePersonName((firstName||'')+' '+(lastName||''));
    const clubKey=normalizeClubName(club);
    if(!full || !clubKey)return [];
    return Object.values(data.players||{}).filter(p=>
      normalizePersonName(p.name)===full &&
      normalizeClubName(p.club)===clubKey
    );
  }

  function normalizePlayerIdentifier(s){
    return String(s||'').trim().toLowerCase();
  }

  function playerIdentifierTaken(identifier){
    const key=normalizePlayerIdentifier(identifier);
    if(!key)return false;
    return Object.values(data.players||{}).some(p=>
      p && normalizePlayerIdentifier(p.identifier)===key
    );
  }

  function openOnboarding(){
    $('onboardingFirstName').value='';
    $('onboardingLastName').value='';
    $('onboardingIdentifier').value='';
    $('onboardingIdentifierWrap').classList.add('hidden');
    $('onboardingClub').value='';
    $('onboardingDuplicateBox').classList.add('hidden');
    $('onboardingDuplicateList').innerHTML='';
    $('onboardingMessage').textContent='';
    $('onboardingModal').classList.add('show');
    setTimeout(()=>$('onboardingFirstName').focus(),50);
  }

  function renderOnboardingDuplicates(){
    const first=$('onboardingFirstName').value.trim();
    const last=$('onboardingLastName').value.trim();
    const club=$('onboardingClub').value.trim();

    const nameDupes=findNameDuplicates(first,last);
    const exactDupes=findNameAndClubDuplicates(first,last,club);

    const box=$('onboardingDuplicateBox');
    const list=$('onboardingDuplicateList');
    const identifierWrap=$('onboardingIdentifierWrap');

    if(!first||!last||!nameDupes.length){
      box.classList.add('hidden');
      list.innerHTML='';
    }else{
      box.classList.remove('hidden');
      list.innerHTML=nameDupes
        .sort((a,b)=>String(a.club||'').localeCompare(String(b.club||''),'cs'))
        .map(p=>{
          const ownerText=p.ownerUid?'Profil už je přiřazen k účtu':'Profil zatím nemá vlastníka';
          const clubText=p.club?` • ${esc(p.club)}`:' • bez klubu';
          const ident=p.identifier?` • ${esc(p.identifier)}`:'';
          return `<div class="player-item" style="margin-top:8px">
            <div>
              <strong>${esc(p.name)}</strong>${clubText}${ident}
              <div class="muted">${ownerText}</div>
            </div>
            <div class="item-actions" style="margin-top:8px">
              ${p.ownerUid
                ? `<button class="btn" disabled>UŽ PŘIŘAZENO</button>`
                : `<button class="btn primary" onclick="requestClaimFromOnboarding('${p.id}')">TOHLE JSEM JÁ – POŽÁDAT O PŘEVZETÍ</button>`}
            </div>
          </div>`;
        }).join('');
    }

    if(first && last && club && exactDupes.length){
      identifierWrap.classList.remove('hidden');
    }else{
      identifierWrap.classList.add('hidden');
      $('onboardingIdentifier').value='';
    }
  }

  window.requestClaimFromOnboarding=async function(playerId){
    const p=data.players[playerId];
    if(!p)return;

    if(p.ownerUid){
      toast('Tento profil už je přiřazen jinému účtu.');
      return;
    }

    if(!confirm('Odeslat správci žádost o převzetí profilu „'+p.name+'“?'))return;

    try{
      await createProfileClaim(playerId);
      $('onboardingModal').classList.remove('show');
      toast('Žádost byla odeslána hlavnímu správci.');
    }catch(e){
      toast('Žádost se nepodařilo odeslat: '+String(e.message||e));
    }
  };

  async function createNewPlayerFromOnboarding(){
    const first=$('onboardingFirstName').value.trim();
    const last=$('onboardingLastName').value.trim();
    const identifier=$('onboardingIdentifier').value.trim();
    const club=$('onboardingClub').value.trim();

    if(!first){
      $('onboardingMessage').textContent='Vyplň jméno.';
      return;
    }
    if(!last){
      $('onboardingMessage').textContent='Vyplň příjmení.';
      return;
    }
    if(!club){
      $('onboardingMessage').textContent='Vyplň klub.';
      return;
    }

    const fullName=(first+' '+last).replace(/\s+/g,' ').trim();
    const nameDupes=findNameDuplicates(first,last);
    const exactDupes=findNameAndClubDuplicates(first,last,club);

    if(exactDupes.length){
      if(!identifier){
        $('onboardingMessage').textContent='Už existuje hráč se stejným jménem i klubem. Zadej prosím unikátní identifikátor.';
        $('onboardingIdentifierWrap').classList.remove('hidden');
        $('onboardingIdentifier').focus();
        return;
      }
      if(identifier.length<2){
        $('onboardingMessage').textContent='Identifikátor musí mít alespoň 2 znaky.';
        $('onboardingIdentifier').focus();
        return;
      }
      if(playerIdentifierTaken(identifier)){
        $('onboardingMessage').textContent='Tento identifikátor už používá jiný hráč. Zvol jiný.';
        $('onboardingIdentifier').focus();
        return;
      }

      const ok=confirm(
        'Už existuje '+(exactDupes.length===1?'hráč':'více hráčů')+
        ' se jménem „'+fullName+'“ a klubem „'+club+'“.\n\n'+
        'Nový profil bude odlišen identifikátorem „'+identifier+'“.\n\n'+
        'Opravdu vytvořit NOVÝ profil?'
      );
      if(!ok){
        renderOnboardingDuplicates();
        return;
      }
    }else if(nameDupes.length){
      const ok=confirm(
        'Už existuje '+(nameDupes.length===1?'hráč':'více hráčů')+
        ' se jménem „'+fullName+'“, ale v jiném klubu.\n\n'+
        'Nový profil bude rozlišen klubem „'+club+'“.\n\n'+
        'Opravdu vytvořit NOVÝ profil?'
      );
      if(!ok){
        renderOnboardingDuplicates();
        return;
      }
    }

    const p={
      id:uid(),
      name:fullName,
      firstName:first,
      lastName:last,
      nickname:'',
      identifier:exactDupes.length?identifier:'',
      useNicknameInMatch:false,
      club:club,
      clubId:currentUserClubId||'',
      ownerUid:cloudUid,
      note:'',
      equipment:'',
      achievements:'',
      photo:'',
      active:true,
      createdAt:new Date().toISOString()
    };

    data.players[p.id]=p;
    currentUserPlayerId=p.id;
    await saveSecurePlayer(p);

    try{
      await updateUserAccessRecord({playerId:p.id});
    }catch(e){
      console.warn(e);
      toast('Profil vznikl, ale vazbu účtu se nepodařilo uložit do Firebase.');
    }

    $('onboardingModal').classList.remove('show');
    renderPlayers();
    refreshAccountUI();
    openPlayerProfile(p.id);
    toast('Profil byl vytvořen.');
  }

  $('onboardingFirstName').addEventListener('input',renderOnboardingDuplicates);
  $('onboardingLastName').addEventListener('input',renderOnboardingDuplicates);
  $('onboardingClub').addEventListener('input',renderOnboardingDuplicates);
  $('onboardingCancelBtn').onclick=()=>{$('onboardingModal').classList.remove('show');};
  $('onboardingCreateBtn').onclick=createNewPlayerFromOnboarding;

  $('myPlayerProfileBtn').onclick=async()=>{
    if(!cloudAuthenticated || !cloudUid){
      $('cloudLoginModal').classList.add('show');
      return;
    }

    try{
      await ensureUserAccessRecord(true);

      // Pokud je účet už propojený s profilem, ale profil ještě není v lokálních datech,
      // nejdřív znovu natáhneme cloud.
      if(currentUserPlayerId && !data.players[currentUserPlayerId]){
        await loadSecurePlayers();
      await loadSecureMatches();
      await loadSecureTournaments();
      await promoteLegacyTournamentGuestsToProfiles();
      }

      if(currentUserPlayerId && data.players[currentUserPlayerId]){
        openPlayerProfile(currentUserPlayerId);
        return;
      }

      const claim=await loadOwnProfileClaim();

      if(claim&&claim.status==='pending'){
        toast('Žádost o profil '+(claim.playerName||'')+' čeká na schválení.');
        return;
      }

      if(claim&&claim.status==='approved'){
        await ensureUserAccessRecord(true);

        if(currentUserPlayerId && !data.players[currentUserPlayerId]){
          await loadSecurePlayers();
      await loadSecureMatches();
      await loadSecureTournaments();
      await promoteLegacyTournamentGuestsToProfiles();
        }

        if(currentUserPlayerId&&data.players[currentUserPlayerId]){
          openPlayerProfile(currentUserPlayerId);
          return;
        }

        toast('Profil je schválený, ale zatím se nenačetl z cloudu. Zkus obnovit stránku.');
        return;
      }

      openOnboarding();
    return;
    }catch(e){
      console.error(e);
      toast('Profil se nepodařilo otevřít: '+String(e.message||e));
    }
  };


  let playersReloadInProgress=false;


  function playerHasHistory(playerId){
    const matches=Array.isArray(data.matches)?data.matches:Object.values(data.matches||{});
    const tournaments=Array.isArray(data.tournaments)?data.tournaments:Object.values(data.tournaments||{});

    const hasMatch=matches.some(m=>{
      if(!m)return false;
      const ids=[
        m.player1Id,m.player2Id,m.p1Id,m.p2Id,
        m.playerId,m.winnerId,m.loserId
      ].filter(Boolean);
      return ids.includes(playerId);
    });

    if(hasMatch)return true;

    return tournaments.some(t=>{
      if(!t)return false;
      const pools=[]
        .concat(t.playerIds||[])
        .concat(t.players||[])
        .concat(t.participants||[]);
      return pools.some(x=>{
        if(typeof x==='string')return x===playerId;
        return x && (x.playerId===playerId || x.id===playerId);
      });
    });
  }

  window.deactivatePlayerProfile=async function(playerId){
    const p=data.players[playerId];
    if(!p)return;

    if(!canEditPlayer(p)){
      toast('Tento profil nemůžeš spravovat.');
      return;
    }

    if(!confirm('Deaktivovat profil „'+p.name+'“?\n\nHistorie, ELO, H2H a turnajové výsledky zůstanou zachované. Hráč se jen nebude nabízet do nových zápasů.'))return;

    p.active=false;
    p.deactivatedAt=new Date().toISOString();
    await saveSecurePlayer(p);
    renderPlayers();
    refreshAccountUI();
    toast('Profil byl deaktivován.');
  };

  window.reactivatePlayerProfile=async function(playerId){
    const p=data.players[playerId];
    if(!p)return;

    if(!canEditPlayer(p)){
      toast('Tento profil nemůžeš spravovat.');
      return;
    }

    p.active=true;
    delete p.deactivatedAt;
    await saveSecurePlayer(p);
    renderPlayers();
    refreshAccountUI();
    toast('Profil byl znovu aktivován.');
  };


  const PLAYER_DEVELOPMENT_MIN_MATCHES=20;
  const PLAYER_DEVELOPMENT_MIN_OPPONENTS=5;

  function playerDevelopmentEligibility(playerId){
    const facts=playerMatchHistoryFacts(playerId);
    const opponents=new Set();
    facts.forEach(f=>{
      const other=(f.playerIds||[]).find(id=>id!==playerId);
      if(other)opponents.add(other);
    });
    return {
      matches:facts.length,
      opponents:opponents.size,
      unlocked:facts.length>=PLAYER_DEVELOPMENT_MIN_MATCHES && opponents.size>=PLAYER_DEVELOPMENT_MIN_OPPONENTS
    };
  }

  function chronologicalRealMatchFacts(){
    return completedRealMatchFacts()
      .filter(f=>f && f.winnerId && Array.isArray(f.playerIds) && f.playerIds.length>=2)
      .sort((a,b)=>new Date(a.endedAt||0)-new Date(b.endedAt||0));
  }

  function playerEloTimeline(playerId){
    const ratings={};
    Object.keys(data.players||{}).forEach(id=>ratings[id]=ELO_START);
    const out=[];

    chronologicalRealMatchFacts().forEach(f=>{
      const a=f.playerIds[0], b=f.playerIds[1];
      if(!a || !b || !f.winnerId)return;

      const ra=ratings[a]??ELO_START;
      const rb=ratings[b]??ELO_START;
      const ea=1/(1+Math.pow(10,(rb-ra)/400));
      const eb=1-ea;
      const sa=f.winnerId===a?1:0;
      const sb=f.winnerId===b?1:0;

      ratings[a]=ra+ELO_K*(sa-ea);
      ratings[b]=rb+ELO_K*(sb-eb);

      if(a===playerId || b===playerId){
        out.push({
          n:out.length+1,
          value:Math.round(ratings[playerId]??ELO_START),
          date:f.endedAt||'',
          fact:f
        });
      }
    });

    return out;
  }

  function playerRollingDevelopment(playerId,metric){
    const facts=playerMatchHistoryFacts(playerId).slice().reverse();
    const points=[];

    facts.forEach((f,idx)=>{
      const windowFacts=facts.slice(Math.max(0,idx-9),idx+1);
      let value=null;

      if(metric==='form'){
        const decided=windowFacts.filter(x=>x.winnerId);
        if(decided.length){
          const wins=decided.filter(x=>x.winnerId===playerId).length;
          value=Math.round(wins/decided.length*100);
        }
      }else if(metric==='break'){
        let breaks=0,failed=0;
        windowFacts.forEach(x=>{
          const i=x.playerIds.indexOf(playerId);
          const s=(i>=0 && x.stats && x.stats[i])?x.stats[i]:null;
          if(!s)return;
          const b=Number(s.breaks||0);
          breaks+=b;
          failed+=Number(s.dryBreaks||0)+Number(s.softBreaks||0)-Number(s.softDryBreaks||0)+Number(s.breakFouls||0);
        });
        if(breaks>0)value=Math.round(Math.max(0,breaks-failed)/breaks*100);
      }else if(metric==='safety'){
        let tracked=0,success=0;
        windowFacts.forEach(x=>{
          const i=x.playerIds.indexOf(playerId);
          const s=(i>=0 && x.stats && x.stats[i])?x.stats[i]:null;
          if(!s)return;
          tracked+=Number(s.trackedSafeties||0);
          success+=Number(s.successfulSafeties||0);
        });
        if(tracked>0)value=Math.round(success/tracked*100);
      }else if(metric==='clean'){
        let count=0;
        windowFacts.forEach(x=>{
          const i=x.playerIds.indexOf(playerId);
          const s=(i>=0 && x.stats && x.stats[i])?x.stats[i]:null;
          if(!s)return;
          count+=Number(s.breakAndRun||0)+Number(s.runouts||0);
        });
        value=count;
      }

      points.push({n:idx+1,value,date:f.endedAt||'',fact:f});
    });

    return points;
  }

  function developmentMetricConfig(metric){
    if(metric==='form')return {title:'FORMA • posledních 10 zápasů',suffix:' %',min:0,max:100,info:'Podíl výher v klouzavém okně posledních 10 dokončených zápasů.'};
    if(metric==='break')return {title:'ÚSPĚŠNOST BREAKU • posledních 10 zápasů',suffix:' %',min:0,max:100,info:'Úspěšné breaky po odečtení dry breaků, soft breaků a faulů z breaku. Počítá se jen ze zápasů s detailními statistikami.'};
    if(metric==='safety')return {title:'ÚSPĚŠNOST SAFETY • posledních 10 zápasů',suffix:' %',min:0,max:100,info:'Podíl úspěšných safety z evidovaných safety v posledních 10 zápasech.'};
    if(metric==='clean')return {title:'ČISTÉ HRY + DOHRÁVKY • posledních 10 zápasů',suffix:'',min:0,max:null,info:'Počet čistých her a dohrávek nasbíraných v klouzavém okně posledních 10 zápasů.'};
    return {title:'VÝVOJ ELO',suffix:'',min:null,max:null,info:'ELO po každém dokončeném zápase. Počítají se i dohledatelné turnajové výsledky zapsané přímo v turnaji.'};
  }

  function renderDevelopmentLineChart(points,metric){
    const box=$('playerDevelopmentChart');
    const info=$('playerDevelopmentMetricInfo');
    if(!box || !info)return;

    const cfg=developmentMetricConfig(metric);
    info.innerHTML=`<strong>${esc(cfg.title)}</strong><br>${esc(cfg.info)}`;

    const valid=points.filter(p=>Number.isFinite(Number(p.value)));
    if(valid.length<2){
      box.innerHTML='<div class="empty">Pro tuto metriku zatím není dost detailních dat.</div>';
      return;
    }

    const width=900,height=360,padL=56,padR=18,padT=22,padB=52;
    const values=valid.map(p=>Number(p.value));
    let min=cfg.min!=null?cfg.min:Math.min(...values);
    let max=cfg.max!=null?cfg.max:Math.max(...values);
    if(min===max){ min-=1; max+=1; }
    if(cfg.min==null && cfg.max==null){
      const margin=Math.max(5,(max-min)*0.12);
      min-=margin; max+=margin;
    }

    const x=p=>padL+(p.n-1)/Math.max(1,(points.length-1))*(width-padL-padR);
    const y=v=>padT+(max-v)/(max-min)*(height-padT-padB);

    const path=valid.map((p,idx)=>(idx?'L':'M')+x(p).toFixed(1)+' '+y(Number(p.value)).toFixed(1)).join(' ');
    const last=valid[valid.length-1];

    const yTicks=[0,.25,.5,.75,1].map(t=>{
      const v=max-(max-min)*t;
      return {y:padT+(height-padT-padB)*t,v};
    });
    const xTicks=[];
    const total=points.length;
    [1,Math.max(1,Math.round(total*.25)),Math.max(1,Math.round(total*.5)),Math.max(1,Math.round(total*.75)),total]
      .forEach(n=>{if(!xTicks.includes(n))xTicks.push(n);});

    box.innerHTML=`<div style="overflow:auto">
      <svg viewBox="0 0 ${width} ${height}" style="width:100%;min-width:720px;display:block;background:rgba(255,255,255,.015);border:1px solid var(--border);border-radius:14px">
        ${yTicks.map(t=>`
          <line x1="${padL}" x2="${width-padR}" y1="${t.y}" y2="${t.y}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
          <text x="${padL-10}" y="${t.y+4}" text-anchor="end" fill="#a8a8ad" font-size="12">${Math.round(t.v)}${cfg.suffix}</text>
        `).join('')}
        ${xTicks.map(n=>`
          <line x1="${x({n})}" x2="${x({n})}" y1="${padT}" y2="${height-padB}" stroke="rgba(255,255,255,.05)" stroke-width="1"/>
          <text x="${x({n})}" y="${height-20}" text-anchor="middle" fill="#a8a8ad" font-size="12">#${n}</text>
        `).join('')}
        <path d="${path}" fill="none" stroke="#d4af37" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
        ${valid.map(p=>`<circle cx="${x(p)}" cy="${y(Number(p.value))}" r="3.5" fill="#f1d67a">
          <title>Zápas #${p.n}: ${Math.round(Number(p.value))}${cfg.suffix}</title>
        </circle>`).join('')}
        <circle cx="${x(last)}" cy="${y(Number(last.value))}" r="6" fill="#fff"/>
        <text x="${Math.min(width-padR-8,x(last)+10)}" y="${Math.max(18,y(Number(last.value))-10)}" text-anchor="end" fill="#fff" font-size="13" font-weight="900">
          ${Math.round(Number(last.value))}${cfg.suffix}
        </text>
      </svg>
    </div>`;
  }

  let currentDevelopmentPlayerId=null;
  let currentDevelopmentMetric='elo';

  function renderPlayerDevelopment(playerId,metric='elo'){
    const p=data.players?.[playerId];
    if(!p)return;

    const eligible=playerDevelopmentEligibility(playerId);
    const title=$('playerDevelopmentTitle');
    const summary=$('playerDevelopmentSummary');
    const cards=$('playerDevelopmentCards');
    if(!title || !summary || !cards)return;

    title.textContent='VÝVOJ HRÁČE • '+playerDisplayName(p);
    summary.textContent=`${eligible.matches} zápasů • ${eligible.opponents} různých soupeřů • odemčeno od ${PLAYER_DEVELOPMENT_MIN_MATCHES} zápasů / ${PLAYER_DEVELOPMENT_MIN_OPPONENTS} soupeřů`;

    if(!eligible.unlocked){
      cards.innerHTML='';
      $('playerDevelopmentChart').innerHTML=`<div class="empty">
        Vývoj hráče se odemkne po ${PLAYER_DEVELOPMENT_MIN_MATCHES} dokončených zápasech proti alespoň ${PLAYER_DEVELOPMENT_MIN_OPPONENTS} různým soupeřům.<br>
        Aktuálně: <strong>${eligible.matches}/${PLAYER_DEVELOPMENT_MIN_MATCHES} zápasů</strong> •
        <strong>${eligible.opponents}/${PLAYER_DEVELOPMENT_MIN_OPPONENTS} soupeřů</strong>.
      </div>`;
      $('playerDevelopmentMetricInfo').textContent='';
      return;
    }

    const agg=playerAggregate(playerId);
    const eloTimeline=playerEloTimeline(playerId);
    const currentElo=eloTimeline.length?eloTimeline[eloTimeline.length-1].value:ELO_START;
    const last10=playerRollingDevelopment(playerId,'form').filter(x=>Number.isFinite(Number(x.value)));
    const formNow=last10.length?last10[last10.length-1].value:null;
    const breakPts=playerRollingDevelopment(playerId,'break').filter(x=>Number.isFinite(Number(x.value)));
    const breakNow=breakPts.length?breakPts[breakPts.length-1].value:null;

    cards.innerHTML=`
      <div class="subpanel"><div class="muted">ELO</div><div style="font-size:28px;font-weight:950;color:var(--gold2)">${currentElo}</div></div>
      <div class="subpanel"><div class="muted">FORMA • posledních 10</div><div style="font-size:28px;font-weight:950;color:var(--gold2)">${formNow==null?'—':formNow+' %'}</div></div>
      <div class="subpanel"><div class="muted">BREAK • posledních 10</div><div style="font-size:28px;font-weight:950;color:var(--gold2)">${breakNow==null?'—':breakNow+' %'}</div></div>
    `;

    currentDevelopmentMetric=metric;
    document.querySelectorAll('#playerDevelopmentTabs [data-dev-metric]').forEach(btn=>{
      btn.classList.toggle('primary',btn.dataset.devMetric===metric);
    });

    const points=metric==='elo' ? eloTimeline : playerRollingDevelopment(playerId,metric);
    renderDevelopmentLineChart(points,metric);
  }

  window.openPlayerDevelopment=function(playerId){
    const p=data.players?.[playerId];
    if(!p)return;
    const eligible=playerDevelopmentEligibility(playerId);
    currentDevelopmentPlayerId=playerId;
    currentDevelopmentMetric='elo';
    renderPlayerDevelopment(playerId,'elo');
    $('playerDevelopmentModal').classList.add('show');

    if(!eligible.unlocked){
      toast(`Vývoj se odemkne po ${PLAYER_DEVELOPMENT_MIN_MATCHES} zápasech proti alespoň ${PLAYER_DEVELOPMENT_MIN_OPPONENTS} soupeřům.`);
    }
  };

  function renderPlayers(){
    const searchEl=$('playerSearchInput');
    const query=(searchEl?.value||'').trim().toLocaleLowerCase('cs');
    const ps=Object.values(data.players||{})
      .filter(p=>p.hiddenFromPlayers!==true)
      .filter(p=>{
        if(!query) return true;
        const haystack=[p.name,p.nickname,p.club]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('cs');
        return haystack.includes(query);
      })
      .sort((a,b)=>(a.name||'').localeCompare(b.name||'','cs'));
    const eloRatings=calculateEloRatings();

    if(!ps.length){
      if(query){
        $('playersView').innerHTML='<div class="empty">Žádný hráč neodpovídá hledání.</div>';
        return;
      }

      $('playersView').innerHTML='<div class="empty">Načítám hráče…</div>';

      if(cloudAuthenticated && !playersReloadInProgress){
        playersReloadInProgress=true;
        loadSecurePlayers()
          .then(()=>{
            playersReloadInProgress=false;
            const count=Object.keys(data.players||{}).length;
            if(count) renderPlayers();
            else $('playersView').innerHTML='<div class="empty">V cloudu nejsou načteni žádní hráči.</div>';
          })
          .catch(e=>{
            playersReloadInProgress=false;
            console.warn('Players reload:',e);
            $('playersView').innerHTML='<div class="empty">Hráče se nepodařilo načíst z cloudu.</div>';
          });
      }
      return;
    }

    $('playersView').innerHTML = ps.map(p=>{
      const s=playerAggregate(p.id);
      const wr=s.matches?((s.wins/s.matches)*100).toFixed(1):'0.0';
      const editable=canEditPlayer(p);
      const isMine=!!(currentUserPlayerId && currentUserPlayerId===p.id);

      return `<div class="player-item">
        <div class="history-line">
          <div style="display:flex;align-items:center;gap:12px;min-width:0">
            ${avatarHTML(p)}
            <div style="min-width:0">
              <strong style="font-size:20px">${esc(p.name)}</strong>
              ${isMine?'<span class="elo-badge" style="margin-left:8px">MŮJ PROFIL</span>':''}
              ${p.placeholderProfile && !p.ownerUid
                ? '<span class="elo-badge" style="margin-left:8px">PROFIL K PŘEVZETÍ</span>'
                : ''}
              ${currentUserIsSystemAdmin()
                ? (p.ownerUid
                    ? '<span class="elo-badge" style="margin-left:8px">ÚČET PROPOJEN</span>'
                    : '<span class="elo-badge" style="margin-left:8px;opacity:.65">BEZ ÚČTU</span>')
                : ''}
              ${p.active===false?'<span class="elo-badge" style="margin-left:8px">NEAKTIVNÍ</span>':''}
              ${p.nickname?`<div class="muted">„${esc(p.nickname)}“${p.useNicknameInMatch?' • zobrazuje se ve skóre':''}${p.club?' • '+esc(p.club):''}</div>`:(p.club?`<div class="muted">${esc(p.club)}</div>`:'')}
              <div class="muted">${s.matches} zápasů • ${s.wins} výher • ${s.losses} proher • ${s.detailedMatches||0} rozšířeně evidováno${s.soloSessions14?' • '+s.soloSessions14+' sólo 14.1':''}${s.ghostSessions?' • '+s.ghostSessions+' Ghost':''}</div>
              <div class="elo-badge">ELO ${eloRatings[p.id]??ELO_START}</div>
              ${p.equipment?`<div class="muted" style="margin-top:5px"><strong style="color:var(--text)">Vybavení:</strong> ${esc(p.equipment)}</div>`:''}
              ${p.achievements?`<div class="muted" style="margin-top:3px"><strong style="color:var(--text)">Největší úspěchy:</strong> ${esc(p.achievements)}</div>`:''}
            </div>
          </div>
          <div class="history-score">${wr}%</div>
        </div>
        <div class="item-actions">
          ${(()=>{
            const dev=playerDevelopmentEligibility(p.id);
            const devBtn=dev.unlocked
              ? `<button class="btn primary" onclick="openPlayerDevelopment('${p.id}')">VÝVOJ HRÁČE</button>`
              : `<button class="btn" onclick="openPlayerDevelopment('${p.id}')" title="Odemkne se po ${PLAYER_DEVELOPMENT_MIN_MATCHES} zápasech proti alespoň ${PLAYER_DEVELOPMENT_MIN_OPPONENTS} soupeřům">VÝVOJ HRÁČE 🔒</button>`;
            return editable
              ? `<button class="btn" onclick="openPlayerProfile('${p.id}')">${isMine?'MŮJ PROFIL':'PROFIL'}</button>
                 <button class="btn primary" onclick="openPlayerMatchHistory('${p.id}')">HISTORIE ZÁPASŮ</button>
                 ${devBtn}
                 ${p.active===false
                   ? `<button class="btn primary" onclick="reactivatePlayerProfile('${p.id}')">AKTIVOVAT</button>`
                   : `<button class="btn" onclick="deactivatePlayerProfile('${p.id}')">DEAKTIVOVAT</button>`}`
              : `<button class="btn" onclick="openPlayerProfile('${p.id}')" title="Profil je pouze pro čtení">PROFIL</button>
                 <button class="btn primary" onclick="openPlayerMatchHistory('${p.id}')">HISTORIE ZÁPASŮ</button>
                 ${devBtn}`;
          })()}
        </div>
        ${(()=>{
          const dev=playerDevelopmentEligibility(p.id);
          return dev.unlocked ? '' : `<div class="muted" style="margin-top:7px;font-size:12px">Vývoj hráče: ${dev.matches}/${PLAYER_DEVELOPMENT_MIN_MATCHES} zápasů • ${dev.opponents}/${PLAYER_DEVELOPMENT_MIN_OPPONENTS} soupeřů</div>`;
        })()}
      </div>`;
    }).join('');
  }


  document.addEventListener('input',function(e){
    if(e.target && e.target.id==='playerSearchInput'){
      renderPlayers();
    }
  });

  let playerMatchHistoryFilter='all';
  let currentPlayerMatchHistoryId=null;

  window.setPlayerMatchHistoryFilter=function(mode){
    playerMatchHistoryFilter=['all','full','basic'].includes(mode)?mode:'all';
    if(currentPlayerMatchHistoryId)renderPlayerMatchHistory(currentPlayerMatchHistoryId);
  };

  function renderPlayerMatchHistory(playerId){
    const wrap=$('playerMatchHistoryBody');
    const summary=$('playerMatchHistorySummary');
    const title=$('playerMatchHistoryTitle');
    if(!wrap || !summary || !title)return;

    const p=data.players?.[playerId];
    if(!p){
      title.textContent='Historie zápasů';
      summary.textContent='';
      wrap.innerHTML='<div class="empty">Profil hráče nebyl nalezen.</div>';
      return;
    }

    const allFacts=playerMatchHistoryFacts(playerId);
    const fullCount=allFacts.filter(f=>matchEvidenceMode(f)==='full').length;
    const basicCount=allFacts.length-fullCount;
    const facts=playerMatchHistoryFilter==='all' ? allFacts : allFacts.filter(f=>matchEvidenceMode(f)===playerMatchHistoryFilter);
    const wins=allFacts.filter(f=>f.winnerId===playerId).length;
    const losses=allFacts.filter(f=>f.winnerId && f.winnerId!==playerId).length;
    const racksFor=allFacts.reduce((sum,f)=>{
      const i=f.playerIds.indexOf(playerId);
      const actual=actualRackScores(f);
      return sum+Number(i>=0?actual[i]||0:0);
    },0);
    const racksAgainst=allFacts.reduce((sum,f)=>{
      const i=f.playerIds.indexOf(playerId);
      const j=i>=0?1-i:-1;
      const actual=actualRackScores(f);
      return sum+Number(j>=0?actual[j]||0:0);
    },0);

    title.textContent='HISTORIE ZÁPASŮ • '+playerDisplayName(p);
    summary.textContent=allFacts.length
      ? `${allFacts.length} zápasů • ${wins} výher • ${losses} proher • skóre ${racksFor}:${racksAgainst} • ${fullCount} rozšířeně • ${basicCount} základně`
      : 'Zatím není uložený žádný dokončený zápas.';

    const filterBar=`<div class="subpanel" style="margin-bottom:12px">
      <div style="font-weight:950;margin-bottom:7px">REŽIM EVIDENCE</div>
      <div class="item-actions">
        <button class="btn ${playerMatchHistoryFilter==='all'?'primary':''}" onclick="setPlayerMatchHistoryFilter('all')">VŠECHNY (${allFacts.length})</button>
        <button class="btn ${playerMatchHistoryFilter==='full'?'primary':''}" onclick="setPlayerMatchHistoryFilter('full')">ROZŠÍŘENÉ (${fullCount})</button>
        <button class="btn ${playerMatchHistoryFilter==='basic'?'primary':''}" onclick="setPlayerMatchHistoryFilter('basic')">ZÁKLADNÍ (${basicCount})</button>
      </div>
      <div class="muted" style="margin-top:8px;font-size:12px">Detailní akční statistiky se počítají pouze ze zápasů vedených přes rozšířené počítadlo.</div>
    </div>`;

    if(!allFacts.length){
      wrap.innerHTML=filterBar+'<div class="empty">Historie zápasů je zatím prázdná.</div>';
      return;
    }
    if(!facts.length){
      wrap.innerHTML=filterBar+'<div class="empty">V tomto filtru nejsou žádné zápasy.</div>';
      return;
    }

    wrap.innerHTML=filterBar+facts.map(f=>{
      const i=f.playerIds.indexOf(playerId);
      const j=1-i;
      const opponentId=f.playerIds[j];
      const opponent=data.players?.[opponentId];
      const opponentName=opponent
        ? playerDisplayName(opponent)
        : (f.playerNames?.[j]||tournamentPlayerName(opponentId)||'Soupeř');

      const won=f.winnerId===playerId;
      const loss=f.winnerId && f.winnerId!==playerId;
      const resultLabel=won?'VÝHRA':(loss?'PROHRA':'BEZ VÍTĚZE');
      const date=f.endedAt
        ? new Date(f.endedAt).toLocaleString('cs-CZ',{dateStyle:'medium',timeStyle:'short'})
        : 'datum neuvedeno';

      return `<div class="history-item" style="margin-bottom:10px">
        <div class="history-line">
          <div style="min-width:0">
            <strong>${resultLabel} • ${esc(opponentName)}</strong>${evidenceModeBadge(matchEvidenceMode(f))}
            ${f.doublesMode?'<span class="badge gold" style="margin-left:6px">DVOJICE</span>':''}
            ${f.handicapEnabled
              ? `<span class="badge" style="margin-left:6px;border-color:#705820;color:#f1d67a">HANDICAP ${esc(String(Number(f.handicapScores?.[0]||0)))}:${esc(String(Number(f.handicapScores?.[1]||0)))}</span>`
              : ''}
            ${f.streamMatchTitle?`<div style="margin-top:4px;color:var(--gold2);font-weight:850;font-size:12px">${esc(f.streamMatchTitle)}</div>`:''}
            <div class="muted" style="margin-top:4px">
              ${esc((f.discipline||'').toUpperCase())}
              ${f.tournamentName?' • '+esc(f.tournamentName):''}
              ${f.roundLabel?' • '+esc(f.roundLabel):''}
              • ${esc(date)}
            </div>
          </div>
          <div class="history-score">${Number(f.scores?.[i]||0)} : ${Number(f.scores?.[j]||0)}</div>
        </div>
        ${f.savedMatchId
          ? `<div class="item-actions" style="margin-top:8px">
              <button class="btn" onclick="showSavedMatchStats('${f.savedMatchId}')">STATISTIKY ZÁPASU</button>
            </div>`
          : `<div class="muted" style="margin-top:7px;font-size:12px">Výsledek byl zapsán přímo v turnaji.</div>`}
      </div>`;
    }).join('');
  }

  window.openPlayerMatchHistory=function(playerId){
    const p=data.players?.[playerId];
    if(!p)return;
    currentPlayerMatchHistoryId=playerId;
    playerMatchHistoryFilter='all';
    renderPlayerMatchHistory(playerId);
    $('playerMatchHistoryModal').classList.add('show');
  };

  window.openPlayerProfile=function(id){
    const p=data.players[id]; if(!p) return;
    const readOnly=!canEditPlayer(p);
    editingPlayerId=id;
    pendingProfilePhoto=p.photo||'';
    $('profileName').value=p.name||'';
    $('profileNickname').value=p.nickname||'';
    $('profileUseNickname').checked=!!p.useNicknameInMatch;
    $('profileClub').value=p.club||'';
    $('profileNote').value=p.note||'';
    $('profileEquipment').value=p.equipment||'';
    $('profileAchievements').value=p.achievements||'';
    $('profilePhotoFile').value='';

    ['profileName','profileNickname','profileUseNickname','profileClub','profileNote','profileEquipment','profileAchievements','profilePhotoFile','removeProfilePhoto']
      .forEach(fid=>{ const el=$(fid); if(el) el.disabled=readOnly; });

    if($('saveProfile')){
      $('saveProfile').style.display=readOnly?'none':'';
      $('saveProfile').disabled=readOnly;
    }
    if($('deletePlayer')){
      $('deletePlayer').style.display=readOnly?'none':'';
      $('deletePlayer').disabled=readOnly;
    }

    const challengeAction=$('profileChallengeAction');
    const challengeBtn=$('profileChallengeBtn');
    const canChallenge=!!(cloudAuthenticated && currentUserPlayerId && p.ownerUid && String(p.id)!==String(currentUserPlayerId) && String(p.ownerUid)!==String(cloudUid));
    if(challengeAction)challengeAction.classList.toggle('hidden',!canChallenge);
    if(challengeBtn){
      challengeBtn.dataset.playerId=p.id||id;
      challengeBtn.disabled=!canChallenge;
    }

    renderProfilePreview();
    $('profileModal').classList.add('show');
  };

  function renderProfilePreview(){
    const p={name:$('profileName').value||data.players[editingPlayerId]?.name||'',photo:pendingProfilePhoto};
    if(p.photo){
      $('profileAvatar').src=p.photo;
      $('profileAvatar').classList.remove('hidden');
      $('profileAvatarFallback').classList.add('hidden');
    }else{
      $('profileAvatar').removeAttribute('src');
      $('profileAvatar').classList.add('hidden');
      $('profileAvatarFallback').classList.remove('hidden');
      $('profileAvatarFallback').textContent=initials(p.name);
    }
  }

  $('profileName').addEventListener('input',renderProfilePreview);
  $('closeProfile').onclick=()=>{$('profileModal').classList.remove('show'); editingPlayerId=null;};
  if($('playerMatchHistoryClose'))$('playerMatchHistoryClose').onclick=()=>{
    $('playerMatchHistoryModal').classList.remove('show');
  };
  if($('playerDevelopmentClose'))$('playerDevelopmentClose').onclick=()=>{
    $('playerDevelopmentModal').classList.remove('show');
    currentDevelopmentPlayerId=null;
  };

  function openPlayerDevelopmentHelp(){
    $('playerDevelopmentHelpModal')?.classList.add('show');
  }
  if($('playerDevelopmentHelpBtn'))$('playerDevelopmentHelpBtn').onclick=openPlayerDevelopmentHelp;
  if($('playerDevelopmentHelpBtnBottom'))$('playerDevelopmentHelpBtnBottom').onclick=openPlayerDevelopmentHelp;
  if($('playerDevelopmentHelpClose'))$('playerDevelopmentHelpClose').onclick=()=>{
    $('playerDevelopmentHelpModal')?.classList.remove('show');
  };
  document.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#playerDevelopmentTabs [data-dev-metric]');
    if(!btn || !currentDevelopmentPlayerId)return;
    renderPlayerDevelopment(currentDevelopmentPlayerId,btn.dataset.devMetric||'elo');
  });
  $('removeProfilePhoto').onclick=()=>{pendingProfilePhoto=''; $('profilePhotoFile').value=''; renderProfilePreview();};

  $('profilePhotoFile').addEventListener('change',async e=>{
    const file=(e.target.files && e.target.files[0]); if(!file) return;
    try{
      pendingProfilePhoto=await resizePhoto(file,320,0.82);
      renderProfilePreview();
    }catch(err){ toast('Fotku se nepodařilo načíst.'); }
  });

  function resizePhoto(file,maxSize=320,quality=.82){
    return new Promise((resolve,reject)=>{
      const reader=new FileReader();
      reader.onerror=reject;
      reader.onload=()=>{
        const img=new Image();
        img.onerror=reject;
        img.onload=()=>{
          let w=img.width,h=img.height;
          const scale=Math.min(1,maxSize/Math.max(w,h));
          w=Math.max(1,Math.round(w*scale)); h=Math.max(1,Math.round(h*scale));
          const c=document.createElement('canvas'); c.width=w; c.height=h;
          c.getContext('2d').drawImage(img,0,0,w,h);
          resolve(c.toDataURL('image/jpeg',quality));
        };
        img.src=reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('saveProfile').onclick=async()=>{
    if(editingPlayerId && data.players[editingPlayerId] && !canEditPlayer(data.players[editingPlayerId])){ toast('Tento profil je pouze pro čtení.'); return; }
    const p=data.players[editingPlayerId]; if(!p) return;
    const newName=$('profileName').value.trim();
    if(!newName){toast('Jméno nesmí být prázdné.');return;}
    const duplicate=Object.values(data.players).find(x=>x.id!==p.id && x.name.trim().toLowerCase()===newName.toLowerCase());
    if(duplicate){toast('Hráč s tímto jménem už existuje.');return;}

    p.name=newName;
    p.nickname=$('profileNickname').value.trim();
    p.useNicknameInMatch=$('profileUseNickname').checked && !!p.nickname;
    p.club=$('profileClub').value.trim();
    p.note=$('profileNote').value.trim();
    p.equipment=$('profileEquipment').value.trim();
    p.achievements=$('profileAchievements').value.trim();
    p.photo=pendingProfilePhoto||'';

    // Keep historical/current display names synchronized with profile rename.
    data.matches.forEach(m=>{
      const idx=m.playerIds.indexOf(p.id);
      if(idx>=0){
        m.playerNames[idx]=playerDisplayName(p);
        if(!m.playerRealNames) m.playerRealNames=[...(m.playerNames||[])];
        m.playerRealNames[idx]=p.name;
      }
    });
    if(match && Array.isArray(match.playerIds)){
      const idx=match.playerIds.indexOf(p.id);
      if(idx>=0){
        match.playerNames[idx]=playerDisplayName(p);
        if(!match.playerRealNames) match.playerRealNames=[...(match.playerNames||[])];
        match.playerRealNames[idx]=p.name;
        saveDeviceActiveMatch(match);
      }
    }
    if(match){
      const idx=match.playerIds.indexOf(p.id);
      if(idx>=0){
        match.playerNames[idx]=playerDisplayName(p);
        if(!match.playerRealNames) match.playerRealNames=[...(match.playerNames||[])];
        match.playerRealNames[idx]=p.name;
      }
    }

    await saveSecurePlayer(p);
    $('profileModal').classList.remove('show');
    editingPlayerId=null;
    renderPlayers();
    if(match) renderMatch();
    toast('Profil hráče uložen.');
  };

  $('deletePlayer').onclick=async()=>{
    if(editingPlayerId && data.players[editingPlayerId] && !canEditPlayer(data.players[editingPlayerId])){
      toast('Tento profil nelze upravovat ani mazat.');
      return;
    }

    const p=data.players[editingPlayerId];
    if(!p)return;

    if(playerHasHistory(editingPlayerId)){
      $('profileModal').classList.remove('show');
      deactivatePlayerProfile(editingPlayerId);
      return;
    }

    if(!confirm('Profil „'+p.name+'“ nemá žádnou historii. Opravdu ho úplně smazat?'))return;

    await deleteSecurePlayer(editingPlayerId);

    if(currentUserPlayerId===editingPlayerId){
      currentUserPlayerId=null;
      try{ updateUserAccessRecord({playerId:''}); }catch(e){}
    }

    editingPlayerId=null;
    $('profileModal').classList.remove('show');
    renderPlayers();
    refreshAccountUI();
    toast('Profil byl smazán.');
  };

  function ghostAggregate(pid){
    const sessions=data.matches.filter(m=>
      m.ghostMode &&
      (m.status||'complete')==='complete' &&
      m.playerIds &&
      m.playerIds[0]===pid
    );

    let playerPoints=0,ghostPoints=0,clean=0,bih=0,failed=0,dry=0;
    const byDiscipline={'8-ball':0,'9-ball':0,'10-ball':0};
    const missByBall={};

    sessions.forEach(m=>{
      playerPoints+=Number(m.scores[0]||0);
      ghostPoints+=Number(m.scores[1]||0);
      clean+=statVal(m,0,'ghostCleanRunouts');
      bih+=statVal(m,0,'ghostBIHRunouts');
      failed+=statVal(m,0,'ghostFailedRacks');
      dry+=statVal(m,0,'ghostDryBreaks');
      if(byDiscipline[m.discipline]!=null) byDiscipline[m.discipline]++;

      if(m.discipline==='9-ball'||m.discipline==='10-ball'){
        const map=m?.stats?.[0]?.ghostMissesByBall||{};
        Object.entries(map).forEach(([ball,count])=>{
          const b=Number(ball), n=Number(count||0);
          if(b>0&&n>0)missByBall[b]=Number(missByBall[b]||0)+n;
        });
      }
    });

    const ballRows=Object.entries(missByBall)
      .map(([ball,count])=>({ball:Number(ball),count:Number(count||0)}))
      .filter(x=>x.ball>0&&x.count>0)
      .sort((a,b)=>b.count-a.count||a.ball-b.ball);
    const mostCommonBall=ballRows.length?ballRows[0]:null;
    const ballBreakdown=ballRows.length
      ? [...ballRows].sort((a,b)=>a.ball-b.ball).map(x=>'#'+x.ball+' '+x.count+'×').join(' • ')
      : '—';

    return {
      sessions:sessions.length,
      playerPoints,ghostPoints,clean,bih,failed,dry,
      racks:clean+bih+failed+dry,
      byDiscipline,
      missByBall,
      mostCommonBall,
      ballBreakdown
    };
  }

  
  function baseTournamentPlacementRecords(t){
    if(!t || t.status!=='complete') return [];
    const records=[];

    const addGroupEliminations=()=>{
      (t.groupEliminations||[]).forEach(e=>{
        const exactPlace=Math.max(1,Number(e.place||1));
        const r=eliminationBand(exactPlace);
        records.push({
          playerId:e.playerId,
          label:r.from===r.to?r.from+'. místo':r.from+'.–'+r.to+'. místo',
          // Pro sérii zachováváme skutečné individuální pořadí.
          // Label může dál zobrazovat společné pásmo turnaje.
          value:exactPlace
        });
      });
    };

    if(t.ko){
      const k=t.ko;
      if(k.championId)records.push({playerId:k.championId,label:'1. místo',value:1});
      if(k.runnerUpId)records.push({playerId:k.runnerUpId,label:'2. místo',value:2});
      if(k.thirdPlacePlayoff){
        if(k.thirdPlaceWinnerId)records.push({playerId:k.thirdPlaceWinnerId,label:'3. místo',value:3});
        if(k.thirdPlaceLoserId)records.push({playerId:k.thirdPlaceLoserId,label:'4. místo',value:4});
      }else{
        (k.eliminations||[]).filter(e=>Number(e.place||999)<=4).slice(0,2)
          .forEach(e=>records.push({playerId:e.playerId,label:'3. místo',value:3}));
      }
      (k.eliminations||[]).forEach(e=>{
        const exactPlace=Number(e.place||0);
        if(exactPlace<=4)return;
        const r=eliminationBand(exactPlace);
        records.push({
          playerId:e.playerId,
          label:r.from+'.–'+r.to+'. místo',
          value:exactPlace
        });
      });
      addGroupEliminations();
      return records;
    }

    if(t.dko){
      const d=t.dko;
      if(d.championId)records.push({playerId:d.championId,label:'1. místo',value:1});
      const gf=dkoFinalMatch(t);
      const runner=d.runnerUpId||gf?.loserId||null;
      if(runner)records.push({playerId:runner,label:'2. místo',value:2});

      if(d.thirdPlacePlayoff){
        if(d.thirdPlaceWinnerId)records.push({playerId:d.thirdPlaceWinnerId,label:'3. místo',value:3});
        if(d.thirdPlaceLoserId)records.push({playerId:d.thirdPlaceLoserId,label:'4. místo',value:4});
      }else{
        (d.eliminations||[]).filter(e=>Number(e.place||999)<=4).sort((a,b)=>Number(a.place)-Number(b.place)).slice(0,2)
          .forEach(e=>records.push({playerId:e.playerId,label:'3. místo',value:3}));
      }
      (d.eliminations||[]).forEach(e=>{
        const p=Number(e.place||0);if(p<=4)return;
        const range=dkoPlacementRange(p);
        records.push({
          playerId:e.playerId,
          label:range.from+'.–'+range.to+'. místo',
          value:p
        });
      });
      addGroupEliminations();
      return records;
    }


    if(t.format==='swiss'){
      swissStandings(t).forEach(r=>{
        records.push({
          playerId:r.id,
          label:r.place+'. místo',
          value:r.place
        });
      });
      return records;
    }

    if(t.format==='groups'){
      const rr=roundRobinOverallStandings(t);
      rr.forEach(r=>{
        records.push({
          playerId:r.playerId,
          label:r.label,
          value:r.place
        });
      });
      return records;
    }

    return records;
  }

  function tournamentPlacementSeriesRule(t){
    if(!t?.id)return null;

    const candidates=(data.tournamentSeries||[])
      .filter(s=>(s.tournamentIds||[]).includes(t.id))
      .filter(s=>seriesPlacementTieBreakMode(s)!=='legacy');
    if(candidates[0])return candidates[0];

    if(t.seriesPlacementTieBreak==='score_h2h_group'){
      return {name:'Lounská tour',placementTieBreak:'score_h2h_group'};
    }

    const normalized=String(t.name||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase();

    return normalized.includes('loun')
      ? {name:t.name||'Lounská tour',placementTieBreak:'score_h2h_group'}
      : null;
  }

  function tournamentPlacementRecords(t){
    const records=baseTournamentPlacementRecords(t);
    const series=tournamentPlacementSeriesRule(t);
    return series ? seriesRefineTournamentPlacements(series,t,records) : records;
  }

  function completedTournamentMatchResults(t){
    if(!t)return [];
    return allTournamentMatches(t)
      .filter(m=>m && (m.status==='done'||m.winnerId||m.loserId) && m.player1Id && m.player2Id)
      .map(m=>{
        const winnerId=m.winnerId || (
          Number.isFinite(Number(m.score1)) && Number.isFinite(Number(m.score2))
            ? (Number(m.score1)>Number(m.score2)?m.player1Id:(Number(m.score2)>Number(m.score1)?m.player2Id:null))
            : null
        );
        return {
          tournamentId:t.id,
          tournamentMatchId:m.id,
          playerIds:[m.player1Id,m.player2Id],
          winnerId,
          score1:Number(m.score1||0),
          score2:Number(m.score2||0)
        };
      });
  }

  function buildTournamentStats(){
    const map=new Map();

    const ensure=(playerId)=>{
      if(!map.has(playerId)){
        map.set(playerId,{
          playerId,
          tournaments:0,
          wins:0,
          seconds:0,
          thirds:0,
          podiums:0,
          best:null,
          placementSum:0,
          placementCount:0,
          tournamentMatches:0,
          tournamentMatchWins:0,
          history:[]
        });
      }
      return map.get(playerId);
    };

    const completed=(data.tournaments||[]).filter(t=>t && t.status==='complete');

    completed.forEach(t=>{
      const placements=tournamentPlacementRecords(t);
      const seen=new Set();

      placements.forEach(r=>{
        if(!r.playerId || String(r.playerId).startsWith('guest_')) return;
        const s=ensure(r.playerId);
        if(!seen.has(r.playerId)){
          s.tournaments++;
          seen.add(r.playerId);
        }

        if(!r.groupOnly){
          if(r.value===1)s.wins++;
          if(r.value===2)s.seconds++;
          if(r.value===3)s.thirds++;
          if(r.value<=3)s.podiums++;
          if(s.best===null || r.value<s.best)s.best=r.value;
          s.placementSum+=Number(r.value||0);
          s.placementCount++;
        }

        s.history.push({
          tournamentId:t.id,
          tournamentName:t.name||'Turnaj',
          date:t.createdAt||'',
          discipline:t.discipline||'',
          label:r.label,
          value:r.value,
          format:t.format
        });
      });
    });

    // Ručně doplněné historické turnaje ze sérií.
    // Neovlivňují ELO ani detailní herní statistiky, ale doplňují umístění a W/L.
    const seenHistoricalTournamentIds=new Set();
    (data.tournamentSeries||[]).forEach(series=>{
      (series.historicalTournaments||[]).forEach(ht=>{
        if(!ht?.id||seenHistoricalTournamentIds.has(ht.id))return;
        seenHistoricalTournamentIds.add(ht.id);

        const seenPlayers=new Set();
        (ht.results||[]).forEach(r=>{
          const pid=r.playerId;
          if(!pid||!data.players?.[pid])return;
          const st=ensure(pid);
          if(!seenPlayers.has(pid)){st.tournaments++;seenPlayers.add(pid);}
          const place=Number(r.place||r.value||999);
          if(Number.isFinite(place)&&place<999){
            if(place===1)st.wins++;
            if(place===2)st.seconds++;
            if(place===3)st.thirds++;
            if(place<=3)st.podiums++;
            if(st.best===null||place<st.best)st.best=place;
            st.placementSum+=place;
            st.placementCount++;
          }
          st.history.push({
            tournamentId:ht.id,
            tournamentName:ht.name||'Historický turnaj',
            date:ht.date||ht.createdAt||'',
            discipline:'',
            label:place<999?(place+'. místo'+(r.sharedPlace?' (dělené)':'')):'—',
            value:place,
            historical:true
          });
        });

        if(ht.statsComplete){
          (ht.matches||[]).forEach(m=>{
            [m.player1Id,m.player2Id].forEach(pid=>{
              if(pid&&data.players?.[pid])ensure(pid).tournamentMatches++;
            });
            if(m.winnerId&&data.players?.[m.winnerId])ensure(m.winnerId).tournamentMatchWins++;
          });
        }
      });
    });

    // Turnajové W/L počítáme ze stejného deduplikovaného zdroje jako hlavní statistiky.
    // Jeden turnajový zápas se započítá právě jednou, ať vznikl přes počítadlo
    // nebo byl výsledek zapsán ručně přímo v turnaji.
    completedRealMatchFacts()
      .filter(f=>!!f.tournamentId)
      .forEach(f=>{
        f.playerIds.forEach(pid=>{
          if(!pid || String(pid).startsWith('guest_'))return;
          ensure(pid).tournamentMatches++;
        });

        if(f.winnerId && !String(f.winnerId).startsWith('guest_')){
          ensure(f.winnerId).tournamentMatchWins++;
        }
      });

    return [...map.values()];
  }

  function tournamentBestLabel(s){
    if(s.best===null || s.best===undefined)return '—';
    if(s.best===1)return '1. místo';
    if(s.best===2)return '2. místo';
    if(s.best===3)return '3. místo';
    if(s.best===4)return '4. místo';
    return Number.isInteger(s.best)?(s.best+'. místo'):String(s.best).replace('.',',');
  }

  function renderTournamentStats(){
    const summary=$('tournamentStatsSummary');
    const history=$('tournamentStatsHistory');
    if(!summary || !history)return;

    const stats=buildTournamentStats()
      .filter(s=>data.players?.[s.playerId] && data.players[s.playerId].active!==false && data.players[s.playerId].hiddenFromPlayers!==true)
      .sort((a,b)=>
        b.wins-a.wins ||
        b.podiums-a.podiums ||
        (a.best??999)-(b.best??999) ||
        b.tournamentMatchWins-a.tournamentMatchWins ||
        playerDisplayName(data.players[a.playerId]).localeCompare(playerDisplayName(data.players[b.playerId]),'cs')
      );

    if(!stats.length){
      summary.innerHTML='<div class="muted">Zatím nejsou dokončené turnaje s výsledky.</div>';
      history.innerHTML='';
      return;
    }

    summary.innerHTML=`
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:900px">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Hráč</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">Turnaje</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">1.</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">2.</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">3.</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">Podia</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">Nejlepší</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">Průměr</th>
              <th style="text-align:center;padding:8px;border-bottom:1px solid var(--border)">Zápasy W/L</th>
            </tr>
          </thead>
          <tbody>
            ${stats.map(s=>{
              const p=data.players[s.playerId];
              const avg=s.placementCount ? (s.placementSum/s.placementCount).toFixed(1).replace('.',',') : '—';
              const losses=Math.max(0,s.tournamentMatches-s.tournamentMatchWins);
              return `<tr>
                <td style="padding:8px;border-bottom:1px solid var(--border);font-weight:900">${esc(playerDisplayName(p))}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${s.tournaments}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${s.wins}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${s.seconds}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${s.thirds}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${s.podiums}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center;color:var(--gold2);font-weight:950">${esc(tournamentBestLabel(s))}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${avg}</td>
                <td style="padding:8px;border-bottom:1px solid var(--border);text-align:center">${s.tournamentMatchWins}/${losses}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    history.innerHTML=`
      <h3 style="margin:0 0 8px">TURNAJOVÁ HISTORIE HRÁČŮ</h3>
      <div style="display:grid;gap:10px">
        ${stats.map(s=>{
          const p=data.players[s.playerId];
          const hist=[...s.history].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
          return `<div class="subpanel">
            <div style="font-weight:950;font-size:17px">${esc(playerDisplayName(p))}</div>
            <div style="display:grid;gap:6px;margin-top:8px">
              ${hist.length?hist.map(h=>`
                <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap">
                  <span>${esc(h.tournamentName)}${h.discipline?' • '+esc(String(h.discipline).toUpperCase()):''}</span>
                  <strong style="color:var(--gold2)">${esc(h.label)}</strong>
                </div>
              `).join(''):'<div class="muted">Bez dokončeného turnaje.</div>'}
            </div>
          </div>`;
        }).join('')}
      </div>`;
  }


  let myStatsDiscipline='all';

  function playerAggregateByDiscipline(pid,discipline='all'){
    if(discipline==='all') return playerAggregate(pid);
    const facts=playerMatchHistoryFacts(pid).filter(f=>f.discipline===discipline);
    let wins=0,losses=0,racksFor=0,racksAgainst=0,detailedMatches=0;
    let extras={
      breaks:0,dryBreaks:0,softBreaks:0,softDryBreaks:0,breakFouls:0,breakPottedBalls:0,breakPottedTracked:0,aces:0,breakAndRun:0,runouts:0,pushOuts:0,pushOutsReturned:0,twoWayAttempts:0,twoWaySuccessful:0,twoWayPotSuccess:0,twoWaySafetySuccess:0,nineBallCombos:0,nineBallCaroms:0,tenBallCombos:0,tenBallCaroms:0,missBall1:0,missBall2:0,missBall3:0,missBall4:0,missBall5:0,missBall6:0,missBall7:0,missBall8:0,missBall9:0,missBall10:0,breakBall1:0,breakBall2:0,breakBall3:0,breakBall4:0,breakBall5:0,breakBall6:0,breakBall7:0,breakBall8:0,breakBall9:0,breakBall10:0,fouls:0,
      safeties:0,successfulSafeties:0,trackedSafeties:0,accidentalSafeties:0,safetyEscapes:0,successfulSafetyEscapes:0,resafes:0,misses:0,matchOnlyMisses:0,
      matchOnlyMissBadPosition:0,matchOnlyMissPot:0,threeFoulLosses:0,lagWins:0,openingBreakFouls14:0,threeFoulPenalties14:0,foulPenaltyPoints14:0,innings14:0,highRun14:0
    };
    facts.forEach(f=>{
      const i=f.playerIds.indexOf(pid); if(i<0)return;
      const j=1-i,actual=actualRackScores(f);
      racksFor+=Number(actual[i]||0); racksAgainst+=Number(actual[j]||0);
      if(f.winnerId===pid)wins++; else if(f.winnerId===f.playerIds[j])losses++;
      if(matchEvidenceMode(f)!=='full')return;
      const statRow=(f.stats&&f.stats[i])?f.stats[i]:null; if(!statRow)return;
      detailedMatches++;
      Object.keys(extras).forEach(k=>{const v=Number(statRow[k]||0); if(k==='highRun14')extras[k]=Math.max(extras[k],v); else extras[k]+=v;});
    });
    let soloSessions14=0,ghostSessions=0;
    (data.matches||[]).forEach(m=>{
      if(!m || (m.status||'complete')!=='complete' || !Array.isArray(m.playerIds) || !m.playerIds.includes(pid) || m.discipline!==discipline)return;
      if(m.solo14)soloSessions14++; if(m.ghostMode)ghostSessions++;
    });
    return {matches:facts.length,detailedMatches,wins,losses,racksFor,racksAgainst,soloSessions14,ghostSessions,...extras};
  }

  function myStatsForm(pid,discipline='all',limit=10){
    const facts=playerMatchHistoryFacts(pid).filter(f=>discipline==='all'||f.discipline===discipline).filter(f=>!!f.winnerId).slice(0,limit);
    if(!facts.length)return {matches:0,wins:0,pct:null};
    const wins=facts.filter(f=>f.winnerId===pid).length;
    return {matches:facts.length,wins,pct:Math.round(wins/facts.length*100)};
  }
  function pctStat(success,total){success=Number(success||0);total=Number(total||0);return total?Math.round(success/total*100)+' %':'—';}
  function myStatsBreakPct(a){const total=Number(a.breaks||0);if(!total)return '—';const failed=Number(a.dryBreaks||0)+Number(a.softBreaks||0)-Number(a.softDryBreaks||0)+Number(a.breakFouls||0);return Math.round(Math.max(0,total-failed)/total*100)+' %';}
  function myStatsBreakConversion(a){const total=Number(a.breaks||0);const failed=Number(a.dryBreaks||0)+Number(a.softBreaks||0)-Number(a.softDryBreaks||0)+Number(a.breakFouls||0);const successful=Math.max(0,total-failed);return successful?Math.round(Number(a.breakAndRun||0)/successful*100)+' %':'—';}
  function myStatsRecentMatches(pid,discipline='all'){return playerMatchHistoryFacts(pid).filter(f=>discipline==='all'||f.discipline===discipline).slice(0,8);}

  function myStatsFactLine(f,pid){
    const i=f.playerIds.indexOf(pid),j=1-i;if(i<0)return '';
    const won=f.winnerId===pid,opp=f.playerNames?.[j]||data.players?.[f.playerIds[j]]?.name||'Soupeř';
    const date=f.endedAt?new Date(f.endedAt).toLocaleDateString('cs-CZ'):'';
    const desc=[date,f.discipline?String(f.discipline).toUpperCase():'',f.tournamentName||'',f.roundLabel||''].filter(Boolean).join(' • ');
    return `<div class="history-line" style="align-items:center"><div style="min-width:0"><strong>${won?'VÝHRA':'PROHRA'} • ${esc(opp)}</strong><div class="muted" style="margin-top:3px">${esc(desc)} ${evidenceModeBadge(matchEvidenceMode(f))}</div></div><div style="font-size:22px;font-weight:950;color:${won?'var(--gold2)':'inherit'}">${Number(f.scores?.[i]||0)}:${Number(f.scores?.[j]||0)}</div></div>`;
  }

  function renderMyStats(discipline=myStatsDiscipline){
    const box=$('myStatsView'),devBtn=$('myStatsDevelopmentBtn');if(!box)return;
    if(!cloudAuthenticated){if(devBtn)devBtn.classList.add('hidden');box.innerHTML='<div class="empty">Pro zobrazení osobních statistik se nejdřív přihlas.</div>';return;}
    const pid=currentUserPlayerId,p=pid?data.players?.[pid]:null;
    if(!p){if(devBtn)devBtn.classList.add('hidden');box.innerHTML='<div class="empty">Tvůj účet zatím nemá přiřazený hráčský profil. Jakmile bude profil propojen, tady se automaticky zobrazí všechny dříve uložené výsledky.</div>';return;}
    myStatsDiscipline=discipline;
    if(devBtn){devBtn.classList.remove('hidden');devBtn.onclick=()=>openPlayerDevelopment(pid);}
    const a=playerAggregateByDiscipline(pid,discipline),elo=playerElo(pid,discipline==='all'?null:discipline),wr=a.matches?Math.round(a.wins/a.matches*100):0,form=myStatsForm(pid,discipline,10);
    const avgBreak=Number(a.breakPottedTracked||0)?(Number(a.breakPottedBalls||0)/Number(a.breakPottedTracked||0)).toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:2}):'—';
    const recent=myStatsRecentMatches(pid,discipline),disciplines=[['all','CELKEM'],['8-ball','8-BALL'],['9-ball','9-BALL'],['10-ball','10-BALL'],['14.1','14.1']];
    box.innerHTML=`
      <div class="subpanel" style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">${avatarHTML(p)}<div style="min-width:0;flex:1"><div style="font-size:24px;font-weight:950">${esc(playerDisplayName(p))}</div><div class="muted">${esc(p.name||'')}${p.club?' • '+esc(p.club):''}</div></div><div style="text-align:right"><div class="muted">ELO${discipline==='all'?'':' • '+esc(discipline.toUpperCase())}</div><div style="font-size:30px;font-weight:950;color:var(--gold2)">${elo}</div></div></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">${disciplines.map(([key,label])=>`<button class="btn ${discipline===key?'primary':''}" onclick="renderMyStats('${key}')">${label}</button>`).join('')}</div>
      <div class="grid three" style="margin-bottom:14px">
        <div class="subpanel"><div class="muted">ZÁPASY</div><div style="font-size:28px;font-weight:950">${a.matches}</div><div class="muted">rozšířeně ${a.detailedMatches||0}</div></div>
        <div class="subpanel"><div class="muted">WINRATE</div><div style="font-size:28px;font-weight:950;color:var(--gold2)">${a.matches?wr+' %':'—'}</div><div class="muted">${a.wins} V • ${a.losses} P</div></div>
        <div class="subpanel"><div class="muted">FORMA • POSLEDNÍCH 10</div><div style="font-size:28px;font-weight:950">${form.pct==null?'—':form.pct+' %'}</div><div class="muted">${form.matches?form.wins+'/'+form.matches+' výher':'bez zápasů'}</div></div>
        <div class="subpanel"><div class="muted">RACKY</div><div style="font-size:28px;font-weight:950">${a.racksFor}:${a.racksAgainst}</div><div class="muted">bez startovních handicapů</div></div>
        <div class="subpanel"><div class="muted">ÚSPĚŠNOST BREAKU</div><div style="font-size:28px;font-weight:950">${myStatsBreakPct(a)}</div><div class="muted">${a.breaks||0} evidovaných breaků</div></div>
        <div class="subpanel"><div class="muted">B&amp;R CONVERSION</div><div style="font-size:28px;font-weight:950">${myStatsBreakConversion(a)}</div><div class="muted">${a.breakAndRun||0} čistých her</div></div>
      </div>
      <div class="subpanel" style="margin-bottom:14px"><div style="font-weight:950;font-size:18px;margin-bottom:10px">DETAILNÍ STATISTIKY</div><div class="grid three">
        <div><span class="muted">Dry break</span><div style="font-size:21px;font-weight:900">${a.dryBreaks||0}</div></div><div><span class="muted">Soft break</span><div style="font-size:21px;font-weight:900">${a.softBreaks||0}</div></div><div><span class="muted">Faul z breaku</span><div style="font-size:21px;font-weight:900">${a.breakFouls||0}</div></div>
        <div><span class="muted">Ø koulí / break</span><div style="font-size:21px;font-weight:900">${avgBreak}</div></div><div><span class="muted">Eso z breaku</span><div style="font-size:21px;font-weight:900">${a.aces||0}</div></div><div><span class="muted">Dohrávky</span><div style="font-size:21px;font-weight:900">${a.runouts||0}</div></div>
        <div><span class="muted">Jistoty</span><div style="font-size:21px;font-weight:900">${a.safeties||0}</div></div><div><span class="muted">Úspěšnost jistot</span><div style="font-size:21px;font-weight:900">${pctStat(a.successfulSafeties,a.trackedSafeties)}</div></div><div><span class="muted">Úspěšnost úniků</span><div style="font-size:21px;font-weight:900">${pctStat(a.successfulSafetyEscapes,a.safetyEscapes)}</div></div>
        <div><span class="muted">RESAFE</span><div style="font-size:21px;font-weight:900">${a.resafes||0}</div></div><div><span class="muted">2-WAY</span><div style="font-size:21px;font-weight:900">${a.twoWaySuccessful||0}/${a.twoWayAttempts||0}</div></div><div><span class="muted">PUSH OUT</span><div style="font-size:21px;font-weight:900">${a.pushOuts||0}</div></div><div><span class="muted">Vrácený PUSH OUT</span><div style="font-size:21px;font-weight:900">${a.pushOutsReturned||0}</div></div>
        <div><span class="muted">Fauly</span><div style="font-size:21px;font-weight:900">${a.fouls||0}</div></div><div><span class="muted">3-foul prohry</span><div style="font-size:21px;font-weight:900">${a.threeFoulLosses||0}</div></div><div><span class="muted">Vyhraná tempa</span><div style="font-size:21px;font-weight:900">${a.lagWins||0}</div></div>
        ${(discipline==='14.1'||discipline==='all')?`<div><span class="muted">14.1 High Run</span><div style="font-size:21px;font-weight:900">${a.highRun14||0}</div></div><div><span class="muted">14.1 sólo session</span><div style="font-size:21px;font-weight:900">${a.soloSessions14||0}</div></div>`:''}
      </div><div class="muted" style="margin-top:10px">Detailní herní statistiky se počítají pouze ze zápasů vedených přes rozšířené počítadlo. Výsledky, W/L, ELO a racky zahrnují i základní evidenci.</div></div>
      <div class="subpanel"><div style="font-weight:950;font-size:18px;margin-bottom:10px">POSLEDNÍ ZÁPASY</div>${recent.length?recent.map(f=>myStatsFactLine(f,pid)).join(''):'<div class="empty">V této disciplíně zatím nejsou uložené zápasy.</div>'}</div>`;
  }
  window.renderMyStats=renderMyStats;

function renderStats(){
    const ps=Object.values(data.players).filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true);
    if(!ps.length){
      $('statsView').innerHTML='<div class="empty">Zatím nejsou žádná data.</div>';
      $('h2hPlayer1').innerHTML='';
      $('h2hPlayer2').innerHTML='';
      $('h2hView').innerHTML='<div class="empty">Nejdřív je potřeba mít alespoň dva hráče.</div>';
      return;
    }

    const eloRatings=calculateEloRatings();
    const rows=ps.map(p=>({p,s:playerAggregate(p.id),elo:eloRatings[p.id]??ELO_START})).sort((a,b)=>b.elo-a.elo || b.s.wins-a.s.wins);
    const normalTable=`<div class="subpanel" style="margin-bottom:12px">
      <div style="font-weight:950;margin-bottom:5px">INFORMAČNÍ PŘEHLED</div>
      <div class="muted">
        Toto není oficiální žebříček hráčů. Jde pouze o statistický přehled všech hráčů, u kterých byl do aplikace zaznamenán výsledek zápasu nebo turnaje. Přehled slouží výhradně ke statistickým a analytickým účelům.<br><br>
        Ve statistikách se mohou zobrazovat také hráči, kteří zatím nemají vytvořený vlastní profil v aplikaci. Jakmile je jejich profil později založen a správně přiřazen, dříve zaznamenané výsledky a statistiky se k hráči zpětně přiřadí.<br><br>
        <strong>Výsledkové údaje</strong> (zápasy, výhry/prohry, ELO a racková bilance) používají všechny evidované zápasy. <strong>Detailní herní statistiky</strong> (break, jistoty, úniky, RESAFE, B&amp;R conversion apod.) se počítají pouze ze zápasů vedených přes <strong>ROZŠÍŘENÉ POČÍTADLO</strong>.
      </div>
    </div>
    <div class="muted" style="margin-bottom:8px">ELO začíná na ${ELO_START} • K=${ELO_K} • počítají se pouze dokončené zápasy hráč vs hráč.</div>
    <div style="overflow:auto"><table class="stats-table">
      <thead><tr><th>Hráč</th><th>ELO</th><th>Zápasy</th><th>Rozšířeně</th><th>V</th><th>P</th><th>+/-</th><th>Breaky</th><th>Faul z breaku</th><th>Dry break</th><th>Soft break</th><th>Úspěšnost breaku</th><th>Koule z breaku</th><th>Ø / break</th><th>Eso</th><th>Čisté</th><th>Dohrávky</th><th>Jistoty</th><th>Úspěšnost jistot</th><th>Úspěšnost úniků z jistot</th><th>RESAFE</th><th>14.1 sólo</th><th>14.1 HR</th></tr></thead>
      <tbody>${rows.map(x=>{
        const breakPct=x.s.breaks
          ? Math.round(Math.max(0,(x.s.breaks-(x.s.dryBreaks||0)-(x.s.softBreaks||0)+(x.s.softDryBreaks||0)-(x.s.breakFouls||0)))/x.s.breaks*100)+' %'
          : '—';
        return `<tr>
        <td><strong>${esc(x.p.name)}</strong></td>
        <td class="num"><strong style="color:var(--gold2)">${x.elo}</strong></td>
        <td class="num">${x.s.matches}</td><td class="num">${x.s.detailedMatches||0}</td><td class="num">${x.s.wins}</td><td class="num">${x.s.losses}</td>
        <td class="num">${x.s.racksFor}:${x.s.racksAgainst}</td>
        <td class="num">${x.s.breaks||0}</td><td class="num">${x.s.breakFouls||0}</td><td class="num">${x.s.dryBreaks||0}</td><td class="num">${x.s.softBreaks||0}</td><td class="num">${breakPct}</td>
        <td class="num">${x.s.breakPottedTracked?x.s.breakPottedBalls:'—'}</td><td class="num">${x.s.breakPottedTracked?(x.s.breakPottedBalls/x.s.breakPottedTracked).toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:2}):'—'}</td>
        <td class="num">${x.s.aces||0}</td><td class="num">${x.s.breakAndRun}</td><td class="num">${x.s.runouts}</td><td class="num">${x.s.safeties}</td>
        <td class="num">${x.s.trackedSafeties?Math.round((x.s.successfulSafeties||0)/x.s.trackedSafeties*100)+' %':'—'}</td>
        <td class="num">${safetyEscapePct(x.s)}</td><td class="num">${x.s.resafes||0}</td>
        <td class="num">${x.s.soloSessions14||0}</td><td class="num">${x.s.highRun14||0}</td>
      </tr>`;}).join('')}</tbody></table></div>
    <div class="subpanel" style="margin-top:10px">
      <strong>VYSVĚTLIVKY KE STATISTIKÁM</strong>
      <div class="muted" style="margin-top:7px;line-height:1.55">
        <strong>ELO</strong> = výkonnostní rating hráče •
        <strong>V</strong> = výhry •
        <strong>P</strong> = prohry •
        <strong>+/-</strong> = vyhrané : prohrané racky •
        <strong>Faul z breaku</strong> = faul při rozstřelu •
        <strong>Dry break</strong> = z rozstřelu nepadla žádná koule •
        <strong>Soft break</strong> = neplatný / nedostatečný rozstřel podle nastaveného pravidla •
        <strong>Eso</strong> = devítka potopená přímo z platného rozstřelu v 9-ballu •
        <strong>Koule z breaku</strong> = součet potopených koulí z evidovaných rozstřelů; Ø / break = průměr na evidovaný rozstřel •
        <strong>RESAFE</strong> = úspěšný únik z jistoty zakončený novou úspěšnou jistotou •
        <strong>Čisté</strong> = Break &amp; Run / čistá hra •
        <strong>Dohrávky</strong> = dohrání stolu po soupeřově dry breaku, faulu z breaku nebo po vráceném push outu •
        <strong>Faul z breaku</strong> = samostatně evidovaný faul při rozstřelu •
        <strong>Jistoty</strong> = zahrané safety •
        <strong>14.1 HR</strong> = High Run, nejvyšší náběh v 14.1.
      </div>
    </div>`;

    const ghostRows=ps
      .map(p=>({p,g:ghostAggregate(p.id)}))
      .filter(x=>x.g.sessions>0)
      .sort((a,b)=>b.g.sessions-a.g.sessions);

    const ghostTable=ghostRows.length
      ? `<h3 style="margin:24px 0 10px">GHOST STATISTIKY</h3>
        <div class="muted" style="margin-bottom:10px">
          Tyto výsledky jsou vedené samostatně a neovlivňují zápasy, výhry/prohry ani H2H mezi reálnými hráči.
        </div>
        <div style="overflow:auto"><table class="stats-table">
          <thead><tr>
            <th>Hráč</th><th>Sessions</th><th>8-ball</th><th>9-ball</th><th>10-ball</th>
            <th>Body H:G</th><th>Racky</th><th>Čistě +2</th><th>BIH +1</th><th>Nedohráno</th><th>Suchý break</th><th>Nejčastěji skončil</th><th>Koule</th>
          </tr></thead>
          <tbody>${ghostRows.map(x=>`<tr>
            <td><strong>${esc(x.p.name)}</strong></td>
            <td class="num">${x.g.sessions}</td>
            <td class="num">${x.g.byDiscipline['8-ball']}</td>
            <td class="num">${x.g.byDiscipline['9-ball']}</td>
            <td class="num">${x.g.byDiscipline['10-ball']}</td>
            <td class="num">${x.g.playerPoints}:${x.g.ghostPoints}</td>
            <td class="num">${x.g.racks}</td>
            <td class="num">${x.g.clean}</td>
            <td class="num">${x.g.bih}</td>
            <td class="num">${x.g.failed}</td>
            <td class="num">${x.g.dry}</td>
            <td class="num">${x.g.mostCommonBall?'#'+x.g.mostCommonBall.ball+' ('+x.g.mostCommonBall.count+'×)':'—'}</td>
            <td>${esc(x.g.ballBreakdown||'—')}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        <div class="subpanel" style="margin-top:10px">
          <strong>VYSVĚTLIVKY • GHOST</strong>
          <div class="muted" style="margin-top:7px;line-height:1.55">
            <strong>Sessions</strong> = počet dokončených Ghost session •
            <strong>H:G</strong> = body hráče : body Ghosta •
            <strong>BIH</strong> = Ball in Hand, dohrání s koulí v ruce na první strk •
            <strong>Čistě +2</strong> = čisté dohrání bez Ball in Hand za 2 body •
            <strong>Nedohráno</strong> = rack získal Ghost •
            <strong>Nejčastěji skončil</strong> = koule, na které hráč v 9-ball / 10-ball nejčastěji nedohrál rack •
            <strong>Koule</strong> = dlouhodobý rozpad všech evidovaných koncových koulí •
            <strong>Suchý break</strong> = dry break, z rozstřelu nepadla koule.
          </div>
        </div>`
      : `<h3 style="margin:24px 0 10px">GHOST STATISTIKY</h3>
         <div class="empty">Zatím není uložená žádná dokončená Ghost session.</div>`;

    $('statsView').innerHTML=normalTable+ghostTable;

    populateH2HPlayers();
    renderH2H();
    renderTournamentStats();
  }

  function populateH2HPlayers(){
    const ps=Object.values(data.players||{})
      .filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)
      .sort((a,b)=>
        String(a.club||'').localeCompare(String(b.club||''),'cs') ||
        playerDisplayName(a).localeCompare(playerDisplayName(b),'cs') ||
        String(a.identifier||'').localeCompare(String(b.identifier||''),'cs')
      );

    const s1=$('h2hPlayer1'), s2=$('h2hPlayer2');
    if(!s1 || !s2)return;

    const old1=s1.value, old2=s2.value;

    s1.innerHTML=ps.map(p=>`<option value="${p.id}">${esc(playerSelectionLabel(p))}</option>`).join('');
    s2.innerHTML=ps.map(p=>`<option value="${p.id}">${esc(playerSelectionLabel(p))}</option>`).join('');

    const old1Visible=!!ps.find(p=>p.id===old1);
    const old2Visible=!!ps.find(p=>p.id===old2);

    if(old1Visible) s1.value=old1;
    if(old2Visible) s2.value=old2;

    if(ps.length>=1 && !old1Visible){
      s1.value=ps[0].id;
    }

    if(ps.length>=2){
      if(!old2Visible || s2.value===s1.value){
        const other=ps.find(p=>p.id!==s1.value);
        if(other) s2.value=other.id;
      }
    }else if(ps.length===1){
      s2.value=ps[0].id;
    }
  }

  function aggregateH2H(p1id,p2id,discipline='all'){
    const matches=data.matches.filter(m=>{
      if((m.status||'complete')!=='complete') return false;
      if(m.solo14 || m.ghostMode || m.winnerTableMode) return false;
      if(!m.playerIds.includes(p1id) || !m.playerIds.includes(p2id)) return false;
      if(discipline!=='all' && m.discipline!==discipline) return false;
      return true;
    });

    const out={
      matches:matches.length,
      p1:{wins:0,racks:0,breaks:0,dryBreaks:0,breakAndRun:0,runouts:0,fouls:0,breakFouls:0,safeties:0,successfulSafeties:0,trackedSafeties:0,safetyEscapes:0,successfulSafetyEscapes:0,misses:0,matchOnlyMisses:0,matchOnlyMissBadPosition:0,matchOnlyMissPot:0,threeFoulLosses:0},
      p2:{wins:0,racks:0,breaks:0,dryBreaks:0,breakAndRun:0,runouts:0,fouls:0,breakFouls:0,safeties:0,successfulSafeties:0,trackedSafeties:0,safetyEscapes:0,successfulSafetyEscapes:0,misses:0,matchOnlyMisses:0,matchOnlyMissBadPosition:0,matchOnlyMissPot:0,threeFoulLosses:0},
      history:[]
    };

    matches.forEach(m=>{
      const i1=m.playerIds.indexOf(p1id), i2=m.playerIds.indexOf(p2id);
      const actual=actualRackScores(m);
      out.p1.racks+=actual[i1]||0;
      out.p2.racks+=actual[i2]||0;

      if(m.winner===i1) out.p1.wins++;
      if(m.winner===i2) out.p2.wins++;

      ['breaks','dryBreaks','breakAndRun','runouts','fouls','breakFouls','safeties','successfulSafeties','trackedSafeties','safetyEscapes','successfulSafetyEscapes','threeFoulLosses'].forEach(k=>{
        const s1=(m.stats && m.stats[i1]) ? m.stats[i1] : null;
        const s2=(m.stats && m.stats[i2]) ? m.stats[i2] : null;

        if(k==='breaks' || k==='dryBreaks'){
          if(s1 && Object.prototype.hasOwnProperty.call(s1,'dryBreaks')){
            out.p1[k]+=Number(s1[k]||0);
          }
          if(s2 && Object.prototype.hasOwnProperty.call(s2,'dryBreaks')){
            out.p2[k]+=Number(s2[k]||0);
          }
          return;
        }

        out.p1[k]+=Number(s1?.[k]||0);
        out.p2[k]+=Number(s2?.[k]||0);
      });

      out.history.push({
        id:m.id,
        startedAt:m.startedAt,
        discipline:m.discipline,
        p1score:m.scores[i1]||0,
        p2score:m.scores[i2]||0,
        winner:m.winner===i1?1:(m.winner===i2?2:0)
      });
    });

    out.history.sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
    return out;
  }

  function renderH2H(){
    const p1id=$('h2hPlayer1').value, p2id=$('h2hPlayer2').value;
    const discipline=$('h2hDiscipline').value;
    const box=$('h2hView');

    if(!p1id || !p2id){
      box.innerHTML='<div class="empty">Vyber dva hráče.</div>';
      return;
    }
    if(p1id===p2id){
      box.innerHTML='<div class="empty">Pro vzájemnou bilanci vyber dva různé hráče.</div>';
      return;
    }

    const p1=data.players[p1id], p2=data.players[p2id];
    if(!p1 || !p2) return;

    const h=aggregateH2H(p1id,p2id,discipline);
    if(!h.matches){
      box.innerHTML=`<div class="empty">${esc(p1.name)} a ${esc(p2.name)} nemají v tomto výběru žádný dokončený vzájemný zápas.</div>`;
      return;
    }

    const p1pct=((h.p1.wins/h.matches)*100).toFixed(1);
    const p2pct=((h.p2.wins/h.matches)*100).toFixed(1);

    box.innerHTML=`
      <div class="grid two">
        <div class="player-item" style="text-align:center">
          <div style="display:flex;justify-content:center;margin-bottom:8px">${avatarHTML(p1)}</div>
          <strong style="font-size:20px">${esc(p1.name)}</strong>
          <div class="history-score" style="font-size:34px;margin-top:8px">${h.p1.wins}</div>
          <div class="muted">výher • ${p1pct}%</div>
        </div>
        <div class="player-item" style="text-align:center">
          <div style="display:flex;justify-content:center;margin-bottom:8px">${avatarHTML(p2)}</div>
          <strong style="font-size:20px">${esc(p2.name)}</strong>
          <div class="history-score" style="font-size:34px;margin-top:8px">${h.p2.wins}</div>
          <div class="muted">výher • ${p2pct}%</div>
        </div>
      </div>

      <div class="player-item" style="margin-top:12px">
        <div class="history-line">
          <strong>Vzájemná bilance</strong>
          <div class="history-score">${h.p1.wins} : ${h.p2.wins}</div>
        </div>
        <div class="history-line" style="margin-top:8px">
          <span class="muted">Racky / body</span>
          <strong>${h.p1.racks} : ${h.p2.racks}</strong>
        </div>
        <div class="muted" style="margin-top:8px">${h.matches} dokončených vzájemných zápasů</div>
      </div>

      <div style="overflow:auto;margin-top:12px">
        <table class="stats-table">
          <thead><tr><th>Statistika</th><th>${esc(p1.name)}</th><th>${esc(p2.name)}</th></tr></thead>
          <tbody>
            <tr><td>Breaky</td><td class="num">${h.p1.breaks}</td><td class="num">${h.p2.breaks}</td></tr>
            <tr><td>Faul z breaku</td><td class="num">${h.p1.breakFouls||0}</td><td class="num">${h.p2.breakFouls||0}</td></tr>
            <tr><td>Dry break</td><td class="num">${h.p1.dryBreaks}</td><td class="num">${h.p2.dryBreaks}</td></tr>
            <tr><td>Úspěšnost breaku</td>
              <td class="num">${h.p1.breaks?Math.round(Math.max(0,h.p1.breaks-h.p1.dryBreaks)/h.p1.breaks*100)+' %':'—'}</td>
              <td class="num">${h.p2.breaks?Math.round(Math.max(0,h.p2.breaks-h.p2.dryBreaks)/h.p2.breaks*100)+' %':'—'}</td>
            </tr>
            <tr><td>Break & Run</td><td class="num">${h.p1.breakAndRun}</td><td class="num">${h.p2.breakAndRun}</td></tr>
            <tr><td>Runout</td><td class="num">${h.p1.runouts}</td><td class="num">${h.p2.runouts}</td></tr>
            <tr><td>Safety</td><td class="num">${h.p1.safeties}</td><td class="num">${h.p2.safeties}</td></tr>
          </tbody>
        </table>
      </div>

      <h3 style="margin:18px 0 10px">Poslední vzájemné zápasy</h3>
      ${h.history.slice(0,10).map(x=>{
        const d=new Date(x.startedAt).toLocaleDateString('cs-CZ');
        return `<div class="history-item">
          <div class="history-line">
            <div><strong>${esc(x.discipline.toUpperCase())}</strong><div class="muted">${esc(d)}</div></div>
            <div class="history-score">${x.p1score} : ${x.p2score}</div>
          </div>
        </div>`;
      }).join('')}
    `;
  }

  $('h2hPlayer1').addEventListener('change',()=>{
    if($('h2hPlayer1').value===$('h2hPlayer2').value){
      const other=Object.values(data.players).find(p=>
        p && p.active!==false && p.hiddenFromPlayers!==true && p.id!==$('h2hPlayer1').value
      );
      if(other) $('h2hPlayer2').value=other.id;
    }
    renderH2H();
  });
  $('h2hPlayer2').addEventListener('change',renderH2H);
  $('h2hDiscipline').addEventListener('change',renderH2H);

  $('exportBtn').onclick=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='BC_Rybarna_Scoreboard_Backup_'+new Date().toISOString().slice(0,10)+'.json';
    a.click(); URL.revokeObjectURL(a.href);
  };
  $('importFile').addEventListener('change',async e=>{
    const f=(e.target.files && e.target.files[0]); if(!f) return;
    try{
      const parsed=JSON.parse(await f.text());
      if(!parsed || !parsed.players || !Array.isArray(parsed.matches)) throw new Error('bad');
      data=parsed; saveData(); renderStats(); refreshPlayerList(); toast('Data importována.');
    }catch(err){ toast('Import se nepodařil.'); }
    e.target.value='';
  });

  refreshPlayerList();
  updateDisciplineSetup();
  try{ renderTournament(); }catch(e){}
  if(match && match.discipline==='14.1' && match.ballsOnTable==null) match.ballsOnTable=15;
  if(match && match.discipline==='14.1' && match.reracksInInning14==null) match.reracksInInning14=0;
  if(match && match.streamEnabled==null) match.streamEnabled=false;
  if(match && !match.streamMode) match.streamMode='live';
  if(match && match.streamMatchTitle==null) match.streamMatchTitle='';
  if(match && match.ghostMode && (match.discipline==='9-ball'||match.discipline==='10-ball') && match.ghostBallCount==null){
    match.ghostBallCount=ghostFullBallCountForDiscipline(match.discipline);
  }
  if(match && match.isBreakShot==null) match.isBreakShot=false;
  if(match && match.discipline==='14.1' && !match.consecutiveFouls14) match.consecutiveFouls14=[0,0];
  if(match && match.discipline==='14.1' && match.openingBreakAvailable14==null) match.openingBreakAvailable14=false;
  if(match && !match.endedAt){
    showScreen('match');
    if(match.useClock) resetClock(false,false);
    renderMatch();
    toast('Obnoven rozehraný zápas.');
  }

  // Připojení ke cloudu proběhne až po inicializaci lokálního UI.
  setTimeout(autoCloudInit,150);

  // LIVE indikátor musí fungovat i bez otevření obrazovky Livescore.
  // Po startu počkáme na Firebase Auth a hned načteme aktivní LIVE zápasy.
  async function refreshLiveNavInBackground(force=false){
    try{
      await loadCloudLiveMatches(force);
    }catch(e){}
    try{updateLiveNavStatus();}catch(e){}
  }

  setTimeout(()=>refreshLiveNavInBackground(true),900);

  try{updateLoggedInUserBadge();}catch(e){}
  if(match && !match.endedAt){ try{startLiveHeartbeat();}catch(e){} }
  try{updateLiveNavStatus();}catch(e){}

  if(!liveRefreshTimer){
    liveRefreshTimer=setInterval(async()=>{
      const liveScreen=$('screen-live');
      const modal=$('liveScoreModal');
      const liveVisible=!!(liveScreen && liveScreen.classList.contains('active'));
      const modalVisible=!!(modal && modal.classList.contains('show'));

      // Stav horního LIVESCORE tlačítka hlídáme i mimo Livescore obrazovku.
      // Cloud se na pozadí dotazuje jednou za 15 s; při otevřeném Livescore okamžitě.
      const shouldBackgroundPoll=(Date.now()-liveLastCloudPollAt)>=15000;
      if(liveVisible || modalVisible || shouldBackgroundPoll){
        try{
          await loadCloudLiveMatches(liveVisible || modalVisible);
        }catch(e){}
      }

      updateLiveNavStatus();
      if(liveVisible)renderLive();
      if(modalVisible)renderLiveScoreModal();
    },1000);
  }

  // ===== MODERN TEST DASHBOARD BRIDGE =====
  // Bezpečně zpřístupní pouze data potřebná pro testovací domovskou stránku.
  window.getModernDashboardSnapshot=function(){
    try{
      const rawPlayers=(data && data.players && typeof data.players==='object') ? data.players : {};
      let ratings={};
      try{ratings=calculateEloRatings()||{};}catch(e){ratings={};}

      const players=Object.keys(rawPlayers).map(id=>{
        const p=rawPlayers[id];
        if(!p || p.active===false || p.hiddenFromPlayers===true)return null;
        let displayName=String(p.name||p.nickname||'Hráč');
        try{
          const n=playerDisplayName(p);
          if(n)displayName=String(n);
        }catch(e){}
        let aggregate={matches:0,wins:0};
        try{aggregate=playerAggregate(p.id||id)||aggregate;}catch(e){}
        let elo=1500;
        try{
          const v=ratings[p.id||id];
          if(Number.isFinite(Number(v)))elo=Number(v);
        }catch(e){}
        return {
          id:String(p.id||id),
          name:displayName,
          elo:elo,
          matches:Number(aggregate.matches||0),
          wins:Number(aggregate.wins||0)
        };
      }).filter(Boolean).sort((a,b)=>b.elo-a.elo || b.wins-a.wins || a.name.localeCompare(b.name,'cs'));

      const rawMatches=Array.isArray(data?.matches)?data.matches:[];
      const recentMatches=rawMatches
        .filter(m=>m && !['playing','active'].includes(m.status))
        .slice()
        .sort((a,b)=>new Date(b.endedAt||b.startedAt||b.createdAt||0)-new Date(a.endedAt||a.startedAt||a.createdAt||0))
        .slice(0,5)
        .map(m=>{
          let p1=String(m.playerNames?.[0]||'Hráč 1');
          let p2=String(m.playerNames?.[1]||'Hráč 2');
          let displayMode='duel';

          if(m.winnerTableMode){
            displayMode='winner-table';
            p1='VÍTĚZ NA STOLE';
            p2=String(m.discipline||'');
          }else if(m.ghostMode){
            displayMode='ghost';
            p2='GHOST';
          }else if(m.solo14){
            displayMode='solo14';
            p2='SÓLO 14.1';
          }else{
            try{
              p1=String(savedMatchSideDisplayName(m,0)||p1);
              p2=String(savedMatchSideDisplayName(m,1)||p2);
            }catch(e){}
          }

          return {
            id:String(m.id||''),
            p1:p1,
            p2:p2,
            s1:Number(m.scores?.[0]||0),
            s2:Number(m.scores?.[1]||0),
            discipline:String(m.discipline||''),
            displayMode:displayMode
          };
        });

      const completed=rawMatches.filter(m=>m && !['playing','active'].includes(m.status) && (m.status||'complete')==='complete');
      const disciplines={};
      completed.forEach(m=>{
        const d=String(m.discipline||'—');
        disciplines[d]=(disciplines[d]||0)+1;
      });
      const mostPlayed=Object.entries(disciplines).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';

      let isAdmin=false;
      try{isAdmin=!!currentUserIsSystemAdmin();}catch(e){}

      return {
        ok:true,
        cloudAuthenticated:!!cloudAuthenticated,
        activeMatch:match ? {
          score1:Number(match.scores?.[0]||0),
          score2:Number(match.scores?.[1]||0)
        } : null,
        isSystemAdmin:isAdmin,
        players:players,
        recentMatches:recentMatches,
        stats:{
          completedMatches:completed.length,
          activePlayers:players.length,
          mostPlayedDiscipline:String(mostPlayed),
          tournaments:Array.isArray(data?.tournaments)?data.tournaments.length:0
        }
      };
    }catch(e){
      console.error('Modern dashboard snapshot failed:',e);
      return {
        ok:false,
        error:String((e&&e.message)?e.message:e),
        cloudAuthenticated:false,
        activeMatch:null,
        isSystemAdmin:false,
        players:[],
        recentMatches:[],
        stats:{completedMatches:0,activePlayers:0,mostPlayedDiscipline:'—',tournaments:0}
      };
    }
  };
  window.refreshModernDashboardCloud=async function(){
    if(!cloudAuthenticated)return window.getModernDashboardSnapshot();
    const jobs=[loadSecurePlayers(),loadSecureMatches(),loadSecureTournaments()];
    if(typeof window.refreshMatchChallenges==='function')jobs.push(window.refreshMatchChallenges(false));
    await Promise.allSettled(jobs);
    return window.getModernDashboardSnapshot();
  };

  window.openModernDashboardPlayer=function(id){
    try{openPlayerProfile(id);}catch(e){console.warn(e);}
  };
  window.openModernDashboardMatch=function(id){
    try{showSavedMatchStats(id);}catch(e){console.warn(e);}
  };

(function(){
  var cache=[];
  var counterChallengeId=null;
  var LOCAL_KEY='poolcitadlo_match_challenges_cache_v1';

