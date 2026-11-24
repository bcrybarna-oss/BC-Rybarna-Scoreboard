'use strict';
// Files in, report out. No Firebase client, network, migration, repair or deduplication.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const contract=require('../assets/js/tournament-series-repository.js');
const mutable=contract.fields,core=['id','createdByUid','managerUids'];
function stable(x){if(!x||typeof x!=='object')return x;if(Array.isArray(x))return x.map(stable);return Object.fromEntries(Object.keys(x).sort().map(k=>[k,stable(x[k])]));}
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(stable(x))).digest('hex');
function plan(legacy,target,tournaments){
 const before=JSON.stringify([legacy,target,tournaments]),records=Object.values(legacy||{}),destination=target||{},known=tournaments===undefined?null:new Set(Array.isArray(tournaments)?tournaments.map(x=>typeof x==='string'?x:x.id):Object.keys(tournaments||{}));
 const counts={legacySeries:records.length,targetSeries:Object.keys(destination).length,links:0,historicalTournaments:0,missingTarget:0,identical:0,conflict:0,invalid:0},seen=new Set(),rows=[];
 for(const s of records){
  const row={id:s?.id??null,issues:[]};
  try{
   if(seen.has(s.id))row.issues.push('DUPLICATE_SERIES_ID');seen.add(s.id);
   const proposed=contract.encodeLegacy(s);try{contract.decodeRecord(proposed,s.id);}catch(error){row.issues.push(error.code||'UNREADABLE_TARGET_RECORD');row.migrationBlocked=true;}const ids=Object.values(s.tournamentIds||{}),history=Object.values(s.historicalTournaments||{});
   row.owner=s.createdByUid;row.managers=Object.keys(s.managerUids||{}).filter(k=>s.managerUids[k]===true);
   row.links=ids.length;row.tournamentIds=ids;row.duplicateLinks=ids.filter((id,i)=>ids.indexOf(id)!==i);
   row.missingReferences=known?ids.filter(id=>!known.has(id)):null;
   row.scoring=Object.fromEntries(mutable.filter(k=>k!=='tournamentIds'&&k!=='updatedAt'&&Object.prototype.hasOwnProperty.call(s,k)).map(k=>[k,s[k]]));
   row.historicalTournaments=history.length;row.historicalSha256=hash(s.historicalTournaments||null);
   row.unknownFields=Object.keys(s).filter(k=>!mutable.includes(k)&&!core.includes(k));
   row.originalSha256=hash(s);row.proposedSha256=hash(proposed);row.targetSha256=destination[s.id]?hash(destination[s.id]):null;
   if(!s.updatedAt||typeof s.updatedAt!=='string')row.issues.push('MISSING_OR_INVALID_UPDATED_AT');
   if(s.managerUids&&(!s.managerUids||typeof s.managerUids!=='object'||Array.isArray(s.managerUids)||Object.values(s.managerUids).some(v=>typeof v!=='boolean')))row.issues.push('INVALID_MANAGER_MAP');
   if(ids.some(v=>typeof v!=='string'))row.issues.push('INVALID_REFERENCE');
   if(row.duplicateLinks.length)row.issues.push('DUPLICATE_REFERENCES_NOT_REPAIRED');
   row.status=row.migrationBlocked?'invalid':!destination[s.id]?'missingTarget':row.proposedSha256===row.targetSha256?'identical':'conflict';
   row.firebaseRepresentationEquivalent=destination[s.id]?JSON.stringify(contract.canonical(proposed))===JSON.stringify(contract.canonical(destination[s.id])):null;
   counts[row.status]++;counts.links+=ids.length;counts.historicalTournaments+=history.length;
  }catch(error){row.status='invalid';row.issues.push(error.code||error.message);counts.invalid++;}
  rows.push(row);
 }
 const orphanTargetIds=Object.keys(destination).filter(id=>!seen.has(id));
 if(before!==JSON.stringify([legacy,target,tournaments]))throw Error('DRY_RUN_MUTATED_INPUT');
 return {readOnly:true,counts,rows,orphanTargetIds,automaticRepair:false,automaticDeduplication:false,productionWrites:0,note:'Snapshot comparison only. This report does not prove that inputs are current cloud authority, and performs no migration.'};
}
function cli(argv){
 const args={};for(let i=0;i<argv.length;i+=2){if(!['--legacy','--target','--tournaments','--source-kind','--out'].includes(argv[i])||!argv[i+1]||Object.prototype.hasOwnProperty.call(args,argv[i]))throw Error('Invalid/duplicate argument');args[argv[i]]=argv[i+1];}
 if(!args['--legacy']||!args['--target']||!['synthetic','server-snapshot'].includes(args['--source-kind']))throw Error('Required: --legacy FILE --target FILE --source-kind synthetic|server-snapshot [--tournaments FILE] [--out NEW_FILE]');
 const read=k=>{const bytes=fs.readFileSync(args[k]);return {file:path.resolve(args[k]),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),json:JSON.parse(bytes)};};
 const l=read('--legacy'),t=read('--target'),m=args['--tournaments']?read('--tournaments'):null,inputs=[l,t,...(m?[m]:[])];
 const value=input=>{
  if(args['--source-kind']==='synthetic')return input.json;
  const capture=input.json.capture;if(!capture?.databaseUrl||!capture.capturedAt||!capture.etag||!Object.prototype.hasOwnProperty.call(input.json,'value'))throw Error('server-snapshot inputs require capture.databaseUrl/capturedAt/etag and value; old application backups are not authoritative snapshots');
  const expectedPath=input===l?'/appData':input===t?'/tournamentSeries':'/tournaments';
  if(capture.path!==expectedPath)throw Error('Snapshot path mismatch: expected '+expectedPath);
  if(input===l&&(!input.json.value||!Object.prototype.hasOwnProperty.call(input.json.value?.data||{},'tournamentSeries')))throw Error('appData snapshot has no explicit tournamentSeries; do not infer an empty source');
  return input===l?input.json.value.data.tournamentSeries:input.json.value;
 };
 const report=plan(value(l),value(t),m?value(m):undefined);report.sourceKind=args['--source-kind'];
 report.inputs=inputs.map(x=>({sha256:x.sha256,capture:x.json.capture||null}));
 if(args['--source-kind']==='server-snapshot'&&new Set(inputs.map(x=>x.json.capture.databaseUrl)).size!==1)throw Error('Snapshots have different database origins');
 const serialized=JSON.stringify(report,null,2)+'\n';
 if(args['--out']){
  const out=path.resolve(args['--out']),root=path.resolve(__dirname,'..');
  if(args['--source-kind']==='server-snapshot'&&(out===root||out.toLowerCase().startsWith(root.toLowerCase()+path.sep)))throw Error('Private snapshot reports must stay outside the public repository');
  // Exclusive create: never overwrite an input, existing backup, symlink or report.
  fs.writeFileSync(out,serialized,{flag:'wx'});console.log(JSON.stringify({readOnly:true,sourceKind:report.sourceKind,counts:report.counts,reportWritten:true}));
 }else if(args['--source-kind']==='server-snapshot')console.log(JSON.stringify({readOnly:true,sourceKind:report.sourceKind,counts:report.counts,note:'Use --out outside repository for private ID/ACL details'}));
 else process.stdout.write(serialized);
 return report;
}
if(require.main===module)try{cli(process.argv.slice(2));}catch(error){console.error(error.message);process.exitCode=1;}
module.exports={plan,hash,cli};
