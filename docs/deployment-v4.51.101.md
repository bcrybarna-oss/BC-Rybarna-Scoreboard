# Nasazení v4.51.101 RC

Zadavatel: Dominik. Datum: 27. 10. 2026. **Nasazeno a v uvedeném rozsahu ověřeno.** Další modularizace zůstává pozastavená.

- Produkce: https://bcrybarna-oss.github.io/BC-Rybarna-Scoreboard/
- [PR #40](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/40), schválená hlava `38fe26a342cf9ccf557ef179b09a29b31dc34639`.
- Předchozí main `d560fb7b8d40ca40ca30a7d0ae48410cb391e914` / v4.51.100 RC.
- Aplikační merge **`93f87324c18aa3694afb46694623ff7e3b2c10c6`**; zachovaná historie.
- [GitHub Pages 40580177141](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40580177141): build, deploy i report-build-status success. Deployment nebyl ručně opakován.

## Před sloučením a CI

Čerstvý fetch potvrdil aktuální main, schválenou hlavu a nepřítomnost konfliktu. Sledované soubory čisté, cizí nesledované pracovní soubory zachovány. Pravidla AGENTS.md i release gate PASS; merge byl podmíněn přesnou hlavou PR.

[Finální PR CI 40578528533](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40578528533) a [main CI 40580177314](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40580177314): release PASS, Node **247 PASS / 2 FAIL / 3 SKIP ze 252**. Soukromé exporty v CI nejsou; předchozí lokální úplná sada s nimi 250 PASS / 2 FAIL / 0 SKIP. Před sloučením 8/8 cílených testů turnajové přípravy a Jaroslavovy obnovy hesla PASS.

Logy obou chyb jednotlivě porovnány s [CI aktuálního předmerge main 40576067328](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40576067328), kde 244 PASS / stejné 2 FAIL / 3 SKIP ze 249:

1. `preview-match-reload-recovery.test.cjs:50`: skutečný rozpor kontraktu čekání na identitu, aktivní pointer zůstává místo odpojení bez smazání uložené kopie.
2. `:106`: zastaralý regex samostatného volání obnovy, jehož výsledek se nyní přiřazuje pro turnajový fallback.

CI není plně zelené. Žádná nová regrese, vypnutí testu nebo změna workflow. Obnova hesla i její testy z verze 100 zachovány; funkce v publikovaném HTML je navíc přesně shodná s předmerge main (SHA256 `68239d6f690b44b59c8207b67169256c4b5a975ca52b56f0647a2971e3edfada`).

## Skutečný veřejný web

Čisté Chrome relace, desktop 1440×1000 a mobilní viewport 390×844. Žádné produkční cookies, tokeny nebo přihlášení. Veškerá Firebase/Auth komunikace a jiné než GET/HEAD požadavky blokované; žádný pokus o zápis.

- Veřejné index.html, overlay.html a 15 assetů HTTP200, přesné SHA256 vůči merge. HTML/overlay/oba moduly shodné i přes cache-busting URL. Skutečně zobrazená **v4.51.101 RC**, oba produkční moduly načtené jednou a beze změny.
- ZAPOMENUTÉ HESLO? je viditelné. Prázdný e-mail je odmítnut místní validací bez síťového požadavku; žádný resetovací e-mail nebyl odeslán.
- Úvod → Výsledky → Úvod → Turnaje → Vytvořit turnaj: samostatná disciplína skupin/play-off a race-to jsou viditelné a použitelné u Skupiny→SKO/DKO. Nastaveno 8-ball/3 a 10-ball/7 pouze v čisté místní offline relaci, žádný turnaj nevytvořen.
- Návrat na Úvod a Federal Cup: přehled se 21 položkami programu funguje. V obou viewports 0 pageerrors, 0 konzolových chyb, 0 blokovaných Firebase nebo zápisových požadavků.
- Historický formulář vyžaduje oprávněnou správu série, proto jeho živé produkční otevření bez přihlášení neověřeno. Funkční ověření proběhlo samostatně níže.

## Publikovaný kód v izolovaném prostředí

Vstupem je skutečně stažené veřejné HTML shodné s merge, moduly i writer mají shodné otisky. Firebase mock zachytí všechny síťové požadavky; reálná produkční databáze nedostane žádný zápis. Soukromý export z 27.10. (40 913 440B / 189 zápasů / 26 hráčů) slouží pouze jako paměťová kopie; jeho SHA256 se nezměnil.

- `tournament-setup-browser`: desktop Skupiny→SKO a mobil Skupiny→DKO. Běžný i historický formulář, ruční výběr/nasazení, návrat ke konfiguraci, zavření/otevření, uložení ETag PUT + ověřovací GET a opětovné načtení z mocku PASS. Serializace mocku odstraňuje prázdné uzly jako Firebase.
- Skutečný browser odmítne uložit celý archiv kvótou. Další vyčerpané místo je deterministicky simulováno pro všechny zápisy localStorage. Příprava zůstává v paměti, zachovává hráče i nastavení a obsahuje viditelné upozornění na ztrátu po reloadu/zavření. Sentinel jiné místní hodnoty zůstává zachovaný. Cloudové uložení turnaje pokračuje a ověřuje se; neúspěšná místní cache se nevydává za uloženou zálohu.
- Opravdu vytvořený skupinový zápas: **8-ball, target 3**. Play-off zápas: **10-ball, target 7**. Běžné zápasy nemají federalCupLink; historické fáze používají stejný resolver. Konfigurace Federal Cupu před/po shodná, program má 21 položek.
- Doplňkový scénář zcela neuložené historické přípravy: kvóta blokuje již první vstup do formuláře. Výběr i nasazení přežijí zavření/otevření dialogu ve stejné stránce. UI výslovně varuje před reloadem. Po skutečném reloadu se neuložený návrh neobnoví; nejde o falešně slíbené trvalé uložení. Kontrola desktopu i mobilu zaznamenána ve strojové evidenci.

Počáteční kontrolní běhy měly chyby ověřovacího prostředí (jednorázová alokace paměti nástroje, zablokované dvě statické exportní knihovny a souřadnice mobilního screenshotu). Opraveny pouze ověřovací skripty; úplné finální běhy prošly, aplikační kód nebyl kvůli tomu měněn.

## Omezení, dokumentace a návrat

Živá přihlášená produkční Auth a správce série, skutečné doručení resetovacího e-mailu, fyzický iPhone/Safari ani OBS neověřeny. JSON nedokládá uživatelovu původní neuloženou přípravu nebo skutečné zaplnění jeho zařízení. Nedostatečná kapacita localStorage pro celý archiv trvá; při nedostupném místním uložení nelze obnovu neuložené přípravy po reloadu zaručit a UI to říká.

Produkční data, zápasy, turnaje a zálohy se neměnily ani nemigrovaly. Nová chyba způsobená vydáním nebyla zjištěna, rollback nebyl potřeba. V případě potvrzené regrese revert merge `93f87324c18aa3694afb46694623ff7e3b2c10c6` standardním reverzním commitem podle AGENTS.md s novou verzí/release gate/Pages kontrolou; bez vracení dat. Obnova hesla z verze 100 tím zůstává zachovaná.

Čistě dokumentační pokračování nemění aplikační kód ani verzi; případný automatický Pages běh publikuje stejnou aplikaci. [Strojová evidence](deployment-v4.51.101-verification.json), [původní diagnostika](tournament-setup-v4.51.101.md).
