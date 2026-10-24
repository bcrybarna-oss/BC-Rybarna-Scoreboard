# Nasazení v4.51.96 RC

Zadavatel: Dominik. Datum: 24. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.**

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- PR #34 sloučeno se zachováním historie: `3e095d702cb0838aaf4a4aa674540234426209f4`.
- Schválená hlava PR: `243ab12b94a245470e6aa7396bc439849d483f70`; předchozí main `a12b69d600c3585fc02b79f96f02c63564334c6e`.
- [Automatické Pages40130394877](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40130394877): build/deploy/report success. Žádný ruční rerun.
- Aktuální main po nasazení doplňuje čistě dokumentační commit s tímto reportem; aplikační soubory jsou přesně shodné s merge commitem.

## Finální CI a přednasazovací kontrola

Čerstvý fetch, main beze souběžných změn, PR bez konfliktu, release gate PASS proti aktuálnímu main. [Finální PR CI40130066555](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40130066555) a [main CI40130395493](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40130395493): release success; Node222PASS/2FAIL/3SKIP ze227. Pouze preview-match-reload-recovery.test.cjs:50/:106. Porovnáno se skutečnými logy aktuálního předmerge main CI40075263648 (207/209): stejné názvy testů, řádky a assertiony (strictEqual true a chybějící login recovery volání). Testovací soubor proti main nezměněn. Žádná nová regrese, CI není plně zelené. Tři soukromé exportní kontroly bez místních souborů v CI přeskočeny, lokálně prošly; plná lokální sada225/227, cílená75/75.

## Skutečné produkční ověření

### Veřejná aplikace bez přihlášení

Neupravená veřejná URL, čerstvý Chrome profil, desktop1440×1000 a mobil390×844. index.html a overlay.html plus13assetů HTTP200 a SHA256 přesně shodné s merge commitem. Běžná URL i cache-busting URL mají nové stejné bajty. Verze96 v hlavičce, O aplikaci a titulku overlaye. Navigace/nastavení/hráči/FederalCup,21položek programu/soupisky/dlaždice/vlajky/společnéA2 a prázdný offlineA2 PNG/PDF PASS. Výchozí Bez streamu, volba streamu před startem a umístění panelu pod ovládáním zachováno. Neurčený overlay bezpečně offline.0JS chyb/0console chyb/0pokusů o zápis.

### #9 na veřejné URL s izolovanou kopií skutečných dat

Neupravené publikované HTML a assety na skutečné Pages URL. Pouze v novém jednorázovém browserovém profilu naplněna místní offline DB kopií dodaného zápasu `3d4c35e6-e336-49d5-a9b3-9955cec59c3d` a FC konfigurace z exportu `(2)`. Firebase/Auth a všechny požadavky jiné než GET/HEAD blokovány. Nejde o přečtení živého produkčního zápasu.

| Metrika #9 | SK | CZ |
|---|---:|---:|
| Skóre | 5 | 3 |
| Potopené koule | 48 | 12 |
| Úspěšnost | 94 % (48/51) | 86 % (12/14) |
| Výhry při vlastním breaku | 2/4 | 1/4 |
| Prohry při vlastním breaku | 2 | 3 |

Desktop i mobil: skutečné kliknutí na report A1 a EXPORT PRO PUSHOUT, správná dvojice/identita,13řádků a požadované reportové hodnoty PASS. Skutečně staženy oba PNG/PDF/XLSX. Nezávislá kontrola: PNG1920×1080; PDF16:9 a vložené pixely shodné s PNG; XLSX přesně Pushout/Metadata, všech9metrik správně včetně numerických2/1 a2/3, procenta numeric0.94/0.86 s0% formátem. Desktop/mobil XLSX byteově stejné s otestovanou ukázkou v repozitáři.0JS/console chyb a0pokusů o zápis. [Desktop](screenshots/deployment96-fixture9-desktop.png), [mobil](screenshots/deployment96-fixture9-mobile.png).

### Standardní FC zápasy

Nad stejným skutečným exportem porovnáno celé API95/96 u osmi standardních FC zápasů s federalEvidence.fromStart (#1–8, Singles/Doubles/Team). Všechny výsledky a metriky stran zůstaly přesně shodné. Sedm celých API výsledků je totožných. U jednoho osobního příspěvku v Team#1 se pouze dřívější falešná nula neznámých pokusů a missedPots mění na null/unknown, v souladu se schválenou opravou rozlišení nuly a neznámé evidence; doložené numerátory, týmové součty a ostatní metriky beze změny. Podrobné diffy jsou ve strojové evidenci. Není to test živých cloudových výsledků.

## Bezpečnost a omezení

Produkční zápasy nebyly upraveny ani migrovány. Konzolový opravný skript nebyl znovu spuštěn. Původní exporty nezměněny. Živý aktuální zápas #9 v produkční Firebase ani produkční přihlášení nebyly ověřeny; dostupná připojená relace byla odhlášená. Výsledky výše prokazují publikovaný kód a funkci nad skutečným exportem v izolované offline relaci. Reálné OBS, fyzický iPhone/Safari a Microsoft Excel neověřeny.

[Strojová evidence, hashe a výsledky](deployment-v4.51.96-verification.json). [Důkazy všech8racků](federal-fixture-9-rack-reconstruction.md). [Otestovaná ukázka XLSX](examples/federal-96-linked-doubles.xlsx).
