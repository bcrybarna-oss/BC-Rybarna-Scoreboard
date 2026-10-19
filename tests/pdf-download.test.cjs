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
 const calls=[],timers=[],btn={disabled:false,textContent:'ULOŽIT PDF'};
 const blob={type:'application/pdf',content:'unchanged PDF'};
 const link={click(){calls.push(['click',this.href,this.download]);if(failClick)throw Error('download failed');},remove(){calls.push(['remove']);}};
 const context={URL:{createObjectURL(b){assert.equal(b,blob);return 'blob:test';},revokeObjectURL(u){calls.push(['revoke',u]);}},document:{createElement(tag){assert.equal(tag,'a');return link;},body:{appendChild(a){assert.equal(a,link);calls.push(['append']);}}},setTimeout(fn,ms){timers.push({fn,ms});},toast:m=>calls.push(['toast',m]),navigator:{share(){throw Error('Sharing must not be used');},canShare(){throw Error('Sharing must not be queried');}},console:{warn(){}},$(){return btn;},createMatchPdfBlob:async()=>blob,createStatisticsSectionPdfBlob:async()=>blob,pdfSafeName:s=>s,cloudAuthenticated:true,currentUserPlayerId:'p1',data:{players:{p1:{name:'Dominik'}}},playerDisplayName:p=>p.name};
 vm.createContext(context);vm.runInContext(html.slice(start,end)+html.slice(sectionStart,sectionEnd),context);
 return {context,calls,timers,btn,blob,link};
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
 const h=harness();await h.context.generateAndSaveMatchPdf({discipline:'9-ball',playerNames:['Dominik'],startedAt:'2026-10-19T10:00:00Z'});
 assert.equal(h.link.download,'BC_Rybarna_2026-10-19_9-ball_Dominik.pdf');assert.equal(h.btn.disabled,false);assert.equal(h.btn.textContent,'ULOŽIT PDF');
 h.context.createMatchPdfBlob=async()=>{throw Error('missing library');};await h.context.generateAndSaveMatchPdf({});
 assert.equal(h.btn.disabled,false);assert.ok(h.calls.some(x=>x[0]==='toast'&&x[1]==='missing library'));
});
test('Both statistics exports download with existing filenames and preserve profile guard',async()=>{
 const h=harness();await h.context.generateStatisticsSectionPdf('stats');assert.match(h.link.download,/^Poolcitadlo_statistiky_\d{4}-\d{2}-\d{2}\.pdf$/);
 await h.context.generateStatisticsSectionPdf('my-stats');assert.match(h.link.download,/^Poolcitadlo_moje_statistiky_Dominik_\d{4}-\d{2}-\d{2}\.pdf$/);
 const before=h.calls.length;h.context.cloudAuthenticated=false;await h.context.generateStatisticsSectionPdf('my-stats');assert.equal(h.calls.slice(before).filter(x=>x[0]==='click').length,0);assert.equal(h.btn.disabled,false);
});
