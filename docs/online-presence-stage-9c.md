# Etapa9c — online přítomnost

Zadavatel: Dominik. Datum:31.10.2026. Výchozí main45ae20a13899c74f633364c63be2ff87252d8a81, nasazená110. Kandidát **v4.51.111 RC**, samostatná větev refactor/online-presence-9c. Nesloučeno a nenasazeno; etapa10 nezačala.

## Hranice a zachování kontraktu

Jediný produkčně zapojený OnlinePresence vlastní rows/viewer/device/last-input, renderer dialogu/dlaždice/počtu, periodickou publikaci i čtení, single-flight a relaci, preference viditelnosti a všechny vlastní prostředky. Původní inline tělo odstraněno bez fallbacku. Explicitně dostává document/page, identity/context, read/write, storage/sessionStorage, clock/random, časovače a callback invite. Žádný přímý Firebase/globalAuth/archivnícache přístup v modulu. Aplikace poskytuje autorizovaný adaptér a stávající openChallengeForPlayer; výzvové moduly/protokol/payloady jsou beze změn.

Přítomnost je globální vlastník aplikace, nikoli obrazovky. Navigace ji nezastaví. Anonymní relace nemá síťová čtení/zápisy a zobrazuje nedostupnost. Přihlášení zůstává zpracováno stejným místem; refreshAccountUI synchronizuje nového vlastníka. stop/dispose ukončuje vlastněné prostředky a čtecí požadavek; skutečný pagehide je zastaví, bfcache je zachová. Odhlášení vyprázdní soukromý pohled a zneplatní operace, neprovádí nový DELETE pod jinou identitou.

Zachováno: heartbeat/read30s, render5s, startup5s; fresh<=90s, aktivní<5min, pryč<15min, DELETE po>15min bez vstupu. Pointer/key/touch aktualizují poslední vstup; při návratu viditelné stránky se obnoví last-input a tick. Skrytá stránka nadále publikuje watching=true podle původního pravidla. Admin, chybějící profil a neviditelný uživatel používají DELETE; admin checkbox skrytý a poznámka zachována. Zobrazení filtruje neviditelné/admin/bezprofilové/staré záznamy a deduplikuje UID. Globální preference pool_online_visible a session device pool_online_device zůstávají beze změny (nepřevádějí se na novou per-account cache). Payload i cesta presence/UID/device jsou původní, včetně těla DELETE.

## Samostatné opravy závodů

Původní context po await ensureCloudToken mohl vrátit přihlášení B pro tick spuštěný pod A. Browserový audit na přesném main110 reprodukuje1novýPUT B; kandidát ve stejném scénáři0PUT. Kontext nyní zachytí identitu a před/po autorizaci zkontroluje ticket včetně generace modulu. Modul kontroluje UID/profil a platnost těsně před dispatch.

Starý read/JSON po A→B či stop nesmí přepsat nového vlastníka; čtení se abortuje a odpověď i dekódované tělo mají generační guard. Souběžné tick sdílejí1request chain místo překryvu. Preference/visibility během letu požádá o jednu návaznou obnovu. Starý finally nemůže odstranit nový pending. Odpojená či staré relaci patřící tlačítka nezahájí callback. Jediný delegovaný handler zachovává VYZVAT právě jednou.

**Již odeslaný PUT/DELETE není odvolán stopem, odhlášením ani abortem čtení.** Může se dokončit se zachyceným původním tokenem; po jeho dokončení se nesmí zahájit další starýGET ani změnit nový pohled. Samotný klient neprokazuje serverové pořadí mezi zařízeními; opožděný upsert starého zařízení se nevylučuje novým protokolem. Stávající freshness omezuje zobrazení, nejde o důkaz odhlášení nebo bezpečnostní oprávnění. Případné serverové lease/onDisconnect/CAS vyžaduje samostatný návrh a schválení; zde žádné Rules či formát neměníme.

## Ověření a měření

-10cílených unit testů skutečného modulu PASS: idempotence, pendingAuth/logout/A-B-A, již odeslaný zápis, pozdní JSON, payload/visibility/admin/no-profile, přesné hranice neaktivity a freshness, single-flight/preference, síť/recovery, delegace a úklid.
- Browser skutečné aplikace desktop1440×1000/mobil390×844, mock Auth/Firebase: pixelově shodný dialog před/po, escape jmen, VYZVAT1callback, start10×, pending autorizace A→B, starý odeslaný zápis, opožděnýGET, visible/hidden, neaktivita, admin, logout, výpadek/recovery a restart/stop PASS. Na viewport13mockzápisů/12GET v celém testu,0pageerrors. Žádný produkční zápis.
- Vlastní časovače před/po2intervaly+1startup; původně6documentlistenerů bez lifecycle, nyní6document+2page pro úklid/bfcache. Opakovaný start počty nezvyšuje; stop0intervalů/0timeoutů/0listenerů/0pending.100renderů desktop1,1→2,2ms, mobil0,9→1,0ms v jednom orientačním běhu. Nový guard má malý náklad, **nejde o optimalizaci**; PNG přesně shodné SHA256. [Strojový doklad](online-presence-stage-9c-verification.json), [desktop](screenshots/online-presence-9c-desktop.png), [mobil](screenshots/online-presence-9c-mobile.png).
- Produkční Node **328PASS/0FAIL/0SKIP** se třemi privátními exporty. Bez nich CI přeskočí3kontroly s explicitním důvodem. Průběžná selhání nedokončeného statusu/CRLF extrakce byla opravena skutečnou dokumentací a LF pracovním souborem, žádná očekávání testů oslabena.
- Relevantní browser regrese9b1 a9b2 desktop/mobil PASS včetně pěti oprav, unknown fronty, plného/nedostupného storage a založení zápasu. Audit9b1 nyní výslovně ověřuje pouze přidaný pre/post auth guard presence adapteru; obecné writery a startScheduledMatch se nemění. Bootstrap13modulů včetně chybějícího OnlinePresence PASS.
- Samostatná9a consumer kontrola nejprve mobilFAIL: prázdný mock players GET odstranil jméno soupeře. Konzistentní mock hráčů a zastavený vedlejší9b reader ve fixture: desktop/mobil přesnáPNG/text/payload parita PASS. Assertions/tolerance ani produkční notifikace nebyly změněny. Reprodukovatelný adaptér tests/helpers/notification-consumer-isolation.cjs; původní raw test i známá PNGnestabilita a mobilní bell overlay zůstávají samostatně mimoCI.
- Experiment **28PASS/2FAIL/0SKIP**, jednotlivě nezměněné preview50 (pendingAuth neoddělí editaci) a preview155 (staleUID bezAuth). Workflow/core/tests nezměněny; experiment není produkčně načítán. Historický audit odstraněného žurnálu **0PASS/2FAIL**, samostatný důkaz zmrazené implementace, nikoli test9c nebo dvě experimentální vady.

ŽivýAuth, skutečnéRules, fyzickázařízení a serverové souběhy neověřeny. Testy jsou izolované; cache/ostatní oblasti nejsou opravované. Release gate a produkčníCI prošly; odkazy níže.

## Reprodukce a návrat

Z kořene repozitáře: node --test tests/online-presence.test.cjs; node tests/online-presence-browser.cjs; node tests/match-challenges-browser.cjs; node tests/match-challenge-actions-browser.cjs; node tests/helpers/notification-consumer-isolation.cjs; node tests/federal-module-browser.cjs; npm run test:production; npm run test:experimental. Browser potřebuje Playwright/Chrome (místní NODE_PATH dle runtime), skutečné privátní fixtures jen pro tři rozšířené Node kontroly. Audit zvlášť node --test tests/audits/challenge-journal-regressions.cjs (exit1 záměrně dokládá původní vady, není PASS).

Návrat reverzí celého9c PR bez vracení dat, s novou verzí pokud bude kandidát mezitím nasazen. Vrátí i původní klientské závody, proto zvážit cílený hotfix. Žádná data se nemigrují ani nemažou. Před vydáním znovu fetch/main/release/regrese; nyní pouze PR a čekání na schválení.

Poznámka k síti: za probíhajícího řetězce se další periodický tick sdílí, nepřidává druhý požadavek. Nový síťový timeout se nezavádí; dlouho neodpovídající transport čeká na síťový výsledek nebo změnu relace/stop (odeslaný zápis nelze klientsky odvolat).

Draft [PR53](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/53), aplikační commit `1fc9d101a3bc322264c0ac77472f6aa7e27d9ac2`. [CI41231612140](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41231612140): Release PASS, produkce325PASS/0FAIL/3SKIP, experiment28PASS/2FAIL/0SKIP; celéCI FAILURE pouze kvůli oběma nezměněným experimentálním vadám. Následný zápis pouze dokumentační; nesloučeno/nenasazeno.
