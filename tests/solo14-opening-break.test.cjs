'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const helper=(html.match(/  function openingBreakAvailableForAction14\(m\)\{[\s\S]*?\n  \}/)||[])[0];
assert.ok(helper,'opening break helper missing');
const active=new Function(helper+'\nreturn openingBreakAvailableForAction14;')();
const make=()=>({discipline:'14.1',endedAt:null,openingBreakAvailable14:true,ballsOnTable:15,reracksInInning14:0,inningsHistory14:[],scores:[0,0],turn:0,playerNames:['Jarda','Dominik'],stats:[{fouls:0},{}],consecutiveFouls14:[0,0],isBreakShot:true,useClock:false});
function invoke(id,m,snaps){
 const body=(html.match(new RegExp("\\$\\('"+id+"'\\)\\.onclick=\\(\\)=>\\{([\\s\\S]*?)\\n  \\};"))||[])[1];
 assert.ok(body,id+' handler missing');
 const deps={match:m,openingBreakAvailableForAction14:active,addActionEvent:t=>snaps.push({text:t,before:JSON.parse(JSON.stringify(m))}),renderMatch:()=>{},autosaveCurrent:()=>{},resetClock:()=>{},toast:()=>{},awardSolo14GhostError:()=>0};
 const keys=Object.keys(deps);
 new Function(...keys,'return ()=>{'+body+'};')(...keys.map(k=>deps[k]))();
}
test('opening break is valid only before first recorded 14.1 action',()=>{
 const m=make();assert.ok(active(m));
 m.reracksInInning14=1;assert.equal(active(m),false);m.reracksInInning14=0;
 m.ballsOnTable=29;assert.equal(active(m),false);m.ballsOnTable=15;
 m.inningsHistory14=[{reason:'safe'}];assert.equal(active(m),false);m.inningsHistory14=[];
 m.openingBreakAvailable14=false;assert.equal(active(m),false);m.openingBreakAvailable14=true;
 m.endedAt='2026-11-04';assert.equal(active(m),false);
});
test('legal break ends opening phase, does not award points; UNDO snapshot restores phase',()=>{
 const m=make(),snaps=[];invoke('openingBreakOk14',m,snaps);
 assert.equal(m.openingBreakAvailable14,false);assert.equal(m.isBreakShot,false);
 assert.deepEqual(m.scores,[0,0]);assert.equal(snaps.length,1);assert.ok(snaps[0].before.openingBreakAvailable14);
 Object.assign(m,snaps[0].before);assert.ok(active(m));
});
test('stale opening foul cannot deduct −2 after legal break',()=>{
 const m=make(),snaps=[];invoke('openingBreakOk14',m,snaps);invoke('openingBreakFoul14',m,snaps);
 assert.deepEqual(m.scores,[0,0]);assert.equal(snaps.length,1);
});
test('+14 ends opening phase, UNDO restores previous state',()=>{
 const m=make(),snaps=[];invoke('addRack14',m,snaps);
 assert.equal(m.ballsOnTable,29);assert.equal(m.reracksInInning14,1);
 assert.equal(m.openingBreakAvailable14,false);assert.equal(snaps[0].before.ballsOnTable,15);
 Object.assign(m,snaps[0].before);assert.ok(active(m));assert.equal(m.ballsOnTable,15);
});
test('both opening break buttons hidden together; undo remains available',()=>{
 assert.match(html,/\$\('openingBreakOk14'\)\.classList\.toggle\('hidden', !openingBreakActive\)/);
 assert.match(html,/\$\('openingBreakFoul14'\)\.classList\.toggle\('hidden', !openingBreakActive\)/);
 assert.match(html,/\$\('undo14Btn'\)\.onclick=undo/);
 assert.match(html,/match\.openingBreakAvailable14=false;\s*\$\('ballsModal14'\)\.classList\.remove\('show'\)/);
});
