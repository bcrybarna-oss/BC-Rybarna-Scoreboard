'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const baseline = process.env.ORDINARY_BASELINE === '1';
const main = '49deb97589316c09695669250fd6927776d4a907';
const source = baseline
  ? execFileSync('git', ['show', main + ':index.html'], { cwd: root, encoding: 'utf8', maxBuffer: 10e6 })
  : fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const out = path.resolve(process.env.ORDINARY_OUT || 'output/ordinary-tournament-115');
fs.mkdirSync(out, { recursive: true });
const host = 'https://ordinary-tournament.local';
const draftKey = 'bcRybarnaTournamentCheckinDraft_v1';
const players = Object.fromEntries(Array.from({ length: 6 }, (_, i) => {
  const id = 'p' + (i + 1);
  return [id, { id, name: 'Hráč ' + (i + 1), active: true }];
}));
const hook = `
window.ordinaryProbe = {
  start(players){
    clearRuntimeCloudIdentity();
    data = defaultData();
    data.players = players;
    cloudUid = 'isolated-owner';
    cloudAuthenticated = true;
    cloudEmailVerified = true;
    cloudIdToken = 'mock';
    cloudTokenExpiresAt = Date.now()+3600000;
    currentUserRole = 'system_admin';
    document.querySelector('#cloudLoginModal').classList.remove('show');
    showScreen('tournament');
  },
  state(){return {ids:tournamentSelectedPlayerIds,paid:tournamentPaidPlayerIds(),closed:tournamentCheckinClosed,tournaments:data.tournaments};},
  reload(){return loadSecureTournaments();}
};`;
const html = source.replace(/(<script>\s*\(\(\) => \{)([\s\S]*?)(\}\)\(\);\s*<\/script>)/,
  (_, a, b, c) => a + b + hook + c);
assert.ok(html.includes('window.ordinaryProbe'));

function storageProbe(mode){
  const storage = localStorage;
  const originals = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(name => [name, Storage.prototype[name]]));
  originals.setItem.call(storage, 'isolated-sentinel', 'preserve');
  window.storageMode = mode;
  window.storageFailures = [];
  for(const [name, original] of Object.entries(originals)){
    Storage.prototype[name] = function(...args){
      if(this === storage && (window.storageMode === 'denied' || (window.storageMode === 'full' && name === 'setItem'))){
        const error = window.storageMode === 'denied' ? 'SecurityError' : 'QuotaExceededError';
        window.storageFailures.push({name, key:args[0], error});
        throw new DOMException('Isolated storage failure', error);
      }
      return original.apply(this, args);
    };
  }
}

function firebase(value){
  if(value == null || typeof value !== 'object')return value ?? null;
  const entries = Object.entries(value).map(([k, v]) => [k, firebase(v)]).filter(([, v]) => v !== null);
  if(!entries.length)return null;
  return Array.isArray(value) ? Object.assign([], Object.fromEntries(entries)) : Object.fromEntries(entries);
}

async function client(browser, width, mode){
  const context = await browser.newContext({ serviceWorkers:'block', viewport:{width,height:width < 600 ? 844 : 1000} });
  await context.addInitScript(storageProbe, mode);
  const db = new Map();
  const requests = [], errors = [];
  const network = { failPut:false, failGet:false, holdPut:null };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if(url.origin === host){
      if(url.pathname === '/')return route.fulfill({contentType:'text/html',body:html});
      const file = path.resolve(root, '.' + url.pathname);
      if(file.startsWith(root + path.sep) && fs.existsSync(file)){
        return route.fulfill({path:file,contentType:file.endsWith('.js') ? 'application/javascript' : undefined});
      }
    }
    if(!/firebaseio|firebasedatabase/.test(url.hostname))return route.abort();
    const method = request.method(), key = url.pathname;
    const id = /^\/tournaments\/([^/]+)\.json$/.exec(key)?.[1];
    if(id){
      requests.push({method,id});
      if(method === 'PUT'){
        if(network.holdPut)await network.holdPut;
        if(network.failPut)return route.fulfill({status:503,body:'isolated write failure'});
        db.set(id, firebase(request.postDataJSON()));
        return route.fulfill({json:db.get(id)});
      }
      if(method === 'GET'){
        if(network.failGet)return route.fulfill({status:503,body:'isolated read failure'});
        return route.fulfill({json:db.get(id) ?? null});
      }
    }
    if(method !== 'GET')return route.fulfill({json:null});
    return route.fulfill({json:key === '/players.json' ? players : key === '/tournaments.json' ? Object.fromEntries(db) : null});
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  async function open(){
    await page.locator('#cloudLoginModal.show').waitFor();
    await page.evaluate(({players, mode}) => {
      window.storageMode = mode;
      ordinaryProbe.start(players);
    }, {players, mode});
    await page.locator('#tournamentHubCreateBtn').click();
  }
  await page.goto(host);
  await open();
  return {page,context,db,requests,errors,network,open};
}

async function add(page, count = 4){
  for(let i = 1; i <= count; i++){
    await page.locator('#tournamentPlayerChooseBtn').click();
    await page.getByRole('option', {name:new RegExp('Hráč ' + i)}).click();
  }
}

async function closeCheckin(page){
  await page.locator('#tournamentMarkAllPaidBtn').click();
  await page.locator('#tournamentCloseCheckinBtn').click();
}

async function baselineChecks(browser){
  for(const [mode, failPut] of [['normal',false], ['full',false], ['denied',false], ['denied',true]]){
    const h = await client(browser, 390, mode);
    try{
      const {page, db, network, requests} = h;
      const button = page.locator('#createTournamentBtn');
      assert.equal(await button.isDisabled(), true);
      await add(page);
      assert.equal(await button.isDisabled(), true);
      assert.equal(requests.length, 0);
      await page.locator('#tournamentName').fill('Izolovaný turnaj');
      const warning = await page.locator('#tournamentDraftStorageWarning').innerText();
      assert.equal(warning.includes('pouze v paměti'), mode !== 'normal');
      if(mode === 'full'){
        await button.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,'baseline-mobile.png')});
      }
      await page.locator('#tournamentHubBackBtn').click();
      await page.locator('#tournamentHubCreateBtn').click();
      assert.equal(await page.locator('#tournamentName').inputValue(), 'Izolovaný turnaj');
      await page.reload();
      await h.open();
      assert.equal((await page.evaluate(() => ordinaryProbe.state().ids)).length, mode === 'normal' ? 4 : 0);
      if(mode !== 'normal')await add(page);
      await closeCheckin(page);
      assert.equal(await button.isEnabled(), true);
      network.failPut = failPut;
      await button.click();
      if(network.failPut){
        await page.waitForFunction(() => ordinaryProbe.state().tournaments.length === 1);
        assert.equal(db.size, 0);
        assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().ids), []);
        assert.equal(await button.isDisabled(), true);
      }else{
        await page.locator('#screen-tournament-detail.active').waitFor();
        assert.equal(db.size, 1);
      }
      assert.deepEqual(requests.map(x => x.method), ['PUT']);
      assert.deepEqual(h.errors, []);
      console.log('BASELINE', mode, 'open disabled, closed dispatches PUT', network.failPut ? 'failed PUT clears draft and leaves local tournament' : 'save opens detail');
    }finally{
      await h.context.close();
    }
  }
}

async function candidateChecks(browser){
  const cases = [
    {width:390, mode:'full', format:'sko', seed:'random', failure:'put'},
    {width:1440, mode:'normal', format:'dko', seed:'manual', failure:'get'},
    {width:320, mode:'denied', format:'groups_sko', seed:'draw'},
    {width:390, mode:'normal', format:'groups_dko', seed:'draw_individual'},
    {width:1440, mode:'normal', format:'groups', seed:'elo'},
    {width:390, mode:'normal', format:'swiss', seed:'random'}
  ];
  for(const {width, mode, format, seed, failure} of cases){
    const h = await client(browser, width, mode);
    try{
      const {page, db, network, requests} = h;
      const button = page.locator('#createTournamentBtn');
      const feedback = page.locator('#tournamentCreateFeedback');
      const warning = page.locator('#tournamentDraftStorageWarning');
      await page.locator('#tournamentFormat').selectOption(format);
      await page.locator('#tournamentSeedingMode').selectOption(seed);
      await button.click();
      assert.match(await feedback.innerText(), /Nejdřív přidej hráče/);
      await add(page, 2);
      await button.click();
      assert.match(await feedback.innerText(), /Označ zaplacené hráče a uzavři prezenci/);
      assert.equal(requests.length, 0);
      if(width === 1440 && failure === 'get'){
        await page.evaluate(() => {window.storageMode = 'full';});
        await page.locator('#tournamentName').dispatchEvent('change');
        await button.click();
        await page.screenshot({path:path.join(out,'candidate-desktop.png')});
        await page.evaluate(() => {window.storageMode = 'normal';});
      }

      if(mode === 'full' || mode === 'denied'){
        assert.match(await warning.innerText(), /pouze v paměti/);
        const layout = await page.evaluate(() => {
          const box = id => document.getElementById(id).getBoundingClientRect().toJSON();
          return {button:box('createTournamentBtn'),feedback:box('tournamentCreateFeedback'),
            warning:box('tournamentDraftStorageWarning'),width:innerWidth,scroll:document.documentElement.scrollWidth};
        });
        assert.ok(layout.button.height >= 44);
        assert.ok(layout.feedback.top >= layout.button.bottom);
        assert.ok(layout.warning.top >= layout.feedback.bottom);
        assert.ok(layout.warning.right <= layout.width);
        assert.ok(layout.scroll <= layout.width, JSON.stringify(layout));
        assert.ok(layout.warning.bottom <= 844 - 70, JSON.stringify(layout));
        await page.screenshot({path:path.join(out,'candidate-mobile-'+width+'.png')});

        await page.locator('#tournamentName').fill('Příprava v paměti');
        await page.locator('#tournamentHubBackBtn').click();
        await page.locator('#tournamentHubCreateBtn').click();
        assert.equal(await page.locator('#tournamentName').inputValue(), 'Příprava v paměti');
        assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().ids), ['p1','p2']);
        await page.evaluate(() => {window.storageMode = 'normal';});
        await page.locator('#tournamentName').fill('Uložitelná příprava');
        assert.equal(await warning.textContent(), '');
        await page.evaluate(mode => {window.storageMode = mode;}, mode);
      }
      await closeCheckin(page);
      if(format === 'sko'){
        await button.click();
        assert.match(await feedback.innerText(), /alespoň 4 zaplacené hráče/);
        assert.equal(requests.length, 0);
      }
      await page.locator('#tournamentReopenCheckinBtn').click();
      await button.click();
      assert.match(await feedback.innerText(), /uzavři prezenci/);
      for(const i of [3,4]){
        await page.locator('#tournamentPlayerChooseBtn').click();
        await page.getByRole('option', {name:new RegExp('Hráč ' + i)}).click();
      }
      await closeCheckin(page);
      assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().paid), ['p1','p2','p3','p4']);

      if(seed.startsWith('draw')){
        await button.click();
        assert.match(await feedback.innerText(), /Nejdřív vylosuj čísla/);
        assert.equal(requests.length, 0);
        if(seed === 'draw')await page.getByRole('button', {name:/VYLOSOVAT ČÍSLA/}).click();
        else for(let i=0;i<4;i++)await page.getByRole('button', {name:/🎲 LOSOVAT$/}).first().click();
      }
      await page.locator('#tournamentName').fill('Izolovaný turnaj ' + format);
      let releasePut;
      network.holdPut = new Promise(resolve => {releasePut=resolve;});
      network.failPut = failure === 'put';
      network.failGet = failure === 'get';
      const firstPut = page.waitForRequest(r => r.method()==='PUT' && /\/tournaments\/[^/]+\.json/.test(new URL(r.url()).pathname));
      await button.evaluate(btn => {btn.click();btn.click();});
      await firstPut;
      assert.equal(await button.isDisabled(), true);
      assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().tournaments), []);
      releasePut();
      network.holdPut=null;
      if(failure){
        await page.waitForFunction(() => !document.getElementById('createTournamentBtn').disabled);
        assert.match(await feedback.innerText(), failure === 'put' ? /Zápis turnaje.*nepodařil/ : /nepodařilo ověřit/);
        assert.doesNotMatch(await feedback.innerText(), /uložen a ověřen/);
        assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().ids), ['p1','p2','p3','p4']);
        assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().tournaments), []);
        const firstId = requests[0].id;
        if(failure === 'get'){
          assert.equal(db.size, 1);
          const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), draftKey);
          assert.equal(stored.creation.tournament.id, firstId);
          await page.reload();
          await h.open();
          assert.match(await feedback.innerText(), /čeká na ověření/);
          assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().ids), ['p1','p2','p3','p4']);
        }
        network.failPut=false;
        network.failGet=false;
        await button.click();
      }
      await page.locator('#screen-tournament-detail.active').waitFor();
      assert.equal(db.size, 1);
      assert.equal(new Set(requests.map(x=>x.id)).size, 1);
      assert.deepEqual(requests.map(x=>x.method), failure === 'put' ? ['PUT','GET','PUT','GET'] : failure === 'get' ? ['PUT','GET','GET'] : ['PUT','GET']);
      const saved = [...db.values()][0];
      assert.equal(saved.format,format);
      assert.equal(saved.seedingMode,seed);
      assert.deepEqual([...saved.playerIds].sort(),['p1','p2','p3','p4']);
      if(seed.startsWith('draw'))assert.deepEqual(Object.values(saved.drawNumbers).sort(), [1,2,3,4]);
      await page.reload();
      await h.open();
      assert.deepEqual(await page.evaluate(() => ordinaryProbe.state().ids), []);
      await page.evaluate(() => ordinaryProbe.reload());
      assert.equal(await page.evaluate(() => ordinaryProbe.state().tournaments.length), 1);
      assert.equal(await page.evaluate(() => {window.storageMode='normal';return localStorage.getItem('isolated-sentinel');}), 'preserve');
      assert.deepEqual(h.errors, []);
      console.log('PASS', width, mode, format, seed, failure || 'verified PUT/GET');
    }finally{
      await h.context.close();
    }
  }
}

(async () => {
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try{
    await (baseline ? baselineChecks(browser) : candidateChecks(browser));
  }finally{
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
