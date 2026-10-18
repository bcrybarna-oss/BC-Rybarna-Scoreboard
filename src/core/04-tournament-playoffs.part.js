  function playoffParticipantIds(t){
    if(t?.format==='groups_dko')return t.dko?.participantIds||[];
    if(t?.format==='groups_sko')return t.ko?.participantIds||[];
    return t?.playerIds||[];
  }

  function eliminationBand(place){
    const p=Math.max(1,Number(place||1));
    if(p<=4)return {from:p,to:p};
    let upper=8;
    while(p>upper)upper*=2;
    return {from:upper/2+1,to:upper};
  }

  function genericPlacementLabel(place){
    const p=Math.max(1,Number(place||1));
    if(p<=4)return p+'. místo';
    const r=eliminationBand(p);
    return r.from+'.–'+r.to+'. místo';
  }


  function ensureSKOState(t){
    if(!t?.ko)return null;
    const k=t.ko;

    if(!Array.isArray(k.participantIds)){
      k.participantIds=[...(t.playerIds||[])];
    }
    if(!Array.isArray(k.rounds))k.rounds=[];
    if(!Array.isArray(k.eliminatedIds))k.eliminatedIds=[];
    if(!Array.isArray(k.eliminations))k.eliminations=[];
    if(typeof k.wave!=='number')k.wave=0;
    if(k.championId===undefined)k.championId=null;
    if(k.runnerUpId===undefined)k.runnerUpId=null;
    if(k.thirdPlacePlayoff===undefined)k.thirdPlacePlayoff=!!t.thirdPlacePlayoff;
    if(k.thirdPlaceWinnerId===undefined)k.thirdPlaceWinnerId=null;
    if(k.thirdPlaceLoserId===undefined)k.thirdPlaceLoserId=null;

    return k;
  }

  function knockoutRegisterElimination(t,playerId,matchId){
    const k=ensureSKOState(t);
    if(!k)return null;
    const old=k.eliminations.find(e=>e.playerId===playerId);
    if(old)return old.place;
    const activeAfter=(k.participantIds||t.playerIds||[]).filter(id=>!k.eliminatedIds.includes(id)).length;
    const place=activeAfter+1;
    k.eliminations.push({playerId,place,matchId,at:new Date().toISOString()});
    return place;
  }

  function knockoutThirdCandidates(t){
    const k=ensureSKOState(t);
    return [...(k?.eliminations||[])]
      .filter(e=>Number(e.place||999)<=4)
      .sort((a,b)=>Number(a.place||999)-Number(b.place||999))
      .slice(0,2)
      .map(e=>e.playerId);
  }

  function knockoutThirdMatch(t){
    const k=ensureSKOState(t);
    for(const r of (k?.rounds||[])){
      const m=(r.matches||[]).find(x=>x.bracket==='3P');
      if(m)return m;
    }
    return null;
  }

  function knockoutFinalMatch(t){
    const k=ensureSKOState(t);
    for(const r of (k?.rounds||[])){
      const m=(r.matches||[]).find(x=>x.bracket==='F');
      if(m)return m;
    }
    return null;
  }

  function knockoutCreateWave(t){
    const k=ensureSKOState(t);
    if(!k || t.status==='complete')return;

    const unfinished=(k.rounds||[]).flatMap(r=>r.matches||[])
      .some(m=>m.status!=='done'&&!m.winnerId&&!m.loserId);
    if(unfinished)return;

    const active=(k.participantIds||t.playerIds||[]).filter(id=>!k.eliminatedIds.includes(id));
    if(active.length<=1){
      k.championId=active[0]||k.championId||null;
      if(k.championId && (!k.thirdPlacePlayoff || (knockoutThirdMatch(t)?.status==='done'))){
        t.status='complete';
      }
      return;
    }

    k.wave=(k.wave||0)+1;

    if(active.length===2){
      const matches=[tournamentMatchObject(active[0],active[1],'Finále','F')];
      if(k.thirdPlacePlayoff && !knockoutThirdMatch(t)){
        const bronze=knockoutThirdCandidates(t);
        if(bronze.length===2 && bronze[0]!==bronze[1]){
          matches.push(tournamentMatchObject(bronze[0],bronze[1],'Zápas o 3. místo','3P'));
        }
      }
      k.rounds.push({id:uid(),label:'Finálové zápasy',type:'FINAL',matches,byes:[]});
      return;
    }

    const matches=[],byes=[];

    // Skupiny → SKO s 8 postupujícími:
    // při ručním nasazení lze zvolit i přesné napojení QF do SF.
    // Výchozí ruční varianta je QF1×QF3 a QF2×QF4.
    const previousRound=(k.rounds||[])[k.rounds.length-1]||null;
    const previousMatches=(previousRound?.matches||[]);

    if(
      t.format==='groups_sko' &&
      k.participantIds?.length===8 &&
      active.length===4 &&
      previousMatches.length===4 &&
      previousMatches.every(m=>m.status==='done'||m.winnerId)
    ){
      const qfWinners=previousMatches.map(m=>m.winnerId).filter(Boolean);
      if(qfWinners.length===4){
        const routing=k.semifinalRouting||'cross13';
        const pairs=routing==='cross14'
          ? [[0,3],[1,2]]
          : (routing==='adjacent' ? [[0,1],[2,3]] : [[0,2],[1,3]]);

        matches.push(tournamentMatchObject(qfWinners[pairs[0][0]],qfWinners[pairs[0][1]],'Semifinále','SF'));
        matches.push(tournamentMatchObject(qfWinners[pairs[1][0]],qfWinners[pairs[1][1]],'Semifinále','SF'));
        k.rounds.push({id:uid(),label:'Semifinále',type:'KO',matches,byes:[]});
        return;
      }
    }

    const pool=[...active];
    for(let i=0;i+1<pool.length;i+=2){
      matches.push(tournamentMatchObject(pool[i],pool[i+1],'SKO • kolo '+k.wave,'KO'));
    }
    if(pool.length%2)byes.push({playerId:pool[pool.length-1],bracket:'KO'});
    k.rounds.push({id:uid(),label:'SKO • kolo '+k.wave,type:'KO',matches,byes});
  }

  function generateSKOTournament(name,playerIds,discipline,raceTo,breakMode,guests={},tableCount=1,seedingMode='random',thirdPlacePlayoff=false){
    const ids=(seedingMode==='manual' || seedingMode==='draw')
      ? [...playerIds]
      : (seedingMode==='elo'
          ? swissSeedBracketOrder(tournamentIdsSortedByElo(playerIds))
          : shuffleArray(playerIds));
    const t={
      id:uid(),createdByUid:cloudUid||'',managerUids:{},name,format:'sko',discipline,raceTo,breakMode,seedingMode,
      tableCount:Math.max(1,tableCount),createdAt:new Date().toISOString(),status:'active',
      playerIds:[...ids],guests:JSON.parse(JSON.stringify(guests)),
      ko:{participantIds:[...ids],rounds:[],wave:0,seedingMode,eliminatedIds:[],eliminations:[],championId:null,runnerUpId:null,
          thirdPlacePlayoff:!!thirdPlacePlayoff,thirdPlaceWinnerId:null,thirdPlaceLoserId:null}
    };
    knockoutCreateWave(t);
    assignTournamentTables(t);
    return t;
  }

  function groupPhaseComplete(t){
    const groupMatches=(t.groups||[]).flatMap(g=>g.matches||[]);
    return !!groupMatches.length && groupMatches.every(m=>m.status==='done'||m.winnerId||m.loserId);
  }

  function rawGroupRows(group){
    const rows=(group.players||[]).map(id=>({id,z:0,v:0,p:0,rf:0,ra:0,diff:0}));
    const map=Object.fromEntries(rows.map(r=>[r.id,r]));
    (group.matches||[]).filter(m=>m.status==='done'||m.winnerId||m.loserId).forEach(m=>{
      const a=map[m.player1Id],b=map[m.player2Id]; if(!a||!b)return;
      a.z++;b.z++;
      a.rf+=Number(m.score1||0);a.ra+=Number(m.score2||0);
      b.rf+=Number(m.score2||0);b.ra+=Number(m.score1||0);
      if(m.winnerId===a.id){a.v++;b.p++;}
      else if(m.winnerId===b.id){b.v++;a.p++;}
    });
    rows.forEach(r=>r.diff=r.rf-r.ra);
    return rows;
  }

  function groupHeadToHeadMini(group,ids){
    const idSet=new Set(ids||[]);
    const rows=(ids||[]).map(id=>({id,v:0,p:0,rf:0,ra:0,diff:0}));
    const map=Object.fromEntries(rows.map(r=>[r.id,r]));
    (group.matches||[]).filter(m=>
      (m.status==='done'||m.winnerId||m.loserId) &&
      idSet.has(m.player1Id) && idSet.has(m.player2Id)
    ).forEach(m=>{
      const a=map[m.player1Id],b=map[m.player2Id]; if(!a||!b)return;
      a.rf+=Number(m.score1||0);a.ra+=Number(m.score2||0);
      b.rf+=Number(m.score2||0);b.ra+=Number(m.score1||0);
      if(m.winnerId===a.id){a.v++;b.p++;}
      else if(m.winnerId===b.id){b.v++;a.p++;}
    });
    rows.forEach(r=>r.diff=r.rf-r.ra);
    return rows;
  }

  function unresolvedGroupPenaltyTie(t){
    if(!t?.groupPenaltyTieBreak || !groupPhaseComplete(t))return null;

    const advance=Math.max(1,Number(t.advancePerGroup||2));
    const tieRule=t.groupAdvanceTieRule||'points';
    t.groupPenaltyWinners=t.groupPenaltyWinners||{};

    for(const g of (t.groups||[])){
      const rows=rawGroupRows(g);
      const seedIndex=id=>{
        const i=(g.players||[]).indexOf(id);
        return i<0?999:i;
      };

      // Nejprve seřadíme jen podle základního kritéria bodů/výher.
      // Záměrně zde nepoužíváme skóre jako skrytý tie-break, pokud je zvoleno
      // "vzájemný zápas -> penalty".
      rows.sort((a,b)=>b.v-a.v||seedIndex(a.id)-seedIndex(b.id));

      const winValues=[...new Set(rows.map(r=>r.v))].sort((a,b)=>b-a);
      let rankStart=0;

      for(const wins of winValues){
        const cohort=rows.filter(r=>r.v===wins);
        const cohortStart=rankStart;
        const cohortEnd=rankStart+cohort.length-1;
        rankStart+=cohort.length;

        // Kolik míst z této shodné skupiny ještě leží v postupové části?
        const qualifyingSlots=Math.max(
          0,
          Math.min(cohortEnd,advance-1)-cohortStart+1
        );
        if(qualifyingSlots<=0 || cohort.length<=1)continue;

        let tiedIds=cohort.map(r=>r.id);

        if(tieRule==='head_to_head'){
          const mini=groupHeadToHeadMini(g,tiedIds);

          // Rozdělíme hráče podle počtu výher ve vzájemných zápasech.
          // Každou stále nerozhodnutou podskupinu posuzujeme samostatně.
          const byMiniWins=new Map();
          mini.forEach(r=>{
            if(!byMiniWins.has(r.v))byMiniWins.set(r.v,[]);
            byMiniWins.get(r.v).push(r.id);
          });

          const miniWinValues=[...byMiniWins.keys()].sort((a,b)=>b-a);
          let miniRankOffset=0;

          for(const miniWins of miniWinValues){
            const subgroup=byMiniWins.get(miniWins);
            const subgroupStart=cohortStart+miniRankOffset;
            const subgroupEnd=subgroupStart+subgroup.length-1;
            miniRankOffset+=subgroup.length;

            const subgroupQualifyingSlots=Math.max(
              0,
              Math.min(subgroupEnd,advance-1)-subgroupStart+1
            );

            if(subgroupQualifyingSlots<=0 || subgroup.length<=1)continue;

            // Penalty musí určit nejen posledního postupujícího, ale i pořadí
            // postupujících pro nasazení do pavouka.
            //
            // Příklad: 3 hráči jsou shodně na 2.–4. místě a všichni postupují.
            // Pro přesné nasazení je potřeba určit 1. a 2. hráče z této trojice;
            // třetí pořadí pak vznikne automaticky.
            const selectionsNeeded=Math.min(
              subgroup.length-1,
              subgroupQualifyingSlots
            );

            const already=(t.groupPenaltyWinners[g.id]||[])
              .filter(id=>subgroup.includes(id));

            if(already.length>=selectionsNeeded)continue;

            const candidates=subgroup.filter(id=>!already.includes(id));

            return {
              groupId:g.id,
              group:g,
              candidates,
              tiedIds:subgroup,
              slotsNeeded:selectionsNeeded,
              alreadySelected:already,
              selectionNumber:already.length+1,
              tieRule,
              seedingTie:true
            };
          }

          continue;
        }

        // Varianta "body / skóre": pokud skóre stále nerozhodne, mohou následovat penalty.
        const byScore=new Map();
        cohort.forEach(r=>{
          const key=`${r.diff}|${r.rf}`;
          if(!byScore.has(key))byScore.set(key,[]);
          byScore.get(key).push(r.id);
        });

        let scoreOffset=0;
        const scoreGroups=[...byScore.entries()]
          .map(([key,ids])=>{
            const [diff,rf]=key.split('|').map(Number);
            return {diff,rf,ids};
          })
          .sort((a,b)=>b.diff-a.diff||b.rf-a.rf);

        for(const sg of scoreGroups){
          const subgroup=sg.ids;
          const subgroupStart=cohortStart+scoreOffset;
          const subgroupEnd=subgroupStart+subgroup.length-1;
          scoreOffset+=subgroup.length;

          const subgroupQualifyingSlots=Math.max(
            0,
            Math.min(subgroupEnd,advance-1)-subgroupStart+1
          );
          if(subgroupQualifyingSlots<=0 || subgroup.length<=1)continue;

          const selectionsNeeded=Math.min(
            subgroup.length-1,
            subgroupQualifyingSlots
          );

          const already=(t.groupPenaltyWinners[g.id]||[])
            .filter(id=>subgroup.includes(id));

          if(already.length>=selectionsNeeded)continue;

          return {
            groupId:g.id,
            group:g,
            candidates:subgroup.filter(id=>!already.includes(id)),
            tiedIds:subgroup,
            slotsNeeded:selectionsNeeded,
            alreadySelected:already,
            selectionNumber:already.length+1,
            tieRule,
            seedingTie:true
          };
        }
      }
    }

    return null;
  }

  function groupPenaltyTiesResolved(t){
    return !unresolvedGroupPenaltyTie(t);
  }

  let activeGroupPenaltyContext=null;

  function openGroupPenaltyPrompt(t){
    const ctx=unresolvedGroupPenaltyTie(t);
    if(!ctx)return false;

    activeGroupPenaltyContext={tournamentId:t.id,...ctx};
    $('groupPenaltyTitle').textContent='Skupina '+ctx.groupId+' • rozhodnutí o postupu';
    $('groupPenaltyHelp').textContent=
      (ctx.tieRule==='head_to_head'
        ? 'Vzájemné zápasy nerozhodly o pořadí. '
        : 'Zvolené kritérium nerozhodlo o pořadí. ')+
      (ctx.seedingTie
        ? 'Penalty nyní určí pořadí hráčů pro nasazení do play-off. '
        : '')+
      'Vyber vítěze penalt'+
      (ctx.slotsNeeded>1 ? ' • krok '+ctx.selectionNumber+' z '+ctx.slotsNeeded+'.' : '.');

    $('groupPenaltyPlayers').innerHTML=ctx.candidates.map(id=>`
      <button class="btn primary big" onclick="selectGroupPenaltyWinner('${t.id}','${ctx.groupId}','${id}')">
        ${esc(tournamentPlayerName(id,t))}
      </button>
    `).join('');

    $('groupPenaltyModal').classList.add('show');
    return true;
  }

  window.selectGroupPenaltyWinner=async function(tournamentId,groupId,playerId){
    let t=(data.tournaments||[]).find(x=>x.id===tournamentId);
    if(!t||!canManageTournament(t))return;

    t.groupPenaltyWinners=t.groupPenaltyWinners||{};
    t.groupPenaltyWinners[groupId]=t.groupPenaltyWinners[groupId]||[];
    if(!t.groupPenaltyWinners[groupId].includes(playerId)){
      t.groupPenaltyWinners[groupId].push(playerId);
    }
    t.updatedAt=new Date().toISOString();

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Penalty winner save:',e);
      toast('Výsledek penalt se nepodařilo uložit.');
      return;
    }

    $('groupPenaltyModal').classList.remove('show');

    const next=unresolvedGroupPenaltyTie(t);
    if(next){
      openGroupPenaltyPrompt(t);
      return;
    }

    if(t.format==='groups'){
      t.status='complete';
    }else if(!t.playoffStarted){
      startHybridPlayoff(t);
    }

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Penalty playoff save:',e);
      toast('Penalty jsou uložené, ale navazující pavouk se nepodařilo uložit.');
    }

    renderTournament();
    renderTournamentDetail();
    toast('Penalty rozhodnuty • postupující byli zařazeni do pavouka.');
  };

  function groupPlayoffSeeds(t){
    const advance=Math.max(1,Number(t.advancePerGroup||2));
    const qualifiers=[];
    (t.groups||[]).forEach((g,gi)=>{
      const st=groupStandings(g,t);
      st.slice(0,advance).forEach((r,pos)=>qualifiers.push({id:r.id,group:g.id,pos:pos+1,gi}));
    });
    qualifiers.sort((a,b)=>a.pos-b.pos||a.gi-b.gi);

    // High vs low seed, with a simple swap to avoid same-group rematch in first playoff round.
    const out=[];
    const remaining=[...qualifiers];
    while(remaining.length){
      const a=remaining.shift();
      if(!remaining.length){out.push(a);break;}
      let idx=remaining.length-1;
      if(remaining[idx].group===a.group){
        const alt=remaining.findIndex((x,i)=>i>=Math.floor(remaining.length/2)&&x.group!==a.group);
        if(alt>=0)idx=alt;
      }
      const b=remaining.splice(idx,1)[0];
      out.push(a,b);
    }
    return out.map(x=>x.id);
  }

  function generateHybridTournament(name,playerIds,discipline,raceTo,breakMode,groupCount,advancePerGroup,playoffType,guests={},tableCount=1,seedingMode='random',thirdPlacePlayoff=false){
    const base=generateGroupTournament(name,playerIds,discipline,raceTo,breakMode,groupCount,guests,tableCount,seedingMode);
    base.format=playoffType==='dko'?'groups_dko':'groups_sko';
    base.advancePerGroup=Math.max(1,Number(advancePerGroup||2));
    base.seedingMode=seedingMode;
    base.playoffType=playoffType;
    base.playoffStarted=false;
    base.groupEliminations=[];
    base.thirdPlacePlayoff=!!thirdPlacePlayoff;
    return base;
  }

  function startHybridPlayoff(t,manualOrder=null){
    const manual=Array.isArray(manualOrder) && manualOrder.length>0;
    if(!tournamentHasGroups(t) || t.playoffStarted)return false;
    if(!groupPhaseComplete(t))return false;

    // Při ručním nasazení rozhoduje organizátor. Shoda ve skupině,
    // vzájemné zápasy ani penalty nesmí ruční vytvoření pavouka blokovat.
    if(!manual && t.groupPenaltyTieBreak && !groupPenaltyTiesResolved(t))return false;
    const seeds=Array.isArray(manualOrder) && manualOrder.length
      ? [...manualOrder]
      : groupPlayoffSeeds(t);
    const qualifierSet=new Set(seeds);
    const nonQualifiers=(t.playerIds||[]).filter(id=>!qualifierSet.has(id));

    const nonQualifierOrder=[...nonQualifiers].sort((a,b)=>{
      const sa=seriesGroupPhaseScore(t,a), sb=seriesGroupPhaseScore(t,b);
      if(Number(sb.diff||0)!==Number(sa.diff||0))return Number(sb.diff||0)-Number(sa.diff||0);

      const h2h=seriesHeadToHeadRanks(t,[a,b]);
      const aw=Number(h2h[a]?.wins||0), bw=Number(h2h[b]?.wins||0);
      if(bw!==aw)return bw-aw;

      return seriesTournamentGroupPlace(t,a)-seriesTournamentGroupPlace(t,b) ||
        String(tournamentPlayerName(a,t)||'').localeCompare(String(tournamentPlayerName(b,t)||''),'cs');
    });

    // Důležité: pavouk se musí generovat už ve stavu ACTIVE.
    // Starší kód nastavoval ACTIVE až po knockoutCreateWave(), což u turnaje
    // označeného COMPLETE zablokovalo vytvoření prvního kola.
    t.status='active';

    // Players who do not qualify are classified behind the playoff field.
    const basePlace=seeds.length+1;
    const groupRankKey=id=>{
      const sc=seriesGroupPhaseScore(t,id);
      const sameScore=nonQualifierOrder.filter(pid=>Number(seriesGroupPhaseScore(t,pid).diff||0)===Number(sc.diff||0));
      const h2h=seriesHeadToHeadRanks(t,sameScore);
      return Number(sc.diff||0)+'|h2h:'+Number(h2h[id]?.wins||0)+'|group:'+seriesTournamentGroupPlace(t,id);
    };
    let prevGroupKey=null,prevGroupPlace=null;
    t.groupEliminations=nonQualifierOrder.map((id,i)=>{
      const key=groupRankKey(id);
      const place=(i>0 && key===prevGroupKey) ? prevGroupPlace : basePlace+i;
      prevGroupKey=key;
      prevGroupPlace=place;
      return {playerId:id,place,sharedPlace:nonQualifierOrder.filter(pid=>groupRankKey(pid)===key).length>1};
    });

    if(t.format==='groups_sko'){
      t.ko={
        participantIds:[...seeds],rounds:[],wave:0,eliminatedIds:[],eliminations:[],championId:null,runnerUpId:null,
        thirdPlacePlayoff:!!t.thirdPlacePlayoff,thirdPlaceWinnerId:null,thirdPlaceLoserId:null,
        semifinalRouting:t.manualGroupPlayoffSemiRouting||'cross13'
      };
      knockoutCreateWave(t);
    }else if(t.format==='groups_dko'){
      const losses={};seeds.forEach(id=>losses[id]=0);
      t.dko={
        participantIds:[...seeds],losses,rounds:[],wave:0,championId:null,runnerUpId:null,finalResetNeeded:false,
        thirdPlacePlayoff:!!t.thirdPlacePlayoff,thirdPlaceWinnerId:null,thirdPlaceLoserId:null,eliminations:[]
      };
      dkoCreateWave(t);
    }
    t.playoffStarted=true;
    t.awaitingPlayoffSeeding=false;
    t.status='active';

    // Pojistka: první kolo musí po ručním nasazení skutečně existovat.
    if(t.format==='groups_sko' && !(t.ko?.rounds||[]).length){
      knockoutCreateWave(t);
    }else if(t.format==='groups_dko' && !(t.dko?.rounds||[]).length){
      dkoCreateWave(t);
    }

    assignTournamentTables(t);
    return true;
  }



  function roundRobinSchedule(playerIds){
    const ids=[...(playerIds||[])];
    if(ids.length<2)return [];

    // Pro lichý počet přidáme BYE. Kruh se pak otáčí po každém kole.
    if(ids.length%2===1) ids.push(null);

    const fixed=ids[0];
    let rotating=ids.slice(1);
    const rounds=[];

    for(let round=0; round<ids.length-1; round++){
      const lineup=[fixed,...rotating];
      const pairs=[];

      for(let i=0;i<lineup.length/2;i++){
        const a=lineup[i];
        const b=lineup[lineup.length-1-i];
        if(a && b){
          // Pro trochu přirozenější střídání prohodíme orientaci dvojic ob kolo.
          pairs.push(round%2===0 ? [a,b] : [b,a]);
        }
      }

      rounds.push(pairs);

      // Circle method: poslední hráč jde dopředu, první zůstává fixní.
      rotating=[rotating[rotating.length-1],...rotating.slice(0,-1)];
    }

    return rounds;
  }


  function swissRecommendedRounds(playerCount){
    const n=Math.max(4,Number(playerCount||4));
    return Math.max(3,Math.ceil(Math.log2(n)));
  }

  function swissPlayedPairKey(a,b){
    return [String(a),String(b)].sort().join('|');
  }

  function swissAllPlayedPairs(t){
    const set=new Set();
    (t?.swiss?.rounds||[]).forEach(r=>(r.matches||[]).forEach(m=>{
      if(m.player1Id&&m.player2Id)set.add(swissPlayedPairKey(m.player1Id,m.player2Id));
    }));
    return set;
  }

  function swissStandings(t){
    const ids=[...(t?.playerIds||[])];
    const seedIndex=new Map(ids.map((id,i)=>[id,i]));
    const rows=ids.map(id=>({
      id,played:0,wins:0,losses:0,points:0,
      rf:0,ra:0,diff:0,buchholz:0,byeCount:0,opponents:[]
    }));
    const map=Object.fromEntries(rows.map(r=>[r.id,r]));

    (t?.swiss?.rounds||[]).forEach(r=>{
      if(r.byePlayerId && map[r.byePlayerId]){
        map[r.byePlayerId].points+=1;
        map[r.byePlayerId].byeCount+=1;
      }
      (r.matches||[]).filter(m=>m.status==='done'||m.winnerId).forEach(m=>{
        const a=map[m.player1Id],b=map[m.player2Id];
        if(!a||!b)return;
        const s1=Number(m.score1||0),s2=Number(m.score2||0);
        a.played++;b.played++;
        a.rf+=s1;a.ra+=s2;b.rf+=s2;b.ra+=s1;
        a.opponents.push(b.id);b.opponents.push(a.id);
        if(m.winnerId===a.id){a.wins++;a.points++;b.losses++;}
        else if(m.winnerId===b.id){b.wins++;b.points++;a.losses++;}
      });
    });

    rows.forEach(r=>r.diff=r.rf-r.ra);
    rows.forEach(r=>{
      r.buchholz=r.opponents.reduce((sum,id)=>sum+Number(map[id]?.points||0),0);
    });

    rows.sort((a,b)=>
      b.points-a.points ||
      b.buchholz-a.buchholz ||
      b.diff-a.diff ||
      b.rf-a.rf ||
      (seedIndex.get(a.id)??999)-(seedIndex.get(b.id)??999)
    );
    rows.forEach((r,i)=>r.place=i+1);
    return rows;
  }

  function swissCreateFirstRound(t){
    const s=t.swiss;
    if((s.rounds||[]).length)return false;

    const order=[...(s.seedOrder||t.playerIds||[])];
    let byePlayerId=null;
    if(order.length%2){
      byePlayerId=order[order.length-1];
      order.pop();
    }

    const half=order.length/2;
    const top=order.slice(0,half);
    const bottom=order.slice(half);
    const matches=top.map((id,i)=>
      tournamentMatchObject(id,bottom[i],`Švýcarský systém • 1. kolo`,'SWISS')
    );

    s.rounds.push({
      id:uid(),number:1,label:'1. kolo',matches,byePlayerId,
      createdAt:new Date().toISOString()
    });
    s.currentRound=1;
    assignTournamentTables(t);
    return true;
  }

  function swissChooseBye(t,orderedIds){
    if(orderedIds.length%2===0)return null;
    const previousBye=new Set((t.swiss.rounds||[]).map(r=>r.byePlayerId).filter(Boolean));

    // Volno dostane co nejníže postavený hráč, který ho ještě neměl.
    for(let i=orderedIds.length-1;i>=0;i--){
      if(!previousBye.has(orderedIds[i]))return orderedIds[i];
    }
    return orderedIds[orderedIds.length-1];
  }

  function swissPairRound(t){
    const standings=swissStandings(t);
    let pool=standings.map(r=>r.id);
    const played=swissAllPlayedPairs(t);
    const byePlayerId=swissChooseBye(t,pool);
    if(byePlayerId)pool=pool.filter(id=>id!==byePlayerId);

    const points=Object.fromEntries(standings.map(r=>[r.id,r.points]));
    const matches=[];

    while(pool.length>=2){
      const a=pool.shift();

      let bestIndex=-1;
      let bestScore=Infinity;
      for(let i=0;i<pool.length;i++){
        const b=pool[i];
        const rematch=played.has(swissPlayedPairKey(a,b)) ? 10000 : 0;
        const pointGap=Math.abs(Number(points[a]||0)-Number(points[b]||0))*100;
        const rankGap=i;
        const score=rematch+pointGap+rankGap;
        if(score<bestScore){bestScore=score;bestIndex=i;}
      }

      if(bestIndex<0)bestIndex=0;
      const b=pool.splice(bestIndex,1)[0];
      matches.push(tournamentMatchObject(
        a,b,
        `Švýcarský systém • ${Number(t.swiss.currentRound||0)+1}. kolo`,
        'SWISS'
      ));
    }

    const number=Number(t.swiss.currentRound||0)+1;
    t.swiss.rounds.push({
      id:uid(),number,label:number+'. kolo',matches,byePlayerId,
      createdAt:new Date().toISOString()
    });
    t.swiss.currentRound=number;
    assignTournamentTables(t);
    return true;
  }

  function swissCurrentRound(t){
    return (t?.swiss?.rounds||[])[(t?.swiss?.rounds||[]).length-1]||null;
  }

  function swissRoundComplete(round){
    if(!round)return false;
    return (round.matches||[]).every(m=>m.status==='done'||m.winnerId);
  }

  function swissSeedBracketOrder(ids){
    const list=[...(ids||[])];
    const n=list.length;
    if(n<=1)return list;
    let size=1;
    while(size<n)size*=2;

    const build=size=>{
      if(size===1)return [1];
      const prev=build(size/2);
      const out=[];
      prev.forEach(seed=>{
        out.push(seed);
        out.push(size+1-seed);
      });
      return out;
    };

    return build(size).map(seed=>list[seed-1]||null).filter(Boolean);
  }

  function swissStartPlayoff(t){
    if(!tournamentHasSwiss(t))return false;
    const count=Math.max(0,Number(t.swiss?.advanceToSko||0));
    if(count<2)return false;

    const standings=swissStandings(t);
    const qualifiers=standings.slice(0,count).map(r=>r.id);
    if(qualifiers.length<2)return false;

    const ordered=swissSeedBracketOrder(qualifiers);

    // Hráči mimo postupové místo mají konečné pořadí podle švýcarské části.
    t.groupEliminations=standings.slice(qualifiers.length).map(r=>({
      playerId:r.id,
      place:r.place
    }));

    t.ko={
      participantIds:[...ordered],
      rounds:[],
      wave:0,
      eliminatedIds:[],
      eliminations:[],
      championId:null,
      runnerUpId:null,
      thirdPlacePlayoff:false,
      thirdPlaceWinnerId:null,
      thirdPlaceLoserId:null
    };

    t.swiss.playoffStarted=true;
    t.swiss.qualifierIds=[...qualifiers];
    t.swiss.qualifierCount=qualifiers.length;
    t.status='active';

    knockoutCreateWave(t);
    assignTournamentTables(t);
    return true;
  }

  function swissFinalRecapHtml(t){
    if(!t)return '';

    if(t.ko && t.status==='complete'){
      const records=tournamentPlacementRecords(t)
        .slice()
        .sort((a,b)=>Number(a.value||999)-Number(b.value||999));
      if(!records.length)return '';

      return `<div class="subpanel" style="margin-top:14px;border-color:rgba(212,175,55,.45)">
        <strong>KONEČNÉ POŘADÍ TURNAJE</strong>
        <div style="margin-top:9px">
          ${records.map(r=>`
            <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #28282c">
              <span><strong>${esc(r.label)}</strong></span>
              <span>${esc(tournamentPlayerName(r.playerId,t))}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    if(!t.ko && t.status==='complete'){
      const standings=swissStandings(t);
      return `<div class="subpanel" style="margin-top:14px;border-color:rgba(212,175,55,.45)">
        <strong>KONEČNÉ POŘADÍ TURNAJE</strong>
        <div style="margin-top:9px">
          ${standings.map(r=>`
            <div style="display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid #28282c">
              <span><strong>${r.place}. místo</strong></span>
              <span>${esc(tournamentPlayerName(r.id,t))} • ${r.points} b.</span>
            </div>
          `).join('')}
        </div>
      </div>`;
    }

    return '';
  }

  function swissAdvanceIfReady(t){
    if(!tournamentHasSwiss(t))return false;
    const round=swissCurrentRound(t);
    if(!round || !swissRoundComplete(round))return false;

    if(Number(t.swiss.currentRound||0)>=Number(t.swiss.roundsTotal||0)){
      t.swiss.completedAt=new Date().toISOString();

      if(Number(t.swiss.advanceToSko||0)>=2){
        const started=swissStartPlayoff(t);
        if(started)return true;
      }

      t.status='complete';
      return true;
    }

    swissPairRound(t);
    t.status='active';
    return true;
  }

  function generateSwissTournament(name,playerIds,discipline,raceTo,breakMode,guests={},tableCount=1,seedingMode='random',roundsRequested=0,advanceToSko=0){
    const seedOrder=(seedingMode==='manual' || seedingMode==='draw')
      ? [...playerIds]
      : (seedingMode==='elo' ? tournamentIdsSortedByElo(playerIds) : shuffleArray(playerIds));
    const roundsTotal=Number(roundsRequested||0)>0
      ? Math.max(1,Math.min(12,Number(roundsRequested)))
      : swissRecommendedRounds(seedOrder.length);

    const t={
      id:uid(),createdByUid:cloudUid||'',managerUids:{},
      name,format:'swiss',discipline,raceTo,breakMode,seedingMode,
      tableCount:Math.max(1,tableCount),
      createdAt:new Date().toISOString(),status:'active',
      playerIds:[...playerIds],
      guests:JSON.parse(JSON.stringify(guests)),
      swiss:{
        roundsTotal,currentRound:0,rounds:[],
        seedOrder:[...seedOrder],
        advanceToSko:Math.max(0,Number(advanceToSko||0)),
        playoffStarted:false,
        qualifierIds:[]
      }
    };
    swissCreateFirstRound(t);
    return t;
  }

  function renderSwissTournament(t){
    const s=t.swiss||{};
    const standings=swissStandings(t);

    const table=`<div class="table-wrap"><table>
      <thead><tr>
        <th>#</th><th>Hráč</th><th>Z</th><th>V</th><th>P</th><th>Body</th><th>Buchholz</th><th>+/-</th>
      </tr></thead>
      <tbody>${standings.map(r=>`<tr>
        <td class="num"><strong>${r.place}</strong></td>
        <td><strong>${esc(tournamentPlayerName(r.id,t))}</strong>${r.byeCount?` <span class="muted">• volno ${r.byeCount}×</span>`:''}</td>
        <td class="num">${r.played}</td>
        <td class="num">${r.wins}</td>
        <td class="num">${r.losses}</td>
        <td class="num"><strong>${r.points}</strong></td>
        <td class="num">${r.buchholz}</td>
        <td class="num">${r.diff>=0?'+':''}${r.diff}</td>
      </tr>`).join('')}</tbody>
    </table></div>`;

    const rounds=(s.rounds||[]).map(r=>`
      <div class="subpanel" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <strong>${r.number}. KOLO</strong>
          <span class="muted">${swissRoundComplete(r)?'DOHRÁNO':'PROBÍHÁ'}</span>
        </div>
        ${r.byePlayerId?`<div class="muted" style="margin-top:7px">VOLNO: <strong>${esc(tournamentPlayerName(r.byePlayerId,t))}</strong> • +1 bod</div>`:''}
        <div style="margin-top:9px">${(r.matches||[]).map(m=>renderTournamentMatch(t,m)).join('')}</div>
      </div>
    `).join('');

    const playoffInfo=Number(s.advanceToSko||0)>=2
      ? `<div class="muted" style="margin-top:5px">
          Do následného SKO postupuje <strong>${s.advanceToSko}</strong> nejlepších hráčů.
        </div>`
      : `<div class="muted" style="margin-top:5px">Turnaj končí po švýcarské části.</div>`;

    const playoff=t.ko
      ? `<div class="hr"></div>
         <h2 style="margin:0 0 10px">NÁSLEDNÉ SKO</h2>
         ${renderSKOTournament(t)}`
      : '';

    return `<div class="subpanel" style="margin-bottom:12px">
      <strong>ŠVÝCARSKÝ SYSTÉM • ${s.currentRound||0}/${s.roundsTotal||0} KOL</strong>
      <div class="muted" style="margin-top:5px">
        Výhra = 1 bod • volno = 1 bod. Pořadí: body → Buchholz → rozdíl racků → vyhrané racky.
        V dalších kolech se párují hráči s podobným počtem bodů a aplikace se snaží zabránit opakovanému soupeři.
      </div>
      ${playoffInfo}
    </div>${table}${rounds}${playoff}${swissFinalRecapHtml(t)}`;
  }

  function generateGroupTournament(name,playerIds,discipline,raceTo,breakMode,groupCount,guests={},tableCount=1,seedingMode='random'){
    const shuffled=(seedingMode==='manual' || seedingMode==='draw')
      ? [...playerIds]
      : (seedingMode==='elo' ? tournamentIdsSortedByElo(playerIds) : shuffleArray(playerIds));
    groupCount=Math.max(1,Math.min(groupCount,shuffled.length));
    const groups=Array.from({length:groupCount},(_,i)=>({id:String.fromCharCode(65+i),players:[],matches:[]}));

    if(seedingMode==='manual' || seedingMode==='draw'){
      // Ruční nasazení a los čísel používají pořadí po samostatných blocích:
      // nejdřív kompletní skupina A, potom B, C...
      const layout=manualGroupSeedLayout(shuffled,groupCount);
      layout.forEach((g,gi)=>{
        groups[gi].players.push(...g.ids);
        groups[gi].seedOrder=[...g.ids];
      });
    }else if(seedingMode==='elo'){
      // ELO nasazení rozděluje hráče hadovitě mezi skupiny, aby byly vyrovnané.
      const layout=eloSnakeGroups(shuffled,groupCount);
      layout.forEach((ids,gi)=>{
        groups[gi].players.push(...ids);
        groups[gi].seedOrder=[...ids];
      });
    }else{
      // Náhodné losování zůstává rovnoměrně rozdělené mezi skupiny.
      shuffled.forEach((pid,i)=>groups[i%groupCount].players.push(pid));
    }
    groups.forEach(g=>{
      const rr=roundRobinSchedule(g.players);
      rr.forEach((pairs,roundIndex)=>{
        pairs.forEach(([p1,p2],matchIndex)=>{
          g.matches.push({
            id:uid(),
            player1Id:p1,
            player2Id:p2,
            status:'pending',
            tableNumber:null,
            score1:0,
            score2:0,
            winnerId:null,
            loserId:null,
            roundNumber:roundIndex+1,
            roundOrder:matchIndex+1,
            roundLabel:'Kolo '+(roundIndex+1)
          });
        });
      });
    });
    const t={id:uid(),createdByUid:cloudUid||'',managerUids:{},name,format:'groups',discipline,raceTo,breakMode,seedingMode,tableCount:Math.max(1,tableCount),createdAt:new Date().toISOString(),status:'active',playerIds:[...playerIds],guests:JSON.parse(JSON.stringify(guests)),groups};
    assignTournamentTables(t);
    return t;
  }

  function repairDKOInvalidFutureMatches(t){
    if(!t || !t.dko) return false;
    const d=t.dko;
    let changed=false;

    // Starší chybná verze mohla vytvořit budoucí zápas dříve, než skončilo
    // předchozí kolo. Pokud je některý účastník už OUT (2 prohry), takový
    // ještě nerozehraný zápas odstraníme.
    (d.rounds||[]).forEach(r=>{
      const before=(r.matches||[]).length;
      r.matches=(r.matches||[]).filter(m=>{
        if(m.status==='done') return true;
        const p1Out=(d.losses[m.player1Id]||0)>=2;
        const p2Out=(d.losses[m.player2Id]||0)>=2;

        // Rozehraný zápas na jiném telefonu automaticky nemažeme; při pokusu
        // o pokračování ho ale níže zablokujeme.
        if(m.status==='playing') return true;

        if(p1Out||p2Out){
          changed=true;
          return false;
        }
        return true;
      });
      if(before!==r.matches.length) changed=true;
    });

    // Prázdné uměle vytvořené vlny bez BYE můžeme odstranit.
    const beforeRounds=(d.rounds||[]).length;
    d.rounds=(d.rounds||[]).filter(r=>{
      if(r.type==='GF' && !(r.matches||[]).length) return false;
      if(r.type==='WAVE' && !(r.matches||[]).length && !(r.byes||[]).length) return false;
      return true;
    });
    if(beforeRounds!==d.rounds.length) changed=true;

    if(changed){
      assignTournamentTables(t);
    }
    return changed;
  }

  function dkoPlayerIsOut(t,id){
    return !!(t && t.dko && (t.dko.losses[id]||0)>=2);
  }

  function tournamentPlayersHaveMet(t,a,b){
    if(!t||!a||!b)return false;
    return allTournamentMatches(t).some(m=>{
      const done=m && (m.status==='done'||m.winnerId||m.loserId);
      return done && ((m.player1Id===a&&m.player2Id===b)||(m.player1Id===b&&m.player2Id===a));
    });
  }

  function dkoSkoSeedOrder(t,active){
    const d=t.dko||{};
    const unbeaten=active.filter(id=>(d.losses[id]||0)===0);
    const oneLoss=active.filter(id=>(d.losses[id]||0)===1);
    const order=[];
    const remaining=[...oneLoss];

    // Pokud je to možné, postavíme hráče z A strany proti hráči z B strany
    // a současně se snažíme vyhnout okamžité odvetě z předchozí DKO fáze.
    unbeaten.forEach(a=>{
      if(!remaining.length){order.push(a);return;}
      let idx=remaining.findIndex(b=>!tournamentPlayersHaveMet(t,a,b));
      if(idx<0)idx=0;
      const b=remaining.splice(idx,1)[0];
      order.push(a,b);
    });
    remaining.forEach(id=>order.push(id));

    // Pokud poměr A/B není vyrovnaný, doplníme všechny zbývající aktivní hráče.
    active.forEach(id=>{if(!order.includes(id))order.push(id);});
    return order;
  }

  function dkoTryStartSkoCut(t){
    if(!t?.dko || t.ko)return false;
    const d=t.dko;
    const cut=Math.max(0,Number(d.skoCut||0));
    if(!cut)return false;

    const unfinished=(d.rounds||[]).flatMap(r=>r.matches||[])
      .some(m=>m.status!=='done'&&!m.winnerId&&!m.loserId);
    if(unfinished)return false;

    const active=(d.participantIds||t.playerIds||[]).filter(id=>(d.losses[id]||0)<2);
    if(active.length>cut || active.length<2)return false;

    const seedOrder=dkoSkoSeedOrder(t,active);
    d.skoStarted=true;
    d.skoStartedAt=new Date().toISOString();
    d.skoParticipantIds=[...seedOrder];
    d.skoActualCount=seedOrder.length;

    t.ko={
      participantIds:[...seedOrder],rounds:[],wave:0,seedingMode:'dko_cut',
      eliminatedIds:[],eliminations:[],championId:null,runnerUpId:null,
      thirdPlacePlayoff:!!d.thirdPlacePlayoff,thirdPlaceWinnerId:null,thirdPlaceLoserId:null
    };
    t.status='active';
    knockoutCreateWave(t);
    assignTournamentTables(t);
    return true;
  }

  function dkoCreateWave(t){
    const d=t.dko;
    if(t.status==='complete' || d.championId) return;

    const latestRound=(d.rounds||[])[d.rounds.length-1];
    if(latestRound && (latestRound.matches||[]).some(m=>m.status!=='done' && !m.winnerId && !m.loserId)){
      return;
    }

    const active=(d.participantIds||t.playerIds||[]).filter(id=>(d.losses[id]||0)<2);
    if(active.length<=1){
      d.championId=active[0]||null;
      t.status='complete';
      return;
    }

    // Další DKO vlna smí vzniknout až ve chvíli, kdy jsou opravdu dohrané
    // VŠECHNY zápasy předchozích vln. Stav "assigned" znamená jen přidělený stůl,
    // nikoliv dokončený zápas.
    const unfinished=d.rounds
      .flatMap(r=>r.matches||[])
      .some(m=>{
        const finished=(m.status==='done'||!!m.winnerId||!!m.loserId);
        if(finished) return false;
        return m.status==='pending'||m.status==='assigned'||m.status==='playing';
      });

    if(unfinished) return;

    // Volitelný přechod DKO → SKO je nezávislý na velikosti startovního pavouka.
    if(dkoTryStartSkoCut(t)) return;

    if(active.length===2){
      const label='Finálové zápasy';
      const finalMatches=[tournamentMatchObject(active[0],active[1],'Grand Final','GF')];

      if(d.thirdPlacePlayoff && !dkoThirdPlaceMatch(t)){
        const bronze=dkoThirdPlaceCandidates(t);
        if(bronze.length===2 && bronze[0]!==bronze[1]){
          finalMatches.push(tournamentMatchObject(bronze[0],bronze[1],'Zápas o 3. místo','3P'));
        }
      }

      d.rounds.push({id:uid(),label,type:'FINAL',byes:[],matches:finalMatches});
      return;
    }

    const firstWave=(d.wave||0)===0;
    const unbeatenBase=active.filter(id=>(d.losses[id]||0)===0);
    const oneLossBase=active.filter(id=>(d.losses[id]||0)===1);
    const unbeaten=(firstWave && d.seedingMode==='manual') ? [...unbeatenBase] : shuffleArray(unbeatenBase);
    const oneLoss=(firstWave && d.seedingMode==='manual') ? [...oneLossBase] : shuffleArray(oneLossBase);
    const matches=[],byes=[];
    d.wave=(d.wave||0)+1;

    function pair(pool,bracket,label){
      for(let i=0;i+1<pool.length;i+=2) matches.push(tournamentMatchObject(pool[i],pool[i+1],label,bracket));
      if(pool.length%2===1) byes.push({playerId:pool[pool.length-1],bracket});
    }

    pair(unbeaten,'W','Winner Bracket • kolo '+d.wave);
    pair(oneLoss,'L','Loser Bracket • kolo '+d.wave);

    d.rounds.push({id:uid(),label:'DKO • kolo '+d.wave,type:'WAVE',matches,byes});

    if(!matches.length){
      const still=(d.participantIds||t.playerIds||[]).filter(id=>(d.losses[id]||0)<2);
      if(still.length===2){
        const finalMatches=[tournamentMatchObject(still[0],still[1],'Grand Final','GF')];
        if(d.thirdPlacePlayoff && !dkoThirdPlaceMatch(t)){
          const bronze=dkoThirdPlaceCandidates(t);
          if(bronze.length===2 && bronze[0]!==bronze[1]){
            finalMatches.push(tournamentMatchObject(bronze[0],bronze[1],'Zápas o 3. místo','3P'));
          }
        }
        d.rounds.push({id:uid(),label:'Finálové zápasy',type:'FINAL',byes:[],matches:finalMatches});
      }
    }
  }

  function generateDKOTournament(name,playerIds,discipline,raceTo,breakMode,guests={},tableCount=1,seedingMode='random',thirdPlacePlayoff=false,skoCut=0){
    const ids=(seedingMode==='manual' || seedingMode==='draw')
      ? [...playerIds]
      : (seedingMode==='elo'
          ? swissSeedBracketOrder(tournamentIdsSortedByElo(playerIds))
          : shuffleArray(playerIds)),
      losses={};
    ids.forEach(id=>losses[id]=0);
    const t={id:uid(),createdByUid:cloudUid||'',managerUids:{},name,format:'dko',discipline,raceTo,breakMode,seedingMode,tableCount:Math.max(1,tableCount),createdAt:new Date().toISOString(),status:'active',playerIds:ids,guests:JSON.parse(JSON.stringify(guests)),dko:{participantIds:[...ids],losses,rounds:[],wave:0,seedingMode,championId:null,finalResetNeeded:false,thirdPlacePlayoff:!!thirdPlacePlayoff,thirdPlaceWinnerId:null,thirdPlaceLoserId:null,eliminations:[],skoCut:Math.max(0,Number(skoCut||0)),skoStarted:false,skoParticipantIds:[]}};
    dkoCreateWave(t);
    assignTournamentTables(t);
    return t;
  }

  function tournamentBusyTables(t){
    const busy=new Set();
    allTournamentMatches(t).forEach(m=>{
      // Stůl blokuje pouze skutečně rozehraný zápas.
      // Stav "assigned" je jen doporučené pořadí, ne rezervace stolu.
      if(m.status==='playing' && m.tableNumber){
        busy.add(Number(m.tableNumber));
      }
    });
    return busy;
  }

  function nextFreeTournamentTable(t){
    const busy=tournamentBusyTables(t);
    const count=Math.max(1,Number(t.tableCount||1));
    for(let i=1;i<=count;i++){
      if(!busy.has(i)) return i;
    }
    return null;
  }


  function tournamentPlayerBusy(t,playerId,excludeMatchId=null){
    if(!t || !playerId)return false;

    const allMatches=allTournamentMatches(t);

    return allMatches.some(m=>{
      if(!m || m.id===excludeMatchId)return false;
      const active=m.status==='playing' && m.status!=='done';
      if(!active)return false;
      return m.player1Id===playerId || m.player2Id===playerId;
    });
  }

  function tournamentMatchHasBusyPlayer(t,m){
    if(!t || !m)return false;
    return tournamentPlayerBusy(t,m.player1Id,m.id) || tournamentPlayerBusy(t,m.player2Id,m.id);
  }

  function assignTournamentTables(t){
    if(!t || t.status==='complete')return;

    const tableCount=Math.max(1,Number(t.tableCount||1));

    const allMatches=allTournamentMatches(t);

    const playing=allMatches.filter(m=>m.status==='playing' && m.status!=='done');

    const usedTables=new Set(
      playing
        .map(m=>Number(m.tableNumber||0))
        .filter(n=>n>0)
    );

    const busyPlayers=new Set();
    playing.forEach(m=>{
      if(m.player1Id)busyPlayers.add(m.player1Id);
      if(m.player2Id)busyPlayers.add(m.player2Id);
    });

    // Všechny nehraně "assigned" zápasy znovu přepočítáme.
    allMatches.forEach(m=>{
      if(m.status==='assigned'){
        m.status='pending';
        m.tableNumber=null;
      }
    });

    let waiting=allMatches.filter(m=>
      m.status!=='done' &&
      m.status!=='playing' &&
      m.player1Id &&
      m.player2Id
    );

    if(tournamentHasGroups(t) && (!t.playoffStarted || t.format==='groups')){
      (t.groups||[]).forEach(ensureGroupRoundOrder);

      // Hraje se vždy nejnižší ještě nedokončené kolo.
      const unfinishedRounds=waiting
        .map(m=>groupRoundNumberForMatch(t,m))
        .filter(Number.isFinite);

      const currentRound=unfinishedRounds.length ? Math.min(...unfinishedRounds) : null;

      if(currentRound!==null){
        waiting=waiting
          .filter(m=>groupRoundNumberForMatch(t,m)===currentRound)
          .sort((a,b)=>Number(a.roundOrder||999)-Number(b.roundOrder||999));
      }
    }

    // Přidělení stolu je jen vizuální návrh.
    // Opravdovou rezervaci udělá až startTournamentMatch.
    const suggestedTables=[];
    for(let n=1;n<=tableCount;n++){
      if(!usedTables.has(n)) suggestedTables.push(n);
    }

    let suggestionIndex=0;
    for(const m of waiting){
      if(busyPlayers.has(m.player1Id) || busyPlayers.has(m.player2Id)){
        m.status='pending';
        m.tableNumber=null;
        continue;
      }

      if(suggestionIndex < suggestedTables.length){
        m.tableNumber=suggestedTables[suggestionIndex++];
        m.status='assigned';
      }else{
        m.tableNumber=null;
        m.status='pending';
      }
    }
  }

  function releaseTournamentTable(t,m){
    if(!t||!m)return;
    m.tableNumber=null;
    assignTournamentTables(t);
  }

  function findTournamentMatch(t,matchId){
    if(tournamentHasGroups(t)){
      for(const g of (t.groups||[])){
        const m=(g.matches||[]).find(x=>x.id===matchId);
        if(m)return m;
      }
    }
    if(t.ko){
      for(const r of (t.ko.rounds||[])){const m=(r.matches||[]).find(x=>x.id===matchId);if(m)return m;}
    }
    if(t.dko){
      for(const r of (t.dko.rounds||[])){const m=(r.matches||[]).find(x=>x.id===matchId);if(m)return m;}
    }
    if(t.swiss){
      for(const r of (t.swiss.rounds||[])){const m=(r.matches||[]).find(x=>x.id===matchId);if(m)return m;}
    }
    return null;
  }

  function allTournamentMatches(t){
    const out=[];
    if(tournamentHasGroups(t))out.push(...(t.groups||[]).flatMap(g=>g.matches||[]));
    if(t.ko)out.push(...(t.ko.rounds||[]).flatMap(r=>r.matches||[]));
    if(t.dko)out.push(...(t.dko.rounds||[]).flatMap(r=>r.matches||[]));
    if(t.swiss)out.push(...(t.swiss.rounds||[]).flatMap(r=>r.matches||[]));
    return out;
  }

  function groupStandings(group,t){
    const rows=rawGroupRows(group);
    const penaltyOrder=(t?.groupPenaltyWinners?.[group.id]||[]);
    const penaltyIndex=id=>{
      const i=penaltyOrder.indexOf(id);
      return i<0?999:i;
    };
    const seedIndex=id=>{
      const i=(group.players||[]).indexOf(id);
      return i<0?999:i;
    };

    const tieRule=t?.groupAdvanceTieRule||'points';

    // Nejprve vytvoříme pořadí po bodech/výhrách.
    const byWins=new Map();
    rows.forEach(r=>{
      if(!byWins.has(r.v))byWins.set(r.v,[]);
      byWins.get(r.v).push(r);
    });

    const ordered=[];
    [...byWins.keys()].sort((a,b)=>b-a).forEach(wins=>{
      const cohort=byWins.get(wins);

      if(tieRule==='head_to_head' && cohort.length>1){
        const miniMap=Object.fromEntries(groupHeadToHeadMini(group,cohort.map(r=>r.id)).map(r=>[r.id,r]));
        cohort.sort((a,b)=>{
          const av=miniMap[a.id]?.v||0, bv=miniMap[b.id]?.v||0;
          if(bv!==av)return bv-av;

          if(t?.groupPenaltyTieBreak){
            const ai=penaltyIndex(a.id),bi=penaltyIndex(b.id);
            if(ai!==bi)return ai-bi;
          }

          // Pokud vzájemné zápasy nerozhodnou (např. kruh 1-1-1),
          // před penaltami nevymýšlíme další sportovní kritérium.
          // Pouze stabilně zachováme nasazení.
          return seedIndex(a.id)-seedIndex(b.id);
        });
      }else{
        cohort.sort((a,b)=>{
          if(t?.groupPenaltyTieBreak){
            const ai=penaltyIndex(a.id),bi=penaltyIndex(b.id);
            if(ai!==bi)return ai-bi;
          }
          if(b.diff!==a.diff)return b.diff-a.diff;
          if(b.rf!==a.rf)return b.rf-a.rf;
          return seedIndex(a.id)-seedIndex(b.id);
        });
      }

      ordered.push(...cohort);
    });

    return ordered;
  }

  function isTournamentOwner(t){
    return !!(t && cloudUid && t.createdByUid && t.createdByUid===cloudUid);
  }

  function canManageTournamentOrganizers(t){
    if(!t)return false;
    if(currentUserIsSystemAdmin())return true;
    return isTournamentOwner(t);
  }

  function canManageTournament(t){
    if(!t)return false;
    if(currentUserIsSystemAdmin())return true;
    if(isTournamentOwner(t))return true;
    return !!(cloudUid && t.managerUids && t.managerUids[cloudUid]===true);
  }

  function tournamentCanHistoricalReseed(t){
    return !!(
      t &&
      ['groups_sko','groups_dko'].includes(t.format) &&
      groupPhaseComplete(t) &&
      (t.status==='complete' || !!t.playoffStarted || !!t.ko || !!t.dko) &&
      canManageTournament(t)
    );
  }

  let activeEditTournamentId=null;

  window.openActiveTournamentEdit=function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t || !canManageTournament(t)){
      toast('Tento turnaj teď nelze upravit.');
      return;
    }

    // Hybrid po skupinách může být opravován/nasazován i pokud starší verze
    // omylem uložila status COMPLETE.
    if(t.status==='complete' && !(['groups_sko','groups_dko'].includes(t.format) && groupPhaseComplete(t))){
      toast('Tento turnaj teď nelze upravit.');
      return;
    }

    repairHybridWaitingState(t);

    activeEditTournamentId=tid;
    const hybrid=['groups_sko','groups_dko'].includes(t.format);

    $('activeTournamentGroupRulesBox').classList.toggle('hidden',!hybrid);
    $('activeTournamentSaveRulesBtn').classList.toggle('hidden',!hybrid);

    if(hybrid){
      $('activeTournamentTieRule').value=t.groupAdvanceTieRule||'points';
      $('activeTournamentPenaltyTieBreak').checked=!!t.groupPenaltyTieBreak;

      const groupsDone=groupPhaseComplete(t);
      const playoffStarted=!!(t.playoffStarted || t.ko || t.dko);

      if(!groupsDone){
        $('activeTournamentEditInfo').textContent='Skupiny ještě nejsou dohrané. Můžeš změnit pravidla, podle kterých se později určí postupující.';
        $('activeTournamentEditActions').innerHTML='';
      }else if(!playoffStarted){
        $('activeTournamentEditInfo').textContent='Skupiny jsou dohrané a play-off ještě nezačalo. Můžeš upravit pravidla nebo ručně vybrat postupující hráče ze seznamu a vložit je přímo do pavouka.';
        $('activeTournamentEditActions').innerHTML=`
          <button class="btn primary" onclick="closeActiveTournamentEdit();renderTournamentDetail();setTimeout(()=>document.getElementById('inlineManualPlayoffEditor_${t.id}')?.scrollIntoView({behavior:'smooth',block:'center'}),80)">RUČNĚ NASADIT PLAY-OFF</button>`;
      }else{
        $('activeTournamentEditInfo').textContent='Play-off už bylo vytvořené. Můžeš ho ručně přenasadit podle papírového turnaje. Dosavadní pavouk se nejdřív uloží do zálohy.';
        $('activeTournamentEditActions').innerHTML=`
          <button class="btn danger" onclick="closeActiveTournamentEdit();prepareManualPlayoffReseed('${t.id}')">RUČNĚ PŘENASADIT PLAY-OFF</button>
          <button class="btn" onclick="closeActiveTournamentEdit();openTournamentHistoricalEdit('${t.id}')">PŘENASADIT PODLE PRAVIDEL</button>`;
      }
    }else{
      $('activeTournamentEditInfo').textContent='U tohoto formátu zatím nejsou k dispozici dodatečná pravidla skupinového postupu.';
      $('activeTournamentEditActions').innerHTML='';
    }

    $('activeTournamentEditModal').classList.add('show');
  };

  window.closeActiveTournamentEdit=function(){
    $('activeTournamentEditModal').classList.remove('show');
    activeEditTournamentId=null;
  };

  async function saveActiveTournamentRules(){
    const t=(data.tournaments||[]).find(x=>x.id===activeEditTournamentId);
    if(!t || !canManageTournament(t) || t.status==='complete')return;

    if(['groups_sko','groups_dko'].includes(t.format)){
      t.groupAdvanceTieRule=$('activeTournamentTieRule').value||'points';
      t.groupPenaltyTieBreak=!!$('activeTournamentPenaltyTieBreak').checked;
      t.groupPenaltyWinners={};
      t.updatedAt=new Date().toISOString();

      try{
        await saveSecureTournament(t);
      }catch(e){
        console.error('Active tournament rules save:',e);
        toast('Pravidla se nepodařilo uložit.');
        return;
      }

      renderTournament();
      renderTournamentDetail();
      toast('Pravidla turnaje byla uložena.');
    }

    closeActiveTournamentEdit();
  }

  let historicalEditTournamentId=null;
  let historicalScoreContext=null;

  window.openTournamentHistoricalEdit=function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t || !tournamentCanHistoricalReseed(t)){
      toast('Play-off tohoto turnaje teď nelze znovu nasadit.');
      return;
    }
    historicalEditTournamentId=tid;
    $('historicalTieRule').value=t.groupAdvanceTieRule||'points';
    $('historicalPenaltyTieBreak').checked=!!t.groupPenaltyTieBreak;
    $('tournamentHistoricalEditModal').classList.add('show');
  };

  function archiveCurrentTournamentPlayoff(t){
    t.playoffRevisionHistory=t.playoffRevisionHistory||[];
    t.playoffRevisionHistory.push({
      archivedAt:new Date().toISOString(),
      status:t.status,
      groupAdvanceTieRule:t.groupAdvanceTieRule||'points',
      groupPenaltyTieBreak:!!t.groupPenaltyTieBreak,
      groupPenaltyWinners:JSON.parse(JSON.stringify(t.groupPenaltyWinners||{})),
      groupEliminations:JSON.parse(JSON.stringify(t.groupEliminations||[])),
      playoffStarted:!!t.playoffStarted,
      ko:t.ko?JSON.parse(JSON.stringify(t.ko)):null,
      dko:t.dko?JSON.parse(JSON.stringify(t.dko)):null
    });
    if(t.playoffRevisionHistory.length>5){
      t.playoffRevisionHistory=t.playoffRevisionHistory.slice(-5);
    }
  }

  window.prepareManualPlayoffReseed=async function(tid){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t || !['groups_sko','groups_dko'].includes(t.format) || !groupPhaseComplete(t) || !canManageTournament(t)){
      toast('Tento turnaj teď nelze ručně přenasadit.');
      return;
    }

    // Pokud už pavouk existuje, bezpečně ho archivujeme.
    if(t.playoffStarted || t.ko || t.dko){
      archiveCurrentTournamentPlayoff(t);
    }

    // Odstraníme pouze turnajový stav play-off. Skupiny a uložené zápasy/statistiky zůstávají.
    t.groupEliminations=[];
    t.playoffStarted=false;
    t.ko=null;
    t.dko=null;
    t.status='active';
    t.historicalEditMode=true;
    t.historicalEditStartedAt=new Date().toISOString();
    t.updatedAt=new Date().toISOString();

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Manual playoff reseed preparation:',e);
      toast('Původní pavouk se nepodařilo bezpečně uložit. Změna nebyla provedena.');
      return;
    }

    renderTournament();
    renderResultsTournaments();
    renderTournamentDetail();

    // Otevřeme rovnou ruční režim – bez dalšího přepínání.
    openGroupPlayoffSeedModal(t.id,'manual');
  };

  async function applyHistoricalTournamentReseed(){
    const t=(data.tournaments||[]).find(x=>x.id===historicalEditTournamentId);
    if(!t || !tournamentCanHistoricalReseed(t))return;

    archiveCurrentTournamentPlayoff(t);

    t.groupAdvanceTieRule=$('historicalTieRule').value||'points';
    t.groupPenaltyTieBreak=!!$('historicalPenaltyTieBreak').checked;
    t.groupPenaltyWinners={};
    t.groupEliminations=[];
    t.playoffStarted=false;
    t.ko=null;
    t.dko=null;
    t.status='active';
    t.historicalEditMode=true;
    t.historicalEditStartedAt=new Date().toISOString();
    t.updatedAt=new Date().toISOString();

    const unresolved=t.groupPenaltyTieBreak ? unresolvedGroupPenaltyTie(t) : null;
    if(!unresolved){
      startHybridPlayoff(t);
    }

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Historical tournament reseed save:',e);
      toast('Změnu turnaje se nepodařilo uložit.');
      return;
    }

    $('tournamentHistoricalEditModal').classList.remove('show');
    historicalEditTournamentId=null;

    renderTournament();
    renderResultsTournaments();
    renderTournamentDetail();

    if(unresolved){
      toast('Pravidla byla změněna. Před vytvořením pavouka je nutné rozhodnout penalty.');
      openGroupPenaltyPrompt(t);
    }else{
      toast('Play-off bylo znovu nasazeno podle aktuálních pravidel.');
    }
  }

  window.openHistoricalTournamentScore=function(tid,matchId){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    const m=t?findTournamentMatch(t,matchId):null;
    if(!t || !m || !canManageTournament(t) || m.status==='done' || m.winnerId || m.loserId)return;

    historicalScoreContext={tournamentId:tid,matchId};
    $('historicalTournamentScorePlayers').textContent=tournamentPlayerName(m.player1Id,t)+' vs '+tournamentPlayerName(m.player2Id,t);
    $('historicalTournamentP1Label').textContent=tournamentPlayerName(m.player1Id,t);
    $('historicalTournamentP2Label').textContent=tournamentPlayerName(m.player2Id,t);
    $('historicalTournamentScore1').value=0;
    $('historicalTournamentScore2').value=0;

    const info=$('historicalTournamentScoreModal')?.querySelector('.muted');
    if(info){
      info.textContent=t.historicalEditMode
        ? 'Výsledek se zapíše přímo do turnaje bez spuštění počítadla. Nevytvoří podrobné herní statistiky.'
        : 'Výsledek se zapíše přímo do turnaje bez spuštění počítadla. Započítá se do tabulky a dalšího průběhu turnaje, ale nevytvoří podrobné herní statistiky.';
    }

    $('historicalTournamentScoreModal').classList.add('show');
  };

  async function saveHistoricalTournamentScore(){
    const ctx=historicalScoreContext;
    const t=ctx?(data.tournaments||[]).find(x=>x.id===ctx.tournamentId):null;
    const tm=t?findTournamentMatch(t,ctx.matchId):null;
    if(!t || !tm || !canManageTournament(t))return;
    if(tm.status==='done' || tm.winnerId || tm.loserId){
      toast('Tento zápas už je dohraný.');
      return;
    }

    const s1=Math.max(0,Number($('historicalTournamentScore1').value||0));
    const s2=Math.max(0,Number($('historicalTournamentScore2').value||0));
    if(s1===s2){
      toast('Výsledek nemůže skončit remízou.');
      return;
    }

    const race=Math.max(1,Number(tournamentRaceForMatch(t,tm)||t.raceTo||1));
    const winnerScore=Math.max(s1,s2);
    if(winnerScore!==race){
      const ok=confirm('Turnaj je nastavený na Race to '+race+', ale vítěz má '+winnerScore+'. Opravdu tento výsledek uložit?');
      if(!ok)return;
    }

    const synthetic={
      id:'manual_tournament_'+Date.now(),
      tournamentLink:{tournamentId:t.id,tournamentMatchId:tm.id},
      endedAt:new Date().toISOString(),
      playerIds:[tm.player1Id,tm.player2Id],
      scores:[s1,s2],
      winner:s1>s2?0:1,
      source:'tournament_manual',
      evidenceMode:'basic'
    };

    processTournamentResult(synthetic);
    tm.manualResult=true;
    tm.manualResultAt=new Date().toISOString();
    tm.manualResultByUid=cloudUid||'';
    t.updatedAt=new Date().toISOString();

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Manual tournament score save:',e);
      toast('Výsledek se nepodařilo uložit.');
      return;
    }

    $('historicalTournamentScoreModal').classList.remove('show');
    historicalScoreContext=null;
    renderTournament();
    renderResultsTournaments();
    renderTournamentDetail();
    toast('Výsledek byl zapsán do turnaje.');
  }

  let groupPlayoffSeedTournamentId=null;

  function repairHybridWaitingState(t){
    if(!t || !['groups_sko','groups_dko'].includes(t.format))return false;
    if(!groupPhaseComplete(t))return false;

    const playoffMatches=t.format==='groups_sko'
      ? (t.ko?.rounds||[]).flatMap(r=>r.matches||[])
      : (t.dko?.rounds||[]).flatMap(r=>r.matches||[]);

    const playoffHasPlayedMatch=playoffMatches.some(m=>
      m && (m.status==='done' || m.winnerId || m.loserId)
    );

    // Opravujeme pouze STARÝ chybný stav, kdy byl hybridní turnaj po skupinách
    // omylem označen jako COMPLETE bez odehraného play-off.
    //
    // Důležité: nově vytvořený ruční pavouk je ACTIVE a zatím samozřejmě nemá
    // odehraný žádný play-off zápas. Ten se NESMÍ při renderu/refreshi smazat.
    if(!playoffHasPlayedMatch && t.status==='complete'){
      t.playoffStarted=false;
      t.ko=null;
      t.dko=null;
      t.groupEliminations=[];
      t.status='active';
      t.awaitingPlayoffSeeding=true;
      t.updatedAt=new Date().toISOString();
      return true;
    }

    if(!t.playoffStarted && !t.ko && !t.dko){
      if(t.status!=='active' || !t.awaitingPlayoffSeeding){
        t.status='active';
        t.awaitingPlayoffSeeding=true;
        t.updatedAt=new Date().toISOString();
        return true;
      }
    }

    return false;
  }

  function tournamentCanSeedFromGroups(t){
    return !!(
      t &&
      ['groups_sko','groups_dko'].includes(t.format) &&
      groupPhaseComplete(t) &&
      !t.playoffStarted &&
      canManageTournament(t)
    );
  }

  function groupPlayerOriginInfo(t,playerId){
    if(!t || !Array.isArray(t.groups) || !playerId)return null;
    for(const g of t.groups){
      if(!(g.players||[]).includes(playerId))continue;
      const rows=groupStandings(g,t);
      const idx=rows.findIndex(r=>r.id===playerId);
      return {
        groupId:g.id,
        groupName:g.name||('Skupina '+g.id),
        place:idx>=0?idx+1:null
      };
    }
    return null;
  }

  function groupPlayerOriginLabel(t,playerId){
    const info=groupPlayerOriginInfo(t,playerId);
    if(!info)return '';
    return `${info.groupId}${info.place?info.place+'.':''}`;
  }

  function groupPlayerOriginText(t,playerId){
    const info=groupPlayerOriginInfo(t,playerId);
    if(!info)return '';
    return `${info.groupName}${info.place?' • '+info.place+'. místo':''}`;
  }

  function buildManualGroupSeedEditor(t){
    const wrap=$('groupPlayoffManualList');
    if(!wrap)return;

    const advance=Math.max(1,Number(t.advancePerGroup||2));
    const playoffSlots=Math.max(2,(t.groups||[]).length*advance);

    // Ruční režim nabízí všechny hráče ze skupin.
    // Aktuální pořadí skupiny se zobrazuje pouze jako informace, ale neomezuje výběr.
    const candidates=[];
    for(const g of (t.groups||[])){
      const rows=groupStandings(g,t);
      rows.forEach((r,i)=>candidates.push({
        id:r.id,
        groupId:g.id,
        groupName:g.name||('Skupina '+g.id),
        place:i+1
      }));
    }

    const candidateIds=candidates.map(q=>q.id);
    const existing=(t.manualGroupPlayoffOrder||[]).filter(id=>candidateIds.includes(id));

    // Výchozí návrh je jen pomůcka. Při shodě ve skupině nic nerozhodujeme za organizátora;
    // ruční výběr může být libovolný.
    const suggested=[];
    for(const g of (t.groups||[])){
      groupStandings(g,t).slice(0,advance).forEach(r=>suggested.push(r.id));
    }
    const order=existing.length===playoffSlots ? existing : suggested.slice(0,playoffSlots);

    const options=candidates.map(q=>`
      <option value="${q.id}">
        ${escapeHtml(tournamentPlayerName(q.id,t))} • ${escapeHtml(q.groupName)} • ${q.place}. místo
      </option>`).join('');

    const pairCount=Math.floor(playoffSlots/2);
    let html=`
      <div class="subpanel" style="margin-bottom:12px;border-color:rgba(212,175,55,.25)">
        <strong>POSTUPUJÍCÍ DO PLAY-OFF: ${playoffSlots}</strong>
        <div class="muted" style="margin-top:5px">
          Výběr není omezen automatickým pořadím ve skupině. Můžeš zvolit přesně stejné postupující jako v papírovém turnaji.
        </div>
      </div>`;

    for(let pair=0;pair<pairCount;pair++){
      const aIndex=pair*2;
      const bIndex=aIndex+1;
      const label=playoffSlots===8
        ? 'QF '+(pair+1)
        : (playoffSlots===4 ? 'SF '+(pair+1) : 'ZÁPAS '+(pair+1));

      html+=`
        <div class="subpanel" style="margin-bottom:10px;border-color:rgba(212,175,55,.38)">
          <strong>${label}</strong>
          <div class="grid two" style="margin-top:8px">
            <div>
              <label>Hráč 1</label>
              <select class="manual-playoff-slot" data-slot="${aIndex}">
                <option value="">— vyber hráče —</option>
                ${options}
              </select>
            </div>
            <div>
              <label>Hráč 2</label>
              <select class="manual-playoff-slot" data-slot="${bIndex}">
                <option value="">— vyber hráče —</option>
                ${options}
              </select>
            </div>
          </div>
        </div>`;
    }

    wrap.innerHTML=html;

    order.forEach((id,i)=>{
      const sel=wrap.querySelector(`select[data-slot="${i}"]`);
      if(sel)sel.value=id;
    });

    const semiBox=$('groupPlayoffSemiRoutingBox');
    const showSemi=t.format==='groups_sko' && playoffSlots===8;
    if(semiBox)semiBox.classList.toggle('hidden',!showSemi);
    if(showSemi && $('groupPlayoffSemiRouting')){
      $('groupPlayoffSemiRouting').value=t.manualGroupPlayoffSemiRouting||'cross13';
    }
  }

  window.openGroupPlayoffSeedModal=function(tid,initialMode='rules'){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t || !tournamentCanSeedFromGroups(t)){
      toast('Skupiny ještě nejsou připravené k nasazení.');
      return;
    }
    groupPlayoffSeedTournamentId=tid;

    const manual=initialMode==='manual';
    $('groupPlayoffSeedMode').value=manual?'manual':'rules';
    $('groupPlayoffTieRule').value=t.groupAdvanceTieRule||'points';
    $('groupPlayoffPenaltyTieBreak').checked=!!t.groupPenaltyTieBreak;
    $('groupPlayoffSeedRulesBox').classList.toggle('hidden',manual);
    $('groupPlayoffManualBox').classList.toggle('hidden',!manual);

    buildManualGroupSeedEditor(t);

    const status=$('groupPlayoffSeedStatus');
    if(status)status.textContent='';

    const applyBtn=$('groupPlayoffSeedApplyBtn');
    if(applyBtn){
      applyBtn.disabled=false;
      applyBtn.onclick=async()=>{
        if(status)status.textContent='Kliknutí zachyceno • nasazuji play-off…';
        applyBtn.disabled=true;
        try{
          await applyGroupPlayoffSeedingInternal();
        }catch(e){
          console.error('Manual playoff apply fatal:',e);
          const msg='Chyba při nasazení: '+String(e?.message||e||'neznámá chyba');
          if(status)status.textContent=msg;
          toast(msg);
        }finally{
          applyBtn.disabled=false;
        }
      };
    }

    $('groupPlayoffSeedModal').classList.add('show');
  };

  function collectManualPlayoffOrder(t){
    const advance=Math.max(1,Number(t.advancePerGroup||2));
    const playoffSlots=Math.max(2,(t.groups||[]).length*advance);
    const allowedIds=(t.groups||[]).flatMap(g=>g.players||[]);

    const selects=[...($('groupPlayoffManualList')?.querySelectorAll('.manual-playoff-slot')||[])]
      .sort((a,b)=>Number(a.dataset.slot)-Number(b.dataset.slot));

    const order=selects.map(sel=>sel.value||'');

    if(order.length!==playoffSlots || order.some(id=>!id)){
      return {error:'Vyber hráče do všech pozic prvního kola play-off.'};
    }

    if(new Set(order).size!==order.length){
      return {error:'Jeden hráč nemůže být nasazen do play-off dvakrát.'};
    }

    const allowed=new Set(allowedIds);
    if(order.some(id=>!allowed.has(id))){
      return {error:'Do play-off lze vybrat pouze hráče z tohoto turnaje.'};
    }

    return {order};
  }

  async function applyGroupPlayoffSeedingInternal(){
    const status=$('groupPlayoffSeedStatus');
    const setStatus=msg=>{if(status)status.textContent=msg;};

    const t=(data.tournaments||[]).find(x=>x.id===groupPlayoffSeedTournamentId);
    const mode=$('groupPlayoffSeedMode')?.value||'rules';

    setStatus('Kontroluji turnaj…');

    if(!t){
      setStatus('Turnaj se nepodařilo najít.'); toast('Turnaj se nepodařilo najít.');
      return;
    }
    if(!['groups_sko','groups_dko'].includes(t.format)){
      setStatus('Tento formát nelze ručně nasadit.'); toast('Ruční nasazení je dostupné pouze pro Skupiny → SKO / DKO.');
      return;
    }
    if(!canManageTournament(t)){
      setStatus('Nemáš oprávnění upravovat turnaj.'); toast('Tento turnaj nemůžeš upravovat.');
      return;
    }
    if(!groupPhaseComplete(t)){
      setStatus('Nejsou dohrané všechny zápasy ve skupinách.'); toast('Nejdřív musí být zapsané výsledky všech zápasů ve skupinách.');
      return;
    }

    // U ručního režimu záměrně nevyžadujeme jednoznačné pořadí skupin.
    // Kruhová shoda / vzájemné porážky se vyřeší tím, koho organizátor sám vybere.
    if(mode!=='manual' && !tournamentCanSeedFromGroups(t)){
      toast('Automatické nasazení zatím nelze vytvořit. Zkus ruční nasazení.');
      return;
    }

    let manualOrder=null;

    if(mode==='manual'){
      const selects=[...($('groupPlayoffManualList')?.querySelectorAll('.manual-playoff-slot')||[])];
      if(!selects.length){
        setStatus('Ruční seznam hráčů se nenačetl.'); toast('Ruční seznam hráčů se nenačetl. Zavři okno a otevři RUČNĚ NASADIT PLAY-OFF znovu.');
        return;
      }
    }

    if(mode==='rules'){
      t.groupAdvanceTieRule=$('groupPlayoffTieRule').value||'points';
      t.groupPenaltyTieBreak=!!$('groupPlayoffPenaltyTieBreak').checked;
      t.groupPenaltyWinners={};

      const unresolved=t.groupPenaltyTieBreak ? unresolvedGroupPenaltyTie(t) : null;
      if(unresolved){
        $('groupPlayoffSeedModal').classList.remove('show');
        groupPlayoffSeedTournamentId=null;
        await saveSecureTournament(t);
        renderTournamentDetail();
        openGroupPenaltyPrompt(t);
        return;
      }
    }else{
      const collected=collectManualPlayoffOrder(t);
      if(collected.error){
        setStatus(collected.error);
        toast(collected.error);
        return;
      }

      manualOrder=collected.order;

      // Pokud by se sem už existující pavouk dostal jinou cestou,
      // nejdřív ho zazálohujeme a teprve pak ručně vytvoříme nový.
      if(t.playoffStarted || t.ko || t.dko){
        archiveCurrentTournamentPlayoff(t);
      }
      t.playoffStarted=false;
      t.ko=null;
      t.dko=null;
      t.groupEliminations=[];

      t.manualGroupPlayoffOrder=[...manualOrder];
      t.manualGroupPlayoffSemiRouting=$('groupPlayoffSemiRouting')?.value||'cross13';
      t.groupAdvanceTieRule='manual';
      t.groupPenaltyTieBreak=false;
      t.groupPenaltyWinners={};
    }

    const started=startHybridPlayoff(t,manualOrder);
    if(!started){
      const msg=mode==='manual'
        ? 'Play-off se nepodařilo vytvořit. Zkontroluj dohrání skupin a všechny pozice.'
        : 'Play-off se zatím nepodařilo vytvořit.';
      setStatus(msg);
      toast(msg);
      return;
    }

    setStatus('Pavouk vytvořen • ukládám do cloudu…');
    toast('Pavouk vytvořen • ukládám…');
    t.updatedAt=new Date().toISOString();

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Group playoff seeding save:',e);
      setStatus('Pavouk vznikl, ale nepodařilo se ho uložit do cloudu.');
      toast('Nasazení play-off se nepodařilo uložit.');
      return;
    }

    setStatus(mode==='manual'?'Hotovo • play-off bylo nasazeno ručně.':'Hotovo • play-off bylo nasazeno podle pravidel.');
    groupPlayoffSeedTournamentId=null;
    renderTournament();
    renderResultsTournaments();
    renderTournamentDetail();
    toast(mode==='manual'?'Play-off bylo nasazeno ručně.':'Play-off bylo nasazeno podle zvolených pravidel.');
    setTimeout(()=>$('groupPlayoffSeedModal').classList.remove('show'),450);
  }

  let swissScoreContext=null;

  window.openSwissScore=function(tid,matchId){
    const t=(data.tournaments||[]).find(x=>x.id===tid);
    const m=t?findTournamentMatch(t,matchId):null;

    if(!t || t.format!=='swiss' || !m || !canManageTournament(t)){
      toast('Tento výsledek nelze upravit.');
      return;
    }
    if(m.status==='done' || m.winnerId){
      toast('Tento zápas už je dohraný.');
      return;
    }

    swissScoreContext={tournamentId:tid,matchId};
    const p1=tournamentPlayerName(m.player1Id,t);
    const p2=tournamentPlayerName(m.player2Id,t);

    $('swissScorePlayers').textContent=p1+' vs '+p2;
    $('swissScoreP1Label').textContent=p1;
    $('swissScoreP2Label').textContent=p2;
    $('swissScore1').value=0;
    $('swissScore2').value=0;
    $('swissScoreModal').classList.add('show');
  };

  async function saveSwissScore(){
    const ctx=swissScoreContext;
    const t=ctx?(data.tournaments||[]).find(x=>x.id===ctx.tournamentId):null;
    const tm=t?findTournamentMatch(t,ctx.matchId):null;

    if(!t || t.format!=='swiss' || !tm || !canManageTournament(t))return;

    const s1=Math.max(0,Number($('swissScore1').value||0));
    const s2=Math.max(0,Number($('swissScore2').value||0));

    if(s1===s2){
      toast('Výsledek nemůže skončit remízou.');
      return;
    }

    const synthetic={
      id:'swiss_manual_'+Date.now(),
      tournamentLink:{
        tournamentId:t.id,
        tournamentMatchId:tm.id
      },
      endedAt:new Date().toISOString(),
      playerIds:[tm.player1Id,tm.player2Id],
      playerNames:[
        tournamentPlayerName(tm.player1Id,t),
        tournamentPlayerName(tm.player2Id,t)
      ],
      scores:[s1,s2],
      winner:s1>s2?0:1
    };

    processTournamentResult(synthetic);
    t.updatedAt=new Date().toISOString();

    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Swiss manual result save:',e);
      toast('Výsledek se nepodařilo uložit.');
      return;
    }

    $('swissScoreModal').classList.remove('show');
    swissScoreContext=null;

    renderTournament();
    renderResultsTournaments();
    renderTournamentDetail();

    toast('Výsledek byl zapsán.');
  }

  function renderTournamentMatch(t,m){
    const done=(m.status==='done'||!!m.winnerId||!!m.loserId),playing=(!done&&m.status==='playing'&&!!m.scoreboardMatchId);
    const invalidDKO=!done && !!t.dko && (dkoPlayerIsOut(t,m.player1Id)||dkoPlayerIsOut(t,m.player2Id));
    return `<div class="tournament-match ${done?'done':''}" ${invalidDKO?'style="opacity:.55"':''}>
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px">
        <span class="tournament-badge ${m.bracket==='W'||m.bracket==='GF'?'gold':''}">${esc(m.roundLabel||m.bracket||'Zápas')} • RT ${tournamentRaceForMatch(t,m)}</span>
        <span class="muted">${done?'DOHRÁNO':(invalidDKO?'NEPLATNÝ – HRÁČ OUT':(playing?'ROZEHRÁNO':(tournamentMatchHasBusyPlayer(t,m)?'ČEKÁ NA HRÁČE':(m.tableNumber?'STŮL '+m.tableNumber:'PŘIPRAVENO'))))}</span>
      </div>
      <div class="tm-row">
        <div class="tm-p">
          ${esc(tournamentPlayerName(m.player1Id,t))}
          ${['groups_sko','groups_dko'].includes(t.format) && !tournamentMatchIsGroupMatch(t,m)
            ? `<div class="muted" style="font-size:11px;margin-top:4px">${esc(groupPlayerOriginText(t,m.player1Id))}</div>`
            : ''}
        </div>
        <div class="tm-score">${done?(m.score1+' : '+m.score2):'VS'}</div>
        <div class="tm-p">
          ${esc(tournamentPlayerName(m.player2Id,t))}
          ${['groups_sko','groups_dko'].includes(t.format) && !tournamentMatchIsGroupMatch(t,m)
            ? `<div class="muted" style="font-size:11px;margin-top:4px">${esc(groupPlayerOriginText(t,m.player2Id))}</div>`
            : ''}
        </div>
      </div>
      ${!done?`<div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:9px;flex-wrap:wrap">
        ${m.tableNumber?`<span class="tournament-badge gold">STŮL ${m.tableNumber}</span>`:''}
        ${canManageTournament(t)
          ? `${t.format==='swiss'
              ? `<div style="display:flex;gap:7px;flex-wrap:wrap">
                  <button class="btn primary" onclick="startTournamentMatch('${t.id}','${m.id}')">${playing?'POKRAČOVAT':'HRÁT PŘES POČÍTADLO'}</button>
                  <button class="btn" onclick="openSwissScore('${t.id}','${m.id}')">ZAPSAT JEN VÝSLEDEK</button>
                </div>`
              : (t.historicalEditMode
                  ? `<button class="btn primary" ${invalidDKO?`disabled title="Hráč už má 2 prohry a je vyřazen"`:''} onclick="openHistoricalTournamentScore('${t.id}','${m.id}')">${invalidDKO?'OUT':'ZAPSAT VÝSLEDEK'}</button>`
                  : `<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:center">
                      <button class="btn primary" ${invalidDKO?`disabled title="Hráč už má 2 prohry a je vyřazen"`:''} onclick="startTournamentMatch('${t.id}','${m.id}')">${invalidDKO?'OUT':(playing?'POKRAČOVAT':'HRÁT PŘES POČÍTADLO')}</button>
                      <button class="btn" ${invalidDKO?`disabled title="Hráč už má 2 prohry a je vyřazen"`:''} onclick="openHistoricalTournamentScore('${t.id}','${m.id}')">${invalidDKO?'OUT':'ZADAT VÝSLEDEK'}</button>
                    </div>`
                )
            }`
          : `<span class="muted">${playing?'PROBÍHÁ • pouze ke sledování':'Pouze ke sledování'}</span>`
        }
      </div>`:''}
    </div>`;
  }


  function ensureGroupRoundOrder(group){
    if(!group || !(group.players||[]).length)return;

    const schedule=roundRobinSchedule(group.players);
    const pairMap=new Map();

    schedule.forEach((pairs,roundIndex)=>{
      pairs.forEach(([a,b],matchIndex)=>{
        const key=[a,b].sort().join('|');
        pairMap.set(key,{
          roundNumber:roundIndex+1,
          roundOrder:matchIndex+1,
          roundLabel:'Kolo '+(roundIndex+1)
        });
      });
    });

    (group.matches||[]).forEach(m=>{
      if(m.roundNumber)return;
      const key=[m.player1Id,m.player2Id].sort().join('|');
      const meta=pairMap.get(key);
      if(meta)Object.assign(m,meta);
    });
  }

  function groupRoundNumberForMatch(t,m){
    if(!t || t.format!=='groups' || !m)return Number.MAX_SAFE_INTEGER;
    for(const g of (t.groups||[])){
      const found=(g.matches||[]).find(x=>x.id===m.id);
      if(found)return Number(found.roundNumber||Number.MAX_SAFE_INTEGER);
    }
    return Number.MAX_SAFE_INTEGER;
  }

  function roundRobinOverallStandings(t){
    if(!t || !Array.isArray(t.groups))return [];

    // U čistého "každý s každým" je každá skupina samostatná tabulka.
    // Pokud je jen jedna skupina, pořadí je jednoznačné 1., 2., 3. ...
    if(t.groups.length===1){
      const st=groupStandings(t.groups[0],t);
      return st.map((r,i)=>({
        playerId:r.id,
        place:i+1,
        label:(i+1)+'. místo',
        z:r.z,v:r.v,p:r.p,rf:r.rf,ra:r.ra,diff:r.diff
      }));
    }

    // Starší čisté skupinové turnaje s více skupinami nemají play-off,
    // proto nelze korektně určit absolutní pořadí napříč skupinami.
    return [];
  }

  function renderRoundRobinFinalSummary(t){
    if(!t || t.format!=='groups' || t.status!=='complete')return '';

    const rows=roundRobinOverallStandings(t);

    if(rows.length){
      return `<div class="subpanel" style="margin-bottom:12px;border-color:var(--gold)">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <strong>KONEČNÉ POŘADÍ TURNAJE</strong>
          <span class="tournament-badge gold">TURNAJ DOHRÁN</span>
        </div>
        <div style="overflow:auto;margin-top:10px">
          <table class="stats-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Hráč</th>
                <th>Z</th>
                <th>V</th>
                <th>P</th>
                <th>Racky</th>
                <th>+/-</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r=>`<tr>
                <td class="standings-pos">${r.place}.</td>
                <td><strong>${esc(tournamentPlayerName(r.playerId,t))}</strong></td>
                <td class="num">${r.z}</td>
                <td class="num">${r.v}</td>
                <td class="num">${r.p}</td>
                <td class="num">${r.rf}:${r.ra}</td>
                <td class="num">${r.diff>0?'+':''}${r.diff}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
    }

    return `<div class="subpanel" style="margin-bottom:12px;border-color:var(--gold)">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
        <strong>KONEČNÉ VÝSLEDKY SKUPIN</strong>
        <span class="tournament-badge gold">TURNAJ DOHRÁN</span>
      </div>
      <div class="muted" style="margin-top:6px">
        Tento starší turnaj obsahuje více samostatných skupin bez následného play-off, takže z dat nelze korektně určit jedno společné 1.–N. místo.
      </div>
    </div>`;
  }

  function renderGroupTournament(t){
    const finalSummary=renderRoundRobinFinalSummary(t);
    return `${finalSummary}<div class="tournament-columns">${t.groups.map(g=>{
      ensureGroupRoundOrder(g);
      const st=groupStandings(g,t);

      const roundMap=new Map();
      (g.matches||[])
        .slice()
        .sort((a,b)=>
          Number(a.roundNumber||999)-Number(b.roundNumber||999) ||
          Number(a.roundOrder||999)-Number(b.roundOrder||999)
        )
        .forEach(m=>{
          const rn=Number(m.roundNumber||999);
          if(!roundMap.has(rn))roundMap.set(rn,[]);
          roundMap.get(rn).push(m);
        });

      const roundsHtml=[...roundMap.entries()].map(([rn,matches])=>`
        <div class="subpanel" style="margin-top:12px">
          <div style="font-weight:900;color:var(--gold2);margin-bottom:8px">KOLO ${rn}</div>
          ${matches.map(m=>renderTournamentMatch(t,m)).join('')}
        </div>
      `).join('');

      return `<div class="tournament-round">
        <h4>SKUPINA ${esc(g.id)}</h4>
        <div style="overflow:auto"><table class="stats-table">
          <thead><tr><th>#</th>${t.seedingMode==='manual'?'<th>Nasazení</th>':''}<th>Hráč</th><th>Z</th><th>V</th><th>P</th><th>Racky</th><th>+/-</th></tr></thead>
          <tbody>${st.map((r,i)=>{
            const seedPos=(g.players||[]).indexOf(r.id)+1;
            return `<tr>
              <td class="standings-pos">${i+1}${t.format!=='groups'&&i<Number(t.advancePerGroup||0)?' Q':''}</td>
              ${t.seedingMode==='manual'?`<td class="num">${esc(g.id)}${seedPos}</td>`:''}
              <td><strong>${esc(tournamentPlayerName(r.id,t))}</strong></td>
              <td class="num">${r.z}</td><td class="num">${r.v}</td><td class="num">${r.p}</td>
              <td class="num">${r.rf}:${r.ra}</td><td class="num">${r.diff>0?'+':''}${r.diff}</td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
        <div style="margin-top:12px">${roundsHtml}</div>
      </div>`;
    }).join('')}</div>`;
  }


  function knockoutPlacementRows(t){
    const k=t.ko;
    const rows=[];
    if(k.championId)rows.push({place:'1. místo',ids:[k.championId]});
    if(k.runnerUpId)rows.push({place:'2. místo',ids:[k.runnerUpId]});

    if(k.thirdPlacePlayoff){
      if(k.thirdPlaceWinnerId)rows.push({place:'3. místo',ids:[k.thirdPlaceWinnerId]});
      if(k.thirdPlaceLoserId)rows.push({place:'4. místo',ids:[k.thirdPlaceLoserId]});
    }else{
      const bronze=(k.eliminations||[]).filter(e=>Number(e.place||999)<=4).slice(0,2);
      if(bronze.length)rows.push({place:'3. místo',ids:bronze.map(e=>e.playerId)});
    }

    const bands=new Map();
    (k.eliminations||[]).forEach(e=>{
      if(Number(e.place||0)<=4)return;
      const label=genericPlacementLabel(e.place);
      if(!bands.has(label))bands.set(label,[]);
      bands.get(label).push(e.playerId);
    });
    bands.forEach((ids,place)=>rows.push({place,ids}));

    (t.groupEliminations||[]).forEach(e=>{
      const label=genericPlacementLabel(e.place);
      let row=rows.find(r=>r.place===label);
      if(!row){row={place:label,ids:[]};rows.push(row);}
      if(!row.ids.includes(e.playerId))row.ids.push(e.playerId);
    });
    return rows;
  }

  function renderTournamentBye(t,b,label='VOLNÝ LOS'){
    if(!b?.playerId)return '';
    return `<div class="tournament-match done" style="border-color:rgba(212,175,55,.48);background:rgba(212,175,55,.06)">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px">
        <span class="tournament-badge gold">${esc(label)}</span>
        <span class="muted">POSTUP BEZ ZÁPASU</span>
      </div>
      <div style="text-align:center;font-size:18px;font-weight:950;color:var(--gold2);padding:8px 4px">
        ${esc(tournamentPlayerName(b.playerId,t))}
      </div>
    </div>`;
  }

function renderSKOTournament(t){
    const k=t.ko;
    const rows=knockoutPlacementRows(t);
    return `
      ${k.championId?`<div class="subpanel" style="text-align:center;border-color:var(--gold);margin-bottom:12px">
        <div class="muted">VÍTĚZ TURNAJE</div>
        <div style="font-size:30px;font-weight:950;color:var(--gold2)">${esc(tournamentPlayerName(k.championId,t))}</div>
      </div>`:''}

      ${rows.length?`<div class="subpanel" style="margin-bottom:12px;${t.status==='complete'?'border-color:var(--gold);':''}">
        <strong>${t.status==='complete'?'KONEČNÁ TABULKA VÝSLEDKŮ':'PRŮBĚŽNÉ POŘADÍ'}</strong>
        <div style="overflow:auto;margin-top:10px"><table class="stats-table">
          <thead><tr><th>Pořadí</th><th>Hráč / hráči</th></tr></thead>
          <tbody>${rows.map(r=>`<tr><td><strong style="color:var(--gold2)">${esc(r.place)}</strong></td><td>${r.ids.map(id=>esc(tournamentPlayerName(id,t))).join(', ')}</td></tr>`).join('')}</tbody>
        </table></div>
      </div>`:''}

      <div class="subpanel" style="margin-bottom:12px">
        <strong>Stav SKO</strong>
        <div class="muted" style="margin-top:3px">Jedna prohra = vyřazení • ${k.thirdPlacePlayoff?'hraje se o 3. místo':'bez zápasu o 3. místo = dvě 3. místa'}.</div>
      </div>

      <div class="tournament-columns">${(k.rounds||[]).map(r=>`<div class="tournament-round">
        <h4>${esc(r.label)}</h4>
        ${(r.byes||[]).map(b=>renderTournamentBye(t,b,'VOLNÝ LOS • BYE')).join('')}
        ${(r.matches||[]).map(m=>renderTournamentMatch(t,m)).join('')}
      </div>`).join('')}</div>`;
  }


  function inlineManualPlayoffEditorHtml(t){
    if(!t || !['groups_sko','groups_dko'].includes(t.format) || !groupPhaseComplete(t) || t.playoffStarted)return '';

    const advance=Math.max(1,Number(t.advancePerGroup||2));
    const playoffSlots=Math.max(2,(t.groups||[]).length*advance);

    const candidates=[];
    for(const g of (t.groups||[])){
      const rows=groupStandings(g,t);
      rows.forEach((r,i)=>candidates.push({
        id:r.id,
        groupName:g.name||('Skupina '+g.id),
        place:i+1
      }));
    }

    const candidateIds=candidates.map(x=>x.id);
    const existing=(t.manualGroupPlayoffOrder||[]).filter(id=>candidateIds.includes(id));

    const suggested=[];
    for(const g of (t.groups||[])){
      groupStandings(g,t).slice(0,advance).forEach(r=>suggested.push(r.id));
    }
    const order=existing.length===playoffSlots ? existing : suggested.slice(0,playoffSlots);

    function optionsForSlot(slotIndex){
      return candidates.map(q=>`
        <option value="${esc(q.id)}" ${order[slotIndex]===q.id?'selected':''}>
          ${esc(tournamentPlayerName(q.id,t))} • ${esc(q.groupName)} • ${q.place}. místo
        </option>`).join('');
    }

    const pairCount=Math.floor(playoffSlots/2);
    let pairsHtml='';

    for(let pair=0;pair<pairCount;pair++){
      const a=pair*2,b=a+1;
      const label=playoffSlots===8?'QF '+(pair+1):(playoffSlots===4?'SF '+(pair+1):'ZÁPAS '+(pair+1));
      pairsHtml+=`
        <div class="subpanel" style="margin-bottom:10px;border-color:rgba(212,175,55,.35)">
          <strong>${label}</strong>
          <div class="grid two" style="margin-top:8px">
            <div>
              <label>Hráč 1</label>
              <select class="inline-manual-playoff-slot" data-tournament-id="${esc(t.id)}" data-slot="${a}">
                <option value="">— vyber hráče —</option>
                ${optionsForSlot(a)}
              </select>
            </div>
            <div>
              <label>Hráč 2</label>
              <select class="inline-manual-playoff-slot" data-tournament-id="${esc(t.id)}" data-slot="${b}">
                <option value="">— vyber hráče —</option>
                ${optionsForSlot(b)}
              </select>
            </div>
          </div>
        </div>`;
    }

    const routing=t.manualGroupPlayoffSemiRouting||'cross13';

    return `
      <details class="subpanel" open style="margin-top:14px;border-color:var(--gold)">
        <summary style="cursor:pointer;font-weight:950;font-size:18px">RUČNÍ NASAZENÍ PLAY-OFF</summary>
        <div class="muted" style="margin-top:8px">
          Vyber postupující přímo ze seznamu všech hráčů ve skupinách. Shody ve skupinách ruční nasazení neblokují.
        </div>

        <div id="inlineManualPlayoffEditor_${esc(t.id)}" style="margin-top:12px">
          ${pairsHtml}
        </div>

        ${t.format==='groups_sko' && playoffSlots===8 ? `
          <div class="subpanel" style="margin-top:12px">
            <label>Napojení čtvrtfinále do semifinále</label>
            <select id="inlineSemiRouting_${esc(t.id)}">
              <option value="cross13" ${routing==='cross13'?'selected':''}>Vítěz QF1 × vítěz QF3 • vítěz QF2 × vítěz QF4</option>
              <option value="cross14" ${routing==='cross14'?'selected':''}>Vítěz QF1 × vítěz QF4 • vítěz QF2 × vítěz QF3</option>
              <option value="adjacent" ${routing==='adjacent'?'selected':''}>Vítěz QF1 × vítěz QF2 • vítěz QF3 × vítěz QF4</option>
            </select>
          </div>` : ''}

        <div id="inlineManualPlayoffStatus_${esc(t.id)}" class="muted" style="margin-top:10px;min-height:20px"></div>
        <button class="btn primary big inline-manual-playoff-apply" data-tournament-id="${esc(t.id)}" type="button" style="width:100%;margin-top:10px">
          VYTVOŘIT PLAY-OFF PODLE TOHOTO NASAZENÍ
        </button>
      </details>`;
  }

  async function applyInlineManualPlayoff(tid){
    const status=$('inlineManualPlayoffStatus_'+tid);
    const setStatus=msg=>{if(status)status.textContent=msg;};

    const t=(data.tournaments||[]).find(x=>x.id===tid);
    if(!t){
      setStatus('Turnaj nebyl nalezen.');
      return;
    }
    if(!['groups_sko','groups_dko'].includes(t.format)){
      setStatus('Tento formát nepodporuje ruční nasazení ze skupin.');
      return;
    }
    if(!canManageTournament(t)){
      setStatus('Nemáš oprávnění turnaj upravovat.');
      return;
    }
    if(!groupPhaseComplete(t)){
      setStatus('Nejdřív musí být dohrané všechny zápasy ve skupinách.');
      return;
    }

    const selects=[...document.querySelectorAll('.inline-manual-playoff-slot[data-tournament-id="'+CSS.escape(tid)+'"]')]
      .sort((a,b)=>Number(a.dataset.slot)-Number(b.dataset.slot));
    const order=selects.map(s=>s.value||'');

    const advance=Math.max(1,Number(t.advancePerGroup||2));
    const playoffSlots=Math.max(2,(t.groups||[]).length*advance);
    const allowedIds=(t.groups||[]).flatMap(g=>g.players||[]);

    if(order.length!==playoffSlots || order.some(id=>!id)){
      setStatus('Vyber hráče do všech pozic play-off.');
      return;
    }
    if(new Set(order).size!==order.length){
      setStatus('Jeden hráč je vybraný vícekrát.');
      return;
    }
    if(order.some(id=>!allowedIds.includes(id))){
      setStatus('Vybraný hráč není účastníkem tohoto turnaje.');
      return;
    }

    setStatus('Vytvářím pavouk…');

    if(t.playoffStarted || t.ko || t.dko){
      archiveCurrentTournamentPlayoff(t);
    }

    t.playoffStarted=false;
    t.ko=null;
    t.dko=null;
    t.groupEliminations=[];
    t.status='active';
    t.awaitingPlayoffSeeding=true;

    t.manualGroupPlayoffOrder=[...order];
    t.manualGroupPlayoffSemiRouting=$('inlineSemiRouting_'+tid)?.value||'cross13';
    t.groupAdvanceTieRule='manual';
    t.groupPenaltyTieBreak=false;
    t.groupPenaltyWinners={};

    const started=startHybridPlayoff(t,order);
    if(!started){
      setStatus('Pavouk se nepodařilo vytvořit.');
      return;
    }

    setStatus('Pavouk vytvořen • ukládám…');
    try{
      await saveSecureTournament(t);
    }catch(e){
      console.error('Inline manual playoff save:',e);
      setStatus('Pavouk vznikl, ale nepodařilo se ho uložit do cloudu.');
      return;
    }

    const playoffMatchCount=t.format==='groups_sko'
      ? (t.ko?.rounds||[]).flatMap(r=>r.matches||[]).length
      : (t.dko?.rounds||[]).flatMap(r=>r.matches||[]).length;

    renderTournament();
    renderResultsTournaments();
    renderTournamentDetail();
    renderLive();

    toast(playoffMatchCount
      ? 'Play-off bylo nasazeno ručně • vytvořeno '+playoffMatchCount+' zápasů.'
      : 'Play-off bylo nasazeno, ale nebyl vytvořen žádný zápas.');
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('.inline-manual-playoff-apply');
    if(!btn)return;
    const tid=btn.dataset.tournamentId;
    if(!tid)return;

    btn.disabled=true;
    Promise.resolve(applyInlineManualPlayoff(tid))
      .catch(err=>{
        console.error('Inline manual playoff fatal:',err);
        const status=$('inlineManualPlayoffStatus_'+tid);
        if(status)status.textContent='Chyba: '+String(err?.message||err||'neznámá chyba');
      })
      .finally(()=>{btn.disabled=false;});
  });

  function renderHybridTournament(t){
    const groupHtml=renderGroupTournament(t);
    if(!t.playoffStarted){
      return `${groupHtml}<div class="subpanel" style="margin-top:14px"><strong>PLAY-OFF</strong><div class="muted" style="margin-top:5px">
        ${groupPhaseComplete(t)
          ? '<strong>Skupiny jsou dohrané • čeká se na nasazení play-off.</strong>'
          : `Po dohrání všech skupin postoupí ${t.advancePerGroup||2} hráči z každé skupiny do ${t.format==='groups_dko'?'DKO':'SKO'}.`}
        <div style="margin-top:5px">
          Shoda bodů: <strong>${t.groupAdvanceTieRule==='head_to_head'?'vzájemný zápas':(t.groupAdvanceTieRule==='manual'?'ruční nasazení':'body / skóre ve skupině')}</strong>
          ${t.groupPenaltyTieBreak?' • pokud nerozhodne, následují penalty':''}.
        </div>
      </div>
      </div>
      ${groupPhaseComplete(t) ? inlineManualPlayoffEditorHtml(t) : ''}`;
    }
    const playoff=t.format==='groups_dko'?renderDKOTournament(t):renderSKOTournament(t);
    return `<div class="subpanel" style="margin-bottom:12px">
      <strong>SKUPINOVÁ FÁZE</strong>
      <div class="muted" style="margin-top:5px">
        Shoda bodů: <strong>${t.groupAdvanceTieRule==='head_to_head'?'vzájemný zápas':'body / skóre ve skupině'}</strong>
        ${t.groupPenaltyTieBreak?' • pokud nerozhodne, následují penalty':''}.
      </div>
    </div>${groupHtml}
      <div class="hr"></div><h2 style="margin:0 0 10px">PLAY-OFF • ${t.format==='groups_dko'?'DKO':'SKO'}</h2>${playoff}`;
  }

  function renderDKOTournament(t){
    const d=t.dko,eliminated=(d.participantIds||t.playerIds||[]).filter(id=>(d.losses[id]||0)>=2);

    const finalRows=[];
    if(d.championId){
      finalRows.push({label:'1. místo',id:d.championId});
      const gf=dkoFinalMatch(t);
      const runner=d.runnerUpId||gf?.loserId||null;
      if(runner)finalRows.push({label:'2. místo',id:runner});
    }

    if(d.thirdPlacePlayoff){
      if(d.thirdPlaceWinnerId)finalRows.push({label:'3. místo',id:d.thirdPlaceWinnerId});
      if(d.thirdPlaceLoserId)finalRows.push({label:'4. místo',id:d.thirdPlaceLoserId});
    }else{
      const bronze=(d.eliminations||[])
        .filter(e=>Number(e.place||999)<=4)
        .sort((a,b)=>Number(a.place||999)-Number(b.place||999));
      bronze.forEach(e=>finalRows.push({label:'3. místo',id:e.playerId}));
    }

    const lowerGroups=new Map();
    (d.eliminations||[]).forEach(e=>{
      if(Number(e.place||0)<=4)return;
      const label=dkoPlacementLabel(t,e.place,e.playerId);
      if(!lowerGroups.has(label))lowerGroups.set(label,[]);
      lowerGroups.get(label).push(e.playerId);
    });
    (t.groupEliminations||[]).forEach(e=>{
      const label=genericPlacementLabel(e.place);
      if(!lowerGroups.has(label))lowerGroups.set(label,[]);
      if(!lowerGroups.get(label).includes(e.playerId))lowerGroups.get(label).push(e.playerId);
    });

    const recalculated=t.status==='complete'
      ? tournamentPlacementRecords(t).slice().sort((a,b)=>Number(a.value||999)-Number(b.value||999))
      : [];

    const standingsRows=recalculated.length
      ? recalculated.map(r=>({
          place:r.label,
          players:[tournamentPlayerName(r.playerId,t)]
        }))
      : [
          ...finalRows.map(r=>({
            place:r.label,
            players:[tournamentPlayerName(r.id,t)]
          })),
          ...[...lowerGroups.entries()].map(([label,ids])=>({
            place:label,
            players:ids.map(id=>tournamentPlayerName(id,t))
          }))
        ];

    const standingsHtml=standingsRows.length?`
      <div class="subpanel" style="margin-bottom:12px;${t.status==='complete'?'border-color:var(--gold);':''}">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;flex-wrap:wrap">
          <strong>${t.status==='complete'?'KONEČNÁ TABULKA VÝSLEDKŮ':'PRŮBĚŽNÉ POŘADÍ'}</strong>
          ${t.status==='complete'?'<span class="tournament-badge gold">TURNAJ DOHRÁN</span>':''}
        </div>
        ${t.status==='complete' && tournamentPlacementSeriesRule(t)
          ? '<div class="muted" style="margin-top:6px">Pořadí hráčů ve stejné výsledkové fázi je přepočítáno podle pravidla série: skóre → vzájemný zápas → umístění ve skupině.</div>'
          : ''}

        <div style="margin-top:10px;overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;min-width:420px">
            <thead>
              <tr>
                <th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--border)">Pořadí</th>
                <th style="text-align:left;padding:9px 10px;border-bottom:1px solid var(--border)">Hráč / hráči</th>
              </tr>
            </thead>
            <tbody>
              ${standingsRows.map(r=>`
                <tr>
                  <td style="padding:9px 10px;border-bottom:1px solid var(--border);font-weight:950;color:var(--gold2)">${esc(r.place)}</td>
                  <td style="padding:9px 10px;border-bottom:1px solid var(--border)">${r.players.map(esc).join(', ')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>`:'';

    return `${d.championId?`<div class="subpanel" style="text-align:center;border-color:var(--gold);margin-bottom:12px"><div class="muted">VÍTĚZ TURNAJE</div><div style="font-size:30px;font-weight:950;color:var(--gold2)">${esc(tournamentPlayerName(d.championId,t))}</div></div>`:''}
      ${standingsHtml}
      <div class="subpanel" style="margin-bottom:12px">
        <strong>Stav DKO</strong>
        <div class="muted" style="margin-top:3px">
          2 prohry = vyřazení z hlavního pavouka • ${d.thirdPlacePlayoff?'hraje se samostatný zápas o 3. místo':'bez zápasu o 3. místo = dvě 3. místa'} • další pořadí 5.–8., 9.–16., 17.–32. …
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:9px">
          ${(d.participantIds||t.playerIds||[]).map(id=>{const l=d.losses[id]||0;return `<span class="tournament-badge ${l===0?'gold':''}">${esc(tournamentPlayerName(id,t))} • ${l} prohra${l===1?'':'y'}${l>=2?' • OUT':''}</span>`}).join('')}
        </div>
      </div>
      ${Number(d.skoCut||0)>0?`<div class="subpanel" style="margin-bottom:12px;border-color:${d.skoStarted?'var(--gold)':'rgba(212,175,55,.35)'}">
        <strong>DKO → SKO • NASTAVENO LAST ${Number(d.skoCut)}</strong>
        <div class="muted" style="margin-top:5px">
          ${d.skoStarted
            ? `DKO fáze je uzavřena • do SKO přešlo <strong>${Number(d.skoActualCount||d.skoParticipantIds?.length||0)}</strong> hráčů. Od této chvíle jedna prohra znamená konec.`
            : `DKO pokračuje až do okamžiku, kdy zůstane nejvýše ${Number(d.skoCut)} aktivních hráčů. Velikost startovního pavouka tento přechod neomezuje.`}
        </div>
      </div>`:''}
      <div class="tournament-columns">${d.rounds.map(r=>`<div class="tournament-round"><h4>${esc(r.label)}</h4>
      ${(r.byes||[]).map(b=>renderTournamentBye(t,b,'VOLNÝ LOS • '+(b.bracket==='W'?'A STRANA':'B STRANA'))).join('')}
      ${r.matches.map(m=>renderTournamentMatch(t,m)).join('')}</div>`).join('')}</div>
      ${eliminated.length?`<div class="muted" style="margin-top:12px">Vyřazeni v DKO fázi: ${eliminated.map(id=>tournamentPlayerName(id,t)).map(esc).join(', ')}</div>`:''}
      ${t.ko?`<div class="hr"></div><h2 style="margin:0 0 10px">SKO • LAST ${Number(d.skoCut||d.skoActualCount||0)}</h2>${renderSKOTournament(t)}`:''}`;
  }


