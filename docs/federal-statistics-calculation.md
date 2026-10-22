# Federal Cup – výpočet 11 statistik, etapa 2 (v4.51.88 RC)

Historie původní přípravy (21. 10. 2026), zadavatel Dominik: samostatná větev `feature/federal-statistics-calculation` z aktuálního main `090330ac6a4e86a78bffdd824cabb8fb12db0056`. Připraveno v [PR #22](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/22), nesloučeno a nenasazeno; produkce zůstává v4.51.84 RC. Bez nové obrazovky, veřejného zobrazení statistik, grafického reportu, PDF, migrace nebo změny Rules.

Aktualizace Dominik, 22. 10. 2026: původní větev PR #22 aktualizována merge z origin/main ed45d3794aff0e403bdd77dc720462c3f1fa8c89 (produkce v4.51.87 RC); historie i všechny streamovací změny PR #24–26 zachovány. Kandidát v4.51.88 RC zůstává ve stejném PR, nesloučen a nenasazen. Opraveny všechny tři reprodukce revize work/review22/REPORT.md. Původní výchozí stav a ověření níže jsou historické; aktuální stav viz PROJECT_STATUS.md.

## Interní API v produkčním index.html

- `federalCalculateMatch(match)` vrací `{version:1, year, fixtureNo, matchId, type, sides, individuals, pairs, unattributed}`. `sides[0]` je Slovensko, `sides[1]` Česko. Každá položka má `owner` a `metrics` se stejnými 11 klíči. Výsledek Singles patří stabilnímu účastníkovi, Doubles dvojici, Team reprezentaci.
- `federalCalculateSeason(matches, config, year=2026)` vrací `{version:1, year, teams, individuals, pairs, fixtures, duplicates, unattributed}`. Vstup může být pole i objekt vrácený RTDB. `config` je konfigurace konkrétního ročníku včetně `year` a `teamResults`.
- `federalStatsSide`, `federalStatsOwner`, `federalMergeMetrics` a validační pomocné funkce tvoří společný výpočetní systém. Nevolají původní zaokrouhlující prezentační `breakStats` ani neupravují jeho stávající zobrazení. `federalEvidenceSummary` z etapy 1 zůstává kompatibilní.

Funkce jsou interní deklarace ve stávajícím index.html, nikoli nová modularizovaná kopie. Nečtou globální `data`/`match`, hodiny, localStorage ani Firebase; nemění vstupy. Testy extrahují právě tento blok z aktuálního index.html, bez dostupného síťového či úložného API. Browser navíc ověřuje výpočet s dočasně zakázaným fetch a nezměněná data.

## Kontrakt jedné metriky

```json
{"kind":"percent","numerator":5,"denominator":7,"count":null,"value":71.42857142857143,"coverage":"complete","reasons":[],"components":{}}
```

`kind` je `count | percent | average | ratio`. `numerator` a `denominator` jsou nezaokrouhlené známé čitatele/jmenovatele; u počtu je jmenovatel null a `count` obsahuje známý počet. `value` je dostupná pouze při `coverage: complete`; procento je v rozsahu jednotek procent, poměr je numerická hodnota X/Y. Žádné ořezání na 0–100 ani oprava nekonzistentních vstupů. Pro částečný výsledek jsou čísla pouze doložené mezisoučty, nikoli přesný celkový výkon. Budoucí UI musí rozhodovat podle `value`/`coverage`, nesmí vydávat `count` nebo mezisoučet za úplný výsledek.

- `complete`: všechny podklady konkrétní metriky jsou doloženy. Počet 0 je skutečná nula. Při jmenovateli 0 je `value:null`, `coverage:complete`, důvod `zero_denominator` – nikoli 0 %.
- `partial`: existuje známá část, ale chybí podklady nebo je zjištěn rozpor. `value:null`, mezisoučty zůstávají. Příklad: 4 známé break koule / všechny 4 breaky při sledování jen 3 breaků není přesný průměr 1.
- `unknown`: potřebný čitatel/počet nelze určit. Chybějící counter není nula. Samotný ruční výsledek dává neznámé metriky, ne 11 nul.

`reasons` obsahuje seřazené strojové kódy, např. `legacy_coverage`, `missing_counter`, `invalid_counter`, `break_record_gap`, `untracked_break_balls`, `incomplete_rack_history`, `unknown_attempts`, `unknown_intent`, `unsafe_derivation`, `unassigned_correction`, `duplicate_record`, `actor_rack_conflict`. `components` u koulí odděluje známé `explicit`/`derived`, u break průměru `trackedBreaks`; jejich 0 znamená nulový známý příspěvek, nikoli důkaz úplné chybějící historie.

## Vzorce a zdroje všech 11 ukazatelů

| Klíč | Ukazatel a vzorec | Autoritativní zdroj / kontrola |
|---|---|---|
| breakSuccess | Úspěšné breaky / všechny provedené breaky × 100 | `stats.breaks - dryBreaks - softBreaks + softDryBreaks - breakFouls`; platnost čítačů a shoda počtu kanonických break záznamů. Eso je úspěšný break. |
| breakBallAverage | Skutečně spadlé break koule / všechny provedené breaky | `breakPottedBalls / breaks`, nikoli `/ breakPottedTracked`. Zahrnuje soft/foul a následně spotované koule. Kontrola sledování a kanonických počtů; chybějící break znamená partial. |
| aces | Počet es | Samostatný `stats.aces`, kontrola rackového `ace`; nepřičítá se k B&R. |
| ownBreakWins | Vlastní výhry při breaku / všechny dokončené racky s vlastním breakem | Jediný ledger `federalEvidence.racks` nebo Team `federalTeam.racks`, skutečné `breaker`/`winner`. Kontrola ID, čísla racku, ročníku/zápasu a rozdělení výher proti skóre; žádný odhad střídání. |
| cleanRuns | Počet B&R | `stats.breakAndRun`, kontrola rackového `breakAndRun`. Stávající pravidla včetně vráceného soft/push, bez odečítání es. |
| pottedBalls | Explicitní + bezpečně odvozené řádné koule během hry | Pouze kanonické `detailedPlay.records`, `potsEvidence`, `derivationSafe`, doložená strana. Pot/legální escape; žádný break, faul ani jeho koule. Kombinace [9] = 1, multipot [3,9] = 2. |
| pottingSuccess | Úspěšné útočné strky / všechny útočné pokusy × 100 | `intent`, `pottingAttempts`, `successfulPottingStrokes`. Multipot 1/1, potvrzená sekvence N/N, MISS a útočný faul 0/1; ostatní známé záměry nepřidávají útok. Unknown/odhad nevytváří strky. |
| safetySuccess | Úspěšné jistoty / vyhodnocené jistoty × 100 | `successfulSafeties / trackedSafeties`, kontrola `safeties`. Rozhodnutí obsluhy, nezávislé na soupeřově úniku. |
| escapeSuccess | Úspěšné úniky / evidované úniky × 100 | `successfulSafetyEscapes / safetyEscapes`. Neúspěch s faulem i bez něj zůstává pokusem. |
| resafes | Počet RESAFE | `stats.resafes` právě jednou; úspěšný únik a nová jistota zůstávají v příslušných samostatných čítačích. |
| fouls | Fauly celkem | `stats.fouls`, včetně break/escape faulů. `breakFouls` je podmnožina a znovu se nepřičítá. |

Počítadlo rezervuje jeden break při `beginRack`; během rozstřelu před jeho potvrzením se tento dosud neprovedený break odečte od čítače. Dokončený zápas se tím nemění. Servisní změna vítěze zneplatní rackový poměr, nikoli automaticky všechny doložené strky. Změna celkového počtu racků zneplatní úplnost všech potenciálně chybějících výkonů (zachová známé počty). Oprava stolu/tahu nezávisle zneplatní útok/koule obou stran. Neznámý účel faulu jedné strany nepoškodí kompletní útok soupeře.

## Přiřazení a agregace

Singles se přiřazuje pouze podle stabilního snapshotu `lineupParticipants`, nikdy podle jména nebo pořadí. Dvojice má kanonický klíč ze seřazených dvou ID; do individuálních součtů jejích členů nic nepřidáváme. Týmový součet používá stranu zápasu jednou; individuální příspěvky používají skutečné `players`/`participantIds` dokončených racků a jejich rozdílové `stats`. Strky se čtou z hlavních records, nikoli z kompatibilních `rack.shots`. Aktér odporující racku nebo záznam bez známého racku zůstává neúplný/nepřiřazený. Starý `identityStatus:legacy` se nepřipojí k nové osobě. Osoba na obou stranách je rozpor, nikoli dvě její představení.

Team individuální výstup má `scope:completed_racks`, `rackIds`. U rozehraného Team zápasu zůstává partial, protože aktuální rack ještě nemá uloženou rozdílovou statistiku. Po dokončení jsou příspěvky kompletní, pokud jsou doložené všechny racky, aktéři a podklady. Při neznámé části přiřazení zůstanou známé příspěvky, ale nejsou vydávány za úplný výkon hráče.

Roční agregace vybírá jen dokončené zápasy shodného `year`, vynechá `incomplete/playing/active`, jeden nejnovější dokončený detailní záznam na fixture (podle `endedAt`, při shodě deterministicky podle ID). Stejný match ID ani fixture se nesčítá dvakrát; `duplicates` vysvětluje vyřazení. Detail má prioritu před ručním Team výsledkem. Ruční výsledky fixture 1/5/10 stejného ročníku přidávají neznámou statistickou část, žádné domnělé osoby či strky. `fixtures` obsahuje zvolený zdroj. Nefiltruje se dodatečně podle předpokládaného střídání ani se nepřepisují výsledky.

Týmy se sčítají pouze ze `sides`, jednotlivci z `individuals`, dvojice z `pairs`. Nejde o tři součty, které by se měly sečíst dohromady. Procenta/průměry se počítají až ze součtů čitatelů a jmenovatelů. Smíšená historie je partial, samotná neznámá unknown. Prázdný ročník je známá prázdná množina: počty 0, poměry bez jmenovatele null. `names` zachová historické názvy, `owner.name` zvolí nejnovější doložený snapshot stejného stabilního ID.

## Nezávislý referenční příklad (obě strany)

Fixture v `tests/fixtures/federal-calculation.cjs`: 8 racků, breakery A/B/A/B/A/B/A/B, vítězové A/B/B/B/A/A/B/B, skóre 3:5. A vyhraje při vlastním breaku racky 1 a 5; B racky 2, 4 a 8. A má breaky eso(1 koule), OK(2), soft+dry(0), faul(1). B dry(0), soft(2), faul(1), OK(1). A má 5 úspěšných útočných strků (multipot 1, kombinace 1, potvrzená sekvence 3), MISS a útočný faul; jeho legální escape přidá kouli, nikoli útočný pokus. Jeden RESAFE založí jednu další jistotu. B má 1 úspěšný strk a 2 MISS.

| Ukazatel | A | B |
|---|---:|---:|
| Úspěšnost breaku | 2/4 = 50 % | 1/4 = 25 % |
| Průměr break koulí | 4/4 = 1 | 4/4 = 1 |
| Esa | 1 | 0 |
| Výhry při vlastním breaku | 2/4 | 3/4 |
| B&R | 1 | 1 |
| Řádné koule během hry | 7 | 1 |
| Úspěšnost útoku | 5/7 ≈ 71,428571 % | 1/3 ≈ 33,333333 % |
| Úspěšnost jistot | 2/3 ≈ 66,666667 % | 0/1 = 0 % |
| Úspěšnost úniků | 2/3 ≈ 66,666667 % | 0/1 = 0 % |
| RESAFE | 1 | 0 |
| Fauly celkem | 4 | 2 |

Zobrazené desetinné hodnoty jsou zde pouze čitelné příklady; funkce uchovává přesná celá n/d a nezaokrouhlený výsledek dělení. Všechny buňky kontroluje test s ručně stanovenými očekáváními, nikoli výstupem jiné kalkulační funkce.

Příklad agregace osoby `a1`: výše uvedený Singles (původní jméno Before) a dva Team racky 1/5 stejného hráče (nové jméno After). Úspěšnost breaku `(2+1)/(4+2)=3/6=50 %`, nikoli průměr 50 % a 50 % podle náhodně shodných výsledků; průměr koulí `(4+1)/(4+2)=5/6`, **nikoli** `(1+0,5)/2=0,75`. Esa 2, B&R 2, koule 7, útok 5/7, jistoty 2/3, úniky 2/3, RESAFE 1, fauly 4. Poměr výher při vlastním breaku `(2+2)/(4+2)=4/6`. Test ověřuje stabilní ID a historii obou jmen; Team celky se k příspěvku hráče znovu nepřičtou.

## Ověření a omezení

Nové unit testy 37/37 čtou skutečný index.html: všech 11 hodnot obou stran, vážená agregace, Singles/Doubles/Team, identity/jména, duplicitní fixture/racky/záznamy, ruční výsledky, legacy, sparse RTDB, neúplnost a rozpory bez clampu. Rozšířený federal-evidence browser ověřuje reálné eso, B&R po vráceném soft/push, RESAFE, fauly, osobu Team racku, undo, skutečný reload/Auth a full PUT/GET paritu výpočtu; fetch během samotného výpočtu zakázán. Konfliktní browser ověřuje novou kalkulaci po skutečné servisní opravě skóre. Celá Node sada 136/138, pouze dvě známá nezměněná selhání preview-match-reload-recovery v test-modular. Původní detailed/Federal Cup/historické/PDF/release browser regrese zopakovány; veškerá síť izolovaná, žádná produkční Firebase.

Kódový commit 56269451d7cf0885565d779a300cda37fbd4698b: [CI kódového commitu](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39610539922) ověřeno, release job uspěl, Node 136/138 jen se dvěma uvedenými známými chybami. Následná dokumentace výpočetní kód nemění.

Legacy, částečná historie a ruční výsledky zůstávají neúplné podle jednotlivých metrik. Ani přesná kalkulace nevytvoří chybějící evidenci. Fyzické Android/iOS, skutečný backend/Auth/Rules/CORS a zátěž neověřeny. Výpočetní API je připravené jako podklad další etapy, nikoli jako hotový veřejný report. PR neslučovat a produkci v rámci tohoto zadání nenasazovat.

## Uzavření revize a integrita (v4.51.88 RC)

Osobní Team vstup zachovává původní metadata detailedPlay včetně coverage a servisních příznaků. Neúplná historie útoku/koulí se proto neztratí při omezení records na relevantní racky hráče. Nezávislé čítače faulů, jistot a úniků se tím automaticky nezneplatní. Nejasný aktér opačné strany nezneplatní doložený příspěvek vlastní strany. U chybějícího kanonického strku bez prokazatelné strany jsou útok a koule obou účastníků dotčeného racku partial; hráči jiných racků zůstanou oddělení. Neúplnost se stejným kontraktem pokračuje do roční agregace.

`federalStatsShotIssues` validuje shotIds proti výhradně kanonickým detailedPlay.records: existenci, opakovaný odkaz/ID, konfliktní varianty stejného ID, vazbu na rack, případný matchId/year a doloženého aktéra. Rackové kopie shots se nepoužívají ani k dopočítání chybějících pokusů. Strojové důvody: missing_shot_reference, invalid_shot_reference, duplicate_shot_reference, duplicate_shot_record, conflicting_shot_record, invalid_shot_record, shot_rack_reference_conflict, shot_match_reference_conflict, shot_actor_reference_conflict. Známé n/d zůstávají, value=null, coverage=partial. Identické kopie ID se počítají jednou; konfliktní obsah téhož ID se do doložených mezisoučtů vůbec nezapočítá (výsledek nezávisí na pořadí variant). Pro osobní výstup se reference validují stále proti původní kanonické kolekci, aby konflikt mezi dvěma aktéry nezmizel filtrováním. Ztrátu bez jakéhokoli odkazu či příznaku nelze spolehlivě detekovat; staré racky bez shotIds zůstávají podle původní evidence, nevytvářejí se automaticky nové odkazy ani evidence complete.

Přímé Team čítače sčítají validní doložené rackové části; chybějící část přidá missing_rack_counter (neplatná invalid_rack_counter) pouze dotčeným metrikám. Fauly 0 + 3 + chybějící proto znamenají count=3, partial, value=null; ne všechny unknown a ne úplné 3. Bez jediného známého counteru zůstává count=null/unknown. Úspěšné breaky jsou odvozené: nejprve se určí pro jednotlivé racky a až pak agregují, takže chybějící dryBreaks nikdy nevytvoří domnělý úspěch odečtením pouze známých neúspěchů od všech breaků. Útok 2/3 + 1/1 + neznámý zachovává numerator=3, denominator=4, partial, value=null; není to oficiálních 75 %. Stejný součet platí mezi zápasy, procenta se nikdy neprůměrují.

Odložené tempo main v4.51.87 RC zachovává null turn/breaker. Výpočet používá striktní porovnání stran, ne Number(null). Před tempem se nic neodečítá od nulových breaků; po volbě tempa se případná rezervace beginRack odečte, dokud není break skutečně zapsán. Team před výběrem hráčů rezervaci nemá. Browser nyní ověřuje jmenovatele 0:0 před tempem, po volbě/opravě i rezervaci, 0:1 po skutečném dry breaku, zpět 0:0 po undo a shodu po reloadu pro Team/Doubles/Singles. Výpočet, nikoli sportovní pravidla nebo streamový protokol, řeší nejistotu.

### Další nezávislý referenční zápas z revize

Trvalá fixture tests/fixtures/federal-review-reference.cjs zachovává pět racků z nezávislé revize. Vítězové A/A/A/A/A, breaky A/B/A/B/A; eso, soft+dry, break faul se dvěma koulemi, legální escape s koulí, multipot, sekvence, RESAFE a fauly. Ručně stanovené výsledky pro obě strany:

| Ukazatel | A | B |
|---|---:|---:|
| Úspěšnost breaku | 2/3 = 66,6667 % | 1/2 = 50 % |
| Průměr break koulí | 5/3 | 1/2 |
| Esa | 1 | 0 |
| Výhry při vlastním breaku | 3/3 | 0/2 |
| B&R | 1 | 0 |
| Řádné koule | 19 | 1 |
| Úspěšnost útoku | 5/7 = 71,4286 % | 1/2 = 50 % |
| Úspěšnost jistot | 2/3 | 1/1 |
| Úspěšnost úniků | 2/3 | 1/1 |
| RESAFE | 1 | 0 |
| Fauly | 4 | 4 |

Roční příklad stabilního hráče red: úplný Singles + jeho skutečné Team racky 1, 2, 5. Breaky 4/5=80 %, break koule 8/5=1,6; esa 2; výhry při vlastním breaku 5/5; B&R 2; řádné koule 31; útok 9/13≈69,2308 %; jistoty 4/6; úniky 4/6; RESAFE 2; fauly 7. Jestliže má Team neúplnou detailed historii, stejné známé 9/13 zůstanou partial/value=null, zatímco doložené fauly mohou zůstat kompletní. Při chybějícím foul counteru Team racku 1 zůstává roční známý součet 7, ale je partial/value=null. Tyto hodnoty kontrolují nové trvalé testy vedle původního osmirackového příkladu.

### Trvalé testy revize

`npm run test:federal-calculation` spouští původní i nové výpočetní testy nad produkčním index.html. `FC_SOURCE_REF=89b339c node --test tests/federal-calculation-integrity.test.cjs` použije původní zdroj: všechny tři negativní reprodukce tehdy selhávají. Testovací proces nemá Firebase ani úložiště; výpočty jsou deterministické a bez mutací. Výsledky všech aktuálních unit/browser regresí a CI jsou v PROJECT_STATUS.md/REVIZE.md. Rozdělení test-modular do jiné CI sady, report ani PDF se neimplementuje.