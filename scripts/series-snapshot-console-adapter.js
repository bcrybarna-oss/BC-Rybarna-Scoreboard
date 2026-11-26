// Paste ONLY into the paused application lexical scope, after separately approved review.
// Installation and plan are read-free. Do not install/use on production without separate approval.
(function({allowLocalEmulator=false}={}){
 if(!window.SeriesReadOnlySnapshots?.create)throw Error('Load the reviewed SeriesReadOnlySnapshots factory first');
 if(typeof cloudUid==='undefined'||typeof ensureCloudToken!=='function')throw Error('Pause inside the application lexical scope first; credentials must not be copied');
 const helper=window.SeriesReadOnlySnapshots.create({databaseUrl:FIREBASE_DB,allowLocalEmulator,
  identity:()=>({uid:cloudUid,authenticated:cloudAuthenticated,emailVerified:cloudEmailVerified,role:currentUserRole,profileId:currentUserPlayerId||'',generation:cloudSessionGeneration}),
  authorize:async context=>{if(!await ensureCloudToken(context))return null;return {uid:cloudUid,idToken:cloudIdToken};},fetch:(...args)=>fetch(...args)});
 async function save(files){
  helper.assertCurrent(files);
  if(!Array.isArray(files)||!files.length||files.some(f=>!['series-snapshot-appData.json','series-snapshot-tournamentSeries.json','series-snapshot-tournaments.json'].includes(f.filename)))throw Error('Unexpected snapshot bundle');
  const stamp=new Date().toISOString().replace(/[:.]/g,'-'),manifest=[],downloads=[];
  for(const file of files){const bytes=new TextEncoder().encode(JSON.stringify(file.snapshot,null,2)+'\n');const digest=await crypto.subtle.digest('SHA-256',bytes);
   const filename=stamp+'-'+file.filename;manifest.push({filename,sha256:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),bytes:bytes.length});downloads.push({filename,bytes});}
  downloads.push({filename:stamp+'-snapshot-manifest.json',bytes:JSON.stringify({readOnly:true,files:manifest},null,2)});
  for(const file of downloads){helper.assertCurrent(files);const url=URL.createObjectURL(new Blob([file.bytes],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=file.filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
  return manifest;
 }
 window.seriesSnapshotHelper=Object.freeze({plan:helper.plan,capture:helper.capture,save,dispose:helper.dispose});
 return {installed:true,readOnly:true,requestsSent:0,next:'Inspect seriesSnapshotHelper.plan(); resume execution. Capture only after separate approval.'};
})()
