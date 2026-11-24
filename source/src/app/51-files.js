
  /* предпросмотр счёта в окне: та же раскладка, что в PDF, в уменьшенном виде */
  function paperHtml(iv) {
    var s = S.settings, e = esc;
    var head = [[s.inh, 1], [s.firma, 1], [s.strasse], [s.ort], [s.tel ? 'Tel.: ' + s.tel : ''], [s.email], [s.steuernr ? 'Steuernummer: ' + s.steuernr : ''], [[s.bank, s.bic ? 'BIC: ' + s.bic : ''].filter(Boolean).join(' · ')], [s.iban ? 'IBAN: ' + s.iban : '']]
      .filter(function (l) { return l[0]; }).map(function (l) { return l[1] ? '<b>' + e(l[0]) + '</b>' : e(l[0]); }).join('<br>');
    var rows = iv.items.map(function (it, i) { return '<tr><td class="c">' + (i + 1) + '</td><td>' + e(it.text) + '</td><td class="c">' + C.fmtQty(it.qty) + '</td><td class="r">' + C.fmtMoney(it.price) + '</td><td class="r">' + C.fmtMoney(C.lineTotal(it.qty, it.price)) + '</td></tr>'; }).join('');
    var tot = iv.deductions && iv.deductions.length ?
      '<tr class="t"><td colspan="4" class="r">Gesamtbetrag der Leistung (EUR)</td><td class="r">' + C.fmtMoney(iv.gross) + '</td></tr>' + iv.deductions.map(function (x) { return '<tr class="t"><td colspan="4" class="r">' + e(dedLabel(x)) + '</td><td class="r">-' + C.fmtMoney(x.amount) + '</td></tr>'; }).join('') + '<tr class="tt"><td colspan="4" class="r"><b>Restbetrag (EUR)</b></td><td class="r"><b>' + C.fmtMoney(iv.total) + '</b></td></tr>' :
      '<tr class="tt"><td colspan="4" class="r"><b>Rechnungsbetrag (EUR)</b></td><td class="r"><b>' + C.fmtMoney(iv.total) + '</b></td></tr>';
    return '<div class="paper"><div class="ph"><img src="' + LOGO_PDF + '" alt=""><div class="r">' + head + '</div></div>' +
      '<p><b>Rechnung an:</b><br>' + e(iv.rcpt || ivName(iv)).replace(/\n/g, '<br>') + '</p><h4>' + e(iv.title || 'Rechnung') + '</h4>' +
      '<table class="meta"><tr><td><b>Rechnungsnummer:</b></td><td><b>' + e(iv.no) + '</b></td></tr><tr><td>Rechnungsdatum:</td><td>' + C.deDate(iv.date) + '</td></tr><tr><td>' + e(iv.llabel || 'Leistungsdatum') + ':</td><td>' + C.deDate(iv.ldate) + '</td></tr></table>' +
      '<table class="pos"><thead><tr><th>Pos.</th><th>Beschreibung</th><th>Menge</th><th>Einzelpreis (EUR)</th><th>Gesamt (EUR)</th></tr></thead><tbody>' + rows + tot + '</tbody></table>' +
      '<p>' + noteLines(iv).map(function (l) { return l[1] ? '<b>' + e(l[0]) + '</b>' : e(l[0]); }).join('<br>') + '</p>' + (iv.closing ? '<p>' + e(iv.closing) + '</p>' : '') + '<p>' + e(s.inh || '') + '</p></div>';
  }

  /* Zahlungserinnerung: вежливое напоминание, без пени */
  function reminderPdf(iv, by) {
    var s = S.settings, d = pdfDoc(); pdfHead(d);
    d.setFont(FONT, 'normal'); var y = 222.3;
    String(iv.rcpt || ivName(iv)).split(/\n/).forEach(function (l) { d.text(l, XL, y); y += LH; });
    d.text(String(s.ort || '').replace(/^\d+\s*/, '') + ', ' + C.deDate(today()), XR, 301.49, { align: 'right' });
    d.setFont(FONT, 'bold'); d.setFontSize(13.59); d.text('Zahlungserinnerung', XL, 330); d.setFontSize(FS);
    d.text('Rechnung Nr. ' + iv.no + ' vom ' + C.deDate(iv.date), XL, 348);
    d.setFont(FONT, 'normal'); y = 380;
    ['Sehr geehrte Damen und Herren,', '',
      'sicherlich ist Ihrer Aufmerksamkeit entgangen, dass unsere Rechnung Nr. ' + iv.no + ' vom ' + C.deDate(iv.date) + ' über ' + C.fmtMoney(iv.total) + ' EUR' + (iv.due ? ', fällig am ' + C.deDate(iv.due) + ',' : '') + ' noch nicht beglichen ist.', '',
      'Wir bitten Sie, den offenen Betrag bis zum ' + C.deDate(by) + ' auf das unten genannte Konto zu überweisen.', '',
      'Kontoinhaberin: ' + (s.inh || ''), 'IBAN: ' + (s.iban || '') + (s.bic ? '   BIC: ' + s.bic : ''), 'Verwendungszweck: ' + iv.no, '',
      'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie dieses Schreiben bitte als gegenstandslos.', '',
      'Mit freundlichen Grüßen', '', s.inh || ''].forEach(function (l) {
      if (!l) { y += LH * 0.6; return; }
      d.splitTextToSize(l, XR - XL).forEach(function (t) { d.text(t, XL, y); y += LH; });
    });
    return d;
  }

  /* ---------- файлы ---------- */
  function safeName(s) { return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60); }
  function ivFileName(iv) { return safeName(iv.title || 'Rechnung') + '_' + iv.no + (iv.status === 'storniert' ? '_STORNIERT' : '') + '.pdf'; }
  function saveBlob(name, blob) {
    if (!B) { toast('Сохранение недоступно'); return; }
    B.download(name, blob).then(function () { toast('Файл сохранён: ' + name); });
  }
  function shareBlob(name, blob, title) {
    if (!B.canShare(name, blob)) { saveBlob(name, blob); toast('Отправка недоступна на этом устройстве — файл сохранён'); return; }
    B.share(name, blob, title).catch(function (e) { if (!e || e.name !== 'AbortError') toast('Не удалось отправить: ' + (e && e.message || e)); });
  }
  /* Drive: если доступа нет — окно Google открывается прямо из нажатия, потом файл загружается */
  function withDrive(job) {
    if (!B || !B.available()) { toast('Google Drive доступен только в онлайн-версии с входом'); return; }
    var run = function () {
      toast('Отправка в Google Drive…');
      return job().catch(function (e) {
        if (e && e.code === 'drive/no-token') toast(e.message, ['drive-connect', 'Подключить']);
        else toast('Google Drive: ' + (e && e.message || e));
      });
    };
    if (B.driveReady()) return run();
    B.connectDrive().then(run, function (e) { toast(e && e.code ? B.authErr(e) : (e && e.message || 'Drive не подключён')); });
  }
  function pdfBlob(d) { return d.output('blob'); }
  function ivAct(kind, no) {
    var iv = findIv(no); if (!iv) return;
    try {
      var name = ivFileName(iv);
      if (kind === 'pdf') return saveBlob(name, pdfBlob(invoicePdf(iv)));
      if (kind === 'share') return shareBlob(name, pdfBlob(invoicePdf(iv)), (iv.title || 'Rechnung') + ' ' + iv.no);
      var blob = kind === 'drive' ? pdfBlob(invoicePdf(iv)) : new Blob([invoiceHtml(iv)], { type: 'text/html' });
      withDrive(function () {
        return B.upload(kind === 'drive' ? { name: name, mime: 'application/pdf', data: blob, parent: drive().rechnungen } :
          { name: name.replace(/\.pdf$/, ''), mime: 'text/html', data: blob, parent: drive().rechnungen, convertTo: 'application/vnd.google-apps.document' })
          .then(function () { toast((kind === 'drive' ? 'PDF' : 'Google Doc') + ' сохранён в Drive: Rechnungen'); });
      });
    } catch (e) { toast('Не удалось сформировать документ: ' + (e.message || e)); }
  }
  function rmAct(kind, no) {
    var iv = findIv(no), by = val('rm-by'); if (!iv) return;
    if (!by) return setErr('Укажите новый срок оплаты.');
    try {
      var d = reminderPdf(iv, by), name = 'Zahlungserinnerung_' + iv.no + '_' + today() + '.pdf', blob = pdfBlob(d);
      if (kind === 'pdf') saveBlob(name, blob);
      else if (kind === 'share') shareBlob(name, blob, 'Zahlungserinnerung ' + iv.no);
      else withDrive(function () { return B.upload({ name: name, mime: 'application/pdf', data: blob, parent: drive().rechnungen }).then(function () { toast('Напоминание сохранено в Drive: Rechnungen'); }); });
      noteReminder(iv, by);
    } catch (e) { setErr('Не удалось собрать PDF: ' + (e.message || e)); }
  }
  /* фото чека: уменьшение до 1800 px по длинной стороне, JPEG */
  function shrinkImage(file) {
    if (!/^image\//.test(file.type) || /gif|svg/.test(file.type)) return Promise.resolve(file);
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b && b.size < file.size ? b : file); }, 'image/jpeg', 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }
  function belegName(e, file) {
    var ext = file.type === 'application/pdf' ? 'pdf' : /^image\//.test(file.type) ? 'jpg' : (String(file.name || '').split('.').pop() || 'bin');
    return e.date + '_' + (safeName(e.party || e.text) || 'Beleg') + '_' + C.fmtMoney(e.amount).replace(/\./g, '') + '_' + e.way + '.' + ext;
  }
  /* загрузить документ к записи: Drive › Belege › ГГГГ-ММ, ссылка записывается в запись */
  function attachBeleg(e, file) {
    return shrinkImage(file).then(function (blob) {
      var name = belegName(e, file);
      return B.folderPath(drive().root, ['Belege', e.date.slice(0, 7)]).then(function (fid) {
        return B.upload({ name: name, mime: blob.type || file.type || 'application/octet-stream', data: blob, parent: fid });
      }).then(function (r) { return patchEntry(e.id, { beleg: { id: r.id, name: r.name || name, link: r.webViewLink || '', at: today() } }); });
    });
  }
