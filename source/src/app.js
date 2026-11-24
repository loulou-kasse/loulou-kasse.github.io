(function () {
  'use strict';
  var C = window.Core;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var eur = function (c) { return C.fmtMoney(c) + ' €'; };
  var newId = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var CLIENT = newId('c');
  var LS = 'loulou-kasse-v1';
  var MEMO = 'https://claude.ai/artifact/BJHbk2TqtaMRzend33zjaa';

  var S = { entries: [], invoices: [], settings: {}, bank: { statements: {} }, mode: 'boot', note: '' };
  var db = null, dl = null, mcp = null;
  var view = 'guide', dirty = false, month = 'all';
  var g = { step: 0, sit: null, opt: null, vals: {} };

  var TYPE_RU = { einnahme: 'Выручка', ausgabe: 'Расход', entnahme: 'Изъятие', einlage: 'Вклад' };
  var WAY_RU = { G: 'Рабочий счёт', P: 'Личный счёт владелицы', E: 'Счёт супруга', B: 'Наличные' };
  var LOGO_PDF = 'data:image/jpeg;base64,/*LOGO_PDF*/';
  var FONT_R = '/*FONT_R*/', FONT_B = '/*FONT_B*/', FONT = 'LiberationSans';
  var addr = function (s) { return [s.strasse, s.ort].filter(Boolean).join(', '); };
  var WAYS_FOR = { einnahme: ['G', 'B'], ausgabe: ['G', 'P', 'E', 'B'], entnahme: ['G'], einlage: ['G'] };

  /* ---------- справочник ---------- */
  var FIELDS = {
    nr: ['Номер счёта клиенту', 'text'], renr: ['Номер счёта поставщика', 'text'], datum: ['Дата', 'date'],
    betrag: ['Сумма, EUR', 'text'], haendler: ['Продавец', 'text'], zweck: ['Заказ / назначение', 'text'],
    monat: ['Месяц', 'text'], n: ['Количество чеков', 'text'], zeitraum: ['Период', 'text']
  };
  var GUIDE = [
    { key: 'pay', title: 'Оплата расходов', sub: 'материалы, транспорт, счета поставщиков', opts: [
      { title: 'Рабочий счёт или карта', sub: 'основной способ', level: 'ok', code: 'G',
        steps: ['Получить чек или счёт на имя владелицы.', 'Указать на чеке назначение покупки.', 'Сохранить фотографию чека в папке месяца.'],
        texts: [['Назначение платежа поставщику', 'Rechnung Nr. {renr} vom {datum}'], ['Rechnungsadresse для онлайн-заказа', '{inh}, {firma}, {adresse}'], ['Отметка на чеке', '{zweck}']],
        journal: { type: 'ausgabe', way: 'G' } },
      { title: 'Личный счёт владелицы', sub: 'Revolut', level: 'warn', code: 'P',
        steps: ['Получить чек или счёт на имя владелицы.', 'Указать на чеке способ оплаты.', 'Приложить подтверждение операции из Revolut.', 'Возмещение с рабочего счёта — по желанию, строго на сумму чека.'],
        texts: [['Отметка на чеке', 'privat bezahlt, Revolut {inhkurz}, {datum}'], ['Назначение при возмещении', 'Erstattung Auslage, Beleg {haendler} {datum}, {betrag} EUR']],
        journal: { type: 'ausgabe', way: 'P' } },
      { title: 'Счёт супруга', sub: 'оплата за предприятие', level: 'warn', code: 'E',
        steps: ['Счёт, договор и учётная запись магазина оформляются на владелицу.', 'В назначении указать, что оплата производится за неё.', 'Чек и строку выписки супруга приложить к документам предприятия.', 'Сумма возмещения рассчитывается в разделе «Прочее».'],
        texts: [['Назначение платежа', 'Zahlung für {inh}, {firma}, Rechnung Nr. {renr} vom {datum}'], ['Отметка на чеке при оплате картой', 'bezahlt von {mann} (Ehemann) für {firma}, {datum}'], ['Rechnungsadresse', '{inh}, {firma}, {adresse}']],
        journal: { type: 'ausgabe', way: 'E' } },
      { title: 'Наличные', sub: 'оплата из личных средств', level: 'warn', code: 'B',
        steps: ['Получить чек.', 'Указать на чеке оплату наличными.', 'Наличные считаются личными средствами: в журнале это расход со способом «наличные».'],
        texts: [['Отметка на чеке', 'bar privat bezahlt, {datum}']],
        journal: { type: 'ausgabe', way: 'B' } },
      { title: 'Личная покупка рабочей картой', sub: 'не является расходом предприятия', level: 'warn', code: 'G',
        steps: ['Допускается в виде исключения.', 'Чек сохранить с отметкой.', 'В расходы не включается: в журнале это изъятие.'],
        texts: [['Отметка на чеке', 'privat — Privatentnahme']],
        journal: { type: 'entnahme', way: 'G' } },
      { title: 'Постоянный договор со счёта супруга', sub: 'аренда, связь, подписки', level: 'stop',
        steps: ['Со счёта супруга не оплачивается.', 'Договор переоформляется на владелицу.', 'Списание настраивается с рабочего счёта.'], texts: [] }
    ] },
    { key: 'get', title: 'Поступления от клиентов', sub: 'перевод, наличные, предоплата', opts: [
      { title: 'Перевод на рабочий счёт', sub: 'основной способ', level: 'ok',
        steps: ['Выставить счёт в разделе «Счета».', 'После поступления денег отметить счёт оплаченным — запись в журнале создаётся автоматически.'],
        texts: [['Строка в счёте', 'Verwendungszweck: {nr}']], go: 'invoices' },
      { title: 'Предоплата', sub: 'Vorauszahlungsrechnung', level: 'ok',
        steps: ['Выставить Vorauszahlungsrechnung в разделе «Счета».', 'Предоплата признаётся выручкой в день поступления.'],
        texts: [['Строка в счёте', 'Verwendungszweck: {nr}']], go: 'invoices' },
      { title: 'Наличные', sub: 'оплата на месте', level: 'warn',
        steps: ['Выставить счёт в разделе «Счета» с отметкой об оплате наличными.', 'Запись в журнале создаётся автоматически, клиент получает PDF.'],
        texts: [['Отметка на бумажном счёте', 'Betrag am {datum} bar erhalten. {inhkurz}']], go: 'invoices' },
      { title: 'Поступление на личный счёт', sub: 'клиент указал не тот счёт', level: 'warn',
        steps: ['В тот же день перевести сумму на рабочий счёт.', 'Сохранить строку выписки личного счёта.', 'Отметить счёт оплаченным переводом.'],
        texts: [['Назначение перевода на рабочий счёт', 'Weiterleitung Kundenzahlung Rechnung {nr}, Eingang Privatkonto {datum}']], go: 'invoices' },
      { title: 'Возврат клиенту', sub: 'отмена заказа', level: 'ok',
        steps: ['Возврат производится с рабочего счёта.', 'Счёт отменяется в разделе «Счета» — в журнале создаётся отменяющая запись.'],
        texts: [['Назначение платежа', 'Rückzahlung Rechnung {nr}']], go: 'invoices' },
      { title: 'Поступление на счёт супруга', sub: 'не допускается', level: 'stop',
        steps: ['Оплаты клиентов на счёт супруга не принимаются.', 'Клиенту сообщается IBAN рабочего счёта.', 'Если поступление уже состоялось — немедленно перевести на рабочий счёт и сообщить бератору.'], texts: [] }
    ] },
    { key: 'move', title: 'Переводы между счетами', sub: 'изъятие, вклад, возмещение', opts: [
      { title: 'Рабочий → личный счёт владелицы', sub: 'Privatentnahme', level: 'ok',
        steps: ['Сумма не ограничена, обоснование не требуется.', 'Рекомендуется 1–2 перевода в месяц.'],
        texts: [['Назначение платежа', 'Privatentnahme {monat}']], journal: { type: 'entnahme', way: 'G' } },
      { title: 'Личный счёт владелицы → рабочий', sub: 'Privateinlage', level: 'ok',
        steps: ['Без слова Privateinlage поступление может быть принято за выручку.'],
        texts: [['Назначение платежа', 'Privateinlage {inh} {datum}']], journal: { type: 'einlage', way: 'G' } },
      { title: 'Счёт супруга → рабочий', sub: 'Privateinlage', level: 'ok',
        steps: ['Займом не является: договор и график возврата не требуются.'],
        texts: [['Назначение платежа', 'Privateinlage Ehemann {mannvoll} für {inh}']], journal: { type: 'einlage', way: 'G' } },
      { title: 'Рабочий → счёт супруга', sub: 'Privatentnahme', level: 'ok',
        steps: ['В назначении не используются слова Lohn, Honorar, «für Hilfe».'],
        texts: [['Назначение платежа', 'Privatentnahme {inh}, Überweisung an Ehemann']], journal: { type: 'entnahme', way: 'G' } },
      { title: 'Рабочий → счёт супруга', sub: 'возмещение расходов', level: 'warn',
        steps: ['Сумма равна итогу чеков с точностью до цента.', 'Итог и формулировка рассчитываются в разделе «Прочее».'],
        texts: [['Назначение платежа', 'Erstattung Auslagen {mann}, {n} Belege {zeitraum} lt. Aufstellung']], go: 'more' },
      { title: 'Взнос наличной выручки', sub: 'на рабочий счёт', level: 'ok',
        steps: ['Вносится точная сумма по счетам, без округления.', 'Выручка уже учтена в день получения, поэтому в журнале взнос отражается как вклад.'],
        texts: [['Назначение платежа', 'Bareinnahmen Rechnungen {nr}']], journal: { type: 'einlage', way: 'G' } },
      { title: 'Снятие наличных', sub: 'с рабочей карты', level: 'ok',
        steps: ['Назначение не указывается.', 'В расходы не включается: в журнале это изъятие.'],
        texts: [['Текст записи в журнале', 'Privatentnahme bar']], journal: { type: 'entnahme', way: 'G' } }
    ] }
  ];
  var LEVEL = { ok: 'Допустимо', warn: 'Требуется отметка', stop: 'Недопустимо' };

  function autoVals() {
    var s = S.settings, inh = s.inh || '';
    var parts = inh.trim().split(/\s+/);
    return { inh: inh, inhkurz: parts.length > 1 ? parts[0][0] + '. ' + parts.slice(1).join(' ') : inh,
      firma: s.firma || '', adresse: addr(s), mann: s.mann || '', mannvoll: s.mannvoll || '' };
  }
  function guideVals() {
    var d = new Date(), v = autoVals();
    v.datum = C.deDate(today()); v.monat = MONATE[d.getMonth()] + ' ' + d.getFullYear();
    Object.keys(g.vals).forEach(function (k) { if (g.vals[k]) v[k] = k === 'datum' ? C.deDate(g.vals[k]) : g.vals[k]; });
    return v;
  }

  /* ---------- хранилище ---------- */
  function saveLocal() { try { localStorage.setItem(LS, JSON.stringify({ entries: S.entries, invoices: S.invoices, settings: S.settings, bank: S.bank })); } catch (e) {} }
  function localMode(note) {
    S.mode = 'local'; S.note = note || '';
    try { var d = JSON.parse(localStorage.getItem(LS) || 'null'); if (d) { S.entries = d.entries || []; S.invoices = d.invoices || []; S.settings = d.settings || {}; S.bank = d.bank || { statements: {} }; } } catch (e) {}
    refresh(true);
  }
  function dbErr(e) {
    var code = e && e.code, m = e && e.message ? e.message : String(e);
    if (code === 'invalid_argument') return 'Запись отклонена: нет прав на изменение данных или неверные данные.';
    if (code === 'quota_exceeded') return 'Хранилище заполнено. Сохраните копию и сообщите об этом.';
    if (code === 'revoked' || code === 'not_granted') return 'Доступ к данным закрыт. Откройте приложение заново.';
    return 'Не удалось сохранить: ' + m;
  }
  function clean(o) { var r = {}; Object.keys(o).forEach(function (k) { if (o[k] !== undefined && k !== 'id') r[k] = o[k]; }); return r; }
  function upsert(arr, key, obj) { var i = arr.findIndex(function (x) { return x[key] === obj[key]; }); if (i >= 0) arr[i] = obj; else arr.push(obj); }
  function putEntry(e) {
    if (!C.validEntry(e)) return Promise.reject({ message: 'запись не прошла проверку' });
    if (db) return db.doc('entries/' + e.id).set(clean(e));
    upsert(S.entries, 'id', e); saveLocal(); refresh(); return Promise.resolve();
  }
  function patchEntry(id, patch) {
    if (db) return db.doc('entries/' + id).update(patch);
    var e = S.entries.find(function (x) { return x.id === id; }); if (e) Object.assign(e, patch); saveLocal(); refresh(); return Promise.resolve();
  }
  function putInvoice(iv) {
    if (db) return db.doc('invoices/' + iv.no).set(clean(iv));
    upsert(S.invoices, 'no', iv); saveLocal(); refresh(); return Promise.resolve();
  }
  function putSettings(s) { if (db) return db.doc('meta/settings').set(s); S.settings = s; saveLocal(); refresh(true); return Promise.resolve(); }
  function putBank(b) { if (db) return db.doc('meta/bank').set(b); S.bank = b; saveLocal(); refresh(); return Promise.resolve(); }

  function claimNo(date, wanted) {
    var taken = [];
    function attempt(i) {
      var no = wanted || C.nextInvoiceNo(S.invoices.concat(taken), date, S.settings.lastIssued);
      if (!no) return Promise.reject({ message: 'не удалось определить номер счёта' });
      if (S.invoices.concat(taken).some(function (v) { return v.no === no; })) return Promise.reject({ message: 'номер ' + no + ' уже выдан' });
      if (!db) return Promise.resolve(no);
      if (i >= 6) return Promise.reject({ message: 'не удалось получить свободный номер, повторите попытку' });
      var ref = db.doc('invoices/' + no);
      return ref.acquire({ holder: CLIENT, ttlMs: 8000 }).then(function (r) {
        if (!r || !r.acquired) { if (wanted) throw { message: 'номер ' + no + ' сейчас занят другим устройством' }; taken.push({ no: no }); return attempt(i + 1); }
        return ref.get().then(function (s) {
          var d = s.exists ? s.data() : null;
          if (d && d.no) { if (wanted) throw { message: 'номер ' + no + ' уже выдан' }; taken.push({ no: no }); return attempt(i + 1); }
          return no;
        });
      });
    }
    return attempt(0);
  }

  function boot() {
    route();
    if (!window.claude || typeof window.claude.use !== 'function') { localMode('Окно без синхронизации: данные хранятся только на этом устройстве.'); return; }
    var use = function (n) { return window.claude.use(n).catch(function () { return null; }); };
    use('downloads').then(function (x) { dl = x; });
    use('mcp').then(function (x) { mcp = x; });
    use('db').then(function (x) {
      if (!x) { localMode('Синхронизация сейчас недоступна: данные хранятся только на этом устройстве.'); return; }
      db = x;
      var timer = setTimeout(function () { S.note = 'Данные пока не загрузились. Проверьте интернет — приложение продолжит попытки само.'; drawSync(); }, 10000);
      var got = function (snap) { if (!snap.metadata || !snap.metadata.fromCache) { clearTimeout(timer); S.note = ''; } S.mode = 'sync'; };
      var fail = function (e) { clearTimeout(timer); S.note = dbErr(e); drawSync(); };
      db.collection('entries').onSnapshot(function (q) { S.entries = q.docs.map(function (d) { return Object.assign({}, d.data(), { id: d.id }); }); got(q); refresh(); }, fail);
      db.collection('invoices').onSnapshot(function (q) { S.invoices = q.docs.map(function (d) { return Object.assign({}, d.data()); }).filter(function (v) { return v.no; }); got(q); refresh(); }, fail);
      db.doc('meta/settings').onSnapshot(function (d) { S.settings = d.exists ? Object.assign({}, d.data()) : {}; got(d); refresh(true); }, fail);
      db.doc('meta/bank').onSnapshot(function (d) { var b = d.exists ? d.data() : {}; S.bank = { statements: Object.assign({}, b.statements || {}) }; got(d); refresh(); }, fail);
    });
  }

  /* ---------- общие элементы ---------- */
  var toastT = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3800);
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
    var bg = $('#sheet');
    bg.innerHTML = '<div class="sheet" role="dialog" aria-modal="true"><div class="sheet-bar"><button type="button" class="sheet-x" data-act="sheet-close" aria-label="Закрыть окно">×</button></div><div class="sheet-body">' + html + '</div></div>';
    bg.hidden = false; document.body.classList.add('noscroll'); bg.querySelector('.sheet').scrollTop = 0;
  }
  function closeSheet() { var bg = $('#sheet'); bg.hidden = true; bg.innerHTML = ''; document.body.classList.remove('noscroll'); if (dirty) draw(); }
  function fld(id, label, type, val, extra) {
    return '<label class="f" for="' + id + '">' + esc(label) + '<input id="' + id + '" type="' + (type || 'text') + '" value="' + esc(val == null ? '' : val) + '" ' + (extra || '') + '></label>';
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setErr(msg) { var e = $('#sheet .err'); if (e) e.textContent = msg || ''; }
  function busy(btn, on) { if (btn) btn.disabled = !!on; }

  function drawSync() {
    var el = $('#sync');
    el.className = 'sync ' + (S.mode === 'sync' ? 'on' : S.mode === 'local' ? 'off' : '');
    el.innerHTML = '<i></i>' + esc(S.mode === 'sync' ? 'Синхронизация' : S.mode === 'local' ? 'Локально' : 'Загрузка');
    var b = $('#banner'); b.hidden = !S.note; b.textContent = S.note;
  }

  function route() {
    var h = (location.hash || '#guide').slice(1);
    view = ['guide', 'invoices', 'journal', 'more'].indexOf(h) >= 0 ? h : 'guide';
    draw();
  }
  function refresh(settingsChanged) {
    drawSync();
    if (view === 'guide' && !settingsChanged) return;
    var a = document.activeElement, m = $('#main');
    if (a && m.contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) { dirty = true; return; }
    if (!$('#sheet').hidden && view !== 'guide') { dirty = true; drawMain(); return; }
    drawMain();
  }
  function draw() { drawSync(); drawMain(); document.querySelectorAll('nav.tabs a').forEach(function (a) { if (a.getAttribute('href') === '#' + view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }); }
  function drawMain() { dirty = false; $('#main').innerHTML = ({ guide: vGuide, invoices: vInvoices, journal: vJournal, more: vMore })[view](); }

  /* ---------- вид: справочник ---------- */
  function vGuide() {
    if (g.step === 0) {
      return '<div class="choices big">' + GUIDE.map(function (s, i) { return '<button class="choice" data-act="g-sit" data-i="' + i + '"><span><b>' + esc(s.title) + '</b><span class="sub">' + esc(s.sub) + '</span></span></button>'; }).join('') + '</div>';
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
    if (o.code) h += '<p class="hint">Имя файла чека: <code>' + esc(today()) + '_продавец_сумма_' + o.code + '.jpg</code></p>';
    if (o.journal) h += '<button class="btn pri" data-act="g-journal">Внести в журнал</button>';
    if (o.go) h += '<a class="btn pri" href="#' + o.go + '" style="text-align:center;text-decoration:none">' + (o.go === 'invoices' ? 'Перейти к счетам' : 'Перейти в «Прочее»') + '</a>';
    return h;
  }

  /* ---------- вид: счета ---------- */
  var KINDS = {
    Rechnung: { llabel: 'Leistungsdatum', hint: '', ru: 'обычный счёт' },
    Vorauszahlungsrechnung: { llabel: 'Voraussichtliches Leistungsdatum', hint: 'Diese Rechnung betrifft eine Vorauszahlung für die oben genannte Leistung.', ru: 'предоплата до работ' },
    Anzahlungsrechnung: { llabel: 'Voraussichtliches Leistungsdatum', hint: 'Diese Rechnung betrifft eine Anzahlung für die oben genannte Leistung.\nDie Anzahlung wird in der Schlussrechnung verrechnet.', ru: 'аванс, частичная предоплата' },
    Schlussrechnung: { llabel: 'Leistungsdatum', hint: '', ru: 'итоговый, с вычетом предоплаты' }
  };
  var PREPAY = { Vorauszahlungsrechnung: 'Vorauszahlung', Anzahlungsrechnung: 'Anzahlung' };
  var CATALOG = [
    ['Букеты', [['Blumenstrauß', 'букет'], ['Brautstrauß', 'букет невесты'], ['Anstecker für den Bräutigam', 'бутоньерка'], ['Haarschmuck aus Blumen', 'украшение в причёску'], ['Strauß für Brautjungfern', 'букет подружки невесты']]],
    ['Композиции', [['Blumengesteck', 'цветочная композиция'], ['Tischgesteck', 'настольная композиция'], ['Blumenbox', 'цветы в коробке'], ['Trockenblumengesteck', 'композиция из сухоцветов'], ['Kranz', 'венок']]],
    ['Декорирование', [['Floristische Dekoration der Innenräume', 'оформление внутреннего пространства'], ['Floristische Dekoration des Außenbereichs', 'оформление внешнего пространства'], ['Tischdekoration', 'оформление столов'], ['Dekoration der Trauzeremonie', 'оформление церемонии'], ['Traubogen mit floraler Dekoration', 'свадебная арка'], ['Fotozone', 'фотозона'], ['Ballondekoration', 'оформление шарами'], ['Fahrzeugschmuck', 'украшение автомобиля'], ['Laubhüttendekoration (Sukkot)', 'оформление сукки']]],
    ['Услуги', [['Lieferung', 'доставка'], ['Montage', 'монтаж'], ['Abbau', 'демонтаж'], ['Miete Dekorationselemente', 'аренда декора'], ['Beratung und Konzept', 'консультация и концепция']]]
  ];
  var DUE_NOTES = [
    ['До выполнения', [['vor Beginn der Montage', 0], ['vor Beginn der Leistung', 0], ['vor dem Veranstaltungstermin', 0], ['bei Auftragserteilung', 0]]],
    ['В момент выполнения', [['bei Abholung', 0], ['bei Lieferung', 0], ['bei Übergabe', 0], ['nach Abschluss der Montage', 0]]],
    ['После выполнения', [['sofort ohne Abzug', -1], ['innerhalb von 7 Tagen nach Rechnungsdatum', 7], ['innerhalb von 14 Tagen nach Rechnungsdatum', 14]]]
  ];
  function reqOk() { var s = S.settings; return !!(s.inh && s.strasse && s.ort && s.steuernr && s.iban); }
  function ivName(iv) { return (iv.rcpt || (iv.client && iv.client.name) || '').split(/\n/)[0]; }
  function ivStatus(iv) {
    if (iv.status === 'storniert') return '<span class="pill mute">отменён</span>';
    if (iv.status === 'bezahlt') return '<span class="pill ok">оплачен ' + (iv.paid && iv.paid.way === 'B' ? 'наличными' : 'переводом') + '</span>';
    return '<span class="pill warn">ожидает оплаты</span>';
  }
  function vInvoices() {
    var list = S.invoices.slice().sort(function (a, b) { return a.no < b.no ? 1 : -1; });
    var h = '<div class="row"><h2>Счета</h2><button class="btn pri right" data-act="iv-new">Новый счёт</button></div>';
    if (!reqOk()) h += '<div class="banner">Для выставления счетов заполните реквизиты в разделе «Прочее» → «Настройки».</div>';
    h += '<p class="hint">Следующий номер: <b class="num">' + esc(C.nextInvoiceNo(S.invoices, today(), S.settings.lastIssued)) + '</b>. Выставленный счёт не редактируется, возможна только отмена.</p>';
    h += '<div class="card"><div class="list">' + (list.length ? list.map(function (iv) {
      var acts = '<button class="btn sm" data-act="iv-pdf" data-no="' + esc(iv.no) + '">PDF на устройство</button>' +
        '<button class="btn sm" data-act="iv-drive" data-no="' + esc(iv.no) + '">PDF в Google Drive</button>' +
        '<button class="btn sm" data-act="iv-gdoc" data-no="' + esc(iv.no) + '">Google Doc</button>';
      if (iv.status === 'offen') acts += '<button class="btn sm pri" data-act="iv-pay" data-no="' + esc(iv.no) + '">Отметить оплату</button>';
      if (iv.status !== 'storniert' && !iv.settledBy) acts += '<button class="btn sm ghost" data-act="iv-storno" data-no="' + esc(iv.no) + '">Отменить</button>';
      var extra = iv.settledBy ? ' <span class="pill mute">учтена в ' + esc(iv.settledBy) + '</span>' : iv.deductions ? ' <span class="pill mute">полная сумма ' + eur(iv.gross) + '</span>' : '';
      return '<div class="item' + (iv.status === 'storniert' ? ' void' : '') + '"><div class="main"><b>' + esc(iv.no) + ' · ' + esc(ivName(iv)) + '</b><div class="meta">' + esc(iv.title || 'Rechnung') + ' · ' + esc(C.deDate(iv.date)) + ' ' + ivStatus(iv) + extra + '</div><div class="acts">' + acts + '</div></div><div class="amt num">' + eur(iv.total) + '</div></div>';
    }).join('') : '<div class="empty">Счета ещё не выставлялись.</div>') + '</div></div>';
    return h;
  }
  function catSelect(i) {
    return '<select class="tpl" data-it="tpl" id="it-s-' + i + '" aria-label="Выбрать позицию из списка"><option value="">Выбрать из списка…</option>' +
      CATALOG.map(function (g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[0]) + ' — ' + esc(o[1]) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>';
  }
  function itemRow(i) {
    return '<div class="itemwrap" data-wrap>' + catSelect(i) + '<div class="lineitem" data-row><textarea aria-label="Beschreibung" placeholder="Beschreibung" data-it="text" id="it-t-' + i + '" rows="2"></textarea><input aria-label="Menge" placeholder="Menge" data-it="qty" value="1" inputmode="decimal" id="it-q-' + i + '"><input aria-label="Einzelpreis" placeholder="Preis" data-it="price" inputmode="decimal" id="it-p-' + i + '"><button type="button" data-act="it-del" aria-label="Удалить позицию">×</button></div></div>';
  }
  function dueSelect() {
    return '<label class="f" for="iv-duesel">Пояснение к сроку<select id="iv-duesel"><option value="">без пояснения</option>' +
      DUE_NOTES.map(function (g) { return '<optgroup label="' + esc(g[0]) + '">' + g[1].map(function (o) { return '<option value="' + esc(o[0]) + '" data-days="' + o[1] + '">' + esc(o[0]) + '</option>'; }).join('') + '</optgroup>'; }).join('') +
      '<option value="__own">Свой вариант…</option></select></label>';
  }
  function prepayCandidates() {
    return S.invoices.filter(function (v) { return PREPAY[v.title] && v.status === 'bezahlt' && !v.settledBy; })
      .sort(function (a, b) { return a.no < b.no ? 1 : -1; });
  }
  function readDeductions() {
    var out = [];
    document.querySelectorAll('#iv-prepay input[type=checkbox]:checked').forEach(function (cb) {
      var v = findIv(cb.value); if (v) out.push({ no: v.no, date: v.date, kind: PREPAY[v.title], amount: v.total });
    });
    return out;
  }
  function dedLabel(dd) { return 'abzüglich ' + dd.kind + ' lt. Rechnung ' + dd.no + ' vom ' + C.deDate(dd.date); }
  var rowN = 0;
  function sheetInvoice() {
    rowN = 0;
    var k = 'Rechnung', no = C.nextInvoiceNo(S.invoices, today(), S.settings.lastIssued);
    openSheet('<h2>Новый счёт</h2>' +
      '<div class="row"><label class="f" for="iv-kind">Вид документа<select id="iv-kind">' + Object.keys(KINDS).map(function (x) { return '<option value="' + x + '">' + x + ' — ' + KINDS[x].ru + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="row">' + fld('iv-title', 'Заголовок в счёте', 'text', k, 'data-auto="1"') + '</div>' +
      '<div id="iv-prepay" class="card" hidden></div>' +
      '<div class="row">' + fld('iv-no', 'Rechnungsnummer', 'text', no, 'inputmode="numeric" data-auto="1"') + fld('iv-date', 'Rechnungsdatum', 'date', today()) + '</div>' +
      '<label class="f" for="iv-rcpt">Rechnung an (получатель, построчно)<textarea id="iv-rcpt" placeholder="Name&#10;Firma&#10;Straße Nr.&#10;PLZ Ort"></textarea></label>' +
      '<div class="row">' + fld('iv-llabel', 'Подпись даты услуги', 'text', KINDS[k].llabel, 'data-auto="1"') + fld('iv-ldate', 'Дата услуги', 'date', today()) + '</div>' +
      '<h3>Positionen</h3><div id="iv-items" style="display:flex;flex-direction:column;gap:6px">' + itemRow(rowN++) + '</div>' +
      '<div class="row"><button type="button" class="btn sm" data-act="it-add">Добавить позицию</button><span class="right total num" id="iv-total">0,00 €</span></div>' +
      '<div id="iv-sums" class="sums" hidden></div>' +
      '<div class="row">' + fld('iv-due', 'Zahlbar bis', 'date', '') + dueSelect() + '</div>' +
      '<div id="iv-ownwrap" hidden>' + fld('iv-duenote', 'Своё пояснение', 'text', '', 'placeholder="z. B. vor dem 20.12.2026"') + '</div>' +
      '<label class="f" for="iv-hint">Hinweise (дополнительные строки под суммой)<textarea id="iv-hint" data-auto="1"></textarea></label>' +
      fld('iv-close', 'Заключительная строка', 'text', 'Vielen Dank für Ihren Auftrag!') +
      '<label class="f" for="iv-pay">Оплата<select id="iv-pay"><option value="offen">Перевод — ожидается</option><option value="B">Оплачено наличными</option><option value="G">Оплачено переводом — средства поступили</option></select></label>' +
      '<p class="hint">Строка «Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.» добавляется всегда. Текст счёта — латиницей.</p>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="iv-issue">Выставить счёт</button></div>');
  }
  function setAuto(id, v) { var el = document.getElementById(id); if (el && el.dataset.auto === '1') el.value = v; }
  function kindChanged() {
    var k = val('iv-kind'); setAuto('iv-title', k); setAuto('iv-llabel', KINDS[k].llabel); setAuto('iv-hint', KINDS[k].hint);
    var box = document.getElementById('iv-prepay');
    if (k === 'Schlussrechnung') {
      var c = prepayCandidates();
      box.innerHTML = '<h3>Вычесть оплаченные предоплаты</h3>' + (c.length ? c.map(function (v) {
        return '<label class="chk"><input type="checkbox" value="' + esc(v.no) + '"><span><b>' + esc(v.no) + '</b> · ' + esc(ivName(v)) + ' · ' + eur(v.total) + '<br><span class="hint">' + esc(v.title) + ', оплачена ' + esc(C.deDate(v.paid && v.paid.date)) + '</span></span></label>';
      }).join('') : '<p class="hint">Нет оплаченных счетов на предоплату, которые ещё не учтены в итоговом счёте.</p>');
      box.hidden = false;
    } else { box.hidden = true; box.innerHTML = ''; }
    updTotal();
  }
  function dueChanged() {
    var sel = document.getElementById('iv-duesel'), opt = sel.options[sel.selectedIndex], days = parseInt(opt && opt.dataset.days, 10);
    document.getElementById('iv-ownwrap').hidden = sel.value !== '__own';
    if (sel.value === '__own') document.getElementById('iv-duenote').focus();
    var date = val('iv-date');
    if (date && days === -1) document.getElementById('iv-due').value = date;
    else if (date && days > 0) document.getElementById('iv-due').value = C.addDays(date, days);
  }
  function dueNoteVal() { var v = val('iv-duesel'); return v === '__own' ? val('iv-duenote') : v; }
  function readItems() {
    var rows = [], bad = null;
    document.querySelectorAll('#iv-items [data-row]').forEach(function (r) {
      var t = $('[data-it=text]', r).value.trim().replace(/\s*\n\s*/g, ' ').replace(/^[«»„“”"']+|[«»„“”"']+$/g, '').trim(), q = $('[data-it=qty]', r).value, p = $('[data-it=price]', r).value;
      if (!t && !p.trim()) return;
      var qty = C.parseQty(q), price = C.parseMoney(p);
      if (!t) bad = 'У позиции отсутствует описание.'; else if (qty == null) bad = 'Количество «' + q + '» не является числом.'; else if (price == null || price <= 0) bad = 'Цена «' + p + '» не является суммой.';
      rows.push({ text: t, qty: qty, price: price });
    });
    return { rows: rows, bad: bad };
  }
  function updTotal() {
    var r = readItems(), ok = r.rows.filter(function (x) { return x.qty && x.price > 0; });
    var el = $('#iv-total'); if (el) el.textContent = eur(C.invoiceTotal(ok));
    var box = document.getElementById('iv-sums'); if (!box) return;
    if (val('iv-kind') !== 'Schlussrechnung') { box.hidden = true; return; }
    var dd = readDeductions(), t = C.schlussTotals(ok, dd);
    box.innerHTML = '<div class="row"><span>Gesamtbetrag der Leistung</span><span class="right num">' + eur(t.gross) + '</span></div>' +
      dd.map(function (x) { return '<div class="row"><span>' + esc(dedLabel(x)) + '</span><span class="right num">−' + eur(x.amount) + '</span></div>'; }).join('') +
      '<div class="row strong"><span>Restbetrag</span><span class="right num">' + eur(t.rest) + '</span></div>' +
      (t.ok ? '' : '<p class="err">Предоплата больше стоимости работ: проверьте позиции.</p>');
    box.hidden = false;
  }
  function issueInvoice(btn) {
    var rcpt = (document.getElementById('iv-rcpt').value || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean).join('\n');
    var date = val('iv-date'), ldate = val('iv-ldate'), pay = val('iv-pay'), no = val('iv-no'), title = val('iv-title'), llabel = val('iv-llabel');
    var hint = (document.getElementById('iv-hint').value || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!reqOk()) return setErr('Заполните реквизиты в настройках: имя, адрес, Steuernummer, IBAN.');
    if (!title) return setErr('Укажите заголовок документа.');
    if (!rcpt) return setErr('Укажите получателя.');
    if (!date || !ldate) return setErr('Укажите дату счёта и дату услуги.');
    if (!/^\d{9}$/.test(no)) return setErr('Номер счёта состоит из 9 цифр: год, месяц и порядковый номер, например 202611002.');
    if (no.slice(0, 6) !== date.slice(0, 7).replace('-', '')) return setErr('Первые шесть цифр номера должны соответствовать году и месяцу даты счёта.');
    var it = readItems();
    if (it.bad) return setErr(it.bad);
    if (!it.rows.length) return setErr('Добавьте хотя бы одну позицию с ценой.');
    var dueNote = dueNoteVal();
    var all = [title, rcpt, llabel, hint.join(''), dueNote, val('iv-close')].concat(it.rows.map(function (x) { return x.text; })).join('');
    if (C.nonLatin1(all)) return setErr('Текст счёта вводится латиницей: кириллица в PDF не отображается.');
    var schluss = val('iv-kind') === 'Schlussrechnung', ded = schluss ? readDeductions() : [], st = C.schlussTotals(it.rows, ded);
    if (schluss && !ded.length) return setErr('Отметьте предоплату, которую нужно вычесть.');
    if (!st.ok) return setErr('Предоплата больше стоимости работ: проверьте позиции.');
    var total = st.rest;
    if (schluss ? total < 0 : total <= 0) return setErr('Сумма счёта должна быть больше нуля.');
    var expected = C.nextInvoiceNo(S.invoices, date, S.settings.lastIssued);
    setErr(''); busy(btn, true);
    var iv;
    claimNo(date, no === expected ? '' : no).then(function (got) {
      iv = { no: got, title: title, date: date, ldate: ldate, llabel: llabel || 'Leistungsdatum', rcpt: rcpt, client: { name: rcpt.split(/\n/)[0] }, items: it.rows, total: total,
        due: val('iv-due'), dueNote: dueNote, hint: hint, closing: val('iv-close'), status: 'offen', createdAt: new Date().toISOString() };
      if (schluss) { iv.gross = st.gross; iv.deductions = ded; }
      if (schluss && total === 0) { iv.status = 'bezahlt'; iv.paid = { date: date, way: 'G' }; iv.zeroRest = true; }
      return putInvoice(iv);
    }).then(function () {
      var ch = Promise.resolve();
      ded.forEach(function (x) { ch = ch.then(function () { var v = findIv(x.no); return v ? putInvoice(Object.assign({}, v, { settledBy: iv.no })) : null; }); });
      return ch;
    }).then(function () {
      if (pay === 'offen' || iv.zeroRest) return;
      iv.paidAtIssue = true;
      return payInvoice(iv, date, pay);
    }).then(function () { closeSheet(); toast('Счёт ' + iv.no + ' выставлен'); if (!db) refresh(); })
      .catch(function (e) { busy(btn, false); setErr(dbErr(e)); });
  }
  function entryForInvoice(no) {
    var st = C.stornoedIds(S.entries);
    return S.entries.find(function (e) { return e.invoiceNo === no && !e.stornoOf && !st[e.id]; });
  }
  function payInvoice(iv, date, way) {
    var ex = entryForInvoice(iv.no);
    var e = ex || { id: newId('e'), date: date, type: 'einnahme', way: way, amount: iv.total, party: ivName(iv), text: (iv.title || 'Rechnung') + ' ' + iv.no, doc: iv.no, invoiceNo: iv.no, createdAt: new Date().toISOString() };
    return (ex ? Promise.resolve() : putEntry(e)).then(function () {
      return putInvoice(Object.assign({}, iv, { status: 'bezahlt', paid: { date: e.date, way: e.way }, entryId: e.id }));
    });
  }
  function findIv(no) { return S.invoices.find(function (x) { return x.no === no; }); }
  function sheetPay(no) {
    var iv = findIv(no); if (!iv) return;
    openSheet('<h2>Оплата счёта ' + esc(no) + '</h2><p class="hint">Сумма ' + eur(iv.total) + '. В журнале будет создана запись выручки.</p><div class="row">' + fld('pay-date', 'Дата поступления', 'date', today()) +
      '<label class="f" for="pay-way">Способ оплаты<select id="pay-way"><option value="G">Перевод на рабочий счёт</option><option value="B">Наличные</option></select></label></div>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="pay-ok" data-no="' + esc(no) + '">Отметить оплаченным</button></div>');
  }
  function sheetStornoIv(no) {
    var iv = findIv(no); if (!iv) return;
    openSheet('<h2>Отмена счёта ' + esc(no) + '</h2><p class="hint">Номер остаётся занятым, счёт помечается как отменённый.' + (iv.status === 'bezahlt' && !iv.zeroRest ? ' В журнале будет создана отменяющая запись на ' + eur(iv.total) + '.' : '') + (iv.settledBy ? ' Внимание: эта предоплата уже вычтена в итоговом счёте ' + esc(iv.settledBy) + ' — сначала отмените его.' : '') + (iv.deductions ? ' Предоплаты снова станут доступны для вычета.' : '') + ' Действие необратимо.</p>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Назад</button><button class="btn pri right" data-act="ivst-ok" data-no="' + esc(no) + '">Отменить счёт</button></div>');
  }
  function stornoInvoice(no, btn) {
    var iv = findIv(no), e = entryForInvoice(no); busy(btn, true);
    (e ? putEntry(C.makeStorno(e, newId('e'), today(), new Date().toISOString())) : Promise.resolve())
      .then(function () { return putInvoice(Object.assign({}, iv, { status: 'storniert', stornoAt: today() })); })
      .then(function () {
        var ch = Promise.resolve();
        (iv.deductions || []).forEach(function (x) { ch = ch.then(function () { var v = findIv(x.no); if (!v || v.settledBy !== iv.no) return null; var c2 = Object.assign({}, v); delete c2.settledBy; return putInvoice(c2); }); });
        return ch;
      })
      .then(function () { closeSheet(); toast('Счёт отменён'); if (!db) refresh(); })
      .catch(function (er) { busy(btn, false); setErr(dbErr(er)); });
  }

  /* ---------- PDF и файлы: бланк по образцу LOU LOU ----------
     Все координаты в пунктах (pt) сняты с образца Vorauszahlungsrechnung_202611001_Bloom.pdf:
     шрифт Liberation Sans 8,51 pt, шаг строки 12,746 pt, правый край 495,17 pt. */
  var FS = 8.51, LH = 12.746, XL = 44.02, XR = 495.17;
  function pdfDoc() {
    if (!window.jspdf || !window.jspdf.jsPDF) throw { message: 'модуль PDF не загрузился, проверьте подключение' };
    var d = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    d.addFileToVFS('LiberationSans-Regular.ttf', FONT_R); d.addFont('LiberationSans-Regular.ttf', FONT, 'normal');
    d.addFileToVFS('LiberationSans-Bold.ttf', FONT_B); d.addFont('LiberationSans-Bold.ttf', FONT, 'bold');
    d.setFont(FONT, 'normal'); d.setFontSize(FS); d.setTextColor(0, 0, 0);
    return d;
  }
  function pdfHead(d) {
    var s = S.settings, y = 82.09;
    try { d.addImage(LOGO_PDF, 'JPEG', 43.18, 71.97, 81.56, 101.94); } catch (e) {}
    d.setFontSize(FS);
    [[s.inh, 1], [s.firma, 1], [s.strasse], [s.ort], [s.tel ? 'Tel.: ' + s.tel : ''], [s.email], [s.steuernr ? 'Steuernummer: ' + s.steuernr : ''],
      [[s.bank, s.bic ? 'BIC: ' + s.bic : ''].filter(Boolean).join(' · ')], [s.iban ? 'IBAN: ' + s.iban : '']].forEach(function (l) {
      if (!l[0]) return;
      d.setFont(FONT, l[1] ? 'bold' : 'normal'); d.text(String(l[0]), XR, y, { align: 'right' }); y += LH;
    });
  }
  function payLines(iv) {
    if (iv.zeroRest) return [['Der Rechnungsbetrag ist durch die Vorauszahlung vollständig beglichen.']];
    if (iv.paidAtIssue && iv.paid) return [[iv.paid.way === 'B' ? 'Betrag am ' + C.deDate(iv.paid.date) + ' dankend bar erhalten.' : 'Betrag am ' + C.deDate(iv.paid.date) + ' per Überweisung erhalten.', 1]];
    var l = [];
    if (iv.due) l.push(['Zahlbar bis ' + C.deDate(iv.due) + (iv.dueNote ? ' (' + iv.dueNote + ')' : ''), 1]);
    l.push(['Bitte auf das oben genannte Konto überweisen.']); l.push(['Verwendungszweck: ' + iv.no]);
    return l;
  }
  function noteLines(iv) {
    return [['Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.']].concat((iv.hint || []).map(function (x) { return [x]; })).concat(payLines(iv));
  }
  function invoicePdf(iv) {
    var s = S.settings, d = pdfDoc(), title = iv.title || 'Rechnung', PAGE_BOTTOM = 790;
    d.setProperties({ title: title + ' ' + iv.no, author: s.inh || '' });
    pdfHead(d);
    d.setFont(FONT, 'bold'); d.text('Rechnung an:', XL, 209.55);
    d.setFont(FONT, 'normal');
    var y = 222.3, last = 260.53;
    String(iv.rcpt || ivName(iv)).split(/\n/).forEach(function (l) { d.text(l, XL, y); last = y; y += LH; });
    var dy = Math.max(0, last + 40.96 - 301.49);                       /* смещение, если получатель длиннее 5 строк */
    d.setFont(FONT, 'bold'); d.setFontSize(13.59); d.text(title, XL, 301.49 + dy);
    d.setFontSize(FS);
    d.text('Rechnungsnummer:', XL, 328.07 + dy); d.text(iv.no, 294.02, 328.07 + dy);
    d.setFont(FONT, 'normal');
    d.text('Rechnungsdatum:', XL, 340.82 + dy); d.text(C.deDate(iv.date), 294.02, 340.82 + dy);
    d.text((iv.llabel || 'Leistungsdatum') + ':', XL, 353.56 + dy); d.text(C.deDate(iv.ldate), 294.02, 353.56 + dy);
    /* шапка таблицы */
    var X0 = 43.15, X1 = 495.98;
    function tableHead(top) {
      d.setFillColor(239, 233, 230); d.rect(43.18, top, 452.76, 25.52, 'F');
      d.setDrawColor(153, 153, 153); d.setLineWidth(0.6375); d.line(X0, top + 0.08, X1, top + 0.08);
      d.setFont(FONT, 'bold');
      d.text('Pos.', 50.72, top + 15.78); d.text('Beschreibung', 77.03, top + 15.78); d.text('Menge', 300.94, top + 15.78);
      d.text('Einzelpreis (EUR)', 340.31, top + 15.78); d.text('Gesamt (EUR)', 427.34, top + 15.78);
      d.setDrawColor(0, 0, 0); d.setLineWidth(1.4876); d.line(X0, top + 25.57, X1, top + 25.57);
      d.setFont(FONT, 'normal');
      return top + 25.57;
    }
    var rowTop = tableHead(368.86 + dy), ROWH = 25.49;
    var rows = iv.items.slice(); while (rows.length < 8) rows.push(null);
    rows.forEach(function (it, i) {
      var lines = it ? d.splitTextToSize(it.text, 212) : [], n = Math.max(1, lines.length), LP = 10.2;
      var h = Math.max(ROWH, n * LP + 10);
      if (rowTop + h > PAGE_BOTTOM - 120) { d.addPage(); rowTop = tableHead(60); }
      var bottom = rowTop + h;
      if (it) {
        /* блок описания по центру строки; цифры на одной линии с последней строкой описания */
        var first = rowTop + h / 2 - (n - 1) * LP / 2 + 2.15, base = first + (n - 1) * LP;
        lines.forEach(function (t, k) { d.text(t, 77.03, first + k * LP); });
        d.text(String(i + 1), 59.69, base, { align: 'center' });
        d.text(C.fmtQty(it.qty), 314.42, base, { align: 'center' });
        d.text(C.fmtMoney(it.price), 415.05, base, { align: 'right' });
        d.text(C.fmtMoney(C.lineTotal(it.qty, it.price)), 495.24, base, { align: 'right' });
      }
      var lastRow = i === rows.length - 1;
      if (lastRow) { d.setDrawColor(0, 0, 0); d.setLineWidth(1.4876); }
      else { d.setDrawColor(153, 153, 153); d.setLineWidth(0.6375); }
      d.line(X0, bottom, X1, bottom);
      rowTop = bottom;
    });
    /* итог; у итогового счёта — полная сумма, вычеты и остаток */
    if (iv.deductions && iv.deductions.length) {
      d.setFont(FONT, 'normal'); d.text('Gesamtbetrag der Leistung (EUR)', 414.95, rowTop + 10.12, { align: 'right' }); d.text(C.fmtMoney(iv.gross), 495.24, rowTop + 10.12, { align: 'right' });
      iv.deductions.forEach(function (x) { rowTop += LH; d.text(dedLabel(x), 414.95, rowTop + 10.12, { align: 'right' }); d.text('-' + C.fmtMoney(x.amount), 495.24, rowTop + 10.12, { align: 'right' }); });
      d.setDrawColor(0, 0, 0); d.setLineWidth(0.6375); d.line(427.34, rowTop + 12.75, X1, rowTop + 12.75); rowTop += LH;
      d.setFont(FONT, 'bold'); d.text('Restbetrag (EUR)', 414.95, rowTop + 10.12, { align: 'right' });
    } else {
      d.setFont(FONT, 'bold'); d.text('Rechnungsbetrag (EUR)', 316.75, rowTop + 10.12);
    }
    d.setFontSize(9.3); d.text(C.fmtMoney(iv.total), 495.16, rowTop + 9.93, { align: 'right' }); d.setFontSize(FS);
    d.setDrawColor(0, 0, 0); d.setLineWidth(1.4876); d.line(X0, rowTop + 12.75, X1, rowTop + 12.75);
    y = rowTop + 12.75 + 22.86;
    noteLines(iv).forEach(function (l) {
      d.setFont(FONT, l[1] ? 'bold' : 'normal');
      d.splitTextToSize(l[0], XR - XL).forEach(function (t) { if (y > PAGE_BOTTOM) { d.addPage(); y = 60; } d.text(t, XL, y); y += LH; });
    });
    d.setFont(FONT, 'normal'); y += 25.49;
    if (y + 25.49 > PAGE_BOTTOM) { d.addPage(); y = 60; }
    if (iv.closing) { d.text(iv.closing, XL, y); y += 25.49; }
    d.text(s.inh || '', XL, y);
    if (iv.status === 'storniert') { d.setPage(1); d.setTextColor(170, 40, 40); d.setFont(FONT, 'bold'); d.setFontSize(56); d.text('STORNIERT', 297.6, 450, { align: 'center', angle: 30 }); }
    return d;
  }
  function invoiceHtml(iv) {
    var s = S.settings, e = esc, br = function (t) { return e(t).replace(/\n/g, '<br>'); };
    var head = [s.inh, s.firma, s.strasse, s.ort, s.tel ? 'Tel.: ' + s.tel : '', s.email, s.steuernr ? 'Steuernummer: ' + s.steuernr : '', [s.bank, s.bic ? 'BIC: ' + s.bic : ''].filter(Boolean).join(' · '), s.iban ? 'IBAN: ' + s.iban : ''].filter(Boolean);
    var rows = iv.items.map(function (it, i) { return '<tr><td>' + (i + 1) + '</td><td>' + e(it.text) + '</td><td align="center">' + C.fmtQty(it.qty) + '</td><td align="right">' + C.fmtMoney(it.price) + '</td><td align="right">' + C.fmtMoney(C.lineTotal(it.qty, it.price)) + '</td></tr>'; }).join('');
    return '<html><head><meta charset="utf-8"></head><body style="font-family:Arial;font-size:10pt">' + (iv.status === 'storniert' ? '<h1 style="color:#a22">STORNIERT</h1>' : '') +
      '<p align="right"><b>' + e(head[0] || '') + '<br>' + e(head[1] || '') + '</b><br>' + head.slice(2).map(e).join('<br>') + '</p>' +
      '<p><b>Rechnung an:</b><br>' + br(iv.rcpt || ivName(iv)) + '</p><h2>' + e(iv.title || 'Rechnung') + '</h2>' +
      '<p><b>Rechnungsnummer: ' + e(iv.no) + '</b><br>Rechnungsdatum: ' + C.deDate(iv.date) + '<br>' + e(iv.llabel || 'Leistungsdatum') + ': ' + C.deDate(iv.ldate) + '</p>' +
      '<table border="1" cellpadding="4" cellspacing="0" width="100%"><tr><th>Pos.</th><th align="left">Beschreibung</th><th>Menge</th><th>Einzelpreis (EUR)</th><th>Gesamt (EUR)</th></tr>' + rows +
      (iv.deductions && iv.deductions.length ? '<tr><td colspan="4" align="right">Gesamtbetrag der Leistung (EUR)</td><td align="right">' + C.fmtMoney(iv.gross) + '</td></tr>' + iv.deductions.map(function (x) { return '<tr><td colspan="4" align="right">' + e(dedLabel(x)) + '</td><td align="right">-' + C.fmtMoney(x.amount) + '</td></tr>'; }).join('') + '<tr><td colspan="4" align="right"><b>Restbetrag (EUR)</b></td><td align="right"><b>' + C.fmtMoney(iv.total) + '</b></td></tr>'
        : '<tr><td colspan="4" align="right"><b>Rechnungsbetrag (EUR)</b></td><td align="right"><b>' + C.fmtMoney(iv.total) + '</b></td></tr>') + '</table>' +
      '<p>' + noteLines(iv).map(function (l) { return l[1] ? '<b>' + e(l[0]) + '</b>' : e(l[0]); }).join('<br>') + '</p>' + (iv.closing ? '<p>' + e(iv.closing) + '</p>' : '') + '<p>' + e(s.inh || '') + '</p></body></html>';
  }
  function saveFile(filename, data) {
    if (!dl) { toast('Сохранение файлов недоступно в этом окне. Откройте приложение в Claude.'); return; }
    dl.save({ filename: filename, data: data }).then(function () { toast('Файл передан на сохранение'); }, function (e) {
      var c = e && e.code;
      toast(c === 'declined' ? 'Сохранение отменено' : c === 'rate_limited' ? 'Запрос на сохранение уже открыт' : 'Не удалось сохранить файл' + (e && e.message ? ': ' + e.message : ''));
    });
  }
  function driveSave(args, what) {
    if (!mcp) { toast('Google Drive недоступен в этом окне. Откройте приложение в Claude.'); return; }
    toast('Отправка в Google Drive…');
    mcp.callTool('Google Drive', 'create_file', args, { cache: false }).then(function () { toast(what + ' создан в Google Drive' + (DRIVE_PATH[args.parentId] ? ': ' + DRIVE_PATH[args.parentId] : '')); }, function (e) {
      var c = e && e.code;
      if (c === 'needs_reauth') toast('Переподключите Google Drive: Claude → Настройки → Connectors');
      else if (c === 'server_not_connected' || c === 'selection_required') toast('Подключите Google Drive: Claude → Настройки → Connectors');
      else if (c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required' || c === 'blocked_by_policy') toast('Нет разрешения на Google Drive для этого приложения');
      else if (c === 'tool_error') toast('Google Drive отклонил файл' + (args.parentId ? ' (проверьте, что папка ' + (DRIVE_PATH[args.parentId] || '').split(' › ').pop() + ' не удалена и не перемещена в корзину)' : '') + (e.message ? ': ' + String(e.message).slice(0, 120) : ''));
      else toast('Ответ не получен. Файл мог быть создан — проверьте Google Drive перед повтором.');
    });
  }
  // Google Drive: Мой диск › Violeta Larina Dokumente › Rechnungen
  var DRIVE_RECHNUNGEN = '1dnU_sH4_htAFJDYVg5qKmmblLX4wroOR';
  // Google Drive: Мой диск › Violeta Larina Dokumente › Eigenbelege
  var DRIVE_EIGENBELEGE = '1GRaZvdai2-7sp4VTBFmkA_z8-Bozjthg';
  var DRIVE_PATH = {}; DRIVE_PATH[DRIVE_RECHNUNGEN] = 'Violeta Larina Dokumente › Rechnungen'; DRIVE_PATH[DRIVE_EIGENBELEGE] = 'Violeta Larina Dokumente › Eigenbelege';
  function pdfB64(d) { return d.output('datauristring').split(',')[1]; }
  function ivAct(kind, no) {
    var iv = findIv(no); if (!iv) return;
    try {
      var name = (iv.title || 'Rechnung').replace(/[^\w-]+/g, '_') + '_' + iv.no + (iv.status === 'storniert' ? '_STORNIERT' : '');
      if (kind === 'pdf') saveFile(name + '.pdf', invoicePdf(iv).output('blob'));
      else if (kind === 'drive') driveSave({ title: name + '.pdf', parentId: DRIVE_RECHNUNGEN, base64Content: pdfB64(invoicePdf(iv)), contentMimeType: 'application/pdf', disableConversionToGoogleType: true }, 'PDF');
      else driveSave({ title: name, parentId: DRIVE_RECHNUNGEN, textContent: invoiceHtml(iv), contentMimeType: 'text/html' }, 'Google Doc');
    } catch (e) { toast('Не удалось сформировать документ: ' + (e.message || e)); }
  }

  /* ---------- вид: журнал ---------- */
  function shown(e) { return ((e.type === 'einnahme' || e.type === 'einlage') ? 1 : -1) * e.amount; }
  /* список месяцев для выбора: от начала учёта (или первой записи) до текущего месяца */
  function monthList() {
    var first = today().slice(0, 7), last = first;
    if (S.settings.openingDate && S.settings.openingDate.slice(0, 7) < first) first = S.settings.openingDate.slice(0, 7);
    S.entries.forEach(function (e) { if (!C.validEntry(e)) return; var m = e.date.slice(0, 7); if (m < first) first = m; if (m > last) last = m; });
    var out = [], y = parseInt(last.slice(0, 4), 10), mo = parseInt(last.slice(5, 7), 10);
    for (var k = 0; k < 240; k++) {
      var ym = y + '-' + pad(mo); out.push(ym);
      if (ym <= first) break;
      mo--; if (mo === 0) { mo = 12; y--; }
    }
    return out;
  }
  function monthName(ym) { var n = MES[parseInt(ym.slice(5), 10) - 1]; return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + ym.slice(0, 4); }
  function entryRow(e, st) {
    var v = shown(e), isVoid = st[e.id], meta = [C.deDate(e.date), TYPE_RU[e.type], e.party, e.doc ? 'док. ' + e.doc : ''].filter(Boolean).map(esc).join(' · ');
    var act = '';
    if (e.stornoOf) meta += ' · <span class="pill mute">отмена</span>';
    else if (isVoid) meta += ' · <span class="pill mute">отменена</span>';
    else if (e.invoiceNo) meta += ' · по счёту';
    else act = '<div class="acts"><button class="btn sm ghost" data-act="j-storno" data-id="' + esc(e.id) + '">Отменить запись</button></div>';
    return '<div class="item' + (isVoid ? ' void' : '') + '"><div class="main"><b><span class="way" title="' + esc(WAY_RU[e.way]) + '">' + e.way + '</span>' + esc(e.text || TYPE_RU[e.type]) + '</b><div class="meta">' + meta + '</div>' + act + '</div><div class="amt num ' + (v >= 0 ? 'plus' : 'minus') + '">' + (v > 0 ? '+' : '') + eur(v) + '</div></div>';
  }
  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.createdAt) < String(b.createdAt) ? 1 : -1; }
  function tiles(sm) {
    return '<div class="tiles"><div class="tile"><span>Выручка</span><b>' + eur(sm.einnahme) + '</b></div><div class="tile"><span>Расходы</span><b>' + eur(sm.ausgabe) + '</b></div><div class="tile hi"><span>Прибыль</span><b>' + eur(sm.gewinn) + '</b></div>' +
      '<div class="tile"><span>Изъятия</span><b>' + eur(sm.entnahme) + '</b></div><div class="tile"><span>Вклады</span><b>' + eur(sm.einlage) + '</b></div></div>';
  }
  function vJournal() {
    var s = S.settings, st = C.stornoedIds(S.entries), months = monthList(), all = month === 'all';
    if (!all && months.indexOf(month) < 0) months.push(month), months.sort().reverse();
    var idx = months.indexOf(month);
    var sel = '<select id="j-month" aria-label="Период"><option value="all"' + (all ? ' selected' : '') + '>Все месяцы</option>' +
      months.map(function (m) { return '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + monthName(m) + '</option>'; }).join('') + '</select>';
    var h = '<div class="row"><h2>Журнал</h2></div><div class="row">' +
      '<button class="btn sm" data-act="j-prev" aria-label="Предыдущий месяц"' + (all || idx >= months.length - 1 ? ' disabled' : '') + '>‹</button>' +
      '<label class="f" for="j-month" style="flex:1 1 auto"><span class="vh">Период</span>' + sel + '</label>' +
      '<button class="btn sm" data-act="j-next" aria-label="Следующий месяц"' + (all || idx <= 0 ? ' disabled' : '') + '>›</button></div>';
    if (all) {
      var rows = months.slice().reverse().map(function (m) { return { m: m, s: C.sums(S.entries, m) }; });
      var tot = C.sums(S.entries, ''), chk = { einnahme: 0, ausgabe: 0, gewinn: 0 };
      rows.forEach(function (r) { chk.einnahme += r.s.einnahme; chk.ausgabe += r.s.ausgabe; chk.gewinn += r.s.gewinn; });
      var ok = chk.einnahme === tot.einnahme && chk.ausgabe === tot.ausgabe && chk.gewinn === tot.gewinn;
      h += tiles(tot) + '<div class="card"><h3>По месяцам</h3><div style="overflow-x:auto"><table class="mt"><thead><tr><th>Месяц</th><th>Выручка</th><th>Расходы</th><th>Прибыль</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td><button class="lnk" data-act="j-goto" data-m="' + r.m + '">' + monthName(r.m) + '</button></td><td class="num">' + C.fmtMoney(r.s.einnahme) + '</td><td class="num">' + C.fmtMoney(r.s.ausgabe) + '</td><td class="num">' + C.fmtMoney(r.s.gewinn) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td>Итого</td><td class="num">' + C.fmtMoney(tot.einnahme) + '</td><td class="num">' + C.fmtMoney(tot.ausgabe) + '</td><td class="num">' + C.fmtMoney(tot.gewinn) + '</td></tr></tfoot></table></div>' +
        '<p>' + (ok ? '<span class="pill ok">Контроль</span> сумма месяцев равна итогу.' : '<span class="pill stop">Контроль не пройден</span> сумма месяцев не равна итогу: есть запись вне показанных месяцев.') + '</p></div>';
      h += '<div class="row"><button class="btn pri" data-act="j-new">Новая запись</button><button class="btn right" data-act="j-csv">CSV за всё время</button></div>';
      var list = S.entries.filter(C.validEntry).sort(byDateDesc), cur = '', body = '';
      list.forEach(function (e) { var m = e.date.slice(0, 7); if (m !== cur) { cur = m; body += '<h3 style="margin:14px 0 2px">' + monthName(m) + '</h3>'; } body += entryRow(e, st); });
      h += '<div class="card"><div class="list">' + (body || '<div class="empty">Записей пока нет.</div>') + '</div></div>';
    } else {
      var sm = C.sums(S.entries, month), stmt = S.bank.statements[month], rec = C.reconcile(S.entries, s.opening || 0, s.openingDate || '', month, stmt == null ? null : stmt);
      var lst = S.entries.filter(function (e) { return C.validEntry(e) && e.date.indexOf(month) === 0; }).sort(byDateDesc);
      h += tiles(sm) + '<p class="hint">Прибыль = выручка − расходы. Изъятия и вклады на прибыль не влияют.</p>';
      h += '<div class="card"><h3>Сверка с банком</h3><p>Расчётный остаток рабочего счёта на ' + esc(C.deDate(C.lastDayOfMonth(month))) + ': <b class="num">' + eur(rec.computed) + '</b></p>' +
        '<div class="row">' + fld('j-stmt', 'Остаток по выписке банка', 'text', stmt == null ? '' : C.fmtMoney(stmt), 'inputmode="decimal" placeholder="0,00"') + '<button class="btn" data-act="j-rec">Сверить</button></div>';
      if (rec.ok === true) h += '<p><span class="pill ok">Сходится</span> журнал и выписка совпадают до цента.</p>';
      else if (rec.ok === false) h += '<p><span class="pill stop">Расхождение ' + eur(rec.diff) + '</span> ' + (rec.diff > 0 ? 'по выписке больше, чем по журналу: не внесено поступление либо внесено лишнее списание.' : 'по выписке меньше, чем по журналу: не внесено списание либо внесено лишнее поступление.') + '</p>';
      else h += '<p class="hint">Укажите остаток из последней строки выписки за месяц. Учитываются только движения по рабочему счёту, начиная с остатка ' + eur(s.opening || 0) + (s.openingDate ? ' на ' + esc(C.deDate(s.openingDate)) : '') + '.</p>';
      h += '</div><div class="row"><button class="btn pri" data-act="j-new">Новая запись</button><button class="btn right" data-act="j-csv">CSV за месяц</button></div>';
      h += '<div class="card"><div class="list">' + (lst.length ? lst.map(function (e) { return entryRow(e, st); }).join('') : '<div class="empty">За ' + monthName(month).toLowerCase() + ' записей нет.</div>') + '</div></div>';
    }
    h += '<p class="hint">G — рабочий счёт, P — личный счёт владелицы, E — счёт супруга, B — наличные.</p>';
    return h;
  }
  function sheetEntry(pre) {
    pre = pre || {};
    var t = pre.type || 'ausgabe';
    openSheet('<h2>Новая запись</h2><div class="row"><label class="f" for="e-type">Вид операции<select id="e-type">' + C.TYPES.map(function (k) { return '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + TYPE_RU[k] + ' — ' + C.TYPE_DE[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" for="e-way">Счёт<select id="e-way"></select></label></div>' +
      '<div class="row">' + fld('e-date', 'Дата оплаты', 'date', today()) + fld('e-amt', 'Сумма, EUR', 'text', '', 'inputmode="decimal" placeholder="0,00"') + '</div>' +
      fld('e-text', 'Текст', 'text', pre.text || '') + '<div class="row">' + fld('e-party', 'Контрагент', 'text', '') + fld('e-doc', 'Номер документа', 'text', '') + '</div>' +
      '<p class="hint" id="e-note"></p><p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="e-save">Сохранить</button></div>');
    fillWays(pre.way);
  }
  function fillWays(pref) {
    var t = val('e-type'), sel = document.getElementById('e-way'), ws = WAYS_FOR[t];
    var cur = pref && ws.indexOf(pref) >= 0 ? pref : (ws.indexOf(sel.value) >= 0 ? sel.value : ws[0]);
    sel.innerHTML = ws.map(function (w) { return '<option value="' + w + '"' + (w === cur ? ' selected' : '') + '>' + WAY_RU[w] + '</option>'; }).join('');
    sel.disabled = ws.length === 1;
    $('#e-note').textContent = t === 'entnahme' || t === 'einlage' ? 'Движение по рабочему счёту, на прибыль не влияет.' : t === 'einnahme' ? 'Выручка по счёту клиента вносится через раздел «Счета».' : 'Расход учитывается один раз, датой фактической оплаты.';
  }
  function saveEntry(btn) {
    var t = val('e-type'), w = val('e-way'), amt = C.parseMoney(val('e-amt')), date = val('e-date');
    if (amt == null || amt <= 0) return setErr('Сумма должна быть числом больше нуля, например 37,80.');
    if (!date) return setErr('Укажите дату.');
    if (!val('e-text')) return setErr('Укажите текст операции.');
    if (WAYS_FOR[t].indexOf(w) < 0) return setErr('Такое сочетание не допускается.');
    busy(btn, true); setErr('');
    putEntry({ id: newId('e'), date: date, type: t, way: w, amount: amt, party: val('e-party'), text: val('e-text'), doc: val('e-doc'), createdAt: new Date().toISOString() })
      .then(function () { month = date.slice(0, 7); closeSheet(); toast('Записано'); if (view !== 'journal') location.hash = '#journal'; else drawMain(); })
      .catch(function (e) { busy(btn, false); setErr(dbErr(e)); });
  }
  function sheetStornoEntry(id) {
    var e = S.entries.find(function (x) { return x.id === id; }); if (!e) return;
    openSheet('<h2>Отмена записи</h2><p class="hint">«' + esc(e.text) + '», ' + eur(e.amount) + '. Исходная запись сохраняется, к ней добавляется отменяющая с текущей датой.</p><p class="err" role="alert"></p>' +
      '<div class="row"><button class="btn ghost" data-act="sheet-close">Назад</button><button class="btn pri right" data-act="est-ok" data-id="' + esc(id) + '">Отменить запись</button></div>');
  }

  /* ---------- вид: ещё ---------- */
  function meter(val, lim) {
    var p = lim > 0 ? val / lim : 0, cls = p > 1 ? 'stop' : p >= 0.8 ? 'warn' : '';
    return { html: '<div class="meter ' + cls + '"><i style="width:' + Math.max(0, Math.min(100, Math.round(p * 100))) + '%"></i></div>', cls: cls || 'ok', pct: Math.round(p * 100) };
  }
  function vMore() {
    var s = S.settings, ym = today().slice(0, 7), yr = ym.slice(0, 4);
    var gew = C.sums(S.entries, ym).gewinn, ums = C.sums(S.entries, yr).einnahme;
    var kv = s.kvLimit || 0, ku = s.kuLimit || 0, m1 = meter(gew, kv), m2 = meter(ums, ku);
    var word = { ok: 'в норме', warn: 'близко к пределу', stop: 'предел превышен' };
    var h = '<h2>Лимиты</h2>';
    h += '<div class="card"><div class="row"><h3>Прибыль за ' + MES[parseInt(ym.slice(5), 10) - 1] + '</h3><span class="pill ' + m1.cls + ' right">' + (kv ? word[m1.cls] : 'лимит не задан') + '</span></div><p><b class="num">' + eur(gew) + '</b> из ' + eur(kv) + ' — предел семейной страховки</p>' + m1.html + '</div>';
    h += '<div class="card"><div class="row"><h3>Оборот за ' + yr + ' год</h3><span class="pill ' + m2.cls + ' right">' + (ku ? word[m2.cls] : 'лимит не задан') + '</span></div><p><b class="num">' + eur(ums) + '</b> из ' + eur(ku) + ' — порог Kleinunternehmer</p>' + m2.html + '</div>';
    h += '<p class="hint">Расчёт по журналу. Лимиты пересматриваются ежегодно.</p>';
    var open = C.openAuslagen(S.entries), sum = open.reduce(function (a, e) { return a + e.amount; }, 0);
    var txt = 'Erstattung Auslagen ' + (s.mann || '…') + ', ' + open.length + (open.length === 1 ? ' Beleg' : ' Belege') + ' lt. Aufstellung vom ' + C.deDate(today());
    h += '<h2>Расходы, оплаченные супругом</h2><div class="card">';
    if (open.length) {
      h += '<div class="list">' + open.map(function (e) { return '<div class="item"><div class="main"><b>' + esc(e.text) + '</b><div class="meta">' + esc(C.deDate(e.date)) + (e.party ? ' · ' + esc(e.party) : '') + '</div></div><div class="amt num">' + eur(e.amount) + '</div></div>'; }).join('') + '</div>' +
        '<div class="row"><span>К возмещению</span><span class="right total num">' + eur(sum) + '</span></div>' +
        '<div class="copy"><span class="lbl">Назначение перевода с рабочего счёта</span><code id="au-txt">' + esc(txt) + '</code><div><button class="btn sm" data-act="au-copy">Скопировать</button></div></div>' +
        '<button class="btn pri" data-act="au-ok">Провести возмещение</button><p class="hint">В журнале создаётся изъятие на эту сумму, расходы снимаются с учёта как возмещённые.</p>';
    } else h += '<div class="empty">Невозмещённых расходов нет.</div>';
    h += '</div><h2>Документы и настройки</h2><div class="choices">' +
      '<button class="choice" data-act="eb-new"><span><b>Eigenbeleg</b><span class="sub">замена утраченного чека, PDF</span></span></button>' +
      '<button class="choice" data-act="set-open"><span><b>Настройки</b><span class="sub">реквизиты, нумерация, остаток, лимиты</span></span></button>' +
      '<button class="choice" data-act="bk-save"><span><b>Резервная копия</b><span class="sub">все данные одним файлом</span></span></button>' +
      '<a class="choice" href="' + MEMO + '" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span><b>Памятка</b><span class="sub">правила работы со счетами</span></span></a></div>' +
      '<label class="f" for="bk-file">Восстановление из резервной копии<input id="bk-file" type="file" accept=".json,application/json"></label>';
    return h;
  }
  function sheetSettings() {
    var s = S.settings, m = function (c) { return c == null ? '' : C.fmtMoney(c); };
    openSheet('<h2>Настройки</h2><h3>Реквизиты в счёте</h3>' + fld('s-inh', 'Имя', 'text', s.inh) + fld('s-firma', 'Название предприятия', 'text', s.firma) +
      '<div class="row">' + fld('s-strasse', 'Straße, Nr.', 'text', s.strasse) + fld('s-ort', 'PLZ, Ort', 'text', s.ort) + '</div>' +
      '<div class="row">' + fld('s-tel', 'Telefon', 'text', s.tel) + fld('s-email', 'E-Mail', 'text', s.email) + '</div>' +
      fld('s-steuernr', 'Steuernummer', 'text', s.steuernr) + '<div class="row">' + fld('s-bank', 'Bank', 'text', s.bank) + fld('s-bic', 'BIC', 'text', s.bic) + '</div>' + fld('s-iban', 'IBAN', 'text', s.iban) +
      '<h3>Супруг</h3><div class="row">' + fld('s-mannvoll', 'Полное имя', 'text', s.mannvoll) + fld('s-mann', 'Сокращённо', 'text', s.mann) + '</div>' +
      '<h3>Нумерация счетов</h3>' + fld('s-lastIssued', 'Последний номер, выданный вне приложения', 'text', s.lastIssued, 'inputmode="numeric"') +
      '<h3>Рабочий счёт</h3><div class="row">' + fld('s-openingDate', 'Дата начального остатка', 'date', s.openingDate) + fld('s-opening', 'Начальный остаток, EUR', 'text', m(s.opening), 'inputmode="decimal"') + '</div>' +
      '<h3>Лимиты</h3><div class="row">' + fld('s-kv', 'Семейная страховка, прибыль в месяц', 'text', m(s.kvLimit), 'inputmode="decimal"') + fld('s-ku', 'Kleinunternehmer, оборот в год', 'text', m(s.kuLimit), 'inputmode="decimal"') + '</div>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="set-save">Сохранить</button></div>');
  }
  function saveSettings(btn) {
    var n = val('s-lastIssued'), op = val('s-opening') === '' ? 0 : C.parseMoney(val('s-opening')), kv = val('s-kv') === '' ? 0 : C.parseMoney(val('s-kv')), ku = val('s-ku') === '' ? 0 : C.parseMoney(val('s-ku'));
    if (n && !/^\d{9}$/.test(n)) return setErr('Номер счёта состоит из 9 цифр, например 202611001.');
    if (op == null || kv == null || ku == null) return setErr('Суммы вводятся в виде 565,00.');
    var keys = ['inh', 'firma', 'strasse', 'ort', 'tel', 'email', 'steuernr', 'bank', 'bic', 'iban', 'mannvoll', 'mann'], o = {};
    keys.forEach(function (k) { o[k] = val('s-' + k); });
    if (C.nonLatin1(keys.map(function (k) { return o[k]; }).join(''))) return setErr('Реквизиты вводятся латиницей.');
    o.lastIssued = n; o.openingDate = val('s-openingDate'); o.opening = op; o.kvLimit = kv; o.kuLimit = ku;
    busy(btn, true);
    putSettings(o).then(function () { closeSheet(); toast('Настройки сохранены'); }).catch(function (e) { busy(btn, false); setErr(dbErr(e)); });
  }
  function sheetEigen() {
    openSheet('<h2>Eigenbeleg</h2><p class="hint">Один документ на одну покупку без чека. Текст вводится латиницей. Документ распечатывается и подписывается.</p>' +
      '<div class="row">' + fld('eb-nr', 'Номер', 'text', '1/' + today().slice(0, 4)) + fld('eb-date', 'Дата расхода', 'date', today()) + '</div>' +
      '<div class="row">' + fld('eb-amt', 'Сумма, EUR', 'text', '', 'inputmode="decimal" placeholder="0,00"') + fld('eb-emp', 'Empfänger', 'text', '') + '</div>' +
      fld('eb-zweck', 'Zweck', 'text', '') + fld('eb-grund', 'Grund für Eigenbeleg', 'text', 'Originalbeleg nicht erhalten') + fld('eb-zahl', 'Zahlung', 'text', '') +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Закрыть</button><button class="btn right" data-act="eb-drive">В Google Drive</button><button class="btn pri" data-act="eb-pdf">PDF на устройство</button></div>');
  }
  function eigenPdf() {
    var amt = C.parseMoney(val('eb-amt')), f = { nr: val('eb-nr'), date: val('eb-date'), emp: val('eb-emp'), zweck: val('eb-zweck'), grund: val('eb-grund'), zahl: val('eb-zahl') };
    if (amt == null || amt <= 0) { setErr('Сумма должна быть числом больше нуля.'); return null; }
    if (!f.date || !f.emp || !f.zweck) { setErr('Заполните дату, получателя и назначение.'); return null; }
    if (C.nonLatin1(Object.keys(f).map(function (k) { return f[k]; }).join(''))) { setErr('Текст вводится латиницей: кириллица в PDF не отображается.'); return null; }
    setErr('');
    var d = pdfDoc(), y = 260.8, s = S.settings; pdfHead(d);
    d.setFont(FONT, 'bold'); d.setFontSize(13.59); d.text('Eigenbeleg Nr. ' + f.nr, XL, 226.8);
    d.setFontSize(FS);
    [['Datum der Ausgabe', C.deDate(f.date)], ['Betrag', C.fmtMoney(amt) + ' EUR'], ['Empfänger', f.emp], ['Zweck', f.zweck], ['Grund für Eigenbeleg', f.grund], ['Zahlung', f.zahl]].forEach(function (r) {
      d.setFont(FONT, 'bold'); d.text(r[0] + ':', XL, y); d.setFont(FONT, 'normal');
      var l = d.splitTextToSize(r[1] || '-', 283); l.forEach(function (t, k) { d.text(t, 198.4, y + k * LH); }); y += l.length * LH + 8.5;
    });
    y += 45; d.text(String(s.ort || '').replace(/^\d+\s*/, '') + ', ' + C.deDate(today()), XL, y);
    d.setDrawColor(0, 0, 0); d.setLineWidth(0.6); d.line(283.5, y + 2.8, XR, y + 2.8); d.setFontSize(7.5); d.text('Unterschrift ' + (s.inh || ''), 283.5, y + 14);
    return { doc: d, name: 'Eigenbeleg_' + f.date + '_' + f.nr.replace(/[^\w-]+/g, '-') + '.pdf' };
  }
  function backup() {
    saveFile('LOULOU_Kasse_' + today() + '.json', JSON.stringify({ app: 'loulou-kasse', version: 1, savedAt: new Date().toISOString(), settings: S.settings, bank: S.bank, invoices: S.invoices, entries: S.entries }, null, 1));
  }
  function restore(file) {
    var r = new FileReader();
    r.onload = function () {
      var d; try { d = JSON.parse(r.result); } catch (e) { return toast('Это не файл резервной копии'); }
      if (!d || d.app !== 'loulou-kasse' || !Array.isArray(d.entries) || !Array.isArray(d.invoices)) return toast('Это не файл резервной копии');
      var es = d.entries.filter(function (e) { return e.id && C.validEntry(e); }), ivs = d.invoices.filter(function (v) { return v.no; });
      openSheet('<h2>Восстановление данных</h2><p class="hint">В файле ' + es.length + ' записей журнала и ' + ivs.length + ' счетов от ' + esc(String(d.savedAt || '').slice(0, 10)) + '. Записи с теми же номерами будут заменены, остальные добавлены.</p><p class="err" role="alert"></p>' +
        '<div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="bk-ok">Восстановить</button></div>');
      restore.pending = { es: es, ivs: ivs, settings: d.settings, bank: d.bank };
    };
    r.readAsText(file);
  }
  function doRestore(btn) {
    var p = restore.pending; if (!p) return; busy(btn, true);
    var chain = Promise.resolve();
    p.es.forEach(function (e) { chain = chain.then(function () { return putEntry(e); }); });
    p.ivs.forEach(function (v) { chain = chain.then(function () { return putInvoice(v); }); });
    if (p.settings && Object.keys(p.settings).length) chain = chain.then(function () { return putSettings(p.settings); });
    if (p.bank && p.bank.statements) chain = chain.then(function () { return putBank({ statements: p.bank.statements }); });
    chain.then(function () { restore.pending = null; closeSheet(); toast('Данные восстановлены'); }).catch(function (e) { busy(btn, false); setErr(dbErr(e)); });
  }

  /* ---------- события ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;   /* касание вне полей окно не закрывает */
    var a = b.dataset.act, i = parseInt(b.dataset.i, 10), no = b.dataset.no, id = b.dataset.id, o, e;
    if (a === 'g-sit') { g = { step: 1, sit: i, opt: null, vals: {} }; drawMain(); }
    else if (a === 'g-opt') { g.step = 2; g.opt = i; g.vals = {}; drawMain(); }
    else if (a === 'g-back') { g.step -= 1; drawMain(); }
    else if (a === 'g-copy') copyText($('code[data-tpl="' + i + '"]').textContent);
    else if (a === 'g-journal') { o = GUIDE[g.sit].opts[g.opt]; sheetEntry({ type: o.journal.type, way: o.journal.way, text: o.journal.type === 'ausgabe' ? '' : C.fillTpl(o.texts[0][1], guideVals()).replace(/…/g, '').trim() }); }
    else if (a === 'sheet-close') closeSheet();
    else if (a === 'iv-new') sheetInvoice();
    else if (a === 'it-add') { $('#iv-items').insertAdjacentHTML('beforeend', itemRow(rowN++)); }
    else if (a === 'it-del') { if (document.querySelectorAll('#iv-items [data-wrap]').length > 1) b.closest('[data-wrap]').remove(); updTotal(); }
    else if (a === 'iv-issue') issueInvoice(b);
    else if (a === 'iv-pdf') ivAct('pdf', no); else if (a === 'iv-drive') ivAct('drive', no); else if (a === 'iv-gdoc') ivAct('gdoc', no);
    else if (a === 'iv-pay') sheetPay(no);
    else if (a === 'pay-ok') { if (!val('pay-date')) return setErr('Укажите дату.'); busy(b, true); payInvoice(findIv(no), val('pay-date'), val('pay-way')).then(function () { closeSheet(); toast('Оплата записана'); if (!db) refresh(); }).catch(function (er) { busy(b, false); setErr(dbErr(er)); }); }
    else if (a === 'iv-storno') sheetStornoIv(no); else if (a === 'ivst-ok') stornoInvoice(no, b);
    else if (a === 'j-new') sheetEntry(); else if (a === 'e-save') saveEntry(b);
    else if (a === 'j-storno') sheetStornoEntry(id);
    else if (a === 'est-ok') { e = S.entries.find(function (x) { return x.id === id; }); busy(b, true); putEntry(C.makeStorno(e, newId('e'), today(), new Date().toISOString())).then(function () { closeSheet(); toast('Запись отменена'); }).catch(function (er) { busy(b, false); setErr(dbErr(er)); }); }
    else if (a === 'j-rec' && month !== 'all') {
      var raw = val('j-stmt'), c = raw === '' ? null : C.parseMoney(raw);
      if (raw !== '' && c == null) return toast('Остаток вводите как 212,20');
      var st = Object.assign({}, S.bank.statements); if (c == null) delete st[month]; else st[month] = c;
      S.bank = { statements: st }; drawMain(); putBank({ statements: st }).catch(function (er) { toast(dbErr(er)); });
    }
    else if (a === 'j-csv') saveFile('Journal_' + (month === 'all' ? 'gesamt_' + today() : month) + '.csv', C.journalCsv(S.entries, month === 'all' ? '' : month));
    else if (a === 'j-prev' || a === 'j-next') { var ms = monthList(), k = ms.indexOf(month) + (a === 'j-prev' ? 1 : -1); if (k >= 0 && k < ms.length) { month = ms[k]; drawMain(); } }
    else if (a === 'j-goto') { month = b.dataset.m; drawMain(); }
    else if (a === 'au-copy') copyText($('#au-txt').textContent);
    else if (a === 'au-ok') {
      var open = C.openAuslagen(S.entries), sum = open.reduce(function (x, y) { return x + y.amount; }, 0), txt = $('#au-txt').textContent, rid = newId('e');
      busy(b, true);
      putEntry({ id: rid, date: today(), type: 'entnahme', way: 'G', amount: sum, party: S.settings.mannvoll || '', text: txt, doc: '', createdAt: new Date().toISOString() })
        .then(function () { var ch = Promise.resolve(); open.forEach(function (x) { ch = ch.then(function () { return patchEntry(x.id, { erstattet: rid }); }); }); return ch; })
        .then(function () { toast('Возмещение ' + eur(sum) + ' проведено'); if (!db) refresh(); }).catch(function (er) { busy(b, false); toast(dbErr(er)); });
    }
    else if (a === 'eb-new') sheetEigen();
    else if (a === 'eb-pdf' || a === 'eb-drive') { try { var r = eigenPdf(); if (!r) return; if (a === 'eb-pdf') saveFile(r.name, r.doc.output('blob')); else driveSave({ title: r.name, parentId: DRIVE_EIGENBELEGE, base64Content: pdfB64(r.doc), contentMimeType: 'application/pdf', disableConversionToGoogleType: true }, 'PDF'); } catch (er) { setErr('Не удалось собрать PDF: ' + (er.message || er)); } }
    else if (a === 'set-open') sheetSettings(); else if (a === 'set-save') saveSettings(b);
    else if (a === 'bk-save') backup(); else if (a === 'bk-ok') doRestore(b);
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.gf) {
      g.vals[t.dataset.gf] = t.value; var v = guideVals(), o = GUIDE[g.sit].opts[g.opt];
      document.querySelectorAll('code[data-tpl]').forEach(function (c) { c.textContent = C.fillTpl(o.texts[parseInt(c.dataset.tpl, 10)][1], v); });
    } else if (t.dataset && t.dataset.it) updTotal();
    else if (t.dataset && t.dataset.auto === '1' && (t.id === 'iv-title' || t.id === 'iv-no' || t.id === 'iv-llabel' || t.id === 'iv-hint')) t.dataset.auto = '0';
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'j-month' && (t.value === 'all' || /^\d{4}-\d{2}$/.test(t.value))) { month = t.value; drawMain(); }
    else if (t.id === 'e-type') fillWays();
    else if (t.id === 'iv-kind') kindChanged();
    else if (t.id === 'iv-duesel') dueChanged();
    else if (t.dataset && t.dataset.it === 'tpl' && t.value) { var ta = t.closest('[data-wrap]').querySelector('[data-it=text]'); ta.value = t.value; t.value = ''; ta.focus(); updTotal(); }
    else if (t.closest && t.closest('#iv-prepay') && t.type === 'checkbox') {
      var rc = document.getElementById('iv-rcpt'), v0 = findIv(t.value);
      if (t.checked && v0 && !rc.value.trim()) rc.value = v0.rcpt || ivName(v0);
      updTotal();
    }
    else if (t.id === 'iv-date') setAuto('iv-no', C.nextInvoiceNo(S.invoices, t.value, S.settings.lastIssued));
    else if (t.id === 'bk-file' && t.files && t.files[0]) { restore(t.files[0]); t.value = ''; }
  });
  document.addEventListener('focusout', function () { setTimeout(function () { if (dirty && $('#sheet').hidden) { var a = document.activeElement; if (!(a && $('#main').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) drawMain(); } }, 60); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
  window.addEventListener('hashchange', route);
  boot();
})();
