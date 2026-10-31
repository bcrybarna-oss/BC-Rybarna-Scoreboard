# Návrh bezpečného protokolu zápisů výzev

Zadavatel: Dominik,31.10.2026. **Samostatný budoucí návrh, ne implementace9b2.** Nahrazuje dřívější stručné porovnání konfliktů. Žádný nový serverový uzel, podmíněný zápis, SDK, migrace či Rules se nyní nezavádí. [Úzká bezžurnálová9b2](challenge-write-simplification-proposal.md) musí mít výslovně slabší záruky.

## Výchozí problém a cíl

Dnes se čte návrh z `/players/{sender}/matchChallengesSent/{id}`, reakce z `/players/{recipient}/matchChallengeResponses/{id}`, slučují se client timestampy a přepisuje celý vlastní profilPUT. Chybí jeden atomický rozhodovací bod celé výzvy, serverová revize a průkazný výsledek konkrétní operace. ŽádnýGET shody dat nedokáže zpětně dodat příčinnou souvislost.

Cíl budoucího protokolu: změna jedné výzvy a neměnný výsledek konkrétní operace vzniknou **vjedné atomické operaci**. Ochrana soupeřících zařízení, bezpečné opakování stejnéhoenvelope a průkazné dokončení/odmítnutí. Neznamená to globální exactly-once libovolné akce uživatele s novýmID nebo vedlejších služeb.

## Rozsah zápisu a obálka

Navržená, ilustrativní hranice: jeden autoritativní `/challengeStates/{challengeId}` obsahující currentState, monotónní businessRevision, vazby účastníků/profilů, případnou rezervaci matchId a mapu neměnných operation receipts. Konkrétní cestu a schéma teprve schválit. Nedělat atomickou operaci nad celým `/players` a nerozšiřovat kvůli tomu klientská práva.

Příkaz má explicitní povolená pole: protocolVersion,operationId,challengeId,action,expectedRevision a payload přesně podleakce. Identita se ověřuje serverovýmAuth; actorUID zJSON není zdroj oprávnění. Server sváže operationId s původnímUID,challengeId,typem a hashem kanonického povoleného payloadu. Profil, účastníky, status a povolený přechod kontroluje proti autoritativnímu stavu, ne proti lokálnícache.

Záznam výsledku:operationId,actorUID,requestHash,status(applied/rejected/abandoned),resultRevision,stabilní identita výsledku a povolený kód chyby; žádnýtoken/heslo. Přístup kreceiptům je soukromý. Veřejný harmonogram má oddělenou redigovanou projekci bezreceiptů a soukromých poznámek. Všechno nové kopírování a ukládání používá whitelist, typy a verzi schématu.

## Atomický algoritmus

1. Ověřit aktuální autentizaci a oprávnění vidět/změnit tento zdroj. Stejný opId nesmí jinéUID použít k získání cizího výsledku.
2. Vatomickém bodu nejprve hledat operationId. Existující stejný původce+stejný hash: vrátit **původní výsledek**, bez druhé změny. Existující ID s jiným obsahem: odmítnout, žádná substitucepayloadu. Kontrola duplicity musí předcházet expectedRevision, jinak by legitimní retry poúspěchu chybně vracelo konflikt.
3. Bezreceiptu porovnat zachycenou expectedRevision s aktuálnímstavem. Konflikt nesmí automaticky přizpůsobit původní úmysl novéverzi. Lze atomicky uložit definitivní rejectedreceipt při nezměněném obchodnímstavu; jiné oprávnění vyžaduje vlastní bezpečnostní posouzení.
4. Zkontrolovat přípustný stavovýpřechod všechšestiakcí a aktuálníúčastníky. Nepřidávat jiná sportovní/uživatelskápráva. Při přijetí/protinávrhu se kontroluje stejný autoritativní návrh, žádné rozhodnutí ze dvou nezávislých profilovýchsnapshotů.
5. Atomicky změnit currentState, zvýšitbusinessRevision a uložit appliedreceipt. Bezatomické vazby naeffect by se samotný receipt mohl uložit bez změnynebo naopak, což je nepoužitelné.
6. Výstupní indexy/projekce/notifikace až ze zaznamenaného výsledku. Opakovatelné doručování může spustit vedlejší službu víckrát: používat stabilníeventID/outbox a deduplikaci. Netvrdit přesnějeden efekt mimo atomickouhranici bez samostatného protokolu.

## Podmíněný REST versus transakce

| Varianta | Co může garantovat | Omezení |
|---|---|---|
|ETag/If-Match na dnešním jednom listu|neztratit soupeřící přepis téhožlistu, menší datovýzáběr|nekontroluje atomicky návrh vjednomprofilu a reakci vdruhém; bezreceiptu neřeší ztracenou odpověď|
|ETag/If-Match na jediném kanonickémcelku sreceipt mapou|CAS celého stavu a výsledku operace; starárevize nemůže tiše přepsatnovou|klient musí číst celý dotčenýcelek, Rules musí vynutit povolený přechod a neměnnéreceipty; velikost a retence; nelze přimíchávat staré nepodmíněnéPUT|
|SDK/backend transakce na stejnémcelku|stejná atomickáhranice, řešení technického souběhu|callback může být opakován, musí být čistý; business expectedRevision musí zůstat zachycená, nesmí se při retrypřepočtu posunout naaktuální a skrytě přijmout novýstav|
|Dva samostatnézápisy / fan-out bez porovnánírevize|může atomicky distribuovat známéhodnoty|není atomický compare-and-decide celé výzvy; není náhradou CAS/transakce|
|Transakce nad společným předkem dnešníchprofilů|mohla by zahrnout oba profily|dnešní předek `/players` má nepřiměřený datový/oprávňovací záběr; nedoporučeno klientům|

Ověřená fakta API: Firebase REST umí ETag a If-Match; při nesouladu412 nevytvoří zápis a neposkytuje automatické opakování. To je vlastnost jednoho cílového místa, nikoli více nesouvisejícíchuzlů. [Firebase REST Saving Data](https://firebase.google.com/docs/database/rest/save-data#section-conditional-requests).

FirebaseRTDB transaction funkce může být při souběhu spuštěna znovu; musí být bez vnějšíchúčinků. Klientskátransakce vyžaduje read i write, a smíchání set s transakcí na stejném místě má dalšírizika. [Firebase Database API](https://firebase.google.com/docs/reference/js/database#runtransaction).

Doporučuji autoritativní commandhandler s transakcí nad úzkým kanonickýmcelkem. Správa identity, pravidel a neměnnýchreceiptů je tam přehlednější než složité klientsképodmínky přes dva profily. Je to nová infrastruktura/Rules/schéma, takže vyžaduje samostatné schválení a testovacíprojekt. Pokud backend není zvolen, lze posoudit kanonickýCAS s dostatečnýmiRules; nikoli pouhýCAS na listu vydávaný za řešenícelé výzvy.

## Opakování, nejasný výsledek a definitivní neprovedení

- Po ztrátěodpovědi se zjišťuje výsledek **stejnéhooperationId**, původníhoUID a hashpayloadu. Nikoli shodaaktuálníchhodnot. Applied/rejectedreceipt pochází ze stejné atomickéoperace, proto má průkazný význam.
- Pokud je samostatněschváleno opakování, znovu poslat **stejný envelope, stejnýID, hash a expectedRevision**. Ne novýID, novýtimestamp či novourevizi podleGET. Server vrátí uložený výsledek nebo provede nejvýšjednu změnu. Při412 se původní úmysl automaticky nepřepočítá na novouverzi; nový úmysl vyžaduje zobrazení změny a nové výslovné potvrzení.
- **Nepřítomnýreceipt pořád není důkaz neprovedení**: první příkaz mohl teprve dorazit. Vrátit unknown/not-seen, ne „bezpečně zopakovat s novýmID“.
- Pro definitivní opuštění je možná budoucí atomická operace **uzavřít neviděnéoperationId**: pokud receipt užexistuje, vrátí ho; pokud ne, uloží neměnný abandoned/fence záznam bez obchodníhoúčinku. Opožděný původnípříkaz potom musí narazit na tentozáznam a nicneprovést. Applied aabandoned musí soupeřit ve stejné atomickéhranici; obyčejnýDELETE nebo separátnícancel flag nestačí. Tato funkcionalita není nyní schválená ani implementovaná.
- Receipt samotný není uživatelsky mazatelný. Retence/archivace/fencing starýchID vyžaduje přesnou politiku. Vypršení historie nesmí dovolitznovupoužitíID nebo vrátit neprovedeno bezdůkazu; lze vrátit výsledekjižnenídostupný, ale staráexpectedRevision stále nesmí tišeprovést novýefekt. Monotónnírevize se nesmí obnovou zálohy beznovéhoepochu vrátit dozadu.

## Identitaoperace přes restart

Idempotence chrání pouze **stejné známé ID**, nikoli novýstejnýklik po ztrátě jehoID. Budoucíprotokol musí vyřešit dostupnostID: minimální bezpečná perzistence nebo serverem rezervovaná/obnovitelná operace před spuštěním účinku. Například serverovéprepare bez obchodníhoúčinku a privátní seznam rozpracovaných operací, teprve potomcommit. Ztracenáprepare odpověď nesmí sama vytvořit výzvu. Je nutné dořešit, jak odlišit obnovení intentu od úplněnového.

Žádná zpětnádedukceoperationId podle jmen/skóre/payloadpodobnosti. Pokud klientID ztratil a protokol ho nedokáže průkazněobnovit, výsledek zůstává nejasný a nelze slíbit exactly-once. Toto není schválení návratu povinného žurnálu do omezené9b2.

## Vazba na vznik zápasu

Přijetí samo nesmí na dvouzařízeních vytvořit dva různé matchId. Budoucí start operace může atomicky rezervovat jedenmatchId vautoritatívnívýzvě a vracet ho idempotentně. Skutečný zápas je mimo tentocelýuzel: materializace musí být create-if-absent/idempotentní pro stejnéID a nesmí přepisovat již uložené strky/skóre. Bez dalšíatomickéhranice nelze tvrdit, že creationmatch i challenge receipt jsou jeden commit. Tento přesah potřebuje samostatný návrh před implementací, hernídata se zde nemění.

## Přechod ze starýchklientů a oprávnění

Staré whole-profile writery nesmějí zapisovat do stejného autoritativního stavu vedle nového CAS/transakce, jinak záruky poruší. Nutný plán kompatibility, versiongate a případné migrace se zálohou. Historicképrofilovévýzvy lze po schváleném převodu ponechat jako read-only podklady; projekce nejsou druhý zdrojpravdy. Klientská práva k `/players` nerozšiřovat a nepřesouvat autoritu na lokálnírole. AuthA→B neobnoví autoritu původníhoop; výsledky lze číst jen příslušnému vlastníkovi/účastníkovi podle serverovépolitiky.

ZměnaRules, serverovýchdat, backendu a nasazení jsou samostatná rozhodnutí. Žádný z těchto kroků se nyní nedělá. Rollback takovéhobudoucíhoprotokolu nelze automaticky označit za prostou reverzi kódu bez vyřešení novýchdat a rozpracovanýchoperací.

## Povinné ověření budoucíimplementace

Emulátor/testovacíprojekt se skutečnýmiRules: soupeřícíaccept/counter/cancel, dvě zařízení/účty/taby, dvěrevize, stejnýopID desítkykrát, stejnýID+jinýhash, ztracenáodpověď poúspěchu, opožděný prvnípříkaz, readnot-seen před příchodem, fence versusapplied voboupořadích, receipt retention, obnoveníID po restartu, zakázanýpůvodce a změnaúčtu, neověřenéřetězce/navíc credentialpole, jediná rezervace matchId. SDK retry callback musí při opakování udělat navenek nulaúčinků, dokud není atomický výsledek.

Samotné mocky nemohou potvrdit Rules ani současné chování skutečnéhoDBserveru. Vnávrhu žádné takové ověření netvrdíme.9cnezačíná.
