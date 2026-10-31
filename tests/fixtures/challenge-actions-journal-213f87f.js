// Challenge writes. One owner/profile/session ticket per action; no Firebase policy or transaction protocol.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MatchChallengeActions=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const stable=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(stable):Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])]))):value;
  // Firebase drops nulls and empty containers; comparison only, never invented values or rewritten data.
  const firebaseValue=value=>{if(value===null||value===undefined)return undefined;if(typeof value!=='object')return value;const entries=Object.entries(value).map(([k,v])=>[k,firebaseValue(v)]).filter(([,v])=>v!==undefined);return entries.length?Object.fromEntries(entries):undefined;};
  const same=(a,b)=>JSON.stringify(stable(firebaseValue(a)))===JSON.stringify(stable(firebaseValue(b)));
  const keyOf=s=>JSON.stringify([!!s.authenticated,String(s.uid||''),String(s.profileId||''),s.scope||'']);
  const failure=code=>Object.assign(Error(code),{code});
  function create(o){
    let identityKey=null,epoch=0,disposed=false;
    const jobs=new Map(),queues=new Map(),verifications=new Set();
    function syncIdentity(){const next=keyOf(o.identity());if(next!==identityKey){identityKey=next;epoch++;for(const controller of verifications)controller.abort();}return identityKey;}
    function ticket(){syncIdentity();const s=o.identity(),generation=epoch,key=identityKey;
      const t={uid:String(s.uid||''),profileId:String(s.profileId||''),generation};
      t.current=()=>!disposed&&!!s.authenticated&&!!t.uid&&!!t.profileId&&epoch===generation&&key===keyOf(o.identity());return t;
    }
    const ownerKey=t=>JSON.stringify([t.uid,t.profileId]);
    const journalKey=t=>'poolcitadlo_challenge_pending_write_v1:'+encodeURIComponent(ownerKey(t));
    function readJournal(t){
      const prefix=journalKey(t)+':';
      for(const key of o.journal.keys().filter(key=>key&&key.startsWith(prefix)).sort()){
        const raw=o.journal.getItem(key);if(!raw)continue;const entry=JSON.parse(raw);
        if(entry.journalId!==key||entry.uid!==t.uid||entry.profileId!==t.profileId||!['matchChallengesSent','matchChallengeResponses'].includes(entry.field)||!entry.id||!entry.value)throw failure('CHALLENGE_JOURNAL_INVALID');return entry;
      }
      return null;
    }
    function clearJournal(t,entry){try{if(entry?.journalId)o.journal.removeItem(entry.journalId);}catch(e){/* A confirmed PUT remains confirmed; next action will verify the retained marker. */}}
    function check(t){if(!t.current())throw failure('CHALLENGE_SESSION_CHANGED');}
    function profile(t){check(t);const p=o.profile(t.profileId);if(!p||String(p.id)!==t.profileId||(p.ownerUid&&String(p.ownerUid)!==t.uid))throw failure('CHALLENGE_PROFILE_CHANGED');return copy(p);}
    function prepare(kind,input,t){
      const ch=copy(input.challenge),stamp=o.nowIso();
      if(!ch||!ch.id)throw failure('CHALLENGE_INVALID');
      const sender=ch.senderUid===t.uid,recipient=ch.recipientUid===t.uid;
      if(!sender&&!recipient)throw failure('NOT_PARTICIPANT');
      if(String(sender?ch.senderPlayerId:ch.recipientPlayerId)!==t.profileId)throw failure('CHALLENGE_PROFILE_CHANGED');
      if(kind==='accept'||kind==='decline'){
        if(!((ch.status==='pending'&&recipient)||(ch.status==='countered'&&ch.counterByUid&&ch.counterByUid!==t.uid)))throw failure('CHALLENGE_ACTION_UNAVAILABLE');
        ch.status=kind==='accept'?'accepted':'declined';if(kind==='accept'){ch.acceptedAt=stamp;ch.counterByUid='';}
      }else if(kind==='cancel'){ch.status='cancelled';}
      else if(kind==='counter'){
        const values=input.values||{};if(!values.flexibleTime&&!values.date)throw failure('CHALLENGE_DATE_REQUIRED');
        ch.flexibleTime=!!values.flexibleTime;ch.date=values.flexibleTime?'':values.date;ch.time=values.flexibleTime?'':values.time;
        ch.venue=values.venue;if(values.note)ch.note=values.note;ch.status='countered';ch.counterByUid=t.uid;ch.acceptedAt='';
      }else if(kind==='played'){
        if(ch.status==='played')throw failure('CHALLENGE_ACTION_UNAVAILABLE');ch.status='played';ch.playedMatchId=input.matchId;ch.playedAt=input.endedAt||stamp;
      }else if(kind!=='send')throw failure('CHALLENGE_ACTION_UNAVAILABLE');
      if(kind==='send'&&!sender)throw failure('NOT_PARTICIPANT');
      let value,field;
      if(sender){field='matchChallengesSent';value=copy(ch);value.updatedAt=stamp;delete value.responseUpdatedAt;}
      else{field='matchChallengeResponses';value={id:ch.id,status:ch.status,flexibleTime:!!ch.flexibleTime,date:ch.date||'',time:ch.time||'',venue:ch.venue||'',note:ch.note||'',counterByUid:ch.counterByUid||'',acceptedAt:ch.acceptedAt||'',playedMatchId:ch.playedMatchId||'',playedAt:ch.playedAt||'',updatedAt:stamp};}
      return {uid:t.uid,profileId:t.profileId,id:ch.id,kind,field,value};
    }
    // Verification never resends a PUT. Absence after an ambiguous request is not proof it cannot still arrive.
    async function reconcile(entry,t){
      check(t);if(!await o.authorize(t))throw failure('NO_AUTH');check(t);
      const end=o.beginWrite(),controller=new AbortController();verifications.add(controller);
      try{const remote=await o.readProfile({...t,signal:controller.signal});check(t);
        if(!same(remote?.[entry.field]?.[entry.id],entry.value))return {status:'unconfirmed',code:'CHALLENGE_WRITE_UNCONFIRMED'};
        clearJournal(t,entry);try{o.commit(remote,t);}catch(e){return {status:'saved',verified:true,id:entry.id,kind:entry.kind,refreshError:true};}return {status:'saved',verified:true,id:entry.id,kind:entry.kind};
      }finally{verifications.delete(controller);end();}
    }
    async function execute(kind,input,t){
      let entry;try{check(t);entry=readJournal(t);}catch(e){return {status:'rejected',code:e.code||'CHALLENGE_JOURNAL_UNAVAILABLE'};}
      if(entry){try{return await reconcile(entry,t);}catch(e){return {status:t.current()?'unknown':'stale',code:e.code||'CHALLENGE_VERIFY_FAILED'};}}
      let desired,body,end=null,sent=false;
      try{
        check(t);desired=prepare(kind,input,t);
        if(!await o.authorize(t))throw failure('NO_AUTH');check(t);
        // No await from final authorization through first request. The profile base is taken after queued writes.
        body=profile(t);end=o.beginWrite();check(t);
        body[desired.field]=(body[desired.field]&&typeof body[desired.field]==='object'&&!Array.isArray(body[desired.field]))?body[desired.field]:{};
        body[desired.field][desired.id]=copy(desired.value);
        desired.journalId=journalKey(t)+':'+o.operationId();
        try{o.journal.setItem(desired.journalId,JSON.stringify(desired));}catch(e){throw failure('CHALLENGE_JOURNAL_UNAVAILABLE');}
        check(t);sent=true;
        const response=await o.write(body,t);
        if(response.ok){
          // Acknowledged writes remain acknowledged even if local rendering or follow-up refresh fails.
          clearJournal(t,desired);if(!t.current())return {status:'saved',stale:true,id:desired.id};
          try{o.commit(body,t);}catch(e){return {status:'saved',id:desired.id,refreshError:true};}
          return {status:'saved',id:desired.id};
        }
        if(response.status>=400&&response.status<500&&response.status!==408){clearJournal(t,desired);return {status:'rejected',code:'PLAYER_SECURE_'+response.status};}
        return {status:'unknown',code:'CHALLENGE_WRITE_UNKNOWN'};
      }catch(e){
        if(!sent||e.code==='CHALLENGE_SESSION_CHANGED'){if(desired)clearJournal(t,desired);return {status:t.current()?'rejected':'stale',code:e.code||e.message};}
        return {status:'unknown',code:'CHALLENGE_WRITE_UNKNOWN'};
      }finally{end?.();}
    }
    function run(kind,input,ui={}){
      const t=ticket();if(!t.current())return Promise.resolve({status:'stale',code:'NO_AUTH'});
      const captured=copy(input),owner=ownerKey(t),resource=owner+'|'+(kind==='send'?'send':captured.challenge?.id),old=jobs.get(resource);
      if(old){if(old.kind===kind&&old.ticket.current())return old.promise;return Promise.resolve({status:'busy',code:'CHALLENGE_ACTION_BUSY'});}
      const job={kind,ticket:t};jobs.set(resource,job);
      if(t.current())try{ui.pending?.();}catch(e){/* UI failures do not change the write contract. */}
      const previous=queues.get(owner)||Promise.resolve();
      job.promise=previous.catch(()=>{}).then(()=>execute(kind,captured,t)).then(async result=>{
        if(!t.current()||result.stale)return result;
        try{ui.result?.(result);}catch(e){/* UI cannot undo a server result. */}
        if(result.status==='saved')try{await o.refresh(t);}catch(e){result.refreshError=true;}
        return result;
      }).finally(()=>{if(jobs.get(resource)===job)jobs.delete(resource);if(queues.get(owner)===job.promise)queues.delete(owner);if(t.current())try{ui.settled?.();}catch(e){}});
      queues.set(owner,job.promise);return job.promise;
    }
    function dispose(){disposed=true;epoch++;for(const controller of verifications)controller.abort();/* Sent writes and their markers are deliberately not aborted or erased. */}
    return Object.freeze({run,syncIdentity,dispose,snapshot:()=>({jobs:jobs.size,queues:queues.size,verifications:verifications.size,epoch,disposed})});
  }
  return Object.freeze({create});
});
