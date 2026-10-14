
  (function(){
    const THEME_KEY='bcRybarnaTheme';
    function savedTheme(){
      try{return localStorage.getItem(THEME_KEY)==='light'?'light':'dark';}
      catch(e){return 'dark';}
    }
    function applyTheme(theme){
      const value=theme==='light'?'light':'dark';
      document.documentElement.setAttribute('data-theme',value);
      const btn=document.getElementById('themeToggleBtn');
      if(btn){
        btn.textContent=value==='light'?'🌙 TMAVÝ MÓD':'☀ SVĚTLÝ MÓD';
        btn.title=value==='light'?'Přepnout na tmavý režim':'Přepnout na světlý režim';
      }
    }
    applyTheme(savedTheme());
    window.bcApplyTheme=applyTheme;
    document.addEventListener('DOMContentLoaded',()=>{
      applyTheme(savedTheme());
      const btn=document.getElementById('themeToggleBtn');
      if(btn){
        btn.addEventListener('click',()=>{
          const current=document.documentElement.getAttribute('data-theme')||'dark';
          const next=current==='light'?'dark':'light';
          try{localStorage.setItem(THEME_KEY,next);}catch(e){}
          applyTheme(next);
        });
      }
    });
  })();
