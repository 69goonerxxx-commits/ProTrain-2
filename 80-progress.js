// ── PROGRESS ───────────────────────────────────────────────────
var changelogOpen=false;
function toggleChangelog(){changelogOpen=!changelogOpen;rProg();}
function renderChangelog(){
  var entries=[
    {ver:'v8',items:[
      'Behind the scenes: the app is now built from small source files (see README) while still shipping as one index.html',
      'Exercise ids are documented as permanent, and a rename alias table keeps history attached if one is ever renamed',
      'Removed hard-coded personal wording (rooftop, school) from tips and the commute labels',
      'New app icon: the Omega inside a 10-segment cycle ring (dimmed segments are the deload weeks). Re-add the app to your home screen to see it'
    ]},
    {ver:'v7',items:[
      'Fixed the schedule switch after week 2 rewriting your past weeks - each date keeps the schedule it was logged under',
      'Weight now goes up only when every set hits the top of the rep range; smaller, more realistic weight steps',
      'Unsaved sets are autosaved and restored if the app closes mid-workout',
      'Safer backup import (merges per day, keeps your higher PR count and best streak)',
      'Muscle volume no longer double-counts, and muscle labels like Chest (Upper) now merge into Chest',
      'Added side delt, rear delt and trap work (Upper day: Lateral Raises + Band Reverse Fly; Pull day: DB Shrugs)',
      'Exercise tips no longer name weekdays, so they stay correct in re-entry weeks',
      'PRs now compare estimated 1RM for weighted lifts, ignore unticked sets, and the PR count is recalculated from your logs',
      'Fixed Away Mode never switching off on days where a bodyweight swap was missing (Pike Push-ups and Table Rows added as alternatives)',
      'Deload is now ~85% load and you stop each exercise 1-2 sets early (was 60% load); deload weeks no longer become the next baseline',
      'Climb weeks accept one rep below the top of the range before adding weight; Build weeks need the full top',
      'Progression reads RPE: avg 9.5+ holds the weight, avg 6.5 or lower doubles the step',
      'Alternate exercises borrow their base exercise starter weight; added starters for Overhead Extension and Calf Raises',
      'Pull-ups and push-ups can now carry added weight (+kg box); progression adds load once you hit the top reps, and a heavier set outranks more reps for PRs',
      'New Find my starting weight button on weighted exercises you have not logged yet; enter a trial set like 10x12 and it suggests a start weight',
      'Accessibility: labelled buttons and dialog, larger text and tap targets, higher-contrast muted text, visible keyboard focus, reduced-motion support',
      'Removed two citations that did not support the claims; BMI no longer shows Normal/Overweight verdicts',
      'Faster loading: saved data is no longer re-parsed on every read; import now explains exactly why it failed',
      'Streaks now depend on your workout; skipping the morning routine no longer breaks them',
      'Fixed fonts not applying, pinch-zoom, iPhone home-bar overlap, and an offline-cache issue'
    ]},
    {ver:'v6',items:[
      'Full program rebuild: Upper / Lower / Push / Pull / Legs replaces the old Push/Pull/Legs split',
      'Rest days moved to Wednesday and Sunday instead of Thursday and Sunday',
      'Every exercise, swap alternative, starting weight, and away-mode substitute updated to match the new program',
      'Added direct oblique and anti-lateral-flexion core work (Band Russian Twist, Side Plank) alongside existing anti-extension core work',
    ]},
    {ver:'v5.5',items:[
      'Away Mode: one tap swaps a whole day to bodyweight-only versions',
      'Fixed old sessions reverting to an outdated structure when using Copy Last',
      'Fixed Left/Right/Chin Tuck stretch sets not saving on some devices',
      'Added Refresh Structure — updates a session to match current exercises without losing logged values',
      'Added Cycling tracker (commute legs + casual rides)',
      'Added this changelog, and a scanner that flags any old sessions still out of sync'
    ]},
    {ver:'v5.0',items:[
      'Every exercise now has 5 total variations, each tracked with its own separate history and PRs',
      'Fixed bands not saving, swap not refreshing immediately, and two muscle-tracking widgets disagreeing with each other',
      'Fixed a custom-exercise bug that silently broke the Resistance Bands option',
      'Alt exercises used on paired training days (e.g. Tuesday/Saturday) now share one combined history'
    ]},
    {ver:'v4.5',items:[
      'Added a visible last-session reference before auto-filling a suggested weight',
      'Rebuilt the program phases to match a real 9→10-week cycle: Build, Deload, Consolidate, Climb, Consolidate, Climb, Deload',
      'Rebalanced Leg Day toward posterior chain and calves',
      'Fixed a couple of equipment-heavy stretch alternatives'
    ]},
    {ver:'v4.0',items:[
      'Fixed exercise swaps not updating consistently between Today, Guide, and video lookup',
      'Fixed Pull-ups and Band Face Pulls history being split across their two training days',
      'Added muscle-hit-count tracking alongside frequency',
      'Fixed Guide layout breaking on long exercise names',
      'Added new alternative exercises across the program, including for every Morning stretch'
    ]}
  ];
  var h='<div class="changelog-box">';
  entries.forEach(function(e){
    h+='<div class="changelog-ver">'+e.ver+'</div><ul class="changelog-list">';
    e.items.forEach(function(i){h+='<li>'+i+'</li>';});
    h+='</ul>';
  });
  h+='</div>';
  return h;
}
function getStructureMismatches(){
  var out=[];
  Object.entries(load().logs).sort().reverse().forEach(function(entry){
    var key=entry[0],log=entry[1];
    ['morning','ppl'].forEach(function(type){
      var sess=log[type];
      if(!sess||!sess.exercises)return;
      Object.keys(sess.exercises).forEach(function(id){
        var info=resolveExById(id);
        if(!info)return;
        var baseId=info.isAlt?info.baseId:id;
        var baseEx=ALL_EX.find(function(e){return e.id===baseId;});
        if(!baseEx)return;
        var targetLen=baseEx.sets||3;
        var storedLen=(sess.exercises[id].sets||[]).length;
        if(storedLen!==targetLen){
          out.push({date:key,type:type,name:sess.exercises[id].name||info.name,storedLen:storedLen,targetLen:targetLen});
        }
      });
    });
  });
  return out;
}
function rProg(){
  var sb=calcStreak();
  var data=load();
  var total=Object.keys(data.logs).length;
  var t=now();
  var weeks=[];
  for(var w=7;w>=0;w--){
    var ws=getMondayOf(t);ws.setDate(ws.getDate()-w*7);
    var done=0,tot=0;
    for(var dd=0;dd<7;dd++){
      var dt=new Date(ws);dt.setDate(ws.getDate()+dd);
      if(dt>t)break;
      tot++;if(dayComplete(toKey(dt),dt))done++;
    }
    weeks.push({label:fmtShort(ws),pct:tot?Math.round(done/tot*100):0});
  }
  var maxP=Math.max.apply(null,weeks.map(function(w){return w.pct;}).concat([1]));
  var h='<div class="ph"><div class="ph-tag">Your Progress</div><div class="ph-title">Stats</div></div>';
  var mismatches=getStructureMismatches();
  if(mismatches.length){
    h+='<div class="mismatch-banner">';
    h+='<div class="mismatch-hdr">⚠️ '+mismatches.length+' logged session'+(mismatches.length>1?'s':'')+' out of sync with current exercise structure</div>';
    mismatches.slice(0,8).forEach(function(m){
      h+='<div class="mismatch-row"><div class="mismatch-info"><div class="mismatch-name">'+m.name+'</div><div class="mismatch-meta">'+m.date+' · '+(m.type==='morning'?'Morning':'PPL')+' · had '+m.storedLen+' set'+(m.storedLen!==1?'s':'')+', now expects '+m.targetLen+'</div></div>';
      h+='<button class="mismatch-fix-btn" onclick="resetSessionStructure(\''+m.date+'\',\''+m.type+'\')">Fix</button></div>';
    });
    if(mismatches.length>8)h+='<div class="mismatch-more">+ '+(mismatches.length-8)+' more — fixing the ones above may resolve others on the same day</div>';
    h+='</div>';
  }
  if(total>0){
  var durVals=[];
  Object.values(data.logs).forEach(function(log){
    if(log.ppl&&log.ppl.duration)durVals.push(log.ppl.duration);
  });
  var avgDur=durVals.length?Math.round(durVals.reduce(function(a,b){return a+b;},0)/durVals.length):0;
  h+='<div class="stat-row">';
  h+='<div class="stat-card"><div class="stat-num" style="color:var(--morning)">'+sb.streak+'</div><div class="stat-lbl">Streak</div></div>';
  h+='<div class="stat-card"><div class="stat-num" style="color:var(--pull)">'+sb.best+'</div><div class="stat-lbl">Best</div></div>';
  h+='<div class="stat-card"><div class="stat-num" style="color:var(--legs)">'+total+'</div><div class="stat-lbl">Days Logged</div></div>';
  h+='</div>';
  h+='<div class="stat-row" style="margin-top:10px">';
  h+='<div class="stat-card"><div class="stat-num" style="color:var(--push)">'+(avgDur?avgDur+'<span style="font-size:14px;font-weight:400">m</span>':'—')+'</div><div class="stat-lbl">Avg Duration</div></div>';
  h+='<div class="stat-card"><div class="stat-num" style="color:var(--success)">'+getMilestoneStats().sessions+'</div><div class="stat-lbl">Sessions</div></div>';
  h+='<div class="stat-card"><div class="stat-num" style="color:var(--morning)">'+getMilestoneStats().mornings+'</div><div class="stat-lbl">Mornings</div></div>';
  h+='</div>';
  h+='<div class="sec-title">Weekly Completion (Last 8 Weeks)</div>';
  h+='<div class="chart-box"><div class="bars">';
  weeks.forEach(function(w){
    var bh=maxP>0?Math.max(w.pct/maxP*70,w.pct>0?4:0):0;
    h+='<div class="bc"><div class="bar" style="height:'+bh+'px;background:var(--morning);opacity:'+(w.pct===100?1:.6)+'"></div><div class="bar-lbl">'+w.pct+'%</div></div>';
  });
  h+='</div><div class="xlabels">';
  weeks.forEach(function(w){h+='<div class="xlabel">'+w.label.replace(' ','<br>')+'</div>';});
  h+='</div></div>';
  h+='<div class="sec-title">Exercise Progress</div>';
  h+='<select class="ex-sel" id="exSel" onchange="rExChart()">';
  h+='<option value="">— Select exercise —</option>';
  var groups=[
    {label:'Morning',key:'morning'},
    {label:'Day 1 — Upper + Core',key:'d1'},
    {label:'Day 2 — Lower',key:'d2'},
    {label:'Day 3 — Push + Core',key:'d3'},
    {label:'Day 4 — Pull',key:'d4'},
    {label:'Day 5 — Legs',key:'d5'},
  ];
  groups.forEach(function(g){
    h+='<optgroup label="'+g.label+'">';
    EX[g.key].forEach(function(ex){h+='<option value="'+ex.id+'">'+ex.name+'</option>';});
    h+='</optgroup>';
  });
  var _custEx=loadCustomExercises();
  if(_custEx.length){
    h+='<optgroup label="\u2014 Custom \u2014">';
    _custEx.forEach(function(ex){h+='<option value="'+ex.id+'">'+ex.name+'</option>';});
    h+='</optgroup>';
  }
  // Legacy exercises — IDs in logs but no longer resolvable at all (true removals/renames)
  // Alt exercises — IDs in logs that resolve to a known alt (fully valid, just not a base exercise)
  (function(){
    var activeIds=ALL_EX.map(function(e){return e.id;});
    var legacyMap={},altMap={};
    Object.values(load().logs).forEach(function(log){
      ['morning','ppl'].forEach(function(type){
        var sess=log[type];
        if(!sess||!sess.exercises)return;
        Object.entries(sess.exercises).forEach(function(e){
          var id=e[0];
          if(activeIds.indexOf(id)>=0)return;
          var resolved=resolveExById(id);
          if(resolved&&resolved.isAlt){
            if(!altMap[id])altMap[id]=resolved.name;
          } else if(!legacyMap[id]){
            legacyMap[id]=e[1].name||id;
          }
        });
      });
    });
    var altKeys=Object.keys(altMap);
    if(altKeys.length){
      h+='<optgroup label="— Exercise Alternates —">';
      altKeys.forEach(function(id){h+='<option value="'+id+'">'+altMap[id]+'</option>';});
      h+='</optgroup>';
    }
    var legacyKeys=Object.keys(legacyMap);
    if(legacyKeys.length){
      h+='<optgroup label="— Legacy (removed exercises) —">';
      legacyKeys.forEach(function(id){h+='<option value="'+id+'">'+legacyMap[id]+'</option>';});
      h+='</optgroup>';
    }
  })();
  h+='</select><div id="exChart"></div>';
  // Volume chart (last 10 PPL sessions)
  h+='<div class="sec-title">Session Volume (kg)</div>';
  h+='<div class="vol-box"><div class="vol-hdr">Sets x Reps x Weight per session</div><div class="vol-bars">';
  var volSessions=[];
  Object.entries(data.logs).sort().forEach(function(e){
    var v=calcSessionVol(e[1],'ppl');
    if(v>0)volSessions.push({date:e[0].slice(5),vol:v});
  });
  var recentVol=volSessions.slice(-10);
  var maxVol=Math.max.apply(null,recentVol.map(function(s){return s.vol;}).concat([1]));
  recentVol.forEach(function(s){
    var bh=Math.max(s.vol/maxVol*65,4);
    h+='<div class="vol-bc"><div class="vol-v">'+Math.round(s.vol/1000*10)/10+'k</div><div class="vol-bar" style="height:'+bh+'px;background:var(--push)"></div><div class="vol-d">'+s.date+'</div></div>';
  });
  if(!recentVol.length)h+='<div class="no-data">Log sessions to see volume trend</div>';
  h+='</div></div>';

  // Per-muscle weekly sets
  h+='<div class="sec-title">Weekly Muscle Volume (sets this week)</div>';
  h+='<div class="vol-box">';
  var msets=getMuscleWeeklySets();
  var mkeys=Object.keys(msets).sort(function(a,b){return msets[b].sets-msets[a].sets;});
  var maxMS=mkeys.length?Math.max.apply(null,mkeys.map(function(k){return msets[k].sets;})):1;
  if(mkeys.length){
    mkeys.slice(0,10).forEach(function(k){
      var pct=Math.round(msets[k].sets/maxMS*100);
      h+='<div class="mvol-row"><div class="mvol-name">'+msets[k].name+'</div>';
      h+='<div class="mvol-bg"><div class="mvol-fill" style="width:'+pct+'%"></div></div>';
      h+='<div class="mvol-num">'+Math.round(msets[k].sets)+'</div></div>';
    });
  } else {h+='<div class="no-data">Log PPL sessions this week to see muscle volume</div>';}
  h+='</div>';



  // ── Weight Trend Chart
  h+='<div class="sec-title">Body Weight Trend</div>';
  h+='<div class="anl-card" style="padding:14px 14px 10px">';
  (function(){
    var data=load();
    var entries=[];
    Object.entries(data.logs).sort().forEach(function(e){
      var b=e[1].body;
      if(b&&b.weight&&+b.weight>0)entries.push({date:e[0],w:+b.weight});
    });
    entries=entries.slice(-30);
    if(entries.length<2){
      h+='<div class="no-data">Log body weight on 2+ days to see your trend.</div>';
    } else {
      var minW=entries.reduce(function(a,b){return a.w<b.w?a:b;}).w;
      var maxW=entries.reduce(function(a,b){return a.w>b.w?a:b;}).w;
      var range=maxW-minW||1;
      var first=entries[0].w, last=entries[entries.length-1].w;
      var diff=Math.round((last-first)*10)/10;
      var diffCol=diff<0?'var(--success)':diff>0?'var(--danger)':'var(--muted)';
      var diffStr=(diff>0?'+':'')+diff+' kg since start';
      h+='<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">';
      h+='<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:28px;font-weight:800;color:var(--text)">'+last+'<span style="font-size:14px;font-weight:400;color:var(--muted)"> kg</span></div>';
      h+='<div style="font-size:11px;color:var(--muted)">Latest entry</div></div>';
      h+='<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:'+diffCol+'">'+diffStr+'</div>';
      h+='<div style="font-size:11px;color:var(--muted)">'+entries.length+' entries logged</div></div>';
      h+='</div>';
      // SVG sparkline
      var W=280,H=60,pad=4;
      h+='<svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" style="overflow:visible;display:block">';
      // grid lines
      h+='<line x1="0" y1="'+(H-pad)+'" x2="'+W+'" y2="'+(H-pad)+'" stroke="var(--border)" stroke-width="1"/>';
      h+='<line x1="0" y1="'+pad+'" x2="'+W+'" y2="'+pad+'" stroke="var(--border)" stroke-width="1" stroke-dasharray="4,4"/>';
      // build points
      var pts=entries.map(function(e,i){
        var x=pad+i/(entries.length-1)*(W-pad*2);
        var y=H-pad-((e.w-minW)/range)*(H-pad*2);
        return{x:Math.round(x*10)/10,y:Math.round(y*10)/10,w:e.w,date:e.date};
      });
      // gradient fill
      var polyPts=pts.map(function(p){return p.x+','+p.y;}).join(' ');
      var fillPts=pts[0].x+','+(H-pad)+' '+polyPts+' '+pts[pts.length-1].x+','+(H-pad);
      h+='<defs><linearGradient id="wtGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fbbf24" stop-opacity="0.25"/><stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/></linearGradient></defs>';
      h+='<polygon points="'+fillPts+'" fill="url(#wtGrad)"/>';
      // line
      var linePath='M '+pts.map(function(p){return p.x+' '+p.y;}).join(' L ');
      h+='<path d="'+linePath+'" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
      // dots for first, last, min, max
      var special=[0,pts.length-1];
      var minIdx=pts.reduce(function(a,b,i){return pts[i].y>pts[a].y?i:a;},0);
      var maxIdx=pts.reduce(function(a,b,i){return pts[i].y<pts[a].y?i:a;},0);
      [minIdx,maxIdx].forEach(function(i){if(special.indexOf(i)<0)special.push(i);});
      pts.forEach(function(p,i){
        var isSpec=special.indexOf(i)>=0;
        h+='<circle cx="'+p.x+'" cy="'+p.y+'" r="'+(isSpec?4:2)+'" fill="'+(isSpec?'#fbbf24':'var(--surface)')+'" stroke="#fbbf24" stroke-width="'+(isSpec?0:1.5)+'"/>';
      });
      // labels for first/last
      h+='<text x="'+pts[0].x+'" y="'+(pts[0].y-8)+'" fill="var(--muted)" font-size="9" text-anchor="middle">'+pts[0].w+'</text>';
      h+='<text x="'+pts[pts.length-1].x+'" y="'+(pts[pts.length-1].y-8)+'" fill="#fbbf24" font-size="9" text-anchor="middle">'+pts[pts.length-1].w+'</text>';
      h+='</svg>';
      // date range
      var fmt=function(k){return k.slice(5).replace('-','/');};
      h+='<div style="display:flex;justify-content:space-between;margin-top:4px;font-size:11px;color:var(--muted)">';
      h+='<span>'+fmt(entries[0].date)+'</span><span>'+fmt(entries[entries.length-1].date)+'</span></div>';
    }
  })();
  h+='</div>';

  // ── PR Board
  h+='<div class="sec-title">Personal Records 🏆</div>';
  h+='<div class="anl-card">';
  (function(){
    var weighted=ALL_EX.filter(function(e){return e.type==='weighted';});
    var boards=[];
    var allLogs=Object.entries(load().logs).sort();
    weighted.forEach(function(ex){
      var isMorn=ex.id.startsWith('m_');
      var bestW=0,bestReps=0,bestVol=0,bestDate='';
      allLogs.forEach(function(e){
        var src=isMorn?e[1].morning:e[1].ppl;
        if(!src||!src.exercises||!src.exercises[ex.id])return;
        src.exercises[ex.id].sets.forEach(function(s){
          if(s.done&&s.weight&&s.reps){
            var w=+s.weight,r=+s.reps,v=w*r;
            if(w>bestW||(w===bestW&&r>bestReps)){bestW=w;bestReps=r;bestDate=e[0];}
            if(v>bestVol)bestVol=v;
          }
        });
      });
      if(bestW>0)boards.push({name:ex.name,w:bestW,reps:bestReps,vol:bestVol,date:bestDate,id:ex.id});
    });
    boards.sort(function(a,b){return b.w-a.w;});
    if(!boards.length){
      h+='<div class="no-data">Log weighted exercises to build your PR board.</div>';
    } else {
      h+='<div style="display:flex;flex-direction:column;gap:8px">';
      boards.slice(0,10).forEach(function(pr,i){
        var medal=i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
        var dateStr=pr.date?pr.date.slice(5).replace('-','/'):'';
        h+='<div style="display:flex;align-items:center;padding:9px 10px;background:var(--surface2);border-radius:8px;gap:10px">';
        h+='<div style="font-size:16px;width:22px;text-align:center;flex-shrink:0">'+(medal||'<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;color:var(--muted)">'+(i+1)+'</span>')+'</div>';
        h+='<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+pr.name+'</div>';
        h+='<div style="font-size:11px;color:var(--muted)">Best set · '+dateStr+'</div></div>';
        h+='<div style="text-align:right;flex-shrink:0">';
        h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:18px;font-weight:800;color:var(--morning)">'+pr.w+'<span style="font-size:11px;font-weight:400"> kg</span></div>';
        h+='<div style="font-size:11px;color:var(--muted)">'+pr.reps+' reps</div></div>';
        h+='</div>';
      });
      h+='</div>';
      if(boards.length>10){
        h+='<div style="font-size:11px;color:var(--muted);text-align:center;margin-top:10px">Showing top 10 of '+boards.length+' exercises</div>';
      }
    }
  })();
  h+='</div>';

  // Settings
  h+='<div class="sec-title">Settings</div>';
  var curFont=localStorage.getItem('ppl_font')||'m';
  var curTheme=localStorage.getItem('ppl_theme')||'dark';
  h+='<div class="settings-box">';
  h+='<div class="settings-row"><span class="settings-lbl">Theme</span>';
  h+='<div class="sz-btns"><button class="sz-btn'+(curTheme==='dark'?' active':'')+'" onclick="setTheme(\'dark\')">Dark</button>';
  h+='<button class="sz-btn'+(curTheme==='light'?' active':'')+'" onclick="setTheme(\'light\')">Light</button></div></div>';
  h+='<div class="settings-row"><span class="settings-lbl">Font Size</span>';
  h+='<div class="sz-btns"><button class="sz-btn'+(curFont==='s'?' active':'')+'" onclick="setFontSize(\'s\')">S</button>';
  h+='<button class="sz-btn'+(curFont==='m'?' active':'')+'" onclick="setFontSize(\'m\')">M</button>';
  h+='<button class="sz-btn'+(curFont==='l'?' active':'')+'" onclick="setFontSize(\'l\')">L</button></div></div>';
  h+='</div>';

  // Milestone strip at top
  var ms2=getMilestoneStats();
  var earnedCount=MILESTONES.filter(function(m){return m.fn(ms2);}).length;
  h+='<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 20px 6px">';
  h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted)">Milestones</div>';
  h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:12px;color:var(--morning)">'+earnedCount+'/'+MILESTONES.length+' earned</div>';
  h+='</div>';
  h+='<div style="display:flex;gap:6px;padding:0 20px 10px;overflow-x:auto;scrollbar-width:none">';
  MILESTONES.forEach(function(m){
    var earned=m.fn(ms2);
    var borderCol=earned?'color-mix(in srgb,#facc15 50%,transparent)':'var(--border)';
    h+='<div style="flex-shrink:0;width:72px;padding:10px 6px;background:var(--surface);border:1px solid '+borderCol+';border-radius:10px;text-align:center;opacity:'+(earned?1:.3)+'">';
    h+='<div style="font-size:20px;margin-bottom:4px">'+m.icon+'</div>';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;color:var(--text);line-height:1.3">'+m.name+'</div>';
    h+='</div>';
  });
  h+='</div>';
  // ── Best Week Ever
  var bw=getBestWeek();
  if(bw){
    h+='<div class="sec-title">Best Week Ever 🏆</div>';
    h+='<div class="best-week-card">';
    h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:var(--morning)">'+bw.label+'</div>';
    h+='<div style="display:flex;gap:20px;margin-top:8px">';
    h+='<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:26px;font-weight:800;color:var(--morning)">'+Math.round(bw.vol/1000*10)/10+'k</div><div style="font-size:11px;color:var(--muted)">kg Volume</div></div>';
    h+='<div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:26px;font-weight:800;color:var(--morning)">'+bw.days+'</div><div style="font-size:11px;color:var(--muted)">Days Done</div></div>';
    h+='</div></div>';
  }

  // ── Plateau Detector
  var plateaus=getPlateaus();
  h+='<div class="sec-title">Plateau Detector '+(plateaus.length?'⚠️ '+plateaus.length+' found':'✅ All good')+'</div>';
  h+='<div class="anl-card">';
  if(plateaus.length){
    plateaus.forEach(function(p){
      h+='<div class="plateau-item"><span>'+p.name+'</span>';
      h+='<span class="plateau-badge">'+p.weight+'kg × '+p.sessions+' sessions</span></div>';
    });
  } else {
    h+='<div class="no-data">No plateaus detected in your last 3 sessions per exercise. Keep pushing!</div>';
  }
  h+='</div>';

  // ── Band Tracker
  var bandData=getBandProgressData();
  var bandSuggestions=bandData.filter(function(b){return b.suggestion;}).length;
  h+='<div class="sec-title">Band Tracker '+(bandSuggestions?'⬆️ '+bandSuggestions+' ready to progress':'')+'</div>';
  h+='<div class="anl-card">';
  if(!bandData.length){
    h+='<div class="no-data">Log band exercises with a band selected to start tracking.</div>';
  } else {
    h+='<div style="display:flex;flex-direction:column;gap:8px">';
    var BAND_COLORS={Yellow:'#facc15',Red:'#ef4444',Green:'#22c55e',Blue:'#38bdf8',Black:'#a1a1aa'};
    bandData.forEach(function(b){
      var col=BAND_COLORS[b.current]||'var(--muted)';
      var histDots=b.history.map(function(entry){
        var c=BAND_COLORS[{yellow:'Yellow',red:'Red',green:'Green',blue:'Blue',black:'Black'}[entry.highest]]||'var(--muted)';
        return '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+c+';opacity:.7"></span>';
      }).join('');
      h+='<div style="padding:10px;background:var(--surface2);border-radius:8px'+(b.suggestion?';border-left:3px solid var(--success)':'')+'">';
      h+='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">';
      h+='<div style="font-size:13px;font-weight:600">'+b.name+'</div>';
      h+='<div style="display:flex;align-items:center;gap:6px">';
      h+='<span style="width:10px;height:10px;border-radius:50%;background:'+col+';display:inline-block"></span>';
      h+='<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:'+col+'">'+b.current+'</span>';
      h+='</div></div>';
      h+='<div style="display:flex;align-items:center;justify-content:space-between">';
      h+='<div style="display:flex;align-items:center;gap:4px">'+histDots+'<span style="font-size:11px;color:var(--muted);margin-left:4px">'+b.sessions+' sessions</span></div>';
      if(b.suggestion)h+='<div style="font-size:11px;color:var(--success);font-weight:600">Try '+b.suggestion+' ↑</div>';
      h+='</div></div>';
    });
    h+='</div>';
    h+='<div style="font-size:11px;color:var(--muted);margin-top:10px;text-align:center">Dots show last 6 sessions · Suggestion after 3 sessions same band</div>';
  }
  h+='</div>';

  // ── 1RM Calculator
  h+='<div class="sec-title">Estimated 1RM</div>';
  h+='<div class="anl-card">';
  h+='<select class="ex-sel" style="margin:0;width:100%" id="rmSel" onchange="render1RM()">';
  h+='<option value="">— Select exercise —</option>';
  ALL_EX.filter(function(e){return e.type==='weighted';}).forEach(function(ex){
    h+='<option value="'+ex.id+'">'+ex.name+'</option>';
  });
  h+='</select>';
  h+='<div id="rmResult"></div>';
  h+='</div>';

  // ── Muscle Group Frequency (4-week avg)
  var mfreq=getMuscle4WeekFreq();
  var mfkeys=Object.keys(mfreq).sort(function(a,b){return mfreq[b].sets-mfreq[a].sets;});
  h+='<div class="sec-title">Muscle Frequency (4-week avg)</div>';
  h+='<div class="anl-card">';
  if(mfkeys.length){
    var maxSets=mfreq[mfkeys[0]].setsPerWeek||1;
    mfkeys.slice(0,12).forEach(function(k){
      var pct=Math.round(mfreq[k].setsPerWeek/maxSets*100);
      var col=mfreq[k].setsPerWeek>=10?'var(--success)':mfreq[k].setsPerWeek>=6?'var(--morning)':'var(--danger)';
      h+='<div class="mvol-row"><div class="mvol-name">'+mfreq[k].name+'<span style="color:var(--muted);font-weight:400"> · hit '+mfreq[k].sessions+'x</span></div>';
      h+='<div class="mvol-bg"><div class="mvol-fill" style="width:'+pct+'%;background:'+col+'"></div></div>';
      h+='<div class="mvol-num">'+mfreq[k].setsPerWeek+'</div></div>';
    });
    h+='<div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center">Goal: 10-20 sets/week per muscle group</div>';
  } else {h+='<div class="no-data">Log 4 weeks of sessions to see frequency data</div>';}
  h+='</div>';

  // ── Missed Day Breakdown
  var reasonLabels={'sick':'🤒 Sick','travel':'✈️ Travel','rest_swap':'😴 Rest Swap','life':'🙃 Life Happened'};
  var reasonCounts={};var totalMissed=0;var untagged=0;
  Object.entries(data.logs).forEach(function(e){
    var key=e[0],log=e[1];
    var d2=new Date(key+'T00:00:00');
    if(d2>t)return;
    var st=dayStatus(key,d2);
    if(st==='missed'){
      totalMissed++;
      if(log.reason&&reasonLabels[log.reason])reasonCounts[log.reason]=(reasonCounts[log.reason]||0)+1;
      else untagged++;
    }
  });
  h+='<div class="sec-title">Missed Days '+(totalMissed?'('+totalMissed+' total)':'')+'</div>';
  h+='<div class="anl-card">';
  if(!totalMissed){
    h+='<div class="no-data">No missed training days. Keep it up!</div>';
  } else {
    Object.entries(reasonLabels).forEach(function(e){
      var count=reasonCounts[e[0]]||0;
      var pct=Math.round(count/totalMissed*100);
      h+='<div class="mvol-row"><div class="mvol-name">'+e[1]+'</div>';
      h+='<div class="mvol-bg"><div class="mvol-fill" style="width:'+pct+'%;background:var(--danger)"></div></div>';
      h+='<div class="mvol-num">'+count+'</div></div>';
    });
    if(untagged)h+='<div style="font-size:11px;color:var(--muted);margin-top:8px;text-align:center">'+untagged+' missed day'+(untagged!==1?'s':'')+' with no reason tagged</div>';
  }
  h+='</div>';

  // ── Before/After Comparison
  h+='<div class="sec-title">Before / After Comparison</div>';
  h+='<div class="anl-card">';
  h+='<div class="date-row">';
  h+='<input class="date-inp" type="date" id="baDate1" placeholder="Before"><input class="date-inp" type="date" id="baDate2" placeholder="After">';
  h+='<button class="compare-btn" onclick="renderBA()">Compare</button>';
  h+='</div>';
  h+='<div id="baResult"></div>';
  h+='</div>';

  // ── Custom Exercise Library
  h+='<div class="sec-title">Custom Exercise Library</div>';
  var custEx=loadCustomExercises();
  h+='<div class="anl-card">';
  if(custEx.length){
    h+='<ul class="custom-ex-list">';
    custEx.forEach(function(ex,i){
      h+='<li class="custom-ex-item"><div><div style="font-size:13px;font-weight:600">'+ex.name+'</div>';
      h+='<div style="font-size:11px;color:var(--muted)">'+ex.day.toUpperCase()+' · '+ex.type+' · '+ex.target+'</div></div>';
      h+='<button class="del-btn" onclick="deleteCustomEx('+i+')">Remove</button></li>';
    });
    h+='</ul>';
  } else {
    h+='<div class="no-data" style="padding:10px 0">No custom exercises yet.</div>';
  }
  h+='<div class="add-ex-form" id="addExForm">';
  h+='<input class="form-inp" id="cexName" placeholder="Exercise name">';
  h+='<select class="form-sel" id="cexDay"><option value="morning">Morning</option><option value="d1">Day 1 — Upper + Core</option><option value="d2">Day 2 — Lower</option><option value="d3">Day 3 — Push + Core</option><option value="d4">Day 4 — Pull</option><option value="d5">Day 5 — Legs</option></select>';
  h+='<select class="form-sel" id="cexType"><option value="weighted">Weighted (reps + kg)</option><option value="reps">Reps only</option><option value="time">Timed</option><option value="bands">Resistance Bands</option></select>';
  h+='<input class="form-inp" id="cexTarget" placeholder="Target (e.g. 3x12)">';
  h+='<input class="form-inp" id="cexMuscPrimary" placeholder="Primary muscle (optional, e.g. Chest)">';
  h+='<input class="form-inp" id="cexMuscSecondary" placeholder="Secondary muscle (optional)">';
  h+='<button class="save-btn" style="margin:0" onclick="addCustomEx()">+ Add Exercise</button>';
  h+='</div></div>';
  } // end if(total>0)
  if(!total){
    h+='<div class="empty-state"><div class="empty-icon">📊</div>';
    h+='<div class="empty-title">No Data Yet</div>';
    h+='<div class="empty-desc">Start logging sessions to see your streaks, volume charts, plateau detection, 1RM estimates and more.</div>';
    h+='<button class="empty-btn" onclick="go(\'today\',document.querySelectorAll(\'.nbtn\')[0])">Log First Session</button></div>';
  }
  h+='<div class="sec-title">Settings</div>';
  h+='<div class="anl-card">';
  h+='<div style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">YouTube API Key</div>';
  h+='<input type="password" id="ytKeyInp" value="'+(localStorage.getItem('pt_yt_key')||'')+'" placeholder="Paste your YouTube Data API v3 key..." style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px;outline:none;margin-bottom:8px">';
  h+='<button class="save-btn" style="margin:0;width:100%" onclick="var k=document.getElementById(\'ytKeyInp\').value.trim();localStorage.setItem(\'pt_yt_key\',k);showToast(k?\'API key saved.\':\'API key cleared.\',\'var(--success)\')">Save Key</button>';
  h+='<div style="font-size:11px;color:var(--muted);margin-top:8px">Used for video guides in exercise info panels. Never shared or sent anywhere except YouTube\'s API.</div>';
  h+='</div>';
  h+='<div class="sec-title">Data</div>';
  h+='<div style="padding:0 20px 6px;display:flex;align-items:center;justify-content:space-between">';
  h+='<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:11px;letter-spacing:2px;color:var(--muted);text-transform:uppercase">ProTrain Program <span style="color:var(--morning)">v8</span></span>';
  h+='<button onclick="toggleChangelog()" style="font-size:11px;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;font-family:\'Barlow Condensed\',sans-serif;letter-spacing:1px">📋 '+(changelogOpen?'Hide':'What&#39;s New')+'</button>';
  h+='</div>';
  if(changelogOpen)h+=renderChangelog();
  h+='<div style="display:flex;gap:10px;padding:0 20px">';
  h+='<button onclick="exportData()" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">&#11014; Export</button>';
  h+='<button onclick="document.getElementById(\'importFile\').click()" style="flex:1;padding:12px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">&#11015; Import</button>';
  h+='</div>';
  h+='<input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(event)">';
  h+='<div id="dataMsg" style="text-align:center;font-size:12px;color:var(--muted);padding:10px 20px 0;min-height:24px"></div>';
  h+='<div style="padding:0 20px;margin-top:6px">';
  h+='<button onclick="clearAllData()" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--danger);background:transparent;color:var(--danger);font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;letter-spacing:1px;text-transform:uppercase;cursor:pointer">🗑 Start Fresh — Clear All Data</button>';
  h+='</div>';
  h+='<div style="padding:4px 20px 10px;font-size:11px;color:var(--muted);text-align:center">This clears all logs, streaks, and PRs. Export first if you want a backup.</div>';
  document.getElementById('sc-prog').innerHTML=h;
}
function rExChart(){
  var id=document.getElementById('exSel');
  if(!id)return;
  var exId=id.value;
  var wrap=document.getElementById('exChart');
  if(!wrap)return;
  if(!exId){wrap.innerHTML='';return;}
  var ex=ALL_EX.find(function(e){return e.id===exId;});
  var isMorn=exId.startsWith('m_');
  var data=load();
  // For legacy exercises not in ALL_EX, derive name from stored log data
  var exName=ex?ex.name:null;
  if(!exName){
    Object.values(data.logs).some(function(log){
      var src=isMorn?log.morning:log.ppl;
      if(src&&src.exercises&&src.exercises[exId]&&src.exercises[exId].name){
        exName=src.exercises[exId].name;return true;
      }
    });
    if(!exName){wrap.innerHTML='';return;}
  }
  var sessions=[];
  Object.entries(data.logs).sort().forEach(function(entry){
    var key=entry[0],log=entry[1];
    var src=isMorn?log.morning:log.ppl;
    if(!src||!src.exercises||!src.exercises[exId]||!src.exercises[exId].sets||!src.exercises[exId].sets.length)return;
    var val=0,unit='';
    src.exercises[exId].sets.forEach(function(s){
      if(s.time!=null&&s.time!==''){val=Math.max(val,+s.time);unit='sec';}
      else if(s.weight!=null&&s.weight!==''){val=Math.max(val,+s.weight);unit='kg';}
      else if(s.reps!=null&&s.reps!==''){val=Math.max(val,+s.reps);unit='reps';}
    });
    if(val>0)sessions.push({date:key,val:val,unit:unit});
  });
  if(!sessions.length){
    wrap.innerHTML='<div class="ex-chart"><div class="no-data">No data logged yet for this exercise.<br>Start logging to see your progress here!</div></div>';
    return;
  }
  var recent=sessions.slice(-10);
  var maxV=Math.max.apply(null,recent.map(function(s){return s.val;}));
  var h='<div class="ex-chart"><div class="ex-chart-title">'+exName+' · '+(recent[0]?recent[0].unit:'')+'</div><div class="xbars">';
  recent.forEach(function(s){
    var bh=maxV>0?Math.max(s.val/maxV*70,4):4;
    h+='<div class="xbc"><div class="xval">'+s.val+'</div><div class="xbar" style="height:'+bh+'px;background:var(--pull)"></div><div class="xdate">'+s.date.slice(5)+'</div></div>';
  });
  h+='</div></div>';
  wrap.innerHTML=h;
}

