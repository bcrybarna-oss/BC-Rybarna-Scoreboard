'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const scriptRefs=[...html.matchAll(/<script\b[^>]*src="(assets\/js\/[^"]+)"[^>]*><\/script>/g)].map(x=>x[1]);
const styleRefs=[...html.matchAll(/<link\b[^>]*rel="stylesheet"\s+href="(assets\/css\/[^"]+)"/g)].map(x=>x[1]);
const read=filename=>fs.readFileSync(path.join(root,filename),'utf8');
test('Asset files exist, are non-empty and have unique paths',()=>{
  const refs=[...scriptRefs,...styleRefs];
  assert.equal(refs.length,15,'Expected eight external scripts and seven CSS files');
  assert.equal(new Set(refs).size,refs.length);
  refs.forEach(filename=>{
    assert.ok(!filename.includes('..'),'No parent directory traversal');
    assert.ok(fs.existsSync(path.join(root,filename)),filename);
    assert.ok(read(filename).trim().length>100,filename);
  });
});
test('JavaScript modules and remaining inline scripts parse',()=>{
  for(const filename of scriptRefs)assert.doesNotThrow(()=>new Function(read(filename)),filename);
  const inline=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(x=>!/\bsrc=/.test(x[1]));
  inline.forEach((x,i)=>assert.doesNotThrow(()=>new Function(x[2]),'inline script #'+i));
});
test('Original source execution order is preserved',()=>{
  const expected=['theme','app-core','tournament-view','dashboard','tournament-hub','online-presence','match-setup','player-picker'].map(name=>'assets/js/'+name+'.js');
  assert.deepEqual(scriptRefs,expected);
  assert.ok(html.indexOf('src="assets/js/app-core.js"')<html.indexOf('src="assets/js/match-setup.js"'));
  assert.ok(html.indexOf('src="assets/js/match-setup.js"')<html.indexOf('src="assets/js/player-picker.js"'));
});
test('Core gameplay and special modes remain in the extracted engine',()=>{
  const core=read('assets/js/app-core.js');
  for(const signature of [
    'function startMatch()',
    'function winnerTableProgressHtml(',
    'function winnerTableHistoryHtml(',
    'function ghostAggregate(',
    'function updateDisciplineSetup()',
    'function completedRealMatchFacts()',
    'function renderTournamentPlayerPicker()',
    'function saveSecureMatch('
  ])assert.ok(core.includes(signature),signature);
  assert.ok(html.includes('id="wtLiveScoreProgress"'));
  assert.ok(html.includes('id="solo14GhostMode"'));
  assert.ok(html.includes('id="ghostMode"'));
});
test('CSS remains in source order and uses no broken relative URLs',()=>{
  const expected=['core','dashboard','tournament-hub','federal-cup','match-setup','player-picker','winner-table'].map(name=>'assets/css/'+name+'.css');
  assert.deepEqual(styleRefs,expected);
  for(const css of styleRefs){
    assert.ok(!/\burl\(\s*['"]?\.{1,2}\//i.test(read(css)),'Review moved relative CSS URL '+css);
  }
});
test('App is in modular development version',()=>{
  assert.ok(html.includes('v4.51.76 RC'));
  assert.ok(read('assets/js/app-core.js').includes('v4.51.76 RC'));
  assert.ok(html.includes('src="assets/js/app-core.js"'));
  assert.ok(!html.includes('function startMatch()'),'Gameplay engine must no longer be embedded in HTML');
});
