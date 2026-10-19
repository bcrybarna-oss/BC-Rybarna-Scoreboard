# Aktuální stav Poolčítadla

Aktualizace: 19. 10. 2026. Zadavatel aktuální revize: **Dominik**.

## Verze a nasazení

- Připravovaná verze: **v4.51.81 RC**, přímo na větvi `main` podle zadání Dominika. Stav: **otestováno, připraveno k pushi; dosud nenasazeno**.
- Poslední ověřený produkční kód: commit **`8cf279e306ecfd794791dc9da39127a62a0ebbbf`**, v4.51.80 RC. GitHub Pages [nasazení](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39315482694) úspěšně dokončeno. Dne 19. 10. 2026 ve 20:00 UTC ověřeno HTTP 200, bajtová shoda celého HTML, hlavička v4.51.80 RC a čistý desktop Chrome bez JavaScriptových chyb, bez přístupu k Firebase a bez vzdálených zápisů. SHA256 HTML: `bbfa07461c21a060eb23e3a9c42c131f18ff3f9f1e4f1687c3844661c4535463`.
- Stav předchozí v4.51.79 RC: **nasazeno a ověřeno** dne 19. 10. 2026 v 19:45 UTC. HTTP 200, v čistém desktop Chrome správná hlavička v4.51.79 RC, 0 chyb JavaScriptu a 0 vzdálených zápisů; Firebase bylo zablokované. SHA256 HTML: `df5eb09c2c00c4955aa225f8458a35ea9e48d393a8cfe3e7c61bf5812e7611ac`.
- Následný dokumentační záznam tohoto ověření nemění produkční HTML ani verzi. Pro případné novější commity vždy zkontrolovat skutečný běh Pages na GitHubu; nepovažovat starší ověření za důkaz novějšího kódu.
- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- Nasazení probíhá automaticky GitHub Pages po pushi do main; vždy ověřit konkrétní workflow a veřejné HTML.

## Dokončené a rozpracované úpravy

- Připravené a otestované pro v4.51.81 RC: historické turnaje do sérií se strukturou, ručním nasazením a zadáním skóre, automatickým postupem/dokončením, auditem a potvrzením dopadu zpětných oprav, obnovou po reloadu, bez duplicitních bodů a bez smyšlených statistik. Původní historické zadávání a pravidla Lounské série zůstávají. Více čistých skupin vyžaduje ruční konečné pořadí podle výslovného potvrzení Dominika. Podrobně docs/historical-structured-entry.md.

- Dokončené a nasazené ve v4.51.80 RC: EXPORT PDF otevírá společný dialog se jménem souboru, samostatným sdílením souboru, uložením a zavřením. Dialog drží jedno PDF pro obě i opakované akce a zůstává otevřený po jejich dokončení/zrušení/chybě. Nepodporované sdílení je vysvětlené a neblokuje stažení. Pravidla spolupráce zůstávají závazná.

- Nasazené ve v4.51.78 RC: Federal Cup Singles/Doubles/Team přes detailní počítadlo, výběr Team hráčů před rackem, pevná pravidla a tempo před startem, Soft break rozhodnutí, oprava přiřazení breaků a B&R conversion, konkrétní koule při úniku z jistoty. Podrobně REVIZE.md a docs/federal-cup-review.md.
- Dokončené a nasazené ve v4.51.79 RC: jednotné ULOŽIT PDF v historii, detailu zápasu, Statistikách a Moje statistiky; stahování místo automatického sdílení, zachované generátory obsahu a názvy souborů.
- Dokončené ve v4.51.79 RC: pravidla spolupráce Dominika a Jaroslava v AGENTS.md, aktuální stav v tomto souboru, návaznost v PROJECT_CONTEXT.md a úplný záznam pod Dominikem v REVIZE.md.
- Jiné rozpracované úpravy v tomto checkoutu před zahájením nebyly. PR #6 je oddělená rozpracovaná modularizace; není součástí produkční revize.

## Ověření

- V4.51.81 RC: `npm run test:historical` (Chrome/Playwright, veškerá síť zachycena, RTDB včetně ETag a serializace mockovaná) prošel: skutečné formuláře a ruční nasazení, všechny nové formáty, stejné i změněné vítěze, navazující výsledky/odmítnutí potvrzení, dokončení a zpětná neúplnost, reload přípravy i uložených výsledků, ruční postupující/penalty/konečné pořadí, shoda původního umístění a bodů Lounské série, oprávnění, 403/412/stará data, opakování tvorby po ztraceném potvrzení a hosté/profil. Žádné fake matches/statistiky/LIVE ani změny starých/nesouvisejících turnajů; 0 page errors. Federal Cup browser prošel včetně B&R a ostatních startů režimů. Smoke 12/12, celá Node sada 68/70 (dvě původní chyby preview). Ověření se týká aktuálního index.html, nikoli /test/ snapshotu. Nasazení zatím neověřeno.

- V4.51.80 RC: smoke 12/12 a PDF jednotkové testy 8/8 prošly. Celá Node sada 68/70 lokálně i v GitHub CI, pouze dvě známé chyby preview. Izolovaný Chrome se skutečnými PDF knihovnami prošel pro všechna 4 exportní místa: skutečné downloady, simulované sdílení úspěch/zrušení/chyba, shoda bajtů sdíleného souboru a downloadu i původního názvu, přímá aktivace sdílení kliknutím, opakované použití, nepodporované sdílení a zavření/Escape. Řízeně zrušený browser download nechal export otevřený; opakování stáhlo totožná data. Browser 0 page errors a veškerá síť zachycena. Generátory obsahu beze změny. Nasazení ověřeno výše uvedeným read-only postupem; skutečné nativní sdílení zůstává neověřené.

- V4.51.78 RC: smoke 12/12, izolovaný Federal Cup browser test prošel, produkce HTTP 200 a shoda celého HTML, bez chyb JavaScriptu a bez přístupu k Firebase při kontrole.
- Předchozí ověření v4.51.79 RC: smoke 12/12 a 4 tehdejší jednotkové testy ukládání prošly. Tehdejší celá Node sada 64/66; selhávaly pouze dvě níže popsané dřívější chyby preview.
- Předchozí v4.51.79 RC, izolovaný desktop Chrome s reálnými knihovnami html2canvas 1.4.1 a jsPDF 2.5.2: skutečně stažena 4 PDF (historie, detail zápasu, Statistiky, Moje statistiky). Ověřeny původní názvy, PDF hlavička a stránky, přesná shoda stažených bajtů s vytvořeným blobem, 0 volání sdílení i při dostupném share API a 0 JavaScriptových chyb. Veškerá síť zachycena; knihovny dodány z místní cache, Firebase a ostatní síť blokované.
- Oba generátory obsahu PDF byly porovnány s předchozím main a zůstaly beze změny. `git diff --check` prošel. Jednotkové testy pokrývají i cleanup URL, chybu stahování/generování, obnovení tlačítka a kontrolu oprávnění osobního exportu.
- Opakování: `npm test`; `npm run test:pdf` vyžaduje `PDF_LIB_DIR` s přesnými soubory html2canvas.min.js 1.4.1 a jspdf.umd.min.js 2.5.2 z CDN používané v index.html a instalovaný Chrome/Playwright. `PDF_OUTPUT_DIR` volitelně uloží výstupy testu. Pokud izolované prostředí ruší OS download, ověřit test v prostředí povolujícím stažení souboru; nerušit zachytávání sítě.
- Testy a kontroly nesmějí vytvářet data nebo účty v produkční Firebase. Ručně uložené případy izolovaného náhledu se nesmějí mazat.

## Známé chyby a omezení

- Nové historické turnaje: skutečné produkční Rules/Auth, fyzické mobily/nativní aplikace, zátěž velkých startovních polí a reálný souběh zařízení nebyly ověřeny. Zápisy používají fail-closed ETag a kontrolu oprávnění. Stávající generátory nepokrývají libovolný cizí historický pavouk; alternativou zůstávají jednotlivé ruční zápasy/pořadí. U více samostatných skupin bez pavouka není nově odhadované společné pořadí – zadává se ručně.
- Původní textový/řádkový `historicalAutoPlacements` obsahuje některá pomocná kritéria navíc oproti hlavnímu Lounskému `seriesTournamentPlacementRecords`. Obě starší cesty zůstaly beze změny; nový editor používá hlavní turnajový/sériový výpočet. Parita byla ověřena na odpovídajícím SKO se shodnými semifinalisty a vůči původnímu ručnímu konečnému pořadí; univerzální shoda starých různých algoritmů není tvrzena. Jejich sjednocení je samostatná změna.

- Dva dřívější testy `preview-match-reload-recovery.test.cjs` selhávají již na původním main: odpojení při nedostupné identitě a očekávané volání obnovy po přihlášení. Ve v4.51.79 RC 64/66 a v4.51.80 RC 68/70 lokálně i v GitHub CI. Nejde o nové selhání PDF opravy.
- Souběžná editace celé konfigurace Federal Cupu z více zařízení může přepsat jinou změnu. Lokální ochrana duplicit není distribuovaný zámek; jeden fixture obsluhovat na jednom zařízení.
- Skutečné Firebase Auth/Rules, cloudový výpadek, mobilní iOS/Android buildy a skutečné mobilní ukládání PDF nebyly ověřeny. Desktopový download ani emulovaný mobilní viewport nedokazují uložení na fyzickém telefonu.
- Ve v4.51.80 RC je výsledek systémového sdílení modelovaný mockem Web Share API; skutečné cílové aplikace Windows/Android/iOS, mobilní Safari/Chrome a nativní Capacitor aplikace nejsou ověřené. Zrušení downloadu je řízené Chrome CDP; ruční nativní ukládací dialog vyžaduje samostatné ověření na zařízení.
- PDF knihovny se načítají z CDN, jejich dostupnost vyžaduje připojení. Chování a cílovou složku stažení určuje prohlížeč a jeho nastavení. Nativní Capacitor WebView musí být samostatně ověřen.

## Povinné podklady pro další práci

Číst AGENTS.md, REVIZE.md, tento soubor a PROJECT_CONTEXT.md; ověřit větev, lokální změny a nové commity na GitHubu. Nové zadání při nejasném autorství přiřadit Dominikovi/Jaroslavovi až po upřesnění. Při dokončení aktualizovat historii i tento stav.
