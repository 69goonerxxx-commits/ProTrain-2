// ProTrain Android shell: runs first, before the app's own scripts.
// The app is bundled inside the APK, so the browser-only offline cache and the "is there a new version?" check do not apply.
try{delete Navigator.prototype.serviceWorker;}catch(e){}
try{localStorage.setItem('pt_upd_check',String(Date.now()));}catch(e){}
