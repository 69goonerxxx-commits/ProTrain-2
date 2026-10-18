// Collects the web files for the Android app into www/.
// index.html stays exactly as you edit it; everything Android-specific is applied here, and the build stops with an error if any expected line is not found (so a future edit cannot silently break the shell).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.dirname(new URL(import.meta.url).pathname);
const www = path.join(root, 'www');
fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'fonts'), { recursive: true });

let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function swap(label, from, to) {
  if (!html.includes(from)) throw new Error('build-www: could not find ' + label + ' in index.html. Update build-www.mjs to match.');
  html = html.replace(from, () => to);
}
function swapRe(label, re, to) {
  if (!re.test(html)) throw new Error('build-www: could not find ' + label + ' in index.html. Update build-www.mjs to match.');
  html = html.replace(re, () => to);
}

// PWA-only bits: not used inside the app
swap('manifest link', '<link rel="manifest" href="manifest.json"/>', '');
swap('apple-touch-icon link', '<link rel="apple-touch-icon" href="icon-192.png"/>', '');

// Google Fonts -> fonts bundled in the app (so they work offline)
swapRe('Google Fonts link', /<link href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/, '<link rel="stylesheet" href="fonts.css"/>');

// the export toasts are replaced by the shim, which knows where the file actually went
swap('auto-backup toast', "if(auto===true)showToast('Automatic backup saved to your downloads','var(--success)');", '');
swap('backup message', "'Backup downloaded!'", "'Backup exported!'");
swap('auto-backup message', "'Automatic backup downloaded.'", "'Automatic backup saved.'");

// shim: early (head) and late (end of body)
const early = fs.readFileSync(path.join(root, 'shim-early.js'), 'utf8');
const late = fs.readFileSync(path.join(root, 'shim-late.js'), 'utf8');
swap('<head>', '<head>', '<head>\n<script>\n' + early + '</script>');
swap('</body>', '</body>', '<script>\n' + late + '</script>\n</body>');

// every inline script must still parse after the patches
for (const m of html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)) {
  try { new vm.Script(m[1]); } catch (e) { throw new Error('build-www: patched index.html has a syntax error: ' + e.message); }
}

fs.writeFileSync(path.join(www, 'index.html'), html);

// fonts: copied from the npm packages, latin subset
const faces = [
  ['barlow', 'Barlow', [400, 500, 600]],
  ['barlow-condensed', 'Barlow Condensed', [400, 600, 700, 800]],
];
let css = '';
for (const [pkg, family, weights] of faces) {
  for (const w of weights) {
    const file = `${pkg}-latin-${w}-normal.woff2`;
    const from = path.join(root, 'node_modules', '@fontsource', pkg, 'files', file);
    if (!fs.existsSync(from)) throw new Error('build-www: font file missing: ' + from);
    fs.copyFileSync(from, path.join(www, 'fonts', file));
    css += `@font-face{font-family:'${family}';font-style:normal;font-weight:${w};font-display:swap;src:url(fonts/${file}) format('woff2');}\n`;
  }
}
fs.writeFileSync(path.join(www, 'fonts.css'), css);

console.log('www/ ready: index.html + fonts (' + (css.split('\n').length - 1) + ' faces)');
