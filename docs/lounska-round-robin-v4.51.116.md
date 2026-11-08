# Vzájemný zápas v turnajích Lounské série

Dominik, 8. 11. 2026. Výchozí main `6c459862a0201879920bdc0b93b3f49be5d0e7da` obsahuje v4.51.115 RC. Tato změna je kandidát v4.51.116 RC.

## Rozsah pravidla

Čistý turnaj Každý s každým v propojené Lounské sérii řadí podle počtu výher. Pro každou skupinu hráčů se stejným počtem výher se jednou spočítají výhry v minitabulce jejich dokončených vzájemných zápasů. Při stejné hodnotě v minitabulce rozhoduje celkový rozdíl racků a počet vyhraných racků. Dosavadní výslovně zapnuté penalty mohou rozhodnout úplnou sportovní shodu. Bez nich je posledním kritériem původní nasazení. Nedokončené zápasy bez doloženého vítěze nepřidávají výhru.

Identifikace Lounské série používá stávající normalizaci názvu. Podmínkou je její explicitní seznam turnajů nebo historická vazba potvrzená identitou pořadatele. Samotný název turnaje nebo jeho dříve zkopírované nastavení play-off vazbu nezakládá.

První kandidát `36e006c` hledal vazbu globálně. Při přiřazení stejného turnaje do více sérií tím změnil společnou tabulku, obecné statistiky i body jiné série. Nasazení bylo pozastaveno.

`seriesTournamentPlacementRecords(s,t)` teď předává konkrétní sérii přes výpočet umístění a `roundRobinOverallStandings` až do `groupStandings`. Pouze propojená Lounská série použije minitabulku a přeskočí přerovnání podle fází play-off. Jiná série si zachová vlastní pravidla. Hodnoty bodovací tabulky a kritéria celkového pořadí série zůstávají v platnosti.

Společný detail turnaje, jeho vítěz ve Výsledcích i historie hráče používají u formátu Každý s každým pořadí podle nastavení samotného turnaje. V detailu každé série je rozbalitelné pořadí konkrétního turnaje s názvem série. Při dokončení ukazuje místa a body a při rozehrání průběžnou skupinovou tabulku. Lounská vysvětlivka je u pořadí podle Lounské série, mimo potvrzený ruční override. Při otevření společných výsledků se dialog série zavře.

Konečné pořadí se publikuje až při dosavadním stavu dokončení. Kontrola a zadávání penalt při dokončování používají pravidla turnaje. Připojení k sérii samo o sobě nezakládá nové rozhodování o penaltách. Historická ruční umístění mají přednost. Starší turnaj s více samostatnými skupinami dál neposkytuje automatické absolutní pořadí. Výpočet nepřepisuje uložené zápasy, potvrzené výsledky ani turnajové nastavení.

## Srovnání v izolovaném Chrome

| Vstup | Výsledek |
| --- | --- |
| A a B mají dvě výhry, B vyhrál jejich zápas. C a D mají jednu výhru, C vyhrál jejich zápas. | Společná a standardní tabulka ukazují A, B, D, C podle racků. Lounská série ukazuje B, A, C, D a přiděluje v tomto pořadí 100, 80, 65 a 55 bodů. |
| A, B a C mají po dvou výhrách. V minitabulce A vyhrál dvakrát, B jednou a C ani jednou. | V pořadí F, E, A, B, C, D drží trojice pořadí A, B, C i proti opačnému rozdílu racků. |
| A porazí B, B porazí C, C porazí A. | Při jedné výhře v minitabulce pro každého rozhodnou racky a pořadí je A, B, C. |
| Nedokončený turnaj a neodehraný vzájemný zápas. | Zobrazuje se průběžné pořadí. Konečná tabulka ani body se nevytvoří. |
| Jiná série, turnaj bez vazby a oba hybridní formáty. | Testovaný vstup zachová skupinové pořadí A, B, D, C. |
| Historický strukturovaný turnaj a potvrzená ruční umístění. | Automatický výpočet dává stejné výsledky jako běžný turnaj. Potvrzené ruční pořadí zůstává zdrojem umístění i bodů. |

`tests/lounska-round-robin-browser.cjs` používá produkční HTML na 1440, 390 a 320 px. Přidává tentýž turnaj v obou pořadích přes rozhraní, odebírá vazbu, přepíná detaily a opakuje výpočet v opačném pořadí. Porovnává výsledky obou sérií, celý model před a po výpočtu, společný detail, obecné statistiky a vykreslenou historii hráčů. Historický turnaj a ruční umístění jsou samostatné případy.

| Verze | Standardní série po přidání do Lounské | Lounská série při současné vazbě |
| --- | --- | --- |
| `6c45986` | A 100, B 80, D 65, C 55 | A 100, B 80, C 65, D 55 |
| `36e006c` | B 100, A 80, C 65, D 55 | B 100, A 80, C 65, D 55 |
| Opravený kandidát | A 100, B 80, D 65, C 55 | B 100, A 80, C 65, D 55 |

Historické srovnání spustíš nastavením `LOUNSKA_BASELINE_REF` na `6c45986` nebo `36e006c`. Bez proměnné se testuje pracovní kandidát. Prošly také izolované regrese historických struktur, založení běžných turnajů, mobilního ovládání a Federal Cupu.

Release gate prošel proti aktuálnímu main. Lokální produkční Node sada měla 383 PASS, 0 FAIL a 0 SKIP. Experimentální sada měla samostatně 28 PASS a 2 FAIL. Experiment při čekání na Auth neodpojí editovatelný stav a považuje zbytkové UID za oprávněnou identitu. Jeho kód a testy mají proti main stejný obsah.

Návrat se provede reverzí této změny v novém vydání. Nevzniká migrace ani požadavek na obnovu produkčních dat. Živé Auth, Firebase Rules a fyzická zařízení nebyly součástí testů.
