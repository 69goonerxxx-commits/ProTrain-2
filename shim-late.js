// ProTrain Android shell: runs after the app's own scripts. Replaces the few browser-only features with native ones.
(function(){
  var C=window.Capacitor,P=(C&&C.Plugins)||{},FS=P.Filesystem,SH=P.Share,LN=P.LocalNotifications,APP=P.App;
  function toast(m,c){try{showToast(m,c||'var(--success)');}catch(e){}}

  // ── Updates come as a new APK, so the web update check just reports the installed version ──
  window.checkForUpdate=function(){
    return Promise.resolve({status:'current',msg:'Installed app '+APP_VERSION+'. New versions arrive as a new APK from your GitHub Releases page.'});
  };
  window.offlineVerdict=function(){
    return 'This is the installed app, so it works fully offline. Only the emoji pictures need a connection; without one your phone\'s own emoji appear instead.';
  };

  // ── Backup / CSV export: a WebView cannot download blob links, so save the file natively ──
  var blobs={},origCreate=URL.createObjectURL.bind(URL),origRevoke=URL.revokeObjectURL.bind(URL);
  URL.createObjectURL=function(b){var u=origCreate(b);blobs[u]=b;return u;};
  URL.revokeObjectURL=function(u){setTimeout(function(){delete blobs[u];},60000);try{origRevoke(u);}catch(e){}};

  function toB64(blob){
    return new Promise(function(res,rej){
      var r=new FileReader();
      r.onload=function(){res(String(r.result).split(',')[1]);};
      r.onerror=function(){rej(r.error);};
      r.readAsDataURL(blob);
    });
  }
  // automatic daily backup: no prompt, written to Documents/ProTrain (falls back to the app's own folder)
  function saveSilently(name,b64){
    return FS.writeFile({path:'ProTrain/'+name,data:b64,directory:'DOCUMENTS',recursive:true})
      .then(function(){return 'Documents/ProTrain';})
      .catch(function(){
        return FS.writeFile({path:name,data:b64,directory:'EXTERNAL',recursive:true}).then(function(){return 'the ProTrain app folder';});
      });
  }
  // manual export: write a temp file, then open the share sheet (Save to Files, Drive, WhatsApp, etc.)
  function saveAndShare(name,b64){
    return FS.writeFile({path:name,data:b64,directory:'CACHE'}).then(function(r){
      return SH.share({title:name,files:[r.uri],dialogTitle:'Save or send '+name});
    });
  }
  function nativeSave(name,blob,silent){
    if(!FS||!SH){toast('Saving files is not available here','var(--muted)');return;}
    toB64(blob).then(function(b64){
      if(silent)return saveSilently(name,b64).then(function(where){toast('Automatic backup saved to '+where);});
      return saveAndShare(name,b64);
    }).catch(function(e){
      var m=String((e&&e.message)||e);
      if(/cancel/i.test(m))return;
      toast('Could not save the file: '+m,'var(--danger,#e5484d)');
    });
  }
  var autoFlag=false,origExport=window.exportData;
  if(typeof origExport==='function'){
    window.exportData=function(auto){
      autoFlag=(auto===true);
      try{return origExport.apply(this,arguments);}finally{autoFlag=false;}
    };
  }
  var origClick=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    if(this.download&&/^blob:/.test(this.href)&&blobs[this.href]){
      nativeSave(this.download,blobs[this.href],autoFlag);
      return;
    }
    return origClick.apply(this,arguments);
  };

  // ── Rest timer notification: a live countdown (native) with +30 s and Skip rest buttons, shown for the whole rest ──
  // Works in the app and out of it. If the native piece is missing, it falls back to a plain "Rest complete" alert.
  var NOTIF_ID=4201,pendingEnd=0,active=true,channelReady=false,restMeta=null,pollT=null,warned={};
  var RT=P.RestTimer||((C&&typeof C.registerPlugin==='function')?C.registerPlugin('RestTimer'):null);
  function warnOnce(key,msg){if(warned[key])return;warned[key]=1;toast(msg,'var(--muted)');}
  function ensureChannel(){
    if(channelReady||!LN||!LN.createChannel)return Promise.resolve();
    channelReady=true;
    return LN.createChannel({id:'rest',name:'Rest timer',description:'Alerts when your rest ends',importance:4,visibility:1,vibration:true}).catch(function(){});
  }
  function nativeCancel(){if(LN){try{LN.cancel({notifications:[{id:NOTIF_ID}]});}catch(e){}}}
  function nativeSchedule(){
    if(!LN||pendingEnd<=Date.now())return;
    var end=pendingEnd;
    ensureChannel().then(function(){
      return LN.schedule({notifications:[{id:NOTIF_ID,title:'Rest complete',body:'Time for your next set.',channelId:'rest',schedule:{at:new Date(end),allowWhileIdle:true}}]});
    }).catch(function(){});
  }
  // what happened to the notification (+30 s, Skip) since we last looked
  function applyState(s){
    try{
      if(!s||!window.restInterval)return;
      if(s.skipped){stopRestTimer();return;}
      if(s.active&&s.endMs&&Math.abs(s.endMs-pendingEnd)>500){
        pendingEnd=s.endMs;window.restEndTimestamp=s.endMs;
        window.restTotalSecs=Math.max(window.restTotalSecs||0,Math.round((s.totalMs||0)/1000));
        tickRest();
      }
    }catch(e){}
  }
  function poll(){
    if(!RT)return;
    if(pendingEnd<=0||pendingEnd<Date.now()-5000){stopPoll();return;}
    RT.getState().then(applyState).catch(function(){});
  }
  function startPoll(){if(!pollT&&RT)pollT=setInterval(poll,1000);}
  function stopPoll(){if(pollT){clearInterval(pollT);pollT=null;}}
  function liveStart(){
    if(pendingEnd<=Date.now())return;
    var m=restMeta||{};
    if(!RT){if(!active)nativeSchedule();return;}
    RT.start({
      endMs:pendingEnd,
      totalMs:(window.restTotalSecs||0)*1000,
      title:m.title||'Rest',
      prefix:m.prefix||'',
      nextLabel:m.nextLabel||'Next set at',
      nextTarget:m.nextTarget||'',
      doneTitle:m.doneTitle||'Rest complete',
      doneText:m.doneText||'Time for your next set.'
    }).then(startPoll).catch(function(e){
      warnOnce('rt','Timer notification is not available in this build ('+String((e&&e.message)||e).slice(0,80)+')');
      if(!active)nativeSchedule();
    });
  }
  window.scheduleRestNotification=function(end,meta){
    pendingEnd=end;restMeta=meta||null;nativeCancel();
    if(end<=Date.now())return;
    var ask=LN?LN.checkPermissions().then(function(p){
      if(p.display==='prompt'||p.display==='prompt-with-rationale')return LN.requestPermissions();
      return p;
    }):Promise.resolve({display:'granted'});
    ask.then(function(p){
      if(p&&p.display==='denied'){
        warnOnce('perm','Notifications are off for ProTrain. Turn them on in Android settings to see the rest timer outside the app.');
        return;
      }
      liveStart();
    }).catch(function(){liveStart();});
  };
  window.cancelRestNotification=function(){pendingEnd=0;stopPoll();nativeCancel();if(RT){try{RT.clear();}catch(e){}}};
  function setActive(a){
    if(a===active)return;
    active=a;
    if(!a&&!RT&&pendingEnd>Date.now())nativeSchedule();
    if(a){nativeCancel();if(RT)RT.getState().then(applyState).catch(function(){});}
  }
  // Settings > "Test timer notification": starts a 45 s test and reports what Android says about it
  window.testRestNotification=function(){
    var lines=[];
    function msg(e){return String((e&&e.message)||e);}
    function show(){try{alert(lines.join('\n'));}catch(e){toast(lines.join(' | '),'var(--muted)');}}
    lines.push('Timer plugin: '+(RT?'found':'MISSING'));
    if(!RT)lines.push('Plugins this build knows: '+Object.keys(P).join(', '));
    lines.push('Local notifications plugin: '+(LN?'found':'MISSING'));
    var perm=LN?LN.checkPermissions().then(function(p){
      lines.push('Permission: '+p.display);
      if(p.display==='prompt'||p.display==='prompt-with-rationale')return LN.requestPermissions().then(function(q){lines.push('Permission after asking: '+q.display);});
    }).catch(function(e){lines.push('Permission check failed: '+msg(e));}):Promise.resolve();
    perm.then(function(){
      if(!RT){show();return;}
      return RT.start({endMs:Date.now()+45000,totalMs:45000,title:'Test \u00b7 ProTrain',prefix:'This is a test',nextLabel:'Ends at',doneTitle:'Test complete',doneText:'The rest timer notification works.'})
        .then(function(){lines.push('Start call: ok');},function(e){lines.push('Start call FAILED: '+msg(e));})
        .then(function(){return new Promise(function(r){setTimeout(r,800);});})
        .then(function(){return RT.debug();})
        .then(function(d){
          lines.push('Android version (API): '+d.sdk);
          lines.push('Notifications allowed for ProTrain: '+(d.enabled?'yes':'NO'));
          lines.push('Timer channel importance: '+d.channelImportance+(d.channelImportance===0?' (BLOCKED)':''));
          lines.push('Timer notification posted: '+(d.liveShown?'yes':'NO'));
          lines.push('Shrinking bar service: '+(d.service?'running':'NOT running (the bar will not shrink)'));
          lines.push('Rest alert mode: '+d.mode);
        },function(e){lines.push('Debug call failed: '+msg(e));})
        .then(show);
    });
  };
  // ── Alert settings: what happens when a rest ends (sound, vibrate only, silent, off) and the workout notification switch ──
  window.syncNotifSettings=function(){
    var m=localStorage.getItem('pt_alert');
    if(m!=='vibrate'&&m!=='silent'&&m!=='off')m='sound';
    if(RT&&RT.setSettings){try{RT.setSettings({mode:m,workout:localStorage.getItem('pt_workout_notif')!=='0'}).catch(function(){});}catch(e){}}
    if(m==='off'&&window.restInterval){try{window.cancelRestNotification();}catch(e){}}
    try{window.syncWorkoutReminders();}catch(e){}
    try{wTick();}catch(e){}
  };

  // ── Workout in progress: a notification with session time and sets done, while a workout is open ──
  var W={on:false,key:null,start:0,done:-1,total:-1};
  function wTick(){
    if(!RT||!RT.workoutUpdate)return;
    var live=false,done=0,total=0,title='Workout';
    try{
      if(localStorage.getItem('pt_workout_notif')!=='0'&&typeof mType!=='undefined'&&mType==='ppl'&&mKey&&mKey===toKey(new Date())&&mState){
        live=true;
        Object.keys(mState).forEach(function(id){
          workSets(mState[id].sets).forEach(function(st){total++;if(st&&st.done)done++;});
        });
        title=(DAY_SUBTITLES&&DAY_SUBTITLES[mDay])||'Workout';
      }
    }catch(e){live=false;}
    if(!live){
      if(W.on){W.on=false;W.key=null;W.done=-1;W.total=-1;try{RT.workoutEnd().catch(function(){});}catch(e){}}
      return;
    }
    if(!W.on||W.key!==mKey){W.on=true;W.key=mKey;W.start=Date.now();W.done=-1;W.total=-1;}
    if(W.done===done&&W.total===total)return;
    W.done=done;W.total=total;
    try{RT.workoutUpdate({startMs:W.start,done:done,total:total,title:title}).catch(function(){});}catch(e){}
  }
  setInterval(wTick,2000);

  // ── Workout reminders: scheduled notifications for the next two weeks of training days ──
  var REM_AM=6000,REM_PM=6100,remChan=false;
  function remChannel(){
    if(remChan||!LN||!LN.createChannel)return Promise.resolve();
    remChan=true;
    return LN.createChannel({id:'reminders',name:'Workout reminders',description:'Reminds you to train',importance:3,visibility:1,vibration:true}).catch(function(){});
  }
  function hm(v,def){var m=/^(\d\d):(\d\d)$/.exec(v||'')||/^(\d\d):(\d\d)$/.exec(def);return{h:+m[1],m:+m[2]};}
  window.askNotifPermission=function(){
    if(!LN)return;
    LN.checkPermissions().then(function(p){
      if(p.display==='prompt'||p.display==='prompt-with-rationale')return LN.requestPermissions();
    }).catch(function(){});
  };
  window.syncWorkoutReminders=function(){
    if(!LN)return;
    var ids=[];
    for(var i=0;i<14;i++){ids.push({id:REM_AM+i});ids.push({id:REM_PM+i});}
    var clear=LN.cancel({notifications:ids}).catch(function(){});
    if(localStorage.getItem('pt_rem_on')!=='1')return;
    clear.then(function(){
      var list=[],eve=localStorage.getItem('pt_rem_eve')==='1';
      var t1=hm(localStorage.getItem('pt_rem_time'),'18:00'),t2=hm(localStorage.getItem('pt_rem_eve_time'),'20:30');
      var base=new Date();base.setHours(0,0,0,0);
      var logs=load().logs,paused=false;
      try{paused=isPlanPaused();}catch(e){}
      if(paused)return;
      for(var i=0;i<14;i++){
        var d=new Date(base);d.setDate(base.getDate()+i);
        var key=toKey(d),day=pplDay(d);
        if(!day||isRest(d)||beforeStart(d)||dayComplete(key,d))continue;
        var lg=logs[key];if(lg&&lg.skip)continue;
        var sub=(DAY_SUBTITLES&&DAY_SUBTITLES[day])||'training';
        var at1=new Date(d.getFullYear(),d.getMonth(),d.getDate(),t1.h,t1.m);
        if(at1.getTime()>Date.now()+5000)list.push({id:REM_AM+i,title:'Workout today',body:sub+' is on your plan. Time to train.',channelId:'reminders',schedule:{at:at1,allowWhileIdle:true}});
        if(eve){
          var at2=new Date(d.getFullYear(),d.getMonth(),d.getDate(),t2.h,t2.m);
          if(at2.getTime()>Date.now()+5000&&at2.getTime()>at1.getTime())list.push({id:REM_PM+i,title:'Still time to train',body:'You have not logged '+sub+' yet today.',channelId:'reminders',schedule:{at:at2,allowWhileIdle:true}});
        }
      }
      if(!list.length)return;
      return remChannel().then(function(){return LN.schedule({notifications:list});});
    }).catch(function(){});
  };
  // ── Home-screen widget: send the next 8 days of the plan, today's done state and the streak ──
  window.pushWidgetData=function(){
    if(!RT||!RT.setWidget)return;
    try{
      var base=new Date();base.setHours(0,0,0,0);
      var paused=false;try{paused=isPlanPaused();}catch(e){}
      var days=[];
      for(var i=0;i<8;i++){
        var d=new Date(base);d.setDate(base.getDate()+i);
        var key=toKey(d),day=pplDay(d),rest=!day||isRest(d)||paused||beforeStart(d);
        var t=paused?'Plan paused':(!day||isRest(d))?'Rest day':beforeStart(d)?'Not started yet':((DAY_SUBTITLES&&DAY_SUBTITLES[day])||'Workout');
        days.push({k:key,t:t,r:rest?1:0,d:(!rest&&dayComplete(key,d))?1:0});
      }
      var st=0;try{st=calcStreak().streak||0;}catch(e){}
      RT.setWidget({days:days,streak:st,asOf:toKey(new Date())}).catch(function(){});
    }catch(e){}
  };
  var wgT=null;
  window.scheduleWidgetPush=function(){clearTimeout(wgT);wgT=setTimeout(function(){try{window.pushWidgetData();}catch(e){}},700);};
  // a saved workout cancels today's reminders; opening the app tops the two-week window back up
  var origSaveSession=window.saveSession;
  if(typeof origSaveSession==='function'){
    window.saveSession=function(){
      var r=origSaveSession.apply(this,arguments);
      setTimeout(function(){try{window.syncWorkoutReminders();}catch(e){}},800);
      try{window.scheduleWidgetPush();}catch(e){}
      return r;
    };
  }
  setTimeout(function(){try{window.syncNotifSettings();}catch(e){}},1500);
  setTimeout(function(){try{window.scheduleWidgetPush();}catch(e){}},2200);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='visible'){try{window.syncWorkoutReminders();}catch(e){}}
    try{window.scheduleWidgetPush();}catch(e){}
  });

  document.addEventListener('visibilitychange',function(){setActive(document.visibilityState!=='hidden');});
  if(APP&&APP.addListener){try{APP.addListener('appStateChange',function(s){setActive(!!s.isActive);});}catch(e){}}
})();
