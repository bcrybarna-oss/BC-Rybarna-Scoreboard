# Skupiny → SKO: pevné nasazení a volné losy

Zadavatel: Dominik. Datum: 24. 11. 2026. Kandidát **v4.51.121 RC**, zatím nesloučený a nenasazený.

## Výchozí stav a reprodukce

Výchozí `origin/main`: `f3f513b8c6c14aaf5ccfa40c823bd25f3c4511a8`, produkce v4.51.120 RC. Čerstvý fetch při zahájení i před předáním; souběžné změny v main nebyly nalezeny. Jaroslavovo jednorázové streamované tempo v120 zůstává zachováno. PR #55 není součástí této opravy.

Izolovaný turnaj: jedna skupina A–G, každý s každým, všech sedm postupuje, pořadí podle výher 6–0. Stejné vstupy na main i kandidátu:

- Main vrací `A,G,B,F,C,E,D`, vytvoří AG/BF/CE a BYE pro D. Následující kolo znovu páruje aktivní seznam.
- Inline editor main má jen šest skutečných polí a potvrzení odmítne sedm postupujících. Samostatný dialog padá na `escapeHtml is not defined`.
- Kandidát umožní oba postupy skutečnými tlačítky a vytvoří DE/CF/BG s přímým postupem A do semifinále 1.

Původní diagnostika je lokálně v `output/seven-player-diagnostic/diagnostika.txt`. Baseline UI reproduktor používá přesný git zdroj uvedeného SHA, nikoliv dodatečně upravenou implementaci.

## Algoritmus a datová hranice

Pouze nové play-off `groups_sko` ukládá `ko.seedSlots`: pozice nejbližší vyšší mocniny dvou, prázdná pozice je BYE. Skutečné zápasy a záznamy BYE mají `slot` v daném kole. `participantIds` nadále obsahuje jen skutečné hráče. Další kolo používá vítěze konkrétních větví, nikoliv aktuální pořadí aktivních hráčů.

| Postupujících | Osm pozic v pořadí pavouka | Skutečná čtvrtfinále | BYE |
| --- | --- | --- | --- |
| 6 | A, BYE, D, E, C, F, B, BYE | D–E; C–F | A a B v opačných polovinách |
| 7 | A, BYE, D, E, C, F, B, G | D–E; C–F; B–G | A |
| 8 | A, H, D, E, C, F, B, G | A–H; D–E; C–F; B–G | žádný |

Při výhrách lépe nasazených vzniká u 6/7/8 semifinalová dvojice A–D a C–B, finále A–B. Při jiných vítězích DE/CF/BG je u sedmi například A–E a F–G. Opačné pořadí dokončení čtvrtfinále dává stejné dvojice. Osm hráčů s výslovně potvrzeným ručním `cross13` nebo `cross14` zachovává právě toto napojení; výchozí standard je `adjacent`.

Firebase vynechává prázdné koncové pozice. Kapacita se proto odvozuje z počtu skutečných účastníků, nikoliv ze zkrácené délky uloženého pole. Test šesti hráčů záměrně odstraní poslední null a ověří zachování všech osmi pozic i návazností.

Budoucí semifinále a finále jsou pouze prezentační náhled: známý A a například „Vítěz čtvrtfinále 2“. Nejsou to uložené zápasy ani předčasně potvrzení vítězové. Nevytvářejí herní akce, skóre nebo statistiky.

## Editory a kompatibilita

Oba editory používají společnou bezpečně escapovanou prezentaci. Obsahují všech N skutečných hráčských polí a viditelné prázdné pozice. Změna výběru ihned upraví text, kdo získává BYE. Potvrzené ruční pořadí se nepřehazuje. Duplicitní výběr odmítnou oba existující validátory. Dialog již nepoužívá neexistující `escapeHtml`, ale zavedené `esc`.

Sdílený editor pro `groups_dko` umí lichý počet; vlastní DKO generátor ani sportovní pravidla se nemění. Žádné změny Auth, Rules, streamu, cache, zápisových protokolů nebo modularizace 10b1/10b2.

Pavouky bez `seedSlots` zůstávají na původním algoritmu. Samotné načtení, render nebo reload metadata nedoplňuje. Při přepočtu historického turnaje je původní uložený pavouk rozhodující pro volbu staré cesty. Staré nasazení, rozehrané zápasy, BYE a finální umístění se automaticky nemigrují.

Fixtures `hybrid-sko-legacy.json` a `hybrid-sko-legacy-historical.json` jsou syntetické záznamy vytvořené skutečným baseline kódem, nikoliv produkční exporty. První obsahuje nasazený, částečně odehraný a dokončený běžný hybrid; druhý nasazený a částečně odehraný historický hybrid. Candidate ověřuje nezměněné větve, výsledky, statistiky a umístění; historická kontrola přímo prochází `historicalReplay`.

## Ověření

Veškeré browserové zápisy skončily výhradně v izolovaných mockách. Produkční Firebase, účty a zápasy nebyly změněny.

| Kontrola | Výsledek |
| --- | --- |
| Produkční Node na přesném main | 400 PASS, 0 FAIL, 0 SKIP |
| Produkční Node kandidáta, včetně šesti nových testů | 406 PASS, 0 FAIL, 0 SKIP |
| Nový SKO browser: 4/5/6/7/8 × 1440/390/320 px | 15 scénářů PASS; skutečné založení, oba editory, odmítnutí duplicit, výsledky, reload a dokončení |
| Dodatečný finální sedmičlenný průchod | PASS na všech třech šířkách, včetně bezpečných jmen v obou editorech a mobilního posunu k semifinále |
| Liché groups → DKO | PASS 7 hráčů × tři šířky, inline/dialog/duplicita/reload, nezměněný DKO model |
| Historical structure browser | PASS: skupiny, SKO/BYE, opravy výsledků, bronz, DKO, hybridy, více skupin, body, ETag a reload |
| Ordinary tournament create browser | PASS: SKO/DKO/hybrid/skupiny/Swiss, různé režimy nasazení, quota/denied storage, A→B→A, opuštění neověřeného pokusu |
| Tournament setup browser | PASS na reálném archivu pouze v paměti: běžný/historický, plné úložiště, fáze 8-ball/3 a 10-ball/7, skutečně založené zápasy, izolace Federal Cupu |
| Production recovery browser | PASS: opožděná identita, stale UID, jiný vlastník, pokračování, skóre/undo, pozastavené hodiny |
| Match read session browser (D4) | PASS desktop/mobil, stale publish/repair reproduktor i ochrany aktuální implementace |
| Other disciplines mobile layout | PASS osm variant, včetně Ghost a detailního počítadla |
| Solo 14.1 mobile layout / standalone mobile preview | 3/3 PASS; preview PASS, bez JS chyb |
| Stream lag browser v120 | PASS 8/9/10 × jednoduché/rozšířené, UNDO/reload, střídání/vítěz rozstřelu, 14.1 beze změny |
| Federal quick finish browser | PASS kanonické strky/pokusy, Team/Singles/Doubles, undo/save/reload |
| Federal report exports browser | PASS skutečná PNG 1920×1080 a PDF 16:9 A1/A2/B, desktop/mobil, chyby/retry, žádné Firebase zápisy |
| Federal Pushout browser | PASS skutečná XLSX Singles/Doubles/Team, desktop/mobil, bezpečné názvy, duplicitní kliknutí, nezměněný exportní zdroj |

BYE není zápas: u sedmi hráčů existuje přesně šest skutečných play-off zápasů. A má šest skupinových a dvě play-off výhry, tedy osm zápasů/osm výher, nikoliv devět. BYE neobsahuje skóre ani vítězný strk; nevzniká žádný nový scoreboard zápas nebo osobní herní evidence. Jednotkové testy počtů 2–17 navíc dokončí N−1 skutečných zápasů bez pozdějšího BYE.

Testovaný produkční `index.html` SHA-256: `7f83bca87c417f6ea0b1641c091d6c5faa8dfedf53e71509dfd3b045ddc68943`. Git baseline SHA-256 odpovídá původní diagnostice; při přípravě testovacího archivu byl použit přesný git blob (bez převodu LF→CRLF, který jinak mění chování textového testu hesla).

### Selhání evidovaná odděleně

- Experimentální sada: **28 PASS / 2 FAIL** na main i kandidátu, nezměněné testy i `test-modular/assets/js/pool-core.js`. První vada: při dočasně nedostupné identitě experimentální recovery neodpojí aktuální zápas od editace (`discardForeignLocalActiveMatch` vrátí `false` místo `true`); požadovaná uložená recovery data se přitom mají zachovat. Test končí na tomto prvním porušeném očekávání, neprokazuje smazání uloženého zápasu. Druhá: stale UID bez autentizace nesprávně opravňuje uloženého vlastníka (`true` místo `false`). Experimentální core není produkční implementace a jeho vady se touto opravou nemění ani neskrývají.
- Historický audit odstraněného žurnálu: **0 PASS / 2 FAIL**, pouze starý fixture `213f87f`; chybně vydává GET shodu za ověření operace a špatně zachází s nejasným zápisem. Není součástí produkční ani experimentální sady.
- `federal-cup-browser.cjs`: na kandidátu **i baseline** projde prvních osm skupin scénářů, pak selže na řádku 198 při kliknutí na skryté `streamLagP1`. Test očekává další změnu vítěze po prvním kliknutí, zatímco schválená v120 celý panel po volbě skryje. V tomto PR nebyl test ani stream změněn. Odpovídající současný `stream-lag-browser.cjs` prošel. Zbytek souhrnného FC browseru za touto chybou nebyl tímto během proveden; samostatné quick-finish a reportové/exportní regrese prošly.

GitHub CI se vykazuje zvlášť v PR: lokální úspěch není důkaz výsledku GitHub Actions a celé CI nelze označit za zelené při experimentálních selháních.

### Příkazy

```powershell
node scripts/check-release.cjs --base origin/main
node scripts/run-tests.cjs production
node tests/hybrid-sko-byes-browser.cjs
$env:HYBRID_FORMAT='groups_dko'; $env:HYBRID_COUNTS='7'
node tests/hybrid-sko-byes-browser.cjs
Remove-Item Env:HYBRID_FORMAT,Env:HYBRID_COUNTS
node tests/historical-structure-browser.cjs
node tests/ordinary-tournament-create-browser.cjs
node scripts/run-tests.cjs experimental
node --test tests/audits/challenge-journal-regressions.cjs
```

Browserové testy vyžadují Playwright a místní Chrome. Exportní testy používají `PDF_LIB_DIR` s html2canvas 1.4.1 a jsPDF 2.5.2; Pushout a některé archivní testy vyžadují výslovně zadané místní exporty přes své existující proměnné. Soukromé exporty nejsou součástí commitu ani screenshotů.

## Screenshoty

Všechny obrázky používají izolované A–G, nikoliv skutečné hráče. „Před“ je v120 vykreslená po vytvoření starého pavouka diagnostickým voláním (běžný UI postup je na baseline blokovaný). „Po“ je v121 po skutečných uživatelských krocích obou editorů. Jde o nasazení **do pavouka**, nikoliv produkční deployment.

| Šířka | Před opravou | Po opravě |
| --- | --- | --- |
| Desktop 1440 | [D má chybně BYE](screenshots/hybrid-sko-121-before-1440.png) | [A a známá semifinálová větev](screenshots/hybrid-sko-121-after-1440.png) |
| Mobil 390 | [Původní pavouk](screenshots/hybrid-sko-121-before-390.png) | [BYE a přímý postup](screenshots/hybrid-sko-121-after-390.png), [posun na semifinále](screenshots/hybrid-sko-121-semifinal-390.png) |
| Mobil 320 | [Původní pavouk](screenshots/hybrid-sko-121-before-320.png) | [BYE a přímý postup](screenshots/hybrid-sko-121-after-320.png), [posun na semifinále](screenshots/hybrid-sko-121-semifinal-320.png) |

## Omezení a návrat

Živé Auth/Rules a fyzický iPhone/Android nejsou ověřeny. Desktop a mobil jsou izolované Chrome viewporty. Staré chybné nasazení zůstává záměrně zachováno; oprava nepřelosovává historii.

Návrat aplikační změny: nový opravný PR s reverzí tohoto vydání a novým číslem podle tehdejšího main, release gate a dotčené regrese; žádné vracení databáze, mazání turnajů nebo přepisování výsledků. Revert by zároveň vrátil původní chybu nového nasazování. Po případném nasazení v121 je před návratem nutné zohlednit nové rozpracované historické pavouky: starý `historicalReplay` neumí nové pevné pozice. Do kompatibilního opravného vydání je nepřegenerovávat starým kódem; bezpečnější je cílená dopředná oprava. Uložená data se kvůli návratu nemigrují.
