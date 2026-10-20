'use strict';
/* =========================================================
   عامل الخدمة: يعمل التطبيق دون إنترنت (الشبكة أولًا ثم النسخة
   المخزّنة، فتظهر تعديلاتك فورًا)، ويُظهر الإشعارات على الهاتف
   ========================================================= */

const CACHE = 'musaid-v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/style.css',
  'js/core.js', 'js/ui.js', 'js/smart.js', 'js/demo.js', 'js/schedule.js', 'js/sync-config.js', 'js/sync.js', 'js/app.js',
  'js/views/dashboard.js', 'js/views/planner.js', 'js/views/calendar.js', 'js/views/finance.js', 'js/views/subscriptions.js',
  'js/views/habits.js', 'js/views/trackers.js', 'js/views/study.js', 'js/views/life.js', 'js/views/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // مكتبة Firebase للمزامنة: ثابتة لكل إصدار، فتُخزَّن ليعمل التطبيق دون إنترنت
  if (req.method === 'GET' && url.hostname === 'www.gstatic.com' && url.pathname.startsWith('/firebasejs/')) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const c = list[0];
    if (c) { c.postMessage({ view: d.view, params: d.params }); return c.focus(); }
    return self.clients.openWindow('./' + (d.view ? '#' + d.view : ''));
  }));
});
