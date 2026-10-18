// ── MUSCLE MAP ─────────────────────────────────────────────────
function renderMuscleMap(dayKey){
  var map=MUSCLE_TARGET[dayKey]||{p:[],s:[]};
  var color=DAY_COLORS[dayKey]||'#fbbf24';
  function chip(k){
    var isPrim=map.p.indexOf(k)!==-1,isSec=map.s.indexOf(k)!==-1;
    var bg=isPrim?'color-mix(in srgb,'+color+' 18%,transparent)':isSec?'color-mix(in srgb,'+color+' 7%,transparent)':'var(--surface2)';
    var col=isPrim?color:isSec?'color-mix(in srgb,'+color+' 55%,var(--muted))':'var(--muted)';
    var bdr=isPrim?'1px solid '+color:isSec?'1px solid color-mix(in srgb,'+color+' 25%,transparent)':'1px solid var(--border)';
    var fw=isPrim?'font-weight:700;':'';
    return '<div style="padding:4px 6px;border-radius:5px;font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:.5px;border:'+bdr+';background:'+bg+';color:'+col+';'+fw+'text-align:center;margin-bottom:4px">'+ALL_MUSCLES[k]+'</div>';
  }
  var front=MUSCLE_GROUPS.front.map(chip).join('');
  var back=MUSCLE_GROUPS.back.map(chip).join('');
  return '<div style="margin:10px 20px 0;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px">'+
    '<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">Muscles Targeted</div>'+
    '<div style="display:flex;gap:10px">'+
    '<div style="flex:1"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:6px">Front</div>'+front+'</div>'+
    '<div style="width:1px;background:var(--border)"></div>'+
    '<div style="flex:1"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);text-align:center;margin-bottom:6px">Back</div>'+back+'</div>'+
    '</div>'+
    '<div style="display:flex;gap:14px;justify-content:center;margin-top:10px">'+
    '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><div style="width:8px;height:8px;border-radius:2px;background:color-mix(in srgb,'+color+' 18%,transparent);border:1px solid '+color+'"></div>Primary</div>'+
    '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)"><div style="width:8px;height:8px;border-radius:2px;background:color-mix(in srgb,'+color+' 7%,transparent);border:1px solid color-mix(in srgb,'+color+' 25%,transparent)"></div>Secondary</div>'+
    '</div></div>';
}


// ── PROTRAIN HELPERS ───────────────────────────────────────────
function getCurrentPhase(){
  try{
  var info=getCycleWeekInfo(new Date());
  if(!info)return null;
  return Object.assign({},info.plan,{week:info.weekNum,pct:Math.round(info.weekNum/CYCLE_LENGTH*100),cycleNum:info.cycleNum});
  }catch(e){return null;}
}
function calc1RM(weight,reps){
  if(!weight||!reps||reps<=0)return 0;
  return Math.round(weight*(1+reps/30));
}
function getBest1RM(exId){
  var isMorn=exId.startsWith('m_'),best=0;
  Object.values(load().logs).forEach(function(log){
    var src=isMorn?log.morning:log.ppl;
    if(!src||!src.exercises||!src.exercises[exId])return;
    src.exercises[exId].sets.forEach(function(s){
      if(s.weight&&s.reps){var rm=calc1RM(+s.weight,+s.reps);if(rm>best)best=rm;}
    });
  });
  return best;
}
function get1RMHistory(exId){
  var isMorn=exId.startsWith('m_'),hist=[];
  Object.entries(load().logs).sort().forEach(function(e){
    var src=isMorn?e[1].morning:e[1].ppl;
    if(!src||!src.exercises||!src.exercises[exId])return;
    var best=0;
    src.exercises[exId].sets.forEach(function(s){if(s.weight&&s.reps){var rm=calc1RM(+s.weight,+s.reps);if(rm>best)best=rm;}});
    if(best>0)hist.push({date:e[0].slice(5),rm:best});
  });
  return hist.slice(-10);
}
function getPlateaus(){
  var results=[],data=load();
  ALL_EX.filter(function(ex){return ex.type==='weighted';}).forEach(function(ex){
    var isMorn=ex.id.startsWith('m_'),sessions=[];
    Object.entries(data.logs).sort().forEach(function(e){
      var src=isMorn?e[1].morning:e[1].ppl;
      if(!src||!src.exercises||!src.exercises[ex.id])return;
      var maxW=0;
      src.exercises[ex.id].sets.forEach(function(s){if(s.weight)maxW=Math.max(maxW,+s.weight);});
      if(maxW>0)sessions.push(maxW);
    });
    if(sessions.length>=3){
      var last3=sessions.slice(-3);
      if(last3[0]===last3[1]&&last3[1]===last3[2])results.push({name:ex.name,weight:last3[0],sessions:sessions.length});
    }
  });
  return results;
}
function getBestWeek(){
  var data=load(),best={vol:0,label:'',days:0};
  var allDates=Object.keys(data.logs).sort();
  if(!allDates.length)return null;
  var first=new Date(allDates[0]),last=now();
  for(var dt=new Date(getMondayOf(first));dt<=last;dt.setDate(dt.getDate()+7)){
    var weekStart=new Date(dt),vol=0,days=0;
    for(var d=0;d<7;d++){
      var day=new Date(weekStart);day.setDate(weekStart.getDate()+d);
      if(day>last)break;
      var key=toKey(day),log=data.logs[key]||{};
      vol+=calcSessionVol(log,'ppl');
      if(dayComplete(key,day))days++;
    }
    if(vol>best.vol){best.vol=vol;best.label=fmtShort(weekStart)+' – '+fmtShort(new Date(weekStart.getTime()+6*86400000));best.days=days;}
  }
  return best.vol>0?best:null;
}
function getBeforeAfter(d1,d2){
  var data=load(),log1=data.logs[d1]||{},log2=data.logs[d2]||{};
  var rows=[];
  ALL_EX.filter(function(e){return e.type==='weighted'&&!e.id.startsWith('m_');}).forEach(function(ex){
    var pd=null;
    Object.keys(getCurrentSchedule()).forEach(function(dow){if(getCurrentSchedule()[dow]&&EX[getCurrentSchedule()[dow]]&&EX[getCurrentSchedule()[dow]].find(function(e){return e.id===ex.id;}))pd=getCurrentSchedule()[dow];});
    var src1=log1.ppl,src2=log2.ppl;
    if(!src1&&!src2)return;
    var w1=0,w2=0,r1=0,r2=0;
    if(src1&&src1.exercises&&src1.exercises[ex.id])src1.exercises[ex.id].sets.forEach(function(s){if(s.weight>w1){w1=+s.weight;r1=+s.reps||0;}});
    if(src2&&src2.exercises&&src2.exercises[ex.id])src2.exercises[ex.id].sets.forEach(function(s){if(s.weight>w2){w2=+s.weight;r2=+s.reps||0;}});
    if(w1>0||w2>0)rows.push({name:ex.name,w1:w1,r1:r1,w2:w2,r2:r2});
  });
  return rows;
}
function getLastWeight(exId){
  var isMorn=exId.startsWith('m_'),last=0;
  Object.entries(load().logs).sort().forEach(function(e){
    var src=isMorn?e[1].morning:e[1].ppl;
    if(!src||!src.exercises||!src.exercises[exId])return;
    src.exercises[exId].sets.forEach(function(s){if(s.weight)last=Math.max(last,+s.weight);});
  });
  return last;
}
function getRecentSessions(exId,n){
  var isMorn=exId.startsWith('m_'),out=[];
  var ids=groupIdsFor(exId);
  Object.entries(load().logs).sort().forEach(function(e){
    var src=isMorn?e[1].morning:e[1].ppl;
    if(!src||!src.exercises)return;
    ids.forEach(function(id){
      if(!src.exercises[id]||!src.exercises[id].sets)return;
      var sets=src.exercises[id].sets.filter(function(s){return s.weight||s.reps||s.time;});
      if(sets.length)out.push({date:e[0],sets:sets});
    });
  });
  out.sort(function(a,b){return a.date<b.date?-1:1;});
  return out.slice(-n).reverse();
}
function checkBackupReminder(){
  // Handled by persistent backup banner in rToday
}
function getMuscle4WeekFreq(){
  var t=now(),result={};
  for(var w=0;w<4;w++){
    var ws=getMondayOf(t);ws.setDate(ws.getDate()-w*7);
    getWeekDays(ws).forEach(function(day){
      var key=toKey(day),pd=pplDay(day),log=load().logs[key];
      if(!log||!pd||!log.ppl||!log.ppl.exercises)return;
      EX[pd].concat(loadCustomExercises().filter(function(c){return c.day===pd;})).forEach(function(ex){
        var family=EX_ALT_MAP[ex.id]||[ex.id];
        family.forEach(function(fid){
          var exLog=log.ppl.exercises[fid];
          var done=exLog&&exLog.sets?exLog.sets.filter(function(s){return!!s.done;}).length:0;
          if(!done)return;
          var info=resolveExById(fid);
          if(!info||!info.muscles)return;
          var cr=muscleCredits(info.muscles);
          Object.keys(cr).forEach(function(mk){
            if(!result[mk])result[mk]={name:mk,sets:0,sessions:0,_days:{}};
            result[mk].sets+=done*cr[mk];
            result[mk]._days[key]=true;
          });
        });
      });
    });
  }
  // Average over 4 weeks, and finalize times-hit count from distinct training days
  Object.keys(result).forEach(function(k){
    result[k].setsPerWeek=Math.round(result[k].sets/4*10)/10;
    result[k].sessions=Object.keys(result[k]._days).length;
    delete result[k]._days;
  });
  return result;
}
function clearAllData(){
  if(!confirm('Clear ALL data? This deletes every log, streak, PR, and setting.\n\nThis cannot be undone — export first if you want a backup.'))return;
  // Clear all app-related localStorage keys
  var keysToRemove=[];
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(k&&(k.startsWith('ppl_')||k.startsWith('pt_')||k.startsWith('band_')||k.startsWith('alt_')))keysToRemove.push(k);
  }
  keysToRemove.forEach(function(k){localStorage.removeItem(k);});
  // Clear sessionStorage swap keys
  var ssKeys=[];
  for(var j=0;j<sessionStorage.length;j++){
    var sk=sessionStorage.key(j);
    if(sk&&(sk.startsWith('pt_gswap_')||sk==='pt_wo'))ssKeys.push(sk);
  }
  ssKeys.forEach(function(k){sessionStorage.removeItem(k);});
  showToast('✓ All data cleared. Starting fresh!','var(--success)');
  setTimeout(function(){location.reload();},1200);
}
function loadCustomExercises(){
  try{return JSON.parse(localStorage.getItem('pt_custom_ex')||'[]');}catch(e){return[];}
}
function saveCustomExercises(arr){localStorage.setItem('pt_custom_ex',JSON.stringify(arr));}
function rebuildALLEX(){ALL_EX=Object.values(EX).flat().concat(loadCustomExercises());}
function getSwappedExercise(exId){
  try{return JSON.parse(localStorage.getItem('pt_swap_'+exId)||'null');}catch(e){return null;}
}
function clearSwaps(){
  Object.keys(localStorage).forEach(function(k){if(k.startsWith('pt_swap_'))localStorage.removeItem(k);});
}
function migrateMStateKey(baseExId,oldActiveId){
  var newActiveId=getActiveId(baseExId);
  if(newActiveId===oldActiveId)return;
  if(mState[oldActiveId]){
    mState[newActiveId]=mState[oldActiveId];
    if(oldActiveId!==newActiveId)delete mState[oldActiveId];
  } else {
    var ex=ALL_EX.find(function(e){return e.id===baseExId;});
    if(ex)mState[newActiveId]={done:false,sets:Array.from({length:ex.sets||3},function(){return emptySet(ex);}),baseExId:baseExId};
  }
}
function _resetSwapCore(exId){
  var oldActiveId=getActiveId(exId);
  localStorage.removeItem('pt_swap_'+exId);
  delete _vidCache[exId];
  migrateMStateKey(exId,oldActiveId);
}
function _swapCore(exId,subOrIdx){
  var oldActiveId=getActiveId(exId);
  var sub=typeof subOrIdx==='number'?SUBS[exId][subOrIdx]:subOrIdx;
  localStorage.setItem('pt_swap_'+exId,JSON.stringify(sub));
  delete _vidCache[exId];
  migrateMStateKey(exId,oldActiveId);
}
function resetSwapToOriginal(exId){
  _resetSwapCore(exId);
  refreshSubContext();
}
function swapExercise(exId,subOrIdx){
  _swapCore(exId,subOrIdx);
  refreshSubContext();
}

// ── TOAST ──────────────────────────────────────────────────────
function refreshSubContext(){
  if(document.getElementById('overlay').classList.contains('open')&&mType&&mKey){
    var date=new Date(mKey+'T00:00:00'),pd=pplDay(date);
    var baseList=mType==='morning'?EX.morning:(EX[pd]||[]);
    var customForDay=loadCustomExercises().filter(function(ex){return ex.day===(mType==='morning'?'morning':pd);});
    buildModal(baseList.concat(customForDay),mType);
  } else {
    render(curScreen);
  }
}
function renderBandSelector(exId,setIdx,savedBands){
  var bands=['yellow','red','green','blue','black'];
  var labels=['Yellow','Red','Green','Blue','Black'];
  var html='<div class="band-selector"><div class="band-sel-lbl">Bands Used</div><div class="band-options">';
  bands.forEach(function(b,i){
    var checked=(savedBands&&savedBands.indexOf(b)>-1)?'checked':'';
    html+='<label class="band-opt"><input type="checkbox" value="'+b+'" '+checked+' onchange="saveBandSelection(\''+exId+'\','+setIdx+',this)"><span class="band-pill '+b+'">'+labels[i]+'</span></label>';
  });
  html+='</div></div>';
  return html;
}
function saveBandSelection(exId,setIdx,el){
  var container=el.closest('.band-options');
  var checked=Array.from(container.querySelectorAll('input:checked')).map(function(i){return i.value});
  var key='band_'+exId+'_set'+setIdx;
  localStorage.setItem(key,JSON.stringify(checked));
  if(mState&&mState[exId]&&mState[exId].sets&&mState[exId].sets[setIdx]!=null){
    mState[exId].sets[setIdx].bands=checked;
    if(checked.length&&!mState[exId].done){
      mState[exId].done=true;
      var mc=document.getElementById('exchk_'+exId);
      if(mc)mc.classList.add('done');
    }
  }
}
function loadBandSelection(exId,setIdx){
  try{return JSON.parse(localStorage.getItem('band_'+exId+'_set'+setIdx)||'[]')}catch(e){return[]}
}
function getBandProgressData(){
  var BAND_ORDER=['yellow','red','green','blue','black'];
  var BAND_LABEL={yellow:'Yellow',red:'Red',green:'Green',blue:'Blue',black:'Black'};
  var allLogs=Object.entries(load().logs).sort();
  var result=[];
  ALL_EX.forEach(function(ex){
    var family=EX_ALT_MAP[ex.id]||[ex.id];
    var bandIds=family.filter(function(fid){
      if(fid===ex.id)return !!ex.isBand;
      var info=resolveExById(fid);
      return info&&info.isBand;
    });
    if(!bandIds.length)return;
    var isMorn=ex.id.startsWith('m_');
    var history=[];
    allLogs.forEach(function(entry){
      var src=isMorn?entry[1].morning:entry[1].ppl;
      if(!src||!src.exercises)return;
      var allBands=[];
      bandIds.forEach(function(bid){
        var exLog=src.exercises[bid];
        if(!exLog||!exLog.done||!exLog.sets)return;
        exLog.sets.forEach(function(s){if(s.bands&&s.bands.length)allBands=allBands.concat(s.bands);});
      });
      if(allBands.length){
        var highest=allBands.reduce(function(a,b){return BAND_ORDER.indexOf(b)>BAND_ORDER.indexOf(a)?b:a;},allBands[0]);
        history.push({date:entry[0],highest:highest});
      }
    });
    if(!history.length)return;
    var current=history[history.length-1].highest;
    var suggestion=null;
    if(history.length>=3){
      var last3=history.slice(-3);
      if(last3.every(function(h){return h.highest===current;})){
        var nextIdx=BAND_ORDER.indexOf(current)+1;
        if(nextIdx<BAND_ORDER.length)suggestion=BAND_LABEL[BAND_ORDER[nextIdx]];
      }
    }
    result.push({name:ex.name,id:ex.id,current:BAND_LABEL[current]||current,sessions:history.length,suggestion:suggestion,history:history.slice(-6)});
  });
  return result;
}
function getBandDisplayText(bands){
  if(!bands||!bands.length)return'—';
  var labels={yellow:'Yellow',red:'Red',green:'Green',blue:'Blue',black:'Black'};
  return bands.map(function(b){return labels[b]||b}).join(' + ');
}
function showToast(msg,borderColor){
  var t=document.createElement('div');
  t.className='toast';
  t.setAttribute('role','status');t.setAttribute('aria-live','polite');
  t.style.borderColor=borderColor||'var(--border)';
  t.textContent=msg;
  document.body.appendChild(t);
  setTimeout(function(){t.style.opacity='0';t.style.transition='opacity .4s';setTimeout(function(){t.remove();},400);},2800);
}

