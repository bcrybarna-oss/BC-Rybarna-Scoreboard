# Zakládání a rozlosování běžného turnaje

Dominik, 8. 11. 2026. Kandidát v4.51.115 RC vychází z přesného main `49deb97589316c09695669250fd6927776d4a907` (v4.51.114 RC). Samostatný PR ke kontrole. PR #55 zůstává otevřený a mimo tento diff.

## Reprodukce a příčina

`updateTournamentCreateButtonLabel()` při otevřené prezenci nastavoval nativní `disabled`. Klepnutí tedy nemohlo spustit ani existující validaci. Varování `saveTournamentCheckinDraft()` o místním úložišti zůstalo viditelné vedle tlačítka v jednom flex řádku. Na 390 px se varování zalamovalo a měnilo výšku tlačítka. Samotná chyba `setItem()` byla už ve v101 zachycená a držela změny v paměti.

| Scénář ve skutečném HTML | Výsledek na main | Výsledek na kandidátu |
| --- | --- | --- |
| Otevřená prezence bez hráčů nebo s hráči | Nativně vypnuté tlačítko. Bez požadavku i vysvětlení u tlačítka. | Klepnutí zobrazí konkrétní důvod a zachová pravidla prezence, platby a formátu. |
| Dost hráčů a uzavřená prezence při běžném, plném i zakázaném úložišti | PUT proběhne a při úspěchu otevře detail. Úspěch čtení po zápisu se u běžného turnaje neověřoval. | Detail se otevře až po potvrzení stejného turnaje ověřovacím GET. |
| Cloud PUT selže | Formulář již ztratil seznam hráčů a prezenci. Turnaj zůstane v místním seznamu a toast odkazuje na synchronizaci. Obecná synchronizace appData přitom samostatné turnaje neodesílá. | Příprava a ID zůstanou zachované. Trvalý stav popíše selhání zápisu a nabídne opakování. |
| PUT přijde na server, GET selže | Vytvoření běžného turnaje ověřovací GET nemělo. | Formulář drží stejný pokus. Další GET potvrdí stejný záznam bez druhého PUT. |
| Návrat k formuláři na stejné stránce při nedostupném úložišti | Příprava v RAM zůstane. Reload před zápisem ji ztratí. | Příprava zůstane v RAM. Upozornění výslovně říká, co se stane při reloadu a zavření. |

Při reprodukci šlo po uzavření prezence rozlosovat SKO. Výpadek generátoru se na tomto vstupu neprojevil. Dále se nezávisle prokázala ztráta přípravy při odmítnutém PUT. Z reprodukce nelze určit, který stav nastal na konkrétním telefonu.

## Uložení a ovládání

Před rozlosováním zůstávají v platnosti kontroly zaplacených účastníků, minimálního počtu hráčů, formátu, losu, handicapu a cen. Důvod blokace, stav zápisu či ověření a informace o úložišti mají samostatné místo pod tlačítkem. Mobilní tlačítko využívá celou dostupnou šířku a oblast se po klepnutí posune nad pevnou spodní navigaci.

První vytvoření používá stávající zabezpečený PUT a následný GET stejného ID. Porovnání obsahu zohledňuje Firebase serializaci prázdných uzlů stejně jako historický turnaj. Opakování nejprve načte stejné ID. Pokud záznam chybí, zapíše původní přípravu pod stejným ID. Pokud odpovídá, dokončí ověření bez dalšího zápisu. Jiný obsah vyžaduje kontrolu v seznamu a další PUT se neodešle. Rozlosování se po dobu nevyřešeného pokusu drží beze změny. Během zápisu se další klepnutí ignoruje a odeslání i dokončení kontrolují původní relaci účtu.

Návrh používá dosavadní klíč prezence a přidává volitelný neověřený pokus. Po úspěšném místním zápisu se upozornění skryje. Při nedostupném úložišti stejný pokus lze zopakovat v otevřené stránce. Po jejím zavření nebo reloadu bez lokálního zápisu nelze obnovit neuložené ID. Pokud již PUT mohl proběhnout, zkontroluj po přihlášení seznam cloudových turnajů. V mocku se ověřilo, že nesouvisející klíč zůstal zachovaný.

Ve v100 přibyla obnova hesla. Samostatný soubor `docs/tournament-setup-v4.51.100.md` na main ani v historii nebyl nalezen. Podkladem je revize v100 a [diagnostika v101](tournament-setup-v4.51.101.md). Regrese v101 ověřuje paměťový režim, oddělené disciplíny a race-to skupin a play-off, ruční nasazení i historický ETag PUT a ověřovací GET. Datový formát turnajů a chování generátorů se zachovaly.

## Snímky a testy

- [Main, mobil 390 × 844](screenshots/ordinary-115-main-mobile.png)
- [Kandidát, mobil 390 × 844](screenshots/ordinary-115-mobile-390.png)
- [Kandidát, mobil 320 × 844](screenshots/ordinary-115-mobile-320.png)
- [Kandidát, desktop 1440 × 1000](screenshots/ordinary-115-desktop.png)

`tests/ordinary-tournament-create-browser.cjs` spouští skutečné HTML s izolovaným mockem sítě. `ORDINARY_BASELINE=1` načte přesný Git blob main. Kandidát pokrývá SKO, DKO, skupiny, skupiny se SKO a DKO, švýcarský formát, náhodné a ruční nasazení, ELO a oba režimy elektronického losu. Ověřuje platbu, uzavření a znovuotevření prezence, nedokončený los, nepřekrytá upozornění, opakovaná klepnutí, PUT/GET výpadek a obnovení stejného ID.

Release gate a lokální produkční Node sada prošly, 383 PASS. Prošly browserové regrese v101, mobilní ovládání, recovery, D4 a skutečný případ Federal Cupu #9 s výsledky a reportem. Test v101 použil soukromý archiv z 27. 10. 2026 pouze pro čtení v mocku. Má 40 913 440 bajtů a po testu odpovídá původnímu obsahu. Archiv je mimo PR.

Experiment má 28 PASS a dvě známá selhání identity, shodná s předchozím main. Při čekání na Auth se neodpojí editovatelný zápas a zbytkové UID je uznáno bez autentizace. Živé Auth, Firebase Rules, fyzický telefon a konkrétní neuložená příprava uživatele zůstávají neověřené.

Návrat probíhá reverzí kódu v novém vydání podle AGENTS.md. Uložené turnaje nevyžadují obnovu ani migraci. Etapy 10b1 a 10b2 jsou nezahájené.
