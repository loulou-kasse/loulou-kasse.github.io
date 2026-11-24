
  /* ---------- события ---------- */
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-act]'); if (!b) return;   /* касание вне полей окно не закрывает */
    var a = b.dataset.act, i = parseInt(b.dataset.i, 10), no = b.dataset.no, id = b.dataset.id, o, e;
    if (a === 'login') { var le = $('#login-err'); B.signIn().catch(function (er) { if (le) le.textContent = B.authErr(er); }); }
    else if (a === 'logout') { closeSheet(); B.signOut(); }
    else if (a === 'drive-connect') B.connectDrive().then(function () { toast('Google Drive подключён'); drawMain(); if (b.dataset.reopen) sheetEntryView(b.dataset.reopen); }, function (er) { toast(er && er.code ? B.authErr(er) : (er && er.message || 'Drive не подключён')); });
    else if (a === 'g-sit') { g = { step: 1, sit: i, opt: null, vals: {} }; drawMain(); }
    else if (a === 'g-opt') { g.step = 2; g.opt = i; g.vals = {}; drawMain(); }
    else if (a === 'g-back') { g.step -= 1; drawMain(); }
    else if (a === 'g-copy') copyText($('code[data-tpl="' + i + '"]').textContent);
    else if (a === 'g-journal') { o = GUIDE[g.sit].opts[g.opt]; sheetEntry({ type: o.journal.type, way: o.journal.way, text: o.journal.type === 'ausgabe' ? '' : C.fillTpl(o.texts[0][1], guideVals()).replace(/…/g, '').trim() }); }
    else if (a === 'sheet-close') closeSheet();
    else if (a === 'go-iv-open') { ivf = 'open'; location.hash = '#invoices'; }
    else if (a === 'go-rec') { month = b.dataset.m; jf = { q: '', kind: 'all' }; if (view === 'journal') drawMain(); else location.hash = '#journal'; }
    else if (a === 'go-more') location.hash = '#more';
    else if (a === 'go-month') { month = today().slice(0, 7); jf = { q: '', kind: 'all' }; location.hash = '#journal'; }

    else if (a === 'theme') { setTheme(b.dataset.t); drawMain(); }
    else if (a === 'go-nobeleg') { jf = { q: '', kind: 'nobeleg' }; month = 'all'; closeSheet(); if (view === 'journal') drawMain(); else location.hash = '#journal'; }
    else if (a === 'go-nocat') { jf = { q: '', kind: 'nocat' }; month = 'all'; closeSheet(); if (view === 'journal') drawMain(); else location.hash = '#journal'; }
    /* счета */
    else if (a === 'ivf') { ivf = b.dataset.f; drawMain(); }
    else if (a === 'iv-new') sheetInvoice();
    else if (a === 'iv-open') sheetIv(no);
    else if (a === 'iv-repeat') { o = findIv(no); sheetInvoice({ rcpt: o.rcpt, items: o.items }); }
    else if (a === 'it-add') { $('#iv-items').insertAdjacentHTML('beforeend', itemRow(rowN++)); }
    else if (a === 'it-del') { if (document.querySelectorAll('#iv-items [data-wrap]').length > 1) b.closest('[data-wrap]').remove(); updTotal(); }
    else if (a === 'iv-check') ivCheck();
    else if (a === 'iv-edit') ivEdit();
    else if (a === 'paper-zoom') { o = $('.paper', b); o.style.zoom = o.style.zoom === '1' ? Math.min(1, (b.clientWidth - 22) / 595) : '1'; }
    else if (a === 'iv-draft') { try { saveBlob('ENTWURF_' + ivFileName(ivDraft), pdfBlob(invoicePdf(ivDraft, true))); } catch (er) { setErr('Не удалось собрать PDF: ' + (er.message || er)); } }
    else if (a === 'iv-issue') issueInvoice(b);
    else if (a === 'iv-pdf') ivAct('pdf', no); else if (a === 'iv-share') ivAct('share', no); else if (a === 'iv-drive') ivAct('drive', no); else if (a === 'iv-gdoc') ivAct('gdoc', no);
    else if (a === 'iv-pay') sheetPay(no);
    else if (a === 'pay-ok') { if (!val('pay-date')) return setErr('Укажите дату.'); busy(b, true); payInvoice(findIv(no), val('pay-date'), val('pay-way')).then(function () { closeSheet(); toast('Оплата записана'); }).catch(function (er) { busy(b, false); setErr(dbErr(er)); }); }
    else if (a === 'iv-storno') sheetStornoIv(no); else if (a === 'ivst-ok') stornoInvoice(no, b);
    else if (a === 'iv-remind') sheetRemind(no);
    else if (a === 'rm-pdf') rmAct('pdf', no); else if (a === 'rm-share') rmAct('share', no); else if (a === 'rm-drive') rmAct('drive', no);
    /* журнал */
    else if (a === 'j-new') sheetEntry({ type: b.dataset.type || 'ausgabe', photo: b.dataset.photo === '1' });
    else if (a === 'e-save') saveEntry(b);
    else if (a === 'e-open') sheetEntryView(id);
    else if (a === 'jf') { jf.kind = b.dataset.f; drawMain(); }
    else if (a === 'j-storno') sheetStornoEntry(id);
    else if (a === 'est-ok') { e = S.entries.find(function (x) { return x.id === id; }); busy(b, true); putEntry(C.makeStorno(e, newId('e'), today(), new Date().toISOString())).then(function () { closeSheet(); toast('Запись отменена'); }).catch(function (er) { busy(b, false); setErr(dbErr(er)); }); }
    else if (a === 'ev-nob') { patchEntry(id, { noBeleg: b.dataset.v === '1' ? 'kontoauszug' : null }).then(function () { sheetEntryView(id); }); }
    else if (a === 'ev-tpl') { e = S.entries.find(function (x) { return x.id === id; }); putTemplate({ id: newId('t'), name: e.text || TYPE_RU[e.type], type: e.type, way: e.way, amount: e.amount, text: e.text || '', party: e.party || '', cat: e.cat || '', noBeleg: !!e.noBeleg }).then(function () { toast('Шаблон сохранён'); }); }
    else if (a === 'j-rec' && month !== 'all') {
      var raw = val('j-stmt'), c = raw === '' ? null : C.parseMoney(raw);
      if (raw !== '' && c == null) return toast('Остаток вводите как 212,20');
      var st = Object.assign({}, S.bank.statements); if (c == null) delete st[month]; else st[month] = c;
      S.bank = { statements: st }; drawMain(); putBank({ statements: st });
    }
    else if (a === 'j-csv') saveBlob('Journal_' + (month === 'all' ? 'gesamt_' + today() : month) + '.csv', new Blob([C.journalCsv(S.entries, month === 'all' ? '' : month)], { type: 'text/csv' }));
    else if (a === 'j-prev' || a === 'j-next') { var ms = monthList(), k = ms.indexOf(month) + (a === 'j-prev' ? 1 : -1); if (k >= 0 && k < ms.length) { month = ms[k]; drawMain(); } }
    else if (a === 'j-goto') { month = b.dataset.m; drawMain(); }
    /* ещё */
    else if (a === 'au-copy') copyText($('#au-txt').textContent);
    else if (a === 'au-ok') {
      var open = C.openAuslagen(S.entries), sum = open.reduce(function (x, y) { return x + y.amount; }, 0), txt = $('#au-txt').textContent, rid = newId('e');
      busy(b, true);
      putEntry({ id: rid, date: today(), type: 'entnahme', way: 'G', amount: sum, party: S.settings.mannvoll || '', text: txt, doc: '', createdAt: new Date().toISOString() })
        .then(function () { var ch = Promise.resolve(); open.forEach(function (x) { ch = ch.then(function () { return patchEntry(x.id, { erstattet: rid }); }); }); return ch; })
        .then(function () { toast('Возмещение ' + eur(sum) + ' проведено'); }).catch(function (er) { busy(b, false); toast(dbErr(er)); });
    }
    else if (a === 'euer-open') sheetEuer();
    else if (a === 'euer-csv') saveBlob('EUER_' + b.dataset.y + '.csv', new Blob([C.euerCsv(C.euerReport(S.entries, b.dataset.y))], { type: 'text/csv' }));
    else if (a === 'bank-open') sheetBank();
    else if (a === 'bank-add') { o = bankRes.missing[i]; sheetEntry({ type: o.amount > 0 ? 'einnahme' : 'ausgabe', way: 'G', date: o.date, amount: Math.abs(o.amount), party: o.party, text: (o.text || o.kind || '').slice(0, 120), fromBank: true }); }
    else if (a === 'pack-open') sheetPack(b.dataset.y);
    else if (a === 'pack-make') {
      var y = val('pack-y'), kind = b.dataset.k, nm = 'LOULOU_Unterlagen_' + y + '.zip';
      if (kind === 'drive' && !B.driveReady()) { withDrive(function () { return makePack(y).then(function (z) { return B.upload({ name: nm, mime: 'application/zip', data: z, parent: drive().root }); }).then(function () { toast('Архив сохранён в Drive'); }); }); return; }
      busy(b, true); setErr('');
      makePack(y).then(function (z) {
        busy(b, false);
        if (kind === 'dl') saveBlob(nm, z); else if (kind === 'share') shareBlob(nm, z, 'Unterlagen ' + y);
        else withDrive(function () { return B.upload({ name: nm, mime: 'application/zip', data: z, parent: drive().root }).then(function () { toast('Архив сохранён в Drive: Violeta Larina Dokumente'); }); });
      }).catch(function (er) { busy(b, false); setErr('Архив не собран: ' + (er && er.message || er)); });
    }
    else if (a === 'tpl-open') sheetTemplates();
    else if (a === 'tpl-use') { sheetEntry({}); applyTpl(id); }
    else if (a === 'tpl-del') { delTemplate(id).then(function () { sheetTemplates(); }); }
    else if (a === 'eb-new') sheetEigen(id);
    else if (a === 'eb-pdf' || a === 'eb-drive') eigenGo(a === 'eb-pdf' ? 'pdf' : 'drive', b);
    else if (a === 'set-open') sheetSettings(); else if (a === 'set-save') saveSettings(b);
    else if (a === 'bk-open') sheetBackup();
    else if (a === 'bk-save') saveBlob('LOULOU_Kasse_' + today() + '.json', new Blob([backupJson()], { type: 'application/json' }));
    else if (a === 'bk-drive') withDrive(function () { return backupToDrive(false); });
    else if (a === 'bk-ok') doRestore(b);
  });
  document.addEventListener('input', function (ev) {
    var t = ev.target;
    if (t.dataset && t.dataset.gf) {
      g.vals[t.dataset.gf] = t.value; var v = guideVals(), o = GUIDE[g.sit].opts[g.opt];
      document.querySelectorAll('code[data-tpl]').forEach(function (c) { c.textContent = C.fillTpl(o.texts[parseInt(c.dataset.tpl, 10)][1], v); });
    } else if (t.dataset && t.dataset.it) updTotal();
    else if (t.id === 'j-q') { jf.q = t.value; clearTimeout(t._tm); t._tm = setTimeout(function () { var pos = t.selectionStart; drawMain(); var n = $('#j-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 250); }
    else if (t.dataset && t.dataset.auto === '1' && (t.id === 'iv-title' || t.id === 'iv-no' || t.id === 'iv-llabel' || t.id === 'iv-hint')) t.dataset.auto = '0';
  });
  document.addEventListener('change', function (ev) {
    var t = ev.target;
    if (t.id === 'j-month' && (t.value === 'all' || /^\d{4}-\d{2}$/.test(t.value))) { month = t.value; drawMain(); }
    else if (t.id === 'e-type') fillWays();
    else if (t.id === 'e-tpl' && t.value) applyTpl(t.value);
    else if (t.id === 'iv-kind') kindChanged();
    else if (t.id === 'iv-duesel') dueChanged();
    else if (t.id === 'iv-client' && t.value !== '') { var c = C.clientsFrom(S.invoices)[parseInt(t.value, 10)]; if (c) $('#iv-rcpt').value = c.rcpt; }
    else if (t.dataset && t.dataset.it === 'tpl' && t.value) { var ta = t.closest('[data-wrap]').querySelector('[data-it=text]'); ta.value = t.value; t.value = ''; ta.focus(); updTotal(); }
    else if (t.closest && t.closest('#iv-prepay') && t.type === 'checkbox') {
      var rc = document.getElementById('iv-rcpt'), v0 = findIv(t.value);
      if (t.checked && v0 && !rc.value.trim()) rc.value = v0.rcpt || ivName(v0);
      updTotal();
    }
    else if (t.id === 'iv-date') setAuto('iv-no', C.nextInvoiceNo(S.invoices, t.value, S.settings.lastIssued));
    else if (t.id === 'ev-cat') patchEntry(t.dataset.id, { cat: t.value || null }).then(function () { toast('Статья сохранена'); });
    else if (t.id === 'ev-file' && t.files && t.files[0]) {
      var f = t.files[0], e = S.entries.find(function (x) { return x.id === t.dataset.id; });
      withDrive(function () { return attachBeleg(e, f).then(function () { toast('Документ сохранён в Drive: Belege › ' + e.date.slice(0, 7)); if (sheetOpen()) sheetEntryView(e.id); }); });
    }
    else if (t.id === 'eb-j') { $('#eb-jw').hidden = !t.checked; }
    else if (t.id === 'euer-y') sheetEuer(t.value);
    else if (t.id === 'pack-y') { /* выбор года читается при нажатии */ }
    else if (t.id === 'bank-file' && t.files && t.files[0]) bankFile(t.files[0]);
    else if (t.id === 'bk-file' && t.files && t.files[0]) { restore(t.files[0]); t.value = ''; }
  });
  document.addEventListener('focusout', function () { setTimeout(function () { if (dirty && !sheetOpen()) { var a = document.activeElement; if (!(a && $('#main').contains(a) && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) drawMain(); } }, 60); });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && sheetOpen()) closeSheet(); });
  window.addEventListener('hashchange', route);
  document.addEventListener('touchstart', function () {}, { passive: true });   /* включает :active (эффект нажатия) на сенсорных экранах */
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(function () {});
  applyTheme();
  boot();
})();
