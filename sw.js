const CACHE = 'protrain-v8-1-0';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=Barlow:wght@400;500;600&display=swap';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all([
        c.addAll(CORE),
        c.add(FONT_CSS).catch(() => {})   // fonts are optional; never fail install on them
      ]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function put(req, res) {
  if (res && res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(req, clone)); }
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never cache or intercept API calls (YouTube key lives in the URL)
  if (url.hostname === 'www.googleapis.com' || url.hostname.endsWith('youtube.com')) return;
  // The app's own "is there a new version?" check must reach the network
  if (url.searchParams.has('_v')) return;

  if (req.mode === 'navigate') {
    // Network-first with a 3s timeout so a weak signal falls back to the cached copy fast
    e.respondWith(
      Promise.race([
        fetch(req).then(res => put(req, res)),
        new Promise((_, rej) => setTimeout(rej, 3000))
      ]).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => put(req, res)))
  );
});
