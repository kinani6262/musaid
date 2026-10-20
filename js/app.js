'use strict';
/* =========================================================
   هيكل التطبيق: القائمة، المظهر، مركز التنبيهات، الاختصارات، التشغيل
   ========================================================= */

const NAV = [
  { g: '', items: [{ id: 'dashboard', t: 'لوحة اليوم', i: 'home', c: '#8b5cf6' }] },
  { g: 'التخطيط', items: [
    { id: 'day', t: 'جدول اليوم', i: 'day', c: '#3b82f6' },
    { id: 'week', t: 'الجدول الأسبوعي', i: 'week', c: '#06b6d4' },
    { id: 'month', t: 'خطة الشهر', i: 'month', c: '#14b8a6' },
    { id: 'calendar', t: 'التقويم', i: 'calendar', c: '#6366f1' },
  ] },
  { g: 'الحياة', items: [
    { id: 'habits', t: 'صناعة العادات', i: 'flame', c: '#f97316' },
    { id: 'trackers', t: 'المتابعة اليومية', i: 'tracker', c: '#10b981' },
    { id: 'goals', t: 'الأهداف', i: 'target', c: '#ec4899' },
    { id: 'health', t: 'العافية', i: 'heart', c: '#ef4444' },
    { id: 'journal', t: 'المذكرات', i: 'journal', c: '#eab308' },
  ] },
  { g: 'المال', items: [
    { id: 'finance', t: 'المصاريف والأموال', i: 'wallet', c: '#22c55e' },
    { id: 'subs', t: 'الاشتراكات', i: 'repeat', c: '#f43f5e' },
  ] },
  { g: 'التعلّم', items: [
    { id: 'study', t: 'الدراسة', i: 'study', c: '#a855f7' },
    { id: 'reading', t: 'القراءة', i: 'book', c: '#f59e0b' },
  ] },
];

function navBadge(id) {
  const s = App.state, today = D.today();
  if (id === 'day') { const st = T.stats(today); const n = st.total - st.done; return n ? `<span class="badge">${n}</span>` : ''; }
  if (id === 'habits') { const n = s.habits.filter(h => !h.archived && Habits.isDue(h, today) && !Habits.isDoneOn(h, today)).length; return n ? `<span class="badge">${n}</span>` : ''; }
  if (id === 'subs') { const n = s.subscriptions.filter(x => x.active !== false && x.next && D.diff(today, x.next) <= 3 && D.diff(today, x.next) >= 0).length; return n ? `<span class="badge bad">${n}</span>` : ''; }
  if (id === 'study') { const n = s.exams.filter(x => { const d = D.diff(today, x.date); return d >= 0 && d <= 7; }).length; return n ? `<span class="badge ac">${n}</span>` : ''; }
  if (id === 'calendar') { const n = T.overdue().length; return n ? `<span class="badge bad" title="مهام متأخرة">${n}</span>` : ''; }
  return '';
}

App.renderChrome = function () {
  const cur = App.view;
  $('#nav').innerHTML = NAV.map(g => `${g.g ? `<div class="nav-group-t">${g.g}</div>` : ''}${g.items.map(it => `
    <button class="nav-item ${cur === it.id ? 'on' : ''}" style="--c:${it.c}" data-act="nav" data-view="${it.id}">
      <span class="ni">${ic(it.i)}</span><span>${it.t}</span><span class="nb">${navBadge(it.id)}</span>
    </button>`).join('')}`).join('');
  const st = T.stats(D.today());
  $('#sidebar-foot').innerHTML = `
    <div class="card flat" style="padding:12px;margin-bottom:8px;background:var(--surface-2)">
      <div class="flex between small"><span class="muted">إنجاز اليوم</span><b>${st.pct}%</b></div>
      ${App.bar(st.pct, '', 'thin')}
    </div>
    <button class="nav-item ${cur === 'settings' ? 'on' : ''}" style="--c:#64748b" data-act="nav" data-view="settings"><span class="ni">${ic('settings')}</span><span>الإعدادات</span></button>`;
  const unread = App.state.inbox.filter(x => !x.read).length;
  $('#btn-bell').innerHTML = ic('bell') + (unread ? `<span class="dot">${unread > 9 ? '9+' : unread}</span>` : '');
  $('#btn-theme').innerHTML = ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon');
  const today = D.today();
  $('#top-date').textContent = D.fmt(today) + (S().showHijri ? ' · ' + D.hijri(today) : '');
  const bn = [['dashboard', 'home', 'الرئيسية'], ['day', 'day', 'اليوم'], ['calendar', 'calendar', 'التقويم'], ['finance', 'wallet', 'المال'], ['_more', 'menu', 'المزيد']];
  $('#bottomnav').innerHTML = bn.map(([id, i, t]) => `<button class="bn ${cur === id ? 'on' : ''}" data-act="${id === '_more' ? 'toggle-sidebar' : 'nav'}" data-view="${id}">${ic(i)}<span>${t}</span></button>`).join('');
  App.localize($('#sidebar'));
  App.localize($('#topbar'));
};

App.applyTheme = function () {
  const st = S();
  let theme = st.theme;
  if (theme === 'auto') theme = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.accent = st.accent || 'violet';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = theme === 'dark' ? '#0b0d1b' : '#f3f4fa';
};

/* ---------- أفعال الهيكل ---------- */
App.on('nav', el => App.go(el.dataset.view));
App.on('toggle-sidebar', () => document.body.classList.toggle('nav-open'));
App.on('quick-add', () => App.quickAdd());
App.on('open-search', () => App.search());
App.on('toggle-theme', () => {
  const cur = document.documentElement.dataset.theme;
  S().theme = cur === 'dark' ? 'light' : 'dark';
  App.save(); App.applyTheme(); App.renderChrome(); App.mountCharts(); App.localize($('#view'));
});
App.on('open-inbox', () => {
  if ($('#popover-root .pop')) { App.closePopover(); return; }
  const items = App.state.inbox;
  const pop = App.popover(`
    <div class="pop-h"><b>التنبيهات</b><div class="flex">${items.length ? `<button class="btn btn-sm btn-ghost" data-act="inbox-read">تحديد الكل كمقروء</button><button class="icon-btn sm" data-act="inbox-clear" data-tip="مسح الكل">${ic('trash')}</button>` : ''}</div></div>
    ${items.length ? items.map(x => `<div class="inbox-item ${x.read ? '' : 'unread'}" data-act="inbox-open" data-id="${x.id}"><span class="ie">${x.icon || '🔔'}</span><div class="grow"><div class="small bold">${esc(x.title)}</div>${x.body ? `<div class="small text-2">${esc(x.body)}</div>` : ''}<div class="tiny muted">${timeAgo(x.time)}</div></div></div>`).join('')
      : App.empty('🔕', 'لا تنبيهات', 'ستظهر هنا تذكيرات المواعيد والتجديدات')}
    ${'Notification' in window && Notification.permission === 'default' ? `<div style="padding:12px 16px"><button class="btn btn-sm btn-soft btn-block" data-act="ask-notify">🔔 تفعيل إشعارات النظام</button></div>` : ''}`);
  return pop;
});
function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return 'منذ ' + m + ' دقيقة';
  const h = Math.round(m / 60);
  if (h < 24) return 'منذ ' + h + ' ساعة';
  return 'منذ ' + daysAr(Math.round(h / 24));
}
App.on('inbox-open', el => {
  const x = byId(App.state.inbox, el.dataset.id);
  if (!x) return;
  x.read = true;
  App.save();
  App.closePopover();
  if (x.view) App.go(x.view, x.params || {}); else App.renderChrome();
});
App.on('inbox-read', () => { App.state.inbox.forEach(x => { x.read = true; }); App.save(); App.closePopover(); App.renderChrome(); });
App.on('inbox-clear', () => { App.state.inbox = []; App.save(); App.closePopover(); App.renderChrome(); });

/* ---------- لوحة المفاتيح ---------- */
document.addEventListener('keydown', e => {
  const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable]');
  if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); App.closeAllModals(); App.search(); return; }
  if (e.key === 'Escape') {
    if (App.closeTopModal()) return;
    App.closePopover();
    document.body.classList.remove('nav-open');
    return;
  }
  if (typing || e.ctrlKey || e.metaKey || e.altKey || $('#modal-root .modal-back')) return;
  const k = e.key.toLowerCase();
  if (k === 'n' || e.key === 'ى') { e.preventDefault(); App.quickAdd(); }
  else if (k === 't' || e.key === 'ف') App.acts['toggle-theme']();
  else if (/^[1-5]$/.test(e.key)) App.go(['dashboard', 'day', 'week', 'month', 'calendar'][Number(e.key) - 1]);
  else if (k === '/') { e.preventDefault(); App.search(); }
});

/* ---------- الترحيب ---------- */
App.onboard = function () {
  const m = App.form({
    title: 'أهلًا بك', icon: '👋', autofocus: false,
    intro: `<div class="onb-hero"><div class="brand-logo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg></div>
      <h2>مُساعِد — منظّم حياتك</h2><p class="muted small mt-s">جداول ذكية ليومك وأسبوعك وشهرك، مع المال والاشتراكات والعادات والدراسة… في مكان واحد</p></div>
      <div class="feature-list"><div>📅 جدول يومي وأسبوعي وخطة شهرية</div><div>✨ إضافة بلغة طبيعية وترتيب تلقائي</div><div>🔔 تذكير قبل المواعيد بيوم</div><div>💰 مصاريف، ميزانية، ادخار، ديون</div><div>🔁 الاشتراكات وتجديداتها</div><div>🔥 العادات والمتابعة اليومية</div><div>🕌 مواقيت الصلاة والتاريخ الهجري</div><div>🎓 مؤقّت تركيز وامتحانات وواجبات</div></div>`,
    values: { city: S().prayer.city, currency: S().currency, demo: false },
    fields: [
      { name: 'name', label: 'ما اسمك؟', placeholder: 'اسمك الأول' },
      { type: 'row', fields: [
        { name: 'city', label: 'مدينتك (لمواقيت الصلاة)', type: 'select', options: Prayer.CITIES.map(c => [c[0], c[1]]) },
        { name: 'currency', label: 'العملة', type: 'select', options: CURRENCIES },
      ] },
      { name: 'demo', label: 'استبدل جدولي ببيانات تجريبية للاستكشاف', type: 'switch', hint: 'جدولك الأسبوعي مضاف مسبقًا، فاترك هذا الخيار مطفأً. ويمكنك إعادة تحميل الجدول من الإعدادات' },
    ],
    submit: 'لنبدأ — بسم الله',
    extraBtn: App.sync.enabled() ? '<button type="button" class="btn btn-ghost" data-act="sync-login-onb">☁️ لدي حساب مزامنة</button>' : '',
    onSubmit(v) {
      const st = S();
      st.name = v.name;
      st.currency = v.currency;
      const c = Prayer.CITIES.find(x => x[0] === v.city);
      if (c) Object.assign(st.prayer, { city: c[0], lat: c[2], lng: c[3], method: c[4] });
      st.onboarded = true;
      Prayer._cache = {};
      if (v.demo) App.loadDemo();
      else { App.save(); App.render(true); }
      setTimeout(() => {
        App.toast(`أهلًا ${v.name || ''}! اضغط N في أي وقت لإضافة سريعة`, { icon: '🎉', ms: 5000 });
        if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().then(() => App.renderChrome());
      }, 400);
    },
  });
  $('.modal-h .icon-btn', m.el).remove();
};

/* ---------- التشغيل ---------- */
App.init = function () {
  App.load();
  const replaced = App.ensureSchedule();
  App.processSubscriptions();
  App.applyTheme();
  $('[data-act="toggle-sidebar"]').innerHTML = ic('menu');
  $('#btn-search').innerHTML = ic('search');
  $('#btn-quick').innerHTML = ic('plus') + ' إضافة سريعة';
  $('#fab').innerHTML = ic('plus');
  $('#scrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
  const start = location.hash.slice(1);
  App.view = null;
  App.go(App.views[start] ? start : 'dashboard');
  if (!S().onboarded) App.onboard();
  else if (replaced) setTimeout(() => App.toast('أُضيف جدولك الأسبوعي وحُذفت البيانات السابقة (نسخة منها محفوظة في الإعدادات)', { icon: '📅', undo: () => { App.restoreOldData(); } }), 600);

  // عامل الخدمة: تثبيت التطبيق على الهاتف، والعمل دون إنترنت، والإشعارات في أندرويد
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.view) App.go(e.data.view, e.data.params || {}); });
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); App._install = e; if (App.view === 'settings') App.refresh(); });

  setTimeout(App.checkReminders, 1500);
  setInterval(App.checkReminders, 30000);
  setInterval(App.timerTick, 1000);
  let lastDay = D.today(), lastMin = D.nowMin();
  setInterval(() => {
    const busy = $('#modal-root .modal-back') || (document.activeElement && document.activeElement.closest('input, textarea, select'));
    if (D.today() !== lastDay) { lastDay = D.today(); App.processSubscriptions(); if (!busy) App.render(false); return; }
    if (D.nowMin() !== lastMin) {
      lastMin = D.nowMin();
      if (!busy && ['dashboard', 'day'].includes(App.view) && !document.hidden) App.refresh();
    }
  }, 15000);
  window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v && v !== App.view && App.views[v]) App.go(v); });
  window.addEventListener('storage', e => { if (e.key === STORE_KEY) { App.load(); App.applyTheme(); App.refresh(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) App.checkReminders(); });
  if (window.matchMedia) matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (S().theme === 'auto') { App.applyTheme(); App.refresh(); } });
};

App.init();
