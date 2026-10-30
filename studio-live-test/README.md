# Poolčítadlo LIVE → Facebook: IZOLOVANÝ TESTOVACÍ RELAY

**Zadavatel:** Jaroslav · 30. 10. 2026  
**Stav:** experimentální kód v PR #48; **nenasazeno**, neověřeno proti skutečnému Facebooku ani Safari iOS. NIKDY NESLUČOVAT DO `main` bez samostatného schválení. Produkční `index.html`, `overlay.html`, Firebase a účty nejsou dotčené.

## Rychlejší nasazení přes Render Blueprint

Ve vývojové větvi je nyní také soubor **`render.yaml`**, který vytváří **samostatnou testovací službu**. V Render Dashboardu lze zvolit **New → Blueprint**, připojit GitHub repozitář a vybrat vývojovou větev `feature/poolcitadlo-live-lab-20261030`; soubor `render.yaml` z této větve nastaví Dockerfile, HTTPS webovou službu, frankfurtský region a vypnuté automatické aktualizace. Při vytváření zadáš pouze tajné `STUDIO_ADMIN_TOKEN` (min. 24 znaků). Nesmíš pro tuto službu použít ostrý web nebo produkční branch. Nepokoušej se slučovat PR #48 jen proto, aby se objevila konfigurace v main.

**Blueprint nabízí bezplatný plán**, který může při převodu videa na FFmpeg nestačit výkonem ani limity odchozího provozu. Pokud by bylo nutné zvýšit výkon, Render může účtovat poplatek – placený plán nikdy nepotvrzuj bez vlastního rozhodnutí o ceně.

## Co tento prototyp skutečně dělá

Telefon otevře **HTTPS webový server** s testovací stránkou. Prohlížeč po stisknutí **Zapnout kameru** vykresluje obraz + skóre + klubové barvy + vodoznak do HTML `canvas`. Po kliknutí na **Začít odesílat na Facebook** odesílá `MediaRecorder` fragmenty přes zabezpečený `wss://` socket na **stejný server**. Server spustí jeden proces FFmpeg a převede je do H.264 video + AAC **tichý zvuk**, v rozlišení 960×540/20 fps, a pokusí se odeslat na RTMPS adresu uvedenou Facebook Live Producerem.

**Veřejný Netlify Drop s HTML tohle sám neumí.** Je třeba spustit backend Node.js + FFmpeg v Dockeru na samostatném testovacím webovém hostingu, který podporuje WebSockets a má HTTPS (např. Render **Web Service**, ne Static Site).

## Co připravit

- **Render účet / jiný Docker hosting** s HTTPS URL, dostupný z iPhonu; nemusí to být ostrý web Poolčítadla.
- **Tajné administrátorské heslo serveru:** náhodný řetězec délky min. 24 znaků v soukromé proměnné prostředí `STUDIO_ADMIN_TOKEN`. Neposílej ho do GitHubu ani sem do chatu.
- **Facebook Live Producer:** při vytváření testovacího vysílání zvol **Streamovací software**, zkopíruj jeho aktuální RTMPS *Server URL* a *Stream Key*. Heslo a klíč neukládej do souboru ani do prohlížeče.
- Kvalitní mobilní internet. iPhone během streamu **neuzamykej** a ponech Safari v popředí.

## Nasazení na Render jako nový nezávislý web

1. Přihlas se na <https://dashboard.render.com/> a vyber **New → Web Service → Git Provider → GitHub**, vyber repozitář `bcrybarna-oss/BC-Rybarna-Scoreboard`.
2. **Branch:** `feature/poolcitadlo-live-lab-20261030`. **NE** `main`.
3. **Runtime:** Docker. **Dockerfile Path:** `studio-live-test/Dockerfile`. **Docker Build Context:** `.` (kořen repozitáře). **Root directory** nech prázdné, pokud má být build context kořen repozitáře.
4. V **Environment Variables** vlož **`STUDIO_ADMIN_TOKEN`** a dlouhé náhodné heslo. Port Dockerfile nastavuje `PORT=10000`; neměň ho bez důvodu. Nezadávej zde Facebook Stream Key – ten zůstává jednorázovým vstupem.
5. Vypni **Auto-Deploy**, pokud chceš mít změny pod plnou kontrolou. Zvol vhodný plán a ověř jeho cenu; bezplatná instance může být na převod videa příliš slabá nebo službu přerušit kvůli provozním limitům. Render nabízí HTTPS i WebSockets.
6. Po úspěšném nasazení si otevři **samostatnou** HTTPS adresu `https://...onrender.com` na iPhonu (na mobilním Safari) a zkontroluj, že stránka zobrazuje Poolčítadlo LIVE.
7. Zapni kameru, vyber zkušební scénu, zadej heslo testovacího serveru, Facebook RTMPS URL a aktuální stream key. Klepni na **Začít odesílat na Facebook**.
8. Ve Facebook Live Produceru sleduj náhled. Pokud se obraz objeví, potvrď **Vysílat živě**, až budeš chtít vysílání zpřístupnit. Pro ukončení zastav odesílání v Poolčítadle **a** případně ukonči vysílání na Facebooku.

**Důležité:** Render může vyžadovat schválení GitHub instalace/repozitáře a výběr placeného plánu. Ani samotné nasazení negarantuje, že iOS Safari vytvoří použitelnou fragmentovanou MP4 stopu. Prototyp je experiment, nikoliv slib funkčního ostrého streamu.

## Bezpečnost a limity

- Heslo testovacího serveru se porovnává **na serveru**; neukládá se do HTML, Firebase ani localStorage. FB RTMPS URL + stream key se posílají pouze přes WebSocket (HTTPS/WSS) serveru, v okamžiku pokusu o přenos. Obě vstupní hodnoty se po pokusu o zahájení v prohlížeči vyprázdní.
- Server odmítá cizí `Origin`, chybné heslo, více současných relací a cíle mimo facebook.com doménu přes RTMPS. **Jeden aktivní stream na celý testovací server**, nikoliv plnohodnotný systém na účet.
- FFmpeg argumenty obsahují RTMPS klíč v paměti procesu, proto nepovoluj veřejný přístup k procesům/logům hostingu. Server chyby FFmpeg nepropisuje s adresou ani klíčem.
- V první verzi se **neodesílá živý zvuk telefonu**: FFmpeg přidává tichou AAC stopu, aby byl Facebook formát kompatibilní. Pro komentář a zvuk stolu bude potřeba další etapa.
- Server limituje jeden test na **60 minut**, není optimalizovaný pro celodenní turnaj, nepodporuje obnovu po výpadku a není napojený na skutečné skórování. Nekvalifikovat jako produkční systém.
- Free hosting může mít omezení času běhu, provozu a CPU. **Nezveřejňovat tajné klíče v PR, Actions, chatu, screenshotech ani v URL.**
- V zájmu bezpečnosti neumožňujeme dočasný klíč uložit do produkční databáze ani na produkční web.

## Lokální test s FFmpeg

Pro vývoj na počítači nainstaluj Node.js 22+, FFmpeg a závislosti:

```bash
cd studio-live-test
npm install
STUDIO_ADMIN_TOKEN="opravdu-dlouhe-tajne-heslo-minimalne-24-znaku" node server.js
```

V prohlížeči počítače otevři `http://localhost:10000`; localhost je výjimka pro přístup ke kameře. Na iPhonu běžné `http://192.168....` nestačí: pro kameru je potřeba bezpečný kontext HTTPS.

CI automaticky spouští unit/WebSocket testy a **syntetické** video přes Chromium → WebSocket → FFmpeg → lokální FLV. Neprovádí žádné spojení na Facebook; jeho skutečný RTMPS příjem i Safari musí být ověřené ručně.

## Pokud spojení selže

- Připojení končí chybou hned: zkontroluj heslo serveru, přesnou Facebook RTMPS adresu a klíč a zda Render Web Service opravdu běží.
- Safari hlásí chybějící `MediaRecorder` nebo `canvas.captureStream`: testovací metoda nepodporuje dané zařízení/konfiguraci a bude potřeba WebRTC ingest (plánovaná LiveKit varianta).
- Facebook nedostává obraz: v diagnostice serveru zkontroluj jen **obecný stav** FFmpeg, nikdy nezkopíruj procesní argumenty či plnou RTMPS URL.
- Zamrzá obraz / přenos se přeruší: může chybět upload rychlost nebo CPU na serveru; zkus stabilní Wi-Fi a silnější instanci.
- Dřívější Netlify testovací stránka bude dál fungovat jako **lokální náhled** a nepřipojí se k tomuto serveru. Pro skutečný pokus musíš otevřít nový web hostující tuto reléovou aplikaci.
