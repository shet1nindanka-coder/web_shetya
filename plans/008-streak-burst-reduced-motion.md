# 008 — Закрыть вспышку streak-плашки от reduced-motion

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: MEDIUM
- **Category**: 6 (Accessibility)
- **Estimated scope**: 1 файл (`app/globals.css`), 1 строка

## Problem

Streak-плашка рисует расходящееся кольцо через псевдоэлемент `::after`:

```css
/* app/globals.css:1107-1110 — текущее */
.app-streak-pill[data-animate="ignite"]::after,
.app-streak-pill[data-animate="grow"]::after {
  animation: streak-pill-burst 900ms cubic-bezier(0.16, 1, 0.3, 1);
}
```

Блок reduced-motion, который гасит streak-анимации, перечисляет только сами элементы —
псевдоэлемент в список не попал:

```css
/* app/globals.css:1228-1236 — текущее */
  .app-streak-pill,
  .student-streak-hero {
    transition: none;
  }

  .app-streak-pill[data-animate],
  .app-streak-pill[data-animate] .app-streak-icon,
  .student-streak-hero[data-streak-animate] {
    animation: none !important;
  }
```

Результат: пользователь с включённым `prefers-reduced-motion: reduce` не видит, как плашка
масштабируется, но кольцо `streak-pill-burst` продолжает расходиться. Само кольцо —
это разрастающаяся тень (`box-shadow` в keyframes `streak-pill-burst`, `app/globals.css:1155`),
то есть именно движение, а не цветовой отклик, и по плейбуку
([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md), раздел 6) его следует убрать.

## Target

```css
/* target — app/globals.css, блок @media (prefers-reduced-motion: reduce) около строки 1232 */
  .app-streak-pill[data-animate],
  .app-streak-pill[data-animate]::after,
  .app-streak-pill[data-animate] .app-streak-icon,
  .student-streak-hero[data-streak-animate] {
    animation: none !important;
  }
```

Добавляется ровно одна строка селектора — `.app-streak-pill[data-animate]::after` — второй
в списке. Остальное правило не меняется.

## Repo conventions to follow

- Селекторы в этом блоке перечислены по одному на строку, с отступом в два пробела,
  в порядке «сам элемент → его потомки → соседний компонент». Новый селектор ставится
  сразу после `.app-streak-pill[data-animate]`, потому что относится к тому же элементу.
- `!important` в блоке обязателен и уже стоит — правило объявлено в файле раньше
  streak-анимаций и без него проиграет по каскаду.

## Steps

1. `app/globals.css`: в блоке `@media (prefers-reduced-motion: reduce)` около строки 1232
   добавить строку `.app-streak-pill[data-animate]::after,` сразу после
   `.app-streak-pill[data-animate],`.

## Boundaries

- НЕ трогать сами streak-анимации: они намеренно игровые, это единственная праздничная
  зона продукта, и вне reduced-motion их поведение менять не нужно.
- НЕ трогать второй блок reduced-motion на строке ~1529 (слой `ui-*` и `shbz-*`) и третий
  около строки ~2910 (`.shbz-streak-flame`).
- НЕ добавлять сюда `transition: none` — псевдоэлемент переходов не имеет, только анимацию.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `grep -n "app-streak-pill\[data-animate\]::after" app/globals.css` — должно найтись
    два вхождения: одно в самом правиле анимации (около строки 1107), одно в блоке
    reduced-motion (около строки 1233).
- **Feel check**: воспроизвести смену streak непросто — она меняется раз в сутки. Проверять
  подменой атрибута вручную:
  - `npm run dev`, войти учеником, открыть страницу с плашкой streak в шапке.
  - DevTools → Rendering → включить `prefers-reduced-motion: reduce`.
  - В инспекторе найти элемент с классом `app-streak-pill`, вручную поставить ему атрибут
    `data-animate="grow"`.
  - Ожидаемо: плашка НЕ масштабируется и кольцо вокруг неё НЕ расходится. До правки кольцо
    расходилось.
  - Выключить эмуляцию reduced-motion, повторить установку атрибута: и масштаб, и кольцо
    должны отработать как прежде.
- **Done when**: при reduced-motion смена `data-animate` не даёт никакого движения, при
  обычном режиме анимация играет полностью; lint чист.
