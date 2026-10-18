# Poolčítadlo – oddělený vývoj a postup modularizace

## Stav: základní fáze refaktoringu (v4.51.76 RC)
**Ostrá verze se touto větví nemění.** Větev `refactor/modules-foundation-20261014` vznikla z aktuálního `main` (v4.51.75 RC). Tato změna fyzicky přesouvá existující beze změny funkčnosti:
- `assets/js/app-core.js`: původní herní engine a současná databázová logika, zatím stále uvnitř jednoho IIFE;
- `assets/js/theme.js`, `dashboard.js`, `tournament-view.js`, `tournament-hub.js`, `online-presence.js`, `match-setup.js`, `player-picker.js`: samostatné UI skripty;
- `assets/css/core.css`, `dashboard.css`, `tournament-hub.css`, `federal-cup.css`, `match-setup.css`, `player-picker.css`, `winner-table.css`: samostatné styly.

Řazení skriptů a stylů v `index.html` je zachováno. Základní část ještě obsahuje velký `app-core.js`, který bude možné rozdělit až po zavedení jasných interních rozhraní.

## Dvě různá oddělení, která potřebujeme
1. **GitHub větve** chrání rozpracované změny před ostrým nasazením. Neodstraňují ale konflikty, pokud dvě změny sahají do stejného souboru.
2. **Samostatné soubory/moduly** dovolují vývoj dílčích funkcí s menším rizikem, že se nechtěně přepíše jiná oblast.

## Doporučené větve pro budoucí práci
- `main` – jen otestovaná ostrá verze Poolčítadla;
- `refactor/modules-foundation-20261014` – nynější testovací základ modularizace;
- `feature/matches-...` – klasické zápasy, Ghost, 14.1, Vítěz na stole;
- `feature/tournaments-...` – formáty turnajů, DKO/SKO, série, prezence;
- `feature/statistics-...` – žebříček, ELO, historie, grafy;
- `feature/live-stream-...` – Livescore, overlay, online uživatelé a výzvy;
- `feature/cloud-accounts-...` – registrace, role, ukládání, synchronizace;
- `feature/league-federal-...` – Liga Sever a Federal Cup.

**Nevytvářet tyto dlouhodobé prázdné větve předem.** Každou založit z aktuálního `main`, až začne konkrétní změna. Refaktoring nejdřív otestovat a bezpečně začlenit.

## Následující fáze, v pořadí
1. Ověřit `npm test` a v testovacím nasazení načtení všech CSS/JS souborů, vytvoření a dokončení běžného zápasu, Ghost 8/9/10/14.1, turnaje a obnovení rozehraného zápasu.
2. Ustanovit modulová rozhraní, zachovat stabilní data a zacházení s globálními proměnnými.
3. Oddělit herní logiku: `matches/engine`, `matches/ghost`, `matches/winner-table`, `matches/fourteen-one`.
4. Oddělit turnaje, statistiky, cloud a registraci v malých ověřitelných přesunech.
5. Každá funkční změna přes vlastní feature větev a pull request s regresními testy. Žádné automatické přepisování ostrého `main`.

## Poznámka ke skóre v režimu Vítěz na stole
V ostrém základu v4.51.75 RC již existuje `winnerTableProgressHtml()` pro chronologii racků a skóre tří hráčů, včetně náhledu posledních pěti racků. Při modularizaci se beze změny zachovává; případné další vylepšení patří do samostatné `feature/matches-...` větve.

## Omezení
Statické testy ověřují existenci souborů, syntaxi JavaScriptu, pořadí načítání a zachování vybraných funkcí. **Neprokazují chování v prohlížeči ani oprávnění Firebase**. Bez ověření na skutečném webu a mobilu neslučovat do `main`.
