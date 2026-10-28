// Screen-scoped refresh orchestration. Shared network transports are owned by core.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FederalViewer=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function create(options){
    const clock=options.clock||globalThis;
    let active=false,disposed=false,owner=null,generation=0,timer=null,pending=null;
    const current=job=>active&&!disposed&&generation===job.generation&&owner===job.owner&&options.identity()===job.owner&&options.screenActive();
    function stop(){
      active=false;generation++;owner=null;pending=null;
      if(timer!==null)clock.clearInterval(timer);
      timer=null;options.pageTarget?.removeEventListener('pagehide',pagehide);
      options.busy(false);
    }
    function dispose(){stop();disposed=true;}
    function pagehide(event){if(!event.persisted)dispose();}
    function start(){
      if(disposed)return;
      if(!options.screenActive()){if(active)stop();return;}
      const next=options.identity();
      if(active&&owner===next)return;
      stop();active=true;owner=next;
      timer=clock.setInterval(()=>{if(options.visible())void refresh();},options.intervalMs);
      options.pageTarget?.addEventListener('pagehide',pagehide);
    }
    function refresh(){
      start();
      if(!active||disposed)return Promise.resolve();
      if(pending)return pending.promise;
      if(owner===null){options.render();return Promise.resolve();}
      const job={owner,generation,promise:null};pending=job;options.busy(true);
      job.promise=Promise.resolve().then(async()=>{
        if(!current(job))return;
        try{await options.read();}
        catch(error){if(current(job))options.error(error);}
        finally{
          if(pending===job)pending=null;
          if(current(job)){options.busy(false);options.render();}
        }
      });
      return job.promise;
    }
    function snapshot(){return {active,disposed,owner,generation,interval:timer!==null,pending:pending!==null};}
    return Object.freeze({start,stop,refresh,dispose,snapshot});
  }
  return Object.freeze({create});
});
