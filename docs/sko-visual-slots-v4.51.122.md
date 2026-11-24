# SKO: vizuální pořadí a propojení pevných pozic

Zadavatel: Dominik, navazuje na PR #68. Datum: 24. 11. 2026.

**v4.51.122 RC nasazeno**, merge `f3a503f6fb5122d76e36a044cc6bc2872ae6d4ce` z původního main `a4960aa24dfb041157202a9a38c765ec6391c813` (v121). [Skutečný výsledek nasazení](deployment-v4.51.122.md). PR #55 a ostatní otevřená práce se nemění.

## Příčina a hranice

Modální `bracketRoundHtml` řadí všechny zápasy a potom všechny volné losy. Detail naopak vypisuje volné losy před zápasy. Ani jeden seznam neskládá první kolo podle uloženého slotu. Původní horizontální pseudo-spojnice neznají vztah zdroj/cíl a další kola jsou zarovnaná k hornímu okraji.

Nový read-only model spojuje zápasy a volné losy přes jejich slot a náhled budoucích kol přes existující plán. Obě zobrazení používají jednu implementaci. Karta volného losu má stejný rozměr jako ostatní pozice, přerušovaný zlatý okraj, dva hráčské řádky a označení PŘÍMÝ POSTUP / VOLNÝ LOS. Nemá skóre, stůl, herní akce ani stav DOHRÁNO.

CSS mřížka vychází z počtu pozic a hloubky kola. Následující karta leží uprostřed dvojice svých předchůdců. Spojnice používají stejnou souřadnicovou soustavu v normalizovaném SVG, nikoliv měření jmen nebo náhodné pixely. U ručních variant cross13/cross14 hrany respektují potvrzené napojení; nevydávají je za sousední párování. Vodorovný posun je uvnitř grafu, neposouvá ovládání dialogu. Fullscreen používá skutečné Fullscreen API.

Nezměněné: seedSlots, participantIds, původní pole zápasů a volných losů, sportovní algoritmus, vítězové, statistiky, ukládání/Firebase. Žádné falešné zápasy. Zápas o třetí místo se zobrazuje mimo postupové spojnice. Staré pavouky bez seedSlots se vykreslují podle uloženého pořadí, bez domýšlení slotů a bez falešných větví. DKO renderer/algoritmus se nepřepisuje.

## Pozice

| Vstup | Slot 0 | Slot 1 | Slot 2 | Slot 3 |
| --- | --- | --- | --- | --- |
| 6 z jedné skupiny | A – VOLNÝ LOS | D–E | C–F | B – VOLNÝ LOS |
| 7 z jedné skupiny | A – VOLNÝ LOS | D–E | C–F | B–G |
| 8 z jedné skupiny | A–H | D–E | C–F | B–G |
| 5 z jedné skupiny | A – VOLNÝ LOS | D–E | C – VOLNÝ LOS | B – VOLNÝ LOS |
| 3 skupiny × 2 | A1 – VOLNÝ LOS | A2–C2 | C1–B2 | B1 – VOLNÝ LOS |

U 3×2 vede semifinále 1 z pozic 0/1, semifinále 2 z 2/3 a finále z obou semifinále. U 3×4 zůstává všech osm počátečních pozic a čtyři volné losy na svých uložených místech. Ručně potvrzený hráč G místo A na volném losu se nijak automaticky nepřehazuje.

## Testování

Testy používají současný index.html, reálné DOM a izolované syntetické turnaje. Produkční Firebase se nepoužívá. Nový geometrický pomocník ověřuje pořadí každého slotu v každém kole, typ karty, neměnnost dat při renderování, nulové akce/skóre u volných losů a náhledů, konce všech SVG hran u skutečných karet, centrování a nepřekrývání, skutečný fullscreen a nezávislý vodorovný posun. Staré a dokončené turnaje zůstávají součástí regresí.

Baseline reproduktor na a4960aa selže na skutečném prvním DOM prvku: očekávaný A1 na slotu 0 je až pod zápasy. Kandidát při stejných datech projde. Při rozšíření browseru byla opravena příliš přísná testovací kontrola koncového null v seedSlots: obě strany se porovnávají přes stejnou již používanou Firebase serializaci. Očekávání všech skutečných hráčů a pozic zůstávají zachovaná; žádná aplikace ani data se tím nenormalizují.

Výsledky kandidáta:

- Produkční Node: **416 PASS, 0 FAIL, 0 SKIP** (včetně 16 cílených SKO testů). Release gate proti aktuálnímu main PASS.
- Jedna skupina: **15/15** scénářů (4/5/6/7/8 × 1440/390/320), oba editory, změna jména a bezpečné escapování, různá dokončení/vítězové, reload před i po QF, finále a skutečné statistiky PASS.
- Více skupin: **15/15** scénářů (2×2, 2×3, 3×2, 3×4, 4×2 × tři šířky), neměnnost nasazení a správné větve/statistiky PASS. Dodatečně cross13/cross14 při 4×2 na všech třech šířkách v detailu, modalu a skutečném fullscreen PASS. U křížených větví mají oba cíle vlastní svislou trasu a křížení optické přerušení, nikoliv společnou falešnou sběrnici.
- Staré nemarkerované seeded/rozpracované/dokončené pavouky včetně skutečného fullscreen: 7hráčová matice 1440/390/320 PASS. Geometrie se nepřepočítává do nového nasazení. Historický structure browser včetně SKO/DKO, bronzu, replay a zachování původních dat PASS.
- Mobilní regrese: 8 disciplín/režimů PASS; sólo 14.1 **3/3** PASS. Stream isolation browser PASS, včetně více než 20 s výpadku a obnovení původního streamu, bez změny datové logiky.
- Baseline a4960aa: reproduktor na všech třech šířkách očekávaně selže na skutečném prvním DOM prvku (A2–C2 namísto A1–VOLNÝ LOS). Kandidát stejné vstupy vykreslí ve správném pořadí. Kontrola polí navíc používá přeházené pořadí uložených záznamů a zmrazená vstupní data.
- Experimentální sada **28 PASS / 2 FAIL**, jednotlivě: neověřená identita neodpojí editovatelný zápas; zbytkové UID bez autentizace neoprávněně obnoví uloženého vlastníka. Testovaný experimentální core i oba testy jsou proti výchozímu main beze změn a nejsou součástí produkčního načítání. Nejde o zelené celkové CI.
- Historický audit odstraněného žurnálu nebyl nově spuštěn a není výsledkem současné implementace. Dříve doložené baseline vady ordinary/viewer/stream/FC tempo zůstávají [odděleně evidované](hybrid-sko-byes-v4.51.121.md); tyto nesouvisející browsery zde nejsou nově prohlášeny za úspěšné.
- GitHub CI aplikačního commitu `07563109de987a75e8fe3083af9ac9f04ae4999c`: [Release a produkční Node](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45384437957) PASS (**413 PASS / 0 FAIL / 3 SKIP**, chybějí místní soukromé fixture soubory). Experimentální job má přesně tatáž dvě selhání jako [baseline main](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45374958405). [Mobilní CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45384437988) PASS.
- [První streamové CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45384438426) FAIL: timeout `stream-controls-browser.cjs:103` na ověření spojení, totožné místo jako již doložený v121 timeout. Následné dva skripty se kvůli němu v daném jobu nespustily. Samostatné lokální stream-controls nad přesným a4960aa **i kandidátem** prošly (simple/full, čtyři viewporty, reálný izolovaný overlay, reload, 0 JS chyb); nezávisle stream-isolation i stream-lag PASS. Selhání prvního CI se tím neskrývá ani nepřepisuje na PASS. Streamový test, overlay a veškeré streamové funkce zůstávají beze změny. Stav případných následných běhů na čistě dokumentačním pokračování je přímo v [PR #70](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/70).

[Audit nezměněných sportovních funkcí a SHA-256 testovaného index.html](sko-visual-slots-verification.json). DKO renderer, algoritmy nasazení a postupu, zpracování výsledku a historický replay jsou bajtově shodné s a4960aa. SHA-256 kandidáta: `da60aa45d86f7b07b92f720b8e186d10cfa3c6a8ab6bf9de24a858797460c2c2`.

## Screenshoty skutečných browserů

Stejná izolovaná data 3×2, desktop i mobilní viewporty Chrome. Před/po jsou skutečná vykreslení baseline/kandidáta; do obrázků není doplněné simulované UI. Mobilní graf se posouvá uvnitř svého kontejneru, čtyři karty se tedy nevejdou do jedné výšky screenshotu. DOM a souřadnice ověřují všechny pozice i mimo aktuální výřez.

| Šířka | Modal před | Modal po | Detail před | Detail po | Fullscreen po |
| --- | --- | --- | --- | --- | --- |
| 1440 | [před](screenshots/sko122-before-1440.png) | [po](screenshots/sko122-after-1440.png) | [před](screenshots/sko122-detail-before-1440.png) | [po](screenshots/sko122-detail-after-1440.png) | [fullscreen](screenshots/sko122-fullscreen-1440.png) |
| 390 | [před](screenshots/sko122-before-390.png) | [po](screenshots/sko122-after-390.png) | [před](screenshots/sko122-detail-before-390.png) | [po](screenshots/sko122-detail-after-390.png) | [fullscreen](screenshots/sko122-fullscreen-390.png) |
| 320 | [před](screenshots/sko122-before-320.png) | [po](screenshots/sko122-after-320.png) | [před](screenshots/sko122-detail-before-320.png) | [po](screenshots/sko122-detail-after-320.png) | [fullscreen](screenshots/sko122-fullscreen-320.png) |

## Omezení a návrat

Živé Auth/Rules a fyzické mobilní prohlížeče nejsou ověřené mocky. Fullscreen se testuje skutečným API v Chrome s danými viewporty; dostupnost API na fyzickém iPhonu/Safari není tímto ověřena.

Revert celého UI PR v novém vydání vrátí prezentaci v121 bez potřeby vracet data. Nový kód nezapisuje žádná prezentační metadata do turnajů. Nasazená oprava sportovního nasazení z PR #68 se nerevertuje.
