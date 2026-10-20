'use strict';
/* =========================================================
   المزامنة بين الأجهزة عبر Firebase: حساب بالبريد وكلمة المرور،
   ومستند واحد لكل مستخدم فيه كل بياناته، يصل تعديله لحظيًا إلى
   بقية الأجهزة. عند الاختلاف يغلب الأحدث تعديلًا.
   سجلّ التنبيهات (inbox وnotified) يبقى لكل جهاز وحده، حتى يُنبَّه
   كل جهاز بنفسه.
   ========================================================= */

const FB_VER = '10.14.1';
const SYNC_AT_KEY = 'musaid-sync-at';              // وقت آخر تعديل محلي، أو آخر نسخة وصلت من السحابة
const SYNC_BACKUP_KEY = 'musaid-data-before-sync'; // بيانات الجهاز قبل أول دخول
const DEVICE_KEY = 'musaid-device';
const LOCAL_ONLY = ['inbox', 'notified'];
const SYNC_MAX_BYTES = 1000000;                    // حدّ المستند في Firestore نحو 1 ميغابايت

ICONS.cloud = '<path d="M17.5 19H7a5 5 0 1 1 .9-9.92A6.5 6.5 0 0 1 20.4 11 4 4 0 0 1 17.5 19z"/>';

const Sync = App.sync = {
  ready: false,     // تحمّلت مكتبة Firebase
  user: null,
  status: 'off',    // off | loading | signed-out | syncing | synced | offline | error
  error: '',
  lastSync: 0,
  _db: null, _unsub: null, _timer: null, _pending: null, _fresh: false, _lastPayload: null, _gesture: 0,
};

Sync.enabled = () => !!(typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey);

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
  } catch (e) { /* */ }
  return null;
}
const localAt = () => Number(ls(SYNC_AT_KEY)) || 0;
const setLocalAt = t => ls(SYNC_AT_KEY, String(t));
const deviceId = () => ls(DEVICE_KEY) || (ls(DEVICE_KEY, uid()), ls(DEVICE_KEY));

function syncPayload() {
  const o = Object.assign({}, App.state);
  LOCAL_ONLY.forEach(k => delete o[k]);
  return JSON.stringify(o);
}

/* التعديل الذي يُحسب «أحدث» هو ما فعله المستخدم بيده. أما ما يحفظه التطبيق
   وحده عند الفتح (تجديد الاشتراكات، التذكيرات) فلا يغلب نسخة أحدث في السحابة */
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { Sync._gesture = Date.now(); }, true));

const _localSave = App.save;
App.save = function () {
  _localSave();
  if (Sync._applying) return;
  const p = syncPayload();
  if (p === Sync._lastPayload) return;
  Sync._lastPayload = p;
  if (Date.now() - Sync._gesture > 10000) return;
  setLocalAt(Date.now());
  if (Sync.user) Sync.schedulePush();
};

/* ---------- التشغيل ---------- */
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => { s.remove(); rej(new Error(src)); };
    document.head.appendChild(s);
  });
}

Sync.start = async function () {
  if (!Sync.enabled() || Sync.ready || Sync.status === 'loading') return;
  if (Sync._lastPayload === null) Sync._lastPayload = syncPayload();
  Sync.setStatus('loading');
  try {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    if (!window.firebase) await loadScript(base + 'firebase-app-compat.js');
    if (!firebase.auth) await loadScript(base + 'firebase-auth-compat.js');
    if (!firebase.firestore) await loadScript(base + 'firebase-firestore-compat.js');
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    Sync._db = firebase.firestore();
    Sync.ready = true;
  } catch (e) {
    // دون إنترنت في أول فتح: يعمل التطبيق عاديًا، وتبدأ المزامنة عند عودة الاتصال
    Sync.setStatus('offline');
    window.addEventListener('online', () => Sync.start(), { once: true });
    return;
  }
  firebase.auth().onAuthStateChanged(u => {
    Sync.user = u;
    if (Sync._unsub) { Sync._unsub(); Sync._unsub = null; }
    if (u) Sync.listen(); else Sync.setStatus('signed-out');
  });
};

Sync.doc = () => Sync._db.collection('users').doc(Sync.user.uid);

Sync.listen = function () {
  if (Sync._fresh) {
    // أول دخول في هذا الجهاز: بيانات الحساب هي المرجع، ونحتفظ بنسخة من بيانات الجهاز
    Sync._fresh = false;
    ls(SYNC_BACKUP_KEY, JSON.stringify(App.state));
    setLocalAt(0);
  }
  Sync.setStatus('syncing');
  Sync._unsub = Sync.doc().onSnapshot({ includeMetadataChanges: true }, snap => {
    if (snap.metadata.hasPendingWrites) return;
    if (snap.metadata.fromCache) { Sync.setStatus(navigator.onLine ? 'syncing' : 'offline'); return; }
    Sync.lastSync = Date.now();
    if (!snap.exists) { Sync.push(); return; }
    const r = snap.data(), la = localAt();
    if (r.data === syncPayload() || r.at === la) { if (!la) setLocalAt(r.at); Sync.setStatus('synced'); return; }
    if (r.at > la) Sync.queueApply(r);
    else Sync.schedulePush(0);
  }, err => Sync.setStatus('error', err));
};

/* ---------- الرفع ---------- */
Sync.schedulePush = function (ms = 1200) {
  clearTimeout(Sync._timer);
  Sync._timer = setTimeout(Sync.push, ms);
  Sync.setStatus('syncing');
};

Sync.push = async function () {
  clearTimeout(Sync._timer);
  Sync._timer = null;
  if (!Sync.user || !Sync._db) return;
  const data = syncPayload();
  if (new Blob([data]).size > SYNC_MAX_BYTES) { Sync.setStatus('error', { code: 'too-big' }); return; }
  let at = localAt();
  if (!at) { at = Date.now(); setLocalAt(at); }
  Sync.setStatus(navigator.onLine ? 'syncing' : 'offline');
  try {
    await Sync.doc().set({ data, at, client: deviceId(), updated: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (e) { Sync.setStatus('error', e); }
};

// لا تضيع تعديلات الثواني الأخيرة عند إغلاق التطبيق
const flush = () => { if (Sync._timer) Sync.push(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', flush);

/* ---------- استقبال نسخة أحدث ---------- */
const busy = () => $('#modal-root .modal-back') || (document.activeElement && document.activeElement.closest('input, textarea, select, [contenteditable]'));

Sync.queueApply = function (r) {
  Sync._pending = r;
  if (Sync._waiting) return;
  const tryApply = () => {
    if (busy()) { Sync._waiting = setTimeout(tryApply, 1500); return; }
    Sync._waiting = null;
    const x = Sync._pending;
    Sync._pending = null;
    if (x && x.at > localAt()) Sync.apply(x);
  };
  tryApply();
};

Sync.apply = function (r) {
  let data;
  try { data = JSON.parse(r.data); } catch (e) { return; }
  const first = !localAt();
  LOCAL_ONLY.forEach(k => { data[k] = App.state[k]; });
  Sync._applying = true;
  App.state = App.merge(App.defaults(), data);
  _localSave();
  Sync._applying = false;
  Sync._lastPayload = syncPayload();
  setLocalAt(r.at);
  if (typeof Prayer !== 'undefined') Prayer._cache = {};
  App.applyTheme();
  App.render(false);
  Sync.setStatus('synced');
  App.toast(first ? 'ظهرت بياناتك من حسابك، والمزامنة تعمل' : 'وصلت تعديلات من جهازك الآخر', { icon: '☁️' });
};

/* ---------- الحالة ---------- */
const ERRORS = {
  'auth/invalid-credential': 'البريد أو كلمة المرور غير صحيحة',
  'auth/invalid-login-credentials': 'البريد أو كلمة المرور غير صحيحة',
  'auth/wrong-password': 'كلمة المرور غير صحيحة',
  'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
  'auth/email-already-in-use': 'هذا البريد له حساب من قبل، استعمل «تسجيل الدخول»',
  'auth/weak-password': 'كلمة المرور قصيرة: 6 أحرف على الأقل',
  'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
  'auth/missing-password': 'اكتب كلمة المرور',
  'auth/network-request-failed': 'لا يوجد اتصال بالإنترنت',
  'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلًا ثم أعد المحاولة',
  'auth/operation-not-allowed': 'تسجيل الدخول بالبريد غير مفعّل في Firebase (Authentication ← Sign-in method)',
  'permission-denied': 'Firestore رفض الوصول: راجع القواعد (Rules) في Firebase',
  'too-big': 'البيانات أكبر من حدّ المزامنة (1 ميغابايت)، صدّر نسخة احتياطية واحذف القديم',
};
const errText = e => (e && (ERRORS[e.code] || e.message)) || 'حدث خطأ غير متوقع';

Sync.setStatus = function (s, err) {
  Sync.status = s;
  Sync.error = err ? errText(err) : '';
  Sync.renderPill();
  if (App.view === 'settings' && !busy()) App.refresh();
};

const STATUS = {
  loading: ['⏳', 'جارٍ الاتصال بخدمة المزامنة…', 'var(--text-2)'],
  'signed-out': ['🔒', 'لم تسجّل الدخول في هذا الجهاز', 'var(--text-2)'],
  syncing: ['⏳', 'جارٍ المزامنة…', 'var(--warn)'],
  synced: ['✅', 'متزامن', 'var(--good)'],
  offline: ['📴', 'دون إنترنت: تُحفظ تعديلاتك وتُرفع عند عودة الاتصال', 'var(--warn)'],
  error: ['⚠️', 'تعذّرت المزامنة', 'var(--bad)'],
};

Sync.renderPill = function () {
  const el = $('#sync-pill');
  if (!el) return;
  if (!Sync.enabled() || !Sync.user) { el.innerHTML = ''; return; }
  const [, t, c] = STATUS[Sync.status] || STATUS.syncing;
  el.innerHTML = `<button class="icon-btn sync-btn" style="--c:${c}" data-act="nav" data-view="settings" title="${esc(t)}" aria-label="${esc(t)}">${ic('cloud')}<span class="sync-dot"></span></button>`;
};

Sync.cardHtml = function () {
  if (!Sync.enabled()) return '';
  const [e, t] = STATUS[Sync.status] || ['', ''];
  const backup = ls(SYNC_BACKUP_KEY);
  let body;
  if (Sync.user) {
    body = `
      <div class="toggle-row"><div><div class="bold small">${e} ${t}</div>
        <div class="tiny muted">الحساب: <span class="keep-latn">${esc(Sync.user.email || '')}</span>${Sync.lastSync ? ` · آخر اتصال ${D.time(pad2(new Date(Sync.lastSync).getHours()) + ':' + pad2(new Date(Sync.lastSync).getMinutes()))}` : ''}</div>
        ${Sync.error ? `<div class="tiny bad">${esc(Sync.error)}</div>` : ''}</div></div>
      <div class="flex flex-wrap mt-s">
        <button class="btn btn-sm btn-soft" data-act="sync-now">${ic('upload')} اجعل بيانات هذا الجهاز هي المرجع</button>
        ${backup ? `<button class="btn btn-sm btn-ghost" data-act="sync-restore">↩️ بيانات الجهاز قبل الدخول</button>` : ''}
        <button class="btn btn-sm btn-ghost" data-act="sync-logout">تسجيل الخروج</button>
      </div>
      <div class="tiny muted mt-s">كل تعديل هنا يصل إلى أجهزتك الأخرى خلال ثوانٍ، وإن كنت دون إنترنت يُرفع عند عودة الاتصال. التنبيهات يُصدرها كل جهاز بنفسه.</div>`;
  } else {
    body = `
      <div class="small text-2 mb">${Sync.status === 'loading' ? t : Sync.status === 'offline' ? 'تحتاج اتصالًا بالإنترنت لتسجيل الدخول.' : 'سجّل الدخول بالحساب نفسه في كل أجهزتك، فتتطابق بياناتها تلقائيًا.'}</div>
      <div class="flex flex-wrap">
        <button class="btn btn-sm btn-primary" data-act="sync-login" ${Sync.ready ? '' : 'disabled'}>تسجيل الدخول</button>
        <button class="btn btn-sm" data-act="sync-signup" ${Sync.ready ? '' : 'disabled'}>إنشاء حساب</button>
      </div>
      <div class="tiny muted mt-s">أنشئ الحساب مرة واحدة من الجهاز الذي فيه بياناتك الصحيحة، ثم سجّل الدخول في الأجهزة الأخرى.</div>`;
  }
  return `<div class="card"><div class="card-t mb">☁️ المزامنة بين الأجهزة</div>${body}</div>`;
};

/* ---------- الحساب ---------- */
function authForm({ title, intro, submit, confirm, onOk }) {
  if (!Sync.ready) { App.toast('خدمة المزامنة غير متاحة الآن، تأكد من الاتصال بالإنترنت', { icon: '📴' }); return; }
  const fields = [
    { name: 'email', label: 'البريد الإلكتروني', type: 'email', required: true, placeholder: 'name@example.com' },
    { name: 'pass', label: 'كلمة المرور', type: 'password', required: true },
  ];
  if (confirm) fields.push({ name: 'pass2', label: 'أعد كتابة كلمة المرور', type: 'password', required: true });
  const m = App.form({
    title, icon: '☁️', size: 'narrow', submit,
    intro: `<div class="small text-2 mb">${intro}</div>`,
    extraBtn: confirm ? '' : '<button type="button" class="btn btn-sm btn-ghost" data-forgot>نسيت كلمة المرور؟</button>',
    fields,
    onSubmit(v, modal) {
      if (confirm && v.pass !== v.pass2) { App.toast('كلمتا المرور غير متطابقتين', { icon: '✋' }); return false; }
      const btn = $('[data-fsub]', modal.el);
      btn.disabled = true;
      onOk(v.email, v.pass)
        .then(() => modal.close())
        .catch(e => { Sync._fresh = false; btn.disabled = false; App.toast(errText(e), { icon: '⛔', ms: 6000 }); });
      return false;
    },
  });
  const forgot = $('[data-forgot]', m.el);
  if (forgot) forgot.addEventListener('click', () => {
    const email = $('form', m.el).elements.email.value.trim();
    if (!email) { App.toast('اكتب بريدك أولًا، ثم اضغط «نسيت كلمة المرور»', { icon: '✋' }); return; }
    firebase.auth().sendPasswordResetEmail(email)
      .then(() => App.toast('أُرسل إلى بريدك رابط لتعيين كلمة مرور جديدة', { icon: '📧', ms: 6000 }))
      .catch(e => App.toast(errText(e), { icon: '⛔' }));
  });
}

Sync.loginForm = () => authForm({
  title: 'تسجيل الدخول', submit: 'دخول',
  intro: 'بعد الدخول تظهر بيانات حسابك في هذا الجهاز مكان بياناته الحالية، وتبقى نسخة من بيانات الجهاز تستعيدها من الإعدادات إن احتجت.',
  onOk: (email, pass) => { Sync._fresh = true; return firebase.auth().signInWithEmailAndPassword(email, pass); },
});
Sync.signupForm = () => authForm({
  title: 'إنشاء حساب للمزامنة', submit: 'إنشاء الحساب', confirm: true,
  intro: 'تُرفع بيانات هذا الجهاز إلى حسابك الجديد، ثم تسجّل الدخول به في أجهزتك الأخرى. كلمة المرور 6 أحرف على الأقل.',
  onOk: (email, pass) => firebase.auth().createUserWithEmailAndPassword(email, pass).then(() => App.toast('أُنشئ حسابك ورُفعت بياناتك', { icon: '☁️' })),
});

App.on('sync-login', () => Sync.loginForm());
App.on('sync-signup', () => Sync.signupForm());
App.on('sync-login-onb', () => {
  S().onboarded = true;
  App.save();
  App.closeAllModals();
  Sync.loginForm();
});
App.on('sync-logout', () => App.confirm('ستبقى بياناتك في هذا الجهاز، لكن تعديلاته لن تصل إلى أجهزتك الأخرى حتى تسجّل الدخول من جديد. متابعة؟', () => {
  firebase.auth().signOut();
}, { ok: 'تسجيل الخروج' }));
App.on('sync-now', () => App.confirm('ستحلّ بيانات هذا الجهاز محل بيانات حسابك في كل أجهزتك. متابعة؟', () => {
  setLocalAt(Date.now());
  Sync.push().then(() => App.toast('رُفعت بيانات هذا الجهاز إلى حسابك', { icon: '☁️' }));
}, { ok: 'رفع' }));
App.on('sync-restore', () => App.confirm('ستُستعاد بيانات هذا الجهاز كما كانت قبل تسجيل الدخول، وتصل إلى كل أجهزتك. متابعة؟', () => {
  const snap = ls(SYNC_BACKUP_KEY);
  if (!snap) return;
  App.state = App.merge(App.defaults(), JSON.parse(snap));
  App.save();
  setLocalAt(Date.now());
  Sync.push();
  App.applyTheme(); App.render(true);
  App.toast('استُعيدت بيانات الجهاز', { icon: '↩️' });
}, { ok: 'استعادة' }));

window.addEventListener('load', () => Sync.start());
