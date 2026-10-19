# Federal Cup – podklady k revizi

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
