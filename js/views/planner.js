'use strict';
/* =========================================================
   التخطيط: جدول اليوم، الجدول الأسبوعي، خطة الشهر
   ========================================================= */

function hourRange(tasks) {
  let a = S().dayStart, b = S().dayEnd;
  tasks.forEach(t => { if (t.time) { const h = Number(t.time.slice(0, 2)); a = Math.min(a, h); b = Math.max(b, h); } });
  return [a, b];
}

/* ---------------- جدول اليوم ---------------- */
App.views.day = {
  title: 'جدول اليوم',
  render(p) {
    const k = App._dayDate = p.date || D.today();
    const today = D.today(), isToday = k === today;
    const list = T.on(k);
    const timed = list.filter(t => t.time), untimed = list.filter(t => !t.time);
    const conf = T.conflicts(list);
    const st = T.stats(k);
    const planned = T.plannedMin(k);
    const windowMin = (S().dayEnd - S().dayStart + 1) * 60;
    const free = Math.max(0, windowMin - planned);
    const [h0, h1] = hourRange(timed);
    const nowH = new Date().getHours();
    const prayers = S().prayer.show && S().prayer.inDay ? Prayer.list(k).filter(x => !isNaN(x.min)) : [];

    let rows = '';
    for (let h = h0; h <= h1; h++) {
      const items = timed.filter(t => Number(t.time.slice(0, 2)) === h);
      const pr = prayers.filter(x => Math.floor(x.min / 60) === h);
      const cls = isToday ? (h === nowH ? 'now' : h < nowH ? 'past' : '') : (k < today ? 'past' : '');
      rows += `<tr class="${cls}">
        <td class="hour">${D.hourLabel(h)}${isToday && h === nowH ? '<span class="now-badge">الآن</span>' : ''}</td>
        <td><div class="slot" data-act="task-new" data-date="${k}" data-time="${pad2(h)}:00" data-drop-date="${k}" data-drop-time="${h}">${pr.map(x => `<span class="pmark">🕌 ${x.name} ${D.time(x.time)}</span>`).join('')}${items.map(t => T.chip(t, k, { conflict: conf.has(t.id) })).join('')}</div></td>
      </tr>`;
    }

    const od = isToday ? T.overdue() : [];
    const inbox = T.inbox();
    const note = App.state.dayNotes[k] || '';

    return `
      <div class="page-h">
        <div>
          <h2>${ic('day', 'ic-lg')} ${isToday ? 'جدول اليوم' : D.rel(k) === 'غدًا' ? 'جدول الغد' : 'جدول يوم'}</h2>
          <div class="sub">${D.fmt(k)}${S().showHijri ? ' · ' + D.hijri(k) : ''}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="day-nav" data-n="-1" data-tip="اليوم السابق">${ic('prev')}</button>
          <button class="btn btn-sm ${isToday ? 'btn-soft' : ''}" data-act="day-nav" data-n="0">اليوم</button>
          <button class="icon-btn" data-act="day-nav" data-n="1" data-tip="اليوم التالي">${ic('next')}</button>
          <input type="date" class="inp inp-sm" style="width:auto" value="${k}" data-change="day-pick">
          <button class="btn btn-sm" data-act="auto-schedule" data-date="${k}" data-tip="يوزّع المهام غير المجدولة على أوقات الفراغ حسب الأولوية، ويتجنب أوقات الصلاة">${ic('sparkles')} رتّب يومي</button>
          <button class="btn btn-sm btn-ghost" data-act="copy-day" data-date="${k}">${ic('copy')} نسخ الجدول</button>
          <button class="btn btn-sm btn-primary" data-act="task-new" data-date="${k}">${ic('plus')} مهمة</button>
        </div>
      </div>

      <div class="grid g-4 keep-2 mb">
        <div class="card stat"><div class="si">📋</div><div class="grow"><div class="sv">${st.done}/${st.total}</div><div class="sl">مهام منجزة</div>${App.bar(st.pct, '', 'thin')}</div></div>
        <div class="card stat"><div class="si" style="--c:#06b6d4">⏱️</div><div><div class="sv">${durText(planned)}</div><div class="sl">وقت مخطّط</div></div></div>
        <div class="card stat"><div class="si" style="--c:#22c55e">🌿</div><div><div class="sv">${durText(free)}</div><div class="sl">وقت غير مخطّط</div></div></div>
        <div class="card stat"><div class="si" style="--c:${conf.size ? 'var(--bad)' : 'var(--good)'}">${conf.size ? '⚠️' : '✅'}</div><div><div class="sv">${conf.size ? conf.size : 'لا'}</div><div class="sl">${conf.size ? 'مهام متعارضة الأوقات' : 'تعارضات في الجدول'}</div></div></div>
      </div>

      <div class="layout-side">
        <div class="tbl-wrap">
          <table class="tbl daytbl">
            <thead><tr><th>الوقت</th><th>المهام والأنشطة <span class="muted tiny" style="font-weight:400">— اضغط على أي خانة لإضافة مهمة، أو اسحب المهام بين الساعات</span></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>

        <div class="col" style="gap:16px">
          <div class="card" data-drop-date="${k}" data-drop-time="none">
            <div class="card-h"><div class="card-t"><span class="ti" style="--c:#a855f7">${ic('list')}</span> بلا وقت محدد</div><span class="badge">${untimed.length}</span></div>
            <div class="tlist">${untimed.length ? untimed.map(t => T.row(t, k)).join('') : `<div class="muted small">كل مهام اليوم لها أوقات محددة 👌</div>`}</div>
          </div>
          ${od.length ? `
          <div class="card">
            <div class="card-h"><div class="card-t"><span class="ti" style="--c:var(--bad)">⏰</span> متأخرة</div><button class="btn btn-sm btn-soft" data-act="move-overdue">${ic('moveToday')} انقلها لليوم</button></div>
            <div class="tlist">${od.slice(0, 6).map(t => T.row(t, t.date, { showDate: true })).join('')}</div>
          </div>` : ''}
          <div class="card" data-drop-date="" data-drop-time="none">
            <div class="card-h"><div class="card-t"><span class="ti" style="--c:#64748b">${ic('inbox')}</span> صندوق المهام</div><button class="icon-btn sm" data-act="task-new" data-date="" data-tip="مهمة بلا تاريخ">${ic('plus')}</button></div>
            ${inbox.length ? inbox.map(t => `<div class="trow"><span>${T.cat(t.cat).icon}</span><div class="tt" data-act="task-edit" data-id="${t.id}"><div class="tn">${esc(t.title)}</div></div><button class="btn btn-sm btn-ghost" data-act="task-to-date" data-id="${t.id}" data-date="${k}">${isToday ? 'لليوم' : 'لهذا اليوم'}</button></div>`).join('') : `<div class="muted small">ضع هنا الأفكار والمهام التي لم تحدد موعدها بعد.</div>`}
          </div>
          <div class="card">
            <div class="card-h"><div class="card-t"><span class="ti" style="--c:#eab308">${ic('note')}</span> ملاحظات اليوم</div></div>
            <textarea class="inp" rows="4" placeholder="أفكار، مشتريات، أشياء لا تريد نسيانها..." data-input="day-note" data-date="${k}">${esc(note)}</textarea>
          </div>
        </div>
      </div>`;
  },
};

App.on('day-nav', el => {
  const n = Number(el.dataset.n);
  App._dayDate = n === 0 ? D.today() : D.add(App._dayDate || D.today(), n);
  App.go('day', { date: App._dayDate });
});
App.on('day-pick', el => { if (el.value) App.go('day', { date: el.value }); });
App.on('task-to-date', el => {
  const t = byId(App.state.tasks, el.dataset.id);
  if (t) App.update(() => { t.date = el.dataset.date; });
});
let _noteTimer;
App.on('day-note', el => {
  App.state.dayNotes[el.dataset.date] = el.value;
  if (!el.value) delete App.state.dayNotes[el.dataset.date];
  clearTimeout(_noteTimer);
  _noteTimer = setTimeout(App.save, 400);
});
App.on('auto-schedule', el => {
  const k = el.dataset.date;
  const snap = JSON.stringify(App.state);
  const r = App.autoSchedule(k);
  if (!r.placed) {
    App.toast(r.left ? 'لا توجد فترات فراغ كافية لجدولة المهام المتبقية' : 'لا توجد مهام بلا وقت لترتيبها', { icon: 'ℹ️' });
    return;
  }
  App.save(); App.refresh();
  App.toast(`رُتّبت ${tasksAr(r.placed)} في أوقات فراغك${r.left ? ` (لم يتسع الوقت لـ${tasksAr(r.left)})` : ''}`, {
    icon: '✨',
    undo: () => { App.state = JSON.parse(snap); App.save(); App.refresh(); },
  });
});
App.on('copy-day', el => {
  const k = el.dataset.date;
  const list = T.on(k).filter(t => !T.recurring(t));
  if (!list.length) { App.toast('لا توجد مهام غير متكررة لنسخها', { icon: 'ℹ️' }); return; }
  App.form({
    title: 'نسخ جدول اليوم', icon: '📋', size: 'narrow',
    intro: `<p class="small text-2 mb">ستُنسخ ${tasksAr(list.length)} (بأوقاتها) إلى التاريخ الذي تختاره.</p>`,
    fields: [{ name: 'to', label: 'إلى تاريخ', type: 'date', value: D.add(k, 1), required: true }],
    submit: 'نسخ',
    onSubmit({ to }) {
      App.update(s => list.forEach(t => s.tasks.push(Object.assign({}, t, { id: uid(), date: to, done: false, doneAt: null, doneDates: {} }))));
      App.toast(`نُسخت ${tasksAr(list.length)} إلى ${D.fmt(to, false)}`);
    },
  });
});

/* سحب وإفلات المهام بين الخانات */
document.addEventListener('dragstart', e => {
  const el = e.target.closest && e.target.closest('[data-drag]');
  if (!el || el.getAttribute('draggable') !== 'true') return;
  App._dragId = el.dataset.drag;
  e.dataTransfer.setData('text/plain', el.dataset.drag);
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(() => el.classList.add('dragging'), 0);
});
document.addEventListener('dragend', () => {
  App._dragId = null;
  $$('.dragging').forEach(x => x.classList.remove('dragging'));
  $$('.drop-over').forEach(x => x.classList.remove('drop-over'));
});
document.addEventListener('dragover', e => {
  if (!App._dragId) return;
  const z = e.target.closest('[data-drop-date]');
  $$('.drop-over').forEach(x => x !== z && x.classList.remove('drop-over'));
  if (!z) return;
  e.preventDefault();
  z.classList.add('drop-over');
});
document.addEventListener('drop', e => {
  const z = e.target.closest('[data-drop-date]');
  const id = App._dragId;
  if (!z || !id) return;
  e.preventDefault();
  const t = byId(App.state.tasks, id);
  App._dragId = null;
  if (!t) return;
  const date = z.dataset.dropDate || null;
  const tm = z.dataset.dropTime;
  App.update(() => {
    t.date = date;
    if (tm === 'none') t.time = '';
    else if (tm === 'range') {
      // خانة فترة في الجدول المربع: يبقى الوقت إن كان داخلها، وإلا يُنقل إلى بدايتها المقترحة
      const [a, b] = z.dataset.dropRange.split('-').map(Number), cur = t.time ? D.toMin(t.time) : -1;
      if (cur < a || cur >= b) t.time = z.dataset.time;
    }
    else if (tm && tm !== 'keep') t.time = pad2(Number(tm)) + ':' + (t.time ? t.time.slice(3) : '00');
  });
  App.toast(date ? `نُقلت إلى ${D.fmt(date, false)}${t.time ? ' — ' + D.time(t.time) : ''}` : 'نُقلت إلى صندوق المهام', { icon: '↔️' });
});

/* ---------------- الجدول الأسبوعي ---------------- */

/** فترات اليوم حسب مواقيت الصلاة: أعمدة الجدول المربع */
function dayPeriods(k) {
  const t = Prayer.times(k);
  const m = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib'].every(x => !isNaN(t[x])) ? t : { fajr: 300, sunrise: 360, dhuhr: 720, asr: 930, maghrib: 1080, isha: 1170 };
  const r15 = x => Math.ceil(x / 15) * 15;
  return [
    { name: 'الفجر', at: [['الفجر', m.fajr]], s: 0, e: m.sunrise, def: r15(m.fajr + 30) },
    { name: 'الصباح', at: [['الشروق', m.sunrise]], s: m.sunrise, e: m.dhuhr, def: r15(m.sunrise + 60) },
    { name: 'الظهر', at: [['الظهر', m.dhuhr]], s: m.dhuhr, e: m.asr, def: r15(m.dhuhr + 30) },
    { name: 'العصر', at: [['العصر', m.asr]], s: m.asr, e: m.maghrib, def: r15(m.asr + 30) },
    { name: 'المغرب والعشاء', at: [['المغرب', m.maghrib], ['العشاء', m.isha]], s: m.maghrib, e: 1440, def: r15(m.maghrib + 20) },
  ];
}
const periodOf = (periods, t) => { const x = D.toMin(t.time); const i = periods.findIndex(p => x >= p.s && x < p.e); return i < 0 ? periods.length - 1 : i; };
const everyDay = t => t.repeat === 'daily' || (t.repeat === 'weekdays' && (t.days || []).length === 7);

/** «4:00–5:30 م» */
function timeRange(t) {
  const a = D.time(t.time), b = D.time(D.fromMin(D.toMin(t.time) + (t.dur || 30)));
  if (S().timeFmt === '24') return a + '–' + b;
  return a.slice(-1) === b.slice(-1) ? a.slice(0, -2) + '–' + b : a + ' – ' + b;
}

/** الجدول المربع: الأيام صفوف، وفترات الصلاة أعمدة، والمتكررة مع الجديدة في خانة واحدة */
function weekGrid(days, lists, conf) {
  const today = D.today(), now = D.nowMin();
  const P = days.map(dayPeriods);
  const ref = P[days.includes(today) ? days.indexOf(today) : 3];
  const DOT = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

  const chip = (t, k, i, mini = false) => {
    const c = T.cat(t.cat), done = T.isDone(t, k), rec = T.recurring(t);
    return `<div class="gchip ${rec ? 'rec' : 'once'} ${done ? 'done' : ''} ${conf[i].has(t.id) ? 'conflict' : ''} ${mini ? 'mini' : ''}" style="--c:${c.color}" ${rec ? '' : 'draggable="true"'} data-drag="${t.id}" data-act="task-edit" data-id="${t.id}" data-tip="${esc(`${c.icon} ${esc(c.name)}${t.time ? ' · ' + durText(t.dur || 30) : ''}${rec ? '<br>🔁 مهمة متكررة' : '<br>✦ مهمة جديدة لمرة واحدة'}${conf[i].has(t.id) ? '<br>⚠️ يتعارض مع مهمة أخرى' : ''}`)}">
      ${App.chk(done, 'task-toggle', `data-id="${t.id}" data-date="${k}"`, c.color)}
      <div class="gbody"><div class="gn">${esc(t.title)}</div>${t.time || !rec ? `<div class="gt">${t.time ? `<span>${timeRange(t)}</span>` : ''}${rec ? '' : '<span class="gnew">جديدة</span>'}</div>` : ''}</div>
    </div>`;
  };

  // صف «كل يوم»: السنن والمهام اليومية مرة واحدة، مع خانة إنجاز لكل يوم
  const daily = [];
  lists.forEach(l => l.forEach(t => { if (everyDay(t) && !daily.includes(t)) daily.push(t); }));
  daily.sort(T.sorter);
  const dchip = t => {
    const c = T.cat(t.cat);
    return `<div class="gchip rec daily" style="--c:${c.color}" data-act="task-edit" data-id="${t.id}">
      <div class="gbody"><div class="gn">${esc(t.title)}</div>${t.time ? `<div class="gt"><span>${timeRange(t)}</span></div>` : ''}
      <div class="gdots">${days.map(k => T.occurs(t, k)
        ? `<button class="gdot ${T.isDone(t, k) ? 'on' : ''} ${k === today ? 'today' : ''}" data-act="task-toggle" data-id="${t.id}" data-date="${k}" data-tip="${esc(D.fmt(k, false))}">${DOT[D.dow(k)]}</button>`
        : `<i class="gdot off">${DOT[D.dow(k)]}</i>`).join('')}</div></div>
    </div>`;
  };
  const dailyRow = daily.length ? `<tr class="gdaily">
    <th class="gday" scope="row"><div class="gday-h"><b>🔁 كل يوم</b><span>السنن والمهام اليومية</span></div>${daily.filter(t => !t.time).map(dchip).join('')}</th>
    ${ref.map((p, j) => { const its = daily.filter(t => t.time && periodOf(ref, t) === j); return `<td data-p="${p.name}" class="${its.length ? '' : 'empty'}"><div class="gcell">${its.map(dchip).join('')}</div></td>`; }).join('')}
  </tr>` : '';

  const rows = days.map((k, i) => {
    const list = lists[i].filter(t => !everyDay(t));
    const isT = k === today;
    return `<tr class="${isT ? 'today' : ''}">
      <th class="gday" scope="row" data-act="task-new" data-date="${k}" data-drop-date="${k}" data-drop-time="none">
        <div class="gday-h" data-act="go" data-view="day" data-params='${JSON.stringify({ date: k })}' data-tip="فتح جدول اليوم"><b>${D.dayName(k)}${isT ? ' <span class="now-badge">اليوم</span>' : ''}</b><span>${D.short(k)}${S().showHijri ? ' · ' + D.hijriDay(k) : ''}</span></div>
        ${list.filter(t => !t.time).map(t => chip(t, k, i, true)).join('')}
      </th>
      ${P[i].map((p, j) => {
        const its = list.filter(t => t.time && periodOf(P[i], t) === j);
        return `<td data-p="${p.name}" class="${isT && now >= p.s && now < p.e ? 'now' : ''} ${its.length ? '' : 'empty'}" data-act="task-new" data-date="${k}" data-time="${D.fromMin(p.def)}" data-drop-date="${k}" data-drop-time="range" data-drop-range="${p.s}-${p.e}"><div class="gcell">${its.map(t => chip(t, k, i)).join('')}</div></td>`;
      }).join('')}
    </tr>`;
  }).join('');

  return `
    <div class="glegend">
      <span><i class="lg rec"></i>متكررة 🔁</span>
      <span><i class="lg once"></i>جديدة (لمرة واحدة)</span>
      <span class="muted">🕌 الأعمدة حسب مواقيت الصلاة في ${esc(Prayer.cityName())} · اضغط أي خانة لإضافة مهمة، واسحب المهام الجديدة بين الأيام</span>
    </div>
    <div class="tbl-wrap gwrap mb"><table class="wgrid">
      <thead><tr><th class="gday">اليوم</th>${ref.map(p => `<th><div class="gp">${p.name}</div><div class="gpt">${p.at.filter(a => !isNaN(a[1])).map(a => a[0] + ' ' + D.time(D.fromMin(a[1]))).join(' · ')}</div></th>`).join('')}</tr></thead>
      <tbody>${dailyRow}${rows}</tbody>
    </table></div>`;
}

App.views.week = {
  title: 'الجدول الأسبوعي',
  render(p) {
    const layout = S().weekLayout === 'hours' ? 'hours' : 'grid';
    const base = App._weekDate = p.date || D.today();
    const days = D.weekDays(base);
    const today = D.today();
    const ws = days[0];
    const lists = days.map(k => T.on(k));
    const allTimed = [].concat(...lists).filter(t => t.time);
    const [h0, h1] = hourRange(allTimed);
    const nowH = new Date().getHours();
    const stats = days.map((k, i) => ({ k, total: lists[i].length, done: lists[i].filter(t => T.isDone(t, k)).length, min: T.plannedMin(k) }));
    const totT = sum(stats, x => x.total), totD = sum(stats, x => x.done), totMin = sum(stats, x => x.min);
    const busiest = stats.slice().sort((a, b) => b.min - a.min)[0];
    const goals = App.state.weekGoals[ws] || [];
    const conf = lists.map(l => T.conflicts(l));

    const head = `<tr><th class="h">الوقت</th>${days.map((k, i) => {
      const load = clamp(stats[i].min / 480 * 100, 0, 100);
      const lc = load > 90 ? 'var(--bad)' : load > 65 ? 'var(--warn)' : 'var(--good)';
      return `<th class="${k === today ? 'today' : ''}" style="cursor:pointer" data-act="go" data-view="day" data-params='${JSON.stringify({ date: k })}'>
        <div class="wd">${D.dayName(k)}</div><div class="wn">${D.short(k)}${S().showHijri ? ' · ' + D.hijriDay(k) : ''}</div>
        <div class="load" data-tip="${esc(`مخطط: ${durText(stats[i].min)} · ${stats[i].done}/${stats[i].total} مهام`)}"><i style="width:${load}%;--c:${lc}"></i></div></th>`;
    }).join('')}</tr>`;

    const mchip = (t, k, i) => {
      const c = T.cat(t.cat), done = T.isDone(t, k);
      return `<div class="mchip ${done ? 'done' : ''}" style="--c:${c.color};${conf[i].has(t.id) ? 'box-shadow:0 0 0 1.5px var(--bad)' : ''}" ${T.recurring(t) ? '' : 'draggable="true"'} data-drag="${t.id}" data-act="task-edit" data-id="${t.id}" data-tip="${esc(`${esc(t.title)}${t.time ? '<br>🕒 ' + D.time(t.time) + ' · ' + durText(t.dur || 30) : ''}`)}">
        ${App.chk(done, 'task-toggle', `data-id="${t.id}" data-date="${k}" style="--c:${c.color};width:15px;height:15px;border-radius:4px;border-width:1.5px"`, c.color)}<span>${esc(t.title)}</span></div>`;
    };

    let body = `<tr class="allday"><td class="h">بلا وقت</td>${days.map((k, i) => `<td class="${k === today ? 'today' : ''}" data-act="task-new" data-date="${k}" data-drop-date="${k}" data-drop-time="none">${lists[i].filter(t => !t.time).map(t => mchip(t, k, i)).join('')}</td>`).join('')}</tr>`;
    for (let h = h0; h <= h1; h++) {
      body += `<tr class="${days.includes(today) && h === nowH ? 'now' : ''}"><td class="h">${D.hourLabel(h)}</td>${days.map((k, i) => `<td class="${k === today ? 'today' : ''}" data-act="task-new" data-date="${k}" data-time="${pad2(h)}:00" data-drop-date="${k}" data-drop-time="${h}">${lists[i].filter(t => t.time && Number(t.time.slice(0, 2)) === h).map(t => mchip(t, k, i)).join('')}</td>`).join('')}</tr>`;
    }

    const chartData = days.map((k, i) => ({ label: D.dayShort(k), values: [stats[i].done, stats[i].total - stats[i].done] }));
    const isThisWeek = days.includes(today);

    return `
      <div class="page-h">
        <div>
          <h2>${ic('week', 'ic-lg')} الجدول الأسبوعي</h2>
          <div class="sub">${D.short(days[0])} – ${D.short(days[6])} ${D.parse(days[6]).getFullYear()}${S().showHijri ? ' · ' + D.hijri(days[0], { day: 'numeric', month: 'long' }) + ' – ' + D.hijri(days[6]) : ''}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="week-nav" data-n="-7" data-tip="الأسبوع السابق">${ic('prev')}</button>
          <button class="btn btn-sm ${isThisWeek ? 'btn-soft' : ''}" data-act="week-nav" data-n="0">هذا الأسبوع</button>
          <button class="icon-btn" data-act="week-nav" data-n="7" data-tip="الأسبوع التالي">${ic('next')}</button>
          <div class="tabs" role="tablist" aria-label="طريقة العرض">
            <button class="tab ${layout === 'grid' ? 'on' : ''}" data-act="week-layout" data-v="grid" role="tab">${ic('month')} جدول مربع</button>
            <button class="tab ${layout === 'hours' ? 'on' : ''}" data-act="week-layout" data-v="hours" role="tab">${ic('day')} بالساعات</button>
          </div>
          <button class="btn btn-sm btn-ghost" data-act="print">${ic('printer')} طباعة</button>
          <button class="btn btn-sm btn-ghost" data-act="phone-guide">📱 على الهاتف</button>
          <button class="btn btn-sm btn-primary" data-act="task-new" data-date="${isThisWeek ? today : days[0]}">${ic('plus')} مهمة</button>
        </div>
      </div>

      <div class="grid g-4 keep-2 mb">
        <div class="card stat">${App.ring(pct(totD, totT), { size: 50, stroke: 6, label: pct(totD, totT) + '%' })}<div><div class="sv">${totD}/${totT}</div><div class="sl">مهام الأسبوع</div></div></div>
        <div class="card stat"><div class="si" style="--c:#06b6d4">⏱️</div><div><div class="sv">${hoursText(totMin)} س</div><div class="sl">وقت مخطّط</div></div></div>
        <div class="card stat"><div class="si" style="--c:#f97316">📌</div><div><div class="sv">${busiest && busiest.min ? D.dayName(busiest.k) : '—'}</div><div class="sl">أكثر أيامك انشغالًا</div></div></div>
        <div class="card stat"><div class="si" style="--c:#ec4899">🎯</div><div><div class="sv">${goals.filter(g => g.done).length}/${goals.length}</div><div class="sl">أهداف الأسبوع</div></div></div>
      </div>

      ${layout === 'grid' ? weekGrid(days, lists, conf) : `<div class="tbl-wrap mb"><table class="tbl wk"><thead>${head}</thead><tbody>${body}</tbody></table></div>`}

      <div class="grid g-2">
        <div class="card">
          <div class="card-h"><div class="card-t"><span class="ti" style="--c:#ec4899">${ic('target')}</span> أهداف هذا الأسبوع</div></div>
          ${goals.map(g => `<div class="ms ${g.done ? 'done' : ''}">${App.chk(g.done, 'wgoal-toggle', `data-ws="${ws}" data-id="${g.id}"`)}<span class="grow">${esc(g.text)}</span><button class="icon-btn sm" data-act="wgoal-del" data-ws="${ws}" data-id="${g.id}">${ic('x')}</button></div>`).join('')}
          <div class="flex mt-s"><input class="inp inp-sm grow" id="wgoal-inp" placeholder="أضف هدفًا للأسبوع ثم اضغط Enter" data-ws="${ws}"><button class="btn btn-sm btn-soft" data-act="wgoal-add" data-ws="${ws}">${ic('plus')}</button></div>
        </div>
        <div class="card">
          <div class="card-h"><div class="card-t"><span class="ti" style="--c:var(--s1)">${ic('trend')}</span> إنجاز الأسبوع يومًا بيوم</div>${App.legend([{ name: 'منجزة', color: 'var(--s1)' }, { name: 'متبقية', color: 'var(--s2)' }])}</div>
          ${App.chart({ data: chartData, series: [{ name: 'منجزة', color: 'var(--s1)' }, { name: 'متبقية', color: 'var(--s2)' }], height: 190, fmt: v => String(Math.round(v)) })}
        </div>
      </div>`;
  },
  after() {
    const inp = $('#wgoal-inp');
    if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') App.acts['wgoal-add'](inp); });
  },
};
App.on('week-nav', el => {
  const n = Number(el.dataset.n);
  App._weekDate = n === 0 ? D.today() : D.add(App._weekDate || D.today(), n);
  App.go('week', { date: App._weekDate });
});
App.on('week-layout', el => { S().weekLayout = el.dataset.v; App.save(); App.refresh(); });
App.on('print', () => window.print());
App.on('wgoal-add', el => {
  const inp = $('#wgoal-inp');
  const v = inp && inp.value.trim();
  if (!v) { inp && inp.focus(); return; }
  App.update(s => { (s.weekGoals[el.dataset.ws] = s.weekGoals[el.dataset.ws] || []).push({ id: uid(), text: v, done: false }); });
  setTimeout(() => { const i = $('#wgoal-inp'); i && i.focus(); }, 0);
});
App.on('wgoal-toggle', el => App.update(s => { const g = byId(s.weekGoals[el.dataset.ws] || [], el.dataset.id); if (g) g.done = !g.done; }));
App.on('wgoal-del', el => App.update(s => { s.weekGoals[el.dataset.ws] = (s.weekGoals[el.dataset.ws] || []).filter(g => g.id !== el.dataset.id); }));

/* ---------------- خطة الشهر ---------------- */
function monthPlan(mk) {
  const s = App.state;
  if (!s.monthPlans[mk]) s.monthPlans[mk] = { focus: '', word: '', top: [], goals: {}, cells: {}, review: { good: '', improve: '' } };
  const p = s.monthPlans[mk];
  p.top = p.top || []; p.goals = p.goals || {}; p.cells = p.cells || {}; p.review = p.review || { good: '', improve: '' };
  return p;
}
function monthWeeks(mk) {
  const md = D.monthDays(mk), out = [];
  for (let w = 0; w * 7 < md; w++) out.push({ n: w + 1, from: w * 7 + 1, to: Math.min(md, w * 7 + 7) });
  return out;
}

App.views.month = {
  title: 'خطة الشهر',
  render(p) {
    const mk = App._monthKey = p.mk || D.mk(D.today());
    const s = App.state, today = D.today();
    const plan = monthPlan(mk);
    const weeks = monthWeeks(mk);
    const isCur = D.mk(today) === mk;
    const curW = isCur ? Math.floor((D.day(today) - 1) / 7) + 1 : 0;
    const areas = S().areas;
    const allItems = Object.values(plan.cells).flat();
    const doneItems = allItems.filter(x => x.done).length;
    const md = D.monthDays(mk);
    const daysLeft = isCur ? md - D.day(today) : null;

    const item = (it, area, w) => `<div class="ci ${it.done ? 'done' : ''}">${App.chk(it.done, 'mp-toggle', `data-mk="${mk}" data-cell="${area}|${w}" data-id="${it.id}"`, '')}<span data-act="mp-edit" data-mk="${mk}" data-cell="${area}|${w}" data-id="${it.id}">${esc(it.text)}</span></div>`;

    const rows = areas.map(a => {
      const its = weeks.flatMap(w => plan.cells[a.id + '|' + w.n] || []);
      const ap = pct(its.filter(x => x.done).length, its.length);
      return `<tr>
        <td><div class="area" style="--c:${a.color}"><span class="ae">${a.icon}</span>${esc(a.name)}</div></td>
        <td style="min-width:170px"><div class="mgoal ${plan.goals[a.id] ? '' : 'empty'}" data-act="mp-goal" data-mk="${mk}" data-area="${a.id}">${plan.goals[a.id] ? esc(plan.goals[a.id]) : 'اضغط لتحديد هدف الشهر…'}</div></td>
        ${weeks.map(w => `<td style="${w.n === curW ? 'background:color-mix(in srgb, var(--ac) 6%, transparent)' : ''}">
          ${(plan.cells[a.id + '|' + w.n] || []).map(it => item(it, a.id, w.n)).join('')}
          <button class="add-ci" data-act="mp-add" data-mk="${mk}" data-cell="${a.id}|${w.n}">${ic('plus')} إضافة</button></td>`).join('')}
        <td class="c">${its.length ? App.ring(ap, { size: 44, stroke: 5, label: ap + '%', color: a.color }) : '<span class="muted">—</span>'}</td>
      </tr>`;
    }).join('');

    // أرقام الشهر
    const inMonth = k => D.mk(k) === mk;
    const doneTasks = s.tasks.filter(t => !T.recurring(t) && t.done && t.date && inMonth(t.date)).length
      + sum(s.tasks.filter(T.recurring), t => Object.keys(t.doneDates || {}).filter(inMonth).length);
    const spent = sum(s.transactions.filter(t => t.type === 'expense' && inMonth(t.date)), t => t.amount);
    const studyMin = sum(s.sessions.filter(x => inMonth(x.date)), x => x.min);
    const jEntries = Object.keys(s.journal).filter(inMonth);
    const moods = jEntries.map(k => s.journal[k].mood).filter(Boolean);
    const avgMood = moods.length ? sum(moods) / moods.length : 0;
    let habitDue = 0, habitDone = 0;
    for (let d = 1; d <= md; d++) {
      const k = mk + '-' + pad2(d);
      if (k > today) break;
      s.habits.filter(h => !h.archived).forEach(h => { if (Habits.isDue(h, k) && k >= (h.created || k)) { habitDue++; if (Habits.isDoneOn(h, k)) habitDone++; } });
    }

    const top = [0, 1, 2].map(i => plan.top[i] || null);

    return `
      <div class="page-h">
        <div>
          <h2>${ic('month', 'ic-lg')} خطة شهر ${D.monthName(mk)}</h2>
          <div class="sub">${S().showHijri ? D.hijriMonth(mk + '-01') + ' – ' + D.hijriMonth(mk + '-' + pad2(md)) + ' · ' : ''}${isCur ? `بقي ${daysAr(daysLeft)} على نهاية الشهر` : ''}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="month-nav" data-n="-1" data-tip="الشهر السابق">${ic('prev')}</button>
          <button class="btn btn-sm ${isCur ? 'btn-soft' : ''}" data-act="month-nav" data-n="0">هذا الشهر</button>
          <button class="icon-btn" data-act="month-nav" data-n="1" data-tip="الشهر التالي">${ic('next')}</button>
          <button class="btn btn-sm btn-ghost" data-act="mp-copy-prev" data-mk="${mk}" data-tip="ينسخ أهداف المجالات من الشهر السابق">${ic('copy')} من الشهر السابق</button>
          <button class="btn btn-sm btn-ghost" data-act="print">${ic('printer')} طباعة</button>
        </div>
      </div>

      <div class="grid g-3 mb">
        <div class="card" style="background:linear-gradient(135deg, color-mix(in srgb, var(--ac) 18%, var(--surface)), var(--surface))">
          <div class="small muted">🎯 الهدف الأكبر لهذا الشهر</div>
          <div class="bold mt-s" style="font-size:1.1rem;cursor:pointer;min-height:30px" data-act="mp-focus" data-mk="${mk}">${plan.focus ? esc(plan.focus) : '<span class="muted">اضغط لكتابة هدفك الأكبر…</span>'}</div>
          <div class="small muted mt">💬 شعار الشهر</div>
          <div class="text-2" style="cursor:pointer" data-act="mp-word" data-mk="${mk}">${plan.word ? '«' + esc(plan.word) + '»' : '<span class="muted">مثال: «خطوة كل يوم»</span>'}</div>
        </div>
        <div class="card">
          <div class="card-h" style="margin-bottom:8px"><div class="card-t">⭐ أولويات الشهر الثلاث</div></div>
          ${top.map((t, i) => t ? `<div class="ms ${t.done ? 'done' : ''}">${App.chk(t.done, 'mp-top-toggle', `data-mk="${mk}" data-i="${i}"`)}<span class="grow" style="cursor:pointer" data-act="mp-top" data-mk="${mk}" data-i="${i}">${esc(t.text)}</span></div>`
            : `<div class="ms"><span class="chk" style="opacity:.4"></span><span class="grow muted" style="cursor:pointer" data-act="mp-top" data-mk="${mk}" data-i="${i}">الأولوية ${['الأولى', 'الثانية', 'الثالثة'][i]}…</span></div>`).join('')}
        </div>
        <div class="card stat" style="justify-content:center">
          ${App.ring(pct(doneItems, allItems.length), { size: 92, stroke: 9, label: pct(doneItems, allItems.length) + '%', sub: 'إنجاز الخطة' })}
          <div class="col" style="gap:4px">
            <div class="small"><b>${doneItems}</b> <span class="muted">من</span> <b>${allItems.length}</b> <span class="muted">بندًا</span></div>
            ${isCur ? `<div class="small muted">الأسبوع الحالي: ${curW}</div>${App.bar(pct(D.day(today), md), '', 'thin')}<div class="tiny muted">مضى ${pct(D.day(today), md)}% من الشهر</div>` : ''}
          </div>
        </div>
      </div>

      <div class="tbl-wrap mb">
        <table class="tbl mp">
          <thead><tr><th>المجال</th><th>هدف الشهر</th>${weeks.map(w => `<th style="${w.n === curW ? 'color:var(--ac)' : ''}">الأسبوع ${w.n}<div class="tiny muted" style="font-weight:400">${w.from}–${w.to}</div></th>`).join('')}<th>الإنجاز</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="grid g-2">
        <div class="card">
          <div class="card-h"><div class="card-t"><span class="ti" style="--c:#14b8a6">${ic('journal')}</span> مراجعة الشهر</div></div>
          <div class="field"><label>✅ ما الذي أنجزته وأفخر به؟</label><textarea class="inp" rows="3" data-input="mp-review" data-mk="${mk}" data-k="good">${esc(plan.review.good)}</textarea></div>
          <div class="field" style="margin:0"><label>🔧 ما الذي سأحسّنه في الشهر القادم؟</label><textarea class="inp" rows="3" data-input="mp-review" data-mk="${mk}" data-k="improve">${esc(plan.review.improve)}</textarea></div>
        </div>
        <div class="card">
          <div class="card-h"><div class="card-t"><span class="ti" style="--c:#f59e0b">${ic('trend')}</span> أرقام الشهر</div></div>
          <div class="grid g-2 keep-2" style="gap:12px">
            <div class="stat"><div class="si">✅</div><div><div class="sv">${doneTasks}</div><div class="sl">مهمة منجزة</div></div></div>
            <div class="stat"><div class="si" style="--c:#f97316">🔥</div><div><div class="sv">${pct(habitDone, habitDue)}%</div><div class="sl">التزام بالعادات</div></div></div>
            <div class="stat"><div class="si" style="--c:#22c55e">💸</div><div><div class="sv">${money(spent, false)}</div><div class="sl">إجمالي المصروف</div></div></div>
            <div class="stat"><div class="si" style="--c:#a855f7">🎓</div><div><div class="sv">${hoursText(studyMin)}</div><div class="sl">ساعة دراسة</div></div></div>
            <div class="stat"><div class="si" style="--c:#eab308">📔</div><div><div class="sv">${jEntries.length}</div><div class="sl">تدوينة يومية</div></div></div>
            <div class="stat"><div class="si" style="--c:#ec4899">${avgMood ? MOODS[Math.round(avgMood) - 1].e : '🙂'}</div><div><div class="sv">${avgMood ? avgMood.toFixed(1) : '—'}</div><div class="sl">متوسط المزاج</div></div></div>
          </div>
        </div>
      </div>`;
  },
};

App.on('month-nav', el => {
  const n = Number(el.dataset.n);
  App._monthKey = n === 0 ? D.mk(D.today()) : D.monthAdd(App._monthKey || D.mk(D.today()), n);
  App.go('month', { mk: App._monthKey });
});
App.on('mp-add', el => {
  App.prompt({
    title: 'بند جديد في الخطة', label: 'ماذا تريد أن تنجز؟', placeholder: 'مثال: ختم جزء عمّ حفظًا',
    onOk: v => { if (!v) return false; App.update(() => { const p = monthPlan(el.dataset.mk); (p.cells[el.dataset.cell] = p.cells[el.dataset.cell] || []).push({ id: uid(), text: v, done: false }); }); },
  });
});
App.on('mp-toggle', el => App.update(() => {
  const it = byId(monthPlan(el.dataset.mk).cells[el.dataset.cell] || [], el.dataset.id);
  if (it) { it.done = !it.done; if (it.done) App.chime('done'); }
}));
App.on('mp-edit', el => {
  const p = monthPlan(el.dataset.mk);
  const it = byId(p.cells[el.dataset.cell] || [], el.dataset.id);
  if (!it) return;
  App.form({
    title: 'تعديل البند', size: 'narrow',
    fields: [{ name: 'text', label: 'البند', value: it.text, required: true }],
    onSubmit: ({ text }) => App.update(() => { it.text = text; }),
    onDelete: () => App.withUndo('حُذف البند', () => { p.cells[el.dataset.cell] = p.cells[el.dataset.cell].filter(x => x.id !== it.id); }),
  });
});
App.on('mp-goal', el => {
  const p = monthPlan(el.dataset.mk);
  const a = S().areas.find(x => x.id === el.dataset.area);
  App.prompt({ title: 'هدف المجال ' + (a ? a.name : ''), label: 'هدف هذا الشهر', value: p.goals[el.dataset.area] || '', multiline: true, onOk: v => App.update(() => { p.goals[el.dataset.area] = v; }) });
});
App.on('mp-focus', el => {
  const p = monthPlan(el.dataset.mk);
  App.prompt({ title: 'الهدف الأكبر للشهر', label: 'ما الشيء الواحد الذي إن أنجزته كان شهرك ناجحًا؟', value: p.focus, multiline: true, onOk: v => App.update(() => { p.focus = v; }) });
});
App.on('mp-word', el => {
  const p = monthPlan(el.dataset.mk);
  App.prompt({ title: 'شعار الشهر', label: 'كلمة أو عبارة تلهمك', value: p.word, onOk: v => App.update(() => { p.word = v; }) });
});
App.on('mp-top', el => {
  const p = monthPlan(el.dataset.mk), i = Number(el.dataset.i);
  App.prompt({
    title: 'أولوية الشهر', label: 'الأولوية', value: p.top[i] ? p.top[i].text : '',
    onOk: v => App.update(() => { if (!v) p.top[i] = null; else p.top[i] = Object.assign(p.top[i] || { done: false }, { text: v }); }),
  });
});
App.on('mp-top-toggle', el => App.update(() => { const t = monthPlan(el.dataset.mk).top[Number(el.dataset.i)]; if (t) t.done = !t.done; }));
App.on('mp-review', el => {
  monthPlan(el.dataset.mk).review[el.dataset.k] = el.value;
  clearTimeout(_noteTimer);
  _noteTimer = setTimeout(App.save, 400);
});
App.on('mp-copy-prev', el => {
  const mk = el.dataset.mk, prev = App.state.monthPlans[D.monthAdd(mk, -1)];
  if (!prev || !Object.keys(prev.goals || {}).length) { App.toast('لا توجد أهداف في الشهر السابق', { icon: 'ℹ️' }); return; }
  App.update(() => { const p = monthPlan(mk); Object.entries(prev.goals).forEach(([a, g]) => { if (!p.goals[a]) p.goals[a] = g; }); });
  App.toast('نُسخت أهداف المجالات من الشهر السابق');
});
