# Revize aplikace Poolčítadlo

## Dominik – provedené změny v revizi ve verzi v4.51.81 RC

Datum: 19. 10. 2026. Výchozí main/produkce: `105c126401fced4ba6e672f150770a3da97bb398` (v4.51.80 RC). Práce přímo na main; žádná vývojová větev ani ruční izolovaný náhled, PR #6 nepoužito.

- **Historické turnaje do série:** v kompletním zadání přibyla příprava struktury pro skupiny, SKO, DKO a skupiny → SKO/DKO, s datem, hráči/hosty a ručním nasazením bez losování. Používá stávající generátory a pořadí skupinových zápasů. Kontroluje neúplné a duplicitní nasazení; původní jednotlivé zápasy, textový import i ruční pořadí zůstávají.
- **Výběr profilů:** shodná pravidla aktivních a skrytých profilů i české řazení jako ve stávajícím historickém zadávání; ověřeno skutečným formulářem.
- **Výsledky a obnova:** ruční skóre bez počítadla, hodin, LIVE a smyšlených podrobných statistik. Příprava nasazení přežije reload lokálně; vytvořený turnaj a každý potvrzený výsledek se ukládají zabezpečeně. Rozpracované/nevyřešené turnaje se do série nepočítají. Po dokončení se body automaticky odvodí jednou.
- **Play-off:** návrh používá původní pravidla a lze jej ručně upravit. Nasazení se zachovává při přepočtu; při změně množiny postupujících vyžaduje nové potvrzení. Penalty blokují nevyřešený postup. U více samostatných skupin bez pavouka Dominik výslovně potvrdil povinné ruční konečné pořadí, protože původní jádro společné pořadí nemá.
- **Zpětné opravy:** přepočet přes původní turnajový engine, audit kdo/kdy/původní a nové skóre, konkrétní seznam zneplatněných navazujících výsledků před potvrzením. Neovlivněné výsledky se zachovávají; pozdější nejisté dvojice se uchovají bez započtení a ověří při dalším postupu. Při neúplnosti zmizí neplatné body, po dokončení se přepočítají. Ruční konečné pořadí se při opravě neruší bez upozornění.
- **Ochrana dat:** ETag/If-Match, kontrola aktuálního serverového stavu a ověření zápisu pouze konkrétního turnaje; konflikt se odmítne. Stabilní ID přípravy brání duplicitě při opakování po ztraceném potvrzení. Staré historické záznamy se nemigrují. Zachování identity hostů a propojení profilů zahrnuje i nový zdroj nasazení/výsledků. Bez změny Federal Cupu a bez testovacích zápisů do produkční Firebase.
- **Závěrečná kontrola:** přepočet obnovuje pouze sportovní stav a zachovává současná administrativní metadata včetně názvu a pořadatelů změněných od původního nasazení. Test samostatně ověřil i shodu se starým automatickým historickým importem u odpovídajícího SKO s děleným místem semifinalistů. Starý textový import má některá další pomocná kritéria oproti hlavnímu turnajovému výpočtu; tato revize oba existující výpočty nemění ani netvrdí jejich univerzální shodu. Rozdíl je popsaný v docs/historical-structured-entry.md.
- **Pravidla Lounské série:** zachovány funkce seriesTournamentPlacementRecords, seriesRefineTournamentPlacements, seriesPointsForPlacement a seriesStandings; nová bodovací logika nevznikla. Skutečná kritéria, ruční alternativa a podrobnosti jsou v docs/historical-structured-entry.md. Aktualizované PROJECT_STATUS.md a PROJECT_CONTEXT.md.

Ověření: nový izolovaný browser test současného main prošel pro všechny uvedené formáty, ruční UI, opravy, navazující výsledky, reload, shodu umístění/bodů, oprávnění, konflikt/403/412, opakování tvorby po ztraceném potvrzení a nedotčená data. Mockuje celou síť, 0 page errors, žádný zápis do matches/LIVE. Federal Cup browser test prošel. Smoke 12/12; celá Node sada 68/70 se dvěma stejnými dřívějšími chybami preview. Stav: **otestováno, připraveno k pushi a ověření nasazení**.

Neověřeno: skutečné Firebase Auth/Rules, fyzické mobilní platformy/nativní aplikace, reálný souběh zařízení a velká startovní pole. Nová funkce podporuje struktury původních generátorů, nikoli libovolný cizí pavouk. Produkční commit je zaznamenán v místní záloze `production-backups/2026-10-19-before-v4.51.81` včetně archivu a postupu návratu; žádná databázová migrace se neprovádí.

## Dominik – provedené změny v revizi ve verzi v4.51.80 RC

Datum: 19. 10. 2026. Výchozí main: `e70d9931ed6b836a8a5edba497190746b967efa6`. Práce přímo na main na výslovné zadání Dominika.

- **EXPORT PDF:** jednotné tlačítko v historii, detailu zápasu, Statistikách a Moje statistiky otevírá vlastní exportní dialog s názvem souboru a akcemi **Sdílet PDF**, **Uložit do zařízení** a **Zavřít**.
- **Dvě nezávislé možnosti:** systémové sdílení dostává připravený PDF soubor; uložení používá samostatné stažení bez sdílení. Pro jedno otevření dialogu se PDF připraví jednou, obě akce včetně opakování používají stejné bajty a stejný původní název. Generátory obsahu PDF zůstávají beze změny.
- **Opakované použití a zrušení:** dialog zůstává otevřený po sdílení, zrušení či chybě systémového sdílení a po zahájení/zrušení stažení. Při nepodporovaném sdílení je uvedeno vysvětlení a uložení funguje dál. Během čekání na sdílení se brání duplicitním akcím; Zavřít a Escape okno zavřou a uvolní jeho data.
- **Dokumentace:** aktualizované PROJECT_STATUS.md a PROJECT_CONTEXT.md popisují nové chování a ověřené/neověřené scénáře; historie REVIZE.md a pravidla AGENTS.md zůstávají zachované.

Ověření: smoke 12/12 a PDF jednotkové testy 8/8 prošly. Izolovaný Chrome se skutečnými knihovnami ověřil všechna čtyři místa exportu, skutečné downloady, původní názvy a shodné bajty mezi sdíleným File a staženým blobem, opakované použití identického PDF, simulované sdílení úspěch/zrušení/chyba včetně přímé uživatelské aktivace, nepodporované sdílení, Zavřít a Escape. Řízené zrušení Chrome downloadu přes CDP nechalo okno otevřené a další pokus stáhl totožné PDF. Generátory obsahu byly porovnány s výchozím main a zůstaly beze změny. Celá Node sada 68/70 lokálně i v GitHub CI se dvěma dřívějšími chybami preview, 0 nových selhání, browser 0 chyb JavaScriptu. Veškerá síť testu zachycena, Firebase blokováno.

Nasazení: commit `8cf279e306ecfd794791dc9da39127a62a0ebbbf` pushnut přímo do main; GitHub Pages úspěšně nasadil. Dne 19. 10. 2026 ve 20:00 UTC ověřeno HTTP 200, přesná shoda celého veřejného HTML s commitem, viditelná v4.51.80 RC a čistý Chrome bez JavaScriptových chyb či vzdálených zápisů, s blokovaným Firebase. Následný dokumentační commit zaznamenává skutečný stav, nemění produkční HTML ani verzi.

Nedořešené/neověřené: skutečné systémové sdílení a fyzické Android/iOS prohlížeče, nativní Capacitor aplikace a ruční zrušení nativního ukládacího dialogu vyžadují ověření na zařízení. Automatické testy mohou modelovat výsledek Web Share API a zrušení browser downloadu; neprokazují funkčnost cílových systémových aplikací. Dvě dřívější chyby preview testů a souběh konfigurace Federal Cupu zůstávají. Produkční Firebase data se nemění.

## Dominik – provedené změny v revizi ve verzi v4.51.79 RC

Datum: 19. 10. 2026. Výchozí main: `6d50db0655f193fa672ebd6277896336ee4d3fc8`.

- **Oprava ukládání PDF:** tlačítko v historii zápasů přejmenováno na ULOŽIT PDF. Stejné chování a označení mají exporty detailu zápasu, Statistik a Moje statistiky. Společný `savePdfBlob` zahajuje stažení PDF; automatické systémové sdílení již uložení nenahrazuje. Obsah PDF a pravidla názvů souborů zůstávají zachované. Textové sdílení mimo PDF se nemění.
- **Zavedení pravidel spolupráce Dominika a Jaroslava a povinného čtení a aktualizace dokumentace změn pro každou AI:** vznikl kořenový **AGENTS.md**. Před každou prací ukládá přečíst REVIZE.md, PROJECT_STATUS.md a PROJECT_CONTEXT.md, zkontrolovat větev, necommitnuté změny i nové commity na GitHubu. Autorství označuje zadavatele Dominika/Jaroslava; při nejasném zadání se AI musí zeptat. Před zápisem do main musí znovu ověřit vzdálený stav, zachovat cizí práci, bezpečně zapracovat souběžné změny a nikdy nepoužít force push.
- **Dokumentace aktuálního stavu:** vznikl **PROJECT_STATUS.md** pro verzi, stav nasazení, dokončené a rozpracované změny, známé chyby, omezení a důležité testy. Každá AI jej musí aktualizovat a rozlišovat připravené, otestované, čekající na nasazení a skutečně nasazené úpravy.
- **Návaznost dokumentace:** změněn **PROJECT_CONTEXT.md**, který odkazuje na závazná pravidla a aktuální stav a popisuje ukládání PDF. **REVIZE.md** zachovává předchozí historii; nové záznamy musí uvádět Dominika nebo Jaroslava, datum, verzi, popis, ověření a neuzavřené body. Aktualizace dokumentace po dokončení a po ověření nasazení je povinná pro každou AI.
- **Verze:** v4.51.79 RC v hlavním kódu a hlášeních chyb. Práce probíhá přímo na main podle výslovného zadání Dominika.

Ověření: smoke 12/12, 4 nové regresní testy ukládání a izolovaný desktop Chrome se skutečnými knihovnami prošly. Stažena 4 PDF ze všech exportních míst; ověřeny názvy a přesná shoda souborů s vytvořenými PDF bloby, nulové volání systémového sdílení a nulové chyby JavaScriptu. Oba generátory obsahu jsou beze změny. Celá Node sada 64/66 lokálně i v GitHub CI se stejnými dvěma dřívějšími chybami preview. Síť testu je plně zachycena, produkční Firebase nepoužita.

Nasazení: commit `413781e753a61876a07602b0a6b96df44220ab00` pushnut přímo do main, GitHub Pages úspěšně nasadil v4.51.79 RC. Dne 19. 10. 2026 v 19:45 UTC ověřeno HTTP 200, přesná shoda celého produkčního HTML s commitem, správné viditelné číslo verze a načtení bez JavaScriptových chyb v čistém Chrome, bez přístupu k Firebase a bez vzdálených zápisů. Následná aktualizace REVIZE.md a PROJECT_STATUS.md zaznamenává tento skutečně ověřený stav a nemění kód aplikace.

Nedořešené body: fyzické Android/iOS prohlížeče a nativní Capacitor aplikace zatím neověřeny. Dvě dřívější chyby preview testů a souběh konfigurace Federal Cupu zůstávají oddělenými známými body; produkční Firebase data se nemění.

## Dominik – provedené změny v revizi ve verzi v4.51.78 RC

Datum: 19. 10. 2026

Revize zahrnuje změny z PR #15, ručně otestované a schválené Dominikem. Výchozí commit této verze: `7bc3a647658cb86931fddf2aed9252c78f2136ca`.

- **Federal Cup Team přes detailní počítadlo:** ruční výběr hráče Slovenska a Česka před každým rackem, historie racků a statistiky přiřazené konkrétním hráčům i týmům. Celý Team zápas přináší jeden bod do výsledku Federal Cupu. Výběr a rozehraný stav přežijí obnovení stránky; starší ruční výsledky zůstávají kompatibilní.
- **Jednotná příprava Federal Cupu:** pevná disciplína 9-ball, race to 5, střídavý rozstřel po jednom racku a rozšířený režim se všemi statistikami. Výsledek tempa se zadává před zahájením Singles, Doubles i Teamu a určuje první rozstřel.
- **Vyhodnocení rozstřelu:** Break OK, Dry break, Soft break a Faul z breaku. Po Soft breaku soupeř převezme nebo vrátí pozici; správně se zachová hráč na tahu, možnost push outu, statistiky, undo i reload. Soft break sám o sobě není faul.
- **Oprava B&R conversion 200 %:** při změně rozstřelujícího před odehráním breaku se již započtený pokus převede ke správnému týmu a hráči. Procenta se neořezávají. Zachovaný reprodukční případ má správně 3 české breaky, 2 úspěšné, 1 faul a 2 B&R: úspěšnost breaku 67 % a B&R conversion 100 %.
- **Únik z jistoty s potopenou koulí:** v 9/10-ball se vybírají konkrétní potopené koule. Odeberou se ze stolu, čísla se zapíší do události a další strk je nenabízí. Ověřeno vrácení akce, reload a přiřazení hráči v Team režimu.
- **Zobrazení uložených ručních Team výsledků:** výsledky zůstávají viditelné i po dosažení 11 vítězství v sérii.
- **Číslo verze:** sjednoceno na v4.51.78 RC v hlavičce, informacích aplikace a nově vytvářených hlášeních chyb.

2-Way shot zůstává beze změny. Modularizace PR #6 není součástí této revize.

### Ověření a omezení

Funkční změny z PR #15 prošly izolovaným browser testem aktuálního kódu pro Singles, Doubles a Team, včetně breaků, Soft breaku, push outu, undo, reloadu, bodování série a reprodukce B&R. Ruční testování schválil Dominik. Zvýšení čísla verze bylo ověřeno smoke testy a kontrolou diffu.

Celková Node sada PR #15: 60/62; dvě již existující chyby preview-match-reload-recovery nejsou součástí této opravy. Souběžné přepisování celé konfigurace Federal Cupu z více zařízení zůstává známým rizikem. Skutečné Firebase Auth/Rules a nativní mobilní buildy nebyly v této revizi ověřeny. Produkční Firebase data nebyla při vývoji ani testování měněna.
