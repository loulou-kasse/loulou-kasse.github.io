import asyncio, sys, os; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(400)
        await pg.goto(URL + '#more'); await pg.click('[data-act=bk-open]'); await pg.set_input_files('#bk-file', '/home/claude/LOULOU_Kasse_Umzug_2026-11-24.json'); await pg.wait_for_timeout(300); await pg.click('[data-act=bk-ok]'); await pg.wait_for_timeout(500)
        await pg.goto(URL + '#more'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/n-more.png')
        await pg.goto(URL + '#invoices'); await pg.click('[data-act=iv-open][data-no="202611003"]'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/n-iv.png')
        await pg.click('.sheet-x'); await pg.click('[data-act=iv-new]'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/n-form.png')
        await pg.click('.sheet-x'); await pg.goto(URL + '#journal'); await pg.click('[data-act=e-open][data-id="e-20261027-telekom"]'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/n-entry.png')
        print(errs); await b.close()
asyncio.run(main())
