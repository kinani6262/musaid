'use strict';
/* =========================================================
   مكوّنات الواجهة: النوافذ، النماذج، الإشعارات، الرسوم البيانية
   ========================================================= */

/* ---------- النوافذ المنبثقة ---------- */
App.modal = function ({ title, icon = '', body = '', footer = '', size = '', onClose } = {}) {
  const back = document.createElement('div');
  back.className = 'modal-back';
  back.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal-h"><h3>${icon ? `<span>${icon}</span>` : ''}${esc(title)}</h3>
        <button class="icon-btn sm" data-close aria-label="إغلاق">${ic('x')}</button></div>
      <div class="modal-b">${body}</div>
      ${footer ? `<div class="modal-f">${footer}</div>` : ''}
    </div>`;
  $('#modal-root').appendChild(back);
  const m = {
    el: back,
    body: $('.modal-b', back),
    close() {
      if (!back.isConnected) return;
      back.remove();
      onClose && onClose();
    },
  };
  back._modal = m;
  back.addEventListener('mousedown', e => { if (e.target === back) back._downOnBack = true; });
  back.addEventListener('click', e => {
    if ((e.target === back && back._downOnBack) || e.target.closest('[data-close]')) m.close();
    back._downOnBack = false;
  });
  App.localize(back);
  return m;
};
App.closeTopModal = function () {
  const all = $$('#modal-root .modal-back');
  const top = all[all.length - 1];
  if (top && top._modal) { top._modal.close(); return true; }
  return false;
};
App.closeAllModals = function () { $$('#modal-root .modal-back').forEach(b => b._modal && b._modal.close()); };

/* ---------- باني النماذج ---------- */
function optList(options) {
  return (options || []).map(o => {
    if (typeof o === 'string' || typeof o === 'number') return { v: String(o), l: String(o) };
    if (Array.isArray(o)) return { v: String(o[0]), l: String(o[1]) };
    return { v: String(o.v), l: o.l };
  });
}

function fieldHtml(f, vals) {
  if (f.type === 'row') return `<div class="row">${f.fields.map(x => fieldHtml(x, vals)).join('')}</div>`;
  if (f.type === 'html') return f.html;
  const v = vals[f.name] !== undefined ? vals[f.name] : (f.value !== undefined ? f.value : '');
  const id = 'f_' + f.name + '_' + Math.random().toString(36).slice(2, 6);
  const lbl = f.label ? `<label for="${id}">${esc(f.label)}${f.required ? ' <span class="bad">*</span>' : ''}</label>` : '';
  const hint = f.hint ? `<div class="hint">${f.hint}</div>` : '';
  const common = `id="${id}" name="${f.name}" ${f.required ? 'required' : ''} ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}`;
  let input = '';
  switch (f.type) {
    case 'textarea':
      input = `<textarea ${common} rows="${f.rows || 3}">${esc(v)}</textarea>`; break;
    case 'select':
      input = `<select ${common}>${optList(f.options).map(o => `<option value="${esc(o.v)}" ${String(v) === o.v ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
    case 'color': {
      const cur = v || COLORS[0];
      input = `<input type="hidden" name="${f.name}" value="${esc(cur)}"><div class="swatches" data-group="${f.name}">${(f.options || COLORS).map(c => `<button type="button" class="sw ${c === cur ? 'on' : ''}" style="--c:${c}" data-val="${c}" aria-label="${c}"></button>`).join('')}</div>`;
      break;
    }
    case 'emoji': {
      const cur = v || (f.options || EMOJIS)[0];
      input = `<input type="hidden" name="${f.name}" value="${esc(cur)}"><div class="emojis" data-group="${f.name}">${(f.options || EMOJIS).map(e => `<button type="button" class="em ${e === cur ? 'on' : ''}" data-val="${e}">${e}</button>`).join('')}</div>`;
      break;
    }
    case 'seg': {
      const opts = optList(f.options);
      const cur = String(v !== '' ? v : opts[0].v);
      input = `<input type="hidden" name="${f.name}" value="${esc(cur)}"><div class="daypick" data-group="${f.name}" data-single="1">${opts.map(o => `<button type="button" class="dp ${o.v === cur ? 'on' : ''}" data-val="${esc(o.v)}">${o.l}</button>`).join('')}</div>`;
      break;
    }
    case 'days': {
      const cur = (Array.isArray(v) ? v : []).map(String);
      const order = Array.from({ length: 7 }, (_, i) => (S().weekStart + i) % 7);
      input = `<input type="hidden" name="${f.name}" value="${cur.join(',')}" data-kind="days"><div class="daypick" data-group="${f.name}">${order.map(d => `<button type="button" class="dp ${cur.includes(String(d)) ? 'on' : ''}" data-val="${d}">${DAYS[d]}</button>`).join('')}</div>`;
      break;
    }
    case 'switch':
      return `<div class="toggle-row field"><div><div class="bold small">${esc(f.label)}</div>${hint}</div><label class="switch"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''}><i></i></label></div>`;
    default: {
      const t = f.type || 'text';
      const extra = (f.min !== undefined ? ` min="${f.min}"` : '') + (f.max !== undefined ? ` max="${f.max}"` : '') + (f.step !== undefined ? ` step="${f.step}"` : (t === 'number' ? ' step="any"' : ''));
      input = `<input type="${t}" ${common} value="${esc(v)}"${extra} ${t === 'number' ? 'inputmode="decimal"' : ''} autocomplete="off">`;
    }
  }
  return `<div class="field" ${f.full ? 'style="grid-column:1/-1"' : ''}>${lbl}${input}${hint}</div>`;
}

function readForm(form, fields) {
  const out = {};
  const flat = [];
  (function walk(fs) { fs.forEach(f => (f.type === 'row' ? walk(f.fields) : flat.push(f))); })(fields);
  flat.forEach(f => {
    if (!f.name) return;
    const el = form.elements[f.name];
    if (!el) return;
    if (f.type === 'switch') out[f.name] = el.checked;
    else if (f.type === 'number') out[f.name] = el.value === '' ? null : Number(toLatinDigits(el.value));
    else if (f.type === 'days') out[f.name] = el.value ? el.value.split(',').filter(Boolean).map(Number) : [];
    else out[f.name] = typeof el.value === 'string' ? el.value.trim() : el.value;
  });
  return out;
}

/**
 * App.form({ title, icon, fields, values, submit, onSubmit(vals) , onDelete, size })
 * onSubmit يعيد false لإبقاء النافذة مفتوحة
 */
App.form = function (cfg) {
  const vals = cfg.values || {};
  const body = `${cfg.intro || ''}<form class="frm" novalidate>${cfg.fields.map(f => fieldHtml(f, vals)).join('')}</form>`;
  const footer = `${cfg.onDelete ? `<button type="button" class="btn btn-danger btn-sm" data-fdel>${ic('trash')} حذف</button>` : ''}
    ${cfg.extraBtn || ''}<span class="spacer"></span>
    <button type="button" class="btn btn-ghost" data-close>إلغاء</button>
    <button type="button" class="btn btn-primary" data-fsub>${ic('check')} ${esc(cfg.submit || 'حفظ')}</button>`;
  const m = App.modal({ title: cfg.title, icon: cfg.icon, body, footer, size: cfg.size || '' });
  const form = $('form', m.el);

  m.el.addEventListener('click', e => {
    const opt = e.target.closest('[data-group] [data-val]');
    if (opt) {
      const grp = opt.closest('[data-group]');
      const hidden = form.elements[grp.dataset.group];
      if (hidden && hidden.dataset.kind === 'days') {
        opt.classList.toggle('on');
        hidden.value = $$('.on', grp).map(x => x.dataset.val).join(',');
      } else {
        $$('[data-val]', grp).forEach(x => x.classList.remove('on'));
        opt.classList.add('on');
        if (hidden) hidden.value = opt.dataset.val;
      }
      hidden && hidden.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    if (e.target.closest('[data-fdel]')) {
      App.confirm(cfg.deleteText || 'هل تريد الحذف؟ يمكنك التراجع بعد الحذف مباشرة.', () => { m.close(); cfg.onDelete(); }, { danger: true, ok: 'حذف' });
    }
    if (e.target.closest('[data-fsub]')) submit();
  });

  function submit() {
    const out = readForm(form, cfg.fields);
    const missing = [];
    (function walk(fs) { fs.forEach(f => { if (f.type === 'row') walk(f.fields); else if (f.required && (out[f.name] === '' || out[f.name] === null || out[f.name] === undefined)) missing.push(f); }); })(cfg.fields);
    if (missing.length) {
      const el = form.elements[missing[0].name];
      if (el && el.focus) { el.focus(); el.style.borderColor = 'var(--bad)'; }
      App.toast('يرجى تعبئة: ' + missing.map(f => f.label).join('، '), { icon: '✋' });
      return;
    }
    if (cfg.onSubmit(out, m) !== false) m.close();
  }
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  form.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !e.isComposing) { e.preventDefault(); submit(); }
  });
  if (cfg.onMount) cfg.onMount(m, form);
  setTimeout(() => { const first = form.querySelector('input:not([type=hidden]), textarea, select'); first && cfg.autofocus !== false && first.focus(); }, 60);
  return m;
};

App.confirm = function (msg, onYes, { title = 'تأكيد', ok = 'نعم', danger = false } = {}) {
  const m = App.modal({
    title, size: 'narrow',
    body: `<p class="text-2">${esc(msg)}</p>`,
    footer: `<span class="spacer"></span><button class="btn btn-ghost" data-close>إلغاء</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes>${esc(ok)}</button>`,
  });
  $('[data-yes]', m.el).addEventListener('click', () => { m.close(); onYes(); });
  setTimeout(() => $('[data-yes]', m.el).focus(), 50);
};

App.prompt = function ({ title, label, value = '', placeholder = '', type = 'text', onOk, multiline = false }) {
  App.form({
    title, size: 'narrow',
    fields: [{ name: 'v', label, type: multiline ? 'textarea' : type, placeholder, value }],
    onSubmit: ({ v }) => onOk(v),
  });
};

/* ---------- القوائم المنبثقة ---------- */
App.popover = function (html) {
  App.closePopover();
  const root = $('#popover-root');
  root.innerHTML = `<div class="pop">${html}</div>`;
  App.localize(root);
  setTimeout(() => document.addEventListener('click', App._popOutside), 0);
  return root.firstChild;
};
App._popOutside = function (e) {
  if (!e.target.closest('.pop') && !e.target.closest('[data-act="open-inbox"]')) App.closePopover();
};
App.closePopover = function () {
  const root = $('#popover-root');
  if (root) root.innerHTML = '';
  document.removeEventListener('click', App._popOutside);
};

/* ---------- الإشعارات العائمة ---------- */
App.toast = function (msg, { icon = '✅', undo = null, ms = 3800 } = {}) {
  const root = $('#toast-root');
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `<span class="te">${icon}</span><span>${esc(msg)}</span>${undo ? '<button class="btn btn-sm btn-soft">تراجع</button>' : ''}`;
  root.appendChild(t);
  App.localize(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 260); };
  if (undo) $('button', t).addEventListener('click', () => { undo(); kill(); });
  setTimeout(kill, undo ? 6500 : ms);
  while (root.children.length > 3) root.firstChild.remove();
};

/* ---------- صوت تنبيه لطيف ---------- */
let _audio = null;
App.chime = function (kind = 'soft') {
  if (!S().sound) return;
  try {
    _audio = _audio || new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'done' ? [659, 880, 1047] : [784, 1047];
    notes.forEach((f, i) => {
      const o = _audio.createOscillator(), g = _audio.createGain();
      o.type = 'sine'; o.frequency.value = f;
      const t0 = _audio.currentTime + i * 0.14;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(_audio.destination);
      o.start(t0); o.stop(t0 + 0.55);
    });
  } catch (e) { /* لا شيء */ }
};

/* ---------- مركز التنبيهات ---------- */
App.notify = function ({ title, body = '', icon = '🔔', view = null, params = null, silent = false, system = true }) {
  const s = App.state;
  s.inbox.unshift({ id: uid(), title, body, icon, view, params, time: Date.now(), read: false });
  s.inbox = s.inbox.slice(0, 60);
  App.save();
  if (!silent) {
    App.toast(title + (body ? ' — ' + body : ''), { icon, ms: 6000 });
    App.chime();
  }
  if (system && S().notify) App.sysNotify(title, body, view, params);
  App.renderChrome && App.renderChrome();
};

/** إشعار النظام: عبر عامل الخدمة إن وُجد (وهو الطريق الوحيد في أندرويد)، وإلا مباشرة */
App.sysNotify = function (title, body = '', view = null, params = null) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag: title + body, lang: 'ar', dir: 'rtl', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { view, params } };
  const direct = () => {
    try {
      const n = new Notification(title, opts);
      n.onclick = () => { window.focus(); if (view) App.go(view, params || {}); n.close(); };
    } catch (e) { /* بعض البيئات لا تدعم */ }
  };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then(r => r.showNotification(title, opts)).catch(direct);
  else direct();
};

/* ---------- قصاصات الاحتفال ---------- */
App.confetti = function () {
  const cv = $('#confetti');
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const cols = ['#7c5cff', '#22d3ee', '#f59e0b', '#22c55e', '#f43f5e', '#ec4899', '#facc15'];
  const ps = Array.from({ length: 160 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35,
    vx: (Math.random() - .5) * 14, vy: -Math.random() * 13 - 4,
    s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - .5) * .3,
    c: cols[(Math.random() * cols.length) | 0], shape: Math.random() > .5,
  }));
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ps.forEach(p => {
      p.vy += .32; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, 1 - el / 2600);
      ctx.fillStyle = p.c;
      if (p.shape) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else { ctx.beginPath(); ctx.arc(0, 0, p.s / 3, 0, 7); ctx.fill(); }
      ctx.restore();
    });
    if (el < 2700) requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, innerWidth, innerHeight);
  })(t0);
};

/* ---------- عناصر صغيرة ---------- */
App.ring = function (p, { size = 64, stroke = 7, color = 'var(--ac)', label = '', sub = '', track = 'var(--surface-3)' } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - clamp(p, 0, 100) / 100);
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>
    <div class="rt">${label !== '' ? `<b style="font-size:${Math.max(12, size / 4.6)}px">${label}</b>` : ''}${sub ? `<span class="tiny muted">${sub}</span>` : ''}</div></div>`;
};
App.bar = (p, color = '', cls = '') => `<div class="bar ${cls}"><i style="width:${clamp(p, 0, 100)}%;${color ? `--c:${color}` : ''}"></i></div>`;
App.chk = (on, act, data = '', color = '', extra = '') =>
  `<button class="chk ${on ? 'on' : ''} ${extra}" data-act="${act}" ${data} ${color ? `style="--c:${color}"` : ''} aria-pressed="${on}" aria-label="${on ? 'منجز' : 'غير منجز'}">${CHECK_SVG}</button>`;
App.empty = (emoji, title, sub = '', btn = '') => `<div class="empty"><div class="ee">${emoji}</div><div class="et">${esc(title)}</div>${sub ? `<div class="es">${sub}</div>` : ''}${btn}</div>`;
App.tabs = (items, cur, act) => `<div class="tabs" role="tablist">${items.map(t => `<button class="tab ${t.id === cur ? 'on' : ''}" data-act="${act}" data-id="${t.id}" role="tab">${t.icon ? ic(t.icon) : ''}${t.label}</button>`).join('')}</div>`;

/* ---------- الرسوم البيانية (SVG تُرسم بعد قياس العرض الفعلي) ---------- */
let _cid = 0;
App.chart = function (cfg) {
  const id = 'c' + (++_cid);
  App._charts[id] = cfg;
  return `<div class="chart-box" data-cid="${id}" style="min-height:${cfg.height || 200}px"></div>`;
};
App.mountCharts = function () {
  $$('.chart-box[data-cid]').forEach(box => {
    const cfg = App._charts[box.dataset.cid];
    if (!cfg) return;
    const w = Math.max(220, box.clientWidth || 300);
    box.innerHTML = cfg.kind === 'line' ? lineChart(cfg, w) : barChart(cfg, w);
  });
};
let _rz;
window.addEventListener('resize', () => { clearTimeout(_rz); _rz = setTimeout(() => { App.mountCharts(); App.localize($('#view')); }, 150); });

function niceTop(max, ticks = 4) {
  if (!(max > 0)) return ticks;
  const raw = max / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return step * ticks;
}
function roundTop(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * أعمدة رأسية (مجموعة أو مفردة). الزمن يجري من اليمين إلى اليسار.
 * cfg: { data:[{label, values:[..], tip}], series:[{name,color}], height, fmt, goal, goalLabel }
 */
function barChart(cfg, W) {
  const H = cfg.height || 200;
  const padT = 14, padB = 26, padY = 46, padE = 6;
  const data = cfg.data || [];
  const series = cfg.series || [{ name: '', color: 'var(--s1)' }];
  const fmt = cfg.fmt || (v => compactNum(v));
  const maxV = Math.max(cfg.goal || 0, ...data.flatMap(d => d.values.map(Number)), 0);
  const top = niceTop(maxV * 1.05);
  const plotW = W - padY - padE, plotH = H - padT - padB;
  const y = v => padT + plotH - (v / top) * plotH;
  const n = Math.max(1, data.length), slot = plotW / n, k = series.length;
  const bw = Math.max(3, Math.min(24, (slot * 0.66 - (k - 1) * 2) / k));
  const gw = bw * k + (k - 1) * 2;
  let s = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="direction:ltr" role="img" aria-label="${esc(cfg.title || 'رسم بياني')}">`;
  for (let i = 0; i <= 4; i++) {
    const v = (top / 4) * i, yy = y(v);
    s += `<line class="${i === 0 ? 'base' : 'gl'}" x1="${padE}" x2="${W - padY + 4}" y1="${yy}" y2="${yy}"/>`;
    s += `<text x="${W - padY + 10}" y="${yy + 4}" text-anchor="start">${fmt(v)}</text>`;
  }
  const every = Math.ceil(n / Math.max(1, Math.floor(plotW / 44)));
  data.forEach((d, i) => {
    const cx = W - padY - slot * (i + 0.5);
    series.forEach((se, j) => {
      const v = Number(d.values[j]) || 0;
      const x = cx + gw / 2 - (j + 1) * bw - j * 2;
      const yy = y(v);
      s += `<path class="mk" d="${roundTop(x, yy, bw, padT + plotH - yy)}" fill="${se.color}"/>`;
    });
    if (i % every === 0 || n <= 12) s += `<text x="${cx}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
    const tip = d.tip || `<b>${esc(d.label)}</b><br>${series.map((se, j) => `${se.name ? esc(se.name) + ': ' : ''}${fmt(d.values[j] || 0)}`).join('<br>')}`;
    s += `<rect class="hit" x="${cx - slot / 2}" y="${padT}" width="${slot}" height="${plotH}" data-tip="${esc(tip)}"/>`;
  });
  if (cfg.goal) {
    const gy = y(cfg.goal);
    s += `<line class="goal-line" x1="${padE}" x2="${W - padY}" y1="${gy}" y2="${gy}"/>`;
    s += `<text x="${padE + 2}" y="${gy - 5}" text-anchor="start">${esc(cfg.goalLabel || 'الهدف')}</text>`;
  }
  return s + '</svg>';
}

/** خط زمني بسيط مع مساحة خفيفة ونقطة النهاية */
function lineChart(cfg, W) {
  const H = cfg.height || 180;
  const padT = 14, padB = 26, padY = 46, padE = 10;
  const data = cfg.data || [];
  const fmt = cfg.fmt || (v => compactNum(v));
  const vals = data.map(d => d.value).filter(v => v !== null && v !== undefined && !isNaN(v));
  if (!vals.length) return `<div class="empty small">لا توجد بيانات كافية بعد</div>`;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (cfg.zero) lo = 0;
  if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo; lo -= span * 0.1; hi += span * 0.1;
  const plotW = W - padY - padE, plotH = H - padT - padB;
  const n = data.length;
  const x = i => W - padY - (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = v => padT + plotH - ((v - lo) / (hi - lo)) * plotH;
  const color = cfg.color || 'var(--s1)';
  let s = `<svg class="chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="direction:ltr">`;
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) / 3) * i, yy = y(v);
    s += `<line class="${i === 0 ? 'base' : 'gl'}" x1="${padE}" x2="${W - padY + 4}" y1="${yy}" y2="${yy}"/><text x="${W - padY + 10}" y="${yy + 4}">${fmt(v)}</text>`;
  }
  const pts = data.map((d, i) => (d.value === null || d.value === undefined ? null : [x(i), y(d.value)]));
  const valid = pts.filter(Boolean);
  if (valid.length) {
    const path = valid.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
    s += `<path d="${path}L${valid[valid.length - 1][0]},${padT + plotH}L${valid[0][0]},${padT + plotH}Z" fill="${color}" opacity=".1"/>`;
    s += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    const last = valid[valid.length - 1];
    s += `<circle cx="${last[0]}" cy="${last[1]}" r="5" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`;
  }
  const every = Math.ceil(n / Math.max(1, Math.floor(plotW / 50)));
  data.forEach((d, i) => {
    if (i % every === 0) s += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
    const w = n > 1 ? plotW / (n - 1) : plotW;
    s += `<rect class="hit" x="${x(i) - w / 2}" y="${padT}" width="${w}" height="${plotH}" data-tip="${esc(`<b>${esc(d.label)}</b><br>${d.value === null || d.value === undefined ? '—' : fmt(d.value)}`)}"/>`;
  });
  return s + '</svg>';
}

/** مخطط دائري مجوّف مع وسيلة إيضاح، يطوي ما زاد عن 7 فئات في «أخرى» */
App.donut = function (items, { size = 170, thick = 22, center = '', centerSub = '', fmt = v => money(v) } = {}) {
  let data = items.filter(d => d.value > 0).sort((a, b) => b.value - a.value);
  if (data.length > 8) {
    const rest = data.slice(7);
    data = data.slice(0, 7).concat([{ label: 'أخرى', value: sum(rest, d => d.value), color: 'var(--s-other)' }]);
  }
  data.forEach((d, i) => { if (!d.color) d.color = `var(--s${i + 1})`; });
  const total = sum(data, d => d.value);
  if (!total) return App.empty('🍩', 'لا توجد بيانات لهذا الشهر');
  const r = (size - thick) / 2, C = 2 * Math.PI * r, cx = size / 2;
  const gap = data.length > 1 ? 2 : 0;
  let acc = 0, arcs = '';
  data.forEach(d => {
    const len = (d.value / total) * C;
    const tip = `<b>${esc(d.label)}</b><br>${fmt(d.value)} · ${pct(d.value, total)}%`;
    arcs += `<circle cx="${cx}" cy="${cx}" r="${r}" fill="none" stroke="${d.color}" stroke-width="${thick}" stroke-dasharray="${Math.max(0.5, len - gap)} ${C}" stroke-dashoffset="${-acc}" data-tip="${esc(tip)}" style="cursor:pointer"/>`;
    acc += len;
  });
  return `<div class="donut-wrap">
    <div class="ring-wrap" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">${arcs}</svg>
      <div class="rt"><b style="font-size:1.05rem">${center}</b><span class="tiny muted">${centerSub}</span></div>
    </div>
    <div class="donut-legend">${data.map(d => `<div class="dl"><i style="--c:${d.color}"></i><span class="ellipsis">${esc(d.label)}</span><span class="dv">${fmt(d.value)} <span class="muted tiny">(${pct(d.value, total)}%)</span></span></div>`).join('')}</div>
  </div>`;
};
App.legend = (series) => `<div class="legend">${series.map(s => `<span><i style="--c:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
