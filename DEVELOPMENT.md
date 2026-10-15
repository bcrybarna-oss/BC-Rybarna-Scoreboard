# Vývoj Poolčítadla (základ v4.51.75)

Tato větev je **bezpečná modularizace** původní aplikace. Dokud nebude ověřená v prohlížeči a při práci se skutečnými zápasy, **neslučovat do `main`**.

## Struktura

- `index.html` – stránky a pořadí načítání CSS/JS. **Neměnit pořadí skriptů a stylů bez testu.**
- `assets/css/` – původní styly rozdělené podle obrazovek, včetně přepisů světlého režimu.
- `assets/js/theme.js` – přepínač vzhledu.
- `assets/js/pool-core.js` – **generovaný** hlavní skript; úpravy dělat ve `src/core/`, ne zde.
- `assets/js/dashboard.js`, `tournament-community.js`, `player-picker.js` aj. – navazující části UI.
- `src/core/*.part.js` – 10 částí původního jádra **v původním pořadí**.
- `scripts/build-core.cjs` – bezeztrátové sestavení částí do jediného skriptu.
- `tests/` – regresní testy a přesná kontrola shody se zdrojem v4.51.75.

## Postup při úpravě

1. Pracovat na samostatné větvi, nikdy rovnou na ostrém `main`.
2. U logiky zápasů, turnajů, hráčů apod. měnit odpovídající soubor `src/core/*.part.js`.
3. Spustit `npm run build:core`. Tím se aktualizuje `assets/js/pool-core.js`.
4. Spustit `npm test` a prověřit případný neúspěch.
5. Ručně vyzkoušet aplikaci z lokálního HTTP serveru, **ne jen otevřením `index.html` jako souboru**. Například `python -m http.server 8000` a pak `http://localhost:8000/`.
6. Nechat změny zkontrolovat v pull requestu a ověřit akce GitHub.
7. Teprve po ověření přenést do produkce.

`npm run check:core` ověřuje, že vygenerovaný skript souhlasí se zdrojovými částmi. Zdrojové `*.part.js` **nejsou samostatné ES moduly**: tvoří společnou lexikální oblast. Nesmějí se prostě načítat jako samostatné značky `<script>`. Při dalším refaktoringu se hranice i počty částí mohou upravit, ale výsledné sestavení musí zůstat validní.

## Co ověřují automatické testy

- Zpětně složené HTML, CSS a JS mají **přesně** původní Git blob SHA-1 `69e860aca3aeada86227e68bfecb0733e6db5233`.
- Kontroluje se synchronizace generovaného jádra a syntaxe skriptů.
- Stávající smoke/behaviorální testy kontrolují identitu hráčů, Ghost režimy, turnaje, historii skóre vítěze na stole, oprávnění admina a obnovu rozehraných zápasů.

**Pozor:** Kontrola původního SHA-1 je záměrný dočasný zámek této bezeztrátové migrace. Při pozdějších funkčních úpravách se musí nahradit novým schváleným referenčním stavem; nesmí se tiše odstranit. Automatické testy nenahrazují testování Firebase pravidel, přihlášení, mobilní dotykové obsluhy, Livescore ani streamování.

## Data a bezpečnost

Refaktoring nemění databázové cesty, klíče `localStorage`, konfiguraci Firebase ani strukturu uložených zápasů. **Nevymazávat lokální data ani cloudové záznamy** jen kvůli migraci kódu. Před produkční aktualizací je vhodná záloha databáze a manuální test obnovení rozehraného zápasu.
