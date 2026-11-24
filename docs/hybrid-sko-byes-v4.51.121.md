# Skupiny → SKO: pevné nasazení a volné losy

Zadavatel: Dominik. Datum: 24. 11. 2026. **v4.51.121 RC nasazeno a ověřeno v uvedeném rozsahu**, [deployment report](deployment-v4.51.121.md).

## Výchozí stav a reprodukce

Výchozí `origin/main`: `f3f513b8c6c14aaf5ccfa40c823bd25f3c4511a8`, produkce v4.51.120 RC. Čerstvý fetch při zahájení i před předáním; souběžné změny v main nebyly nalezeny. Jaroslavovo jednorázové streamované tempo v120 zůstává zachováno. PR #55 není součástí této opravy.

Izolovaný turnaj: jedna skupina A–G, každý s každým, všech sedm postupuje, pořadí podle výher 6–0. Stejné vstupy na main i kandidátu:

- Main vrací `A,G,B,F,C,E,D`, vytvoří AG/BF/CE a BYE pro D. Následující kolo znovu páruje aktivní seznam.
- Inline editor main má jen šest skutečných polí a potvrzení odmítne sedm postupujících. Samostatný dialog padá na `escapeHtml is not defined`.
- Kandidát umožní oba postupy skutečnými tlačítky a vytvoří DE/CF/BG s přímým postupem A do semifinále 1.

Původní diagnostika je lokálně v `output/seven-player-diagnostic/diagnostika.txt`. Baseline UI reproduktor používá přesný git zdroj uvedeného SHA, nikoliv dodatečně upravenou implementaci.

## Doplnění revize PR #68: více skupin

Regrese byla reprodukována na přesném `97eddf36aa8de65746f107999d3eeb34d31d8811`. Nový browserový reproduktor na tomto zdroji selže na očekávání „avoidable same-group rematch“. Po opravě tentýž scénář projde. Příčina: předchozí přechod na pevné seed rank pozice odstranil původní heuristiku oddělení skupin.

Tři skupiny × dva postupující, výkonnostní pořadí A1/B1/C1/A2/B2/C2:

| Zdroj | První hrané zápasy | BYE v úvodním kole |
| --- | --- | --- |
| main f3f513b | A1–C2; B1–A2; C1–B2 | žádný; původní chyba šestičlenného pavouka |
| PR 97eddf3 | A2–B2; C1–C2 | A1/B1, pevné opačné poloviny |
| Opravený PR #68 | **A2–C2; C1–B2** | **A1/B1 na stejných pozicích** |

Změní se jen dvě pozice, B2 a C2. Semifinále zůstávají pevná: **A1 proti vítězi A2–C2**, **vítěz C1–B2 proti B1**. Při výhrách výše nasazených se do finále dostanou A1/B1. Opačné pořadí zadání výsledků ani jiní vítězové nemění vazby.

`groupPlayoffFixedSeeds` zpracuje pouze automatický návrh více skupin. Startuje od standardních pevných pozic; BYE a jejich příjemci jsou neměnní. Zkouší výměny mezi dvěma skutečně hranými úvodními zápasy. Přijme jen výměnu, která **striktně sníží počet střetnutí stejné skupiny**. Mezi kandidáty porovnává v tomto pořadí: snížení rematchů, počet pozic změněných vůči standardu, součet posunů v pořadí nasazení, posuny postupně od nejvýše nasazeného a nakonec indexy pozic. Jde o deterministickou, nejméně rušivou lokální opravu; neslibuje globální minimum všech možných cen celého přelosování.

Počet rematchů v každém kroku klesá, takže cyklus nemůže nastat. Pokud zbývá dvojice XX a žádná výměna ji nedokáže rozdělit, každá jiná hraná dvojice již obsahuje X. V tom případě počet hráčů X převyšuje počet dostupných soupeřů a zbylé rematche jsou nevyhnutelné při zachování BYE. Jednotkové testy ověřují nezávislou dolní mez `max(0, největší skupina mezi skutečnými soupeři − počet úvodních zápasů)` na 80 různých rozděleních. Příklad A4/B1/C1 má po odečtení pevných BYE tři hráče A na dva zápasy, takže jeden rematch objektivně zbývá.

Tato ochrana se týká prvního kola pavouka se skutečnými zápasy, nikoliv zákazu střetnutí ve všech budoucích kolech. Další soupeři závisí na výsledcích. Ruční potvrzení organizátora je autoritativní, i když záměrně ponechá C1–C2. Samotný reload, staré `seedSlots`, staré pavouky bez markeru ani historické přehrání se automaticky neupravují. Nezavádí se žádné nové ukládané pole, protokol nebo změna DKO.

| Skupiny × postup | Opravené úvodní hrané dvojice | BYE |
| --- | --- | --- |
| 2 × 2 | A1–B2; A2–B1 | žádný |
| 2 × 3 | B2–A3; A2–B3 | A1/B1 |
| 3 × 2 | A2–C2; C1–B2 | A1/B1 |
| 3 × 4 | B3–C3; B2–C4; C2–A4; A3–B4 | A1/B1/C1/A2 |
| 4 × 2 | A1–D2; D1–A2; C1–B2; B1–C2 | žádný |

Jedna skupina 6/7/8 zůstává přesně podle níže uvedené původní tabulky. Přímé jednotkové testy ověřují oba směry výher a opačné pořadí zápisů ve všech pěti kombinacích. Nový browser `hybrid-sko-multigroup-browser.cjs` má 15 scénářů: každá kombinace na 1440/390/320 px, oba editory se záměrným standardním ručním pořadím, přepnutí na automatická pravidla, reload před a po prvním čtvrtfinále, všechna kola, finále, skutečné statistiky každého hráče a nulový vznik scoreboard zápasů. Existující `hybrid-sko-byes-browser.cjs` znovu prošel všech 15 scénářů jedné skupiny, včetně starých běžných a historických fixtures.

Screenshoty nového příkladu: [1440 px](screenshots/hybrid-sko-121-multigroup-1440.png), [390 px](screenshots/hybrid-sko-121-multigroup-390.png), [320 px](screenshots/hybrid-sko-121-multigroup-320.png).

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

Tabulka zachovává také dřívější ověření první části PR (97eddf3); aktuální doplnění má samostatné výsledky výše a explicitní selhání níže. PNG/PDF/XLSX regrese v této tabulce jsou z prvního předání, renderer ani exportní controller se nyní neměnily.

Veškeré browserové zápisy skončily výhradně v izolovaných mockách. Produkční Firebase, účty a zápasy nebyly změněny.

| Kontrola | Výsledek |
| --- | --- |
| Produkční Node na přesném main | 400 PASS, 0 FAIL, 0 SKIP |
| Produkční Node aktuálního kandidáta, včetně 13 testů tohoto PR | 413 PASS, 0 FAIL, 0 SKIP |
| Nový SKO browser: 4/5/6/7/8 × 1440/390/320 px | 15 scénářů PASS; skutečné založení, oba editory, odmítnutí duplicit, výsledky, reload a dokončení |
| Dodatečný finální sedmičlenný průchod | PASS na všech třech šířkách, včetně bezpečných jmen v obou editorech a mobilního posunu k semifinále |
| Liché groups → DKO | PASS 7 hráčů × tři šířky, inline/dialog/duplicita/reload, nezměněný DKO model |
| Historical structure browser | PASS: skupiny, SKO/BYE, opravy výsledků, bronz, DKO, hybridy, více skupin, body, ETag a reload |
| Ordinary tournament create browser | Původní běh 97eddf3 PASS; aktuální běh **FAIL :508 shodně s main**, viz níže. Původně ověřeno: SKO/DKO/hybrid/skupiny/Swiss, různé režimy nasazení, quota/denied storage, A→B→A, opuštění neověřeného pokusu |
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

Testovaný produkční `index.html` SHA-256: `62c72135fd01aa06fb53b726f99769bf7de3d85197d4fcce2f4cc2a76067b436`. Git baseline SHA-256 odpovídá původní diagnostice; při přípravě testovacího archivu byl použit přesný git blob (bez převodu LF→CRLF, který jinak mění chování textového testu hesla).

### Selhání evidovaná odděleně

- Experimentální sada: **28 PASS / 2 FAIL** na main i kandidátu, nezměněné testy i `test-modular/assets/js/pool-core.js`. První vada: při dočasně nedostupné identitě experimentální recovery neodpojí aktuální zápas od editace (`discardForeignLocalActiveMatch` vrátí `false` místo `true`); požadovaná uložená recovery data se přitom mají zachovat. Test končí na tomto prvním porušeném očekávání, neprokazuje smazání uloženého zápasu. Druhá: stale UID bez autentizace nesprávně opravňuje uloženého vlastníka (`true` místo `false`). Experimentální core není produkční implementace a jeho vady se touto opravou nemění ani neskrývají.
- Historický audit odstraněného žurnálu: **0 PASS / 2 FAIL**, pouze starý fixture `213f87f`; chybně vydává GET shodu za ověření operace a špatně zachází s nejasným zápisem. Není součástí produkční ani experimentální sady.
- `federal-cup-browser.cjs`: na kandidátu **i baseline** projde prvních osm skupin scénářů, pak selže na řádku 198 při kliknutí na skryté `streamLagP1`. Test očekává další změnu vítěze po prvním kliknutí, zatímco schválená v120 celý panel po volbě skryje. V tomto PR nebyl test ani stream změněn. Odpovídající současný `stream-lag-browser.cjs` prošel. Zbytek souhrnného FC browseru za touto chybou nebyl tímto během proveden; samostatné quick-finish a reportové/exportní regrese prošly.

- Nově zaznamenané samostatné selhání `ordinary-tournament-create-browser.cjs:508`: při zpožděné odpovědi A a čekajícím vytvoření B je v místním seznamu již cloudový turnaj A, kde test očekává prázdný seznam. **Stejná chyba byla reprodukována na přesném main f3f513b i kandidátu**, po úspěšných předchozích částech včetně quota a opuštění pokusu. Není vyřešena ani vydávána za PASS; tento PR nemění tuto ukládací cestu.
- `federal-viewer-browser.cjs:17`: **7 GET místo očekávaného 1**, identicky na přesném main i kandidátu. Jde o nově zachycené selhání staršího izolovaného browseru, nikoliv prokázanou novou regresi této opravy. V tomto PR se neřeší a není započítáno mezi PASS.
- První streamový CI timeout na commitu 97eddf3 (ř.103, ověření spojení) a jeho úspěšný druhý pokus zůstávají v [Actions 45357248049](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45357248049). Při lokální revizi více skupin byl navíc zachycen timeout na stejném řádku a v dalším běhu závod testu s prvním publikováním SOON (ř.65, ještě neexistující payload), který byl následně stejně reprodukován i na přesném main. Výsledky těchto běhů se neskrývají; streamové zdroje a testy zde nebyly měněny.

GitHub CI se vykazuje zvlášť v PR: lokální úspěch není důkaz výsledku GitHub Actions a celé CI nelze označit za zelené při experimentálních selháních.

### Příkazy

```powershell
node scripts/check-release.cjs --base origin/main
node scripts/run-tests.cjs production
node tests/hybrid-sko-byes-browser.cjs
node tests/hybrid-sko-multigroup-browser.cjs
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

## Závěrečná kosmetická revize a schválení vydání

Dominik schválil nasazení po závěrečných kontrolách. Diff proti 805ab365 mění v aplikaci pouze čtyři viditelné texty: fallback náhledu ručního přímého KO, označení volného losu v ručních hybridních editorech, v detailu SKO a v modálním pavouku. Všude je nyní VOLNÝ LOS. Technické názvy, datový model, počet účastníků, napojení kol, algoritmus rematchů a staré záznamy se nemění. Browserové testy nově kontrolují absenci anglického slova v obou editorech, detailu a pavouku nových i uložených starších turnajů na 1440/390/320 px. Nasazení bylo dokončeno a výsledek je v [deployment reportu v121](deployment-v4.51.121.md).

Závěrečný běh zachytil výjimku pouze ve vloženém diagnostickém `byeProbe.snapshot`: Firebase vynechá prázdné `eliminatedIds`, ale diagnostika volala `.includes` bez výchozího prázdného pole. Pomocné čtení nyní považuje chybějící prázdné pole za žádné vyřazení; nemutuje aplikaci, neovlivňuje sportovní výpočty a nesnižuje žádné očekávání výsledků, reloadu či statistik. Celý hybridní browser byl znovu spuštěn.
