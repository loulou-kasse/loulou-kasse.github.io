import glob, hashlib, json, os, shutil
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)); S = os.path.join(R, 'src'); O = os.path.join(R, '..') if os.path.basename(R) == 'source' else os.path.join(R, 'site')
rd = lambda p: open(os.path.join(R, p), encoding='utf-8').read()
app = ''.join(open(f, encoding='utf-8').read() for f in sorted(glob.glob(os.path.join(S, 'app', '*.js'))))
ICON = {
 'home': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z"/></svg>',
 'invoices': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h9l4 4v14H6z M14 3v5h5 M9 12h7 M9 16h7"/></svg>',
 'journal': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5z M9 4v16 M12 9h4 M12 13h4"/></svg>',
 'more': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>'}
t = rd('src/template.html')
for k, v in ICON.items(): t = t.replace('/*ICON_%s*/' % k, v)
t = t.replace('/*STYLE*/', rd('src/style.css')).replace('/*CORE*/', rd('src/core.js')).replace('/*BACKEND*/', rd('src/backend.js')).replace('/*APP*/', app)
for k, f in (('/*LOGO_ROUND*/', 'assets/logo_round.b64'), ('/*LOGO_HEAD*/', 'assets/logo_pdf.b64'), ('/*LOGO_PDF*/', 'assets/logo_pdf.b64'), ('/*FONT_R*/', 'assets/LS-Regular.b64'), ('/*FONT_B*/', 'assets/LS-Bold.b64')):
    t = t.replace(k, rd(f).strip())
assert '/*' + 'LOGO' not in t and '/*FONT' not in t and '/*ICON' not in t
os.makedirs(os.path.join(O, 'icons'), exist_ok=True); os.makedirs(os.path.join(O, 'vendor'), exist_ok=True)
open(os.path.join(O, 'index.html'), 'w', encoding='utf-8').write(t)
# конфигурация Firebase: config.js в корне проекта (не перезаписывается заглушкой)
cfg = os.path.join(O, 'config.js') if os.path.basename(R) == 'source' else os.path.join(R, 'config.js')
src_cfg = cfg if os.path.exists(cfg) else os.path.join(R, 'config.example.js')
if os.path.abspath(src_cfg) != os.path.abspath(os.path.join(O, 'config.js')): shutil.copy(src_cfg, os.path.join(O, 'config.js'))
# значки приложения из логотипа
logo = Image.open(os.path.join(R, 'assets', 'logo.jpg')).convert('RGB')
for n in (192, 512):
    c = Image.new('RGB', (n, n), (255, 255, 255)); k = 0.78 * n / max(logo.size)
    im = logo.resize((round(logo.width * k), round(logo.height * k)), Image.LANCZOS)
    c.paste(im, ((n - im.width) // 2, (n - im.height) // 2)); c.save(os.path.join(O, 'icons', 'icon-%d.png' % n))
json.dump({'name': 'LOU LOU Kasse', 'short_name': 'LOU LOU Kasse', 'start_url': './', 'scope': './', 'id': './', 'display': 'standalone', 'background_color': '#ffffff', 'theme_color': '#ffffff', 'lang': 'ru',
  'icons': [{'src': 'icons/icon-192.png', 'sizes': '192x192', 'type': 'image/png'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any'}, {'src': 'icons/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'maskable'}]},
  open(os.path.join(O, 'manifest.webmanifest'), 'w'), ensure_ascii=False, indent=1)
files = ['./', 'index.html', 'config.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'] + ['vendor/' + f for f in sorted(os.listdir(os.path.join(O, 'vendor')))]
h = hashlib.sha256()
for f in files[1:]: h.update(open(os.path.join(O, f), 'rb').read())
ver = h.hexdigest()[:10]
open(os.path.join(O, 'sw.js'), 'w').write(rd('src/sw.js').replace('/*VERSION*/', ver).replace('/*FILES*/', json.dumps(files)))
open(os.path.join(O, '.nojekyll'), 'w').write('')
print('index.html', len(t.encode()), 'bytes; sw version', ver)
