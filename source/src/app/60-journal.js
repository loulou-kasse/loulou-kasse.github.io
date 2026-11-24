
  /* ---------- журнал ---------- */
  function shown(e) { return ((e.type === 'einnahme' || e.type === 'einlage') ? 1 : -1) * e.amount; }
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
  function catLabel(e) { var c = C.catOf(e); return c ? C.CAT_INFO[c].ru : ''; }
  function entryRow(e, st) {
    var v = shown(e), isVoid = st[e.id], meta = [C.deDate(e.date), TYPE_RU[e.type], e.party].filter(Boolean).map(esc).join(' · ');
    var tags = '';
    if (e.stornoOf) tags += '<span class="pill mute">отмена</span>';
    else if (isVoid) tags += '<span class="pill mute">отменена</span>';
    if (C.needsBeleg(e, st)) tags += '<span class="pill stop">без чека</span>';
    else if (e.beleg) tags += '<span class="pill ok">чек</span>';
    if ((e.type === 'einnahme' || e.type === 'ausgabe') && !e.stornoOf && !C.catOf(e)) tags += '<span class="pill warn">без статьи</span>';
    else if (catLabel(e)) tags += '<span class="pill mute">' + esc(catLabel(e)) + '</span>';
    return '<button class="item tap' + (isVoid ? ' void' : '') + '" data-act="e-open" data-id="' + esc(e.id) + '"><span class="main"><b><span class="way" title="' + esc(WAY_RU[e.way]) + '">' + e.way + '</span>' + esc(e.text || TYPE_RU[e.type]) + '</b><span class="meta">' + meta + '</span>' + (tags ? '<span class="meta">' + tags + '</span>' : '') + '</span><span class="amt num ' + (v >= 0 ? 'plus' : 'minus') + '">' + (v > 0 ? '+' : '') + eur(v) + '</span></button>';
  }
  function byDateDesc(a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.createdAt) < String(b.createdAt) ? 1 : -1; }
  function tiles(sm) {
    return '<div class="tiles t5"><div class="tile"><span>Выручка</span><b>' + eur(sm.einnahme) + '</b></div><div class="tile"><span>Расходы</span><b>' + eur(sm.ausgabe) + '</b></div><div class="tile hi"><span>Прибыль</span><b>' + eur(sm.gewinn) + '</b></div>' +
      '<div class="tile"><span>Изъятия</span><b>' + eur(sm.entnahme) + '</b></div><div class="tile"><span>Вклады</span><b>' + eur(sm.einlage) + '</b></div></div>';
  }
  function jMatch(e, st) {
    if (jf.kind === 'inc' && e.type !== 'einnahme') return false;
    if (jf.kind === 'exp' && e.type !== 'ausgabe') return false;
    if (jf.kind === 'nobeleg' && !C.needsBeleg(e, st)) return false;
    if (jf.kind === 'nocat' && !((e.type === 'einnahme' || e.type === 'ausgabe') && !e.stornoOf && !C.catOf(e))) return false;
    if (jf.q) {
      var q = jf.q.toLowerCase(), hay = [e.text, e.party, e.doc, C.fmtMoney(e.amount), C.deDate(e.date), catLabel(e)].join(' ').toLowerCase();
      if (q.split(/\s+/).some(function (w) { return w && hay.indexOf(w) < 0; })) return false;
    }
    return true;
  }
  function filterBar() {
    var k = [['all', 'Все'], ['inc', 'Доходы'], ['exp', 'Расходы'], ['nobeleg', 'Без чека'], ['nocat', 'Без статьи']];
    return '<div class="row"><label class="f grow" for="j-q"><span class="vh">Поиск</span><input id="j-q" type="search" placeholder="Поиск: текст, контрагент, сумма" value="' + esc(jf.q) + '"></label></div>' +
      '<div class="seg chips">' + k.map(function (x) { return '<button data-act="jf" data-f="' + x[0] + '" aria-pressed="' + (jf.kind === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div>';
  }
  function vJournal() {
    var s = S.settings, st = C.stornoedIds(S.entries), months = monthList(), all = month === 'all', filtering = jf.q || jf.kind !== 'all';
    if (!all && months.indexOf(month) < 0) { months.push(month); months.sort().reverse(); }
    var idx = months.indexOf(month);
    var sel = '<select id="j-month" aria-label="Период"><option value="all"' + (all ? ' selected' : '') + '>Все месяцы</option>' +
      months.map(function (m) { return '<option value="' + m + '"' + (m === month ? ' selected' : '') + '>' + monthName(m) + '</option>'; }).join('') + '</select>';
    var h = '<div class="row"><h2>Журнал</h2><button class="btn pri right" data-act="j-new">Новая запись</button></div><div class="row">' +
      '<button class="btn sm" data-act="j-prev" aria-label="Предыдущий месяц"' + (all || idx >= months.length - 1 ? ' disabled' : '') + '>‹</button>' +
      '<label class="f grow" for="j-month"><span class="vh">Период</span>' + sel + '</label>' +
      '<button class="btn sm" data-act="j-next" aria-label="Следующий месяц"' + (all || idx <= 0 ? ' disabled' : '') + '>›</button></div>';
    var inPeriod = S.entries.filter(function (e) { return C.validEntry(e) && (all || e.date.indexOf(month) === 0); });
    if (all) {
      var rows = months.slice().reverse().map(function (m) { return { m: m, s: C.sums(S.entries, m) }; });
      var tot = C.sums(S.entries, ''), chk = { einnahme: 0, ausgabe: 0, gewinn: 0 };
      rows.forEach(function (r) { chk.einnahme += r.s.einnahme; chk.ausgabe += r.s.ausgabe; chk.gewinn += r.s.gewinn; });
      var ok = chk.einnahme === tot.einnahme && chk.ausgabe === tot.ausgabe && chk.gewinn === tot.gewinn;
      h += tiles(tot) + '<details class="card"><summary><h3>По месяцам</h3></summary><div style="overflow-x:auto"><table class="mt"><thead><tr><th>Месяц</th><th>Выручка</th><th>Расходы</th><th>Прибыль</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td><button class="lnk" data-act="j-goto" data-m="' + r.m + '">' + monthName(r.m) + '</button></td><td class="num">' + C.fmtMoney(r.s.einnahme) + '</td><td class="num">' + C.fmtMoney(r.s.ausgabe) + '</td><td class="num">' + C.fmtMoney(r.s.gewinn) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td>Итого</td><td class="num">' + C.fmtMoney(tot.einnahme) + '</td><td class="num">' + C.fmtMoney(tot.ausgabe) + '</td><td class="num">' + C.fmtMoney(tot.gewinn) + '</td></tr></tfoot></table></div>' +
        '<p>' + (ok ? '<span class="pill ok">Контроль</span> сумма месяцев равна итогу.' : '<span class="pill stop">Контроль не пройден</span> сумма месяцев не равна итогу: есть запись вне показанных месяцев.') + '</p></details>';
    } else {
      var sm = C.sums(S.entries, month), stmt = S.bank.statements[month], rec = C.reconcile(S.entries, s.opening || 0, s.openingDate || '', month, stmt == null ? null : stmt);
      h += tiles(sm);
      h += '<details class="card"' + (rec.ok === false ? ' open' : '') + '><summary><h3>Сверка с банком</h3>' + (rec.ok === true ? '<span class="pill ok">сходится</span>' : rec.ok === false ? '<span class="pill stop">расхождение</span>' : '') + '</summary><p>Расчётный остаток рабочего счёта на ' + esc(C.deDate(C.lastDayOfMonth(month))) + ': <b class="num">' + eur(rec.computed) + '</b></p>' +
        '<div class="row">' + fld('j-stmt', 'Остаток по выписке банка', 'text', stmt == null ? '' : C.fmtMoney(stmt), 'inputmode="decimal" placeholder="0,00"') + '<button class="btn" data-act="j-rec">Сверить</button></div>';
      if (rec.ok === true) h += '<p><span class="pill ok">Сходится</span> журнал и выписка совпадают до цента.</p>';
      else if (rec.ok === false) h += '<p><span class="pill stop">Расхождение ' + eur(rec.diff) + '</span> ' + (rec.diff > 0 ? 'по выписке больше, чем по журналу: не внесено поступление либо внесено лишнее списание.' : 'по выписке меньше, чем по журналу: не внесено списание либо внесено лишнее поступление.') + '</p>';
      else h += '<p class="hint">Укажите остаток из последней строки выписки за месяц. Учитываются только движения по рабочему счёту, начиная с остатка ' + eur(s.opening || 0) + (s.openingDate ? ' на ' + esc(C.deDate(s.openingDate)) : '') + '.</p>';
      h += '<button class="btn sm" data-act="bank-open">Загрузить выписку CSV и сравнить</button></details>';
    }
    h += filterBar();
    var list = inPeriod.filter(function (e) { return jMatch(e, st); }).sort(byDateDesc), cur = '', body = '';
    list.forEach(function (e) { var m = e.date.slice(0, 7); if (all && m !== cur) { cur = m; body += '<h3 class="mh">' + monthName(m) + '</h3>'; } body += entryRow(e, st); });
    h += '<div class="card"><div class="list">' + (body || '<div class="empty">' + (filtering ? 'Ничего не найдено.' : all ? 'Записей пока нет.' : 'За ' + monthName(month).toLowerCase() + ' записей нет.') + '</div>') + '</div></div>';
    h += '<div class="row"><span class="hint">G — рабочий счёт, P — личный счёт владелицы, E — счёт супруга, B — наличные.</span><button class="btn sm right" data-act="j-csv">CSV</button></div>';
    return h;
  }
  function catOptions(type, cur) {
    var list = C.CATS[type]; if (!list) return '';
    return '<option value="">— выберите статью —</option>' + list.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === cur ? ' selected' : '') + '>' + esc(c[1]) + ' · ' + esc(c[2]) + '</option>'; }).join('');
  }
  var entryPre = {};
  function sheetEntry(pre) {
    pre = pre || {}; entryPre = pre;
    var t = pre.type || 'ausgabe';
    var tpl = S.templates.length ? '<label class="f" for="e-tpl">Шаблон<select id="e-tpl"><option value="">— без шаблона —</option>' + S.templates.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; }).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + (x.amount ? ' · ' + eur(x.amount) : '') + '</option>'; }).join('') + '</select></label>' : '';
    openSheet('<h2>Новая запись</h2>' + tpl + '<div class="row"><label class="f" for="e-type">Вид операции<select id="e-type">' + C.TYPES.map(function (k) { return '<option value="' + k + '"' + (k === t ? ' selected' : '') + '>' + TYPE_RU[k] + ' — ' + C.TYPE_DE[k] + '</option>'; }).join('') + '</select></label>' +
      '<label class="f" for="e-way">Счёт<select id="e-way"></select></label></div>' +
      '<div class="row">' + fld('e-date', 'Дата оплаты', 'date', pre.date || today()) + fld('e-amt', 'Сумма, EUR', 'text', pre.amount ? C.fmtMoney(pre.amount) : '', 'inputmode="decimal" placeholder="0,00"') + '</div>' +
      fld('e-text', 'Текст', 'text', pre.text || '') + '<div class="row">' + fld('e-party', 'Контрагент', 'text', pre.party || '') + fld('e-doc', 'Номер документа', 'text', pre.doc || '') + '</div>' +
      '<label class="f" for="e-cat" id="e-catw">Статья (для годового отчёта EÜR)<select id="e-cat"></select></label>' +
      '<div id="e-belegw"><label class="f" for="e-file">Чек или счёт поставщика (фото или PDF)<input id="e-file" type="file" accept="image/*,application/pdf"></label>' +
      '<label class="chk"><input type="checkbox" id="e-nob"><span>Документа нет, выписки банка достаточно (комиссия банка и т.п.)</span></label></div>' +
      '<label class="chk"><input type="checkbox" id="e-savetpl"><span>Сохранить как шаблон для повторяющихся операций</span></label>' +
      '<p class="hint" id="e-note"></p><p class="err" role="alert"></p><div class="row"><button class="btn ghost" data-act="sheet-close">Отмена</button><button class="btn pri right" data-act="e-save">Сохранить</button></div>');
    fillWays(pre.way, pre.cat);
    if (pre.photo) setTimeout(function () { var f = document.getElementById('e-file'); if (f) f.click(); }, 60);
  }
  function fillWays(pref, cat) {
    var t = val('e-type'), sel = document.getElementById('e-way'), ws = WAYS_FOR[t];
    var cur = pref && ws.indexOf(pref) >= 0 ? pref : (ws.indexOf(sel.value) >= 0 ? sel.value : ws[0]);
    sel.innerHTML = ws.map(function (w) { return '<option value="' + w + '"' + (w === cur ? ' selected' : '') + '>' + WAY_RU[w] + '</option>'; }).join('');
    sel.disabled = ws.length === 1;
    var cs = document.getElementById('e-cat'), prev = cat != null ? cat : cs.value;
    cs.innerHTML = catOptions(t, prev); $('#e-catw').hidden = !C.CATS[t];
    if (t === 'einnahme' && !cs.value) cs.value = 'umsatz';
    $('#e-belegw').hidden = t !== 'ausgabe';
    $('#e-note').textContent = t === 'entnahme' || t === 'einlage' ? 'Движение по рабочему счёту, на прибыль не влияет.' : t === 'einnahme' ? 'Выручка по счёту клиента вносится через «Счета» → «Отметить оплату». Здесь — продажи без счёта, например букет за наличные.' : 'Расход учитывается один раз, датой фактической оплаты.';
  }
  function applyTpl(id) {
    var x = S.templates.find(function (t) { return t.id === id; }); if (!x) return;
    $('#e-type').value = x.type; fillWays(x.way, x.cat || '');
    $('#e-amt').value = x.amount ? C.fmtMoney(x.amount) : ''; $('#e-text').value = x.text || ''; $('#e-party').value = x.party || '';
    if (x.noBeleg) $('#e-nob').checked = true;
  }
  function saveEntry(btn) {
    var t = val('e-type'), w = val('e-way'), amt = C.parseMoney(val('e-amt')), date = val('e-date'), cat = C.CATS[t] ? val('e-cat') : '';
    var fileEl = document.getElementById('e-file'), file = t === 'ausgabe' && fileEl && fileEl.files && fileEl.files[0], nob = t === 'ausgabe' && $('#e-nob').checked;
    if (amt == null || amt <= 0) return setErr('Сумма должна быть числом больше нуля, например 37,80.');
    if (!date) return setErr('Укажите дату.');
    if (!val('e-text')) return setErr('Укажите текст операции.');
    if (WAYS_FOR[t].indexOf(w) < 0) return setErr('Такое сочетание не допускается.');
    var e = { id: newId('e'), date: date, type: t, way: w, amount: amt, party: val('e-party'), text: val('e-text'), doc: val('e-doc'), createdAt: new Date().toISOString() };
    if (cat) e.cat = cat; if (nob && !file) e.noBeleg = 'kontoauszug';
    busy(btn, true); setErr('');
    var go = function () {
      return putEntry(e).then(function () {
        if ($('#e-savetpl') && $('#e-savetpl').checked) putTemplate({ id: newId('t'), name: e.text, type: e.type, way: e.way, amount: e.amount, text: e.text, party: e.party, cat: e.cat || '', noBeleg: !!e.noBeleg });
        month = date.slice(0, 7); closeSheet(); toast('Записано');
        if (entryPre.fromBank) setTimeout(reopenBank, 300);
        else if (view !== 'journal' && view !== 'home') location.hash = '#journal'; else drawMain();
        if (file) {
          toast('Запись сохранена, загружаю документ в Drive…');
          attachBeleg(e, file).then(function () { toast('Документ сохранён в Drive: Belege › ' + date.slice(0, 7)); }, function (er) { toast('Документ не загружен: ' + (er && er.message || er) + '. Запись помечена «без чека».'); });
        }
      });
    };
    var fail = function (er) { busy(btn, false); setErr(dbErr(er)); };
    if (file && B && B.available() && !B.driveReady()) { B.connectDrive().then(go, function (er) { file = null; toast('Drive не подключён: запись сохраняется без документа. ' + (er && er.code ? B.authErr(er) : '')); return go(); }).catch(fail); return; }
    if (file && !(B && B.available())) file = null;
    go().catch(fail);
  }
  function sheetEntryView(id) {
    var e = S.entries.find(function (x) { return x.id === id; }); if (!e) return;
    var st = C.stornoedIds(S.entries), v = shown(e), canStorno = !e.stornoOf && !st[e.id] && !e.invoiceNo, cat = C.catOf(e);
    var h = '<h2 class="plain">' + esc(e.text || TYPE_RU[e.type]) + '</h2><p class="big num ' + (v >= 0 ? 'plus' : 'minus') + '">' + (v > 0 ? '+' : '') + eur(v) + '</p>' +
      '<div class="card"><dl class="kv"><dt>Дата</dt><dd>' + esc(C.deDate(e.date)) + '</dd><dt>Вид</dt><dd>' + esc(TYPE_RU[e.type]) + ' · ' + esc(C.TYPE_DE[e.type]) + '</dd><dt>Счёт</dt><dd>' + esc(WAY_RU[e.way]) + '</dd>' +
      (e.party ? '<dt>Контрагент</dt><dd>' + esc(e.party) + '</dd>' : '') + (e.doc ? '<dt>Документ</dt><dd>' + esc(e.doc) + '</dd>' : '') +
      (e.invoiceNo ? '<dt>Счёт клиенту</dt><dd><button class="lnk" data-act="iv-open" data-no="' + esc(e.invoiceNo) + '">' + esc(e.invoiceNo) + '</button></dd>' : '') +
      (e.stornoOf ? '<dt>Отменяет</dt><dd>запись от другой даты</dd>' : '') + (st[e.id] ? '<dt>Статус</dt><dd>отменена</dd>' : '') + (e.erstattet ? '<dt>Возмещение</dt><dd>проведено</dd>' : '') + '</dl></div>';
    if (C.CATS[e.type] && !e.stornoOf) h += '<label class="f" for="ev-cat">Статья EÜR<select id="ev-cat" data-id="' + esc(e.id) + '">' + catOptions(e.type, cat) + '</select></label>';
    if (e.type === 'ausgabe' && !e.stornoOf) {
      h += '<h3>Документ</h3>';
      if (e.beleg && e.beleg.id) h += '<p><span class="pill ok">есть</span> ' + (e.beleg.link ? '<a href="' + esc(e.beleg.link) + '" target="_blank" rel="noopener">' + esc(e.beleg.name || 'открыть в Drive') + '</a>' : esc(e.beleg.name || '')) + '</p>';
      else if (e.noBeleg) h += '<p><span class="pill mute">выписки достаточно</span> <button class="lnk" data-act="ev-nob" data-id="' + esc(e.id) + '" data-v="0">убрать отметку</button></p>';
      else h += '<p><span class="pill stop">без чека</span></p>';
      if (B && B.available() && !B.driveReady()) h += '<p class="hint">Документы хранятся в Google Drive.</p><button class="btn sm" data-act="drive-connect" data-reopen="' + esc(e.id) + '">Подключить Google Drive</button>';
      else h += '<label class="f" for="ev-file">' + (e.beleg ? 'Заменить документ' : 'Добавить фото или PDF чека') + '<input id="ev-file" type="file" accept="image/*,application/pdf" data-id="' + esc(e.id) + '"></label>';
      if (!e.beleg && !e.noBeleg) h += '<div class="acts"><button class="btn sm" data-act="ev-nob" data-id="' + esc(e.id) + '" data-v="1">Выписки достаточно</button><button class="btn sm" data-act="eb-new" data-id="' + esc(e.id) + '">Составить Eigenbeleg</button></div>';
    }
    h += '<div class="acts" style="margin-top:14px">' + (!e.stornoOf && !e.invoiceNo ? '<button class="btn sm" data-act="ev-tpl" data-id="' + esc(e.id) + '">Сохранить как шаблон</button>' : '') +
      (canStorno ? '<button class="btn sm ghost danger" data-act="j-storno" data-id="' + esc(e.id) + '">Отменить запись</button>' : '') + '</div>' +
      (e.invoiceNo && !e.stornoOf ? '<p class="hint">Запись создана оплатой счёта; отменяется вместе со счётом.</p>' : '') +
      '<p class="hint">Сумму и дату проведённой записи не меняют: ошибочную запись отменяют и вносят заново.</p>';
    openSheet(h);
  }
  function sheetStornoEntry(id) {
    var e = S.entries.find(function (x) { return x.id === id; }); if (!e) return;
    openSheet('<h2>Отмена записи</h2><p class="hint">«' + esc(e.text) + '», ' + eur(e.amount) + '. Исходная запись сохраняется, к ней добавляется отменяющая с текущей датой.</p><p class="err" role="alert"></p>' +
      '<div class="row"><button class="btn ghost" data-act="e-open" data-id="' + esc(id) + '">Назад</button><button class="btn pri right danger" data-act="est-ok" data-id="' + esc(id) + '">Отменить запись</button></div>');
  }
