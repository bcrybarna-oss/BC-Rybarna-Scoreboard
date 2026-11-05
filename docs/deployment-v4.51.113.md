# Nasazení v4.51.113 RC — PlayersReadRepository (10a)

Zadavatel: **Dominik**. Datum: **5. 11. 2026**. **Nasazeno a ověřeno v níže uvedeném rozsahu.** Žádná etapa10b.

## Commity a schválený rozsah

- Výchozí main112 `22a5bcc00126fd998809ea935d298e7b986524b2`; Jaroslavovy mobilní úpravy a14.1/UNDO zachovány.
- Dokumentační [PR56](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/56) sloučen metodou merge jako `0933e64164e8f82705c63c299b55320c94bfa8f6`. Pouze plán, dokumentace a izolovaný audit, žádné zvýšení verze ani aplikační změna.
- Schválený PR57 head `dc5499125f7dd720bbf5922ade159e44b79fb7a1`, po standardním merge aktuálního main finálně testován `ee38fd6ff52fa6fcd9f431f5187b55936f1d2c4a`. Aplikační soubory přesně shodné; tracked strom čistý. [PR57](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/57) sloučen jako **`86bf7afc9b7ac250ec2a4706fd7948e5514bcbae`**.
- Jediná produkční PlayersReadRepository, odstraněné původní tělo/export; jediná app-owned securePlayersReader. Zachovány identity, single-flight, epoch/revision,9b2 bariéra a lifecycle, app-owned publikace/render. Žádné nové RTDB mutace/polling/cache/retry či obecná zápisová změna. Žádná změna sportovních výsledků ani datových formátů.
- [PR55](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/55) zůstává otevřený, head `4b50f7cabbfc0c77be2fac35bbde4f4b2c2b8e74`. Nebyl sloučen, upravován ani přibírán. Cloud-readiness není součástí tohoto main; jeho budoucí vydání musí respektovat již nasazenou113 a zachovat svůj kontrakt/testy.

## Nasazení a skutečný veřejný web

[GitHub Pages42089799710](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42089799710): build i deploy **SUCCESS** pro merge86bf7af. Automatické standardní nasazení, žádný ruční opakovaný trigger.

[Produkční aplikace](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/) skutečně zobrazuje **v4.51.113 RC**. Po úspěšném deploymentu nové Chrome kontexty, zablokované service workers, cache-busting query/no-cache: veřejné index.html, overlay.html, players-read-repository.js a match-challenges.js HTTP200 a SHA256 přesně shodné s Git blobs merge86bf7af. Tím ověřen publikovaný kód, nikoli pouze stav Actions. Před dokončením Pages byl při první kontrole ještě správně rozpoznán starý112; jako úspěšné ověření se nezapočítává.

Desktop1440×1000 a mobil390×844: načtení skutečného webu, login dialog bez přihlášení, podporované POUŽÍT OFFLINE, úvod→Výsledky→Federal Cup→Livescore s návraty. Nový modul načten HTTP200 před MatchChallenges, factory dostupná a starý export undefined. Žádná chybějící module script, bootstrap chyba ani JS výjimka. Ovládání obnovy hesla a mobilní112 zdroje zachovány; žádný reset hesla odeslán. Anonymní čerstvá relace nemá soukromý archiv, reportové spouštěče0; živá data a exporty soukromých reportů se tímto neověřují. Síť povoluje pouze GET/HEAD/OPTIONS; žádný zápis nebyl ani požadován.

[Desktop screenshot](screenshots/players-10a-production-desktop.png), [mobil screenshot](screenshots/players-10a-production-mobile.png). [Strojový důkaz s SHA256, úplností dat a oddělenými výsledky](deployment-v4.51.113-verification.json).

## Izolované a CI kontroly

Finální kód před sloučením: release gate proti čerstvému main0933e64 PASS; celá produkční Node **371 PASS /0 FAIL /0 SKIP** se skutečnými soukromými fixtures.32 nových kontraktů skutečného modulu i nezávislá očekávání.26 profilů ze skutečného exportu27.10.,20 souběžných readů→1GET; input/output hash všech dat shodný,0 repository mutací a nezměněný soubor exportu. Baseline/kandidát desktop/mobil: autorizace/single-flight, logout/A→B→A/role/profil/ověření, opožděný JSON/ignorovaný abort/starý finalizer, nested bariéry a release, full/denied storage, navigace a pagehide/persisted/reload PASS. Repository nepřidává žádné časovače/listenery. Persisted event je simulace kontraktu, nikoli průkaz skutečného rozhodnutí prohlížeče vložit stránku do BFCache.

Výzvy9b1/9b2, notifikace9a, skutečná app Auth/recovery cesta s mock endpointy desktop/mobil, bootstrap, všechny mobilní112 kontroly, turnaje při plné kvótě/oddělené fáze/draft/reload/FC izolace, stream/OBS a skutečně stažené A1/A2/B PNG/PDF i Pushout XLSX desktop/mobil **PASS**. Ostatní očekávané Auth refresh POST i zápisové akce aplikace běží jen proti mockům a jsou od read-only repository oddělené. Žádná produkční data ani účty použité k testovacím zápisům.

[Finální PR CI42089360332](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42089360332) a [main CI42089800720](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42089800720): release **PASS**, produkce **368 PASS /0 FAIL /3 SKIP**. SKIP jsou soukromé relink/undo datové fixtures nedostupné na GitHubu; lokálně všechny3 prošly. [Mobilní CI42089360662](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42089360662) SUCCESS.

Experiment **28 PASS /2 FAIL /0 SKIP** na baseline i kandidátu, zdroje shodné: (1) experimentální pool-core při dočasně nedostupné identitě neodpojí editovatelný zápas; (2) zbytkové UID bez autentizace uzná za vlastnictví. Experiment není produkčně načítán. Celý kombinovaný workflow zůstává **FAILURE**; nic se nevypínalo ani neobcházelo. Historický audit odstraněného žurnálu0 PASS/2 FAIL z předchozího předání není testem nynějšího řešení a nebyl použit jako release garance.

## Omezení a návrat

Živý Auth/Rules v autorizovaném izolovaném projektu s věrnou kopií Rules není dostupný a zůstává **neověřený**. Mockovaná změna účtu/role není důkaz skutečných serverových oprávnění. Neověřen fyzický iPhone, skutečné OBS ani přihlášené produkční soukromé reporty; jejich klientská funkce ověřena izolovaně. D1–D5, neobvyklé truthy JSON tvary bez validace, S1/S2/V1/F1/F2 a kapacita archivní cache zůstávají mimo10a.

Po ověření vzniká pouze dokumentační commit do čerstvého main; aplikační soubory ani verze se při něm nemění. Jeho SHA bude uvedeno v konečném předání a Git historii. Případný automatický Pages běh pro tento commit není nová funkční verze ani ručně opakované nasazení.

Návrat pouze reverzí celé aplikační10a v novém vydání dle AGENTS (script, propojení, původní factory a odpovídající testy společně); žádná datová migrace, vracení dat nebo manipulace s produkční Firebase. Etapa10a dokončena v přijatém rozsahu;10b ani další změna nezahájena.
