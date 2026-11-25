'use strict';
// Explicit production operator entry point. Default mode is OFFLINE plan.
const fs=require('node:fs'),path=require('node:path');
const {PROJECT,DATABASE}=require('./series-migration-production-transport.cjs');
const {createProduction}=require('./series-trusted-migration.cjs');
const fail=code=>Object.assign(new Error(code),{code});
function privateJSON(file){
 if(typeof file!=='string'||!path.isAbsolute(file))throw fail('ABSOLUTE_PRIVATE_FILE_REQUIRED');
 const resolved=fs.realpathSync(file),repo=fs.realpathSync(path.resolve(__dirname,'..'));
 if(resolved.toLowerCase()===repo.toLowerCase()||resolved.toLowerCase().startsWith(repo.toLowerCase()+path.sep))throw fail('PRIVATE_FILE_IN_REPOSITORY_DENIED');
 return JSON.parse(fs.readFileSync(resolved,'utf8').replace(/^\uFEFF/,''));
}
async function cli(args){
 const a={};for(let i=0;i<args.length;i+=2){if(!['--config','--mode','--project','--database-url'].includes(args[i])||!args[i+1]||Object.hasOwn(a,args[i]))throw fail('INVALID_ARGUMENTS');a[args[i]]=args[i+1];}
 if(a['--project']!==PROJECT||a['--database-url']!==DATABASE)throw fail('EXPLICIT_PRODUCTION_SELECTION_REQUIRED');
 const mode=a['--mode']||'plan';if(!['plan','dry-run','apply','verify'].includes(mode))throw fail('INVALID_MODE');
 const c=privateJSON(a['--config']),allowed=['principal','sourceIndex','seriesId','readApprovalFile','writeApprovalFile','quiescenceFile','auditFile','evidenceDir','firebaseToolsDir'];
 if(Object.keys(c).some(k=>!allowed.includes(k)))throw fail('UNSUPPORTED_CONFIG_FIELD');
 if(mode==='plan')return {mode:'OFFLINE_PLAN',cloudRequests:0,writes:0,readApprovalRequired:true,writeApprovalRequired:true};
 const readApproval=privateJSON(c.readApprovalFile),writeApproval=mode==='apply'?privateJSON(c.writeApprovalFile):undefined;
 const tool=createProduction({...c,projectId:PROJECT,databaseUrl:DATABASE,readApproval,writeApproval});
 const r=await tool.run({mode,sourceIndex:c.sourceIndex,seriesId:c.seriesId,...(mode==='apply'?{approval:'PRODUCTION CREATE ONLY',quiescence:privateJSON(c.quiescenceFile)}:{})});
 return {...r,evidence:'Private immutable receipts; retain separately with second reviewer'};
}
if(require.main===module)cli(process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({stopped:true,code:/^[A-Z_0-9]+$/.test(e.code||'')?e.code:'OPERATION_FAILED',noAutomaticRetry:true}));process.exitCode=1;});
module.exports={cli,privateJSON};
