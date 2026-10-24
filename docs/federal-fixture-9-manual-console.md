# Jednorázová ruční oprava FC 2026 #9 v konzoli

Zadavatel: Dominik. Připraveno a izolovaně funkčně otestováno 24. 10. 2026: **15/15 scénářů PASS**, včetně instalace přes debugger. **Na produkci tento pomocník nebyl spuštěn.** Produkce v4.51.95 RC, žádný merge/deployment, žádná nová verze. [Výsledky, hashe a rozsah ověření](federal-fixture-9-console-verification.md).

Kód: [`scripts/federal-fixture-9-console.js`](../scripts/federal-fixture-9-console.js). Je to celý samostatný snippet, bez závislostí, externího stahování kódu nebo importu zálohy do aplikace. Neprovádí automatickou migraci. Je určen výhradně pro matchId `3d4c35e6-e336-49d5-a9b3-9955cec59c3d` a schválený návrh.

## Co lze použít z existující aplikace

Zdroj aktuálního index.html obsahuje `ensureCloudToken`, `cloudUrl`, `currentUserIsSystemAdmin` a čistý reader `federalReportData` uvnitř hlavního IIFE. Nejsou běžně dostupné přes window. Ve stejném scope je veřejná, čtecí funkce `window.getModernDashboardSnapshot`.

Debuggerem lze při jejím pozastavení vytvořit pomocníka, který si uchová reference na existující funkce. Nevytahuje žádnou hodnotu tokenu do konzole ani do souboru. `ensureCloudToken` používá současnou relaci a její standardní obnovování. `cloudUrl` sestaví pouze v paměti stejný autentizovaný Firebase URL jako aplikace. Zápis zůstává pod stávajícími Firebase Rules a vyžaduje původního systémového administrátora.

**Nepoužívá se `saveSecureMatch`:** nemá If-Match a navíc mění updatedAt. Nepoužívá se `secureMatchRequest`: nepodporuje předání podmíněné hlavičky. Nepoužívá se import dat, uploadCloudData ani jiný globální zápis. Také se nepoužívá loadSecureMatches jako ověřovací pomocník, protože obsahuje historickou kompatibilitní opravu s možným vedlejším zápisem; helper čte přímo a k výsledkům používá původní čisté API.

## Nutná hranice bezpečnosti

**Atomicky je chráněn pouze celý opravovaný zápas.** Podmíněný PUT s If-Match na `/matches/{id}` vrátí HTTP 412 bez zápisu, pokud jej mezitím někdo změnil.

ETag zápasu však nezamkne jeho sourozence ani samostatnou konfiguraci. Skript před zápisem znovu načte `/matches`, nominaci a příznaky smazání; porovná jejich ETag i obsah s kontrolním krokem. Každou takto zjištěnou změnu odmítne. Mezi posledním GET těchto jiných větví a PUT zápasu ale zůstává závodní okno. Neexistuje REST operace, která by atomicky podmínila PUT jediného zápasu současnou neměnností ostatních uvedených větví. Helper žádný takový zámek nepředstírá a nezískává další oprávnění.

**Před krokem 2 musí všichni ostatní administrátoři přestat upravovat sestavy, výsledky i vazby FC a ukládat jiné zápasy.** Je třeba zajistit klid do dokončení kontroly. Pokud jej nemůžeš zajistit, nebo požaduješ atomickou garanci také pro nominaci a ostatní zápasy, **krok 2 nespouštěj**. V takovém případě tímto postupem nejsou bezpečnostní podmínky splněny; bylo by nutné samostatně navrhnout databázovou transakci/koordinační mechanismus. Tento postup nic takového nepřidává.

## Jednorázové připojení k současné relaci (bez produkčního zápisu)

Použij běžný desktopový **Chrome nebo Edge**, nikoli mobil ani prohlížeč bez konzole/Sources. Pokud boční prohlížeč Codexu vývojářskou konzoli nezpřístupňuje, otevři produkci v běžném Chrome/Edge a standardně se přihlas jako systémový administrátor. Žádné tokeny se mezi prohlížeči nepřenášejí.

1. Otevři přesně `https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/` a ověř Admin / Cloud ONLINE / v4.51.95 RC. Nedělej souběžně další administrátorské operace.
2. Otevři F12 → Console. Pokud prohlížeč blokuje vkládání kódu nebo zobrazuje bezpečnostní překážku, **neobcházej ji**; tento postup zastav. Lze použít standardní panel Sources → Snippets, je-li běžně dostupný a povolený.
3. V konzoli napiš tyto dva příkazy:

```js
debug(window.getModernDashboardSnapshot);
void window.getModernDashboardSnapshot();
```

4. Debugger se musí zastavit uvnitř `getModernDashboardSnapshot` z index.html. Vyber tento call frame. Při pozastavení můžeš ověřit dostupnost názvů (nevypisuje se žádný token):

```js
[typeof ensureCloudToken, typeof cloudUrl,
 typeof currentUserIsSystemAdmin, typeof federalReportData]
// očekává se: ['function', 'function', 'function', 'function']
```

5. V tomto pozastaveném rámci vlož **celý obsah** souboru `scripts/federal-fixture-9-console.js` a proveď jej. Případně jej spusť jako svůj místní Sources Snippet v tomto rámci. Pokud prostředí soukromé funkce nedokáže zpřístupnit, helper skončí; nepokoušej se získávat token ze Storage ani měnit přístupová pravidla.
6. Instalace pouze vytvoří `window.fc9Repair` a vypíše potvrzení „Instalace: 0 požadavků, 0 zápisů“. Potom v konzoli spusť:

```js
undebug(window.getModernDashboardSnapshot);
```

7. Stiskni F8 / Resume. **Teprve po obnovení běhu** používej následující asynchronní příkazy. Helper je jen v paměti této stránky; reload jej odstraní. Nepoužívej reload mezi přípravou a zápisem.

## 1. Kontrola, záloha a přesný rozdíl — pouze GET

```js
await fc9Repair.prepare();
```

Tento krok:

- přečte živý cílový zápas, seznam zápasů, konfiguraci FC a příznaky smazání s ETag;
- vyžaduje přesné ID, časy `15:54:09.777Z` a `16:27:05.963Z`, complete, 9-ball, Doubles, 5:3;
- porovná **celý** zápas s kanonickým SHA256 schválené zálohy `7195a1c5562cfd1aac3e913170a412e6607aa6bd4c229a17a599d79b15876f6e`; rozdílné pořadí klíčů nevadí, jakákoli věcná změna ano;
- vyžaduje chybějící pole federalCupLink (ani existující null nepřepisuje), jediný matchId a žádnou další vazbu 2026/#9, včetně rozehraných zápasů;
- ověří stabilní ID nominace a přesný snapshot soupisek/účastníků proti schválenému návrhu;
- nabídne ke stažení JSON `FC2026-9-…-BEFORE-….json`: obsahuje kompletní skutečně načtený cílový zápas, ETag a schválený snapshot. Neobsahuje autentizační token ani nesouvisející zápasy;
- vypíše přesný rozdíl: **add `/federalCupLink`** s celým novým objektem. Žádné jiné pole se nemění.

**Zkontroluj, že soubor skutečně existuje a lze jej otevřít.** Samotné vyvolání stažení nepotvrzuje uložení na disk. Ověř ID zápasu a rozdíl. Zálohu uchovej soukromě, neposílej HAR ani obsah přihlášení. Příprava platí 5 minut. Pokud kterákoli kontrola skončí STOP, nic se nezapsalo; neoslabuj podmínky v kódu.

## 2. Samostatné provedení schválené změny

Pouze po skutečném uložení zálohy a zajištění výše popsaného klidu ostatních administrátorů:

```js
await fc9Repair.commit({backupSaved: true, exclusiveMaintenance: true});
```

Tyto příznaky nejsou novým schválením opravy. Potvrzují splnění dvou praktických podmínek, které skript sám nemůže zjistit.

Helper nejprve znovu provede všechny kontroly a porovná obsah i ETag všech čtených větví. Teprve pak odešle **jeden** podmíněný PUT na stejný `/matches/3d4c35e6-e336-49d5-a9b3-9955cec59c3d` s If-Match ETag posledního čtení. Tělo je přesný načtený objekt plus jediné schválené federalCupLink. Nemění updatedAt, statistiky, strky, hráče, skóre ani další pole. Nezapisuje appData ani jiný zápas.

**HTTP 412 → žádný podmíněný zápis neproběhl.** Zastavit, znovu posoudit nový stav. Při výpadku sítě, nečitelné odpovědi nebo jiné chybě po odeslání PUT může být výsledek neznámý: **zápis neopakuj**. Použij pouze verify níže. Helper po prvním pokusu další commit nedovolí.

## 3. Zpětné čtení a ověření

Commit po úspěšné odpovědi sám provede kontrolní GET. Samostatně lze bezpečně opakovat:

```js
await fc9Repair.verify();
```

Ověří se přesný celý otisk po opravě a shoda všech ostatních polí s původní zálohou. Výstup musí obsahovat:

- `state: 'Vazba opravena'`, `scores: [5, 3]`;
- `onlyFederalCupLinkChanged: true`, `allOtherFieldsUnchanged: true`;
- jediný reportový zdroj fixtureNo9 s přesným matchId a source detailed;
- týmové `teamScore: [7, 2]`, pokud se neobjevil jiný výsledek. Používá se stávající `federalReportData`, žádný nový sportovní výpočet.

Teprve poté v aplikaci obnov přehled standardním tlačítkem **OBNOVIT** (není nutný reload celé stránky):

1. #9 má DOHRÁNO 5:3 a týmové skóre odpovídá aktuálním výsledkům.
2. STATISTIKY ZÁPASU otevře A1 pro #9, správné dvojice a skóre.
3. EXPORT PRO PUSHOUT stáhne soubor pro #9 Doubles se správnými dvojicemi, skóre a dvěma listy Pushout/Metadata.
4. Produkční UI výsledky po skutečném zápisu zatím nebyly ověřeny. Izolované testy pomocníka potvrzují zápis, čtení, výsledné týmové skóre a reportový zdroj; nejsou tvrzením o provedené produkční opravě.

Existující neúplná evidence se tím nezmění na úplnou: nepřidává se federalEvidence, fromStart ani odhad racků. Pokud verify vrátí původní stav bez vazby, zápis se neuplatnil nebo byl vrácen; nezakládej náhradní zápas.

## Bezpečný návrat — vždy další oddělená operace

Jestliže helper stále existuje v téže stránce a návrat je potřeba:

```js
await fc9Repair.prepareRollback();
```

Pouze GET a stažitelná záloha aktuálního opraveného objektu. Musí se shodovat celý očekávaný otisk po opravě. Jakákoli pozdější změna zápasu znamená STOP, nikoli slepé obnovení staré zálohy. Zkontroluj a ulož soubor BEFORE-ROLLBACK. Potom při zachovaném klidu ostatních administrátorů:

```js
await fc9Repair.rollback({backupSaved: true, exclusiveMaintenance: true});
await fc9Repair.verify();
```

Opět se porovnají čerstvé ETag/obsahy a odešle jediný If-Match PUT na stejný zápas. Z čerstvého objektu se odstraní **pouze federalCupLink**; ostatní pole se nepřepisují starou kopií. Výsledný hash musí být přesně původní a verify musí uvést původní stav bez vazby, allOtherFieldsUnchanged true. Při zjištěných pozdějších změnách návrat zastaví. Při síťové nejistotě nejprve verify, nikdy automatický druhý PUT.

Po reloadu helper i jeho stav zmizí. Lze jej znovu nainstalovat stejným debuggerovým postupem a použít verify / prepareRollback; nepokoušej se obejít předchozí STOP opakovaným commitem.

## Rozsah dosavadního ověření

Přesný soubor `federal-fixture-9-console.js` prošel 15 izolovanými browserovými scénáři proti Firebase mocku včetně skutečného stažení zálohy. Mock používá RTDB storage/REST serializaci (prázdná pole/objekty a null mizí, husté číselné klíče se čtou jako pole, číselná nula zůstává). Hash původního záznamu i záznamu s přesnou schválenou vazbou odpovídá před i po této serializaci. Instalace se ověřila přes skutečné Chrome `debug()`, vybraný pozastavený call frame původní funkce z aktuálního index.html, vložení nezměněného helperu, `undebug()` a resume. Mimo tento scope se instalace bezpečně odmítne. Všechny síťové požadavky byly zachycené, žádné skutečné produkční čtení/zápis. Auth a oprávnění byly mockované; reálná autorizace a konkrétní desktopová verze prohlížeče se musí stále ověřit při ručním použití. Pokud scope nebo ETag nejsou dostupné, bezpečně skončit.

Ověřené primární podklady: [Chrome Console Utilities – debug/undebug](https://developer.chrome.com/docs/devtools/console/utilities?hl=en), [Firebase REST – podmíněný PUT/DELETE a HTTP412; PATCH nemá If-Match](https://firebase.google.com/docs/reference/rest/database/), [Firebase – Updating Data with Conditional Requests](https://firebase.google.com/docs/database/rest/save-data). Dostupnost soukromých aplikačních názvů byla prověřena ve zdrojovém index.html, nikoli spuštěním na produkci.
