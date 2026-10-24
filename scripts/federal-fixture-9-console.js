/* MANUAL DEVTOOLS SNIPPET ONLY. Install while paused inside
 * window.getModernDashboardSnapshot. Installation performs NO requests/writes.
 * No token is exported, printed, copied, or saved. See the accompanying guide.
 */
(() => {
  'use strict';
  const name='fc9Repair';
  if(location.origin!=='https://bcrybarna-oss.github.io'||location.pathname!=='/BC-Rybarna-Scoreboard/')throw Error('STOP: nesprávná produkční stránka.');
  if(Object.hasOwn(window,name))throw Error('STOP: pomocník již existuje. Nepřepisovat rozpracovaný stav.');
  if(typeof ensureCloudToken!=='function'||typeof cloudUrl!=='function'||typeof currentUserIsSystemAdmin!=='function'||typeof federalReportData!=='function')throw Error('STOP: konzole není v aplikačním scope. Viz postup s debuggerem.');
  // Capture the EXISTING application closures, not their private token values.
  const session=ensureCloudToken,urlFor=cloudUrl,admin=currentUserIsSystemAdmin,reportData=federalReportData;
  const approved={
  "matchId": "3d4c35e6-e336-49d5-a9b3-9955cec59c3d",
  "startedAt": "2026-10-24T15:54:09.777Z",
  "endedAt": "2026-10-24T16:27:05.963Z",
  "beforeCanonicalSha256": "7195a1c5562cfd1aac3e913170a412e6607aa6bd4c229a17a599d79b15876f6e",
  "afterCanonicalSha256": "f9a9e3ca955488d9b87afe932564a0563975c2cb9660067435c58c28fbc36f78",
  "link": {
    "year": 2026,
    "fixtureNo": 9,
    "block": 2,
    "type": "doubles",
    "teamAName": "Slovensko",
    "teamBName": "Česko",
    "rosterA": [
      "Jakub Koniar",
      "Kristián Mrva",
      "Daniel Lang",
      "Timothei Furko",
      "Mark Szabo"
    ],
    "rosterB": [
      "Jan Meisner",
      "Matouš Vlk",
      "Tom Kurz",
      "Jaroslav Tichý",
      "Ladislav Hajšman"
    ],
    "rosterParticipants": [
      [
        {
          "id": "fc-b43ebda0-4628-4217-8b5f-cdf1747038e2",
          "name": "Jakub Koniar",
          "team": "a",
          "year": 2026
        },
        {
          "id": "fc-92475cf5-2de5-45e4-adef-94b60f11ecae",
          "name": "Kristián Mrva",
          "team": "a",
          "year": 2026
        },
        {
          "id": "fc-14afdd89-14a3-473b-ae1c-1aae5d711496",
          "name": "Daniel Lang",
          "team": "a",
          "year": 2026
        },
        {
          "id": "fc-cde0010c-75af-4f4a-8b18-f3cff6cbfe4c",
          "name": "Timothei Furko",
          "team": "a",
          "year": 2026
        },
        {
          "id": "fc-ef1400d4-fcb4-4926-985e-1e8d2a823f14",
          "name": "Mark Szabo",
          "team": "a",
          "year": 2026
        }
      ],
      [
        {
          "id": "fc-d37a2dab-8117-48fd-bd8f-e237f49e9803",
          "name": "Jan Meisner",
          "team": "b",
          "year": 2026
        },
        {
          "id": "fc-93258549-c0ef-4370-ac4b-cc059db90465",
          "name": "Matouš Vlk",
          "team": "b",
          "year": 2026
        },
        {
          "id": "fc-35818099-c4c1-4e03-8165-4b1bd5f7fe94",
          "name": "Tom Kurz",
          "team": "b",
          "year": 2026
        },
        {
          "id": "fc-f0327cdb-18e5-4d4d-a582-a5b601a822f7",
          "name": "Jaroslav Tichý",
          "team": "b",
          "year": 2026
        },
        {
          "id": "fc-b24c5aa5-0932-4d14-ae7c-777ac9ac7308",
          "name": "Ladislav Hajšman",
          "team": "b",
          "year": 2026
        }
      ]
    ],
    "lineupParticipants": [
      [
        {
          "id": "fc-ef1400d4-fcb4-4926-985e-1e8d2a823f14",
          "name": "Mark Szabo",
          "team": "a",
          "year": 2026
        },
        {
          "id": "fc-b43ebda0-4628-4217-8b5f-cdf1747038e2",
          "name": "Jakub Koniar",
          "team": "a",
          "year": 2026
        }
      ],
      [
        {
          "id": "fc-35818099-c4c1-4e03-8165-4b1bd5f7fe94",
          "name": "Tom Kurz",
          "team": "b",
          "year": 2026
        },
        {
          "id": "fc-d37a2dab-8117-48fd-bd8f-e237f49e9803",
          "name": "Jan Meisner",
          "team": "b",
          "year": 2026
        }
      ]
    ],
    "lineupA": [
      "fc-ef1400d4-fcb4-4926-985e-1e8d2a823f14",
      "fc-b43ebda0-4628-4217-8b5f-cdf1747038e2"
    ],
    "lineupB": [
      "fc-35818099-c4c1-4e03-8165-4b1bd5f7fe94",
      "fc-d37a2dab-8117-48fd-bd8f-e237f49e9803"
    ]
  }
};
  const id=approved.matchId,target='matches/'+id,configPath='appData/data/federalCup2026',deletedPath='appData/data/deletedMatchIds';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const canonical=x=>JSON.stringify(sort(x));
  function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,sort(x[k])]));return x;}
  async function sha(x){const bytes=new TextEncoder().encode(canonical(x));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
  const eq=(a,b)=>canonical(a)===canonical(b),rows=x=>Object.values(x||{});
  const assert=(ok,msg)=>{if(!ok)throw Error('STOP: '+msg);};
  let staged=null,undoStage=null,busy=false,attempted=false,rollbackAttempted=false;
  async function locked(fn){assert(!busy,'jiná operace ještě běží.');busy=true;try{return await fn();}finally{busy=false;}}
  async function request(path,method='GET',body,etag){
    assert(admin(),'je nutné přihlášení systémového administrátora.');
    assert(await session(),'relace není platná. Přihlas se znovu.');
    assert(admin(),'role se změnila.');
    const headers={'Content-Type':'application/json'};
    if(method==='GET')headers['X-Firebase-ETag']='true';
    else{assert(path===target&&method==='PUT'&&etag,'nepovolená operace.');headers['If-Match']=etag;}
    let res;
    // A failed PUT has an UNKNOWN outcome; NEVER retry automatically.
    try{res=await fetch(urlFor(path),{method,cache:'no-store',headers,...(body===undefined?{}:{body:JSON.stringify(body)})});}
    catch{throw Error(method==='PUT'?'STOP: výsledek zápisu je neznámý. Neopakuj zápis; spusť verify().':'STOP: čtení selhalo. Bez zápisu.');}
    assert(res.status!==412,'HTTP 412: souběžná změna; podmíněný zápis nebyl proveden.');
    assert(res.ok,'HTTP '+res.status+'; operace se neopakuje. Při PUT nejprve verify().');
    let value;try{value=await res.json();}catch{throw Error('STOP: nečitelná odpověď; po PUT nejprve verify(), ne opakovaný zápis.');}
    const tag=res.headers.get('ETag');assert(method!=='GET'||tag,'server neposkytl čitelný ETag. Bez zápisu.');
    return {value,etag:tag};
  }
  async function readAll(){
    // Only GETs. Collections stay in memory; unrelated matches are not downloaded.
    const matches=await request('matches'),config=await request(configPath),deleted=await request(deletedPath),match=await request(target);
    assert(match.value&&eq(matches.value?.[id],match.value),'zápas se během čtení změnil nebo klíč neodpovídá matchId.');
    return {matches,config,deleted,match,time:Date.now()};
  }
  function nominatedLink(c){
    assert(c&&Number(c.year)===2026,'jiný ročník konfigurace.');
    const ids=[c.lineups?.[9]?.a,c.lineups?.[9]?.b];
    assert(eq(ids,[approved.link.lineupA,approved.link.lineupB]),'nominace #9 se liší od schváleného návrhu.');
    const rosters=[c.rosterParticipantIdsA,c.rosterParticipantIdsB];
    assert(rosters.every((ps,i)=>Array.isArray(ps)&&ps.length===5&&new Set(ps).size===5&&ps.every(pid=>c.participants?.[pid]?.team===(i?'b':'a')&&Number(c.participants[pid].year)===2026)),'neplatná soupiska.');
    return {year:2026,fixtureNo:9,block:2,type:'doubles',teamAName:c.teamAName,teamBName:c.teamBName,rosterA:c.rosterA,rosterB:c.rosterB,rosterParticipants:rosters.map(ps=>ps.map(pid=>c.participants[pid])),lineupParticipants:ids.map(ps=>ps.map(pid=>c.participants[pid])),lineupA:ids[0],lineupB:ids[1]};
  }
  async function validateBefore(s){
    const m=s.match.value;
    assert(m.id===id&&m.status==='complete'&&m.startedAt===approved.startedAt&&m.endedAt===approved.endedAt&&eq(m.scores,[5,3])&&m.doublesMode===true&&m.discipline==='9-ball','identita nebo dokončení se změnily.');
    assert(!Object.hasOwn(m,'federalCupLink'),'zápas již obsahuje vazbu; nevyměňovat ji ani při hodnotě null. Použij verify().');
    assert(await sha(m)===approved.beforeCanonicalSha256,'živý záznam se liší od schválené zálohy. Nic neopravovat.');
    assert(!Object.hasOwn(s.deleted.value||{},id)&&!rows(s.deleted.value).includes(id),'zápas má příznak smazání.');
    assert(rows(s.matches.value).filter(x=>x?.id===id).length===1,'duplicitní matchId.');
    assert(!rows(s.matches.value).some(x=>x?.id!==id&&Number(x?.federalCupLink?.year)===2026&&Number(x?.federalCupLink?.fixtureNo)===9),'jiný zápas už má vazbu na #9 (včetně rozehraného).');
    assert(eq(nominatedLink(s.config.value),approved.link),'soupiska nebo snapshot účastníků se změnily.');
  }
  function download(value,label){
    const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=u;a.download='FC2026-9-'+id+'-'+label+'-'+Date.now()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000);
  }
  function backup(s,label){download({purpose:'FC9 single-record backup; contains NO authentication tokens',savedAt:new Date().toISOString(),matchId:id,match:s.match.value,matchETag:s.match.etag,nomination:s.config.value?.lineups?.[9],approvedLink:approved.link,beforeCanonicalSha256:approved.beforeCanonicalSha256,afterCanonicalSha256:approved.afterCanonicalSha256},label);}
  function sameReads(a,b){return ['matches','config','deleted','match'].every(k=>a[k].etag===b[k].etag&&eq(a[k].value,b[k].value));}
  async function verifyRead(){
    const s=await readAll(),m=s.match.value,without=copy(m);delete without.federalCupLink;
    assert(await sha(without)===approved.beforeCanonicalSha256,'jiné pole zápasu se liší od původní schválené zálohy. Žádný automatický návrat.');
    const original=!Object.hasOwn(m,'federalCupLink'),applied=eq(m.federalCupLink,approved.link);
    assert(original||applied,'vazba se liší od schválené i původní hodnoty.');
    assert(await sha(m)===(applied?approved.afterCanonicalSha256:approved.beforeCanonicalSha256),'celkový otisk neodpovídá.');
    const all=rows(s.matches.value),r=reportData(all,s.config.value,2026),selected=r.selected.filter(f=>f.fixtureNo===9);
    assert(!applied||(selected.length===1&&selected[0].matchId===id&&selected[0].source==='detailed'),'report nevybírá právě opravený zápas.');
    assert(!applied||!r.duplicates.some(f=>f.fixtureNo===9),'po opravě existuje duplicita #9.');
    const result={matchId:id,state:applied?'Vazba opravena':'Původní stav bez vazby',scores:m.scores,teamScore:r.series,onlyFederalCupLinkChanged:applied,allOtherFieldsUnchanged:true,reportSource:selected,productionVersion:document.querySelector('.modern-brand-version')?.textContent||'ověř v aplikaci'};
    console.log('FC9 ověření (bez zápisu):',result);return result;
  }
  Object.defineProperty(window,name,{configurable:true,value:Object.freeze({
    prepare:()=>locked(async()=>{
      assert(!attempted,'zápis již byl zkusen. Nejdřív verify(); neinstaluj znovu pro opakování.');
      staged=null;const s=await readAll();await validateBefore(s);
      const after={...copy(s.match.value),federalCupLink:copy(approved.link)};
      assert(await sha(after)===approved.afterCanonicalSha256,'neshodný očekávaný výsledek.');
      const diff={operation:'add',path:'/federalCupLink',before:'pole chybí',after:copy(approved.link)};
      backup(s,'BEFORE');staged=s;
      console.log('BEZ ZÁPISU. Ulož a zkontroluj staženou zálohu. Přesný jediný rozdíl:',diff);
      return {matchId:id,matchScores:s.match.value.scores,change:diff,validForSeconds:300,productionWrites:0};
    }),
    commit:options=>locked(async()=>{
      assert(options?.backupSaved===true&&options?.exclusiveMaintenance===true,'potvrď skutečně uloženou zálohu a klid ostatních administrátorů (viz návod).');
      assert(staged&&!attempted&&Date.now()-staged.time<300000,'chybí platná příprava do 5 minut; prepare() je pouze čtení.');
      const fresh=await readAll();await validateBefore(fresh);
      assert(sameReads(staged,fresh),'od přípravy se změnil zápas, konfigurace, seznam zápasů nebo smazání. Bez zápisu. Znovu prepare().');
      const after={...copy(fresh.match.value),federalCupLink:copy(approved.link)};
      // The ONLY production mutation. If-Match protects the entire target record.
      attempted=true;const response=await request(target,'PUT',after,fresh.match.etag);
      assert(eq(response.value,after),'odpověď zápisu se liší. Neopakovat; verify().');
      return await verifyRead();
    }),
    verify:()=>locked(verifyRead),
    prepareRollback:()=>locked(async()=>{
      undoStage=null;const s=await readAll();assert(eq(s.match.value.federalCupLink,approved.link),'není přesně schválená vazba.');
      assert(await sha(s.match.value)===approved.afterCanonicalSha256,'pozdější změna zápasu: zastaveno, nutné nové posouzení.');
      backup(s,'BEFORE-ROLLBACK');undoStage=s;
      console.log('BEZ ZÁPISU. Návrat odstraní pouze /federalCupLink. Ostatní pole zůstanou shodná.');
      return {matchId:id,operation:'remove',path:'/federalCupLink',productionWrites:0};
    }),
    rollback:options=>locked(async()=>{
      assert(options?.backupSaved===true&&options?.exclusiveMaintenance===true,'nejprve ulož rollback zálohu a zajisti klid administrátorů.');
      assert(undoStage&&!rollbackAttempted&&Date.now()-undoStage.time<300000,'nejprve prepareRollback(), nejvýše 5 minut.');
      const fresh=await readAll();assert(sameReads(undoStage,fresh),'souběžná změna: návrat zastaven bez zápisu.');
      assert(await sha(fresh.match.value)===approved.afterCanonicalSha256,'pozdější změna zápasu. Návrat zastaven.');
      const after=copy(fresh.match.value);delete after.federalCupLink;
      assert(await sha(after)===approved.beforeCanonicalSha256,'návrat by změnil jiná data.');
      rollbackAttempted=true;const response=await request(target,'PUT',after,fresh.match.etag);
      assert(eq(response.value,after),'neočekávaná odpověď návratu. Neopakovat; verify().');
      return await verifyRead();
    })})});
  console.log('fc9Repair připraven v paměti. Instalace: 0 požadavků, 0 zápisů. Obnov běh stránky (F8), pak teprve fc9Repair.prepare().');
})();
