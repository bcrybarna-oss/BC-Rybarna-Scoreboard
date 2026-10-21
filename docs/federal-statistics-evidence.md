# Federal Cup – evidence pro budoucí report, v4.51.84 RC

Zadavatel: Dominik. Etapa 1, 21. 10. 2026. Připraveno ve vlastní větvi k PR; nenasazeno. Report, jeho grafika ani PDF se zde nezavádějí.

## Účastníci

Konfigurace `federalCup2026.participants` drží účastníky `{id, name, team, year}`. `rosterParticipantIdsA/B` určují pořadí. ID je náhodné `fc-…`, nezávislé na jménu a pozici. Jména v `rosterA/B` zůstávají pro kompatibilitu. Editor přejmenovává osobu v řádku, šipky přesouvají jméno i ID; **Nový účastník** výslovně nahradí osobu novým ID. Dvě totožná jména mají různá ID, výběr ukazuje jejich pozice. Sestavy se při editaci převádějí na ID, nejednoznačná stará jména se nevybírají automaticky. Odebraní účastníci z registru nemizí.

`federalCupLink.rosterParticipants` a `lineupParticipants` jsou hluboké snapshoty osob a tehdejších jmen pro daný zápas. Singles a členové Doubles mají tato ID; Team zapisuje do `players` a `records[].actor` zvoleného účastníka s `identityStatus: stable`. Doubles ponechává `actor: null`.

Stará dokončená utkání se nemigrují ani nepřipisují novému registru. Starý Team snapshot používá `identityStatus: legacy`; jeho poziční ID není důkazem totožnosti s novým účastníkem. Nejednoznačné identity vyžadují budoucí explicitní propojení. Přímá změna starého pole jmen mimo editor není důkazem přejmenování; vytvoří novou identitu místo chybného spojení.

Konfigurace má samostatné ukládání: výchozí snapshot musí souhlasit s nynější lokální i načtenou serverovou konfigurací. GET `/appData` vyžádá `X-Firebase-ETag: true`; PUT s `If-Match` atomicky odmítne změnu serveru mezi čtením a zápisem (412). Payload zachovává ostatní serverová data. Chyba čtení, chybějící ETag nebo konflikt nevedou k běžnému přepsání. Obecná synchronizace také zapisuje podmíněně a přebírá serverovou FC konfiguraci. Zobrazení, obnovení existujícího zápasu a výběr stejného účastníka nic do konfigurace nezapisují. První identity vzniknou při skutečném uložení nebo přípravě nového zápasu, s touto ochranou.

Editor drží celý snapshot a ID řádků od začátku úpravy. Automatické obnovení nemíchá nové pozice s původními ID. Konflikt odmítne uložení bez vytvoření či odstranění osoby; tlačítko Obnovit načte server a zahodí draft, úpravu je nutné zadat znovu. Přesun přenáší ID, Nový účastník má výslovný příznak oddělený od prázdného ID. Historické snapshoty se nemění. Ochrana není zámkem zahájení fixture ani editace samotného zápasu. Starší klient bez If-Match může stále přepsat data; administrátoři musí před editací aktualizovat aplikaci.

`federalSlots` normalizuje pole i číselné objekty na původních indexech. Pozice 4 zůstává pozicí 4; chybějící ID je null, jméno prázdný řetězec. Normalizace žádné ID nevytváří. Platí pro soupisky, ID, sestavy a výběr z Team snapshotů; RTDB null/empty nodes i hustá pole s mezerami pokrývají testy.

## Jediná historie racků

`match.federalEvidence = {version: 1, fromStart, rackBaseline, racks?}` je součást autosave i undo. Singles/Doubles mají jedinou historii v `federalEvidence.racks`; Team ponechává jedinou historii v `federalTeam.racks` (žádná druhá kopie ledgeru).

Dokončený rack:

```json
{"id":"match-id:rack:1","rack":1,"matchId":"match-id","year":2026,"fixtureNo":6,"breaker":1,"winner":1,"participantIds":[["fc-a"],["fc-b"]],"ace":false,"breakAndRun":true,"shotIds":["shot-id"],"evidenceSource":"detailedPlay.records"}
```

`recordFederalRack` zapisuje před přepnutím rozstřelu a odmítne stejný rack podruhé. Team zachovává `players`, rozdílové `stats` a kompatibilní kopii `shots`. Kanonickým zdrojem strků je pouze `detailedPlay.records`; `shotIds` odkazují na ně. Kopie se nesčítají. Baseline před breakem zachová skutečné příspěvky hráčů. Esa jsou oddělená od B&R; B&R vychází ze změny dosavadního čítače, včetně vráceného push outu/soft breaku. Sportovní pravidla se nemění.

Při obnově starého rozehraného utkání je `fromStart: false`, chybějící racky se nedopočítávají ze skóre. Chybějící informace o B&R/esu zůstává `null`. Úplnost vyžaduje unikátní ID a platného vítěze/rozstřelujícího; počty výher každé strany musí odpovídat skóre.

Ruční oprava skóre přidá `federalEvidence.serviceChanges` s původním/novým skóre a oddělenou `coverage` pro racky, útok a koule. Změna 1:0 → 0:1 bez důkazu nepřepisuje historického vítěze, označí racky partial a zachová doložené strky/koule. Změna celkového počtu racků (např. 1:0 → 4:0) navíc označí útok a koule partial; známé záznamy zůstanou, celkový počet koulí je null. Z rozdílu skóre se nevytvářejí strky ani koule. Značky přežijí autosave, cloud, reload i dokončení. Undo vzniká před úpravou a obnoví i úplnost. Oprava stolu/tahu nezávisle zneplatňuje útok/koule, nikoli průkaznou historii dokončených racků. Oprava aktuálního rozstřelujícího nemění staré racky; dokončení zaznamená skutečného rozstřelujícího.

## Strky a potopení

Nové FC záznamy v původním `detailedPlay.version = 1` dostávají `evidenceVersion: 2`, `intent`, `pottingAttempts`, `successfulPottingStrokes`, `potsEvidence`. Mimo Federal Cup se tato rozšíření neuplatňují; jednoduché počítadlo, 14.1 a Ghost zůstávají oddělené.

- Jediný strk s koulí 9 po kombinaci: `kind: pot, balls: [9], strokeCount: 1, intent: pot, pottingAttempts: 1, successfulPottingStrokes: 1, potsEvidence: explicit`.
- Dvě koule jedním strkem: dva míče, jeden pokus/jeden úspěch.
- Potvrzené POSTUPNĚ: `entry: sequential_batch`, počet známých strků a úspěchů odpovídá počtu potvrzených jednotlivých potopení.
- MISS: jeden útočný pokus, žádný úspěch.
- Běžný faul: ve stávajícím dialogu je volba Pokus o potopení / Obranný strk / Jiný strk / Nevím. Výchozí je `unknown`, nikdy automatický útok. Útočný faul: jeden pokus, nula úspěchů; ostatní známé účely: nula útočných pokusů; neznámý účel: `pottingAttempts: null`.
- Únik je `intent: escape`, i s potopenou koulí nepřidává útočný pokus bez známého záměru. Jistoty, rozstřely a push out jsou mimo útok.
- `inferred_pots` zachovává `strokeCount: null` a neznámé útočné pokusy/úspěchy. `potsEvidence: derived` je pouze bezpečné odvození při známém stole/náběhu; jinak `unknown`. Při prázdné dávce se nevytvářejí neznámé strky.
- Oprava stolu nepřidává úspěch. Odstranění bez vazby na konkrétní faul nebo servisní změna tahu znamená neúplná data obou stran (vlastníka chybějících strků nelze prokázat); `foulId` zachovává původ faulových koulí. Nezapsané koule při legacy push outu znamenají neúplný počet koulí.

`federalEvidenceSummary` je interní podklad pro další etapu, nikoli veřejný report 11 ukazatelů. Čte pouze kanonické záznamy, odděluje explicitní/odvozené koule a sleduje úplnost útoku, potopení a racků. Bez úplné historie vrací pro celkový počet koulí `null`, ne nulu. Součet známých útoků při částečných datech není úplný jmenovatel. Nová prázdná evidence má prokazatelnou nulu, stará prázdná evidence `unknown`. Hromadné bezpečné dokončení sjednocuje i čítač `stats.regularPottedBalls`; pro budoucí přesné rozlišení použít kanonické záznamy a jejich úplnost, ne samotný čítač.

## Ukládání a ověření

Nová pole se přenášejí plnou lokální zálohou, cloudovou zálohou rozehraného zápasu a `saveSecureMatch` do `/matches/{id}`. Snapshot zahrnuje `federalEvidence` i původní Team/detailed model. Firebase Rules ani backend schéma se nemění.

`node --test tests/federal-evidence.test.cjs` testuje funkce vytažené přímo z nynějšího produkčního index.html. `npm run test:federal-evidence` ověřuje skutečný editor, všechny tři formáty, shodná jména, explicitní/odhadované strky, fauly, racky, B&R/esa, undo, skutečný reload, mockované Firebase Auth přihlášení, plný cloudový PUT/GET a stará data. Veškerá síť je zachycena, žádný testovací účet ani zápis nejde do produkce.

Nový `npm run test:federal-conflicts` používá dva izolované browser kontexty a společný RTDB mock s ETagy a skutečným odmítnutím 412; 7 scénářů zahrnuje všechny čtyři vady i serverovou změnu mezi GET/PUT. Nastavení proměnné prostředí `FC_SOURCE_REF=bd8bfa6` načte původní index přes git show a spustí první čtyři reprodukce: všechny selžou. Aktuální implementace projde 7/7, unit 14/14, celá Node sada 99/101 (jen dvě známé modularizační chyby). Původní gameplay testy připravují již uložené identity a čekají na asynchronní start; editor má ETag mock, migraci a souběh ověřuje nová sada.

Prošly také `test:detailed`, `test:federal-cup`, historické turnaje, PDF a release UI. Dvě dlouhodobě selhávající kontroly `preview-match-reload-recovery` zůstávají beze změny. Fyzické telefony, skutečné Auth/Rules/CORS, souběh editace zápasu/fixture a zátěž neověřeny. Souběh konfigurace ověřuje izolovaný mock, nikoli produkční zápis.

Výhledový návrh (zatím neimplementovat): samostatné příkazy a CI kontroly pro produkční `index.html` (unit + browser včetně konfliktů) a experimentální `test-modular`. Ponechat všechny testy, historii selhání i viditelnost obou kontrol. Známé chyby nezakrývat filtrem úspěšného jobu. Rozdělení sad a CI vyžaduje další zadání.

## Dostupnost 11 ukazatelů po této etapě

Rozstřelová úspěšnost, počet break koulí, esa, jistoty, úniky, RESAFE a fauly zůstávají v existujících datech. Racková historie přidává podklady pro výhry při vlastním rozstřelu a vazbu B&R. Potopené koule a útočné pokusy mají nový rozlišený zdroj i stav úplnosti. Pro nové úplně zaznamenané zápasy jsou vstupy připravené; odhady, unknown fauly nebo historická neúplnost záměrně mohou zabránit přesnému procentu. Budoucí report musí použít „—“, nikoli neprokazatelnou nulu. Tato etapa report ani agregaci více zápasů neimplementuje.
