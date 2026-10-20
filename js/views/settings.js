'use strict';
/* =========================================================
   الإعدادات والبيانات
   ========================================================= */

const CURRENCIES = [
  ['ر.س', 'ريال سعودي (ر.س)'], ['د.إ', 'درهم إماراتي (د.إ)'], ['د.ك', 'دينار كويتي (د.ك)'], ['ر.ق', 'ريال قطري (ر.ق)'],
  ['د.ب', 'دينار بحريني (د.ب)'], ['ر.ع', 'ريال عماني (ر.ع)'], ['ج.م', 'جنيه مصري (ج.م)'], ['د.أ', 'دينار أردني (د.أ)'],
  ['د.ع', 'دينار عراقي (د.ع)'], ['ر.ي', 'ريال يمني (ر.ي)'], ['ج.س', 'جنيه سوداني (ج.س)'], ['د.ل', 'دينار ليبي (د.ل)'],
  ['د.ت', 'دينار تونسي (د.ت)'], ['د.ج', 'دينار جزائري (د.ج)'], ['د.م', 'درهم مغربي (د.م)'], ['ل.س', 'ليرة سورية (ل.س)'],
  ['ل.ل', 'ليرة لبنانية (ل.ل)'], ['₺', 'ليرة تركية (₺)'], ['$', 'دولار ($)'], ['€', 'يورو (€)'],
];
const ACCENTS = [['violet', '#7c5cff'], ['indigo', '#4f46e5'], ['ocean', '#0284c7'], ['emerald', '#059669'], ['gold', '#b7791f'], ['sunset', '#ea580c'], ['rose', '#db2777']];

App.views.settings = {
  title: 'الإعدادات',
  render() {
    const st = S(), p = st.prayer;
    const perm = 'Notification' in window ? Notification.permission : 'unsupported';
    const sel = (k, opts, v) => `<select class="inp inp-sm" style="width:auto;min-width:150px" data-change="set" data-k="${k}">${opts.map(o => `<option value="${esc(o[0])}" ${String(v) === String(o[0]) ? 'selected' : ''}>${esc(o[1])}</option>`).join('')}</select>`;
    const sw = (k, v) => `<label class="switch"><input type="checkbox" ${v ? 'checked' : ''} data-change="set" data-k="${k}" data-bool="1"><i></i></label>`;
    const num = (k, v, min, max, step = 1) => `<input class="inp inp-sm tbl-inp" style="width:90px" type="number" min="${min}" max="${max}" step="${step}" value="${v}" data-change="set" data-k="${k}" data-num="1">`;
    const row = (title, sub, ctrl) => `<div class="toggle-row"><div><div class="bold small">${title}</div>${sub ? `<div class="tiny muted">${sub}</div>` : ''}</div>${ctrl}</div>`;
    const hours = Array.from({ length: 24 }, (_, h) => [h, D.hourLabel(h)]);
    const pt = Prayer.list(D.today());

    return `
      <div class="page-h"><div><h2>${ic('settings', 'ic-lg')} الإعدادات</h2><div class="sub">خصّص التطبيق كما يناسبك — ${App.sync.user ? 'بياناتك متزامنة بين أجهزتك' : 'كل البيانات محفوظة على جهازك فقط'}</div></div></div>
      <div class="grid g-2">
        <div class="col" style="gap:16px">
          <div class="card">
            <div class="card-t mb">👤 الملف الشخصي</div>
            <div class="field" style="margin:0"><label>اسمك (للترحيب)</label><input class="inp" value="${esc(st.name)}" data-change="set" data-k="name" placeholder="اكتب اسمك"></div>
          </div>

          <div class="card">
            <div class="card-t mb">🎨 المظهر</div>
            ${row('السِّمة', '', `<div class="tabs">${[['dark', '🌙 ليلي'], ['light', '☀️ نهاري'], ['auto', '🖥️ تلقائي']].map(([v, l]) => `<button class="tab ${st.theme === v ? 'on' : ''}" data-act="set-theme" data-v="${v}">${l}</button>`).join('')}</div>`)}
            ${row('اللون المميّز', '', `<div class="swatches">${ACCENTS.map(([id, c]) => `<button class="sw ${st.accent === id ? 'on' : ''}" style="--c:${c}" data-act="set-accent" data-v="${id}" aria-label="${id}"></button>`).join('')}</div>`)}
            ${row('شكل الأرقام', 'تُطبَّق على النصوص المعروضة', sel('digits', [['latn', '123 لاتينية'], ['arab', '١٢٣ عربية']], st.digits))}
            ${row('صيغة الوقت', '', sel('timeFmt', [['12', '12 ساعة (ص/م)'], ['24', '24 ساعة']], st.timeFmt))}
            ${row('إظهار التاريخ الهجري', 'تقويم أم القرى', sw('showHijri', st.showHijri))}
          </div>

          <div class="card">
            <div class="card-t mb">🗓️ التقويم والجدول</div>
            ${row('بداية الأسبوع', '', sel('weekStart', [[6, 'السبت'], [0, 'الأحد'], [1, 'الاثنين']], st.weekStart))}
            ${row('بداية اليوم في الجدول', '', sel('dayStart', hours, st.dayStart))}
            ${row('نهاية اليوم في الجدول', '', sel('dayEnd', hours, st.dayEnd))}
          </div>

          <div class="card">
            <div class="card-t mb">🔔 التنبيهات</div>
            ${row('تفعيل التنبيهات', 'قبل المواعيد بيوم، وقبل وقت المهام، وقبل تجديد الاشتراكات', sw('notify', st.notify))}
            ${row('إشعارات النظام', perm === 'granted' ? '✅ مفعّلة — تصلك حتى وأنت في نافذة أخرى' : perm === 'denied' ? '⛔ محظورة من المتصفح — فعّلها من إعدادات الموقع' : perm === 'unsupported' ? 'غير مدعومة في هذا المتصفح' : 'اسمح للتطبيق بإظهار الإشعارات',
              perm === 'default' ? `<button class="btn btn-sm btn-soft" data-act="ask-notify">السماح</button>` : perm === 'granted' ? `<button class="btn btn-sm btn-ghost" data-act="test-notify">تجربة</button>` : '')}
            ${row('التنبيه قبل وقت المهمة بـ', 'بالدقائق', num('notifyMinutes', st.notifyMinutes, 0, 120))}
            ${row('صوت التنبيه', '', sw('sound', st.sound))}
            <div class="tiny muted mt-s">ℹ️ تعمل التنبيهات ما دام التطبيق مفتوحًا. لتنبيهات على هاتفك حتى والتطبيق مغلق، استعمل «الربط مع الهاتف» بالأسفل.</div>
          </div>

          ${App.sync.cardHtml()}

          <div class="card">
            <div class="card-t mb">📱 الربط مع الهاتف</div>
            <div class="small text-2 mb">صدّر جدولك إلى تقويم الهاتف لتصلك كل التنبيهات حتى والتطبيق مغلق، وافتح التطبيق نفسه على الهاتف من رابط واحد.${matchMedia('(display-mode: standalone)').matches ? ' <b>✅ التطبيق مثبّت على هذا الجهاز.</b>' : ''}</div>
            <div class="flex flex-wrap">
              <button class="btn btn-sm btn-primary" data-act="phone-guide">📱 دليل الربط خطوة بخطوة</button>
              <button class="btn btn-sm" data-act="export-ics">${ic('download')} تصدير إلى تقويم الهاتف</button>
              ${App._install ? `<button class="btn btn-sm btn-soft" data-act="install-app">📲 تثبيت التطبيق</button>` : ''}
            </div>
          </div>

          <div class="card">
            <div class="card-t mb">📅 جدولي الأساسي</div>
            <div class="small text-2 mb">السنن اليومية، والدروس والبرامج الأسبوعية، والعادات. يُضاف تلقائيًا في أول فتح على أي جهاز، ويمكنك إعادة تحميله متى شئت.</div>
            <div class="flex flex-wrap">
              <button class="btn btn-sm btn-soft" data-act="schedule-reload">${ic('reset')} إعادة تحميل جدولي</button>
              ${App.oldData() ? `<button class="btn btn-sm" data-act="old-data-download">${ic('download')} تنزيل البيانات السابقة</button>
              <button class="btn btn-sm btn-ghost" data-act="old-data-restore">↩️ استعادة البيانات السابقة</button>` : ''}
            </div>
            <div class="tiny muted mt-s">البيانات التجريبية الافتراضية محفوظة كما هي في الملف <span class="keep-latn">js/demo.js</span>، وتعرضها من «تحميل بيانات تجريبية» بالأسفل.</div>
          </div>

          <div class="card">
            <div class="card-t mb">🍅 مؤقّت التركيز والعافية</div>
            ${row('مدة جلسة التركيز (دقيقة)', '', num('pomodoro.focus', st.pomodoro.focus, 5, 120))}
            ${row('الاستراحة القصيرة', '', num('pomodoro.short', st.pomodoro.short, 1, 30))}
            ${row('الاستراحة الطويلة', '', num('pomodoro.long', st.pomodoro.long, 5, 60))}
            ${row('استراحة طويلة كل', 'جلسات', num('pomodoro.every', st.pomodoro.every, 2, 8))}
            ${row('هدف الماء اليومي', 'أكواب', num('waterGoal', st.waterGoal, 1, 20))}
            ${row('هدف النوم', 'ساعات', num('sleepGoal', st.sleepGoal, 4, 12, 0.5))}
          </div>
        </div>

        <div class="col" style="gap:16px">
          <div class="card">
            <div class="card-t mb">🕌 مواقيت الصلاة</div>
            ${row('إظهار مواقيت الصلاة', 'في لوحة اليوم', sw('prayer.show', p.show))}
            ${row('إظهارها في جدول اليوم', 'وتجنّبها عند الترتيب التلقائي', sw('prayer.inDay', p.inDay))}
            ${row('تنبيه قبل الأذان بـ10 دقائق', '', sw('prayer.remind', p.remind))}
            ${row('المدينة', '', `<select class="inp inp-sm" style="width:auto" data-change="set-city">${Prayer.CITIES.map(c => `<option value="${c[0]}" ${p.city === c[0] ? 'selected' : ''}>${c[1]}</option>`).join('')}<option value="custom" ${p.city === 'custom' ? 'selected' : ''}>📍 موقع مخصّص</option></select>`)}
            ${row('طريقة الحساب', '', sel('prayer.method', Object.entries(Prayer.METHODS).map(([k, m]) => [k, m.name]), p.method))}
            ${row('حساب العصر', '', sel('prayer.asr', [[1, 'الجمهور (المثل)'], [2, 'الحنفي (المثلين)']], p.asr))}
            <div class="row mt-s">
              <div class="field"><label>خط العرض</label><input class="inp inp-sm" type="number" step="0.0001" value="${p.lat}" data-change="set-coord" data-k="lat"></div>
              <div class="field"><label>خط الطول</label><input class="inp inp-sm" type="number" step="0.0001" value="${p.lng}" data-change="set-coord" data-k="lng"></div>
            </div>
            <button class="btn btn-sm btn-ghost" data-act="geo-locate">📍 تحديد موقعي تلقائيًا</button>
            <div class="prayers mt">${pt.map(x => `<div class="pr"><div class="pn">${x.name}</div><div class="pt" style="font-size:.85rem">${x.time ? D.time(x.time) : '—'}</div></div>`).join('')}</div>
          </div>

          <div class="card">
            <div class="card-t mb">💰 المال</div>
            ${row('العملة', '', sel('currency', CURRENCIES, st.currency))}
            <div class="lbl mt mb">تصنيفات المصاريف</div>
            <div class="flex flex-wrap" style="gap:6px">${st.expenseCats.map(c => `<span class="chip" style="padding:4px 6px 4px 10px">${c.icon} ${esc(c.name)} ${st.expenseCats.length > 1 ? `<button class="icon-btn sm" style="width:20px;height:20px" data-act="cat-del" data-type="expense" data-id="${c.id}">${ic('x')}</button>` : ''}</span>`).join('')}
              <button class="btn btn-sm btn-soft" data-act="cat-add" data-type="expense">${ic('plus')} تصنيف</button></div>
            <div class="lbl mt mb">مصادر الدخل</div>
            <div class="flex flex-wrap" style="gap:6px">${st.incomeCats.map(c => `<span class="chip" style="padding:4px 6px 4px 10px">${c.icon} ${esc(c.name)} ${st.incomeCats.length > 1 ? `<button class="icon-btn sm" style="width:20px;height:20px" data-act="cat-del" data-type="income" data-id="${c.id}">${ic('x')}</button>` : ''}</span>`).join('')}
              <button class="btn btn-sm btn-soft" data-act="cat-add" data-type="income">${ic('plus')} مصدر</button></div>
          </div>

          <div class="card">
            <div class="card-t mb">🧭 مجالات الحياة (لخطة الشهر والأهداف)</div>
            ${st.areas.map(a => `<div class="trow"><span class="cat-ic" style="--c:${a.color}">${a.icon}</span><div class="grow bold small">${esc(a.name)}</div><button class="icon-btn sm" data-act="area-edit" data-id="${a.id}">${ic('edit')}</button>${st.areas.length > 1 ? `<button class="icon-btn sm" data-act="area-del" data-id="${a.id}">${ic('trash')}</button>` : ''}</div>`).join('')}
            <button class="btn btn-sm btn-soft mt-s" data-act="area-edit">${ic('plus')} مجال جديد</button>
          </div>

          <div class="card">
            <div class="card-t mb">💾 البيانات والنسخ الاحتياطي</div>
            <div class="small text-2 mb">${App.sync.user ? 'بياناتك محفوظة في متصفحك وفي حسابك للمزامنة. النسخة الاحتياطية احتياط إضافي.' : 'بياناتك محفوظة في متصفحك على هذا الجهاز فقط. صدّر نسخة احتياطية بانتظام، ويمكنك استيرادها على جهاز آخر.'}</div>
            <div class="flex flex-wrap">
              <button class="btn btn-sm btn-primary" data-act="backup-export">${ic('download')} تصدير نسخة احتياطية</button>
              <button class="btn btn-sm" data-act="backup-import">${ic('upload')} استيراد نسخة</button>
              <button class="btn btn-sm btn-ghost" data-act="demo-load">${ic('sparkles')} تحميل بيانات تجريبية</button>
              <button class="btn btn-sm btn-danger" data-act="data-reset">${ic('trash')} حذف كل البيانات</button>
            </div>
            <input type="file" id="import-file" accept=".json,application/json" hidden>
            <div class="tiny muted mt-s">حجم البيانات الحالي: ${(JSON.stringify(App.state).length / 1024).toFixed(1)} كيلوبايت</div>
          </div>

          <div class="card">
            <div class="card-t mb">⌨️ اختصارات لوحة المفاتيح</div>
            <div class="small text-2" style="line-height:2.1">
              <span class="chip">N</span> إضافة سريعة &nbsp; <span class="chip">Ctrl + K</span> بحث &nbsp; <span class="chip">T</span> تبديل المظهر<br>
              <span class="chip">1</span> لوحة اليوم &nbsp; <span class="chip">2</span> جدول اليوم &nbsp; <span class="chip">3</span> الأسبوع &nbsp; <span class="chip">4</span> الشهر &nbsp; <span class="chip">5</span> التقويم &nbsp; <span class="chip">Esc</span> إغلاق النوافذ
            </div>
          </div>
        </div>
      </div>`;
  },
  after() {
    const f = $('#import-file');
    if (f) f.addEventListener('change', () => {
      const file = f.files[0];
      if (!file) return;
      const r = new FileReader();
      r.onload = () => {
        let data;
        try { data = JSON.parse(r.result); } catch (e) { App.toast('الملف غير صالح', { icon: '⛔' }); return; }
        if (!data || typeof data !== 'object' || !data.settings) { App.toast('هذا ليس ملف نسخة احتياطية من مُساعِد', { icon: '⛔' }); return; }
        App.confirm('سيتم استبدال بياناتك الحالية بالنسخة المستوردة. متابعة؟', () => {
          App.state = App.merge(App.defaults(), data);
          App.save(); App.applyTheme(); App.render(true);
          App.toast('استُوردت النسخة الاحتياطية بنجاح', { icon: '✅' });
        }, { ok: 'استيراد' });
      };
      r.readAsText(file);
    });
  },
};

function setPath(obj, path, v) {
  const ks = path.split('.');
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] = o[ks[i]] || {};
  o[ks[ks.length - 1]] = v;
}
App.on('set', el => {
  let v = el.dataset.bool ? el.checked : el.value;
  if (el.dataset.num) { v = Number(toLatinDigits(v)); if (isNaN(v)) return; const mn = Number(el.min), mx = Number(el.max); if (el.min !== '') v = Math.max(mn, v); if (el.max !== '') v = Math.min(mx, v); }
  if (['weekStart', 'dayStart', 'dayEnd', 'prayer.asr'].includes(el.dataset.k)) v = Number(v);
  setPath(App.state.settings, el.dataset.k, v);
  if (el.dataset.k === 'dayEnd' && v < S().dayStart) S().dayStart = v;
  if (el.dataset.k === 'dayStart' && v > S().dayEnd) S().dayEnd = v;
  if (el.dataset.k === 'notify' && v) App.acts['ask-notify']();
  Prayer._cache = {};
  App.save();
  App.applyTheme();
  App.refresh();
});
App.on('set-theme', el => { S().theme = el.dataset.v; App.save(); App.applyTheme(); App.refresh(); });
App.on('set-accent', el => { S().accent = el.dataset.v; App.save(); App.applyTheme(); App.refresh(); });
App.on('set-city', el => {
  const p = S().prayer;
  p.city = el.value;
  const c = Prayer.CITIES.find(x => x[0] === el.value);
  if (c) { p.lat = c[2]; p.lng = c[3]; p.method = c[4]; }
  Prayer._cache = {};
  App.save(); App.refresh();
  App.toast('تم تحديث مواقيت الصلاة' + (c ? ' لـ' + c[1] : ''), { icon: '🕌' });
});
App.on('set-coord', el => {
  const v = Number(toLatinDigits(el.value));
  if (isNaN(v)) return;
  S().prayer[el.dataset.k] = v;
  S().prayer.city = 'custom';
  Prayer._cache = {};
  App.save(); App.refresh();
});
App.on('geo-locate', () => {
  if (!navigator.geolocation) { App.toast('المتصفح لا يدعم تحديد الموقع', { icon: '⛔' }); return; }
  App.toast('جارٍ تحديد موقعك…', { icon: '📍' });
  navigator.geolocation.getCurrentPosition(pos => {
    const p = S().prayer;
    p.lat = Math.round(pos.coords.latitude * 10000) / 10000;
    p.lng = Math.round(pos.coords.longitude * 10000) / 10000;
    p.city = 'custom';
    Prayer._cache = {};
    App.save(); App.refresh();
    App.toast('حُدّد موقعك وحُدّثت المواقيت', { icon: '🕌' });
  }, () => App.toast('تعذّر تحديد الموقع — اختر مدينتك من القائمة أو أدخل الإحداثيات', { icon: '⚠️', ms: 6000 }), { timeout: 10000 });
});
App.on('ask-notify', () => {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission().then(() => App.refresh());
});
App.on('test-notify', () => App.notify({ icon: '🔔', title: 'تجربة التنبيهات', body: 'التنبيهات تعمل بشكل ممتاز ✓' }));
App.on('install-app', () => {
  if (!App._install) return;
  App._install.prompt();
  App._install.userChoice.finally(() => { App._install = null; App.refresh(); });
});

/* ---------- دليل الربط مع الهاتف ---------- */
App.on('phone-guide', () => {
  const online = location.protocol === 'https:';
  const step = (n, t, body) => `<div class="pstep"><div class="pn">${n}</div><div class="grow"><div class="bold">${t}</div><div class="small text-2">${body}</div></div></div>`;
  App.modal({
    title: 'الربط مع الهاتف', icon: '📱', size: 'wide',
    body: `
      <div class="lbl mb">🔔 أولًا: كل التنبيهات على الهاتف (تعمل حتى والتطبيق مغلق)</div>
      ${step(1, 'صدّر جدولك إلى ملف تقويم', 'اضغط «تصدير إلى تقويم الهاتف» بالأسفل، فينزل الملف <span class="keep-latn">musaid-calendar.ics</span> وفيه كل المهام المتكررة بتنبيهاتها.')}
      ${step(2, 'أرسل الملف إلى هاتفك', 'عبر واتساب أو تيليجرام (إلى نفسك) أو البريد، ثم افتحه من الهاتف.')}
      ${step(3, 'أضفه إلى التقويم', '<b>آيفون:</b> افتح الملف ثم «إضافة الكل»، فتصلك التنبيهات قبل كل موعد بـ' + (Number(S().notifyMinutes) || 10) + ' دقائق، وتنبيه الصيام في مساء اليوم السابق.<br><b>أندرويد:</b> افتحه بتطبيق «تقويم Google» ثم «حفظ». أو من الحاسوب: <span class="keep-latn">calendar.google.com</span> ← الإعدادات ← استيراد. وفعّل «الإشعار الافتراضي» لهذا التقويم من إعدادات تقويم Google، لأنه يتجاهل التنبيهات المكتوبة في الملف.')}
      ${step(4, 'عند تعديل الجدول', 'صدّر الملف من جديد وأضفه. نصيحة: أنشئ في تقويم الهاتف تقويمًا مستقلًا باسم «مُساعِد» واستورد إليه، ليسهل حذفه كله واستبداله.')}

      <div class="lbl mt mb">📲 ثانيًا: فتح التطبيق نفسه على الهاتف</div>
      ${step(1, 'ارفع مجلد التطبيق إلى رابط مجاني', 'افتح <span class="keep-latn">app.netlify.com/drop</span> من الحاسوب، وسجّل الدخول مجانًا، ثم اسحب مجلد «تطبيق المساعِد الشخصي» كاملًا إلى الصفحة، فتحصل على رابط مثل <span class="keep-latn">https://musaid.netlify.app</span>. (أو GitHub Pages إن كان لك حساب فيه).' + (online ? ' <b>✅ أنت الآن تفتح التطبيق من رابط آمن.</b>' : ''))}
      ${step(2, 'افتح الرابط من الهاتف وثبّته', '<b>أندرويد (Chrome):</b> القائمة ⋮ ← «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».<br><b>آيفون (Safari):</b> زر المشاركة ← «إضافة إلى الشاشة الرئيسية»، ثم افتحه من أيقونته.')}
      ${step(3, 'فعّل الإشعارات داخله', 'الإعدادات ← التنبيهات ← «السماح». يظهر جدولك تلقائيًا في أول فتح، ويعمل دون إنترنت.')}

      <div class="lbl mt mb">🔄 ثالثًا: نقل تعديلاتك بين الحاسوب والهاتف</div>
      ${step('↔', 'كل جهاز يحفظ بياناته عنده', 'لا يوجد خادم يزامن تلقائيًا. انقل التعديلات بـ«تصدير نسخة احتياطية» في جهاز، ثم «استيراد نسخة» في الآخر.')}

      <div class="insight mt" style="--c:var(--warn);cursor:default"><span class="ie">💡</span><div><div class="it">لماذا التقويم للتنبيهات؟</div><div class="is">تطبيقات الويب لا تستطيع إيقاظ الهاتف وهي مغلقة تمامًا، أما تقويم الهاتف فينبّهك دائمًا. لذلك اجمع بين الطريقتين: التقويم للتنبيهات، والتطبيق للمتابعة والإنجاز.</div></div></div>`,
    footer: `${App._install ? `<button class="btn btn-soft" data-act="install-app">📲 تثبيت التطبيق</button>` : ''}<span class="spacer"></span>
      <button class="btn" data-act="backup-export">${ic('download')} نسخة احتياطية</button>
      <button class="btn btn-primary" data-act="export-ics">${ic('download')} تصدير إلى تقويم الهاتف</button>`,
  });
});
App.on('cat-add', el => {
  const type = el.dataset.type;
  App.form({
    title: type === 'income' ? 'مصدر دخل جديد' : 'تصنيف مصاريف جديد', size: 'narrow',
    values: { icon: '📦' },
    fields: [{ name: 'name', label: 'الاسم', required: true }, { name: 'icon', label: 'الرمز', type: 'emoji', options: ['📦', '🍔', '☕', '🚗', '🏠', '💡', '🛒', '🛍️', '💊', '📚', '🎮', '🎁', '👶', '🐱', '✈️', '🕌', '💼', '💻', '📈', '🏦', '🧾', '🔧', '💇', '🏋️'] }],
    onSubmit(v) { App.update(() => { (type === 'income' ? S().incomeCats : S().expenseCats).push({ id: uid(), name: v.name, icon: v.icon }); }); },
  });
});
App.on('cat-del', el => {
  const key = el.dataset.type === 'income' ? 'incomeCats' : 'expenseCats';
  App.withUndo('حُذف التصنيف (تبقى العمليات السابقة محفوظة)', () => { S()[key] = S()[key].filter(c => c.id !== el.dataset.id); });
});
App.on('area-edit', el => {
  const a = el.dataset.id ? S().areas.find(x => x.id === el.dataset.id) : null;
  App.form({
    title: a ? 'تعديل المجال' : 'مجال جديد', size: 'narrow',
    values: a || { icon: '🌱', color: COLORS[1] },
    fields: [{ name: 'name', label: 'اسم المجال', required: true }, { name: 'icon', label: 'الرمز', type: 'emoji' }, { name: 'color', label: 'اللون', type: 'color' }],
    onSubmit(v) { App.update(() => { if (a) Object.assign(a, v); else S().areas.push(Object.assign({ id: uid() }, v)); }); },
  });
});
App.on('area-del', el => App.withUndo('حُذف المجال', () => { S().areas = S().areas.filter(a => a.id !== el.dataset.id); }));
App.on('backup-export', () => {
  App.download(`musaid-backup-${D.today()}.json`, JSON.stringify(App.state, null, 1));
  App.toast('صُدّرت النسخة الاحتياطية — احفظها في مكان آمن', { icon: '💾' });
});
App.on('backup-import', () => $('#import-file').click());
App.on('demo-load', () => App.confirm('سيتم استبدال بياناتك الحالية ببيانات تجريبية للاستكشاف (يمكنك التراجع مباشرة بعدها). متابعة؟', () => {
  const snap = JSON.stringify(App.state);
  App.loadDemo();
  App.toast('حُمّلت البيانات التجريبية', { icon: '✨', undo: () => { App.state = JSON.parse(snap); App.save(); App.applyTheme(); App.refresh(); } });
}, { ok: 'تحميل' }));
App.on('data-reset', () => App.confirm('سيتم حذف جميع بياناتك نهائيًا من هذا المتصفح (المهام، المصاريف، العادات…). هل صدّرت نسخة احتياطية؟', () => {
  const name = S().name;
  App.state = App.defaults();
  S().name = name; S().onboarded = true;
  App.save(); App.applyTheme(); App.render(true);
  App.toast('حُذفت كل البيانات — بداية جديدة موفقة', { icon: '🧹' });
}, { ok: 'احذف كل شيء', danger: true }));
