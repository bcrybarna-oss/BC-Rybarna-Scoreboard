> Historický podklad. Aktuální schválenou implementaci, testy a omezení popisuje [zjednodušená9b2](challenges-stage-9b2-lean.md); tento doklad zůstává beze změn pro audit.

# Návrh zjednodušení9b2 bez povinného žurnálu

Zadavatel: Dominik,31.10.2026. **Pouze návrh, bez změn aplikace nebo testových sad.** PR51/9b1 a PR52/9b2 nejsou sloučené ani nasazené. Main zůstává fade611/produkce109, pracovní head213f87f. Pět oprav závodů je přijato, návrh jejich zjednodušeného vydání čeká na rozhodnutí.

## Doporučené rozdělení

1. Zachovat PR51 a samostatný produkční MatchChallenges pro čtení, cache a obnovy. Nepřidávat do něj serverový protokol, žurnál ani automatické retry.9b1 sama neřeší staré zápisové závody109, ale lze ji technicky nasadit nezávisle na52 po zvláštním schválení a finálních kontrolách.
2. Přepracovat obsah stávajícího PR52 na **úzký controller životnosti akcí**. Odstranit readJournal/set/remove/reconcile, související storage/operationId/readProfile závislosti a automatický závěr verified ze shodyGET. Nenahrazovat žurnál IndexedDB, sessionStorage, jiným persistentním úložištěm nebo automatickým replay. Do controlleru přidat pouze stav nejasného výsledku pro běžící instanci a jeho pravdivé UI.
3. Skutečně bezpečný serverový protokol je samostatný budoucí celek, až po odsouhlasení [konkrétního návrhu](challenges-write-conflict-proposal.md). Žádné nové serverové formáty či Rules v minimální52.

Odstranění žurnálu **nevyžaduje zásadní přepsání pěti oprav**. Je oddělené od ticket/current, jobs/fronty i revision/barrier. Proto nedoporučuji další novýPR jen pro odstraňování žurnálu. Pokud by kompletní validace profilové obálky nebo požadavek na přežití upozornění přes restart vyžadoval širší zásah, tuto část nejprve oddělit od životnosti akcí; nenahrazovat ji nebezpečným kopírováním či přepisem.

Verze: obě části nyní mohou zůstat společný nevydaný110. Pokud bude samostatně schválena a skutečně nasazena9b1 jako110, pozdější funkční52 musí po fresh fetch dostat následující verzi111 (pokud ji neobsadí jiná změna). Dvě různá nasazení pod110 nejsou přípustná. Tento návrh sám verzi nezvyšuje.

## Co lze zachovat a proč

| Záruka | Mechanismus nezávislý na žurnálu | Ověření / hranice |
|---|---|---|
|A čeká na autorizaci a nepoužije B|ticket UID/profil/epoch/scope, guard před tokenem i předfetch|platnost relace není odvozena zlocalStorage|
|Doručený výsledek A nezmění novéUI B|current guard pro commit/callbacky/finally, fingerprint konceptu a generace dialogu|odeslaný požadavek se neprohlašuje za odvolaný|
|Dvojí kliknutí nevytvoří dvaPUT|jobs podle vlastníka/profilu/zdroje, sdílená promise, jedna completion|jen probíhající stejná akce vjedné instanci; žádná záruka mezi zařízeními/reloady|
|Jednoznačně odmítnuté přijetí nezůstane accepted|žádná spekulativní mutace, commit až po přímém2xx|výslovné odmítnutí je jiný stav než nejasná síťová chyba|
|StarýGET nepřepíše potvrzený místníPUT|read revision/write barrier, kontrola revize předapply|platí pro zapojenou čtecí cestu a zdejší zápisy; nebudoucí požadavek jiného klienta|
|Zachycené vstupy a pořadí zdejších akcí|projekce vstupů předawait, profilová fronta|všechny nové kopie musí mít whitelist; fronta není serverová transakce|

Izolovaný experiment odpojil journal dependency skutečného produkčního controlleru pomocí preload adaptéru s prázdným providerem a bez persistence. **7 vybraných kontrol PASS**: prvních5 případů, capture+profilová fronta a A/B bariéry. Jiné8controller testů nebylo součástí tohoto experimentu; některé na žurnálu výslovně závisejí. Není to upravená produkční implementace ani kompletní browserový důkaz po odstranění žurnálu. Neopravňuje tvrdit, že hotový návrh je už otestovaná aplikace. Doložena je oddělitelnost záruk od persistence/reconcile.

## Nejasný výsledek bez žurnálu

Navrhuji rozlišit `pending`, `acknowledged`, `rejected`, `unknown`. Nikdy nevyvozovat acknowledged zGETshody. Po přímém2xx commit správnému aktuálnímu vlastníkovi; pozdější chyba seznamu nemění výsledek zápisu. Jednoznačně odmítnutý požadavek nemění místní stav a nový výslovný pokus může být nabídnut podle příčiny. Výpadek/408/5xx po odeslání je unknown.

Při unknown:

- NedělatPUT znovu, nevolat automatický resolver, nepřevádět běžné čtení z9b1 na potvrzení operace.9b1 smí dál zobrazovat aktuálně pozorovaná data; jejich shoda/neshoda nezruší unknown upozornění.
- Držet v paměti pouze stav nejistoty podleUID/profilu a malý whitelist metadat proUI (typ akce, IDvýzvy, čas). Neukládat kopii celé výzvy/profilu ani credentials; žádný nový trvalý žurnál. Stav jiného účtu se nezobrazuje, ale při návratu A vtéže instanci zůstane A upozornění.
- Doporučuji vtéže běžící instanci nepovolit další profilové zápisy **výzev** daného vlastníka. Celý starý profilovýPUT může jinak dorazit po novémPUT; blokace jen stejné výzvy nestačí. Blokace se vztahuje i na již čekající akce ve frontě, které ještě nezačaly síťovýzápis; nedovolí je po unknown automaticky rozběhnout. Jejich neodeslání neruší původní odeslanouoperaci. Skrytí upozornění není odblokování. Ostatní účty a obecná navigace pokračují. Žádná neomezená bariéra pro čtení: po ukončení klientského čekání se čtecí prostředky uvolní, unknown zůstává samostatný stav.
- Jedno trvale viditelné upozornění vcentru výzev a odkaz na něj vnotifikaci stavu. Žádný toast s1800ms jako jediný nosič. Neobsahuje tlačítko „bezpečně zopakovat“, automatický refresh proodblokování ani tvrzení „vráceno“.

Navržený text: **„Výsledek změny výzvy neznáme. Server ji mohl uložit. Akci neopakujte — mohlo by dojít k duplicitě nebo přepsání dat. Zobrazený stav je pouze poslední načtená hodnota; obnovení stránky nepotvrzuje dokončení. Rozpracované údaje zůstaly v této stránce.“** Doplnit konkrétní akci/výzvu/čas ze zachycených povolených metadat. Při pozdním přímémACK lze stav uzavřít; pouhá shodaGET k tomu nestačí.

**Zásadní hranice ke schválení:** „trvalé“ zde znamená nezmizet během běžící instance a navigace. Bez persistence nebo serverové evidence nelze zaručit obnovení tohoto konkrétního upozornění po reloadu/zavření/pádu. Reload nejistotu neřeší, pouze může odstranit místní informaci o ní. Pokud má upozornění nutně přežít restart, je to další požadavek na perzistenci či serverový protokol, který tento návrh bez žurnálu sám nesplní. Nelze jej tiše obejít novým úložištěm nebo prohlásit za bezpečný reset.

I bez žurnálu je nutné zkontrolovat hook completeScheduledChallengeForMatch po opakovaném uložení dokončeného zápasu: nesmí se změnit vnáhradní replay nejasné operace. První legitimní dokončení výzvy zachovat; automatické obnovy a návraty spojení nesmějí přidat nový mechanismus opakování. Po restartu bez evidence příčiny zůstává stejná nejistota jako v109, nikoli nová záruka.

## Riziko proti aktuální produkci109

| Situace | Produkce109 | Navržená úzká9b2 |
|---|---|---|
|Změna A→B při čekání|doložené smíchání identity/těla nebo staréUI dokončení|odstraněno zachovanými guards|
|Dvojí probíhající kliknutí|některé akce2PUT|jedna probíhající akce vinstanci|
|Odmítnutí a staréčtení|falešný accepted / ztracený místní výsledek|odstraněno bezžurnálovými opravami|
|PlnélocalStorage|staré cache chyby zachytávané, není nový povinný receipt předPUT|nevznikne nová povinná zápisová překážka; i chyby staré cache neznamenají vrácený úspěch|
|NejasnýPUT během běžící instance|obecná chyba, ruční opakování může poškodit data|pravdivé unknown, bez automatickéhoPUT, doporučená blokace dalších zdejších výzev|
|NejasnýPUT po reloadu / jiný tab či zařízení|bez průkazného výsledku a bez globální deduplikace|**toto riziko zůstane**; nelze slibovat exactly-once ani bezpečné opakování|
|Nezávislé přepisy celých profilů|možná ztráta souběžných změn|stále možné mezi klienty i mimo zdejší frontu; žádná transakce se netvrdí|

Návrh nezavádí nový automatický retry oproti109. Bez žurnálu znovu nepřidá dostupnostní regresi při plné kvótě. Je však nová záměrná lokální blokace po unknown, která může vyžadovat ukončení práce s výzvami do manuálního posouzení. To je bezpečnostní kompromis, **ne vyřešení serverové nejistoty**.

## Whitelist — podmínka implementace

Než budeúzká52označena za vydatelnou, nahradit nekontrolované JSONcopy/spread explicitními mapovači:

- Akční vstup: pouzekind, IDvýzvy, povolená pole dané akce; uplayed pouzematchId/endedAt. Counter: flexibleTime/date/time/venue/note. Kontext identity:authenticated/UID/profileId/generation/scope. Typy/délky a nebezpečné klíče validovat,credentials nepřenášet.
- Snapshot výzvy: explicitní známá pole id,senderUid,recipientUid,senderPlayerId,recipientPlayerId,status,discipline,raceTo,flexibleTime,date,time,venue,note,isPublic,createdAt,updatedAt,acceptedAt,counterByUid,playedMatchId,playedAt,responseUpdatedAt. Potvrdit přípustnost volitelných polí na skutečných podkladech. Žádný JSONcopy celého cachovanéhoobjektu.
- Nový UI unknown stav: pouzeUID/profil,typakce,IDvýzvy,čas. Žádné tělo profilu, poznámka nebo token. Žádná nová persistence.
- U nadále používaného celoprofilovéhoPUT je nutný validovaný adaptér úplné profilové obálky a vnořených map výzev. **Nelze jen zahodit neznámá profilová pole**: to by přiPUT smazalo serverová data. Při neznámém tvaru bezpečně odmítnout před sítí a ukázat chybu kompatibility; rozšířit seznam pouze na doloženém modelu. Není přípustné whitelistovat jen vstup controlleru a poté ve writeru znovu přenést celý nekontrolovaný profil.

Průzkum podkladového exportu27.10:26profilů/23různých názvů polí; pouze1sender záznam,18polí,0response záznamů. Tento vzorek **není kompletní schéma**. Doplnit zdrojové konstruktory,onboarding,claimy,merge/legacy pole a nezávislé fixture. Dokud obálka není doložená, plnou deklaraci vydatelnosti52 nepodepíšu. Neměnit přitom serverový datový formát, práva ani tichou normalizací nečistit produkční data.

V9b1 zachovat samostatného vlastníka cache/čtení. Každá nově dotčená kopie i cache projekce vnavazujícím diffu musí používat explicitní mapovač; nevydávat zachovanou starou generickou kopii za novou bezpečnostní záruku. Případný nutný hardening pureprojekce v9b1 jasně označit a znovu ověřit kompatibilitu, bez přimíchání writeru/protokolu.

## Co s testy

**Nyní nic nemazat, nepřesouvat ani neoslabovat.** Běžná produkční sada aktuálního kódu stále309PASS/2FAIL/3SKIP bez lokálních privátníchfixture. Dvě nové vady nejsou staré experimentální chyby.

Po výslovném schválení implementace:

1. Původní chybné chování žurnálu zachovat jako reprodukci na konkrétním historickém commitu a popsat odstraněnou funkcionalitu. Neoznačovat dřívější failing test za opravený pouhým odstraněním souboru.
2. Část testu „přiGETshodě nesmí vzniknout falešnýACK“ **zůstává produkční zárukou**: nový test unknownnotice+0PUT+neukončenýstav i při shoděGET. Pouze žurnálově specifické očekávání zachování storagezáznamu přestane platit.
3. Whitelist chyba se nepřesouvá mimo produkci: ověřit, žeidToken/password/refreshToken a neznámé hodnoty nevstoupí do nového snapshotu/odesílaných dat. U neznámých původních profilových polí nedojde kmazání dat — odmítnutí0PUT.
4. Budoucímu protokolu patří testy průkazného serverovéhoreceiptu, idempotentního opakování stejnéhoopId a konfliktu jinýchrevizí, jasně označené dosud neimplementované. Nevytvářet dnešníPASS nad mockem, který už předpokládá neexistující serverovou garanci.
5. Zachovat pět před/po reproduktorů, všechny6akce/payloady, skutečné založení match s vazbou, unknown přes navigaci/A→B→A, blokaci jižčekajícíchjobů po unknown, pozdníACK i odpověď po zavření, chyba refresh poúspěchu. Přidat plné/denied localStorage bez povinnéreceiptu: potvrzené akce nejsou blokované, koncept zachován; po unknown není automatický replay.
6. Browserově otevřeně ukázat hranici reloadu: žádný replay zavedený controllerem ani falešné „vyřešeno“, ale paměť neobnoví neznámou předchozíoperaci. Zkontrolovat i background completionhook.
7. Finální release+produkční sada musí projít vnovém rozsahu. Experimentální vady vykazovat jednotlivě; PNGparitu samostatně odGitHubCI, se zachováním jejíhistorické nestability.

## Doporučení před vydáním

Nejprve schválit tento omezený kontrakt včetně hranice upozornění po reloadu a whitelistu profilu. Potom přepracovat52, beznovéhožurnálu, a znovu provést celý relevantní release/browser/regresní gate.9b1zůstává samostatná a nic se nyní nenasazuje. Podmíněný/serverovýprotokol čeká na zvláštní schválení. Návrat úzké9b2 reverzí kódu s novou verzí, bez datové migrace, vrátí původní klientské závody; není řešením už odeslaného nejasného požadavku.

## Reprodukovatelnost izolovaného experimentu

Jde výhradně oNode testovacípreload, nikoli navržený produkční fallback. Načte skutečnýmodul a pouze proexperiment předá prázdné journal dependency. Není importován zindex.html:

```js
const file = require.resolve('../../assets/js/match-challenge-actions.js');
const api = require(file);
require.cache[file].exports = {
  ...api,
  create: options => api.create({
    ...options,
    journal: { keys: () => [], getItem: () => null, setItem() {}, removeItem() {} }
  })
};
```

Lokální preload je voutput/simplification-proposal/no-journal-preload.cjs. Spuštěno `node --require ./output/simplification-proposal/no-journal-preload.cjs --test --test-name-pattern='^1:|^2:|^3:|^4:|^5:|captured inputs|B reads' tests/match-challenge-actions.test.cjs`. Výsledek7/0; plnáaktuální sada zůstává309/2/3. Source JSONcopy a chybějící unknownUI tímtoexperimentem opraveny nejsou. Proto jej nelze použít jako náhradu finálních testů upravenéaplikace.
