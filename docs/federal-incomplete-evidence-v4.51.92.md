# Diagnostika neúplné evidence a prevence neznámého rychlého dokončení

## Upřesnění po zadání pravidla MISS (23. 10. 2026)

Níže je zachován historický výsledek nad nezměněným exportem. Dřívější závěr, že odvozená koule 6 před MISS musí mít neznámé pokusy, byl překonán výslovným pravidlem zadavatele: bezpečný odvod před MISS znamená jednu kouli, jeden pokus a jeden úspěšný strk. Původní export opravdu obsahuje unknown hodnoty, ale nové zadávání je již nemá vytvářet v tomto přesně vymezeném průchodu. RESAFE se známou nulou má explicitní pottedCount: 0. Podrobnosti, testy a oddělený návrh nápravy uloženého zápasu: [aktuální oprava](federal-zero-and-miss-v4.51.92.md). Žádná migrace ani změna původního exportu neproběhla.


Zadavatel: **Dominik**, 23. 10. 2026. Kandidát **v4.51.92 RC**, větev `fix/federal-unknown-table-quick-finish` z main `0db27bb`. **Neslučovat a nenasazovat.** Produkce zůstává91.

## Aktualizace po obdržení skutečného exportu

Export a přesný matchId byly následně dodány a beze změn přečteny. [Konkrétní diagnóza Team1:5](federal-team-1-evidence-diagnosis.md) prokazuje dvě odlišné příčiny: legitimní unknown pokusy odvozené6 v racku1 a ztracené doložené prázdné balls[] u RESAFE v racku3. Žádný rack_completion_unknown v tomto zápasu není. PR #30 tyto dvě příčiny zatím nemění; neprovádí se další funkční změna, merge ani nasazení.

Následuje zachovaná historická analýza připravená před dostupností exportu:

## Co je a není doložené

Skutečný nově zadaný Team #1, Slovensko1:5Česko, nebyl přečten: není přihlášená dostupná browserová relace ani Firebase konektor; zadavatel nemá zatím JSON ani matchId. **Přesná příčina jeho 36/37* a38* není potvrzená.** Nelze vypsat jeho coverage/reasons/components ani problematické racky bez záznamu. Žádná syntetická data níže nejsou označena za skutečný zápas a žádná produkční data nebyla zapisována ani měněna.

Nové zjištění zadavatele je respektováno jako kontrola: **samotná ČISTÁ HRA není prokázaná příčina**. Automaticky přehrán Singles4:5 se známou jednou koulí z každého rozstřelu, jedna strana postupnými skutečnými POT akcemi, druhá ČISTOU HROU. Výsledky: čisté hry4:5, potopení100 %, rozstřel100 %, průměr1,0, útok/potopené koule complete. Stejný průběh v Team, se skutečným výběrem hráčů pro každý rack, také complete v A1, ročním A2 a osobním B. Kontrola obsahuje reload po čtvrtém racku i JSON/Firebase array→object převod kanonických záznamů/racků bez změny výsledku.

**Samotný rozdíl 38 koulí proti36 úspěšným strkům není důkaz chyby**: multipot je jeden strk s více koulemi; potopení při úniku nebo odvozené poty také nemají stejný význam jako úspěšné potápěcí strky. Hvězdičku určují reasons, nikoli tato nerovnost.

## Tok dat a podmínky hvězdičky

1. `finishExactBreakBalls` / `finishBreakPotCount`, POT/MISS/push out a rychlé dokončení vytvářejí záznamy přes `recordDetailedShot` → `federalShotEvidence`: id, rack, side, actor, intent, potsEvidence a pokusy/úspěšné strky.
2. `recordFederalRackEvidence` při ukončení racku ukládá odkazy `shotIds` na `detailedPlay.records`. Team přidává nominované hráče, rozdílové rackové statistiky a kompatibilní kopii shots. **Kopie shots se znovu nesčítá.**
3. `snapshot`/`restoreSnapshot` zahrnují detailedPlay i federalTeam; `autosaveCurrent` ukládá stav zařízení, `saveSecureMatch` serializuje celý zápas pomocí JSON a PUT do vlastního uloženého záznamu. `loadSecureMatches` načítá data.matches. Pro cloudové načítání nebylo použito skutečné přihlášení; ověřena pouze izolovaná serializace a mock.
4. `federalCalculateMatch` počítá týmové strany přímo z kanonických záznamů podle side. Nejde o součet znovu přičtených osobních metrik. `federalStatsShotIssues` kontroluje chybějící/duplicitní/konfliktní reference, rack/match a aktéra. Osobní Team statistiky vybírají racky daného hráče a zachovávají partial/reasons; `federalMergeMetrics` přenáší neúplnost do roční agregace.
5. `federalReportData` vybere dokončené záznamy daného ročníku/fixture; při více záznamech rozhoduje datum ukončení a id, nikoli samotné skóre. `federalReportMetric` dává hvězdičku výhradně pro coverage partial; complete0/0 je bez hvězdičky a unknown je —. PNG/PDF rasterizují tutéž šablonu, nezávisle nepřepočítávají coverage.

| Důvod | Význam a původ | Závěr |
| --- | --- | --- |
| unknown_attempts / unknown_intent | Např. `inferred_pots`, source inning_end, po MISS na vyšší kouli: koule jsou odvozené, počet předchozích skutečných strků a jejich intent chybí. | Správná neúplnost; nesmí se odhadnout 1koule=1strk pro už nezadanou minulost. |
| unknown_pots | Neznámá evidence potů, také push_out, jehož záznam nezaručuje počet potopených koulí. | Je třeba skutečný záznam; nelze přepsat na complete jen proto, že uživatel očekává nulu. |
| rack_completion_unknown | Rychlé dokončení při tableKnownfalse/malformovaném seznamu dosud vyhrálo rack a uložilo inferred_pots s null pokusy. | Potvrzená chyba toku: uživatel nebyl včas zastaven. Prevence v kandidátu92. |
| unassigned_correction | Ruční oprava stolu bez doložených předchozích strků; také oprava hráče na tahu. | Záměrná neúplnost. Oprava aktuálního stolu nedoplňuje chybějící minulost. |
| missing/duplicate/conflicting_shot_reference, shot_actor_reference_conflict | Kanonické reference a identita racku/strku/aktéra nesouhlasí. | Ověřit pomocí exportu; syntetické integrity testy zachovány. |
| partial_detailed_history, legacy_coverage, score_correction_*, unfinished_team_match, incomplete_attribution | Neúplná historie, servisní zásah nebo nedokončený/nepřiřazený osobní Team rozsah. | Neodstraňovat kosmeticky; konkrétní důvod vypíše diagnostika. |

Pokud je SK opravdu complete a pouze CZ partial, samotné globální partial_detailed_history či unassigned_correction nejsou dostatečným vysvětlením: u stejného rozsahu by poznamenaly obě strany. Je třeba hledat i české kanonické záznamy, jejich intent/potsEvidence a reference. To **není důkaz konkrétní CZ akce bez exportu**.

### Izolovaná diagnostika MISS

[Strojový výstup](diagnostics/federal-92-synthetic-miss.json) je výslovně syntetický Team: dry break, MISS na3, odvozené1 a2. CZ:
- pottingSuccess: numerator0, denominator1, countnull, coverage partial, reasons unknown_attempts/unknown_intent, components{}.
- pottedBalls: count2, coverage complete, reasons[], components{explicit:0,derived:2}.
- Problematický record: rack1, kind inferred_pots, source inning_end, intent unknown, potsEvidence derived, pottingAttempts null, successfulPottingStrokes null; následující MISS je jeden neúspěšný pokus. **Toto samo nevysvětluje obě hvězdičky skutečného zápasu.**

Současné přesné UI verze91 již obvykle vyžaduje čísla rozstřelu. Existence početní funkce sama nedokazuje, že ji zadavatel v novém Team zápasu použil; jde o uzavření nehlídané početní/obnovené cesty. Rozdíl je pro diagnózu zásadní.

## Cílená oprava

- Početní rozstřel s n>0 bez čísel v přesném9/10ball počítadle zůstane nepotvrzený a vyžádá přesný výběr čísel. Nevytvoří break record ani neznámý stav. Běžný přesný výběr a nula se nemění.
- Explicitně vybrané koule z nového rozstřelu bezpečně určují zbývající stůl i při obnovené starší struktuře bez tableKnown. To nedoplňuje předchozí strky ani nenastavuje coveragecomplete.
- DOHRÁT, ČISTÁ HRA i DOHRÁVKA kontrolují aktuální stůl **před** undo snapshotem, statistickou evidencí a výhrou racku. Neznámý/neplatný stav otevře existující opravu stolu s vysvětlením; akce se automaticky neopakuje. Zrušení nic nepřipíše.
- Panel neukazuje neověřená čísla jako jistý stůl a DOHRÁT výslovně žádá doplnění. Po potvrzení uživatel znovu zvolí dokončení. Nové strky jsou přesné; minulá chybějící evidence si zachová partial.
- Výpočetní API, 13 metrik, agregace, branding, exportní design, stream a Firebase Rules beze změny. Žádná migrace uloženého zápasu1:5.

## Jak získat skutečný záznam nejjednodušeji

1. Na **stejném zařízení a v té relaci**, kde je nový zápas1:5 uložen a vidět, otevři **Administrace** (dlaždice na úvodní obrazovce nebo Admin v navigaci, pouze je-li účet oprávněný).
2. V části **Záloha dat** klikni **EXPORT DAT (JSON)**. Obslužný kód pouze stáhne lokální `data` do `BC_Rybarna_Scoreboard_Backup_YYYY-MM-DD.json`; tato exportní akce nevolá Firebase a nic neimportuje/nepřepisuje.
3. Poskytni místní cestu k tomuto souboru. Z exportu lze nejprve vypsat kandidáty Team2026/#1 včetně id, skóre, startedAt/endedAt a status, poté potvrdit ten správný. Samotné skóre není identifikátor. Pokud nemáš přístup k Administraci, požádej oprávněného správce se skutečným záznamem o stejný export. **Není nutné sdílet token ani heslo.** Záloha může obsahovat i ostatní data; pro diagnostiku stačí příslušný objekt zápasu z matches.

Offline nástroj v tomto PR:

```text
node scripts/diagnose-federal-evidence.cjs C:/cesta/backup.json
node scripts/diagnose-federal-evidence.cjs C:/cesta/backup.json PRESNE_MATCH_ID
```

První příkaz jen vypíše kandidáty, druhý vyžaduje právě jeden přesný matchId a ověří ročník/fixture/Team. Vrací obě metriky včetně components/reasons, záznamy s rack/source/entry/intent/potsEvidence/pokusy, aktéra a chybějící reference. Používá přímo současné výpočetní funkce z index.html, nemá síť ani zápisy a nevypisuje celý backup/auth. Jednotkový test ověřuje neúnik přidaného tokenu a neměnnost vstupu. Jestli export neobsahuje detailedPlay skutečného zápasu, z pouhého výsledku diagnózu nevyrobí.

## Rozlišující další ruční kontrola

Nejvyšší hodnotu má export již existujícího1:5, ne znovuzadání. Pro případný další test v oddělené testovací kopii:
- **A – kontrola Team versus Singles:** při každém rozstřelu vybrat přesné číslo jedné koule; bez MISS, push out a oprav; na jedné straně každou kouli POT, na druhé ČISTÁ HRA. Totéž ve stejném pořadí Team hráčů. Očekává se complete; automaticky pokryto i reloadem.
- **B – rozlišení odvozené historie:** po dry breaku neuvádět dřívější poty jednotlivě a zadat MISS na3. Očekává se odvozený počet2, ale neznámé pokusy a partial útok. Tím se nesimuluje plně evidovaný zápas.
- **C – push out / oprava:** přidat vždy jen tuto jednu odlišnost a porovnat reasons před/po. Nečekat odstranění legitimního unknown_pots či unassigned_correction.

## Testy a předání

Nový browser test selže na původním main při početním rozstřelu bez čísel, po opravě projde. Obsahuje známé/neznámé rozstřely, všechny tři rychlé akce, Singles/Doubles/Team, kontrolu4:5, per-rack Team identity/reference, osobní/roční metriky, cancel, UNDO a skutečný reload. Starý quick test nově očekává zablokování neznámého dokončení, nikoli tichou částečnou výhru; interní unit test bezpečného unknown helperu zachován. Ve stávající FC regresi početní testovací zkratka nahrazena skutečným přesným výběrem koule; všechny původní sportovní assertiony zachovány.

A1/A2/B skutečné PNG/PDF exporty kontrolují úplnou Team4:5 i ručně opravený unknown stav, který musí zůstat partial. Node190/192 pouze známé dvě preview-match-reload-recovery chyby; CI není plně zelené. Quick-finish, Federal Cup, detailed-counter, report a release-version browser PASS. Release gate proti čerstvému main0db27bb a diff --check PASS; [CI2438aec](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39958466520): Release version and revision **success**, Node **190/192 failure**. Log potvrzuje pouze známé preview-match-reload-recovery.test.cjs:50,106 vtest-modular, žádná nová regrese. CI není plně zelené.

Skutečné syntetické PNG: [Team4:5 complete](screenshots/federal-92-A1-known.png), [opravený unknown stav s pravdivým partial](screenshots/federal-92-A1-corrected-partial.png). Nejde o skutečný zápas1:5.

Kód **2438aec009ba91d3ee67c32ba368ce57f61cee7f**, [draft PR #30](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/30). Následná dokumentace/ochrana chyby načtení JSON nemění aplikaci. Parser při vadném vstupu nevypisuje žádný jeho obsah. Čeká skutečný export1:5; nic nesloučeno ani nenasazeno.
