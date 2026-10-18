'use strict';
// Poolčítadlo build: concatenates source fragments without a separator.
// The generated asset intentionally remains one script and one lexical closure;
// splitting it into multiple <script> tags would break shared let/const bindings.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');

const root=path.resolve(__dirname,'..');
const parts=[
  '00-runtime-state',
  '01-auth-cloud',
  '02-match-engine',
  '03-tournament-management',
  '04-tournament-playoffs',
  '05-brackets-and-results',
  '06-leagues',
  '07-competition-history',
  '08-player-statistics',
  '09-federal-cup'
];
const output=path.join(root,'assets/js/pool-core.js');
const source=parts.map(name=>fs.readFileSync(path.join(root,'src/core',name+'.part.js'),'utf8')).join('');
const old=fs.existsSync(output)?fs.readFileSync(output,'utf8'):null;

if(process.argv.includes('--check')){
  if(old!==source){
    console.error('Pool core is out of sync. Run npm run build:core and commit the generated file.');
    process.exitCode=1;
  }else{
    console.log('Pool core: source fragments and generated asset match exactly ('+Buffer.byteLength(source)+' bytes).');
  }
}else{
  if(old!==source)fs.writeFileSync(output,source,'utf8');
  console.log('Pool core: generated '+parts.length+' segments ('+crypto.createHash('sha256').update(source).digest('hex').slice(0,12)+').');
}
