// ── TODAY ──────────────────────────────────────────────────────
function rToday(){
  try{ _rToday(); } catch(e){
    document.getElementById('sc-today').innerHTML=
      '<div style="padding:24px 20px;color:var(--danger);font-family:\'Barlow\',sans-serif">'
      +'<div style="font-size:14px;font-weight:700;margin-bottom:8px">ProTrain Error</div>'
      +'<div style="font-size:12px;opacity:.8">'+e.message+'</div>'
      +'<div style="font-size:11px;opacity:.5;margin-top:6px">Check console for details</div></div>';
    console.error('rToday error:',e);
  }
}
function _rToday(){
  var t=now(),key=toKey(t);
  var log=load().logs[key]||{};
  var rest=isRest(t),pd=pplDay(t);
  var sb=calcStreak();
  var mDone=!!(log.morning&&log.morning.done),pDone=!!(log.ppl&&log.ppl.done);
  var dow=t.getDay();
  var greets=['Rest up','Let\'s go','Good morning','Hey there','Welcome back','Rise up','Let\'s work'];
  var h='<div class="ph"><div class="ph-tag">'+greets[dow]+' </div>';
  h+='<div class="ph-title">'+DAYS_FULL[dow]+'</div>';
  h+='<div class="ph-sub">'+t.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})+'</div></div>';
  // Phase card
  var ph=getCurrentPhase();
  if(ph){
    h+='<div class="phase-card" style="--phase-color:'+ph.color+'">';
    h+='<div class="phase-tag">Training Phase</div>';
    h+='<div class="phase-name">'+ph.name+'</div>';
    h+='<div class="phase-desc">Week '+ph.week+' of '+CYCLE_LENGTH+(ph.cycleNum>0?' · Cycle '+(ph.cycleNum+1):'')+' - '+ph.desc+'</div>';
    h+='<div class="phase-progress"><div class="phase-fill" style="width:'+ph.pct+'%"></div></div>';
    h+='</div>';
  }
  if(isDeloadWeek()){
    var _dlWkLabel='Deload Week';
    var _dlInfo=getCycleWeekInfo(now());
    if(_dlInfo)_dlWkLabel='Deload Week \u2014 Week '+_dlInfo.weekNum+' of '+CYCLE_LENGTH;
    h+='<div class="deload-banner"><div style="font-size:24px">\u26a0\ufe0f</div><div><div class="deload-text">'+_dlWkLabel+'</div><div class="deload-sub">Use about 85% of your working weight and stop each exercise 1-2 sets early. Next week resumes from your last normal session.</div></div></div>';
  }
  var cs=calcConsistency();
  var totalDaysLogged=Object.keys(load().logs).length;
  var csC=cs>=80?'var(--success)':cs>=50?'var(--morning)':'var(--danger)';
  var csLabel=totalDaysLogged<3?'Just Getting Started!':'4-Week Consistency';
  var csDisplay=totalDaysLogged<3?'':cs+'%';
  h+='<div class="consist-card"><div class="consist-num" style="color:'+csC+'">'+
    (totalDaysLogged<3?'<span style="font-size:20px">Day '+totalDaysLogged+'</span>':cs+'<span style="font-size:16px">%</span>')+
  '</div>';
  h+='<div class="consist-right"><div class="consist-lbl">'+csLabel+'</div>';
  h+='<div class="consist-bar"><div class="consist-fill" style="width:'+cs+'%;background:'+csC+'"></div></div></div></div>';
  var prevWS=getMondayOf(t);prevWS.setDate(prevWS.getDate()-7);
  var lwDone=0,lwVol=0;
  for(var lwi=0;lwi<7;lwi++){var lwd=new Date(prevWS);lwd.setDate(prevWS.getDate()+lwi);var lwk=toKey(lwd);var lwlog=load().logs[lwk]||{};if(dayComplete(lwk,lwd))lwDone++;lwVol+=calcSessionVol(lwlog,'ppl');}
  if(lwDone>0){
    var lwCyc=getCyclingWeekStats(prevWS);
    h+='<div class="week-sum"><div class="week-sum-hdr">Last Week Recap</div><div class="week-sum-stats">';
    h+='<div class="wsstat"><div class="wsstat-val" style="color:var(--success)">'+lwDone+'/7</div><div class="wsstat-lbl">Days Done</div></div>';
    h+='<div class="wsstat"><div class="wsstat-val" style="color:var(--pull)">'+Math.round(lwVol/1000*10)/10+'k</div><div class="wsstat-lbl">kg Vol</div></div>';
    h+='<div class="wsstat"><div class="wsstat-val" style="color:var(--morning)">'+Math.round(lwDone/7*100)+'%</div><div class="wsstat-lbl">Rate</div></div>';
    h+='<div class="wsstat"><div class="wsstat-val" style="color:var(--legs)">'+lwCyc.done+'/'+lwCyc.total+'</div><div class="wsstat-lbl">🚴 Legs</div></div>';
    h+='</div></div>';
  }
  h+='<div class="streak-banner"><div class="s-flame">🔥</div>';
  h+='<div class="s-info"><div class="s-num">'+sb.streak+'</div><div class="s-lbl">day streak</div></div>';
  h+='<div class="s-best">Best: '+sb.best+'d</div></div>';
  var hasAnyData=Object.keys(load().logs).length>0;
  if(!hasAnyData){
    h+='<div class="empty-state">';
    h+='<div class="empty-icon">🏋️</div>';
    h+='<div class="empty-title">Ready to Train?</div>';
    h+='<div class="empty-desc">Log your first session to start tracking progress. Tap the cards below to get started.</div>';
    h+='</div>';
  }
  h+='<div class="scard"><div class="scard-hdr" onclick="openModal(\'morning\',\''+key+'\')">'; 
  h+='<div class="scard-icon" style="background:color-mix(in srgb,#fbbf24 15%,transparent)">🌅</div>';
  h+='<div class="scard-info"><div class="scard-name">Morning Routine</div><div class="scard-meta">7 exercises · ~15 min · Every day</div></div>';
  h+='<div class="scard-badge '+(mDone?'done-badge':'log-badge')+'">'+(mDone?'Edit ✓':'Log')+'</div></div></div>';
  // Cycling commute tracker
  h+=renderCyclingCard(key);
  if(rest){
    h+='<div class="rcard"><div class="rcard-icon">😴</div>';
    h+='<div class="rcard-title">Rest Day</div>';
    h+='<div class="rcard-sub">Recovery is part of the program.<br>Just do your morning routine and rest up.</div></div>';
    // Find the nearest previous PPL day from the actual current schedule
    var _rsched=getCurrentSchedule();
    var restPplDay=null;
    for(var _ri=1;_ri<=7;_ri++){var _rd=(dow-_ri+7)%7;if(_rsched[_rd]){restPplDay=_rsched[_rd];break;}}

    if(restPplDay){var ri=PPL[restPplDay];h+='<button class="rest-swap-btn" onclick="openModal(\'ppl\',\''+key+'\')">📝 Log '+ri.name+' Anyway</button>';}
    h+='<div class="recovery-card"><div class="recovery-hdr">Active Recovery Ideas</div>';
    RECOVERY_TIPS.forEach(function(tip){h+='<div class="recovery-item"><span style="font-size:18px">'+tip.icon+'</span>'+tip.text+'</div>';});
    h+='</div>';
  } else {
    var info=PPL[pd];
    h+='<div class="scard"><div class="scard-hdr" onclick="openModal(\'ppl\',\''+key+'\')">';
    h+='<div class="scard-icon" style="background:color-mix(in srgb,'+info.color+' 15%,transparent)">'+DAY_ICONS[pd]+'</div>';
    h+='<div class="scard-info"><div class="scard-name" style="color:'+info.color+'">'+info.name+'</div>';
    h+='<div class="scard-meta">'+EX[pd].length+' exercises · PPL '+pd.toUpperCase()+'</div></div>';
    h+='<div class="scard-badge '+(pDone?'done-badge':'log-badge')+'">'+(pDone?'Edit ✓':'Log')+'</div></div></div>';
  }
  // Muscle map
  var todayDayKey=rest?null:(pd||null);
  if(todayDayKey)h+=renderMuscleMap(todayDayKey);
  else if(rest)h+=renderMuscleMap('morning');
  if(checkBackupBanner()){
    h+='<div class="backup-banner">';
    h+='<span style="font-size:18px">💾</span>';
    h+='<div class="backup-banner-txt">'+getMilestoneStats().sessions+' sessions logged! Export your data to keep it safe.</div>';
    h+='<button class="backup-banner-btn" onclick="exportData()">Export</button>';
    h+='<button class="backup-dismiss" onclick="dismissBackupBanner()" aria-label="Dismiss reminder">&times;</button>';
    h+='</div>';
  }
  h+='<div style="margin:10px 20px 0;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;gap:10px;cursor:pointer" onclick="go(\'guide\',document.querySelectorAll(\'.nbtn\')[4])">';
  h+='<span style="font-size:20px">📖</span><div style="flex:1"><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:15px;font-weight:700">Workout Reference Guide</div>';
  h+='<div style="font-size:12px;color:var(--muted);margin-top:2px">How-to for every exercise</div></div>';
  h+='<div style="font-size:16px;color:var(--muted)">›</div></div>';
  document.getElementById('sc-today').innerHTML=h;
}

// ── WEEK ───────────────────────────────────────────────────────
function rWeek(){
  var t=now();
  var offsetDate=new Date(t);offsetDate.setDate(t.getDate()+weekOffset*7);
  var days=getWeekDays(offsetDate);
  if(selWDay===null){var d=t.getDay();selWDay=d===0?6:d-1;}
  var weekLabel=weekOffset===0?'This Week':weekOffset>0?'Future Week':'Week -'+Math.abs(weekOffset);
  var weekHasData=days.some(function(d){return !!load().logs[toKey(d)];});
  var h='<div class="week-nav">';
  h+='<button class="week-nav-btn" onclick="changeWeekOffset(-1)">&#8249;</button>';
  h+='<div class="week-nav-title">'+weekLabel+'</div>';
  h+='<button class="week-nav-btn" onclick="changeWeekOffset(1)">&#8250;</button>';
  h+='</div>';
  h+='<div class="ph" style="padding-top:10px"><div class="ph-sub" style="margin:0">'+fmtShort(days[0])+' - '+fmtShort(days[6])+'</div></div>';
  h+='<div class="week-strip">';
  days.forEach(function(d,i){
    var key=toKey(d),st=dayStatus(key,d);
    var isT=key===toKey(t),isSel=i===selWDay;
    var rest=isRest(d);
    var data=load().logs[key]||{};
    var d1c='dot',d2c='dot';
    if(st==='full'){d1c+=' done';d2c+=' done';}
    else if(st==='partial'){
      d1c+=(data.morning&&data.morning.done)?' done':' miss';
      d2c+=(!rest)?((data.ppl&&data.ppl.done)?' done':' miss'):' rest';
    }else if(st==='incomplete'){d1c+=' part';d2c+=rest?' rest':' part';}
    else if(st==='rest-done'){d1c+=' done';d2c+=' rest';}
    else if(st==='rest-partial'){d1c+=' part';d2c+=' rest';}
    else if(st==='rest-miss'){d2c+=' rest';}
    else if(st==='missed'){d1c+=' miss';d2c+=rest?' rest':' miss';}
    else{if(rest)d2c+=' rest';}
    h+='<div class="dpill'+(isT?' today':'')+(isSel?' sel':'')+'" onclick="selDay('+i+')">';
    h+='<div class="dpill-name">'+DAYS_SHORT[d.getDay()]+'</div>';
    h+='<div class="dpill-num">'+d.getDate()+'</div>';
    h+='<div class="ddots"><div class="'+d1c+'"></div><div class="'+d2c+'"></div></div></div>';
  });
  h+='</div>';
  var sd=days[selWDay],sk=toKey(sd);
  var slog=load().logs[sk]||{},srest=isRest(sd),spd=pplDay(sd);
  var realToday=now();var isTod=sk===toKey(realToday);var isFut=sd>realToday;
  h+='<div class="wdetail"><div class="wdetail-date">'+fmtLong(sd)+(isTod?' · Today':'')+'</div>';
  h+='<div class="wdetail-row"><span class="wdetail-lbl">🌅 Morning Routine</span>';
  h+='<span class="wdetail-val" style="color:'+(slog.morning&&slog.morning.done?'var(--success)':isFut?'var(--muted)':'var(--danger)')+'">'+
    (slog.morning&&slog.morning.done?'✓ Complete':isFut?'—':(slog.morning&&slog.morning.exercises&&Object.keys(slog.morning.exercises).length)?'⚠️ Incomplete':'❌ Not logged')+'</span></div>';
  if(srest){
    h+='<div class="wdetail-row"><span class="wdetail-lbl">😴 Rest Day</span><span class="wdetail-val" style="color:var(--rest)">Recovery</span></div>';
  } else {
    var info=PPL[spd];
    h+='<div class="wdetail-row"><span class="wdetail-lbl" style="color:'+info.color+'">'+DAY_ICONS[spd]+' '+info.name+'</span>';
    h+='<span class="wdetail-val" style="color:'+(slog.ppl&&slog.ppl.done?'var(--success)':isFut?'var(--muted)':'var(--danger)')+'">'+
      (slog.ppl&&slog.ppl.done?'✓ Complete':isFut?'—':(slog.ppl&&slog.ppl.exercises&&Object.keys(slog.ppl.exercises).length)?'⚠️ Incomplete':'❌ Not logged')+'</span></div>';
  }
  var mNotesTxt=(slog.morning&&slog.morning.notes)||null;
  var pNotesTxt=(!srest&&slog.ppl&&slog.ppl.notes)||null;
  var mDurTxt=(slog.morning&&slog.morning.duration)||0;
  var pDurTxt=(!srest&&slog.ppl&&slog.ppl.duration)||0;
  var totalDur=(mDurTxt||0)+(pDurTxt||0);
  if(totalDur>0){h+='<div style="font-size:11px;color:var(--muted);padding:6px 0;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px">⏱️ Session duration: '+totalDur+' min</div>';}
  if(mNotesTxt){
    h+='<div style="margin-top:8px;padding:8px 10px;background:color-mix(in srgb,var(--morning) 6%,transparent);border-left:3px solid var(--morning);border-radius:0 6px 6px 0;font-size:12px;color:#a0a0b0;line-height:1.5">&#128221; Morning: '+esc(mNotesTxt)+'</div>';
  }
  if(pNotesTxt){
    h+='<div style="margin-top:6px;padding:8px 10px;background:color-mix(in srgb,var(--push) 6%,transparent);border-left:3px solid var(--push);border-radius:0 6px 6px 0;font-size:12px;color:#a0a0b0;line-height:1.5">&#128221; PPL: '+esc(pNotesTxt)+'</div>';
  }
  if(!srest&&slog.ppl&&slog.ppl.exercises&&Object.keys(slog.ppl.exercises).length){
    h+='<div style="margin-top:10px;font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px">Logged Sets</div>';
    var curIds=EX[spd].map(function(e){return e.id;});
    var loggedIds=Object.keys(slog.ppl.exercises);
    var allIds=curIds.concat(loggedIds.filter(function(id){return curIds.indexOf(id)===-1;}));
    allIds.forEach(function(id){
      var el=slog.ppl.exercises[id];
      if(!el||!el.sets||!el.sets.length)return;
      var curEx=EX[spd].find(function(e){return e.id===id;});
      var resolved=curEx||resolveExById(id);
      var exName=resolved?resolved.name:(el.name?el.name+' (legacy)':id);
      var sv=el.sets.map(function(s){return s.time?s.time+'s':s.weight?s.reps+'r x '+s.weight+'kg':s.bands&&s.bands.length?((s.reps||'?')+'r '+getBandDisplayText(s.bands)):(s.reps||'?')+'r';}).join(' | ');
      h+='<div class="exlog-row"><span>'+exName+'</span><span style="color:var(--muted);font-size:11px">'+sv+'</span></div>';
    });
  }
  // Body metrics
  var bodyData=loadBody(sk);
  if(bodyData&&(bodyData.weight||bodyData.height)){
    h+='<div class="body-inline">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--pull);margin-bottom:8px">⚖️ Body Metrics</div>';
    h+='<div class="body-inline-row">';
    if(bodyData.weight)h+='<div class="body-inline-stat"><div class="body-inline-val">'+bodyData.weight+'</div><div class="body-inline-lbl">kg</div></div>';
    if(bodyData.height)h+='<div class="body-inline-stat"><div class="body-inline-val">'+bodyData.height+'</div><div class="body-inline-lbl">cm</div></div>';
    if(bodyData.bmi)h+='<div class="body-inline-stat"><div class="body-inline-val">'+bodyData.bmi+'</div><div class="body-inline-lbl">BMI · '+bmiLabel(bodyData.bmi)+'</div></div>';
    h+='</div>';
    if(bodyData.note)h+='<div style="font-size:12px;color:#a0a0b0;line-height:1.5;margin-top:6px;border-top:1px solid color-mix(in srgb,var(--pull) 20%,transparent);padding-top:6px">'+bodyData.note+'</div>';
    h+='</div>';
  }
  h+='</div>';
  // Missed reason
  var existingReason=(load().logs[sk]||{}).reason||null;
  var reasonLabels={'sick':'🤒 Sick','travel':'✈️ Travel','rest_swap':'😴 Rest Swap','life':'🙃 Life Happened'};
  if(!isFut&&!isTod&&(dayStatus(sk,sd)==='missed'||dayStatus(sk,sd)==='rest-miss')){
    h+='<div style="margin:0 20px 10px;padding:12px 14px;background:var(--surface);border:1px solid var(--border);border-radius:12px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Missed because...</div>';
    h+='<div class="miss-btns">';
    Object.entries(reasonLabels).forEach(function(e){
      h+='<button class="miss-btn'+(existingReason===e[0]?' sel':'')+'" onclick="setReason(\''+sk+'\',\''+e[0]+'\')">'+e[1]+'</button>';
    });
    h+='</div></div>';
  }
  if(!isFut){
    h+=renderCyclingCard(sk);
    // Delete + refresh-structure buttons for logged sessions
    if(slog.morning&&slog.morning.exercises&&Object.keys(slog.morning.exercises).length){
      h+='<button class="delete-session-btn" onclick="deleteSession(\''+sk+'\',\'morning\')">🗑️ Delete Morning Session</button>';
      h+='<button class="delete-session-btn" style="margin-top:6px;border-color:var(--legs);color:var(--legs)" onclick="resetSessionStructure(\''+sk+'\',\'morning\')">🔄 Refresh Structure (keep values)</button>';
    }
    if(!srest&&slog.ppl&&slog.ppl.exercises&&Object.keys(slog.ppl.exercises).length){
      h+='<button class="delete-session-btn" style="margin-top:6px" onclick="deleteSession(\''+sk+'\',\'ppl\')">🗑️ Delete PPL Session</button>';
      h+='<button class="delete-session-btn" style="margin-top:6px;border-color:var(--legs);color:var(--legs)" onclick="resetSessionStructure(\''+sk+'\',\'ppl\')">🔄 Refresh Structure (keep values)</button>';
    }
    var mDoneW=!!(slog.morning&&slog.morning.done);
    h+='<button class="save-btn" style="--accent:var(--morning);margin-top:10px" onclick="openModal(\'morning\',\''+sk+'\')">'+(mDoneW?'✏️ Edit':'📝 Log')+' Morning Routine</button>';
    if(!srest){
      var infoW=PPL[spd];
      var pDoneW=!!(slog.ppl&&slog.ppl.done);
      h+='<button class="save-btn" style="--accent:'+infoW.color+';margin-top:8px" onclick="openModal(\'ppl\',\''+sk+'\')">'+(pDoneW?'✏️ Edit':'📝 Log')+' '+infoW.name+'</button>';
    }
  }
  document.getElementById('sc-week').innerHTML=h;
}
function selDay(i){selWDay=i;rWeek();}
function changeWeekOffset(dir){
  weekOffset+=dir;
  // Don't allow going more than 1 week into the future
  if(weekOffset>1)weekOffset=1;
  selWDay=null;
  rWeek();
}

