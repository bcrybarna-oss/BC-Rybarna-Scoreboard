# Export pro Pushout – v4.51.95 RC

Zadavatel: Dominik. Datum: 24. 10. 2026. Kandidát z origin/main fd40f0e (produkce94). Neslučovat ani nenasazovat.

## Implementace

V diváckém Federal Cupu má dokončený zápas s platným uloženým matchId vedle STATISTIKY ZÁPASU tlačítko EXPORT PRO PUSHOUT. Používá stejnou ověřenou volbu zdroje jako A1; při kliknutí znovu ověří rok, číslo, jednoznačný matchId, dokončení a vybraný zdroj. Neodehrané zápasy a samotné ručně zadané skóre tlačítko nemají. Ostatní části aplikace, skórování, stream, Firebase a grafika reportů nejsou měněny.

Společné federalStatsSide/federalCalculateMatch API rozšířeno o missedPots, drySoftBreaks, foulBreaks, ownBreakLosses. Missed pots je rozdíl evidovaných pottingAttempts a successfulPottingStrokes, sdílí coverage/reasons s pottingSuccess. Faul bez doloženého pot intentu ani push out automaticky nepřidává miss. Dry/soft používá sjednocení dry+soft−softDry; foul je samostatná kategorie. ownBreakLosses používá skutečný breaker/winner dokončených racků. Nové rozstřelové metriky v osobním Team API se skládají ze stejných ověřených racků jako breakSuccess; chybějící nebo konfliktní údaje zůstávají partial/unknown. Původních13metrik beze změny, API má17výstupů. Původní push-out testy zachovány; nové exportní testy jsou samostatná sada.

federalPushoutModel je čistá prezentační projekce jediného zápasu z tohoto API. Successful breaks a Break and win vybírají jeho existující numerátory. Procenta používají schválený federalReportMetric včetně partial; XLSX ukládá například93 % jako číselné0.93 s formátem0%. Známé0/0 zůstává0/0, neznámá hodnota—, skutečná nula číselná0. Exportér neobsahuje paralelní sportovní výpočet ani roční agregaci.

Break and runs používá cleanRuns/breakAndRun: pouze dokončení dle stávající aplikační konvence, bez runouts a es. Žádná změna sportovní definice.

## Soubor a soukromí

Přesně2listy: Pushout, Metadata. Hlavní list má požadovaných9anglických metrik ve schváleném pořadí,2sloupce vlastníků, číslo zápasu, disciplínu, konečné skóre a This match only. Bez hvězdiček a interníchID. Metadata obsahuje pouze turnaj/rok/číslo/typ/disciplinu/matchId/časyUTC/skóre/jména vlastníků/reprezentace/soupeře/scope/verzi kontraktu; nikoliv e-maily, AuthUID, tokeny, zálohu, celé soupisky nebo jiné zápasy. Interní coverage/reasons zůstávají v aplikaci, do XLSX se neexportují a nejsou přesunuty do Metadata. Jména jsou výhradně textové inlineStr buňky, nikdy vzorce.

Singles má osobní sloupce se stabilní identitou. Doubles má dva sloupce dvojic, nikoliv smyšlené osobní příspěvky. Team má Slovakia/Czechia jako reprezentační součty; žádné dělení mezi hráče. Pokud stabilní identita chybí, jsou sloupce označené jako strana s nedostupnou identitou a Metadata zachovává typ vlastníka. Unattributed zůstává dohledatelné. Individuální Team data se nově nevymýšlejí ani neexportují z týmových součtů.

Název např. pushout-federal-cup-2026-match-3-singles-daniel-lang-vs-tom-kurz.xlsx. Pro dlouhá jména jsou části názvu bezpečně zkráceny; plné názvy zůstávají v souboru. Místní assets/pushout-xlsx.js zapisuje malý standardní OOXML ZIP bez síťové knihovny; číselné buňky mají explicitní typn, text inlineStr, hodnoty escapované doXML. Sešit neobsahuje makra, vzorce ani externí odkazy. Dvojí kliknutí je blokované, chyba vrací ovládání, BlobURL se po použití uvolní. Žádný zápis zápasu/localStorage ani Firebase.

## Ověření a reprodukce

Nová sada tests/federal-pushout-export.test.cjs ověřuje sharedAPI, překryv rozstřelů, missing/invalid/zero, pot intent, návratovou B&R konvenci, vlastníky, bezpečné texty a ZIP strukturu. tests/federal-pushout-browser.cjs načítá současný index.html, používá úplně zachycenou síť a nulové Firebase požadavky/zápisy. Stahuje skutečné Singles/Doubles/Team XLSX na desktopu i mobilu; ověřuje viditelnost pouze u dokončených zápasů, název, duplicity, chybovou obnovu a neměnnost zdrojů. FC_REAL_BACKUP ukazuje na uživatelem dodaný nezměněný lokální JSON; PDF_LIB_DIR na připnuté knihovny pro společný reportový harness, FC_ARTIFACT_DIR na výstupní adresář. Spuštění node tests/federal-pushout-browser.cjs.

Nezávislé otevření přes openpyxl a ZIP/CRC: python scripts/verify-pushout-xlsx.py --directory output/pushout-95. Ověřeny všechny hodnoty devíti metrik, numerické typy/procentní formát a přesně2listy, žádné vzorce a zachování Pair/Team vlastníků. Ukázkový Singles#3:93 %/95 %, miss1/2, foul1/2, successfulbreak1/3, dry/soft2/0, foulbreak0/1, B&R1/1, breakwin1/3, breaklose2/1. Původní JSON SHA2567494ec7168498e43bce3bfb30f4d53556685dfc45eb130ad5816614992e83d48 zůstává shodný.

Při původní přípravě byl skutečně stažený třílistový sešit importován přes Artifact Tool a vyrenderován pro vizuální kontrolu; ve finální dvoulistové variantě mají oba ponechané listy přesně stejné XML a styly, nikoli nahrazeny jinak vygenerovaným souborem. Screenshoty tlačítka: docs/screenshots/pushout-95-button-{desktop,mobile,detail}.png. Fyzický iPhone/Safari a desktopový Microsoft Excel nebyly ověřeny; mobilní browser je Chromium viewport390×844, validita/čitelnost XLSX ověřena nezávislými čtečkami. Produkční Auth/Firebase nebyly použity. Nová verze95 je pouze kandidát; produkce zůstává94.

## Finální lokální výsledky

- Nová API/exportní sada9/9 PASS, původní push-out testy zachovány a PASS. Celá Node sada **207/209**, pouze známé preview-match-reload-recovery.test.cjs:50,106; žádná nová regrese. CI není plně zelené.
- Skutečný browser: Singles/Doubles/Team × desktop/mobil,6stažených XLSX, guard proti dvojímu kliknutí, chybová obnova, bez tlačítka u rozehraného zápasu a0Firebase/zápisů/JS chyb PASS. První souběžný kontrolní běh narazil na timeout načítání testovací stránky; finální samostatný běh s explicitním DOM/library-ready čekáním prošel.
- Nezávislá openpyxl a ZIP kontrola6souborů PASS: numerické buňky a procentní formát, přesné hodnoty Singles, právě2listy a žádné vzorce. [Manifest](pushout-95-xlsx-verification.json).
- Současný presentation-browser A1/A2/B desktop/mobil PNG/PDF PASS; všech6PNG byteově stejných se schválenými94 a obraz v každémPDF přesně shodný sPNG. [Reportová regrese](pushout-95-report-regression.json).
- [Ukázkový skutečně stažený XLSX](examples/pushout-federal-cup-2026-match-3-singles-daniel-lang-vs-tom-kurz.xlsx). [Tlačítko desktop](screenshots/pushout-95-button-desktop.png), [mobil](screenshots/pushout-95-button-mobile.png), [detail](screenshots/pushout-95-button-detail.png). [Náhled sešitu](screenshots/pushout-95-workbook.png).
- Release gate proti čerstvému origin/main a diff check provedeny před PR; nasazení není součástí zadání.

Otestováno a pushnuto jako **3b001b86bd1890b3eec945f04754733f6834a878** do [draft PR #33](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/33). [CI40072599235](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40072599235): Release version and revision **success**, Node **207/209 failure**; log potvrzuje pouze známé preview-match-reload-recovery.test.cjs:50,106, žádná nová regrese. CI není plně zelené. Následný dokumentační commit nemění otestované HTML, exportér ani ukázkový XLSX. **Nesloučeno a nenasazeno.**

## Závěrečná úprava před schváleným nasazením

24.10.2026 Dominik výslovně požádal odstranit celý Data notes. Výsledný XLSX má jen **Pushout a Metadata**. Poznámky se nepřesouvají do jiných buněk, listů, komentářů či souborových vlastností. Interní diagnostický kontrakt, výpočty a schválené zobrazení hodnot zůstávají beze změny. Ověření skutečných6stažených souborů porovnává sheet1.xml, sheet2.xml a styles.xml s předchozí třílistovou variantou: přesná byteová shoda, tedy nezměněné hodnoty i formátování. Kontrolní Singles všech9metrik zachován. Ukázkový XLSX aktualizován ze skutečného browserového stažení. Původní místní kopie již měla2listy (styly buněk shodné, výšky řádků nepatrně zaokrouhlené tabulkovým editorem); před nahrazením zachována v output/pushout-95-before-two-sheets/local-example.xlsx.

Node207/209 pouze dvě známá selhání; exportní sada9/9 a aktualizovaný browserový dvoulistový test PASS. Nasazení schváleno, čeká finální CI a merge. Historické výše uvedené výsledky třílistové přípravy nejsou popisem finálního souboru.
