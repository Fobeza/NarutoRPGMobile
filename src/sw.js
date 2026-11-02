// Service Worker «Воля Огня»: кэширует игру при первом запуске → дальше работает без интернета.
// Стратегия: сначала кэш (мгновенный запуск), в фоне — проверка обновления.
// Всё, что нужно для старта (index.html + art/runtime/*.js), лежит в FILES, поэтому в офлайне игра
// поднимается целиком; меняется версия — старый кэш удаляется в activate.
const CACHE = 'wof-__VERSION__';
// Список файлов игры; данные арта build.py дописывает сам (арт вынесен из index.html).
const FILES = ['./', './index.html', './sw.js'/*__ART_FILES__*/];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wof-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request, { ignoreSearch: true });
      const network = fetch(e.request)
        .then((res) => { if (res && res.ok) cache.put(e.request, res.clone()); return res; })
        .catch(() => null);
      return cached || (await network) || new Response('Нет сети', { status: 503 });
    })
  );
});
