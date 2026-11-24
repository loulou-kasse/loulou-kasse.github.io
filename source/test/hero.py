import asyncio, sys; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(500)
        res = []
        for lbl, expect in [('Расход', 'e-type=ausgabe'), ('Выручка', 'e-type=einnahme'), ('Счёт', 'iv-form'), ('Фото чека', 'e-type=ausgabe')]:
            box = await pg.locator('.hero .seg[aria-label="%s"] .arc' % lbl).bounding_box()
            await pg.mouse.click(box['x'] + box['width'] / 2, box['y'] + box['height'] / 2); await pg.wait_for_timeout(250)
            ok = (await pg.is_visible('#iv-form')) if expect == 'iv-form' else (await pg.input_value('#e-type')) == expect.split('=')[1]
            res.append((lbl, ok)); await pg.click('.sheet-x'); await pg.wait_for_timeout(100)
        # касание по логотипу в центре ничего не открывает
        await pg.mouse.click(206, 270 + 0); await pg.wait_for_timeout(200)
        res.append(('центр без действия', await pg.is_hidden('#sheet')))
        print(res, errs); await b.close()
asyncio.run(main())
