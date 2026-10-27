// Session-owned /appData reads. Application data, permissions and writes remain with the caller.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CloudRefresh=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function create(options){
    const clock=options.clock||globalThis;
    let active=false,disposed=false,owner=null,generation=0,interval=null,initial=null,pending=null;
    const identity=()=>options.identity();
    const current=job=>active&&!disposed&&job.generation===generation&&job.owner===owner&&identity()===owner;
    function stop(){
      active=false;generation++;
      if(interval!==null)clock.clearInterval(interval);
      if(initial!==null)clock.clearTimeout(initial);
      interval=null;initial=null;
      options.visibilityTarget?.removeEventListener('visibilitychange',visible);
      options.pageTarget?.removeEventListener('pagehide',pagehide);
      const job=pending;pending=null;
      if(job)job.controller.abort();
      owner=null;
    }
    function dispose(){stop();disposed=true;}
    function pagehide(event){if(!event.persisted)dispose();}
    function visible(){if(!options.hidden())void refresh();}
    function start(){
      if(disposed)return;
      const next=identity();
      if(next===null){stop();return;}
      if(active&&owner===next)return;
      stop();active=true;owner=next;
      options.visibilityTarget?.addEventListener('visibilitychange',visible);
      options.pageTarget?.addEventListener('pagehide',pagehide);
      interval=clock.setInterval(()=>{void refresh();},options.intervalMs);
      initial=clock.setTimeout(()=>{initial=null;void refresh();},options.initialDelayMs);
    }
    function refresh(){
      if(!active||disposed)return Promise.resolve();
      if(identity()!==owner){start();if(!active)return Promise.resolve();}
      if(pending)return pending.promise;
      if(options.hidden()||options.blocked())return Promise.resolve();
      const job={owner,generation,controller:options.createAbortController?.()||new AbortController(),promise:null};
      // Reserve the single flight BEFORE awaiting token renewal. Renewal may call start() again.
      pending=job;
      job.promise=Promise.resolve().then(async()=>{
        if(!current(job)||!await options.authorize({signal:job.controller.signal,current:()=>current(job)})||!current(job))return;
        const response=await options.fetch(options.url(),{cache:'no-store',signal:job.controller.signal});
        if(!current(job))return;
        if(!response.ok)throw new Error('CLOUD_READ_'+response.status);
        const cloud=await response.json();
        if(!current(job)||!cloud||!cloud.data)return;
        const revision=Number(cloud.updatedAt||0);
        if(revision>options.localRevision()+500)options.apply(cloud,revision);
        if(current(job))options.success();
      }).catch(error=>{
        if(current(job)&&!job.controller.signal.aborted)options.error(error);
      }).finally(()=>{if(pending===job)pending=null;});
      return job.promise;
    }
    function snapshot(){return Object.freeze({active,disposed,pending:!!pending,intervals:interval===null?0:1,timeouts:initial===null?0:1,listeners:active?(options.visibilityTarget?1:0)+(options.pageTarget?1:0):0});}
    return Object.freeze({start,stop,refresh,dispose,snapshot});
  }
  return Object.freeze({create});
});
