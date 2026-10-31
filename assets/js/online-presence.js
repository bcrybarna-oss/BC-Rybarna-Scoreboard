// Global online presence lifecycle. No challenge mutations or archive cache.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OnlinePresence=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
const KEY='pool_online_visible',DEVICE='pool_online_device';
function create(o){
 let last=o.now(),rows=null,device='',viewerUid='',viewerIsAdmin=false,active=false,disposed=false,epoch=0,key=null,pending=null,rerun=false,renderedEpoch=-1,warm=false;
 const timers=[],removers=[];
 const identityKey=s=>JSON.stringify([!!s.authenticated,String(s.uid||''),String(s.profileId||''),s.scope||'']);
 try{device=o.sessionStorage.getItem(DEVICE)||('d'+o.random().toString(36).slice(2));o.sessionStorage.setItem(DEVICE,device);}catch(e){device='d'+o.random().toString(36).slice(2);}
 function visible(){try{return o.storage.getItem(KEY)!=='0'}catch(e){return true}}
 function syncIdentity(){const next=identityKey(o.identity());if(next!==key){key=next;epoch++;pending?.controller.abort();pending=null;rerun=false;rows=null;viewerUid='';viewerIsAdmin=false;o.document.getElementById('onlineUsersDialog')?.classList.remove('show');render();}return key;}
function escName(s){return String(s||'Hráč').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 if(key!==identityKey(o.identity())){syncIdentity();return;}
 const stat=o.document.getElementById('modernClubStats');
 if(stat&&!o.document.getElementById('onlineUsersTile')){
 const tile=o.document.createElement('button');tile.type='button';tile.className='modern-stat';tile.id='onlineUsersTile';tile.innerHTML='<b><span class="presence-dot"></span><span id="onlineUsersCount">—</span></b><span>Právě online · zobrazit hráče</span>';stat.appendChild(tile);
 }
 const count=o.document.getElementById('onlineUsersCount'),list=o.document.getElementById('onlineUsersList'),check=o.document.getElementById('onlineUsersVisible');
 if(check){check.checked=visible();check.closest('label')?.classList.toggle('hidden',viewerIsAdmin)}
 o.document.getElementById('onlineUsersAdminNote')?.classList.toggle('hidden',!viewerIsAdmin);
 const active=[],away=[],now=o.now();
 if(rows)Object.values(rows).forEach(group=>Object.values(group||{}).forEach(r=>{if(!r||!r.visible||!String(r.playerId||'').trim()||r.isAdminAccount===true||now-Number(r.updatedAt)>90000)return;const age=now-Number(r.lastInputAt);if(age<300000)active.push(r);else if(age<900000)away.push(r)}));
 const unique=arr=>[...new Map(arr.map(r=>[r.uid,r])).values()];
 const a=unique(active),w=unique(away).filter(r=>!a.some(x=>x.uid===r.uid));
 if(count)count.textContent=rows===null?'—':a.length;
 renderedEpoch=epoch;
 if(list){list.innerHTML=rows===null?'<p class="muted">Online seznam není dostupný. Zkontrolujte oprávnění Firebase.</p>':(a.map(r=>row(r,'🟢 Online')).join('')+w.map(r=>row(r,'🟡 Pryč')).join('')||'<p class="muted">Nikdo právě není online.</p>')}
 function row(r,status){const own=r.uid===viewerUid;const canInvite=!own&&!!r.playerId;return '<div class="presence-row"><div><strong>'+escName(r.name)+(own?' (ty)':'')+'</strong><div class="muted">'+status+'</div></div>'+(canInvite?'<button class="btn" data-presence-player="'+escName(r.playerId)+'">VYZVAT</button>':'')+'</div>'}
}
 function tick(){
  syncIdentity();const s=o.identity();if(!active||disposed||!s.authenticated||!s.uid){rows=null;viewerUid='';viewerIsAdmin=false;render();return Promise.resolve();}
  if(pending)return pending.promise;
  const job={epoch,key,uid:String(s.uid),profileId:String(s.profileId||''),controller:new AbortController()};
  const current=()=>active&&!disposed&&job.epoch===epoch&&job.key===identityKey(o.identity());
  pending=job;
  job.promise=Promise.resolve().then(async()=>{
   const ctx=await o.context({current});if(!current())return;
   if(!ctx||String(ctx.uid)!==job.uid||String(ctx.playerId||'')!==job.profileId){rows=null;viewerUid='';viewerIsAdmin=false;render();return;}
   viewerUid=ctx.uid;viewerIsAdmin=!!ctx.isAdminAccount;
   const age=o.now()-last,p=ctx.playerId;
   const body={uid:ctx.uid,playerId:String(p||''),name:ctx.name,isAdminAccount:!!ctx.isAdminAccount,updatedAt:o.now(),lastInputAt:last,visible:visible(),watching:o.document.hidden};
   const method=(ctx.isAdminAccount||!p||!visible()||age>900000)?'DELETE':'PUT';
   // No await between the last identity check and dispatch. Already sent writes are not revoked by stop/logout.
   if(!current())return;
   try{await o.write(ctx,'presence/'+encodeURIComponent(ctx.uid)+'/'+encodeURIComponent(device),method,body);}catch(e){}
   if(!current())return;
   try{const r=await o.read(ctx,job.controller.signal);if(!current())return;if(!r.ok)throw Error('presence');const value=await r.json();if(!current())return;rows=value||{};}catch(e){if(!current())return;rows=null;}
   if(current())render();
  }).catch(()=>{if(current()){rows=null;render();}}).finally(()=>{if(pending!==job)return;pending=null;if(rerun&&current()){rerun=false;tick();}});
  return job.promise;
 }
 function refresh(){if(pending){rerun=true;return pending.promise;}return tick();}
 function listen(target,type,fn,options){target.addEventListener(type,fn,options);removers.push(()=>target.removeEventListener(type,fn,options));}
 function start(){if(disposed||active)return;active=true;syncIdentity();
  for(const name of ['pointerdown','keydown','touchstart'])listen(o.document,name,()=>{last=o.now();},{passive:true});
  listen(o.document,'click',e=>{
   syncIdentity();const target=e.target;if(!target?.closest)return;
   if(target.closest('#onlineUsersTile')){o.document.getElementById('onlineUsersDialog')?.classList.add('show');render();}
   if(target.closest('#onlineUsersClose'))o.document.getElementById('onlineUsersDialog')?.classList.remove('show');
   const b=target.closest('[data-presence-player]');if(b&&renderedEpoch===epoch&&viewerUid&&o.identity().authenticated&&o.document.getElementById('onlineUsersList')?.contains(b)){o.document.getElementById('onlineUsersDialog')?.classList.remove('show');o.invite(b.dataset.presencePlayer);}
  });
  listen(o.document,'change',e=>{if(e.target.id==='onlineUsersVisible'){try{o.storage.setItem(KEY,e.target.checked?'1':'0');}catch(x){}refresh();}});
  listen(o.document,'visibilitychange',()=>{if(!o.document.hidden){last=o.now();refresh();}});
  // bfcache keeps the owner; a real page exit releases it. No logout DELETE under a new identity.
  listen(o.page,'pagehide',e=>{if(!e.persisted)stop();});
  listen(o.page,'pageshow',()=>syncIdentity());
  warm=true;timers.push(['i',o.setInterval(tick,30000)],['i',o.setInterval(render,5000)],['t',o.setTimeout(()=>{warm=false;tick();},5000)]);
 }
 function stop(){if(!active)return;active=false;warm=false;epoch++;pending?.controller.abort();pending=null;rerun=false;for(const [type,id]of timers.splice(0))(type==='i'?o.clearInterval:o.clearTimeout)(id);for(const remove of removers.splice(0))remove();rows=null;viewerUid='';viewerIsAdmin=false;o.document.getElementById('onlineUsersDialog')?.classList.remove('show');render();}
 function dispose(){stop();disposed=true;}
 return Object.freeze({start,stop,dispose,tick,render,syncIdentity,snapshot:()=>({active,disposed,epoch,intervals:active?2:0,timeouts:active&&warm?1:0,listeners:removers.length,pending:!!pending})});
}
return Object.freeze({create});
});
