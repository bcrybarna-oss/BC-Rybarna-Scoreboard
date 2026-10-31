# Nasazení v4.51.111 RC — online přítomnost, uzavření etapy9

Zadavatel: Dominik. Datum:31.10.2026. **Nasazeno a v popsaném rozsahu ověřeno.** Etapa9 je dokončena v přijatém rozsahu; serverová omezení zůstávají samostatné úkoly. Etapa10 nezačala. Produkční přítomnost ani jiná data nebyla testovacími akcemi měněna.

## Sloučení a CI

Čerstvý fetch potvrdil main `45ae20a13899c74f633364c63be2ff87252d8a81` (v110) a beze změny finální headPR53 `0ea21f9f7d1868948e37a94c3f0012c081e5dffc`. Release gate111 proti110 PASS. Žádné souběžné změny ani konflikty, tracked strom čistý, cizí nepřidané soubory zachovány. Diff zachovává výzvové moduly/protokol/Rules/cache/workflow/experiment beze změn. [PR53](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/53) standardně sloučen merge **`6fb8c7dd72506376d7e45af421e9f872e937d1e5`**, bez force push či přepsání historie.

[Finální PR CI41231698063](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41231698063) i [main CI41231980320](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41231980320): Release PASS, produkce **325PASS/0FAIL/3SKIP**. Tři kontroly vyžadují soukromé exporty; lokálně po merge **328PASS/0FAIL/0SKIP**, pouze izolované čtení těchto exportů.

Experiment **28PASS/2FAIL/0SKIP**, celéCI FAILURE. Obě vady jednotlivě shodné s výchozím main: preview-match-reload-recovery:50 neoddělí editovatelný zápas při pendingAuth; :155 důvěřuje zbytkovémuUID bezAuth. Testy ani experimentální core se nemění a core není produkčně načítán. Žádná kontrola nebyla obejita.

**Historický audit odstraněného žurnálu:0PASS/2FAIL**, zopakovaný samostatně. Jde o přesně zmrazenou původní implementaci s falešnýmGET-ACK a neomezeným kopírováním metadat, nikoli o současnou produkční sadu či dvě experimentální vady. Jeho exit1 a reprodukce zůstávají viditelné.

## Skutečná veřejná produkce

[Pages41231980016](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41231980016) automaticky po merge **success**; žádné ruční opakování nasazení. [Produkční URL](https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/).

- Veřejná **v4.51.111 RC**, všech28 kontrolovaných souborů HTTP200 a přesnýSHA256 proti merge. Index/overlay a moduly ověřené také cache-busting URL.
- Chrome desktop1440×1000 a mobilní viewport390×844: všech13modulů včetně OnlinePresence načteno právě jednou; žádný experimentální core/fallback,0pageerror a0consoleerror.
- Dostupná dlaždice a dialog online uživatelů, otevřít/zavřít/opakovaně otevřít. Anonymní relace správně ukazuje nedostupný seznam; soukromý naplněný seznam tím není veřejně ověřený. Checkbox viditelnosti nebyl testovací akcí přepnutý.
- Centrum notifikací, výzvy (výzva k přihlášení), úvod/výsledky/FC a Livescore navigace bez JS chyb. Všechny Firebase/Auth a zápisové požadavky byly ochranně blokované; **0takovýchpokusů**,0označení notifikací jako přečtených. Nešlo o živou přihlášenou relaci.

Screenshoty: [online desktop](screenshots/deployment111-public-presence-desktop.png), [online mobil](screenshots/deployment111-public-presence-mobile.png). [Veřejné hashe a výsledky](deployment-v4.51.111-verification.json).

## Izolovaně na publikovaném kódu

Adaptér načetl stažené veřejné HTML/overlay/13modulů a před testy kontroloval jejich hashe. Veškeré Auth/Firebase endpointy jsou mockované. Toto není test živýchRules ani skutečné přihlášené produkce.

- Přítomnost desktop/mobil PASS: opakovaný start10× bez duplicit, stop/restart a všechny prostředky0, logout/A→B, čekání na autorizaci, opožděný GET, dokončení již odeslaného zápisu staré relace, visible/hidden, neaktivita, admin, výpadek/recovery a VYZVAT právě jednou. Správné cesty/payloady/PUT versusDELETE a token původního vlastníka.13mockzápisů/12GET na viewport v celém scénáři,0pageerrors. Před/po dialog má přesně shodnéPNG.
- Prostředky:2intervaly/1startup/8listenerů při aktivním vlastníkovi, po stop0/0/0 a žádný pending. Souběžná obnova sdílí řetězec.100renderů desktop0,9→2,7ms, mobilní hodnoty viz JSON; jde o orientační měření a guard má malý náklad, nikoli optimalizaci.
-9b1 desktop/mobil PASS: sdílené čtení, relace/cache, pomalá síť/retry, navigace, koncept a navazující start.9b2 desktop/mobil PASS: všech pět oprav, šest akcí, změna účtu, full/deniedstorage, unknown a zastavení fronty, správné payloady, zachování nesouvisejících polí a navazující založení zápasu. Žádná produkční data.
- Samostatný9a consumer s konzistentním mockem a izolovaným vedlejším readerem: desktop/mobil přesnáPNG/text/payload parita PASS; assertions/tolerance beze změny. Známá historická nestabilita raw PNG kontroly a mobilní překrytí zvonku nejsou vydávané za opravené a nejsou GitHubCI. Bootstrap13modulů a explicitní chyby chybějících modulů PASS.

## Omezení, samostatné úkoly a návrat

**Zneplatnění operace v aplikaci není odvolání již odeslaného zápisu.** Již zahájený PUT/DELETE může server dokončit s původním tokenem; guard pouze zabrání následnému starému čtení/přepsání nového UI. Přítomnost stále používá periodický klientský upsert/delete, žádný serverový lease/onDisconnect/CAS nebyl zaveden. Dlouho neodpovídající řetězec zůstává single-flight bez nového timeoutu; změna relace/stop ruší čtecí část, ne serverový zápis.

Samostatně mimo dokončenou etapu9 evidováno: bezpečný zápisový protokol výzev a konflikty mezi zařízeními; unknownstopka/varování výzev nepřežijí restart a reload neruší nejasnýPUT; případné serverové řízení lifetime přítomnosti; skutečné Auth/Rules integrační ověření. Žádný z těchto bodů není nově implementovaný ani automaticky zahrnutý do etapy10. Přehled v [roadmapě](modularization-roadmap.md).

ŽivýAuth, produkčníRules, soukromý naplněný živýseznam a fyzickýtelefon neověřeny. Veřejná kontrola je anonymní, funkční zápisy výhradně izolované.9c nemění přihlašovací kontrakt, serverové oprávnění, data ani historii.

Návrat standardním **revertem merge6fb8c7d s parent1**, zachovat následné cizí změny, nová verze podle aktuálního main a release/produkční/browser kontroly před nasazením. **Bez vracení, mazání či migrace dat nebo Rules.** Revert vrátí i původní závody přítomnosti; před návratem zvážit cílenýhotfix. Tento následný dokumentační zápis nemění aplikaci ani čísloverze.
