# BC Rybárna Scoreboard Mobile v2.2

Mobilní projekt pro iOS a Android postavený na Capacitoru 8.

## Obsah
- `www/index.html` – kompletní Scoreboard
- `resources/bc-rybarna-logo.png` – originální logo
- `resources/icon-1024.png` – připravená ikona aplikace
- `capacitor.config.json`
- `package.json`
- `SETUP_MAC.command`
- `SETUP_WINDOWS.bat`

## iPhone
1. Mac s Node.js 22+ a Xcode 26+.
2. Rozbal balíček.
3. Otevři Terminal v této složce nebo spusť `SETUP_MAC.command`.
4. Po dokončení spusť `npm run ios`.
5. V Xcode nastav svůj Signing Team / Apple účet.
6. Připoj iPhone a klikni Run.

## Android
1. Node.js 22+ a Android Studio.
2. Spusť `SETUP_WINDOWS.bat` nebo `SETUP_MAC.command`.
3. Potom `npm run android`.
4. V Android Studiu vyber telefon a Run.

## Aktualizace Scoreboardu
Po výměně `www/index.html` stačí:
`npm run sync`

## Poznámka
Finální iOS build a instalace na zařízení vyžadují macOS/Xcode. Projekt samotný je připraven tak, aby se nativní složky vytvořily automaticky přes Capacitor.
