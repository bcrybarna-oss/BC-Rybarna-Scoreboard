# Etapa 10a — PlayersReadRepository

Zadavatel: Dominik. 5. 11. 2026. Kandidát **v4.51.113 RC**, samostatný PR; nesloučeno a nenasazeno. Implementuje schválený [návrh PR56](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/56), včetně jeho dokumentačního základu. Etapa10b nezahájena.

## Rozsah a vlastnictví

`assets/js/players-read-repository.js` je jediná produkční implementace původního celého `MatchChallenges.createPlayersReader` a collection GET adaptéru. `MatchChallenges` již factory neexportuje. Aplikace vytvoří právě jednu `securePlayersReader`; všichni dosavadní volající používají stejný `loadSecurePlayers`. Žádný fallback. Chybějící modul zastaví bootstrap s viditelnou chybou.

Repozitář vlastní pending Promise, AbortController, identity key, epoch/revision a nested write bariéru. Aplikace výslovně dodává identity (Auth/UID/profil/role/ověření e-mailu), autorizaci, fetch, pozdní URL, čas a publikaci. `data.players`, render, synchronizace relace, challenge actions a disposal zůstávají aplikaci. URL s credential vzniká až po platné autorizaci těsně před GET; zachovány `cache: no-store` a `&t=`. Diagnostika obsahuje pouze requests/writes/epoch/revision.

Původní tělo i export odstraněny ve stejném diffu. Produkční modul neobsahuje storage, DOM, polling, retry ani RTDB mutace. Obecné securePlayerRequest/saveSecurePlayer a D1–D5 se nemění; nezávislé fingerprinty kontrolují jejich shodu s main. Jaroslavovo mobilní ovládání112 i openingBreakAvailable14/UNDO zachováno.

## Zachovaná sémantika, nikoli nové záruky

- Pending je rezervováno před čekáním na autorizaci. Souběh sdílí jednu Promise a jeden GET; starý finalizer nezruší novější pending.
- Scope změna, logout nebo epoch/revision zneplatní starou odpověď, i při ignorovaném AbortSignal a opožděném JSON decode. Token se neukládá do snapshotu.
- Nested bariéry nepustí read před posledním idempotentním release. Release staré identity neodblokuje bariéru nové. Potvrzený výsledek zápisu nepřepíše staré čtení.
- Read čekající pouze na write bariéru ještě nemá vlastní job; po uvolnění volá nový `read()` pod **tehdy aktuální identitou**. To je shodné s baseline, nikoli nově zavedené přenesení dat A do B.
- Zachováno `await response.json() || {}`: null/false/0/prázdný řetězec → `{}`, truthy pole, čísla a řetězce beze změny. Nezavádí se nová JSON validace. Její případné zpřísnění patří do samostatné změny kontraktu.
- HTTP chyby zůstávají PLAYERS_READ_status; chyby decode/sítě se propagují. Žádné automatické opakování. Expirace používá dnešní ensureCloudToken.
- Běžný `pagehide` přes vlastníka challengeReader repository zlikviduje; persisted pagehide při BFCache jej zachová. Browser test vyvolává PageTransitionEvent a reload; neprokazuje rozhodnutí konkrétního prohlížeče o skutečném uložení stránky do BFCache.

## Srovnání zdrojů a dat

Baseline main **22a5bcc00126fd998809ea935d298e7b986524b2** (112), plánovací HEAD před úpravami **ca73ba8c64460e53f96c9192ed702a3940c4e48f**. Tracked zdroje před úpravami čisté; cizí untracked kopie screenshotů/output/tmp ponechány mimo commit. První testy kandidáta běžely nad necommitnutým diffem, nikoli nad vydávaným main; [důkazní manifest](players-read-repository-10a-verification.json) uvádí přesné SHA256 testovaných zdrojů a stav.

Skutečný export z27.10.2026: 40 913 440 B, 26 profilů, čten pouze v izolované paměti. Baseline i kandidát:20 souběžných volání →1 GET,0 repository mutací. Celý vstup i výstup hráčů (včetně neznámých polí) má stejný SHA256 `312f814b68542ec227eb1b8ecb9d4a69a8f378b1f02a53200547744a2886718d`. Export na disku nezměněn; neveze se do PR. Jednotlivé submilisekundové časy nejsou důkaz optimalizace.

## Ověření

- Nových32 Node testů: stejné izolované scénáře nad přesnou historickou factory a skutečným novým modulem, plus nezávislá očekávání. Testovací historická fixture není součást produkčního načítání. Pokryty scope změny při stejném UID, A→B→A, pendingAuth, pre/postdecode, stale finalizer, nested bariéry, chyby a100 sekvenčních/100 souběžných readů bez růstu pending prostředků.
- Celá produkční Node sada lokálně **371 PASS /0 FAIL /0 SKIP**, včetně tří soukromých datových fixtures. GitHub nemá soukromé exporty; očekávané3 SKIP musí být vykázány samostatně.
- Baseline/kandidát × desktop1440×1000/mobil390×844: skutečná aplikace a app-owned instance, login/profil/dashboard/VYZVAT/notifikace, změna účtu/role/profilu/ověření, navigace, pomalý GET, mockovaný refresh tokenu, plné i nedostupné storage, pagehide/persisted/reload PASS.1 GET pro platný souběh i sdílený pomalý navigační souběh,0 RTDB mutací, stabilní počet připojených listenerů; repository nevytváří časovače/listenery. Mock Auth refresh POST evidován odděleně (1 v každém klientu), žádné reálné přihlášení.
- Výzvy9b1/9b2 desktop/mobil, notifikace9a desktop/mobil, bootstrap14 modulů včetně chybějícího PlayersReadRepository, produkční identity/recovery desktop/mobil a všechny mobilní regrese112 PASS.
- První běh starého notifikačního harnessu selhal na prázdných datech mobilu. Testovací adaptér nyní synchronizuje novou identitu challengeReader před ručním seedem; původní očekávání a PNG tolerance zachovány. Následný běh desktop/mobil PASS včetně přesné PNG shody. Žádná produkční oprava notifikací.
- Experimentální sada na přesném baseline i kandidátu **28 PASS /2 FAIL /0 SKIP**: (1) pool-core při dočasně nedostupné identitě neodpojí editovatelný zápas; (2) považuje zbytkové UID bez Auth za vlastnictví. Oba zdroje/asserty nezměněny, experiment není produkčně načítán. Nejde o kosmetické chyby ani výjimku pro nové regrese.
- Historický audit odstraněného žurnálu **0 PASS /2 FAIL**, samostatný audit předchozích action závodů z historického zdroje zachován. Tyto audity nejsou testem současné implementace ani součástí produkčního PASS.

Příkazy: `node scripts/check-release.cjs --base origin/main`; `node scripts/run-tests.cjs production`; `node scripts/run-tests.cjs experimental`; `node tests/players-read-comparison.cjs` (PLAYERS_10A_BACKUP); `node tests/players-read-repository-browser.cjs`; existující browser testy match-challenges, match-challenge-actions, production-recovery-auth, federal-module, mobile112. Playwright/Chrome a soukromé fixtures jsou lokální závislosti; bez nich se tento rozsah nesmí vydávat za zopakovaný v CI.

## Konečný lokální a GitHub stav

Samostatný [PR57](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/57), implementační commit **42f723e389cc589981004724b0cf7f374c42c692**. Po commitu znovu celá produkční sada371/0/0 a tracked strom čistý; Git blob SHA256 indexu/repository/MatchChallenges odpovídají přesně testovanému working diffu v manifestu. Následující dokumentační doplnění tyto zdroje nemění. Při konečném fetchi main nadále22a5bcc/112; PR55 nesloučený. Cizí untracked soubory zůstaly mimo PR.

[GitHub42086589372](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42086589372): release PASS, produkce **368 PASS /0 FAIL /3 SKIP**, experiment **28 PASS /2 FAIL /0 SKIP**. Tři SKIP jsou soukromé relink/undo fixtures, lokálně všechny prošly. Celý kombinovaný workflow je FAILURE kvůli dvěma experimentálním vadám; žádný job se nevypínal. [Mobilní browser CI11242086589221](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42086589221) SUCCESS.

A1/A2/B skutečné PNG/PDF včetně mobilního DPR3 a exportního lifecycle PASS, Pushout Singles/Doubles/Team XLSX desktop/mobil PASS, turnajové založení/oddělené fáze/plná kvóta/draft/reload/FC izolace PASS, stream/OBS izolace PASS.0 reálných Firebase požadavků či zápisů. V exportním harnessu první běh odhalil již chybějící obsloužení assetu OnlinePresence; doplněn pouze mock route pro skutečný modul, původní assertion na nulové JS chyby zachován a finální běh PASS. Úvodní spuštění XLSX bez lokálních env podkladů skončilo před testem; platný konečný běh obsahuje všechny vstupy/knihovny.

## Omezení a návrat (platné i po lokálním PASS)

Živý testovací Auth/RTDB projekt s autorizací a věrnou kopií Rules není dostupný. Mocky ověřují klientský kontrakt, **ne skutečná serverová oprávnění**. Produkční Firebase nebyla použita k testovacím účtům ani zápisům. D1–D5, opravné zápisy jiných loaderů, cache, S1/S2/V1/F1/F2, PDF a neznámé JSON tvary zůstávají samostatné úkoly.

PR55 při posledním fetchi stále otevřený, head4b50f7c; cloud-readiness kontrakt není v aktuálním main a nepřebírá se do10a. Před sloučením znovu fetch, při změně main zachovat jeho testy/kontrakt a upravit kandidátní verzi. Návrat: reverze **celého10a včetně nového scriptu a přepojených volajících/testů**, při vydání nová verze dle AGENTS; žádná migrace ani vracení dat. Nic nesloučeno ani nenasazeno.
