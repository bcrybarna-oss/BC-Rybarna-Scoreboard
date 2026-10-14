'use strict';
// Reconstruction of v4.51.75 source for regression tests.
// Files are expanded in their original positions, not appended: script order
// and the CSS cascade are both part of the application contract.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.join(__dirname,'..');

const cssTags={
  "assets/css/base.css": "<style>",
  "assets/css/dashboard.css": "<style id=\"modern-test-dashboard-styles\">",
  "assets/css/tournament-community.css": "<style id=\"tournament-community-hub-styles\">",
  "assets/css/light-dashboard.css": "<style id=\"modern-light-mode-fix\">",
  "assets/css/theme-logo.css": "<style id=\"poolcitadlo-theme-logo-switch\">",
  "assets/css/logo-mobile.css": "<style id=\"poolcitadlo-logo-mobile-fix\">",
  "assets/css/hubs.css": "<style id=\"modern-hub-cleanup-styles\">",
  "assets/css/league-hub.css": "<style id=\"league-hub-styles\">",
  "assets/css/light-global.css": "<style id=\"global-light-mode-completion\">",
  "assets/css/light-legacy.css": "<style id=\"light-mode-history-and-legacy-panels-fix\">",
  "assets/css/historical-entry.css": "<style id=\"historical-structured-entry-styles\">",
  "assets/css/resume-state.css": "<style id=\"resume-tile-disabled-fix\">",
  "assets/css/match-challenges.css": "<style id=\"match-challenge-styles\">",
  "assets/css/scheduled-home.css": "<style id=\"scheduled-home-empty-state\">",
  "assets/css/mobile-match-nav.css": "<style id=\"mobile-nav-match-screen-visibility-fix\">",
  "assets/css/federal-cup-2026.css": "<style id=\"federal-cup-2026-styles\">",
  "assets/css/match-setup.css": "<style>",
  "assets/css/player-picker.css": "<style id=\"pool-player-picker-styles\">",
  "assets/css/winner-on-table.css": "<style id=\"winner-table-score-timeline\">",
  "assets/css/online-presence.css": "<style>"
};
const jsTags={
  'assets/js/theme.js':'<script>',
  'assets/js/pool-core.js':'<script>',
  'assets/js/tournament-navigation.js':'<script>',
  'assets/js/dashboard.js':'<script id="modern-test-dashboard-script">',
  'assets/js/tournament-community.js':'<script id="tournament-community-hub-script">',
  'assets/js/online-presence.js':'<script>',
  'assets/js/match-setup.js':'<script>',
  'assets/js/player-picker.js':'<script id="pool-player-picker-script">'
};

function fileContents(relative){
  const full=path.resolve(root,relative);
  if(!full.startsWith(root+path.sep))throw new Error('Unsafe asset path: '+relative);
  return fs.readFileSync(full,'utf8');
}
function assembleLegacyHtml(){
  const source=fileContents('index.html');
  return source
    .replace(/<link rel="stylesheet" href="(assets\/css\/[^"]+\.css)">/g,(whole,filename)=>{
      if(!Object.hasOwn(cssTags,filename))throw new Error('Unknown CSS asset '+filename);
      return cssTags[filename]+fileContents(filename)+'</style>';
    })
    .replace(/<script src="(assets\/js\/[^"]+\.js)"><\/script>/g,(whole,filename)=>{
      if(!Object.hasOwn(jsTags,filename))throw new Error('Unknown JS asset '+filename);
      return jsTags[filename]+fileContents(filename)+'</script>';
    });
}
function gitBlobSha(content){
  const contentBytes=Buffer.from(content,'utf8');
  return crypto.createHash('sha1').update('blob '+contentBytes.length+'\0').update(contentBytes).digest('hex');
}
module.exports={assembleLegacyHtml,gitBlobSha,cssTags,jsTags,fileContents};
