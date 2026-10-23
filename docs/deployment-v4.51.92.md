# Nasazení v4.51.92 RC – PR #30

Zadavatel: Dominik. Datum: 23. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.** Bez změny existujících zápasů a bez produkčních zápisů.

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/ – skutečně v4.51.92 RC.
- PR #30 sloučen metodou merge se zachováním historie, očekávaná hlava fd967ca76f5f494d6edc9e2157ba800d7197ee4c.
- Nasazený merge commit: **e98cd9ce1b38af4143b08ac343467c98cee3692c**.
- [Automatické Pages39973425345](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39973425345): build/deploy/report success, žádné ruční opakování.
- [Main CI39973426961](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/39973426961): release gate success; Node194/196 failure. Výhradně známé preview-match-reload-recovery.test.cjs:50,106. Před merge porovnány s CI aktuálního main0db27bb/run39939729519: stejné assertiony, chybné testy i test-modular beze změny. Finální PR CI39968120055 stejné dvě chyby. **CI není plně zelené**, žádná nová regrese.

## Přímá kontrola veřejné aplikace

Ověřeno 23. 10. 2026 v16:54 CEST (14:54UTC). Veřejné index.html, overlay.html a5assetů HTTP200 a přesná SHA256 shoda smerge. Běžná URL, index.html i fresh query mají stejné nové HTML, nejde jen o úspěšný deploy nebo starou cache.

Čerstvý desktopový i mobilní browser: verze vhlavičce/about/overlay92, navigace domů/nastavení/hráči/Federal Cup, tabule,21zápasů/soupisky, žádná stará týmová tabulka/detailní tlačítka. Bez streamu výchozí, volba před startem a panel pod herním ovládáním zachovány. Nezadaný overlay bezpečně offline. **0 pageerror,0 console error,0 pokusů o zápis.**

Bez přihlášení nejsou skutečné uložené A1/B dostupné. Veřejný A2 byl otevřen se13metrikami, originálním Pushout logem a pravdivě prázdnou evidencí; skutečné stažení PNG1920×1080 a PDF1440×810 (16:9) PASS. Mobilní náhled/zvětšení/Escape PASS. Prázdný A2 není vydáván za ověření skutečných cloudových statistik.

## Funkční ověření skutečně publikovaného kódu s izolovanými daty

Testy načetly index.html stažený zPages a ověřený přesným hashem. Pro přístup ke closure se přidaly pouze testovací hooky; veškerý Auth/Firebase provoz byl nahrazen izolovaným mockem. Nejde o ukládání do produkční Firebase.

- Bezpečný odvod6 před MISS7: +1koule/+1pokus/+1úspěšný strk, následující MISS +1neúspěšný pokus. Derived původ zachován. Cílený unit test opakovaného odvození potvrzuje jen jeden záznam a jediné započtení;4/4testy PASS. Ostatní unknown situace nejsou povyšovány na complete.
- RESAFE a ostatní nulové úniky: explicitní pottedCount0 přežije skutečnou secureMatchRequest JSON serializaci, odstranění balls[] vmocku, GET, resumeLocalMatch a reload. UNDO PASS. Chybějící počet zůstává unknown_pots.
- Syntetický Team průchod po cloudovém reloadu:20/21complete a21koulí complete. A1/A2/B complete i skutečně unknown varianta správně zachovávají úplnost/hvězdičku.
- Šest skutečných PNG1920×1080/PDF1440×810 párů pro A1/A2/B PASS. Žádné skutečné Firebase požadavky/zápisy ani JS chyby. Artefakty lokálně work/release92-production/isolated-exports/.

[Strojová evidence souborů a kontrol](deployment-v4.51.92-verification.json). [Oprava a samostatný plán nápravy starého zápasu](federal-zero-and-miss-v4.51.92.md).

## Omezení a původní data

Produkční Auth, reálný Firebase roundtrip/Rules, skutečné OBS a fyzický iPhone nejsou ověřeny. Funkční cloudové scénáře jsou ověřeny izolovaně na přesně publikovaném kódu; nenahrazují zkoušku reálného přihlášení.

Původní Team #1 1:5 match5a97e289-a5f5-4da4-bd85-8bc00daf1cc9 se neopravoval. Žádná plošná migrace ani produkční testovací zápasy. Dodaný export má nadále původní SHA2567ad5bf902cdd24d585a4bd092f564bcc7a61eb8d692d84008d58013926716c4a. Samotné nasazení neopravuje staré záznamy; cílená náprava zůstává samostatným neschváleným krokem.

Následný čistě dokumentační commit nemění aplikaci ani verzi. Může vyvolat další automatický Pages běh; nejde o ručně opakovaný deployment.
