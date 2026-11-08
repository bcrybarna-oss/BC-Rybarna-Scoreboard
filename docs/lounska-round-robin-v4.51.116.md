# Vzájemný zápas v turnajích Lounské série

Dominik, 8. 11. 2026. Výchozí main `6c459862a0201879920bdc0b93b3f49be5d0e7da` obsahuje v4.51.115 RC. Tato změna je kandidát v4.51.116 RC.

## Rozsah pravidla

Čistý turnaj Každý s každým v propojené Lounské sérii řadí podle počtu výher. Pro každou skupinu hráčů se stejným počtem výher se jednou spočítají výhry v minitabulce jejich dokončených vzájemných zápasů. Při stejné hodnotě v minitabulce rozhoduje celkový rozdíl racků a počet vyhraných racků. Dosavadní výslovně zapnuté penalty mohou rozhodnout úplnou sportovní shodu. Bez nich je posledním kritériem původní nasazení. Nedokončené zápasy bez doloženého vítěze nepřidávají výhru.

Identifikace Lounské série používá stávající normalizaci názvu. Podmínkou je její explicitní seznam turnajů nebo historická vazba potvrzená identitou pořadatele. Samotný název turnaje nebo jeho dříve zkopírované nastavení play-off vazbu nezakládá.

Průběžnou tabulku i konečné pořadí odvozuje `groupStandings`. Umístění přebírá `roundRobinOverallStandings`. Pro tento případ se přeskočí až navazující přerovnání podle fází play-off, takže série přidělí body za stejná místa. Hodnoty bodovací tabulky a kritéria celkového pořadí série zůstávají v platnosti.

Konečné pořadí se publikuje až při dosavadním stavu dokončení. Historická ruční umístění mají přednost. Starší turnaj s více samostatnými skupinami dál neposkytuje automatické absolutní pořadí. Ručně potvrzené výsledky ani uložené zápasy se nepřepisují.

## Srovnání v izolovaném Chrome

| Vstup | Výsledek |
| --- | --- |
| A a B mají dvě výhry, B vyhrál jejich zápas. C a D mají jednu výhru, C vyhrál jejich zápas. | Main zobrazil A, B, D, C podle racků. Kandidát zobrazil B, A, C, D v průběžné i konečné tabulce. Bodování je B 100, A 80, C 65, D 55. |
| A, B a C mají po dvou výhrách. V minitabulce A vyhrál dvakrát, B jednou a C ani jednou. | V pořadí F, E, A, B, C, D drží trojice pořadí A, B, C i proti opačnému rozdílu racků. |
| A porazí B, B porazí C, C porazí A. | Při jedné výhře v minitabulce pro každého rozhodnou racky a pořadí je A, B, C. |
| Nedokončený turnaj a neodehraný vzájemný zápas. | Zobrazuje se průběžné pořadí. Konečná tabulka ani body se nevytvoří. |
| Jiná série, turnaj bez vazby a oba hybridní formáty. | Testovaný vstup zachová skupinové pořadí A, B, D, C. |
| Historický strukturovaný turnaj a potvrzená ruční umístění. | Automatický výpočet dává stejné výsledky jako běžný turnaj. Potvrzené ruční pořadí zůstává zdrojem umístění i bodů. |

`tests/lounska-round-robin-browser.cjs` načítá produkční HTML a vykresluje turnajovou tabulku, pořadí série a přehled výsledků na 1440, 390 a 320 px. Pro reprodukci výchozího stavu použij `LOUNSKA_BASELINE_REF=6c45986`. Prošly také izolované regrese historických struktur, založení běžných turnajů, mobilního ovládání a Federal Cupu.

Release gate prošel proti aktuálnímu main. Lokální produkční Node sada měla 383 PASS, 0 FAIL a 0 SKIP. Experimentální sada měla samostatně 28 PASS a 2 FAIL. Experiment při čekání na Auth neodpojí editovatelný stav a považuje zbytkové UID za oprávněnou identitu. Jeho kód a testy mají proti main stejný obsah.

Návrat se provede reverzí této změny v novém vydání. Nevzniká migrace ani požadavek na obnovu produkčních dat. Živé Auth, Firebase Rules a fyzická zařízení nebyly součástí testů.
