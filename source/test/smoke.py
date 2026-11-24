import asyncio, sys; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(500)
        print('login:', await pg.inner_text('#main'))
        await pg.click('[data-act=login]'); await pg.wait_for_timeout(600)
        print('home:', (await pg.inner_text('#main'))[:300])
        await pg.screenshot(path='test/out_home.png', full_page=True)
        for v in ['invoices', 'journal', 'more', 'guide']:
            await pg.goto(URL + '#' + v); await pg.wait_for_timeout(300)
        print(errs); await b.close()
asyncio.run(main())
