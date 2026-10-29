# Nasazení v4.51.104 RC

Zadavatel: Dominik. Datum: **29. 10. 2026**. Stav: **nasazeno a v uvedeném rozsahu ověřeno**. Žádné produkční zápisy, migrace ani další etapa.

## Vydání

- [Produkční aplikace](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/), skutečně publikovaná v4.51.104 RC.
- [PR43](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/43), schválená hlava d2bf107d71fc6768fa97cab1f4c43928d7aa617d.
- Výchozí main899ee10000efaa3235021b90212283e3d280fa28 po čerstvém fetchi beze změny. Pracovní soubory ostatních zachovány.
- Merge se zachováním historie: **87f898375970cfa3c1a243af5edaf4463c94c36e**. Bez force push nebo přepisování historie.
- [Pages40913700775](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40913700775) úspěšně build/deploy/report; automatický běh po merge, bez ručního opakování.
- [PR CI40764794586](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40764794586) a [main CI40913702234](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40913702234): release PASS, Node **272 PASS /2 známé FAIL /3 soukromé SKIP z277**. Před sloučením38/38cílených testů PASS. CI jako celek není zelené.
- Známá selhání jednotlivě shodná s výchozím main/CI40759980782 (264/2/3z269): preview-match-reload-recovery:50 je nesoulad odpojení pointeru uloženého zápasu při chybějící identitě v experimentálním core; :106 regex očekává samostatné volání obnovy místo přiřazení výsledku pro tournament fallback. Jejich test a experimentální core zůstaly beze změny. Nová regrese nezjištěna.

## Veřejná produkce – anonymní relace

Dvacet veřejných souborů (index, overlay a18assetů) HTTP200 a přesná SHA256 shoda s merge. HTML/overlay a všech5modulů také přes unikátní URL bez cache. Viditelná verze104, všechny5moduly včetně AdminReports načtené právě jednou; žádný fallback nebo JavaScriptová chyba.

Desktop1440×1000 a mobilní viewport390×844: dostupná navigace home/results/support/reports/turnajový formulář/FederalCup, zachované phase formuláře, lokální validace resetu hesla bez e-mailu, FC21položek a A2dialog PASS. Pět vstupů/odchodů zFC na viewport: interval/listener1/1 během a0/0po odchodu. Pageerrors0, consoleerrors0. Povolené jen čtecí veřejné soubory/knihovny; Firebase/Auth a všechny zápisy blokované, skutečné blokované pokusy0.

Administrátorská obrazovka není v anonymní relaci dostupná a nebyla na produkci násilně odemykaná. Toto není ověření živé přihlášené administrace ani živých soukromých hlášení.

## Izolovaně na publikovaném kódu

Použité skutečně stažené HTML a všech5modulů, SHA256 před testem, read-only přesměrování souborů pouze v testovacím procesu. Testy aplikaci nemění. Všechna Auth/Firebase komunikace zachycená mockem; syntetická hlášení, soukromý archiv jen vRAM a nezměněn. Nejde o živou přihlášenou relaci.

- **Administrátorský seznam:** řazení new/in_progress/resolved a datum zachované,3souběžné obnovy→1GET.20vstupů/odchodů, logout aA→B, neadmin0kolekčníchGET, výpadek/ručníretry. Opožděná odpověď po odchodu ani staréhoA po novémB neovlivní seznam.3listenery během,0po odchodu/logoutu; rows0 po stop, žádné nové časovače a žádný růstDOM.
- **Zápisové akce pouze v mocku:** status a odpověď mají každý jeden hlavní PUT a odpovídající mirror, smazání jedenDELETE a mirrorDELETE. Test po20cyklech vylučuje duplikaci handlerů. Druhá samostatná poznámka zůstala přesně zachovaná při zadrženém GET→odchodu a úkliduDOM→PUT; seznam se po odchodu neotevřel. Backendový postup a oprávnění se nemění. Již zahájené mutace zůstávají původní aplikační transakce, jejich kompletní audit není součástí této etapy.
- **Předchozí moduly:** FederalViewer20cyklů/cleanup/odchod/změnaúčtu/pozdníodpovědi/sdílenéčtení, OwnReports20cyklů/legacy mirror/identity/retry a CloudRefresh session/revision/single-flight/reconnect PASS.
- **Turnaje101:** běžný i historický, desktop/mobil, skutečná plná kvóta a varování, ruční nasazení a zachovaná příprava, reload/cloudmock, vytvořené zápasy skupiny8-ball3 a play-off10-ball7, nezměněnýFC PASS.
- **Reporty a exporty:** A1/A2/B, skutečné PNG1920×1080, desktop/mobil/zoom, kontrolní Singles3SK93%14/CZ95%38 PASS. Skutečná2listováXLSX Singles/Doubles/Team stažení desktop/mobil PASS. Původní PDF regrese také prošla; PDF UI/knihovny se nemění.

[Strojová evidence bez soukromých herních dat](deployment-v4.51.104-verification.json). Pracovní artefakty jsou lokálně voutput/deployment104 a nejsou v repozitáři.

## Omezení a návrat

Živá produkčníAuth/Firebase, existující soukromá/adminhlášení, fyzický iPhone/Safari, reálnéOBS a doručení resetu hesla neověřeny. Uživatel dříve potvrdil pouze přihlášené otevření prázdných Mýchhlášení, nikoli práci s existujícími daty. Původní uživatel101 stále nepotvrdil na svém zařízení. Limity blokováníB a kapacity celé archivnícache trvají.

Nová blokující chyba nezjištěna, návrat nebyl potřeba. Případný rollback reverzí celého merge87f898375970cfa3c1a243af5edaf4463c94c36e podle release pravidel s novou verzí, bez vracení/migrace dat. Dokumentační pokračování nemění verzi ani bytes aplikace; případné automatické Pages po něm publikují stejnou aplikaci.
