'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('  function applyCompletedTournamentScoreCorrection(');
const end=html.indexOf('  window.openHistoricalTournamentScore=',start);
assert.ok(start>=0 && end>start);

function createHarness(options={}){
  const cloudMatch={
    id:'m1',status:'done',player1Id:'a',player2Id:'b',score1:5,score2:3,
    winnerId:'a',loserId:'b',scoreboardMatchId:'original',
    ...(options.match||{})
  };
  const cloud={
    id:'t1',name:'Test',format:options.format||'groups',status:'complete',createdByUid:'owner',
    groups:[{id:'A',players:['a','b'],matches:[cloudMatch,{
      id:'m2',status:'done',player1Id:'a',player2Id:'c',
      score1:5,score2:4,winnerId:'a',loserId:'c'
    }]}],
    updatedAt:'2026-10-19T09:00:00Z'
  };
  const persisted=structuredClone(cloud);
  const state={
    tournaments:[structuredClone(cloud)],matches:[],tournamentSeries:[{id:'series1',tournamentIds:['t1']}]
  };
  const calls=[];
  const storage={};
  const context={
    data:state,
    cloudUid:'owner',
    DB_KEY:'DB_KEY',
    localStorage:{setItem(k,v){storage[k]=v;}},
    canManageTournament:t=>t.createdByUid==='owner',
    findTournamentMatch:(t,id)=>t.groups[0].matches.find(m=>m.id===id),
    secureTournamentRequest:async(tid,method,body)=>{
      assert.equal(tid,'t1');
      calls.push({method,body:body?structuredClone(body):undefined});
      if(method==='GET')return structuredClone(persisted);
      if(method==='PATCH'){
        if(options.deny)throw Error('TOURNAMENT_SECURE_403: Permission denied');
        if(!options.dropWrites){
          for(const [key,value] of Object.entries(body)){
            const steps=key.split('/');
            let node=persisted;
            for(const step of steps.slice(0,-1))node=node[step];
            node[steps.at(-1)]=structuredClone(value);
          }
        }
        return body;
      }
      throw Error('Expected focused PATCH, got '+method);
    },
    Date, JSON, Number, String, Array, Error, Object,
  };
  const functions=vm.runInNewContext(
    html.slice(start,end)+'\n({persistCompletedTournamentScoreCorrection,completedTournamentMatchCloudPath,tournamentScoreCorrectionError})',
    context
  );
  return {functions,cloud:persisted,data:state,calls,storage};
}

test('Successful correction patches only one match and verifies cloud readback',async()=>{
  const h=createHarness();
  const result=await h.functions.persistCompletedTournamentScoreCorrection('t1','m1',5,4);
  assert.equal(result.status,'complete');
  assert.equal(h.data.tournaments[0].groups[0].matches[0].score2,4);
  assert.equal(h.cloud.groups[0].matches[0].score2,4);
  assert.equal(h.cloud.groups[0].matches[1].score2,4,'sibling must remain unchanged');
  assert.equal(h.cloud.groups[0].matches[0].scoreCorrection.byUid,'owner');
  assert.equal(h.cloud.groups[0].matches[0].scoreCorrectionHistory.length,1);
  assert.equal(h.cloud.groups[0].matches[0].scoreboardMatchId,'original');
  assert.deepEqual(h.calls.map(x=>x.method),['GET','PATCH','GET']);
  assert.deepEqual(Object.keys(h.calls[1].body).sort(),['groups/0/matches/0','updatedAt']);
  assert.equal(JSON.parse(h.storage.DB_KEY).tournaments[0].groups[0].matches[0].score2,4);
});

test('A denied Firebase write leaves local and remote scores unchanged',async()=>{
  const h=createHarness({deny:true});
  await assert.rejects(()=>h.functions.persistCompletedTournamentScoreCorrection('t1','m1',5,4),/TOURNAMENT_SECURE_403/);
  assert.equal(h.cloud.groups[0].matches[0].score2,3);
  assert.equal(h.data.tournaments[0].groups[0].matches[0].score2,3);
  assert.equal(h.storage.DB_KEY,undefined);
  assert.match(h.functions.tournamentScoreCorrectionError(Error('TOURNAMENT_SECURE_403')),/Firebase odmítl uložení/);
});

test('A stale local score is not permitted to overwrite a newer cloud result',async()=>{
  const h=createHarness();
  h.cloud.groups[0].matches[0].score2=2;
  await assert.rejects(()=>h.functions.persistCompletedTournamentScoreCorrection('t1','m1',5,4),/CORRECTION_STALE_RESULT/);
  assert.equal(h.calls.length,1,'no write');
});

test('No success is signaled when the cloud has not retained the PATCH',async()=>{
  const h=createHarness({dropWrites:true});
  await assert.rejects(()=>h.functions.persistCompletedTournamentScoreCorrection('t1','m1',5,4),/CORRECTION_NOT_PERSISTED/);
  assert.equal(h.data.tournaments[0].groups[0].matches[0].score2,3);
});

test('Completed KO changes to winner remain protected before sending a PATCH',async()=>{
  const h=createHarness({format:'sko'});
  await assert.rejects(()=>h.functions.persistCompletedTournamentScoreCorrection('t1','m1',2,5),/CORRECTION_WINNER_CHANGE_REQUIRES_REBUILD/);
  assert.equal(h.calls.length,1);
  assert.equal(h.cloud.groups[0].matches[0].score2,3);
});

test('Correction UI reports error inline and retains form on failure',()=>{
  assert.match(html,/id="tournamentScoreSaveMessage"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(html,/persistCompletedTournamentScoreCorrection\(t\.id,tm\.id,s1,s2\)/);
  assert.match(html,/if\(\$\('tournamentScoreSaveMessage'\)\)\$\('tournamentScoreSaveMessage'\)\.textContent=message/);
  assert.match(html,/await secureTournamentRequest\(tournamentId,'PATCH',update\)/);
  assert.match(html,/await secureTournamentRequest\(tournamentId,'GET'\)/);
});
