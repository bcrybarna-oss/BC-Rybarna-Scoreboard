'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const start=html.indexOf('  function swissPlayedPairKey(a,b){');
const end=html.indexOf('  function swissCurrentRound(t){',start);
assert.ok(start>=0&&end>start,'Extract current production Swiss pairing, never a duplicate test implementation');
let serial=0;
const sandbox={
  tournamentMatchObject(a,b,label,stage){return {id:'match-'+(++serial),player1Id:a,player2Id:b,label,stage,status:'waiting',winnerId:null,score1:0,score2:0};},
  uid(){return 'round-'+(++serial);},
  assignTournamentTables(){},
};
vm.createContext(sandbox);
vm.runInContext(html.slice(start,end)+'\nglobalThis.swissApi={swissPlanPairs,swissPairRound,swissCreateFirstRound,swissPlayedPairKey,swissAllPlayedPairs,swissStandings,swissChooseBye};',sandbox);
const api=sandbox.swissApi;
const key=(a,b)=>[String(a),String(b)].sort().join('|');
const ids=n=>Array.from({length:n},(_,i)=>'P'+i);
const roundMatches=pairs=>pairs.map(([a,b,score1,score2])=>({
  player1Id:'P'+a,player2Id:'P'+b,score1,score2,status:'done',
  winnerId:'P'+(score1>score2?a:b)
}));
const fixture=[
  [[0,4,3,5],[1,5,5,2],[2,6,3,5],[3,7,3,5]],
  [[1,4,4,5],[6,7,5,4],[0,2,5,2],[3,5,5,0]],
  [[4,6,4,5],[7,1,5,2],[0,3,5,0],[2,5,3,5]],
  [[6,0,5,2],[4,7,2,5],[1,3,5,4],[5,2,3,5]]
];
function newTournament(n){
  return {id:'swiss-test',format:'swiss',playerIds:ids(n),
    swiss:{seedOrder:ids(n),roundsTotal:5,currentRound:0,rounds:[],advanceToSko:0}};
}
function previousGreedy(t){
  const standings=api.swissStandings(t),points=Object.fromEntries(standings.map(x=>[x.id,x.points]));
  const played=api.swissAllPlayedPairs(t),pool=standings.map(r=>r.id),pairs=[];
  while(pool.length>=2){
    const a=pool.shift();let best=-1,score=Infinity;
    for(let i=0;i<pool.length;i++){
      const b=pool[i],cost=(played.has(key(a,b))?10000:0)+Math.abs(points[a]-points[b])*100+i;
      if(cost<score){best=i;score=cost;}
    }
    pairs.push([a,pool.splice(best,1)[0]]);
  }
  return pairs;
}
function repeatCount(pairs,played){return pairs.filter(([a,b])=>played.has(key(a,b))).length;}

test('8 players, round 5: formerly greedy re-paired previous round, globally valid pairing avoids all rematches',()=>{
  const t=newTournament(8);
  t.swiss.rounds=fixture.map((rows,i)=>({id:'r'+(i+1),number:i+1,matches:roundMatches(rows),byePlayerId:null}));
  t.swiss.currentRound=4;
  const played=api.swissAllPlayedPairs(t),before=JSON.stringify(t.swiss.rounds);
  assert.equal(repeatCount(previousGreedy(t),played),1,'Regression fixture reproduces existing bug');
  assert.equal(api.swissPairRound(t),true);
  assert.equal(t.swiss.currentRound,5);
  assert.equal(repeatCount(t.swiss.rounds[4].matches.map(m=>[m.player1Id,m.player2Id]),played),0);
  assert.equal(JSON.stringify(t.swiss.rounds.slice(0,4)),before,'Existing rounds and scores must remain untouched');
});

test('8-player Swiss over five rounds: 200 deterministic score patterns have no rematches',()=>{
  for(let seed=0;seed<200;seed++){
    const t=newTournament(8);
    assert.equal(api.swissCreateFirstRound(t),true);
    let state=seed+1;
    const random=()=>((state=Math.imul(state,1664525)+1013904223>>>0)/4294967296);
    const history=new Set();
    for(let round=0;round<5;round++){
      const current=t.swiss.rounds[round];
      for(const m of current.matches){
        const pair=key(m.player1Id,m.player2Id);
        assert.ok(!history.has(pair),'Seed '+seed+' round '+(round+1)+' repeated '+pair);
        history.add(pair);
        const p1Wins=random()<0.5;
        m.score1=p1Wins?5:Math.floor(random()*5);
        m.score2=p1Wins?Math.floor(random()*5):5;
        m.status='done';
        m.winnerId=p1Wins?m.player1Id:m.player2Id;
      }
      if(round<4)api.swissPairRound(t);
    }
    assert.equal(history.size,20,'Each of eight players needs five distinct opponents');
  }
});

test('Among rematch-free plans, prefer equally scoring players',()=>{
  const players=ids(8),points=Object.fromEntries(players.map((p,i)=>[p,Math.floor(i/2)]));
  const pairs=api.swissPlanPairs(players,points,new Set());
  assert.equal(pairs.length,4);
  for(const [a,b] of pairs)assert.equal(points[a],points[b]);
});

test('Rematches are permitted only when mathematically unavoidable',()=>{
  const players=ids(4),points=Object.fromEntries(players.map(p=>[p,0]));
  const played=new Set();
  for(let i=0;i<4;i++)for(let j=i+1;j<4;j++)
    if(!(i===0&&j===1))played.add(key(players[i],players[j]));
  const pairs=api.swissPlanPairs(players,points,played);
  assert.equal(repeatCount(pairs,played),1,'Only one unique edge exists; one repeat is necessary');
});

test('Odd player count: bye not given twice while fresh candidates remain',()=>{
  const t=newTournament(7);
  api.swissCreateFirstRound(t);
  for(let i=0;i<5;i++){
    const round=t.swiss.rounds[i];
    const players=[...round.matches.flatMap(m=>[m.player1Id,m.player2Id]),round.byePlayerId];
    assert.equal(players.length,7);
    assert.equal(new Set(players).size,7);
    for(const match of round.matches){
      match.status='done';match.score1=5;match.score2=2;match.winnerId=match.player1Id;
    }
    if(i<4)api.swissPairRound(t);
  }
  const byes=t.swiss.rounds.map(r=>r.byePlayerId);
  assert.equal(new Set(byes).size,5);
});

test('24 players: large-tournament matching avoids all rematches when possible',()=>{
  const players=ids(24),points=Object.fromEntries(players.map((p,i)=>[p,i%4]));
  const allowed=new Set(Array.from({length:12},(_,i)=>key('P'+(2*i),'P'+(2*i+1))));
  const played=new Set();
  for(let i=0;i<24;i++)for(let j=i+1;j<24;j++)
    if(!allowed.has(key(players[i],players[j])))played.add(key(players[i],players[j]));
  const pairs=api.swissPlanPairs(players,points,played);
  assert.equal(pairs.length,12);
  assert.equal(new Set(pairs.flat()).size,24);
  assert.equal(repeatCount(pairs,played),0);
});

test('24 players: large-tournament matching minimizes forced rematches too',()=>{
  const players=ids(24),points=Object.fromEntries(players.map(p=>[p,0]));
  const allowed=new Set(Array.from({length:11},(_,i)=>key('P'+(2*i),'P'+(2*i+1))));
  const played=new Set();
  for(let i=0;i<24;i++)for(let j=i+1;j<24;j++)
    if(!allowed.has(key(players[i],players[j])))played.add(key(players[i],players[j]));
  const pairs=api.swissPlanPairs(players,points,played);
  assert.equal(new Set(pairs.flat()).size,24);
  assert.equal(repeatCount(pairs,played),1);
});
