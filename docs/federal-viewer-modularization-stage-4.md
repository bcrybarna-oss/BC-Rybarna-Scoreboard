# Čtvrtá etapa – životnost diváckého přehledu Federal Cupu

Zadavatel: Dominik. Základ: main `6d809e01e75f5755180265378a2906efe6bdbec8`, v4.51.102 RC. Kandidát v4.51.103 RC. **Neslučovat, nenasazovat.** Produkční data se nemění.

## Výběr a hranice

Předchozí mapa v `own-reports-modularization-stage-3.md` uvádí samostatný divácký 25s interval. Je menší než livescore (sdílený zápasem/dialogy), presence (zápisy), challenges (notifikace a mutace) nebo počáteční transakční cloud merge. Vybraná hranice zahrnuje jen start/stop/dispose, single-flight, platnost dokončení a ovládání refresh tlačítka. Editor, konfigurace, pravidla, výpočty, reportové šablony a exporty zůstávají beze změny.

`assets/js/federal-viewer.js` je jediná produkční implementace této orchestrace. Core předává identitu, aktivní obrazovku, viditelnost, hodiny, společné čtení, renderer a busy/error callbacks. Stará `refreshingSpectator` proměnná, tělo obnovy a bootstrapový trvalý interval jsou odstraněné. HTML synchronně načítá modul před core; chybějící asset skončí viditelnou chybou, bez fallbacku.

Vlastník: controller vlastní generaci obrazovky/identity, interval, pagehide listener a pending promise. DOM a aplikační data vlastní core. `showScreen` synchronizuje controller po skutečném výběru obrazovky (včetně převodu neoprávněného editoru na přehled). Ztráta identity stopne controller před vyčištěním identity, začátek relace jej synchronizuje jen s aktivním přehledem. Opakovaný start stejného scope nevytváří prostředky. Odchod, logout a změna identity zneplatní dokončení; staré finally nemaže nový request ani neodblokuje jeho tlačítko. Anonymní obnova vykreslí lokální stav bez čtení cloudu. Skrytý dokument se na ticku neobnovuje; návrat spojení řeší další původní tick nebo ruční obnova. Cadence zůstává25s, ale při návratu na obrazovku začíná nový interval. BFCache pagehide ponechá stránku živou, skutečný pagehide disponuje controller.

Sdílené transporty appData/matches nadále vlastní aplikace a její dosavadní loadery. Modul je neabortuje při opuštění FC, protože mohou současně sloužit jiné obrazovce. Jejich session guards, sdílení Promise a ochrana cloudové revize z97/99 zůstávají beze změny. Jejich platná aktualizace společných dat není screen-owned vykreslení. Modul nepředstírá zrušení již odeslaného HTTP. Nepřesouvá ostatní globální renderery/listenery, nemění cache, oprávnění ani zpracování dat. Ostatní řádky předchozí mapy stále platí.

## Cílené změny chování oproti samotnému přesunu

Původní finally vykreslilo přehled i po odchodu nebo změně účtu; test zadrží skutečný mockový `/matches` transport. Nový controller povolí dokončení pouze aktuálnímu scope. Původní stále běžící interval nahrazuje jeden prostředek jen po dobu přehledu. Funkční opravy jsou pokryty samostatnými unit a before/after browser scénáři; nejde o tvrzení, že přesun souboru sám optimalizuje výpočty.

## Ověření

Výchozí i nový produkční HTML+moduly byly testovány s mockovanou sítí a nezměněným exportem27.10. (40 913 440B,189zápasů,26profilů, SHA25649908fbcd66113315e524e6e61a4fc3a889654bb0e9420d309b843d4181a4d5d). [Strojová evidence bez soukromých herních dat](federal-viewer-stage-4-verification.json).

- 6unit přímo importuje produkční modul: idempotence a timerID0, dispose/BFCache, single-flight před await, odchod před zahájením i během čtení, A/B a stejný UID po návratu, staré finally, logout, anonymní režim, hidden tick a výpadek/retry.21cílených jednotkových kontrol celkem PASS.
- 20browser cyklů před/po:3souběžná obnovení vedou k1GETmatches na obou verzích; nový modul navíc sdílí skutečnou Promise (unit). Opožděné rendery po odchodu1→0 a po starémA před novýmB1→0. Interval během1→1, po odchodu1→0, po logoutu1→0; nový pagehide listener1 během/0po. DOM4042→4042 před a4043→4043 po, rozdíl1novýscript.72síťových požadavků na obou; medián celého průchodu3819→3801ms. Max2transporty zahrnuje uměle zadržené staréA a novéB, nikoli duplicitní aktuální scope.0pageerrors, export neměněn. Výpadek/obnova původním tickem PASS.
- Bootstrap4assetů a jejich jednotlivé404 desktop/mobil PASS, bez fallbacku.
- Dlouhé sekvenční měření:12cyklů/60přechodů,12ručníchcloudobnov,4otevřeníA1/A2/B,15sklidu,0JS/interakčníchchyb na obou verzích. Intervaly loaded6→5, aktivníFC+relace7→7, po logoutu6→5. JSEventListeners v cyklech7/12 stabilně1129→1129 před a1130→1130 po, po logoutu1127 u obou. Konečný GC heap57 657 368→57 660 816B. Matches25→23GET, appData35→33GET (časování), u každé cesty vždy max1souběžnýGET;4novérevize→4aplikace u obou. Celkové max6přes různé cesty u obou.4pokusy o zápis v každém soak běhu zachyceny/odmítnuty mockem, žádné produkční zápisy.
- CPU TaskDuration91,47→88,63s; jeden hráčskýBopen/close2902→2742ms, maxlongtask4700→4619ms. Jde o jeden orientační běh/verzi, nikoli prokázané zrychlení. Jednotlivé interakce kolísají (např.posledníA1:1879→3241ms), celkový významný systematický přírůstek nebyl zachycen; B i blokující úlohy stále zůstávají. Kvóta73→71chyb je očekávaný limit celého archivu, ne oprava cache.
- OwnReports a CloudRefresh celé životnostníbrowser regrese PASS; turnaje101 desktop/mobil/plnáquota/výběr/ručnínasazení/reload/cloudmock/skupiny8-ball3/play-off10-ball7 a nezměněnýFC PASS. Původní uživatel na svém zařízení101 tímto stále nepotvrdil.
- A1/A2/B reálné PNG1920×1080, zoom/desktop/mobil, Singles3SK93%14/CZ95%38, Pushout2listový XLSX Singles/Doubles/Team a původní nezměněné PDF regrese PASS. Žádné úpravy PDF ovládání/knihoven. Parita24čistýchfunkcí nad4skutečnýmiexporty, opravenéDoubles9 a osobníTeam,31byteověshodnýchXLSX PASS; výpočetnímodul/renderer/daty nepohnuto.
- PlnáNode sada se soukromými vstupy267PASS/2známéFAIL/0SKIP z269; bez nich264PASS/2stejnéFAIL/3SKIP. Releasegate PASS. CI není plně zelené a nové výsledky jsou uvedeny u PR. Izolované Auth/Firebase a stažení exportů nejsou ověřením živé přihlášené relace. Soukromý export se nemění a není součástí PR.

Uživatel po nasazení102 úspěšně otevřel Moje hlášení v přihlášené aplikaci; seznam byl prázdný. Jde pouze o základní provozní kontrolu, nikoli ověření existujících hlášení. Původní uživatel turnaje101 stále nepotvrdil na vlastním zařízení. Tato etapa jejich chování nemění.

## Známá dvě selhání

- `preview-match-reload-recovery.test.cjs:50`: test očekává odpojení aktivního uloženého zápasu při dočasně nedostupné Firebase identitě; současný experimentální `test-modular` core ponechá pointer. Jde o nesoulad recovery chování, nikoli kosmetický text. Produkce nepoužívá tento core.
- `preview-match-reload-recovery.test.cjs:106`: statická regex kontrola očekává samostatné volání `restoreOwnedTestMatchAfterLogin()`. Core jeho návratovou hodnotu přiřazuje pro tournament fallback; regex neodpovídá skutečnému toku. Není to tentýž problém jako první selhání.

Oba testy a experimentální core zůstávají beze změny proti základnímu main. Přímý běh výchozích souborů:7PASS/2FAIL z9. Nová selhání se nevydávají za známá.

## Návrat a omezení

Návrat reverzí celého PR (inline tělo, integrační háčky, script a modul dohromady), nová release verze podle pravidel, bez obnovy dat nebo migrace. Samotný chybějící modul se nesmí řešit fallbackem. PDF UI/závislosti ani starý test-modular nejsou měněné. Zůstává blokování hráčského reportuB a nedostatečná místní cache pro celý archiv. Živá produkční Auth/Firebase, fyzická zařízení a OBS nejsou součástí izolovaného ověření.
