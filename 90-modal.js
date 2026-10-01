// ── MODAL (LOG SESSION) ────────────────────────────────────────
function openModal(type,key){
  mType=type;mKey=key;
  var date=new Date(key+'T00:00:00');
  var pd=pplDay(date);
  var dayKey=type==='morning'?'morning':pd;
  var baseList=type==='morning'?EX.morning:EX[pd];
  var customForDay=loadCustomExercises().filter(function(ex){return ex.day===dayKey;});
  var exList=baseList.concat(customForDay);
  var log=load().logs[key]||{};
  var existing=(type==='morning'?log.morning:log.ppl)||{};
  mState={};
  exList.forEach(function(ex){
    var activeId=getActiveId(ex.id);
    var prev=existing.exercises?existing.exercises[activeId]:null;
    mState[activeId]={
      done:!!(prev&&prev.done),
      sets:prev&&prev.sets&&prev.sets.length?prev.sets:
        Array.from({length:ex.sets||3},function(){return emptySet(ex);}),
      baseExId:ex.id
    };
  });
  try{
    var dr=JSON.parse(localStorage.getItem('pt_draft')||'null');
    if(dr&&dr.key===key&&dr.type===type&&Date.now()-dr.t<2*864e5&&!(existing&&existing.done)){
      Object.keys(dr.state||{}).forEach(function(id){if(mState[id]&&dr.state[id].sets&&dr.state[id].sets.length===mState[id].sets.length)mState[id]=dr.state[id];});
      mDraftNotes=dr.notes||'';
      showToast('Restored your unsaved entries','var(--muted)');
    }
  }catch(e){}
  var accent=type==='morning'?'#fbbf24':(pd?PPL[pd].color:'#fbbf24');
  document.getElementById('modal').style.setProperty('--accent',accent);
  document.getElementById('mTitle').textContent=type==='morning'?'Morning Routine':(pd?PPL[pd].name:'');
  var copyBtn=document.getElementById('copyLastBtn');
  if(copyBtn)copyBtn.style.display=(!existing||!existing.exercises||!Object.keys(existing.exercises).length)?'block':'none';
  mNotes=(existing&&existing.notes)||mDraftNotes||'';mDraftNotes='';
  // Find most recent prior session of same type with notes
  mPrevNotes='';
  if(!mNotes){
    var allLogs=load().logs;
    var pastKeys=Object.keys(allLogs).filter(function(k){return k<key;}).sort().reverse();
    for(var pi=0;pi<pastKeys.length;pi++){
      var pl=allLogs[pastKeys[pi]];
      var ps=type==='morning'?pl.morning:pl.ppl;
      if(ps&&ps.notes){mPrevNotes=ps.notes;break;}
    }
  }
  if(existing&&existing.startTime){
    mStartHHMM=existing.startTime;
    mStartConfirmed=true;
  }else{
    mStartHHMM='';
    mStartConfirmed=false;
  }
  // Restore end time — derive from startTime + duration if not saved directly
  mEndHHMM='';
  if(existing&&existing.endTime){
    mEndHHMM=existing.endTime;
  }else if(existing&&existing.startTime&&existing.duration){
    var sp=existing.startTime.split(':');
    var startMins=parseInt(sp[0])*60+parseInt(sp[1]);
    var endMins=(startMins+existing.duration)%1440;
    mEndHHMM=(Math.floor(endMins/60)<10?'0':'')+Math.floor(endMins/60)+':'+(endMins%60<10?'0':'')+(endMins%60);
  }
  var wuItems=type==='morning'?[]:WARMUPS[pd]||[];
  var cdItems=type==='morning'?[]:COOLDOWNS[pd]||[];
  var exWu=(existing&&existing.warmup&&existing.warmup.items)||[];
  var exCd=(existing&&existing.cooldown&&existing.cooldown.items)||[];
  mWarmup=wuItems.map(function(_,i){return !!(exWu[i]);});
  mCooldown=cdItems.map(function(_,i){return !!(exCd[i]);});
  mWarmupOpen=mWarmup.some(function(x){return x;});
  mCooldownOpen=mCooldown.some(function(x){return x;});
  buildModal(exList,type);
  document.getElementById('overlay').classList.add('open');
}
function buildModal(exList,type){
  var h='';
  // ── Floating rest timer (sticky top of modal body) ──
  h+='<div class="rest-timer-float" id="restTimerFloat">';
  h+='<div class="rt-countdown" id="rtCountdown">0s</div>';
  h+='<div class="rt-label">Rest<br><span style="font-size:11px;opacity:.6">Tap timer btn again to stop</span></div>';
  h+='<button class="rt-stop" onclick="stopRestTimer()">Stop</button>';
  h+='</div>';
  h+='<div class="rest-timer-float extmr-float" id="exTimerFloat">';
  h+='<div class="rt-countdown" id="exTmrCountdown">0s</div>';
  h+='<div class="rt-label" id="exTmrLabel">Timing hold<br><span style="font-size:11px;opacity:.6">Tap Stop when you\'re done</span></div>';
  h+='<button class="rt-stop" onclick="stopExTmrEarly()">Stop</button>';
  h+='</div>';
  // ── Warm-up section (PPL days only) ──
  var pd2=null;
  if(mType==='ppl'&&mKey){try{var d2t=new Date(mKey+'T00:00:00');pd2=pplDay(d2t);}catch(e){}}
  if(mType==='ppl'&&pd2&&(EX[pd2]||[]).some(function(ex){return AWAY_MAP[ex.id];})){
    var awayActive=isAwayModeActive(pd2);
    h+='<button class="away-toggle-btn'+(awayActive?' active':'')+'" onclick="toggleAwayMode(\''+pd2+'\')">'
      +(awayActive?'✈️ Away Mode: ON — tap to restore normal exercises':'✈️ Away Mode: bodyweight-only swap for today')
      +'</button>';
  }
  var wuItems=mType!=='morning'&&pd2?WARMUPS[pd2]||[]:[];
  var cdItems=mType!=='morning'&&pd2?COOLDOWNS[pd2]||[]:[];
  if(wuItems.length){
    var wuDone=mWarmup.filter(function(x){return x;}).length;
    var wuColor=wuDone===mWarmup.length&&wuDone>0?'var(--success)':'var(--morning)';
    h+='<div class="wucd-section">';
    h+='<div class="wucd-hdr" onclick="togWarmup()">';
    h+='<span style="font-size:18px">&#128293;</span>';
    h+='<div class="wucd-title">Warm-Up</div>';
    h+='<span id="wuBadge" class="wucd-prog" style="background:color-mix(in srgb,var(--morning) 12%,transparent);color:var(--morning)">'+wuDone+'/'+wuItems.length+'</span>';
    h+='<span class="wucd-opt">Optional</span>';
    h+='<span class="wucd-arrow" id="wuArrow" style="transform:'+(mWarmupOpen?'rotate(90deg)':'rotate(0deg)')+'">&#8250;</span>';
    h+='</div>';
    h+='<div class="wucd-body'+(mWarmupOpen?' open':'')+'" id="wuBody">';
    wuItems.forEach(function(item,i){
      h+='<div class="wucd-item">';
      h+='<button id="wuchk_'+i+'" class="wucd-chk'+(mWarmup[i]?' done':'')+'" onclick="togWuItem('+i+')">&#10003;</button>';
      h+='<div class="wucd-text">'+item+'</div>';
      h+='</div>';
    });
    h+='</div></div>';
  }

  exList.forEach(function(ex){
    var activeId=getActiveId(ex.id);
    var st=mState[activeId];
    var swapped=getSwappedExercise(ex.id);
    var displayEx=swapped||ex;
    var effType=(swapped&&swapped.type)?swapped.type:ex.type;
    var effIsBand=(swapped&&swapped.hasOwnProperty('isBand'))?swapped.isBand:ex.isBand;
    var effEx=Object.assign({},ex,{type:effType});
    var lastW=getLastWeight(activeId);
    var warmW=lastW>0?Math.max(Math.round(lastW*0.5/2.5)*2.5,2.5):0;
    h+='<div class="lex"><div class="lex-hdr">';
    h+='<button id="exchk_'+activeId+'" aria-label="Mark exercise done" class="lex-chk'+(st.done?' done':'')+'" onclick="togEx(\''+activeId+'\',this)">&#10003;</button>';
    var bl=bestLabel(activeId,effEx);
    var ph=getProgHint(activeId,effEx);
    h+='<div style="flex:1"><div class="lex-name">'+displayEx.name+'</div>';
    if(ex.muscles)h+='<div style="font-size:11px;color:var(--muted);margin-top:1px"><span style="color:var(--accent)">&#9679;</span> '+ex.muscles.primary+' <span style="opacity:.4">·</span> '+ex.muscles.secondary+'</div>';
    if(bl)h+='<div style="font-size:11px;color:var(--muted);margin-top:2px;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px">'+bl+'</div>';
    h+='</div>';
    h+='<div class="lex-tgt">'+ex.target+'</div>';
    if(SUBS[ex.id])h+='<button class="sub-btn" onclick="event.stopPropagation();togSubModal(\''+ex.id+'\')" title="Swap exercise">🔄</button>';
    h+='<button class="lex-info-btn" onclick="togInfo(\''+activeId+'\',this)" title="How to do it">?</button>';
    h+='</div>';
    if(warmW>0&&mType!=='morning')h+='<div class="warmup-hint">🔥 Warm-up set: '+warmW+'kg × 10 reps before working sets</div>';
    if(swapped)h+='<div style="font-size:11px;padding:0 20px 6px;color:var(--legs)">🔄 Swapped from: '+ex.name+' — tracked separately from here on</div>';
    var howToEx=swapped||ex;
    h+='<div class="lex-howto" id="info_'+activeId+'">';
    h+='<ul class="lex-steps">';
    howToEx.steps.forEach(function(s){h+='<li>'+s+'</li>';});
    h+='</ul>';
    if(howToEx.tip)h+='<div class="lex-tip">'+howToEx.tip+'</div>';
    h+='<div class="ex-vid-wrap" id="vid_'+activeId+'" data-exid="'+activeId+'" data-exname="'+encodeURIComponent(displayEx.name)+'"></div>';
    h+='</div>';
    var dl=isDeloadWeek();
    if(ex.type==='weighted'||ex.type==='reps'||ex.type==='time'){
      var recentSess=getRecentSessions(activeId,3);
      if(recentSess.length){
        var lastSess=recentSess[0];
        var lastSummary=lastSess.sets.map(function(s){
          if(ex.type==='weighted')return (s.weight||'?')+'kg×'+(s.reps||'?');
          if(ex.type==='time')return (s.time||'?')+'s';
          return (s.reps||'?')+'r';
        }).join(', ');
        var lastDateShort=new Date(lastSess.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
        h+='<div class="hist-ref" onclick="togHist(\''+activeId+'\')">📊 Last: '+lastSummary+' <span style="opacity:.6">('+lastDateShort+')</span> <span id="histArrow_'+activeId+'" style="opacity:.5">▾</span></div>';
        h+='<div class="hist-panel" id="hist_'+activeId+'">';
        recentSess.forEach(function(sess){
          var d=new Date(sess.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
          var setStrs=sess.sets.map(function(s){
            if(ex.type==='weighted')return (s.weight||'?')+'kg×'+(s.reps||'?');
            if(ex.type==='time')return (s.time||'?')+'s';
            return (s.reps||'?')+'r';
          });
          h+='<div class="hist-row"><span class="hist-date">'+d+'</span><span class="hist-sets">'+setStrs.join(' · ')+'</span></div>';
        });
        h+='</div>';
      }
    }
    if(effType==='weighted'&&!getCalib(ex.id)&&getBest(activeId).weight===0)h+='<button class="autofill-btn" onclick="calibrate(\''+activeId+'\')">\uD83C\uDFAF Find my starting weight</button>';
    h+='<button class="autofill-btn" onclick="fillRec(\''+activeId+'\')">'+(dl?'⚠️ Auto-fill (Deload 85%)':'✨ Auto-fill Recommendation')+'</button>';
    h+='<div class="set-inputs">';
    st.sets.forEach(function(s,si){
      var lbl=ex.sideLabels?(ex.sideLabels[si]||'S'+(si+1)):(ex.sets>1?'S'+(si+1):'x');
      h+='<div class="set-row"><button id="setchk_'+activeId+'_'+si+'" aria-label="Mark set done" class="set-chk'+(st.sets[si].done?' done':'')+'" onclick="togSet(\''+activeId+'\','+si+',this)">&#10003;</button><div class="set-lbl">'+lbl+'</div>';
      if(effType==='time'){
        h+='<input id="inp_'+activeId+'_'+si+'_time" class="sinput" type="number" inputmode="numeric" placeholder="sec" value="'+(s.time||'')+'" oninput="updSet(\''+activeId+'\','+si+',\'time\',this.value)">';
        h+='<div class="sinput-lbl">sec</div>';
        h+='<button id="extmrbtn_'+activeId+'_'+si+'" class="extmr-btn" onclick="togExTimer(\''+activeId+'\','+si+')" title="Time this hold">&#9654;</button>';
      } else if(effType==='weighted'){
        h+='<input id="inp_'+activeId+'_'+si+'_reps" class="sinput" type="number" inputmode="decimal" placeholder="reps" value="'+(s.reps||'')+'" oninput="updSet(\''+activeId+'\','+si+',\'reps\',this.value)">';
        h+='<div class="sinput-lbl">reps</div>';
        h+='<input id="inp_'+activeId+'_'+si+'_weight" class="sinput" type="number" inputmode="decimal" placeholder="kg" value="'+(s.weight||'')+'" oninput="updSet(\''+activeId+'\','+si+',\'weight\',this.value)">';
        h+='<div class="sinput-lbl">kg</div>';
      } else {
        h+='<input id="inp_'+activeId+'_'+si+'_reps" class="sinput" type="number" inputmode="numeric" placeholder="reps" value="'+(s.reps||'')+'" oninput="updSet(\''+activeId+'\','+si+',\'reps\',this.value)">';
        h+='<div class="sinput-lbl">reps</div>';
        if(ex.loadable&&!effIsBand){
          h+='<input id="inp_'+activeId+'_'+si+'_weight" class="sinput" type="number" inputmode="decimal" placeholder="+kg" value="'+(s.weight||'')+'" oninput="updSet(\''+activeId+'\','+si+',\'weight\',this.value)">';
          h+='<div class="sinput-lbl">+kg</div>';
        }
      }
      h+='<input id="inp_'+activeId+'_'+si+'_rpe" class="sinput rpe-inp" type="number" inputmode="numeric" placeholder="RPE" min="1" max="10" value="'+(s.rpe||'')+'" oninput="updSet(\''+activeId+'\','+si+',\'rpe\',this.value)">';
      h+='<div class="rpe-lbl">rpe</div>';
      if(ex.rest){
        var rs=parseRestSecs(ex.rest);
        h+='<button id="restbtn_'+activeId+'_'+si+'" class="rest-btn" onclick="togRestBtn(\''+activeId+'\','+si+','+rs+')" title="Start '+rs+'s rest timer">&#9203;</button>';
      }
      h+='</div>';
      if(effIsBand){
        var _savedBands=loadBandSelection(activeId,si);
        if(st.sets[si].bands===undefined)st.sets[si].bands=_savedBands;
        h+=renderBandSelector(activeId,si,_savedBands);
      }
    });
    if(SUBS[ex.id]){
      h+='<div class="sub-panel" id="submodal_'+ex.id+'">';
      h+='<div class="sub-panel-title">Swap this exercise</div>';
      if(swapped)h+='<button class="miss-btn sel" style="margin-bottom:8px" onclick="resetSwapToOriginal(\''+ex.id+'\')" >↩ Use Original: '+ex.name+'</button>';
      SUBS[ex.id].forEach(function(s,si){
        var isCurrent=swapped&&swapped.id===s.id;
        h+='<div class="sub-item"><div><div style="font-size:13px">'+(isCurrent?'✓ ':'')+s.name+'</div><div style="font-size:11px;color:var(--muted)">'+s.muscles.primary+', '+s.muscles.secondary+'</div></div>';
        if(!isCurrent)h+='<button class="sub-use-btn" onclick="swapExercise(\''+ex.id+'\','+si+')">Use</button>';
        h+='</div>';
      });
      h+='</div>';
    }
    if(ph)h+='<div class="prog-hint">&#128161; '+ph+'</div>';
    if(ex.rest)h+='<div style="padding:2px 20px 10px;font-size:11px;color:var(--muted);font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px">⏱ Rest: <span style="color:var(--text);font-weight:700">'+ex.rest+'</span> <span style="opacity:.5">— tap ⏱ after each set</span></div>';
    h+='</div></div>';
  });
  // ── Cool-down section ──
  if(cdItems.length){
    var cdDone=mCooldown.filter(function(x){return x;}).length;
    h+='<div class="wucd-section">';
    h+='<div class="wucd-hdr" onclick="togCooldown()">';
    h+='<span style="font-size:18px">&#10052;</span>';
    h+='<div class="wucd-title">Cool-Down</div>';
    h+='<span id="cdBadge" class="wucd-prog" style="background:color-mix(in srgb,var(--pull) 12%,transparent);color:var(--pull)">'+cdDone+'/'+cdItems.length+'</span>';
    h+='<span class="wucd-opt">Optional</span>';
    h+='<span class="wucd-arrow" id="cdArrow" style="transform:'+(mCooldownOpen?'rotate(90deg)':'rotate(0deg)')+'">&#8250;</span>';
    h+='</div>';
    h+='<div class="wucd-body'+(mCooldownOpen?' open':'')+'" id="cdBody">';
    cdItems.forEach(function(item,i){
      h+='<div class="wucd-item">';
      h+='<button id="cdchk_'+i+'" class="wucd-chk'+(mCooldown[i]?' done':'')+'" onclick="togCdItem('+i+')">&#10003;</button>';
      h+='<div class="wucd-text">'+item+'</div>';
      h+='</div>';
    });
    h+='</div></div>';
  }
  h+='<div class="rpe-help">&#128161; <strong>RPE</strong> (Rate of Perceived Exertion): 1=very easy, 5=moderate, 8=hard, 10=max effort. Optional per set.</div>';
  h+='<div class="notes-lbl">Session Notes</div>';
  var notesPH=mPrevNotes?'Last time: '+mPrevNotes.slice(0,60)+(mPrevNotes.length>60?'…':''):'How did it feel? Anything to note...';
  h+='<textarea class="notes-area" id="sessionNotes" placeholder="'+notesPH.replace(/"/g,'&quot;')+'" maxlength="500" oninput="mNotes=this.value.slice(0,500);this.value=mNotes;updNotesCount()" onchange="mNotes=this.value.slice(0,500)">'+mNotes+'</textarea>';
  h+='<div class="notes-count" id="notesCount">'+(mNotes?mNotes.length:0)+'/500</div>';
  // ── Session time inputs ──
  h+='<div class="session-time-row">';
  h+='<div class="stime-group"><div class="stime-lbl">Started</div><input class="stime-inp" type="time" id="stimeStart" value="'+mStartHHMM+'" onchange="mStartConfirmed=true;calcManualDuration()"></div>';
  h+='<div class="stime-group"><div class="stime-lbl">Ended</div><input class="stime-inp" type="time" id="stimeEnd" value="'+mEndHHMM+'" onchange="mStartConfirmed=true;calcManualDuration()"></div>';
  h+='</div>';
  h+='<div class="stime-calc" id="stimeDur"></div>';
  h+='<button class="save-btn" onclick="saveSession()">Save Session &#10003;</button>';
  document.getElementById('mBody').innerHTML=h;
}
function updNotesCount(){
  var ta=document.getElementById('sessionNotes');
  var ct=document.getElementById('notesCount');
  if(ta&&ct)ct.textContent=(ta.value?ta.value.length:0)+'/500';
}
function togSubModal(exId){
  var panel=document.getElementById('submodal_'+exId);
  if(panel)panel.classList.toggle('open');
}
var _vidCache={};
function fetchExVideo(exId,exName,wrapId){
  wrapId=wrapId||('vid_'+exId);
  var wrap=document.getElementById(wrapId);
  if(!wrap)return;
  if(_vidCache[exId]==='none'){wrap.innerHTML='<div class="ex-vid-ph">No video found for this exercise.</div>';return;}
  if(_vidCache[exId]){
    wrap.innerHTML='<iframe class="ex-vid-iframe" src="https://www.youtube.com/embed/'+_vidCache[exId]+'?rel=0&modestbranding=1" allowfullscreen></iframe>';
    return;
  }
  var key=localStorage.getItem('pt_yt_key')||'';
  if(!key){wrap.innerHTML='<div class="ex-vid-ph">Add your YouTube API key in Progress → Settings to enable video guides.</div>';return;}
  wrap.innerHTML='<div class="ex-vid-ph">⏳ Loading...</div>';
  var q=encodeURIComponent(exName+' proper form technique');
  fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q='+q+'&key='+key)
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.error){
        var reason=d.error.code===403?'YouTube quota exceeded or invalid key — check your API key in Settings.':'YouTube API error ('+d.error.code+') — tap to retry';
        wrap.innerHTML='<div class="ex-vid-ph" style="cursor:pointer" onclick="fetchExVideo(\''+exId+'\',decodeURIComponent(\''+encodeURIComponent(exName)+'\'),\''+wrapId+'\')">\u26a0\ufe0f '+reason+'</div>';
        return;
      }
      if(d.items&&d.items.length){
        var vid=d.items[0].id.videoId;
        _vidCache[exId]=vid;
        wrap.innerHTML='<iframe class="ex-vid-iframe" src="https://www.youtube.com/embed/'+vid+'?rel=0&modestbranding=1" allowfullscreen></iframe>';
      } else {
        _vidCache[exId]='none';
        wrap.innerHTML='<div class="ex-vid-ph">No video found for this exercise.</div>';
      }
    })
    .catch(function(){
      wrap.innerHTML='<div class="ex-vid-ph" style="cursor:pointer" onclick="fetchExVideo(\''+exId+'\',decodeURIComponent(\''+encodeURIComponent(exName)+'\'),\''+wrapId+'\')">⚠️ Failed to load — tap to retry</div>';
    });
}
function togHist(exId){
  var panel=document.getElementById('hist_'+exId);
  var arrow=document.getElementById('histArrow_'+exId);
  if(!panel)return;
  var open=panel.classList.toggle('open');
  if(arrow)arrow.textContent=open?'▴':'▾';
}
function togInfo(exId,btn){
  var panel=document.getElementById('info_'+exId);
  if(!panel)return;
  var open=panel.classList.toggle('open');
  btn.classList.toggle('open',open);
  if(open){
    var wrap=document.getElementById('vid_'+exId);
    if(wrap&&!wrap.querySelector('iframe')&&!_vidCache[exId]){
      var exName=wrap.dataset.exname?decodeURIComponent(wrap.dataset.exname):exId;
      fetchExVideo(exId,exName,'vid_'+exId);
    } else if(wrap&&_vidCache[exId]&&!wrap.querySelector('iframe')){
      fetchExVideo(exId,wrap.dataset.exname?decodeURIComponent(wrap.dataset.exname):exId,'vid_'+exId);
    }
  }
}
function togEx(id,btn){
  mState[id].done=!mState[id].done;
  btn.classList.toggle('done',mState[id].done);
  btn.classList.add('popped');
  setTimeout(function(){btn.classList.remove('popped');},300);
  mState[id].sets.forEach(function(s,si){
    s.done=mState[id].done;
    var sb=document.getElementById('setchk_'+id+'_'+si);
    if(sb)sb.classList.toggle('done',mState[id].done);
  });
  if(mState[id].done){
    var mc2=document.getElementById('exchk_'+id);
    var lx=mc2&&mc2.closest?mc2.closest('.lex'):null;
    if(lx){lx.classList.add('flash-done');setTimeout(function(){lx.classList.remove('flash-done');},600);}
  }
}
function updSet(id,si,field,val){
  if(mState[id]&&mState[id].sets&&mState[id].sets[si]!=null){
    mState[id].sets[si][field]=val===''?'':parseFloat(val);
  }
}
function saveSession(){
  try{
  var data=load();
  if(!data.logs[mKey])data.logs[mKey]={};
  var exData={};
  Object.entries(mState).forEach(function(entry){
    var exInfo=resolveExById(entry[0]);
    exData[entry[0]]={done:entry[1].done,sets:entry[1].sets,name:exInfo?exInfo.name:entry[0]};
  });
  var allDone=Object.values(mState).every(function(st){return !!st.done;});
  data.logs[mKey][mType]={done:allDone,exercises:exData};
  // Detect PRs
  var prNames=[];
  Object.entries(mState).forEach(function(e){
    var exInfo=resolveExById(e[0]);
    if(exInfo&&checkNewPR(e[0],e[1].sets))prNames.push(exInfo.name);
  });
  var duration=0;
  // Compute from manual time inputs if both are set
  var stEl=document.getElementById('stimeStart');
  var etEl=document.getElementById('stimeEnd');
  if(stEl&&etEl&&stEl.value&&etEl.value){
    var sp2=stEl.value.split(':');var ep2=etEl.value.split(':');
    var sm2=parseInt(sp2[0])*60+parseInt(sp2[1]);
    var em2=parseInt(ep2[0])*60+parseInt(ep2[1]);
    var manDur=em2-sm2;if(manDur<0)manDur+=1440;
    if(manDur>0)duration=manDur;
  }
  data.logs[mKey][mType].notes=mNotes;
  if(stEl&&stEl.value&&mStartConfirmed)data.logs[mKey][mType].startTime=stEl.value;
  if(etEl&&etEl.value)data.logs[mKey][mType].endTime=etEl.value;
  if(duration>0)data.logs[mKey][mType].duration=duration;
  // Save warmup/cooldown
  if(mWarmup.length){data.logs[mKey][mType].warmup={items:mWarmup.slice(),done:mWarmup.every(function(x){return x;})};}
  if(mCooldown.length){data.logs[mKey][mType].cooldown={items:mCooldown.slice(),done:mCooldown.every(function(x){return x;})};}
  localStorage.removeItem('pt_draft');
  save(data);
  closeModal();
  try{render(curScreen);}catch(re){console.warn('render error',re);}
  if(prNames.length){
    showToast('🏆 New PR! '+prNames.slice(0,2).join(', ')+(prNames.length>2?' +more':''),'#facc15');
  } else if(!allDone){
    var undone=Object.values(mState).filter(function(s){return !s.done;}).length;
    showToast('Saved as incomplete — '+undone+' exercise'+(undone!==1?'s':'')+' left','#f97316');
  }
  }catch(err){showToast('Error saving: '+err.message,'var(--danger)');console.error('saveSession error:',err);}
}
function togSet(id,si,btn){
  if(!mState[id]||!mState[id].sets[si])return;
  var nowDone=!mState[id].sets[si].done;
  var baseInfo=resolveExById(id);
  var baseId=baseInfo&&baseInfo.isAlt?baseInfo.baseId:id;
  var baseEx=ALL_EX.find(function(e){return e.id===baseId;});
  var isSideBased=!!(baseEx&&baseEx.sideLabels);
  // Copy from previous set when ticking ON (not unticking), for sets after the first —
  // skipped for side-based exercises (Left/Right/Chin Tuck are distinct, not repeats)
  if(nowDone&&si>0&&!isSideBased){
    var prev=mState[id].sets[si-1];
    var curr=mState[id].sets[si];
    var prevHasData=(prev.reps!=null&&prev.reps!=='')||(prev.weight!=null&&prev.weight!=='')||(prev.time!=null&&prev.time!=='');
    var currHasData=(curr.reps!=null&&curr.reps!=='')||(curr.weight!=null&&curr.weight!=='')||(curr.time!=null&&curr.time!=='');
    if(prevHasData){
      var doCopy=true;
      if(currHasData)doCopy=confirm('Copy Set '+(si)+' values to Set '+(si+1)+'?');
      if(doCopy){
        if(prev.reps!=null){curr.reps=prev.reps;var er=document.getElementById('inp_'+id+'_'+si+'_reps');if(er)er.value=prev.reps;}
        if(prev.weight!=null){curr.weight=prev.weight;var ew=document.getElementById('inp_'+id+'_'+si+'_weight');if(ew)ew.value=prev.weight;}
        if(prev.time!=null){curr.time=prev.time;var et=document.getElementById('inp_'+id+'_'+si+'_time');if(et)et.value=prev.time;}
        if(prev.rpe!=null&&prev.rpe!==''){curr.rpe=prev.rpe;var ep=document.getElementById('inp_'+id+'_'+si+'_rpe');if(ep)ep.value=prev.rpe;}
      }
    }
  }
  mState[id].sets[si].done=nowDone;
  btn.classList.toggle('done',nowDone);
  btn.classList.add('popped');
  setTimeout(function(){btn.classList.remove('popped');},300);
  var allDone=mState[id].sets.every(function(s){return !!s.done;});
  mState[id].done=allDone;
  var mainChk=document.getElementById('exchk_'+id);
  if(mainChk)mainChk.classList.toggle('done',allDone);
  if(allDone){
    var lexDiv=mainChk&&mainChk.closest?mainChk.closest('.lex'):null;
    if(lexDiv){lexDiv.classList.add('flash-done');setTimeout(function(){lexDiv.classList.remove('flash-done');},600);}
  }
}
function fillRec(exId,mode){
  var exInfo=resolveExById(exId);
  if(!exInfo)return;
  var baseId=exInfo.isAlt?exInfo.baseId:exId;
  var ex=ALL_EX.find(function(e){return e.id===baseId;});
  if(!ex)return;
  var effEx=exInfo.isAlt?Object.assign({},ex,{type:exInfo.type||ex.type}):ex;
  var rec=getRec(exId,effEx,mode||'smart');
  mState[exId].sets=rec;
  rec.forEach(function(s,si){
    if(s.time!=null){var el=document.getElementById('inp_'+exId+'_'+si+'_time');if(el){el.value=s.time||'';updSet(exId,si,'time',el.value);}}
    if(s.reps!=null){var er=document.getElementById('inp_'+exId+'_'+si+'_reps');if(er){er.value=s.reps||'';updSet(exId,si,'reps',er.value);}}
    if(s.weight!=null){var ew=document.getElementById('inp_'+exId+'_'+si+'_weight');if(ew){ew.value=s.weight||'';updSet(exId,si,'weight',ew.value);}}
  });
  // Auto-mark exercise as done when filled
  var hasRealData=rec.some(function(s){return (s.reps&&s.reps!=='')||(s.weight&&s.weight!=='')||(s.time&&s.time!=='');});
  if(hasRealData){
    mState[exId].done=true;
    var mc=document.getElementById('exchk_'+exId);
    if(mc)mc.classList.add('done');
    rec.forEach(function(s,si){
      mState[exId].sets[si].done=true;
      var sc=document.getElementById('setchk_'+exId+'_'+si);
      if(sc)sc.classList.add('done');
    });
  }
}

function setFontSize(sz){
  localStorage.setItem('ppl_font',sz);
  applyFont(sz);
  rProg();
}
function applyFont(sz){
  var map={s:0.85,m:1,l:1.15};
  document.body.style.zoom=map[sz]||1;
}
function setTheme(th){
  localStorage.setItem('ppl_theme',th);
  applyTheme(th);
  rProg();
}
function applyTheme(th){
  if(th==='light'){
    document.documentElement.style.setProperty('--bg','#f5f5f0');
    document.documentElement.style.setProperty('--surface','#ffffff');
    document.documentElement.style.setProperty('--surface2','#ebebeb');
    document.documentElement.style.setProperty('--border','#dddddd');
    document.documentElement.style.setProperty('--text','#1a1a1a');
    document.documentElement.style.setProperty('--muted','#888888');
  } else {
    document.documentElement.style.setProperty('--bg','#0c0c0e');
    document.documentElement.style.setProperty('--surface','#18181c');
    document.documentElement.style.setProperty('--surface2','#1e1e26');
    document.documentElement.style.setProperty('--border','#2c2c36');
    document.documentElement.style.setProperty('--text','#e8e4dc');
    document.documentElement.style.setProperty('--muted','#6c6c7e');
  }
}
function toggleSummary(){
  window._showSummary=!window._showSummary;
  renderMonthlySummary();
}
function renderMonthlySummary(){
  var wrap=document.getElementById('monthlySummary');
  if(!wrap)return;
  if(!window._showSummary){wrap.innerHTML='';return;}
  var yr=calDate.getFullYear(),mo=calDate.getMonth();
  var first=new Date(yr,mo,1),last=new Date(yr,mo+1,0);
  var data=load();
  var total=0,fullDays=0,partDays=0,totalSets=0,prs=0;
  for(var d=1;d<=last.getDate();d++){
    var date=new Date(yr,mo,d);
    if(date>now())break;
    var key=toKey(date);
    var log=data.logs[key]||{};
    var st=dayStatus(key,date);
    total++;
    if(st==='full'||st==='rest-done')fullDays++;
    else if(st==='partial')partDays++;
    // count sets
    ['morning','ppl'].forEach(function(t){
      if(log[t]&&log[t].exercises){
        Object.values(log[t].exercises).forEach(function(ex){
          if(ex.sets)totalSets+=ex.sets.filter(function(s){return !!s.done;}).length;
        });
      }
    });
  }
  var pct=total?Math.round(fullDays/total*100):0;
  var h='<div style="margin:8px 20px 0;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px">';
  h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:12px">'+calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'})+' — Summary</div>';
  h+='<div class="summary-row"><span>Days Tracked</span><span class="summary-val">'+total+'</span></div>';
  h+='<div class="summary-row"><span>Full Days Completed</span><span class="summary-val" style="color:var(--success)">'+fullDays+'</span></div>';
  h+='<div class="summary-row"><span>Partial Days</span><span class="summary-val" style="color:var(--morning)">'+partDays+'</span></div>';
  h+='<div class="summary-row"><span>Completion Rate</span><span class="summary-val">'+pct+'%</span></div>';
  h+='<div class="summary-row"><span>Total Sets Logged</span><span class="summary-val" style="color:var(--pull)">'+totalSets+'</span></div>';
  h+='</div>';
  wrap.innerHTML=h;
}
function setReason(key,reason){
  var data=load();
  if(!data.logs[key])data.logs[key]={};
  if(data.logs[key].reason===reason)delete data.logs[key].reason;
  else data.logs[key].reason=reason;
  save(data);rWeek();
}
function closeModal(){
  document.getElementById('overlay').classList.remove('open');
  mType=null;mKey=null;mState={};mNotes='';mPrevNotes='';mStartHHMM='';mEndHHMM='';mStartConfirmed=false;
  stopRestTimer();
  mWarmup=[];mCooldown=[];mWarmupOpen=false;mCooldownOpen=false;
  // Don't clear swaps here - keep them for session
}
document.getElementById('overlay').addEventListener('click',function(e){if(e.target===this)closeModal();});

