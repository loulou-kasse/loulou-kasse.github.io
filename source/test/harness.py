import asyncio, json, os, re, base64, threading, http.server, socketserver, functools
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
PORT = 8765
def serve():
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=SITE)
    h.log_message = lambda *a: None
    socketserver.TCPServer.allow_reuse_address = True
    s = socketserver.TCPServer(('127.0.0.1', PORT), h); threading.Thread(target=s.serve_forever, daemon=True).start(); return s
MOCK = open(os.path.join(ROOT, 'test', 'fbmock.js')).read()
CFG = "window.KASSE_CONFIG={firebase:{apiKey:'test',projectId:'test',authDomain:'x',appId:'1'}};"
SAVE_STUB = """
(function(){ window.__saved=[]; var oc=URL.createObjectURL; URL.createObjectURL=function(b){ var u=oc.call(URL,b); window.__blobs=window.__blobs||{}; window.__blobs[u]=b; return u; };
 var ck=HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click=function(){ if(this.download){ var b=window.__blobs[this.href]; var name=this.download; b.arrayBuffer().then(function(ab){ var s='',u8=new Uint8Array(ab); for(var i=0;i<u8.length;i+=8192) s+=String.fromCharCode.apply(null,u8.subarray(i,i+8192)); window.__saved.push({name:name,type:b.type,b64:btoa(s)}); }); return; } return ck.call(this); }; })();
"""
class Drive:
    def __init__(s): s.uploads = []; s.folders = {}; s.n = 0
    async def handle(s, route):
        req = route.request; url = req.url; s.n += 1
        if '/upload/drive/v3/files' in url:
            body = req.post_data_buffer or b''
            m = re.search(rb'\r\n\r\n(\{.*?\})\r\n--', body, re.S); meta = json.loads(m.group(1)) if m else {}
            s.uploads.append({'meta': meta, 'size': len(body), 'ctype': re.findall(rb'Content-Type: ([^\r]+)', body)})
            return await route.fulfill(json={'id': 'f%d' % s.n, 'name': meta.get('name'), 'webViewLink': 'https://drive.google.com/file/d/f%d/view' % s.n})
        if '/drive/v3/files' in url and req.method == 'GET':
            from urllib.parse import urlparse, parse_qs, unquote
            q = parse_qs(urlparse(url).query).get('q', [''])[0]
            nm = re.search(r"name='([^']*)'", q).group(1); par = re.search(r"'([^']*)' in parents", q).group(1)
            fid = s.folders.get((par, nm)); return await route.fulfill(json={'files': [{'id': fid, 'name': nm}] if fid else []})
        if '/drive/v3/files' in url and req.method == 'POST':
            meta = json.loads(req.post_data); fid = 'dir%d' % s.n; s.folders[(meta['parents'][0], meta['name'])] = fid
            return await route.fulfill(json={'id': fid})
        await route.fulfill(status=404, json={'error': {'message': 'nope'}})
async def page(p, w=412, h=915, clear=True):
    b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=True, locale='de-DE')
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'fonts' not in m.text else None)
    drive = Drive()
    await pg.route('**/config.js', lambda r: r.fulfill(body=CFG, content_type='application/javascript'))
    await pg.route('**/vendor/firebase-app-compat.js', lambda r: r.fulfill(body=MOCK, content_type='application/javascript'))
    await pg.route(re.compile(r'.*/vendor/firebase-(auth|firestore)-compat\.js'), lambda r: r.fulfill(body='', content_type='application/javascript'))
    await pg.route(re.compile(r'https://www\.googleapis\.com/.*'), drive.handle)
    await pg.route(re.compile(r'https://fonts\.(googleapis|gstatic)\.com/.*'), lambda r: r.fulfill(body='', content_type='text/css'))
    await pg.add_init_script(SAVE_STUB)
    if clear: await pg.add_init_script("if(!sessionStorage.__init){localStorage.clear();sessionStorage.__init=1}")
    return b, pg, errs, drive
URL = 'http://127.0.0.1:%d/' % PORT
async def saved(pg, n=1, t=3000):
    for _ in range(t // 100):
        s = await pg.evaluate('window.__saved')
        if len(s) >= n: return s
        await pg.wait_for_timeout(100)
    return await pg.evaluate('window.__saved')
