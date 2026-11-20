/* =========================================================
   خادم تنبيهات «مُساعِد» — Cloudflare Worker مجاني
   ---------------------------------------------------------
   التطبيق يرسل إليه مواعيد التنبيهات للأيام القادمة، والخادم
   يفحصها كل دقيقة ويرسل كل تنبيه في وقته عبر Web Push،
   فيصل إلى الهاتف والتطبيق مغلق.

   المتطلبات (انظر اقرأني.md في هذا المجلد):
   - قاعدة D1 باسم الربط DB (الجداول في schema.sql)
   - السر VAPID_PRIVATE_JWK  (مفتاح خاص بصيغة JWK)
   - المتغيّر VAPID_PUBLIC     (المفتاح العام نفسه الذي في js/push-config.js)
   - المتغيّر VAPID_SUBJECT    (رابط التطبيق)
   - المتغيّر ALLOWED_ORIGINS  (أصول التطبيق مفصولة بفواصل)
   - مشغّل مجدول كل دقيقة: * * * * *
   ========================================================= */

// خدمات الدفع المعروفة فقط، حتى لا يُستعمل الخادم لإرسال طلبات إلى أي مكان
const PUSH_HOSTS = [/\.googleapis\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/, /\.push\.services\.mozilla\.com$/];
const MAX_REMINDERS = 400;
const MAX_SUBS_PER_KEY = 10;

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'musaid-push' }, 200, cors);
      if (req.method === 'POST' && url.pathname === '/sync') return json(await handleSync(await readJson(req), env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/unsubscribe') return json(await handleUnsub(await readJson(req), env), 200, cors);
      if (req.method === 'POST' && url.pathname === '/test') return json(await handleTest(await readJson(req), env), 200, cors);
      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, e && e.status || 500, cors);
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendDue(env));
  },
};

/* ---------- الطلبات ---------- */

async function handleSync(b, env) {
  const key = checkKey(b.key);
  const now = Date.now();
  const stmts = [];
  if (b.sub) {
    const s = checkSub(b.sub);
    stmts.push(env.DB.prepare(
      `INSERT INTO subs (endpoint, key, p256dh, auth, updated) VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(endpoint) DO UPDATE SET key = ?2, p256dh = ?3, auth = ?4, updated = ?5`
    ).bind(s.endpoint, key, s.p256dh, s.auth, now));
  }
  if (Array.isArray(b.reminders)) {
    const list = b.reminders.slice(0, MAX_REMINDERS).map(checkReminder).filter(r => r.at > now - 60e3);
    // قائمة الجهاز كاملة تحلّ محلّ القائمة السابقة؛ والمُرسَل لا يُعاد
    stmts.push(env.DB.prepare('DELETE FROM reminders WHERE key = ?1 AND sent = 0').bind(key));
    for (const r of list) {
      stmts.push(env.DB.prepare(
        `INSERT INTO reminders (key, id, at, title, body, view, sent) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)
         ON CONFLICT(key, id) DO NOTHING`
      ).bind(key, r.id, r.at, r.title, r.body, r.view));
    }
  }
  // تنظيف: ما أُرسل قبل يومين، والاشتراكات المهجورة منذ 45 يومًا
  stmts.push(env.DB.prepare('DELETE FROM reminders WHERE key = ?1 AND at < ?2').bind(key, now - 2 * 864e5));
  if (stmts.length) await env.DB.batch(stmts);
  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM subs WHERE key = ?1').bind(key).first();
  if (n && n.n > MAX_SUBS_PER_KEY) {
    await env.DB.prepare(`DELETE FROM subs WHERE endpoint IN (SELECT endpoint FROM subs WHERE key = ?1 ORDER BY updated DESC LIMIT -1 OFFSET ?2)`).bind(key, MAX_SUBS_PER_KEY).run();
  }
  return { ok: true, devices: Math.min(n ? n.n : 0, MAX_SUBS_PER_KEY) };
}

async function handleUnsub(b, env) {
  if (!b || typeof b.endpoint !== 'string') throw httpError(400, 'endpoint');
  await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?1').bind(b.endpoint).run();
  return { ok: true };
}

/** تنبيه تجريبي فوري لهذا الجهاز وحده */
async function handleTest(b, env) {
  const s = checkSub(b.sub);
  const res = await sendPush(env, s, { title: 'تجربة التنبيهات', body: 'وصل التنبيه من الخادم ✓ ستصلك التذكيرات والتطبيق مغلق', tag: 'test' });
  if (res.status === 404 || res.status === 410) await env.DB.prepare('DELETE FROM subs WHERE endpoint = ?1').bind(s.endpoint).run();
  return { ok: res.ok, status: res.status };
}

/* ---------- الإرسال المجدول ---------- */

async function sendDue(env) {
  const now = Date.now();
  // ما حان وقته في آخر 20 دقيقة (تحسّبًا لتأخر المشغّل)، وما هو أقدم يُهمل
  const { results } = await env.DB.prepare(
    `SELECT r.key, r.id, r.title, r.body, r.view, s.endpoint, s.p256dh, s.auth
     FROM reminders r JOIN subs s ON s.key = r.key
     WHERE r.sent = 0 AND r.at <= ?1 AND r.at > ?2
     ORDER BY r.at LIMIT 300`
  ).bind(now, now - 20 * 60e3).all();
  const dead = new Set();
  await Promise.all(results.map(async r => {
    try {
      const res = await sendPush(env, r, { title: r.title, body: r.body, tag: r.id, view: r.view });
      if (res.status === 404 || res.status === 410) dead.add(r.endpoint);
    } catch (e) { /* يُتجاوز هذا الجهاز ويستمر الباقي */ }
  }));
  const stmts = [env.DB.prepare('UPDATE reminders SET sent = 1 WHERE sent = 0 AND at <= ?1').bind(now)];
  dead.forEach(ep => stmts.push(env.DB.prepare('DELETE FROM subs WHERE endpoint = ?1').bind(ep)));
  stmts.push(env.DB.prepare('DELETE FROM subs WHERE updated < ?1').bind(now - 45 * 864e5));
  await env.DB.batch(stmts);
}

/* ---------- Web Push: التشفير (RFC 8291) والتوقيع (RFC 8292) ---------- */

async function sendPush(env, sub, payload) {
  const body = await encrypt(new TextEncoder().encode(JSON.stringify(payload)), b64uDec(sub.p256dh), b64uDec(sub.auth));
  const aud = new URL(sub.endpoint).origin;
  const jwt = await vapidJwt(env, aud);
  return fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: '3600',
      Urgency: 'high',
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC}`,
    },
    body,
  });
}

let _vapid = null; // { key, aud: { [origin]: { jwt, exp } } }
async function vapidJwt(env, aud) {
  if (!_vapid) {
    const jwk = JSON.parse(env.VAPID_PRIVATE_JWK);
    const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    _vapid = { key, aud: {} };
  }
  const now = Math.floor(Date.now() / 1000);
  const c = _vapid.aud[aud];
  if (c && c.exp - now > 3600) return c.jwt;
  const exp = now + 12 * 3600;
  const enc = o => b64uEnc(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = enc({ typ: 'JWT', alg: 'ES256' }) + '.' + enc({ aud, exp, sub: env.VAPID_SUBJECT });
  // WebCrypto يعيد التوقيع بصيغة r||s الخام، وهي صيغة JWS المطلوبة
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, _vapid.key, new TextEncoder().encode(unsigned));
  const jwt = unsigned + '.' + b64uEnc(new Uint8Array(sig));
  _vapid.aud[aud] = { jwt, exp };
  return jwt;
}

async function encrypt(plain, uaPublic, authSecret, fixed = null) {
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('bad subscription keys');
  // fixed: مفتاح وملح ثابتان لاختبار المتجه المنشور في RFC 8291 فقط
  const as = fixed ? fixed.as : await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));

  // IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0"||ua_public||as_public, 32)
  const ikm = await hkdf(authSecret, ecdh, concat(utf8('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = fixed ? fixed.salt : crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12);

  // سجلّ واحد: النص ثم المحدِّد 0x02 (آخر سجل)
  const record = concat(plain, new Uint8Array([2]));
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, record));

  const header = new Uint8Array(16 + 4 + 1 + 65);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = 65;
  header.set(asPublic, 21);
  return concat(header, ct);
}

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/* ---------- أدوات ---------- */

function checkKey(k) {
  if (typeof k !== 'string' || !/^[A-Za-z0-9_-]{20,64}$/.test(k)) throw httpError(400, 'key');
  return k;
}
function checkSub(s) {
  if (!s || typeof s.endpoint !== 'string' || !s.keys) throw httpError(400, 'sub');
  const u = new URL(s.endpoint);
  if (u.protocol !== 'https:' || !PUSH_HOSTS.some(re => re.test(u.hostname))) throw httpError(400, 'push service not allowed');
  const p256dh = String(s.keys.p256dh || ''), auth = String(s.keys.auth || '');
  if (b64uDec(p256dh).length !== 65 || b64uDec(auth).length !== 16) throw httpError(400, 'sub keys');
  return { endpoint: s.endpoint, p256dh, auth };
}
function checkReminder(r) {
  const at = Number(r && r.at);
  if (!r || typeof r.id !== 'string' || !isFinite(at)) throw httpError(400, 'reminder');
  return {
    id: r.id.slice(0, 120),
    at: Math.round(at),
    title: String(r.title || '').slice(0, 120),
    body: String(r.body || '').slice(0, 300),
    view: String(r.view || '').slice(0, 30),
  };
}
async function readJson(req) {
  const t = await req.text();
  if (t.length > 200000) throw httpError(413, 'too large');
  try { return JSON.parse(t); } catch (e) { throw httpError(400, 'json'); }
}
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const h = { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
  if (allowed.includes(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}
function json(o, status, headers) {
  return new Response(JSON.stringify(o), { status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers) });
}
function httpError(status, msg) { const e = new Error(msg); e.status = status; return e; }
const utf8 = s => new TextEncoder().encode(s);
function concat(...arrs) {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let i = 0;
  for (const a of arrs) { out.set(a, i); i += a.length; }
  return out;
}
function b64uEnc(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64uDec(str) {
  const s = String(str).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - s.length % 4) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// للاختبار المحلي فقط
export const _test = { encrypt, hkdf, b64uEnc, b64uDec, concat, utf8 };
