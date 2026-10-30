# Poolčítadlo LIVE – izolovaná laboratoř (etapa 0)

Zadavatel: **Jaroslav**, 30. 10. 2026. Experiment je pouze v samostatné větvi a **není nasazen v produkci**. Nemění `index.html`, `overlay.html`, Firebase ani reálné zápasy.

## Co funguje teď

- Na stránce `studio-lab/index.html` lze po souhlasu spustit lokální kameru, vybrat přední/zadní nebo konkrétní nalezené zařízení a kameru vypnout.
- Režie má čtyři lokální scény: kamera, začínáme, pauza, konec. Nejde o výstup do Facebooku.
- Názvy hráčů, klubů, klubové barvy a skóre lze měnit; zobrazení se aktualizuje v náhledu bez komunikace se serverem.
- Zobrazí se decentní vodoznak „POOLČÍTADLO by BC Rybárna“.
- Vypnutí či opuštění stránky zastaví připojené stopy kamery.

## Co zatím chybí

**Není hotové** vysílání na Facebook, přidání vzdálené kamery, skutečné sdílené skóre, LiveKit, backend, mikrofony komentátorů, kombinovatelné role, uložení nastavení ani nasazení testovací webové adresy. Jeden prohlížeč používá vždy jen jednu aktivní kameru. Scény jsou grafické a testovací, nikoli kompozice několika kamer.

## Lokální spuštění na počítači

V kořeni repozitáře spusť:

```bash
python3 -m http.server 8080
```

Pak otevři **http://localhost:8080/studio-lab/**. Prohlížeč si vyžádá povolení kamery. Kamera je dostupná pouze na zabezpečených stránkách (HTTPS nebo výjimka localhost). Pro testování na iPhonu nestačí zadat IP počítače s obyčejným HTTP: ten není pro mobil bezpečný kontext. Je potřeba **samostatný HTTPS testovací hosting**, nikoliv aktuální produkční GitHub Pages.

Neotevírej aplikaci přes libovolný veřejný HTML proxy/preview server, pokud nechceš svěřit oprávnění ke kameře třetí straně.

## Kontrola

- `node studio-lab/tests/smoke.cjs` – základní statické a syntaktické kontroly.
- `node studio-lab/tests/controller.cjs` – funkční mock test změn skóre, scén, ovládání kamery a dořešení opožděného požadavku po odchodu.
- Ručně: povolit kameru, přepnout kamery, pozastavit/obnovit scénu, měnit jména/skóre/barvy, vypnout kameru, odebrat oprávnění. Vyzkoušet desktop a poté iPhone přes HTTPS.
- Po dokončení každé další etapy doplnit bezpečné integrační testy s mockem / odděleným testovacím projektem. Nepoužívat produkční Firebase pro testovací zápisy.

## Proč existuje samostatná větev

Jde o bezpečný průzkum technického návrhu bez dopadu na ostré Poolčítadlo. Dokud nebude samostatná infrastrukturní a iOS zkouška úspěšná, **neslučovat do main**. Prototyp se může změnit nebo odstranit bez datové migrace.

## Samostatný HTTPS test na iPhonu (bez zásahu do ostré verze)

Každý PR běh `Poolcitalo LIVE laboratory` ověří testovací stránku v Chromium a vytvoří GitHub Actions artifact **poolcitadlo-live-https-package**. Obsahuje pouze `index.html` a `robots.txt`; neobsahuje žádné přihlašovací údaje, Firebase ani serverový kód.

1. Otevři rozpracovaný [PR #48](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/48), přejdi do **Checks** a otevři poslední úspěšný běh **Poolcitalo LIVE laboratory**.
2. V sekci **Artifacts** stáhni `poolcitadlo-live-https-package` (ZIP; GitHub může vyžadovat přihlášení).
3. Jako **samostatný nový web** jej nahraj přes [Netlify Drop](https://app.netlify.com/drop). Netlify Drop podporuje ZIP/HTML a přidělí HTTPS adresu. **Nevybírej ani neupravuj existující ostrý web Poolčítadla**. Přesný postup může záviset na přihlášení na Netlify.
4. HTTPS adresu otevři v Safari na iPhonu, povol kameru, otestuj zadní/přední kameru, přepínání scén a vypnutí.

Tato adresa může být veřejně dostupná komukoli, kdo zná odkaz. V testu se ovšem žádná data neukládají ani neodesílají; veškerý obraz zůstává v prohlížeči. Nepoužívej ji pro ostré přenosy ani skutečnou správu účtů. Testovací kopie se neaktualizuje sama; po změnách je nutné nahrát nový balíček. Kamera musí mít HTTPS oprávnění a otevřenou aktivní stránku. U Netlify je vhodné spravovat zkušební web z vlastního účtu, aby jej bylo možné později vypnout.

**Alternativně** lze připojit samostatnou statickou službu Render k vývojové větvi a nasadit pouze `studio-lab/`; nepublikovat kořen repozitáře ani větev `main`. Nastavení a přihlášení externí služby vyžaduje vlastní autorizaci.
