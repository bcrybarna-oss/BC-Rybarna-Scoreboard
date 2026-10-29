# Etapa8a — kandidát v4.51.107 RC

Dominik,29.10.2026: společný LivescoreReader vlastní čtecí single-flight, background poll a view/dialog epochy. Publikace/heartbeat/OBS beze změny. Produkce106, nesloučeno/nenasazeno.6unit+actualbrowser/OBS/identity/turnaje/exporty PASS, Node275/0/0 lokálně, experiment28/2/0. [Hranice, úklidové zápisy a důkazy](docs/livescore-reader-stage-8a.md).

# Etapa7a — renderer, kandidát v4.51.106 RC

**Nasazeno106 (Dominik,29.10.2026):** PR46→PR45 integracee2e5bc6, společný merge do main2b8edcf835748e7526e38e127ad20c791c260937; Pages40945274924success, žádné samostatné vydání7a. Release/prodCI266/0/3PASS, experiment28/2/0FAIL, celekFAILURE bez ignorování. Veřejná106/22souborůSHA256/7modulů/desktop-mobil/navigace/0JSerrors. Publikovanýkód izolovaně: A1/A2/B immediateclose-open, role/session invalidace, skutečnéPNG/PDF/XLSX a úklid PASS; živýAuth/Rules neověřen. Produkčnídata beze změny. [Deploymentreport a návrat](docs/deployment-v4.51.106.md). Další etapa nezahájena. Následující příprava106 je zachovaná historie, zákazy sloučení byly nahrazeny schváleným společným vydáním.


Etapa7b (Dominik,29.10.2026): navazující controller na PR45, společný nevydaný106. Samostatný PR do větve7a; nejprve integrace7b→7a a až po schválení společné vydání do main. Oba reproduktory PASS, ztráta role PASS,23výstupů shodných, Node269/0/0 lokálně, experiment28/2/0; žádné ignorování. [Rozsah, verze, důkazy a návrat](docs/federal-report-controller-stage-7b.md). Nesloučeno/nenasazeno, produkce105/data beze změny.

Dominik,29.10.2026: etapa7 rozdělena dle roadmapy. FederalReportRenderer tvoří HTML/SVG z předaných výsledků/metrik, pouze escapování, stávající formátovač FederalStatistics a callback měření textu. Žádný přístup k datovému globálu, DOM, síti, persistence nebo životnímu cyklu. Core vybírá podklady a volá jedinou šablonu; stará těla odstraněna. CSS, texty, assety, výpočty a exporty neměněny. Dialog/exportní generace, asynchronní úklid a relace jsou výslovně zbývající etapa7b, nikoli druhý paralelní controller. Kandidát106 není nasazen. Produkce105 a data zůstávají beze změny; další oblast roadmapy nezahájena.

# Etapa6 — nasazeno v4.51.105 RC

Dominik,29.10.2026: PR44 sloučen merge2d64a13fb5a07e785820e20dfab974b62d72e71a, Pages40928461240success. Produkční guardy zachovávají disk při pendingAuth a vyžadují Auth pro účetní zápasy; explicitní POKRAČOVAT a ownerless offline režim zachovány. Produkční/experimentální sady jsou oddělené, obě zůstávají vCI i npm test. Release/produkcePASS, dvě experimentální vady nadále viditelněFAIL; experimentální core se vprodukci nenačítá. Veřejná aplikace ověřena, funkční identity/recovery/exporty zvlášť na publikovaném kódu s mockovanými endpointy. Živý Auth test nebyl dostupný a omezení bylo schváleno. Žádná migrace/datový zásah/etapa7. [Nasazení a návrat](docs/deployment-v4.51.105.md). Níže zachovaný historický kontext přípravy105.

# Historie: plán a etapa6 — kandidát v4.51.105 RC

Dominik,29.10.2026: autoritativní [roadmapa6–14](docs/modularization-roadmap.md), včetně samostatné hranice přihlášení/oprávnění, nahrazuje starší plánové návrhy jako aktivní plán; historické doklady níže se zachovávají. [Testové sady](docs/testing.md) nyní rozlišují skutečnou produkci a samostatný starý experiment, přičemž npm test stále zahrnuje vše a selhání se neignorují. [Etapa6](docs/stage-6-test-contracts.md) odděleně opravuje produkční pending identity guard, zachovává pět modulů a skutečné sportovní chování. Produkce104, kandidát105 nesloučen/nenasazen, etapa7 nezahájena. PDF, cache a výkonB jsou samostatné úkoly, ne implicitní součást přesunů.

# Pátá etapa modularizace – nasazeno v4.51.104 RC

Dominik,28.10.2026: AdminReports vlastní pouze admin seznam hlášení: on-demand GET, řazení, rows a DOM,2delegované obsluhy a pagehide. Core předává identitu/oprávnění, transport, renderer helpers a mutační callbacks výslovně. Původní load/render těla odstraněna bez fallbacku. Odchod/logout čistí seznam a abortuje nezdílené čtení; generace chrání novou relaci. Původní mutační workflow zachováno s jedinou integrační pojistkou: text odpovědi zachytit před GET, aby přežil úklid DOM. Žádné nové funkce/cache/PDF/plošnýtest-modular. Po schválení PR43 nasazeno29.10.2026 merge87f898375970cfa3c1a243af5edaf4463c94c36e, Pages40913700775success. Veřejná anonymní produkce a načtení5modulů ověřeny; admin a předchozí scénáře/exporty zvlášť izolovaně na publikovaném HTML+modulech, nikoli živá produkčníAuth/Firebase. Žádná změna produkčníchdat/migrace; další etapa nezahájena. Nasazení, omezení a návrat:docs/deployment-v4.51.104.md. Hranice, důkazy a návrat: docs/admin-reports-modularization-stage-5.md.

# Čtvrtá etapa modularizace – nasazeno v4.51.103 RC

Dominik,28.10.2026: FederalViewer vlastní pouze čtecí orchestrace diváckého přehledu FC (25s interval, pagehide, pending Promise, generace obrazovky/identity). Výslovné závislosti a tenké core adaptéry; původní tělo a trvalý interval odstraněny bez fallbacku. Odchod/logout zneplatní screen-owned dokončení, neabortuje transport sdílený jinými obrazovkami. Původní CloudRefresh/FederalStatistics/OwnReports/Pushout, turnaje101, cache, datové formáty a PDF zůstávají beze změny. Uživatel potvrdil pouze otevření prázdných Mých hlášení v přihlášené102, nikoli práci s existujícími hlášeními. Po schválení PR42 nasazeno28.10.2026 merge4b66ae068fa86b61b1b4e37c14f25bc3f304c3fc, Pages40759055156success. Veřejná anonymní produkce desktop/mobil/4moduly/FC/navigace ověřena; soukromé scénáře, opožděné odpovědi a exporty odděleně izolovaně na publikovaném HTML+modulech, nikoli živá Auth/Firebase relace. Bez změn dat/migrací. Nasazení, omezení a návrat:docs/deployment-v4.51.103.md. Další etapa nezahájena. Rozsah, oddělené funkční opravy, měření a návrat: docs/federal-viewer-modularization-stage-4.md.

# Třetí etapa modularizace – v4.51.102 RC

Dominik,28.10.2026: pouze vlastní hlášení obrazovky reports mají nový produkční OwnReports controller. Vlastní5000ms interval, pagehide listener a jednu pending promise/abort/generaci; core předává identitu, aktivní obrazovku, autorizaci, transport a původní renderer. Originální loop/load těla odstraněna. Stop na odchodu nebo clear identity, volitelný guarded kontext pro původní legacy read/mirror zápis; ostatní report/admin/transakční cesty beze změny. Společná cache97 a moduly98/99, turnaje101, PDF/PNG/Pushout a test-modular se nepřestavují. Uživatel opravu turnajů na svém zařízení dosud nepotvrdil. Nasazeno28.10.2026 merge95da0953a8e67107df3f045b8a63caffa31211a5 / PR41, Pages40749738579success. Veřejné načtení/ovládání a navigace ověřeny, soukromé Auth/Firebase/scénáře pouze izolovaně na publikovaném HTML+modulech. Produkční data nezměněna; další etapa nezahájena. Nasazení, omezení a návrat viz docs/deployment-v4.51.102.md. Viz docs/own-reports-modularization-stage-3.md. Níže zachovaný předchozí kontext.

# Priorita: oprava zakládání turnajů – v4.51.101 RC

Dominik, 27.10.2026: další modularizace pozastavena. Historická příprava používá paměťový návrh i při chybě localStorage; UI výslovně označí omezenou obnovu. Oddělené formuláře/klíče historických a běžných turnajů a FC zachovány. Hybridy sdílejí existující resolver disciplíny a race-to, nové playoffRaceTo je pouze základ play-off, proměnlivá kola mají přednost; staré turnaje bez pole beze změny. Žádná migrace, Firebase Rules nebo výpočetní změny FC; Nasazeno 27.10.2026 merge93f87324c18aa3694afb46694623ff7e3b2c10c6 / PR40, Pages40580177141success. Veřejný web a běžný formulář ověřeny; soukromá historická správa/kvóta/vytváření zápasů odděleně na publikovaném kódu s mockem. Obnova hesla100 zachována. Produkční data beze změny/migrace. Podrobné nasazení, omezení a návrat viz docs/deployment-v4.51.101.md. Viz docs/tournament-setup-v4.51.101.md. Níže zachovaný stav předchozího nasazení.

# Druhá etapa modularizace – v4.51.99 RC

Dominik,27.10.2026: assets/js/cloud-refresh.js spravuje pouze automatické čtecí appData obnovy přihlášené relace. start/stop/refresh/dispose vlastní interval2500ms, jediný úvodní700ms timeout, visibility/pagehide a právěprobíhající fetch; předawaitautorizace rezervujepromise, stop abortuje a zneplatníepochu. Lokální datovýmerge/cache, sdílený matchesloader a oprávnění zůstávají v core; pollingové tělo a staréflagy odstraněny, původní funkce jsou adaptéry. Clear runtime identity zastaví modul i při offline/logout/tokenfail. Volitelný kontext obnovy tokenu je použit pouze tímto pollerem, aby pozdní credentials/error nepřepsaly novou relaci. Ostatní služby a počáteční read/write merge zatím mají starý životnícyklus. PNGjepriorita,XLSXzachován,PDFUI/knihovny nezměněny; odstraněníPDFjeoddělenýúkol. Nasazeno 27.10.2026 merge b5dc71f76364d29d455303566241579e545a6dcb / PR37, Pages40571675729 success. Veřejná aplikace/moduly/navigace ověřeny; cloudové Auth/lifecycle a soukromé exporty odděleně izolovaně, nikoli živá přihlášená produkční relace. Žádná změna dat/migrace. Viz docs/deployment-v4.51.99.md / PROJECT_STATUS.md. Níže je zachovaný předchozí kontext.

# První produkční etapa modularizace – v4.51.98 RC

Dominik,26.10.2026: čisté výpočty FC a reportové modely jsou v jediném `assets/js/federal-statistics.js`, načteném synchronně před inline core. CommonJS a browser používají stejný zdroj, modul nemá přístup ke globálnímu data/match, DOM, persistence, síti ani časovačům. Původní inline těla odstraněna; explicitní bootstrap vazba bez fallbacku. `assets/pushout-xlsx.js` dál pouze zapisuje společný datový model. Šablony, renderer a exportní controller zůstávají v index.html. Životnost cloudových úloh ani starý test-modular se v této etapě nemění. Opravy runtime cloudové revize, sdíleného čtení stejné identity a levného výběru fixture97 zachovány. Jde o oddělení zdroje logiky, nikoli slib zrychlení výpočtů/PDF. Nasazeno26.10.2026 merge4d7a564a7234912a5c8063cd42b2ae3fed8e166d / PR36, Pages40394978008success. Veřejný modul/verze/soubory/FC ověřeny; A1/A2/B aPNG/PDF/XLSX soukromých zápasů ověřeny odděleně s offline kopií, nikoli živou produkčníAuth. Žádná změna dat/migrace. Stav, omezení a návrat viz docs/deployment-v4.51.98.md a PROJECT_STATUS.md. Následuje zachovaný předchozí kontext.

# Poolčítadlo – společný kontext projektu

Produkce v4.51.97 RC / PR35 nasazena26.10.2026 merge6a57a98e53795a29925b2ce1601fa6903aaddd82, Pages40379170626success. Výkonovéopravy aktivní,produkčnídata bezezměny/migrace. Veřejnýweb/hash/navigace/desktop/mobil aA1/A2/B/PNG/PDF/XLSX soddělenou offline kopiídat PASS. PublikovanéHTML izolovaně plnácache/sdílenéčtení:2novérevizeaplikovanéjen2×,max1souběžnýGETmatches;35přechodů/0chyb. Starýexportnítest aktualizován a celýPASS,mainreleasePASS,Nodejen2známéFAIL+3soukroméSKIP. ZachoványlimityreportB~5s a40MBmimocache; živýcloud/Auth/iOS/hodinovýběh/OBS neověřeny. Viz docs/deployment-v4.51.97.md. Níže následuje historie přípravy přednasazením.


Kandidát97 – výkon26.10.2026:40MBexport překračuje localStorage; cloudový aplikovaný timestamp musí být také v paměti stránky, zatímco persistovaný marker lze posunout jen spolu s úspěšnou cache. Jinak poll2,5s opakuje stejný nákladný merge/render. FCvýběr nejnovějšíchfixture/pravidel série je samostatný levný společný krok, statistiky se počítají až v reportech (A1jen svůj zápas). SouběžnéloadSecureMatches pro stejnou relaci sdílí právě běžícíPromise, žádná trvalá cache. Bez změny sportovníchvýpočtů, cloudovýchdat aFirebaseRules; produkčnícore nenačítátest-modular, plošnýpřesun modulů není k opravě nutný. Naměřené limity aověření viz docs/performance-diagnostics-v4.51.97.md. Nesloučeno/nenasazeno, produkce96.


Produkce v4.51.96 RC / PR34 nasazena24.10.2026 merge3e095d702cb0838aaf4a4aa674540234426209f4, Pages40130394877 success. Čtení původních strků a konzervativní rekonstrukce racků aktivní, bez migrací/zápisů. VeřejnéHTML/assety/desktop/mobil a skutečnéPNG/PDF/XLSX na veřejnéURL s izolovanou offline kopií #9 PASS:SK48/94 %/2/4/lose2,CZ12/86 %/1/4/lose3. StandardníFCvýsledky/metrikystran zachovány. Release success,Nodejen2známéFAIL+3soukroméSKIP. ŽiváAuth/Firebase#9/OBS/iOS/Excel neověřeny. Viz docs/deployment-v4.51.96.md. Níže následuje zachovaná historie přípravy před nasazením.


Kandidát96/PR34 – doplnění rackové historie: při chybějícím kanonickém ledgeru lze ownBreakWins/ownBreakLosses doložit úplným surviving_history řetězcem explicitníbreak+legálnígameball+jednobodovéskóre+přeživšíprefixovésnapshoty. Žádné sčítání snapshotů, ukládání/migrace nebo odhad vítězů z celkového skóre. Existující kanonické racky mají vždy přednost; neúplný/konfliktní řetězec či nepodložené faulové/eso/manuální ukončení zůstane unknown. Skutečný #9 tak prokazuje2/4 proti1/4 a prohry2/3, detaily docs/federal-fixture-9-rack-reconstruction.md. Dřívější konstatování nedostupných rackových výsledků níže je historie první diagnózy před úplným prozkoumáním událostí.


Kandidát v4.51.96 RC / PR #34: shared FC API čte původní explicitní detailedPlay z běžného počítadla i po pozdějším doplnění federalCupLink. Čistý adaptér nepřepisuje data/verzi evidence/fromStart; zachovává partial, deduplikaci, neznámé hodnoty a párové vlastnictví. sequential_batch a strokeCount dokládají pokusy, samotný počet koulí ne. Chybějící rackový ledger nelze nahradit odhadem výher při vlastním breaku. Skutečné před/po zálohy #9 potvrzují změnu pouze vazby a oprava výpočtu dává48/51 proti12/14. Produkční opravu vazby provedl uživatel; aplikace96 zatím není sloučena ani nasazena. Viz docs/federal-fixture-9-statistics-diagnosis.md.


Produkce v4.51.95 RC / PR #33 nasazena24.10.2026 merge48706bd65d383e31b80c67a589fddc4de68e1ce0. Export pro Pushout má pouze Pushout a Metadata, Data notes odstraněn bez přesunu poznámek; interní diagnostika a výpočty zachovány. Přímo na neupravené veřejné URL reálné desktop/mobil stažení XLSX s izolovanou offline kopií Singles#3 PASS;2listy/9hodnot/nezměněnéXML a styly/0Firebase a0zápisů. Mainrelease success, Node207/209 pouze známé dvě chyby shodné s předmerge main. Žádná migrace nebo změna produkčních zápasů. Skutečná Auth/Firebase relace/iOS/Excel neověřeny, viz docs/deployment-v4.51.95.md. Následuje zachovaná historie přípravy a starších vydání.

Kandidát v4.51.95 RC (Dominik,24.10.2026): export Pushout používá výhradně shared federalCalculateMatch API s17metrikami (původní13 + missedPots/drySoftBreaks/foulBreaks/ownBreakLosses). Grafické reporty dál zobrazují původních13. Čistý federalPushoutModel a místní assets/pushout-xlsx.js tvoří přesně2listový XLSX (Pushout/Metadata, bez Data notes a bez přesunu poznámek) pro jeden dokončený uložený zápas; názvy/jména jako text, žádné Auth údaje nebo Firebase zápisy. B&R zachovává stávající return-push/soft konvenci. Doubles jsou páry, Team reprezentace, nikoli osobní statistiky. Nesloučeno a nenasazeno, produkce94. Viz docs/pushout-export-v4.51.95.md.

Produkce v4.51.94 RC / PR #32 nasazena23.10.2026 merge1f3def4e40899323209de29190b1d27c8465a67b. Přesné rovné SVG pouze v A1/A2/B, přehled s cloth PNG a dlaždice beze změny. Veřejné HTML/assety/verze/A2export/desktop/mobil PASS; všechny3reporty a6PNG/PDFpárů na publikovaném kódu izolovaně PASS. Bez změny statistik, migrace nebo produkčních zápisů. Mainrelease success, Node198/200 pouze dvě známé chyby shodné s aktuálním předmerge main. Rozsah a omezení skutečného cloudového A1/B/Auth/iOS/OBS viz docs/deployment-v4.51.94.md. Následující produkční a kandidátové poznámky jsou zachovaná historie.

Produkce v4.51.93 RC / PR #31 nasazena23.10.2026 merge990e68e39688e93f13b67496a753bf729417ea9d. Schválená dlaždice se zlatým pohárem, jemné společné vlajky, jedno tlačítko A2, reporty dostupných hodnot bez hvězdiček/popisků aResafe aktivní; explicitní push out pouze pro stavstolu. Žádná migrace produkčních zápasů. Přímý veřejný smoke/asset hash/A2export a izolované A1/A2/B na publikovaném kódu PASS:Singles#3 SK93 %/14,CZ95 %/38 při zachování interní partial. Aktualizovaný celý evidence-browser PASS; mainrelease success,Node198/200 pouze známé dvě chyby. Omezení produkčníAuth/Firebase/OBS/iOS a přesný rozsah viz docs/deployment-v4.51.93.md. Následující kandidátové poznámky jsou zachovaná historie před schválením.

Doladění kandidáta93 / PR #31: velké vlajky jsou PNG1920×1320 ze společných přesných SVG, s širokými nerovnoměrnými záhyby a měkkým šikmým světlem; bez periodických svislých pásů. Rovná malá SVG beze změny. Generátor scripts/render-federal-cloth-assets.cjs. federal-evidence-browser nyní ověřuje známé sekvenční dokončení8koulí jako8úspěšných pokusů a explicitní nulový push out; všechny jeho ostatní scénáře zachovány a PASS. Produkce92, čeká vizuální schválení, žádný merge/deploy.

Kandidát93 (Dominik): FederalCup reportový formatter zobrazuje dostupná procenta/počty i při partial bez hvězdiček; interní coverage/reasons nemění. Unknown zůstává—, známé0/0 zachováno. Push out podle výslovného pravidla nepřidává statistické poty/pokusy; nové potvrzení žádná/vybrané koule (bezNevím) upravuje jen stůl,9/10 sevrací, fyzická nula seukládá. Neurčenýfaul zůstává interněpartial. Přesné sdílené vlajky/maléploché avelkélátkové, společnétlačítkoA2, dlaždice se samostatnýmpohárem/HTMLtextem aResafe; zachovány13metriky,branding,rozměryexportů. Žádná migrace, neslučovat/nenasazovat. Podrobnosti docs/federal-cup-v4.51.93.md.

Produkce v4.51.92 RC / PR #30 nasazena23.10.2026 merge e98cd9ce1b38af4143b08ac343467c98cee3692c. Explicitní nula RESAFE přežívá prázdná pole vcloudu; bezpečný odvod před MISS ve známé rotaci dává jednu kouli = jeden úspěšný pokus sderived původem. Prevence rychlého dokončení neznámého stolu aktivní. Bez migrace hotových zápasů; původní Team1:5 zůstává nezměněný. Přímý veřejný smoke/verze/asset hash/A2export a izolované scénáře na staženém HTML PASS. Main release success, Node194/196 známé dvě chyby. Rozsah a neověřené produkční Auth/Firebase/OBS/iOS: docs/deployment-v4.51.92.md. Následující kandidátové poznámky jsou zachovaná historie před schválením.

Kandidát92 / PR #30: známá nula explicitních pot/escape/break akcí se ukládá číselně, aby přežila odstranění prázdných polí v cloudu. Chybějící/null údaj není nula. Bezpečný odvod před MISS ve známém přesném rotačním stole dle zadavatele znamená jednu kouli = jeden úspěšný pokus, zachovává inferred_pots / derived původ a entry sequential_inference. Jiné neznámé situace ani historické záznamy se automaticky nepřeklasifikují. Prevence rychlého dokončení neznámého stolu zůstává samostatnou částí. Původní Team1:5 není migrován; samostatný plán cílené opravy a testy viz docs/federal-zero-and-miss-v4.51.92.md. Produkce91, neslučovat a nenasazovat.


Produkce v4.51.91 RC / PR #29 nasazena 23.10.2026, merge98cc286de7f77526c37a7bc706156b33630611c7. Reporty A1/A2/B mají sjednocenou hierarchii Pushout Sports (456×62,32 s lokálním SVG ztmavením) → FEDERAL CUP 2026 → podtitulek. Quick-finish známého stolu eviduje jednu kouli jako jeden úspěšný pokus; bez zpětné migrace hotových zápasů. Veřejné soubory bajtově ověřeny, nepřihlášený smoke/A2export PASS; skutečné cloudové A1/B/statistiky, produkční Auth/Firebase a OBS neověřeny. Node189/191 jen dvě známé modularizační chyby; CI není plně zelené. Podrobnosti docs/deployment-v4.51.91.md a docs/federal-pushout-branding-v4.51.91.md.


Tento soubor je hlavní společný kontext pro vývoj aplikace Poolčítadlo. Slouží jako zdroj pravdy pro Jaroslava, Dominika i jejich ChatGPT asistenty.

Povinná pravidla spolupráce jsou v `AGENTS.md`. Před každou prací čti také `REVIZE.md` a `PROJECT_STATUS.md`; aktuální verze, ověřené nasazení, rozpracované body a výsledky testů se udržují v `PROJECT_STATUS.md`. Tento soubor popisuje dlouhodobý kontext a nenahrazuje aktuální stav.

Každá samostatně nasazovaná funkční i vizuální změna povinně zvyšuje `v4.51.X RC` o 1 podle čerstvého vzdáleného main. Jedno vydání může mít více commitů; čistě dokumentační pokračování verzi nemění. Každé vydání má vlastní úplný záznam v REVIZE.md a aktuální PROJECT_STATUS.md. `node scripts/check-release.cjs --base origin/main` a samostatný CI job Release version and revision ověřují zvýšení verze při změně produkčních souborů, konzistenci všech čtyř aktivních míst a evidenci vydání. Podrobnosti a povinné kontroly jsou v AGENTS.md. Historické záznamy se nepřečíslovávají. CI není samo o sobě ochranou větve; nastavení GitHub branch protection se tímto nemění.

## Repozitář a produkce

Kandidát91 (Dominik): pouze nové rychlé akce se známým 9/10-ball stolem používají předpoklad jedna zbývající koule = jeden úspěšný potápěcí strk (pot/sequential_batch). Zachováno B&R versus dohrávka, actor Team a dvojice Doubles. Unknown stav nemá odhad koule/strku; staré dokončené záznamy se nemigrují. Výpočty se nemění. Reportový formatter sdílí krátké 0/0 / procenta / partial* / —; oficiální procenta/sloupce pouze úplná evidence. Doubles nominace má dva neporušené řádky jmen se škálováním. Detaily a stav nové opravy v docs/federal-quick-finish-v4.51.91.md / PROJECT_STATUS.md. Bez merge/deploy, produkce90.


Aktuální nasazení: v4.51.90 RC z externího merge PR #28, fe696f477d37f1f8ad2c99e242c1d789c746071c. Dne 23. 10. 2026 potvrzen úspěšný Pages deployment, přesná shoda veřejného HTML/assetů a bezpečný nepřihlášený smoke test. Rozsah a neověřené přihlášené funkce jsou výslovně v docs/deployment-v4.51.90.md / PROJECT_STATUS.md. Následující popisy kandidáta zachycují historii před sloučením; formulace bez merge/deploy v nich není aktuálním stavem produkce.


Kandidát 90 – poslední funkční revize (Dominik, 23. 10. 2026): nový zápas má výchozí streamEnabled=false. Uživatel může před startem zvolit overlay i v kompaktním nastavení; rozpracovaná volba je jen sessionStorage draft, po úspěšném startu se vymaže. Rozhoduje uložený příznak konkrétního zápasu, během hry se nepřepíná. Nové zapnuté streamy začínají soon; staré záznamy svůj režim zachovávají a bez příznaku jsou bez streamu. Oddělená běžná synchronizace Livescore zůstává, zatímco OBS stream/users se bez zapnutí nepublikuje. Stream panel je v obou počítadlech až za herními akcemi/UNDO/tempo/rozstřel, před událostmi. URL a izolace UID+matchId neměněny.

Nasazování FC porovnává stabilní participant ID jako neuspořádané dvojice, vypisuje souběžně všechny relevantní chyby Slovenska/Česka a před konečným startem ověřuje aktuální pravidla i shodu připravených ID. Dříve spuštěné zápasy lze stále obnovit. Textová reference docs/federal-cup-2026-lineup-rules.md je přepis pravidel dodaných Dominikem, není originální PDF. Schválené reporty/13 výpočtů a exporty se touto revizí nemění; PR #28 bez merge/deploy.


Divácký Federal Cup od zjednodušení kandidáta 90 (Dominik, 23. 10. 2026) používá výhradně grafické reporty: tabule A2, program A1, soupisky B. A1 tlačítko jen pro dostupný dokončený uložený zápas podle stejného výběru jako dialog, včetně hodnocené série; změna dat mezi vykreslením a kliknutím zůstává chráněná kontrolou dialogu. Ruční výsledek bez detailu či neodehraný zápas nemá A1. Staré detailní statistiky a podkladové agregace existují dál pro ostatní části i admin; viewer nemá jejich listener ani starou týmovou tabulku. Soupisky následují přímo po programu. Grafika a výpočty reportů se tím nemění.


Od finální revize kandidáta 90 (Dominik, 23. 10. 2026) je publikovaný list oddělený od technické nápovědy: PNG/PDF neobsahují interní ID/API/zdrojové výpisy, stručná poznámka a část/— zachovávají informaci o úplnosti. Zdroje, identity a pravidla osobních výsledků/výkonu zůstávají v rozbalovacím details dialogu mimo plátno. Mobilní zoom má vlastní posuvnou oblast, takže ovládací tlačítka zůstávají dostupná. Existující FC vstupy a stabilní identity zachovány, minimálně upraveno jen zarovnání/rozestupy/dotyková velikost. Grafika A1/A2/B schválená, ovládání k revizi; bez merge/deploy.

Finální vizuální iterace stejného kandidáta 90: A1/A2 sdílejí dekorativní SVG rámy a dynamický SVG text skóre s měřením šířky, B vlastní kartu a % VÝHER. Metrika escapeSuccess se v reportech jmenuje Úspěšnost úniků z jistot; oba přejmenované texty nemění vzorce. Titulky a ztmavení/vinětace jsou SVG kvůli shodě náhledu a html2canvas. Fotopodklad, výpočty, herní data, synchronizace i stream beze změny. Podrobné porovnání a aktuální stav v docs/federal-reports-stage-3b.md / PROJECT_STATUS.md.

Etapa 3B stejného kandidáta v4.51.90 RC (Dominik): pevná HTML publikace 1920×1080 podle originálů docs/design-references/federal-cup, samostatný fotopodklad bez dat. PNG klientsky html2canvas, PDF jsPDF s celým stejným PNG, žádný další server/ukládání. Mobilní škálování náhledu nemění exportní rozměry; dekódování assetů/fontů, kontrola přetečení a token generace chrání export při zavření/přepnutí. Podrobná omezení a ukázky docs/federal-reports-stage-3b.md. PR #28 zůstává nesloučený a nenasazený; grafika k vizuální revizi.

Kandidát v4.51.90 RC, etapa 3A (Dominik, 22. 10. 2026): reportové vstupy i dialog výhradně uvnitř Federal Cupu, bez nových reportů ostatních soutěží/profilů/počítadel. Všech 13 herních metrik čte původní match/season API, bez druhého výpočtu. Nový oddělený čtecí součet výsledků celých zápasů používá stejné vybrané fixture a stabilní historické nominace (Singles 1, Doubles 2, Team 5 osob); osobní výkon nadále neobsahuje Doubles strky. Hostitel reportu je explicitní reportHost v konfiguraci, 2026 SK, jiný ročník bez něj bez odhadu. Přepínání pořadí je pouze prezentační, SK zůstává červené a CZ modré. Otevření reportu nic neukládá ani nenačítá ze sítě. Podrobnosti a náhledy: docs/federal-reports-stage-3a.md. Kandidát se zatím neslučuje a nenasazuje; grafika/exporty 3B jsou další etapa.

Od v4.51.89 RC (Dominik, PR #27 sloučen a nasazení ověřeno 22. 10. 2026): interní Federal Cup API rozšířeno na 13 metrik (`jumpShots`, `bankShots` typu ratio). Kanonické `detailedPlay.records` mají přednost před souhrnnými čítači a rackovými kopiemi; rozpory zachovají pouze doložené mezisoučty, nikoli úplný výsledek. Historické samotné čítače nedokládají osobního střelce. Historie strků nově čte uložené Jump/Bank atributy přímo; nevytváří druhý ledger. Zrušení navazujícího dialogu ruší značku, undo obnovuje výslovný stav před strkem a pending značka přežije reload. Bez změn skórování, streamu, Rules či grafických exportů; verze je nasazena, podrobnosti a hranice ověření v PROJECT_STATUS.md. Podrobnosti: docs/detailed-counter-evidence.md a docs/federal-statistics-calculation.md.

Od v4.51.87 RC (Dominik, PR #26 sloučen a produkčně ověřen 22. 10. 2026): streamovaný zápas s tempem může běžet před jeho výsledkem. `deferredLag` zachovává tuto volbu při uložení; do zadání výsledku jsou `turn` a `breaker` null, nevzniká rack ani záznam strku a herní akce i hodiny jsou blokované. Tempo lze zadat/opravit v počítadle, s přenesením jediného lagWin a úvodního breaku a s undo snapshotem. V rozšířeném počítadle opravu uzavře první zaznamenaný rozstřel. Jednoduché počítadlo jednotlivé strky nezná: obsluha před fyzickým breakem potvrdí ZAHÁJIT HRU • UZAMKNOUT TEMPO; potvrzení se ukládá a lze je vrátit přes UNDO. Před potvrzením nelze přičítat body. Bez streamu zůstává původní postup, včetně povinného tempa před startem Federal Cupu.

Payload přidává `counterMode`, `lagPending`, `breakerKnown` a nullable skutečné indexy `turn`/`breaker`. Jednoduchý overlay zvýrazňuje skutečného rozstřelujícího aktuálního racku s BREAK; plný zachovává U STOLU podle tahu. Chybějící/neplatná strana neznamená levého hráče. Starší payload bez counterMode zachovává plný režim, pokud obsahuje platný tah. Nové URL mají cache parametr v=14, UID+matchId ani jejich životnost se tempem nemění; staré explicitní a UID-only URL nadále používají izolaci PR #25. Slot stream/users/UID, Rules, oprávnění a čtyři režimy se nemění. Obsluha jednoduchého počítadla musí potvrdit zahájení před fyzickým breakem; bez jednotlivých strků tento okamžik aplikace nepozná. Verze je nasazena; podrobnosti ověření a zbylá omezení jsou v PROJECT_STATUS.md.


- GitHub: `bcrybarna-oss/BC-Rybarna-Scoreboard`
- Produkční větev: `main`
- Hlavní produkční soubor: `index.html`
- Aplikace je v současnosti převážně jedna velká HTML aplikace s JavaScriptem a CSS přímo v `index.html`.
- Změny v `main` mohou ovlivnit reálné používání aplikace.

Doporučený workflow:
Výslovný požadavek zadavatele na přímou práci v main má přednost; i tehdy platí kontroly vzdálených změn, testy a dokumentace podle `AGENTS.md`.
1. vytvořit vlastní branch,
2. implementovat změnu,
3. otestovat desktop i mobil,
4. vytvořit Pull Request,
5. projít diff,
6. až potom merge do `main`.

## Vizuální styl

Poolčítadlo používá černo-zlatý design. Logo Poolčítadla funguje jako Home. Mobilní spodní navigace se během přípravy a samotného hraní zápasu automaticky skrývá, aby nepřekážela.

## Účty, role a Firebase

Aplikace používá Firebase Authentication a Firebase Realtime Database. Od v4.51.100 RC je v přihlašovacím dialogu ZAPOMENUTÉ HESLO?, které anonymně požádá Firebase Authentication o PASSWORD_RESET pro zadaný e-mail, aniž by zasahovalo do existujícího UID, hráčského profilu, historie, oprávnění či zápasů. Odpověď neodhaluje existenci účtu a chyby sítě/limitů se sdělují zvlášť.

Role:
- `player`
- `club_admin`
- `system_admin`

Bezpečnost:
- SYSTEM ADMIN se nesmí dlouhodobě ukládat do `localStorage`.
- Admin refresh token se drží pouze v `sessionStorage`.
- Staré admin tokeny z `localStorage` se při načtení odstraňují.
- Běžní hráči mohou mít dlouhodobější přihlášení.
- Role se nesmí přenášet přes URL.
- Běžný hráč nesmí zapisovat globální `/appData`.
- Cizí aktivní zápas nesmí být editovatelný.

## Hráčské profily

Registrovaný účet může být propojený s hráčským profilem. Podporováno je převzetí existujícího profilu, vytvoření nového profilu a zpětné propojení historických výsledků. Sekce Hráči odděluje Profil a Historii zápasů.

## Herní režimy

- 8-ball
- 9-ball
- 10-ball
- 14.1 nekonečná
- Ghost 8/9/10-ball
- Solo 14.1
- Vítěz na stole pro 3 hráče
- turnajové zápasy

Klasické zápasy podporují Race to, střídavý/vítězův rozstřel, tempo, shot clock, extension, 3-foul rule, faul, faul z breaku, dry break, soft break, safe, miss, runout, break & run, BIH, undo a evidenci konkrétních koulí u 9/10-ball.

## Statistiky a PDF

Od v4.51.83 RC používá společné detailní počítadlo 8/9/10-ball model detailedPlay se strukturovanými záznamy strany, racku, náběhu a známého aktéra. Běžné potopení, break a foul pots jsou oddělené; souhrnné doplnění neudává přesný počet strků. Jistota má vazbu na jednu reakci/únik včetně RESAFE. Jump/bank jsou přepínače jednoho strku s úspěchem/pokusy. MISS nemá důvod ani automatickou jistotu; 2-Way a nechtěná jistota zůstávají pouze v historických statistikách. Odhad nižších koulí používá pouze aktuální náběh v 9/10-ball a při nejistotě nabízí opravu stolu. Starší zápasy nemigruje a chybějící nová evidence je neznámá, nikoli ověřená nula. Team zaznamenává hráče racku, Doubles pouze známou dvojici. Jednoduché počítadlo, 14.1 a Ghost nový model nepoužívají. Podrobnosti, testy a limity jsou v docs/detailed-counter-evidence.md; skutečný stav vydání v PROJECT_STATUS.md.

Po zápase se zobrazuje detailní statistický přehled a PDF REPORT.

Sekce Statistiky obsahuje mimo jiné:
- ELO
- zápasy, výhry/prohry, racky
- break statistiky
- dry/soft break
- faul z breaku
- koule z breaku a průměr
- esa
- break & run
- dohrávky
- jistoty
- úspěšnost jistot
- úspěšnost úniků
- RESAFE
- statistiky 14.1
- vzájemné zápasy
- turnajové statistiky

Má vlastní PDF REPORT.

Sekce Moje statistiky má filtry CELKEM / 8-ball / 9-ball / 10-ball / 14.1 a také vlastní PDF REPORT.

PDF používá `html2canvas` a `jsPDF`.

Exportní tlačítka EXPORT PDF v historii, detailu zápasu, Statistikách a Moje statistiky otevírají společný `openPdfExportDialog`. PDF se pro otevřené okno připraví jednou. Sdílet PDF předává připravený File do systémového sdílení přímo z kliknutí uživatele; Uložit do zařízení samostatně stahuje stejný blob přes `savePdfBlob`. Sdílení nesmí nahradit uložení. Okno zůstává otevřené po obou akcích i jejich zrušení/chybě; zavírá se tlačítkem Zavřít nebo Escape. Pokud není dostupné sdílení souborů, dialog je vysvětlí a ponechá uložení. Textové sdílení jiných částí aplikace je samostatné. Ověření skutečných systémových dialogů, mobilních prohlížečů a nativních aplikací eviduje PROJECT_STATUS.md.

## Ghost

Ghost používá:
- 2 body = čisté dohrání
- 1 bod = dohrání s BIH
- 0 bodů = nedohráno

Sleduje se také dry break, soft break, faul z breaku, eso, koule, na které hráč skončil, a historie racků. Ghost statistiky se nemají míchat s běžnými zápasy.

## 14.1

14.1 má vlastní logiku: skóre, high run, innings, průměr na náběh, MISS, SAFE, fauly, trestné body a 3× foul penalty. Solo 14.1 má vlastní oddělené statistiky.

## Turnaje a série

Podporované formáty zahrnují skupiny, DKO, SKO, švýcarský systém a kombinované formáty.

Turnaje mohou mít:
- skupinovou část
- play-off
- různé disciplíny
- Race to
- pořadí
- dělená místa
- historické výsledky

Je možné zpětně přidávat již odehrané turnaje včetně detailních výsledků.

Od v4.51.81 RC má kompletní historické zadání do série také strukturovanou ruční přípravu skupin/SKO/DKO a skupin → pavouk. Ukládá se jako samostatný zabezpečený turnaj s historicalStructure a vazbou na sérii; rozpracovaný stav nepřináší body. Používá stejné generátory, postup a bodování jako běžné turnaje, pouze bez počítadla/statistických/LIVE zápisů. Podrobnosti, původní pravidla Lounské série, potvrzování dopadu oprav a testy popisuje docs/historical-structured-entry.md. Pro více samostatných skupin bez pavouka je po potvrzení Dominikem povinné ruční konečné pořadí. Původní historické ruční zápasy a pořadí zůstávají alternativou; stará data se nepřepisují.

Nabídka kritérií historické přípravy přebírá options z běžného formuláře `tournamentGroupAdvanceTieRule`: Body / skóre ve skupině (`points`, výchozí), Vzájemný zápas (`head_to_head`). Obě používají původní `groupStandings`; penalty jsou volitelně zapnuté, výchozí vypnuté. Sjednocení popisků nemění uložená pravidla ani dokončené výsledky. Stav nasazení eviduje PROJECT_STATUS.md.

V sekci Série turnajů má být tlačítko `NOVÁ SÉRIE`, ne `Nový turnaj`.

Lounská tour může používat umístění, celkové skóre, vzájemný zápas a dělená místa.

## Liga Sever

Liga Sever má samostatnou logiku pro týmy, zápasy doma/venku, disciplíny, rozhodující dvojice, kapitány, potvrzení výsledků a tabulku ligy.

## Turnajový kalendář

Registrovaný uživatel může zveřejnit flyer, datum, místo, informace, výhry, kontakt a kapacitu. U podporovaných turnajů může být registrace přímo přes Poolčítadlo. Počítá se i s mezinárodními turnaji.

## Pořadatelé turnajů

Turnaj může mít více manager UID. Hlavní pořadatel může přidat dalšího uživatele, který může turnaj spravovat.

## Výzvy k zápasu

Hráči s propojenými účty si mohou posílat výzvy obsahující soupeře, disciplínu, Race to, datum, čas, místo, poznámku a veřejnou/soukromou viditelnost.

Soupeř může:
- přijmout
- odmítnout
- navrhnout jiný termín

Přijatý zápas lze spustit přímo z výzvy.

Na homepage se zobrazuje počet nových výzev, domluvené zápasy a nejbližší zápas.

Plánovaný další krok je centrální centrum upozornění přes zvoneček vpravo nahoře pro nové výzvy, protinávrhy termínu, přijetí/odmítnutí a později další typy notifikací.

## Livescore

Aktivní zápas se publikuje jako veřejný LIVE stav. Veřejný payload nesmí obsahovat celý interní stav zápasu. Může obsahovat jména, skóre, disciplínu, Race to, stav hry a průběh skóre. Cizí rozehraný zápas je pouze ke sledování.

## Stream

Od v4.51.86 RC je OBS adresa vázána na UID + matchId (query i hash), bez automatického hledání cizího streamu. UID-only staré URL se po prvním platném zápase připnou a vazbu uchovají; pro další zápas se používá jeho nová konkrétní URL. Výpadek, jiné matchId nebo stáří 20 sekund znamená nedostupnost. Publikace zůstává na původním stream/users/{uid}, tedy souběh dvou zápasů stejného účtu může snížit dostupnost, ale nesmí převzít obraz. Vymazání streamu kontroluje matchId a ETag/If-Match. Oprávnění se nemění; návrh serverového canStream čeká na schválení. Omezení kompatibility, přesný test a postup pro OBS: docs/stream-isolation.md. PR #25 sloučen a nasazení ověřeno 22. 10. 2026 po Dominikově potvrzení, že přenos neběží; starý otevřený OBS zdroj vyžaduje obnovení.

Od v4.51.85 RC mají jednoduché i rozšířené počítadlo jediný společný panel LIVE / PAUZA / BRZY ZAČÍNÁME / KONEC. Viditelnost určuje pouze streamEnabled, nikoli counterMode. Panel používá původní setStreamMode, publikaci do stream/users/{uid} a původní overlay.html, bez změny protokolu nebo skórování.

Existuje overlay, livescore, obrazovka pauzy a QR kód odkazující na Poolčítadlo. Pauza funguje přímo v aplikaci.

## Administrace

Administrace obsahuje například:
- žádosti o převzetí profilu
- registrované účty
- správu hráčů
- správu zápasů
- správu turnajů
- migrace databáze
- bug reporty
- slučování duplicitních profilů
- opravy profilů
- zálohy dat

JSON export/import byl přesunut ze Statistik do `Administrace → Záloha dat`. Mazání zápasů má být pouze pro administrátora.

## Homepage

Moderní dashboard obsahuje branding Poolčítadla, metriky, rychlé vstupy, žebříček, poslední zápasy, výzvy a domluvené zápasy. Admin sekce se zobrazuje pouze oprávněnému adminovi.

## Pravidla pro další vývoj

Při každé změně:
1. najít existující implementaci,
2. pochopit její datový tok,
3. nevytvářet druhou paralelní implementaci stejné věci,
4. využívat existující helpery,
5. držet konzistentní názvy,
6. testovat desktop i mobil,
7. počítat se staršími uloženými daty,
8. zachovat zpětnou kompatibilitu,
9. ověřit, kdo smí data číst a zapisovat,
10. u Firebase funkcí ověřit vlastnictví objektu a oprávnění.

## Důležitý princip

Poolčítadlo už není jen počítadlo skóre. Je to platforma pro zápasy, hráče, statistiky, turnaje, ligy, výzvy, livescore, stream a komunitní kalendář.

Každá nová funkce má zapadnout do existujícího systému a nemá zbytečně duplikovat už existující řešení.

## Pro ChatGPT asistenty

Při práci na tomto repozitáři:
- nejdřív si přečti tento soubor,
- potom si načti relevantní část `index.html`,
- nedělej zásadní refaktor bez výslovného zadání,
- netvrď, že je něco implementované, dokud změna není skutečně commitnutá,
- při větších úpravách preferuj branch + Pull Request,
- u bezpečnostních změn buď konzervativní.

## Dokončená a nasazená etapa evidence Federal Cupu – v4.51.84 RC

PR #21 sloučen 21. 10. 2026, nasazení v4.51.84 RC ověřeno; etapa 1 uzavřena. Registr účastníků má náhodná neměnná ID, samostatné pořadí a historické snapshoty. Singles/Doubles používají federalEvidence.racks, Team nadále jediný federalTeam.racks. Kanonické strky jsou detailedPlay.records, rackové kopie se nesčítají. Nové FC strky mají evidenceVersion 2, účel a známé/neznámé útočné pokusy i původ potopení; coverage se posuzuje podle ukazatele. B&R zachovává současná pravidla. Staré identity a chybějící statistiky se automaticky nedoplňují. Viz docs/federal-statistics-evidence.md a aktuální stav v PROJECT_STATUS.md.

Doplnění revize PR #21 (21. 10. 2026, Dominik): Konfigurace FC používá výchozí snapshot + atomický ETag/If-Match zápis; obecný appData upload zachová serverový Federal Cup. Obnovení zápasu a render nic neukládají ani nevytvářejí ID. Draft soupisky drží všechny řádky a identity, konflikt vyžaduje obnovení. Řídké RTDB objekty zachovávají indexy. Servisní opravy skóre mají trvalé serviceChanges s oddělenou úplností racků/útoku/koulí a snapshotem undo před opravou. Dvouklientové testy v docs/federal-statistics-evidence.md. Nejde o distribuovaný zámek fixture či editace jednoho zápasu. Produkce, Firebase Rules, report ani rozdělení CI se nemění.

## Výpočetní etapa 2 Federal Cupu – v4.51.88 RC (nasazena a ověřena 22. 10. 2026)

Interní čisté funkce federalCalculateMatch a federalCalculateSeason v nynějším index.html počítají 11 metrik ve společném kontraktu numerator/denominator/count/value/coverage/reasons/components. Zdroje jsou kanonické strky, skutečné racky a průkazné souhrnné nebo rozdílové čítače. Příspěvky Team hráčů se nevydávají za další samostatný týmový výkon; Doubles se jednotlivcům nepřipisuje. Roční agregace vybere jeden dokončený detail na fixture před ručním výsledkem a sčítá zlomky před dělením, respektuje ročník a stabilní ID. Neprovádí zápisy, migraci, čtení globálního stavu ani nový veřejný report/PDF. Přesný kontrakt, 11 vzorců, neúplnost a referenční příklady v docs/federal-statistics-calculation.md. Staré prezentační statistiky a herní pravidla se v této etapě nepřepojují.

Opravy revize PR #22 (Dominik, 22. 10. 2026): osobní Team výpočet přenáší původní detailed coverage; validuje shotIds proti původním kanonickým records i po omezení na racky hráče. Kompatibilní rack.shots není náhradním zdrojem. Neúplnost má rozsah metriky/strany/hráče a pokračuje do ročníku. Známé rackové countery se sčítají i při chybějícím jiném racku, partial má value=null; úspěšné breaky odvozené ze subtraction se nejdřív posuzují po racku. Identické duplicity se nezapočítají dvakrát, konfliktní ID se nevydává za známý strk. Integrace aktuálního main zachovává odložené tempo a streamovou izolaci; rezervovaný break se do provedených nepočítá. Viz docs/federal-statistics-calculation.md a trvalé integrity testy. Žádná nová prezentační nebo exportní etapa.

Etapa 2 uzavřena: PR #22 sloučen jako cc3c78959779c02a21fea222524ce7a187145cad, Pages a veřejná shoda obou HTML v4.51.88 RC ověřeny 22. 10. 2026. Veřejný výpočetní zdroj odpovídá referencím všech 11 metrik a třem opraveným regresím. API zůstává interní; nové reporty a PNG/PDF vyžadují další zadání. Podrobné důkazy, CI se dvěma známými preview selháními a omezení produkční kontroly jsou v PROJECT_STATUS.md/REVIZE.md.

## Kandidát94 – vlajky v exportech

Pouze reportFlag pro A1/A2/B používá společné přesné rovné SVG přímo, bez cloth deformačního filtru/předrasterizovaného PNG. Přehled ponechává cloth PNG. PNG1920×1080 a PDF16:9 se stejnými lossless pixely, bez změny layoutu/statistik. Nesloučeno/nenasazeno; produkce93. Detaily docs/federal-report-flags-v4.51.94.md.
