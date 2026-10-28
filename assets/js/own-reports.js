// The reports screen owns its polling and asynchronous read/legacy-mirror chain.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.OwnReports=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function create(options){
    const clock=options.clock||globalThis;
    let active=false,disposed=false,owner=null,generation=0,timer=null,pending=null;
    const current=job=>active&&!disposed&&generation===job.generation&&owner===job.owner&&options.identity()===job.owner&&options.screenActive();
    function stop(){
      active=false;generation++;
      if(timer!==null)clock.clearInterval(timer);
      timer=null;options.pageTarget?.removeEventListener('pagehide',pagehide);
      const job=pending;pending=null;owner=null;
      if(job)job.controller.abort();
    }
    function dispose(){stop();disposed=true;}
    function pagehide(event){if(!event.persisted)dispose();}
    function start(){
      if(disposed)return;
      const next=options.identity();
      if(next===null||!options.screenActive()){stop();return;}
      if(active&&owner===next)return;
      stop();active=true;owner=next;
      options.started?.();
      timer=clock.setInterval(()=>{void refresh(true);},options.intervalMs);
      options.pageTarget?.addEventListener('pagehide',pagehide);
    }
    function refresh(silent=false){
      if(!active||options.identity()!==owner)start();
      if(!active||disposed)return Promise.resolve([]);
      if(!options.screenActive()){stop();return Promise.resolve([]);}
      if(pending){pending.silent=pending.silent&&silent;return pending.promise;}
      const job={owner,generation,silent,controller:options.createAbortController?.()||new AbortController(),promise:null};
      const context={owner:job.owner,signal:job.controller.signal,current:()=>current(job)};
      pending=job;
      job.promise=Promise.resolve().then(async()=>{
        if(!context.current()||!await options.authorize(context)||!context.current())return [];
        const response=await options.fetch(options.indexUrl(job.owner),{cache:'no-store',signal:context.signal,headers:{'Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache'}});
        if(!context.current())return [];
        if(!response.ok)throw new Error('REPORT_INDEX_'+response.status);
        const raw=await response.json()||{},rows=[];
        if(!context.current())return [];
        for(const [id,value]of Object.entries(raw)){
          if(!context.current())return [];
          if(value&&typeof value==='object'){rows.push({...value,id:value.id||id});continue;}
          if(value===true){
            try{
              const item=await options.readLegacy(id,context);
              if(!context.current())return [];
              if(item){
                rows.push(item);
                // Preserve the existing legacy upgrade only while this screen/session is current.
                try{await options.mirrorLegacy(item,context);}catch(e){}
                if(!context.current())return [];
              }
            }catch(error){if(context.current())options.legacyError(id,error);}
          }
        }
        if(!context.current())return [];
        const sorted=rows.filter(r=>r&&r.createdByUid===job.owner).sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
        options.apply(sorted);if(context.current())options.success(!job.silent);return sorted;
      }).catch(error=>{
        if(!context.current()||context.signal.aborted)return [];
        options.error(error,!job.silent);return options.rows();
      }).finally(()=>{if(pending===job)pending=null;});
      return job.promise;
    }
    function snapshot(){return Object.freeze({active,disposed,pending:!!pending,intervals:timer===null?0:1,timeouts:0,listeners:active&&options.pageTarget?1:0});}
    return Object.freeze({start,stop,refresh,dispose,snapshot});
  }
  return Object.freeze({create});
});
