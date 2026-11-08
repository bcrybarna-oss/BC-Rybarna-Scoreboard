# Aktuální roadmapa modularizace Poolčítadla

## Pozastaveno kvůli opravě zakládání běžných turnajů

Dominik 8. 11. 2026 upřednostnil samostatnou opravu formuláře a ověřování uložení. Etapy 10b1 a 10b2 jsou nezahájené. [Diagnostika turnaje](ordinary-tournament-draw-v4.51.115.md)

## Dokončeno 10b0 — nasazeno v4.51.114 RC

PR #58 opravuje D4 kontrolou generace relace před GET i před publikací. Čtení ve stejné relaci dál sdílí Promise. Merge `56469c5` je veřejně ověřený. Etapy 10b1 a 10b2 jsou nezahájené. [Nasazení a výsledky](deployment-v4.51.114.md)

## Nasazeno10a — v4.51.113 RC (5. 11. 2026)

Dominik: PR56 merge0933e64 a PR57 merge86bf7af, Pages42089799710 SUCCESS, veřejné soubory/verze/modul a desktop/mobil navigace ověřeny. [Deployment, CI, oddělení mocků a návrat](deployment-v4.51.113.md). Jediný PlayersReadRepository a app-owned instance, původní factory odstraněna. Produkce371/0/0 lokálně, GitHub368/0/3, release/mobilPASS; experiment28/2 nezměněný a viditelný. ŽivéAuth/Rules a D1–D5 zůstávají samostatné, PR55 otevřený.10a dokončena v přijatém rozsahu;10b nezahájena. Příprava níže je historie.

## Aktuální stav 10a — implementováno a izolovaně ověřeno, kandidát113

Dominik5.11.2026: [PlayersReadRepository — rozsah, výsledky a návrat](players-read-repository-stage-10a.md). Jediný produkční collection reader přesunut celý včetně GET adaptéru; původní factory/export odstraněny, aplikace vlastní jednu instanci a publikaci. Produkční Node371/0/0 lokálně, baseline/kandidát desktop/mobil a32 nových kontraktů PASS. Auth/Rules živě neověřeny; D1–D5 a samostatné úkoly zůstávají. Main22a5bcc/112, PR55 zatím otevřený; před sloučením znovu ověřit jeho cloud-readiness i verzi. Nic nesloučeno/nenasazeno,10b nezahájena. Následující návrhy a záznamy jsou historický kontext.

## Historický návrh etapy10 — mapa a rozdělení (5.11.2026)

Výchozí main22a5bcc je **v4.51.112 RC**, včetně Jaroslavova PR54 a oprav úvodní14.1/UNDO. Etapa9 zůstává dokončená v přijatém rozsahu. [Aktuální mapa datových toků, návrh10a–10g a testovací prostředí](data-layer-stage-10-plan.md) zpřesňuje pořadí podle skutečného kódu: nejprve již chráněný společný read hráčů, nikoli univerzální REST framework. Zatím žádná aplikační implementace ani opravy D1–D5, žádný merge/deploy nebo změna verze. Starší obecný plán10 níže označen jako historie. Otevřený Jaroslavův PR55 (kandidát113, cloud-readiness počtu zápasů) není vbaseline; před implementací načíst nový main a zachovat případné přibylé readiness flagy/testy. S1/S2/V1/F1/F2 a reportB beze změny, neimplicitní součást10.

## Aktuální stav — etapa9 dokončena v přijatém rozsahu (v4.51.111 RC)

Dominik31.10.2026:9a NotificationCenter (109),9b1 MatchChallenges a zjednodušená9b2 MatchChallengeActions (společná110),9c OnlinePresence (111) jsou nasazené. PR53 merge6fb8c7d/Pages41231980016 success; [ověření a návrat](deployment-v4.51.111.md). Jedna produkční implementace každé oblasti, jasní vlastníci prostředků a sessionguardy, původní těla odstraněna. Veřejná anonymní kontrola oddělená od izolovaných publikovaných zápisových scénářů. Žádné produkční testovací zápisy, etapa10 **nezahájena** a vyžaduje nové zadání. Historické přípravy/zákazy níže nejsou aktuální stav.

### Samostatné serverové a ověřovací úkoly mimo dokončený rozsah9

- **S1 — bezpečný protokol výzev:** whole-profilePUT, souběh zařízení, atomická hranice, identita operace a průkazný terminální výsledek; [samostatný návrh](challenges-write-conflict-proposal.md). Zatím neimplementovat. Unknown stopka/varování současného klienta nepřežijí restart; reload není odvolání PUT ani bezpečný retry.
- **S2 — serverová lifetime přítomnosti:** posoudit lease/onDisconnect/CAS proti stávajícím Rules a device cestám; zneplatnění klientského ticketu neodvolá odeslanýPUT/DELETE. Stávající freshness zůstává, nový protokol neimplementován a neskrývá se pod přesunem9c.
- **V1 — živý Auth/Rules integrační test:** pouze samostatný testovací projekt/emulátor a schválené scénáře, ne produkční účty či data. Mockované PASS nenahrazuje živéověření.

Tyto úkoly se automaticky nepřidávají do etapy10 ani nejsou označeny za vyřešené nasazením9c. Samostatná PNG nestabilita/mobilníbell a dřívější PDF/cache úkoly zůstávají mimo přesuny kódu.

## Etapa9c — připravený kandidát111, nenasazeno

Dominik31.10.2026: [OnlinePresence](online-presence-stage-9c.md) uzavírá oblast9 jediným vlastníkem globální přítomnosti, rendereru a prostředků. Adaptéry identity/autorizace a VYZVAT zůstávají aplikaci; oprava A→B čekajícího ticketu a staleodpovědí samostatně doložená. Žádný nový serverovýprotokol, Rules, cache ani etapa10. Produkce110 zachována, kandidát111 pouze PR; testy328/0/0 a desktop/mobilparita/úklid/9a/9bPASS, experiment2vady a historickýaudit2vady odděleně. Další oblast vyžaduje nové zadání. Starší „9cnezahájena“ níže je historie před tímto zadáním.

## Nasazeno společné9b1 +9b2 ve v4.51.110 RC

Dominik31.10.2026: PR52→51 integrace32017de, společný main5e14d79/Pages41229438687 success. [Deployment a důkazy](deployment-v4.51.110.md). Reader/cache/obnovy a zjednodušené lokální zápisové guardy jsou produkční; starý povinný žurnál/GETverified nejsou. Unknown upozornění/stopka pouze do restartu, budoucí serverovýprotokol/CAS jen samostatný návrh. Veřejná anonymní kontrola oddělena od izolovaných publikovaných scénářů s mock Auth/Rules; experimentální2vady a historický audit2vady vykázány odděleně.9cnezahájena, další část vyžaduje nové zadání. Následující přípravy/zákazy jsou historie.

## Aktuální stav9b2 po schváleném zjednodušení (31.10.2026)

[Implementace a ověření](challenges-stage-9b2-lean.md) jsou nyní aktuální; níže zachované žurnálové návrhy jsou historie. PR51 zůstává samostatný, PR52 přepracován nad ním, nevydané110/prod109. Povinný journal/reconcile/GET verified odstraněny, pět lokálních oprav a read/write bariéra zachovány. Nejasný výsledek drží pouze paměťovou stopku profilu a nedismissovatelné upozornění při navigaci, nikoli po restartu. Žádný nový serverový protokol ani9c. Lokální produkce318/0/0 a cílené browserové/regresní kontroly PASS; experiment28/2/0 a historický žurnálový audit0/2 zvlášť. Nic neslučovat/nenasazovat.

Zadavatel: Dominik. Aktualizace31.10.2026: produkce109, PR50 merge26c98fdc5309bf5b047c6ef91fcb4c1de87e1205/Pages41217198366 success. Etapy6,7,8 a9a jsou nasazené.9b1 je nyní schválená implementace kandidáta110 (nesloučeno/nenasazeno); A1/9b2/9c nezahájeny. [Funkční ověření, PNG selhání a omezení](deployment-v4.51.109.md). Starší přípravy níže jsou historie.

### Aktuální příprava 9b2 — společné vydání110, nic nasazeno

Dominik31.10.2026 výslovně schválil úzkou9b2 navazující na9b1: [controller zápisových akcí](challenges-stage-9b2.md). Obě části zůstávají společné nevydané110; samotnou9b1 nevydávat. Místo plošného Auth A1 je nyní schválen pouze nezbytný operační ticket+guard před prvním zápisem a při jeho dokončení; celé přihlášení se nepřesouvá. Serverové konflikty/CAS se podle nového zadání pouze [navrhují](challenges-write-conflict-proposal.md), neimplementují. Historická podmínka dokončit celéA1 před9b2 je tímto zpřesněna;9c/ostatníA1 práce nezačínají.

### Aktuální příprava 9b1 (kandidát110)

Dominik schválil menší samostatný rozsah čtení/cache/globálních obnov. [Mapování, opravy proti main, měření a omezení](challenges-stage-9b1.md). Renderer a serverové mutace zůstávají v aplikaci pro9b2; nejde o dokončení jejich zápisového kontraktu. Před9b2 nadále A1.9c se nemění. Kandidát není sloučen ani nasazen; produkce109.

### Nové zadání — návrh úzké9b2 bez žurnálu (zatím neimplementovat)

[Posouzení a plán](challenge-write-simplification-proposal.md):9b1 samostatná, z52 ponechat proven-lokálníguardy/dedup/pořadí a návrh pravdivéhounknownUI bezpovinnéhožurnálu/GETověření. Zbývá explicitní hranice restartu a kompletníwhitelist. Současné2selhávajícížurnálovétesty zůstávají viditelné; přesun pouze jejich mechanismověneplatnéčásti se záchovánímreprodukcí až poimplementaci, nikoli nyní. [Budoucíserverovýprotokol](challenges-write-conflict-proposal.md) samostatnějen návrh. Staršíplán společného110 zůstává historický, pořadíbudoucíchvydání vyžaduje aktuálnífetch/verzi. Nic nesloučeno/nenasazeno.9cnezačíná.

## Historie přípravy 8b — nyní nasazeno108

Dominik,30.10.2026: samostatný kandidát108 odděluje renderer Livescore seznamu/detailu/indikátoru. 8a a předchozí produkční moduly zachované, žádné Firebase/storage/polling v rendereru. [Rozsah, ověření a návrat](livescore-renderer-stage-8b.md). Neslučovat/nenasazovat, etapu9 nezahajovat. Starší údaj „8b nezahájena“ v záznamu nasazení107 výše je historie.

## Historie přípravy 9a — nyní nasazeno109

Dominik,31.10.2026: kandidát109, nesloučen/nenasazen. Rozdělení9a/9b/9c níže je aktuální plán; pouze9a implementována. Historický zákaz etapy9 v záznamu nasazení108 byl nahrazen tímto zadáním.

## Výchozí stav a závazná pravidla

Produkční root index.html načítá deset skutečně používaných modulů: FederalStatistics (čisté výpočty a reportové modely), CloudRefresh (automatické appData relace), OwnReports, FederalViewer, AdminReports, FederalReportRenderer, FederalReportController, LivescoreReader, LivescoreRenderer a NotificationCenter. Starý test-modular/assets/js/pool-core.js je samostatná experimentální větev, nikoli zdroj produkčního bootstrapu. Žádné slučování těchto dvou implementací naslepo.

Každý přesun: jeden vlastník stavu a prostředků, výslovné závislosti, původní tělo odstranit ve stejném PR, žádný tichý fallback. Zachovat práva, payloady a sportovní výsledky. Funkční opravy oddělit od mechanického přesunu a doložit reprodukcí. PR má testy přímo nad produkčním zdrojem, před/po a možnost návratu reverzí bez vracení dat. U každého vydání čerstvý fetch, verze a revize podle AGENTS.md, bez předpokládané automatické výjimky pro stará selhání. Bez produkčních testovacích zápisů.

Vstupní měření: soukromý export27.10.,40 913 440B/189zápasů/26profilů, beze změny a nikdy v repozitáři; cílené scope testy a delší navigační scénář. Časování je orientační; samotný přesun není optimalizace. U reportuB oddělovat výpočet/model, HTML/layout, rasterizaci a download. Limity blokujících úloh a archivnícache se nemají při přesunu vydávat za vyřešené.

## Pořadí a skutečné závislosti

Navržené pořadí6–14 je použitelné jako pořadí oblastí, nikoli jeden PR na oblast. Etapy7/8 potřebují stabilní testy6 a stávající injektované loadery; nepotřebují dokončit celou datovou vrstvu. Etapa9 se musí opřít o výslovný kontrakt identity/oprávnění A níže, nikoli o nové implicitní globály. Kontrakty a adaptéry lze určit před extrakcí všech úložišť10, stejně jako to dělají nynější moduly. Datová vrstva10 musí být hotová před většími přesuny11–13. Závěrečný bootstrap14 nesmí předběhnout stanovení vlastníků prostředků. Bezpečnostní nebo naměřená závada může pořadí změnit jen konkrétním zdůvodněním a schváleným rozsahem.

## 6. Produkční testy a starý test-modular — nasazeno105

- Rozsah/PR6a: přesný inventář sad, test skutečného produkčního login/reload/resume, chování preview loginu s turnajovým fallbackem namísto regexu, viditelné oddělené CI kontroly a souhrnný příkaz zahrnující vše. Preview jádro se plošně neopravuje ani nenasazuje.
- Závislosti: root index.html, pět assetů, současné testové helpery, CI a release policy. Produkce i experiment mají vlastní zdroj a vlastní očekávání; sdílet lze pouze extrakci zdroje a izolované I/O prostředí, nikoli druhý sportovní algoritmus.
- Rizika: falešně zelený výsledek po vyřazení testů, zaměnění preview-only automatické obnovy za produkční chování, přehnané mockování. Zjištěnou produkční vadu opravuje samostatný commit s před/po, nikoli oslabený test.
- Ověření: pending identity bez editace a bez ztráty snapshotu, správný vlastník a odmítnutí jiného účtu, manuální/automatický login, produkční explicitní resume, preview match-first a tournament fallback, kompletní Node sada a relevantní browser regrese.
- Dokončeno, když je inventář úplný, každý skutečný fail/skip pojmenovaný a CI výsledek nezkreslený. Případné přetrvávající experimentální selhání znamená nevyřešený experimentální kontrakt, nikoli potvrzení jeho správnosti nebo automatickou výjimku pro release. Viz testing.md a stage-6-test-contracts.md.

## 7. Renderer A1/A2/B a controller exportů — nasazeno106, následuje historie rozsahu

Aktuální realizace: **7a**, jediný FederalReportRenderer pro HTML/SVG. Modely a výběr identity se nepřesouvají do rendereru; core předává hotové metriky/výsledky. CSS a layout helpery zůstávají zachované. Větší stavový celek dialogu a asynchronních exportů se nyní nepřibírá: **7b musí samostatně převzít open/close/zoom/fokus, generace relace, font/image čekání, chyby, dočasný DOM a bezpečné60s download URL lease**. Dokončení7a není dokončením7b ani celé etapy7. PDF a XLSX se ověřují jako zachované funkce, nikoli přepisují. Podrobnosti a výsledky: [renderer7a](federal-report-renderer-stage-7a.md). Doložena zděděná mezera dokončení exportu při změně relace bez zavření a asynchronní close→open race;7b je musí řešit samostatnými funkčními testy/commitem, nikoli jen přenést.7a má jediný produkční renderer, pixelovou paritu a žádné nové prostředky.

- PR7a: čistá tvorba HTML/SVG šablon z FederalStatistics modelu. PR7b: dialog, návrat fokusu, zoom/resize, exportní generace, object URL a úklid. PR7c: samostatné adaptéry PNG a Pushout XLSX, pokud se vejdou do přehledných hranic.
- Závislosti: hotové modely, společné flag/logo assety, současné html2canvas/PushoutXlsx, dialog DOM. Přístup k datům a oprávněním přes vstupní model/adaptér, nikoli přímo data/currentUser globály. PDF zachovat v původním funkčním rozsahu, dokud není zvlášť odsouhlasen F1.
- Rizika: ztráta fontů/ostrosti, posunutí rozložení, změna partial/unknown prezentace, duplicitní download, pozdní export do zavřeného dialogu, změna formátů. Žádný redesign a žádné nové výpočty.
- Ověření: A1/A2/B nad referenčními exporty, dlouhá jména, barvy/pořadí, FullHD PNG, shodné XLSX hodnoty a typy buněk, mobil/fokus/Escape/chyby/cancel. U B samostatně změřit model/layout/rasterizaci.
- Dokončení: jedna produkční šablona/controller, odstraněná inline těla, stejně čitelné výsledky a exporty, žádné visící listenery/URL/job. Výkon musí být zachován; případná optimalizace je samostatný doložený zásah.

## 8. Čtecí část Livescore

- PR8a: čtecí transport a sdílení in-flight seznamu (bez zápisů). PR8b: koordinátor viditelné obrazovky, dialogu a horního indikátoru. Nelze jej zastavit prostě při odchodu z jedné obrazovky, protože má více konzumentů.
- Závislosti: loadCloudLiveMatches, stream/liveMatches payload, UID/relace, DOM/nav/modal, dosavadní1s tick a15s pozadí. Heartbeat/publikace/OBS zůstávají zvlášť, stejně jako pevná izolaceUID+matchId.
- Rizika: více pollerů, ztracený společný request, pozdní odpověď po účtu A→B, zaměnění omezeného LIVE payloadu za plný resume snapshot.
- Ověření: nav+seznam+dialog současně, přepínání viditelnosti, timeout/reconnect, logout/A→B, max1čtení každé platné relace, zachování OBS URL a streamových režimů.
- Dokončení: výslovné konzumenty a refcount nebo ekvivalentní vlastnictví, start/stop/dispose, nulové prostředky po posledním konzumentovi. Žádná změna publikace, skórování nebo dat.

## A. Samostatná hranice přihlášení a oprávnění

Současný core kombinuje firebaseSignIn/firebaseRefreshAuth, ověření e-mailu, persistence relace, lookup profilu/role, token pro REST, modální UI a počáteční datový merge. editableMatchOwnedByCurrentUser, currentUserIsSystemAdmin, canManageTournament/Series a profilová práva nejsou totéž co transportní přihlášení. Firebase Rules zůstávají skutečnou serverovou ochranou; skrytí tlačítka ji nenahrazuje.

- **A1 — relace a identity:** malý samostatný PR před první serverově zapisující podetapou9 (9b2/9c);9a lokální read-state používá zachycené UID a synchronní guard bez credentials. Vlastník credentials a jejich persistence, epoch/UID, token refresh single-flight, stop/logout a pozdní odpovědi. Konzumenti dostávají snapshot identity + generation a authorize(requestContext); tokeny se neexportují do UI ani logů. Zachovat admin session-only a explicitní offline režim.
- **A2 — capabilities/ownership:** samostatný čistý modul nad ověřenou identitou a explicitním kontextem profilu/turnaje/série. Zachovat creator, skutečné Singles/Doubles účastníky, správce turnaje a system admin podle současných pravidel. Nepřidávat oprávnění a nesjednotit bez důkazu odlišná práva.
- **A3 — login orchestrace/UI:** samostatně až po A1 a jasné hranici dat10. Volá identity→ověření→profil/role→load/merge; explicitní resume zůstane explicitní. Experimentální automatický match/tournament návrat není automaticky produkční funkcí. Reset hesla/registrace/verify-email mají vlastní autorizované transakce.
- Rizika/ověření: expirace tokenu během odpovědi, stejné UID po reloginu, A→B, 401/403, neověřený e-mail, lokální offline ownerless versus účetní zápas, falešné lokální role, opožděný lookup. Browser mocky plus případné serverové Rules testy jen v testovacím projektu; živáAuth není automaticky ověřená.
- Dokončení: jediný vlastník relace a capability API, žádný credential revival po logoutu, práva a datové formáty zachovány, žádná kopie politik v core a modulu. Bez schválení neměnit Firebase Rules ani skutečné uživatele.

## 9. Výzvy, notifikace a online přítomnost — dokončeno v přijatém rozsahu, serverové úkoly S1/S2/V1 zvlášť

Aktuální rozdělení31.10.2026 podle skutečných závislostí nahrazuje původní pracovní9a–9e:

- **9a — centrum notifikací (nasazeno109):** model událostí, řazení/limit30, DOM, lokální přečtení v existujícím UID-scoped JSON, globální vlastník a zrušení odloženého UI efektu. Žádný nový síťový loader. Provider výzev zůstává explicitní závislost. [Mapa a hranice](notifications-stage-9a.md).
- **9b — výzvy:** [9b1 implementována v kandidátu110, čeká na kontrolu](challenges-stage-9b1.md). Výslovně schváleno jako menší samostatné PR, produkce stále109.9b1 vlastník cache a globálních obnov, single-flight sdíleného hráčského čtení a relace/opožděné odpovědi;9b2 transakce odeslat/přijmout/odmítnout/zrušit/protinávrh/odehráno a formulářové callbacky. Tyto části mohou být samostatně nasaditelné PR. Před9b2 je nutná A1 hranice identity+token/request; neprovádět pouhý přesun původních nehlídaných PUT.
- **9c — přítomnost, až nové zadání:** ucelený session/device vlastník GET+PUT/DELETE, aktivity, visibility,30s heartbeat a5s render/warmup. Oddělit jen po zavedení stejné A1 hranice; případné rozdělení menších PR zachová jednoho vlastníka. Samostatný GET bez ochrany souvisejícího writeru by nechal životnost napůl.
- Pořadí:9a odstraní soukromý UI/local-write závod bez zásahu do serverového transportu;9b stabilizuje zdroj výzev a zápisové identity;9c pak použije stabilní session/device kontrakt. Pouhé přejmenování těchto oblastí není dokončení jejich původních vad.
- Zachovat30s výzvy/1200ms warmup a30s presence/5s render-start; globální služby nekončí běžnou navigací. Režim podmíněný viditelností se nepřenáší naslepo mezi službami. Žádné Rules, migrace nebo nový notifikační systém.
- Ověření každé části: skutečný produkční modul, dvě relace a více tabů, logout/reconnect/visibility, init/stop, dedup požadavků, jedno provedení akce a zachycený vlastník/payload před odesláním. Odeslaný zápis nelze logoutem odvolat. Skutečné zápisy jen do izolovaných dat.
- Dokončení: jeden vlastník každého prostředku a mutačního jobu, staré tělo odstraněné, výsledky bez souběhu původní implementace.9a negarantuje starý globální securePlayers transport, výzvy ani presence; jejich známé mezery jsou uvedené v mapě.

## 10. Datová vrstva — návrh, implementace nezahájena

[Podrobný návrh5.11.](data-layer-stage-10-plan.md) je aktuální podklad ke schválení, nikoli již odsouhlasená implementace.

| Pořadí | Hranice menších PR | Dokončení a hlavní závislost |
|---|---|---|
|10a | PlayersReadRepository: přesun celé createPlayersReader a jedinéhoGET players z dnešního core/MatchChallenges | Jeden app-owned reader, původní factory odstraněno,9b2 barrier+single-flight+epoch zachovány; bez opravného RTDB zápisu, pollingu, DOM/cache. |
|10b1/b2 | Surové matches čtení; pak explicitní loader/normalizace/confirmation/historická oprava | Nejprve samostatně rozhodnout opravu D4, zachovat data/repairoprávnění/FC a uložené zápasy. |
|10c1/c2 | Tournaments read; pak read→repair orchestrace | D3 samostatně před přesunem; hybrid čekání, fáze101 a autorizované opravy neskrýt ani nepřepsat. |
|10d1/d2 | AppData read/ETag; pak merge/apply a stávající conditional upload | CloudRefresh zůstává vlastník prostředků, RAM/diskrevize97 a FC conditional save se nezmění. |
|10e1/e2 | Local DB/revize/safety backup; potom recovery/serializace | D5 je samostatná chyba quota při read; zachovat klíče/UNDO112 a pravdivé nedurable chování, žádné jiné úložiště. |
|10f1/f2/f3 | Stávající profile / match+confirmation / tournament writery | D1/D2 a identityguardy odděleně; zachovat pole a PUT/PATCH/DELETE rozsah, žádný nový S1 protokol nebo Rules. |
|10g1… | Malé doménové adaptéry pro ligu/série/hlášení/stream/presence/účty | Zachovat životnost již nasazených modulů, označit bootstrap/mirror/cleanup zápisy; nepřesouvat celé Auth ani herní logiku. |

Každá část má v podrobném návrhu rozsah, rizika, ověření a gate dokončení.10a lze dokončit samostatně při zachování dnešního explicitníhoAuth kontextu; plné A1/A2 je samostatná hranice. Opravy nalezených vad nejsou nenápadnou součástí přesunu. Návrat každého přesunu reverzí bez dat. SkutečnéRules/Auth testy vyžadují samostatné testovací prostředíV1; současné mocky je negarantují.

<details>
<summary>Historický obecný plán10 před mapou5.11.2026 — zachován jako podklad, ne aktuální pořadí</summary>

- PR10a: společný REST transport/ETag/chybové typy a session context bez změny payloadů.10b: úložiště matches a sdílení aktuálníPromise.10c: players/profiles.10d: tournaments/series/leagues.10e: appData read/merge/write jako samostatné transakce, současný CloudRefresh využít, nekopírovat.
- Závislosti: A1, stávající normalize/merge a identifikátory, lokální persistence, tombstones/recovery, dosavadní revize/cache guard97. Cache velikost/politika se nemění (F2).
- Rizika: ztráta undo či příznaků přes serializaci, starší cloud přepíše novější disk, nesprávný ETag, opakované zpracování stejné revize při quota error, stejné UID v jiné relaci.
- Ověření: skutečné soukromé exporty vRAM, Firebase serializace prázdných polí/nul, 401/403/412/offline/lost ack, single-flight a account epochs, žádné duplicitní GET/PUT, plná místní kvóta bez mazání archivu.
- Dokončení: každá větev má jeden repository/transport a definovaného vlastníka stavu, core nemá druhý merge/loader, všechna ztrátová a konfliktní chování explicitní. Zachovat výkonnostní opravy97–104.

</details>

## 11. Výsledky a obecné statistiky

- PR11a selektory a čisté obecné agregace;11b výsledky/historie/detail renderer;11c statistické obrazovky. FC výpočty zůstanou autoritativní, neporovnávat jiné sportovní definice jako stejné API.
- Závislosti: repositories10, profile/participant identity, výběry filtrů, report renderer7, postoje k partial/unknown. Funkce typu completedRealMatchFacts/playerAggregate mají dnes více konzumentů.
- Rizika: drahý celoroční přepočet při běžné navigaci, dvojí statistiky, změna filtrů/sezón a identity hráče, falešná nula.
- Ověření: nezávislé referenční výsledky, skutečné exporty, Singles/Doubles/Team a historické záznamy, opakované otevření/mobil, počty výpočtů a oddělená CPU/layout měření.
- Dokončení: jedna sada selektorů/agregací a konzumentů, parita čísel/diagnostiky, žádné změny definic v rámci přesunu.

## 12. Turnaje a ligy

- PR12a běžná příprava/check-in;12b historická příprava;12c seed/bracket/plán zápasů;12d výsledkové propojení;12e liga čtení/UI;12f ligové mutace. Neoddělovat nový a starý způsob tak, aby vznikla dvě pravidla pro stejný formát.
- Závislosti: data10, právaA2, čisté selectory11, herní start adaptér ke13. Federal Cup má oddělenou konfiguraci, fixture identity a line-up pravidla.
- Rizika: regrese101 (plná kvóta, výběr hráčů, dvě disciplíny a race-to), jiný bracket po reloadu, změna nominací nebo existujících vazeb, nechtěné sdílení stavů FC/běžný/historický.
- Ověření: groupsSKO/DKO, ruční nasazení, skutečné zápasy jednotlivých fází, ukládání/reload/ETag, plná kvóta a varování, FC2026 bloky1–4 a dvojice v obou pořadích, historie výsledků/reportů.
- Dokončení: jasný vlastník návrhu a uložené konfigurace, jedna pravidlová implementace, datová kompatibilita a všechny101regrese zachované. Původní uživatelská kontrola na zařízení je oddělené ověření, ne nahrazena mockem.

## 13. Stav, pravidla, undo, obnova a ukládání rozehraného zápasu

- PR13a formální stav a identity, neměnné snímky;13b8-ball/simple pravidla;13c9/10-ball/detailed a break evidence;13d14.1/ghost/winner-table;13eundo/redo/korekce;13fresume/disk/cloud backup;13gshotclock/heartbeat/stream publikace. Každé další dělení podle skutečné velikosti diffu.
- Závislosti: A1/A2, data10 a pravidlové adaptéry turnajů12. UI nesmí zapisovat přímo mimo jediný vlastník stavu. Canonical detailedPlay a FC actor/rack reference zůstávají současný kontrakt.
- Rizika: sportovní regrese, duplicitní strky/poty, nekonzistence pořadí akcí a undo, ztracený nejnovější snapshot, nerozlišená známá nula a neznámý údaj, cizí účet se dostane k editaci, přepnutí OBS na jiný stream.
- Ověření: tabulkové nezávislé příklady a akční sekvence, každá disciplína, Team/Doubles, quickfinish/RESAFE/inference/pushout/foul, score→undo→reload→Auth→resume, pending identity, více zařízení/mocků a ETag, přesná izolace UID+matchId, PNG/XLSX parita.
- Dokončení: jednotný reducer/engine a vlastník persistence/prostředků, bez paralelních starých těl. Automatické obnovování nebo jiné nové chování vyžaduje samostatné zadání. Žádná migrace uložených dat v mechanickém přesunu.

## 14. Bootstrap, navigace, styly a závěrečný úklid

- PR14a explicitní sestavení závislostí a inicializace;14b navigace/mount/unmount;14c CSS po obrazovkách se zachováním specificity a pořadí;14d odstranění prokazatelně nepoužívaných adaptérů a závěrečný inventář. Mazání archivu/test-modular není automatickou součástí.
- Závislosti: hotoví vlastníci7–13, A1/A2, seznam všech DOM kořenů a assetů, mobilní wrapper/Pages bootstrap.
- Rizika: dvojí init, pořadí scriptů, ztracené globals používané v HTML, scope style regrese a FOUC, nedostupná závislost vyvolá tichý fallback.
- Ověření: čisté spuštění/reload/404 každého modulu, desktop/mobil, offline/login/navigation, všechnyexporty a disciplíny, dlouhý provoz a stabilní počty prostředků. Vizuální přesun bez redesignu.
- Dokončení: malý composition root, explicitní lifecycle, žádné inline duplikáty, testy autoritativní produkční větve, zdokumentované veřejné API a postup návratu. Historické experimenty se rozhodnou zvlášť podle jejich významu a zachování důkazů.

## Samostatné úkoly mimo přesuny

- **F1 — odstranění PDF:** zvlášť schválit UI/klávesové odkazy/závislosti/jsPDF a chování starých odkazů. PNG a Pushout XLSX zachovat. Neoptimalizovat ani odstraňovat PDF implicitně v7.
- **F2 — archivní cache:** zvlášť navrhnout kapacitu, IndexedDB/selektivní cache, offline/recovery a možnosti zálohy; žádné automatické mazání uživatelských dat. Nemíchat do10 prostým přejmenováním loaderů.
- **F3 — výkon B:** samostatně po měření určit, zda blokuje výpočet, DOM, fonty nebo rasterizace. Modulový přesun sám tento úkol neuzavírá.

Každý bod potřebuje samostatný přezkoumatelný PR a výslovné schválení vydání. Tato roadmapa nepovoluje sloučení nebo nasazení žádné etapy.

Viz [controller7b](federal-report-controller-stage-7b.md), navazující samostatné PR na7a pro společné nevydané106.

29.10.2026: etapa7a+7b společně nasazena106, merge2b8edcf, nikoli oddělené verze. [Ověření, meze a návrat](deployment-v4.51.106.md). Etapa8 ani další oblast nezahájena.

29.10.2026: zahájena8a, společný produkční reader/koordinátor Livescore, kandidát107 zmain106. [Rozsah, cleanupzápisy, měření a návrat](livescore-reader-stage-8a.md). UIrenderery zůstávají případná8b; oblast9 nezahájena.
