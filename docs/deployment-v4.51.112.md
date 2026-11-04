# Nasazení v4.51.112 RC — kompaktní mobilní ovládání počítadel

**Zadavatel: Jaroslav. Datum: 4. 11. 2026. Stav: sloučeno do main a GitHub Pages nasazení úspěšné.** Tento dokument je současně předávací záznam pro Dominika a jeho AI; informace o původní v4.51.111 RC jsou v předchozí revizi.

## Sloučení, zdroj a testy

- Před sloučením ověřen čerstvý `main` **`1270f94249dd8969b27ccc0e5c2508972f1d7d2f`** (v4.51.111 RC), head testovací větve **`ebf335aa4796f83bc5b99897fa88af273484aced`**, rozdíl **35 commitů / 13 souborů**, žádné chybějící commity ze `main`, žádný konflikt.
- [PR #54](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/54) schválený zadavatelem k nasazení v konverzaci, převeden z draftu do ready a standardně sloučen metodou `merge`. **Merge commit `1f1d2d5f835827ce68c88ea9b3c1201618350d3b`**; žádný force push / přepsání historie. Produkce a `main` nyní používají v4.51.112 RC.
- [PR CI 41812084491](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41812084491): kontrola verze/revize **PASS**; produkční Node **336 PASS / 0 FAIL / 3 SKIP**; experiment **28 PASS / 2 FAIL** (dvě dříve evidované vady autentizační obnovy v test-modular, mimo současný produkční kód), celkový výsledek kombinovaného workflow **FAILURE** pouze kvůli experimentu. Kontrola vydání nebyla vypnuta ani obejita.
- [Samostatné mobilní browser CI 41812084387](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41812084387): **PASS**. Izolovaný Chrome 390×844: sólo 14.1/Ghost, jednoduché, rozšířené, 8-ball výsledek racku, Ghost, klasická 14.1, Vítěz na stole, časomíra a detailní stav. Testované také simulované demo akce (JUMP/BANK, úvodní faul/legální break a UNDO) bez síťové komunikace aplikace.
- [Main CI 41812771355](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41812771355): **release PASS / produkční Node PASS**, experimentální 2 již známé FAIL.
- [GitHub Pages build a deployment 41812770171](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41812770171): **build SUCCESS / deploy SUCCESS** pro merge `1f1d2d5`. Veřejná URL dle předchozího ověřeného nasazení: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/. V aktuálním prostředí nebylo možné provést samostatný anonymní HTTP fetch a porovnat publikované bytes; potvrzení se opírá o GitHub Pages workflow. Po dokumentačním commitu se případně spustí nové Pages sestavení bez změny aplikace.

## Rozsah uživatelské změny

- **Pouze mobil portrait do 700 CSS px a aktivní zápas:** kompaktní hlavička, menší mezery, přehledné skóre a kontextová tlačítka vedle sebe. Desktop a ostatní stránky beze změny.
- **8/9/10-ball** jednoduché i rozšířené počítadlo: skóre a hlavní herní volby společně; u 8-ballu dva sloupce hráčů pro potvrzení výsledku racku.
- **Ghost** v 8/9/10: sedm výsledků racku ve dvou sloupcích; **Vítěz na stole** a stav s časomírou přizpůsobeny stejně.
- **14.1 sólo / sólo Ghost a klasická 14.1:** skóre, počet koulí, hlavní akce +14/MISS/SAFE/FAUL/UNDO v kompaktním uspořádání. V klasické 14.1 odstraněny pouze duplicitní mobilní dlaždice skóre.
- **Úvodní rozstřel 14.1:** nové tlačítko `ÚVODNÍ BREAK OK` ukončuje úvodní fázi bez změny bodů. Tlačítko `ÚVODNÍ BREAK • FAUL −2` je dostupné jen před první evidovanou akcí; po potvrzeném rozstřelu, ukončeném náběhu nebo `+14` zmizí. Opožděný klik na −2 se odmítne. `UNDO` zachovává a obnovuje předchozí příznak v snapshotu. **Protože systém nepozná fyzický strk bez zápisu, je nutné legální úvodní rozstřel výslovně potvrdit.**
- V testovací samostatné ukázce 8/9/10 opraveno chybné přepínání hráče po `JUMP SHOT`/`BANK SHOT`: obě tlačítka pouze označují strk. **Skutečná produkční herní logika pro JUMP/BANK byla správná již před touto opravou ukázky.**
- Neprováděna migrace ani zápis do produkčních dat, žádná změna Firebase pravidel, autentizace nebo streamové konfigurace. Nativní balíčky iOS/Android se samotným Pages nasazením nepřebudovaly.

## Kde pokračovat — Dominik a jeho AI

**Výchozí stav pro další vývoj je `main` v4.51.112 RC**, nikoli starý `main` 111 ani testovací 112 větev. Před úpravami načíst aktuální origin/main, `AGENTS.md`, `REVIZE.md`, `PROJECT_STATUS.md` a `PROJECT_CONTEXT.md`; neslučovat rozpracovanou modularizaci PR #6 bez samostatného zadání.

Zdroj: `index.html`, nové CSS bloky `solo14-mobile-compact-v451112`, `other-disciplines-mobile-compact-v451112`, `opening-break-141-mobile-v451112`. Přímou logiku úvodního rozstřelu hlídá funkce `openingBreakAvailableForAction14(match)` a obsluhy `openingBreakOk14`/`openingBreakFoul14`. Regrese: `tests/solo14-mobile-layout.test.cjs`, `tests/other-disciplines-mobile-layout.test.cjs`, `tests/solo14-opening-break.test.cjs`; izolované Playwright testy v `tests/*mobile-layout-browser.cjs` a `tests/mobile-preview-browser.cjs`. Browser workflow `.github/workflows/mobile-scoring-layout.yml`. Souborům v `test/` přiřazujte pouze statut **ukázka**, nikoli skutečný přihlášený zápas.

## Omezení a bezpečný návrat

Ověřeno automaticky v Chrome s viewportem 390×844; není potvrzeno v ostrém přihlášeném zápasu na fyzickém iPhonu ani při zvětšeném písmu a jiné výšce. Hlavní tlačítka a skóre se vejdou v základních scénářích, ale historie, další podpanely, modály a podrobný průběh mohou stále vyžadovat scroll. Dvě známé chyby experimentálních testů identity/persistence přetrvávají; nesouvisejí s touto vizuální úpravou, ale nelze z nich odvozovat ověření produkčního Auth.

Při případném návratu nejdříve zkontrolovat aktuální `main` a následné commity a provést bezpečný revert **merge `1f1d2d5` s parent 1**, novou verzi dle aktuálního `main`, kontrolu release, Node a browser testy. Neprovádět force push, hard reset ani zásah do databáze. Návrat vrátí také opravu úvodního 14.1; cílený hotfix může být bezpečnější. Následné čistě dokumentační commity nemění verzi ani aplikaci.
