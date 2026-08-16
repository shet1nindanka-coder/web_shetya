# 006 — Дать появление двум модальным диалогам

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: MEDIUM
- **Category**: 3 (Physicality & origin), 4 (Interruptibility)
- **Estimated scope**: 3 файла (2 компонента + `app/globals.css`), ~20 строк

## Problem

Оба модальных окна приложения появляются мгновенно — подложка и карточка возникают
без перехода. Структура у них идентична:

```tsx
/* components/confirm-dialog.tsx:59-72 — текущее */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={() => {
        if (!isPending) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`shbz-card w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[85vh] overflow-y-auto p-6`}
```

```tsx
/* components/account-credentials-dialog.tsx:63-74 — текущее */
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="shbz-card max-h-[85vh] w-full max-w-md overflow-y-auto p-6"
```

`confirm-dialog` — это подтверждение удаления, оно возникает поверх всего экрана резким
скачком вместе с затемнением и блюром. Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)),
таблица длительностей: модальные окна 200–500 мс.

**Важно:** правило «расти от триггера» на модальные окна НЕ распространяется —
плейбук в разделе 3 прямо освобождает их: «Modals are exempt — they appear centered;
`transform-origin: center` is correct there». Поэтому здесь центр, и это не ошибка.

## Target

### CSS — новый блок в `app/globals.css`

Разместить сразу после блока `ШБЗ: выпадающие панели`:

```css
/* target — app/globals.css */
/* ───────────────────────────────────────────────
   ШБЗ: модальные окна
   ─────────────────────────────────────────────── */
@keyframes shbz-modal-overlay-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes shbz-modal-card-in {
  from { opacity: 0; transform: scale(0.96) translateY(8px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
.shbz-modal-overlay {
  animation: shbz-modal-overlay-in var(--duration-fast) var(--ease-out) both;
}
.shbz-modal-card {
  transform-origin: center;
  animation: shbz-modal-card-in var(--duration-slow) var(--ease-out) both;
}
@media (prefers-reduced-motion: reduce) {
  .shbz-modal-card {
    animation: shbz-modal-overlay-in var(--duration-fast) ease both;
  }
}
```

Подложка проявляется быстрее карточки (150 мс против 200 мс) — затемнение успевает лечь
до того, как карточка доедет, и окно не выглядит «выпрыгнувшим на пустом фоне».

`scale(0.96)` — в допустимом диапазоне плейбука (0.9–0.97), запрет на `scale(0)` соблюдён.
При reduced-motion карточка получает ту же анимацию, что подложка, — только прозрачность.

### TSX — по одной правке на файл

```tsx
/* target — components/confirm-dialog.tsx, подложка */
      className="shbz-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"

/* target — components/confirm-dialog.tsx, карточка */
        className={`shbz-modal-card shbz-card w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[85vh] overflow-y-auto p-6`}
```

```tsx
/* target — components/account-credentials-dialog.tsx, подложка */
      className="shbz-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"

/* target — components/account-credentials-dialog.tsx, карточка */
        className="shbz-modal-card shbz-card max-h-[85vh] w-full max-w-md overflow-y-auto p-6"
```

### Что этот план сознательно НЕ делает

Закрытие остаётся мгновенным — как и у дропдаунов из планов 004 и 005. Анимация выхода
требует держать элемент смонтированным после закрытия и вести отдельное состояние; это
изменение логики компонента, а не его движения.

## Repo conventions to follow

- Образец — блок `ШБЗ: выпадающие панели`, созданный планом 004 в `app/globals.css`
  (около строки 2260): разделитель в стиле файла, keyframes рядом с классом, токены
  вместо литералов, отдельный блок reduced-motion.
- Классы-анимации идут в `className` первыми, перед утилитами Tailwind и перед `shbz-card`.
- В `confirm-dialog.tsx` карточка собирается шаблонной строкой с тернарником `wide` —
  сохранить эту форму, просто дописать класс в начало.

## Steps

1. `app/globals.css`: добавить блок из раздела Target после блока `ШБЗ: выпадающие панели`.
2. `components/confirm-dialog.tsx`: добавить `shbz-modal-overlay` первым классом подложки
   (строка 61) и `shbz-modal-card` первым классом карточки (строка 72).
3. `components/account-credentials-dialog.tsx`: то же самое для строк 65 и 73.
4. Больше в компонентах ничего не менять: ни `onClick`, ни `createPortal`, ни блокировку
   прокрутки, ни обработчик Escape.

## Boundaries

- НЕ добавлять `transform-origin`, отличный от `center` — для модальных окон центр верен
  по плейбуку, это не находка.
- НЕ трогать оверлеи из плана 005 (`shbz-select`, колокольчик, датапикер, календарь,
  подсказка пароля).
- НЕ реализовывать анимацию закрытия, НЕ менять условие `if (!open) return null`.
- НЕ трогать `backdrop-blur-sm`: блюр подложки статичный, он не анимируется и под лимит
  «менее 20px на переходе» не подпадает.
- НЕ менять `role`, `aria-modal`, `aria-label` и порядок атрибутов.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npx tsc --noEmit -p tsconfig.json` — чисто.
  - `grep -c "shbz-modal-" app/globals.css` — не менее 6.
- **Feel check**: `npm run dev`, войти преподавателем:
  - Открыть любое подтверждение удаления (например удалить ученика). Затемнение должно
    лечь чуть раньше, чем приедет карточка — не одновременным скачком.
  - DevTools → Animations, скорость 10%: убедиться, что карточка стартует с `scale(0.96)`,
    а не из точки, и что подложка заканчивает проявляться раньше карточки.
  - Создать ученика и посмотреть окно с паролем — та же анимация.
  - Нажать Escape и кликнуть по подложке: закрытие мгновенное, это ожидаемо. Убедиться,
    что при повторном открытии анимация играет заново, а не «залипает» пропущенной.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: карточка просто проявляется,
    без масштаба и подъёма; окно при этом остаётся по центру экрана.
- **Done when**: оба окна появляются анимированно, карточка отстаёт от подложки, при
  reduced-motion остаётся только проявление; lint и tsc чисты.
