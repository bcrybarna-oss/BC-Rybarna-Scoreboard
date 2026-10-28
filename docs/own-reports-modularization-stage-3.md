# Třetí etapa modularizace – životnost vlastních hlášení

Zadavatel: Dominik. Datum: 28. 10. 2026. Základ main `7b7ff4f096454fa23b89d7c3284f8af355d98c00`, produkce **v4.51.101 RC**. Kandidát **v4.51.102 RC**. Samostatný PR; neslučovat a nenasazovat, bez produkčních zápisů nebo migrací. Původní uživatel opravu turnajů101 dosud nepotvrdil na svém zařízení; tato etapa ji nemění a izolované regrese nejsou jeho ručním potvrzením.

## Mapa zbývajících vlastníků

Aplikace používá Firebase REST, nikoli realtime SDK subscriptions. Listenery níže jsou DOM události/observery. Jedna stránka má dlouhodobý core; změna aktivní obrazovky sama neničí ostatní closure.

| Celek | Vlastník a spouštění | Ukončování / hranice |
|---|---|---|
| Automatické appData, již oddělené | CloudRefresh, relace,2500ms +700ms a visibility/pagehide | stop na ztrátě identity; sdílení requestu a generace z99 zachovány. |
| Počáteční login merge/upload | Core, initialCloudMerge, oprávněný upload,450ms debounce | Transakční read/merge/write a ETag; nepatří do čtecího screen pollu. Beze změny. |
| Secure players/matches/tournaments | Sdílené aplikační loadery, login, visibility, ruční obnova a vstupy | Matches sdílí souběžné čtení stejného UID z97. Ostatní prostředky a callbacky nemají tento nový screen controller. |
| Výsledky/historie/série | showScreen, openResultsSection a explicitní seznamy | Čtení + návazné render/reconcile; bez vlastního nového intervalu. Kompletní navigační izolace těchto handlerů je budoucí samostatný celek. |
| Turnaje a detail | showScreen, otevření detailu a ruční refresh | Uložení/ETag, stav rozehraného zápasu a historické přípravy mají vlastní kontext. Turnajová těla101 se zde nemění. |
| Liga | showScreen → render + Promise.allSettled čtení + render | Vedlejší callback může doběhnout po navigaci; v této etapě nebyl měřen jako závada ani přestavěn. |
| Vlastní hlášení | **Zvolený celek**: vstup reports, refresh tlačítko, refresh po odeslání,5000ms | Nový OwnReports vlastní interval, pagehide a aktuální čtecí/legacy řetězec. Odchod a clear identity ruší platnost i request. |
| Administrátorská hlášení | loadReportsAdmin při vstupu admin a explicitních akcích | Odlišné oprávnění a editace/mazání; bez nového controlleru, nepřimícháno do vlastních hlášení. |
| FC divácký přehled | Jednou při bootstrapu25s interval, vstup a ruční refresh | Provádí práci jen při aktivním FC/viditelnosti; refreshingSpectator a sdílené loadery. Interval existuje celou stránku. |
| Livescore | Core1s interval, viditelná obrazovka/dialog, pozadí nejvýše15s | Sdílený LIVE stav; nelze jej prostě vypnout při každém odchodu z jedné obrazovky. Beze změny. |
| Heartbeat/OBS/backup/shot clock | Aktivní zápas:30s heartbeat,5s retry,80ms stream debounce,420ms backup,1s clock | Vlastníkem je zápas, nikoli aktivní obrazovka. Start/resume/end/pause mají své podmínky; nic se zde nepřesouvá. |
| Challenges/notifikace | Closure stránky,30s +1200ms a DOM obsluhy | Tick kontroluje viditelnost/relaci. Zatím vlastní původní životnost. |
| Presence | Closure stránky,30s tick/5s render/5s start a vstupní/visibility události | GET/PUT/DELETE a vlastní guard; oddělená služba, beze změny. |
| Home | Vstup, bootstrap150ms/1800ms, společné secure-list refresh | Nezávislé sdílené čtení/dashboard; není novým druhým pollerem hlášení. |
| Reportové dialogy a výběry | DOM delegace, resize/observer, konkrétní dialog/export | Uzavření ruší generaci exportu;60s URL revoke úmyslně uklidí stažené objekty i po odchodu. PDF/PNG/XLSX ovládání a závislosti beze změny. |

Nejde o tvrzení, že všechny ostatní asynchronní služby mají nyní vyřešenou životnost. Zvláště počáteční synchronizace a zapisující služby vyžadují vlastní úzce vymezené PR.

## Výběr a hranice

Moje hlášení mají jednu obrazovku, jedno5000ms obnovování, jeden index identity a jedno vykreslení. Jde o menší samostatný celek než livescore/presence nebo počáteční merge s transakčními zápisy. Výběr byl zdůvodněn před úpravami. Nepřesouvá se formulář hlášení ani administrace; zachovány jsou validace, odeslání, statusy, odpověď admina, způsob ukládání a autorizace.

`assets/js/own-reports.js` je jediná produkčně používaná implementace obnovení vlastních hlášení, včetně čtení starého indexu true. Původní tělo loadOwnReports, start/stop intervalů a proměnná ownReportsPollTimer odstraněny z core. Core má tenké adaptéry, existující renderer a transport s původními právy. Modul se načítá synchronně před core; chybějící asset vyvolá viditelnou bootstrap chybu, bez starého fallbacku. CommonJS testy importují tentýž soubor.

API: create → start/stop/refresh/dispose/snapshot. Vlastní právě jeden interval, žádný timeout, jeden pagehide listener pouze při aktivním scope a jednu pending promise/AbortController. Opakovaný start stejné obrazovky/identity nepřidává prostředky. Odchod, odhlášení nebo výměna identity request zneplatní generací; stejný UID po odchodu a návratu je nová generace. Neplatná odpověď nic nevykreslí a nemění stav/info hlášení. Staré finally neodstraní novější pending request.

Perioda i hlavičky HTTP zůstávají stejné. Nepřidává se online nebo visibility listener; návrat spojení vyřeší další tick nebo ruční obnova. Skryté, ale stále aktivní reports mají dosavadní cadence. Clear identity zastaví controller a vyčistí jen dočasný seznam vlastních hlášení a jeho UI; nejde o vymazání uložených hlášení ani změnu cloudové cache. Po platném přihlášení startCloudAutoSync synchronizuje také aktivní reports scope, bez automatického spuštění mimo reports. Renderer zůstává filtrován aktuálním UID.

## Potvrzené opravy chování, oddělené od přesunu

Nad nezměněným v101 HTML a aktuálním izolovaným exportem byly samostatně reprodukovány:

| Scénář | v101 | nový modul |
|---|---:|---:|
| Tři souběžná načtení |3GET indexu|1sdílenýGET|
| Změna renderu po odchodu před doručením odpovědi |1|0|
| Starý výsledek A po novém načtení B |vyprázdní nový seznam B|B zůstane zachovaný|
| Nově zahájený legacy mirror PUT po odchodu během čtení legacy |1|0|
| Interval po odhlášení, reports stále aktivní |1 do dalšího odchodu|0|

Jde o cílené funkční opravy životnosti, nikoli tvrzení, že přesun souboru sám zrychluje aplikaci. Jejich testy jsou oddělené od kontrol shody výsledků a bootstrapu. Sdílený request se rezervuje před await autorizace. Ruční aktualizace připojená k tichému pollu dostane normální zprávu o dokončení, bez druhého GET.

### Staré indexy a oprávnění

Starý index true stále čte reports/{id} a za platné aktivní relace ukládá dosavadní mirror reportIndexByUser/{owner}/{id}; objektové indexy se znovu nečtou. Filtrování vlastníka a řazení od nejnovějšího jsou zachované. Nezavádí se nový sportovní výpočet nebo druhá sada dat.

Pouze tato větev předává volitelný kontext aktuálnosti do existujících reportRequest/writeReportUserMirror a ensureCloudToken. Guard před/po autorizaci a před odesláním brání zahájení dalšího GET/PUT po zániku scope. Kontext používá již autorizovaný token, nikoli další obnovu bez guardu. Běžné odesílání/editace/mazání bez kontextu mají původní cestu. Serverová oprávnění se nemění. Již odeslaný PUT nelze zpětně odvolat ani garantovat jeho serverové zrušení; abort a generace brání jeho pozdní odpovědi ovlivnit UI nebo novou relaci. Neprovádí se rollback dat.

## Ověření

Soukromý export z27.10.:40 913 440B,189zápasů,26profilů, SHA25649908fbcd66113315e524e6e61a4fc3a889654bb0e9420d309b843d4181a4d5d. Použit pouze v paměti browserových mocků, soubor se nemění a není v PR. Export neobsahuje index serverových hlášení; reportové případy jsou syntetické, archiv poskytuje realistické zatížení ostatních obrazovek.

- Jedenáct cílených unit přímo nad produkčním modulem: interval ID0, idempotence/dispose, single-flight před autorizací, foreground/silent souběh, výsledky objektových i legacy indexů, filtrace/řazení, pozdní body a legacy odpověď, A/B i stejný UID po návratu, staré finally, síťová chyba/retry,neautorizováno a legacy dílčí chyba, pagehide/BFCache, skutečné core adaptéry po opožděné autorizaci.
- Browser before/after:20opakovaných vstupů/odchodů, šest A/B přihlášení a skutečná logout funkce, zadržené odpovědi, legacy valid/stale, simulovaný výpadek a návrat přes pravidelný tick. Všechna síť zachycena, legacy PUT pouze do mocku. Na obou verzích20vzorků bez růstu DOM:3364→3364 /3365→3365, rozdíl1 je nový script. Při reports1interval; po odchodu0 na obou. Nový listener1 během/0po. Po logoutu původní interval1, nový0. Index GET v celém stejném scénáři68→36; současná platná obnova3→1. Absolutní maximum nového mocku2 zahrnuje uměle zadržovaný již zrušený A transport při novém B; nejde o duplicitní platný scope.0pageerrors.
- Bootstrap všech tří modulů a404 každého zvlášť na desktopu/mobilu PASS; žádný fallback.
- Turnajové regrese101 nad aktuálním exportem PASS: běžný i historický turnaj, SKO desktop/DKO mobil, skutečné zápasy8-ball3 a10-ball7, ruční nasazení, plná kvóta a její výslovné upozornění, reload, cloud mock a nezměněný FC. Kompletní historická sada včetně ETag/403/korekcí/bodování PASS. Původní uživatel tím nepotvrdil funkčnost na svém zařízení.
- Evidence browser: skutečný dialogový mock Auth, reload/resume/undo/uložení a Team/Doubles PASS. Živá produkční Auth není testovaná.
- Otisky osmi produkčních oblastí potvrzují nezměněná těla formuláře/generování/fází turnajů101, runtime revizi/cache97 a celé moduly CloudRefresh/FederalStatistics/Pushout. Kanonické LF otisky respektují pracovní CRLF na Windows; Git diff těchto assetů je prázdný.

Delší sekvenční porovnání před/po:12cyklů/60přechodů,12cloudovýchobnov,4otevření A1/A2/B a15s klidu nad týmž exportem. Oba běhy0JS/interakčních chyb. Intervaly6před/7během relace/6po; listenery po naplnění1129→1129 při cyklech7a12 a1127po odhlášení, na obou verzích. DOM9169→9170 je jediný nový script; konečný GC heap57 641 136→57 648 804B. Stejná4zpracování nových cloudových revizí,28výpočtů zápasu/2ročníku. GET/appData31→31, GET/matches23→19 (časování), u obou maximálně1souběžný GET každé z těchto cest. Celkové maximum přes různé cesty5→6 není duplicitní čtení stejné cesty.

CPU TaskDuration53,94→52,36s, FC medián794→845ms, statistiky1004→1022ms; jeden B open/close2206→2332ms, nejdelší blokující úloha2709→2929ms. Jedno porovnání na verzi je orientační, nikoli důkaz zrychlení nebo záruka absence všech pomalých scénářů. Významný nový systematický náklad nebyl zachycen; blokování B i celé statistiky zůstávají známým omezením. Místní kvóta71→67chyb stále očekávaná, archiv se nevejde; nevydáváme to za opravu cache. Dva pokusy presence o zápis v každém soak běhu byly zachyceny/odmítnuty mockem, produkce žádný zápis nedostala.

Plná Node sada se soukromými vstupy **261 PASS /2známé FAIL /0SKIP ze263**. Jedenáct nových unit a26cílených celkem PASS. A1/A2/B skutečné PNG (a nezměněné původní PDF regrese), zoom/desktop/mobil a Pushout2listové XLSX Singles/Doubles/Team PASS, včetně kontrolního Singles3 SK93 %/14 protiCZ95 %/38. Bootstrap404 včetně nového assetu a všechny dříve uvedené browserové sady PASS. Release gate PASS. Finální GitHub CI bude uvedeno v PR; CI není předem označené za zelené.

[Strojová evidence](own-reports-modularization-stage-3-verification.json). Lokální artefakty output/modularization-102; soukromý archiv se necommituje.

## Omezení a návrat

Dvě dlouhodobá selhání se nemění: preview-match-reload-recovery:50 je rozpor kontraktu čekání na identitu (náhled nechá pointer místo odpojení bez smazání kopie); :106 je zastaralý regex samostatného volání, jehož výsledek je nyní přiřazen pro turnajový fallback. Nejde souhrnně o kosmetické chyby, nic se nevypíná. Starý test-modular, PDF, cache, turnajové chování a oprávnění zůstávají mimo rozsah.

Známé blokování reportu B a nedostatečná místní cache celého archivu trvají. Ostatní loadery zatím nemají tuto novou screen epochu. Živý produkční Auth/OBS a fyzický mobil nejsou ověřeny. Návrat reverzí celého PR podle release pravidel, bez změn dat nebo migrace; vrátí se i doložené staré závady vlastních hlášení. PR se v této etapě neslučuje ani nenasazuje.
