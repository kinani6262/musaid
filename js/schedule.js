'use strict';
/* =========================================================
   جدولي الأساسي: السنن اليومية، والدروس والبرامج الأسبوعية، والعادات.
   يُحمَّل مرة واحدة في كل متصفح (ومنه الهاتف)، ويحلّ محل البيانات
   السابقة بعد حفظ نسخة منها تُستعاد من الإعدادات.
   البيانات التجريبية الافتراضية باقية كما هي في demo.js.
   ========================================================= */

const SCHEDULE_V = 1;                       // ارفع الرقم ليُعاد تحميل الجدول في كل الأجهزة
const SCHEDULE_KEY = 'musaid-schedule-v';
const OLD_DATA_KEY = 'musaid-data-before-schedule';
const SCHEDULE_START = '2026-10-11';        // الأحد: أول أسبوع في الجدول (تاريخ ثابت ليتطابق الجدول في كل الأجهزة)
const PHONE_FREE_START = '2026-10-14';      // أول أيام «ترك الهاتف» يومًا دون يوم

App.buildMySchedule = function () {
  const today = D.today();
  const s = App.defaults();
  s.settings = Object.assign(s.settings, App.state.settings, { weekStart: 0, weekLayout: 'grid' });
  const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6;

  /* العادات */
  const habit = o => Object.assign({ id: uid(), freq: 'daily', days: [], target: 1, unit: '', log: {}, created: today, archived: false }, o);
  const night = habit({ name: 'قيام الليل', icon: '🤲', color: '#7c5cff' });
  const fast = habit({ name: 'صيام الاثنين والخميس', icon: '🌙', color: '#ec4899', freq: 'days', days: [MON, THU] });
  s.habits.push(
    habit({ name: 'القراءة', icon: '📚', color: '#a855f7' }),
    habit({ name: 'ترك الهاتف', icon: '📵', color: '#64748b', freq: 'alt', altStart: PHONE_FREE_START }),
    night,
    fast,
  );

  /* المهام المتكررة — الأوقات تقريبية حول مواقيت الصلاة، وتُعدَّل من نافذة المهمة */
  const task = o => Object.assign({ id: uid(), date: SCHEDULE_START, time: '', dur: 30, pri: 'med', cat: 'worship', repeat: 'weekdays', days: [], remind: true, notes: '', until: '', done: false, doneDates: {}, created: today }, o);
  s.tasks.push(
    // السنن اليومية
    task({ title: 'قيام الليل', time: '04:00', dur: 30, repeat: 'daily', habit: night.id }),
    task({ title: 'أذكار الصباح', time: '05:15', dur: 15, repeat: 'daily' }),
    task({ title: 'الورد اليومي', repeat: 'daily' }),
    task({ title: 'السنن الرواتب', repeat: 'daily', notes: '12 ركعة: ركعتان قبل الفجر، وأربع قبل الظهر وركعتان بعده، وركعتان بعد المغرب، وركعتان بعد العشاء' }),
    task({ title: 'أذكار المساء', time: '15:40', dur: 15, repeat: 'daily' }),

    // بعد الفجر
    task({ title: 'حفظ سلم الأصول', time: '05:30', dur: 45, cat: 'study', days: [SUN, MON, TUE, WED, THU] }),
    task({ title: 'تثبيت المحفوظ', time: '05:30', dur: 45, cat: 'study', days: [FRI] }),
    task({ title: 'درس كتاب التوحيد / صحيح البخاري', time: '05:30', dur: 180, cat: 'study', days: [SAT] }),

    // الصباح
    task({ title: 'الذهاب إلى الجامعة', time: '07:30', dur: 240, cat: 'uni', days: [SUN, TUE, THU] }),
    task({ title: 'دراسة أخصر المختصرات', time: '08:00', dur: 90, cat: 'study', days: [MON, WED] }),
    task({ title: 'تجهيز للجمعة / تبكير', time: '09:00', dur: 180, days: [FRI] }),

    // الظهر
    task({ title: 'قراءة السيرة', time: '13:00', dur: 60, cat: 'study', days: [FRI], notes: 'بعد صلاة الجمعة' }),

    // العصر
    task({ title: 'حلقة قرآن', time: '16:00', dur: 90, days: [SUN, MON, TUE, WED] }),
    task({ title: 'برنامج عطاء الوقفية', time: '17:30', dur: 30, cat: 'program', days: [TUE], notes: 'بعد حلقة القرآن، عدّل الوقت والمدة حسب البرنامج' }),
    task({ title: 'درس عمدة الفقه', time: '16:00', dur: 45, cat: 'study', days: [THU] }),
    task({ title: 'برنامج مراحل', time: '16:00', dur: 420, cat: 'program', days: [SAT], notes: 'من بعد العصر إلى الحادية عشرة ليلًا' }),

    // المغرب والعشاء
    task({ title: 'اليوم العائلي', time: '18:15', dur: 180, cat: 'family', days: [FRI], notes: 'بعد المغرب والعشاء' }),
    task({ title: 'برنامج بناء', time: '20:00', dur: 90, cat: 'program', days: [SUN], notes: 'بعد العشاء' }),
    task({ title: 'درس مدارج السالكين / سيرة ابن هشام', time: '20:00', dur: 120, cat: 'study', days: [TUE], notes: 'بعد العشاء' }),

    // طوال اليوم
    task({ title: 'صيام الاثنين والخميس', days: [MON, THU], habit: fast.id, notes: 'يصلك تذكير في مساء اليوم السابق' }),
  );

  s.inbox = [{ id: uid(), title: 'أُضيف جدولك الأسبوعي', body: 'السنن اليومية والدروس والبرامج والعادات. نسخة من بياناتك السابقة محفوظة في الإعدادات.', icon: '📅', view: 'week', time: Date.now(), read: false }];
  return s;
};

/** يُستدعى عند التشغيل: يضع الجدول مرة واحدة في هذا المتصفح */
App.ensureSchedule = function () {
  let old = null;
  try {
    if (Number(localStorage.getItem(SCHEDULE_KEY)) >= SCHEDULE_V) return false;
    old = localStorage.getItem(STORE_KEY);
    if (old && old !== 'null') localStorage.setItem(OLD_DATA_KEY, old);
  } catch (e) { return false; }
  App.state = App.buildMySchedule();
  App.save();
  try { localStorage.setItem(SCHEDULE_KEY, String(SCHEDULE_V)); } catch (e) { /* */ }
  return !!(old && old !== 'null');
};

App.oldData = function () {
  try { return localStorage.getItem(OLD_DATA_KEY); } catch (e) { return null; }
};
App.restoreOldData = function () {
  const old = App.oldData();
  if (!old) return false;
  App.state = App.merge(App.defaults(), JSON.parse(old));
  App.save(); App.applyTheme(); App.render(true);
  return true;
};

App.on('schedule-reload', () => App.confirm('سيُعاد تحميل جدولك الأساسي (السنن والدروس والبرامج والعادات) بدل البيانات الحالية. يمكنك التراجع مباشرة بعدها. متابعة؟', () => {
  const snap = JSON.stringify(App.state);
  App.state = App.buildMySchedule();
  App.save(); App.applyTheme(); App.render(true);
  App.toast('أُعيد تحميل جدولك الأساسي', { icon: '📅', undo: () => { App.state = JSON.parse(snap); App.save(); App.applyTheme(); App.refresh(); } });
}, { ok: 'إعادة التحميل' }));
App.on('old-data-download', () => {
  const old = App.oldData();
  if (old) App.download('musaid-old-data.json', old);
});
App.on('old-data-restore', () => App.confirm('ستُستبدل بياناتك الحالية بالبيانات التي كانت قبل إضافة الجدول. متابعة؟', () => {
  const snap = JSON.stringify(App.state);
  if (App.restoreOldData()) App.toast('استُعيدت البيانات السابقة', { icon: '↩️', undo: () => { App.state = JSON.parse(snap); App.save(); App.applyTheme(); App.refresh(); } });
}, { ok: 'استعادة' }));
