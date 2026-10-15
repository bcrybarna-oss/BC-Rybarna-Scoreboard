
(function(){
  function setTournamentTopView(view){
    var createPanel=document.getElementById('tournamentCreatePanel');
    var seriesPanel=document.getElementById('tournamentSeriesPanel');
    var createBtn=document.getElementById('tournamentCreateTabBtn');
    var seriesBtn=document.getElementById('tournamentSeriesTabBtn');
    if(!createPanel || !seriesPanel) return;
    var showSeries=view==='series';
    createPanel.classList.toggle('hidden',showSeries);
    seriesPanel.classList.toggle('hidden',!showSeries);
    if(createBtn){
      createBtn.classList.toggle('primary',!showSeries);
    }
    if(seriesBtn){
      seriesBtn.classList.toggle('primary',showSeries);
    }
    try{ localStorage.setItem('bcTournamentTopView',showSeries?'series':'create'); }catch(e){}
  }
  document.addEventListener('DOMContentLoaded',function(){
    var createBtn=document.getElementById('tournamentCreateTabBtn');
    var seriesBtn=document.getElementById('tournamentSeriesTabBtn');
    if(createBtn) createBtn.addEventListener('click',function(){ setTournamentTopView('create'); });
    if(seriesBtn) seriesBtn.addEventListener('click',function(){ setTournamentTopView('series'); });
    var saved='create';
    try{ saved=localStorage.getItem('bcTournamentTopView')||'create'; }catch(e){}
    setTournamentTopView(saved==='series'?'series':'create');
  });


})();
