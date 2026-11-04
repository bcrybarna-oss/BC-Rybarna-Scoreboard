'use strict';
// Statický kontrakt nové CSS vrstvy. Browserovou geometrii ověřuje samostatný
// tests/solo14-mobile-layout-browser.cjs po instalaci Playwright / Chrome.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=(html.match(/<style id="solo14-mobile-compact-v451112">([\s\S]*?)<\/style>/)||[])[1];
const soloScope='body:has(#screen-match.active #solo14ScoreRow:not(.hidden))';

test('Kompaktní styl je omezený na aktivní mobilní sólo 14.1',()=>{
  assert.ok(css,'dedicated CSS block must exist');
  assert.match(css,/@media\s*\(max-width:700px\)\s*and\s*\(orientation:portrait\)/);
  for(const block of css.split(/\}/)){
    if(!block.includes('{'))continue;
    const selector=block.split('{').pop();
    if(/body:has\(/.test(selector)){
      assert.ok(selector.includes(soloScope),'all active rules must remain mode-scoped');
    }
  }
  assert.ok(html.includes('id="solo14ScoreRow"'));
  assert.ok(html.includes('id="solo14GhostScoreTile"'));
  assert.ok(html.includes('id="fourteenActions"'));
});

test('Skóre, Ghost a ovládání 14.1 mají kompaktní mobilní pravidla a funkční ID',()=>{
  for(const id of ['solo14TotalScore','solo14BallsTop','solo14StatsPanel','addRack14',
    'endMiss14','endSafe14','endFoul14','undo14Btn','openingBreakFoul14','specialSoundBtn']){
    assert.ok(html.includes('id="'+id+'"'),'missing native action '+id);
    assert.ok(css.includes('#'+id)||css.includes('fourteen-end-grid')||css.includes('fourteen-utility-grid'));
  }
  assert.match(css,/\.fourteen-end-grid\s*\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.fourteen-utility-grid\s*\{\s*grid-template-columns:minmax\(0,0\.8fr\) minmax\(0,1\.4fr\)!important/);
  assert.match(css,/\.fourteen-end-grid \.btn\s*\{\s*min-height:48px!important/);
  assert.match(css,/\.fourteen-utility-grid \.btn\s*\{\s*min-height:44px!important/);
  assert.match(css,/#solo14ScoreRow\.ghost-enabled\s*\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/#solo14ScoreRow\.ghost-enabled \.solo14-score-tile:last-child\s*\{\s*grid-column:auto!important/);
});

test('Kompaktní režim zachovává herní akce a odděluje vysvětlení od hraní',()=>{
  const ids=['addRack14','endMiss14','endSafe14','endFoul14','undo14Btn','openingBreakFoul14'];
  for(const id of ids)assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(css,/#specialSoundPanel > div\s*\{\s*display:none!important/);
  assert.match(css,/\.fourteen-info\s*\{\s*display:none/);
  assert.match(css,/#fourteenInningsHistoryPanel\s*\{[^}]*margin-top:7px!important/);
});
