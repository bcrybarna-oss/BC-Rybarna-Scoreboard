# Livescore renderer — etapa 8b, v4.51.108 RC

Zadavatel: Dominik. Datum: 30. 10. 2026. **Kandidát; nesloučeno a nenasazeno. Etapa 9 není zahájená.**

## Výchozí stav a rozsah

Čerstvý fetch potvrdil main `c699d94833e636ede62e50b0fc0ef272d4f26290`, produkce v4.51.107 RC, bez souběžné změny. Poslední dokumentační commit má [Pages41105360853](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41105360853) success a [CI41105361030](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41105361030): release/produkce PASS, experiment dvě skutečné FAIL. Stav byl ověřen před úpravami. Cizí nepřidané kopie screenshotů, output/ a tmp/ byly zachované.

Celá 8b tvoří jedno PR. Jediný produkční `assets/js/livescore-renderer.js` přebírá HTML seznamu živých zápasů a turnajů, detailního dialogu, momentum a navigačního indikátoru. Původní těla jsou odstraněná, veřejné aplikační render funkce zůstávají pouze adaptéry. Nový modul se načítá jednou před core; při chybě se zobrazí výslovná chyba a bootstrap skončí, bez starého fallbacku.

## Závislosti a vlastníci

| Vlastník | Odpovědnost |
|---|---|
| LivescoreReader 8a, beze změny | Sdílené čtení, časovače obnov, kontext relace a view/dialog, odmítnutí opožděných výsledků. Render callbacky nyní vedou k adaptéru a rendereru. |
| Aplikace | Původní výběr, pořadí a spojení secure/cloud/local/current zápasů, skryté záznamy, oprávnění, display podklady a formátované časy. Sdílená data zůstávají v aplikaci, protože je mění i publisher. |
| LivescoreRenderer 8b | DOM seznamů, detailu a indikátoru, stejné texty/styly/skóre/momentum; synchronní render z předaných modelů. Žádné načítání dat, polling, ukládání nebo vlastní hodiny. |
| Původní aplikační akce | Pokračování, skrytí, otevření turnaje, smazání, cleanup, obnovení skrytých a editace sólo14. Renderer pouze zavolá explicitní callback, neuděluje oprávnění a neposílá zápisy. |

Rozhraní `create({elements, actions, page})` dostává konkrétní DOM elementy a callbacks; nevytváří skryté dotazy na aplikační stav. `renderList({matches,tournaments})`, `renderDetail(model|null)` a `renderNav(count)` přijímají připravené podklady. Pořadí je pořadím vstupu. Aplikace drží vybraný matchId a otevření/zavření; 8a dál určuje platnost asynchronního výsledku. Renderer žádné z těchto epoch nekopíruje.

Renderer vlastní pět DOM click listenerů: dva delegované kořeny seznamů, delegovaný dialog (zavřít/editovat sólo), cleanup a obnovení skrytých. Šestý listener je předaný pagehide. Vytvoří je pouze jednou, nikoli při renderu. `dispose()` je idempotentní, odebere všech šest a další render ignoruje. Pagehide mimo bfcache jej volá; bfcache ponechá obsluhy existujícího DOM bez nové registrace. Navigační click obsluhu a životnost transportu tento renderer nepřebírá. Nevlastní žádný timeout, interval, síťový request ani objektové URL.

Automatické/ruční cleanup zápisy zůstávají v aplikaci/8a se stejnými právy own/system-admin a stejným chováním. Renderer je pouze vyvolává callbackem. Publikování skóre, heartbeat, OBS/overlay, shot clock, cloud/cache, turnaje a herní pravidla nejsou změněné. Osm předchozích modulů, Pushout writer a experimentální core mají nezměněná těla.

## Oddělená funkční oprava bezpečného textu

Starý seznam používal neescapovaný text `tableNumber` a fallback `raceTo` v innerHTML. Izolovaný reproduktor vloží do těchto polí neškodné `<b data-injected>` / `<i data-injected>`: původní main vytvoří dva HTML elementy, přísné očekávání nulového počtu selže (exit 1). Nový renderer zobrazí doslovný text a vytvoří nula takových elementů. Nejde o změnu sportovních pravidel nebo normalizaci uložených údajů; data se nemění.

Přechod z inline onclick na callbacky současně předává matchId/tournamentId přes escapovaný data atribut, bez interpolace identifikátoru do JavaScriptu. Test ověřuje zachování apostrofu v předaném ID. Jména, kluby, disciplína, turnajové názvy a momentum jsou escapované či zapsané přes textContent. Nezavádí se nový HTML obsah od uživatele.

## Testy a porovnání

- Šest nových Node testů načítá skutečný produkční renderer: indikátor/plurály, prázdný a naplněný seznam, oprávnění, bezpečný text/ID, detail/clock/momentum/sólo/absence, neměnnost vstupů, 100 renderů bez nových listenerů, právě jeden callback, bfcache/dispose a bootstrap bez fallbacku.
- Browser porovnává skutečný kandidátní index a modul s pevně určeným původním main c699d94, ve stejném Chrome a s pevným časem. Všechny endpointy jsou mockované. Desktop 1440×1000 a mobil 390×844, 13 variant vstupu: 8/9/10-ball, 14.1, sólo14 s/bez Ghost, běžný Ghost, vítěz na stole, Doubles s dlouhými jmény, FC Team, turnajový zápas, legacy payload a dokončený zápas. Dokončený zápas se nedostane do seznamu a detail hlásí nedostupnost.
- **14 PNG pohledů před/po byteově shodných**, tedy přesná pixelová shoda při daných podmínkách: prázdný a plný přehled a pět detailů na dvou viewportech. Texty všech detailů i nabídky akcí owner/jiný účet/anonym/admin se shodují. Kliknutí na každou ze sedmi seznamových akcí vede právě k jednomu callbacku. Aktualizace otevřeného skóre a deset close/reopen cyklů projdou. Kladný indikátor zůstává mimo Livescore.
- Seznam má 227 vnořených DOM prvků před i po; po opakovaných cyklech neroste. Pět DOM listenerů + jeden pagehide je stabilních i po 100 renderováních; dispose všech šest uvolní. V celém izolačním scénáři 7 mock požadavků před i po, renderer sám žádný. Žádné JS chyby.
- Orientační synchronní čas 100 renderů: desktop **127,3 → 121,0 ms**, mobil **133,4 → 121,7 ms**. Jednotlivá měření nejsou benchmark ani důkaz optimalizace; nebylo pozorováno zpomalení. Podklady jsou stejné syntetické typově pestré zápasy, nikoli živá produkce. Dřívější limity B/cache se neprohlašují za opravené.
- Zachované testy 8a: před Auth tři čtení → jeden GET, navigace/dialogy, stale výsledky po zavření/A→B/stop, logout, oddělené konzumenty, own/foreign cleanup a úklid prostředků PASS. Production recovery/Auth manual+auto, turnaje v101/plná quota/obě fáze a FC izolace PASS. Stream/OBS dvouklientová izolace a bootstrap včetně chybějícího modulu PASS.
- Skutečné PNG/PDF A1/A2/B, mobilní DPR3, chyby/opakování, prostředky a URL lease PASS. Pushout XLSX Singles/Doubles/Team desktop/mobil PASS. PDF nebylo odstraněno ani optimalizováno. Soukromé exporty jsou jen v izolované paměti; zdrojové soubory beze změny.
- Produkční Node **281 PASS / 0 FAIL / 0 SKIP** se soukromými kontrolními exporty; veřejný běh **278 PASS / 0 FAIL / 3 SKIP**. Experiment **28 PASS / 2 FAIL / 0 SKIP**. Celá Node sada **309 PASS / 2 FAIL / 0 SKIP** z311, skutečný exit1, žádná výjimka.

## Selhání a omezení nejsou skryté

Obě experimentální vady jsou jednotlivě shodné s aktuálním výchozím main a jeho CI, jejich source/testy nejsou změněné: `preview-match-reload-recovery:50` ponechá pending-Auth zápas v editovatelné paměti místo bezpečného odpojení; `:155` uzná zbytkové UID bez autentizace. Experimentální core se nenačítá v produkci. Celkové CI proto nelze označit za zelené.

První exportní test v omezeném procesu selhal na zrušeném stažení PNG (`canceled`), totéž reprodukoval nezměněný main. V běhu s přístupem ke standardní dočasné složce prohlížeče kandidát i nezměněný main dokončily všechny PNG/PDF kontroly, kandidát také XLSX. První neúspěšné logy zůstávají v output; testy se neoslabily, nedošlo k úpravě controlleru ani povolení produkčních zápisů. Toto omezení procesu není další experimentální vada aplikace.

Živý Firebase/Auth/Rules, soukromá produkční relace, fyzický iPhone/Safari ani OBS zařízení nejsou ověřené. Mobil je Chrome viewport. Zařízení původního uživatele turnajových oprav nebylo tímto ověřené. Nevznikla migrace, nové herní záznamy nebo změna cache. Žádný produkční zápis.

## Návrat a předání

Reverze celého tohoto PR vrátí původní vykreslovací těla i bootstrap společně a odstraní modul. Bez migrace nebo vracení dat. Případné vydání reverze vyžaduje novou verzi podle AGENTS a release/regresní kontroly; vrátilo by také staré neescapované textové vložení. Nesmí se samostatně odstranit asset a ponechat nový bootstrap bez rendereru.

[Sanitizované porovnání](livescore-renderer-stage-8b-verification.json). Ukázky shodného vzhledu: [přehled desktop](screenshots/livescore-8b-desktop-list.png), [detail Doubles mobil](screenshots/livescore-8b-mobile-detail.png). Kompletní před/po PNG a raw logy jsou místně v output/stage8b. PR a jeho skutečné CI budou doplněné po pushi; aplikace se bez dalšího schválení neslučuje ani nenasazuje.
