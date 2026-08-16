"use client";

import { useEffect, useImperativeHandle, useRef, useState, type DragEvent, type ReactNode, type Ref } from "react";
import { cx } from "@/lib/utils";

/** Визуальная фаза дропзоны. Hover — четвёртое состояние, живёт в чистом CSS (:hover). */
type DropzonePhase = "idle" | "drag" | "success";

export type AnimatedDropzoneHandle = {
  /** Проиграть подтверждение вручную — когда файл выбран кликом, а не дропом. */
  confirm: () => void;
};

type AnimatedDropzoneProps = {
  /** Заголовок в спокойном состоянии (имя файла, лимит, приглашение). */
  title: ReactNode;
  /** Заголовок, пока файл держат над зоной («Отпустите файлы»). */
  dragTitle: string;
  /** Заголовок короткого подтверждения после drop («Файлы добавлены»). */
  successTitle: string;
  /** Иконка внутри зелёной плитки (стрелка загрузки). */
  icon: ReactNode;
  /** Подстрока под заголовком. */
  subtitle?: ReactNode;
  /** Блокирует реакции на drag и вызов onDropFiles (лимит, идёт загрузка). */
  disabled?: boolean;
  /** Обработка брошенных файлов; вызывается сразу — анимация её не задерживает. */
  onDropFiles: (files: FileList) => void;
  /** Классы раскладки конкретной дропзоны (отступы, gap, cursor). */
  className?: string;
  /** Скрытый file-input. */
  children?: ReactNode;
  /** Доступ к confirm() для подтверждения выбора через диалог файлов. */
  ref?: Ref<AnimatedDropzoneHandle>;
};

/** Сколько держится подтверждение: провал иконки (~320 мс) + галочка, затем возврат в idle. */
const SUCCESS_HOLD_MS = 900;

/**
 * Общая оболочка дропзоны с централизованной машиной состояний idle → drag → success.
 * Все переходы описаны в globals.css через data-state; независимых анимаций у
 * потребителей быть не должно. Счётчик dragenter/dragleave не даёт зоне мигать,
 * когда курсор проходит над иконкой или текстом.
 */
export function AnimatedDropzone({
  title,
  dragTitle,
  successTitle,
  icon,
  subtitle,
  disabled,
  onDropFiles,
  className,
  children,
  ref
}: AnimatedDropzoneProps) {
  const [phase, setPhase] = useState<DropzonePhase>("idle");
  const dragDepth = useRef(0);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (successTimer.current) {
        clearTimeout(successTimer.current);
      }
    };
  }, []);

  const clearSuccessTimer = () => {
    if (successTimer.current) {
      clearTimeout(successTimer.current);
      successTimer.current = null;
    }
  };

  // Подтверждение одинаковое для дропа и выбора кликом: анимация должна быть всегда.
  const celebrate = () => {
    clearSuccessTimer();
    dragDepth.current = 0;
    setPhase("success");
    successTimer.current = setTimeout(() => setPhase("idle"), SUCCESS_HOLD_MS);
  };

  useImperativeHandle(ref, () => ({ confirm: celebrate }));

  const handleDragEnter = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    dragDepth.current += 1;
    clearSuccessTimer();
    setPhase("drag");
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    // Только preventDefault: состояние выставлено в dragenter,
    // перезапускать анимацию на каждый dragover нельзя.
    event.preventDefault();
  };

  const handleDragLeave = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();

    if (disabled) {
      return;
    }

    dragDepth.current = Math.max(0, dragDepth.current - 1);

    if (dragDepth.current === 0) {
      setPhase("idle");
    }
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    dragDepth.current = 0;

    if (disabled) {
      setPhase("idle");
      return;
    }

    // Сначала обработка файлов, потом визуальное подтверждение.
    onDropFiles(event.dataTransfer.files);
    celebrate();
  };

  return (
    <label
      data-state={phase}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cx("shbz-dropzone", !disabled && "shbz-dropzone--enabled", className)}
    >
      {children}

      {/* Бегущий пунктир по периметру в состоянии drag */}
      <svg className="shbz-dropzone-ants" aria-hidden="true">
        <rect />
      </svg>

      <span
        className="shbz-dropzone-icon inline-flex h-11 w-11 items-center justify-center rounded-[12px]"
        style={{ background: "var(--shbz-green-soft)", color: "var(--shbz-green-text)" }}
        aria-hidden="true"
      >
        <span className="shbz-dropzone-icon-main inline-flex">{icon}</span>
        <svg
          className="shbz-dropzone-check"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M5 13l4 4 10-10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <span
        className="shbz-dropzone-titles text-[14.5px] font-bold"
        style={{ color: "var(--shbz-text-strong)" }}
        aria-live="polite"
      >
        <span className="shbz-dropzone-title shbz-dropzone-title--idle" aria-hidden={phase !== "idle"}>
          {title}
        </span>
        <span className="shbz-dropzone-title shbz-dropzone-title--drag" aria-hidden={phase !== "drag"}>
          {dragTitle}
        </span>
        <span className="shbz-dropzone-title shbz-dropzone-title--success" aria-hidden={phase !== "success"}>
          {successTitle}
        </span>
      </span>

      {subtitle}
    </label>
  );
}
