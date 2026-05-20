const CACHE_NAME = 'touhou-web-runtime-v10';
const CACHE_PREFIXES = ['touhou-web-mobile-', 'touhou-web-runtime-'];
const ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'src/styles.css',
  'src/vanilla/th06-data.js',
  'src/vanilla/th06-logic.js',
  'src/vanilla/th06-effects-data.js',
  'src/vanilla/th06-runtime.js',
  'src/vanilla/th06-player-data.js',
  'src/vanilla/main.js',
  'assets/th06-img/jpg/title00.jpg',
  'assets/th06-img/jpg/select00.jpg',
  'assets/th06-img/png/stg1bg.png',
  'assets/th06-img/png/stg2bg.png',
  'assets/th06-img/png/stg3bg.png',
  'assets/th06-img/png/stg4bg.png',
  'assets/th06-img/png/stg5bg.png',
  'assets/th06-img/png/stg6bg.png',
  'assets/th06-img/png/front.png',
  'assets/th06-img/png/player00.png',
  'assets/th06-img/png/player01.png',
  'assets/th06-img/png/stg1enm.png',
  'assets/th06-img/png/stg1enm2.png',
  'assets/th06-img/png/stg2enm.png',
  'assets/th06-img/png/stg2enm2.png',
  'assets/th06-img/png/stg3enm.png',
  'assets/th06-img/png/stg4enm.png',
  'assets/th06-img/png/stg5enm.png',
  'assets/th06-img/png/stg5enm2.png',
  'assets/th06-img/png/stg6enm.png',
  'assets/th06-img/png/stg6enm2.png',
  'assets/th06-img/png/etama3.png',
  'assets/th06-img/png/etama4.png',
  'assets/th06-img/png/eff01.png',
  'assets/th06-img/png/eff02.png',
  'assets/th06-img/png/eff03.png',
  'assets/th06-img/png/eff04.png',
  'assets/th06-img/png/eff05.png',
  'assets/th06-img/png/face00a.png',
  'assets/th06-img/png/face00b.png',
  'assets/th06-img/png/face00c.png',
  'assets/th06-img/png/face01a.png',
  'assets/th06-img/png/face01b.png',
  'assets/th06-img/png/face01c.png',
  'assets/th06-img/png/face03a.png',
  'assets/th06-img/png/face03b.png',
  'assets/th06-img/png/face05a.png',
  'assets/th06-img/png/face06a.png',
  'assets/th06-img/png/face06b.png',
  'assets/th06-img/png/face08a.png',
  'assets/th06-img/png/face08b.png',
  'assets/th06-img/png/face09a.png',
  'assets/th06-img/png/face09b.png',
  'assets/th06-img/png/face10a.png',
  'assets/th06-img/png/face10b.png',
  'assets/pwa/apple-touch-icon.png',
  'assets/pwa/icon-192.png',
  'assets/pwa/icon-512.png',
  'assets/pwa/icon-1024.png',
  'assets/audio/stage1.ogg',
  'assets/audio/boss1.ogg',
  'assets/audio/th06_04.ogg',
  'assets/audio/th06_05.ogg',
  'assets/audio/th06_06.ogg',
  'assets/audio/th06_07.ogg',
  'assets/audio/th06_08.ogg',
  'assets/audio/th06_09.ogg',
  'assets/audio/th06_10.ogg',
  'assets/audio/th06_11.ogg',
  'assets/audio/th06_12.ogg',
  'assets/audio/th06_13.ogg',
  'assets/sfx/plst00.wav',
  'assets/sfx/enep00.wav',
  'assets/sfx/pldead00.wav',
  'assets/sfx/power0.wav',
  'assets/sfx/power1.wav',
  'assets/sfx/tan00.wav',
  'assets/sfx/tan01.wav',
  'assets/sfx/tan02.wav',
  'assets/sfx/ok00.wav',
  'assets/sfx/cancel00.wav',
  'assets/sfx/select00.wav',
  'assets/sfx/gun00.wav',
  'assets/sfx/cat00.wav',
  'assets/sfx/lazer00.wav',
  'assets/sfx/lazer01.wav',
  'assets/sfx/enep01.wav',
  'assets/sfx/nep00.wav',
  'assets/sfx/damage00.wav',
  'assets/sfx/item00.wav',
  'assets/sfx/kira00.wav',
  'assets/sfx/kira01.wav',
  'assets/sfx/kira02.wav',
  'assets/sfx/extend.wav',
  'assets/sfx/timeout.wav',
  'assets/sfx/graze.wav',
  'assets/sfx/powerup.wav'
];
const BOOT_ASSETS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'sw.js',
  'src/styles.css',
  'src/vanilla/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(BOOT_ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.all([
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key !== CACHE_NAME && CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
      .map((key) => caches.delete(key)))),
    self.clients.claim()
  ]));
});

function runtimeUrl(url) {
  const parsed = new URL(url);
  return !parsed.searchParams.has('test');
}

async function handlesRequest(event) {
  if (event.request.mode === 'navigate') return runtimeUrl(event.request.url);
  if (!event.clientId) return false;
  const client = await self.clients.get(event.clientId);
  return client ? runtimeUrl(client.url) : false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    handlesRequest(event).then((enabled) => {
      if (!enabled) return fetch(request);
      if (request.mode === 'navigate') return fetch(request).catch(() => caches.match('index.html'));
      return caches.match(request);
    }).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
