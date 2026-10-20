'use strict';
/* =========================================================
   الحياة: الأهداف، المذكرات والملاحظات، العافية، القراءة
   ========================================================= */

const MOODS = [
  { e: '😞', l: 'سيئ', c: '#ef4444' }, { e: '😕', l: 'متعب', c: '#f97316' }, { e: '😐', l: 'عادي', c: '#eab308' },
  { e: '🙂', l: 'جيد', c: '#84cc16' }, { e: '😄', l: 'ممتاز', c: '#22c55e' },
];

/* ---------------- الأهداف ---------------- */
const goalProgress = g => (g.milestones && g.milestones.length ? pct(g.milestones.filter(m => m.done).length, g.milestones.length) : Number(g.progress) || 0);
const areaOf = id => S().areas.find(a => a.id === id) || { name: 'عام', icon: '🎯', color: '#7c5cff' };

App.views.goals = {
  title: 'الأهداف',
  render(p) {
    const filter = App._goalFilter = p.filter || App._goalFilter || 'active';
    const all = App.state.goals;
    const list = all.filter(g => filter === 'all' || (filter === 'done' ? g.done : !g.done))
      .sort((a, b) => (a.deadline || '9').localeCompare(b.deadline || '9'));
    const active = all.filter(g => !g.done);
    const avg = active.length ? Math.round(sum(active, goalProgress) / active.length) : 0;
    return `
      <div class="page-h">
        <div><h2>${ic('target', 'ic-lg')} الأهداف</h2><div class="sub">حوّل أحلامك إلى خطوات صغيرة قابلة للقياس</div></div>
        <div class="actions"><button class="btn btn-sm btn-primary" data-act="goal-new">${ic('plus')} هدف جديد</button></div>
      </div>
      <div class="grid g-3 mb">
        <div class="card stat"><div class="si" style="--c:#ec4899">🎯</div><div><div class="sv">${active.length}</div><div class="sl">أهداف قيد العمل</div></div></div>
        <div class="card stat"><div class="si" style="--c:#22c55e">🏆</div><div><div class="sv">${all.length - active.length}</div><div class="sl">أهداف محقّقة</div></div></div>
        <div class="card stat">${App.ring(avg, { size: 52, stroke: 6, label: avg + '%', color: '#ec4899' })}<div><div class="sl">متوسط التقدّم</div></div></div>
      </div>
      <div class="mb">${App.tabs([{ id: 'active', label: 'قيد العمل' }, { id: 'done', label: 'المحقّقة' }, { id: 'all', label: 'الكل' }], filter, 'goal-filter')}</div>
      ${list.length ? `<div class="grid g-auto">${list.map(g => {
        const a = areaOf(g.area), pr = goalProgress(g);
        const dl = g.deadline ? D.diff(D.today(), g.deadline) : null;
        return `<div class="card goal-card" style="--c:${a.color};${g.done ? 'opacity:.75' : ''}">
          <div class="flex" style="align-items:flex-start;gap:12px">
            ${App.ring(pr, { size: 58, stroke: 6, label: pr + '%', color: a.color })}
            <div class="grow"><div class="bold" style="font-size:1.02rem">${g.done ? '🏆 ' : ''}${esc(g.title)}</div>
              <div class="flex flex-wrap mt-s" style="gap:5px"><span class="chip c" style="--c:${a.color}">${a.icon} ${esc(a.name)}</span>${dl !== null ? `<span class="chip ${dl < 0 && !g.done ? 'c' : ''}" style="--c:var(--bad)">⏳ ${dl < 0 ? 'انتهى الموعد' : D.rel(g.deadline)}</span>` : ''}</div></div>
            <button class="icon-btn sm" data-act="goal-edit" data-id="${g.id}">${ic('edit')}</button>
          </div>
          ${g.why ? `<div class="small text-2">💭 ${esc(g.why)}</div>` : ''}
          <div>${(g.milestones || []).map(m => `<div class="ms ${m.done ? 'done' : ''}">${App.chk(m.done, 'ms-toggle', `data-g="${g.id}" data-id="${m.id}"`, a.color)}<span class="grow">${esc(m.text)}</span><button class="icon-btn sm" data-act="ms-del" data-g="${g.id}" data-id="${m.id}">${ic('x')}</button></div>`).join('')}
            ${!g.done ? `<div class="flex mt-s"><input class="inp inp-sm grow ms-inp" data-g="${g.id}" placeholder="أضف خطوة ثم Enter"><button class="btn btn-sm btn-ghost" data-act="ms-add" data-g="${g.id}">${ic('plus')}</button></div>` : ''}</div>
          ${!g.done && pr >= 100 ? `<button class="btn btn-primary btn-sm" data-act="goal-done" data-id="${g.id}">🏆 أعلن تحقيق الهدف</button>` : ''}
        </div>`;
      }).join('')}</div>` : `<div class="card">${App.empty('🎯', filter === 'done' ? 'لم تحقق أهدافًا بعد — قريبًا بإذن الله' : 'لا أهداف بعد', 'اكتب هدفًا واضحًا، وقسّمه إلى خطوات، وحدد له موعدًا', `<button class="btn btn-primary btn-sm" data-act="goal-new">${ic('plus')} هدفي الأول</button>`)}</div>`}`;
  },
  after() {
    $$('.ms-inp').forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') App.acts['ms-add']({ dataset: { g: i.dataset.g } }); }));
  },
};
App.on('goal-filter', el => App.go('goals', { filter: el.dataset.id }));
App.on('goal-new', () => App.goalForm());
App.on('goal-edit', el => App.goalForm(byId(App.state.goals, el.dataset.id)));
App.on('ms-add', el => {
  const inp = $(`.ms-inp[data-g="${el.dataset.g}"]`);
  const v = inp && inp.value.trim();
  if (!v) { inp && inp.focus(); return; }
  App.update(s => { const g = byId(s.goals, el.dataset.g); (g.milestones = g.milestones || []).push({ id: uid(), text: v, done: false }); });
  setTimeout(() => { const i = $(`.ms-inp[data-g="${el.dataset.g}"]`); i && i.focus(); }, 0);
});
App.on('ms-toggle', el => App.update(s => { const m = byId(byId(s.goals, el.dataset.g).milestones, el.dataset.id); m.done = !m.done; if (m.done) App.chime('done'); }));
App.on('ms-del', el => App.update(s => { const g = byId(s.goals, el.dataset.g); g.milestones = g.milestones.filter(m => m.id !== el.dataset.id); }));
App.on('goal-done', el => { App.update(s => { const g = byId(s.goals, el.dataset.id); g.done = true; g.doneAt = D.today(); }); App.confetti(); App.toast('مبارك! هدف جديد تحقّق 🏆', { icon: '🎉' }); });

App.goalForm = function (g = null) {
  App.form({
    title: g ? 'تعديل الهدف' : 'هدف جديد', icon: '🎯',
    values: g ? Object.assign({}, g, { msText: '' }) : { area: S().areas[0].id, progress: 0 },
    fields: [
      { name: 'title', label: 'الهدف', required: true, placeholder: 'مثال: حفظ سورة البقرة' },
      { type: 'row', fields: [
        { name: 'area', label: 'المجال', type: 'select', options: S().areas.map(a => [a.id, a.icon + ' ' + a.name]) },
        { name: 'deadline', label: 'الموعد المستهدف', type: 'date' },
      ] },
      { name: 'why', label: 'لماذا هذا الهدف مهم لك؟', type: 'textarea', rows: 2 },
      ...(g ? [] : [{ name: 'msText', label: 'الخطوات (سطر لكل خطوة)', type: 'textarea', rows: 3, placeholder: 'الخطوة الأولى\nالخطوة الثانية' }]),
      { name: 'progress', label: 'نسبة التقدّم اليدوية % (عند عدم وجود خطوات)', type: 'number', min: 0, max: 100 },
      ...(g ? [{ name: 'done', label: 'تم تحقيق الهدف', type: 'switch' }] : []),
    ],
    onSubmit(v) {
      const ms = (v.msText || '').split('\n').map(t => t.trim()).filter(Boolean).map(t => ({ id: uid(), text: t, done: false }));
      delete v.msText;
      v.progress = clamp(v.progress || 0, 0, 100);
      App.update(s => { if (g) Object.assign(byId(s.goals, g.id), v); else s.goals.push(Object.assign({ id: uid(), milestones: ms, done: false, created: D.today() }, v)); });
    },
    onDelete: g ? () => App.withUndo('حُذف الهدف', s => { s.goals = s.goals.filter(x => x.id !== g.id); }) : null,
  });
};

/* ---------------- المذكرات والملاحظات ---------------- */
App.views.journal = {
  title: 'المذكرات',
  render(p) {
    const tab = App._jTab = p.tab || App._jTab || 'diary';
    const tabs = App.tabs([{ id: 'diary', label: 'اليوميات', icon: 'journal' }, { id: 'notes', label: 'الملاحظات', icon: 'note' }], tab, 'j-tab');
    return `
      <div class="page-h">
        <div><h2>${ic('journal', 'ic-lg')} المذكرات</h2><div class="sub">دوّن يومك، واحفظ أفكارك قبل أن تطير</div></div>
        <div class="actions">${tab === 'notes' ? `<button class="btn btn-sm btn-primary" data-act="note-new">${ic('plus')} ملاحظة</button>` : ''}</div>
      </div>
      <div class="mb">${tabs}</div>
      ${tab === 'diary' ? diaryView(p) : notesView()}`;
  },
};
App.on('j-tab', el => App.go('journal', { tab: el.dataset.id }));

function diaryView(p) {
  const s = App.state, today = D.today();
  const k = App._jDate = p.date || App._jDate || today;
  const j = s.journal[k] || {};
  const grat = j.grat || ['', '', ''];
  const mk = D.mk(k), md = D.monthDays(mk);
  const first = mk + '-01';
  const pads = (D.dow(first) - S().weekStart + 7) % 7;
  const recent = Object.keys(s.journal).filter(x => s.journal[x].text || s.journal[x].mood).sort().reverse().slice(0, 6);
  return `
    <div class="layout-side">
      <div class="card">
        <div class="card-h">
          <div><div class="card-t">${D.fmt(k)}</div><div class="tiny muted">${S().showHijri ? D.hijri(k) + ' · ' : ''}${D.rel(k)}</div></div>
          <div class="flex"><button class="icon-btn" data-act="j-nav" data-n="-1">${ic('prev')}</button><button class="btn btn-sm ${k === today ? 'btn-soft' : ''}" data-act="j-nav" data-n="0">اليوم</button><button class="icon-btn" data-act="j-nav" data-n="1" ${k >= today ? 'disabled style="opacity:.4"' : ''}>${ic('next')}</button></div>
        </div>
        <div class="lbl mb">كيف كان يومك؟</div>
        <div class="moods mb">${MOODS.map((m, i) => `<button class="mood ${j.mood === i + 1 ? 'on' : ''}" data-act="j-mood" data-date="${k}" data-v="${i + 1}" data-tip="${m.l}">${m.e}</button>`).join('')}</div>
        <div class="field"><label>يومياتي</label><textarea class="inp" rows="7" placeholder="ماذا حدث اليوم؟ بماذا تشعر؟ ما الذي يشغل بالك؟" data-input="j-text" data-date="${k}">${esc(j.text || '')}</textarea></div>
        <div class="lbl mb">🤍 ثلاثة أشياء أحمد الله عليها اليوم</div>
        ${grat.map((g, i) => `<input class="inp mb" style="margin-bottom:8px" value="${esc(g)}" placeholder="${i + 1}. ..." data-input="j-grat" data-date="${k}" data-i="${i}">`).join('')}
        <div class="field mt-s" style="margin-bottom:0"><label>💡 درس تعلّمته اليوم</label><input class="inp" value="${esc(j.lesson || '')}" data-input="j-lesson" data-date="${k}"></div>
        <div class="tiny muted mt-s">يُحفظ تلقائيًا أثناء الكتابة ✓</div>
      </div>
      <div class="col" style="gap:16px">
        <div class="card">
          <div class="card-t mb">🗓️ مزاج ${MONTHS[Number(mk.slice(5)) - 1]}</div>
          <div class="cal" style="gap:4px">${Array.from({ length: 7 }, (_, i) => `<div class="cal-h" style="padding:0">${DAYS_S[(S().weekStart + i) % 7].slice(0, 2)}</div>`).join('')}
            ${'<div></div>'.repeat(pads)}${Array.from({ length: md }, (_, i) => {
              const dk = mk + '-' + pad2(i + 1), e = s.journal[dk];
              return `<button class="em" style="width:100%;height:34px;font-size:${e && e.mood ? '1rem' : '.72rem'};${dk === k ? 'border-color:var(--ac)' : ''};${dk > today ? 'opacity:.35' : ''}" data-act="j-go" data-date="${dk}" ${dk > today ? 'disabled' : ''}>${e && e.mood ? MOODS[e.mood - 1].e : i + 1}</button>`;
            }).join('')}</div>
        </div>
        <div class="card">
          <div class="card-t mb">📖 تدوينات سابقة</div>
          ${recent.length ? recent.map(x => `<div class="trow" style="cursor:pointer" data-act="j-go" data-date="${x}"><span style="font-size:1.2rem">${s.journal[x].mood ? MOODS[s.journal[x].mood - 1].e : '📝'}</span><div class="grow"><div class="small bold">${D.fmt(x, false)}</div><div class="tiny muted ellipsis">${esc((s.journal[x].text || '').slice(0, 60)) || '—'}</div></div></div>`).join('') : `<div class="muted small">ستظهر تدويناتك هنا.</div>`}
        </div>
      </div>
    </div>`;
}
const jEntry = k => (App.state.journal[k] = App.state.journal[k] || {});
let _jTimer;
const jSave = () => { clearTimeout(_jTimer); _jTimer = setTimeout(App.save, 400); };
App.on('j-nav', el => {
  const n = Number(el.dataset.n);
  App.go('journal', { tab: 'diary', date: n === 0 ? D.today() : D.add(App._jDate || D.today(), n) });
});
App.on('j-go', el => App.go('journal', { tab: 'diary', date: el.dataset.date }));
App.on('j-mood', el => App.update(() => { const e = jEntry(el.dataset.date); const v = Number(el.dataset.v); e.mood = e.mood === v ? 0 : v; }));
App.on('j-text', el => { jEntry(el.dataset.date).text = el.value; jSave(); });
App.on('j-lesson', el => { jEntry(el.dataset.date).lesson = el.value; jSave(); });
App.on('j-grat', el => { const e = jEntry(el.dataset.date); e.grat = e.grat || ['', '', '']; e.grat[Number(el.dataset.i)] = el.value; jSave(); });

function notesView() {
  const q = App._noteQ || '';
  const list = App.state.notes.filter(n => !q || (n.title + ' ' + n.text).includes(q)).sort((a, b) => (b.pinned - a.pinned));
  return `
    <div class="flex mb"><input class="inp" style="max-width:360px" placeholder="ابحث في الملاحظات..." value="${esc(q)}" data-change="note-q"></div>
    ${list.length ? `<div class="notes-grid">${list.map(n => `<div class="note" style="--c:${n.color}" data-act="note-edit" data-id="${n.id}">
      ${n.pinned ? '<span class="pin">📌</span>' : ''}${n.title ? `<h4>${esc(n.title)}</h4>` : ''}<p>${esc(n.text)}</p>
      <div class="tiny muted mt-s">${n.date ? D.rel(n.date) : ''}</div></div>`).join('')}</div>`
    : `<div class="card">${App.empty('🗒️', 'لا ملاحظات', 'اكتب أفكارك، قوائم المشتريات، الأشياء التي تريد تذكرها...', `<button class="btn btn-primary btn-sm" data-act="note-new">${ic('plus')} ملاحظة</button>`)}</div>`}`;
}
App.on('note-q', el => { App._noteQ = el.value.trim(); App.refresh(); });
App.noteForm = function (n = null) {
  App.form({
    title: n ? 'تعديل الملاحظة' : 'ملاحظة جديدة', icon: '🗒️',
    values: n || { color: COLORS[6] },
    fields: [
      { name: 'title', label: 'العنوان (اختياري)' },
      { name: 'text', label: 'المحتوى', type: 'textarea', rows: 6, required: true },
      { name: 'color', label: 'اللون', type: 'color' },
      { name: 'pinned', label: 'تثبيت في الأعلى', type: 'switch' },
    ],
    onSubmit(v) { App.update(s => { if (n) Object.assign(byId(s.notes, n.id), v); else s.notes.unshift(Object.assign({ id: uid(), date: D.today() }, v)); }); },
    onDelete: n ? () => App.withUndo('حُذفت الملاحظة', s => { s.notes = s.notes.filter(x => x.id !== n.id); }) : null,
  });
};
App.on('note-new', () => App.noteForm());
App.on('note-edit', el => App.noteForm(byId(App.state.notes, el.dataset.id)));

/* ---------------- العافية ---------------- */
const HEALTH_KEYS = [
  { k: 'water', l: 'الماء', u: 'كوب', e: '💧', step: 1 },
  { k: 'sleep', l: 'النوم', u: 'ساعة', e: '😴', step: 0.5 },
  { k: 'exercise', l: 'الرياضة', u: 'دقيقة', e: '🏃', step: 5 },
  { k: 'steps', l: 'الخطوات', u: 'خطوة', e: '👣', step: 500 },
  { k: 'weight', l: 'الوزن', u: 'كجم', e: '⚖️', step: 0.1 },
];
App.views.health = {
  title: 'العافية',
  render() {
    const s = App.state, today = D.today();
    const h = s.health[today] || {};
    const days14 = Array.from({ length: 14 }, (_, i) => D.add(today, -i));
    const last7 = days14.slice(0, 7);
    const avg = (key, ks) => { const v = ks.map(k => (s.health[k] || {})[key]).filter(x => x !== undefined && x !== null && x !== ''); return v.length ? sum(v) / v.length : 0; };
    const weights = Object.keys(s.health).filter(k => s.health[k].weight).sort().slice(-30);
    const wChange = weights.length > 1 ? s.health[weights[weights.length - 1]].weight - s.health[weights[0]].weight : 0;
    const sleepData = days14.slice().reverse().map(k => ({ label: String(D.day(k)), values: [(s.health[k] || {}).sleep || 0], tip: `<b>${D.fmt(k, false)}</b><br>${(s.health[k] || {}).sleep || 0} ساعة نوم` }));
    return `
      <div class="page-h">
        <div><h2>${ic('heart', 'ic-lg')} العافية</h2><div class="sub">«نعمتان مغبون فيهما كثير من الناس: الصحة والفراغ»</div></div>
      </div>
      <div class="grid g-4 keep-2 mb">
        <div class="card stat"><div class="si" style="--c:var(--info)">💧</div><div><div class="sv">${avg('water', last7).toFixed(1)}</div><div class="sl">متوسط أكواب الماء (7 أيام)</div></div></div>
        <div class="card stat"><div class="si" style="--c:#6366f1">😴</div><div><div class="sv">${avg('sleep', last7).toFixed(1)} س</div><div class="sl">متوسط النوم</div></div></div>
        <div class="card stat"><div class="si" style="--c:#ef4444">🏃</div><div><div class="sv">${sum(last7, k => (s.health[k] || {}).exercise || 0)} د</div><div class="sl">رياضة آخر 7 أيام</div></div></div>
        <div class="card stat"><div class="si" style="--c:#22c55e">⚖️</div><div><div class="sv">${weights.length ? s.health[weights[weights.length - 1]].weight : '—'}</div><div class="sl">الوزن الحالي ${weights.length > 1 ? `<span class="${wChange <= 0 ? 'good' : 'warn'}">(${wChange > 0 ? '+' : ''}${wChange.toFixed(1)})</span>` : ''}</div></div></div>
      </div>
      <div class="grid g-2 mb">
        <div class="card">
          <div class="card-h"><div class="card-t">📍 اليوم</div><span class="small muted">${D.fmt(today, false)}</span></div>
          <div class="lbl mb">💧 الماء: ${h.water || 0} من ${S().waterGoal} أكواب</div>
          <div class="glasses mb">${Array.from({ length: S().waterGoal }, (_, i) => `<button class="glass ${i < (h.water || 0) ? 'on' : ''}" data-act="water-set" data-n="${i + 1}" data-date="${today}"></button>`).join('')}</div>
          <div class="row">${HEALTH_KEYS.filter(x => x.k !== 'water').map(x => `<div class="field"><label>${x.e} ${x.l} (${x.u})</label><input class="inp" type="number" step="${x.step}" min="0" inputmode="decimal" value="${h[x.k] ?? ''}" data-change="health-set" data-date="${today}" data-k="${x.k}"></div>`).join('')}</div>
        </div>
        <div class="card">
          <div class="card-h"><div class="card-t">😴 ساعات النوم — آخر 14 يومًا</div></div>
          ${App.chart({ data: sleepData, series: [{ name: 'النوم', color: 'var(--s7)' }], height: 200, goal: S().sleepGoal, goalLabel: 'الهدف ' + S().sleepGoal + ' س', fmt: v => String(Math.round(v * 10) / 10) })}
        </div>
      </div>
      <div class="grid g-2">
        <div class="tbl-wrap">
          <table class="tbl"><thead><tr><th>اليوم</th>${HEALTH_KEYS.map(x => `<th class="c">${x.e} ${x.l}</th>`).join('')}</tr></thead>
          <tbody>${days14.map(k => { const d = s.health[k] || {}; return `<tr><td class="small nowrap">${k === today ? '<b>اليوم</b>' : D.dayShort(k) + ' ' + D.day(k)}</td>${HEALTH_KEYS.map(x => `<td class="c"><input class="tbl-inp" type="number" step="${x.step}" min="0" value="${d[x.k] ?? ''}" data-change="health-set" data-date="${k}" data-k="${x.k}" aria-label="${x.l}"></td>`).join('')}</tr>`; }).join('')}</tbody></table>
        </div>
        <div class="card">
          <div class="card-h"><div class="card-t">⚖️ منحنى الوزن</div></div>
          ${weights.length > 1 ? App.chart({ kind: 'line', data: weights.map(k => ({ label: D.short(k), value: s.health[k].weight })), color: 'var(--s3)', height: 220, fmt: v => (Math.round(v * 10) / 10).toString() }) : App.empty('⚖️', 'سجّل وزنك في يومين على الأقل', 'ليظهر منحنى التغيّر')}
        </div>
      </div>`;
  },
};
App.on('health-set', el => {
  const v = el.value === '' ? null : Number(toLatinDigits(el.value));
  App.update(s => {
    const h = s.health[el.dataset.date] = s.health[el.dataset.date] || {};
    if (v === null || isNaN(v)) delete h[el.dataset.k]; else h[el.dataset.k] = v;
  });
});

/* ---------------- القراءة ---------------- */
App.views.reading = {
  title: 'القراءة',
  render(p) {
    const tab = App._bookTab = p.tab || App._bookTab || 'reading';
    const s = App.state, year = String(new Date().getFullYear());
    const finishedYear = s.books.filter(b => b.status === 'done' && (b.finishedAt || '').startsWith(year));
    const pagesYear = sum(finishedYear, b => b.pages);
    const list = s.books.filter(b => b.status === tab);
    const counts = { reading: 0, want: 0, done: 0 };
    s.books.forEach(b => counts[b.status]++);
    return `
      <div class="page-h">
        <div><h2>${ic('book', 'ic-lg')} القراءة</h2><div class="sub">«اقرأ» أول ما نزل — اجعل لك وردًا من القراءة كل يوم</div></div>
        <div class="actions"><button class="btn btn-sm btn-primary" data-act="book-new">${ic('plus')} كتاب</button></div>
      </div>
      <div class="grid g-3 mb">
        <div class="card stat">${App.ring(pct(finishedYear.length, S().readingGoal), { size: 70, stroke: 8, label: finishedYear.length + '/' + S().readingGoal, color: '#f59e0b' })}<div><div class="bold">تحدي القراءة ${year}</div><div class="sl">كتب أنهيتها من هدفك السنوي</div><button class="btn btn-sm btn-ghost" style="padding:0" data-act="reading-goal">تعديل الهدف</button></div></div>
        <div class="card stat"><div class="si" style="--c:#a855f7">📄</div><div><div class="sv">${pagesYear.toLocaleString('en-US')}</div><div class="sl">صفحة قرأتها هذا العام</div></div></div>
        <div class="card stat"><div class="si" style="--c:#3b82f6">📖</div><div><div class="sv">${counts.reading}</div><div class="sl">كتب أقرؤها الآن</div></div></div>
      </div>
      <div class="mb">${App.tabs([{ id: 'reading', label: `أقرأ الآن (${counts.reading})` }, { id: 'want', label: `أريد قراءته (${counts.want})` }, { id: 'done', label: `أنهيته (${counts.done})` }], tab, 'book-tab')}</div>
      ${list.length ? `<div class="grid g-auto">${list.map(b => {
        const pr = pct(b.read || 0, b.pages || 0);
        return `<div class="card book">
          <div class="book-cover" style="--c:${b.color}">${esc(b.title)}</div>
          <div class="grow" style="min-width:0">
            <div class="flex between"><div class="bold ellipsis">${esc(b.title)}</div><button class="icon-btn sm" data-act="book-edit" data-id="${b.id}">${ic('edit')}</button></div>
            <div class="small muted">${esc(b.author || '')}</div>
            ${b.status === 'reading' ? `<div class="mt-s"><div class="flex between tiny muted"><span>${b.read || 0} / ${b.pages || '?'} صفحة</span><span>${pr}%</span></div>${App.bar(pr, b.color, 'thin')}</div>
              <div class="flex mt-s" style="gap:6px"><button class="btn btn-sm btn-soft" data-act="book-pages" data-id="${b.id}" data-n="10">+10 صفحات</button><button class="btn btn-sm btn-ghost" data-act="book-pages" data-id="${b.id}" data-n="0">تحديث…</button></div>` : ''}
            ${b.status === 'want' ? `<button class="btn btn-sm btn-soft mt-s" data-act="book-start" data-id="${b.id}">📖 ابدأ القراءة</button>` : ''}
            ${b.status === 'done' ? `<div class="stars mt-s">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= (b.rating || 0) ? '' : 'off'}" data-act="book-rate" data-id="${b.id}" data-v="${i}">★</span>`).join('')}</div><div class="tiny muted">أنهيته ${b.finishedAt ? D.rel(b.finishedAt) : ''}</div>` : ''}
          </div>
        </div>`;
      }).join('')}</div>` : `<div class="card">${App.empty('📚', 'لا كتب هنا بعد', 'أضف الكتب التي تقرؤها أو تنوي قراءتها')}</div>`}`;
  },
};
App.on('book-tab', el => App.go('reading', { tab: el.dataset.id }));
App.on('reading-goal', () => App.prompt({ title: 'هدف القراءة السنوي', label: 'عدد الكتب', type: 'number', value: S().readingGoal, onOk: v => App.update(() => { S().readingGoal = Math.max(1, Number(toLatinDigits(v)) || 12); }) }));
App.bookForm = function (b = null) {
  App.form({
    title: b ? 'تعديل الكتاب' : 'كتاب جديد', icon: '📚',
    values: b || { status: 'reading', color: COLORS[(App.state.books.length * 5) % COLORS.length], read: 0 },
    fields: [
      { name: 'title', label: 'عنوان الكتاب', required: true },
      { type: 'row', fields: [{ name: 'author', label: 'المؤلف' }, { name: 'pages', label: 'عدد الصفحات', type: 'number', min: 1 }, { name: 'read', label: 'قرأت حتى صفحة', type: 'number', min: 0 }] },
      { name: 'status', label: 'الحالة', type: 'seg', options: [['reading', '📖 أقرؤه'], ['want', '🔖 أريد قراءته'], ['done', '✅ أنهيته']] },
      { name: 'color', label: 'لون الغلاف', type: 'color' },
      { name: 'notes', label: 'فوائد واقتباسات', type: 'textarea', rows: 3 },
    ],
    onSubmit(v) {
      if (v.status === 'done' && !(b && b.finishedAt)) { v.finishedAt = D.today(); v.read = v.pages || v.read; }
      App.update(s => { if (b) Object.assign(byId(s.books, b.id), v); else s.books.push(Object.assign({ id: uid(), added: D.today() }, v)); });
    },
    onDelete: b ? () => App.withUndo('حُذف الكتاب', s => { s.books = s.books.filter(x => x.id !== b.id); }) : null,
  });
};
App.on('book-new', () => App.bookForm());
App.on('book-edit', el => App.bookForm(byId(App.state.books, el.dataset.id)));
App.on('book-start', el => App.update(s => { byId(s.books, el.dataset.id).status = 'reading'; }));
App.on('book-rate', el => App.update(s => { byId(s.books, el.dataset.id).rating = Number(el.dataset.v); }));
App.on('book-pages', el => {
  const b = byId(App.state.books, el.dataset.id);
  const apply = n => {
    App.update(() => {
      b.read = clamp(n, 0, b.pages || n);
      if (b.pages && b.read >= b.pages) { b.status = 'done'; b.finishedAt = D.today(); }
    });
    if (b.status === 'done') { App.confetti(); App.toast(`أنهيت «${b.title}» — ما شاء الله! 📚`, { icon: '🏆' }); }
  };
  if (Number(el.dataset.n)) apply((b.read || 0) + Number(el.dataset.n));
  else App.prompt({ title: 'إلى أي صفحة وصلت؟', label: 'رقم الصفحة', type: 'number', value: b.read || 0, onOk: v => apply(Number(toLatinDigits(v)) || 0) });
});
