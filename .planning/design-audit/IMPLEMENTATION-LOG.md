# Манифест внесённых правок дизайн-аудита

Ветка: `design/impeccable-2026-08` · база: `main@9e5e440` · дата: 2026-08-20
Все 17 шагов раздела 6 `0-summary.md` выполнены. Каждый шаг — один коммит
(у D04 — два: основной и однострочный до-коммит импорта, откатывать вместе).
`Depends-on` — какие правки надо откатить вместе с этой (или раньше неё),
потому что их диффы пересекаются в одних файлах/строках.

| Fix-ID | Commit | Шаг | Что сделано | Файлы | Depends-on | Откат |
|---|---|---|---|---|---|---|
| D01 | `6b56204` | 1 | Контраст светлой темы (кнопка, светофор, кикер, плейсхолдер, danger — все ≥4.5:1, пересчитано) + глобальное `:focus-visible`, снят `outline:none` | app/globals.css | — | `git revert --no-edit 6b56204` |
| D02 | `24a542b` | 2 | Глифы ✓/↻/! (словарь `homeworkStatusGlyph` + тест), aria-label вместо title, форма для «сегодня»/активного дня, нейтральные чипы причин GAP/NEW | lib/utils.ts, tests/utils.test.ts, 5 компонентов | — | `git revert --no-edit 24a542b` |
| D03 | `ea7f896` | 3 | Человеческие тексты ошибок: логин без DATABASE_URL, `lib/solution-check-error-text.ts` (словарь классов отказа + тест), «очередь сброшена рестартом» → понятный текст | login-form, student-homework-check, 2 доски, новый lib+тест | — | `git revert --no-edit ea7f896` |
| D04 | `ca53d79` + `d374d3f` | 4 | useFormStatus на входе, role=status, терминальный поллинг с бэкоффом, тикающая stale-детекция (доска + вкладка «Занятия»), checkedAt ученику, aria-current | login-form, student-homework-check, 2 lesson-компонента, nav, 2 tabs, statistics | D03 (общие строки импортов в login-form и student-homework-check) | `git revert --no-edit d374d3f ca53d79` |
| D05 | `548a871` | 5 | `lib/homework-attention.ts` — сортировка по вниманию (+тест), подключена в `getTeacherStudentHomeworks`; выполненные схлопнуты у ученика и учителя | lib/platform-data.ts, новый lib+тест, student-homework-submissions, teacher-homework-review-list | D02 указан в коммите с запасом: диффы фактически не пересекаются, откат D02 отдельно безопасен | `git revert --no-edit 548a871` |
| D06 | `b1cc1b3` | 6 | `stats` → `PageHeader.metrics`, счётчик «Проверка ДЗ · N», геройская строка «Что дальше» на /student; ноль новых запросов | teacher/students/[id]/layout, teacher-student-tabs, upcoming-deadlines-card | D04 (aria-current в teacher-student-tabs рядом) | `git revert --no-edit b1cc1b3` |
| D07 | `33a503f` | 7 | file-input дропзоны: hidden → sr-only (в таб-порядке), `:focus-within`-кольцо на `.shbz-dropzone` | globals.css, student-homework-photos | — | `git revert --no-edit 33a503f` |
| D08 | `9c0791c` | 8 | «Перерешать №N» под строкой INCORRECT: скролл+фокус на карточке номера + подсказка. Пофоточная перепроверка одного номера не делалась — API проверяет всё задание целиком (изменение API вне границ задачи) | student-homework-check | D03, D04 (тот же файл, соседние блоки) | `git revert --no-edit 9c0791c` |
| D09 | `c3ed85c` | 9 | Инъекция — полноширинная полоса (иконка, моно-цитата, «вердикты могут быть недостоверны», без цвета INCORRECT); диагностика — свёрнутый блок + «скрыть на время урока»; убраны `--shbz-cal-ok-bg`/`--shbz-streak-text` | teacher-homework-review-list | D05 (файл перестроен в D05: renderAssignmentCard) | `git revert --no-edit c3ed85c` |
| D10 | `0c417ce` | 10 | Пункт «занятия» в навигации (планнер-пути больше не красят «ученики»/«группы»), «Занятия группы · N» на странице группы (`groupId` в getTeacherLessons), секции Сегодня/Ближайшие/Прошедшие | dashboard-nav, lib/platform-data.ts, group page, lessons page | D04 (соседние строки dashboard-nav), D05 (lib/platform-data) | `git revert --no-edit 0c417ce` |
| D11 | `a10e528` | 11 | `lessonResultMeta` («решил/с ошибками/не решил»), светофоры ≥44px, клавиши 1/2/3 и ↑/↓, «отмечено X из Y» в липкой шапке, ошибка в строке, удаление 32×32 + 5-с отмена, меню «До и после урока» | lesson-result-toggle, teacher-lesson-board | D02, D04 (те же файлы/строки) | `git revert --no-edit a10e528` |
| D12 | `e79a885` | 12 | «Принять вердикты ИИ» (CORRECT→GREEN, INCORRECT→RED, UNCERTAIN нет) с 10-с отменой; roving tabindex тройки статусов; оптимистичные статусы без refresh на клик | teacher-homework-review-list | D05, D09 (тот же файл) | `git revert --no-edit e79a885` |
| D13 | `0cb880b` | 13 | `loginHelpContact` в SiteSetting (+поле дев-панели, +тест) и строка помощи на /login; `?min=N` с точными минутами блокировки (`getRetryAfterSeconds` подключён); `inputMode="email"`; `.shbz-input` 15→16px | site-settings, developer-panel, actions/auth, login page/form, globals.css, тест | D03, D04 (login-form) | `git revert --no-edit 0cb880b` |
| D14 | `35fa2a3` | 14 | Форма создания занятия: всё в свёрнутый блок «Параметры подбора» с бейджем «изменено: N», одно видимое действие; дубль подсказки убран | teacher-lesson-create-form | — | `git revert --no-edit 35fa2a3` |
| D15 | `55b1e71` | 15 | `tier` подключён к палитре героя стрика (data-streak-tier, 10 тиров), «Ещё N дней» вместо статичного порога, блок поднят выше сгиба (hero/list-варианты карточки дедлайнов). Тиры действуют и в тёмной теме — это механика, дефолт (starter) в обеих темах не тронут | globals.css, student-weekly-activity, upcoming-deadlines-card, student page | D06 (upcoming-deadlines-card перестроен в D06) | `git revert --no-edit 55b1e71` |
| D16 | `ca27fb8` | 16 | Compact-правила для shbz-компонентов; `ui-hint` на объясняющих текстах входа/ученика/занятий (настройка «подсказки» работает); compose-доска переведена с `--theme-*` на shbz | globals.css + 9 компонентов | D08, D11, D12, D14, D15 (ui-hint лёг на строки, добавленные этими правками) | `git revert --no-edit ca27fb8` |
| D17 | `1c8c0b4` | 17 | Кегли по рампе (11→12, 22→23, 19→17, 30→clamp) на аудированных поверхностях; радиус инпутов в compact 8→12; H1→H2 на доске; `contain-intrinsic-size` 700→1600; дубль `formatDateTime` → обёртка над lib/utils | globals.css + 7 файлов | D02, D05, D11, D13, D16 (те же строки) | `git revert --no-edit 1c8c0b4` |

## Отклонения от спецификации

- **D08**: «пофоточная перезагрузка с перепроверкой» одного номера невозможна без
  изменения API (`POST /api/student/homework-checks` проверяет всё задание);
  сделано: скролл+фокус к карточке номера + подсказка про замену фото и общий
  повторный запуск. Изменение контракта проверки — вне границ задачи.
- **D04**: stale-детекция во вкладке «Занятия» работает от клиентского наблюдения
  (сервер не отдаёт туда время постановки в очередь) — зависший план становится
  stale через 15 минут наблюдения, а не от исходного момента.
- **D10**: секции «Сегодня/Ближайшие/Прошедшие» построены от `createdAt` и
  `status` — у урока нет планируемой даты в модели данных.
- **D17**: из 24 advisory-находок кеглей исправлены находки на пяти аудированных
  поверхностях; кегли на прочих поверхностях (дев-панель, настройки аккаунта,
  статистика) не тронуты, чтобы не раздувать дифф полировочного коммита.
- **D04**: состоит из двух коммитов (`ca53d79` — правка, `d374d3f` — пропущенная
  строка импорта). Откатывать оба, сначала `d374d3f`.

## Проверки

Перед каждым коммитом: `npm run lint` (0 варнингов) и `npm run test` — зелёные.
Дополнительно с D05 и далее: `npx tsc -p tsconfig.check.json --noEmit`.
`npm run build` не запускался (локальный дрейф схемы `Topic.answersFileId`, вне задачи).
