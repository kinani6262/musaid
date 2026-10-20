'use strict';
/* =========================================================
   الاشتراكات
   ========================================================= */

const SUB_CATS = [
  ['fun', '🎬 ترفيه'], ['work', '💼 عمل'], ['edu', '📚 تعليم'], ['health', '💪 صحة ورياضة'],
  ['cloud', '☁️ تخزين وبرامج'], ['telecom', '📶 اتصالات'], ['other', '📦 أخرى'],
];
const CYCLES = { weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'كل 3 أشهر', yearly: 'سنوي' };
const USAGE = { 3: 'أستخدمه كثيرًا', 2: 'أحيانًا', 1: 'نادرًا' };

const Subs = {
  advance(k, cycle) {
    if (cycle === 'weekly') return D.add(k, 7);
    if (cycle === 'quarterly') return D.addMonths(k, 3);
    if (cycle === 'yearly') return D.addMonths(k, 12);
    return D.addMonths(k, 1);
  },
  renewsOn(x, k) {
    if (!x.next || k < x.next) return false;
    let d = x.next, guard = 0;
    while (d < k && guard++ < 400) d = Subs.advance(d, x.cycle);
    return d === k;
  },
  monthly(x) {
    const a = Number(x.amount) || 0;
    return { weekly: a * 52 / 12, monthly: a, quarterly: a / 3, yearly: a / 12 }[x.cycle] || a;
  },
  catLabel(id) { const c = SUB_CATS.find(c => c[0] === id); return c ? c[1] : '📦 أخرى'; },
};

App.views.subs = {
  title: 'الاشتراكات',
  render() {
    const s = App.state, today = D.today();
    const all = s.subscriptions.slice().sort((a, b) => ((a.active === false) - (b.active === false)) || (a.next || '').localeCompare(b.next || ''));
    const active = all.filter(x => x.active !== false);
    const monthly = sum(active, Subs.monthly);
    const next = active[0];
    const low = active.filter(x => Number(x.usage) === 1);
    const lowSave = sum(low, Subs.monthly) * 12;
    const byCat = {};
    active.forEach(x => { byCat[x.cat || 'other'] = (byCat[x.cat || 'other'] || 0) + Subs.monthly(x); });

    const cards = all.map(x => {
      const d = x.next ? D.diff(today, x.next) : null;
      const pill = d === null ? '' : `<span class="due-pill ${d <= 1 ? 'now' : d <= 7 ? 'soon' : ''}">${d === 0 ? 'يتجدد اليوم' : d === 1 ? 'يتجدد غدًا' : 'بعد ' + daysAr(d)}</span>`;
      const td = x.trialEnd ? D.diff(today, x.trialEnd) : null;
      return `<div class="card sub-card ${x.active === false ? 'paused' : ''}" style="--c:${x.color}">
        <div class="flex" style="gap:12px">
          <div class="avatar">${esc((x.name || '?').trim().charAt(0).toUpperCase())}</div>
          <div class="grow"><div class="bold ellipsis">${esc(x.name)}</div><div class="tiny muted">${Subs.catLabel(x.cat)}${x.usage ? ' · ' + USAGE[x.usage] : ''}</div></div>
          <div style="text-align:end"><div class="bold tnum">${money(x.amount)}</div><div class="tiny muted">${CYCLES[x.cycle] || ''}</div></div>
        </div>
        <div class="flex flex-wrap" style="gap:6px">
          ${x.active === false ? '<span class="due-pill">⏸ موقوف</span>' : pill}
          ${x.next && x.active !== false ? `<span class="chip">📅 ${D.short(x.next)}</span>` : ''}
          ${td !== null && td >= 0 ? `<span class="chip c" style="--c:var(--warn)">🎁 تجربة مجانية تنتهي ${D.rel(x.trialEnd)}</span>` : ''}
          ${x.autoLog ? '<span class="chip" data-tip="يُسجَّل تلقائيًا في المصاريف عند التجديد">🔄 تسجيل تلقائي</span>' : ''}
        </div>
        <div class="flex" style="gap:6px">
          ${x.active !== false ? `<button class="btn btn-sm btn-soft" data-act="sub-paid" data-id="${x.id}" data-tip="سجّل الدفعة في المصاريف وانقل موعد التجديد">${ic('check')} دفعتُ</button>` : ''}
          <button class="btn btn-sm btn-ghost" data-act="sub-toggle" data-id="${x.id}">${x.active === false ? '▶ تفعيل' : '⏸ إيقاف'}</button>
          <span class="grow"></span>
          <button class="icon-btn sm" data-act="sub-edit" data-id="${x.id}" data-tip="تعديل">${ic('edit')}</button>
        </div>
      </div>`;
    }).join('');

    const upcoming = [];
    for (let i = 0; i <= 30; i++) {
      const k = D.add(today, i);
      active.filter(x => Subs.renewsOn(x, k)).forEach(x => upcoming.push({ k, x }));
    }

    return `
      <div class="page-h">
        <div><h2>${ic('repeat', 'ic-lg')} الاشتراكات</h2><div class="sub">تابع اشتراكاتك وتجديداتها، ولا تدفع لشيء لا تستخدمه</div></div>
        <div class="actions"><button class="btn btn-sm btn-primary" data-act="sub-new">${ic('plus')} اشتراك</button></div>
      </div>
      <div class="grid g-4 keep-2 mb">
        <div class="card stat"><div class="si" style="--c:#f43f5e">📆</div><div><div class="sv">${money(monthly, false)}</div><div class="sl">التكلفة الشهرية (${S().currency})</div></div></div>
        <div class="card stat"><div class="si" style="--c:#f97316">🗓️</div><div><div class="sv">${money(monthly * 12, false)}</div><div class="sl">التكلفة السنوية</div></div></div>
        <div class="card stat"><div class="si" style="--c:#22c55e">✅</div><div><div class="sv">${active.length}</div><div class="sl">اشتراكات فعّالة${all.length > active.length ? ` · ${all.length - active.length} موقوفة` : ''}</div></div></div>
        <div class="card stat"><div class="si" style="--c:#6366f1">⏭️</div><div class="grow"><div class="sv ellipsis" style="font-size:1.1rem">${next ? esc(next.name) : '—'}</div><div class="sl">${next ? 'التجديد القادم ' + D.rel(next.next) : 'لا تجديدات'}</div></div></div>
      </div>
      ${low.length ? `<div class="insight mb" style="--c:var(--warn);cursor:default"><span class="ie">💡</span><div><div class="it">لديك ${low.length} ${low.length === 1 ? 'اشتراك نادر الاستخدام' : 'اشتراكات نادرة الاستخدام'} (${low.map(x => esc(x.name)).join('، ')})</div><div class="is">إلغاؤها يوفّر عليك نحو ${money(Math.round(lowSave))} سنويًا</div></div></div>` : ''}
      <div class="layout-side">
        <div>${all.length ? `<div class="grid g-auto">${cards}</div>` : `<div class="card">${App.empty('🔁', 'لا اشتراكات بعد', 'أضف اشتراكاتك (بث، تخزين سحابي، نادي رياضي، باقة جوال...) وسأذكّرك قبل كل تجديد', `<button class="btn btn-primary btn-sm" data-act="sub-new">${ic('plus')} أضف اشتراكًا</button>`)}</div>`}</div>
        <div class="col" style="gap:16px">
          <div class="card">
            <div class="card-h"><div class="card-t">📅 تجديدات الثلاثين يومًا القادمة</div></div>
            ${upcoming.length ? upcoming.map(u => `<div class="trow"><span class="avatar" style="--c:${u.x.color};width:30px;height:30px;font-size:.8rem;border-radius:9px">${esc(u.x.name.charAt(0))}</span><div class="grow"><div class="small bold">${esc(u.x.name)}</div><div class="tiny muted">${D.rel(u.k)} · ${D.short(u.k)}</div></div><span class="small tnum bold">${money(u.x.amount)}</span></div>`).join('')
              + `<div class="flex between mt-s small"><span class="muted">الإجمالي</span><b>${money(sum(upcoming, u => u.x.amount))}</b></div>` : `<div class="muted small">لا تجديدات خلال الشهر القادم.</div>`}
          </div>
          <div class="card">
            <div class="card-h"><div class="card-t">🍩 التكلفة الشهرية حسب الفئة</div></div>
            ${App.donut(Object.entries(byCat).map(([c, v]) => ({ label: Subs.catLabel(c), value: Math.round(v * 100) / 100 })), { size: 140, thick: 18, center: money(monthly, false), centerSub: 'شهريًا' })}
          </div>
        </div>
      </div>`;
  },
};

App.subForm = function (x = null, preset = {}) {
  App.form({
    title: x ? 'تعديل الاشتراك' : 'اشتراك جديد', icon: '🔁',
    values: x || Object.assign({ cycle: 'monthly', next: D.addMonths(D.today(), 1), cat: 'fun', color: COLORS[9], usage: '3', remindDays: '1', autoLog: true }, preset),
    fields: [
      { type: 'row', fields: [
        { name: 'name', label: 'اسم الخدمة', required: true, placeholder: 'مثال: نتفليكس' },
        { name: 'amount', label: 'المبلغ', type: 'number', required: true, min: 0 },
      ] },
      { name: 'cycle', label: 'دورة الدفع', type: 'seg', options: Object.entries(CYCLES) },
      { type: 'row', fields: [
        { name: 'next', label: 'تاريخ التجديد القادم', type: 'date', required: true },
        { name: 'remindDays', label: 'ذكّرني قبل', type: 'select', options: [['1', 'يوم واحد'], ['2', 'يومين'], ['3', '3 أيام'], ['7', 'أسبوع']] },
      ] },
      { name: 'cat', label: 'الفئة', type: 'seg', options: SUB_CATS },
      { name: 'usage', label: 'مدى استخدامك له', type: 'seg', options: [['3', '🔥 كثيرًا'], ['2', '🙂 أحيانًا'], ['1', '😴 نادرًا']] },
      { name: 'trialEnd', label: 'نهاية التجربة المجانية (إن وُجدت)', type: 'date', hint: 'سأذكّرك قبلها لتقرر الإلغاء أو الاستمرار' },
      { name: 'autoLog', label: 'سجّل الدفعة في المصاريف تلقائيًا عند التجديد', type: 'switch' },
      { name: 'color', label: 'اللون', type: 'color' },
      { name: 'notes', label: 'ملاحظات', type: 'textarea', rows: 2 },
    ],
    onSubmit(v) {
      v.remindDays = Number(v.remindDays);
      App.update(s => { if (x) Object.assign(byId(s.subscriptions, x.id), v); else s.subscriptions.push(Object.assign({ id: uid(), active: true }, v)); });
      App.toast(x ? 'حُفظ الاشتراك' : 'أُضيف الاشتراك — سأذكّرك قبل التجديد', { icon: '🔁' });
    },
    onDelete: x ? () => App.withUndo('حُذف الاشتراك', s => { s.subscriptions = s.subscriptions.filter(y => y.id !== x.id); }) : null,
  });
};
App.on('sub-new', () => App.subForm());
App.on('sub-edit', el => App.subForm(byId(App.state.subscriptions, el.dataset.id)));
App.on('sub-toggle', el => App.update(s => { const x = byId(s.subscriptions, el.dataset.id); x.active = x.active === false; }));
App.on('sub-paid', el => {
  const x = byId(App.state.subscriptions, el.dataset.id);
  App.withUndo(`سُجّلت دفعة ${x.name} ونُقل التجديد إلى ${D.short(Subs.advance(x.next, x.cycle))}`, s => {
    s.transactions.push({ id: uid(), type: 'expense', amount: Number(x.amount), cat: 'subs', note: 'اشتراك ' + x.name, date: D.today(), method: 'بطاقة' });
    x.next = Subs.advance(x.next, x.cycle);
  }, '🔁');
});
