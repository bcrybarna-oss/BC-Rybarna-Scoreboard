# Etapa 9b2 — úzká oprava životnosti zápisů výzev

Zadavatel: Dominik. Datum: 31.10.2026. Základ: nevydaná9b1 `fde56cee21a1f0ea074fb3572e71187e5e27216a` / PR51, main `fade611557a33a8145b8c0251883946e1bf7b968`, produkce109. Samostatný navazující PR, **společné dosud nevydané v4.51.110 RC**. Samotnou9b1 neslučovat ani nenasazovat; nejprve integrace obou částí a nové schválení společného vydání.9c nezačíná.

Draft [PR #52](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/52) → větev [PR #51](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/51), aplikační commit `8a5f3ccdef1ec4cb3ce145546d0a1f6f0e1ae671`. [CI 41224379252](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41224379252): Release PASS, produkční **309 PASS / 0 FAIL / 3 SKIP**, experimentální **28 PASS / 2 FAIL / 0 SKIP**, celek FAILURE. Lokálně se všemi exporty312PASS/0FAIL/0SKIP. Samostatná PNG browserová kontrola tentokrát desktop/mobile PASS, její historická nestabilita není opravena ani součástí CI. Obě části nesloučeny a nenasazeny.

## Hranice

Jediný produkční `MatchChallengeActions` vlastní joby, kopii vstupů, ticket relace, deduplikaci, frontu pro profil, výsledek zápisu a ověření nejasného výsledku. Nemá skrytý přístup k DOM, tokenům ani globálním datům. Dostává explicitní identity/profile/authorize/write/readProfile/commit/refresh/journal/operationId/nowIso. Žádné vlastní intervaly ani DOM listenery. Ověřovací GET má AbortController a guard; odeslaný PUT se při změně účtu neabortuje ani neoznačuje jako vrácený.

Aplikace zachytí formulář před sítí, vytvoří callbacky pro původní koncept/generaci dialogu a dodá existující transport. Původní mutující `persist(ch)`, `canAnswerChallenge` a těla akcí odstraněna. UI nyní předává klon; žádná spekulativní změna uloženého profilu ani cache. Obecné `securePlayerRequest/saveSecurePlayer` zůstávají jiným částem aplikace; nejsou fallbackem controlleru. Renderer, řazení a texty karet zůstávají. Změnily se pouze zprávy k jednoznačnému odmítnutí/nejasnému výsledku a bezpečnostní průběh akcí.

Minimální kontrakt A1 je zde pouze operační: authenticated UID, profil a generace+scope relace. Před tokenem a po jeho získání se ověří ticket; těsně před prvnímPUT aktuální profil a případný rozporný ownerUid. Poslední kontrola → zachycená URL/tělo → fetch proběhnou bez dalšího await. Celé přihlašování, jeho persistence, oprávnění, serverové Rules ani veřejný datový formát se nepřepisují. ZbytkovéUID bez autentizace nestačí; změna profilu/role i A→B→A starý job zneplatní.

## Pět reproduktorů před/po

| Případ | Historický main i9b1 před opravou | Po opravě |
|---|---|---|
|1 A čeká předPUT, přihlásí se B|1PUT na profilA s přihlášenímB a obsahemA|0PUT, starý ticket je neplatný|
|2 A PUT je odeslaný, dokončí se po přepnutí na B|smaže konceptB a přepíše část místního players starým profilemA|serverový výsledek zůstává saved proA,0commit/0UI/0finally účtuB|
|3 dvojí uložení protinávrhu|2PUT|1PUT, sdílená promise, pouze původní UI callback|
|4 přijetí odmítnuté403|lokálně accepted, další přijetí bezPUT|lokálně pending, potvrzené odmítnutí, nový výslovný pokus může uspět|
|5 starýGET stejnéhoUID doběhne po úspěšnémPUT|nová výzva zmizí z místního pohledu|write revision+barrier odmítne staré čtení; nové čtení počká na ukončení zápisu|

`tests/match-challenge-actions-before.cjs` spouští přesná historická těla funkcí z main fade611 a9b1 fde56 v izolovaném VM se stejnými mocky a dokládá původní vady. Nejde o test celé historické browserové aplikace ani o živý server. Nové unit a browserové testy používají skutečné nynější produkční moduly. [Strojové výsledky](challenges-stage-9b2-verification.json).

## Pořadí čtení a zápisů

`MatchChallenges.createPlayersReader.beginWrite()` zvýší lokální revizi, odpojí/abortuje dosavadní shared GET a otevře bariéru. I když abort nepomůže a JSON doběhne, kontrola revize jej před apply odmítne. Nové shared čtení stejné relace čeká na ukončení write bariéry. Fronta akcí profilu staví další celé PUT z profilu po předchozím potvrzeném zápisu, takže si dvě zdejší akce nesmažou navzájem pole. Je to pořadí v jedné instanci aplikace, nikoli řešení dvou zařízení.

Při změně relace dostane B vlastní bariéru; starýA PUT mu nezastaví čtení a jeho pozdní release neuvolní jinýB zápis. Commit cache/UI se děje jen s aktuálním ticketem. Následná obnova seznamu je oddělená od potvrzení PUT: její chyba ani chyba UI nesmí změnit saved na rejected/vráceno. Naopak místní accepted nevznikne před potvrzením.

## Odmítnutí, nejasný výsledek a žurnál

- Před odesláním se uloží malá potvrzenka pod unikátním klíčem `poolcitadlo_challenge_pending_write_v1:<UID+profil>:<operationId>`. Obsahuje očekávaný jeden list výzvy, typ akce a vlastníka; neobsahuje token, e-mail ani celý profil. Není součástí Firebase ani EXPORTDAT. Hodnoty serverových profilů/výzev zůstávají ve stejném tvaru. Unikátní klíče zabraňují mazání cizí potvrzenky při pozdním dokončení jiné operace.
- Žurnál je trvalý localStorage, nikoli původně uvažovaná paměť/sessionStorage; přežije reload a zavření karty. Data ani archiv se kvůli místu nemažou. Pokud jej nelze bezpečně číst/zapsat (včetně quota), **prvníPUT se neodešle** a UI ukáže omezení. Nedostatek místní kapacity není tímto PR vyřešen.
- HTTP2xx je potvrzený zápis; odpověď se nemusí znovu parsovat jako JSON, aby se zachovalo potvrzení. Následná chyba čtení/renderu jej neruší.
- HTTP4xx kromě408 je explicitní odmítnutí: žádný optimistický accepted, potvrzenka odstraněna a lze výslovně zopakovat. Síťový výpadek,408 a5xx jsou konzervativně nejasné: nevracíme úspěch ani neodesíláme druhýPUT.
- Další akce stejného vlastníka nejprve zkontroluje nevyřešenou potvrzenku a načte vlastní profil ze serveru. Přesná shoda očekávaného listu znamená ověřené uložení, bez novéhoPUT. Porovnání respektuje skutečnost, že Firebase vynechává null a prázdné kontejnery; pro ověření se nic nevymýšlí ani nezapisuje.
- Nepřítomná/odlišná hodnota nebo neúspěšný ověřovacíGET **není důkaz**, že první požadavek ještě nemůže doběhnout. Zůstane neověřená potvrzenka a žádné slepé opakování. Nevyřešený stav může zablokovat další akce výzev daného profilu; jeho ruční rozhodnutí vyžaduje doloženou kontrolu, automatické mazání ani nové „force retry“ se nezavádí. ÚčetB záznam účtuA nedědí.
- Po ověření staré operace se nová požadovaná akce ve stejném kliknutí **neodesílá**; UI to výslovně řekne. Nový koncept se nesmaže. Pokud uživatel smaže místní úložiště, žurnál tím ztratí; nelze pak slibovat globální exactly-once. Žurnál není serverový zámek a neřeší cross-tab/cross-device konflikt.

## Ověření a skutečný rozsah

- Controller: **15 unit PASS**, reader9unit PASS. Owner/profile/role/A→B→A, zbytkovéUID, dedup a konfliktní paralelní akce, neměnné vstupy a payloady všech šesti akcí, fronta profilů,403retry, nejasnýPUT po serverovém uložení, reload žurnálu, ověření bez druhéhoPUT, absent/503/network, Firebase serializace, quota, chyba UI/refresh, abort a úklid ověřovacíhoGET, samostatné A/B bariéry.
- `match-challenge-actions-browser.cjs`: **desktop1440×1000 + mobile390×844 PASS**. Pět uvedených případů, skutečné send/accept/decline/cancel/counter/played, správné UID/profil a payloady. Koncept při čekání zůstane, starý callback nezavře upravený dialog. Skutečný startMatch z přijaté výzvy vytvoří match se scheduledChallengeId pending, ownerA, playerIds a/op,9-ball/race-to5; související publikace jde výhradně do mocku. Ztracená odpověď po aplikovanémPUT, reload a úspěšné read-only ověření bez druhéhoPUT.
- `match-challenges-browser.cjs`9b1: desktop/mobile PASS včetně skutečného provideru notifikací9a, UID read-state, souběhu a úklidu. Audit upraven pouze pro záměrně přesunutá/opravená těla; zachované obecné transporty, startScheduledMatch a presence se nadále porovnávají s main.
- Bootstrap všech12modulů včetně chybějících modulů:24desktop/mobile scénářů PASS.
- Produkční Node **312PASS /0FAIL /0SKIP** s lokálními třemi privátními exporty. Veřejné CI tyto soubory nemá, příslušné3skips budou přiznané; finální CI výsledky doplněny vPR.
- Experimentální Node **28PASS /2FAIL /0SKIP**: stejné dvě vady proti výchozímu main. První preview neodpojí editovatelný zápas při čekání na identitu (`preview-match-reload-recovery:50`); druhá preview ownership přijímá staleUID bez authenticated (`:155`). Test-modular není v produkci, zdroje/CI ani testové výjimky se nemění.
- Relevantní browserové regrese PASS: skutečné recovery/login cesty s mockAuth, turnaje101/quota/draft/rozdílné fáze aFC izolace, Livescore8a, stream/OBS izolace a skutečné A1/A2/B PNG/PDF + Singles/Doubles/Team XLSX stažení. Žádná testovací produkční data.

**PNG parita notifikací není součástí GitHub CI.** Nezměněná samostatná `notification-center-browser.cjs` v tomto běhu prošla desktop i mobile; její známé přerušované selhání v109/9b1 je dál otevřené, nikoli prohlášené za opravené. Mobilní překrytí bell nebylo opravováno. GitHub CI obsahuje release + produkční a experimentální Node sady. Celé CI nelze označit za zelené, pokud experiment zůstane červený.

Všechny zápisy a přihlášení v testech jsou mockované, včetně testovacího nového zápasu. Živá Auth, Firebase Rules a dvě skutečná zařízení **neověřeny**. Produkční data nebyla měněna, importována ani migrována. Pozitivní mock odpověď není doklad skutečných Rules.

## Konflikty a návrat

[Samostatný návrh podmíněných zápisů a atomických hranic](challenges-write-conflict-proposal.md) popisuje leafCAS versus autoritativní stav/serverovou operaci. Žádná z variant se zde neimplementuje. Nadále zůstává whole-profilePUT, nezávislé writer cesty jiných funkcí a dva klienti si mohou přepsat data; samotná lokální fronta ani žurnál neznamenají serverovou transakci.

Návrat společnou reverzí9b2+9b1 s novou release verzí, **bez vracení dat**. Potvrzenky nejasných operací nemažte automaticky. Starší kód je ignoruje a nechrání před opakováním, proto před návratem nejprve dořešit všechny otevřené operace; jinak zvolit užší hotfix nebo ponechat zápisové akce do vyřešení nedostupné. Reverze obnoví doložené staré vady a není univerzálně bezpečným způsobem řešení nejasnéhoPUT.

## Reprodukční příkazy

`node tests/match-challenge-actions-before.cjs` (úplná historie Git), `node --test tests/match-challenge-actions.test.cjs tests/match-challenges.test.cjs`, `node tests/match-challenge-actions-browser.cjs`, `node scripts/run-tests.cjs production`, `node scripts/run-tests.cjs experimental`. Browserové testy vyžadují dostupný Playwright/Chrome; veškerá síť je nahrazena. Finální release gate vždy po fresh fetch proti origin/main, obě části dosud nevydaného110 dohromady.
