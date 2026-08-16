# 007 — Перевести шиммер скелетонов на transform и закрыть его от reduced-motion

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: MEDIUM
- **Category**: 5 (Performance), 6 (Accessibility)
- **Estimated scope**: 2 файла (`app/globals.css`, `components/student-deadlines-calendar-skeleton.tsx`), ~30 строк

## Problem

### Часть A — шиммер анимирует `background-position`

```css
/* app/globals.css:421-424 — текущее */
@keyframes ui-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}
```

```css
/* app/globals.css:1432-1447 — текущее */
.ui-skeleton {
  position: relative;
  overflow: hidden;
  background: linear-gradient(90deg, rgba(226, 232, 240, 0.6) 20%, rgba(255, 255, 255, 0.9) 50%, rgba(226, 232, 240, 0.6) 80%);
  background-size: 200% 100%;
  animation: ui-shimmer 1.4s linear infinite;
}
html[data-theme="dark"] .ui-skeleton {
  background:
    linear-gradient(
      90deg,
      rgba(30, 41, 59, 0.78) 20%,
      rgba(51, 65, 85, 0.96) 50%,
      rgba(30, 41, 59, 0.78) 80%
    );
  background-size: 200% 100%;
}
```

`background-position` — свойство отрисовки, а не композитинга. Плейбук
([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) раздел 5: анимировать
только `transform` и `opacity`. Анимация бесконечная и стоит в 27 местах, то есть браузер
непрерывно перерисовывает каждый скелетон, пока грузится страница.

### Часть B — шиммер и спиннер календаря не достаются правилом reduced-motion

```tsx
/* components/student-deadlines-calendar-skeleton.tsx:4-7 — текущее */
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(148,163,184,0.12),transparent)] [background-size:220%_100%] animate-[ui-shimmer_1.6s_linear_infinite]" />
      <div className="mb-3 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border-soft)] border-t-[var(--theme-accent-strong)]" />
      </div>
```

Правило `.ui-skeleton { animation: none !important; }` (`app/globals.css:1537`) до этих двух
элементов не достаёт — класса `.ui-skeleton` на них нет. При включённом
`prefers-reduced-motion: reduce` они продолжают крутиться и мерцать.

Обратите внимание: 52 элемента `animate-pulse` в том же файле трогать НЕ нужно — это
анимация прозрачности, а плейбук в разделе 6 прямо разрешает сохранять её при reduced motion
(«keep opacity/color, drop movement»).

### Почему две части в одном плане

Обе завязаны на один keyframe `ui-shimmer`. Если переписать его на `transform`, не тронув
инлайновое использование в календаре, тот `div` начнёт ездить по карточке целиком —
он рассчитан именно на сдвиг фона. Части нельзя разделить на два коммита.

## Target

### Новый keyframe и слой-накладка

```css
/* target — app/globals.css:421, заменить keyframes целиком */
@keyframes ui-shimmer {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
```

```css
/* target — app/globals.css, заменить .ui-skeleton и его тёмный вариант */
.ui-skeleton {
  position: relative;
  overflow: hidden;
  background: rgba(226, 232, 240, 0.6);
}
.ui-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 20%, rgba(255, 255, 255, 0.9) 50%, transparent 80%);
  animation: ui-shimmer 1.4s linear infinite;
}
html[data-theme="dark"] .ui-skeleton {
  background: rgba(30, 41, 59, 0.78);
}
html[data-theme="dark"] .ui-skeleton::after {
  background: linear-gradient(90deg, transparent 20%, rgba(51, 65, 85, 0.96) 50%, transparent 80%);
}
```

Подложка становится плоской заливкой (перерисовки нет), а бликом занимается псевдоэлемент,
который просто едет по оси X — чистый композитинг. Цвета взяты из исходных градиентов
один в один: крайние стопы стали фоном, средний — бликом.

### Правило reduced-motion

Существующее правило на `app/globals.css:1537` перестанет работать, потому что анимация
переехала на псевдоэлемент. Заменить его:

```css
/* target — app/globals.css:1537, внутри блока @media (prefers-reduced-motion: reduce) */
  .ui-skeleton::after { animation: none !important; }
  .ui-skeleton-spinner { animation: none !important; }
```

### Календарь-скелетон

```tsx
/* target — components/student-deadlines-calendar-skeleton.tsx:4 */
      <div className="ui-skeleton pointer-events-none absolute inset-0 !bg-transparent" />
```

Накладка теперь берётся из `.ui-skeleton::after`, поэтому собственный градиент и
`background-size` не нужны, а фон подложки гасится (карточка под ней уже нарисована).

```tsx
/* target — components/student-deadlines-calendar-skeleton.tsx:6 */
        <div className="ui-skeleton-spinner h-5 w-5 animate-spin rounded-full border-2 border-[var(--theme-border-soft)] border-t-[var(--theme-accent-strong)]" />
```

Класс `ui-skeleton-spinner` не несёт стилей — он существует только как крючок для правила
reduced-motion. Объявлять его в CSS отдельно не нужно.

## Repo conventions to follow

- Комментарий-разделитель `Skeleton loading` (`app/globals.css:1428-1430`) сохранить.
- Тёмная тема оформляется отдельным правилом `html[data-theme="dark"] .класс` — тот же
  приём применить и к псевдоэлементу.
- Существующий комментарий в блоке reduced-motion
  `/* Keep opacity fades — remove only movement-based motion */` не трогать.
- В `.tsx` служебные классы-крючки без стилей в проекте уже используются
  (`data-shbz-portal=""` играет ту же роль) — приём привычный.

## Steps

1. `app/globals.css:421-424`: заменить тело `@keyframes ui-shimmer` на вариант с `translateX`.
2. `app/globals.css:1432-1447`: заменить `.ui-skeleton` и `html[data-theme="dark"] .ui-skeleton`
   на четыре правила из раздела Target (базовое, `::after`, тёмное базовое, тёмное `::after`).
3. `app/globals.css:1537`: заменить строку `.ui-skeleton { animation: none !important; }`
   на две строки из раздела Target.
4. `components/student-deadlines-calendar-skeleton.tsx:4`: заменить `className` накладки.
5. `components/student-deadlines-calendar-skeleton.tsx:6`: добавить `ui-skeleton-spinner`
   первым классом спиннера, остальные классы сохранить.
6. Проверить, что литерал `background-position` больше не встречается в анимациях:
   `grep -n "background-position" app/globals.css` — допустимы только статичные объявления
   (например у `.shbz-select`), но не внутри `@keyframes`.

## Boundaries

- НЕ трогать 52 элемента `animate-pulse` в календаре-скелетоне — прозрачность при reduced
  motion сохраняется намеренно.
- НЕ менять длительность `1.4s` у скелетонов и `1.6s`, которая была у календаря
  (после правки календарь наследует 1.4s — это допустимо и упрощает систему).
- НЕ трогать другие 26 мест с `.ui-skeleton` в `.tsx` — они работают через класс и
  подхватят изменение сами.
- НЕ трогать `@keyframes shbz-spin` и остальные анимации загрузки.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npx tsc --noEmit -p tsconfig.json` — чисто.
  - `grep -n "background-position" app/globals.css` — ни одного вхождения внутри `@keyframes`.
- **Feel check**: `npm run dev`:
  - Открыть страницу со скелетонами (например `/student/deadlines` при медленной загрузке;
    удобно задросселировать сеть в DevTools → Network → Slow 3G). Блик должен ехать слева
    направо так же, как раньше — визуально изменение не должно быть заметно.
  - **Светлая и тёмная темы обе.** Это главный риск плана: цвета разнесены между подложкой
    и псевдоэлементом, ошибка проявится как пропавший блик или неверный оттенок фона.
  - DevTools → Performance, запись 3 секунд на странице со скелетонами: в строке Rendering
    не должно быть постоянных Paint-событий от скелетонов. До правки они там были.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: блик и спиннер календаря
    останавливаются, но пульсация ячеек (`animate-pulse`) остаётся — интерфейс не должен
    выглядеть зависшим.
- **Done when**: шиммер визуально прежний в обеих темах; Paint-события ушли; при reduced
  motion блик и спиннер стоят, пульсация живёт; lint и tsc чисты.
