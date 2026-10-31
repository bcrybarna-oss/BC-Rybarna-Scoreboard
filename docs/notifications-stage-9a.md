# Etapa 9 — mapa; 9a centrum notifikací

Zadavatel: Dominik. Datum: 31. 10. 2026. Základ po čerstvém fetchi: main `8aa29fdd637fefb94f2fa86257896ad70e6a8e80`, produkce **v4.51.108 RC**. Kandidát **v4.51.109 RC**, samostatné PR. **Neslučovat, nenasazovat, další část 9 nezahájena.** Cizí nepřidané soubory byly zachované.

## Společná mapa před změnou

| Oblast a vlastník v původním core | Stav, zdroje, čtení a zápisy | Životnost a vazby |
|---|---|---|
| Výzvy — vnořený IIFE | `cache`, `counterChallengeId`, společné `data.players`, current UID/profil. `matchChallengesSent` odesílatele a `matchChallengeResponses` příjemce se spojují podle timestampů. Lokální klíč `poolcitadlo_match_challenges_cache_v1` obsahuje pole bez oddělení UID. `load(true)` volá společný GET `/players`; `load(false)` jen načte cache a přepočte ji z hráčů. | Globální warmup1200ms: při přihlášení GETplayers a load(false), jinak load(false). Interval30s jen při viditelné stránce a přihlášení volá load(false). Vstup/refresh obrazovky force-load, dashboard volá obnovu a refresh hráčů. Další zero-delay timeouty připravují formulář. Navigace nemá globální obnovu zastavit. |
| Výzvy — mutace a formuláře | Odeslat, přijmout, odmítnout, zrušit, protinávrh a odehráno upravují vlastní profil a přes `saveSecurePlayer`/`securePlayerRequest` posílají PUT `/players/{id}`. Odesílatel ukládá plný vlastní `matchChallengesSent`, příjemce omezený response snapshot. `startScheduledMatch` předvyplní počítadlo, ukončení volá completion. | Handlery na formulářích a generované inline akce, dočasné counter ID; serverové oprávnění zůstává ve stávajících Rules. Část kontrol používá aktuální globální UID před await tokenu, nikoli neměnný kontext požadavku. Před serverovými mutacemi9b2 je nutná A1 hranice. |
| Notifikace — původně součást výzev | Jen odvozené události z cache: příchozí pending/counter, accepted/declined odesílateli, sort podle času, limit30. Nemají vlastní cloudovou kolekci nebo GET. Přečtení je lokální JSON `poolcitadlo_notification_read_v1 = {uid:{eventKey:timestamp}}`; eventKey zachovává id/type/stamp. | Globální bell/panel/mark-all/document click a původní listener na každém novém řádku. Render volá renderHome, otevření zvonku a přečtení. Jeden100ms scroll po kliknutí. Žádný vlastní polling. |
| Presence — samostatný pozdní IIFE | `rows`, `viewerUid`, `viewerIsAdmin`, `writing`, `last` vstup a per-tab `device`. `pool_online_device` v sessionStorage; `pool_online_visible` je existující společná preference localStorage. Context přes `poolPresenceContext` po autorizaci vrací UID/token/db/profil/name/admin. GET `/presence`, PUT nebo DELETE `/presence/{uid}/{device}`. | Tick30s i mimo obrazovku, render5s a první tick5s. Pointer/keydown/touch aktualizují aktivitu, visibility návrat resetuje aktivitu a tick; checkbox také tick. Modal/invite přes document click. Zatím bez pagehide úklidu. `writing` serializuje jen část zápisů, ne souběžné GET nebo celý tick. |

Presence PUT payload zůstává `{uid,playerId,name,isAdminAccount,updatedAt,lastInputAt,visible,watching}`. Admin/nepropojený/skrytý/neaktivní déle15min vede ke stávajícímu DELETE. Render ignoruje presence starší90s, aktivní je do5min od vstupu, away do15min, deduplikuje UID. Tyto podmínky se v9a nemění.

Přihlášení je sdílené přes `cloudAuthenticated`, `cloudUid`, profil/roli a `ensureCloudToken`; `refreshAccountUI` je existující synchronní bod po načtení/propojení identity i po `clearRuntimeCloudIdentity`. Globální profilové GET používá také dashboard a jiné části aplikace; pouhé přesunutí výzev nesmí vytvořit další paralelní loader. Staré transporty zatím nemají sdílení Promise ani úplný identity guard. 9a je nepřepisuje a neslibuje jejich opravu.

## Pořadí a hranice 9a / 9b / 9c

1. **9a nyní:** odvozené notifikace, řazení, UI a lokální přečtení. Samostatně nasaditelný globální spotřebitel explicitního synchronního provideru výzev. Nemá síťovou obsluhu, kterou by musel sdílet s druhým loaderem. Nevytváří cloudovou cache. Samostatný zdroj výzev zůstává v aplikaci.
2. **9b až nové zadání:**9b1 vlastník cache a životnosti výzev, společný hráčský GET/single-flight a ochrana relace;9b2 samostatné serverové akce a formuláře. Před9b2 dokončit úzce vymezený A1 request/identity kontrakt a zachování capabilities. Větší oblast lze dělit na dvě nezávisle ověřitelné PR, ne zavádět dvě implementace.
3. **9c až nové zadání:** jeden session/device vlastník presence čtení i PUT/DELETE a jejich aktivity/visibility. Nespojovat jen GET s novým modulem a ponechat související writer se starým vlastníkem. Při případném dělení nejprve určit stejnou A1 hranici.

Původní pracovní rozdělení9a–9e bylo v roadmapě zpřesněno podle tohoto zadání. Žádná změna Rules, migrace, nový systém notifikací nebo změna obnovovacích frekvencí. A1 před serverovým writerem není automaticky extrakcí celé autentizace v tomto PR;9a nepoužívá credentials, jen zachyceného vlastníka lokální akce.

## Skutečná implementace 9a

Jediný produkční `assets/js/notification-center.js` dostává explicitní `identity`, `challenges`, `playerName`, `formatDate`, DOM elementy, document/page, storage adaptéry, hodiny/timer API a callbacky navigace/scrollu. Původní těla event/read/render funkcí a jejich listenery byly odstraněné, bez fallbacku. Bootstrap načítá modul jednou před core a při jeho absenci skončí viditelnou chybou.

Instance vlastní pouze epochu aktuálního kontextu, snapshot vykreslených událostí, šest listenerů a případný100ms scroll. Čtyři listenery jsou DOM bell/panel/list-delegace/mark-all, další document outside click a pagehide. `start` je idempotentní, `stop` zruší timer a všech šest listenerů, `dispose` je trvalé ukončení. Při bfcache zůstane pouze jednorázový pageshow pro obnovu; dispose odebere i ten. Render neregistruje nové obsluhy.

Skutečným vlastníkem je stránka, nikoli obrazovka nebo účet: běžná navigace/odhlášení nezastaví globální zvonek. Změna identity přes explicitní hook v `refreshAccountUI` okamžitě zavře panel, odstraní soukromý obsah a zruší odložený scroll; stav přečtení v úložišti nemaže. Další render čte jen mapu právě ověřeného aktuálního UID. Samotná obsluha kliknutí kontroluje kontext znovu i při chybějícím UI hooku.

Modul nevolá Firebase, neprovádí network authorization, neserializuje archiv ani nespouští interval. Zachovává původní render cadence od provideru a stávající GET/PUT payloady výzev/presence. Lokální data nejsou migrovaná. Struktura událostí, pořadí, limit30, texty, vzhled a timestampové klíče jsou zachované.

## Oddělené funkční opravy, ne kosmetický přesun

- **Starý řádek A → write-state B:** původní onclick si až při kliknutí vzal aktuální UID. Pokud DOM stále patřil A a identita již byla B, uložil key notifikace A do `all[B]`. Přísný browser reproduktor nad skutečným main vyžaduje0zápisů a selže:1zápis, exit1. Kandidát odmítne starý ticket, vykreslí aktuální obsah a neuloží ani nenaviguje.
- **Odložený scroll:** původní100ms job po změně účtu stále scrolloval. Baseline1efekt, kandidát0. V novém modulu se ruší nebo kontroluje jeho identita/epocha a zda cílová obrazovka zůstává aktivní.
- Před lokálním `setItem` se znovu ověří kontext a zachycené UID. Dokud zápis nezačal, změna identity jej zruší. Pokud již `setItem` začal, není zpětně odvoláván: test přepnutí uvnitř mockovaného zápisu potvrzuje původního vlastníka A a potlačení pozdějších UI efektů. U skutečných Firebase PUT/DELETE je stejný princip povinný pro9b/9c, ale ty se nyní neimplementují.

## Zachované mezery mimo 9a

Není tvrzeno, že jsou již opravené všechny tři oblasti. V izolované VM byl nad skutečnou nezměněnou `nextAccepted` prokázán zbytek cache A při současném UID B: funkce vrátí přijatou domluvu A. Cache klíč je společný a některé challenge renderery nefiltrují vlastníka; to patří do9b1. `loadSecurePlayers` navíc zapisuje odpověď do globálního `data.players` bez request identity a může doběhnout ve staré relaci. Presence má analogický problém s pozdní odpovědí/ctx a samostatně žijícími intervaly. Jsou to explicitní rizika budoucích částí a A1, nikoli „opravené modularizací“ nebo nové funkce tohoto PR.

Pro9b je navržené zfiltrování čtení podle aktuální ověřené identity bez smazání původního klíče, odmítnutí starého výsledku před globálním přiřazením a jednotné sdílení `/players` s ostatními konzumenty. Před implementací bude nutné ověřit přesné podmínky a rozsah proti aktuálnímu main. 21 relevantních těl výzev/transportu/presence je v tomto PR prokazatelně byteově nezměněných po normalizaci konců řádků.

## Ověření a měření

- 7unit nad skutečným modulem: všechny čtyři statusy, sort/limit30/metadatové texty a escapování; jeden lokální zápis se správným payloadem a UID; nezasahování do mapy B; staleA→B; logout a opožděný scroll; změna těsně před/uvnitř zápisu; chyby úložiště/obnova;20start/stop a bfcache/dispose; jedna produkční implementace bez polling/network.
- Browser skutečný baseline108 proti kandidátu, desktop1440×1000 a mobil390×844: **2 PNG panelu byteově shodné**, stejné texty a běžné read-state payloady. Jeden row click a jedno mark-all jsou právě dva zápisy; vedlejší efekt navigace/scrollu právě jednou. Zvonek funguje po odchodu na úvod. Po20restart cyklech a dispose nezůstane widget click listener.
- Test explicitně drží provider výzev jako synchronní fixture a pozastaví ostatní background služby. Není to test skutečného cloudového GET, pomalého Auth či writeru9b/9c. Modul9a žádné takové požadavky nemá. Chyba/obnova se ověřují na skutečném lokálním úložišti API s mockovanou chybou; pomalý100ms efekt a změna identity jsou testované zvlášť. Žádný testovací zápis do produkce.
- Sto překreslení: původně7aktuálně připojených widget click listenerů (včetně4řádků), nově4delegované/stálé DOM listenery; nový modul navíc vlastní document click a pagehide, celkem6. Původní odstraněné řádky nejsou vydávané za prokázaný memory leak. Kandidát po100renderech drží stejný počet; stop/dispose všech6uvolní. Nové intervaly0, běžně timeout0, po kliknutí nejvýše1vlastněný100ms timeout.
- Orientační100renderů desktop12,6→9,9ms, mobil11,0→11,1ms. Jednotlivý běh je kontrola regrese, **nikoli tvrzení optimalizace**. Oba kompletní widget scénáře měly4mockované background GET před/po; nejde o požadavky centra. Při bootstrapu přibyl jediný asset module request. Dosavadní B/cache omezení trvají.
- Produkce Node288PASS/0FAIL/0SKIP se soukromými kontrolními exporty; veřejně285PASS/0FAIL/3SKIP. Celá sada318testů:316PASS/2FAIL/0SKIP, skutečný exit1. Experiment28PASS/2FAIL/0SKIP, jednotlivě nezměněné preview-match-reload-recovery:50 (pending identity neodpojí editable match) a:155 (staleUID bez Auth uznán). Experimentální core se nenačítá v produkci. Žádná automatická výjimka, celkové CI nelze označit za zelené.
- Regrese8a/8b,20bootstrap scénářů, obnova identity/zápasu, turnaje101/plnáquota/fáze/FC, streamOBS a skutečné A1/A2/B PNG/PDF i Singles/Doubles/Team XLSX desktop/mobil PASS. Browserové endpointy jsou mockované; soukromé vstupy jen izolovaně a beze změny. PDF nebylo odstraněné ani optimalizované.

## Předání a návrat

Roadmapa/STATUS/CONTEXT/REVIZE aktualizované; kandidát109 neznamená nasazenou verzi. Živá Auth/Rules/Firebase relace, fyzický iPhone/Safari a OBS hardware neověřené. Původní záznamy/účty/exporty nebyly měněné. Další část nebyla implementovaná.

Návrat reverzí celého PR vrátí původní funkce/listenery i bootstrap bez importu nebo vracení dat; read-state JSON zůstává kompatibilní. Případné vydání reverze vyžaduje novou verzi a release/regrese podle AGENTS. Vrátí i potvrzenou stale-click/scroll vadu, proto posoudit úzce vymezený hotfix. Nemaže se úložiště, cache ani archiv.

[Sanitizovaná evidence](notifications-stage-9a-verification.json). [Desktop](screenshots/notifications-9a-desktop.png), [mobil](screenshots/notifications-9a-mobile.png). Kompletní logy/před-po PNG/reproduktor jsou místně v output/stage9a.

Pushnuto do [draft PR50](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/50), implementace `2089a1a36da73596267304c9340d5d049764c717`, rozšířený quota test `3593624cf09317dbccc41f859ba4a04309e242bd`. [CI41216425108](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41216425108): release PASS, produkce285PASS/0FAIL/3SKIP, experiment28PASS/2FAIL/0SKIP (jednotlivě preview50/155), celekFAILURE. Tato následná aktualizace je pouze dokumentační. Nic neslučovat ani nenasazovat.
