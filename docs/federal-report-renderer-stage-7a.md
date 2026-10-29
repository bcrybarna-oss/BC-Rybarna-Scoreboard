# Federal Cup renderer — etapa7a, v4.51.106 RC

Zadavatel: Dominik. Datum: 29. 10. 2026. Výchozí main po fetchi `2d1de22a1c8577ad7642081bb36fde31e3fd6f91`, produkce105. **Samostatný kandidát, neslučovat a nenasazovat.** [Draft PR45](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/45), implementace `f8ecdf8eb9d943dc3a7a322cf5c3cd1167d7f065`.

## Hranice a důvod rozdělení

Roadmapa rozlišuje7a renderer a7b controller. V tomto PR je hotová pouze7a: přesun11 původních HTML/SVG helperů a jediných prezentačních konstant do produkčního `assets/js/federal-report-renderer.js`. Stavový blok dialogu/exportů zahrnuje jiné odpovědnosti a asynchronní rizika; není přibírán do mechanického přesunu šablon. Další oblast roadmapy nezahájena.

- **FederalStatistics:** dál jediný zdroj výpočtů a reportových modelů. Soubor beze změny. Stejně tak Pushout XLSX writer a jeho výpočty, pět dosavadních modulů, overlay, cloudová cache, herní/turnajová pravidla a Auth kontrakt.
- **FederalReportRenderer:** `create({esc,formatMetric,measureScoreText})` vrací zmrazené `comparison`, `player`, `sources` a prezentační identitu reprezentací. Přijímá hotové názvy, pořadí, skóre, metriky a výsledek hráče. `player` nepřistupuje k celému archivu a nevolá výpočet zápasu ani sezóny. Formátovač je přímo stávající FederalStatistics; měření SVG skóre zůstává callback aplikace se stejným fontem. Žádné síťové čtení/zápis, globální data/match/Auth, DOM, časovače, listenery ani URL.
- **Aplikace:** vybírá správnou identitu zápasu/ročníku/hráče, připravuje stávající výsledky a předává je rendereru. Původní těla šablon odstraněna ve stejném PR, žádný paralelní fallback. Soubory se načítají synchronně Statistics→Renderer→core; při nedostupném rendereru viditelný alert a výslovná chyba.
- **Zachované hranice7b:** CSS, fit jmen, layout, dialog/open/close/fokus/zoom, rasterizace a PNG/PDF download, dočasný DOM, generace, URL lease a delegované obsluhy zůstávají dosavadním controllerem v core. Nejde o druhou implementaci ani tvrzení, že celá etapa7 je dokončena.

Vzhled, texty včetně diagnostiky, pořadí/13 řádků, rozměry, SVG vlajky, branding, názvy souborů a PDF16:9 se nemění. PDF není odstraněno ani optimalizováno. Rozhraní pro chybějící/partial metriky je stejné; prázdné podklady dál připravuje stávající Statistics API, nikoli alternativní renderer.

## Doložená parita

- Pět nových Node testů přímo importuje produkční modul. Nezávislé SHA256 otisky celé HTML/SVG A1/A2/B a vysvětlivek byly vytvořeny z původních funkcí v105, s deterministickým měřením skóre. Zahrnují obrácené pořadí reprezentací, dlouhá jména/escapování, partial14/15→93%, známé0/0, unknown a osobní Team metriky. Otisky nejsou generovány novým rendererem při testu. Zvlášť se ověřují konkrétní očekávané hodnoty a13 řádků, nezměněné vstupy a absence inline těl/fallbacku/I/O.
- Archiv27.10.:40 913 440B,189zápasů/26profilů; beze změny, nikdy neimportován do produkce nebo PR. Match a sezónní/reportové modely před/po hluboce shodné,13vybraných fixture/10osob/40osobních příspěvků/13Pushout modelů. Výpočty osobních Team metrik se nepřesouvají do rendereru.
- Skutečný opravený Doubles9: všech13 A1 metrik, A2 součty, správné páry a žádné připsání Doubles strků jednotlivcům; SK48/94%/2z4 a CZ12/86%/1z4. Desktop/mobil PNG/PDF/XLSX před/po.
- Kontrolní skutečný Singles3: A1/A2/B, SK93%/14 a CZ95%/38, Resafe, vlajky, bez hvězdiček/odstraněných popisků; desktop/mobil/zoom.
- **51 skutečných souborů:**26PNG a8XLSX byteově shodných, tedy i přesná pixelová shoda exportovaných PNG, včetně B nad realistickým archivem.17PDF zachovává16:9 a přesné obrazové podklady výchozích variant. U syntetického A2 se desktopový PDF raster liší ve12 barevných kanálech od původního desktopu, ale přesně odpovídá původnímu mobilnímu PDF; stejný rozdíl existuje už uvnitř v105. Žádná obecná číselná tolerance: comparator vyžaduje přesnou shodu s výchozím desktopovým nebo mobilním obrazem stejného reportu. Datum a ID PDF nejsou vydávány za obrazový rozdíl. Průběžné browser screenshoty `*-preview.png` nejsou exporty a kvůli náběhu obrázků/fokusu nejsou zahrnuty do tvrzení byteové shody; jejich shodu s exportem kontroluje dosavadní samostatný browser test.

## Životnost, chyby a zbývající controller7b

Stejné browser scénáře před/po:20dokončených otevření/zavření,0dočasných exportních hostů po dokončení, zadržené fonty i image.decode→zavření→potlačení downloadu a úklid, decode failure→viditelná chyba→úspěšný retry. Duplicitní PNG/PDF kliknutí během práce mají jediný render. Již zahájené stažení si ponechá URL i po zavření; po simulovaném uplynutí skutečného60s lease0URL. Žádný nový renderer listener/timer/požadavek; renderer nic takového nevytváří. Lifecycle evidence před/po shodná. To není tvrzení, že celý původní controller již má požadované záruky7b.

**Dvě konkrétní zděděné mezery, které7a neopravuje:**

1. Při změně relace bez zavření dialogu může již připravovaný export doběhnout ke stažení (`inheritedSessionDownload:true` v105 i kandidátu). Přímo reprodukováno a zaznamenáno, není vydáváno za PASS ochrany nové relace. Budoucí controller musí vlastnit epochu účtu i otevření a ověřit ji po každém asynchronním kroku. Samostatná cílená funkční oprava s očekáváním žádného stale downloadu musí být odlišena od přesunu.
2. Nativní `dialog.close()` doručuje close událost asynchronně. Příliš rychlý další programový open v témže průchodu může být vyčištěn předchozí close obsluhou. Naměřeno na výchozí105 při benchmarku. Benchmark proto čeká na skutečné dokončení zavření; nezamlčuje závadu.7b potřebuje výslovného vlastníka obsahu/generace a test okamžitého close→open, nikoli pouze pomalých20cyklů. Stejně má převzít a čistit fontové timeouty a resize/observer zdroje.

Tyto body brání označení **celé etapy7** za hotovou; nevznikly přesunem rendereru. V tomto PR nejsou skryté funkční změny controlleru.7b dosud neimplementována, další oblast roadmapy nezačíná.

Oba kontrakty mají nyní samostatný přísný browser test: `federal-report-immediate-reopen-browser.cjs` a `federal-report-session-guard-browser.cjs`. **Oba skutečně FAIL/exit1 na původní105 i kandidátu**, se zachovaným očekáváním13řádků nového reportu a0stale downloadů. Nejde o dvě experimentální Node chyby a nejsou za ně vydávány. Testy nejsou označeny expected-fail ani oslabeny; patří do samostatně spouštěných browser scénářů stejně jako ostatní browserové testy, nikoli automatického Node CI. Jejich neúspěch zůstává viditelný v této dokumentaci/strojové evidenci/PR a musí být napraven v7b. Test session používá skutečný controller s mockovanou identitou a zadrženou rasterizací, nikoli živý Auth.

## Výkon a prostředky

Chrome, stejný40MBarchiv,3otevření B a3PNG+3PDF na variantu, baseline a kandidát měřeny postupně. Model, šablona a export jsou měřeny samostatně nad skutečnými produkčními funkcemi; profiler nově měří reportPlayer ve skutečném renderer modulu, nikoli zaniklé inline kopii.

| Medián ms | v105 | kandidát106 |
| --- | ---: | ---: |
| synchronní open handler |190,1|186,2|
| federalReportData (model) |184,1|179,5|
| reportPlayer (šablona) |1,1|1,2|
| layout preview |1,1|0,7|
| html2canvas |356,8|364,0|
| PNG toBlob |50,4|45,7|
| jsPDF addImage |1875,4|1812,8|

Časy vnořených funkcí se nesčítají. Původní reportPlayer zahrnoval i jeden federalReportResults; nyní je výsledek předán aplikací. Jeho medián je pod rozlišením měření (0ms), nejedná se o slib nulové ceny. Tři vzorky jsou orientační lokální srovnání, nikoli statistický benchmark. Významné zpomalení se neprojevilo; přesun se nevydává za optimalizaci a blokování při PDF/B i limit archivní cache zůstávají samostatné úkoly.

## Regrese, CI a opakování

Produkční Node **266PASS/0FAIL/0SKIP** se soukromými vstupy, veřejně263PASS/0FAIL/3SKIP. Celá lokální sada296testů: **294PASS/2experimentálníFAIL/0SKIP**, exit1. Experiment28PASS/2FAIL na stejných kontraktech řádky50 a155; zdroj preview beze změny proti main. Žádná automatická výjimka/ignorování. [CI40937804764](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40937804764): Release PASS, Production263PASS/0FAIL/3SKIP, Experimental28PASS/2FAIL/0SKIP. Celý workflow FAILURE; dva samostatné browser reproduktory controlleru nejsou tímto CI označené za úspěšné.

Bootstrap14desktop/mobil kombinací včetně404 všech šesti modulů PASS. Turnaje101 včetně plnékvóty/skupin/play-off/reloadu/FC izolace a oba produkční identity/recovery průchody z105 s mockovaným Auth PASS. Živá Auth ani produkční účty/data nepoužity.

Opakování: `node --test tests/federal-report-renderer.test.cjs`; `node scripts/run-tests.cjs production` a `all`; browsery `federal-module-browser`, `federal-report-exports-browser`, `federal-93-presentation-browser`, `federal-linked-ordinary-browser`, `federal-pushout-browser`. `tests/helpers/report-parity-source.cjs <browser-script>` spouští stejné browsery s read-only zdrojem určeným `REPORT_SOURCE_REF=2d1de22` nebo aktuálním kandidátem. Artefakty oddělit do before/after pod výstupem; `node tests/federal-renderer-export-parity.cjs` zkontroluje soubory. Soukromý archive model compare: `RENDER_ARCHIVE` + `node tests/federal-renderer-model-parity.cjs`. Profiler `federal-module-b-profile.cjs`: `FC_B_SOURCE`, `FC_B_BACKUP`, `FC_B_OUT`. Potřebné Playwright/Chrome, lokální připnuté knihovny `PDF_LIB_DIR`, data jen lokálně dle `docs/testing.md`. Soubory se nemění ani nenahrávají do CI.

[Sanitizované výsledky](federal-report-renderer-stage-7a-verification.json); surové logy a exporty jsou lokálně output/stage7a. Žádné soukromé archivy/reporty v PR. Fyzické zařízení/Safari, živý Auth, dlouhodobý běh v reálné síti neověřeny.

## Návrat

Před nasazením prostá reverze tohoto samostatného PR vrátí renderer i jeho bootstrap a inline šablony v jednom kroku. Po případném vydání standardní reverzní PR z aktuálního main s novou verzí a release/regresními kontrolami. Žádné datové formáty se nemění; žádné vracení dat, migrace, import archivu ani změna Firebase. Opravy identity105 a předchozí moduly zůstávají zachované. Neprovádí se žádný merge nebo deploy.
