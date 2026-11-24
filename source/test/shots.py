import asyncio, sys, os; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve(); os.makedirs('test/shots', exist_ok=True)
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/00-login.png')
        await pg.click('[data-act=login]'); await pg.wait_for_timeout(400)
        await pg.goto(URL + '#more'); await pg.click('[data-act=bk-open]'); await pg.set_input_files('#bk-file', 'test/backup_sample.json'); await pg.wait_for_timeout(300); await pg.click('[data-act=bk-ok]'); await pg.wait_for_timeout(400)
        for v in ['home', 'invoices', 'journal', 'more']:
            await pg.goto(URL + '#' + v); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/1-%s.png' % v, full_page=True)
        await pg.goto(URL + '#invoices'); await pg.click('[data-act=iv-open][data-no="202611003"]'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/2-ivcard.png')
        await pg.click('.sheet-x'); await pg.click('[data-act=iv-new]'); await pg.wait_for_timeout(200); await pg.screenshot(path='test/shots/3-ivform.png')
        await pg.select_option('#iv-client', index=1); await pg.fill('#it-t-0', 'Ballondekoration'); await pg.fill('#it-p-0', '80'); await pg.click('[data-act=iv-check]'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='test/shots/4-ivcheck.png', full_page=False)
        await pg.evaluate("document.querySelector('.sheet').scrollTop=600"); await pg.screenshot(path='test/shots/4b-ivcheck.png')
        await pg.click('.sheet-x'); await pg.goto(URL + '#journal'); await pg.click('[data-act=e-open][data-id="e-20261027-telekom"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='test/shots/5-entry.png')
        await pg.click('.sheet-x'); await pg.click('[data-act=j-new]'); await pg.wait_for_timeout(200); await pg.screenshot(path='test/shots/6-newentry.png', full_page=False)
        await pg.click('.sheet-x'); await pg.goto(URL + '#more'); await pg.click('[data-act=euer-open]'); await pg.wait_for_timeout(200); await pg.screenshot(path='test/shots/7-euer.png')
        await pg.click('.sheet-x'); await pg.click('[data-act=bank-open]'); await pg.set_input_files('#bank-file', 'test/camt_sample.csv'); await pg.wait_for_timeout(300); await pg.screenshot(path='test/shots/8-bank.png', full_page=False)
        print(errs); await b.close()
asyncio.run(main())
