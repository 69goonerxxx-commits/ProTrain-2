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

  // ── Rest-timer alert: WebView has no web Notification, so schedule a native one ──
  // Matches the original behaviour: only alert when the app is in the background (the in-app beep covers the foreground).
  var NOTIF_ID=4201,pendingEnd=0,active=true,channelReady=false;
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
  window.scheduleRestNotification=function(end){
    pendingEnd=end;nativeCancel();
    if(!LN||end<=Date.now())return;
    LN.checkPermissions().then(function(p){
      if(p.display==='prompt'||p.display==='prompt-with-rationale')return LN.requestPermissions();
      return p;
    }).then(function(p){
      if(p&&p.display==='granted'&&!active)nativeSchedule();
    }).catch(function(){});
  };
  window.cancelRestNotification=function(){pendingEnd=0;nativeCancel();};
  function setActive(a){
    if(a===active)return;
    active=a;
    if(!a&&pendingEnd>Date.now())nativeSchedule();
    if(a)nativeCancel();
  }
  document.addEventListener('visibilitychange',function(){setActive(document.visibilityState!=='hidden');});
  if(APP&&APP.addListener){try{APP.addListener('appStateChange',function(s){setActive(!!s.isActive);});}catch(e){}}
})();
