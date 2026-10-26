# Diagnostika zpomalování aplikace – v4.51.97 RC

Zadavatel: Dominik. Datum: 26. 10. 2026. Základ: origin/main442b706c841d852e5ba1e7eb82378d7f07aca6bc, produkce96. **Kandidát97, neslučovat a nenasazovat.** Výběr hráčů ani plošná modularizace nejsou předmětem změny.

## Data, metoda a rozsah důkazu

Nejnovější dostupný skutečný export `BC_Rybarna_Scoreboard_Backup_2026-10-25.json`:40 385 164bajtů,184zápasů,26hráčů,4turnaje,1série; matches zabírají přibližně38,6milionu znaků. Původní soubor se nemění a není součástí repozitáře. SHA256 je ve strojové evidenci.

Chrome headless na desktopovém viewportu1440×1000, izolovaný profil a pouze místní HTTP origin. Všechny cloudové requesty jsou zachyceny: GET odpovídá úplným exportním datům přes mock s150mszpožděním; jakýkoli pokus o PUT/DELETE/POST je zablokován. Žádné produkční přihlášení, request nebo zápis. LokálníStorage má skutečnou browserovou kvótu, takže40MBdatabáze vyvolává QuotaExceededError. Zde se prokázal rozhodující mechanismus.

Finální před/po srovnání používá stejnou lehkou instrumentaci (časování aplikačních funkcí, PerformanceObserver longtask, CDPprofil a po vynucenémGC heap/DOM/listenery). Tři stejné průchody: home→results→history→stats→FederalCup, otevření/zavřeníA1, řízené cloudové obnovy a skutečné periodické background úlohy. 150ms je zadané čekání mocku; přenos40MB přes DevTools i dekódování mají další náklady. Synchronous funkční časy a longtasky oddělují práci hlavního vlákna od síťového čekání. Časy jsou měření tohoto přístroje, nikoli záruka pro telefon.

První orientační pilot měl nákladnou globální JSON instrumentaci a neúplný players mock; není použit pro tabulku před/po. Mock i instrumentace byly opraveny. V samostatném delším původním běhu s kompletními profily navíc kliknutí na report skončilo timeoutem120s: průběžné překreslení opakovaně odpojovalo cílové tlačítko. Finální srovnávací běhy dokončily stejný scénář bez timeoutu.

## Potvrzené příčiny a cílené opravy

### 1. Stejná cloudová revize se při zaplněné místní cache přebírala opakovaně

writeLocalWithoutCloudSync zapisovalo celou databázi a následně cloudový timestamp v jediném try. Při40MBdata první setItem selhal a timestamp se vůbec neposunul. pollCloudData každých2,5s stále vidělo novější remote.updatedAt, znovu vytvářelo bezpečnostní kopii, klonovalo a slučovalo celou databázi a překreslovalo i skryté obrazovky. Nešlo o množící se intervaly, ale opakovanou drahou práci stejného intervalu.

Oprava eviduje již aplikovanou revizi také v paměti aktuální stránky. Pokud se databáze nevejde na disk, trvalý timestamp se nedoplní: po reloadu se cloud znovu načte a nevydává se zastaralá cache za aktuální. Žádná změna formátu dat, žádná ztráta ochrany před staršími revizemi. Cílený test na původním kódu selže3aplikace místo1; na opravě projde. Novější revize se dál aplikuje, síťové chyby se mohou opakovat, persistovaná databáze/timestamp zůstávají spárované.

### 2. Přehled a report A1 zbytečně počítaly celou statistickou sezónu

renderFederalCupViewer spouštělo federalReportData (dvě kompletní sezónní kalkulace) a další federalCalculateSeason jen kvůli identitám a dostupnosti tlačítek. Tentýž přehled se kreslil při navigaci, obnovách cloudu i z editoru. A1 počítalo celou sezónu a následně znovu jediný požadovaný zápas.

Stávající výběr nejnovějších fixture a pravidla série jsou nyní sdílený levný čtecí krok bez výpočtu strků. Přehled nepotřebuje žádné statistické kalkulace; A1 počítá pouze svůj zápas. A2/B stále používají stejné společné API a metriky, ale sezónu jen jednou při otevření reportu. Nedoplňuje se druhá sportovní logika, cache ani její invalidace. Celý federalReportData nad skutečným exportem je před/po deep-equal, včetně partial/reasons, duplicit, rozhodnutí série a osobních atribucí. Samostatná kontrola bez browserové JSON instrumentace ukázala5,594s→3,046s pro samotné kompletní reportData.

### 3. Souběžně se načítala stejná40MBvětev zápasů

Results, spectator a další obsluhy mohly současně zavolat loadSecureMatches. V měření se překrývaly dva identické GET/matches, každý s parsingem, serializací cache a obnovou dashboardu. Pro právě běžící čtení stejné relace se nyní sdílí jedna promise; po úspěchu i chybě se uvolní. Nová relace nepřebírá odpověď předchozího uživatele. Žádné dlouhodobé cache nebo potlačení dalšího nového načtení. Překryv malých tournaments požadavků také pozorován, ale nebyl potvrzen jako dominantní a tato větev zůstává beze změny.

## Před/po – stejný třícyklový scénář

| Měření | Před | Po |
|---|---:|---:|
| Home, poslední průchod |3263ms|60ms|
| Results, nejdelší průchod |7351ms|41ms|
| FC přehled, medián |4840ms|830ms|
| A1 otevřít/zavřít,1vzorek |10055ms|932ms|
| Cloud poll, medián včetně čekání |14145ms|988ms|
| Nejdelší longtask |7925ms|2670ms|
| Součet longtasků |102651ms|13729ms|
| Kompletní FC výpočty zápasů |651|1|
| Celé překreslení po cloudové revizi |7|1|
| GET/matches |12|5|
| Nejvyšší souběh GET/matches |2|1|
| Heap po závěrečnémGC |57,8MB|57,4MB přibližně|

Počet requestů a součet longtasků závisí také na tom, jak dlouho scénář trvá: před opravou dlouhá blokování dovolovala periodickým úlohám generovat další práci. Proto se vedle nich uvádějí stejné operace, skutečné synchrónní časy a strukturální regrese.

## Paměť, listenery, časovače a modularizace

V obou srovnávacích bězích184zápasů a26hráčů zůstalo zachováno. DOM po prvním naplnění obrazovek narostl očekávaně2966→8836elementů a poté se ustálil; stejně listenery456→1110. Neprokázán neomezený růst. Počet intervalů je6mimo cloud,7při jeho aktivaci, po vypnutí opět6; startCloudAutoSync starý interval ruší. GC heap před opravou přechodně112MB, po opravě průběžně kolem57MB. To podporuje tlak dočasných kopií, nikoli prokázaný trvalý leak.

Produkce používá původní inline implementaci a3externí exportní knihovny/assets (pushout-xlsx,html2canvas,jsPDF). Nenačítá test-modular/assets/js/*.js. test-modular je samostatná starší větev75 s mock-cloud.js a pool-core.js; není inicializována současně s produkčním core. Stejně pojmenované renderStats v oddělených closure mají odlišný účel a nejde o dvojí registraci stejné globální funkce. Dashboard/navigace/picker se registrují při načtení, DOM innerHTML nahrazuje lokální listenery; měření nenalezlo postupné množení globálních listenerů nebo DOM observerů. Firebase zde používá REST polling, nikoli SDKrealtime listenery/SSE.

Pro opravu není potřeba žádnou část modularizace dokončovat. Úzké oddělení levného výběru fixture od kalkulace uvnitř stávajícího index.html odstraňuje naměřenou zbytečnou práci bez přesunu obsluh mezi starým/novým core. Plošná modularizace ani test-modular se nemění. Výběr hráčů nebyl přestavěn; jeho zavírání může souviset s překreslením při této smyčce, ale samotný picker nyní nebyl cílem opravy.

## Delší běh a funkční regrese

Po opravě navíc12cyklů/60přechodů,4otevření/zavření reportů (A1,A2,B,A1),12ručních obnov +aktivní periodické úlohy a30sidle.184zápasů/26hráčů zachováno;0pageerrors a0interactionfailures. Heap poGC57,03MB po prvním cyklu,57,80MB uprostřed,57,97MB na konci a57,98MB po idle. DOM8836/listenery1110 se ustálily; intervaly7běhemcloudu/6po vypnutí. ReportB v tomto delším běhu trval6,09s a vytvořil nejdelší longtask5,116s; toto zbývající jednorázové blokování není zaměněno s odstraněnou opakovací smyčkou. Automatické obnovy aplikovaly4skutečněnovérevize, ne znovu stejný stav.

Aktuální federal-93-presentation-browser PASS: skutečný kontrolní Singles3, A1/A2/B, desktop/mobil/zoom/Escape a12skutečných PNG/PDFdownloadů,93 %/14 proti95 %/38, přesnéSVGvlajky, bezhvězdiček/popisků aResafe. federal-linked-ordinary-browser PASS: skutečný #9, všech13metrik, A2/páry, desktop/mobil PNG/PDF/XLSX a0Firebase/0zápisů/0JSchyb. Celý federal-evidence-browser PASS: scoring/known&unknownbreak/quickfinish/undo/Team/Doubles/mockAuth/reload/resume/PUT/GET. Výsledky metrik a reportů zůstávají zachovány.

Zastaralý federal-report-exports-browser samostatně selhává na očekávání již schváleně odstraněného popisku „Statistiky vycházejí z dostupné evidence zápasů“. Ověřeno stejné selhání také proti nezměněnému původnímu HTML96. Test není kvůli výkonovémuPR upravován ani vypínán; současný schválený vzhled a skutečné exporty pokrývá výše uvedená aktuální sada. Toto selhání se uvádí odděleně od nových regresí i od dvou známých Nodechyb.

## Ověření a zbývající omezení

Nové cílené regrese:levný výběr bez kalkulace,1výpočet na zdroj při reportu, duplicity/clinch/manual/partial, zaplněná cache +reload/novější revize/síťová chyba, sdílení čtení+retry+změna identity. Původní quota test prokazatelně selže, opravený5/5PASS. Celá Node sada230/232 pouze známé preview-match-reload-recovery:50/:106, žádná nová regrese; CI není plně zelené.

Stále existuje měřitelná jednotlivá úloha2,67s ve srovnávacím běhu a5,116s při reportuB v delším běhu, zejména běžné statistiky/velké cloudové změny; oprava neznamená nulové blokování všech operací.40MBcelá databáze se nadále nevejde do localStorage, nelze tvrdit úplnou offline perzistenci. Přesun velkého archivu doIndexedDB nebo samostatné workerové výpočty by byly další návrh, nikoli součást tohoto cíleného zásahu. Bez měření je nepřidávat. Síť byla simulovaná, nikoli skutečné mobilní připojení; několik hodin běhu a fyzický iPhone nebyly ověřeny. Další vhodný krok je dobrovolný lokální performance trace na konkrétním postiženém telefonu (bez exportu auth/dat), pokud se potíže po případném schváleném vydání vrátí.

[Strojové měření před/po](performance-v4.51.97-measurements.json). Syrové CPUprofily a privátní exporty zůstávají pouze lokálně voutput/performance; doPR nejdou. Nic není sloučeno ani nasazeno.


## Git a finální CI

Otestovaná aplikace pushnuta jako `b020dd339fe387db8f9ff924335abb66b016820d` do [draft PR #35](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/35). [CI40376836361](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40376836361): Release version and revision **success**, Node **227PASS/2FAIL/3SKIP ze232**. Log obou chyb potvrzuje jen známé preview-match-reload-recovery.test.cjs:50/:106. Tři soukromé exportní testy přeskočeny bez místních souborů, lokálně230PASS/2FAIL/0SKIP. Žádná nová Node regrese. Zastaralý samostatný browserový test popsaný výše zůstává transparentně oddělen. Následný dokumentační commit nemění otestované HTML. **Nesloučeno a nenasazeno.**


## Schválená aktualizace exportní regrese před nasazením97

Dne26.10.2026 zadavatel schválil vydání a aktualizaci zastaralého exportního testu. Test nyní ověřuje absenci obou odstraněných informačních textů. Při pokračování se ukázala další zastaralá kontrola inline SVGpath pro vlajky; stejná chyba potvrzena na aktuálním main96. Smysl kontroly vlajek zachován a zpřesněn: externí flatSVG, správný počet a900×600. Ostatní kontroly testu nezměněny. Celá sada nyní PASS včetně skutečných PNG/PDF A1/A2/B desktop/mobil, DPR3byteovéparity, Singles/Doubles/Team, wide skóre/longnames/partial a library-error/duplicate/cancel.0Firebase/0zápisů/0pageerrors. Starší zmínka o jeho selhání výše je historie před schválenou aktualizací. Aplikačníkód ani číslo kandidáta se tím nemění. Výsledek nasazení bude zaznamenán samostatně.
