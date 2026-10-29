(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FederalReportController=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
function create(options){
const {document,window,dialog:reportDialog,screen,identity,prepare,sources}=options,$=id=>document.getElementById(id),URL=window.URL,location=window.location;
let reportReturnFocus=null,reportExportBusy=false,reportExportGeneration=0,reportZoomed=false,job=null,disposed=false,raf=null;
const listeners=[];function on(target,type,fn){target.addEventListener(type,fn);listeners.push(()=>target.removeEventListener(type,fn));}
const valid=j=>!disposed&&reportDialog.open&&screen.classList.contains('active')&&j.generation===reportExportGeneration&&j.identity===identity()&&!j.abort.signal.aborted;
function invalidate(){reportExportGeneration++;if(job){job.abort.abort();job=null;}reportExportBusy=false;}
function clean(){invalidate();if(raf!==null)window.cancelAnimationFrame(raf);raf=null;window.removeEventListener('resize',resize);$('fcReportContent').replaceChildren();for(const id of ['fcReportPng','fcReportPdf','fcReportZoom'])$(id).disabled=true;if(reportReturnFocus?.isConnected)reportReturnFocus.focus({preventScroll:true});}
function close(){if(reportDialog.open)reportDialog.close();clean();}
function open(button){if(disposed||!screen.classList.contains('active'))return;invalidate();const {content,context}=prepare(button);reportZoomed=false;const hasSheet=content.includes('fc-report-sheet');$('fcReportContent').innerHTML=hasSheet?'<div class="fc-report-preview-viewport" tabindex="0" role="region" aria-label="Náhled reportu, při zvětšení lze posouvat"><div class="fc-report-preview-frame">'+content+'</div></div>'+sources(context):content;
for(const id of ['fcReportPng','fcReportPdf','fcReportZoom'])$(id).disabled=!hasSheet;$('fcReportZoom').setAttribute('aria-pressed','false');$('fcReportZoom').textContent='ZVĚTŠIT NÁHLED';$('fcReportExportStatus').textContent='';reportReturnFocus=button;if(!reportDialog.open)reportDialog.showModal();reportDialog.scrollTop=0;window.removeEventListener('resize',resize);window.addEventListener('resize',resize);layoutFederalReportPreview();}
function resize(){if(raf!==null)window.cancelAnimationFrame(raf);raf=window.requestAnimationFrame(()=>{raf=null;layoutFederalReportPreview();});}
function wait(p,j,ms=15000){return new Promise((resolve,reject)=>{let timer;const finish=(fn,x)=>{window.clearTimeout(timer);j.abort.signal.removeEventListener('abort',abort);fn(x);};const abort=()=>finish(reject,Error('Export zneplatněn.'));timer=window.setTimeout(()=>finish(reject,Error('Fonty nebo obrázky se nepodařilo načíst.')),ms);j.abort.signal.addEventListener('abort',abort,{once:true});if(!valid(j)){abort();return;}Promise.resolve(p).then(x=>finish(resolve,x),e=>finish(reject,e));});}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);try{a.click();}finally{a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),60000);}}
  function fitFederalReportNames(root){
    for(const el of root.querySelectorAll('.fc-report-person h2')){
      el.style.fontSize='44px';
      for(let size=44;size>14&&(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1||[...el.querySelectorAll('.fc-report-name-line')].some(n=>n.scrollWidth>el.clientWidth+1));size--)el.style.fontSize=(size-1)+'px';
      if(el.scrollHeight>el.clientHeight+1||el.scrollWidth>el.clientWidth+1||[...el.querySelectorAll('.fc-report-name-line')].some(n=>n.scrollWidth>el.clientWidth+1))throw Error('Jméno se nevejde do Full HD reportu bez oříznutí. Export nebyl vytvořen.');
    }
    for(const el of root.querySelectorAll('.fc-report-value,.fc-report-card strong')){
      const max=el.matches('.fc-report-card strong')?48:24;el.style.whiteSpace='nowrap';el.style.fontSize=max+'px';
      for(let size=max;size>12&&el.scrollWidth>el.clientWidth+1;size--)el.style.fontSize=(size-1)+'px';
      if(el.scrollWidth>el.clientWidth+1)throw Error('Hodnota se nevejde do Full HD reportu bez oříznutí.');
    }
  }
  function layoutFederalReportPreview(){
    const root=$('fcReportContent').querySelector('.fc-report-sheet'),frame=root?.parentElement;if(!root||!reportDialog.open)return;
    const scale=reportZoomed?1:Math.min(1,Math.max(1,reportDialog.clientWidth-24)/1920);
    root.style.transform='scale('+scale+')';root.style.transformOrigin='top left';frame.style.width=(1920*scale)+'px';frame.style.height=(1080*scale)+'px';
    try{fitFederalReportNames(root);}catch(e){$('fcReportExportStatus').textContent=e.message;}
  }
  async function createFederalReportCanvas(root,j){
    if(!window.html2canvas)throw Error('Exportní knihovna se nenačetla. Obnov připojení a stránku.');
    const host=document.createElement('div');host.id='fcReportExportSurface';host.dataset.reportGeneration=String(j.generation);host.setAttribute('aria-hidden','true');
    host.style.cssText='position:fixed;left:0;top:0;width:1920px;height:1080px;z-index:-2147483647;pointer-events:none;';
    const copy=root.cloneNode(true);copy.style.transform='none';host.appendChild(copy);document.body.appendChild(host);
    try{
      await wait(document.fonts.ready,j);
      await Promise.all([...copy.querySelectorAll('img')].map(async img=>{
        if(new URL(img.currentSrc||img.src,location.href).origin!==location.origin)throw Error('Grafický podklad musí být dostupný ze stejného webu.');
        await wait(img.decode(),j).catch(()=>{throw Error('Grafický podklad nebo logo není načtené.');});if(!img.naturalWidth)throw Error('Grafický podklad nebo logo není načtené.');
      }));
      if(!valid(j))throw Error('Export zneplatněn.');
      const canvas=await window.html2canvas(copy,{backgroundColor:'#090b0a',scale:1,width:1920,height:1080,windowWidth:1920,windowHeight:1080,scrollX:0,scrollY:0,useCORS:true,allowTaint:false,logging:false,removeContainer:true,onclone:doc=>{
        const sheet=doc.querySelector('[data-report-generation="'+j.generation+'"] .fc-report-sheet');fitFederalReportNames(sheet);
        if(sheet.scrollWidth>1920||sheet.scrollHeight>1080)throw Error('Obsah přesahuje Full HD formát. Export nebyl vytvořen, aby se nic neořízlo.');
        const header=sheet.querySelector('.fc-report-head');if(header)for(const panel of header.querySelectorAll('.fc-report-person'))if(panel.getBoundingClientRect().bottom>header.getBoundingClientRect().bottom+1)throw Error('Hlavička reportu přesahuje vyhrazené místo.');
        const footer=sheet.querySelector('.fc-report-footer').getBoundingClientRect();for(const row of sheet.querySelectorAll('[data-report-metric]'))if(row.getBoundingClientRect().bottom>footer.top+1)throw Error('Statistiky se překrývají s patičkou.');
        for(const el of sheet.querySelectorAll('[data-report-metric],.fc-report-footer,.fc-report-brands,.fc-report-brands span,.fc-report-person h2,.fc-report-club-logo,.fc-report-pool-logo,.fc-report-pushout-logo')){const box=el.getBoundingClientRect(),page=sheet.getBoundingClientRect();if(box.bottom>page.bottom+1||box.right>page.right+1)throw Error('Obsah reportu se nevejde do Full HD.');}
      }});
      if(canvas.width!==1920||canvas.height!==1080)throw Error('Export nemá požadované rozlišení.');
      return canvas;
    }finally{host.remove();}
  }
  async function exportFederalReport(format){
    const root=$('fcReportContent').querySelector('.fc-report-sheet');
    if(reportExportBusy||!root||!reportDialog.open||!screen.classList.contains('active'))return;
    const j={generation:reportExportGeneration,identity:identity(),abort:new window.AbortController()};job=j;const generation=j.generation,name=('federal-cup-'+(root.querySelector('.fc-report-kicker')?.textContent||'report')).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').toLowerCase().slice(0,120);
    reportExportBusy=true;$('fcReportPng').disabled=true;$('fcReportPdf').disabled=true;$('fcReportExportStatus').textContent='Připravuji '+format.toUpperCase()+' ve Full HD…';
    try{
      if(format==='pdf'&&!window.jspdf?.jsPDF)throw Error('PDF knihovna se nenačetla. Obnov připojení a stránku.');
      const canvas=await createFederalReportCanvas(root,j);if(!valid(j))return;let blob;
      if(format==='png')blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG se nepodařilo vytvořit.')),'image/png'));
      else{const pdf=new window.jspdf.jsPDF({orientation:'landscape',unit:'pt',format:[1440,810],compress:true});pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,1440,810);blob=pdf.output('blob');}
      if(!valid(j))return;
      download(blob,name+'.'+format);
      $('fcReportExportStatus').textContent=format.toUpperCase()+' připraveno ke stažení (1920 × 1080).';
    }catch(e){if(valid(j))$('fcReportExportStatus').textContent='Export se nezdařil: '+e.message;}
    finally{if(job!==j)return;job=null;reportExportBusy=false;const enabled=reportDialog.open&&!!$('fcReportContent').querySelector('.fc-report-sheet');$('fcReportPng').disabled=!enabled;$('fcReportPdf').disabled=!enabled;}
  }
on($('fcReportPng'),'click',()=>exportFederalReport('png'));on($('fcReportPdf'),'click',()=>exportFederalReport('pdf'));on($('fcReportZoom'),'click',()=>{reportZoomed=!reportZoomed;$('fcReportZoom').setAttribute('aria-pressed',String(reportZoomed));$('fcReportZoom').textContent=reportZoomed?'ZMENŠIT NÁHLED':'ZVĚTŠIT NÁHLED';layoutFederalReportPreview();});on($('fcReportClose'),'click',close);on(reportDialog,'cancel',e=>{e.preventDefault();close();});on(reportDialog,'close',()=>{if(!reportDialog.open)clean();});on(screen,'click',e=>{const b=e.target.closest('[data-fc-report]');if(b)open(b);});on(window,'pagehide',e=>{if(e.persisted)close();else dispose();});
const observer=new window.MutationObserver(()=>{if(!screen.classList.contains('active'))close();});observer.observe(screen,{attributes:true,attributeFilter:['class']});
function dispose(){if(disposed)return;close();disposed=true;observer.disconnect();listeners.splice(0).forEach(f=>f());}
return Object.freeze({open,close,invalidate:close,download,ticket(){const g=reportExportGeneration,k=identity();return()=>!disposed&&g===reportExportGeneration&&k===identity()&&screen.classList.contains('active');},dispose});
}return Object.freeze({create});});