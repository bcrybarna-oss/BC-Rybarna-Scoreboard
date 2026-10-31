// Challenge read/cache lifecycle and shared /players reads. Server mutations stay in the application (9b2).
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MatchChallenges=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
const LOCAL_KEY='poolcitadlo_match_challenges_cache_v1';
const identityKey=s=>JSON.stringify([!!s.authenticated,String(s.uid||''),s.scope||'']);
function createPlayersReader(o){
  let key=null,epoch=0,pending=null,disposed=false;
  function syncIdentity(){const next=identityKey(o.identity());if(key!==next){key=next;epoch++;const old=pending;pending=null;old?.controller.abort();}return key;}
  function read(){
    syncIdentity();const s=o.identity();
    if(disposed||!s.authenticated||!s.uid)return Promise.reject(Error('NO_AUTH'));
    if(pending)return pending.promise;
    const job={epoch,key,controller:new AbortController()};
    const current=()=>!disposed&&job.epoch===epoch&&job.key===identityKey(o.identity())&&!job.controller.signal.aborted;
    job.promise=Promise.resolve().then(async()=>{
      if(!current()||!await o.ensureToken({current,signal:job.controller.signal}))throw Error('NO_AUTH');
      if(!current())throw Error('STALE_PLAYERS_READ');
      const response=await o.request(job.controller.signal);
      if(!current())throw Error('STALE_PLAYERS_READ');
      if(!response.ok)throw Error('PLAYERS_READ_'+response.status);
      const players=await response.json()||{};
      if(!current())throw Error('STALE_PLAYERS_READ');
      o.apply(players);return players;
    }).finally(()=>{if(pending===job)pending=null;});pending=job;return job.promise;
  }
  function dispose(){disposed=true;epoch++;pending?.controller.abort();pending=null;}
  return Object.freeze({read,syncIdentity,dispose,snapshot:()=>({requests:pending?1:0,epoch})});
}
function challengeObjects(obj){return obj&&typeof obj==='object'&&!Array.isArray(obj)?Object.values(obj).filter(Boolean):[];}
function mergedChallenge(base,response){
  const b=JSON.parse(JSON.stringify(base||{}));if(!response)return b;
  const bt=new Date(b.updatedAt||b.createdAt||0).getTime()||0,rt=new Date(response.updatedAt||0).getTime()||0;if(rt<bt)return b;
  ['status','flexibleTime','date','time','venue','note','counterByUid','acceptedAt','playedMatchId','playedAt'].forEach(k=>{if(response[k]!==undefined)b[k]=response[k];});
  b.responseUpdatedAt=response.updatedAt||'';return b;
}
function allChallenges(players){const rows=[];Object.values(players||{}).forEach(sender=>{challengeObjects(sender?.matchChallengesSent).forEach(base=>{if(base?.id)rows.push(mergedChallenge(base,players?.[base.recipientPlayerId]?.matchChallengeResponses?.[base.id]||null));});});return rows;}
function create(o){
  let active=false,disposed=false,key=null,epoch=0,cache=[],pending=null,timer=null,startup=null,attached=false,wake=false;
  const owned=(ch,s)=>!!s.authenticated&&!!s.uid&&!!ch&&(String(ch.senderUid||'')===String(s.uid)||String(ch.recipientUid||'')===String(s.uid));
  const storageKey=s=>LOCAL_KEY+':'+encodeURIComponent(s.uid);
  function syncIdentity(){const s=o.identity(),next=identityKey(s);if(next!==key){key=next;epoch++;pending=null;cache=[];
    if(s.authenticated&&s.uid){try{let raw=o.storage.getItem(storageKey(s));if(raw===null)raw=o.storage.getItem(LOCAL_KEY);const rows=JSON.parse(raw||'[]');if(Array.isArray(rows))cache=rows.filter(ch=>owned(ch,s));}catch(e){}}
    o.cacheChanged(cache);
  }return s;}
  function rows(){syncIdentity();return cache;}
  function all(){const s=syncIdentity();return s.authenticated&&s.uid?allChallenges(o.players()):[];}
  function rebuild(){const s=syncIdentity();cache=all().filter(ch=>owned(ch,s));cache.sort((a,b)=>new Date(b.updatedAt||b.responseUpdatedAt||b.createdAt||0)-new Date(a.updatedAt||a.responseUpdatedAt||a.createdAt||0));
    if(s.authenticated&&s.uid)try{o.storage.setItem(storageKey(s),JSON.stringify(cache));}catch(e){}
    o.cacheChanged(cache);return cache;
  }
  function refresh(force){
    if(!active||disposed)return Promise.resolve([]);
    const s=syncIdentity();if(!s.authenticated||!s.uid){o.render();return Promise.resolve(cache);}
    if(pending){pending.force=pending.force||force;return pending.promise;}
    const job={key,epoch,force:!!force};const current=()=>active&&!disposed&&job.key===identityKey(o.identity())&&job.epoch===epoch;
    job.promise=Promise.resolve().then(async()=>{if(job.force&&current())await o.readPlayers();if(!current())return [];rebuild();o.render();return cache;}).catch(error=>{if(current()){o.error(error);o.render();return cache;}return [];}).finally(()=>{if(pending===job)pending=null;});pending=job;return job.promise;
  }
  function stop(){active=false;epoch++;pending=null;if(timer!==null)o.clearInterval(timer);if(startup!==null)o.clearTimeout(startup);timer=startup=null;o.page.removeEventListener('pagehide',hide);o.page.removeEventListener('pageshow',show);attached=false;wake=false;}
  function start(){if(active||disposed)return;active=true;syncIdentity();
    if(!attached){o.page.addEventListener('pagehide',hide);o.page.addEventListener('pageshow',show);attached=true;}
    startup=o.setTimeout(()=>{startup=null;refresh(true);},1200);
    timer=o.setInterval(()=>{if(!o.hidden()&&o.identity().authenticated)refresh(false);},30000);
  }
  function hide(event){stop();if(event.persisted){wake=true;o.page.addEventListener('pageshow',show);}else dispose();}
  function show(){wake=false;o.page.removeEventListener('pageshow',show);start();}
  function dispose(){if(disposed)return;stop();disposed=true;cache=[];o.cacheChanged(cache);o.onDispose?.();}
  return Object.freeze({start,stop,dispose,syncIdentity,rows,all,rebuild,refresh,snapshot:()=>({active,disposed,intervals:timer===null?0:1,timeouts:startup===null?0:1,listeners:attached?2:wake?1:0,pending:!!pending})});
}
return Object.freeze({create,createPlayersReader});
});
