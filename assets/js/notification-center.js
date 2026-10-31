// Global notification center. No Firebase transport or polling; challenges are supplied by the application.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NotificationCenter=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
function create(o){
  const q=id=>o.elements[id],esc2=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const NOTIFICATION_READ_KEY='poolcitadlo_notification_read_v1';
  let active=false,disposed=false,epoch=0,identity=null,rendered=null,renderedEvents=new Map(),scrollTimer=null,removers=[];
  const context=()=>{const s=o.identity();return {...s,uid:String(s.uid||''),key:JSON.stringify([!!s.authenticated,String(s.uid||''),s.scope||''])};};
  const valid=t=>active&&t&&t.epoch===epoch&&t.key===context().key;
  function clearScroll(){if(scrollTimer!==null)o.clearTimeout(scrollTimer);scrollTimer=null;}
  function close(){q('notificationPanel')?.classList.add('hidden');q('notificationBellBtn')?.setAttribute('aria-expanded','false');}
  function clearPrivate(){rendered=null;renderedEvents.clear();const list=q('notificationList'),count=q('notificationCount'),bell=q('notificationBellBtn');if(list)list.innerHTML='<div class="notification-empty">Po přihlášení se zde zobrazí upozornění.</div>';if(count){count.textContent='0';count.classList.add('hidden');}bell?.classList.remove('has-unread');}
  function syncIdentity(){const s=context();if(!identity||identity.key!==s.key){epoch++;identity=s;clearScroll();close();clearPrivate();}return s;}
  function notificationReadMap(uid){if(!uid)return {};try{const all=JSON.parse(o.storage.getItem(NOTIFICATION_READ_KEY)||'{}');return all&&typeof all==='object'&&all[uid]&&typeof all[uid]==='object'?all[uid]:{};}catch(e){return {};}}
  function saveNotificationReadMap(map,ticket){if(!valid(ticket)||!ticket.uid||!context().authenticated)return false;try{let all=JSON.parse(o.storage.getItem(NOTIFICATION_READ_KEY)||'{}');if(!all||typeof all!=='object'||Array.isArray(all))all={};all[ticket.uid]=map||{};const bytes=JSON.stringify(all);if(!valid(ticket)||!context().authenticated)return false;o.storage.setItem(NOTIFICATION_READ_KEY,bytes);return true;}catch(e){return false;}}
  function notificationEventKey(ch,type){
    var stamp=ch.responseUpdatedAt||ch.updatedAt||ch.acceptedAt||ch.createdAt||'';
    return [ch.id,type,stamp].join('|');
  }
  function notificationEvents(s){
    if(!s.authenticated||!s.uid)return [];
    var me=s.uid,rows=[];
    o.challenges().forEach(function(ch){
      if(!ch||!(ch.senderUid===me||ch.recipientUid===me))return;
      var opponent=o.playerName(ch.senderUid===me?ch.recipientPlayerId:ch.senderPlayerId);
      var meta=String(ch.discipline||'').toUpperCase()+' · Race to '+Number(ch.raceTo||1)+(ch.date||ch.flexibleTime?' · '+o.formatDate(ch):'');

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
  function render(){
    if(!active)return;
    const s=syncIdentity(),ticket={epoch,key:s.key,uid:s.uid};rendered=ticket;
    var bell=q('notificationBellBtn'),count=q('notificationCount'),list=q('notificationList');
    if(!bell||!count||!list)return;
    if(!s.authenticated||!s.uid){
      count.classList.add('hidden');count.textContent='0';bell.classList.remove('has-unread');
      list.innerHTML='<div class="notification-empty">Po přihlášení se zde zobrazí upozornění.</div>';
      return;
    }
    var read=notificationReadMap(s.uid),events=notificationEvents(s);
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

    renderedEvents=new Map(events.map(n=>[n.key,n]));
  }
  function currentAction(){if(!valid(rendered)||!context().authenticated){render();return null;}return rendered;}
  function markOne(button){const t=currentAction();if(!t||!renderedEvents.has(button.dataset.notificationKey))return;const map=notificationReadMap(t.uid);map[button.dataset.notificationKey]=o.now();saveNotificationReadMap(map,t);if(!valid(t))return;render();close();o.openChallenges();clearScroll();scrollTimer=o.setTimeout(()=>{scrollTimer=null;if(valid(t)&&o.challengesVisible())o.scrollChallenges();},100);}
  function markAll(){const t=currentAction();if(!t)return;const map=notificationReadMap(t.uid);notificationEvents(context()).forEach(n=>{map[n.key]=o.now();});saveNotificationReadMap(map,t);if(valid(t))render();}
  function listen(target,type,fn){if(!target)return;target.addEventListener(type,fn);removers.push(()=>target.removeEventListener(type,fn));}
  function resume(){o.page.removeEventListener('pageshow',resume);start();}
  function start(){if(active||disposed)return;active=true;syncIdentity();listen(q('notificationBellBtn'),'click',e=>{e.stopPropagation();syncIdentity();const panel=q('notificationPanel');if(!panel)return;const opening=panel.classList.contains('hidden');panel.classList.toggle('hidden',!opening);q('notificationBellBtn').setAttribute('aria-expanded',opening?'true':'false');if(opening)render();});listen(q('notificationPanel'),'click',e=>e.stopPropagation());listen(q('notificationList'),'click',e=>{const b=e.target.closest?.('[data-notification-key]');if(b&&q('notificationList').contains(b))markOne(b);});listen(q('notificationMarkAllBtn'),'click',markAll);listen(o.document,'click',close);listen(o.page,'pagehide',e=>{if(e.persisted){stop();o.page.addEventListener('pageshow',resume,{once:true});}else dispose();});render();}
  function stop(){active=false;epoch++;identity=null;clearScroll();removers.splice(0).forEach(remove=>remove());close();clearPrivate();}
  function dispose(){stop();o.page.removeEventListener('pageshow',resume);disposed=true;}
  return Object.freeze({start,stop,dispose,render,syncIdentity});
}
return Object.freeze({create});});
