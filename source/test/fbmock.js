/* Имитация Firebase compat (auth + firestore) для тестов в браузере. Данные — в localStorage '__fbmock'. */
(function () {
  var KEY = '__fbmock', listeners = [];
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(d) { localStorage.setItem(KEY, JSON.stringify(d)); }
  function deny() { return !!window.__fbDeny || localStorage.getItem('__fbDeny') === '1'; }
  function err(code) { var e = new Error(code); e.code = code; return e; }
  function docSnap(path, data) { var id = path.split('/').pop(); return { id: id, exists: data != null, data: function () { return data == null ? undefined : JSON.parse(JSON.stringify(data)); }, metadata: { hasPendingWrites: false, fromCache: false } }; }
  function notify() { setTimeout(function () { listeners.forEach(function (l) { l.fire(); }); }, 0); }
  function colOf(path) { var p = path.split('/'); return p.slice(0, -1).join('/'); }
  function merge(a, b) { var r = Object.assign({}, a || {}); Object.keys(b).forEach(function (k) { r[k] = b[k]; }); return r; }
  window.__fbWrites = [];
  function DocRef(path) { this.path = path; }
  DocRef.prototype.set = function (data, opt) {
    if (deny()) return Promise.reject(err('permission-denied'));
    var d = load(); d[this.path] = opt && opt.merge ? merge(d[this.path], JSON.parse(JSON.stringify(data))) : JSON.parse(JSON.stringify(data));
    save(d); window.__fbWrites.push(this.path); notify(); return Promise.resolve();
  };
  DocRef.prototype.update = function (data) { return this.set(data, { merge: true }); };
  DocRef.prototype.delete = function () { var d = load(); delete d[this.path]; save(d); notify(); return Promise.resolve(); };
  DocRef.prototype.get = function () { if (deny()) return Promise.reject(err('permission-denied')); return Promise.resolve(docSnap(this.path, load()[this.path])); };
  DocRef.prototype.onSnapshot = function (a, b, c) {
    var next = typeof a === 'function' ? a : b, fail = typeof a === 'function' ? b : c, path = this.path;
    var l = { fire: function () { if (deny()) { fail && fail(err('permission-denied')); return; } next(docSnap(path, load()[path])); } };
    listeners.push(l); setTimeout(l.fire, 5);
    return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
  };
  function ColRef(path) { this.path = path; }
  ColRef.prototype.onSnapshot = function (a, b, c) {
    var next = typeof a === 'function' ? a : b, fail = typeof a === 'function' ? b : c, path = this.path;
    var l = { fire: function () {
      if (deny()) { fail && fail(err('permission-denied')); return; }
      var d = load(), docs = Object.keys(d).filter(function (k) { return colOf(k) === path; }).map(function (k) { return docSnap(k, d[k]); });
      next({ docs: docs, metadata: { hasPendingWrites: false, fromCache: false } });
    } };
    listeners.push(l); setTimeout(l.fire, 5);
    return function () { listeners = listeners.filter(function (x) { return x !== l; }); };
  };
  var db = {
    enablePersistence: function () { return Promise.resolve(); },
    collection: function (p) { return new ColRef(p); },
    doc: function (p) { return new DocRef(p); },
    runTransaction: function (fn) {
      if (window.__fbOffline) return Promise.reject(err('unavailable'));
      if (deny()) return Promise.reject(err('permission-denied'));
      var writes = [];
      var t = { get: function (ref) { return ref.get(); }, set: function (ref, data) { writes.push([ref, data]); } };
      return Promise.resolve(fn(t)).then(function (r) { writes.forEach(function (w) { w[0].set(w[1]); }); return r; });
    }
  };
  var authListeners = [], current = null;
  try { current = JSON.parse(localStorage.getItem('__fbuser') || 'null'); } catch (e) {}
  function mkUser(u) {
    if (!u) return null;
    return { uid: u.uid, email: u.email, reauthenticateWithPopup: function (p) {
      if (window.__popupFail) return Promise.reject(err(window.__popupFail));
      window.__driveScopes = p.scopes; return Promise.resolve({ credential: { accessToken: 'tok-' + Date.now() } });
    } };
  }
  var auth = {
    get currentUser() { return mkUser(current); },
    onAuthStateChanged: function (cb) { authListeners.push(cb); setTimeout(function () { cb(mkUser(current)); }, 10); },
    signInWithPopup: function () {
      if (window.__popupFail) return Promise.reject(err(window.__popupFail));
      current = { uid: 'u1', email: window.__loginEmail || 'malyata777@gmail.com' }; localStorage.setItem('__fbuser', JSON.stringify(current));
      authListeners.forEach(function (cb) { cb(mkUser(current)); }); return Promise.resolve({ user: mkUser(current) });
    },
    signOut: function () { current = null; localStorage.removeItem('__fbuser'); authListeners.forEach(function (cb) { cb(null); }); return Promise.resolve(); }
  };
  function GoogleAuthProvider() { this.scopes = []; }
  GoogleAuthProvider.prototype.addScope = function (s) { this.scopes.push(s); };
  GoogleAuthProvider.prototype.setCustomParameters = function () {};
  var firebase = { initializeApp: function () { return {}; }, auth: function () { return auth; }, firestore: function () { return db; } };
  firebase.auth.GoogleAuthProvider = GoogleAuthProvider;
  window.firebase = firebase;
})();
