'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const start=html.indexOf('  function savePdfBlob('),end=html.indexOf('  async function createStatisticsSectionPdfBlob(',start);
const sectionStart=html.indexOf('  async function generateStatisticsSectionPdf('),sectionEnd=html.indexOf("  $('statsPdfBtn')",sectionStart);
function harness(failClick=false){
 const calls=[],timers=[],nodes={};
 const node=id=>nodes[id]??=( {disabled:false,textContent:'EXPORT PDF',isConnected:true,addEventListener(){},focus(){},classList:{state:new Set(),add(x){this.state.add(x)},remove(x){this.state.delete(x)},contains(x){return this.state.has(x)}}} );
 const btn=node('matchStatsPdf');
 const blob={type:'application/pdf',content:'unchanged PDF'};
 const link={click(){calls.push(['click',this.href,this.download]);if(failClick)throw Error('download failed');},remove(){calls.push(['remove']);}};
 const context={File:class{constructor(parts,name,options){this.parts=parts;this.name=name;this.type=options.type;}},URL:{createObjectURL(b){assert.equal(b,blob);return 'blob:test';},revokeObjectURL(u){calls.push(['revoke',u]);}},document:{activeElement:btn,createElement(tag){assert.equal(tag,'a');return link;},body:{appendChild(a){assert.equal(a,link);calls.push(['append']);}}},setTimeout(fn,ms){timers.push({fn,ms});},toast:m=>calls.push(['toast',m]),navigator:{async share(payload){calls.push(['share',payload]);},canShare(){return true;}},console:{warn(){}},$:node,createMatchPdfBlob:async()=>blob,createStatisticsSectionPdfBlob:async()=>blob,pdfSafeName:s=>s,cloudAuthenticated:true,currentUserPlayerId:'p1',data:{players:{p1:{name:'Dominik'}}},playerDisplayName:p=>p.name};
 vm.createContext(context);vm.runInContext(html.slice(start,end)+html.slice(sectionStart,sectionEnd),context);
 return {context,calls,timers,btn,blob,link,node,opened:()=>node('pdfExportModal').classList.contains('show')};
}
test('PDF download keeps original blob and filename; no sharing; cleanup is delayed',()=>{
 const h=harness();h.context.savePdfBlob(h.blob,'original.pdf');
 assert.deepEqual(h.calls.slice(0,2),[['append'],['click','blob:test','original.pdf']]);
 assert.ok(h.calls.some(x=>x[0]==='remove'));assert.equal(h.timers.length,1);assert.equal(h.timers[0].ms,60000);
 assert.ok(!h.calls.some(x=>x[0]==='revoke'));h.timers[0].fn();assert.deepEqual(h.calls.at(-1),['revoke','blob:test']);
});
test('Failed download still removes link and releases URL',()=>{
 const h=harness(true);assert.throws(()=>h.context.savePdfBlob(h.blob,'x.pdf'),/download failed/);
 assert.ok(h.calls.some(x=>x[0]==='remove'));h.timers[0].fn();assert.deepEqual(h.calls.at(-1),['revoke','blob:test']);
});
test('Match export retains naming and restores button, even on generation error',async()=>{
 const h=harness();await h.context.generateMatchPdfExport({discipline:'9-ball',playerNames:['Dominik'],startedAt:'2026-10-19T10:00:00Z'});
 assert.equal(h.link.download,undefined);assert.ok(h.opened());h.context.saveExportedPdf();
 assert.equal(h.link.download,'BC_Rybarna_2026-10-19_9-ball_Dominik.pdf');assert.equal(h.btn.disabled,false);assert.equal(h.btn.textContent,'EXPORT PDF');
 h.context.createMatchPdfBlob=async()=>{throw Error('missing library');};await h.context.generateMatchPdfExport({});
 assert.equal(h.btn.disabled,false);assert.ok(h.calls.some(x=>x[0]==='toast'&&x[1]==='missing library'));
});
test('Both statistics exports download with existing filenames and preserve profile guard',async()=>{
 const h=harness();await h.context.generateStatisticsSectionPdf('stats');h.context.saveExportedPdf();assert.match(h.link.download,/^Poolcitadlo_statistiky_\d{4}-\d{2}-\d{2}\.pdf$/);
 await h.context.generateStatisticsSectionPdf('my-stats');h.context.saveExportedPdf();assert.match(h.link.download,/^Poolcitadlo_moje_statistiky_Dominik_\d{4}-\d{2}-\d{2}\.pdf$/);
 const before=h.calls.length;h.context.cloudAuthenticated=false;await h.context.generateStatisticsSectionPdf('my-stats');assert.equal(h.calls.slice(before).filter(x=>x[0]==='click').length,0);assert.equal(h.btn.disabled,false);
});
test('Share and repeated save retain same file, bytes and dialog until explicitly closed',async()=>{
 const h=harness();h.context.openPdfExportDialog(h.blob,'same.pdf');
 await h.context.shareExportedPdf();h.context.saveExportedPdf();await h.context.shareExportedPdf();h.context.saveExportedPdf();
 const shares=h.calls.filter(x=>x[0]==='share');assert.equal(shares.length,2);assert.equal(shares[0][1].files[0],shares[1][1].files[0]);
 assert.equal(shares[0][1].files[0].parts[0],h.blob);assert.equal(shares[0][1].files[0].name,h.link.download);assert.ok(h.opened());
 h.context.closePdfExportDialog();assert.equal(h.opened(),false);const count=h.calls.length;h.context.saveExportedPdf();assert.equal(h.calls.length,count);
});
test('Share cancellation and errors keep export open and restore both actions',async()=>{
 const h=harness();h.context.openPdfExportDialog(h.blob,'x.pdf');
 for(const name of ['AbortError','NotAllowedError']){h.context.navigator.share=async()=>{throw {name};};await h.context.shareExportedPdf();assert.ok(h.opened());assert.equal(h.node('pdfExportSave').disabled,false);assert.equal(h.node('pdfExportShare').disabled,false);assert.match(h.node('pdfExportStatus').textContent,name==='AbortError'?/zrušeno/:/nepodařilo/);}
 h.context.saveExportedPdf();assert.equal(h.link.download,'x.pdf');
});
test('Missing, false or throwing canShare disables only share',async()=>{
 for(const mode of ['missing','false','throw']){const h=harness();h.context.navigator.canShare=mode==='missing'?undefined:()=>{if(mode==='throw')throw Error();return false;};h.context.openPdfExportDialog(h.blob,'x.pdf');assert.equal(h.node('pdfExportShare').disabled,true);assert.equal(h.node('pdfExportSave').disabled,false);assert.match(h.node('pdfExportSupport').textContent,/nepodporuje/);h.context.saveExportedPdf();await h.context.shareExportedPdf();assert.equal(h.calls.filter(x=>x[0]==='share').length,0);assert.ok(h.opened());}
});
test('Pending share blocks duplicate actions and cannot overwrite a later export',async()=>{
 const h=harness();h.context.openPdfExportDialog(h.blob,'old.pdf');let resolve;h.context.navigator.share=()=>new Promise(r=>resolve=r);
 const pending=h.context.shareExportedPdf();assert.equal(h.node('pdfExportSave').disabled,true);h.context.saveExportedPdf();assert.equal(h.link.download,undefined);
 h.context.closePdfExportDialog();h.context.openPdfExportDialog(h.blob,'new.pdf');resolve();await pending;assert.equal(h.node('pdfExportFilename').textContent,'new.pdf');assert.equal(h.node('pdfExportStatus').textContent,'');assert.equal(h.node('pdfExportSave').disabled,false);
});
