
  /* ---------- общие элементы ---------- */
  var toastT = null;
  function toast(msg, act) {
    var t = $('#toast');
    t.innerHTML = esc(msg) + (act ? ' <button class="lnk" data-act="' + esc(act[0]) + '">' + esc(act[1]) + '</button>' : '');
    t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, act ? 9000 : 4200);
  }
  function copyText(txt) {
    var done = function () { toast('Скопировано'); };
    var fallback = function () {
      try { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done(); }
      catch (e) { toast('Не удалось скопировать — выделите текст вручную'); }
    };
    try { navigator.clipboard.writeText(txt).then(done, fallback); } catch (e) { fallback(); }
  }
  function openSheet(html) {
    var bgEl = $('#sheet');
    bgEl.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-bar"><button type="button" class="sheet-x" data-act="sheet-close" aria-label="Закрыть окно">×</button></div><div class="sheet-body">' + html + '</div></div>';
    bgEl.hidden = false; document.body.classList.add('noscroll'); bgEl.querySelector('.sheet').scrollTop = 0;
  }
  function closeSheet() { var bgEl = $('#sheet'); bgEl.hidden = true; bgEl.innerHTML = ''; document.body.classList.remove('noscroll'); if (dirty) draw(); }
  function sheetOpen() { return !$('#sheet').hidden; }
  function fld(id, label, type, v, extra) {
    return '<label class="f" for="' + id + '">' + esc(label) + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(v == null ? '' : v) + '" ' + (extra || '') + '></label>';
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setErr(msg) { var all = Array.prototype.slice.call(document.querySelectorAll('#sheet .err')), e = all.filter(function (x) { return x.offsetParent !== null; }).pop() || all[0]; if (e) e.textContent = msg || ''; }
  function busy(btn, on) { if (btn) btn.disabled = !!on; }

  function drawSync() {
    var el = $('#sync'), off = typeof navigator !== 'undefined' && navigator.onLine === false;
    var st = S.mode === 'sync' ? (off ? 'off' : S.pending ? 'wait' : 'on') : S.mode === 'local' ? 'off' : '';
    var txt = S.mode === 'sync' ? (off ? 'Без интернета — изменения сохранятся позже' : S.pending ? 'Отправка изменений…' : 'Синхронизировано') :
      S.mode === 'local' ? 'Только это устройство' : S.mode === 'login' || S.mode === 'denied' ? 'Вход не выполнен' : 'Загрузка';
    el.className = 'sync ' + st; el.innerHTML = '<i></i><span>' + esc(txt) + '</span>';
    var b = $('#banner'); b.hidden = !S.note; b.textContent = S.note;
  }
  function route() {
    var h = (location.hash || '#home').slice(1);
    view = ['home', 'guide', 'invoices', 'journal', 'more'].indexOf(h) >= 0 ? h : 'home';
    if (view === 'guide' && g.step === 0 && !g.sit && g.sit !== 0) g = { step: 0, sit: null, opt: null, vals: {} };
    draw();
  }
  function refresh(settingsChanged) {
    drawSync();
    if (S.mode === 'boot') return;
    if (view === 'guide' && !settingsChanged) return;
    var a = document.activeElement, m = $('#main');
    if (a && m.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { dirty = true; return; }
    drawMain();
  }
  function draw() {
    drawSync(); drawMain();
    var gate = S.mode === 'login' || S.mode === 'denied' || S.mode === 'auth';
    $('nav.tabs').hidden = gate;
    document.querySelectorAll('nav.tabs a').forEach(function (a) {
      var t = a.getAttribute('href').slice(1);
      if (t === view || (t === 'home' && view === 'guide')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function drawMain() {
    dirty = false;
    var m = $('#main');
    if (S.mode === 'auth') { m.innerHTML = '<div class="gate"><p class="hint">Загрузка…</p></div>'; return; }
    if (S.mode === 'login') { m.innerHTML = vLogin(); return; }
    if (S.mode === 'denied') { m.innerHTML = vDenied(); return; }
    if (S.mode === 'boot') { m.innerHTML = '<div class="gate"><p class="hint">Загрузка данных…</p></div>'; return; }
    m.innerHTML = ({ home: vHome, guide: vGuide, invoices: vInvoices, journal: vJournal, more: vMore })[view]();
  }

  /* ---------- вход ---------- */
  function vLogin() {
    return '<div class="gate"><h2>Вход</h2><p>Данные LOU LOU Kasse доступны только владельцам. Войдите своим Google-аккаунтом.</p>' +
      '<button class="btn pri" data-act="login">Войти через Google</button><p class="err" id="login-err" role="alert"></p></div>';
  }
  function vDenied() {
    var u = S.user || {};
    return '<div class="gate"><h2>Нет доступа</h2><p>Аккаунт <b>' + esc(u.email || '') + '</b> не входит в список разрешённых. Войдите другим аккаунтом или попросите добавить этот адрес в правила базы.</p>' +
      '<button class="btn" data-act="logout">Выйти и войти другим аккаунтом</button></div>';
  }

  /* ---------- главная ---------- */
  function meter(v, lim) {
    var p = lim > 0 ? v / lim : 0, cls = p > 1 ? 'stop' : p >= 0.8 ? 'warn' : '';
    return { html: '<div class="meter ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, Math.round(p * 100))) + '%"></i></div>', cls: cls || 'ok' };
  }
  function limitCards() {
    var s = S.settings, ym = today().slice(0, 7), yr = ym.slice(0, 4);
    var gew = C.sums(S.entries, ym).gewinn, ums = C.sums(S.entries, yr).einnahme;
    var kv = s.kvLimit || 0, ku = s.kuLimit || 0, m1 = meter(gew, kv), m2 = meter(ums, ku);
    var word = { ok: 'в норме', warn: 'близко к пределу', stop: 'предел превышен' };
    return '<div class="card"><div class="row"><h3>Прибыль за ' + MES[parseInt(ym.slice(5), 10) - 1] + '</h3><span class="pill ' + m1.cls + ' right">' + (kv ? word[m1.cls] : 'лимит не задан') + '</span></div><p><b class="num">' + eur(gew) + '</b> из ' + eur(kv) + ' — предел семейной страховки</p>' + m1.html +
      '<div class="row" style="margin-top:14px"><h3>Оборот за ' + yr + ' год</h3><span class="pill ' + m2.cls + ' right">' + (ku ? word[m2.cls] : 'лимит не задан') + '</span></div><p><b class="num">' + eur(ums) + '</b> из ' + eur(ku) + ' — порог Kleinunternehmer</p>' + m2.html + '</div>';
  }
  function missingBeleg() { var st = C.stornoedIds(S.entries); return S.entries.filter(function (e) { return C.needsBeleg(e, st); }); }
  function vHome() {
    var t = today(), open = C.openInvoices(S.invoices), od = open.filter(function (v) { return C.isOverdue(v, t); });
    var openSum = open.reduce(function (a, v) { return a + v.total; }, 0), mb = missingBeleg();
    var sm = C.sums(S.entries, t.slice(0, 7)), d = new Date();
    var h = '<div class="hello"><span>' + d.getDate() + ' ' + MES_GEN[d.getMonth()] + ' ' + d.getFullYear() + '</span></div>';
    h += '<div class="quick"><button class="qbtn" data-act="j-new" data-type="ausgabe"><b>+</b>Расход</button><button class="qbtn" data-act="j-new" data-type="einnahme"><b>+</b>Поступление</button><button class="qbtn" data-act="iv-new"><b>+</b>Счёт</button><button class="qbtn" data-act="j-new" data-type="ausgabe" data-photo="1"><b>◉</b>Фото чека</button></div>';
    h += '<div class="tiles"><button class="tile lnkt" data-act="go-iv-open"><span>Ждём оплату</span><b>' + eur(openSum) + '</b><em>' + open.length + ' ' + plural(open.length, 'счёт', 'счёта', 'счетов') + (od.length ? ', <i class="red">просрочено ' + od.length + '</i>' : '') + '</em></button>' +
      '<div class="tile hi"><span>Прибыль, ' + MES[d.getMonth()] + '</span><b>' + eur(sm.gewinn) + '</b><em>выручка ' + eur(sm.einnahme) + '</em></div>' +
      '<button class="tile lnkt' + (mb.length ? ' warnt' : '') + '" data-act="go-nobeleg"><span>Без чека</span><b>' + mb.length + '</b><em>' + (mb.length ? 'расходы без документа' : 'все документы на месте') + '</em></button></div>';
    if (od.length) h += '<div class="card"><h3>Просроченные счета</h3><div class="list">' + od.map(ivRow).join('') + '</div></div>';
    h += limitCards();
    h += '<div class="choices"><a class="choice" href="#guide"><span><b>Справочник</b><span class="sub">как оплатить, принять оплату, перевести между счетами</span></span></a></div>';
    if (!reqOk()) h += '<div class="banner">Для выставления счетов заполните реквизиты: «Ещё» → «Настройки».</div>';
    if (!S.entries.length && !S.invoices.length && S.mode === 'sync') h += '<div class="card"><h3>Перенос из старой версии</h3><p class="hint">В старой версии (в Claude) откройте «Прочее» → «Резервная копия» и сохраните файл. Затем здесь: «Ещё» → «Восстановить из копии».</p></div>';
    return h;
  }
  function plural(n, a, b, c) { var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; }

  /* ---------- справочник ---------- */
  function vGuide() {
    if (g.step === 0) {
      return '<a class="back" href="#home">← Главная</a><h2>Справочник</h2><div class="choices big">' + GUIDE.map(function (s, i) { return '<button class="choice" data-act="g-sit" data-i="' + i + '"><span><b>' + esc(s.title) + '</b><span class="sub">' + esc(s.sub) + '</span></span></button>'; }).join('') +
        '<a class="choice" href="' + MEMO + '" target="_blank" rel="noopener"><span><b>Памятка</b><span class="sub">правила работы со счетами, полный текст</span></span></a></div>';
    }
    var sit = GUIDE[g.sit];
    if (g.step === 1) {
      return '<button class="back" data-act="g-back">← Назад</button><h2>' + esc(sit.title) + '</h2><div class="choices">' +
        sit.opts.map(function (o, i) { return '<button class="choice" data-level="' + o.level + '" data-act="g-opt" data-i="' + i + '"><span><b>' + esc(o.title) + '</b><span class="sub">' + esc(o.sub) + '</span></span></button>'; }).join('') + '</div>';
    }
    var o = sit.opts[g.opt], v = guideVals();
    var keys = C.tplFields(o.texts.map(function (t) { return t[1]; })).filter(function (k) { return FIELDS[k]; });
    var h = '<button class="back" data-act="g-back">← Назад</button><h2>' + esc(o.title) + '</h2>' +
      '<div class="verdict ' + o.level + '">' + LEVEL[o.level] + '</div>' +
      '<div class="card"><h3>Порядок действий</h3><ol class="steps">' + o.steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol></div>';
    if (o.texts.length) {
      h += '<div class="card"><h3>Формулировка</h3>';
      if (keys.length) h += '<div class="row">' + keys.map(function (k) {
        var f = FIELDS[k], cur = g.vals[k] != null ? g.vals[k] : (k === 'datum' ? today() : k === 'monat' ? v.monat : '');
        return '<label class="f" for="gf-' + k + '">' + esc(f[0]) + '<input id="gf-' + k + '" data-gf="' + k + '" type="' + f[1] + '" value="' + esc(cur) + '"></label>';
      }).join('') + '</div>';
      h += o.texts.map(function (t, i) { return '<div class="copy"><span class="lbl">' + esc(t[0]) + '</span><code data-tpl="' + i + '">' + esc(C.fillTpl(t[1], v)) + '</code><div><button class="btn sm" data-act="g-copy" data-i="' + i + '">Скопировать</button></div></div>'; }).join('');
      h += '</div>';
    }
    if (o.journal) h += '<button class="btn pri" data-act="g-journal">Внести в журнал</button>';
    if (o.go) h += '<a class="btn pri" href="#' + o.go + '">' + (o.go === 'invoices' ? 'Перейти к счетам' : 'Перейти в «Ещё»') + '</a>';
    return h;
  }
