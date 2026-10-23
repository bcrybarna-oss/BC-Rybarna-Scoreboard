# Ostrost vlajek v reportech – v4.51.94 RC

Zadavatel: Dominik. Datum: 23. 10. 2026. Kandidát vychází z main ea1caaa7de27c63797f7ae5b1876b9e5d327bbe8 (nasazená93). Nesloučeno, nenasazeno. Produkce zůstává93.

## Zjištěná příčina a rozhodnutí

Nízké vstupní rozlišení není příčinou: cloth PNG mají1920×1320. SVG zdroj960×660 obsahuje feImage/mapu a feDisplacementMap scale95; renderer scripts/render-federal-cloth-assets.cjs nejprve vytvoří PNG při deviceScaleFactor2. Report jej poté zmenší do120×80, navíc s průhledným okolím uvnitř assetu. Znak má kvůli tomu méně použitelných pixelů. Filtr deformuje nejen obrys, ale také pruhy a slovenský znak; v reálném výstupu jsou viditelné schody a zlomy. To je problém grafického podkladu/deformace a jeho rasterizace, nikoli výpočtu statistik.

Ověřené varianty se stejnými daty a bez změny layoutu:
- původní cloth PNG z93;
- přímé cloth SVG bez mezilehlého PNG: deformace/schody přetrvávají, slovenský znak není přesvědčivě ostrý;
- původní přesné rovné SVG: čisté národní symboly a antialiasované hrany. Podle výslovně schválené záložní možnosti zvolena tato varianta pouze v A1/A2/B.

Není použit doostřovací filtr, nový generovaný znak ani změna barev. reportFlag nyní odkazuje přímo na existující flag-*-flat.svg900×600; mění se jediná přípona zdroje. Box zůstává120×80. Zmizel deformační filtr a předrasterizovaný mezikrok z reportové cesty. Zvlněné PNG v přehledu, malé vlajky a dlaždice/pohár beze změny.

## Exportní řetězec a ověření

Preview používá tentýž img jako export. createFederalReportCanvas klonuje report bez náhledového transformu a rasterizuje jednou html2canvas scale1 přímo1920×1080. PNG je lossless; jsPDF vkládá tentýž PNG na stránku1440×810pt (16:9), bez JPEG/nového zmenšení pixelů. PDF zůstává rastrový FullHD report, nikoli vektorový dokument pro neomezené zvětšování.

- Skutečné A1/A2/B PNG a PDF pro desktop i mobil:6párů PASS, PNG1920×1080, PDF1440×810.
- Extrahovaný obraz z každého finálního PDF pixelově totožný s PNG; PDF nezhoršuje kvalitu. Všechny3desktop PDF navíc vyrenderovány Popplerem při96dpi a vizuálně prohlédnuty.
- Pixelové porovnání před/po: mimo boxy vlajek s12px rezervou jsou všechny3reporty přesně stejné. Žádný posun obsahu, změna statistik nebo zmenšení písma.
- Aktualizovaný federal-93-presentation-browser PASS: přímé přesné vektory, všech13metrik, partial/reasons, Resafe, dialog/zoom/Escape, desktop/mobil a exportní parita;0Firebase požadavků/zápisů/JS chyb.
- Skutečný místní Singles#3 a9f06904-00a5-4518-a81a-eae5a9425a35: SK93 %/14 vsCZ95 %/38, původní SHA256 exportu7494ec7168498e43bce3bfb30f4d53556685dfc45eb130ad5816614992e83d48 beze změny. Nejde o čtení produkčního Firebase.

## Srovnání1:1 a soubory

V horním řádku původní93, v dolním opravená94; výřezy přesně120×80 bez změny měřítka. Doplňkové2x obrázky používají nearest-neighbor jen pro kontrolu pixelů, nikoli úpravu exportu.

- [A1 detail1:1](screenshots/federal-94-A1-flags-1to1.png), [A2 detail1:1](screenshots/federal-94-A2-flags-1to1.png), [B detail1:1](screenshots/federal-94-B-flags-1to1.png).
- Celé nové PNG: [A1](screenshots/federal-94-A1.png), [A2](screenshots/federal-94-A2.png), [B](screenshots/federal-94-B.png).
- Lokální skutečné PDF/PNG: output/flag-sharpness/after/{A1,A2,B}{,-mobile}.{png,pdf}. Původní a neúspěšná přímá SVG varianta: sourozenecké adresáře before/svg.
- [Strojové výsledky](federal-94-flag-verification.json).

Reprodukce: nastav PDF_LIB_DIR na připnuté html2canvas1.4.1/jsPDF2.5.2, FC_REAL_BACKUP na dodaný nezměněný JSON, FC_ARTIFACT_DIR na output/flag-sharpness/after a FC_SCREENSHOT_DIR na jeho screenshots. Spusť node tests/federal-93-presentation-browser.cjs. Se stejnými exporty předchozí93 v adresáři before spustí Python scripts/verify-federal-flag-exports.py kontrolu pixelů/PDF a1:1 výřezy (Pillow,pypdf). Výpočty a Firebase logika nejsou změněny. Žádná migrace ani produkční zápisy.

## Regrese a vydání

Verze94 je povinný nový vizuální kandidát podle AGENTS.md,93 už byla vydána. Overlay se mění pouze číslem verze. Čeká schválení vzhledu, neslučovat ani nenasazovat. Skutečné OBS/Auth/produkční Firebase a fyzický iPhone nebyly testovány a tato změna je neovlivňuje.

Finální lokální Node regrese:198/200, pouze dvě známá preview-match-reload-recovery.test.cjs:50,106; nejde o plně zelené CI. Release gate proti čerstvému origin/main ea1caaa a git diff --check PASS.
