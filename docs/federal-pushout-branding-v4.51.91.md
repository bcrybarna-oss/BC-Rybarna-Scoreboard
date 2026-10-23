# Pushout Federal Cup – branding reportů v4.51.91 RC

Zadavatel: Dominik, 23. 10. 2026. Pokračování **stejné větve a PR #29**, společně s opravou quick-finish. **Nesloučeno a nenasazeno.**

Originální žluté logo Pushout Sports (3000 × 410, transparentní PNG) je beze změny v assets/pushout-sports-logo-yellow.png. Společná šablona jej umísťuje doprostřed, 600 × 82 px, nad zlatý nadpis. Poolčítadlo vlevo a devítková koule vpravo zůstávají; A1/A2 mají FEDERAL CUP 2026, B původní INDIVIDUÁLNÍ STATISTIKY s FEDERAL CUP 2026 pod ním. Logo, soutěž a typ reportu tak mají společnou hierarchii. Nezměnila se pozice statistik, skóre, panelů ani patičky.

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
