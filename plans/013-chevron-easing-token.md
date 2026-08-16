# 013 — Перевести повороты «галочек» на токен кривой

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: LOW
- **Category**: 2 (Easing & duration)
- **Estimated scope**: 4 файла, по одной строке в каждом

## Problem

Четыре иконки-«галочки» поворачиваются на 180° при раскрытии, используя голый класс
Tailwind `transition-transform`:

```tsx
/* components/shbz-select.tsx:156-158 — текущее */
          className="shrink-0 transition-transform"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
```

```tsx
/* components/teacher-homework-review-list.tsx:479 — текущее */
                    className="ml-auto h-3.5 w-3.5 transition-transform group-open:rotate-180"
```

```tsx
/* components/student-homework-submissions.tsx:127 — текущее */
              className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
```

```tsx
/* components/teacher-student-lessons.tsx:49 — текущее */
      className="shrink-0 transition-transform duration-150"
```

В `tailwind.config.ts` не задано ни своих кривых, ни своих длительностей, поэтому голый
`transition-transform` разворачивается в дефолт Tailwind: 150 мс с кривой
`cubic-bezier(0.4, 0, 0.2, 1)`. Это симметричная кривая типа ease-in-out со слабым выходом.

Поворот иконки — это движение по экрану. Плейбук
([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) раздел 2, порядок выбора:
«Moving / morphing on screen → `ease-in-out`», а встроенных кривых CSS и Tailwind
недостаточно для осмысленного движения — нужны сильные кривые из токенов. В проекте
такой токен уже есть: `--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1)` (`app/globals.css:23`).

Один из четырёх (`shbz-select.tsx`) — часть компонента, помеченного как очень частый,
поэтому находка стоит того, чтобы её закрыть, хотя эффект тонкий.

## Target

К каждому из четырёх добавляются две утилиты Tailwind с произвольными значениями:
`duration-[180ms]` и `ease-[var(--ease-in-out)]`.

```tsx
/* target — components/shbz-select.tsx:156 */
          className="shrink-0 transition-transform duration-[180ms] ease-[var(--ease-in-out)]"
```

```tsx
/* target — components/teacher-homework-review-list.tsx:479 */
                    className="ml-auto h-3.5 w-3.5 transition-transform duration-[180ms] ease-[var(--ease-in-out)] group-open:rotate-180"
```

```tsx
/* target — components/student-homework-submissions.tsx:127 */
              className="h-3.5 w-3.5 transition-transform duration-[180ms] ease-[var(--ease-in-out)] group-open:rotate-180"
```

```tsx
/* target — components/teacher-student-lessons.tsx:49 */
      className="shrink-0 transition-transform duration-[180ms] ease-[var(--ease-in-out)]"
```

Обратите внимание: в `teacher-student-lessons.tsx` существующий класс `duration-150`
**заменяется** на `duration-[180ms]`, а не дописывается рядом — два класса длительности
конфликтовали бы, и какой победит, зависело бы от порядка в собранном CSS.

180 мс — та же величина, что у токена `--duration-base`, использовать сам токен здесь
нельзя: Tailwind не подставляет переменные в `duration-*` из конфига, а произвольное
значение `duration-[var(--duration-base)]` работает, но хуже читается в разметке. Явные
180 мс попадают в бюджет плейбука для этого класса элементов.

## Repo conventions to follow

- Произвольные значения Tailwind в квадратных скобках в проекте уже используются широко,
  например `rounded-[12px]`, `text-[13px]`, `top-[calc(100%+10px)]`,
  `bg-[var(--theme-surface-soft)]` — приём привычный, включая подстановку CSS-переменных
  через `var(...)`.
- Порядок классов в `className` в проекте — от структурных к состояниям: размеры,
  затем переход, затем варианты вроде `group-open:`. Новые утилиты ставятся сразу после
  `transition-transform` и перед `group-open:rotate-180`.

## Steps

1. `components/shbz-select.tsx:156`: дописать `duration-[180ms] ease-[var(--ease-in-out)]`
   после `transition-transform`. Атрибут `style` с `rotate(180deg)` не трогать.
2. `components/teacher-homework-review-list.tsx:479`: вставить те же две утилиты между
   `transition-transform` и `group-open:rotate-180`.
3. `components/student-homework-submissions.tsx:127`: то же самое.
4. `components/teacher-student-lessons.tsx:49`: заменить `duration-150` на
   `duration-[180ms]` и добавить `ease-[var(--ease-in-out)]`.

## Boundaries

- НЕ трогать другие места с голым `transition` / `transition-colors` в `.tsx`: их десятки,
  и почти все меняют только цвет, где по плейбуку дефолтная кривая допустима. Этот план —
  только про четыре поворота.
- НЕ менять `tailwind.config.ts`: заводить там токены под один случай избыточно.
- НЕ менять угол поворота, `style`, `group-open:` и логику раскрытия.
- НЕ добавлять `duration-*` рядом с существующим — в `teacher-student-lessons.tsx` старый
  класс именно заменяется.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npx tsc --noEmit -p tsconfig.json` — чисто.
  - `grep -rn "duration-150" components/teacher-student-lessons.tsx` — пусто.
  - `grep -rc "ease-\[var(--ease-in-out)\]" components/shbz-select.tsx components/teacher-homework-review-list.tsx components/student-homework-submissions.tsx components/teacher-student-lessons.tsx` — по одному в каждом файле.
- **Feel check**: `npm run dev`:
  - Открыть селект (`shbz-select`) и посмотреть на «галочку»: разворот должен ощущаться
    более собранным — с выраженным разгоном и торможением, без вялой середины.
  - DevTools → Animations, скорость 10%: сравнить с веткой до правки. Разница тонкая,
    смотреть на начало и конец поворота.
  - Раскрыть карточку проверки ДЗ (`teacher-homework-review-list`) и загрузку фото
    (`student-homework-submissions`) — стрелки должны крутиться одинаково во всех четырёх
    местах. Разнобой означает, что где-то утилиты не применились.
  - Проверить, что в `teacher-student-lessons` длительность именно 180 мс, а не 150:
    в инспекторе у элемента должно быть `transition-duration: 180ms`.
- **Done when**: все четыре стрелки крутятся с одинаковой кривой и длительностью;
  конфликтующего `duration-150` не осталось; lint и tsc чисты.
