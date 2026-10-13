# Poolčítadlo – plán bezpečné modernizace (první etapa)

Větev: \`improvement/setup-players-tests-20261012\`  
Základ: \`main\` / v4.51.72 RC  
Testovací verze: **v4.51.75 RC**  
**Nezapisovat testovací výsledky do ostré databáze, pokud je nelze bezpečně odstranit.** Než se bude zkoušet ukládání do cloudu, připravit testovací uživatele a vhodné prostředí.

## Co první etapa mění

- Pole **Název / popis zápasu** je přímo v základním nastavení klasického zápasu (a zůstává dostupné i pro Ghost).
- Tlačítko **Další nastavení** se nachází až za základními údaji. Skryté volby streamu neponechávají prázdné panely.
- Výběr registrovaného hráče pro klasický zápas předává **ID profilu**. Zůstává vyhledávání podle jména/klubu a možnost ručního zadání nového jména.
- Pokud existuje více aktivních profilů stejného jména, ruční zadání toto jméno **nesmí automaticky přiřadit** prvnímu profilu. Je nutné explicitně vybrat hráče.
- Turnajové a ligové předvyplnění je zachováno; ID turnajového účastníka má při založení jeho zápasu přednost.
- Soubor \`tests/smoke.test.cjs\` ověřuje vybrané předpoklady a chování resolveru profilu. \`npm test\` ho spouští automaticky.

## Manuální regresní scénáře před nasazením

Zápasy:
- [ ] Nový klasický 8-ball: výběr hráčů, Race to, rozstřel a název zápasu jsou dostupné bez další nabídky.
- [ ] Nový 9-ball a 10-ball: pokročilá pravidla se zobrazí po rozbalení a promítnou se do zahájeného zápasu.
- [ ] Klasická 14.1: cílové skóre a tempo fungují.
- [ ] Jednoduché počítadlo: přidání bodů a návrat ze zápasu fungují.
- [ ] Dvojice: čtyři různé profily, jména hráčů, skóre a statistiky.
- [ ] Vítěz na stole: tři hráči, výměna poraženého za čekajícího.
- [ ] Úprava názvu se projeví ve skóre, Livescore a historii (a na stream overlayi, pokud je aktivní).
- [ ] Undo a bezpečné obnovení rozehraného zápasu po obnovení stránky.
- [ ] Ručně vytvořený nový hráč získá jeden profil; existující profil se nezduplikuje.
- [ ] **Dva existující hráči stejného jména:** výběrem rozdílných klubů jsou ke hře přiřazena různá ID.
- [ ] **Stejné jméno bez explicitního výběru:** uživatel dostane srozumitelné upozornění.
- [ ] Při změně napsaného jména se zruší dřívější ID výběru.

Ghost a statistiky:
- [ ] Ghost 8-ball / 9-ball / 10-ball: čistě +2, BIH +1, nedohráno a break fauly podle pravidel.
- [ ] 9-ball / 10-ball: evidence koule, na níž došlo k nedohrání.
- [ ] Ghost 14.1: režim sólo proti Ghostovi, obtížnost 5/10/15/vlastní hodnota, MISS a faul přidají Ghostovi body, SAFE ne.
- [ ] Ghost a 14.1 sólo se nezapočítávají do klasických W/L, H2H ani ELO.
- [ ] Klasický zápas zvýší W/L, racky a podle výsledku upraví ELO.
- [ ] Graf hráče: odemčení po 20 dokončených zápasech proti nejméně 5 soupeřům.

Turnaje:
- [ ] Vytvoření turnaje a přidání registrovaných hráčů hledáním jména/klubu.
- [ ] Přidání neregistrovaného hosta, přihlášení, záznam zaplacení startovného.
- [ ] Spuštění turnajového zápasu: předvyplněná ID odpovídají účastníkům.
- [ ] Ruční zadání výsledku, postup SKO, DKO a výsledné pořadí včetně dělených míst.
- [ ] Oprava výsledku a dokončení turnaje zachovají historická data.

Role, cloud, zobrazení:
- [ ] Běžný hráč **nemůže smazat** cizí ani vlastní archivovaný zápas přes UI; admin může dle oprávnění.
- [ ] Přihlášení/odhlášení, neaktivní hráči a nepřístupné profily.
- [ ] Při současném připojení dvou zařízení se žádný výsledek nevymaže; po uložení je vidět aktuální stav cloudu.
- [ ] Mobil (Android Chrome + iPhone Safari): dialogy s hráči lze pohodlně rolovat, bez spodní lišty během zápasu.
- [ ] Livescore: správná jména, skóre, název zápasu a ukončení.
- [ ] Stream overlay a shot clock fungují.
- [ ] Po vyzkoušení je možné bezpečně vrátit původní verzi, pokud se objeví regrese.

## Další etapy (zatím nenaprogramováno)

1. **Turnajový průvodce**: údaje → prezence → rozlosování, pokročilá nastavení podle formátu.
2. **Společný komponent hráčů** pro zápasy, ligu a turnaje bez násobení seznamů.
3. **Testovací Firebase projekt** a automatické browser E2E testy reálného uložení, obnovení, oprávnění a statistik.
4. **Mobilní ovládání zápasu**: kontextová tlačítka podle fáze hry, přehlednější opravy a undo.
5. **Synchronizace**: méně časté celé čtení /appData, detekce změn, řešení konfliktů.
6. **Rozdělení monolitického index.html** do modulů a jednotné verzování webu a mobilní aplikace.

## Omezení automatických smoke testů

Smoke testy kontrolují syntaxi inline skriptů, přítomnost důležitých formulářů a vybraná pravidla, a izolovaně testují resolver hráčských profilů. **Nejsou to browser testy a nepotvrzují správnost všech stavů herního enginu ani serverových Firebase Rules.**
