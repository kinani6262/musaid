'use strict';
/* =========================================================
   بيانات تجريبية واقعية نسبةً إلى تاريخ اليوم
   ========================================================= */

App.loadDemo = function () {
  let seed = 20261012;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1));
  const today = D.today();
  const ago = n => D.add(today, -n);
  const after = n => D.add(today, n);
  const keep = App.state.settings;
  const s = App.defaults();
  s.settings = Object.assign(s.settings, { name: keep.name, theme: keep.theme, accent: keep.accent, currency: keep.currency, prayer: keep.prayer, digits: keep.digits, timeFmt: keep.timeFmt, weekStart: keep.weekStart, onboarded: true });
  const task = (o) => Object.assign({ id: uid(), time: '', dur: 30, pri: 'med', cat: 'personal', repeat: 'none', days: [], remind: true, notes: '', done: false, doneDates: {}, created: ago(20) }, o);

  /* المهام */
  const dailyQuran = task({ title: 'ورد القرآن بعد الفجر', date: ago(30), time: '05:45', dur: 20, cat: 'worship', repeat: 'daily', remind: false });
  for (let i = 1; i < 30; i++) if (rnd() > .15) dailyQuran.doneDates[ago(i)] = 1;
  const gym = task({ title: 'تمارين رياضية', date: ago(30), time: '19:00', dur: 45, cat: 'health', repeat: 'weekdays', days: [0, 2, 4], remind: false });
  for (let i = 1; i < 30; i++) if ([0, 2, 4].includes(D.dow(ago(i))) && rnd() > .3) gym.doneDates[ago(i)] = 1;
  s.tasks.push(dailyQuran, gym,
    task({ title: 'مراجعة البريد وترتيب أولويات اليوم', date: today, time: '08:00', dur: 30, cat: 'work', pri: 'med', done: true, doneAt: today }),
    task({ title: 'اجتماع الفريق الأسبوعي', date: today, time: '10:00', dur: 60, cat: 'work', pri: 'high' }),
    task({ title: 'مذاكرة الرياضيات — الفصل الرابع', date: today, time: '16:00', dur: 90, cat: 'study', pri: 'high' }),
    task({ title: 'المشي في الحديقة', date: today, time: '18:30', dur: 30, cat: 'health', pri: 'low' }),
    task({ title: 'الاتصال بالوالدة والاطمئنان عليها', date: today, dur: 15, cat: 'family', pri: 'high' }),
    task({ title: 'شراء مستلزمات البيت', date: today, dur: 45, cat: 'errand', pri: 'low' }),
    task({ title: 'تحديث السيرة الذاتية', date: today, dur: 60, cat: 'work', pri: 'med' }),
    task({ title: 'إرسال الفاتورة للعميل', date: ago(1), time: '13:00', cat: 'work', pri: 'high' }),
    task({ title: 'ترتيب المكتب', date: ago(2), cat: 'personal', done: true, doneAt: ago(2) }),
    task({ title: 'موعد طبيب الأسنان', date: after(1), time: '11:00', dur: 60, cat: 'health', pri: 'high' }),
    task({ title: 'تسليم تقرير المشروع', date: after(1), time: '14:00', dur: 30, cat: 'work', pri: 'high' }),
    task({ title: 'زيارة الأقارب', date: after(3), time: '20:00', dur: 120, cat: 'family' }),
    task({ title: 'حضور دورة التصميم', date: after(10), time: '17:00', dur: 120, cat: 'study' }),
    task({ title: 'تجديد جواز السفر', date: after(18), cat: 'personal', pri: 'high' }),
    task({ title: 'صلة الرحم — زيارة العم', date: after(6), time: '17:30', dur: 90, cat: 'family' }),
    task({ title: 'تعلّم أساسيات البرمجة بلغة بايثون', date: null, cat: 'study' }),
    task({ title: 'تخطيط رحلة العمرة', date: null, cat: 'worship' }),
  );
  for (let i = 2; i < 15; i++) {
    const n = ri(2, 5);
    for (let j = 0; j < n; j++) {
      const titles = ['إنهاء عرض تقديمي', 'الرد على الرسائل', 'مراجعة درس', 'تنظيف السيارة', 'قراءة مقال مفيد', 'إصلاح الإضاءة', 'تحضير الغداء', 'متابعة طلب'];
      s.tasks.push(task({ title: titles[ri(0, titles.length - 1)], date: ago(i), cat: ['work', 'study', 'personal', 'errand'][ri(0, 3)], done: true, doneAt: ago(i) }));
    }
  }

  /* الأسبوع والشهر */
  const ws = D.weekStart(today), mk = D.mk(today);
  s.weekGoals[ws] = [
    { id: uid(), text: 'إنهاء 3 فصول من كتاب «الرحيق المختوم»', done: true },
    { id: uid(), text: 'المشي 4 مرات على الأقل', done: false },
    { id: uid(), text: 'ادخار 500 لصندوق الطوارئ', done: false },
  ];
  const cw = Math.floor((D.day(today) - 1) / 7) + 1;
  const it = (text, done = false) => ({ id: uid(), text, done });
  s.monthPlans[mk] = {
    focus: 'الانتظام في الصلاة والرياضة، وإنهاء مشروع العمل قبل نهاية الشهر',
    word: 'خطوة كل يوم',
    top: [it('صلاة الفجر في المسجد يوميًا'), it('إطلاق النسخة الأولى من المشروع', false), it('الالتزام بالميزانية', true)],
    goals: { faith: 'حفظ سورة الملك ومراجعة جزء عمّ', health: 'المشي 4 أيام أسبوعيًا', work: 'إطلاق المشروع', study: 'الاستعداد للاختبار النصفي', money: 'ادخار 20% من الدخل', family: 'زيارة أسبوعية للوالدين', self: 'قراءة كتابين' },
    cells: {
      ['faith|1']: [it('حفظ أول 10 آيات من الملك', true)], ['faith|2']: [it('إكمال حفظ سورة الملك', cw > 2)], ['faith|' + cw]: [it('مراجعة جزء عمّ')],
      ['health|1']: [it('شراء حذاء رياضي', true), it('تحديد مسار المشي', true)], ['health|' + cw]: [it('المشي 4 مرات')],
      ['work|1']: [it('إنهاء التصميم', true)], ['work|2']: [it('برمجة الواجهة', cw > 2)], ['work|' + cw]: [it('الاختبار والتسليم')], ['work|4']: [it('الإطلاق 🚀')],
      ['study|' + cw]: [it('حل نماذج الرياضيات'), it('مراجعة الفيزياء')],
      ['money|1']: [it('وضع الميزانية', true)], ['money|' + cw]: [it('تحويل 20% للادخار')],
      ['family|' + cw]: [it('زيارة الوالدين')], ['self|1']: [it('بدء كتاب العادات الذرية', true)],
    },
    review: { good: '', improve: '' },
  };

  /* المال */
  const tx = (type, amount, cat, note, date, method = 'بطاقة') => s.transactions.push({ id: uid(), type, amount, cat, note, date, method });
  for (let m = 3; m >= 0; m--) {
    const base = D.monthAdd(mk, -m);
    const md = D.monthDays(base);
    const last = m === 0 ? D.day(today) : md;
    const k = d => base + '-' + pad2(d);
    if (m > 0 || D.day(today) >= 1) tx('income', 9000, 'salary', 'الراتب الشهري', k(1), 'تحويل');
    if (m === 1 || m === 3) tx('income', ri(800, 2200), 'freelance', 'مشروع تصميم لعميل', k(ri(5, 20)), 'تحويل');
    tx('expense', 2500, 'home', 'إيجار الشقة', k(1), 'تحويل');
    if (last >= 5) tx('expense', ri(220, 340), 'bills', 'فاتورة الكهرباء', k(5));
    if (last >= 8) tx('expense', 300, 'bills', 'الإنترنت المنزلي', k(8));
    if (last >= 12) tx('expense', 150, 'charity', 'صدقة شهرية', k(12), 'نقدًا');
    for (let d = 1; d <= last; d++) {
      if (rnd() > .35) tx('expense', ri(12, 55), 'food', ['قهوة', 'غداء', 'عشاء مع العائلة', 'شاورما', 'فطور'][ri(0, 4)], k(d), rnd() > .5 ? 'بطاقة' : 'نقدًا');
      if (d % 7 === 3) tx('expense', ri(160, 380), 'grocery', 'مشتريات البقالة الأسبوعية', k(d));
      if (d % 6 === 2) tx('expense', ri(80, 130), 'transport', 'بنزين', k(d));
      if (rnd() > .93) tx('expense', ri(90, 420), 'shopping', ['ملابس', 'حذاء', 'أدوات منزلية'][ri(0, 2)], k(d));
      if (rnd() > .95) tx('expense', ri(40, 160), 'fun', ['سينما', 'نزهة', 'ألعاب'][ri(0, 2)], k(d));
      if (rnd() > .97) tx('expense', ri(35, 180), 'health', 'صيدلية', k(d));
    }
  }
  s.budgets = { food: 900, grocery: 1200, transport: 500, bills: 700, shopping: 500, fun: 300, home: 2500, charity: 200, subs: 400 };
  s.savings = [
    { id: uid(), name: 'صندوق الطوارئ', target: 20000, saved: 8500, icon: '🛡️', color: '#3b82f6', deadline: D.addMonths(today, 10) },
    { id: uid(), name: 'رحلة العمرة', target: 6000, saved: 2400, icon: '🕋', color: '#14b8a6', deadline: D.addMonths(today, 4) },
    { id: uid(), name: 'حاسوب جديد', target: 5000, saved: 3100, icon: '💻', color: '#a855f7' },
  ];
  s.debts = [
    { id: uid(), type: 'lent', person: 'أحمد', amount: 500, date: ago(20), due: after(2), note: 'سلفة', paid: false },
    { id: uid(), type: 'borrowed', person: 'خالد', amount: 1200, date: ago(35), due: after(20), note: '', paid: false },
    { id: uid(), type: 'lent', person: 'سعيد', amount: 300, date: ago(60), due: ago(30), note: '', paid: true },
  ];

  /* الاشتراكات */
  const sub = (name, amount, cycle, next, cat, color, usage, extra = {}) => s.subscriptions.push(Object.assign({ id: uid(), name, amount, cycle, next, cat, color, usage: String(usage), remindDays: 1, autoLog: true, active: true }, extra));
  sub('نتفليكس', 45, 'monthly', after(1), 'fun', '#e11d48', 2);
  sub('سبوتيفاي', 22, 'monthly', after(9), 'fun', '#22c55e', 3);
  sub('iCloud', 13, 'monthly', after(15), 'cloud', '#3b82f6', 3);
  sub('النادي الرياضي', 350, 'monthly', after(6), 'health', '#f97316', 1);
  sub('باقة الجوال', 115, 'monthly', after(20), 'telecom', '#8b5cf6', 3);
  sub('أدوبي (تجربة)', 89, 'monthly', after(5), 'work', '#ef4444', 2, { trialEnd: after(2) });
  sub('Microsoft 365', 249, 'yearly', after(120), 'work', '#0ea5e9', 3);

  /* العادات */
  const habit = (o, prob, countMax) => {
    const h = Object.assign({ id: uid(), freq: 'daily', days: [], target: 1, unit: '', log: {}, created: ago(45), archived: false }, o);
    for (let i = 1; i <= 45; i++) {
      const k = ago(i);
      if (!Habits.isDue(h, k)) continue;
      if (i <= (o._streak || 0) || rnd() < prob) h.log[k] = h.target > 1 ? (rnd() > .3 ? h.target : ri(1, h.target - 1)) : 1;
    }
    delete h._streak;
    s.habits.push(h);
    return h;
  };
  habit({ name: 'أذكار الصباح', icon: '🌅', color: '#f59e0b', remindAt: '06:30', _streak: 12 }, .8).log[today] = 1;
  habit({ name: 'ورد القرآن', icon: '📖', color: '#14b8a6', _streak: 5 }, .75).log[today] = 1;
  habit({ name: 'المشي 30 دقيقة', icon: '🚶', color: '#22c55e', freq: 'days', days: [6, 1, 3, 5] }, .65);
  habit({ name: 'شرب 8 أكواب ماء', icon: '💧', color: '#06b6d4', target: 8, unit: 'كوب' }, .7).log[today] = 4;
  habit({ name: 'النوم قبل 11 مساءً', icon: '😴', color: '#6366f1' }, .55);
  habit({ name: 'أذكار المساء', icon: '🌙', color: '#7c5cff', remindAt: '17:30' }, .7);

  /* المتابعات */
  const pr = { id: uid(), name: 'الصلاة في المسجد', icon: '🕌', color: '#14b8a6', cells: 40, start: ago(12), dated: true, rows: ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'], tri: true, log: {}, created: ago(12), archived: false, note: '«من صلّى لله أربعين يومًا في جماعة يُدرك التكبيرة الأولى كُتبت له براءتان: براءة من النار، وبراءة من النفاق» — رواه الترمذي' };
  for (let c = 0; c < 12; c++) for (let r = 0; r < 5; r++) { const v = rnd(); if (v < .84) pr.log[r + '-' + c] = 1; else if (v < .93) pr.log[r + '-' + c] = 2; }
  pr.log['0-12'] = 1; pr.log['1-12'] = 1;
  const quran = { id: uid(), name: 'ختمة القرآن (جزء يوميًا)', icon: '📖', color: '#22c55e', cells: 30, start: ago(8), dated: true, rows: [], tri: false, log: {}, created: ago(8), archived: false };
  for (let c = 0; c < 8; c++) if (c !== 4) quran.log['0-' + c] = 1;
  const books = { id: uid(), name: 'قراءة 12 كتابًا هذا العام', icon: '📚', color: '#a855f7', cells: 12, start: ago(200), dated: false, rows: [], tri: false, log: { '0-0': 1, '0-1': 1, '0-2': 1, '0-3': 1, '0-4': 1 }, created: ago(200), archived: false };
  s.trackers.push(pr, quran, books);

  /* الدراسة */
  const subj = (name, color, goal, teacher) => { const x = { id: uid(), name, color, goal, teacher }; s.subjects.push(x); return x; };
  const math = subj('الرياضيات', '#3b82f6', 5, 'د. سامي');
  const phys = subj('الفيزياء', '#f97316', 4, 'أ. منى');
  const eng = subj('اللغة الإنجليزية', '#22c55e', 3, 'أ. ريم');
  const prog = subj('البرمجة', '#a855f7', 4, 'م. فهد');
  for (let i = 0; i < 14; i++) {
    const n = i === 0 ? 1 : ri(0, 3);
    for (let j = 0; j < n; j++) s.sessions.push({ id: uid(), subject: [math, phys, eng, prog][ri(0, 3)].id, min: [25, 25, 45, 50][ri(0, 3)], date: ago(i), note: '' });
  }
  const tp = (arr, done) => arr.map((t, i) => ({ id: uid(), text: t, done: i < done }));
  s.exams.push(
    { id: uid(), title: 'الاختبار النصفي', subject: math.id, date: after(6), time: '09:00', place: 'القاعة 204', topics: tp(['التفاضل', 'التكامل المحدود', 'المتتاليات', 'المصفوفات', 'حل نماذج سابقة'], 2) },
    { id: uid(), title: 'اختبار قصير — الحركة الدائرية', subject: phys.id, date: after(12), time: '11:00', place: '', topics: tp(['قوانين نيوتن', 'الحركة الدائرية'], 0) },
    { id: uid(), title: 'اختبار المحادثة', subject: eng.id, date: ago(10), time: '10:00', grade: '18/20', topics: [] },
  );
  s.assignments.push(
    { id: uid(), title: 'حل تمارين الفصل الثالث', subject: math.id, due: after(1), pri: 'high', done: false },
    { id: uid(), title: 'تقرير تجربة المختبر', subject: phys.id, due: after(4), pri: 'med', done: false },
    { id: uid(), title: 'مقال عن الهوايات (300 كلمة)', subject: eng.id, due: after(7), pri: 'low', done: false },
    { id: uid(), title: 'مشروع آلة حاسبة بسيطة', subject: prog.id, due: ago(3), pri: 'med', done: true },
  );
  const cls = (subject, day, from, to, place) => s.classes.push({ id: uid(), subject, day, from, to, place });
  cls(math.id, 0, '08:00', '09:30', 'قاعة 204'); cls(math.id, 2, '08:00', '09:30', 'قاعة 204');
  cls(phys.id, 1, '10:00', '11:30', 'المختبر 3'); cls(phys.id, 3, '10:00', '11:30', 'المختبر 3');
  cls(eng.id, 0, '12:00', '13:00', 'قاعة 110'); cls(eng.id, 2, '12:00', '13:00', 'قاعة 110');
  cls(prog.id, 4, '08:00', '10:00', 'معمل الحاسب');

  /* الأهداف */
  const ms = (arr, done) => arr.map((t, i) => ({ id: uid(), text: t, done: i < done }));
  s.goals.push(
    { id: uid(), title: 'حفظ جزء عمّ كاملًا', area: 'faith', deadline: after(60), why: 'لأقرأ في صلاتي بسور متنوعة وأتدبرها', milestones: ms(['من الناس إلى الضحى', 'من الليل إلى الانفطار', 'من التكوير إلى النبأ', 'مراجعة شاملة'], 1), progress: 0, done: false, created: ago(30) },
    { id: uid(), title: 'خسارة 5 كيلوجرامات', area: 'health', deadline: after(90), why: 'صحة أفضل وطاقة أكبر', milestones: ms(['ترك المشروبات الغازية', 'المشي 4 مرات أسبوعيًا', 'الوصول إلى 80 كجم', 'الوصول إلى 77 كجم'], 2), progress: 0, done: false, created: ago(40) },
    { id: uid(), title: 'إطلاق موقعي الشخصي', area: 'work', deadline: after(30), why: 'لعرض أعمالي والحصول على عملاء', milestones: ms(['اختيار النطاق والاستضافة', 'تصميم الصفحات', 'كتابة المحتوى', 'النشر'], 1), progress: 0, done: false, created: ago(20) },
    { id: uid(), title: 'اجتياز دورة الإسعافات الأولية', area: 'self', deadline: ago(15), why: '', milestones: ms(['التسجيل', 'الحضور', 'الاختبار'], 3), progress: 0, done: true, doneAt: ago(15), created: ago(60) },
  );

  /* المذكرات */
  const texts = ['يوم مثمر، أنجزت معظم مهامي والحمد لله.', 'شعرت ببعض التعب لكن حافظت على عاداتي.', 'زرت الأهل وكانت جلسة جميلة.', 'تعلمت اليوم شيئًا جديدًا في البرمجة.', 'يوم هادئ، قرأت كثيرًا.', 'كان العمل مزدحمًا اليوم.'];
  for (let i = 1; i <= 12; i++) if (rnd() > .25) s.journal[ago(i)] = { mood: ri(2, 5), text: texts[ri(0, texts.length - 1)], grat: ['الصحة', 'الأهل', 'العمل'], lesson: '' };
  s.notes.push(
    { id: uid(), title: 'أفكار مشاريع', text: '• تطبيق لتنظيم المصاريف\n• مدونة عن الإنتاجية\n• قناة لتعليم الخط العربي', color: '#7c5cff', pinned: true, date: ago(5) },
    { id: uid(), title: 'قائمة المشتريات', text: 'حليب، خبز، تمر، قهوة، منظفات', color: '#22c55e', pinned: false, date: ago(1) },
    { id: uid(), title: '', text: '«إنّ الله يحب إذا عمل أحدكم عملًا أن يتقنه»', color: '#f59e0b', pinned: false, date: ago(3) },
    { id: uid(), title: 'أماكن أريد زيارتها', text: 'المدينة المنورة، العُلا، أبها، إسطنبول', color: '#06b6d4', pinned: false, date: ago(9) },
  );

  /* العافية */
  let w = 82.4;
  for (let i = 14; i >= 0; i--) {
    const k = ago(i);
    const h = { water: i === 0 ? 4 : ri(4, 8), sleep: [5.5, 6, 6.5, 7, 7, 7.5, 8][ri(0, 6)], exercise: [0, 0, 20, 30, 45][ri(0, 4)], steps: ri(3, 11) * 1000 };
    if (i % 3 === 0) { w -= rnd() * .5; h.weight = Math.round(w * 10) / 10; }
    if (i === 0) { delete h.sleep; delete h.exercise; delete h.steps; }
    s.health[k] = h;
  }

  /* القراءة */
  s.books.push(
    { id: uid(), title: 'الرحيق المختوم', author: 'صفي الرحمن المباركفوري', pages: 500, read: 230, status: 'reading', color: '#14b8a6', added: ago(20) },
    { id: uid(), title: 'العادات الذرية', author: 'جيمس كلير', pages: 320, read: 320, status: 'done', rating: 5, finishedAt: ago(15), color: '#f97316', added: ago(50) },
    { id: uid(), title: 'لا تحزن', author: 'عائض القرني', pages: 470, read: 470, status: 'done', rating: 4, finishedAt: ago(40), color: '#3b82f6', added: ago(90) },
    { id: uid(), title: 'رجال حول الرسول', author: 'خالد محمد خالد', pages: 600, read: 0, status: 'want', color: '#a855f7', added: ago(5) },
    { id: uid(), title: 'صيد الخاطر', author: 'ابن الجوزي', pages: 540, read: 60, status: 'reading', color: '#ec4899', added: ago(10) },
  );

  s.inbox = [{ id: uid(), title: 'مرحبًا بك في مُساعِد 👋', body: 'هذه بيانات تجريبية لتستكشف التطبيق. يمكنك حذفها من الإعدادات متى شئت.', icon: '✨', view: 'settings', time: Date.now(), read: false }];

  App.state = s;
  App.save();
  App.applyTheme();
  App.render(true);
};
