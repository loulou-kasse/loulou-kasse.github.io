import asyncio, sys, os; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve(); os.makedirs('test/shots', exist_ok=True)
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(400)
        await pg.goto(URL + '#more'); await pg.click('[data-act=bk-open]'); await pg.set_input_files('#bk-file', '/home/claude/LOULOU_Kasse_Umzug_2026-11-24.json'); await pg.wait_for_timeout(300); await pg.click('[data-act=bk-ok]'); await pg.wait_for_timeout(500)
        for t in ['floral', 'paper', 'boutique', 'classic']:
            await pg.evaluate("localStorage.setItem('kasse-theme','%s')" % t)
            await pg.goto(URL + '#home'); await pg.reload(); await pg.wait_for_timeout(700)
            await pg.screenshot(path='test/shots/th-%s.png' % t); await pg.evaluate('window.scrollTo(0, 99999)'); await pg.wait_for_timeout(100); await pg.screenshot(path='test/shots/thb-%s.png' % t)
            if t == 'floral':
                for v in ['invoices', 'journal']:
                    await pg.goto(URL + '#' + v); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/thf-%s.png' % v)
        print(errs); await b.close()
asyncio.run(main())
