# Federal Cup – evidence pro budoucí report, v4.51.84 RC

Zadavatel: Dominik. Etapa 1, 21. 10. 2026. Připraveno ve vlastní větvi k PR; nenasazeno. Report, jeho grafika ani PDF se zde nezavádějí.

## Účastníci

Konfigurace `federalCup2026.participants` drží účastníky `{id, name, team, year}`. `rosterParticipantIdsA/B` určují pořadí. ID je náhodné `fc-…`, nezávislé na jménu a pozici. Jména v `rosterA/B` zůstávají pro kompatibilitu. Editor přejmenovává osobu v řádku, šipky přesouvají jméno i ID; **Nový účastník** výslovně nahradí osobu novým ID. Dvě totožná jména mají různá ID, výběr ukazuje jejich pozice. Sestavy se při editaci převádějí na ID, nejednoznačná stará jména se nevybírají automaticky. Odebraní účastníci z registru nemizí.

`federalCupLink.rosterParticipants` a `lineupParticipants` jsou hluboké snapshoty osob a tehdejších jmen pro daný zápas. Singles a členové Doubles mají tato ID; Team zapisuje do `players` a `records[].actor` zvoleného účastníka s `identityStatus: stable`. Doubles ponechává `actor: null`.

Stará dokončená utkání se nemigrují ani nepřipisují novému registru. Starý Team snapshot používá `identityStatus: legacy`; jeho poziční ID není důkazem totožnosti s novým účastníkem. Nejednoznačné identity vyžadují budoucí explicitní propojení. Přímá změna starého pole jmen mimo editor není důkazem přejmenování; vytvoří novou identitu místo chybného spojení.

Konfigurace stále používá původní synchronizaci `/appData`; registr se ukládá spolu s ní. Tato etapa nezavádí distribuovaný zámek konfigurace ani fixture. Souběžné administrativní editace z více zařízení nejsou bezpečně vyřešené; používat jedno zařízení pro editaci soupisky.

## Jediná historie racků

`match.federalEvidence = {version: 1, fromStart, rackBaseline, racks?}` je součást autosave i undo. Singles/Doubles mají jedinou historii v `federalEvidence.racks`; Team ponechává jedinou historii v `federalTeam.racks` (žádná druhá kopie ledgeru).

Dokončený rack:

```json
{"id":"match-id:rack:1","rack":1,"matchId":"match-id","year":2026,"fixtureNo":6,"breaker":1,"winner":1,"participantIds":[["fc-a"],["fc-b"]],"ace":false,"breakAndRun":true,"shotIds":["shot-id"],"evidenceSource":"detailedPlay.records"}
```

`recordFederalRack` zapisuje před přepnutím rozstřelu a odmítne stejný rack podruhé. Team zachovává `players`, rozdílové `stats` a kompatibilní kopii `shots`. Kanonickým zdrojem strků je pouze `detailedPlay.records`; `shotIds` odkazují na ně. Kopie se nesčítají. Baseline před breakem zachová skutečné příspěvky hráčů. Esa jsou oddělená od B&R; B&R vychází ze změny dosavadního čítače, včetně vráceného push outu/soft breaku. Sportovní pravidla se nemění.

Při obnově starého rozehraného utkání je `fromStart: false`, chybějící racky se nedopočítávají ze skóre. Chybějící informace o B&R/esu zůstává `null`. Rozpor počtu racků a skóre po servisní opravě znamená částečnou historii.

## Strky a potopení

Nové FC záznamy v původním `detailedPlay.version = 1` dostávají `evidenceVersion: 2`, `intent`, `pottingAttempts`, `successfulPottingStrokes`, `potsEvidence`. Mimo Federal Cup se tato rozšíření neuplatňují; jednoduché počítadlo, 14.1 a Ghost zůstávají oddělené.

- Jediný strk s koulí 9 po kombinaci: `kind: pot, balls: [9], strokeCount: 1, intent: pot, pottingAttempts: 1, successfulPottingStrokes: 1, potsEvidence: explicit`.
- Dvě koule jedním strkem: dva míče, jeden pokus/jeden úspěch.
- Potvrzené POSTUPNĚ: `entry: sequential_batch`, počet známých strků a úspěchů odpovídá počtu potvrzených jednotlivých potopení.
- MISS: jeden útočný pokus, žádný úspěch.
- Běžný faul: ve stávajícím dialogu je volba Pokus o potopení / Obranný strk / Jiný strk / Nevím. Výchozí je `unknown`, nikdy automatický útok. Útočný faul: jeden pokus, nula úspěchů; ostatní známé účely: nula útočných pokusů; neznámý účel: `pottingAttempts: null`.
- Únik je `intent: escape`, i s potopenou koulí nepřidává útočný pokus bez známého záměru. Jistoty, rozstřely a push out jsou mimo útok.
- `inferred_pots` zachovává `strokeCount: null` a neznámé útočné pokusy/úspěchy. `potsEvidence: derived` je pouze bezpečné odvození při známém stole/náběhu; jinak `unknown`. Při prázdné dávce se nevytvářejí neznámé strky.
- Oprava stolu nepřidává úspěch. Odstranění bez vazby na konkrétní faul znamená neúplná data; `foulId` zachovává původ faulových koulí. Nezapsané koule při legacy push outu znamenají neúplný počet koulí.

`federalEvidenceSummary` je interní podklad pro další etapu, nikoli veřejný report 11 ukazatelů. Čte pouze kanonické záznamy, odděluje explicitní/odvozené koule a sleduje úplnost útoku, potopení a racků. Bez úplné historie vrací pro celkový počet koulí `null`, ne nulu. Součet známých útoků při částečných datech není úplný jmenovatel. Nová prázdná evidence má prokazatelnou nulu, stará prázdná evidence `unknown`. Hromadné bezpečné dokončení sjednocuje i čítač `stats.regularPottedBalls`; pro budoucí přesné rozlišení použít kanonické záznamy a jejich úplnost, ne samotný čítač.

## Ukládání a ověření

Nová pole se přenášejí plnou lokální zálohou, cloudovou zálohou rozehraného zápasu a `saveSecureMatch` do `/matches/{id}`. Snapshot zahrnuje `federalEvidence` i původní Team/detailed model. Firebase Rules ani backend schéma se nemění.

`node --test tests/federal-evidence.test.cjs` testuje funkce vytažené přímo z nynějšího produkčního index.html. `npm run test:federal-evidence` ověřuje skutečný editor, všechny tři formáty, shodná jména, explicitní/odhadované strky, fauly, racky, B&R/esa, undo, skutečný reload, mockované Firebase Auth přihlášení, plný cloudový PUT/GET a stará data. Veškerá síť je zachycena, žádný testovací účet ani zápis nejde do produkce.

Před PR zopakovat také `test:detailed`, `test:federal-cup`, historické turnaje, PDF a kontrolu vydání. Dvě dlouhodobě selhávající kontroly `preview-match-reload-recovery` zůstávají beze změny. Fyzické telefony, skutečné Auth/Rules, distribuovaný souběh a zátěž nejsou tímto ověřeny.

## Dostupnost 11 ukazatelů po této etapě

Rozstřelová úspěšnost, počet break koulí, esa, jistoty, úniky, RESAFE a fauly zůstávají v existujících datech. Racková historie přidává podklady pro výhry při vlastním rozstřelu a vazbu B&R. Potopené koule a útočné pokusy mají nový rozlišený zdroj i stav úplnosti. Pro nové úplně zaznamenané zápasy jsou vstupy připravené; odhady, unknown fauly nebo historická neúplnost záměrně mohou zabránit přesnému procentu. Budoucí report musí použít „—“, nikoli neprokazatelnou nulu. Tato etapa report ani agregaci více zápasů neimplementuje.
