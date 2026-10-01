// ── PR & PROGRESSION ──────────────────────────────────────────
// ── AWAY MODE ──────────────────────────────────────────────────
// Maps each swappable exercise to its designated bodyweight-only alt (by name).
// Exercises not listed here are already bodyweight (Feet-Elevated Push-ups, Plank, Dead Bug, Diamond Push-ups, Side Plank).
var AWAY_MAP={
  d1_csr:'Inverted Row', d1_dsp:'Pike Push-ups', d1_bcf:'Wide Push-ups', d1_ezc:'Doorframe Isometric Curl', d1_ote:'Diamond Push-ups', d1_brt:'Bicycle Crunches',
  d2_gbs:'Pulse Squats', d2_rdl:'Single-Leg Bodyweight RDL', d2_bss:'Curtsy Lunges', d2_hpt:'Marching Glute Bridge', d2_dcr:'Single-Leg Calf Raise',
  d3_dff:'Wide Push-ups', d3_dsp:'Pike Push-ups', d3_dlr:'Pike Push-ups', d3_dsc:'Diamond Push-ups', d3_btp:'Diamond Push-ups',
  d4_sar:'Inverted Row', d4_blp:'Doorframe/Table Rows', d4_brf:'Prone Y-T-W Raises', d4_dhc:'Doorframe Isometric Curl', d4_bfp:'Wall Slides',
  d1_dlr:'Pike Push-ups', d1_brf:'Prone Y-T-W Raises', d4_shr:'Scapular Push-up Shrugs',
  d5_dss:'Pulse Squats', d5_slr:'Single-Leg Bodyweight RDL', d5_drl:'Walking Lunges'
};
function isAwayModeActive(pd){
  var list=(EX[pd]||[]).filter(function(ex){return AWAY_MAP[ex.id]&&SUBS[ex.id]&&SUBS[ex.id].some(function(a){return a.name===AWAY_MAP[ex.id];});});
  if(!list.length)return false;
  return list.every(function(ex){
    var swap=getSwappedExercise(ex.id);
    return swap&&swap.name===AWAY_MAP[ex.id];
  });
}
function toggleAwayMode(pd){
  var list=(EX[pd]||[]).filter(function(ex){return AWAY_MAP[ex.id]&&SUBS[ex.id]&&SUBS[ex.id].some(function(a){return a.name===AWAY_MAP[ex.id];});});
  if(!list.length){showToast('No away-swappable exercises for this day.','var(--muted)');return;}
  var active=isAwayModeActive(pd);
  list.forEach(function(ex){
    if(active){
      _resetSwapCore(ex.id);
    } else {
      var target=SUBS[ex.id].find(function(a){return a.name===AWAY_MAP[ex.id];});
      if(target)_swapCore(ex.id,target);
    }
  });
  refreshSubContext();
  showToast(active?'Away Mode off — back to your normal exercises':'✈️ Away Mode on — bodyweight swaps applied','var(--legs)');
}

function groupIdsFor(exId){
  var info=resolveExById(exId);
  if(!info)return [exId];
  var name=info.name;
  var ids=[];
  ALL_EX.forEach(function(ex){if(ex.name===name)ids.push(ex.id);});
  Object.keys(SUBS).forEach(function(baseId){
    SUBS[baseId].forEach(function(alt){if(alt.name===name)ids.push(alt.id);});
  });
  return ids.length?ids:[exId];
}
function getBest(exId){
  var best={reps:0,weight:0,time:0};
  var isMorn=exId.startsWith('m_');
  var ids=groupIdsFor(exId);
  Object.values(load().logs).forEach(function(log){
    var src=isMorn?log.morning:log.ppl;
    if(!src||!src.exercises)return;
    ids.forEach(function(gid){
      if(!src.exercises[gid])return;
      src.exercises[gid].sets.forEach(function(s){
        if(s.weight&&+s.weight>best.weight)best.weight=+s.weight;
        if(s.reps&&+s.reps>best.reps)best.reps=+s.reps;
        if(s.time&&+s.time>best.time)best.time=+s.time;
      });
    });
  });
  return best;
}
function bestLabel(exId,ex){
  var b=getBest(exId);
  if(ex.type==='time'&&b.time>0)return 'Best: '+b.time+'s';
  if(ex.type==='weighted'&&b.weight>0)return 'Best: '+b.reps+'r x '+b.weight+'kg';
  if(ex.loadable&&b.weight>0)return 'Best: +'+b.weight+'kg';
  if(b.reps>0)return 'Best: '+b.reps+' reps';
  return null;
}
// PR metric per exercise type: weighted = estimated 1RM, reps = reps, time = seconds
function prMetric(type,st){
  if(type==='time')return +st.time||0;
  if(type==='weighted')return(+st.weight&&+st.reps)?(+st.weight)*(1+(+st.reps)/30):0;
  return(+st.weight||0)*1000+(+st.reps||0); // added load outranks reps
}
function checkNewPR(exId,sets){
  var info=resolveExById(exId),type=info&&info.type?info.type:'reps';
  var isMorn=exId.startsWith('m_'),ids=groupIdsFor(exId),best=0;
  Object.entries(load().logs).forEach(function(e){
    if(e[0]===mKey)return; // don't compare a session against its own earlier save
    var src=isMorn?e[1].morning:e[1].ppl;
    if(!src||!src.exercises)return;
    ids.forEach(function(gid){
      var ex=src.exercises[gid];if(!ex||!ex.sets)return;
      ex.sets.forEach(function(st){if(st.done)best=Math.max(best,prMetric(type,st));});
    });
  });
  if(best<=0)return false; // first time logged = baseline, not a PR
  return sets.some(function(st){return st.done&&prMetric(type,st)>best;});
}
// PR count is recomputed from the logs, so edits and deletions can't skew it
function computePRCount(){
  var bests={},count=0;
  Object.keys(load().logs).sort().forEach(function(k){
    var log=load().logs[k];
    ['morning','ppl'].forEach(function(t){
      var src=log[t];if(!src||!src.exercises)return;
      Object.keys(src.exercises).forEach(function(id){
        var ex=src.exercises[id];if(!ex||!ex.sets)return;
        var info=resolveExById(id);
        var type=info&&info.type?info.type:(ex.sets.some(function(x){return x.weight;})?'weighted':'reps');
        var name=(info&&info.name)||ex.name||id,m=0;
        ex.sets.forEach(function(x){if(x.done)m=Math.max(m,prMetric(type,x));});
        if(m<=0)return;
        if(bests[name]>0&&m>bests[name])count++;
        bests[name]=Math.max(bests[name]||0,m);
      });
    });
  });
  return count;
}
function getProgHint(exId,ex){
  if(ex.type!=='weighted')return null;
  if(isDeloadWeek())return null;
  var isMorn=exId.startsWith('m_');
  var ids=groupIdsFor(exId);
  var weights=[];
  Object.entries(load().logs).sort().forEach(function(e){
    var src=isMorn?e[1].morning:e[1].ppl;
    if(!src||!src.exercises)return;
    var maxW=0;
    ids.forEach(function(gid){
      if(!src.exercises[gid])return;
      src.exercises[gid].sets.forEach(function(s){if(s.weight)maxW=Math.max(maxW,+s.weight);});
    });
    if(maxW>0)weights.push(maxW);
  });
  if(weights.length>=2&&weights[weights.length-1]===weights[weights.length-2])
    return 'Same weight for 2 sessions — try adding 1-2kg!';
  return null;
}

// ── NEW HELPERS ───────────────────────────────────────────────
function isDeloadWeek(){
  var t=now(),cnt=0;
  for(var w=1;w<=4;w++){
    var ws=getMondayOf(t);ws.setDate(ws.getDate()-w*7);
    var done=0;
    for(var d=0;d<7;d++){var dt=new Date(ws);dt.setDate(ws.getDate()+d);if(dt>t)break;if(dayComplete(toKey(dt),dt))done++;}
    if(done>=4)cnt++;
  }
  // Week-based override: deload at weeks 5 and 10 of the 10-week cycle
  var info=getCycleWeekInfo(t);
  if(info)return info.type==='deload';
  return cnt>=4;
}
function getPullupBest(){
  // Pull-ups are trained Mon (d1_pul) and Fri (d4_pul) — getBest already groups these as one exercise
  return getBest('d1_pul').reps;
}
function getSetsForAbsoluteWeek(exId,isMorn,startDateStr,totalWeek){
  var sd=new Date(startDateStr+'T00:00:00');
  var ws=new Date(sd);ws.setDate(sd.getDate()+totalWeek*7);
  var we=new Date(ws);we.setDate(ws.getDate()+6);
  var found=null;
  Object.entries(load().logs).forEach(function(e){
    var dt=new Date(e[0]+'T00:00:00');
    if(dt<ws||dt>we)return;
    var src=isMorn?e[1].morning:e[1].ppl;
    if(src&&src.exercises&&src.exercises[exId]&&src.exercises[exId].sets)found=src.exercises[exId].sets;
  });
  return found;
}
function repRange(target){
  var m=String(target||'').match(/x\s*(\d+)(?:\s*-\s*(\d+))?/);
  if(!m)return{lo:10,hi:10};
  var lo=parseInt(m[1]),hi=m[2]?parseInt(m[2]):lo;
  return{lo:lo,hi:hi};
}
function emptySet(ex){return ex.type==='time'?{time:''}:(ex.type==='weighted'||ex.loadable)?{reps:'',weight:''}:{reps:''};}
function getCalib(id){return parseFloat(localStorage.getItem('pt_calib_'+id))||0;}
function calcCalibWeight(w,reps,target){var rr=repRange(target);return roundLoad(w*(1+reps/30)/(1+(rr.lo+2)/30));}
function calibrate(exId){
  var info=resolveExById(exId),baseId=info&&info.isAlt?info.baseId:exId;
  var base=ALL_EX.find(function(e){return e.id===baseId;});
  if(!base||!mState[exId])return;
  var raw=prompt('Pick a weight you can control and do as many clean reps as you can, stopping 1-2 short of failure.\n\nEnter it as weight x reps, e.g. 10x12');
  if(raw==null)return;
  var m=raw.match(/^\s*(\d+(?:\.\d+)?)\s*[x*\u00d7]\s*(\d+)\s*$/i);
  if(!m||+m[1]<=0||+m[2]<1||+m[2]>30){showToast('Use the format 10x12 (weight x reps)','var(--danger)');return;}
  var w=calcCalibWeight(+m[1],+m[2],base.target),lo=repRange(base.target).lo;
  localStorage.setItem('pt_calib_'+baseId,String(w));
  mState[exId].sets.forEach(function(st,si){
    st.weight=w;st.reps=lo;
    var ew=document.getElementById('inp_'+exId+'_'+si+'_weight'),er=document.getElementById('inp_'+exId+'_'+si+'_reps');
    if(ew)ew.value=w;if(er)er.value=lo;
  });
  showToast('Start at '+w+'kg for '+lo+' reps (about 2 reps left in the tank)','var(--success)');
}
function roundLoad(w){return Math.max(1,w<20?Math.round(w):Math.round(w/2.5)*2.5);}
function isDeloadDate(key){var i=getCycleWeekInfo(new Date(key+'T00:00:00'));return !!i&&i.type==='deload';}
function incFor(w){return w<10?1:(w<20?2:2.5);}
function getRec(exId,ex,mode){
  var isMorn=exId.startsWith('m_');
  var rr=repRange(ex.target||'1x10');
  var targetReps=rr.lo||10;
  var n=ex.sets||1;
  if(ex.type==='time') return Array.from({length:n},function(){return{time:targetReps,done:false};});
  var lw=!!ex.loadable;
  if(ex.type!=='weighted'&&!lw) return Array.from({length:n},function(){return{reps:targetReps,done:false};});
  var sessions=[];
  Object.entries(load().logs).sort().forEach(function(e){
    if(isDeloadDate(e[0]))return; // deload weights are not a baseline
    var src=isMorn?e[1].morning:e[1].ppl;
    if(src&&src.exercises&&src.exercises[exId]&&src.exercises[exId].sets)sessions.push(src.exercises[exId].sets);
  });
  var _inf=resolveExById(exId),_bid=_inf&&_inf.isAlt?_inf.baseId:exId;
  var sk=lw?0:(getCalib(_bid)||STARTER_KG[exId]||STARTER_KG[_bid]||STARTER_KG['_default']);
  if(mode==='starter'||!sessions.length)return Array.from({length:n},function(){return{reps:targetReps,weight:sk,done:false};});
  var last=sessions[sessions.length-1];
  var maxW=0,allHit=true;
  last.forEach(function(s){if(s.weight)maxW=Math.max(maxW,+s.weight);});
  var wk=getCycleWeekInfo(now());
  var need=(wk&&wk.type==='climb')?Math.max(rr.lo,rr.hi-1):rr.hi; // Climb: consolidation week already earned the load
  var minLast=999,rp=[];
  last.forEach(function(s){
    if(s.reps){minLast=Math.min(minLast,+s.reps);if(+s.reps<need)allHit=false;}
    if(s.rpe!==''&&s.rpe!=null&&+s.rpe>0)rp.push(+s.rpe);
  });
  var avgRpe=rp.length?rp.reduce(function(a,b){return a+b;},0)/rp.length:0;
  var step=incFor(maxW);
  if(avgRpe>=9.5)step=0;else if(avgRpe>0&&avgRpe<=6.5)step*=2; // maxed out: hold; very easy: bigger jump
  function nextW(base,hit){if(lw&&!base)return(hit&&step>0)?2:0;return hit&&base>0?base+step:(base||sk);}
  var nextReps=allHit?(step>0?rr.lo:rr.hi):Math.min(rr.hi,Math.max(rr.lo,(minLast===999?rr.lo:minLast+1)));
  if(mode==='last'){
    return Array.from({length:n},function(_,i){
      var s=last[i]||last[last.length-1];
      return{reps:+(s.reps||targetReps),weight:+(s.weight||maxW||sk),done:false};
    });
  }
  if(mode==='progress'){
    var pw=nextW(maxW,allHit);
    return Array.from({length:n},function(){return{reps:nextReps,weight:pw,done:false};});
  }
  if(mode==='deload'){
    var dw=(lw&&!maxW)?0:roundLoad((maxW||sk)*0.85);
    return Array.from({length:n},function(){return{reps:targetReps,weight:dw,done:false};});
  }
  // smart default
  var weekInfo=getCycleWeekInfo(now());
  if(weekInfo&&weekInfo.type==='repeat'&&weekInfo.sourceOffset){
    var srcSets=getSetsForAbsoluteWeek(exId,isMorn,weekInfo.startDate,weekInfo.totalWeek-weekInfo.sourceOffset);
    if(srcSets&&srcSets.length){
      return Array.from({length:n},function(_,i){
        var s=srcSets[i]||srcSets[srcSets.length-1];
        return{reps:+(s.reps||targetReps),weight:+(s.weight||sk),done:false};
      });
    }
  }
  if(weekInfo&&weekInfo.type==='build'&&weekInfo.cycleIdx===0&&weekInfo.cycleNum>=1){
    var climbSets=getSetsForAbsoluteWeek(exId,isMorn,weekInfo.startDate,weekInfo.totalWeek-2);
    if(climbSets&&climbSets.length){
      var climbMaxW=0;
      climbSets.forEach(function(s){if(s.weight)climbMaxW=Math.max(climbMaxW,+s.weight);});
      if(climbMaxW>0){
        var startW=Math.max(Math.round(climbMaxW*0.925/2.5)*2.5,2.5);
        return Array.from({length:n},function(){return{reps:targetReps,weight:startW,done:false};});
      }
    }
  }
  var sugW=isDeloadWeek()?((lw&&!maxW)?0:roundLoad((maxW||sk)*0.85)):nextW(maxW,allHit);
  return Array.from({length:n},function(){return{reps:nextReps,weight:sugW,done:false};});
}
function calcSessionVol(log,type){
  if(!log||!log[type]||!log[type].exercises)return 0;
  var v=0;
  Object.values(log[type].exercises).forEach(function(ex){
    if(ex.sets)ex.sets.forEach(function(s){if(s.done&&s.reps&&s.weight)v+=(+s.reps)*(+s.weight);});
  });
  return Math.round(v);
}
function calcConsistency(){
  var t=now(),scores=[];
  for(var w=0;w<4;w++){
    var ws=getMondayOf(t);ws.setDate(ws.getDate()-w*7);
    var done=0,tot=0;
    for(var d=0;d<7;d++){var dt=new Date(ws);dt.setDate(ws.getDate()+d);if(dt>t)break;tot++;if(dayComplete(toKey(dt),dt))done++;}
    if(tot>0)scores.push(Math.round(done/tot*100));
  }
  return scores.length?Math.round(scores.reduce(function(a,b){return a+b;},0)/scores.length):0;
}
function getMilestoneStats(){
  var data=load(),logs=data.logs;
  var sessions=0,mornings=0,totalVolume=0;
  Object.values(logs).forEach(function(log){
    if(log.ppl&&log.ppl.done)sessions++;
    if(log.morning&&log.morning.done)mornings++;
    totalVolume+=calcSessionVol(log,'morning')+calcSessionVol(log,'ppl');
  });
  var prs=computePRCount();
  var bestStreak=calcStreak().best;
  var consistWeeks=0,t=now();
  for(var w=1;w<=52;w++){
    var ws=getMondayOf(t);ws.setDate(ws.getDate()-w*7);
    var done=0;
    for(var d=0;d<7;d++){var dt=new Date(ws);dt.setDate(ws.getDate()+d);if(dt>t)break;if(dayComplete(toKey(dt),dt))done++;}
    if(done>=4)consistWeeks++;else break;
  }
  return{sessions:sessions,mornings:mornings,prs:prs,bestStreak:bestStreak,consistWeeks:consistWeeks,totalVolume:totalVolume};
}
// Normalise muscle labels ("Chest (Upper)" -> "Chest") and credit each muscle once per exercise:
// primary = 1 set, secondary = 0.5; if a muscle appears in both, it keeps the higher credit only.
function muscleCredits(m){
  var out={};
  [[m&&m.primary,1],[m&&m.secondary,0.5]].forEach(function(pair){
    var txt=pair[0],w=pair[1];
    if(!txt||txt==='\u2014')return;
    txt.split(',').forEach(function(part){
      var k=part.replace(/\s*\(.*?\)/g,'').trim();
      if(!k||k==='\u2014')return;
      if(!out[k]||out[k]<w)out[k]=w;
    });
  });
  return out;
}
function getMuscleWeeklySets(){
  var t=now(),result={},data=load();
  getWeekDays(t).forEach(function(day){
    var key=toKey(day),pd=pplDay(day),log=data.logs[key];
    if(!log||!pd||!log.ppl||!log.ppl.exercises)return;
    var _dayExList=EX[pd].concat(loadCustomExercises().filter(function(c){return c.day===pd;}));
    _dayExList.forEach(function(ex){
      var family=EX_ALT_MAP[ex.id]||[ex.id];
      family.forEach(function(fid){
        var exLog=log.ppl.exercises[fid];
        var done=exLog&&exLog.sets?exLog.sets.filter(function(s){return!!s.done;}).length:0;
        if(!done)return;
        var info=resolveExById(fid);
        if(!info||!info.muscles)return;
        var cr=muscleCredits(info.muscles);
        Object.keys(cr).forEach(function(mk){
          if(!result[mk])result[mk]={name:mk,sets:0};
          result[mk].sets+=done*cr[mk];
        });
      });
    });
  });
  return result;
}
