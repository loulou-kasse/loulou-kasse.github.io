# LOU LOU Kasse

Учёт для LOU LOU Floristry & Decor (Violeta Larina, Kleinunternehmerin § 19 UStG): счета клиентам, журнал доходов и расходов (EÜR), чеки в Google Drive, сверка с выпиской Sparkasse.

- Сайт: корень репозитория (`index.html`, `sw.js`, `vendor/`, `icons/`).
- Исходники: `source/` — собираются командой `python3 source/build.py`.
- Данные хранятся в Firebase Firestore; доступ — только по входу Google для разрешённых адресов (правила базы в консоли Firebase, не в этом репозитории).
