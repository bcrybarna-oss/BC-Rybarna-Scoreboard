# Nasazení v4.51.105 RC

Zadavatel: Dominik. Datum: 29. 10. 2026. Stav: **nasazeno a v popsaném rozsahu ověřeno**, s výslovně schváleným omezením živého Auth testu. Produkční data ani účty se nemění. Etapa7 nezahájena.

## Vydání a kontroly před merge

- [Produkční aplikace](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/), skutečná verze **v4.51.105 RC**.
- [PR44](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/44), ověřená hlava `7f627796641c0cc83938fe4eb4aa6a92343c0e2b`; main po fetchi `28f45bd32483d8c8275c23d6aac14480dfc8ee6f` beze změny.
- Merge se zachováním historie **`2d64a13fb5a07e785820e20dfab974b62d72e71a`**. GitHub ověřil očekávaný head SHA; žádný force push, bypass, změna Rules nebo ochrany větve. Read-only kontrola main protection/rulesets neukázala povinnou kontrolu blokující merge. Draft byl běžně označen ready.
- [PR CI40926457118](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40926457118): release PASS, produkce258PASS/0FAIL/3SKIP, experiment28PASS/2FAIL/0SKIP. Logy jednotlivě potvrzují EXP-RECOVERY-PENDING na řádku50 a EXP-IDENTITY-STALE na155. Žádné nové selhání, experimentální core shodný s výchozím main.
- [Pages40928461240](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40928461240): automatický build/deploy/report úspěšný. Žádný ruční rerun.
- [Main CI40928462949](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40928462949): release PASS, produkce258PASS/0FAIL/3SKIP ze261; experiment28PASS/2FAIL/0SKIP ze30, stejné konkrétní vady. **Celý workflow FAILURE**, nikoli plně zelené CI; selhání nejsou ignorována.

## Skutečná veřejná produkce — bez přihlášení

Dvacet souborů HTTP200, včetně index.html, overlay.html a pěti modulů, má přesnou SHA256 shodu s merge. HTML/overlay/moduly byly porovnány i přes jedinečné URL s no-cache; nejde jen o zjištění úspěšného deploye. SHA256 indexu `89c9efb1538752bd3cd38d77c93749d667b1a3b3877471761cd686a1d18848f7` odpovídá předem ověřenému kandidátu.

Chrome desktop1440×1000 a mobilní viewport390×844: viditelná verze105, všech pět modulů načteno jednou; žádný test-modular/pool-core script, fallback ani JS/console error. Dostupná navigace home/results/support/reports/tournament/FederalCup; formulář běžného turnaje zachovává samostatné8-ball/race3 a10-ball/race7 pro skupiny/play-off. FC21položek, společné A2 tlačítko/dialog. Pět vstupů/odchodů na viewport: viewer interval/listener1/1 během a0/0po odchodu. Reset hesla pouze lokální validace prázdného e-mailu, bez odesílání.

Veřejný browser neměl přihlášenou relaci; Auth/Firebase a všechny zápisové požadavky byly preventivně blokované. Skutečné pokusy o tyto požadavky0. Toto není ověření živého přihlášeného zápasu.

## Izolovaně na skutečně publikovaném kódu

Stažené HTML a všech pět modulů byly před testem ověřeny SHA256 a připojeny read-only overlayem v testovacím procesu. Aplikace na disku ani na webu se kvůli testům neupravuje. Síť v browser scénářích zachycuje mock. Soukromé exporty jsou izolované a nemění se.

- **Opožděný ruční i automatický login:** skutečné signIn/refresh/accountLookup/login/resume funkce s mockovanými odpověďmi. Během čekání zůstane pointer/recovery/detailedPlay beze změny, editovatelný match odpojen. Viditelné POKRAČOVAT vlastníka obnoví skóre3:2, dva kanonické strky, události/statistiky/undo a nastavení9-ball/full/race9/clock37+61/handicap/stream. Hodiny stojí. StaleUID bezAuth i jiný účet odmítnuty.
- **Offline a obnova:** skutečné odhlášení, ownerless offline zápas, skóre1:0, reload a další bod2:0; žádné další Auth požadavky. Samostatný browser test ověřil po obnově skórování→UNDO, paused clock a zachování disku.
- **FederalCup evidence:** Team stabilní hráči/racky, Doubles bez vymyšleného osobního střelce, canonical reference-only evidence, real mock login/reload/resume, idempotentní dokončení a cloudový PUT/GET PASS.
- **Turnaje101:** běžný i historický, desktop/mobil, překročená kvóta, viditelné varování, zachování přípravy v paměti, ruční nasazení, reload a cloudmock, skutečné zápasy skupin8-ball3/play-off10-ball7 i nezměněný FC PASS.
- **Reporty/exporty:** skutečné A1/A2/B PNG1920×1080 a PDF16:9, desktop/mobil/zoom; kontrolní Singles3 SK93%/14 a CZ95%/38, bez hvězdiček/starých popisků, Resafe a ostré vlajky PASS. Reálná dvoulistová XLSX stažení Singles/Doubles/Team na desktopu/mobilu, názvy, scope tlačítka, duplicitní export guard a chyba/retry PASS.
- **Node nad publikovanými soubory:** se soukromými kontrolními zálohami291testů,289PASS/2experimentálníFAIL/0SKIP, exit1. Zahrnuje správné statistiky opraveného Doubles9, osobníTeam a předchozí moduly. Výsledek nezakrývá experimentální vady.
- **Doplňkový stream test:** původní browser skript dvakrát selhal na okamžitém hledání první SOON publikace v rozšířeném režimu; nekontroluje dokončení asynchronně plánovaného zápisu. Stejný skript na publikované104 prošel. StartMatch/buildStreamState/sendStreamState/scheduleStreamState/setStreamMode/ensureCloudToken jsou byteově shodné s baseline. Diagnostické opakování na105 přidalo pouze čekání na skutečný mockovaný zápis, maximálně8s, a ponechalo všechny původní aserce. Jednoduchý i rozšířený režim, ON/OFF, skutečný overlay, všechny čtyři režimy, desktop/mobil/orientace/320px a reload/resume pak PASS,0pageerrors/0produkčníchzápisů. Původní dvě selhání se nemažou ani nevydávají za úspěch; časovací mezera browser testu zůstává následný testovací úkol. Aplikace ani test v repozitáři se kvůli tomu nemění.

Při prvním lokálním běhu po Windows checkoutu navíc selhala inicializace staršího password-reset testu: hledá pouze LF a checkout má CRLF. Stejnou extrakční chybu jsme doložili na starém main28f45bd i novém merge. Test se neupravoval ani nevypínal; nad přesnými publikovanými LF bytes projde a main CI také PASS. Nejde o třetí ignorovanou aplikační regresi, ale zaznamenané omezení portability lokálního testu.

[Strojová evidence](deployment-v4.51.105-verification.json). Pracovní logy a screenshoty: output/deployment105, bez soukromých dat ve veřejném PR. Předmerge experimentální turnajový fallback4/4PASS je doložen v [kontrole identity](v4.51.105-identity-review.md); automatický fallback není produkční funkce.

## Omezení a návrat bez vracení dat

**Živý Auth test nebyl proveden:** není autorizovaný samostatný Auth test projekt/emulátor a starý preview používá produkční Auth. Neověřeno vydání/obnova skutečných tokenů, reálné UID/profil/role a Rules mezi dvěma testovacími účty. Také neověřen fyzický iPhone/Safari, OBS a skutečná soukromá produkční relace. Mockovaný emailVerified není živá verifikace. Globální startup Auth může vydat více refresh požadavků; v105 nebyl sjednocován, jeho původní těla jsou shodná s baseline. Limity reportuB a archivnícache trvají.

Nová blokující aplikační chyba nebyla nalezena a návrat není potřeba. Při nutnosti rollbacku: čerstvý fetch main, samostatná větev, standardní `git revert -m 1 2d64a13fb5a07e785820e20dfab974b62d72e71a`, prohlédnutí diffu, nové číslo vydání dle aktuálního main, revize/status, release a regresní testy, PR a běžné Pages nasazení. Žádný reset/force push, import zálohy, migrace ani změna Firebase dat. **Úplný revert vrací také doloženou bezpečnostní vadu pending/stale identity**: pokud je problém jen v testové infrastruktuře, revertovat pouze její změny a zachovat produkční guardfix917e310; případný úplný návrat vyžaduje výslovné posouzení této regrese. Čistě dokumentační pokračování nemění verzi ani aplikační bytes.
