// ── ALT-FORKED TRACKING HELPERS ─────────────────────────────────
// Every alt now has its own stable id, tracked separately from its base exercise.
function _cloneSubs(from,to){return SUBS[from].map(function(a){return Object.assign({},a,{id:a.id.replace(from,to)});});}
SUBS.d1_dlr=_cloneSubs('d3_dlr','d1_dlr');
SUBS.d1_brf=_cloneSubs('d4_brf','d1_brf');
function _addSub(to,fromKey,name,newId){var src=SUBS[fromKey].find(function(a){return a.name===name;});if(src&&!SUBS[to].some(function(a){return a.id===newId;}))SUBS[to].push(Object.assign({},src,{id:newId}));}
_addSub('d1_dsp','d1_fep','Pike Push-ups','d1_dsp_alt6');
_addSub('d3_dsp','d1_fep','Pike Push-ups','d3_dsp_alt6');
_addSub('d4_blp','d1_pul','Doorframe/Table Rows','d4_blp_alt6');
SUBS.d4_shr=[
  {id:'d4_shr_alt1',name:'Band Shrugs',type:'reps',isBand:true,muscles:{primary:'Traps',secondary:'Forearms'},steps:['Stand on the band, one end in each hand.','Shrug your shoulders straight up.','Hold briefly, then lower slowly.'],tip:'Constant band tension. Use the Blue band for meaningful resistance.'},
  {id:'d4_shr_alt2',name:'Single-Arm DB Shrug',type:'weighted',muscles:{primary:'Traps',secondary:'Forearms'},steps:['Hold one DB at your side, other hand on your hip.','Shrug straight up and hold 1 second.','Lower slowly. Complete all reps, then switch.'],tip:'Lets you go heavier per side without grip on both hands failing first.'},
  {id:'d4_shr_alt3',name:'Scapular Push-up Shrugs',type:'reps',muscles:{primary:'Traps',secondary:'Serratus'},steps:['Start in a push-up position, arms locked straight.','Let your chest sink between your shoulder blades.','Push the floor away and round your upper back up.'],tip:'Bodyweight option for travel days. Elbows stay locked; the movement is only at the shoulder blades.'},
  {id:'d4_shr_alt4',name:'Behind-Back DB Shrug',type:'weighted',muscles:{primary:'Traps',secondary:'Forearms'},steps:['Hold DBs behind your thighs, palms facing back.','Shrug straight up, hold 1 second.','Lower slowly.'],tip:'Slightly different line of pull than front-held shrugs.'}
];
// EX_ALT_MAP lets any id (base or alt) look up its full family, for muscle-frequency enumeration.
var EX_ALT_MAP={};
Object.keys(SUBS).forEach(function(baseId){
  var family=[baseId].concat(SUBS[baseId].map(function(a){return a.id;}));
  family.forEach(function(id){EX_ALT_MAP[id]=family;});
});
function resolveExById(id){
  var base=ALL_EX.find(function(x){return x.id===id;});
  if(base)return base;
  for(var k in SUBS){
    var found=SUBS[k].find(function(a){return a.id===id;});
    if(found){
      var baseEx=ALL_EX.find(function(x){return x.id===k;})||{};
      return Object.assign({},found,{isAlt:true,baseId:k,type:found.type||baseEx.type});
    }
  }
  return null;
}
function getActiveId(baseExId){
  var swap=getSwappedExercise(baseExId);
  return swap&&swap.id?swap.id:baseExId;
}

var DAYS_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
var DAYS_FULL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// Storage
function esc(t){return String(t).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function migrateIds(o){
  var olds=Object.keys(ID_ALIASES);if(!olds.length)return;
  Object.keys(o.logs).forEach(function(k){
    var L=o.logs[k];
    ['ppl','morning'].forEach(function(t){
      var ex=L&&L[t]&&L[t].exercises;if(!ex)return;
      olds.forEach(function(old){if(ex[old]&&!ex[ID_ALIASES[old]]){ex[ID_ALIASES[old]]=ex[old];delete ex[old];}});
    });
  });
}
var _ldRaw=null,_ldObj=null;
function load(){
  var raw=null;
  try{raw=localStorage.getItem('ppl_v4');}catch(e){}
  if(_ldObj&&raw===_ldRaw)return _ldObj; // unchanged since last parse: skip re-parsing
  var o;
  try{o=JSON.parse(raw||'{"logs":{}}');}catch(e){o=null;}
  if(!o||typeof o!=='object')o={logs:{}};
  if(!o.logs||typeof o.logs!=='object')o.logs={};
  migrateIds(o);
  _ldRaw=raw;_ldObj=o;return o;
}
function save(d){var str=JSON.stringify(d);localStorage.setItem('ppl_v4',str);_ldRaw=str;_ldObj=d;}
function todayCheckKey(){return 'ppl_checks_'+toKey(new Date());}
// ── CYCLING COMMUTE TRACKER ──────────────────────────────────
function loadCycling(key){
  var log=load().logs[key];
  return (log&&log.cycling)||{morning:{done:false,km:'',min:''},afternoon:{done:false,km:'',min:''},extra:[]};
}
function toggleCyclingLeg(key,leg){
  var data=load();
  if(!data.logs[key])data.logs[key]={};
  if(!data.logs[key].cycling)data.logs[key].cycling={morning:{done:false,km:'',min:''},afternoon:{done:false,km:'',min:''},extra:[]};
  data.logs[key].cycling[leg].done=!data.logs[key].cycling[leg].done;
  save(data);
  render(curScreen);
}
function updCyclingField(key,leg,field,val){
  var data=load();
  if(!data.logs[key])data.logs[key]={};
  if(!data.logs[key].cycling)data.logs[key].cycling={morning:{done:false,km:'',min:''},afternoon:{done:false,km:'',min:''},extra:[]};
  data.logs[key].cycling[leg][field]=val===''?'':parseFloat(val);
  save(data);
}
function addCyclingExtra(key){
  var data=load();
  if(!data.logs[key])data.logs[key]={};
  if(!data.logs[key].cycling)data.logs[key].cycling={morning:{done:false,km:'',min:''},afternoon:{done:false,km:'',min:''},extra:[]};
  if(!data.logs[key].cycling.extra)data.logs[key].cycling.extra=[];
  data.logs[key].cycling.extra.push({km:'',min:''});
  save(data);
  render(curScreen);
}
function updCyclingExtra(key,idx,field,val){
  var data=load();
  if(!data.logs[key]||!data.logs[key].cycling||!data.logs[key].cycling.extra)return;
  data.logs[key].cycling.extra[idx][field]=val===''?'':parseFloat(val);
  save(data);
}
function removeCyclingExtra(key,idx){
  var data=load();
  if(!data.logs[key]||!data.logs[key].cycling||!data.logs[key].cycling.extra)return;
  data.logs[key].cycling.extra.splice(idx,1);
  save(data);
  render(curScreen);
}
function renderCyclingCard(key){
  var cyc=loadCycling(key);
  var h='<div class="cyc-card"><div class="cyc-hdr">🚴 Cycling</div>';
  [['morning','Morning commute'],['afternoon','Afternoon commute']].forEach(function(pair){
    var leg=pair[0],label=pair[1],data=cyc[leg];
    h+='<div class="cyc-leg">';
    h+='<div class="cyc-leg-lbl">'+label+'</div>';
    if(data.done){
      h+='<div class="cyc-fields">';
      h+='<input type="number" inputmode="decimal" placeholder="km" value="'+(data.km||'')+'" onchange="updCyclingField(\''+key+'\',\''+leg+'\',\'km\',this.value)">';
      h+='<input type="number" inputmode="numeric" placeholder="min" value="'+(data.min||'')+'" onchange="updCyclingField(\''+key+'\',\''+leg+'\',\'min\',this.value)">';
      h+='</div>';
    }
    h+='<button class="cyc-toggle'+(data.done?' on':'')+'" onclick="toggleCyclingLeg(\''+key+'\',\''+leg+'\')"></button>';
    h+='</div>';
  });
  (cyc.extra||[]).forEach(function(ex,idx){
    h+='<div class="cyc-leg"><div class="cyc-leg-lbl">🎉 Extra ride</div>';
    h+='<div class="cyc-fields">';
    h+='<input type="number" inputmode="decimal" placeholder="km" value="'+(ex.km||'')+'" onchange="updCyclingExtra(\''+key+'\','+idx+',\'km\',this.value)">';
    h+='<input type="number" inputmode="numeric" placeholder="min" value="'+(ex.min||'')+'" onchange="updCyclingExtra(\''+key+'\','+idx+',\'min\',this.value)">';
    h+='</div>';
    h+='<button class="cyc-remove-btn" onclick="removeCyclingExtra(\''+key+'\','+idx+')">✕</button>';
    h+='</div>';
  });
  h+='<button class="cyc-add-btn" onclick="addCyclingExtra(\''+key+'\')">+ Add a ride (just for fun)</button>';
  h+='</div>';
  return h;
}
function getCyclingWeekStats(weekStart){
  var t=now(),ws=weekStart||getMondayOf(t),done=0,total=0,km=0;
  for(var i=0;i<7;i++){
    var d=new Date(ws);d.setDate(ws.getDate()+i);
    if(d>t)break;
    var cyc=loadCycling(toKey(d));
    ['morning','afternoon'].forEach(function(leg){
      total++;
      if(cyc[leg].done){done++;if(cyc[leg].km)km+=+cyc[leg].km;}
    });
    (cyc.extra||[]).forEach(function(ex){done++;total++;if(ex.km)km+=+ex.km;});
  }
  return {done:done,total:total,km:Math.round(km*10)/10};
}
function loadChecks(){try{return JSON.parse(localStorage.getItem(todayCheckKey())||'{}')}catch(e){return{}}}
function saveChecks(c){
  Object.keys(localStorage).forEach(function(k){
    if(k.startsWith('ppl_checks_')&&k!==todayCheckKey())localStorage.removeItem(k);
  });
  localStorage.setItem(todayCheckKey(),JSON.stringify(c));
}

// Date helpers
var now=function(){return new Date()};
var toKey=function(d){var y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return y+'-'+m+'-'+day;};
var isRest=function(d){return getScheduleFor(d)[d.getDay()]===null};
var pplDay=function(d){return getScheduleFor(d)[d.getDay()]};
var fmtShort=function(d){return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})};
var fmtLong=function(d){return d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})};

function getMondayOf(d){
  var t=new Date(d);t.setHours(0,0,0,0);
  var dow=t.getDay();
  t.setDate(t.getDate()+(dow===0?-6:1-dow));
  return t;
}
function getWeekDays(d){
  var m=getMondayOf(d);
  return Array.from({length:7},function(_,i){var x=new Date(m);x.setDate(m.getDate()+i);return x});
}

// Streak & status
function dayComplete(key,date){
  if(isRest(date))return true;
  var log=load().logs[key];
  if(!log)return false;
  // The workout is what keeps a streak alive; the morning routine is tracked separately
  return !!log.ppl&&!!log.ppl.done;
}
function dayStatus(key,date){
  var log=load().logs[key];
  if(!log)return'none';
  var rest=isRest(date);
  if(rest){
    if(!log.morning)return'rest-miss';
    if(log.morning.done)return'rest-done';
    return'rest-partial';
  }
  var mDone=!!(log.morning&&log.morning.done);
  var pDone=!!(log.ppl&&log.ppl.done);
  var mHas=!!(log.morning&&log.morning.exercises&&Object.keys(log.morning.exercises).length);
  var pHas=!!(log.ppl&&log.ppl.exercises&&Object.keys(log.ppl.exercises).length);
  if(mDone&&pDone)return'full';
  if(mDone||pDone)return'partial';
  if(mHas||pHas)return'incomplete';
  return'missed';
}
function calcStreak(){
  var d=new Date();d.setHours(0,0,0,0);
  if(!dayComplete(toKey(d),d))d.setDate(d.getDate()-1);
  var s=0;
  for(var i=0;i<365;i++){if(dayComplete(toKey(d),d))s++;else break;d.setDate(d.getDate()-1);}
  var prev=parseInt(localStorage.getItem('ppl_best4')||'0');
  var best=Math.max(prev,s);
  if(s>prev)localStorage.setItem('ppl_best4',best);
  return{streak:s,best:best};
}

