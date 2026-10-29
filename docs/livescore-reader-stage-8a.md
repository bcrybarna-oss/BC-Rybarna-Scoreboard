# Livescore čtecí část — etapa8a, kandidát v4.51.107 RC

Zadavatel: Dominik,29.10.2026. Základ po fetchi b0881d35c41ca6d2580bbf7ce012cfe57ff896c5, produkce106. Nic neslučovat/nenasazovat. Další oblast roadmapy nezahájena.

## Mapa a hranice

Seznam, detailní modal a navigační indikátor používají tutéž kolekci /stream/liveMatches. Původní loadCloudLiveMatches měl700ms omezení neforce volání, příznak nastavovaný až po awaitAuth a automatický cleanup stale. Trvalý1s interval obnovoval otevřený přehled/dialog, mimo ně četl po15s. Startup měl samostatný900ms timeout. Detail open čekal na stejný loader. Vstup do přehledu navíc načítá secure matches/tournaments a spouští ruční cleanup bez toastu. activeLiveMatches spojuje cloud/secure/local/current a zachovává své filtry/řazení/hidden pravidla.

Ucelená8a: LivescoreReader vlastní sdílení právě probíhajícího read, timestamp posledního pokusu, background časovač/warmup/pagehide, epochu relace a oddělené generace view/dialog. Core poskytuje identity/authorize/read/get/set/canDelete/cleanup, hodiny, timer API, page target a renderer callbacky. Bez skrytého data/match/cloudUid v modulu. Autorizační callback dostává current/signal kontrakt stávajícího ensureCloudToken, takže pozdní refresh neobnoví starou relaci.

Cloud array zůstává explicitně v core, protože ji mění i původní publisher; modul má pouze get/set, nikoli druhou kopii. UI seznamu, detailu a indikátoru, výběr/edit/delete akce a celý heartbeat/publikace/OBS/shotclock jsou zachované. Loader je jen delegát, původní tělo, flagy a poll-loop odstraněny bez fallbacku. Rendererová extrakce seznamu/detailu je případná8b, nyní neprováděna; nejde o paralelní implementaci.

## Vlastníci prostředků

Background konzument žije po dobu stránky i mimo Livescore a při odhlášení kvůli indikátoru lokálních zápasů. V normálu vlastní1interval1000ms, jediný startup timeout900ms a1pagehide listener. Odhlášení invaliduje request epochu a abortuje čtení, ale neruší oprávněnou lokální navigaci. Bez Auth není cloudový GET. stop/dispose uvolní timer/listener; při bfcache stop ponechá pouze jednorázový pageshow pro obnovu, dispose odstraní i ten. Souběžné tick se také sdílejí, aby pomalý request nevyvolal po dokončení sérii stejných renderů.

View má vlastní generaci měněnou při každé navigaci; dialog při open/switch/close. Opožděný výsledek nesmí renderovat již opuštěný scope. Odchod neabortuje read potřebný navigaci nebo druhému konzumentovi. Změna účtu/role ověřuje snapshot při každém výsledku; starý finally nemůže odstranit novější pending read.

## Úklidové zápisy — nejsou vydávané za čisté čtení

Automatický read ignoruje endedAt, rozděluje ostatní podle stejného180s LIVE_STALE_MS; invalidní čas je stale. DELETE spouští pouze pro vlastníka nebo system admina. Ruční cleanup si zachovává samostatný GET všech záznamů, včetně endedAt, vlastní/admin DELETE, reload a případný toast. Tuto odlišnou úplnou kolekci nelze nahradit filtrovaným seznamem bez změny chování. Proto nezmizí veškeré kolekční GET při vstupu: sdílení platí pro běžný loader, nikoli odlišný ruční cleanup. Žádná nová oprávnění, širší mazání ani změna Rules.

Guardovaný cleanup adaptér před/po awaitAuth ověřuje původní relaci a aktuální own/admin oprávnění; ruční cleanup také kontroluje kontext po GET a před UI návratem. Již odeslaný DELETE se zpětně neodvolává, neprovádí se nové transakce/ETag nebo změna klasifikace stale. Historická možnost obnovení záznamu mezi GET a DELETE se tímto PR nemění. Publikační liveMatchRequest a write/heartbeat těla zůstávají beze změny.

## Funkční opravy oddělené od přesunu

1. Actual loader v main106,3volání čekající na tutéž AuthPromise:3GET. Nový skutečný modul rezervuje promise předAuth:1GET a všichni čekají na její dokončení. Baseline doložena exekucí původní source funkce, nikoli odhadem z regexu; unit a browser ověřují nový počet. Zastaralý příznak nevrací okamžitě starou cache druhému callerovi.
2. Scope/identity epochy potlačují pozdní read/render/cleanup; původní poll zachytil visible před await a callback detailu renderoval bez kontextu. Přísné testy zadržené odpovědi po close/A→B/stop, dialogswitch a navigation ověřují aktuálního vlastníka. Nejde o změnu sportovních dat nebo grafiky.

## Ověření a měření

6unit přímo nad produkčním modulem PASS: singleflight předAuth, latebody A→B/stop, backgroundnav, sdílený tick a pozdní view/dialog, switch/reopen, freshness/owncleanup/retry,20start-stop cyklů a bfcache/dispose.1interval+1warmup+1listener během,0po stop/dispose.

Browser actualroot+modul s plně mockovaným Firebase PASS:3→1GET, indikátor2LIVE mimo přehled,10vstupů/odchodů a dialogx→y/close/reopen, změna účtu během čtení,0vlastních timerů po explicitním stop. Realistický mock DELETE odstraňuje záznamy z dalších odpovědí: vlastní stale i vlastní ended se odstraní, cizí ne;81celkových mock požadavků v posledním běhu včetně zachovaných secure/cleanup cest, žádné produkční zápisy.

Archív27.10.40,9MB/189zápasů/26profilů jen vRAM. Před/po6cyklů=30navigací+6cloudobnov:0JSerrors/0interakčníchselhání;48požadavků a3běžnéLIVEreads v obou variantách. Cílená Auth race je jiný scénář3→1. CPU28,23→27,20s, finálníheap57,40→57,39MB; DOM9173→9174 (nový script), listenery1128→1129 (vlastněný pagehide), intervaly5→5, timeouty0→0. Po prvním naplnění UI žádný růst DOM mezi cykly4a6. Nejdelší úloha2615→2529ms, blokování obecných statistik zůstává. Orientační srovnání, ne tvrzení o optimalizaci; síťové prodlevy mockovány odděleně od TaskDuration.

Produkční Node275PASS lokálně se soukromými vstupy, veřejně272PASS/3SKIP; experiment28PASS/2FAIL, celek303PASS/2FAIL/0SKIP z305. Selhání preview50 pendingpointer a155 staleUID jsou jednotlivě shodná s baseline; žádné ignorování. Bootstrap včetně chybějícího modulu, OBSizolace, identity/reload/strky z105, turnaje101/plnáquota a skutečné PNG/PDF/XLSX desktop/mobil PASS. ŽivýAuth/Rules/OBS zařízení/Safari nejsou tímto ověřeny; OBS testy jsou izolované dva klienti + skutečný overlay kód.

## Návrat a omezení

Reverze celého PR vrátí loader/poll i bootstrap a verzi podle AGENTS, bez vracení nebo migrace dat. Při případném rollbacku se vrátí i potvrzená preAuth race. Core renderery i ostatní cloud služby zatím mají vlastní původní životnost; tento modul není plošná datová vrstva. Stará experimentální implementace se neaktivuje ani neopravuje. Cache/PDF a další oblasti mimo rozsah. Surové logy a profiler output/stage8a, žádný soukromý archiv vPR.
