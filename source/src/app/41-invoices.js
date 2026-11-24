  function reqOk() { var s = S.settings; return !!(s.inh && s.strasse && s.ort && s.steuernr && s.iban); }
  function ivName(iv) { return (iv.rcpt || (iv.client && iv.client.name) || '').split(/\n/)[0]; }
  function findIv(no) { return S.invoices.find(function (x) { return x.no === no; }); }
  function ivStatus(iv) {
    if (iv.status === 'storniert') return '<span class="pill mute">отменён</span>';
    if (iv.status === 'bezahlt') return '<span class="pill ok">оплачен ' + (iv.paid && iv.paid.way === 'B' ? 'наличными' : 'переводом') + '</span>';
    var t = today();
    if (C.isOverdue(iv, t)) return '<span class="pill stop">просрочен на ' + C.daysBetween(iv.due, t) + ' дн.</span>';
    return '<span class="pill warn">ожидает оплаты' + (iv.due ? ' до ' + esc(C.deDate(iv.due)) : '') + '</span>';
  }
  function ivRow(iv) {
    var extra = iv.settledBy ? ' <span class="pill mute">учтена в ' + esc(iv.settledBy) + '</span>' : '';
    return '<button class="item tap' + (iv.status === 'storniert' ? ' void' : '') + '" data-act="iv-open" data-no="' + esc(iv.no) + '"><span class="main"><b>' + esc(ivName(iv)) + '</b><span class="meta">' + esc(iv.no) + ' · ' + esc(iv.title || 'Rechnung') + ' · ' + esc(C.deDate(iv.date)) + '</span><span class="meta">' + ivStatus(iv) + extra + '</span></span><span class="amt num">' + eur(iv.total) + '</span></button>';
  }
  function vInvoices() {
    var all = S.invoices.slice().sort(function (a, b) { return a.no < b.no ? 1 : -1; }), open = all.filter(function (v) { return v.status === 'offen'; });
    var list = ivf === 'open' ? open : all, sum = open.reduce(function (a, v) { return a + v.total; }, 0);
    var h = '<div class="row"><h2>Счета</h2><button class="btn pri right" data-act="iv-new">Новый счёт</button></div>';
    if (!reqOk()) h += '<div class="banner">Для выставления счетов заполните реквизиты: «Ещё» → «Настройки».</div>';
    h += '<div class="seg" role="tablist"><button role="tab" data-act="ivf" data-f="open" aria-selected="' + (ivf === 'open') + '">Открытые · ' + open.length + '</button><button role="tab" data-act="ivf" data-f="all" aria-selected="' + (ivf === 'all') + '">Все · ' + all.length + '</button></div>';
    if (ivf === 'open' && open.length) h += '<p class="hint">Ждём оплату: <b class="num">' + eur(sum) + '</b></p>';
    h += '<div class="card"><div class="list">' + (list.length ? list.map(ivRow).join('') : '<div class="empty">' + (ivf === 'open' ? 'Неоплаченных счетов нет.' : 'Счета ещё не выставлялись.') + '</div>') + '</div></div>';
    h += '<p class="hint">Следующий номер: <b class="num">' + esc(C.nextInvoiceNo(S.invoices, today(), S.settings.lastIssued)) + '</b>. Выставленный счёт не редактируется, возможна только отмена.</p>';
    return h;
  }
  function sheetIv(no) {
    var iv = findIv(no); if (!iv) return;
    var t = today(), share = B && typeof navigator !== 'undefined' && navigator.share;
    var h = '<h2>' + esc(iv.title || 'Rechnung') + ' ' + esc(iv.no) + '</h2><p>' + ivStatus(iv) + (iv.settledBy ? ' <span class="pill mute">учтена в ' + esc(iv.settledBy) + '</span>' : '') + '</p>' +
      '<div class="card"><p class="pre">' + esc(iv.rcpt || ivName(iv)) + '</p><div class="list">' + iv.items.map(function (it) { return '<div class="item"><span class="main">' + esc(it.text) + '<span class="meta">' + C.fmtQty(it.qty) + ' × ' + eur(it.price) + '</span></span><span class="amt num">' + eur(C.lineTotal(it.qty, it.price)) + '</span></div>'; }).join('') + '</div>' +
      (iv.deductions ? iv.deductions.map(function (d) { return '<div class="row"><span class="hint">' + esc(dedLabel(d)) + '</span><span class="right num">−' + eur(d.amount) + '</span></div>'; }).join('') : '') +
      '<div class="row strong"><span>' + (iv.deductions ? 'Restbetrag' : 'Rechnungsbetrag') + '</span><span class="right num">' + eur(iv.total) + '</span></div>' +
      '<p class="hint">Дата счёта ' + esc(C.deDate(iv.date)) + ' · ' + esc(iv.llabel || 'Leistungsdatum') + ' ' + esc(C.deDate(iv.ldate)) + (iv.paid ? ' · оплачен ' + esc(C.deDate(iv.paid.date)) : '') + '</p>' +
      ((iv.reminders || []).length ? '<p class="hint">Напоминания: ' + iv.reminders.map(function (r) { return esc(C.deDate(r.date)); }).join(', ') + '</p>' : '') + '</div>';
    h += '<h3>Документ</h3><div class="acts"><button class="btn" data-act="iv-pdf" data-no="' + esc(no) + '">PDF на устройство</button>' + (share ? '<button class="btn" data-act="iv-share" data-no="' + esc(no) + '">Отправить…</button>' : '') +
      '<button class="btn" data-act="iv-drive" data-no="' + esc(no) + '">PDF в Google Drive</button><button class="btn ghost" data-act="iv-gdoc" data-no="' + esc(no) + '">Google Doc</button></div>';
    h += '<h3>Действия</h3><div class="acts">';
    if (iv.status === 'offen') h += '<button class="btn pri" data-act="iv-pay" data-no="' + esc(no) + '">Отметить оплату</button>';
    if (iv.status === 'offen' && iv.due && iv.due < t) h += '<button class="btn" data-act="iv-remind" data-no="' + esc(no) + '">Напоминание об оплате</button>';
    h += '<button class="btn" data-act="iv-repeat" data-no="' + esc(no) + '">Новый счёт по образцу</button>';
    if (iv.status !== 'storniert' && !iv.settledBy) h += '<button class="btn ghost danger" data-act="iv-storno" data-no="' + esc(no) + '">Отменить счёт</button>';
    h += '</div>';
    openSheet(h);
  }

  /* ---------- форма счёта ---------- */
  function catSelect(i) {
    return '<select class="tpl" data-it="tpl" id="it-s-' + i + '" aria-label="Выбрать позицию из списка"><option value="">Выбрать из списка…</option>' +
      CATALOG.map(function (gr) { return '<optgroup label="' + esc(gr[0]) + '">' + gr[1].map(function (o) { return '<option value="' + esc(o[0]) + '">' + esc(o[0]) + ' — ' + esc(o[1]) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select>';
  }
  function itemRow(i, it) {
    it = it || {};
    return '<div class="itemwrap" data-wrap>' + catSelect(i) + '<div class="lineitem" data-row><textarea aria-label="Beschreibung" placeholder="Beschreibung" data-it="text" id="it-t-' + i + '" rows="2">' + esc(it.text || '') + '</textarea><input aria-label="Menge" placeholder="Menge" data-it="qty" value="' + esc(it.qty ? C.fmtQty(it.qty) : '1') + '" inputmode="decimal" id="it-q-' + i + '"><input aria-label="Einzelpreis" placeholder="Preis" data-it="price" inputmode="decimal" id="it-p-' + i + '" value="' + esc(it.price ? C.fmtMoney(it.price) : '') + '"><button type="button" data-act="it-del" aria-label="Удалить позицию">×</button></div></div>';
  }
  function dueSelect() {
    return '<label class="f" for="iv-duesel">Пояснение к сроку<select id="iv-duesel"><option value="">без пояснения</option>' +
      DUE_NOTES.map(function (gr) { return '<optgroup label="' + esc(gr[0]) + '">' + gr[1].map(function (o) { return '<option value="' + esc(o[0]) + '" data-days="' + o[1] + '">' + esc(o[0]) + '</option>'; }).join('') + '</optgroup>'; }).join('') +
      '<option value="__own">Свой вариант…</option></select></label>';
  }
  function prepayCandidates() {
    return S.invoices.filter(function (v) { return PREPAY[v.title] && v.status === 'bezahlt' && !v.settledBy; }).sort(function (a, b) { return a.no < b.no ? 1 : -1; });
  }
  function readDeductions() {
    var out = [];
    document.querySelectorAll('#iv-prepay input[type=checkbox]:checked').forEach(function (cb) {
      var v = findIv(cb.value); if (v) out.push({ no: v.no, date: v.date, kind: PREPAY[v.title], amount: v.total });
    });
    return out;
  }
  function dedLabel(dd) { return 'abzüglich ' + dd.kind + ' lt. Rechnung ' + dd.no + ' vom ' + C.deDate(dd.date); }
  var rowN = 0, ivDraft = null;
  function sheetInvoice(pre) {
    pre = pre || {}; rowN = 0; ivDraft = null;
    var k = 'Rechnung', no = C.nextInvoiceNo(S.invoices, today(), S.settings.lastIssued), cl = C.clientsFrom(S.invoices);
    var items = (pre.items && pre.items.length ? pre.items : [null]).map(function (it) { return itemRow(rowN++, it); }).join('');
    openSheet('<div id="iv-form"><h2>Новый счёт</h2>' +
      '<div class="row"><label class="f" for="iv-kind">Вид документа<select id="iv-kind">' + Object.keys(KINDS).map(function (x) { return '<option value="' + x + '">' + x + ' — ' + KINDS[x].ru + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="row">' + fld('iv-title', 'Заголовок в счёте', 'text', k, 'data-auto="1"') + '</div>' +
      '<div id="iv-prepay" class="card" hidden></div>' +
      '<div class="row">' + fld('iv-no', 'Rechnungsnummer', 'text', no, 'inputmode="numeric" data-auto="1"') + fld('iv-date', 'Rechnungsdatum', 'date', today()) + '</div>' +
      (cl.length ? '<label class="f" for="iv-client">Клиент из прошлых счетов<select id="iv-client"><option value="">— новый получатель —</option>' + cl.map(function (c, i) { return '<option value="' + i + '">' + esc(c.name) + ' · ' + c.count + ' ' + plural(c.count, 'счёт', 'счёта', 'счетов') + '</option>'; }).join('') + '</select></label>' : '') +
      '<label class="f" for="iv-rcpt">Rechnung an (получатель, построчно; для другой страны — страна последней строкой)<textarea id="iv-rcpt" rows="4" placeholder="Name&#10;Firma&#10;Straße Nr.&#10;PLZ Ort">' + esc(pre.rcpt || '') + '</textarea></label>' +
      '<div class="row">' + fld('iv-llabel', 'Подпись даты услуги', 'text', KINDS[k].llabel, 'data-auto="1"') + fld('iv-ldate', 'Дата услуги', 'date', today()) + '</div>' +
      '<h3>Positionen</h3><div id="iv-items" class="col">' + items + '</div>' +
      '<div class="row"><button type="button" class="btn sm" data-act="it-add">Добавить позицию</button><span class="right total num" id="iv-total">0,00 €</span></div>' +
      '<div id="iv-sums" class="sums" hidden></div>' +
      '<div class="row">' + fld('iv-due', 'Zahlbar bis', 'date', '') + dueSelect() + '</div>' +
      '<div id="iv-ownwrap" hidden>' + fld('iv-duenote', 'Своё пояснение', 'text', '', 'placeholder="z. B. vor dem 20.12.2026"') + '</div>' +
      '<label class="f" for="iv-hint">Hinweise (дополнительные строки под суммой)<textarea id="iv-hint" data-auto="1"></textarea></label>' +
      fld('iv-close', 'Заключительная строка', 'text', 'Vielen Dank für Ihren Auftrag!') +
      '<label class="f" for="iv-pay">Оплата<select id="iv-pay"><option value="offen">Перевод — ожидается</option><option value="B">Оплачено наличными</option><option value="G">Оплачено переводом — средства поступили</option></select></label>' +
      '<p class="hint">Строка «Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.» добавляется всегда. Текст счёта — латиницей.</p>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="iv-check">Проверить счёт</button></div></div>' +
      '<div id="iv-prev" hidden></div>');
    updTotal();
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
  /* черновик из формы; ошибки, при которых выставить нельзя, возвращаются строкой */
  function readDraft() {
    var rcpt = (document.getElementById('iv-rcpt').value || '').split(/\n/).map(function (x) { return x.trim().replace(/^[«»„“”"]+|[«»„“”"]+$/g, ''); }).filter(Boolean).join('\n');
    var date = val('iv-date'), ldate = val('iv-ldate'), no = val('iv-no'), title = val('iv-title'), llabel = val('iv-llabel');
    var hint = (document.getElementById('iv-hint').value || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!reqOk()) return 'Заполните реквизиты в настройках: имя, адрес, Steuernummer, IBAN.';
    if (!title) return 'Укажите заголовок документа.';
    if (!rcpt) return 'Укажите получателя.';
    if (!date || !ldate) return 'Укажите дату счёта и дату услуги.';
    if (!/^\d{9}$/.test(no)) return 'Номер счёта состоит из 9 цифр: год, месяц и порядковый номер, например 202611002.';
    if (no.slice(0, 6) !== date.slice(0, 7).replace('-', '')) return 'Первые шесть цифр номера должны соответствовать году и месяцу даты счёта.';
    var it = readItems();
    if (it.bad) return it.bad;
    if (!it.rows.length) return 'Добавьте хотя бы одну позицию с ценой.';
    var dueNote = dueNoteVal();
    var all = [title, rcpt, llabel, hint.join(''), dueNote, val('iv-close')].concat(it.rows.map(function (x) { return x.text; })).join('');
    if (C.nonLatin1(all)) return 'Текст счёта вводится латиницей: кириллица в PDF не отображается.';
    var schluss = val('iv-kind') === 'Schlussrechnung', ded = schluss ? readDeductions() : [], st = C.schlussTotals(it.rows, ded);
    if (schluss && !ded.length) return 'Отметьте предоплату, которую нужно вычесть.';
    if (!st.ok) return 'Предоплата больше стоимости работ: проверьте позиции.';
    if (schluss ? st.rest < 0 : st.rest <= 0) return 'Сумма счёта должна быть больше нуля.';
    var d = { no: no, title: title, date: date, ldate: ldate, llabel: llabel || 'Leistungsdatum', rcpt: rcpt, client: { name: rcpt.split(/\n/)[0] }, items: it.rows, total: st.rest,
      due: val('iv-due'), dueNote: dueNote, hint: hint, closing: val('iv-close'), status: 'offen', pay: val('iv-pay') };
    if (schluss) { d.gross = st.gross; d.deductions = ded; }
    if (schluss && st.rest === 0) { d.status = 'bezahlt'; d.paid = { date: date, way: 'G' }; d.zeroRest = true; }
    else if (d.pay !== 'offen') { d.status = 'bezahlt'; d.paid = { date: date, way: d.pay }; d.paidAtIssue = true; }
    return d;
  }
  function ivCheck() {
    var d = readDraft();
    if (typeof d === 'string') return setErr(d);
    setErr('');
    var ws = C.invoiceWarnings(d, S.invoices), stop = ws.some(function (w) { return w.level === 'stop'; });
    ivDraft = d;
    var lbl = { stop: 'Нельзя выставить', warn: 'Проверьте', info: 'К сведению' };
    var p = $('#iv-prev');
    p.innerHTML = '<h2>Проверка счёта</h2>' +
      (ws.length ? ws.map(function (w) { return '<div class="verdict ' + (w.level === 'info' ? 'ok' : w.level) + '"><b>' + lbl[w.level] + '.</b> ' + esc(w.text) + '</div>'; }).join('') : '<div class="verdict ok">Замечаний нет.</div>') +
      '<div class="paperwrap" data-act="paper-zoom" title="Нажмите, чтобы увеличить">' + paperHtml(d) + '</div>' +
      '<p class="hint">Так счёт будет выглядеть в PDF (нажмите на лист, чтобы увеличить). Номер ' + esc(d.no) + ' присваивается при выставлении; после выставления счёт изменить нельзя.</p>' +
      '<p class="err" role="alert"></p><div class="row wrap"><button class="btn ghost" data-act="iv-edit">← Изменить</button><button class="btn" data-act="iv-draft">PDF-черновик</button>' +
      (stop ? '' : '<button class="btn pri right" data-act="iv-issue">Выставить счёт</button>') + '</div>';
    $('#iv-form').hidden = true; p.hidden = false; $('#sheet .sheet').scrollTop = 0;
    var pw = $('.paperwrap', p), pp = $('.paper', p); if (pw && pp) pp.style.zoom = Math.min(1, (pw.clientWidth - 22) / 595);
  }
  function ivEdit() { $('#iv-prev').hidden = true; $('#iv-form').hidden = false; ivDraft = null; }
  function issueInvoice(btn) {
    var d = ivDraft; if (!d) return;
    var expected = C.nextInvoiceNo(S.invoices, d.date, S.settings.lastIssued), ded = d.deductions || [];
    setErr(''); busy(btn, true);
    issueWithNumber(d.date, d.no === expected ? '' : d.no, function (no) {
      var iv = Object.assign({}, d, { no: no, createdAt: new Date().toISOString() }); delete iv.pay;
      if (iv.paidAtIssue) { iv.status = 'offen'; delete iv.paid; }   /* оплата при выставлении проводится ниже, вместе с записью в журнале */
      return iv;
    }).then(function (iv) {
      var ch = Promise.resolve();
      ded.forEach(function (x) { ch = ch.then(function () { var v = findIv(x.no); return v ? putInvoice(Object.assign({}, v, { settledBy: iv.no })) : null; }); });
      return ch.then(function () {
        if (!d.paidAtIssue) return iv;
        return payInvoice(Object.assign({}, iv, { paidAtIssue: true }), d.date, d.pay).then(function () { return iv; });
      });
    }).then(function (iv) { closeSheet(); toast('Счёт ' + iv.no + ' выставлен'); setTimeout(function () { sheetIv(iv.no); }, 50); })
      .catch(function (e) { busy(btn, false); setErr(e && e.code ? dbErr(e) : 'Счёт не выставлен: ' + (e && e.message || e)); });
  }
  function entryForInvoice(no) {
    var st = C.stornoedIds(S.entries);
    return S.entries.find(function (e) { return e.invoiceNo === no && !e.stornoOf && !st[e.id]; });
  }
  function payInvoice(iv, date, way) {
    var ex = entryForInvoice(iv.no);
    var e = ex || { id: newId('e'), date: date, type: 'einnahme', way: way, amount: iv.total, party: ivName(iv), text: (iv.title || 'Rechnung') + ' ' + iv.no, doc: iv.no, invoiceNo: iv.no, cat: 'umsatz', createdAt: new Date().toISOString() };
    return (ex ? Promise.resolve() : putEntry(e)).then(function () {
      return putInvoice(Object.assign({}, iv, { status: 'bezahlt', paid: { date: e.date, way: e.way }, entryId: e.id }));
    });
  }
  function sheetPay(no) {
    var iv = findIv(no); if (!iv) return;
    openSheet('<h2>Оплата счёта ' + esc(no) + '</h2><p class="hint">Сумма ' + eur(iv.total) + '. В журнале будет создана запись выручки.</p><div class="row">' + fld('pay-date', 'Дата поступления', 'date', today()) +
      '<label class="f" for="pay-way">Способ оплаты<select id="pay-way"><option value="G">Перевод на рабочий счёт</option><option value="B">Наличные</option></select></label></div>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="iv-open" data-no="' + esc(no) + '">Назад</button><button class="btn pri right" data-act="pay-ok" data-no="' + esc(no) + '">Отметить оплаченным</button></div>');
  }
  function sheetStornoIv(no) {
    var iv = findIv(no); if (!iv) return;
    openSheet('<h2>Отмена счёта ' + esc(no) + '</h2><p class="hint">Номер остаётся занятым, счёт помечается как отменённый.' + (iv.status === 'bezahlt' && !iv.zeroRest ? ' В журнале будет создана отменяющая запись на ' + eur(iv.total) + '.' : '') + (iv.deductions ? ' Предоплаты снова станут доступны для вычета.' : '') + ' Действие необратимо.</p>' +
      '<p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="iv-open" data-no="' + esc(no) + '">Назад</button><button class="btn pri right danger" data-act="ivst-ok" data-no="' + esc(no) + '">Отменить счёт</button></div>');
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
      .then(function () { closeSheet(); toast('Счёт отменён'); })
      .catch(function (er) { busy(btn, false); setErr(dbErr(er)); });
  }
  function sheetRemind(no) {
    var iv = findIv(no); if (!iv) return;
    openSheet('<h2>Напоминание об оплате</h2><p class="hint">Zahlungserinnerung к счёту ' + esc(no) + ' на ' + eur(iv.total) + ', срок был ' + esc(C.deDate(iv.due)) + '. Вежливое напоминание без пени и сборов.</p>' +
      fld('rm-by', 'Новый срок оплаты', 'date', C.addDays(today(), 7)) +
      '<p class="err" role="alert"></p><div class="row wrap"><button class="btn ghost" data-act="iv-open" data-no="' + esc(no) + '">Назад</button><button class="btn" data-act="rm-pdf" data-no="' + esc(no) + '">PDF</button>' +
      (navigator.share ? '<button class="btn" data-act="rm-share" data-no="' + esc(no) + '">Отправить…</button>' : '') + '<button class="btn pri" data-act="rm-drive" data-no="' + esc(no) + '">В Google Drive</button></div>');
  }
  function noteReminder(iv, by) { var r = (iv.reminders || []).concat([{ date: today(), payBy: by }]); return putInvoice(Object.assign({}, iv, { reminders: r })); }
