# Testy: produkce, experiment a co výsledky znamenají

Platné od etapy6 (29.10.2026). Autoritativní produkce je **kořenový index.html + jeho pět asset modulů + overlay.html a současný Pushout writer**. test-modular je samostatná starší experimentální implementace. Ani zelený experiment nepotvrzuje produkci; zelené Node testy nenahrazují browserové scénáře nebo Firebase Rules.

## Příkazy a úplný inventář

- `npm test` / `node scripts/run-tests.cjs all`: **všechny** kořenové `tests/*.test.cjs`, žádný fail není ignorovaný. Selhání experimentu znamená nenulový exit i tady.
- `npm run test:production`: produkční funkce/module API, statické kontroly produkčního HTML a release/test tooling. Očekávání jsou nezávislé referenční hodnoty; VM načítá skutečná těla produkčních funkcí. I/O a DOM helpery ve VM jsou mocky, ne ověření celé obrazovky.
- `npm run test:experimental`: všech šest souborů explicitně registrovaných v `tests/suites.cjs`; skutečně čtou starý test-modular. Nejde o karanténu vypnutých testů.
- `node scripts/run-tests.cjs --list`: aktuální úplný inventář souborů podle sad. Registry eviduje jen experimentální členství; produkce je úplný zbytek, bez přesunu souborů. Chybějící/duplicitní nebo nezařazený preview soubor je chyba runneru, nikoli skip.

CI má samostatné **Release version and revision**, **Production Node tests** a **Experimental test-modular contracts**. Obě testové sady běží jako normální joby; žádné continue-on-error, filtrování konkrétního failu ani allow_failure. Celý workflow je červený, pokud selže kterákoli sada. Názvy jobů samy nepřepínají GitHub branch protection; nastavení oprávnění/ochrany repozitáře se v této etapě nemění. Produkční zelený job není souhlas k nasazení při nevyřešeném jiném jobu.

Výchozí šest experimentálních souborů (cesty se nezměnily):

| Soubor v tests/ | Zdroj a záruka / omezení |
|---|---|
| preview-141-shotclock.test.cjs | Experimentální DOM a core, statické kontrakty a helpery14.1. Neověřuje root počítadlo. |
| preview-shotclock-time-foul.test.cjs | Experimentální časový faul, VM stav14.1. Nejde o produkční clock engine. |
| preview-real-auth.test.cjs | Oddělená URL, CSP a mock datové části, konfigurační/izolované Auth flow kontrakty. Žádné živé produkční Auth v Node. |
| preview-tournament-141-regression.test.cjs | Experimentální turnaje/14.1, nikoli produkční oprava101. |
| preview-tournament-recovery.test.cjs | Experimentální merge/recovery z disku při prázdném mocku, další preview UI assertions. |
| preview-match-reload-recovery.test.cjs | Skutečné preview recovery funkce a nyní skutečné manuální/automatické login entrypoints s async loadery, match-first i tournament fallback; žádný regex místo chování. Dva skutečné kontrakty aktuálně selhávají. |

## Produkční vrstvy a jejich záruky

1. Přímo importované `assets/js/federal-statistics.js`, cloud-refresh.js, own-reports.js, federal-viewer.js a admin-reports.js: čisté výsledky, vlastníci prostředků, autentizační epochy, sdílení a úklid. Toto je stejný produkční soubor, žádný fallback na preview.
2. Testy nad root index.html (včetně production-match-reload-recovery): actual source functions ve VM, nezávislé výsledky a mockované transporty. Nové produkční scénáře ověřují pending identity a zachování všech lokálních snímků, stale UID, skutečné login orchestrace, explicitní resume správnému vlastníkovi, plný stav/undo/paused clock a odmítnutí jiného účtu.
3. Statické smoke/release/test-inventory: konzistence verzí, pořadí/závislosti, syntaxe, scope a cesty. Nejsou behaviorálním důkazem skórování nebo loginu. release-policy používá text test-modular jen jako fixture cesty, která není produkčním vydáním; test-suites ověřuje registry, nespouští preview z produkční sady.
4. Produkční browserové scénáře (`node tests/*-browser.cjs`, jednotlivě dle účelu): actual rootHTML/assety v Chrome, všechny síťové požadavky zachyceny testem, syntetická data či soukromý export jen vRAM. Tato sada není automaticky součástí Node CI. Relevantní výběr pro etapu6: production-recovery-browser, federal-evidence-browser, stream-controls-browser, tournament-setup-browser, federal-module-browser, federal-pushout-browser a federal-93-presentation-browser. Vyžadují Playwright/Chrome a pro původní exportní regresi připnuté lokální knihovny. PDF se jen kontroluje jako zachovaná funkce, neodstraňuje/optimalizuje.
5. Dobrovolné soukromé paritní kontroly: tři existující Node testy vyžadují FC_FIXTURE9_BACKUP a FC_RELINK_BACKUP (24.10.(1)/(2), plus samostatný BEFORE ve stejné složce). Bez nich zůstanou **3 skutečné SKIP**, nikoli nula ani PASS. V CI nejsou soukromé soubory a nesmějí se tam nahrávat; lokálně se ověří s původními exporty bez změny. Jejich názvy a podmínky jsou v testech federal-fixture-link-plan a federal-linked-ordinary.

## Aktuální skutečný výsledek etapy6

- Produkce:261 testů; lokálně se soukromými vstupy261PASS/0FAIL/0SKIP, bez nich258PASS/0FAIL/3SKIP.
- Experiment:30 testů,28PASS/**2FAIL**/0SKIP. První fail je původní odpojení pending pointeru. Druhý je **nově přidaný důkaz latentního přijetí stale UID bez Auth**, nikoli původní regex a nikoli nová změna experimentálního jádra. Jádro zůstává beze změny.
- Celek:291 testů, lokálně289PASS/2FAIL/0SKIP; bez soukromých vstupů286PASS/2FAIL/3SKIP. Souhrnný exit=1. Neexistuje automatická výjimka „dvě známé chyby“.
- Původní regex fail byl odstraněn jako kontrola textu a nahrazen čtyřmi procházejícími behaviorálními scénáři: manual/automatic × match exists/tournament fallback. Assert pořadí obsahuje i skutečný okamžik navigace a zpožděné loadery.

Podrobné před/po, kontrakt a samostatná produkční oprava: [stage-6-test-contracts.md](stage-6-test-contracts.md). [Aktuální roadmapa](modularization-roadmap.md).
