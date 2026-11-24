import asyncio, sys; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(400)
        await pg.goto(URL + '#more'); await pg.click('[data-act=bk-open]'); await pg.set_input_files('#bk-file', '/home/claude/LOULOU_Kasse_Umzug_2026-11-24.json'); await pg.wait_for_timeout(300); await pg.click('[data-act=bk-ok]'); await pg.wait_for_timeout(2500)
        await pg.goto(URL + '#more'); await pg.wait_for_timeout(200)
        await pg.click('[data-act=mode][data-m=dark]'); await pg.wait_for_timeout(200)
        await pg.locator('.swatches').scroll_into_view_if_needed(); await pg.screenshot(path='test/shots/dk-more.png')
        for v in ['home', 'journal', 'invoices']:
            await pg.goto(URL + '#' + v); await pg.reload(); await pg.wait_for_timeout(600); await pg.screenshot(path='test/shots/dk-%s.png' % v)
        await pg.goto(URL + '#journal'); await pg.wait_for_timeout(300)
        await pg.locator('.item.tap').first.click(); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/dk-entry.png')
        await pg.goto(URL + '#home'); await pg.reload(); await pg.wait_for_timeout(500); await pg.click('.qb >> nth=1'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/dk-form.png')
        cls = await pg.evaluate("document.documentElement.className"); print(cls)
        # auto mode follows system
        await pg.goto(URL + '#more'); await pg.reload(); await pg.wait_for_timeout(500); await pg.click('[data-act=mode][data-m=auto]'); await pg.wait_for_timeout(100)
        await pg.emulate_media(color_scheme='light'); await pg.wait_for_timeout(100); a = await pg.evaluate("document.documentElement.className")
        await pg.emulate_media(color_scheme='dark'); await pg.wait_for_timeout(100); c = await pg.evaluate("document.documentElement.className")
        print('auto light:', a, '| auto dark:', c)
        await pg.click('[data-act=mode][data-m=light]'); print('light:', await pg.evaluate("document.documentElement.className"))
        print(errs); await b.close()
asyncio.run(main())
