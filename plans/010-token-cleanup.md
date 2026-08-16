# 010 — Убрать вбитые вручную кривые и постоянный `will-change`

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: LOW
- **Category**: 7 (Cohesion & tokens), 5 (Performance)
- **Estimated scope**: 1 файл (`app/globals.css`), 10 строк

## Problem

### Часть A — девять кривых продублированы литералами

На `:root` объявлены токены (`app/globals.css:20-24`):

```css
  --anim-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
```

Несмотря на это, те же значения вбиты руками ещё в девяти местах:

```css
/* app/globals.css:1040-1043 — .app-streak-pill, текущее */
    transform 180ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 220ms cubic-bezier(0.23, 1, 0.32, 1),

/* app/globals.css:1078-1081 — .student-streak-hero, текущее */
    transform 220ms cubic-bezier(0.23, 1, 0.32, 1),
    box-shadow 260ms cubic-bezier(0.23, 1, 0.32, 1),

/* app/globals.css:1105 — текущее */
  animation: streak-pill-drop 520ms cubic-bezier(0.23, 1, 0.32, 1);

/* app/globals.css:1113 — текущее */
  animation: streak-flame-flicker 900ms cubic-bezier(0.23, 1, 0.32, 1);

/* app/globals.css:1116 — текущее */
  animation: streak-hero-ignite 900ms cubic-bezier(0.23, 1, 0.32, 1);

/* app/globals.css:1119 — текущее */
  animation: streak-hero-grow 760ms cubic-bezier(0.23, 1, 0.32, 1);

/* app/globals.css:2911 — текущее */
  animation: shbz-hero-bump 900ms cubic-bezier(0.22, 1, 0.36, 1);
```

Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) раздел 7: кривые и
длительности должны жить как общие токены; повторённые вручную значения — находка на
консолидацию. Здесь они даже не «почти совпадают», а побайтово равны существующим токенам.

### Часть B — `will-change` висит постоянно

```css
/* app/globals.css:1363-1365 — текущее */
.ui-progress-fill {
  transition: transform 280ms var(--ease-out), filter 220ms ease, opacity 220ms ease;
  will-change: transform;
```

`will-change` заставляет браузер держать отдельный слой композитора всё время, а не только
на время перехода. Полоса прогресса рисуется на каждую строку темы и каждое задание, поэтому
на списковых страницах таких постоянных слоёв набирается много. Плейбук раздел 5 перечисляет
`will-change`, оставленный навсегда, среди того, что нужно искать.

Само использование `transform: scaleX(...)` в `components/progress-bar.tsx:29` сделано
правильно — эта половина правила в порядке, трогать её не нужно.

## Target

### Часть A — девять замен

| Строка | Было | Стало |
| --- | --- | --- |
| 1041 | `transform 180ms cubic-bezier(0.23, 1, 0.32, 1),` | `transform 180ms var(--ease-out),` |
| 1042 | `box-shadow 220ms cubic-bezier(0.23, 1, 0.32, 1),` | `box-shadow 220ms var(--ease-out),` |
| 1079 | `transform 220ms cubic-bezier(0.23, 1, 0.32, 1),` | `transform 220ms var(--ease-out),` |
| 1080 | `box-shadow 260ms cubic-bezier(0.23, 1, 0.32, 1),` | `box-shadow 260ms var(--ease-out),` |
| 1105 | `animation: streak-pill-drop 520ms cubic-bezier(0.23, 1, 0.32, 1);` | `animation: streak-pill-drop 520ms var(--ease-out);` |
| 1113 | `animation: streak-flame-flicker 900ms cubic-bezier(0.23, 1, 0.32, 1);` | `animation: streak-flame-flicker 900ms var(--ease-out);` |
| 1116 | `animation: streak-hero-ignite 900ms cubic-bezier(0.23, 1, 0.32, 1);` | `animation: streak-hero-ignite 900ms var(--ease-out);` |
| 1119 | `animation: streak-hero-grow 760ms cubic-bezier(0.23, 1, 0.32, 1);` | `animation: streak-hero-grow 760ms var(--ease-out);` |
| 2911 | `animation: shbz-hero-bump 900ms cubic-bezier(0.22, 1, 0.36, 1);` | `animation: shbz-hero-bump 900ms var(--anim-spring);` |

Замена чисто механическая: значения токенов равны заменяемым литералам, поэтому
визуально не должно измениться ничего.

### Часть B — убрать одну строку

```css
/* target — app/globals.css, .ui-progress-fill */
.ui-progress-fill {
  transition: transform 280ms var(--ease-out), filter 220ms ease, opacity 220ms ease;
  box-shadow:
```

Строка `will-change: transform;` удаляется целиком. Ничего вместо неё не добавляется:
браузер и без подсказки поднимает элемент в слой на время перехода `transform`.

## Repo conventions to follow

- Токены подставляются как `var(--ease-out)` — так уже сделано в десятках мест файла,
  например `.ui-fade-slide { animation: ui-fade-slide 0.25s var(--ease-out) both; }`
  (`app/globals.css:428`).
- Многострочные `transition` с отступом в четыре пробела сохраняют своё форматирование —
  меняется только хвост каждой строки.

## Boundaries

- **НЕ трогать `cubic-bezier(0.22, 1.4, 0.36, 1)`** на строках 1099 и 1102
  (`streak-pill-ignite`, `streak-pill-grow`) и `cubic-bezier(0.16, 1, 0.3, 1)` на строке 1109
  (`streak-pill-burst`). Это самостоятельные кривые с перелётом, они НЕ равны ни одному
  токену, и заменять их — значит менять ощущение анимации. Подменять их токенами запрещено.
- НЕ заводить новые токены под эти кривые: они используются по одному разу, токен не нужен.
- НЕ трогать `components/telegram-spoiler.tsx`, где тоже вбита кривая руками: компонент
  нигде не импортируется (проверено), это мёртвый код, и правка добавит риск без пользы.
- НЕ менять длительности (180ms, 220ms, 520ms, 900ms, 760ms) — меняются только кривые.
- НЕ трогать `transform: scaleX(...)` в `components/progress-bar.tsx` — там всё верно.
- НЕ добавлять `will-change` куда-либо ещё.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `grep -c "cubic-bezier(0.23, 1, 0.32, 1)" app/globals.css` → **1** (остаётся только
    объявление токена `--ease-out` на строке 22).
  - `grep -c "cubic-bezier(0.22, 1, 0.36, 1)" app/globals.css` → **1** (только объявление
    `--anim-spring` на строке 20).
  - `grep -c "cubic-bezier(0.22, 1.4, 0.36, 1)" app/globals.css` → **2** (эти НЕ трогаем).
  - `grep -c "will-change" app/globals.css` → **0**.
- **Feel check**: `npm run dev`:
  - Открыть страницу со списком тем у ученика: полосы прогресса должны заполняться так же
    плавно, как раньше. Исчезновение `will-change` не должно быть заметно.
  - DevTools → Layers на странице со множеством полос: количество слоёв композитора должно
    уменьшиться по сравнению с веткой до правки.
  - Streak-плашка: подставить в инспекторе `data-animate="ignite"` и `data-animate="drop"`.
    Обе анимации обязаны выглядеть в точности как прежде — это проверка того, что кривые
    с перелётом остались нетронутыми. Если «ignite» потеряла отскок, значит по ошибке
    заменена кривая `0.22, 1.4, 0.36, 1`.
- **Done when**: счётчики grep сходятся с ожидаемыми; streak-анимации визуально не
  изменились; lint чист.
