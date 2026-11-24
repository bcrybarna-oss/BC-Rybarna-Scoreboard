# Příprava bezpečné persistence turnajových sérií

Zadavatel: Dominik. Datum: 24. 11. 2026. Kandidát v4.51.123 RC, základ `e29b5ed31c002b7a6b3911b20cec37ae404cba66` (nasazeno v4.51.122 RC).

## Stav a hranice

Toto je **neaktivní příprava**, nikoliv dokončená oprava produkční persistence. `index.html` nový modul neimportuje a stávající handlery ani autoritu nemění. Jeho jedinou změnou je povinné číslo kandidáta. Produkční problém tím ještě není vyřešen. PR #55 a diagnostický PR #72 zůstávají nedotčené; nejde o modularizaci 10b1.

Dodanou skutečnou kopii Rules jsme lokálně validovali a auditovali. Originál i soukromý návrh Rules zůstávají mimo tento veřejný checkout. Veřejné soubory neobsahují kopii Rules, privilegované identifikátory ani podrobný návod k nedostatkům stávajících jiných větví. Úplný audit a návrh jsou předány lokálně zadavateli. Vazba kopie na konkrétní živou databázi vychází z jeho doloženého původu; JSON neobsahuje projektový manifest nebo publikovanou revizi. Živá pravidla jsme znovu nestahovali.

## Doporučený kontrakt

Budoucí autorita `/tournamentSeries/{seriesId}`:

```text
schemaVersion: 1
id, createdByUid             povinná neměnná identita
managerUids                 správci série; mění vlastník / system_admin
content                     běžně měnitelná část
  tournamentIds             stávající číselné pozice vazeb
  scoringMode, placementTieBreak, bestCount
  pointsTop, pointsBands, customPointsText, customPoints, updatedAt
preserved                   všechna ostatní původní pole beze změny
```

`preserved` zahrnuje jméno, klub, sezónu, historické turnaje a jejich výsledky i neznámá budoucí pole. Převod neslučuje ani neopravuje existující vazby. Adaptér vrací současnému rendereru původní logický tvar. Není to nový sportovní výpočet. Duplicitní/nevyřešené reference zůstávají evidované k rozhodnutí, nikoliv automaticky odstraněné.

Navrhovaná politika: čtou ověřené přihlášené účty; `content` mění vlastník, explicitní manager nebo systémový správce. Manager nesmí přidělovat oprávnění, měnit vlastníka či chráněná pole. Kořenové vytvoření při migraci provádí pouze správce; delete záznamu není součástí tohoto návrhu. Běžné vytvoření nové série a úprava historických dat vyžadují před cutover doplnění samostatných chráněných operací. Vlastník/manager nedostává právo přepsat `/appData` ani celý záznam série.

Oddělená zapisovatelná větev chrání i neznámá pole a jejich odstranění. RTDB `.validate` se při mazání nevyhodnocuje a porovnání objektů přes `RuleDataSnapshot.val()` není generická hluboká rovnost. Nestačí proto povolit rodičovský PUT a spoléhat na validační pravidla potomků. [Syntaxe Rules](https://firebase.google.com/docs/database/security/core-syntax), [RuleDataSnapshot](https://firebase.google.com/docs/reference/security/database).

## Připravená ukládací vrstva

`assets/js/tournament-series-repository.js` je samostatná knihovna, ve výchozím stavu vypnutá. Má explicitní identity/authorize/url/fetch/now závislosti, žádné automatické spouštění, storage, polling ani produkční fallback. Vlastní ji budoucí relace aplikace; úklid náhodného dialogu ji nesmí restartovat.

Postup: zachytit vstupy a generaci identity → autorizovat → zkontrolovat vlastníka credential → čerstvý GET série → GET **content včetně jeho ETag** → whitelist změny nad čerstvým obsahem → podmíněný PUT **pouze content**. ETag rodiče se nikdy nepoužije pro potomka. URL s tokenem vzniká až po kontrolách; diagnostika neobsahuje credentials. U nové vazby repo i návrh Rules vyžadují dokončený turnaj. Odebrání ponechá mezery v číselných pozicích, aby nepřeskládalo ostatní staré odkazy. Turnaj samotný ani jeho výsledky se nezapisují. Jediný turnaj může být v libovolném počtu sérií s nezávislým bodováním.

Stejná souběžná akce sdílí Promise. UI publikuje stav až po přímém potvrzení PUT. Selhání místní cache po potvrzení nezmění cloudový úspěch na neúspěch a pravdivě upozorní na nespolehlivou obnovu místního stavu. Účet/role/profil/generace jsou kontrolovány před požadavkem i po dekódování. Již odeslaný PUT není odhlášením odvolán; jeho dokončení nesmí změnit UI nové relace.

HTTP 412 znamená konflikt, zobrazení aktuálního stavu a **žádný druhý PUT**. HTTP 401/403 je odmítnutí. Ztracená odpověď, 5xx nebo neplatné potvrzení po PUT znamenají nejistý výsledek. Následný GET poskytuje jen současný stav, nikoliv důkaz provedení konkrétní operace. Stejný profil/série zůstane v otevřené službě blokovaný do nového čtení a explicitního rozhodnutí uživatele. Žádný automatický retry/verified/reconcile ani trvalý žurnál. Blokace nepřežije restart stránky/služby; návrh neslibuje exactly-once historii operací. [Firebase conditional REST writes](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests).

## Read-only inventář a migrace

`scripts/series-migration-dry-run.cjs` nemá síťový klient. Jen porovnává vstupní soubory a případně vytváří nový report výhradním zápisem `wx`. Nikdy nepřepisuje vstupy/zálohy/report. Reálný `server-snapshot` požaduje čas, databázovou origin, cestu a ETag: zdroj `/appData` včetně explicitního `tournamentSeries`, cíl `/tournamentSeries`, volitelně `/tournaments`. Smí být stejná databáze. Tyto popisky nejsou kryptografickým důkazem původu; autorizované pořízení snapshotů je samostatný krok. Starý export aplikace není živý inventář. Reálný podrobný report nesmí být uložen do veřejného checkoutu.

Veřejná fixture `tests/fixtures/series-storage-synthetic/` je výhradně syntetická. Skutečně spuštěný dry-run: 3 zdrojové série, 3 cílové, 4 vazby, 3 historické turnaje; 1 shodný, 1 konfliktní a 1 chybějící cíl, 1 osiřelý cíl. Report obsahuje hashe vstupů, historie, navržených a cílových záznamů, vlastníky/ACL, bodování, neznámá pole, duplicity a chybějící odkazy. Nic neopravuje. Test ověřuje nezměněné vstupy, odmítnutí existujícího výstupu, špatné cesty i neautoritativní zálohy.

Budoucí přechod vyžaduje:

1. Čerstvé autorizované snapshoty legacy i případné nové větve, referencovaných turnajů a zálohu; klid writerů nebo jinou prokázanou ochranu proti změnám během inventáře. Porovnat všechny série, vlastníky/ACL, vazby, historii a bodování.
2. Samostatné schválení obálky a Rules; porovnat čerstvou živou revizi s auditovanou kopií. Znovu spustit engine testy a testy skutečného izolovaného Auth. Nalezené vady jiných větví řešit odděleně.
3. Po schválení kopírovat pod stejnými ID pouze do prázdných cílů s podmínkou, konflikt zastavit. Zpětně načíst a porovnat úplné hodnoty i Firebase reprezentaci. Legacy nemazat, neobnovovat starou databázovou zálohu.
4. Dopracovat **všechny** editory sérií, vytváření, historii, bootstrap, refresh, export/import a oddělení od obecného appData uploaderu. Žádné dvojí zápisy ani tichý fallback. Serverově ochránit legacy série před starými klienty; samotný nový JS flag nestačí. Vynutit reload kompatibilního klienta.
5. Teprve po dalším schválení zapnout novou autoritu a ověřit na obou zařízeních. Tato příprava kroky 1–5 neprovádí.

## Návrat

Před aktivací stačí revert celého přípravného PR, nejsou změněná data. **Po budoucím cutover nestačí vrátit starou aplikaci**: nečetla by nově uložené změny. Zastavit zápisy, zachovat novou autoritu a použít kompatibilní read-only klient; případný zpětný převod pouze z aktuálních snapshotů s porovnáním a zvláštním schválením. Nikdy nepřekrýt nová data starým exportem.

## Provedené testy a reprodukce

- Neupravená privátní kopie: 23/23 skutečných Rules kontrol; místní návrh 39/39. Stávající větve jsou beze změny. Podrobnosti pouze v lokálním bezpečnostním auditu.
- `tests/tournament-series-repository-emulator.cjs`: 18/18, skutečný RTDB engine 4.11.2, loopback/demo namespace. Role owner/manager/admin/club/stranger/anonymous/unverified, reload/nová instance a druhé zařízení, 412, revokace ACL po GET, single-flight, A→B→A během JSON, offline, 401/403/5xx, ztráta odpovědi po skutečném PUT, úklid, ACK a selhání cache, starý účet po odeslání. Síťové chyby jsou řízená injekce, Auth jsou syntetické tokeny.
- `tests/tournament-series-preparation-browser.cjs`: 1440/390/320 px PASS. Skutečný renderer aplikace a nová knihovna napojená **jen izolovaným testovacím hookem**, reálný lokální emulator. Pending bez falešné publikace, jeden PUT, ACK, skutečný reload a čtení, odebrání, scoring, quota/denied storage po ACK, nezměněné jiné série a celá turnajová data, 0 JS chyb. Screenshoty jsou místně v `output/series-preparation-ui/`; nejde o nasazené ovládání.
- `tests/lounska-round-robin-browser.cjs`: PASS 1440/390/320, standardní i Lounská série v obou pořadích, minitabulky, cyklus, nedokončené výsledky, historická data, umístění a body.
- Produkční Node: 425 PASS/0 FAIL/0 SKIP (včetně dostupných lokálních reálných FC fixture); release gate PASS. GitHub běží bez soukromých fixture, očekávané tři SKIP nesmí být zaměněny za lokální ověření. Experiment: 28 PASS/2 FAIL; první ztrácí při nedostupné identitě vazbu obnovovaného zápasu, druhý povoluje cizí editaci přes zbytkové UID bez autentizace. Test i experimentální core jsou vůči origin/main beze změny, core se produkčně nenačítá. Historický audit odstraněného žurnálu není test současného produktu a nebyl přičten. GitHub CI bude uvedeno při předání.

Spuštění lokálních testů vyžaduje již spuštěný RTDB emulátor na 127.0.0.1:19006 a soukromý draft v `SERIES_RULES_FILE`. Bez něj testy skončí chybou, nepřepnou se tiše na mock. Soukromý loader a engine testy jsou předány lokálně; nekopírovat Rules do tohoto repozitáře. [Firebase Emulator](https://firebase.google.com/docs/emulator-suite/install_and_configure).

```text
node --test tests/tournament-series-repository.test.cjs
node tests/tournament-series-repository-emulator.cjs
node tests/tournament-series-preparation-browser.cjs
node tests/lounska-round-robin-browser.cjs
node scripts/run-tests.cjs production
node scripts/run-tests.cjs experimental
node scripts/check-release.cjs --base origin/main
```

Emulátorové sady spouštět postupně; používají stejný syntetický namespace. Živé Auth, kopie živé revize Rules na izolovaném projektu, fyzické mobily a skutečný produkční cutover **nebyly ověřeny**. Produkční data/Rules nebyly změněny; nic není sloučeno ani nasazeno.
