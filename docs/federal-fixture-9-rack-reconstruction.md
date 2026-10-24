# Federal Cup #9 – doložená rekonstrukce vlastních rozstřelů

Zadavatel: Dominik. Datum: 24. 10. 2026. Doplnění kandidáta v4.51.96 RC ve stejném PR #34. **Neslučovat a nenasazovat.**

## Výsledek a zdroje

Úplný skutečný export `(2)` obsahuje osm jednoznačných racků. Předchozí závěr o nedostupnosti výsledků byl příliš úzký: správně chybí kanonický rackový ledger, ale přeživší události a undo snapshoty dokládají všechny přechody. Žádný vítěz nebyl odvozen z počtu potopených koulí nebo ze střídání breaku.

Každý řádek níže je ověřen současně: aktuálním detailedPlay záznamem skutečného breaku; snapshotem před breakem (číselný breaker/turn/rackNumber/scores); kanonickým legálním strkem s vítěznou devítkou; snapshotem před tímto strkem; událostí zvýšení skóre o jediný bod stejné straně; a následujícím rackovým snapshotem (poslední rack aktuálním koncovým stavem). Jména nejsou klíčem identifikace. V tabulce SK = Mark Szabo + Jakub Koniar; CZ = Tom Kurz + Jan Meisner.

| Rack | Skutečný breaker | Vítěz | Skóre po racku | Záznam breaku | Vítězný strk | Událost skóre |
|---|---|---|---|---|---|
| 1 | CZ | SK | 1:0 | `bc79e40e-80fc-45c3-b0db-ca0ec63079a7` | `e633a04a-8db3-4d1a-aeca-d1537bc14f1b` | `98163445-ee1e-44d0-a55f-e5a85e78eb26` |
| 2 | SK | CZ | 1:1 | `ec95f685-551a-4634-a2f9-c63a45a98852` | `ddf9dab5-aad3-4d7a-8af7-27e73c57d63b` | `0fe1afdb-1842-4cb6-8bd8-804327b2d18f` |
| 3 | CZ | CZ | 1:2 | `567bcea9-58e8-40ed-8f68-245054ad7da0` | `eab00f7e-aee7-4b7d-851d-0776669afccf` | `680a9b48-6ca9-4143-9176-9e90751f032c` |
| 4 | SK | SK | 2:2 | `ff15f2a1-7082-4ade-a980-d3cf80806cc8` | `fe3061f5-5390-4765-8856-a4c6636aa9f0` | `06d114e3-367e-4be8-b94d-38bbef3277e4` |
| 5 | CZ | SK | 3:2 | `c197ef85-9814-470a-9c4d-a3314093fd33` | `11f14576-a326-4bf4-9167-4f62375e6f55` | `7bdfa56f-2ac9-429a-9665-8800136ef82c` |
| 6 | SK | CZ | 3:3 | `1773e9cc-5a8a-4170-9495-e4656c69cb1f` | `a25e0d8f-ae5d-4374-bde7-f9f888fafa5e` | `faa3c8bf-0e2d-437a-be7e-bfe8d607c80b` |
| 7 | CZ | SK | 4:3 | `0229bc64-9832-450c-9b7e-d5bbee1d6d05` | `3e226658-f0dd-47f1-a086-bf36121d8d6a` | `c1af65ee-99e3-465b-8368-c4673d8aa655` |
| 8 | SK | SK | 5:3 | `484b7e3b-f14b-4372-9cbb-11631064ca5e` | `5701a46b-a9a9-4786-a958-986d10942322` | `b0add8a6-e55d-4a62-a597-e97ccb3d5cd9` |

Úplná ID prvního a koncového snapshotu pro každý rack jsou ve [strojové evidenci](federal-fixture-9-rack-evidence.json), společně s before/after skóre. Všechny snapshotové záznamy odpovídají prefixu právě uloženého detailedPlay po normalizaci Firebase (null a prázdné kolekce v cloudu mizí). Nesčítají se kopie strků uvnitř snapshotů. Undo v aplikaci obnoví stav a odstraní události od vrácené akce pomocí events.splice(i); fallback navíc odmítá vracející se rack/prefix, cizí ID, duplicitní události a rozpory.

**Výsledné metriky:** SK2/4 vlastních breaků vyhraných,2prohrané; CZ1/4 vyhraných,3prohrané. Pushout Break and win2:1 / Break and lose2:3. Poty48:12 a pokusy48/51 proti12/14 zachovány.

## Rozsah a bezpečnost výpočtu

- Existující federalTeam/federalEvidence rackový ledger má vždy přednost, i když je neúplný nebo prázdný. Historie se k němu nikdy nepřičítá.
- Fallback se použije jen pro úplně doložený dokončený běžný 9/10-ball zápas bez týmového rackového ledgeru. Všechna racková čísla musí být souvislá a všechny score přechody jednoznačné. Výsledek zůstává pouze v paměti společného API a v diagnostických components; žádná změna exportu nebo uložených dat.
- V konkrétním #9 všech osm racků končí potopením devítky. Rack3 kombinací přes4, racky4 a8 mají navíc záznam B&R, rack5 dohrávku po soupeřově dry breaku. Tyto nálepky nejsou použity jako důkaz vítěze.
- Esa, faulová ukončení a ruční korekce prověřeny v aplikačním toku: winRack zapisuje výsledek, běžný faul ani push out nejsou vítězstvím. Úzký historický fallback bez legálního game-ball strku tato ukončení neodhaduje; kanonická racková evidence je nadále zpracovává stávající cestou. Testy bez důkazu vrací unknown.
- Pokud některý důkaz chybí nebo nesouhlasí, fallback vrací prázdný výsledek a stávající API zachová unknown. Žádné domýšlení vítězů podle skóre5:3 nebo počtu koulí.

## Testy a skutečné soubory

- Nová historie skutečného zápasu:14/14 cílených testů PASS, včetně soukromého úplného exportu a Firebase roundtripu. Ověřeno všech8breaker/winner párů, neměnnost dat, přednost kanonických racků, chybějící důkazy, duplicitní/vrácené větve, korekce, faul/eso bez důkazu a poškozený JSON.
- Celá Node sada:225PASS/2známéFAIL/0SKIP ze227. Známé preview-match-reload-recovery:50/:106 jsou vykázány samostatně. CI není plně zelené.
- Skutečný aktuální index.html s úplným exportem v izolovaném Chrome: desktop/mobil všech13metrik/A2/páry a skutečná stažení PNG/PDF/XLSX PASS,0Firebase požadavků/0zápisů/0JS chyb; původní soubor nezměněn.
- Nezávislá kontrola stažených souborů: PNG1920×1080, PDF16:9 a pixelově stejné jako PNG; XLSX přesně Pushout/Metadata, všech9metrik a procentní formáty správné, desktop/mobil XLSX byteově stejné.

[A1 PNG](screenshots/federal-96-linked-doubles-A1.png) · [desktop dialog](screenshots/federal-96-linked-doubles-desktop.png) · [mobil dialog](screenshots/federal-96-linked-doubles-mobile.png) · [PDF](examples/federal-96-linked-doubles.pdf) · [Pushout XLSX](examples/federal-96-linked-doubles.xlsx)

Produkce v4.51.95 RC zůstává beze změny. Živá Auth/Firebase relace, fyzický iPhone/Excel/OBS neověřeny.
