// Livescore DOM renderer. The application supplies display models and authorized action callbacks.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LivescoreRenderer=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
function create({elements,actions,page}){
  const $=id=>elements[id], esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const removers=[];let disposed=false;
  function listen(target,type,fn){if(!target)return;target.addEventListener(type,fn);removers.push(()=>target.removeEventListener(type,fn));}
  function delegate(root){listen(root,'click',event=>{const button=event.target.closest?.('[data-live-action]');if(!button||!root.contains(button)||button.disabled)return;const name=button.dataset.liveAction;if(Object.prototype.hasOwnProperty.call(actions,name))actions[name](button.dataset.liveId);});}
  delegate($('liveMatchesList'));delegate($('liveTournamentsList'));
  listen($('liveScoreModal'),'click',event=>{const button=event.target.closest?.('button');if(!button)return;if(button===$('liveScoreClose'))actions.close();else if(button===$('liveScoreEditSolo14'))actions.editSolo();});
  listen($('cleanupStaleLiveBtn'),'click',()=>actions.cleanup());
  listen($('restoreHiddenLiveBtn'),'click',()=>actions.restoreHidden());
  listen(page,'pagehide',event=>{if(!event.persisted)dispose();});
  function dispose(){if(disposed)return;disposed=true;removers.splice(0).forEach(remove=>remove());}
  function renderNav(count){
    const btn=$('liveNavBtn');
    const modernTile=$('modernLiveTile');
    const modernText=$('modernLiveTileText');
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
  function renderList({matches,tournaments:tours}){
    const matchesWrap=$('liveMatchesList');
    const tournamentsWrap=$('liveTournamentsList');
    if(!matchesWrap || !tournamentsWrap)return;

    renderNav(matches.length);
    if(!matches.length){
      matchesWrap.innerHTML='<div class="muted">Momentálně není rozehraný žádný zápas.</div>';
    }else{
      matchesWrap.innerHTML=matches.map(m=>{
        const p1=esc(m.p1);
        const p2=esc(m.p2);
        const s1=m.s1;
        const s2=m.s2;
        const disc=esc(m.discipline);
        const rt=m.raceTo;
        const table=m.table;
        const tournamentName=esc(m.tournamentName);
        return `<div class="tournament-match">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px">
            <span class="tournament-badge gold">${disc||'ZÁPAS'}</span>
            <span class="muted">${table?'STŮL '+esc(String(table)):(rt?'RACE TO '+esc(String(rt)):'')}</span>
          </div>
          <div class="tm-row">
            <div class="tm-p">${p1}</div>
            <div class="tm-score">${s1} : ${s2}</div>
            <div class="tm-p">${p2}</div>
          </div>
          ${tournamentName?`<div class="muted" style="margin-top:7px;text-align:center">${tournamentName}</div>`:''}
          ${m.ghostLabel?`<div style="margin-top:7px;text-align:center;font-size:12px;font-weight:950;color:var(--gold2)">${esc(m.ghostLabel)}</div>`:''}
          ${m.breakLabel?`<div style="margin-top:7px;text-align:center;font-size:11px;font-weight:950">ROZSTŘEL: ${esc(m.breakLabel)}</div>`:''}
          <div class="muted" style="margin-top:7px;text-align:center;font-size:11px;line-height:1.55">
            Začátek: <strong>${esc(m.started)}</strong> • Aktualizováno: <strong>${esc(m.updated)}</strong>
            ${m.stale?`<div class="live-stale-note">⚠ MOŽNÁ NEAKTUÁLNÍ</div>`:''}
          </div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
            ${m.canResume
              ? `<button class="btn primary" data-live-action="resume" data-live-id="${esc(String(m.id))}">POKRAČOVAT</button>`
              : ''}
            <button class="btn" data-live-action="detail" data-live-id="${esc(String(m.id))}">LIVESCORE</button>
            <button class="btn" data-live-action="hide" data-live-id="${esc(String(m.id))}">SKRÝT Z LIVE</button>
            ${m.canDeleteTest
              ? `<button class="btn danger" data-live-action="deleteTest" data-live-id="${esc(String(m.id))}">SMAZAT TEST ZCELA</button>`
              : ''}
            ${m.canDelete
              ? `<button class="btn danger" data-live-action="deleteLive" data-live-id="${esc(String(m.id))}">SMAZAT Z LIVE</button>`
              : ''}
          </div>
        </div>`;
      }).join('');
    }

    if(!tours.length){
      tournamentsWrap.innerHTML='<div class="muted">Momentálně neprobíhá žádný turnaj.</div>';
    }else{
      tournamentsWrap.innerHTML=tours.map(t=>{
        const {done,playing,total}=t;
        return `<div class="tournament-match">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${esc(t.name||'Turnaj')}</strong>
            <span class="tournament-badge gold">PROBÍHÁ</span>
          </div>
          <div class="muted" style="margin-top:8px">
            ${esc(t.disciplineSummary)} • odehráno ${done}/${total}
            ${playing?` • právě hraje ${playing}`:''}
            ${t.waitingPlayoff
              ? ' • ČEKÁ NA NASAZENÍ PLAY-OFF'
              : ''}
            ${t.canManage?'':' • pouze ke sledování'}
          </div>
          <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
            <button class="btn" data-live-action="tournament" data-live-id="${esc(String(t.id))}">${t.canManage?'OTEVŘÍT TURNAJ':'NÁHLED TURNAJE'}</button>
            <button class="btn primary" data-live-action="tournamentLive" data-live-id="${esc(String(t.id))}">LIVESCORE</button>
          </div>
        </div>`;
      }).join('');
    }
  }
  function momentumHtml(md,p1,p2){
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
  function renderDetail(m){
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

    const canSoloEdit=m.canSoloEdit;
    $('liveScoreEditSolo14')?.classList.toggle('hidden',!canSoloEdit);
    if($('liveScoreModeLabel')){
      $('liveScoreModeLabel').textContent=canSoloEdit
        ? 'LIVESCORE • TVOJE ROZEHRANÁ 14.1 SÓLO'
        : 'LIVESCORE • POUZE KE SLEDOVÁNÍ';
    }

    const p1=m.p1;
    const p2=m.p2;
    const s1=m.s1;
    const s2=m.s2;
    const discipline=m.discipline;
    const raceTo=m.raceTo;

    $('liveScoreTitle').textContent=(m.tournamentLinked?'Turnajový zápas':'Aktuální zápas');
    $('liveScoreMeta').textContent=[
      discipline,
      raceTo ? 'Race to '+raceTo : '',
      m.ghostLabel ? m.ghostLabel : '',
      m.breakLabel ? 'Rozstřel: '+m.breakLabel : '',
      m.table ? 'Stůl '+m.table : ''
    ].filter(Boolean).join(' • ');

    $('liveScoreP1').textContent=p1;
    $('liveScoreP2').textContent=p2;
    $('liveScoreP1Club').textContent=m.club1;
    $('liveScoreP2Club').textContent=m.club2;
    $('liveScoreValue').textContent=s1+' : '+s2;
    $('liveScoreRace').textContent=raceTo ? 'Race to '+raceTo : '';

    const turnIndex=m.turnIndex;
    const turnText=turnIndex===0 ? p1 : turnIndex===1 ? p2 : '';
    const clock=m.clock;
    const clockText=(clock!==null && clock!==undefined) ? String(clock)+' s' : '';

    $('liveScoreExtra').innerHTML=`
      <div style="display:flex;justify-content:${m.useClock?'space-between':'center'};gap:12px;flex-wrap:wrap">
        <div><span class="muted">Na tahu:</span> <strong>${esc(turnText||'—')}</strong></div>
        ${m.useClock?`<div><span class="muted">Shot clock:</span> <strong>${esc(clockText||'—')}</strong></div>`:''}
      </div>
      <div class="muted" style="margin-top:12px;text-align:center;font-size:12px;line-height:1.6">
        Začátek: <strong>${esc(m.started)}</strong><br>
        Aktualizováno: <strong>${esc(m.updated)}</strong>
        ${m.stale?`<div class="live-stale-note" style="margin-top:3px">⚠ MOŽNÁ NEAKTUÁLNÍ</div>`:''}
      </div>
      ${momentumHtml(m.momentum,p1,p2)}
    `;
  }
  return Object.freeze({renderNav:count=>{if(!disposed)renderNav(count);},renderList:model=>{if(!disposed)renderList(model);},renderDetail:model=>{if(!disposed)renderDetail(model);},dispose});
}
return Object.freeze({create});});
