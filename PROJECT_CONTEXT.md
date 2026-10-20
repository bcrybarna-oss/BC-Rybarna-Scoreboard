# Poolčítadlo – společný kontext projektu

Tento soubor je hlavní společný kontext pro vývoj aplikace Poolčítadlo. Slouží jako zdroj pravdy pro Jaroslava, Dominika i jejich ChatGPT asistenty.

Povinná pravidla spolupráce jsou v `AGENTS.md`. Před každou prací čti také `REVIZE.md` a `PROJECT_STATUS.md`; aktuální verze, ověřené nasazení, rozpracované body a výsledky testů se udržují v `PROJECT_STATUS.md`. Tento soubor popisuje dlouhodobý kontext a nenahrazuje aktuální stav.

## Repozitář a produkce

- GitHub: `bcrybarna-oss/BC-Rybarna-Scoreboard`
- Produkční větev: `main`
- Hlavní produkční soubor: `index.html`
- Aplikace je v současnosti převážně jedna velká HTML aplikace s JavaScriptem a CSS přímo v `index.html`.
- Změny v `main` mohou ovlivnit reálné používání aplikace.

Doporučený workflow:
Výslovný požadavek zadavatele na přímou práci v main má přednost; i tehdy platí kontroly vzdálených změn, testy a dokumentace podle `AGENTS.md`.
1. vytvořit vlastní branch,
2. implementovat změnu,
3. otestovat desktop i mobil,
4. vytvořit Pull Request,
5. projít diff,
6. až potom merge do `main`.

## Vizuální styl

Poolčítadlo používá černo-zlatý design. Logo Poolčítadla funguje jako Home. Mobilní spodní navigace se během přípravy a samotného hraní zápasu automaticky skrývá, aby nepřekážela.

## Účty, role a Firebase

Aplikace používá Firebase Authentication a Firebase Realtime Database.

Role:
- `player`
- `club_admin`
- `system_admin`

Bezpečnost:
- SYSTEM ADMIN se nesmí dlouhodobě ukládat do `localStorage`.
- Admin refresh token se drží pouze v `sessionStorage`.
- Staré admin tokeny z `localStorage` se při načtení odstraňují.
- Běžní hráči mohou mít dlouhodobější přihlášení.
- Role se nesmí přenášet přes URL.
- Běžný hráč nesmí zapisovat globální `/appData`.
- Cizí aktivní zápas nesmí být editovatelný.

## Hráčské profily

Registrovaný účet může být propojený s hráčským profilem. Podporováno je převzetí existujícího profilu, vytvoření nového profilu a zpětné propojení historických výsledků. Sekce Hráči odděluje Profil a Historii zápasů.

## Herní režimy

- 8-ball
- 9-ball
- 10-ball
- 14.1 nekonečná
- Ghost 8/9/10-ball
- Solo 14.1
- Vítěz na stole pro 3 hráče
- turnajové zápasy

Klasické zápasy podporují Race to, střídavý/vítězův rozstřel, tempo, shot clock, extension, 3-foul rule, faul, faul z breaku, dry break, soft break, safe, miss, runout, break & run, BIH, undo a evidenci konkrétních koulí u 9/10-ball.

## Statistiky a PDF

Po zápase se zobrazuje detailní statistický přehled a PDF REPORT.

Sekce Statistiky obsahuje mimo jiné:
- ELO
- zápasy, výhry/prohry, racky
- break statistiky
- dry/soft break
- faul z breaku
- koule z breaku a průměr
- esa
- break & run
- dohrávky
- jistoty
- úspěšnost jistot
- úspěšnost úniků
- RESAFE
- statistiky 14.1
- vzájemné zápasy
- turnajové statistiky

Má vlastní PDF REPORT.

Sekce Moje statistiky má filtry CELKEM / 8-ball / 9-ball / 10-ball / 14.1 a také vlastní PDF REPORT.

PDF používá `html2canvas` a `jsPDF`.

Exportní tlačítka EXPORT PDF v historii, detailu zápasu, Statistikách a Moje statistiky otevírají společný `openPdfExportDialog`. PDF se pro otevřené okno připraví jednou. Sdílet PDF předává připravený File do systémového sdílení přímo z kliknutí uživatele; Uložit do zařízení samostatně stahuje stejný blob přes `savePdfBlob`. Sdílení nesmí nahradit uložení. Okno zůstává otevřené po obou akcích i jejich zrušení/chybě; zavírá se tlačítkem Zavřít nebo Escape. Pokud není dostupné sdílení souborů, dialog je vysvětlí a ponechá uložení. Textové sdílení jiných částí aplikace je samostatné. Ověření skutečných systémových dialogů, mobilních prohlížečů a nativních aplikací eviduje PROJECT_STATUS.md.

## Ghost

Ghost používá:
- 2 body = čisté dohrání
- 1 bod = dohrání s BIH
- 0 bodů = nedohráno

Sleduje se také dry break, soft break, faul z breaku, eso, koule, na které hráč skončil, a historie racků. Ghost statistiky se nemají míchat s běžnými zápasy.

## 14.1

14.1 má vlastní logiku: skóre, high run, innings, průměr na náběh, MISS, SAFE, fauly, trestné body a 3× foul penalty. Solo 14.1 má vlastní oddělené statistiky.

## Turnaje a série

Podporované formáty zahrnují skupiny, DKO, SKO, švýcarský systém a kombinované formáty.

Turnaje mohou mít:
- skupinovou část
- play-off
- různé disciplíny
- Race to
- pořadí
- dělená místa
- historické výsledky

Je možné zpětně přidávat již odehrané turnaje včetně detailních výsledků.

Od v4.51.81 RC má kompletní historické zadání do série také strukturovanou ruční přípravu skupin/SKO/DKO a skupin → pavouk. Ukládá se jako samostatný zabezpečený turnaj s historicalStructure a vazbou na sérii; rozpracovaný stav nepřináší body. Používá stejné generátory, postup a bodování jako běžné turnaje, pouze bez počítadla/statistických/LIVE zápisů. Podrobnosti, původní pravidla Lounské série, potvrzování dopadu oprav a testy popisuje docs/historical-structured-entry.md. Pro více samostatných skupin bez pavouka je po potvrzení Dominikem povinné ruční konečné pořadí. Původní historické ruční zápasy a pořadí zůstávají alternativou; stará data se nepřepisují.

Nabídka kritérií historické přípravy přebírá options z běžného formuláře `tournamentGroupAdvanceTieRule`: Body / skóre ve skupině (`points`, výchozí), Vzájemný zápas (`head_to_head`). Obě používají původní `groupStandings`; penalty jsou volitelně zapnuté, výchozí vypnuté. Sjednocení popisků nemění uložená pravidla ani dokončené výsledky. Stav nasazení eviduje PROJECT_STATUS.md.

V sekci Série turnajů má být tlačítko `NOVÁ SÉRIE`, ne `Nový turnaj`.

Lounská tour může používat umístění, celkové skóre, vzájemný zápas a dělená místa.

## Liga Sever

Liga Sever má samostatnou logiku pro týmy, zápasy doma/venku, disciplíny, rozhodující dvojice, kapitány, potvrzení výsledků a tabulku ligy.

## Turnajový kalendář

Registrovaný uživatel může zveřejnit flyer, datum, místo, informace, výhry, kontakt a kapacitu. U podporovaných turnajů může být registrace přímo přes Poolčítadlo. Počítá se i s mezinárodními turnaji.

## Pořadatelé turnajů

Turnaj může mít více manager UID. Hlavní pořadatel může přidat dalšího uživatele, který může turnaj spravovat.

## Výzvy k zápasu

Hráči s propojenými účty si mohou posílat výzvy obsahující soupeře, disciplínu, Race to, datum, čas, místo, poznámku a veřejnou/soukromou viditelnost.

Soupeř může:
- přijmout
- odmítnout
- navrhnout jiný termín

Přijatý zápas lze spustit přímo z výzvy.

Na homepage se zobrazuje počet nových výzev, domluvené zápasy a nejbližší zápas.

Plánovaný další krok je centrální centrum upozornění přes zvoneček vpravo nahoře pro nové výzvy, protinávrhy termínu, přijetí/odmítnutí a později další typy notifikací.

## Livescore

Aktivní zápas se publikuje jako veřejný LIVE stav. Veřejný payload nesmí obsahovat celý interní stav zápasu. Může obsahovat jména, skóre, disciplínu, Race to, stav hry a průběh skóre. Cizí rozehraný zápas je pouze ke sledování.

## Stream

Existuje overlay, livescore, obrazovka pauzy a QR kód odkazující na Poolčítadlo. Pauza funguje přímo v aplikaci.

## Administrace

Administrace obsahuje například:
- žádosti o převzetí profilu
- registrované účty
- správu hráčů
- správu zápasů
- správu turnajů
- migrace databáze
- bug reporty
- slučování duplicitních profilů
- opravy profilů
- zálohy dat

JSON export/import byl přesunut ze Statistik do `Administrace → Záloha dat`. Mazání zápasů má být pouze pro administrátora.

## Homepage

Moderní dashboard obsahuje branding Poolčítadla, metriky, rychlé vstupy, žebříček, poslední zápasy, výzvy a domluvené zápasy. Admin sekce se zobrazuje pouze oprávněnému adminovi.

## Pravidla pro další vývoj

Při každé změně:
1. najít existující implementaci,
2. pochopit její datový tok,
3. nevytvářet druhou paralelní implementaci stejné věci,
4. využívat existující helpery,
5. držet konzistentní názvy,
6. testovat desktop i mobil,
7. počítat se staršími uloženými daty,
8. zachovat zpětnou kompatibilitu,
9. ověřit, kdo smí data číst a zapisovat,
10. u Firebase funkcí ověřit vlastnictví objektu a oprávnění.

## Důležitý princip

Poolčítadlo už není jen počítadlo skóre. Je to platforma pro zápasy, hráče, statistiky, turnaje, ligy, výzvy, livescore, stream a komunitní kalendář.

Každá nová funkce má zapadnout do existujícího systému a nemá zbytečně duplikovat už existující řešení.

## Pro ChatGPT asistenty

Při práci na tomto repozitáři:
- nejdřív si přečti tento soubor,
- potom si načti relevantní část `index.html`,
- nedělej zásadní refaktor bez výslovného zadání,
- netvrď, že je něco implementované, dokud změna není skutečně commitnutá,
- při větších úpravách preferuj branch + Pull Request,
- u bezpečnostních změn buď konzervativní.
