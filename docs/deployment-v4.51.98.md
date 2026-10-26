# Nasazení v4.51.98 RC

Zadavatel: Dominik. Datum: 26. 10. 2026. **Nasazeno a v níže uvedeném rozsahu ověřeno.**

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- [PR #36](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/36) sloučeno metodou merge, se zachováním historie.
- Schválená a znovu ověřená hlava: `9e90fd9f0473f0b95c7e012c348eb7122dba8d9b`.
- Předchozí main: `a4604c3456b7bc0eef512296f2615262970fdc34`.
- Aplikační merge commit: **`4d7a564a7234912a5c8063cd42b2ae3fed8e166d`**.
- [GitHub Pages 40394978008](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40394978008): build, deploy a report-build-status **success**. Deployment nebyl ručně spouštěn ani opakován. Následné dokumentační pokračování nemění aplikaci nebo verzi; případný jeho automatický Pages běh publikuje stejný aplikační obsah.

## Před sloučením a CI

Čerstvý fetch a release gate PASS. Head i main odpovídaly očekávaným commitům; žádný konflikt nebo cizí necommitnutý sledovaný soubor. Nesledované pracovní soubory zůstaly zachovány. Draft byl převeden na připravený PR a merge byl podmíněn přesnou schválenou hlavou.

[Finální PR CI 40394356052](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40394356052) i [main CI 40394977492](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40394977492): release **success**, Node **229 PASS / 2 FAIL / 3 SKIP ze 234**. Tři soukromé testy nemají v CI exportní soubory; před sloučením lokálně se vstupy 232 PASS / 2 FAIL / 0 SKIP. Po nasazení navíc 7/7 kontrol produkčního modulu a výkonových invariant97 PASS; dříve ověřený dlouhý scénář se v produkci neopakuje.

Obě selhání byla jednotlivě porovnána s [CI aktuálního předmerge main 40380876396](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40380876396). Tam 227 PASS / stejná 2 FAIL / 3 SKIP ze 232. Test i starý test-modular core mají vůči tomuto main stejný obsah.

1. `preview-match-reload-recovery.test.cjs:50`: skutečný rozpor kontraktu náhledu při čekání na identitu. Test požaduje odpojení aktivního pointeru bez smazání kopie, náhled jej ponechá.
2. `:106`: zastaralý regex tvaru volání. Obnova zůstává v obou přihlášeních a její výsledek je přiřazen pro fallback turnaje; kontrola očekává samostatné volání.

**CI není plně zelené. Nové selhání nebylo nalezeno.** Tyto testy nebyly vypnuty nebo změněny. Další etapa modularizace nebyla zahájena.

## Skutečný veřejný web bez přihlášení

Čisté Chrome relace desktop 1440×1000 a mobilní viewport 390×844, bez produkčních cookies, tokenů nebo přihlášení. Kliknutí na POUŽÍT OFFLINE zavřelo přihlašovací dialog. Veškeré Firebase/Auth a jiné než GET/HEAD požadavky byly blokované; žádný pokus o zápis nenastal.

- Veřejné `index.html`, `overlay.html` a 14 potřebných assetů mají HTTP200 a přesné SHA256 vůči merge commitu. Běžná i cache-busting URL HTML a modulu vrací stejné nové soubory.
- Viditelná verze je **v4.51.98 RC**. Overlay má stejnou verzi v publikovaném HTML; reálné OBS zde testováno nebylo.
- Nový `assets/js/federal-statistics.js?v=4.51.98` se v každé relaci načetl právě jednou. Skutečná browserová odpověď má SHA256 `7e1cae131f79f6bf5bdd2c417fe5b4272408c361053024a6e5f1c411a9ea7d21`, shodné s Gitovým souborem. Namespace obsahuje 24 funkcí a je zmrazený. Chyba bootstrapu není zobrazena; inline těla výpočtů v publikovaném HTML nejsou přítomná, žádný starý fallback.
- Navigace Úvod → Výsledky / Hráči / Nápověda → O aplikaci / nastavení / Federal Cup PASS. V nastavení zůstává výchozí Bez streamu; žádný zápas nebyl zahájen.
- Přehled FC: 21 položek programu, soupisky a jediné společné tlačítko A2. V prázdné offline relaci se bezpečně otevřel A2 s 13 metrikami a skutečně stáhl PNG i PDF.
- V obou viewports **0 pageerrors a 0 console errors**. Žádná Firebase/Auth komunikace ani zápis nebyly potřeba.

Počáteční ověřovací skript předpokládal přímý viditelný vstup O aplikaci z úvodu. Opraven pouze skript na skutečnou cestu přes Nápovědu; aplikace kvůli tomu nebyla měněna. Dokončený běh prochází skutečné ovládání a nevolá interní navigační funkce.

## Soukromé zápasy na veřejné URL – izolovaná místní kopie

Neupravené HTML, modul, renderer i knihovny jsou načtené ze skutečné veřejné URL. Nové dočasné browserové relace obsahovaly v localStorage pouze kopii FC konfigurace, potřebných profilových jmen a dvou dokončených zápasů z exportu 25. 10. 2026. Žádné přihlašovací údaje z exportu se nekopírují. Firebase/Auth i veškeré zápisy zůstaly zablokované.

- Doubles #9: `3d4c35e6-e336-49d5-a9b3-9955cec59c3d`, skóre 5:3.
- Singles #3: `85109748-f185-4988-a86b-8bc914bb4e3a`, novější uložený záznam z téhož exportu; nejde o starší Daniel Lang–Tom Kurz 2:5.

Na desktopu i mobilu otevřeny **A1/A2/B**, vždy 13 metrik, čitelné logo/rovné vlajky a zachované rozložení. Staženo **6 PNG + 6 PDF + 2 XLSX**. Součet reprezentací v tomto A2 vychází pouze z této dvouzápasové testovací kopie; neověřuje úplné živé týmové skóre.

V A1 zkontrolováno všech 13 hodnot #9, ve skutečně načteném výpočetním API a Pushout také prohry při vlastním breaku:

| #9 | SK | CZ |
|---|---:|---:|
| Potopené koule | 48 | 12 |
| Úspěšnost potopení | 94 % | 86 % |
| Výhry při vlastním breaku | 2/4 | 1/4 |
| Prohry při vlastním breaku | 2 | 3 |

Doubles zůstává statistikou dvojic, nikoli vymyšlenými osobními příspěvky. Pushout zachoval devět schválených řádků, včetně break kategorií, B&R a 2/1 výher a 2/3 proher. Stažené XLSX jsou byteově shodné s výstupem nezměněného writeru pro tentýž model. localStorage ani původní export se během kontrol nezměnily. **0 JS/console chyb, 0 Firebase/Auth požadavků a 0 pokusů o zápis.**

**Toto není ověření načtení skutečných živých dat přes přihlášenou produkční relaci.** Je to ověření aktuálně publikované aplikace na produkční URL s oddělenou kopií skutečných dat.

## Nezávislé ověření stažených souborů

Včetně prázdného veřejného A2 zkontrolováno 7 PNG/PDF párů: PNG přesně1920×1080, PDF jedna strana16:9 a jeho vložený obrázek pixelově totožný s příslušným PNG. ZIP/XML analýza obou skutečně stažených XLSX: právě Pushout/Metadata, všech devět očekávaných řádků #9, číselné počty/procenta, procentní formát0 %, žádný Data notes.

Vstupní export zůstal nezměněný, SHA256 `2afd2e5c48d3babf198d41809dd9fedbf8b188a28dd8e6056a0f27db69afdc6e`. [Strojová evidence](deployment-v4.51.98-verification.json), [izolovaný report desktop](screenshots/deployment98-isolated-report-desktop.png), [izolovaný report mobil](screenshots/deployment98-isolated-report-mobile.png).

## Omezení a návrat

Živá přihlášená produkční Auth/Firebase relace, reálné OBS, fyzický iPhone/Safari a Microsoft Excel nebyly ověřeny. Mobil znamená viewport Chrome. Přetrvávají dříve naměřené jednorázové dlouhé úlohy reportu B/PDF a nedostatečná kapacita localStorage pro celý40MBarchiv; extrakce nebyla optimalizací těchto částí.

Pokud bude nutný návrat, připravit v samostatném PR reverzi merge příkazem `git revert -m 1 4d7a564a7234912a5c8063cd42b2ae3fed8e166d`. Zohlednit aktuální main a souběžné změny, upravit číslo podle release pravidel a znovu provést release gate, CI, browserové kontroly a ověření Pages/assetů. Návrat obnoví předchozí inline výpočty; neprovozovat dvě implementace současně. **Žádný rollback databáze ani migrace zápasů není potřeba.** Návrat nyní proveden nebyl.
