'use strict';
/* =========================================================
   التقويم: المواعيد المستقبلية مع تذكير قبل يوم
   ========================================================= */

/** كل ما يقع في يوم معيّن من مهام وامتحانات وتجديدات وديون وأهداف */
App.eventsOn = function (k, { skipDaily = false } = {}) {
  const s = App.state, out = [];
  T.on(k).forEach(t => {
    if (skipDaily && ['daily', 'weekdays', 'weekly'].includes(t.repeat)) return;
    const c = T.cat(t.cat);
    out.push({ kind: 'task', id: t.id, title: t.title, time: t.time, color: c.color, icon: c.icon, done: T.isDone(t, k), rep: t.repeat, open: 'task-edit', remind: t.remind !== false && !['daily', 'weekdays', 'weekly'].includes(t.repeat) });
  });
  s.exams.filter(x => x.date === k).forEach(x => {
    const sub = byId(s.subjects, x.subject);
    out.push({ kind: 'exam', id: x.id, title: 'امتحان ' + (sub ? sub.name + ': ' : '') + x.title, time: x.time, color: '#a855f7', icon: '📝', open: 'exam-edit', remind: true });
  });
  s.assignments.filter(a => a.due === k && !a.done).forEach(a => out.push({ kind: 'assign', id: a.id, title: 'تسليم: ' + a.title, color: '#8b5cf6', icon: '📎', open: 'assign-edit', remind: true }));
  s.subscriptions.filter(x => x.active !== false && Subs.renewsOn(x, k)).forEach(x => out.push({ kind: 'sub', id: x.id, title: 'تجديد ' + x.name + ' · ' + money(x.amount), color: '#f43f5e', icon: '🔁', open: 'sub-edit', remind: true }));
  s.subscriptions.filter(x => x.trialEnd === k).forEach(x => out.push({ kind: 'sub', id: x.id, title: 'نهاية تجربة ' + x.name, color: '#f59e0b', icon: '⚠️', open: 'sub-edit', remind: true }));
  s.debts.filter(x => !x.paid && x.due === k).forEach(x => out.push({ kind: 'debt', id: x.id, title: (x.type === 'borrowed' ? 'سداد لـ ' : 'استرداد من ') + x.person + ' · ' + money(x.amount), color: '#f59e0b', icon: '🤝', open: 'debt-edit', remind: true }));
  s.goals.filter(g => g.deadline === k && !g.done).forEach(g => out.push({ kind: 'goal', id: g.id, title: 'موعد هدف: ' + g.title, color: '#ec4899', icon: '🎯', open: 'goal-edit' }));
  return out.sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
};

const CAL_LEGEND = [
  { name: 'مهام ومواعيد', color: '#3b82f6' }, { name: 'امتحانات', color: '#a855f7' }, { name: 'تجديد اشتراكات', color: '#f43f5e' },
  { name: 'ديون', color: '#f59e0b' }, { name: 'أهداف', color: '#ec4899' },
];

App.views.calendar = {
  title: 'التقويم',
  render(p) {
    const today = D.today();
    const mk = App._calMonth = p.mk || D.mk(today);
    const sel = App._calSel = p.sel || (D.mk(today) === mk ? today : mk + '-01');
    const start = D.weekStart(mk + '-01');
    const md = D.monthDays(mk);
    const end = mk + '-' + pad2(md);
    const cells = [];
    for (let k = start; k <= end || cells.length % 7; k = D.add(k, 1)) cells.push(k);
    const head = Array.from({ length: 7 }, (_, i) => DAYS[(S().weekStart + i) % 7]);

    const grid = cells.map(k => {
      // المهام الروتينية اليومية تظهر في لوحة اليوم المحدد فقط حتى لا تزدحم الخانات
      const evs = App.eventsOn(k).filter(e => !(e.kind === 'task' && ['daily', 'weekdays'].includes(e.rep)));
      const out = D.mk(k) !== mk;
      return `<div class="cal-d ${out ? 'out' : ''} ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''} ${D.dow(k) === 5 ? 'fri' : ''}" data-act="cal-sel" data-date="${k}" data-drop-date="${k}" data-drop-time="keep">
        <div class="cal-n"><span class="cal-num">${D.day(k)}</span>${S().showHijri ? `<span class="cal-hj">${D.hijriDay(k)}</span>` : ''}</div>
        ${evs.slice(0, 3).map(e => `<div class="ev ${e.done ? 'done' : ''}" style="--c:${e.color}">${e.time ? D.time(e.time).replace(/:00/, '') + ' ' : ''}${esc(e.title)}</div>`).join('')}
        ${evs.length > 3 ? `<div class="ev-more">+${evs.length - 3} أخرى</div>` : ''}
        <div class="ev-dots">${evs.slice(0, 5).map(e => `<i style="--c:${e.color}"></i>`).join('')}</div>
      </div>`;
    }).join('');

    const selEvents = App.eventsOn(sel);
    const upcoming = [];
    for (let i = 0; i <= 30 && upcoming.length < 12; i++) {
      const k = D.add(today, i);
      App.eventsOn(k, { skipDaily: true }).filter(e => !e.done).forEach(e => upcoming.push(Object.assign({ date: k }, e)));
    }

    return `
      <div class="page-h">
        <div>
          <h2>${ic('calendar', 'ic-lg')} ${D.monthName(mk)}</h2>
          <div class="sub">${S().showHijri ? D.hijriMonth(start > mk + '-01' ? start : mk + '-01') + ' – ' + D.hijriMonth(end) : ''}</div>
        </div>
        <div class="actions">
          <button class="icon-btn" data-act="cal-nav" data-n="-1" data-tip="الشهر السابق">${ic('prev')}</button>
          <button class="btn btn-sm ${D.mk(today) === mk ? 'btn-soft' : ''}" data-act="cal-nav" data-n="0">اليوم</button>
          <button class="icon-btn" data-act="cal-nav" data-n="1" data-tip="الشهر التالي">${ic('next')}</button>
          <button class="btn btn-sm btn-ghost" data-act="export-ics" data-tip="ملف يُفتح في تقويم الجوال أو Google/Outlook مع تنبيه قبل كل موعد بيوم">${ic('download')} تصدير للتقويم</button>
          <button class="btn btn-sm btn-primary" data-act="cal-add" data-date="${sel < today ? today : sel}">${ic('plus')} موعد جديد</button>
        </div>
      </div>
      <div class="layout-side">
        <div>
          <div class="cal mb-s">${head.map(h => `<div class="cal-h">${h}</div>`).join('')}${grid}</div>
          <div class="mt">${App.legend(CAL_LEGEND)}</div>
        </div>
        <div class="col" style="gap:16px">
          <div class="card">
            <div class="card-h">
              <div><div class="card-t">${D.fmt(sel, false)}</div><div class="tiny muted">${S().showHijri ? D.hijri(sel) + ' · ' : ''}${D.rel(sel)}</div></div>
              <button class="icon-btn" data-act="cal-add" data-date="${sel}" data-tip="إضافة موعد لهذا اليوم">${ic('plus')}</button>
            </div>
            ${selEvents.length ? selEvents.map(e => `
              <div class="agenda-item" style="--c:${e.color};cursor:pointer" data-act="${e.open}" data-id="${e.id}">
                <div class="ad"><b style="font-size:1.1rem">${e.icon}</b></div>
                <div class="grow"><div class="bold small ${e.done ? 'muted' : ''}" style="${e.done ? 'text-decoration:line-through' : ''}">${esc(e.title)}</div>
                <div class="tiny muted">${e.time ? D.time(e.time) : 'طوال اليوم'}${e.remind && sel > today ? ' · 🔔 تذكير ' + (D.diff(today, sel) === 1 ? 'اليوم' : 'يوم ' + D.short(D.add(sel, -1))) : ''}</div></div>
                ${e.kind === 'task' ? App.chk(e.done, 'task-toggle', `data-id="${e.id}" data-date="${sel}"`, e.color, 'round') : ''}
              </div>`).join('') : App.empty('🗓️', 'يوم فارغ', 'اضغط + لإضافة موعد أو مهمة')}
            <button class="btn btn-sm btn-ghost btn-block mt-s" data-act="go" data-view="day" data-params='${JSON.stringify({ date: sel })}'>فتح جدول هذا اليوم</button>
          </div>
          <div class="card">
            <div class="card-h"><div class="card-t"><span class="ti" style="--c:#6366f1">${ic('bell')}</span> المواعيد القادمة</div></div>
            ${upcoming.length ? upcoming.map(e => `
              <div class="trow" style="cursor:pointer" data-act="cal-jump" data-date="${e.date}">
                <span style="width:10px;height:10px;border-radius:3px;background:${e.color};flex:none"></span>
                <div class="grow"><div class="small bold ellipsis">${e.icon} ${esc(e.title)}</div><div class="tiny muted">${D.rel(e.date)} · ${D.short(e.date)}${e.time ? ' · ' + D.time(e.time) : ''}</div></div>
                ${e.remind ? '<span data-tip="تذكير قبل يوم">🔔</span>' : ''}
              </div>`).join('') : `<div class="muted small">لا مواعيد خلال الشهر القادم.</div>`}
          </div>
        </div>
      </div>`;
  },
};

App.on('cal-sel', el => {
  const k = el.dataset.date;
  if (D.mk(k) !== App._calMonth) App.go('calendar', { mk: D.mk(k), sel: k });
  else { App.params = { mk: App._calMonth, sel: k }; App.refresh(); }
});
App.on('cal-jump', el => App.go('calendar', { mk: D.mk(el.dataset.date), sel: el.dataset.date }));
App.on('cal-nav', el => {
  const n = Number(el.dataset.n);
  if (n === 0) App.go('calendar', {});
  else { const mk = D.monthAdd(App._calMonth || D.mk(D.today()), n); App.go('calendar', { mk, sel: mk + '-01' }); }
});
App.on('cal-add', el => {
  const k = el.dataset.date;
  App.form({
    title: 'ماذا تريد أن تضيف؟', icon: '➕', size: 'narrow',
    fields: [{ name: 'kind', label: '', type: 'seg', options: [['task', '📝 مهمة / موعد'], ['exam', '📚 امتحان'], ['debt', '🤝 دين'], ['sub', '🔁 اشتراك']] }],
    submit: 'متابعة',
    onSubmit({ kind }) {
      setTimeout(() => {
        if (kind === 'task') App.taskForm(null, { date: k, remind: true });
        else if (kind === 'exam') App.examForm(null, { date: k });
        else if (kind === 'debt') App.debtForm(null, { due: k });
        else App.subForm(null, { next: k });
      }, 10);
    },
  });
});
App.on('export-ics', () => App.exportICS());
