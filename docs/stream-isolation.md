# Izolace OBS streamů — v4.51.86 RC

Zadavatel: Dominik, 22. 10. 2026. Samostatná oprava z main `5244c3c55b319e34e5ccc9dbf6cdda9578c7e90d`, [PR #25](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/25), kódový commit `246ce52b30d13df3d774f7dc9a2aeb0f7cd722ca`. Pouze připravené vydání: **nesloučeno a nenasazeno**, během současného streamu se nesmí nasazovat. PR #22 se nemění.

## Příčina incidentu

`discoverActiveUid()` četla celý `/stream/users`, vybrala nejnovější aktivní záznam a měnila UID i při původně explicitním `?uid=...`. `poll()` to spouštěl po chybějících/neaktivních datech nebo stáří 20 sekund. Samotné UID navíc není identifikátor zápasu: všechny zápasy stejného účtu publikují do `/stream/users/{uid}`, takže druhý zápas stejného účtu může nahradit obsah tohoto místa. `matchId` už v původním veřejném payloadu existoval, overlay ho ale nekontroloval.

## Oprava a datový tok

- Nová adresa obsahuje **UID i matchId**, shodně v query a hash: `overlay.html?v=13&uid=U&matchId=M#uid=U&matchId=M`. Pevná adresa konkrétního zápasu je dostupná přímo ve společném panelu streamu v obou počítadlech. Pro další zápas se do OBS kopíruje jeho nová adresa.
- Overlay čte výhradně `/stream/users/U`. Nemění UID, nečte kolekci ostatních uživatelů a nemá automatické discovery. Zobrazí pouze aktivní, čerstvý payload s přesně shodným matchId. Jiný zápas stejného UID znamená **nedostupnost**, nikdy převzetí obrazu.
- Po 20 sekundách bez aktuálních dat, při HTTP chybě, chybném JSON, chybějícím ID nebo výpadku spojení zobrazí nedostupnost. Po návratu původního zápasu se obnoví jeho obraz. Čas v budoucnosti o více než 5 sekund je neplatný; zařízení musí mít přibližně synchronizované hodiny.
- Poll má timeout 5 sekund a nepřekrývá se s jiným pollem. Nedostupnost zahodí poslední frame; otočení/resize jej nemůže znovu zobrazit.
- Publikace používá původní cestu, payload a čtyři hodnoty `live/pause/soon/end`. Zachytí UID a zápas před asynchronní obnovou tokenu a při změně identity/zápasu zruší odeslání. Skórování, statistiky, ukládání zápasů a Firebase Rules se nemění.
- Ukončení/zrušení streamu dostává konkrétní matchId. Nejdřív čte aktuální payload a ETag; zneaktivní jej pouze při shodném matchId a podmíněným PUT If-Match. Pokud jiný zápas mezitím převzal slot, HTTP 412 se nepřepisuje ani neopakuje bez podmínky. Při chybějícím ETag/odmítnutém čtení nic nemaže; starý stav pak vyprší.

## Kompatibilita starých OBS URL

| Adresa | Chování |
|---|---|
| `?uid=U&matchId=M` nebo totéž v hash | Pevná vazba na U/M, funguje i bez localStorage a Web Locks. |
| Staré `?uid=U`, `#uid=U`, shodná query + hash | Při prvním platném čerstvém payloadu účtu U jednorázově uloží matchId. URL v browseru doplní o matchId; původní stará URL po reloadu použije uloženou vazbu. Nikdy nepřejde na jiné UID ani další matchId. |
| Stará URL bez UID | Nedostupnost a pokyn zkopírovat adresu zápasu. Dřívější `bcOverlayUid` se nepoužívá, protože jej mohla znečistit automatická volba cizího streamu. |
| Rozporné query/hash, různé opakované UID/matchId, neplatné znaky | Nedostupnost bez čtení streamu. |
| UID-only bez funkčního úložiště nebo bez Web Locks při prvním připojení | Bezpečně odmítne první vazbu a žádá konkrétní adresu zápasu. Existující pevná adresa tyto závislosti nemá. |

První vazba UID-only URL je nutně na právě publikovaný zápas daného účtu; stará adresa sama nemůže určit, který zápas obsluha zamýšlela. **Pro zaručený výběr zápasu doporučujeme explicitní novou adresu s matchId.** Vazba legacy je uložena podle origin/path/UID; Web Locks serializují první připojení více zdrojů. Explicitní URL jiného zápasu starou legacy vazbu nepřepisuje. Vymazání browser storage odstraní i tuto vazbu. Pro přechod staré UID-only adresy na další zápas použít novou adresu s matchId, nikoli spoléhat na samovolné přepnutí.

Již otevřený starý OBS browser source používá starý JavaScript až do obnovení. Oprava se během nynějšího vysílání nenasazuje. Po následném schváleném nasazení je nutné obnovit zdroj OBS a pro jistotu zkopírovat adresu konkrétního zápasu z nového panelu. Nelze opravit chování starého načteného klienta bez jeho obnovení.

## Dva zápasy jednoho účtu — vědomé omezení

Tato cílená oprava nevytváří novou databázovou strukturu ani nemění oprávnění. Nadále existuje **jeden publikační slot na UID**. Souběžné počítání dvou zápasů stejným účtem může přepisovat obsah slotu a způsobit nedostupnost overlaye prvního zápasu. Jeho obraz však nesmí přejít na druhý zápas. První matchId zůstává připnutý a jeho nové správné payloady se znovu zobrazí.

Pro současný nepřerušovaný přenos dvou zápasů mají obsluhy použít oddělené účty. Plně nezávislé souběžné kanály stejného UID by vyžadovaly per-match cestu nebo serverový broker a ověření jejích skutečných Rules i kompatibility starých publisherů. Tato změna se nepřidává do kritické opravy naslepo.

Izolace obrazu není serverová autorizace: kdo by měl skutečné právo zapisovat na cizí cestu a podvrhnout i matchId, není zastaven jen touto kontrolou. UID/matchId nejsou autentizační tajemství. Případné veřejné čtení streamů se nemění.

## Ověření

- `node --test tests/stream-isolation.test.cjs`: **9/9**, vykonává skutečný skript z aktuálního overlay.html v izolovaném VM. Identita UID+matchId, stáří, chybové odpovědi, reset posledního frame, staré URL a reload, query/hash konflikty, odmítnutí starého auto-cache, chování bez storage/Web Locks a serializace pollů. Žádná síť ani databáze.
- `npm run test:stream-isolation`: skutečný produkční index.html a overlay.html v Chrome, oddělené kontexty publisherů A/B a druhého zápasu stejného UID, společný RTDB mock. A → aktivace B bez změny A; **simulovaný čas +21,001 s** bez dat A při čerstvém B → nedostupnost, nikoli B; návrat A → původní obraz. Jiný zápas stejného UID, reload explicitní i původní legacy URL, zabránění starému clear, GET/PUT závod s 412 a obnovení, chybějící/neaktivní/staré/neplatné payloady, HTTP 403/404/500, chybné JSON, výpadek, resize, hash a absence UID. **0 globálních discovery GET, 0 page errors, veškerá síť zachycena.**
- Negativní kontrola téhož browser scénáře proti původnímu overlayi z main 5244c3c chybu reprodukuje: po výpadku A přejde na B a test podle očekávání selže.
- `npm run test:stream`: všechny čtyři kombinace simple/full × overlay ON/OFF, původní čtyři režimy až do skutečného overlay.html, jména/skóre, reload/přihlášení a explicitní obnova, desktop/mobil/landscape/320 px — prošlo. Při záměrném startu nového zápasu test používá jeho novou konkrétní URL; starou URL proti nechtěné změně testuje zvlášť izolační sada.
- Detailní počítadlo, Federal Cup a release-version browser prošly s 0 page errors, produkční síť blokovaná.
- Úplná Node sada: **108/110**, pouze dvě známé nezměněné chyby preview-match-reload-recovery v test-modular (reload bez identity a obnova po přihlášení). Release gate proti čerstvému origin/main a git diff --check prošly. [GitHub CI kódového commitu](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39730730115): release job success, Node 108/110; logy ověřeny, pouze tytéž dva známé testy (řádky 50 a 106). Mobilní screenshoty společného panelu s novou adresou byly vizuálně zkontrolovány. Následný dokumentační záznam nemění otestované HTML.

Skutečná produkční Auth/Rules/CORS, systémové OBS, mobilní nativní browsery, fyzické telefony, zátěž a síťové vlastnosti Firebase nejsou mockem potvrzeny. Testy neprovádějí žádné produkční zápisy ani čtení dat živých zápasů.

## Návrh omezení omylné aktivace — zatím NEIMPLEMENTOVÁNO

Repozitář neobsahuje export skutečně nasazených RTDB Rules. Jejich současná oprávnění proto nebyla ověřena a nesmějí se odvozovat z viditelnosti tlačítek, e-mailu v klientovi nebo výsledků mocku. Před změnou si vyžádat/exportovat aktuální Rules a ověřit je v emulátoru.

Návrh pro následné schválení:

1. Zápis `/stream/users/$uid` povolit jen ověřenému Firebase účtu s `auth.uid === $uid` a serverově spravovaným oprávněním `canStream` (custom claim nebo chráněný serverový grant). Běžný uživatel si grant nesmí sám zapsat. Role či e-mail v localStorage nejsou oprávnění. Claims nastavuje důvěryhodný Admin SDK/server; po změně zajistit obnovu tokenu. Viz [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims).
2. Prověřit také nadřazená `.read/.write`: širší povolení na rodiči nelze zúžit zákazem na dítěti. Nepovolit globální výpis streamů jen proto, že cílené čtení pro OBS musí fungovat. Validovat veřejný payload a identity. Viz [Realtime Database Rules](https://firebase.google.com/docs/database/security).
3. UI může zobrazovat přepínač podle serverového grantu a předvolit overlay OFF, ale to je pouze prevence omylu; přímý REST zápis musí stejným způsobem odmítnout server.
4. Před nasazením pravidel otestovat nepřihlášený účet, účet bez grantu, A→cizí UID B, vlastní účet s grantem, odebraný grant/token refresh a dosavadní read-only OBS. Zohlednit, že `clearStreamState` nyní bezpečně vyžaduje GET/ETag; nesmí získat širší zápis.

V tomto PR se nemění checkbox default, role, grants, účty, skutečná Rules ani veřejná oprávnění. Oprava výběru overlaye není tvrzením, že serverová autorizace je správně nastavena.
