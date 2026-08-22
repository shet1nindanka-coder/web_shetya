"use client";

/* ============================================================================
   animation-hooks.ts — хуки под пакет анимаций (см. конец app/globals.css).
   Взяты из handoff/animation-hooks.ts только нужные: A02, A04, A08, A09, A10.
   Отличия от пакета помечены комментариями «ШБЗ:».
   ============================================================================ */

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

/** Уважаем системную настройку — все хуки отдают конечное состояние сразу. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* ----------------------------------------------------------------------------
   A04 · Счётчик. Один rAF на число, easeOutCubic, 600 ms.
   ---------------------------------------------------------------------------- */
export function useCountUp(target: number, ms = 600, decimals = 0): number {
  // ШБЗ: стартуем с самого числа, а не с нуля — SSR-разметка и первый кадр
  // гидрации совпадают, счёт начинается только после монтирования.
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const factor = Math.pow(10, decimals);

    const step = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased * factor) / factor);
      if (p < 1) raf = requestAnimationFrame(step);
    };

    setValue(0);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, decimals]);

  return value;
}

/* ----------------------------------------------------------------------------
   A02 · Скользящая подложка таба.
   const { shellRef, indicatorProps } = useTabIndicator(activeIndex);
   <nav className="shbz-seg ui-tab-shell--live" ref={shellRef}>
     <span className="ui-tab-indicator" {...indicatorProps} />
     {tabs.map((t, i) => <button data-tab-index={i} …/>)}
   </nav>
   ШБЗ: помимо --tab-x/--tab-w выставляются --tab-y/--tab-h — сегменты
   переносятся на вторую строку на узких экранах.
   ШБЗ: activeIndex < 0 — «ничего не выбрано» (например, страница настроек,
   которой нет в таббаре): подложка гаснет на месте, а при возврате встаёт
   под вкладку без переезда и проявляется.
   ---------------------------------------------------------------------------- */
type TabIndicatorStyle = { "--tab-x": string; "--tab-y": string; "--tab-w": string; "--tab-h": string };

export function useTabIndicator<T extends HTMLElement = HTMLElement>(activeIndex: number) {
  const shellRef = useRef<T | null>(null);
  const [style, setStyle] = useState<TabIndicatorStyle>({
    "--tab-x": "0px",
    "--tab-y": "0px",
    "--tab-w": "0px",
    "--tab-h": "0px"
  });
  const [ready, setReady] = useState(false);
  // ШБЗ: из пустого состояния подложка не «едет» со старого места, а встаёт под
  // вкладку без перехода и затем проявляется (opacity через data-empty).
  const prevIndex = useRef(activeIndex);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const fromEmpty = prevIndex.current < 0 && activeIndex >= 0;
    prevIndex.current = activeIndex;
    if (activeIndex < 0) return; // размер и позицию не трогаем — просто гаснем на месте
    if (fromEmpty) setReady(false);

    const measure = () => {
      const tab = shell.querySelector<HTMLElement>(`[data-tab-index="${activeIndex}"]`);
      if (!tab) return;
      setStyle({
        "--tab-x": `${tab.offsetLeft}px`,
        "--tab-y": `${tab.offsetTop}px`,
        "--tab-w": `${tab.offsetWidth}px`,
        "--tab-h": `${tab.offsetHeight}px`
      });
      requestAnimationFrame(() => setReady(true));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, [activeIndex]);

  return {
    shellRef,
    indicatorProps: {
      style: style as CSSProperties,
      "data-ready": String(ready),
      "data-empty": String(activeIndex < 0),
      "aria-hidden": true as const
    }
  };
}

/* ----------------------------------------------------------------------------
   A10 · Realtime-подсветка. Помечаем только то, что пришло при активном экране.
   ---------------------------------------------------------------------------- */
export function useFreshMarks(ms = 1400) {
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const markFresh = useCallback(
    (id: string) => {
      if (prefersReducedMotion()) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      setFresh((prev) => new Set(prev).add(id));
      const t = window.setTimeout(() => {
        setFresh((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, ms);
      timers.current.push(t);
    },
    [ms]
  );

  const isFresh = useCallback((id: string) => fresh.has(id), [fresh]);

  return { isFresh, markFresh };
}

/* ----------------------------------------------------------------------------
   A10 · Pop счётчика уведомлений при росте.
   ---------------------------------------------------------------------------- */
export function useBump(value: number, ms = 260): boolean {
  const prev = useRef(value);
  const [bumped, setBumped] = useState(false);

  useEffect(() => {
    if (value > prev.current && !prefersReducedMotion()) {
      setBumped(true);
      const t = window.setTimeout(() => setBumped(false), ms);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, ms]);

  return bumped;
}

/* ----------------------------------------------------------------------------
   A09 · Закрытие диалога с анимацией выхода (120 ms десктоп / 160 ms лист) до
   размонтирования. Все пути закрытия (крестик, «Отмена», Esc, фон) идут через close.
   ШБЗ: длительность берётся по ширине экрана — на телефоне диалог выезжает листом.
   ---------------------------------------------------------------------------- */
export function useDialogExit(onClosed: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    []
  );

  const close = useCallback(() => {
    if (prefersReducedMotion() || closing) {
      if (!closing) onClosed();
      return;
    }
    const ms = window.matchMedia("(max-width: 640px)").matches ? 160 : 120;
    setClosing(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setClosing(false);
      onClosed();
    }, ms);
  }, [onClosed, closing]);

  return { closing, close };
}

/* ----------------------------------------------------------------------------
   A08 · Честный процент загрузки через XHR (fetch не отдаёт upload progress).
   ШБЗ: ошибка несёт тело ответа (responseText) — компонент показывает
   серверный текст ошибки, как делал раньше через fetch.
   ---------------------------------------------------------------------------- */
export type DropzoneState = "idle" | "over" | "uploading" | "done";

export class UploadError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    super(`upload failed: ${status}`);
    this.status = status;
    this.responseText = responseText;
  }
}

export function useUploadProgress() {
  const [state, setState] = useState<DropzoneState>("idle");
  const [pct, setPct] = useState(0);

  const upload = useCallback((url: string, form: FormData) => {
    return new Promise<string>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      setState("uploading");
      setPct(0);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setPct(100);
          setState("done");
          resolve(xhr.responseText);
        } else {
          setState("idle");
          reject(new UploadError(xhr.status, xhr.responseText));
        }
      };
      xhr.onerror = () => {
        setState("idle");
        reject(new UploadError(0, ""));
      };
      xhr.open("POST", url);
      xhr.send(form);
    });
  }, []);

  return { state, setState, pct, upload };
}

/* ----------------------------------------------------------------------------
   Копирование · вспышка строки. `copied` хранит id строки, а не булево — в
   списке подсвечивается ровно та строка, по которой кликнули.
   const { copied, copy } = useCopy();
   <div className="ui-copy-row" data-copied={String(copied === id)} onClick={() => copy(text, id)}>
     …<span className="ui-copy-pill">Скопировано</span>
   </div>
   ШБЗ: при отказе clipboard API (http, старый браузер) — fallback на textarea.
   ---------------------------------------------------------------------------- */
export function useCopy(ms = 1300) {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = useCallback(
    async (text: string, id = "default") => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          // буфер недоступен — состояние всё равно показываем, пользователь выделит вручную
        }
        document.body.removeChild(ta);
      }
      setCopied(id);
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(null), ms);
    },
    [ms]
  );

  return { copied, copy };
}
