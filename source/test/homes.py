import asyncio, sys, os; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(400)
        await pg.goto(URL + '#more'); await pg.click('[data-act=bk-open]'); await pg.set_input_files('#bk-file', '/home/claude/LOULOU_Kasse_Umzug_2026-11-24.json'); await pg.wait_for_timeout(300); await pg.click('[data-act=bk-ok]'); await pg.wait_for_timeout(500)
        for l in ['card', 'feed', 'tiles']:
            await pg.evaluate("localStorage.setItem('kasse-home','%s')" % l)
            await pg.goto(URL + '#home'); await pg.reload(); await pg.wait_for_timeout(700)
            await pg.screenshot(path='test/shots/home-%s.png' % l)
            if l == 'feed':
                await pg.click('[data-act=fab]'); await pg.wait_for_timeout(200); await pg.screenshot(path='test/shots/home-feed-fab.png')
        print(errs); await b.close()
asyncio.run(main())
