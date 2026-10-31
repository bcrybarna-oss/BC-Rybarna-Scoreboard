# Etapa 9b2: zjednodušená životnost zápisů výzev

Zadavatel: Dominik. Datum: 31. 10. 2026. Kandidát **v4.51.110 RC**, produkce zůstává109. Existující [PR52](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/52) navazuje na samostatný [PR51](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/pull/51). Žádný merge/deploy, 9c nezačala. Tento záznam nahrazuje jako aktuální kontrakt původní návrh a implementaci žurnálu; historické doklady zůstávají.

## Rozsah a vlastnictví

MatchChallengeActions zůstává jediným controllerem šesti akcí send/accept/decline/cancel/counter/played. Vlastní zachycené vstupy, ticket UID/profil/generace, sdílení probíhající akce, frontu profilu a pouze paměťovou mapu nejasných výsledků. Aplikace předává minimální identitu a profilovou identitu, autorizaci, transport, potvrzený delta-commit, obnovu a UI callbacks. MatchChallenges z9b1 nadále vlastní čtení/cache/obnovy; jeho existující write-revision/barrier brání starému GET přepsat potvrzený výsledek i ve stejné relaci. Controller nevlastní žádný časovač, DOM listener ani čtecí požadavek.

Povinný žurnál, reconcile, GET-based verified, ukládání potvrzenek a jejich replay byly odstraněny bez náhradního úložiště či automatického retry. Dříve vytvořené neprodukční žurnálové klíče se nečtou ani nemažou; neprobíhá migrace ani čištění archivu.

## Pět zachovaných oprav

1. Vstupy i vlastník jsou zachyceny před čekáním. Před prvním skutečným PUT se kontroluje původní UID, profil, generace a platnost relace. Akce čekající na autorizaci A po A→B ani A→B→A nezapíše jako nová relace.
2. Již odeslaný PUT nelze odvolat odhlášením. Jeho dokončení A nesmí změnit UI, cache, koncept ani pending stav B; přímé ACK se přesto vykáže jako saved/stale, nikoli jako vrácený zápis.
3. Stejná probíhající akce sdílí promise a jediný PUT/UI callback; konfliktní akce stejné výzvy je busy. Další výzvy stejného profilu se řadí do fronty.
4. Žádný spekulativní accepted se do profilu neukládá. Jednoznačné HTTP odmítnutí dovolí opravený explicitní pokus a zachová vstupy. Potvrzený úspěch nezmění na neúspěch chyba následné obnovy nebo UI callbacku.
5. Čtení zahájené před potvrzeným zápisem je neplatné; souběžná čtení počkají na bariéru a zachovávají sdílení. Oddělení vlastníků A/B platí také pro bariéry.

## Nejasný výsledek: omezená záruka

Síťová chyba po zahájení PUT, HTTP408 nebo5xx nejsou vydávány za jednoznačné odmítnutí. Profil dostane paměťovou stopku. Dosud neodeslané čekající i nové akce tohoto profilu skončí bez dalšího PUT (také po čekání na autorizaci). Účet/profil B není blokovaný ani přepsaný; při návratu k A ve stejné instanci stopka trvá. Chyba před zahájením transportu není falešně unknown.

Globální role=alert upozornění přežije navigaci a běžný toast; kopie uvnitř otevřeného protinávrhu zachová dostupnost informace i koncept. Text výslovně říká, že server mohl změnu uložit, akci neopakovat, další změny profilu jsou zastavené a **obnovení stránky zápis neruší a nemusí vyřešit jeho nejasný výsledek**. Zobrazený stav je jen poslední načtená hodnota. GET shoda ani neshoda nic nepotvrzuje a stopku nezruší. Neexistuje tlačítko automatického ověření/odblokování, skrytý retry ani replay.

**Po restartu/reloadu se upozornění ani stopka neobnoví.** Nová instance sama nic neopakuje, ale současný protokol neumí zabránit pozdějšímu ručnímu opakování původní nejasné operace. Koncept zůstává v aktuální stránce, ne garantovaně po zavření. Nejasné zápisy tím nejsou vyřešené. Není zaručeno atomické rozhodování mezi zařízeními ani ochrana proti přepsání jinou celoprofilovou mutací. [Budoucí protokol](challenges-write-conflict-proposal.md) je pouze návrh; Rules, serverový formát a ostatní obecné profilové writery se nemění.

## Whitelist versus zachování serverové obálky

Nové vstupy, challenge snapshoty, výsledné delty a paměťová metadata mají explicitní whitelist a validaci typů. Žádná kopie celého cachovaného objektu se nepřenáší do stavu controlleru. Nově podstrčená pole idToken/password/extra se do delty nedostanou; chybný vstup se odmítne před PUT. Žurnál ani jiné ukládání přihlašovacích údajů neexistuje.

Stávající PUT celého profilu není změněn na nový protokol. Bezstavový serializer převede dosavadní profilovou obálku na JSON a přeloží pouze whitelisted delta; zachová neznámá serverová pole v rootu, jiných výzvách i existujícím cílovém záznamu. Úmyslně je nemaže „sanitizací“. Toto není tvrzení, že kopie profilu obsahuje nejnovější souběžné změny jiného zařízení; ochrana takového konfliktu zde nevzniká. Lokální potvrzený commit mění pouze povolenou deltu.

## Ověření

- Produkční Node: **318 PASS /0 FAIL /0 SKIP** se třemi místními skutečnými exporty pouze pro čtení. Ve veřejném CI se tyto tři soukromé fixtures nevyskytují; jejich přeskočení se vykazuje samostatně.
- Aktuální controller18 testů +3 kontrakty bez žurnálu PASS. Pět původních závodů zůstává před/po reprodukovatelných pomocí historického main/9b1; historický audit není zaměněn za test opravy.
- Skutečná aplikace v Chromium desktop1440×1000 a mobil390×844, mock Auth/Firebase: všech pět oprav, šest payloadů, capture vstupů, navazující založení zápasu, jednoznačné odmítnutí/retry, potvrzený úspěch/chyba obnovy, nejasný výsledek, zastavení fronty, A/B a návrat A PASS. Každý viewport21PUT/9GET v celém scénáři; nejasná akce s čekající další akcí pouze1PUT. Storage naplněna reálně, všech6akcí po jednom ACK; archivní sentinel zachován. SecurityError při metodách i přístupu k localStorage neblokuje tyto zápisy; koncept během čekání zachován.
- Reader9b1,12modulů bootstrap desktop/mobil, recovery s mock Auth (manual/automatic), turnaje101 včetně quota/draft/skupiny-playoff/FC, Livescore reader, OBS izolace, skutečné A1/A2/B PNG/PDF a Singles/Doubles/Team XLSX PASS. Jen izolované testy; žádný produkční zápis.
- Experimentální sada **28 PASS /2 FAIL /0 SKIP**, jednotlivě nezměněná proti výchozímu main: preview50 neoddělí editovatelný zápas při čekání na Auth; preview155 důvěřuje zbytkovému UID bez autentizace. Experimentální core není produkčně načítán. Žádné vypnutí/změna workflow ani sad.
- Dvě auditní reprodukce odstraněného žurnálu z213f87f zůstávají samostatně **0 PASS /2 FAIL**: GET leaf-match chybně prohlásí operaci za dokončenou a sender přenese nepovolená pole. `node --test tests/audits/challenge-journal-regressions.cjs` má exit1; přesná zmrazená implementace je testovací fixture, ne produkční fallback. Její LF SHA256 je `57f604cb6d2fefea9cffc5fc5632a06292e319ecf6a446d67e28bd0949b4f637`. Testy mechanismu, který už neexistuje, byly nahrazeny aktivními zárukami: žádný GET ACK/retry, whitelist a zachování serverových polí. Historické chyby nejsou přejmenované na dvě experimentální vady ani vykázané jako opravený žurnál.
- Samostatná notification-center PNG browserová parita v tomto běhu desktop/mobil PASS. Není součást GitHub CI a její doložená předchozí nestabilita není opravena. Mobilní překrytí zvonku zůstává samostatný úkol.

Živý Auth, skutečné Rules, konflikty více zařízení a fyzický telefon tím nejsou ověřené. Přesun ani zjednodušení nejsou vydávány za optimalizaci. Strojový doklad: [výsledky](challenges-stage-9b2-lean-verification.json).

## Návrat a vydání

PR51 zůstává samostatný beze změny větve. PR52 nad ním stále tvoří nevydaný kandidát110; neslučovat ani nenasazovat bez dalšího zadání. Při případném samostatném vydání51 je nutné přepočítat verzi52 z čerstvého main. Návrat této aplikační změny reverzí bez vracení dat; nevracet do produkce odmítnutý povinný žurnál jen reverzí zjednodušovacího commitu. Pro návrat ke stavu9b1 revertovat celou9b2 v pořadí závislostí a před vydáním spustit release/regrese; při již vydané verzi nové číslo podle AGENTS. Žádná migrace/oprava uložených zápasů.

CI aplikačního commitu `1bb090c9ff2c5291aa3ee74e28df493ca20de231`: [run41228939102](https://github.com/bcrybarna-oss/BC-Rybarna-Scoreboard/actions/runs/41228939102) — Release PASS, produkce315PASS/0FAIL/3SKIP (tři soukromé exporty chybí vCI), experiment28PASS/2FAIL/0SKIP. Celý workflow FAILURE jen kvůli oběma nezměněným experimentálním vadám, žádná nová produkční regrese. Tento následný zápis mění pouze dokumentaci.
