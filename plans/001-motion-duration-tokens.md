# 001 — Ввести токены длительности и починить easing на движущихся переходах

- **Status**: DONE
- **Commit**: baf3209
- **Severity**: MEDIUM
- **Category**: 2 (Easing & duration), 7 (Cohesion & tokens)
- **Estimated scope**: 1 файл (`app/globals.css`), ~20 точечных правок

## Problem

### Часть A — нет токенов длительности

В `app/globals.css` на `:root` объявлены только токены кривых (строки 20–24):

```css
/* app/globals.css:20-24 — текущее состояние */
  --anim-spring: cubic-bezier(0.22, 1, 0.36, 1);
  --anim-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
  --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
  --ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

Токенов длительности нет ни одного. В результате литералы `0.15s` / `0.18s` / `0.2s`
продублированы в 17 несвязанных селекторах слоя `shbz-*`. Полный список (номер строки → селектор):

| Строка | Селектор | Текущее объявление |
| --- | --- | --- |
| 1691 | `.shbz-input` | `transition: border-color 0.15s, box-shadow 0.15s;` |
| 1711 | `.shbz-btn-primary` | `transition: box-shadow 0.18s, transform 0.18s;` |
| 1862 | `.shbz-tab` | `transition: background 0.15s;` |
| 1896 | `.shbz-btn-outline` | `transition: border-color 0.15s;` |
| 2033 | `.shbz-switch-track` | `transition: background 0.2s, border-color 0.2s;` |
| 2046 | `.shbz-switch-knob` | `transition: left 0.2s;` |
| 2072 | `.shbz-checkbox` | `transition: background 0.15s, border-color 0.15s;` |
| 2091 | `.shbz-card-hover` | `transition: transform 0.18s, box-shadow 0.18s;` |
| 2117 | `.shbz-seg-btn` | `transition: background 0.15s, box-shadow 0.15s, color 0.15s;` |
| 2165 | `.shbz-btn-dark` | `transition: filter 0.15s;` |
| 2180 | `.shbz-btn-danger` | `transition: background 0.15s;` |
| 2203 | `.shbz-select` | `transition: border-color 0.15s, box-shadow 0.15s;` |
| 2235 | `.shbz-textarea` | `transition: border-color 0.15s, box-shadow 0.15s;` |
| 2266 | `.shbz-btn-danger-solid` | `transition: filter 0.15s;` |
| 2412 | `.ui-input`, `html[data-theme="dark"] .ui-input` | `transition: border-color 0.15s, box-shadow 0.15s;` |
| 2885 | `.shbz-note-field` | `transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;` |
| 2934 | `.shbz-btn-danger-icon` | `transition: opacity 0.15s, background 0.15s, border-color 0.15s;` |

### Часть B — три перехода двигают элемент без явной кривой

Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md), раздел 2) задаёт порядок выбора:
вход/выход → `ease-out`, движение по экрану → `ease-in-out`, смена цвета → `ease`.

Из 17 объявлений выше **14 анимируют только цвет** (`background`, `border-color`, `color`,
`filter`, `box-shadow`) — для них отсутствие функции даёт CSS-дефолт `ease`, и это ровно то,
что предписывает плейбук. **Их трогать не нужно.**

Ошибка только в трёх, где реально что-то движется:

```css
/* app/globals.css:1711 — .shbz-btn-primary, текущее */
  transition: box-shadow 0.18s, transform 0.18s;

/* app/globals.css:2091 — .shbz-card-hover, текущее */
.shbz-card-hover { transition: transform 0.18s, box-shadow 0.18s; }

/* app/globals.css:2046 — .shbz-switch-knob, текущее */
  transition: left 0.2s;
```

`transform` здесь — подъём элемента (feedback на наведение), то есть вход: нужен `--ease-out`.
`left` у переключателя — движение по экрану: нужен `--ease-in-out`.

Почему это важно: `.shbz-btn-primary` — основная кнопка продукта (26 использований),
её подъём на `translateY(-1px)` сейчас идёт по симметричной кривой `ease`, из-за чего
реакция на наведение начинается вяло вместо мгновенного отклика.

## Target

### Новые токены на `:root`

Добавить сразу после строки 24 (после `--ease-drawer`), сохранив стиль блока:

```css
/* target — app/globals.css, в блоке :root после --ease-drawer */
  --duration-fast: 150ms;
  --duration-base: 180ms;
  --duration-slow: 200ms;
```

Значения подобраны так, чтобы **точно совпасть с текущими**: `0.15s` → `--duration-fast`,
`0.18s` → `--duration-base`, `0.2s` → `--duration-slow`. Визуально после этого шага
не должно измениться ничего — это чистая замена литералов на токены.

### Итоговый вид трёх движущихся переходов

```css
/* target — app/globals.css:1711, .shbz-btn-primary */
  transition: box-shadow var(--duration-base) ease, transform var(--duration-base) var(--ease-out);

/* target — app/globals.css:2091 */
.shbz-card-hover { transition: transform var(--duration-base) var(--ease-out), box-shadow var(--duration-base) ease; }

/* target — app/globals.css:2046, .shbz-switch-knob */
  transition: left var(--duration-slow) var(--ease-in-out);
```

### Итоговый вид остальных 14

Только замена числа на токен, функция easing НЕ добавляется. Пример:

```css
/* target — app/globals.css:1691, .shbz-input */
  transition: border-color var(--duration-fast), box-shadow var(--duration-fast);
```

## Repo conventions to follow

- Токены живут в блоке `:root` в `app/globals.css`, строки 8–66. Именование — kebab-case
  с префиксом-категорией (`--radius-sm`, `--ease-out`, `--theme-bg`). Новые токены длительности
  следуют тому же образцу.
- Экземпляр для подражания — `app/globals.css:536-542` (`.ui-pressable`), где переход уже
  собран правильно: явная кривая на `transform`, голый `ease` на цветах:

  ```css
  transition:
    transform 140ms var(--ease-out),
    box-shadow 180ms var(--ease-out),
    border-color 140ms ease,
    background-color 140ms ease,
    color 140ms ease,
    opacity 180ms ease;
  ```
- Комментарии-разделители в файле оформлены как `/* ─────… */` с заголовком — новых
  разделителей не добавлять, токены идут внутрь существующего блока `:root`.

## Steps

1. `app/globals.css`: в блоке `:root` сразу после строки 24 (`--ease-drawer: …;`) добавить три
   строки токенов из раздела Target. Не трогать существующие токены кривых.
2. `app/globals.css:1711` (`.shbz-btn-primary`): заменить объявление на вариант из Target
   (`--duration-base`, `var(--ease-out)` на `transform`, `ease` на `box-shadow`).
3. `app/globals.css:2091` (`.shbz-card-hover`): заменить на вариант из Target.
4. `app/globals.css:2046` (`.shbz-switch-knob`): заменить на `left var(--duration-slow) var(--ease-in-out)`.
5. Для остальных 14 строк из таблицы Problem/Часть A заменить числовой литерал на токен
   по правилу `0.15s → var(--duration-fast)`, `0.18s → var(--duration-base)`,
   `0.2s → var(--duration-slow)`. Порядок свойств и всё остальное в объявлении сохранить
   без изменений. Функцию easing НЕ дописывать.
6. Проверить, что во всём файле после строки 1620 не осталось литералов `0.15s`, `0.18s`,
   `0.2s` внутри `transition:` — командой `grep -n "transition:.*0\.\(15\|18\|2\)s" app/globals.css`
   (ожидаемый вывод: пусто).

## Boundaries

- НЕ трогать слой `ui-*` (строки 407–1620), кроме одной строки 2412 (`.ui-input`), явно
  перечисленной в таблице.
- НЕ трогать анимации streak (строки ~1090–1235 и ~2799–2855) — они намеренно игровые.
- НЕ менять длительности по величине. Все три токена численно равны тому, что стоит сейчас.
  Задача этого плана — токенизация и три кривые, а не перетаймливание.
- НЕ добавлять easing к переходам, которые меняют только цвет: по плейбуку это верно как есть.
- НЕ трогать разметку и `.tsx`-файлы. Только `app/globals.css`.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно коммита `baf3209`) —
  ОСТАНОВИТЬСЯ и сообщить, не импровизировать.

## Verification

- **Механически**:
  - `npm run lint` — должен пройти без предупреждений (конфиг падает на любом warning).
  - `npm run build` — должен собраться.
  - `grep -c "var(--duration-" app/globals.css` — ожидается не менее 17.
- **Feel check**: поднять `npm run dev`, открыть любую страницу с основной кнопкой
  (например `/login` или карточку темы у преподавателя):
  - Навести курсор на `.shbz-btn-primary`: подъём должен ощущаться как мгновенный старт
    с мягким торможением, а не как плавный разгон.
  - Сравнить с веткой `main` (`git checkout main`, затем обратно) — разница тонкая,
    смотреть именно на первые ~50 мс движения.
  - В DevTools → Animations выставить скорость 10% и убедиться, что `transform` кнопки
    стартует быстро и замедляется к концу.
  - Переключатель в `/developer/panel` (`.shbz-switch`): ползунок должен идти плавно
    с ускорением и торможением, без рывка на старте.
- **Done when**: все 17 объявлений используют токены; три движущихся перехода имеют явные
  кривые; `npm run lint` и `npm run build` проходят; визуально ничего, кроме трёх кривых,
  не изменилось.
