# 004 — Дать выпадающему списку появление от триггера

- **Status**: DONE
- **Commit**: baf3209
- **Severity**: HIGH
- **Category**: 3 (Physicality & origin), 4 (Interruptibility)
- **Estimated scope**: 2 файла (`components/shbz-select.tsx`, `app/globals.css`), ~20 строк

## Problem

`components/shbz-select.tsx` — основной селект приложения (выбор темы, ученика, группы,
статуса и т.д.). Меню открывается и закрывается **жёсткой склейкой, без какой-либо анимации**:

```tsx
/* components/shbz-select.tsx:163-181 — текущее */
      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-shbz-portal=""
              className="fixed overflow-y-auto rounded-[12px] border p-1.5"
              style={{
                top: menuPosition.top,
                bottom: menuPosition.bottom,
                left: menuPosition.left,
                width: menuPosition.width,
                maxHeight: menuPosition.maxHeight,
                zIndex: 1000,
                background: "var(--shbz-card-bg)",
                borderColor: "var(--shbz-card-border)",
                boxShadow: "0 4px 10px rgba(10,10,10,0.06), 0 20px 48px rgba(10,10,10,0.18)"
              }}
            >
```

Ни `transition`, ни `animation`, ни `transform-origin` — меню телепортируется.

Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) требует по этому поводу двух вещей:
- раздел 2, таблица длительностей: «Dropdowns, selects → 150–250ms». Сейчас 0 мс;
- раздел 3: «Popovers/dropdowns/tooltips scale from their trigger, not center» — меню должно
  вырастать из кнопки, которая его открыла, объясняя пространственную связь. Также действует
  запрет «Never `scale(0)`»: стартовать надо с `scale(0.96)`, а не с нуля.

Компонент уже знает, в какую сторону открывается меню — `updatePosition` (строки 51–76)
считает `openUp` и выставляет либо `top` (меню растёт вниз), либо `bottom` (растёт вверх):

```tsx
/* components/shbz-select.tsx:69-70 — текущее */
      top: openUp ? undefined : rect.bottom + 6,
      bottom: openUp ? viewportHeight - rect.top + 6 : undefined,
```

Этого достаточно, чтобы поставить правильный `transform-origin` без новых вычислений.

## Target

### CSS — новый класс в `app/globals.css`

Добавить в конец слоя shbz, рядом с прочими правилами `.shbz-*`:

```css
/* target — app/globals.css */
@keyframes shbz-dropdown-in {
  from { opacity: 0; transform: scale(0.96) translateY(-4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.shbz-dropdown-panel {
  transform-origin: top center;
  animation: shbz-dropdown-in var(--duration-slow) var(--ease-out) both;
}
.shbz-dropdown-panel[data-open-up="true"] {
  transform-origin: bottom center;
}
@media (prefers-reduced-motion: reduce) {
  .shbz-dropdown-panel {
    animation: shbz-dropdown-fade var(--duration-fast) ease both;
  }
}
@keyframes shbz-dropdown-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

`--duration-slow` равен 200 мс — попадает в предписанный диапазон 150–250 мс.
`translateY(-4px)` даёт лёгкое ощущение «выехало из кнопки»; при открытии вверх
`transform-origin: bottom center` разворачивает рост в обратную сторону, а сдвиг
в 4 пикселя настолько мал, что переворачивать его не требуется.

При `prefers-reduced-motion` остаётся только проявление прозрачности — движение убрано,
но появление по-прежнему заметно (плейбук, раздел 6: «меньше и мягче, а не ноль»).

### TSX — подключить класс и признак направления

```tsx
/* target — components/shbz-select.tsx, элемент меню */
            <div
              ref={menuRef}
              role="listbox"
              data-shbz-portal=""
              data-open-up={menuPosition.top === undefined ? "true" : "false"}
              className="shbz-dropdown-panel fixed overflow-y-auto rounded-[12px] border p-1.5"
              style={{
```

`menuPosition.top === undefined` означает, что `updatePosition` выбрал ветку `openUp` —
это и есть признак роста вверх. Остальные атрибуты и весь `style` остаются без изменений.

### Что этот план сознательно НЕ делает

Закрытие остаётся мгновенным. Анимация выхода потребовала бы держать элемент
смонтированным после `setIsOpen(false)` и вести отдельное состояние — это изменение
логики компонента, а не его движения, и выходит за рамки плана. Мгновенное закрытие
при анимированном открытии — приемлемая асимметрия: пользователь уже принял решение,
и система должна убраться с дороги немедленно.

## Repo conventions to follow

- Ключевые кадры в `app/globals.css` объявляются рядом с использующим их классом, имя —
  kebab-case с префиксом слоя. Образец — `app/globals.css:1582-1596`:

  ```css
  @keyframes mobile-panel-in {
    from { opacity: 0; transform: translateY(-8px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .mobile-panel {
    animation: mobile-panel-in 250ms var(--ease-out) both;
  }
  ```

  Новый код повторяет эту форму, но с токенами длительности вместо литерала.
- Состояния в разметке передаются `data-*`-атрибутами, а не классами-модификаторами.
  Образец — `data-active="true"` у `.shbz-tab` (`app/globals.css:1866`) и
  `data-animate` у streak-элементов.
- В `shbz-select.tsx` классы Tailwind перечисляются в `className`, а вычисляемая геометрия —
  в `style`. Новый класс идёт в `className` первым.

## Steps

1. **Предусловие**: план `001-motion-duration-tokens.md` выполнен — используются токены
   `--duration-slow` и `--duration-fast`. Если их нет в блоке `:root` — ОСТАНОВИТЬСЯ и сообщить.
2. `app/globals.css`: добавить блок из раздела Target (два `@keyframes`, класс
   `.shbz-dropdown-panel`, вариант `[data-open-up="true"]` и блок reduced-motion).
   Разместить после правил `.shbz-select` / `.shbz-select--sm` (около строки 2220),
   предварив разделителем в стиле файла:

   ```css
   /* ───────────────────────────────────────────────
      ШБЗ: выпадающие панели
      ─────────────────────────────────────────────── */
   ```
3. `components/shbz-select.tsx:167`: добавить в `className` меню класс `shbz-dropdown-panel`
   первым — итог: `className="shbz-dropdown-panel fixed overflow-y-auto rounded-[12px] border p-1.5"`.
4. `components/shbz-select.tsx`: в том же элементе добавить атрибут
   `data-open-up={menuPosition.top === undefined ? "true" : "false"}` сразу после
   `data-shbz-portal=""`.
5. Ничего больше в компоненте не менять: ни `updatePosition`, ни обработчики, ни `style`.

## Boundaries

- НЕ трогать остальные оверлеи (`components/student-notifications-bell.tsx`,
  `components/confirm-dialog.tsx`, `components/shbz-datetime-picker.tsx`,
  `components/password-suggest-menu.tsx`, `components/deadlines-calendar.tsx`) — это
  отдельная находка и отдельный план. Здесь только `shbz-select.tsx`.
- НЕ реализовывать анимацию закрытия и НЕ менять состояние `isOpen` / логику монтирования.
- НЕ менять `updatePosition` и вычисление геометрии.
- НЕ использовать `scale(0)` или значение меньше `0.95` — прямой запрет плейбука.
- НЕ добавлять зависимости и НЕ вводить библиотеку анимаций.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `baf3209`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npm run build` — собирается.
  - `npx tsc --noEmit -p tsconfig.json` — без ошибок типов (атрибут `data-open-up`
    допустим на `div`).
- **Feel check**: `npm run dev`, открыть страницу с селектом (например создание урока
  `/teacher/lessons/new` или фильтры в списке тем):
  - Открыть список: он должен **вырастать из кнопки**, а не проявляться по центру самого себя.
  - Прокрутить страницу так, чтобы селект оказался внизу экрана, и открыть снова — меню
    откроется вверх, и расти оно должно **от нижнего края к верхнему**. Это главная проверка
    правильности `transform-origin`; при ошибке меню будет «схлопываться» не в ту сторону.
  - DevTools → Animations, скорость 10%: убедиться, что старт идёт с `scale(0.96)`, а не
    с нуля — меню не должно появляться «из точки».
  - Быстро открыть и закрыть список несколько раз подряд: не должно быть визуального
    мусора и наложения двух панелей.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: меню должно просто проявляться
    без масштаба и сдвига, но НЕ мгновенно.
- **Done when**: меню растёт от триггера в обе стороны в зависимости от места на экране;
  анимация укладывается в 200 мс; при reduced motion остаётся только проявление;
  `npm run lint` и `npm run build` проходят.
