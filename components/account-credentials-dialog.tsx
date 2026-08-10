"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

/*
 * Всплывающее окно после создания аккаунта: логин и пароль показываются один
 * раз, отсюда их удобно скопировать и передать ученику или учителю. После
 * закрытия пароль больше нигде не показывается (в базе только хэш).
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

  const copyText = (label: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setFeedback(label))
      .catch(() => setFeedback("Не удалось скопировать — выделите текст вручную."));
  };

  const copyAll = () => {
    copyText(
      "Данные для входа скопированы.",
      `Сайт: ${window.location.origin}\nЛогин: ${login}\nПароль: ${password}`
    );
  };

  const row = (label: string, value: string, copyLabel: string) => (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] px-4 py-3" style={{ background: "var(--shbz-soft-bg)" }}>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--shbz-kicker)" }}>
          {label}
        </div>
        <div className="mt-0.5 break-all font-mono text-[15px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
          {value}
        </div>
      </div>
      <button type="button" className="shbz-btn-outline" onClick={() => copyText(`${label} скопирован.`, value)}>
        Скопировать
      </button>
    </div>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="shbz-card w-full max-w-md max-h-[85vh] overflow-y-auto p-6"
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
            {name} уже может входить на платформу. Пароль показывается только сейчас — скопируйте и передайте
            данные, восстановить их позже нельзя (только задать новый пароль).
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {row("Логин", login, "Логин")}
          {row("Пароль", password, "Пароль")}
        </div>

        {feedback ? (
          <p className="mt-3 text-[13px] font-medium" style={{ color: "var(--shbz-green-text)" }} aria-live="polite">
            {feedback}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" className="shbz-btn-primary px-[26px] py-[13px] text-[15px]" onClick={copyAll}>
            Скопировать всё
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
