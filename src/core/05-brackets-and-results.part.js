  function bracketMatchHtml(t,m){
    const done=(m.status==='done'||!!m.winnerId||!!m.loserId);
    const p1=tournamentPlayerName(m.player1Id,t);
    const p2=tournamentPlayerName(m.player2Id,t);
    const p1Winner=done&&m.winnerId===m.player1Id;
    const p2Winner=done&&m.winnerId===m.player2Id;
    const p1Out=!!t.dko&&dkoPlayerIsOut(t,m.player1Id);
    const p2Out=!!t.dko&&dkoPlayerIsOut(t,m.player2Id);
    const status=done?'DOHRÁNO':(m.status==='playing'?'HRAJE SE':(m.tableNumber?'STŮL '+m.tableNumber:'ČEKÁ'));
    return `<div class="bracket-match ${done?'done':''}">
      <div class="bracket-match-head"><span>${esc(m.roundLabel||m.bracket||'Zápas')}</span><span>${esc(status)}</span></div>
      <div class="bracket-player ${p1Winner?'winner':''} ${p1Out?'out':''}">
        <span>${esc(p1)}</span><span class="bracket-score">${done?(m.score1??'–'):'–'}</span>
      </div>
      <div class="bracket-player ${p2Winner?'winner':''} ${p2Out?'out':''}">
        <span>${esc(p2)}</span><span class="bracket-score">${done?(m.score2??'–'):'–'}</span>
      </div>
    </div>`;
  }

  function bracketRoundHtml(t,r,title){
    const matches=(r.matches||[]).map(m=>bracketMatchHtml(t,m)).join('');
    const byes=(r.byes||[]).map(b=>`<div class="bracket-bye"><strong>${esc(tournamentPlayerName(b.playerId,t))}</strong> • VOLNÝ LOS / BYE</div>`).join('');
    return `<div class="bracket-round"><h4>${esc(title||r.label||'KOLO')}</h4>${matches}${byes}</div>`;
  }

  function buildDKOBracketHtml(t){
    const winnerRounds=[],loserRounds=[],finalRounds=[];
    (t.dko?.rounds||[]).forEach((r,ri)=>{
      const w=(r.matches||[]).filter(m=>m.bracket==='W');
      const l=(r.matches||[]).filter(m=>m.bracket==='L');
      const gf=(r.matches||[]).filter(m=>m.bracket==='GF'||m.bracket==='3P');
      const wb=(r.byes||[]).filter(b=>b.bracket==='W');
      const lb=(r.byes||[]).filter(b=>b.bracket==='L');

      if(w.length||wb.length) winnerRounds.push({...r,matches:w,byes:wb,_title:'A • '+(r.label||('kolo '+(ri+1)))});
      if(l.length||lb.length) loserRounds.push({...r,matches:l,byes:lb,_title:'B • '+(r.label||('kolo '+(ri+1)))});
      if(gf.length) finalRounds.push({...r,matches:gf,byes:[],_title:r.label||'Finálové zápasy'});
    });

    const section=(title,sub,rounds,empty)=>`
      <div class="bracket-section">
        <div class="bracket-section-title"><strong>${title}</strong><span class="muted">${sub}</span></div>
        <div class="bracket-columns">${rounds.length?rounds.map(r=>bracketRoundHtml(t,r,r._title)).join(''):`<div class="muted">${empty}</div>`}</div>
      </div>`;

    return `<div class="bracket-wrap">
      ${section('A STRANA • WINNER BRACKET','vítěz zůstává na A straně',winnerRounds,'Další zápasy A strany zatím nejsou určené.')}
      ${section('B STRANA • LOSER BRACKET','1. prohra přesouvá hráče sem',loserRounds,'B strana se doplní podle výsledků.')}
      ${section('FINÁLE','Grand Final'+(t.dko?.thirdPlacePlayoff?' + zápas o 3. místo':''),finalRounds,'Finálové zápasy zatím nejsou určené.')}
      <div class="bracket-legend">
        <span><strong style="color:var(--gold2)">Zlatě</strong> = vítěz zápasu</span>
        <span>Přeškrtnutý = 2 prohry / OUT</span>
      </div>
      <div class="bracket-note">
        Současné DKO vytváří další dvojice až podle skutečných výsledků. Pavouk proto ukazuje všechny již známé cesty a nepředstírá budoucího soupeře, dokud není opravdu určen.
      </div>
    </div>`;
  }

  function buildSKOBracketHtml(t){
    return `<div class="bracket-wrap">
      <div class="bracket-section">
        <div class="bracket-section-title"><strong>SKO PAVOUK</strong><span class="muted">jedna prohra = konec</span></div>
        <div class="bracket-columns">${(t.ko?.rounds||[]).map(r=>bracketRoundHtml(t,r,r.label)).join('')}</div>
      </div>
    </div>`;
  }

  window.openSKOBracket=function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t||!t.ko)return;
    $('bracketModalTitle').textContent=t.name+' • SKO';
    $('bracketModalBody').innerHTML=buildSKOBracketHtml(t);
    $('bracketModal').classList.add('show');
  };

  window.openTournamentBracket=function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t)return;
    if(!t.dko){toast('DKO pavouk není v tomto turnaji dostupný.');return;}
    $('bracketModalTitle').textContent=t.name+' • DKO';
    $('bracketModalBody').innerHTML=buildDKOBracketHtml(t);
    $('bracketModal').classList.add('show');
  };

  $('bracketCloseBtn').onclick=()=> $('bracketModal').classList.remove('show');
  $('bracketModal').addEventListener('click',e=>{if(e.target===$('bracketModal'))$('bracketModal').classList.remove('show');});
  $('bracketFullscreenBtn').onclick=async()=>{
    const card=$('bracketModal').querySelector('.bracket-modal-card');
    try{
      if(!document.fullscreenElement) await card.requestFullscreen();
      else await document.exitFullscreen();
    }catch(e){toast('Celou obrazovku se nepodařilo otevřít.');}
  };



  function reconcileTournamentResultsFromMatches(targetTournamentId=null){
    let changed=false;
    const completed=(data.matches||[]).filter(m=>
      m &&
      m.tournamentLink &&
      m.tournamentLink.tournamentId &&
      m.tournamentLink.tournamentMatchId &&
      m.endedAt &&
      (m.winner===0||m.winner===1)
    );

    (data.tournaments||[]).forEach(t=>{
      if(targetTournamentId && t.id!==targetTournamentId) return;

      completed
        .filter(sm=>sm.tournamentLink.tournamentId===t.id)
        .forEach(sm=>{
          const tm=findTournamentMatch(t,sm.tournamentLink.tournamentMatchId);
          if(!tm)return;

          const winnerId=sm.playerIds?.[sm.winner]||null;
          const loserId=sm.playerIds?.[1-sm.winner]||null;

          const needsUpdate=
            tm.status!=='done' ||
            tm.scoreboardMatchId!==sm.id ||
            tm.score1!==sm.scores?.[0] ||
            tm.score2!==sm.scores?.[1] ||
            tm.winnerId!==winnerId ||
            tm.loserId!==loserId;

          if(!needsUpdate)return;

          tm.status='done';
          tm.tableNumber=null;
          tm.resumable=false;
          tm.finishedAt=sm.endedAt;
          tm.scoreboardMatchId=sm.id;
          tm.score1=sm.scores?.[0]??tm.score1;
          tm.score2=sm.scores?.[1]??tm.score2;
          tm.winnerId=winnerId;
          tm.loserId=loserId;
          changed=true;
        });

      if(changed && t.dko){
        // Rebuild DKO losses from actual completed tournament matches.
        const losses={};
        (t.playerIds||[]).forEach(id=>losses[id]=0);
        (t.dko?.rounds||[]).forEach(r=>(r.matches||[]).forEach(tm=>{
          if(tm.status==='done' && tm.loserId){
            losses[tm.loserId]=(losses[tm.loserId]||0)+1;
          }
        }));
        if(t.dko)t.dko.losses=losses;

        repairDKOInvalidFutureMatches(t);
        assignTournamentTables(t);
      }else if(changed && tournamentHasGroups(t)){
        assignTournamentTables(t);
      }

      if(forceFinalizeTournamentIfResolved(t)){
        changed=true;
      }
    });

    if(changed){
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
    }
    return changed;
  }

  async function refreshTournamentFromCloud(tid){
    toast('Obnovuji turnaj…');
    try{
      await loadSecureMatches();
      await loadSecureTournaments();

      let changed=reconcileTournamentResultsFromMatches(tid);
      const t=(data.tournaments||[]).find(x=>x.id===tid);

      if(t && rebuildSKOStateFromFinishedMatches(t))changed=true;

      if(changed && t){
        try{await saveSecureTournament(t);}catch(e){console.error('Tournament resave:',e);}
      }

      renderHistory();
      renderStats();
      renderPlayers();
      renderTournament();

      toast(changed?'Turnaj obnoven podle odehraných zápasů.':'Turnaj je aktuální.');
    }catch(e){
      console.error(e);
      toast('Turnaj se nepodařilo obnovit: '+String(e.message||e));
    }
  }



  async function cleanupEmptyTournaments(){
    const empty=(data.tournaments||[]).filter(t=>
      !(data.matches||[]).some(m=>m.tournamentLink && m.tournamentLink.tournamentId===t.id)
    );

    if(!empty.length){
      toast('Žádné prázdné turnaje k odstranění.');
      return;
    }

    if(!confirm('Smazat '+empty.length+' turnajů bez uložených zápasů?'))return;

    try{
      for(const t of empty){
        await deleteSecureTournament(t.id);
      }
      await loadSecureTournaments();
      renderTournament();
      toast('Prázdné testovací turnaje byly smazány.');
    }catch(e){
      console.error(e);
      toast('Údržba turnajů selhala: '+String(e.message||e));
    }
  }


  

  async function returnToTournamentDetail(tid){
    if(!tid){
      showScreen('tournament');
      return;
    }

    forcedTournamentReturnId=tid;
    selectedTournamentId=tid;
    updateCurrentTournamentShortcut();

    let t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t){
      try{
        await loadSecureTournaments();
        t=(data.tournaments||[]).find(x=>x.id===tid);
      }catch(e){
        console.error('Return to tournament detail:',e);
      }
    }

    if(t){
      renderTournamentDetail();
      showScreen('tournament-detail');
    }else{
      renderTournament();
      showScreen('tournament');
      toast('Turnaj se nepodařilo znovu načíst.');
    }
  }

  function updateCurrentTournamentShortcut(){
    const btn=$('currentTournamentNavBtn');
    if(!btn)return;
    const t=(data.tournaments||[]).find(x=>x.id===selectedTournamentId);
    btn.classList.toggle('hidden',!t);
    if(t)btn.textContent='Aktuální: '+(t.name||'Turnaj');
  }

window.openTournamentDetail=async function(tid){
    if(preserveTournamentDetailReturn){
      preserveTournamentDetailReturn=false;
    }else{
      tournamentDetailReturnScreen='tournament';
    }
    selectedTournamentId=tid;
    updateCurrentTournamentShortcut();

    let t=(data.tournaments||[]).find(x=>x.id===tid);

    // Cloud načítáme pouze tehdy, když turnaj opravdu není lokálně.
    if(!t){
      try{
        await loadSecureTournaments();
        t=(data.tournaments||[]).find(x=>x.id===tid);
      }catch(e){
        console.error('Open tournament detail:',e);
      }
    }

    if(!t){
      toast('Turnaj se nepodařilo načíst.');
      renderTournament();
      showScreen('tournament');
      return false;
    }

    renderTournamentDetail();
    showScreen('tournament-detail');
    return true;
  };

  function organizerCandidates(excludeUids={}){
    return Object.values(data.players||{})
      .filter(p=>p && p.ownerUid && p.active!==false && p.hiddenFromPlayers!==true && !excludeUids[p.ownerUid])
      .sort((a,b)=>playerSelectionLabel(a).localeCompare(playerSelectionLabel(b),'cs'));
  }

  function organizerNameByUid(uid){
    if(!uid)return '—';
    const p=Object.values(data.players||{}).find(x=>x && x.ownerUid===uid);
    if(p)return playerSelectionLabel(p);
    return 'Uživatel '+String(uid).slice(0,8);
  }

  function tournamentOrganizerHtml(t){
    const managers=Object.keys(t.managerUids||{}).filter(uid=>t.managerUids[uid]===true);
    const excluded={...(t.managerUids||{})};
    if(t.createdByUid)excluded[t.createdByUid]=true;
    const candidates=organizerCandidates(excluded);
    const canEdit=canManageTournamentOrganizers(t);

    return `<div class="subpanel" style="margin-bottom:12px">
      <strong>POŘADATELÉ</strong>
      <div class="muted" style="margin-top:5px">Zakladatel: ${esc(organizerNameByUid(t.createdByUid))}</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px">
        ${managers.length?managers.map(uid=>`<span class="tournament-badge gold">${esc(organizerNameByUid(uid))}${canEdit?` <button onclick="removeTournamentOrganizer('${t.id}','${uid}')" style="border:0;background:transparent;color:inherit;font-weight:950;cursor:pointer">×</button>`:''}</span>`).join(''):'<span class="muted">Bez spolupořadatelů.</span>'}
      </div>
      ${canEdit?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <select id="tournamentOrganizerSelect_${t.id}" style="flex:1;min-width:220px">
          <option value="">— vyber registrovaného hráče —</option>
          ${candidates.map(p=>`<option value="${esc(p.ownerUid)}">${esc(playerSelectionLabel(p))}</option>`).join('')}
        </select>
        <button class="btn" onclick="addTournamentOrganizer('${t.id}')">+ PŘIDAT SPOLUPOŘADATELE</button>
      </div>`:''}
    </div>`;
  }

  window.addTournamentOrganizer=async function(tournamentId){
    const t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(!t||!canManageTournamentOrganizers(t))return;
    const sel=$('tournamentOrganizerSelect_'+t.id);
    const uid=sel?.value||'';
    if(!uid)return;
    t.managerUids=t.managerUids||{};
    t.managerUids[uid]=true;
    try{
      await saveSecureTournament(t);
      renderTournamentDetail();
      renderTournament();
      toast('Spolupořadatel byl přidán.');
    }catch(e){
      delete t.managerUids[uid];
      toast('Spolupořadatele se nepodařilo uložit. Zkontroluj Firebase pravidla.');
    }
  };

  window.removeTournamentOrganizer=async function(tournamentId,uid){
    const t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(!t||!canManageTournamentOrganizers(t))return;
    const backup=!!t.managerUids?.[uid];
    if(t.managerUids)delete t.managerUids[uid];
    try{
      await saveSecureTournament(t);
      renderTournamentDetail();
      renderTournament();
      toast('Spolupořadatel byl odebrán.');
    }catch(e){
      if(backup){t.managerUids=t.managerUids||{};t.managerUids[uid]=true;}
      toast('Změnu pořadatelů se nepodařilo uložit.');
    }
  };

  let tournamentDetailReturnScreen='tournament';
  let preserveTournamentDetailReturn=false;

  
  function tournamentScheduleEntries(t){
    if(!t)return [];
    if(!t.schedule)t.schedule={startAt:'',slotMinutes:45,tableCount:Number(t.tableCount||1),entries:[]};
    if(!Array.isArray(t.schedule.entries))t.schedule.entries=[];
    return t.schedule.entries;
  }

  function tournamentSchedulableMatches(t){
    return allTournamentMatches(t)
      .filter(m=>m && m.id && m.status!=='done' && !m.winnerId && !m.loserId && m.player1Id && m.player2Id)
      .slice()
      .sort((a,b)=>{
        const ar=Number(a.roundNumber||9999), br=Number(b.roundNumber||9999);
        if(ar!==br)return ar-br;
        const ao=Number(a.roundOrder||9999), bo=Number(b.roundOrder||9999);
        if(ao!==bo)return ao-bo;
        return String(a.roundLabel||a.bracket||'').localeCompare(String(b.roundLabel||b.bracket||''),'cs');
      });
  }

  function scheduleLocalValue(date){
    const p=n=>String(n).padStart(2,'0');
    return date.getFullYear()+'-'+p(date.getMonth()+1)+'-'+p(date.getDate())+'T'+p(date.getHours())+':'+p(date.getMinutes());
  }

  function scheduleTimeLabel(value){
    if(!value)return '—';
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return value;
    return d.toLocaleString('cs-CZ',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  }

  function scheduleHasCollision(entries,current){
    return entries.some(e=>
      e.matchId!==current.matchId &&
      e.startAt===current.startAt &&
      (Number(e.tableNumber)===Number(current.tableNumber) ||
       (current.playerIds||[]).some(id=>(e.playerIds||[]).includes(id)))
    );
  }

  function renderTournamentSchedule(t){
    if(!t || t.status==='complete')return '';
    const schedule=t.schedule||{};
    const entries=tournamentScheduleEntries(t).slice().sort((a,b)=>
      String(a.startAt||'').localeCompare(String(b.startAt||'')) ||
      Number(a.tableNumber||0)-Number(b.tableNumber||0)
    );
    const canEdit=canManageTournament(t);

    if(!canEdit && !entries.length)return '';

    const controls=canEdit?`
      <div class="grid three" style="margin-top:10px">
        <div><label>Začátek harmonogramu</label><input id="scheduleStartAt" type="datetime-local" value="${esc(schedule.startAt||'')}"></div>
        <div><label>Počet stolů</label><input id="scheduleTableCount" type="number" min="1" max="32" value="${Number(schedule.tableCount||t.tableCount||1)}"></div>
        <div><label>Délka slotu (min)</label><input id="scheduleSlotMinutes" type="number" min="10" max="240" step="5" value="${Number(schedule.slotMinutes||45)}"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button class="btn primary" onclick="generateTournamentSchedule('${t.id}')">AUTOMATICKY VYTVOŘIT</button>
        ${entries.length?`<button class="btn danger" onclick="clearTournamentSchedule('${t.id}')">SMAZAT HARMONOGRAM</button>`:''}
      </div>
      <div class="muted" style="margin-top:7px">Naplánují se pouze zápasy, u kterých už jsou známí oba hráči. Aplikace nepovolí stejný stůl ani stejného hráče ve stejném čase.</div>
    `:'';

    const rows=entries.length?entries.map(e=>{
      const m=allTournamentMatches(t).find(x=>x.id===e.matchId);
      if(!m)return '';
      const collision=scheduleHasCollision(entries,e);
      return `<tr>
        <td>${canEdit?`<input type="datetime-local" value="${esc(e.startAt||'')}" onchange="updateTournamentScheduleEntry('${t.id}','${e.matchId}','time',this.value)">`:esc(scheduleTimeLabel(e.startAt))}</td>
        <td>${canEdit?`<input type="number" min="1" max="${Number(schedule.tableCount||t.tableCount||32)}" value="${Number(e.tableNumber||1)}" style="width:80px" onchange="updateTournamentScheduleEntry('${t.id}','${e.matchId}','table',this.value)">`:'Stůl '+Number(e.tableNumber||1)}</td>
        <td><strong>${esc(tournamentPlayerName(m.player1Id,t))}</strong> – <strong>${esc(tournamentPlayerName(m.player2Id,t))}</strong><div class="muted">${esc(m.roundLabel||m.bracket||'')}</div></td>
        <td>${collision?'<span class="tournament-badge">KOLIZE</span>':'<span class="muted">OK</span>'}</td>
      </tr>`;
    }).join(''):'<tr><td colspan="4" class="muted">Harmonogram zatím není vytvořen.</td></tr>';

    return `<details class="subpanel" style="margin-bottom:14px;border-color:rgba(212,175,55,.55)">
      <summary style="cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
        <div>
          <strong>ČASOVÝ HARMONOGRAM</strong>
          <span class="muted" style="margin-left:8px">volitelné • kliknutím rozbalit</span>
        </div>
        ${entries.length?`<span class="tournament-badge gold">${entries.length} zápasů</span>`:''}
      </summary>
      <div class="muted" style="margin-top:8px">Orientační plán zápasů a stolů.</div>
      ${controls}
      <div style="overflow:auto;margin-top:12px">
        <table class="stats-table">
          <thead><tr><th>Čas</th><th>Stůl</th><th>Zápas</th><th>Kontrola</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </details>`;
  }

  window.generateTournamentSchedule=async function(tournamentId){
    const t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(!t || !canManageTournament(t))return;

    const startValue=$('scheduleStartAt')?.value||'';
    const tableCount=Math.max(1,Number($('scheduleTableCount')?.value||t.tableCount||1));
    const slotMinutes=Math.max(10,Number($('scheduleSlotMinutes')?.value||45));
    if(!startValue){toast('Nastav začátek harmonogramu.');return;}

    const start=new Date(startValue);
    if(Number.isNaN(start.getTime())){toast('Neplatný čas začátku.');return;}

    const matches=tournamentSchedulableMatches(t);
    if(!matches.length){toast('Není žádný zápas se známými oběma hráči k naplánování.');return;}

    const entries=[];
    let slotIndex=0;

    for(const m of matches){
      let placed=false;
      let guard=0;
      while(!placed && guard<1000){
        const slotStart=new Date(start.getTime()+slotIndex*slotMinutes*60000);
        const startAt=scheduleLocalValue(slotStart);

        for(let table=1;table<=tableCount;table++){
          const candidate={matchId:m.id,startAt,tableNumber:table,playerIds:[m.player1Id,m.player2Id]};
          if(!scheduleHasCollision(entries,candidate)){
            entries.push(candidate);
            placed=true;
            break;
          }
        }
        if(!placed)slotIndex++;
        guard++;
      }

      // Pokud je aktuální časový slot zaplněn všemi stoly, posuň další hledání.
      const currentTime=entries.length?entries[entries.length-1].startAt:'';
      if(entries.filter(e=>e.startAt===currentTime).length>=tableCount)slotIndex++;
    }

    t.schedule={startAt:startValue,tableCount,slotMinutes,entries};
    try{
      const saved=await saveSecureTournament(t);
      const pos=(data.tournaments||[]).findIndex(x=>x.id===saved.id);
      if(pos>=0)data.tournaments[pos]=saved;
      renderTournamentDetail();
      toast('Harmonogram byl vytvořen.');
    }catch(e){
      console.error('Generate schedule:',e);
      toast('Harmonogram se nepodařilo uložit.');
    }
  };

  window.updateTournamentScheduleEntry=async function(tournamentId,matchId,field,value){
    const t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(!t || !canManageTournament(t))return;
    const entries=tournamentScheduleEntries(t);
    const e=entries.find(x=>x.matchId===matchId);
    if(!e)return;

    if(field==='time')e.startAt=value;
    if(field==='table')e.tableNumber=Math.max(1,Number(value||1));

    const collision=scheduleHasCollision(entries,e);
    if(collision){
      toast('Pozor: vznikla kolize hráče nebo stolu.');
    }

    try{
      await saveSecureTournament(t);
      renderTournamentDetail();
    }catch(err){
      console.error('Update schedule:',err);
      toast('Změnu harmonogramu se nepodařilo uložit.');
    }
  };

  window.clearTournamentSchedule=async function(tournamentId){
    const t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(!t || !canManageTournament(t))return;
    if(!confirm('Smazat celý časový harmonogram turnaje?'))return;
    t.schedule={startAt:'',slotMinutes:45,tableCount:Number(t.tableCount||1),entries:[]};
    try{
      await saveSecureTournament(t);
      renderTournamentDetail();
      toast('Harmonogram byl smazán.');
    }catch(e){
      toast('Harmonogram se nepodařilo smazat.');
    }
  };

function renderTournamentDetail(){
    const current=(data.tournaments||[]).find(x=>x.id===selectedTournamentId);
    if(current){
      try{repairHybridWaitingState(current);}catch(e){}
    }
    updateCurrentTournamentShortcut();

    const body=$('tournamentDetailBody');
    const title=$('tournamentDetailTitle');
    if(!body || !title)return;

    const t=(data.tournaments||[]).find(x=>x.id===selectedTournamentId);
    if(t && forcedTournamentReturnId===selectedTournamentId){
      forcedTournamentReturnId=null;
    }

    if(!selectedTournamentId){
      title.textContent='Aktuální turnaj';
      body.innerHTML=`
        <div class="subpanel">
          <div class="muted">Není vybraný žádný turnaj.</div>
          <button class="btn" style="margin-top:10px" onclick="forcedTournamentReturnId=null;showScreen('tournament')">← VŠECHNY TURNAJE</button>
        </div>`;
      return;
    }

    if(!t){
      title.textContent='Načítám turnaj…';
      body.innerHTML=`
        <div class="subpanel">
          <div class="muted">Turnaj zatím není načtený v tomto zařízení.</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <button class="btn primary" onclick="openTournamentDetail('${selectedTournamentId}')">↻ NAČÍST TURNAJ</button>
            <button class="btn" onclick="forcedTournamentReturnId=null;showScreen('tournament')">← VŠECHNY TURNAJE</button>
          </div>
        </div>`;
      return;
    }

    if(t.ko)ensureSKOState(t);
    const repairedOnOpen=rebuildSKOStateFromFinishedMatches(t);
    if(repairedOnOpen){
      try{localStorage.setItem(DB_KEY,JSON.stringify(data));}catch(e){}
      saveSecureTournament(t).catch(e=>console.error('Tournament auto-repair save:',e));
      renderTournament();
      renderResultsTournaments();
    }

    title.textContent=t.name||'Turnaj';
    if($('backToTournamentListBtn')){
      $('backToTournamentListBtn').textContent=tournamentDetailReturnScreen==='results-tournaments'?'← VÝSLEDKY TURNAJŮ':'← VŠECHNY TURNAJE';
    }

    const all=allTournamentMatches(t);
    const done=all.filter(m=>m.status==='done'||m.winnerId||m.loserId).length;
    const playing=all.filter(m=>m.status==='playing').length;

    body.innerHTML=`
      <div class="subpanel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
          <div>
            <div class="muted">
              ${esc(tournamentFormatLabel(t))}
              • ${esc(tournamentDisciplineSummary(t))}
              • Race to ${t.raceTo}
              • ${breakModeLabel(t.breakMode).toLowerCase()}
              • ${t.tableCount||1} ${(t.tableCount||1)===1?'stůl':'stoly'}
            </div>
            <div class="muted" style="margin-top:6px">
              Odehráno ${done}/${all.length}${playing?` • právě hraje ${playing}`:''}
            </div>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;align-items:center">
            ${t.historicalEditMode?'<span class="tournament-badge gold">HISTORICKÁ EDITACE</span>':''}
            <span class="tournament-badge ${t.status==='complete'?'gold':''}">
              ${t.status==='complete'?'DOKONČENO':'AKTIVNÍ'}
            </span>
          </div>
        </div>
      </div>

      <div class="subpanel" style="margin-bottom:12px">
        <strong>ÚČASTNÍCI • ${(t.playerIds||[]).length}</strong>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">
          ${(t.playerIds||[]).map(id=>`
            <span class="tournament-badge ${String(id).startsWith('guest_')?'':'gold'}">
              ${esc(tournamentPlayerName(id,t))}${String(id).startsWith('guest_')?' • HOST':''}
            </span>
          `).join('')}
        </div>
      </div>

      ${tournamentOrganizerHtml(t)}

      ${renderTournamentSchedule(t)}

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
        <button class="btn primary" onclick="shareTournament('${t.id}')">↗ SDÍLET TURNAJ</button>
        ${t.dko?`<button class="btn primary" onclick="openTournamentBracket('${t.id}')">DKO PAVOUK</button>`:''}
        ${t.ko?`<button class="btn primary" onclick="openSKOBracket('${t.id}')">SKO PAVOUK</button>`:''}
        ${canManageTournament(t) && t.status!=='complete'?`<button class="btn" onclick="openActiveTournamentEdit('${t.id}')">UPRAVIT TURNAJ</button>`:''}
        ${tournamentCanSeedFromGroups(t)?`<span class="tournament-badge gold">ČEKÁ NA RUČNÍ NASAZENÍ PLAY-OFF</span>`:''}
        ${t.status==='complete' && tournamentCanHistoricalReseed(t)?`<button class="btn" onclick="openTournamentHistoricalEdit('${t.id}')">UPRAVIT / ZNOVU NASADIT PLAY-OFF</button>`:''}
        ${canManageTournament(t)?`
          ${canManageTournamentOrganizers(t)?`
            <button class="btn danger" onclick="deleteTournament('${t.id}')">SMAZAT TURNAJ</button>
            <button class="btn danger" onclick="deleteTournamentWithMatches('${t.id}')">SMAZAT VČ. ZÁPASŮ</button>
          `:`<span class="muted">Jsi spolupořadatel • můžeš řídit turnaj, ale ne mazat ani měnit pořadatele.</span>`}
        `:`<span class="muted">Tento turnaj je pouze ke sledování.</span>`}
      </div>

      <div>${t.format==='dko'?renderDKOTournament(t):
        t.format==='sko'?renderSKOTournament(t):
        t.format==='swiss'?renderSwissTournament(t):
        ['groups_sko','groups_dko'].includes(t.format)?renderHybridTournament(t):
        renderGroupTournament(t)}</div>
    `;
  }
  if($('tournamentDetailRefreshBtn')){
    $('tournamentDetailRefreshBtn').onclick=async()=>{
      if(!selectedTournamentId){
        showScreen('tournament');
        return;
      }
      await refreshTournamentById(selectedTournamentId,$('tournamentDetailRefreshBtn'));
    };
  }


  let selectedSeriesId=null;

  function isSeriesOwner(s){
    return !!(s && cloudUid && s.createdByUid && s.createdByUid===cloudUid);
  }

  function canManageSeriesOrganizers(s){
    if(!s)return false;
    if(currentUserIsSystemAdmin())return true;
    return isSeriesOwner(s);
  }

  function canManageSeries(s){
    if(!s)return false;
    if(currentUserIsSystemAdmin())return true;
    if(isSeriesOwner(s))return true;
    return !!(cloudUid && s.managerUids && s.managerUids[cloudUid]===true);
  }

  function renderTournamentSeriesSelect(){
    const el=$('tournamentSeriesSelect');
    if(!el)return;
    const old=el.value;
    const list=(data.tournamentSeries||[]).slice().sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'cs'));
    el.innerHTML='<option value="">— bez série —</option>'+list.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}${s.season?' • '+esc(s.season):''}</option>`).join('');
    if(list.some(s=>s.id===old))el.value=old;
  }

  function parseCustomSeriesPoints(value){
    const exact={};
    const ranges=[];
    String(value||'')
      .split(/[,\n;]+/)
      .map(x=>x.trim())
      .filter(Boolean)
      .forEach(part=>{
        const m=part.match(/^(\d+)\s*(?:[-–—]\s*(\d+))?\s*[:=]\s*(-?\d+(?:[.,]\d+)?)$/);
        if(!m)return;
        const from=Math.max(1,Number(m[1]));
        const to=m[2]?Math.max(from,Number(m[2])):from;
        const points=Number(String(m[3]).replace(',','.'));
        if(!Number.isFinite(points))return;
        if(from===to)exact[from]=points;
        else ranges.push({from,to,points});
      });
    ranges.sort((a,b)=>(a.to-a.from)-(b.to-b.from)||a.from-b.from);
    return {exact,ranges};
  }

  function seriesCustomPointsText(s){
    if(s?.customPointsText)return String(s.customPointsText);
    const custom=s?.customPoints||{};
    const exact=custom.exact||{};
    const ranges=custom.ranges||[];
    return [
      ...Object.keys(exact).map(Number).sort((a,b)=>a-b).map(p=>p+'='+exact[p]),
      ...ranges.slice().sort((a,b)=>a.from-b.from).map(r=>r.from+'-'+r.to+'='+r.points)
    ].join(', ');
  }

  function placementRangeFromRecord(record){
    const label=String(record?.label||'');
    const m=label.match(/(\d+)\s*\.\s*[–—-]\s*(\d+)\s*\./);
    if(m)return {from:Number(m[1]),to:Number(m[2])};
    const value=Number(record?.value);
    if(Number.isInteger(value) && value>=1)return {from:value,to:value};
    return null;
  }

  function customSeriesPointsForPlacement(s,record,t=null){
    const custom=s?.customPoints || parseCustomSeriesPoints(s?.customPointsText||'');
    const exact=custom.exact||{};
    const ranges=custom.ranges||[];

    // Vlastní bodovací tabulka se řídí INDIVIDUÁLNÍM pořadím hráče.
    // Např. value=5 => pravidlo "5=6", value=6 => "6=5" atd.
    // To platí i tehdy, když turnaj vizuálně zobrazuje pásmo "5.–8. místo".
    const exactPlace=Number(record?.value);
    if(Number.isInteger(exactPlace) && exactPlace>=1){
      if(Object.prototype.hasOwnProperty.call(exact,exactPlace)){
        return Number(exact[exactPlace]||0);
      }

      // Pokud není konkrétní místo zadané jednotlivě, může ho pokrýt rozsah.
      const coveringRange=ranges.find(r=>
        exactPlace>=Number(r.from) && exactPlace<=Number(r.to)
      );
      if(coveringRange)return Number(coveringRange.points||0);

      return 0;
    }

    // Fallback pouze pro starší data, kde přesné individuální pořadí nebylo uloženo.
    const placement=placementRangeFromRecord(record);
    if(!placement)return 0;

    if(placement.from===placement.to && Object.prototype.hasOwnProperty.call(exact,placement.from)){
      return Number(exact[placement.from]||0);
    }

    const exactRange=ranges.find(r=>
      Number(r.from)===placement.from && Number(r.to)===placement.to
    );
    if(exactRange)return Number(exactRange.points||0);

    return 0;
  }

  function seriesPointsForPlacement(s,record,t=null){
    const canonicalPlace=Number(record?.seriesTieBreak?.canonicalPlace);
    if(Number.isFinite(canonicalPlace) && canonicalPlace>0 && canonicalPlace!==Number(record.value)){
      record={...record,value:canonicalPlace};
    }

    if((s.scoringMode||'bands')==='custom'){
      return customSeriesPointsForPlacement(s,record,t);
    }
    const p=Number(record.value||999);
    const top=s.pointsTop||[100,80,65,55];
    const bands=s.pointsBands||[45,25,10,5];
    if(p<=1)return Number(top[0]||0);
    if(p<=2)return Number(top[1]||0);
    if(p<=3)return Number(top[2]||0);
    if(p<=4)return Number(top[3]||0);
    if(p<=8)return Number(bands[0]||0);
    if(p<=16)return Number(bands[1]||0);
    if(p<=32)return Number(bands[2]||0);
    if(p<=64)return Number(bands[3]||0);
    return 0;
  }

  function seriesTournamentPlayerScore(t,playerId){
    let rf=0,ra=0;
    allTournamentMatches(t)
      .filter(m=>m && (m.status==='done'||m.winnerId||m.loserId) && m.player1Id && m.player2Id && (m.player1Id===playerId||m.player2Id===playerId))
      .forEach(m=>{
        const s1=Number(m.score1||0),s2=Number(m.score2||0);
        if(m.player1Id===playerId){rf+=s1;ra+=s2;}
        else{rf+=s2;ra+=s1;}
      });
    return {rf,ra,diff:rf-ra};
  }

  function seriesTournamentGroupPlace(t,playerId){
    for(const g of (t.groups||[])){
      if(!(g.players||[]).includes(playerId))continue;
      const st=groupStandings(g,t);
      const idx=st.findIndex(r=>r.id===playerId);
      return idx>=0?idx+1:999;
    }
    return 999;
  }

  function seriesHeadToHeadRanks(t,playerIds){
    const ids=[...(playerIds||[])];
    const idSet=new Set(ids);
    const rows=Object.fromEntries(ids.map(id=>[id,{id,wins:0,losses:0,played:0}]));
    allTournamentMatches(t)
      .filter(m=>m && (m.status==='done'||m.winnerId||m.loserId) && idSet.has(m.player1Id) && idSet.has(m.player2Id))
      .forEach(m=>{
        const winnerId=m.winnerId || (Number(m.score1)>Number(m.score2)?m.player1Id:(Number(m.score2)>Number(m.score1)?m.player2Id:null));
        if(!winnerId)return;
        const loserId=winnerId===m.player1Id?m.player2Id:m.player1Id;
        if(rows[winnerId]){rows[winnerId].wins++;rows[winnerId].played++;}
        if(rows[loserId]){rows[loserId].losses++;rows[loserId].played++;}
      });
    return rows;
  }

  function seriesPlacementTieBreakMode(s){
    if(s?.placementTieBreak)return s.placementTieBreak;
    const normalized=String(s?.name||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase();
    return normalized.includes('loun') ? 'score_h2h_group' : 'legacy';
  }

  function seriesPlacementStageInfo(t,record){
    const p=Number(record?.value||0);
    if(!p)return null;

    const groupEliminated=!!(t?.groupEliminations||[]).some(e=>e.playerId===record?.playerId);
    if(groupEliminated){
      const places=(t.groupEliminations||[])
        .map(e=>Number(e.place||0))
        .filter(n=>n>0)
        .sort((a,b)=>a-b);
      return {
        key:'stage:group-eliminated',
        from:places[0]||p,
        to:places[places.length-1]||p,
        label:'nepostup ze skupiny'
      };
    }

    // 1. a 2. místo jsou vždy jednoznačné.
    if(p<=2)return null;

    // Pokud se hraje samostatný zápas o 3. místo, 3./4. jsou také jednoznačné.
    const hasBronze=!!(t?.ko?.thirdPlacePlayoff || t?.dko?.thirdPlacePlayoff);
    if(hasBronze && p<=4)return null;

    let from,to;
    if(p<=4){
      // Bez bronze match jsou oba semifinalisté stejná výsledková fáze.
      from=3;to=4;
    }else{
      const range=t?.dko ? dkoPlacementRange(p) : eliminationBand(p);
      from=Number(range.from);to=Number(range.to);
    }

    return {
      key:'stage:'+from+'-'+to,
      from,to,
      label:from===to ? from+'. místo' : from+'.–'+to+'. místo'
    };
  }

  function seriesGroupPhaseScore(t,playerId){
    for(const g of (t?.groups||[])){
      if(!(g.players||[]).includes(playerId))continue;
      const row=rawGroupRows(g).find(r=>r.id===playerId);
      if(!row)break;
      return {
        for:Number(row.rf||0),
        against:Number(row.ra||0),
        diff:Number(row.diff||0),
        wins:Number(row.v||0),
        losses:Number(row.p||0),
        found:true,
        source:'group'
      };
    }
    return {for:0,against:0,diff:0,wins:0,losses:0,found:false,source:'group'};
  }

  function seriesTournamentGroupStats(t,playerId){
    for(const g of (t?.groups||[])){
      if(!(g.players||[]).includes(playerId))continue;
      const raw=rawGroupRows(g).find(r=>r.id===playerId)||{v:0,p:0,rf:0,ra:0,diff:0};
      const standings=groupStandings(g,t);
      const idx=standings.findIndex(r=>r.id===playerId);
      return {
        groupId:String(g.id||''),
        place:idx>=0?idx+1:999,
        wins:Number(raw.v||0),
        losses:Number(raw.p||0),
        rf:Number(raw.rf||0),
        ra:Number(raw.ra||0),
        diff:Number(raw.diff||0)
      };
    }
    return {groupId:'',place:999,wins:0,losses:0,rf:0,ra:0,diff:0};
  }

  function seriesPlayoffScore(t,playerId){
    let rf=0,ra=0,played=0;
    allTournamentMatches(t)
      .filter(m=>
        m &&
        !tournamentMatchIsGroupMatch(t,m) &&
        (m.status==='done'||m.winnerId||m.loserId) &&
        m.player1Id && m.player2Id &&
        (m.player1Id===playerId||m.player2Id===playerId)
      )
      .forEach(m=>{
        const s1=Number(m.score1||0),s2=Number(m.score2||0);
        if(m.player1Id===playerId){rf+=s1;ra+=s2;}
        else{rf+=s2;ra+=s1;}
        played++;
      });
    return {for:rf,against:ra,diff:rf-ra,played,found:played>0,source:'playoff'};
  }

  function seriesGroupHeadToHeadRanks(t,playerIds){
    const ids=[...(playerIds||[])];
    const idSet=new Set(ids);
    const rows=Object.fromEntries(ids.map(id=>[id,{id,wins:0,losses:0,played:0}]));

    for(const g of (t?.groups||[])){
      const inGroup=ids.filter(id=>(g.players||[]).includes(id));
      if(inGroup.length<2)continue;
      const inGroupSet=new Set(inGroup);
      (g.matches||[])
        .filter(m=>
          m &&
          (m.status==='done'||m.winnerId||m.loserId) &&
          inGroupSet.has(m.player1Id) &&
          inGroupSet.has(m.player2Id)
        )
        .forEach(m=>{
          const winnerId=m.winnerId || (
            Number(m.score1)>Number(m.score2)?m.player1Id:
            (Number(m.score2)>Number(m.score1)?m.player2Id:null)
          );
          if(!winnerId)return;
          const loserId=winnerId===m.player1Id?m.player2Id:m.player1Id;
          if(rows[winnerId]){rows[winnerId].wins++;rows[winnerId].played++;}
          if(rows[loserId]){rows[loserId].losses++;rows[loserId].played++;}
        });
    }
    return rows;
  }

  function seriesRefineTournamentPlacements(s,t,records){
    if(seriesPlacementTieBreakMode(s)!=='score_h2h_group')return records;

    const out=(records||[]).map(r=>({...r}));
    const cohorts=new Map();

    out.forEach(r=>{
      const stage=seriesPlacementStageInfo(t,r);
      if(!stage)return;
      if(!cohorts.has(stage.key))cohorts.set(stage.key,[]);
      cohorts.get(stage.key).push(r);
    });

    cohorts.forEach(cohort=>{
      if(cohort.length<=1)return;

      const availablePlaces=cohort.map(r=>Number(r.value||999)).sort((a,b)=>a-b);
      const groupEliminatedIds=new Set((t.groupEliminations||[]).map(e=>e.playerId));
      const groupStats=Object.fromEntries(cohort.map(r=>[r.playerId,seriesTournamentGroupStats(t,r.playerId)]));
      const playoffScores=Object.fromEntries(cohort.map(r=>[r.playerId,seriesPlayoffScore(t,r.playerId)]));
      const ordered=[];
      const finalRankKeyByPlayer={};

      if(cohort.every(r=>groupEliminatedIds.has(r.playerId))){
        // Nepostupující: umístění ve skupině -> body/výhry -> vzájemný zápas.
        const byBase=new Map();
        cohort.forEach(r=>{
          const gs=groupStats[r.playerId]||{};
          const key='group|place:'+Number(gs.place||999)+'|wins:'+Number(gs.wins||0);
          if(!byBase.has(key))byBase.set(key,[]);
          byBase.get(key).push(r);
        });

        [...byBase.keys()]
          .sort((ka,kb)=>{
            const a=byBase.get(ka)?.[0],b=byBase.get(kb)?.[0];
            const ga=groupStats[a?.playerId]||{},gb=groupStats[b?.playerId]||{};
            return Number(ga.place||999)-Number(gb.place||999) ||
                   Number(gb.wins||0)-Number(ga.wins||0);
          })
          .forEach(baseKey=>{
            const tied=byBase.get(baseKey);
            const h2h=seriesGroupHeadToHeadRanks(t,tied.map(r=>r.playerId));
            const byH2H=new Map();
            tied.forEach(r=>{
              const wins=Number(h2h[r.playerId]?.wins||0);
              if(!byH2H.has(wins))byH2H.set(wins,[]);
              byH2H.get(wins).push(r);
            });
            [...byH2H.keys()].sort((a,b)=>b-a).forEach(wins=>{
              const rows=byH2H.get(wins);
              rows.sort((a,b)=>String(tournamentPlayerName(a.playerId,t)||'').localeCompare(String(tournamentPlayerName(b.playerId,t)||''),'cs'));
              rows.forEach(r=>{
                finalRankKeyByPlayer[r.playerId]=baseKey+'|h2h:'+Number(wins);
              });
              ordered.push(...rows);
            });
          });
      }else{
        // Play-off: dosažená fáze je daná cohortou.
        // Dále rozhoduje CELKOVÝ rozdíl racků ze všech play-off zápasů,
        // potom body/výhry ve skupině a pak vzájemný zápas pouze ze skupiny.
        const byScore=new Map();
        cohort.forEach(r=>{
          const sc=playoffScores[r.playerId]||{};
          const diff=Number(sc.diff||0);
          if(!byScore.has(diff))byScore.set(diff,[]);
          byScore.get(diff).push(r);
        });

        [...byScore.keys()].sort((a,b)=>b-a).forEach(diff=>{
          const scoreRows=byScore.get(diff);
          const byGroupWins=new Map();
          scoreRows.forEach(r=>{
            const wins=Number(groupStats[r.playerId]?.wins||0);
            if(!byGroupWins.has(wins))byGroupWins.set(wins,[]);
            byGroupWins.get(wins).push(r);
          });

          [...byGroupWins.keys()].sort((a,b)=>b-a).forEach(groupWins=>{
            const tied=byGroupWins.get(groupWins);
            const h2h=seriesGroupHeadToHeadRanks(t,tied.map(r=>r.playerId));
            const byH2H=new Map();
            tied.forEach(r=>{
              const wins=Number(h2h[r.playerId]?.wins||0);
              if(!byH2H.has(wins))byH2H.set(wins,[]);
              byH2H.get(wins).push(r);
            });

            [...byH2H.keys()].sort((a,b)=>b-a).forEach(h2hWins=>{
              const rows=byH2H.get(h2hWins);
              rows.sort((a,b)=>String(tournamentPlayerName(a.playerId,t)||'').localeCompare(String(tournamentPlayerName(b.playerId,t)||''),'cs'));
              rows.forEach(r=>{
                finalRankKeyByPlayer[r.playerId]=
                  'playoff|diff:'+Number(diff)+
                  '|groupWins:'+Number(groupWins)+
                  '|h2h:'+Number(h2hWins);
              });
              ordered.push(...rows);
            });
          });
        });
      }

      const rankKeyCounts={};
      const rankKeyFirstIndex={};
      ordered.forEach((r,i)=>{
        const key=finalRankKeyByPlayer[r.playerId]||('fallback:'+r.playerId);
        rankKeyCounts[key]=Number(rankKeyCounts[key]||0)+1;
        if(rankKeyFirstIndex[key]===undefined)rankKeyFirstIndex[key]=i;
      });

      const canonicalPlaceByRankKey={};
      Object.keys(rankKeyFirstIndex).forEach(key=>{
        const firstIndex=Number(rankKeyFirstIndex[key]||0);
        canonicalPlaceByRankKey[key]=availablePlaces[firstIndex]??null;
      });

      ordered.forEach((r,i)=>{
        const rankKey=finalRankKeyByPlayer[r.playerId]||('fallback:'+r.playerId);
        const shared=Number(rankKeyCounts[rankKey]||0)>1;
        const canonical=canonicalPlaceByRankKey[rankKey];
        const gs=groupStats[r.playerId]||{};
        const ps=playoffScores[r.playerId]||{};

        r.value=canonical!=null ? canonical : (availablePlaces[i]??r.value);
        r.sharedPlace=shared;
        r.label=Number(r.value)+'. místo'+(shared?' (dělené)':'');
        const stage=seriesPlacementStageInfo(t,r);
        r.seriesTieBreak={
          stage:stage?.label||'',
          sharedPlace:shared,
          rankKey,
          canonicalPlace:Number(r.value),
          scoreSource:groupEliminatedIds.has(r.playerId)?'group-placement':'playoff-total',
          scoreDiff:Number(ps.diff||0),
          scoreFor:Number(ps.for||0),
          scoreAgainst:Number(ps.against||0),
          groupPlace:Number(gs.place||999),
          groupWins:Number(gs.wins||0),
          groupDiff:Number(gs.diff||0)
        };
      });
    });

    return out;
  }

  function seriesTournamentPlacementRecords(s,t){
    const rows=seriesRefineTournamentPlacements(s,t,baseTournamentPlacementRecords(t));

    // Poslední pojistka pro historicky opravované turnaje:
    // hráči se stejným finálním rankKey musí mít vždy stejné value.
    const byRankKey=new Map();
    rows.forEach(r=>{
      const key=r?.seriesTieBreak?.rankKey;
      if(!key)return;
      if(!byRankKey.has(key))byRankKey.set(key,[]);
      byRankKey.get(key).push(r);
    });
    byRankKey.forEach(group=>{
      if(group.length<2)return;
      const sharedPlace=Math.min(...group.map(r=>Number(r.value||999)));
      group.forEach(r=>{
        r.value=sharedPlace;
        r.sharedPlace=true;
        r.label=sharedPlace+'. místo (dělené)';
        r.seriesTieBreak={...(r.seriesTieBreak||{}),sharedPlace:true,canonicalPlace:sharedPlace};
      });
    });

    return rows;
  }

  function normalizeSeriesHistoricalName(value){
    return String(value||'')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'')
      .toLowerCase()
      .replace(/\s+/g,' ')
      .trim();
  }

  function seriesHistoricalPlayerMatch(name){
    const target=normalizeSeriesHistoricalName(name);
    if(!target)return null;
    return Object.values(data.players||{}).find(p=>{
      const names=[];
      try{names.push(playerDisplayName(p));}catch(e){}
      names.push(p?.name||'',p?.nickname||'');
      return names.some(x=>normalizeSeriesHistoricalName(x)===target);
    })||null;
  }

  function seriesStandings(s){
    const byPlayer=new Map();
    const tournaments=(s.tournamentIds||[])
      .map(id=>(data.tournaments||[]).find(t=>t.id===id))
      .filter(t=>t&&t.status==='complete');

    tournaments.forEach(t=>{
      seriesTournamentPlacementRecords(s,t).forEach(r=>{
        if(!r.playerId)return;

        const registered=!!data.players?.[r.playerId];
        const displayName=tournamentPlayerName(r.playerId,t);
        const club=registered ? (data.players[r.playerId]?.club||'') : '';
        const guest=String(r.playerId).startsWith('guest_') || !registered;

        // Registrovaný hráč se slučuje podle playerId.
        // Hosté / neregistrovaní se slučují alespoň podle normalizovaného jména,
        // aby stejný člověk nebyl v sérii pokaždé jako nový řádek.
        const key=registered
          ? 'player:'+r.playerId
          : 'guest:'+String(displayName||r.playerId)
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g,'')
              .toLowerCase()
              .trim();

        if(!byPlayer.has(key)){
          byPlayer.set(key,{
            key,
            playerId:r.playerId,
            displayName:displayName||r.playerId,
            club,
            guest,
            results:[],
            wins:0,
            seconds:0,
            thirds:0
          });
        }

        const row=byPlayer.get(key);

        // Když se později stejný člověk objeví jako registrovaný hráč,
        // upřednostníme jeho aktuální zobrazované jméno/klub.
        if(registered){
          row.playerId=r.playerId;
          row.displayName=playerSelectionLabel(data.players[r.playerId]);
          row.club=data.players[r.playerId]?.club||row.club||'';
          row.guest=false;
        }

        const pts=seriesPointsForPlacement(s,r,t);
        row.results.push({
          tournamentId:t.id,
          tournamentName:t.name,
          label:r.label,
          value:r.value,
          points:pts,
          seriesTieBreak:r.seriesTieBreak||null
        });

        if(r.value===1)row.wins++;
        if(r.value===2)row.seconds++;
        if(r.value===3)row.thirds++;
      });
    });

    const historical=Array.isArray(s.historicalTournaments)?s.historicalTournaments:[];
    historical.forEach(ht=>{
      (Array.isArray(ht.results)?ht.results:[]).forEach(r=>{
        const place=Math.max(1,Math.floor(Number(r.place||r.value||999)));
        if(!Number.isFinite(place)||place>=999)return;

        const registered=!!(r.playerId && data.players?.[r.playerId]);
        const displayName=registered
          ? playerSelectionLabel(data.players[r.playerId])
          : String(r.displayName||r.name||r.playerId||'Host');
        const playerId=registered ? r.playerId : String(r.playerId||('histguest_'+normalizeSeriesHistoricalName(displayName)));
        const key=registered
          ? 'player:'+playerId
          : 'guest:'+normalizeSeriesHistoricalName(displayName);

        if(!byPlayer.has(key)){
          byPlayer.set(key,{
            key,
            playerId,
            displayName,
            club:registered?(data.players[playerId]?.club||''):'',
            guest:!registered,
            results:[],
            wins:0,
            seconds:0,
            thirds:0
          });
        }

        const row=byPlayer.get(key);
        if(registered){
          row.playerId=playerId;
          row.displayName=playerSelectionLabel(data.players[playerId]);
          row.club=data.players[playerId]?.club||row.club||'';
          row.guest=false;
        }

        const shared=(ht.results||[]).filter(x=>Number(x.place||x.value)===place).length>1;
        const placementRecord={
          playerId,
          value:place,
          label:place+'. místo'+(shared?' (dělené)':''),
          sharedPlace:shared
        };
        const pts=seriesPointsForPlacement(s,placementRecord,null);
        row.results.push({
          tournamentId:ht.id,
          tournamentName:ht.name||'Historický turnaj',
          label:placementRecord.label,
          value:place,
          points:pts,
          historical:true,
          seriesTieBreak:shared?{sharedPlace:true,canonicalPlace:place}:null
        });

        if(place===1)row.wins++;
        if(place===2)row.seconds++;
        if(place===3)row.thirds++;
      });
    });

    const bestCount=Math.max(0,Number(s.bestCount||0));
    const rows=[...byPlayer.values()].map(r=>{
      const sorted=[...r.results].sort((a,b)=>b.points-a.points||a.value-b.value);
      const counted=bestCount>0?sorted.slice(0,bestCount):sorted;
      r.points=counted.reduce((sum,x)=>sum+x.points,0);
      r.counted=counted.length;
      r.tournaments=r.results.length;
      return r;
    });

    rows.sort((a,b)=>
      b.points-a.points ||
      b.wins-a.wins ||
      b.seconds-a.seconds ||
      b.thirds-a.thirds ||
      String(a.displayName||'').localeCompare(String(b.displayName||''),'cs')
    );

    return rows;
  }

  function renderSeriesList(){
    const wrap=$('tournamentSeriesList');
    if(!wrap)return;
    const list=(data.tournamentSeries||[]).slice().sort((a,b)=>String(b.season||'').localeCompare(String(a.season||''))||String(a.name||'').localeCompare(String(b.name||''),'cs'));
    if(!list.length){
      wrap.innerHTML='<div class="muted">Zatím není vytvořená žádná série.</div>';
      return;
    }
    wrap.innerHTML=list.map(s=>{
      const included=(s.tournamentIds||[]).map(id=>(data.tournaments||[]).find(t=>t.id===id)).filter(Boolean);
      const historical=Array.isArray(s.historicalTournaments)?s.historicalTournaments:[];
      const completed=included.filter(t=>t.status==='complete').length+historical.length;
      const total=included.length+historical.length;
      const players=seriesStandings(s).length;
      return `<div class="subpanel" style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <div><strong style="font-size:18px">${esc(s.name)}</strong>
            <div class="muted">${esc(s.club||'')}${s.season?' • '+esc(s.season):''} • ${completed}/${total} turnajů • ${players} hráčů</div>
          </div>
          <button class="btn primary" onclick="openTournamentSeries('${s.id}')">OTEVŘÍT SÉRII</button>
        </div>
      </div>`;
    }).join('');
  }

  function parsePointList(value,defaults){
    const nums=String(value||'').split(',').map(x=>Number(x.trim())).filter(Number.isFinite);
    return defaults.map((d,i)=>Number.isFinite(nums[i])?nums[i]:d);
  }

  window.openTournamentSeries=function(seriesId){
    selectedSeriesId=seriesId;
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s)return;
    $('seriesModalTitle').textContent=s.name+(s.season?' • '+s.season:'');
    renderSeriesModal();
    $('seriesModal').classList.add('show');
  };

  function seriesOrganizerHtml(s){
    const managers=Object.keys(s.managerUids||{}).filter(uid=>s.managerUids[uid]===true);
    const excluded={...(s.managerUids||{})};
    if(s.createdByUid)excluded[s.createdByUid]=true;
    const candidates=organizerCandidates(excluded);
    const canEdit=canManageSeriesOrganizers(s);

    return `<div class="subpanel" style="margin-top:10px">
      <strong>POŘADATELÉ SÉRIE</strong>
      <div class="muted" style="margin-top:5px">Zakladatel: ${esc(organizerNameByUid(s.createdByUid))}</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:9px">
        ${managers.length?managers.map(uid=>`<span class="tournament-badge gold">${esc(organizerNameByUid(uid))}${canEdit?` <button onclick="removeSeriesOrganizer('${s.id}','${uid}')" style="border:0;background:transparent;color:inherit;font-weight:950;cursor:pointer">×</button>`:''}</span>`).join(''):'<span class="muted">Bez spolupořadatelů.</span>'}
      </div>
      ${canEdit?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <select id="seriesOrganizerSelect_${s.id}" style="flex:1;min-width:220px">
          <option value="">— vyber registrovaného hráče —</option>
          ${candidates.map(p=>`<option value="${esc(p.ownerUid)}">${esc(playerSelectionLabel(p))}</option>`).join('')}
        </select>
        <button class="btn" onclick="addSeriesOrganizer('${s.id}')">+ PŘIDAT SPOLUPOŘADATELE</button>
      </div>`:''}
    </div>`;
  }

  window.addSeriesOrganizer=function(seriesId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeriesOrganizers(s))return;
    const uid=$('seriesOrganizerSelect_'+s.id)?.value||'';
    if(!uid)return;
    s.managerUids=s.managerUids||{};
    s.managerUids[uid]=true;
    s.updatedAt=new Date().toISOString();
    saveData();renderSeriesList();renderSeriesModal();
    toast('Spolupořadatel série byl přidán.');
  };

  window.removeSeriesOrganizer=function(seriesId,uid){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeriesOrganizers(s))return;
    if(s.managerUids)delete s.managerUids[uid];
    s.updatedAt=new Date().toISOString();
    saveData();renderSeriesList();renderSeriesModal();
    toast('Spolupořadatel série byl odebrán.');
  };

  function renderSeriesModal(){
    const s=(data.tournamentSeries||[]).find(x=>x.id===selectedSeriesId);
    const body=$('seriesModalBody');
    if(!s||!body)return;

    const included=(s.tournamentIds||[]).map(id=>(data.tournaments||[]).find(t=>t.id===id)).filter(Boolean);
    const available=(data.tournaments||[]).filter(t=>t.status==='complete'&&!(s.tournamentIds||[]).includes(t.id));
    const historical=Array.isArray(s.historicalTournaments)?s.historicalTournaments:[];
    const standings=seriesStandings(s);

    body.innerHTML=`
      <div class="subpanel">
        <div><strong>${esc(s.club||'Klub')}</strong>${s.season?' • '+esc(s.season):''}</div>
        <div class="muted" style="margin-top:5px">Bodování: ${(s.scoringMode||'bands')==='custom'
          ? 'vlastní • '+esc(seriesCustomPointsText(s)||'bez pravidel')
          : `1. ${s.pointsTop?.[0]??100} • 2. ${s.pointsTop?.[1]??80} • 3. ${s.pointsTop?.[2]??65} • 4. ${s.pointsTop?.[3]??55} • 5.–8. ${s.pointsBands?.[0]??45} • 9.–16. ${s.pointsBands?.[1]??25} • 17.–32. ${s.pointsBands?.[2]??10} • 33.–64. ${s.pointsBands?.[3]??5}`}
          ${s.bestCount?` • počítá se nejlepších ${s.bestCount}`:' • počítají se všechny'}</div>
      </div>

      ${canManageSeries(s)?`
      <div class="subpanel" style="margin-top:10px">
        <strong>BODOVÁNÍ SÉRIE</strong>
        <div class="grid two" style="margin-top:9px">
          <div>
            <label>Způsob bodování</label>
            <select id="seriesEditScoringMode_${s.id}" onchange="toggleSeriesEditScoring('${s.id}')">
              <option value="bands" ${(s.scoringMode||'bands')==='bands'?'selected':''}>Po pásmech</option>
              <option value="custom" ${(s.scoringMode||'bands')==='custom'?'selected':''}>Vlastní body za umístění</option>
            </select>
          </div>
          <div>
            <label>Počítat nejlepších X turnajů</label>
            <input id="seriesEditBestCount_${s.id}" type="number" min="0" value="${Number(s.bestCount||0)}">
          </div>
        </div>
        <div style="margin-top:9px">
          <label>Pořadí při stejné výsledkové fázi</label>
          <select id="seriesEditPlacementTieBreak_${s.id}">
            <option value="legacy" ${seriesPlacementTieBreakMode(s)==='legacy'?'selected':''}>Standardní pořadí turnaje</option>
            <option value="score_h2h_group" ${seriesPlacementTieBreakMode(s)==='score_h2h_group'?'selected':''}>Skóre → vzájemný zápas → umístění ve skupině</option>
          </select>
          <div class="muted" style="margin-top:5px">Skóre = výsledek zápasu, ve kterém hráč v dané fázi vypadl (např. 1:2 je lepší než 0:2). U nepostupujících ze skupin se jako skóre bere rozdíl racků ve skupině. Pokud jsou hráči shodní i po všech kritériích, mají dělené místo (např. 5., 5., 7.) a oba vždy dostanou stejné body za dělené místo. Přepočet používá aktuální odehrané play-off zápasy, takže se promítne i dodatečná oprava historického turnaje. Pokud nerozhodne skóre, použije se vzájemný zápas a potom umístění ve skupině.</div>
        </div>
        <div id="seriesEditBands_${s.id}" class="${(s.scoringMode||'bands')==='custom'?'hidden':''} grid two" style="margin-top:9px">
          <div><label>1. / 2. / 3. / 4.</label><input id="seriesEditTop_${s.id}" value="${esc((s.pointsTop||[100,80,65,55]).join(','))}"></div>
          <div><label>5–8 / 9–16 / 17–32 / 33–64</label><input id="seriesEditBandsPts_${s.id}" value="${esc((s.pointsBands||[45,25,10,5]).join(','))}"></div>
        </div>
        <div id="seriesEditCustom_${s.id}" class="${(s.scoringMode||'bands')==='custom'?'':'hidden'}" style="margin-top:9px">
          <label>Vlastní bodovací tabulka</label>
          <textarea id="seriesEditCustomPts_${s.id}" rows="4">${esc(seriesCustomPointsText(s))}</textarea>
          <div class="muted" style="margin-top:5px">
            Např. 1=100, 2=85, 3=70, 4=60, 5-8=45.
            Pokud má turnaj vizuálně pásmo (např. 5.–8.), série stále použije skutečné individuální pořadí hráče:
            5. místo dostane body za 5., 6. místo za 6. atd.
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px">
          <button class="btn primary" onclick="saveSeriesScoring('${s.id}')">ULOŽIT BODOVÁNÍ</button>
        </div>
      </div>`:''}

      ${seriesOrganizerHtml(s)}

      <h3>CELKOVÉ POŘADÍ</h3>
      ${standings.length?`<div style="overflow:auto"><table class="stats-table">
        <thead><tr><th>#</th><th>Hráč</th><th>Turnaje</th><th>1.</th><th>2.</th><th>3.</th><th>Body</th></tr></thead>
        <tbody>${standings.map((r,i)=>`<tr>
          <td class="standings-pos">${i+1}</td>
          <td>
            <strong>${esc(r.displayName||r.playerId)}</strong>
            ${r.guest?'<span class="tournament-badge" style="margin-left:6px">HOST</span>':''}
          </td>
          <td class="num">${r.tournaments}</td><td class="num">${r.wins}</td><td class="num">${r.seconds}</td><td class="num">${r.thirds}</td>
          <td class="num"><strong style="color:var(--gold2)">${r.points}</strong></td>
        </tr>`).join('')}</tbody>
      </table></div>`:'<div class="muted">Série zatím nemá dokončené výsledky.</div>'}

      <h3 style="margin-top:18px">TURNAJE V SÉRII</h3>
      ${included.length?included.map(t=>`<div class="subpanel" style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
          <div><strong>${esc(t.name)}</strong><div class="muted">${esc(tournamentFormatLabel(t))} • ${esc(tournamentDisciplineSummary(t))}</div></div>
          <div style="display:flex;gap:6px">
            <button class="btn" onclick="openTournamentDetail('${t.id}');$('seriesModal').classList.remove('show')">VÝSLEDKY</button>
            ${canManageSeries(s)?`<button class="btn danger" onclick="removeTournamentFromSeries('${s.id}','${t.id}')">ODEBRAT</button>`:''}
          </div>
        </div>
      </div>`).join(''):'<div class="muted">Zatím žádný běžný turnaj.</div>'}

      ${historical.length?`<h3 style="margin-top:18px">HISTORICKY ZADANÉ TURNAJE</h3>
        ${historical.slice().sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))).map(ht=>`<div class="subpanel" style="margin-top:8px">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap">
            <div>
              <strong>${esc(ht.name||'Historický turnaj')}</strong>
              <div class="muted">${ht.date?esc(new Date(ht.date+'T12:00:00').toLocaleDateString('cs-CZ'))+' • ':''}${(ht.results||[]).length} hráčů • ručně zadaný výsledek</div>
            </div>
            ${canManageSeries(s)?`<button class="btn danger" onclick="deleteHistoricalSeriesTournament('${s.id}','${ht.id}')">SMAZAT</button>`:''}
          </div>
          <div class="muted" style="margin-top:5px">${ht.statsComplete?('Kompletní W/L • '+Number((ht.matches||[]).length)+' zápasů'):'Pouze konečné pořadí • W/L neúplné'}</div>
          <div class="muted" style="margin-top:7px">${(ht.results||[]).slice().sort((a,b)=>Number(a.place)-Number(b.place)).map(r=>esc(String(r.place)+'. '+String(r.displayName||r.name||r.playerId||'Hráč'))).join(' • ')}</div>
        </div>`).join('')}`:''}

      ${canManageSeries(s)?`<h3 style="margin-top:18px">PŘIDAT HISTORICKÝ TURNAJ</h3>
        <div class="subpanel">
          <div class="grid two">
            <div><label>Název turnaje</label><input id="seriesHistoricalName_${s.id}" placeholder="např. Lounská tour – květen"></div>
            <div><label>Datum</label><input id="seriesHistoricalDate_${s.id}" type="date"></div>
          </div>
          <div style="margin-top:10px">
            <label>Způsob zadání</label>
            <select id="seriesHistoricalMode_${s.id}" onchange="toggleSeriesHistoricalMode('${s.id}')">
              <option value="full" selected>Kompletní turnaj – zadat odehrané zápasy</option>
              <option value="placements">Pouze konečné pořadí – neúplné W/L statistiky</option>
            </select>
          </div>

          <div id="seriesHistoricalFull_${s.id}" style="margin-top:12px">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
              <div>
                <label style="margin-bottom:3px">Odehrané zápasy</label>
                <div class="muted">Každý zápas zadej do samostatného řádku.</div>
              </div>
              <button class="btn" type="button" onclick="addHistoricalMatchRow('${s.id}')">+ PŘIDAT ZÁPAS</button>
            </div>
            <div id="seriesHistoricalMatchRows_${s.id}" class="historical-entry-list" style="margin-top:10px"></div>

            <label style="display:flex;align-items:center;gap:8px;margin-top:14px">
              <input id="seriesHistoricalManualPlacement_${s.id}" type="checkbox" style="width:auto" onchange="toggleHistoricalManualPlacement('${s.id}')">
              Chci konečné pořadí zadat ručně
            </label>
            <div id="seriesHistoricalManualPlacementBox_${s.id}" class="hidden" style="margin-top:10px">
              <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
                <div class="muted">Použij, pokud nemáš kompletní pavouk nebo chceš pořadí ručně opravit.</div>
                <button class="btn" type="button" onclick="addHistoricalPlacementRow('${s.id}','manual')">+ PŘIDAT HRÁČE</button>
              </div>
              <div id="seriesHistoricalManualPlacementRows_${s.id}" class="historical-entry-list" style="margin-top:10px"></div>
            </div>

            <details style="margin-top:14px">
              <summary style="cursor:pointer;font-weight:900">Pokročilé: vložit zápasy z textu</summary>
              <div style="margin-top:10px">
                <textarea id="seriesHistoricalMatches_${s.id}" rows="7" placeholder="skupina A; Jan Novák; Petr Svoboda; 2:1"></textarea>
                <div class="muted" style="margin-top:5px">Původní import zůstává jako záložní možnost. Pokud vyplníš řádky výše, mají přednost.</div>
                <textarea id="seriesHistoricalResults_${s.id}" rows="5" style="margin-top:8px" placeholder="Volitelné pořadí: 1; Jan Novák"></textarea>
              </div>
            </details>
          </div>

          <div id="seriesHistoricalPlacements_${s.id}" class="hidden" style="margin-top:12px">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
              <div>
                <label style="margin-bottom:3px">Konečné pořadí</label>
                <div class="muted">Stejné číslo místa znamená dělené pořadí.</div>
              </div>
              <button class="btn" type="button" onclick="addHistoricalPlacementRow('${s.id}','placements')">+ PŘIDAT HRÁČE</button>
            </div>
            <div id="seriesHistoricalPlacementRows_${s.id}" class="historical-entry-list" style="margin-top:10px"></div>
            <details style="margin-top:14px">
              <summary style="cursor:pointer;font-weight:900">Pokročilé: vložit pořadí z textu</summary>
              <textarea id="seriesHistoricalPlacementsOnly_${s.id}" rows="6" style="margin-top:10px" placeholder="1; Jan Novák&#10;2; Petr Svoboda"></textarea>
            </details>
            <div class="muted" style="margin-top:8px">Tato varianta uloží body za umístění, ale nebude doplňovat výhry/prohry ze zápasů.</div>
          </div>

          <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn primary" onclick="addHistoricalTournamentToSeries('${s.id}')">ULOŽIT HISTORICKÝ TURNAJ</button></div>
        </div>

        <h3 style="margin-top:18px">PŘIDAT JIŽ ODEHRANÝ TURNAJ Z POČÍTADLA</h3>
        ${available.length?`<div class="grid two">${available.map(t=>`<button class="btn" onclick="addTournamentToSeries('${s.id}','${t.id}')">${esc(t.name)} • ${esc(tournamentFormatLabel(t))}</button>`).join('')}</div>`:'<div class="muted">Žádný další dokončený turnaj není k dispozici.</div>'}
        ${canManageSeriesOrganizers(s)?`<div style="margin-top:18px"><button class="btn danger" onclick="deleteTournamentSeries('${s.id}')">SMAZAT SÉRII</button></div>`:''}`:''}
    `;
  }


  document.addEventListener('click',function(e){
    if(e.target?.closest?.('[onclick*="openSeries"]')||e.target?.closest?.('[onclick*="renderSeriesModal"]')){
      setTimeout(()=>{
        const s=(data.tournamentSeries||[]).find(x=>x.id===selectedSeriesId);
        if(s)ensureHistoricalInitialRows(s.id);
      },0);
    }
  },true);

  window.toggleSeriesEditScoring=function(seriesId){
    const custom=$('seriesEditScoringMode_'+seriesId)?.value==='custom';
    $('seriesEditBands_'+seriesId)?.classList.toggle('hidden',custom);
    $('seriesEditCustom_'+seriesId)?.classList.toggle('hidden',!custom);
  };

  window.saveSeriesScoring=function(seriesId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeries(s))return;

    const mode=$('seriesEditScoringMode_'+seriesId)?.value||'bands';
    const customText=($('seriesEditCustomPts_'+seriesId)?.value||'').trim();
    const custom=parseCustomSeriesPoints(customText);

    if(mode==='custom' && !Object.keys(custom.exact).length && !custom.ranges.length){
      toast('Zadej alespoň jedno vlastní bodové pravidlo.');
      return;
    }

    s.scoringMode=mode;
    s.placementTieBreak=$('seriesEditPlacementTieBreak_'+seriesId)?.value||'legacy';
    s.bestCount=Math.max(0,Number($('seriesEditBestCount_'+seriesId)?.value||0));
    s.pointsTop=parsePointList($('seriesEditTop_'+seriesId)?.value,[100,80,65,55]);
    s.pointsBands=parsePointList($('seriesEditBandsPts_'+seriesId)?.value,[45,25,10,5]);
    s.customPointsText=customText;
    s.customPoints=custom;
    s.updatedAt=new Date().toISOString();

    (s.tournamentIds||[]).forEach(tid=>{
      const t=(data.tournaments||[]).find(x=>x.id===tid);
      if(t)t.seriesPlacementTieBreak=s.placementTieBreak;
    });

    saveData();
    renderSeriesList();
    renderSeriesModal();
    renderResultsSeries();
    toast('Nastavení série bylo uloženo.');
  };


  function historicalPlayerOptionsHtml(selected=''){
    const players=Object.values(data.players||{})
      .filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)
      .sort((a,b)=>playerSelectionLabel(a).localeCompare(playerSelectionLabel(b),'cs'));
    return '<option value="">— vyber hráče —</option>'+
      players.map(p=>'<option value="'+esc(p.id)+'" '+(selected===p.id?'selected':'')+'>'+esc(playerSelectionLabel(p))+'</option>').join('')+
      '<option value="__guest__">Jiný hráč / host…</option>';
  }

  function historicalPlayerControlHtml(seriesId,rowId,side){
    return '<div class="historical-player-control" style="min-width:0">'+
      '<select class="historical-player-select" data-series="'+esc(seriesId)+'" data-row="'+esc(rowId)+'" data-side="'+esc(side)+'" onchange="historicalPlayerChoiceChanged(this)">'+historicalPlayerOptionsHtml()+'</select>'+
      '<input class="historical-guest-name hidden" data-side="'+esc(side)+'" placeholder="Jméno hosta" style="margin-top:6px">'+
    '</div>';
  }

  window.historicalPlayerChoiceChanged=function(sel){
    const wrap=sel?.closest('.historical-player-control');
    const input=wrap?.querySelector('.historical-guest-name');
    if(input)input.classList.toggle('hidden',sel.value!=='__guest__');
    if(input && sel.value==='__guest__')input.focus();
  };

  window.addHistoricalPlacementRow=function(seriesId,target='placements',place=''){
    const wrap=$(target==='manual'?'seriesHistoricalManualPlacementRows_'+seriesId:'seriesHistoricalPlacementRows_'+seriesId);
    if(!wrap)return;
    const rowId='hpr_'+uid();
    const row=document.createElement('div');
    row.className='historical-placement-row subpanel';
    row.dataset.rowId=rowId;
    row.style.margin='8px 0 0';
    row.innerHTML='<div class="historical-placement-grid">'+
      '<div><label>Místo</label><input class="historical-place" type="number" min="1" value="'+esc(String(place||''))+'" placeholder="1"></div>'+
      '<div><label>Hráč</label>'+historicalPlayerControlHtml(seriesId,rowId,'player')+'</div>'+
      '<div class="historical-row-remove"><button class="btn danger" type="button" onclick="this.closest(\'.historical-placement-row\').remove()">ODEBRAT</button></div>'+
    '</div>';
    wrap.appendChild(row);
  };

  window.addHistoricalMatchRow=function(seriesId){
    const wrap=$('seriesHistoricalMatchRows_'+seriesId);if(!wrap)return;
    const rowId='hmr_'+uid(),row=document.createElement('div');
    row.className='historical-match-row subpanel';
    row.dataset.rowId=rowId;
    row.style.margin='8px 0 0';
    row.innerHTML='<div class="historical-match-grid">'+
      '<div><label>Fáze</label><select class="historical-stage" onchange="historicalStageChanged(this)">'+
        '<option value="group">Skupina</option><option value="r32">Last 32</option><option value="r16">Osmifinále</option>'+
        '<option value="quarter">Čtvrtfinále</option><option value="semi">Semifinále</option><option value="third">O 3. místo</option><option value="final">Finále</option>'+
      '</select><input class="historical-group" value="A" placeholder="Skupina A" style="margin-top:6px"></div>'+
      '<div><label>Hráč 1</label>'+historicalPlayerControlHtml(seriesId,rowId,'p1')+'</div>'+
      '<div><label>Skóre</label><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:6px;align-items:center"><input class="historical-score1" type="number" min="0" value="0"><strong>:</strong><input class="historical-score2" type="number" min="0" value="0"></div></div>'+
      '<div><label>Hráč 2</label>'+historicalPlayerControlHtml(seriesId,rowId,'p2')+'</div>'+
      '<div class="historical-row-remove"><button class="btn danger" type="button" onclick="this.closest(\'.historical-match-row\').remove()">ODEBRAT</button></div>'+
    '</div>';
    wrap.appendChild(row);
  };

  window.historicalStageChanged=function(sel){
    const row=sel?.closest('.historical-match-row'),group=row?.querySelector('.historical-group');
    if(group)group.classList.toggle('hidden',sel.value!=='group');
  };

  window.toggleHistoricalManualPlacement=function(seriesId){
    const on=$('seriesHistoricalManualPlacement_'+seriesId)?.checked===true;
    const box=$('seriesHistoricalManualPlacementBox_'+seriesId);
    box?.classList.toggle('hidden',!on);
    const rows=$('seriesHistoricalManualPlacementRows_'+seriesId);
    if(on && rows && !rows.children.length){
      addHistoricalPlacementRow(seriesId,'manual',1);
      addHistoricalPlacementRow(seriesId,'manual',2);
    }
  };

  function historicalStructuredPlayer(control){
    const sel=control?.querySelector('.historical-player-select');
    if(!sel||!sel.value)return null;
    if(sel.value==='__guest__'){
      const name=String(control.querySelector('.historical-guest-name')?.value||'').trim();
      if(!name)return null;
      return {id:'histguest_'+uid(),displayName:name,guest:true};
    }
    const p=data.players?.[sel.value];
    return p?{id:p.id,displayName:playerSelectionLabel(p),guest:false}:null;
  }

  function collectHistoricalPlacementRows(seriesId,target){
    const wrap=$(target==='manual'?'seriesHistoricalManualPlacementRows_'+seriesId:'seriesHistoricalPlacementRows_'+seriesId);
    const rows=[...(wrap?.querySelectorAll('.historical-placement-row')||[])];
    return rows.map((row,i)=>{
      const place=Math.floor(Number(row.querySelector('.historical-place')?.value||0));
      const player=historicalStructuredPlayer(row.querySelector('.historical-player-control'));
      if(place<1)throw new Error('Zkontroluj místo na řádku '+(i+1)+'.');
      if(!player)throw new Error('Vyber hráče na řádku '+(i+1)+'.');
      return {place,player};
    });
  }

  function collectHistoricalMatchRows(seriesId){
    const wrap=$('seriesHistoricalMatchRows_'+seriesId);
    const rows=[...(wrap?.querySelectorAll('.historical-match-row')||[])];
    return rows.map((row,i)=>{
      const stage=row.querySelector('.historical-stage')?.value||'';
      const group=stage==='group'?String(row.querySelector('.historical-group')?.value||'A').trim():'';
      const controls=row.querySelectorAll('.historical-player-control');
      const p1=historicalStructuredPlayer(controls[0]),p2=historicalStructuredPlayer(controls[1]);
      const score1=Math.max(0,Math.floor(Number(row.querySelector('.historical-score1')?.value||0)));
      const score2=Math.max(0,Math.floor(Number(row.querySelector('.historical-score2')?.value||0)));
      if(!p1||!p2)throw new Error('Vyber oba hráče u zápasu '+(i+1)+'.');
      if(normalizeSeriesHistoricalName(p1.displayName)===normalizeSeriesHistoricalName(p2.displayName))throw new Error('V zápasu '+(i+1)+' je stejný hráč na obou stranách.');
      if(score1===score2)throw new Error('Zápas '+(i+1)+' nemůže skončit remízou.');
      return {stage,group,p1,p2,score1,score2};
    });
  }

  function ensureHistoricalInitialRows(seriesId){
    const matchWrap=$('seriesHistoricalMatchRows_'+seriesId);
    if(matchWrap && !matchWrap.children.length)addHistoricalMatchRow(seriesId);
    const placementWrap=$('seriesHistoricalPlacementRows_'+seriesId);
    if(placementWrap && !placementWrap.children.length){
      addHistoricalPlacementRow(seriesId,'placements',1);
      addHistoricalPlacementRow(seriesId,'placements',2);
      addHistoricalPlacementRow(seriesId,'placements',3);
    }
  }

  window.toggleSeriesHistoricalMode=function(seriesId){
    const mode=$('seriesHistoricalMode_'+seriesId)?.value||'full';
    $('seriesHistoricalFull_'+seriesId)?.classList.toggle('hidden',mode!=='full');
    $('seriesHistoricalPlacements_'+seriesId)?.classList.toggle('hidden',mode==='full');
    ensureHistoricalInitialRows(seriesId);
  };

  function parseHistoricalPlacementRows(raw,resolver){
    const parsed=[],errors=[];
    String(raw||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach((line,i)=>{
      const m=line.match(/^(\d+)\s*(?:;|\||\t|\.\s+|:\s+)\s*(.+)$/);
      if(!m){errors.push(i+1);return;}
      const place=Math.max(1,Math.floor(Number(m[1])));
      const name=String(m[2]||'').trim();
      if(!name){errors.push(i+1);return;}
      const p=resolver(name);
      parsed.push({place,playerId:p.id,displayName:p.displayName});
    });
    if(errors.length)throw new Error('Zkontroluj řádky '+errors.join(', ')+' – použij formát místo; jméno.');
    const counts={};
    parsed.forEach(x=>counts[x.place]=(counts[x.place]||0)+1);
    parsed.forEach(x=>x.sharedPlace=counts[x.place]>1);
    return parsed;
  }

  function historicalStageInfo(raw){
    const original=String(raw||'').trim();
    const n=normalizeSeriesHistoricalName(original);
    if(n.startsWith('skupina')||n==='group'||n.startsWith('group ')){
      const g=original.replace(/^\s*(skupina|group)\s*/i,'').trim()||'A';
      return {stage:'group',group:g,label:original};
    }
    if(n.includes('o 3')||n.includes('3. mist')||n.includes('third'))return {stage:'third',group:'',label:original};
    if(n.includes('semifinal')||n==='sf')return {stage:'semi',group:'',label:original};
    if(n.includes('ctvrtfinal')||n==='qf'||n.includes('quarter'))return {stage:'quarter',group:'',label:original};
    if(n.includes('osmifinal')||n.includes('last 16')||n==='r16')return {stage:'r16',group:'',label:original};
    if(n.includes('sestnactifinal')||n.includes('last 32')||n==='r32')return {stage:'r32',group:'',label:original};
    if((n.includes('final')||n==='f')&&!n.includes('semi')&&!n.includes('ctvrt')&&!n.includes('osmi'))return {stage:'final',group:'',label:original};
    return null;
  }

  function historicalAutoPlacements(matches,participants){
    const ids=[...participants.keys()];
    const groupMatches=matches.filter(m=>m.stage==='group');
    const playoffMatches=matches.filter(m=>m.stage!=='group');
    const playoffPlayers=new Set(playoffMatches.flatMap(m=>[m.player1Id,m.player2Id]));
    const groupStats={},groups=new Map();

    const ensureGroup=(pid,group)=>{
      if(!groupStats[pid])groupStats[pid]={playerId:pid,group:String(group||''),wins:0,losses:0,for:0,against:0,diff:0,place:999};
      if(group&&!groupStats[pid].group)groupStats[pid].group=String(group);
      return groupStats[pid];
    };

    groupMatches.forEach(m=>{
      const a=ensureGroup(m.player1Id,m.group),b=ensureGroup(m.player2Id,m.group);
      a.for+=m.score1;a.against+=m.score2;a.diff=a.for-a.against;
      b.for+=m.score2;b.against+=m.score1;b.diff=b.for-b.against;
      if(m.winnerId===m.player1Id){a.wins++;b.losses++;}else{b.wins++;a.losses++;}
      const key=String(m.group||'A');
      if(!groups.has(key))groups.set(key,new Set());
      groups.get(key).add(m.player1Id);groups.get(key).add(m.player2Id);
    });

    const h2hWinner=(a,b)=>{
      const sameGroup=String(groupStats[a]?.group||'')===String(groupStats[b]?.group||'');
      if(!sameGroup)return null;
      const mm=groupMatches.find(m=>(m.player1Id===a&&m.player2Id===b)||(m.player1Id===b&&m.player2Id===a));
      return mm?.winnerId||null;
    };

    groups.forEach(set=>{
      const arr=[...set].map(id=>groupStats[id]);
      arr.sort((a,b)=>{
        if(b.wins!==a.wins)return b.wins-a.wins;
        if(b.diff!==a.diff)return b.diff-a.diff;
        if(b.for!==a.for)return b.for-a.for;
        const h=h2hWinner(a.playerId,b.playerId);
        if(h===a.playerId)return -1;if(h===b.playerId)return 1;
        return 0;
      });
      let prev=null,rank=1;
      arr.forEach((r,i)=>{
        let same=false;
        if(prev){
          const h=h2hWinner(prev.playerId,r.playerId);
          same=prev.wins===r.wins&&prev.diff===r.diff&&prev.for===r.for&&!h;
        }
        if(!same)rank=i+1;
        r.place=rank;prev=r;
      });
    });

    const playoffScores={};
    const po=pid=>playoffScores[pid]||(playoffScores[pid]={for:0,against:0,diff:0});
    playoffMatches.forEach(m=>{
      const a=po(m.player1Id),b=po(m.player2Id);
      a.for+=m.score1;a.against+=m.score2;a.diff=a.for-a.against;
      b.for+=m.score2;b.against+=m.score1;b.diff=b.for-b.against;
    });

    const results=[],placed=new Set();
    const add=(pid,place)=>{
      if(!pid||placed.has(pid))return;
      const p=participants.get(pid);
      results.push({place,playerId:pid,displayName:p?.displayName||pid,sharedPlace:false});
      placed.add(pid);
    };

    const final=playoffMatches.find(m=>m.stage==='final');
    if(!final)throw new Error('Pro automatický výpočet chybí finále. Doplň finále nebo vyplň ruční konečné pořadí.');
    add(final.winnerId,1);add(final.loserId,2);

    const third=playoffMatches.find(m=>m.stage==='third');
    if(third){add(third.winnerId,3);add(third.loserId,4);}

    const cmp=(a,b)=>{
      const pa=playoffScores[a]||{},pb=playoffScores[b]||{},ga=groupStats[a]||{},gb=groupStats[b]||{};
      if(Number(pb.diff||0)!==Number(pa.diff||0))return Number(pb.diff||0)-Number(pa.diff||0);
      if(Number(pb.for||0)!==Number(pa.for||0))return Number(pb.for||0)-Number(pa.for||0);
      if(Number(gb.wins||0)!==Number(ga.wins||0))return Number(gb.wins||0)-Number(ga.wins||0);
      if(Number(gb.diff||0)!==Number(ga.diff||0))return Number(gb.diff||0)-Number(ga.diff||0);
      const h=h2hWinner(a,b);if(h===a)return -1;if(h===b)return 1;
      return 0;
    };
    const same=(a,b)=>{
      const pa=playoffScores[a]||{},pb=playoffScores[b]||{},ga=groupStats[a]||{},gb=groupStats[b]||{};
      if(Number(pa.diff||0)!==Number(pb.diff||0)||Number(pa.for||0)!==Number(pb.for||0)||Number(ga.wins||0)!==Number(gb.wins||0)||Number(ga.diff||0)!==Number(gb.diff||0))return false;
      return !h2hWinner(a,b);
    };
    const stage=(name,startPlace)=>{
      let losers=[...new Set(playoffMatches.filter(m=>m.stage===name).map(m=>m.loserId).filter(id=>id&&!placed.has(id)))];
      losers.sort(cmp);
      let prev=null,rank=startPlace;
      losers.forEach((pid,i)=>{
        if(i===0)rank=startPlace;
        else if(!same(prev,pid))rank=startPlace+i;
        add(pid,rank);prev=pid;
      });
    };

    if(!third)stage('semi',3);
    stage('quarter',5);
    stage('r16',9);
    stage('r32',17);

    const groupOnly=ids.filter(id=>!playoffPlayers.has(id)&&!placed.has(id));
    groupOnly.sort((a,b)=>{
      const ga=groupStats[a]||{},gb=groupStats[b]||{};
      if(Number(ga.place||999)!==Number(gb.place||999))return Number(ga.place||999)-Number(gb.place||999);
      if(Number(gb.wins||0)!==Number(ga.wins||0))return Number(gb.wins||0)-Number(ga.wins||0);
      if(Number(gb.diff||0)!==Number(ga.diff||0))return Number(gb.diff||0)-Number(ga.diff||0);
      if(Number(gb.for||0)!==Number(ga.for||0))return Number(gb.for||0)-Number(ga.for||0);
      const h=h2hWinner(a,b);if(h===a)return -1;if(h===b)return 1;
      return 0;
    });
    const sameGroup=(a,b)=>{
      const ga=groupStats[a]||{},gb=groupStats[b]||{};
      if(Number(ga.place||999)!==Number(gb.place||999)||Number(ga.wins||0)!==Number(gb.wins||0)||Number(ga.diff||0)!==Number(gb.diff||0)||Number(ga.for||0)!==Number(gb.for||0))return false;
      return !h2hWinner(a,b);
    };
    const groupStart=Math.max(1,playoffPlayers.size+1);
    let prev=null,rank=groupStart;
    groupOnly.forEach((pid,i)=>{
      if(i===0)rank=groupStart;
      else if(!sameGroup(prev,pid))rank=groupStart+i;
      add(pid,rank);prev=pid;
    });

    results.sort((a,b)=>a.place-b.place||String(a.displayName).localeCompare(String(b.displayName),'cs'));
    const counts={};results.forEach(r=>counts[r.place]=(counts[r.place]||0)+1);
    results.forEach(r=>r.sharedPlace=counts[r.place]>1);
    return results;
  }

  window.addHistoricalTournamentToSeries=function(seriesId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeries(s))return;

    const name=String($('seriesHistoricalName_'+seriesId)?.value||'').trim();
    const date=String($('seriesHistoricalDate_'+seriesId)?.value||'').trim();
    const mode=String($('seriesHistoricalMode_'+seriesId)?.value||'full');
    if(!name){toast('Zadej název historického turnaje.');return;}
    if(!date){toast('Zadej datum historického turnaje.');return;}

    const byName=new Map(),byId=new Map();
    const resolve=(displayName)=>{
      const clean=String(displayName||'').trim(),key=normalizeSeriesHistoricalName(clean);
      if(byName.has(key))return byName.get(key);
      const player=seriesHistoricalPlayerMatch(clean);
      const item=player?{id:player.id,displayName:playerSelectionLabel(player)}:{id:'histguest_'+uid(),displayName:clean};
      byName.set(key,item);byId.set(item.id,item);
      return item;
    };

    try{
      let results=[],matches=[],statsComplete=false,manualPlacement=false;
      if(mode==='placements'){
        const structured=collectHistoricalPlacementRows(seriesId,'placements');
        const raw=String($('seriesHistoricalPlacementsOnly_'+seriesId)?.value||'').trim();
        if(structured.length){
          const seen=new Set();
          results=structured.map(({place,player})=>{
            const key=normalizeSeriesHistoricalName(player.displayName);
            if(seen.has(key))throw new Error('Hráč „'+player.displayName+'“ je v pořadí zadaný vícekrát.');
            seen.add(key);
            byId.set(player.id,player);
            return {place,playerId:player.id,displayName:player.displayName};
          });
          const counts={};results.forEach(x=>counts[x.place]=(counts[x.place]||0)+1);
          results.forEach(x=>x.sharedPlace=counts[x.place]>1);
        }else if(raw){
          results=parseHistoricalPlacementRows(raw,resolve);
        }else throw new Error('Přidej alespoň dva hráče do konečného pořadí.');
      }else{
        const structured=collectHistoricalMatchRows(seriesId);
        const raw=String($('seriesHistoricalMatches_'+seriesId)?.value||'').trim();

        if(structured.length){
          structured.forEach((m,i)=>{
            const p1=m.p1,p2=m.p2;
            byId.set(p1.id,p1);byId.set(p2.id,p2);
            const stageLabel=m.stage==='group'?'skupina '+(m.group||'A'):
              ({r32:'Last 32',r16:'osmifinále',quarter:'čtvrtfinále',semi:'semifinále',third:'o 3. místo',final:'finále'}[m.stage]||m.stage);
            matches.push({
              id:'histmatch_'+uid(),stage:m.stage,stageLabel,group:m.group||'',
              player1Id:p1.id,player2Id:p2.id,player1Name:p1.displayName,player2Name:p2.displayName,
              score1:m.score1,score2:m.score2,winnerId:m.score1>m.score2?p1.id:p2.id,loserId:m.score1>m.score2?p2.id:p1.id
            });
          });
        }else if(raw){
          const errors=[];
          raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).forEach((line,i)=>{
            const parts=line.split(';').map(x=>x.trim());
            if(parts.length<4){errors.push(i+1);return;}
            const st=historicalStageInfo(parts[0]),p1=resolve(parts[1]),p2=resolve(parts[2]);
            const sm=parts.slice(3).join(';').trim().match(/^(\d+)\s*[:\-]\s*(\d+)$/);
            if(!st||!p1.displayName||!p2.displayName||!sm){errors.push(i+1);return;}
            const score1=Number(sm[1]),score2=Number(sm[2]);
            if(score1===score2){errors.push(i+1);return;}
            matches.push({
              id:'histmatch_'+uid(),stage:st.stage,stageLabel:st.label,group:st.group||'',
              player1Id:p1.id,player2Id:p2.id,player1Name:p1.displayName,player2Name:p2.displayName,
              score1,score2,winnerId:score1>score2?p1.id:p2.id,loserId:score1>score2?p2.id:p1.id
            });
          });
          if(errors.length)throw new Error('Zkontroluj zápasy na řádcích '+errors.join(', ')+'.');
        }else throw new Error('Přidej alespoň jeden odehraný zápas.');

        const manualOn=$('seriesHistoricalManualPlacement_'+seriesId)?.checked===true;
        const manualRows=manualOn?collectHistoricalPlacementRows(seriesId,'manual'):[];
        const override=String($('seriesHistoricalResults_'+seriesId)?.value||'').trim();
        if(manualRows.length){
          const seen=new Set();
          results=manualRows.map(({place,player})=>{
            const key=normalizeSeriesHistoricalName(player.displayName);
            if(seen.has(key))throw new Error('Hráč „'+player.displayName+'“ je v pořadí zadaný vícekrát.');
            seen.add(key);byId.set(player.id,player);
            return {place,playerId:player.id,displayName:player.displayName};
          });
          const counts={};results.forEach(x=>counts[x.place]=(counts[x.place]||0)+1);
          results.forEach(x=>x.sharedPlace=counts[x.place]>1);
          manualPlacement=true;
        }else if(override){
          results=parseHistoricalPlacementRows(override,resolve);manualPlacement=true;
        }else results=historicalAutoPlacements(matches,byId);
        statsComplete=true;
      }

      if(results.length<2)throw new Error('Historický turnaj musí mít alespoň 2 hráče.');
      if(!results.some(x=>x.place===1))throw new Error('V pořadí chybí 1. místo.');

      s.historicalTournaments=Array.isArray(s.historicalTournaments)?s.historicalTournaments:[];
      s.historicalTournaments.push({
        id:'hist_'+uid(),name,date,mode:mode==='full'?'full':'placements',
        statsComplete,manualPlacement,results,matches,
        createdAt:new Date().toISOString(),createdByUid:cloudUid||''
      });
      s.updatedAt=new Date().toISOString();
      saveData();renderSeriesList();renderSeriesModal();renderResultsSeries();
      try{renderTournamentStats();}catch(e){}
      toast(statsComplete?'Historický turnaj včetně zápasů byl přidán do série.':'Historický turnaj byl uložen pouze s konečným pořadím.');
    }catch(e){toast(e?.message||String(e));}
  };

  window.deleteHistoricalSeriesTournament=function(seriesId,historicalId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeries(s))return;
    const ht=(s.historicalTournaments||[]).find(x=>x.id===historicalId);
    if(!ht)return;
    if(!confirm('Opravdu smazat historický turnaj „'+(ht.name||'')+'“ ze série?'))return;
    s.historicalTournaments=(s.historicalTournaments||[]).filter(x=>x.id!==historicalId);
    s.updatedAt=new Date().toISOString();
    saveData();
    renderSeriesList();
    renderSeriesModal();
    renderResultsSeries();
    toast('Historický turnaj byl ze série odebrán.');
  };

  window.addTournamentToSeries=function(seriesId,tournamentId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeries(s))return;
    if(!(s.tournamentIds||[]).includes(tournamentId))s.tournamentIds.push(tournamentId);
    const t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(t)t.seriesPlacementTieBreak=seriesPlacementTieBreakMode(s);
    s.updatedAt=new Date().toISOString();
    saveData();renderSeriesList();renderSeriesModal();renderTournamentSeriesSelect();
  };

  window.removeTournamentFromSeries=function(seriesId,tournamentId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeries(s))return;
    s.tournamentIds=(s.tournamentIds||[]).filter(id=>id!==tournamentId);
    s.updatedAt=new Date().toISOString();
    saveData();renderSeriesList();renderSeriesModal();renderTournamentSeriesSelect();
  };

  window.deleteTournamentSeries=function(seriesId){
    const s=(data.tournamentSeries||[]).find(x=>x.id===seriesId);
    if(!s||!canManageSeriesOrganizers(s))return;
    if(!confirm('Opravdu smazat sérii „'+s.name+'“? Samotné turnaje zůstanou zachované.'))return;
    data.tournamentSeries=(data.tournamentSeries||[]).filter(x=>x.id!==seriesId);
    saveData();$('seriesModal').classList.remove('show');renderSeriesList();renderTournamentSeriesSelect();
  };


  function renderResultsTournaments(){
    const wrap=$('resultsTournamentList');
    if(!wrap)return;

    const completed=(data.tournaments||[])
      .filter(t=>t && t.status==='complete')
      .slice()
      .sort((a,b)=>new Date(b.updatedAt||b.createdAt||0)-new Date(a.updatedAt||a.createdAt||0));

    if(!completed.length){
      wrap.innerHTML='<div class="empty">Zatím není dokončený žádný turnaj.</div>';
      return;
    }

    wrap.innerHTML=completed.map(t=>{
      const all=allTournamentMatches(t);
      const date=t.createdAt?new Date(t.createdAt).toLocaleDateString('cs-CZ'):'';
      const placements=tournamentPlacementRecords(t);
      const winner=placements.find(r=>Number(r.value)===1);
      const winnerName=winner?tournamentPlayerName(winner.playerId,t):'—';

      return `<div class="subpanel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:230px">
            <div style="font-size:22px;font-weight:950">${esc(t.name||'Turnaj')}</div>
            <div class="muted" style="margin-top:5px">
              ${esc(tournamentFormatLabel(t))} • ${esc(tournamentDisciplineSummary(t))} • Race to ${t.raceTo}${t.variableRaceEnabled?' • proměnlivé Race to':''}${t.groupAdvanceTieRule==='head_to_head'?' • shoda bodů: vzájemný zápas':' • shoda bodů: skóre'}${t.groupPenaltyTieBreak?' • nerozhodnuto: penalty':''}
              ${date?' • '+esc(date):''} • ${all.length} zápasů
            </div>
            <div style="margin-top:7px"><strong>Vítěz:</strong> ${esc(winnerName)}</div>
          </div>
          <button class="btn primary" onclick="openTournamentResultDetail('${t.id}')">VÝSLEDKY</button>
        </div>
      </div>`;
    }).join('');
  }

  window.openTournamentResultDetail=async function(tid){
    tournamentDetailReturnScreen='results-tournaments';
    preserveTournamentDetailReturn=true;
    await openTournamentDetail(tid);
  };

  function renderResultsSeries(){
    const wrap=$('resultsSeriesList');
    if(!wrap)return;

    const list=(data.tournamentSeries||[])
      .slice()
      .sort((a,b)=>String(b.season||'').localeCompare(String(a.season||''))||String(a.name||'').localeCompare(String(b.name||''),'cs'));

    if(!list.length){
      wrap.innerHTML='<div class="empty">Zatím není vytvořená žádná série.</div>';
      return;
    }

    wrap.innerHTML=list.map(s=>{
      const tournaments=(s.tournamentIds||[])
        .map(id=>(data.tournaments||[]).find(t=>t.id===id))
        .filter(Boolean);
      const historical=Array.isArray(s.historicalTournaments)?s.historicalTournaments:[];
      const completed=tournaments.filter(t=>t.status==='complete').length+historical.length;
      const total=tournaments.length+historical.length;
      const standings=seriesStandings(s);
      const leader=standings[0];
      const leaderName=leader?(leader.displayName||leader.playerId):'—';
      const leaderPts=leader?leader.points:0;

      return `<div class="subpanel" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
          <div style="flex:1;min-width:230px">
            <div style="font-size:22px;font-weight:950">${esc(s.name||'Série')}</div>
            <div class="muted" style="margin-top:5px">
              ${esc(s.club||'')}${s.season?' • '+esc(s.season):''} • ${completed}/${total} odehraných turnajů • ${standings.length} hráčů
            </div>
            <div style="margin-top:7px"><strong>Průběžně vede:</strong> ${esc(leaderName)}${leader?' • '+leaderPts+' bodů':''}</div>
          </div>
          <button class="btn primary" onclick="openTournamentSeries('${s.id}')">POŘADÍ SÉRIE</button>
        </div>
      </div>`;
    }).join('');
  }

  function updateTournamentNineBallBreakRuleVisibility(){
    const field=$('tournamentNineBallBreakRuleField');
    if(!field)return;
    const groupDisc=$('tournamentDiscipline')?.value||'';
    const playoffDisc=$('tournamentPlayoffDiscipline')?.value||'';
    const format=$('tournamentFormat')?.value||'';
    const hybrid=['groups_sko','groups_dko'].includes(format);
    const usesNineBall=groupDisc==='9-ball' || (hybrid && playoffDisc==='9-ball');
    field.classList.toggle('hidden',!usesNineBall);
  }


  // =========================
  // POOL LIGA SEVER 2026 • ONLINE
  // =========================
  const LEAGUE_SEVER_ID='liga_sever_2026';
  const LEAGUE_CLOUD_ROOT='leagueSever2026';
  const LEAGUE_SEVER_TEAMS=[
    {id:'lovo',name:'1. BC LOVO'},
    {id:'rybarna',name:'BC Rybárna'},
    {id:'kadan',name:'Kadaňský Break'},
    {id:'louny',name:'Billiard Club Louny'}
  ];
  const LEAGUE_SEVER_DRAW=[
    [1,'lovo','kadan'],[1,'rybarna','louny'],
    [2,'rybarna','lovo'],[2,'kadan','louny'],
    [3,'louny','lovo'],[3,'kadan','rybarna'],
    [4,'kadan','lovo'],[4,'louny','rybarna'],
    [5,'lovo','louny'],[5,'rybarna','kadan'],
    [6,'lovo','rybarna'],[6,'louny','kadan'],
    [7,'lovo','kadan'],[7,'rybarna','louny'],
    [8,'louny','lovo'],[8,'kadan','rybarna'],
    [9,'rybarna','lovo'],[9,'kadan','louny']
  ];
  const LEAGUE_LEG_MAP=[[0,0],[1,1],[2,2],[0,1],[1,2],[2,0]];
  let leagueCloudLoaded=false;
  let leagueCloudLoading=false;
  let leagueConfirmations={};
  let leagueConfigTeams={};
  let leaguePlayerAliases={};

