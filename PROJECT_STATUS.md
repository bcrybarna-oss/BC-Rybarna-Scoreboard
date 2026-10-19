# Aktuální stav Poolčítadla

Aktualizace: 19. 10. 2026. Zadavatel aktuální revize: **Dominik**.

## Verze a nasazení

- Aktuální připravená verze: **v4.51.79 RC**, přímo na větvi `main` podle zadání Dominika.
- Poslední ověřená produkce: **v4.51.78 RC**, commit `6d50db0655f193fa672ebd6277896336ee4d3fc8`; GitHub Pages dokončil nasazení a veřejné HTML odpovídalo commitu.
- Stav v4.51.79 RC: **otestováno, připraveno k pushi; dosud nenasazeno**. Tento stav je nutné po skutečném nasazení aktualizovat.
- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- Nasazení probíhá automaticky GitHub Pages po pushi do main; vždy ověřit konkrétní workflow a veřejné HTML.

## Dokončené a rozpracované úpravy

- Nasazené ve v4.51.78 RC: Federal Cup Singles/Doubles/Team přes detailní počítadlo, výběr Team hráčů před rackem, pevná pravidla a tempo před startem, Soft break rozhodnutí, oprava přiřazení breaků a B&R conversion, konkrétní koule při úniku z jistoty. Podrobně REVIZE.md a docs/federal-cup-review.md.
- Připravené pro v4.51.79 RC: jednotné ULOŽIT PDF v historii, detailu zápasu, Statistikách a Moje statistiky; stahování místo automatického sdílení, zachované generátory obsahu a názvy souborů.
- Připravené pro v4.51.79 RC: pravidla spolupráce Dominika a Jaroslava v AGENTS.md, aktuální stav v tomto souboru, návaznost v PROJECT_CONTEXT.md a úplný záznam pod Dominikem v REVIZE.md.
- Jiné rozpracované úpravy v tomto checkoutu před zahájením nebyly. PR #6 je oddělená rozpracovaná modularizace; není součástí produkční revize.

## Ověření

- V4.51.78 RC: smoke 12/12, izolovaný Federal Cup browser test prošel, produkce HTTP 200 a shoda celého HTML, bez chyb JavaScriptu a bez přístupu k Firebase při kontrole.
- Ověření v4.51.79 RC: smoke 12/12 a 4 nové jednotkové testy ukládání prošly. Aktuální celá Node sada 64/66; selhávají pouze dvě níže popsané dřívější chyby preview.
- Izolovaný desktop Chrome s reálnými knihovnami html2canvas 1.4.1 a jsPDF 2.5.2: skutečně stažena 4 PDF (historie, detail zápasu, Statistiky, Moje statistiky). Ověřeny původní názvy, PDF hlavička a stránky, přesná shoda stažených bajtů s vytvořeným blobem, 0 volání sdílení i při dostupném share API a 0 JavaScriptových chyb. Veškerá síť zachycena; knihovny dodány z místní cache, Firebase a ostatní síť blokované.
- Oba generátory obsahu PDF byly porovnány s předchozím main a zůstaly beze změny. `git diff --check` prošel. Jednotkové testy pokrývají i cleanup URL, chybu stahování/generování, obnovení tlačítka a kontrolu oprávnění osobního exportu.
- Opakování: `npm test`; `npm run test:pdf` vyžaduje `PDF_LIB_DIR` s přesnými soubory html2canvas.min.js 1.4.1 a jspdf.umd.min.js 2.5.2 z CDN používané v index.html a instalovaný Chrome/Playwright. `PDF_OUTPUT_DIR` volitelně uloží výstupy testu. Pokud izolované prostředí ruší OS download, ověřit test v prostředí povolujícím stažení souboru; nerušit zachytávání sítě.
- Testy a kontroly nesmějí vytvářet data nebo účty v produkční Firebase. Ručně uložené případy izolovaného náhledu se nesmějí mazat.

## Známé chyby a omezení

- Dva dřívější testy `preview-match-reload-recovery.test.cjs` selhávají již na původním main: odpojení při nedostupné identitě a očekávané volání obnovy po přihlášení. Dosavadní celá Node sada: 60/62. Nejde o nové selhání PDF opravy.
- Souběžná editace celé konfigurace Federal Cupu z více zařízení může přepsat jinou změnu. Lokální ochrana duplicit není distribuovaný zámek; jeden fixture obsluhovat na jednom zařízení.
- Skutečné Firebase Auth/Rules, cloudový výpadek, mobilní iOS/Android buildy a skutečné mobilní ukládání PDF nebyly ověřeny. Desktopový download ani emulovaný mobilní viewport nedokazují uložení na fyzickém telefonu.
- PDF knihovny se načítají z CDN, jejich dostupnost vyžaduje připojení. Chování a cílovou složku stažení určuje prohlížeč a jeho nastavení. Nativní Capacitor WebView musí být samostatně ověřen.

## Povinné podklady pro další práci

Číst AGENTS.md, REVIZE.md, tento soubor a PROJECT_CONTEXT.md; ověřit větev, lokální změny a nové commity na GitHubu. Nové zadání při nejasném autorství přiřadit Dominikovi/Jaroslavovi až po upřesnění. Při dokončení aktualizovat historii i tento stav.
