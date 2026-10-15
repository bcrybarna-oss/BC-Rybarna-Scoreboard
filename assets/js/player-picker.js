
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const dialog=$('poolPlayerPickerDialog');
  const search=$('poolPlayerPickerSearch');
  const results=$('poolPlayerPickerResults');
  const count=$('poolPlayerPickerCount');
  const manual=$('poolPlayerPickerManual');
  if(!dialog||!search||!results)return;
  let kind='',target=null,items=[],previousFocus=null,previousOverflow='';
  const normalize=value=>String(value||'').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs').trim();
  const emitChange=el=>{
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const hide=()=>{
    dialog.classList.remove('show');
    dialog.setAttribute('aria-hidden','true');
    document.body.style.overflow=previousOverflow;
    kind='';target=null;items=[];
    if(previousFocus && previousFocus.isConnected && !previousFocus.disabled){
      try{previousFocus.focus({preventScroll:true});}catch(e){}
    }
    previousFocus=null;
  };
  const choose=selection=>{
    const value=typeof selection==='object' && selection ? selection.value : selection;
    if(kind==='match' && target && !target.disabled && !target.readOnly){
      target.value=value;
      target.dataset.selectedPlayerId=selection?.id||'';
      target.dataset.selectedPlayerName=selection?.id ? String(value) : '';
      emitChange(target);
    }else if(kind==='tournament'){
      const select=$('tournamentPlayerDropdown');
      if(!select || select.disabled || !$('addTournamentPlayerBtn') || $('addTournamentPlayerBtn').disabled)return;
      select.value=value;
      if(select.value!==value)return;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      hide();
      $('addTournamentPlayerBtn').click();
      return;
    }
    hide();
  };
  const render=()=>{
    const q=normalize(search.value);
    const terms=q.split(/\s+/).filter(Boolean);
    const filtered=items.filter(p=>terms.every(t=>normalize(p.label).includes(t)));
    const shown=filtered.slice(0,80);
    results.replaceChildren();
    for(const item of shown){
      const button=document.createElement('button');
      button.type='button';
      button.className='pool-player-picker-row';
      button.setAttribute('role','option');
      button.setAttribute('aria-selected','false');
      const name=document.createElement('span');
      name.textContent=item.label;
      const arrow=document.createElement('span');
      arrow.className='pick-arrow';
      arrow.textContent='›';
      arrow.setAttribute('aria-hidden','true');
      button.append(name,arrow);
      button.addEventListener('click',()=>choose(item));
      results.appendChild(button);
    }
    if(!shown.length){
      const empty=document.createElement('div');
      empty.className='pool-player-picker-empty';
      empty.textContent=q?'Žádný hráč neodpovídá hledání.':'Seznam hráčů je zatím prázdný.';
      results.appendChild(empty);
    }
    count.textContent=filtered.length+' hráčů'+(filtered.length>80?' · zobrazeno prvních 80, upřesni hledání':'');
    const allowManual=kind==='match' && search.value.trim().length>0;
    manual.classList.toggle('hidden',!allowManual);
    manual.textContent=allowManual?'POUŽÍT JMÉNO: '+search.value.trim():'POUŽÍT ZADANÉ JMÉNO';
  };
  const open=(type,el)=>{
    if(!el || el.disabled || el.readOnly)return;
    previousFocus=document.activeElement;
    previousOverflow=document.body.style.overflow;
    kind=type;target=el;
    if(type==='tournament'){
      const options=Array.from(el.options).filter(o=>o.value);
      items=options.map(o=>({value:o.value,label:o.textContent.trim()}));
      $('poolPlayerPickerHeading').textContent='Přidat hráče do turnaje';
      $('poolPlayerPickerHint').textContent='Vyhledej hráče podle jména nebo klubu. Výběrem se rovnou přidá do prezence.';
      search.value='';
      search.placeholder='Hledat jméno nebo klub...';
    }else{
      if(typeof window.poolMatchPickerPlayers==='function'){
        items=window.poolMatchPickerPlayers();
      }else{
        const dl=$('playersList');
        const values=dl?Array.from(dl.options).map(o=>o.value).filter(Boolean):[];
        items=Array.from(new Set(values)).map(value=>({value,label:value}));
      }
      $('poolPlayerPickerHeading').textContent='Vybrat hráče do zápasu';
      $('poolPlayerPickerHint').textContent='Vyber hráče ze seznamu, nebo napiš nové jméno. Ruční zadání zůstává možné i přímo v zápase.';
      search.value=el.value||'';
      search.placeholder='Hledat hráče podle jména...';
    }
    dialog.classList.add('show');
    dialog.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    render();
    try{search.focus({preventScroll:true});search.select();}catch(e){}
  };
  // Původní datalist funguje různě v Androidu/iOS. U zápasových hráčů
  // ho nahrazujeme vlastním výběrem, ale textový vstup zůstává editovatelný.
  for(const input of document.querySelectorAll('#screen-setup input[list="playersList"]')){
    if(input.dataset.playerPickerReady==='1')continue;
    input.dataset.playerPickerReady='1';
    input.addEventListener('input',()=>{
      if(input.dataset.selectedPlayerName!==input.value.trim()){
        delete input.dataset.selectedPlayerId;
        delete input.dataset.selectedPlayerName;
      }
    });
    input.removeAttribute('list');

    const wrapper=document.createElement('div');
    wrapper.className='match-player-entry';
    input.parentNode.insertBefore(wrapper,input);
    wrapper.appendChild(input);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='btn match-player-pick-btn';
    btn.textContent='⌕ VYBRAT';
    btn.setAttribute('aria-label','Vybrat hráče ze seznamu');
    btn.addEventListener('click',()=>open('match',input));
    wrapper.appendChild(btn);
  }
  // Turnajový select ponecháváme jako zdroj hodnot a pro existující logiku
  // přidávání. Zobrazujeme ale vyhledávací výběr místo dlouhého selectu.
  const select=$('tournamentPlayerDropdown');
  if(select){
    select.setAttribute('aria-hidden','true');
    select.tabIndex=-1;
    const btn=document.createElement('button');
    btn.id='tournamentPlayerChooseBtn';
    btn.type='button';
    btn.className='btn';
    btn.textContent='⌕ VYHLEDAT A PŘIDAT HRÁČE';
    select.insertAdjacentElement('afterend',btn);
    btn.addEventListener('click',()=>open('tournament',select));
    const syncDisabled=()=>{btn.disabled=select.disabled;};
    new MutationObserver(syncDisabled).observe(select,{attributes:true,attributeFilter:['disabled']});
    syncDisabled();
  }
  $('poolPlayerPickerClose').addEventListener('click',hide);
  dialog.addEventListener('click',e=>{if(e.target===dialog)hide();});
  document.addEventListener('keydown',e=>{
    if(!dialog.classList.contains('show'))return;
    if(e.key==='Escape'){e.preventDefault();hide();}
    if(e.key==='Enter' && document.activeElement===search){
      e.preventDefault();
      const q=normalize(search.value);
      const exact=items.find(p=>normalize(p.label)===q);
      if(exact)choose(exact);
      else if(kind==='match' && search.value.trim())choose(search.value.trim());
      else if(results.querySelectorAll('button').length===1)results.querySelector('button').click();
    }
  });
  search.addEventListener('input',render);
  manual.addEventListener('click',()=>{
    if(kind==='match' && search.value.trim())choose(search.value.trim());
  });
})();
