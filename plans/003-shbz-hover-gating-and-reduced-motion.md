# 003 — Закрыть слой shbz от касаний и от prefers-reduced-motion

- **Status**: DONE
- **Commit**: baf3209
- **Severity**: HIGH
- **Category**: 6 (Accessibility)
- **Estimated scope**: 1 файл (`app/globals.css`), 2 перемещённых правила + 1 расширенный блок

## Problem

### Часть A — подъём на hover не закрыт от сенсорных экранов

На тач-устройствах касание порождает ложное событие `hover`, и подъём «залипает» после
тапа, пока пользователь не тронет что-то другое. Кодовая база про это знает и уже
защищается — но только в старом слое `ui-*`. Существующие защиты:
`app/globals.css:452` (`.ui-surface:hover`), `:552` (`.ui-pressable:hover`),
`:1406`, `:1600` — все обёрнуты в `@media (hover: hover) and (pointer: fine)`.

В слое `shbz-*` два правила двигают элемент на hover и НЕ закрыты ничем:

```css
/* app/globals.css:1712-1716 — текущее, вне медиазапроса */
.shbz-btn-primary:hover {
  box-shadow: 0 10px 26px var(--shbz-accent-shadow-hover);
  transform: translateY(-1px);
}
```

```css
/* app/globals.css:2091-2095 — текущее, вне медиазапроса */
.shbz-card-hover { transition: transform 0.18s, box-shadow 0.18s; }
.shbz-card-hover:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 4px rgba(10, 10, 10, 0.05), 0 14px 36px rgba(10, 10, 10, 0.09);
}
```

`.shbz-btn-primary` — 26 использований, главная кнопка продукта. На телефоне после каждого
тапа она остаётся приподнятой.

### Часть B — весь слой shbz невидим для prefers-reduced-motion

В файле три блока `@media (prefers-reduced-motion: reduce)`. Проверен список селекторов каждого:

```css
/* app/globals.css:1526-1538 — покрывает только слой ui-* */
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  /* Keep opacity fades — remove only movement-based motion */
  .ui-fade-slide { animation: ui-fade-opacity 0.2s ease both; }
  .ui-pop-in { animation: ui-fade-opacity 0.15s ease both; }
  .ui-skeleton { animation: none !important; }
  .ui-pressable, .ui-progress-fill { transition: opacity 140ms ease, background-color 140ms ease, color 140ms ease, border-color 140ms ease !important; }
  .ui-surface { transition: opacity 200ms ease, background-color 200ms ease, border-color 200ms ease !important; }
  .ui-surface:hover, .ui-pressable:hover, .ui-pressable:active { transform: none !important; }
}
```

Блок на строке 1224 покрывает только `.app-streak-pill` и `.student-streak-hero`.
Блок на строке 2843 — только `.shbz-streak-flame[data-animate]` и `.shbz-streak-hero[data-animate]`.

Ни один из трёх не упоминает `.shbz-btn-primary`, `.shbz-card-hover` или `.shbz-switch-knob`.
Пользователь, выключивший анимации в системе, всё равно получает подъёмы кнопок, подъём
карточек и едущий ползунок переключателя.

## Target

### Часть A — перенести два правила под медиазапрос

`.shbz-btn-primary:hover` полностью переносится в существующий блок на строке 1600
(`Button hover — gated for pointer devices`), к уже лежащим там `.ui-table-row:hover`
и `.ui-status-button:hover`:

```css
/* target — app/globals.css, внутрь блока @media (hover: hover) and (pointer: fine) на строке 1600 */
  .shbz-btn-primary:hover {
    box-shadow: 0 10px 26px var(--shbz-accent-shadow-hover);
    transform: translateY(-1px);
  }
  .shbz-card-hover:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 4px rgba(10, 10, 10, 0.05), 0 14px 36px rgba(10, 10, 10, 0.09);
  }
```

На исходных местах (строки 1712–1716 и 2092–2095) эти правила `:hover` **удаляются**.
Базовое правило `.shbz-card-hover { transition: … }` на строке 2091 остаётся на месте —
переносится только `:hover`.

### Часть B — расширить блок reduced-motion

В блок на строке 1526 добавить, сохранив его комментарий и стиль:

```css
/* target — добавить внутрь блока @media (prefers-reduced-motion: reduce) на строке 1526 */
  .shbz-btn-primary,
  .shbz-btn-outline,
  .shbz-btn-dark,
  .shbz-btn-danger,
  .shbz-btn-danger-solid,
  .shbz-btn-danger-icon,
  .shbz-card-hover {
    transition: opacity var(--duration-fast) ease, background var(--duration-fast) ease, border-color var(--duration-fast) ease, color var(--duration-fast) ease, box-shadow var(--duration-fast) ease !important;
  }
  .shbz-btn-primary:hover,
  .shbz-btn-primary:active,
  .shbz-btn-outline:active,
  .shbz-btn-dark:active,
  .shbz-btn-danger:active,
  .shbz-btn-danger-solid:active,
  .shbz-btn-danger-icon:active,
  .shbz-card-hover:hover {
    transform: none !important;
  }
  .shbz-switch-knob {
    transition: none !important;
  }
```

Ключевой принцип (плейбук, раздел 6): reduced motion — это **меньше и мягче, а не ноль**.
Поэтому цветовые переходы кнопок сохраняются (пользователь по-прежнему видит отклик на
наведение и нажатие), убирается только перемещение. Ползунок переключателя перестаёт
ехать, но мгновенно оказывается в новой позиции — состояние остаётся считываемым.

## Repo conventions to follow

- Образец гейтинга hover — `app/globals.css:1600-1609`, блок с заголовком-разделителем
  `Button hover — gated for pointer devices`. Новые правила кладутся именно туда, а не в
  новый медиазапрос.
- Образец правила reduced-motion — строка 1535 того же файла:

  ```css
  .ui-pressable, .ui-progress-fill { transition: opacity 140ms ease, background-color 140ms ease, color 140ms ease, border-color 140ms ease !important; }
  ```

  Обратите внимание на `!important` — он здесь обязателен, потому что блок стоит в файле
  выше правил слоя shbz и без него проиграет по порядку каскада.
- Комментарий `/* Keep opacity fades — remove only movement-based motion */` на строке 1531
  описывает намерение блока — сохранить его.

## Steps

1. **Предусловие**: план `001-motion-duration-tokens.md` выполнен (используются токены
   `--duration-fast`). План `002-shbz-button-press-feedback.md` тоже должен быть выполнен —
   правила `:active` из части B ссылаются на добавленные им состояния. Если токенов
   `--duration-*` или правил `:active` у `shbz-btn-*` нет — ОСТАНОВИТЬСЯ и сообщить.
2. `app/globals.css`: удалить правило `.shbz-btn-primary:hover` целиком (строки 1712–1716).
   Правила `.shbz-btn-primary` (базовое) и `.shbz-btn-primary:disabled` НЕ трогать.
3. Удалить правило `.shbz-card-hover:hover` целиком (строки 2092–2095). Строку 2091
   (`.shbz-card-hover { transition: … }`) оставить.
4. В блок `@media (hover: hover) and (pointer: fine)` на строке 1600 добавить оба удалённых
   правила `:hover` в точности как в разделе Target, после `.ui-status-button:hover`.
5. В блок `@media (prefers-reduced-motion: reduce)` на строке 1526 добавить три группы правил
   из части B раздела Target — после последней строки блока (`.ui-surface:hover, …`).
6. Проверить порядок: блок reduced-motion (строка ~1526) идёт в файле РАНЬШЕ слоя shbz
   (строка ~1624), поэтому `!important` обязателен. Убедиться, что он проставлен во всех
   трёх новых группах.

## Boundaries

- НЕ трогать блоки reduced-motion на строках 1224 и 2843 (они относятся к streak-анимациям,
  это отдельная находка вне этого плана).
- НЕ трогать существующие правила внутри блока на строке 1600 (`.ui-table-row`, `.ui-status-button`).
- НЕ добавлять `@media (hover: hover)` к правилам, меняющим только цвет — по плейбуку они
  на касании безвредны, гейтинг нужен только движению.
- НЕ менять значения `translateY` — правила переносятся дословно.
- НЕ трогать `.tsx`-файлы.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `baf3209`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npm run build` — собирается.
  - `grep -n "shbz-btn-primary:hover" app/globals.css` — ровно одно вхождение, и оно
    должно оказаться внутри блока, начинающегося на строке ~1600.
- **Feel check**: `npm run dev`, затем:
  - **Касание.** DevTools → Toggle device toolbar (Cmd+Shift+M), выбрать iPhone, перезагрузить
    страницу. Тапнуть по основной кнопке и убрать палец: кнопка НЕ должна остаться
    приподнятой. До правки она залипает — проверить контраст, переключившись на `main`.
  - Там же тапнуть по карточке с `.shbz-card-hover` — та же проверка.
  - Вернуть обычный десктопный режим и убедиться, что мышью подъём по-прежнему работает.
  - **Reduced motion.** DevTools → Rendering → Emulate CSS media feature
    `prefers-reduced-motion: reduce`. Затем:
    - навести на основную кнопку — подъёма быть не должно, но смена тени/цвета остаётся;
    - нажать кнопку — сжатия быть не должно, но визуальный отклик остаётся;
    - переключить тумблер в `/developer/panel` — ползунок должен перескочить мгновенно,
      без проезда;
    - убедиться, что интерфейс не стал «мёртвым»: цветовые отклики обязаны сохраниться.
      Если всё замерло полностью — правило слишком жёсткое, это ошибка.
- **Done when**: на эмуляции тача подъём не залипает; при `prefers-reduced-motion: reduce`
  перемещений нет, а цветовые отклики есть; `npm run lint` и `npm run build` проходят.
