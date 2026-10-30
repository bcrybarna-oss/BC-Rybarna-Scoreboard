# Poolčítadlo LIVE – technický kontrakt a postup (30. 10. 2026)

**Zadavatel:** Jaroslav. **Stav:** návrh + první izolovaný místní prototyp; nikoliv produkční implementace.

## Schválené produktové hranice

1. **Jeden aktivní odchozí stream na vlastníka/účet.** Jiní uživatelé mohou vysílat současně nezávisle. Dva současné výstupy pro stejného vlastníka se mají serverově odmítnout, ne pouze skrýt tlačítko.
2. **Více kamer a scén v jednom streamu**, včetně střídání obrazů více stolů. Každá kamera je samostatný zdroj; každý zobrazovaný zápas má vlastní matchId.
3. **Role jsou kombinovatelné:** správce streamu, režisér, komentátor, kameraman, zapisovatel skóre. Maximálně dva komentátoři na jeden výstup pro první verzi. Jeden aktivní režisér drží krátkodobou „lease“ s možností předání; přechod bez přerušení vysílání.
4. Režisér má oprávnění k výběru zápasu a scén, nikoli automatické právo upravovat sportovní skóre. Oprávnění pro klub a jednotlivý zápas zůstávají oddělená.
5. **Overlay**: stávající aktuální skóre, několik šablon, barevné poloviny podle klubů, automatický kontrast, nezávislý malý vodoznak „Poolčítadlo by BC Rybárna“. Při přepnutí zápasu musí být jeho skóre jednoznačně navázané na matchId; nesmí se zobrazit data předchozího zápasu.
6. **Původní OBS overlay zůstává** nezměněný, dokud jeho případná migrace nebude výslovně schválená.

## Zamýšlená architektura (zatím nebyla zapojena)

- **Frontend:** mobilní/desktop web Streamovacího studia, přístup k MediaDevices pouze po výslovném kliknutí; samostatná obrazovka pro kameramana a komentátora.
- **Autentizovaný backend:** založení/ukončení relace, autorizace rolí, jednorázové/expirující pozvánky, vydávání časově omezených LiveKit tokenů, kontrola limitu 1 stream/účet.
- **Samostatný Firebase testovací projekt:** stav streamu, role, aktivní zápas a metadata kamer; produkční Firebase se nesmí používat ani pro pokusné čtení/zápisy. Firebase Rules ověřit v emulátoru; serverové přístupy nesmějí záviset jen na UI nebo localStorage.
- **Mediální vrstva (kandidát LiveKit):** kamery a mikrofony jako oddělené WebRTC stopy, centrální kompozitor renderující scény a aktuální overlay, samostatný zvukový mix se dvěma komentátory, jeden Egress výstup do Facebook RTMPS.
- **Facebook:** vysílací klíč ukládat pouze šifrovaně na backend; nepředávat jej prohlížeči, Firebase klientské databázi ani do repozitáře. Ověřit konkrétní postup Live Producer a omezení stránky. Počítat s tím, že samotné odeslání RTMPS nemusí automaticky publikovat video.
- **Provoz:** limity ceny/kapacity, heartbeat, clean-up při ztrátě spojení, oddělení jednotlivých uživatelů, rekonexe kamery. Přepnutí scény nesmí restartovat Facebook přenos.

## Kritické kontrakty

- **Vlastnictví relace:** atomicky přidělit stream jedinému účtu; duplicita dvou souběžných kliknutí nesmí vytvořit dvě Egress úlohy. Server při uzavření musí ověřit ownerId + sessionId + oprávnění.
- **Stav streamu:** `idle → preparing → ready → broadcasting → stopping → stopped`; chyby a obnovení nejsou záminkou k převzetí jiné relace.
- **Scéna:** nový `sceneRevision` a přidělené `matchId`, s potvrzením aktualizace overlaye. Do té doby ponechat poslední bezpečnou grafiku nebo neutrální přechodovou scénu.
- **Komentátor:** přístup jen do své relace, mikrofon volitelně vypnut při připojení, výběr vstupu a sluchátek, na serveru odvolatelné oprávnění.
- **Režisér:** kombinovatelná role + jedna aktivní řídicí lease. Přepnutí kamer musí být odolné proti dvěma souběžným požadavkům a nesmí ovlivnit skóre.
- **Pauza/obraz:** vypadne-li kamera, zobrazit bezpečnou přestávkovou obrazovku; neukončovat automaticky ostatní připojené mikrofony ani stream.
- **iOS:** webová kamera může přestat fungovat při uzamčení či odchodu Safari do pozadí; řešit jasným upozorněním a testem na fyzickém zařízení, nikoliv slibem trvalého běhu.

## Vývojové etapy / brány

| Etapa | Rozsah | Jak prokázat |
|---|---|---|
| 0 – Lab (zahájeno) | Místní náhled, jedna kamera, změna scén, demo skóre, klubové barvy a watermark | Syntax/bezpečnostní kontrola + ruční desktop/iOS |
| 1 – Skutečný výstup | Samostatný testovací backend a Firebase, WebRTC jedna kamera, jeden FB RTMPS, původní overlay jako vzor | Jediný dvouhodinový reálný přenos; bezpečné odpojení |
| 2 – Multikamera | QR jednorázové pozvánky, více kamer, střih a předvolená scéna | Připojení/odchod dvou různých zařízení bez restartu FB |
| 3 – Komentář a role | 1–2 mikrofony, izolovaný mix, kombinované role a předání režie | Kdo může co ovládat; zrušení pozvánky; prevence dvojí režie |
| 4 – Herní režie | Přepínání mezi stoly, bezpečné přepnutí matchId, klubové šablony | Správné skóre na vybrané scéně, bez kontaminace dat jiných zápasů |

## Izolace a release

- Vývoj v samostatné větvi `feature/poolcitadlo-live-lab-20261030`. `main`, aktuální `index.html`, `overlay.html`, produkční účty a data se nemění.
- Testovací HTTPS doména, Firebase a LiveKit nejsou dosud zřízené. Neexistuje zatím veřejný odkaz pro spuštění na iPhonu.
- `studio-lab/` je samostatná experimentální plocha, nikoliv nový produkční vstup. Pokud bude někdy chtít nasadit kód do hlavního webu, nejprve projít release politikou, verzováním `v4.51.X RC`, bezpečnostním ověřením, dokumentací, CI a výslovným schválením sloučení.

## Experimentální etapa 1A (30. 10. 2026) – omezený MediaRecorder relay

Na samostatné větvi existuje výhradně **testovací** prototyp `studio-live-test/`: iPhone Safari/Chrome skládá kameru a grafický scoreboard do canvas, `MediaRecorder` odesílá fragmentované MP4/WebM přes zabezpečené WebSocket spojení na Node.js službu a FFmpeg převádí výstup do H.264 + **tichého** AAC pro Facebook RTMPS. Jde o **alternativní rychlou technickou zkoušku** vůči plánovanému LiveKit/WebRTC modelu, nikoliv jeho definitivní náhradu. Nelze tvrdit, že bude spolehlivá na fyzickém iPhonu bez ručního testu.

- Kód má jedno vysílání **na celý testovací server**, nikoliv hotovou per-UID správu. Je chráněný `STUDIO_ADMIN_TOKEN`; streamovací klíč se nikdy nevkládá do repozitáře ani do klientské Firebase. Žádné propojení s ostrým skóre.
- Vše je zcela mimo produkční `index.html`, `overlay.html` a Firebase; propojení Facebook Live není zkontrolováno živým přenosem.
- CI kontraktně testuje přístup, heslo, účty relací a browser→FFmpeg pomocí **syntetické kamery** a lokálního FLV výstupu; další bránou je Docker build + Render deploy (samostatný testovací web), pak fyzický iPhone a testovací FB Live Producer.
- Pokud iOS MediaRecorder selže nebo transport není dostatečně stabilní, vrátíme se k plnohodnotnému WebRTC serveru, nikoli k ukládání klíče do veřejného HTML. Pro ostré turnaje se prototyp **nepoužívá**.

