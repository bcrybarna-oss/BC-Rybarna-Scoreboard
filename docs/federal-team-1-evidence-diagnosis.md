# Skutečná diagnostika Team #1: dvě odlišné příčiny neúplnosti

## Upřesnění po zadání pravidla MISS (23. 10. 2026)

Níže je zachován historický výsledek nad nezměněným exportem. Dřívější závěr, že odvozená koule 6 před MISS musí mít neznámé pokusy, byl překonán výslovným pravidlem zadavatele: bezpečný odvod před MISS znamená jednu kouli, jeden pokus a jeden úspěšný strk. Původní export opravdu obsahuje unknown hodnoty, ale nové zadávání je již nemá vytvářet v tomto přesně vymezeném průchodu. RESAFE se známou nulou má explicitní pottedCount: 0. Podrobnosti, testy a oddělený návrh nápravy uloženého zápasu: [aktuální oprava](federal-zero-and-miss-v4.51.92.md). Žádná migrace ani změna původního exportu neproběhla.


Zadavatel: Dominik, 23. 10. 2026. Pouze čtení místního exportu a výpočty v paměti. Žádný zásah do exportu ani Firebase, žádná změna aplikace, merge či nasazení.

## Identita a výsledek

- matchId `5a97e289-a5f5-4da4-bd85-8bc00daf1cc9`, Federal Cup2026, fixture1, Team, Slovensko1:5Česko, statuscomplete.
- startedAt `2026-10-23T12:09:14.717Z`, endedAt `2026-10-23T12:14:36.764Z` (14:09–14:14 CEST); nový zápas po nasazení91.
- SHA256 zdrojového exportu před/po: `7ad5bf902cdd24d585a4bd092f564bcc7a61eb8d692d84008d58013926716c4a`, nezměněn.
- Aktuální produkční výpočetní kód91 a PR #30 vracejí pro tento skutečný zápas identický celý federalCalculateMatch výsledek.

| Česká metrika | coverage | reasons | numerator/denominator/count | components |
| --- | --- | --- | --- | --- |
| pottingSuccess | partial | unknown_attempts, unknown_intent |36 /37 /null |{} |
| pottedBalls | partial | unknown_pots |38 /null /38 |explicit37, derived1 |

SK: pottingSuccess3/3,100 %, complete; pottedBalls3,complete, components explicit3/derived0. Obě strany referenceIssues[], unattributed[], missingReferences[]. Nebyla zjištěna chyba přiřazení Team aktérů/racků ani dvojí součet rackové kopie.

## Rack1: koule6 před MISS na7 – oprávněná neúplnost útoku

Český záznam `0f0e7fe5-6b04-4e94-93fe-e3b2cfc1e4e8`: kind inferred_pots, balls[6], source inning_end, entry chybí, intent unknown, potsEvidence derived, derivationSafetrue. V kanonickém exportu chybí strokeCount/pottingAttempts/successfulPottingStrokes; zachovaný undo snapshot potvrzuje jejich původní hodnotu null.

Zachovaná posloupnost událostí: SK rozstřel[1] → úspěšná jistota → český úspěšný JUMP únik s koulí2 → explicitně POSTUPNĚ3,4,5 → Doplněné koule v náběhu6 → MISS na7 → SK postupně7,8,9.

MISS na7 spustil confirmRotationFailure → applyRotationInference(7). V bezpečně sledovaném českém náběhu zbývala před7 koule6, proto ji aplikace odvodila a přidala do počtu potopených koulí. Uživatel však samostatně nepotvrdil potápěcí strk na6 ani jeho počet/intent. Aplikace zná odvozenou kouli, nikoli doložené chybějící pokusy; nesmí je doplnit pravidlem rychlého dokončení. Následující MISS je řádně1 neúspěšný pokus.

Proto je 36/37* pravdivý doložený mezisoučet, nikoli oficiální úplná úspěšnost. Tato koule přidává derived1 do počtu38, ale sama nečiní počet koulí neúplným. Uživatelské zlepšení může před odvozením nabídnout explicitní doplnění skutečných strků; pouhé nastavení complete nebo automatické připsání jednoho pokusu by bylo odhadem.

## Rack3: český RESAFE – ztracená doložená nula

Český záznam `45910279-8482-4ede-b25b-af1e6594840f`: kind escape, success true, foul false, intent escape, potsEvidence explicit, pottingAttempts0, successfulPottingStrokes0, safetyId `349eac37-5ae6-4d37-83db-2a6a85fae951` existuje a rack/aktér souhlasí. source/entry/strokeCount a pottedCount chybí. **V kanonickém exportu chybí i balls.**

Událost je RESAFE: po slovenském rozstřelu[2] a jistotě Česko úspěšně uniklo a zahrálo novou jistotu. finishSafetyEscapeSuccess('resafe') používá selectedBallsnull → balls[] → resolveDetailedEscape(true,false,[]). Zde aplikace výslovně znala nulové potopení, žádný výběr potopené koule se pro RESAFE neotevíral.

Silný důkaz přímo v tomto exportu: undoSnapshot události index28 „Neúspěšný únik z jistoty • faul • Slovensko“ obsahuje **tentýž český recordId s balls[]**, success true a foul false. Další snapshot potvrzuje totéž. Nejde o odhad nuly z pouhé absence pole.

secureMatchRequest serializuje celé tělo JSON.stringify; loadSecureMatches čte vrácené objekty přímo a exportBtn opět přímo JSON.stringify(data). Strukturovaný záznam tedy ztratil prázdné pole, zatímco serializovaný undo řetězec je zachoval. To odpovídá reprezentaci prázdné kolekce při cloudovém průchodu RTDB; konkrétní síťový request tohoto historického uložení nebyl zachycen. Pro určení chyby aplikace stačí doložený rozdíl mezi původním záznamem a uloženým kanonickým stavem.

federalStatsSide počítá count jako pottedCount, jinak délku existujícího pole balls, jinak null. U tohoto explicitního escape tedy dostane null a přidá unknown_pots. **To je chyba uchování/interpretace evidence, nikoli skutečně neznámé potopení při tomto RESAFE.** Reader je konzervativní vůči chybějícímu poli, ale aplikace měla dost informací uložit výslovnou nulu.

Slovenský únik v racku3 byl neúspěšný s faulem. Potová větev jej z důvodu foultrue vynechává, proto stejná absence prázdného balls nevytvořila slovenskou hvězdičku.

## Kontrolní výpočet bez změny dat

V izolované hluboké paměťové kopii byl pouze českému RESAFE vrácen doložený balls[]. Zdrojový export se nezapisoval. Výsledek:
- pottedBalls38, coveragecomplete, reasons[], components explicit37/derived1;
- pottingSuccess stále36/37, coveragepartial, reasons unknown_attempts/unknown_intent;
- referenceIssues nadále[].

To odděluje příčiny obou hvězdiček. Rozdíl38 koulí proti36 doloženým úspěšným útočným strkům zde tvoří únik s potopenou koulí2 v racku1 (explicitní koule bez útočného pokusu) a odvozená koule6 (bez známých pokusů).

## Srovnání s PR #30

Všech6 rozstřelů má ballNumbersKnowntrue a konkrétní čísla. **Žádný rack_completion_unknown**, jediný inferred_pots je výše popsaná6. Rychlé ČISTÉ HRY v racku2 a6 mají korektní source rack_completion, entry sequential_batch a6/5 doložených pokusů. Samotná ČISTÁ HRA není příčinou a kontrolní Singles/Team4:5 zůstává relevantní.

PR #30 chrání jinou prokázanou cestu – rychlé dokončení neznámého stolu – a tento skutečný zápas dosud neřeší. Pro cílenou opravu je potřeba zejména uchovat explicitní počet potopených koulí0 u bezpotových escape/RESAFE přes cloudovou serializaci a přidat regresi, která prázdné kolekce při roundtripu vynechá (dosavadní array→object test sám nestačí). Pro staré chybějící pole nelze plošně předpokládat nulu; vyžaduje doloženou sémantiku/zdroj. Legitimní unknown pokusy koule6 musí zůstat označené. V tomto diagnostickém pokračování nebyl aplikační kód ani výpočetní pravidla změněna.
