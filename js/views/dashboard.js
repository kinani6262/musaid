'use strict';
/* =========================================================
   لوحة اليوم
   ========================================================= */

const QUOTES = [
  { t: 'احرص على ما ينفعك، واستعن بالله ولا تعجز', s: 'رواه مسلم' },
  { t: 'أحبُّ الأعمال إلى الله أدومها وإن قلّ', s: 'متفق عليه' },
  { t: 'وَأَن لَّيْسَ لِلْإِنسَانِ إِلَّا مَا سَعَىٰ', s: 'سورة النجم: 39' },
  { t: 'إِنَّ اللَّهَ لَا يُغَيِّرُ مَا بِقَوْمٍ حَتَّىٰ يُغَيِّرُوا مَا بِأَنفُسِهِمْ', s: 'سورة الرعد: 11' },
  { t: 'فَإِذَا فَرَغْتَ فَانصَبْ', s: 'سورة الشرح: 7' },
  { t: 'وَقُل رَّبِّ زِدْنِي عِلْمًا', s: 'سورة طه: 114' },
  { t: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا', s: 'سورة الشرح: 5' },
  { t: 'نعمتان مغبون فيهما كثير من الناس: الصحة والفراغ', s: 'رواه البخاري' },
  { t: 'الوقت كالسيف، إن لم تقطعه قطعك', s: 'حكمة عربية' },
  { t: 'من جدّ وجد، ومن زرع حصد', s: 'حكمة عربية' },
  { t: 'قليلٌ دائم خيرٌ من كثيرٍ منقطع', s: 'حكمة' },
  { t: 'خطوة صغيرة كل يوم تصنع فرقًا كبيرًا بعد عام', s: 'حكمة' },
  { t: 'ابدأ بالأهم قبل المهم، ولا تؤجّل عمل اليوم إلى الغد', s: 'حكمة' },
  { t: 'النجاح هو مجموع جهود صغيرة تتكرر يومًا بعد يوم', s: 'حكمة' },
];

App.views.dashboard = {
  title: 'لوحة اليوم',
  render() {
    const s = App.state, today = D.today(), now = new Date();
    const h = now.getHours();
    const greet = h < 4 ? 'ليلة هادئة' : h < 12 ? 'صباح الخير' : h < 17 ? 'طاب يومك' : 'مساء الخير';
    const qi = (Math.floor(Date.now() / 864e5) + (App._quoteShift || 0)) % QUOTES.length;
    const q = QUOTES[qi];
    const st = T.stats(today);
    const habitsDue = s.habits.filter(x => !x.archived && Habits.isDue(x, today));
    const habitsDone = habitsDue.filter(x => Habits.isDoneOn(x, today)).length;
    const mk = D.mk(today);
    const spent = sum(s.transactions.filter(t => t.type === 'expense' && D.mk(t.date) === mk), t => t.amount);
    const income = sum(s.transactions.filter(t => t.type === 'income' && D.mk(t.date) === mk), t => t.amount);
    const budget = sum(Object.values(s.budgets));
    const wk = D.weekDays(today);
    const studyMin = sum(s.sessions.filter(x => x.date >= wk[0] && x.date <= wk[6]), x => x.min);
    const np = S().prayer.show ? Prayer.next() : null;

    const hero = `
      <div class="hero">
        <div class="flex between flex-wrap" style="align-items:flex-start">
          <div>
            <h2>${greet}${S().name ? '، ' + esc(S().name) : ''} 👋</h2>
            <div class="hdate">${D.fmt(today)}${S().showHijri ? ' · ' + D.hijri(today) : ''}</div>
          </div>
          <button class="btn btn-sm" style="background:rgba(255,255,255,.18);border:0;color:#fff" data-act="quick-add">${ic('plus')} إضافة سريعة</button>
        </div>
        <div class="quote" data-act="next-quote" style="cursor:pointer" title="اضغط لحكمة أخرى">«${esc(q.t)}»<small>— ${esc(q.s)}</small></div>
        <div class="hstats">
          <span class="hs">📋 المهام <b>${st.done}/${st.total}</b></span>
          <span class="hs">🔥 العادات <b>${habitsDone}/${habitsDue.length}</b></span>
          ${np ? `<span class="hs">🕌 ${np.name} بعد <b>${durText(np.inMin)}</b></span>` : ''}
          <span class="hs">💸 مصروف الشهر <b>${money(spent)}</b></span>
        </div>
      </div>`;

    const stats = `
      <div class="grid g-4 keep-2 mt">
        <div class="card stat" data-act="go" data-view="day" style="cursor:pointer">
          ${App.ring(st.pct, { size: 54, stroke: 6, label: st.pct + '%', color: 'var(--ac)' })}
          <div><div class="sv">${st.done}<span class="muted small"> / ${st.total}</span></div><div class="sl">مهام اليوم</div></div>
        </div>
        <div class="card stat" data-act="go" data-view="habits" style="cursor:pointer">
          ${App.ring(pct(habitsDone, habitsDue.length), { size: 54, stroke: 6, label: pct(habitsDone, habitsDue.length) + '%', color: '#f97316' })}
          <div><div class="sv">${habitsDone}<span class="muted small"> / ${habitsDue.length}</span></div><div class="sl">عادات اليوم</div></div>
        </div>
        <div class="card stat" data-act="go" data-view="finance" style="cursor:pointer">
          <div class="si" style="--c:#22c55e">💰</div>
          <div class="grow"><div class="sv">${money(spent, false)}</div><div class="sl">مصروف ${MONTHS[now.getMonth()]}${budget ? ` من ${money(budget, false)}` : ''}</div>
          ${budget ? App.bar(pct(spent, budget), pct(spent, budget) >= 100 ? 'var(--bad)' : pct(spent, budget) >= 80 ? 'var(--warn)' : 'var(--good)', 'thin') : `<div class="tiny ${income - spent >= 0 ? 'good' : 'bad'}">الصافي ${money(income - spent)}</div>`}</div>
        </div>
        <div class="card stat" data-act="go" data-view="study" style="cursor:pointer">
          <div class="si" style="--c:#a855f7">🎓</div>
          <div><div class="sv">${hoursText(studyMin)} <span class="small muted">ساعة</span></div><div class="sl">دراسة هذا الأسبوع</div></div>
        </div>
      </div>`;

    // مهام اليوم
    const tasks = T.on(today);
    const od = T.overdue();
    const tasksCard = `
      <div class="card">
        <div class="card-h">
          <div class="card-t"><span class="ti" style="--c:#3b82f6">${ic('day')}</span> مهام اليوم</div>
          <div class="flex">
            <button class="btn btn-sm btn-ghost" data-act="go" data-view="day">عرض الجدول</button>
            <button class="btn btn-sm btn-soft" data-act="task-new" data-date="${today}">${ic('plus')} مهمة</button>
          </div>
        </div>
        ${od.length ? `<div class="insight" style="--c:var(--bad)" data-act="move-overdue"><span class="ie">⏰</span><div class="grow"><div class="it">${od.length} مهام متأخرة من أيام سابقة</div><div class="is">اضغط لنقلها جميعًا إلى اليوم</div></div></div>` : ''}
        <div class="tlist">${tasks.length ? tasks.slice(0, 8).map(t => T.row(t, today)).join('') : App.empty('🌤️', 'لا مهام لليوم بعد', 'ابدأ بإضافة أهم ثلاث مهام لديك')}</div>
        ${tasks.length > 8 ? `<button class="btn btn-ghost btn-sm btn-block mt-s" data-act="go" data-view="day">عرض كل المهام (${tasks.length})</button>` : ''}
      </div>`;

    // العادات
    const habitsCard = `
      <div class="card">
        <div class="card-h">
          <div class="card-t"><span class="ti" style="--c:#f97316">${ic('flame')}</span> عادات اليوم</div>
          <button class="btn btn-sm btn-ghost" data-act="go" data-view="habits">إدارة العادات</button>
        </div>
        ${habitsDue.length ? `<div class="grid g-auto-s" style="gap:8px">${habitsDue.map(hb => {
          const done = Habits.isDoneOn(hb, today), cnt = Habits.count(hb, today);
          return `<button class="tpl" style="border-style:solid;${done ? `background:color-mix(in srgb, ${hb.color} 18%, var(--surface-2));border-color:${hb.color}` : ''}" data-act="habit-tap" data-id="${hb.id}" data-date="${today}">
            <span class="te">${hb.icon}</span><span class="grow"><span class="bold">${esc(hb.name)}</span><br><span class="tiny muted">${hb.target > 1 ? `${cnt}/${hb.target} ${esc(hb.unit || '')}` : done ? 'تم ✓' : 'اضغط للإنجاز'} · 🔥 ${Habits.streak(hb)}</span></span>
          </button>`;
        }).join('')}</div>` : App.empty('🌱', 'لا عادات مجدولة لليوم', '', `<button class="btn btn-soft btn-sm" data-act="go" data-view="habits">ابنِ عادتك الأولى</button>`)}
      </div>`;

    // المتابعات
    const trk = s.trackers.filter(t => !t.archived && t.dated !== false);
    const trackersCard = trk.length ? `
      <div class="card">
        <div class="card-h">
          <div class="card-t"><span class="ti" style="--c:#10b981">${ic('tracker')}</span> المتابعة اليومية</div>
          <button class="btn btn-sm btn-ghost" data-act="go" data-view="trackers">كل المتابعات</button>
        </div>
        <div class="col" style="gap:12px">${trk.map(t => {
          const idx = D.diff(t.start, today);
          const inRange = idx >= 0 && idx < t.cells;
          const prog = Trackers.progress(t);
          return `<div class="flex flex-wrap" style="gap:10px">
            <span style="font-size:1.3rem">${t.icon}</span>
            <div class="grow" style="min-width:140px"><div class="bold small">${esc(t.name)}</div>
              <div class="tiny muted">${inRange ? `اليوم ${idx + 1} من ${t.cells}` : idx < 0 ? `يبدأ ${D.rel(t.start)}` : 'انتهت المدة'} · ${prog.pct}%</div>
              ${App.bar(prog.pct, t.color, 'thin')}</div>
            ${inRange ? `<div class="flex flex-wrap" style="gap:5px">${Trackers.rows(t).map((r, ri) => {
              const v = Trackers.get(t, ri, idx);
              return `<button class="hcell ${v === 1 ? 'on' : ''}" style="--c:${t.color};width:auto;min-width:34px;padding:0 8px;${v === 1 ? '' : 'color:var(--text-2)'}" data-act="trk-cell" data-id="${t.id}" data-r="${ri}" data-c="${idx}" data-tip="${esc(r)}">${v === 1 ? CHECK_SVG : v === 2 ? X_SVG : esc(Trackers.rows(t).length > 1 ? r.slice(0, 5) : '✓')}</button>`;
            }).join('')}</div>` : ''}
          </div>`;
        }).join('')}</div>
      </div>` : '';

    // مواقيت الصلاة
    let prayerCard = '';
    if (S().prayer.show) {
      const list = Prayer.list(today), nowM = D.nowMin();
      prayerCard = `
        <div class="card">
          <div class="card-h">
            <div class="card-t"><span class="ti" style="--c:#14b8a6">🕌</span> مواقيت الصلاة</div>
            <span class="tiny muted" data-act="go" data-view="settings" style="cursor:pointer">${esc(Prayer.cityName())} ⚙️</span>
          </div>
          <div class="prayers">${list.map(p => `<div class="pr ${np && np.id === p.id && np.day === today ? 'next' : ''} ${p.min < nowM ? 'passed' : ''}"><div class="pn">${p.name}</div><div class="pt">${p.time ? (([t, suf]) => t + (suf ? `<br><span class="tiny">${suf}</span>` : ''))(D.time(p.time).split(' ')) : '—'}</div></div>`).join('')}</div>
          ${np ? `<div class="mt-s small text-2" style="text-align:center">الصلاة القادمة: <b>${np.name}</b> بعد <b>${durText(np.inMin)}</b></div>` : ''}
        </div>`;
    }

    // القادم
    const upcoming = [];
    for (let i = 1; i <= 14; i++) {
      const k = D.add(today, i);
      App.eventsOn(k, { skipDaily: true }).forEach(e => upcoming.push(Object.assign({ date: k }, e)));
    }
    const upCard = `
      <div class="card">
        <div class="card-h">
          <div class="card-t"><span class="ti" style="--c:#6366f1">${ic('calendar')}</span> القادم خلال أسبوعين</div>
          <button class="btn btn-sm btn-ghost" data-act="go" data-view="calendar">التقويم</button>
        </div>
        ${upcoming.length ? upcoming.slice(0, 7).map(e => `
          <div class="agenda-item" style="--c:${e.color}" ${e.open ? `data-act="${e.open}" data-id="${e.id}"` : ''}>
            <div class="ad"><b>${D.day(e.date)}</b><small>${D.dayShort(e.date)}</small></div>
            <div class="grow"><div class="bold small ellipsis">${e.icon} ${esc(e.title)}</div><div class="tiny muted">${D.rel(e.date)}${e.time ? ' · ' + D.time(e.time) : ''}${e.remind ? ' · 🔔 تذكير قبل يوم' : ''}</div></div>
          </div>`).join('') : App.empty('🗓️', 'لا مواعيد قادمة', 'أضف مواعيدك المستقبلية من التقويم')}
      </div>`;

    // الماء
    const hl = s.health[today] || {};
    const waterCard = `
      <div class="card">
        <div class="card-h">
          <div class="card-t"><span class="ti" style="--c:var(--info)">${ic('drop')}</span> شرب الماء</div>
          <span class="small muted">${hl.water || 0} / ${S().waterGoal} أكواب</span>
        </div>
        <div class="glasses">${Array.from({ length: S().waterGoal }, (_, i) => `<button class="glass ${i < (hl.water || 0) ? 'on' : ''}" data-act="water-set" data-n="${i + 1}" aria-label="كوب ${i + 1}"></button>`).join('')}</div>
      </div>`;

    const insights = App.insights();
    const insightsCard = `
      <div class="card">
        <div class="card-h"><div class="card-t"><span class="ti">${ic('sparkles')}</span> اقتراحات ذكية</div></div>
        ${insights.slice(0, 6).map(App.insightHtml).join('')}
      </div>`;

    return `${hero}${stats}
      <div class="layout-main mt">
        <div class="col" style="gap:16px">${tasksCard}${habitsCard}${trackersCard}</div>
        <div class="col" style="gap:16px">${prayerCard}${insightsCard}${upCard}${waterCard}</div>
      </div>`;
  },
};

App.on('next-quote', () => { App._quoteShift = (App._quoteShift || 0) + 1; App.refresh(); });
App.on('go', el => {
  let params = {};
  try { params = el.dataset.params ? JSON.parse(el.dataset.params) : {}; } catch (e) { params = {}; }
  App.go(el.dataset.view, params);
});
App.on('water-set', el => {
  const k = el.dataset.date || D.today();
  const n = Number(el.dataset.n);
  App.update(s => {
    const h = s.health[k] = s.health[k] || {};
    h.water = (h.water || 0) === n ? n - 1 : n;
    if (h.water >= S().waterGoal && n === S().waterGoal) App.toast('أحسنت! حققت هدف الماء اليوم 💧', { icon: '💧' });
  });
});
