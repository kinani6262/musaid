'use strict';
/* =========================================================
   الذكاء: نموذج المهام، الإدخال الطبيعي، الجدولة التلقائية،
   مواقيت الصلاة، التنبيهات، الاقتراحات، التصدير للتقويم
   ========================================================= */

/* ---------- نموذج المهام ---------- */
const PRI_ORDER = { high: 0, med: 1, low: 2 };
const T = {
  cat(id) { return TASK_CATS.find(c => c.id === id) || TASK_CATS[TASK_CATS.length - 1]; },
  recurring(t) { return t.repeat && t.repeat !== 'none'; },
  occurs(t, k) {
    if (!t.date) return false;
    const r = t.repeat || 'none';
    if (r === 'none') return t.date === k;
    if (k < t.date) return false;
    if (t.until && k > t.until) return false;
    if ((t.skip || []).includes(k)) return false;
    switch (r) {
      case 'daily': return true;
      case 'weekdays': return (t.days || []).includes(D.dow(k));
      case 'weekly': return D.dow(k) === D.dow(t.date);
      case 'monthly': return D.day(k) === Math.min(D.day(t.date), D.monthDays(D.mk(k)));
      case 'yearly': return k.slice(5) === t.date.slice(5);
    }
    return false;
  },
  sorter(a, b) {
    const ta = a.time ? D.toMin(a.time) : 9999, tb = b.time ? D.toMin(b.time) : 9999;
    if (ta !== tb) return ta - tb;
    return (PRI_ORDER[a.pri] ?? 1) - (PRI_ORDER[b.pri] ?? 1);
  },
  on(k) { return App.state.tasks.filter(t => T.occurs(t, k)).sort(T.sorter); },
  isDone(t, k) { return T.recurring(t) ? !!(t.doneDates && t.doneDates[k]) : !!t.done; },
  setDone(t, k, v) {
    if (T.recurring(t)) {
      t.doneDates = t.doneDates || {};
      if (v) t.doneDates[k] = 1; else delete t.doneDates[k];
    } else {
      t.done = v;
      t.doneAt = v ? D.today() : null;
    }
  },
  overdue() {
    const today = D.today();
    return App.state.tasks.filter(t => t.date && !T.recurring(t) && t.date < today && !t.done).sort((a, b) => a.date.localeCompare(b.date));
  },
  inbox() { return App.state.tasks.filter(t => !t.date && !t.done); },
  stats(k) {
    const l = T.on(k);
    const done = l.filter(t => T.isDone(t, k)).length;
    return { total: l.length, done, pct: pct(done, l.length) };
  },
  plannedMin(k) { return sum(T.on(k), t => (t.time ? t.dur || 30 : 0)); },
  conflicts(list) {
    const timed = list.filter(t => t.time).map(t => ({ id: t.id, s: D.toMin(t.time), e: D.toMin(t.time) + (t.dur || 30) })).sort((a, b) => a.s - b.s);
    const out = new Set();
    for (let i = 0; i < timed.length; i++)
      for (let j = i + 1; j < timed.length && timed[j].s < timed[i].e; j++) { out.add(timed[i].id); out.add(timed[j].id); }
    return out;
  },
  /** شريحة مهمة قابلة للسحب */
  chip(t, k, { conflict = false, showTime = true } = {}) {
    const c = T.cat(t.cat);
    const done = T.isDone(t, k);
    const rec = T.recurring(t);
    return `<div class="tchip ${done ? 'done' : ''} ${conflict ? 'conflict' : ''}" style="--c:${c.color}" ${rec ? '' : 'draggable="true"'} data-drag="${t.id}" data-act="task-edit" data-id="${t.id}" data-tip="${esc(`${c.icon} ${esc(c.name)} · أولوية ${PRIORITIES[t.pri] || 'متوسطة'}${t.dur ? ' · ' + durText(t.dur) : ''}${conflict ? '<br>⚠️ يتعارض مع مهمة أخرى' : ''}${rec ? '<br>🔁 مهمة متكررة' : ''}`)}">
      ${App.chk(done, 'task-toggle', `data-id="${t.id}" data-date="${k}"`, c.color)}
      <span class="tcn">${esc(t.title)}</span>
      ${showTime && t.time ? `<span class="tct">${D.time(t.time)}</span>` : ''}
      ${rec ? '<span class="tct">🔁</span>' : ''}
    </div>`;
  },
  /** صف مهمة في القوائم */
  row(t, k, { showDate = false } = {}) {
    const c = T.cat(t.cat);
    const done = k ? T.isDone(t, k) : !!t.done;
    const meta = [];
    if (showDate && t.date) meta.push(`<span>📅 ${D.rel(t.date)}</span>`);
    if (t.time) meta.push(`<span>🕒 ${D.time(t.time)}</span>`);
    if (t.dur && t.time) meta.push(`<span>⏱️ ${durText(t.dur)}</span>`);
    meta.push(`<span class="chip c" style="--c:${c.color}">${c.icon} ${esc(c.name)}</span>`);
    if (t.pri === 'high') meta.push(`<span class="chip c pri-high">عالية</span>`);
    if (T.recurring(t)) meta.push('<span>🔁</span>');
    if (t.notes) meta.push('<span>📝</span>');
    return `<div class="trow ${done ? 'done' : ''}">
      ${App.chk(done, 'task-toggle', `data-id="${t.id}" data-date="${k || t.date || ''}"`, c.color, 'round')}
      <div class="tt" data-act="task-edit" data-id="${t.id}"><div class="tn">${esc(t.title)}</div><div class="tm">${meta.join('')}</div></div>
      <div class="tacts">
        ${!done ? `<button class="icon-btn sm" data-act="focus-task" data-id="${t.id}" data-tip="ابدأ جلسة تركيز">${ic('timer')}</button>` : ''}
        <button class="icon-btn sm" data-act="task-edit" data-id="${t.id}" data-tip="تعديل">${ic('edit')}</button>
      </div>
    </div>`;
  },
};

/* أفعال المهام المشتركة */
App.on('task-toggle', el => {
  const t = byId(App.state.tasks, el.dataset.id);
  if (!t) return;
  const k = el.dataset.date || t.date || D.today();
  const v = !T.isDone(t, k);
  T.setDone(t, k, v);
  App.syncHabitFromTask(t, k, v);
  App.save();
  App.refresh();
  if (v) {
    App.chime('done');
    const st = T.stats(k);
    if (k === D.today() && st.total > 1 && st.done === st.total) {
      App.confetti();
      App.toast('ما شاء الله! أنجزت جميع مهام اليوم 🎉', { icon: '🏆' });
    }
  }
});
App.on('task-edit', el => App.taskForm(byId(App.state.tasks, el.dataset.id)));
App.on('task-new', el => {
  const preset = {};
  if (el.dataset.date !== undefined) preset.date = el.dataset.date;
  if (el.dataset.time) preset.time = el.dataset.time;
  if (el.dataset.cat) preset.cat = el.dataset.cat;
  App.taskForm(null, preset);
});
App.on('move-overdue', () => {
  const list = T.overdue();
  if (!list.length) return;
  App.withUndo(`نُقلت ${list.length} مهمة متأخرة إلى اليوم`, () => { list.forEach(t => { t.date = D.today(); }); });
});
App.on('task-to-today', el => {
  const t = byId(App.state.tasks, el.dataset.id);
  if (t) App.update(() => { t.date = D.today(); });
});

App.taskForm = function (t = null, preset = {}) {
  const isNew = !t;
  const v = t ? Object.assign({}, t) : Object.assign({ title: '', date: D.today(), time: '', dur: 30, pri: 'med', cat: 'personal', repeat: 'none', days: [], remind: true, notes: '', until: '' }, preset);
  const durs = [[15, '15 دقيقة'], [30, '30 دقيقة'], [45, '45 دقيقة'], [60, 'ساعة'], [90, 'ساعة ونصف'], [120, 'ساعتان'], [150, 'ساعتان ونصف'], [180, '3 ساعات'], [240, '4 ساعات'], [300, '5 ساعات'], [360, '6 ساعات'], [420, '7 ساعات']];
  if (v.dur && !durs.some(d => d[0] === Number(v.dur))) durs.push([Number(v.dur), durText(v.dur)]);
  App.form({
    title: isNew ? 'مهمة جديدة' : 'تعديل المهمة', icon: isNew ? '✨' : '📝',
    values: v,
    fields: [
      { name: 'title', label: 'عنوان المهمة', required: true, placeholder: 'مثال: مراجعة الفصل الثالث' },
      { type: 'row', fields: [
        { name: 'date', label: 'التاريخ', type: 'date' },
        { name: 'time', label: 'الوقت (اختياري)', type: 'time' },
        { name: 'dur', label: 'المدة', type: 'select', options: durs },
      ] },
      { name: 'pri', label: 'الأولوية', type: 'seg', options: [['high', '🔴 عالية'], ['med', '🟠 متوسطة'], ['low', '🟢 منخفضة']] },
      { name: 'cat', label: 'التصنيف', type: 'seg', options: TASK_CATS.map(c => [c.id, c.icon + ' ' + c.name]) },
      { type: 'row', fields: [
        { name: 'repeat', label: 'التكرار', type: 'select', options: [['none', 'لا يتكرر'], ['daily', 'يوميًا'], ['weekdays', 'أيام محددة من الأسبوع'], ['weekly', 'أسبوعيًا'], ['monthly', 'شهريًا'], ['yearly', 'سنويًا']] },
        { name: 'until', label: 'ينتهي التكرار في (اختياري)', type: 'date' },
      ] },
      { name: 'days', label: 'أيام التكرار', type: 'days' },
      { name: 'remind', label: 'تذكير قبل الموعد بيوم', type: 'switch', hint: 'تنبيه في اليوم السابق، وتنبيه قبل الوقت المحدد بدقائق' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
    ],
    hint: '',
    onMount(m, form) {
      const sync = () => {
        const r = form.elements.repeat.value;
        form.elements.days.closest('.field').style.display = r === 'weekdays' ? '' : 'none';
        form.elements.until.closest('.field').style.display = r === 'none' ? 'none' : '';
      };
      form.elements.repeat.addEventListener('change', sync);
      sync();
    },
    onSubmit(vals) {
      vals.dur = Number(vals.dur) || 30;
      if (vals.repeat !== 'none' && !vals.date) vals.date = D.today();
      if (vals.repeat === 'weekdays' && !vals.days.length) vals.days = [D.dow(vals.date)];
      if (vals.repeat === 'none') vals.until = '';
      App.update(s => {
        if (isNew) s.tasks.push(Object.assign({ id: uid(), done: false, doneDates: {}, created: D.today() }, vals));
        else Object.assign(byId(s.tasks, t.id), vals);
      });
      App.toast(isNew ? 'أُضيفت المهمة' : 'حُفظت التعديلات');
    },
    onDelete: t ? () => App.withUndo('حُذفت المهمة', s => { s.tasks = s.tasks.filter(x => x.id !== t.id); }) : null,
    deleteText: t && T.recurring(t) ? 'هذه مهمة متكررة، سيُحذف التكرار كاملًا. هل تريد المتابعة؟' : undefined,
  });
};

/* ---------- الإدخال بلغة طبيعية ---------- */
const WD_NAMES = [
  ['الأحد', 'الاحد', 'أحد', 'احد'], ['الاثنين', 'الإثنين', 'اثنين'], ['الثلاثاء', 'ثلاثاء'],
  ['الأربعاء', 'الاربعاء', 'أربعاء', 'اربعاء'], ['الخميس', 'خميس'], ['الجمعة', 'الجمعه', 'جمعة'], ['السبت', 'سبت'],
];
const PERIOD = '(صباحا|صباحًا|صباحاً|الصبح|صباح|ص|فجرا|فجرًا|فجراً|ظهرا|ظهرًا|ظهراً|الظهر|عصرا|عصرًا|عصراً|العصر|مساء|مساءً|مساءا|المساء|م|ليلا|ليلًا|ليلاً|بالليل)';
function applyPeriod(h, p) {
  if (!p) return h >= 1 && h <= 6 ? h + 12 : h;
  if (/^(ص|صباح|الصبح|فجر)/.test(p)) return h === 12 ? 0 : h;
  if (/ظهر|الظهر/.test(p)) return h <= 4 ? h + 12 : h;
  if (/ليل|بالليل/.test(p)) return h === 12 ? 0 : (h < 5 ? h : h + 12 > 23 ? h : h + 12);
  return h < 12 ? h + 12 : h; // مساء / م / عصر
}

App.parseTask = function (raw) {
  let s = ' ' + toLatinDigits(raw).replace(/\s+/g, ' ').trim() + ' ';
  const today = D.today();
  const r = { title: '', date: null, time: null, pri: null, cat: null, dur: null };
  const cut = (re, fn) => { s = s.replace(re, (...m) => { const keep = fn(...m); return typeof keep === 'string' ? keep : ' '; }); };

  cut(/\s!!+(?=\s)/, () => { r.pri = 'high'; });
  cut(/\s!(عالية|عالي|مهم|مهمة|1)(?=\s)/, () => { r.pri = 'high'; });
  cut(/\s!(متوسطة|متوسط|2)(?=\s)/, () => { r.pri = 'med'; });
  cut(/\s!(منخفضة|منخفض|3)(?=\s)/, () => { r.pri = 'low'; });
  if (!r.pri && /\s(عاجل|ضروري)\s/.test(s)) r.pri = 'high';
  cut(/\s#(\S+)/, (m, name) => {
    const c = TASK_CATS.find(c => c.name.startsWith(name) || name.startsWith(c.name) || c.id === name);
    if (c) { r.cat = c.id; return ' '; }
    return ' ' + name;
  });

  cut(/\s(?:لمدة|مدة|مدته|لمده)\s*(\d+)?\s*(ساعتين|ساعتان|ساعات|ساعة|ساعه|دقيقة|دقائق|دقيقه|د|س)(?=\s)/, (m, n, u) => {
    n = Number(n || 1);
    if (/ساعتين|ساعتان/.test(u)) r.dur = 120;
    else if (/ساع|^س$/.test(u)) r.dur = n * 60;
    else r.dur = n;
  });
  cut(/\s(?:لمدة|مدة)\s*(نص|نصف)\s*ساعة(?=\s)/, () => { r.dur = 30; });

  cut(/\sبعد\s+(غد|بكر[ةه])(?=\s)/, () => { r.date = D.add(today, 2); });
  cut(/\s(غدا|غدًا|غداً|بكر[ةه])(?=\s)/, () => { r.date = D.add(today, 1); });
  cut(/\s(اليوم|الليلة|الليله)(?=\s)/, () => { r.date = today; });
  cut(/\sبعد\s+(\d+)\s*(يوم|أيام|ايام|يومًا|يوما)(?=\s)/, (m, n) => { r.date = D.add(today, Number(n)); });
  cut(/\sبعد\s+يومين(?=\s)/, () => { r.date = D.add(today, 2); });
  cut(/\s(?:بعد\s+(?:أسبوع|اسبوع)|(?:الأسبوع|الاسبوع)\s+(?:القادم|الجاي))(?=\s)/, () => { r.date = D.add(today, 7); });
  cut(/\s(?:بعد\s+شهر|(?:الشهر)\s+(?:القادم|الجاي))(?=\s)/, () => { r.date = D.addMonths(today, 1); });
  cut(/\s(\d{4})-(\d{1,2})-(\d{1,2})(?=\s)/, (m, y, mo, d) => { r.date = y + '-' + pad2(mo) + '-' + pad2(d); });
  cut(/\s(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?(?=\s)/, (m, d, mo, y) => {
    let yy = y ? Number(y.length === 2 ? '20' + y : y) : new Date().getFullYear();
    let k = yy + '-' + pad2(mo) + '-' + pad2(d);
    if (!y && k < today) k = (yy + 1) + '-' + pad2(mo) + '-' + pad2(d);
    r.date = k;
  });
  WD_NAMES.forEach((names, i) => {
    const re = new RegExp('\\s(يوم\\s+)?(' + names.join('|') + ')(\\s+(?:القادم|الجاي|المقبل))?(?=\\s)');
    if (r.date) return;
    const m = s.match(re);
    if (!m) return;
    let n = (i - D.dow(today) + 7) % 7;
    if (m[3] && n === 0) n = 7;
    r.date = D.add(today, n);
    if (m[1] || m[3]) s = s.replace(re, ' ');
  });

  const frac = (f) => (!f ? 0 : /ربع/.test(f) && /(إلا|الا)/.test(f) ? -15 : /ربع/.test(f) ? 15 : /نص/.test(f) ? 30 : /ثلث/.test(f) ? 20 : 0);
  const setTime = (h, mi, f, p) => {
    h = Number(h); mi = Number(mi || 0);
    if (h > 23 || mi > 59) return false;
    let total = applyPeriod(h, p) * 60 + mi + frac(f);
    r.time = D.fromMin(total);
    return true;
  };
  cut(new RegExp('\\s(?:الساعة|الساعه|ساعة)\\s*(\\d{1,2})(?::(\\d{2}))?(\\s*(?:ونص|ونصف|وربع|وثلث|إلا ربع|الا ربع))?\\s*' + PERIOD + '?(?=\\s)'), (m, h, mi, f, p) => { setTime(h, mi, f, p); });
  if (!r.time) cut(new RegExp('\\s(\\d{1,2}):(\\d{2})\\s*' + PERIOD + '?(?=\\s)'), (m, h, mi, p) => { setTime(h, mi, null, p); });
  if (!r.time) cut(new RegExp('\\s(\\d{1,2})(\\s*(?:ونص|ونصف|وربع|وثلث|إلا ربع|الا ربع))?\\s*' + PERIOD + '(?=\\s)'), (m, h, f, p) => { setTime(h, 0, f, p); });

  r.title = s.replace(/\s+/g, ' ').trim().replace(/^(في|على|يوم|الساعة)\s+/, '').replace(/\s+(في|على|يوم|الساعة)$/, '').trim();
  if (!r.date) r.date = today;
  return r;
};

/* تخمين تصنيف المصروف من النص */
const EXP_KEYWORDS = {
  food: 'قهوة كوفي كافيه مطعم غداء عشاء فطور وجبة بيتزا برجر شاورما مقهى حلويات شاي عصير مشروب',
  transport: 'بنزين وقود أوبر كريم تاكسي مواصلات باص قطار موقف مترو سيارة غسيل',
  grocery: 'بقالة سوبرماركت خضار خضروات فواكه تموينات خبز لحم دجاج',
  bills: 'كهرباء ماء فاتورة انترنت إنترنت جوال هاتف شحن رصيد',
  home: 'إيجار ايجار صيانة أثاث اثاث منزل',
  health: 'صيدلية دواء طبيب مستشفى عيادة تحليل أسنان',
  edu: 'كتاب كتب دورة كورس رسوم مدرسة جامعة قرطاسية',
  fun: 'سينما لعبة ألعاب العاب رحلة نزهة ترفيه',
  shopping: 'ملابس حذاء تسوق مول عطر ساعة',
  charity: 'صدقة هدية تبرع زكاة عيدية',
  subs: 'اشتراك',
};
App.parseExpense = function (raw) {
  let s = toLatinDigits(raw).trim();
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  const amount = m ? Number(m[1].replace(',', '.')) : null;
  if (m) s = s.replace(m[0], ' ');
  s = (' ' + s + ' ').replace(/\s(ريال|ريالات|ر\.س|درهم|دراهم|دينار|جنيه|دولار|ليرة)(?=\s)/g, ' ').replace(/\s+/g, ' ').trim();
  let cat = 'other';
  for (const [k, words] of Object.entries(EXP_KEYWORDS)) {
    if (words.split(' ').some(w => s.includes(w))) { cat = k; break; }
  }
  if (!S().expenseCats.find(c => c.id === cat)) cat = S().expenseCats[0].id;
  return { amount, note: s, cat };
};

/* ---------- الجدولة التلقائية ---------- */
App.autoSchedule = function (k) {
  const st = S();
  const isToday = k === D.today();
  let cursor = st.dayStart * 60;
  if (isToday) cursor = Math.max(cursor, Math.ceil((D.nowMin() + 5) / 15) * 15);
  const end = st.dayEnd * 60 + 59;
  const tasks = T.on(k);
  const busy = tasks.filter(t => t.time).map(t => [D.toMin(t.time), D.toMin(t.time) + (t.dur || 30)]);
  if (st.prayer.show && st.prayer.inDay) {
    Prayer.list(k).filter(p => p.id !== 'sunrise' && !isNaN(p.min)).forEach(p => busy.push([p.min, p.min + 20]));
  }
  busy.sort((a, b) => a[0] - b[0]);
  const todo = tasks.filter(t => !t.time && !T.isDone(t, k) && !T.recurring(t))
    .sort((a, b) => (PRI_ORDER[a.pri] - PRI_ORDER[b.pri]) || ((b.dur || 30) - (a.dur || 30)));
  let placed = 0;
  todo.forEach(t => {
    const dur = t.dur || 30;
    let s = cursor;
    for (let guard = 0; guard < 200; guard++) {
      const clash = busy.find(b => s < b[1] + 5 && s + dur > b[0] - 5);
      if (!clash) break;
      s = Math.ceil((clash[1] + 5) / 5) * 5;
    }
    if (s + dur <= end) {
      t.time = D.fromMin(s);
      busy.push([s, s + dur]);
      busy.sort((a, b) => a[0] - b[0]);
      placed++;
    }
  });
  return { placed, left: todo.length - placed };
};

/* ---------- مواقيت الصلاة ---------- */
const Prayer = {
  NAMES: { fajr: 'الفجر', sunrise: 'الشروق', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' },
  METHODS: {
    makkah: { name: 'أم القرى — مكة المكرمة', fajr: 18.5, ishaMin: 90 },
    mwl: { name: 'رابطة العالم الإسلامي', fajr: 18, isha: 17 },
    egypt: { name: 'الهيئة المصرية العامة للمساحة', fajr: 19.5, isha: 17.5 },
    kuwait: { name: 'الكويت', fajr: 18, isha: 17.5 },
    qatar: { name: 'قطر', fajr: 18, ishaMin: 90 },
    dubai: { name: 'الإمارات', fajr: 18.2, isha: 18.2 },
    karachi: { name: 'جامعة العلوم الإسلامية — كراتشي', fajr: 18, isha: 18 },
    morocco: { name: 'المغرب', fajr: 19, isha: 17 },
    algeria: { name: 'الجزائر', fajr: 18, isha: 17 },
    tunisia: { name: 'تونس', fajr: 18, isha: 18 },
    turkey: { name: 'تركيا', fajr: 18, isha: 17 },
    isna: { name: 'أمريكا الشمالية (ISNA)', fajr: 15, isha: 15 },
  },
  CITIES: [
    ['mecca', 'مكة المكرمة', 21.4225, 39.8262, 'makkah'], ['madinah', 'المدينة المنورة', 24.4686, 39.6142, 'makkah'],
    ['riyadh', 'الرياض', 24.7136, 46.6753, 'makkah'], ['jeddah', 'جدة', 21.4858, 39.1925, 'makkah'],
    ['dammam', 'الدمام', 26.4207, 50.0888, 'makkah'], ['abha', 'أبها', 18.2164, 42.5053, 'makkah'],
    ['tabuk', 'تبوك', 28.3835, 36.5662, 'makkah'], ['qassim', 'بريدة', 26.3592, 43.9818, 'makkah'],
    ['kuwait', 'الكويت', 29.3759, 47.9774, 'kuwait'], ['doha', 'الدوحة', 25.2854, 51.531, 'qatar'],
    ['manama', 'المنامة', 26.2285, 50.586, 'makkah'], ['dubai', 'دبي', 25.2048, 55.2708, 'dubai'],
    ['abudhabi', 'أبوظبي', 24.4539, 54.3773, 'dubai'], ['muscat', 'مسقط', 23.588, 58.3829, 'mwl'],
    ['sanaa', 'صنعاء', 15.3694, 44.191, 'mwl'], ['aden', 'عدن', 12.7855, 45.0187, 'mwl'],
    ['cairo', 'القاهرة', 30.0444, 31.2357, 'egypt'], ['alex', 'الإسكندرية', 31.2001, 29.9187, 'egypt'],
    ['khartoum', 'الخرطوم', 15.5007, 32.5599, 'egypt'], ['amman', 'عمّان', 31.9454, 35.9284, 'mwl'],
    ['quds', 'القدس', 31.7683, 35.2137, 'mwl'], ['gaza', 'غزة', 31.5017, 34.4668, 'mwl'],
    ['damascus', 'دمشق', 33.5138, 36.2765, 'mwl'], ['beirut', 'بيروت', 33.8938, 35.5018, 'mwl'],
    ['baghdad', 'بغداد', 33.3152, 44.3661, 'mwl'], ['tripoli', 'طرابلس', 32.8872, 13.1913, 'mwl'],
    ['tunis', 'تونس', 36.8065, 10.1815, 'tunisia'], ['algiers', 'الجزائر', 36.7538, 3.0588, 'algeria'],
    ['rabat', 'الرباط', 34.0209, -6.8416, 'morocco'], ['casablanca', 'الدار البيضاء', 33.5731, -7.5898, 'morocco'],
    ['nouakchott', 'نواكشوط', 18.0735, -15.9582, 'mwl'], ['istanbul', 'إسطنبول', 41.0082, 28.9784, 'turkey'],
  ],
  _cache: {},
  compute(y, mo, d, lat, lng, tz, m, asrF, ramadan) {
    const DR = Math.PI / 180;
    const sin = x => Math.sin(x * DR), cos = x => Math.cos(x * DR), tan = x => Math.tan(x * DR);
    const asin = x => Math.asin(x) / DR, acos = x => Math.acos(x) / DR, atan2 = (a, b) => Math.atan2(a, b) / DR, acot = x => Math.atan(1 / x) / DR;
    const fixA = a => a - 360 * Math.floor(a / 360);
    const fixH = h => h - 24 * Math.floor(h / 24);
    let Y = y, M = mo;
    if (M <= 2) { Y -= 1; M += 12; }
    const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
    const JD = Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + d + B - 1524.5;
    const jDate = JD - lng / (15 * 24);
    const sunPos = jd => {
      const n = jd - 2451545.0;
      const g = fixA(357.529 + 0.98560028 * n);
      const q = fixA(280.459 + 0.98564736 * n);
      const L = fixA(q + 1.915 * sin(g) + 0.020 * sin(2 * g));
      const e = 23.439 - 0.00000036 * n;
      const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
      return { decl: asin(sin(e) * sin(L)), eqt: q / 15 - fixH(RA) };
    };
    const midDay = t => fixH(12 - sunPos(jDate + t).eqt);
    const angleTime = (angle, t, ccw) => {
      const decl = sunPos(jDate + t).decl;
      const v = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
      if (v > 1 || v < -1) return NaN;
      const h = acos(v) / 15;
      return midDay(t) + (ccw ? -h : h);
    };
    const asrTime = (f, t) => {
      const decl = sunPos(jDate + t).decl;
      return angleTime(-acot(f + tan(Math.abs(lat - decl))), t);
    };
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
      const p = k => t[k] / 24;
      t = {
        fajr: angleTime(m.fajr, p('fajr'), true),
        sunrise: angleTime(0.833, p('sunrise'), true),
        dhuhr: midDay(p('dhuhr')),
        asr: asrTime(asrF, p('asr')),
        sunset: angleTime(0.833, p('sunset')),
        isha: m.isha ? angleTime(m.isha, p('isha')) : 18,
      };
    }
    const adj = tz - lng / 15;
    const H = {};
    Object.keys(t).forEach(k => { H[k] = t[k] + adj; });
    if (m.ishaMin) H.isha = H.sunset + (ramadan ? 120 : m.ishaMin) / 60;
    const toMin = h => (isNaN(h) ? NaN : Math.round(h * 60));
    return { fajr: toMin(H.fajr), sunrise: toMin(H.sunrise), dhuhr: toMin(H.dhuhr), asr: toMin(H.asr), maghrib: toMin(H.sunset), isha: toMin(H.isha) };
  },
  times(k) {
    const p = S().prayer;
    const ck = [k, p.lat, p.lng, p.method, p.asr].join('|');
    if (this._cache[ck]) return this._cache[ck];
    const d = D.parse(k);
    d.setHours(12);
    const tz = -d.getTimezoneOffset() / 60;
    const m = this.METHODS[p.method] || this.METHODS.makkah;
    const ramadan = p.method === 'makkah' && D.hijriMonthNum(k) === 9;
    const res = this.compute(d.getFullYear(), d.getMonth() + 1, d.getDate(), Number(p.lat), Number(p.lng), tz, m, Number(p.asr) || 1, ramadan);
    this._cache[ck] = res;
    return res;
  },
  list(k) {
    const t = this.times(k);
    return Object.keys(this.NAMES).map(id => ({ id, name: this.NAMES[id], min: t[id], time: isNaN(t[id]) ? '' : D.fromMin(t[id]) }));
  },
  next() {
    const now = D.nowMin(), today = D.today();
    const l = this.list(today).filter(p => p.id !== 'sunrise' && !isNaN(p.min));
    const n = l.find(p => p.min > now);
    if (n) return Object.assign({ inMin: n.min - now, day: today }, n);
    const f = this.list(D.add(today, 1)).find(p => p.id === 'fajr');
    return Object.assign({ inMin: f.min + 1440 - now, day: D.add(today, 1) }, f);
  },
  cityName() {
    const p = S().prayer;
    const c = this.CITIES.find(c => c[0] === p.city);
    return c ? c[1] : 'موقع مخصّص';
  },
};

/* ---------- الاقتراحات الذكية ---------- */
App.insights = function () {
  const s = App.state, today = D.today(), out = [];
  const now = D.nowMin();
  const od = T.overdue();
  if (od.length) out.push({ e: '⏰', c: 'var(--bad)', t: `لديك ${od.length === 1 ? 'مهمة متأخرة' : od.length === 2 ? 'مهمتان متأخرتان' : tasksAr(od.length) + ' متأخرة'}`, s: 'اضغط لنقلها إلى اليوم أو مراجعتها', act: 'move-overdue' });
  const st = T.stats(today);
  if (st.total && st.done < st.total) {
    const left = st.total - st.done;
    out.push({ e: '📋', c: 'var(--ac)', t: `${left === 1 ? 'مهمة واحدة متبقية' : left === 2 ? 'مهمتان متبقيتان' : tasksAr(left) + ' متبقية'} اليوم`, s: `أنجزت ${st.pct}% من مهامك`, view: 'day' });
  }
  const unsched = T.on(today).filter(t => !t.time && !T.isDone(t, today) && !T.recurring(t));
  if (unsched.length >= 2) out.push({ e: '✨', c: '#a855f7', t: `${tasksAr(unsched.length)} بلا وقت محدد`, s: 'جرّب «رتّب يومي» لتوزيعها على أوقات فراغك', view: 'day' });

  const tomorrowTasks = T.on(D.add(today, 1)).filter(t => !T.recurring(t));
  if (tomorrowTasks.length) out.push({ e: '📅', c: '#6366f1', t: `غدًا: ${tomorrowTasks.slice(0, 2).map(t => t.title).join('، ')}${tomorrowTasks.length > 2 ? ' و' + (tomorrowTasks.length - 2) + ' أخرى' : ''}`, s: 'استعد مبكرًا', view: 'calendar' });

  s.subscriptions.filter(x => x.active !== false).forEach(x => {
    const d = D.diff(today, x.next);
    if (d >= 0 && d <= 3) out.push({ e: '🔁', c: '#f43f5e', t: `اشتراك «${x.name}» يتجدد ${D.rel(x.next)}`, s: money(x.amount), view: 'subs' });
    if (x.trialEnd) { const td = D.diff(today, x.trialEnd); if (td >= 0 && td <= 3) out.push({ e: '⚠️', c: 'var(--warn)', t: `التجربة المجانية لـ«${x.name}» تنتهي ${D.rel(x.trialEnd)}`, s: 'ألغِ الاشتراك إن لم تعد بحاجة إليه', view: 'subs' }); }
  });
  s.exams.forEach(x => {
    const d = D.diff(today, x.date);
    if (d >= 0 && d <= 7) {
      const sub = byId(s.subjects, x.subject);
      out.push({ e: '📝', c: '#a855f7', t: `امتحان ${sub ? sub.name : ''} «${x.title}» ${D.rel(x.date)}`, s: d <= 2 ? 'وقت المراجعة المكثّفة!' : 'خطّط لجلسات مراجعة', view: 'study', params: { tab: 'exams' } });
    }
  });
  s.debts.filter(x => !x.paid && x.due).forEach(x => {
    const d = D.diff(today, x.due);
    if (d <= 3) out.push({ e: '🤝', c: 'var(--warn)', t: `${x.type === 'borrowed' ? 'سداد دين لـ' : 'استرداد مبلغ من'} ${x.person} ${d < 0 ? '(متأخر)' : D.rel(x.due)}`, s: money(x.amount), view: 'finance', params: { tab: 'debts' } });
  });
  // الميزانية
  const mk = D.mk(today);
  const spent = {};
  s.transactions.filter(t => t.type === 'expense' && D.mk(t.date) === mk).forEach(t => { spent[t.cat] = (spent[t.cat] || 0) + Number(t.amount); });
  S().expenseCats.forEach(c => {
    const b = Number(s.budgets[c.id]) || 0;
    if (!b) return;
    const p = pct(spent[c.id] || 0, b);
    if (p >= 100) out.push({ e: '🚨', c: 'var(--bad)', t: `تجاوزت ميزانية ${c.name}`, s: `${p}% من الميزانية`, view: 'finance', params: { tab: 'budget' } });
    else if (p >= 80) out.push({ e: '💸', c: 'var(--warn)', t: `اقتربت من حد ميزانية ${c.name}`, s: `استهلكت ${p}%`, view: 'finance', params: { tab: 'budget' } });
  });
  const totalBudget = sum(Object.values(s.budgets));
  if (totalBudget) {
    const spentAll = sum(Object.values(spent));
    const day = D.day(today), md = D.monthDays(mk);
    const proj = (spentAll / day) * md;
    if (day >= 5 && proj > totalBudget * 1.05) out.push({ e: '📈', c: 'var(--warn)', t: 'بمعدل إنفاقك الحالي ستتجاوز ميزانية الشهر', s: `المتوقع ${money(Math.round(proj))} من ${money(totalBudget)}`, view: 'finance' });
  }
  // العادات
  const dueHabits = s.habits.filter(h => !h.archived && Habits.isDue(h, today));
  const notDone = dueHabits.filter(h => !Habits.isDoneOn(h, today));
  if (notDone.length && now > 17 * 60) out.push({ e: '🔥', c: '#f97316', t: `${notDone.length} ${notDone.length === 1 ? 'عادة لم تُنجز' : 'عادات لم تُنجز'} بعد اليوم`, s: 'حافظ على سلسلتك قبل نهاية اليوم', view: 'habits' });
  const best = dueHabits.map(h => ({ h, st: Habits.streak(h) })).sort((a, b) => b.st - a.st)[0];
  if (best && best.st >= 7) out.push({ e: '🏅', c: '#f59e0b', t: `سلسلة رائعة: ${best.st} يومًا في «${best.h.name}»`, s: 'استمر، الثبات سرّ النجاح', view: 'habits' });
  // الماء
  const hl = s.health[today] || {};
  if (now > 14 * 60 && (hl.water || 0) < S().waterGoal / 2) out.push({ e: '💧', c: 'var(--info)', t: 'لم تشرب ما يكفي من الماء اليوم', s: `${hl.water || 0} من ${S().waterGoal} أكواب`, view: 'health' });
  if (!out.length) out.push({ e: '🌿', c: 'var(--good)', t: 'كل شيء على ما يرام!', s: 'يومك منظّم، أضف هدفًا جديدًا أو اقرأ شيئًا مفيدًا', view: 'goals' });
  return out;
};
App.insightHtml = (x) => `<div class="insight" style="--c:${x.c}" ${x.act ? `data-act="${x.act}"` : `data-act="go" data-view="${x.view}" data-params='${esc(JSON.stringify(x.params || {}))}'`}><span class="ie">${x.e}</span><div><div class="it">${esc(x.t)}</div>${x.s ? `<div class="is">${esc(x.s)}</div>` : ''}</div></div>`;

/* ---------- فحص التذكيرات (كل نصف دقيقة) ---------- */
App.checkReminders = function () {
  if (!S().notify) return;
  const s = App.state, today = D.today(), tomorrow = D.add(today, 1), now = D.nowMin();
  const batch = [];
  const fire = (key, payload) => {
    if (s.notified[key]) return;
    s.notified[key] = Date.now();
    batch.push(payload);
  };
  // ملخص اليوم
  if (now >= S().dayStart * 60) {
    const st = T.stats(today);
    if (st.total) fire('digest:' + today, { icon: '☀️', title: 'ملخّص يومك', body: `لديك ${tasksAr(st.total)} اليوم، أنجزت منها ${st.done}`, view: 'day', silent: true });
  }
  // قبل الموعد بيوم
  T.on(tomorrow).forEach(t => {
    if (t.remind === false || T.isDone(t, tomorrow)) return;
    if (['daily', 'weekdays', 'weekly'].includes(t.repeat)) {
      // الروتين الأسبوعي بلا وقت (مثل صيام الاثنين والخميس): تذكير مساء اليوم السابق
      if (t.time || t.repeat === 'daily' || now < 20 * 60) return;
      fire('d1:' + t.id + ':' + tomorrow, { icon: '🌙', title: 'غدًا', body: t.title, view: 'week' });
      return;
    }
    fire('d1:' + t.id + ':' + tomorrow, { icon: '📅', title: 'تذكير: موعد غدًا', body: t.title + (t.time ? ' — ' + D.time(t.time) : ''), view: 'calendar' });
  });
  // قبل الوقت بدقائق
  T.on(today).forEach(t => {
    if (!t.time || t.remind === false || T.isDone(t, today)) return;
    const tm = D.toMin(t.time), before = Number(S().notifyMinutes) || 10;
    if (now >= tm - before && now <= tm + 5) fire('t:' + t.id + ':' + today, { icon: '⏰', title: tm - now > 0 ? `بعد ${tm - now} دقيقة` : 'حان الوقت', body: t.title, view: 'day' });
  });
  // الاشتراكات
  s.subscriptions.filter(x => x.active !== false).forEach(x => {
    const d = D.diff(today, x.next);
    const rd = x.remindDays ?? 1;
    if (d >= 0 && d <= rd) fire('s:' + x.id + ':' + x.next, { icon: '🔁', title: 'تجديد اشتراك قريب', body: `${x.name} يتجدد ${D.rel(x.next)} بمبلغ ${money(x.amount)}`, view: 'subs' });
    if (x.trialEnd) { const td = D.diff(today, x.trialEnd); if (td >= 0 && td <= 1) fire('tr:' + x.id + ':' + x.trialEnd, { icon: '⚠️', title: 'نهاية تجربة مجانية', body: `تجربة ${x.name} تنتهي ${D.rel(x.trialEnd)}`, view: 'subs' }); }
  });
  // الامتحانات والواجبات
  s.exams.forEach(x => {
    const d = D.diff(today, x.date);
    if (d === 1) fire('ex1:' + x.id, { icon: '📝', title: 'امتحان غدًا', body: x.title + (x.time ? ' — ' + D.time(x.time) : ''), view: 'study', params: { tab: 'exams' } });
    if (d === 7) fire('ex7:' + x.id, { icon: '📚', title: 'امتحان بعد أسبوع', body: x.title, view: 'study', params: { tab: 'exams' } });
  });
  s.assignments.filter(a => !a.done && a.due).forEach(a => {
    if (D.diff(today, a.due) === 1) fire('as:' + a.id, { icon: '📎', title: 'واجب يُسلَّم غدًا', body: a.title, view: 'study', params: { tab: 'tasks' } });
  });
  // الديون
  s.debts.filter(x => !x.paid && x.due).forEach(x => {
    if (D.diff(today, x.due) === 1) fire('db:' + x.id + ':' + x.due, { icon: '🤝', title: 'موعد دين غدًا', body: `${x.person} — ${money(x.amount)}`, view: 'finance', params: { tab: 'debts' } });
  });
  // تذكير العادات
  s.habits.filter(h => !h.archived && h.remindAt && Habits.isDue(h, today) && !Habits.isDoneOn(h, today)).forEach(h => {
    const tm = D.toMin(h.remindAt);
    if (now >= tm && now <= tm + 30) fire('hb:' + h.id + ':' + today, { icon: h.icon || '🔥', title: 'وقت عادتك', body: h.name, view: 'habits' });
  });
  // تذكير الصلاة القادمة
  if (S().prayer.show && S().prayer.remind) {
    Prayer.list(today).filter(p => p.id !== 'sunrise' && !isNaN(p.min)).forEach(p => {
      if (now >= p.min - 10 && now < p.min) fire('pr:' + p.id + ':' + today, { icon: '🕌', title: `اقترب أذان ${p.name}`, body: `الساعة ${D.time(p.time)}`, view: 'dashboard', silent: false });
    });
  }
  if (!batch.length) return;
  const loud = batch.filter(p => !p.silent);
  if (loud.length <= 2) batch.forEach(p => App.notify(p));
  else {
    // عند تراكم عدة تذكيرات (مثل أول فتح في اليوم) نعرض ملخصًا واحدًا بدل سيل من الإشعارات
    batch.forEach(p => App.notify(Object.assign({}, p, { silent: true, system: false })));
    App.toast(`لديك ${loud.length} تنبيهات جديدة — افتح الجرس 🔔 لعرضها`, { icon: '🔔', ms: 7000 });
    App.chime();
    App.sysNotify('مُساعِد: ' + loud.length + ' تنبيهات جديدة', loud.slice(0, 3).map(p => p.title + ' — ' + p.body).join('\n'));
  }
  const cutoff = Date.now() - 60 * 864e5;
  Object.keys(s.notified).forEach(k => { if (s.notified[k] < cutoff) delete s.notified[k]; });
  App.save();
};

/* ---------- تجديد الاشتراكات تلقائيًا ---------- */
App.processSubscriptions = function () {
  const s = App.state, today = D.today();
  let n = 0;
  s.subscriptions.forEach(x => {
    if (x.active === false || !x.next) return;
    let guard = 0;
    while (x.next < today && guard++ < 60) {
      if (x.autoLog) {
        s.transactions.push({ id: uid(), type: 'expense', amount: Number(x.amount), cat: 'subs', note: 'اشتراك ' + x.name, date: x.next, method: 'بطاقة', auto: true });
        n++;
      }
      x.next = Subs.advance(x.next, x.cycle);
    }
  });
  if (n) App.save();
  return n;
};

/* ---------- تصدير ICS للتقويم ---------- */
App.exportICS = function () {
  const s = App.state, today = D.today();
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Musaid//AR', 'CALSCALE:GREGORIAN'];
  const dt = k => k.replace(/-/g, '');
  const escI = t => String(t || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const ev = (id, title, date, time, dur, rrule, desc, trigger = '-P1D') => {
    lines.push('BEGIN:VEVENT', 'UID:' + id + '@musaid', 'DTSTAMP:' + dt(today) + 'T000000Z', 'SUMMARY:' + escI(title));
    if (time) {
      const st = D.toMin(time), en = st + (dur || 30);
      lines.push('DTSTART:' + dt(date) + 'T' + time.replace(':', '') + '00');
      const endKey = en >= 1440 ? D.add(date, 1) : date;
      lines.push('DTEND:' + dt(endKey) + 'T' + D.fromMin(en).replace(':', '') + '00');
    } else {
      lines.push('DTSTART;VALUE=DATE:' + dt(date), 'DTEND;VALUE=DATE:' + dt(D.add(date, 1)));
    }
    if (rrule) lines.push('RRULE:' + rrule);
    if (desc) lines.push('DESCRIPTION:' + escI(desc));
    if (trigger) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + escI(title), 'TRIGGER:' + trigger, 'END:VALARM');
    lines.push('END:VEVENT');
  };
  let count = 0;
  s.tasks.forEach(t => {
    if (!t.date) return;
    const rec = T.recurring(t);
    if (!rec && (t.date < today || t.done)) return;
    let rr = '';
    if (rec) {
      const until = t.until ? ';UNTIL=' + dt(t.until) : '';
      rr = { daily: 'FREQ=DAILY', weekly: 'FREQ=WEEKLY', monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY', weekdays: 'FREQ=WEEKLY;BYDAY=' + (t.days || []).map(d => BYDAY[d]).join(',') }[t.repeat] + until;
    }
    // الروتين اليومي/الأسبوعي: تنبيه قبل الوقت بدقائق بدل تنبيه يومي مزعج قبلها بيوم،
    // وما كان بلا وقت (مثل الصيام) يُنبَّه له في التاسعة مساء اليوم السابق
    const routine = ['daily', 'weekdays', 'weekly'].includes(t.repeat);
    const trigger = t.remind === false ? '' : routine ? (t.time ? '-PT' + (Number(S().notifyMinutes) || 10) + 'M' : t.repeat === 'daily' ? '' : '-PT3H') : '-P1D';
    // يبدأ التكرار من أول يوم مطابق، حتى لا تضيف بعض التقاويم موعدًا زائدًا في تاريخ البداية
    let start = t.date;
    if (t.repeat === 'weekdays' && (t.days || []).length) while (!t.days.includes(D.dow(start))) start = D.add(start, 1);
    ev(t.id, t.title, start, t.time, t.dur, rr, t.notes, trigger);
    count++;
  });
  s.exams.filter(x => x.date >= today).forEach(x => { ev('ex' + x.id, '📝 امتحان: ' + x.title, x.date, x.time, 120, '', x.place); count++; });
  s.subscriptions.filter(x => x.active !== false && x.next).forEach(x => {
    ev('sub' + x.id, '🔁 تجديد: ' + x.name + ' (' + money(x.amount) + ')', x.next, '', 0, { monthly: 'FREQ=MONTHLY', yearly: 'FREQ=YEARLY', weekly: 'FREQ=WEEKLY', quarterly: 'FREQ=MONTHLY;INTERVAL=3' }[x.cycle] || '', '');
    count++;
  });
  lines.push('END:VCALENDAR');
  App.download('musaid-calendar.ics', lines.join('\r\n'), 'text/calendar');
  App.toast(`صُدِّر ${count} موعدًا بتنبيهاتها — أرسل الملف إلى هاتفك وافتحه هناك لإضافته إلى التقويم`, { icon: '📆', ms: 7000 });
};

App.download = function (name, content, type = 'application/json') {
  const blob = new Blob([content], { type: type + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
};

/* ---------- الإضافة السريعة ---------- */
App.quickAdd = function (mode = 'task') {
  const m = App.modal({
    title: 'إضافة سريعة', icon: '⚡', size: '',
    body: `
      <div class="tabs mb" id="qa-tabs">
        <button class="tab ${mode === 'task' ? 'on' : ''}" data-m="task">📝 مهمة</button>
        <button class="tab ${mode === 'expense' ? 'on' : ''}" data-m="expense">💸 مصروف</button>
        <button class="tab ${mode === 'income' ? 'on' : ''}" data-m="income">💰 دخل</button>
        <button class="tab ${mode === 'note' ? 'on' : ''}" data-m="note">🗒️ ملاحظة</button>
      </div>
      <input class="qa-input" id="qa-input" autocomplete="off">
      <div class="qa-preview" id="qa-preview"></div>
      <div class="qa-help" id="qa-help"></div>`,
    footer: `<button class="btn btn-ghost btn-sm" id="qa-full">نموذج مفصّل</button><span class="spacer"></span><button class="btn btn-ghost" data-close>إلغاء</button><button class="btn btn-primary" id="qa-go">${ic('plus')} إضافة</button>`,
  });
  const inp = $('#qa-input', m.el), prev = $('#qa-preview', m.el), help = $('#qa-help', m.el);
  const HELP = {
    task: { ph: 'مثال: اجتماع الفريق غدًا الساعة 5 مساءً #عمل !عالية', help: 'اكتب بشكل طبيعي وسأفهم: <code>اليوم</code> <code>غدًا</code> <code>بعد 3 أيام</code> <code>يوم الخميس</code> <code>15/11</code> · الوقت: <code>الساعة 4 عصرًا</code> <code>9:30</code> <code>8 ونص م</code> · المدة: <code>لمدة ساعتين</code> · الأولوية: <code>!عالية</code> أو <code>!!</code> · التصنيف: <code>#عمل</code> <code>#دراسة</code> <code>#عبادة</code> <code>#صحة</code> <code>#أسرة</code>' },
    expense: { ph: 'مثال: قهوة 18  أو  بنزين 120', help: 'اكتب الوصف والمبلغ، وسأخمّن التصنيف تلقائيًا (طعام، مواصلات، فواتير...). يُسجَّل بتاريخ اليوم.' },
    income: { ph: 'مثال: راتب 9000  أو  مشروع تصميم 1500', help: 'اكتب مصدر الدخل والمبلغ.' },
    note: { ph: 'اكتب فكرتك أو ملاحظتك...', help: 'تُحفظ في قسم المذكرات ← الملاحظات.' },
  };
  const update = () => {
    $$('#qa-tabs .tab', m.el).forEach(b => b.classList.toggle('on', b.dataset.m === mode));
    inp.placeholder = HELP[mode].ph;
    help.innerHTML = HELP[mode].help;
    const v = inp.value.trim();
    let chips = '';
    if (v && mode === 'task') {
      const p = App.parseTask(v);
      const c = p.cat ? T.cat(p.cat) : null;
      chips = `<span class="chip">📝 ${esc(p.title || '...')}</span><span class="chip">📅 ${D.rel(p.date)} · ${D.short(p.date)}</span>` +
        (p.time ? `<span class="chip">🕒 ${D.time(p.time)}</span>` : '') + (p.dur ? `<span class="chip">⏱️ ${durText(p.dur)}</span>` : '') +
        (p.pri ? `<span class="chip c pri-${p.pri}">أولوية ${PRIORITIES[p.pri]}</span>` : '') + (c ? `<span class="chip c" style="--c:${c.color}">${c.icon} ${c.name}</span>` : '');
    } else if (v && (mode === 'expense' || mode === 'income')) {
      const p = App.parseExpense(v);
      const cats = mode === 'expense' ? S().expenseCats : S().incomeCats;
      let cat = mode === 'expense' ? cats.find(c => c.id === p.cat) : (cats.find(c => p.note.includes(c.name)) || cats[0]);
      chips = `<span class="chip">${p.amount ? '💵 ' + money(p.amount) : '⚠️ اكتب المبلغ'}</span><span class="chip">${cat.icon} ${esc(cat.name)}</span>${p.note ? `<span class="chip">${esc(p.note)}</span>` : ''}`;
    }
    prev.innerHTML = chips;
    App.localize(prev);
  };
  const submit = () => {
    const v = inp.value.trim();
    if (!v) { inp.focus(); return; }
    if (mode === 'task') {
      const p = App.parseTask(v);
      App.update(s => s.tasks.push({ id: uid(), title: p.title || v, date: p.date, time: p.time || '', dur: p.dur || 30, pri: p.pri || 'med', cat: p.cat || 'personal', repeat: 'none', days: [], remind: true, notes: '', done: false, doneDates: {}, created: D.today() }));
      App.toast(`أُضيفت المهمة إلى ${D.rel(p.date)}${p.time ? ' — ' + D.time(p.time) : ''}`);
    } else if (mode === 'expense' || mode === 'income') {
      const p = App.parseExpense(v);
      if (!p.amount) { App.toast('اكتب المبلغ رقمًا', { icon: '✋' }); return; }
      let cat = p.cat;
      if (mode === 'income') cat = (S().incomeCats.find(c => p.note.includes(c.name)) || S().incomeCats[0]).id;
      App.update(s => s.transactions.push({ id: uid(), type: mode, amount: p.amount, cat, note: p.note, date: D.today(), method: S().payMethods[0] }));
      App.toast(`سُجّل ${mode === 'expense' ? 'المصروف' : 'الدخل'}: ${money(p.amount)}`, { icon: mode === 'expense' ? '💸' : '💰' });
    } else {
      App.update(s => s.notes.unshift({ id: uid(), title: '', text: v, color: COLORS[(Math.random() * COLORS.length) | 0], pinned: false, date: D.today() }));
      App.toast('حُفظت الملاحظة', { icon: '🗒️' });
    }
    m.close();
  };
  $('#qa-tabs', m.el).addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { mode = b.dataset.m; update(); inp.focus(); } });
  inp.addEventListener('input', update);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submit(); } });
  $('#qa-go', m.el).addEventListener('click', submit);
  $('#qa-full', m.el).addEventListener('click', () => {
    m.close();
    if (mode === 'task') App.taskForm(null, inp.value.trim() ? (() => { const p = App.parseTask(inp.value); return { title: p.title, date: p.date, time: p.time || '', pri: p.pri || 'med', cat: p.cat || 'personal', dur: p.dur || 30 }; })() : {});
    else if (mode === 'note') App.noteForm && App.noteForm(null);
    else App.txForm && App.txForm(null, mode);
  });
  update();
  setTimeout(() => inp.focus(), 60);
};

/* ---------- البحث الشامل ---------- */
App.search = function () {
  const m = App.modal({
    title: 'بحث في كل شيء', icon: '🔎', size: 'wide',
    body: `<input class="qa-input" id="sr-input" placeholder="ابحث في المهام، الملاحظات، المصاريف، الاشتراكات، الأهداف..." autocomplete="off"><div id="sr-res" class="mt"></div>`,
  });
  const inp = $('#sr-input', m.el), res = $('#sr-res', m.el);
  const run = () => {
    const q = inp.value.trim().toLowerCase();
    if (!q) { res.innerHTML = `<div class="muted small">ابدأ بالكتابة… (اختصار: Ctrl + K)</div>`; return; }
    const s = App.state, out = [];
    const has = t => String(t || '').toLowerCase().includes(q);
    s.tasks.filter(t => has(t.title) || has(t.notes)).slice(0, 12).forEach(t => out.push({ e: T.cat(t.cat).icon, t: t.title, s: t.date ? 'مهمة · ' + D.fmt(t.date) : 'مهمة · صندوق المهام', go: () => App.taskForm(t) }));
    s.notes.filter(n => has(n.title) || has(n.text)).slice(0, 8).forEach(n => out.push({ e: '🗒️', t: n.title || n.text.slice(0, 60), s: 'ملاحظة', go: () => { App.go('journal', { tab: 'notes' }); } }));
    Object.entries(s.journal).filter(([k, j]) => has(j.text)).slice(0, 6).forEach(([k, j]) => out.push({ e: '📔', t: j.text.slice(0, 70), s: 'يوميات · ' + D.fmt(k), go: () => App.go('journal', { tab: 'diary', date: k }) }));
    s.transactions.filter(t => has(t.note)).slice(0, 8).forEach(t => out.push({ e: t.type === 'income' ? '💰' : '💸', t: (t.note || '') + ' — ' + money(t.amount), s: 'عملية مالية · ' + D.fmt(t.date), go: () => App.go('finance', { tab: 'tx' }) }));
    s.subscriptions.filter(x => has(x.name)).forEach(x => out.push({ e: '🔁', t: x.name, s: 'اشتراك · ' + money(x.amount), go: () => App.go('subs') }));
    s.habits.filter(h => has(h.name)).forEach(h => out.push({ e: h.icon, t: h.name, s: 'عادة', go: () => App.go('habits') }));
    s.trackers.filter(h => has(h.name)).forEach(h => out.push({ e: h.icon, t: h.name, s: 'متابعة يومية', go: () => App.go('trackers') }));
    s.goals.filter(g => has(g.title)).forEach(g => out.push({ e: '🎯', t: g.title, s: 'هدف', go: () => App.go('goals') }));
    s.books.filter(b => has(b.title) || has(b.author)).forEach(b => out.push({ e: '📚', t: b.title, s: 'كتاب', go: () => App.go('reading') }));
    s.exams.filter(x => has(x.title)).forEach(x => out.push({ e: '📝', t: x.title, s: 'امتحان · ' + D.fmt(x.date), go: () => App.go('study', { tab: 'exams' }) }));
    res._items = out;
    res.innerHTML = out.length ? out.map((r, i) => `<div class="sr ${i === 0 ? 'on' : ''}" data-i="${i}"><div class="se">${r.e}</div><div class="grow"><div class="bold ellipsis">${esc(r.t)}</div><div class="tiny muted">${esc(r.s)}</div></div></div>`).join('') : App.empty('🔍', 'لا توجد نتائج', 'جرّب كلمة أخرى');
    App.localize(res);
  };
  res.addEventListener('click', e => { const r = e.target.closest('.sr'); if (r) { const it = res._items[r.dataset.i]; m.close(); it.go(); } });
  inp.addEventListener('input', run);
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && res._items && res._items[0]) { m.close(); res._items[0].go(); } });
  run();
  setTimeout(() => inp.focus(), 60);
};
