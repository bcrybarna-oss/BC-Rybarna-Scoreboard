# Nasazení v4.51.121 RC

Zadavatel: Dominik. Datum ověření: 24. 11. 2026. Stav: **nasazeno a ověřeno v níže vymezeném rozsahu**.

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- [PR #68](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/68) sloučen standardním merge se zachováním historie.
- Schválená implementace: `805ab3653b976db2c8ea3d867a9a58158b52999e`.
- Kosmetika: `0a745074497d75d0b7b5237658ae1f415ac7c691`; aplikační diff jsou přesně čtyři změny viditelného textu na VOLNÝ LOS, bez jiné změny aplikačních bajtů.
- Finální head: `4bc79274e348070c67a5b758ccfeef9fb44c4924`. Navazující commit upravuje pouze diagnostický snapshot testu pro pole vynechané Firebase, žádné očekávání výsledků nebylo oslabeno.
- **Aplikační merge: `78124feb1c62e23aafccd576f13c3721fd615c09`.** Výchozí main byl `f3f513b8c6c14aaf5ccfa40c823bd25f3c4511a8` (v120).
- [GitHub Pages 45373366579](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45373366579): **build SUCCESS, deploy SUCCESS**. Automatické nasazení nebylo ručně spouštěno znovu.
- PR #55 zůstává otevřený a nesloučený, head `4b50f7cabbfc0c77be2fac35bbde4f4b2c2b8e74`; nebyl upraven.

Dokumentační pokračování nemění aplikaci ani verzi. Jeho commit / výsledný aktuální main jsou uvedené v závěrečném předání; není možné vložit SHA dokumentu do téhož commitu, který jej teprve vytváří.

## Skutečná veřejná kontrola

Čisté anonymní Chrome kontexty, žádná produkční přihlášená relace. Veřejné soubory a čtecí požadavky nebyly mockované. Všechny potenciální nečtecí síťové požadavky byly preventivně blokované; nenastal ani jeden takový pokus.

- Veřejná verze **v4.51.121 RC** na desktopu 1440 px i mobilu 390 px.
- HTTP 200 a přesná SHA-256 shoda `index.html`, `overlay.html` i **15 vlastních JS souborů** s merge Git blobem. HTML hash: `62c72135fd01aa06fb53b726f99769bf7de3d85197d4fcce2f4cc2a76067b436`.
- Nové kontexty, vypnuté service workery, kontrolní URL s merge SHA a HTTP kontrola bez cache. Není to pouze závěr z úspěšného workflow nebo čísla verze.
- Ověřeno pořadí načtení PlayersReadRepository před MatchChallenges, nepřítomnost staré factory a verzovací parametry devíti aktivně verzovaných modulů `4.51.121`. Zbývající nezměněné moduly mají dosavadní parametry; všechny byly obsahově porovnány s merge.
- Skutečné tlačítko offline režimu a navigace Úvod → Výsledky → Statistiky → Hráči → Turnaje → Federal Cup → Livescore s návraty na úvod, desktop i mobil.
- **0 bootstrap/JavaScriptových výjimek, všechny vlastní skripty úspěšně načtené, 0 produkčních zápisů.**

[Strojově čitelný důkaz a hashe](deployment-v4.51.121-verification.json), [veřejný desktop](screenshots/deployment-121-public-desktop.png), [veřejný mobil](screenshots/deployment-121-public-mobile.png).

## Izolované ověření skutečně publikovaného kódu

Stažené veřejné HTML a vlastní JS byly uloženy v izolované kopii. Shoda bajtů s merge byla ověřena před spuštěním. Syntetické A–H / A1–C4 a všechny Firebase operace zůstaly výhradně v paměťovém mocku. Tato část **není ověření živého Auth ani Rules**.

| Scénář | Úvodní hrané zápasy | Volné losy | Výsledek |
| --- | --- | --- | --- |
| 6 hráčů | D–E; C–F | A/B v opačných polovinách | PASS 1440/390/320 |
| 7 hráčů | D–E; C–F; B–G | A | PASS 1440/390/320 |
| 8 hráčů | A–H; D–E; C–F; B–G | žádný | PASS 1440/390/320 |
| 3 skupiny × 2 | A2–C2; C1–B2 | A1/B1 | PASS 1440/390/320 |
| 3 skupiny × 4 | B3–C3; B2–C4; C2–A4; A3–B4 | A1/B1/C1/A2 | PASS 1440/390/320 |

Celkem **9 jedno-skupinových a 6 více-skupinových scénářů PASS** nad publikovanými zdroji. Ověřeno:

- Oba skutečně ovládané editory, zachování vědomého ručního rematche, automatická pravidla a odmítnutí duplicit.
- Pevná semifinále a finále, různí vítězové a opačné pořadí zápisu, dokončení celého turnaje.
- Reload před i po částečném čtvrtfinále včetně vynechání prázdných položek Firebase.
- Přesně N−1 hraných play-off zápasů; volný los nepřidává zápas, výhru, rack ani osobní herní záznam.
- Staré nasazené, rozehrané a dokončené pavouky bez `seedSlots`: shodné výsledky, statistiky, umístění a cloudový záznam. Staré historické přehrání zachovává větve.
- Detail, oba editory, modální pavouk a náhledy mají pouze **VOLNÝ LOS**, žádný viditelný anglický výraz. Vysvětlení cílového postupu zůstává. Interní `bye`/`byes`/`seedSlots` se nemění.

[Syntetický desktop](screenshots/deployment-121-synthetic-1440.png), [390 px](screenshots/deployment-121-synthetic-390.png), [320 px](screenshots/deployment-121-synthetic-320.png).

## Závěrečné regrese a CI

- Lokální kompletní produkční Node: **413 PASS / 0 FAIL / 0 SKIP**.
- Hybrid browser **15/15 PASS**, multigroup browser **15/15 PASS** před nasazením, všechny tři šířky.
- Historical structure browser PASS: skupiny, SKO, DKO, hybridy, bronz, staré výsledky/umístění, opravy/reload a ETag ochrana.
- Mobilní layouty osmi variant PASS; Solo 14.1 **3/3 PASS**.
- [Finální PR CI 45372479243](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45372479243): release SUCCESS, produkce **410 PASS / 0 FAIL / 3 SKIP** (tři soukromé archivní kontroly, lokálně prošly), experiment **28 PASS / 2 FAIL**.
- [Finální mobilní CI 45372479113](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45372479113) SUCCESS; [finální stream CI 45372479218](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45372479218) SUCCESS: ovládání, izolace OBS a jednorázové tempo.
- [Main CI po merge 45373367152](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/45373367152): release a produkce SUCCESS, experiment FAILURE se dvěma známými vadami. **Celé regresní workflow není zelené.**

### Zachovaná selhání a rozsah jejich vyhodnocení

1. Experimentální recovery bez identity neodpojí aktuální zápas od editace (`false` místo `true`). Uložená recovery data se přitom mají zachovat; test končí již na tomto prvním očekávání a neprokazuje smazání záznamu.
2. Experimentální stale UID bez autentizace nesprávně opravňuje vlastníka (`true` místo `false`). Obě vady jsou nezměněné proti main, experimentální core není produkční načítání; žádné očekávání ani CI nebylo vypnuto.
3. Dříve doložené ordinary browser selhání :508 (cloudový turnaj A v seznamu při čekání na vytvoření B), FC viewer :17 (7 GET vs 1) a závod stream browseru :65 / timeout :103 jsou zaznamenané odděleně v [diagnostice](hybrid-sko-byes-v4.51.121.md). Ordinary, viewer i závod :65 byly stejně reprodukovány na baseline. V této kosmetické změně se jejich kód ani dotčené aplikační cesty nemění; nejsou vydávány za lokální PASS. Finální streamové CI výše skutečně prošlo.
4. Původní stream CI 45357248049 na 97eddf3: první timeout, druhý pokus SUCCESS bez změny kódu, historie zachována. Starý souhrnný FC browser :198 má zastaralé očekávání další změny tempa po prvním kliknutí; prvních osm skupin scénářů prošlo, další tehdy nebyly provedené.
5. Historický audit odstraněného žurnálu zůstává samostatný starý důkaz 0/2, nikoliv výsledek současné implementace.

Závěrečný hybridní běh navíc zachytil chybu pouze v diagnostickém snapshotu testu, když Firebase vynechala prázdné `eliminatedIds`. Commit 4bc7927 opravil výhradně toto čtení; kompletní opakovaný běh následně prošel. Nejde o novou funkční změnu aplikace.

## Omezení a návrat

Neověřené: živé přihlášení/Rules v autorizovaném izolovaném projektu, skutečná přihlášená produkční relace, fyzický iPhone/Android a reálné OBS. Mocky nejsou náhradou těchto kontrol. Skutečná veřejná kontrola byla anonymní a bez datových zápisů; turnajové scénáře byly odděleně syntetické. Produkční účty, zápasy, turnaje, přítomnost ani Rules nebyly měněny nebo migrovány.

Návrat řešit opravným PR a novým číslem vydání, bez vracení databáze. Plný revert zároveň vrátí původní chyby nasazování. Starý historicalReplay neumí bezpečně přegenerovat nové historické pevné pavouky; do kompatibilního opravného vydání je nepřegenerovávat starým kódem. Dopředná cílená oprava je bezpečnější než slepý návrat starého generátoru.

Etapy modularizace 10b1/10b2 nebyly zahájené.
