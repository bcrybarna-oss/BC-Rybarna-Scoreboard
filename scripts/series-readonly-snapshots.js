// Manual tool only. Merely loading/creating this helper performs no requests.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SeriesReadOnlySnapshots=api;})(globalThis,function(){
 'use strict';
 const paths=Object.freeze(['/appData','/tournamentSeries','/tournaments']);
 const approvedOrigin='https://bc-rybarna-scrbrd-default-rtdb.europe-west1.firebasedatabase.app';
 function create(options){
  const origin=new URL(options.databaseUrl);const local=options.allowLocalEmulator===true&&origin.protocol==='http:'&&origin.hostname==='127.0.0.1';
  if(origin.username||origin.password||origin.search||origin.hash||origin.pathname!=='/'||(!local&&origin.origin!==approvedOrigin))throw Error('SNAPSHOT_DATABASE_MISMATCH');
  let disposed=false,busy=false,controller=null;const bundles=new WeakMap();
  const scope=()=>JSON.stringify(options.identity());
  function plan(){return {readOnly:true,databaseUrl:origin.origin,paths:[...paths],productionReadApprovalRequired:true,requestsMadeByPlan:0,note:'Separate operator approval and authorized credentials required. Snapshots are not an atomic cross-branch transaction.'};}
  async function capture({approval,selectedPaths=paths}={}){
   if(approval!=='READ ONLY SERIES SNAPSHOTS')throw Error('SNAPSHOT_EXPLICIT_APPROVAL_REQUIRED');
   if(disposed||busy)throw Error('SNAPSHOT_UNAVAILABLE');
   if(!Array.isArray(selectedPaths)||!selectedPaths.length||new Set(selectedPaths).size!==selectedPaths.length||selectedPaths.some(p=>!paths.includes(p)))throw Error('SNAPSHOT_PATH_DENIED');
   selectedPaths=[...selectedPaths];const who=options.identity(),ownerScope=scope();
   if(!who?.authenticated||!who?.emailVerified||!who.uid)throw Error('SNAPSHOT_AUTH_REQUIRED');
   const current=()=>!disposed&&scope()===ownerScope;const guard=()=>{if(!current())throw Error('SNAPSHOT_SESSION_CHANGED');};
   busy=true;controller=new AbortController();const files=[];
   try{
    for(const path of selectedPaths){
     guard();const c=await options.authorize({current,signal:controller.signal});guard();
     if(c?.uid!==who.uid||!c.idToken)throw Error('SNAPSHOT_CREDENTIAL_MISMATCH');
     const url=new URL(path+'.json',origin);url.searchParams.set('auth',c.idToken);
     if(local)url.searchParams.set('ns','demo-pool-series');
     let r;try{r=await options.fetch(url.toString(),{method:'GET',cache:'no-store',redirect:'error',signal:controller.signal,headers:{'X-Firebase-ETag':'true'}});}catch(e){throw Error('SNAPSHOT_READ_FAILED');}
     guard();if(!r.ok)throw Error('SNAPSHOT_HTTP_'+r.status);const etag=r.headers.get('ETag');if(!etag)throw Error('SNAPSHOT_ETAG_MISSING');
     let value;try{value=await r.json();}catch(e){throw Error('SNAPSHOT_INVALID_JSON');}guard();
     files.push({filename:'series-snapshot-'+path.slice(1)+'.json',snapshot:{capture:{databaseUrl:origin.origin,path,capturedAt:options.now?.()||new Date().toISOString(),etag},value}});
    }
    guard();bundles.set(files,ownerScope);return files;
   }finally{busy=false;controller=null;}
  }
  function assertCurrent(files){if(disposed||bundles.get(files)!==scope()||!options.identity()?.authenticated||!options.identity()?.emailVerified)throw Error('SNAPSHOT_BUNDLE_SESSION_CHANGED');}
  function dispose(){disposed=true;controller?.abort();}
  return Object.freeze({plan,capture,assertCurrent,dispose});
 }
 return Object.freeze({create,paths});
});
