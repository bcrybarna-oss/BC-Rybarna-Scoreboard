# Federal Cup – společné assety

- `flag-sk-flat.svg`: nezměněná vektorová geometrie slovenské vlajky ze https://commons.wikimedia.org/wiki/File:Flag_of_Slovakia.svg (originál https://upload.wikimedia.org/wikipedia/commons/e/e6/Flag_of_Slovakia.svg, staženo23.10.2026). Návrh Ladislav Čisárik/Ladislav Vrtel, vektor SKopp; zdroj označen public domain. Znak není generovaný ani ručně zjednodušený.
- `flag-cz-flat.svg`: standardní geometrie české vlajky3:2, ostré rohy, bez rámečku.
- `flag-*-cloth.svg`: tytéž vektorové tvary, shodný nepravidelný dvourozměrný posun se dvěma širokými nerovnoměrnými záhyby a měkkým šikmým světlem pro obě země. Průhledné okolí, bez žerdi/rámečku, žádná animace ani síťová závislost. Vnořená mapa posunu je součástí SVG.
- `gold-trophy.png`: samostatný průhledný asset vytvořený imagegen23.10.2026 podle lokální schválené reference zadavatele. Zlaté/bronzové tóny a černý podstavec; neobsahuje text, vlajky ani rozhraní. Text dlaždice je HTML.

Reference: uživatelem dodané `exec-7818429c-447e-48d2-a64d-c60d39e98351.png` (dlaždice) a `exec-43b84a1f-3b58-4557-a4e7-8c82bddcce08.png` (tabule/látka/společné tlačítko) v lokálním generated_images/01a168be-e87b-7aa0-a08c-bfdb3c7041f3. Žádný celý screenshot není použit jako produkční rozhraní.

Doladění po revizi: odstraněno periodické svislé pásování. Produkční `flag-*-cloth.png` jsou průhledné rendery stejných přesných SVG při1920×1320, aby malé vlajky vbrowseru aexportu neměly schodové hrany filtru. Obnoví je `node scripts/render-federal-cloth-assets.cjs` sPlaywright/Chrome. Malé rovné SVG beze změny.
