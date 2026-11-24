import asyncio, sys; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(400)
        await pg.goto(URL + '#more'); await pg.click('[data-act=bk-open]'); await pg.set_input_files('#bk-file', '/home/claude/LOULOU_Kasse_Umzug_2026-11-24.json'); await pg.wait_for_timeout(300); await pg.click('[data-act=bk-ok]'); await pg.wait_for_timeout(500)
        await pg.goto(URL + '#more'); await pg.wait_for_timeout(200)
        el = pg.locator('.swatches'); await el.scroll_into_view_if_needed(); await pg.screenshot(path='test/shots/acc-more.png')
        out = []
        for k, g in [('rose', True), ('sea', True), ('plum', False), ('sage', True)]:
            await pg.goto(URL + '#more'); await pg.wait_for_timeout(150)
            await pg.click('[data-act=accent][data-k=%s]' % k); await pg.wait_for_timeout(100)
            cur = await pg.is_checked('#grad-on')
            if cur != g: await pg.click('#grad-on'); await pg.wait_for_timeout(100)
            await pg.goto(URL + '#home'); await pg.reload(); await pg.wait_for_timeout(500)
            v = await pg.evaluate("[getComputedStyle(document.body).getPropertyValue('--grad'), localStorage.getItem('kasse-accent'), localStorage.getItem('kasse-grad')]")
            out.append((k, g, v)); await pg.screenshot(path='test/shots/acc-%s.png' % k)
        for o in out: print(o)
        print(errs); await b.close()
asyncio.run(main())
