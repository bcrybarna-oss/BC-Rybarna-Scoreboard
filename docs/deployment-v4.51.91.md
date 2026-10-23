# Nasazení v4.51.91 RC

Zadavatel: **Dominik**. Ověřeno **23. 10. 2026, 12:27 CEST (10:27 UTC)**. Stav: **nasazeno a v níže vymezeném rozsahu ověřeno**.

## Sloučení, Pages a publikované soubory

- [PR #29](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/29) sloučen metodou **merge** se zachováním všech commitů. Očekávaná hlava `1da968f0dcf3330cfbc09bb8927d756128045bfa` ověřena při merge; žádný force push.
- Merge/main: **98cc286de7f77526c37a7bc706156b33630611c7**. Proti schválené hlavě PR žádný rozdíl v index.html, overlay.html ani assets/. Zahrnut quick-finish, stručné reportové hodnoty, samostatné řádky Doubles a finální Pushout Sports hierarchie A1/A2/B.
- Před merge aktuální main `3bdc844`, bez nového souběhu nebo konfliktu. Release gate proti čerstvému origin/main PASS; sledovaný pracovní strom čistý, cizí nesledované screenshoty/output/tmp zachovány.
- [Automatický Pages run 39939112485](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39939112485): **build, deploy, report-build-status success**. Úspěšné nasazení nebylo ručně opakováno.
- [Veřejná aplikace](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/): skutečně **v4.51.91 RC**, ověřena hlavička, O aplikaci a title overlaye.
- Běžná root/index URL i fresh URL s ověřovacím parametrem HTTP200 a stejné bajty. index.html, overlay.html a pět reportových/brandových assetů včetně originálního Pushout loga: HTTP200 a **přesná SHA-256 shoda s merge commitem**. Čerstvý browser context, service workers vypnuté, fetch no-store; nejde jen o zobrazené číslo ze staré cache.
- index.html SHA-256: `fe44864981201f1f421b91fd8407f72f06676665278f11bf6f850f541f1f1aae`.
- overlay.html SHA-256: `e4b45d02501a47b343e68b514f11f5215d99fe99b175d9065a00ce5ae8410a6b`.

[Strojová evidence](deployment-v4.51.91-verification.json) obsahuje čas, hashe, velikosti souborů, obrazovky, dostupnost reportů a výsledky browseru. Následný dokumentační commit nemění aplikační soubory ani verzi.

## Bezpečný produkční smoke test

Skutečné veřejné nemodifikované HTML, nový nepřihlášený profil, offline režim. Do produkční stránky nebyla vložena syntetická data. Všechny Firebase/Auth požadavky a všechny metody kromě GET/HEAD blokované před odesláním. **0 JS/pageerror, 0 console error, 0 pokusů o zápis**, žádný založený zápas ani změna soupisky/výsledků.

| Oblast | Výsledek | Omezení |
| --- | --- | --- |
| Aplikace | Domů, nastavení, hráči, O aplikaci a Federal Cup načteny; správná verze91, assety dostupné. | Nepřihlášená relace. |
| Federal Cup | Výsledková tabule, program 21 zápasů a soupisky dostupné; odstraněná tabulka Statistiky obou týmů a původní detailní tlačítko nejsou v DOM. | Neověřuje skutečné cloudové výsledky a soupisky. |
| A2 | Dva vstupy souhrnu, 13 metrik, originální Pushout logo načtené jako3000×410, správná hlavní hlavička, vysvětlivky, mobilní zoom/Escape. | Prázdný offline souhrn s pravdivými unknown údaji. |
| PNG/PDF | Skutečné veřejné A2 downloady přes veřejné CDN knihovny: PNG **1920×1080**, PDF jedna stránka **1440×810 pt (16:9)**. Vložené pixely PDF přesně odpovídají PNG; PNG a mobilní dialog vizuálně prohlédnuty. | Žádný předstíraný kompletní soutěžní report. |
| A1/B, 0/0, partial, dlouhé dvojice | Stejný produkční kód jako ověřené izolované A1/A2/B a quick-action exportní testy. | V nové offline relaci není uložený zápas ani hráč: A1/B mají0 tlačítek a nebyly produkčně datově ověřeny. 0/0, partial a dlouhá jména ověřena izolovaně, nikoli na reálných zápasech. |
| Počítadlo | Výchozí Bez streamu, přepnutí volby před startem, skrytá URL při vypnutí; streamový panel v DOM za herními akcemi, UNDO, tempem/rozstřelem. | Žádný produkční zápas nebyl zahájen; bodování/UNDO/obnova ověřeny předchozími izolovanými regresními testy. |
| Overlay | Veřejný soubor správné verze a přesných bajtů, bez UID ukazuje nedostupnost, žádné cizí skóre. | Reálné OBS neověřeno. |

Produkční screenshoty: [Federal Cup desktop](screenshots/release91-production-federal-desktop.png), [mobilní zvětšený A2 dialog](screenshots/release91-production-dialog-mobile.png), [nastavení mobil](screenshots/release91-production-setup-mobile.png). Zvětšený náhled používá posun, ovládací tlačítka zůstávají dostupná.

## Regrese a CI

- Poslední izolované testy schválené hlavy: quick-finish 1–9 koulí, Singles/Doubles/Team, actor, oprávněnost/klasifikace, multipot/MISS, unknown stůl, jediné počty, UNDO/save/reload **PASS**.
- Exportní regrese skutečných snapshotů rychlých akcí: 9 koulí /9 pokusů /100 %, 0/0, partial*, bez partial sloupce a dvojího započtení **PASS**.
- Obecné A1/A2/B exporty, dlouhá jména, 13 metrik, host/barvy, identita, mobile DPR3, preview/export, zoom, focus/Escape, XSS, error/cancel/dvojklik **PASS**. PNG1920×1080, PDF16:9 a přesné vložené pixely; obsah od y250 dolů pixelově totožný s předchozí schválenou kompozicí.
- Merge nepřinesl změnu aplikačních bajtů proti těmto testům; scénáře vyžadující zápis nebyly kvůli nasazení opakovány na produkci.
- [PR CI finální hlavy 39937800261](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39937800261): release **success**, Node **189/191 failure**.
- [Main CI po merge 39939108785](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39939108785): **Release version and revision success**, Node **189/191 failure**. Log jobu120365862636 potvrzuje výhradně `preview-match-reload-recovery.test.cjs:50,106` v test-modular. Testy, modularizace a workflow nejsou v PR změněné; jde o známé nesouvisející chyby. Žádné nové selhání. **CI není plně zelené.** Nic nebylo vypnuto, skryto ani upraveno pro pouhý úspěšný výsledek.

## Omezení a stav dokumentace

Skutečné uložené A1/B a cloudové statistiky, produkční Auth/Firebase/Rules, fyzický iPhone/iOS a reálné OBS zůstávají **neověřené**. Quick-finish se uplatní na nové akce; existující dokončené zápasy se nemigrují ani zpětně nepřepisují.

PROJECT_STATUS.md a PROJECT_CONTEXT.md označují produkci91; REVIZE.md obsahuje nový pravdivý záznam nasazení a zachovává historii přípravy kandidáta. Tento následný commit je čistě dokumentační a verzi nezvyšuje. Před pushem se znovu ověří remote main a zachová cizí práce. Případný automatický Pages běh po dokumentaci není ruční opakování nasazení; nemění otestované aplikační soubory.
