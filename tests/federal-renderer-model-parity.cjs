'use strict';
// Optional private archive parity; data stays local, only aggregate evidence is written.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const old=require('./helpers/federal-statistics.cjs').load(process.env.RENDER_BASE_REF||'2d1de22a1c8577ad7642081bb36fde31e3fd6f91'),current=require('../assets/js/federal-statistics.js');
const file=process.env.RENDER_ARCHIVE;if(!file)throw Error('Set RENDER_ARCHIVE to the unchanged private JSON archive');
const bytes=fs.readFileSync(file),data=JSON.parse(bytes),clone=x=>JSON.parse(JSON.stringify(x)),conf=data.federalCup2026,year=Number(conf.year);
const before=clone(old.federalReportData(data.matches,conf,year));assert.deepEqual(clone(current.federalReportData(data.matches,conf,year)),before);
let personalContributions=0,pushoutModels=0;for(const m of data.matches.filter(m=>m.federalCupLink)){
 const a=clone(old.federalCalculateMatch(m)),b=clone(current.federalCalculateMatch(m));assert.deepEqual(b,a);personalContributions+=Object.keys(b.individuals).length;
 if(m.endedAt){assert.deepEqual(clone(current.federalPushoutModel(m)),clone(old.federalPushoutModel(m)));pushoutModels++;}
}
assert.deepEqual(fs.readFileSync(file),bytes);const out=path.resolve(process.env.RENDER_PARITY_OUT||'output/stage7a');fs.mkdirSync(out,{recursive:true});
const evidence={backupBytes:bytes.length,backupSha256:crypto.createHash('sha256').update(bytes).digest('hex'),matches:data.matches.length,selected:before.selected.length,people:Object.keys(before.people).length,personalContributions,pushoutModels,reportAndMatchModels:'deep-equal',productionWrites:0};fs.writeFileSync(path.join(out,'model-parity.json'),JSON.stringify(evidence,null,2)+'\n');console.log('PASS real archive match/season/personal Team/Pushout model parity',evidence.matches,'matches');
