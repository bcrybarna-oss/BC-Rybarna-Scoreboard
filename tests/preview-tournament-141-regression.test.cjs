'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..','test-modular');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const ui=fs.readFileSync(path.join(root,'assets/js/tournament-community.js'),'utf8');
const core=fs.readFileSync(path.join(root,'assets/js/pool-core.js'),'utf8');
const setup=fs.readFileSync(path.join(root,'assets/js/match-setup.js'),'utf8');
const setupCss=fs.readFileSync(path.join(root,'assets/css/match-setup.css'),'utf8');

test('Ongoing tournament list is visible before new tournament form and remains unique',()=>{
  assert.equal((html.match(/id="tournamentActiveList"/g)||[]).length,1);
  assert.ok(html.indexOf('id="tournamentActiveList"')<html.indexOf('id="tournamentCreatePanel"'));
  assert.ok(html.includes('id="poolTestNewTournamentBtn"'));
  assert.match(ui,/poolTestShowTournamentList/);
  assert.match(ui,/setTimeout\(\(\)=>showWork\(false\),0\)/);
  assert.match(ui,/tournamentCreatePanel'\)\?\.classList\.toggle\('hidden',!showCreation\)/);
  assert.match(core,/name==='tournament' && window\.POOL_TEST_MODE && forcedTournamentReturnId/);
  assert.match(core,/returnToTournamentDetail\(targetTournamentId\)/);
  assert.match(core,/postMatchTournamentId/);
});

test('Classic 14.1 hides Ghost controls but Ghost training keeps its setup',()=>{
  assert.match(html,/#screen-setup #ghostRow,#screen-setup #solo14GhostRow\{display:none!important\}/);
  assert.match(html,/#screen-setup:not\(\.setup-ghost\) #solo14GhostSettings\{display:none!important\}/);
  assert.match(html, /id="ghostRow"[^>]+hidden aria-hidden="true"/);
  assert.match(html, /id="solo14GhostRow"[^>]+hidden aria-hidden="true"/);
  assert.match(html, /assets\/css\/match-setup\.css\?v=20261015-ghost-isolation/);
  assert.match(setupCss, /#screen-setup:not\(\.setup-ghost\) #ghostBallCountField/);
  assert.match(setupCss, /#screen-setup:not\(\.setup-ghost\) #solo14GhostSettings/);
  assert.match(setupCss, /#screen-setup\.setup-ghost:not\(\.setup-ghost14\) #solo14GhostSettings/);
  assert.match(setup,/get\('setupGhostBtn'\)\.addEventListener\('click',\(\)=>setMode\('ghost'\)\)/);
  assert.match(setup,/get\('solo14GhostMode'\)\.checked=is14/);
  assert.match(setup,/get\('ghostMode'\)\.checked=true/);
  assert.match(setup,/get\('solo14GhostMode'\)\.checked=false/);
  assert.doesNotThrow(()=>new Function(setup));
  assert.doesNotThrow(()=>new Function(ui));
  assert.doesNotThrow(()=>new Function(core));
});
