# Federal Cup – podklady k revizi

## Výsledek tempa před zahájením zápasu

Příprava všech tří formátů Federal Cupu má povinný výběr **Výsledek tempa: Slovensko / Česko**. Nový formulář začíná bez předvolby, aby nepřevzal výsledek minulého zápasu. Start bez výsledku se odmítne ještě před vytvořením zápasu. Vítěz se uloží do stávajícího `lagWinner`, jednou se přičte `lagWins` a nastaví první rozstřel přes původní `chooseLagWinner`. Federal Cup již po startu nezobrazuje druhý dialog tempa; ostatní režimy jej používají jako dosud.

V Teamu se break přičte teprve po ručním výběru hráčů. Reload a obnovení nevytvářejí nový výsledek tempa ani druhý break. Ruční změna rozstřelu zůstává servisní opravou před breakem s převodem jednoho pokusu a undo, nikoli náhradou za běžné zadání tempa. Izolovaný browser test ověřuje volbu obou stran, povinné zadání, správné statistiky Singles/Doubles/Teamu, vynucení při vypnutém skrytém přepínači tempa, reload, následné střídání a zachování ostatních režimů.

## Oprava přiřazení rozstřelu nalezená v ručním náhledu

Zachovaný případ `205d066e-3be2-4231-b708-43a063dbabb6` má původně Česko: 2 breaky, 1 faul z breaku a 2 B&R. Výpočet 200 % byl aritmeticky správný pro chybná vstupní data: `2 / (2 - 1) * 100`.

V prvním racku se po výběru hráčů zavolalo `beginRack`, které přičetlo break Slovensku. Obsluha pak použila **Změnit rozstřel**; původní handler změnil `breaker` a `turn`, nikoli již přičtený break. Skutečný Break OK a B&R tak správně patřily Filipovi za Česko, ale pokus nesprávně zůstal u Borise za Slovensko. Také `breakPottedTracked` pro Česko bylo 3 proti pouhým 2 breakům.

| Rack | Skutečný rozstřel | Výsledek breaku | Český hráč | Český B&R |
| --- | --- | --- | --- | --- |
| 1 | Česko, ručně změněno před breakem | OK, koule 2 | Filip Ukázkový CZ | 1 |
| 2 | Slovensko | Soft + dry, soupeř převzal | Jakub Testovací CZ | 0 |
| 3 | Česko | OK, koule 2, 7, 8 | Hynek Zkušební CZ | 1 |
| 4 | Slovensko | Dry | Ivan Demo CZ | 0 |
| 5 | Česko | Faul, koule 1 | Filip Ukázkový CZ | 0 |
| 6 | Slovensko | Dry | Jakub Testovací CZ | 0 |

Správný výsledek: Slovensko/Česko **3/3 breaky**, Česko **2 úspěšné breaky, úspěšnost 67 %, 2 B&R, B&R conversion 100 %**. Filip: 2 breaky, 1 úspěšný, 1 faul, 1 B&R. Hynek: 1 break, 1 úspěšný, 1 B&R. Koule z českých breaků zůstávají 5 při třech sledovaných pokusech (průměr 5/3). Skóre zůstává 1:5. Výpočet procent se neořezává ani nemění.

Handler nyní přesune právě jeden již přičtený pokus; před výběrem hráčů Teamu nepřičítá nic. Team baseline se nemění, takže rozdíl statistik racku patří zvolenému skutečnému hráči. Federal Cup po odehraném breaku nedovolí změnit rozstřel bez undo. Oprava má snapshot pro hlavní UNDO i pro událostní undo. Současně opraven překlep `scheduleStreamSend` v hlavním UNDO na existující `scheduleStreamState`; původní neexistující funkce po obnově vyvolala chybu JavaScriptu.

Plná původní lokální databáze byla před úpravami archivována mimo repozitář v `federal-cup-preview/reproductions/br-conversion-200-20261019/original-local-mock-data.json`, SHA-256 `cfeaa42afe484b2ce1243b5796717fb5c8709e7b8f0684c383a1e6c208a2bcf4`. Zmenšená reprodukce v `tests/fixtures/federal-team-breaker-correction.json` obsahuje původní chybný uložený zápas a původní snapshot bezprostředně před ruční změnou. Test výslovně ověřuje původních 200 %, aby se případ neztratil.

Nový `federal-cup-break-accounting.test.cjs` má 7 testů proti skutečným funkcím aktuálního main. Browser test navíc přehrává všech šest racků s opravou rozstřelu, hlavním undo, opakovaným dokončením B&R, reloadem a uložením do izolovaného mocku. Kontroluje součty týmových i hráčských statistik, soft/dry překryv, faul, koule z breaku a nezměněné skóre/B&R. Produkční Firebase se nepoužívá.

Po této opravě: celá stávající sada 57 testů, 55 prošlo a stejné 2 dřívější preview testy selhávají. Všech 7 nových regresních testů a celý rozšířený izolovaný browser test prošly.

- Větev: `fix/federal-cup-team-counter`
- Výchozí `origin/main`: `ede570951e8bed881c93617144f978f705166ad6` (ověřeno fetch 19. 10. 2026).
- PR #6 ani modularizované preview nejsou zdrojem implementace.
- Změny nejsou mergovány ani nasazeny. `sources/`, `/test/` a `test-modular/` nejsou upraveny.

## Změny

Federal Cup připravuje Singles, Doubles i Team s pevnou devítkou, race to 5, rozšířeným počítadlem a střídáním rozstřelu po racku. Stejné hodnoty vynucuje skutečný start. Ghost, Vítěz na stole, handicap a volba typu počítadla se nenabízejí. Příprava správně opustí předchozí Ghost formulář. Ostatní zápasy mají původní možnosti.

Team používá jediný záznam `/matches/{id}` s původním `federalCupLink`. Rozpis, výsledek série a součet statistik načítají tento záznam stejně jako Singles/Doubles. Když současně existuje starší ruční výsledek, podrobný dokončený zápas má přednost; jeden fixture stále znamená nejvýše jeden bod. Nedokončené zápasy se do vítězství nepočítají.

Nový objekt `federalTeam` obsahuje:

- `pending`: čekání na ruční výběr obou hráčů; hodiny neběží a herní akce nejsou dostupné.
- `players`: dva vybraní hráči s ID podle indexu neměnné kopie soupisky, jménem a stranou týmu. Výběr se ukládá hned při změně.
- `baseline`: součet týmových statistik před aktuálním rackem, před přičtením breaku.
- `racks`: číslo racku, rozstřelující strana, vítězná strana, kopie hráčů a jejich detailní statistiky jako rozdíl proti baseline.

Souhrnné `match.stats` patří týmům. Syntetická týmová ID zabraňují připsání celého Team zápasu prvnímu hráči soupisky. Detail jednotlivých hráčů je dostupný v rozbalovacích kartách racků v rekapitulaci zápasu; nemění globální profily ani ELO hráčů. Rozehraný rack se uchovává pomocí aktuálních statistik, baseline a hráčů. Nová pole se přenášejí běžnou plnou lokální/cloudovou zálohou a undo snapshotem. Ruční změna skóre u Teamu je skryta, aby skóre nešlo oddělit od rackové historie; oprava probíhá přes undo. Opakovaný start stejného lokálního fixture obnoví původní zápas.

Soft break má ve Federal Cupu explicitní převzetí nebo vrácení pozice. Převzetí neumožní push out, vrácení jej umožní rozstřelujícímu. Samotný Soft break nepřičítá faul; při nulovém počtu koulí se zachovává dosavadní rozlišení soft + dry a jejich průniku. Devítka se po Soft breaku nebo faulu vrací na bod. Informační řádky po vrácení Soft breaku/push outu už ve Federal Cupu nevytvářejí druhou vratnou akci. 2-Way shot zůstává.

Pravidlový podklad: [WPA Playing Regulations, účinnost 15. 9. 2025, článek 16, body 2–5](https://wpapool.com/wp-content/uploads/2025/10/2025.09.15-WPA-Regs-NP.pdf).

Úzká oprava obnovy zachovává lokální Federal Cup snapshot během asynchronní obnovy přihlášení. Neověřený uživatel jej nemůže editovat. Používá se původní `resumeLocalMatch`, včetně kontroly vlastníka a porovnání lokální a cloudové zálohy. Ostatních zápasů se tato pojistka netýká.

Uložené ruční Team výsledky jsou v editoru zobrazené i po rozhodnutí série jedenáctým vítězstvím. Historické výsledky za rozhodujícím zápasem se dále nezapočítávají.

## Testování aktuálního kódu

`tests/federal-cup-browser.cjs` načítá nynější `index.html` do skutečného headless Chrome. Přidává pouze testovací přístup k privátním funkcím; tyto hooky se do aplikace neukládají. Celý browser context zachytává všechny požadavky, Firebase REST simuluje paměťový mock a ostatní externí zdroje blokuje. Žádný požadavek se nepředává síti. Nevytváří testovací Firebase účty.

Předpoklady: Node 22+, nainstalované devDependencies (`playwright` 1.62.1) a Chrome. Spuštění: `npm run test:federal-cup`. Pro jiný instalovaný Playwright channel lze nastavit `FC_BROWSER_CHANNEL`; například po instalaci Playwright Chromium použít `chromium`. `FC_SCREENSHOT_DIR` volitelně zapne mobilní screenshoty. Ověřeno na Windows, Node 24.19.0, headless Chrome.

| Scénář | Výsledek |
| --- | --- |
| Singles, Doubles a Team: pevné nastavení, také po manipulaci se skrytými vstupy | Prošlo |
| Všechny čtyři výsledky breaku přes skutečná tlačítka ve všech třech formátech | Prošlo |
| Obě rozhodnutí po Soft breaku, správný hráč a dostupnost push outu | Prošlo |
| Push out: převzetí, vrácení a undo | Prošlo |
| Přesný výběr koulí, statistika koule z breaku, vrácení devítky na bod | Prošlo |
| Undo Soft breaku, obou rozhodnutí, push outu, výhry racku a rackové historie | Prošlo |
| Skutečný reload při částečném výběru hráčů, Soft break rozhodnutí a push out rozhodnutí | Prošlo přes původní resume funkci |
| Team: různí hráči v dalších raccích, správný break i rozdíl statistik podle racku | Prošlo |
| Team dokončen 5:1: šest racků, jediný uložený fixture, jeden bod série | Prošlo, včetně zápisu do mocku |
| První rozstřel druhé strany po tempu, následné střídání | Prošlo pro všechny tři formáty |
| Hodiny při čekání na Team výběr stojí, po zahájení běží | Prošlo |
| Opakovaný start lokálního fixture obnoví stejné ID | Prošlo |
| Ruční Team výsledky a zobrazení po 11 vítězstvích | Prošlo |
| Nedokončený Federal Cup výsledek nepřináší vítězný bod | Prošlo |
| Běžné 8-ball jednoduché počítadlo: původní volby a start | Prošlo |
| Běžné 10-ball, 14.1, Ghost, Vítěz na stole, Doubles: start | Prošlo |
| JavaScriptové chyby v prohlížeči | 0 |

`node --test tests/*.test.cjs`: 50 testů, 48 prošlo, 2 selhaly. Stejný výsledek byl ověřen i s výchozím `index.html` z uvedeného commitu; nezměněné modulární soubory/testy zůstaly stejné. Obě existující chyby jsou v `preview-match-reload-recovery.test.cjs`: odpojení zápasu při nedostupné identitě a očekávané volání `restoreOwnedTestMatchAfterLogin` po přihlášení. Výsledky preview nejsou vydávány za ověření změněného main. Aktuální main ověřuje nový browser test a smoke test syntaxe.

## Neověřeno a zbývající rizika

- Skutečný Firebase Auth, nasazená Database Rules, cloudový výpadek a chování mobilní iOS/Android aplikace nebyly testovány. Produkční databáze nebyla pro testování kontaktována.
- Souběžná editace celé konfigurace Federal Cupu z více zařízení stále může přepsat jinou změnu. Schéma a synchronizace `federalCup2026` se nerozšiřují: nové racky jsou výhradně uvnitř vlastního záznamu zápasu. Transakční/ETag změny konfigurace vyžadují samostatnou opravu a test souběhu.
- Zábrana duplicitního startu kontroluje toto zařízení a známé dokončené výsledky; nejde o distribuovaný zámek. Dvě zařízení mohou nezávisle otevřít stejné dosud nedokončené fixture. Pro turnaj používat jedno obslužné zařízení na jeden fixture.
- Test nepokrývá úplné odehrání všech ostatních disciplín, turnajových pavouků ani exporty PDF. Rackový detail Team hráčů je přidaný do rekapitulace v aplikaci, nikoli do samostatné nové PDF sestavy.
- Existující rozpracované Federal Cup zápasy se při obnově hromadně nepřepisují na nová nastavení. Nová pevná pravidla platí při novém startu; před turnajem je nutné použít nové zápasy této verze.
- Dva výše uvedené starší preview testy zůstávají červené. Širší oprava preview ani modularizace nejsou součástí změn.
