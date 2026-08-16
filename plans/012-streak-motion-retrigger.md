# 012 — Починить повторный запуск анимации streak

- **Status**: DONE
- **Commit**: 45a1739
- **Severity**: LOW
- **Category**: 4 (Interruptibility)
- **Estimated scope**: 1 файл (`components/use-streak-motion.ts`), ~8 строк

## Problem

```ts
/* components/use-streak-motion.ts:11-32 — текущее */
  useEffect(() => {
    const previousStreak = previousStreakRef.current;

    if (currentStreak === previousStreak) {
      return;
    }

    const nextMotionState: StudentStreakMotionState =
      previousStreak === 0 && currentStreak > 0 ? "ignite" : currentStreak > previousStreak ? "grow" : "drop";

    previousStreakRef.current = currentStreak;
    setMotionState(nextMotionState);

    const timeout = window.setTimeout(() => {
      setMotionState(null);
    }, 900);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [currentStreak]);
```

Значение `motionState` попадает в разметку как атрибут `data-animate`, а CSS вешает на него
`@keyframes` (`app/globals.css:1099-1114`). Анимация в CSS перезапускается только тогда,
когда меняется **значение** атрибута.

Отсюда две поломки:

1. **Два изменения в одну сторону подряд.** Streak вырос дважды за время меньше 900 мс:
   первый раз `motionState` стал `"grow"`, второй раз он ставится в `"grow"` снова —
   значение то же, React не перерисовывает атрибут, CSS ничего не замечает.
   **Вторая анимация не играет вообще.**
2. **Смена направления на полпути.** `"grow"` → `"drop"` меняет значение, и keyframes
   стартуют с нулевого кадра, а не доигрывают из текущего положения — виден скачок.

Плейбук ([AUDIT.md](../.claude/skills/improve-animations/AUDIT.md)) раздел 4: всё, что
может быть перезапущено быстро или развёрнуто на середине, должно строиться на переходах
или пружинах, потому что `@keyframes` всегда начинают с нуля.

**Честная оценка масштаба:** streak меняется примерно раз в сутки, так что в реальной жизни
это почти не воспроизводится. Важность LOW. Полный перевод streak-анимаций с keyframes на
переходы — большая переделка ради редкого случая; этот план чинит только более грубую из
двух поломок — молчаливо пропущенную анимацию.

## Target

Перед установкой нового состояния сбросить его в `null` и выставить значение на следующем
кадре. Атрибут `data-animate` при этом исчезает и появляется заново, и CSS перезапускает
анимацию даже при том же значении.

```ts
/* target — components/use-streak-motion.ts, тело useEffect */
  useEffect(() => {
    const previousStreak = previousStreakRef.current;

    if (currentStreak === previousStreak) {
      return;
    }

    const nextMotionState: StudentStreakMotionState =
      previousStreak === 0 && currentStreak > 0 ? "ignite" : currentStreak > previousStreak ? "grow" : "drop";

    previousStreakRef.current = currentStreak;

    // Сброс в null и установка на следующем кадре: без снятия атрибута CSS не перезапустит
    // keyframes, если новое значение совпало с предыдущим (две прибавки подряд).
    setMotionState(null);

    let timeout = 0;
    const frame = window.requestAnimationFrame(() => {
      setMotionState(nextMotionState);
      timeout = window.setTimeout(() => {
        setMotionState(null);
      }, 900);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [currentStreak]);
```

Сигнатура хука и тип `StudentStreakMotionState` не меняются — компоненты, которые его
используют, править не нужно.

Обратите внимание на очистку: `timeout` объявлен через `let` и обнулён, потому что
устанавливается уже внутри колбэка `requestAnimationFrame`. `window.clearTimeout(0)`
безопасен и ничего не делает, поэтому дополнительная проверка не нужна.

## Repo conventions to follow

- Файл использует браузерные API с префиксом `window.` (`window.setTimeout`,
  `window.clearTimeout`) — сохранить этот стиль и для `requestAnimationFrame`.
- Комментарии в коде проекта — на русском, объясняют «почему», а не «что»; образец —
  комментарий в `components/password-suggest-menu.tsx:102`
  (`// preventDefault: клик по меню не должен уводить фокус из поля пароля.`).
- Файл помечен `"use client"` — оставить директиву на месте.

## Steps

1. `components/use-streak-motion.ts`: заменить тело `useEffect` (строки 11–32) на вариант
   из раздела Target.
2. Ничего больше в файле не менять: ни экспортируемый тип, ни сигнатуру `useStreakMotion`,
   ни `previousStreakRef`.

## Boundaries

- НЕ переводить streak-анимации с `@keyframes` на переходы — это большая переделка CSS,
  в объём плана она не входит.
- НЕ трогать `app/globals.css` вообще.
- НЕ менять длительность 900 мс: она подобрана под самые длинные keyframes
  (`streak-pill-ignite` — 980 мс, `streak-flame-flicker` — 900 мс) и не должна расходиться.
- НЕ менять логику выбора `ignite` / `grow` / `drop`.
- НЕ трогать `lib/student-streak-realtime.ts` и компоненты, вызывающие хук.
- НЕ добавлять зависимости.
- Если найденный код не совпадает с приведённым выше (дрейф относительно `45a1739`) —
  ОСТАНОВИТЬСЯ и сообщить.

## Verification

- **Механически**:
  - `npm run lint` — без предупреждений.
  - `npx tsc --noEmit -p tsconfig.json` — чисто.
- **Feel check**: настоящую смену streak воспроизвести трудно, поэтому проверять через
  React DevTools:
  - `npm run dev`, войти учеником, открыть страницу с плашкой streak.
  - React DevTools → найти компонент с хуком → подменить значение `currentStreak`
    (например 3 → 4). Плашка должна анимироваться.
  - **Главная проверка:** сразу же, не дожидаясь 900 мс, подменить ещё раз в ту же сторону
    (4 → 5). Анимация обязана проиграть **второй раз**. До правки второй запуск молча
    пропускался.
  - Подменить в обратную сторону (5 → 4) — должна отработать анимация `drop`.
  - Убедиться, что после каждой анимации атрибут `data-animate` в инспекторе исчезает
    примерно через 900 мс, а не залипает.
  - Быстро уйти со страницы во время анимации — в консоли не должно появиться
    предупреждений React об обновлении состояния размонтированного компонента.
- **Done when**: две прибавки подряд дают две анимации; атрибут снимается; предупреждений
  в консоли нет; lint и tsc чисты.
