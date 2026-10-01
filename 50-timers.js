// ── REST TIMER ─────────────────────────────────────────────────
function parseRestSecs(restStr){
  if(!restStr)return 60;
  if(restStr.indexOf('3-5')>-1)return 240;
  if(restStr.indexOf('2-3')>-1)return 150;
  if(restStr.indexOf('60-90')>-1)return 75;
  var m=restStr.match(/(\d+)\s*min/);if(m)return parseInt(m[1])*60;
  var s=restStr.match(/(\d+)\s*sec/);if(s)return parseInt(s[1]);
  return 60;
}
function stopBeep(){
  if(beepAlarm){
    if(beepAlarm.timeout)clearTimeout(beepAlarm.timeout);
    try{beepAlarm.ctx.close();}catch(e){}
    beepAlarm=null;
  }
}
function playBeep(){
  stopBeep();
  try{
    var ctx=new(window.AudioContext||window.webkitAudioContext)();
    // Compressor: prevents clipping and pushes perceived loudness up
    var comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-3;
    comp.knee.value=2;
    comp.ratio.value=20;
    comp.attack.value=0;
    comp.release.value=0.05;
    comp.connect(ctx.destination);
    beepAlarm={ctx:ctx,timeout:null,count:0};
    var maxPulses=14; // ~7s at ~500ms per pulse
    var freqs=[1047,1319]; // alternating tones — higher freq cuts through better
    function pulse(){
      if(!beepAlarm||beepAlarm.count>=maxPulses){stopBeep();return;}
      var now=ctx.currentTime;
      var o=ctx.createOscillator();
      var g=ctx.createGain();
      o.type='square'; // square wave is far harsher / more audible than sine
      o.frequency.value=freqs[beepAlarm.count%2];
      o.connect(g);g.connect(comp);
      g.gain.setValueAtTime(0,now);
      g.gain.linearRampToValueAtTime(1.0,now+0.008); // sharp attack
      g.gain.setValueAtTime(1.0,now+0.14);
      g.gain.exponentialRampToValueAtTime(0.001,now+0.25); // quick fade
      o.start(now);o.stop(now+0.26);
      beepAlarm.count++;
      beepAlarm.timeout=setTimeout(pulse,480);
    }
    pulse();
  }catch(e){}
}
function fmtRestTime(s){
  var m=Math.floor(s/60);var r=s%60;
  return m>0?m+':'+(r<10?'0':'')+r:s+'s';
}
function updateRestDisplay(){
  var el=document.getElementById('restTimerFloat');
  if(!el)return;
  if(restRemaining>0&&restInterval){
    el.classList.add('active');
    var cd=document.getElementById('rtCountdown');
    if(cd)cd.textContent=fmtRestTime(restRemaining);
    // update the active rest button
    if(restExId!=null&&restSetIdx!=null){
      var btn=document.getElementById('restbtn_'+restExId+'_'+restSetIdx);
      if(btn)btn.textContent=fmtRestTime(restRemaining);
    }
  } else {
    el.classList.remove('active');
  }
}
function tickRest(){
  restRemaining=Math.max(0,Math.ceil((restEndTimestamp-Date.now())/1000));
  updateRestDisplay();
  if(restRemaining<=0){
    clearInterval(restInterval);restInterval=null;
    playBeep();
    if(navigator.vibrate)navigator.vibrate([400,100,400,100,400]);
    var btn=restExId!=null&&restSetIdx!=null?document.getElementById('restbtn_'+restExId+'_'+restSetIdx):null;
    if(btn){btn.classList.remove('active');btn.innerHTML='&#9203;';}
    var old=restExId;var oldsi=restSetIdx;
    restExId=null;restSetIdx=null;
    setTimeout(function(){
      var b2=document.getElementById('restbtn_'+old+'_'+oldsi);
      if(b2)b2.innerHTML='&#9203;';
      updateRestDisplay();
    },100);
  }
}
function startRestTimer(exId,setIdx,secs){
  if(restInterval){clearInterval(restInterval);restInterval=null;}
  // reset old button
  if(restExId!=null&&restSetIdx!=null){
    var oldBtn=document.getElementById('restbtn_'+restExId+'_'+restSetIdx);
    if(oldBtn){oldBtn.classList.remove('active');oldBtn.innerHTML='&#9203;';}
  }
  restExId=exId;restSetIdx=setIdx;restRemaining=secs;
  restEndTimestamp=Date.now()+secs*1000;
  if(navigator.vibrate)navigator.vibrate(200);
  scheduleRestNotification(restEndTimestamp);
  var btn=document.getElementById('restbtn_'+exId+'_'+setIdx);
  if(btn)btn.classList.add('active');
  updateRestDisplay();
  restInterval=setInterval(tickRest,1000);
}
function stopRestTimer(){
  if(restInterval){clearInterval(restInterval);restInterval=null;}
  stopBeep();
  cancelRestNotification();
  if(restExId!=null&&restSetIdx!=null){
    var btn=document.getElementById('restbtn_'+restExId+'_'+restSetIdx);
    if(btn){btn.classList.remove('active');btn.innerHTML='&#9203;';}
  }
  restExId=null;restSetIdx=null;restRemaining=0;
  updateRestDisplay();
}
function togRestBtn(exId,setIdx,secs){
  // if this set's timer is running, stop it; otherwise start it
  if(restExId===exId&&restSetIdx===setIdx&&restInterval){
    stopRestTimer();
  } else {
    startRestTimer(exId,setIdx,secs);
  }
}
// ── EXERCISE TIMER (times the hold itself, not the rest between sets) ──
var exTmrExId=null,exTmrSetIdx=null,exTmrTarget=0,exTmrRemaining=0,exTmrEnd=0,exTmrInterval=null;
function parseTargetSecs(targetStr){
  if(!targetStr)return 30;
  var nums=targetStr.match(/\d+/g);
  if(!nums)return 30;
  return parseInt(nums[nums.length-1]); // last number = upper bound for ranges like "20-30s"
}
function updateExTmrDisplay(){
  var el=document.getElementById('exTimerFloat');
  if(exTmrExId==null){
    if(el)el.classList.remove('active');
    return;
  }
  if(el){
    el.classList.add('active');
    var cd=document.getElementById('exTmrCountdown');
    if(cd)cd.textContent=exTmrRemaining+'s';
  }
  var btn=document.getElementById('extmrbtn_'+exTmrExId+'_'+exTmrSetIdx);
  if(btn)btn.textContent=exTmrRemaining;
}
function tickExTmr(){
  exTmrRemaining=Math.max(0,Math.ceil((exTmrEnd-Date.now())/1000));
  updateExTmrDisplay();
  if(exTmrRemaining<=0){
    clearInterval(exTmrInterval);exTmrInterval=null;
    playBeep();
    if(navigator.vibrate)navigator.vibrate([400,100,400,100,400]);
    finishExTmr(exTmrTarget);
  }
}
function finishExTmr(secsToLog){
  var id=exTmrExId,si=exTmrSetIdx;
  if(id==null)return;
  var inp=document.getElementById('inp_'+id+'_'+si+'_time');
  if(inp)inp.value=secsToLog;
  updSet(id,si,'time',secsToLog);
  if(mState[id]&&mState[id].sets[si]){
    mState[id].sets[si].done=true;
    var chk=document.getElementById('setchk_'+id+'_'+si);
    if(chk)chk.classList.add('done');
    var allDone=mState[id].sets.every(function(s){return !!s.done;});
    mState[id].done=allDone;
    var mainChk=document.getElementById('exchk_'+id);
    if(mainChk)mainChk.classList.toggle('done',allDone);
    if(allDone){
      var lexDiv=mainChk&&mainChk.closest?mainChk.closest('.lex'):null;
      if(lexDiv){lexDiv.classList.add('flash-done');setTimeout(function(){lexDiv.classList.remove('flash-done');},600);}
    }
  }
  var btn=document.getElementById('extmrbtn_'+id+'_'+si);
  if(btn){btn.classList.remove('active');btn.innerHTML='&#9654;';}
  exTmrExId=null;exTmrSetIdx=null;exTmrRemaining=0;
  updateExTmrDisplay();
}
function startExTmr(exId,setIdx){
  if(exTmrInterval){clearInterval(exTmrInterval);exTmrInterval=null;}
  if(exTmrExId!=null){
    var oldBtn=document.getElementById('extmrbtn_'+exTmrExId+'_'+exTmrSetIdx);
    if(oldBtn){oldBtn.classList.remove('active');oldBtn.innerHTML='&#9654;';}
  }
  var inp=document.getElementById('inp_'+exId+'_'+setIdx+'_time');
  var curVal=inp&&inp.value?parseInt(inp.value):0;
  var info=resolveExById(exId);
  var baseId=info&&info.isAlt?info.baseId:exId;
  var baseEx=ALL_EX.find(function(e){return e.id===baseId;});
  var target=curVal>0?curVal:parseTargetSecs(baseEx?baseEx.target:'');
  if(!target||target<=0)target=30;
  exTmrExId=exId;exTmrSetIdx=setIdx;exTmrTarget=target;exTmrRemaining=target;
  exTmrEnd=Date.now()+target*1000;
  if(navigator.vibrate)navigator.vibrate(200);
  var btn=document.getElementById('extmrbtn_'+exId+'_'+setIdx);
  if(btn)btn.classList.add('active');
  var lbl=document.getElementById('exTmrLabel');
  if(lbl){var dispName=(resolveExById(exId)||{}).name||'Exercise';lbl.innerHTML=dispName+'<br><span style="font-size:11px;opacity:.6">Tap Stop when you\'re done</span>';}
  updateExTmrDisplay();
  exTmrInterval=setInterval(tickExTmr,1000);
}
function stopExTmrEarly(){
  if(exTmrExId==null)return;
  var elapsed=exTmrTarget-exTmrRemaining;
  clearInterval(exTmrInterval);exTmrInterval=null;
  if(navigator.vibrate)navigator.vibrate(150);
  finishExTmr(elapsed);
}
function togExTimer(exId,setIdx){
  if(exTmrExId===exId&&exTmrSetIdx===setIdx&&exTmrInterval){
    stopExTmrEarly();
  } else {
    startExTmr(exId,setIdx);
  }
}
function scheduleRestNotification(endTimestamp){
  cancelRestNotification();
  if(!('Notification' in window))return;
  if(Notification.permission==='default'){
    Notification.requestPermission().then(function(perm){
      if(perm==='granted'&&restInterval)scheduleRestNotification(endTimestamp);
    });
    return;
  }
  if(Notification.permission!=='granted')return;
  var delay=endTimestamp-Date.now();
  if(delay<=0)return;
  restNotifTimeout=setTimeout(function(){
    restNotifTimeout=null;
    // Only show if the app is actually backgrounded — the in-app beep/vibrate covers foreground
    if(document.visibilityState==='hidden'){
      try{new Notification('Rest complete',{body:'Time for your next set.',tag:'pt-rest',renotify:true});}catch(e){}
    }
  },delay);
}
function cancelRestNotification(){
  if(restNotifTimeout){clearTimeout(restNotifTimeout);restNotifTimeout=null;}
}
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='visible'&&restInterval)tickRest();
});

// ── SESSION TIME ───────────────────────────────────────────────
function copyLastSession(){
  var allLogs=load().logs;
  var date=new Date(mKey+'T00:00:00');
  var pd=pplDay(date);
  var pastKeys=Object.keys(allLogs).filter(function(k){return k<mKey;}).sort().reverse();
  var found=null;
  for(var i=0;i<pastKeys.length;i++){
    var pl=allLogs[pastKeys[i]];
    var ps=mType==='morning'?pl.morning:pl.ppl;
    if(!ps||!ps.exercises)continue;
    if(mType==='ppl'){
      var pastDate=new Date(pastKeys[i]+'T00:00:00');
      if(pplDay(pastDate)!==pd)continue;
    }
    if(Object.keys(ps.exercises).length){found=ps;break;}
  }
  if(!found){showToast('No previous session found to copy.','var(--muted)');return;}
  Object.keys(mState).forEach(function(id){
    var prev=found.exercises[id];
    if(!prev||!prev.sets||!prev.sets.length)return;
    mState[id].sets.forEach(function(s,si){
      var prevSet=prev.sets[si];
      if(!prevSet)return; // no corresponding old set at this index — leave current default as-is
      ['reps','weight','time','rpe'].forEach(function(field){
        if(prevSet[field]!=null&&prevSet[field]!=='')s[field]=prevSet[field];
      });
      s.done=false;
    });
    mState[id].done=false;
    mState[id].sets.forEach(function(s,si){
      ['reps','weight','time','rpe'].forEach(function(field){
        var el=document.getElementById('inp_'+id+'_'+si+'_'+field);
        if(el&&s[field]!=null&&s[field]!=='')el.value=s[field];
      });
    });
  });
  showToast('Copied sets from last session — adjust as needed.','var(--success)');
}
function calcManualDuration(){
  var s=document.getElementById('stimeStart');
  var e=document.getElementById('stimeEnd');
  var d=document.getElementById('stimeDur');
  if(!s||!e||!d)return;
  if(!s.value||!e.value){d.textContent='';return;}
  var sp=s.value.split(':');var ep=e.value.split(':');
  var sm=parseInt(sp[0])*60+parseInt(sp[1]);
  var em=parseInt(ep[0])*60+parseInt(ep[1]);
  var diff=em-sm;if(diff<0)diff+=1440;
  d.textContent=diff>0?'Session: '+diff+' min':'';
}

// ── WARMUP / COOLDOWN ──────────────────────────────────────────
function togWarmup(){
  mWarmupOpen=!mWarmupOpen;
  var body=document.getElementById('wuBody');
  var arr=document.getElementById('wuArrow');
  if(body)body.classList.toggle('open',mWarmupOpen);
  if(arr)arr.style.transform=mWarmupOpen?'rotate(90deg)':'rotate(0deg)';
}
function togCooldown(){
  mCooldownOpen=!mCooldownOpen;
  var body=document.getElementById('cdBody');
  var arr=document.getElementById('cdArrow');
  if(body)body.classList.toggle('open',mCooldownOpen);
  if(arr)arr.style.transform=mCooldownOpen?'rotate(90deg)':'rotate(0deg)';
}
function togWuItem(i){
  mWarmup[i]=!mWarmup[i];
  var btn=document.getElementById('wuchk_'+i);
  if(btn){btn.classList.toggle('done',mWarmup[i]);btn.classList.add('popped');setTimeout(function(){btn.classList.remove('popped');},300);}
  // update badge
  var badge=document.getElementById('wuBadge');
  if(badge)badge.textContent=mWarmup.filter(function(x){return x;}).length+'/'+mWarmup.length;
}
function togCdItem(i){
  mCooldown[i]=!mCooldown[i];
  var btn=document.getElementById('cdchk_'+i);
  if(btn){btn.classList.toggle('done',mCooldown[i]);btn.classList.add('popped');setTimeout(function(){btn.classList.remove('popped');},300);}
  var badge=document.getElementById('cdBadge');
  if(badge)badge.textContent=mCooldown.filter(function(x){return x;}).length+'/'+mCooldown.length;
}

// State
var curScreen='today';
var weekOffset=parseInt(sessionStorage.getItem('pt_wo')||'0');
var guideSearchTerm='';
var currentSubEx=null;
var calDate=new Date();
var selWDay=null;
var mType=null,mKey=null,mState={},mNotes='',mDraftNotes='';
setInterval(function(){try{if(mType&&mKey&&document.getElementById('overlay').classList.contains('open'))localStorage.setItem('pt_draft',JSON.stringify({key:mKey,type:mType,state:mState,notes:mNotes,t:Date.now()}));}catch(e){}},3000);
var guideDay='morning',guideSec='exercises';
var openCards={};
// Rest timer
var restInterval=null;
var restRemaining=0;
var restEndTimestamp=0;
var restExId=null;
var restSetIdx=null;
var beepAlarm=null; // tracks repeating alarm
var restNotifTimeout=null;
// Warm-up / Cool-down modal state
var mWarmup=[];
var mCooldown=[];
var mWarmupOpen=false;
var mCooldownOpen=false;
// Session time
var mStartHHMM='',mEndHHMM='',mStartConfirmed=false,mPrevNotes='';

// Navigation
function go(name,btn){
  document.querySelectorAll('.screen').forEach(function(s){s.classList.remove('active')});
  document.getElementById('sc-'+name).classList.add('active');
  document.querySelectorAll('.nbtn').forEach(function(b){b.classList.remove('active')});
  if(btn)btn.classList.add('active');
  curScreen=name;
  render(name);
}
function render(n){
  if(n==='today')rToday();
  else if(n==='week')rWeek();
  else if(n==='cal')rCal();
  else if(n==='prog')rProg();
  else if(n==='guide')rGuide();
}

