# Etapa 10b0 — životnost čtení zápasů

Dominik, 6. 11. 2026. Kandidát v4.51.114 RC z main `f68098c7212425907e33699b577c530685093b77` (v4.51.113 RC). Samostatná funkční oprava D4 čeká na kontrolu v PR. Jaroslavův PR #55 byl při přípravě stále otevřený a jeho cloud-readiness kontrakt není součástí tohoto základu.

`loadSecureMatches` původně sdílel Promise podle UID při volání. `readSecureMatches` si po autorizaci znovu vzal tehdejší UID a porovnal ho až po dekódování JSON. Na přesném main izolovaný audit reprodukoval přijetí staré odpovědi po A → B → A. Prohlížeč navíc ukázal, že nová A převzala starou Promise. Starý výsledek pak prošel historickou normalizací, přepsal stav a cache a spustil opravný PUT v mocku.

Čtečku volá přihlášení a cloudová synchronizace, dashboard, historie a statistiky, turnajové výsledky, Livescore, Federal Cup a postupy ukládání či obnovy. Všechny nadále volají stejný `loadSecureMatches`. Funkce vlastní jeden rozpracovaný job pro UID a generaci. Promise rezervuje před autorizací a finalizer uvolní pouze vlastní job.

Úspěšný sign-in nebo registrace a vyčištění relace zvyšují generaci. Změna UID po Auth lookupu ji zvyšuje také. Obnova tokenu ve stejné relaci ji ponechává. Kontext konkrétního čtení se předá existujícímu mechanismu `ensureCloudToken({current})`, aby opožděná obnova tokenu neměnila novou relaci. Kontrola po autorizaci předchází GET a kontrola po JSON decode bezprostředně předchází publikaci do `data.matches`. Pravidlo funguje i když starý požadavek doběhne.

Platná odpověď zachovává normalizaci, neznámá pole, potvrzovací stavy, uložení cache a render. Historický opravný PUT má volitelný kontext čtení, který se kontroluje při vstupu a po autorizaci těsně před odesláním. Již odeslaný PUT může doběhnout. Odložené zobrazení potvrzení kontroluje stejnou relaci. Ostatní zápisy používají dosavadní volání bez kontextu.

## Ověření

Stejné požadavky testuje `tests/match-read-session.test.cjs` nad produkčními funkcemi extrahovanými z HTML. Pro porovnání lze zapsat přesný Git blob baseline `index.html` do dočasného souboru a spustit s `D4_BASELINE_SOURCE` ukazujícím na tento soubor. Kandidát se testuje bez této proměnné. V baseline je reprodukováno 7 porušení kontraktu včetně přihlášení stejného UID, opožděné obnovy tokenu a závodu mezi autorizací opravného PUT a přepnutím účtu.

Baseline má 5 úspěšných kontrol a 7 reprodukovaných selhání. Kandidát splňuje všech 12 kontrol. Patří sem 20 souběžných volání s jednou autorizací a jedním GET, A → logout → A, A → B, opožděný JSON a finalizer, token refresh, 401/403, síťová chyba, neplatný JSON a následné platné čtení. Testy ověřují také potvrzovací stavy a přesný payload povoleného opravného PUT.

`tests/match-read-session-browser.cjs` porovnává stejné vstupy v Chromu na desktopu i mobilním viewportu. Test spouští skutečné přihlášení a lookup proti mockům, drží první odpověď, poté přepne A → B → A a vydá odpovědi ve zvoleném pořadí. Stará A v baseline přepíše novou relaci. Kandidát provede vlastní GET pro novou A, podrží její data, cache a dashboard a ze starého čtení neodešle žádný opravný PUT.

Na obou viewports prošla historie, statistika hráče a explicitní uložení dokončeného zápasu i potvrzení výsledku přes izolovaný mock. Prošly také existující browser kontroly recovery a offline režimu, mobilního ovládání v112, výzev, notifikací, turnajů a reportů Federal Cupu Singles/Doubles/Team s exporty PNG/PDF/XLSX.

- Release gate prošel. Lokální produkční Node sada se soukromými fixtures má 383 PASS, 0 FAIL, 0 SKIP.
- Experimentální sada má 28 PASS a dvě známá selhání. První se týká neodpojení editovatelného zápasu při čekání na Auth, druhé uznání zbytkového UID bez autentizace. Experimentální soubory zůstaly shodné s main.
- Historický audit odstraněného žurnálu zůstává samostatný s 0 PASS a 2 FAIL. Hodnotí původní návrh.
- Doplňkový `federal-pushout-cloud-browser.cjs` končí na shodném tvrzení v baseline i kandidátu. U faulu s neznámým záměrem po cloud roundtripu očekává jmenovatel 0, skutečný výsledek je `null`. Tvrzení i sportovní logika jsou zachovány. Samostatné exporty Pushout XLSX prošly.

Živé Auth a Firebase Rules zůstávají neověřené, protože chybí autorizované izolované prostředí s věrnou kopií pravidel. Produkční účty ani databáze nejsou součástí testů. D1, D2, D3 a D5 jsou dál samostatné body. Návrat znamená reverzi kódu v novém vydání. Datový formát a produkční data zůstanou při návratu zachovány.
