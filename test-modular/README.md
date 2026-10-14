# Poolčítadlo TEST MODULAR – v4.51.75 RC

Odkaz po publikaci na hlavní větvi GitHub Pages:

https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/test-modular/

## Co se ověřuje

Tento samostatný náhled používá **modularizovanou v4.51.75** ze zdrojové větve `refactor/v4.51.75-modular-assets-20261014`. CSS a JavaScript se načítají ze samostatných souborů `assets/` stejně jako ve vyvíjené verzi.

## Přihlášení

Na testovacím webu klikni na **PŘIHLÁSIT SE** a použij **svůj existující e-mail a heslo z Poolčítadla**.
Ověření identity provádí skutečná **Firebase Authentication**; účet musí mít ověřenou e-mailovou adresu.
**Registrace nových účtů i odesílání ověřovacích e-mailů jsou v testu vypnuté**, protože by se jinak dotkly ostré Firebase Authentication.
Přihlášení a role se testují proti oddělené **lokální imitaci datové části**, nikoli proti produkční databázi.

Po přihlášení můžeš ve žlutém horním pruhu přepínat simulovanou roli **HRÁČ / CLUB ADMIN / ADMIN**. Přepnutí mění jen testovací záznam v tomto prohlížeči; skutečná role ani účet Firebase se nemění. Práva a Firebase Rules tím neotestuješ, ale můžeš ověřit zobrazení a ovládání jednotlivých rolí.

## Data – důležité bezpečnostní omezení

- CSP dovoluje spojení **pouze** na `identitytoolkit.googleapis.com` a `securetoken.googleapis.com` kvůli přihlášení. Připojení na produkční databázi zakazuje.
- Používá se veřejná konfigurace skutečné Firebase Authentication. Databázová URL ale vede na `poolcitalo-test.invalid` a její požadavky zpracovává **lokální simulátor v prohlížeči**, bez přenosu dat na server.
- Test vlastní datový prostor `localStorage` a `sessionStorage` s prefixem `poolcitadlo_test_modular_v45175__`; produkční lokální záznamy se nemění.
- Při prvním otevření vznikne 5 ukázkových hráčů, z toho dva se stejným jménem a různými kluby.
- Data lze z tohoto testu odstranit tlačítkem **VYMAZAT TESTOVACÍ DATA**.
- **Přihlášení skutečným existujícím účtem lze ověřit.** Skutečná práva v databázi, online výzvy mezi zařízeními a cloudovou synchronizaci ale nelze ověřit. Pro ně je nutné samostatné testovací Firebase prostředí.

## Doporučené kroky

1. Přihlásit se existujícím účtem Poolčítadla, vyzkoušet přepnutí testovací role (HRÁČ, CLUB ADMIN, ADMIN).
2. Otevřít Zápasy a vyzkoušet nastavení klasického zápasu a název zápasu.
3. Ověřit výběr hráčů (včetně dvou Test Jan Novák) a možnost ručního zadání.
4. Vyzkoušet 8/9/10-ball, Ghost 14.1, vítěze na stole a historii průběhu bodů.
5. Vytvořit testovací turnaj, přidat hosty a projít skupiny / pavouka.
6. Ověřit mobilní zobrazení, přepnutí světlého režimu a návrat k rozehranému zápasu.
7. Pokud něco selže, uvést přesný krok, zařízení a obrazovku.

Test je oddělený od dosavadního `/test/` na verzi 4.51.73. Ostrý `/index.html` se nemění.
