// ── EXPORT / IMPORT ───────────────────────────────────────────
var progSections={};
function toggleProgSec(id){
  progSections[id]=!progSections[id];
  var body=document.getElementById('ps_'+id);
  var arrow=document.getElementById('pa_'+id);
  if(body)body.style.maxHeight=progSections[id]?'2000px':'0';
  if(arrow)arrow.classList.toggle('open',progSections[id]);
}
function render1RM(){
  var sel=document.getElementById('rmSel');
  var wrap=document.getElementById('rmResult');
  if(!sel||!wrap)return;
  var exId=sel.value;if(!exId){wrap.innerHTML='';return;}
  var ex=ALL_EX.find(function(e){return e.id===exId;});
  var hist=get1RMHistory(exId);
  var best=getBest1RM(exId);
  if(!hist.length){wrap.innerHTML='<div class="no-data">No data logged yet for '+ex.name+'.<br>Log a session with reps and weight to see your estimated 1RM.</div>';return;}
  var h='<div class="orm-result">'+best+'<span style="font-size:16px">kg</span></div>';
  h+='<div class="orm-note">Estimated 1RM (Epley Formula)</div>';
  h+='<div class="xbars" style="margin-top:12px">';
  var maxRM=Math.max.apply(null,hist.map(function(h){return h.rm;}));
  hist.forEach(function(s){
    var bh=Math.max(s.rm/maxRM*60,4);
    h+='<div class="xbc"><div class="xval">'+s.rm+'</div><div class="xbar" style="height:'+bh+'px;background:var(--push)"></div><div class="xdate">'+s.date+'</div></div>';
  });
  h+='</div>';
  wrap.innerHTML=h;
}
function renderBA(){
  var d1=document.getElementById('baDate1');
  var d2=document.getElementById('baDate2');
  var wrap=document.getElementById('baResult');
  if(!d1||!d2||!wrap)return;
  if(!d1.value||!d2.value){wrap.innerHTML='<div class="no-data">Pick two dates to compare.</div>';return;}
  var rows=getBeforeAfter(d1.value,d2.value);
  if(!rows.length){wrap.innerHTML='<div class="no-data">No matching exercise data for these dates.</div>';return;}
  var h='<div class="ba-row"><div class="ba-col"><div class="ba-date">'+d1.value+'</div>';
  rows.forEach(function(r){h+='<div class="ba-ex"><span>'+r.name+'</span><span class="ba-val">'+(r.w1?r.r1+'r×'+r.w1+'kg':'—')+'</span></div>';});
  h+='</div><div class="ba-col"><div class="ba-date">'+d2.value+'</div>';
  rows.forEach(function(r){
    var diff=r.w2-r.w1;
    var col=diff>0?'var(--success)':diff<0?'var(--danger)':'var(--text)';
    h+='<div class="ba-ex"><span>'+r.name+'</span><span class="ba-val" style="color:'+col+'">'+(r.w2?r.r2+'r×'+r.w2+'kg':'—')+(diff>0?' (+'+diff+'kg)':diff<0?' ('+diff+'kg)':'')+'</span></div>';
  });
  h+='</div></div>';
  wrap.innerHTML=h;
}
function addCustomEx(){
  var name=document.getElementById('cexName');
  var day=document.getElementById('cexDay');
  var type=document.getElementById('cexType');
  var target=document.getElementById('cexTarget');
  var muscPrimary=document.getElementById('cexMuscPrimary');
  var muscSecondary=document.getElementById('cexMuscSecondary');
  if(!name||!name.value.trim()){showToast('Enter an exercise name','var(--danger)');return;}
  var arr=loadCustomExercises();
  var isBand=type.value==='bands';
  var exType=isBand?'reps':type.value;
  var newEx={id:'custom_'+Date.now(),name:name.value.trim(),type:exType,day:day.value,target:target.value||'3x10',sets:parseInt((target.value||'3x10').split('x')[0])||3,tag:'Custom',isBand:isBand,steps:['Perform the exercise with proper form and controlled movement.'],tip:'Custom exercise added by you.'};
  if(muscPrimary&&muscPrimary.value.trim()){
    newEx.muscles={primary:muscPrimary.value.trim(),secondary:(muscSecondary&&muscSecondary.value.trim())||'—'};
  }
  arr.push(newEx);
  saveCustomExercises(arr);
  rebuildALLEX();
  name.value='';target.value='';
  if(muscPrimary)muscPrimary.value='';
  if(muscSecondary)muscSecondary.value='';
  showToast('✅ '+newEx.name+' added!','var(--success)');
  rProg();
}
function deleteCustomEx(idx){
  var arr=loadCustomExercises();
  arr.splice(idx,1);
  saveCustomExercises(arr);
  rebuildALLEX();
  rProg();
}
function exportData(){
  var data=Object.assign({},load());
  var bands={},calib={};
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.startsWith('band_'))bands[k]=localStorage.getItem(k);if(k&&k.startsWith('pt_calib_'))calib[k]=localStorage.getItem(k);}
  data._meta={
    version:'v8',
    prCount:localStorage.getItem('ppl_pr_count4'),
    theme:localStorage.getItem('ppl_theme'),
    font:localStorage.getItem('ppl_font'),
    bestStreak:localStorage.getItem('ppl_best4'),
    customEx:localStorage.getItem('pt_custom_ex')||'[]',
    bands:bands,
    calib:calib,
    programStart:localStorage.getItem('pt_program_start')
  };
  localStorage.setItem('pt_last_backup_session',getMilestoneStats().sessions);
  var blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  var d=new Date();
  a.href=url;
  a.download='protrain-backup-'+d.toISOString().slice(0,10)+'.json';
  a.click();
  URL.revokeObjectURL(url);
  var msg=document.getElementById('dataMsg');
  if(msg){msg.style.color='var(--success)';msg.textContent='Backup downloaded!';}
}
function importData(e){
  var file=e.target.files[0];
  if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var parsed;
      try{parsed=JSON.parse(ev.target.result);}catch(pe){throw new Error('not-json');}
      if(!parsed||typeof parsed!=='object'||!parsed.logs)throw new Error('no-logs');
      // Merge: imported logs take priority but keep existing logs for dates not in import
      var existing=JSON.parse(JSON.stringify(load()));
      if(typeof parsed.logs!=='object'||Array.isArray(parsed.logs))throw new Error('no-logs');
      Object.keys(parsed.logs).forEach(function(k){
        if(!/^\d{4}-\d{2}-\d{2}$/.test(k))return;
        var inc=parsed.logs[k]||{};
        existing.logs[k]=Object.assign({},existing.logs[k]||{},inc);
      });
      if(parsed._meta){
        if(parsed._meta.prCount)localStorage.setItem('ppl_pr_count4',Math.max(parseInt(parsed._meta.prCount)||0,parseInt(localStorage.getItem('ppl_pr_count4')||'0')));
        if(parsed._meta.bestStreak)localStorage.setItem('ppl_best4',Math.max(parseInt(parsed._meta.bestStreak)||0,parseInt(localStorage.getItem('ppl_best4')||'0')));
        if(parsed._meta.theme){localStorage.setItem('ppl_theme',parsed._meta.theme);applyTheme(parsed._meta.theme);}
        if(parsed._meta.font){localStorage.setItem('ppl_font',parsed._meta.font);applyFont(parsed._meta.font);}
        if(parsed._meta.customEx){try{var ce=JSON.parse(parsed._meta.customEx);if(Array.isArray(ce)){ce.forEach(function(x){['name','target'].forEach(function(f){if(typeof x[f]==='string')x[f]=x[f].replace(/[<>"&]/g,'');});});localStorage.setItem('pt_custom_ex',JSON.stringify(ce));}}catch(e){}}
        if(parsed._meta.bands){Object.entries(parsed._meta.bands).forEach(function(e){if(/^band_[\w-]+$/.test(e[0])&&typeof e[1]==='string'&&e[1].length<200)localStorage.setItem(e[0],e[1]);});}
        if(parsed._meta.calib){Object.entries(parsed._meta.calib).forEach(function(e){if(/^pt_calib_[\w-]+$/.test(e[0])&&isFinite(parseFloat(e[1])))localStorage.setItem(e[0],String(parseFloat(e[1])));});}
        if(parsed._meta.programStart)localStorage.setItem('pt_program_start',parsed._meta.programStart);
        delete existing._meta;
      }
      save(existing);
      var fileVer=parsed._meta&&parsed._meta.version;
      var curVer='v8';
      var themeChanged=parsed._meta&&parsed._meta.theme&&parsed._meta.theme!==localStorage.getItem('ppl_theme');
      var fontChanged=parsed._meta&&parsed._meta.font&&parsed._meta.font!==localStorage.getItem('ppl_font');
      var msg=document.getElementById('dataMsg');
      if(msg){msg.style.color='var(--success)';msg.textContent='Data imported! '+Object.keys(parsed.logs).length+' days loaded.';}
      if(!fileVer){
        showToast('No version tag — older backup. Exercise history may not match current exercises.','#f97316');
      } else if(fileVer!==curVer){
        showToast('Imported from '+fileVer+' — some fields may differ from '+curVer+'.','#f97316');
      }
      if(themeChanged||fontChanged)showToast('Theme/font preferences restored from backup.','var(--muted)');
      render(curScreen);
    }catch(err){
      var m=err&&err.message,nm=err&&err.name;
      var why=m==='not-json'?'that file is not valid JSON. Pick the protrain-backup .json file.'
        :m==='no-logs'?'that does not look like a ProTrain backup (no logs found).'
        :(nm==='QuotaExceededError'||nm==='SecurityError')?'this browser blocked saving data ('+nm+'). Open ProTrain from a web address instead of a file.'
        :'unexpected error: '+(m||err);
      var msg=document.getElementById('dataMsg');
      if(msg){msg.style.color='var(--danger)';msg.textContent='Import failed: '+why;}
    }
  };
  reader.readAsText(file);
  try{e.target.value='';}catch(x){} // lets you pick the same file again
  e.target.value='';
}

// ── ONBOARDING & DELETE ───────────────────────────────────────
function checkOnboarding(){
  if(!localStorage.getItem('pt_onboarded')){
    document.getElementById('obOverlay').classList.add('show');
    var d=document.getElementById('obStartDate');
    if(d&&!d.value)d.value=toKey(now());
  }
}
function finishOnboarding(){
  var d=document.getElementById('obStartDate');
  if(d&&d.value)localStorage.setItem('pt_program_start',d.value);
  localStorage.setItem('pt_onboarded','1');
  document.getElementById('obOverlay').classList.remove('show');
  rToday();
}
function resetSessionStructure(key,type){
  if(!confirm('Reshape this '+(type==='morning'?'Morning Routine':'PPL')+' session to match the current exercise structure? Values that still fit will be kept; anything that no longer applies will be cleared. This cannot be undone.'))return;
  var data=load();
  var sess=data.logs[key]&&data.logs[key][type];
  if(!sess||!sess.exercises){showToast('Nothing to reset.','var(--muted)');return;}
  var changed=false;
  Object.keys(sess.exercises).forEach(function(id){
    var info=resolveExById(id);
    if(!info)return; // truly unresolvable/legacy id — leave untouched
    var baseId=info.isAlt?info.baseId:id;
    var baseEx=ALL_EX.find(function(e){return e.id===baseId;});
    if(!baseEx)return;
    var targetLen=baseEx.sets||3;
    var oldSets=sess.exercises[id].sets||[];
    if(oldSets.length===targetLen)return; // already matches, nothing to do
    var newSets=Array.from({length:targetLen},function(_,i){
      if(oldSets[i])return Object.assign({},oldSets[i]);
      return emptySet(baseEx);
    });
    sess.exercises[id].sets=newSets;
    sess.exercises[id].done=newSets.every(function(s){return !!s.done;});
    changed=true;
  });
  if(!changed){showToast('Already matches the current structure.','var(--muted)');return;}
  save(data);
  render(curScreen);
  showToast('✅ Structure refreshed, values kept where they still fit','var(--success)');
}
function deleteSession(key,type){
  if(!confirm('Delete this '+(type==='morning'?'Morning Routine':'PPL')+' session? This cannot be undone.'))return;
  var data=load();
  if(data.logs[key]&&data.logs[key][type]){
    delete data.logs[key][type];
    if(!data.logs[key].morning&&!data.logs[key].ppl)delete data.logs[key];
    save(data);
    render(curScreen);
    showToast('Session deleted','var(--muted)');
  }
}
function checkBackupBanner(){
  var last=parseInt(localStorage.getItem('pt_last_backup_session')||'0');
  var cur=getMilestoneStats().sessions;
  var dismissed=localStorage.getItem('pt_backup_dismissed')||'0';
  return cur-last>=7&&parseInt(dismissed)<cur;
}
function dismissBackupBanner(){
  localStorage.setItem('pt_backup_dismissed',getMilestoneStats().sessions);
  render(curScreen);
}
function setProgramStart(val){
  if(val)localStorage.setItem('pt_program_start',val);
  else localStorage.removeItem('pt_program_start');
  rToday();
}
// Init
(function(){
  var th=localStorage.getItem('ppl_theme');
  if(!th){th='dark';localStorage.setItem('ppl_theme','dark');}
  var fs=localStorage.getItem('ppl_font')||'m';
  applyTheme(th);
  applyFont(fs);
  window._showSummary=false;
})();
rToday();
rebuildALLEX();
checkOnboarding();
// One-time migration: backfill exercise names into existing logs
(function migrateExNames(){
  if(localStorage.getItem('pt_migrated_names')==='1')return;
  try{
    var data=load();
    var changed=false;
    Object.values(data.logs).forEach(function(log){
      ['morning','ppl'].forEach(function(type){
        var sess=log[type];
        if(!sess||!sess.exercises)return;
        Object.entries(sess.exercises).forEach(function(e){
          var id=e[0],entry=e[1];
          if(!entry.name){
            var ex=ALL_EX.find(function(x){return x.id===id;});
            if(ex){entry.name=ex.name;changed=true;}
          }
        });
      });
    });
    if(changed){save(data);}
    localStorage.setItem('pt_migrated_names','1');
  }catch(e){}
})();
