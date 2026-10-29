# Pátá etapa – vlastník administrátorského seznamu hlášení

Zadavatel: Dominik. Základ main `899ee10000efaa3235021b90212283e3d280fa28`, produkce v4.51.103 RC. Etapa **v4.51.104 RC** byla následně schválena, PR43 sloučen a nasazen; [skutečné nasazení a rozsah ověření](deployment-v4.51.104.md). Níže je zachovaná historie přípravy, původní zákaz sloučení/nasazení byl nahrazen schválením. Žádné změny produkčních dat.

## Proč tento celek

Předchozí mapa rozlišovala vlastní a administrátorská hlášení kvůli odlišným oprávněním a mutacím. Po oddělení vlastní čtecí větve nyní oddělujeme vlastníka admin seznamu: čtení kolekce, řazení, dočasné řádky, vykreslení a obsluhy řádků. Nejde pouze o přesun snadné funkce: všechny zdroje životnosti konkrétního citlivého seznamu nyní patří jednomu controlleru, core již nemá renderovací tělo ani stav čtecího procesu. Nevzniká obecný framework nebo další druhá implementace.

Liga by znamenala současné rozplétání více sdílených loaderů; livescore sdílí zápas i dialog; presence a challenges zahrnují zápisy a dlouhodobé notifikace. Zde lze izolovat autorizované kolekční čtení bez zásahu do jejich workflow. Mutace administrátorských hlášení zůstávají aplikační transakce, ne čtecí úloha obrazovky.

## Vlastnictví a závislosti

`assets/js/admin-reports.js`: jediná produkční implementace seznamu. Core výslovně předává container, pageTarget, esc, reportTypeLabel, identity (pouze přihlášený ověřený system admin), screenActive, authorize, fetch, URL, mutační callbacks a error. Povinný synchronně načítaný asset před core; bootstrap chyba při404, žádný fallback. Původní loadReportsAdmin a renderReportsAdmin těla odstraněna, loadReportsAdmin je jen delegát.

Controller vlastní rows, scope/generaci/UID, pending Promise a AbortController, dva delegované DOM listenery a pagehide. Žádný interval ani timeout. Idempotentní start, stop/dispose odstraní listenery, abortuje nezdílený kolekční GET, zneplatní výsledek a vyčistí dočasná hlášení i DOM. Opakované refresh sdílí Promise již před await autorizace. Guard před/po tokenu, odpovědi a json; staré finally nevymaže nový pending. Platnost závisí i na aktuálních oprávněních. pagehide persisted ponechá BFCache, skutečný pagehide dispose. Výpadek je stále zobrazen stejnou chybou a opakování zůstává ruční, nepřidává se polling.

Core synchronizuje start/stop s showScreen, clearRuntimeCloudIdentity a startCloudAutoSync. Stav kolekce nemá žádný nový zápis do localStorage/Firebase. Kolekční GET není transport sdílený appData/matches, proto jej lze bezpečně abortovat. Sdílené loadery/revision/cache jsou beze změny.

Renderer zachovává HTML, ID, popisky, pořadí stavů, datum, obsah a CSS. Inline change a per-row click obsluhy jsou nahrazené dvěma obsluhami na stabilním kontejneru; status/select a tlačítka vyvolávají původní mutační funkce. Serverová oprávnění ani datové formáty se nemění. Neoprávněná obrazovka zůstává s textem Pouze pro systémového administrátora, bez GET.

## Funkční změny oddělené od přesunu

- Původní tři souběžná načtení prováděla tři GET. Nový controller sdílí jedinou úlohu.
- Původní odpověď mohla vykreslit admin seznam po odchodu nebo přepsat novou relaciB starou odpovědíA. Stop/abort/generace tomu brání; citlivý seznam po odchodu a logoutu není ponechán v DOM. Po návratu se stejně jako dříve znovu načte ze serveru.
- Integrace úklidu vyžaduje zachytit text odpovědi před GET v saveReportAdminNote. Jinak by vyčištěná textarea mohla vést k prázdnému zápisu. Jediná změna této mutace je čtení textu při zahájení uložení, nikoli až po čekání; statusy, payload, mirror, oprávnění a zápisový postup zachované. Samostatný unit test skutečného core i browser test zadrženíGET→odchod→PUT zachovávají text. Nejde o plošnou úpravu mutací.

Již zahájené mutace se tímto PR nepřevádějí pod screen lifecycle a jejich PUT/DELETE se neabortuje. Nelze zpětně odvolat odeslaný zápis; další oddělení mutačních transakcí by vyžadovalo vlastní návrh. Toto PR nevydává ochranu kolekčního čtení za kompletní audit starých mutací.

## Mapa po této etapě

Produkčně FederalStatistics (výpočty/modely), CloudRefresh (appData relace), OwnReports (hráčská obrazovka), FederalViewer (FC divák), nově AdminReports (admin seznam). V core zůstávají počáteční merge/upload, secure players/matches/tournaments, výsledky/historie/série, liga, turnajové workflow, livescore, heartbeat/OBS/shotclock, challenges/notifikace, presence a home. Mutační reportové workflow také v core. Žádné společné nové periodické smyčky a žádné dokončování test-modular.

## Ověření a výsledky

Výsledky: [strojová evidence](admin-reports-stage-5-verification.json). Reprodukční browser test tests/admin-reports-browser.cjs používá aktuální HTML a skutečný produkční modul, při baseline ADMIN_BASELINE=1 a ADMIN_SOURCE=output/modularization-104/before.html (git show výchozího main). Osm přímýchunit testů modulu a skutečné core poznámky PASS. Test poznámky nad původním core samostatně selže (prázdný text), nad novým projde; browser zadržíGET, opustí obrazovku a ověří přesnýPUT pouze v mocku.

- Admin před/po:3souběžná čtení→1GET. Původní pozdní odpověď po odchodu i staréA po novémB přepsala seznam; nová ani jednou.20cyklů, nový scope3listenery během (2container+pagehide),0po odchodu/logoutu,0intervalů. Původní renderer měl2click handlery na každý řádek a inlinechange; jejich skrytý DOM zůstal zachovaný. Nový model rows0 po stop. DOM stabilní3456→3456 před a3440→3440 po (po odchodu odstraněné řádky), medián4416→4408ms. Bez JS chyb, původní export nezměněn. Seznam řazený stejně; status/poznámka/mazání zachovávají payload/mirror, po20cyklech každá akce právě jednou. Neadmin0kolekčníchGET, chyba sítě a ruční retry PASS; mobilní screenshot skutečného seznamu uložen lokálně.
- Dlouhý obecný scénář mimo admin:12cyklů/60přechodů,12cloudobnov,4otevřeníA1/A2/B a15s klidu. Oba běhy0JS/interakčníchchyb; loaded5intervalů, během7,po5u obou. Listenery v cyklech7/12 stabilně1130/1130,po1127u obou. Konečný GC heap58 739 436→58 741 912B. Čtyři nové cloudovérevize→4aplikace u obou, max1GETmatches iappData, GETmatches23→22 aappData35→33(časování).4/3pokusy o zápis zachyceny a odmítnuty mockem, produkce0. Stejný počet DOM9171 ve finále: novýscript+1 a vyčištěný výchozí placeholder−1.
- CPU TaskDuration95,08→63,96s, maxlongtask5016→4339ms. Jediný orientační běh/verzi a proměnlivá zátěž hostitele; rozdíl není vydáván za optimalizaci. Admin se v obecnémsoaku neotevírá, jeho měření je předchozí cílený scénář. B a blokující úlohy/cache limity přetrvávají.
- Bootstrap5modulů a404 každého desktop/mobil PASS. FederalViewer, OwnReports a CloudRefresh plné browserovéživotnostiPASS. Viewer gate zpřesněna pouze pro účetA, aby sama nezadržela novouBodpověď; ostatní kontroly zachované. Turnaje101/plnáquota/běžný i historický/skupiny8-ball3/play-off10-ball7/reload/FC PASS. Původní uživatel tím stále nepotvrdil turnaje na svém zařízení.
- A1/A2/B skutečné PNG1920×1080, desktop/mobil/zoom; Singles3SK93%14/CZ95%38 a Pushout2listovýXLSX Singles/Doubles/Team PASS. Původní PDF regrese prošla, PDF se nemění.
- PlnáNode sada275PASS/2známéFAIL/0SKIP z277. Bez soukromých vstupů očekávaných272PASS/2FAIL/3SKIP, skutečné CI bude uvedeno v PR. Obě chyby jednotlivě stejné na výchozím main899ee10/CI40759980782(264/2/3z269), přímý baseline7PASS/2FAIL z9; test ani experimentální core nezměněny. ReleasegatePASS.

 Soukromý export27.10. (40 913 440B,189zápasů) je jen realistický kontext v RAM; serverová hlášení jsou syntetická, tento export je neobsahuje. Originální soubor beze změny, není v PR. Auth/Firebase výhradně mockované.

## Dvě známá selhání

1. preview-match-reload-recovery.test.cjs:50 očekává odpojení pointeru uloženého zápasu při dočasně nedostupné identitě; experimentální core jej ponechá. Jde o skutečný nesoulad recovery kontraktu, nikoli kosmetiku.
2. :106 statický regex očekává samostatné volání obnovy; core výsledek přiřazuje pro tournament fallback. Jde o nesoulad statického testu s tokem kódu, jiný problém než první případ.

Baseline test i experimentální core zůstávají proti výchozímu main beze změny. CI není plně zelené a nové chyby se nepovažují automaticky za známé.

## Návrat a omezení

Reverze celého PR včetně modulu, HTML napojení a core note capture podle release pravidel, bez obnovy databáze nebo migrace. Chybějící modul není řešen starým fallbackem. PDF/knihovny, cache a výpočty/exportní modely beze změny. Živá produkční Auth/Firebase/admin hlášení/fyzická zařízení nebyla testována. Zůstávají limity blokováníB a velikosti archivní cache a nepotvrzená turnajová oprava101 na zařízení původního uživatele.


[Draft PR43](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/43), implementace deb9bc51a48f1a7ddbc09fe569cf55094aca7356. [CI40764363648](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40764363648): release PASS, Node272PASS/2známéFAIL/3soukroméSKIP z277. Obě chyby jednotlivě shodné s aktuálním main899ee10/CI40759980782, nová regrese nezjištěna. CI není plně zelené. Dokumentační pokračování aplikaci nemění; neslučovat/nenasazovat.
