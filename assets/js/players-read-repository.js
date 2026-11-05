// App-owned collection reader. Identity, publication and lifecycle remain explicit caller responsibilities.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PlayersReadRepository=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
const identityKey=s=>JSON.stringify([!!s.authenticated,String(s.uid||''),s.scope||'']);
function create(o){
  let key=null,epoch=0,pending=null,disposed=false,revision=0,writeState={depth:0,wait:null,release:null};
  function syncIdentity(){const next=identityKey(o.identity());if(key!==next){key=next;epoch++;revision++;writeState.release?.();writeState={depth:0,wait:null,release:null};const old=pending;pending=null;old?.controller.abort();}return key;}
  function read(){
    syncIdentity();const s=o.identity();
    if(disposed||!s.authenticated||!s.uid)return Promise.reject(Error('NO_AUTH'));
    if(writeState.depth)return writeState.wait.then(()=>read());
    if(pending)return pending.promise;
    const job={epoch,key,revision,controller:new AbortController()};
    const current=()=>!disposed&&job.epoch===epoch&&job.revision===revision&&writeState.depth===0&&job.key===identityKey(o.identity())&&!job.controller.signal.aborted;
    job.promise=Promise.resolve().then(async()=>{
      if(!current()||!await o.ensureToken({current,signal:job.controller.signal}))throw Error('NO_AUTH');
      if(!current())throw Error('STALE_PLAYERS_READ');
      const response=await o.fetch(o.url()+'&t='+o.now(),{cache:'no-store',signal:job.controller.signal});
      if(!current())throw Error('STALE_PLAYERS_READ');
      if(!response.ok)throw Error('PLAYERS_READ_'+response.status);
      const players=await response.json()||{};
      if(!current())throw Error('STALE_PLAYERS_READ');
      o.apply(players);return players;
    }).finally(()=>{if(pending===job)pending=null;});pending=job;return job.promise;
  }
  function beginWrite(){
    syncIdentity();const state=writeState;revision++;const old=pending;pending=null;old?.controller.abort();
    if(state.depth++===0)state.wait=new Promise(resolve=>{state.release=resolve;});
    let ended=false;return ()=>{if(ended)return;ended=true;if(state!==writeState)return;if(--state.depth===0){revision++;state.release();state.wait=null;state.release=null;}};
  }
  function dispose(){disposed=true;epoch++;pending?.controller.abort();pending=null;writeState.release?.();}
  return Object.freeze({read,syncIdentity,beginWrite,dispose,snapshot:()=>({requests:pending?1:0,writes:writeState.depth,epoch,revision})});
}
return Object.freeze({create});
});
