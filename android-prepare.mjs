// Runs after `cap add android`: sets the version, installs the icons, adds the permissions the app needs.
import fs from 'node:fs';
import path from 'node:path';

const root = path.dirname(new URL(import.meta.url).pathname);
const app = path.join(root, 'android', 'app');
const res = path.join(app, 'src', 'main', 'res');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const buildNumber = parseInt(process.env.BUILD_NUMBER || '1', 10);
const BG = '#0C0C0E';

function must(cond, msg) { if (!cond) throw new Error('android-prepare: ' + msg); }

// 1. version (versionCode must go up on every build so a new APK installs over the old one)
const gradlePath = path.join(app, 'build.gradle');
let gradle = fs.readFileSync(gradlePath, 'utf8');
must(/versionCode\s+\d+/.test(gradle) && /versionName\s+"[^"]*"/.test(gradle), 'versionCode/versionName not found in app/build.gradle');
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${buildNumber}`).replace(/versionName\s+"[^"]*"/, `versionName "${pkg.appVersion}"`);
fs.writeFileSync(gradlePath, gradle);

// 2. icons: the PNGs sit in the repo root as "<res folder>__<file name>.png" (no folders needed when uploading to GitHub)
for (const d of fs.readdirSync(res)) {
  if (!d.startsWith('mipmap-')) continue;
  for (const n of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) fs.rmSync(path.join(res, d, n), { force: true }); // remove the template's default icons at every density
}
let icons = 0;
for (const f of fs.readdirSync(root)) {
  const m = f.match(/^((?:mipmap|drawable)-[a-z0-9]+)__(.+\.png)$/);
  if (!m) continue;
  fs.mkdirSync(path.join(res, m[1]), { recursive: true });
  fs.copyFileSync(path.join(root, f), path.join(res, m[1], m[2]));
  icons++;
}
must(icons === 4, 'expected 4 icon PNGs in the repo root, found ' + icons);

// adaptive icon definition + background colour
const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.mkdirSync(path.join(res, 'mipmap-anydpi-v26'), { recursive: true });
fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
fs.mkdirSync(path.join(res, 'values'), { recursive: true });
fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);

// 3. dark launch screen instead of the default white one (best effort: the template can differ between Capacitor versions)
const stylesPath = path.join(res, 'values', 'styles.xml');
if (fs.existsSync(stylesPath)) {
  let s = fs.readFileSync(stylesPath, 'utf8');
  const s2 = s.replace(/(<item name="android:background">)@drawable\/splash(<\/item>)/g, '$1@color/ic_launcher_background$2');
  if (s2 === s) console.log('note: launch-screen style not found, left as is');
  else fs.writeFileSync(stylesPath, s2);
}

// 4. permissions: vibration for the rest timer, notifications + exact alarm for the rest-complete alert, foreground service for the shrinking bar
const manPath = path.join(app, 'src', 'main', 'AndroidManifest.xml');
let man = fs.readFileSync(manPath, 'utf8');
must(man.includes('</manifest>'), 'AndroidManifest.xml has no </manifest>');
for (const p of ['VIBRATE', 'POST_NOTIFICATIONS', 'USE_EXACT_ALARM', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_SPECIAL_USE']) {
  if (!man.includes(`android.permission.${p}"`)) man = man.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
}
fs.writeFileSync(manPath, man);

// 5. live rest-timer notification: native code (countdown notification with shrinking bar, +30 s / Skip buttons, end-of-rest alarm, workout notification)
const pkgDir = path.join(app, 'src', 'main', 'java', 'com', 'program', 'protrain');
must(fs.existsSync(path.join(pkgDir, 'MainActivity.java')), 'MainActivity.java not found in ' + pkgDir);
for (const f of ['MainActivity.java', 'RestTimerCore.java', 'RestTimerPlugin.java', 'RestTimerReceiver.java', 'RestTimerService.java', 'ProTrainWidget.java']) {
  must(fs.existsSync(path.join(root, f)), f + ' is missing from the repo root');
  fs.copyFileSync(path.join(root, f), path.join(pkgDir, f));
}
let man2 = fs.readFileSync(manPath, 'utf8');
must(man2.includes('</application>'), 'AndroidManifest.xml has no </application>');
if (!man2.includes('RestTimerReceiver')) {
  man2 = man2.replace('</application>', '        <receiver android:name="com.program.protrain.RestTimerReceiver" android:exported="false" />\n    </application>');
  fs.writeFileSync(manPath, man2);
}
if (!man2.includes('RestTimerService')) {
  man2 = fs.readFileSync(manPath, 'utf8');
  must(man2.includes('</application>'), 'AndroidManifest.xml has no </application>');
  man2 = man2.replace('</application>', '        <service android:name="com.program.protrain.RestTimerService" android:exported="false" android:foregroundServiceType="specialUse">\n            <property android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE" android:value="Rest timer countdown notification that redraws once a second while a rest is running" />\n        </service>\n    </application>');
  fs.writeFileSync(manPath, man2);
}
// 6. home-screen widget: layout, size/update settings, background shape and the receiver entry
fs.mkdirSync(path.join(res, 'layout'), { recursive: true });
fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
fs.writeFileSync(path.join(res, 'drawable', 'protrain_widget_bg.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FF14141A" />
    <corners android:radius="20dp" />
    <stroke android:width="1dp" android:color="#FF2A2A33" />
</shape>
`);
fs.writeFileSync(path.join(res, 'layout', 'protrain_widget.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/pt_w_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:gravity="center_vertical"
    android:padding="14dp"
    android:background="@drawable/protrain_widget_bg">
    <TextView
        android:id="@+id/pt_w_label"
        android:layout_width="wrap_content"
        android:layout_height="wrap_content"
        android:text="TODAY"
        android:textColor="#FFF5A623"
        android:textSize="11sp"
        android:textStyle="bold" />
    <TextView
        android:id="@+id/pt_w_title"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:maxLines="2"
        android:ellipsize="end"
        android:text="ProTrain"
        android:textColor="#FFFFFFFF"
        android:textSize="20sp"
        android:textStyle="bold" />
    <TextView
        android:id="@+id/pt_w_status"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="2dp"
        android:singleLine="true"
        android:text=""
        android:textColor="#FFB4B4BE"
        android:textSize="13sp" />
    <TextView
        android:id="@+id/pt_w_streak"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="6dp"
        android:singleLine="true"
        android:text=""
        android:textColor="#FFF5A623"
        android:textSize="13sp"
        android:textStyle="bold" />
</LinearLayout>
`);
fs.writeFileSync(path.join(res, 'xml', 'protrain_widget_info.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="180dp"
    android:minHeight="110dp"
    android:updatePeriodMillis="1800000"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/protrain_widget" />
`);
{
  let m3 = fs.readFileSync(manPath, 'utf8');
  must(m3.includes('</application>'), 'AndroidManifest.xml has no </application>');
  if (!m3.includes('ProTrainWidget')) {
    m3 = m3.replace('</application>', `        <receiver android:name="com.program.protrain.ProTrainWidget" android:exported="false">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/protrain_widget_info" />
        </receiver>
    </application>`);
    fs.writeFileSync(manPath, m3);
  }
}
let gradle2 = fs.readFileSync(gradlePath, 'utf8');
must(/dependencies\s*\{/.test(gradle2), 'no dependencies block in app/build.gradle');
if (!gradle2.includes('androidx.core:core:')) {
  gradle2 = gradle2.replace(/dependencies\s*\{/, 'dependencies {\n    implementation "androidx.core:core:1.13.1"');
  fs.writeFileSync(gradlePath, gradle2);
}

console.log(`prepared: ${pkg.appVersion} (build ${buildNumber}), icons, permissions, rest-timer notification and service, home-screen widget`);
