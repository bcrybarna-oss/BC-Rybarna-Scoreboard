# Návrh následného řešení konfliktů výzev (bez implementace)

Zadavatel: Dominik, 31.10.2026. Doplněk 9b2, **pouze návrh**. Žádné podmíněné zápisy, serverové datové schéma ani Firebase Rules se v9b2 nemění.

## Co garantuje pouze nynější 9b2

V jedné instanci aplikace zachytí identitu/profil/generaci a vstupy, serializuje profilové zápisy výzev, deduplikuje probíhající akci, neaplikuje starý výsledek do nové relace a invaliduje starší players GET při zápisu. Místní žurnál je potvrzenka pro ověření nejasného výsledku, **není serverový zámek ani idempotency protokol**. Dva různé taby/zařízení stále mohou odeslat celé profily ze svých nezávislých snapshotů. Nijak se nepředstírá, že odhlášení odvolá odeslaný požadavek.

## Současná hranice dat

Odesílatel uchovává návrh v `/players/{senderPlayerId}/matchChallengesSent/{challengeId}`, adresát reakci v `/players/{recipientPlayerId}/matchChallengeResponses/{challengeId}`. Akce nyní přepisuje celý vlastní profil PUT; dva přepisy mohou ztratit nesouvisející změnu. Výsledný stav vzniká klientským sloučením podle timestampů ze dvou profilů. To není atomické rozhodnutí o celé výzvě a lokální hodiny nejsou serverová revize.

## Varianty k samostatnému schválení

| Varianta | Hranice atomické operace | Přínos | Omezení / potřebné schválení |
|---|---|---|---|
| A: podmíněný zápis stávajícího listu | jeden konkrétní `matchChallengesSent/{id}` **nebo** `matchChallengeResponses/{id}` | GET s ETag + PUT If-Match chrání tentýž list a nevrací celý profil; nesmaže nesouvisející profilová pole | nezajišťuje atomickou kontrolu druhého profilu, např. souběžné přijetí starého návrhu a změnu termínu; prověřit oprávnění listu v testovacích Rules |
| B: jediný autoritativní stav výzvy | jeden kanonický uzel výzvy s oběma účastníky, stavem, revizí a identitou operace | CAS/transakce nad celým stavovým přechodem; jedno pořadí a možnost spolehlivě rozlišit opakování téže operace | změna schématu, Rules, kompatibility/migrace a oprávnění; vyžaduje zvláštní zadání a návrh |
| C: důvěryhodná serverová operace nad existujícími daty | backend ověří obě účastnické větve a provede konzistentní změnu; jejich společným předkem je dnes `/players` | lze zachovat klientský datový tvar a atomicky ověřit starý návrh i reakci | backend, oprávnění a bezpečnostní testy; **nedávat klientům široké právo k `/players`** kvůli transakci |

Doporučení: pro úplnou sémantiku přijetí/protinávrhu preferovat B, případně C podle plánované datové vrstvy. A lze schválit jako omezenou mezietapu, ale nesmí být prezentována jako plné řešení konfliktu celé výzvy. Nynější 9b2 žádnou variantu neimplementuje.

## Navržené chování při konfliktu a výpadku

- Před síťovou akcí nadále ověřit zachycenou relaci a vlastníka; práva určí server, nikoli skryté tlačítko.
- Při412: žádné automatické opakování PUT. Načíst aktuální revizi, ukázat změnu a zachovat koncept. Uživatel rozhodne, zda akci znovu potvrdí vůči novému stavu. Žádné tiché přepsání ani automatické řešení „moje vyhrává“.
- Po výpadku: nejprve číst autoritativní stav/identitu operace. Potvrzená shoda znamená uložené; jiná hodnota sama nedokazuje, že původní požadavek ještě nemůže dorazit. Neověřený výsledek zůstane neověřený, bez slepého retry.
- Již přijatý zápas a návazný matchId nelze přepsat jiným stavem bez samostatně schváleného pravidla. Jedna instance nového zápasu vyžaduje serverový rozhodovací bod, má-li se garantovat napříč zařízeními.
- Backend nebo nový uzel má používat serverovou revizi a stabilní ID operace, ne pouze client updatedAt.

## Ověření budoucího PR

Dvě karty i dva účty, přijetí versus protinávrh/zrušení, dvě úpravy téhož listu i různých profilů,412, výpadek po úspěchu, opožděný první požadavek, zachování konceptu, zakázané cizí UID a přechod účtu. Živé Rules jen v testovacím projektu. Migrace/kompatibilita musí mít vlastní schválení a zálohu; žádná produkční migrace v této etapě.
