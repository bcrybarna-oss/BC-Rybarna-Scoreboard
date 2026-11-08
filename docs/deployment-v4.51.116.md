# Nasazení v4.51.116 RC — pravidla Lounské série

Dominik schválil vydání z hlavy `49c35ef140bbf06dd00493b047e880565e6e798d` proti `6c459862a0201879920bdc0b93b3f49be5d0e7da` (v4.51.115 RC). Aplikační merge `90d550783172b1a6229d24c575d763c22b991a27` má stejný strom jako otestovaná hlava. Na main navazuje dokumentační commit s tímto záznamem. [PR #60](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/60)

GitHub Pages dokončil build i publikaci merge commitu. PR #55 zůstal otevřený s hlavou `4b50f7cabbfc0c77be2fac35bbde4f4b2c2b8e74`. [GitHub Pages 42486020246](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42486020246) · [PR #55](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/55)

## Veřejné ověření

Anonymní Chrome na 1440 × 1000 a 390 × 844 zobrazil v4.51.116 RC. Veřejný `index.html` měl SHA-256 `d374e2288fc47572b2ec02465d5576b752a35924e61696fd4782337533bece33`, `overlay.html` měl SHA-256 `54ad8de46f5b1051bb601b4f2340ce5bec71f5d8f03860c7b1e2d2977eadd73d`. Oba soubory a 15 vlastních načtených skriptů odpovídaly souborům merge commitu. Devět aktualizovaných odkazů na moduly se načetlo s parametrem `?v=4.51.116`.

Po volbě POUŽÍT OFFLINE prošly přechody mezi úvodem, Výsledky, Statistikami, Hráči, Soutěžemi, Federal Cupem a Livescore. Oba kontexty zaznamenaly nula JavaScriptových výjimek, bootstrap chyb a pokusů o zápis. Síť povolovala pouze GET, HEAD a OPTIONS. [Produkční web](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/)

## Izolované ověření pravidel

Test v Chrome na 320, 390 a 1440 px prošel na schválené hlavě i nad HTML staženým z produkčních Pages a se stejnými, proti merge ověřenými moduly. Síť scénářů se syntetickými turnaji byla izolovaná. Jeden turnaj Každý s každým byl propojen v obou pořadích.

| Série | Umístění a body |
| --- | --- |
| Standardní | 1. A 100, 2. B 80, 3. D 65, 4. C 55 |
| Lounská | 1. B 100, 2. A 80, 3. C 65, 4. D 55 |

Odebrání vazby, přepínání detailů a obrácení pořadí výpočtů neměnily druhou sérii, zápasy, obecné statistiky ani historii hráčů. Společný detail i vítěz ve Výsledcích zůstaly podle nastavení turnaje. Srovnání s `6c45986` a `36e006c` potvrdilo odstranění přenosu pravidla do druhé série. Prošly také dvojice, minitabulka, cyklus, neúplný turnaj, historické struktury a ruční pořadí, turnaje bez absolutního pořadí u více samostatných skupin, SKO, DKO, hybridy, Swiss, mobilní ovládání a Federal Cup. [Podrobný popis a reprodukce](lounska-round-robin-v4.51.116.md)

## CI a omezení

- Lokální release gate prošel proti čerstvému main. Produkční Node sada měla 383 PASS, 0 FAIL, 0 SKIP.
- GitHub release gate a produkční sada prošly na PR i na main. Produkční sada měla 380 PASS, 0 FAIL, 3 SKIP. Tři testy se soukromými podklady prošly lokálně. Mobilní CI na schválené hlavě prošlo. [PR CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42483822708) · [Mobilní CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42483822659) · [Main CI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/42486020174)
- Experimentální sada má 28 PASS a 2 nezměněné FAIL. Při reloadu bez dostupné identity se editovatelný stav zápasu neodpojí. Druhá vada dovolí zbytkovému UID autorizovat vlastníka bez autentizace. Společný regresní workflow kvůli experimentu končí neúspěchem.

Živé Auth, Firebase Rules a fyzická zařízení zůstávají neověřené. Testy neměnily produkční data, účty ani Rules. Případný návrat se provede reverzí aplikační změny PR #60 v novém vydání podle AGENTS.md, bez obnovy produkčních dat. Etapy 10b1 a 10b2 jsou nezahájené.
