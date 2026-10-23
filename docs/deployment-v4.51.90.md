# Nasazení v4.51.90 RC

Zadavatel: **Dominik**. Ověřeno **23. 10. 2026**, veřejný browserový záznam 10:16 CEST (08:16 UTC). Stav: **nasazeno a v níže vymezeném rozsahu ověřeno**. Žádný nový funkční commit, nová verze ani opakovaný merge.

## GitHub a skutečná produkce

- [PR #28](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/28) sloučen mimo Codex, potvrzeno API a čerstvým git fetch. Merge/main **fe696f477d37f1f8ad2c99e242c1d789c746071c**; aplikační soubory stejné jako otestovaný kandidát 7c5fa74/ded86bc.
- [Automatický Pages run 39922449218](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39922449218): build, deploy i report-build-status **success**, head_sha fe696f4. Úspěšný deployment nebyl ručně opakován.
- [Veřejná aplikace](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/): hlavička a informace o aplikaci **v4.51.90 RC**, overlay title rovněž v4.51.90 RC.
- Běžné root/index URL i nové URL s ověřovacím parametrem byly HTTP 200. Veřejné index.html a overlay.html přesně bajtově shodné s merge commitem; čtyři ověřené reportové/brandové assety také HTTP 200 a shodné SHA-256. Ověřeno čerstvým fetch no-store a v novém browser contextu bez service workerů, ne pouze nápisem verze z cache.
- index.html SHA-256: `b9ff691efec1730ec6fa2d3969e096c9a67f694fe1b69ee2f239d45e3557e289`.
- overlay.html SHA-256: `f7ed303b9b99fa215cbb69060b819747f408e709f0d27fd545295a3a39a5f215`.

Podrobné velikosti, assety, hashe a naměřené výsledky: [JSON evidence](deployment-v4.51.90-verification.json).

## Bezpečná produkční kontrola

Skutečné nemodifikované veřejné HTML, čerstvý profil, bez přihlášení a bez syntetických dat vložených do produkční stránky. Veškerá Firebase/Auth komunikace a všechny metody kromě GET/HEAD blokované. **0 pokusů o zápis, 0 pageerror i console error**, žádný vytvořený zápas, změna soupisky/výsledků ani skutečné přihlášení.

| Oblast | Ověřeno na veřejném webu | Omezení |
| --- | --- | --- |
| Navigace | Domů, nastavení, hráči, O aplikaci, Federal Cup načteny přes navigační ovladače. | Přihlášené/administrátorské cesty se neaktivovaly. |
| Federal Cup | Tabule, 21 položek programu, soupisky, 2 tlačítka A2; stará tabulka ani detailní tlačítko nejsou v DOM. | Fresh offline relace nemá uložené zápasy ani hráče; A1/B nejsou dostupné a správně nemají tlačítka. |
| A2 | 13 metrik, vysvětlivky a pravdivé neznámé údaje, mobilní dialog/zoom/Close/Escape. Skutečný PNG/PDF export přes veřejné CDN knihovny. PNG 1920×1080, PDF jedna stránka 1440×810 pt; vložené pixely přesně odpovídají PNG. | Export prázdného offline souhrnu; neověřuje skutečné cloudové statistiky. |
| Počítadlo | Výchozí Bez streamu, zapnutí/vypnutí volby před startem, URL skrytá při vypnutí. DOM pořadí streamového panelu pod bodováním/UNDO/tempo/rozstřel. | Na veřejném webu nebyl zahájen žádný zápas; funkční bodování/obnova jsou izolované testy. |
| Overlay | Veřejný overlay.html správné verze a hashe, bez UID ukazuje nedostupnost a žádné skóre. | Reálný OBS přenos se neotevíral; izolace a výpadky ověřeny zvlášť. |
| Nasazování | Nasazený kód je přesně otestovaná implementace. | Na produkci se needitovaly soupisky ani nespouštěla validace změnou skutečných dat. |

Skutečné produkční screenshoty: [Federal Cup desktop](screenshots/release90-production-federal-desktop.png), [A2 dialog mobil](screenshots/release90-production-dialog-mobile.png), [nastavení mobil](screenshots/release90-production-setup-mobile.png). Prázdný offline přehled není prezentován jako ověřená produkční statistická data.

## Izolované regrese současného main

- Čerstvě 74/74 unit: výpočty/13 metrik, evidence Jump/Bank, reportová data a 5 lineup testů pro všechny bloky a 60 kombinací opakované dvojice.
- Federal-lineup browser PASS: chyby obou reprezentací, pořadí, stabilní ID po přejmenování/přesunu/CAS save/reloadu, staré tlačítko i změněná připravená nominace odmítnuty.
- Stream-controls browser PASS simple/full: Bez streamu a zapnuto, první SOON publikace, všechny režimy, 0 OBS publikací při vypnutí včetně bodování/UNDO/reloadu, obnova a legacy, mobil/desktop/orientace/320px a panel pod akcemi.
- Report browser PASS A1/A2/B: identity, 13 metrik, barvy/hostitel, partial/unknown, dialog/focus/Escape, staré detailní statistiky mimo FC.
- Čerstvé izolované skutečné PNG/PDF A1/A2/B na sloučeném main PASS: Singles/Doubles/Team, 13 metrik, desktop/mobil DPR3, PNG1920×1080 a PDF16:9, chyby/cancel/ochrana dvojitého exportu, neměnné data/storage a 0 Firebase požadavků/zápisů/JS chyb. Průměrný RGB rozdíl náhledu/exportu zůstává A1 6,08/5,41/5,32; A2 6,72/6,01/5,83; B 6,56/5,71/4,63.
- Testovací Firebase/Auth backendy jsou výhradně mocky. Žádný produkční zápis. Grafika, výpočty ani aplikace se kvůli ověření neupravují.

## CI po merge

[Run 39922449965](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39922449965): **Release version and revision success**, Node **184/186 failure**. Log jobu 120310665365 potvrzuje výhradně známá selhání `preview-match-reload-recovery.test.cjs:50,106` nad test-modular; žádná nová regrese. CI není plně zelené. Testy/CI se nevypínaly ani neupravovaly.

## Předání a omezení

Vydání je nasazené a ověřené v rozsahu dostupnosti souborů, bezpečné nepřihlášené navigace/UI, prázdného A2 exportu a izolovaných funkčních regresí stejného kódu. Skutečné cloudové A1/B a statistiky, přihlášení/produkční Auth/Rules/Firebase, fyzický iPhone/iOS a reálné OBS zůstávají **neověřené**. Pravidla nasazování vycházejí z textového přepisu zadavatele, nikoli domněle přečteného originálního PDF.

Tento následný zápis do main je čistě dokumentační, verzi nezvyšuje a nemění index.html, overlay.html ani aplikační assety. Před pushem se znovu ověří remote stav; případný další automatický Pages běh vyvolaný dokumentací není ruční opakování deploymentu. Cizí lokální kopie screenshotů/output/tmp zachovány.
