# Revize aplikace Poolčítadlo

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
