'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function scoreCorrection(){
  const start=html.indexOf('  function applyCompletedTournamentScoreCorrection(');
  const end=html.indexOf('  window.openHistoricalTournamentScore=',start);
  assert.ok(start>=0 && end>start,'Correction helper must exist');
  return new Function(html.slice(start,end)+'\nreturn applyCompletedTournamentScoreCorrection;')();
}
function match(){
  return {
    id:'m1',status:'done',player1Id:'a',player2Id:'b',score1:5,score2:3,
    winnerId:'a',loserId:'b',scoreboardMatchId:'original-record'
  };
}

test('Completed tournament score correction saves score and audit without reopening bracket',()=>{
  const t={id:'t1',format:'sko',status:'complete',ko:{championId:'a'}};
  const m=match();
  scoreCorrection()(t,m,5,4,'organizer','2026-10-19T11:00:00Z');
  assert.equal(t.status,'complete');
  assert.equal(t.ko.championId,'a');
  assert.equal(m.score1,5);
  assert.equal(m.score2,4);
  assert.equal(m.winnerId,'a');
  assert.equal(m.scoreCorrectionHistory.length,1);
  assert.equal(m.scoreCorrectionHistory[0].previous.score2,3);
  assert.equal(m.scoreCorrection.byUid,'organizer');
  assert.equal(m.scoreCorrection.sourceMatchId,'original-record');
  assert.equal(m.scoreboardMatchId,'original-record');
});

test('Completed group-only event can change winner and group standings source',()=>{
  const t={id:'t2',format:'groups',status:'complete'};
  const m=match();
  scoreCorrection()(t,m,3,5,'organizer','2026-10-19T11:00:00Z');
  assert.equal(m.winnerId,'b');
  assert.equal(m.loserId,'a');
  assert.equal(t.status,'complete');
});

test('Changing winner in a completed elimination or Swiss event is rejected',()=>{
  const apply=scoreCorrection();
  for(const format of ['sko','dko','groups_sko','groups_dko','swiss']){
    const t={id:'x',format,status:'complete'};
    const m=match();
    assert.throws(()=>apply(t,m,1,5,'organizer','now'),{message:'CORRECTION_WINNER_CHANGE_REQUIRES_REBUILD'});
    assert.equal(m.score1,5);
    assert.equal(m.score2,3);
    assert.equal(m.scoreCorrection,undefined);
  }
  const unfinished={id:'y',format:'groups',status:'complete',playoffStarted:true};
  assert.throws(()=>apply(unfinished,match(),1,5,'organizer','now'),{message:'CORRECTION_WINNER_CHANGE_REQUIRES_REBUILD'});
});

test('Invalid scores are rejected without modifying the original result',()=>{
  const apply=scoreCorrection();
  for(const pair of [[3,3],[-1,5],[2.5,4],[NaN,5]]){
    const m=match();
    assert.throws(()=>apply({format:'groups'},m,pair[0],pair[1],'admin','now'),{message:'CORRECTION_INVALID_SCORE'});
    assert.equal(m.score1,5);
    assert.equal(m.score2,3);
  }
});

test('Cloud reconciliation does not undo a manually approved correction',()=>{
  const start=html.indexOf('  function reconcileTournamentResultsFromMatches(');
  const end=html.indexOf('  async function refreshTournamentFromCloud(',start);
  assert.ok(start>=0 && end>start,'Reconciliation function must exist');
  const tm=match();
  tm.score2=4;
  tm.scoreCorrection={at:'2026-10-19T11:00:00Z',byUid:'organizer',sourceMatchId:'original-record'};
  const tournament={id:'t1',status:'complete',format:'groups',groups:[{id:'A',matches:[tm]}]};
  const data={
    tournaments:[tournament],
    matches:[{
      id:'original-record',tournamentLink:{tournamentId:'t1',tournamentMatchId:'m1'},
      endedAt:'2026-10-18T20:00:00Z',winner:0,playerIds:['a','b'],scores:[5,3]
    }]
  };
  const reconcile=new Function(
    'data','findTournamentMatch','forceFinalizeTournamentIfResolved','localStorage','DB_KEY',
    'tournamentHasGroups','assignTournamentTables','repairDKOInvalidFutureMatches',
    html.slice(start,end)+'\nreturn reconcileTournamentResultsFromMatches;'
  )(
    data,(t,id)=>t.groups[0].matches.find(x=>x.id===id),()=>false,
    {setItem(){}},'DB_KEY',()=>true,()=>{},()=>{}
  );
  assert.equal(reconcile('t1'),false);
  assert.equal(tm.score2,4);
  assert.equal(tm.scoreboardMatchId,'original-record');
});

test('Correction control exists only for permitted managers and uses existing result modal',()=>{
  assert.match(html,/done && canManageTournament\(t\)\?[\s\S]*?OPRAVIT SKÓRE/);
  assert.match(html,/historicalScoreContext=\{tournamentId:tid,matchId,correcting\}/);
  assert.match(html,/await saveSecureTournament\(t\)/);
  assert.match(html,/scoreCorrection\?\.at/);
});
