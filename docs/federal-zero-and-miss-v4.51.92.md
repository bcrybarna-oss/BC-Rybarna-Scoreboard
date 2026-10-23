# Explicitní nula a bezpečný odvod před MISS – v4.51.92 RC

Zadavatel: Dominik. Datum: 23. 10. 2026. Stejný draft PR #30; nesloučeno a nenasazeno, produkce v4.51.91 RC.

## Tři oddělené části opravy

1. Dříve připravená prevence neznámého stolu: rychlé DOHRÁT / ČISTÁ HRA / DOHRÁVKA vyžadují známý stůl. Doplnění stolu samo nedopočítává minulou evidenci.
2. Uchování známého počtu: nově vytvořené escape/pot/break s explicitně dodaným polem koulí ukládají také číselné pottedCount, včetně nuly. Výjimkou je rozstřel s neznámými čísly. Chybějící údaj ani explicitní null se na nulu nepřevádí. Týká se RESAFE i ostatních úniků se známým nulovým výsledkem. Cloud může odstranit balls: [], ale číselnou nulu zachová.
3. Upřesněné pravidlo zadavatele: pouze bezpečný odvod v přesné rotaci se známým stolem před MISS ukládá inferred_pots / source inning_end / entry sequential_inference / intent pot, počet koulí = počet pokusů = počet úspěšných strků. Původ zůstává derived. Samotný MISS přidá svůj neúspěšný pokus. Odebrání odvozených koulí ze stolu zabrání dvojímu započtení; další potvrzení nevytvoří druhý záznam. Faulem ukončený náběh, nebezpečný odvod, neznámý stůl a historické inferred_pots bez tohoto označení nezískávají domyšlené pokusy.

Team cloudový reload také obnovuje prázdnou strukturu výběru hráčů [null,null], pokud ji cloud odstranil mezi racky. Nevymýšlí identity ani statistiky. Agregační pravidla 13 metrik, design reportů, stream a Firebase Rules se nemění.

## Ověření

- Nové 4 unit testy: explicitní nula/kladný počet, skutečně chybějící/unknown, úzce označený bezpečný MISS a ochrana proti dvojímu započtení. Na předchozím HEAD 493b71e selžou 3/4, po opravě 4/4 PASS.
- Browser používá skutečný produkční secureMatchRequest a resumeLocalMatch nad izolovaným mockem cloudového formátu. Model odstraňuje prázdná pole/null, zachovává číselnou nulu; nejde o spojení s produkční Firebase. RESAFE, další nulové úniky, UNDO, serializace, cloudové načtení a reload PASS.
- Syntetický Team průchod: koule 6 před MISS na 7, RESAFE a další racky dávají 20/21 complete a 21 koulí complete i po cloudovém reloadu. Odstranění skutečně nedoloženého počtu nadále vyvolá unknown_pots. A1/A2/B i osobní a reprezentační souhrny jsou konzistentní.
- Skutečné exporty A1/A2/B pro complete i unknown scénář: PNG 1920×1080 a PDF 16:9 PASS; chybějící počet má hvězdičku, známá nula nikoli. Artefakty jsou lokálně v output/pdf/federal-zero92/ (syntetická data).
- Detailed counter, quick-finish, Federal Cup a unknown-table browser regrese PASS, včetně kontrolního Singles/Team 4:5, ČISTÉ HRY, dohrávek a reloadu. Node 194/196 PASS: pouze známé dvě chyby preview-match-reload-recovery.test.cjs v test-modular, bez nové regrese. CI není plně zelené. [CI opravy 1ecf831](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39967684036): Release version and revision success; Node194/196 failure, log potvrzuje výhradně preview-match-reload-recovery.test.cjs:50,106. Žádná nová regrese; CI není plně zelené.

## Původní zápas: pouze návrh cílené nápravy

Export BC_Rybarna_Scoreboard_Backup_2026-10-23.json, SHA256 7ad5bf902cdd24d585a4bd092f564bcc7a61eb8d692d84008d58013926716c4a, zůstal beze změny. Ověřena identita matchId 5a97e289-a5f5-4da4-bd85-8bc00daf1cc9 / sezóna 2026 / Team #1 / 1:5. V původních datech je 36/37* a 38*.

Samostatný postup po dalším schválení:

1. Znovu pouze pro čtení stáhnout konkrétní aktuální záznam, zálohovat a ověřit identitu i shodu s exportem; při souběžné změně zastavit.
2. RESAFE rack 3, ID 45910279-8482-4ede-b25b-af1e6594840f: doložit balls: [] ve snapshotu následující události (index 28/29), shodu ID/aktéra/racku a doplnit pouze pottedCount: 0.
3. Odvozená koule 6 rack 1, ID 0f0e7fe5-6b04-4e94-93fe-e3b2cfc1e4e8: ověřit bezpečný známý stůl a navazující MISS na 7. Podle schváleného pravidla doplnit pottedCount/strokeCount/pottingAttempts/successfulPottingStrokes po 1, intent pot, entry sequential_inference. Zachovat kind, source, derived původ a ID.
4. Udržet shodu kanonického detailedPlay.records a existujících rack.shots kopií týchž ID. Nepřidávat další záznam ani znovu nezvyšovat regularPottedBalls (koule 6 už je započtená). MISS zůstane beze změny; žádná plošná migrace nebo import celé zálohy.
5. Nejprve suchý přepočet A1/A2/B, referencí, počtů záznamů a skóre. Hluboká paměťová kopie těchto přesných dvou oprav již dala 37/38 complete (97,3684 %) a 38 complete, components explicit 37 / derived 1, bez chyb referencí. Zdrojový soubor se nezapisoval.
6. Teprve po samostatném schválení případně provést cílený zápis s kontrolou aktuální revize/ETag a následným read-back. Tento PR takový produkční zápis ani automatickou migraci neobsahuje.

## Omezení

Oprava chrání nové akce; již uložený zápas bez cílené opravy zůstane se stávající neúplností. Chybějící data nelze obecně zaměnit za nulu. Produkční Auth/Firebase, skutečné OBS a fyzický iPhone nebyly tímto testovány. Nic nesloučeno ani nenasazeno.
