'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const css=(html.match(/<style id="other-disciplines-mobile-compact-v451112">([\s\S]*?)<\/style>/)||[])[1];

test('other mobile modes: isolated portrait CSS, no regression to solo 14.1',()=>{
 assert.ok(css);
 assert.match(css,/@media \(max-width:700px\) and \(orientation:portrait\)/);
 assert.ok(css.includes('body:has(#screen-match.active #solo14ScoreRow.hidden)'));
 assert.ok(!css.includes('#solo14ScoreRow:not(.hidden)'));
 assert.match(css,/#eightBallResultPanel:not\(\.hidden\)/);
 assert.match(css,/#ghostActions:not\(\.hidden\)/);
 assert.match(css,/#simpleCounterActions:not\(\.hidden\)/);
 assert.match(css,/#normalActions:not\(\.hidden\)/);
 assert.match(css,/#classic14Overview:not\(\.hidden\)/);
});
test('other mobile modes: core controls preserved in production DOM',()=>{
 const ids=['simpleAddP1','simpleAddP2','simpleBreakRunBtn','simpleUndoBtn',
   'eightBallWin0','eightBallWin1','eightBallClean0','eightBallRunout1',
   'actionLegalBtn','actionFoulBtn','actionSafeBtn','actionMissBtn','undoBtn',
   'ghostCleanRunoutBtn','ghostBIHRunoutBtn','ghostBreakFoulBtn','ghostFailedRackBtn',
   'ballsOnTableDisplay','addRack14','endMiss14','endSafe14','endFoul14','undo14Btn'];
 for(const id of ids)assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'unique action '+id);
 for(const selector of ['.fourteen-end-grid','.eightball-result-grid','#normalActions .action-grid']){
  assert.ok(css.includes(selector),selector);
 }
});
test('other mobile modes: typical actions touch sized and paired in rows',()=>{
 assert.match(css,/#normalActions \.action-grid\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/#normalActions \.action-grid \.btn\s*\{\s*min-height:44px!important/);
 assert.match(css,/#eightBallResultPanel \.eightball-result-grid\s*\{\s*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/#fourteenPanel \.fourteen-end-grid\s*\{\s*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 assert.match(css,/#simpleCounterActions \.btn\s*\{\s*min-height:44px!important/);
});
