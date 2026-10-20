'use strict';
/* =========================================================
   صناعة العادات
   ========================================================= */

const Habits = {
  isDue(h, k) {
    if (h.created && k < h.created) return false;
    if (h.freq === 'days') return (h.days || []).includes(D.dow(k));
    if (h.freq === 'alt') return D.diff(h.altStart || h.created || k, k) % 2 === 0; // يوم دون يوم
    return true;
  },
  freqText(h) {
    if (h.freq === 'days') return (h.days || []).map(d => DAYS_S[d]).join('، ');
    return h.freq === 'alt' ? 'يوم دون يوم' : 'يوميًا';
  },
  count(h, k) { return Number((h.log || {})[k]) || 0; },
  isDoneOn(h, k) { return Habits.count(h, k) >= (h.target || 1); },
  streak(h) {
    const today = D.today();
    let k = today, n = 0;
    if (Habits.isDue(h, k) && !Habits.isDoneOn(h, k)) k = D.add(k, -1);
    for (let i = 0; i < 1000; i++) {
      if (h.created && k < h.created) break;
      if (Habits.isDue(h, k)) { if (Habits.isDoneOn(h, k)) n++; else break; }
      k = D.add(k, -1);
    }
    return n;
  },
  best(h) {
    const today = D.today();
    let k = h.created || D.add(today, -365), best = 0, cur = 0;
    for (let i = 0; i < 2000 && k <= today; i++) {
      if (Habits.isDue(h, k)) {
        if (Habits.isDoneOn(h, k)) { cur++; best = Math.max(best, cur); }
        else if (k !== today) cur = 0;
      }
      k = D.add(k, 1);
    }
    return best;
  },
  rate(h, n = 30) {
    const today = D.today();
    let due = 0, done = 0;
    for (let i = 0; i < n; i++) {
      const k = D.add(today, -i);
      if (!Habits.isDue(h, k)) continue;
      if (k === today && !Habits.isDoneOn(h, k)) continue;
      due++;
      if (Habits.isDoneOn(h, k)) done++;
    }
    return pct(done, due);
  },
  total(h) { return Object.keys(h.log || {}).filter(k => Habits.isDoneOn(h, k)).length; },
};

const HABIT_TEMPLATES = [
  { name: 'أذكار الصباح', icon: '🌅', color: '#f59e0b', remindAt: '06:30' },
  { name: 'أذكار المساء', icon: '🌙', color: '#6366f1', remindAt: '17:30' },
  { name: 'ورد القرآن', icon: '📖', color: '#14b8a6', target: 1 },
  { name: 'قيام الليل', icon: '🤲', color: '#7c5cff' },
  { name: 'المشي 30 دقيقة', icon: '🚶', color: '#22c55e' },
  { name: 'شرب 8 أكواب ماء', icon: '💧', color: '#06b6d4', target: 8, unit: 'كوب' },
  { name: 'قراءة 10 صفحات', icon: '📚', color: '#a855f7' },
  { name: 'النوم قبل 11 مساءً', icon: '😴', color: '#3b82f6' },
  { name: 'تمارين رياضية', icon: '💪', color: '#ef4444', freq: 'days', days: [0, 2, 4] },
  { name: 'بلا هاتف قبل النوم', icon: '📵', color: '#64748b' },
  { name: 'صيام الاثنين والخميس', icon: '🌙', color: '#ec4899', freq: 'days', days: [1, 4] },
  { name: 'تعلّم شيء جديد', icon: '🧠', color: '#f97316' },
];

App.views.habits = {
  title: 'صناعة العادات',
  render(p) {
    const s = App.state, today = D.today();
    const base = App._habWeek = p.date || D.today();
    const days = D.weekDays(base);
    const list = s.habits.filter(h => !h.archived);
    const archived = s.habits.filter(h => h.archived);
    const due = list.filter(h => Habits.isDue(h, today));
    const doneToday = due.filter(h => Habits.isDoneOn(h, today)).length;
    const bestStreak = list.reduce((m, h) => Math.max(m, Habits.streak(h)), 0);
    const avgRate = list.length ? Math.round(sum(list, h => Habits.rate(h)) / list.length) : 0;

    const rows = list.map(h => {
      const st = Habits.streak(h), r = Habits.rate(h);
      return `<tr>
        <td><div class="hname" data-act="habit-detail" data-id="${h.id}" style="--c:${h.color}"><span class="hemo">${h.icon}</span><div><div class="bold">${esc(h.name)}</div><div class="tiny muted">${Habits.freqText(h)}${h.target > 1 ? ` · ${h.target} ${esc(h.unit || 'مرات')}` : ''}${h.remindAt ? ' · ⏰ ' + D.time(h.remindAt) : ''}</div></div></div></td>
        ${days.map(k => {
          const isDue = Habits.isDue(h, k), cnt = Habits.count(h, k), done = cnt >= (h.target || 1);
          const fut = k > today;
          if (!isDue) return `<td class="c"><span class="hcell off" style="--c:${h.color}" data-tip="ليس من أيام هذه العادة">·</span></td>`;
          return `<td class="c"><button class="hcell ${done ? 'on' : cnt ? 'part' : ''} ${fut ? 'fut' : ''}" style="--c:${h.color}" ${fut ? 'disabled' : `data-act="habit-tap" data-id="${h.id}" data-date="${k}"`} data-tip="${esc(D.fmt(k, false) + (h.target > 1 ? ` · ${cnt}/${h.target}` : done ? ' · تم ✓' : ''))}">${done ? CHECK_SVG : cnt ? cnt : ''}</button></td>`;
        }).join('')}
        <td class="c"><span class="streak">${st ? '🔥' : ''} ${st}</span></td>
        <td style="min-width:110px"><div class="small tnum">${r}%</div>${App.bar(r, h.color, 'thin')}</td>
        <td class="acts"><button class="icon-btn sm" data-act="habit-edit" data-id="${h.id}">${ic('edit')}</button></td>
      </tr>`;
    }).join('');

    const isThisWeek = days.includes(today);
    return `
      <div class="page-h">
        <div><h2>${ic('flame', 'ic-lg')} صناعة العادات</h2><div class="sub">«أحبّ الأعمال إلى الله أدومها وإن قلّ» — ابدأ صغيرًا واستمر</div></div>
        <div class="actions">
          <button class="icon-btn" data-act="hab-week" data-n="-7">${ic('prev')}</button>
          <button class="btn btn-sm ${isThisWeek ? 'btn-soft' : ''}" data-act="hab-week" data-n="0">هذا الأسبوع</button>
          <button class="icon-btn" data-act="hab-week" data-n="7">${ic('next')}</button>
          <button class="btn btn-sm btn-primary" data-act="habit-new">${ic('plus')} عادة جديدة</button>
        </div>
      </div>
      <div class="grid g-4 keep-2 mb">
        <div class="card stat">${App.ring(pct(doneToday, due.length), { size: 52, stroke: 6, label: pct(doneToday, due.length) + '%', color: '#f97316' })}<div><div class="sv">${doneToday}/${due.length}</div><div class="sl">أُنجزت اليوم</div></div></div>
        <div class="card stat"><div class="si" style="--c:#f97316">🔥</div><div><div class="sv">${bestStreak}</div><div class="sl">أطول سلسلة حالية</div></div></div>
        <div class="card stat"><div class="si" style="--c:#22c55e">📈</div><div><div class="sv">${avgRate}%</div><div class="sl">الالتزام آخر 30 يومًا</div></div></div>
        <div class="card stat"><div class="si" style="--c:#7c5cff">🌱</div><div><div class="sv">${list.length}</div><div class="sl">عادات قيد البناء</div></div></div>
      </div>
      ${list.length ? `
      <div class="tbl-wrap mb">
        <table class="tbl hb">
          <thead><tr><th>العادة</th>${days.map(k => `<th class="c ${k === today ? 'today' : ''}">${D.dayShort(k)}<div class="tiny muted" style="font-weight:400">${D.day(k)}</div></th>`).join('')}<th class="c">السلسلة</th><th>الالتزام</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : `<div class="card mb">${App.empty('🌱', 'ابدأ ببناء عادتك الأولى', 'اختر من الأفكار بالأسفل أو أنشئ عادة خاصة بك')}</div>`}
      <div class="card">
        <div class="card-h"><div class="card-t">${ic('sparkles')} أفكار لعادات نافعة</div><span class="small muted">اضغط لإضافتها مباشرة</span></div>
        <div class="tpl-grid">${HABIT_TEMPLATES.filter(t => !list.find(h => h.name === t.name)).map((t, i) => `<button class="tpl" data-act="habit-tpl" data-i="${HABIT_TEMPLATES.indexOf(t)}"><span class="te">${t.icon}</span>${esc(t.name)}</button>`).join('')}</div>
      </div>
      ${archived.length ? `<div class="card mt"><div class="card-h"><div class="card-t">🗄️ عادات مؤرشفة</div></div>${archived.map(h => `<div class="trow"><span>${h.icon}</span><div class="grow">${esc(h.name)} <span class="tiny muted">· ${Habits.total(h)} مرة</span></div><button class="btn btn-sm btn-ghost" data-act="habit-unarchive" data-id="${h.id}">استعادة</button></div>`).join('')}</div>` : ''}`;
  },
};

App.on('hab-week', el => {
  const n = Number(el.dataset.n);
  App.go('habits', { date: n === 0 ? D.today() : D.add(App._habWeek || D.today(), n) });
});
App.on('habit-tap', el => {
  const h = byId(App.state.habits, el.dataset.id);
  const k = el.dataset.date;
  if (!h) return;
  h.log = h.log || {};
  const target = h.target || 1;
  const was = Habits.isDoneOn(h, k);
  let c = Habits.count(h, k);
  c = target > 1 ? (c >= target ? 0 : c + 1) : (c ? 0 : 1);
  if (c) h.log[k] = c; else delete h.log[k];
  App.state.tasks.filter(t => t.habit === h.id && T.occurs(t, k)).forEach(t => T.setDone(t, k, Habits.isDoneOn(h, k)));
  App.save();
  App.refresh();
  if (!was && Habits.isDoneOn(h, k)) {
    App.chime('done');
    const st = Habits.streak(h);
    if ([7, 21, 30, 40, 66, 100].includes(st)) { App.confetti(); App.toast(`سلسلة ${st} يومًا في «${h.name}» — ما شاء الله! 🔥`, { icon: '🏅' }); }
  }
});
/** مهمة مرتبطة بعادة (مثل قيام الليل والصيام): إنجاز المهمة في الجدول يُنجز العادة معها */
App.syncHabitFromTask = function (t, k, v) {
  const h = t.habit && byId(App.state.habits, t.habit);
  if (!h || !Habits.isDue(h, k)) return;
  h.log = h.log || {};
  if (v) h.log[k] = h.target || 1; else delete h.log[k];
};
App.on('habit-new', () => App.habitForm());
App.on('habit-edit', el => App.habitForm(byId(App.state.habits, el.dataset.id)));
App.on('habit-tpl', el => {
  const t = HABIT_TEMPLATES[Number(el.dataset.i)];
  App.update(s => s.habits.push(Object.assign({ id: uid(), freq: 'daily', days: [], target: 1, unit: '', log: {}, created: D.today(), archived: false }, JSON.parse(JSON.stringify(t)))));
  App.toast(`أُضيفت عادة «${t.name}»`, { icon: t.icon });
});
App.on('habit-unarchive', el => App.update(s => { byId(s.habits, el.dataset.id).archived = false; }));

App.habitForm = function (h = null) {
  App.form({
    title: h ? 'تعديل العادة' : 'عادة جديدة', icon: '🔥',
    values: h ? Object.assign({}, h, { target: h.target || 1 }) : { icon: '🌱', color: COLORS[7], freq: 'daily', days: [], target: 1 },
    fields: [
      { name: 'name', label: 'اسم العادة', required: true, placeholder: 'مثال: قراءة 10 صفحات يوميًا' },
      { name: 'icon', label: 'الرمز', type: 'emoji' },
      { name: 'color', label: 'اللون', type: 'color' },
      { name: 'freq', label: 'التكرار', type: 'seg', options: [['daily', 'كل يوم'], ['alt', 'يوم دون يوم'], ['days', 'أيام محددة']] },
      { name: 'days', label: 'الأيام', type: 'days' },
      { type: 'row', fields: [
        { name: 'target', label: 'عدد المرات في اليوم', type: 'number', min: 1, step: 1, hint: 'مثل 8 أكواب ماء' },
        { name: 'unit', label: 'الوحدة (اختياري)', placeholder: 'كوب، صفحة...' },
        { name: 'remindAt', label: 'وقت التذكير', type: 'time' },
      ] },
      { name: 'why', label: 'لماذا تريد هذه العادة؟', type: 'textarea', rows: 2, placeholder: 'تذكير بدافعك يعينك على الاستمرار' },
    ],
    onMount(m, form) {
      const sync = () => { form.elements.days.closest('.field').style.display = form.elements.freq.value === 'days' ? '' : 'none'; };
      form.elements.freq.addEventListener('change', sync);
      sync();
    },
    onSubmit(v) {
      v.target = Math.max(1, Math.round(v.target || 1));
      if (v.freq === 'days' && !v.days.length) { App.toast('اختر يومًا واحدًا على الأقل', { icon: '✋' }); return false; }
      if (v.freq === 'alt' && !(h && h.freq === 'alt' && h.altStart)) v.altStart = D.today();
      App.update(s => {
        if (h) Object.assign(byId(s.habits, h.id), v);
        else s.habits.push(Object.assign({ id: uid(), log: {}, created: D.today(), archived: false }, v));
      });
    },
    onDelete: h ? () => App.withUndo('حُذفت العادة', s => { s.habits = s.habits.filter(x => x.id !== h.id); }) : null,
    extraBtn: h ? `<button type="button" class="btn btn-sm btn-ghost" id="hab-archive">🗄️ أرشفة</button>` : '',
    onMountExtra: null,
  });
  if (h) setTimeout(() => {
    const b = $('#hab-archive');
    b && b.addEventListener('click', () => { App.closeTopModal(); App.update(s => { byId(s.habits, h.id).archived = true; }); App.toast('أُرشفت العادة', { icon: '🗄️' }); });
  }, 0);
};

App.on('habit-detail', el => {
  const h = byId(App.state.habits, el.dataset.id);
  if (!h) return;
  const today = D.today();
  const weeks = 20;
  const start = D.weekStart(D.add(today, -7 * (weeks - 1)));
  let cells = '';
  for (let i = 0; i < weeks * 7; i++) {
    const k = D.add(start, i);
    if (k > today) { cells += '<i class="nil"></i>'; continue; }
    const c = Habits.count(h, k), t = h.target || 1;
    const lvl = !Habits.isDue(h, k) ? '' : c >= t ? 'l3' : c > 0 ? (c / t >= .5 ? 'l2' : 'l1') : '';
    cells += `<i class="${lvl}" data-tip="${esc(D.fmt(k, false) + (c ? ' · ✓' + (t > 1 ? ` ${c}/${t}` : '') : ''))}"></i>`;
  }
  App.modal({
    title: h.name, icon: h.icon, size: 'wide',
    body: `
      <div class="grid g-4 keep-2 mb">
        <div class="stat"><div class="si" style="--c:${h.color}">🔥</div><div><div class="sv">${Habits.streak(h)}</div><div class="sl">السلسلة الحالية</div></div></div>
        <div class="stat"><div class="si" style="--c:${h.color}">🏆</div><div><div class="sv">${Habits.best(h)}</div><div class="sl">أطول سلسلة</div></div></div>
        <div class="stat"><div class="si" style="--c:${h.color}">✅</div><div><div class="sv">${Habits.total(h)}</div><div class="sl">مرات الإنجاز</div></div></div>
        <div class="stat"><div class="si" style="--c:${h.color}">📈</div><div><div class="sv">${Habits.rate(h, 30)}%</div><div class="sl">التزام 30 يومًا</div></div></div>
      </div>
      <div class="lbl mb">سجل آخر ${weeks} أسبوعًا</div>
      <div class="heat" style="--c:${h.color}">${cells}</div>
      ${h.why ? `<div class="insight mt" style="--c:${h.color};cursor:default"><span class="ie">💭</span><div><div class="is">لماذا بدأت؟</div><div class="it">${esc(h.why)}</div></div></div>` : ''}
      <div class="small muted mt">بدأت في ${D.fmt(h.created || today)} · يقال إن ترسيخ العادة يحتاج في المتوسط نحو 66 يومًا من الاستمرار.</div>`,
    footer: `<button class="btn btn-ghost" data-close>إغلاق</button><button class="btn btn-primary" id="hd-edit">${ic('edit')} تعديل</button>`,
  }).el.querySelector('#hd-edit').addEventListener('click', () => { App.closeTopModal(); App.habitForm(h); });
});
