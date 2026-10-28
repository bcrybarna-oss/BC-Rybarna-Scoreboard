# Nasazení v4.51.103 RC

Zadavatel: Dominik. Datum: 28. 10. 2026. Stav: **nasazeno a v níže uvedeném rozsahu ověřeno**. Produkční data beze změny a migrace. Další etapa nezahájena.

## Vydání a GitHub

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- Schválený PR42: https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/42
- Schválená hlava:0ae67bef78930dac8699fb92a39669d473abb4be; výchozí main6d809e01e75f5755180265378a2906efe6bdbec8 po čerstvém fetchi beze změny. Cizí místní soubory zachovány.
- Merge se zachováním historie: **4b66ae068fa86b61b1b4e37c14f25bc3f304c3fc**. Bez force push, resetu nebo migrace.
- [Pages40759055156](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40759055156): build/deploy/report success; nasazení automatické, nebylo ručně opakováno.
- [PR CI40756234130](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40756234130) a [main CI40759054878](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40759054878): release PASS, Node **264 PASS /2 známé FAIL /3 soukromé SKIP z269**. Předmerge30/30cílených testů PASS. CI jako celek není zelené.
- Obě chyby jednotlivě porovnány s aktuálním výchozím main/CI40751558281 (258/2/3 z263), bez nových selhání: preview-match-reload-recovery:50 je nesoulad odpojení pointeru při nedostupné identitě v experimentálním core; :106 je regex očekávající samostatné volání obnovy namísto přiřazeného výsledku pro tournament fallback. Testy ani test-modular nebyly upravovány.

## Veřejná produkce – anonymní relace

Devatenáct veřejných souborů (HTML/overlay a17assetů) HTTP200, přesné SHA256 proti merge. Index, overlay i všechny4moduly ověřeny také bez cache přes unikátníURL. Viditelná verze103, každý modul načten jednou, bez fallbacku. Původní obnova hesla100 zůstává byteově stejnou funkcí; ověřena pouze místní validace prázdného e-mailu bez odeslání.

Desktop1440×1000 a mobilní viewport390×844: navigace home/results/FC a dostupné anonymní Mojehlášení, běžná turnajová phase pole zachována. FC má21položek, tlačítko společných statistik a A2dialog se otevře/zavře. Na každém viewportu5opakovaných odchodů a vstupů:1interval/1pagehide během přehledu a0/0po odchodu. Žádné pageerror ani consoleerror. Browser dovolil jen čtecí veřejné statické soubory/knihovny; Firebase/Auth a všechny zápisy blokované, skutečné blokované pokusy0.

Anonymní čistá relace neověřuje živé cloudové výsledky a soukromé A1/B; lokální výchozí přehled není prezentován jako přihlášená produkční data.

## Izolovaně na skutečně publikovaném kódu

Testy použily stažené produkční HTML a všechny4moduly; před každým spuštěním SHA256, read-only přesměrování souborů v testovacím procesu. Žádná změna souborů aplikace ani produkčních dat. Auth/Firebase zcela mockované, soukromý export jen v RAM a nezměněn. Nejde o živou přihlášenou relaci.

- FederalViewer:20vstupů/odchodů nad40 913 440B exportem27.10./189zápasů/26profilů. Sdílení3souběžných obnovení→1GETmatches;0pozdníchrenderů po odchodu i starémA po novémB. Během1interval/1listener, po odchodu/logoutu0/0; stabilníDOM, výpadek/retry PASS. Max2transporty zahrnuje zadržené staréA a novéB, ne duplicitní aktuální scope. Sdílené čtení se neabortuje při opuštění FC; ignoruje se jeho neplatné screen-owned dokončení.
- CloudRefresh: opakovaná navigace, login/logout, změna identity, opožděné tělo/token, výpadek/retry a sdílení požadavků PASS. Dosavadní ochrana cloudových revizí a single-flight zachována; žádná změna cache či transportních těl.
- A1/A2/B, mobilní zoom a skutečné PNG1920×1080 PASS. Kontrolní Singles3SK93%14 protiCZ95%38. Skutečná XLSX Singles/Doubles/Team stažení desktop/mobil,2listy, scope a hodnoty PASS. Původní PDF regrese také prošla, ovládání/závislosti PDF se nemění.

[Strojová evidence bez soukromých herních dat](deployment-v4.51.103-verification.json). Lokální pracovní artefakty:output/deployment103 (nejsou součástí repozitáře).

## Omezení a návrat

Živá produkční Auth/Firebase a existující soukromá hlášení/zápasy nebyly ověřeny. Uživatel u102 potvrdil jen přihlášené otevření prázdných Mýchhlášení. Fyzický iPhone/Safari, reálnéOBS a doručení resetovacího e-mailu neověřeny. Původní uživatel opravu turnajů101 stále nepotvrdil na svém zařízení. Limity jednorázového blokováníB a nedostatečné kapacity celé archivní cache trvají.

Nová blokující chyba nebyla zjištěna; návrat nebyl potřeba. Případný rollback reverzí celého merge4b66ae068fa86b61b1b4e37c14f25bc3f304c3fc standardním release postupem s novou verzí, bez vracení dat nebo migrace. Čistě dokumentační pokračování nemění verzi ani aplikační bytes; automatické Pages po něm publikují stejnou aplikaci.
