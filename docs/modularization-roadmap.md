# Aktuální roadmapa modularizace Poolčítadla

Zadavatel: Dominik. Platnost: **29. 10. 2026**, základ `origin/main` / `28f45bd32483d8c8275c23d6aac14480dfc8ee6f`, nasazená v4.51.104 RC. Toto je aktuální společný plán; starší plány v revizích, PR6, test-modular README a etapových dokumentech jsou historické podklady, nikoli paralelní pokyny. Schválena je nyní pouze etapa6. Etapa7 ani další implementace tímto dokumentem nezačínají.

## Výchozí stav a závazná pravidla

Produkční root index.html načítá pět skutečně používaných modulů: FederalStatistics (čisté výpočty a reportové modely), CloudRefresh (automatické appData relace), OwnReports, FederalViewer a AdminReports. Starý test-modular/assets/js/pool-core.js je samostatná experimentální větev, nikoli zdroj produkčního bootstrapu. Žádné slučování těchto dvou implementací naslepo.

Každý přesun: jeden vlastník stavu a prostředků, výslovné závislosti, původní tělo odstranit ve stejném PR, žádný tichý fallback. Zachovat práva, payloady a sportovní výsledky. Funkční opravy oddělit od mechanického přesunu a doložit reprodukcí. PR má testy přímo nad produkčním zdrojem, před/po a možnost návratu reverzí bez vracení dat. U každého vydání čerstvý fetch, verze a revize podle AGENTS.md, bez předpokládané automatické výjimky pro stará selhání. Bez produkčních testovacích zápisů.

Vstupní měření: soukromý export27.10.,40 913 440B/189zápasů/26profilů, beze změny a nikdy v repozitáři; cílené scope testy a delší navigační scénář. Časování je orientační; samotný přesun není optimalizace. U reportuB oddělovat výpočet/model, HTML/layout, rasterizaci a download. Limity blokujících úloh a archivnícache se nemají při přesunu vydávat za vyřešené.

## Pořadí a skutečné závislosti

Navržené pořadí6–14 je použitelné jako pořadí oblastí, nikoli jeden PR na oblast. Etapy7/8 potřebují stabilní testy6 a stávající injektované loadery; nepotřebují dokončit celou datovou vrstvu. Etapa9 se musí opřít o výslovný kontrakt identity/oprávnění A níže, nikoli o nové implicitní globály. Kontrakty a adaptéry lze určit před extrakcí všech úložišť10, stejně jako to dělají nynější moduly. Datová vrstva10 musí být hotová před většími přesuny11–13. Závěrečný bootstrap14 nesmí předběhnout stanovení vlastníků prostředků. Bezpečnostní nebo naměřená závada může pořadí změnit jen konkrétním zdůvodněním a schváleným rozsahem.

## 6. Produkční testy a starý test-modular — aktuální etapa

- Rozsah/PR6a: přesný inventář sad, test skutečného produkčního login/reload/resume, chování preview loginu s turnajovým fallbackem namísto regexu, viditelné oddělené CI kontroly a souhrnný příkaz zahrnující vše. Preview jádro se plošně neopravuje ani nenasazuje.
- Závislosti: root index.html, pět assetů, současné testové helpery, CI a release policy. Produkce i experiment mají vlastní zdroj a vlastní očekávání; sdílet lze pouze extrakci zdroje a izolované I/O prostředí, nikoli druhý sportovní algoritmus.
- Rizika: falešně zelený výsledek po vyřazení testů, zaměnění preview-only automatické obnovy za produkční chování, přehnané mockování. Zjištěnou produkční vadu opravuje samostatný commit s před/po, nikoli oslabený test.
- Ověření: pending identity bez editace a bez ztráty snapshotu, správný vlastník a odmítnutí jiného účtu, manuální/automatický login, produkční explicitní resume, preview match-first a tournament fallback, kompletní Node sada a relevantní browser regrese.
- Dokončeno, když je inventář úplný, každý skutečný fail/skip pojmenovaný a CI výsledek nezkreslený. Případné přetrvávající experimentální selhání znamená nevyřešený experimentální kontrakt, nikoli potvrzení jeho správnosti nebo automatickou výjimku pro release. Viz testing.md a stage-6-test-contracts.md.

## 7. Renderer A1/A2/B a controller exportů

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

- **A1 — relace a identity:** malý samostatný PR před první zapisující podetapou9. Vlastník credentials a jejich persistence, epoch/UID, token refresh single-flight, stop/logout a pozdní odpovědi. Konzumenti dostávají snapshot identity + generation a authorize(requestContext); tokeny se neexportují do UI ani logů. Zachovat admin session-only a explicitní offline režim.
- **A2 — capabilities/ownership:** samostatný čistý modul nad ověřenou identitou a explicitním kontextem profilu/turnaje/série. Zachovat creator, skutečné Singles/Doubles účastníky, správce turnaje a system admin podle současných pravidel. Nepřidávat oprávnění a nesjednotit bez důkazu odlišná práva.
- **A3 — login orchestrace/UI:** samostatně až po A1 a jasné hranici dat10. Volá identity→ověření→profil/role→load/merge; explicitní resume zůstane explicitní. Experimentální automatický match/tournament návrat není automaticky produkční funkcí. Reset hesla/registrace/verify-email mají vlastní autorizované transakce.
- Rizika/ověření: expirace tokenu během odpovědi, stejné UID po reloginu, A→B, 401/403, neověřený e-mail, lokální offline ownerless versus účetní zápas, falešné lokální role, opožděný lookup. Browser mocky plus případné serverové Rules testy jen v testovacím projektu; živáAuth není automaticky ověřená.
- Dokončení: jediný vlastník relace a capability API, žádný credential revival po logoutu, práva a datové formáty zachovány, žádná kopie politik v core a modulu. Bez schválení neměnit Firebase Rules ani skutečné uživatele.

## 9. Výzvy, notifikace a online přítomnost

- Tři oblasti rozdělit:9a čtení/řazení notifikací a scoped renderer;9b lifecycle výzev a jejich čtení;9c samostatné mutace výzev;9d presence GET;9e presence PUT/DELETE a aktivita zařízení. Ne jeden velký PR.
- Závislosti: A1/A2, cloud transportní adaptéry, profilové identity, plánované zápasy a události dokumentu. Současné30s intervaly/1200ms warm-up,5s render/start musí mít jednoznačného vlastníka. Presence je relace/zařízení, nikoli jen jedna obrazovka.
- Rizika: duplicitní notifikace a výzvy, pozdní mazání presence jiného účtu, automatické zápisy po logoutu nebo v anonymním režimu, ztráta potvrzení akce.
- Ověření: dvě relace, více panelů/tabů, logout/reconnect/visibility, opakovaná init, dedup notifikací, právě jeden zápis každé akce a idempotence při ztrátě potvrzení, výhradně izolovaná data.
- Dokončení: vlastník každého zdroje a mutačního jobu, nepřibývající prostředky, zachované role/pravidla, pozdní výsledky izolované podle identity. Čtecí a zapisující opravy se nemají zaměnit za čistý přesun.

## 10. Datová vrstva

- PR10a: společný REST transport/ETag/chybové typy a session context bez změny payloadů.10b: úložiště matches a sdílení aktuálníPromise.10c: players/profiles.10d: tournaments/series/leagues.10e: appData read/merge/write jako samostatné transakce, současný CloudRefresh využít, nekopírovat.
- Závislosti: A1, stávající normalize/merge a identifikátory, lokální persistence, tombstones/recovery, dosavadní revize/cache guard97. Cache velikost/politika se nemění (F2).
- Rizika: ztráta undo či příznaků přes serializaci, starší cloud přepíše novější disk, nesprávný ETag, opakované zpracování stejné revize při quota error, stejné UID v jiné relaci.
- Ověření: skutečné soukromé exporty vRAM, Firebase serializace prázdných polí/nul, 401/403/412/offline/lost ack, single-flight a account epochs, žádné duplicitní GET/PUT, plná místní kvóta bez mazání archivu.
- Dokončení: každá větev má jeden repository/transport a definovaného vlastníka stavu, core nemá druhý merge/loader, všechna ztrátová a konfliktní chování explicitní. Zachovat výkonnostní opravy97–104.

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
