# Pushout Federal Cup – branding reportů v4.51.91 RC

**Aktuální stav 23. 10. 2026:** PR #29 schváleně sloučen a verze v4.51.91 RC nasazena. [Deployment report](deployment-v4.51.91.md). Níže zachovaná historie přípravy kandidáta; tehdejší zákaz merge/deploy byl nahrazen následným výslovným souhlasem zadavatele.


Zadavatel: Dominik, 23. 10. 2026. Pokračování **stejné větve a PR #29**, společně s opravou quick-finish. **Nesloučeno a nenasazeno.**

Originální žluté logo Pushout Sports (3000 × 410, transparentní PNG) je beze změny v assets/pushout-sports-logo-yellow.png. Společná šablona jej umísťuje doprostřed, 456 × 62,32 px (o 24 % menší než předchozích 600 × 82), nad zlatý nadpis. Poolčítadlo vlevo a devítková koule vpravo zůstávají; A1/A2 mají FEDERAL CUP 2026, B nově stejný hlavní FEDERAL CUP 2026 a pod ním INDIVIDUÁLNÍ STATISTIKY. Logo, soutěž a typ reportu tak mají společnou hierarchii. Pod logem je měkké lokální ztmavení pomocí radiálního SVG přechodu; nemá viditelný obdélníkový okraj. Logo končí nad titulkem, který má stále stejnou pozici. Nezměnila se pozice statistik, skóre, panelů ani patičky. Porovnání exportů před/po potvrzuje pixelově totožný celý obsah od y=250 dolů u A1/A2/B.

Plakát není dostupný; vycházíme z originálního loga a následného výslovného popisu a souhlasu zadavatele pokračovat bez plakátu. Nejde o jeho přesnou reprodukci.

## Ověření

- Quick-finish browser PASS: 1–9 koulí, Singles/Doubles/Team, actor, klasifikace, žádné dvojí započtení, unknown, multipot/MISS, undo/save/reload.
- Quick-action report/export browser PASS: A1/A2/B 9/9 = 100 %, 0/0, partial*, dlouhá jména, mobil, skutečné PNG/PDF.
- Obecný export browser PASS: A1/A2/B, všechny typy zápasů, 13 metrik, PNG 1920 × 1080, PDF 1440 × 810 (16:9), mobil DPR3 bajtově shodný PNG, preview/export, cancel/error/dvojklik. Ověřeno načtení originálního loga a centrování nad titulkem bez kolize.
- UI a report browser PASS: desktop/mobil, zoom/pan, focus/Escape, identity, barvy/host, partial/unknown, XSS, neměnná data/storage; žádné Firebase volání/zápisy ani JS chyby.
- Node **189/191**: pouze dvě známá selhání preview-match-reload-recovery.test.cjs v test-modular, CI není plně zelené.
- Diff produkčního HTML proti předchozí hlavě obsahuje pouze společné reportové logo/CSS/exportní kontrolu rozměrů. Výpočetní API a quick-finish logika nezměněny. Dodané logo bajtově totožné.

## Skutečné výstupy ze syntetických dat

| Report | PNG | PDF |
| --- | --- | --- |
| A1 zápas | [PNG](screenshots/federal-91-pushout-match.png) | [PDF](examples/federal-91-pushout-match.pdf) |
| A2 reprezentace | [PNG](screenshots/federal-91-pushout-teams.png) | [PDF](examples/federal-91-pushout-teams.pdf) |
| B hráč | [PNG](screenshots/federal-91-pushout-player.png) | [PDF](examples/federal-91-pushout-player.pdf) |

[Desktopový dialog](screenshots/federal-91-pushout-desktop-dialog.png), [mobilní dialog](screenshots/federal-91-pushout-mobile-dialog.png). Ukázky jsou výhradně syntetické. Exporty a oba dialogy vizuálně prohlédnuty.

Bez testovacích produkčních zápisů. Produkční Auth/Firebase/OBS a fyzický iPhone nejsou tímto ověřené. Verze zůstává nevydaný kandidát v4.51.91 RC; čeká vizuální schválení, bez merge/deploy.

## Předchozí varianta – historie commitu a CI

Kód a výstupy: **19fe4531ddb18e82bacc194320b461f3e9e2cb90**, pushnuto do [PR #29](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/29). Následný dokumentační commit nemění aplikaci. [CI 19fe453](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39935348433): Release version and revision **success**, Node **189/191 failure**, log potvrzuje pouze známá selhání preview-match-reload-recovery.test.cjs:50,106 v test-modular. Žádná nová regrese; CI není plně zelené. Release gate proti čerstvému main3bdc844 a diff --check PASS. Nesloučeno a nenasazeno.

## Finální doladění hlaviček (23. 10. 2026, Dominik)

Všechny šablony mají hierarchii logo → FEDERAL CUP 2026 → typ reportu. A1 dynamický zápas/číslo/disciplína, A2 STATISTIKY REPREZENTACÍ, B INDIVIDUÁLNÍ STATISTIKY. Logo 456 × 62,32 zachovává původní proporce a zdroj. Předchozí varianta měla logo600×82 a u B opačnou hierarchii nadpisů. Historické výstupy jsou dostupné v commitu 19fe453.

Čerstvě zopakovány: obecné PNG/PDF A1/A2/B, desktop/mobil DPR3, preview/export, zoom/pan, focus/Escape, dlouhá jména, partial/unknown/XSS; quick-finish browser i exportní test nad jeho aktuálními snapshoty. Vše PASS, žádné reálné Firebase požadavky/zápisy. Node189/191 jen známé dvě chyby :50/:106. Výpočetní API a quick-finish logika beze změny. PDF1×1440×810, PNG1920×1080 a přesné vložené pixely všech tří PDF ověřeny; statistiky, panely i patička od y250 dolů pixelově totožné s předchozími výstupy. Aktuální PNG/PDF a oba dialogy v odkazech výše nahrazeny novými skutečnými exporty. Finální kód a výstupy **b6724537b127984079edfab12a3ce5cd916e1998**, následný dokumentační commit nemění aplikaci. [CI b672453](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39937625196): Release version and revision **success**, Node **189/191 failure**; log potvrzuje pouze známá selhání preview-match-reload-recovery.test.cjs:50,106 v test-modular. Žádná nová regrese, CI není plně zelené. Lokální release gate po čerstvém fetchi main3bdc844 a diff --check PASS. Nesloučeno a nenasazeno, čeká grafické schválení a ruční kontrola statistik před vydáním.
