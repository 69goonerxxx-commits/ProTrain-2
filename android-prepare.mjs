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
// 6. home-screen widget: four looks (layouts, shapes), size/update settings and the receiver entry
const widgetRes = {
  "drawable/protrain_widget_bg.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FF14141A" />
    <corners android:radius="22dp" />
    <stroke android:width="1dp" android:color="#FF2A2A33" />
</shape>
`,
  "drawable/protrain_chip.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FF2A2314" />
    <corners android:radius="12dp" />
</shape>
`,
  "drawable/protrain_chip_dark.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#241A1A1F" />
    <corners android:radius="12dp" />
</shape>
`,
  "drawable/protrain_round.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFFFF" />
    <corners android:radius="22dp" />
</shape>
`,
  "drawable/protrain_seg.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFFFF" />
    <corners android:radius="3dp" />
</shape>
`,
  "drawable/protrain_dot.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
    <solid android:color="#FFFFFFFF" />
</shape>
`,
  "drawable/protrain_dot_ring.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
    <solid android:color="#00000000" />
    <stroke android:width="2dp" android:color="#FFFFFFFF" />
</shape>
`,
  "drawable/protrain_check_dark.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="oval">
    <solid android:color="#FF1A1A1F" />
</shape>
`,
  "drawable/protrain_pill_start.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFF5A623" />
    <corners android:radius="16dp" />
</shape>
`,
  "drawable/protrain_pill_done.xml": `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#00000000" />
    <corners android:radius="16dp" />
    <stroke android:width="1dp" android:color="#FF5DCAA5" />
</shape>
`,
  "drawable/protrain_ring_orange.xml": `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@android:id/background">
        <shape android:shape="ring" android:innerRadiusRatio="2.7" android:thicknessRatio="10" android:useLevel="false">
            <solid android:color="#FF2E2E38" />
        </shape>
    </item>
    <item android:id="@android:id/progress">
        <shape android:shape="ring" android:innerRadiusRatio="2.7" android:thicknessRatio="10" android:useLevel="true">
            <solid android:color="#FFF5A623" />
        </shape>
    </item>
</layer-list>
`,
  "drawable/protrain_ring_green.xml": `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:id="@android:id/background">
        <shape android:shape="ring" android:innerRadiusRatio="2.7" android:thicknessRatio="10" android:useLevel="false">
            <solid android:color="#FF2E2E38" />
        </shape>
    </item>
    <item android:id="@android:id/progress">
        <shape android:shape="ring" android:innerRadiusRatio="2.7" android:thicknessRatio="10" android:useLevel="true">
            <solid android:color="#FF5DCAA5" />
        </shape>
    </item>
</layer-list>
`,
  "layout/protrain_widget.xml": `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/pt_w_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="14dp"
    android:background="@drawable/protrain_widget_bg">
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">
        <TextView
            android:id="@+id/pt_w_label"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="TODAY"
            android:textColor="#FFF5A623"
            android:textSize="11sp"
            android:textStyle="bold"
            android:letterSpacing="0.12" />
        <TextView
            android:id="@+id/pt_w_streak"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:background="@drawable/protrain_chip"
            android:paddingLeft="9dp"
            android:paddingRight="9dp"
            android:paddingTop="3dp"
            android:paddingBottom="3dp"
            android:text=""
            android:textColor="#FFF5A623"
            android:textSize="12sp" />
    </LinearLayout>
    <TextView
        android:id="@+id/pt_w_title"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:gravity="bottom"
        android:maxLines="2"
        android:ellipsize="end"
        android:text="ProTrain"
        android:textColor="#FFFFFFFF"
        android:textSize="22sp"
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
</LinearLayout>
`,
  "layout/protrain_widget_b.xml": `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/pt_b_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent">
    <ImageView
        android:id="@+id/pt_b_bg"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:scaleType="fitXY"
        android:src="@drawable/protrain_round" />
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:padding="14dp">
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical">
            <TextView
                android:id="@+id/pt_b_top"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:singleLine="true"
                android:text=""
                android:textColor="#FF1A1A1F"
                android:textSize="12sp"
                android:textStyle="bold" />
            <TextView
                android:id="@+id/pt_b_streak"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:background="@drawable/protrain_chip_dark"
                android:paddingLeft="9dp"
                android:paddingRight="9dp"
                android:paddingTop="3dp"
                android:paddingBottom="3dp"
                android:text=""
                android:textColor="#FF1A1A1F"
                android:textSize="12sp"
                android:textStyle="bold" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:orientation="horizontal"
            android:gravity="center_vertical">
            <TextView
                android:id="@+id/pt_b_check"
                android:layout_width="28dp"
                android:layout_height="28dp"
                android:layout_marginRight="10dp"
                android:background="@drawable/protrain_check_dark"
                android:gravity="center"
                android:text="✓"
                android:textColor="#FFFFFFFF"
                android:textSize="16sp"
                android:textStyle="bold" />
            <TextView
                android:id="@+id/pt_b_title"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:maxLines="2"
                android:ellipsize="end"
                android:text="ProTrain"
                android:textColor="#FF1A1A1F"
                android:textSize="26sp"
                android:textStyle="bold" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical">
            <LinearLayout
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:orientation="horizontal">
            <ImageView
                android:id="@+id/pt_b_s0"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            <ImageView
                android:id="@+id/pt_b_s1"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            <ImageView
                android:id="@+id/pt_b_s2"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            <ImageView
                android:id="@+id/pt_b_s3"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            <ImageView
                android:id="@+id/pt_b_s4"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            <ImageView
                android:id="@+id/pt_b_s5"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            <ImageView
                android:id="@+id/pt_b_s6"
                android:layout_width="0dp"
                android:layout_height="6dp"
                android:layout_weight="1"
                android:layout_marginRight="4dp"
                android:scaleType="fitXY"
                android:src="@drawable/protrain_seg" />
            </LinearLayout>
            <TextView
                android:id="@+id/pt_b_week"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginLeft="6dp"
                android:singleLine="true"
                android:text=""
                android:textColor="#FF3A3A42"
                android:textSize="12sp" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
`,
  "layout/protrain_widget_c.xml": `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/pt_c_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="14dp"
    android:background="@drawable/protrain_widget_bg">
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical">
        <TextView
            android:id="@+id/pt_c_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:singleLine="true"
            android:text="ProTrain"
            android:textColor="#FFFFFFFF"
            android:textSize="19sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/pt_c_streak"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginLeft="8dp"
            android:singleLine="true"
            android:text=""
            android:textColor="#FFF5A623"
            android:textSize="12sp" />
    </LinearLayout>
    <TextView
        android:id="@+id/pt_c_status"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:singleLine="true"
        android:text=""
        android:textColor="#FFB4B4BE"
        android:textSize="12sp" />
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal">
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="M"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d0"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="T"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d1"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="W"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d2"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="T"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d3"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="F"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d4"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="S"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d5"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:orientation="vertical"
            android:gravity="center_horizontal">
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="S"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
            <ImageView
                android:id="@+id/pt_c_d6"
                android:layout_width="22dp"
                android:layout_height="22dp"
                android:layout_marginTop="4dp"
                android:src="@drawable/protrain_dot" />
        </LinearLayout>
    </LinearLayout>
</LinearLayout>
`,
  "layout/protrain_widget_d.xml": `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/pt_d_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal"
    android:gravity="center_vertical"
    android:padding="12dp"
    android:background="@drawable/protrain_widget_bg">
    <FrameLayout
        android:layout_width="76dp"
        android:layout_height="76dp">
        <ProgressBar
            android:id="@+id/pt_d_ring_o"
            style="?android:attr/progressBarStyleHorizontal"
            android:layout_width="76dp"
            android:layout_height="76dp"
            android:rotation="-90"
            android:indeterminate="false"
            android:max="5"
            android:progress="0"
            android:progressDrawable="@drawable/protrain_ring_orange" />
        <ProgressBar
            android:id="@+id/pt_d_ring_g"
            style="?android:attr/progressBarStyleHorizontal"
            android:layout_width="76dp"
            android:layout_height="76dp"
            android:rotation="-90"
            android:indeterminate="false"
            android:max="5"
            android:progress="0"
            android:visibility="gone"
            android:progressDrawable="@drawable/protrain_ring_green" />
        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="match_parent"
            android:orientation="vertical"
            android:gravity="center">
            <TextView
                android:id="@+id/pt_d_num"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="-"
                android:textColor="#FFFFFFFF"
                android:textSize="24sp"
                android:textStyle="bold" />
            <TextView
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:text="streak"
                android:textColor="#FFB4B4BE"
                android:textSize="11sp" />
        </LinearLayout>
    </FrameLayout>
    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="wrap_content"
        android:layout_weight="1"
        android:layout_marginLeft="14dp"
        android:orientation="vertical">
        <TextView
            android:id="@+id/pt_d_label"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:singleLine="true"
            android:text="TODAY"
            android:textColor="#FFB4B4BE"
            android:textSize="11sp"
            android:letterSpacing="0.1" />
        <TextView
            android:id="@+id/pt_d_title"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:singleLine="true"
            android:text="ProTrain"
            android:textColor="#FFFFFFFF"
            android:textSize="18sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/pt_d_week"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginBottom="6dp"
            android:singleLine="true"
            android:text=""
            android:textColor="#FFB4B4BE"
            android:textSize="12sp" />
        <TextView
            android:id="@+id/pt_d_start"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:background="@drawable/protrain_pill_start"
            android:paddingLeft="14dp"
            android:paddingRight="14dp"
            android:paddingTop="4dp"
            android:paddingBottom="4dp"
            android:text="Start"
            android:textColor="#FF1A1A1F"
            android:textSize="13sp"
            android:textStyle="bold" />
        <TextView
            android:id="@+id/pt_d_done"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:background="@drawable/protrain_pill_done"
            android:paddingLeft="14dp"
            android:paddingRight="14dp"
            android:paddingTop="4dp"
            android:paddingBottom="4dp"
            android:visibility="gone"
            android:text="Done ✓"
            android:textColor="#FF5DCAA5"
            android:textSize="13sp"
            android:textStyle="bold" />
    </LinearLayout>
</LinearLayout>
`,
  "xml/protrain_widget_info.xml": `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:minResizeWidth="180dp"
    android:minResizeHeight="90dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:initialLayout="@layout/protrain_widget" />
`,
};
for (const [rel, text] of Object.entries(widgetRes)) {
  const out = path.join(res, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
}
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
