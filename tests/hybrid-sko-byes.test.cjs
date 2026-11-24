'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function body(name){
  const match=html.match(new RegExp('  function '+name+'\\([^]*?\\n  \\}'));
  assert.ok(match,name);
  return match[0];
}
const names=['tournamentMatchObject','ensureSKOState','knockoutRegisterElimination','knockoutThirdCandidates',
  'knockoutThirdMatch','knockoutSeedRanks','groupPlayoffSlots','knockoutRoundLabel','fixedKnockoutPlan',
  'knockoutCreateFixedWave','knockoutCreateWave','groupPlayoffSeeds','startHybridPlayoff'];
const api=new Function(`
  let sequence=0;
  const uid=()=>String(++sequence),cloudUid='test';
  const groupStandings=g=>g.players.map(id=>({id}));
  const tournamentHasGroups=t=>['groups_sko','groups_dko'].includes(t.format);
  const groupPhaseComplete=()=>true,assignTournamentTables=()=>{};
  ${names.map(body).join('\n')}
  return {groupPlayoffSeeds,startHybridPlayoff,knockoutCreateWave,knockoutRegisterElimination,fixedKnockoutPlan};
`)();
function create(count,order=null,routing=null){
  const ids=Array.from({length:count},(_,i)=>String.fromCharCode(65+i));
  const t={id:'t',format:'groups_sko',playerIds:ids,groups:[{id:'A',players:ids}],advancePerGroup:count,status:'active'};
  if(routing)t.manualGroupPlayoffSemiRouting=routing;
  assert.equal(api.startHybridPlayoff(t,order),true);
  return t;
}
function finish(t,m,winner=m.player1Id){
  m.status='done';m.winnerId=winner;m.loserId=winner===m.player1Id?m.player2Id:m.player1Id;
  m.score1=winner===m.player1Id?5:1;m.score2=winner===m.player2Id?5:1;
  t.ko.eliminatedIds.push(m.loserId);
  api.knockoutRegisterElimination(t,m.loserId,m.id);
  api.knockoutCreateWave(t);
}
const pairs=r=>r.matches.map(m=>[m.player1Id,m.player2Id]);
test('new 7/6/8-player playoff has fixed slots and the required top-seed byes',()=>{
  for(const [n,expected,byes] of [
    [7,[['D','E'],['C','F'],['B','G']],['A']],
    [6,[['D','E'],['C','F']],['A','B']],
    [8,[['A','H'],['D','E'],['C','F'],['B','G']],[]]
  ]){
    const t=create(n);
    assert.deepEqual(pairs(t.ko.rounds[0]),expected);
    assert.deepEqual(t.ko.rounds[0].byes.map(b=>b.playerId),byes);
    assert.equal(t.ko.rounds.length,1);
    const plan=api.fixedKnockoutPlan(t);
    assert.equal(plan[1].entries[0].a.id,n===8?undefined:'A');
    if(n===6)assert.equal(plan[1].entries[1].b.id,'B');
    const before=JSON.stringify(t);
    api.fixedKnockoutPlan(t);
    assert.equal(JSON.stringify(t),before,'preview is read-only');
  }
});
test('fixed branches are independent of finish order and follow actual winners',()=>{
  for(const n of [6,7,8]){
    const results=[];
    for(const reverse of [false,true]){
      const t=create(n),first=[...t.ko.rounds[0].matches];
      for(const m of reverse?first.reverse():first)finish(t,m,m.player2Id);
      results.push(pairs(t.ko.rounds[1]));
    }
    assert.deepEqual(results[0],results[1]);
    assert.deepEqual(results[0],n===6?[['A','E'],['F','B']]:
      n===7?[['A','E'],['F','G']]:[['H','E'],['F','G']]);
  }
});
test('Firebase trailing-null omission preserves capacity and future branches after reload',()=>{
  const t=create(6);
  const expected=api.fixedKnockoutPlan(t);
  const restored=JSON.parse(JSON.stringify(t));
  while(restored.ko.seedSlots.at(-1)===null)restored.ko.seedSlots.pop();
  assert.equal(restored.ko.seedSlots.length,7);
  assert.deepEqual(api.fixedKnockoutPlan(restored),expected);
  for(const m of [...restored.ko.rounds[0].matches])finish(restored,m);
  assert.deepEqual(pairs(restored.ko.rounds[1]),[['A','D'],['C','B']]);
});
test('2 through 17 players finish with N-1 real matches, no later byes or fake wins',()=>{
  for(let n=2;n<=17;n++){
    const t=create(n);
    for(let i=0;i<n+2&&t.status!=='complete';i++){
      const pending=[...t.ko.rounds.at(-1).matches];
      for(const m of pending)if(m.status!=='done')finish(t,m);
    }
    assert.equal(t.status,'complete','field '+n);
    assert.equal(t.ko.rounds.flatMap(r=>r.matches).length,n-1);
    assert.equal(new Set(t.ko.eliminatedIds).size,n-1);
    assert.ok(t.ko.rounds.slice(1).every(r=>!r.byes.length));
    const byes=t.ko.rounds[0].byes;
    assert.ok(byes.every(b=>!('score1' in b)&&!('winnerId' in b)));
  }
});
test('explicit cross13/cross14 and adjacent routing retain the confirmed manual branches',()=>{
  const order=['A','B','C','D','E','F','G','H'];
  for(const [routing,expected] of [
    ['cross13',[['A','E'],['C','G']]],['cross14',[['A','G'],['C','E']]],['adjacent',[['A','C'],['E','G']]]
  ]){
    const t=create(8,order,routing);
    for(const m of [...t.ko.rounds[0].matches])finish(t,m);
    assert.deepEqual(pairs(t.ko.rounds[1]),expected);
    assert.deepEqual(t.ko.seedSlots,order);
  }
});
test('manual order is respected and pre-existing unmarked playoff retains the old algorithm',()=>{
  const t=create(7,['G','D','E','C','F','B','A']);
  assert.equal(t.ko.rounds[0].byes[0].playerId,'G');
  assert.deepEqual(pairs(t.ko.rounds[0]),[['D','E'],['C','F'],['B','A']]);
  const legacy={format:'groups_sko',status:'active',playerIds:['A','G','B','F','C','E','D'],
    ko:{participantIds:['A','G','B','F','C','E','D'],rounds:[],wave:0,eliminatedIds:[],eliminations:[]}};
  api.knockoutCreateWave(legacy);
  assert.equal(legacy.ko.rounds[0].byes[0].playerId,'D');
  assert.deepEqual(pairs(legacy.ko.rounds[0]),[['A','G'],['B','F'],['C','E']]);
  assert.equal(legacy.ko.seedSlots,undefined);
});
