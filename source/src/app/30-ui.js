
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
    document.body.setAttribute('data-view', view);
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

  /* ---------- оформление (запоминается на устройстве) ---------- */
  var THEMES = [['neo', 'Объёмный'], ['floral', 'Цветочный'], ['paper', 'Мягкий'], ['boutique', 'Бутик'], ['classic', 'Строгий']];
  function theme() { try { return localStorage.getItem('kasse-theme') || 'neo'; } catch (e) { return 'neo'; } }
  function applyTheme() { var t = theme(); document.body.className = document.body.className.replace(/\btheme-\w+/g, '').trim() + ' theme-' + t; }
  function setTheme(t) { try { localStorage.setItem('kasse-theme', t); } catch (e) {} applyTheme(); }

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
  var QI = {
    minus: '<svg viewBox="0 0 24 24"><path d="M5 12h14"/><circle cx="12" cy="12" r="9.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 7v10M7 12h10"/><circle cx="12" cy="12" r="9.5"/></svg>',
    inv: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 13h7 M9 17h5"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    sprig: '<svg class="sprig" viewBox="0 0 120 40" aria-hidden="true"><path d="M4 34 C30 30 60 22 116 6"/><path d="M28 29c-2-8 4-14 10-15-1 7-4 12-10 15z"/><path d="M52 23c-1-8 5-13 11-13-1 7-5 11-11 13z"/><path d="M76 16c0-7 6-12 12-11-2 7-6 10-12 11z"/><path d="M40 26c6 3 13 2 17-3-7-2-13-1-17 3z"/><path d="M66 19c6 2 12 1 16-4-6-2-12-1-16 4z"/><circle cx="104" cy="9" r="3"/><circle cx="111" cy="13" r="2"/></svg>'
  };
  function missingBeleg() { var st = C.stornoedIds(S.entries); return S.entries.filter(function (e) { return C.needsBeleg(e, st); }); }
  /* что требует внимания: каждая строка ведёт к действию */
  function attention() {
    var t = today(), ym = t.slice(0, 7), pm = C.prevMonth(ym), out = [];
    var od = C.openInvoices(S.invoices).filter(function (v) { return C.isOverdue(v, t); });
    if (od.length) out.push(['stop', 'iv-open', 'data-no="' + esc(od[0].no) + '"', od.length === 1 ? 'Просрочен счёт ' + od[0].no + ' · ' + ivName(od[0]) : 'Просрочено счетов: ' + od.length, 'напомнить об оплате']);
    var mb = missingBeleg().length;
    if (mb) out.push(['warn', 'go-nobeleg', '', mb + ' ' + plural(mb, 'расход', 'расхода', 'расходов') + ' без чека', 'добавить фото или Eigenbeleg']);
    var st = C.stornoedIds(S.entries), nc = S.entries.filter(function (e) { return C.validEntry(e) && (e.type === 'einnahme' || e.type === 'ausgabe') && !e.stornoOf && !st[e.id] && !C.catOf(e); }).length;
    if (nc) out.push(['warn', 'go-nocat', '', nc + ' ' + plural(nc, 'запись', 'записи', 'записей') + ' без статьи', 'нужно для отчёта EÜR']);
    var startM = (S.settings.openingDate || '').slice(0, 7), hasG = S.entries.some(function (e) { return C.validEntry(e) && e.way === 'G' && e.date.slice(0, 7) <= pm; });
    if (hasG && (!startM || pm >= startM)) {
      var stmt = S.bank.statements[pm], rec = C.reconcile(S.entries, S.settings.opening || 0, S.settings.openingDate || '', pm, stmt == null ? null : stmt);
      if (rec.ok !== true) out.push([rec.ok === false ? 'stop' : 'warn', 'go-rec', 'data-m="' + pm + '"', rec.ok === false ? 'Расхождение с банком за ' + MES[parseInt(pm.slice(5), 10) - 1] : 'Не сверена выписка за ' + MES[parseInt(pm.slice(5), 10) - 1], rec.ok === false ? 'разница ' + eur(rec.diff) : 'внести остаток из выписки']);
    }
    var au = C.openAuslagen(S.entries);
    if (au.length) out.push(['warn', 'go-more', '', 'Не возмещено супругу: ' + eur(au.reduce(function (a, e) { return a + e.amount; }, 0)), au.length + ' ' + plural(au.length, 'расход', 'расхода', 'расходов') + ', перевод с рабочего счёта']);
    var lb = S.settings.lastBackup;
    if ((S.entries.length || S.invoices.length) && (!lb || C.daysBetween(lb.slice(0, 10), t) > 30)) out.push(['info', 'bk-open', '', lb ? 'Резервной копии больше месяца' : 'Резервная копия ещё не делалась', 'сохранить в Google Drive']);
    return out;
  }
  /* круглый объёмный логотип, плоские лучи и четыре кнопки быстрого доступа по диагоналям */
  var LOGO_ROUND = 'data:image/jpeg;base64,/*LOGO_ROUND*/';
  function rays() {
    var out = '', i, a, r1, r2;
    for (i = 0; i < 48; i++) {
      a = i * 7.5 * Math.PI / 180; if (i % 12 === 6) continue;          /* на диагоналях — главные лучи к кнопкам */
      r1 = 66; r2 = i % 2 ? 118 : (i % 4 ? 132 : 146);
      out += '<line x1="' + (180 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (180 + r1 * Math.sin(a)).toFixed(1) + '" x2="' + (180 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (180 + r2 * Math.sin(a)).toFixed(1) + '"/>';
    }
    var main = [45, 135, 225, 315].map(function (d) { var a2 = d * Math.PI / 180; return '<path d="M' + (180 + 70 * Math.cos(a2 - 0.05)).toFixed(1) + ' ' + (180 + 70 * Math.sin(a2 - 0.05)).toFixed(1) + ' L' + (180 + 128 * Math.cos(a2)).toFixed(1) + ' ' + (180 + 128 * Math.sin(a2)).toFixed(1) + ' L' + (180 + 70 * Math.cos(a2 + 0.05)).toFixed(1) + ' ' + (180 + 70 * Math.sin(a2 + 0.05)).toFixed(1) + 'z"/>'; }).join('');
    return '<svg class="rays" viewBox="0 0 360 360" aria-hidden="true"><g class="thin">' + out + '</g><g class="main">' + main + '</g></svg>';
  }
  function hero() {
    return '<div class="hero">' + rays() +
      '<div class="medal" aria-hidden="true"><div class="ring"><img src="' + LOGO_ROUND + '" alt=""></div></div>' +
      '<button class="qbtn cam p-tl" data-act="j-new" data-type="ausgabe" data-photo="1">' + QI.cam + '<span>Фото чека</span></button>' +
      '<button class="qbtn p-tr" data-act="iv-new">' + QI.inv + '<span>Счёт</span></button>' +
      '<button class="qbtn p-bl" data-act="j-new" data-type="ausgabe">' + QI.minus + '<span>Расход</span></button>' +
      '<button class="qbtn p-br" data-act="j-new" data-type="einnahme">' + QI.plus + '<span>Поступление</span></button></div>';
  }
  function vHome() {
    var t = today(), s = S.settings, open = C.openInvoices(S.invoices).sort(function (a, b) { return (a.due || '9') < (b.due || '9') ? -1 : 1; });
    var openSum = open.reduce(function (a, v) { return a + v.total; }, 0), d = new Date(), sm = C.sums(S.entries, t.slice(0, 7));
    var h = hero();
    var att = attention();
    h += '<div class="card att"><h3>Требует внимания</h3>' + (att.length ? '<div class="list">' + att.map(function (a) {
      return '<button class="item tap att-' + a[0] + '" data-act="' + a[1] + '" ' + a[2] + '><i class="dot"></i><span class="main"><b>' + esc(a[3]) + '</b><span class="meta">' + esc(a[4]) + '</span></span><span class="chev">›</span></button>';
    }).join('') + '</div>' : '<p class="allok">' + QI.sprig + 'Всё в порядке: документы на месте, счета в срок.</p>') + '</div>';
    /* ожидаемые поступления */
    h += '<div class="card"><div class="row"><h3>Ожидаем оплату</h3><b class="right num">' + eur(openSum) + '</b></div>' + (open.length ? '<div class="list">' + open.map(function (v) {
      var od = C.isOverdue(v, t);
      return '<button class="item tap" data-act="iv-open" data-no="' + esc(v.no) + '"><span class="main"><b>' + esc(ivName(v)) + '</b><span class="meta">' + esc(v.no) + ' · ' + (v.due ? (od ? '<i class="red">просрочен с ' + esc(C.deDate(v.due)) + '</i>' : 'до ' + esc(C.deDate(v.due))) : 'без срока') + '</span></span><span class="amt num">' + eur(v.total) + '</span></button>';
    }).join('') + '</div>' : '<p class="hint">Все выставленные счета оплачены.</p>') + '</div>';
    /* месяц и пределы */
    var kv = s.kvLimit || 0, ku = s.kuLimit || 0, pace = C.profitPace(S.entries, t, s.openingDate || ''), yr = t.slice(0, 4), ums = C.sums(S.entries, yr).einnahme;
    var rest = kv - pace.month, restAvg = kv - pace.avg, m1 = meter(pace.month, kv), m2 = meter(ums, ku);
    h += '<div class="card"><div class="tiles t3"><div class="tile"><span>Выручка</span><b>' + eur(sm.einnahme) + '</b></div><div class="tile"><span>Расходы</span><b>' + eur(sm.ausgabe) + '</b></div><div class="tile hi"><span>Прибыль</span><b>' + eur(sm.gewinn) + '</b></div></div><p class="hint">' + MES[d.getMonth()] + ' ' + d.getFullYear() + '</p>' +
      '<h3>Семейная страховка</h3>' + (kv ? '<p class="lim">' + (rest >= 0 ? 'В этом месяце можно ещё <b class="num">' + eur(rest) + '</b> прибыли' : 'В этом месяце предел превышен на <b class="num red">' + eur(-rest) + '</b>') + '</p>' + m1.html +
      '<p class="hint">В среднем с ' + MES_GEN[parseInt(pace.from.slice(5), 10) - 1].replace(/я$/, 'я') + ': <b class="num">' + eur(pace.avg) + '</b> в месяц' + (restAvg >= 0 ? ', запас ' + eur(restAvg) : ', <i class="red">выше предела ' + eur(kv) + '</i>') + '. Касса обычно смотрит на среднюю прибыль за год.</p>' : '<p class="hint">Предел не задан: «Ещё» → «Настройки».</p>') +
      '<h3>Kleinunternehmer · оборот ' + yr + '</h3>' + (ku ? '<p class="lim">Оборот <b class="num">' + eur(ums) + '</b>, до порога ещё <b class="num">' + eur(Math.max(0, ku - ums)) + '</b></p>' + m2.html : '<p class="hint">Порог не задан.</p>') + '</div>';
    h += '<div class="choices"><a class="choice" href="#guide"><span><b>Справочник</b><span class="sub">как оплатить, принять оплату, перевести между счетами</span></span></a></div>';
    if (!reqOk()) h += '<div class="banner">Для выставления счетов заполните реквизиты: «Ещё» → «Настройки».</div>';
    if (!S.entries.length && !S.invoices.length && S.mode === 'sync') h += '<div class="card"><h3>Перенос из старой версии</h3><p class="hint">«Ещё» → «Резервная копия» → «Восстановление» и выберите файл переноса.</p></div>';
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
