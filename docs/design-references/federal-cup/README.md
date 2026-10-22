# Federal Cup – původní vizuální reference (2026)

Tento adresář obsahuje originální grafické předlohy od zadavatele Dominika pro etapu 3B statistických reportů Poolčítadla. Předlohy jsou **vizuální reference**, nikoli hotové šablony s daty; texty, vlajky, skóre a všech 13 statistik musí v aplikaci zůstat dynamické.

Dodané originální PNG (commit 5c6ce04, ponechány beze změn):

- `A1_match_report.png` – srovnávací report konkrétního zápasu (Singles / Doubles / Team).
- `A2_national_teams.png` – celoroční srovnání reprezentací.
- `B_individual_player.png` – individuální report jednoho hráče.

## Schválené úpravy původních návrhů

- Federal Cup 2026 pořádá **Slovensko**; ve srovnávacích reportech je proto **Slovensko vlevo (červená)** a **Česko vpravo (modrá)**. Budoucí ročníky řídí explicitně určený hostitel, nikoli pořadí v poli.
- Reporty A1 a A2 používají společnou kompozici a všech **13 ukazatelů** ve čtyřech skupinách (Rozstřel, Útok, Obrana, Fauly).
- Individuální šablona B má nahoře **čtyři stejně velké karty**: Výhry, Prohry, Úspěšnost zápasů, Čisté hry. V hlavičce je jméno a vlajka, **bez slovního názvu reprezentace**.
- Cílový formát je **1920 × 1080 px**. Původní obrázky nemají být používány jako konečné dynamické podklady s napevno vloženými údaji.
- Samostatný čistý grafický podklad kulečníkového stolu s koulí č. 9 nebyl dodán; je součástí původních kompozitních obrázků. Pokud bude potřeba, musí vzniknout oddělený podklad, ne náhodně nahrazený obrázek.
- Reportovací systém a související tlačítka jsou zatím **výhradně ve Federal Cupu**.

Reference je nutné posuzovat spolu s dokumentací `docs/federal-reports-stage-3a.md`. Realizaci 3B, oddělený podklad, porovnání a exportní ukázky popisuje `docs/federal-reports-stage-3b.md`.
