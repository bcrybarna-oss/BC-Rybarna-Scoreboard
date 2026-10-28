# Nasazení v4.51.102 RC

Zadavatel: Dominik. Datum: 28. 10. 2026. **Nasazeno a v níže uvedeném rozsahu ověřeno.** Další etapa nezahájena.

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- [PR #41](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/41), schválená hlava `26833b014c27c50cd03ce8ed64982b8330520e75`.
- Předchozí main `7b7ff4f096454fa23b89d7c3284f8af355d98c00` / produkce v4.51.101 RC.
- Aplikační merge **`95da0953a8e67107df3f045b8a63caffa31211a5`**, zachovaná historie a přesně podmíněný merge.
- [GitHub Pages 40749738579](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40749738579): build, deploy i report-build-status success. Žádné ruční opakování deploymentu.

## Před sloučením a CI

Čerstvý fetch, aktuální main a head, pravidla AGENTS.md a release gate PASS. Žádný konflikt nebo cizí necommitnutý sledovaný soubor; nesledované pracovní soubory zachovány. Diff turnajových testů101, obnovy hesla, známého preview testu a test-modular vůči main prázdný. Dříve doložené otisky produkčních oblastí potvrzují zachování turnajových těl101 a modulů/cache předchozích etap. Před sloučením 19/19 cílených jednotkových testů vlastních hlášení, turnajů a obnovy hesla PASS.

[Finální PR CI 40749133761](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40749133761) a [main CI 40749739037](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40749739037): release PASS, Node **258 PASS / 2 FAIL / 3 SKIP ze 263**. Tři soukromé vstupy nejsou v CI; předchozí úplná lokální sada s nimi 261 PASS / 2 FAIL / 0 SKIP.

Obě chyby jednotlivě porovnány s [CI aktuálního předmerge main 40581247766](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40581247766), kde 247 PASS / stejné 2 FAIL / 3 SKIP ze 252:

1. `preview-match-reload-recovery.test.cjs:50`: skutečný rozpor kontraktu čekání na identitu; náhled ponechá aktivní pointer místo odpojení bez smazání kopie.
2. `:106`: zastaralý regex samostatného volání obnovy, jehož výsledek se nyní přiřazuje pro turnajový fallback.

CI není plně zelené. Nová regrese nenalezena; žádné vypnutí nebo úprava těchto testů ani workflow.

## Veřejná produkční aplikace bez přihlášení

Čisté Chrome relace 1440×1000 a mobilní viewport 390×844. Žádné produkční cookies, tokeny nebo přihlášení. Firebase/Auth a všechny jiné než GET/HEAD požadavky blokované, žádný pokus o produkční zápis.

- Veřejné index.html, overlay.html a 16 assetů HTTP200 a přesné SHA256 proti merge. Běžné i cache-busting URL HTML/overlay/všech tří modulů shodné. Skutečně zobrazená **v4.51.102 RC**.
- CloudRefresh, FederalStatistics a nový OwnReports se načetly každý jednou. Skutečně obdržené browserové odpovědi JS mají shodné otisky s publikovanými soubory a merge. Původní pollingové tělo vlastních hlášení není alternativní implementací nebo fallbackem.
- Úvod → Nápověda → Nahlásit problém / Moje hlášení: formulář a tlačítko OBNOVIT dostupné. Anonymní obnova nezahájí chráněný request a seznam bezpečně zůstane prázdný. Hlášení nebylo odesláno.
- Navigace Výsledky, Úvod, běžný turnajový formulář a Federal Cup PASS; FC má 21 položek. Pole skupin/play-off z101 viditelná a použitelná, žádný produkční turnaj nezaložen.
- Obnova hesla z100 je v publikovaném HTML funkčně i textově shodná, viditelné ovládání a místní validace prázdného e-mailu PASS. Resetovací e-mail se neposílal.
- V obou viewports 0 pageerrors, 0 konzolových chyb, 0 Firebase nebo zápisových požadavků.

## Publikovaný kód s mockovaným přihlášením a Firebase

Tato část **není ověřením živé přihlášené produkční relace**. Existující regresní skripty čtou přes read-only testovací překrytí skutečně stažené HTML a všechny tři publikované moduly; jejich SHA256 jsou před spuštěním ověřeny. Tracked aplikační soubory se nepřepisují. Testy zachytí veškerou síť a používají pouze mock. Index hlášení je syntetický; poslední soukromý JSON poskytuje realistický archiv 40 913 440B /189zápasů/26profilů a zůstává nezměněný.

- **Moje hlášení:** tři souběžná načtení =1sdílený GET. Pozdní odpověď po odchodu =0renderů; staré A nesmaže novější seznam B. Staré legacy čtení po odchodu nezahájí mirror PUT. Platná legacy kompatibilita nadále funguje v mocku. Výpadek a návrat přes pravidelný tick PASS.
- 20opakovaných vstupů/odchodů a šest A/B relací, včetně skutečné logout funkce: při aktivním scope1interval/1pagehide listener, po odchodu a po logoutu **0intervalů/0timeoutů/0listenerů**, pending false. Žádný růst DOM ani pageerrors. Stejný UID po návratu má generaci chráněnou také přímým testem produkčního modulu.
- **Turnaje101:** běžný i historický formulář, desktop Skupiny→SKO/mobil Skupiny→DKO, výběr, ruční nasazení, změna nastavení, zavření/otevření, plná kvóta s viditelným upozorněním, cloud PUT/GET a reload PASS. Opravdu vytvořené zápasy mají skupiny8-ball/target3 a play-off10-ball/target7, bez federalCupLink. Konfigurace FC shodná před/po, program21položek. Původní uživatel tím nepotvrdil v101 na vlastním zařízení.
- **Exporty:** skutečná stažení A1/A2/B PNG1920×1080, desktop/mobil/zoom, správné metriky kontrolního Singles3 SK93 %/14 protiCZ95 %/38 PASS. Pushout XLSX Singles/Doubles/Team, dva listy, hodnoty, scope tlačítek a zotavení po chybě PASS. Původní PDF regrese rovněž prošla; PDF není změněné ani optimalizované.
- Samostatně na témže publikovaném zdroji prošel původní evidence browser se skutečným dialogovým mock Auth, reload/resume/undo/PUT/GET/Team/Doubles a kompletní historická sada s ETag412/403/pravomocemi/korekcemi/bodováním a legacy paritou. Žádný z těchto zápisů nešel do produkce.

Pokusy s nehotovou CDN odpovědí před dokončením Pages byly kontrolovány jako ověřovací stav, nikoli chyba nové aplikace; binární porovnání nástroje bylo nahrazeno porovnáním SHA256, aby nevypisovalo objemný rozdíl. Finální veřejný běh prošel, žádná funkční změna se kvůli tomu nepřidala.

## Omezení a návrat

Živá produkční Auth/Firebase, skutečná soukromá hlášení a správa historické série, doručení e-mailu, reálné OBS a fyzický mobil/Safari neověřeny. Výsledky s mockem nejsou vydávány za ověření těchto služeb. Původní uživatel turnajovou opravu101 stále nepotvrdil na svém zařízení. Blokování reportu B a kapacita archivní cache trvají.

Již odeslaný platný PUT nelze zpětně odvolat; ochrana zabrání použití pozdní odpovědi nebo zahájení navazující operace ve zrušeném scope. Ostatní služby mají dosavadní životnost. Produkční data, turnaje, zápasy ani hlášení se neměnily nebo nemigrovaly.

Nová chyba způsobená vydáním nebyla nalezena; rollback nebyl potřeba. Případný návrat reverzí merge `95da0953a8e67107df3f045b8a63caffa31211a5` podle AGENTS.md, s novou verzí, release gate a Pages ověřením, bez vracení dat. V101 i obnova hesla zůstanou zachované, vrátí se původní chování hlášení včetně doložených závad.

Čistě dokumentační pokračování nemění aplikaci ani verzi; jeho případný automatický Pages běh publikuje stejný aplikační obsah. [Strojová evidence](deployment-v4.51.102-verification.json), [mapa vlastníků a přednasazovací měření](own-reports-modularization-stage-3.md).
