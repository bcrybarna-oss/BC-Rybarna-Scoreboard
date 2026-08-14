#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "BC Rybárna Scoreboard - příprava mobilní aplikace"
node -v
npm -v
npm install
if [ ! -d "ios" ]; then npx cap add ios; fi
if [ ! -d "android" ]; then npx cap add android; fi
npx cap sync
echo
echo "HOTOVO"
echo "iOS: npm run ios"
echo "Android: npm run android"
