# Nasazení v4.51.115 RC — zakládání a rozlosování běžných turnajů

Dominik schválil vydání 8. 11. 2026. Základ vydání byl `49deb97589316c09695669250fd6927776d4a907` (v4.51.114 RC). Schválená hlava byla `effb73e5e98acb15bd9da956a74a3c14764d7465`. Merge `9ca4f05d4ecac1b8aaf02a0bf54e4d80c3869863` má stejný strom jako otestovaná hlava PR. Na main na něj navazuje samostatný dokumentační commit s tímto záznamem. [PR #59](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/59)

GitHub Pages dokončil sestavení a publikaci merge commitu. PR #55 zůstává otevřený s hlavou `4b50f7cabbfc0c77be2fac35bbde4f4b2c2b8e74`. [GitHub Pages 42474797271](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42474797271) · [PR #55](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/55)

## Veřejný web

Nové anonymní kontexty Chrome v rozměrech 1440 × 1000 a 390 × 844 zobrazily v4.51.115 RC. Veřejný `index.html` měl SHA-256 `c8e0e1a44890b3218adbde722fc9ae19651879dfee6eb4d906007b5fc4d34969` a `overlay.html` měl SHA-256 `54ad8de46f5b1051bb601b4f2340ce5bec71f5d8f03860c7b1e2d2977eadd73d`. Oba soubory a všech 15 vlastních načtených skriptů se shodovaly s odpovídajícími soubory merge commitu. Devět skriptů s aktualizovaným cache parametrem se načetlo s `?v=4.51.115`. [Produkční web](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/)

V anonymním režimu po volbě POUŽÍT OFFLINE prošly přechody mezi úvodem, Výsledky, Statistikami, Hráči, Soutěžemi, Federal Cupem a Livescore. Na obou viewportech bylo v DOM ovládání OPUSTIT MÍSTNÍ POKUS mimo uzamykatelná pole. Bez rozpracovaného pokusu je tlačítko skryté. Kliknutí na rozlosování prázdného formuláře zobrazilo samostatnou validaci pod tlačítkem. Nebyly zaznamenány JavaScriptové výjimky, bootstrap chyby ani pokusy o zápis. Prohlížeč povoloval pouze GET, HEAD a OPTIONS.

## Izolované kontroly a CI

| Kontrola | Výsledek |
| --- | --- |
| Release gate proti čerstvému main | PASS |
| Lokální produkční Node s dostupnými soukromými podklady | 383 PASS, 0 FAIL, 0 SKIP |
| Produkční Node na PR a po merge | 380 PASS, 0 FAIL, 3 SKIP. Tři testy se soukromými podklady prošly lokálně. |
| Mobilní GitHub CI na schválené hlavě | PASS |
| Experimentální sada na PR a po merge | 28 PASS, 2 FAIL. Společný regression workflow končí neúspěchem. |
| Historický audit odstraněného žurnálu | Samostatně 0 PASS, 2 FAIL. Audit testuje dříve odstraněnou implementaci. |

Experimentální kód a kontrakty se proti výchozímu main nezměnily. Při reloadu bez dostupné identity se editovatelný stav zápasu neodpojí. Druhá vada dovoluje, aby samotné zbytkové UID autorizovalo vlastníka bez autentizace. [PR CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42473958043) · [Mobilní CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42473958054) · [Main CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42474797599)

Turnajový browserový test pokryl SKO, DKO, skupiny, obě varianty skupin s play-off a Swiss, včetně náhodného, ručního, ELO a elektronického losování. Na 320, 390 a 1440 px prošly plné i zakázané úložiště, reload, A → B → A, odvolání i potvrzení opuštění a ochrana nového pokusu před pozdní odpovědí. Po neověřeném uložení zůstalo při běžném opakování stejné ID. Shodný cloudový záznam se potvrdil bez druhého PUT a neshodný se nepřepsal. Prošly regrese v101, D4, recovery, mobilního ovládání a Federal Cupu včetně Doubles #9 a skutečných PNG/PDF a Pushout XLSX exportů. [Podrobnosti k turnajové opravě](ordinary-tournament-draw-v4.51.115.md)

## Omezení a návrat

Přihlášené scénáře a cloudové zápisy proběhly pouze izolovaně s mockovanou sítí. Živé Auth, Firebase Rules a fyzická zařízení zůstávají neověřené. Produkční data, účty a Rules nebyly testováním měněny.

Při selhání místního zápisu je nová příprava dostupná jen v otevřené stránce. Po reloadu se může vrátit dříve uložený pokus. Výslovné opuštění pokusu umožní nové rozlosování, ale před dalším založením je potřeba v cloudu zkontrolovat název a ID původního pokusu. Dříve odeslaný PUT mohl uspět.

Případný návrat se provede reverzí aplikační změny PR #59 v novém vydání podle AGENTS.md, bez obnovy nebo mazání dat. Etapy 10b1 a 10b2 jsou nezahájené.
