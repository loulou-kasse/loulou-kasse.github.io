
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
  function invoicePdf(iv, draft) {
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
    if (iv.status === 'storniert' || draft) { d.setPage(1); d.setTextColor(170, 40, 40); d.setFont(FONT, 'bold'); d.setFontSize(56); d.text(draft ? 'ENTWURF' : 'STORNIERT', 297.6, 450, { align: 'center', angle: 30 }); }
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
