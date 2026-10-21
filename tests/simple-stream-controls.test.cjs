'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const controls=['streamDirectorPanel','streamModeInfo','streamModeLiveBtn','streamModePauseBtn','streamModeSoonBtn','streamModeEndBtn'];
const start=html.indexOf('  function refreshStreamDirector(){');
const end=html.indexOf('  async function clearStreamState(){',start);
assert.ok(start>=0 && end>start,'stream director must exist in the current production app');
const source=html.slice(start,end);

function harness(counterMode='simple',enabled=true){
  const elements=new Map(),saved=[],sent=[];
  for(const id of controls){
    const classes=new Set(id==='streamDirectorPanel'?['hidden']:[]);
    elements.set(id,{textContent:'',classList:{
      contains:c=>classes.has(c),
      toggle:(c,force)=>{if(force===undefined? !classes.has(c):force)classes.add(c);else classes.delete(c);}
    }});
  }
  const ctx={
    match:{counterMode,streamEnabled:enabled,streamMode:'live'},
    $:id=>elements.get(id)||null,
    sendStreamState:async force=>{sent.push(force);return true;},
    autosaveCurrent:()=>saved.push(ctx.match.streamMode)
  };
  vm.createContext(ctx);
  vm.runInContext(source,ctx);
  return {ctx,elements,sent,saved};
}

test('all four stream buttons exist exactly once on the match screen',()=>{
  const match=html.slice(html.indexOf('<section id="screen-match"'),html.indexOf('<section id="screen-results"'));
  for(const id of controls)assert.equal((match.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
  assert.ok(!html.includes('#screen-setup.setup-compact:not(.setup-expanded) #setupStreamOptionsPanel,'),'stream setup is available without expanding advanced game rules');
});

test('simple counter exposes and operates LIVE, PAUZA, BRZY ZAČÍNÁME, KONEC',async()=>{
  const h=harness('simple');
  h.ctx.refreshStreamDirector();
  assert.equal(h.elements.get('streamDirectorPanel').classList.contains('hidden'),false);
  for(const [id,mode] of [['streamModePauseBtn','pause'],['streamModeSoonBtn','soon'],['streamModeEndBtn','end'],['streamModeLiveBtn','live']]){
    await h.elements.get(id).onclick();
    assert.equal(h.ctx.match.streamMode,mode);
    assert.ok(h.elements.get(id).classList.contains('primary'),id+' is selected');
    assert.equal(h.saved.at(-1),mode);
  }
  assert.deepEqual(h.sent,[true,true,true,true]);
});

test('full counter shares the same stream director; disabled stream hides it',async()=>{
  const full=harness('full');
  full.ctx.refreshStreamDirector();
  assert.equal(full.elements.get('streamDirectorPanel').classList.contains('hidden'),false);
  await full.elements.get('streamModePauseBtn').onclick();
  assert.equal(full.ctx.match.streamMode,'pause');
  const disabled=harness('simple',false);
  disabled.ctx.refreshStreamDirector();
  assert.equal(disabled.elements.get('streamDirectorPanel').classList.contains('hidden'),true);
  await disabled.elements.get('streamModePauseBtn').onclick();
  assert.equal(disabled.ctx.match.streamMode,'live');
  assert.equal(disabled.sent.length,0);
});
