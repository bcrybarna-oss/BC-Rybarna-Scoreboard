# Nasazení v4.51.106 RC

Zadavatel: Dominik. Datum:29.10.2026. **Nasazeno a v uvedeném rozsahu ověřeno.**

PR46 integrován do PR45 merge e2e5bc6078394a7b7da2079727ebcfa7e4136dc4. Na tomto commitu releasePASS, produkční Node269PASS lokálně/266PASS+3SKIP v CI, oba reproduktory a export/lifecycle/XLSX PASS. Integrace CI40944794161: experiment28PASS/2FAIL, celekFAILURE bez ignorování. Výchozí main2d1de22 po fetchi beze změny, diff27souborů zkontrolován, všechny předchozí výpočetní moduly/writer/overlay/experiment beze změny.

Společné PR45 sloučeno merge2b8edcf835748e7526e38e127ad20c791c260937. Žádné samostatné nasazení7a. Pages40945274924 success; mainCI40945275523 releasePASS/produkce266PASS,0FAIL,3SKIP/experiment28PASS,2FAIL. Dvě neshody preview50/155 shodné s integračním commitem a baseline105; nic neignorováno, celéCI červené.

Veřejná aplikace: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/ . Skutečné106,22souborů přesnéSHA256 smerge i přes no-cache URL, renderer acontroller i všech5předchozích modulů načtené jednou. Desktop1440x1000/mobil390x844: navigace, formulář turnaje, FC21položek/A2dialog,0JS/consoleerrors. Role/Auth/Firebase a všechny zápisy blokované; žádný skutečný pokus0. Viewer cykly stabilní, controller vlastní jeden pagehide listener po dobu stránky; po odchodu nezůstává další viewer timer/listener.

Izolovaně publikované HTML a všech7modulů, předemSHA256, read-only overlay. Skutečný exportcontroller, mockovaný transport/identita; žádná živá Auth relace ani produkční data. Session a role-loss probe PASS, reálná dvoulistová XLSX Singles/Doubles/Team desktop/mobil PASS. A1/A2/B všechny tři skutečné šablony: okamžité close→open zachová13řádků a otevřený dialog PASS.20cyklů, duplicatePNG/PDF, zadrženéfonty/decode/raster, zneplatnění a0stale downloadů, chyba/retry a DOM0/URLpoexpiry0 PASS. SkutečnéPNG1920×1080/PDF16:9 na desktopu i mobilu PASS. 23stažených souborů odpovídá integračnímu commitu: PNG/XLSX byteově shodné, PDF přesná obrazová shoda původních variant.

Omezení: živý Auth/FirebaseRules/soukromá přihlášená relace/fyzickýiPhone/Safari/OBS neověřeny. Kontroly soukromých dat jsou výhradně izolované. Žádné produkční zápisy, migrace nebo změna cache; výkonB a archivnícache limity trvají, PDF se neoptimalizovalo. Již zahájené stažení nelze zpětně odvolat; URL zůstává60s, starý rasterizer se nechá interně uklidit a jeho výsledek se zahodí.

Návrat: standardní reverzní PR z aktuálního main, revert -m1 společného merge2b8edcf, nová verze dle AGENTS, release a regrese, Pages. Bez reset/forcepush/importu nebo vracení dat. Úplný revert vrátí i známé vady queuedclose a sessionexportu, proto nejprve posoudit užší hotfix zachovávající opravy. Návrat nebyl potřeba. Další etapa nezahájena.

[Pages](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40945274924), [integračníCI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40944794161), [mainCI](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40945275523). [Sanitizovaná evidence](deployment-v4.51.106-verification.json).
