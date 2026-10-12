# Poolčítadlo TEST • v4.51.73 RC

Testovací adresa (GitHub Pages):  
https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/test/

Zdroj: testovací větev `improvement/setup-players-tests-20261012`. Ostrý `index.html` zůstává na v4.51.72 RC.

## Bezpečnost a data

- HTML používá CSP `connect-src 'none'`. Z testovací stránky nelze odesílat data do Firebase ani jinam přes fetch/WebSocket.
- Všechny klíče `localStorage` a `sessionStorage` jsou v testu oddělené prefixem `poolcitadlo_test_v45173__`.
- Uložení zápasů, hráčů a turnajů je v testu lokální, jen do aktuálního prohlížeče. Data na jiném mobilu nebo PC nejsou stejná.
- Při prvním otevření se vytvoří pět fiktivních profilů včetně dvou hráčů s totožným jménem. Nejde o kopii skutečných profilů.
- Tlačítko **VYMAZAT TESTOVACÍ DATA** smaže jen testovací klíče daného prohlížeče.
- Cloudové přihlášení, Livescore mezi zařízeními, online výzvy a role Firebase se v této offline testovací verzi netestují. Vyžadují pozdější izolované testovací Firebase prostředí.

## Co vyzkoušet

1. Otevři **Zápasy → Klasický zápas**, vyber dvě testovací jména a doplň **Název zápasu**. Ten má být vidět bez rozbalení dalších nastavení.
2. Vyber pomocí tlačítka **VYBRAT** dva profily `Test Jan Novák`, které se liší klubem, a ověř, že se neprohodí nebo nesloučí.
3. Přejdi na **Ghost trénink**, otestuj 8/9/10-ball a 14.1 včetně nastavení obtížnosti.
4. V **Turnajích** přidej několik testovacích hráčů, hosta, vyzkoušej prezenci a vytvoření turnaje.
5. Vyzkoušej ovládání na mobilu, návrat do rozehraného zápasu a odpojené ukládání.
6. Případné chyby hlaste do konverzace a uveďte obrazovku, verzi a přesný postup. Tlačítko **Nahlásit problém** je zde bez připojení ke cloudu.

## Aktualizace testovací stránky

`test/index.html` je snapshot testovací větve se speciální vrstvou na oddělení dat a odpojení cloudu. Při aktualizaci zdrojového `index.html` je potřeba tuto bezpečnostní vrstvu znovu zachovat a zkontrolovat. Nesmí se jen prostě překopírovat produkční HTML, jinak by mohlo dojít k napojení na skutečnou databázi.
