# Historické turnaje do sérií – v4.51.81 RC (Dominik)

## Použití

V detailu série v části Přidat historický turnaj ponech Kompletní turnaj a zvol **PŘIPRAVIT STRUKTURU A RUČNÍ NASAZENÍ**. Vyplň datum, formát, disciplínu, cílové skóre, hráče a případné hosty. Podporované generátory jsou původní skupiny, SKO, DKO, skupiny → SKO/DKO. Skupiny se plní po souvislých blocích podle stávajícího vyváženého rozdělení; pozice pavouka tvoří sousední dvojice. Každou pozici vyber ručně; duplicity a nevyplněné pozice se odmítnou. Náhodný los se v tomto režimu nepoužívá ani při obnově DKO.

Příprava nasazení se ukládá lokálně. Po potvrzení struktury je rozpracovaný turnaj uložený jako samostatný zabezpečený turnaj; v sérii jej otevřeš přes HISTORICKÉ VÝSLEDKY. Jednotlivá skóre potvrzuj tlačítkem ULOŽIT VÝSLEDEK. Prázdná pole nejsou uložený výsledek; nula je platná část neremízového skóre. Volné losy řeší původní generátor, nevytvářejí falešné zápasy. Samostatný typ kontumace v současném jádru není: zadává se skutečné kontumační konečné skóre stejnou cestou jako dosud, s potvrzením případné odchylky od Race to. Žádná nová sportovní pravidla kontumací nebyla odhadnuta.

Po dohrání skupin návrh play-off pochází z `groupPlayoffSeeds`. Uprav jej ručně a potvrď; pole musí obsahovat všechny skutečné postupující právě jednou. Zvolená posloupnost se ukládá, další přepočet ji nemění, pokud se nezmění množina postupujících. Pro osm postupujících je dostupné původní napojení QF do SF. Při změně postupujícího se navrhne náhrada na jeho pozici a je nutné nasazení znovu potvrdit. Nevyřešené penalty blokují postup i konečné body.

**Více skupin bez pavouka:** původní kód nemá společné absolutní pořadí. Dominik výslovně potvrdil, že se má vyžadovat ruční konečné pořadí. Do jeho potvrzení turnaj zůstává rozpracovaný. Jedna skupina a pavouky používají existující automatický výpočet. Ruční konečné pořadí zůstává alternativou i po běžném dokončení; stejné číslo znamená dělené místo.

Původní ruční přidávání jednotlivých historických zápasů, textový import a pouhé konečné pořadí zůstaly zachované. Existující `series.historicalTournaments` se nemigrují ani nepřepisují. Rozpracovaná modularizace PR #6 ani Federal Cup nejsou zdrojem této funkce.

## Umístění a body Lounské série – skutečný stávající výpočet

- `baseTournamentPlacementRecords` určuje vítěze, finalistu, případný zápas o třetí místo a vyřazené fáze. Jedna čistá skupina používá `roundRobinOverallStandings`. Více čistých skupin vrací prázdné absolutní pořadí, proto výše potvrzená ruční varianta.
- `seriesPlacementTieBreakMode` respektuje explicitní nastavení série; pokud chybí, jméno obsahující normalizované „loun“ zapne `score_h2h_group`.
- `seriesTournamentPlacementRecords` / `seriesRefineTournamentPlacements` třídí pouze v rámci stejné výsledkové fáze. V play-off: **celkový rozdíl racků ze všech play-off zápasů → výhry ve skupině → výhry ve skupinových vzájemných zápasech**. U nepostupujících: **umístění ve skupině → výhry ve skupině → skupinové vzájemné zápasy**. Nerozlišení hráči mají stejné kanonické místo; následující pozice přeskočí počet sdílejících hráčů (např. 5., 5., 7.). Jméno slouží pouze ke stabilnímu zobrazení, sportovní shodu nerozbíjí.
- `seriesPointsForPlacement` používá toto kanonické místo. Vlastní tabulka bere nejdřív přesnou individuální pozici, poté pokrývající rozsah. Pásmové bodování používá stávající 1–4 a pásma 5–8, 9–16, 17–32, 33–64. Hodnoty zůstávají nastavením série. Ruční konečné pořadí je výslovný override, stejně jako u starého historického zadání.
- `seriesStandings` znovu odvozuje body pouze z dokončených turnajů. Případné „nejlepších X“ vybírá podle bodů a umístění; celkovou tabulku třídí podle bodů, počtu prvních, druhých a třetích míst a nakonec jména. Nová paralelní bodovací logika nevznikla.

Popisky některých starších formulářů zjednodušují kritéria jinak než jejich implementace. Tato revize jejich algoritmus nemění; výše je popsán skutečný kód.

## Opravy a bezpečnost uložení

Nový turnaj obsahuje `historicalStructure`: výchozí ručně nasazený strom, uložené výsledky, ruční pořadí postupujících, případný override konečného pořadí, revizi a audit. Oprava přehraje výsledky přes původní `processTournamentResult` nad kopií turnaje bez jeho informačních oken. Neotevírá počítadlo, hodiny ani LIVE a nevytváří záznamy v `/matches` či vymyšlené detailní statistiky.

Výsledky stejných dvojic zůstanou zachované. U nově odvozené dvojice s jinými účastníky se před uložením vypíšou konkrétní zápasy a původní skóre, které budou zneplatněné; pořadatel může změnu zrušit. Výsledky dalších kol, jejichž účastníci ještě nejsou určití, zůstávají uložené mimo aktuální strukturu a nepřinášejí body. Při znovuvytvoření stejné dvojice se použijí, při jiné dvojici se znovu vyžádá potvrzení jejich zneplatnění. Audit uchovává UID pořadatele, čas, původní/nové skóre a zneplatněné výsledky. Změna ručního konečného pořadí vyžaduje potvrzení jeho zrušení; pro více skupin je potom nutné pořadí znovu zadat.

Do série se přidává stabilní ID turnaje přes jeho vazbu na sérii, nikoli další kopie výsledků do historického seznamu. Opakovaný výpočet body neakumuluje. Rozpracovaný/nevyřešený stav je aktivní a body z něj zmizí; po dokončení se odvodí znovu. Potvrzení tvorby používá ID uložené v přípravě, takže opakování po ztraceném potvrzení zápisu znovu otevře stejný turnaj.

Ukládání struktury a výsledků se týká pouze `/tournaments/{id}`, s původním ověřením tokenu, oprávnění správce série i turnaje, načtením aktuálního serverového stavu, jeho porovnáním a podmíněným PUT přes ETag/If-Match. Při konfliktu/403 se lokální výsledek neoznačí jako uložený; následuje ověřovací čtení. Bez ETag se nic nepřepíše. Tlačítko OBNOVIT ULOŽENÝ STAV načte daný turnaj znovu. Pořadatel série nemusí kvůli každému výsledku přepisovat její konfiguraci. Samotné tvrzení turnaje, že patří do cizí série, body neopravňuje: automatická vazba vyžaduje tvůrce uvedeného mezi pořadateli série, jinak musí existovat explicitní vazba v původním seznamu série. Globální administrátor mimo seznam pořadatelů pro vytvoření této vazby použije dosavadní `addTournamentToSeries` a jeho standardní synchronizaci konfigurace; její obecné limity souběhu tato revize neopravuje. Mechanismus podmíněných zápisů odpovídá [Firebase conditional requests](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests); skutečné nasazené Rules a Auth nebyly testovány.

Hosté zachovávají identitu turnaje (`preserveGuest`), nevznikají testovací účty. Při standardním propojení účastníka s profilem se aktualizuje i zdroj ručního nasazení/výsledků, takže jej příští přepočet nevrátí zpět. Obecná obnova starých scoreboard výsledků i údržba „prázdných turnajů“ tento nový typ nepřepisují/nesmažou.

## Automatické ověření

`npm run test:historical` spouští headless Chrome/Playwright proti aktuálnímu index.html. Veškerá síť je zachycená; fiktivní hráči a paměťový mock Realtime Database napodobují i vynechávání prázdných/null hodnot a ETag. Testy nevyžadují Firebase účet. Není vytvořen žádný ruční izolovaný náhled.

Prošlo: skutečný formulář, prázdné/duplicitní nasazení, obnova přípravy i uložených výsledků po skutečném reloadu; čisté skupiny, SKO s volnými losy, DKO, skupiny → SKO včetně bronzu a skupiny → DKO; ruční změna návrhu a její zachování, změna postupujícího a nové potvrzení; opravy se stejným i jiným vítězem, zrušení potvrzení dopadu bez zápisu, zachování nedotčených výsledků, oprava po dokončení, odebrání/nezdvojení bodů při nedokončení/opakování; penalty; více skupin s ručním děleným pořadím; shoda umístění s původním turnajovým výpočtem a bodů se starým historickým pořadím; nezměněné staré/nesouvisející turnaje; správce a neoprávněný uživatel; 403, zastaralý snapshot, ETag 412, opakování tvorby po ztraceném potvrzení zápisu; identita hosta a propojení profilu. Žádné scoreboard/statistické/LIVE zápisy a 0 JavaScriptových chyb.

Současná Node sada: 68/70; stejné dvě dřívější chyby preview-match-reload-recovery. Izolovaný Federal Cup browser test prošel, včetně B&R případu, Teamu a ostatních startů režimů. Smoke 12/12. Nejde o ověření starého `/test/` snapshotu.

## Neověřeno / hranice

Skutečné produkční Firebase Auth/Rules, reálný vícezařízení provoz, fyzické mobilní prohlížeče a nativní buildy, velká startovní pole/zátěž a všechny možné sportovní varianty DKO nebyly ověřeny. Nové zadávání používá struktury původního generátoru a jejich pořadí, nevytváří libovolný cizí formát pavouka; pro jiné historické formáty zůstává ruční zadání jednotlivých zápasů a konečného pořadí. Globální synchronizace ostatních konfigurací včetně Federal Cupu se nemění. Zpětný návrat staršího kódu nová rozpracovaná data nesmaže, ale neumí pokračovat v tomto novém editoru; viz místní rollback záznam vydání.
