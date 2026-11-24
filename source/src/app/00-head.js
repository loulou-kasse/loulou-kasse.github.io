(function () {
  'use strict';
  var C = window.Core, B = window.Backend;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var pad = function (n) { return ('0' + n).slice(-2); };
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  var MES = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var MES_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var eur = function (c) { return C.fmtMoney(c) + ' €'; };
  var newId = function (p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); };
  var LS = 'loulou-kasse-v1';
  var MEMO = 'https://claude.ai/artifact/BJHbk2TqtaMRzend33zjaa';
  /* папки Google Drive по умолчанию: «Violeta Larina Dokumente» и её подпапки (меняются в настройках) */
  var DRIVE_DEFAULT = { root: '1T16eFA8SrZM-8K4-9YHqiikAjdbiT2rC', rechnungen: '1dnU_sH4_htAFJDYVg5qKmmblLX4wroOR', eigenbelege: '1GRaZvdai2-7sp4VTBFmkA_z8-Bozjthg' };

  var S = { entries: [], invoices: [], templates: [], settings: {}, bank: { statements: {} }, mode: 'boot', note: '', user: null, pending: false, loaded: {} };
  var db = null, unsub = [];
  var view = 'home', dirty = false, month = 'all';
  var jf = { q: '', kind: 'all' }, ivf = 'open';
  var g = { step: 0, sit: null, opt: null, vals: {} };

  var TYPE_RU = { einnahme: 'Выручка', ausgabe: 'Расход', entnahme: 'Изъятие', einlage: 'Вклад' };
  var WAY_RU = { G: 'Рабочий счёт', P: 'Личный счёт владелицы', E: 'Счёт супруга', B: 'Наличные' };
  var LOGO_PDF = 'data:image/jpeg;base64,/*LOGO_PDF*/';
  var FONT_R = '/*FONT_R*/', FONT_B = '/*FONT_B*/', FONT = 'LiberationSans';
  var addr = function (s) { return [s.strasse, s.ort].filter(Boolean).join(', '); };
  var WAYS_FOR = { einnahme: ['G', 'B'], ausgabe: ['G', 'P', 'E', 'B'], entnahme: ['G'], einlage: ['G'] };
  function drive() { return Object.assign({}, DRIVE_DEFAULT, S.settings.drive || {}); }
