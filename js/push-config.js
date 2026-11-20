'use strict';
/* =========================================================
   إعدادات خادم التنبيهات (push-server/).
   ليست سرًّا: المفتاح الخاص محفوظ في الخادم وحده.
   اترك url فارغًا لتعطيل التنبيهات والتطبيق مغلق.
   ========================================================= */

const PUSH_CONFIG = {
  url: '',   // رابط الخادم بعد نشره، مثل: https://musaid-push.<اسمك>.workers.dev
  vapidPublicKey: 'BNEAPXcneGVU0srHcfE1qNOvfgm7kcsmnvfr5NPq9UWieGL-eBvC8INHmKQVoCSCUldrTskbk1A3pYO_ALU2z2Y',
};
