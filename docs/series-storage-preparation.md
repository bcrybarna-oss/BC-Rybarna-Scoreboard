# Zabezpečené ukládání sérií — izolovaná integrace PR #73

Zadavatel: Dominik. Datum: 24. 11. 2026. Kandidát v4.51.123 RC. Základ main `e29b5ed31c002b7a6b3911b20cec37ae404cba66`, produkce zůstává v4.51.122 RC. Toto pokračování nahrazuje stav přípravy z commitu `6d0f7b2`.

## Stav

**Aktualizace 25. 11. 2026: varianta B schválená a izolovaně implementovaná.** [Kompletní inventář, FC kontrakt, matice a důkazy](global-writers-variant-b.md). Níže uvedený původní úplný freeze je už jen migrační lock; operation Rules B povolují konkrétní admin FC child. Autorita stále vypnutá.

Repository je nyní načítána a má jednu app-owned instanci. **Produkční autorita zůstává vypnutá konstantou `SERIES_AUTHORITY_ENABLED=false`.** Aktivní testy mění tuto konstantu pouze v izolovaném HTML. Při zapnutém režimu neexistuje fallback na appData, import ani místní zálohu. Při vypnutém režimu zůstávají původní produkční operace pro kontinuitu; nejde o schválení jejich persistence. Není povolen merge/deployment/aktivace/migrace. PR #55/#72 jsou nedotčené, 10b1 nezahájena.

Skutečné Rules, jejich lokální návrhy a podrobný bezpečnostní audit zůstávají mimo veřejný checkout. V jiných větvích nejsou opravovány nesouvisející slabiny. Zveřejněny jsou pouze kontrakty, kód a syntetické důkazy, nikoliv skutečné Rules nebo privilegované identifikátory.

## Kontrakt a oprávnění

```text
/tournamentSeries/{id}
  schemaVersion: 1
  id, createdByUid            povinné a neměnné
  managerUids                owner / serverově ověřený system_admin
  content                    owner / manager / system_admin
    tournamentIds
    scoringMode, placementTieBreak, bestCount
    pointsTop, pointsBands, customPointsText, customPoints, updatedAt
  preserved
    name, club, season, createdAt
    historicalTournaments    samostatná owner / manager / admin zapisovací cesta
    ...ostatní původní a neznámá pole, bez běžného write grantu
```

Čtení zachovává rozsah ověřených přihlášených uživatelů. Role jsou při rozhodování Rules načítány ze serveru; klientská role slouží jen pro UI/preflight. Manager nesmí měnit vlastníka ani ACL. Nové ACL granty vyžadují existující serverový uživatelský záznam. Identifikátory série/pořadatelů/historických záznamů mají bezpečný znakový kontrakt; nepřípustné staré ID zastaví čtení nové autority a dry-run je označí jako blokované, nikdy je nepřejmenuje či nezahodí. To chrání stávající inline UI handlery před nově zapisovanými nebezpečnými klíči, nejde o přepis obecného rendereru. Vlastník smí vytvořit vlastní novou sérii s whitelisted poli a prázdným ACL; nesmí při vytvoření přibalit cizího vlastníka, manažery či systémová metadata. Migrační správce může zachovat původní neznámé hodnoty. Existující nezměněné staré historické řádky nejsou nuceny splňovat novější požadovaná pole.

Každá operace zachytí vstupy/identitu/generaci před čekáním, autorizuje před odesláním a ověří credential owner. GET a PUT používají **stejnou konkrétní cestu a její ETag**: root pro vytvoření; content pro vazby/bodování; managerUids pro ACL; preserved/historicalTournaments pro historii. PUT nenahrazuje sourozence. Žádný write do turnaje kvůli změně série, žádné dual-write do appData. Neznámá pole, ostatní pořadatelé a historické výsledky se berou z čerstvého serverového stavu a zachovávají. Nové klientské vstupy mají whitelist včetně vnořených historických results/matches.

ID a číselné pozice vazeb/historií jsou stabilní; odebrání ponechá mezery. View adaptér vrátí logicky uspořádaná pole. Nová vazba vyžaduje dokončený turnaj v repo i Rules. Více sérií může používat tentýž turnaj se svým bodováním. Nezapisuje se globální seriesPlacementTieBreak do společného turnaje. Výpočty Lounské a standardní série zůstávají původní.

## Funkční matice v zapnutém izolovaném režimu

| Editor / cesta | Stav | Ověření / hranice |
|---|---|---|
| Bootstrap, seznamy, výsledky sérií | Integrované čtení nové autority | Žádná stará lokální série při startu nebo změně účtu; selhání není prázdný známý seznam. |
| Přidat/odebrat dokončený turnaj | Integrovaný conditional content PUT | Potvrzení, druhé zařízení, reload, stejné ID nepřidává další body. |
| Bodování, limity, tie-break | Integrovaný conditional content PUT | Zachovaný baseline vykresleného formuláře; zastaralá editace skončí konfliktem před PUT. |
| Vytvořit sérii | Integrovaný root PUT, ETag prázdného cíle | Vlastník z identity, prázdné ACL; stejné probíhající vytvoření sdílí ID/Promise; odmítnutí/nejistota nezahodí přípravu. |
| Přidat/odebrat spolupořadatele | Integrovaný managerUids PUT | Vlastník/admin, server odmítá managera i podvrženou klientskou roli. |
| Jednoduchá historie — pořadí / plné zápasy | Integrované přidání/odebrání | Původní parser a sportovní výpočty, whitelist nové evidence, zachování starých řádků. |
| Přejmenování existující série/klubu/sezóny | Není nově nabízený editor | Stávající UI vytváří tato metadata při založení. Jejich nová write capability se nezavádí. |
| Smazat celou sérii | **Blokováno** | Bez schválené politiky mazání, tombstonů a návratu; žádný DELETE. |
| Rekonstruovaný historický pavouk | **Zápis blokován** | Vyžaduje provázané změny /tournaments a série; zachován read-only přístup k existujícím výsledkům. Guard před plánem i v historicalPersist. |
| Automatická vazba při založení běžného turnaje | **Blokováno** | Selector vysvětluje připojení až po dokončení. Obnovený pending s původní vazbou zůstává zachován a je výslovně blokován. |
| Export celé aplikace | Integrované čerstvé načtení sérií | Pokud se autorita nenačte, export se zastaví. Bez zápisu. |
| Import celé zálohy / restoreSafetyBackup | **Blokováno** | Stará kopie nesmí nahradit novou autoritu; soubor ani server se nemění. |
| Generic upload /appData | **Pozastaven** | V zapnutém režimu neodesílá request; nepoužívá skrytý legacy upload. |
| Uložení konfigurace Federal Cupu | Integrovaný admin child writer B | /appData/data/federalCup2026, vlastní ETag/revize, bez globálního grantu; [kontrakt](global-writers-variant-b.md). |

Background obnovy využívají stávající životní cyklus CloudRefresh: při každém platném poll fetch samostatné sdílené čtení sérií i FC, včetně prázdného globálního rootu, nezávislé na appData revizi. Žádný nový timer. Navigace a visibility používají stejnou instanci/readAll Promise. Otevřený editovatelný formulář se background obnovou neničí, změna je oznámena. Souběžná editace bodování se před PUT porovná s vykresleným základem. Odpovědi staré relace, starý finalizer a čtení před novějším zápisem nepublikují. Bfcache pagehide nedisponuje instanci; skutečný odchod ano. U již odeslaného PUT se netvrdí odvolání.

## Konflikty a nejistota

Jeden pending job na profil/sérii, stejné kliknutí sdílí Promise. HTTP412 žádný opakovaný PUT, aktuální serverový stav a nové rozhodnutí uživatele. HTTP401/403 odmítnutí bez falešného accepted/saved. Přímý ACK zůstává úspěchem i při následném selhání cache/renderu. Offline před PUT neodešle zápis. Ztracená odpověď/5xx/neplatný ACK po PUT = nejasný výsledek, nikoliv automatický neúspěch. GET slouží jen k prohlédnutí současného stavu; není receipt konkrétní minulé operace. Další zápis stejného profilu/série je v otevřené službě blokován do explicitního rozhodnutí po novém čtení. UI nabízí oddělené prohlédnutí aktuálního stavu (včetně nynějšího null) a potvrzené ruční uvolnění bez PUT. Odmítnutí dialogu blokaci zachová; nejde o průkazné dokončení ani záruku bezpečného opakování. Nejasná příprava vytvoření má samostatné vědomé opuštění s názvem/ID a varováním, bez DELETE. Blokace nepřežije restart; exactly-once historie se neslibuje. Žádný žurnál, automatický retry ani serverový protokol výzev.

## Staré klienty a rozhodnutí před cutover

RTDB parent `.write` grant nelze odebrat child `.write:false`. Test skutečného enginu to pozitivně prokazuje. Samotný zákaz /appData/data/tournamentSeries je proto nedostatečný. [Dědění Rules](https://firebase.google.com/docs/database/security/core-syntax).

Soukromý **přechodový návrh** zakazuje veškeré appData zápisy, včetně systémového správce. Emulátor odmítá parent/child PUT, PATCH, DELETE a root multipath PATCH. Skutečný kód v4.51.122 z main byl spuštěn proti emulátoru: generic uploader i saveFederalConfig skutečně odešlou root PUT a dostanou odmítnutí, nová série zůstává nezměněná. Starý klient může stále ukázat starou lokální optimistickou změnu; server ji nepřijal a klient musí být obnoven. Nejde o nápravu starého UI.

Dopad zámku: čtení appData funguje, samostatné players/matches/tournaments/leagues/stream cesty nezískávají ani neztrácejí práva. Globální admin upload/inicializace konfigurace a editace FC konfigurace/rosteru/lineupů se neuloží. Zámek nevrací už odeslané operace. Jde o běžné REST/Auth klienty; administrativní IAM/Admin SDK bypass Rules tím zastaven není a vyžaduje skutečný organizační klid operátorů. [Admin přístup](https://firebase.google.com/docs/database/admin/start). Při publikaci pravidel nutno vyčkat ukončení starých requestů a po zámku pořídit nové snapshoty.

**Rozhodnutí B bylo schváleno 25. 11. 2026 pro izolovanou implementaci.** Je dokončený úzký FC child writer a obnova oddělená od root revize; obecný upload v novém režimu neexistuje. Žádný další legitimní živý globální writer nebyl ve zdroji nalezen, neznámé serverové položky zůstávají read-only. Parent grant se nevrací. Kompletní aktuální popis a matice je v [inventáři B](global-writers-variant-b.md).

Původní úplný appData freeze se použije jen v samostatně schváleném krátkém migračním okně. Po kopii/ověření jsou připravené operation Rules B s konkrétním FC grantem, bez trvalé blokace FC. Publikace všech Rules a aktivace klienta stále nejsou povolené.

## Read-only snapshot tool a dry-run

`scripts/series-readonly-snapshots.js` je ručně instalovatelná factory, bez automatického běhu. `create()`/`plan()` nečtou síť. `capture()` vyžaduje oddělené explicitní schválení operátora a autorizovaný adapter aktuální relace, přijme jen /appData, /tournamentSeries, /tournaments a očekávanou databázi (nebo výslovný loopback demo režim). Vytváří pouze GET, no-store, X-Firebase-ETag, redirect:error. Kontroluje identitu před/po autorizaci a dekódování; při chybě neposkytne částečný bundle. Nečte Rules/uživatele/Auth a nepíše Firebase.

Uložení zachyceného bundle se po změně identity/dispose odmítne; již zahájené stažení se neprohlašuje za vrácené. Vrací soubory s obálkou `capture.databaseUrl/path/capturedAt/etag` + původní `value`. Credentials se neserializují do metadat ani chyb; samotná serverová data se neredigují a celý výstup je soukromý. Tři oddělené snapshoty nejsou atomická transakce. Metadata původu jsou tvrzení pořizovatele, nikoliv kryptografické ověření živé Rules revize.

Pro budoucí ruční použití bez kopírování tokenů: po samostatném schválení zastavit běžný `showScreen` v DevTools přihlášené aplikace (žádný zapisovací helper), načíst ověřený zdroj snapshot toolu a ve stejném lexical scope sestavit factory s identity funkcí vracející UID/authenticated/emailVerified/role/profile/generation a authorize adapterem `ensureCloudToken(context)` + aktuální cloudUid/cloudIdToken. Autorizační callback nic nevypisuje. Nejprve pouze plan; po kontrole a novém výslovném souhlasu capture. Uložit vrácené JSON přes stažení do soukromé složky, spočítat SHA256 a nikdy nevkládat obsah do veřejného PR. Samotný řetězec approval v API není náhradou souhlasu zadavatele. Nyní taková instalace ani produkční čtení neproběhla.

Konkrétní adapter je v `scripts/series-snapshot-console-adapter.js`. Po načtení prověřené factory vložit tento text do konzole pozastavené aplikační closure (nikoliv jako globální script tag). Instalace vrací jen stav bez credentials a bez requestu. `seriesSnapshotHelper.plan()` je bez čtení. Odstranit breakpoint a pokračovat v běhu. Až po samostatném schválení: `const privateFiles=await seriesSnapshotHelper.capture({approval:'READ ONLY SERIES SNAPSHOTS'});` a `await seriesSnapshotHelper.save(privateFiles);`. Bundle nevypisovat. Uloží se3 JSON a manifest s SHA256/velikostí; objektové URL se uvolní až po ochranné lhůtě. `dispose()` zruší ještě probíhající čtení, nikoliv již stažený soubor. Dialogy vícenásobného stažení patří běžnému ovládání prohlížeče, neobcházet je. Adapter byl ověřen jen v izolované closure, ne v živé produkci.

`series-migration-dry-run.cjs` zpracovává skutečný wrapper **/appData.data.tournamentSeries** (opraveno oproti první přípravě), ne raw zálohu aplikace. Vyžaduje shodnou origin, správné cesty, čas a ETag, odmítne chybějící explicitní zdroj. Jen reportuje ID, ACL, vazby/duplicity/missing reference, historické a celkové hashe, bodování, rozdíly a orphan cíle. Žádná oprava, deduplikace, inventární read, migrace ani write. Report vytváří výhradně `wx` a reálné podrobnosti jen mimo veřejný checkout.

Emulátorové snapshoty byly skutečně pořízeny tímto tool a porovnány dry-runem, ale jsou **výhradně syntetické**. Produkční snapshoty a skutečný migrační dry-run chybí záměrně: zadavatel je zatím nepovolil. Stará JSON záloha tuto mezeru nenahrazuje.

## Přesné pořadí budoucího cutover — žádný krok se nyní neprovádí

1. Respektovat schválenou B a otestované operation Rules B; schválit zbývající blokované editory nebo jejich dočasnou nedostupnost. Potvrdit konkrétní vydání/klienta a role operátorů. Před další funkční publikací znovu fetch/verze/release gate. Nelze vydat dva odlišné buildy pod jednou již nasazenou verzí.
2. Samostatně schválit read-only produkční snapshoty a zajistit autorizovanou relaci. Ověřit projekt/namespace a **čerstvou revizi živých Rules**; lokální kopie má jen doložený původ od zadavatele. Zálohovat skutečné aktuální Rules i vybrané datové větve mimo Git a ověřit čitelnost a SHA256.
3. Prozatímní read-only dry-run: žádná ztracená/duplicitní série, známý vlastník/ACL, všechny vazby, history hash, Lounská i standardní pravidla. Konfliktní cíle/ID nebo nejasné vlastníky zastavit; nic neslučovat ani neopravovat automaticky.
4. Oznámit klid všech administrátorů/pořadatelů a ukončení otevřených zápisů. Po schválení publikovat **migrační lock**: freeze appData, v nové větvi admin-only writes, bez owner/manager child grantů. Emulátor otestoval skutečné tokenové admin kopírování, ne bypass jako důkaz oprávnění. Ověřit odmítnutí starého klienta a znovu získat snapshoty po zámku. Pokud se něco změnilo, nový dry-run.
5. Po samostatném schválení migrace kopírovat každý záznam pod původním ID. Číst prázdný cíl s ETag, vytvořit if-match jen pro tuto verzi. Existující shodný cíl přečíst a zaznamenat, odlišný zastavit. Neopírat ochranu o předchozí GET bez conditional PUT. Nedělat full /appData PUT, DELETE nebo obnovu databáze ze zálohy.
6. Každý cíl zpětně načíst, zkontrolovat úplnost a kanonické hashe všech částí, ACL/vlastníka, historii, reference a bodování. Zapsat soukromý migrační manifest s ID, zdrojovou/cílovou ETag, časy a hashi. Firebase null/prázdná pole/numerické mapy porovnávat kanonicky, surové rozdíly dále evidovat. V průběhu ověřit neměnnost zdroje a referencovaných turnajů; více snapshotů není atomická záloha. Legacy ponechat beze změny.
7. Teprve po shodě schválit operation Rules varianty B a kompatibilní klient s aktivovanou autoritou. Starý parent grant nevracet. Vynutit reload starých klientů, ukázat blokace, ověřit nové čtení před jakoukoli akcí. Obě nasazení koordinovat v zamčeném okně; nový klient nesmí předčasně zapisovat do nedokončené migrace.
8. Bez testovacích produkčních zápisů ověřit manifest, všechny série, historie, nezávislé pořadí/bodování a read-only export. Funkční zápisy pouze v odděleném schváleném testovacím prostředí. Sledovat odmítnuté staré writery a nejasné ACK, nikoliv je automaticky opakovat.
9. Zaznamenat skutečné SHA/verzi/Rules revizi/manifest/testy, omezení a schválení případného uvolnění zámku výhradně podle vybrané varianty. Legacy neodstraňovat v témže vydání.

## Návrat bez ztráty nových dat

Před aktivací lze revertovat celé PR bez datové změny. Po zahájení migrace držet lock a manifest; existující shodné cíle ověřit, nikdy neprovádět blind retry nejasného PUT. Po aktivaci nejprve zastavit nové zápisy, uchovat aktuální novou autoritu a snapshoty obou větví. Vrátit kompatibilní read-only klient, který čte nová data. Prostý návrat v122 nebo obnovování starého exportu by nové změny skrylo/ztratilo. Případný zpětný převod jen z aktuálních snapshotů, s kontrolou každého ID/ETag a samostatným schválením; žádné automatické reverse-migration.

## Testy a reprodukce

- Původní soukromý Rules audit 23 PASS a první návrh39 PASS zůstávají oddělené. Nový přechodový a migrační draft je soukromý a nepublikovaný.
- Repository:18 scénářů skutečného lokálního RTDB enginu; nová integrace16 dalších scénářů (create/ACL/history, serverové role, dvě zařízení/412, stale editor, read ordering, skutečné syntetické snapshoty, migrační lock/admin stable-ID conditional copy, parent-grant důkaz).
- Browser skutečných handlerů1440/390/320: vazby, scoring, create single-flight, pořadatelé, historie pořadí i plné zápasy, reload, quota/denied storage, zachovaný rozepsaný formulář a konflikt druhého zařízení,A→B→A s nejasným create ACK a stabilním ID, potvrzení/odmítnutí ručního inspection release i opuštění přípravy bez dalšího PUT, odebrání manager práv bez ztráty rozepsaných hodnot,12 navigačních cyklů, bfcache vs normální odchod, změna účtu, blokované import/restore/legacy write/historická rekonstrukce/pending vazba. Úplné turnajové hodnoty se porovnávají kanonicky podle ID, nikoliv pořadí JSON klíčů/řádků po Firebase čtení.
- Skutečný legacy v122 uploader a saveFederalConfig:2 odmítnuté root PUT, žádná změna nové autority.
- Regrese Lounské/standardní série1440/390/320 PASS; bootstrap všech modulů včetně explicitně chybějící nové knihovny PASS. Helper aktivních browser harnessů doplněn o skutečný modul; první timeout chybějícího assetu byl opraven, nebyl označen za známou produkční chybu.
- Produkční Node po B lokálně446 PASS/0 FAIL/0 SKIP, release gate PASS. Experiment28 PASS/2 FAIL: detach uloženého zápasu při dočasně nedostupné identitě; druhá vada povoluje saved owner přes zbytkové UID bez autentizace. Experimentální core i tyto testy jsou vůči main beze změny a core není v produkčním načítání. Historický audit odstraněného žurnálu není aktuální produktový test, nebyl započítán. GitHub CI uvedeno při předání; soukromé emulátorové testy neběží v GitHubu a nejsou vydávány za cloudové CI.

```text
node --test tests/tournament-series-repository.test.cjs tests/series-readonly-snapshots.test.cjs
node tests/tournament-series-repository-emulator.cjs
node tests/tournament-series-integration-emulator.cjs
node tests/tournament-series-preparation-browser.cjs
node tests/tournament-series-legacy-client-browser.cjs
node tests/lounska-round-robin-browser.cjs
node tests/federal-module-browser.cjs
node scripts/run-tests.cjs production
node scripts/run-tests.cjs experimental
node scripts/check-release.cjs --base origin/main
```

Emulátor4.11.2 poslouchá jen127.0.0.1:19006, namespace demo-pool-series. `SERIES_RULES_FILE` musí ukazovat na soukromý přechodový návrh, `SERIES_LOCK_RULES_FILE` na soukromý migrační lock. Sady běží postupně, používají stejný namespace. Bez souborů skončí chybou, nikoliv tichým mockem/skipem. Síťové chyby jsou řízené injekce nad enginem; tokeny jsou syntetické. **Živý Auth/živá Rules revize/produkční migrace/fyzická zařízení tím ověřené nejsou.**

Zbývající blokery: schválení úplných čerstvých Rules B; schválení ponechaných blokací; čerstvé autorizované produkční snapshoty a skutečný inventář; izolované živé Auth; publikace Rules/migrace/aktivace/merge/deployment vyžadují další schválení. Žádný takový krok nebyl proveden. Nesouvisející bezpečnostní slabiny jsou jen v soukromém auditu.
