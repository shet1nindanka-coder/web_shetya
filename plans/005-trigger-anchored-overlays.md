# 005 — Дать появление четырём оверлеям, привязанным к триггеру

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: MEDIUM
- **Category**: 3 (Physicality & origin), 4 (Interruptibility)
- **Estimated scope**: 5 файлов (4 компонента + `app/globals.css`), ~25 строк

## Problem

План 004 уже дал появление основному селекту. Ещё четыре панели, привязанные к своему
триггеру, по-прежнему возникают жёсткой склейкой — проверено, в них нет ни `animation`,
ни `transition`, ни `transform-origin`:

```tsx
/* components/student-notifications-bell.tsx:213-219 — текущее */
            <div
              ref={panelRef}
              data-shbz-portal=""
              className="fixed overflow-hidden rounded-[16px] border"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
```

```tsx
/* components/shbz-datetime-picker.tsx:247-253 — текущее */
        <div
          ref={popoverRef}
          data-shbz-portal=""
          className="fixed w-[308px] max-w-[92vw] overflow-y-auto rounded-[16px] border p-4"
          style={{
            top: popoverPosition.top,
            bottom: popoverPosition.bottom,
```

```tsx
/* components/password-suggest-menu.tsx:97-105 — текущее */
    <div
      ref={menuRef}
      data-shbz-portal=""
      role="dialog"
      aria-label="Предложенный пароль"
      // preventDefault: клик по меню не должен уводить фокус из поля пароля.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed rounded-[12px] border p-1.5"
```

```tsx
/* components/deadlines-calendar.tsx:187-195 — текущее */
              {isPreviewOpen ? (
                <div
                  className="absolute left-1/2 top-[calc(100%+10px)] z-30 w-[300px] max-w-[86vw] -translate-x-1/2 rounded-[16px] border p-3.5"
                  style={{
                    background: "var(--shbz-card-bg)",
```

Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) раздел 3: панель, привязанная
к триггеру, должна вырастать из него, объясняя пространственную связь. Раздел 2, таблица
длительностей: дропдауны 150–250 мс, небольшие поповеры 125–200 мс. Сейчас у всех четырёх — 0 мс.

### ВАЖНАЯ ЛОВУШКА в `deadlines-calendar.tsx`

Превью дня центрируется классом Tailwind `-translate-x-1/2`. Анимация, которая пишет
`transform`, ЗАТРЁТ это центрирование, и панель прыгнет вправо на половину своей ширины.
Поэтому ей нужен отдельный keyframe, где `translateX(-50%)` присутствует в обоих кадрах.
Не подключайте к ней базовый класс — только модификатор из раздела Target.

### Направления открытия

- `student-notifications-bell.tsx` — задаёт только `top`, всегда открывается вниз.
- `shbz-datetime-picker.tsx` и `password-suggest-menu.tsx` — задают либо `top`, либо `bottom`,
  как `shbz-select`. Признак «вверх» — `top === undefined`.
- `deadlines-calendar.tsx` — всегда под днём (`top-[calc(100%+10px)]`), только вниз.

## Target

### CSS — расширить существующий блок

В `app/globals.css` уже есть блок `ШБЗ: выпадающие панели` (создан планом 004, около строки
2260). Добавить в него **после** правила `.shbz-dropdown-panel[data-open-up="true"]`:

```css
/* target — app/globals.css, в блок «ШБЗ: выпадающие панели» */
@keyframes shbz-dropdown-in-centered {
  from { opacity: 0; transform: translateX(-50%) scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: translateX(-50%) scale(1) translateY(0); }
}
.shbz-dropdown-panel--centered {
  transform-origin: top center;
  animation: shbz-dropdown-in-centered var(--duration-slow) var(--ease-out) both;
}
@media (prefers-reduced-motion: reduce) {
  .shbz-dropdown-panel--centered {
    animation: shbz-dropdown-fade var(--duration-fast) ease both;
  }
}
```

`@keyframes shbz-dropdown-fade` уже существует в этом блоке — повторно объявлять НЕ нужно.

Внимание: у `.shbz-dropdown-panel--centered` в reduced-motion остаётся только прозрачность,
но `translateX(-50%)` при этом теряется, потому что `shbz-dropdown-fade` не пишет `transform`.
Это правильно: без анимации transform остаётся тот, что задал Tailwind `-translate-x-1/2`.

### TSX — четыре точечные правки

```tsx
/* target — components/student-notifications-bell.tsx:216 */
              className="shbz-dropdown-panel fixed overflow-hidden rounded-[16px] border"
```
Атрибут `data-open-up` не нужен: панель всегда открывается вниз, базовый
`transform-origin: top center` уже верен.

```tsx
/* target — components/shbz-datetime-picker.tsx, элемент поповера */
          data-shbz-portal=""
          data-open-up={popoverPosition.top === undefined ? "true" : "false"}
          className="shbz-dropdown-panel fixed w-[308px] max-w-[92vw] overflow-y-auto rounded-[16px] border p-4"
```

```tsx
/* target — components/password-suggest-menu.tsx, элемент меню */
      data-shbz-portal=""
      data-open-up={position.top === undefined ? "true" : "false"}
      role="dialog"
      aria-label="Предложенный пароль"
      // preventDefault: клик по меню не должен уводить фокус из поля пароля.
      onMouseDown={(event) => event.preventDefault()}
      className="shbz-dropdown-panel fixed rounded-[12px] border p-1.5"
```

```tsx
/* target — components/deadlines-calendar.tsx, превью дня — ТОЛЬКО модификатор */
                  className="shbz-dropdown-panel--centered absolute left-1/2 top-[calc(100%+10px)] z-30 w-[300px] max-w-[86vw] -translate-x-1/2 rounded-[16px] border p-3.5"
```

## Repo conventions to follow

- Образец — то, что план 004 уже сделал в `components/shbz-select.tsx:166-170`:

  ```tsx
              data-shbz-portal=""
              data-open-up={menuPosition.top === undefined ? "true" : "false"}
              className="shbz-dropdown-panel fixed overflow-y-auto rounded-[12px] border p-1.5"
  ```

  Новый класс идёт в `className` первым, `data-open-up` — сразу после `data-shbz-portal`.
- Состояния передаются `data-*`-атрибутами, не классами-модификаторами (кроме `--centered`,
  который меняет саму анимацию, а не состояние).
- Комментарий про `preventDefault` в `password-suggest-menu.tsx` сохранить дословно.

## Steps

1. `app/globals.css`: найти блок с разделителем `ШБЗ: выпадающие панели`. Добавить в него
   keyframe `shbz-dropdown-in-centered`, класс `.shbz-dropdown-panel--centered` и его
   блок reduced-motion — в точности как в разделе Target. Существующие правила блока не трогать.
2. `components/student-notifications-bell.tsx`: добавить `shbz-dropdown-panel` первым классом
   в `className` панели. `data-open-up` НЕ добавлять.
3. `components/shbz-datetime-picker.tsx`: добавить `data-open-up` после `data-shbz-portal=""`
   и `shbz-dropdown-panel` первым классом.
4. `components/password-suggest-menu.tsx`: то же самое.
5. `components/deadlines-calendar.tsx`: добавить **`shbz-dropdown-panel--centered`** (модификатор,
   БЕЗ базового класса) первым классом. Класс `-translate-x-1/2` оставить на месте — он нужен
   для reduced-motion, где анимация не пишет transform.

## Boundaries

- НЕ трогать `components/confirm-dialog.tsx` и `components/account-credentials-dialog.tsx` —
  это модальные окна, у них своя анимация в плане 006.
- НЕ реализовывать анимацию закрытия и НЕ менять логику монтирования (`isOpen`, порталы,
  `updatePosition`, обработчики кликов вне панели).
- НЕ подключать базовый `.shbz-dropdown-panel` к превью календаря — сломает центрирование.
- НЕ удалять `-translate-x-1/2` из календаря.
- НЕ менять `style`, геометрию, `zIndex`, `ref` и порядок остальных атрибутов.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npx tsc --noEmit -p tsconfig.json` — чисто.
  - `grep -c "shbz-dropdown-panel" app/globals.css` — не менее 5.
- **Feel check**: `npm run dev`, затем по одному:
  - **Колокольчик** (шапка кабинета ученика): открыть — панель растёт из иконки вниз.
  - **Выбор даты** (`shbz-datetime-picker`, например срок ДЗ у преподавателя): открыть в
    верхней части экрана — растёт вниз; прокрутить так, чтобы поле было внизу, открыть снова —
    растёт вверх. При ошибке в `data-open-up` схлопнется не в ту сторону.
  - **Календарь дедлайнов** (`/student/deadlines`): кликнуть день с дедлайном. **Главная
    проверка этого плана:** превью должно появиться строго по центру под днём и никуда не
    прыгнуть по горизонтали. Любой сдвиг вбок — значит, подключён не тот класс.
  - **Подсказка пароля** (создание ученика у преподавателя): панель появляется мягко,
    фокус из поля пароля не уходит.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: все четыре просто проявляются,
    без масштаба и сдвига. Превью календаря при этом обязано остаться отцентрованным.
- **Done when**: четыре панели появляются анимированно; превью календаря не смещается по
  горизонтали ни при обычном режиме, ни при reduced-motion; lint и tsc чисты.
