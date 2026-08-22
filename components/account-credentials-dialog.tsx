"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Всплывающее окно после создания аккаунта: логин и пароль показываются один
 * раз, отсюда их удобно скопировать и передать ученику или учителю. После
 * закрытия пароль больше нигде не показывается (в базе только хэш).
 *
 * Данные показаны готовым сообщением: на экране ровно тот текст, который уйдёт
 * в буфер, — строки и для показа, и для копирования собираются из одного списка,
 * поэтому разойтись не могут.
 */

type AccountCredentialsDialogProps = {
  title: string;
  name: string;
  login: string;
  password: string;
  onClose: () => void;
};

export function AccountCredentialsDialog({ title, name, login, password, onClose }: AccountCredentialsDialogProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  // Адрес сайта известен только в браузере — берём после монтирования.
  const [siteHost, setSiteHost] = useState("");

  useEffect(() => {
    setSiteHost(window.location.host);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", onEscape);

    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  const lines = useMemo(
    () => [
      { label: "Сайт", value: siteHost },
      { label: "Логин", value: login },
      { label: "Пароль", value: password }
    ],
    [login, password, siteHost]
  );

  const messageText = lines.map((line) => `${line.label}: ${line.value}`).join("\n");

  const copyMessage = () => {
    navigator.clipboard
      .writeText(messageText)
      .then(() => setFeedback("Скопировано — можно вставлять в мессенджер."))
      .catch(() => setFeedback("Не удалось скопировать — выделите текст вручную."));
  };

  return createPortal(
    <div
      className="shbz-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="shbz-modal-card shbz-card max-h-[85vh] w-full max-w-md overflow-y-auto p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-3">
          <p className="text-xs font-bold uppercase tracking-[1.6px]" style={{ color: "var(--shbz-kicker)" }}>
            Аккаунт создан
          </p>
          <h3 className="text-2xl font-extrabold tracking-[-0.5px]" style={{ color: "var(--shbz-text-strong)" }}>
            {title}
          </h3>
          <p className="text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
            {name} уже может входить на платформу. Пароль показывается только сейчас — восстановить его позже нельзя,
            можно только задать новый.
          </p>
        </div>

        <p className="mt-5 text-[12px] font-bold uppercase tracking-[1px]" style={{ color: "var(--shbz-kicker)" }}>
          Сообщение для передачи
        </p>
        <div
          className="mt-2 whitespace-pre-wrap break-all rounded-[12px] border px-4 py-3.5 font-mono text-[14px] leading-[1.85]"
          style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)" }}
        >
          {lines.map((line, index) => (
            <span key={line.label}>
              <span style={{ color: "var(--shbz-kicker)" }}>{line.label}: </span>
              <span className="font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                {line.value}
              </span>
              {index < lines.length - 1 ? "\n" : null}
            </span>
          ))}
        </div>

        {feedback ? (
          <p className="mt-3 text-[13px] font-medium" style={{ color: "var(--shbz-green-text)" }} aria-live="polite">
            {feedback}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="shbz-btn-primary shbz-btn-primary--lg" onClick={copyMessage}>
            Скопировать
          </button>
          <button type="button" className="shbz-btn-outline shbz-btn-outline--lg" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
