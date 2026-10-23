# Nasazení v4.51.93 RC – PR #31

Zadavatel: Dominik. Datum: 23. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.** Existující produkční zápasy se neupravovaly ani nemigrovaly; žádné testovací zápisy do Firebase.

- Produkční URL: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/ – skutečně **v4.51.93 RC**.
- PR #31 schválen a sloučen metodou merge se zachováním historie. Finální hlava952e51011179aedbabd93a71ee2d0720dea9d0e0, bez nových cizích změn nebo konfliktu.
- Nasazený aplikační merge commit: **990e68e39688e93f13b67496a753bf729417ea9d**.
- [Pages39985605856](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39985605856): build/deploy/report **success**, žádné ruční opakování.
- [Main CI39985606523](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39985606523): Release version and revision **success**, Node **198/200 failure**. Log potvrzuje výhradně preview-match-reload-recovery.test.cjs:50,106. Shodné assertiony byly před merge ověřeny na aktuálním mainac62019/run39974230195; tyto testy, test-modular ani CI se vPR nemění. Finální PR CI39984583712 stejný výsledek. **CI není plně zelené**, žádná nová regrese.
- Aktualizovaný **celý federal-evidence-browser PASS** před merge i nad staženým produkčním HTML s izolovaným Auth/Firebase mockem; zachovány všechny jeho scénáře. Původně zastaralý scénář již není otevřeným selháním.

## Přímá kontrola veřejného webu

Smoke dokončen23.10.2026 18:21CEST (16:21UTC). Index, overlay a12assetů HTTP200, přesné SHA256 shody smerge; běžná URL/index.html i fresh query vracejí stejné nové HTML. Verze93 ověřena vhlavičce, about i overlay. Úspěšný deployment tedy doplněn skutečnou kontrolou publikovaného obsahu, nikoli odhadnut zmerge.

Desktop i mobil: hlavní obrazovky, dlaždice FEDERAL CUP/2026 sHTMLtextem a oběma malými vlajkami, samostatný zlatý/bronzový pohár bez zeleného odrazu. Aktuální PNG obou velkých vlajek načtené ze správných assetů1920×1320, bez rámečku a sjemnými nepravidelnými záhyby. Tabule,21zápasů a soupisky dostupné. Jediné společné **STATISTIKY TÝMŮ** otevírá A2. Zachována výchozí volba Bez streamu a panel pod herním ovládáním; nezadaný overlay bezpečně offline.

Veřejný prázdný A2 má13metrik, **Resafe**, žádné hvězdičky ani odstraněné horní/spodní informační popisky. Branding a DOMÁCÍ/HOSTÉ zůstávají. Skutečné stažení PNG1920×1080 a PDF1440×810 (16:9) PASS. Mobilní náhled/zvětšení/Escape PASS. **0 pageerror,0 console error,0 pokusů o zápis.**

Čerstvý nepřihlášený browser nemá skutečná uložená A1/B dostupná. Prázdný A2 není vydáván za kontrolu skutečných cloudových statistik; tato hranice je oddělena od následující izolované kontroly.

## Kontrolní Singles #3 na skutečně publikovaném kódu

Zdroj tvoří index.html stažený zPages a ověřený přesným hashem. Pro testovací přístup ke closure byly přidány pouze hooky; veškerý Firebase/Auth provoz nahrazen izolovaným mockem. Assety odpovídají veřejným souborům. Test nezapisuje na produkci.

Místní export `BC_Rybarna_Scoreboard_Backup_2026-10-23 (1).json`, přesný matchId **a9f06904-00a5-4518-a81a-eae5a9425a35**, sezóna2026, Singles#3,Daniel Lang–Tom Kurz2:5:

| Strana | Úspěšnost potopení | Potopené koule |
|---|---|---|
| Slovensko | **93 %** | **14** |
| Česko | **95 %** | **38** |

A1 a výřez A2/B obsahující pouze tento zápas mají správné hodnoty bez hvězdiček/popisků, Resafe a stejné národní symboly. Interní SKpotting14/15 nadále **partial** sunknown_attempts/unknown_intent; neúplnost se prezentačním formatterem nefalšuje. Faul není automaticky potápěcí pokus; push out nepřidává statistické poty/pokusy. A2/B výřez není celý produkční ročník.

Desktop i mobil: **6 skutečných PNG1920×1080/PDF1440×810 párů PASS**. Všechny aktuální PNG bajtově identické se schválenými review artefakty (které mají ověřenou pixelovou shodu vloženého PDFobrazu). Mobilní PNG stejné jako desktop; funkční dialog/export/zoom/Resafe bez JS chyb. Celý aktualizovaný evidence-browser zopakován na stejném publikovaném HTML, izolované skutečné writer/reader JSON/PUT/GET/reload/UNDO a mocked Auth PASS.

Zdrojový export nadále SHA256 **7494ec7168498e43bce3bfb30f4d53556685dfc45eb130ad5816614992e83d48**. Žádné přepsání exportu, oprava původního Team1:5 ani plošná migrace.

## Evidence a omezení

- [Strojová evidence](deployment-v4.51.93-verification.json)
- [Dlaždice desktop](screenshots/production-93-tile-desktop.png), [mobil](screenshots/production-93-tile-mobile.png)
- [Federal Cup desktop](screenshots/production-93-federal-desktop.png), [mobil](screenshots/production-93-federal-mobile.png)
- [Mobilní dialog při zvětšení](screenshots/production-93-dialog-mobile.png)
- [Implementace, kontrolní reporty a PDF](federal-cup-v4.51.93.md)

Skutečné produkční Auth/Firebase/Rules, zápis do produkčního cloudu, reálné OBS a fyzický iPhone nejsou ověřeny. Lokální export není zaměňován za aktuální cloudový stav. Následný čistě dokumentační commit nemění aplikaci/verzi, může spustit další automatický Pages běh; nejde o ruční opakování deploymentu.
