'use strict';
// Reuses the existing first-copy scenario; every socket is loopback, never cloud.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict'),{spawnSync}=require('child_process');
const h=require('./tournament-series-repository-emulator.cjs'),m=require('../scripts/series-trusted-migration.cjs');
const {PROJECT,DATABASE}=require('../scripts/series-migration-production-transport.cjs');
(async()=>{
 const source={id:'s',createdByUid:'owner',managerUids:{manager:true},name:'Synthetic',updatedAt:'now',tournamentIds:['available-a','available-b',...Array.from({length:7},(_,i)=>'missing-'+i)],unknownFuture:{nested:{preserve:42}}};
 await h.control('.settings/rules','PUT',h.rules);await h.control('','PUT',{appData:{data:{tournamentSeries:[source]}}});
 const local=p=>'http://127.0.0.1:19006/'+p+'.json?ns=demo-pool-series';
 const first=await fetch(local('appData/data/tournamentSeries/0'),{headers:{Authorization:'Bearer owner','X-Firebase-ETag':'true'}}),empty=await fetch(local('tournamentSeries/s'),{headers:{Authorization:'Bearer owner','X-Firebase-ETag':'true'}});assert.equal(await empty.json(),null);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'production-adapter-engine-'));
 const read={approved:true,approvalId:'synthetic-read',projectId:PROJECT,databaseUrl:DATABASE,principal:'operator@example.test',sourceIndex:0,seriesId:'s',expiresAt:new Date(Date.now()+60000).toISOString(),administrativeBypassAcknowledged:true};
 const write={...read,approvalId:'synthetic-write',sourceHash:m.hash(source),sourceEtag:first.headers.get('etag'),targetHash:m.hash(h.api.encodeLegacy(source)),targetEtag:empty.headers.get('etag'),sourceRulesVerified:true,writerQuietReviewed:true,independentReviewerApproved:true,metadataInventoryVerified:true,snapshotManifestSHA256:'a'.repeat(64),reviewerEvidenceRef:'synthetic-second-custodian'};
 let puts=0;const tool=m.createProduction({projectId:PROJECT,databaseUrl:DATABASE,principal:read.principal,readApproval:read,writeApproval:write,evidenceDir:dir,auditFile:path.join(dir,'audit.jsonl'),credentialProvider:async()=>({projectId:PROJECT,principal:read.principal,accessToken:'synthetic-oauth'}),fetch:async(u,o)=>{assert.equal(new URL(u).origin,DATABASE);if(o.method==='PUT')puts++;return fetch(local(new URL(u).pathname.slice(1,-5)),{...o,headers:{...o.headers,Authorization:'Bearer owner'}});}});
 const r=await tool.run({mode:'apply',sourceIndex:0,seriesId:'s',approval:'PRODUCTION CREATE ONLY',quiescence:{clientsLocked:true,systemAdminsPaused:true,oldClientsStopped:true,adminProcessesPaused:true,attestedBy:'Synthetic',evidenceRefs:['synthetic quiet'],expiresAt:read.expiresAt}});
 assert.equal(r.state,'DIRECT_ACK_AND_READBACK_VERIFIED');assert.equal(puts,1);
 const manifests=fs.readdirSync(dir).filter(f=>f.endsWith('-manifest.json')).sort(),manifest=JSON.parse(fs.readFileSync(path.join(dir,manifests.at(-1))));
 const responses=manifest.receipts.filter(x=>x.stage==='response'&&x.method==='GET');
 const before=responses.find(x=>x.path.startsWith('appData/')),after=responses.findLast(x=>x.path==='tournamentSeries/s');
 const checker=spawnSync('python',[path.resolve('scripts/series-migration-verify.py'),path.join(dir,before.file),path.join(dir,after.file),path.join(dir,'independent.json')],{encoding:'utf8'});assert.equal(checker.status,0,'Independent Python checker failed');
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'independent.json'))).links,9);
 console.log('PASS: production transport first-copy via actual loopback RTDB engine;9 ordered links/unknowns,one PUT,independent verifier PASS. Synthetic credentials, no cloud connection.');
})().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
