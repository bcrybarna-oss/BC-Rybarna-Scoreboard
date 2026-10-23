# Federal Cup – společný kandidát v4.51.93 RC

Zadavatel: Dominik. Datum: 23. 10. 2026. Větev `fix/federal-pushout-evidence` zmain ac620191e2abf75ae602a42a33f2bcceb99ea68c. **Nesloučeno a nenasazeno**, produkce92. Jeden společný opravný/vizuální PR.

## Doladění vlajek a browserového testu

Pokračování stejného PR #31 a nevydané verze93. Po vizuální připomínce odstraněno periodické svislé pásování: dvě širší nerovnoměrné záhybové plochy, společný dvourozměrný posun, šikmé měkké světlo a průhledné okolí. Přesné rovné národní vektory a symboly beze změny. Obě země mají identické parametry látky. Pro náhledy a export se používají společné PNG1920×1320 vyrenderované zSVG při2x, aby filtry nevytvářely schodové hrany vmalém zobrazení. Reprodukovatelné pomocí scripts/render-federal-cloth-assets.cjs. Plochá malá SVG beze změny.

Aktualizován federal-evidence-browser.cjs podle schváleného zadávání: známé rychlé dokončení8koulí je pot/sequential_batch s8pokusy/8úspěšnými strky acomplete. Vrácený push out potvrzuje výslovně žádné koule. Všechny ostatní kontrolní scénáře zachovány a celý browser nyní PASS, včetně skutečného mocked Auth/PUT/GET/reload/UNDO, B&R/esa, faulů a Team/Doubles aktérů. Dřívější upozornění na zastaralý test níže zachycuje stav před touto aktualizací, již není otevřeným problémem.

Detaily: [vlajky vpřehledu](screenshots/federal-93-flags-overview-detail.png), [vlajky vreportu](screenshots/federal-93-flags-report-detail.png), [dlaždice se zlatým pohárem](screenshots/federal-93-tile-detail.png). Aktualizovány i A1/A2/B, dialogy a desktop/mobil screenshoty. Statistiky, popisky, Resafe a společné tlačítko se dále nemění. Žádné produkční zápisy nebo migrace.

## Prezentace

Dlaždice zachovává původní rozměry; HTML text FEDERAL CUP,2026,ČESKO×SLOVENSKO a popis21zápasů. Samostatný zlatý/bronzový pohár bez zeleného odlesku vpravo. Oba národní symboly i text jsou samostatné prvky.

Pod oběma panely je jediné centrované tlačítko STATISTIKY TÝMŮ. Otevírá tentýž společný A2 podle explicitního hostitele, bez předvýběru některého týmu. A1/B vstupy zůstávají.

Sdílené vektorové vlajky v assets/federal-cup/: malé rovné bez rámečků, velké se stejným jemným statickým zvlněním a světlem. Slovenský znak používá přesnou zdrojovou geometrii; není převzat ze zjednodušeného generovaného návrhu. A1/A2/B, náhled i export používají stejné assety. [Zdroje](../assets/federal-cup/README.md).

Formatter používá dostupný numerator/denominator i při partial.14/15 se zobrazí93 %, count14 jako14, bez hvězdiček ve všech metrikách i kartách výher/proher. Známé0/0 zachováno, skutečně neznámé údaje —. Procenta jsou z evidovaných pokusů, nikoli prohlášení úplnosti. Interní coverage/reasons i diagnostika zůstávají; rozbalovací nápověda a title zachovávají podrobnosti. Žádné domýšlení pokusů nebo koulí. Z reportů odstraněny oba drobné informační popisky a jejich vyhrazené místo; DOMÁCÍ/HOSTÉ, panely,13metrik a branding zachovány. Uživatelské Resafe včetně CSS, interní identifikátory neměněny.

## Předchozí rozpracovaná oprava push outu a skutečná diagnóza

Export `BC_Rybarna_Scoreboard_Backup_2026-10-23 (1).json` pouze čten, SHA2567494ec7168498e43bce3bfb30f4d53556685dfc45eb130ad5816614992e83d48. Přesně ověřen matcha9f06904-00a5-4518-a81a-eae5a9425a35,2026,Singles#3,Daniel Lang–Tom Kurz,2:5, start15:10:22.815UTC/konec15:13:31.453UTC.

- Rack7 foul08d02171-e855-49da-9223-9cdc9849ea62: tlačítko FAUL → výběr koule5 → stávající select „Při jakém strku vznikl faul?“ → potvrzení. Záznam intentunknown, pottingAttemptsnull a successfulPottingStrokes0 je již v undo snapshotu události83, před cloudem. Cloud odstranil null, nikoli známý počet. Nelze prokázat, zda uživatel ponechal výchozí volbu nebo ji vědomě zvolil; uložený záměr je skutečně neurčený. Není důvod automaticky přidat neúspěšný potápěcí pokus. Interně správně zůstává14/15partial, reasonsunknown_attempts/unknown_intent; pro publikaci nově93 %.
- Rack6 push_out6a1bf5fe-1341-4e97-9041-97c4be66368b: PUSH OUT okamžitě zaznamenal intentother,attempts0/success0, bez dotazu na koule. V undo snapshotu události64 je balls[], ale šlo o výchozí pole, nikoli uživatelem doloženou nulu. Původní unknown_pots je konzervativní vůči nezjišťovanému údaji. Zadavatel následně výslovně stanovil: push out koule se do potopených koulí nepočítají, jen upravují stůl. Na tomto základě reader push_out vynechá zpotové metriky, nikoli nahrazením chybějícího údaje nulou.
- Nové UI vyžaduje ŽÁDNÁ KOULE nebo VYBRAT KOULE. **Žádná volba Nevím.** ZRUŠIT nic nezapíše. Známá fyzická nula je pottedCount0, vybrané koule se odeberou ze stolu,9/10 se vrátí na bod; statistické poty/pokusy se nepřičítají. Uložení/reload/UNDO a dvojité potvrzení ověřeny. Staré záznamy se nemigrují a žádná chybějící historická nula se nedoplňuje.
- Opravy92 v tomto exportu přítomné: bezpečný inferred_pots v racku1 má pokus/úspěch1; escape v racku6 má pottedCount0. Reference bez závad. Po novém výslovném pravidle push outu je pottedBalls14complete; nejde o kosmetické nastavení coverage vprezentačním formatteru.

Offline diagnostický CLI nyní přijímá přesný Singles/Doubles/Team fixture roku2026, nejen Team#1; stále jen allowlist bez tokenů a bez zápisů. Původní zápas ani export nebyly změněny.

## Ověření a výstupy

- Unit200:198PASS, pouze dvě známá preview-match-reload-recovery.test.cjs:50,106 selhání. Nový reader test na předchozím main selže; po opravě PASS. Formatter a čistota API/13metrik PASS.
- Cílený cloudový browser: explicitní nula/výběr koulí, vrácení9/10, nulové statistické připsání, cancel/double-confirm, skutečný writer/reader JSON přes mock odstraňující prázdná pole, reload,UNDO a vrácený push out/B&R PASS. Útočný/obranný/jiný/neurčený faul má zachovaný význam i po reloadu.
- Federal Cup, detailed counter, quick-finish, reportové identity/host/barvy/partial/unknown/dlouhá jména/mobil/fokus/Escape a verze93 browser PASS. Starší federal-evidence-browser.cjs na řádku123 má zastaralý předpoklad inferred_pots pro známou ČISTOU HRU; totožný TypeError prokázán také na nezměněném origin/main92. Nejde o novou regresi, test není skryt ani upraven jen pro zelený výsledek.
- Skutečný lokální Singles#3: A1 a výřez A2/B obsahující pouze tento zápas ukazuje SK93 %/14, CZ95 %/38. A2/B náhled není vydáván za celou produkční sezónu. Nulové produkční zápisy/Firebase požadavky/JS chyby.
- Desktop i mobil:6skutečných PNG1920×1080/PDF1440×810 párů, mobilní PNG bajtově totožné sdesktopem. Vložený obrázek každého PDF pixelově shodný sPNG. [Strojová evidence](federal-93-verification.json).

| Náhled | PNG / screenshot | PDF |
|---|---|---|
| A1 Singles#3 | [A1](screenshots/federal-93-A1.png) | [PDF](examples/federal-93-A1.pdf) |
| A2 výřez | [A2](screenshots/federal-93-A2.png) | [PDF](examples/federal-93-A2.pdf) |
| B Daniel Lang | [B](screenshots/federal-93-B.png) | [PDF](examples/federal-93-B.pdf) |
| Dlaždice | [desktop](screenshots/federal-93-home-desktop.png), [mobil](screenshots/federal-93-home-mobile.png) | |
| Federal Cup | [desktop](screenshots/federal-93-desktop.png), [mobil](screenshots/federal-93-mobile.png) | |
| Dialog | [desktop](screenshots/federal-93-dialog-desktop-A1.png), [mobil](screenshots/federal-93-dialog-mobile.png) | |

## Omezení

Čeká vizuální schválení. Žádný merge/deploy ani migrace, původní Team1:5 také beze změny. Produkční Auth/Firebase/Rules/OBS a fyzický iPhone neověřeny. Dvě známá modularizační selhání zachována; CI není plně zelené. Zastaralý browserový scénář byl v tomto pokračování aktualizován podle schválených pravidel a celý test prošel. Pushnuto jako20a095be5813d7ff67cdc1e1ac573a063c206623 do [draft PR #31](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/31). [CI20a095b](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39982232668): Release version and revision **success**, Node **198/200 failure**; log potvrzuje pouze preview-match-reload-recovery.test.cjs:50,106. Žádná nová regrese v CI; CI není plně zelené.
