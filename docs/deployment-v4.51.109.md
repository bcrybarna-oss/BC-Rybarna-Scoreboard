# Nasazení v4.51.109 RC — notifikace, etapa 9a

Zadavatel: Dominik. Datum: 31. 10. 2026. **Nasazeno; veřejné a izolované funkční kontroly prošly v uvedeném rozsahu. Přísná PNG parita má níže evidované selhání.** Etapa9b nezahájena.

## Sloučení a CI

Před sloučením čerstvý fetch potvrdil main `8aa29fdd637fefb94f2fa86257896ad70e6a8e80`, žádnou souběžnou změnu ani konflikt. Povinný release gate109 proti108 prošel. Tracked strom byl čistý, cizí nepřidané soubory zachované. [PR50](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/50), finální head `f49826e2bb508a5c333f06035adec06f93eb69f0`, byl standardně sloučen merge `26c98fdc5309bf5b047c6ef91fcb4c1de87e1205`.

[Finální PR CI41216598034](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41216598034) i [main CI41217198866](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41217198866): release PASS, produkce **285 PASS / 0 FAIL / 3 SKIP** z288. Přeskočené kontroly potřebují soukromé exporty. Produkční sada byla zopakovaná lokálně po merge se stejným výsledkem; předmerge se soukromými vstupy288/0/0.

Experiment **28 PASS / 2 FAIL / 0 SKIP**, celý workflow FAILURE. Obě chyby jsou jednotlivě totožné s výchozím main, testy/core nebyly měněné:

1. `preview-match-reload-recovery.test.cjs:50`: při chybějícím Auth preview neodpojí zápas z editovatelné paměti.
2. `preview-match-reload-recovery.test.cjs:155`: preview přijme zbytkové UID vlastníka bez autentizované identity.

Experimentální core není produkčně načítaný. Žádné kontroly nebyly obejité; povolení těchto dvou nezměněných experimentálních vad bylo výslovné. Toto není tvrzení o zeleném celkovém CI.

## Veřejná produkce — skutečná relace bez přihlášení

[Pages41217198366](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41217198366) build/deploy/report success; další nasazení nebylo ručně spouštěné. URL: [Poolčítadlo](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/).

- Skutečná **v4.51.109 RC**, všech25 kontrolovaných veřejných souborů HTTP200 a přesný SHA256 proti merge. Index/overlay/reader/renderer/NotificationCenter ověřeny i samostatnými cache-busting URL.
- Chrome desktop1440×1000 a mobil390×844: všech deset modulů jednou, NotificationCenter dostupný, žádný experimentální core/fallback. Žádné pageerror/consoleerror.
- Bell otevře anonymní centrum, zobrazuje se výzva k přihlášení. Zavření a další otevření fungují;20opakovaných renderů bez JS chyby. Přečtení nebylo vůbec vyvolané: monitor lokálního klíče notifikací potvrdil0zápisů. Firebase/Auth a všechny zápisové požadavky byly blokované, žádný takový pokus nenastal.
- Navigace úvod/výsledky/Livescore/FC, prázdný Livescore a nedostupný detail, rychlé close/reopen,21položekFC bez chyb. Veřejná relace neposkytla soukromé nebo živé záznamy; jejich naplnění není veřejně ověřené.

**Stávající mobilní omezení:** otevřený panel v anonymním stavu překrývá střed zvonku; jeho druhé pointer kliknutí proto test nemohl provést. Stejný stav byl izolovaně reprodukovaný na nezměněné108 i109: bell x231/y143/40×38, panel x19/y155/352×127, obě geometrie totožné. Skutečné kliknutí mimo panel jej v obou verzích zavře. Veřejná mobilní kontrola použila tento dostupný způsob, bez force click nebo úpravy aplikace. Není to nová regrese9a; vzhled nebyl v nasazovací úloze měněný. První neúspěšný smoke log zůstává místně evidovaný.

## Izolovaně na publikovaném kódu

Stažené HTML a všech deset modulů prošlo SHA256; read-only source overlay předalo právě tyto soubory testům. Nezměněné ostatní assety/writer odpovídají ověřené verzi merge. Všechny endpointy jsou mockované, žádný produkční read-state nebo cloudový záznam nebyl upravený.

- **Funkční acceptance NotificationCenter PASS desktop/mobil:** skutečná instance v aplikaci, otevření/zavření,100renderů, jedno označení řádku a jedno mark-all = přesně2lokální zápisy. Zachycený payloadA ponechá mapuB, následná akceB zachováA. Stará A akce po raw přepnutí naB provede0zápisů a0navigací. Změna relace před100ms efektem zruší scroll. Zvonek funguje i mimo výzvy;20stop/start cyklů, čtyři stabilní DOM obsluhy, po dispose0 a žádný pending scroll. Žádné JS chyby nebo skutečné zápisy.
- **7unit skutečného modulu PASS:** statusy/pořadí/limit30, běžné payloady, identity guard před i uvnitř mockovaného zápisu, již zahájený zápis má původního vlastníka a není vydáván za odvolaný, quota/error/retry, bfcache a úklid všech6vlastněných listenerů. Publikovaný modul je byteově shodný s tímto zdrojem.
- Widget acceptance drží synchronní provider výzev jako fixture a pozastaví jiné background služby. Jde o ověření9a, nikoli živé Auth nebo síťového writeru9b/9c.
- Na publikovaných souborech dále prošly obnovy8a (3→1GET, opožděné odpovědi/A→B/logout/úklid), manuální/automatická identity+match recovery a dvouklientová izolace streamu/OBS. Skutečné A1/A2/B PNG/PDF a Singles/Doubles/Team XLSX desktop/mobil, duplicity/chyba/opakování/DOM/URL úklid PASS. Exporty měly přístup ke standardní dočasné složce prohlížeče a pouze lokální vstupy/mock. Předmerge turnajové a ostatní modulové regrese zůstávají doložené v dokumentaci9a.

## Přísná PNG parita — samostatně evidované selhání

Nezměněný `notification-center-browser.cjs` na publikovaném kódu selhal v přísném srovnání PNG. Opakovaný samostatný běh i pokus s dvěma requestAnimationFrame a kurzorem mimo panel dopadly stejně: bitovou shodu se nepodařilo spolehlivě potvrdit. Kontrola nebyla rozvolněná, potlačená ani označená za jednu ze dvou experimentálních vad.

Diagnostika prvního páru: oba obrázky391×336, rozdíl33pixelů z131376, maximální rozdíl kanálu18. Texty a vizuální rozložení shodné. Dva SHA otisky `3ddcfff143d1e7f9ed776e39be817b3d7601754f15c59c0f69b938cf06ae5e72` a `52f2700d3f5bb33f61fe686b7bb75e00ecebb16b69201f2149c7333289228852` se v druhém běhu prohodily mezi původní108 a novou109. Odchylka tedy není jednoznačně svázaná s novým zdrojem. Předmerge stejná přísná kontrola prošla; root i modul se od otestované implementace nezměnily. Nová funkční nebo obsahová regrese nebyla prokázaná.

Původní přísný browser test zůstává FAIL; samostatný funkční acceptance scénář výše jej nenahrazuje ani nepřevádí na PASS. Ten ověřuje požadované chování obou viewportů nezávisle na rasterizaci. Výsledek nasazení proto nezahrnuje garanci deterministické bitové obrazové shody. Snímky/logy/diff diagnostika jsou místně v output/deploy109.

## Omezení a návrat

Živá přihlášená Auth/Rules relace, soukromé produkční notifikace a fyzický iPhone/Safari/OBS nebyly testované. Mobil je Chrome viewport. Oprávnění/Rules, cache a migrace se neměnily. Známé B/cache limity a mezery challenge cache/securePlayers transportu/presence zůstávají pro9b/9c/A1. Další část nebyla zahájená.

Návrat: reverzní PR z čerstvého main, `git revert -m 1 26c98fdc5309bf5b047c6ef91fcb4c1de87e1205`, nová verze podle aktuálního main/AGENTS, release a regrese, standardní Pages. Vrátit bootstrap a původní těla společně. Bez reset/forcepush, smazání read-state, importu nebo vracení dat. Formát JSON je kompatibilní; reverze by ale vrátila potvrzené stale-click/scroll vady, proto při skutečné funkční regresi posoudit užší hotfix. Návrat nebyl provedený, protože nová funkční regrese nebyla zjištěná a pixelový variantní výsledek se vyskytuje u obou verzí.

Aktualizované STATUS/CONTEXT/REVIZE/roadmapa. [Sanitizovaná evidence](deployment-v4.51.109-verification.json), [původní mapa a hranice9a](notifications-stage-9a.md). Produkční data nebyla měněná ani migrovaná a produkční notifikace nebyly označené jako přečtené.
