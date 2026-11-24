/* Оформление LOU LOU Kasse. Выполняется в <head>, до первой отрисовки, чтобы страница
   ни на миг не показывалась в «голом» стиле. Классы темы — на <html>, цвета — переменными CSS. */
var THEMES = [['neo', 'Объёмный'], ['floral', 'Цветочный'], ['paper', 'Мягкий'], ['boutique', 'Бутик'], ['classic', 'Строгий']];
var MODES = [['light', 'Светлая'], ['dark', 'Тёмная'], ['auto', 'Как в телефоне']];
var ACCENTS = [['rose', 'Пыльная роза', '#a85d6a'], ['plum', 'Слива', '#6e3d6b'], ['lav', 'Лаванда', '#6f5fb0'], ['sea', 'Морская волна', '#2f6e7c'],
  ['sage', 'Шалфей', '#4f7a5d'], ['terra', 'Терракота', '#a4553c'], ['choc', 'Шоколад', '#4a2a26'], ['graph', 'Графит', '#3a3946']];
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function theme() { var t = lsGet('kasse-theme'); return THEMES.some(function (x) { return x[0] === t; }) ? t : 'neo'; }
function mode() { var m = lsGet('kasse-mode'); return MODES.some(function (x) { return x[0] === m; }) ? m : 'light'; }
var darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function isDark() { var m = mode(); return m === 'dark' || (m === 'auto' && !!(darkMq && darkMq.matches)); }
function mixHex(h, t, k) { return '#' + [1, 3, 5].map(function (i) { var a = parseInt(h.substr(i, 2), 16), b = parseInt(t.substr(i, 2), 16); return ('0' + Math.round(a * (1 - k) + b * k).toString(16)).slice(-2); }).join(''); }
function accent() { var k = lsGet('kasse-accent'); return ACCENTS.find(function (a) { return a[0] === k; }) || ACCENTS[0]; }
function gradOn() { return lsGet('kasse-grad') !== '0'; }
function applyAccent() {
  var c = accent()[2], light = mixHex(c, '#ffffff', 0.25), dark = mixHex(c, '#000000', 0.28), st = document.documentElement.style, g = gradOn();
  st.setProperty('--grad', g ? 'linear-gradient(135deg, ' + light + ' 0%, ' + c + ' 50%, ' + dark + ' 100%)' : 'linear-gradient(' + c + ', ' + c + ')');
  st.setProperty('--grad-txt', g ? 'linear-gradient(135deg, ' + c + ' 0%, ' + dark + ' 100%)' : 'linear-gradient(' + c + ', ' + c + ')');
  st.setProperty('--accent', isDark() ? mixHex(c, '#ffffff', 0.42) : c); st.setProperty('--gold', mixHex(c, '#ffffff', 0.55));
}
function applyTheme() {
  var d = isDark(), t = d ? 'neo theme-dark' : theme(), r = document.documentElement;
  r.className = (r.className.replace(/\btheme-\w+/g, '').replace(/\s+/g, ' ').trim() + ' theme-' + t).trim();
  var mt = document.querySelector('meta[name="theme-color"]'); if (mt) mt.setAttribute('content', d ? '#22212a' : (t === 'neo' ? '#e9e9ef' : '#ffffff'));
  applyAccent();
}
applyTheme();
