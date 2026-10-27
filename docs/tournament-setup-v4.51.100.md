# Zakládání turnajů – diagnostika a oprava v4.51.100 RC

Zadavatel: Dominik. Datum: 27. 10. 2026. Základ `04e4dccb2547ad350db87fb9bc09ef25b381e055` / produkce v4.51.99 RC. Kandidát nové opravy; neslučovat a nenasazovat. Další modularizace pozastavena.

## Podklad a izolace

Použit pouze místní export BC_Rybarna_Scoreboard_Backup_2026-10-27.json: 40 913 440 bajtů, 189 zápasů, 26 profilů, SHA256 `49908fbcd66113315e524e6e61a4fc3a889654bb0e9420d309b843d4181a4d5d`. Soubor se nezměnil. Veškeré Firebase požadavky v browseru zachyceny mockem, včetně ETag a serializace odstraňující prázdné uzly. Export nebyl importován do produkce. Příprava konkrétního neuloženého turnaje ani přesné zaplnění uživatelova úložiště z JSON doložit nelze; závady jsou reprodukovány samostatně nad tímto objemem dat.

## 1. Kvóta místního úložiště

Na původním produkčním HTML: otevřít přípravu historického turnaje ze série, zvolit čtyři hráče a nastavení, vyčerpat dostupné místo a stisknout PŘIPRAVIT RUČNÍ NASAZENÍ. `historicalSaveDraft()` provede neošetřený `localStorage.setItem()` před `historicalRenderSeedSetup()`. Výjimku zachytí až vnější handler, zobrazí technický text a k nasazení nepřejde. Stejná neošetřená cesta byla i při změně nasazení a před cloudovým uložením.

Klíč `bc_rybarna_scoreboard_v1_historical_structure_setup` obsahuje pouze seriesId, konfiguraci, identity hráčů/hostů, pořadí nasazení a později identitu vznikajícího turnaje. Neobsahuje archiv ani kopie strků. Reprodukovaný původní návrh: **432 UTF-8 bajtů / 964 bajtů při orientačním UTF-16 účtování včetně klíče**. Browser skutečně odmítl vložit celý 40MB archiv. Samostatně je nedostatek zbývajícího místa deterministicky simulován výjimkou QuotaExceededError pro všechny další zápisy; nejde o tvrzení, že export prokazuje původní obsazení localStorage.

Oprava zachytí neúspěch uvnitř ukládání přípravy a zachová paměťový návrh. Viditelné samostatné upozornění výslovně říká, že příprava není lokálně uložena, po reloadu či zavření se neobnoví a lze pokračovat k cloudovému uložení. Upozornění nepřepisují provozní zprávy. Zavření/otevření dialogu ve stejné stránce používá aktuální paměť, nepřepíše ji starší diskovou kopií. ZMĚNIT NASTAVENÍ již nemaže přípravu; zachová formulář, hráče i použitelné nasazení. Starší uložené návrhy bez nového snapshotu formuláře mají kompatibilní doplnění formuláře z jejich konfigurace. Úspěšné cloudové uložení je nadále ETag PUT + ověřovací GET; až poté se hlásí Uloženo. Nedostupná místní cache tohoto uloženého turnaje nepředstírá úspěšnou lokální zálohu.

U běžného turnaje již chyba ukládání prezence pokračování nezastavovala, ale byla skrytá. Nyní má také výslovné upozornění o paměťovém režimu. Žádný archiv, cizí klíč nebo záloha se nemaže za účelem uvolnění místa. Dosavadní odstranění vlastního dočasného návrhu po úspěšném vytvoření zůstává.

## 2. Disciplína a race-to obou fází

**Běžný turnaj: odstranění dřívější možnosti nebylo potvrzeno.** Původní HTML skutečně zobrazí Disciplínu pavouka při formátu Skupiny → SKO/DKO. Zaškrtnutí MĚNIT RACE TO PODLE FÁZE TURNAJE zpřístupní samostatné skupiny a jednotlivá kola play-off. Potvrzeno browserem na desktopu i mobilu. Git historie `-S/-G` dohledává obě části v commitu `c6df8bb69a1e80a94a3b21916b8d39d1d7fff222` z 12. 9. 2026; následné odstranění těchto polí v produkční větvi nenalezeno. U samotných skupin nebo samotného pavouka se druhá disciplína správně nenabízí.

Nesrozumitelnost je odstraněna přímým polem Race to play-off vedle Race to skupin pro oba hybridní formáty. Prázdné play-off znamená stejný základ jako skupiny; volitelné výjimky podle jednotlivých kol mají dál přednost. Nové `playoffRaceTo` používá společný `tournamentRaceForMatch()`, bez druhého výpočtu. Starší turnaje bez něj nadále používají raceTo a dosavadní raceByStage. Kontrola handicapu zahrnuje i nejnižší skutečně nastavenou fázi. Konfigurace běžné přípravy dříve nebyla součástí uložené prezence; nyní se její povolená pole ukládají a obnovují spolu s hráči a pořadím.

**Historický strukturovaný turnaj: chybějící možnost potvrzena.** Vstupní formulář zavedený commitem `c38bf2a8a7b8c621278ea499a33ca1aaa3c2c52f` z 19. 10. 2026 (v4.51.81 RC) měl od začátku pouze jednu disciplínu a raceTo. Nevzniklo to doloženým pozdějším odstraněním v rámci Federal Cupu. Historický generátor nyní ukládá groupDiscipline, playoffDiscipline a playoffRaceTo před vytvořením `historicalStructure.initial`. Replay, opětovné cloudové načtení a ruční výsledky tak používají stejný společný resolver jako běžný turnaj. Existující turnaje se nemigrují nebo nepřepisují.

## 3. Hranice Federal Cupu

- Běžný formulář: `tournament*` / `raceStage*`, vlastní prezence a klíč `bcRybarnaTournamentCheckinDraft_v1`.
- Historický formulář: `hs*`, historicalBuildDraft, samostatný klíč historical_structure_setup, ETag turnaje.
- FC: `fc26*`, data.federalCup2026, vlastní konfigurace a kontrola očekávané konfigurace před zápisem. Žádný z nových snapshotů neobsahuje FC pole.
- Sdílené obecné počítadlo a turnajové generátory mohou zůstat. FC omezení CSS jsou v `#screen-setup.federal-setup`, netýkají se obou formulářů turnajů. pendingTournamentLink a pendingFederalCupLink mají oddělené kontexty; běžné testovací zápasy nemají federalCupLink.

Nevhodné sdílení jako příčina těchto závad nebylo doloženo. Konfigurace FC je v testu před/po zakládání a navigaci shodná, program má 21 položek. Samostatná federal-lineup-browser ověřila obě reprezentace, Doubles, zastaralé nasazení, přejmenování, pořadí a reload. FC logika, výpočty, reporty, exporty, cloudové moduly a opravy výkonu se nemění; žádné dokončování modularizace.

## Ověření a omezení

`tests/tournament-setup-browser.cjs` používá skutečné produkční HTML a aktuální export. Režim TOURNAMENT_BASELINE s původním HTML prokázal blokaci a chybějící historická pole i existující běžné ovládání. Opravený běh: desktop Skupiny → SKO a mobil Skupiny → DKO, ruční výběr a nasazení, změna nastavení, zavření/otevření, obnovení přípravy běžného turnaje po reloadu, zápisy a čtení mocku včetně ztráty prázdných uzlů, plná kvóta, skutečný skupinový zápas 8-ball/3 a play-off 10-ball/7, FC konfigurace/program PASS; 0 pageerrors.

Nové jednotkové testy importují těla produkčních resolverů a ukládání; nezávisle ověřují fáze, přednost kol, legacy fallback, známé pořadí hráčů, výslovnou volatilitu a zotavení úložiště. Původní kompletní historical-structure-browser PASS včetně pravomocí, ETag412, ztraceného potvrzení, korekcí, všech formátů, bodování sérií a parity s běžným turnajem. Plná lokální Node sada se soukromými vstupy: 245 PASS / 2 známé FAIL / 0 SKIP ze 247. Finální GitHub CI bude uvedeno v PR.

Známá selhání preview-match-reload-recovery zůstávají: řádek 50 je rozpor kontraktu při čekání na identitu, řádek 106 zastaralý regex tvaru volání. Nejsou vypnuta ani upravena. Testy se zápisy běží pouze v mocku. Skutečné soukromé neuložené nastavení a fyzický mobil nebyly k dispozici. Obnova neuložené přípravy po zavření/reloadu při plné kvótě není zaručená a UI to výslovně uvádí. Plná archivní cache zůstává samostatným omezením.

Reprodukce: `TOURNAMENT_BACKUP` volitelně určuje místní export; `TOURNAMENT_BASELINE=1` a `TOURNAMENT_SOURCE` původní HTML. Běžný opravený běh `node tests/tournament-setup-browser.cjs`, jednotkové testy `node --test tests/tournament-setup.test.cjs`. Artefakty jsou lokálně v output/tournament-100; soukromý export se necommituje. Návrat reverzí kódu podle release pravidel, bez vracení dat nebo migrace.
