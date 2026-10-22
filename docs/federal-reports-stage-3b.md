# Federal Cup – etapa 3B (Dominik, 22. 10. 2026)

Kandidát **v4.51.90 RC**, pokračování stejného vydání a stejného PR #28. **Nesloučeno, nenasazeno.** Produkce zůstává v4.51.89 RC. Reference přibyly jako commity 209af0d a 5c6ce04; bezpečný fast-forward zachoval všechny lokální rozpracované úpravy 3B.

## Reference a provedení

Závazné originály: [A1](design-references/federal-cup/A1_match_report.png), [A2](design-references/federal-cup/A2_national_teams.png), [B](design-references/federal-cup/B_individual_player.png). Originální PNG nejsou upravené a nejsou runtime pozadím s pevnými daty.

| Oblast | Realizace a schválená odchylka |
| --- | --- |
| Pozadí | Modrý stůl, teplé rozostřené světlo, koule 9 vpravo nahoře, tmavé spodní pole. Nový čistý asset podle A1; není původní oddělený fotografický zdroj. |
| Značky | Oficiální projektové logo Poolčítadla vlevo nahoře, původní znak BC Rybárna a podpis vpravo dole. Samostatná alfa varianta loga zachovává původní barevné pixely, s maskou tmavého pozadí podle existujícího SVG postupu; zdrojové logo nedotčené. |
| A1/A2 | Společná kompozice: velký zlatý titulek, barevné jmenné panely a zlaté skóre; hodnoty–grafy–názvy–grafy–hodnoty. SK červeně vlevo, CZ modře vpravo podle explicitního hostitele; originály měly opačné pořadí. |
| B | Individuální titulek a Federal Cup, vlajka/jméno bez slovní reprezentace, vedle čtyři stejně velké karty. Jediný sloupec skupin; název–graf–hodnota. Barva podle reprezentace. |
| Ukazatele | Všech 13 v ROZSTŘEL / ÚTOK / OBRANA / FAULY, včetně Esa i tam, kde je A1/B originál neobsahoval. Bez nového výpočtu metrik. |
| Sloupce | Procenta 0–100, poměry podle n/d, v A absolutní hodnoty proti vyšší úplné hodnotě řádku. V B absolutní počty/průměry pouze číslem, oproti původnímu obrázku bez umělé procentní škály. Delší sloupec faulů není označen jako lepší výkon. |
| Typografie | Česká diakritika, celé procento, průměr jedno desetinné místo s čárkou, poměry s mezerami. Arial jako dostupný lokální font; žádný externí font. Jména a dlouhé hodnoty se přizpůsobí šířce. |
| Úplnost | Část = doložený mezisoučet, bez oficiálního procenta/sloupce; unknown —; úplné 0/0 bez pokusů. Zdrojové vysvětlení i rozdíl výsledků a osobního výkonu zachován. |

Vizuální omezení pro společné posouzení: jde o dynamickou HTML realizaci kompozice, nikoli pixelovou kopii. Rámečky jsou bezpečné zaoblené panely místo přesných lomených polygonů, zlatá typografie používá barvu/stín, nikoli rastrové kovové písmo. Čistý podklad je rekonstrukce z reference. Před vydáním zbývá grafické schválení Dominikem.

## Oddělený podklad

Runtime: `assets/federal-report-billiards.webp` (1920×1080). Vytvořen vestavěným imagegen z A1 jako čistý podklad; pouze fotografie stolu, světel a koule 9. Bez log, vlajek, UI a údajů; všechny údaje a grafy jsou živé HTML. Náhled i export čekají na dekódování obrázků, při chybě odmítnou prázdný export. Loga i podklad ze stejného originu, bez externího CORS.

Přesný prompt je uložen v [federal-report-background-prompt.txt](federal-report-background-prompt.txt). Nevytvořen náhodný nesouvisející obrázek; původní samostatný zdroj neexistoval. Finální vizuální přijetí nového podkladu je součástí revize.

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
- Export browser: skutečná stažení A1/A2/B PNG i PDF, Doubles/Team PNG, fyzické rozměry, 13 údajů, fonty/diakritika, skutečně načtené vlajky/loga/podklad, poměr PDF, mobil DPR3 se shodným PNG jako desktop, částečná evidence, zoom, chybějící knihovna a zrušení rozpracovaného exportu; bez kontaktování Firebase a bez JS chyb.
- PDF: pypdf kontrola jedné stránky 1440×810 pt a bajtově shodných pixelů vloženého obrázku s PNG; Poppler render a vizuální kontrola. HTML náhled a canvas mohou mít drobné rozdíly antialiasingu/stínů; nejde o příslib bitové shody dvou renderovacích enginů.
- Regrese současného indexu: Federal Cup, evidence (mock Auth, reload, full PUT/GET), detailed-counter, Jump/Bank a stream-controls/isolation/lag, release-version. Síť izolována; žádné produkční zápisy.
- Release gate proti čerstvému origin/main f6c3e0f a git diff --check PASS. Všechny uvedené browserové regrese i původní čtyři PDF exporty PASS. GitHub CI se zaznamená po pushi.

Spuštění exportu: `NODE_PATH` směřuje na Playwright runtime, `PDF_LIB_DIR` na místní dvě připnuté JS knihovny; `npm run test:federal-report-exports`. Sandbox zde rušil skutečná stažení; plné stažení ověřováno s povoleným browserem mimo sandbox a kompletně zachycenou sítí.

Neověřeno: fyzické telefony/iOS Safari, reálné Auth/Firebase/Rules a OBS, offline první načtení CDN knihoven, produkční hosting/CORS a zátěž. Grafické přijetí čeká na revizi. Žádný merge/deploy ani změny oprávnění.
