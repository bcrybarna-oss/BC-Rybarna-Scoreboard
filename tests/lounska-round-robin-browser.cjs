'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const {serve}=require('./helpers/federal-statistics.cjs');

const root=path.resolve(__dirname,'..');
const baseline=process.env.LOUNSKA_BASELINE_REF;
const source=baseline
  ?execFileSync('git',['show',baseline+':index.html'],{cwd:root,encoding:'utf8',maxBuffer:10e6})
  :fs.readFileSync(path.join(root,'index.html'),'utf8');
const hook=`
window.roundRobinTest=function({ids,results,format='groups',membership='direct',loun=true,manual,penalties=false}){
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
  const matchesBefore=JSON.stringify(t.groups);
  const order=groupStandings(t.groups[0],t).map(r=>r.id);
  const tournament=tournamentPlacementRecords(t).map(r=>[r.playerId,r.value]);
  const placements=seriesTournamentPlacementRecords(series,t).map(r=>[r.playerId,r.value]);
  const points=Object.fromEntries(seriesStandings(series).map(r=>[r.playerId,r.points]));
  selectedSeriesId=series.id;
  renderSeriesModal();
  const seriesBody=$('seriesModalBody');
  const seriesTable=[...seriesBody.querySelectorAll('table:first-of-type tbody tr')].map(row=>
    [row.cells[1].querySelector('strong').textContent,Number(row.cells[6].textContent)]);
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
  if(membership==='historical'){
    historicalRenderStructure(t);
    historicalRule=$('historicalStructureBody').textContent.includes('Při rovnosti počtu výher');
  }
  return {order,tournament,placements,points,tables,seriesTable,resultsSummary,historicalRule,status:t.status,
    final:view.textContent.includes('TURNAJ DOHRÁN'),rule:view.textContent.includes('Při rovnosti počtu výher'),
    seriesRule:seriesBody.textContent.includes('Při rovnosti počtu výher'),unchanged:JSON.stringify(t.groups)===matchesBefore};
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
      const run=async input=>{
        await page.goto('http://lounska.local/');
        await page.locator('#cloudLoginModal.show').waitFor();
        await page.locator('#cloudOfflineBtn').click();
        return page.evaluate(input=>roundRobinTest(input),input);
      };
      const two=await run(pair);
      if(baseline){
        assert.deepEqual(two.order,['a','b','d','c']);
        assert.notDeepEqual(two.placements,rank(['b','a','c','d']));
        console.log('BASELINE',width,JSON.stringify(two));
        await page.close();
        continue;
      }
      const expected=['b','a','c','d'];
      assert.deepEqual(two.order,expected);
      assert.deepEqual(two.tournament,rank(expected));
      assert.deepEqual(two.placements,rank(expected));
      assert.deepEqual(two.tables,[expected,expected]);
      assert.deepEqual(two.points,{b:100,a:80,c:65,d:55});
      assert.deepEqual(two.seriesTable,[['b',100],['a',80],['c',65],['d',55]]);
      assert.match(two.resultsSummary,/Průběžně vede: b • 100 bodů/);
      assert.ok(two.rule&&two.seriesRule&&two.unchanged);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      assert.equal(await page.getByText('Při rovnosti počtu výher',{exact:false}).filter({visible:true}).count(),1);

      const three=await run(triple);
      assert.deepEqual(three.order,['f','e','a','b','c','d']);
      assert.deepEqual(three.tournament,rank(three.order));
      assert.deepEqual(three.placements,three.tournament);
      assert.deepEqual((await run(cycle)).order,['a','b','c']);
      const unfinished=await run({...pair,results:pair.results.filter((_,i)=>![0,4].includes(i))});
      assert.deepEqual(unfinished.order.slice(0,2),['a','b']);
      assert.equal(unfinished.final,false);
      assert.deepEqual(unfinished.placements,[]);
      assert.deepEqual(unfinished.points,{});
      const decisive=await run({ids:['a','b','c'],results:[['b','a',0],['a','c',0]]});
      assert.equal(decisive.order[0],'b'); // Both have one win, so their direct result applies.
      const unequal=await run({...pair,results:pair.results.filter((_,i)=>i!==3)});
      assert.ok(unequal.order.indexOf('a')<unequal.order.indexOf('b'));
      for(const input of [{loun:false},{loun:false,membership:'other-mode'},{membership:'unlinked'},
        {format:'groups_sko'},{format:'groups_dko'}]){
        const other=await run({...pair,...input});
        assert.deepEqual(other.order,['a','b','d','c']);
        assert.equal(other.rule,false);
      }
      const historical=await run({...pair,membership:'historical',penalties:true});
      assert.deepEqual(historical.order,expected);
      assert.deepEqual(historical.tournament,rank(expected));
      assert.deepEqual(historical.placements,rank(expected));
      assert.deepEqual(historical.points,two.points);
      assert.ok(historical.historicalRule);
      const manual=await run({...pair,membership:'historical',manual:rank(['a','d','c','b'])});
      assert.deepEqual(manual.tournament,rank(['a','d','c','b']));
      assert.deepEqual(manual.placements,manual.tournament);
      assert.deepEqual(manual.points,{a:100,d:80,c:65,b:55});
      assert.deepEqual(errors,[]);
      assert.deepEqual(requests,[]);
      console.log('PASS',width,'pair, mini-table, cycle, incomplete, placements, points, historical and scope');
      await page.close();
    }
  }finally{
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
