'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {taggedReference}=require('./fixtures/federal-tags.cjs');
const copy=x=>JSON.parse(JSON.stringify(x)),html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const a=html.indexOf('  function federalRackScoresAgree('),b=html.indexOf('\n  }',a)+4,ctx={fetch(){throw Error('No network');},localStorage:{setItem(){throw Error('No writes');}}};vm.createContext(ctx);vm.runInContext(html.slice(a,b)+html.slice(html.indexOf('  // Federal Cup calculation contract v1.'),html.indexOf('  function detailedCounterActive()')),ctx);
function fixture(type='singles',id=type){const m=taggedReference(type,id);m.federalCupLink.rosterParticipants=[0,1].map(side=>Array.from({length:5},(_,i)=>({id:(side?'b':'a')+(i+1),name:(side?'CZ':'SK')+(i+1),team:side?'b':'a',year:2026})));return m;}
const config={year:2026,reportHost:'SK',teamResults:{}};
const data=(ms,c=config)=>copy(ctx.federalReportData(ms,c,Number(c.year))),results=(r,id='a1',side=0)=>copy(ctx.federalReportResults(r,id,side)),format=x=>copy(ctx.federalReportMetric(x));

test('whole matches: Singles, both Doubles members and all five nominated Team players once',()=>{
 const ms=['team','doubles','singles'].map(t=>fixture(t)),before=JSON.stringify(ms),r=data(ms);
 assert.deepEqual(r.series,[0,3]);assert.equal(results(r).losses,3);assert.equal(results(r).wins,0);assert.equal(results(r).value,0);
 assert.equal(results(r,'a2').losses,2);for(const id of ['a3','a4','a5'])assert.equal(results(r,id).losses,1);
 assert.equal(results(r,'b1',1).wins,3);for(const id of ['b3','b4','b5'])assert.equal(results(r,id,1).wins,1);
 assert.equal(r.season.individuals.a1.metrics.pottedBalls.numerator,7,'Doubles pots are never personal contributions');assert.equal(JSON.stringify(ms),before);
});
test('latest fixture and duplicate IDs are counted once; exact selected match IDs retained',()=>{
 const old=fixture('singles','old'),latest=fixture('singles','latest');latest.endedAt='2026-10-22T10:00:00Z';const r=data([old,latest,copy(latest)]);
 assert.equal(results(r).losses,1);assert.equal(r.selected.length,1);assert.equal(r.selected[0].matchId,'latest');assert.equal(r.duplicates.length,2);
});
test('results use stable frozen nomination, never current names or current roster IDs',()=>{
 const m=fixture('team');m.federalCupLink.rosterParticipants[0][4].name='Historické jméno';const c={...config,rosterParticipantIdsA:['new1','new2','new3','new4','new5'],participants:{new5:{id:'new5',name:'Historické jméno'}}};const r=data([m],c);
 assert.equal(results(r,'a5').losses,1);assert.equal(results(r,'new5').losses,0);assert.equal(r.people.a5.name,'Historické jméno');
});
test('missing/manual nomination preserves known subtotals, never fabricates five people',()=>{
 const s=fixture(),t=fixture('team');delete t.federalCupLink.rosterParticipants;let r=data([s,t]);assert.equal(results(r).losses,1);assert.equal(results(r).coverage,'partial');assert.equal(results(r).value,null);assert.equal(results(r,'a5').coverage,'unknown');
 r=data([s],{...config,teamResults:{1:{a:5,b:3,done:true}}});assert.deepEqual(r.series,[1,1]);assert.equal(results(r).losses,1);assert.equal(results(r).wins,0);assert.equal(results(r).value,null);
});
test('invalid nomination, identity on both sides, wrong year do not assign outcomes',()=>{
 for(const change of [m=>m.federalCupLink.rosterParticipants[0].pop(),m=>m.federalCupLink.rosterParticipants[0][4].id='a1',m=>m.federalCupLink.rosterParticipants[0][0].year=2025,m=>m.federalCupLink.rosterParticipants[1][0].id='a1']){const m=fixture('team');change(m);assert.equal(results(data([m])).coverage,'unknown');}
 const a=fixture(),b=fixture('singles','second');b.federalCupLink.fixtureNo=6;b.federalCupLink.lineupParticipants[1][0].id='a1';const r=data([a,b]);assert.equal(results(r).value,null);
});
test('incomplete/playing/wrong-year records and tied/missing scores do not manufacture results',()=>{
 for(const status of ['playing','active','incomplete']){const m=fixture();m.status=status;assert.equal(data([m]).selected.length,0);}
 const m=fixture();m.federalCupLink.year=2025;assert.equal(data([m]).selected.length,0);
 for(const scores of [[3,3],[null,5],[-1,5],[],[true,false],[' ',5]]){const m=fixture();m.scores=scores;const r=data([m]);assert.deepEqual(r.series,[0,0]);assert.equal(results(r).value,null);assert.equal(results(r).coverage,'unknown');}
 assert.equal(results(data([])).value,null,'empty season never 0%');
});
test('season success uses wins/(wins+losses); excludes post-clinch fixtures consistently with series',()=>{
 const ms=Array.from({length:12},(_,i)=>{const m=fixture('singles','m'+i);m.federalCupLink.fixtureNo=i+1;if(i!==1)m.scores=[5,3];return m;});const r=data(ms);assert.deepEqual(r.series,[11,1]);assert.equal(results(r).value,11/12*100);
 ms[1].scores=[5,3];const end=data(ms);assert.equal(end.selected.length,11);assert.equal(end.excluded.length,1);assert.equal(end.season.fixtures.length,11);assert.equal(results(end).wins,11);
});
test('all 13 metric values are read unchanged through the existing API',()=>{
 const m=fixture(),r=data([m]),direct=copy(ctx.federalCalculateSeason([m],config,2026));assert.equal(Object.keys(r.season.individuals.a1.metrics).length,13);assert.deepEqual(r.season,direct);
});
test('host order is explicit, year 2026 default authorized; future years have no guessed host',()=>{
 assert.deepEqual(copy(ctx.federalReportOrder({year:2026})),[0,1]);assert.deepEqual(copy(ctx.federalReportOrder({year:2027,reportHost:'CZ'})),[1,0]);assert.equal(ctx.federalReportOrder({year:2027}),null);assert.equal(ctx.federalReportOrder({year:2026,reportHost:'other'}),null);
});
test('format partial/unknown/zero correctly, no bar for partial or no attempts',()=>{
 assert.equal(format({kind:'percent',coverage:'partial',numerator:3,denominator:5,value:60}).bar,null);assert.match(format({kind:'percent',coverage:'partial',numerator:3,denominator:5}).text,/Doloženo 3 \/ 5/);
 assert.equal(format({coverage:'unknown'}).text,'—');const zero=format({kind:'ratio',coverage:'complete',numerator:0,denominator:0,value:null});assert.equal(zero.bar,null);assert.match(zero.text,/bez pokusů/);
 assert.equal(format({kind:'percent',coverage:'complete',numerator:0,denominator:2,value:0}).bar,0);assert.equal(format({kind:'ratio',coverage:'complete',numerator:2,denominator:5,value:.4}).bar,40);
});
