  function dkoFinalMatch(t){
    if(!t?.dko?.rounds)return null;
    for(const r of t.dko.rounds){
      const m=(r.matches||[]).find(x=>x.bracket==='GF');
      if(m)return m;
    }
    return null;
  }

  function dkoUpdateCompletion(t){
    if(!t?.dko)return;
    // Po přechodu DKO → SKO už turnaj dokončuje SKO větev, ne starý DKO Grand Final.
    if(t.ko)return;
    const gf=dkoFinalMatch(t);
    const third=dkoThirdPlaceMatch(t);

    const gfDone=!!(gf && (gf.status==='done'||gf.winnerId));
    const thirdRequired=!!t.dko.thirdPlacePlayoff;
    const thirdDone=!thirdRequired || !!(third && (third.status==='done'||third.winnerId));

    if(gfDone && thirdDone && t.dko.championId){
      t.status='complete';
    }else{
      t.status='active';
    }
  }

  function dkoRegisterElimination(t,playerId,matchId){
    if(!t.dko.eliminations) t.dko.eliminations=[];
    const existing=t.dko.eliminations.find(x=>x.playerId===playerId);
    if(existing) return existing.place;
    const activeAfter=(t.dko.participantIds||t.playerIds||[]).filter(id=>(t.dko.losses[id]||0)<2).length;
    const place=activeAfter+1;
    t.dko.eliminations.push({playerId,place,matchId,at:new Date().toISOString()});
    return place;
  }

  function dkoResultHtml(t,tm,winnerId,loserId,loserLossesBefore,eliminationPlace=null){
    const winner=tournamentPlayerName(winnerId,t);
    const loser=tournamentPlayerName(loserId,t);
    const winnerLosses=t.dko.losses[winnerId]||0;
    const loserLosses=t.dko.losses[loserId]||0;

    if(tm.bracket==='GF'){
      return `<div><strong>${esc(winner)}</strong> vítězí v Grand Final a stává se <strong>VÍTĚZEM TURNAJE</strong>.</div>
              <div style="margin-top:10px"><strong>${esc(loser)}</strong> končí na <strong>2. místě</strong>.</div>`;
    }

    if(tm.bracket==='3P'){
      return `<div><strong>${esc(winner)}</strong> vítězí v zápase o 3. místo a končí na <strong>3. místě</strong>.</div>
              <div style="margin-top:10px"><strong>${esc(loser)}</strong> končí na <strong>4. místě</strong>.</div>`;
    }

    const winnerSide=winnerLosses===0?'A straně':'B straně';
    let loserText='';
    if(loserLosses>=2){
      const placementText=dkoPlacementLabel(t,eliminationPlace,loserId);
      loserText=`<strong>${esc(loser)}</strong> prohrává podruhé, <strong>vypadává z hlavního DKO pavouka</strong> a má pořadí <strong>${esc(placementText)}</strong>.`;
    }else if(loserLossesBefore===0 && loserLosses===1){
      loserText=`<strong>${esc(loser)}</strong> zaznamenává první prohru a přesouvá se do <strong>B strany pavouka</strong>.`;
    }else{
      loserText=`<strong>${esc(loser)}</strong> zůstává v <strong>B straně pavouka</strong>.`;
    }

    return `<div><strong>${esc(winner)}</strong> vítězí a postupuje dál v <strong>${winnerSide} pavouka</strong>.</div>
            <div style="margin-top:10px">${loserText}</div>`;
  }

  function groupResultHtml(t,winnerId,loserId){
    const winner=tournamentPlayerName(winnerId,t);
    const loser=tournamentPlayerName(loserId,t);
    return `<div><strong>${esc(winner)}</strong> vítězí a připisuje si výhru do tabulky skupiny.</div>
            <div style="margin-top:10px"><strong>${esc(loser)}</strong> si připisuje porážku.</div>
            <div class="muted" style="margin-top:10px">Pořadí skupiny bylo automaticky přepočítáno.</div>`;
  }


  function applyFinishedMatchToTournament(scoreMatch){
    const link=scoreMatch?.tournamentLink;
    if(!link)return null;

    const t=(data.tournaments||[]).find(x=>x.id===link.tournamentId);
    if(!t)return null;

    const tm=findTournamentMatch(t,link.tournamentMatchId);
    if(!tm)return null;

    tm.status='done';
    tm.tableNumber=null;
    tm.resumable=false;
    tm.finishedAt=scoreMatch.endedAt||new Date().toISOString();
    tm.scoreboardMatchId=scoreMatch.id;
    tm.score1=scoreMatch.scores?.[0]??tm.score1;
    tm.score2=scoreMatch.scores?.[1]??tm.score2;

    if(scoreMatch.winner===0||scoreMatch.winner===1){
      tm.winnerId=scoreMatch.playerIds?.[scoreMatch.winner]||tm.winnerId;
      tm.loserId=scoreMatch.playerIds?.[1-scoreMatch.winner]||tm.loserId;
    }

    return {t,tm};
  }

  function finalizeSKOIfResolved(t,tm){
    if(!t?.ko || !tm)return false;

    const k=ensureSKOState(t);
    if(!k)return false;
    const participants=k.participantIds||t.playerIds||[];
    const active=participants.filter(id=>!(k.eliminatedIds||[]).includes(id));

    // Pokud je po právě dohraném SKO zápase jediný aktivní hráč,
    // je turnaj rozhodnutý bez ohledu na historické označení kola/bracketu.
    if(active.length===1 && tm.winnerId===active[0]){
      k.championId=tm.winnerId;
      k.runnerUpId=tm.loserId||k.runnerUpId||null;

      if(k.thirdPlacePlayoff){
        const bronze=knockoutThirdMatch(t);
        t.status=(bronze && (bronze.status==='done'||bronze.winnerId)) ? 'complete' : 'active';
      }else{
        t.status='complete';
      }

      assignTournamentTables(t);
      return true;
    }
    return false;
  }

  function processTournamentResult(scoreMatch){
    const applied=applyFinishedMatchToTournament(scoreMatch);
    if(!applied)return null;
    const {t,tm}=applied;

    const isGroupMatch=tournamentHasGroups(t) && (t.groups||[]).some(g=>(g.matches||[]).some(m=>m.id===tm.id));

    if(isGroupMatch){
      let penaltyPending=false;
      if(groupPhaseComplete(t)){
        penaltyPending=!!unresolvedGroupPenaltyTie(t);

        if(t.format==='groups'){
          // Čisté "každý s každým" končí dohráním skupiny/skupin.
          t.status='complete';
        }else{
          // Skupiny → SKO/DKO se už NIKDY nenasadí automaticky.
          // Po posledním skupinovém zápasu zůstane turnaj aktivní a čeká na volbu pořadatele.
          t.status='active';
          t.awaitingPlayoffSeeding=true;
          t.playoffStarted=false;
          if(!t.ko && !t.dko){
            t.groupEliminations=[];
          }
        }
      }else{
        t.status='active';
        assignTournamentTables(t);
      }

      showTournamentResultMessage(
        t.name+' • '+(tm.roundLabel||'Skupina'),
        groupResultHtml(t,tm.winnerId,tm.loserId)+
        (t.format!=='groups' && groupPhaseComplete(t)
          ? '<div class="muted" style="margin-top:10px"><strong>Skupiny jsou dohrané.</strong> Turnaj čeká na nasazení postupujících do play-off.</div>'
          : (penaltyPending
              ? '<div class="muted" style="margin-top:10px">O pořadí musí ještě rozhodnout penalty.</div>'
              : ''))
      );
      return t;
    }

    const isSwissRoundMatch=t.format==='swiss' && t.swiss &&
      (t.swiss.rounds||[]).some(r=>(r.matches||[]).some(m=>m.id===tm.id));

    if(isSwissRoundMatch){
      const round=swissCurrentRound(t);
      const finishedRound=!!(round && swissRoundComplete(round));

      if(finishedRound){
        swissAdvanceIfReady(t);
      }else{
        assignTournamentTables(t);
      }

      const st=swissStandings(t);
      const winnerRow=st.find(r=>r.id===tm.winnerId);

      showTournamentResultMessage(
        t.name+' • '+(tm.roundLabel||'Švýcarský systém'),
        `<div><strong>${esc(tournamentPlayerName(tm.winnerId,t))}</strong> získává bod.</div>
         ${winnerRow?`<div class="muted" style="margin-top:8px">Průběžně: ${winnerRow.place}. místo • ${winnerRow.points} bodů.</div>`:''}
         ${t.status==='complete'
           ? `<div class="muted" style="margin-top:10px">Všechna kola jsou dohrána. Turnaj je dokončen.</div>
              ${swissFinalRecapHtml(t)}`
           : (t.swiss.playoffStarted && t.ko
              ? `<div class="muted" style="margin-top:10px">Švýcarská část je dohrána. Do SKO postupuje ${t.swiss.qualifierCount||t.swiss.advanceToSko} hráčů.</div>`
              : (finishedRound?`<div class="muted" style="margin-top:10px">Bylo vytvořeno ${t.swiss.currentRound}. kolo.</div>`:''))}`
      );
      return t;
    }

    if(t.ko){
      const k=ensureSKOState(t);
      if(!k)return t;

      if(tm.bracket==='3P'){
        k.thirdPlaceWinnerId=tm.winnerId;
        k.thirdPlaceLoserId=tm.loserId;
        if(k.championId)t.status='complete';
        assignTournamentTables(t);
        showTournamentResultMessage(
          t.name+' • ZÁPAS O 3. MÍSTO',
          `<div><strong>${esc(tournamentPlayerName(tm.winnerId,t))}</strong> končí na <strong>3. místě</strong>.</div>
           <div style="margin-top:10px"><strong>${esc(tournamentPlayerName(tm.loserId,t))}</strong> končí na <strong>4. místě</strong>.</div>`
        );
        return t;
      }

      if(tm.bracket==='F'){
        if(!k.eliminatedIds.includes(tm.loserId))k.eliminatedIds.push(tm.loserId);
        knockoutRegisterElimination(t,tm.loserId,tm.id);
        k.championId=tm.winnerId;
        k.runnerUpId=tm.loserId;
        if(!k.thirdPlacePlayoff || knockoutThirdMatch(t)?.status==='done')t.status='complete';
        else t.status='active';
        forceFinalizeTournamentIfResolved(t,tm);
        assignTournamentTables(t);
        showTournamentResultMessage(
          t.name+' • FINÁLE',
          `<div><strong>${esc(tournamentPlayerName(tm.winnerId,t))}</strong> je <strong>VÍTĚZEM TURNAJE</strong>.</div>
           <div style="margin-top:10px"><strong>${esc(tournamentPlayerName(tm.loserId,t))}</strong> končí na <strong>2. místě</strong>.</div>`
        );
        return t;
      }

      if(!k.eliminatedIds.includes(tm.loserId))k.eliminatedIds.push(tm.loserId);
      const place=knockoutRegisterElimination(t,tm.loserId,tm.id);

      // Nejdřív ověříme skutečný stav pavouka. Tím opravíme i starší turnaje,
      // kde poslední zápas mohl být uložen jako KO místo F.
      const resolvedAsFinal=finalizeSKOIfResolved(t,tm);
      if(resolvedAsFinal){
        forceFinalizeTournamentIfResolved(t,tm);
        showTournamentResultMessage(
          t.name+' • FINÁLE',
          `<div><strong>${esc(tournamentPlayerName(tm.winnerId,t))}</strong> je <strong>VÍTĚZEM TURNAJE</strong>.</div>
           <div style="margin-top:10px"><strong>${esc(tournamentPlayerName(tm.loserId,t))}</strong> končí na <strong>2. místě</strong>.</div>`
        );
        return t;
      }

      const allFinished=(k.rounds||[]).flatMap(r=>r.matches||[]).every(m=>m.status==='done'||m.winnerId||m.loserId);
      if(allFinished)knockoutCreateWave(t);

      // Po vytvoření další vlny ještě jednou ověříme, zda se turnaj mezitím
      // neuzavřel přes knockoutCreateWave.
      if(t.status==='complete' && k.championId){
        if(!k.runnerUpId)k.runnerUpId=tm.loserId||null;
        showTournamentResultMessage(
          t.name+' • FINÁLE',
          `<div><strong>${esc(tournamentPlayerName(k.championId,t))}</strong> je <strong>VÍTĚZEM TURNAJE</strong>.</div>
           ${k.runnerUpId?`<div style="margin-top:10px"><strong>${esc(tournamentPlayerName(k.runnerUpId,t))}</strong> končí na <strong>2. místě</strong>.</div>`:''}`
        );
        return t;
      }

      assignTournamentTables(t);

      let label=genericPlacementLabel(place);
      if(place<=4 && !k.thirdPlacePlayoff)label='3. místo';

      showTournamentResultMessage(
        t.name+' • '+(tm.roundLabel||'SKO'),
        `<div><strong>${esc(tournamentPlayerName(tm.winnerId,t))}</strong> postupuje dál.</div>
         <div style="margin-top:10px"><strong>${esc(tournamentPlayerName(tm.loserId,t))}</strong> vypadává a má pořadí <strong>${esc(label)}</strong>.</div>`
      );
      return t;
    }

    if(t.dko){
      const d=t.dko;

      if(tm.bracket==='3P'){
        d.thirdPlaceWinnerId=tm.winnerId;
        d.thirdPlaceLoserId=tm.loserId;
        dkoUpdateCompletion(t);
        assignTournamentTables(t);
        showTournamentResultMessage(
          t.name+' • ZÁPAS O 3. MÍSTO',
          dkoResultHtml(t,tm,tm.winnerId,tm.loserId,0,null)
        );
        return t;
      }

      const loserLossesBefore=d.losses[tm.loserId]||0;
      d.losses[tm.loserId]=loserLossesBefore+1;
      let eliminationPlace=null;
      if(d.losses[tm.loserId]>=2 && tm.bracket!=='GF'){
        eliminationPlace=dkoRegisterElimination(t,tm.loserId,tm.id);
      }

      repairDKOInvalidFutureMatches(t);

      if(tm.bracket==='GF'){
        d.championId=tm.winnerId;
        d.runnerUpId=tm.loserId;
        d.finalResetNeeded=false;
        dkoUpdateCompletion(t);
        forceFinalizeTournamentIfResolved(t,tm);
        showTournamentResultMessage(
          t.name+' • GRAND FINAL',
          dkoResultHtml(t,tm,tm.winnerId,tm.loserId,loserLossesBefore,2)
        );
        return t;
      }

      const allScheduledFinished=(d.rounds||[]).flatMap(r=>r.matches||[])
        .every(m=>m.status==='done'||!!m.winnerId||!!m.loserId);
      if(allScheduledFinished)dkoCreateWave(t);
      assignTournamentTables(t);

      showTournamentResultMessage(
        t.name+' • '+(tm.roundLabel||'DKO'),
        dkoResultHtml(t,tm,tm.winnerId,tm.loserId,loserLossesBefore,eliminationPlace)
      );
      return t;
    }

    return t;
  }


  
  window.openGuestAssign=function(tid,gid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t || !t.guests || !t.guests[gid]) return;
    const players=Object.values(data.players||{}).sort((a,b)=>playerDisplayName(a).localeCompare(playerDisplayName(b),'cs'));
    if(!players.length){toast('Nejdřív vytvoř profil hráče.');return;}
    guestAssignContext={tournamentId:tid,guestId:gid};
    $('guestAssignInfo').textContent='Host: '+t.guests[gid].name;
    $('guestAssignProfile').innerHTML=players.map(p=>`<option value="${esc(p.id)}">${esc(playerDisplayName(p))}</option>`).join('');
    $('guestAssignModal').classList.add('show');
  };

  $('guestAssignCancel').onclick=()=>{
    guestAssignContext=null;
    $('guestAssignModal').classList.remove('show');
  };

  function replaceTournamentParticipantId(t,oldId,newId){
    t.playerIds=(t.playerIds||[]).map(id=>id===oldId?newId:id);

    if(tournamentHasGroups(t)){
      (t.groups||[]).forEach(g=>{
        g.players=(g.players||[]).map(id=>id===oldId?newId:id);
        (g.matches||[]).forEach(m=>{
          if(m.player1Id===oldId)m.player1Id=newId;
          if(m.player2Id===oldId)m.player2Id=newId;
          if(m.winnerId===oldId)m.winnerId=newId;
          if(m.loserId===oldId)m.loserId=newId;
        });
      });
      (t.groupEliminations||[]).forEach(e=>{if(e.playerId===oldId)e.playerId=newId;});
    }

    if(t.ko){
      t.ko.participantIds=(t.ko.participantIds||[]).map(id=>id===oldId?newId:id);
      t.ko.eliminatedIds=(t.ko.eliminatedIds||[]).map(id=>id===oldId?newId:id);
      if(t.ko.championId===oldId)t.ko.championId=newId;
      if(t.ko.runnerUpId===oldId)t.ko.runnerUpId=newId;
      if(t.ko.thirdPlaceWinnerId===oldId)t.ko.thirdPlaceWinnerId=newId;
      if(t.ko.thirdPlaceLoserId===oldId)t.ko.thirdPlaceLoserId=newId;
      (t.ko.eliminations||[]).forEach(e=>{if(e.playerId===oldId)e.playerId=newId;});
      (t.ko.rounds||[]).forEach(r=>{
        (r.byes||[]).forEach(b=>{if(b.playerId===oldId)b.playerId=newId;});
        (r.matches||[]).forEach(m=>{
          if(m.player1Id===oldId)m.player1Id=newId;
          if(m.player2Id===oldId)m.player2Id=newId;
          if(m.winnerId===oldId)m.winnerId=newId;
          if(m.loserId===oldId)m.loserId=newId;
        });
      });
    }

    if(t.dko){
      t.dko.participantIds=(t.dko.participantIds||[]).map(id=>id===oldId?newId:id);
      if(Object.prototype.hasOwnProperty.call(t.dko.losses||{},oldId)){
        t.dko.losses[newId]=(t.dko.losses[newId]||0)+(t.dko.losses[oldId]||0);
        delete t.dko.losses[oldId];
      }
      if(t.dko.championId===oldId)t.dko.championId=newId;
      if(t.dko.runnerUpId===oldId)t.dko.runnerUpId=newId;
      if(t.dko.thirdPlaceWinnerId===oldId)t.dko.thirdPlaceWinnerId=newId;
      if(t.dko.thirdPlaceLoserId===oldId)t.dko.thirdPlaceLoserId=newId;
      (t.dko.eliminations||[]).forEach(e=>{if(e.playerId===oldId)e.playerId=newId;});
      (t.dko.rounds||[]).forEach(r=>{
        (r.byes||[]).forEach(b=>{if(b.playerId===oldId)b.playerId=newId;});
        (r.matches||[]).forEach(m=>{
          if(m.player1Id===oldId)m.player1Id=newId;
          if(m.player2Id===oldId)m.player2Id=newId;
          if(m.winnerId===oldId)m.winnerId=newId;
          if(m.loserId===oldId)m.loserId=newId;
        });
      });
    }
  }

  function relinkHistoricalGuestMatches(t,guestId,profileId){
    const profile=data.players[profileId];
    if(!profile) return;
    (data.matches||[]).forEach(m=>{
      if(!m.tournamentLink || m.tournamentLink.tournamentId!==t.id) return;
      if(!Array.isArray(m.playerIds)) return;
      m.playerIds=m.playerIds.map(id=>id===guestId?profileId:id);
      if(Array.isArray(m.playerNames)){
        m.playerNames=m.playerIds.map((id,i)=>id===profileId ? playerDisplayName(profile) : m.playerNames[i]);
      }
      if(Array.isArray(m.playerRealNames)){
        m.playerRealNames=m.playerIds.map((id,i)=>id===profileId ? profile.name : m.playerRealNames[i]);
      }
      if(m.tournamentLink.p1ParticipantId===guestId){
        m.tournamentLink.p1ParticipantId=profileId;
        m.tournamentLink.p1Guest=false;
      }
      if(m.tournamentLink.p2ParticipantId===guestId){
        m.tournamentLink.p2ParticipantId=profileId;
        m.tournamentLink.p2Guest=false;
      }
    });

    if(match && match.tournamentLink && match.tournamentLink.tournamentId===t.id){
      if(Array.isArray(match.playerIds))match.playerIds=match.playerIds.map(id=>id===guestId?profileId:id);
      saveDeviceActiveMatch(match);
    }
  }

  $('guestAssignConfirm').onclick=()=>{
    if(!guestAssignContext) return;
    const t=(data.tournaments||[]).find(x=>x.id===guestAssignContext.tournamentId);
    const gid=guestAssignContext.guestId;
    const pid=$('guestAssignProfile').value;
    if(!t || !t.guests || !t.guests[gid] || !data.players[pid]) return;

    const guestName=t.guests[gid].name;
    const profileName=playerDisplayName(data.players[pid]);

    if(!confirm('Přiřadit výsledky hráče „'+guestName+'“ profilu „'+profileName+'“?')) return;

    replaceTournamentParticipantId(t,gid,pid);
    relinkHistoricalGuestMatches(t,gid,pid);
    delete t.guests[gid];

    guestAssignContext=null;
    $('guestAssignModal').classList.remove('show');
    saveData();
    renderTournament();
    renderHistory();
    renderStats();
    toast('Host byl přiřazen k profilu a výsledky propojeny.');
  };


    // Shot clock
  $('clockStartStop').onclick=()=>{
    if(!match || !match.useClock) return;
    timerRunning ? stopTimer() : startTimer();
    renderClock();
  };
  $('clockReset').onclick=()=> resetClock(false,false);
  $('extensionBtn').onclick=useExtension;

  function resetClock(firstShot=false,autoStart=true){
    if(!match || !match.useClock) return;
    stopTimer();
    clockPhase = firstShot ? 'first' : 'normal';
    timeLeft = firstShot ? match.clock.first : match.clock.normal;
    renderClock();
    if(autoStart) startTimer();
  }
  function startTimer(){
    if(!match || !match.useClock || timerRunning) return;
    timerRunning=true;
    timer=setInterval(()=>{
      timeLeft--;

      // Výrazné dvojité varování přesně při 10 s.
      if(timeLeft===match.clock.warn){
        beep(1150,.20,.30,0);
        beep(1150,.20,.30,.30);
        toast('10 SEKUND');
      }

      // Posledních 5 sekund: pípnutí každou sekundu 5, 4, 3, 2, 1.
      if(timeLeft<=match.clock.countdown && timeLeft>0){
        beep(820,.10,.20);
      }

      // Nula = časový faul. Delší a hlubší tón.
      if(timeLeft<=0){
        timeLeft=0;
        stopTimer();
        beep(180,.80,.30);
        toast('TIME – časový faul!');
      }

      renderClock();
    },1000);
  }
  function stopTimer(){
    timerRunning=false;
    if(timer){ clearInterval(timer); timer=null; }
  }
  function renderClock(){
    if(!match || !match.useClock) return;
    $('clock').textContent=timeLeft;
    $('clock').classList.toggle('warning',timeLeft<=match.clock.warn && timeLeft>match.clock.countdown);
    $('clock').classList.toggle('danger',timeLeft<=match.clock.countdown);
    $('clockStartStop').textContent=timerRunning?'⏸ PAUZA':'▶ START';
    scheduleStreamState();
  }
  function useExtension(){
    if(!match || !match.useClock) return;
    const i=match.turn;
    if(match.extensionsUsed[i]>=match.clock.extensionsPerRack){ toast('Extension už byla použita.'); return; }
    addActionEvent('Extension • '+match.playerNames[i]);
    match.extensionsUsed[i]++;
    timeLeft += (clockPhase==='first' ? match.clock.first : match.clock.normal);
    speak('Extension called');
    renderMatch();
    if(!timerRunning) startTimer();
  }

  function beep(freq=440,dur=.1,volume=.18,delay=0){
    try{
      ensureAudio();
      if(!audioCtx) return;
      const start = audioCtx.currentTime + delay;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();

      o.type = 'sine';
      o.frequency.setValueAtTime(freq, start);

      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(Math.max(0.001,volume), start + 0.012);
      g.gain.setValueAtTime(Math.max(0.001,volume), start + Math.max(0.02,dur-0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      o.connect(g);
      g.connect(audioCtx.destination);
      o.start(start);
      o.stop(start + dur + 0.03);
    }catch(e){}
  }
  function speak(text){
    try{ const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; speechSynthesis.speak(u); }catch(e){}
  }

  let statsCardMatch=null;
  let statsCardIsCurrent=false;

  function statBox(label,value){
    return `<div class="subpanel" style="text-align:center;padding:12px">
      <div class="muted" style="font-size:12px;font-weight:900">${esc(label)}</div>
      <div style="font-size:25px;font-weight:950;margin-top:3px">${esc(String(value))}</div>
    </div>`;
  }

  function averagePerInning14(m,i){
    const innings=Math.max(0,Number(m?.stats?.[i]?.innings14||0));
    if(!innings)return null;
    const score=Number(m?.scores?.[i]||0);
    return score/innings;
  }

  function averagePerInning14Text(m,i){
    const avg=averagePerInning14(m,i);
    return avg===null ? '—' : avg.toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:1});
  }


  function mostMissedBall(stats){
    let bestBall=null,best=0;
    for(let n=1;n<=10;n++){ const v=Number(stats?.['missBall'+n]||0); if(v>best){best=v;bestBall=n;} }
    return bestBall==null?'—':bestBall+' ('+best+'×)';
  }
  function mostBreakBall(stats){
    let bestBall=null,best=0;
    for(let n=1;n<=10;n++){ const v=Number(stats?.['breakBall'+n]||0); if(v>best){best=v;bestBall=n;} }
    return bestBall==null?'—':bestBall+' ('+best+'×)';
  }

  function safetyEscapePct(stats){
    const attempts=Number(stats?.safetyEscapes||0);
    const success=Number(stats?.successfulSafetyEscapes||0);
    if(!attempts)return '—';
    return Math.round(success/attempts*100)+' %';
  }

  function matchOnlyMissVal(m,i){
    const row=m?.stats?.[i]||{};
    // Nové zápasy používají matchOnlyMisses; starší záznamy zachováme přes fallback.
    if(Object.prototype.hasOwnProperty.call(row,'matchOnlyMisses'))return Number(row.matchOnlyMisses||0);
    return Number(row.misses||0);
  }

  function playerStatsCard14(m,i){
    const name=m.playerNames[i];
    const penalty=statVal(m,i,'foulPenaltyPoints14');
    return `<div class="subpanel" style="margin-top:12px">
      <div style="font-size:18px;font-weight:950;margin-bottom:10px">${esc(name)}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">
        ${statBox('SKÓRE',m.scores[i])}
        ${statBox('HIGH RUN',statVal(m,i,'highRun14'))}
        ${statBox('NÁBĚHY',statVal(m,i,'innings14'))}
        ${statBox('PRŮMĚR / NÁBĚH',averagePerInning14Text(m,i))}
        ${statBox('MISS',matchOnlyMissVal(m,i))}
        ${statBox('SAFE',statVal(m,i,'safeties'))}
        ${statBox('FAULY',statVal(m,i,'fouls'))}
        ${statBox('TRESTNÉ BODY',penalty ? '−'+penalty : '0')}
        ${statBox('3× FAUL',statVal(m,i,'threeFoulPenalties14'))}
      </div>
    </div>`;
  }

  function pctText(v){
    return v===null || !Number.isFinite(Number(v)) ? '—' : Math.round(Number(v))+' %';
  }

  function avgText(v,digits=2){
    if(v===null || !Number.isFinite(Number(v)))return '—';
    return Number(v).toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:digits});
  }

  function metricDeltaText(current,baseline,suffix=' %'){
    if(current===null || baseline===null || !Number.isFinite(Number(current)) || !Number.isFinite(Number(baseline)))return '';
    const d=Number(current)-Number(baseline);
    const rounded=Math.abs(d)>=10?Math.round(d):Math.round(d*10)/10;
    if(Math.abs(rounded)<0.05)return '<span class="muted" style="font-size:11px">= dlouhodobý průměr</span>';
    const arrow=rounded>0?'↑':'↓';
    const sign=rounded>0?'+':'';
    return `<span style="font-size:11px;font-weight:950">${arrow} ${sign}${esc(String(rounded).replace('.',','))}${esc(suffix)} vs průměr</span>`;
  }

  function historicalPlayerBaseline(m,i){
    const pid=m?.playerIds?.[i];
    if(!pid)return null;
    const rows=(data.matches||[]).filter(x=>{
      if(!x || x.id===m.id || (x.status||'complete')!=='complete')return false;
      if(x.solo14 || x.ghostMode || x.winnerTableMode || x.discipline==='14.1')return false;
      if(m.discipline && x.discipline!==m.discipline)return false;
      return Array.isArray(x.playerIds) && x.playerIds.includes(pid);
    });
    let breaks=0,dry=0,soft=0,softDry=0,bf=0,potted=0,pottedTracked=0,bar=0;
    let saf=0,safOk=0,safTracked=0,esc=0,escOk=0,resafes=0;
    rows.forEach(x=>{
      const j=x.playerIds.indexOf(pid), st=x.stats?.[j];
      if(!st)return;
      breaks+=Number(st.breaks||0); dry+=Number(st.dryBreaks||0); soft+=Number(st.softBreaks||0); softDry+=Number(st.softDryBreaks||0); bf+=Number(st.breakFouls||0);
      potted+=Number(st.breakPottedBalls||0); pottedTracked+=Number(st.breakPottedTracked||0); bar+=Number(st.breakAndRun||0);
      saf+=Number(st.safeties||0); safOk+=Number(st.successfulSafeties||0); safTracked+=Number(st.trackedSafeties||0);
      esc+=Number(st.safetyEscapes||0); escOk+=Number(st.successfulSafetyEscapes||0); resafes+=Number(st.resafes||0);
    });
    const successful=Math.max(0,breaks-dry-soft+softDry-bf);
    return {
      matches:rows.length,
      breakPct:breaks?successful/breaks*100:null,
      pottedAvg:pottedTracked?potted/pottedTracked:null,
      brConversion:successful?bar/successful*100:null,
      safetyPct:safTracked?safOk/safTracked*100:null,
      escapePct:esc?escOk/esc*100:null,
      resafes
    };
  }

  function comparisonMetricBox(label,current,currentText,baseline,baselineText,suffix=' %'){
    const delta=metricDeltaText(current,baseline,suffix);
    const base=baseline===null?'':`<div class="muted" style="font-size:11px;margin-top:3px">průměr ${esc(baselineText)}</div>`;
    return `<div class="subpanel" style="text-align:center;padding:11px">
      <div class="muted" style="font-size:11px;font-weight:900">${esc(label)}</div>
      <div style="font-size:22px;font-weight:950;margin-top:3px">${esc(currentText)}</div>
      ${base}<div style="margin-top:3px">${delta}</div>
    </div>`;
  }

  function playerComparisonPanel(m,i){
    const b=historicalPlayerBaseline(m,i);
    if(!b || !b.matches)return '';
    const br=breakStats(m,i), st=m.stats?.[i]||{};
    const currentBrConv=br.successful?Number(st.breakAndRun||0)/br.successful*100:null;
    const safTracked=Number(st.trackedSafeties||0), safPct=safTracked?Number(st.successfulSafeties||0)/safTracked*100:null;
    const escapeAttempts=Number(st.safetyEscapes||0), escPct=escapeAttempts?Number(st.successfulSafetyEscapes||0)/escapeAttempts*100:null;
    return `<div class="subpanel" style="margin-top:10px;border-color:rgba(212,175,55,.35)">
      <div style="font-size:15px;font-weight:950;margin-bottom:8px">PROTI VLASTNÍMU PRŮMĚRU • ${esc(m.playerNames[i])}</div>
      <div class="muted" style="font-size:11px;margin-bottom:8px">Srovnání s ${b.matches} dokončenými zápasy ve stejné disciplíně.</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:7px">
        ${comparisonMetricBox('BREAK',br.pct,br.pct===null?'—':br.pct+' %',b.breakPct,pctText(b.breakPct))}
        ${comparisonMetricBox('Ø KOULÍ / BREAK',br.pottedAvg,avgText(br.pottedAvg),b.pottedAvg,avgText(b.pottedAvg),'')}
        ${comparisonMetricBox('B&R CONVERSION',currentBrConv,pctText(currentBrConv),b.brConversion,pctText(b.brConversion))}
        ${comparisonMetricBox('JISTOTY',safPct,pctText(safPct),b.safetyPct,pctText(b.safetyPct))}
        ${comparisonMetricBox('ÚNIKY',escPct,pctText(escPct),b.escapePct,pctText(b.escapePct))}
      </div>
    </div>`;
  }

  function matchMomentumData(m){
    const ev=Array.isArray(m?.events)?m.events:[];
    const scores=[]; let prev=[0,0], streak=[0,0], best=[0,0], lastWinner=null;
    ev.forEach(e=>{
      const mt=String(e?.text||'').match(/^Skóre\s+(\d+)\s*:\s*(\d+)/i);
      if(!mt)return;
      const cur=[Number(mt[1]),Number(mt[2])];
      let w=null;
      if(cur[0]>prev[0] && cur[1]===prev[1])w=0;
      else if(cur[1]>prev[1] && cur[0]===prev[0])w=1;
      if(w!==null){
        if(lastWinner===w)streak[w]++; else {streak[w]=1; streak[1-w]=0; lastWinner=w;}
        best[w]=Math.max(best[w],streak[w]);
        scores.push({score:cur[0]+':'+cur[1],winner:w});
      }
      prev=cur;
    });
    let chain=0,maxResafeChain=0,resafeChains=0,inChain=false;
    ev.forEach(e=>{
      const t=String(e?.text||'');
      if(/^RESAFE\b/i.test(t)){
        chain++; maxResafeChain=Math.max(maxResafeChain,chain);
        if(!inChain){resafeChains++;inChain=true;}
      }else if(/jistot|únik/i.test(t)){
        if(!/RESAFE/i.test(t)){ chain=0; if(/potopen|bez potopen|Neúspěšný únik/i.test(t))inChain=false; }
      }else if(/Skóre|Dry break|Čistá hra|Dohrávka|MISS|Faul/i.test(t)){
        chain=0;inChain=false;
      }
    });
    return {scores,best,maxResafeChain,resafeChains};
  }

  function matchAnalyticsPanel(m){
    const md=matchMomentumData(m);
    const chips=md.scores.length?md.scores.map(x=>`<span style="display:inline-block;padding:5px 8px;border:1px solid var(--line);border-radius:999px;margin:2px;font-weight:900">${esc(x.score)}</span>`).join(''):'<span class="muted">U tohoto zápasu není uložen průběh rack po racku.</span>';
    return `<div class="subpanel" style="margin-top:12px;border-color:rgba(212,175,55,.45)">
      <div style="font-size:18px;font-weight:950">MOMENTUM & SAFETY BATTLE</div>
      <div style="margin-top:10px"><strong>Vývoj skóre:</strong><div style="margin-top:5px">${chips}</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px;margin-top:10px">
        ${statBox('NEJDELŠÍ SÉRIE • '+m.playerNames[0],md.best[0]||0)}
        ${statBox('NEJDELŠÍ SÉRIE • '+m.playerNames[1],md.best[1]||0)}
        ${statBox('RESAFE VÝMĚNY',md.resafeChains||0)}
        ${statBox('NEJDELŠÍ RESAFE ŘETĚZEC',md.maxResafeChain||0)}
      </div>
    </div>`;
  }

  function winnerTableResultHtml(m){
    const wt=m?.winnerTable;
    if(!wt || !Array.isArray(wt.players))return '';
    const rows=wt.players.map((p,i)=>({
      name:p?.displayName||p?.realName||('Hráč '+(i+1)),
      wins:Number(wt.wins?.[i]||0),
      index:i
    })).sort((a,b)=>b.wins-a.wins || a.index-b.index);

    return `<div style="width:100%">
      <div class="muted" style="font-size:11px;font-weight:950;letter-spacing:.8px;margin-bottom:8px">VÍTĚZ NA STOLE • KONEČNÉ POŘADÍ</div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
        ${rows.map((r,pos)=>`<div class="subpanel" style="margin:0;padding:10px 7px;text-align:center;${pos===0?'border-color:var(--gold);':''}">
          <div class="muted" style="font-size:10px;font-weight:900">${pos+1}. MÍSTO</div>
          <div style="font-size:15px;font-weight:950;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
          <div style="font-size:28px;font-weight:950;color:var(--gold2);margin-top:3px">${r.wins}</div>
          <div class="muted" style="font-size:10px;font-weight:900">VYHRANÝCH RACKŮ</div>
        </div>`).join('')}
      </div>
    </div>`;
  }

  function winnerTablePlayerStatsCard(m,i){
    const wt=m?.winnerTable||{};
    const p=wt.players?.[i]||{};
    const st=wt.stats?.[i]||{};
    const name=p.displayName||p.realName||('Hráč '+(i+1));
    const wins=Number(wt.wins?.[i]||0);
    const basic=matchEvidenceMode(m)==='basic';

    if(basic){
      return `<div class="subpanel" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="font-size:18px;font-weight:950">${esc(name)}</div>
          <span class="badge gold">${wins} výher</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:10px">
          ${statBox('VÝHRY',wins)}
          ${statBox('ČISTÉ HRY',Number(st.breakAndRun||0))}
          ${statBox('DOHRÁVKY',Number(st.runouts||0))}
        </div>
      </div>`;
    }

    const total=Math.max(0,Number(st.breaks||0));
    const dry=Math.max(0,Math.min(total,Number(st.dryBreaks||0)));
    const soft=Math.max(0,Math.min(total,Number(st.softBreaks||0)));
    const softDry=Math.max(0,Math.min(Math.min(dry,soft),Number(st.softDryBreaks||0)));
    const breakFouls=Math.max(0,Math.min(total,Number(st.breakFouls||0)));
    const successful=Math.max(0,total-dry-soft+softDry-breakFouls);
    const breakPct=total?Math.round(successful/total*100):null;
    const pottedTracked=Math.max(0,Number(st.breakPottedTracked||0));
    const potted=Math.max(0,Number(st.breakPottedBalls||0));
    const pottedAvg=pottedTracked?potted/pottedTracked:null;
    const missMap=[];
    for(let b=1;b<=10;b++){
      const n=Number(st['missBall'+b]||0);
      if(n>0)missMap.push({ball:b,count:n});
    }
    missMap.sort((a,b)=>b.count-a.count||a.ball-b.ball);
    const mostMiss=missMap.length?'#'+missMap[0].ball+' ('+missMap[0].count+'×)':'—';

    return `<div class="subpanel" style="margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="font-size:18px;font-weight:950">${esc(name)}</div>
        <span class="badge gold">${wins} výher</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-top:10px">
        ${statBox('VÝHRY',wins)}
        ${statBox('BREAKY',total)}
        ${statBox('DRY BREAK',dry)}
        ${statBox('SOFT BREAK',soft)}
        ${statBox('ÚSPĚŠNOST BREAKU',breakPct===null?'—':breakPct+' %')}
        ${statBox('KOULÍ Z BREAKU',pottedTracked?potted:'—')}
        ${statBox('Ø KOULÍ / BREAK',pottedAvg===null?'—':pottedAvg.toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:2}))}
        ${statBox('ESO Z BREAKU',Number(st.aces||0))}
        ${statBox('B&R',Number(st.breakAndRun||0))}
        ${statBox('DOHRÁVKY',Number(st.runouts||0))}
        ${statBox('SAFE',Number(st.safeties||0))}
        ${statBox('MISS',Number(st.matchOnlyMisses||st.misses||0))}
        ${statBox('FAULY',Number(st.fouls||0))}
        ${statBox('PUSH OUT',Number(st.pushOuts||0))}
        ${statBox('2-WAY SHOT',Number(st.twoWaySuccessful||0)+'/'+Number(st.twoWayAttempts||0))}
        ${statBox('NEJČASTĚJŠÍ MISS KOULE',mostMiss)}
      </div>
    </div>`;
  }

  function winnerTableStatsCard(m){
    const wt=m?.winnerTable;
    if(!wt || !Array.isArray(wt.players))return '<div class="muted">Statistiky session nejsou k dispozici.</div>';
    return `<div class="subpanel" style="margin-top:12px;border-color:rgba(212,175,55,.45)">
      <div style="font-size:17px;font-weight:950">VÍTĚZ NA STOLE • 3 HRÁČI</div>
      <div class="muted" style="margin-top:4px">Každý hráč je vyhodnocen samostatně za celou session bez ohledu na to, kdo byl na stole při jejím ukončení.</div>
    </div>`+winnerTableProgressHtml(m)+wt.players.map((_,i)=>winnerTablePlayerStatsCard(m,i)).join('');
  }

  function playerStatsCardNormal(m,i){
    const br=breakStats(m,i);
    return `<div class="subpanel" style="margin-top:12px">
      <div style="font-size:18px;font-weight:950;margin-bottom:10px">${esc(m.playerNames[i])}</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px">
        ${statBox('SKÓRE',m.scores[i])}
        ${statBox('BREAKY',br.tracked?br.total:'—')}
        ${statBox('DRY BREAK',br.tracked?br.dry:'—')}
        ${statBox('SOFT BREAK',br.tracked?br.soft:'—')}
        ${statBox('ÚSPĚŠNOST BREAKU',br.pct===null?'—':br.pct+' %')}
        ${statBox('KOULÍ Z BREAKU',br.pottedTracked?br.potted:'—')}
        ${statBox('Ø KOULÍ / BREAK',br.pottedAvg===null?'—':br.pottedAvg.toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:2}))}
        ${statBox('ESO Z BREAKU',statVal(m,i,'aces'))}
        ${statBox('B&R CONVERSION',br.successful?Math.round(statVal(m,i,'breakAndRun')/br.successful*100)+' %':'—')}
        ${statBox('B&R',statVal(m,i,'breakAndRun'))}
        ${statBox('RUNOUT',statVal(m,i,'runouts'))}
        ${statBox('PUSH OUT',statVal(m,i,'pushOuts'))}
        ${statBox('PUSH OUT VRÁCEN',statVal(m,i,'pushOutsReturned'))}
        ${statBox('2-WAY SHOT',statVal(m,i,'twoWaySuccessful')+'/'+statVal(m,i,'twoWayAttempts'))}
        ${statBox('NEJČASTĚJŠÍ MISS KOULE',mostMissedBall(m.stats?.[i]))}
        ${statBox('NEJČASTĚJI Z BREAKU',mostBreakBall(m.stats?.[i]))}
        ${statBox('SAFE',statVal(m,i,'safeties'))}
        ${statBox('ÚNIKY Z JISTOT',statVal(m,i,'successfulSafetyEscapes')+'/'+statVal(m,i,'safetyEscapes'))}
        ${statBox('ÚSPĚŠNOST ÚNIKŮ',safetyEscapePct(m.stats?.[i]))}
        ${statBox('RESAFE',statVal(m,i,'resafes'))}
        ${statBox('NECHTĚNÁ SAFE',statVal(m,i,'accidentalSafeties'))}
        ${statBox('MISS',matchOnlyMissVal(m,i))}
        ${statBox('MISS • OBTÍŽNÁ POZICE',statVal(m,i,'matchOnlyMissBadPosition'))}
        ${statBox('MISS • ŠPATNĚ ZAHRÁNO',statVal(m,i,'matchOnlyMissPot'))}
      </div>
      ${playerComparisonPanel(m,i)}
    </div>`;
  }

  function ghostOutcomeCounts(m){
    return {
      clean:statVal(m,0,'ghostCleanRunouts'),
      bih:statVal(m,0,'ghostBIHRunouts'),
      ace:statVal(m,0,'ghostAces'),
      failed:statVal(m,0,'ghostFailedRacks'),
      dry:statVal(m,0,'ghostDryBreaks'),
      soft:statVal(m,0,'ghostSoftBreaks'),
      breakFoul:statVal(m,0,'ghostBreakFouls')
    };
  }

  function ghostMissBallSummaryHtml(m){
    const map=m?.stats?.[0]?.ghostMissesByBall||{};
    const rows=Object.entries(map)
      .map(([ball,count])=>({ball:Number(ball),count:Number(count||0)}))
      .filter(x=>x.ball>0&&x.count>0)
      .sort((a,b)=>a.ball-b.ball);
    if(!rows.length)return '<div class="muted">Zatím není evidovaná žádná chyba na konkrétní kouli.</div>';
    return '<div style="display:flex;gap:7px;flex-wrap:wrap">'+rows.map(x=>
      '<span class="tournament-badge">KOULE '+x.ball+' • '+x.count+'×</span>'
    ).join('')+'</div>';
  }

  function ghostRackHistoryRows(m){
    const h=Array.isArray(m?.ghostRackHistory)?m.ghostRackHistory.filter(Boolean):[];
    if(h.length)return h;

    // Zpětná kompatibilita: u starší session zkusíme sestavit alespoň textový
    // přehled z Ghost událostí. Čísla racků u starých záznamů nemusí být známá.
    return (m?.events||[])
      .filter(e=>/Ghost\s*•/i.test(String(e?.text||'')) && !/^Skóre\s/i.test(String(e?.text||'')))
      .map((e,i)=>({
        rack:i+1,
        type:'legacy',
        label:String(e.text||'Ghost událost').replace(/^Ghost\s*•\s*/i,''),
        errorBall:null,
        playerDelta:0,
        ghostDelta:0,
        scorePlayer:null,
        scoreGhost:null,
        ts:e.ts||null
      }));
  }

  function ghostRackTimelineHtml(m){
    const rows=ghostRackHistoryRows(m);
    if(!rows.length)return '<div class="muted">Průběh racků zatím není k dispozici.</div>';

    return '<div style="display:grid;gap:7px">'+rows.map(r=>{
      const ball=r.errorBall?' • chyba na kouli '+r.errorBall:'';
      const delta=r.playerDelta?(' • HRÁČ +'+r.playerDelta):(r.ghostDelta?(' • GHOST +'+r.ghostDelta):'');
      const score=(r.scorePlayer!=null&&r.scoreGhost!=null)?(' • stav '+r.scorePlayer+':'+r.scoreGhost):'';
      return '<div style="padding:9px 10px;border:1px solid #303034;border-radius:10px">'+
        '<strong>Rack '+esc(String(r.rack||'—'))+'</strong> • '+esc(String(r.label||r.type||'—'))+
        esc(ball+delta+score)+'</div>';
    }).join('')+'</div>';
  }

  function ghostFullEventLogHtml(m){
    const events=Array.isArray(m?.events)?m.events:[];
    if(!events.length)return '<div class="muted">Žádné události nejsou uložené.</div>';
    return '<div style="display:grid;gap:6px">'+events.map(e=>
      '<div class="event"><strong>'+esc(String(e.time||''))+'</strong> — '+esc(String(e.text||''))+'</div>'
    ).join('')+'</div>';
  }

  function ghostMatchStatsCard(m){
    const c=ghostOutcomeCounts(m);
    const racks=c.clean+c.bih+c.ace+c.failed+c.dry+c.soft+c.breakFoul;
    const missMap=m?.stats?.[0]?.ghostMissesByBall||{};
    const missRows=Object.entries(missMap)
      .map(([ball,count])=>({ball:Number(ball),count:Number(count||0)}))
      .filter(x=>x.ball>0&&x.count>0)
      .sort((a,b)=>b.count-a.count||a.ball-b.ball);
    const mostCommonMissBall=missRows.length?'#'+missRows[0].ball+' • '+missRows[0].count+'×':'—';
    return `<div class="subpanel" style="margin-top:12px">
      <div style="font-size:18px;font-weight:950;margin-bottom:10px">${esc(m.playerNames[0])} vs GHOST</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px">
        ${statBox('HRÁČ BODY',m.scores[0])}
        ${statBox('GHOST BODY',m.scores[1])}
        ${ghostBallCountLabel(m)?statBox('POČET KOULÍ',ghostBallCountLabel(m)):''}
        ${statBox('RACKY',racks)}
        ${statBox('ČISTĚ +2',c.clean)}
        ${statBox('BIH +1',c.bih)}
        ${statBox('ESO +2',c.ace)}
        ${statBox('NEDOHRÁNO',c.failed)}
        ${statBox('DRY BREAK',c.dry)}
        ${statBox('SOFT BREAK',c.soft)}
        ${statBox('FAUL Z BREAKU',c.breakFoul)}
        ${(m.discipline==='9-ball'||m.discipline==='10-ball')?statBox('NEJČASTĚJI SKONČIL',mostCommonMissBall):''}
      </div>
    </div>
    <div class="subpanel" style="margin-top:10px">
      <div style="font-size:16px;font-weight:950;margin-bottom:9px">CHYBY PODLE KOULE</div>
      ${ghostMissBallSummaryHtml(m)}
    </div>
    <div class="subpanel" style="margin-top:10px">
      <div style="font-size:16px;font-weight:950;margin-bottom:9px">PRŮBĚH GHOST SESSION • RACK PO RACKU</div>
      ${ghostRackTimelineHtml(m)}
    </div>
    <div class="subpanel" style="margin-top:10px">
      <div style="font-size:16px;font-weight:950;margin-bottom:9px">KOMPLETNÍ LOG UDÁLOSTÍ</div>
      ${ghostFullEventLogHtml(m)}
    </div>`;
  }

  function tournamentWouldFinishWithMatch(m){
    if(!m?.tournamentLink || !(m.winner===0 || m.winner===1))return false;
    const t=(data.tournaments||[]).find(x=>x.id===m.tournamentLink.tournamentId);
    if(!t)return false;
    const tm=findTournamentMatch(t,m.tournamentLink.tournamentMatchId);
    if(!tm)return false;

    const winnerId=m.playerIds?.[m.winner]||tm.player1Id;
    const loserId=m.playerIds?.[1-m.winner]||tm.player2Id;

    // Čisté skupiny končí posledním skupinovým zápasem.
    if(t.format==='groups'){
      const groupMatches=(t.groups||[]).flatMap(g=>g.matches||[]);
      return groupMatches.every(x=>x.id===tm.id || x.status==='done' || !!x.winnerId || !!x.loserId);
    }

    if(t.format==='swiss' && t.swiss){
      const current=swissCurrentRound(t);
      if(!current)return false;
      const allOthersDone=(current.matches||[]).every(x=>
        x.id===tm.id || x.status==='done' || !!x.winnerId
      );
      return allOthersDone && Number(t.swiss.currentRound||0)>=Number(t.swiss.roundsTotal||0);
    }

    // SKO / Skupiny → SKO: po této prohře zůstane jediný aktivní hráč.
    if(t.ko){
      const k=ensureSKOState(t);
      const eliminated=new Set(k?.eliminatedIds||[]);
      if(loserId)eliminated.add(loserId);
      const active=(k?.participantIds||t.playerIds||[]).filter(id=>!eliminated.has(id));
      const bronzeRequired=!!k?.thirdPlacePlayoff;
      const bronze=knockoutThirdMatch(t);
      const bronzeDone=!bronzeRequired || !!(bronze && (bronze.status==='done'||bronze.winnerId));
      if(active.length===1 && active[0]===winnerId && bronzeDone)return true;
      if(tm.bracket==='F' && bronzeDone)return true;
    }

    // DKO / Skupiny → DKO: Grand Final uzavírá turnaj,
    // pokud není ještě potřeba dohrát zápas o 3. místo.
    if(t.dko && tm.bracket==='GF'){
      const bronzeRequired=!!t.dko.thirdPlacePlayoff;
      const bronze=dkoThirdPlaceMatch(t);
      const bronzeDone=!bronzeRequired || !!(bronze && (bronze.status==='done'||bronze.winnerId));
      return bronzeDone;
    }

    return false;
  }


  function rebuildSKOStateFromFinishedMatches(t){
    const k=ensureSKOState(t);
    if(!k)return false;

    const participants=[...(k.participantIds||t.playerIds||[])];
    if(participants.length<2)return false;

    const rounds=k.rounds||[];
    const mainMatches=rounds
      .flatMap(r=>r.matches||[])
      .filter(m=>m && m.bracket!=='3P' && m.player1Id && m.player2Id);

    if(!mainMatches.length)return false;

    // Výsledek staršího zápasu případně dopočítáme i ze skóre.
    mainMatches.forEach(m=>{
      if((m.winnerId && m.loserId) || m.status!=='done')return;
      const s1=Number(m.score1);
      const s2=Number(m.score2);
      if(Number.isFinite(s1) && Number.isFinite(s2) && s1!==s2){
        m.winnerId=s1>s2?m.player1Id:m.player2Id;
        m.loserId=s1>s2?m.player2Id:m.player1Id;
      }
    });

    const allMainFinished=mainMatches.every(m=>
      m.status==='done' && !!m.winnerId && !!m.loserId
    );
    if(!allMainFinished)return false;

    const losers=new Set(mainMatches.map(m=>m.loserId).filter(Boolean));
    const survivors=participants.filter(id=>!losers.has(id));

    // V čistém SKO musí po kompletním pavouku zůstat právě jeden hráč bez prohry.
    if(survivors.length!==1)return false;

    const championId=survivors[0];

    // Poslední dohraný zápas vítěze je finále i u starších pavouků,
    // které nemají správně uložený bracket='F'.
    const championMatches=mainMatches.filter(m=>m.winnerId===championId);
    const finalMatch=championMatches[championMatches.length-1]||null;
    if(!finalMatch || !finalMatch.loserId)return false;

    const previousStatus=t.status;
    const previousChampion=k.championId;
    const previousRunner=k.runnerUpId;

    k.championId=championId;
    k.runnerUpId=finalMatch.loserId;
    k.eliminatedIds=[...new Set([...(k.eliminatedIds||[]),...losers])];

    // Znovu sestavíme vyřazení podle skutečně odehraného pořadí zápasů.
    // Tím se opraví i výsledková tabulka starších rozehraných turnajů.
    const seen=new Set();
    const reconstructed=[];
    mainMatches.forEach(m=>{
      const loser=m.loserId;
      if(!loser || seen.has(loser))return;
      seen.add(loser);
      const activeAfter=participants.length-seen.size;
      reconstructed.push({
        playerId:loser,
        place:activeAfter+1,
        matchId:m.id,
        at:m.finishedAt||new Date().toISOString()
      });
    });
    k.eliminations=reconstructed;

    if(k.thirdPlacePlayoff){
      const bronze=knockoutThirdMatch(t);
      const bronzeDone=!!(bronze && (bronze.status==='done'||bronze.winnerId));
      if(bronzeDone){
        k.thirdPlaceWinnerId=bronze.winnerId||k.thirdPlaceWinnerId||null;
        k.thirdPlaceLoserId=bronze.loserId||k.thirdPlaceLoserId||null;
        t.status='complete';
      }else{
        t.status='active';
      }
    }else{
      t.status='complete';
    }

    return previousStatus!==t.status ||
      previousChampion!==k.championId ||
      previousRunner!==k.runnerUpId;
  }

  function forceFinalizeTournamentIfResolved(t,lastMatch=null){
    if(!t)return false;

    let repaired=false;
    if(t.ko){
      repaired=rebuildSKOStateFromFinishedMatches(t) || repaired;
      if(t.status==='complete')return true;
    }

    if(t.format==='groups' && groupPhaseComplete(t)){
      t.status='complete';
      return true;
    }

    if(t.ko){
      const k=ensureSKOState(t);
      if(!k)return false;
      const active=(k.participantIds||t.playerIds||[]).filter(id=>!(k.eliminatedIds||[]).includes(id));

      if(active.length===1){
        k.championId=k.championId||active[0];
        if(!k.runnerUpId && lastMatch?.winnerId===k.championId)k.runnerUpId=lastMatch.loserId||null;

        const bronzeRequired=!!k.thirdPlacePlayoff;
        const bronze=knockoutThirdMatch(t);
        const bronzeDone=!bronzeRequired || !!(bronze && (bronze.status==='done'||bronze.winnerId));

        if(bronzeDone){
          t.status='complete';
          return true;
        }
      }

      const final=knockoutFinalMatch(t);
      if(final && (final.status==='done'||final.winnerId)){
        k.championId=k.championId||final.winnerId;
        k.runnerUpId=k.runnerUpId||final.loserId;
        const bronzeRequired=!!k.thirdPlacePlayoff;
        const bronze=knockoutThirdMatch(t);
        const bronzeDone=!bronzeRequired || !!(bronze && (bronze.status==='done'||bronze.winnerId));
        if(bronzeDone){
          t.status='complete';
          return true;
        }
      }
    }

    if(t.dko && !t.ko){
      dkoUpdateCompletion(t);
      if(t.status==='complete')return true;
    }

    return t.status==='complete';
  }

function openMatchStatsCard(m,isCurrent=false){
    if(!m) return;
    statsCardMatch=m;
    statsCardIsCurrent=isCurrent;

    const complete=(m.status||'complete')==='complete';
    const date=new Date(m.startedAt).toLocaleString('cs-CZ',{dateStyle:'medium',timeStyle:'short'});
    let title='STATISTIKY ZÁPASU';
    let result='';
    let body='';

    if(m.solo14){
      title=m.solo14GhostMode?'STATISTIKY • 14.1 SÓLO VS GHOST':'STATISTIKY • 14.1 SÓLO';
      result=m.solo14GhostMode
        ? esc(m.playerNames[0])+' '+m.scores[0]+' : '+m.scores[1]+' GHOST'
        : esc(m.playerNames[0])+' • '+m.scores[0]+' b';
      body=`<div class="subpanel" style="margin-top:12px;border-color:rgba(212,175,55,.5);text-align:center">
          <div class="muted" style="font-size:11px;font-weight:950">NEJVYŠŠÍ NÁBĚH SESSION</div>
          <div style="font-size:38px;font-weight:950;color:var(--gold2);margin-top:4px">${esc(String(statVal(m,0,'highRun14')))}</div>
        </div>`+playerStatsCard14(m,0)+(m.solo14GhostMode
        ? `<div class="subpanel" style="margin-top:10px">
            <strong>GHOST • ${esc(solo14GhostDifficultyLabel(m,true))}</strong>
            <div class="muted" style="margin-top:5px">
              Chyby hráče (MISS / faul): ${esc(String(m.solo14GhostErrors||0))}
            </div>
          </div>`
        : '')+fourteenInningsTimelineHtml(m);
    }else if(m.ghostMode){
      title='GHOST STATISTIKY • '+m.discipline.toUpperCase();
      result=esc(m.playerNames[0])+' '+m.scores[0]+' : '+m.scores[1]+' GHOST';
      body=ghostMatchStatsCard(m);
    }else if(m.winnerTableMode && m.winnerTable){
      title='STATISTIKY • '+m.discipline.toUpperCase()+' • VÍTĚZ NA STOLE';
      result=winnerTableResultHtml(m);
      body=winnerTableStatsCard(m);
    }else if(m.discipline==='14.1'){
      title='STATISTIKY • 14.1 NEKONEČNÁ';
      result=esc(m.playerNames[0])+' '+m.scores[0]+' : '+m.scores[1]+' '+esc(m.playerNames[1]);
      body=playerStatsCard14(m,0)+playerStatsCard14(m,1)+fourteenInningsTimelineHtml(m);
    }else{
      title='STATISTIKY • '+m.discipline.toUpperCase()+(matchIsDoubles(m)?' • DVOJICE':'')+(matchHasHandicap(m)?' • HANDICAP':'');
      result=esc(savedMatchSideDisplayName(m,0))+' '+m.scores[0]+' : '+m.scores[1]+' '+esc(savedMatchSideDisplayName(m,1));
      body=matchEvidenceMode(m)==='basic'
        ? basicMatchSummaryCard(m)
        : matchAnalyticsPanel(m)+playerStatsCardNormal(m,0)+playerStatsCardNormal(m,1);
    }

    const matchDescriptionBlock=m.streamMatchTitle
      ? `<div class="subpanel" style="margin-bottom:12px;border-color:rgba(212,175,55,.45)"><div style="font-size:11px;font-weight:950;color:var(--muted);letter-spacing:.5px">NÁZEV / POPIS ZÁPASU</div><div style="font-size:16px;font-weight:950;color:var(--gold2);margin-top:5px">${esc(m.streamMatchTitle)}</div></div>`
      : '';
    body=matchDescriptionBlock+body;

    let winnerBanner='';
    if(complete && !m.solo14 && !m.ghostMode && !m.winnerTableMode && (m.winner===0 || m.winner===1)){
      winnerBanner=`<div style="
        margin-bottom:14px;
        padding:12px 14px;
        border:1px solid var(--gold);
        border-radius:12px;
        background:rgba(212,175,55,.09);
        text-align:center;
        font-size:20px;
        font-weight:950;
        color:var(--gold2)
      ">🏆 VÍTĚZ: ${esc(savedMatchSideDisplayName(m,m.winner))} • ${esc(String(m.scores[0]))}:${esc(String(m.scores[1]))}</div>`;
    }

    const matchTypeInfo=(matchIsDoubles(m)||matchHasHandicap(m))
      ? `<div class="subpanel" style="margin-bottom:10px;padding:10px 12px;text-align:center;border-color:rgba(212,175,55,.45)">
          ${matchFormatBadgesHtml(m)}
          ${matchIsDoubles(m)
            ? `<div class="muted" style="margin-top:7px;font-size:12px">
                ${esc(savedMatchSideDisplayName(m,0))}
                vs
                ${esc(savedMatchSideDisplayName(m,1))}
              </div>`
            : ''}
        </div>`
      : '';
    const handicapInfo=handicapInfoHtml(m);
    const evidenceInfo=`<div class="subpanel" style="margin-bottom:10px;padding:9px 12px">
      <strong>${matchEvidenceMode(m)==='full'?'ROZŠÍŘENÉ STATISTIKY':'ZÁKLADNÍ SKÓRE'}</strong>
      <div class="muted" style="margin-top:4px;font-size:12px">${matchEvidenceMode(m)==='full'?'Zápas byl veden přes rozšířené počítadlo a jeho akční statistiky se započítávají do detailních statistik hráčů.':'Zápas byl veden pouze jako základní skóre; používá se pro výsledky, ELO a rackovou bilanci, ne pro detailní akční procenta.'}</div>
    </div>`;
    body=winnerBanner+matchTypeInfo+handicapInfo+evidenceInfo+`<div class="muted" style="font-weight:800">
      ${esc(date)} • délka ${esc(durationText(m))} • ${complete?'dokončeno':'nedohráno'}
    </div>
    <div class="subpanel" style="margin-top:10px;padding:10px 12px">
      <div class="muted" style="font-size:11px;font-weight:900;letter-spacing:.06em">ID ZÁPASU / FIREBASE</div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:5px">
        <code style="font-size:12px;word-break:break-all;flex:1;min-width:180px">${esc(String(m.id||'—'))}</code>
        <button class="btn ghost" style="padding:8px 10px" onclick="copyCurrentStatsMatchId()">KOPÍROVAT ID</button>
      </div>
    </div>`+body;

    $('matchStatsTitle').textContent=title;
    $('matchStatsResult').innerHTML=result;
    $('matchStatsBody').innerHTML=body;
    $('matchStatsUndo').classList.toggle('hidden',!isCurrent);
    const endsTournament=isCurrent && tournamentWouldFinishWithMatch(m);
    $('matchStatsClose').textContent=isCurrent
      ? (endsTournament
          ? 'UKONČIT ZÁPAS A TURNAJ'
          : (m.tournamentLink?'ULOŽIT VÝSLEDEK A ZPĚT DO TURNAJE':'ULOŽIT A ZAVŘÍT'))
      : 'ZAVŘÍT';
    $('matchStatsClose').dataset.endsTournament=endsTournament?'1':'0';
    $('winnerModal').classList.remove('show');
    $('matchStatsModal').classList.add('show');
  }

  window.copyCurrentStatsMatchId=async function(){
    const id=String(statsCardMatch?.id||'').trim();
    if(!id){ toast('ID zápasu není k dispozici.'); return; }
    try{
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(id);
      }else{
        const ta=document.createElement('textarea');
        ta.value=id; ta.style.position='fixed'; ta.style.opacity='0';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
      }
      toast('ID zápasu zkopírováno.');
    }catch(e){
      try{ window.prompt('Zkopíruj ID zápasu:',id); }catch(_){}
    }
  };

  window.showSavedMatchStats=function(id){
    const m=data.matches.find(x=>x.id===id);
    if(!m){ toast('Zápas nebyl nalezen.'); return; }
    openMatchStatsCard(m,false);
  };

  $('matchStatsShare').onclick=()=>{
    if(statsCardMatch) shareMatchStats(statsCardMatch);
  };

  $('matchStatsPdf').onclick=()=>{
    if(statsCardMatch) generateAndShareMatchPdf(statsCardMatch);
  };

  $('matchStatsUndo').onclick=()=>{
    if(!statsCardIsCurrent || !match) return;
    match.endedAt=null;
    match.status=null;
    match.winner=null;
    $('matchStatsModal').classList.remove('show');
    statsCardMatch=null;
    statsCardIsCurrent=false;
    undo();
    autosaveCurrent();
    startLiveHeartbeat();
  };

  $('matchStatsClose').onclick=async()=>{
    $('matchStatsModal').classList.remove('show');

    if(statsCardIsCurrent && match){
      const wasTournament=!!match.tournamentLink;
      const tournamentId=match.tournamentLink?.tournamentId||null;
      const tournamentMatchId=match.tournamentLink?.tournamentMatchId||null;
      if(tournamentId) forcedTournamentReturnId=tournamentId;

      const ok=await persistFinishedMatch();
      if(!ok){
        $('matchStatsModal').classList.add('show');
        return;
      }

      match=null;
      saveDeviceActiveMatch(null);
      statsCardMatch=null;
      statsCardIsCurrent=false;

      renderHistory();
      renderStats();
      renderPlayers();

      if(wasTournament){
        const targetTournamentId=postMatchTournamentId||tournamentId;

        // Výsledek turnaje už persistFinishedMatch zapsal do lokálního modelu.
        // Návrat do turnaje proto NESMÍ čekat na další cloudové načítání.
        selectedTournamentId=targetTournamentId;
        forcedTournamentReturnId=targetTournamentId;
        updateCurrentTournamentShortcut();

        const localTournament=(data.tournaments||[]).find(x=>x.id===targetTournamentId);
        if(localTournament){
          const linkedTm=tournamentMatchId
            ? findTournamentMatch(localTournament,tournamentMatchId)
            : null;
          forceFinalizeTournamentIfResolved(localTournament,linkedTm);
        }

        renderTournament();

        if(localTournament?.status==='complete'){
          renderResultsTournaments();
          tournamentDetailReturnScreen='results-tournaments';
          preserveTournamentDetailReturn=true;
          renderTournamentDetail();
          showScreen('tournament-detail');
          toast('Turnaj dokončen • výsledky byly vygenerovány.');
        }else{
          renderTournamentDetail();
          showScreen('tournament-detail');
          toast('Výsledek uložen. Pokračuj v turnaji.');
        }

        // Cloud pouze dosynchronizujeme na pozadí. Uživatele to nesmí držet
        // na obrazovce právě skončeného zápasu.
        Promise.allSettled([loadSecureMatches(),loadSecureTournaments()])
          .then(async()=>{
            try{
              reconcileTournamentResultsFromMatches(targetTournamentId);
              const refreshedTournament=(data.tournaments||[]).find(x=>x.id===targetTournamentId);
              if(refreshedTournament){
                const linkedTm=tournamentMatchId
                  ? findTournamentMatch(refreshedTournament,tournamentMatchId)
                  : null;
                const repaired=forceFinalizeTournamentIfResolved(refreshedTournament,linkedTm);
                if(repaired || refreshedTournament.status==='complete'){
                  try{await saveSecureTournament(refreshedTournament);}catch(e){
                    console.error('Tournament background resave:',e);
                  }
                }
              }

              // Pokud je uživatel stále v tomto turnaji, jen překreslíme aktuální stav.
              if(selectedTournamentId===targetTournamentId){
                renderTournament();
                renderResultsTournaments();
                renderTournamentDetail();
              }
            }catch(e){
              console.error('Tournament background refresh:',e);
            }
          })
          .catch(e=>console.error('Tournament background sync:',e));
      }else{
        showScreen('history');
      }
    }else{
      statsCardMatch=null;
      statsCardIsCurrent=false;
    }
  };

  function pdfSafeName(value){
    return String(value||'report')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-zA-Z0-9_-]+/g,'_')
      .replace(/^_+|_+$/g,'')
      .slice(0,80) || 'report';
  }

  function pdfReportStat(label,value){
    return `<div style="
      border:1px solid #d4af37;
      border-radius:10px;
      padding:10px 8px;
      background:#171719;
      text-align:center;
      min-height:66px;
    ">
      <div style="font-size:10px;color:#bcbcbc;font-weight:800;letter-spacing:.4px">${esc(label)}</div>
      <div style="font-size:22px;color:#f1d67a;font-weight:950;margin-top:5px">${esc(String(value))}</div>
    </div>`;
  }

  function pdfPlayerBlock14(m,i){
    const penalty=statVal(m,i,'foulPenaltyPoints14');
    return `<div style="border:1px solid #3e3e42;border-radius:14px;padding:14px;margin-top:12px;background:#101012">
      <div style="font-size:20px;font-weight:950;color:#fff;margin-bottom:10px">${esc(m.playerNames[i])}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${pdfReportStat('SKÓRE',m.scores[i])}
        ${pdfReportStat('HIGH RUN',statVal(m,i,'highRun14'))}
        ${pdfReportStat('NÁBĚHY',statVal(m,i,'innings14'))}
        ${pdfReportStat('PRŮMĚR / NÁBĚH',averagePerInning14Text(m,i))}
        ${pdfReportStat('MISS',matchOnlyMissVal(m,i))}
        ${pdfReportStat('SAFE',statVal(m,i,'safeties'))}
        ${pdfReportStat('FAULY',statVal(m,i,'fouls'))}
        ${pdfReportStat('TRESTNÉ BODY',penalty?'−'+penalty:'0')}
        ${pdfReportStat('3× FAUL',statVal(m,i,'threeFoulPenalties14'))}
      </div>
    </div>`;
  }

  function pdfPlayerBlockNormal(m,i){
    const br=breakStats(m,i);
    return `<div style="border:1px solid #3e3e42;border-radius:14px;padding:14px;margin-top:12px;background:#101012">
      <div style="font-size:20px;font-weight:950;color:#fff;margin-bottom:10px">${esc(m.playerNames[i])}</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${pdfReportStat('SKÓRE',m.scores[i])}
        ${pdfReportStat('BREAKY',br.tracked?br.total:'—')}
        ${pdfReportStat('DRY BREAK',br.tracked?br.dry:'—')}
        ${pdfReportStat('SOFT BREAK',br.tracked?br.soft:'—')}
        ${pdfReportStat('ÚSPĚŠNOST BREAKU',br.pct===null?'—':br.pct+' %')}
        ${pdfReportStat('KOULÍ Z BREAKU',br.pottedTracked?br.potted:'—')}
        ${pdfReportStat('Ø KOULÍ / BREAK',br.pottedAvg===null?'—':br.pottedAvg.toLocaleString('cs-CZ',{minimumFractionDigits:1,maximumFractionDigits:2}))}
        ${pdfReportStat('ESO Z BREAKU',statVal(m,i,'aces'))}
        ${pdfReportStat('B&R',statVal(m,i,'breakAndRun'))}
        ${pdfReportStat('RUNOUT',statVal(m,i,'runouts'))}
        ${pdfReportStat('PUSH OUT',statVal(m,i,'pushOuts'))}
        ${pdfReportStat('PUSH OUT VRÁCEN',statVal(m,i,'pushOutsReturned'))}
        ${pdfReportStat('2-WAY SHOT',statVal(m,i,'twoWaySuccessful')+'/'+statVal(m,i,'twoWayAttempts'))}
        ${pdfReportStat('MISS KOULE',mostMissedBall(m.stats?.[i]))}
        ${pdfReportStat('BREAK KOULE',mostBreakBall(m.stats?.[i]))}
        ${pdfReportStat('SAFE',statVal(m,i,'safeties'))}
        ${pdfReportStat('ÚNIKY',statVal(m,i,'successfulSafetyEscapes')+'/'+statVal(m,i,'safetyEscapes'))}
        ${pdfReportStat('ÚNIKY %',safetyEscapePct(m.stats?.[i]))}
        ${pdfReportStat('RESAFE',statVal(m,i,'resafes'))}
        ${pdfReportStat('NECHTĚNÁ SAFE',statVal(m,i,'accidentalSafeties'))}
        ${pdfReportStat('MISS',matchOnlyMissVal(m,i))}
        ${pdfReportStat('MISS • NAHRÁVKA',statVal(m,i,'matchOnlyMissBadPosition'))}
        ${pdfReportStat('MISS • KOULE',statVal(m,i,'matchOnlyMissPot'))}
      </div>
    </div>`;
  }

  function pdfWinnerTableBlock(m){
    const wt=m.winnerTable;
    if(!wt) return '';
    const order=[0,1,2].sort((a,b)=>(wt.wins[b]||0)-(wt.wins[a]||0));
    return `<div style="border:1px solid #3e3e42;border-radius:14px;padding:14px;margin-top:12px;background:#101012">
      <div style="font-size:20px;font-weight:950;color:#fff;margin-bottom:10px">VÍTĚZ NA STOLE</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
        ${order.map(i=>pdfReportStat(wt.players[i].displayName, (wt.wins[i]||0)+' výher')).join('')}
      </div>
      <div style="margin-top:12px">${winnerTableProgressHtml(m)}</div>
      <div style="margin-top:12px;padding:10px;border-radius:10px;background:#1b1710;color:#e7e0c8;font-size:12px;line-height:1.5">
        Vítěz racku zůstává na stole. Poražený jde čekat a staví nový trojúhelník.
        Čekající hráč jde na stůl a rozstřeluje.
      </div>
    </div>`;
  }

  function pdfGhostBlock(m){
    const c=ghostOutcomeCounts(m);
    const racks=c.clean+c.bih+c.ace+c.failed+c.dry+c.soft+c.breakFoul;
    const missMap=m?.stats?.[0]?.ghostMissesByBall||{};
    const missRows=Object.entries(missMap).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(a[0])-Number(b[0]));
    const history=ghostRackHistoryRows(m);

    return `<div style="border:1px solid #3e3e42;border-radius:14px;padding:14px;margin-top:12px;background:#101012">
      <div style="font-size:20px;font-weight:950;color:#fff;margin-bottom:10px">${esc(m.playerNames[0])} vs GHOST</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
        ${pdfReportStat('HRÁČ BODY',m.scores[0])}
        ${pdfReportStat('GHOST BODY',m.scores[1])}
        ${ghostBallCountLabel(m)?pdfReportStat('POČET KOULÍ',ghostBallCountLabel(m)):''}
        ${pdfReportStat('RACKY',racks)}
        ${pdfReportStat('ČISTĚ +2',c.clean)}
        ${pdfReportStat('BIH +1',c.bih)}
        ${pdfReportStat('ESO +2',c.ace)}
        ${pdfReportStat('NEDOHRÁNO',c.failed)}
        ${pdfReportStat('DRY BREAK',c.dry)}
        ${pdfReportStat('SOFT BREAK',c.soft)}
        ${pdfReportStat('FAUL Z BREAKU',c.breakFoul)}
      </div>
      <div style="margin-top:12px;padding:10px;border-radius:10px;background:#1b1710;color:#e7e0c8;font-size:12px;line-height:1.5">
        <strong style="color:#f1d67a">Chyby podle koule:</strong>
        ${missRows.length?missRows.map(([b,n])=>'#'+b+' '+n+'×').join(' • '):'žádná evidovaná chyba'}
      </div>
      <div style="margin-top:12px;font-size:12px;line-height:1.55">
        <strong style="color:#f1d67a">Průběh racků:</strong><br>
        ${history.length?history.map(r=>{
          const ball=r.errorBall?' • chyba na '+r.errorBall:'';
          const delta=r.playerDelta?(' • hráč +'+r.playerDelta):(r.ghostDelta?(' • Ghost +'+r.ghostDelta):'');
          const score=(r.scorePlayer!=null&&r.scoreGhost!=null)?(' • stav '+r.scorePlayer+':'+r.scoreGhost):'';
          return 'Rack '+esc(String(r.rack||'—'))+' • '+esc(String(r.label||r.type||'—'))+esc(ball+delta+score);
        }).join('<br>'):'Průběh racků není uložen.'}
      </div>
    </div>`;
  }

  function buildPdfReportHtml(m){
    const logo=(document.querySelector('.brand-logo')||{}).src||'';
    const date=new Date(m.startedAt).toLocaleString('cs-CZ',{dateStyle:'long',timeStyle:'short'});
    const status=(m.status||'complete')==='complete'?'DOKONČENO':'NEDOHRÁNO';

    let title='';
    let result='';
    let blocks='';

    if(m.solo14){
      title=m.solo14GhostMode?'14.1 NEKONEČNÁ - SÓLO VS GHOST':'14.1 NEKONEČNÁ - SÓLO TRÉNINK';
      result=m.solo14GhostMode
        ? `${esc(m.playerNames[0])} ${esc(String(m.scores[0]))} : ${esc(String(m.scores[1]))} GHOST • ${esc(solo14GhostDifficultyLabel(m,true))}`
        : `${esc(m.playerNames[0])} • ${esc(String(m.scores[0]))} bodů`;
      blocks=pdfPlayerBlock14(m,0)+(m.solo14GhostMode
        ? `<div style="border:1px solid #3e3e42;border-radius:14px;padding:12px;margin-top:10px;background:#101012"><strong>GHOST • ${esc(solo14GhostDifficultyLabel(m,true))}</strong><div style="margin-top:5px;color:#a7a7ad">Chyby hráče (MISS / faul): ${esc(String(m.solo14GhostErrors||0))}</div></div>`
        : '');
    }else if(m.winnerTableMode){
      title=(m.discipline||'').toUpperCase()+' - VÍTĚZ NA STOLE';
      const order=[0,1,2].sort((a,b)=>(m.winnerTable.wins[b]||0)-(m.winnerTable.wins[a]||0));
      result=order.map(i=>`${esc(m.winnerTable.players[i].displayName)} ${esc(String(m.winnerTable.wins[i]||0))}`).join(' • ');
      blocks=pdfWinnerTableBlock(m);
    }else if(m.ghostMode){
      title=(m.discipline||'').toUpperCase()+' - GHOST';
      result=`${esc(m.playerNames[0])} ${esc(String(m.scores[0]))} : ${esc(String(m.scores[1]))} GHOST`;
      blocks=pdfGhostBlock(m);
    }else if(m.discipline==='14.1'){
      title='14.1 NEKONEČNÁ';
      result=`${esc(m.playerNames[0])} ${esc(String(m.scores[0]))} : ${esc(String(m.scores[1]))} ${esc(m.playerNames[1])}`;
      blocks=pdfPlayerBlock14(m,0)+pdfPlayerBlock14(m,1);
    }else{
      title=(m.discipline||'').toUpperCase();
      result=`${esc(m.playerNames[0])} ${esc(String(m.scores[0]))} : ${esc(String(m.scores[1]))} ${esc(m.playerNames[1])}`;
      blocks=pdfPlayerBlockNormal(m,0)+pdfPlayerBlockNormal(m,1);
    }

    const matchTitle=m.streamMatchTitle ? `<div style="font-size:14px;color:#f1d67a;font-weight:850;margin-top:3px">${esc(m.streamMatchTitle)}</div>` : '';

    return `<div id="pdfReportRoot" style="
      width:794px;
      min-height:1123px;
      background:#09090b;
      color:#fff;
      padding:36px 40px 32px;
      font-family:Arial,Helvetica,sans-serif;
      box-sizing:border-box;
    ">
      <div style="display:flex;align-items:center;gap:18px;border-bottom:2px solid #d4af37;padding-bottom:18px">
        ${logo?`<img src="${logo}" style="width:78px;height:78px;object-fit:contain">`:''}
        <div style="flex:1">
          <div style="font-size:12px;color:#d4af37;font-weight:900;letter-spacing:1.5px">BC RYBÁRNA SCOREBOARD</div>
          <div style="font-size:28px;font-weight:950;margin-top:4px">STATISTIKY ZÁPASU</div>
          ${matchTitle}
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:#bcbcbc;font-weight:800">${status}</div>
          <div style="font-size:11px;color:#bcbcbc;margin-top:4px">${esc(date)}</div>
        </div>
      </div>

      <div style="margin-top:22px;text-align:center">
        <div style="font-size:17px;color:#d4af37;font-weight:950;letter-spacing:.5px">${esc(title)}</div>
        <div style="font-size:31px;font-weight:950;margin-top:8px">${result}</div>
        <div style="font-size:12px;color:#bcbcbc;margin-top:8px">
          Délka zápasu: ${esc(durationText(m))}
          ${m.discipline==='14.1' ? ` • Cíl: ${esc(String(m.target||''))} bodů` :
             m.winnerTableMode ? ` • 3 hráči • nekonečná session` :
             m.ghostMode ? ` • Hraje se do ${esc(String(m.target||''))} bodů` :
             ` • Race to ${esc(String(m.target||''))}`}
        </div>
      </div>

      <div style="margin-top:18px">
        ${blocks}
      </div>

      <div style="margin-top:22px;border-top:1px solid #38383c;padding-top:12px;display:flex;justify-content:space-between;gap:20px;font-size:10px;color:#8f8f93">
        <div>Vygenerováno z BC Rybárna Scoreboard</div>
        <div>${esc(new Date().toLocaleString('cs-CZ'))}</div>
      </div>
    </div>`;
  }

  async function createMatchPdfBlob(m){
    if(!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF){
      throw new Error('PDF knihovny se nenačetly. Zkontroluj internet a zkus to znovu.');
    }

    const host=$('pdfReportHost');
    host.innerHTML=buildPdfReportHtml(m);
    const root=host.querySelector('#pdfReportRoot');

    // Give embedded logo/layout a moment to settle.
    await new Promise(r=>setTimeout(r,120));

    const canvas=await html2canvas(root,{
      backgroundColor:'#09090b',
      scale:2,
      useCORS:true,
      logging:false
    });

    const {jsPDF}=window.jspdf;
    const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    const pageW=210;
    const pageH=297;
    const margin=7;
    const usableW=pageW-margin*2;
    const usableH=pageH-margin*2;

    // Slice tall canvas into A4-sized raster pages.
    const slicePx=Math.floor(canvas.width*(usableH/usableW));
    let y=0;
    let page=0;

    while(y<canvas.height){
      const h=Math.min(slicePx,canvas.height-y);
      const slice=document.createElement('canvas');
      slice.width=canvas.width;
      slice.height=h;
      const ctx=slice.getContext('2d');
      ctx.drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);

      const img=slice.toDataURL('image/jpeg',0.92);
      const imgH=usableW*(h/canvas.width);

      if(page>0) pdf.addPage();
      pdf.addImage(img,'JPEG',margin,margin,usableW,imgH,undefined,'FAST');

      y+=h;
      page++;
    }

    host.innerHTML='';
    return pdf.output('blob');
  }

  async function generateAndShareMatchPdf(m){
    if(!m) return;
    const btn=$('matchStatsPdf');
    const oldLabel=btn?btn.textContent:'';
    if(btn){btn.disabled=true;btn.textContent='GENERUJI PDF…';}

    try{
      const blob=await createMatchPdfBlob(m);
      const discipline=pdfSafeName(m.discipline||'zapas');
      const p1=pdfSafeName(m.playerNames?.[0]||'hrac');
      const date=new Date(m.startedAt||Date.now()).toISOString().slice(0,10);
      const filename=`BC_Rybarna_${date}_${discipline}_${p1}.pdf`;
      const file=new File([blob],filename,{type:'application/pdf'});

      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({
          title:'BC Rybárna - statistiky zápasu',
          text:'PDF report statistik zápasu',
          files:[file]
        });
      }else{
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url;
        a.download=filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),5000);
        toast('PDF report stažen.');
      }
    }catch(e){
      if(e && e.name==='AbortError') return;
      console.warn('PDF report:',e);
      toast(String(e && e.message ? e.message : 'PDF se nepodařilo vytvořit.'));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=oldLabel||'PDF REPORT';}
    }
  }

  async function createStatisticsSectionPdfBlob(kind){
    if(!window.html2canvas || !window.jspdf || !window.jspdf.jsPDF){
      throw new Error('PDF knihovny se nenačetly. Zkontroluj internet a zkus to znovu.');
    }

    const host=$('pdfReportHost');
    const isClub=kind==='stats';
    const source=isClub?$('screen-stats'):$('myStatsView');
    if(!source) throw new Error('Statistiky nejsou dostupné.');

    const content=document.createElement('div');
    if(isClub){
      const main=$('statsView');
      const h2h=$('h2hView');
      const tournament=$('tournamentStatsPanel');
      if(main) content.appendChild(main.cloneNode(true));

      const h2h1=$('h2hPlayer1'),h2h2=$('h2hPlayer2'),h2hd=$('h2hDiscipline');
      if(h2h && h2h.textContent.trim()){
        const h=document.createElement('div');
        h.innerHTML='<div style="margin-top:22px;border-top:1px solid #38383c;padding-top:16px">'+
          '<div style="font-size:18px;font-weight:950;color:#f1d67a">VZÁJEMNÉ ZÁPASY</div>'+
          '<div style="font-size:12px;color:#bcbcbc;margin-top:4px">'+
          esc(h2h1?.selectedOptions?.[0]?.textContent||'')+' × '+esc(h2h2?.selectedOptions?.[0]?.textContent||'')+
          ' • '+esc(h2hd?.selectedOptions?.[0]?.textContent||'')+'</div></div>';
        content.appendChild(h);
        content.appendChild(h2h.cloneNode(true));
      }
      if(tournament){
        const tc=tournament.cloneNode(true);
        tc.querySelectorAll('button,input,select').forEach(el=>el.remove());
        content.appendChild(tc);
      }
    }else{
      content.appendChild(source.cloneNode(true));
    }

    content.querySelectorAll('button,input,select').forEach(el=>el.remove());
    content.querySelectorAll('[onclick]').forEach(el=>el.removeAttribute('onclick'));

    const player=currentUserPlayerId?data.players?.[currentUserPlayerId]:null;
    const discipline=typeof myStatsDiscipline!=='undefined'?myStatsDiscipline:'all';
    const reportTitle=isClub?'STATISTICKÝ PŘEHLED HRÁČŮ':'MOJE STATISTIKY';
    const reportSub=isClub
      ? 'Souhrnný přehled hráčů, vzájemných zápasů a turnajových statistik'
      : (playerDisplayName(player||{})||'Hráč')+' • '+(discipline==='all'?'CELKEM':String(discipline).toUpperCase());

    const root=document.createElement('div');
    root.id='sectionPdfReportRoot';
    root.style.cssText='width:'+(isClub?'1380px':'794px')+';background:#09090b;color:#f4f4f4;padding:30px;font-family:Inter,Segoe UI,Arial,sans-serif;box-sizing:border-box;';
    root.innerHTML=
      '<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:20px;border-bottom:2px solid #d4af37;padding-bottom:15px;margin-bottom:20px">'+
        '<div><div style="font-size:12px;color:#d4af37;font-weight:950;letter-spacing:1.1px">POOLČÍTADLO • BC RYBÁRNA</div>'+
        '<div style="font-size:30px;font-weight:950;margin-top:5px">'+esc(reportTitle)+'</div>'+
        '<div style="font-size:13px;color:#bcbcbc;margin-top:5px">'+esc(reportSub)+'</div></div>'+
        '<div style="font-size:11px;color:#8f8f93;text-align:right">Vygenerováno<br>'+esc(new Date().toLocaleString('cs-CZ'))+'</div>'+
      '</div>';
    root.appendChild(content);

    root.querySelectorAll('.card,.subpanel').forEach(el=>{
      el.style.background='#101012';
      el.style.borderColor='#333338';
      el.style.boxShadow='none';
    });
    root.querySelectorAll('.stats-table').forEach(table=>{
      table.style.fontSize=isClub?'10px':'12px';
      table.style.width='100%';
    });
    root.querySelectorAll('.stats-table th,.stats-table td').forEach(cell=>{
      cell.style.padding=isClub?'6px 4px':'8px 6px';
    });

    host.style.width=isClub?'1380px':'794px';
    host.innerHTML='';
    host.appendChild(root);
    await new Promise(resolve=>setTimeout(resolve,120));

    const canvas=await html2canvas(root,{backgroundColor:'#09090b',scale:isClub?1.5:2,useCORS:true,logging:false});
    const {jsPDF}=window.jspdf;
    const orientation=isClub?'landscape':'portrait';
    const pdf=new jsPDF({orientation,unit:'mm',format:'a4',compress:true});
    const pageW=orientation==='landscape'?297:210;
    const pageH=orientation==='landscape'?210:297;
    const margin=7,usableW=pageW-margin*2,usableH=pageH-margin*2;
    const slicePx=Math.floor(canvas.width*(usableH/usableW));
    let y=0,page=0;
    while(y<canvas.height){
      const h=Math.min(slicePx,canvas.height-y);
      const slice=document.createElement('canvas');
      slice.width=canvas.width;slice.height=h;
      slice.getContext('2d').drawImage(canvas,0,y,canvas.width,h,0,0,canvas.width,h);
      const img=slice.toDataURL('image/jpeg',0.92);
      const imgH=usableW*(h/canvas.width);
      if(page>0)pdf.addPage();
      pdf.addImage(img,'JPEG',margin,margin,usableW,imgH,undefined,'FAST');
      y+=h;page++;
    }
    host.innerHTML='';
    host.style.width='794px';
    return pdf.output('blob');
  }

  async function generateStatisticsSectionPdf(kind){
    const isClub=kind==='stats';
    const btn=$(isClub?'statsPdfBtn':'myStatsPdfBtn');
    const oldLabel=btn?.textContent||'PDF REPORT';
    if(btn){btn.disabled=true;btn.textContent='GENERUJI PDF…';}
    try{
      if(!isClub && (!cloudAuthenticated || !currentUserPlayerId)){
        toast('Pro vytvoření osobního PDF reportu musí být účet propojený s hráčským profilem.');
        return;
      }
      const blob=await createStatisticsSectionPdfBlob(kind);
      const player=currentUserPlayerId?data.players?.[currentUserPlayerId]:null;
      const date=new Date().toISOString().slice(0,10);
      const filename=isClub
        ? 'Poolcitadlo_statistiky_'+date+'.pdf'
        : 'Poolcitadlo_moje_statistiky_'+pdfSafeName(playerDisplayName(player||{})||'hrac')+'_'+date+'.pdf';
      const file=new File([blob],filename,{type:'application/pdf'});
      if(navigator.share && navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({title:isClub?'Poolčítadlo - statistiky':'Poolčítadlo - moje statistiky',text:'PDF report statistik',files:[file]});
      }else{
        const url=URL.createObjectURL(blob),a=document.createElement('a');
        a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
        setTimeout(()=>URL.revokeObjectURL(url),5000);
        toast('PDF report stažen.');
      }
    }catch(e){
      if(e?.name==='AbortError')return;
      console.warn('Statistics PDF report:',e);
      toast(String(e?.message||'PDF se nepodařilo vytvořit.'));
    }finally{
      if(btn){btn.disabled=false;btn.textContent=oldLabel;}
    }
  }

  $('statsPdfBtn')?.addEventListener('click',()=>generateStatisticsSectionPdf('stats'));
  $('myStatsPdfBtn')?.addEventListener('click',()=>generateStatisticsSectionPdf('my-stats'));

  window.generateSavedMatchPdf=function(id){
    const m=data.matches.find(x=>x.id===id);
    if(!m){toast('Zápas nebyl nalezen.');return;}
    generateAndShareMatchPdf(m);
  };

  function statVal(m,i,key){
    try{ return Number((m.stats && m.stats[i] && m.stats[i][key]) || 0); }
    catch(e){ return 0; }
  }

  function breakStats(m,i){
    const s=m?.stats?.[i]||null;
    const tracked=!!(s && Object.prototype.hasOwnProperty.call(s,'dryBreaks'));
    if(!tracked){
      return {tracked:false,total:0,dry:0,soft:0,fouls:0,successful:0,pct:null,potted:0,pottedTracked:0,pottedAvg:null};
    }
    const total=Math.max(0,Number(s.breaks||0));
    const dry=Math.max(0,Math.min(total,Number(s.dryBreaks||0)));
    const soft=Math.max(0,Math.min(total,Number(s.softBreaks||0)));
    const softDry=Math.max(0,Math.min(Math.min(dry,soft),Number(s.softDryBreaks||0)));
    const fouls=Math.max(0,Math.min(total,Number(s.breakFouls||0)));
    // soft+dry je jeden a tentýž break, proto překryv jednou přičteme zpět.
    const successful=Math.max(0,total-dry-soft+softDry-fouls);
    const pct=total?Math.round(successful/total*100):null;
    const potted=Math.max(0,Number(s.breakPottedBalls||0));
    const pottedTracked=Math.max(0,Number(s.breakPottedTracked||0));
    const pottedAvg=pottedTracked ? potted/pottedTracked : null;
    return {tracked:true,total,dry,soft,fouls,successful,pct,potted,pottedTracked,pottedAvg};
  }

  function buildMatchShareText(m){
    if(!m) return '';
    const date=new Date(m.startedAt).toLocaleString('cs-CZ',{dateStyle:'medium',timeStyle:'short'});
    const lines=['🎱 BC Rybárna Scoreboard'];

    if(m.solo14){
      if(m.solo14GhostMode){
        lines.push('14.1 NEKONEČNÁ • SÓLO VS GHOST • '+solo14GhostDifficultyLabel(m,true));
        lines.push(m.playerNames[0]+' '+m.scores[0]+' : '+m.scores[1]+' GHOST');
      }else{
        lines.push('14.1 NEKONEČNÁ • SÓLO TRÉNINK');
        lines.push(m.playerNames[0]+' • '+m.scores[0]+' bodů');
      }
    }else if(m.ghostMode){
      lines.push(m.discipline.toUpperCase()+' • GHOST'+(ghostBallCountLabel(m)?' • '+ghostBallCountLabel(m):''));
      lines.push(m.playerNames[0]+' '+m.scores[0]+' : '+m.scores[1]+' GHOST');
    }else{
      lines.push(m.discipline.toUpperCase()+(m.doublesMode?' • DVOJICE':''));
      lines.push(m.playerNames[0]+' '+m.scores[0]+' : '+m.scores[1]+' '+m.playerNames[1]);
    }

    lines.push(date+' • délka '+durationText(m));

    if(m.discipline==='14.1'){
      const count=m.solo14?1:2;
      for(let i=0;i<count;i++){
        const s=[];
        s.push('nejvyšší náběh '+statVal(m,i,'highRun14'));
        s.push('náběhy '+statVal(m,i,'innings14'));
        s.push('průměr '+averagePerInning14Text(m,i)+' b/náběh');
        s.push('MISS '+matchOnlyMissVal(m,i));
        s.push('SAFE '+statVal(m,i,'safeties'));
        s.push('fauly '+statVal(m,i,'fouls'));
        const pen=statVal(m,i,'foulPenaltyPoints14');
        if(pen) s.push('trestné body −'+pen);
        const three=statVal(m,i,'threeFoulPenalties14');
        if(three) s.push('3× faul '+three+'×');
        lines.push(m.playerNames[i]+': '+s.join(' • '));
      }
    }else if(m.ghostMode){
      const c=ghostOutcomeCounts(m);
      lines.push(
        'Čistě +2: '+c.clean+
        ' • BIH +1: '+c.bih+
        ' • Eso +2: '+c.ace+
        ' • Nedohráno: '+c.failed+
        ' • Dry break: '+c.dry+
        ' • Soft break: '+c.soft+
        ' • Faul z rozstřelu: '+c.breakFoul
      );
      const missMap=m?.stats?.[0]?.ghostMissesByBall||{};
      const missRows=Object.entries(missMap).filter(([,v])=>Number(v)>0).sort((a,b)=>Number(a[0])-Number(b[0]));
      if(missRows.length)lines.push('Chyby na koulích: '+missRows.map(([b,n])=>'#'+b+' '+n+'×').join(' • '));

      const history=ghostRackHistoryRows(m);
      if(history.length){
        lines.push('');
        lines.push('PRŮBĚH RACKŮ:');
        history.forEach(r=>{
          const ball=r.errorBall?' • chyba na '+r.errorBall:'';
          const delta=r.playerDelta?(' • hráč +'+r.playerDelta):(r.ghostDelta?(' • Ghost +'+r.ghostDelta):'');
          const score=(r.scorePlayer!=null&&r.scoreGhost!=null)?(' • '+r.scorePlayer+':'+r.scoreGhost):'';
          lines.push('Rack '+(r.rack||'—')+' • '+(r.label||r.type||'—')+ball+delta+score);
        });
      }
    }else{
      for(let i=0;i<2;i++){
        const br=breakStats(m,i);
        lines.push(
          m.playerNames[i]+': break '+(br.tracked?br.total:'—')+
          ' • dry '+(br.tracked?br.dry:'—')+
          ' • úspěšnost '+(br.pct===null?'—':br.pct+' %')+
          ' • B&R '+statVal(m,i,'breakAndRun')+
          ' • runout '+statVal(m,i,'runouts')+
          ' • SAFE '+statVal(m,i,'safeties')
        );
      }
    }

    return lines.join('\n');
  }

  
  async function sharePlainText(title,text,successMessage='Text zkopírován do schránky.'){
    try{
      if(navigator.share){
        await navigator.share({title:title||'BC Rybárna',text:String(text||'')});
        return true;
      }
      if(navigator.clipboard?.writeText){
        await navigator.clipboard.writeText(String(text||''));
        toast(successMessage);
        return true;
      }
    }catch(e){
      if(e?.name==='AbortError')return false;
    }
    try{
      const ta=document.createElement('textarea');
      ta.value=String(text||'');
      ta.style.position='fixed';
      ta.style.opacity='0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast(successMessage);
      return true;
    }catch(e){
      toast('Sdílení se nepodařilo.');
      return false;
    }
  }

  function tournamentCompletedMatchesText(t){
    const rows=allTournamentMatches(t)
      .filter(m=>m && (m.status==='done'||m.winnerId||m.loserId))
      .map(m=>{
        const a=tournamentPlayerName(m.player1Id,t);
        const b=tournamentPlayerName(m.player2Id,t);
        return `${m.roundLabel||'Zápas'} • ${a} ${Number(m.score1||0)}:${Number(m.score2||0)} ${b}`;
      });
    return rows;
  }

  function buildTournamentShareText(t){
    if(!t)return '';
    const lines=[];
    lines.push('🎱 BC Rybárna');
    lines.push(String(t.name||'Turnaj'));
    lines.push(`${tournamentFormatLabel(t)} • ${tournamentDisciplineSummary(t)} • Race to ${t.raceTo}`);
    lines.push(t.status==='complete'?'DOKONČENO':'PRŮBĚŽNÉ VÝSLEDKY');

    if(tournamentHasGroups(t) && Array.isArray(t.groups)){
      t.groups.forEach(g=>{
        lines.push('');
        lines.push(`SKUPINA ${g.id}`);
        const st=groupStandings(g,t);
        st.forEach((r,i)=>{
          lines.push(`${i+1}. ${tournamentPlayerName(r.id,t)} • ${r.v}V ${r.p}P • racky ${r.rf}:${r.ra} • ${r.diff>0?'+':''}${r.diff}`);
        });
        const gm=(g.matches||[])
          .filter(m=>m && (m.status==='done'||m.winnerId||m.loserId));
        if(gm.length){
          lines.push('Výsledky:');
          gm.forEach(m=>lines.push(`• ${tournamentPlayerName(m.player1Id,t)} ${Number(m.score1||0)}:${Number(m.score2||0)} ${tournamentPlayerName(m.player2Id,t)}`));
        }
      });
    }

    if(t.ko){
      const rows=knockoutPlacementRows(t);
      if(rows.length){
        lines.push('');
        lines.push(t.status==='complete'?'KONEČNÉ POŘADÍ':'PRŮBĚŽNÉ POŘADÍ');
        rows.forEach(r=>lines.push(`${r.place}: ${r.ids.map(id=>tournamentPlayerName(id,t)).join(', ')}`));
      }
    }else if(t.dko){
      if(t.dko.championId||t.dko.runnerUpId){
        lines.push('');
        if(t.dko.championId)lines.push(`1. místo: ${tournamentPlayerName(t.dko.championId,t)}`);
        if(t.dko.runnerUpId)lines.push(`2. místo: ${tournamentPlayerName(t.dko.runnerUpId,t)}`);
        if(t.dko.thirdPlaceWinnerId)lines.push(`3. místo: ${tournamentPlayerName(t.dko.thirdPlaceWinnerId,t)}`);
      }
    }else if(t.format==='swiss'){
      const completed=tournamentCompletedMatchesText(t);
      if(completed.length){
        lines.push('');
        lines.push('ODEHRANÉ ZÁPASY');
        completed.forEach(x=>lines.push('• '+x));
      }
    }

    if(!tournamentHasGroups(t) && !t.ko && !t.dko && t.format!=='swiss'){
      const completed=tournamentCompletedMatchesText(t);
      if(completed.length){
        lines.push('');
        lines.push('VÝSLEDKY');
        completed.forEach(x=>lines.push('• '+x));
      }
    }

    return lines.join('\n');
  }

  window.shareTournament=async function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t){toast('Turnaj nebyl nalezen.');return;}
    const text=buildTournamentShareText(t);
    await sharePlainText('BC Rybárna – '+(t.name||'turnaj'),text,'Výsledky turnaje zkopírovány do schránky.');
  };

async function shareMatchStats(m){
    if(!m)return;
    const shareText=buildMatchShareText(m);
    await sharePlainText('BC Rybárna – výsledek zápasu',shareText,'Výsledek zápasu zkopírován do schránky.');
  }

  window.shareSavedMatch=function(id){
    const m=data.matches.find(x=>x.id===id);
    if(!m){ toast('Zápas nebyl nalezen.'); return; }
    shareMatchStats(m);
  };

  function durationText(m){
    if(!m.endedAt) return '—';
    const s=Math.max(0,Math.round((new Date(m.endedAt)-new Date(m.startedAt))/1000));
    const h=Math.floor(s/3600),min=Math.floor((s%3600)/60),sec=s%60;
    return (h?String(h).padStart(2,'0')+':':'')+String(min).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  }

    function matchConfirmationBadge(m){
    if(m?.adminConfirmation?.confirmed===true)return '<span class="badge gold">POTVRZENO ADMINEM</span>';
    if(!m?.confirmationRequired)return '';
    if(m.status==='needs_correction'||m.confirmationState==='needs_correction')return '<span class="badge" style="border-color:#7d2424;color:#ff9c9c">K OPRAVĚ</span>';
    if(matchConfirmationComplete(m))return '<span class="badge gold">POTVRZENO OBOUSTRANNĚ</span>';
    return '<span class="badge" style="border-color:#705820;color:#f1d67a">ČEKÁ NA POTVRZENÍ</span>';
  }


  function matchIsDoubles(m){
    if(!m)return false;
    if(m.doublesMode===true)return true;
    if(Array.isArray(m.teamPlayerIds) && m.teamPlayerIds.some(side=>Array.isArray(side)&&side.filter(Boolean).length>1))return true;
    if(Array.isArray(m.teamPlayerNames) && m.teamPlayerNames.some(side=>Array.isArray(side)&&side.filter(Boolean).length>1))return true;
    if(Array.isArray(m.playerNames) && m.playerNames.some(n=>String(n||'').includes(' + ')))return true;
    return false;
  }

  function matchHandicapScores(m){
    const hs=Array.isArray(m?.handicapScores)?m.handicapScores:[0,0];
    return [Number(hs[0]||0),Number(hs[1]||0)];
  }

  function matchHasHandicap(m){
    const hs=matchHandicapScores(m);
    return !!m?.handicapEnabled || hs[0]!==0 || hs[1]!==0;
  }

  function matchFormatBadgesHtml(m){
    const doubles=matchIsDoubles(m);
    const handicap=matchHasHandicap(m);
    const hs=matchHandicapScores(m);
    if(!doubles && !handicap)return '';
    return `${doubles?'<span class="badge gold">DVOJICE</span>':''}
      ${handicap?`<span class="badge" style="margin-left:${doubles?'6px':'0'};border-color:#705820;color:#f1d67a">HANDICAP ${esc(String(hs[0]))}:${esc(String(hs[1]))}</span>`:''}`;
  }


  function winnerTableProgressRows(m){
    const wt=m?.winnerTable,players=Array.isArray(wt?.players)?wt.players.slice(0,3):[];
    if(!m?.winnerTableMode||players.length!==3)return [];
    const rows=Array.isArray(wt.rackHistory)?wt.rackHistory:[];
    if(rows.length)return rows.map((r,i)=>({rack:i+1,winnerIndex:Number(r?.winnerIndex),scores:Array.isArray(r?.wins)?r.wins.slice(0,3).map(n=>Math.max(0,Number(n)||0)):null}))
      .filter(r=>Number.isInteger(r.winnerIndex)&&r.winnerIndex>=0&&r.winnerIndex<3&&r.scores?.length===3);
    // Historická data: rekonstrukce jen podle jednoznačných jmen a uložených událostí.
    const names=players.map(p=>String(p?.displayName||p?.realName||'').trim());
    if(!names.every(Boolean)||new Set(names).size!==3)return [];
    const scores=[0,0,0],out=[],marker=' vyhrává rack • celkem ';
    (Array.isArray(m.events)?m.events:[]).forEach(e=>{
      const txt=String(e?.text||''),at=txt.indexOf(marker);
      if(at<=0)return;
      const wi=names.indexOf(txt.slice(0,at)),next=parseInt(txt.slice(at+marker.length),10);
      if(wi<0||!Number.isInteger(next)||next!==scores[wi]+1)return;
      scores[wi]=next;out.push({rack:out.length+1,winnerIndex:wi,scores:scores.slice()});
    });
    return out;
  }
  function winnerTableProgressHtml(m,compact=false){
    if(!m?.winnerTableMode||!m.winnerTable)return '';
    const names=m.winnerTable.players.map((p,i)=>p?.displayName||p?.realName||('Hráč '+(i+1)));
    const all=winnerTableProgressRows(m),visible=compact?all.slice(-5):all;
    const heading=compact?'POSLEDNÍ RACKY • VÝVOJ SKÓRE':'VÝVOJ SKÓRE • RACK PO RACKU';
    const content=visible.length
      ? '<div class="wt-progress-scroll"><table class="wt-progress-table"><thead><tr><th>Rack</th><th>Vítěz</th>'+
        names.map(n=>'<th>'+esc(n)+'</th>').join('')+'</tr></thead><tbody>'+
        visible.map(r=>'<tr><td>#'+r.rack+'</td><td class="wt-progress-winner">'+esc(names[r.winnerIndex])+'</td>'+
        r.scores.map((score,i)=>'<td class="'+(i===r.winnerIndex?'wt-progress-highlight':'')+'">'+esc(String(score))+'</td>').join('')+'</tr>').join('')+
        '</tbody></table></div>'+
        (compact&&all.length>visible.length?'<div class="muted" style="font-size:11px;margin-top:5px">Posledních '+visible.length+' z '+all.length+' racků. Kompletní průběh je ve statistikách.</div>':'')
      : '<div class="muted" style="font-size:12px">Zatím žádný vyhraný rack.</div>';
    return '<div class="wt-progress-box"><div class="wt-progress-title">'+heading+'</div>'+content+'</div>';
  }
function winnerTableHistoryRows(m){
    if(!m?.winnerTableMode || !m?.winnerTable)return [];
    const players=Array.isArray(m.winnerTable.players)?m.winnerTable.players:[];
    const wins=Array.isArray(m.winnerTable.wins)?m.winnerTable.wins:[];
    return players.slice(0,3).map((p,i)=>({
      index:i,
      name:p?.displayName||p?.realName||('Hráč '+(i+1)),
      wins:Number(wins[i]||0)
    })).sort((a,b)=>b.wins-a.wins || a.index-b.index);
  }

  function winnerTableHistoryHtml(m){
    const rows=winnerTableHistoryRows(m);
    if(!rows.length)return '';
    return `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px">
      ${rows.map((r,pos)=>`<div class="subpanel" style="margin:0;padding:9px 7px;text-align:center;${pos===0?'border-color:var(--gold);':''}">
        <div class="muted" style="font-size:10px;font-weight:900">${pos===0?'NEJVÍCE VÝHER':'HRÁČ'}</div>
        <div style="font-weight:950;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.name)}</div>
        <div style="font-size:22px;font-weight:950;color:var(--gold2);margin-top:3px">${r.wins}</div>
        <div class="muted" style="font-size:10px">VÝHER</div>
      </div>`).join('')}
    </div>`;
  }

function renderHistory(){
    // Rozehrané cloudové zálohy patří do LIVESCORE, ne do historie výsledků.
    const list=[...data.matches]
      .filter(m=>m && !['playing','active'].includes(m.status))
      .sort((a,b)=>new Date(b.startedAt)-new Date(a.startedAt));
    $('historyList').innerHTML = list.length ? list.map(m=>{
      const date=new Date(m.startedAt).toLocaleString('cs-CZ',{dateStyle:'medium',timeStyle:'short'});
      const complete=(m.status||'complete')==='complete';
      return `<div class="history-item">
        <div class="history-line">
          <div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${m.solo14
                ? `<strong>${esc(m.playerNames[0])}</strong> • <strong>SÓLO 14.1${m.solo14GhostMode?' VS GHOST':''}</strong>`
                : (m.winnerTableMode
                    ? `<strong>VÍTĚZ NA STOLE</strong> • ${winnerTableHistoryRows(m).map(r=>`<strong>${esc(r.name)}</strong>`).join(' • ')}`
                    : (m.ghostMode
                        ? `<strong>${esc(m.playerNames[0])}</strong> vs <strong>GHOST</strong>`
                        : `<strong>${esc(savedMatchSideDisplayName(m,0))}</strong> vs <strong>${esc(savedMatchSideDisplayName(m,1))}</strong>`))}
              ${matchFormatBadgesHtml(m)}
              <span class="status-badge ${complete?'complete':'incomplete'}">${complete?'DOKONČENO':(m.status==='pending_confirmation'?'ČEKÁ NA POTVRZENÍ':(m.status==='needs_correction'?'K OPRAVĚ':'NEDOHRÁNO'))}</span>
              ${matchConfirmationBadge(m)}
            </div>
            <div class="muted">${esc(m.discipline.toUpperCase())}${m.ghostMode&&ghostBallCountLabel(m)?' • '+esc(ghostBallCountLabel(m)):''}${m.solo14GhostMode?' • '+esc(solo14GhostDifficultyLabel(m,true)):''} • ${m.discipline==='14.1'?'do '+m.target:'Race to '+m.target} • ${esc(date)}</div>
          </div>
          ${m.winnerTableMode
            ? `<div class="history-score" style="font-size:15px;text-align:right">3 HRÁČI</div>`
            : `<div class="history-score">${m.scores[0]} : ${m.scores[1]}</div>`}
        </div>
        ${m.winnerTableMode ? winnerTableHistoryHtml(m)+winnerTableProgressHtml(m) : ''}
        <div class="muted" style="margin-top:8px">Délka ${durationText(m)} • ${m.discipline==='14.1'?'pouze první rozstřel':breakModeLabel(m.breakMode).toLowerCase()} • shot clock ${m.useClock?(m.clock.first+'/'+m.clock.normal):'ne'}</div>
        ${(matchIsDoubles(m)||matchHasHandicap(m))
          ? `<div style="margin-top:6px;font-size:12px;font-weight:950;color:var(--gold2)">
              ${matchIsDoubles(m)?'DVOJICE':''}
              ${matchIsDoubles(m)&&matchHasHandicap(m)?' • ':''}
              ${matchHasHandicap(m)?'HANDICAP '+esc(String(matchHandicapScores(m)[0]))+':'+esc(String(matchHandicapScores(m)[1])):''}
            </div>`
          : ''}
        ${m.solo14
          ? `<div style="margin-top:7px;font-weight:950;color:var(--gold2)">NEJVYŠŠÍ NÁBĚH: ${esc(String(statVal(m,0,'highRun14')))}</div>`
          : ''}
        <div class="item-actions">
          ${canResumeIncompleteMatch(m)
            ? `<button class="btn primary" onclick="resumeLocalMatch('${m.id}')">▶ POKRAČOVAT V ZÁPASE</button>`
            : ''}
          <button class="btn primary" onclick="showSavedMatchStats('${m.id}')">STATISTIKY ZÁPASU</button>
          <button class="btn" onclick="shareSavedMatch('${m.id}')">SDÍLET VÝSLEDEK</button>
          <button class="btn" onclick="generateSavedMatchPdf('${m.id}')">PDF</button>
          ${currentUserIsSystemAdmin()?`<button class="btn" onclick="openMatchMetadataAdmin('${m.id}')">UPRAVIT INFO</button>`:''}
          ${currentUserIsSystemAdmin() && !m.tournamentLink && m.confirmationRequired && m.adminConfirmation?.confirmed!==true && (m.status==='pending_confirmation'||m.status==='needs_correction')
            ? `<button class="btn primary" onclick="adminConfirmMatchResult('${m.id}')">POTVRDIT JAKO ADMIN</button>`
            : ''}
          ${!currentUserIsSystemAdmin() && !m.tournamentLink && m.status==='needs_correction' && m.createdByUid===cloudUid
            ? `<button class="btn primary" onclick="openMatchCorrection('${m.id}')">OPRAVIT SKÓRE</button>`
            : ''}
          ${currentUserIsSystemAdmin()?`<button class="btn danger" onclick="deleteMatch('${m.id}')">Smazat zápas</button>`:''}
        </div>
      </div>`;
    }).join('') : '<div class="empty">Zatím nejsou uložené žádné zápasy.</div>';
  }

  let correctionMatchId=null;
  let metadataAdminMatchId=null;


