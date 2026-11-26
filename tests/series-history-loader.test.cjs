'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{topFunction}=require('./helpers/source-functions.cjs');
test('disabled series authority preserves baseline tournament loader behavior and repair semantics',async()=>{
 const baseline=fs.readFileSync('tests/fixtures/tournament-loader-before-series-history.txt','utf8'),current=topFunction(fs.readFileSync('index.html','utf8'),'loadSecureTournaments');
 async function run(source,repair){const events=[],c={SERIES_AUTHORITY_ENABLED:false,ensureCloudToken:async()=>true,cloudUrl:p=>'/'+p,Date:{now:()=>123},fetch:async(u,o)=>{events.push({u,o});return {ok:true,json:async()=>({t:{id:'t',status:'active'}})};},data:{},DB_KEY:'db',localStorage:{setItem:()=>{}},repairHybridWaitingState:()=>repair,canManageTournament:()=>true,secureTournamentRequest:async(id,method,value)=>{events.push({id,method,value:JSON.parse(JSON.stringify(value))});},window:{renderModernHome:()=>events.push('home')},console};vm.createContext(c);vm.runInContext(source,c);const result=await c.loadSecureTournaments();return JSON.parse(JSON.stringify({result,events}));}
 // Optional context argument is undefined/null on the disabled path; payloads and all operations match.
 for(const repair of [false,true])assert.deepEqual(await run(current,repair),await run(baseline,repair));
});
