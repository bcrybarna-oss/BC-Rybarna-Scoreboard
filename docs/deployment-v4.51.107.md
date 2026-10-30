# Nasazení v4.51.107 RC — Livescore, etapa 8a

Zadavatel: Dominik. Datum: 30. 10. 2026. **Nasazeno a v níže uvedeném rozsahu ověřeno.**

## Vydání a hranice

PR [#47](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/47), head `5ba14dc5f0bc837ce595de63db09c384ddac6eed`, sloučen standardním merge do main `bb9b0e06b0c82dd0e4a8a74d48eac41dff0dae0d`. Před sloučením čerstvý fetch potvrdil nezměněný main `b0881d35c41ca6d2580bbf7ce012cfe57ff896c5`, čistý tracked diff a úspěšný release gate. Nepřidané cizí soubory zůstaly zachované.

8a je samostatně nasaditelná: LivescoreReader je jediný vlastník společného čtení a koordinace obnov. Aplikace poskytuje explicitní transport, autorizaci, datové a vykreslovací callbacky. Původní loader a časovací smyčka jsou odstraněné bez fallbacku. Pro případnou 8b zůstává přesun vykreslování seznamu, detailního dialogu a navigačního indikátoru. Nejde o souběžné dvě implementace; dokončení 8b není podmínkou tohoto vydání. Další část není zahájená.

Automatické [Pages 41103864524](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41103864524) dokončilo build i deploy úspěšně. Nebylo ručně opakováno. První veřejná kontrola během deploymentu správně odmítla ještě publikovaný soubor v106; finální kontrola již potvrdila v107.

## Veřejná produkce

URL: [Poolčítadlo](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/).

- 23 veřejných souborů má HTTP 200 a přesný SHA-256 proti merge commitu, včetně index.html, overlay.html a LivescoreReader. Index, overlay a nový modul ověřeny také samostatnou URL obcházející cache.
- Čistý Chrome desktop 1440 × 1000 a mobilní viewport 390 × 844: zobrazená verze v4.51.107 RC, všech osm modulů načtených jednou, žádný experimentální core ani fallback.
- Navigace úvod/výsledky/Livescore/Federal Cup, pět vstupů a odchodů z Livescore, indikátor mimo přehled, 21 položek Federal Cupu; žádné JavaScriptové ani console chyby.
- Anonymní relace neměla dostupný živý zápas. Veřejně je tedy potvrzen prázdný přehled, nulový indikátor a otevření/zavření dialogu nedostupného zápasu. Skutečný naplněný živý dialog ani kladný počet zápasů v přihlášené produkci nebyl tímto ověřen.
- Bez přihlášení, importu nebo úprav dat. Browser blokoval Firebase/Auth a všechny zápisové požadavky; během veřejného scénáře nebyl žádný takový pokus.

## Izolované kontroly publikovaného kódu

Stažený index.html a všech osm modulů byly před testem ověřeny SHA-256 a předány existujícím browserovým testům místo pracovních souborů. Transport a identity jsou mockované, nikoli živý Auth/Firebase.

- Desktop i mobil: tři souběžná čtení vyvolají jediný GET; indikátor 2 LIVE se aktualizuje mimo přehled; deset navigačních cyklů, přepnutí Alpha/Beta, zavření a znovuotevření detailu projdou. Opožděná odpověď po zavření a A → B neobnoví starý dialog. Logout nevyvolá nový LIVE GET. Po stop nezůstane vlastní interval, timeout ani pending čtení.
- Mockovaný cleanup skutečně odstraní pouze vlastní stale/ended záznamy, nikoli cizí. Zápisy proběhly pouze proti testovacím datům.
- Šest cílených unit testů skutečného modulu prošlo: také opožděná autorizace, odpověď ignorující abort, chyba/opakování, freshness, 20 cyklů start/stop a bfcache/dispose. Modulový soubor je byteově shodný s veřejným.
- Oba scénáře produkční obnovy identity na publikovaném kódu prošly: opožděné ruční/automatické přihlášení, zachování skóre/strků/nastavení, POKRAČOVAT, cizí účet, offline režim. Přihlašovací endpointy byly mockované.
- Na sloučeném kódu navíc prošly bootstrap a izolace streamu/OBS. Předmerge kontroly turnajů v101 a skutečných PNG/PDF/XLSX zůstávají doložené v dokumentaci etapy; při tomto nasazení nebyly znovu všechny exportovány.

## CI a známé vady

Finální PR [CI 40951292237](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40951292237) i main [CI 41103866664](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41103866664): release gate PASS, produkční Node **272 PASS / 0 FAIL / 3 SKIP** ze 275. Přeskočené kontroly vyžadují soukromé exporty. Stejný produkční výsledek byl zopakován lokálně po merge.

Experimentální sada **28 PASS / 2 FAIL / 0 SKIP** z 30; celý workflow je FAILURE. Obě vady byly jednotlivě znovu reprodukované nad čerstvým výchozím main, experimentální zdroj ani testy PR nemění:

1. `preview-match-reload-recovery.test.cjs:50`: preview větev při nedostupné identitě vrací false a ponechá zápas v editovatelné paměti; očekávané odpojení bez mazání uloženého stavu neprovede.
2. `preview-match-reload-recovery.test.cjs:155`: preview predicate přijme zbytkové UID vlastníka i bez autentizované identity.

Žádné testy, povinné kontroly ani pravidla ochrany nebyly obcházené. Experimentální core není součástí produkčního načítání. Schválení výslovně připouštělo tyto nezměněné experimentální vady.

## Omezení a návrat

Živá přihlášená produkční relace, Firebase Rules, skutečný aktivní zápas přes síť, fyzický iPhone/Safari ani OBS zařízení nejsou ověřené. Mobil je Chrome viewport. Dříve naměřené blokování reportu B, kapacita archivní cache a historická GET → DELETE mezera cleanupu bez ETag zůstávají; tento release je neřeší. Již odeslaný cleanup DELETE nelze zpětně odvolat.

Návrat: samostatný reverzní PR z aktuálního main, reverze merge `bb9b0e0` pomocí `git revert -m 1`, nové číslo podle AGENTS, release gate a relevantní regrese, standardní Pages. Bez resetu, force push, migrace nebo vracení dat. Vrátí se také původní souběhová vada načítání; před případným rollbackem posoudit užší opravu. Návrat nebyl potřeba.

[Sanitizovaná evidence veřejných souborů a scénářů](deployment-v4.51.107-verification.json). Podrobná [hranice a před/po měření etapy 8a](livescore-reader-stage-8a.md). Raw logy a screenshoty jsou místně v `output/deploy107/`, bez soukromých dat v tomto PR.
