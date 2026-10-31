// Challenge action lifecycle. No persistence, replay, or inference of write completion from reads.
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MatchChallengeActions=api;})(typeof window==='object'?window:globalThis,function(){'use strict';
  const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const fail=code=>Object.assign(Error(code),{code});
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  const actions=new Set(['send','accept','decline','cancel','counter','played']);
  const fields=['id','senderUid','recipientUid','senderPlayerId','recipientPlayerId','status','discipline','date','time','venue','note','createdAt','updatedAt','acceptedAt','counterByUid','playedMatchId','playedAt','responseUpdatedAt'];
  function text(v){if(typeof v!=='string')throw fail('CHALLENGE_INPUT_INVALID');return v;}
  function id(v){const s=text(v);if(!s||['__proto__','constructor','prototype'].includes(s))throw fail('CHALLENGE_INPUT_INVALID');return s;}
  function projectChallenge(value){
    if(!object(value))throw fail('CHALLENGE_INPUT_INVALID');const result={};
    for(const key of fields)if(value[key]!==undefined&&value[key]!==null)result[key]=text(value[key]);
    for(const key of ['flexibleTime','isPublic'])if(value[key]!==undefined&&value[key]!==null){if(typeof value[key]!=='boolean')throw fail('CHALLENGE_INPUT_INVALID');result[key]=value[key];}
    if(value.raceTo!==undefined&&value.raceTo!==null){const v=value.raceTo;if(!(typeof v==='number'&&Number.isFinite(v))&&!(typeof v==='string'&&/^\d+$/.test(v)))throw fail('CHALLENGE_INPUT_INVALID');result.raceTo=v;}
    id(result.id);return result;
  }
  function capture(kind,input){
    if(!actions.has(kind)||!object(input))throw fail('CHALLENGE_ACTION_UNAVAILABLE');
    const result={challenge:projectChallenge(input.challenge)};
    if(kind==='counter'){
      const v=input.values;if(!object(v)||typeof v.flexibleTime!=='boolean')throw fail('CHALLENGE_INPUT_INVALID');
      result.values={flexibleTime:v.flexibleTime,date:text(v.date??''),time:text(v.time??''),venue:text(v.venue??''),note:text(v.note??'')};
    }
    if(kind==='played'){result.matchId=id(input.matchId);result.endedAt=text(input.endedAt??'');}
    return result;
  }
  function change(value){
    if(!object(value)||!['matchChallengesSent','matchChallengeResponses'].includes(value.field))throw fail('CHALLENGE_INPUT_INVALID');
    const result={field:value.field,id:id(value.id),value:projectChallenge(value.value)};
    if(result.value.id!==result.id)throw fail('CHALLENGE_INPUT_INVALID');return result;
  }
  function mapOrEmpty(value){if(value===undefined||value===null)return {};if(!object(value))throw fail('CHALLENGE_PROFILE_INVALID');return value;}
  // Existing profile envelope is transport data, not an action snapshot. Serialize its untouched
  // fields verbatim as JSON values; overlay only the whitelisted delta. No cache object is spread
  // into controller state, and no unknown server field is silently removed by the legacy full PUT.
  function encodeOverlay(base,added,special){
    const keys=Object.keys(base);for(const key of Object.keys(added))if(!own(base,key))keys.push(key);
    const parts=[];for(const key of keys){const encoded=special&&special.key===key?special.encode(base[key]):JSON.stringify(own(added,key)?added[key]:base[key]);if(encoded!==undefined)parts.push(JSON.stringify(key)+':'+encoded);}
    return '{'+parts.join(',')+'}';
  }
  function serializeProfile(profile,delta){
    if(!object(profile))throw fail('CHALLENGE_PROFILE_INVALID');const d=change(delta),field=d.field;
    const existingMap=mapOrEmpty(profile[field]);mapOrEmpty(existingMap[d.id]);
    return encodeOverlay(profile,{[field]:null},{key:field,encode:()=>encodeOverlay(existingMap,{[d.id]:null},{key:d.id,encode:old=>encodeOverlay(mapOrEmpty(old),d.value)})});
  }
  function applyChange(profile,delta){
    if(!object(profile))throw fail('CHALLENGE_PROFILE_INVALID');const d=change(delta),map=mapOrEmpty(profile[d.field]),entry=mapOrEmpty(map[d.id]);
    for(const key of Object.keys(d.value))Object.defineProperty(entry,key,{value:d.value[key],enumerable:true,writable:true,configurable:true});
    Object.defineProperty(map,d.id,{value:entry,enumerable:true,writable:true,configurable:true});
    Object.defineProperty(profile,d.field,{value:map,enumerable:true,writable:true,configurable:true});return profile;
  }
  const identityKey=s=>JSON.stringify([!!s.authenticated,String(s.uid||''),String(s.profileId||''),s.scope||'']);
  const ownerKey=t=>JSON.stringify([t.uid,t.profileId]);
  const noticeCopy=s=>s?{uid:s.uid,profileId:s.profileId,kind:s.kind,challengeId:s.challengeId,at:s.at}:null;
  function create(o){
    let currentKey=null,epoch=0,disposed=false;
    const jobs=new Map(),queues=new Map(),uncertain=new Map();
    function syncIdentity(){const next=identityKey(o.identity());if(next!==currentKey){currentKey=next;epoch++;}return currentKey;}
    function ticket(){
      syncIdentity();const s=o.identity(),generation=epoch,key=currentKey;
      const t={uid:String(s.uid||''),profileId:String(s.profileId||''),generation};
      t.current=()=>!disposed&&!!s.authenticated&&!!t.uid&&!!t.profileId&&epoch===generation&&key===identityKey(o.identity());return t;
    }
    function unknownForCurrent(){const t=ticket();return t.current()?noticeCopy(uncertain.get(ownerKey(t))):null;}
    function check(t){if(!t.current())throw fail('CHALLENGE_SESSION_CHANGED');}
    function markUnknown(kind,input,t){
      if(!disposed&&!uncertain.has(ownerKey(t)))uncertain.set(ownerKey(t),{uid:t.uid,profileId:t.profileId,kind,challengeId:input.challenge.id,at:text(o.nowIso())});
      if(t.current())try{o.unknownChanged?.();}catch(e){}return {status:'unknown',code:'CHALLENGE_WRITE_UNKNOWN'};
    }
    function prepare(kind,input,t){
      const ch=projectChallenge(input.challenge),stamp=text(o.nowIso());
      const sender=ch.senderUid===t.uid,recipient=ch.recipientUid===t.uid;
      if(!sender&&!recipient)throw fail('NOT_PARTICIPANT');
      if(String(sender?ch.senderPlayerId:ch.recipientPlayerId)!==t.profileId)throw fail('CHALLENGE_PROFILE_CHANGED');
      if(kind==='accept'||kind==='decline'){
        if(!((ch.status==='pending'&&recipient)||(ch.status==='countered'&&ch.counterByUid&&ch.counterByUid!==t.uid)))throw fail('CHALLENGE_ACTION_UNAVAILABLE');
        ch.status=kind==='accept'?'accepted':'declined';if(kind==='accept'){ch.acceptedAt=stamp;ch.counterByUid='';}
      }else if(kind==='cancel')ch.status='cancelled';
      else if(kind==='counter'){
        const v=input.values;if(!v.flexibleTime&&!v.date)throw fail('CHALLENGE_DATE_REQUIRED');
        ch.flexibleTime=v.flexibleTime;ch.date=v.flexibleTime?'':v.date;ch.time=v.flexibleTime?'':v.time;ch.venue=v.venue;if(v.note)ch.note=v.note;ch.status='countered';ch.counterByUid=t.uid;ch.acceptedAt='';
      }else if(kind==='played'){
        if(ch.status==='played')throw fail('CHALLENGE_ACTION_UNAVAILABLE');ch.status='played';ch.playedMatchId=input.matchId;ch.playedAt=input.endedAt||stamp;
      }else if(kind==='send'&&!sender)throw fail('NOT_PARTICIPANT');
      let value,field;
      if(sender){field='matchChallengesSent';value=projectChallenge(ch);value.updatedAt=stamp;delete value.responseUpdatedAt;}
      else{field='matchChallengeResponses';value={id:ch.id,status:ch.status,flexibleTime:!!ch.flexibleTime,date:ch.date||'',time:ch.time||'',venue:ch.venue||'',note:ch.note||'',counterByUid:ch.counterByUid||'',acceptedAt:ch.acceptedAt||'',playedMatchId:ch.playedMatchId||'',playedAt:ch.playedAt||'',updatedAt:stamp};}
      return {field,id:ch.id,value};
    }
    async function execute(kind,input,t){
      let end=null,sent=false;
      try{
        check(t);if(uncertain.has(ownerKey(t)))return {status:'blocked',code:'CHALLENGE_WRITE_UNKNOWN'};
        const delta=prepare(kind,input,t);
        if(!await o.authorize(t))throw fail('NO_AUTH');check(t);
        if(uncertain.has(ownerKey(t)))return {status:'blocked',code:'CHALLENGE_WRITE_UNKNOWN'};
        const p=o.profile(t.profileId);
        if(!p||String(p.id)!==t.profileId||(p.ownerUid&&String(p.ownerUid)!==t.uid))throw fail('CHALLENGE_PROFILE_CHANGED');
        end=o.beginWrite();check(t);
        const transport={uid:t.uid,profileId:t.profileId,generation:t.generation,current:t.current,markSent:()=>{check(t);sent=true;}};
        const response=await o.write(delta,transport);
        if(response.ok){
          if(!t.current())return {status:'saved',stale:true,id:delta.id};
          try{o.commit(delta,t);}catch(e){return {status:'saved',id:delta.id,refreshError:true};}
          return {status:'saved',id:delta.id};
        }
        if(response.status>=400&&response.status<500&&response.status!==408)return {status:'rejected',code:'PLAYER_SECURE_'+response.status};
        return sent?markUnknown(kind,input,t):{status:'rejected',code:'CHALLENGE_TRANSPORT_NOT_STARTED'};
      }catch(e){
        if(!sent)return {status:t.current()?'rejected':'stale',code:e.code||e.message};
        return markUnknown(kind,input,t);
      }finally{end?.();}
    }
    function run(kind,input,ui={}){
      const t=ticket();if(!t.current())return Promise.resolve({status:'stale',code:'NO_AUTH'});
      let captured;try{captured=capture(kind,input);}catch(e){const result={status:'rejected',code:e.code||'CHALLENGE_INPUT_INVALID'};try{ui.result?.(result);}catch(e){}return Promise.resolve(result);}
      const owner=ownerKey(t),resource=owner+'|'+(kind==='send'?'send':captured.challenge.id),old=jobs.get(resource);
      if(old){if(old.kind===kind&&old.ticket.current())return old.promise;return Promise.resolve({status:'busy',code:'CHALLENGE_ACTION_BUSY'});}
      const job={kind,ticket:t};jobs.set(resource,job);try{ui.pending?.();}catch(e){}
      const previous=queues.get(owner)||Promise.resolve();
      job.promise=previous.catch(()=>{}).then(()=>execute(kind,captured,t)).then(async result=>{
        if(!t.current()||result.stale)return result;
        try{ui.result?.(result);}catch(e){}
        if(result.status==='saved')try{await o.refresh(t);}catch(e){result.refreshError=true;}
        return result;
      }).finally(()=>{if(jobs.get(resource)===job)jobs.delete(resource);if(queues.get(owner)===job.promise)queues.delete(owner);if(t.current())try{ui.settled?.();}catch(e){}});
      queues.set(owner,job.promise);return job.promise;
    }
    function dispose(){disposed=true;epoch++;uncertain.clear();/* Already sent PUTs are not revoked. */}
    return Object.freeze({run,syncIdentity,unknownForCurrent,dispose,snapshot:()=>({jobs:jobs.size,queues:queues.size,unknownOwners:uncertain.size,epoch,disposed})});
  }
  return Object.freeze({create,projectChallenge,serializeProfile,applyChange});
});
