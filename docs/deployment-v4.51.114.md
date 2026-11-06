# Nasazení v4.51.114 RC — etapa 10b0

Dominik schválil vydání 6. 11. 2026. Oprava D4 je nasazená a ověřená ve veřejném anonymním režimu.

- Schválený commit PR #58 je `18b50a7d3f3030a6b8c1dff82c4d601b634e9974`. Základ je `f68098c7212425907e33699b577c530685093b77` (v4.51.113 RC). Merge `56469c56f0a2cdba7f443f4fb61826801e46aaea` má stejný obsah jako testovaný kandidát. [PR #58](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/58)
- Pages sestavení i publikace merge commitu prošly. První kontrola během publikace ještě našla v4.51.113 RC. Konečná kontrola po dokončení našla v4.51.114 RC. [Pages 42263281231](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42263281231)
- PR #55 zůstává otevřený s hlavou `4b50f7cabbfc0c77be2fac35bbde4f4b2c2b8e74`. Jeho cloud-readiness kontrakt stojí mimo toto vydání. [PR #55](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/55)

## Veřejný web

Nové anonymní kontexty Chrome 1440 × 1000 a 390 × 844 zobrazily v4.51.114 RC. Veřejný `index.html` má SHA256 `bc497f78f90d5cc3e0bc1434f6f68d3b1eb33864ae99b54fdacd487958018784`, shodný s Git blobem merge commitu. Shodoval se i `overlay.html` a všech 15 vlastních skriptů načtených stránkou. `PlayersReadRepository` se načetl před `MatchChallenges`.

V režimu POUŽÍT OFFLINE prošly návraty na úvod a přechody do Výsledků, Statistik, Federal Cupu a Livescore. Oba kontexty zaznamenaly nula JavaScriptových výjimek a bootstrap chyb. Síť povolovala pouze GET, HEAD a OPTIONS. Aplikace nevytvořila žádný požadavek na zápis. [Produkční web](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/)

## Izolované kontroly a CI

Před merge prošel release gate proti čerstvému main a kompletní lokální produkční sada 383 PASS, 0 FAIL, 0 SKIP. Produkční kód v testech D4 pokryl A → B → A, opětovné přihlášení stejného UID, logout, opožděnou autorizaci a JSON, historický opravný PUT i odložené potvrzení. Dvacet platných souběžných čtení po obnově tokenu sdílelo jediný GET. Izolovaný desktop a mobil ověřily historii, statistiky, uložení a potvrzení zápasu. Prošly také recovery, turnaje, mobilní v112, výzvy, notifikace a Federal Cup Singles/Doubles/Team včetně skutečně stažených PNG/PDF/XLSX exportů.

Release a produkční CI prošly na PR i po merge. Produkce na GitHubu má 380 PASS, 0 FAIL a 3 SKIP kvůli soukromým fixtures, které prošly lokálně. Mobilní CI na schváleném commitu prošlo. [PR CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42262144618) · [Mobilní CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42262144469) · [Main CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42263281955)

- Experiment má na přesném baseline i kandidátu 28 PASS a 2 FAIL. Při čekání na Auth se neodpojí editovatelný zápas a zbytkové UID je uznáno bez autentizace. Kvůli těmto dvěma známým vadám končí společný regression workflow červeně.
- Historický audit odstraněného žurnálu má samostatně 0 PASS a 2 FAIL.
- Doplňkový Pushout cloud test končí na obou verzích na řádku 87 se stejným `null !== 0` u jmenovatele faulu s neznámým záměrem. Samostatné exporty Pushout XLSX prošly. [Záznam D4](match-read-session-stage-10b0.md)

## Omezení a návrat

Živé Auth a Firebase Rules zůstávají neověřené. Izolované prohlížečové testy používají mocky. Veřejná kontrola proběhla bez účtu, takže nepokrývá soukromé produkční zápasy a reporty. Mobil byl ověřen ve viewportu Chrome. Fyzická zařízení ani skutečné OBS ověřeny nebyly. Produkční data, účty a Rules zůstaly beze změny.

Návrat se provádí reverzí změny kódu D4 v novém vydání podle AGENTS.md. Produkční data se nevracejí. Etapa 10b0 je dokončená. Etapy 10b1 a 10b2 čekají na vlastní zadání.
