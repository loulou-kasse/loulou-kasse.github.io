/* LOU LOU Kasse — связь с Firebase (вход, база) и Google Drive.
   Данные защищены правилами Firestore: читать и писать могут только разрешённые Google-аккаунты.
   Доступ к Drive запрашивается отдельно, только когда он нужен; токен Google живёт около часа. */
(function (root) {
  'use strict';
  var cfg = root.KASSE_CONFIG || {};
  var auth = null, db = null;
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
  var TK = 'loulou-kasse-drive';
  var folderCache = {};

  function available() { return !!(root.firebase && cfg.firebase && cfg.firebase.apiKey && cfg.firebase.projectId); }
  function init() {
    if (db) return;
    root.firebase.initializeApp(cfg.firebase);
    auth = root.firebase.auth();
    db = root.firebase.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
  }
  function onAuth(cb) { auth.onAuthStateChanged(cb); }
  function user() { return auth && auth.currentUser; }
  function provider(withDrive) {
    var p = new root.firebase.auth.GoogleAuthProvider();
    if (withDrive) p.addScope(DRIVE_SCOPE);
    var u = user();
    p.setCustomParameters(u && u.email ? { login_hint: u.email } : { prompt: 'select_account' });
    return p;
  }
  function authErr(e) {
    var c = e && e.code || '';
    if (c === 'auth/popup-blocked') return 'Браузер заблокировал окно входа. Разрешите всплывающие окна для этого сайта и повторите.';
    if (c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request') return 'Вход отменён.';
    if (c === 'auth/unauthorized-domain') return 'Этот адрес не добавлен в Firebase → Authentication → Authorized domains.';
    if (c === 'auth/user-mismatch') return 'Выберите тот же Google-аккаунт, с которым вы вошли в приложение.';
    if (c === 'auth/network-request-failed') return 'Нет связи с Google. Проверьте интернет.';
    return 'Не удалось войти: ' + (e && e.message || c);
  }
  function signIn() { return auth.signInWithPopup(provider(false)); }
  function signOut() { forgetDrive(); return auth.signOut(); }

  /* ---------- Google Drive ---------- */
  function saveToken(t) { try { localStorage.setItem(TK, JSON.stringify({ t: t, exp: Date.now() + 50 * 60 * 1000, uid: (user() || {}).uid })); } catch (e) {} }
  function forgetDrive() { try { localStorage.removeItem(TK); } catch (e) {} folderCache = {}; }
  function token() {
    try {
      var d = JSON.parse(localStorage.getItem(TK) || 'null');
      if (d && d.t && d.exp > Date.now() && d.uid === (user() || {}).uid) return d.t;
    } catch (e) {}
    return null;
  }
  function driveReady() { return !!token(); }
  /* вызывать только из обработчика нажатия: открывается окно Google */
  function connectDrive() {
    var u = user();
    if (!u) return Promise.reject({ message: 'Сначала войдите в приложение.' });
    return u.reauthenticateWithPopup(provider(true)).then(function (r) {
      var t = r && r.credential && r.credential.accessToken;
      if (!t) throw { message: 'Google не выдал доступ к Drive.' };
      saveToken(t); return t;
    });
  }
  function driveFetch(url, opts) {
    var t = token();
    if (!t) return Promise.reject({ code: 'drive/no-token', message: 'Google Drive не подключён.' });
    opts = opts || {}; opts.headers = Object.assign({ Authorization: 'Bearer ' + t }, opts.headers || {});
    return fetch(url, opts).then(function (r) {
      if (r.status === 401) { forgetDrive(); throw { code: 'drive/no-token', message: 'Доступ к Google Drive истёк. Подключите Drive заново.' }; }
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var m = j && j.error && j.error.message || ('HTTP ' + r.status);
          if (r.status === 403 && /has not been used|disabled/i.test(m)) throw { code: 'drive/api-off', message: 'В проекте Google не включён Google Drive API.' };
          if (r.status === 404) throw { code: 'drive/not-found', message: 'Папка не найдена: возможно, она удалена или перемещена в корзину.' };
          throw { code: 'drive/http', message: m };
        }
        return j;
      });
    }, function () { throw { code: 'drive/offline', message: 'Нет связи с Google Drive. Проверьте интернет.' }; });
  }
  var API = 'https://www.googleapis.com/drive/v3/files', UP = 'https://www.googleapis.com/upload/drive/v3/files';
  function q(s) { return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  /* папка name внутри parent: найти или создать */
  function folder(name, parent) {
    var key = parent + '/' + name;
    if (folderCache[key]) return Promise.resolve(folderCache[key]);
    var query = "name='" + q(name) + "' and '" + q(parent) + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false";
    return driveFetch(API + '?fields=files(id,name)&q=' + encodeURIComponent(query)).then(function (j) {
      if (j.files && j.files.length) return j.files[0].id;
      return driveFetch(API + '?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }) }).then(function (r) { return r.id; });
    }).then(function (id) { folderCache[key] = id; return id; });
  }
  /* путь из нескольких папок от parent: ['Belege', '2026-11'] */
  function folderPath(parent, names) {
    return names.reduce(function (p, n) { return p.then(function (id) { return folder(n, id); }); }, Promise.resolve(parent));
  }
  /* загрузка файла; data — Blob или строка; convertTo — тип Google (например документ) */
  function upload(o) {
    var meta = { name: o.name, parents: [o.parent] };
    if (o.convertTo) meta.mimeType = o.convertTo;
    var b = 'kasse' + Math.random().toString(36).slice(2);
    var body = new Blob(['--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b + '\r\nContent-Type: ' + o.mime + '\r\n\r\n', o.data, '\r\n--' + b + '--\r\n']);
    return driveFetch(UP + '?uploadType=multipart&fields=id,name,webViewLink', { method: 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + b }, body: body });
  }

  /* ---------- файлы на устройство ---------- */
  function download(name, blob) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
    return Promise.resolve();
  }
  function canShare(name, blob) {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([blob], name, { type: blob.type })] })); } catch (e) { return false; }
  }
  function share(name, blob, title) {
    return navigator.share({ files: [new File([blob], name, { type: blob.type })], title: title || name });
  }

  /* новый документ только если его ещё нет (номер счёта не может достаться двоим) */
  function createDoc(path, data) {
    var ref = db.doc(path);
    return db.runTransaction(function (t) {
      return t.get(ref).then(function (s) { if (s.exists) throw { code: 'exists', message: 'документ ' + path + ' уже существует' }; t.set(ref, data); });
    });
  }

  root.Backend = {
    available: available, init: init, onAuth: onAuth, user: user, signIn: signIn, signOut: signOut, authErr: authErr,
    db: function () { return db; }, createDoc: createDoc,
    driveReady: driveReady, connectDrive: connectDrive, forgetDrive: forgetDrive, folder: folder, folderPath: folderPath, upload: upload, driveFetch: driveFetch,
    download: download, canShare: canShare, share: share, config: cfg
  };
})(typeof window !== 'undefined' ? window : globalThis);
