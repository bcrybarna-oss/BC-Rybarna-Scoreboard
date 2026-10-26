// Pure Federal Cup calculations and report models. No application state or side effects.
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FederalStatistics=api;
})(typeof window==='object'?window:globalThis,function(){
  'use strict';
  function federalRackScoresAgree(m){
    const racks=Object.values(m.federalTeam?.racks||m.federalEvidence?.racks||{}),wins=[0,0],ids=new Set();
    for(const r of racks){if(!r.id||ids.has(r.id)||![0,1].includes(r.winner)||![0,1].includes(r.breaker))return false;ids.add(r.id);wins[r.winner]++;}
    return wins.every((n,i)=>n===Number(m.scores?.[i]||0));
  }

  // Federal Cup calculation contract v1. Pure readers; no UI, globals or persistence.
  function federalMetric(kind,numerator,denominator,coverage='complete',reasons=[],components={}){
    const valid=n=>Number.isFinite(n)&&Number.isInteger(n)&&n>=0;
    if(numerator!==null&&!valid(numerator)||denominator!==null&&!valid(denominator)){
      reasons=[...reasons,'invalid_number'];coverage='partial';
    }
    if(kind!=='count'&&denominator!==null&&numerator!==null&&kind!=='average'&&numerator>denominator){reasons=[...reasons,'inconsistent_ratio'];coverage='partial';}
    let value=null;
    if(coverage==='complete'&&numerator!==null){
      if(kind==='count')value=numerator;
      else if(denominator>0)value=numerator/denominator*(kind==='percent'?100:1);
      else reasons=[...reasons,'zero_denominator'];
    }
    return {kind,numerator,denominator:kind==='count'?null:denominator,count:kind==='count'?numerator:null,value,coverage,reasons:[...new Set(reasons)].sort(),components};
  }
  function federalStatsRows(collection){return Object.values(collection||{}).filter(x=>x&&typeof x==='object');}
  function federalStatsRackRows(m){
    const ids=new Set(),numbers=new Set();
    return federalStatsRows(m.federalTeam?.racks||m.federalEvidence?.racks).filter(r=>{
      if(r.id&&ids.has(r.id)||r.rack!=null&&numbers.has(Number(r.rack)))return false;
      if(r.id)ids.add(r.id);if(r.rack!=null)numbers.add(Number(r.rack));return true;
    });
  }
  function federalStatsRacksComplete(m){
    const racks=federalStatsRows(m.federalTeam?.racks||m.federalEvidence?.racks);
    if(![0,1].every(i=>m.scores?.[i]!=null&&Number.isInteger(Number(m.scores[i]))&&Number(m.scores[i])>=0))return false;
    const numbers=new Set();
    if(racks.some(r=>{const n=Number(r.rack),duplicate=numbers.has(n);numbers.add(n);return !Number.isInteger(n)||n<1||duplicate||r.matchId&&r.matchId!==m.id||r.year!=null&&Number(r.year)!==Number(m.federalCupLink?.year);}))return false;
    return federalRackScoresAgree({...m,federalTeam:null,federalEvidence:{racks}});
  }
  // Read surviving history only, never sum undo snapshots as played racks.
  // This deliberately narrow fallback requires a complete legal 9/10-ball chain.
  function federalStatsHistoricalRacks(m){
    if(m.federalTeam||Object.hasOwn(m.federalEvidence||{},'racks')||federalStatsRows(m.federalEvidence?.serviceChanges).some(s=>s.coverage?.racks==='partial')||m.status!=='complete'||
      !['9-ball','10-ball'].includes(m.discipline)||m.ghostMode||m.winnerTableMode)return [];
    const validScore=s=>Array.isArray(s)&&s.length===2&&s.every(n=>Number.isInteger(n)&&n>=0);
    if(!validScore(m.scores))return [];
    const total=m.scores[0]+m.scores[1],records=federalStatsRows(m.detailedPlay?.records),events=federalStatsRows(m.events);
    if(!total||m.rackNumber!==total||!records.length)return [];
    // Firebase drops null properties and empty collections, including inside old ledgers.
    const cloud=v=>{
      if(v==null)return null;
      if(Array.isArray(v)){const a=v.map(cloud);return a.some(x=>x!==null)?a:null;}
      if(typeof v==='object'){const a=Object.keys(v).sort().map(k=>[k,cloud(v[k])]).filter(([,x])=>x!==null);return a.length?Object.fromEntries(a):null;}
      return v;
    };
    const signature=r=>JSON.stringify(cloud(r)),ids=new Set(),groups=new Map();
    let lastRack=1;
    for(const r of records){
      if(!r.id||ids.has(r.id)||!Number.isInteger(r.rack)||r.rack<lastRack||r.rack>total||
        ![0,1].includes(r.side)||r.sideId!==m.playerIds?.[r.side]||
        r.evidenceVersion!=null&&![1,2].includes(r.evidenceVersion)||
        ['table_correction','turn_correction'].includes(r.kind))return [];
      ids.add(r.id);lastRack=r.rack;
      if(!groups.has(r.rack))groups.set(r.rack,[]);groups.get(r.rack).push(r);
    }
    const snapshots=new Map(),scoreEvents=new Map(),eventIds=new Set();
    let currentRack=0,lastPrefix=0;
    for(const [index,e]of events.entries()){
      if(!e.id||eventIds.has(e.id))return [];eventIds.add(e.id);
      // Score service changes are not evidence of a played rack.
      if(/oprava skóre|korekce skóre|turnajové skóre/i.test(e.text||''))return [];
      if(e.meta?.undoSnapshot){
        let s;try{s=JSON.parse(e.meta.undoSnapshot);}catch{return [];}
        const rows=federalStatsRows(s?.detailedPlay?.records),rack=s?.rackNumber;
        if(!Number.isInteger(rack)||rack<currentRack||rack>total||!validScore(s.scores)||
          rows.length<lastPrefix||rows.length>records.length||
          rows.some((r,i)=>signature(r)!==signature(records[i])))return [];
        currentRack=rack;lastPrefix=rows.length;
        if(!snapshots.has(rack))snapshots.set(rack,[]);
        snapshots.get(rack).push({eventId:e.id,index,state:s,prefix:rows.length});
      }
      const score=/^Skóre (\d+):(\d+)$/.exec(e.text||'');
      if(score){if(!currentRack||scoreEvents.has(currentRack))return [];scoreEvents.set(currentRack,{eventId:e.id,index,scores:[Number(score[1]),Number(score[2])]});}
    }
    const result=[];let before=[0,0],offset=0;
    for(let rack=1;rack<=total;rack++){
      const rows=groups.get(rack)||[],breaks=rows.filter(r=>r.kind==='break'),snaps=snapshots.get(rack)||[],score=scoreEvents.get(rack);
      const first=snaps[0],last=snaps.at(-1),terminal=rows.at(-1),gameBall=m.discipline==='9-ball'?9:10;
      if(breaks.length!==1||rows[0]!==breaks[0]||!first||!last||!score||
        !first.state.isBreakShot||first.prefix!==offset||first.state.turn!==breaks[0].side||
        snaps.some(s=>s.state.breaker!==breaks[0].side||s.state.scores.some((n,i)=>n!==before[i]))||
        last.prefix!==offset+rows.length-1||last.state.turn!==terminal.side||score.index<=last.index)return [];
      // A retained legal game-ball stroke AND a one-point score transition are required.
      // Ace, foul or manually awarded endings without this proof stay unknown.
      if(terminal.kind!=='pot'||terminal.foul===true||!terminal.balls?.includes(gameBall)||
        rows.slice(0,-1).some(r=>r.balls?.includes(gameBall)))return [];
      const delta=score.scores.map((n,i)=>n-before[i]),winner=terminal.side;
      if(delta[winner]!==1||delta[1-winner]!==0||rack<total&&
        snapshots.get(rack+1)?.[0]?.index<=score.index)return [];
      result.push({rack,breaker:breaks[0].side,winner,source:'surviving_history',
        breakRecordId:breaks[0].id,winningRecordId:terminal.id,
        beforeEventId:first.eventId,terminalSnapshotEventId:last.eventId,scoreEventId:score.eventId,
        scoreBefore:before.slice(),scoreAfter:score.scores.slice()});
      before=score.scores;offset+=rows.length;
    }
    return before.every((n,i)=>n===m.scores[i])?result:[];
  }
  function federalStatsRecordSignature(value){
    return Array.isArray(value)?JSON.stringify(value.map(federalStatsRecordSignature)):
      value&&typeof value==='object'?JSON.stringify(Object.keys(value).sort().map(k=>[k,federalStatsRecordSignature(value[k])])):JSON.stringify(value);
  }
  function federalStatsRecordIndex(collection){
    const byId=new Map();
    for(const r of federalStatsRows(collection))if(typeof r.id==='string'&&r.id){const group=byId.get(r.id)||[];group.push(r);byId.set(r.id,group);}
    const conflicts=new Set([...byId].filter(([,group])=>new Set(group.map(federalStatsRecordSignature)).size>1).map(([id])=>id));
    return {byId,conflicts};
  }
  // Pure compatibility reader for ordinary-counter records linked to FC later.
  // Never writes a version marker, migrates the ledger or guesses missing counts.
  function federalStatsReadableShot(record){
    if(record.evidenceVersion===2)return record;
    const r={...record},has=k=>Object.hasOwn(record,k),valid=n=>Number.isInteger(n)&&n>=0;
    const count=has('pottedCount')?record.pottedCount:Array.isArray(record.balls)?record.balls.length:null;
    // Only the documented old schema is readable; future schemas remain unknown.
    const supported=record.evidenceVersion==null||record.evidenceVersion===1;
    if(!supported)return {...r,intent:'unknown',pottedCount:null,potsEvidence:'unknown',pottingAttempts:null,successfulPottingStrokes:null};
    const intent=supported?({pot:'pot',miss:'pot',break:'other',safety:'safety',escape:'escape',push_out:'other'}[r.kind]||'unknown'):'unknown';
    if(!has('intent'))r.intent=intent;
    if(!has('pottedCount'))r.pottedCount=count;
    if(!has('potsEvidence'))r.potsEvidence=supported&&['pot','escape'].includes(r.kind)?'explicit':
      supported&&['break','safety','push_out','miss','foul'].includes(r.kind)?'not_applicable':'unknown';
    let attempts=null,successful=null;
    if(supported&&r.kind==='pot'&&r.intent==='pot'&&valid(count)&&count>0){
      // A sequential batch explicitly declares one successful stroke per ball;
      // a single/multipot explicitly declares one stroke. Ball count alone does not.
      attempts=r.entry==='sequential_batch'?count:r.strokeCount===1?1:null;
      successful=attempts;
    }else if(supported&&r.kind==='miss'&&r.intent==='pot'){
      attempts=r.strokeCount===1?1:null;successful=0;
    }else if(supported&&['break','safety','push_out','escape'].includes(r.kind)&&['other','safety','escape'].includes(r.intent)){
      attempts=0;successful=0;
    }else if(supported&&r.kind==='foul'){
      // Explicit attacking intent is required; a foul is not automatically a miss.
      attempts=r.intent==='pot'&&r.strokeCount===1?1:['safety','other','escape'].includes(r.intent)?0:null;
      successful=0;
    }
    if(!has('pottingAttempts'))r.pottingAttempts=attempts;
    if(!has('successfulPottingStrokes'))r.successfulPottingStrokes=successful;
    return r;
  }
  function federalStatsShotIssues(m,side,referenceRecords=null){
    const records=federalStatsRows(referenceRecords||m.detailedPlay?.records),racks=federalStatsRackRows(m),{byId,conflicts}=federalStatsRecordIndex(records),refs=new Map(),issues=new Set();
    const affects=r=>!r || ![0,1].includes(r.side) || r.side===side;
    const actorConflict=(r,rack)=>{
      if(!r.actor?.id)return false; // Older records may be attributable through a stable rack snapshot.
      const people=m.federalTeam?[rack?.players?.[r.side]]:federalStatsRows(m.federalCupLink?.lineupParticipants?.[r.side]);
      return people.some(Boolean) && (!people.some(p=>p?.id===r.actor.id) || r.actor.identityStatus==='legacy' ||
        r.actor.year!=null && Number(r.actor.year)!==Number(m.federalCupLink?.year));
    };
    for(const r of records){
      if(referenceRecords&&!racks.some(x=>x.rack===r.rack))continue;
      if((typeof r.id!=='string'||!r.id)&&affects(r))issues.add('invalid_shot_record');
      if(affects(r)){
        if(r.matchId!=null&&r.matchId!==m.id || r.year!=null&&Number(r.year)!==Number(m.federalCupLink?.year))issues.add('shot_match_reference_conflict');
        const rack=racks.find(x=>x.rack===r.rack);
        if(actorConflict(r,rack))issues.add('shot_actor_reference_conflict');
      }
    }
    for(const [id,group]of byId)if(group.length>1&&group.some(affects)&&(!referenceRecords||group.some(r=>racks.some(x=>x.rack===r.rack)))){
      issues.add('duplicate_shot_record');
      if(conflicts.has(id))issues.add('conflicting_shot_record');
    }
    for(const rack of racks)for(const id of Object.values(rack.shotIds||{})){
      if(typeof id!=='string'||!id){issues.add('invalid_shot_reference');continue;}
      const matches=byId.get(id)||[],previous=refs.get(id);
      if(!matches.length){issues.add('missing_shot_reference');continue;}
      if(matches.some(affects)){
        if(previous)issues.add('duplicate_shot_reference');
        if(matches.length>1)issues.add('duplicate_shot_record');
        if(matches.some(r=>r.rack!==rack.rack))issues.add('shot_rack_reference_conflict');
        if(matches.some(r=>r.matchId!=null&&r.matchId!==m.id))issues.add('shot_match_reference_conflict');
        if(matches.some(r=>actorConflict(r,rack)))issues.add('shot_actor_reference_conflict');
      }
      refs.set(id,rack);
    }
    return [...issues].sort();
  }
  function federalTaggedMetric(m,side,type,referenceRecords=null){
    const st=m.stats?.[side]||{},prefix=type+'Shot',raw=federalStatsRows(m.detailedPlay?.records);
    const {byId}=federalStatsRecordIndex(raw),{conflicts}=federalStatsRecordIndex(referenceRecords||raw);
    const records=[...byId].filter(([id,rows])=>!conflicts.has(id)&&rows[0].side===side).map(([,rows])=>rows[0]);
    const reasons=federalStatsShotIssues(m,side,referenceRecords),fresh=m.federalEvidence?.fromStart===true;
    const valid=n=>Number.isInteger(n)&&n>=0;
    const attempts=valid(st[prefix+'Attempts'])?st[prefix+'Attempts']:null,successful=valid(st[prefix+'Successful'])?st[prefix+'Successful']:null;
    const countersKnown=attempts!==null&&successful!==null;
    if(!fresh)reasons.push('legacy_coverage');
    if(m.detailedPlay?.coverage!=='complete')reasons.push('partial_tag_history');
    if([prefix+'Attempts',prefix+'Successful'].some(k=>!Object.hasOwn(st,k)))reasons.push('missing_tag_counter');
    if([prefix+'Attempts',prefix+'Successful'].some(k=>Object.hasOwn(st,k)&&!valid(st[k])))reasons.push('invalid_tag_counter');
    if(st[prefix+'Partial'])reasons.push('partial_tag_counter');
    for(const k of [prefix+'Attempts',prefix+'Successful'])reasons.push(...(m.federalCounterIssues?.[side]?.[k]||[]));
    if(federalStatsRows(m.federalEvidence?.serviceChanges).some(s=>s.coverage?.potting==='partial'))reasons.push('score_correction_missing_racks');
    let n=0,d=0,knownResults=0,sawTag=false;
    for(const r of records){
      if(r.tag&&!['jump','bank'].includes(r.tag.type)){reasons.push('unknown_shot_tag');continue;}
      if(r.tag?.type!==type)continue;
      sawTag=true;
      if(!['pot','miss','foul','escape'].includes(r.kind)||r.kind==='escape'&&type==='bank'||r.strokeCount!=null&&r.strokeCount!==1){reasons.push('invalid_tag_action');continue;}
      d++;
      let expected=null;
      if(['miss','foul'].includes(r.kind)||r.foul===true)expected=false;
      else if(r.kind==='escape'&&typeof r.success==='boolean')expected=r.success;
      else if(r.kind==='pot'){
        const balls=r.pottedCount??(Array.isArray(r.balls)?r.balls.length:null);
        if(valid(balls))expected=balls>0;
      }
      if(typeof r.tag.success!=='boolean'||expected===null){reasons.push('unknown_tag_result');continue;}
      if(r.tag.success!==expected){reasons.push('tag_result_conflict');continue;}
      knownResults++;if(r.tag.success)n++;
    }
    if(countersKnown&&(attempts!==d||successful!==n))reasons.push('tag_counter_mismatch');
    const components={recordAttempts:d,recordSuccessful:knownResults?n:d===0?0:null,counterAttempts:attempts,counterSuccessful:successful};
    // Summary-only history is useful at side level, but cannot prove any person's strokes.
    if(!sawTag&&countersKnown&&(!m.detailedPlay||attempts>0)){
      if(referenceRecords===null)return federalMetric('ratio',successful,attempts,'partial',[...reasons,'summary_only_tags'],{...components,summaryOnly:true});
      return federalMetric('ratio',null,null,'unknown',[...reasons,'unattributed_tag_totals'],components);
    }
    if(!sawTag&&!countersKnown)return federalMetric('ratio',null,null,'unknown',reasons,components);
    const numerator=knownResults||d===0?n:null;
    return federalMetric('ratio',numerator,d,reasons.length?(numerator===null?'unknown':'partial'):'complete',reasons,components);
  }
  function federalStatsSide(m,side,referenceRecords=null){
    const st=m.stats?.[side]||{},fresh=m.federalEvidence?.fromStart===true;
    const raw=federalStatsRows(m.detailedPlay?.records),seen=new Map(),all=[],duplicateSides=new Set(),duplicateBreakSides=new Set();
    for(const r of raw){
      const previous=r.id?seen.get(r.id):null;
      if(!r.id||previous){for(const x of [r,previous].filter(Boolean)){duplicateSides.add(x.side);if(x.kind==='break')duplicateBreakSides.add(x.side);}}
      if(previous)continue;if(r.id)seen.set(r.id,r);all.push(r);
    }
    const duplicate=duplicateSides.has(side),{conflicts}=federalStatsRecordIndex(referenceRecords||raw),records=all.filter(r=>r.side===side&&!conflicts.has(r.id));
    const racks=federalStatsRackRows(m),services=federalStatsRows(m.federalEvidence?.serviceChanges);
    const num=k=>Object.hasOwn(st,k)&&Number.isInteger(st[k])&&st[k]>=0?st[k]:null;
    const metric=(kind,n,d,keys,extra=[],components={})=>{
      const reasons=[...extra,...keys.flatMap(k=>m.federalCounterIssues?.[side]?.[k]||[])];
      if(service('potting'))reasons.push('score_correction_missing_racks');
      if(!fresh)reasons.push('legacy_coverage');
      if(keys.some(k=>!Object.hasOwn(st,k)))reasons.push('missing_counter');
      if(keys.some(k=>Object.hasOwn(st,k)&&num(k)===null))reasons.push('invalid_counter');
      const coverage=reasons.length?(n===null?'unknown':'partial'):'complete';
      return federalMetric(kind,n,d,coverage,reasons,components);
    };
    const service=domain=>services.some(s=>s.coverage?.[domain]==='partial');
    // beginRack reserves one counter before the actual break is performed.
    const pending=!!m.isBreakShot&&m.breaker===side&&!m.federalTeam?.pending?1:0;
    const total=num('breaks')===null?null:num('breaks')-pending,dry=num('dryBreaks'),soft=num('softBreaks'),overlap=num('softDryBreaks'),bf=num('breakFouls');
    const breakRecords=records.filter(r=>r.kind==='break');
    const breakReasons=[];
    if(fresh&&total!==null&&breakRecords.length!==total)breakReasons.push('break_record_gap');
    if(duplicateBreakSides.has(side))breakReasons.push('duplicate_record');
    if(total!==null&&[dry,soft,overlap,bf].every(v=>v!==null)&&
      (dry>total||soft>total||bf>total||overlap>Math.min(dry,soft)))breakReasons.push('inconsistent_break_counters');
    if(service('potting'))breakReasons.push('score_correction_missing_racks');
    const successful=[total,dry,soft,overlap,bf].some(v=>v===null)?null:total-dry-soft+overlap-bf;
    const metrics={};
    metrics.breakSuccess=metric('percent',successful,total,['breaks','dryBreaks','softBreaks','softDryBreaks','breakFouls'],breakReasons);
    metrics.drySoftBreaks=metric('count',[dry,soft,overlap].some(v=>v===null)?null:dry+soft-overlap,null,['dryBreaks','softBreaks','softDryBreaks'],breakReasons);
    metrics.foulBreaks=metric('count',bf,null,['breakFouls'],breakReasons);
    const balls=num('breakPottedBalls'),tracked=num('breakPottedTracked'),ballReasons=[...breakReasons];
    if(tracked!==null&&total!==null&&tracked!==total)ballReasons.push('untracked_break_balls');
    if(tracked!==null&&total!==null&&tracked>total)ballReasons.push('inconsistent_break_tracking');
    // Counted foul/soft break balls are real fallen balls, even when later spotted.
    const recordedBallCounts=breakRecords.map(r=>Number.isInteger(r.ballCount)?r.ballCount:
      (r.result==='ace'||r.result==='dry_break'||r.ballNumbersKnown===true)&&Array.isArray(r.balls)?r.balls.length:null);
    if(fresh&&(recordedBallCounts.some(n=>n===null||n<0)||recordedBallCounts.every(n=>n!==null)&&balls!==null&&recordedBallCounts.reduce((a,b)=>a+b,0)!==balls))ballReasons.push('break_ball_record_gap');
    metrics.breakBallAverage=metric('average',balls,total,['breaks','breakPottedBalls','breakPottedTracked'],ballReasons,{trackedBreaks:tracked});
    const countMetric=(key,extra=[])=>metric('count',num(key),null,[key],extra);
    const rackReasons=[];
    if(!fresh)rackReasons.push('legacy_racks');
    if(service('racks'))rackReasons.push('score_correction_racks');
    if(!federalStatsRacksComplete(m))rackReasons.push('incomplete_rack_history');
    const historical=!racks.length?federalStatsHistoricalRacks(m):[],ownRacks=historical.length?historical:racks;
    const own=ownRacks.filter(r=>r.breaker===side),ownWins=own.filter(r=>r.winner===side).length;
    metrics.ownBreakWins=federalMetric('ratio',fresh||ownRacks.length?ownWins:null,fresh||ownRacks.length?own.length:null,
      historical.length?'complete':rackReasons.length?(racks.length?'partial':'unknown'):'complete',
      historical.length?[]:rackReasons,historical.length?{source:'surviving_history',racks:historical}:{});
    const ownMetric=metrics.ownBreakWins;
    metrics.ownBreakLosses=federalMetric('count',ownMetric.numerator===null||ownMetric.denominator===null?null:ownMetric.denominator-ownMetric.numerator,null,ownMetric.coverage,ownMetric.reasons);
    for(const [name,key,flag]of [['aces','aces','ace'],['cleanRuns','breakAndRun','breakAndRun']]){
      const reasons=[];
      if(service('potting'))reasons.push('score_correction_missing_racks');
      if(fresh&&!federalStatsRacksComplete(m))reasons.push('incomplete_rack_history');
      if(fresh&&racks.some(r=>r[flag]==null))reasons.push('missing_rack_outcome');
      if(fresh&&racks.filter(r=>r.winner===side&&r[flag]===true).length!==num(key))reasons.push('rack_counter_mismatch');
      if(flag==='breakAndRun'&&racks.some(r=>r.ace===true&&r.breakAndRun===true))reasons.push('ace_run_conflict');
      metrics[name]=countMetric(key,reasons);
    }
    const correction=all.some(r=>r.kind==='turn_correction'||r.kind==='table_correction'&&!r.foulId);
    const referenceIssues=federalStatsShotIssues(m,side,referenceRecords);
    const potReasons=[...referenceIssues],attackReasons=[...referenceIssues];
    if(!fresh){potReasons.push('legacy_coverage');attackReasons.push('legacy_coverage');}
    if(m.detailedPlay?.coverage&&m.detailedPlay.coverage!=='complete'){potReasons.push('partial_detailed_history');attackReasons.push('partial_detailed_history');}
    if(correction){potReasons.push('unassigned_correction');attackReasons.push('unassigned_correction');}
    if(service('pots'))potReasons.push('score_correction_pots');
    if(service('potting'))attackReasons.push('score_correction_potting');
    if(duplicate){potReasons.push('duplicate_record');attackReasons.push('duplicate_record');}
    if(all.some(r=>![0,1].includes(r.side))){potReasons.push('unknown_side');attackReasons.push('unknown_side');}
    let explicit=0,derived=0,attempts=0,success=0,unknownPots=false,unknownAttempts=false,unknownSuccess=false;
    for(const original of records){
      const r=federalStatsReadableShot(original);
      if(original.evidenceVersion!==2){
        potReasons.push('legacy_record');attackReasons.push('legacy_record');
      }
      const valid=n=>Number.isInteger(n)&&n>=0;
      const count=r.pottedCount??(Array.isArray(r.balls)?r.balls.length:null);
      if(r.potsEvidence==='unknown'||['pot','escape','inferred_pots'].includes(r.kind)&&
        (!['explicit','derived'].includes(r.potsEvidence)||!valid(count))||r.potsEvidence==='derived'&&(r.kind!=='inferred_pots'||r.derivationSafe!==true))unknownPots=true;
      if(!valid(r.pottingAttempts))unknownAttempts=true;
      if(!valid(r.successfulPottingStrokes))unknownSuccess=true;
      if(!['pot','safety','escape','other','unknown'].includes(r.intent)||r.intent==='unknown'&&!(r.kind==='inferred_pots'&&(r.pottedCount??r.balls?.length)===0))attackReasons.push('unknown_intent');
      if(['pot','escape','inferred_pots'].includes(r.kind)&&!['explicit','derived','unknown'].includes(r.potsEvidence))potReasons.push('missing_pot_evidence');
      if(valid(r.pottingAttempts))attempts+=r.pottingAttempts;
      if(valid(r.successfulPottingStrokes))success+=r.successfulPottingStrokes;
      if(!valid(r.pottingAttempts)||!valid(r.successfulPottingStrokes))attackReasons.push('unknown_attempts');
      else {
        if(r.successfulPottingStrokes>r.pottingAttempts||r.intent!=='pot'&&r.pottingAttempts>0||
          ['break','safety','push_out'].includes(r.kind)&&r.pottingAttempts>0||
          (r.kind==='foul'||r.kind==='miss'||r.foul===true)&&r.successfulPottingStrokes>0)attackReasons.push('inconsistent_attack');
      }
      if(r.pottedCount!=null&&r.balls?.length&&r.pottedCount!==r.balls.length)potReasons.push('inconsistent_pot_count');
      if(r.kind==='foul'||r.kind==='break'||r.kind==='push_out'||r.foul===true)continue;
      if(r.potsEvidence==='unknown')potReasons.push('unknown_pots');
      if(r.potsEvidence==='explicit'||r.potsEvidence==='derived'){
        if(!valid(count))potReasons.push('unknown_pots');
        else if(r.potsEvidence==='derived'&&(r.kind!=='inferred_pots'||r.derivationSafe!==true))potReasons.push('unsafe_derivation');
        else if(r.potsEvidence==='explicit'&&!['pot','escape'].includes(r.kind))potReasons.push('invalid_pot_source');
        else if(r.potsEvidence==='explicit')explicit+=count;else derived+=count;
      }
    }
    const recordCoverage=reasons=>reasons.length?(fresh||records.length?'partial':'unknown'):'complete';
    const knownPots=fresh||records.length?(explicit+derived>0||!unknownPots?explicit+derived:null):null;
    const knownSuccess=fresh||records.length?(success>0||!unknownSuccess?success:null):null;
    const knownAttempts=fresh||records.length?(attempts>0||!unknownAttempts?attempts:null):null;
    metrics.pottedBalls=federalMetric('count',knownPots,null,knownPots===null?'unknown':recordCoverage(potReasons),potReasons,{explicit,derived});
    metrics.pottingSuccess=federalMetric('percent',knownSuccess,knownAttempts,knownSuccess===null&&knownAttempts===null?'unknown':recordCoverage(attackReasons),attackReasons);
    const attack=metrics.pottingSuccess,missed=attack.numerator===null||attack.denominator===null||success>attempts?null:attempts-success;
    metrics.missedPots=federalMetric('count',missed,null,missed===null?'unknown':attack.coverage,attack.reasons);
    const safetyReasons=[];
    if(num('trackedSafeties')!==null&&num('safeties')!==null&&num('trackedSafeties')!==num('safeties'))safetyReasons.push('unevaluated_safeties');
    metrics.safetySuccess=metric('percent',num('successfulSafeties'),num('trackedSafeties'),['safeties','trackedSafeties','successfulSafeties'],safetyReasons);
    metrics.escapeSuccess=metric('percent',num('successfulSafetyEscapes'),num('safetyEscapes'),['safetyEscapes','successfulSafetyEscapes']);
    metrics.resafes=countMetric('resafes',num('resafes')!==null&&num('successfulSafetyEscapes')!==null&&num('resafes')>num('successfulSafetyEscapes')?['inconsistent_resafes']:[]);
    metrics.fouls=countMetric('fouls',num('breakFouls')!==null&&num('fouls')!==null&&num('breakFouls')>num('fouls')?['inconsistent_fouls']:[]);
    metrics.jumpShots=federalTaggedMetric(m,side,'jump',referenceRecords);
    metrics.bankShots=federalTaggedMetric(m,side,'bank',referenceRecords);
    return metrics;
  }
  function federalStatsOwner(m,side){
    const link=m.federalCupLink||{},type=link.type||(m.federalTeam?'team':m.doublesMode?'doubles':'singles');
    if(type==='team')return {kind:'team',id:side===0?'a':'b',name:side===0?'Slovensko':'Česko'};
    const people=federalStatsRows(link.lineupParticipants?.[side]);
    const stable=p=>p.id&&p.identityStatus!=='legacy'&&!String(p.id).startsWith('__')&&(!p.year||Number(p.year)===Number(link.year));
    const ids=people.map(p=>p.id);
    if(people.length!==(type==='doubles'?2:1)||!people.every(stable)||new Set(ids).size!==ids.length)return {kind:'unknown',id:null,reason:'ambiguous_identity'};
    if(type==='doubles')return {kind:'pair',id:JSON.stringify(ids.slice().sort()),participantIds:ids.slice().sort(),name:people.map(p=>p.name).join(' / ')};
    return {kind:'participant',id:people[0].id,name:people[0].name};
  }
  function federalCalculateMatch(m){
    const year=Number(m.federalCupLink?.year),fixtureNo=Number(m.federalCupLink?.fixtureNo);
    const type=m.federalCupLink?.type||(m.federalTeam?'team':m.doublesMode?'doubles':'singles');
    const result={version:1,year,fixtureNo,matchId:m.id||null,type,sides:[0,1].map(side=>({owner:federalStatsOwner(m,side),metrics:federalStatsSide(m,side)})),individuals:{},pairs:{},unattributed:[]};
    for(const side of [0,1]){
      const entry=result.sides[side],owner=entry.owner;
      if(owner.kind==='participant'&&federalStatsRows(m.detailedPlay?.records).some(r=>r.side===side&&r.actor?.id&&r.actor.id!==owner.id)){
        for(const [key,x]of Object.entries(entry.metrics))entry.metrics[key]=federalMetric(x.kind,x.numerator,x.denominator,x.numerator===null?'unknown':'partial',[...x.reasons,'actor_lineup_conflict'],x.components);
        result.unattributed.push({side,reason:'actor_lineup_conflict'});
      }
      const personal={...entry,metrics:{...entry.metrics}};
      for(const key of ['jumpShots','bankShots'])if(personal.metrics[key].components.summaryOnly){
        const x=personal.metrics[key];personal.metrics[key]=federalMetric('ratio',null,null,'unknown',[...x.reasons,'unattributed_tag_totals'],x.components);
      }
      if(owner.kind==='participant'&&!Object.hasOwn(result.individuals,owner.id))Object.defineProperty(result.individuals,owner.id,{value:personal,enumerable:true,configurable:true});
      else if(owner.kind==='participant'){delete result.individuals[owner.id];result.unattributed.push({side,reason:'identity_on_both_sides'});}
      if(owner.kind==='pair'&&!Object.hasOwn(result.pairs,owner.id))Object.defineProperty(result.pairs,owner.id,{value:entry,enumerable:true,configurable:true});
      else if(owner.kind==='pair'){delete result.pairs[owner.id];result.unattributed.push({side,reason:'identity_on_both_sides'});}
      if(owner.kind==='unknown')result.unattributed.push({side,reason:owner.reason});
    }
    if(type!=='team')return result;
    const racks=federalStatsRackRows(m),groups=new Map();
    for(const r of federalStatsRows(m.detailedPlay?.records))if(![0,1].includes(r.side)||!racks.some(rack=>rack.rack===r.rack))result.unattributed.push({side:r.side??null,recordId:r.id||null,reason:'unassigned_shot_rack'});
    for(const side of [0,1])for(const rack of racks){
      const p=rack.players?.[side],ids=Object.values(rack.participantIds?.[side]||{});
      if(!p?.id||String(p.id).startsWith('__')||p.identityStatus!=='stable'||p.year&&Number(p.year)!==year||ids.length!==1||ids[0]!==p.id){result.unattributed.push({side,rack:rack.rack,reason:'ambiguous_rack_actor'});continue;}
      const key=side+':'+p.id,g=groups.get(key)||{side,person:p,racks:[]};g.racks.push(rack);groups.set(key,g);
    }
    const conflicted=new Set([...groups.values()].filter(g=>[...groups.values()].some(other=>other.person.id===g.person.id&&other.side!==g.side)).map(g=>g.person.id));
    if(conflicted.size)result.unattributed.push({reason:'identity_on_both_sides',participantIds:[...conflicted].sort()});
    for(const g of groups.values()){
      if(conflicted.has(g.person.id))continue;
      const stats={},counterIssues={},keys=new Set(g.racks.flatMap(r=>Object.keys(r.stats?.[g.side]||{})));
      for(const key of keys){
        const values=g.racks.map(r=>r.stats?.[g.side]?.[key]),known=values.filter(n=>Number.isInteger(n)&&n>=0);
        if(known.length)stats[key]=known.reduce((a,b)=>a+b,0);
        if(known.length!==values.length)counterIssues[key]=[values.some(n=>n===undefined||n===null)?'missing_rack_counter':'invalid_rack_counter'];
      }
      const rackNos=new Set(g.racks.map(r=>r.rack)),all=federalStatsRows(m.detailedPlay?.records).filter(r=>rackNos.has(r.rack));
      const badActor=all.some(r=>r.side===g.side&&r.actor?.id&&(r.actor.id!==g.person.id||r.actor.identityStatus==='legacy'));
      const synthetic={...m,isBreakShot:false,scores:[0,1].map(side=>g.racks.filter(r=>r.winner===side).length),stats:[{},{}],federalCounterIssues:{[g.side]:counterIssues},federalTeam:{racks:g.racks},detailedPlay:{...m.detailedPlay,records:all.filter(r=>r.side!==g.side||!r.actor?.id||r.actor.id===g.person.id&&r.actor.identityStatus!=='legacy')}};
      synthetic.stats[g.side]=stats;
      const metrics=federalStatsSide(synthetic,g.side,m.detailedPlay?.records||[]);
      // Successful breaks are derived, unlike direct counters: an absent failure
      // counter cannot turn an unproven break into a known success by subtraction.
      const rackBreakMetrics=federalMergeMetrics(g.racks.map(rack=>({metrics:federalStatsSide({...synthetic,
        scores:[0,1].map(side=>rack.winner===side?1:0),stats:rack.stats||[],federalTeam:{racks:[rack]},
        detailedPlay:{...synthetic.detailedPlay,records:synthetic.detailedPlay.records.filter(r=>r.rack===rack.rack)}},g.side,m.detailedPlay?.records||[])})));
      for(const key of ['breakSuccess','drySoftBreaks','foulBreaks'])metrics[key]=rackBreakMetrics[key];
      if(!federalStatsRacksComplete(m)||result.unattributed.some(x=>x.reason==='ambiguous_rack_actor'&&x.side===g.side)||!m.endedAt){
        const reason=badActor?'actor_rack_conflict':!m.endedAt?'unfinished_team_match':'incomplete_attribution';
        for(const [key,x]of Object.entries(metrics))metrics[key]=federalMetric(x.kind,x.numerator,x.denominator,x.numerator===null?'unknown':'partial',[...x.reasons,reason],x.components);
      }
      if(badActor||result.unattributed.some(x=>x.reason==='unassigned_shot_rack'&&(x.side==null||x.side===g.side))){
        for(const key of ['pottedBalls','pottingSuccess','missedPots','jumpShots','bankShots']){const x=metrics[key];metrics[key]=federalMetric(x.kind,x.numerator,x.denominator,x.numerator===null?'unknown':'partial',[...x.reasons,badActor?'actor_rack_conflict':'unassigned_shot_rack'],x.components);}
      }
      Object.defineProperty(result.individuals,g.person.id,{value:{owner:{kind:'participant',id:g.person.id,name:g.person.name},metrics,scope:'completed_racks',rackIds:g.racks.map(r=>r.id)},enumerable:true});
    }
    return result;
  }
  function federalMergeMetrics(entries){
    const template=federalStatsSide({federalEvidence:{fromStart:true},stats:[{},{}]},0),out={};
    for(const key of Object.keys(template)){
      const list=entries.map(e=>e.metrics[key]),kind=template[key].kind;
      const sum=field=>list.some(x=>x[field]!==null)?list.reduce((n,x)=>n+(x[field]??0),0):list.length?null:0;
      const n=sum('numerator'),d=kind==='count'?null:sum('denominator');
      const coverage=list.every(x=>x.coverage==='complete')?'complete':n===null?'unknown':'partial';
      const components={};for(const x of list)for(const [k,v]of Object.entries(x.components))if(typeof v==='number')components[k]=(components[k]||0)+v;
      out[key]=federalMetric(kind,n,d,coverage,list.flatMap(x=>x.reasons.filter(r=>r!=='zero_denominator')),components);
    }
    return out;
  }
  function federalFixtureSources(matches,config={},year=2026){
    year=Number(year);if(!Number.isInteger(year))throw Error('Invalid Federal Cup year');
    const fixtures=new Map(),duplicates=[],matchIds=new Set();
    const ordered=federalStatsRows(matches).filter(m=>Number(m.federalCupLink?.year)===year&&Number.isInteger(Number(m.federalCupLink?.fixtureNo))&&Number(m.federalCupLink.fixtureNo)>=1&&Number(m.federalCupLink.fixtureNo)<=21&&m.endedAt&&!['incomplete','playing','active'].includes(m.status))
      .sort((a,b)=>(Date.parse(b.endedAt)||0)-(Date.parse(a.endedAt)||0)||String(a.id).localeCompare(String(b.id)));
    for(const m of ordered){const n=Number(m.federalCupLink.fixtureNo);if(m.id&&matchIds.has(m.id)){duplicates.push({fixtureNo:n,ignoredMatchId:m.id,reason:'duplicate_match_id'});continue;}if(m.id)matchIds.add(m.id);if(fixtures.has(n)){duplicates.push({fixtureNo:n,ignoredMatchId:m.id||null});continue;}fixtures.set(n,{m,source:'detailed'});}
    if(Number(config.year)===year)for(const n of [1,5,10]){
      const r=config.teamResults?.[n];if(fixtures.has(n)||!r?.done||r.a==null||r.b==null||!Number.isFinite(Number(r.a))||!Number.isFinite(Number(r.b))||Number(r.a)===Number(r.b))continue;
      const m={id:null,federalCupLink:{year,fixtureNo:n,type:'team'},endedAt:r.updatedAt||null};fixtures.set(n,{m,source:'manual'});
    }
    return {entries:[...fixtures.values()].sort((a,b)=>Number(a.m.federalCupLink.fixtureNo)-Number(b.m.federalCupLink.fixtureNo)),duplicates};
  }
  function federalCalculateSeason(matches,config={},year=2026){
    year=Number(year);if(!Number.isInteger(year))throw Error('Invalid Federal Cup year');
    const sources=federalFixtureSources(matches,config,year),duplicates=sources.duplicates;
    const selected=sources.entries.map(s=>({...s,result:federalCalculateMatch(s.m)})),teams=[[],[]],people=new Map(),pairs=new Map();

    const add=(map,entry,source)=>{const list=map.get(entry.owner.id)||[];list.push({entry,source});map.set(entry.owner.id,list);};
    for(const s of selected){for(const side of [0,1])teams[side].push(s.result.sides[side]);for(const e of Object.values(s.result.individuals))add(people,e,s);for(const e of Object.values(s.result.pairs))add(pairs,e,s);}
    const combine=map=>Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)).map(([id,list])=>{
      list.sort((a,b)=>(Date.parse(b.source.m.endedAt)||0)-(Date.parse(a.source.m.endedAt)||0)||a.source.result.fixtureNo-b.source.result.fixtureNo);
      return [id,{owner:list[0].entry.owner,names:[...new Set(list.map(x=>x.entry.owner.name))].sort(),metrics:federalMergeMetrics(list.map(x=>x.entry)),sources:list.map(x=>({fixtureNo:x.source.result.fixtureNo,matchId:x.source.m.id||null}))}];
    }));
    return {version:1,year,teams:[0,1].map(side=>({owner:{kind:'team',id:side===0?'a':'b',name:side===0?'Slovensko':'Česko'},metrics:federalMergeMetrics(teams[side])})),individuals:combine(people),pairs:combine(pairs),fixtures:selected.map(s=>({fixtureNo:s.result.fixtureNo,matchId:s.m.id||null,source:s.source})),duplicates,unattributed:selected.flatMap(s=>s.result.unattributed.map(x=>({fixtureNo:s.result.fixtureNo,...x})))};
  }

  // Federal Cup report readers. No persistence, DOM, or independent gameplay formulas.
  function federalReportOrder(config){
    const host=Object.hasOwn(config||{},'reportHost')?config.reportHost:Number(config?.year)===2026?'SK':null;
    return host==='SK'?[0,1]:host==='CZ'?[1,0]:null;
  }
  function federalReportWinner(scores){
    if(!Array.isArray(scores)||scores.length!==2||!scores.every(n=>(typeof n==='number'||typeof n==='string'&&n.trim()!=='')&&Number.isInteger(Number(n))&&Number(n)>=0)||Number(scores[0])===Number(scores[1]))return null;
    return Number(scores[0])>Number(scores[1])?0:1;
  }
  // Fixture/result selection is cheap metadata work. Statistics are calculated
  // only when a report actually needs them, never just to paint navigation.
  function federalReportSelection(matches,config,year=Number(config?.year)){
    const all=federalFixtureSources(matches,config,year),selected=[],excluded=[],series=[0,0],people=Object.create(null),issues=[[],[]],resultIssues=[];
    let decided=false;
    const candidates=all.entries.map(s=>({f:{fixtureNo:Number(s.m.federalCupLink.fixtureNo),matchId:s.m.id||null,source:s.source},m:s.source==='detailed'?s.m:null}));
    for(const source of candidates){
      const {f,m}=source,manual=config?.teamResults?.[f.fixtureNo],scores=m?.scores||[manual?.a,manual?.b];
      const winner=federalReportWinner(scores);
      if(decided){excluded.push(f);continue;}
      selected.push(source);
      if(winner===null){resultIssues.push(f.fixtureNo);issues[0].push('Neúplný výsledek zápasu #'+f.fixtureNo);issues[1].push('Neúplný výsledek zápasu #'+f.fixtureNo);continue;}
      series[winner]++;
      if(series[winner]>=11&&!resultIssues.length)decided=true;
      const type=m?.federalCupLink?.type||'team',link=m?.federalCupLink||manual||{},snap=type==='team'?link.rosterParticipants:link.lineupParticipants,need=type==='team'?5:type==='doubles'?2:type==='singles'?1:0;
      const sides=[0,1].map(side=>federalStatsRows(snap?.[side]));
      const cross=sides[0].some(p=>sides[1].some(q=>q.id===p.id));
      for(const side of [0,1]){
        const list=sides[side],validPeople=need>0&&list.length===need&&new Set(list.map(p=>p.id)).size===need&&!cross&&list.every(p=>typeof p.id==='string'&&p.id&&!p.id.startsWith('__')&&p.identityStatus!=='legacy'&&(p.year==null||Number(p.year)===year)&&(p.team==null||p.team===(side===0?'a':'b')));
        if(!validPeople){issues[side].push('Chybí jednoznačná historická nominace zápasu #'+f.fixtureNo);continue;}
        for(const p of list){
          const existing=people[p.id];
          if(existing&&existing.side!==side){existing.conflict=true;issues[side].push('Konflikt reprezentace účastníka');continue;}
          const x=people[p.id]||{id:p.id,name:p.name,side,wins:0,losses:0,sources:[]};
          if(winner===side)x.wins++;else x.losses++;
          x.sources.push({fixtureNo:f.fixtureNo,matchId:f.matchId,type});people[p.id]=x;
        }
      }
    }
    return {year,series,decided,resultIssues,selected:selected.map(s=>s.f),excluded,people,issues,duplicates:all.duplicates};
  }
  function federalReportData(matches,config,year=Number(config?.year)){
    const report=federalReportSelection(matches,config,year),keys=new Set(report.selected.map(s=>s.fixtureNo));
    const filteredConfig={...config,teamResults:Object.fromEntries(Object.entries(config?.teamResults||{}).filter(([n])=>keys.has(Number(n))))};
    const selected=federalFixtureSources(matches,config,year).entries.filter(s=>s.source==='detailed'&&keys.has(Number(s.m.federalCupLink.fixtureNo))).map(s=>s.m);
    return {...report,season:federalCalculateSeason(selected,filteredConfig,year)};
  }

  function federalReportResults(report,id,side){
    const p=report.people[id],reasons=[...(report.issues[side]||[])];
    if(p?.conflict||p&&p.side!==side)reasons.push('Konflikt identity nebo reprezentace');
    const known=!!p&&p.side===side&&!p.conflict,wins=known?p.wins:0,losses=known?p.losses:0;
    return {wins,losses,value:!reasons.length&&wins+losses?wins/(wins+losses)*100:null,coverage:reasons.length?(known?'partial':'unknown'):'complete',reasons,sources:known?p.sources:[]};
  }
  function federalReportMetric(metric){
    const number=(n,average=false)=>Number.isFinite(n)?n.toLocaleString('cs-CZ',{minimumFractionDigits:average?1:0,maximumFractionDigits:average?1:0}):'—';
    const unknown={text:'—',bar:null,note:'Neznámá evidence'};
    if(!metric||metric.coverage==='unknown')return unknown;
    const n=metric.numerator,d=metric.denominator,fraction=number(n)+' / '+number(d);
    const note=metric.coverage==='partial'?'Z dostupné evidence':'Úplná evidence';
    if(metric.kind!=='count'&&d===0&&Number.isFinite(n))return {text:fraction,bar:null,note:'Žádné evidované pokusy'};
    const quotient=Number.isFinite(n)&&Number.isFinite(d)&&d>0?n/d:null;
    const value=metric.kind==='count'?(metric.count??metric.value):metric.kind==='percent'?(quotient===null?metric.value:quotient*100):metric.value??quotient;
    if(metric.kind==='ratio')return Number.isFinite(n)&&Number.isFinite(d)?{text:fraction,bar:quotient===null?null:Math.max(0,Math.min(100,quotient*100)),note}:unknown;
    if(!Number.isFinite(value))return unknown;
    return {text:number(value,metric.kind==='average')+(metric.kind==='percent'?' %':''),bar:metric.kind==='percent'?Math.max(0,Math.min(100,value)):null,note};
  }
  // One-match presentation model. All sporting values come from the shared API.
  function federalPushoutModel(m){
    if(!m?.id||!m.endedAt||['incomplete','playing','active'].includes(m.status)||federalReportWinner(m.scores)===null)throw Error('Export vyžaduje dokončený uložený zápas.');
    const result=federalCalculateMatch(m),type=result.type;
    if(!['singles','doubles','team'].includes(type)||!Number.isInteger(result.year)||!Number.isInteger(result.fixtureNo)||result.fixtureNo<1||result.fixtureNo>21)throw Error('Neplatná identita zápasu Federal Cupu.');
    const reps=['Slovakia','Czechia'],entity=type==='team'?'Team':type==='doubles'?'Pair':'Individual';
    const entries=result.sides.map(s=>type==='singles'&&s.owner.kind==='participant'&&result.individuals[s.owner.id]?result.individuals[s.owner.id]:type==='doubles'&&s.owner.kind==='pair'&&result.pairs[s.owner.id]?result.pairs[s.owner.id]:s);
    const identified=entries.map(e=>type==='team'||type==='singles'&&e.owner.kind==='participant'&&!!result.individuals[e.owner.id]||type==='doubles'&&e.owner.kind==='pair'&&!!result.pairs[e.owner.id]);
    const names=entries.map((e,i)=>type==='team'?reps[i]:identified[i]?e.owner.name:reps[i]);
    const cell=(value,style=0)=>({value,style}),header=row=>row.map(v=>cell(v,1));
    const specs=[['Pot percentage','pottingSuccess'],['Missed pots','missedPots'],['Fouls','fouls'],['Successful breaks','breakSuccess'],['Dry/soft breaks','drySoftBreaks'],['Foul breaks','foulBreaks'],['Break and runs','cleanRuns'],['Break and win','ownBreakWins'],['Break and lose','ownBreakLosses']];
    const main=[[cell('PUSHOUT FEDERAL CUP '+result.year,2),cell('',2),cell('',2)],header(['Match #'+result.fixtureNo+' · '+type.toUpperCase(),String(m.discipline||'Unknown discipline'),'Final score '+m.scores[0]+' : '+m.scores[1]]),[cell('This match only',5),cell(identified.every(Boolean)?entity:'Side totals',5),cell('',5)],[],header(['Metric',...names])];
    for(const [label,key]of specs){
      const values=entries.map((e,i)=>{
        const source=e.metrics[key];
        const metric=key==='breakSuccess'||key==='ownBreakWins'?federalMetric('count',source.numerator,null,source.coverage,source.reasons,source.components):source;
        const displayed=federalReportMetric(metric),text=displayed.text;
        let value=text==='—'?'—':metric.kind==='percent'&&text.includes('%')?Number(text.replace(/\s|%/g,'').replace(',','.'))/100:metric.kind==='count'&&Number.isFinite(metric.count)?metric.count:text;
        return cell(value,typeof value==='number'&&metric.kind==='percent'?4:3);
      });
      main.push([cell(label,5),...values]);
    }
    const metadata=[header(['Field','Value']),['Tournament','Pushout Federal Cup'],['Year',result.year],['Match number',result.fixtureNo],['Match type',type],['Discipline',String(m.discipline||'—')],['Match ID',m.id],['Started at (UTC)',m.startedAt||'—'],['Completed at (UTC)',m.endedAt],['Final score',m.scores[0]+' : '+m.scores[1]],['Scope','This match only'],['Entity type',identified.every(Boolean)?entity:'Side totals (identity unavailable)'],['Calculation API version',result.version],['Export schema','pushout-match-v1']];
    names.forEach((name,i)=>metadata.push(['Side '+(i+1),name],['Representation '+(i+1),reps[i]],['Opponent '+(i+1),names[1-i]],['Score '+(i+1),m.scores[i]]));
    const safe=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase().slice(0,65)||'unknown';
    return {filename:'pushout-federal-cup-'+result.year+'-match-'+result.fixtureNo+'-'+type+'-'+safe(names[0])+'-vs-'+safe(names[1])+'.xlsx',sheets:[{name:'Pushout',widths:[34,38,38],freeze:5,merges:['A1:C1'],rows:main},{name:'Metadata',widths:[30,95],freeze:1,rows:metadata}]};
  }


  return Object.freeze({
    federalRackScoresAgree,
    federalMetric,
    federalStatsRows,
    federalStatsRackRows,
    federalStatsRacksComplete,
    federalStatsHistoricalRacks,
    federalStatsRecordSignature,
    federalStatsRecordIndex,
    federalStatsReadableShot,
    federalStatsShotIssues,
    federalTaggedMetric,
    federalStatsSide,
    federalStatsOwner,
    federalCalculateMatch,
    federalMergeMetrics,
    federalFixtureSources,
    federalCalculateSeason,
    federalReportOrder,
    federalReportWinner,
    federalReportSelection,
    federalReportData,
    federalReportResults,
    federalReportMetric,
    federalPushoutModel
  });
});
