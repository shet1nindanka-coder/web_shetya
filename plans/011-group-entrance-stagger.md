# 011 — Задействовать каскад появления в двух списках

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: LOW
- **Category**: 7 (Cohesion & tokens)
- **Estimated scope**: 2 файла (2 компонента), ~6 строк

## Problem

### Часть A — токены каскада написаны, но мертвы

```css
/* app/globals.css:428-436 — текущее */
.ui-fade-slide { animation: ui-fade-slide 0.25s var(--ease-out) both; }
.ui-pop-in { animation: ui-pop-in 0.18s var(--ease-out) both; }

/* ───────────────────────────────────────────────
   Stagger delays — cascade for cards & list items
   ─────────────────────────────────────────────── */
.ui-stagger-1 { animation-delay: 0ms; }
.ui-stagger-2 { animation-delay: 50ms; }
.ui-stagger-3 { animation-delay: 100ms; }
.ui-stagger-4 { animation-delay: 150ms; }
.ui-stagger-5 { animation-delay: 200ms; }
.ui-stagger-6 { animation-delay: 250ms; }
```

Проверено: `grep -ro "ui-stagger" app components --include="*.tsx" | wc -l` даёт **0**.
Классы не использует никто. Шаг 50 мс попадает в рекомендованный плейбуком диапазон
30–80 мс ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md), раздел 7).

### Часть B — ровно те списки, ради которых они писались, появляются разом

```tsx
/* components/topic-answer-manager.tsx:618-630 — текущее */
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        {currentPageItems.map((item) => {
          const cardStatus = getCardStatus(item);

          return (
            <article
              key={item.id}
              className={cx(
                "topic-answer-card ui-fade-slide ui-panel-soft min-w-0 rounded-[16px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-4.5",
```

```tsx
/* components/group-members-manager.tsx:112-117 — текущее */
          {members.map((member) => (
            <div
              key={member.id}
              className="ui-fade-slide rounded-[16px] border px-5 py-4"
              style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
            >
```

Все карточки страницы стартуют одновременно с одинаковой задержкой — плейбук раздел 7
называет это «everything-at-once group entrances where a 30–80ms stagger belongs».

## Target

Оба списка получают классы каскада по индексу. Индексов шесть, элементов может быть больше —
после шестого задержка перестаёт расти (`Math.min`), иначе последние карточки ждали бы
секунду и больше, а это уже блокировало бы восприятие.

```tsx
/* target — components/topic-answer-manager.tsx */
        {currentPageItems.map((item, index) => {
          const cardStatus = getCardStatus(item);

          return (
            <article
              key={item.id}
              className={cx(
                "topic-answer-card ui-fade-slide ui-panel-soft min-w-0 rounded-[16px] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-4.5",
                `ui-stagger-${Math.min(index + 1, 6)}`,
```

```tsx
/* target — components/group-members-manager.tsx */
          {members.map((member, index) => (
            <div
              key={member.id}
              className={cx("ui-fade-slide rounded-[16px] border px-5 py-4", `ui-stagger-${Math.min(index + 1, 6)}`)}
              style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
            >
```

### ВАЖНО: Tailwind не должен вырезать эти классы

Классы `ui-stagger-*` объявлены в `app/globals.css` вручную, а не генерируются Tailwind,
поэтому его очистка неиспользуемых классов на них не распространяется — шаблонная строка
`` `ui-stagger-${...}` `` безопасна. Проверять `safelist` не нужно.

## Repo conventions to follow

- Сборка className из нескольких кусков идёт через `cx(...)` из `@/lib/utils` — так уже
  сделано в `topic-answer-manager.tsx:625`. В `group-members-manager.tsx` сейчас простая
  строка, её нужно перевести на `cx`, добавив импорт, если его там нет.
- Проверить наличие импорта: `import { cx } from "@/lib/utils";` в начале
  `components/group-members-manager.tsx`. Если импорта нет — добавить его рядом с остальными
  импортами из `@/lib/...`, сохранив порядок.
- Каскад декоративен и не должен мешать: `animation-delay` не блокирует клики, элементы
  интерактивны с первого кадра (`both` заполняет только визуальные свойства).

## Steps

1. `components/topic-answer-manager.tsx`: добавить параметр `index` в колбэк `.map(...)`
   на строке 619, затем добавить `` `ui-stagger-${Math.min(index + 1, 6)}` `` вторым
   аргументом в существующий вызов `cx(...)` — после строки с базовыми классами и перед
   тернарником про `initialNumber`.
2. `components/group-members-manager.tsx`: проверить импорт `cx`; добавить, если отсутствует.
3. `components/group-members-manager.tsx`: добавить параметр `index` в `.map(...)` на
   строке 112 и заменить строковый `className` на вызов `cx(...)` по образцу из Target.
4. Проверить: `grep -ro "ui-stagger" app components --include="*.tsx" | wc -l` — больше нуля.

## Boundaries

- НЕ удалять классы `.ui-stagger-*` из CSS — этот план их, наоборот, оживляет.
- НЕ трогать мёртвые `.mobile-overlay` / `.mobile-panel` (`app/globals.css:1615`, `:1618`) —
  у них 0 использований, но они относятся к мобильному меню и решаются отдельно; удаление
  чужого мёртвого кода в этот план не входит.
- НЕ добавлять каскад в другие списки: в длинных списках номеров и в виртуализированном
  списке ученика задержка навредит — там элементов сотни.
- НЕ менять `key`, порядок элементов, логику пагинации и `getCardStatus`.
- НЕ увеличивать шаг задержки и НЕ добавлять `ui-stagger-7` и далее.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npx tsc --noEmit -p tsconfig.json` — чисто.
  - `grep -ro "ui-stagger" app components --include="*.tsx" | wc -l` — не менее 2.
- **Feel check**: `npm run dev`, войти преподавателем или разработчиком:
  - Открыть страницу ответов темы (`topic-answer-manager`) — карточки должны появляться
    волной слева направо и сверху вниз, а не все разом. Волна должна закончиться примерно
    за 0.5 секунды: шестая карточка стартует на 250 мс, анимация идёт 250 мс.
  - Переключить страницу пагинации — каскад должен проиграть заново.
  - **Проверка на «не мешает»:** сразу после перехода на страницу, не дожидаясь конца
    каскада, кликнуть по ещё появляющейся карточке. Клик обязан сработать. Если нет —
    каскад блокирует взаимодействие, и это ошибка.
  - Открыть группу с участниками (`group-members-manager`) — та же волна на списке.
  - Открыть список из 10+ карточек: с седьмой и далее задержка расти не должна, они
    появляются вместе с шестой.
  - DevTools → Rendering → `prefers-reduced-motion: reduce`: `.ui-fade-slide` подменяется
    на проявление без сдвига (правило на `app/globals.css:1532`), задержки при этом
    сохраняются — это допустимо, движения нет.
- **Done when**: обе группы появляются волной; клики во время анимации работают; после
  шестого элемента задержка не растёт; lint и tsc чисты.
