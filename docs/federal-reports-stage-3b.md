# Federal Cup – etapa 3B (Dominik, 22. 10. 2026)

Poslední funkční doplnění stejného kandidáta (Dominik, 23. 10. 2026) je v [samostatném přehledu](release-90-final-functional-review.md): volitelný stream před startem, panel pod akcemi a úplná validace nasazování. Schválené grafické reporty, 13 výpočtů a exportní kód zůstávají bajtově nezměněné. Skutečné exporty a UI znovu regresně ověřeny; PR #28 bez merge/deploy.

Kandidát **v4.51.90 RC**, pokračování stejného vydání a stejného PR #28. **Finální vizuální iterace nad ea5d6e0, kód 238a1cfff546384a20bdba4fe1c5a1f54f927045 otestován a pushnut ve stejném otevřeném PR #28; nesloučeno, nenasazeno.** Produkce zůstává v4.51.89 RC. Reference přibyly jako commity 209af0d a 5c6ce04; bezpečný fast-forward zachoval všechny lokální rozpracované úpravy 3B.

## Aktuální zjednodušení vieweru (Dominik, 23. 10. 2026)

Stejná větev a PR #28 nad a621cd9, main f6c3e0f / produkce 89. Kandidát **v4.51.90 RC** zůstává nevydaný. Lokálně otestováno: 69/69 výpočty, Node 179/181 pouze známé dvě test-modular chyby; report/UI, Federal Cup, detailní počítadlo, stream-controls/isolation/lag/release-version a skutečné PNG/PDF reportů i původní PDF exporty PASS. A1/A2/B PNG bajtově shodné se schválenými; PDF 1×16:9 a přesné vložené pixely. Otestováno a pushnuto jako **b6d67d3e4786cd76f279b55e34fa873db84fcac9**; následný dokumentační commit nemění HTML. [CI zjednodušení b6d67d3](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39913404203): Release version and revision **success**, Node **179/181 failure**. Log ověřen: výhradně známé dvě chyby preview-match-reload-recovery.test.cjs:50,106 v test-modular, žádná nová regrese. CI není plně zelené. **Neslučovat a nenasazovat.** Následující oddíl nahrazuje dřívější chování 21 zápasových tlačítek popsané v historické revizi níže.

Viewer nyní tvoří pouze tabule reprezentací, program/výsledky a přímo navazující soupisky. Není zde nadpis/tabulka/poznámka Statistiky obou týmů ani původní detailní tlačítko. A1 STATISTIKY ZÁPASU je právě jedno a pouze u dostupného dokončeného uloženého zápasu. Používá existující selector reportu (rok, fixture, ID, stav, platný výsledek/typ, hostitel, hodnocená série); neodehrané, ruční výsledky bez detailu a zápasy mimo sérii tlačítko nemají. Ochrana proti zastaralému ID při otevření zůstává. A2 a B beze změny, stejně jako admin a staré detailní statistiky jinde v aplikaci.

Aktuální syntetické screenshoty skutečného index.html (desktop 1440×1000, mobil 390×844):

| Pohled | Soubor |
| --- | --- |
| Desktop celý přehled | [Přehled](screenshots/federal-ui-desktop-overview.png) |
| Desktop program | [Zápasy](screenshots/federal-ui-desktop-matches.png) |
| Desktop soupisky | [Soupisky](screenshots/federal-ui-desktop-players.png) |
| Mobil celý přehled | [Přehled](screenshots/federal-ui-mobile-entries.png) |
| Mobil program | [Zápasy](screenshots/federal-ui-mobile-matches.png) |
| Mobil soupisky | [Soupisky](screenshots/federal-ui-mobile-players.png) |

`npm run test:federal-report-ui` znovu pořizuje tyto i původní dialog/tabule screenshoty. Report browser navíc ověřuje dostupnost a skutečné otevření starých detailních statistik z Historie. PNG/PDF generátor a vizuální šablony se touto změnou nemění. Veškerá síť při testech izolována; žádné testovací zápisy do produkční Firebase.

## Historická finální revize UI a exportů (před zjednodušením)



Zadavatel potvrdil vizuální schválení A1/A2/B. Tato revize neprovádí redesign a nezasahuje do výpočtů. Výchozí hlava b5d66d8, po čerstvém fetchi main stále f6c3e0f; stejný nevydaný kandidát v4.51.90 RC a stejný PR #28. **Otestováno a pushnuto jako b8ff6187e628b64ce18873e31bef896c0c4fc575; nesloučeno, nenasazeno.** Ke společnému přijetí nyní čeká skutečné ovládání v aplikaci.

### Čistá publikace a zachované vysvětlení

V PNG/PDF už nejsou interní ID, kanonická evidence, API 13 metrik, zdrojové výpisy typu #1 team ani VYBRANÁ REPREZENTACE. A1 dál uvádí veřejné číslo/typ zápasu; jde o identifikaci utkání pro diváka, nikoli interní databázové ID. A2 má symetrické DOMÁCÍ/HOSTÉ a pouze decentní grafické zvýraznění vybraného týmu. Všechny publikace mají stručně: „Statistiky vycházejí z dostupné evidence zápasů. Část = doložené údaje; — = neznámá evidence.“ Částečné hodnoty a neznámé údaje se nadále nesmějí vydávat za úplné výsledky; zůstávají bez smyšlených procent a sloupců.

Rozbalovací nápověda mimo plátno zachovává všech 13 zdrojových vysvětlení, ID zápasu/hráče, použité zápasy a důvody neúplnosti i rozdíl mezi osobními výsledky celých Singles/Doubles/Team a vlastním herním výkonem Singles/Team. Otevření nic neukládá ani nečte z Firebase. Logo BC Rybárna má konzistentní poměr stran a vertikální střed s podpisem; rozměry a odsazení zachovávají místo pro všech 13 řádků.

### Revize skutečných vstupů

- U výsledkové tabule dvě STATISTIKY TÝMU, podle stabilní reprezentace SK/CZ.
- U všech 21 fixture STATISTIKY ZÁPASU, vazba přes matchId + fixture a rok; nedokončený/nedostupný/nahrazený novějším záznamem má vysvětlení a zakázané exporty.
- U deseti naplněných míst soupisky STATISTIKY HRÁČE podle stabilního ID, ne jména či indexu. Neznámá identita má vysvětlení; nedoložený výkon —.

Původní kontrola ukázala hráčská tlačítka nepravidelně za různě dlouhými jmény a zápasové akce těsně vedle sebe. Minimální změny: střídmé černo-zlaté tlačítko s výškou alespoň 44 px, jednotné pravé zarovnání v soupisce, odstupy a zalamování dvojice zápasových akcí. Výsledek/jména zůstávají dominantní. Žádné reportové vstupy nepřidány jinam.

Dialog zachovává nativní modalitu, zavření/ Escape/návrat fokusu. Mobilní zvětšení posouvá pouze samostatný náhled; toolbar a vysvětlivky se horizontálně neodsunou. Tlačítko střídá ZVĚTŠIT/ZMENŠIT NÁHLED a aria-pressed. Během exportu jsou PNG/PDF vypnuté a druhá syntetická kliknutí nezaloží další render; zavření zruší zastaralé stažení. Chyba knihovny má viditelnou zprávu a obnoví tlačítka.

### Povinné skutečné UI screenshoty

Všechny ze skutečného současného index.html, se syntetickými izolovanými daty a zachycenou sítí. Desktop 1440×1000, mobil 390×844; mobilní celá stránka ukazuje všechny tři druhy vstupů. Doplňkové mobilní výřezy jsou samostatné viewport screenshoty kvůli čitelnosti.

| Pohled | Soubor |
| --- | --- |
| 1. Desktop: tabule a STATISTIKY TÝMU | [Screenshot](screenshots/federal-ui-desktop-teams.png) |
| 2. Desktop: program a STATISTIKY ZÁPASU | [Screenshot](screenshots/federal-ui-desktop-matches.png) |
| 3. Desktop: soupisky a STATISTIKY HRÁČE | [Screenshot](screenshots/federal-ui-desktop-players.png) |
| 4. Desktop: otevřený dialog a exporty | [Screenshot](screenshots/federal-ui-desktop-dialog.png) |
| 5. Mobil: vstupy v celé obrazovce FC | [Celá stránka](screenshots/federal-ui-mobile-entries.png); [tabule](screenshots/federal-ui-mobile-teams.png), [zápasy](screenshots/federal-ui-mobile-matches.png), [soupisky](screenshots/federal-ui-mobile-players.png) |
| 6. Mobil: otevřený dialog | [Screenshot](screenshots/federal-ui-mobile-dialog.png) |

Finální PNG/PDF A1/A2/B jsou na původních odkazech níže. Screenshoty zachycují offline syntetickou kontrolu, proto aplikace pravdivě upozorňuje na nepřihlášený stav; nejde o ověření skutečné produkční Auth.

### Ověření této revize

Data/výpočty 69/69. Node 179/181, pouze dvě známé nezměněné chyby preview-match-reload-recovery.test.cjs:50,106 nad test-modular; CI není plně zelené. Report browser a nový `tests/federal-report-ui-browser.cjs`: 21/10/2 FC-only vstupů, 44px a zarovnání, identity/typy, partial/unknown, nedostupnost, rozbalovací podrobnosti, Close/Escape/focus, mobilní zoom/pan bez odsunutí ovládání, neměnné data/localStorage a 0 Firebase či vzdálených zápisů/JS chyb. Nativní dialog při tabulaci může předat fokus browser chrome (body jako activeElement); nikoli jinému ovládání stránky.

Relevantní Federal Cup, detailed-counter, stream-controls/isolation/lag/release-version PASS. Výpočetní API, report-data agregace/formátování, SVG score/title/frame/shade, fotopodklad, originální reference a overlay bajtově beze změny proti b5d66d8. Finální exportní test PASS: PNG 1920×1080 a PDF 1440×810 A1/A2/B, všechny tři na mobilu DPR3 se stejnými PNG jako desktop; bez technických textů a výpisů v plátnu, podrobnosti zachované mimo plátno. Duplicitní kliknutí na oba exporty během renderu vyvolají právě jeden render; cancel/chyby nezanechají soubor nebo zakázané ovládání. Pypdf potvrdil jednu stránku a přesnou shodu pixelů vloženého PNG, Poppler všechny tři vizuálně ověřen. Průměrný rozdíl screenshotu náhledu a PNG R/G/B (0–255): A1 6,08/5,41/5,32; A2 6,72/6,01/5,83; B 6,56/5,71/4,63. Geometrie a text všech 13 řádků kontrolovány nezávisle. Release gate po čerstvém main f6c3e0f a diff --check PASS. [CI finální UI revize b8ff618](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39909089440): Release version and revision **success**, Node **179/181 failure**. Log ověřen: právě dvě známá nezměněná selhání preview-match-reload-recovery.test.cjs:50,106 v test-modular; žádná nová regrese. CI není plně zelené. Následný dokumentační commit nemění otestované HTML. Bez produkčních zápisů, merge/deploy.

Následuje dokumentace předchozí grafické iterace a původní konstrukce reportů; aktuální předání UI je výše.

## Reference a provedení

Závazné originály: [A1](design-references/federal-cup/A1_match_report.png), [A2](design-references/federal-cup/A2_national_teams.png), [B](design-references/federal-cup/B_individual_player.png). Originální PNG nejsou upravené a nejsou runtime pozadím s pevnými daty.

| Oblast | Realizace a schválená odchylka |
| --- | --- |
| Pozadí | Modrý stůl, teplé rozostřené světlo, koule 9 vpravo nahoře, tmavé spodní pole. Nový čistý asset podle A1; není původní oddělený fotografický zdroj. |
| Značky | Oficiální projektové logo Poolčítadla vlevo nahoře se správným poměrem stran, původní znak BC Rybárna a podpis vpravo dole s větším odstupem a jemnou zlatou dělicí linkou. Samostatná alfa varianta loga zachovává původní barevné pixely, s maskou tmavého pozadí podle existujícího SVG postupu; zdrojové logo nedotčené. |
| A1/A2 | Společná kompozice: metalický SVG titulek, lomené barevné jmenné panely a samostatné tvarované SVG skóre; hodnoty–grafy–názvy–grafy–hodnoty. SK červeně vlevo, CZ modře vpravo podle explicitního hostitele; originály měly opačné pořadí. |
| B | Individuální titulek a Federal Cup, vlajka/jméno bez slovní reprezentace, vedle čtyři stejně velké vrstvené karty VÝHRY / PROHRY / **% VÝHER** / ČISTÉ HRY (výpočet třetí karty beze změny). Jediný sloupec skupin; název–graf–hodnota. Barva podle reprezentace. |
| Ukazatele | Všech 13 v ROZSTŘEL / ÚTOK / OBRANA / FAULY, včetně Esa i tam, kde je A1/B originál neobsahoval. Bez nového výpočtu metrik. |
| Sloupce | Procenta 0–100, poměry podle n/d, v A absolutní hodnoty proti vyšší úplné hodnotě řádku. V B absolutní počty/průměry pouze číslem, oproti původnímu obrázku bez umělé procentní škály. Delší sloupec faulů není označen jako lepší výkon. |
| Typografie | Česká diakritika, celé procento, průměr jedno desetinné místo s čárkou, poměry s mezerami. Arial jako dostupný lokální font; žádný externí font. Titulky a skóre mají dynamický SVG text s jemným metalickým přechodem; jména vrstvený stín, čísla tabulární zarovnání. Jména a dlouhé hodnoty se přizpůsobí šířce. |
| Úplnost | Část = doložený mezisoučet, bez oficiálního procenta/sloupce; unknown —; úplné 0/0 bez pokusů. Zdrojové vysvětlení i rozdíl výsledků a osobního výkonu zachován. |

Vizuální omezení pro společné posouzení: jde o dynamickou HTML realizaci kompozice, nikoli pixelovou kopii. Jmenné panely i střed mají lomené SVG rámy, jemnou vnitřní hranu a zlatý gradient. Titulky a skóre mají metalické SVG písmo, nejsou rastrovými výřezy předloh. Čistý podklad je rekonstrukce z reference. Před vydáním zbývá grafické schválení Dominikem.

## Vizuální doladění podle zadání Dominika (22. 10. 2026)

Před úpravami porovnány všechny tři skutečné exporty commitu 83bc44b s originály A1/A2/B. Rozdíly byly konkrétní: obdélníkové skóre bez výběžku, zaoblené jmenné panely bez lomení, plochý titulek, silný vnitřní lem sloupců a nevýrazné dekorativní zakončení linek. Podklad `assets/federal-report-billiards.webp` je nyní zadavatelem výslovně přijat k zachování a jeho bajty zůstávají beze změny.

| Varianta | Před doladěním | Přiblížení referenci a aktuální výsledek |
| --- | --- | --- |
| A1 | [Původní export 3B](https://raw.githubusercontent.com/bcrybarna-oss/BC-Rybarna-Scoreboard/83bc44b/docs/screenshots/federal-3b-match.png): obyčejné obdélníkové skóre, zaoblené panely. | [Nové PNG](screenshots/federal-3b-match.png): dominantní střed s rozšířeným vrškem, šikmými boky a spodním výběžkem pro VS. Lomené zlaté rámy jmen, gradientové přechody, metalický titulek, jemné barevné sloupce. |
| A2 | [Původní export 3B](https://raw.githubusercontent.com/bcrybarna-oss/BC-Rybarna-Scoreboard/83bc44b/docs/screenshots/federal-3b-teams.png): stejná jednoduchá výsledková karta. | [Nové PNG](screenshots/federal-3b-teams.png): tatáž sdílená šablona/frame helper jako A1, spodní výběžek „Skóre zápasů“, stejné proporce a dělení. SK červeně vlevo podle hostitele, nikoli podle pořadí reference. |
| B | [Původní export 3B](https://raw.githubusercontent.com/bcrybarna-oss/BC-Rybarna-Scoreboard/83bc44b/docs/screenshots/federal-3b-player.png): jednoduchá jmenná karta a titulek, třetí karta ÚSPĚŠNOST. | [Nové PNG](screenshots/federal-3b-player.png): samostatný lomený panel hráče, vyvážené čtyři karty s novým % VÝHER, metalický titulek a sladěné sloupce, kategorie i patička. Bez slovního názvu reprezentace. |

### Středové skóre A1/A2

Není to obdélník s přidaným stínem. SVG má vlastní polygon 360×160: horní rozšířená hrana, sbíhající se boky, odsazená ramena a spodní lichoběžníkový výběžek. Tmavá silueta odděluje střed od obou jmenných panelů. Druhá vrstva kreslí tříbodový zlatý rám s přechodem od světlé hrany po teplý stín; tenké vnitřní linky dodávají hloubku. Vnitřek má tmavý gradient se slabým zlatým světlem. Číslice jsou stále ze skutečných dat: samostatný SVG text ve dvou vrstvách (spodní reliéf a zlatý přechod), centrovaný na x=180. Písmo se podle měřené šířky automaticky zmenší pro delší skóre, bez posunu rámu nebo změny sportovního výsledku. Spodní popisek VS / Skóre zápasů nepřebírá a nepočítá data.

Zlaté rámy panelů mají zrcadlené šikmé vnitřní hrany a horní zářez. Vnější vlajky mají jednotnou velikost, jména vyhrazené pole a domácí/hostující popisky zůstávají pod rámem. Budoucí opačný hostitel mění pouze prezentované pořadí; SK/CZ identity, barvy a metriky zůstávají na svých stranách zdrojových dat.

Sloupce používají temně modrý track, vodorovný barevný přechod a jedinou jemnou světlou horní hranu; bez silného vnitřního šedého rámečku nebo neonu. Kategorie mají tenké zlaté linky s jemným bodovým zakončením. Stejný tmavý obsahový přechod a vinětace jsou samostatné inline SVG nad nezměněným fotografickým podkladem; toto řešení odstraňuje rozdílné skládání poloprůhledných CSS gradientů v html2canvas.

**Terminologie:** ve všech A1/A2/B i vysvětlení je `Úspěšnost úniků z jistot`; v B třetí horní karta `% VÝHER`. Interní `escapeSuccess`, vzorce, výsledky celých zápasů ani osobní herní výkon nejsou změněné. Delší popisek má vyhrazenou šířku, nezalamuje se a browser kontroluje jeho přetečení.

### Rozsah a omezení doladění

Předlohy jsou závazný kompoziční vzor, nikoli pixelový snapshot. Nové SVG rámy a metalické písmo zřetelně přibližují hlavní rozdíly, původní fotografie i loga jsou zachované. Všech 13 metrik včetně Esa je nadále přítomných, i když některé reference ukazují méně řádků. U B zůstávají absolutní počty/průměry bez falešných grafů. Prosté HTML texty mohou mít mezi Chrome a html2canvas drobné rozdíly antialiasingu a základní linky; SVG titulky/skóre/rámy a rozměry zůstávají shodné. PDF je stále obrazové. Konečné vizuální schválení se neprohlašuje za hotové bez zadavatele.

## Oddělený podklad

Runtime: `assets/federal-report-billiards.webp` (1920×1080). Vytvořen vestavěným imagegen z A1 jako čistý podklad; pouze fotografie stolu, světel a koule 9. Bez log, vlajek, UI a údajů; všechny údaje a grafy jsou živé HTML. Náhled i export čekají na dekódování obrázků, při chybě odmítnou prázdný export. Loga i podklad ze stejného originu, bez externího CORS.

Přesný prompt je uložen v [federal-report-background-prompt.txt](federal-report-background-prompt.txt). Nevytvořen náhodný nesouvisející obrázek; původní samostatný zdroj neexistoval. Zadavatel při tomto doladění výslovně požaduje podklad zachovat; žádný další nebyl generován.

## Exportní cesta

Pouze dialog uvnitř Federal Cupu: STÁHNOUT PNG / STÁHNOUT PDF / ZVĚTŠIT NÁHLED. Náhled má vždy pevnou stránku 1920×1080 a na mobilu se zmenší, volitelně lze posouvat zvětšený náhled. `html2canvas` 1.4.1 a `jsPDF` 2.5.2 jsou stejné již používané klientské knihovny. Oddělená dočasná kopie, scale=1, bez závislosti na DPR/viewportu. PNG skutečně 1920×1080; PDF jedna strana 1440×810 pt, celý stejný PNG. PDF je obrazové, nikoli vyhledatelný text. Žádný server ani Firebase zápis.

Kontrola načtených knihoven, fontů, obrázků a přetečení před uložením. Dvojklik blokován; zavření či změna reportu zruší zastaralé stažení; chyby obnoví tlačítka. Extrémně dlouhé údaje, které nejdou čitelně vměstnat, mají explicitní chybu místo tichého ořezu. Vysvětlení zdrojů zůstává mimo publikovaný list, stručná poznámka o evidenci je v něm.

## Ukázky ze skutečného browseru (syntetická izolovaná data)

- A1: [PNG 1920×1080](screenshots/federal-3b-match.png), [PDF](examples/federal-3b-match.pdf).
- A2: [PNG 1920×1080](screenshots/federal-3b-teams.png), [PDF](examples/federal-3b-teams.pdf).
- B: [PNG 1920×1080](screenshots/federal-3b-player.png), [PDF](examples/federal-3b-player.pdf).

Exporty mají aktuální fixture data, nikoli fiktivní čísla z grafických předloh. Browserové screenshoty náhledu a další Doubles/Team/partial/mobilní exporty lze reprodukovat do `output/pdf/federal-stage3b/`.

## Ověření

- Výpočetní a datové testy **69/69**, původní API 13 metrik beze změny.
- Úplná Node sada **179/181**. Výhradně dvě známá nezměněná selhání `preview-match-reload-recovery.test.cjs:50,106` nad `test-modular`; CI není plně zelené. Testy zachované, selhání neskrýváno.
- Report browser: tři vstupy pouze FC, Singles/Doubles/Team, stabilní identity, výsledky, pořadí/barvy, partial/unknown/0/0, dlouhá jména a escapování, mobil, focus/Escape, nulové změny dat/localStorage, žádné report fetch a zápisy.
- Export browser: nové názvy, lomené rámy, stejné rozměry karet, skóre 0:11 / 11:0 / 10:9 / 123:999 bez ořezu; skutečná stažení A1/A2/B PNG i PDF, Doubles/Team PNG, fyzické rozměry, 13 údajů, fonty/diakritika, skutečně načtené vlajky/loga/podklad, poměr PDF, všechny A1/A2/B na mobilu DPR3 se shodným PNG jako desktop, částečná evidence, zoom, chybějící knihovna a zrušení rozpracovaného exportu; bez kontaktování Firebase a bez JS chyb.
- PDF: pypdf kontrola jedné stránky 1440×810 pt a bajtově shodných pixelů vloženého obrázku s PNG; Poppler render a vizuální kontrola. HTML náhled a canvas mohou mít drobné rozdíly antialiasingu/stínů; nejde o příslib bitové shody dvou renderovacích enginů.
- Regrese současného indexu: Federal Cup, evidence (mock Auth, reload, full PUT/GET), detailed-counter, Jump/Bank a stream-controls/isolation/lag, release-version. Síť izolována; žádné produkční zápisy.
- Předchozí ověření před vizuálním doladěním (kód 83bc44b): release gate proti čerstvému origin/main f6c3e0f a git diff --check PASS. Všechny uvedené browserové regrese i původní čtyři PDF exporty PASS. [CI kódového commitu 83bc44b](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39792692476): Release version and revision **success**, Node **179/181 failure**. Log ověřen: výhradně dvě známá selhání preview-match-reload-recovery.test.cjs:50,106 v test-modular; žádná nová regrese. CI není plně zelené. Následný dokumentační commit nemění otestovaný kód.

Spuštění exportu: `NODE_PATH` směřuje na Playwright runtime, `PDF_LIB_DIR` na místní dvě připnuté JS knihovny; `npm run test:federal-report-exports`. Sandbox zde rušil skutečná stažení; plné stažení ověřováno s povoleným browserem mimo sandbox a kompletně zachycenou sítí.

Neověřeno: fyzické telefony/iOS Safari, reálné Auth/Firebase/Rules a OBS, offline první načtení CDN knihoven, produkční hosting/CORS a zátěž. Grafické přijetí čeká na revizi. Žádný merge/deploy ani změny oprávnění.

Aktuální vizuální iterace: 69/69 datových kontrol a Node 179/181 (jen známé dvě chyby). Federal Cup, detailed-counter, stream-controls/isolation/lag/release-version a původní PDF exporty PASS. Výpočetní API, reportová datová agregace i formátovač bajtově shodné s ea5d6e0. Nový release gate po čerstvém fetchi main f6c3e0f a diff --check PASS. Finální A1/A2/B skutečné PNG/PDF i mobil DPR3 PASS: mobilní PNG jsou bajtově shodné s desktopem u všech tří reportů. Pypdf ověřil jednu stránku PDF 1440×810 a shodné pixely s PNG 1920×1080, Poppler všechny tři vizuálně ověřen. Průměrný rozdíl screenshotu náhledu a PNG na kanál R/G/B (0–255): A1 6,29/5,61/5,49; A2 6,96/6,23/6,02; B 7,15/6,40/5,28, včetně odlišného vyhlazení HTML textů. Geometry/data/13 řádků kontrolovány nezávisle; bitová shoda různých rendererů se netvrdí. [CI vizuálního commitu 238a1cf](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39845555143): Release version and revision **success**, Node **179/181 failure**. Log ověřen: výhradně dvě známá nezměněná selhání preview-match-reload-recovery.test.cjs:50,106 v test-modular, žádná nová regrese. CI není plně zelené. Následný dokumentační commit nemění otestované HTML. Bez merge/deploy.
