'use strict';
// Compare actual downloaded files produced by existing browser scenarios, no production IO.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(process.env.RENDER_PARITY_OUT||'output/stage7a'),results=[];
const {compare:comparePdf}=require('./helpers/pdf-raster.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const suite of ['presentation','linked','exports','pushout','profile']){
 const before=path.join(root,'before',suite),after=path.join(root,'after',suite);
 for(const name of fs.readdirSync(before).filter(n=>/\.(png|pdf|xlsx)$/.test(n)&&!n.endsWith('-preview.png'))){
  const a=fs.readFileSync(path.join(before,name)),b=fs.readFileSync(path.join(after,name));
  let pdfComparison=null;if(name.endsWith('.pdf')){pdfComparison=comparePdf(a,b);if(pdfComparison.differentChannels){const stem=n=>n.replace(/-(desktop|mobile)(?=\.pdf$)/,'');const variants=fs.readdirSync(before).filter(n=>n.endsWith('.pdf')&&stem(n)===stem(name));const exactVariant=variants.find(n=>comparePdf(fs.readFileSync(path.join(before,n)),b).differentChannels===0);assert.ok(exactVariant,suite+'/'+name+' must exactly match a same-report baseline raster, not a numeric tolerance');pdfComparison.exactBaselineVariant=exactVariant;}assert.match(b.toString('latin1'),/\/MediaBox \[0 0 1440\.?(?:0*) 810\.?(?:0*)\]/);}
  else assert.equal(hash(b),hash(a),suite+'/'+name+' exact file equality, including PNG pixels/XLSX ZIP');
  results.push({suite,name,bytesBefore:a.length,bytesAfter:b.length,sha256Before:hash(a),sha256After:hash(b),comparison:name.endsWith('.pdf')?'exact baseline PDF image pixels (desktop/mobile variants)':'byte-identical',pdfComparison});
 }
}
const lifeBefore=JSON.parse(fs.readFileSync(path.join(root,'before/exports/lifecycle.json'),'utf8')),lifeAfter=JSON.parse(fs.readFileSync(path.join(root,'after/exports/lifecycle.json'),'utf8'));assert.deepEqual(lifeAfter,lifeBefore,'unchanged lifecycle including explicitly unresolved stage7b session guard');
assert.ok(results.filter(x=>x.name.endsWith('.png')).length>=10);
fs.writeFileSync(path.join(root,'export-parity.json'),JSON.stringify({results,lifecycle:{before:lifeBefore,after:lifeAfter},productionWrites:0},null,2)+'\n');
console.log('PASS',results.length,'actual PNG/PDF/XLSX files; exact PNG pixels, exact baseline image streams for PDF; baseline desktop/mobile variants recorded');
