# Etapa7b — controller reportů (společný kandidát v4.51.106 RC)

Zadavatel: Dominik. Datum:29.10.2026. Navazuje na PR45/head9a43428; renderer7a, FederalStatistics, writer a grafické assety beze změny. Produkce105. Nic neslučovat/nenasazovat.

## Závislost a vydání

Samostatná větev refactor/federal-report-controller-stage-7b a PR do refactor/federal-report-renderer-stage-7a. Oba PR tvoří jedno nevydané106. Bezpečné budoucí pořadí po schválení:7b do integrační větve7a, potom celý integrovaný PR45 do main; Pages se automaticky spouští na main. Žádné mezivydání106 pro samotnou7a a další změna pod nasazenou106. Pokud bude7a vydána samostatně,7b musí podle aktuálního main dostat další verzi a nové ověření. Release kontrola zůstává beze změny.

## Jediná implementace a funkční opravy

FederalReportController dostává document/window/dialog/screen, explicitní identity callback, přípravu modelu a renderer vysvětlivek. Core ponechává výběr podkladů, původní těla open/layout/fit/canvas/export odstraněna. Renderer, výpočty a XLSX writer se nepřepisují. Controller vlastní open/close/zoom/fokus, generation, AbortController úlohy, export busy, resize rAF, observer, události a DOM host. dispose odpojuje zdroje, pagehide bez bfcache dispose; s bfcache close.

Mechanický přesun je odlišen od dvou funkčních oprav: queued close událost nesmí uklízet otevřený nový dialog; close čistí synchronně a stará událost při znovuotevření nic nemaže. Export platí jen pro epochu otevření a zachycenou identitu/roli/profil. Vyčištění identity a změna role volá invalidaci; před downloadem se znovu ověří relace. Zneplatněný starý finally nemění nový export. Stejný ticket chrání čekání před XLSX.

Fonty a decode mají zrušitelné čekání a časové limity s odstraněním timeoutu/listeneru. Již běžící html2canvas se nechá dokončit kvůli vlastnímu úklidu iframe, jeho výsledek se zahodí. Job má vlastní označení hostu, aby starý raster nezaměnil nový. Nesnažíme se optimalizovat ani přepisovat raster/PDF. Již zahájený download má původní60sURLlease; close/dispose jej nezruší předčasně.

## Ověření

Oba původní přísné browser reproduktory PASS; také samostatný mockovaný pokles role admin→player PASS. Skutečné PNG/PDF A1/A2/B desktop/mobil,20cyklů, duplicate kliknutí, zavření během fontů/obrázků/rasterizace, chyba/retry,0dočasných hostů po dokončení, URL platná po close a0poexpiry PASS. U session scénáře nově vyžadováno0downloadů, očekávání není oslabeno.23stažených PNG/PDF/XLSX porovnáno s7a: PNG aXLSX přesně shodné, obraz PDF přesně odpovídá původním variantám, formát16:9 zachován. Pushout Singles/Doubles/Team skutečná stažení PASS.

3unit přímo nad controller modulem: okamžité znovuotevření, idempotentnídispose/observer, URLlease a absence starých inline těl. Produkční Node269PASS lokálně se soukromými vstupy (veřejně266PASS/3SKIP), experiment28PASS/2FAIL na původních preview řádcích50/155; celek297PASS/2FAIL/0SKIP z299, exit1. CI není tímto označeno za celé zelené. Změna testovacího mocku cloud-refresh přidává explicitní novou invalidaci; ostatní kontroly zachované.

Všechna síťová data/Auth/raster fault injection izolovaná, žádný produkční zápis. Živý Auth/Rules, fyzický iPhone/OBS a skutečně nekonečně visící cizí rasterizer nejsou ověřeny. Surové artefakty output/stage7b. Controller odvolá přípravu, ne již spuštěné stažení.

## Návrat

Reverze pouze7b nad7a obnoví původní controller, ale také obě doložené vady. Žádná migrace dat nebo změna cache. Celý kandidát lze vrátit reverzí integračního PR, po nasazení s novou verzí dle AGENTS. Další oblast roadmapy nezahájena.
