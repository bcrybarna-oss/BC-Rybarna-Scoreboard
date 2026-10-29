# Etapa6 – kontrakt obnovy, testové sady a produkční oprava

Zadavatel: Dominik,29.10.2026. Základ po fetchi: main`28f45bd32483d8c8275c23d6aac14480dfc8ee6f`, produkce104. Kandidát105, **neslučovat/nenasazovat**, etapa7 nezahájena. Verze se zvyšuje kvůli skutečné změně produkčního guardu, nikoli kvůli pouhému rozdělení testů.

## Rozhodnutí o kontraktu

Dočasně nedostupná identita není důkaz cizího vlastníka. Účetní zápas nesmí být v editovatelném aktivním stavu, ale jeho diskový pointer, active map i recovery/undo musejí zůstat zachované. Uživatel s pouhým zbytkovým UID/profilovým ID nesmí získat právo skórovat. Po ověření platí dosavadní role: tvůrce, skutečný účastník, oprávněný pořadatel nebo system admin podle současných pravidel; nepřidávají se práva ani Rules. Výslovný ownerless offline zápas na zařízení zůstává podporovaný.

Podklad není nové sportovní rozhodnutí: již nasazený produkční FC guard výslovně zachovával snapshot a odpojoval editovatelný pointer při čekání na Auth; skutečný resumeLocalMatch vždy kontroluje oprávnění. Tuto bezpečnou hranici aplikujeme stejně na běžný účetní zápas. Samotné držení snapshotu v úložišti nepovoluje editaci. Nová automatická navigace po loginu se nezavádí: produkce zachovává explicitní POKRAČOVAT. Automatický match-first a turnajový fallback jsou jen preview chování.

## Potvrzené produkční vady a oddělená oprava

Commit`917e310` je cílená produkční oprava s vlastními regresními testy, oddělená od změny sad a CI:

1. `discardForeignLocalActiveMatch` chránil při pendingAuth pouze federalCupLink. Běžný saved zápas prošel větví removeDeviceActiveMatch/saveDeviceActiveMatch(null), tedy měnil disk při dočasně chybějící identitě. Nově odpojí jen match a data.currentMatch u createdByUid nebo FC; uložené snímky nemaže.
2. `editableMatchOwnedByCurrentUser` přijímal matching cloudUid bez ověření cloudAuthenticated a mohl používat stale profil. Nově po zachované offline ownerless výjimce vyžaduje autentizovanou identitu. Ostatní autorizované role a účastníci se nemění.

Nové testy čtou actual root index.html funkce, včetně skutečných diskových helperů, výběru nejnovějšího snapshotu, manual/auto login entrypoints a resumeLocalMatch. Nejde o kopii implementace v testu. Před opravou4PASS/2FAIL z6; po opravě6/6PASS. Browser skutečně založí izolovaný běžný zápas, zadá3:2, reloadne s pendingAuth a ověří původní pointer/recovery, zákaz skórování staleUID, odmítnutí jiného účtu, obnovu vlastníkem, paused clock a score→undo. Všechna Auth/Firebase komunikace mockovaná;0pageerrors.

## První původní experimentální selhání

Původní test stále vyžaduje odpojení pending zápasu bez mazání uložených dat. Preview `discardForeignLocalActiveMatch` má explicitní POOL_TEST_MODE větev, která při !cloudAuthenticated ponechá match v paměti. Assert tak stále selhává. Očekávání není sníženo na pouhé „něco je v úložišti“ ani přeskočeno. Samostatný nový test skutečného preview ownership predicate navíc prokazuje přijetí staleUID bez Auth. Tato druhá latentní vada je nově pokrytá a nyní viditelně selhává; nebyla přejmenována na původní druhou chybu.

Produkční oprava se do starého experimentálního jádra nekopíruje. Preview zdroj beze změny proti baseline; jeho dvě skutečné neshody se musí řešit samostatným budoucím rozhodnutím o experimentu. Dokud zůstávají, experimentální job i celý workflow jsou červené. Samotná zelená produkční sada není tvrzení „všechno prošlo“ ani automatický souhlas k vydání.

## Druhé původní selhání – regex versus chování

Původní regex očekával samostatné restoreOwnedTestMatchAfterLogin(), zatímco preview ukládá návratovou hodnotu a podle ní volá restoreTestTournamentAfterLogin. Regex byl nahrazen actual funkcemi cloudLoginFromModal a autoCloudInit, actual match restore a actual tournament fallback. Testy mají zpožděné loadSecureMatches/loadSecureTournaments, ověřují pořadí identity/access/profile/appData/players/matches/tournaments/guests před navigací a zkontrolují:

- existuje oprávněný zápas: správné skóre a návrat do match, turnaj neotevřen;
- zápas chybí: po načtení turnajů návrat do tournament-detail právě jednou;
- obojí pro manual i automatic login.

Všechny čtyři scénáře procházejí. Nejde o upravený regex přizpůsobený aktuálnímu textu.

## Rozdělení bez skrývání

Žádný test nebyl smazán ani přesunut. Šest experimentálních souborů má explicitní registry, runner failuje na duplicitách/chybějících souborech/neklasifikovaném preview. Produkční a experimentální sada mají oddělené normální CI joby, žádné allow-failure. `npm test` nadále zahrnuje každý soubor a vrací skutečný neúspěch experimentu. Produkční fixture text test-modular v release-policy není exekuce starého core. Podrobnosti a záruky jednotlivých vrstev: [testing.md](testing.md).

## Ověření

Produkční Node sada: **261PASS/0FAIL/0SKIP** se soukromými vstupy; CI bez nich258PASS/0FAIL/3SKIP. Experiment **28PASS/2FAIL/0SKIP ze30**. Celek se soukromými vstupy **289PASS/2FAIL/0SKIP ze291**, bez nich286PASS/2FAIL/3SKIP. npm test skutečně končí1. Nový inventory je38souborů=32produkční+6experimentálních, úplný a disjunktní. [Strojová evidence](stage-6-verification.json).

Relevantní browserové regrese PASS: skutečný ordinary reload/pending/staleUID/intruder/owner/score/undo/paused clock, FC actual mockAuth/reload/resume/Team/Doubles/PUTGET, stream simple/full a reálný overlay vmocku (desktop/mobil/reload), turnaje101 včetně plnékvóty/ručního nasazení/reloadu a samostatných8-ball3/10-ball7, bootstrap5modulů/404, skutečné Pushout2listovéXLSX aA1/A2/B PNG1920×1080/mobil/zoom (původníPDFregrese také). Produkční guard oprava se neprojevila novým selháním těchto scénářů. Soukromé exporty se nemění a nejsou vPR. Živá přihlášenáAuth, FirebaseRules a fyzickázařízení neověřeny; všechny zápisy v testech zachycené mockem.

ReleasegatePASS. FinálníCI aPR budou uvedeny u předání. Zelený produkční job není zelené celéCI a nenahrazuje rozhodnutí o dvou skutečných experimentálních vadách. Žádná automatická výjimka pro stará selhání. Surové logy jsou pracovní output/stage6, nikoli součást veřejných dat. Pět nasazených modulů i test-modular implementace zůstávají proti základnímu main beze změny. Produkční data se nemění, soukromé exporty jen izolovaně vRAM.

## Návrat

Reverze celého PR vrátí organizaci testů i cílené guardy, bez datové migrace. Protože vrací také doloženou produkční vadu, není doporučenou nápravou nalezeného bezpečnostního regresu; případný rollback musí výslovně zachovat bezpečný kontrakt nebo následovat hotfix podle release pravidel. Samostatné commity dovolují rozlišit testovací infrastrukturu od produkční opravy. Žádné zapnutí, mazání nebo plošná oprava test-modular, žádné změny PDF/cache ani rendererů7.
