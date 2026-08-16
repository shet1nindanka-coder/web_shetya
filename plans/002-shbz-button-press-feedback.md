# 002 — Добавить отклик на нажатие всем кнопкам слоя shbz

- **Status**: DONE
- **Commit**: baf3209
- **Severity**: HIGH
- **Category**: 3 (Physicality & origin)
- **Estimated scope**: 1 файл (`app/globals.css`), 6 новых правил

## Problem

Семейство `shbz-btn-*` — основная кнопочная система продукта: 75 использований
в `app/` и `components/` (для сравнения, у старого `.ui-pressable` — 35). При этом
**ни у одной из этих кнопок нет правила `:active`**. Проверено по всему файлу:
единственное вхождение `:active` в `app/globals.css` — строка 544, и оно относится
к старому классу `.ui-pressable`.

Практический результат: нажатие на главную кнопку приложения не даёт вообще никакой
физической обратной связи. Палец/курсор жмёт — интерфейс молчит до тех пор, пока
не отработает серверное действие.

Текущее состояние каждой из шести кнопок:

```css
/* app/globals.css:1702-1721 — .shbz-btn-primary */
.shbz-btn-primary {
  border: none;
  border-radius: 12px;
  background: var(--shbz-accent-grad);
  color: #ffffff;
  font-family: inherit;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 6px 18px var(--shbz-accent-shadow);
  transition: box-shadow 0.18s, transform 0.18s;
}
.shbz-btn-primary:hover {
  box-shadow: 0 10px 26px var(--shbz-accent-shadow-hover);
  transform: translateY(-1px);
}
.shbz-btn-primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}
```

```css
/* app/globals.css:1886-1898 — .shbz-btn-outline */
.shbz-btn-outline {
  /* … */
  transition: border-color 0.15s;
}
.shbz-btn-outline:hover { border-color: var(--shbz-outline-hover); }
```

```css
/* app/globals.css:2154-2167 — .shbz-btn-dark */
.shbz-btn-dark {
  /* … */
  transition: filter 0.15s;
}
.shbz-btn-dark:hover { filter: brightness(1.25); }
```

```css
/* app/globals.css:2170-2182 — .shbz-btn-danger */
.shbz-btn-danger {
  /* … */
  transition: background 0.15s;
}
.shbz-btn-danger:hover { background: var(--shbz-red-soft); }
```

```css
/* app/globals.css:2256-2268 — .shbz-btn-danger-solid */
.shbz-btn-danger-solid {
  /* … */
  transition: filter 0.15s;
}
.shbz-btn-danger-solid:hover { filter: brightness(1.08); }
```

```css
/* app/globals.css:2917-2936 — .shbz-btn-danger-icon */
.shbz-btn-danger-icon {
  /* … */
  transition: opacity 0.15s, background 0.15s, border-color 0.15s;
}
```

Особенно плохо, что отклика нет у `.shbz-btn-danger` и `.shbz-btn-danger-solid` — это
кнопки подтверждения удаления (например «Да, удалить» в `components/confirm-dialog.tsx`),
то есть именно тот случай, где по плейбуку осознанное действие обязано ощущаться физически.

## Target

Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md), раздел 3, «Press feedback»)
задаёт точное значение: `transform: scale(0.97)` на `:active` с переходом `160ms ease-out`,
диапазон допустимого — 0.95–0.98.

Добавить шесть правил. Каждое ставится **сразу после соответствующего правила `:hover`**
той же кнопки:

```css
/* target — после app/globals.css:1716 (.shbz-btn-primary:hover) */
.shbz-btn-primary:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* target — после .shbz-btn-outline:hover */
.shbz-btn-outline:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* target — после .shbz-btn-dark:hover (и после его html[data-theme="dark"] варианта) */
.shbz-btn-dark:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* target — после .shbz-btn-danger:hover */
.shbz-btn-danger:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* target — после .shbz-btn-danger-solid:hover */
.shbz-btn-danger-solid:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}

/* target — после правила .shbz-btn-danger-icon */
.shbz-btn-danger-icon:active:not(:disabled) {
  transform: scale(0.97);
  transition-duration: 60ms;
}
```

Каждой из этих кнопок, кроме `.shbz-btn-primary` и `.shbz-card-hover`, в `transition`
сейчас не перечислен `transform` — без него `:active` сработает мгновенно, без анимации.
Поэтому в объявление каждой кнопки нужно **добавить `transform`** в список переходов:

```css
/* target — .shbz-btn-outline, строка 1896 */
  transition: border-color var(--duration-fast), transform var(--duration-base) var(--ease-out);

/* target — .shbz-btn-dark, строка 2165 */
  transition: filter var(--duration-fast), transform var(--duration-base) var(--ease-out);

/* target — .shbz-btn-danger, строка 2180 */
  transition: background var(--duration-fast), transform var(--duration-base) var(--ease-out);

/* target — .shbz-btn-danger-solid, строка 2266 */
  transition: filter var(--duration-fast), transform var(--duration-base) var(--ease-out);

/* target — .shbz-btn-danger-icon, строка 2934 */
  transition: opacity var(--duration-fast), background var(--duration-fast), border-color var(--duration-fast), transform var(--duration-base) var(--ease-out);
```

`.shbz-btn-primary` уже содержит `transform` в переходе — его список менять не нужно
(план 001 уже привёл его к токенам).

### Почему `transition-duration: 60ms` на `:active`

Это осознанная асимметрия, уже принятая в этой кодовой базе: нажатие защёлкивается
быстро (60 мс), отпускание возвращается по базовой длительности (180 мс). Точно так же
сделано у `.ui-pressable` (строки 536–547). Плейбук в разделе 4 называет такую
асимметрию правильной: «system's response snaps».

### Почему `:not(:disabled)`

У `.shbz-btn-primary` и `.shbz-btn-danger-solid` есть правила `:disabled`, гасящие
`transform`. Без `:not(:disabled)` нажатие на заблокированную кнопку всё равно дало бы
сжатие, обещая реакцию, которой не будет.

## Repo conventions to follow

- Образец для подражания — `app/globals.css:544-547`, уже существующий и правильный:

  ```css
  .ui-pressable:active {
    transform: translateY(0) scale(0.97);
    transition-duration: 60ms;
  }
  ```

  Обратите внимание: тот же коэффициент `0.97`, та же длительность `60ms`. Новые правила
  намеренно совпадают с ним, чтобы два слоя дизайн-системы ощущались одинаково.
- Правила состояний в файле идут подряд сразу за базовым правилом класса, в порядке
  `:hover` → `:active` → `:focus-visible` → `:disabled`. Соблюдать этот порядок.
- Тёмная тема оформляется отдельными правилами `html[data-theme="dark"] .класс`. Для
  `:active` отдельные тёмные варианты НЕ нужны — `transform` от темы не зависит.

## Steps

1. **Предусловие**: план `001-motion-duration-tokens.md` должен быть выполнен — этот план
   использует токены `--duration-fast`, `--duration-base` и `--ease-out`. Если токенов
   `--duration-*` в блоке `:root` нет, ОСТАНОВИТЬСЯ и сообщить.
2. `app/globals.css`, `.shbz-btn-primary`: добавить правило `.shbz-btn-primary:active:not(:disabled)`
   сразу после правила `.shbz-btn-primary:hover` (заканчивается на строке 1716) и перед
   `.shbz-btn-primary:disabled`.
3. `.shbz-btn-outline`: добавить `transform` в список переходов (строка 1896) по образцу из
   Target, затем добавить правило `:active:not(:disabled)` сразу после `.shbz-btn-outline:hover`.
4. `.shbz-btn-dark`: то же — сначала переход (строка 2165), затем правило `:active` после
   строки 2168 (`html[data-theme="dark"] .shbz-btn-dark:hover`).
5. `.shbz-btn-danger`: то же — переход (строка 2180), правило `:active` после
   `.shbz-btn-danger:hover`.
6. `.shbz-btn-danger-solid`: то же — переход (строка 2266), правило `:active` после
   `.shbz-btn-danger-solid:hover` и перед `.shbz-btn-danger-solid:disabled`.
7. `.shbz-btn-danger-icon`: то же — переход (строка 2934), правило `:active` после базового правила.
8. Проверить: `grep -c ":active" app/globals.css` — ожидается 8 (было 2: строки 544 и 1537).

## Boundaries

- НЕ трогать `.ui-pressable` и вообще слой `ui-*` — он уже правильный.
- НЕ менять `:hover`-правила. Гейтинг hover под `@media (hover: hover)` — задача плана 003,
  здесь его не делать, чтобы коммиты остались раздельными и откатывались независимо.
- НЕ менять коэффициент масштаба. Ровно `0.97`, как у `.ui-pressable`.
- НЕ добавлять `:active` контейнерам и карточкам (`.shbz-card`, `.shbz-card-hover`) —
  только кнопкам из перечисленного списка.
- НЕ трогать `.tsx`-файлы: классы уже проставлены в разметке, менять её не требуется.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `baf3209`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npm run build` — собирается.
  - `grep -c ":active" app/globals.css` → 8.
- **Feel check**: `npm run dev`, затем:
  - Страница `/login`: зажать кнопку входа мышью и **не отпускать**. Кнопка должна остаться
    в сжатом состоянии, пока кнопка мыши нажата, и упруго вернуться при отпускании.
  - Убедиться, что возврат заметно медленнее нажатия (60 мс против 180 мс) — это должно
    ощущаться как «щёлк вниз, мягко вверх», а не как симметричное качание.
  - Открыть любой диалог удаления (например удаление ученика у преподавателя) и нажать
    «Да, удалить» — красная кнопка должна давать тот же отклик.
  - Найти заблокированную кнопку (форма с пустыми обязательными полями) и нажать на неё:
    сжатия быть НЕ должно.
  - В DevTools → Animations выставить 10% и убедиться, что масштаб идёт до 0.97, а не до
    заметно меньшего значения — кнопка не должна выглядеть «проваливающейся».
  - Сравнить ощущение с любой кнопкой на классе `ui-pressable` (например в состояниях
    ошибок, `components/app-state-shells.tsx`) — отклик должен быть неотличим.
- **Done when**: все шесть классов кнопок дают сжатие при нажатии; заблокированные кнопки
  не реагируют; `npm run lint` и `npm run build` проходят.
