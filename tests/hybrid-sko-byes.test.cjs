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
  'knockoutCreateFixedWave','knockoutCreateWave','groupPlayoffFixedSeeds','groupPlayoffSeeds','startHybridPlayoff','fixedKnockoutRoundPositions'];
const api=new Function(`
  let sequence=0;
  const uid=()=>String(++sequence),cloudUid='test';
  const groupStandings=g=>g.players.map(id=>({id}));
  const tournamentHasGroups=t=>['groups_sko','groups_dko'].includes(t.format);
  const groupPhaseComplete=()=>true,assignTournamentTables=()=>{};
  ${names.map(body).join('\n')}
  return {fixedKnockoutRoundPositions,groupPlayoffFixedSeeds,groupPlayoffSeeds,startHybridPlayoff,knockoutCreateWave,knockoutRegisterElimination,fixedKnockoutPlan};
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

function multi(groups,advance=null,manualOrder=null){
  const rows=groups.map((count,i)=>({id:String.fromCharCode(65+i),players:Array.from({length:count},(_,j)=>String.fromCharCode(65+i)+(j+1))}));
  const t={id:'multi',format:'groups_sko',groups:rows,playerIds:rows.flatMap(g=>g.players),advancePerGroup:advance||Math.max(...groups),status:'active'};
  assert.equal(api.startHybridPlayoff(t,manualOrder),true);return t;
}
const rematches=t=>t.ko.rounds[0].matches.filter(m=>t.groups.some(g=>g.players.includes(m.player1Id)&&g.players.includes(m.player2Id))).length;
for(const [groups,advance] of [[2,2],[2,3],[3,2],[3,4],[4,2]]){
  test(groups+' groups × '+advance+': no avoidable rematch, fixed top byes and stable complete brackets',()=>{
    const all=[];
    for(const second of [false,true]){
      const variants=[];
      for(const reverse of [false,true]){
        const t=multi(Array(groups).fill(advance)),slots=[...t.ko.seedSlots],byes=t.ko.rounds[0].byes.map(b=>b.playerId);
        const ranked=Array.from({length:advance},(_,j)=>Array.from({length:groups},(_,i)=>String.fromCharCode(65+i)+(j+1))).flat();
        assert.equal(rematches(t),0);
        assert.deepEqual([...byes].sort(),ranked.slice(0,slots.length-ranked.length).sort());
        assert.equal(new Set(slots.filter(Boolean)).size,ranked.length);
        if(byes.length===2){assert.ok(slots.indexOf(byes[0])<slots.length/2);assert.ok(slots.indexOf(byes[1])>=slots.length/2);}
        const trace=[];let expected=slots;
        for(let pass=0;t.status!=='complete'&&pass<10;pass++){
          const round=t.ko.rounds.at(-1),actual=pairs(round),planned=[];
          for(let i=0;i<expected.length;i+=2)if(expected[i]&&expected[i+1])planned.push([expected[i],expected[i+1]]);
          assert.deepEqual(actual,planned);
          trace.push(actual);
          const next=[];
          for(let i=0;i<expected.length;i+=2)next.push(!expected[i]?expected[i+1]:!expected[i+1]?expected[i]:expected[i+(second?1:0)]);
          const matches=[...round.matches];
          for(const m of reverse?matches.reverse():matches)finish(t,m,second?m.player2Id:m.player1Id);
          expected=next;
        }
        assert.equal(t.status,'complete');assert.equal(t.ko.championId,expected[0]);
        assert.equal(t.ko.rounds.flatMap(r=>r.matches).length,ranked.length-1);
        assert.ok(t.ko.rounds.slice(1).every(r=>r.byes.length===0));
        variants.push({trace,champion:t.ko.championId});
      }
      assert.deepEqual(variants[0],variants[1]);all.push(variants[0]);
    }
    assert.notEqual(all[0].champion,all[1].champion);
  });
}
test('3×2 precise regression and explicit manual rematch remain distinct',()=>{
  const t=multi([2,2,2]);
  assert.deepEqual(t.ko.seedSlots,['A1',null,'A2','C2','C1','B2','B1',null]);
  assert.deepEqual(pairs(t.ko.rounds[0]),[['A2','C2'],['C1','B2']]);
  const manual=multi([2,2,2],null,['A1','A2','B2','C1','C2','B1']);
  assert.deepEqual(pairs(manual.ko.rounds[0]),[['A2','B2'],['C1','C2']]);
  assert.deepEqual(manual.ko.seedSlots,['A1',null,'A2','B2','C1','C2','B1',null]);
});
test('uneven groups achieve the independent minimum rematches, including unavoidable collisions',()=>{
  let cases=0,unavoidable=0;
  for(let a=1;a<=5;a++)for(let b=1;b<=4;b++)for(let c=0;c<=3;c++){
    const t=multi(c?[a,b,c]:[a,b]);
    const real=t.ko.rounds[0].matches.flatMap(m=>[m.player1Id,m.player2Id]);
    const maxGroup=Math.max(...t.groups.map(g=>real.filter(id=>g.players.includes(id)).length));
    const minimum=Math.max(0,maxGroup-real.length/2);
    assert.equal(rematches(t),minimum,JSON.stringify([a,b,c]));
    assert.deepEqual(api.groupPlayoffSeeds(t),t.ko.participantIds,'deterministic repeated computation');
    cases++;if(minimum)unavoidable++;
  }
  assert.equal(cases,80);assert.ok(unavoidable>0);
});

test('presentation merges stored slots without sorting or changing stored data',()=>{
  for(const [n,kinds] of [[5,['bye','match','bye','bye']],[6,['bye','match','match','bye']],[7,['bye','match','match','match']],[8,['match','match','match','match']]]){
    const t=create(n);t.ko.rounds[0].matches.reverse();t.ko.rounds[0].byes.reverse();
    const before=JSON.stringify(t);
    const freeze=x=>{if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}};freeze(t);
    const rounds=api.fixedKnockoutRoundPositions(t);
    assert.deepEqual(rounds[0].entries.map(e=>e.byeRecord?'bye':e.match?'match':'preview'),kinds);
    assert.deepEqual(rounds[0].entries.map(e=>e.slot),[0,1,2,3]);
    assert.equal(rounds.length,3);assert.ok(rounds.slice(1).every(r=>r.preview));
    assert.equal(JSON.stringify(t),before);assert.equal(t.ko.rounds.length,1);
    for(const e of rounds[0].entries){if(e.byeRecord)assert.equal(e.byeRecord,t.ko.rounds[0].byes.find(b=>b.slot===e.slot));if(e.match)assert.equal(e.match,t.ko.rounds[0].matches.find(m=>m.slot===e.slot));}
  }
});
test('non-positioned third-place match stays outside the fixed tree',()=>{
  const t=create(4),bronze={id:'bronze',bracket:'3P',player1Id:'C',player2Id:'D'};
  t.ko.rounds[0].matches.push(bronze);const before=JSON.stringify(t);
  const rounds=api.fixedKnockoutRoundPositions(t);
  assert.deepEqual(rounds[0].extraMatches,[bronze]);assert.ok(rounds[0].entries.every(e=>e.match!==bronze));assert.equal(JSON.stringify(t),before);
});
test('legacy brackets without seedSlots never receive invented presentation positions',()=>{
  const t=create(7);delete t.ko.seedSlots;const before=JSON.stringify(t);
  assert.equal(api.fixedKnockoutRoundPositions(t),null);assert.equal(JSON.stringify(t),before);
});
