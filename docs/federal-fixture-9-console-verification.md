# Funkční ověření jednorázového pomocníka #9

Dominik, 24. 10. 2026. **15/15 izolovaných browserových scénářů PASS. Produkce nebyla kontaktována ani změněna.**

Testuje se přímo celý soubor `scripts/federal-fixture-9-console.js`, bez úprav jeho payloadu, auth funkcí, výpočtů či kontrol. Kontrolní SHA256 pomocníka: `5bb814728874343d8538c3962ac750cef7267d7a98c2cdd0b406262f9059c384`.

Test `tests/federal-fixture-9-console-browser.cjs` používá aktuální index.html v nové izolované instanci Chrome. Všechny požadavky se zachycují; cesta skutečné Firebase je plně mockovaná, třetí strany jsou blokované a service worker vypnutý. Pouze testovací hook nastavuje mockovaného administrátora a vypíná nesouvisející časovače/presence. Původní aplikační funkce pro session, URL, roli, výpočty a debuggerový vstup nejsou nahrazené. Server respektuje If-Match, odmítá konflikt/odebrané oprávnění a simuluje ztracenou odpověď po skutečném uložení do paměťové databáze.

`tests/helpers/firebase-json.cjs` modeluje uložení do RTDB a REST JSON: odstranění null/prázdných objektů a polí, návrat hustých číselných potomků jako pole včetně vnitřních null mezer, řídké číselné klíče jako objekt. Samostatně ověřeno, že `balls: []` zmizí, ale `pottedCount: 0` zůstává. U schváleného skutečného zápasu tento průchod nemění žádná data ani hash.

## Scénáře

| Test | Výsledek |
|---|---|
| prepare: pouze GET, skutečně stažený JSON odpovídá celému původnímu zápasu/ETag a přesné schválené vazbě | PASS, 0 PUT |
| commit: mění výhradně federalCupLink; ostatní pole shodná, zdroj reportu #9 a týmové skóre 7:2 | PASS, 1 PUT |
| rollback: vlastní stažená záloha, podmíněný PUT vrací přesný původní objekt a týmové skóre 6:2 | PASS |
| změna zápasu před prepare / mezi prepare a commit | PASS, oba scénáře 0 PUT |
| změna nominace před prepare / mezi prepare a commit | PASS, oba scénáře 0 PUT |
| cizí vazba na #9 (i playing) před prepare / mezi prepare a commit | PASS, oba scénáře 0 PUT |
| skutečná změna cílového objektu těsně při PUT → HTTP412 | PASS, 1 odmítnutý pokus, 0 uplatněných zápisů, další commit zablokován |
| odpověď po úspěšném PUT v mocku ztracena | PASS, commit hlásí nejistotu, verify prokáže provedenou změnu, bez druhého PUT |
| verify v původním stavu | PASS, jednoznačně hlásí stav bez vazby a 6:2, 0 PUT |
| pozdější změna zápasu před prepareRollback | PASS, návrat se odmítne a pozdější data se zachovají |
| pozdější změna zápasu mezi prepareRollback a rollback | PASS, návrat se odmítne bez dalšího PUT |
| chybějící ETag / odebraná aplikační role | PASS, 0 PUT |
| serverové odmítnutí 403 i při mockované klientské admin roli | PASS, žádné obcházení ani opakování, 0 uplatněných zápisů |

Tabulka sdružuje některé testy; běh má 15 samostatně pojmenovaných scénářů. Úspěšný commit a rollback tvoří jeden scénář.

V každé nové testovací relaci navíc: instalace mimo uzavřený aplikační scope odmítnuta; Chrome Console Utilities `debug(window.getModernDashboardSnapshot)` skutečně pozastaví původní funkci. V jejím call frame jsou dostupné všechny čtyři požadované soukromé funkce. Vloží se přesný celý helper, potom `undebug()` a pokračování. Instalace má **0 síťových požadavků a 0 zápisů**. Po obnovení běhu uchované reference fungují. Logy a stažené zálohy neobsahují mockovaný token. Žádný požadavek pomocníka nezapisuje mimo cílový matchId.

## Doložení schválených dat a hashů

Zdroj je nezměněný soukromý export `BC_Rybarna_Scoreboard_Backup_2026-10-24 (1).json`, SHA256 `0aa18c9b610709025150ef55fd6fd177f1972612d72703635cbdd74e8b52f7eb`. Vybraný matchId `3d4c35e6-e336-49d5-a9b3-9955cec59c3d`. Úplný export a stažené soukromé zálohy nejsou commitovány.

| Kontrola | SHA256 |
|---|---|
| Původní záznam, kanonický i původní schválený JSON | `7195a1c5562cfd1aac3e913170a412e6607aa6bd4c229a17a599d79b15876f6e` |
| Záznam po doplnění vazby, kanonický JSON používaný helperem | `f9a9e3ca955488d9b87afe932564a0563975c2cb9660067435c58c28fbc36f78` |
| Záznam po doplnění vazby, původní pořadí JSON klíčů ve schváleném návrhu | `b550355ae3585310bb9730ee926bed1b20ce74192791037be40750eaec91dd23` |
| Samotná schválená vazba, kanonický JSON | `c4c4805fe2ec98b23dbfc7b0e0276415c66f66d4bdf7fc09093a08c9663f4d3e` |

Vazba vložená v helperu je hlubokou rovností shodná s `docs/federal-fixture-9-link-proposal.json → patch.federalCupLink`. Oba předchozí otisky návrhu byly rovněž znovu ověřeny; rozdíl mezi dvěma otisky výsledného objektu je pouze kanonické řazení JSON klíčů. Není to jiná změna ani jiný zápas. Firebase serializace dává stále tytéž kanonické otisky. Soubor původního exportu má po testech stejný SHA.

Strojové výsledky bez soukromých záznamů: [browser verification](federal-fixture-9-console-verification.json), [hash verification](federal-fixture-9-console-hashes.json). Soukromé reálně stažené zálohy z mocku jsou pouze lokálně v `output/fixture-9-console-tests/`.

## Omezení a ruční použití

Testovací mock nenahrazuje reálnou produkční Auth/Firebase autorizaci a nepotvrzuje přítomnost ETag v konkrétním skutečném připojení. Pokud chybí oprávnění/ETag nebo se skutečný záznam liší, helper zastaví. Atomická ochrana stále pokrývá jen cílový zápas, ne společně konfiguraci a jiné zápasy. Před ručním PUT zajisti klid ostatních administrátorů; nelze jej vydávat za databázový zámek. Žádné Rules ani oprávnění nebyly změněny.

[Ruční postup a přesný kód](federal-fixture-9-manual-console.md). Aplikace a verze v4.51.95 RC jsou beze změny, PR34 se neslučuje ani nenasazuje. Předchozí známá dvě selhání Node CI se tímto testem neopravují ani neskrývají; tato cílená browserová sada prošla celá.
