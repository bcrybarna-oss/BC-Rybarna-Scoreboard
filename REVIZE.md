# Revize aplikace Poolčítadlo

## Dominik – provedené změny v revizi ve verzi v4.51.79 RC

Datum: 19. 10. 2026. Výchozí main: `6d50db0655f193fa672ebd6277896336ee4d3fc8`.

- **Oprava ukládání PDF:** tlačítko v historii zápasů přejmenováno na ULOŽIT PDF. Stejné chování a označení mají exporty detailu zápasu, Statistik a Moje statistiky. Společný `savePdfBlob` zahajuje stažení PDF; automatické systémové sdílení již uložení nenahrazuje. Obsah PDF a pravidla názvů souborů zůstávají zachované. Textové sdílení mimo PDF se nemění.
- **Zavedení pravidel spolupráce Dominika a Jaroslava a povinného čtení a aktualizace dokumentace změn pro každou AI:** vznikl kořenový **AGENTS.md**. Před každou prací ukládá přečíst REVIZE.md, PROJECT_STATUS.md a PROJECT_CONTEXT.md, zkontrolovat větev, necommitnuté změny i nové commity na GitHubu. Autorství označuje zadavatele Dominika/Jaroslava; při nejasném zadání se AI musí zeptat. Před zápisem do main musí znovu ověřit vzdálený stav, zachovat cizí práci, bezpečně zapracovat souběžné změny a nikdy nepoužít force push.
- **Dokumentace aktuálního stavu:** vznikl **PROJECT_STATUS.md** pro verzi, stav nasazení, dokončené a rozpracované změny, známé chyby, omezení a důležité testy. Každá AI jej musí aktualizovat a rozlišovat připravené, otestované, čekající na nasazení a skutečně nasazené úpravy.
- **Návaznost dokumentace:** změněn **PROJECT_CONTEXT.md**, který odkazuje na závazná pravidla a aktuální stav a popisuje ukládání PDF. **REVIZE.md** zachovává předchozí historii; nové záznamy musí uvádět Dominika nebo Jaroslava, datum, verzi, popis, ověření a neuzavřené body. Aktualizace dokumentace po dokončení a po ověření nasazení je povinná pro každou AI.
- **Verze:** v4.51.79 RC v hlavním kódu a hlášeních chyb. Práce probíhá přímo na main podle výslovného zadání Dominika.

Ověření: smoke 12/12, 4 nové regresní testy ukládání a izolovaný desktop Chrome se skutečnými knihovnami prošly. Stažena 4 PDF ze všech exportních míst; ověřeny názvy a přesná shoda souborů s vytvořenými PDF bloby, nulové volání systémového sdílení a nulové chyby JavaScriptu. Oba generátory obsahu jsou beze změny. Celá Node sada 64/66 se stejnými dvěma dřívějšími chybami preview. Síť testu je plně zachycena, produkční Firebase nepoužita. Stav nasazení je evidovaný v PROJECT_STATUS.md; při tomto záznamu otestováno, čeká na push/nasazení.

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
