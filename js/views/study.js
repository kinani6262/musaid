'use strict';
/* =========================================================
   الدراسة: المؤقت، الامتحانات، الواجبات، الجدول الدراسي، المواد
   ========================================================= */

/* ---------- مؤقت التركيز (بومودورو) ---------- */
App.timer = { mode: 'focus', running: false, endsAt: 0, remaining: null, subject: '', label: '', cycles: 0 };
const TIMER_MODES = { focus: 'تركيز', short: 'استراحة قصيرة', long: 'استراحة طويلة' };
function modeLen(m) { const p = S().pomodoro; return (m === 'focus' ? p.focus : m === 'short' ? p.short : p.long) * 60; }
function fmtClock(sec) { sec = Math.max(0, Math.round(sec)); return pad2(Math.floor(sec / 60)) + ':' + pad2(sec % 60); }

App.timerTick = function () {
  const tm = App.timer;
  if (tm.remaining === null) tm.remaining = modeLen(tm.mode);
  if (tm.running) {
    tm.remaining = Math.max(0, Math.round((tm.endsAt - Date.now()) / 1000));
    if (tm.remaining <= 0) App.timerComplete();
  }
  const el = $('#tm-time');
  if (el) {
    el.textContent = fmtClock(tm.remaining);
    App.localize(el.parentElement);
    const c = $('#tm-ring-c');
    if (c) { const L = Number(c.dataset.len); c.style.strokeDashoffset = L * (1 - (1 - tm.remaining / modeLen(tm.mode))); }
  }
  const pill = $('#timer-pill');
  if (pill) {
    const show = tm.running && !(App.view === 'study' && App._studyTab === 'timer');
    const html = show ? `<button class="pill" data-act="go" data-view="study" data-params='{"tab":"timer"}'><span class="pd"></span>${tm.mode === 'focus' ? '🎯' : '☕'} ${fmtClock(tm.remaining)}</button>` : '';
    if (pill.innerHTML !== html) { pill.innerHTML = html; App.localize(pill); }
  }
};
App.timerComplete = function () {
  const tm = App.timer;
  tm.running = false;
  if (tm.mode === 'focus') {
    const min = S().pomodoro.focus;
    App.state.sessions.push({ id: uid(), subject: tm.subject, min, date: D.today(), note: tm.label || '' });
    tm.cycles++;
    App.save();
    App.notify({ icon: '🎉', title: 'أحسنت! انتهت جلسة التركيز', body: `سُجّلت ${min} دقيقة${tm.label ? ' — ' + tm.label : ''}. خذ استراحة`, view: 'study', params: { tab: 'timer' } });
    tm.mode = tm.cycles % (S().pomodoro.every || 4) === 0 ? 'long' : 'short';
  } else {
    App.notify({ icon: '⏰', title: 'انتهت الاستراحة', body: 'هيا لجلسة تركيز جديدة', view: 'study', params: { tab: 'timer' } });
    tm.mode = 'focus';
  }
  tm.remaining = modeLen(tm.mode);
  if (App.view === 'study') App.refresh();
};
App.on('tm-start', () => {
  const tm = App.timer;
  if (tm.remaining === null || tm.remaining <= 0) tm.remaining = modeLen(tm.mode);
  const sel = $('#tm-subject');
  if (sel) tm.subject = sel.value;
  tm.running = true;
  tm.endsAt = Date.now() + tm.remaining * 1000;
  try { if ('Notification' in window && Notification.permission === 'default' && S().notify) Notification.requestPermission(); } catch (e) { /* */ }
  App.refresh();
});
App.on('tm-pause', () => { App.timer.running = false; App.refresh(); });
App.on('tm-reset', () => { const tm = App.timer; tm.running = false; tm.remaining = modeLen(tm.mode); App.refresh(); });
App.on('tm-skip', () => { App.timer.endsAt = Date.now(); App.timer.running = true; App.timerTick(); });
App.on('tm-mode', el => { const tm = App.timer; tm.mode = el.dataset.id; tm.running = false; tm.remaining = modeLen(tm.mode); App.refresh(); });
App.on('tm-subject', el => { App.timer.subject = el.value; });
App.on('tm-label', el => { App.timer.label = el.value; });
App.on('focus-task', el => {
  const t = byId(App.state.tasks, el.dataset.id);
  const tm = App.timer;
  Object.assign(tm, { mode: 'focus', label: t ? t.title : '', running: true, remaining: modeLen('focus') });
  tm.endsAt = Date.now() + tm.remaining * 1000;
  App.go('study', { tab: 'timer' });
  App.toast('بدأت جلسة تركيز: ' + (t ? t.title : ''), { icon: '🎯' });
});

/* ---------- عرض الدراسة ---------- */
const subjOf = id => byId(App.state.subjects, id) || { name: 'عام', color: '#64748b' };

App.views.study = {
  title: 'الدراسة',
  render(p) {
    const tab = App._studyTab = p.tab || App._studyTab || 'overview';
    const tabs = App.tabs([
      { id: 'overview', label: 'نظرة عامة', icon: 'trend' },
      { id: 'timer', label: 'مؤقّت التركيز', icon: 'timer' },
      { id: 'exams', label: 'الامتحانات', icon: 'note' },
      { id: 'tasks', label: 'الواجبات', icon: 'list' },
      { id: 'table', label: 'الجدول الدراسي', icon: 'week' },
      { id: 'subjects', label: 'المواد', icon: 'book' },
    ], tab, 'study-tab');
    const body = { overview: stOverview, timer: stTimer, exams: stExams, tasks: stTasks, table: stTable, subjects: stSubjects }[tab]();
    return `
      <div class="page-h">
        <div><h2>${ic('study', 'ic-lg')} الدراسة</h2><div class="sub">«وَقُل رَّبِّ زِدْنِي عِلْمًا»</div></div>
        <div class="actions">
          <button class="btn btn-sm" data-act="session-new">${ic('plus')} تسجيل جلسة</button>
          <button class="btn btn-sm btn-primary" data-act="study-tab" data-id="timer">${ic('timer')} ابدأ التركيز</button>
        </div>
      </div>
      <div class="mb">${tabs}</div>${body}`;
  },
};
App.on('study-tab', el => App.go('study', { tab: el.dataset.id }));

function stOverview() {
  const s = App.state, today = D.today();
  const wk = D.weekDays(today);
  const todayMin = sum(s.sessions.filter(x => x.date === today), x => x.min);
  const weekMin = sum(s.sessions.filter(x => x.date >= wk[0] && x.date <= wk[6]), x => x.min);
  let streak = 0;
  for (let k = today, i = 0; i < 400; i++, k = D.add(k, -1)) {
    if (s.sessions.some(x => x.date === k)) streak++;
    else if (k !== today) break;
  }
  const nextExam = s.exams.filter(x => x.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const days14 = Array.from({ length: 14 }, (_, i) => D.add(today, i - 13));
  const chart = days14.map(k => ({ label: String(D.day(k)), values: [sum(s.sessions.filter(x => x.date === k), x => x.min)], tip: `<b>${D.fmt(k, false)}</b><br>${durText(sum(s.sessions.filter(x => x.date === k), x => x.min))}` }));
  const pending = s.assignments.filter(a => !a.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9')).slice(0, 5);
  return `
    <div class="grid g-4 keep-2 mb">
      <div class="card stat"><div class="si" style="--c:#a855f7">⏱️</div><div><div class="sv">${durText(todayMin)}</div><div class="sl">دراسة اليوم</div></div></div>
      <div class="card stat"><div class="si" style="--c:#6366f1">📅</div><div><div class="sv">${hoursText(weekMin)} س</div><div class="sl">هذا الأسبوع</div></div></div>
      <div class="card stat"><div class="si" style="--c:#f97316">🔥</div><div><div class="sv">${streak}</div><div class="sl">أيام متتالية من الدراسة</div></div></div>
      <div class="card stat"><div class="si" style="--c:#22c55e">📎</div><div><div class="sv">${s.assignments.filter(a => !a.done).length}</div><div class="sl">واجبات متبقية</div></div></div>
    </div>
    <div class="grid g-2 mb">
      ${nextExam ? (() => {
        const d = D.diff(today, nextExam.date), sub = subjOf(nextExam.subject);
        const tp = nextExam.topics && nextExam.topics.length ? pct(nextExam.topics.filter(x => x.done).length, nextExam.topics.length) : null;
        return `<div class="card" style="background:linear-gradient(135deg, color-mix(in srgb, ${sub.color} 22%, var(--surface)), var(--surface));cursor:pointer" data-act="study-tab" data-id="exams">
          <div class="small muted">📝 أقرب امتحان</div>
          <div class="flex mt-s" style="gap:16px"><div style="text-align:center"><div class="countdown">${d}</div><div class="tiny muted">${d === 0 ? 'اليوم!' : d === 1 ? 'يوم' : d <= 10 ? 'أيام' : 'يومًا'}</div></div>
          <div class="grow"><div class="bold" style="font-size:1.1rem">${esc(nextExam.title)}</div><div class="small text-2">${esc(sub.name)} · ${D.fmt(nextExam.date, false)}${nextExam.time ? ' · ' + D.time(nextExam.time) : ''}</div>
          ${tp !== null ? `<div class="tiny muted mt-s">تقدّم المراجعة ${tp}%</div>${App.bar(tp, sub.color, 'thin')}` : ''}</div></div>
        </div>`;
      })() : `<div class="card">${App.empty('🎓', 'لا امتحانات قادمة', 'أضف مواعيد امتحاناتك ليصلك عدّ تنازلي وتذكير قبلها', `<button class="btn btn-sm btn-soft" data-act="exam-new">${ic('plus')} امتحان</button>`)}</div>`}
      <div class="card">
        <div class="card-h"><div class="card-t">📊 دقائق الدراسة — آخر 14 يومًا</div></div>
        ${App.chart({ data: chart, series: [{ name: 'دقائق', color: 'var(--s7)' }], height: 170, fmt: v => String(Math.round(v)) })}
      </div>
    </div>
    <div class="grid g-2">
      <div class="card">
        <div class="card-h"><div class="card-t">📚 المواد هذا الأسبوع</div><button class="btn btn-sm btn-ghost" data-act="study-tab" data-id="subjects">إدارة المواد</button></div>
        ${s.subjects.length ? s.subjects.map(sub => {
          const m = sum(s.sessions.filter(x => x.subject === sub.id && x.date >= wk[0] && x.date <= wk[6]), x => x.min);
          const goal = (sub.goal || 0) * 60;
          return `<div class="budget-row" style="grid-template-columns:12px minmax(0,1fr) auto"><span class="subj-dot" style="--c:${sub.color}"></span><div><div class="small bold">${esc(sub.name)}</div><div class="mt-s">${App.bar(goal ? pct(m, goal) : (m ? 100 : 0), sub.color, 'thin')}</div></div><span class="small tnum">${durText(m)}${goal ? ` <span class="muted">/ ${sub.goal} س</span>` : ''}</span></div>`;
        }).join('') : App.empty('📚', 'أضف موادك الدراسية', '', `<button class="btn btn-sm btn-soft" data-act="subject-new">${ic('plus')} مادة</button>`)}
      </div>
      <div class="card">
        <div class="card-h"><div class="card-t">📎 واجبات قريبة</div><button class="btn btn-sm btn-ghost" data-act="study-tab" data-id="tasks">الكل</button></div>
        ${pending.length ? pending.map(assignRow).join('') : `<div class="muted small">لا واجبات معلّقة 🎉</div>`}
      </div>
    </div>`;
}

function stTimer() {
  const s = App.state, tm = App.timer;
  if (tm.remaining === null) tm.remaining = modeLen(tm.mode);
  const size = 260, stroke = 12, r = (size - stroke) / 2, L = 2 * Math.PI * r;
  const prog = 1 - tm.remaining / modeLen(tm.mode);
  const col = tm.mode === 'focus' ? 'var(--ac)' : 'var(--good)';
  const today = D.today();
  const todaySessions = s.sessions.filter(x => x.date === today);
  const P = S().pomodoro;
  return `
    <div class="layout-main">
      <div class="card timer-card">
        ${App.tabs(Object.entries(TIMER_MODES).map(([id, label]) => ({ id, label })), tm.mode, 'tm-mode')}
        <div class="ring-wrap mt" style="width:${size}px;height:${size}px">
          <svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--surface-3)" stroke-width="${stroke}"/>
          <circle id="tm-ring-c" data-len="${L}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${L}" stroke-dashoffset="${L * (1 - prog)}" style="transition:stroke-dashoffset .5s linear"/></svg>
          <div class="rt"><div class="timer-time" id="tm-time">${fmtClock(tm.remaining)}</div><div class="timer-mode">${TIMER_MODES[tm.mode]}${tm.running ? ' · جارٍ' : ''}</div></div>
        </div>
        <div class="flex mt" style="justify-content:center">
          ${tm.running ? `<button class="btn btn-primary" style="min-width:130px;height:46px" data-act="tm-pause">${ic('pause')} إيقاف مؤقت</button>` : `<button class="btn btn-primary" style="min-width:130px;height:46px" data-act="tm-start">${ic('play')} ${tm.remaining < modeLen(tm.mode) ? 'استئناف' : 'ابدأ'}</button>`}
          <button class="icon-btn" style="width:46px;height:46px" data-act="tm-reset" data-tip="إعادة">${ic('reset')}</button>
          <button class="icon-btn" style="width:46px;height:46px" data-act="tm-skip" data-tip="إنهاء الآن">${ic('skip')}</button>
        </div>
        <div class="row mt" style="width:100%;max-width:520px">
          <div class="field"><label>المادة</label><select class="inp" id="tm-subject" data-change="tm-subject"><option value="">— عام —</option>${s.subjects.map(x => `<option value="${x.id}" ${tm.subject === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
          <div class="field"><label>على ماذا تعمل؟</label><input class="inp" value="${esc(tm.label)}" placeholder="مثال: حل تمارين الفصل 4" data-input="tm-label"></div>
        </div>
        <div class="tiny muted">الجلسة الحالية رقم ${tm.cycles + 1} · استراحة طويلة كل ${P.every} جلسات · يمكنك تغيير المدد من الإعدادات</div>
      </div>
      <div class="col" style="gap:16px">
        <div class="card">
          <div class="card-h"><div class="card-t">🍅 جلسات اليوم</div><span class="badge ac">${todaySessions.length}</span></div>
          <div class="flex flex-wrap mb" style="gap:4px">${todaySessions.map(() => '<span style="font-size:1.3rem">🍅</span>').join('') || '<span class="muted small">لم تبدأ بعد — الجلسة الأولى هي الأصعب!</span>'}</div>
          ${todaySessions.slice().reverse().map(x => { const sub = subjOf(x.subject); return `<div class="trow"><span class="subj-dot" style="--c:${sub.color}"></span><div class="grow"><div class="small bold">${esc(sub.name)}${x.note ? ' — ' + esc(x.note) : ''}</div></div><span class="small tnum">${durText(x.min)}</span><button class="icon-btn sm" data-act="session-del" data-id="${x.id}">${ic('x')}</button></div>`; }).join('')}
          <div class="flex between mt-s small"><span class="muted">المجموع</span><b>${durText(sum(todaySessions, x => x.min))}</b></div>
        </div>
        <div class="card">
          <div class="card-t mb">💡 نصائح للتركيز</div>
          <div class="small text-2" style="line-height:2">• أبعد الهاتف عن متناول يدك<br>• حدّد هدفًا صغيرًا واضحًا لكل جلسة<br>• في الاستراحة: تحرك واشرب ماء، لا تتصفح<br>• ابدأ بالمادة الأصعب حين يكون ذهنك صافيًا</div>
        </div>
      </div>
    </div>`;
}

function stExams() {
  const s = App.state, today = D.today();
  const up = s.exams.filter(x => x.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  const past = s.exams.filter(x => x.date < today).sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="flex between mb"><div class="small text-2">${up.length} امتحانات قادمة · يصلك تذكير قبل أسبوع وقبل يوم</div><button class="btn btn-sm btn-primary" data-act="exam-new">${ic('plus')} امتحان</button></div>
    ${up.length ? `<div class="grid g-auto mb">${up.map(x => {
      const sub = subjOf(x.subject), d = D.diff(today, x.date);
      const topics = x.topics || [];
      const tp = pct(topics.filter(t => t.done).length, topics.length);
      return `<div class="card goal-card" style="--c:${sub.color}">
        <div class="flex" style="align-items:flex-start"><div class="grow"><div class="bold">${esc(x.title)}</div><div class="small muted">${esc(sub.name)}${x.place ? ' · 📍 ' + esc(x.place) : ''}</div></div>
          <div style="text-align:center"><div class="countdown" style="font-size:1.6rem;color:${d <= 2 ? 'var(--bad)' : d <= 7 ? 'var(--warn)' : 'var(--text)'}">${d}</div><div class="tiny muted">${d === 0 ? 'اليوم' : 'يوم'}</div></div></div>
        <div class="small text-2">📅 ${D.fmt(x.date, false)}${x.time ? ' · 🕒 ' + D.time(x.time) : ''}</div>
        ${topics.length ? `<div><div class="flex between tiny muted"><span>تقدّم المراجعة</span><span>${tp}%</span></div>${App.bar(tp, sub.color, 'thin')}
          <div class="mt-s">${topics.map(t => `<div class="ms ${t.done ? 'done' : ''}" style="padding:2px 0">${App.chk(t.done, 'topic-toggle', `data-id="${x.id}" data-t="${t.id}"`, sub.color)}<span class="small">${esc(t.text)}</span></div>`).join('')}</div></div>` : ''}
        <div class="flex"><button class="btn btn-sm btn-soft" data-act="exam-plan" data-id="${x.id}" data-tip="ينشئ مهام مراجعة موزّعة على الأيام المتبقية">${ic('sparkles')} خطة مراجعة</button><span class="grow"></span><button class="icon-btn sm" data-act="exam-edit" data-id="${x.id}">${ic('edit')}</button></div>
      </div>`;
    }).join('')}</div>` : `<div class="card mb">${App.empty('📝', 'لا امتحانات قادمة', 'أضف امتحاناتك مع المواضيع المطلوبة لتتابع تقدم مراجعتك')}</div>`}
    ${past.length ? `<div class="card"><div class="card-t mb">🗂️ امتحانات سابقة</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الامتحان</th><th>المادة</th><th>التاريخ</th><th>الدرجة</th><th></th></tr></thead><tbody>
      ${past.map(x => `<tr><td>${esc(x.title)}</td><td>${esc(subjOf(x.subject).name)}</td><td class="num">${D.short(x.date)}</td><td class="bold">${esc(x.grade || '—')}</td><td class="acts"><button class="icon-btn sm" data-act="exam-edit" data-id="${x.id}">${ic('edit')}</button></td></tr>`).join('')}
      </tbody></table></div></div>` : ''}`;
}

function assignRow(a) {
  const sub = subjOf(a.subject);
  const late = a.due && a.due < D.today() && !a.done;
  return `<div class="trow ${a.done ? 'done' : ''}">${App.chk(a.done, 'assign-toggle', `data-id="${a.id}"`, sub.color, 'round')}
    <div class="tt" data-act="assign-edit" data-id="${a.id}"><div class="tn">${esc(a.title)}</div><div class="tm"><span class="chip c" style="--c:${sub.color}">${esc(sub.name)}</span>${a.due ? `<span class="${late ? 'bad' : ''}">📅 ${D.rel(a.due)}</span>` : ''}${a.pri === 'high' ? '<span class="chip c pri-high">مهم</span>' : ''}</div></div></div>`;
}
function stTasks() {
  const s = App.state;
  const open = s.assignments.filter(a => !a.done).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  const done = s.assignments.filter(a => a.done);
  return `<div class="grid g-2">
    <div class="card"><div class="card-h"><div class="card-t">📎 واجبات ومهام دراسية</div><button class="btn btn-sm btn-primary" data-act="assign-new">${ic('plus')} واجب</button></div>
      ${open.length ? open.map(assignRow).join('') : App.empty('🎉', 'لا واجبات معلّقة', 'أحسنت!')}</div>
    <div class="card"><div class="card-h"><div class="card-t">✅ منجزة</div><span class="badge">${done.length}</span></div>
      ${done.length ? done.slice(-15).reverse().map(assignRow).join('') : `<div class="muted small">ستظهر هنا الواجبات المنجزة.</div>`}</div>
  </div>`;
}

function stTable() {
  const s = App.state;
  const order = Array.from({ length: 7 }, (_, i) => (S().weekStart + i) % 7);
  const slots = [...new Set(s.classes.map(c => c.from))].sort();
  const todayDow = D.dow(D.today());
  return `
    <div class="flex between mb"><div class="small text-2">جدول المحاضرات والحصص الأسبوعي الثابت</div><div class="flex"><button class="btn btn-sm btn-ghost" data-act="print">${ic('printer')} طباعة</button><button class="btn btn-sm btn-primary" data-act="class-new">${ic('plus')} حصة / محاضرة</button></div></div>
    ${slots.length ? `<div class="tbl-wrap"><table class="tbl" style="min-width:900px;table-layout:fixed">
      <thead><tr><th style="width:90px">الوقت</th>${order.map(d => `<th class="c" style="${d === todayDow ? 'color:var(--ac)' : ''}">${DAYS[d]}</th>`).join('')}</tr></thead>
      <tbody>${slots.map(sl => `<tr><td class="num small muted">${D.time(sl)}</td>${order.map(d => {
        const cs = s.classes.filter(c => c.day === d && c.from === sl);
        return `<td style="vertical-align:top;${d === todayDow ? 'background:color-mix(in srgb, var(--ac) 5%, transparent)' : ''}">${cs.map(c => { const sub = subjOf(c.subject); return `<div class="mchip" style="--c:${sub.color};display:block;white-space:normal;padding:6px 8px" data-act="class-edit" data-id="${c.id}"><b>${esc(sub.name)}</b><div class="tiny muted">${D.time(c.from)}${c.to ? ' – ' + D.time(c.to) : ''}${c.place ? ' · ' + esc(c.place) : ''}</div></div>`; }).join('')}</td>`;
      }).join('')}</tr>`).join('')}</tbody></table></div>`
    : `<div class="card">${App.empty('🗓️', 'جدولك الدراسي فارغ', 'أضف حصصك أو محاضراتك الأسبوعية لتظهر في جدول منظم')}</div>`}`;
}

function stSubjects() {
  const s = App.state, wk = D.weekDays(D.today());
  return `
    <div class="flex between mb"><div class="small text-2">${s.subjects.length} مواد</div><button class="btn btn-sm btn-primary" data-act="subject-new">${ic('plus')} مادة</button></div>
    ${s.subjects.length ? `<div class="grid g-auto">${s.subjects.map(sub => {
      const total = sum(s.sessions.filter(x => x.subject === sub.id), x => x.min);
      const week = sum(s.sessions.filter(x => x.subject === sub.id && x.date >= wk[0] && x.date <= wk[6]), x => x.min);
      const ex = s.exams.filter(x => x.subject === sub.id && x.date >= D.today()).length;
      return `<div class="card goal-card" style="--c:${sub.color}">
        <div class="flex"><span class="avatar" style="--c:${sub.color}">${esc(sub.name.charAt(0))}</span><div class="grow"><div class="bold">${esc(sub.name)}</div><div class="tiny muted">${esc(sub.teacher || '')}</div></div><button class="icon-btn sm" data-act="subject-edit" data-id="${sub.id}">${ic('edit')}</button></div>
        <div class="grid g-3 keep-2" style="gap:6px;grid-template-columns:repeat(3,1fr)"><div><div class="bold">${hoursText(total)}</div><div class="tiny muted">ساعة إجمالًا</div></div><div><div class="bold">${hoursText(week)}</div><div class="tiny muted">هذا الأسبوع</div></div><div><div class="bold">${ex}</div><div class="tiny muted">امتحانات قادمة</div></div></div>
        ${sub.goal ? `<div><div class="flex between tiny muted"><span>الهدف الأسبوعي ${sub.goal} س</span><span>${pct(week, sub.goal * 60)}%</span></div>${App.bar(pct(week, sub.goal * 60), sub.color, 'thin')}</div>` : ''}
      </div>`;
    }).join('')}</div>` : `<div class="card">${App.empty('📚', 'لا مواد بعد', 'أضف موادك لتتبع وقت المذاكرة لكل منها')}</div>`}`;
}

/* ---------- النماذج والأفعال ---------- */
const subjOptions = () => [['', '— عام —']].concat(App.state.subjects.map(x => [x.id, x.name]));

App.subjectForm = function (x = null) {
  App.form({
    title: x ? 'تعديل المادة' : 'مادة جديدة', icon: '📚',
    values: x || { color: COLORS[(App.state.subjects.length * 3) % COLORS.length], goal: 3 },
    fields: [
      { name: 'name', label: 'اسم المادة', required: true, placeholder: 'مثال: الرياضيات' },
      { type: 'row', fields: [{ name: 'teacher', label: 'المعلّم / الأستاذ' }, { name: 'goal', label: 'هدف أسبوعي (ساعات)', type: 'number', min: 0 }] },
      { name: 'color', label: 'اللون', type: 'color' },
    ],
    onSubmit(v) { App.update(s => { if (x) Object.assign(byId(s.subjects, x.id), v); else s.subjects.push(Object.assign({ id: uid() }, v)); }); },
    onDelete: x ? () => App.withUndo('حُذفت المادة', s => { s.subjects = s.subjects.filter(y => y.id !== x.id); }) : null,
  });
};
App.on('subject-new', () => App.subjectForm());
App.on('subject-edit', el => App.subjectForm(byId(App.state.subjects, el.dataset.id)));

App.examForm = function (x = null, preset = {}) {
  const v = x ? Object.assign({}, x, { topicsText: (x.topics || []).map(t => t.text).join('\n') }) : Object.assign({ date: D.add(D.today(), 7) }, preset);
  App.form({
    title: x ? 'تعديل الامتحان' : 'امتحان جديد', icon: '📝',
    values: v,
    fields: [
      { name: 'title', label: 'عنوان الامتحان', required: true, placeholder: 'مثال: الاختبار النهائي' },
      { name: 'subject', label: 'المادة', type: 'select', options: subjOptions() },
      { type: 'row', fields: [{ name: 'date', label: 'التاريخ', type: 'date', required: true }, { name: 'time', label: 'الوقت', type: 'time' }, { name: 'place', label: 'المكان' }] },
      { name: 'topicsText', label: 'المواضيع المطلوبة للمراجعة (سطر لكل موضوع)', type: 'textarea', rows: 4, placeholder: 'الفصل الأول\nالفصل الثاني\nحل نماذج سابقة' },
      { name: 'grade', label: 'الدرجة (بعد الامتحان)' },
    ],
    onSubmit(f) {
      const old = x ? (x.topics || []) : [];
      f.topics = (f.topicsText || '').split('\n').map(t => t.trim()).filter(Boolean).map(t => { const o = old.find(y => y.text === t); return o || { id: uid(), text: t, done: false }; });
      delete f.topicsText;
      App.update(s => { if (x) Object.assign(byId(s.exams, x.id), f); else s.exams.push(Object.assign({ id: uid() }, f)); });
      App.toast(x ? 'حُفظ الامتحان' : 'أُضيف الامتحان — سأذكّرك قبله', { icon: '📝' });
    },
    onDelete: x ? () => App.withUndo('حُذف الامتحان', s => { s.exams = s.exams.filter(y => y.id !== x.id); }) : null,
  });
};
App.on('exam-new', () => App.examForm());
App.on('exam-edit', el => App.examForm(byId(App.state.exams, el.dataset.id)));
App.on('topic-toggle', el => App.update(s => { const x = byId(s.exams, el.dataset.id); const t = byId(x.topics, el.dataset.t); t.done = !t.done; }));
App.on('exam-plan', el => {
  const x = byId(App.state.exams, el.dataset.id);
  const today = D.today();
  const days = D.diff(today, x.date);
  const topics = (x.topics || []).filter(t => !t.done);
  if (days < 1) { App.toast('الامتحان اليوم! راجع الأهم فالمهم 💪', { icon: '📝' }); return; }
  const items = topics.length ? topics.map(t => t.text) : ['مراجعة عامة'];
  const slots = Math.max(1, days - (days > 2 ? 1 : 0));
  App.confirm(`سأنشئ ${items.length + (days > 2 ? 1 : 0)} مهام مراجعة موزّعة على ${daysAr(days)} قبل الامتحان (مع يوم أخير للمراجعة الشاملة). متابعة؟`, () => {
    App.withUndo('أُنشئت خطة المراجعة في جدولك', s => {
      items.forEach((txt, i) => {
        const day = D.add(today, Math.min(slots - 1, Math.floor((i * slots) / items.length)));
        s.tasks.push({ id: uid(), title: `مراجعة: ${txt} (${x.title})`, date: day, time: '', dur: 60, pri: 'high', cat: 'study', repeat: 'none', days: [], remind: false, notes: '', done: false, doneDates: {}, created: today });
      });
      if (days > 2) s.tasks.push({ id: uid(), title: `مراجعة شاملة وحل نماذج: ${x.title}`, date: D.add(x.date, -1), time: '', dur: 120, pri: 'high', cat: 'study', repeat: 'none', days: [], remind: false, notes: '', done: false, doneDates: {}, created: today });
    });
  }, { ok: 'أنشئ الخطة' });
});

App.assignForm = function (a = null) {
  App.form({
    title: a ? 'تعديل الواجب' : 'واجب جديد', icon: '📎',
    values: a || { due: D.add(D.today(), 3), pri: 'med' },
    fields: [
      { name: 'title', label: 'الواجب', required: true },
      { type: 'row', fields: [{ name: 'subject', label: 'المادة', type: 'select', options: subjOptions() }, { name: 'due', label: 'موعد التسليم', type: 'date' }] },
      { name: 'pri', label: 'الأهمية', type: 'seg', options: [['high', 'مهم'], ['med', 'عادي'], ['low', 'بسيط']] },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
    ],
    onSubmit(v) { App.update(s => { if (a) Object.assign(byId(s.assignments, a.id), v); else s.assignments.push(Object.assign({ id: uid(), done: false }, v)); }); },
    onDelete: a ? () => App.withUndo('حُذف الواجب', s => { s.assignments = s.assignments.filter(y => y.id !== a.id); }) : null,
  });
};
App.on('assign-new', () => App.assignForm());
App.on('assign-edit', el => App.assignForm(byId(App.state.assignments, el.dataset.id)));
App.on('assign-toggle', el => App.update(s => { const a = byId(s.assignments, el.dataset.id); a.done = !a.done; if (a.done) App.chime('done'); }));

App.classForm = function (c = null) {
  App.form({
    title: c ? 'تعديل الحصة' : 'حصة / محاضرة جديدة', icon: '🏫',
    values: c ? Object.assign({}, c, { day: String(c.day) }) : { day: String(D.dow(D.today())), from: '08:00', to: '09:30' },
    fields: [
      { name: 'subject', label: 'المادة', type: 'select', options: subjOptions() },
      { name: 'day', label: 'اليوم', type: 'seg', options: Array.from({ length: 7 }, (_, i) => { const d = (S().weekStart + i) % 7; return [String(d), DAYS[d]]; }) },
      { type: 'row', fields: [{ name: 'from', label: 'من', type: 'time', required: true }, { name: 'to', label: 'إلى', type: 'time' }, { name: 'place', label: 'القاعة / المكان' }] },
    ],
    onSubmit(v) { v.day = Number(v.day); App.update(s => { if (c) Object.assign(byId(s.classes, c.id), v); else s.classes.push(Object.assign({ id: uid() }, v)); }); },
    onDelete: c ? () => App.withUndo('حُذفت الحصة', s => { s.classes = s.classes.filter(y => y.id !== c.id); }) : null,
  });
};
App.on('class-new', () => App.classForm());
App.on('class-edit', el => App.classForm(byId(App.state.classes, el.dataset.id)));

App.on('session-new', () => App.form({
  title: 'تسجيل جلسة دراسة', icon: '⏱️', size: 'narrow',
  values: { date: D.today(), min: 45 },
  fields: [
    { name: 'subject', label: 'المادة', type: 'select', options: subjOptions() },
    { type: 'row', fields: [{ name: 'min', label: 'المدة (دقائق)', type: 'number', min: 1, required: true }, { name: 'date', label: 'التاريخ', type: 'date' }] },
    { name: 'note', label: 'ماذا درست؟' },
  ],
  onSubmit(v) { if (!(v.min > 0)) return false; App.update(s => s.sessions.push(Object.assign({ id: uid() }, v))); App.toast('سُجّلت الجلسة', { icon: '⏱️' }); },
}));
App.on('session-del', el => App.withUndo('حُذفت الجلسة', s => { s.sessions = s.sessions.filter(x => x.id !== el.dataset.id); }));
