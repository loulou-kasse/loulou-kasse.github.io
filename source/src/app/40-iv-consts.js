
  /* ---------- счета ---------- */
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
