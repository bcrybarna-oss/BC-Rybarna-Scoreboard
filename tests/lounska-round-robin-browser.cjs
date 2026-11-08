'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {serve}=require('./helpers/federal-statistics.cjs');

const root=path.resolve(__dirname,'..');
const baseline=process.env.LOUNSKA_BASELINE_REF;
const priorRegression=baseline?.startsWith('36e006c');
const source=baseline
  ?execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10e6})
  :fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`
window.makeRoundRobin=function({ids,results,format='groups',membership='direct',loun=true,manual,penalties=false}){
  data=defaultData();
  data.players=Object.fromEntries(ids.map(id=>[id,{id,name:id}]));
  cloudUid='organizer';
  const series={id:'series',name:loun?'Lounská tour':'Jiná série',createdByUid:cloudUid,tournamentIds:[],
    pointsTop:[100,80,65,55],pointsBands:[45,25,10,5]};
  if(membership==='other-mode')series.placementTieBreak='score_h2h_group';
  data.tournamentSeries=[series];
  const config={name:'Turnaj 1',date:'2026-10-01',format,playerIds:ids,discipline:'9-ball',raceTo:5,
    groupCount:1,advance:2,penalties};
  let t=membership==='historical'
    ?historicalCreateStructure(config,ids,series)
    :format==='groups'
      ?generateGroupTournament(config.name,ids,'9-ball',5,'alternate',1,{},1,'manual')
      :generateHybridTournament(config.name,ids,'9-ball',5,'alternate',1,2,format==='groups_dko'?'dko':'sko',{},1,'manual',false);
  data.tournaments=[t];
  if(membership==='direct'||membership==='other-mode')series.tournamentIds.push(t.id);
  if(membership==='unlinked')t.seriesPlacementTieBreak='score_h2h_group';
  for(const [winner,loser,losingRacks] of results){
    const m=t.groups[0].matches.find(m=>[m.player1Id,m.player2Id].includes(winner)&&[m.player1Id,m.player2Id].includes(loser));
    const first=m.player1Id===winner;
    const scores=first?[5,losingRacks]:[losingRacks,5];
    if(membership==='historical'){
      const slot=historicalStructureSlots(t).find(slot=>slot.m.id===m.id);
      t=historicalPlanScore(t,slot.key,...scores,cloudUid).t;
      data.tournaments=[t];
    }else{
      processTournamentResult({id:null,tournamentLink:{tournamentId:t.id,tournamentMatchId:m.id},
        playerIds:[m.player1Id,m.player2Id],scores,winner:first?0:1,endedAt:'2026-10-01T12:00:00Z'},t);
    }
  }
  if(manual){
    t.historicalStructure.manualPlaces=manual.map(([playerId,place])=>({playerId,place}));
    t=historicalReplay(t).t;
    data.tournaments=[t];
  }
  return t.id;
};
window.roundRobinTest=function(input){
  makeRoundRobin(input);
  const t=data.tournaments[0],series=data.tournamentSeries[0];
  const matchesBefore=JSON.stringify(t.groups);
  const order=groupStandings(t.groups[0],t).map(r=>r.id);
  const seriesOrder=groupStandings(t.groups[0],t,series).map(r=>r.id);
  const tournament=tournamentPlacementRecords(t).map(r=>[r.playerId,r.value]);
  const placements=seriesTournamentPlacementRecords(series,t).map(r=>[r.playerId,r.value]);
  const points=Object.fromEntries(seriesStandings(series).map(r=>[r.playerId,r.points]));
  selectedSeriesId=series.id;
  renderSeriesModal();
  const seriesBody=$('seriesModalBody');
  const seriesTable=[...(seriesBody.querySelector('table')?.querySelectorAll('tbody tr')||[])].filter(row=>row.cells.length===7).map(row=>
    [row.cells[1].querySelector('strong').textContent,Number(row.cells[6].textContent)]);
  const scoped=seriesBody.querySelector('.series-round-robin');
  const scopedLabel=scoped?.querySelector('summary').textContent;
  const scopedRows=[...(scoped?.querySelectorAll('tbody tr')||[])].map(row=>[...row.cells].map(cell=>cell.textContent));
  renderResultsSeries();
  const resultsSummary=$('resultsSeriesList').textContent;
  showScreen('tournament');
  const panel=$('screen-tournament');
  const view=document.createElement('div');
  view.id='lounska-test-view';
  panel.replaceChildren(view);
  view.innerHTML=renderGroupTournament(t);
  const tables=[...view.querySelectorAll('table')].map(table=>[...table.querySelectorAll('tbody tr')].map(row=>row.querySelector('strong').textContent));
  let historicalRule=false;
  if(input.membership==='historical'){
    historicalRenderStructure(t);
    historicalRule=$('historicalStructureBody').textContent.includes('Při rovnosti počtu výher');
  }
  return {order,seriesOrder,tournament,placements,points,tables,seriesTable,scopedLabel,scopedRows,resultsSummary,historicalRule,status:t.status,
    final:view.textContent.includes('TURNAJ DOHRÁN'),rule:view.textContent.includes('Při rovnosti počtu výher'),
    seriesRule:seriesBody.textContent.includes('Při rovnosti počtu výher'),unchanged:JSON.stringify(t.groups)===matchesBefore};
};
window.prepareDualSeries=function(input){
  const id=makeRoundRobin({...input,membership:'none'});
  data.tournamentSeries.push({id:'standard',name:'Standardní série',createdByUid:cloudUid,tournamentIds:[],placementTieBreak:'legacy'});
  return id;
};
window.auditDualSeries=function(ids){
  const t=data.tournaments[0];
  const before=JSON.stringify(data);
  const bySeries=Object.fromEntries(ids.map(id=>{
    const s=data.tournamentSeries.find(s=>s.id===id);
    return [id,{
      linked:historicalSeriesTournamentIds(s).includes(t.id),
      placements:Object.fromEntries(seriesTournamentPlacementRecords(s,t).map(r=>[r.playerId,r.value])),
      points:Object.fromEntries(seriesStandings(s).map(r=>[r.playerId,r.points]))
    }];
  }));
  const placements=Object.fromEntries(tournamentPlacementRecords(t).map(r=>[r.playerId,r.value]));
  renderTournamentStats();
  renderResultsTournaments();
  return {bySeries,placements,stats:buildTournamentStats(),
    statsHtml:$('tournamentStatsSummary').innerHTML,historyHtml:$('tournamentStatsHistory').innerHTML,
    groups:JSON.stringify(t.groups),immutable:JSON.stringify(data)===before};
};
`;
const html=source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,(_,start,body,end)=>start+body+hook+end);
assert.notEqual(html,source);

const pair={ids:['a','b','c','d'],results:[
  ['b','a',4],['a','c',0],['a','d',0],['b','c',4],['d','b',0],['c','d',4]
]};
const triple={ids:['a','b','c','d','e','f'],results:[
  ['a','b',4],['a','c',4],['d','a',0],['e','a',0],['f','a',0],
  ['b','c',4],['b','d',0],['e','b',4],['f','b',4],
  ['c','d',0],['c','e',0],['f','c',4],['e','d',0],['f','d',4],['f','e',4]
]};
const cycle={ids:['c','b','a'],results:[['a','b',0],['b','c',1],['c','a',4]]};
const rank=ids=>ids.map((id,i)=>[id,i+1]);
const standard=['a','b','d','c'], lounska=['b','a','c','d'];
const pointsFor=ids=>Object.fromEntries(ids.map((id,i)=>[id,[100,80,65,55][i]]));

async function checkDualSeries(page,load,width){
  for(const ids of [ ['standard','series'], ['series','standard'] ]){
    await load();
    const id=await page.evaluate(input=>prepareDualSeries(input),pair);
    const audit=order=>page.evaluate(ids=>auditDualSeries(ids),order);
    const before=await audit(ids);
    const open=async series=>{
      await page.evaluate(series=>openTournamentSeries(series),series);
      return page.locator('#seriesModal.show');
    };
    const link=async series=>{
      const dialog=await open(series);
      await dialog.locator(`button[onclick="addTournamentToSeries('${series}','${id}')"]`).click();
      await dialog.getByRole('button',{name:'ODEBRAT',exact:true}).waitFor();
    };
    await link(ids[0]);
    const single=await audit(ids);
    await link(ids[1]);
    const dual=await audit(ids);
    assert.deepEqual(dual,await audit([...ids].reverse()));
    assert.ok(before.immutable&&single.immutable&&dual.immutable);
    assert.equal(dual.groups,before.groups);
    assert.equal(dual.bySeries.standard.linked,true);
    assert.equal(dual.bySeries.series.linked,true);
    const expectedStandard=priorRegression?lounska:standard;
    const expectedLounska=baseline&&!priorRegression?['a','b','c','d']:lounska;
    assert.deepEqual(dual.bySeries.standard.points,pointsFor(expectedStandard));
    assert.deepEqual(dual.bySeries.series.points,pointsFor(expectedLounska));
    if(ids[0]==='standard'){
      assert.deepEqual(single.bySeries.standard.points,pointsFor(standard));
    }else{
      assert.deepEqual(single.bySeries.series.points,dual.bySeries.series.points);
    }
    if(!baseline){
      const baselinePlaces=Object.fromEntries(rank(standard));
      for(const state of [before,single,dual]){
        assert.deepEqual(state.placements,baselinePlaces);
        assert.deepEqual(state.stats,before.stats);
        assert.equal(state.statsHtml,before.statsHtml);
        assert.equal(state.historyHtml,before.historyHtml);
      }
      assert.match(before.historyHtml,/1\. místo/);
      assert.match(await page.locator('#resultsTournamentList').textContent(),/Vítěz:\s*a/);
      for(const series of [ids[0],ids[1],ids[0],ids[1]]){
        const dialog=await open(series);
        const expected=series==='series'?lounska:standard;
        const scoped=dialog.locator('.series-round-robin');
        await scoped.locator('summary').click();
        assert.match(await scoped.locator('summary').textContent(),series==='series'?/Lounská tour/:/Standardní série/);
        const rows=await scoped.locator('tbody tr').evaluateAll(rows=>rows.map(r=>[r.cells[1].textContent,Number(r.cells[2].textContent)]));
        assert.deepEqual(rows,expected.map(player=>[player,pointsFor(expected)[player]]));
        assert.equal(await scoped.getByText('Při rovnosti počtu výher',{exact:false}).count(),series==='series'?1:0);
        assert.ok(await scoped.evaluate(el=>el.scrollWidth<=el.clientWidth));
        await dialog.getByRole('button',{name:'VÝSLEDKY',exact:true}).click();
        await dialog.waitFor({state:'hidden'});
        const common=page.locator('#screen-tournament-detail.active');
        await common.waitFor();
        const places=await common.locator('.stats-table tbody').first().locator('tr').evaluateAll(rows=>rows.map(r=>r.cells[1].textContent));
        assert.deepEqual(places,standard);
        assert.equal(await common.getByText('Při rovnosti počtu výher',{exact:false}).count(),0);
      }
    }
    const removing=await open(ids[0]);
    await removing.getByRole('button',{name:'ODEBRAT',exact:true}).click();
    const after=await audit(ids);
    assert.equal(after.bySeries[ids[0]].linked,false);
    assert.deepEqual(after.bySeries[ids[0]].points,{});
    if(!baseline){
      assert.deepEqual(after.bySeries[ids[1]],dual.bySeries[ids[1]]);
      assert.deepEqual(after.stats,before.stats);
      assert.equal(after.groups,before.groups);
      assert.ok(after.immutable);
    }
    console.log('DUAL',width,baseline||'candidate',ids.join(' → '),JSON.stringify(dual.bySeries));
  }
}

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try{
    for(const width of [1440,390,320]){
      const page=await browser.newPage({viewport:{width,height:960}});
      const errors=[],requests=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/*',route=>{
        const request=route.request();
        if(request.method()!=='GET')requests.push(request.method());
        if(request.url()==='http://lounska.local/')return route.fulfill({contentType:'text/html',body:html});
        return serve(route)||route.abort();
      });
      const load=async()=>{
        await page.goto('http://lounska.local/');
        await page.locator('#cloudLoginModal.show').waitFor();
        await page.locator('#cloudOfflineBtn').click();
      };
      const run=async input=>{
        await load();
        return page.evaluate(input=>roundRobinTest(input),input);
      };
      await checkDualSeries(page,load,width);
      const two=await run(pair);
      if(baseline){
        assert.deepEqual(two.order,priorRegression?lounska:standard);
        assert.deepEqual(errors,[]);
        assert.deepEqual(requests,[]);
        console.log('BASELINE',width,JSON.stringify(two));
        await page.close();
        continue;
      }
      assert.deepEqual(two.order,standard);
      assert.deepEqual(two.seriesOrder,lounska);
      assert.deepEqual(two.tournament,rank(standard));
      assert.deepEqual(two.placements,rank(lounska));
      assert.deepEqual(two.tables,[standard,standard]);
      assert.deepEqual(two.points,{b:100,a:80,c:65,d:55});
      assert.deepEqual(two.seriesTable,[['b',100],['a',80],['c',65],['d',55]]);
      assert.match(two.resultsSummary,/Průběžně vede: b • 100 bodů/);
      assert.ok(!two.rule&&two.seriesRule&&two.unchanged);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.getByText('Při rovnosti počtu výher',{exact:false}).filter({visible:true}).count(),0);

      const three=await run(triple);
      assert.deepEqual(three.seriesOrder,['f','e','a','b','c','d']);
      assert.deepEqual(three.tournament,rank(three.order));
      assert.deepEqual(three.placements,rank(three.seriesOrder));
      assert.deepEqual((await run(cycle)).seriesOrder,['a','b','c']);
      const unfinished=await run({...pair,results:pair.results.filter((_,i)=>![0,4].includes(i))});
      assert.deepEqual(unfinished.order.slice(0,2),['a','b']);
      assert.equal(unfinished.final,false);
      assert.deepEqual(unfinished.placements,[]);
      assert.deepEqual(unfinished.points,{});
      assert.match(unfinished.scopedLabel,/Průběžné pořadí v sérii/);
      assert.deepEqual(unfinished.scopedRows.map(row=>row[0]),unfinished.seriesOrder);
      const decisive=await run({ids:['a','b','c'],results:[['b','a',0],['a','c',0]]});
      assert.equal(decisive.seriesOrder[0],'b'); // Both have one win, so their direct result applies.
      const unequal=await run({...pair,results:pair.results.filter((_,i)=>i!==3)});
      assert.ok(unequal.seriesOrder.indexOf('a')<unequal.seriesOrder.indexOf('b'));
      for(const input of [{loun:false},{loun:false,membership:'other-mode'},{membership:'unlinked'},
        {format:'groups_sko'},{format:'groups_dko'}]){
        const other=await run({...pair,...input});
        assert.deepEqual(other.order,['a','b','d','c']);
        assert.equal(other.rule,false);
      }
      const historical=await run({...pair,membership:'historical',penalties:true});
      assert.deepEqual(historical.order,standard);
      assert.deepEqual(historical.tournament,rank(standard));
      assert.deepEqual(historical.placements,rank(lounska));
      assert.deepEqual(historical.points,two.points);
      assert.equal(historical.historicalRule,false);
      assert.deepEqual(historical.scopedRows.map(row=>row.slice(1)),lounska.map(id=>[id,String(two.points[id])]));
      const manual=await run({...pair,membership:'historical',manual:rank(['a','d','c','b'])});
      assert.deepEqual(manual.tournament,rank(['a','d','c','b']));
      assert.deepEqual(manual.placements,manual.tournament);
      assert.deepEqual(manual.points,{a:100,d:80,c:65,b:55});
      assert.deepEqual(manual.scopedRows.map(row=>row[1]),['a','d','c','b']);
      assert.deepEqual(errors,[]);
      assert.deepEqual(requests,[]);
      console.log('PASS',width,'pair, mini-table, cycle, incomplete, placements, points, historical and scope');
      await page.close();
    }
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
