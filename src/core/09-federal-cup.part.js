  function q(id){return document.getElementById(id)}
  function esc2(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]})}
  function nowIso(){return new Date().toISOString()}
  function myPlayer(){return currentUserPlayerId?data.players?.[currentUserPlayerId]:null}
  function playerNameById(id){var p=data.players?.[id];return p?playerSelectionLabel(p):'Hráč'}
  function currentUid(){return String(cloudUid||'')}
  function isMine(ch){var u=currentUid();return !!u&&(ch.senderUid===u||ch.recipientUid===u)}
  function otherPlayerId(ch){return ch.senderUid===currentUid()?ch.recipientPlayerId:ch.senderPlayerId}
  function statusLabel(s){
    return {pending:'ČEKÁ NA ODPOVĚĎ',countered:'NAVRŽEN JINÝ TERMÍN',accepted:'DOMLUVENO',declined:'ODMÍTNUTO',cancelled:'ZRUŠENO',played:'ODEHRÁNO'}[s]||String(s||'');
  }
  function formatDate(ch){
    if(ch.flexibleTime)return 'Termín domluvíme později';
    if(!ch.date)return 'Termín neuveden';
    var d=new Date(ch.date+'T12:00:00');
    var txt=isNaN(d)?ch.date:d.toLocaleDateString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric'});
    return txt+(ch.time?' · '+ch.time:'');
  }
  function cacheSave(){
    try{localStorage.setItem(LOCAL_KEY,JSON.stringify(cache.filter(isMine)));}catch(e){}
  }
  function cacheLoad(){
    try{
      var x=JSON.parse(localStorage.getItem(LOCAL_KEY)||'[]');
      if(Array.isArray(x))cache=x.filter(Boolean);
    }catch(e){}
  }

  function challengeObjects(obj){
    return obj&&typeof obj==='object'&&!Array.isArray(obj)?Object.values(obj).filter(Boolean):[];
  }

  function mergedChallenge(base,response){
    var b=JSON.parse(JSON.stringify(base||{}));
    if(!response)return b;
    var bt=new Date(b.updatedAt||b.createdAt||0).getTime()||0;
    var rt=new Date(response.updatedAt||0).getTime()||0;
    if(rt<bt)return b;
    ['status','flexibleTime','date','time','venue','note','counterByUid','acceptedAt','playedMatchId','playedAt'].forEach(function(k){
      if(response[k]!==undefined)b[k]=response[k];
    });
    b.responseUpdatedAt=response.updatedAt||'';
    return b;
  }

  function allChallengesFromPlayers(){
    var rows=[];
    Object.values(data.players||{}).forEach(function(sender){
      challengeObjects(sender?.matchChallengesSent).forEach(function(base){
        if(!base||!base.id)return;
        var recipient=data.players?.[base.recipientPlayerId];
        var response=recipient?.matchChallengeResponses?.[base.id]||null;
        rows.push(mergedChallenge(base,response));
      });
    });
    return rows;
  }

  function rebuildFromPlayers(){
    var mineId=String(currentUserPlayerId||'');
    var mineUid=currentUid();
    var rows=allChallengesFromPlayers().filter(function(ch){
      return String(ch.senderUid||'')===mineUid || String(ch.recipientUid||'')===mineUid ||
        String(ch.senderPlayerId||'')===mineId || String(ch.recipientPlayerId||'')===mineId;
    });
    rows.sort(function(a,b){return new Date(b.updatedAt||b.responseUpdatedAt||b.createdAt||0)-new Date(a.updatedAt||a.responseUpdatedAt||a.createdAt||0)});
    cache=rows;
    cacheSave();
    return cache;
  }

  async function load(force){
    cacheLoad();
    if(!cloudAuthenticated||!cloudUid){
      render();renderHome();return cache;
    }
    try{
      if(force)await loadSecurePlayers();
      rebuildFromPlayers();
    }catch(e){
      console.warn('Match challenges load:',e);
    }
    render();renderHome();
    return cache;
  }

  function linkedOpponents(){
    var mine=myPlayer();
    return Object.values(data.players||{}).filter(function(p){
      return p&&p.active!==false&&p.hiddenFromPlayers!==true&&p.ownerUid&&mine&&p.id!==mine.id&&String(p.ownerUid)!==String(cloudUid);
    }).sort(function(a,b){return playerSelectionLabel(a).localeCompare(playerSelectionLabel(b),'cs')});
  }

  function populateOpponents(selected){
    var sel=q('matchChallengeOpponent');if(!sel)return;
    var arr=linkedOpponents();
    sel.innerHTML='<option value="">— vyber soupeře —</option>'+arr.map(function(p){
      return '<option value="'+esc2(p.id)+'" '+(selected===p.id?'selected':'')+'>'+esc2(playerSelectionLabel(p))+'</option>';
    }).join('');
    var help=q('matchChallengeOpponentHelp');
    if(help)help.textContent=arr.length?'Zobrazují se pouze hráči s propojeným účtem.':'Zatím není k dispozici žádný další hráč s propojeným účtem.';
  }

  function challengeCard(ch){
    var incoming=(ch.status==='pending'&&ch.recipientUid===currentUid()) ||
      (ch.status==='countered'&&ch.counterByUid&&ch.counterByUid!==currentUid()&&isMine(ch));
    var opponent=playerNameById(otherPlayerId(ch));
    var actions='';
    if(incoming){
      actions='<button class="btn primary" onclick="acceptMatchChallenge(\''+ch.id+'\')">PŘIJMOUT</button>'+
        '<button class="btn" onclick="counterMatchChallenge(\''+ch.id+'\')">JINÝ TERMÍN</button>'+
        '<button class="btn danger" onclick="declineMatchChallenge(\''+ch.id+'\')">ODMÍTNOUT</button>';
    }else if(ch.status==='accepted'){
      actions='<button class="btn primary" onclick="startScheduledMatch(\''+ch.id+'\')">▶ SPUSTIT ZÁPAS</button>'+
        '<button class="btn" onclick="counterMatchChallenge(\''+ch.id+'\')">ZMĚNIT TERMÍN</button>'+
        '<button class="btn danger" onclick="cancelMatchChallenge(\''+ch.id+'\')">ZRUŠIT</button>';
    }else if((ch.status==='pending'||ch.status==='countered')&&ch.senderUid===currentUid()){
      actions='<button class="btn" onclick="counterMatchChallenge(\''+ch.id+'\')">UPRAVIT NÁVRH</button>'+
        '<button class="btn danger" onclick="cancelMatchChallenge(\''+ch.id+'\')">ZRUŠIT VÝZVU</button>';
    }
    return '<div class="match-challenge-card '+(incoming?'incoming ':'')+(ch.status==='accepted'?'accepted':'')+'">'+
      '<div class="match-challenge-card-head"><div><div class="match-challenge-card-title">'+esc2(playerNameById(ch.senderPlayerId))+' × '+esc2(playerNameById(ch.recipientPlayerId))+'</div>'+
      '<div class="muted" style="margin-top:4px">'+esc2(formatDate(ch))+(ch.venue?' · '+esc2(ch.venue):'')+'</div></div>'+
      '<span class="match-challenge-status '+esc2(ch.status)+'">'+esc2(statusLabel(ch.status))+'</span></div>'+
      '<div class="match-challenge-meta"><span>'+esc2(String(ch.discipline||'').toUpperCase())+'</span><span>Race to '+Number(ch.raceTo||1)+'</span><span>'+(ch.isPublic?'VEŘEJNÝ':'SOUKROMÝ')+'</span></div>'+
      (ch.note?'<div style="margin-top:10px;line-height:1.45">'+esc2(ch.note)+'</div>':'')+
      (ch.counterByUid?'<div class="muted" style="margin-top:7px;font-size:11px">Poslední změnu termínu navrhl '+(ch.counterByUid===currentUid()?'ty':'soupeř')+'.</div>':'')+
      (actions?'<div class="match-challenge-actions">'+actions+'</div>':'')+
    '</div>';
  }

  function render(){
    var content=q('matchChallengesContent'),notice=q('matchChallengesLoginNotice');
    var ready=!!(cloudAuthenticated&&cloudUid&&currentUserPlayerId&&myPlayer());
    if(content)content.classList.toggle('hidden',!ready);
    if(notice)notice.classList.toggle('hidden',ready);
    if(!ready)return;
    populateOpponents(q('matchChallengeOpponent')?.value||'');

    var incoming=cache.filter(function(ch){
      return (ch.status==='pending'&&ch.recipientUid===currentUid()) ||
        (ch.status==='countered'&&ch.counterByUid&&ch.counterByUid!==currentUid()&&isMine(ch));
    });
    var accepted=cache.filter(function(ch){return ch.status==='accepted'}).sort(function(a,b){
      return String(a.date||'9999-12-31').localeCompare(String(b.date||'9999-12-31'))||String(a.time||'').localeCompare(String(b.time||''));
    });
    var other=cache.filter(function(ch){return !incoming.includes(ch)&&!accepted.includes(ch)});
    var sum=q('matchChallengeSummary');
    if(sum)sum.innerHTML=
      '<div class="match-challenge-stat"><strong>'+incoming.length+'</strong><span>Čeká na tebe</span></div>'+
      '<div class="match-challenge-stat"><strong>'+accepted.length+'</strong><span>Domluveno</span></div>'+
      '<div class="match-challenge-stat"><strong>'+cache.filter(function(x){
        return x.senderUid===currentUid() && (x.status==='pending'||(x.status==='countered'&&x.counterByUid===currentUid()));
      }).length+'</strong><span>Čeká na soupeře</span></div>';
    if(q('matchChallengeIncomingCount'))q('matchChallengeIncomingCount').textContent=String(incoming.length);
    if(q('matchChallengeIncomingList'))q('matchChallengeIncomingList').innerHTML=incoming.length?incoming.map(challengeCard).join(''):'<div class="empty">Žádná nová výzva.</div>';
    if(q('matchChallengeAcceptedList'))q('matchChallengeAcceptedList').innerHTML=accepted.length?accepted.map(challengeCard).join(''):'<div class="empty">Nemáš žádný domluvený zápas.</div>';
    if(q('matchChallengeOtherList'))q('matchChallengeOtherList').innerHTML=other.length?other.map(challengeCard).join(''):'<div class="empty">Žádné další výzvy.</div>';
  }

  function nextAccepted(){
    var rows=cache.filter(function(ch){return ch.status==='accepted'});
    rows.sort(function(a,b){
      var ax=a.flexibleTime?'9999-12-31T23:59':String(a.date||'9999-12-31')+'T'+String(a.time||'23:59');
      var bx=b.flexibleTime?'9999-12-31T23:59':String(b.date||'9999-12-31')+'T'+String(b.time||'23:59');
      return ax.localeCompare(bx);
    });
    return rows[0]||null;
  }

  function publicUpcomingChallenges(){
    if(!cloudAuthenticated)return [];
    var now=Date.now();
    return allChallengesFromPlayers().filter(function(ch){
      if(!ch||ch.status!=='accepted'||ch.isPublic!==true)return false;
      if(ch.flexibleTime||!ch.date)return true;
      var ts=new Date(ch.date+'T'+(ch.time||'23:59')).getTime();
      return !Number.isFinite(ts)||ts>=now-(6*60*60*1000);
    }).sort(function(a,b){
      var ax=a.flexibleTime?'9999-12-31T23:59':String(a.date||'9999-12-31')+'T'+String(a.time||'23:59');
      var bx=b.flexibleTime?'9999-12-31T23:59':String(b.date||'9999-12-31')+'T'+String(b.time||'23:59');
      return ax.localeCompare(bx);
    });
  }

  function publicProgramRow(ch,own){
    return '<div class="modern-scheduled-program-row">'+
      '<div><strong>'+esc2(playerNameById(ch.senderPlayerId))+' × '+esc2(playerNameById(ch.recipientPlayerId))+'</strong>'+
      '<span>'+esc2(String(ch.discipline||'').toUpperCase())+' · Race to '+Number(ch.raceTo||1)+'</span></div>'+
      '<div><strong>'+esc2(formatDate(ch))+'</strong><span>'+esc2(ch.venue||'Místo neuvedeno')+'</span></div>'+
      (own?'<button class="btn primary" type="button" onclick="startScheduledMatch(\''+ch.id+'\')">▶ SPUSTIT</button>':'')+
    '</div>';
  }

  function renderHome(){
    var tileText=q('modernChallengeTileText'),badge=q('modernChallengeBadge'),panel=q('modernScheduledMatchPanel'),body=q('modernScheduledMatchBody'),title=q('modernScheduledMatchTitle');
    var incoming=cache.filter(function(ch){
      return (ch.status==='pending'&&ch.recipientUid===currentUid()) ||
        (ch.status==='countered'&&ch.counterByUid&&ch.counterByUid!==currentUid()&&isMine(ch));
    }).length;
    if(badge){badge.textContent=String(incoming);badge.classList.toggle('hidden',!incoming);}
    if(tileText){
      if(incoming)tileText.textContent=incoming===1?'1 nová příchozí výzva':incoming+' nové příchozí výzvy';
      else{
        var acceptedCount=cache.filter(function(ch){return ch.status==='accepted'}).length;
        tileText.textContent=acceptedCount?(acceptedCount===1?'1 domluvený zápas':acceptedCount+' domluvené zápasy'):'Výzvy a domluvené zápasy';
      }
    }

    var own=nextAccepted();
    var pub=publicUpcomingChallenges().slice(0,4);
    if(!panel)return;

    /* Tento blok zůstává na homepage viditelný vždy.
       I bez domluveného zápasu tak nový uživatel okamžitě vidí,
       že Poolčítadlo umí výzvy a plánování zápasů. */
    panel.classList.remove('hidden');

    if(own){
      if(title)title.textContent='Tvůj nejbližší domluvený zápas';
      var rest=pub.filter(function(x){return x.id!==own.id}).slice(0,3);
      if(body)body.innerHTML=publicProgramRow(own,true)+(rest.length?'<div class="modern-scheduled-program-label">DALŠÍ VEŘEJNĚ DOMLUVENÉ ZÁPASY</div>'+rest.map(function(x){return publicProgramRow(x,false)}).join(''):'');
    }else if(pub.length){
      if(title)title.textContent='Nadcházející domluvené zápasy';
      if(body)body.innerHTML=pub.map(function(x){return publicProgramRow(x,false)}).join('');
    }else{
      if(title)title.textContent='Nadcházející domluvené zápasy';
      if(body)body.innerHTML=
        '<div class="modern-scheduled-empty">'+
          '<div class="modern-scheduled-empty-icon">⚔</div>'+
          '<div><strong>Domluv si zápas přímo v Poolčítadle</strong>'+
          '<span>Vyber soupeře, disciplínu, Race to a termín. Soupeř může výzvu přijmout nebo navrhnout jiný čas.</span></div>'+
          '<button type="button" class="btn primary" data-nav="challenges">DOMLUVIT ZÁPAS</button>'+
        '</div>';
    }
    try{renderNotificationCenter();}catch(e){}
  }

  async function persist(ch){
    if(!ch||!ch.id)throw new Error('CHALLENGE_INVALID');
    var me=myPlayer();
    if(!me||!currentUid())throw new Error('NO_LINKED_PLAYER');
    var stamp=nowIso();

    if(ch.senderUid===currentUid()){
      me.matchChallengesSent=(me.matchChallengesSent&&typeof me.matchChallengesSent==='object'&&!Array.isArray(me.matchChallengesSent))?me.matchChallengesSent:{};
      var copy=JSON.parse(JSON.stringify(ch));
      copy.updatedAt=stamp;
      delete copy.responseUpdatedAt;
      me.matchChallengesSent[ch.id]=copy;
    }else if(ch.recipientUid===currentUid()){
      me.matchChallengeResponses=(me.matchChallengeResponses&&typeof me.matchChallengeResponses==='object'&&!Array.isArray(me.matchChallengeResponses))?me.matchChallengeResponses:{};
      me.matchChallengeResponses[ch.id]={
        id:ch.id,status:ch.status,flexibleTime:!!ch.flexibleTime,date:ch.date||'',time:ch.time||'',
        venue:ch.venue||'',note:ch.note||'',counterByUid:ch.counterByUid||'',acceptedAt:ch.acceptedAt||'',
        playedMatchId:ch.playedMatchId||'',playedAt:ch.playedAt||'',updatedAt:stamp
      };
    }else{
      throw new Error('NOT_PARTICIPANT');
    }

    await saveSecurePlayer(me);
    rebuildFromPlayers();
    render();renderHome();
    try{window.renderModernHome&&window.renderModernHome()}catch(e){}
    return cache.find(function(x){return x.id===ch.id})||ch;
  }

  window.sendMatchChallenge=async function(){
    var mine=myPlayer(),opId=q('matchChallengeOpponent')?.value||'',op=data.players?.[opId];
    if(!mine||!cloudUid){toast('Nejdřív se přihlas účtem propojeným s hráčským profilem.');return;}
    if(!op||!op.ownerUid){toast('Vyber hráče s propojeným účtem.');return;}
    var flexible=!!q('matchChallengeFlexibleTime')?.checked;
    var date=String(q('matchChallengeDate')?.value||''),time=String(q('matchChallengeTime')?.value||'');
    if(!flexible&&!date){toast('Vyber datum, nebo zapni „Termín domluvíme později“.');return;}
    var btn=q('matchChallengeSendBtn');if(btn)btn.disabled=true;
    try{
      var ch={
        id:'challenge_'+(crypto?.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2)),
        senderUid:String(cloudUid),senderPlayerId:mine.id,
        recipientUid:String(op.ownerUid),recipientPlayerId:op.id,
        discipline:q('matchChallengeDiscipline')?.value||'9-ball',
        raceTo:Math.max(1,Math.floor(Number(q('matchChallengeRaceTo')?.value||7))),
        flexibleTime:flexible,date:flexible?'':date,time:flexible?'':time,
        venue:String(q('matchChallengeVenue')?.value||'').trim(),
        note:String(q('matchChallengeNote')?.value||'').trim(),
        isPublic:!!q('matchChallengePublic')?.checked,
        status:'pending',createdAt:nowIso(),updatedAt:nowIso(),acceptedAt:'',playedMatchId:''
      };
      await persist(ch);
      q('matchChallengeNote').value='';
      if(q('matchChallengeSaveInfo'))q('matchChallengeSaveInfo').textContent='Výzva byla odeslána hráči '+playerSelectionLabel(op)+'.';
      toast('Výzva k zápasu byla odeslána.');
    }catch(e){
      console.error(e);
      var msg=String(e?.message||e);
      toast(msg.includes('401')||msg.includes('403')?'Nemáš oprávnění uložit výzvu do svého profilu. Zkus se znovu přihlásit.':'Výzvu se nepodařilo uložit.');
    }finally{if(btn)btn.disabled=false;}
  };

  function canAnswerChallenge(ch){
    if(!ch||!isMine(ch))return false;
    if(ch.status==='pending')return ch.recipientUid===currentUid();
    if(ch.status==='countered')return !!ch.counterByUid&&ch.counterByUid!==currentUid();
    return false;
  }
  window.acceptMatchChallenge=async function(id){
    var ch=cache.find(function(x){return x.id===id});if(!canAnswerChallenge(ch))return;
    ch.status='accepted';ch.acceptedAt=nowIso();ch.counterByUid='';
    try{await persist(ch);toast('Zápas je domluvený.');}catch(e){console.error(e);toast('Výzvu se nepodařilo přijmout.');}
  };
  window.declineMatchChallenge=async function(id){
    var ch=cache.find(function(x){return x.id===id});if(!canAnswerChallenge(ch))return;
    ch.status='declined';
    try{await persist(ch);toast('Výzva byla odmítnuta.');}catch(e){console.error(e);toast('Změnu se nepodařilo uložit.');}
  };
  window.cancelMatchChallenge=async function(id){
    var ch=cache.find(function(x){return x.id===id});if(!ch||!isMine(ch))return;
    if(!confirm('Opravdu tuto domluvu zrušit?'))return;
    ch.status='cancelled';
    try{await persist(ch);toast('Domluva byla zrušena.');}catch(e){toast('Změnu se nepodařilo uložit.');}
  };
  window.counterMatchChallenge=function(id){
    var ch=cache.find(function(x){return x.id===id});if(!ch||!isMine(ch))return;
    counterChallengeId=id;
    q('matchChallengeCounterTitle').textContent=playerNameById(ch.senderPlayerId)+' × '+playerNameById(ch.recipientPlayerId);
    q('matchChallengeCounterFlexible').checked=!!ch.flexibleTime;
    q('matchChallengeCounterDate').value=ch.date||'';
    q('matchChallengeCounterTime').value=ch.time||'';
    q('matchChallengeCounterVenue').value=ch.venue||'';
    q('matchChallengeCounterNote').value='';
    q('matchChallengeCounterDateTime').classList.toggle('hidden',!!ch.flexibleTime);
    q('matchChallengeCounterModal').classList.add('show');
  };
  window.saveMatchChallengeCounter=async function(){
    var ch=cache.find(function(x){return x.id===counterChallengeId});if(!ch)return;
    var flexible=!!q('matchChallengeCounterFlexible').checked;
    var date=String(q('matchChallengeCounterDate').value||''),time=String(q('matchChallengeCounterTime').value||'');
    if(!flexible&&!date){toast('Zadej datum, nebo zvol domluvu termínu později.');return;}
    ch.flexibleTime=flexible;ch.date=flexible?'':date;ch.time=flexible?'':time;ch.venue=String(q('matchChallengeCounterVenue').value||'').trim();
    var note=String(q('matchChallengeCounterNote').value||'').trim();if(note)ch.note=note;
    ch.status='countered';ch.counterByUid=currentUid();ch.acceptedAt='';
    try{await persist(ch);q('matchChallengeCounterModal').classList.remove('show');counterChallengeId=null;toast('Nový termín byl odeslán.');}catch(e){toast('Nový návrh se nepodařilo uložit.');}
  };

  window.startScheduledMatch=function(id){
    var ch=cache.find(function(x){return x.id===id});if(!ch||ch.status!=='accepted'||!isMine(ch))return;
    var me=myPlayer(),opp=data.players?.[otherPlayerId(ch)];
    if(!me||!opp){toast('Hráčský profil se nepodařilo načíst.');return;}
    window.pendingScheduledChallenge=JSON.parse(JSON.stringify(ch));
    q('p1Name').value=me.name||playerDisplayName(me);
    q('p2Name').value=opp.name||playerDisplayName(opp);
    q('discipline').value=ch.discipline||'9-ball';
    q('raceTo').value=String(Math.max(1,Number(ch.raceTo||7)));
    if(q('streamMatchTitle'))q('streamMatchTitle').value='Domluvený zápas • '+playerDisplayName(me)+' × '+playerDisplayName(opp);
    q('discipline').dispatchEvent(new Event('change',{bubbles:true}));
    showScreen('setup');
    toast('Zápas je předvyplněný. Zkontroluj nastavení a zahaj ho.');
  };

  window.completeScheduledChallengeForMatch=async function(m){
    if(!m?.scheduledChallengeId||!m?.endedAt)return;
    var ch=cache.find(function(x){return x.id===m.scheduledChallengeId});
    if(!ch||ch.status==='played')return;
    ch.status='played';ch.playedMatchId=m.id;ch.playedAt=m.endedAt||nowIso();
    try{await persist(ch);}catch(e){console.warn('Complete challenge:',e);}
  };

  const NOTIFICATION_READ_KEY='poolcitadlo_notification_read_v1';

  function notificationReadMap(){
    var uid=currentUid();
    if(!uid)return {};
    try{
      var all=JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY)||'{}');
      return (all&&typeof all==='object'&&all[uid]&&typeof all[uid]==='object')?all[uid]:{};
    }catch(e){return {};}
  }

  function saveNotificationReadMap(map){
    var uid=currentUid();
    if(!uid)return;
    try{
      var all=JSON.parse(localStorage.getItem(NOTIFICATION_READ_KEY)||'{}');
      if(!all||typeof all!=='object'||Array.isArray(all))all={};
      all[uid]=map||{};
      localStorage.setItem(NOTIFICATION_READ_KEY,JSON.stringify(all));
    }catch(e){}
  }

  function notificationEventKey(ch,type){
    var stamp=ch.responseUpdatedAt||ch.updatedAt||ch.acceptedAt||ch.createdAt||'';
    return [ch.id,type,stamp].join('|');
  }

  function notificationEvents(){
    if(!cloudAuthenticated||!currentUid())return [];
    var me=currentUid(),rows=[];
    cache.forEach(function(ch){
      if(!ch||!isMine(ch))return;
      var opponent=playerNameById(otherPlayerId(ch));
      var meta=String(ch.discipline||'').toUpperCase()+' · Race to '+Number(ch.raceTo||1)+(ch.date||ch.flexibleTime?' · '+formatDate(ch):'');

      if(ch.status==='pending'&&ch.recipientUid===me){
        rows.push({
          key:notificationEventKey(ch,'challenge_pending'),challengeId:ch.id,
          title:opponent+' tě vyzval k zápasu',meta:meta,
          ts:ch.updatedAt||ch.createdAt||''
        });
        return;
      }

      if(ch.status==='countered'&&ch.counterByUid&&ch.counterByUid!==me){
        rows.push({
          key:notificationEventKey(ch,'challenge_counter'),challengeId:ch.id,
          title:opponent+' navrhl jiný termín',meta:meta,
          ts:ch.responseUpdatedAt||ch.updatedAt||''
        });
        return;
      }

      if(ch.status==='accepted'&&ch.senderUid===me){
        rows.push({
          key:notificationEventKey(ch,'challenge_accepted'),challengeId:ch.id,
          title:opponent+' přijal výzvu k zápasu',meta:meta,
          ts:ch.acceptedAt||ch.responseUpdatedAt||ch.updatedAt||''
        });
        return;
      }

      if(ch.status==='declined'&&ch.senderUid===me){
        rows.push({
          key:notificationEventKey(ch,'challenge_declined'),challengeId:ch.id,
          title:opponent+' odmítl tvoji výzvu',meta:meta,
          ts:ch.responseUpdatedAt||ch.updatedAt||''
        });
      }
    });
    rows.sort(function(a,b){return new Date(b.ts||0)-new Date(a.ts||0)});
    return rows.slice(0,30);
  }

  function renderNotificationCenter(){
    var bell=q('notificationBellBtn'),count=q('notificationCount'),list=q('notificationList');
    if(!bell||!count||!list)return;
    if(!cloudAuthenticated||!currentUid()){
      count.classList.add('hidden');count.textContent='0';bell.classList.remove('has-unread');
      list.innerHTML='<div class="notification-empty">Po přihlášení se zde zobrazí upozornění.</div>';
      return;
    }
    var read=notificationReadMap(),events=notificationEvents();
    var unread=events.filter(function(n){return !read[n.key]}).length;
    count.textContent=unread>99?'99+':String(unread);
    count.classList.toggle('hidden',!unread);
    bell.classList.toggle('has-unread',!!unread);
    list.innerHTML=events.length?events.map(function(n){
      return '<button type="button" class="notification-item '+(!read[n.key]?'unread':'')+'" data-notification-key="'+esc2(n.key)+'" data-challenge-id="'+esc2(n.challengeId)+'">'+
        '<div class="notification-item-title">'+esc2(n.title)+'</div>'+
        '<div class="notification-item-meta">'+esc2(n.meta)+'</div>'+
      '</button>';
    }).join(''):'<div class="notification-empty">Nemáš žádná upozornění.</div>';

    list.querySelectorAll('[data-notification-key]').forEach(function(el){
      el.addEventListener('click',function(){
        var map=notificationReadMap();
        map[this.dataset.notificationKey]=Date.now();
        saveNotificationReadMap(map);
        renderNotificationCenter();
        q('notificationPanel')?.classList.add('hidden');
        q('notificationBellBtn')?.setAttribute('aria-expanded','false');
        showScreen('challenges');
        setTimeout(function(){
          var target=q('matchChallengeIncomingList')||q('matchChallengesContent');
          target?.scrollIntoView({behavior:'smooth',block:'start'});
        },100);
      });
    });
  }

  function markAllNotificationsRead(){
    var map=notificationReadMap();
    notificationEvents().forEach(function(n){map[n.key]=Date.now()});
    saveNotificationReadMap(map);
    renderNotificationCenter();
  }

  window.renderNotificationCenter=renderNotificationCenter;

  q('notificationBellBtn')?.addEventListener('click',function(e){
    e.stopPropagation();
    var panel=q('notificationPanel');
    if(!panel)return;
    var opening=panel.classList.contains('hidden');
    panel.classList.toggle('hidden',!opening);
    this.setAttribute('aria-expanded',opening?'true':'false');
    if(opening)renderNotificationCenter();
  });
  q('notificationPanel')?.addEventListener('click',function(e){e.stopPropagation()});
  q('notificationMarkAllBtn')?.addEventListener('click',function(){markAllNotificationsRead()});
  document.addEventListener('click',function(){
    q('notificationPanel')?.classList.add('hidden');
    q('notificationBellBtn')?.setAttribute('aria-expanded','false');
  });

  window.openMatchChallengesScreen=function(){
    render();
    populateOpponents();
    load(true);
  };
  window.refreshMatchChallenges=function(force){return load(!!force)};
  window.renderMatchChallengeHome=renderHome;
  window.openChallengeForPlayer=function(playerId){
    var p=data.players?.[playerId];
    if(!p||!p.ownerUid){toast('Tento hráč nemá propojený účet.');return;}
    if(String(playerId)===String(currentUserPlayerId)){toast('Nemůžeš vyzvat sám sebe.');return;}
    q('profileModal')?.classList.remove('show');
    showScreen('challenges');
    setTimeout(function(){populateOpponents(playerId);q('matchChallengeOpponent').value=playerId;},0);
  };

  q('matchChallengeSendBtn')?.addEventListener('click',window.sendMatchChallenge);
  q('matchChallengesRefreshBtn')?.addEventListener('click',function(){load(true)});
  q('matchChallengeFlexibleTime')?.addEventListener('change',function(){q('matchChallengeDateTimeFields')?.classList.toggle('hidden',this.checked)});
  q('matchChallengeCounterFlexible')?.addEventListener('change',function(){q('matchChallengeCounterDateTime')?.classList.toggle('hidden',this.checked)});
  q('matchChallengeCounterCancel')?.addEventListener('click',function(){q('matchChallengeCounterModal')?.classList.remove('show');counterChallengeId=null});
  q('matchChallengeCounterSave')?.addEventListener('click',window.saveMatchChallengeCounter);
  q('profileChallengeBtn')?.addEventListener('click',function(){window.openChallengeForPlayer(this.dataset.playerId||'')});

  window.poolPresenceContext=async function(){
    if(!cloudAuthenticated||!cloudUid||!await ensureCloudToken())return null;
    const p=currentUserPlayerId&&data.players?.[currentUserPlayerId];
    return {uid:cloudUid,token:cloudIdToken,db:FIREBASE_DB,playerId:currentUserPlayerId||'',name:p?playerDisplayName(p):'Registrovaný uživatel',isAdminAccount:isMainAdminEmail(cloudUserEmail)||currentUserRole==='system_admin'};
  };
  cacheLoad();renderHome();renderNotificationCenter();
  setTimeout(function(){
    if(cloudAuthenticated)loadSecurePlayers().then(function(){load(false)}).catch(function(){load(false)});
    else load(false);
  },1200);
  setInterval(function(){if(!document.hidden&&cloudAuthenticated)load(false)},30000);
})();

// === FEDERAL CUP 2026 ========================================================
(function(){
  const FIXTURES=[
    {n:1,b:1,t:'team',label:'Team'},
    {n:2,b:1,t:'doubles',label:'Doubles',note:'libovolná dvojice'},
    {n:3,b:1,t:'singles',label:'Singles',note:'libovolný jednotlivec • nesmí nastoupit hráč ze zápasu 2'},
    {n:4,b:1,t:'doubles',label:'Doubles',note:'hráči, kteří nehráli zápasy 2 a 3'},
    {n:5,b:2,t:'team',label:'Team'},
    {n:6,b:2,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:7,b:2,t:'doubles',label:'Doubles',note:'libovolná dvojice'},
    {n:8,b:2,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:9,b:2,t:'doubles',label:'Doubles',note:'libovolná dvojice • v zápasech 7, 8 a 9 musí hrát každý hráč ze soupisky'},
    {n:10,b:3,t:'team',label:'Team'},
    {n:11,b:3,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:12,b:3,t:'doubles',label:'Doubles',note:'libovolná dvojice'},
    {n:13,b:3,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:14,b:3,t:'doubles',label:'Doubles',note:'libovolná dvojice • v zápasech 12, 13 a 14 musí hrát každý hráč ze soupisky'},
    {n:15,b:3,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:16,b:4,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:17,b:4,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:18,b:4,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:19,b:4,t:'singles',label:'Singles',note:'libovolný hráč'},
    {n:20,b:4,t:'singles',label:'Singles',note:'libovolný hráč • každý hráč musí odehrát jeden Singles v zápasech 16–20'},
    {n:21,b:4,t:'singles',label:'Singles',note:'výběr kapitána • může nastoupit jakýkoliv hráč ze soupisky'}
  ];

  function cfg(){
    const c=data.federalCup2026||(data.federalCup2026=defaultFederalCup2026());
    // Migruj dřívější ID hráčských profilů na samostatná jména jen po jejich načtení.
    if(c.rosterMode!=='manual'){
      const a=(c.rosterA||[]).slice(),b=(c.rosterB||[]).slice();
      const mappedA=a.map(v=>data.players?.[v]?.name||v);
      const mappedB=b.map(v=>data.players?.[v]?.name||v);
      const changed=a.some((v,i)=>v&&v!==mappedA[i])||b.some((v,i)=>v&&v!==mappedB[i]);
      if(changed){
        Object.values(c.lineups||{}).forEach(l=>{
          if(!l||typeof l!=='object')return;
          if(Array.isArray(l.a))l.a=l.a.map(v=>{const i=a.indexOf(v);return i>=0?mappedA[i]:v;});
          if(Array.isArray(l.b))l.b=l.b.map(v=>{const i=b.indexOf(v);return i>=0?mappedB[i]:v;});
        });
        c.rosterA=mappedA;c.rosterB=mappedB;
      }
      if(changed||![...a,...b].some(Boolean))c.rosterMode='manual';
    }
    // Federal Cup 2026: pořadí zemí je pevné, domácí vlevo.
    c.teamAName='Slovensko';
    c.teamBName='Česko';
    return c;
  }
  function canEdit(){ return currentUserIsSystemAdmin(); }
  function normalizedName(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function roster(side){return side==='a'?cfg().rosterA:cfg().rosterB;}
  function options(selected,side){
    return '<option value="">— vyber hráče ze soupisky —</option>'+roster(side).map(normalizedName).filter(Boolean).map(n=>
      '<option value="'+esc(n)+'" '+(String(selected||'')===n?'selected':'')+'>'+esc(n)+'</option>'
    ).join('');
  }
  function lineup(n){
    const x=cfg().lineups?.[n]||{};
    return {a:Array.isArray(x.a)?x.a:[],b:Array.isArray(x.b)?x.b:[]};
  }
  function requiredSlots(f){return f.t==='doubles'?2:(f.t==='singles'?1:0);}
  function pairKey(arr){ return (arr||[]).filter(Boolean).map(String).sort().join('|'); }
  function allChosen(arr,n){return Array.isArray(arr)&&arr.length>=n&&arr.slice(0,n).every(Boolean);}
  function uniqueRoster(side){
    const r=roster(side).map(normalizedName).filter(Boolean);
    return r.length===5&&new Set(r.map(x=>x.toLocaleLowerCase('cs'))).size===5;
  }

  function validateSideFixture(f,side){
    const l=lineup(f.n)[side],need=requiredSlots(f),r=roster(side).filter(Boolean);
    if(need && !allChosen(l,need))return {ok:false,msg:'Doplň sestavu.'};
    if(need && new Set(l.slice(0,need)).size!==need)return {ok:false,msg:'Stejný hráč nemůže být v jednom zápase dvakrát.'};
    if(need && l.slice(0,need).some(id=>!r.includes(id)))return {ok:false,msg:'Vybraný hráč není v soupisce týmu.'};

    if(f.t==='doubles'){
      const key=pairKey(l.slice(0,2));
      for(const other of FIXTURES.filter(x=>x.t==='doubles'&&x.n!==f.n)){
        const ol=lineup(other.n)[side];
        if(allChosen(ol,2)&&pairKey(ol.slice(0,2))===key)return {ok:false,msg:'Stejná dvojice už je nasazená v zápase '+other.n+'.'};
      }
    }
    if(f.n===3){
      const used=new Set(lineup(2)[side].slice(0,2).filter(Boolean));
      if(l[0]&&used.has(l[0]))return {ok:false,msg:'V zápase 3 nesmí nastoupit hráč ze zápasu 2.'};
    }
    if(f.n===4){
      const used=new Set([...lineup(2)[side].slice(0,2),...lineup(3)[side].slice(0,1)].filter(Boolean));
      if(l.slice(0,2).some(id=>used.has(id)))return {ok:false,msg:'Zápas 4 musí odehrát hráči, kteří nehráli zápasy 2 a 3.'};
    }

    const groups=[[7,8,9],[12,13,14],[16,17,18,19,20]];
    for(const nums of groups){
      if(!nums.includes(f.n))continue;
      const vals=[];
      nums.forEach(n=>vals.push(...lineup(n)[side].slice(0,requiredSlots(FIXTURES.find(x=>x.n===n))).filter(Boolean)));
      if(new Set(vals).size!==vals.length)return {ok:false,msg:'V této povinné skupině nesmí jeden hráč nastoupit dvakrát.'};
      const full=nums.every(n=>allChosen(lineup(n)[side],requiredSlots(FIXTURES.find(x=>x.n===n))));
      if(full && (vals.length!==5 || new Set(vals).size!==5))return {ok:false,msg:'V této skupině musí nastoupit všech 5 hráčů ze soupisky právě jednou.'};
    }
    return {ok:true,msg:'Sestava je v pořádku.'};
  }

  function validateFixture(f){
    if(f.t==='team')return {ok:true,msg:''};
    if(!uniqueRoster('a')||!uniqueRoster('b'))return {ok:false,msg:'Nejdřív nastav 5 různých hráčů v obou soupiskách.'};
    const a=validateSideFixture(f,'a'),b=validateSideFixture(f,'b');
    return a.ok&&b.ok?{ok:true,msg:'Sestava splňuje pravidla.'}:{ok:false,msg:(a.ok?'Tým B: '+b.msg:'Tým A: '+a.msg)};
  }

  function globalRuleStatus(){
    const out=[];
    out.push({ok:uniqueRoster('a')&&uniqueRoster('b'),txt:'Oba týmy mají kompletní soupisku 5 různých hráčů.'});
    [3,4,7,8,9,12,13,14,16,17,18,19,20].forEach(()=>{});
    const configured=FIXTURES.filter(f=>f.t!=='team'&&allChosen(lineup(f.n).a,requiredSlots(f))&&allChosen(lineup(f.n).b,requiredSlots(f)));
    const invalid=configured.filter(f=>!validateFixture(f).ok);
    out.push({ok:invalid.length===0,txt:invalid.length?'Některá zadaná sestava porušuje pravidla rozpisu.':'Zadané sestavy zatím neporušují pravidla rozpisu.'});
    return out;
  }

  function completedMatch(n){
    return (data.matches||[]).filter(m=>m&&m.federalCupLink?.year===2026&&Number(m.federalCupLink.fixtureNo)===Number(n)&&m.endedAt)
      .sort((a,b)=>new Date(b.endedAt||b.updatedAt||0)-new Date(a.endedAt||a.updatedAt||0))[0]||null;
  }


  const FEDERAL_CUP_TARGET_WINS=11;

  // Výsledek je jeden vítězný bod pro Slovensko (a) nebo Česko (b),
  // nikoliv počet racků. Výsledky se vyhodnocují v pořadí rozpisu.
  function federalCupResult(f){
    if(f.t==='team'){
      const r=cfg().teamResults?.[f.n];
      if(!r?.done)return null;
      const a=Number(r.a),b=Number(r.b);
      if(!Number.isFinite(a)||!Number.isFinite(b)||a===b)return null;
      return {winner:a>b?'a':'b',scores:[a,b]};
    }
    const match=completedMatch(f.n);
    if(!match)return null;
    const a=Number(match.scores?.[0]),b=Number(match.scores?.[1]);
    if(!Number.isFinite(a)||!Number.isFinite(b)||a===b)return null;
    return {winner:a>b?'a':'b',scores:[a,b]};
  }

  function raceState(){
    let winsA=0,winsB=0,played=0,clinchedAt=null,winner=null;
    for(const f of FIXTURES){
      const result=federalCupResult(f);
      if(!result)continue;
      played++;
      if(result.winner==='a')winsA++;else winsB++;
      if(winsA>=FEDERAL_CUP_TARGET_WINS||winsB>=FEDERAL_CUP_TARGET_WINS){
        winner=winsA>=FEDERAL_CUP_TARGET_WINS?'a':'b';
        clinchedAt=f.n;
        break;
      }
    }
    return {winsA,winsB,played,clinchedAt,winner,decided:winner!==null};
  }

  // Používá se i v hlavním tlačítku ZAHÁJIT ZÁPAS, aby nešlo otevřít
  // dříve připravený zápas, pokud už mezitím jedna reprezentace vyhrála.
  window.fc26CanStartMatch=function(n){
    return !raceState().decided&&!completedMatch(Number(n));
  };
  function saveLineupSelect(n,side,idx,value){
    if(!canEdit())return toast('Sestavu Federal Cupu může měnit pouze systémový administrátor.');
    if(raceState().decided)return toast('Federal Cup již skončil. Nové sestavy není potřeba zadávat.');
    const conf=cfg();
    conf.lineups[n]=conf.lineups[n]||{a:[],b:[]};
    conf.lineups[n][side]=Array.isArray(conf.lineups[n][side])?conf.lineups[n][side]:[];
    conf.lineups[n][side][idx]=value||'';
    conf.updatedAt=Date.now();
    saveData();
    render();
  }
  window.fc26SetLineup=saveLineupSelect;

  function lineupSelectHtml(f,side){
    const need=requiredSlots(f),l=lineup(f.n)[side];
    const cls=need===1?'fc26-side-selects single':'fc26-side-selects';
    return '<div class="'+cls+'">'+Array.from({length:need},(_,i)=>
      '<select '+(!canEdit()?'disabled ':'')+'onchange="fc26SetLineup('+f.n+',\''+side+'\','+i+',this.value)">'+options(l[i]||'',side)+'</select>'
    ).join('')+'</div>';
  }

  function manualTeamResultHtml(f){
    const r=cfg().teamResults?.[f.n]||{a:'',b:'',done:false};
    if(r.done){
      return '<div class="fc26-score">'+esc(String(r.a))+' : '+esc(String(r.b))+'</div>'+
        (canEdit()?'<div class="fc26-actions"><button class="btn" onclick="fc26EditTeamResult('+f.n+')">UPRAVIT VÝSLEDEK</button></div>':'');
    }
    if(!canEdit())return '<div class="muted" style="margin-top:10px">Výsledek Team utkání zatím není zapsán.</div>';
    return '<div class="fc26-team-score-inputs">'+
      '<input id="fc26TeamScoreA'+f.n+'" type="number" min="0" inputmode="numeric" placeholder="0">'+
      '<strong>:</strong>'+
      '<input id="fc26TeamScoreB'+f.n+'" type="number" min="0" inputmode="numeric" placeholder="0">'+
      '</div><div class="fc26-actions"><button class="btn primary" onclick="fc26SaveTeamResult('+f.n+')">ULOŽIT TEAM VÝSLEDEK</button></div>';
  }

  window.fc26SaveTeamResult=function(n){
    if(!canEdit())return toast('Federal Cup může upravovat systémový administrátor.');
    if(raceState().decided&&!cfg().teamResults?.[n]?.done)
      return toast('Utkání už skončilo na 11 vítězných zápasů. Další výsledek nelze zapsat.');
    const a=Math.max(0,Number($('fc26TeamScoreA'+n)?.value||0));
    const b=Math.max(0,Number($('fc26TeamScoreB'+n)?.value||0));
    if(a===b)return toast('Team utkání musí mít vítěze.');
    cfg().teamResults[n]={a,b,done:true,updatedAt:new Date().toISOString()};
    cfg().updatedAt=Date.now();saveData();render();toast('Team výsledek uložen.');
  };
  window.fc26EditTeamResult=function(n){
    if(!canEdit())return;
    const r=cfg().teamResults?.[n];if(r)r.done=false;
    cfg().updatedAt=Date.now();saveData();render();
  };

  window.fc26StartFixture=function(n){
    if(!canEdit())return toast('Zápas Federal Cup může připravit systémový administrátor.');
    if(raceState().decided)return toast('Federal Cup už má vítěze. Další zápasy se nehrají.');
    if(completedMatch(Number(n)))return toast('Tento zápas už má uložený výsledek.');
    const f=FIXTURES.find(x=>x.n===Number(n));if(!f||f.t==='team')return;
    const v=validateFixture(f);if(!v.ok)return toast(v.msg);
    const l=lineup(f.n),a=l.a.slice(0,requiredSlots(f)),bb=l.b.slice(0,requiredSlots(f));
    const pa=a.map(name=>({name:normalizedName(name)})).filter(x=>x.name);
    const pb=bb.map(name=>({name:normalizedName(name)})).filter(x=>x.name);
    if(pa.length!==requiredSlots(f)||pb.length!==requiredSlots(f))return toast('Sestavu se nepodařilo načíst.');

    pendingFederalCupLink={
      year:2026,fixtureNo:f.n,block:f.b,type:f.t,
      teamAName:cfg().teamAName,teamBName:cfg().teamBName,
      rosterA:[...cfg().rosterA],rosterB:[...cfg().rosterB],
      lineupA:[...a],lineupB:[...bb]
    };
    $('p1Name').value=pa[0].name;
    $('p2Name').value=pb[0].name;
    if($('doublesMode')){
      $('doublesMode').checked=f.t==='doubles';
      $('doublesMode').dispatchEvent(new Event('change',{bubbles:true}));
    }
    if(f.t==='doubles'){
      $('p1PartnerName').value=pa[1].name;
      $('p2PartnerName').value=pb[1].name;
    }else{
      if($('p1PartnerName'))$('p1PartnerName').value='';
      if($('p2PartnerName'))$('p2PartnerName').value='';
    }
    if($('streamMatchTitle'))$('streamMatchTitle').value='Federal Cup 2026 • #'+f.n+' '+f.label+' • '+cfg().teamAName+' × '+cfg().teamBName;
    showScreen('setup');
    toast('Federal Cup zápas #'+f.n+' je připravený. Nastav disciplínu a Race to.');
  };

  function renderFixture(f){
    const m=completedMatch(f.n),v=validateFixture(f),done=!!m;
    const cancelled=raceState().decided&&!done;
    let result='';
    if(done){
      result='<div class="fc26-score">'+esc(String(m.scores?.[0]??0))+' : '+esc(String(m.scores?.[1]??0))+'</div>'+
        '<div class="muted" style="text-align:center">'+esc(savedMatchSideDisplayName(m,0))+' × '+esc(savedMatchSideDisplayName(m,1))+'</div>'+
        '<div class="fc26-actions"><button class="btn" onclick="showSavedMatchStats(\''+esc(m.id)+'\')">STATISTIKY ZÁPASU</button></div>';
    }else if(cancelled){
      result='<div class="muted" style="text-align:center;padding:12px">NEHRAJE SE · Utkání skončilo dosažením 11 vítězství.</div>';
    }else if(f.t==='team'){
      result=manualTeamResultHtml(f);
    }else{
      result='<div class="fc26-lineup-grid">'+
        '<div class="fc26-side"><strong>'+esc(cfg().teamAName)+'</strong>'+lineupSelectHtml(f,'a')+'</div>'+
        '<div class="fc26-side"><strong>'+esc(cfg().teamBName)+'</strong>'+lineupSelectHtml(f,'b')+'</div>'+
      '</div>'+
      '<div class="'+(v.ok?'fc26-rule-ok':'fc26-rule-warn')+'" style="font-size:11px;margin-top:8px">'+esc(v.msg)+'</div>'+
      '<div class="fc26-actions"><button class="btn primary" '+(!v.ok?'disabled':'')+' onclick="fc26StartFixture('+f.n+')">HRÁT PŘES POČÍTADLO</button></div>';
    }
    return '<div class="fc26-fixture '+(done?'done':'')+(cancelled?' cancelled':'')+'">'+
      '<div class="fc26-fixture-head"><div style="display:flex;gap:9px;align-items:center"><span class="fc26-fixture-no">'+f.n+'</span><div><div class="fc26-type">'+esc(f.label)+'</div><div class="muted" style="font-size:11px">'+esc(f.note||'')+'</div></div></div>'+
      (done?'<span class="badge gold">ODEHRÁNO</span>':cancelled?'<span class="badge">NEHRAJE SE</span>':'')+'</div>'+result+'</div>';
  }

  function teamAggregate(side){
    const x={matchWins:0,matchLosses:0,racksFor:0,racksAgainst:0,breaks:0,dryBreaks:0,breakFouls:0,aces:0,breakAndRun:0,runouts:0,safeties:0,successfulSafeties:0,misses:0};
    const state=raceState();
    FIXTURES.forEach(f=>{
      // Případné historicky zadané výsledky po rozhodující jedenácté výhře
      // ponecháme uložené, ale nepočítáme je do výsledku Federal Cupu.
      if(state.decided&&f.n>state.clinchedAt)return;
      if(f.t==='team'){
        const r=cfg().teamResults?.[f.n];if(!r?.done)return;
        const a=Number(r.a||0),b=Number(r.b||0),sf=side===0?a:b,sa=side===0?b:a;
        x.racksFor+=sf;x.racksAgainst+=sa;if(sf>sa)x.matchWins++;else x.matchLosses++;return;
      }
      const m=completedMatch(f.n);if(!m)return;
      const sf=Number(m.scores?.[side]||0),sa=Number(m.scores?.[1-side]||0);
      x.racksFor+=sf;x.racksAgainst+=sa;if(sf>sa)x.matchWins++;else x.matchLosses++;
      const s=m.stats?.[side]||{};
      ['breaks','dryBreaks','breakFouls','aces','breakAndRun','runouts','safeties','successfulSafeties','misses'].forEach(k=>x[k]+=Number(s[k]||0));
    });
    return x;
  }

  function renderStats(){
    const a=teamAggregate(0),b=teamAggregate(1);
    const rows=[
      ['Vyhrané zápasy','matchWins'],['Prohrané zápasy','matchLosses'],['Racky +','racksFor'],['Racky −','racksAgainst'],
      ['Breaky','breaks'],['Dry break','dryBreaks'],['Faul z breaku','breakFouls'],['Eso','aces'],['Break & Run','breakAndRun'],
      ['Dohrávky','runouts'],['Jistoty','safeties'],['Úspěšné jistoty','successfulSafeties'],['Miss','misses']
    ];
    $('fc26TeamStats').innerHTML='<div style="overflow:auto"><table class="fc26-stat-table"><thead><tr><th>Statistika</th><th>'+esc(cfg().teamAName)+'</th><th>'+esc(cfg().teamBName)+'</th></tr></thead><tbody>'+
      rows.map(r=>'<tr><td>'+esc(r[0])+'</td><td>'+a[r[1]]+'</td><td>'+b[r[1]]+'</td></tr>').join('')+
      '</tbody></table></div>';
    $('fc26Summary').innerHTML=
      '<div class="fc26-summary-card"><h3>'+esc(cfg().teamAName)+'</h3><div class="fc26-score">'+a.matchWins+' : '+a.matchLosses+'</div><div class="muted" style="text-align:center">zápasy • racky '+a.racksFor+':'+a.racksAgainst+'</div></div>'+
      '<div class="fc26-summary-card"><h3>'+esc(cfg().teamBName)+'</h3><div class="fc26-score">'+b.matchWins+' : '+b.matchLosses+'</div><div class="muted" style="text-align:center">zápasy • racky '+b.racksFor+':'+b.racksAgainst+'</div></div>';
  }


  // Výhradně čtecí obrazovka; žádný druhý zápis dat ani editace utkání.
  function renderFederalCupViewer(){
    if(!$('fc26ViewerScoreboard'))return;
    const conf=cfg();
    const admin=canEdit();
    $('fc26ViewerEditor').classList.toggle('hidden',!admin);
    $('fc26ViewerNotice').textContent=cloudAuthenticated
      ? 'Aktuální výsledky se pravidelně obnovují. U odehraných Singles a Doubles lze otevřít detailní statistiky.'
      : 'Pro aktuální cloudové výsledky je potřeba přihlášení. Zobrazená data mohou být ze zařízení.';
    const a=teamAggregate(0),b=teamAggregate(1);
    const state=raceState(),done=state.played;
    function teamBox(name,flag,place,results,cls){
      return '<div class="fc26-scoreboard-team '+cls+'"><svg class="fc26-flag-svg fc26-flag-large" role="img" aria-label="Vlajka '+(flag==='sk'?'Slovenska':'Česka')+'" viewBox="0 0 600 400"><use href="#fc26Flag'+(flag==='sk'?'SK':'CZ')+'"></use></svg>'+
        '<div class="fc26-scoreboard-name">'+name+'</div>'+
        '<div class="fc26-scoreboard-meta">'+place+'</div>'+
        '<div class="fc26-scoreboard-wins">'+results.matchWins+'</div>'+
        '<div class="fc26-scoreboard-meta">VYHRANÉ ZÁPASY · SKÓRE '+results.racksFor+':'+results.racksAgainst+'</div></div>';
    }
    $('fc26ViewerScoreboard').innerHTML='<div class="fc26-scoreboard">'+
      teamBox('Slovensko','sk','DOMÁCÍ',a,'home')+
      '<div class="fc26-scoreboard-vs">:</div>'+
      teamBox('Česko','cz','HOSTÉ',b,'away')+'</div>'+
      (state.decided
        ? '<div class="fc26-winner-banner"><strong>🏆 '+(state.winner==='a'?'Slovensko':'Česko')+' vítězí '+state.winsA+':'+state.winsB+'</strong><span>Utkání rozhodnuto v zápase #'+state.clinchedAt+' · hraje se na 11 vítězných</span></div>'
        : '<div class="fc26-match-status" style="margin-top:12px">Hraje se na 11 vítězných zápasů · Slovensku chybí '+(11-state.winsA)+' výher, Česku '+(11-state.winsB)+'.</div>');
    $('fc26ViewerProgress').innerHTML=
      '<div class="fc26-view-progress"><span><strong>'+done+'</strong> odehraných zápasů (nejvýše '+FIXTURES.length+')</span>'+
      '<span>'+(state.decided?'UTKÁNÍ UKONČENO':'Zbývá maximálně '+Math.max(0,FIXTURES.length-done)+' zápasů')+'</span></div>'+
      '<div class="fc26-view-progressbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+
      (state.decided?100:Math.round(100*done/FIXTURES.length))+'"><span style="width:'+
      (state.decided?'100':(100*done/FIXTURES.length).toFixed(1))+'%"></span></div>';

    function fixture(f){
      const m=f.t==='team'?null:completedMatch(f.n);
      const r=f.t==='team'?conf.teamResults?.[f.n]:null;
      const l=lineup(f.n);
      const finished=!!m||r?.done===true;
      const cancelled=state.decided&&!finished;
      const outsideResult=state.decided&&f.n>state.clinchedAt&&finished;
      const sideName=(side,index)=>m?savedMatchSideDisplayName(m,index):
        f.t==='team'?(index===0?'Slovensko':'Česko'):
        (l[side]||[]).slice(0,requiredSlots(f)).filter(Boolean).join(' + ')||'Sestava bude doplněna';
      const score=finished
        ? (m?Number(m.scores?.[0]||0)+' : '+Number(m.scores?.[1]||0):
          Number(r.a||0)+' : '+Number(r.b||0))
        : '– : –';
      return '<div class="fc26-view-match '+(finished?'done':'')+(cancelled?' cancelled':'')+'">'+
        '<div class="fc26-view-match-type"><strong>#'+f.n+'</strong>'+esc(f.label)+'</div>'+
        '<div class="fc26-view-match-side">'+esc(String(sideName('a',0)))+'</div>'+
        '<div><div class="fc26-view-match-score">'+score+'</div>'+
        '<div class="fc26-view-match-status">'+(outsideResult?'MIMO HODNOCENÍ':cancelled?'NEHRAJE SE':finished?'DOHRÁNO':'ČEKÁ SE')+'</div></div>'+
        '<div class="fc26-view-match-side right">'+esc(String(sideName('b',1)))+'</div>'+
        (m?'<div class="fc26-view-match-detail"><button type="button" class="btn" data-fc26-view-match="'+
          esc(String(m.id||''))+'">DETAILNÍ STATISTIKY ZÁPASU</button></div>':'')+'</div>';
    }
    $('fc26ViewerSchedule').innerHTML=[1,2,3,4].map(block=>
      '<div class="fc26-block"><div class="fc26-block-head"><h3>Blok '+block+'</h3>'+
      '<span class="muted">'+FIXTURES.filter(f=>f.b===block&&f.t!=='team').length+' Singles / Doubles</span></div>'+
      FIXTURES.filter(f=>f.b===block).map(fixture).join('')+'</div>').join('');

    const stats=[
      ['Vyhrané zápasy','matchWins'],['Prohrané zápasy','matchLosses'],
      ['Součet skóre +','racksFor'],['Součet skóre −','racksAgainst'],
      ['Breaky','breaks'],['Dry break','dryBreaks'],['Fauly z breaku','breakFouls'],
      ['Eso','aces'],['Break & Run','breakAndRun'],['Dohrávky','runouts'],
      ['Jistoty','safeties'],['Úspěšné jistoty','successfulSafeties'],['MISS','misses']
    ];
    $('fc26ViewerStats').innerHTML='<div style="overflow:auto"><table class="fc26-stat-table">'+
      '<thead><tr><th>Statistika</th><th>🇸🇰 Slovensko</th><th>🇨🇿 Česko</th></tr></thead><tbody>'+
      stats.map(([label,key])=>'<tr><td>'+esc(label)+'</td><td>'+a[key]+'</td><td>'+b[key]+'</td></tr>').join('')+
      '</tbody></table></div>'+
      '<div class="muted" style="font-size:11px;margin-top:9px">Herní statistiky vycházejí ze Singles a Doubles; Team utkání zahrnují výsledek a skóre.</div>';
    const rosterHtml=(side,title)=>'<div class="fc26-view-roster"><h3>'+title+'</h3>'+
      roster(side).map((name,i)=>'<div class="fc26-view-roster-line"><span class="muted">'+(i+1)+'.</span> '+
        esc(String(name||'Bude doplněno'))+'</div>').join('')+'</div>';
    $('fc26ViewerRosters').innerHTML='<div class="fc26-view-rosters">'+
      rosterHtml('a','<svg class="fc26-flag-svg fc26-flag-roster" aria-hidden="true" viewBox="0 0 600 400"><use href="#fc26FlagSK"></use></svg>Slovensko · domácí')+
      rosterHtml('b','<svg class="fc26-flag-svg fc26-flag-roster" aria-hidden="true" viewBox="0 0 600 400"><use href="#fc26FlagCZ"></use></svg>Česko · hosté')+'</div>';
  }
  let refreshingSpectator=false;
  async function refreshFederalCupViewer(){
    if(refreshingSpectator)return;
    if(!cloudAuthenticated){renderFederalCupViewer();return;}
    refreshingSpectator=true;
    const btn=$('fc26ViewerRefresh');
    if(btn)btn.disabled=true;
    try{await Promise.allSettled([pollCloudData(),loadSecureMatches()]);}
    catch(e){console.warn('Federal Cup spectator refresh:',e);}
    finally{
      refreshingSpectator=false;
      if(btn)btn.disabled=false;
      renderFederalCupViewer();
    }
  }
  window.refreshFederalCupViewer=refreshFederalCupViewer;
  $('fc26ViewerRefresh')?.addEventListener('click',refreshFederalCupViewer);
  $('fc26ViewerEditor')?.addEventListener('click',()=>{if(canEdit())showScreen('federal-cup-editor')});
  $('fc26EditorBack')?.addEventListener('click',()=>showScreen('federal-cup-2026'));
  $('fc26ViewerSchedule')?.addEventListener('click',e=>{
    const btn=e.target.closest('[data-fc26-view-match]');
    if(btn?.dataset.fc26ViewMatch)showSavedMatchStats(btn.dataset.fc26ViewMatch);
  });
  setInterval(()=>{
    if(!document.hidden&&$('screen-federal-cup-2026')?.classList.contains('active'))refreshFederalCupViewer();
  },25000);

  function render(){
    const root=$('screen-federal-cup-editor');if(!root)return;
    const editable=canEdit(),state=raceState();
    $('fc26EditorMatchStatus').classList.toggle('done',state.decided);
    $('fc26EditorMatchStatus').innerHTML=state.decided
      ? '<strong>🏆 Utkání skončilo: '+(state.winner==='a'?'Slovensko':'Česko')+' vítězí '+state.winsA+':'+state.winsB+'.</strong> Rozhodující zápas #'+state.clinchedAt+'. Další zápasy už se nehrají.'
      : '<strong>Stav série: Slovensko '+state.winsA+' : '+state.winsB+' Česko</strong> · Hraje se na 11 vítězných zápasů (maximálně 21).';
    $('fc26TeamAName').value='Slovensko';
    $('fc26TeamBName').value='Česko';
    $('fc26SaveSettings').classList.toggle('hidden',!editable);
    $('fc26EditNotice').textContent=editable
      ? 'Zadej pět hráčů Slovenska vlevo a pět hráčů Česka vpravo. Hráči nepotřebují registraci v Poolčítadle.'
      : 'Soupisky může měnit systémový administrátor. Pro zadání jmen se přihlas administrátorským účtem.';

    ['A','B'].forEach(side=>{
      const key='roster'+side;
      const host=$('fc26Roster'+side);
      if(!host)return;
      // Při automatické aktualizaci stránky se nesmí ztratit rozepsaná jména.
      if(host.querySelectorAll('input.fc26-roster-player').length!==5){
        host.innerHTML=Array.from({length:5},(_,i)=>
          '<label class="fc26-roster-entry"><span>Hráč '+(i+1)+'</span><input class="fc26-roster-player" type="text" maxlength="100" autocomplete="off" id="fc26'+side+'Player'+i+'" placeholder="Jméno a příjmení" '+(!editable?'disabled':'')+'></label>'
        ).join('');
      }
      Array.from(host.querySelectorAll('input.fc26-roster-player')).forEach((input,i)=>{
        input.disabled=!editable;
        if(!input.dataset.dirty&&input!==document.activeElement)input.value=cfg()[key][i]||'';
      });
    });

    $('fc26RuleStatus').innerHTML='<strong>PRAVIDLA ROZPISU</strong><div style="margin-top:6px">'+globalRuleStatus().map(r=>
      '<div class="'+(r.ok?'fc26-rule-ok':'fc26-rule-warn')+'">'+(r.ok?'✓ ':'⚠ ')+esc(r.txt)+'</div>'
    ).join('')+'<div class="muted" style="margin-top:6px">Stejná dvojice nesmí nastoupit dvakrát. Blok 1: zápas 3 nesmí obsahovat hráče ze zápasu 2 a zápas 4 hrají zbývající hráči. Blok 2: zápasy 7–9 musí využít všech 5 hráčů. Blok 3: zápasy 12–14 musí využít všech 5 hráčů. Blok 4: zápasy 16–20 musí odehrát každý hráč právě jednou; zápas 21 je volba kapitána.</div></div>';

    let html='';
    for(let block=1;block<=4;block++){
      const notes={
        1:'1 Team • 2 Doubles • 3 Singles • 4 Doubles',
        2:'5 Team • 6 Singles • 7 Doubles • 8 Singles • 9 Doubles',
        3:'10 Team • 11 Singles • 12 Doubles • 13 Singles • 14 Doubles • 15 Singles',
        4:'16–20 Singles • 21 Singles – výběr kapitána'
      };
      html+='<div class="fc26-block"><div class="fc26-block-head"><h2>Blok č.'+block+'</h2><span class="muted">'+notes[block]+'</span></div>'+
        FIXTURES.filter(f=>f.b===block).map(renderFixture).join('')+'</div>';
    }
    $('fc26Schedule').innerHTML=html;
    renderStats();
    renderFederalCupViewer();
  }

  $('fc26SaveSettings')?.addEventListener('click',function(){
    if(!canEdit())return;
    const conf=cfg();
    const rosterA=Array.from({length:5},(_,i)=>normalizedName($('fc26APlayer'+i)?.value));
    const rosterB=Array.from({length:5},(_,i)=>normalizedName($('fc26BPlayer'+i)?.value));
    const unique=arr=>new Set(arr.filter(Boolean).map(x=>x.toLocaleLowerCase('cs'))).size===arr.filter(Boolean).length;
    if(!unique(rosterA)||!unique(rosterB)){
      toast('Jména v jedné soupisce se nesmí opakovat.');
      return;
    }
    conf.teamAName='Slovensko';conf.teamBName='Česko';
    conf.rosterA=rosterA;conf.rosterB=rosterB;conf.rosterMode='manual';
    Object.values(conf.lineups||{}).forEach(l=>{
      if(!l||typeof l!=='object')return;
      if(Array.isArray(l.a))l.a=l.a.map(n=>rosterA.includes(n)?n:'');
      if(Array.isArray(l.b))l.b=l.b.map(n=>rosterB.includes(n)?n:'');
    });
    document.querySelectorAll('.fc26-roster-player').forEach(input=>{delete input.dataset.dirty;});
    conf.updatedAt=Date.now();saveData();render();
    toast(rosterA.every(Boolean)&&rosterB.every(Boolean)
      ? 'Soupisky Slovenska a Česka uloženy.'
      : 'Rozpracované soupisky uloženy. Před zápasem doplň pět hráčů za každý tým.');
  });
  document.getElementById('screen-federal-cup-editor')?.addEventListener('input',function(e){
    if(e.target?.classList?.contains('fc26-roster-player'))e.target.dataset.dirty='1';
  });
  $('fc26Refresh')?.addEventListener('click',async function(){
    try{if(cloudAuthenticated)await loadSecureMatches();}catch(e){}
    render();
    toast('Federal Cup výsledky obnoveny.');
  });

  window.renderFederalCup2026=render;
})();

})();
