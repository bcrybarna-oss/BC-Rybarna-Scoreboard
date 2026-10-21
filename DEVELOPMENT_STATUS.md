# Aktuální stav vývoje Poolčítadla

Aktualizováno: 18. 10. 2026. Tento dokument popisuje stav této pracovní větve;
není potvrzením nasazení do produkce. Architekturu popisuje PROJECT_CONTEXT.md.

## Výchozí stav

- Repozitář: bcrybarna-oss/BC-Rybarna-Scoreboard.
- Výchozí main: `455cec93c0538b2a0411006dcb81926130a7edff`.
- Pracovní větev: `fix/preview-recovery-tests-20261018`.
- Rozsah: obnova zápasu v test-modular, související testy a tento přehled.
- Produkční index.html, Firebase konfigurace a workflow se v tomto kroku nemění.

## Rozpracované úkoly a odpovědnost

| Úkol | Odpovědnost | Stav / další krok |
| --- | --- | --- |
| Oprava dvou regresních selhání | Jaroslavův AI asistent | Připraveno v této větvi; kontrola PR a CI |
| Kontrola návrhu | Jaroslav a Dominik | Zkontrolovat diff a ručně ověřit reload a přihlášení |
| Modularizace | Rozdělení práce dosud nepotvrzeno | Zachovat PR #6; pokračování po koordinaci |
| Posouzení PR #4 a #5 | Dosud nepřiděleno | Samostatně prověřit unikátní změny, nic nezavírat |
| Ochrana main a blokování nasazení při chybě testů | Vyžaduje správce repozitáře | Připravit samostatnou změnu a ověřit nastavení Pages |
| Úklid backup/* | Jaroslavův AI asistent: inventura | Mazání pozastaveno; vyžaduje finální potvrzení |
| Staré HTML stránky | Dosud nepřiděleno | Nejdřív inventura využití, odkazů a Firebase vazeb |

## Oprava a ověření

- Před opravou: 36/38 testů úspěšných místně i v CI na výchozím main.
- Při neověřené identitě se testovací zápas odpojí z editovatelné paměti;
  uložená kopie a ukazatel zůstávají pro obnovení oprávněným účtem.
- Test přihlášení ověřuje pořadí načítání a výběr mezi obnovou zápasu
  a turnaje spuštěním obou skutečných sekvencí s izolovanými závislostmi.
- Přidán scénář odloženého přihlášení: cizí účet nesmí obnovit zápas,
  vlastník následně obnoví skóre s pozastavenými hodinami.
- Místně po opravě: `npm test` — 44/44, Node v24.19.0; `git diff --check` bez chyb.
- CI používá Node 22; jeho výsledek je nutné ověřit na aktuálním commitu PR.
- Ruční browser test ani přístup do Firebase v tomto kroku neproběhl.

## Zjištěná omezení

- CI běh 39111790914 na výchozím main selhal, zatímco Pages běh
  39111790320 stejného commitu uspěl. Nasazení tedy nebylo zablokováno testy.
- Čtení ochrany main přes integraci vrátilo 403. Nelze tvrdit, že ochrana
  je ověřená nebo správně nastavená. Seznam repository rulesets byl prázdný.
- Všech 17 backup větví má tip v historii výchozího main a není v otevřeném PR.
  Prověřená workflow na ně explicitně neodkazují. Externí automatizace a
  úplné nastavení nasazování nejsou ověřené; mazání zatím není schválené.

## Pravidla koordinace

1. Před prací načíst tento soubor, PROJECT_CONTEXT.md a aktuální main i PR.
2. Domluvit vlastníka úkolu; nezasahovat současně do stejné části bez koordinace.
3. Změny provádět přes pracovní větev a PR. Main nepřepisovat ani neměnit přímo.
4. Aktualizovat tento přehled v příslušném PR a označit neověřené skutečnosti.
5. PR #6 zachovat. Ostatní PR, větve ani staré soubory neodstraňovat bez dohody.
6. Další krok: CI a ruční ověření této opravy, poté samostatné řešení ochrany nasazení.

## Navazující oprava zrušení zápasu

- Jaroslav ověřil obnovu zápasu po reloadu v soukromém náhledu PR #12.
- Po hlášení nefunkčního zrušení přidáno potvrzení přímo ve stránce.
- Zrušení odstraní aktivní stav i recovery kopie a uloží ID mezi zrušené
  ještě před asynchronním úklidem, aby se zápas po reloadu nevrátil.
- Pět nových testů ověřuje potvrzení, zachování zápasu, změnu účtu/zápasu,
  odmítnutí starých záloh po reloadu a dostupnost ovládacích prvků.
- Soukromý náhled: https://poolcitadlo-pr12-20261018.fundeer1.chatgpt.site
- Opravu zrušení je ještě nutné ručně ověřit.
