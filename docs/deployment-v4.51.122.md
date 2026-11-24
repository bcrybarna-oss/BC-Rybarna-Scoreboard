# Nasazení v4.51.122 RC

Zadavatel: Dominik. Datum ověření: 24. 11. 2026. Stav: **nasazeno a v níže popsaném rozsahu ověřeno**.

- Produkce: [Poolčítadlo](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/).
- [PR #70](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/70) sloučen standardním merge se zachováním obou commitů. Schválený head `1c551e1bcfb35946b6ab5ef9249916fcb0df946b`, výchozí main `a4960aa24dfb041157202a9a38c765ec6391c813`.
- **Aplikační merge: `f3a503f6fb5122d76e36a044cc6bc2872ae6d4ce`.** Produkční soubory jsou shodné se schváleným PR; žádná dodatečná funkční změna.
- [GitHub Pages 45387811562](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45387811562): **build SUCCESS / deploy SUCCESS**. Automatický deployment nebyl ručně opakován.
- PR #55 zůstává otevřený, nesloučený a nedotčený, head `4b50f7cabbfc0c77be2fac35bbde4f4b2c2b8e74`. Ostatní otevřené PR beze změny.

Čistě dokumentační pokračování nemění aplikaci ani verzi. Jeho commit a výsledný aktuální main jsou v závěrečném předání; vlastní budoucí SHA dokument nelze vložit do téhož vytvářeného commitu. Případný automatický Pages běh dokumentace není novým aplikačním vydáním.

## Skutečná veřejná produkce

Tři nové anonymní Chrome kontexty: **1440, 390 a 320 px**, vypnuté service workery, kontrolní URL s merge SHA a HTTP čtení bez cache. Veřejné soubory ani veřejné čtecí požadavky nebyly mockované. Potenciální nečtecí požadavky byly preventivně blokované; nenastal ani jeden pokus o ně. Žádný produkční účet nebyl použit.

- Skutečně zobrazovaná **v4.51.122 RC**.
- HTTP 200 a přesná SHA-256 shoda **index.html, overlay.html a všech 15 vlastních JS** s Git blobem merge commitu. HTML: `da60aa45d86f7b07b92f720b8e186d10cfa3c6a8ab6bf9de24a858797460c2c2`.
- Všech 15 vlastních skriptů se skutečně načetlo v prohlížeči, pořadí závislostí správné. Devět aktivně verzovaných modulů má parametr `4.51.122`, zbývající nezměněné moduly dosavadní parametry. Ověření obsahu nezávisí pouze na čísle verze či zeleném workflow.
- Offline tlačítko, základní navigace Úvod → Výsledky → Statistiky → Hráči → Turnaje → Federal Cup → Livescore a návraty na úvod PASS.
- **0 JavaScriptových/ bootstrap výjimek, 0 produkčních zápisů.**

První spuštění kontrolního procesu narazilo na blokované DNS běhového prostředí (ENOTFOUND), nikoli na odpověď aplikace. Po povolení přístupu procesu k veřejnému webu proběhla výše uvedená skutečná kontrola úspěšně.

[Strojový důkaz, HTTP a hashe](deployment-v4.51.122-verification.json). Veřejné screenshoty: [1440](screenshots/deployment-122-public-1440.png), [390](screenshots/deployment-122-public-390.png), [320](screenshots/deployment-122-public-320.png).

## Izolované ověření publikovaných zdrojů

Stažené veřejné HTML a vlastní JS byly nejprve bajtově porovnány s merge a potom použity jako jediný aplikační zdroj v izolované kopii. Testy/fixtures pocházejí z téhož merge. Nejde o lokální kandidát pouze označený za produkci. Síť je kompletně zachycená, syntetické turnaje i obvyklé aplikační presence operace zůstávají pouze v paměťovém mocku. **Toto není ověření živého Auth ani Rules.**

| Scénář | Sloty prvního kola | Výsledek |
| --- | --- | --- |
| 6 hráčů | A–VOLNÝ LOS; D–E; C–F; B–VOLNÝ LOS | PASS 1440/390/320 |
| 7 hráčů | A–VOLNÝ LOS; D–E; C–F; B–G | PASS 1440/390/320 |
| 8 hráčů | A–H; D–E; C–F; B–G | PASS 1440/390/320 |
| 3 skupiny × 2 | A1–VOLNÝ LOS; A2–C2; C1–B2; B1–VOLNÝ LOS | PASS 1440/390/320 |
| 4 skupiny × 2 + ruční cross13/cross14 | uložené ruční pořadí a správné křížené návaznosti | PASS 1440/390/320 |

Celkem **9/9 jedno-skupinových a 6/6 více-skupinových scénářů**. Skutečné DOM pořadí všech pozic a všechny SVG konce odpovídají uloženým slotům i větvím. Standardní SF leží mezi svými dvěma QF a finále mezi SF; ručně křížené větve mají vlastní správné spojnice. Karty volného losu nemají skóre, stůl, akce ani zápasové statistiky. Kontroly zahrnují detail, modal, skutečné Fullscreen API, vnitřní horizontální posun bez posunu ovládání, reload před/po QF, dokončení různými vítězi a opačným pořadím výsledků. Staré seeded/rozehrané/dokončené pavouky bez seedSlots a historický replay jsou nezměněné; bez přelosování. Výsledky a osobní statistiky odpovídají skutečně hraným zápasům. Žádné falešné zápasy BYE. Český text VOLNÝ LOS je zachovaný.

| Šířka | Modal | Detail | Fullscreen |
| --- | --- | --- | --- |
| 1440 | [screenshot](screenshots/deployment-122-isolated-1440-modal.png) | [screenshot](screenshots/deployment-122-isolated-1440-detail.png) | [screenshot](screenshots/deployment-122-isolated-1440-fullscreen.png) |
| 390 | [screenshot](screenshots/deployment-122-isolated-390-modal.png) | [screenshot](screenshots/deployment-122-isolated-390-detail.png) | [screenshot](screenshots/deployment-122-isolated-390-fullscreen.png) |
| 320 | [screenshot](screenshots/deployment-122-isolated-320-modal.png) | [screenshot](screenshots/deployment-122-isolated-320-detail.png) | [screenshot](screenshots/deployment-122-isolated-320-fullscreen.png) |

## CI a přednasazovací regrese

- Před merge čerstvý fetch, beze změny main/head, čisté tracked zdroje, schválený diff, release gate PASS, lokální produkční Node **416 PASS / 0 FAIL / 0 SKIP**. Cizí untracked soubory zachované a nepřidané.
- Přesný head PR: [release/produkce 45385041366](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45385041366) release PASS, **413 PASS / 0 FAIL / 3 SKIP**; [mobilní 45385041953](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45385041953) PASS; [stream 45385041743](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45385041743) PASS včetně controls/isolation/lag.
- Merge main: [45387812303](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45387812303) release PASS, produkční **413 PASS / 0 FAIL / 3 SKIP**. Tři SKIP závisejí na místních soukromých exportech, které na GitHubu nejsou. Nejde o zatajená FAIL; lokálně s fixture vstupy prošly.
- Experimentální **28 PASS / 2 FAIL**, jednotlivě: neověřená identita neodpojí editovatelný uložený zápas; zbytkové UID bez autentizace neoprávněně obnoví vlastníka. Oba výsledky porovnány s výchozím main [45374958405](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45374958405), beze změny. Experimentální core není součástí produkčního načítání. Celkové regresní workflow proto není zelené.
- První streamové CI aplikace [45384438426](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45384438426) timeout ř.103 zůstává evidovaný. Následný finální head PASS a lokální stream-controls na přesném baseline i kandidátu PASS; žádná změna testu kvůli výsledku.
- Historický audit odstraněného žurnálu není testem současné implementace a nebyl znovu spuštěn. Dříve doložené nesouvisející ordinary/viewer/FC tempo baseline vady zůstávají v [diagnostice v121](hybrid-sko-byes-v4.51.121.md). Nebyly skryty ani prohlášeny za nově úspěšné.
- [Přednasazovací rozsah](sko-visual-slots-v4.51.122.md) zachovává 5 hráčů, další více-skupinové scénáře, historické SKO/DKO a mobilní regrese. [Audit sportovních funkcí](sko-visual-slots-verification.json) dokládá bajtovou shodu vůči v121; změna je pouze prezentační.

## Omezení a návrat

Neověřeno: živé přihlášení/Rules v izolovaném autorizovaném Firebase projektu, soukromá přihlášená produkční relace, fyzické telefony/iPhone/Safari a reálné OBS. Mobil znamená Chrome viewport, fullscreen je skutečné browser API. Případné rozdíly zařízení se tímto nezastírají.

Produkční data, zápasy, turnaje ani **Firebase Rules nebyly měněny**. Nebyla provedena migrace. Návrat je revert aplikačního merge PR #70 (první rodič) do nové větve, nové vyšší číslo vydání, release/regresní kontroly a standardní nasazení. Vrací pouze prezentaci v121; sportovní oprava PR #68 a data zůstávají zachované. Bez force push a bez vracení databáze. Další modularizace ani 10b1/10b2 nebyla zahájena.
