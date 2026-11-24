
  /* ---------- раздел «Ещё» ---------- */
  function vMore() {
    var s = S.settings, open = C.openAuslagen(S.entries), sum = open.reduce(function (a, e) { return a + e.amount; }, 0), yr = today().slice(0, 4);
    var txt = 'Erstattung Auslagen ' + (s.mann || '…') + ', ' + open.length + (open.length === 1 ? ' Beleg' : ' Belege') + ' lt. Aufstellung vom ' + C.deDate(today());
    var h = '<h2>Отчёты</h2><div class="choices">' +
      '<button class="choice" data-act="euer-open"><span><b>Годовой отчёт EÜR</b><span class="sub">доходы и расходы по статьям за ' + yr + ' год</span></span></button>' +
      '<button class="choice" data-act="bank-open"><span><b>Выписка банка</b><span class="sub">загрузить CSV Sparkasse и сравнить с журналом</span></span></button>' +
      '<button class="choice" data-act="pack-open"><span><b>Пакет для Steuerberater</b><span class="sub">журнал, EÜR, список и PDF счетов одним архивом</span></span></button></div>';
    h += '<h2>Расходы, оплаченные супругом</h2><div class="card">';
    if (open.length) {
      h += '<div class="list">' + open.map(function (e) { return '<div class="item"><span class="main"><b>' + esc(e.text) + '</b><span class="meta">' + esc(C.deDate(e.date)) + (e.party ? ' · ' + esc(e.party) : '') + '</span></span><span class="amt num">' + eur(e.amount) + '</span></div>'; }).join('') + '</div>' +
        '<div class="row strong"><span>К возмещению</span><span class="right num">' + eur(sum) + '</span></div>' +
        '<div class="copy"><span class="lbl">Назначение перевода с рабочего счёта</span><code id="au-txt">' + esc(txt) + '</code><div><button class="btn sm" data-act="au-copy">Скопировать</button></div></div>' +
        '<button class="btn pri" data-act="au-ok">Провести возмещение</button><p class="hint">В журнале создаётся изъятие на эту сумму, расходы снимаются с учёта как возмещённые.</p>';
    } else h += '<div class="empty">Невозмещённых расходов нет.</div>';
    h += '</div><h2>Документы</h2><div class="choices">' +
      '<button class="choice" data-act="eb-new"><span><b>Eigenbeleg</b><span class="sub">замена утраченного чека: PDF и запись в журнале</span></span></button>' +
      '<button class="choice" data-act="tpl-open"><span><b>Шаблоны операций</b><span class="sub">' + S.templates.length + ' ' + plural(S.templates.length, 'шаблон', 'шаблона', 'шаблонов') + ' для повторяющихся расходов</span></span></button>' +
      '<a class="choice" href="#guide"><span><b>Справочник</b><span class="sub">как провести операцию, готовые формулировки</span></span></a></div>';
    h += '<h2>Данные</h2><div class="choices">' +
      '<button class="choice" data-act="set-open"><span><b>Настройки</b><span class="sub">реквизиты, нумерация, остаток, лимиты, папки Drive</span></span></button>' +
      '<button class="choice" data-act="bk-open"><span><b>Резервная копия</b><span class="sub">' + (s.lastBackup ? 'последняя копия в Drive: ' + esc(C.deDate(s.lastBackup.slice(0, 10))) : 'файл со всеми данными; копия в Drive') + '</span></span></button></div>';
    var th = theme(); h += '<h3>Оформление</h3><div class="seg chips">' + THEMES.map(function (x) { return '<button data-act="theme" data-t="' + x[0] + '" aria-pressed="' + (th === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div><p class="hint">Запоминается на этом устройстве.</p>';
    if (S.user) h += '<p class="hint">Вход: ' + esc(S.user.email || '') + ' · Google Drive ' + (B.driveReady() ? 'подключён' : 'не подключён') + ' <button class="lnk" data-act="logout">Выйти</button></p>';
    return h;
  }

  /* ---------- годовой отчёт EÜR ---------- */
  function years() {
    var ys = {}; ys[today().slice(0, 4)] = 1;
    S.entries.forEach(function (e) { if (C.validEntry(e)) ys[e.date.slice(0, 4)] = 1; });
    return Object.keys(ys).sort().reverse();
  }
  function sheetEuer(y) {
    y = y || today().slice(0, 4);
    var r = C.euerReport(S.entries, y);
    var row = function (x) { return '<tr' + (x.key ? '' : ' class="warnr"') + '><td>' + esc(x.ru) + '<span class="sub">' + esc(x.de) + '</span></td><td class="num">' + C.fmtMoney(x.amount) + '</td></tr>'; };
    openSheet('<h2>EÜR ' + esc(y) + '</h2><label class="f" for="euer-y">Год<select id="euer-y">' + years().map(function (k) { return '<option' + (k === y ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<div class="card"><table class="mt euer"><thead><tr><th>Доходы</th><th>EUR</th></tr></thead><tbody>' + r.income.map(row).join('') + '</tbody><tfoot><tr><td>Итого доходы</td><td class="num">' + C.fmtMoney(r.totalIncome) + '</td></tr></tfoot></table></div>' +
      '<div class="card"><table class="mt euer"><thead><tr><th>Расходы</th><th>EUR</th></tr></thead><tbody>' + r.expense.filter(function (x) { return x.amount || !x.key; }).map(row).join('') + '</tbody><tfoot><tr><td>Итого расходы</td><td class="num">' + C.fmtMoney(r.totalExpense) + '</td></tr></tfoot></table>' +
      '<p class="hint">Статьи без сумм не показаны.</p></div>' +
      '<div class="row strong"><span>Прибыль ' + esc(y) + '</span><span class="right num">' + eur(r.gewinn) + '</span></div>' +
      '<p>' + (r.ok ? '<span class="pill ok">Контроль</span> сумма строк равна итогам журнала за год.' : '<span class="pill stop">Контроль не пройден</span> сумма строк не равна журналу.') + '</p>' +
      (r.uncategorized ? '<div class="verdict warn">' + r.uncategorized + ' ' + plural(r.uncategorized, 'запись', 'записи', 'записей') + ' без статьи. <button class="lnk" data-act="go-nocat">Показать в журнале</button></div>' : '') +
      '<div class="row wrap"><button class="btn" data-act="euer-csv" data-y="' + esc(y) + '">CSV для Excel</button><button class="btn pri right" data-act="pack-open" data-y="' + esc(y) + '">Пакет для Steuerberater</button></div>');
  }

  /* ---------- выписка банка ---------- */
  var bankRes = null, bankRows = null;
  function reopenBank() { if (!bankRows) return; sheetBank(true); bankRes = C.matchBank(bankRows, S.entries); drawBank(); }
  function sheetBank(keep) {
    if (!keep) { bankRes = null; bankRows = null; }
    openSheet('<h2>Выписка банка</h2><p class="hint">Sparkasse Online-Banking → Umsätze → Export → <b>CSV-CAMT</b>. Загрузите файл: приложение сравнит операции рабочего счёта с журналом (та же сумма, дата ±5 дней).</p>' +
      '<label class="f" for="bank-file">Файл выписки (.csv)<input id="bank-file" type="file" accept=".csv,text/csv,text/plain"></label><div id="bank-out"></div>');
  }
  function decodeBank(buf) {
    var t = new TextDecoder('utf-8').decode(buf);
    if (t.indexOf('�') >= 0) { try { t = new TextDecoder('windows-1252').decode(buf); } catch (e) {} }
    return t;
  }
  function bankFile(file) {
    var r = new FileReader();
    r.onload = function () {
      var p = C.parseBankCsv(decodeBank(r.result)), out = $('#bank-out'); if (!out) return;
      if (p.error) { out.innerHTML = '<p class="err">' + esc(p.error) + '</p>'; return; }
      bankRows = p.rows; bankRes = C.matchBank(p.rows, S.entries); drawBank();
    };
    r.readAsArrayBuffer(file);
  }
  function drawBank() {
    var m = bankRes, out = $('#bank-out'); if (!m || !out) return;
    var rowB = function (x, i) { return '<div class="item"><span class="main"><b>' + esc(x.party || x.kind || 'Операция') + '</b><span class="meta">' + esc(C.deDate(x.date)) + ' · ' + esc(x.text).slice(0, 90) + '</span></span><span class="amt num ' + (x.amount >= 0 ? 'plus' : 'minus') + '">' + eur(x.amount) + '</span><button class="btn sm" data-act="bank-add" data-i="' + i + '">Внести</button></div>'; };
    out.innerHTML = '<p>Период ' + esc(C.deDate(m.from)) + ' — ' + esc(C.deDate(m.to)) + ': ' + (m.matched.length + m.missing.length) + ' операций, сумма движения ' + eur(m.sumBank) + '.</p>' +
      '<div class="verdict ok">Совпадают с журналом: ' + m.matched.length + '</div>' +
      (m.missing.length ? '<div class="verdict warn">Нет в журнале: ' + m.missing.length + '</div><div class="card"><div class="list">' + m.missing.map(rowB).join('') + '</div></div>' : '') +
      (m.extra.length ? '<div class="verdict warn">В журнале есть, в выписке нет: ' + m.extra.length + '</div><div class="card"><div class="list">' + m.extra.map(function (e) { return entryRow(e, C.stornoedIds(S.entries)); }).join('') + '</div><p class="hint">Проверьте счёт оплаты у этих записей: по рабочему счёту они должны быть в выписке.</p></div>' : '') +
      (!m.missing.length && !m.extra.length ? '<p><span class="pill ok">Всё сходится</span> каждая операция выписки есть в журнале.</p>' : '');
  }

  /* ---------- пакет для Steuerberater ---------- */
  function sheetPack(y) {
    y = y || today().slice(0, 4);
    openSheet('<h2>Пакет для Steuerberater</h2><label class="f" for="pack-y">Год<select id="pack-y">' + years().map(function (k) { return '<option' + (k === y ? ' selected' : '') + '>' + k + '</option>'; }).join('') + '</select></label>' +
      '<p class="hint">Архив ZIP: журнал (CSV), отчёт EÜR (CSV), список счетов (CSV), все счета года в PDF и список документов к расходам со ссылками на Google Drive.</p>' +
      '<p class="err" role="alert"></p><div class="row wrap"><button class="btn" data-act="pack-make" data-k="dl">Скачать ZIP</button>' + (navigator.share ? '<button class="btn" data-act="pack-make" data-k="share">Отправить…</button>' : '') + '<button class="btn pri" data-act="pack-make" data-k="drive">В Google Drive</button></div>');
  }
  function makePack(y) {
    if (!window.JSZip) return Promise.reject({ message: 'модуль ZIP не загрузился, проверьте подключение' });
    var z = new window.JSZip(), r = C.euerReport(S.entries, y), st = C.stornoedIds(S.entries);
    z.file('Journal_' + y + '.csv', C.journalCsv(S.entries, y));
    z.file('EUER_' + y + '.csv', C.euerCsv(r));
    z.file('Rechnungen_' + y + '.csv', C.invoicesCsv(S.invoices, y));
    var bl = [['Datum', 'Betrag EUR', 'Text', 'Geschäftspartner', 'Kategorie', 'Beleg', 'Link']];
    S.entries.filter(function (e) { return C.validEntry(e) && e.date.indexOf(y) === 0 && e.type === 'ausgabe' && !e.stornoOf && !st[e.id]; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (e) {
      var c = C.catOf(e);
      bl.push([C.deDate(e.date), C.fmtMoney(e.amount), e.text || '', e.party || '', c ? C.CAT_INFO[c].de : '', e.beleg ? e.beleg.name : e.noBeleg ? 'Kontoauszug' : 'FEHLT', e.beleg ? e.beleg.link || '' : '']);
    });
    z.file('Belege_' + y + '.csv', '﻿' + bl.map(function (x) { return x.map(function (v) { v = String(v); return /[";\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n') + '\r\n');
    var f = z.folder('Rechnungen');
    S.invoices.filter(function (v) { return String(v.date).indexOf(y) === 0; }).forEach(function (v) { f.file(ivFileName(v), invoicePdf(v).output('arraybuffer')); });
    var s = S.settings;
    z.file('LIESMICH.txt', 'Buchhaltungsunterlagen ' + y + '\r\n' + (s.inh || '') + (s.firma ? ', ' + s.firma : '') + '\r\nSteuernummer: ' + (s.steuernr || '') + '\r\nKleinunternehmerin gemäß § 19 UStG\r\nGewinnermittlung: Einnahmen-Überschuss-Rechnung\r\nErstellt am ' + C.deDate(today()) + ' mit LOU LOU Kasse.\r\n\r\n' +
      'Journal_' + y + '.csv – alle Buchungen (Zuflussprinzip), mit Summen\r\nEUER_' + y + '.csv – Summen nach Kategorien, Kontrolle gegen das Journal: ' + (r.ok ? 'ja' : 'NEIN') + '\r\nRechnungen_' + y + '.csv – Ausgangsrechnungen\r\nRechnungen/ – Ausgangsrechnungen als PDF\r\nBelege_' + y + '.csv – Ausgaben mit Verweis auf den Beleg in Google Drive\r\n');
    return z.generateAsync({ type: 'blob', mimeType: 'application/zip' });
  }

  /* ---------- резервная копия ---------- */
  function backupJson() { return JSON.stringify({ app: 'loulou-kasse', version: 2, savedAt: new Date().toISOString(), settings: S.settings, bank: S.bank, invoices: S.invoices, entries: S.entries, templates: S.templates }, null, 1); }
  function backupToDrive(auto) {
    var name = 'LOULOU_Kasse_' + today() + '.json';
    return B.folder('Backups', drive().root).then(function (fid) { return B.upload({ name: name, mime: 'application/json', data: new Blob([backupJson()], { type: 'application/json' }), parent: fid }); })
      .then(function () { patchSettings({ lastBackup: new Date().toISOString() }); toast((auto ? 'Автокопия' : 'Копия') + ' сохранена в Drive: Backups'); },
        function (e) { if (!auto) toast('Копия не сохранена: ' + (e && e.message || e)); });
  }
  function sheetBackup() {
    openSheet('<h2>Резервная копия</h2><p class="hint">Файл со всеми записями, счетами, шаблонами и настройками. В Google Drive копия сохраняется в «Violeta Larina Dokumente › Backups»; при подключённом Drive это происходит само раз в 30 дней.' + (S.settings.lastBackup ? ' Последняя копия в Drive: ' + esc(C.deDate(S.settings.lastBackup.slice(0, 10))) + '.' : '') + '</p>' +
      '<div class="row wrap"><button class="btn" data-act="bk-save">Скачать файл</button><button class="btn pri" data-act="bk-drive">Копия в Google Drive</button></div>' +
      '<h3>Восстановление</h3><p class="hint">Записи и счета из файла добавляются; совпадающие по номеру заменяются. Подходит и файл из старой версии в Claude.</p>' +
      '<label class="f" for="bk-file">Файл копии (.json)<input id="bk-file" type="file" accept=".json,application/json"></label>');
  }
  var pendingRestore = null;
  function restore(file) {
    var r = new FileReader();
    r.onload = function () {
      var d; try { d = JSON.parse(r.result); } catch (e) { return toast('Это не файл резервной копии'); }
      if (!d || d.app !== 'loulou-kasse' || !Array.isArray(d.entries) || !Array.isArray(d.invoices)) return toast('Это не файл резервной копии');
      var es = d.entries.filter(function (e) { return e.id && C.validEntry(e); }), ivs = d.invoices.filter(function (v) { return v.no; }), ts = (d.templates || []).filter(function (t) { return t.id; });
      pendingRestore = { es: es, ivs: ivs, ts: ts, settings: d.settings, bank: d.bank };
      openSheet('<h2>Восстановление данных</h2><p class="hint">В файле ' + es.length + ' записей журнала, ' + ivs.length + ' счетов' + (ts.length ? ', ' + ts.length + ' шаблонов' : '') + ' от ' + esc(String(d.savedAt || '').slice(0, 10)) + '. Записи с теми же номерами будут заменены, остальные добавлены.' +
        (S.entries.length || S.invoices.length ? ' Сейчас в приложении ' + S.entries.length + ' записей и ' + S.invoices.length + ' счетов.' : '') + '</p><p class="err" role="alert"></p>' +
        '<div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="bk-ok">Восстановить</button></div>');
    };
    r.readAsText(file);
  }
  function doRestore(btn) {
    var p = pendingRestore; if (!p) return; busy(btn, true);
    var chain = Promise.resolve();
    p.es.forEach(function (e) { chain = chain.then(function () { return putEntry(e); }); });
    p.ivs.forEach(function (v) { chain = chain.then(function () { return putInvoice(v); }); });
    p.ts.forEach(function (t) { chain = chain.then(function () { return putTemplate(t); }); });
    if (p.settings && Object.keys(p.settings).length) chain = chain.then(function () { return putSettings(Object.assign({}, p.settings, S.settings.drive ? { drive: S.settings.drive } : {})); });
    if (p.bank && p.bank.statements) chain = chain.then(function () { return putBank({ statements: p.bank.statements }); });
    chain.then(function () { pendingRestore = null; closeSheet(); toast('Данные восстановлены: ' + p.es.length + ' записей, ' + p.ivs.length + ' счетов'); }).catch(function (e) { busy(btn, false); setErr(dbErr(e)); });
  }

  /* ---------- шаблоны ---------- */
  function sheetTemplates() {
    var list = S.templates.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    openSheet('<h2>Шаблоны операций</h2><p class="hint">Шаблон заполняет новую запись: вид, счёт, сумму, текст, контрагента и статью. Создаётся галочкой «Сохранить как шаблон» в новой записи или кнопкой в карточке записи.</p>' +
      '<div class="card"><div class="list">' + (list.length ? list.map(function (t) { return '<div class="item"><span class="main"><b>' + esc(t.name) + '</b><span class="meta">' + esc(TYPE_RU[t.type]) + ' · ' + esc(WAY_RU[t.way]) + (t.cat && C.CAT_INFO[t.cat] ? ' · ' + esc(C.CAT_INFO[t.cat].ru) : '') + '</span></span><span class="amt num">' + (t.amount ? eur(t.amount) : '') + '</span><button class="btn sm" data-act="tpl-use" data-id="' + esc(t.id) + '">Внести</button><button class="btn sm ghost" data-act="tpl-del" data-id="' + esc(t.id) + '" aria-label="Удалить шаблон">×</button></div>'; }).join('') : '<div class="empty">Шаблонов пока нет.</div>') + '</div></div>');
  }

  /* ---------- настройки ---------- */
  function sheetSettings() {
    var s = S.settings, m = function (c) { return c == null ? '' : C.fmtMoney(c); }, dv = drive();
    openSheet('<h2>Настройки</h2><h3>Реквизиты в счёте</h3>' + fld('s-inh', 'Имя', 'text', s.inh) + fld('s-firma', 'Название предприятия', 'text', s.firma) +
      '<div class="row">' + fld('s-strasse', 'Straße, Nr.', 'text', s.strasse) + fld('s-ort', 'PLZ, Ort', 'text', s.ort) + '</div>' +
      '<div class="row">' + fld('s-tel', 'Telefon', 'text', s.tel) + fld('s-email', 'E-Mail', 'text', s.email) + '</div>' +
      fld('s-steuernr', 'Steuernummer', 'text', s.steuernr) + '<div class="row">' + fld('s-bank', 'Bank', 'text', s.bank) + fld('s-bic', 'BIC', 'text', s.bic) + '</div>' + fld('s-iban', 'IBAN', 'text', s.iban) +
      '<h3>Супруг</h3><div class="row">' + fld('s-mannvoll', 'Полное имя', 'text', s.mannvoll) + fld('s-mann', 'Сокращённо', 'text', s.mann) + '</div>' +
      '<h3>Нумерация счетов</h3>' + fld('s-lastIssued', 'Последний номер, выданный вне приложения', 'text', s.lastIssued, 'inputmode="numeric"') +
      '<h3>Рабочий счёт</h3><div class="row">' + fld('s-openingDate', 'Дата начального остатка', 'date', s.openingDate) + fld('s-opening', 'Начальный остаток, EUR', 'text', m(s.opening), 'inputmode="decimal"') + '</div>' +
      '<h3>Лимиты</h3><div class="row">' + fld('s-kv', 'Семейная страховка, прибыль в месяц', 'text', m(s.kvLimit), 'inputmode="decimal"') + fld('s-ku', 'Kleinunternehmer, оборот в год', 'text', m(s.kuLimit), 'inputmode="decimal"') + '</div>' +
      '<details><summary><h3>Папки Google Drive</h3></summary><p class="hint">Идентификатор папки — часть адреса после /folders/. Внутри основной папки приложение само создаёт «Belege» (по месяцам) и «Backups».</p>' +
      fld('s-d-root', 'Основная папка (Violeta Larina Dokumente)', 'text', dv.root) + fld('s-d-rechnungen', 'Счета (Rechnungen)', 'text', dv.rechnungen) + fld('s-d-eigenbelege', 'Eigenbelege', 'text', dv.eigenbelege) + '</details>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="set-save">Сохранить</button></div>');
  }
  function saveSettings(btn) {
    var n = val('s-lastIssued'), op = val('s-opening') === '' ? 0 : C.parseMoney(val('s-opening')), kv = val('s-kv') === '' ? 0 : C.parseMoney(val('s-kv')), ku = val('s-ku') === '' ? 0 : C.parseMoney(val('s-ku'));
    if (n && !/^\d{9}$/.test(n)) return setErr('Номер счёта состоит из 9 цифр, например 202611001.');
    if (op == null || kv == null || ku == null) return setErr('Суммы вводятся в виде 565,00.');
    var keys = ['inh', 'firma', 'strasse', 'ort', 'tel', 'email', 'steuernr', 'bank', 'bic', 'iban', 'mannvoll', 'mann'], o = Object.assign({}, S.settings);
    keys.forEach(function (k) { o[k] = val('s-' + k); });
    if (C.nonLatin1(keys.map(function (k) { return o[k]; }).join(''))) return setErr('Реквизиты вводятся латиницей.');
    var dr = { root: val('s-d-root'), rechnungen: val('s-d-rechnungen'), eigenbelege: val('s-d-eigenbelege') };
    if (Object.keys(dr).some(function (k) { return dr[k] && !/^[\w-]{10,}$/.test(dr[k]); })) return setErr('Идентификатор папки Drive — это буквы, цифры, «-» и «_», например 1dnU_sH4_htAF…');
    o.drive = {}; Object.keys(dr).forEach(function (k) { if (dr[k] && dr[k] !== DRIVE_DEFAULT[k]) o.drive[k] = dr[k]; });
    o.lastIssued = n; o.openingDate = val('s-openingDate'); o.opening = op; o.kvLimit = kv; o.kuLimit = ku;
    busy(btn, true);
    putSettings(o).then(function () { closeSheet(); toast('Настройки сохранены'); }).catch(function (e) { busy(btn, false); setErr(dbErr(e)); });
  }

  /* ---------- Eigenbeleg ---------- */
  var ebFor = null;
  function sheetEigen(entryId) {
    var e = entryId && S.entries.find(function (x) { return x.id === entryId; }); ebFor = e ? e.id : null;
    var nr = (S.entries.filter(function (x) { return x.beleg && x.beleg.kind === 'eigenbeleg' && String(x.date).indexOf(today().slice(0, 4)) === 0; }).length + 1) + '/' + today().slice(0, 4);
    openSheet('<h2>Eigenbeleg</h2><p class="hint">Один документ на одну покупку без чека. Текст вводится латиницей. Документ распечатывается и подписывается.</p>' +
      '<div class="row">' + fld('eb-nr', 'Номер', 'text', nr) + fld('eb-date', 'Дата расхода', 'date', e ? e.date : today()) + '</div>' +
      '<div class="row">' + fld('eb-amt', 'Сумма, EUR', 'text', e ? C.fmtMoney(e.amount) : '', 'inputmode="decimal" placeholder="0,00"') + fld('eb-emp', 'Empfänger', 'text', e ? e.party || '' : '') + '</div>' +
      fld('eb-zweck', 'Zweck', 'text', e ? e.text || '' : '') + fld('eb-grund', 'Grund für Eigenbeleg', 'text', 'Originalbeleg nicht erhalten') + fld('eb-zahl', 'Zahlung', 'text', e ? ({ G: 'Geschäftskonto', P: 'privat (Inhaberin)', E: 'Ehemann', B: 'bar' })[e.way] : '') +
      (e ? '<p class="hint">Документ будет привязан к записи «' + esc(e.text) + '» от ' + esc(C.deDate(e.date)) + '.</p>' :
        '<label class="chk"><input type="checkbox" id="eb-j" checked><span>Внести расход в журнал</span></label><div class="row" id="eb-jw"><label class="f" for="eb-way">Счёт оплаты<select id="eb-way">' + WAYS_FOR.ausgabe.map(function (w) { return '<option value="' + w + '">' + WAY_RU[w] + '</option>'; }).join('') + '</select></label><label class="f" for="eb-cat">Статья<select id="eb-cat">' + catOptions('ausgabe', '') + '</select></label></div>') +
      '<p class="err" role="alert"></p><div class="row wrap"><button class="btn ghost" data-act="sheet-close">Закрыть</button><button class="btn" data-act="eb-pdf">PDF на устройство</button><button class="btn pri right" data-act="eb-drive">Сохранить в Drive</button></div>');
  }
  function eigenData() {
    var amt = C.parseMoney(val('eb-amt')), f = { nr: val('eb-nr'), date: val('eb-date'), emp: val('eb-emp'), zweck: val('eb-zweck'), grund: val('eb-grund'), zahl: val('eb-zahl') };
    if (amt == null || amt <= 0) { setErr('Сумма должна быть числом больше нуля.'); return null; }
    if (!f.date || !f.emp || !f.zweck) { setErr('Заполните дату, получателя и назначение.'); return null; }
    if (C.nonLatin1(Object.keys(f).map(function (k) { return f[k]; }).join(''))) { setErr('Текст вводится латиницей: кириллица в PDF не отображается.'); return null; }
    setErr(''); f.amt = amt; return f;
  }
  function eigenPdf(f) {
    var d = pdfDoc(), y = 260.8, s = S.settings; pdfHead(d);
    d.setFont(FONT, 'bold'); d.setFontSize(13.59); d.text('Eigenbeleg Nr. ' + f.nr, XL, 226.8);
    d.setFontSize(FS);
    [['Datum der Ausgabe', C.deDate(f.date)], ['Betrag', C.fmtMoney(f.amt) + ' EUR'], ['Empfänger', f.emp], ['Zweck', f.zweck], ['Grund für Eigenbeleg', f.grund], ['Zahlung', f.zahl]].forEach(function (r) {
      d.setFont(FONT, 'bold'); d.text(r[0] + ':', XL, y); d.setFont(FONT, 'normal');
      var l = d.splitTextToSize(r[1] || '-', 283); l.forEach(function (t, k) { d.text(t, 198.4, y + k * LH); }); y += l.length * LH + 8.5;
    });
    y += 45; d.text(String(s.ort || '').replace(/^\d+\s*/, '') + ', ' + C.deDate(today()), XL, y);
    d.setDrawColor(0, 0, 0); d.setLineWidth(0.6); d.line(283.5, y + 2.8, XR, y + 2.8); d.setFontSize(7.5); d.text('Unterschrift ' + (s.inh || ''), 283.5, y + 14);
    return d;
  }
  function eigenGo(kind, btn) {
    var f = eigenData(); if (!f) return;
    var d, name = 'Eigenbeleg_' + f.date + '_' + f.nr.replace(/[^\w-]+/g, '-') + '.pdf';
    try { d = eigenPdf(f); } catch (er) { return setErr('Не удалось собрать PDF: ' + (er.message || er)); }
    var blob = pdfBlob(d), jOn = !ebFor && $('#eb-j') && $('#eb-j').checked;
    var entry = ebFor ? S.entries.find(function (x) { return x.id === ebFor; }) : jOn ? { id: newId('e'), date: f.date, type: 'ausgabe', way: val('eb-way'), amount: f.amt, party: f.emp, text: f.zweck, doc: 'Eigenbeleg ' + f.nr, createdAt: new Date().toISOString() } : null;
    if (entry && !ebFor && val('eb-cat')) entry.cat = val('eb-cat');
    if (kind === 'pdf') {
      saveBlob(name, blob);
      if (entry && !ebFor) { putEntry(Object.assign({}, entry, { beleg: { kind: 'eigenbeleg', name: name, at: today() } })); ebFor = entry.id; toast('PDF сохранён, расход внесён в журнал'); }
      else if (entry) patchEntry(entry.id, { beleg: { kind: 'eigenbeleg', name: name, at: today() } });
      return;
    }
    busy(btn, true);
    withDrive(function () {
      return B.upload({ name: name, mime: 'application/pdf', data: blob, parent: drive().eigenbelege }).then(function (r) {
        var bl = { kind: 'eigenbeleg', id: r.id, name: r.name || name, link: r.webViewLink || '', at: today() };
        var p = entry ? (ebFor ? patchEntry(entry.id, { beleg: bl }) : putEntry(Object.assign({}, entry, { beleg: bl }))) : Promise.resolve();
        return p.then(function () { closeSheet(); toast('Eigenbeleg сохранён в Drive' + (entry ? (ebFor ? ' и привязан к записи' : ', расход внесён в журнал') : '')); });
      });
    });
    setTimeout(function () { busy(btn, false); }, 1500);
  }
