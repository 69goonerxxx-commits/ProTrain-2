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

// 4. permissions: vibration for the rest timer, notifications + exact alarm for the rest-complete alert
const manPath = path.join(app, 'src', 'main', 'AndroidManifest.xml');
let man = fs.readFileSync(manPath, 'utf8');
must(man.includes('</manifest>'), 'AndroidManifest.xml has no </manifest>');
for (const p of ['VIBRATE', 'POST_NOTIFICATIONS', 'USE_EXACT_ALARM']) {
  if (!man.includes(`android.permission.${p}"`)) man = man.replace('</manifest>', `    <uses-permission android:name="android.permission.${p}" />\n</manifest>`);
}
fs.writeFileSync(manPath, man);

console.log(`prepared: ${pkg.appVersion} (build ${buildNumber}), icons, permissions`);
