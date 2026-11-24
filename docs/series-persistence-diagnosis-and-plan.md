# Série: ztráta vazby po přidání turnaje — diagnóza a návrh

Zadavatel: Dominik. 24. 11. 2026. Výchozí `origin/main`: `e29b5ed31c002b7a6b3911b20cec37ae404cba66`, produkce **v4.51.122 RC**. **Pouze diagnostika a návrh k odsouhlasení. Žádná aplikační oprava, migrace, změna Rules ani nasazení. 10b1 nezahájena.** PR #55 zůstává otevřený a nedotčený.

## 1. Veřejný reproduktor a hranice důkazů

Tento dokument a audit obsahují **výhradně syntetické série, hráče a turnaje** a analýzu veřejného main. Žádné identifikátory, součty bodů, UID ani obsah soukromého exportu se zde nezveřejňují. Podrobná diagnóza konkrétního záznamu byla předána zadavateli pouze místně.

Minulý produkční síťový průběh zde nebyl pozorován. Dynamické důkazy níže pocházejí z izolovaného běhu skutečného veřejného index.html s mockovaným Firebase, nikoli z živých Auth/Rules. Původní uživatelská záloha ani produkční data se nemění.

## 2. Potvrzený tok a příčina

| Část v index.html | Skutečný kontrakt |
| --- | --- |
| canManageSeries, kolem 20774 | Systémový správce, vlastník podle createdByUid, nebo managerUids[uid] === true. |
| addTournamentToSeries, kolem 22498 | Ihned změní lokální s.tournamentIds a s.updatedAt; navíc t.seriesPlacementTieBreak. Pak saveData a render. Nečeká na cloud, nemá stav UKLÁDÁM ani potvrzení konkrétní akce. Samostatný success toast zde není; úspěch předstírá nová vazba/body a zmizení tlačítka pro přidání. |
| saveData, kolem 7543 | setItem(DB_KEY) má prázdný catch, poté markLocalDataChanged a scheduleCloudDataSync. Návrat neznamená lokální ani cloudovou trvanlivost. |
| scheduleCloudDataSync / canWriteGlobalAppData, kolem 9276 / 9199 | Pro vlastníka a spolupořadatele bez system_admin se ani nenaplánuje zápis. Toto je klientská podmínka, nezávislá na tom, co by povolily skutečné Rules. |
| uploadCloudData, kolem 9209 | Jen správce: odložený GET /appData s ETag, merge preferující lokální verzi, PUT celé obálky s If-Match. Chybu pouze uloží do cloudLastError / globálního statusu. Volající akce výsledek nedostane, UI zůstane optimistické. |
| cloudAutoSync / arrayMergeById / mergeDataObjects | Novější cloudová revize převezme celou serverovou sérii stejného ID. updatedAt uvnitř série se neporovnává a tournamentIds se nesjednocují. To není ztráta původně úspěšného serverového zápisu vlastníka: ten vůbec nebyl zahájen. |
| initialCloudMerge | Při lokální revizi novější o více než 1500 ms zkusí upload (pro nevlastníka globálních dat je to no-op). Místní iluze proto někdy přežije první reload. Při preferenci cloudu či další novější revizi zmizí. Nelze tvrdit, že každý reload vždy smaže vazbu. Druhé zařízení ji od začátku nemá. |

**Vlastník i spolupořadatel vidí změnu, ale cesta pro její cloudové uložení neexistuje.** Lokální cache není autorita pro další zařízení. Její zaplnění problém zhoršuje, ale není hlavní příčinou: reprodukce s plně funkční cache má stejných nula PUT.

Současná autorita z pohledu aplikace je `/appData/data/tournamentSeries` (pole). Nejde o samostatnou RTDB větev `/tournamentSeries`; to je pouze název položky v modelu. Turnaje jsou samostatně v `/tournaments`. Živé Rules v repozitáři nejsou: jejich serverové záruky nelze odvozovat z UI helperů nebo mocku.

## 3. Výsledky izolovaného auditu

Reproduktor [series-persistence-baseline.cjs](audits/series-persistence-baseline.cjs) načítá skutečný index a produkční moduly. Všechny požadavky zachytí; REST backend je v paměti včetně ETag. Testy **potvrzují existující vady**, nejsou akceptační sadou opravené implementace ani náhradou živých Auth/Rules.

| Relace | UI dovolí správu | Naplánuje globální PUT | Výsledek |
| --- | --- | --- | --- |
| system_admin | ano | ano | Při ACK a bez konfliktu je vazba v mockovaném cloudu a na druhém zařízení. UI nečeká na ACK. |
| vlastník, bez system_admin | ano | ne | Lokálně přidáno, cloud beze změny. |
| spolupořadatel | ano | ne | Stejná vada. |
| club_admin bez vztahu k sérii | ne | ne | Ovládání chybí a přímé volání nic nezmění. |
| běžný cizí hráč | ne | ne | Bez změny. |
| odhlášený, vyčištěné UID | ne | ne | Bez změny, chráněné načtení se nespouští. |

- Syntetická série má dva dokončené turnaje, třetí listopadový a čtyři hráče se skutečnými výsledky z produkčního generátoru. U vlastníka UI i funkční cache přejdou 2→3, cloud zůstane na dvou. Novější revize vrátí body i vazbu; reload a nové přihlášení / druhé zařízení odpovídají cloudu.
- QuotaExceededError i SecurityError: vlastník pořád mění paměť a body, místní nová vazba se neuloží, cloudový PUT nevznikne; žádné konkrétní upozornění na neuloženou sérii. Správce může i při chybě cache úspěšně uložit cloud: chyba cache sama o sobě neblokuje jeho PUT.
- Admin HTTP **401/403/412/500**: lokální nová vazba zůstane po odmítnutí; konkrétní akce nemá rollback/potvrzení, novější cloud ji zase odstraní. If-Match se skutečně odesílá; současní správci se střetnou s výsledky **200 a 412**, nikoliv tichým přepsáním serveru. Odmítnutý klient ale zůstává optimistický.
- Uložení na server + ztracená odpověď: backend má vazbu, klient globální chybu fetch. Akce nemá následné ověření. Vzhled UI je prakticky stejný jako při neuložení; nelze z něj usuzovat na trvanlivost. Automatický GET původní akci nepotvrzuje a další obecné sync/reload nejsou bezpečný opakovací protokol.
- A→B→A: nepotvrzená lokální série může stále zůstat v paměti; pozdější autoritativní čtení ji přepíše. Odebrání a úprava bodovací tabulky mají stejný saveData problém. Bodování navíc hlásí **„Nastavení série bylo uloženo.“**, i když žádný PUT nevznikl.
- Opakované přidání je lokálně chráněné includes: jedna vazba a jedna sada bodů. Není to potvrzení cloudové persistence.
- Opožděný GET starší než potvrzený admin upload je odmítnut stávající revizní kontrolou; tento případ neměníme. Jiná dostatečně nová cloudová revize však nepersistovanou lokální změnu vlastníka běžně přepíše.
- Změna účtu během upload GET: původní admin akce použije před PUT už nový token hráče. Mockový model ji odmítne 403. Je to doložená chybějící ochrana relace **před odesláním**, nikoli prokázané obejití živých Rules. Již odeslaný PUT nelze odhlášením odvolat.
- Navíc se `t.seriesPlacementTieBreak` změní pouze v paměti/cache. uploadCloudData turnaje z payloadu odstraňuje a akce nevolá saveSecureTournament. Čtení `/tournaments` jej vrátí zpět i po úspěšném admin uložení samotné série. Druhý nezávislý PUT turnaje není bezpečnou opravou atomické operace.

Desktop 1440 i mobil 390/320 používají skutečné tlačítko v produkčním dialogu. Bodování Lounské i ostatních sérií se neimplementuje znovu. Srovnání herních dat před/po přidání dovoluje změnu jen starého prezentačního markeru; strky/výsledky se nemění. Původní samostatný Lounský browser ověřuje scoped výpočty, ale blokuje síť a neověřuje cloudovou trvanlivost — proto tuto vadu nezachytil.

Finální audit dokončil **17 syntetických scénářů a šest samostatných kontrol** (souběh, UID během uploadu, starý GET, bodování/odebrání, duplicity, A→B→A). Všechna očekávání reprodukce byla potvrzena; aplikace tím nebyla opravena. Syntetické screenshoty tabulky před/po: [1440 před](screenshots/series-persistence-1440-before.png) / [po](screenshots/series-persistence-1440-after.png), [390 před](screenshots/series-persistence-390-before.png) / [po](screenshots/series-persistence-390-after.png), [320 před](screenshots/series-persistence-320-before.png) / [po](screenshots/series-persistence-320-after.png). Žádný screenshot ani publikovaný důkaz neobsahuje soukromý export, přihlašovací údaje ani skutečné identity.

[Strojový souhrn](audits/series-persistence-baseline.json). Reprodukce:

```powershell
$env:NODE_PATH='cesta/k/instalovanemu/playwright/node_modules'
node docs/audits/series-persistence-baseline.cjs
```

Audit pracuje pouze se syntetickými případy. Audit je záměrně mimo produkční akceptační sadu: zelený běh znamená reprodukovanou vadu, nikoli její opravu. Produkční Node baseline **416 PASS / 0 FAIL**, experiment **28 PASS / 2 nezměněné FAIL** identity. Historický audit žurnálu se do těchto výsledků nemíchá. Žádný nový aplikační build ani mobilní/streamové testy opravy nejsou vydávány za provedené; aplikace zůstává bajtově shodná s main.

## 4. Rozhodnutí: plná oprava vyžaduje schválenou ukládací hranici

Pouhé zavolání existujícího uploadCloudData z handleru nepomůže vlastníkovi. Rozšíření canWriteGlobalAppData by otevřelo i Federal Cup a ostatní společná data — **nepřípustné**. Ukládání jiné kopie do localStorage/IndexedDB nezajistí cloud ani druhé zařízení. Bez znalosti Rules nelze předpokládat, že je jiná svévolně zvolená cesta zapisovatelná.

### Doporučení — samostatná `/tournamentSeries/{seriesId}`

Následující je **návrh, nic z něj není implementováno ani schváleno k migraci**:

1. Jeden autoritativní záznam pod stabilním ID série, se stávajícími poli a zachováním neznámých serverových položek. Nové vlastní delta/snapshoty přes whitelist, nikdy celé cachované appData. Série se oddělí od globální konfigurace bez rozšíření jejího zápisu.
2. Rules musí použít skutečný stávající serverový zdroj rolí (ověřit, nikoli domýšlet podle klientského e-mailu). Vlastník a existující manager mohou upravit povolená věcná pole vlastní série. ACL, vlastník a ID nejsou přepisovatelné spolupořadatelem; správa pořadatelů zachová dnešní oprávnění vlastník/admin. Typy, délky, vazby, neautorizované UID i zděděná široká oprávnění ověřit v emulátoru s věrnou kopií Rules. Čtecí práva zachovat podle skutečné současné viditelnosti, ne automaticky read:true.
3. Pro add/remove/scoring: zachytit UID/profil/roli/ověření a generaci relace i vstupy, po autorizaci a po GET JSON znovu kontrolovat. GET konkrétní série + ETag, delta nad čerstvým serverovým tělem, PUT **jen této série** s If-Match. Zachovat neznámá pole a všechna ostatní ID. Dvě zařízení: 412 znamená nic nepřepsat, nově načíst a ukázat konflikt; žádné tiché last-writer-wins ani slepý retry. Generický root upload série po přechodu nesmí publikovat.
4. UI drží potvrzená data a oddělený pending stav: **UKLÁDÁM**, single-flight/disabled ovládání. Body a úspěch teprve z přímého ACK a kontroly vazby/správného ID. Selhaná cache nepopře potvrzený cloudový úspěch; explicitně upozornit na omezení místní obnovy. Při 401/403/412/500 nepublikovat optimistic state jako uložený. Při změně relace neovlivnit nové UI/cache.
5. Timeout po možném PUT: první následující krok pouze GET, ne PUT. Ten ukáže **aktuální stav**, nikoliv důkaz provedení konkrétní ztracené operace. Pokud vazba právě existuje, zobrazit aktuálně připojený turnaj bez dalšího zápisu; při absenci/odlišném bodování neoznačit původní akci za neprovedenou, protože mezitím mohl nastat další zápis. Trvalé upozornění a explicitní porovnání/nové potvrzení. To není exactly-once protokol. Je-li potřeba prokazatelná identita operace přes restart a souběh, musí se zvlášť schválit atomicky uložená identifikace/účtenka operace; žádný povinný lokální žurnál nebo automatický reconcile zde není navrhovaný jako náhrada.
6. Připojení nesmí dělat dva neatomické zápisy série a t.seriesPlacementTieBreak. Přednostně použít už existující per-series výpočty s pravidlem konkrétní série a **neměnit společný turnaj**. Staré markery se nemigrují ani nenulují. Před implementací ověřit referenční výstupy pro všechny formáty, obě série a ruční pořadí; případnou skutečnou závislost na druhém záznamu nejprve navrhnout jako explicitní atomickou operaci, ne přilepit druhý PUT.

### Bezpečný přechod a návrat

- Nejdřív získat autorizované izolované prostředí a věrnou kopii živých Rules. Mockový audit výše tuto vrstvu nezastupuje.
- Pro jednorázový přechod zajistit klid pořadatelů, načíst živou autoritu s revizí/ETag a vytvořit zálohu. **Nikdy nebrat původní export jako náhradu aktuálního cloudu.** Dry-run tabulka ID → checksum → ACL → počty vazeb/historických záznamů, včetně chybějících referencí a neznámých polí. Nic automaticky nededuplikovat ani nedoplňovat.
- Po zvláštním schválení kopírovat záznamy do nové větve pouze podmíněně do prázdných cílů. Existující odlišný cíl znamená stop. Znovu načíst, porovnat obsah a kontrolní součty i body/referenční výsledky. Starou větev nemazat.
- Přepnutí autority musí být řízené jedním readiness/cutover stavem. Před ním jen staré čtení, po něm jen nový writer. Žádné dvojí zapisování, tichý fallback do root PUT nebo zpětné překrytí nové série starým snapshotem. Upravit generický upload, refresh, bootstrap, export/obnovu i všechny editory série společně podle nového vlastnictví.
- Po přechodu chránit legacy series proti změnám starými klienty a vyžádat jejich reload. Staré otevřené v122 neumějí nový kontrakt a nelze jim jen domluvit zeleným status textem. Současné globální klienty a Rules je nutné zahrnout do migračního testu.
- Návrat: zastavit zápis a zachovat nová autoritativní data i zálohu. Vrátit kód jen s kompatibilním čtením nové větve, nebo zvlášť odsouhlasit porovnaný převod aktuálních delta zpět. Prostý návrat starého writeru/obnova starého exportu by ztratil pozdější změny — **není bezpečný rollback**. Žádné mazání nové větve či hromadná migrace naslepo.

### Menší okamžitá alternativa k samostatnému schválení

Bez Rules/migrace lze pouze omezit klamání: nepersistovatelné owner/manager akce zastavit před lokální změnou a pravdivě vysvětlit nedostupnost; pro správce doplnit potvrzený úzký zápis. To **neobnoví požadovanou možnost vlastníka spravovat sérii** a zužuje jeho dosavadní UI možnosti. Není to plná oprava a zde se neimplementuje. Ani správce nemá jako náhradní řešení přepisovat produkční appData lokálním exportem.

## 5. Akceptační podmínky budoucí implementace

Role A–F proti skutečným testovacím Rules; A→B→A, změna oprávnění před/po GET, právě jeden neodeslaný zápis, odmítnuté/opožděné operace bez zásahu do nového UI. Přidání/odebrání/bodování, reload/nové přihlášení/druhé zařízení, 401/403/412/500, ztráta odpovědi před i po commit, retry pouze po rozlišení současného stavu a novém rozhodnutí, souběh dvou pořadatelů a admina, plná/zakázaná cache, reprezentace prázdných RTDB polí. Beze změn Lounských/standardních pravidel, více sérií, ručních umístění, historických struktur, všech existujících výsledků a neznámých serverových polí.

**Aktuálně je opravená implementace záměrně nepřipravená: vyžaduje rozhodnutí o autoritě/Rules a samostatně schválený přechod. Před touto hranicí se práce zastavuje.**
