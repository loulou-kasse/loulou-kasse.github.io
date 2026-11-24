require('../src/core.js');
const C = globalThis.Core, assert = require('assert');
let n = 0; const eq = (a, b, m) => { n++; assert.deepStrictEqual(a, b, m); }; const ok = (v, m) => { n++; assert.ok(v, m); };

// --- EÜR: инвариант на случайных журналах ---
let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const cats = { einnahme: ['umsatz', 'sonstE', '', 'waren'], ausgabe: C.CATS.ausgabe.map(c => c[0]).concat(['', 'umsatz', 'bogus']) };
for (let t = 0; t < 400; t++) {
  const es = [];
  for (let i = 0; i < 40; i++) {
    const type = C.TYPES[Math.floor(rnd() * 4)], way = ['G', 'P', 'E', 'B'][Math.floor(rnd() * 4)];
    const y = rnd() < 0.8 ? '2026' : '2025', m = ('0' + (1 + Math.floor(rnd() * 12))).slice(-2);
    const e = { id: 'e' + i, type, way, amount: 1 + Math.floor(rnd() * 50000), date: `${y}-${m}-1${Math.floor(rnd() * 9)}` };
    const cl = cats[type]; if (cl) e.cat = cl[Math.floor(rnd() * cl.length)];
    if (type === 'einnahme' && rnd() < 0.3) e.invoiceNo = '202611001';
    es.push(e);
    if (rnd() < 0.15) es.push(C.makeStorno(e, 's' + i, e.date, ''));
  }
  const r = C.euerReport(es, 2026), s = C.sums(es, '2026');
  ok(r.ok, 'euer ok'); eq(r.totalIncome, s.einnahme); eq(r.totalExpense, s.ausgabe); eq(r.gewinn, s.gewinn);
  // статья не своего вида считается «без статьи»
  es.forEach(e => { const c = C.catOf(e); if (c) eq(C.CAT_INFO[c].type, e.type); });
}
eq(C.catOf({ type: 'einnahme', invoiceNo: '1' }), 'umsatz');
eq(C.catOf({ type: 'ausgabe', cat: 'umsatz' }), '');
ok(C.euerCsv(C.euerReport([{ id: 'a', type: 'ausgabe', way: 'G', amount: 1500, date: '2026-10-27', cat: 'tel' }], 2026)).includes('Telekommunikation;15,00'));
// сторно наследует статью
eq(C.makeStorno({ id: 'x', type: 'ausgabe', way: 'G', amount: 100, cat: 'tel' }, 'y', '2026-11-01').cat, 'tel');

// --- чек ---
const st = {};
ok(C.needsBeleg({ id: 'a', type: 'ausgabe', way: 'G', amount: 100, date: '2026-11-01' }, st));
ok(!C.needsBeleg({ id: 'a', type: 'ausgabe', way: 'G', amount: 100, date: '2026-11-01', beleg: { id: 'f' } }, st));
ok(!C.needsBeleg({ id: 'a', type: 'ausgabe', way: 'G', amount: 100, date: '2026-11-01', noBeleg: 'kontoauszug' }, st));
ok(!C.needsBeleg({ id: 'a', type: 'ausgabe', way: 'G', amount: 100, date: '2026-11-01' }, { a: true }));
ok(!C.needsBeleg({ id: 'a', type: 'einnahme', way: 'G', amount: 100, date: '2026-11-01' }, st));
ok(!C.needsBeleg({ id: 'a', type: 'ausgabe', way: 'G', amount: -100, date: '2026-11-01', stornoOf: 'b' }, st));

// --- счета ---
ok(C.isOverdue({ status: 'offen', due: '2026-11-20' }, '2026-11-24'));
ok(!C.isOverdue({ status: 'offen', due: '2026-11-24' }, '2026-11-24'));
ok(!C.isOverdue({ status: 'bezahlt', due: '2026-11-01' }, '2026-11-24'));
ok(!C.isOverdue({ status: 'offen' }, '2026-11-24'));
eq(C.daysBetween('2026-11-20', '2026-11-24'), 4); eq(C.daysBetween('2026-12-30', '2027-01-02'), 3); eq(C.daysBetween('2026-03-28', '2026-03-30'), 2);
const IV = [
  { no: '202611001', rcpt: 'Kristina Nilmaier\nBloom Kosmetikstudio\nSüdstraße 41\n52064 Aachen', total: 30000, date: '2026-11-11', status: 'bezahlt' },
  { no: '202611002', rcpt: 'Kristina Nilmaier\nBloom Kosmetikstudio\nSüdstraße 41\n52064 Aachen', total: 9000, date: '2026-11-24', status: 'offen' },
  { no: '202611003', rcpt: 'Stiftung PCM\nPromenade 1\n6411 JA Heerlen\nNiederlande', total: 15000, date: '2026-11-24', status: 'offen' }];
const cl = C.clientsFrom(IV);
eq(cl.length, 2); eq(cl[0].name, 'Stiftung PCM'); eq(cl[1].count, 2); eq(cl[1].lastNo, '202611002');
const lv = ws => ws.map(w => w.level);
// Bloom — немецкий адрес, предупреждений нет
eq(C.invoiceWarnings({ rcpt: IV[1].rcpt, items: [{ text: 'Floristische Dekoration' }], total: 1, date: '2026-11-24', title: 'Rechnung' }, IV), []);
// PCM без страны — предупреждение
ok(C.invoiceWarnings({ rcpt: 'Stiftung PCM\nPromenade 1\n6411 JA Heerlen', items: [{ text: 'Ballondekoration' }], total: 1, date: '2026-11-24' }, []).some(w => /страна не указана/.test(w.text)));
// PCM со страной и коротким описанием
let w = C.invoiceWarnings({ rcpt: IV[2].rcpt, items: [{ text: 'Ballondekoration' }], total: 1, date: '2026-11-24' }, []);
ok(w.some(x => x.level === 'info' && /Niederlande/.test(x.text))); ok(w.some(x => x.level === 'warn' && /слишком короткое/.test(x.text)));
// PCM как выставлен — только информация
w = C.invoiceWarnings({ rcpt: IV[2].rcpt, items: [{ text: 'Ballondekoration (Ballongirlande aus eigenem Material), Lieferung und Montage in Aachen am 21.11.2026' }], total: 1, date: '2026-11-24' }, []);
eq(lv(w), ['info']);
// США с немецким индексом? Brandualist: Dover, DE 19901 / United States
w = C.invoiceWarnings({ rcpt: 'Brandualist Inc.\n8 The Green STE R\nDover, DE 19901\nUnited States', items: [{ text: 'Blumenarrangement' }], total: 1, date: '2026-10-27' }, []);
ok(w.some(x => /United States/.test(x.text)));
// дубль
ok(C.invoiceWarnings({ rcpt: IV[2].rcpt, items: [{ text: 'a b c d e' }], total: 15000, date: '2026-11-25' }, IV).some(x => /202611003/.test(x.text)));
ok(!C.invoiceWarnings({ rcpt: IV[2].rcpt, items: [{ text: 'a b c d e' }], total: 15001, date: '2026-11-25' }, IV).some(x => /202611003/.test(x.text)));
// срок раньше даты
ok(C.invoiceWarnings({ rcpt: IV[1].rcpt, items: [], total: 1, date: '2026-11-24', due: '2026-11-20' }, []).some(x => x.level === 'stop'));
// одна строка
ok(C.invoiceWarnings({ rcpt: 'Anna', items: [], total: 1, date: '2026-11-24' }, []).some(x => /меньше двух строк/.test(x.text)));
// Германия явно — без предупреждений
eq(C.invoiceWarnings({ rcpt: 'Max\nHauptstr. 1\n52062 Aachen\nDeutschland', items: [{ text: 'x' }], total: 1, date: '2026-11-24' }, []), []);

// --- выписка ---
const CAMT = '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"\r\n' +
  '"DE59390500001077933362";"11.11.26";"11.11.26";"GUTSCHR. UEBERWEISUNG";"Vorauszahlungsrechnung 202611001";"";"";"";"";"";"";"Kristina Nilmaier";"DE00123";"COBADEFFXXX";"300,00";"EUR";"Umsatz gebucht"\r\n' +
  '"DE59390500001077933362";"30.10.26";"30.10.26";"ENTGELTABSCHLUSS";"Rechnung Unzustellbare Post; Entgelt";"";"";"";"";"";"";"Sparkasse Aachen";"";"";"-25,00";"EUR";"Umsatz gebucht"\r\n' +
  '"DE59390500001077933362";"07.10.26";"07.10.26";"KARTENZAHLUNG";"FleuraMetz 2026-10-07";"";"";"";"";"";"";"FLEURAMETZ";"";"";"-1.234,56";"EUR";"Umsatz gebucht"\r\n';
const pb = C.parseBankCsv(CAMT);
eq(pb.error, ''); eq(pb.rows.length, 3); eq(pb.rows[0], { date: '2026-11-11', amount: 30000, party: 'Kristina Nilmaier', text: 'Vorauszahlungsrechnung 202611001', kind: 'GUTSCHR. UEBERWEISUNG', iban: 'DE00123' });
eq(pb.rows[2].amount, -123456); eq(pb.rows[1].text, 'Rechnung Unzustellbare Post; Entgelt');
eq(C.parseBankCsv('a;b\n1;2').rows.length, 0); ok(C.parseBankCsv('a;b\n1;2').error);
// запятая как разделитель, ISO-даты
eq(C.parseBankCsv('Datum,Betrag,Name,Verwendungszweck\n2026-11-02,"-12,50",Shop,"Band, rot"\n').rows[0], { date: '2026-11-02', amount: -1250, party: 'Shop', text: 'Band, rot', kind: '', iban: '' });
eq(C.deDateToIso('1.2.2026'), '2026-02-01'); eq(C.deDateToIso('x'), '');
const J = [
  { id: 'b', type: 'einnahme', way: 'G', amount: 30000, date: '2026-11-11' },
  { id: 's', type: 'ausgabe', way: 'G', amount: 2500, date: '2026-10-30' },
  { id: 'p', type: 'ausgabe', way: 'P', amount: 123456, date: '2026-10-07' },
  { id: 'x', type: 'ausgabe', way: 'G', amount: 999, date: '2026-10-20' },
  { id: 'old', type: 'ausgabe', way: 'G', amount: 999, date: '2026-09-01' }];
const mb = C.matchBank(pb.rows, J);
eq(mb.matched.map(m => m.entry.id).sort(), ['b', 's']); eq(mb.missing.map(r => r.party), ['FLEURAMETZ']); eq(mb.extra.map(e => e.id), ['x']);
eq(mb.from, '2026-10-07'); eq(mb.to, '2026-11-11'); eq(mb.sumBank, 30000 - 2500 - 123456);
// инвариант: каждая строка выписки либо сопоставлена, либо в missing
eq(mb.matched.length + mb.missing.length, pb.rows.length);
// дата ±5 дней, ближайшая
const m2 = C.matchBank([{ date: '2026-11-10', amount: -500 }], [{ id: 'a', type: 'ausgabe', way: 'G', amount: 500, date: '2026-11-04' }, { id: 'b', type: 'ausgabe', way: 'G', amount: 500, date: '2026-11-13' }, { id: 'c', type: 'ausgabe', way: 'G', amount: 500, date: '2026-11-16' }]);
eq(m2.matched[0].entry.id, 'b');
// одна запись не сопоставляется дважды
eq(C.matchBank([{ date: '2026-11-10', amount: -500 }, { date: '2026-11-10', amount: -500 }], [{ id: 'a', type: 'ausgabe', way: 'G', amount: 500, date: '2026-11-10' }]).missing.length, 1);
ok(C.invoicesCsv(IV, 2026).includes('202611003;Rechnung;24.11.2026;;Stiftung PCM;150,00;offen'));
console.log('OK: ' + n + ' проверок (новые функции ядра)');
// --- темп прибыли ---
{
  const es = [{ id: 'a', type: 'einnahme', way: 'G', amount: 53000, date: '2026-10-16' }, { id: 'b', type: 'ausgabe', way: 'G', amount: 4000, date: '2026-10-27' }, { id: 'c', type: 'einnahme', way: 'G', amount: 30000, date: '2026-11-11' }];
  let r = C.profitPace(es, '2026-11-24', '2026-09-17');
  eq([r.from, r.months, r.month, r.total, r.avg], ['2026-09', 3, 30000, 79000, 26333]);
  r = C.profitPace(es, '2026-11-24', '');
  eq([r.from, r.months, r.avg], ['2026-10', 2, 39500]);
  r = C.profitPace(es, '2027-02-10', '2026-09-17');
  eq([r.from, r.months, r.total], ['2027-01', 2, 0]);
  eq(C.prevMonth('2027-01'), '2026-12'); eq(C.prevMonth('2026-11'), '2026-10');
  // инвариант на случайных журналах: total = сумма прибыли за год, если начало — январь
  for (let t = 0; t < 200; t++) {
    const xs = []; for (let i = 0; i < 30; i++) xs.push({ id: 'x' + i, type: ['einnahme', 'ausgabe'][i % 2], way: 'G', amount: 100 + i * 37 + t, date: '2026-' + ('0' + (1 + (i * 7 + t) % 11)).slice(-2) + '-05' });
    xs.push({ id: 'j', type: 'ausgabe', way: 'G', amount: 1, date: '2026-01-02' });
    const q = C.profitPace(xs, '2026-11-30', ''); eq(q.total, C.sums(xs, '2026').gewinn); eq(q.months, 11);
  }
  console.log('OK: темп прибыли');
}
