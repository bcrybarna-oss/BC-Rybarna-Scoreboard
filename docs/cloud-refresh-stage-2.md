# Životnost cloudových obnov – první celek druhé etapy

Zadavatel: Dominik. Datum: 27. 10. 2026. Základ main `484d2661fa1c51ce9cd8f9a4834cc62e34339532`, nasazená verze98. Kandidát **v4.51.99 RC**, samostatné PR, **neslučovat a nenasazovat**. Produkční data se nemění.

## Mapa dosavadních vlastníků ve verzi98

Aplikace používá REST požadavky, nikoliv Firebase SDK realtime subscriptions. „Listener“ níže označuje DOM událost nebo MutationObserver. Navigace zpravidla mění aktivní class, nevytváří znovu celou aplikaci.

| Prostředek / funkce | Vlastník, spuštění | Ukončení / navigace / přihlášení |
|---|---|---|
| `/appData` automatický poll 2500 ms, úvodní timeout700 ms | Přihlášená relace; start při sign-in, refresh tokenu, initialCloudMerge a ověření e-mailu | Před99 další start ruší interval, ale nikoliv předchozí700ms timeout. Logout ruší interval; obecné clearRuntimeCloudIdentity ani offline tlačítko jej samy nerušily. Navigace jej správně ponechává. |
| Hlavní visibilitychange | Jednorázová registrace core při načtení stránky | Při návratu a cloudAuthenticated vyvolá poll a paralelní čtení matches/tournaments. Posluchač patří aplikaci; není registrován při každém vstupu na obrazovku. |
| `loadSecureMatches` / `secureMatchesLoad` | Sdílené právě probíhající čtení na UID; výsledky, FC, liga, live, domů a další volající | Po úspěchu/chybě se promise uvolní; odpověď jiného UID se odmítá. Opustit obrazovku neznamená zrušit sdílené čtení pro jiné volající. Zůstává původní implementace97. |
| `initialCloudMerge`, uploadCloudData,450ms debounce | Inicializace přihlášení a explicitní synchronizace; upload pouze system admin | Odlišné read/merge/write transakce s ETag a oprávněními. Nejde o druhý automatický poll. V této etapě jejich životnost není přestavěna. |
| Vlastní hlášení –5000ms poll | Obrazovka reports, showScreen spouští load/start | Odchod přes showScreen nebo tick mimo obrazovku ruší interval. Rozpracované loadOwnReports zatím nemá obecnou epochu obrazovky; samostatný navazující kandidát, ne součást tohoto PR. |
| FC divácká obnova –25000ms interval | Jednou v closure FC při bootstrapu | Běží po dobu stránky, ale provádí práci jen při aktivním FC a viditelném dokumentu; refreshingSpectator brání překryvu celé obsluhy. Odchod interval nemaže ani nepřidává. Používá stejný poll a sdílený loader matches. |
| Live přehled –1000ms interval | Jednou v core, liveRefreshTimer guard | Cloudová data na pozadí nejvýše po15s; aktivní live/modal častěji. Navigace pouze mění podmínku a render, nikoliv registraci. |
| Livescore heartbeat –30000ms | Rozehraný zápas, start/resume ruší předchozí heartbeat a hned publikuje | Konec zápasu / explicitní stop. Nesmí se rušit jen kvůli odchodu z obrazovky skóre. |
| OBS retry –5000ms, streamSendTimer80ms | Zápas se streamEnabled, retry interval jednou v core | Retry kontroluje match a streamEnabled; debounce nahrazuje předchozí timeout. URL/UID+matchId, režimy i oprávnění zachovány. |
| Záloha aktivního zápasu –420ms debounce | Zápas/autosave | Nahrazení předchozího timeoutu; dokončení má vlastní úklid. Zápis používá dosavadní oprávnění a bezpečnostní kontroly. |
| Shot clock –1000ms | Samotný rozehraný zápas/useClock | startTimer/stopTimer, pauza, pravidla Team a dokončení. Není totožný s vlastnictvím obrazovky. |
| Challenge/notifikace –30000ms + úvodní1200ms | Jednou v closure; DOM delegace a konkrétní tlačítka | Tick hlídá viditelnost a cloudAuthenticated; bez odregistrování při každé navigaci. Další nezávislý celek. |
| Presence –30000ms tick,5000ms render, úvodní5000ms | Samostatná closure celé stránky; pointerdown/keydown/touchstart/click/change/visibility | Bez relace jen vykresluje nedostupnost. Má vlastní writing guard a PUT/DELETE/GET; tato fáze nic z toho nemění. |
| Reportový dialog | Jedna delegace FC click, resize a observer aktivní class | Zavření/odchod ruší platnost exportní generace; resize přepočítá layout jen otevřeného dialogu. Nevzniká nový interval při otevření A1/A2/B. PNG, PDF a XLSX beze změny. |
| Player picker a ostatní lokální DOM obsluhy | Bootstrap a render příslušného DOM | Překreslením se nahrazují lokální uzly/obsluhy. Observer stavu disabled je navázaný na select. Pravidelná nová inicializace celého starého test-modular se v produkci nespouští. |

Bez aktivního zápasu a obrazovky vlastních hlášení je základ šest dlouhodobých intervalů: OBS retry, live přehled, challenges, FC, presence tick a presence render. Automatický cloud přidává sedmý. Další intervaly závisí na skutečném zápasu/shot clock/reports. Nelze hromadně rušit všechny prostředky při navigaci nebo odhlášení bez rozlišení jejich vlastníka.

## Zvolená hranice

Tento PR vyjímá pouze **automatické čtení `/appData` přihlášené relace** do produkčního `assets/js/cloud-refresh.js`. Je to malý celek s jasným stop bodem, nezapisuje do Firebase a nevyžaduje přestavbu zápasu/streamu, počítadla ani grafických reportů. InitialCloudMerge a upload mají odlišné write/ETag záruky a nelze je bezpečně přimíchat do stejného malého PR.

Nový modul vlastní interval2500 ms, jediný úvodní700ms timeout, visibilitychange pro svůj poll, pagehide a právě probíhající automatický request. Secure-list část původního visibility handleru zůstává jednou v core; odstraněno z něj pouze volání původního pollu. Jsou to dvě odlišné úlohy, nikoliv souběžná stará a nová obsluha téhož čtení.

Core předává aktuální identitu, dosavadní autorizaci, URL, fetch, viditelnost, busy podmínku, lokální revizi a synchronní apply/status callbacky. Datové merge/cache funkce i serverová pravidla zůstávají v core. `pollCloudData` a startCloudAutoSync jsou pouze integrační adaptéry; původní tělo pollingové smyčky, cloudPollTimer a cloudPollInProgress byly odstraněny. Oba produkční moduly se načítají synchronně před core, při chybě nového assetu je explicitní chyba bez fallbacku.

API: start, stop, refresh, dispose, snapshot. Opakovaný start stejného vlastníka je idempotentní. Stop ruší interval, timeout, oba vlastněné listenery a abortuje request; dispose zakazuje další spuštění. Nepersistovaný pagehide provede dispose, BFCache varianta zůstává obnovitelná. Navigace nevytváří nový controller ani nerestartuje relaci. Snapshot neobsahuje UID, token nebo osobní data.

## Potvrzené chyby a účel změn chování

Na nezměněném98 byly cíleně reprodukovány:

- Tři starty vytvoří jeden interval, ale tři čekající úvodní timeouty.
- Tři souběžná ruční volání před dokončením autorizace provedou tři stejné GET. Původní in-progress flag se rezervuje až za await.
- Rozpracovaná odpověď `/appData` se po odhlášení stále aplikuje.
- Obnovení tokenu vyvolané automatickým pollingem může po odhlášení doběhnout a znovu nastavit cloudAuthenticated/start.

Nový modul rezervuje jednu promise před autorizací a kontroluje generaci relace/identitu před i po čekání a dekódování. Stop funguje i proti odpovědi, jejíž transport ignoruje AbortSignal. Staré finally nesmí smazat nový pending request. Při obnově tokenu dostává ensureCloudToken/firebaseRefreshAuth volitelný kontext pouze tohoto requestu: signal a current. Zastaralá odpověď ani chyba nezapisuje credentials a nesmaže novější identitu. Výchozí přihlašovací flow a ověřování oprávnění zůstávají stejné.

Jde o cílené opravy životnosti, nikoliv pouhý přesun souborů. Na běžné platné relaci zůstává interval, práh cloudové revize500 ms, způsob datového merge i renderů stejný. Síťová chyba automatického čtení uvolní flight a další tick obnovu zopakuje. Dosavadní pravidlo odhlášení při neúspěšném obnovení tokenu se nemění; ochrana pouze brání použití odpovědi už zrušeného requestu. Nepřidává se nový online listener; návrat spojení dál obsluhuje příští pravidelný tick nebo návrat viditelnosti.

Platná opožděná odpověď po odchodu z FC se má nadále aplikovat do sdílených dat celé relace. Nesmí však uživatele navigovat zpět. Zastaralá odpověď po odhlášení nebo změně vlastníka se použít nesmí. To jsou dva různé očekávané výsledky.

## Zachované ochrany a výslovně nezměněný rozsah

`writeLocalWithoutCloudSync`/cloudRuntimeDataTs dál chrání před opakovanou aplikací stejné revize při plné cache; na disk se neuloží timestamp bez dat. Reload musí znovu získat data. `loadSecureMatches` a jeho pending promise na UID zůstávají jediným zdrojem tohoto čtení, včetně retry a ochrany před jiným UID. Cloudová cache, výpočetní modul98 a writer Pushout se nepřepisují.

PDF ovládání, html2canvas/jsPDF závislosti a exportní kód zůstávají beze změny. PNG je prioritní formát a XLSX se zachovává. Neřeší se komprese, výkon PDF, odstranění PDF, datové migrace ani starý test-modular.

Ostatní asynchronní služby (players/tournaments, vlastní hlášení, počáteční login merge, presence a další) zatím nemají jednotnou životnost tohoto modulu. Toto PR je nevydává za vyřešené ani neslibuje globálně jediný GET/appData včetně explicitních inicializačních transakcí. Další etapou může být jejich samostatné vlastnictví a stale-response ochrana; nyní se neimplementuje.

## Ověření a opakování

Cílené unit testy používají skutečný produkční modul, fake clock/EventTarget a i transport ignorující abort. Zahrnují identituA/B, stejný UID po odhlášení, token renewal, síťovou chybu/retry, hidden/busy,700ms timeout, idempotenci, dispose/BFCache a staré finally. Stávající quota/sdílené matches testy97 zůstávají se stejnými očekávanými hodnotami.

`tests/cloud-refresh-browser.cjs` porovnává skutečný produkční HTML kód před/po nad exportem25.10.2026:40 385 164bajtů,184zápasů,26hráčů. Jen2500ms a700ms plánovače mají ovladatelný čas; ostatní background timery jsou zde zastavené kvůli přiřazení requestů. Samostatný dlouhý test zachovává skutečné timery a všechny původní background služby. Všechny HTTP operace zachyceny, žádná produkční síť nebo zápis.

Reprodukce: CLOUD_SOURCE=lokální původní index98,CLOUD_BASELINE=1,CLOUD_OUT=... a `node tests/cloud-refresh-browser.cjs`; pro kandidáta bez prvních dvou proměnných. Unit: `node --test tests/cloud-refresh.test.cjs tests/app-performance.test.cjs`. Dlouhý běh: tests/app-performance-browser.cjs s PERF_SOURCE/PERF_BACKUP/PERF_OUT,PERF_LIGHT=1,PERF_ALL_REPORTS=1,PERF_CYCLES=12,PERF_IDLE_MS=30000. Knihovny exportů jsou připnuté v PDF_LIB_DIR, privátní JSON se do repozitáře nepřidává.

### Naměřené výsledky před/po

[Strojová evidence](cloud-refresh-stage-2-verification.json) obsahuje oddělené cílené a reálné dlouhé scénáře, původní SHA256 vstupu a otisky nezměněných funkcí. Vstupní export se nezměnil.

| Cílený scénář nad skutečným HTML | Před98 | Po99 |
|---|---:|---:|
| Intervaly po3startech |1|1|
| Čekající700ms timeouty po3startech |3|1|
| Stejné GET při3souběžných obnovách |3|1|
| Aplikace opožděné odpovědi po odhlášení |1|0|
| Pozdní token znovu aktivuje relaci |ano|ne|
| Souběžné GET/matches pro3volající |1|1|

Šest cyklů výměny testovací identity A/B (hook simuluje úspěšně ověřenou relaci) a skutečné logoutFromApp prochází; nový vlastník má1interval/1timeout/2vlastněné listenery, po stop0/0/0. Dialogové přihlášení s mockovaným Firebase je navíc ověřeno existující federal-evidence-browser sadou. Unit testy ověřují i stejný UID po odhlášení, body decoding, neabortující transport a to, že staré finally nevymaže nový flight. Síťový výpadek a návrat v browseru probíhají přes obsluhu plánovaného intervalu, nikoliv pouze přes ruční refresh. Platná odpověď po opuštění FC se aplikuje jednou a zachová aktivní home obrazovku.

| Skutečné dlouhodobé prostředky,60přechodů +30sidle | Před98 | Po99 |
|---|---:|---:|
| Aktivní intervaly cloud / po ukončení |7 /6|7 /6|
| Listenery po naplnění obrazovek / po ukončení |1110 /1110|1112 /1110|
| Heap poGC na konci |57,94 MB|57,96 MB|
| DOM po naplnění |8837|8838|
| Nové revize / jejich aplikace |4 /4|4 /4|
| GET/appData |31|31|
| Nejvyšší souběh GET/appData / GET/matches |1 /1|1 /1|
| Výpočty zápasů / sezóny |28 /2|28 /2|
| Reálné chyby kvóty localStorage |63|61|
| JS / interakční chyby |0 /0|0 /0|
| Nejdelší longtask |1437 ms|1465 ms|
| Medián FC přehledu |590,5 ms|599 ms|

Jeden DOM prvek navíc je script, dva listenery navíc během přihlášení jsou výslovně vlastněné visibilitychange a pagehide. Po odhlášení zmizí; není to trvalý nebo navigací rostoucí leak. V obou bězích zůstalo184zápasů/26hráčů. Celkové GET/matches15vs13 a kvótové výjimky se liší podle souběhu/načasování obnov, nikoliv jinou cache nebo migrací. Tři automatické mockované presence zápisy byly v obou bězích zachyceny a zablokovány; žádný se nedostal na skutečný server. V cíleném lifecycle scénáři nebyl ani pokus o DB zápis.

Medián await cloud-poll162,5→807 ms **není stejné měření zátěže CPU**: původní volání během jiného pollu vracelo okamžitě, nové sdílí jeho promise a korektně čeká na síť/dekódování. Manuální refresh tak nezobrazuje „dokončeno“ před dokončením sdílené práce. Počet GET i skutečných aplikací zůstal stejný, longtask/FC mediány jsou srovnatelné. Výsledek není vydáván za optimalizaci ani za záruku pro konkrétní telefon.

### Funkční regrese

Lokálně Node **242 PASS / 2 známé FAIL / 0 SKIP ze244** se soukromými vstupy;15/15 cílených unit testů modulu a výkonových invariant97 PASS. Přímé porovnání potvrzuje nezměněná těla původní cache, loaderu matches, oprávnění/uploadu a render/exportních funkcí, stejně jako oba produkční soubory federal-statistics.js a pushout-xlsx.js.

Browserové sady PASS: bootstrap obou modulů včetně404/bezfallbacku desktop/mobil, skutečné mockované přihlášení/reload/resume/undo/Team/Doubles a ukládání, kontrolní Singles3 a propojený #9, A1/A2/B PNG, numerické dvoulisté Pushout XLSX, dialog/focus/Escape/mobil, streamové režimy/reload a dvouklientová UID+matchId izolace. Existující reportové testy dál standardně ověřují i PDF; jejich kód ani očekávání nebyly kvůli prioritě PNG oslabeny. PDF se neoptimalizovalo ani neodstraňovalo.

Kontrolní Singles3 zůstává93 %/14 proti95 %/38; Doubles9 SK48/94 %/ownbreak2/4/lose2,CZ12/86 %/1/4/lose3. Jde o izolované kopie skutečných dat, nikoliv živou přihlášenou produkční relaci.

Implementace `e25246818cbcc13283397863de3bae8fa6b63b90` je v [draft PR #37](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/37), větev refactor/cloud-refresh-lifecycle. [GitHub CI40569555577](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40569555577): **Release version and revision PASS**, Node **239 PASS / 2 FAIL / 3 SKIP ze244**. Tři soukromé vstupy v CI nejsou; lokálně s nimi242 PASS/2 FAIL/0 SKIP. Logy porovnány s aktuálním main484d266 ([CI40397173141](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40397173141):229 PASS/2 stejné FAIL/3 SKIP ze234). Test i preview core jsou vůči main nezměněné; žádná nová Node regrese.

Dvě známá selhání preview obnovy zůstávají odlišená: :50 je skutečný rozpor kontraktu odpojení při čekání na identitu, :106 zastaralý regex volání obnovy. Nejde o souhrnně kosmetické chyby a nic z jejich kódu se v této fázi nemění. CI není plně zelené. Následné dokumentační pokračování zaznamenává tento výsledek, aplikační a testovací kód zůstává stejný. **Nesloučeno a nenasazeno.**

## Rizika a návrat

Neověřují se produkční data/Auth, skutečné OBS, fyzický telefon ani několikahodinový provoz. Známé jednotlivé úlohy reportu B, PDF a kapacita archivu v localStorage trvají. Řešena pouze životnost vybraných automatických čtení; jiné legacy requesty mohou potřebovat další samostatné ochrany.

Návrat reverzí celého PR podle release pravidel vrátí předchozí inline poll a integrační Auth signatury. Žádná změna uloženého formátu ani migrace dat se nedělá, rollback databáze není potřeba. Je nutné vědět, že návrat zároveň vrátí doložené vady98. Nevytvářet přepínač dvou implementací a netlumit release gate nebo testy. PR zatím neslučovat ani nenasazovat.
