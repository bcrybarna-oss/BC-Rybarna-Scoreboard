# Federal Cup – první produkční etapa modularizace

Zadavatel: Dominik. Datum: 26. 10. 2026. Kandidát **v4.51.98 RC**, základ main `a4604c3456b7bc0eef512296f2615262970fdc34`, produkce97. **Neslučovat a nenasazovat.**

## Změna a hranice závislostí

`assets/js/federal-statistics.js` je jediným produkčním zdrojem 24 čistých funkcí: původního FC výpočetního bloku a helperu federalRackScoresAgree. Algoritmická těla jsou přenesena bez úprav. Inline těla v index.html byla odstraněna. Modul dostává zápasy a konfiguraci parametry; nečte aplikační data/match, DOM, úložiště, síť ani časovače. Obsahuje výpočty zápasu/sezóny, historickou rekonstrukci, coverage/reasons/components, výběr fixture, reportové podklady a Pushout datový model. Výsledky A1/A2/B používají původních13metrik, Pushout devět svých řádků ze stejného17metrikového API.

Klasický script s verzovanou URL se načítá synchronně před hlavním core. Bootstrap explicitně váže jména z window.FederalStatistics; není zde stará záložní implementace. Při chybě načtení vznikne viditelné upozornění a FEDERAL_STATISTICS_MODULE_UNAVAILABLE, nikoliv nulové statistiky. Browser i Node používají stejný soubor s uzavřenou factory a zmrazeným exportním objektem. Lokální vazby v core zachovávají existující volající; současná měřicí instrumentace je může obalit bez změny produkčního zdroje.

Ponecháno v index.html: šablony, SVG, CSS, dialog/focus/zoom, měření textů, html2canvas/jsPDF a exportní controller. PushoutXlsx zůstává existujícím writerem, nikoliv novým kalkulátorem. Overlay mění pouze číslo vydání. Starý test-modular, Firebase, autorizace, cloudová cache a datové formáty se nemění.

Výkonové invariance97: runtime revize po quota chybě bez nepravdivého trvalého timestampu; jedna probíhající matches žádost ve stejné identitě a odmítnutí staré relace; levný výběr fixture bez přepočtu přehledu, A1jenjeden zápas, A2/Bjedna sezóna. Přesun není vydáván za optimalizaci. jsPDF ani komprese obrázků nejsou upraveny.

## Testy používají skutečný produkční soubor

Výpočetní, integrity, tag, report, Pushout, ordinary-Doubles a výkonové testy importují modul; zachovávají nezávislé číselné reference a všechny původní aserce. Offline diagnose-federal-evidence používá stejné API, včetně původního allowlistu diagnostiky. Produkční zdroj už se pro běžné testy neskládá z regexových výřezů HTML.

Historické porovnání je explicitní testovací nástroj `federal-module-parity.cjs` + helper load(ref): načte zvolený předchozí git objekt. Není dostupný aplikaci a neobsahuje trvale zkopírovanou druhou implementaci. Výkonové testy obalují interní volání v paměťové kopii modulu; díky tomu nepřestanou počítat vnořené kalkulace po přechodu z inline closure.

Browserové mocky obsluhují nový produkční script. Současně obsluhují existující Pushout writer: streamový mock dříve vracel pro jeho URL HTML a vytvářel Unexpected token '<'. Stejná boot chyba byla doložena na původním97 i kandidátovi98. Opravena pouze obsluha assetu v testu; streamové aserce, skórování a produkční stream zůstaly beze změny. Starší report-ui test navíc očekával pouze jediné tlačítko v dokončeném zápase a nezohledňoval již schválený Pushout export. Původní selhání :29 doloženo také na97; aktualizace zachovává právě jeden A1 a zvlášť vyžaduje jediný Pushout se stejným matchId/fixture. U neodehraného zápasu dál vyžaduje nulu tlačítek; ostatní kontroly nezměněny. Celý aktualizovaný UI test prošel na97 i98.

## Porovnání skutečných dat

Čtyři nedotčené soukromé exporty: 23.10.(1),24.10.(1),24.10.(2),25.10. Celkem715výskytů zápasů v historických zálohách (nejde o715unikátních zápasů). Nejnovější export má40 385 164bajtů,184zápasů,26hráčů. Vstupy nejsou součástí PR.

Před/po PASS: výstupy každého zápasu, kompletní sezóna, reportData včetně individuálních Team příspěvků, výběru/pořadí, partial/unknown/reasons/components a Pushout modelů. Pro31dostupných dokončených propojených záznamů se shodují také bajty XLSX vytvořených stávajícím writerem. Výsledky osobních Team statistik jsou porovnány i tam, kde musí zůstat neúplné; žádné převádění týmových součtů na hráče.

- Kontrolní Singles3: Slovensko14koulí/93 %, Česko38/95 %, zachována interní partial diagnostika.
- Opravený skutečný Doubles9: SK48koulí/94 %/vlastní break2/4/prohry2; CZ12/86 %/1/4/prohry3. Předopravná záloha bez vazby se nevydává za FC zápas. Rekonstrukce osmi racků ani osobní/párové identity se nezměnily.
- JSON vstupy i soubory mají po výpočtech shodný obsah/hash. Žádná migrace, zápis, náhradní zápas nebo konzolový opravný skript.

## Funkční ověření

Lokální kompletní Node sada s oběma soukromými proměnnými: **232 PASS / 2 známé FAIL / 0 SKIP ze234**. Nové testy ověřují jediný import, odstranění všech inline těl, pořadí scriptů, shodu browser/CommonJS, zákaz vedlejších závislostí a neměnnost hluboce zmrazeného vstupu. Pět regresí výkonu97 zůstává zachováno.

Browserové kontroly jsou proti aktuálnímu index.html a skutečnému assetu, s blokovanou produkční sítí:

- Bootstrap desktop/mobil, jediná žádost modulu a explicitní chyba při jeho404.
- federal-report-exports: A1/A2/B, Singles/Doubles/Team, PNG1920×1080,PDF16:9, desktop/mobilDPR3, stejné PNG mezi viewporty, dlouhá jména/skóre, partial, chyba knihovny, duplicate/cancel, neměnná data a0JS chyb.
- federal-linked-ordinary: skutečný#9, všech13metrik, A2/páry, reálné desktop/mobilPNG/PDF/XLSX.
- federal-93-presentation: skutečné Singles3, A1/A2/B, správná procenta/počty, vlajky, Resafe, zoom a skutečné exporty.
- federal-pushout: skutečné stažení dvoulistého XLSX, devět metrik, Singles/Doubles/Team, mobil/desktop, scope tlačítka a duplicate/error.
- federal-evidence: rozstřel/quickfinish/undo/Team/Doubles, mockAuth, reload/resume, PUT/GET serializace a neznámá data;0pageerrors.

Lokální browserové testy nejsou tvrzením o nasazení či přihlášení do produkce.

## Výkon před/po

[Strojová evidence](federal-modularization-stage-1-verification.json) obsahuje SHA256 všech24nezměněných těl, vstupů a agregované výsledky. Každý dlouhý běh měl60přechodů,4otevření reportů včetně B,12řízených obnov, aktivní periodické úlohy a30sidle. První předběžný běh se částečně překryl s dokončením streamového testu, proto byl zvlášť doplněn další třícyklový pár bez souběžných browserových testů. Dlouhý scénář slouží také pro strukturální porovnání, nikoli jen jediné časové číslo.

| Kontrola dlouhého běhu | Před97 | Po98 |
|---|---:|---:|
| Chyby JS / interakcí |0 /0|0 /0|
| Zachované zápasy / hráči |184 /26|184 /26|
| Heap poGC na konci |57,96 MB|57,98 MB|
| DOM / listenery |8836 /1110|8837 /1110|
| Intervaly cloud zapnutý / vypnutý |7 /6|7 /6|
| Maximální souběh GET/matches |1|1|
| Aplikace čtyř nových revizí |4|4|
| Výpočty zápasů / sezóny |28 /2|28 /2|
| Nejdelší longtask |3176 ms|3393 ms|

Jeden DOM prvek navíc je script modulu. Celkové GET/matches24vs25 a quota chyby72vs73 závisejí na délce a okamžiku periodických obnov, nikoliv na souběžném duplicitním stažení. Stejná revize se znovu neaplikovala, plná cache zůstala reálně simulovaná. Samostatné jednotkové regrese ověřují i retry, další revizi, reload a změnu identity.

Medián FC přehledu dlouhého běhu938→852 ms, doplňkového čistého třícyklového páru1182→895 ms. Domů73→63 ms a statistiky1188→1177 ms v doplňkovém páru. Tyto rozdíly neoznačujeme za optimalizaci: algoritmy jsou stejné a načasování GC/obnov i výkon zařízení kolísají.

### B: výpočet není render ani PDF

Dvě série v pořadí před→po a po→před, dohromady šest vzorků každé verze nad stejným skutečným184zápasovým exportem. V těchto samostatných profilech jsou periodické intervaly zastavené; nejde o soak měření. Vnořené intervaly nejsou aditivní.

| Medián | Před97 | Po98 |
|---|---:|---:|
| federalReportData |589 ms|435 ms|
| HTML šablona reportPlayer |3,35 ms|3,00 ms|
| Synchronní otevření celkem |608 ms|449 ms|
| Otevření včetně obrázků a dvou snímků |669 ms|617 ms|
| PNG celkem |1296 ms|1353 ms|
| PNG html2canvas |1135 ms|1200 ms|
| PNG toBlob |172 ms|142 ms|
| PDF celkem |7269 ms|6767 ms|
| PDF html2canvas |985 ms|1056 ms|
| PDF addImage |6067 ms|5585 ms|

PNG medián je asi o57 ms/4,4 % vyšší, rozsahy se výrazně překrývají (před1175–1954 ms, po991–1854 ms). Nebyla zachycena systematická nová zátěž nebo významné celkové zpomalení; toto není statistická záruka pro všechny telefony. Časy nejsou důkazem zrychlení díky modularizaci. Šest výsledných B PNG před/po je byteově identických; skutečné PDF exporty vznikly v obou verzích a jejich rozměry ověřuje exportní sada. Dominantní práce PDF dál zůstává v addImage. Původní jednorázové blokování B ani kapacita archivu se touto extrakcí neřeší.

Opakované stream-controls a stream-isolation PASS: jednoduché/rozšířené počítadlo, volitelný stream, všechny režimy, mobil/rotace/320px, reload/resume, dvě UID, stejný účet/jiný zápas,21svýpadek, stará URL a podmíněné412. Podrobný counter, nominace/reload/rename a dvouklientové FC konflikty7/7 rovněž PASS. Celkem13různých funkčních browserových sad bez nových selhání; všechny síťové operace zachyceny mockem.

## PR a ověřené GitHub CI

Implementační commit `e98cca11a35ed03f33ee2f6b2c39ec2058582b90` je v [draft PR #36](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/36), větev `refactor/federal-statistics-module`. [CI40394034617](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40394034617): **Release version and revision PASS**, Node **229 PASS / 2 FAIL / 3 SKIP ze234**. Tři soukromé testy bez lokálních exportů jsou přeskočeny; lokálně s nimi232 PASS/2 FAIL/0 SKIP. Z logu ověřeny pouze známé preview chyby na :50 a :106, žádná nová Node regrese.

Porovnáno s [CI aktuálního main40380876396](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40380876396), commit `a4604c3456b7bc0eef512296f2615262970fdc34`:227 PASS/2 stejné FAIL/3 SKIP ze232, release PASS. Dotčený starý core i jeho recovery test zůstaly byteově nezměněné proti main. Následující čistě dokumentační pokračování zaznamenává ověření; aplikační a testovací kód je stejný jako na implementačním commitu. **Nesloučeno a nenasazeno.**

## Dvě známé chyby zůstávají rozlišené

1. preview-match-reload-recovery:50 – skutečný rozpor kontraktu náhledu. Test chce při čekání na identitu odpojit aktivní match pointer bez smazání uložené kopie. Preview naopak v POOL_TEST_MODE vrací false před odpojením. Je nutné samostatné rozhodnutí a ověření vlastnictví/editací; nelze jen změnit očekávání.
2. :106 – zastaralá kontrola textového tvaru. Obnova je v obou přihlašovacích cestách nadále volaná, ale její návratová hodnota je uložena do const matchRestored kvůli následnému fallbacku turnaje. Regex očekává samostatné volání. Neprokazuje chybějící obnovu, nicméně test není odstraněn ani oslaben.

Testují starší test-modular/assets/js/pool-core.js, který produkce nenačítá. Ani tento soubor, ani jejich test nebyly změněny. CI není plně zelené; oddělení sad nebo dokončení náhledu není součástí tohoto PR.

## Opakování a možnost návratu

`node --test tests/*.test.cjs` a `node scripts/check-release.cjs --base origin/main`.

Pro soukromé testy nastav FC_FIXTURE9_BACKUP na původní24.10.(1) a FC_RELINK_BACKUP na24.10.(2). Pro před/po nastav FC_MODULE_BASE_REF na výše uvedený main a spusť `node tests/federal-module-parity.cjs`; FC_MODULE_BACKUPS může být JSON pole lokálních cest. Browserové exporty používají PDF_LIB_DIR s připnutými knihovnami1.4.1/2.5.2 a FC_REAL_BACKUP/FC_RELINK_BACKUP; žádné cloudové přihlášení.

Profil B: tests/federal-module-b-profile.cjs, FC_B_SOURCE/FC_B_BACKUP/FC_B_OUT; měří zvlášť výpočet, template/layout, rasterizaci a download. Dlouhý běh: tests/app-performance-browser.cjs, PERF_SOURCE/PERF_BACKUP/PERF_OUT, PERF_LIGHT=1,PERF_ALL_REPORTS=1,PERF_CYCLES=12,PERF_IDLE_MS=30000. Produkční časovače běží v soak scénáři; v izolovaném B profilu jsou zastavené.

Rollback je reverze celého PR včetně HTML napojení, assetu a testů podle tehdejšího release postupu. Žádné vracení databáze nebo uložených zápasů. Nespouštět současně starý a nový kalkulátor přes přepínač. Před případným vydáním znovu fetch/release gate/CI, ověřit verzi assetu a publikaci HTML+assetu. Žádný merge ani deployment není touto etapou proveden.

Zůstává limit40MBarchivu v localStorage, jednotlivé dlouhé úlohy B a PDF, neověřená fyzická zařízení/iPhone/OBS a produkčníAuth. Výsledky lokálního mocku se za jejich ověření nevydávají.
