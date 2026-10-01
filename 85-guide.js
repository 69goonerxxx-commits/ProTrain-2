// ── GUIDE ──────────────────────────────────────────────────────
function rGuide(){
  var pendingVideoFetches=[];
  var dayKeys=['morning','d1','d2','d3','d4','d5'];
  var color=DAY_COLORS[guideDay]||'#fbbf24';
  document.documentElement.style.setProperty('--day-color',color);
  var checks=loadChecks();
  var items=guideSec==='exercises'?EX[guideDay]:guideSec==='rules'?[]:(guideSec==='warmup'?WARMUPS[guideDay]:COOLDOWNS[guideDay]);
  var total=items.length;
  var done=items.filter(function(_,i){return !!checks[guideDay+'_'+guideSec+'_'+i];}).length;
  var pct=total?Math.round(done/total*100):0;

  var h='<div class="ph" style="border-bottom:1px solid var(--border)">';
  h+='<div class="ph-tag" id="guideDayTag">'+(guideDay==='morning'?'Daily Morning Routine':'5-Day PPL Program')+'</div>';
  h+='<div class="ph-title" style="color:'+color+'">'+DAY_ICONS[guideDay]+' '+(guideDay==='morning'?'Morning':DAY_SUBTITLES[guideDay])+'</div>';
  h+='<div class="ph-sub">'+DAY_SUBTITLES[guideDay]+'</div></div>';

  h+='<div class="prog-wrap"><div class="prog-lbl"><span>Session Progress</span><span>'+done+' / '+total+'</span></div>';
  h+='<div class="prog-bg"><div class="prog-fill" style="width:'+pct+'%;background:'+color+'"></div></div></div>';

  // Search bar
  h+='<div class="search-wrap"><div class="search-wrap-rel">';
  h+='<span class="search-icon">🔍</span>';
  h+='<input class="search-inp" type="text" placeholder="Search exercises..." value="'+guideSearchTerm+'" oninput="guideSearch(this.value)" id="guideSearchInp">';
  h+='</div></div>';
  h+='<div class="day-tabs">';
  dayKeys.forEach(function(k){
    h+='<button class="dtab'+(k===guideDay?' active':'')+'" onclick="switchGuideDay(\''+k+'\')">'+DAY_LABELS[k]+'</button>';
  });
  h+='</div>';

  h+='<div class="sec-tabs">';
  var allowedSecs=guideDay==='morning'?['exercises','rules']:['warmup','exercises','cooldown','rules'];
  // If current section is warmup/cooldown but we're on morning, reset to exercises
  if(guideDay==='morning'&&(guideSec==='warmup'||guideSec==='cooldown'))guideSec='exercises';
  allowedSecs.forEach(function(s){
    var lbl=s==='warmup'?'Warm-Up':s==='exercises'?'Workout':s==='rules'?'Rules':'Cool-Down';
    h+='<button class="stab'+(s===guideSec?' active':'')+'" onclick="switchGuideSec(\''+s+'\')">' +lbl+'</button>';
  });
  h+='</div>';

  h+='<div class="guide-content">';

  if(guideSec==='exercises'){
    var rawList=EX[guideDay].concat(loadCustomExercises().filter(function(ex){return ex.day===guideDay;}));
    var exList=guideSearchTerm?rawList.filter(function(ex){return ex.name.toLowerCase().includes(guideSearchTerm.toLowerCase());}):rawList;
    exList.forEach(function(ex,i){
      var isOpen=!!openCards[guideDay+'_'+i];
      var isChecked=!!checks[guideDay+'_exercises_'+i];
      var gswap=getSwappedExercise(ex.id);
      var displayExG=gswap||ex;
      h+='<div class="gcard'+(isChecked?' checked':'')+(isOpen?' open':'')+'  " id="gc_'+i+'">';
      h+='<div class="gcard-hdr" onclick="toggleGCard('+i+')">';
      h+='<button class="gchk'+(isChecked?' done':'')+'" onclick="event.stopPropagation();toggleGCheck('+i+',this)">&#10003;</button>';
      h+='<div class="gcard-info"><div class="gcard-name">'+ex.name+'</div>';
      if(gswap)h+='<div style="font-size:11px;color:var(--legs);font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px;margin-bottom:2px">🔄 '+gswap.name+'</div>';
      // Pull-up progression hint
      if(ex.id==='d1_pul'||ex.id==='d4_pul'){
        var pulBest=getPullupBest();
        var pulMsg=pulBest>0?'Current best: '+pulBest+' reps → Target: 3×8':'Start: 3×3 → Target: 3×8 by end of Base Building';
        h+='<div style="font-size:11px;color:var(--morning);font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px;margin-bottom:2px">📈 '+pulMsg+'</div>';
      }
      h+='<div class="gcard-meta">';
      if(ex.tag)h+='<span class="gtag">'+ex.tag+'</span>';
      if(ex.rest)h+='<span class="grest">Rest: '+ex.rest+'</span>';
      h+='</div>';
      if(ex.muscles)h+='<div style="margin-top:4px;font-size:11px;color:var(--muted)"><span style="color:var(--day-color,var(--morning))">&#9679;</span> '+ex.muscles.primary+'<span style="color:var(--border)"> · </span>'+ex.muscles.secondary+'</div>';
      h+='</div>';
      h+='<div class="gsets">'+ex.target+'</div>';
      if(SUBS[ex.id]&&!gswap){h+='<button class="sub-btn" onclick="event.stopPropagation();togSub(\'guide_'+ex.id+'\')" title="Alternatives">🔄</button>';}
      if(gswap){h+='<button class="sub-btn" style="border-color:var(--legs);color:var(--legs)" onclick="event.stopPropagation();resetSwapToOriginal(\''+ex.id+'\')" title="Restore">↩</button>';}
      h+='<div class="garr">&#9660;</div></div>';
      h+='<div class="gdetail"><div class="gdetail-inner">';
      if(gswap){
        h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">';
        h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--legs)">Swapped Exercise</div>';
        h+='<button onclick="event.stopPropagation();resetSwapToOriginal(\''+ex.id+'\');" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:1px">Restore Original</button>';
        h+='</div>';
        h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;margin-bottom:4px">'+gswap.name+'</div>';
        h+='<div style="font-size:11px;color:var(--muted);margin-bottom:12px">Targets: '+gswap.muscles.primary+', '+gswap.muscles.secondary+'</div>';
        h+='<div class="gdetail-lbl">How to do it</div>';
        h+='<ul class="gsteps">';
        (gswap.steps||[]).forEach(function(s){h+='<li>'+s+'</li>';});
        h+='</ul>';
        if(gswap.tip)h+='<div class="gtip">'+gswap.tip+'</div>';
      } else {
        h+='<div class="gdetail-lbl">How to do it</div>';
        h+='<ul class="gsteps">';
        (ex.steps||[]).forEach(function(s){h+='<li>'+s+'</li>';});
        h+='</ul>';
        if(ex.tip)h+='<div class="gtip">'+ex.tip+'</div>';
      }
      if(isOpen){
        h+='<div class="ex-vid-wrap" id="vidg_'+ex.id+'"></div>';
        pendingVideoFetches.push({id:ex.id,name:displayExG.name});
      }
      h+='</div></div>';
      // Sub panel
      if(SUBS[ex.id]&&!gswap){
        h+='<div class="sub-panel" id="guide_'+ex.id+'">';
        h+='<div class="sub-panel-title">Alternative Exercises</div>';
        SUBS[ex.id].forEach(function(s,si){
          h+='<div class="sub-item">';
          h+='<div><div style="font-size:13px">'+s.name+'</div><div style="font-size:11px;color:var(--muted)">'+s.muscles.primary+', '+s.muscles.secondary+'</div></div>';
          h+='<button class="sub-use-btn" onclick="event.stopPropagation();swapExercise(\''+ex.id+'\','+si+')">Use</button>';
          h+='</div>';
        });
        h+='</div>';
      }
      h+='</div>';
    });
  } else if(guideSec==='rules'){
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:6px;border-color:var(--border)">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted)">The Golden Rule</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--text)">Every session should be slightly harder than the last — more weight, more reps, slower tempo, or less rest. If nothing changed, you did not progress.</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Weighted Exercises — Double Progression</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">Work at a given weight until you complete all target reps across all sets with clean form and 1–2 reps left in the tank. Only then increase weight next session.</div>';
    h+='<div style="font-size:12px;color:var(--text)">▸ Dumbbells: add <strong>2kg</strong></div>';
    h+='<div style="font-size:12px;color:var(--text)">▸ EZ bar: add <strong>2.5kg</strong> (using dumbbell plates)</div>';
    h+='<div style="font-size:12px;color:var(--danger)">▸ Can\'t hit bottom of rep range on Set 1? Weight is too heavy — drop it.</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Pull-ups — Rep Progression</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">Start at 3×3 on Day 2 and Day 5. Add 1 clean rep per set when all sets feel controlled. Never grind ugly reps — quality beats quantity. Use Black band for assistance.</div>';
    h+='<div style="font-size:12px;color:var(--text)">▸ Long-term target: <strong>3×8</strong> by end of Base Building</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Push-up Variations — Tempo Progression</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">When target reps feel easy with good form, slow the descent to 3 seconds. When 3 seconds is easy, progress to 4 seconds.</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Timed Core — Time Progression</div>';
    h+='<div style="font-size:12px;color:var(--text)">▸ Plank: 45s → 50s → 55s → 60s → ...</div>';
    h+='<div style="font-size:12px;color:var(--text)">▸ Side Plank: 30s → 35s → 40s → ...</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">Add 5 seconds per week when the hold feels comfortable.</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Rep-Based Core — Rep Progression</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">Add 2 reps per week when all sets are completed cleanly.</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Resistance Bands — Color Progression</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">Progress from lighter to heavier when current band is too easy. Combine bands for resistance between steps.</div>';
    h+='<div style="font-size:12px;color:var(--text);line-height:2">▸ <span style="color:#fbbf24">■</span> Yellow → <span style="color:#ef4444">■</span> Red → <span style="color:#22c55e">■</span> Green → <span style="color:#22d3ee">■</span> Blue → <span style="color:#888">■</span> Black</div>';
    h+='</div>';
    h+='<div class="simple-item" style="flex-direction:column;align-items:flex-start;gap:10px">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--accent)">Band Exercises — Rep + Band Progression</div>';
    h+='<div style="font-size:13px;line-height:1.6;color:var(--muted)">For band exercises tracked by reps (face pulls, rows, pushdowns, etc.): complete all target reps cleanly → add 2 reps next session. Once you are 6+ reps above the original target, upgrade to the next band color and reset to original rep target.</div>';
    h+='<div style="font-size:12px;color:var(--text)">▸ Example: Band Face Pulls target 3×15 → hit 3×21 → move to heavier band → back to 3×15</div>';
    h+='</div>';
  } else {
    var note=guideSec==='warmup'
      ?(guideDay==='morning'?'Flow through these continuously — no rest. Approx 4 minutes. This is joint prep, not a workout.':'15-30 sec between sets if needed. No rest between exercises. Finish with 1 light set of your first exercise at 50% effort.')
      :'Flow through these continuously with no rest between stretches. Take your time on each one.';
    h+='<div class="simple-note">'+note+'</div>';
    var list=guideSec==='warmup'?WARMUPS[guideDay]:COOLDOWNS[guideDay];
    list.forEach(function(item,i){
      var isChecked=!!checks[guideDay+'_'+guideSec+'_'+i];
      h+='<div class="simple-item'+(isChecked?' checked':'')+'">';
      h+='<button class="schk'+(isChecked?' done':'')+'" onclick="toggleSimpleCheck(\''+guideSec+'\','+i+',this)">&#10003;</button>';
      h+='<div class="simple-text">'+item+'</div></div>';
    });
  }
  h+='</div>';

  h+='<div class="rest-legend"><div class="rl-title">Rest Time Guide</div>';
  h+='<div class="rl-row"><span class="rl-lbl">Isolation exercises</span><span class="rl-time" style="color:var(--legs)">60-90 sec</span></div>';
  h+='<div class="rl-row"><span class="rl-lbl">Compound movements</span><span class="rl-time" style="color:var(--pull)">2-3 min</span></div>';
  h+='<div class="rl-row"><span class="rl-lbl">Heavy strength (1-5 rep)</span><span class="rl-time" style="color:var(--push)">3-5 min</span></div></div>';
  h+='<button class="reset-btn" onclick="resetGuideChecks()">&#8635; Reset Session Checks</button>';

  document.getElementById('sc-guide').innerHTML=h;
  pendingVideoFetches.forEach(function(item){
    fetchExVideo(item.id,item.name,'vidg_'+item.id);
  });
}
function guideSearch(val){
  guideSearchTerm=val;
  guideSec='exercises';
  rGuide();
  // Re-focus search input
  var el=document.getElementById('guideSearchInp');
  if(el)setTimeout(function(){el.focus();el.setSelectionRange(el.value.length,el.value.length);},50);
}
function switchGuideDay(day){guideDay=day;guideSec='exercises';openCards={};rGuide();}
function switchGuideSec(sec){guideSec=sec;rGuide();}
function toggleGCard(i){
  var k=guideDay+'_'+i;
  openCards[k]=!openCards[k];
  rGuide();
}
function toggleGCheck(i,btn){
  var checks=loadChecks();
  var k=guideDay+'_exercises_'+i;
  checks[k]=!checks[k];
  saveChecks(checks);
  btn.classList.add('popped');
  setTimeout(function(){btn.classList.remove('popped');},300);
  rGuide();
}
function toggleSimpleCheck(sec,i,btn){
  var checks=loadChecks();
  var k=guideDay+'_'+sec+'_'+i;
  checks[k]=!checks[k];
  saveChecks(checks);
  btn.classList.add('popped');
  setTimeout(function(){btn.classList.remove('popped');},300);
  rGuide();
}
function togSub(panelId){
  var panel=document.getElementById(panelId);
  if(panel)panel.classList.toggle('open');
}
function resetGuideChecks(){
  var checks=loadChecks();
  Object.keys(checks).forEach(function(k){if(k.startsWith(guideDay+'_'))delete checks[k];});
  saveChecks(checks);
  rGuide();
}

