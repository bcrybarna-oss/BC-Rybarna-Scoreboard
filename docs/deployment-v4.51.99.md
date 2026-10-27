# Nasazení v4.51.99 RC

Zadavatel: Dominik. Datum: 27. 10. 2026. **Nasazeno a v níže uvedeném rozsahu ověřeno.**

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- [PR #37](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/37), schválená a sloučená hlava `434fde75f1da87b990e20954e2eef419c1a694d4`.
- Předchozí main `484d2661fa1c51ce9cd8f9a4834cc62e34339532`.
- Aplikační merge **`b5dc71f76364d29d455303566241579e545a6dcb`**; zachovaná historie, bez force push.
- [Pages 40571675729](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40571675729): build, deploy i report-build-status success. Žádné ruční opakování deploymentu.

## Kontrola před sloučením a CI

Čerstvý fetch, pravidla AGENTS.md, head/base, nezměněné sledované soubory a release gate ověřeny. Cizí nesledované soubory zachovány. Merge byl podmíněn přesnou hlavou PR; žádný konflikt nebo další vydání na main.

[Finální PR CI 40570509099](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40570509099) i [main CI 40571678443](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40571678443): release PASS, Node **239 PASS / 2 FAIL / 3 SKIP ze 244**. Soukromé vstupy v CI nejsou. Po nasazení cílená jednotková sada 15/15 PASS.

Obě chyby byly jednotlivě porovnány s aktuálním předmerge main a [CI 40397173141](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40397173141), kde 229 PASS / stejné 2 FAIL / 3 SKIP ze 234. Test i preview core mají stejný obsah:

1. `preview-match-reload-recovery.test.cjs:50`: skutečný rozpor kontraktu čekání na identitu; test požaduje odpojení aktivního pointeru bez smazání kopie, náhled pointer ponechá.
2. `:106`: zastaralý regex samostatného volání obnovy; volání zůstává, ale výsledek se přiřazuje pro fallback turnaje.

CI není plně zelené. Nová regrese nezjištěna, žádný test ani workflow nebyl vypnut nebo změněn při nasazení.

## Skutečná veřejná aplikace

Čisté Chrome relace 1440×1000 a mobilní viewport 390×844, bez přihlášení. Firebase/Auth a všechny jiné než GET/HEAD požadavky blokované. Žádný pokus o produkční zápis.

- Veřejné index.html, overlay.html a 15 potřebných assetů HTTP 200 a přesné SHA256 vůči merge. Běžné i cache-busting HTML a oba moduly shodné. Zobrazená verze **v4.51.99 RC**.
- `CloudRefresh` se úspěšně načte, namespace je zmrazený, žádná bootstrap chyba. Modul čistých FC výpočtů se načte jednou. Původní pollingové tělo bylo odstraněno, žádný fallback.
- Úvod, Výsledky, Hráči, Nápověda/O aplikaci, nastavení a Federal Cup fungují v obou viewports. Výchozí Bez streamu zachováno, žádný zápas nezaložen.
- FC má 21 položek programu, soupisky a jediné společné tlačítko statistik týmů. Ve veřejné prázdné offline relaci funguje A2 a skutečné stažení PNG; původní PDF export také prošel.
- V obou relacích 0 JavaScriptových a 0 konzolových chyb.

## Oddělené soukromé a cloudové scénáře

Tyto kontroly nejsou ověřením živé přihlášené produkční Firebase:

- Na nezměněné veřejné URL pouze místní offline kopie skutečného Doubles #9 a Singles #3: A1/A2/B a skutečná stažení 6 PNG, 2 Pushout XLSX na desktopu/mobilu PASS. PNG 1920×1080. Oba XLSX přesně odpovídají společnému writeru, mají Pushout/Metadata a všech devět očekávaných metrik. Původní PDF regrese také prošla, bez změny PDF ovládání nebo závislostí.
- Doubles #9: SK 48 koulí / 94 % / vlastní break 2/4 / prohry 2; CZ 12 / 86 % / 1/4 / prohry 3. Všech 13 metrik reportu i devět Pushout řádků ověřeno.
- Publikované HTML s přesně shodnými moduly v izolovaném Firebase mocku: opakované spuštění vlastní právě 1 interval, 1 úvodní timeout a 2 listenery; po odhlášení všechny 0. Tři souběžné obnovy sdílejí požadavek. Opakovaná navigace a šest A/B relací, výpadek/návrat spojení, opožděná odpověď po odchodu ze stránky i po odhlášení a pozdní token PASS. Platná sdílená revize se po opuštění FC aplikuje jednou bez navigace zpět. Žádné zápisy, vstupní 40MB export nezměněn.
- Existující browserová evidence sada na stejném aplikačním kódu ověřila skutečné dialogové přihlášení do mocku, reload/resume, undo a ukládání PUT/GET, včetně Team/Doubles; 0 pageerrors.
- První exportní pokus narazil na závod testu s později otevřeným úvodním přihlašovacím dialogem. Opakování výslovně počkalo na dialog a stisklo POUŽÍT OFFLINE. Aplikace se kvůli tomu neměnila; finální úplný běh prošel.

## Omezení a návrat

Živá produkční Auth/Firebase relace, reálné OBS, fyzický iPhone/Safari a Excel nejsou ověřeny. Dosavadní jednorázové blokování reportu B a nedostatečná kapacita místní cache pro celý archiv trvají. Ostatní cloudové služby a počáteční merge/upload mají dosavadní vlastní životnost; další etapa nezačala. Produkční zápasy ani data se neměnily nebo nemigrovaly.

Nová chyba způsobená tímto vydáním nebyla nalezena; rollback nebyl potřeba. V případě potvrzené regrese revert merge `b5dc71f76364d29d455303566241579e545a6dcb` standardním reverzním commitem podle AGENTS.md, s novou verzí, release gate a ověřením Pages. Nevracet data ani nespouštět migraci. Tím by se vrátila i stará pollingová implementace se známými vadami.

Dokumentační pokračování zachovává verzi a aplikační soubory; jeho případný automatický Pages běh publikuje stejnou aplikaci. [Strojová evidence](deployment-v4.51.99-verification.json), [mapa vlastníků a měření před/po](cloud-refresh-stage-2.md).
