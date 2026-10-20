'use strict';
/* =========================================================
   النواة: أدوات عامة، التواريخ، الحالة والتخزين، الأيقونات، التوجيه
   ========================================================= */

const App = window.App = {
  views: {},      // الأقسام
  acts: {},       // أفعال النقر  data-act
  view: 'dashboard',
  params: {},
  state: null,
  _charts: {},
};

const STORE_KEY = 'musaid-data-v1';

/* ---------- أدوات عامة ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad2 = n => String(n).padStart(2, '0');
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const sum = (arr, f = x => x) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const S = () => App.state.settings;
const toLatinDigits = s => String(s ?? '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const byId = (arr, id) => arr.find(x => x.id === id);

App.on = (name, fn) => { App.acts[name] = fn; };

/* ---------- التواريخ ---------- */
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const DAYS_S = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

const _hijriFmt = {};
function hijriFormatter(opts) {
  const k = JSON.stringify(opts);
  if (!_hijriFmt[k]) {
    try { _hijriFmt[k] = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', opts); }
    catch (e) { _hijriFmt[k] = null; }
  }
  return _hijriFmt[k];
}

const D = {
  key(d = new Date()) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); },
  today() { return D.key(new Date()); },
  parse(k) { const [y, m, d] = String(k).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); },
  add(k, n) { const d = D.parse(k); d.setDate(d.getDate() + n); return D.key(d); },
  addMonths(k, n) {
    const d = D.parse(k); const day = d.getDate();
    d.setDate(1); d.setMonth(d.getMonth() + n);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return D.key(d);
  },
  diff(a, b) { return Math.round((D.parse(b) - D.parse(a)) / 864e5); }, // عدد الأيام من a إلى b
  dow(k) { return D.parse(k).getDay(); },
  weekStart(k) { const off = (D.dow(k) - S().weekStart + 7) % 7; return D.add(k, -off); },
  weekDays(k) { const s = D.weekStart(k); return Array.from({ length: 7 }, (_, i) => D.add(s, i)); },
  mk(k) { return String(k).slice(0, 7); },
  monthDays(mk) { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); },
  monthAdd(mk, n) { return D.mk(D.addMonths(mk + '-01', n)); },
  dayName(k) { return DAYS[D.dow(k)]; },
  dayShort(k) { return DAYS_S[D.dow(k)]; },
  day(k) { return Number(String(k).slice(8, 10)); },
  short(k) { const d = D.parse(k); return d.getDate() + ' ' + MONTHS[d.getMonth()]; },
  fmt(k, withYear = true) {
    const d = D.parse(k);
    return DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()] + (withYear ? ' ' + d.getFullYear() : '');
  },
  monthName(mk) { const [y, m] = mk.split('-').map(Number); return MONTHS[m - 1] + ' ' + y; },
  hijri(k, opts = { day: 'numeric', month: 'long', year: 'numeric' }) {
    const f = hijriFormatter(opts);
    return f ? f.format(D.parse(k)).replace(/\s?هـ$/, '') + (opts.year ? ' هـ' : '') : '';
  },
  hijriDay(k) { const f = hijriFormatter({ day: 'numeric' }); return f ? f.format(D.parse(k)) : ''; },
  hijriMonthNum(k) {
    const f = hijriFormatter({ month: 'numeric' });
    return f ? Number(toLatinDigits(f.format(D.parse(k)))) : 0;
  },
  hijriMonth(k) { const f = hijriFormatter({ month: 'long', year: 'numeric' }); return f ? f.format(D.parse(k)) : ''; },
  rel(k) {
    const n = D.diff(D.today(), k);
    if (n === 0) return 'اليوم';
    if (n === 1) return 'غدًا';
    if (n === -1) return 'أمس';
    if (n === 2) return 'بعد غد';
    return n > 0 ? 'بعد ' + daysAr(n) : 'منذ ' + daysAr(-n);
  },
  toMin(t) { if (!t) return null; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); },
  fromMin(min) { min = ((Math.round(min) % 1440) + 1440) % 1440; return pad2(Math.floor(min / 60)) + ':' + pad2(min % 60); },
  nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); },
  time(t) {
    if (!t) return '';
    if (S().timeFmt === '24') return t;
    let [h, m] = t.split(':').map(Number);
    const suf = h < 12 ? 'ص' : 'م';
    h = h % 12 || 12;
    return h + ':' + pad2(m) + ' ' + suf;
  },
  hourLabel(h) {
    if (S().timeFmt === '24') return pad2(h) + ':00';
    const suf = h < 12 ? 'ص' : 'م';
    return (h % 12 || 12) + ' ' + suf;
  },
};

function daysAr(n) {
  n = Math.abs(n);
  if (n === 1) return 'يوم واحد';
  if (n === 2) return 'يومين';
  if (n <= 10) return n + ' أيام';
  return n + ' يومًا';
}
function countAr(n, one, two, few, many) {
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return n + ' ' + few;
  return n + ' ' + many;
}
const tasksAr = n => countAr(n, 'مهمة واحدة', 'مهمتان', 'مهام', 'مهمة');
function durText(min) {
  min = Math.round(min || 0);
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return m + ' د';
  if (!m) return h + ' س';
  return h + ' س ' + m + ' د';
}
function hoursText(min) {
  const h = (min || 0) / 60;
  return (Math.round(h * 10) / 10).toString();
}

/* ---------- المال ---------- */
function money(n, withCur = true) {
  const v = Number(n) || 0;
  const s = Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return (v < 0 ? '-' : '') + s + (withCur ? ' ' + S().currency : '');
}
function compactNum(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'م';
  if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'ألف';
  return String(Math.round(n * 10) / 10);
}

/* ---------- الألوان والرموز ---------- */
const COLORS = ['#7c5cff', '#3b82f6', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#f43f5e', '#ec4899', '#a855f7', '#6366f1', '#64748b'];
const EMOJIS = ['🕌', '📖', '🤲', '📿', '🌅', '🌙', '🏃', '💪', '🚶', '🧘', '💧', '🥗', '🍎', '😴', '📚', '✍️', '🧠', '💻', '🎯', '☀️', '🚭', '📵', '🧹', '💰', '❤️', '👨‍👩‍👧', '🌱', '🎨', '🎧', '⭐', '🦷', '💊'];

const TASK_CATS = [
  { id: 'work', name: 'عمل', color: '#3b82f6', icon: '💼' },
  { id: 'study', name: 'دراسة', color: '#a855f7', icon: '📚' },
  { id: 'uni', name: 'الجامعة', color: '#06b6d4', icon: '🎓' },
  { id: 'worship', name: 'عبادة', color: '#14b8a6', icon: '🕌' },
  { id: 'program', name: 'برامج', color: '#6366f1', icon: '🧭' },
  { id: 'health', name: 'صحة', color: '#22c55e', icon: '💪' },
  { id: 'family', name: 'أسرة', color: '#ec4899', icon: '🏡' },
  { id: 'personal', name: 'شخصي', color: '#f59e0b', icon: '⭐' },
  { id: 'errand', name: 'مشاوير', color: '#f97316', icon: '🛒' },
  { id: 'other', name: 'أخرى', color: '#64748b', icon: '📌' },
];
const PRIORITIES = { high: 'عالية', med: 'متوسطة', low: 'منخفضة' };

/* ---------- الحالة الافتراضية ---------- */
App.defaults = () => ({
  v: 1,
  settings: {
    name: '',
    theme: 'dark',
    accent: 'violet',
    currency: 'ر.س',
    weekStart: 6,          // السبت
    weekLayout: 'grid',    // الجدول الأسبوعي: grid جدول مربع، hours بالساعات
    dayStart: 5,
    dayEnd: 23,
    timeFmt: '12',
    digits: 'latn',
    showHijri: true,
    notify: true,
    notifyMinutes: 10,
    sound: true,
    autoCarry: false,
    prayer: { show: true, city: 'mecca', lat: 21.4225, lng: 39.8262, method: 'makkah', asr: 1, inDay: true, remind: false },
    areas: [
      { id: 'faith', name: 'الإيمانية', icon: '🕌', color: '#14b8a6' },
      { id: 'health', name: 'الصحية', icon: '💪', color: '#22c55e' },
      { id: 'work', name: 'المهنية', icon: '💼', color: '#3b82f6' },
      { id: 'study', name: 'العلمية', icon: '📚', color: '#a855f7' },
      { id: 'money', name: 'المالية', icon: '💰', color: '#f59e0b' },
      { id: 'family', name: 'الأسرية والاجتماعية', icon: '👨‍👩‍👧', color: '#ec4899' },
      { id: 'self', name: 'الشخصية', icon: '🌱', color: '#f97316' },
    ],
    expenseCats: [
      { id: 'food', name: 'طعام ومطاعم', icon: '🍔' },
      { id: 'transport', name: 'مواصلات ووقود', icon: '🚗' },
      { id: 'home', name: 'سكن', icon: '🏠' },
      { id: 'bills', name: 'فواتير', icon: '💡' },
      { id: 'shopping', name: 'تسوّق', icon: '🛍️' },
      { id: 'grocery', name: 'بقالة', icon: '🛒' },
      { id: 'health', name: 'صحة', icon: '💊' },
      { id: 'edu', name: 'تعليم', icon: '📚' },
      { id: 'fun', name: 'ترفيه', icon: '🎮' },
      { id: 'charity', name: 'صدقات وهدايا', icon: '🎁' },
      { id: 'subs', name: 'اشتراكات', icon: '🔁' },
      { id: 'other', name: 'أخرى', icon: '📦' },
    ],
    incomeCats: [
      { id: 'salary', name: 'راتب', icon: '💼' },
      { id: 'freelance', name: 'عمل حر', icon: '💻' },
      { id: 'invest', name: 'استثمار', icon: '📈' },
      { id: 'gift', name: 'هدية', icon: '🎁' },
      { id: 'other', name: 'أخرى', icon: '➕' },
    ],
    payMethods: ['نقدًا', 'بطاقة', 'تحويل'],
    waterGoal: 8,
    sleepGoal: 8,
    pomodoro: { focus: 25, short: 5, long: 15, every: 4 },
    readingGoal: 12,
    onboarded: false,
  },
  tasks: [],
  dayNotes: {},
  weekGoals: {},
  monthPlans: {},
  transactions: [],
  budgets: {},
  savings: [],
  debts: [],
  subscriptions: [],
  habits: [],
  trackers: [],
  subjects: [],
  sessions: [],
  exams: [],
  assignments: [],
  classes: [],
  goals: [],
  journal: {},
  notes: [],
  health: {},
  books: [],
  inbox: [],
  notified: {},
});

App.load = function () {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { data = null; }
  App.state = App.merge(App.defaults(), data);
};

App.merge = function (def, data) {
  if (!data || typeof data !== 'object') return def;
  const out = Object.assign({}, def, data);
  out.settings = Object.assign({}, def.settings, data.settings || {});
  out.settings.prayer = Object.assign({}, def.settings.prayer, (data.settings || {}).prayer || {});
  out.settings.pomodoro = Object.assign({}, def.settings.pomodoro, (data.settings || {}).pomodoro || {});
  return out;
};

let _saveErr = false;
App.save = function () {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(App.state)); _saveErr = false; }
  catch (e) {
    if (!_saveErr && App.toast) App.toast('تعذّر حفظ البيانات في المتصفح — صدّر نسخة احتياطية من الإعدادات', { icon: '⚠️' });
    _saveErr = true;
  }
};

/** تعديل الحالة ثم الحفظ وإعادة الرسم */
App.update = function (fn) {
  fn && fn(App.state);
  App.save();
  App.refresh();
};

/** تعديل مع إمكانية التراجع */
App.withUndo = function (msg, fn, icon = '🗑️') {
  const snap = JSON.stringify(App.state);
  fn(App.state);
  App.save();
  App.refresh();
  App.toast(msg, {
    icon,
    undo: () => { App.state = JSON.parse(snap); App.save(); App.refresh(); App.toast('تم التراجع', { icon: '↩️' }); },
  });
};

/* ---------- الأيقونات ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  day: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  week: '<rect x="3" y="4" width="18" height="17" rx="2.5"/><path d="M3 9h18M9 9v12M15 9v12"/>',
  month: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2.5"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>',
  wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-3"/><path d="M21 11h-4a2 2 0 0 0 0 4h4z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  tracker: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="m14.5 17.5 2 2 4-4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  journal: '<path d="M5 3h11a3 3 0 0 1 3 3v15H8a3 3 0 0 1-3-3z"/><path d="M5 18a3 3 0 0 1 3-3h11"/><path d="M9 7h6M9 10.5h4"/>',
  study: '<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/><path d="M22 10v6"/>',
  book: '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  next: '<path d="m15 18-6-6 6-6"/>',   // في الواجهة العربية: التالي لليسار
  prev: '<path d="m9 18 6-6-6-6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5M5 21h14"/>',
  star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  play: '<path d="M7 4.5v15l12-7.5z" fill="currentColor"/>',
  pause: '<path d="M7 4h3.5v16H7zM13.5 4H17v16h-3.5z" fill="currentColor"/>',
  reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  skip: '<path d="M18 5v14"/><path d="M5 4.5v15l10-7.5z"/>',
  sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 3v4M17 5h4M5 17v4M3 19h4"/>',
  trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  drop: '<path d="M12 2.7s7 7.3 7 12.3a7 7 0 0 1-14 0c0-5 7-12.3 7-12.3z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
  note: '<path d="M15.5 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.5z"/><path d="M15 3v6h6"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  printer: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><path d="M6 14h12v8H6z"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76V4h6v6.76l3 3.24H6z"/><path d="M8 4h8"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/>',
  layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  moveToday: '<path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 3v6h-6"/><path d="M12 8v4l3 2"/>',
};
function ic(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
const X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';

/* ---------- التوجيه والرسم ---------- */
App.go = function (view, params = {}) {
  if (!App.views[view]) view = 'dashboard';
  const changed = view !== App.view || JSON.stringify(params) !== JSON.stringify(App.params);
  App.view = view;
  App.params = params;
  if (location.hash.slice(1) !== view) history.replaceState(null, '', '#' + view);
  document.body.classList.remove('nav-open');
  App.closePopover && App.closePopover();
  App.render(changed);
};

App.render = function (fresh = false) {
  const v = App.views[App.view];
  if (!v) return;
  const el = $('#view');
  const y = window.scrollY;
  App._charts = {};
  $('#view-title').textContent = v.title;
  document.title = v.title + ' — مُساعِد';
  el.classList.toggle('no-anim', !fresh);
  el.innerHTML = v.render(App.params);
  App.mountCharts();
  v.after && v.after(App.params);
  App.renderChrome && App.renderChrome();
  App.localize(el);
  if (fresh) window.scrollTo(0, 0); else window.scrollTo(0, y);
};

App.refresh = function () { App.render(false); };

/** يحوّل الأرقام إلى العربية المشرقية عند اختيار ذلك من الإعدادات */
App.localize = function (root) {
  if (!root || !App.state || S().digits !== 'arab') return;
  const map = '٠١٢٣٤٥٦٧٨٩';
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = w.nextNode())) {
    if (!/[0-9]/.test(n.nodeValue)) continue;
    const p = n.parentElement;
    if (p && p.closest('input, textarea, script, style, .keep-latn')) continue;
    n.nodeValue = n.nodeValue.replace(/[0-9]/g, d => map[d]);
  }
};

/* ---------- تفويض الأحداث ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = App.acts[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  e.stopPropagation();
  fn(el, e);
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = App.acts[el.dataset.change];
  if (fn) fn(el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const fn = App.acts[el.dataset.input];
  if (fn) fn(el, e);
});

/* تلميحات الأدوات */
(function () {
  let cur = null;
  const place = (e) => {
    const tip = $('#tooltip');
    const r = tip.getBoundingClientRect();
    let x = e.clientX - r.width / 2, y = e.clientY - r.height - 14;
    if (y < 8) y = e.clientY + 18;
    x = clamp(x, 8, window.innerWidth - r.width - 8);
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  };
  document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-tip]');
    const tip = $('#tooltip');
    if (!tip) return;
    if (!el) { if (cur) { tip.classList.remove('on'); cur = null; } return; }
    if (el !== cur) {
      cur = el;
      tip.innerHTML = el.dataset.tip;
      App.localize(tip);
      tip.classList.add('on');
    }
    place(e);
  });
  document.addEventListener('mousemove', e => { if (cur) place(e); });
  document.addEventListener('scroll', () => { if (cur) { $('#tooltip').classList.remove('on'); cur = null; } }, true);
})();
