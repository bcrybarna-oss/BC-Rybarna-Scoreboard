'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function inventory(){
 const all=fs.readdirSync(path.join(root,'tests')).filter(f=>f.endsWith('.test.cjs')).sort();
 const experimental=require('../tests/suites.cjs').experimental;
 if(new Set(experimental).size!==experimental.length)throw Error('Duplicate experimental test');
 for(const f of experimental)if(!all.includes(f))throw Error('Registered test missing: '+f);
 for(const f of all)if(f.startsWith('preview-')&&!experimental.includes(f))throw Error('Unclassified preview test: '+f);
 return {all,experimental:[...experimental].sort(),production:all.filter(f=>!experimental.includes(f))};
}
function run(suite){
 const files=inventory()[suite];if(!files)throw Error('Use production, experimental or all');
 console.log('TEST SCOPE:',suite,files.length,'files; every assertion contributes to exit status');
 const r=spawnSync(process.execPath,['--test',...files.map(f=>'tests/'+f)],{cwd:root,stdio:'inherit'});
 if(r.error)throw r.error;return r.status??1;
}
if(require.main===module){try{if(process.argv[2]==='--list')console.log(JSON.stringify(inventory(),null,2));else process.exitCode=run(process.argv[2]||'all');}catch(e){console.error(e.message);process.exitCode=2;}}
module.exports={inventory,run};
