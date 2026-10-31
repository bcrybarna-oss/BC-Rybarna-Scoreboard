# Nasazení v4.51.110 RC — společné etapy9b1 a9b2

Zadavatel: Dominik. Datum: 31. 10. 2026. **Nasazeno a v níže uvedeném rozsahu ověřeno.** Produkční data ani Rules se neměnily.9c nebyla zahájena.

## Integrace a CI

Čerstvý fetch potvrdil výchozí main `fade611557a33a8145b8c0251883946e1bf7b968` (v109), bez souběžných změn. PR52 head `c7a8613909b084e19176d2388611c407f2c590ce` byl integrován do větve PR51 běžným merge `32017de896b0127f59d45d4fcf283452e1e8c426`; stromy jsou shodné, žádný konflikt. Výsledný diff proti main obsahuje pouze výzvy, aktivní verzi110, testy a dokumentaci; presence/Rules/experimentální core/workflow beze změny. Žádný force push či přepsání historie. PR52 je evidován jako merged touto integrací; PR51 jako společný merge do main `5e14d7948a3f3a1ddcd206de538d412956b5813f`. Samotná9b1 nebyla nasazena odděleně.

Release gate a cílené browserové kontroly obou částí na integračním commitu PASS. Lokální produkce318PASS/0FAIL/0SKIP se třemi soukromými exporty pouze pro čtení. První lokální běh měl1FAIL v extrakci password-reset kvůli CRLF po přepnutí větve; po obnovení LF beze změny gitového obsahu nebo testu5/5 i celá sada318/0/0 PASS. Tento environmentální výsledek není zaměněn za dvě experimentální vady.

[PR CI41229376276](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41229376276) i [main CI41229439371](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41229439371): Release PASS, produkce **315 PASS /0 FAIL /3 SKIP** (tři privátní exporty chybí vCI, lokálně prošly). Experiment **28 PASS /2 FAIL /0 SKIP**, celý workflow FAILURE. Jednotlivě nezměněné vady `preview-match-reload-recovery.test.cjs:50` (neodpojí editaci při pendingAuth) a `:155` (staleUID bezAuth přijme jako vlastníka); produkce experimentální core nenačítá. Žádná kontrola ani očekávání nebyly vypnuté.

**Historický audit odstraněného žurnálu** z213f87f:0PASS/2FAIL nad přesně zmrazeným zdrojem. Je důkaz původního falešného GET-ACK a neomezeného kopírování metadat, nikoli test současné implementace. Jeho exit1 a reprodukce zůstávají samostatně zachované; nemíchají se do produkční ani experimentální sady. Aktuální kontrakty bez žurnálu jsou v produkční sadě.

## Skutečná veřejná produkce

[Pages41229438687](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41229438687) build/deploy/report **success**, automaticky po merge; žádné ruční opakování deploymentu. [Produkční URL](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/).

- Veřejná **v4.51.110 RC**. Všech27 kontrolovaných souborů HTTP200 a přesný SHA256 proti merge včetně index/overlay a12modulů. Nové MatchChallenges/MatchChallengeActions i ostatní moduly načteny právě jednou. Cache-busting URL index/overlay/readerů/controlleru potvrzeny; žádný experimentální core/fallback.
- Skutečný Chrome desktop1440×1000 a mobilní viewport390×844: výzvy ukazují správnou anonymní výzvu k přihlášení, opakovaný vstup/odchod funguje. Centrum notifikací otevřít/zavřít/znovuotevřít a20renderů bez JS chyby či označení přečtení. Úvod/výsledky/Livescore/indikátor/FC21položek, nedostupný detail a rychlé znovuotevření bez chyb.
- Pageerror0, consoleerror0, pokusy o Firebase či zápis0; ochranné blokování sítě bylo zapnuté. Žádné produkční výzvy nebyly vytvořené, přijaté nebo změněné. Nešlo o živou přihlášenou relaci a soukromé naplněné seznamy nejsou veřejně ověřené.

## Izolovaně na skutečně publikovaném kódu

Testovací adaptér používá stažené veřejné HTML/overlay/12modulů, ověřuje jejich hashe a nahrazuje pouze síť/identitu testovacími daty. Žádný produkční zápis. Toto není ověření živého Auth/Rules.

-9b1 desktop/mobil: sdílenýGET, opožděná odpověď/A→B, role, offline/retry, koncept, navigace/start zápasu PASS. V celém scénáři11GET na viewport, souběh sdílí1GET;100renderů35,7/35,4ms orientačně. Aktivní reader1interval/1startup timeout/2listenery, stop0; žádný nový výkonový slib.
-9b2 desktop/mobil: všech pět oprav, šest akcí/payloadů, captured inputs, A→B→A, plný i nedostupný localStorage, zachovaný koncept, unknown, zastavení čekajících akcí, zachování nesouvisejících serverových polí a navazující skutečný startMatch PASS.21mockPUT/8GET v celém scénáři na viewport; unknown s čekající akcí jen1PUT. Při plné kvótě všech6akcí po jednom potvrzenémPUT, archivní sentinel zachován. SecurityError metod i getteru storage neblokuje akce. GET shoda stopku neruší, žádný automatickýPUT/retry. Potvrzený úspěch zůstává úspěchem při chybě obnovy.
- Bootstrap všech12modulů i explicitní chyby chybějících modulů, recovery s mock Auth (manual/automatic), turnaje101 včetně quota/draft/phází/skutečně založených zápasů/FC, Livescore (3→1GET,10cyklů,stale/úklid), OBS izolace PASS. Skutečné A1/A2/B PNG1920×1080/PDF16:9 a Singles/Doubles/Team Pushout XLSX desktop/mobil PASS; immutable data,0Firebasezápisů.
- Samostatný starší9a consumer test: desktop PASS, mobil nejprve **FAIL0≠4 položky**. Jeho fixture vkládá jen cache řádky, ale nový aktivní9b reader dostává prázdný mock server a přepíše je. Zopakování se zastavením tohoto vedlejšího readeru pouze v9a fixture: desktop/mobil PASS včetně přesnéPNG/text/payload parity, beze změny assertions/tolerance či aplikace. End-to-end propojení9b1→notifikace prochází v obou cílených9b1 browser testech se skutečně naplněným mock serverem. Původní log není smazán ani vykázán jako PASS. Doložená historická PNG nestabilita a mobilní překrytí zvonku zůstávají samostatný úkol; tato kontrola není vGitHubCI.

[Strojové výsledky a veřejné hashe](deployment-v4.51.110-verification.json). Screenshoty: [veřejné výzvy desktop](screenshots/deployment110-public-challenges-desktop.png), [mobil](screenshots/deployment110-public-challenges-mobile.png), [veřejné notifikace desktop](screenshots/deployment110-public-notifications-desktop.png), [mobil](screenshots/deployment110-public-notifications-mobile.png).

## Omezení a návrat

**Blokace nejasné operace a upozornění nepřežijí restart/reload.** Reload neodvolá odeslaný PUT a nemusí vyřešit jeho nejasný výsledek. Nová instance sama nic neopakuje, ale bezpečné pozdější ruční opakování ani souběh mezi zařízeními současný whole-profilePUT negarantuje. Žurnál/reconcile/GET verified jsou odstraněné bez náhrady. [Skutečně bezpečný serverový protokol](challenges-write-conflict-proposal.md) zůstává pouze návrhem samostatného úkolu.

Živý Auth/Rules, fyzický iPhone a reálné OBS neověřeny. Soukromá data a zápisy pouze mockované. Neopravována archivní cache, jednorázové blokování reportuB, mobilní bell overlay ani9c.

Návrat standardním **revertem společného merge5e14d79 s parent1**, zachovat novější změny, zvýšit vydání dle aktuálního main a spustit release/produkční/browser kontroly před nasazením. Žádné vracení, mazání ani migrace dat/Rules. Nevracet jen zjednodušovací commit1bb090c — tím by se znovu zavedl odmítnutý žurnál. Revert vrátí starý klientský lifecycle a jeho známé závody; riziko posoudit proti cílenému hotfixu.
