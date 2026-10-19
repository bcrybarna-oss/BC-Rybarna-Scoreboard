'use strict';
// Node.js 22+, bez externích balíčků.
// Spuštění: npm test
// Statické smoke testy + izolované behaviorální testy identifikace hráčů.
// Nenahrazují end-to-end testování v prohlížeči ani Firebase Rules.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

function count(re){return [...html.matchAll(re)].length;}
function selectedPlayerResolver(players){
  const fn=html.match(/  function getOrCreatePlayer\(name, selectedPlayerId=null\)\{[\s\S]*?\n  \}\s+function selectedSetupPlayerId\(/);
  assert.ok(fn,'getOrCreatePlayer musí mít očekávaný tvar');
  const source=fn[0].replace(/\s+function selectedSetupPlayerId\($/,'');
  const data={players:Object.fromEntries(players.map(p=>[p.id,{...p}]))};
  const saved={count:0};
  const resolve=new Function('data','uid','saveData',source+'\nreturn getOrCreatePlayer;')(
    data,()=> 'new-generated-id',()=>{saved.count++;}
  );
  return {resolve,data,saved};
}
function expectError(fn,message){
  assert.throws(fn,e=>e instanceof Error && e.message===message);
}

test('Všechny vložené JavaScriptové bloky mají platnou syntaxi',()=>{
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length>=8);
  scripts.forEach((m,i)=>assert.doesNotThrow(()=>new Function(m[1]),'script '+i));
});
test('Verze a základní struktura odpovídá první etapě',()=>{
  assert.ok(html.includes('v4.51.79 RC'));
  assert.equal(count(/id="streamMatchTitle"/g),1);
  assert.equal(count(/id="setupMoreBtn"/g),1);
  assert.equal(count(/id="poolPlayerPickerDialog"/g),1);
});
test('Název zápasu je v základním formuláři a neblokuje ho compact CSS',()=>{
  const form=html.split('<section id="screen-setup"')[1].split('<section id="screen-federal-cup-2026"')[0];
  assert.ok(form.indexOf('id="streamMatchTitle"')<form.indexOf('id="handicapMatchRow"'));
  assert.ok(form.indexOf('id="streamMatchTitle"')<form.indexOf('id="setupMoreBtn"'));
  assert.ok(!html.includes('#screen-setup.setup-compact:not(.setup-expanded) #streamMatchTitle'));
  assert.ok(form.includes('id="setupStreamOptionsPanel"'));
});
test('Výběrový dialog zaznamenává ID profilu a ruční editace ho může zneplatnit',()=>{
  assert.ok(html.includes('window.poolMatchPickerPlayers=function()'));
  assert.ok(html.includes("target.dataset.selectedPlayerId=selection?.id||'';"));
  assert.ok(html.includes("delete input.dataset.selectedPlayerId;"));
  for(const id of ['p1Name','p2Name','p1PartnerName','p2PartnerName','p3Name']){
    assert.ok(html.includes("selectedSetupPlayerId('"+id+"'"),'výběr '+id+' podle ID');
  }
});
test('Dva hráči stejného jména se rozliší podle zvoleného ID',()=>{
  const {resolve}=selectedPlayerResolver([
    {id:'A',name:'Jan Novák',club:'Klub A',active:true},
    {id:'B',name:'Jan Novák',club:'Klub B',active:true}
  ]);
  assert.equal(resolve('Jan Novák','A').id,'A');
  assert.equal(resolve('Jan Novák','B').id,'B');
  expectError(()=>resolve('Jan Novák'),'PLAYER_AMBIGUOUS');
});
test('Zastaralá, neaktivní nebo skrytá identita se nesmí znovu použít',()=>{
  const {resolve}=selectedPlayerResolver([
    {id:'H',name:'Jan Novák',hiddenFromPlayers:true,active:true},
    {id:'I',name:'Petr Nový',active:false},
    {id:'A',name:'Dominik Mencl',active:true}
  ]);
  expectError(()=>resolve('Jan Novák','H'),'PLAYER_SELECTION_STALE');
  expectError(()=>resolve('Petr Nový','I'),'PLAYER_SELECTION_STALE');
  expectError(()=>resolve('Změněné jméno','A'),'PLAYER_SELECTION_STALE');
  assert.equal(resolve('Dominik Mencl','A').id,'A');
});
test('Ruční jméno vytvoří profil pouze pokud žádný odpovídající neexistuje',()=>{
  const {resolve,data,saved}=selectedPlayerResolver([{id:'A',name:'Dominik Mencl',active:true}]);
  assert.equal(resolve('Dominik Mencl').id,'A');
  assert.equal(saved.count,0);
  const created=resolve('Nový Hráč');
  assert.equal(created.name,'Nový Hráč');
  assert.equal(data.players['new-generated-id'].name,'Nový Hráč');
  assert.equal(saved.count,1);
});
test('Ghost režimy a oddělení ELO/klasických zápasů zůstávají v kódu',()=>{
  assert.ok(html.includes('id="solo14GhostMode"'));
  assert.ok(html.includes('id="solo14GhostDifficulty"'));
  assert.ok(html.includes('id="ghostMode"'));
  assert.ok(html.includes('id="ghostBallCount"'));
  assert.ok(html.includes('const ghost14On=is14'));
  const facts=html.match(/function completedRealMatchFacts\(\)\{([\s\S]*?)function playerMatchHistoryFacts\(/);
  assert.ok(facts);
  assert.ok(facts[1].includes('if(m.solo14 || m.ghostMode || m.winnerTableMode || m.doublesMode)return;'));
});
test('Po rozřešení se kontrolují skutečná ID a turnaje nenabízejí neaktivní profily',()=>{
  assert.ok(html.includes('if(new Set(resolvedIds).size!==resolvedIds.length)'));
  assert.ok(html.includes("const resolvedIds=doublesMode"));
  assert.ok(html.includes(".filter(p=>p && p.active!==false && p.hiddenFromPlayers!==true)"));
});
test('Vítěz na stole ukládá průběh racků a zobrazuje graf v zápase, historii i PDF',()=>{
  assert.ok(html.includes('rackHistory:[]'));
  assert.ok(html.includes('wt.rackHistory.push({'));
  assert.ok(html.includes('winnerIndex:globalWinner'));
  assert.ok(html.includes('wins:wt.wins.slice(0,3)'));
  assert.ok(html.includes('function winnerTableProgressRows(m)'));
  assert.ok(html.includes('function winnerTableProgressHtml(m,compact=false)'));
  assert.ok(html.includes('winnerTableProgressHtml(match,true)'));
  assert.ok(html.includes("winnerTableProgressHtml(m)"));
  assert.ok(html.includes('winnerTable:match.winnerTable'));
  assert.ok(html.includes('match.winnerTable=x.winnerTable'));
});
test('Turnaje stále vybírají podle ID a zachovávají hosty',()=>{
  assert.ok(html.includes('id="tournamentPlayerDropdown"'));
  assert.ok(html.includes('id="addTournamentGuestBtn"'));
  assert.ok(html.includes('tournamentSelectedPlayerIds.push(id)'));
  assert.ok(html.includes("select.value=value;"));
  assert.ok(html.includes("$('addTournamentPlayerBtn').click();"));
});
test('Administrátorské mazání a záchrana rozehraného zápasu zůstávají',()=>{
  assert.ok(html.includes("if(!currentUserIsSystemAdmin()) throw new Error('ADMIN_ONLY')"));
  assert.ok(html.includes('function autosaveCurrent()'));
  assert.ok(html.includes('saveDeviceActiveMatch(match)'));
});
