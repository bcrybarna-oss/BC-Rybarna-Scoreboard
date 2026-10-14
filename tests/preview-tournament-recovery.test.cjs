'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const core=fs.readFileSync(path.join(__dirname,'..','test-modular','assets','js','pool-core.js'),'utf8');

function extractFunction(name,nextName){
  const start=core.indexOf('async function '+name+'(){');
  const end=core.indexOf('async function '+nextName,start);
  assert.ok(start>=0 && end>start,'Expected complete source of '+name);
  return core.slice(start,end);
}
function harness({kind,remote={},disk={},inMemory={}}){
  const isTournament=kind==='tournaments';
  const functionName=isTournament?'loadSecureTournaments':'loadSecureMatches';
  const nextName=isTournament?'saveSecureTournament':'saveSecureMatch';
  const state={tournaments:[],matches:[],deletedTournamentIds:[],deletedMatchIds:[],...inMemory};
  const writes=[];
  const memoryStorage=new Map([['DB_KEY',JSON.stringify(disk)]]);
  const localStorage={
    getItem(key){return memoryStorage.get(key)||null;},
    setItem(key,value){memoryStorage.set(key,value);}
  };
  function byId(a,b,preferB){
    const map=new Map();
    for(const row of a||[]){if(row?.id)map.set(row.id,structuredClone(row));}
    for(const row of b||[]){
      if(!row?.id)continue;
      const old=map.get(row.id);
      if(!old)map.set(row.id,structuredClone(row));
      else{
        const joined=preferB?{...old,...structuredClone(row)}:{...structuredClone(row),...old};
        if(isTournament){
          const byMatchId=new Map();
          for(const m of old.groups?.flatMap(g=>g.matches||[])||[])byMatchId.set(m.id,m);
          for(const m of row.groups?.flatMap(g=>g.matches||[])||[]){
            const previous=byMatchId.get(m.id);
            if(!previous || (m.status==='done' && previous.status!=='done'))byMatchId.set(m.id,m);
          }
          if(joined.groups?.length===1)joined.groups[0].matches=[...byMatchId.values()];
        }
        map.set(row.id,joined);
      }
    }
    return [...map.values()];
  }
  const context={
    data:state,
    window:{POOL_TEST_MODE:true},
    localStorage,
    DB_KEY:'DB_KEY',
    console,
    Date,JSON,Set,Object,
    fetch:async()=>({ok:true,json:async()=>remote}),
    cloudUrl:path=>path,
    ensureCloudToken:async()=>true,
    mergeTournamentArrays:byId,
    arrayMergeById:byId,
    repairHybridWaitingState:()=>false,
    canManageTournament:()=>true,
    secureTournamentRequest:async(...args)=>{writes.push(args);return null;},
    applyKnownHistoricalMatchMetadataRepairs:()=>false,
    applyEffectiveConfirmationStatus:()=>{},
    currentUserIsSystemAdmin:()=>false,
    setTimeout:()=>{},
    maybeShowPendingResultConfirmation:()=>{},
  };
  const fn=vm.runInNewContext(extractFunction(functionName,nextName)+'\n'+functionName+';',context);
  return {run:fn,state,writes,localStorage};
}

test('Empty preview database cannot discard an ongoing locally saved tournament',async()=>{
  const current={
    id:'cup-1',name:'Vývojový test',status:'active',
    groups:[{id:'g-1',matches:[
      {id:'m-1',status:'done',score1:3,score2:1,winnerId:'p1'},
      {id:'m-2',status:'pending'}
    ]}]
  };
  const h=harness({kind:'tournaments',remote:{},disk:{tournaments:[current]}});
  const result=await h.run();
  assert.equal(result.length,1);
  assert.equal(result[0].id,'cup-1');
  assert.equal(result[0].groups[0].matches[0].status,'done');
  assert.equal(result[0].groups[0].matches[1].status,'pending');
  assert.equal(h.writes.length,1,'Missing cloud record should be restored');
  assert.equal(h.writes[0][0],'cup-1');
  assert.equal(JSON.parse(h.localStorage.getItem('DB_KEY')).tournaments.length,1);
});

test('Preview data recovery preserves a saved match and honours explicit deletion',async()=>{
  const finished={id:'score-1',status:'complete',scores:[3,1]};
  const keep=harness({kind:'matches',disk:{matches:[finished]}});
  const result=await keep.run();
  assert.equal(result[0].status,'complete');
  assert.deepEqual(Array.from(result[0].scores),[3,1]);

  const gone=harness({kind:'tournaments',disk:{tournaments:[{id:'deleted',status:'active'}]},
    inMemory:{deletedTournamentIds:['deleted']}});
  const restored=await gone.run();
  assert.equal(restored.length,0,'Explicitly deleted tournaments must not be restored');
});

test('Saved tournaments remain visible after completion',()=>{
  assert.match(core,/const completed=tournaments\.filter\(t=>t\.status==='complete'\)/);
  assert.match(core,/DOKONČENÉ TURNAJE/);
  assert.match(core,/completed\.map\(t=>cardHtml\(t,true\)\)/);
  assert.match(core,/Turnaj byl obnoven z lokální zálohy/);
  assert.match(core,/poolTestLastTournamentId/);
  assert.match(core,/if\(tid\)postMatchTournamentId=tid/);
  assert.match(core,/const targetTournamentId=postMatchTournamentId[\s\S]*?\|\|forcedTournamentReturnId/);
  assert.doesNotThrow(()=>new Function(core));
});
