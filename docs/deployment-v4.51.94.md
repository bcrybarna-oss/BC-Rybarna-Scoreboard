# Nasazení v4.51.94 RC – PR #32

Zadavatel: Dominik. Datum: 23. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.** Žádné změny produkčních zápasů, migrace ani testovací zápisy do Firebase.

- Produkční URL: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/ – skutečně **v4.51.94 RC**.
- Schválené PR #32 sloučeno metodou merge se zachováním historie; finální hlava427757e937ce1505758eb7e9e88f698f650184a4. Čerstvý fetch a API potvrdily nezměněný main ea1caaa a žádný konflikt/cizí změnu.
- Nasazený aplikační merge commit: **1f3def4e40899323209de29190b1d27c8465a67b**.
- [Pages39998101433](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39998101433): build/deploy/report **success**. Automatické nasazení nebylo ručně opakováno.
- [Main CI39998101875](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39998101875): release **success**, Node **198/200 failure**. Log potvrzuje výhradně známé preview-match-reload-recovery.test.cjs:50,106. Finální PR CI39991709804 stejné. Před merge porovnány skutečné logy proti aktuálnímu main/run39987130017: stejné testy, expected true/actual false/strictEqual a match assertion. Žádná nová regrese; **CI není plně zelené**. Testy/CI nebyly vypnuty nebo upraveny pro zakrytí selhání.

## Přímý veřejný browserový smoke

Dokončen23.10.2026 19:50CEST (17:50UTC). Index, overlay a12assetů HTTP200 s přesnými SHA256 proti merge. Normální URL/index.html i fresh query vracejí nové HTML; hlavička/about/overlay verze94. Shoda obsahu potvrzuje skutečné publikování, nikoli jen úspěch workflow.

Desktop i mobil: navigace, Federal Cup výsledková tabule/21zápasů/soupisky, jedno společné STATISTIKY TÝMŮ, Resafe, bez odstraněných hvězdiček/popisků;0pageerror/0console error/0pokusů o zápis. Zachována volba Bez streamu a panel pod herním ovládáním. Overlay bez identity bezpečně offline.

Přímo na neupraveném veřejném webu dostupný A2 s přesnými **rovnými SVG900×600** v reportových boxech120×80. Skutečné PNG1920×1080 a PDF1440×810 (16:9) staženy. Obraz extrahovaný z PDF pixelově totožný s PNG, žádná další ztráta kvality. Slovenský znak a český klín vizuálně prohlédnuty, ostré.

**Přehled a dlaždice beze změny:** zvlněné cloth PNG v tabuli mají původní HTTP/SHA256,1920×1320 a stejné styly. Desktopový i mobilní screenshot samotné dlaždice je pixelově totožný s předchozí produkcí93. V celém indexu je po normalizaci čísla verze a jediného reportFlag odkazu přesná shoda se93; ostatní UI/statistiky tedy nejsou změněny. Národní assety, pohár i pozadí byteově beze změny.

## A1/A2/B na přesně publikovaném kódu s izolovanými daty

Stažené veřejné HTML ověřeno hashem a použito v současném tests/federal-93-presentation-browser.cjs. Hook pouze zpřístupňuje uzávěr pro testy; Auth/Firebase provoz kompletně zachycen, assety jsou byteově ověřené proti veřejnému webu. Nejde o test skutečné produkční relace nebo čtení uložených cloudových zápasů.

- Všechny3reporty používají přímo společné přesné rovné SVG bez deformační rasterizace/předrasterizovaného cloth PNG. Ostrý slovenský znak a antialiasované hrany českého klínu vizuálně ověřeny.
- **6skutečných desktop/mobilPNG/PDFpárů PASS**, PNG1920×1080, PDF1440×810; extrahovaný obraz každého PDF pixelově totožný s příslušným PNG. Všech6PNG byteově totožných se schválenými náhledy94 v docs/screenshots. Mobilní náhled/zoom/Escape a všech13metrik PASS, bez JS chyb či Firebase požadavků/zápisů.
- Skutečný místní Singles#3 a9f06904-00a5-4518-a81a-eae5a9425a35/2026/2:5: SK **93 %/14**,CZ **95 %/38**; interní partial/reasons zachovány. Zdrojový JSON hash7494ec7168498e43bce3bfb30f4d53556685dfc45eb130ad5816614992e83d48 před/po totožný. A2/B obsahují v tomto kontrolním scénáři pouze zkoumaný zápas, ne celý produkční ročník.

## Evidence a omezení

- [Strojové ověření](deployment-v4.51.94-verification.json), [původní diagnóza a1:1 detaily](federal-report-flags-v4.51.94.md).
- Přímá produkce: [A2 PNG](screenshots/production-94-public-empty-A2.png), [desktop](screenshots/production-94-federal-desktop.png), [mobil](screenshots/production-94-federal-mobile.png), [mobilní dialog](screenshots/production-94-dialog-mobile.png), [dlaždice desktop](screenshots/production-94-tile-desktop.png), [dlaždice mobil](screenshots/production-94-tile-mobile.png).
- Schválené A1/A2/B PNG v docs/screenshots/federal-94-{A1,A2,B}.png jsou přesně stejné jako čerstvé exporty publikovaného kódu. Lokální nové PNG/PDF: ../release94-production/isolated-exports/{A1,A2,B}{,-mobile}.{png,pdf}; přímý veřejný A2 v ../release94-production/public-empty-A2.{png,pdf}.
- V čerstvé nepřihlášené veřejné relaci A1:0,A2:1,B:0. Skutečné cloudové A1/B a produkční přihlášení nebyly bezpečně dostupné, **neověřeny přímo nad produkčními zápasy**. Nepředstíráme, že lokální kontrola je skutečná cloudová relace. Fyzický iPhone/OBS neověřeny; mimo rozsah této vizuální změny.
- PDF zůstává FullHD rastrovým reportem16:9, nikoli vektorem pro neomezené zvětšování. Následný čistě dokumentační commit nemění aplikaci/verzi.
