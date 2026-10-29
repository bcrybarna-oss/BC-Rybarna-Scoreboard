// Shared Livescore reads and background/view/dialog refresh lifetimes. No publishing.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LivescoreReader=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
function create(o){let active=false,disposed=false,epoch=0,pending=null,last=0,interval=null,warm=null,view=0,dialog=0,ticking=null;
const valid=j=>active&&!disposed&&j.epoch===epoch&&j.identity===o.identity();
function invalidate(){epoch++;ticking=null;if(pending)pending.abort.abort();pending=null;last=0;view++;dialog++;}
function refresh(force=false){if(disposed)return Promise.resolve(o.get());if(!active)start();if(pending&&valid(pending))return pending.promise;if(pending)invalidate();const j={epoch,identity:o.identity(),abort:new AbortController()};j.promise=Promise.resolve().then(async()=>{if(!await o.authorize({signal:j.abort.signal,current:()=>valid(j)})||!valid(j))return o.get();const now=o.now();if(!force&&now-last<700)return o.get();last=now;try{const raw=await o.read(now,j.abort.signal);if(!valid(j))return o.get();const fresh=[],stale=[];Object.values(raw||{}).filter(m=>m&&m.id&&!m.endedAt).forEach(m=>{const ts=Date.parse(m.updatedAt||m.startedAt||'');if(!Number.isFinite(ts)||now-ts>o.staleMs)stale.push(m);else fresh.push(m);});o.set(fresh);for(const m of stale){if(!valid(j))break;if(o.canDelete(m))Promise.resolve(o.cleanup(m,()=>valid(j))).catch(()=>{});}return o.get();}catch(e){if(valid(j))o.error(e);return o.get();}}).finally(()=>{if(pending===j)pending=null;});pending=j;return j.promise;}
function tick(force=false){if(ticking)return ticking;const p=Promise.resolve().then(()=>runTick(force)).finally(()=>{if(ticking===p)ticking=null;});ticking=p;return p;}
async function runTick(force=false){const e=epoch,id=o.identity(),v=view,d=dialog;const visible=o.viewVisible(),modal=o.dialogVisible();if(force||visible||modal||o.now()-last>=15000)await refresh(force||visible||modal);if(!active||e!==epoch||id!==o.identity())return;o.nav();if(v===view&&o.viewVisible())o.renderView();if(d===dialog&&o.dialogVisible())o.renderDialog();}
function resume(){o.page.removeEventListener('pageshow',resume);start();}
function pagehide(e){if(e.persisted){stop();o.page.addEventListener('pageshow',resume,{once:true});}else dispose();}
function start(){if(active||disposed)return;active=true;interval=o.setInterval(()=>{tick().catch(o.error);},1000);warm=o.setTimeout(()=>{warm=null;tick(true).catch(o.error);},900);o.page.addEventListener('pagehide',pagehide);}
function stop(){invalidate();active=false;if(interval!==null)o.clearInterval(interval);if(warm!==null)o.clearTimeout(warm);interval=warm=null;o.page.removeEventListener('pagehide',pagehide);}
function dispose(){stop();o.page.removeEventListener('pageshow',resume);disposed=true;}
function viewChanged(){view++;}
function dialogChanged(){dialog++;}
async function enter(load){const e=epoch,id=o.identity(),v=++view;await load();if(active&&e===epoch&&id===o.identity()&&v===view&&o.viewVisible())o.renderView();}
async function open(){const e=epoch,id=o.identity(),d=++dialog;await refresh(true);if(active&&e===epoch&&id===o.identity()&&d===dialog&&o.dialogVisible())o.renderDialog();}
return Object.freeze({start,stop,dispose,invalidate,refresh,tick,viewChanged,dialogChanged,enter,open,viewTicket(){const e=epoch,id=o.identity(),v=view;return()=>active&&e===epoch&&id===o.identity()&&v===view&&o.viewVisible();},snapshot:()=>({active,pending:!!pending,intervals:interval===null?0:1,timeouts:warm===null?0:1})});}
return Object.freeze({create});});
