@echo off
cd /d %~dp0
echo BC Rybarna Scoreboard - priprava mobilni aplikace
node -v
npm -v
call npm install
if errorlevel 1 goto error
if not exist ios call npx cap add ios
if not exist android call npx cap add android
call npx cap sync
if errorlevel 1 goto error
echo HOTOVO
echo Android: npm run android
echo iOS se finalne sestavuje na Macu v Xcode.
pause
exit /b 0
:error
echo Instalace se nepodarila. Zkontroluj Node.js a internet.
pause
exit /b 1
