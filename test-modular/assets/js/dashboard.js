
(function(){
  document.body.classList.add('modern-test');

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(m){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];
    });
  }

  function snapshot(){
    try{
      return typeof window.getModernDashboardSnapshot==='function'
        ? window.getModernDashboardSnapshot()
        : null;
    }catch(e){
      console.error('Dashboard snapshot:',e);
      return null;
    }
  }

  window.renderModernHome=function(){
    var s=snapshot();
    var recent=document.getElementById('modernRecentMatches');
    var top=document.getElementById('modernTopPlayers');
    var stats=document.getElementById('modernClubStats');
    var resume=document.getElementById('modernResumeTile');
    var adminTile=document.getElementById('modernAdminTile');

    if(!s){
      if(top)top.innerHTML='<div class="muted">Žebříček není dostupný.</div>';
      if(recent)recent.innerHTML='<div class="muted">Poslední zápasy nejsou dostupné.</div>';
      return;
    }

    if(resume){
      var hasActiveMatch=!!s.activeMatch;
      resume.style.opacity=hasActiveMatch?1:.52;
      resume.disabled=!hasActiveMatch;
      resume.setAttribute('aria-disabled',hasActiveMatch?'false':'true');
      resume.classList.toggle('is-disabled',!hasActiveMatch);
      var sm=resume.querySelector('small');
      if(sm)sm.textContent=hasActiveMatch
        ? 'Vrátit se ke skóre '+s.activeMatch.score1+':'+s.activeMatch.score2
        : 'Momentálně není rozehraný zápas';
    }

    if(adminTile)adminTile.classList.toggle('hidden',!s.isSystemAdmin);

    if(top){
      var players=(s.players||[]).slice(0,5);
      if(players.length){
        top.innerHTML=players.map(function(p,i){
          return '<div class="modern-rank-row" role="button" tabindex="0" data-modern-player-id="'+esc(p.id)+'">'+
            '<div class="modern-rank-no">'+(i+1)+'</div>'+
            '<div><div>'+esc(p.name)+'</div><div class="muted" style="font-size:10px">'+p.matches+' zápasů • '+p.wins+' výher</div></div>'+
            '<div class="modern-rank-points">'+Math.round(p.elo)+' ELO</div>'+
          '</div>';
        }).join('');
        top.querySelectorAll('[data-modern-player-id]').forEach(function(el){
          el.addEventListener('click',function(){
            if(typeof window.openModernDashboardPlayer==='function'){
              window.openModernDashboardPlayer(this.getAttribute('data-modern-player-id'));
            }
          });
        });
      }else{
        top.innerHTML=s.cloudAuthenticated
          ? '<div class="muted">V cloudu nejsou dostupní žádní aktivní hráči.</div>'
          : '<div class="muted">Přihlas se do cloudu pro zobrazení žebříčku.</div>';
      }
    }

    if(recent){
      var matches=s.recentMatches||[];
      if(matches.length){
        recent.innerHTML=matches.map(function(m){
          return '<div class="modern-list-row" role="button" tabindex="0" data-modern-match-id="'+esc(m.id)+'">'+
            '<div>'+esc(m.p1)+'</div>'+
            '<div class="modern-score">'+m.s1+' : '+m.s2+'</div>'+
            '<div class="r">'+esc(m.p2)+'</div>'+
          '</div>';
        }).join('');
        recent.querySelectorAll('[data-modern-match-id]').forEach(function(el){
          el.addEventListener('click',function(){
            if(typeof window.openModernDashboardMatch==='function'){
              window.openModernDashboardMatch(this.getAttribute('data-modern-match-id'));
            }
          });
        });
      }else{
        recent.innerHTML=s.cloudAuthenticated
          ? '<div class="muted">Nejsou dostupné žádné dokončené zápasy.</div>'
          : '<div class="muted">Přihlas se do cloudu pro načtení posledních zápasů.</div>';
      }
    }

    if(stats){
      var x=s.stats||{};
      stats.innerHTML=
        '<div class="modern-stat"><b>'+Number(x.completedMatches||0)+'</b><span>Dokončených zápasů</span></div>'+
        '<div class="modern-stat"><b>'+Number(x.activePlayers||0)+'</b><span>Aktivních hráčů</span></div>'+
        '<div class="modern-stat"><b>'+Number(x.tournaments||0)+'</b><span>Turnajů v databázi</span></div>'+
        '<button type="button" class="modern-stat" id="onlineUsersTile" aria-label="Zobrazit aktivní hráče"><b><span class="presence-dot"></span><span id="onlineUsersCount">'+(document.getElementById('onlineUsersCount')?.textContent||'—')+'</span></b><span>Právě online · zobrazit hráče</span></button>';
    }
    try{if(typeof window.renderMatchChallengeHome==='function')window.renderMatchChallengeHome();}catch(e){}
  };

  window.refreshModernHomeData=async function(){
    try{
      if(typeof window.refreshModernDashboardCloud==='function'){
        await window.refreshModernDashboardCloud();
      }
    }catch(e){
      console.warn('Modern dashboard refresh:',e);
    }
    try{window.renderModernHome();}catch(e){}
  };

  var resume=document.getElementById('modernResumeTile');
  if(resume){
    resume.addEventListener('click',function(e){
      var s=snapshot();
      if(!s||!s.activeMatch){
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      var back=document.getElementById('backToMatchNav');
      if(back&&!back.classList.contains('hidden')){
        back.click();
        return;
      }
      if(typeof window.showScreen==='function'){
        try{ window.showScreen('match'); return; }catch(err){}
      }
    });
  }

  var brand=document.getElementById('modernHomeBrand');
  if(brand){
    var goHome=function(){
      var homeBtn=document.querySelector('header .nav button[data-nav="home"]');
      if(homeBtn)homeBtn.click();
    };
    brand.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();goHome();},true);
    brand.addEventListener('keydown',function(e){
      if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();goHome();}
    },true);
  }

  setTimeout(function(){window.renderModernHome();window.refreshModernHomeData();},150);
  setTimeout(function(){window.refreshModernHomeData();},1800);
})();
