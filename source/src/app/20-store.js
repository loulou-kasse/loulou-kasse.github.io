
  /* ---------- хранилище ----------
     Запись в Firestore сразу попадает в локальный кэш (и на экран), а на сервер уходит, когда есть связь.
     Поэтому приложение не ждёт ответа сервера; ошибки сервера показываются отдельным сообщением. */
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify({ entries: S.entries, invoices: S.invoices, templates: S.templates, settings: S.settings, bank: S.bank })); } catch (e) {} }
  function localMode(note) {
    S.mode = 'local'; S.note = note || '';
    try { var d = JSON.parse(localStorage.getItem(LS) || 'null'); if (d) { S.entries = d.entries || []; S.invoices = d.invoices || []; S.templates = d.templates || []; S.settings = d.settings || {}; S.bank = d.bank || { statements: {} }; } } catch (e) {}
    draw();
  }
  function dbErr(e) {
    var code = e && e.code, m = e && e.message ? e.message : String(e);
    if (code === 'permission-denied') return 'Нет доступа: этот Google-аккаунт не входит в список разрешённых.';
    if (code === 'unavailable') return 'Нет связи с сервером. Проверьте интернет.';
    if (code === 'exists') return 'Такой документ уже существует.';
    if (code === 'resource-exhausted') return 'Превышен лимит базы данных. Попробуйте позже.';
    return 'Не удалось сохранить: ' + m;
  }
  function bg(p) { if (p && p.catch) p.catch(function (e) { toast(dbErr(e)); }); return Promise.resolve(); }
  function clean(o) {
    if (Array.isArray(o)) return o.map(clean);
    if (o && typeof o === 'object') { var r = {}; Object.keys(o).forEach(function (k) { if (o[k] !== undefined) r[k] = clean(o[k]); }); return r; }
    return o;
  }
  function noId(o) { var r = clean(o); delete r.id; return r; }
  function upsert(arr, key, obj) { var i = arr.findIndex(function (x) { return x[key] === obj[key]; }); if (i >= 0) arr[i] = obj; else arr.push(obj); }
  function putEntry(e) {
    if (!C.validEntry(e)) return Promise.reject({ message: 'запись не прошла проверку' });
    if (db) return bg(db.doc('entries/' + e.id).set(noId(e)));
    upsert(S.entries, 'id', clean(e)); saveLocal(); refresh(); return Promise.resolve();
  }
  function patchEntry(id, patch) {
    if (db) return bg(db.doc('entries/' + id).set(clean(patch), { merge: true }));
    var e = S.entries.find(function (x) { return x.id === id; }); if (e) Object.keys(patch).forEach(function (k) { if (patch[k] === null) delete e[k]; else e[k] = patch[k]; }); saveLocal(); refresh(); return Promise.resolve();
  }
  function putInvoice(iv) {
    if (db) return bg(db.doc('invoices/' + iv.no).set(clean(iv)));
    upsert(S.invoices, 'no', clean(iv)); saveLocal(); refresh(); return Promise.resolve();
  }
  /* новый счёт: номер не должен достаться двоим, поэтому здесь ждём сервер */
  function createInvoice(iv) {
    if (db) return B.createDoc('invoices/' + iv.no, clean(iv));
    if (S.invoices.some(function (v) { return v.no === iv.no; })) return Promise.reject({ code: 'exists' });
    S.invoices.push(clean(iv)); saveLocal(); refresh(); return Promise.resolve();
  }
  function putSettings(s) { if (db) return bg(db.doc('meta/settings').set(clean(s))); S.settings = s; saveLocal(); refresh(true); return Promise.resolve(); }
  function patchSettings(p) { if (db) return bg(db.doc('meta/settings').set(clean(p), { merge: true })); Object.assign(S.settings, p); saveLocal(); refresh(true); return Promise.resolve(); }
  function putBank(b) { if (db) return bg(db.doc('meta/bank').set(clean(b))); S.bank = b; saveLocal(); refresh(); return Promise.resolve(); }
  function putTemplate(t) { if (db) return bg(db.doc('templates/' + t.id).set(noId(t))); upsert(S.templates, 'id', clean(t)); saveLocal(); refresh(); return Promise.resolve(); }
  function delTemplate(id) { if (db) return bg(db.doc('templates/' + id).delete()); S.templates = S.templates.filter(function (t) { return t.id !== id; }); saveLocal(); refresh(); return Promise.resolve(); }

  /* выдача номера: если номер занят другим устройством — берём следующий (до 6 попыток) */
  function issueWithNumber(date, wanted, build) {
    var taken = [];
    function attempt(i) {
      var no = wanted || C.nextInvoiceNo(S.invoices.concat(taken), date, S.settings.lastIssued);
      if (!no) return Promise.reject({ message: 'не удалось определить номер счёта' });
      if (S.invoices.some(function (v) { return v.no === no; })) return Promise.reject({ message: 'номер ' + no + ' уже выдан' });
      var iv = build(no);
      return createInvoice(iv).then(function () { return iv; }, function (e) {
        if (e && e.code === 'exists') {
          if (wanted || i >= 5) throw { message: 'номер ' + no + ' уже выдан' };
          taken.push({ no: no }); return attempt(i + 1);
        }
        if (e && (e.code === 'unavailable' || e.code === 'failed-precondition')) throw { message: 'для выставления счёта нужен интернет: номер проверяется на сервере' };
        throw e;
      });
    }
    return attempt(0);
  }

  function boot() {
    route();
    if (B && B.available()) {
      try { B.init(); } catch (e) { localMode('Firebase не запустился: ' + (e.message || e)); return; }
      S.mode = 'auth'; draw();
      B.onAuth(function (u) {
        stopSync();
        if (u) { S.user = u; S.mode = 'boot'; S.note = ''; startSync(); }
        else { S.user = null; S.mode = 'login'; S.entries = []; S.invoices = []; S.templates = []; S.settings = {}; S.bank = { statements: {} }; }
        draw();
      });
      return;
    }
    localMode('Окно без синхронизации: данные хранятся только на этом устройстве.');
  }
  function stopSync() { unsub.forEach(function (f) { try { f(); } catch (e) {} }); unsub = []; db = null; S.loaded = {}; }
  function startSync() {
    db = B.db();
    var timer = setTimeout(function () { if (S.mode === 'boot') { S.note = 'Данные пока не загрузились. Проверьте интернет — приложение продолжит попытки само.'; drawSync(); } }, 10000);
    var pend = {};
    var got = function (key, snap) {
      S.loaded[key] = true; pend[key] = !!(snap.metadata && snap.metadata.hasPendingWrites);
      S.pending = Object.keys(pend).some(function (k) { return pend[k]; });
      if (S.mode === 'boot' && ['entries', 'invoices', 'settings', 'bank', 'templates'].every(function (k) { return S.loaded[k]; })) { clearTimeout(timer); S.mode = 'sync'; S.note = ''; dirty = false; draw(); afterLoad(); }
    };
    var fail = function (e) {
      clearTimeout(timer);
      if (e && e.code === 'permission-denied') { S.mode = 'denied'; draw(); return; }
      S.note = dbErr(e); drawSync();
    };
    unsub.push(db.collection('entries').onSnapshot({ includeMetadataChanges: true }, function (q) { S.entries = q.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); }); got('entries', q); refresh(); }, fail));
    unsub.push(db.collection('invoices').onSnapshot({ includeMetadataChanges: true }, function (q) { S.invoices = q.docs.map(function (d) { return Object.assign({}, d.data()); }).filter(function (v) { return v.no; }); got('invoices', q); refresh(); }, fail));
    unsub.push(db.collection('templates').onSnapshot({ includeMetadataChanges: true }, function (q) { S.templates = q.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); }); got('templates', q); refresh(); }, fail));
    unsub.push(db.doc('meta/settings').onSnapshot({ includeMetadataChanges: true }, function (d) { S.settings = d.exists ? Object.assign({}, d.data()) : {}; got('settings', d); refresh(true); }, fail));
    unsub.push(db.doc('meta/bank').onSnapshot({ includeMetadataChanges: true }, function (d) { var b = d.exists ? d.data() : {}; S.bank = { statements: Object.assign({}, b.statements || {}) }; got('bank', d); refresh(); }, fail));
  }
  /* после загрузки: автокопия в Google Drive раз в 30 дней, если Drive подключён */
  function afterLoad() {
    var last = S.settings.lastBackup || '';
    if (B && B.driveReady() && (!last || C.daysBetween(last.slice(0, 10), today()) >= 30) && (S.entries.length || S.invoices.length)) backupToDrive(true);
  }
  window.addEventListener('online', function () { drawSync(); });
  window.addEventListener('offline', function () { drawSync(); });
