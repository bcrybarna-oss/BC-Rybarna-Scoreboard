  function renderMatch(){
    if(match && !editableMatchOwnedByCurrentUser(match)){
      discardForeignLocalActiveMatch();
      toast('Tento rozehraný zápas patří jinému uživateli. Můžeš ho sledovat pouze přes LIVESCORE.');
      showScreen('live');
      return;
    }

    if(!match) return;

    // Pojistka cílového skóre: i kdyby se skóre změnilo jinou cestou,
    // dosažení cíle okamžitě ukončí běžný zápas i 14.1.
    if(!match.endedAt && (checkNormalRaceTarget() || checkFourteenOneTarget()))return;

    if(match.winnerTableMode) syncWinnerTableSlots();
    const mp1=data.players[match.playerIds[0]]||{name:match.playerRealNames?.[0]||match.playerNames[0]};
    const mp2=data.players[match.playerIds[1]]||{name:match.playerRealNames?.[1]||match.playerNames[1]};
    if(match.doublesMode){
      match.playerNames=[doublesSideNames(0).join(' + '),doublesSideNames(1).join(' + ')];
    }else{
      match.playerNames[0]=data.players[match.playerIds[0]] ? playerDisplayName(mp1) : match.playerNames[0];
      if(!match.solo14 && !match.ghostMode && data.players[match.playerIds[1]]){
        match.playerNames[1]=playerDisplayName(mp2);
      }
    }
    renderMatchSideName($('p1Display'),0);
    renderMatchSideName($('p2Display'),1);
    applyMatchAvatar(0,mp1);
    applyMatchAvatar(1,mp2);
    $('p1Subname').textContent=match.doublesMode
      ? 'DVOJICE 1'
      : playerSubname(mp1);
    $('p2Subname').textContent=match.doublesMode
      ? 'DVOJICE 2'
      : ((match.solo14||match.ghostMode)?'':playerSubname(mp2));
    $('p1Subname').classList.toggle('hidden',!$('p1Subname').textContent);
    $('p2Subname').classList.toggle('hidden',!$('p2Subname').textContent);
    $('p1Score').textContent=match.scores[0];
    $('p2Score').textContent=match.scores[1];

    const solo14View=!!match.solo14 && match.discipline==='14.1';
    $('solo14ScoreRow').classList.toggle('hidden',!solo14View);
    $('p1Score').classList.toggle('hidden',solo14View);
    $('solo14StatsPanel').classList.toggle('hidden',!solo14View);

    if(solo14View){
      $('solo14TotalScore').textContent=match.scores[0];
      $('solo14BallsTop').textContent=match.ballsOnTable==null ? 15 : match.ballsOnTable;
      $('solo14GhostScoreTile').classList.toggle('hidden',!match.solo14GhostMode);
      $('solo14ScoreRow').classList.toggle('ghost-enabled',!!match.solo14GhostMode);
      if(match.solo14GhostMode){
        $('solo14GhostScore').textContent=match.scores[1]||0;
        if($('solo14GhostLevel')){
          $('solo14GhostLevel').textContent=solo14GhostDifficultyLabel(match,true);
          $('solo14GhostLevel').classList.remove('hidden');
        }
      }else if($('solo14GhostLevel')){
        $('solo14GhostLevel').textContent='';
        $('solo14GhostLevel').classList.add('hidden');
      }
      $('solo14Innings').textContent=statVal(match,0,'innings14');
      $('solo14HighRun').textContent=statVal(match,0,'highRun14');
      $('solo14Average').textContent=averagePerInning14Text(match,0);
    }

    const classic14View=!match.solo14 && match.discipline==='14.1';
    $('classic14Overview').classList.toggle('hidden',!classic14View);
    if(classic14View){
      $('classic14P1Name').textContent=match.playerNames?.[0]||'Hráč 1';
      $('classic14P2Name').textContent=match.playerNames?.[1]||'Hráč 2';
      $('classic14P1Score').textContent=match.scores?.[0]||0;
      $('classic14P2Score').textContent=match.scores?.[1]||0;
      $('classic14Balls').textContent=match.ballsOnTable==null?15:match.ballsOnTable;
      $('classic14Turn').textContent=match.playerNames?.[Number(match.turn||0)]||'—';
      $('classic14P1Innings').textContent=statVal(match,0,'innings14');
      $('classic14P2Innings').textContent=statVal(match,1,'innings14');
      $('classic14P1High').textContent=statVal(match,0,'highRun14');
      $('classic14P2High').textContent=statVal(match,1,'highRun14');
      $('classic14P1Avg').textContent=averagePerInning14Text(match,0);
      $('classic14P2Avg').textContent=averagePerInning14Text(match,1);
    }

    $('player2Card').classList.toggle('hidden', !!match.solo14);
    const top=$('player1Card').parentElement;
    const centerStack=document.querySelector('.center-stack');
    if(match.solo14){
      // Sólo 14.1: hlavní skóre je široké a přesně uprostřed obrazovky.
      top.style.gridTemplateColumns='minmax(0,900px)';
      top.style.justifyContent='center';
      top.style.justifyItems='stretch';

      $('player1Card').style.gridColumn='1';
      $('player1Card').style.width='100%';
      $('player1Card').style.maxWidth='900px';
      $('player1Card').style.margin='0 auto';

      centerStack.style.gridColumn='1';
      centerStack.style.width='100%';
      centerStack.style.maxWidth='900px';
      centerStack.style.margin='0 auto';
    }else{
      top.style.gridTemplateColumns='';
      top.style.justifyContent='';
      top.style.justifyItems='';

      $('player1Card').style.gridColumn='';
      $('player1Card').style.width='';
      $('player1Card').style.maxWidth='';
      $('player1Card').style.margin='';

      centerStack.style.gridColumn='';
      centerStack.style.width='';
      centerStack.style.maxWidth='';
      centerStack.style.margin='';
    }
    $('player1Card').classList.toggle('on-turn',match.turn===0);
    $('player2Card').classList.toggle('on-turn',match.turn===1);
    const waitingForLag=!!match.useLag && match.lagWinner==null && match.rackNumber===1 && !(match.events||[]).some(e=>/Rack 1 • rozstřel/.test(String(e.text||'')));
    $('p1BreakBadge').classList.toggle('hidden',waitingForLag || match.breaker!==0);
    $('p2BreakBadge').classList.toggle('hidden',waitingForLag || match.breaker!==1);
    $('turnText').textContent=waitingForLag
      ? 'Čeká se na výsledek tempa'
      : (match.solo14
        ? 'Sólo trénink: '+match.playerNames[0]
        : (match.ghostMode
          ? 'GHOST mód • '+match.playerNames[0]+' rozstřeluje každý rack'
          : (match.winnerTableMode
            ? 'Na tahu: '+match.playerNames[match.turn]+' • čeká '+match.winnerTable.players[match.winnerTable.waiting].displayName
            : 'Na tahu: '+match.playerNames[match.turn])));

    const d=match.discipline.toUpperCase();
    $('matchMeta').textContent = match.discipline==='14.1'
      ? d+' • DO '+match.target
      : (match.winnerTableMode
        ? d+' • VÍTĚZ NA STOLE'
        : (match.ghostMode
          ? d+' • GHOST • DO '+match.target+(ghostBallCountLabel(match)?' • '+ghostBallCountLabel(match):'')
          : (match.doublesMode
            ? d+' • DVOJICE • RACE TO '+match.target+' • '+breakModeLabel(match.breakMode)+(match.discipline==='9-ball'&&nineBallBreakRuleLabel(match.nineBallBreakRule)?' • '+nineBallBreakRuleLabel(match.nineBallBreakRule):'')
            : d+' • RACE TO '+match.target+' • '+breakModeLabel(match.breakMode)+(match.discipline==='9-ball'&&nineBallBreakRuleLabel(match.nineBallBreakRule)?' • '+nineBallBreakRuleLabel(match.nineBallBreakRule):''))));

    if($('matchDescription')){
      const description=String(match.streamMatchTitle||'').trim();
      $('matchDescription').textContent=description;
      $('matchDescription').classList.toggle('hidden',!description);
    }
    refreshStreamDirector();

    const show3=match.useThreeFoul && !match.ghostMode && (match.discipline==='9-ball'||match.discipline==='10-ball');
    [0,1].forEach(i=>{
      const fb=$(i===0?'p1FoulBadge':'p2FoulBadge');
      fb.classList.toggle('hidden',!show3);
      fb.textContent='FOULS '+match.consecutiveFouls[i]+'/3';
      fb.classList.toggle('warn',match.consecutiveFouls[i]===2);

      const eb=$(i===0?'p1ExtBadge':'p2ExtBadge');
      eb.classList.toggle('hidden',!match.useClock || match.clock.extensionsPerRack===0);
      eb.textContent='EXT '+Math.max(0,match.clock.extensionsPerRack-match.extensionsUsed[i]);
    });

    $('clockWrap').classList.toggle('hidden',!match.useClock);
    const simpleCounter=match.counterMode==='simple';
    const showEightBallResult =
      match.discipline==='8-ball' &&
      !simpleCounter &&
      !match.ghostMode &&
      !match.solo14;
    if($('eightBallResultPanel'))$('eightBallResultPanel').classList.toggle('hidden',!showEightBallResult);
    if(showEightBallResult){
      if($('eightBallResultName0'))$('eightBallResultName0').textContent=match.playerNames?.[0]||'Hráč 1';
      if($('eightBallResultName1'))$('eightBallResultName1').textContent=match.playerNames?.[1]||'Hráč 2';

      [0,1].forEach(i=>{
        const cleanBtn=$(i===0?'eightBallClean0':'eightBallClean1');
        const runoutBtn=$(i===0?'eightBallRunout0':'eightBallRunout1');

        const cleanAllowed =
          i===Number(match.breaker||0) &&
          i===Number(match.turn||0) &&
          match.breakAndRunEligible!==false;

        const runoutAllowed =
          match.runoutEligibleFor===i ||
          (i!==Number(match.breaker||0) && match.breakAndRunEligible===false);

        if(cleanBtn){
          cleanBtn.disabled=!cleanAllowed;
          cleanBtn.title=cleanAllowed
            ? 'Break & Run po vlastním rozstřelu'
            : 'ČISTÁ je možná pouze po vlastním rozstřelu bez předání stolu';
        }
        if(runoutBtn){
          runoutBtn.disabled=!runoutAllowed;
          runoutBtn.title=runoutAllowed
            ? 'Dohrání stolu po soupeřově dry breaku / předání stolu'
            : 'DOHRÁVKA je dostupná po předání stolu';
        }
      });
    }

const isFourteen=match.discipline==='14.1' && !simpleCounter;
    $('p1Fourteen').classList.toggle('hidden',true);
    $('p2Fourteen').classList.toggle('hidden',true);
    if(isFourteen){
      const fourteenMiniStats=i=>{
        const innings=statVal(match,i,'innings14');
        const highRun=statVal(match,i,'highRun14');
        const avg=averagePerInning14Text(match,i);
        return `<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:10px">
          <div class="subpanel" style="padding:8px 5px;text-align:center">
            <div class="muted" style="font-size:10px;font-weight:900">NÁBĚHY</div>
            <div style="font-size:18px;font-weight:950;margin-top:2px">${innings}</div>
          </div>
          <div class="subpanel" style="padding:8px 5px;text-align:center">
            <div class="muted" style="font-size:10px;font-weight:900">HIGH RUN</div>
            <div style="font-size:18px;font-weight:950;margin-top:2px">${highRun}</div>
          </div>
          <div class="subpanel" style="padding:8px 5px;text-align:center;border-color:var(--gold)">
            <div class="muted" style="font-size:10px;font-weight:900">PRŮMĚR / NÁBĚH</div>
            <div style="font-size:18px;font-weight:950;color:var(--gold2);margin-top:2px">${avg}</div>
          </div>
        </div>`;
      };
      $('p1Fourteen').innerHTML='';
      $('p2Fourteen').innerHTML='';
    }else{
      $('p1Fourteen').innerHTML='';
      $('p2Fourteen').innerHTML='';
    }
    $('fourteenActions').classList.toggle('hidden',!isFourteen);
    $('fourteenPanel')?.classList.toggle('solo14-actions',!!match.solo14 && isFourteen);
    $('ghostActions').classList.toggle('hidden',simpleCounter || !match.ghostMode);
    $('simpleCounterActions').classList.toggle('hidden',!simpleCounter);
    $('normalActions').classList.toggle('hidden',simpleCounter || match.discipline==='14.1' || match.ghostMode);

    // Kontextová tlačítka: hráč vidí pouze akce, které dávají smysl v aktuálním stavu stolu.
    const normalGame=!simpleCounter && match.discipline!=='14.1' && !match.ghostMode;
    const breakPhase=normalGame && !!match.isBreakShot && match.turn===match.breaker;
    const escapeOnly=normalGame && match.safetyEscapeEligibleFor===match.turn;
    const softReturnChoice=normalGame && match.softBreakReturnEligibleFor===match.turn;
    const pushOutDecision=normalGame && match.pushOutDecisionFor===match.turn && match.pushOutBy!=null;
    const regularPlay=normalGame && !breakPhase && !escapeOnly && !pushOutDecision;
    const compactNoClock=!match.useClock;
    const showAction=(id,show)=>{
      const el=$(id);
      if(!el)return;
      el.classList.toggle('hidden',!show);
      el.disabled=false;
    };

    showAction('actionBreakOkBtn',breakPhase);
    showAction('actionDryBreakBtn',breakPhase);
    showAction('actionBreakFoulBtn',breakPhase);
    showAction('actionSoftBreakBtn',breakPhase && match.discipline==='9-ball' && ['kitchen','kitchen_box'].includes(match.nineBallBreakRule));
    showAction('returnTableBtn',softReturnChoice && !escapeOnly && !pushOutDecision);
    const canPushOut=regularPlay && (match.discipline==='9-ball'||match.discipline==='10-ball') && match.pushOutEligibleFor===match.turn;
    showAction('actionPushOutBtn',canPushOut);
    showAction('acceptPushOutBtn',pushOutDecision);
    showAction('returnPushOutBtn',pushOutDecision);

    showAction('actionSafetyEscapeBtn',escapeOnly);
    showAction('actionDirectBallBtn',escapeOnly);
    // Bez shotclocku se ČISTÝ STRK běžně skrývá. Je-li ale ještě dostupný PUSH OUT,
    // zobrazíme ho jako explicitní potvrzení prvního normálního strku, po kterém PUSH OUT zaniká.
    showAction('actionLegalBtn',regularPlay && (!compactNoClock || canPushOut || (match.counterMode!=='simple' && exactBallTrackingDiscipline())));
    showAction('actionFoulBtn',regularPlay);
    showAction('actionSafeBtn',regularPlay);
    showAction('actionTwoWayBtn',regularPlay);
    const comboRackBalls=Array.isArray(match.rackRemainingBalls)&&match.rackRemainingBalls.length
      ? match.rackRemainingBalls.slice().sort((a,b)=>a-b)
      : fullRackBalls();
    const lowestRotationBall=comboRackBalls.length?comboRackBalls[0]:null;
    const gameBall=match.discipline==='9-ball'?9:(match.discipline==='10-ball'?10:null);
    const earlyTenWin=match.discipline==='10-ball' && match.tenBallRule==='early_win';

    // U 9-ball se kombinace / karambol na 9 zadává přes ČISTÝ STRK:
    // vybere se potopená 9 a následně aplikace nabídne KOMBINACE / KARAMBOL.
    // Samostatná tlačítka by byla duplicitní a matou obsluhu.
    const canSpecialGameBall=regularPlay &&
      match.discipline==='10-ball' &&
      earlyTenWin &&
      comboRackBalls.includes(10) &&
      lowestRotationBall!==10;

    showAction('actionCombo9Btn',canSpecialGameBall);
    showAction('actionCarom9Btn',canSpecialGameBall);
    if($('actionCombo9Btn'))$('actionCombo9Btn').textContent='KOMBINACE NA 10';
    if($('actionCarom9Btn'))$('actionCarom9Btn').textContent='KARAMBOL NA 10';
    showAction('actionAccidentalSafeBtn',regularPlay);
    showAction('actionMissBtn',regularPlay);

    const canBreakRun=regularPlay && match.turn===match.breaker && match.breakAndRunEligible!==false;
    const canRunout=regularPlay && match.runoutEligibleFor===match.turn;
    showAction('actionBreakRunBtn',canBreakRun);
    showAction('actionRunoutBtn',canRunout && match.discipline!=='8-ball');
    // 8-ball má vlastní DOHRÁVKA tlačítko v panelu vedle ČISTÁ.
    // Obecné žluté tlačítko dole nesmí být v 8-ball nikdy viditelné.
    if(match.discipline==='8-ball' && $('actionRunoutBtn'))$('actionRunoutBtn').classList.add('hidden');

    // Ruční změna hráče je servisní zásah; při povinném úniku ji schováme, aby nešlo obejít statistiku úniku.
    if($('switchTurnBtn'))$('switchTurnBtn').classList.toggle('hidden',!normalGame || escapeOnly || breakPhase || pushOutDecision);
    if($('manualScoreCorrectionBtn')){
      const canManualScoreCorrection=normalGame && match.counterMode!=='simple' &&
        match.discipline!=='14.1' && !match.ghostMode && !match.winnerTableMode;
      $('manualScoreCorrectionBtn').classList.toggle('hidden',!canManualScoreCorrection);
    }
    if($('undoBtn'))$('undoBtn').classList.toggle('hidden',!normalGame);

    // V běžném rozšířeném počítadle se skóre mění přes herní události.
    // U turnajových zápasů 8/9/10-ball ale musí být dostupné i rychlé +/-.
    const tournamentRackScoreAdjust =
      !!match.tournamentLink &&
      ['8-ball','9-ball','10-ball'].includes(match.discipline) &&
      !match.ghostMode &&
      !match.winnerTableMode;
    $('p1ScoreAdjust').classList.toggle('hidden',!tournamentRackScoreAdjust);
    $('p2ScoreAdjust').classList.toggle('hidden',!tournamentRackScoreAdjust);

    $('winnerTablePanel').classList.toggle('hidden',!match.winnerTableMode);
    if(match.winnerTableMode){
      const wi=match.winnerTable.waiting;
      $('wtWaitingName').textContent=match.winnerTable.players[wi].displayName;
      $('wtWaitingWins').textContent='VÝHRY: '+(match.winnerTable.wins[wi]||0);
      if($('wtLiveScoreProgress'))$('wtLiveScoreProgress').innerHTML=winnerTableProgressHtml(match,true);
    }
    if(match.ghostMode){
      const balls=ghostBallCountLabel(match);
      $('ghostRackInfo').textContent='Rack '+(match.ghostRackNumber||1)+(balls?' • '+balls:'');
      $('ghostTargetInfo').textContent='DO '+(match.target||7)+' BODŮ';
      if($('ghostAceBtn'))$('ghostAceBtn').classList.toggle('hidden',match.discipline!=='9-ball');
    }else if($('ghostAceBtn')){
      $('ghostAceBtn').classList.add('hidden');
    }
    if(match.discipline==='14.1'){
      if(match.ballsOnTable==null) match.ballsOnTable=15;
      $('ballsOnTableDisplay').textContent=match.ballsOnTable;
      if(match.solo14 && $('solo14BallsTop')){
        $('solo14BallsTop').textContent=match.ballsOnTable;
        $('solo14TotalScore').textContent=match.scores[0];
        $('solo14GhostScoreTile').classList.toggle('hidden',!match.solo14GhostMode);
        $('solo14ScoreRow').classList.toggle('ghost-enabled',!!match.solo14GhostMode);
        if(match.solo14GhostMode){
          $('solo14GhostScore').textContent=match.scores[1]||0;
          if($('solo14GhostLevel')){
            $('solo14GhostLevel').textContent=solo14GhostDifficultyLabel(match,true);
            $('solo14GhostLevel').classList.remove('hidden');
          }
        }else if($('solo14GhostLevel')){
          $('solo14GhostLevel').textContent='';
          $('solo14GhostLevel').classList.add('hidden');
        }
        $('solo14Innings').textContent=statVal(match,0,'innings14');
        $('solo14HighRun').textContent=statVal(match,0,'highRun14');
        $('solo14Average').textContent=averagePerInning14Text(match,0);
      }else if(!match.solo14 && match.discipline==='14.1' && $('classic14Overview')){
        $('classic14P1Name').textContent=match.playerNames?.[0]||'Hráč 1';
        $('classic14P2Name').textContent=match.playerNames?.[1]||'Hráč 2';
        $('classic14P1Score').textContent=match.scores?.[0]||0;
        $('classic14P2Score').textContent=match.scores?.[1]||0;
        $('classic14Balls').textContent=match.ballsOnTable;
        $('classic14Turn').textContent=match.playerNames?.[Number(match.turn||0)]||'—';
        $('classic14P1Innings').textContent=statVal(match,0,'innings14');
        $('classic14P2Innings').textContent=statVal(match,1,'innings14');
        $('classic14P1High').textContent=statVal(match,0,'highRun14');
        $('classic14P2High').textContent=statVal(match,1,'highRun14');
        $('classic14P1Avg').textContent=averagePerInning14Text(match,0);
        $('classic14P2Avg').textContent=averagePerInning14Text(match,1);
      }
      if(!match.consecutiveFouls14) match.consecutiveFouls14=[0,0];
      $('foulInfo14').textContent='Po sobě jdoucí fauly – '+match.playerNames[0]+': '+match.consecutiveFouls14[0]+' | '+match.playerNames[1]+': '+match.consecutiveFouls14[1];
      $('openingBreakFoul14').classList.toggle('hidden', !match.openingBreakAvailable14);
    }
    renderFourteenInningsHistory();
    $('manualBreaker').classList.toggle('hidden',simpleCounter || match.discipline==='14.1' || match.ghostMode || match.winnerTableMode);
    $('p1BreakBadge').classList.toggle('hidden',simpleCounter || waitingForLag || match.breaker!==0);
    $('p2BreakBadge').classList.toggle('hidden',simpleCounter || waitingForLag || match.breaker!==1);
    if(simpleCounter){
      $('turnText').textContent=match.winnerTableMode
        ? 'VÍTĚZ NA STOLE • JEDNODUCHÉ POČÍTADLO'
        : 'JEDNODUCHÉ POČÍTADLO';
      if($('simpleAddP1'))$('simpleAddP1').textContent='+1 • '+match.playerNames[0];
      if($('simpleAddP2'))$('simpleAddP2').textContent='+1 • '+match.playerNames[1];
      if($('simpleRunoutP1'))$('simpleRunoutP1').textContent='DOHRÁVKA • '+match.playerNames[0];
      if($('simpleRunoutP2'))$('simpleRunoutP2').textContent='DOHRÁVKA • '+match.playerNames[1];
      if($('simpleBreakRunWho'))$('simpleBreakRunWho').textContent='ROZSTŘELUJE • '+match.playerNames[Number(match.breaker||0)];
      $('p1FoulBadge').classList.add('hidden');
      $('p2FoulBadge').classList.add('hidden');
      $('p1ExtBadge').classList.add('hidden');
      $('p2ExtBadge').classList.add('hidden');
      $('clockWrap').classList.add('hidden');
    }
    $('finishMatch').textContent = match.solo14
      ? 'UKONČIT A ULOŽIT TRÉNINK'
      : (match.ghostMode
        ? 'UKONČIT A ULOŽIT GHOST SESSION'
        : (match.winnerTableMode ? 'UKONČIT A ULOŽIT SESSION' : 'Ukončit a uložit jako nedohraný'));
    renderRackBallState();
    renderEvents();
    renderClock();
    scheduleStreamState();
    autosaveCurrent();
  }

  function logEvent(text, meta={}){
    if(!match) return;
    match.events.push({id:uid(),ts:new Date().toISOString(),time:nowTime(),text,meta});
    renderEvents();
  }
  function renderEvents(){
    if(!match) return;
    $('eventLog').innerHTML = match.events.slice().reverse().map(e=>`<div class="event"><strong>${esc(e.time)}</strong> — ${esc(e.text)}</div>`).join('');
  }

  function snapshot(){
    return JSON.stringify({
      scores:match.scores,
      ballsOnTable:match.ballsOnTable,
      reracksInInning14:match.reracksInInning14||0,
      inningsHistory14:Array.isArray(match.inningsHistory14)?match.inningsHistory14:[],
      pendingEndReason14:match.pendingEndReason14||null,
      openingBreakAvailable14:match.openingBreakAvailable14!==false,
      consecutiveFouls14:match.consecutiveFouls14||[0,0],
      turn:match.turn,
      breaker:match.breaker,
      rackNumber:match.rackNumber,
      isBreakShot:!!match.isBreakShot,
      softBreakOriginalBreaker:match.softBreakOriginalBreaker,
      softBreakReturnEligibleFor:match.softBreakReturnEligibleFor,
      breakAndRunEligible:match.breakAndRunEligible!==false,
      runoutEligibleFor:match.runoutEligibleFor??null,
      runoutEligibleReason:match.runoutEligibleReason??null,
      pushOutEligibleFor:match.pushOutEligibleFor??null,
      pushOutBy:match.pushOutBy??null,
      pushOutDecisionFor:match.pushOutDecisionFor??null,
      safetyEscapeEligibleFor:match.safetyEscapeEligibleFor??null,
      breakPocketedBalls:Array.isArray(match.breakPocketedBalls)?match.breakPocketedBalls:[],
      rackRemainingBalls:Array.isArray(match.rackRemainingBalls)?match.rackRemainingBalls:[],
      lastMissBall:match.lastMissBall??null,
      ghostRackHistory:Array.isArray(match.ghostRackHistory)?match.ghostRackHistory:[],
      consecutiveFouls:match.consecutiveFouls,
      warnedTwoFouls:match.warnedTwoFouls,
      extensionsUsed:match.extensionsUsed,
      stats:match.stats,
      winnerTable:match.winnerTable
    });
  }
  function addActionEvent(text){
    const snap=snapshot();
    logEvent(text,{undoSnapshot:snap});
  }
  function restoreSnapshot(s){
    const x=JSON.parse(s);
    match.scores=x.scores; match.ballsOnTable=x.ballsOnTable; match.reracksInInning14=x.reracksInInning14||0; match.inningsHistory14=Array.isArray(x.inningsHistory14)?x.inningsHistory14:[]; match.pendingEndReason14=x.pendingEndReason14||null; match.openingBreakAvailable14=x.openingBreakAvailable14!==false; match.consecutiveFouls14=x.consecutiveFouls14||[0,0]; match.turn=x.turn; match.breaker=x.breaker; match.rackNumber=x.rackNumber; match.isBreakShot=!!x.isBreakShot;
    match.softBreakOriginalBreaker=x.softBreakOriginalBreaker??null;
    match.softBreakReturnEligibleFor=x.softBreakReturnEligibleFor??null;
    match.breakAndRunEligible=x.breakAndRunEligible!==false;
    match.runoutEligibleFor=x.runoutEligibleFor??null;
    match.runoutEligibleReason=x.runoutEligibleReason??null;
    match.pushOutEligibleFor=x.pushOutEligibleFor??null;
    match.pushOutBy=x.pushOutBy??null;
    match.pushOutDecisionFor=x.pushOutDecisionFor??null;
    match.safetyEscapeEligibleFor=x.safetyEscapeEligibleFor??null;
    match.breakPocketedBalls=Array.isArray(x.breakPocketedBalls)?x.breakPocketedBalls:[];
    match.rackRemainingBalls=Array.isArray(x.rackRemainingBalls)?x.rackRemainingBalls:[];
    match.lastMissBall=x.lastMissBall??null;
    match.ghostRackHistory=Array.isArray(x.ghostRackHistory)?x.ghostRackHistory:[];
    match.consecutiveFouls=x.consecutiveFouls; match.warnedTwoFouls=x.warnedTwoFouls;
    match.extensionsUsed=x.extensionsUsed; match.stats=x.stats;
    if(match.winnerTableMode && x.winnerTable){
      match.winnerTable=x.winnerTable;
      syncWinnerTableSlots();
    }
  }

  $('undoBtn').onclick=undo;
  $('undo14Btn').onclick=undo;
  function undo(){
    if(match && !editableMatchOwnedByCurrentUser(match)){
      toast('Tento zápas můžeš pouze sledovat přes LIVESCORE.');
      return;
    }

    if(!match) return;
    for(let i=match.events.length-1;i>=0;i--){
      const e=match.events[i];
      if(e.meta && e.meta.undoSnapshot){
        restoreSnapshot(e.meta.undoSnapshot);
        match.pendingEndReason14=null;
        match.events.splice(i);
        if(match.useClock) resetClock(false,false);
        renderMatch(); toast('Poslední akce vrácena.');
        return;
      }
    }
    toast('Není co vrátit.');
  }

  window.switchTurn = function(reason='Změna hráče'){
    if(!match) return;
    match.isBreakShot=false;
    addActionEvent(reason+' • '+match.playerNames[match.turn]+' → '+match.playerNames[1-match.turn]);
    match.softBreakReturnEligibleFor=null;
    match.softBreakOriginalBreaker=null;
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.pushOutEligibleFor=null;
    match.pushOutBy=null;
    match.pushOutDecisionFor=null;
    match.safetyEscapeEligibleFor=null;
    match.turn=1-match.turn;
    if(match.useClock) resetClock(false,true);
    renderMatch();
  }

  function recordBreakPottedBalls(i,count){
    if(!match || !match.stats?.[i])return;
    const n=Math.max(0,Number(count||0));
    match.stats[i].breakPottedBalls=Number(match.stats[i].breakPottedBalls||0)+n;
    match.stats[i].breakPottedTracked=Number(match.stats[i].breakPottedTracked||0)+1;
  }

  function breakPotCountMax(){
    if(!match)return 15;
    if(match.discipline==='9-ball')return 9;
    if(match.discipline==='10-ball')return 10;
    return 15;
  }

  let pendingBreakPotAction=null;
  let pendingBreakAceAction=null;
  let pendingBreakBalls=[];
  let pendingResolvedBreakBalls=null;
  let pendingResolvedBreakSpotGameBall=false;

  function recordBreakBallIds(i,balls){
    if(!match || !match.stats?.[i])return;
    [...new Set((balls||[]).map(Number))].forEach(n=>{
      if(n>=1 && n<=10){
        const key='breakBall'+n;
        match.stats[i][key]=Number(match.stats[i][key]||0)+1;
      }
    });
  }

  function exactBallTrackingDiscipline(){
    return !!match && (match.discipline==='9-ball'||match.discipline==='10-ball');
  }
  function fullRackBalls(){
    const max=match?.discipline==='9-ball'?9:(match?.discipline==='10-ball'?10:0);
    return max?Array.from({length:max},(_,k)=>k+1):[];
  }
  function applyBreakBallState(selected,{spotNine=false,spotTen=false}={}){
    if(!match || !exactBallTrackingDiscipline())return;
    const uniq=[...new Set((selected||[]).map(Number).filter(n=>n>=1&&n<=breakPotCountMax()))].sort((a,b)=>a-b);
    match.breakPocketedBalls=uniq.slice();
    let gone=uniq.slice();
    if(spotNine && match.discipline==='9-ball')gone=gone.filter(n=>n!==9);
    if(spotTen && match.discipline==='10-ball')gone=gone.filter(n=>n!==10);
    match.rackRemainingBalls=fullRackBalls().filter(n=>!gone.includes(n));
  }

  function exactBallVisualClass(n){
    const dark=[2,3,4,6,7,8,10].includes(Number(n));
    const stripe=Number(n)>=9;
    return `exact-ball-btn ${stripe?'stripe':'solid'} ball${Number(n)} ${dark?'dark':''}`;
  }
  function exactBallButtonHtml(n,{selected=false,onclick=''}={}){
    const cls=exactBallVisualClass(n)+(selected?' selected':'');
    return `<button type="button" class="${cls}" onclick="${onclick}" aria-label="Koule ${Number(n)}"><span class="ball-number">${Number(n)}</span></button>`;
  }
  function exactBallStaticHtml(n){
    const cls=exactBallVisualClass(n);
    return `<span class="${cls}" style="cursor:default;pointer-events:none;margin:0;width:42px;height:42px"><span class="ball-number" style="width:19px;height:19px;font-size:11px">${Number(n)}</span></span>`;
  }

  function renderRackBallState(){
    const panel=$('rackBallStatePanel');
    const host=$('rackBallStateBalls');
    if(!panel||!host)return;
    const show=!!(match && match.counterMode!=='simple' && !match.ghostMode && exactBallTrackingDiscipline());
    panel.classList.toggle('hidden',!show);
    if(!show)return;
    const rem=Array.isArray(match.rackRemainingBalls)?match.rackRemainingBalls:fullRackBalls();
    host.innerHTML=rem.length?rem.map(exactBallStaticHtml).join(''):'<span class="muted">Žádná evidovaná koule na stole</span>';

    const quick=$('quickRunoutBtn');
    if(quick){
      const canQuick=rem.length>0 &&
        !match.ghostMode &&
        !match.isBreakShot &&
        match.turn!=null &&
        match.pushOutDecisionFor==null &&
        match.softBreakReturnEligibleFor==null &&
        match.safetyEscapeEligibleFor==null;
      quick.classList.toggle('hidden',!canQuick);
      if(canQuick){
        quick.querySelector('span').textContent='DOHRÁT '+rem.join(' → ');
      }
    }
  }
  function renderBreakBallSelector(){
    const host=$('breakBallSelectButtons');
    if(!host)return;
    const max=breakPotCountMax();
    host.innerHTML='<div class="exact-ball-grid">'+Array.from({length:max},(_,k)=>k+1).map(n=>{
      const sel=pendingBreakBalls.includes(n);
      return exactBallButtonHtml(n,{selected:sel,onclick:`toggleBreakBall(${n})`});
    }).join('')+'</div>';
  }
  window.toggleBreakBall=function(n){
    n=Number(n);
    if(pendingBreakBalls.includes(n))pendingBreakBalls=pendingBreakBalls.filter(x=>x!==n);
    else pendingBreakBalls.push(n);
    pendingBreakBalls.sort((a,b)=>a-b);
    renderBreakBallSelector();
  };

  function renderBreakPotCountButtons(action){
    const exact=exactBallTrackingDiscipline();
    $('breakBallSelectButtons')?.classList.toggle('hidden',!exact);
    $('breakBallSelectConfirmBtn')?.classList.toggle('hidden',!exact);
    $('breakPotCountButtons')?.classList.toggle('hidden',exact);
    if(exact){ renderBreakBallSelector(); return; }
    const min=action==='break_ok'?1:0;
    const max=breakPotCountMax();
    $('breakPotCountButtons').innerHTML=Array.from({length:max-min+1},(_,k)=>k+min)
      .map(n=>`<button type="button" class="btn ${n>0?'primary':''}" style="min-width:58px" onclick="finishBreakPotCount(${n})">${n}</button>`)
      .join('');
  }

  function openBreakPotCount(action){
    if(!match)return;
    pendingBreakPotAction=action;
    pendingBreakAceAction=null;
    pendingBreakBalls=[];
    const label=action==='break_ok'?'BREAK OK':(action==='soft_break'?'SOFT BREAK':'FAUL Z BREAKU');
    $('breakPotCountText').textContent=exactBallTrackingDiscipline()
      ? label+' • označ všechny koule, které z rozstřelu spadly.'
      : label+' • kolik koulí z rozstřelu spadlo?';
    renderBreakPotCountButtons(action);
    $('breakPotCountModal').classList.add('show');
  }

  function finishExactBreakBalls(){
    if(!match || !pendingBreakPotAction)return;
    const action=pendingBreakPotAction;
    const selected=pendingBreakBalls.slice();
    const n=selected.length;
    if(action==='break_ok' && n===0){ toast('Při BREAK OK označ alespoň jednu potopenou kouli. Pro 0 použij DRY BREAK.'); return; }

    // Devítka na platném breaku v 9-ball = ESO.
    if(match.discipline==='9-ball' && selected.includes(9) && action==='break_ok'){
      const i=Number(match.breaker||0);
      saveManualEntryUndoSnapshot('Eso z breaku');
      addActionEvent('⭐ ESO • devítka z rozstřelu • '+match.playerNames[i]+' • spadly: '+selected.join(', '));
      match.stats[i]=match.stats[i]||blankMatchStats();
      recordBreakPottedBalls(i,n);
      recordBreakBallIds(i,selected);
      match.stats[i].aces=Number(match.stats[i].aces||0)+1;
      applyBreakBallState(selected);
      pendingBreakPotAction=null; pendingBreakBalls=[];
      $('breakPotCountModal').classList.remove('show');
      match.isBreakShot=false;
      match.breakAndRunEligible=false; match.runoutEligibleFor=null; match.runoutEligibleReason=null;
      match.pushOutEligibleFor=null; match.pushOutBy=null; match.pushOutDecisionFor=null; match.safetyEscapeEligibleFor=null;
      winRack(i,true,'Eso z breaku');
      return;
    }

    pendingResolvedBreakBalls=selected.slice();
    // 9 na soft/foul breaku se vrací; 10 z breaku se v 10-ball spotuje.
    pendingResolvedBreakSpotGameBall=(match.discipline==='9-ball' && selected.includes(9) && action!=='break_ok') ||
      (match.discipline==='10-ball' && selected.includes(10));
    pendingBreakBalls=[];
    finishBreakPotCount(n);

    if(action==='soft_break' && match?.discipline==='9-ball' && selected.includes(9)){
      alert('KITCHEN RULE NESPLNĚNA – DEVÍTKA SE VRACÍ NA STŮL.');
    }
    if(action==='break_foul' && match?.discipline==='9-ball' && selected.includes(9)){
      alert('FAUL Z ROZSTŘELU + POTOPENÁ 9 • DEVÍTKA SE VRACÍ NA BOD.');
    }
  }
  $('breakBallSelectConfirmBtn').onclick=finishExactBreakBalls;

  window.finishBreakPotCount=function(count){
    if(!match || !pendingBreakPotAction)return;
    const action=pendingBreakPotAction;
    // U přesného výběru koulí musíme data uchovat až do zpracování akce.
    const resolvedBreakBalls=Array.isArray(pendingResolvedBreakBalls)?pendingResolvedBreakBalls.slice():null;
    const resolvedBreakSpotGameBall=!!pendingResolvedBreakSpotGameBall;
    pendingBreakPotAction=null;
    pendingBreakBalls=[];
    $('breakPotCountModal').classList.remove('show');
    const i=Number(match.breaker||0);
    const other=1-i;
    const n=Math.max(0,Math.min(breakPotCountMax(),Number(count||0)));

    if(action==='break_ok'){
      addActionEvent('Break OK • '+match.playerNames[i]+' • '+(resolvedBreakBalls?'spadly: '+resolvedBreakBalls.join(', '):'potopeno z breaku: '+n));
      if(resolvedBreakBalls){
        recordBreakBallIds(i,resolvedBreakBalls);
        applyBreakBallState(resolvedBreakBalls,{spotTen:match.discipline==='10-ball' && resolvedBreakSpotGameBall});
      }
      recordBreakPottedBalls(i,n);
      pendingResolvedBreakBalls=null; pendingResolvedBreakSpotGameBall=false;
      match.isBreakShot=false;
      match.softBreakReturnEligibleFor=null;
      match.softBreakOriginalBreaker=null;
      match.breakAndRunEligible=true;
      match.runoutEligibleFor=null;
      match.runoutEligibleReason=null;
      match.pushOutEligibleFor=(match.discipline==='9-ball'||match.discipline==='10-ball') ? i : null;
      match.pushOutBy=null;
      match.pushOutDecisionFor=null;
      match.safetyEscapeEligibleFor=null;
      match.consecutiveFouls[i]=0;
      match.warnedTwoFouls[i]=false;
      match.turn=i;
      if(match.useClock)resetClock(false,true);
      renderMatch();
      return;
    }

    if(action==='soft_break'){
      addActionEvent('Soft break • kitchen rule nesplněna • '+match.playerNames[i]+' • '+(resolvedBreakBalls?'spadly: '+resolvedBreakBalls.join(', '):'potopeno: '+n));
      if(resolvedBreakBalls){
        recordBreakBallIds(i,resolvedBreakBalls);
        applyBreakBallState(resolvedBreakBalls,{spotNine:match.discipline==='9-ball' && resolvedBreakSpotGameBall,spotTen:match.discipline==='10-ball' && resolvedBreakSpotGameBall});
      }
      recordBreakPottedBalls(i,n);
      pendingResolvedBreakBalls=null; pendingResolvedBreakSpotGameBall=false;
      match.stats[i].softBreaks=Number(match.stats[i].softBreaks||0)+1;
      if(n===0){
        // Soft break bez potopené koule je zároveň dry break.
        match.stats[i].dryBreaks=Number(match.stats[i].dryBreaks||0)+1;
        match.stats[i].softDryBreaks=Number(match.stats[i].softDryBreaks||0)+1;
      }
      match.isBreakShot=false;
      match.softBreakOriginalBreaker=i;
      match.softBreakReturnEligibleFor=other;
      match.breakAndRunEligible=true;
      match.runoutEligibleFor=null;
      match.runoutEligibleReason=null;
      match.pushOutEligibleFor=null;
      match.pushOutBy=null;
      match.pushOutDecisionFor=null;
      match.safetyEscapeEligibleFor=null;
      match.consecutiveFouls[i]=0;
      match.warnedTwoFouls[i]=false;
      match.turn=other;
      if(match.useClock)resetClock(false,true);
      renderMatch();
      return;
    }

    if(action==='break_foul'){
      saveManualEntryUndoSnapshot('Faul z breaku');
      addActionEvent('Faul z breaku • '+match.playerNames[i]+' • '+(resolvedBreakBalls?'spadly: '+resolvedBreakBalls.join(', '):'potopeno: '+n));
      match.stats[i]=match.stats[i]||blankMatchStats();
      if(resolvedBreakBalls){
        recordBreakBallIds(i,resolvedBreakBalls);
        applyBreakBallState(resolvedBreakBalls,{spotNine:match.discipline==='9-ball' && resolvedBreakSpotGameBall,spotTen:match.discipline==='10-ball' && resolvedBreakSpotGameBall});
      }
      recordBreakPottedBalls(i,n);
      pendingResolvedBreakBalls=null; pendingResolvedBreakSpotGameBall=false;
      // Počet breaků už přičítá beginRack(); tady ho nepřičítáme podruhé.
      match.stats[i].fouls=Number(match.stats[i].fouls||0)+1;
      match.stats[i].breakFouls=Number(match.stats[i].breakFouls||0)+1;
      match.isBreakShot=false;
      match.breakAndRunEligible=false;
      // Po faulu z breaku soupeře může příchozí hráč dohrát stůl. PUSH OUT po faulu z breaku nenabízíme.
      match.runoutEligibleFor=other;
      match.runoutEligibleReason='break_foul';
      match.pushOutEligibleFor=null;
      match.pushOutBy=null;
      match.pushOutDecisionFor=null;
      match.safetyEscapeEligibleFor=null;
      match.consecutiveFouls[i]=Number(match.consecutiveFouls[i]||0)+1;
      match.warnedTwoFouls[i]=false;

      const threeFoulActive=!!match.useThreeFoul && (match.discipline==='9-ball'||match.discipline==='10-ball');
      if(threeFoulActive && match.consecutiveFouls[i]>=3){
        match.stats[i].threeFoulLosses=Number(match.stats[i].threeFoulLosses||0)+1;
        match.consecutiveFouls[i]=0;
        match.warnedTwoFouls[i]=false;
        addActionEvent('3 FAULY • rack pro '+match.playerNames[other]);
        winRack(other,true,'3 Foul Rule');
        return;
      }
      if(threeFoulActive && match.consecutiveFouls[i]===2){
        match.warnedTwoFouls[i]=true;
        toast('UPOZORNĚNÍ • '+match.playerNames[i]+' má 2 po sobě jdoucí fauly.');
      }
      match.turn=other;
      if(match.useClock)resetClock(false,true);
      renderMatch();
      scheduleStreamState();
    }
  };

  $('breakPotCountCancelBtn').onclick=()=>{
    pendingBreakPotAction=null;
    $('breakPotCountModal').classList.remove('show');
    if(match?.useClock)resetClock(false,false);
  };

  window.actionBreakOk=function(){
    if(!match || match.discipline==='14.1' || match.ghostMode || match.counterMode==='simple')return;
    if(!match.isBreakShot || match.turn!==match.breaker){
      toast('BREAK OK lze zadat pouze bezprostředně po rozstřelu.');
      return;
    }
    if(match.useClock)stopTimer();
    openBreakPotCount('break_ok');
  };

  window.actionDryBreak = function(){
    if(!match || match.discipline==='14.1' || match.ghostMode)return;
    if(!match.isBreakShot || match.turn!==match.breaker){
      toast('DRY BREAK lze zadat pouze bezprostředně po rozstřelu.');
      return;
    }

    const i=match.breaker;
    addActionEvent('Dry break • '+match.playerNames[i]+' • z rozstřelu nic nespadlo');
    recordBreakPottedBalls(i,0);
    if(exactBallTrackingDiscipline()){ match.breakPocketedBalls=[]; match.rackRemainingBalls=fullRackBalls(); }
    match.stats[i].dryBreaks=Number(match.stats[i].dryBreaks||0)+1;
    match.isBreakShot=false;
    match.softBreakReturnEligibleFor=null;
    match.softBreakOriginalBreaker=null;
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=1-i;
    match.runoutEligibleReason='dry_break';
    match.pushOutEligibleFor=(match.discipline==='9-ball'||match.discipline==='10-ball') ? 1-i : null;
    match.pushOutBy=null;
    match.pushOutDecisionFor=null;
    match.safetyEscapeEligibleFor=null;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    match.turn=1-i;

    if(match.useClock)resetClock(false,true);
    renderMatch();
  };

  window.actionSoftBreak = function(){
    if(!match || match.discipline!=='9-ball' || !['kitchen','kitchen_box'].includes(match.nineBallBreakRule))return;
    if(!match.isBreakShot || match.turn!==match.breaker){
      toast('KITCHEN NESPLNĚN lze zadat pouze bezprostředně po rozstřelu.');
      return;
    }
    if(match.useClock)stopTimer();
    openBreakPotCount('soft_break');
  };

  window.returnTableAfterSoftBreak = function(){
    if(!match || match.softBreakReturnEligibleFor!==match.turn || match.softBreakOriginalBreaker==null){
      toast('Stůl teď nelze vrátit.');
      return;
    }

    const receiving=match.turn;
    const original=match.softBreakOriginalBreaker;
    addActionEvent('Stůl po soft breaku vrácen • '+match.playerNames[receiving]+' → '+match.playerNames[original]);
    match.turn=original;
    match.softBreakReturnEligibleFor=null;
    match.softBreakOriginalBreaker=null;
    match.breakAndRunEligible=true;
    addActionEvent('Nárok na ČISTOU HRU zůstává • stůl vrácen po nesplněném SOFT BREAKU');
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.pushOutEligibleFor=(match.discipline==='9-ball'||match.discipline==='10-ball') ? original : null;
    match.pushOutBy=null;
    match.pushOutDecisionFor=null;
    match.safetyEscapeEligibleFor=null;

    if(match.useClock)resetClock(false,true);
    renderMatch();
  };

  window.actionPushOut = function(){
    if(!match || match.counterMode==='simple' || match.ghostMode || !['9-ball','10-ball'].includes(match.discipline))return;
    const i=Number(match.turn||0);
    const other=1-i;
    if(match.pushOutEligibleFor!==i || match.pushOutDecisionFor!=null){
      toast('PUSH OUT je dostupný pouze jako první strk po rozstřelu.');
      return;
    }

    saveManualEntryUndoSnapshot('Push out');
    addActionEvent('PUSH OUT • '+match.playerNames[i]+' • rozhoduje '+match.playerNames[other]);
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    st.pushOuts=Number(st.pushOuts||0)+1;
    match.isBreakShot=false;
    match.pushOutEligibleFor=null;
    match.pushOutBy=i;
    match.pushOutDecisionFor=other;
    // PUSH OUT sám o sobě nárok na čistou hru neruší.
    // Pokud soupeř stůl vrátí původnímu rozstřelujícímu, může stále dokončit Break & Run.
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.safetyEscapeEligibleFor=null;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    match.turn=other;
    if(match.useClock)resetClock(false,true);
    renderMatch();
  };

  window.acceptPushOut = function(){
    if(!match || match.pushOutDecisionFor!==match.turn || match.pushOutBy==null){
      toast('Teď není co přijmout po push outu.');
      return;
    }
    saveManualEntryUndoSnapshot('Přijatý push out');
    const receiver=Number(match.turn||0);
    const pusher=Number(match.pushOutBy);
    addActionEvent('Push out přijat • '+match.playerNames[receiver]+' přebírá stůl po '+match.playerNames[pusher]);
    match.pushOutBy=null;
    match.pushOutDecisionFor=null;
    match.pushOutEligibleFor=null;
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.safetyEscapeEligibleFor=null;
    match.turn=receiver;
    if(match.useClock)resetClock(false,true);
    renderMatch();
  };

  window.returnPushOut = function(){
    if(!match || match.pushOutDecisionFor!==match.turn || match.pushOutBy==null){
      toast('Teď není co vrátit po push outu.');
      return;
    }
    saveManualEntryUndoSnapshot('Vrácený push out');
    const receiver=Number(match.turn||0);
    const pusher=Number(match.pushOutBy);
    addActionEvent('Push out vrácen • '+match.playerNames[receiver]+' → '+match.playerNames[pusher]);
    const st=match.stats[pusher]=match.stats[pusher]||blankMatchStats();
    st.pushOutsReturned=Number(st.pushOutsReturned||0)+1;
    const cleanStillPossible=(pusher===Number(match.breaker||0) && match.breakAndRunEligible!==false);
    match.pushOutBy=null;
    match.pushOutDecisionFor=null;
    match.pushOutEligibleFor=null;
    if(cleanStillPossible){
      // Původní breaker dostal po vlastním PUSH OUTU stůl zpět bez odehraného strku soupeře.
      // Stále může dokončit ČISTOU HRU.
      match.breakAndRunEligible=true;
      match.runoutEligibleFor=null;
      match.runoutEligibleReason=null;
      addActionEvent('Nárok na ČISTOU HRU zůstává • stůl vrácen po PUSH OUTU');
    }else{
      // Typicky hráč, který dostal možnost po dry breaku soupeře.
      // Pro něj jde po vráceném PUSH OUTU o DOHRÁVKU, ne Break & Run.
      match.breakAndRunEligible=false;
      match.runoutEligibleFor=pusher;
      match.runoutEligibleReason='push_out_return';
    }
    match.safetyEscapeEligibleFor=null;
    match.turn=pusher;
    if(match.useClock)resetClock(false,true);
    renderMatch();
  };

  let pendingShotBallSelection=[];
  let pendingShotBallRequest=null;

  function renderShotBallSelector(){
    const host=$('shotBallSelectButtons');
    if(!host||!match)return;
    const rem=Array.isArray(match.rackRemainingBalls)&&match.rackRemainingBalls.length?match.rackRemainingBalls:fullRackBalls();
    host.innerHTML='<div class="exact-ball-grid">'+rem.map(n=>exactBallButtonHtml(n,{selected:pendingShotBallSelection.includes(n),onclick:`toggleShotBallSelection(${n})`})).join('')+'</div>';
  }
  window.toggleShotBallSelection=function(n){
    n=Number(n);
    if(pendingShotBallSelection.includes(n))pendingShotBallSelection=pendingShotBallSelection.filter(x=>x!==n);
    else pendingShotBallSelection.push(n);
    pendingShotBallSelection.sort((a,b)=>a-b);
    renderShotBallSelector();
  };
  function openShotBallSelector({player=null,requirePot=false,label='Strk',onDone=null}={}){
    if(!match || match.counterMode==='simple' || !exactBallTrackingDiscipline()){
      if(typeof onDone==='function')onDone([]);
      return;
    }
    pendingShotBallSelection=[];
    pendingShotBallRequest={player:player==null?Number(match.turn||0):Number(player),requirePot:!!requirePot,label,onDone};
    const name=match.playerNames?.[pendingShotBallRequest.player]||'Hráč';
    $('shotBallSelectText').textContent=label+' • '+name+' • označ všechny koule, které při strku spadly.';
    renderShotBallSelector();
    if(match.useClock)stopTimer();
    $('shotBallSelectModal').classList.add('show');
  }
  function applyShotBallSelection(selected){
    if(!match || !exactBallTrackingDiscipline())return;
    const gone=new Set((selected||[]).map(Number));
    const rem=Array.isArray(match.rackRemainingBalls)&&match.rackRemainingBalls.length?match.rackRemainingBalls.slice():fullRackBalls();
    match.rackRemainingBalls=rem.filter(n=>!gone.has(Number(n)));
  }
  function finishShotBallSelection(useNone=false){
    if(!pendingShotBallRequest)return;
    const req=pendingShotBallRequest;
    const selected=useNone?[]:pendingShotBallSelection.slice();
    if(req.requirePot && !selected.length){ toast('U této akce označ alespoň jednu potopenou kouli.'); return; }
    applyShotBallSelection(selected);
    pendingShotBallRequest=null; pendingShotBallSelection=[];
    $('shotBallSelectModal').classList.remove('show');
    if(typeof req.onDone==='function')req.onDone(selected);
  }
  $('shotBallNoneBtn').onclick=()=>finishShotBallSelection(true);
  $('shotBallConfirmBtn').onclick=()=>finishShotBallSelection(false);
  $('shotBallCancelBtn').onclick=()=>{
    pendingShotBallRequest=null; pendingShotBallSelection=[]; $('shotBallSelectModal').classList.remove('show');
    if(match?.useClock)resetClock(false,true);
  };



  let pendingShotSequence=null;

  function selectedAreSequentialPrefix(selected,remainingBefore){
    const sel=[...new Set((selected||[]).map(Number))];
    const rem=(remainingBefore||[]).map(Number);
    if(sel.length<2 || rem.length<sel.length)return false;
    return sel.every((n,idx)=>n===rem[idx]);
  }

  function askShotSequence({player,selected,remainingBefore,onSequential,onTogether}){
    pendingShotSequence={player,selected:selected.slice(),remainingBefore:remainingBefore.slice(),onSequential,onTogether};
    $('shotSequenceText').textContent=
      (match.playerNames?.[player]||'Hráč')+' • vybrány koule '+selected.join(', ')+'.';
    $('shotSequenceModal').classList.add('show');
  }

  function closeShotSequenceModal(){
    $('shotSequenceModal').classList.remove('show');
  }

  $('shotSequenceSequentialBtn').onclick=()=>{
    const p=pendingShotSequence;
    pendingShotSequence=null;
    closeShotSequenceModal();
    if(p && typeof p.onSequential==='function')p.onSequential();
  };
  $('shotSequenceTogetherBtn').onclick=()=>{
    const p=pendingShotSequence;
    pendingShotSequence=null;
    closeShotSequenceModal();
    if(p && typeof p.onTogether==='function')p.onTogether();
  };
  $('shotSequenceCancelBtn').onclick=()=>{
    pendingShotSequence=null;
    closeShotSequenceModal();
    if(match?.useClock)resetClock(false,true);
  };

  function runoutReasonText(){
    if(!match)return '';
    if(match.runoutEligibleReason==='push_out_return')return 'po vráceném push outu';
    if(match.runoutEligibleReason==='break_foul')return 'po faulu z breaku soupeře';
    if(match.runoutEligibleReason==='dry_break')return 'po dry breaku soupeře';
    return 'po převzetí stolu';
  }

  function autoRecordRunout(player,reasonText=''){
    if(!match || match.counterMode==='simple' || match.discipline==='14.1' || match.ghostMode)return false;
    const i=Number(player);
    if(match.runoutEligibleFor!==i)return false;
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    st.runouts=Number(st.runouts||0)+1;
    addActionEvent('DOHRÁVKA • '+match.playerNames[i]+(reasonText?' • '+reasonText:''));
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    return true;
  }

  function finishGameBallFromTrackedPlay(i,gameBall,label=''){
    const wasRunoutEligible=match.runoutEligibleFor===i;
    const runoutReason=runoutReasonText();

    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.pushOutEligibleFor=null;

    if(wasRunoutEligible){
      // Obnovíme hodnotu jen pro helper, který ji po zapsání hned vyčistí.
      match.runoutEligibleFor=i;
      autoRecordRunout(i,runoutReason);
    }else{
      autoRecordBreakAndRun(i,gameBall);
    }

    addActionEvent((gameBall===9?'DEVÍTKA':'DESÍTKA')+' • rack ukončen • '+match.playerNames[i]+(label?' • '+label:''));
    winRack(i,true,'Potopená '+gameBall);
  }

  function processSequentialCleanShots(i,selected,remainingBefore){
    if(!match || !selected?.length)return;
    const seq=selected.slice().sort((a,b)=>remainingBefore.indexOf(a)-remainingBefore.indexOf(b));

    if(Array.isArray(match.rackRemainingBalls)){
      const sunk=new Set(seq.map(Number));
      match.rackRemainingBalls=match.rackRemainingBalls
        .map(Number)
        .filter(n=>!sunk.has(n))
        .sort((a,b)=>a-b);
    }
    const hadRunoutEligibility=match.runoutEligibleFor===i;
    const savedRunoutReason=match.runoutEligibleReason;

    match.isBreakShot=false;
    consumeSoftBreakReturnOnShot(i);
    consumePushOutOptionOnAction(i);
    match.safetyEscapeEligibleFor=null;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    if(i!==match.breaker)match.breakAndRunEligible=false;

    seq.forEach((ball,idx)=>{
      addActionEvent(
        'Čistý strk • '+match.playerNames[i]+' • spadla '+ball+
        ' • RYCHLÝ ZÁPIS '+(idx+1)+'/'+seq.length
      );
    });

    const gameBall=match.discipline==='9-ball'?9:(match.discipline==='10-ball'?10:null);
    if(gameBall && seq.includes(gameBall)){
      if(match.discipline==='10-ball'){
        const tenWasLast=(Array.isArray(match.rackRemainingBalls)?match.rackRemainingBalls.length:0)===0;
        if(!tenWasLast && match.tenBallRule!=='early_win'){
          if(!match.rackRemainingBalls.includes(10)){
            match.rackRemainingBalls.push(10);
            match.rackRemainingBalls.sort((a,b)=>a-b);
          }
          addActionEvent('PŘEDČASNÁ 10 • vrací se na bod • '+match.playerNames[i]);
          toast('DESÍTKA SE VRACÍ NA BOD • rack pokračuje.');
        }else{
          if(hadRunoutEligibility){
            match.runoutEligibleFor=i;
            match.runoutEligibleReason=savedRunoutReason;
          }
          finishGameBallFromTrackedPlay(i,10,'rychlý zápis postupně');
          return;
        }
      }else{
        if(hadRunoutEligibility){
          match.runoutEligibleFor=i;
          match.runoutEligibleReason=savedRunoutReason;
        }
        finishGameBallFromTrackedPlay(i,9,'rychlý zápis postupně');
        return;
      }
    }

    if(hadRunoutEligibility){
      match.runoutEligibleFor=i;
      match.runoutEligibleReason=savedRunoutReason;
    }
    if(match.useClock)resetClock(false,true);
    renderMatch();
  }

  let pendingHigherBallShot=null;

  function lowestBallBeforeShot(){
    if(!match || !exactBallTrackingDiscipline())return null;
    const rem=Array.isArray(match.rackRemainingBalls)&&match.rackRemainingBalls.length
      ? match.rackRemainingBalls.slice().sort((a,b)=>a-b)
      : fullRackBalls();
    return rem.length?Number(rem[0]):null;
  }

  function higherPocketedBallsForShot(selected,lowest){
    return (selected||[]).map(Number).filter(n=>lowest!=null && n>lowest);
  }

  function askHigherBallShotType({player,selected,lowest,onDone}){
    const higher=higherPocketedBallsForShot(selected,lowest);
    if(!higher.length){
      onDone({type:null,higher:[]});
      return;
    }

    pendingHigherBallShot={player,selected:selected.slice(),lowest,higher,onDone};
    const name=match?.playerNames?.[player]||'Hráč';
    $('higherBallTypeTitle').textContent=(higher.length>1?'VYŠŠÍ KOULE SPADLY':'VYŠŠÍ KOULE SPADLA');
    $('higherBallTypeText').textContent=
      name+' • nejnižší koule na stole byla '+lowest+
      ' • potopeno navíc: '+higher.join(', ')+'.';
    $('higherBallAccidentalBtn').classList.toggle('hidden',match?.discipline!=='10-ball');
    $('higherBallTypeModal').classList.add('show');
  }

  function finishHigherBallShotType(type){
    const req=pendingHigherBallShot;
    if(!req)return;
    pendingHigherBallShot=null;
    $('higherBallTypeModal').classList.remove('show');
    if(typeof req.onDone==='function')req.onDone({type,higher:req.higher.slice()});
  }

  $('higherBallComboBtn').onclick=()=>finishHigherBallShotType('combo');
  $('higherBallCaromBtn').onclick=()=>finishHigherBallShotType('carom');
  $('higherBallAccidentalBtn').onclick=()=>finishHigherBallShotType('accidental');
  $('higherBallTypeCancelBtn').onclick=()=>{
    pendingHigherBallShot=null;
    $('higherBallTypeModal').classList.remove('show');
    if(match?.useClock)resetClock(false,true);
  };


  function autoRecordBreakAndRun(player,gameBall){
    if(!match || match.counterMode==='simple' || match.discipline==='14.1' || match.ghostMode)return false;
    const i=Number(player);
    if(i!==Number(match.breaker||0) || match.breakAndRunEligible===false)return false;

    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    st.breakAndRun=Number(st.breakAndRun||0)+1;
    addActionEvent('⭐ ČISTÁ HRA • Break & Run • '+match.playerNames[i]+' • automaticky po potopení '+gameBall);
    playSpecialSound();
    return true;
  }

  window.actionLegal = function(){
    if(!match)return;
    const i=Number(match.turn||0);
    const lowestBefore=lowestBallBeforeShot();
    const remainingBefore=Array.isArray(match.rackRemainingBalls)
      ? match.rackRemainingBalls.slice().sort((a,b)=>a-b)
      : fullRackBalls();

    openShotBallSelector({player:i,label:'ČISTÝ STRK',onDone:(selected)=>{
      const finishLegalShot=(shotInfo={type:null,higher:[]})=>{
        match.isBreakShot=false;

        // Každá potvrzená potopená koule musí okamžitě zmizet z evidence koulí na stole.
        // To platí i pro KOMBINACI / KARAMBOL a více koulí při jednom strku.
        if(Array.isArray(match.rackRemainingBalls) && selected.length){
          const sunk=new Set(selected.map(Number));
          match.rackRemainingBalls=match.rackRemainingBalls
            .map(Number)
            .filter(n=>!sunk.has(n))
            .sort((a,b)=>a-b);
        }

        const ballsText=selected.length
          ? (selected.length===1?' • spadla '+selected[0]:' • spadly '+selected.join(', '))
          : ' • bez potopené koule';

        let detail='';
        if(shotInfo.type==='combo'){
          detail=' • KOMBINACE přes '+lowestBefore;
        }else if(shotInfo.type==='carom'){
          detail=' • KARAMBOL po zásahu '+lowestBefore;
        }else if(shotInfo.type==='accidental'){
          detail=' • NECHTĚNÁ KOULE';
        }

        const wasRunoutEligible=match.runoutEligibleFor===i;
        const savedRunoutReason=match.runoutEligibleReason;

        addActionEvent('Čistý strk • '+match.playerNames[i]+ballsText+detail);

        consumeSoftBreakReturnOnShot(i);
        consumePushOutOptionOnAction(i);
        if(i!==match.breaker)match.breakAndRunEligible=false;
        match.safetyEscapeEligibleFor=null;
        match.consecutiveFouls[i]=0;
        match.warnedTwoFouls[i]=false;

        // 9-ball: potopená 9 při legálním strku vždy ukončí rack.
        if(match.discipline==='9-ball' && selected.includes(9)){
          if(wasRunoutEligible){
            match.runoutEligibleFor=i;
            match.runoutEligibleReason=savedRunoutReason;
          }
          finishGameBallFromTrackedPlay(i,9);
          return;
        }

        // 10-ball: potopená 10 se řídí nastaveným pravidlem.
        if(match.discipline==='10-ball' && selected.includes(10)){
          const remainingAfterShot=Array.isArray(match.rackRemainingBalls)?match.rackRemainingBalls.slice():[];
          const tenWasLast=remainingAfterShot.length===0;

          if(tenWasLast || match.tenBallRule==='early_win'){
            if(wasRunoutEligible){
              match.runoutEligibleFor=i;
              match.runoutEligibleReason=savedRunoutReason;
            }
            finishGameBallFromTrackedPlay(i,10,tenWasLast?'':'předčasná 10');
            return;
          }

          if(!match.rackRemainingBalls.includes(10)){
            match.rackRemainingBalls.push(10);
            match.rackRemainingBalls.sort((a,b)=>a-b);
          }
          addActionEvent('PŘEDČASNÁ 10 • vrací se na bod • '+match.playerNames[i]);
          toast('DESÍTKA SE VRACÍ NA BOD • rack pokračuje.');
        }

        // Pokud hráč měl nárok na dohrávku, po běžném čistém strku ji zachováme,
        // dokud rack skutečně nedohraje nebo nepředá stůl.
        if(wasRunoutEligible){
          match.runoutEligibleFor=i;
          match.runoutEligibleReason=savedRunoutReason;
        }

        if(match.useClock) resetClock(false,true);
        renderMatch();
      };

      const togetherFlow=()=>{
        const higher=higherPocketedBallsForShot(selected,lowestBefore);
        if(higher.length){
          askHigherBallShotType({
            player:i,
            selected,
            lowest:lowestBefore,
            onDone:finishLegalShot
          });
        }else{
          finishLegalShot();
        }
      };

      if(selectedAreSequentialPrefix(selected,remainingBefore)){
        askShotSequence({
          player:i,
          selected,
          remainingBefore,
          onSequential:()=>processSequentialCleanShots(i,selected,remainingBefore),
          onTogether:togetherFlow
        });
      }else{
        togetherFlow();
      }
    }});
  };

  if($('quickRunoutBtn')){
    $('quickRunoutBtn').onclick=()=>{
      if(!match || match.counterMode==='simple' || match.ghostMode || !exactBallTrackingDiscipline())return;
      const rem=Array.isArray(match.rackRemainingBalls)
        ? match.rackRemainingBalls.slice().sort((a,b)=>a-b)
        : fullRackBalls();
      if(!rem.length)return;
      const i=Number(match.turn||0);
      saveManualEntryUndoSnapshot('Dohráno postupně');
      match.rackRemainingBalls=[];
      processSequentialCleanShots(i,rem,rem);
    };
  }


  function inferRemainingFromMissBall(ball){
    if(!match || !exactBallTrackingDiscipline())return;
    const n=Number(ball||0);
    if(!n)return;
    const alreadyGone=new Set(Array.isArray(match.breakPocketedBalls)?match.breakPocketedBalls:[]);
    // V rotačních disciplínách chyba na kouli N znamená, že nižší koule už musely být dohrané.
    match.rackRemainingBalls=fullRackBalls().filter(b=>b>=n && !alreadyGone.has(b));
    if(!match.rackRemainingBalls.includes(n))match.rackRemainingBalls.unshift(n);
    match.rackRemainingBalls=[...new Set(match.rackRemainingBalls)].sort((a,b)=>a-b);
    match.lastMissBall=n;
  }
  function remainingRackBallCount(){
    return Array.isArray(match?.rackRemainingBalls)?match.rackRemainingBalls.length:0;
  }
  function recordTwoWay(i,success=false,kind=''){
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    st.twoWayAttempts=Number(st.twoWayAttempts||0)+1;
    if(success){
      st.twoWaySuccessful=Number(st.twoWaySuccessful||0)+1;
      if(kind==='pot')st.twoWayPotSuccess=Number(st.twoWayPotSuccess||0)+1;
      if(kind==='safe')st.twoWaySafetySuccess=Number(st.twoWaySafetySuccess||0)+1;
    }
  }
  let pendingTwoWayPlayer=null;
  let pendingDirectPlayer=null;
  let pendingTenBallSafePotPlayer=null;

  window.actionTwoWayShot=function(){
    if(!match || match.counterMode==='simple' || match.discipline==='14.1' || match.ghostMode)return;
    pendingTwoWayPlayer=Number(match.turn||0);
    if(match.useClock)stopTimer();
    $('twoWayResultModal').classList.add('show');
  };
  $('twoWaySuccessBtn').onclick=()=>{
    if(pendingTwoWayPlayer===null)return;
    $('twoWayResultModal').classList.remove('show');
    $('twoWaySuccessModal').classList.add('show');
  };
  $('twoWayPotBtn').onclick=()=>{
    if(!match || pendingTwoWayPlayer===null)return;
    const i=pendingTwoWayPlayer;
    $('twoWaySuccessModal').classList.remove('show');
    openShotBallSelector({player:i,requirePot:true,label:'2-WAY SHOT • POT',onDone:(selected)=>{
      saveManualEntryUndoSnapshot('2-WAY SHOT');
      addActionEvent('2-WAY SHOT • úspěšný pot • '+match.playerNames[i]+' • spadly '+selected.join(', '));
      recordTwoWay(i,true,'pot');
      consumeSoftBreakReturnOnShot(i); consumePushOutOptionOnAction(i);
      match.safetyEscapeEligibleFor=null; match.consecutiveFouls[i]=0; match.warnedTwoFouls[i]=false;
      pendingTwoWayPlayer=null;
      if(match.useClock)resetClock(false,true); renderMatch();
    }});
  };
  $('twoWaySafeBtn').onclick=()=>{
    if(!match || pendingTwoWayPlayer===null)return;
    saveManualEntryUndoSnapshot('2-WAY SHOT');
    const i=pendingTwoWayPlayer, other=1-i;
    addActionEvent('2-WAY SHOT • úspěšná jistota • '+match.playerNames[i]);
    recordTwoWay(i,true,'safe');
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    st.safeties=Number(st.safeties||0)+1; st.trackedSafeties=Number(st.trackedSafeties||0)+1; st.successfulSafeties=Number(st.successfulSafeties||0)+1;
    consumeSoftBreakReturnOnShot(i); consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false; match.runoutEligibleFor=null; match.runoutEligibleReason=null;
    match.safetyEscapeEligibleFor=other; match.turn=other;
    pendingTwoWayPlayer=null; $('twoWaySuccessModal').classList.remove('show');
    if(match.useClock)resetClock(false,true); renderMatch();
  };
  $('twoWayFailBtn').onclick=()=>{
    if(!match || pendingTwoWayPlayer===null)return;
    saveManualEntryUndoSnapshot('2-WAY SHOT');
    const i=pendingTwoWayPlayer, other=1-i;
    addActionEvent('2-WAY SHOT • neúspěšný • '+match.playerNames[i]);
    recordTwoWay(i,false);
    consumeSoftBreakReturnOnShot(i); consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false; match.runoutEligibleFor=null; match.runoutEligibleReason=null; match.safetyEscapeEligibleFor=null; match.turn=other;
    pendingTwoWayPlayer=null; $('twoWayResultModal').classList.remove('show');
    if(match.useClock)resetClock(false,true); renderMatch();
  };
  $('twoWayFoulBtn').onclick=()=>{
    if(pendingTwoWayPlayer===null)return;
    recordTwoWay(pendingTwoWayPlayer,false);
    $('twoWayResultModal').classList.remove('show'); pendingTwoWayPlayer=null;
    actionFoul();
  };
  $('twoWayCancelBtn').onclick=()=>{ pendingTwoWayPlayer=null; $('twoWayResultModal').classList.remove('show'); if(match?.useClock)resetClock(false,true); };

  window.actionDirectBallAvailable=function(){
    if(!match || match.safetyEscapeEligibleFor!==match.turn)return;
    pendingDirectPlayer=Number(match.turn||0);
    if(match.useClock)stopTimer();
    $('directBallModal').classList.add('show');
  };
  function closeDirectRoot(){ $('directBallModal').classList.remove('show'); }
  $('directBallSafeBtn').onclick=()=>{ closeDirectRoot(); $('directSafeResultModal').classList.add('show'); };
  $('directBallPotBtn').onclick=()=>{ closeDirectRoot(); $('directPotResultModal').classList.add('show'); };
  $('directBallTwoWayBtn').onclick=()=>{ closeDirectRoot(); pendingTwoWayPlayer=pendingDirectPlayer; pendingDirectPlayer=null; $('twoWayResultModal').classList.add('show'); };
  $('directBallFoulBtn').onclick=()=>{ closeDirectRoot(); pendingDirectPlayer=null; match.safetyEscapeEligibleFor=null; actionFoul(); };
  $('directBallCancelBtn').onclick=()=>{ pendingDirectPlayer=null; closeDirectRoot(); if(match?.useClock)resetClock(false,true); };

  function finishDirectSafe(result){
    if(!match || pendingDirectPlayer===null)return;
    const i=pendingDirectPlayer, other=1-i;
    saveManualEntryUndoSnapshot('SAFE po přímém zásahu');
    const eventText=result==='success'?'Úspěšná jistota • koule šla zasáhnout přímo • '+match.playerNames[i]:(result==='fail'?'Neúspěšná jistota • koule šla zasáhnout přímo • '+match.playerNames[i]:'SAFE • spadla koule • '+match.playerNames[i]);
    addActionEvent(eventText);
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    st.safeties=Number(st.safeties||0)+1; st.trackedSafeties=Number(st.trackedSafeties||0)+1;
    match.safetyEscapeEligibleFor=null;
    if(result==='success'){
      st.successfulSafeties=Number(st.successfulSafeties||0)+1;
      match.safetyEscapeEligibleFor=other; match.turn=other;
    }else if(result==='fail'){
      match.turn=other;
    }else if(result==='potted'){
      if(match.discipline==='10-ball'){
        consumeSoftBreakReturnOnShot(i); consumePushOutOptionOnAction(i);
        match.breakAndRunEligible=false; match.runoutEligibleFor=null; match.runoutEligibleReason=null;
        pendingTenBallSafePotPlayer=i;
        $('directSafeResultModal').classList.remove('show');
        pendingDirectPlayer=null;
        $('tenBallSafePotDecisionModal').classList.add('show');
        return;
      }
      // 9-ball: hráč musí pokračovat.
      match.turn=i;
    }
    consumeSoftBreakReturnOnShot(i); consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false; match.runoutEligibleFor=null; match.runoutEligibleReason=null;
    pendingDirectPlayer=null; $('directSafeResultModal').classList.remove('show');
    if(match.useClock)resetClock(false,true); renderMatch();
  }
  $('directSafeSuccessBtn').onclick=()=>finishDirectSafe('success');
  $('directSafeFailBtn').onclick=()=>finishDirectSafe('fail');
  $('directSafePottedBtn').onclick=()=>finishDirectSafe('potted');
  $('directSafeFoulBtn').onclick=()=>{ $('directSafeResultModal').classList.remove('show'); pendingDirectPlayer=null; match.safetyEscapeEligibleFor=null; actionFoul(); };
  $('tenBallSafePotAcceptBtn').onclick=()=>{
    if(!match || pendingTenBallSafePotPlayer===null)return;
    const i=pendingTenBallSafePotPlayer; match.turn=1-i; match.safetyEscapeEligibleFor=null;
    addActionEvent('10-ball • při safe spadla koule • soupeř přijímá stůl');
    pendingTenBallSafePotPlayer=null; $('tenBallSafePotDecisionModal').classList.remove('show'); if(match.useClock)resetClock(false,true); renderMatch();
  };
  $('tenBallSafePotReturnBtn').onclick=()=>{
    if(!match || pendingTenBallSafePotPlayer===null)return;
    const i=pendingTenBallSafePotPlayer; match.turn=i; match.safetyEscapeEligibleFor=null;
    addActionEvent('10-ball • při safe spadla koule • stůl vrácen hráči '+match.playerNames[i]);
    pendingTenBallSafePotPlayer=null; $('tenBallSafePotDecisionModal').classList.remove('show'); if(match.useClock)resetClock(false,true); renderMatch();
  };

  $('directPotSuccessBtn').onclick=()=>{
    if(!match || pendingDirectPlayer===null)return;
    const i=pendingDirectPlayer; $('directPotResultModal').classList.remove('show');
    openShotBallSelector({player:i,requirePot:true,label:'POKUS O POTOPENÍ • ÚSPĚŠNÝ',onDone:(selected)=>{
      saveManualEntryUndoSnapshot('Pokus o potopení');
      addActionEvent('Pokus o potopení • úspěšný • '+match.playerNames[i]+' • spadly '+selected.join(', '));
      match.safetyEscapeEligibleFor=null; consumeSoftBreakReturnOnShot(i); consumePushOutOptionOnAction(i);
      pendingDirectPlayer=null; if(match.useClock)resetClock(false,true); renderMatch();
    }});
  };
  $('directPotMissBtn').onclick=()=>{
    if(!match || pendingDirectPlayer===null)return;
    const i=pendingDirectPlayer; match.safetyEscapeEligibleFor=null; pendingDirectPlayer=null; $('directPotResultModal').classList.remove('show');
    pendingMissPlayer=i; if(exactBallTrackingDiscipline())openMissBallChoice('missed_ball'); else registerMissReason('missed_ball');
  };
  $('directPotAccSafeBtn').onclick=()=>{
    if(!match || pendingDirectPlayer===null)return;
    const i=pendingDirectPlayer, other=1-i; saveManualEntryUndoSnapshot('Nechtěná jistota');
    addActionEvent('Pokus o potopení • NECHTĚNÁ JISTOTA • '+match.playerNames[i]);
    const st=match.stats[i]=match.stats[i]||blankMatchStats(); st.matchOnlyMisses=Number(st.matchOnlyMisses||0)+1; st.matchOnlyMissPot=Number(st.matchOnlyMissPot||0)+1; st.accidentalSafeties=Number(st.accidentalSafeties||0)+1;
    match.safetyEscapeEligibleFor=other; match.turn=other; match.breakAndRunEligible=false; match.runoutEligibleFor=null; match.runoutEligibleReason=null;
    pendingDirectPlayer=null; $('directPotResultModal').classList.remove('show'); if(match.useClock)resetClock(false,true); renderMatch();
  };
  $('directPotFoulBtn').onclick=()=>{ $('directPotResultModal').classList.remove('show'); pendingDirectPlayer=null; match.safetyEscapeEligibleFor=null; actionFoul(); };

  window.actionBreakAndRun = function(){
    if(!match || match.discipline==='14.1' || match.ghostMode || match.counterMode==='simple')return;
    const i=Number(match.turn||0);

    if(i!==match.breaker || match.breakAndRunEligible===false){
      toast('ČISTOU HRU lze zapsat pouze po vlastním rozstřelu bez předání stolu soupeři.');
      return;
    }

    saveManualEntryUndoSnapshot('Čistá hra');
    const inferredLen=remainingRackBallCount();
    addActionEvent('Čistá hra • Break & Run • '+match.playerNames[i]+(inferredLen?' • dohráno '+inferredLen+' koulí':''));
    match.stats[i].breakAndRun=Number(match.stats[i].breakAndRun||0)+1;
    match.runoutEligibleFor=null;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    playSpecialSound();
    winRack(i,true,'Čistá hra');
  };

  window.actionRunout = function(){
    if(!match || match.discipline==='14.1' || match.ghostMode || match.counterMode==='simple')return;
    const i=Number(match.turn||0);

    if(match.runoutEligibleFor!==i){
      toast('DOHRÁVKU lze zapsat po dry breaku, faulu z breaku nebo vráceném push outu.');
      return;
    }

    saveManualEntryUndoSnapshot('Dohrávka');
    const runoutReason=match.runoutEligibleReason==='push_out_return'?'vráceném push outu':(match.runoutEligibleReason==='break_foul'?'faulu z breaku soupeře':'dry breaku soupeře');
    const inferredLen=remainingRackBallCount();
    addActionEvent('Dohrávka po '+runoutReason+' • '+match.playerNames[i]+(inferredLen?' • '+inferredLen+' koulí':''));
    match.stats[i].runouts=Number(match.stats[i].runouts||0)+1;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.pushOutEligibleFor=null;
    match.breakAndRunEligible=false;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    winRack(i,true,'Dohrávka');
  };

  window.actionBreakFoul = function(){
    if(!match || match.discipline==='14.1' || match.ghostMode || match.counterMode==='simple')return;
    const i=Number(match.turn||0);
    if(!match.isBreakShot || i!==match.breaker){
      toast('FAUL Z BREAKU lze zapsat pouze při rozstřelu.');
      return;
    }
    if(match.useClock)stopTimer();
    openBreakPotCount('break_foul');
  };

  window.actionFoul = function(){
    if(!match || match.discipline==='14.1')return;

    saveManualEntryUndoSnapshot('Faul');

    const i=Number(match.turn||0);
    const other=1-i;

    match.isBreakShot=false;
    consumeSoftBreakReturnOnShot(i);
    consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.safetyEscapeEligibleFor=null;

    match.stats[i].fouls=Number(match.stats[i].fouls||0)+1;
    match.consecutiveFouls[i]=Number(match.consecutiveFouls[i]||0)+1;

    addActionEvent('Faul • '+match.playerNames[i]);

    const threeFoulActive=!!match.useThreeFoul &&
      (match.discipline==='9-ball'||match.discipline==='10-ball');

    if(threeFoulActive && match.consecutiveFouls[i]===2){
      match.warnedTwoFouls[i]=true;
      toast('UPOZORNĚNÍ • '+match.playerNames[i]+' má 2 po sobě jdoucí fauly.');
    }

    if(threeFoulActive && match.consecutiveFouls[i]>=3){
      match.stats[i].threeFoulLosses=Number(match.stats[i].threeFoulLosses||0)+1;
      match.consecutiveFouls[i]=0;
      match.warnedTwoFouls[i]=false;

      // 3 po sobě jdoucí fauly = ztráta racku.
      // Použijeme stejný přechod jako po běžně vyhraném racku,
      // aby se korektně nastavil nový breaker, nový rack i DRY BREAK.
      addActionEvent('3 FAULY • rack pro '+match.playerNames[other]);
      winRack(other,true,'3 Foul Rule');
      return;
    }

    // Běžný faul vždy ukončuje tah a předává hru soupeři.
    match.turn=other;

    if(match.useClock)resetClock(false,true);
    renderMatch();
    autosaveCurrent();
  };

  let pendingSafetyPlayer=null;

  window.actionSafe = function(){
    saveManualEntryUndoSnapshot('Jistota');
    if(!match)return;
    const i=match.turn;
    pendingSafetyPlayer=i;
    if(match.useClock) stopTimer();
    $('safetyResultText').textContent='Byla jistota hráče '+match.playerNames[i]+' úspěšná?';
    $('safetyResultModal').classList.add('show');
  }

  function finishSafetyResult(success){
    if(!match || pendingSafetyPlayer===null)return;
    const i=pendingSafetyPlayer;
    pendingSafetyPlayer=null;

    match.isBreakShot=false;
    addActionEvent((success?'Úspěšná jistota':'Neúspěšná jistota')+' • '+match.playerNames[i]);
    consumeSoftBreakReturnOnShot(i);
    consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.stats[i].safeties=(match.stats[i].safeties||0)+1;
    match.stats[i].trackedSafeties=(match.stats[i].trackedSafeties||0)+1;
    if(success)match.stats[i].successfulSafeties=(match.stats[i].successfulSafeties||0)+1;
    match.safetyEscapeEligibleFor=success ? 1-i : null;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    match.turn=1-i;

    $('safetyResultModal').classList.remove('show');
    if(match.useClock) resetClock(false,true);
    renderMatch();
  }

  $('safetySuccessBtn').onclick=()=>finishSafetyResult(true);
  $('safetyFailBtn').onclick=()=>finishSafetyResult(false);

  let pendingSafetyEscapePlayer=null;

  window.actionSafetyEscape = function(){
    if(!match || match.counterMode==='simple')return;
    const i=Number(match.turn||0);
    if(match.safetyEscapeEligibleFor!==i){
      toast('ÚNIK Z JISTOTY je dostupný pouze po skutečné nebo nechtěné jistotě soupeře.');
      return;
    }
    pendingSafetyEscapePlayer=i;
    if(match.useClock)stopTimer();
    $('safetyEscapeResultText').textContent='Byl únik z jistoty hráče '+match.playerNames[i]+' úspěšný?';
    $('safetyEscapeResultModal').classList.add('show');
  };

  function ensureSafetyEscapeStats(i){
    match.stats[i].safetyEscapes=Number(match.stats[i].safetyEscapes||0);
    match.stats[i].successfulSafetyEscapes=Number(match.stats[i].successfulSafetyEscapes||0);
  }

  function safetyEscapeSuccessful(){
    if(!match || pendingSafetyEscapePlayer===null)return;
    saveManualEntryUndoSnapshot('Únik z jistoty');
    const i=pendingSafetyEscapePlayer;
    $('safetyEscapeResultModal').classList.remove('show');
    $('safetyEscapeContinueText').textContent='Jak dopadl úspěšný únik hráče '+match.playerNames[i]+'?';
    $('safetyEscapeContinueModal').classList.add('show');
  }

  function safetyEscapeFailed(){
    if(!match || pendingSafetyEscapePlayer===null)return;
    saveManualEntryUndoSnapshot('Únik z jistoty');
    const i=pendingSafetyEscapePlayer;
    const other=1-i;
    ensureSafetyEscapeStats(i);

    addActionEvent('Neúspěšný únik z jistoty • faul • '+match.playerNames[i]);
    match.stats[i].safetyEscapes++;
    match.stats[i].fouls=Number(match.stats[i].fouls||0)+1;
    match.isBreakShot=false;
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.safetyEscapeEligibleFor=null;
    match.consecutiveFouls[i]=Number(match.consecutiveFouls[i]||0)+1;
    match.warnedTwoFouls[i]=false;

    $('safetyEscapeResultModal').classList.remove('show');
    pendingSafetyEscapePlayer=null;

    const threeFoulActive=!!match.useThreeFoul && (match.discipline==='9-ball'||match.discipline==='10-ball');
    if(threeFoulActive && match.consecutiveFouls[i]===2){
      match.warnedTwoFouls[i]=true;
      toast('UPOZORNĚNÍ • '+match.playerNames[i]+' má 2 po sobě jdoucí fauly.');
    }
    if(threeFoulActive && match.consecutiveFouls[i]>=3){
      match.stats[i].threeFoulLosses=Number(match.stats[i].threeFoulLosses||0)+1;
      match.consecutiveFouls[i]=0;
      match.warnedTwoFouls[i]=false;
      addActionEvent('3 FAULY • rack pro '+match.playerNames[other]);
      winRack(other,true,'3 Foul Rule');
      return;
    }

    match.turn=other;
    if(match.useClock)resetClock(false,true);
    renderMatch();
    autosaveCurrent();
  }

  function finishSafetyEscapeSuccess(outcome){
    if(!match || pendingSafetyEscapePlayer===null)return;
    const i=pendingSafetyEscapePlayer;
    const other=1-i;
    $('safetyEscapeContinueModal').classList.remove('show');
    ensureSafetyEscapeStats(i);

    const label=outcome==='continue'
      ? 'Úspěšný únik z jistoty • potopená koule • '+match.playerNames[i]
      : (outcome==='resafe'
        ? 'RESAFE • '+match.playerNames[i]+' úspěšně unikl a zahrál novou jistotu na '+match.playerNames[other]
        : 'Úspěšný únik z jistoty • bez potopené koule • '+match.playerNames[i]);
    addActionEvent(label);

    match.stats[i].safetyEscapes++;
    match.stats[i].successfulSafetyEscapes++;
    match.isBreakShot=false;
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;

    if(outcome==='continue'){
      match.safetyEscapeEligibleFor=null;
      match.turn=i;
    }else if(outcome==='resafe'){
      match.stats[i].resafes=Number(match.stats[i].resafes||0)+1;
      match.stats[i].safeties=Number(match.stats[i].safeties||0)+1;
      match.stats[i].trackedSafeties=Number(match.stats[i].trackedSafeties||0)+1;
      match.stats[i].successfulSafeties=Number(match.stats[i].successfulSafeties||0)+1;
      match.safetyEscapeEligibleFor=other;
      match.turn=other;
    }else{
      match.safetyEscapeEligibleFor=null;
      match.turn=other;
    }

    pendingSafetyEscapePlayer=null;
    if(match.useClock)resetClock(false,true);
    renderMatch();
  }

  $('safetyEscapeSuccessBtn').onclick=safetyEscapeSuccessful;
  $('safetyEscapeFailBtn').onclick=safetyEscapeFailed;
  $('safetyEscapeContinueBtn').onclick=()=>finishSafetyEscapeSuccess('continue');
  $('safetyEscapeEndBtn').onclick=()=>finishSafetyEscapeSuccess('end');
  $('safetyEscapeResafeBtn').onclick=()=>finishSafetyEscapeSuccess('resafe');
  $('safetyEscapeCancelBtn').onclick=()=>{
    $('safetyEscapeResultModal').classList.remove('show');
    pendingSafetyEscapePlayer=null;
    if(match?.useClock)resetClock(false,true);
  };

  window.actionAccidentalSafety=function(){
    if(!match || match.counterMode==='simple' || match.discipline==='14.1' || match.ghostMode)return;
    const i=Number(match.turn||0);
    const other=1-i;
    if(match.isBreakShot || match.safetyEscapeEligibleFor===i)return;

    saveManualEntryUndoSnapshot('Nechtěná jistota');
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    addActionEvent('MISS • nechtěná jistota • '+match.playerNames[i]+' schoval '+match.playerNames[other]);
    st.matchOnlyMisses=Number(st.matchOnlyMisses||0)+1;
    st.matchOnlyMissPot=Number(st.matchOnlyMissPot||0)+1;
    st.accidentalSafeties=Number(st.accidentalSafeties||0)+1;
    match.isBreakShot=false;
    consumeSoftBreakReturnOnShot(i);
    consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false;
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.safetyEscapeEligibleFor=other;
    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    match.turn=other;
    if(match.useClock)resetClock(false,true);
    renderMatch();
  };

  let pendingMissPlayer=null;

  window.actionMiss = function(){
    if(!match || match.counterMode==='simple')return;
    pendingMissPlayer=Number(match.turn||0);
    if(match.useClock)stopTimer();
    $('missReasonModal').classList.add('show');
  };

  let pendingMissReason=null;
  function openMissBallChoice(reason){
    if(!match || pendingMissPlayer===null)return;
    pendingMissReason=reason;
    const max=match.discipline==='9-ball'?9:10;
    const possible=Array.from({length:max},(_,k)=>k+1).filter(n=>{
      const rem=Array.isArray(match.rackRemainingBalls)?match.rackRemainingBalls:[];
      return !rem.length || rem.includes(n);
    });
    $('missBallButtons').innerHTML='<div class="exact-ball-grid">'+possible.map(n=>exactBallButtonHtml(n,{onclick:`finishMissBallChoice(${n})`})).join('')+'</div>';
    $('missBallModal').classList.add('show');
  }
  window.finishMissBallChoice=function(ball){
    if(!match || pendingMissPlayer===null || !pendingMissReason)return;
    const i=pendingMissPlayer; ball=Number(ball);
    saveManualEntryUndoSnapshot('MISS');
    const st=match.stats[i]=match.stats[i]||blankMatchStats();
    const key='missBall'+ball; st[key]=Number(st[key]||0)+1;
    inferRemainingFromMissBall(ball);
    $('missBallModal').classList.remove('show');
    const r=pendingMissReason; pendingMissReason=null;
    registerMissReason(r,true,true,ball);
  };
  $('missBallCancelBtn').onclick=()=>{ pendingMissReason=null; $('missBallModal').classList.remove('show'); $('missReasonModal').classList.add('show'); };

  function registerMissReason(reason,ballAlreadyLogged=false,skipUndoSave=false,missBall=null){
    if(!match || pendingMissPlayer===null)return;
    if(!skipUndoSave)saveManualEntryUndoSnapshot('MISS');
    const i=pendingMissPlayer;
    const s=match.stats[i];
    const reasonLabel=reason==='bad_position' ? 'obtížná pozice' : 'špatně zahráno';

    s.matchOnlyMisses=Number(s.matchOnlyMisses||0)+1;
    if(reason==='bad_position'){
      s.matchOnlyMissBadPosition=Number(s.matchOnlyMissBadPosition||0)+1;
    }else{
      s.matchOnlyMissPot=Number(s.matchOnlyMissPot||0)+1;
    }
    const ballPart=missBall!=null ? ' na '+Number(missBall) : '';
    addActionEvent(match.playerNames[i]+' • MISS'+ballPart+' • '+reasonLabel);

    match.consecutiveFouls[i]=0;
    match.warnedTwoFouls[i]=false;
    match.isBreakShot=false;
    consumeSoftBreakReturnOnShot(i);
    consumePushOutOptionOnAction(i);
    match.breakAndRunEligible=false;
    // Běžný MISS v průběhu racku nevytváří nárok na speciální DOHRÁVKU.
    // Konkrétní koule se dál eviduje pro statistiky a stav racku.
    match.runoutEligibleFor=null;
    match.runoutEligibleReason=null;
    match.safetyEscapeEligibleFor=null;
    match.turn=1-i;

    $('missReasonModal').classList.remove('show');
    pendingMissPlayer=null;

    if(match.useClock)resetClock(false,true);
    renderMatch();
  }

  $('missReasonPositionBtn').onclick=()=>{ $('missReasonModal').classList.remove('show'); exactBallTrackingDiscipline()?openMissBallChoice('bad_position'):registerMissReason('bad_position'); };
  $('missReasonPotBtn').onclick=()=>{ $('missReasonModal').classList.remove('show'); exactBallTrackingDiscipline()?openMissBallChoice('missed_ball'):registerMissReason('missed_ball'); };
  $('missReasonCancelBtn').onclick=()=>{
    $('missReasonModal').classList.remove('show');
    pendingMissPlayer=null;
    if(match?.useClock)resetClock(false,true);
  };

  $('confirmThreeFoul').onclick=()=>{
    $('threeFoulModal').classList.remove('show');
    const loser=pendingThreeFoulLoser, winner=1-loser;
    match.stats[loser].threeFoulLosses++;
    pendingThreeFoulLoser=null;
    winRack(winner,true,'3 Foul Rule');
  };



  let lastManualEntrySnapshot=null;

  function cloneForUndo(value){
    try{return JSON.parse(JSON.stringify(value));}
    catch(e){return null;}
  }

  function saveManualEntryUndoSnapshot(label='Změna'){
    if(!match)return;
    const snapshot=cloneForUndo(match);
    if(!snapshot)return;
    lastManualEntrySnapshot={match:snapshot,label,createdAt:Date.now()};
  }

  function restoreManualEntryUndoSnapshot(){
    if(!lastManualEntrySnapshot?.match || !match){
      toast('Není co vrátit.');
      return;
    }

    const currentId=match.id;
    const restored=cloneForUndo(lastManualEntrySnapshot.match);
    if(!restored || (currentId && restored.id && currentId!==restored.id)){
      toast('Poslední změnu už nelze vrátit.');
      return;
    }

    match=restored;
    lastManualEntrySnapshot=null;
    saveDeviceActiveMatch(match);
    renderMatch();
    scheduleStreamSend?.();
    toast('Poslední zadání bylo vráceno.');
  }

  window.restoreManualEntryUndoSnapshot=restoreManualEntryUndoSnapshot;

  function simpleFinishRack(player,{statType=null,label='+1'}={}){
    if(!match || match.counterMode!=='simple' || !editableMatchOwnedByCurrentUser(match))return;
    if(match.endedAt || match.status==='complete'){
      toast('Zápas už je ukončený.');
      return;
    }
    player=Number(player);
    if(player!==0 && player!==1)return;

    saveManualEntryUndoSnapshot(label);
    match.stats[player]=match.stats[player]||blankMatchStats();

    if(statType==='breakAndRun'){
      match.stats[player].breakAndRun=Number(match.stats[player].breakAndRun||0)+1;
      addActionEvent('⭐ ČISTÁ HRA • Break & Run • '+match.playerNames[player]+' • jednoduché počítadlo');
      playSpecialSound();
    }else if(statType==='runout'){
      match.stats[player].runouts=Number(match.stats[player].runouts||0)+1;
      addActionEvent('DOHRÁVKA • '+match.playerNames[player]+' • jednoduché počítadlo');
    }else{
      addActionEvent('+1 • '+match.playerNames[player]);
    }

    // VÍTĚZ NA STOLE je nekonečná session bez Race to.
    // Po bodu vítěz zůstává, poražený jde čekat a třetí hráč přichází na stůl.
    if(match.winnerTableMode){
      winRack(player,true,label);
      return;
    }

    const target=normalRaceTarget(match);
    match.target=target;
    match.scores[player]=Math.min(target,Number(match.scores[player]||0)+1);
    logEvent('Skóre '+match.scores[0]+':'+match.scores[1]);

    if(match.scores[player]>=target){
      finishMatch(player);
      return;
    }

    advanceBreakerAfterRack(player);
    match.rackNumber++;
    beginRack();
    renderMatch();
  }

  window.simpleAddPoint=function(player){
    simpleFinishRack(player,{label:'+1'});
  };

  window.simpleAddBreakAndRun=function(){
    if(!match || match.counterMode!=='simple')return;
    const breaker=Number(match.breaker||0);
    simpleFinishRack(breaker,{statType:'breakAndRun',label:'Čistá hra'});
  };

  window.simpleAddRunout=function(player){
    simpleFinishRack(player,{statType:'runout',label:'Dohrávka'});
  };

  if($('simpleAddP1'))$('simpleAddP1').onclick=()=>simpleAddPoint(0);
  if($('simpleAddP2'))$('simpleAddP2').onclick=()=>simpleAddPoint(1);
  if($('simpleBreakRunBtn'))$('simpleBreakRunBtn').onclick=()=>simpleAddBreakAndRun();
  if($('simpleRunoutP1'))$('simpleRunoutP1').onclick=()=>simpleAddRunout(0);
  if($('simpleRunoutP2'))$('simpleRunoutP2').onclick=()=>simpleAddRunout(1);
  if($('simpleUndoBtn'))$('simpleUndoBtn').onclick=restoreManualEntryUndoSnapshot;
  if($('fullUndoBtn'))$('fullUndoBtn').onclick=restoreManualEntryUndoSnapshot;

  window.adjustRackScore=function(player,delta){
    if(!match || !editableMatchOwnedByCurrentUser(match))return;
    if(match.endedAt || match.status==='complete'){
      toast('Zápas už je ukončený.');
      return;
    }
    if(match.discipline==='14.1' || match.ghostMode || match.winnerTableMode)return;

    player=Number(player);
    delta=Number(delta);
    if((player!==0&&player!==1) || !delta)return;

    // +/- je běžně určeno jednoduchému počítadlu.
    // V rozšířeném režimu ho povolujeme navíc pouze u turnajových 8/9/10-ball zápasů.
    const tournamentRackScoreAdjust=
      !!match.tournamentLink &&
      ['8-ball','9-ball','10-ball'].includes(match.discipline);

    if(match.counterMode!=='simple' && !tournamentRackScoreAdjust)return;

    if(delta>0){
      saveManualEntryUndoSnapshot('Turnajové skóre +1');
      winRack(player,false,'Bod');
      return;
    }

    if(delta<0){
      if((match.scores[player]||0)<=0){
        toast('Skóre už je na nule.');
        return;
      }
      saveManualEntryUndoSnapshot('Turnajové skóre −1');
      addActionEvent('Oprava skóre −1 • '+match.playerNames[player]);
      match.scores[player]=Math.max(0,(match.scores[player]||0)-1);
      logEvent('Skóre '+match.scores[0]+':'+match.scores[1]);
      renderMatch();
      autosaveCurrent();
    }
  };


  function openManualScoreCorrection(){
    if(!match || match.counterMode==='simple' || match.discipline==='14.1' ||
       match.ghostMode || match.winnerTableMode)return;
    $('manualScoreCorrectionP1Label').textContent=match.playerNames?.[0]||'Hráč 1';
    $('manualScoreCorrectionP2Label').textContent=match.playerNames?.[1]||'Hráč 2';
    $('manualScoreCorrectionP1').value=Number(match.scores?.[0]||0);
    $('manualScoreCorrectionP2').value=Number(match.scores?.[1]||0);
    $('manualScoreCorrectionModal').classList.add('show');
  }

  if($('manualScoreCorrectionBtn')){
    $('manualScoreCorrectionBtn').onclick=openManualScoreCorrection;
  }

  $('manualScoreCorrectionCancelBtn').onclick=()=>{
    $('manualScoreCorrectionModal').classList.remove('show');
  };

  $('manualScoreCorrectionConfirmBtn').onclick=()=>{
    if(!match)return;
    const old0=Number(match.scores?.[0]||0);
    const old1=Number(match.scores?.[1]||0);
    const target=normalRaceTarget(match);

    let n0=Math.max(0,parseInt($('manualScoreCorrectionP1').value||'0',10)||0);
    let n1=Math.max(0,parseInt($('manualScoreCorrectionP2').value||'0',10)||0);
    if(Number.isFinite(target) && target>0){
      n0=Math.min(target,n0);
      n1=Math.min(target,n1);
    }

    if(n0===old0 && n1===old1){
      $('manualScoreCorrectionModal').classList.remove('show');
      return;
    }

    saveManualEntryUndoSnapshot('Ruční oprava skóre');
    match.scores=[n0,n1];
    addActionEvent('RUČNÍ OPRAVA SKÓRE • '+old0+':'+old1+' → '+n0+':'+n1);
    logEvent('Ruční oprava skóre '+old0+':'+old1+' → '+n0+':'+n1);
    $('manualScoreCorrectionModal').classList.remove('show');
    renderMatch();
  };


  function advanceBreakerAfterRack(winner){
    if(!match)return;

    const currentBreaker=Number(match.breaker||0);
    const mode=String(match.breakMode||'alternate');

    if(mode==='alternate'){
      // Střídavý rozstřel po jednom racku – funguje stejně pro singl i dvojice.
      match.breaker=1-currentBreaker;
    }else if(mode==='alternate2'){
      // Každá strana rozstřeluje dva racky po sobě.
      // rackNumber je číslo právě dohraného racku.
      match.breaker=(Number(match.rackNumber||1)%2===0)
        ? 1-currentBreaker
        : currentBreaker;
    }else if(mode==='winner'){
      match.breaker=Number(winner);
    }else{
      // Bezpečný fallback: u neznámého režimu raději střídavý break,
      // aby jedna strana nezůstala omylem na rozstřelu.
      match.breaker=1-currentBreaker;
    }

    if(match.doublesMode){
      logEvent(
        'DVOJICE • další rozstřel: '+match.playerNames[match.breaker]+
        ' • '+breakModeLabel(mode)
      );
    }else{
      logEvent('Další rozstřel • '+match.playerNames[match.breaker]);
    }
  }

  window.winRack = function(winner, fromAction=false, reason='Rack'){
    if(!match) return;
    if(match.endedAt || match.status==='complete'){
      toast('Zápas už je ukončený.');
      return;
    }

    if(match.winnerTableMode){
      if(!fromAction) addActionEvent(reason+' pro '+match.playerNames[winner]);

      const wt=match.winnerTable;
      const loser=1-winner;
      const globalWinner=wt.active[winner];
      const globalLoser=wt.active[loser];
      const incoming=wt.waiting;

      wt.wins[globalWinner]=(wt.wins[globalWinner]||0)+1;
      if(!Array.isArray(wt.rackHistory))wt.rackHistory=[];
      wt.rackHistory.push({rack:wt.rackHistory.length+1,winnerIndex:globalWinner,loserIndex:globalLoser,wins:wt.wins.slice(0,3).map(n=>Math.max(0,Number(n)||0)),ts:new Date().toISOString()});
      logEvent(
        wt.players[globalWinner].displayName+' vyhrává rack • celkem '+wt.wins[globalWinner]+' výher'
      );

      toast('Máš tam prácičku, '+wt.players[globalLoser].displayName+'.');

      // Vítěz zůstává na stejné straně. Čekající nahradí poraženého.
      wt.active[loser]=incoming;
      wt.waiting=globalLoser;

      // Nově příchozí hráč vždy rozstřeluje.
      match.breaker=loser;
      match.turn=loser;
      match.rackNumber++;
      syncWinnerTableSlots();

      logEvent(
        wt.players[globalLoser].displayName+' jde čekat a staví trojúhelník • '+
        wt.players[incoming].displayName+' jde na stůl a rozstřeluje'
      );

      beginRack();
      renderMatch();
      return;
    }

    if(!fromAction) addActionEvent(reason+' pro '+match.playerNames[winner]);

    const target=normalRaceTarget(match);
    match.target=target;
    match.scores[winner]=Math.min(target,Number(match.scores[winner]||0)+1);
    logEvent('Skóre '+match.scores[0]+':'+match.scores[1]);

    if(checkNormalRaceTarget()){
      renderMatch();
      return;
    }

    advanceBreakerAfterRack(winner);
    match.rackNumber++;
    beginRack();
    renderMatch();
  }

  const SPECIAL_SOUND_SRC = "data:audio/mpeg;base64,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";
  let specialSoundAudio = null;

  function playSpecialSound(){
    try{
      if(!specialSoundAudio){
        specialSoundAudio = new Audio(SPECIAL_SOUND_SRC);
        specialSoundAudio.preload = 'auto';
      }
      specialSoundAudio.pause();
      specialSoundAudio.currentTime = 0;
      const p = specialSoundAudio.play();
      if(p && typeof p.catch === 'function'){
        p.catch(()=>toast('Klepni na tlačítko ještě jednou pro povolení zvuku.'));
      }
    }catch(e){
      toast('Zvuk se nepodařilo přehrát.');
    }
  }

  $('specialSoundBtn').onclick=playSpecialSound;
  $('matchStatsSound').onclick=playSpecialSound;

  let ghostCompleted=null;
  let ghostUsedBIH=null;

  function resetGhostModalState(){
    ghostCompleted=null;
    ghostUsedBIH=null;
    $('ghostCompletedYes').classList.remove('active');
    $('ghostCompletedNo').classList.remove('active');
    $('ghostBIHYes').classList.remove('active');
    $('ghostBIHNo').classList.remove('active');
    $('ghostBIHBlock').classList.add('hidden');
    $('ghostResultPreview').textContent='';
  }

  function updateGhostPreview(){
    if(ghostCompleted===false){
      $('ghostResultPreview').textContent='Výsledek: GHOST +1';
    }else if(ghostCompleted===true && ghostUsedBIH===true){
      $('ghostResultPreview').textContent='Výsledek: hráč +1';
    }else if(ghostCompleted===true && ghostUsedBIH===false){
      $('ghostResultPreview').textContent='Výsledek: hráč +2';
    }else{
      $('ghostResultPreview').textContent='';
    }
  }

  function finishGhostRackOutcome(type,errorBall=null){
    if(!match || !match.ghostMode)return;
    if(!['dry','soft_break','break_foul','ace','failed','bih','clean'].includes(type))return;
    if(type==='ace' && match.discipline!=='9-ball')return;

    const rackNo=Math.max(1,Number(match.ghostRackNumber||1));
    const label=
      type==='clean'?'ČISTĚ DOHRÁNO':
      type==='bih'?'DOHRÁVKA S BÍLOU V RUCE':
      type==='ace'?'ESO • 9 Z BREAKU':
      type==='break_foul'?'FAUL Z ROZSTŘELU':
      type==='soft_break'?'SOFT BREAK':
      type==='failed'?'NEDOHRÁNO':'DRY BREAK';

    // Ghost one-tap musí být vždy vratný přes UNDO.
    saveManualEntryUndoSnapshot('Ghost • Rack '+rackNo+' • '+label);

    match.isBreakShot=false;
    match.stats[0]=match.stats[0]||blankMatchStats();
    if(!Array.isArray(match.ghostRackHistory))match.ghostRackHistory=[];

    let playerDelta=0;
    let ghostDelta=0;
    const ball=type==='failed'?Number(errorBall||0):0;

    if(type==='dry'){
      ghostDelta=1;
      match.scores[1]+=1;
      match.stats[0].ghostDryBreaks=Number(match.stats[0].ghostDryBreaks||0)+1;
    }else if(type==='break_foul'){
      ghostDelta=1;
      match.scores[1]+=1;
      match.stats[0].breakFouls=Number(match.stats[0].breakFouls||0)+1;
      match.stats[0].fouls=Number(match.stats[0].fouls||0)+1;
      match.stats[0].ghostBreakFouls=Number(match.stats[0].ghostBreakFouls||0)+1;
    }else if(type==='soft_break'){
      ghostDelta=1;
      match.scores[1]+=1;
      match.stats[0].softBreaks=Number(match.stats[0].softBreaks||0)+1;
      match.stats[0].ghostSoftBreaks=Number(match.stats[0].ghostSoftBreaks||0)+1;
    }else if(type==='ace'){
      playerDelta=2;
      match.scores[0]+=2;
      match.stats[0].aces=Number(match.stats[0].aces||0)+1;
      match.stats[0].ghostAces=Number(match.stats[0].ghostAces||0)+1;
    }else if(type==='failed'){
      ghostDelta=1;
      match.scores[1]+=1;
      match.stats[0].ghostFailedRacks=Number(match.stats[0].ghostFailedRacks||0)+1;
      if(ball){
        match.stats[0].ghostMissesByBall=match.stats[0].ghostMissesByBall||{};
        match.stats[0].ghostMissesByBall[ball]=Number(match.stats[0].ghostMissesByBall[ball]||0)+1;
        match.ghostMissBall=ball;
        match.lastMissBall=ball;
      }
    }else if(type==='bih'){
      playerDelta=1;
      match.scores[0]+=1;
      match.stats[0].ghostBIHRunouts=Number(match.stats[0].ghostBIHRunouts||0)+1;
    }else if(type==='clean'){
      playerDelta=2;
      match.scores[0]+=2;
      match.stats[0].ghostCleanRunouts=Number(match.stats[0].ghostCleanRunouts||0)+1;
    }

    const detail=type==='failed' && ball ? ' • chyba na kouli '+ball : '';
    const points=playerDelta ? ' • HRÁČ +'+playerDelta : ' • GHOST +'+ghostDelta;
    addActionEvent('Ghost • Rack '+rackNo+' • '+label+detail+points);

    match.ghostRackHistory.push({
      rack:rackNo,
      type,
      label,
      errorBall:ball||null,
      playerDelta,
      ghostDelta,
      scorePlayer:Number(match.scores[0]||0),
      scoreGhost:Number(match.scores[1]||0),
      ts:new Date().toISOString()
    });

    logEvent('Skóre '+match.scores[0]+':'+match.scores[1]);
    closeGhostMissBallPicker();
    autosaveCurrent();
    if(checkGhostTarget()){renderMatch();return;}
    nextGhostRack();
  }

  if($('ghostCleanRunoutBtn'))$('ghostCleanRunoutBtn').onclick=()=>finishGhostRackOutcome('clean');
  if($('ghostBIHRunoutBtn'))$('ghostBIHRunoutBtn').onclick=()=>finishGhostRackOutcome('bih');
  if($('ghostAceBtn'))$('ghostAceBtn').onclick=()=>finishGhostRackOutcome('ace');
  if($('ghostBreakFoulBtn'))$('ghostBreakFoulBtn').onclick=()=>finishGhostRackOutcome('break_foul');
  if($('ghostSoftBreakBtn'))$('ghostSoftBreakBtn').onclick=()=>finishGhostRackOutcome('soft_break');
  if($('ghostFailedRackBtn'))$('ghostFailedRackBtn').onclick=()=>{
    openGhostMissBallPicker(ball=>finishGhostRackOutcome('failed',ball));
  };
  if($('ghostDryBreakBtn'))$('ghostDryBreakBtn').onclick=()=>finishGhostRackOutcome('dry');
  if($('ghostScoringHelpBtn'))$('ghostScoringHelpBtn').onclick=()=>{
    $('ghostScoringHelp')?.classList.toggle('hidden');
  };

  // Starý vícekrokový Ghost modal ponecháváme v HTML pouze kvůli kompatibilitě
  // s případným rozehraným stavem starší verze; nové ovládání ho už nepoužívá.
  if($('ghostEvaluateBtn'))$('ghostEvaluateBtn').onclick=()=>{};
  if($('ghostCancel'))$('ghostCancel').onclick=()=>{$('ghostModal').classList.remove('show');};

  function nextGhostRack(){
    match.ghostRackNumber=(match.ghostRackNumber||1)+1;
    match.turn=0;
    match.breaker=0;
    if(match.useClock) resetClock(true,true);
    renderMatch();
    autosaveCurrent();
  }

  function checkGhostTarget(){
    if(match.scores[0]>=match.target){finishMatch(0);return true;}
    if(match.scores[1]>=match.target){finishMatch(1);return true;}
    return false;
  }

  function renderBallsChoices14(){
    const wrap=$('ballsChoices14');
    if(!wrap) return;
    wrap.innerHTML='';
    for(let n=1;n<=15;n++){
      const b=document.createElement('button');
      b.type='button';
      b.className='btn';
      b.textContent=String(n);
      b.style.fontSize='20px';
      b.style.fontWeight='950';
      b.dataset.value=String(n);

      if(String(n)===$('ballsRemaining14').value){
        b.classList.add('active');
      }

      b.onclick=()=>{
        $('ballsRemaining14').value=String(n);
        [...wrap.children].forEach(x=>x.classList.remove('active'));
        b.classList.add('active');
        updateBallsCalc14();
      };
      wrap.appendChild(b);
    }
  }

  function awardSolo14GhostError(reason){
    if(!match?.solo14 || !match?.solo14GhostMode)return 0;
    if(reason!=='miss' && reason!=='foul' && reason!=='opening_break_foul')return 0;

    const pts=Math.max(1,Number(match.solo14GhostPointsPerError||0));
    match.scores[1]=Number(match.scores[1]||0)+pts;
    match.solo14GhostErrors=Number(match.solo14GhostErrors||0)+1;
    addActionEvent('14.1 Ghost • chyba hráče • +'+pts+' bodů Ghost');
    return pts;
  }

  function openEndInning14(reason){
    if(!match || match.discipline!=='14.1') return;
    if(match.ballsOnTable==null) match.ballsOnTable=15;
    match.pendingEndReason14=reason;

    const labels={miss:'MISS',safe:'SAFE',foul:'FAUL'};
    $('inningReason14').textContent=labels[reason]||reason.toUpperCase();
    $('ballsPrompt14').textContent=match.playerNames[match.turn]+' ukončil náběh jako '+(labels[reason]||reason)+'. Výpočtový stav je '+match.ballsOnTable+'. Zadej skutečný počet koulí, které zůstaly na stole.';
    $('ballsRemaining14').value=String(Math.min(15,Math.max(1,match.ballsOnTable)));
    renderBallsChoices14();
    updateBallsCalc14();
    $('ballsModal14').classList.add('show');
  }

  function updateBallsCalc14(){
    if(!match || match.discipline!=='14.1') return;
    let remaining=parseInt($('ballsRemaining14').value,10);
    if(isNaN(remaining)) remaining=0;
    remaining=Math.max(1,Math.min(15,remaining));
    const calculationState=Number(match.ballsOnTable||0);
    const potted=Math.max(0,calculationState-remaining);
    $('ballsCalc14').textContent='Zahráno v náběhu: '+potted+' → +'+potted+' bodů';
  }

  $('endMiss14').onclick=()=>openEndInning14('miss');
  $('endSafe14').onclick=()=>openEndInning14('safe');
  $('endFoul14').onclick=()=>openEndInning14('foul');
  $('cancelBalls14').onclick=()=>{match.pendingEndReason14=null;$('ballsModal14').classList.remove('show');};

  $('confirmBalls14').onclick=()=>{
    if(!match || match.discipline!=='14.1') return;
    match.isBreakShot=false;
    const before=match.ballsOnTable;
    const remaining=parseInt($('ballsRemaining14').value,10);
    if(isNaN(remaining)){ toast('Zadej počet koulí na stole.'); return; }
    if(remaining<1 || remaining>15){ toast('Vyber počet koulí od 1 do 15.'); return; }

    const i=match.turn;
    const reason=match.pendingEndReason14||'miss';
    const potted=before-remaining;

    addActionEvent('14.1 náběh • '+match.playerNames[i]+' • '+reason.toUpperCase()+' • zahráno '+potted+' • na stole '+remaining);
    match.scores[i]+=potted;
    match.stats[i].innings14=(match.stats[i].innings14||0)+1;
    match.stats[i].highRun14=Math.max(match.stats[i].highRun14||0,potted);

    let penalty=0;

    if(reason==='miss'){
      match.stats[i].matchOnlyMisses=(match.stats[i].matchOnlyMisses||0)+1;
      match.consecutiveFouls14[i]=0;
    }else if(reason==='safe'){
      match.stats[i].safeties++;
      match.consecutiveFouls14[i]=0;
    }else if(reason==='foul'){
      match.stats[i].fouls++;
      match.consecutiveFouls14[i]=(match.consecutiveFouls14[i]||0)+1;

      if(match.consecutiveFouls14[i]>=3){
        penalty=16;
        match.stats[i].threeFoulPenalties14=(match.stats[i].threeFoulPenalties14||0)+1;
        match.consecutiveFouls14[i]=0;
        logEvent('14.1 • 3 po sobě jdoucí fauly • '+match.playerNames[i]+' −16 bodů');
      }else{
        penalty=1;
      }

      match.scores[i]-=penalty;
      match.stats[i].foulPenaltyPoints14=(match.stats[i].foulPenaltyPoints14||0)+penalty;
    }

    if(match.solo14GhostMode && (reason==='miss' || reason==='foul')){
      const ghostPts=awardSolo14GhostError(reason);
      if(ghostPts>0)toast('GHOST +'+ghostPts+' bodů za chybu');
    }

    if(!Array.isArray(match.inningsHistory14))match.inningsHistory14=[];
    match.inningsHistory14.push({
      player:i,
      playerName:match.playerNames[i],
      run:potted,
      reason,
      penalty,
      total:match.scores[i],
      ts:new Date().toISOString()
    });

    match.ballsOnTable=remaining;
    match.reracksInInning14=0;
    match.pendingEndReason14=null;
    match.openingBreakAvailable14=false;
    $('ballsModal14').classList.remove('show');

    if(penalty>0) toast('FAUL −'+penalty+' bod'+(penalty===1?'':'ů'));

    if(checkFourteenOneTarget()){
      renderMatch();
      return;
    }

    match.turn=match.solo14 ? 0 : 1-i;
    if(match.useClock) resetClock(false,true);
    renderMatch();
    autosaveCurrent();
  };

  $('openingBreakFoul14').onclick=()=>{
    if(!match || match.discipline!=='14.1' || !match.openingBreakAvailable14) return;
    match.isBreakShot=false;
    const i=match.turn;
    addActionEvent('14.1 • faul na úvodním rozstřelu • '+match.playerNames[i]+' −2 body');
    match.scores[i]-=2;
    match.stats[i].fouls++;
    match.stats[i].openingBreakFouls14=(match.stats[i].openingBreakFouls14||0)+1;
    match.stats[i].foulPenaltyPoints14=(match.stats[i].foulPenaltyPoints14||0)+2;
    match.consecutiveFouls14[i]=(match.consecutiveFouls14[i]||0)+1;
    match.openingBreakAvailable14=false;
    if(!Array.isArray(match.inningsHistory14))match.inningsHistory14=[];
    match.inningsHistory14.push({
      player:i,
      playerName:match.playerNames[i],
      run:0,
      reason:'opening_break_foul',
      penalty:2,
      total:match.scores[i],
      ts:new Date().toISOString()
    });
    const openingGhostPts=awardSolo14GhostError('opening_break_foul');
    toast('FAUL NA ÚVODNÍM ROZSTŘELU −2'+(openingGhostPts>0?' • GHOST +'+openingGhostPts:'') );
    match.turn=match.solo14 ? 0 : 1-i;
    if(match.useClock) resetClock(false,true);
    renderMatch();
    autosaveCurrent();
  };


  $('addRack14').onclick=()=>{
    if(!match || match.discipline!=='14.1') return;
    if(match.ballsOnTable==null) match.ballsOnTable=15;
    if(match.reracksInInning14==null) match.reracksInInning14=0;

    const before=match.ballsOnTable;

    // Každý nový trojúhelník přidá do výpočtového stavu přesně 14 nových koulí.
    // Koule, které už na stole jsou, se nijak neodečítají.
    // Příklad: stav 3 -> nový trojúhelník -> 17.
    match.ballsOnTable=before+14;

    match.reracksInInning14++;
    addActionEvent(
      '14.1 • nový trojúhelník +14 • výpočtový stav '+before+' → '+match.ballsOnTable
    );
    renderMatch();
    autosaveCurrent();
  };

  $('manualBreaker').onclick=()=>{
    if(!match) return;
    addActionEvent('Ruční změna rozstřelu');
    match.breaker=1-match.breaker;
    match.turn=match.breaker;
    if(match.useClock) resetClock(true,true);
    renderMatch();
  };

  $('resultConfirmationAccept').onclick=async()=>{
    if(pendingOwnResultConfirmationResolve){
      const resolve=pendingOwnResultConfirmationResolve;
      pendingOwnResultConfirmationResolve=null;
      $('resultConfirmationModal').classList.remove('show');
      resolve(true);
      return;
    }
    await respondToInboxMatchConfirmation('confirmed');
  };

  $('resultConfirmationReject').onclick=async()=>{
    if(pendingOwnResultConfirmationResolve){
      const resolve=pendingOwnResultConfirmationResolve;
      pendingOwnResultConfirmationResolve=null;
      $('resultConfirmationModal').classList.remove('show');
      resolve(false);
      return;
    }
    await respondToInboxMatchConfirmation('rejected');
  };

  if($('resultConfirmationLater')){
    $('resultConfirmationLater').onclick=()=>{
      const id=pendingInboxConfirmationMatchId;
      if(id)postponedResultConfirmationIds.add(id);
      pendingInboxConfirmationMatchId=null;
      $('resultConfirmationModal').classList.remove('show');
      $('resultConfirmationLater').classList.add('hidden');
      $('resultConfirmationReject').disabled=false;
      $('resultConfirmationAccept').disabled=false;
      toast('Potvrzení bylo odloženo. Zobrazí se znovu po novém načtení aplikace.');
    };
  }

  $('finishMatch').onclick=()=>{
    if(!match) return;
    const winner = (match.solo14||match.ghostMode||match.winnerTableMode) ? null : (match.scores[0]===match.scores[1] ? null : (match.scores[0]>match.scores[1]?0:1));
    match.status=(match.solo14||match.ghostMode||match.winnerTableMode)?'complete':'incomplete';
    finishMatch(winner,true);
  };

  $('cancelMatch').onclick=async()=>{
    if(!match) return;
    if(!confirm('Opravdu zrušit rozehraný zápas? Nebude uložen a žádné jeho statistiky se nezapočítají.')) return;
    stopTimer();
    stopLiveHeartbeat();
    clearTimeout(activeMatchCloudSaveTimer);
    const cancelledLiveId=match.id;
    const hadStream=!!match.streamEnabled;
    await removeLiveMatch(cancelledLiveId);
    await removeActiveMatchCloudBackup(cancelledLiveId);
    removeDeviceActiveMatch(cancelledLiveId);
    if(hadStream)await clearStreamState();
    match=null;
    saveDeviceActiveMatch(null);
    data.currentMatch=null;
    saveData();
    showScreen('setup');
    renderLive();
    toast('Zápas byl zrušen bez uložení.');
  };

  let tournamentAutoFinalizeInProgress=false;

