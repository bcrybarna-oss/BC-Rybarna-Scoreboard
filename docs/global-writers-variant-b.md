# Varianta B — inventář globálních writerů a izolovaná implementace

Zadavatel: Dominik. Datum: 25. 11. 2026. Draft PR #73, kandidát v4.51.123 RC. Main e29b5ed31c002b7a6b3911b20cec37ae404cba66 / produkce v4.51.122 RC. `SERIES_AUTHORITY_ENABLED=false` zůstává ve skutečném zdroji. Pouze izolované testy přepínají literal v testovaném HTML.

## Audit toku, nikoliv jen seznam názvů

Zkontrolovány všechny vložené skripty index.html, všechny produkční JS moduly, přímé fetch URL, method/body adaptéry, cloudUrl s literály i výrazy a delegovaný presence/challenge transport. Zpětně prověřeny funkce volající dva parent writery; přiřazení jednotlivých vlastností je porovnáno s defaultData, merge/normalizací a skutečnou tvorbou payloadu uploadCloudData. Izolovaná runtime matice zaznamenává skutečné mutační cesty. Starý commit e29b5ed je navíc vykonán proti Rules enginu.

| Původní cesta / vlastník | Volající, čtení a zápis před B | Aktivovaný režim B |
|---|---|---|
| uploadCloudData — systémový správce | saveData a lokální safety-restore → markLocalDataChanged → scheduleCloudDataSync (450ms debounce); rovněž initialCloudMerge. GET /appData + ETag, merge lokálního snapshotu, PUT celého /appData. FC kopie převzata ze serveru, jiné položky z lokálního data. | Vrací false před autorizací/fetch. scheduleCloudDataSync neplánuje žádný timer, zruší existující. canWriteGlobalAppData je false i pro admina. Žádný root fallback. |
| initialCloudMerge — přihlášená relace | GET /appData; při prázdném rootu nebo novější lokální revizi mohl zavolat parent uploader a inicializovat/přepsat globální snapshot. | Čte nové série a konkrétní FC child, spustí stávající cloudový lifecycle. Žádná inicializace rootu ani upload podle lokálních hodin. Prázdný root je ověřený scénář. |
| saveFederalConfig — systémový správce | Jediný přímý volající commitConfig ve FC controlleru: saveLineupSelect, fc26SaveTeamResult, fc26EditTeamResult, příprava fixture a fc26SaveSettings (soupisky). GET /appData + ETag, kontrola očekávaného FC fingerprintu, PUT celého rootu včetně zvýšení globální revize. | FederalConfigRepository; výhradně GET/conditional PUT /appData/data/federalCup2026 se stejným child ETag. Ověření očekávaného FC stavu a klientské generace, serverově ověřená role. |
| cloudAutoSync — vlastník relace | Pouze GET /appData; přepočet/merge při vyšším globálním updatedAt, volání renderů a cache. Sám není writer; dřívější místní změny mohly být později nahrány generikou. | Stále read-only, stejný timer/visibility/pagehide lifecycle. Při každém skutečném poll fetch zavolá sdílené čtení série a FC bez vazby na root updatedAt nebo root.data. Parent merge v B nemůže změnit FC ani série. |
| fc26Refresh | Pouze GET rootu, následně načtení zápasů a render. | FC child reader + původní reader zápasů; stará odpověď/refresh neovlivní jinou relaci. |

### Inventář položek historického globálního payloadu

| Položka / autorita | Rozhodnutí |
|---|---|
| data.federalCup2026 | Jediná současná živá globální konfigurace s legitimním writerem. Přesné stejné umístění zůstává; admin mění jen tento podstrom. |
| data.tournamentSeries | Samostatná /tournamentSeries/{id}, vlastníci/manager/admin podle existujícího kontraktu. Legacy pole zůstává zamčené a neslouží jako fallback. |
| players, matches, tournaments, leagues | Uploader je již odfiltrovával; autorita je v samostatných zabezpečených větvích, nikoliv nová globální konfigurace. Původní read/save/delete/confirmation/stream handlery se nemění. |
| deletedMatchIds | Z parent payloadu již odstraněné; místní kompatibilní tombstones nejsou legitimní nový globální writer. |
| deletedTournamentIds | Starý generický payload je mohl obsahovat. Smazání turnaje probíhá samostatnou zabezpečenou operací; pro tuto lokální/legacy značku se žádný nový globální grant nezavádí. |
| currentMatch | Do parent payloadu se ukládal vždy null. Skutečná rozehraná hra je device recovery a zabezpečené zápasy, ne globální stav. Žádný nový writer. |
| root updatedAt | Transportní revize starého uploaderu, ne sportovní data. Už se nezvyšuje. Zůstává kompatibilně čitelná; nová FC/série obnova na ní nezávisí. |
| Neznámá root/data pole | Žádný jejich aktivní writer ani UI vlastník nebyl v kódu nalezen. Zůstávají na serveru nezměněná a read-only, dostupná stávajícímu GET/snapshot nástroji. Nedostávají nová práva ani se nekopírují z lokální cache. Skutečný inventář jejich produkčních hodnot stále vyžaduje samostatně schválené snapshoty. |

Další dynamické adaptéry mají uzavřené doménové prefixy: players/{id}, matches/{id}/confirmations, tournaments/{id}, users/{uid}, profileClaims/{uid}, reports a reportIndexByUser, leagueSever2026 + suffix, stream/liveMatches a currentStreamDbPath → stream/users/{uid}; OnlinePresence o.write sestavuje presence/{uid}/{device}. MatchChallengeActions o.write jde přes předaný transport do players/{ticket.profileId}. Modulové read/save adaptéry nestaví appData cestu. Ani jejich payloady se pod parent write nepřenášejí. Audit těchto vazeb není oprava nesouvisejících D1–D5 či privátně evidovaných turnajových/klubových slabin.

## FC datový a autorizační kontrakt

Nový produkčně načítaný modul `assets/js/federal-config-repository.js` má jednu app-owned instanci. Výslovné závislosti: identity/authorize/url/fetch/canWrite/normalize/fingerprint/clock. Nekopíruje výpočty, nezačíná nový polling a neukládá cache. Aplikace vlastní publikaci a render. Repository je vypnutá stejným build-time přepínačem jako série.

- URL vznikne s aktuálním credential až po autorizaci a kontrole UID/generace; tokeny nejsou ve snapshotu/chybách. Token refresh stejného UID bez změny relace zůstává platný.
- Single-flight je rezervovaný před autorizací. Save zachytí vstupy před čekáním, stejnou akci nesenduje dvakrát. Write revize zneplatní starší čtení; starý finalizer nemaže novou operaci.
- GET/PUT používá jen /appData/data/federalCup2026. Serverový fingerprint musí odpovídat base z editoru. If-Match používá ETag stejné child cesty. Root ani série se neposílají.
- Normalizace/fingerprint jsou stávající aplikační funkce. Při sestavení nového FC obsahu se zachovají neznámé serverové top-level FC položky; ostatní podstromy se nezapisují vůbec.
- config.updatedAt = max(now, předchozí child updatedAt +1). Neplatná/nebezpečná revize se odmítne před PUT. Server rovněž vyžaduje číselnou vyšší child revizi. Root updatedAt zůstává beze změny.
- Úspěch až po 2xx a dekódované shodné odpovědi. Cache chyba po ACK zůstává cloudovým úspěchem, bez retry. saveData pouze ukládá lokální cache a nikdy v B neoznamuje globální cloudové uložení.
- 401/403: odmítnutí; 412 nebo neshoda base: konflikt bez opakování. GET/offline/decode chyba před PUT neodešle zápis. PUT5xx, timeout nebo ztracený/nesrozumitelný ACK: nejasný výsledek, blokace dalšího FC zápisu stejného UID/profilu v otevřené instanci. Žádný journal/retry/GET-based verified.
- UI má trvalé upozornění, read-only inspekování a potvrzené ruční uvolnění bez PUT. GET není receipt a uvolnění nezaručuje bezpečné opakování. Blokace nepřežije restart. Nový serverový protokol se nezavádí.
- Změna účtu/role/profilu/ověření/generace ruší app čekání, časovače i staré UI. Již odeslaný PUT může na serveru doběhnout. Stará odpověď nesmí renderovat/toastovat jinou relaci. Editor rosteru se při změně relace invaliduje; nemíchá se neuložený koncept A do B.

Každý request má nejvýše jeden timeout15s a odstraní ho v finally. Modul v idle nemá timer/listener. Invalidate/dispose zruší čekání i při ignorovaném AbortSignalu a vyčistí vlastněné timeouty; odvolání serverového zápisu se netvrdí. Background obnova používá stávající appData lifecycle, přidává nejvýše jeden souběžný FC GET a jeden sdílený series GET, žádný nový interval. Samotné oddělení kódu není vydáváno za výkonovou optimalizaci.

## Soukromé Rules varianty B

Místní `prepare-variant-b.py` vychází z neupravené dodané kopie přes dosavadní soukromý builder. Výsledný `series-rules-variant-b-LOCAL-ONLY.json` ani původní Rules nejsou v Git. /appData a /appData/data nemají write grant. Konkrétní FC child má grant ověřeného systémového správce (s původní privilegovanou serverově kontrolovanou cestou) a validaci existence/updatedAt. Série mají dosavadní oddělené granty. Ostatní skutečné větve se nemění.

Běžný účet nebo podvržená lokální role nestačí. Parent PUT/DELETE/široký PATCH ani multipath obsahující zakázanou větev neprojde; atomicita je ověřená. **Admin multipath PATCH, který mění pouze povolený FC child a splňuje jeho validaci, je oprávněný zápis**, nikoliv parent grant. Nezamlčuje se tato vlastnost RTDB. Kompletní FC DELETE je zakázaný. IAM/Admin SDK bypass Rules není tímto zámkem zastaven; cutover dál vyžaduje skutečný klid operátorů.

Původní migrační lock zůstává oddělený pro krátké migrační okno (admin copy nových sérií, appData freeze). Po ověření migrace jej nahradí zvlášť schválené operation Rules B, nikoliv starý parent grant. FC tedy nezůstává trvale blokovaný.

## Společná matice a důkazy

- `tests/global-config-emulator.cjs`:12 scénářů skutečného lokálního RTDB enginu. Admin child/reload, owner/manager/stranger/club s podvrženou lokální rolí, anonym/unverified, parent/multipath/DELETE, souběh FC+série, dvě FC zařízení/412, revokace po GET, ztracený ACK po skutečném PUT a A→B→A po odeslání.
- `tests/federal-config-repository.test.cjs`:10 Node kontraktů. Neaktivita bez requestu, single-flight před autorizací, refresh tokenu, všechny identity scope změny, zachycené vstupy a příslušná cesta, chyby401/403/412/500, timeout a ignorovaný signal, staré JSON/read výsledky a úklid prostředků. Desátý test vykonává skutečný Team-result caller z baseline35b36a0 i kandidáta: po změně účtu v mezeře mezi await continuations původní caller oznámil úspěch A účtu B, nový jej odmítne.
- `tests/global-config-browser.cjs`: skutečná aktivovaná aplikace1440/390/320. Listopadový syntetický turnaj do Lounské série souběžně s FC, zachované standardní body/jiné větve, reload/cache, FC změna druhého zařízení při nezměněném root updatedAt a vysoké lokální revizi, bootstrap prázdného rootu bez parent inicializace, osm navigací a nulové aktivní joby. Skutečný Team-result handler, opožděná ACK po změně identity, zahozený starý editor, trvalé500 upozornění a zrušené/potvrzené ruční uvolnění bez dalšího PUT.
- Předchozí repo18 + integrační16 scénářů sérií, celá1440/390/320 matice editorů sérií a legacy v122 uploader/saveFederalConfig zůstávají spuštěné s B Rules. FC child admin povolení nahrazuje dřívější očekávání úplného FC freeze; žádné jiné kontroly nejsou odstraněny. Legacy root PUT stále odmítnut.
- Rootrev37, legacy series, sibling otherUnknown a celý turnajový model se porovnávají po skutečných zápisech. Síťové chyby jsou řízené injekce nad skutečným enginem; syntetické Auth není živá Auth/Rules verifikace.

Spouštění mimo Node-only sadu vyžaduje lokální emulátor127.0.0.1:19006/demo-pool-series a `SERIES_RULES_FILE` se soukromým B draftem. `SERIES_LOCK_RULES_FILE` dále ukazuje na původní migration-lock. Sady běží postupně nad stejným namespace. Bez Rules souboru se nevydávají za úspěšný mock a neskrývají se skipem.

```text
node --test tests/federal-config-repository.test.cjs
node tests/global-config-emulator.cjs
node tests/global-config-browser.cjs
node tests/tournament-series-repository-emulator.cjs
node tests/tournament-series-integration-emulator.cjs
node tests/tournament-series-preparation-browser.cjs
node tests/tournament-series-legacy-client-browser.cjs
node scripts/run-tests.cjs production
node scripts/run-tests.cjs experimental
node scripts/check-release.cjs --base origin/main
```

Při prvním běhu celé Node sady vznikla dvě nová selhání výkonového harnessu: extrahovaný adaptér neměl předanou novou explicitní závislost SERIES_AUTHORITY_ENABLED. Harness ji nyní předává pro původní režim; původní quota/revision očekávání zůstala a přibyla kontrola doménových obnov při null rootu. Po opravě harnessu celá produkční sada446 PASS/0FAIL. Nešlo o předem známá selhání ani o oslabení kontrol.

## Dopad, cutover a zbývající blokery

Varianta B je schválená pro izolovanou implementaci, nikoliv pro publikaci. Dřívější rozhodovací blocker A/B je vyřešen. Zůstávají: schválení úplných čerstvých Rules, aktuální autorizované read-only produkční snapshoty a skutečný dry-run včetně FC/unknown položek; schválení migračního okna a kopií; schválení přepnutí kompatibilního klienta a aktivace. Žádná z těchto akcí neproběhla. Neznámé serverové položky se nesmějí při inventáři automaticky přeložit do nového writeru.

Pořadí: aktuální soukromá záloha → autorizovaný inventář → dočasný migration-lock a klid všech writerů → nový post-lock snapshot/dry-run → conditional stable-ID kopie a readback/hash manifest → zvlášť schválené Rules B a kompatibilní aktivovaný klient → read-only ověření a vynucený reload starých klientů. Starý klient neuloží root, může ukazovat lokální optimistické změny a nesmí být vydáván za kompatibilního editora.

Série delete/import/restore a rekonstruovaná historická struktura zůstávají blokované podle předchozí matice; jejich implementace není součástí B. Bez změny jsou sportovní pravidla, reporty/výpočty, cache politika a secure writers zápasů/hráčů/turnajů/ligy/streamu. Živé Auth/produkční revize Rules a fyzická zařízení jsou neověřené. Před aktivací lze revertovat celý PR bez datové změny; po budoucím cutover zachovat novou autoritu a kompatibilní read-only klient, neobnovovat starou zálohu. 10b1 nezahájena, PR55/72 beze změny.
