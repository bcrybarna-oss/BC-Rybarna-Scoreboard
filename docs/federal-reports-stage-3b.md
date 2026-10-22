# Federal Cup – etapa 3B (Dominik, 22. 10. 2026)

Kandidát **v4.51.90 RC**, pokračování stejného vydání a stejného PR #28. **Finální vizuální iterace nad ea5d6e0, kód 238a1cfff546384a20bdba4fe1c5a1f54f927045 otestován a pushnut ve stejném otevřeném PR #28; nesloučeno, nenasazeno.** Produkce zůstává v4.51.89 RC. Reference přibyly jako commity 209af0d a 5c6ce04; bezpečný fast-forward zachoval všechny lokální rozpracované úpravy 3B.

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
