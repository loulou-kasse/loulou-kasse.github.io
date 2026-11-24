/* LOU LOU Kasse — расчётное ядро. Все суммы — целые центы. */
(function (root) {
  'use strict';

  /* "37,80" | "37.80" | "1.234,56" | "1234" -> центы; null если не число */
  function parseMoney(s) {
    if (typeof s === 'number') return Number.isFinite(s) ? Math.round(s * 100) : null;
    s = String(s == null ? '' : s).replace(/\s|€|EUR/gi, '');
    if (!s) return null;
    var neg = false;
    if (s[0] === '-') { neg = true; s = s.slice(1); }
    var intPart, frac = '', m;
    if (/^\d+$/.test(s)) { intPart = s; }                                   // 1234
    else if ((m = /^(\d+)[.,](\d{1,2})$/.exec(s))) { intPart = m[1]; frac = m[2]; }   // 37,80 | 37.8
    else if ((m = /^(\d{1,3}(?:\.\d{3})+)(?:,(\d{1,2}))?$/.exec(s))) {          // 1.234 | 1.234,56
      intPart = m[1].replace(/\./g, ''); frac = m[2] || '';
    } else if ((m = /^(\d{1,3}(?:,\d{3})+)\.(\d{1,2})$/.exec(s))) {             // 1,234.56
      intPart = m[1].replace(/,/g, ''); frac = m[2];
    } else return null;                                                      // всё остальное — не сумма
    var cents = parseInt(intPart, 10) * 100 + parseInt((frac + '00').slice(0, 2), 10);
    if (!Number.isSafeInteger(cents)) return null;
    return neg ? -cents : cents;
  }

  /* центы -> "1.234,56" */
  function fmtMoney(c) {
    c = Math.round(c || 0);
    var neg = c < 0; if (neg) c = -c;
    var i = String(Math.floor(c / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    var f = ('0' + (c % 100)).slice(-2);
    return (neg ? '-' : '') + i + ',' + f;
  }

  /* количество "2" | "1,5" -> сотые доли; null если плохо */
  function parseQty(s) {
    var c = parseMoney(s);
    return c == null || c <= 0 ? null : c;
  }
  function fmtQty(h) { if (h % 100 === 0) return String(h / 100); var t = fmtMoney(h); return h % 10 === 0 ? t.slice(0, -1) : t; }

  function lineTotal(qtyHundredths, priceCents) {
    return Math.round(qtyHundredths * priceCents / 100);
  }
  function invoiceTotal(items) {
    return (items || []).reduce(function (s, it) { return s + lineTotal(it.qty, it.price); }, 0);
  }

  /* номер счёта = ГГГГММ (месяц даты счёта) + порядковый номер из 3 цифр внутри месяца.
     Следующий = наибольший уже выданный в этом месяце + 1; учитывается и lastIssued
     (последний номер, выданный вне приложения). */
  function nextInvoiceNo(invoices, dateIso, lastIssued) {
    var prefix = String(dateIso || '').slice(0, 7).replace('-', '');
    if (!/^\d{6}$/.test(prefix)) return '';
    var max = 0;
    var see = function (no) {
      no = String(no == null ? '' : no);
      if (/^\d{9}$/.test(no) && no.slice(0, 6) === prefix) { var n = parseInt(no.slice(6), 10); if (n > max) max = n; }
    };
    (invoices || []).forEach(function (iv) { see(iv.no); });
    see(lastIssued);
    if (max >= 999) return '';
    return prefix + ('00' + (max + 1)).slice(-3);
  }

  /* итоговый счёт: полная стоимость минус оплаченные предоплаты.
     Инвариант: gross === ded + rest. Остаток не может быть отрицательным. */
  function schlussTotals(items, deductions) {
    var gross = invoiceTotal(items), ded = 0;
    (deductions || []).forEach(function (d) { ded += d.amount; });
    var rest = gross - ded;
    return { gross: gross, ded: ded, rest: rest, ok: rest >= 0 && gross === ded + rest };
  }
  function addDays(iso, n) {
    var p = String(iso || '').split('-').map(Number); if (p.length !== 3 || !p[0]) return '';
    var d = new Date(Date.UTC(p[0], p[1] - 1, p[2] + n));
    return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
  }

  var TYPES = ['einnahme', 'ausgabe', 'entnahme', 'einlage'];
  var WAYS = ['G', 'P', 'E', 'B'];

  function validEntry(e) {
    return !!e && TYPES.indexOf(e.type) >= 0 && WAYS.indexOf(e.way) >= 0 &&
      Number.isSafeInteger(e.amount) && e.amount !== 0 &&
      /^\d{4}-\d{2}-\d{2}$/.test(e.date || '');
  }

  function emptySums() { return { einnahme: 0, ausgabe: 0, entnahme: 0, einlage: 0, gewinn: 0 }; }

  /* суммы по записям, чья дата начинается с prefix ("2026-11" или "2026") */
  function sums(entries, prefix) {
    var s = emptySums();
    (entries || []).forEach(function (e) {
      if (!validEntry(e)) return;
      if (prefix && e.date.indexOf(prefix) !== 0) return;
      s[e.type] += e.amount;
    });
    s.gewinn = s.einnahme - s.ausgabe;
    return s;
  }

  /* как запись меняет остаток рабочего счёта (только way === 'G') */
  function bankEffect(e) {
    if (!validEntry(e) || e.way !== 'G') return 0;
    return (e.type === 'einnahme' || e.type === 'einlage') ? e.amount : -e.amount;
  }

  function lastDayOfMonth(ym) {
    var y = parseInt(ym.slice(0, 4), 10), m = parseInt(ym.slice(5, 7), 10);
    var d = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return ym + '-' + ('0' + d).slice(-2);
  }

  /* расчётный остаток рабочего счёта на конец дня until */
  function bankBalance(entries, openingCents, openingDate, until) {
    var b = openingCents || 0;
    (entries || []).forEach(function (e) {
      if (!validEntry(e)) return;
      if (openingDate && e.date < openingDate) return;
      if (until && e.date > until) return;
      b += bankEffect(e);
    });
    return b;
  }

  /* сверка: остаток по выписке против расчётного на конец месяца */
  function reconcile(entries, openingCents, openingDate, ym, statementCents) {
    var computed = bankBalance(entries, openingCents, openingDate, lastDayOfMonth(ym));
    if (statementCents == null) return { computed: computed, diff: null, ok: null };
    var diff = statementCents - computed;
    return { computed: computed, diff: diff, ok: diff === 0 };
  }

  /* отменяющая запись: тот же вид и счёт, сумма с обратным знаком */
  function makeStorno(e, id, date, now) {
    return {
      id: id, date: date, type: e.type, way: e.way, amount: -e.amount,
      party: e.party || '', text: 'Storno: ' + (e.text || ''), doc: e.doc || '',
      stornoOf: e.id, createdAt: now || '', cat: e.cat || ''
    };
  }
  function stornoedIds(entries) {
    var m = {};
    (entries || []).forEach(function (e) { if (e.stornoOf) m[e.stornoOf] = true; });
    return m;
  }

  /* расходы, оплаченные мужем (E), не отменённые и ещё не возмещённые */
  function openAuslagen(entries) {
    var st = stornoedIds(entries);
    return (entries || []).filter(function (e) {
      return validEntry(e) && e.type === 'ausgabe' && e.way === 'E' && e.amount > 0 &&
        !e.stornoOf && !st[e.id] && !e.erstattet;
    });
  }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    return /[";\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  var TYPE_DE = { einnahme: 'Betriebseinnahme', ausgabe: 'Betriebsausgabe', entnahme: 'Privatentnahme', einlage: 'Privateinlage' };
  var WAY_DE = { G: 'Geschäftskonto', P: 'privat (Inhaberin)', E: 'Ehemann', B: 'bar' };

  function journalCsv(entries, prefix) {
    var rows = [['Nr', 'Datum', 'Art', 'Zahlungsweg', 'Beleg', 'Geschäftspartner', 'Text', 'Betrag EUR', 'Storno zu Nr']];
    var list = (entries || []).filter(function (e) {
      return validEntry(e) && (!prefix || e.date.indexOf(prefix) === 0);
    }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.createdAt) < String(b.createdAt) ? -1 : 1; });
    var nrOf = {};
    list.forEach(function (e, i) { nrOf[e.id] = i + 1; });
    list.forEach(function (e, i) {
      rows.push([i + 1, e.date.split('-').reverse().join('.'), TYPE_DE[e.type], WAY_DE[e.way],
        e.doc || '', e.party || '', e.text || '', fmtMoney(e.amount), e.stornoOf ? (nrOf[e.stornoOf] || 'anderer Zeitraum') : '']);
    });
    var s = sums(list);
    rows.push([]);
    rows.push(['', '', 'Summe Betriebseinnahmen', '', '', '', '', fmtMoney(s.einnahme)]);
    rows.push(['', '', 'Summe Betriebsausgaben', '', '', '', '', fmtMoney(s.ausgabe)]);
    rows.push(['', '', 'Gewinn', '', '', '', '', fmtMoney(s.gewinn)]);
    rows.push(['', '', 'Summe Privatentnahmen', '', '', '', '', fmtMoney(s.entnahme)]);
    rows.push(['', '', 'Summe Privateinlagen', '', '', '', '', fmtMoney(s.einlage)]);
    return '﻿' + rows.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }

  function fillTpl(tpl, vals) {
    return tpl.replace(/\{(\w+)\}/g, function (m, k) {
      var v = vals && vals[k];
      return v == null || v === '' ? '…' : String(v);
    });
  }
  function tplFields(tpls) {
    var seen = {}, out = [];
    (tpls || []).forEach(function (t) {
      (t.match(/\{(\w+)\}/g) || []).forEach(function (m) {
        var k = m.slice(1, -1);
        if (!seen[k]) { seen[k] = true; out.push(k); }
      });
    });
    return out;
  }
  function deDate(iso) { return iso ? iso.split('-').reverse().join('.') : ''; }

  /* символы, которых нет в стандартных шрифтах PDF (кириллица и т.п.) */
  function nonLatin1(s) { return /[^\u0000-ÿ]/.test(String(s || '')); }


  /* ---------- статьи EÜR ----------
     Названия близки к строкам Anlage EÜR; номера строк не указываются, они меняются по годам. */
  var CATS = {
    einnahme: [
      ['umsatz', 'Выручка (Betriebseinnahmen)', 'Betriebseinnahmen als Kleinunternehmerin'],
      ['sonstE', 'Прочие поступления', 'Sonstige Betriebseinnahmen']
    ],
    ausgabe: [
      ['waren', 'Цветы, шары, материалы', 'Waren, Roh- und Hilfsstoffe'],
      ['fremd', 'Работы других исполнителей', 'Fremdleistungen'],
      ['gwg', 'Инструмент и оборудование до 800 €', 'Geringwertige Wirtschaftsgüter'],
      ['raum', 'Склад, помещение', 'Raumkosten, Lager'],
      ['tel', 'Телефон, интернет', 'Telekommunikation'],
      ['werbung', 'Реклама', 'Werbekosten'],
      ['fahrt', 'Проезд, такси, доставка', 'Fahrt- und Transportkosten'],
      ['vers', 'Страховки предприятия', 'Versicherungen (betrieblich)'],
      ['bank', 'Банк, комиссии', 'Kontoführung, Bankgebühren'],
      ['buero', 'Офис, почта, программы', 'Bürobedarf, Porto, Software'],
      ['beitr', 'Взносы и пошлины', 'Beiträge, Gebühren'],
      ['fortb', 'Обучение, литература', 'Fortbildung, Fachliteratur'],
      ['sonst', 'Прочие расходы', 'Sonstige Betriebsausgaben']
    ]
  };
  var CAT_INFO = {};
  Object.keys(CATS).forEach(function (t) { CATS[t].forEach(function (c) { CAT_INFO[c[0]] = { type: t, ru: c[1], de: c[2] }; }); });
  /* статья записи: выручка по счёту — всегда «umsatz»; запись без статьи — '' */
  function catOf(e) {
    if (!e) return '';
    if (e.cat && CAT_INFO[e.cat] && CAT_INFO[e.cat].type === e.type) return e.cat;
    if (e.type === 'einnahme' && e.invoiceNo) return 'umsatz';
    return '';
  }

  /* годовой отчёт EÜR по статьям.
     Инвариант: сумма строк выручки = einnahme года; сумма строк расходов = ausgabe года (включая «без статьи»). */
  function euerReport(entries, year) {
    var s = sums(entries, String(year)), inc = {}, exp = {};
    CATS.einnahme.forEach(function (c) { inc[c[0]] = 0; }); CATS.ausgabe.forEach(function (c) { exp[c[0]] = 0; });
    inc[''] = 0; exp[''] = 0;
    var counts = { inc: 0, exp: 0, uncat: 0 };
    (entries || []).forEach(function (e) {
      if (!validEntry(e) || e.date.indexOf(String(year)) !== 0) return;
      var c = catOf(e);
      if (e.type === 'einnahme') { inc[c] += e.amount; counts.inc++; }
      else if (e.type === 'ausgabe') { exp[c] += e.amount; counts.exp++; }
      else return;
      if (!c) counts.uncat++;
    });
    var rowsI = CATS.einnahme.map(function (c) { return { key: c[0], ru: c[1], de: c[2], amount: inc[c[0]] }; });
    var rowsA = CATS.ausgabe.map(function (c) { return { key: c[0], ru: c[1], de: c[2], amount: exp[c[0]] }; });
    if (inc['']) rowsI.push({ key: '', ru: 'Без статьи', de: 'Ohne Zuordnung', amount: inc[''] });
    if (exp['']) rowsA.push({ key: '', ru: 'Без статьи', de: 'Ohne Zuordnung', amount: exp[''] });
    var sumI = rowsI.reduce(function (a, r) { return a + r.amount; }, 0), sumA = rowsA.reduce(function (a, r) { return a + r.amount; }, 0);
    return { year: String(year), income: rowsI, expense: rowsA, totalIncome: sumI, totalExpense: sumA, gewinn: sumI - sumA,
      uncategorized: counts.uncat, ok: sumI === s.einnahme && sumA === s.ausgabe && (sumI - sumA) === s.gewinn, check: s };
  }
  function euerCsv(r) {
    var rows = [['Einnahmen-Überschuss-Rechnung ' + r.year], [], ['Betriebseinnahmen', 'EUR']];
    r.income.forEach(function (x) { rows.push([x.de, fmtMoney(x.amount)]); });
    rows.push(['Summe Betriebseinnahmen', fmtMoney(r.totalIncome)], [], ['Betriebsausgaben', 'EUR']);
    r.expense.forEach(function (x) { rows.push([x.de, fmtMoney(x.amount)]); });
    rows.push(['Summe Betriebsausgaben', fmtMoney(r.totalExpense)], [], ['Gewinn', fmtMoney(r.gewinn)],
      ['Kontrolle: Summe der Zeilen = Journal', r.ok ? 'ja' : 'NEIN']);
    return '﻿' + rows.map(function (x) { return x.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }

  /* расход без подтверждающего документа: чек/фото, Eigenbeleg или пометка «выписки достаточно» */
  function needsBeleg(e, st) {
    return validEntry(e) && e.type === 'ausgabe' && e.amount > 0 && !e.stornoOf && !(st && st[e.id]) && !e.beleg && !e.noBeleg;
  }

  /* ---------- счета ---------- */
  function isOverdue(iv, todayIso) { return !!iv && iv.status === 'offen' && !!iv.due && iv.due < todayIso; }
  function daysBetween(a, b) {
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  function openInvoices(invoices) { return (invoices || []).filter(function (v) { return v.status === 'offen'; }); }
  /* клиенты из прошлых счетов: по первой строке получателя, самый свежий адрес */
  function clientsFrom(invoices) {
    var map = {};
    (invoices || []).slice().sort(function (a, b) { return a.no < b.no ? -1 : 1; }).forEach(function (v) {
      var rcpt = String(v.rcpt || (v.client && v.client.name) || '').trim(); if (!rcpt) return;
      var name = rcpt.split(/\n/)[0].trim(), k = name.toLowerCase();
      map[k] = { name: name, rcpt: rcpt, lastNo: v.no, count: (map[k] ? map[k].count : 0) + 1 };
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return a.lastNo < b.lastNo ? 1 : -1; });
  }
  var DE_NAMES = /^(deutschland|germany|bundesrepublik deutschland)$/i;
  /* проверки черновика счёта перед выставлением; level: stop — выставить нельзя, warn — стоит исправить, info — к сведению */
  function invoiceWarnings(d, invoices) {
    var out = [], lines = String(d.rcpt || '').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    var last = lines[lines.length - 1] || '', dePlz = lines.some(function (l) { return /^\d{5}\s+\S/.test(l); });
    var countryLine = lines.length > 1 && !/\d/.test(last) && last.length > 2 ? last : '';
    var foreign = false;
    if (lines.length < 2) out.push({ level: 'warn', text: 'В адресе получателя меньше двух строк: обычно нужны имя или фирма, улица, индекс и город.' });
    else if (!lines.some(function (l) { return /\d/.test(l); })) out.push({ level: 'warn', text: 'В адресе получателя нет индекса и номера дома.' });
    if (countryLine && !DE_NAMES.test(countryLine) && !dePlz) foreign = true;
    else if (countryLine && !DE_NAMES.test(countryLine) && dePlz && lines.length > 3) foreign = true;
    else if (!dePlz && lines.length >= 2 && !countryLine) out.push({ level: 'warn', text: 'Индекс не похож на немецкий, а страна не указана. Для клиента из другой страны допишите страну последней строкой.' });
    if (foreign) out.push({ level: 'info', text: 'Клиент из другой страны (' + countryLine + '). Если изделие поставлено и смонтировано в Германии, это поставка в Германии: НДС и USt-IdNr не нужны, но в описании укажите, что и где поставлено. Если это услуга фирме из ЕС — нужен USt-IdNr.' });
    (d.items || []).forEach(function (it) {
      var words = String(it.text || '').trim().split(/\s+/).filter(Boolean).length;
      if (foreign && words < 4) out.push({ level: 'warn', text: 'Описание «' + it.text + '» слишком короткое для клиента из другой страны: укажите материал, поставку или монтаж и место.' });
    });
    if (d.due && d.date && d.due < d.date) out.push({ level: 'stop', text: 'Срок оплаты раньше даты счёта.' });
    if (d.title === 'Rechnung' && d.ldate && d.date && d.ldate > d.date) out.push({ level: 'info', text: 'Дата услуги позже даты счёта. Если оплата идёт до работ, выберите Vorauszahlungsrechnung.' });
    var name = (lines[0] || '').toLowerCase();
    (invoices || []).forEach(function (v) {
      if (v.status === 'storniert' || v.total !== d.total) return;
      var vn = String(v.rcpt || (v.client && v.client.name) || '').split(/\n/)[0].trim().toLowerCase();
      if (vn && vn === name && d.date && v.date && Math.abs(daysBetween(v.date, d.date)) <= 30)
        out.push({ level: 'warn', text: 'Похожий счёт уже есть: ' + v.no + ' от ' + deDate(v.date) + ' на ту же сумму тому же получателю.' });
    });
    return out;
  }

  /* ---------- выписка банка (CSV) ---------- */
  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    var first = text.split(/\r?\n/)[0] || '', sep = (first.split(';').length >= first.split(',').length) ? ';' : ',';
    var rows = [], row = [], cell = '', q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); cell = ''; if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some(function (c) { return c.trim() !== ''; })) rows.push(row);
    return rows;
  }
  function deDateToIso(s) {
    var m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(String(s || '').trim());
    if (m) { var y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2); }
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '').trim());
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }
  function findCol(head, names) {
    var h = head.map(function (x) { return String(x).trim().toLowerCase().replace(/ä/g, 'ae').replace(/ü/g, 'ue').replace(/ö/g, 'oe'); });
    for (var i = 0; i < names.length; i++) { var k = h.indexOf(names[i]); if (k >= 0) return k; }
    for (i = 0; i < names.length; i++) { for (var j = 0; j < h.length; j++) if (h[j].indexOf(names[i]) === 0) return j; }
    return -1;
  }
  /* Sparkasse CSV-CAMT и похожие форматы: дата, сумма, контрагент, назначение */
  function parseBankCsv(text) {
    var rows = parseCsv(text), hi = -1, head;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      if (findCol(rows[i], ['buchungstag', 'buchungsdatum', 'datum']) >= 0 && findCol(rows[i], ['betrag', 'betrag (eur)', 'umsatz']) >= 0) { hi = i; break; }
    }
    if (hi < 0) return { rows: [], error: 'Не найдена строка заголовков с колонками «Buchungstag» и «Betrag».' };
    head = rows[hi];
    var cDate = findCol(head, ['buchungstag', 'buchungsdatum', 'datum']), cAmt = findCol(head, ['betrag', 'betrag (eur)', 'umsatz']),
      cParty = findCol(head, ['beguenstigter/zahlungspflichtiger', 'name zahlungsbeteiligter', 'zahlungsempfaenger', 'auftraggeber/empfaenger', 'empfaenger', 'name']),
      cText = findCol(head, ['verwendungszweck', 'buchungstext']), cKind = findCol(head, ['buchungstext']),
      cIban = findCol(head, ['kontonummer/iban', 'iban zahlungsbeteiligter', 'iban']);
    var out = [], bad = 0;
    rows.slice(hi + 1).forEach(function (r) {
      var date = deDateToIso(r[cDate]), amt = parseMoney(r[cAmt]);
      if (!date || amt == null) { bad++; return; }
      out.push({ date: date, amount: amt, party: cParty >= 0 ? String(r[cParty] || '').trim() : '',
        text: cText >= 0 ? String(r[cText] || '').trim() : '', kind: cKind >= 0 && cKind !== cText ? String(r[cKind] || '').trim() : '',
        iban: cIban >= 0 ? String(r[cIban] || '').trim() : '' });
    });
    return { rows: out, skipped: bad, error: out.length ? '' : 'В файле нет операций.' };
  }
  /* сопоставление операций выписки с журналом рабочего счёта: та же сумма с тем же знаком, дата ±5 дней */
  function matchBank(bankRows, entries) {
    var used = {}, matched = [], missing = [];
    var cands = (entries || []).filter(function (e) { return validEntry(e) && e.way === 'G'; });
    var rows = (bankRows || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    rows.forEach(function (r) {
      var best = null, bestD = 99;
      cands.forEach(function (e) {
        if (used[e.id] || bankEffect(e) !== r.amount) return;
        var dd = Math.abs(daysBetween(e.date, r.date)); if (dd <= 5 && dd < bestD) { best = e; bestD = dd; }
      });
      if (best) { used[best.id] = true; matched.push({ row: r, entry: best, days: bestD }); } else missing.push(r);
    });
    var from = rows.length ? rows[0].date : '', to = rows.length ? rows[rows.length - 1].date : '';
    var extra = cands.filter(function (e) { return !used[e.id] && e.date >= from && e.date <= to; });
    var sumBank = rows.reduce(function (a, r) { return a + r.amount; }, 0);
    return { matched: matched, missing: missing, extra: extra, from: from, to: to, sumBank: sumBank };
  }

  function invoicesCsv(invoices, year) {
    var rows = [['Rechnungsnummer', 'Art', 'Datum', 'Leistungsdatum', 'Empfänger', 'Betrag EUR', 'Status', 'Bezahlt am']];
    (invoices || []).filter(function (v) { return !year || String(v.date || '').indexOf(String(year)) === 0; })
      .sort(function (a, b) { return a.no < b.no ? -1 : 1; }).forEach(function (v) {
        rows.push([v.no, v.title || 'Rechnung', deDate(v.date), deDate(v.ldate), String(v.rcpt || (v.client && v.client.name) || '').split(/\n/)[0],
          fmtMoney(v.total), { offen: 'offen', bezahlt: 'bezahlt', storniert: 'storniert' }[v.status] || v.status, v.paid ? deDate(v.paid.date) : '']);
      });
    return '﻿' + rows.map(function (x) { return x.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }

  root.Core = {
    parseMoney: parseMoney, fmtMoney: fmtMoney, parseQty: parseQty, fmtQty: fmtQty,
    lineTotal: lineTotal, invoiceTotal: invoiceTotal, schlussTotals: schlussTotals, addDays: addDays, nextInvoiceNo: nextInvoiceNo,
    validEntry: validEntry, sums: sums, bankEffect: bankEffect, lastDayOfMonth: lastDayOfMonth,
    bankBalance: bankBalance, reconcile: reconcile, makeStorno: makeStorno, stornoedIds: stornoedIds,
    openAuslagen: openAuslagen, journalCsv: journalCsv, fillTpl: fillTpl, tplFields: tplFields,
    deDate: deDate, nonLatin1: nonLatin1, CATS: CATS, CAT_INFO: CAT_INFO, catOf: catOf, euerReport: euerReport, euerCsv: euerCsv,
    needsBeleg: needsBeleg, isOverdue: isOverdue, daysBetween: daysBetween, openInvoices: openInvoices, clientsFrom: clientsFrom,
    invoiceWarnings: invoiceWarnings, parseCsv: parseCsv, deDateToIso: deDateToIso, parseBankCsv: parseBankCsv, matchBank: matchBank, invoicesCsv: invoicesCsv, TYPE_DE: TYPE_DE, WAY_DE: WAY_DE, TYPES: TYPES, WAYS: WAYS
  };
})(typeof window !== 'undefined' ? window : globalThis);
