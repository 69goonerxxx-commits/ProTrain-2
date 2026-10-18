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
  var RT=(C&&C.registerPlugin)?C.registerPlugin('RestTimer'):null;
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
  document.addEventListener('visibilitychange',function(){setActive(document.visibilityState!=='hidden');});
  if(APP&&APP.addListener){try{APP.addListener('appStateChange',function(s){setActive(!!s.isActive);});}catch(e){}}
})();
