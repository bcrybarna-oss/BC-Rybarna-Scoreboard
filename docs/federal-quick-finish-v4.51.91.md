# Federal Cup – rychlé dokončení a zobrazení statistik v4.51.91 RC

Zadavatel **Dominik**, 23. 10. 2026. Nová opravná větev `fix/federal-quick-finish-evidence` z aktuálního main 3bdc844. Produkce zůstává v4.51.90 RC. **Neslučovat a nenasazovat.**

## Příčina a diagnostika

Na původním main 3bdc844 znovu přehrán izolovaný syntetický Singles: soupeřův dry break a DOHRÁVKA. Výsledek: 9 doložených koulí, úspěšnost 0/0 partial s důvody `unknown_attempts,unknown_intent`. Původní `actionRunout` a `actionBreakAndRun` zapisovaly `inferred_pots`, `strokeCount:null`, odvozené počty koulí bez počtu potápěcích strků. Agregace tyto neznámé pokusy správně nepovažovala za oficiální procento; problém byl ve významu nově zaznamenané rychlé akce. Naproti tomu DOHRÁT už používalo `pot` + `sequential_batch`.

Originální dokončené produkční zápasy Doubles #2 / Team #1 nebyly načteny a neanalyzovaly se. Uvedené původní hodnoty 27/27 vs. 28 a 26/27 vs. 37 proto nejsou vydávány za přesně zrekonstruovaná data. Popsaný rozdíl vzniká, když se smísí explicitní pokusy s dalšími inferred poty bez počtu strků. Jiné legitimní důvody partial (neznámé koule, korekce, chybějící nominace či neúplné staré záznamy) se nadále nezakrývají.

## Změna zápisu nových akcí

- Sdílený `knownQuickRackBalls` přijme pouze explicitně známý stůl (`tableKnown===true`) a platný neprázdný seznam 9/10-ball bez duplicit a s herní koulí. Nevychází pouze z příznaku safeInference: ten může být vypnut po vráceném push outu, i když je aktuální poloha zbývajících koulí známá.
- `recordQuickRackCompletion` zapisuje jeden kanonický batch `pot`, `entry:sequential_batch`, se seznamem zbývajících koulí a jedním úspěšným pokusem na každou. `federalShotEvidence` odvodí intent=pot, pottingAttempts=successfulPottingStrokes=počet koulí a potsEvidence=explicit. Počty regularPottedBalls se přičtou jednou a zbývající stůl se vyprázdní.
- ČISTÁ HRA a DOHRÁVKA používají stejnou evidenci, ale ponechávají vlastní oprávněnost a právě jednu původní klasifikaci B&R / dohrávka a výhru racku. Helper sám rack nevyhrává.
- DOHRÁT ponechává dosavadní `processSequentialCleanShots`, nyní bez domýšlení plného stolu při neznámé evidenci. Unknown dokončení má neznámé počty pokusů/potů, žádné vymyšlené koule a skutečně partial hodnoty; rackový výsledek je oddělený od znalosti strků.
- V Team zůstává actor skutečně zvolený hráč; Doubles actor=null a statistiky patří dvojici. Ruční multipot zůstává jedním strkem a MISS jedním neúspěšným pokusem. Nárok na rychlé dokončení se po neoprávněné akci neobnovuje.
- Výpočetní match/season API, 13 metrik a agregace jsou bajtově stejné jako main. Žádné migrace, automatické opravy či přepočítávání dokončených zápasů. Nový předpoklad se uplatní až při novém kliknutí.

## Jednotné reporty

Společný formatter A1/A2/B: úplný nulový poměr `0 / 0` bez 0% sloupce; úplné procento `100 %`; skutečné partial `27 / 27*` / `28*` bez oficiálního procenta a sloupce; unknown `—`. Bez Doloženo, (část), bez pokusů v hodnotách. Karty osobních výsledků mají také krátkou hvězdičku, podrobné důvody zůstávají v nápovědě. Patička vysvětluje `* Neúplná evidence`.

A1 Doubles používá dvě stabilní řádky nominovaných osob: první jméno, druhé `+ jméno`. Celé jméno se nezalamuje; společná velikost písma se zmenšuje podle prostoru. Velmi dlouhé jméno mimo bezpečný rozsah vyvolá srozumitelnou chybu exportu, nikoli oříznutí. SVG skóre, lomené panely, vlajky, branding, pozadí a všech 13 schválených názvů zůstávají.

## Reprodukce a testy

- `node --test tests/*.test.cjs`: 189/191, pouze známé dvě chyby preview-match-reload-recovery.test.cjs:50,106 v test-modular. Nový test formatteru a aktualizované kontroly verze; žádná nová regrese.
- `node tests/federal-quick-finish-browser.cjs`: suffixy 1–9, vlastní úspěšný break/čistá, dry break/dohrávka, break foul a vrácený push out, unknown stav, skutečný multipot/MISS a zachovaná oprávněnost, Singles/Doubles/Team a Team actor, právě jeden rack/klasifikace, UNDO/save/reload PASS.
- `FC_QUICK_SOURCE_REF=3bdc844` nad stejným browserem reprodukuje původních 9 koulí a 0/0 partial na syntetických datech. Není to čtení produkčních zápasů.
- Pro ukázky nastav `FC_QUICK_FIXTURE_FILE` na `tmp/quick91-cases.json` a spusť quick-finish browser; pak `node tests/federal-quick-report-exports-browser.cjs` s lokálními PDF knihovnami. Case exporty ověřují A1 Singles/Doubles/Team, A2 a B: 9 koulí / 9 pokusů / 100 %, 0/0, partial* a nulový partial sloupec, dlouhá česká/slovenská jména, mobil a skutečné PNG/PDF.
- Obecný report/export browser a report UI, Federal Cup, detailed-counter, stream-controls, federal-lineup a release-version regrese PASS včetně závěrečné exportní kontroly krátkých partial hodnot. Čtyři další unit testy přímé kanonické evidence pokrývají suffixy1–9, unknown/neplatné tabulky, neměnnost starých záznamů a Team/Doubles actor.
- Všechny požadavky izolované v paměti, žádné produkční Auth/Firebase zápisy. Původní známé testy zůstaly beze změny; CI není plně zelené.

## Ukázky

Snímky pocházejí ze skutečné rychlé akce v izolovaném browseru. Jednorackový snapshot je pro vizualizaci označen jako dokončený a dostal syntetická česká/slovenská jména při zachování ID; nejde o skutečný soutěžní zápas ani záznam původních produkčních potíží.

| Report | PNG 1920×1080 | PDF 16:9 |
| --- | --- | --- |
| A1 Team | [Team](screenshots/federal-91-team.png) | [PDF](examples/federal-91-team.pdf) |
| A1 Doubles | [Doubles](screenshots/federal-91-doubles.png) | [PDF](examples/federal-91-doubles.pdf) |
| B hráč | [Hráč](screenshots/federal-91-player.png) | [PDF](examples/federal-91-player.pdf) |

Pypdf ověřil u všech tří jednu stránku 1440×810 pt a vložené pixely přesně shodné s PNG. Všechny tři PNG vizuálně zkontrolovány. Drobné odlišnosti vyhlazování HTML náhledu a canvasu zůstávají.

Lokálně otestováno, připraveno k samostatnému PR; release gate proti main3bdc844 a diff --check PASS; CI bude doplněno po pushi. Produkce 90 beze změny. Skutečné původní cloudové záznamy, produkční přihlášení, fyzický iPhone/iOS a reálné OBS neověřeny. Uživatel po revizi znovu ručně zadá své testovací zápasy; historická evidence se automaticky nepřepisuje.
