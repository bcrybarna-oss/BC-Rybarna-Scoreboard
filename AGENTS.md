# Spolupráce Dominika, Jaroslava a jejich AI

Tato pravidla platí pro každou AI pracující v tomto repozitáři.

## Povinně před každou prací

1. Přečti `REVIZE.md` (historie změn), `PROJECT_STATUS.md` (aktuální stav, verze, nasazení, otevřené body a ověření) a `PROJECT_CONTEXT.md` (architektura, funkce a bezpečnost). Nezaměňuj historický plán za aktuální stav.
2. Zkontroluj aktuální větev, `git status --short`, staged i unstaged diff a poslední místní commity. Existující necommitnuté změny patří jejich autorovi; nemaž je, nestashuj bez potřeby a nepřibírej je do svého commitu.
3. Načti nové commity z GitHubu (`git fetch origin`) a porovnej místní stav se vzdálenou cílovou větví (`git log`, `git diff`). Při nedostupném GitHubu nezapisuj do main naslepo; uveď neověřený stav.
4. Urči zadavatele: **Dominik** nebo **Jaroslav**. Autorství v dokumentaci označuje člověka, který práci zadal, nikoli AI nebo držitele GitHub účtu. Pokud to z nového zadání ani jeho výslovné návaznosti není jasné, zeptej se před zahájením úprav. Neodvozuj autora z přihlášeného účtu.

## Práce a zápis do main

- Respektuj výslovné zadání o cílové větvi. Obvykle použij větev a PR; přímý zápis do main použij, pokud jej zadavatel výslovně požaduje. Nezakládej kvůli tomu zbytečnou schvalovací smyčku.
- Před každým pushem do main znovu načti vzdálený stav a zkontroluj nové commity. Cizí práci nepřepisuj a nepoužívej force push, hard reset ani automatické řešení konfliktů ve prospěch své kopie.
- Při souběžných změnách bezpečně zapracuj vzdálené commity se zachováním cizí i vlastní práce, prohlédni výsledný diff a zopakuj ovlivněné testy. Normální push musí být fast-forward; při odmítnutí znovu načti vzdálený stav. Neřeš to force pushem.
- Udržuj malé cílené změny. Produkční Firebase nepoužívej pro testovací zápisy, mazání ani testovací účty. Testuj současný změněný kód s mockem, emulátorem nebo samostatným testovacím projektem. Snapshoty `/test/` nejsou ověřením main.
- `sources/`, pokud existuje, je pouze reference a nesmí se upravovat. Rozpracovanou modularizaci PR #6 nepřibírej bez zadání.

## Povinné verzování každého vydání

- Každá samostatně nasazovaná funkční nebo vizuální úprava aplikace MUSÍ zvýšit číslo verze. V současném schématu `v4.51.X RC` standardně zvyš poslední číslo o 1.
- Novou verzi určuj podle aktuálního vzdáleného `main` po čerstvém fetchi, nikdy podle zastaralé lokální kopie. Před sloučením ověř, zda jiná změna mezitím nevydala stejnou verzi; při souběhu nejprve bezpečně aktualizuj větev, číslo a dokumentaci a zopakuj kontroly.
- Více commitů tvořících jedno vydání nezvyšuje verzi opakovaně. Čistě dokumentační commit bez změny aplikace novou verzi nevyžaduje. Nikdy nenasazuj novou funkční ani vizuální změnu pod číslem předchozí verze.
- Aktualizuj všechna aktivní zobrazení i použití verze: hlavičku, informace o aplikaci, dialog nasazení play-off a nově vytvářená hlášení chyb. Historické revize, uložená hlášení a snapshoty se zpětně nepřečíslovávají.

## Povinná dokumentace každé nové verze

- Každá nová verze MUSÍ mít vlastní záznam v `REVIZE.md`; celou předchozí historii zachovej. Záznam obsahuje zadavatele Dominik/Jaroslav, datum, číslo verze, konkrétní změny, výsledky testů, stav nasazení a známá omezení.
- Pro automatickou kontrolu používej nadpis `## Dominik/Jaroslav – popis (v4.51.X RC)` a samostatná neprázdná pole `Zadavatel:`, `Datum:`, `Změny:`, `Testy:`, `Nasazení:`, `Omezení:`. Autor v poli Zadavatel musí být přesně Dominik nebo Jaroslav.
- Aktualizuj `PROJECT_STATUS.md` na správnou aktuální verzi a skutečný stav vydání. Při dlouhodobé změně chování, architektury nebo procesu aktualizuj také `PROJECT_CONTEXT.md`.

## Povinná kontrola před dokončením

- Ověř konzistenci všech aktivních verzí, záznam nové verze v `REVIZE.md` a správnou aktuální verzi v `PROJECT_STATUS.md`. Pokud některý bod chybí, úkol není dokončený.
- Před PR i sloučením spusť `node scripts/check-release.cjs --base origin/main` po čerstvém `git fetch origin main`. Tato kontrola porovnává celé vydání s aktuálním main, nikoli jednotlivé commity.
- Samostatný CI job **Release version and revision** musí projít. Při změně produkčních souborů aplikace vyžaduje zvýšení posledního čísla přesně o 1, kontroluje aktivní verze a povinnou dokumentaci; dokumentační pokračování stejné verze povoluje. Po pushi porovnává vydání s předchozím main. Kontrolu nevypínej ani neobcházej kvůli neúspěchu.
- Hlídají se `index.html`, `overlay.html`, `assets/`, kořenové ikony/loga, odkaz `download` a nativní zdroje/konfigurace. Při zavedení dalšího produkčního vstupu rozšiř `isApplicationPath` i testy. Snapshoty `/test/` a `/test-modular/` nejsou produkční vydání.
- CI kontrola sama nenahrazuje GitHub branch protection. Bez nastavení povinného status checku technicky nebrání přímému pushi nebo ručnímu sloučení selhávajícího PR; všechny AI ji přesto musí povinně respektovat. Bezpečnostní nastavení repozitáře neměň bez zadání.

## Evidence dokončení a ověřeného nasazení

- Zachovej historii `REVIZE.md`; přidávej záznamy pod **Dominik** nebo **Jaroslav**, vždy s datem, verzí, konkrétními změnami, výsledkem ověření a nedořešenými body. Nezamlčuj změny dokumentace a pravidel spolupráce.
- Aktualizuj `PROJECT_STATUS.md`: aktuální verze, commit nebo odkaz na vydání, stav nasazení, hotové a rozpracované úpravy, známé chyby/omezení a důležité testy. Rozlišuj **připraveno**, **otestováno**, **pushnuto / čeká na nasazení**, **nasazeno a ověřeno**. Úspěšný push sám není důkaz nasazení.
- Aktualizuj `PROJECT_CONTEXT.md`, pokud se změnila architektura, proces nebo dlouhodobé chování. Předchozí revize nepřepisuj podle nového stavu.
- Po ověřeném nasazení zapiš jeho skutečný výsledek, commit/verzi a neověřené platformy. Pokud dokumentace byla před pushem označená jako čekající, oprav ji následným dokumentačním commitem; nevydávej očekávaný úspěch za ověřený.
- Na závěr uveď verzi, commit, testy, nasazení, neověřené body a odkazy na dokumentaci, aby další člověk i AI mohli bezpečně navázat.
