
/* Separate setup UI – include 14.1 Ghost alongside rack Ghost disciplines. */
(function(){
  const get=id=>document.getElementById(id);
  const screen=get('screen-setup');
  if(!screen||!get('setupGhostBtn'))return;
  let mode='standard';
  const syncGhost=()=>{
    const is14=get('discipline').value==='14.1';
    screen.classList.toggle('setup-ghost14',is14);
    if(get('counterMode').value!=='full'){
      get('counterMode').value='full';
      get('counterMode').dispatchEvent(new Event('change',{bubbles:true}));
    }
    get('solo14').checked=is14;
    get('solo14GhostMode').checked=is14;
    get('ghostMode').checked=true;
    get('ghostMode').dispatchEvent(new Event('change',{bubbles:true}));
    get('p2Name').value='';
    get('useLag').checked=false;
    get('p1Label').textContent='Hráč';
    get('setupModeHint').textContent=is14
      ? '14.1 proti Ghostovi: nastav cílové skóre a obtížnost. Za MISS nebo faul Ghost získává body, za SAFE nikoliv.'
      : 'Trénink jednoho hráče proti Ghostovi. Výsledky se vedou odděleně od klasických zápasů.';
    get('startMatch').textContent='ZAHÁJIT GHOST TRÉNINK';
  };
  const setMode=next=>{
    mode=next;
    const ghost=next==='ghost';
    screen.classList.toggle('setup-ghost',ghost);
    screen.classList.toggle('setup-compact',!ghost);
    screen.classList.remove('setup-expanded');
    screen.classList.toggle('setup-ghost14',ghost&&get('discipline').value==='14.1');
    get('setupMoreBtn').setAttribute('aria-expanded','false');
    get('setupMoreBtn').textContent='⚙ Další nastavení ▾';
    get('setupStandardBtn').classList.toggle('primary',!ghost);
    get('setupGhostBtn').classList.toggle('primary',ghost);
    get('setupStandardBtn').setAttribute('aria-pressed',String(!ghost));
    get('setupGhostBtn').setAttribute('aria-pressed',String(ghost));
    get('setupMainTitle').textContent=ghost?'Ghost trénink':'Nový zápas';
    if(ghost){
      syncGhost();
    }else{
      get('solo14GhostMode').checked=false;
      get('solo14').checked=false;
      get('ghostMode').checked=false;
      get('ghostMode').dispatchEvent(new Event('change',{bubbles:true}));
      get('p1Label').textContent='Hráč 1';
      get('setupModeHint').textContent='Zápas dvou hráčů. Další možnosti najdeš v pokročilém nastavení.';
      get('startMatch').textContent='ZAHÁJIT ZÁPAS';
    }
  };
  get('setupStandardBtn').addEventListener('click',()=>setMode('standard'));
  get('setupGhostBtn').addEventListener('click',()=>setMode('ghost'));
  get('setupMoreBtn').addEventListener('click',()=>{
    const open=screen.classList.toggle('setup-expanded');
    get('setupMoreBtn').setAttribute('aria-expanded',String(open));
    get('setupMoreBtn').textContent=open?'⚙ Skrýt další nastavení ▴':'⚙ Další nastavení ▾';
  });
  get('discipline').addEventListener('change',()=>{
    if(mode==='ghost')syncGhost();
  });
  screen.classList.add('setup-compact');
})();
