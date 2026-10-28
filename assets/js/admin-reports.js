// Admin report list owns reads and DOM; mutations and permissions are injected by core.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.AdminReports=api;})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function create(options){
    const {container:wrap,esc,reportTypeLabel}=options;
    let active=false,disposed=false,owner=null,generation=0,pending=null,rows=[];
    const current=job=>active&&!disposed&&generation===job.generation&&owner===job.owner&&options.identity()===owner&&options.screenActive();
    function stop(){
      active=false;generation++;owner=null;rows=[];
      const job=pending;pending=null;if(job)job.controller.abort();
      wrap.removeEventListener('click',click);wrap.removeEventListener('change',change);options.pageTarget?.removeEventListener('pagehide',pagehide);
      wrap.replaceChildren();
    }
    function dispose(){stop();disposed=true;}
    function pagehide(e){if(!e.persisted)dispose();}
    function start(){
      if(disposed)return;
      const next=options.identity();
      if(next===null||!options.screenActive()){if(active)stop();if(next===null&&options.screenActive())wrap.innerHTML='<div class="muted">Pouze pro systémového administrátora.</div>';return;}
      if(active&&owner===next)return;
      stop();active=true;owner=next;
      wrap.addEventListener('click',click);wrap.addEventListener('change',change);options.pageTarget?.addEventListener('pagehide',pagehide);
    }
    function actionAllowed(){return active&&!disposed&&options.identity()===owner&&options.screenActive();}
    function click(e){if(!actionAllowed())return;const b=e.target.closest('.report-save-note-btn,.report-delete-btn');if(!b||!wrap.contains(b))return;if(b.classList.contains('report-save-note-btn'))options.saveNote(b.dataset.reportId);else options.deleteReport(b.dataset.reportId);}
    function change(e){if(actionAllowed()&&e.target.matches('[data-report-status]')&&wrap.contains(e.target))options.updateStatus(e.target.dataset.reportStatus,e.target.value);}
    function render(){
      if(!rows.length){wrap.innerHTML='<div class="muted">Žádná hlášení.</div>';return;}
    wrap.innerHTML=rows.map(r=>`<div class="subpanel" style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap"><div><strong>${esc(r.createdByName||r.email||'Uživatel')}</strong><div class="muted">${esc(reportTypeLabel(r.type))}${r.area?' • '+esc(r.area):''} • ${esc(r.appVersion||'')}</div><div class="muted">${esc(new Date(r.createdAt).toLocaleString('cs-CZ'))}</div></div><select id="reportStatus_${r.id}" data-report-status="${r.id}"><option value="new" ${r.status==='new'?'selected':''}>NOVÉ</option><option value="in_progress" ${r.status==='in_progress'?'selected':''}>ŘEŠÍ SE</option><option value="resolved" ${r.status==='resolved'?'selected':''}>VYŘEŠENO</option></select></div><div style="margin-top:10px;white-space:pre-wrap">${esc(r.description||'')}</div><div style="margin-top:10px"><label>Odpověď / poznámka pro uživatele</label><textarea id="reportNote_${r.id}" rows="3">${esc(r.adminNote||'')}</textarea><div style="display:flex;justify-content:flex-end;gap:8px;margin-top:7px"><button class="btn report-save-note-btn" data-report-id="${r.id}">ULOŽIT ODPOVĚĎ</button><button class="btn danger report-delete-btn" data-report-id="${r.id}">SMAZAT</button></div></div></div>`).join('');


    }
    function refresh(){
      start();if(!active||disposed)return Promise.resolve([]);
      if(pending)return pending.promise;
      const job={owner,generation,controller:options.createAbortController?.()||new AbortController(),promise:null};pending=job;
      const context={signal:job.controller.signal,current:()=>current(job)};
      job.promise=Promise.resolve().then(async()=>{
        if(!context.current())return [];const authorized=await options.authorize(context);if(!context.current())return [];if(!authorized)throw Error('NO_AUTH');
        const r=await options.fetch(options.url(),{cache:'no-store',signal:context.signal});
        if(!context.current())return [];if(!r.ok)throw Error('REPORTS_ADMIN_'+r.status);
        const raw=await r.json()||{};if(!context.current())return [];
        const order={new:0,in_progress:1,resolved:2};rows=Object.values(raw).filter(Boolean).sort((a,b)=>(order[a.status]??9)-(order[b.status]??9)||new Date(b.createdAt||0)-new Date(a.createdAt||0));render();return rows;
      }).catch(error=>{if(context.current()){options.error(error);wrap.innerHTML='<div class="muted">Hlášení se nepodařilo načíst.</div>';}return [];}).finally(()=>{if(pending===job)pending=null;});return job.promise;
    }
    function snapshot(){return {active,disposed,pending:!!pending,rows:rows.length,listeners:active?3:0,timers:0};}
    return Object.freeze({start,stop,refresh,dispose,snapshot});
  }
  return Object.freeze({create});
});
