# 009 — Перевести ползунок переключателя с `left` на `transform`

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: MEDIUM
- **Category**: 5 (Performance)
- **Estimated scope**: 1 файл (`app/globals.css`), 3 правки

## Problem

План 001 починил у ползунка кривую, но само движение осталось на layout-свойстве:

```css
/* app/globals.css:2073-2084 — текущее */
.shbz-switch-knob {
  position: absolute;
  left: 3.5px;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(10, 10, 10, 0.25);
  transition: left var(--duration-slow) var(--ease-in-out);
}
```

```css
/* app/globals.css:2089 — текущее */
.shbz-switch input:checked ~ .shbz-switch-knob { left: 23px; }
```

`left` запускает пересчёт раскладки, отрисовку и композитинг на каждом кадре. Плейбук
([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) раздел 5 перечисляет
`width`/`height`/`margin`/`padding`/`top`/`left` как ровно тот случай, которого следует
избегать: анимировать нужно `transform` и `opacity`.

Охват небольшой — `.shbz-switch` используется только в `components/developer-panel.tsx`,
поэтому важность MEDIUM, а не HIGH. Но исправление тривиально и снимает целый класс
проблемы.

## Target

Ползунок остаётся на `left: 3.5px` (это его исходная позиция), а смещение выражается
через `transform`. Дистанция — ровно та же: `23px − 3.5px = 19.5px`.

```css
/* target — app/globals.css, .shbz-switch-knob */
.shbz-switch-knob {
  position: absolute;
  left: 3.5px;
  top: 50%;
  transform: translate(0, -50%);
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(10, 10, 10, 0.25);
  transition: transform var(--duration-slow) var(--ease-in-out);
}
```

```css
/* target — app/globals.css, включённое состояние */
.shbz-switch input:checked ~ .shbz-switch-knob { transform: translate(19.5px, -50%); }
```

Ключевой момент: вертикальное центрирование `translateY(-50%)` нельзя потерять — поэтому
обе позиции записаны одной функцией `translate(x, y)`, где `y` всегда `-50%`. Если написать
только `translateX(19.5px)`, ползунок съедет вниз на половину своей высоты.

## Repo conventions to follow

- Токены `--duration-slow` и `--ease-in-out` уже используются в этом же правиле — просто
  переносятся на другое свойство.
- Правило `.shbz-switch input:checked ~ .shbz-switch-knob` записано в одну строку —
  сохранить эту форму.
- Экземпляр правильного подхода в этой же кодовой базе — `components/progress-bar.tsx:29`,
  где заполнение полосы делается через `transform: scaleX(...)`, а не через `width`.

## Steps

1. `app/globals.css`, правило `.shbz-switch-knob`: заменить `transform: translateY(-50%);`
   на `transform: translate(0, -50%);`.
2. В том же правиле заменить `transition: left var(--duration-slow) var(--ease-in-out);`
   на `transition: transform var(--duration-slow) var(--ease-in-out);`.
3. Правило `.shbz-switch input:checked ~ .shbz-switch-knob`: заменить `left: 23px;`
   на `transform: translate(19.5px, -50%);`.
4. Проверить: `grep -n "transition: left" app/globals.css` — ожидаемый вывод пуст.

## Boundaries

- НЕ трогать `.shbz-switch-track` (соседнее правило) — оно анимирует только фон и рамку,
  это цветовой переход, и по плейбуку он корректен как есть.
- НЕ менять `left: 3.5px` в базовом правиле — это стартовая позиция, а не анимируемое значение.
- НЕ менять размеры ползунка и дорожки: смещение 19.5px рассчитано под текущие
  `width: 20px` и геометрию дорожки. Если менять размеры, придётся пересчитывать.
- НЕ трогать правило reduced-motion `.shbz-switch-knob { transition: none !important; }`
  (добавлено планом 003) — оно продолжит работать, потому что гасит переход целиком,
  независимо от свойства.
- НЕ трогать `components/developer-panel.tsx` — разметка не меняется.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `grep -n "transition: left" app/globals.css` — пусто.
  - `grep -n "translate(19.5px, -50%)" app/globals.css` — одно вхождение.
- **Feel check**: `npm run dev`, войти разработчиком, открыть `/developer/panel`:
  - **Главная проверка:** переключить тумблер и убедиться, что ползунок остался
    вертикально по центру дорожки. Если он съехал вниз — потеряна часть `-50%`.
  - Ползунок должен доезжать ровно до правого края с тем же отступом, что слева.
    Если он не доезжает или вылезает — неверна дистанция 19.5px.
  - Переключить туда-обратно несколько раз быстро: движение должно плавно
    разворачиваться на полпути, без рывка.
  - DevTools → Performance, запись во время переключения: в отличие от прежней версии,
    в кадрах не должно быть Layout-событий от ползунка.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: ползунок должен перескакивать
    мгновенно, оставаясь по центру.
- **Done when**: ползунок центрирован по вертикали в обоих положениях, доезжает до края,
  Layout-события ушли; lint чист.
