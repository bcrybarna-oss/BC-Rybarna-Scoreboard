'use strict';
// Explicit historical comparison, local private inputs only. No retained legacy implementation.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {load}=require('./helpers/federal-statistics.cjs'),writer=require('../assets/pushout-xlsx.js');
const ref=process.env.FC_MODULE_BASE_REF;if(!ref)throw Error('Set FC_MODULE_BASE_REF to the pre-extraction commit');
const old=load(ref),current=load(),copy=x=>JSON.parse(JSON.stringify(x)),digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=process.env.FC_MODULE_BACKUPS?JSON.parse(process.env.FC_MODULE_BACKUPS):['2026-10-23 (1)','2026-10-24 (1)','2026-10-24 (2)','2026-10-25'].map(d=>'C:/Users/mencl/Downloads/BC_Rybarna_Scoreboard_Backup_'+d+'.json');
const output={baseRef:ref,moduleSha256:digest(fs.readFileSync(path.join(__dirname,'../assets/js/federal-statistics.js'))),bodies:[],backups:[]};
for(const name of Object.keys(current)){assert.equal(current[name].toString().replace(/\r\n/g,'\n'),old[name].toString().replace(/\r\n/g,'\n'),name+' body unchanged');output.bodies.push({name,sha256:digest(current[name].toString().replace(/\r\n/g,'\n'))});}
for(const file of files){
 const raw=fs.readFileSync(file),data=JSON.parse(raw),matches=Object.values(data.matches||{}),config=data.federalCup2026||{},before=JSON.stringify(data),rows={file:path.basename(file),sha256:digest(raw),matches:matches.length,linked:0,pushout:0,personalTeam:0,checks:[]};
 for(const m of matches){const a=copy(old.federalCalculateMatch(m)),b=copy(current.federalCalculateMatch(m));assert.deepEqual(b,a,m.id);if(m.federalCupLink){rows.linked++;if(m.federalCupLink.type==='team')rows.personalTeam+=Object.keys(b.individuals).length;}
  if(m.federalCupLink&&m.endedAt){const x=copy(old.federalPushoutModel(m)),y=copy(current.federalPushoutModel(m));assert.deepEqual(y,x,m.id+' XLSX model');if(x){assert.deepEqual(Buffer.from(writer.write(y)),Buffer.from(writer.write(x)));rows.pushout++;}}
 }
 const a=copy(old.federalReportData(matches,config,2026)),b=copy(current.federalReportData(matches,config,2026));assert.deepEqual(b,a,'whole report data, including all individuals and diagnostic reasons');
 assert.deepEqual(copy(current.federalCalculateSeason(matches,config,2026)),copy(old.federalCalculateSeason(matches,config,2026)));
 for(const m of matches.filter(m=>['a9f06904-00a5-4518-a81a-eae5a9425a35','3d4c35e6-e336-49d5-a9b3-9955cec59c3d'].includes(m.id))){const r=current.federalCalculateMatch(m);rows.checks.push({id:m.id,linked:!!m.federalCupLink,sides:r.sides.map(s=>({pots:s.metrics.pottedBalls.count,percent:current.federalReportMetric(s.metrics.pottingSuccess).text,ownBreak:[s.metrics.ownBreakWins.numerator,s.metrics.ownBreakWins.denominator],losses:s.metrics.ownBreakLosses.count}))});}
 assert.equal(JSON.stringify(data),before,'calculation never changes the backup');assert.equal(digest(fs.readFileSync(file)),rows.sha256);
 output.backups.push(rows);console.log('PASS parity',rows.file,rows.matches,'matches',rows.personalTeam,'personal Team entries',rows.pushout,'XLSX');
}
const out=path.resolve(process.env.FC_MODULE_OUT||'output/modularization-98/parity.json');fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(output,null,2));console.log('PASS module parity',out);
