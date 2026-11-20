-- جداول خادم التنبيهات (قاعدة D1)
CREATE TABLE IF NOT EXISTS subs (
  endpoint TEXT PRIMARY KEY,  -- عنوان الجهاز لدى خدمة الدفع
  key TEXT NOT NULL,          -- مفتاح المستخدم (مشترك بين أجهزته عبر المزامنة)
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS subs_key ON subs(key);

CREATE TABLE IF NOT EXISTS reminders (
  key TEXT NOT NULL,
  id TEXT NOT NULL,           -- معرّف التذكير، وهو نفسه وسم الإشعار
  at INTEGER NOT NULL,        -- وقت الإرسال (ميلي ثانية)
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  view TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, id)
);
CREATE INDEX IF NOT EXISTS reminders_due ON reminders(sent, at);
