# Nasazení v4.51.95 RC – PR #33

Zadavatel: Dominik. Datum: 24. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.** Produkční zápasy nebyly změněny, žádná migrace ani testovací zápisy do Firebase.

- Produkční URL: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/ – skutečně **v4.51.95 RC**.
- Finální schválená hlava PR #33:27f4d74d333e33af207c2d30102f19384d513ebc. Po čerstvém fetchi origin/main fd40f0e a kontrole bez konfliktu sloučeno metodou merge se zachováním historie.
- Nasazený aplikační merge commit: **48706bd65d383e31b80c67a589fddc4de68e1ce0**.
- [Pages40074836634](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40074836634): build/deploy/report **success**, automatické nasazení nebylo zbytečně opakováno.
- [Finální PR CI40074465426](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40074465426) a [main CI40074836849](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40074836849): Release version and revision **success**, Node **207/209 failure**, pouze preview-match-reload-recovery.test.cjs:50,106. Před merge skutečné logy porovnány s aktuálním main/run39999398781: stejné testy, expected true/actual false/strictEqual a match assertion. Žádná nová regrese. CI není plně zelené. Tyto testy/CI nebyly upravovány či vypnuty.

## Finální rozsah

XLSX obsahuje právě **Pushout a Metadata**. Data notes byl odstraněn celý, včetně jeho exportní konstrukce. Poznámky nebyly přesunuty do zbývajících listů, komentářů nebo souborových vlastností. Interní coverage/reasons/unattributed a všechny sportovní výpočty zůstávají v aplikaci. XML Pushout/Metadata a styles.xml je u všech6nově stažených Singles/Doubles/Team desktop/mobil souborů byteově stejné jako v předchozí třílistové variantě. Stejná kontrola znovu provedena nad dvěma skutečnými produkčními downloady. Hodnoty ani formátování ponechaných listů se neměnily.

Ukázkový XLSX aktualizován skutečným downloadem (13355B, SHA25606432dc82294f37866ac3671169b59f8ba0a4cf3592c4dcae2d9ee0ace8cf815). Místní předchozí uživatelem upravená dvoulistová kopie před aktualizací zachována v output/pushout-95-before-two-sheets/local-example.xlsx. Národní assety, dlaždice a reportové rozložení nejsou touto finální úpravou dotčeny.

## Přímá kontrola veřejného webu

Dokončeno24.10.2026 09:38–09:39CEST (07:38–07:39UTC). Veřejné index/overlay/13assetů včetně assets/pushout-xlsx.js HTTP200 s přesnými SHA256 proti merge; běžné URL/index.html i fresh query mají nové HTML. Hlavička/about/overlay95, navigace/FC21zápasů/soupisky/volitelný stream/panel pod ovládáním a neadresovaný overlay offline PASS. Veřejný A2 PNG/PDF PASS.0JS/console chyb,0pokusů o zápis.

Pro skutečné kliknutí na EXPORT PRO PUSHOUT byl použit nový dočasný browserový kontext na **skutečné produkční URL**, s **neupraveným publikovaným HTML a skutečnými publikovanými assety**. Před načtením dostal pouze jeho vlastní lokální offline DB kopii uživatelem dodaného uloženého Singles#3. Žádná změna HTML, testovací hook nebo náhrada backendové odpovědi. Veškerý Firebase provoz a non-GET požadavky byly blokovány; žádný se neuskutečnil. Tím se nečetly ani nezapisovaly skutečné cloudové zápasy a nepoužila se produkční přihlášená relace. Nejde o tvrzení, že byla ověřena skutečná Auth/Firebase relace.

- Dokončený uložený Singles#3, matchId a9f06904-00a5-4518-a81a-eae5a9425a35, Daniel Lang–Tom Kurz2:5: tlačítko viditelné a použitelné na desktopu1440×1000 i mobilním viewportu390×844.
- Dva skutečné downloady z produkčního originu: **pushout-federal-cup-2026-match-3-singles-daniel-lang-vs-tom-kurz.xlsx**. Desktop i mobil přesně shodné se schválenou novou ukázkou.
- Nezávislé openpyxl/ZIP ověření: přesně2listy Pushout/Metadata, bez sheet3 a Data notes, numerické počty a procentní formát zachovány. Žádné přestěhované diagnostické poznámky.
- Všech9metrik Singles: Pot percentage93 %/95 %, Missed pots1/2, Fouls1/2, Successful breaks1/3, Dry/soft breaks2/0, Foul breaks0/1, Break and runs1/1, Break and win1/3, Break and lose2/1.
- U obou downloadů sheet1.xml/sheet2.xml/styles.xml přesně stejné jako před odebráním třetího listu.0pageerror,0console error,0writeAttempts,0Firebase požadavků. Původní JSON SHA2567494ec7168498e43bce3bfb30f4d53556685dfc45eb130ad5816614992e83d48 beze změny.

## Evidence a omezení

- [Strojová evidence](deployment-v4.51.95-verification.json), [implementace a regrese](pushout-export-v4.51.95.md).
- [Produkční desktop](screenshots/production-95-pushout-desktop.png), [produkční mobil](screenshots/production-95-pushout-mobile.png).
- [Aktuální ukázkový XLSX](examples/pushout-federal-cup-2026-match-3-singles-daniel-lang-vs-tom-kurz.xlsx).
- Lokální skutečné produkční soubory ../release95-production/pushout-{desktop,mobile}.xlsx; přednasazovací6souborů output/pushout-95-two-sheets/.
- Skutečná produkční Auth/Firebase relace a fyzický iPhone/Safari/Microsoft Excel neověřeny. Browserové inventáře obsahovaly jen prázdný in-app browser a MCP Apps, žádnou přihlášenou relaci. Mobil ověřen jako Chromium viewport; XLSX přes nezávislé čtečky a strukturální/typové testy.
- Následný čistě dokumentační commit nemění aplikaci ani verzi. Úspěšný Pages deployment doplněn porovnáním veřejných bajtů a reálnými downloady, nikoli zaměněn za funkční ověření.
