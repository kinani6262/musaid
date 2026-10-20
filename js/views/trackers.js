'use strict';
/* =========================================================
   المتابعة اليومية: خانات تحدد عددها بنفسك
   (مثل: الصلاة في المسجد 40 يومًا لكل فرض)
   ========================================================= */

const Trackers = {
  rows(t) { return t.rows && t.rows.length ? t.rows : ['✓']; },
  get(t, r, c) { return Number((t.log || {})[r + '-' + c]) || 0; },
  todayIdx(t) { if (t.dated === false) return null; return D.diff(t.start, D.today()); },
  dateOf(t, c) { return t.dated === false ? null : D.add(t.start, c); },
  progress(t) {
    const rows = Trackers.rows(t).length, total = rows * t.cells;
    let done = 0, miss = 0;
    Object.entries(t.log || {}).forEach(([k, v]) => {
      const c = Number(k.split('-')[1]);
      if (c >= t.cells) return;
      if (Number(v) === 1) done++; else if (Number(v) === 2) miss++;
    });
    return { done, miss, total, pct: pct(done, total) };
  },
  colDone(t, c) { return Trackers.rows(t).every((_, r) => Trackers.get(t, r, c) === 1); },
  streak(t) {
    let c = t.dated === false ? t.cells - 1 : Math.min(Trackers.todayIdx(t), t.cells - 1);
    if (c < 0) return 0;
    if (t.dated !== false && !Trackers.colDone(t, c)) c--;
    if (t.dated === false) while (c >= 0 && !Trackers.colDone(t, c)) c--;
    let n = 0;
    while (c >= 0 && Trackers.colDone(t, c)) { n++; c--; }
    return n;
  },
};

const TRACKER_TEMPLATES = [
  { name: 'الصلاة في المسجد', icon: '🕌', color: '#14b8a6', cells: 40, rows: ['الفجر', 'الظهر', 'العصر', 'المغرب', 'العشاء'], tri: true, note: '«من صلّى لله أربعين يومًا في جماعة يُدرك التكبيرة الأولى كُتبت له براءتان: براءة من النار، وبراءة من النفاق» — رواه الترمذي' },
  { name: 'ختمة القرآن (جزء يوميًا)', icon: '📖', color: '#22c55e', cells: 30, rows: [], tri: false },
  { name: 'أذكار الصباح والمساء', icon: '📿', color: '#7c5cff', cells: 30, rows: ['الصباح', 'المساء'], tri: true },
  { name: 'تحدي الرياضة 30 يومًا', icon: '🏃', color: '#ef4444', cells: 30, rows: [], tri: true },
  { name: '21 يومًا بلا سكر', icon: '🍬', color: '#f59e0b', cells: 21, rows: [], tri: true },
  { name: 'قراءة 12 كتابًا هذا العام', icon: '📚', color: '#a855f7', cells: 12, rows: [], tri: false, dated: false },
  { name: 'السنن الرواتب', icon: '🤲', color: '#0ea5e9', cells: 30, rows: ['الفجر', 'الظهر', 'المغرب', 'العشاء'], tri: false },
];

App._trkScroll = App._trkScroll || {};

App.views.trackers = {
  title: 'المتابعة اليومية',
  render() {
    const s = App.state, today = D.today();
    const list = s.trackers.filter(t => !t.archived);
    const archived = s.trackers.filter(t => t.archived);

    const card = (t) => {
      const rows = Trackers.rows(t), multi = rows.length > 1;
      const ti = Trackers.todayIdx(t);
      const pr = Trackers.progress(t), st = Trackers.streak(t);
      const status = t.dated === false ? `${t.cells} خانة` : ti < 0 ? `يبدأ ${D.rel(t.start)}` : ti >= t.cells ? `انتهت المدة في ${D.short(D.add(t.start, t.cells - 1))}` : `اليوم ${ti + 1} من ${t.cells}`;
      const cell = (r, c) => {
        const v = Trackers.get(t, r, c), dk = Trackers.dateOf(t, c);
        const fut = dk && dk > today, isToday = dk === today;
        const tip = `${multi ? esc(rows[r]) + ' · ' : ''}${dk ? D.fmt(dk, false) : 'خانة ' + (c + 1)}${v === 1 ? ' · ✓ تم' : v === 2 ? ' · ✗ فاتت' : ''}`;
        return `<button class="tc ${v === 1 ? 'done' : v === 2 ? 'miss' : ''} ${isToday ? 'today' : ''} ${fut ? 'future' : ''}" style="--c:${t.color}" data-act="trk-cell" data-id="${t.id}" data-r="${r}" data-c="${c}" data-tip="${esc(tip)}">${v === 1 ? CHECK_SVG : v === 2 ? X_SVG : c + 1}</button>`;
      };
      let grid;
      if (!multi) {
        grid = `<div class="tgrid">${Array.from({ length: t.cells }, (_, c) => cell(0, c)).join('')}</div>`;
      } else {
        const head = `<tr><th class="rl"></th>${Array.from({ length: t.cells }, (_, c) => { const dk = Trackers.dateOf(t, c); return `<th class="${dk === today ? 'today' : ''}" ${dk ? `data-tip="${esc(D.fmt(dk, false))}"` : ''}>${c + 1}${dk ? `<div class="tiny muted" style="font-weight:400">${D.dayShort(dk).slice(0, 3)}</div>` : ''}</th>`; }).join('')}</tr>`;
        const body = rows.map((r, ri) => {
          const rd = Array.from({ length: t.cells }, (_, c) => Trackers.get(t, ri, c) === 1).filter(Boolean).length;
          return `<tr><td class="rl">${esc(r)} <span class="tiny muted">${rd}/${t.cells}</span></td>${Array.from({ length: t.cells }, (_, c) => `<td>${cell(ri, c)}</td>`).join('')}</tr>`;
        }).join('');
        grid = `<div class="tbl-wrap tscroll" data-tid="${t.id}" style="border:0;background:transparent"><table class="tbl ttbl"><thead>${head}</thead><tbody>${body}</tbody></table></div>`;
      }
      return `<div class="card mb" style="--c:${t.color}">
        <div class="trk-head mb">
          <span class="trk-emo">${t.icon}</span>
          <div class="grow" style="min-width:180px">
            <div class="bold" style="font-size:1.08rem">${esc(t.name)}</div>
            <div class="small muted">${status}${t.dated !== false ? ' · بدأ ' + D.short(t.start) : ''}</div>
            <div class="flex flex-wrap mt-s" style="gap:6px">
              <span class="chip c" style="--c:var(--good)">✓ ${pr.done} منجز</span>
              ${t.tri ? `<span class="chip c" style="--c:var(--bad)">✗ ${pr.miss} فائت</span>` : ''}
              <span class="chip">🔥 ${st} ${t.dated === false ? 'متتالية' : 'أيام متتالية'}</span>
              <span class="chip">⬜ ${pr.total - pr.done - pr.miss} متبقٍ</span>
            </div>
          </div>
          ${App.ring(pr.pct, { size: 66, stroke: 7, label: pr.pct + '%', color: t.color })}
          <div class="flex" style="gap:2px">
            ${ti !== null && ti >= 0 && ti < t.cells ? `<button class="btn btn-sm btn-soft" data-act="trk-today" data-id="${t.id}" data-tip="تعليم كل خانات اليوم كمنجزة">✓ اليوم كاملًا</button>` : ''}
            <button class="icon-btn sm" data-act="trk-edit" data-id="${t.id}" data-tip="تعديل">${ic('edit')}</button>
          </div>
        </div>
        ${t.note ? `<div class="small muted mb">💭 ${esc(t.note)}</div>` : ''}
        ${grid}
        <div class="tiny muted mt-s">اضغط على الخانة: ${t.tri ? 'مرة = ✓ تم، مرتين = ✗ فاتت، ثلاثًا = تفريغ' : 'للتعليم كمنجزة، ومرة أخرى للتفريغ'}</div>
      </div>`;
    };

    return `
      <div class="page-h">
        <div><h2>${ic('tracker', 'ic-lg')} المتابعة اليومية</h2><div class="sub">حدّد عدد الخانات (الأيام) وتابع التزامك خانة بخانة</div></div>
        <div class="actions"><button class="btn btn-sm btn-primary" data-act="trk-new">${ic('plus')} متابعة جديدة</button></div>
      </div>
      ${list.length ? list.map(card).join('') : `<div class="card mb">${App.empty('🗂️', 'لا متابعات بعد', 'أنشئ متابعة مثل «الصلاة في المسجد 40 يومًا» وحدد عدد الخانات كما تشاء')}</div>`}
      <div class="card">
        <div class="card-h"><div class="card-t">${ic('sparkles')} قوالب جاهزة</div><span class="small muted">يمكنك تعديل عدد الخانات بعد الإضافة</span></div>
        <div class="tpl-grid">${TRACKER_TEMPLATES.map((t, i) => `<button class="tpl" data-act="trk-tpl" data-i="${i}"><span class="te">${t.icon}</span><span>${esc(t.name)}<br><span class="tiny muted">${t.cells} خانة${t.rows.length ? ' × ' + t.rows.length : ''}</span></span></button>`).join('')}</div>
      </div>
      ${archived.length ? `<div class="card mt"><div class="card-h"><div class="card-t">🗄️ متابعات مؤرشفة</div></div>${archived.map(t => `<div class="trow"><span>${t.icon}</span><div class="grow">${esc(t.name)} <span class="tiny muted">· ${Trackers.progress(t).pct}%</span></div><button class="btn btn-sm btn-ghost" data-act="trk-unarchive" data-id="${t.id}">استعادة</button></div>`).join('')}</div>` : ''}`;
  },
  after() {
    $$('.tscroll').forEach(w => {
      const id = w.dataset.tid;
      if (App._trkScroll[id] !== undefined) w.scrollLeft = App._trkScroll[id];
      else {
        const th = $('th.today', w);
        if (th) { const a = th.getBoundingClientRect(), b = w.getBoundingClientRect(); w.scrollLeft += (a.left + a.width / 2) - (b.left + b.width / 2); }
      }
      w.addEventListener('scroll', () => { App._trkScroll[id] = w.scrollLeft; }, { passive: true });
    });
  },
};

App.on('trk-cell', el => {
  const t = byId(App.state.trackers, el.dataset.id);
  if (!t) return;
  const key = el.dataset.r + '-' + el.dataset.c;
  t.log = t.log || {};
  const v = Number(t.log[key]) || 0;
  const nv = v === 0 ? 1 : v === 1 && t.tri ? 2 : 0;
  const before = Trackers.progress(t).pct;
  if (nv) t.log[key] = nv; else delete t.log[key];
  App.save();
  App.refresh();
  if (nv === 1) {
    App.chime('done');
    if (before < 100 && Trackers.progress(t).pct === 100) { App.confetti(); App.toast(`أتممت «${t.name}» بالكامل — بارك الله في جهدك! 🎉`, { icon: '🏆', ms: 6000 }); }
  }
});
App.on('trk-today', el => {
  const t = byId(App.state.trackers, el.dataset.id);
  const c = Trackers.todayIdx(t);
  App.update(() => { Trackers.rows(t).forEach((_, r) => { t.log[r + '-' + c] = 1; }); });
  App.chime('done');
  if (Trackers.progress(t).pct === 100) App.confetti();
});
App.on('trk-new', () => App.trackerForm());
App.on('trk-edit', el => App.trackerForm(byId(App.state.trackers, el.dataset.id)));
App.on('trk-unarchive', el => App.update(s => { byId(s.trackers, el.dataset.id).archived = false; }));
App.on('trk-tpl', el => {
  const t = JSON.parse(JSON.stringify(TRACKER_TEMPLATES[Number(el.dataset.i)]));
  App.trackerForm(null, t);
});

App.trackerForm = function (t = null, preset = {}) {
  const v = t ? Object.assign({}, t, { rowsText: (t.rows || []).join('، '), dated: t.dated !== false })
    : Object.assign({ icon: '🕌', color: COLORS[3], cells: 30, start: D.today(), dated: true, tri: false, rowsText: '' }, preset, { rowsText: (preset.rows || []).join('، '), dated: preset.dated !== false });
  App.form({
    title: t ? 'تعديل المتابعة' : 'متابعة جديدة', icon: '🗂️',
    values: v,
    fields: [
      { name: 'name', label: 'ماذا تريد أن تتابع؟', required: true, placeholder: 'مثال: الصلاة في المسجد' },
      { type: 'row', fields: [
        { name: 'cells', label: 'عدد الخانات (الأيام)', type: 'number', min: 1, max: 400, step: 1, required: true },
        { name: 'start', label: 'تاريخ البداية', type: 'date' },
      ] },
      { type: 'html', html: `<div class="flex flex-wrap mb" style="gap:6px;margin-top:-6px"><span class="tiny muted">اختيار سريع:</span>${[7, 14, 21, 30, 40, 66, 100].map(n => `<button type="button" class="dp" data-cells="${n}">${n}</button>`).join('')}</div>` },
      { name: 'rowsText', label: 'بنود متعددة لكل يوم (اختياري)', placeholder: 'مثال: الفجر، الظهر، العصر، المغرب، العشاء', hint: 'افصل بينها بفاصلة. اتركه فارغًا لخانة واحدة في اليوم.' },
      { name: 'dated', label: 'كل خانة تمثّل يومًا', type: 'switch', hint: 'عطّلها إن كانت الخانات عدًّا حرًّا غير مرتبط بالأيام (مثل عدد الكتب)' },
      { name: 'tri', label: 'السماح بتعليم الخانة كـ«فائتة» ✗', type: 'switch' },
      { name: 'icon', label: 'الرمز', type: 'emoji' },
      { name: 'color', label: 'اللون', type: 'color' },
      { name: 'note', label: 'نيّة أو ملاحظة تحفيزية', type: 'textarea', rows: 2 },
    ],
    onMount(m, form) {
      m.el.addEventListener('click', e => { const b = e.target.closest('[data-cells]'); if (b) form.elements.cells.value = b.dataset.cells; });
    },
    onSubmit(x) {
      x.cells = clamp(Math.round(x.cells || 1), 1, 400);
      x.rows = (x.rowsText || '').split(/[,،]/).map(r => r.trim()).filter(Boolean);
      delete x.rowsText;
      if (!x.start) x.start = D.today();
      App.update(s => {
        if (t) Object.assign(byId(s.trackers, t.id), x);
        else s.trackers.push(Object.assign({ id: uid(), log: {}, created: D.today(), archived: false }, x));
      });
      App.toast(t ? 'حُفظت المتابعة' : 'أُنشئت المتابعة — بالتوفيق!', { icon: x.icon });
    },
    onDelete: t ? () => App.withUndo('حُذفت المتابعة', s => { s.trackers = s.trackers.filter(y => y.id !== t.id); }) : null,
    extraBtn: t ? `<button type="button" class="btn btn-sm btn-ghost" id="trk-archive">🗄️ أرشفة</button><button type="button" class="btn btn-sm btn-ghost" id="trk-restart" data-tip="يبدأ من اليوم ويمسح الخانات">↺ إعادة البدء</button>` : '',
  });
  if (t) setTimeout(() => {
    const a = $('#trk-archive'), r = $('#trk-restart');
    a && a.addEventListener('click', () => { App.closeTopModal(); App.update(s => { byId(s.trackers, t.id).archived = true; }); App.toast('أُرشفت المتابعة', { icon: '🗄️' }); });
    r && r.addEventListener('click', () => App.confirm('سيتم مسح كل الخانات والبدء من اليوم. متابعة؟', () => { App.closeAllModals(); App.withUndo('أُعيد بدء المتابعة', s => { const x = byId(s.trackers, t.id); x.log = {}; x.start = D.today(); }); }));
  }, 0);
};
