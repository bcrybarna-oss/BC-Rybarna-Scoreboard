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

## Povinně během dokončení a po nasazení

- Zachovej historii `REVIZE.md`; přidávej záznamy pod **Dominik** nebo **Jaroslav**, vždy s datem, verzí, konkrétními změnami, výsledkem ověření a nedořešenými body. Nezamlčuj změny dokumentace a pravidel spolupráce.
- Aktualizuj `PROJECT_STATUS.md`: aktuální verze, commit nebo odkaz na vydání, stav nasazení, hotové a rozpracované úpravy, známé chyby/omezení a důležité testy. Rozlišuj **připraveno**, **otestováno**, **pushnuto / čeká na nasazení**, **nasazeno a ověřeno**. Úspěšný push sám není důkaz nasazení.
- Aktualizuj `PROJECT_CONTEXT.md`, pokud se změnila architektura, proces nebo dlouhodobé chování. Předchozí revize nepřepisuj podle nového stavu.
- Po ověřeném nasazení zapiš jeho skutečný výsledek, commit/verzi a neověřené platformy. Pokud dokumentace byla před pushem označená jako čekající, oprav ji následným dokumentačním commitem; nevydávej očekávaný úspěch za ověřený.
- Na závěr uveď verzi, commit, testy, nasazení, neověřené body a odkazy na dokumentaci, aby další člověk i AI mohli bezpečně navázat.
