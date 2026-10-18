
(function(){
const KEY='pool_online_visible', DEVICE='pool_online_device';
let last=Date.now(),rows=null,writing=false,device='',viewerUid='',viewerIsAdmin=false;
try{device=sessionStorage.getItem(DEVICE)||('d'+Math.random().toString(36).slice(2));sessionStorage.setItem(DEVICE,device);}catch(e){device='d'+Math.random().toString(36).slice(2);}
function visible(){try{return localStorage.getItem(KEY)!=='0'}catch(e){return true}}
function escName(s){return String(s||'Hráč').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){
 const stat=document.getElementById('modernClubStats');
 if(stat&&!document.getElementById('onlineUsersTile')){
 const tile=document.createElement('button');tile.type='button';tile.className='modern-stat';tile.id='onlineUsersTile';tile.innerHTML='<b><span class="presence-dot"></span><span id="onlineUsersCount">—</span></b><span>Právě online · zobrazit hráče</span>';stat.appendChild(tile);
 }
 const count=document.getElementById('onlineUsersCount'),list=document.getElementById('onlineUsersList'),check=document.getElementById('onlineUsersVisible');
 if(check){check.checked=visible();check.closest('label')?.classList.toggle('hidden',viewerIsAdmin)}
 document.getElementById('onlineUsersAdminNote')?.classList.toggle('hidden',!viewerIsAdmin);
 const active=[],away=[],now=Date.now();
 if(rows)Object.values(rows).forEach(group=>Object.values(group||{}).forEach(r=>{if(!r||!r.visible||!String(r.playerId||'').trim()||r.isAdminAccount===true||now-Number(r.updatedAt)>90000)return;const age=now-Number(r.lastInputAt);if(age<300000)active.push(r);else if(age<900000)away.push(r)}));
 const unique=arr=>[...new Map(arr.map(r=>[r.uid,r])).values()];
 const a=unique(active),w=unique(away).filter(r=>!a.some(x=>x.uid===r.uid));
 if(count)count.textContent=rows===null?'—':a.length;
 if(list){list.innerHTML=rows===null?'<p class="muted">Online seznam není dostupný. Zkontrolujte oprávnění Firebase.</p>':(a.map(r=>row(r,'🟢 Online')).join('')+w.map(r=>row(r,'🟡 Pryč')).join('')||'<p class="muted">Nikdo právě není online.</p>')}
 function row(r,status){const own=r.uid===viewerUid;const canInvite=!own&&!!r.playerId;return '<div class="presence-row"><div><strong>'+escName(r.name)+(own?' (ty)':'')+'</strong><div class="muted">'+status+'</div></div>'+(canInvite?'<button class="btn" data-presence-player="'+escName(r.playerId)+'">VYZVAT</button>':'')+'</div>'}
}
async function tick(){
 const ctx=await window.poolPresenceContext?.();if(!ctx){rows=null;viewerUid='';viewerIsAdmin=false;render();return}viewerUid=ctx.uid;viewerIsAdmin=!!ctx.isAdminAccount;
 if(!writing){writing=true;try{
 const path='presence/'+encodeURIComponent(ctx.uid)+'/'+encodeURIComponent(device),age=Date.now()-last;
 const p=ctx.playerId;
 const body={uid:ctx.uid,playerId:String(p||''),name:ctx.name,isAdminAccount:!!ctx.isAdminAccount,updatedAt:Date.now(),lastInputAt:last,visible:visible(),watching:document.hidden};
 await fetch(ctx.db+'/'+path+'.json?auth='+encodeURIComponent(ctx.token),{method:(ctx.isAdminAccount||!p||!visible()||age>900000)?'DELETE':'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 }catch(e){}finally{writing=false}}
 try{const r=await fetch(ctx.db+'/presence.json?auth='+encodeURIComponent(ctx.token),{cache:'no-store'});if(!r.ok)throw Error('presence');rows=await r.json()||{}}catch(e){rows=null}
 render();
}
['pointerdown','keydown','touchstart'].forEach(n=>document.addEventListener(n,()=>{last=Date.now()},{passive:true}));
document.addEventListener('click',e=>{
 if(e.target.closest('#onlineUsersTile')){document.getElementById('onlineUsersDialog').classList.add('show');render()}
 if(e.target.closest('#onlineUsersClose'))document.getElementById('onlineUsersDialog').classList.remove('show');
 const b=e.target.closest('[data-presence-player]');if(b){document.getElementById('onlineUsersDialog').classList.remove('show');if(typeof window.openChallengeForPlayer==='function')window.openChallengeForPlayer(b.dataset.presencePlayer)}
});
document.addEventListener('change',e=>{if(e.target.id==='onlineUsersVisible'){try{localStorage.setItem(KEY,e.target.checked?'1':'0')}catch(x){}tick()}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){last=Date.now();tick()}});
setInterval(tick,30000);setInterval(render,5000);setTimeout(tick,5000);
})();
