# Nasazení v4.51.108 RC — Livescore renderer, etapa 8b

Zadavatel: Dominik. Datum: 30. 10. 2026. **Nasazeno a v níže uvedeném rozsahu ověřeno.** Etapa 9 není zahájená.

## Sloučení, verze a CI

Čerstvý fetch před sloučením potvrdil nezměněný main `c699d94833e636ede62e50b0fc0ef272d4f26290`, čisté tracked soubory a kandidáta108 proti produkci107. Povinný release gate prošel. Cizí nepřidané soubory byly zachované. PR [#49](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/49), finální head `06599cb2e83d3586cdf036c1f7cbbc4db818153f`, byl po schválení sloučen standardním merge `d2ed8be97dfd124713b7e35c3ab986d74b237eca`. Žádný force push, squash historie nebo obcházení kontrol.

[PR CI41109436463](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41109436463) a [main CI41110009670](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41110009670): release PASS, produkce **278 PASS / 0 FAIL / 3 SKIP** z281; tři kontroly potřebují soukromé exporty. Produkční sada byla zopakovaná i lokálně po merge se stejným výsledkem. Předmerge se soukromými vstupy281/0/0.

Experiment **28 PASS / 2 FAIL / 0 SKIP** z30, celý workflow **FAILURE**. Testy ani jejich očekávání nebyly měněné kvůli výsledku. Obě vady jsou jednotlivě shodné s aktuálním výchozím main a jeho CI, experimentální soubory nejsou v diffu:

1. `preview-match-reload-recovery.test.cjs:50`: preview při chybějícím Auth neodpojí zápas z editovatelné paměti, ačkoli má zachovat uložený stav.
2. `preview-match-reload-recovery.test.cjs:155`: preview predicate uzná zbytkové UID vlastníka bez autentizované identity.

Experimentální core není součástí produkčního načítání; obě neshody byly výslovně schválené jako nezměněné mimo produkci. Release a produkční job jsou úspěšné, nikoli celé CI.

## Skutečná veřejná produkce

[GitHub Pages41110008447](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41110008447): build/deploy/report success. Automatické nasazení nebylo ručně opakované.

URL: [Poolčítadlo](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/). Skutečně publikovaná **v4.51.108 RC**. Všech24 kontrolovaných veřejných souborů má HTTP200 a přesný SHA256 proti merge, včetně index.html, overlay.html, LivescoreReader a LivescoreRenderer. Index/overlay/reader/renderer byly ověřené i samostatnou URL obcházející cache.

Čistá nepřihlášená relace Chrome, desktop1440×1000 a mobilní viewport390×844:

- všech devět modulů načtených jednou, reader i renderer dostupné, žádný experimentální core ani fallback;
- navigace úvod/výsledky/Livescore/Federal Cup, pět vstupů a odchodů, 21 položek FC, prázdný Livescore a nulový indikátor mimo přehled;
- detail nedostupného zápasu a tři cykly rychlé otevření/zavření/přepnutí/znovuotevření bez starého zavření nového obsahu;
- žádné pageerror ani consoleerror; všechny Firebase/Auth a zápisové požadavky byly blokované a žádný takový pokus nenastal.

Anonymní relace neměla dostupný živý záznam. **Naplněný seznam/detail a kladný počet indikátoru tedy nejsou ověřením živé přihlášené produkce.** Jsou doložené následujícím odděleným izolačním testem. Nebyl vytvořen testovací zápas ani upravený produkční záznam.

## Izolovaně na publikovaném kódu

Stažené HTML, overlay a všech devět produkčních modulů byly ověřeny SHA256 a předány existujícím browserovým testům pomocí read-only source overlay. Firebase/Auth i identity jsou mockované. Nezměněné ostatní assety a writer odpovídají ověřené verzi merge.

- Reader8a desktop i mobil: tři souběžná čtení → jeden GET, indikátor2LIVE mimo přehled, deset navigačních/dialogových cyklů, přepnutí Alpha/Beta, zavření/změna účtu/opožděná odpověď, logout bez nového LIVE GET, stop bez vlastního intervalu/timeoutu/pending čtení. Cleanup pouze vlastních stale/ended záznamů proběhl výhradně nad mock daty.
- Renderer8b desktop i mobil: prázdný/plný seznam, 13 typových vstupů, dokončený/nedostupný detail, aktualizace otevřeného skóre, rychlé zavření/znovuotevření a přepínání, kladný indikátor mimo Livescore; **14 PNG před/po přesně shodných** s výchozím107. Shodné akce owner/jiný účet/anonym/admin; každá ze sedmi seznamových akcí vyvolá právě jeden testovací callback. Žádný produkční zápis není součástí této kontroly.
- Sto renderů bez růstu DOM a listenerů; renderer vlastní pět DOM click listenerů a pagehide, dispose je uvolní. Záměrně vložené texty stolu a race-to vytvoří nula HTML elementů místo dvou v původním main. ID a uživatelské texty se nevkládají jako JavaScript. 12 cílených unit testů skutečných modulů prošlo; jejich zdroj je byteově shodný s publikovanými moduly.
- Stream/OBS dva klienti, UID+matchId, outage/recovery, stará URL, konflikty a nulové převzetí cizím streamem PASS. Manuální i automatická obnova identity, strky/skóre/nastavení, POKRAČOVAT, jiný účet a offline režim PASS s mockovanými endpointy.
- Skutečné PNG1920×1080/PDF16:9 A1/A2/B, mobil DPR3, duplicate/error/retry/úklid dočasného DOM a URL lease PASS. Dvoulistové Pushout XLSX Singles/Doubles/Team desktop/mobil, hodnoty, názvy a stažení PASS. Žádné Firebase volání/zápis v exportních testech. PNG/PDF test byl spuštěn s přístupem ke standardní dočasné složce prohlížeče; dřívější omezení procesu a jeho srovnání s main zůstává popsáno v dokumentaci8b.

## Omezení a návrat

Živý Auth/Firebase Rules, naplněná soukromá produkční relace, fyzický iPhone/Safari a OBS zařízení nejsou ověřené. Mobil znamená Chrome viewport. Uživatelské zařízení turnajových oprav nebylo tímto ověřené; jejich izolované regrese byly doložené předmerge. Výkonové limity B/cache a původní cleanup GET→DELETE mezera bez ETag trvají. Renderer přidává při bootstrapu jeden JS asset, nikoli runtime polling nebo síťová čtení; přesun není vydávaný za optimalizaci.

Návrat: samostatné reverzní PR z čerstvého main, `git revert -m 1 d2ed8be97dfd124713b7e35c3ab986d74b237eca`, číslo nové verze podle aktuálního main/AGENTS, release gate a regrese, standardní Pages. Vracejí se společně původní render těla a bootstrap; modul8a zůstane v předchozí verzi. Bez reset/force push, importu, migrace nebo vracení dat. Úplná reverze by vrátila také neescapovaný text stolu/race-to, proto případně posoudit užší hotfix. Návrat nebyl potřebný.

Aktualizované PROJECT_STATUS, PROJECT_CONTEXT, REVIZE a roadmapa. [Sanitizovaná evidence](deployment-v4.51.108-verification.json), [hranice/testy8b](livescore-renderer-stage-8b.md). Místní raw logy/screenshoty: output/deploy108. Produkční data nebyla měněná ani migrovaná. Další část nebyla zahájená.
