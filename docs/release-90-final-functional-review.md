# Poslední funkční revize v4.51.90 RC

Zadavatel **Dominik**, 23. 10. 2026. Stejný PR #28 / feature/federal-reports-stage-3a nad 6a8c57f; main f6c3e0f / produkce v4.51.89 RC. Otestováno a pushnuto jako **ded86bc76b4f69bb4eaf6a3d7e9e92c23961ca68**; následný dokumentační commit nemění otestované HTML. **Neslučovat a nenasazovat.** Cizí lokální kopie screenshotů i output/tmp zachovány.

## Stream před startem a při obnově

Viditelná volba v běžném i kompaktním formuláři: Bez streamu (výchozí) / Použít stream overlay. Bez streamu se adresa ani panel nezobrazují a OBS cesta stream/users nedostává publikaci. Běžné ukládání, Livescore a cloudová záloha nejsou tímto vypnuty. Při zapnutí první OBS payload obsahuje soon – BRZY ZAČÍNÁME, změnu na LIVE řídí obsluha. SessionStorage zachovává pouze rozpracovanou volbu v kartě; po úspěšném startu se zahodí, další nový zápas má opět Bez streamu. Uložený zápas má vlastní streamEnabled a streamMode, proto se při resume neřídí novou volbou formuláře.

V zápasu není volba zapnout/vypnout stream. Celý panel režimů/URL/kopírování leží za herním ovládáním, UNDO a tempem/rozstřelem, před událostmi. Izolace UID+matchId, synchronizace a OBS URL zachovány. Staré uložené true/false respektovány; chybějící příznak stream neaktivuje a původní stream bez režimu nadále používá původní LIVE fallback.

## Nasazování

[Textový přepis pravidel dodaných zadavatelem](federal-cup-2026-lineup-rules.md), nikoli originální PDF. Stejná dvojice v #2/#4/#7/#9/#12/#14 je zakázána samostatně na obou stranách i při opačném pořadí. Porovnávána participant ID; rename/reorder nezmění osoby. Blokové skupiny 1–4 zachovány. UI vypisuje všechny nalezené důvody obou reprezentací. HRÁT PŘES POČÍTADLO validuje znovu; konečný start navíc ověřuje aktuální nominace oproti připravenému snapshotu, takže ani mezitím změněné platné nasazení nespustí staré osoby.

## Skutečné screenshoty se syntetickými daty

| Pohled | Screenshot |
| --- | --- |
| Nastavení zápasu, výchozí Bez streamu | [Celá obrazovka](screenshots/stream-setup-screen.png) / [volba](screenshots/stream-setup-off.png) |
| Použít stream overlay | [Zapnuto před startem](screenshots/stream-setup-on.png) |
| Mobilní jednoduché počítadlo, panel pod akcemi | [Simple](screenshots/stream-counter-simple.png) |
| Mobilní rozšířené počítadlo, panel pod akcemi | [Full](screenshots/stream-counter-full.png) |
| Zakázaná opačná dvojice v obou reprezentacích | [Chyby obou týmů](screenshots/federal-lineup-both-teams.png) |

## Ověření

- `node --test tests/federal-lineup-rules.test.cjs`: 5 PASS, 60 kombinací opakovaných dvojic (v každé ověřeny oba postižené zápasy), oba směry/strany, reference všech 21 fixture, všechny bloky, stabilní ID po rename/reorder/JSON reloadu.
- `node tests/federal-lineup-browser.cjs`: reálná UI validace, obě reprezentace současně, všechny Doubles, stale button i změněný připravený snapshot, skutečný rename/move/save/CAS, reload a opětovné načtení z izolovaného backendu PASS.
- `node tests/stream-controls-browser.cjs`: simple/full, výchozí a rozpracovaná volba, žádné OBS publikace bez streamu při bodování/UNDO/reloadu, SOON jako první payload, čtyři režimy přes skutečný overlay, obnova obou voleb, legacy, desktop/mobil/orientace/320px, pořadí všech ovladačů PASS. Screenshoty přes STREAM_SCREENSHOT_DIR.
- Federal Cup, detailed-counter, stream-isolation, stream-lag, release-version, 7/7 federal-evidence-conflicts a report/UI browser PASS. Izolace s dvěma vydavateli, >21 s výpadek a stejné UID/jiný matchId zachována.
- Plná Node sada **184/186**: pouze známá selhání preview-match-reload-recovery.test.cjs:50,106 nad test-modular, nezměněna a neskryta. CI není plně zelené.
- Skutečné PNG/PDF všech reportů desktop/mobil DPR3 PASS; PNG bajtově shodné se schválenými. PDF jedna strana 1440×810 pt a přesné pixely vloženého PNG 1920×1080. Výpočty i report/export kód bajtově shodné s 6a8c57f. Chyby/cancel/duplicitní exporty stále chráněny.
- Release gate po čerstvém fetchi main f6c3e0f a diff --check PASS. [CI ded86bc](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39916686239): Release version and revision **success**, Node **184/186 failure**. Log ověřen: jen známá selhání preview-match-reload-recovery.test.cjs:50,106 v test-modular; žádná nová regrese. CI není plně zelené. Produkční síť se nepoužívá, mock backend zachycuje veškeré požadavky.

Fyzické telefony/iOS, skutečné OBS, produkční Auth/Firebase Rules a zátěž nebyly testovány. Nová volba není změna oprávnění; Rules a autorizační mechanismus se nemění. Originální PDF nebylo dostupné; kontrola pravidel vychází z výslovného přepisu zadavatele. Čeká finální kontrola a souhlas s vydáním.
