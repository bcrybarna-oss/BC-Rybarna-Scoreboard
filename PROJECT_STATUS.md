# Aktuální stav Poolčítadla

Aktualizace: 19. 10. 2026. Zadavatel aktuální revize: **Dominik**.

## Verze a nasazení

- Připravovaná verze: **v4.51.80 RC**, přímo na větvi `main` podle zadání Dominika. Stav: **otestováno, připraveno k pushi; dosud nenasazeno**.
- Poslední ověřený produkční kód: commit **`413781e753a61876a07602b0a6b96df44220ab00`**, v4.51.79 RC. GitHub Pages [nasazení](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39313555651) dokončil úspěšně; veřejné HTML se bajtově shoduje s commitem.
- Stav předchozí v4.51.79 RC: **nasazeno a ověřeno** dne 19. 10. 2026 v 19:45 UTC. HTTP 200, v čistém desktop Chrome správná hlavička v4.51.79 RC, 0 chyb JavaScriptu a 0 vzdálených zápisů; Firebase bylo zablokované. SHA256 HTML: `df5eb09c2c00c4955aa225f8458a35ea9e48d393a8cfe3e7c61bf5812e7611ac`.
- Následný dokumentační záznam tohoto ověření nemění produkční HTML ani verzi. Pro případné novější commity vždy zkontrolovat skutečný běh Pages na GitHubu; nepovažovat starší ověření za důkaz novějšího kódu.
- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- Nasazení probíhá automaticky GitHub Pages po pushi do main; vždy ověřit konkrétní workflow a veřejné HTML.

## Dokončené a rozpracované úpravy

- Připravené pro v4.51.80 RC: EXPORT PDF otevírá společný dialog se jménem souboru, samostatným sdílením souboru, uložením a zavřením. Dialog drží jedno PDF pro obě i opakované akce a zůstává otevřený po jejich dokončení/zrušení/chybě. Nepodporované sdílení je vysvětlené a neblokuje stažení. Pravidla spolupráce zůstávají závazná.

- Nasazené ve v4.51.78 RC: Federal Cup Singles/Doubles/Team přes detailní počítadlo, výběr Team hráčů před rackem, pevná pravidla a tempo před startem, Soft break rozhodnutí, oprava přiřazení breaků a B&R conversion, konkrétní koule při úniku z jistoty. Podrobně REVIZE.md a docs/federal-cup-review.md.
- Dokončené a nasazené ve v4.51.79 RC: jednotné ULOŽIT PDF v historii, detailu zápasu, Statistikách a Moje statistiky; stahování místo automatického sdílení, zachované generátory obsahu a názvy souborů.
- Dokončené ve v4.51.79 RC: pravidla spolupráce Dominika a Jaroslava v AGENTS.md, aktuální stav v tomto souboru, návaznost v PROJECT_CONTEXT.md a úplný záznam pod Dominikem v REVIZE.md.
- Jiné rozpracované úpravy v tomto checkoutu před zahájením nebyly. PR #6 je oddělená rozpracovaná modularizace; není součástí produkční revize.

## Ověření

- V4.51.80 RC: smoke 12/12 a PDF jednotkové testy 8/8 prošly. Celá Node sada 68/70, pouze dvě známé chyby preview. Izolovaný Chrome se skutečnými PDF knihovnami prošel pro všechna 4 exportní místa: skutečné downloady, simulované sdílení úspěch/zrušení/chyba, shoda bajtů sdíleného souboru a downloadu i původního názvu, přímá aktivace sdílení kliknutím, opakované použití, nepodporované sdílení a zavření/Escape. Řízeně zrušený browser download nechal export otevřený; opakování stáhlo totožná data. Browser 0 page errors a veškerá síť zachycena. Generátory obsahu beze změny. Zatím není vydáváno za ověřené nasazení.

- V4.51.78 RC: smoke 12/12, izolovaný Federal Cup browser test prošel, produkce HTTP 200 a shoda celého HTML, bez chyb JavaScriptu a bez přístupu k Firebase při kontrole.
- Předchozí ověření v4.51.79 RC: smoke 12/12 a 4 tehdejší jednotkové testy ukládání prošly. Tehdejší celá Node sada 64/66; selhávaly pouze dvě níže popsané dřívější chyby preview.
- Izolovaný desktop Chrome s reálnými knihovnami html2canvas 1.4.1 a jsPDF 2.5.2: skutečně stažena 4 PDF (historie, detail zápasu, Statistiky, Moje statistiky). Ověřeny původní názvy, PDF hlavička a stránky, přesná shoda stažených bajtů s vytvořeným blobem, 0 volání sdílení i při dostupném share API a 0 JavaScriptových chyb. Veškerá síť zachycena; knihovny dodány z místní cache, Firebase a ostatní síť blokované.
- Oba generátory obsahu PDF byly porovnány s předchozím main a zůstaly beze změny. `git diff --check` prošel. Jednotkové testy pokrývají i cleanup URL, chybu stahování/generování, obnovení tlačítka a kontrolu oprávnění osobního exportu.
- Opakování: `npm test`; `npm run test:pdf` vyžaduje `PDF_LIB_DIR` s přesnými soubory html2canvas.min.js 1.4.1 a jspdf.umd.min.js 2.5.2 z CDN používané v index.html a instalovaný Chrome/Playwright. `PDF_OUTPUT_DIR` volitelně uloží výstupy testu. Pokud izolované prostředí ruší OS download, ověřit test v prostředí povolujícím stažení souboru; nerušit zachytávání sítě.
- Testy a kontroly nesmějí vytvářet data nebo účty v produkční Firebase. Ručně uložené případy izolovaného náhledu se nesmějí mazat.

## Známé chyby a omezení

- Dva dřívější testy `preview-match-reload-recovery.test.cjs` selhávají již na původním main: odpojení při nedostupné identitě a očekávané volání obnovy po přihlášení. Ve v4.51.79 RC 64/66 lokálně i v GitHub CI, v4.51.80 RC lokálně 68/70. Nejde o nové selhání PDF opravy.
- Souběžná editace celé konfigurace Federal Cupu z více zařízení může přepsat jinou změnu. Lokální ochrana duplicit není distribuovaný zámek; jeden fixture obsluhovat na jednom zařízení.
- Skutečné Firebase Auth/Rules, cloudový výpadek, mobilní iOS/Android buildy a skutečné mobilní ukládání PDF nebyly ověřeny. Desktopový download ani emulovaný mobilní viewport nedokazují uložení na fyzickém telefonu.
- Ve v4.51.80 RC je výsledek systémového sdílení modelovaný mockem Web Share API; skutečné cílové aplikace Windows/Android/iOS, mobilní Safari/Chrome a nativní Capacitor aplikace nejsou ověřené. Zrušení downloadu je řízené Chrome CDP; ruční nativní ukládací dialog vyžaduje samostatné ověření na zařízení.
- PDF knihovny se načítají z CDN, jejich dostupnost vyžaduje připojení. Chování a cílovou složku stažení určuje prohlížeč a jeho nastavení. Nativní Capacitor WebView musí být samostatně ověřen.

## Povinné podklady pro další práci

Číst AGENTS.md, REVIZE.md, tento soubor a PROJECT_CONTEXT.md; ověřit větev, lokální změny a nové commity na GitHubu. Nové zadání při nejasném autorství přiřadit Dominikovi/Jaroslavovi až po upřesnění. Při dokončení aktualizovat historii i tento stav.
