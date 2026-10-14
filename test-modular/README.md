# Poolčítadlo TEST MODULAR – v4.51.75 RC

Odkaz po publikaci na hlavní větvi GitHub Pages:

https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/test-modular/

## Co se ověřuje

Tento samostatný náhled používá **modularizovanou v4.51.75** ze zdrojové větve `refactor/v4.51.75-modular-assets-20261014`. CSS a JavaScript se načítají ze samostatných souborů `assets/` stejně jako ve vyvíjené verzi.

## Data – důležité bezpečnostní omezení

- CSP zakazuje síťová připojení: `connect-src 'none'`.
- Firebase API klíč je neplatný a Firebase URL vede na `poolcitalo-test.invalid`.
- Test vlastní datový prostor `localStorage` a `sessionStorage` s prefixem `poolcitadlo_test_modular_v45175__`; produkční lokální záznamy se nemění.
- Při prvním otevření vznikne 5 ukázkových hráčů, z toho dva se stejným jménem a různými kluby.
- Data lze z tohoto testu odstranit tlačítkem **VYMAZAT TESTOVACÍ DATA**.
- **Cloudové přihlášení, online výzvy a synchronizaci napříč zařízeními zde ověřit nelze.** Pro to je nutné samostatné testovací Firebase prostředí.

## Doporučené kroky

1. Otevřít Zápasy a vyzkoušet nastavení klasického zápasu a název zápasu.
2. Ověřit výběr hráčů (včetně dvou Test Jan Novák) a možnost ručního zadání.
3. Vyzkoušet 8/9/10-ball, Ghost 14.1, vítěze na stole a historii průběhu bodů.
4. Vytvořit testovací turnaj, přidat hosty a projít skupiny / pavouka.
5. Ověřit mobilní zobrazení, přepnutí světlého režimu a návrat k rozehranému zápasu.
6. Pokud něco selže, uvést přesný krok, zařízení a obrazovku.

Test je oddělený od dosavadního `/test/` na verzi 4.51.73. Ostrý `/index.html` se nemění.
