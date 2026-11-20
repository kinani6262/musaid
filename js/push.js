'use strict';
/* =========================================================
   التنبيهات والتطبيق مغلق (Web Push)
   ---------------------------------------------------------
   الهاتف يوقف صفحات الويب حين تُغلق، فلا يستطيع التطبيق أن
   ينبّه بنفسه. لذلك يحسب التطبيق مواعيد التنبيهات للأيام
   السبعة القادمة ويرسلها إلى خادم صغير (push-server/)، والخادم
   يرسل كل تنبيه في وقته إلى أجهزتك المفعّلة.

   - «مفتاح التنبيهات» (pushKey) في الإعدادات، فيتزامن بين أجهزتك:
     أي جهاز يعدّل جدولك يحدّث تنبيهات الهاتف أيضًا.
   - معرّف كل تذكير هو نفسه وسم الإشعار المحلي، فإن كان التطبيق
     مفتوحًا ووصل الإشعاران حلّ أحدهما محل الآخر ولم يتكرر.
   ========================================================= */

const Push = {
  _on: false,          // هل هذا الجهاز مشترك؟
  _timer: null,
  LAST: 'musaid-push-last',

  cfg() {
    return typeof PUSH_CONFIG !== 'undefined' && PUSH_CONFIG.url && PUSH_CONFIG.vapidPublicKey ? PUSH_CONFIG : null;
  },
  supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && /^https?:$/.test(location.protocol);
  },
  /** آيفون في سفاري لا في التطبيق المضاف إلى الشاشة الرئيسية */
  iosNeedsInstall() {
    const ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
    return ios && !standalone;
  },
  key() {
    if (!S().pushKey) {
      const b = crypto.getRandomValues(new Uint8Array(24));
      S().pushKey = btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      App.save();
    }
    return S().pushKey;
  },
  async subscription() {
    if (!this.supported()) return null;
    try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); }
    catch (e) { return null; }
  },
  async refreshState() {
    const was = this._on;
    this._on = !!(await this.subscription());
    if (was !== this._on && App.view === 'settings') App.refresh();
    return this._on;
  },

  /** يُستدعى من ضغطة المستخدم (شرط في آيفون) */
  async enable() {
    const cfg = this.cfg();
    if (!cfg) { App.toast('خادم التنبيهات لم يُجهَّز بعد', { icon: '⚠️' }); return; }
    if (this.iosNeedsInstall()) { App.toast('في الآيفون: أضف التطبيق إلى الشاشة الرئيسية من زر المشاركة، ثم افتحه من هناك وفعّل التنبيهات', { icon: '📱', ms: 9000 }); return; }
    if (!this.supported()) { App.toast('هذا المتصفح لا يدعم التنبيهات والتطبيق مغلق', { icon: '⛔' }); return; }
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { App.toast('لم يُسمح بالإشعارات — فعّلها من إعدادات الهاتف لهذا التطبيق', { icon: '⛔', ms: 7000 }); App.refresh(); return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToBytes(cfg.vapidPublicKey) });
      S().notify = true;
      S().pushOn = true;
      this.key();
      App.save();
      this._on = true;
      const ok = await this.sync(true);
      App.toast(ok ? 'تم تفعيل التنبيهات على هذا الجهاز ✓' : 'فُعّلت، لكن تعذّر الوصول إلى خادم التنبيهات — سيُعاد المحاولة تلقائيًا', { icon: ok ? '🔔' : '⚠️', ms: 6000 });
    } catch (e) {
      App.toast('تعذّر تفعيل التنبيهات: ' + (e && e.message || e), { icon: '⚠️', ms: 7000 });
    }
    App.refresh();
  },
  async disable() {
    const sub = await this.subscription();
    if (sub) {
      const cfg = this.cfg();
      if (cfg) fetch(cfg.url + '/unsubscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
      try { await sub.unsubscribe(); } catch (e) { /* */ }
    }
    this._on = false;
    App.toast('أُوقفت التنبيهات على هذا الجهاز', { icon: '🔕' });
    App.refresh();
  },
  async test() {
    const cfg = this.cfg(), sub = await this.subscription();
    if (!cfg || !sub) return;
    try {
      const r = await fetch(cfg.url + '/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sub: sub.toJSON() }) });
      const j = await r.json();
      App.toast(j.ok ? 'أُرسل تنبيه تجريبي من الخادم — أغلق التطبيق إن أردت وانتظر ثوانيَ' : 'رفضت خدمة الإشعارات التنبيه (' + j.status + ')', { icon: j.ok ? '📨' : '⚠️', ms: 7000 });
    } catch (e) { App.toast('تعذّر الوصول إلى خادم التنبيهات', { icon: '⚠️' }); }
  },

  /** مواعيد التنبيهات للأيام القادمة، بنفس قواعد App.checkReminders */
  plan(days = 7) {
    const s = App.state, st = S(), today = D.today(), nowMs = Date.now();
    const before = Number(st.notifyMinutes) || 10;
    const at = (k, min) => { const d = D.parse(k); d.setHours(0, min, 0, 0); return d.getTime(); };
    const out = [];
    const add = (id, ms, title, body, view) => { if (ms > nowMs - 60e3 && ms < nowMs + (days + 1) * 864e5) out.push({ id, at: ms, title, body, view }); };
    const MORNING = 8 * 60, EVENING = 20 * 60;

    for (let i = 0; i <= days; i++) {
      const k = D.add(today, i), next = D.add(k, 1);
      // قبل الموعد بيوم: مساء اليوم السابق
      T.on(next).forEach(t => {
        if (t.remind === false || T.isDone(t, next)) return;
        if (['daily', 'weekdays', 'weekly'].includes(t.repeat)) {
          if (t.time || t.repeat === 'daily') return;
          add('d1:' + t.id + ':' + next, at(k, EVENING), 'غدًا', t.title, 'week');
          return;
        }
        add('d1:' + t.id + ':' + next, at(k, EVENING), 'تذكير: موعد غدًا', t.title + (t.time ? ' — ' + D.time(t.time) : ''), 'calendar');
      });
      // قبل وقت المهمة بدقائق
      T.on(k).forEach(t => {
        if (!t.time || t.remind === false || T.isDone(t, k)) return;
        const tm = D.toMin(t.time);
        add('t:' + t.id + ':' + k, at(k, tm - before), before ? 'بعد ' + minAr(before) : 'حان الوقت', t.title, 'day');
      });
      // العادات
      s.habits.filter(h => !h.archived && h.remindAt && Habits.isDue(h, k) && !Habits.isDoneOn(h, k)).forEach(h => {
        add('hb:' + h.id + ':' + k, at(k, D.toMin(h.remindAt)), 'وقت عادتك', h.name, 'habits');
      });
      // الأذان
      if (st.prayer.show && st.prayer.remind) {
        Prayer.list(k).filter(p => p.id !== 'sunrise' && !isNaN(p.min)).forEach(p => {
          add('pr:' + p.id + ':' + k, at(k, p.min - 10), `اقترب أذان ${p.name}`, `الساعة ${D.time(p.time)}`, 'dashboard');
        });
      }
    }
    // الاشتراكات والتجارب المجانية
    s.subscriptions.filter(x => x.active !== false && x.next).forEach(x => {
      const rd = x.remindDays ?? 1;
      const k = D.add(x.next, -rd);
      add('s:' + x.id + ':' + x.next, at(D.diff(today, k) < 0 ? today : k, MORNING), 'تجديد اشتراك قريب', `${x.name} يتجدد ${D.fmt(x.next, false)} بمبلغ ${money(x.amount)}`, 'subs');
      if (x.trialEnd) add('tr:' + x.id + ':' + x.trialEnd, at(D.add(x.trialEnd, -1), MORNING), 'نهاية تجربة مجانية', `تجربة ${x.name} تنتهي غدًا`, 'subs');
    });
    // الامتحانات والواجبات والديون
    s.exams.forEach(x => {
      add('ex1:' + x.id, at(D.add(x.date, -1), MORNING), 'امتحان غدًا', x.title + (x.time ? ' — ' + D.time(x.time) : ''), 'study');
      add('ex7:' + x.id, at(D.add(x.date, -7), MORNING), 'امتحان بعد أسبوع', x.title, 'study');
    });
    s.assignments.filter(a => !a.done && a.due).forEach(a => add('as:' + a.id, at(D.add(a.due, -1), MORNING), 'واجب يُسلَّم غدًا', a.title, 'study'));
    s.debts.filter(x => !x.paid && x.due).forEach(x => add('db:' + x.id + ':' + x.due, at(D.add(x.due, -1), MORNING), 'موعد دين غدًا', `${x.person} — ${money(x.amount)}`, 'finance'));

    // ما أُطلق محليًّا لا يُرسَل ثانية
    return out.filter(r => !s.notified[r.id]).sort((a, b) => a.at - b.at).slice(0, 400);
  },

  /** تحديث قائمة التنبيهات لدى الخادم (بعد كل حفظ بثوانٍ) */
  schedule() {
    if (!this.cfg() || !S().pushOn) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.sync(), 4000);
  },
  async sync(force = false) {
    const cfg = this.cfg();
    if (!cfg || !S().pushOn || !navigator.onLine) return false;
    const sub = await this.subscription();
    this._on = !!sub;
    const reminders = S().notify ? this.plan() : [];
    const body = { key: this.key(), sub: sub ? sub.toJSON() : null, reminders };
    const sig = hashStr(JSON.stringify(body));
    let last = {};
    try { last = JSON.parse(localStorage.getItem(this.LAST) || '{}'); } catch (e) { /* */ }
    // دون تغيير: يكفي تحديث كل 6 ساعات ليبقى في الخادم أسبوع كامل
    if (!force && last.sig === sig && Date.now() - last.t < 6 * 3600e3) return true;
    try {
      const r = await fetch(cfg.url + '/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) return false;
      try { localStorage.setItem(this.LAST, JSON.stringify({ sig, t: Date.now() })); } catch (e) { /* */ }
      return true;
    } catch (e) { return false; }
  },
};

function b64uToBytes(s) {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b + '='.repeat((4 - b.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h * 33 + s.charCodeAt(i)) | 0;
  return String(h >>> 0) + ':' + s.length;
}

// كل حفظ يجدول تحديث التنبيهات لدى الخادم
const _pushSave = App.save;
App.save = function () { _pushSave.apply(this, arguments); Push.schedule(); };

App.on('push-enable', () => Push.enable());
App.on('push-disable', () => Push.disable());
App.on('push-test', () => Push.test());
