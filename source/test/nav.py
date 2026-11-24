import asyncio, sys; sys.path.insert(0, 'test'); from harness import *
async def main():
    srv = serve()
    async with async_playwright() as p:
        b, pg, errs, drive = await page(p)
        await pg.goto(URL); await pg.wait_for_timeout(300); await pg.click('[data-act=login]'); await pg.wait_for_timeout(600)
        st = lambda: pg.evaluate("[location.hash, history.length, history.state && JSON.stringify(history.state), !document.getElementById('sheet').hidden, document.documentElement.className]")
        ok = True
        def chk(name, got, exp):
            nonlocal ok; good = got[0] == exp[0] and got[3] == exp[1]; ok = ok and good; print('OK ' if good else 'FAIL', name, got)
        chk('старт', await st(), ['#home', False])
        for t in ['#journal', '#invoices', '#more', '#journal']:
            await pg.click('nav.tabs a[href="%s"]' % t); await pg.wait_for_timeout(150)
        chk('4 раздела подряд', await st(), ['#journal', False])
        await pg.click('[data-act=j-new] >> nth=0'); await pg.wait_for_timeout(200)
        chk('окно открыто', await st(), ['#journal', True])
        await pg.go_back(); await pg.wait_for_timeout(250)
        chk('назад: окно закрылось, раздел тот же', await st(), ['#journal', False])
        await pg.go_back(); await pg.wait_for_timeout(250)
        chk('назад: главная', await st(), ['#home', False])
        # окно закрыто крестиком — потом «назад» не должен «съедать» лишний шаг
        await pg.click('nav.tabs a[href="#journal"]'); await pg.wait_for_timeout(150)
        await pg.click('[data-act=j-new] >> nth=0'); await pg.wait_for_timeout(250)
        chk('окно', await st(), ['#journal', True])
        await pg.click('[data-act=sheet-close]'); await pg.wait_for_timeout(250)
        chk('крестик', await st(), ['#journal', False])
        await pg.go_back(); await pg.wait_for_timeout(250)
        chk('назад после крестика: главная', await st(), ['#home', False])
        # быстрый переход из окна в другой раздел
        await pg.click('.qb >> nth=1'); await pg.wait_for_timeout(250)
        await pg.click('nav.tabs a[href="#more"]', force=True) if False else None
        await pg.evaluate("goView && 0") if False else None
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
        chk('Esc', await st(), ['#home', False])
        await pg.click('nav.tabs a[href="#more"]'); await pg.wait_for_timeout(150)
        await pg.click('a.choice[href="#guide"]') if await pg.locator('a.choice[href="#guide"]').count() else None
        await pg.wait_for_timeout(150); s = await st(); print('   справочник из «Ещё»:', s)
        await pg.go_back(); await pg.wait_for_timeout(250)
        chk('назад из справочника: главная', await st(), ['#home', False])
        # перезагрузка на разделе: назад ведёт на главную
        await pg.goto(URL + '#journal'); await pg.reload(); await pg.wait_for_timeout(600)
        await pg.go_back(); await pg.wait_for_timeout(250)
        chk('после перезагрузки на журнале назад: главная', await st(), ['#home', False])
        print('ИТОГ', 'OK' if ok else 'FAIL', errs); await b.close()
asyncio.run(main())
