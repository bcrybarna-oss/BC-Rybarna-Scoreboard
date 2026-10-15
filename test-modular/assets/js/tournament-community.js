
(function(){
  function q(id){return document.getElementById(id)}
  function esc2(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
  function fmtDate(v){
    if(!v)return 'Datum neuvedeno';
    var d=new Date(v+'T12:00:00');
    return isNaN(d)?v:d.toLocaleDateString('cs-CZ',{day:'numeric',month:'long',year:'numeric'});
  }
  function tournamentFinished(t){
    if(!t)return false;
    if(t.completed===true||t.finished===true||t.status==='complete'||t.status==='finished')return true;
    if(t.finishedAt||t.completedAt)return true;
    var pi=t.publicInfo||{};
    if(pi.date){
      var end=new Date(pi.date+'T23:59:59').getTime();
      return Number.isFinite(end)&&end<Date.now();
    }
    return false;
  }
  function linkedPlayer(){
    try{
      if(!cloudUid)return null;
      return Object.values(data.players||{}).find(function(p){return p&&String(p.ownerUid||'')===String(cloudUid)})||null;
    }catch(e){return null}
  }
  function card(t,past){
    var pi=t.publicInfo||{};
    var regs=Array.isArray(t.registrations)?t.registrations:[];
    var cap=Number(pi.capacity||0);
    var meta=[];
    if(t.discipline)meta.push(esc2(String(t.discipline).toUpperCase()));
    if(pi.venue)meta.push('📍 '+esc2(pi.venue));
    if(t.checkin&&Number(t.checkin.entryFee||0)>0)meta.push('Startovné '+Number(t.checkin.entryFee).toLocaleString('cs-CZ')+' Kč');
    if(cap)meta.push('Kapacita '+cap);
    var action='';
    if(!past){
      if(pi.registrationUrl){
        action='<a class="btn primary" href="'+esc2(pi.registrationUrl)+'" target="_blank" rel="noopener noreferrer">REGISTRACE ↗</a>';
      }else{
        var lp=linkedPlayer();
        var already=lp&&regs.some(function(r){return String(r.playerId||'')===String(lp.id)});
        action=already
          ? '<button class="btn" disabled>✓ REGISTROVÁN</button>'
          : '<button class="btn primary tournament-register-btn" data-tid="'+esc2(t.id)+'">'+(lp?'REGISTROVAT SE':'PŘIHLÁSIT SE PRO REGISTRACI')+'</button>';
      }
    }
    return '<article class="tournament-public-card '+(past?'past':'')+'">'+
      '<div class="tournament-public-card-head"><div><h3>'+esc2(t.name||'Turnaj')+'</h3><div class="tournament-reg-count">'+regs.length+(cap?' / '+cap:'')+' registrovaných</div></div>'+
      '<div class="tournament-public-date">'+esc2(fmtDate(pi.date))+(pi.time?' · '+esc2(pi.time):'')+'</div></div>'+
      '<div class="tournament-public-meta">'+meta.map(function(x){return '<span>'+x+'</span>'}).join('')+'</div>'+
      (pi.description?'<div class="tournament-public-description">'+esc2(pi.description)+'</div>':'')+
      (pi.prizes?'<div style="margin-top:9px;color:#d8c27f;font-size:12px"><strong>Výhry:</strong> '+esc2(pi.prizes)+'</div>':'')+
      (pi.contact?'<div class="muted" style="margin-top:7px;font-size:12px">Kontakt: '+esc2(pi.contact)+'</div>':'')+
      '<div class="tournament-public-actions">'+
        '<button class="btn tournament-open-detail-btn" data-tid="'+esc2(t.id)+'">DETAIL / VÝSLEDKY</button>'+action+
      '</div></article>';
  }
  window.renderTournamentCalendar=function(){
    var up=q('tournamentUpcomingList'),past=q('tournamentPastList');
    if(!up||!past)return;
    var arr=(data&&Array.isArray(data.tournaments)?data.tournaments:[]).slice();
    arr.sort(function(a,b){
      var ad=String(a?.publicInfo?.date||'9999-12-31'),bd=String(b?.publicInfo?.date||'9999-12-31');
      return ad.localeCompare(bd);
    });
    var upcoming=arr.filter(function(t){return !tournamentFinished(t)});
    var done=arr.filter(tournamentFinished).reverse();
    up.innerHTML=upcoming.length?upcoming.map(function(t){return card(t,false)}).join(''):'<div class="tournament-calendar-empty">Zatím nejsou zveřejněné žádné nadcházející turnaje.</div>';
    past.innerHTML=done.length?done.map(function(t){return card(t,true)}).join(''):'<div class="tournament-calendar-empty">Zatím zde nejsou žádné proběhlé turnaje.</div>';

    document.querySelectorAll('.tournament-open-detail-btn').forEach(function(btn){
      btn.onclick=function(){
        var id=this.getAttribute('data-tid');
        try{openTournamentDetail(id)}catch(e){console.warn(e)}
      };
    });
    document.querySelectorAll('.tournament-register-btn').forEach(function(btn){
      btn.onclick=async function(){
        var tid=this.getAttribute('data-tid');
        var t=(data.tournaments||[]).find(function(x){return x.id===tid});
        if(!t)return;
        var p=linkedPlayer();
        if(!p){
          try{toast('Pro registraci se přihlas účtem propojeným s hráčským profilem.')}catch(e){}
          return;
        }
        if(!Array.isArray(t.registrations))t.registrations=[];
        if(t.registrations.some(function(r){return String(r.playerId||'')===String(p.id)}))return;
        var cap=Number(t.publicInfo?.capacity||0);
        if(cap&&t.registrations.length>=cap){
          try{toast('Kapacita turnaje je již naplněna.')}catch(e){}
          return;
        }
        t.registrations.push({playerId:p.id,name:p.name||p.nickname||'Hráč',uid:cloudUid||'',registeredAt:new Date().toISOString()});
        try{
          await saveSecureTournament(t);
          renderTournamentCalendar();
          toast('Na turnaj jsi byl zaregistrován.');
        }catch(e){
          console.error(e);
          toast('Registraci se nepodařilo uložit.');
        }
      };
    });
  };

  function showHub(){
    q('tournamentHubPanel')?.classList.remove('hidden');
    q('tournamentCalendarPanel')?.classList.add('hidden');
    q('tournamentWorkPanel')?.classList.add('hidden');
    q('tournamentSeriesPanel')?.classList.add('hidden');
    q('tournamentCreatePanel')?.classList.remove('hidden');
  }
  function showWork(showCreation=true){
    q('tournamentHubPanel')?.classList.add('hidden');
    q('tournamentCalendarPanel')?.classList.add('hidden');
    q('tournamentWorkPanel')?.classList.remove('hidden');
    q('tournamentSeriesPanel')?.classList.add('hidden');
    // Návrat po výsledku ukáže nejprve uložené turnaje, ne formulář.
    q('tournamentCreatePanel')?.classList.toggle('hidden',!showCreation);
    try{window.poolTestRefreshTournamentOverview?.();}catch(e){console.warn(e);}
  }
  window.poolTestShowTournamentList=()=>showWork(false);
  function showCalendar(){
    q('tournamentHubPanel')?.classList.add('hidden');
    q('tournamentWorkPanel')?.classList.add('hidden');
    q('tournamentCalendarPanel')?.classList.remove('hidden');
    try{renderTournamentCalendar()}catch(e){console.warn(e)}
  }

  document.addEventListener('DOMContentLoaded',function(){
    q('tournamentHubCreateBtn')?.addEventListener('click',()=>showWork(true));
    q('poolTestNewTournamentBtn')?.addEventListener('click',function(){
      const panel=q('tournamentCreatePanel');
      if(!panel)return;
      panel.classList.toggle('hidden');
      if(!panel.classList.contains('hidden'))panel.scrollIntoView({behavior:'smooth',block:'start'});
    });
    q('tournamentHubCalendarBtn')?.addEventListener('click',showCalendar);
    q('tournamentCalendarBackBtn')?.addEventListener('click',showHub);
    q('tournamentHubBackBtn')?.addEventListener('click',showHub);

    var series=q('tournamentSeriesTabBtn');
    if(series)series.addEventListener('click',function(){
      q('tournamentHubPanel')?.classList.add('hidden');
      q('tournamentCalendarPanel')?.classList.add('hidden');
      q('tournamentWorkPanel')?.classList.remove('hidden');
      q('tournamentCreatePanel')?.classList.add('hidden');
      q('tournamentSeriesPanel')?.classList.remove('hidden');
      try{renderSeriesList()}catch(e){}
    });

    document.querySelectorAll('[data-nav="tournament"]').forEach(function(btn){
      btn.addEventListener('click',function(){setTimeout(()=>showWork(false),0)},true);
    });
    showHub();
  });
})();
