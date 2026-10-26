# Nasazení v4.51.97 RC

Zadavatel: Dominik. Datum: 26. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.**

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- PR #35 sloučeno se zachováním historie: `6a57a98e53795a29925b2ce1601fa6903aaddd82`.
- Finální schválená hlava: `7e48b40731a08786ec9fba37639add428cd0d3a9`; předmerge main `442b706c841d852e5ba1e7eb82378d7f07aca6bc`.
- [Pages40379170626](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40379170626): build/deploy/report success. Žádný ruční rerun. Následný čistě dokumentační commit nemění aplikaci ani verzi.

## Přednasazovací kontrola a testy

Čerstvý fetch, release gate PASS, PR bez konfliktu a žádná souběžná změna main. Starší federal-report-exports-browser aktualizován podle schváleného odstranění obou informačních popisků. Další zastaralé hledání inline SVGpath vlajek prokazatelně selhalo i na main96; zachována kontrola vlajek pro aktuální externí flatSVG, jejich počet a900×600. Ostatní kontroly nezměněny.

Celý opravený exportní test PASS: A1/A2/B, Singles/Doubles/Team, PNG1920×1080/PDF16:9, preview/export parita, dlouhá jména a široké skóre, mobilDPR3byteověstejný PNG, partial, chyba knihovny, blokace duplicitních exportů a zrušení rozpracovaného exportu.0Firebase/0zápisů/0pageerrors. Aktualizace testu neměnila produkčníHTML.

[Finální PR CI40378962502](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40378962502) i [main CI40379170846](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40379170846): **release success**, Node227PASS/2FAIL/3SKIP ze232. Dvě chyby preview-match-reload-recovery.test.cjs:50/:106 mají stejné názvy a assertiony strictEqual(true) a login-recovery match jako skutečné logy aktuálního předmerge main CI40130831928. Testovací soubor/test-modular beze změny. Tři kontroly soukromých exportů v CI přeskočeny bez místních souborů, dříve lokálně prošly. **CI není plně zelené; žádná nová regrese.**

## Rozsah skutečného produkčního ověření

### 1. Veřejný neupravený web bez přihlášení

Čerstvý Chrome profil, desktop1440×1000 a mobil390×844. Verze97 v hlavičce/O aplikaci/overlaytitulu; index.html,overlay.html a13assetů HTTP200 a přesnéSHA256 proti merge commitu. Běžná i cache-busting URL mají stejný novýindex, nejde o staré HTML zcache.

Skutečné navigační vstupy Úvod→Výsledky→hráči→O aplikaci→FederalCup, nastavení/Bezstreamu, dlaždice/vlajky/jednoA2tlačítko,21položek programu/soupisky/desktop/mobil a bezpečně offline neurčenýoverlay PASS. Prázdný offlineA2 stáhlPNG/PDF.0JS chyb/0console chyb/0pokusů o zápis. Kontrolnískript původně předpokládal neexistující přímé data-nav=history; opraven pouze skript na skutečné vstupy, aplikace se kvůli tomu neměnila.

### 2. Reporty a exporty na produkční URL s izolovanou kopií dat

Neupravená publikovaná aplikace na skutečné Pages URL, nová offline browserová relace. Pouze její localStorage obsahovala kopii dokončeného Doubles#9 (`3d4c35e6-e336-49d5-a9b3-9955cec59c3d`,5:3), aktuálního uloženého Singles#3 (`85109748-f185-4988-a86b-8bc914bb4e3a`,5:2), hráčů aFCkonfigurace zposledního exportu25.10.2026. Tento Singles#3 je skutečný novější záznam, nikoli starší kontrolní DanielLang–TomKurz. Jména nejsou používána jako identita. A2 zde vychází ztohoto omezeného testovacího podkladu, neověřuje živé úplné týmové skóre vcloudu.

Desktop i mobil: A1/A2/B otevřeny přes skutečná tlačítka, všech13řádků a schválená absence textů;6PNG+6PDF+2XLSX skutečně staženy. Nezávislá kontrola: PNG1920×1080, PDF16:9 a pixelově stejný vložený obraz jakoPNG; XLSX přesněPushout/Metadata,9správných řádků, numerickáprocenta0.94/0.86 s0%formátem a správné numericképočty. XLSXbyteověstejný sostatní otestovanou ukázkou #9. SK48koulí/94 %/ownbreak2/4/lose2, CZ12/86 %/1/4/lose3 zachovány. [Desktop testovacího reportu](screenshots/deployment97-isolated-report-desktop.png), [mobil](screenshots/deployment97-isolated-report-mobile.png).

Veškerá Firebase/Auth a nonGET/HEAD komunikace byla zablokována;0JS/console chyb,0pokusů o zápis. **Není to ověření načtení živých produkčních zápasů přes přihlášenou relaci.**

### 3. Izolovaná cache a souběh na přesně publikovaném HTML

Stažené HTML má SHA256 `e9884f67ef28b39957d8143bce67bc96bf578692e65b5e0927f0294d0cca26ad`, přesně shodné smerge commitem i veřejným webem. Pět cílených testů bylo spuštěno přímo nad tímto souborem:5/5PASS. Selhání cache neuloží timestamp bez dat; stejná revize se aplikuje jen jednou; reload musí cache znovu získat; nová revize a retry fungují; tři souběžná volání mají jeden GET, odpověď staré identity se nepoužije.

Dále místní testovacíorigin s tímto HTML a měřicími hooky pouze vpaměti, úplným40 385 164Bexportem/184zápasy/26hráči a kompletně mockovanou sítí.7cyklů/35přechodů, A1/A2/B a10sidle;41skutečných quota výjimek vnovém browserovém profilu. Dvě nové cloudové revize vyvolaly přesně2plné aplikace, nikoli opakované zpracování stejnérevize.14postupných GET/matches odpovídalo jednotlivým obnovám, **nejvyšší souběh stejnévětve byl1**; nejde o trvalé cachování všech budoucích obnov.0pageerrors/0interactiontimeouts,184zápasů/26hráčů zachováno. Heap poGC57,0→57,9MB po naplněníobrazovek, DOM8836/listenery1110stabilní, intervaly7běhemcloudu/6po vypnutí. Jeden automatický mockovaný presenceDELETE byl zachycen a zablokován; žádný skutečný produkčnípožadavek nebo zápis.

## Zachovaná známá omezení

- Hráčský report B může jednorázově blokovat hlavnívlákno přibližně5sekund (dřívější delší měření5,116s); úspěšný současný běh tento limit neruší. Nejde o tvrzení, že zmizelo veškeré blokování.
- Celý40MBarchiv se nadále nevejde do localStorage. Oprava brání opakovací smyčce, nepřidává plnou offline perzistenci ani migraci doIndexedDB.
- Skutečná přihlášená produkčníAuth/Firebase relace, fyzickýiPhone/Safari, hodinový běh na postiženém telefonu, MicrosoftExcel a reálnéOBS nejsou ověřeny.

Produkčnídata se neměnila ani nemigrovala. Původníexport zachován a SHA256 `2afd2e5c48d3babf198d41809dd9fedbf8b188a28dd8e6056a0f27db69afdc6e` ověřena. Výběrhráčů aplošnámodularizace nezměněny. [Strojová evidence](deployment-v4.51.97-verification.json), [původní diagnostika a měření](performance-diagnostics-v4.51.97.md).
