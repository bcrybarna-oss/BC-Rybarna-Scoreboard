'use strict';
// Isolation adapter for the historical 9a-only consumer fixture. Assertions and PNG tolerance unchanged.
// The fixture provides cache rows but no server challenges; stop the now-extracted 9b reader before seeding.
const Module=require('module'),path=require('path'),target=path.resolve('tests/notification-center-browser.cjs'),compile=Module.prototype._compile;
Module.prototype._compile=function(source,file){if(file===target){const anchor='cache=rows;notificationOpens=0;';if(!source.includes(anchor))throw Error('Missing fixture seed anchor');source=source.replace(anchor,"if(typeof challengeReader!=='undefined')challengeReader.stop();if(typeof securePlayersReader!=='undefined')securePlayersReader.syncIdentity();cache=rows;notificationOpens=0;");source=source.replace("return route.fulfill({body:'null',contentType:'application/json'});","return route.fulfill({body:u.pathname==='/players.json'?JSON.stringify({a:{id:'a',name:'Alex A'},b:{id:'b',name:'Boris B'},op:{id:'op',name:'Opponent <script> & long name'}}):'null',contentType:'application/json'});");}return compile.call(this,source,file);};
require(target);
