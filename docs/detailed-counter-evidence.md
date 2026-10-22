# Detailní počítadlo od v4.51.83 RC

## Oprava Jump/Bank – v4.51.89 RC (Dominik, 22. 10. 2026)

Nasazeno a ověřeno 22. 10. 2026 po sloučení PR #27, merge 3e83a2ee8c740be57e6b4ebc13d02607c281de6c. Veřejný index/overlay v4.51.89 RC shodný s vydáním. Veřejná tlačítka Jump/Bank pot i MISS vytvořila jediný strk/pokus, undo prošlo. Přehled je nemutující i po 50 vykresleních pro Singles/Doubles/Team. Podrobnosti ověření a omezení: PROJECT_STATUS.md.

Původní producent již ukládal `tag: {type, success}` a čítače správně. Chyba byla v prezentační cestě: `renderEvents()` četl jen volný text `events`, zatímco `detailedShotSummary()` neměl produkčního volajícího. Potopení/MISS tedy bylo vidět bez JUMP/BANK. Regrese `tests/jump-bank-browser.cjs` na původním main decc3db potvrzuje uložený úspěšný Jump a jeden pokus, ale selže na chybějícím označeném strku v historii.

Historie nyní před textovými událostmi zobrazuje čtecí pohled **Odehrané strky • JUMP / BANK** přímo z `detailedPlay.records`: typ, výsledek, úspěšnost, známý aktér nebo strana, rack a náběh. Stabilní ID je klíčem řádku; shodné kopie se zobrazí jednou, konfliktní varianty téhož ID se nevydávají za potvrzený strk. Nevzniká druhá ukládaná historie ani odhad vazby na text starých událostí. Souhrn `detailedShotSummary` nadále čte atributy stejných skutečných strků, nikoli text.

Tok: zapnout jednu značku → potvrdit konkrétní potopení/MISS/faul/legální Jump únik → jeden kanonický záznam se `strokeCount:1`, `tag.type` a `tag.success` → právě jeden přírůstek existujících čítačů → čtecí historie a interní metriky. Multipot/kombinace zůstává jeden označený strk; neurčitý hromadný dopočet jej nevytváří. Bank při úniku není přípustný. Jump únik bez koule může uspět a nepřidává útočné potopení. Faul vždy znamená neúspěšnou značku. Skórování a klasifikace útoku se nemění.

**Zrušení navazujícího dialogu nyní zahodí i jednorázovou značku**, vrátí koule a nevytvoří pokus. Dokončená akce ji také spotřebuje. Undo naopak výslovně obnoví celý stav před strkem včetně jeho značky; reload samostatně čekající značku zachová. Rozdíl je záměrný a otestovaný. Staré uložené zápasy se nepřepisují.

Zobrazení, všechny výsledky obou značek, zrušení vnořeného dialogu, multipot, undo, skutečný reload, Team aktér a Doubles ověřuje nový browser test. Stávající detailed-counter browser chrání sekvence i 8/10-ball/14.1 a mobil; federal-evidence browser navíc skutečný mock Auth, hotový Bank i čekající Jump v autosave/backup/reload a plný PUT/GET dokončeného zápasu. Všechny požadavky zachyceny, produkční Firebase se nepoužívá. Stav vydání a CI: PROJECT_STATUS.md.

Zadavatel Dominik, 20. 10. 2026. Změna společného detailního počítadla v index.html, nikoli kopie pro Federal Cup. Jednoduché počítadlo, 14.1 a Ghost nepoužívají nový model. Export PDF a jeho dialog zůstávají.

## Obsluha

- MISS v 9/10-ball: vyber nepotopenou kouli na stole a potvrď. Dialog ukáže doplnění dosud nezapsaných nižších koulí aktuálního náběhu. Nezasažení správné koule je FAUL.
- Běžný FAUL: vyber kouli při faulu, případně označ skutečně spadlé koule. Ty se nepočítají mezi úspěšná potopení; 9/10 se spotuje a soupeř má ball in hand. Rozstřel má nadále vlastní faul.
- Úspěšná jistota vyžaduje únik soupeře bez ohledu na úspěch jeho pozdějšího úniku. Neúspěšná jistota únik neaktivuje. Únik má úspěch / neúspěch bez faulu / neúspěch s faulem. FAUL v této situaci rovnou zapíše neúspěšný únik bez výběru čísla koule. Po něm lze opravit stůl; výslovným zaškrtnutím přiřadit odstraněné koule poslednímu faulu.
- RESAFE vyřeší čekající jistotu jedním úspěšným únikem a založí jednu novou jistotu soupeři. Zrušení nepřičítá pokus; Zpět obnoví i vazbu čekající jistoty.
- JUMP SHOT / BANK SHOT zapínají a opětovným stiskem vypínají značku následujícího strku. Výsledek určují stávající akce. Bank znamená cílovou kouli přes mantinel, ne kopaný únik. Bank při úniku není dovolený; jump přebírá výsledek úniku i bez potopení. Jistota, push out a hromadné dokončení při zapnuté značce vyžadují její vypnutí. Více koulí zadaných jako jeden strk přidá jeden označený pokus. V 8-ball má označený útočný strk výslovné tlačítko POTOPENÁ KOULE; nevymýšlí číslo koule.
- 2-Way a samostatná nechtěná jistota nemají aktivní vstup. Jejich historické statistiky zůstávají čitelné. MISS nemá důvod ani dodatečnou jistotu.

## Datový model a hranice odhadu

`match.detailedPlay.version = 1` obsahuje strukturované `records`, aktuální `inning`, volitelný `tag` a `pendingSafety`. Záznam má stabilní ID, druh, stranu/sideId, rack, náběh a známého aktéra. Team ukládá kopii hráče vybraného pro daný rack a kopii záznamů do dokončeného racku; Doubles má aktéra null (pouze známou dvojici/stranu).

`break` drží koule/počet a výsledek rozstřelu odděleně od `pot` a `inferred_pots`. `miss` eviduje jeden neúspěšný pokus. `foul` a případná výslovná následná oprava drží `foulBalls` a vazbu `foulId`. `safety` má vlastní ID a `escape.safetyId` odkazuje na původní jistotu. Tag s úspěchem patří skutečnému výsledku strku. Souhrn `detailedShotSummary` neparsuje text událostí. Souhrnné doplnění má `strokeCount: null`, nikoli smyšlený počet strků.

Odhad používá pouze aktuální evidovaný stůl a počáteční množinu koulí aktuálního náběhu. Nevrací již potopené koule ani je nepřipisuje novému hráči. Explicitní kombinace a více potopených koulí jsou již odebrané a nepřičítají se podruhé. Neznámá stará historie, ruční servisní změna hráče, nečíslovaný break nebo přidání koule, která nebyla na začátku náběhu, znemožní bezpečný odhad. Po legacy push outu je odhad konzervativně vypnutý, protože tato starší cesta neeviduje jeho potopené koule. Nabízí se OPRAVIT EVIDENCI bez připsání úspěšných potopení.

Nové zápasy mají `coverage: complete`. Obnovený starší zápas má pro nové záznamy `partial`; neprokazatelná historie se nedoplňuje. Chybějící jump/bank statistika je „—“, ověřená nula nového zápasu „0/0“. Smíšený nebo částečný souhrn má „(část)“. Staré důvody MISS, 2-Way a nechtěné jistoty se nemigrují. Prázdné kolekce vynechané serializací RTDB se bezpečně normalizují. Žádná změna Firebase schémat/pravidel ani migrace dat.

Undo snímek obsahuje nový model a celý stav před výběrem koulí. Potvrzení včetně doplnění je jedna vratná akce. Zrušení navazujícího dialogu vrátí dočasně odebrané koule. Autosave a reload ukládají značku i čekající jistotu; nehotový dialog se při reloadu zahodí bez vyrobeného pokusu.

## Ověření a omezení

- `npm run test:detailed`: aktuální index.html, izolovaný Chrome, oddělené úložiště a kompletně zachycená síť. Break 1 → MISS/FAUL 5; foul pots a spotování 9/10; jistoty, všechny úniky a RESAFE; tagy, multipot, zrušení, undo/reload; kombinace, předávání hráče a nejistý stůl; Team/Doubles; 8-ball, 14.1 a mobilní viewport.
- `node --test tests/detailed-counter.test.cjs tests/safety-escape-pot.test.cjs`: strukturované souhrny, původ potopení, vazby, aktéři, částečná historie, agregace a serializace.
- Původní Federal Cup browser ověřuje i šestirackový reprodukční případ B&R, střídání rozstřelu, čtyři breaky, obě rozhodnutí soft breaku/push outu a dokončení jednoho fixture. Historická browser sada chrání předchozí práci.
- Fyzické Android/iOS, nativní Capacitor, skutečné cloudové Auth/Rules, souběh zařízení a velké dlouhé zápasy nebyly ověřeny. Mobilní viewport nenahrazuje fyzický telefon. Známé chyby starého test-modular a souběžné editace celé konfigurace Federal Cupu zůstávají podle PROJECT_STATUS.md.

Aktuální commit, verze a skutečný výsledek nasazení: PROJECT_STATUS.md a REVIZE.md. Vrácení vydání je běžný revertní commit, nikoli reset/force push; databáze se při návratu nemění a nové uložené záznamy se nemažou.

## Kanonické příklady z izolovaného browseru v4.51.89 RC

Následující záznamy vytvořil skutečný producent index.html (Singles SK3, samostatné testovací zápasy; jedinečná ID se mezi běhy mění). Pot/MISS současně nese značku, není zde další Jump/Bank událost. Faul má tag.success=false, u úniku je intent=escape a pottingAttempts=0.

```json
{"id":"mvjcalnuyel1mbj260azq4fk15smje","kind":"pot","side":0,"sideId":"fc-mvjcaljn8f1yeu4b43rb4j0mq144u","actor":{"id":"fc-mvjcaljn8f1yeu4b43rb4j0mq144u","name":"SK3","identityStatus":"stable"},"rack":1,"inning":1,"balls":[2],"pottedCount":1,"strokeCount":1,"shotType":null,"tag":{"type":"jump","success":true},"evidenceVersion":2,"intent":"pot","pottingAttempts":1,"successfulPottingStrokes":1,"potsEvidence":"explicit"}
{"id":"mvjcalq1fgt3bkiv8ivatyu4v90t4u","kind":"miss","side":0,"sideId":"fc-mvjcalokkxeqyobr4ier37cdfgw1s","actor":{"id":"fc-mvjcalokkxeqyobr4ier37cdfgw1s","name":"SK3","identityStatus":"stable"},"rack":1,"inning":1,"balls":[],"ball":2,"strokeCount":1,"tag":{"type":"jump","success":false},"evidenceVersion":2,"intent":"pot","pottingAttempts":1,"successfulPottingStrokes":0,"potsEvidence":"not_applicable"}
{"id":"mvjcalutaq7w2ylxvikwam0y2bf6","kind":"pot","side":0,"sideId":"fc-mvjcalt31c6350zki6svtb3dwy9cg","actor":{"id":"fc-mvjcalt31c6350zki6svtb3dwy9cg","name":"SK3","identityStatus":"stable"},"rack":1,"inning":1,"balls":[2],"pottedCount":1,"strokeCount":1,"shotType":null,"tag":{"type":"bank","success":true},"evidenceVersion":2,"intent":"pot","pottingAttempts":1,"successfulPottingStrokes":1,"potsEvidence":"explicit"}
{"id":"mvjcalx0whm5om1wayemzwtogx4w8m","kind":"miss","side":0,"sideId":"fc-mvjcalvilyutk4xovtls4awggbjyvd","actor":{"id":"fc-mvjcalvilyutk4xovtls4awggbjyvd","name":"SK3","identityStatus":"stable"},"rack":1,"inning":1,"balls":[],"ball":2,"strokeCount":1,"tag":{"type":"bank","success":false},"evidenceVersion":2,"intent":"pot","pottingAttempts":1,"successfulPottingStrokes":0,"potsEvidence":"not_applicable"}
```
