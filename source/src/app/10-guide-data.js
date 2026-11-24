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
