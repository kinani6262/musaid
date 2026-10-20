'use strict';
/* =========================================================
   المال: نظرة عامة، العمليات، الميزانية، الادخار، الديون
   ========================================================= */

const Fin = {
  cat(type, id) {
    const list = type === 'income' ? S().incomeCats : S().expenseCats;
    return list.find(c => c.id === id) || { id, name: 'أخرى', icon: '📦' };
  },
  inMonth(mk, type) { return App.state.transactions.filter(t => D.mk(t.date) === mk && (!type || t.type === type)); },
  total(list) { return sum(list, t => t.amount); },
  balance() { return sum(App.state.transactions, t => (t.type === 'income' ? 1 : -1) * t.amount); },
  spentBy(mk) {
    const o = {};
    Fin.inMonth(mk, 'expense').forEach(t => { o[t.cat] = (o[t.cat] || 0) + Number(t.amount); });
    return o;
  },
};

App.views.finance = {
  title: 'المصاريف والأموال',
  render(p) {
    const tab = App._finTab = p.tab || App._finTab || 'overview';
    const mk = App._finMonth = App._finMonth || D.mk(D.today());
    const tabs = App.tabs([
      { id: 'overview', label: 'نظرة عامة', icon: 'trend' },
      { id: 'tx', label: 'العمليات', icon: 'list' },
      { id: 'budget', label: 'الميزانية', icon: 'target' },
      { id: 'savings', label: 'الادخار', icon: 'coins' },
      { id: 'debts', label: 'الديون', icon: 'card' },
    ], tab, 'fin-tab');
    const monthNav = ['overview', 'tx', 'budget'].includes(tab) ? `
      <div class="flex">
        <button class="icon-btn" data-act="fin-month" data-n="-1">${ic('prev')}</button>
        <span class="bold" style="min-width:110px;text-align:center">${D.monthName(mk)}</span>
        <button class="icon-btn" data-act="fin-month" data-n="1">${ic('next')}</button>
      </div>` : '';
    const body = { overview: finOverview, tx: finTx, budget: finBudget, savings: finSavings, debts: finDebts }[tab](mk);
    return `
      <div class="page-h">
        <div><h2>${ic('wallet', 'ic-lg')} المصاريف والأموال</h2><div class="sub">تحكّم في دخلك ومصاريفك وحقّق أهدافك المالية</div></div>
        <div class="actions">${monthNav}
          <button class="btn btn-sm" data-act="tx-new" data-type="income">${ic('plus')} دخل</button>
          <button class="btn btn-sm btn-primary" data-act="tx-new" data-type="expense">${ic('plus')} مصروف</button>
        </div>
      </div>
      <div class="mb">${tabs}</div>
      ${body}`;
  },
};

function finOverview(mk) {
  const inc = Fin.total(Fin.inMonth(mk, 'income'));
  const exp = Fin.total(Fin.inMonth(mk, 'expense'));
  const net = inc - exp;
  const bal = Fin.balance();
  const prevExp = Fin.total(Fin.inMonth(D.monthAdd(mk, -1), 'expense'));
  const delta = prevExp ? Math.round(((exp - prevExp) / prevExp) * 100) : null;
  const spent = Fin.spentBy(mk);
  const donutData = Object.entries(spent).map(([id, v]) => { const c = Fin.cat('expense', id); return { label: c.icon + ' ' + c.name, value: v }; });
  const months = Array.from({ length: 6 }, (_, i) => D.monthAdd(mk, i - 5));
  const barData = months.map(m => ({ label: MONTHS[Number(m.slice(5)) - 1], values: [Fin.total(Fin.inMonth(m, 'income')), Fin.total(Fin.inMonth(m, 'expense'))] }));
  const md = D.monthDays(mk);
  const isCur = mk === D.mk(D.today());
  const lastDay = isCur ? D.day(D.today()) : md;
  const daily = Array.from({ length: md }, (_, i) => {
    const k = mk + '-' + pad2(i + 1);
    return { label: String(i + 1), values: [i < lastDay ? Fin.total(App.state.transactions.filter(t => t.type === 'expense' && t.date === k)) : 0] };
  });
  const budget = sum(Object.values(App.state.budgets));
  const recent = App.state.transactions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
  const avgDaily = lastDay ? exp / lastDay : 0;

  return `
    <div class="grid g-4 keep-2 mb">
      <div class="card stat"><div class="si" style="--c:#6366f1">🏦</div><div><div class="sv ${bal < 0 ? 'bad' : ''}">${money(bal, false)}</div><div class="sl">الرصيد الإجمالي (${S().currency})</div></div></div>
      <div class="card stat"><div class="si" style="--c:#22c55e">📥</div><div><div class="sv">${money(inc, false)}</div><div class="sl">دخل الشهر</div></div></div>
      <div class="card stat"><div class="si" style="--c:#f97316">📤</div><div><div class="sv">${money(exp, false)}</div><div class="sl">مصروف الشهر ${delta !== null ? `<span class="${delta > 0 ? 'bad' : 'good'}">${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)}%</span>` : ''}</div></div></div>
      <div class="card stat"><div class="si" style="--c:${net >= 0 ? 'var(--good)' : 'var(--bad)'}">${net >= 0 ? '💚' : '⚠️'}</div><div><div class="sv">${inc ? pct(net, inc) : 0}%</div><div class="sl">نسبة الادخار · ${money(net)}</div></div></div>
    </div>
    <div class="grid g-2 mb">
      <div class="card">
        <div class="card-h"><div class="card-t">🍩 توزيع المصاريف حسب التصنيف</div></div>
        ${App.donut(donutData, { center: money(exp, false), centerSub: S().currency })}
      </div>
      <div class="card">
        <div class="card-h"><div class="card-t">📊 الدخل والمصروف — آخر 6 أشهر</div>${App.legend([{ name: 'الدخل', color: 'var(--s1)' }, { name: 'المصروف', color: 'var(--s2)' }])}</div>
        ${App.chart({ data: barData, series: [{ name: 'الدخل', color: 'var(--s1)' }, { name: 'المصروف', color: 'var(--s2)' }], height: 220, fmt: v => compactNum(v) })}
      </div>
    </div>
    <div class="grid g-2">
      <div class="card">
        <div class="card-h"><div class="card-t">📅 المصروف اليومي</div><span class="small muted">المتوسط ${money(Math.round(avgDaily))} يوميًا</span></div>
        ${App.chart({ data: daily, series: [{ name: 'المصروف', color: 'var(--s2)' }], height: 200, goal: budget ? budget / md : 0, goalLabel: 'الحد اليومي', fmt: v => compactNum(v) })}
      </div>
      <div class="card">
        <div class="card-h"><div class="card-t">🧾 أحدث العمليات</div><button class="btn btn-sm btn-ghost" data-act="fin-tab" data-id="tx">عرض الكل</button></div>
        ${recent.length ? recent.map(txRow).join('') : App.empty('🧾', 'لا عمليات بعد', 'سجّل أول مصروف لك من زر «مصروف»')}
      </div>
    </div>`;
}

function txRow(t) {
  const c = Fin.cat(t.type, t.cat);
  return `<div class="trow" style="cursor:pointer" data-act="tx-edit" data-id="${t.id}">
    <div class="cat-ic" style="--c:${t.type === 'income' ? 'var(--good)' : 'var(--s2)'}">${c.icon}</div>
    <div class="grow"><div class="small bold ellipsis">${esc(t.note || c.name)}</div><div class="tiny muted">${esc(c.name)} · ${D.rel(t.date)}${t.auto ? ' · تلقائي' : ''}</div></div>
    <div class="${t.type === 'income' ? 'amt-in' : 'amt-out'} tnum nowrap">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</div>
  </div>`;
}

function finTx(mk) {
  const f = App._txFilter = App._txFilter || { type: 'all', cat: '', q: '' };
  let list = Fin.inMonth(mk).filter(t => (f.type === 'all' || t.type === f.type) && (!f.cat || t.cat === f.cat) && (!f.q || (t.note || '').includes(f.q)));
  list.sort((a, b) => b.date.localeCompare(a.date));
  const inc = Fin.total(list.filter(t => t.type === 'income')), exp = Fin.total(list.filter(t => t.type === 'expense'));
  const cats = f.type === 'income' ? S().incomeCats : f.type === 'expense' ? S().expenseCats : S().expenseCats.concat(S().incomeCats.filter(c => !S().expenseCats.find(e => e.id === c.id)));
  return `
    <div class="flex flex-wrap mb" style="gap:10px">
      ${App.tabs([{ id: 'all', label: 'الكل' }, { id: 'expense', label: 'مصاريف' }, { id: 'income', label: 'دخل' }], f.type, 'tx-ftype')}
      <select class="inp inp-sm" style="width:auto" data-change="tx-fcat"><option value="">كل التصنيفات</option>${cats.map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}</select>
      <input class="inp inp-sm" style="width:200px" placeholder="بحث في الوصف..." value="${esc(f.q)}" data-change="tx-fq">
      <span class="grow"></span>
      <button class="btn btn-sm btn-ghost" data-act="tx-csv">${ic('download')} تصدير CSV</button>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>التاريخ</th><th>الوصف</th><th>التصنيف</th><th>طريقة الدفع</th><th>المبلغ</th><th></th></tr></thead>
        <tbody>${list.length ? list.map(t => {
          const c = Fin.cat(t.type, t.cat);
          return `<tr>
            <td class="num">${D.short(t.date)}<div class="tiny muted">${D.dayName(t.date)}</div></td>
            <td>${esc(t.note || '—')}${t.auto ? ' <span class="chip">تلقائي</span>' : ''}</td>
            <td><span class="chip">${c.icon} ${esc(c.name)}</span></td>
            <td class="muted small">${esc(t.method || '')}</td>
            <td class="num ${t.type === 'income' ? 'amt-in' : 'amt-out'}">${t.type === 'income' ? '+' : '−'}${money(t.amount)}</td>
            <td class="acts"><button class="icon-btn sm" data-act="tx-edit" data-id="${t.id}">${ic('edit')}</button><button class="icon-btn sm" data-act="tx-del" data-id="${t.id}">${ic('trash')}</button></td>
          </tr>`;
        }).join('') : `<tr><td colspan="6">${App.empty('🧾', 'لا توجد عمليات مطابقة')}</td></tr>`}</tbody>
        <tfoot><tr><td colspan="2">الإجمالي (${list.length} عملية)</td><td colspan="2"><span class="amt-in">+${money(inc)}</span> &nbsp; <span>−${money(exp)}</span></td><td class="num ${inc - exp >= 0 ? 'good' : 'bad'}" colspan="2">الصافي ${money(inc - exp)}</td></tr></tfoot>
      </table>
    </div>`;
}

function finBudget(mk) {
  const spent = Fin.spentBy(mk);
  const b = App.state.budgets;
  const totalB = sum(Object.values(b));
  const totalS = sum(Object.values(spent));
  const inc = Fin.total(Fin.inMonth(mk, 'income'));
  const md = D.monthDays(mk);
  const isCur = mk === D.mk(D.today());
  const dayN = isCur ? D.day(D.today()) : md;
  const remainingDays = isCur ? md - dayN + 1 : 0;
  return `
    <div class="grid g-3 mb">
      <div class="card stat">${App.ring(pct(totalS, totalB), { size: 84, stroke: 9, label: pct(totalS, totalB) + '%', color: pct(totalS, totalB) >= 100 ? 'var(--bad)' : pct(totalS, totalB) >= 80 ? 'var(--warn)' : 'var(--good)' })}
        <div><div class="sv">${money(totalS, false)} <span class="small muted">/ ${money(totalB, false)}</span></div><div class="sl">المصروف من الميزانية الكلية</div>
        ${isCur && totalB ? `<div class="tiny mt-s">المتبقي ${money(Math.max(0, totalB - totalS))} · يمكنك إنفاق <b>${money(Math.max(0, Math.round((totalB - totalS) / remainingDays)))}</b> يوميًا</div>` : ''}</div></div>
      <div class="card span-2">
        <div class="card-t mb">💡 قاعدة 50/30/20 لتوزيع الدخل ${inc ? `<span class="small muted">(دخل الشهر ${money(inc)})</span>` : ''}</div>
        <div class="grid g-3 keep-2" style="gap:10px">
          <div><div class="small muted">احتياجات أساسية 50%</div><div class="bold">${inc ? money(inc * .5) : '—'}</div><div class="tiny muted">سكن، فواتير، طعام، مواصلات</div></div>
          <div><div class="small muted">رغبات 30%</div><div class="bold">${inc ? money(inc * .3) : '—'}</div><div class="tiny muted">ترفيه، تسوق، مطاعم</div></div>
          <div><div class="small muted">ادخار واستثمار 20%</div><div class="bold">${inc ? money(inc * .2) : '—'}</div><div class="tiny muted">طوارئ، أهداف، استثمار</div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-h"><div class="card-t">🎯 ميزانية كل تصنيف (شهريًا)</div><span class="small muted">اكتب المبلغ في الخانة لتحديد الميزانية</span></div>
      ${S().expenseCats.map(c => {
        const sp = spent[c.id] || 0, bd = Number(b[c.id]) || 0, p = pct(sp, bd);
        const cls = !bd ? '' : p >= 100 ? 'status-bad' : p >= 80 ? 'status-warn' : 'status-ok';
        return `<div class="budget-row ${cls}">
          <div class="cat-ic" style="--c:var(--s1)">${c.icon}</div>
          <div><div class="flex between"><span class="bold small">${esc(c.name)}</span><span class="small tnum">${money(sp)} ${bd ? `<span class="muted">من ${money(bd, false)}</span>` : ''} ${bd ? (p >= 100 ? '<span class="bad">⚠ تجاوز</span>' : p >= 80 ? '<span class="warn">⚡ قريب</span>' : '<span class="good">✓</span>') : ''}</span></div>
            <div class="mt-s">${bd ? App.bar(p, 'var(--c)') : App.bar(0)}</div></div>
          <input class="tbl-inp" type="number" min="0" inputmode="decimal" value="${bd || ''}" placeholder="—" data-change="budget-set" data-cat="${c.id}" aria-label="ميزانية ${esc(c.name)}">
        </div>`;
      }).join('')}
    </div>`;
}

function finSavings() {
  const list = App.state.savings;
  const totalSaved = sum(list, x => x.saved), totalTarget = sum(list, x => x.target);
  return `
    <div class="flex between mb flex-wrap">
      <div class="small text-2">إجمالي المدّخر: <b>${money(totalSaved)}</b> من <b>${money(totalTarget)}</b></div>
      <button class="btn btn-sm btn-primary" data-act="saving-new">${ic('plus')} هدف ادخار</button>
    </div>
    ${list.length ? `<div class="grid g-auto">${list.map(x => {
      const p = pct(x.saved, x.target);
      let need = '';
      if (x.deadline && x.saved < x.target) {
        const months = Math.max(1, Math.ceil(D.diff(D.today(), x.deadline) / 30));
        need = `<div class="tiny muted">تحتاج ادخار <b>${money(Math.ceil((x.target - x.saved) / months))}</b> شهريًا لتصل ${D.rel(x.deadline)}</div>`;
      }
      return `<div class="card goal-card" style="--c:${x.color}">
        <div class="flex"><span style="font-size:1.6rem">${x.icon || '💰'}</span><div class="grow"><div class="bold">${esc(x.name)}</div><div class="tiny muted">${x.deadline ? 'الموعد: ' + D.fmt(x.deadline, true) : 'بدون موعد محدد'}</div></div>
          <button class="icon-btn sm" data-act="saving-edit" data-id="${x.id}">${ic('edit')}</button></div>
        <div class="flex" style="gap:14px">${App.ring(p, { size: 70, stroke: 8, label: p + '%', color: x.color })}
          <div><div class="bold">${money(x.saved)}</div><div class="small muted">من ${money(x.target)}</div>${need}</div></div>
        <div class="flex"><button class="btn btn-sm btn-soft grow" data-act="saving-move" data-id="${x.id}" data-dir="1">${ic('plus')} إيداع</button><button class="btn btn-sm btn-ghost" data-act="saving-move" data-id="${x.id}" data-dir="-1">سحب</button></div>
      </div>`;
    }).join('')}</div>` : `<div class="card">${App.empty('🐷', 'لا أهداف ادخار بعد', 'حدد هدفًا: صندوق طوارئ، سفر، سيارة، حج أو عمرة...', `<button class="btn btn-primary btn-sm" data-act="saving-new">${ic('plus')} أنشئ هدفك الأول</button>`)}</div>`}`;
}

function finDebts() {
  const list = App.state.debts.slice().sort((a, b) => (a.paid - b.paid) || (a.due || '9').localeCompare(b.due || '9'));
  const lent = sum(list.filter(x => x.type === 'lent' && !x.paid), x => x.amount);
  const borrowed = sum(list.filter(x => x.type === 'borrowed' && !x.paid), x => x.amount);
  return `
    <div class="grid g-3 mb">
      <div class="card stat"><div class="si" style="--c:var(--good)">📥</div><div><div class="sv">${money(lent, false)}</div><div class="sl">لي عند الآخرين</div></div></div>
      <div class="card stat"><div class="si" style="--c:var(--bad)">📤</div><div><div class="sv">${money(borrowed, false)}</div><div class="sl">عليّ للآخرين</div></div></div>
      <div class="card stat" style="justify-content:space-between"><div><div class="sv">${money(lent - borrowed)}</div><div class="sl">الصافي</div></div><button class="btn btn-sm btn-primary" data-act="debt-new">${ic('plus')} تسجيل دين</button></div>
    </div>
    <div class="tbl-wrap">
      <table class="tbl">
        <thead><tr><th>سُدّد</th><th>الشخص</th><th>النوع</th><th>المبلغ</th><th>التاريخ</th><th>الاستحقاق</th><th>ملاحظة</th><th></th></tr></thead>
        <tbody>${list.length ? list.map(x => {
          const late = !x.paid && x.due && x.due < D.today();
          return `<tr style="${x.paid ? 'opacity:.55' : ''}">
            <td>${App.chk(x.paid, 'debt-paid', `data-id="${x.id}"`, 'var(--good)')}</td>
            <td class="bold">${esc(x.person)}</td>
            <td><span class="chip c" style="--c:${x.type === 'lent' ? 'var(--good)' : 'var(--bad)'}">${x.type === 'lent' ? 'لي' : 'عليّ'}</span></td>
            <td class="num bold">${money(x.amount)}</td>
            <td class="num small">${x.date ? D.short(x.date) : '—'}</td>
            <td class="num small ${late ? 'bad' : ''}">${x.due ? D.short(x.due) + '<div class="tiny">' + D.rel(x.due) + '</div>' : '—'}</td>
            <td class="small muted">${esc(x.note || '')}</td>
            <td class="acts"><button class="icon-btn sm" data-act="debt-edit" data-id="${x.id}">${ic('edit')}</button></td>
          </tr>`;
        }).join('') : `<tr><td colspan="8">${App.empty('🤝', 'لا ديون مسجّلة', 'سجّل ما لك وما عليك حتى لا تنسى، وسيصلك تذكير قبل الموعد بيوم')}</td></tr>`}</tbody>
      </table>
    </div>`;
}

/* ---------- الأفعال ---------- */
App.on('fin-tab', el => App.go('finance', { tab: el.dataset.id }));
App.on('fin-month', el => { App._finMonth = D.monthAdd(App._finMonth, Number(el.dataset.n)); App.refresh(); });
App.on('tx-new', el => App.txForm(null, el.dataset.type));
App.on('tx-edit', el => App.txForm(byId(App.state.transactions, el.dataset.id)));
App.on('tx-del', el => App.withUndo('حُذفت العملية', s => { s.transactions = s.transactions.filter(t => t.id !== el.dataset.id); }));
App.on('tx-ftype', el => { App._txFilter.type = el.dataset.id; App._txFilter.cat = ''; App.refresh(); });
App.on('tx-fcat', el => { App._txFilter.cat = el.value; App.refresh(); });
App.on('tx-fq', el => { App._txFilter.q = el.value.trim(); App.refresh(); });
App.on('tx-csv', () => {
  const rows = [['التاريخ', 'النوع', 'التصنيف', 'الوصف', 'طريقة الدفع', 'المبلغ']];
  App.state.transactions.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(t => rows.push([t.date, t.type === 'income' ? 'دخل' : 'مصروف', Fin.cat(t.type, t.cat).name, t.note || '', t.method || '', t.amount]));
  const csv = '﻿' + rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  App.download('musaid-transactions.csv', csv, 'text/csv');
});
App.on('budget-set', el => {
  const v = Number(toLatinDigits(el.value));
  App.update(s => { if (v > 0) s.budgets[el.dataset.cat] = v; else delete s.budgets[el.dataset.cat]; });
});

App.txForm = function (t = null, type = 'expense') {
  const isNew = !t;
  type = t ? t.type : type;
  const cats = type === 'income' ? S().incomeCats : S().expenseCats;
  App.form({
    title: isNew ? (type === 'income' ? 'دخل جديد' : 'مصروف جديد') : 'تعديل العملية', icon: type === 'income' ? '💰' : '💸',
    values: t || { date: D.today(), cat: cats[0].id, method: S().payMethods[0] },
    fields: [
      { type: 'row', fields: [
        { name: 'amount', label: 'المبلغ (' + S().currency + ')', type: 'number', required: true, min: 0, placeholder: '0' },
        { name: 'date', label: 'التاريخ', type: 'date', required: true },
      ] },
      { name: 'note', label: 'الوصف', placeholder: type === 'income' ? 'مثال: راتب شهر أكتوبر' : 'مثال: غداء مع الأصدقاء' },
      { name: 'cat', label: 'التصنيف', type: 'seg', options: cats.map(c => [c.id, c.icon + ' ' + c.name]) },
      { name: 'method', label: 'طريقة الدفع', type: 'seg', options: S().payMethods.map(m => [m, m]) },
    ],
    onSubmit(v) {
      if (!(v.amount > 0)) { App.toast('أدخل مبلغًا صحيحًا', { icon: '✋' }); return false; }
      App.update(s => {
        if (isNew) s.transactions.push(Object.assign({ id: uid(), type }, v));
        else Object.assign(byId(s.transactions, t.id), v);
      });
      App.toast(isNew ? 'سُجّلت العملية' : 'حُفظت التعديلات', { icon: type === 'income' ? '💰' : '💸' });
    },
    onDelete: t ? () => App.withUndo('حُذفت العملية', s => { s.transactions = s.transactions.filter(x => x.id !== t.id); }) : null,
  });
};

App.savingForm = function (x = null) {
  App.form({
    title: x ? 'تعديل هدف الادخار' : 'هدف ادخار جديد', icon: '🐷',
    values: x || { color: COLORS[4], icon: '💰', saved: 0 },
    fields: [
      { name: 'name', label: 'اسم الهدف', required: true, placeholder: 'مثال: صندوق الطوارئ' },
      { type: 'row', fields: [
        { name: 'target', label: 'المبلغ المستهدف', type: 'number', required: true, min: 0 },
        { name: 'saved', label: 'المدّخر حاليًا', type: 'number', min: 0 },
        { name: 'deadline', label: 'الموعد المستهدف', type: 'date' },
      ] },
      { name: 'icon', label: 'الرمز', type: 'emoji', options: ['💰', '🏠', '🚗', '✈️', '🕋', '💍', '🎓', '💻', '📱', '🛡️', '🏥', '🎁'] },
      { name: 'color', label: 'اللون', type: 'color' },
    ],
    onSubmit(v) {
      v.saved = v.saved || 0;
      App.update(s => { if (x) Object.assign(byId(s.savings, x.id), v); else s.savings.push(Object.assign({ id: uid() }, v)); });
    },
    onDelete: x ? () => App.withUndo('حُذف هدف الادخار', s => { s.savings = s.savings.filter(y => y.id !== x.id); }) : null,
  });
};
App.on('saving-new', () => App.savingForm());
App.on('saving-edit', el => App.savingForm(byId(App.state.savings, el.dataset.id)));
App.on('saving-move', el => {
  const x = byId(App.state.savings, el.dataset.id), dir = Number(el.dataset.dir);
  App.form({
    title: dir > 0 ? 'إيداع في «' + x.name + '»' : 'سحب من «' + x.name + '»', size: 'narrow',
    fields: [{ name: 'a', label: 'المبلغ', type: 'number', required: true, min: 0 }, { name: 'log', label: dir > 0 ? 'سجّله كمصروف (تحويل للادخار)' : 'سجّله كدخل', type: 'switch', value: false }],
    onSubmit({ a, log }) {
      if (!(a > 0)) return false;
      App.update(s => {
        x.saved = Math.max(0, (x.saved || 0) + dir * a);
        if (log) s.transactions.push({ id: uid(), type: dir > 0 ? 'expense' : 'income', amount: a, cat: 'other', note: (dir > 0 ? 'ادخار: ' : 'سحب من ادخار: ') + x.name, date: D.today(), method: 'تحويل' });
      });
      if (x.saved >= x.target && dir > 0) { App.confetti(); App.toast('مبارك! حققت هدف الادخار 🎉', { icon: '🏆' }); }
    },
  });
});

App.debtForm = function (x = null, preset = {}) {
  App.form({
    title: x ? 'تعديل الدين' : 'تسجيل دين', icon: '🤝',
    values: x || Object.assign({ type: 'lent', date: D.today() }, preset),
    fields: [
      { name: 'type', label: 'النوع', type: 'seg', options: [['lent', '📥 لي (أقرضت)'], ['borrowed', '📤 عليّ (اقترضت)']] },
      { type: 'row', fields: [
        { name: 'person', label: 'الشخص', required: true },
        { name: 'amount', label: 'المبلغ', type: 'number', required: true, min: 0 },
      ] },
      { type: 'row', fields: [
        { name: 'date', label: 'تاريخ الدين', type: 'date' },
        { name: 'due', label: 'تاريخ الاستحقاق', type: 'date', hint: 'يصلك تذكير قبله بيوم' },
      ] },
      { name: 'note', label: 'ملاحظة' },
    ],
    onSubmit(v) { App.update(s => { if (x) Object.assign(byId(s.debts, x.id), v); else s.debts.push(Object.assign({ id: uid(), paid: false }, v)); }); },
    onDelete: x ? () => App.withUndo('حُذف الدين', s => { s.debts = s.debts.filter(y => y.id !== x.id); }) : null,
  });
};
App.on('debt-new', () => App.debtForm());
App.on('debt-edit', el => App.debtForm(byId(App.state.debts, el.dataset.id)));
App.on('debt-paid', el => App.update(s => { const x = byId(s.debts, el.dataset.id); if (x) { x.paid = !x.paid; if (x.paid) App.toast('تم تسديد الدين ✓', { icon: '🤝' }); } }));
