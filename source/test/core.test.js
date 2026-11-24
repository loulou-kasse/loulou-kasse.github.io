require('../src/core.js');
const C = globalThis.Core;
const assert = require('assert');
let n = 0;
const eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };

// --- деньги ---
eq(C.parseMoney('37,80'), 3780);
eq(C.parseMoney('37.80'), 3780);
eq(C.parseMoney('37,8'), 3780);
eq(C.parseMoney('37'), 3700);
eq(C.parseMoney('1.234,56'), 123456);
eq(C.parseMoney('1,234.56'), 123456);
eq(C.parseMoney('1.234'), 123400);
eq(C.parseMoney('1 234,5 €'), 123450);
eq(C.parseMoney('0,05'), 5);
eq(C.parseMoney('-12,30'), -1230);
eq(C.parseMoney(''), null);
eq(C.parseMoney('abc'), null);
eq(C.parseMoney('12,345'), null); // неоднозначно — отклоняем
eq(C.parseMoney('1.234.567,8'), 123456780);
eq(C.parseMoney('12.34.56'), null);
eq(C.parseMoney('.5'), null);
eq(C.parseMoney('1,2,3'), null);
eq(C.parseMoney('12,3456'), null);
eq(C.fmtMoney(123456), '1.234,56');
eq(C.fmtMoney(5), '0,05');
eq(C.fmtMoney(-1230), '-12,30');
eq(C.fmtMoney(100000000), '1.000.000,00');
// круговая проверка на 20000 значений
for (let c = 0; c < 20000; c += 7) { n++; assert.strictEqual(C.parseMoney(C.fmtMoney(c)), c); }

// --- счёт ---
eq(C.fmtQty(250), '2,5'); eq(C.fmtQty(100), '1'); eq(C.fmtQty(125), '1,25'); eq(C.fmtQty(1200), '12');
eq(C.lineTotal(150, 1999), 2999); // 1,5 × 19,99 = 29,985 -> 29,99
eq(C.invoiceTotal([{ qty: 200, price: 4500 }, { qty: 100, price: 1250 }]), 10250);
eq(C.nextInvoiceNo([], '2026-11-14', ''), '202611001');
eq(C.nextInvoiceNo([], '2026-11-14', '202611001'), '202611002');           // счёт Bloom уже выдан вне приложения
eq(C.nextInvoiceNo([{ no: '202611002' }, { no: '202611005' }], '2026-11-20', '202611001'), '202611006');
eq(C.nextInvoiceNo([{ no: '202611002' }], '2026-12-01', '202611001'), '202612001'); // новый месяц — с 001
eq(C.nextInvoiceNo([{ no: '202612001' }, { no: 'x' }, {}], '2026-12-31', ''), '202612002');
eq(C.nextInvoiceNo([{ no: '202611999' }], '2026-11-30', ''), '');          // место в месяце кончилось
eq(C.nextInvoiceNo([], '', ''), '');
// номера внутри месяца идут без пропусков: 50 выдач подряд
{ const ivs = []; for (let i = 1; i <= 50; i++) { const no = C.nextInvoiceNo(ivs, '2027-01-10', ''); n++; assert.strictEqual(no, '202701' + String(i).padStart(3, '0')); ivs.push({ no }); } }

// итоговый счёт Bloom: 390 − 300 = 90
eq(C.schlussTotals([{ qty: 100, price: 39000 }], [{ amount: 30000 }]), { gross: 39000, ded: 30000, rest: 9000, ok: true });
eq(C.schlussTotals([{ qty: 100, price: 30000 }, { qty: 100, price: 9000 }], [{ amount: 30000 }]).rest, 9000);
eq(C.schlussTotals([{ qty: 100, price: 30000 }], [{ amount: 30000 }]), { gross: 30000, ded: 30000, rest: 0, ok: true });
eq(C.schlussTotals([{ qty: 100, price: 20000 }], [{ amount: 30000 }]).ok, false);   // вычет больше суммы — запрещено
eq(C.schlussTotals([{ qty: 100, price: 100000 }], [{ amount: 30000 }, { amount: 20000 }]).rest, 50000);
// инвариант на 2000 случайных наборов
for (let k = 0; k < 2000; k++) { const it = [{ qty: 100 * (1 + k % 5), price: 1 + (k * 7919) % 50000 }], dd = [{ amount: (k * 104729) % 30000 }];
  const r = C.schlussTotals(it, dd); n++; assert.strictEqual(r.gross, r.ded + r.rest); }
eq(C.addDays('2026-11-24', 7), '2026-12-01');
eq(C.addDays('2026-12-28', 14), '2027-01-11');
eq(C.addDays('2028-02-27', 2), '2028-02-29');
eq(C.addDays('', 7), '');

// --- журнал ---
const E = [
  { id: 'a', date: '2026-10-05', type: 'einlage', way: 'G', amount: 20000, text: 'Privateinlage' },
  { id: 'b', date: '2026-10-12', type: 'einnahme', way: 'G', amount: 15000, text: 'RE 1' },
  { id: 'c', date: '2026-10-14', type: 'einnahme', way: 'B', amount: 8500, text: 'RE 2 bar' },
  { id: 'd', date: '2026-10-20', type: 'ausgabe', way: 'G', amount: 3780, text: 'OBI' },
  { id: 'e', date: '2026-10-21', type: 'ausgabe', way: 'E', amount: 1850, text: 'Taxi' },
  { id: 'f', date: '2026-10-25', type: 'entnahme', way: 'G', amount: 10000, text: 'Privatentnahme' },
  { id: 'g', date: '2026-11-02', type: 'ausgabe', way: 'P', amount: 990, text: 'Band' },
  { id: 'h', date: '2026-11-03', type: 'einnahme', way: 'G', amount: 30000, text: 'RE 3' },
  { id: 'bad', date: '2026-11-03', type: 'zzz', way: 'G', amount: 1 },
];
const okt = C.sums(E, '2026-10');
eq(okt, { einnahme: 23500, ausgabe: 5630, entnahme: 10000, einlage: 20000, gewinn: 17870 });
const nov = C.sums(E, '2026-11');
eq(nov.gewinn, 30000 - 990);
const yr = C.sums(E, '2026');
// инвариант: год = сумма месяцев
for (const k of ['einnahme', 'ausgabe', 'entnahme', 'einlage', 'gewinn']) eq(yr[k], okt[k] + nov[k], k);

// банк: 0 +200 +150 −37,80 −100 = 212,20 на конец октября (наличные и чужие счета не входят)
eq(C.lastDayOfMonth('2026-10'), '2026-10-31');
eq(C.lastDayOfMonth('2026-02'), '2026-02-28');
eq(C.lastDayOfMonth('2028-02'), '2028-02-29');
eq(C.bankBalance(E, 0, '2026-09-17', '2026-10-31'), 21220);
eq(C.bankBalance(E, 0, '2026-09-17', '2026-11-30'), 51220);
eq(C.bankBalance(E, 5000, '2026-09-17', '2026-10-31'), 26220);
eq(C.reconcile(E, 0, '2026-09-17', '2026-10', 21220), { computed: 21220, diff: 0, ok: true });
eq(C.reconcile(E, 0, '2026-09-17', '2026-10', 21000), { computed: 21220, diff: -220, ok: false });
eq(C.reconcile(E, 0, '2026-09-17', '2026-10', null), { computed: 21220, diff: null, ok: null });
// инвариант: остаток = начальный + сумма эффектов по одной
let b = 0; E.forEach(e => { b += C.bankEffect(e); });
eq(b, 51220);

// сторно: запись и её отмена дают ноль во всех суммах и в банке
const st = C.makeStorno(E[3], 's1', '2026-10-22', 'now');
eq(st.amount, -3780); eq(st.stornoOf, 'd'); eq(C.validEntry(st), true);
const E2 = E.concat([st]);
eq(C.sums(E2, '2026-10').ausgabe, 5630 - 3780);
eq(C.bankBalance(E2, 0, '2026-09-17', '2026-10-31'), 21220 + 3780);
eq(C.stornoedIds(E2), { d: true });

// Auslagen мужа: только E-расходы, не отменённые, не возмещённые
eq(C.openAuslagen(E).map(e => e.id), ['e']);
const E3 = E.concat([{ id: 'x', date: '2026-11-05', type: 'ausgabe', way: 'E', amount: 500, erstattet: true },
  { id: 'y', date: '2026-11-06', type: 'ausgabe', way: 'E', amount: 700 },
  C.makeStorno({ id: 'y', date: '2026-11-06', type: 'ausgabe', way: 'E', amount: 700 }, 'ys', '2026-11-07')]);
eq(C.openAuslagen(E3).map(e => e.id), ['e']);

// CSV: итог в файле равен сумме из sums()
const csv = C.journalCsv(E, '2026-10');
n++; assert.ok(csv.startsWith('﻿'));
n++; assert.ok(csv.includes('Gewinn;;;;;178,70'), csv);
n++; assert.ok(csv.includes('Summe Betriebseinnahmen;;;;;235,00'));
eq(csv.trim().split('\r\n').length, 1 + 6 + 1 + 5);
eq(C.journalCsv([{ id: 'q', date: '2026-10-01', type: 'ausgabe', way: 'G', amount: 100, text: 'a;"b"' }], '').includes('"a;""b"""'), true);

// шаблоны
eq(C.fillTpl('Rechnung Nr. {nr} vom {datum}', { nr: '12', datum: '05.11.2026' }), 'Rechnung Nr. 12 vom 05.11.2026');
eq(C.fillTpl('Rechnung Nr. {nr}', {}), 'Rechnung Nr. …');
eq(C.tplFields(['a {nr} {datum}', 'b {nr} {betrag}']), ['nr', 'datum', 'betrag']);
eq(C.deDate('2026-11-14'), '14.11.2026');
eq(C.nonLatin1('Müller Straße'), false);
eq(C.nonLatin1('Иванова'), true);

console.log('OK: ' + n + ' проверок пройдено');
