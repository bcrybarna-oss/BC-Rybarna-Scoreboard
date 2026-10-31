> Historický podklad. Aktuální schválenou implementaci, testy a omezení popisuje [zjednodušená9b2](challenges-stage-9b2-lean.md); tento doklad zůstává beze změn pro audit.

# Revize trvalého žurnálu výzev — nasazení blokováno

Dominik,31.10.2026. Kontrolovaný aplikační commit `8a5f3cc`, dokumentační head `b36e697`. PR52 navazuje na51, společné nevydané110, produkce109. Pět již přijatých oprav závodů se touto kontrolou neruší; žurnál **není schválený k nasazení**. Aplikační kód, práva, Rules a data se v této revizi nemění. Nové testy odhalují dvě další vady; nejde o dvě staré experimentální chyby.

## Co se ukládá

`localStorage` stejného originu jako aplikace, klíč `poolcitadlo_challenge_pending_write_v1:<encodeURIComponent(JSON.stringify([uid,profileId]))>:<operationId>`. Jedna položka má UID, profil, ID výzvy, typ akce, název listu, očekávanou hodnotu tohoto listu a journalId. Neobsahuje celý hráčský profil. U odesílatele je však očekávaná hodnota kopií celého objektu výzvy, u adresáta explicitní výběr12polí. Může obsahovat soukromý text poznámky a místo. Žurnál není součástí EXPORTDAT ani serverového schématu.

Oddělení je podle **účtu i profilu**. Stejné UID s jiným profilem ani jiný účet nepřečte cizí potvrzenku pro rozhodování vlastní akce; ověřeno na skutečném controlleru s mocky. Není to šifrování či bezpečnostní hranice mezi skripty stejného originu. Všechny účty nadále sdílejí celkovou kapacitu localStorage.

## Naměřená velikost

Syntetické realistické UID28znaků, profilUUID36, IDvýzvy46, operationUUID36. Velikost zahrnuje klíč i JSON. Počítané UTF8 bajty **nejsou tvrzením**, že takto účtuje kvótu každý browser; UTF16 je jen další orientační odhad.

| Akce | UTF8 bajtů | orientační UTF16 bajtů |
|---|---:|---:|
|Odeslat|1057|2108|
|Přijmout|827|1648|
|Odmítnout|804|1602|
|Zrušit|804|1602|
|Protinávrh|826|1650|
|Odehráno|861|1716|

Odeslání s300českými znaky poznámky:1639B UTF8/2678B orientačně UTF16. UI omezuje poznámku na300znaků; **místo nemá maxlength**, takže pevný horní limit položky dnes není zajištěný. Samostatný stresstest API s100000znaky je mimo běžný UI limit poznámky, nemá být vydáván za normální velikost. Neověřené položky nemají TTL ani automatický limit celkového počtu. Potvrzené záznamy se obvykle odstraní, takže se běžně nehromadí po každé úspěšné akci.

## Plná kvóta a nedostupné úložiště

Skutečný Chrome, izolovaný origin `journal.local`, desktop1440×1000 i mobilníviewport390×844. Existující aplikace a nové moduly, syntetický archivní sentinel, doplněna výhradně testovací výplň až do reálného QuotaExceededError. Dosaženo5242874znaků klíčů+hodnot /98klíčů v tomto prostředí. **Všech6akcí odmítnuto,0PUT**, zachovaný koncept KEEP DRAFT i archivní sentinel. Žádné mazání reálného archivu, žádná produkční síť. Mobilníviewport je stále desktopovýChrome, ne fyzickýiPhone.

Při chybě keys/getItem rovněž žádný novýPUT. Chyba removeItem po potvrzenémPUT nesmí zrušit úspěch: vrací saved, položka ale zůstane a další akce ji zkusí ověřit. To není automaticky odblokované úložiště. Čtení i nové zápisy žurnálu se provádějí až při akci; pouhé otevření výzev může fungovat, přestože všechny jejich zápisové akce selžou.

**Ano, plné localStorage nově znemožní všechny zápisové akce výzev.** U odehraného zápasu je blokováno promítnutí stavu „odehráno“ do výzvy; nejde o důkaz, že se neuložil samotný zápas. Je to neakceptovaná dostupnostní nevýhoda nové9b2, ne oprava známé archivní cache.

## Odstranění, reload a zprávy

| Výsledek | Dnešní chování |
|---|---|
|Přímé HTTP2xx|saved, položka odstraněna; následná chyba seznamu neruší potvrzení|
|Přímé explicitní4xx kromě408|rejected, položka odstraněna, další výslovný pokus možný|
|Síťový výpadek/408/5xx|unknown, položka zachována|
|Reload/zavření karty|položka zůstává vlocalStorage; controller ji načte až při další akci daného účtu/profilu|
|NáslednýGET obsahuje jinou či žádnou hodnotu|unconfirmed, ponechat položku, bezPUT; konflikt a neprovedení nejsou odlišeny|
|NáslednýGET obsahuje shodný list|dnes saved/verified a smazání položky — **neoprávněně silný závěr**, viz níže|
|Úložiště nedovolí smazání|zůstává potvrzenka i po potvrzeném úspěchu|

Skutečný text při zablokování: „Nelze bezpečně uchovat stav operace v tomto prohlížeči. Výzva nebyla odeslána.“ Zobrazuje se pouze toastem na1800ms. **Nestačí**: neříká plnou/nedostupnou kapacitu, neoznačí konkrétní akci a u odehráno působí nepřesně. U poškozeného žurnálu se navíc může zobrazit obecné doporučení zkontrolovat přihlášení, ač příčina je lokální evidence. Aplikace nemá samostatný seznam nejasných operací ani uživatelsky přístupný bezpečný resolver.

Navržené, zatím neimplementované trvalé upozornění: „Změna výzvy nebyla odeslána. Místní úložiště je plné nebo nedostupné a nelze bezpečně zaznamenat průběh operace. Váš koncept zůstal v této stránce. Archiv nemažte.“ Doplnit konkrétní akci a dostupnou diagnostiku; neslibovat obnovu neuloženého konceptu po reloadu.

## Co GET opravdu dokazuje

GET dokazuje pouze **pozorovaný stav v okamžiku čtení**. Vserverových datech není operationId žurnálu ani potvrzenka ukončení konkrétního požadavku. Shodný list mohl uložit jiný klient. Navíc se zapisuje celý profil, ale kontroluje se jen jeden list výzvy.

Reproduktor: původní profilovýPUT má nejasný výsledek a ještě může dorazit. Jiný klient má právě shodný list výzvy, ale novější jméno profilu. OvěřovacíGET vidí shodu; nynější controller smaže žurnál a vrátí saved/verified. Původní opožděný celýPUT pak přepíše novější profil. Test skutečného controlleru to reprodukuje. **Shoda není doklad definitivního dokončení původní operace ani bezpečného odblokování dalších přepisů.**

Stejně nelze ze samotné neshody rozlišit neprovedený požadavek, dosud nedoručený požadavek a provedený následně přepsaný požadavek. OpakovanýGET ani libovolné čekání na stejnou hodnotu tuto mezeru protokolu samy neřeší. Současný model tedy neumí spolehlivou třícestnou klasifikaci potvrzeno/neprovedeno/konflikt po ztrátě odpovědi.

## Bezpečné ověření a odblokování

1. Zachovat potvrzenku a exportovat diagnostiku, ověřit účet/profil a konkrétní očekávaný list. Pouze číst; neprovádětPUT, nemažte archiv ani klíč žurnálu kvůli odblokování.
2. Je-li zachovaná přímá2xx odpověď, je to potvrzení původního požadavku. Přímé odmítnutí dovolí nový výslovný pokus podle zobrazené chyby. Controller tyto případy již rozlišuje.
3. Při opravdu nejasném výsledku označit GET jen jako „hodnota nyní odpovídá / neodpovídá“. Bez důkazu, že původní požadavek je ukončený, neprohlašovat jej za uzavřený a nepovolit slepé opakování.
4. Pokud takový důkaz nemáme, **současná aplikace nemá zaručeně bezpečný automatický postup odblokování**. Ruční rozhodnutí by vyžadovalo doložený stav/ukončení původní operace a vyloučení dalších přepisů; jinak jde o přijetí rizika, nikoli ověření. Nedoporučuji konzolové mazání potvrzenek ani „zkusit znovu“ po čekání. Produkce109 žádný tento nový žurnál nemá; reálná data nyní neopravujeme.

Pro plnou jistotu je potřeba zvlášť schválená serverově doložitelná identita operace/receipt a atomický přechod. [Původní návrh konfliktů](challenges-write-conflict-proposal.md) zůstává návrhem, nikoli implementací. Pouhý přesun žurnálu do jiného úložiště mezeru GET/nejasnýPUT neřeší.

## Tokeny a hesla

Controller nedostává runtime token/heslo a autentizační údaje nejsou explicitními poli žurnálu. Sentinel vprivátním poli celého profilu se při normálním toku neuložil. **Nelze však slíbit obecný zákaz citlivých extra polí**: odesílatelská větev kopíruje celý objekt cachované výzvy bez whitelistu. Synteticky přidané idToken/password se do potvrzenky zkopírovaly. Není to nález úniku skutečného produkčního tokenu; je to nově doložená mezera sanitizace. Požadavek striktního whitelistu nyní hlídá samostatný selhávající test. Volný text poznámky je samozřejmě nadále uživatelský obsah.

## Varianty a doporučení — zatím nic neimplementováno

| Varianta | Hodnocení |
|---|---|
|Ponechat povinnýlocalStorage žurnál|jednoduché fail-closed, ale při doložené plné kapacitě zablokuje všech6akcí; nyní nedoporučuji nasadit|
|Oddělený transakční žurnál IndexedDB + whitelist + stálý stavový panel|**doporučeno jako další návrh**; vtomtoChrome se úspěšně uložilo2048znaků doIndexedDB i při plném localStorage. PředPUT vyčkat na commit transakce a znovu ověřit relaci. Pokud selže i toto úložiště, stále bezpečně odmítnout; žádná nekonečná kapacita ani záruka proiPhone|
|Paměť/sessionStorage nebo vypnutí žurnálu při kvótě|obnoví dostupnost, ale ztrácí bezpečnou návaznost po zavření/reloadu a může umožnit opakování nejasnéhoPUT; nedoporučuji jako tichý fallback|
|Rezervovat místo ve stávajícím localStorage|nezaručuje dostupnost, když už je plné, ani maximální velikost položky; nevytváří jistotu dokončeníPUT|

IndexedDB není pod stejným pevným endpointovým limitem localStorage, stále ale podléhá politice/kapacitě úložiště originu: [WHATWG Storage](https://storage.spec.whatwg.org/#registered-storage-endpoints). Není zde provedena změna archivní cache ani serverového protokolu. Doporučuji nejprve schválit úložiště a konzervativní stavový kontrakt: GET shoda je pouze pozorování, ne terminálníACK. Odblokování nejasnéhoPUT řešit samostatným serverovým návrhem, ne jeho předstíráním.

## Testy a stav PR

- Skutečný zaplněnýlocalStorage desktop/mobileviewport:6/6odmítnuto,0PUT,koncept+sentinel zachovány,0JSerrors. Ověřovací2048znakovýIndexedDB zápis při stejné plnékvótě uspěl.
- Audit skutečného controlleru: velikosti, UID/profil izolace, SecurityError při keys/get/remove,2xx/403cleanup,408/503retence,reload,absent/odlišnýlist a opačný příklad shody s pozdnímPUT. Vše izolovaně/mocks.
- Dosavadních15testů controlleru PASS; jejich předpoklad, že read shoda postačí k verified, je nyní vyhodnocen jako nedostatečná záruka. Původní úspěch nelze vydávat za důkaz správnosti protokolu.
- Nové `tests/match-challenge-journal.test.cjs`: **0PASS /2FAIL**, vyžadují nesmazat nejasnou operaci pouhou GET shodou a neukládat credential extra pole. Nejsou označené expected-fail ani přesunuté doexperimentu; automaticky patří do produkční Node sady.
- Produkční Node s dostupnými privátními exporty: **312PASS /2FAIL /0SKIP**, exit1. Žádná aplikace se nezměnila; nové testy zpřístupnily skutečné mezery nové funkce. Experimentální dvě dřívější vady zůstávají jiný problém. PNG parita je samostatná browserová kontrola, zde se neopravovala.

ŽivýAuth/Rules/iPhone neověřeny. Zápisy browserového testu směřovaly pouze do izolovaných testovacích úložišť a mocků, žádná produkční data. [Úplné strojové výsledky](challenge-journal-review-verification.json). **PR52 nepřipravený k integraci/nasazení do vyřešení nových zjištění;9c nezahájena.**
