# Etapa 9b1 — čtení, cache a globální obnova výzev

Zadavatel: Dominik. Datum: 31. 10. 2026. Výchozí main `fade611557a33a8145b8c0251883946e1bf7b968` (produkce v4.51.109 RC). Kandidát **v4.51.110 RC**, samostatný PR, nesloučeno a nenasazeno. Menší rozsah 9b1 byl výslovně schválen po zmapování; nejde o dokončení celé 9b.

Draft [PR #51](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/51), aplikační commit `2e2e9b4ee85c219e7a8f53e9bf7f4011dd074fae`. [CI 41220896548](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41220896548): Release PASS, produkční sada **294 PASS / 0 FAIL / 3 SKIP**, experimentální **28 PASS / 2 FAIL / 0 SKIP**. Celé CI FAILURE kvůli dvěma jednotlivě potvrzeným experimentálním vadám; browserový strict PNG FAIL se vykazuje samostatně. Žádné kontroly nebyly vypnuty. Nesloučeno/nenasazeno.

## Hranice a mapa

| Oblast | Vlastník po změně | Závislosti / životnost |
|---|---|---|
| Sdílený GET `/players` | `MatchChallenges.createPlayersReader` | explicitní identity, guarded ensureToken, request(signal), apply(players); všichni současní volající `loadSecurePlayers` sdílejí tentýž objekt |
| Sloučení sender/recipient response a řazení | `MatchChallenges.create` | předaný provider hráčů; stávající precedence timestampů a pole beze změny |
| Soukromá cache výzev | tentýž modul | ověřené UID; per-UID lokální klíč a filtrovaný import starého pole; původní klíč se nemaže |
| Globální obnova | tentýž modul | startup 1200 ms s GET, interval 30000 ms pouze z aktuálních players, skrytá stránka tick přeskočí; nezávisí na obrazovce |
| Navigace / ruční OBNOVIT / dashboard | aplikace | tenké `load(force)` a `loadSecurePlayers()` delegují; souběh sdílen, ruční force se při souběhu s cached refreshem neztratí |
| Vykreslení / formuláře / DOM handlery | aplikace | původní vzhled, texty, akce; posluchače registrované jednou při bootstrapu |
| Odeslat, přijmout, odmítnout, zrušit, protinávrh, odehráno | aplikace, **9b2** | původní celé profile PUT a payloady; v tomto PR nepřesunuty ani prohlášeny za bezpečné transakce |
| Předvyplnění domluveného zápasu | aplikace | původní `pendingScheduledChallenge`, jména, disciplína, race-to a setup |
| Centrum notifikací | nezměněný `NotificationCenter` (9a) | stále provider stejného cache pole; read-state podle UID a původní callbacks |
| Online přítomnost | původní aplikace (**9c nedotčeno**) | `poolPresenceContext` i implementace přítomnosti beze změny |

Renderer ani serverové akce nejsou paralelní implementací modulu: aplikace má pouze alias pole pro zobrazení a stávající mutující action reference. Modul je jediný vlastník výměny cache, její persistence, čtení a obnovovacích timerů. Původní těla cache/read/merge a startup/interval byla odstraněna ve stejném PR. Bootstrap vyžaduje modul; při jeho chybění viditelná chyba, bez fallbacku. Aplikace vlastní globální `data.players` a credentials, modul žádné tokeny nepersistuje ani nevrací do UI.

## Přesun versus funkční opravy

Přesun zachovává merging, řazení a frekvence. Samostatně doložené opravy:

1. Původní `nextAccepted()` nad cache účtu A vrací jeho soukromý přijatý zápas i při aktuálním UID B. Staré `cacheLoad` načítá společné pole bez filtru. Nový provider při známé změně identity/generace okamžitě odpojí staré pole a povolí pouze záznamy, jejichž UID odpovídá ověřenému účtu. Zbytkové UID bez autentizace nestačí. Profilové ID samo již nerozhoduje o vlastnictví cache.
2. Původní `loadSecurePlayers()` po čekání na JSON bez kontroly přepíše globální players odpovědí A i po přihlášení B. Nové sdílené čtení kontroluje zachycený kontext před tokenem, před GET, po HTTP i po JSON a před apply. Změna relace abortuje starý transport, ale správnost není založena na úspěchu abortu: i pozdní tělo se odmítne. Explicitní identity hook zachytí také A → B → A. Starý finally neodstraní nový job.
3. Souběžné GET nyní sdíleny i mezi výzvami a dashboardem/ostatními původními volajícími. Tři volání → jeden GET; při chybě se neprovádí automatické opakování. Další výslovné čtení lze zopakovat. Ruční force se při souběhu s cached refreshem neztratí.

Scope klíčů: `poolcitadlo_match_challenges_cache_v1:<encodeURIComponent(uid)>`, hodnota stále stejné JSON pole výzev. Starý klíč se pouze přečte jako fallback, přísně filtruje UID, nemaže ani nepřepisuje. Jiný účet se nedědí, quota chyba zachová paměťovou cache; její zápis se nevydává za serverové uložení. Žádná archivní cache ani herní data se nemění.

## Prostředky a relace

`start` je idempotentní: jeden interval, nejvýše jeden startup timeout, dva page-lifecycle listenery. `stop` odstraní oba listenery i oba timery a zneplatní čekající callback. Bfcache po pagehide ponechá pouze jednorázově potřebný pageshow listener; návrat obnoví jedinou instanci. `dispose` odstraní vše a ukončí sdílený players reader při skutečném ukončení aplikace. Souběžně sdílený GET má vlastníka na úrovni aplikace; pouhý odchod z obrazovky jej neruší jiným konzumentům. Výsledek staré zastavené služby nemůže vykreslit novou instanci. Běžná navigace globální službu nezastavuje.

Identity adapter zahrnuje authenticated, UID, profil, roli a ověření e-mailu; hook je napojen na existující refreshAccountUI. Guard je pro čtecí cestu, **nenahrazuje plánovanou A1 hranici přihlašovacích/zápisových operací** ani serverová Rules.

## Ověření

- `node --test tests/match-challenges.test.cjs`: **9 PASS**, skutečný produkční modul. Cache/legacy/UID/logout/quota, merge a mutable alias, souběh, stale A→B i A→B→A, delayed JSON, starý finally, error/retry, force upgrade, stop/dispose, 20 restartů, bfcache, hidden interval a startup.
- Produkční Node sada s třemi lokálními exporty: **297 PASS / 0 FAIL / 0 SKIP**. Veřejný CI bez soukromých souborů vykáže 3 explicitní fixture skips; skutečný stav CI je uveden v PR.
- Experimentální sada kandidát i samostatná kopie výchozího main: **28 PASS / 2 FAIL / 0 SKIP**. Celá sada není zelená. Zdroje experimentu a testů porovnány s main beze změny.
- První experimentální vada `preview-match-reload-recovery:50`: preview při dočasně nedostupné identitě vrací false a neodpojí editovatelný zápas; požadavek zachování disku při čekání zůstává. Druhá `:155`: samotné stale UID bez authenticated stačí experimentálnímu ownership predicate k přístupu. Jde o dvě odlišné vady; core z test-modular není v produkčním načítání.
- `match-challenges-browser.cjs`: desktop 1440×1000 / mobile 390×844, skutečný modul + aplikace, mock Firebase. Souběžné refresh+players GET sdílené, draft poznámky/místa/oponenta zachován, skutečné předvyplnění 10-ball/race-to7/správní hráči. Deset navigačních průchodů, A→B a stará odpověď, 503 a retry, 20 restartů bez růstu prostředků. Notifikace 9a přes skutečný provider: původní eventy a UID A/B read-state oddělené. Žádný Firebase zápis, žádná JS chyba.
- `match-challenges-comparison.cjs`: skutečný archiv 40 913 440 B / 189 zápasů / 26 profilů + 3 syntetické challenge profily. Stejné HTML a texty seznamů, přehledů a centra před/po na obou viewports. Oba původní read/cache defekty reprodukovány nad skutečnými funkcemi main.
- Medián 7 měření po warmupu, vždy 100 rebuild+render: desktop **284,6 → 285,5 ms**, mobile **362,2 → 334,4 ms**. Jednorázové měření headless browseru, nikoli dlouhodobá provozní záruka; přesun není deklarovaná optimalizace. Archivní JSON pouze v izolaci.
- Bootstrap všech 11 modulů včetně explicitní chyby chybějícího modulu PASS (22 desktop/mobile scénářů). Regrese skutečných recovery/Auth cest s mockem, turnajů v101 (quota/draft/rozdílné fáze/zápasy/FC izolace), readeru8a, OBS izolace a skutečné A1/A2/B PNG/PDF + Singles/Doubles/Team XLSX PASS.
- Audit 12 původních writer/start/presence těl: přesná shoda s main. Statistiky, writer XLSX, Firebase Rules, OBS, cache archivu a PDF beze změny.

### Samostatně hlášené neúspěchy a omezení

`notification-center-browser.cjs` **FAIL** na přísné PNG paritě desktopového panelu: přesně stejné dva otisky `52f2700d…` / `3ddcfff1…` jako evidováno v109. Test zůstal nezměněný; není zahrnut mezi dvě experimentální vady. Tato přísná sada skončí před mobilní částí; samostatné nové funkční testy skutečného provideru a centra pokrývají oba viewports. Neprohlašujeme celou browserovou sadu za zelenou. Mobilní překrytí panelu/zvonku zůstává samostatný úkol, bez úpravy CSS.

Živý Auth, Firebase Rules a reálné souběžné zařízení nebyly ověřeny. Testy používají mock identity/endpoints; produkční data nebyla načtena jako testovací cíl ani měněna. Původní přijaté operace se zde nemigrují.

**Zbývající 9b2:** celé profilové PUT bez If-Match mohou ztratit souběžnou změnu z jiného zařízení; lokální mutace před await a pozdní dokončení writeru mohou zasáhnout jinou relaci či nový formulář. Nejsou vyřešeny sdílením GET. Nelze slíbit exactly-once serverovou transakci nebo bezpečně automaticky opakovat nejasný PUT. Již odeslaný zápis není zrušen odhlášením. Před přesunem mutací je nutná samostatná A1 hranice zachycené identity/autorizace a návrh řešení konfliktů (např. podmíněná aktualizace minimálního uzlu, až po schválení; nové schéma/protokol zde nezavádíme). Starý counter dialog a pendingScheduledChallenge patří do tohoto navazujícího controllerového kontraktu. V tomto PR nejsou změněny.

## Návrat

Reverze tohoto jediného PR s novým číslem vydání podle AGENTS vrátí aplikaci a deset původních modulů; bez vracení nebo migrace dat. Nové lokální per-UID klíče lze ponechat, starší aplikace je ignoruje a původní klíč zůstal zachován. Reverze ale vrátí doložené read/cache vady; přednostně posoudit úzký hotfix. Nic zde není sloučeno ani nasazeno a A1/9b2/9c nejsou zahájeny.

[Strojový souhrn](challenges-stage-9b1-verification.json). [Desktop](screenshots/challenges-9b1-desktop.png), [mobil](screenshots/challenges-9b1-mobile.png) — výhradně syntetické výzvy.
