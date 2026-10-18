// ── BODY METRICS ──────────────────────────────────────────────
function loadBody(key){var d=load();return(d.logs[key]&&d.logs[key].body)||null;}
function saveBody(key,obj){
  var d=load();
  if(!d.logs[key])d.logs[key]={};
  d.logs[key].body=obj;
  save(d);
}
function calcBMI(weightKg,heightCm){
  if(!weightKg||!heightCm||heightCm<=0)return null;
  var h=heightCm/100;
  return Math.round((weightKg/(h*h))*10)/10;
}
function bmiLabel(bmi){
  return bmi?'rough guide only (cannot tell muscle from fat)':'';
}

// ── CALENDAR DAY ACTION SHEET ──────────────────────────────────
function tapCalDay(key){
  // Remove existing sheet if any
  var ex=document.getElementById('calActionSheet');if(ex)ex.remove();
  var date=new Date(key+'T00:00:00');
  var data=load();
  var log=data.logs[key];
  var hasLog=log&&(log.morning||log.ppl);
  var hasBody=!!(log&&log.body&&(log.body.weight||log.body.height));
  var label=date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  var sheet=document.createElement('div');
  sheet.id='calActionSheet';
  sheet.className='cal-action-sheet';
  var viewLabel=hasLog?'📋 View Day Data':'📅 View Day';
  var viewSub=hasLog?'':'<div style="font-size:11px;color:var(--muted);margin-top:2px">No session logged yet</div>';
  sheet.innerHTML='<div class="cal-action-inner">'
    +'<div class="cal-action-date">'+label+'</div>'
    +'<button class="cal-action-btn" onclick="calGoToDay(\''+key+'\')">'
      +viewLabel+viewSub
    +'</button>'
    +'<button class="cal-action-btn accent" onclick="openBodySheet(\''+key+'\')">'
      +(hasBody?'⚖️ Edit Body Metrics':'⚖️ Log Body Metrics')
    +'</button>'
    +'<button class="cal-action-cancel" onclick="this.closest(\'.cal-action-sheet\').remove()">Cancel</button>'
    +'</div>';
  sheet.addEventListener('click',function(e){if(e.target===sheet)sheet.remove();});
  document.body.appendChild(sheet);
}
function calGoToDay(key){
  var sheet=document.getElementById('calActionSheet');if(sheet)sheet.remove();
  // Navigate to week tab, set correct week offset and day
  var date=new Date(key+'T00:00:00');
  var today=now();today.setHours(0,0,0,0);
  var todayMon=getMondayOf(today);
  var dateMon=getMondayOf(date);
  var diff=Math.round((dateMon-todayMon)/(7*86400000));
  weekOffset=Math.min(diff,1);
  var dow=date.getDay();
  selWDay=dow===0?6:dow-1;
  go('week',document.querySelectorAll('.nbtn')[1]);
}
function openBodySheet(key){
  var sheet=document.getElementById('calActionSheet');if(sheet)sheet.remove();
  var ex2=document.getElementById('bodySheet');if(ex2)ex2.remove();
  var date=new Date(key+'T00:00:00');
  var label=date.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  var existing=loadBody(key)||{};
  var w=existing.weight||'',h=existing.height||'',note=existing.note||'';
  var bmi=existing.bmi||'';
  var wrap=document.createElement('div');
  wrap.id='bodySheet';
  wrap.className='cal-action-sheet';
  wrap.innerHTML='<div class="cal-action-inner">'
    +'<div class="cal-action-date">'+label+' — Body Metrics</div>'
    +'<div class="body-sheet">'
    +'<div class="body-metric-row">'
    +'<div class="body-metric-group"><div class="body-metric-lbl">Weight (kg)</div>'
    +'<input class="body-metric-inp" id="bsWeight" type="number" inputmode="decimal" placeholder="e.g. 72.5" value="'+w+'" oninput="updBodyBMI()"></div>'
    +'<div class="body-metric-group"><div class="body-metric-lbl">Height (cm)</div>'
    +'<input class="body-metric-inp" id="bsHeight" type="number" inputmode="decimal" placeholder="e.g. 170" value="'+h+'" oninput="updBodyBMI()"></div>'
    +'</div>'
    +'<div class="body-bmi-result" id="bsBMIResult">'+(bmi?'BMI '+bmi+' — '+bmiLabel(bmi):'')+'</div>'
    +'<textarea class="body-note-area" id="bsNote" maxlength="500" placeholder="Any notes... (optional)" oninput="this.value=this.value.slice(0,500);this.nextElementSibling.textContent=this.value.length+\'/500\'">'+note+'</textarea>'
    +'<div class="body-note-count">'+(note?note.length:0)+'/500</div>'
    +'</div>'
    +'<button class="save-btn" style="margin:0 20px 8px;width:calc(100% - 40px)" onclick="saveBodySheet(\''+key+'\')">Save ✓</button>'
    +'<button class="cal-action-cancel" onclick="this.closest(\'#bodySheet\').remove()">Cancel</button>'
    +'</div>';
  wrap.addEventListener('click',function(e){if(e.target===wrap)wrap.remove();});
  document.body.appendChild(wrap);
  // Show BMI if existing values
  if(w&&h)updBodyBMI();
}
function updBodyBMI(){
  var wEl=document.getElementById('bsWeight'),hEl=document.getElementById('bsHeight');
  var res=document.getElementById('bsBMIResult');
  if(!wEl||!hEl||!res)return;
  var w=parseFloat(wEl.value),h=parseFloat(hEl.value);
  var bmi=calcBMI(w,h);
  if(bmi){
    res.style.display='block';
    res.textContent='BMI '+bmi+' — '+bmiLabel(bmi);
  }else{
    res.style.display='none';
  }
}
function saveBodySheet(key){
  var wEl=document.getElementById('bsWeight'),hEl=document.getElementById('bsHeight');
  var noteEl=document.getElementById('bsNote');
  var w=wEl?parseFloat(wEl.value)||null:null;
  var h=hEl?parseFloat(hEl.value)||null:null;
  var bmi=calcBMI(w,h);
  var note=noteEl?noteEl.value.slice(0,500):'';
  var obj={};
  if(w)obj.weight=w;
  if(h)obj.height=h;
  if(bmi)obj.bmi=bmi;
  if(note)obj.note=note;
  if(!Object.keys(obj).length){showToast('Nothing to save — enter at least weight or height','var(--muted)');return;}
  saveBody(key,obj);
  var wrap=document.getElementById('bodySheet');if(wrap)wrap.remove();
  rCal();
  showToast('⚖️ Body metrics saved','var(--pull)');
}

// ── CALENDAR ──────────────────────────────────────────────────

function rCal(){
  var yr=calDate.getFullYear(),mo=calDate.getMonth();
  var first=new Date(yr,mo,1),last=new Date(yr,mo+1,0);
  var monthLabel=calDate.toLocaleDateString('en-US',{month:'long',year:'numeric'});
  var startDow=first.getDay();
  var offset=startDow===0?6:startDow-1;
  var todKey=toKey(now());
  var h='<div class="cal-nav">';
  h+='<button class="cal-nav-btn" onclick="chMo(-1)">&#8249;</button>';
  h+='<div class="cal-month">'+monthLabel+'</div>';
  h+='<button class="cal-nav-btn" onclick="chMo(1)">&#8250;</button></div>';
  h+='<div class="cal-grid">';
  ['M','T','W','T','F','S','S'].forEach(function(d){h+='<div class="cal-dn">'+d+'</div>';});
  for(var i=0;i<offset;i++)h+='<div class="cday"></div>';
  var calLogs=load().logs;
  for(var d=1;d<=last.getDate();d++){
    var date=new Date(yr,mo,d),key=toKey(date);
    var st=dayStatus(key,date);
    var isT=key===todKey,isFut=date>now();
    var cls='',dotC='transparent';
    if(!isFut){
      if(st==='full'){cls='full';dotC='var(--success)';}
      else if(st==='partial'){cls='partial';dotC='var(--morning)';}
      else if(st==='incomplete'){cls='incomplete';dotC='#f97316';}
      else if(st==='rest-done'){cls='rest-done';dotC='var(--rest)';}
      else if(st==='rest-partial'){cls='rest-partial';dotC='color-mix(in srgb,var(--rest) 60%,transparent)';}
      else if(st==='rest-miss'){cls='rest-miss';dotC='var(--muted)';}
      else if(st==='missed'){cls='missed';dotC='var(--danger)';}
    }
    var hasBody=!!(calLogs[key]&&calLogs[key].body&&(calLogs[key].body.weight||calLogs[key].body.height));
    h+='<div class="cday '+cls+(isT?' today':'')+'" onclick="tapCalDay(\''+key+'\')">';
    h+='<div class="cday-num">'+d+'</div>';
    h+='<div class="cday-dot" style="background:'+dotC+'"></div>';
    if(hasBody)h+='<div class="cday-bmi"></div>';
    h+='</div>';
  }
  h+='</div>';
  h+='<div class="legend">';
  h+='<div class="leg-item"><div class="leg-dot" style="background:var(--success)"></div>Complete</div>';
  h+='<div class="leg-item"><div class="leg-dot" style="background:var(--morning)"></div>Partial</div>';
  h+='<div class="leg-item"><div class="leg-dot" style="background:#f97316"></div>Incomplete</div>';
  h+='<div class="leg-item"><div class="leg-dot" style="background:var(--rest)"></div>Rest done</div>';
  h+='<div class="leg-item"><div class="leg-dot" style="background:color-mix(in srgb,var(--rest) 60%,transparent)"></div>Rest + morning</div>';
  h+='<div class="leg-item"><div class="leg-dot" style="background:var(--danger)"></div>Missed</div>';
  h+='<div class="leg-item"><div class="leg-dot" style="background:var(--muted)"></div>Rest skipped</div>';
  h+='</div>';
  // Monthly summary (only for past/current month)
  h+='<div style="padding:0 20px 4px"><button style="width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--surface);color:var(--muted);font-family:\'Barlow Condensed\',sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;cursor:pointer" onclick="toggleSummary()">&#128202; Month Summary</button></div>';
  h+='<div id="monthlySummary"></div>';
  var calHasData=Object.keys(load().logs).some(function(k){
    var d=new Date(k+'T00:00:00');
    return d.getFullYear()===yr&&d.getMonth()===mo;
  });
  if(!calHasData){
    h+='<div class="empty-state" style="padding:24px">';
    h+='<div class="empty-icon">🗓️</div>';
    h+='<div class="empty-title">No Sessions This Month</div>';
    h+='<div class="empty-desc">Log sessions to see them appear here.</div>';
    h+='</div>';
  }
  document.getElementById('sc-cal').innerHTML=h;
  if(window._showSummary)renderMonthlySummary();
}
function chMo(dir){calDate.setMonth(calDate.getMonth()+dir);rCal();}

