# Federal Cup #9 – diagnóza statistik po doplnění vazby

Zadavatel: Dominik. Datum: 24. 10. 2026. Kandidát v4.51.96 RC, PR #34. **Nesloučeno, nenasazeno.** Produkce zůstává v4.51.95 RC.

> Doplnění po úplné analýze událostí: všech osm racků lze doložit přeživší historií a undo snapshoty. Aktuální oprava vrací vlastní break výhry SK2/4 a CZ1/4, prohry2/3. Níže uvedená původní neznámá hodnota je historie první diagnózy; nová [rekonstrukce a tabulka důkazů](federal-fixture-9-rack-reconstruction.md) ji zpřesňuje. Artefakty již obsahují aktualizovaný výsledek.

## Skutečné záznamy a integrita

Zápas `3d4c35e6-e336-49d5-a9b3-9955cec59c3d`, Doubles #9, Mark Szabo + Jakub Koniar proti Tom Kurz + Jan Meisner, 5:3.
Porovnány původní úplný export `(1)`, samostatná stažená BEFORE záloha a čerstvý úplný export `(2)` dodané zadavatelem. Původní zápas je shodný s BEFORE zálohou. Aktuální záznam se liší **výhradně federalCupLink**; vazba přesně odpovídá schválenému návrhu v `federal-fixture-9-link-proposal.json`. Strky, skóre, hráči, statistiky a updatedAt jsou shodné. Cílené doplnění vazby provedl uživatel; tato práce neprovedla žádný produkční zápis.

SHA256 souborů:
- Původní úplný export: `0aa18c9b610709025150ef55fd6fd177f1972612d72703635cbdd74e8b52f7eb`
- Nový úplný export: `4701a20ed0583b503a12b29a39ba522a6a4239630c22ebc4bbdf172d97088c47`
- Samostatná BEFORE záloha: `5a3764e59242c4136bbad5739178401f9932bedff5aa13a03c5fce7b141ba2aa`
- Kanonický původní zápas: `7195a1c5562cfd1aac3e913170a412e6607aa6bd4c229a17a599d79b15876f6e`
- Kanonický aktuální zápas: `f9a9e3ca955488d9b87afe932564a0563975c2cb9660067435c58c28fbc36f78`

## Přesná příčina

Běžné počítadlo ukládalo detailedPlay.records, ale recordDetailedShot přidával federalShotEvidence / evidenceVersion:2 jen při existující federalCupLink. Zde všech 46 záznamů vzniklo před doplněním vazby, bez tohoto markeru. federalStatsSide následně každý přeskočil přes `evidenceVersion !== 2`, ale výsledkem byly počáteční nulové součty a partial 0/0. Proto nebyla příčinou změna nominace nebo ztráta strků.

Číselné side a sideId všech záznamů odpovídají původním profilovým ID a správné straně; FC participant ID vlastníka reportu není důvodem nul. Actor:null je u těchto Doubles záznamů očekávaný a neposkytuje osobní přiřazení. Záznamy: 8 break, 8 safety, 6 escape, 19 pot, 5 miss. Bez inferred_pots, foul nebo push_out záznamu v tomto konkrétním ledgeru.

## Oprava bez změny dat

Čistý kompatibilní čtecí adaptér ve společném výpočtu čte původní explicitní balls/pottedCount, entry a strokeCount. sequential_batch prokazuje jeden úspěšný strk na kouli; explicitní jeden strk/multipot zůstává jeden pokus, MISS jeden neúspěšný pokus jen s doloženým strokeCount. Samotný počet koulí nedokazuje počet strků. Neznámé údaje, explicitní null, budoucí schema, konflikty a duplicitní reference zůstávají neúplné. Faul není automaticky miss, push out není potápěcí pokus ani započítaná potopená koule.

Adaptér nemění uložené záznamy, nedoplňuje marker, federalEvidence ani fromStart. Interní legacy_record/legacy_coverage a partial jsou zachovány. Pokud nelze doložit ani známý nulový součet, vrací neznámý údaj místo falešného 0/0 nebo 0. Žádná migrace, žádné nové strky, žádná osobní atribuce dvojic.

| Metrika skutečného #9 | Slovensko | Česko |
| --- | ---: | ---: |
| Potopené koule | 48 | 12 |
| Úspěšné strky / pokusy | 48 / 51 | 12 / 14 |
| Úspěšnost | 94 % | 86 % |
| Evidované miss | 3 | 2 |
| Úspěšné rozstřely | 4 | 1 |
| Suché / soft rozstřely | 0 | 3 |
| Fauly při rozstřelu | 0 | 0 |
| Break and runs dle konvence aplikace | 2 | 0 |
| Výhry / prohry při vlastním rozstřelu | — / — | — / — |

**Neznámé vlastní break výhry jsou oprávněné:** chybí uložený ledger výsledků racků / federalEvidence. Skóre ani pořadí rozstřelů není náhrada důkazu. Další A1 metriky: rozstřel100/25 %, průměr1,8/0,3, esa0/0, čisté2/0, jistoty60/100 %, úniky100/33 %, Resafe1/0, fauly0/2, jump0/0 proti0/1, bank0/1 proti0/0. Původní přímé statistiky zachovány.

## Ověření

- Reprodukční test na origin/main selže `0 !== 48`; na opravě projde.
- Cílené API/integrita/reporty/nová regrese: 69/69 PASS, včetně skutečných tří souborů.
- Celá Node sada se soukromými exporty: 221 testů, 219 PASS / 2 FAIL / 0 SKIP. Pouze známé preview-match-reload-recovery.test.cjs:50 a :106. CI není plně zelené. Na GitHubu dvě soukromé exportní kontroly bez lokálních souborů přeskočí.
- Browser nad současným index.html a skutečným novým exportem: všech13 A1 metrik, správné dvojice/5:3, A2 součty48/12, párové API bez osobního přiřazení, desktop/mobil náhled a reálné PNG/PDF/XLSX downloady PASS.
- Nezávisle openpyxl/PIL/pypdf: XLSX přesně Pushout/Metadata a všech9 hodnot/numerické buňky/procentní formát; desktop a mobil XLSX byteově shodné. PNG1920×1080; PDF16:9, vložené pixely přesně shodné s PNG. Vizuálně prohlédnut výsledný report.
- Původní JSON soubory zůstaly nezměněny. Izolované browserové kontroly: 0 Firebase požadavků, 0 zápisů, 0 JS chyb.

Artefakty: [A1 PNG](screenshots/federal-96-linked-doubles-A1.png), [desktop dialog](screenshots/federal-96-linked-doubles-desktop.png), [mobil dialog](screenshots/federal-96-linked-doubles-mobile.png), [PDF](examples/federal-96-linked-doubles.pdf), [Pushout XLSX](examples/federal-96-linked-doubles.xlsx), [strojové výsledky](federal-fixture-9-statistics-verification.json).

## Omezení

Ověřeno nad dodanými skutečnými exporty v izolovaném prostředí, nikoli živou přihlášenou Firebase relací. Nenasazeno; produkční report se touto přípravou nezmění. Fyzický iPhone, Excel a OBS neověřeny. Dřívější testy doplnění vazby ověřovaly integritu a zobrazení dvojic/skóre, ale neodhalily již před opravou nulový výpočet; nové testy jej přímo pokrývají. Chybějící racková evidence se neopravuje odhadem.


### Ověřený commit a GitHub CI

Oprava pushnuta jako `33719159e2c08cc270c30cc1cadd62e36992579c` do existujícího draft PR #34. [CI40127936545](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/40127936545): Release version and revision **success**; Node **217 PASS / 2 FAIL / 2 SKIP ze221**. Log obou selhání ukazuje pouze známé preview-match-reload-recovery.test.cjs:50/:106. Dva skipy jsou soukromé exportní kontroly, které lokálně prošly. CI není plně zelené. Celý stávající federal-evidence-browser také PASS (stabilní identity, sekvenční/multipot, foul/MISS/escape/Resafe, B&R, Team/páry, UNDO, mockAuth/reload/resume/PUT/GET;0JS chyb). Následný dokumentační commit nemění otestovaný aplikační kód. Nic nesloučeno ani nenasazeno.
