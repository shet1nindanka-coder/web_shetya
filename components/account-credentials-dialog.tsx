"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useCopy, useDialogExit } from "@/lib/animation-hooks";
import { CopyIcon } from "@/components/copy-value";

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
  // Вспышка строки (см. .ui-copy-row): id — подпись строки либо "all" для всего сообщения.
  const { copied, copy } = useCopy();
  // Адрес сайта известен только в браузере — берём после монтирования.
  const [siteHost, setSiteHost] = useState("");
  const { closing, close } = useDialogExit(onClose);

  useEffect(() => {
    setSiteHost(window.location.host);
  }, []);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
      }
    };

    document.addEventListener("keydown", onEscape);

    return () => document.removeEventListener("keydown", onEscape);
  }, [close]);

  const lines = useMemo(
    () => [
      { label: "Сайт", value: siteHost },
      { label: "Логин", value: login },
      { label: "Пароль", value: password }
    ],
    [login, password, siteHost]
  );

  const messageText = lines.map((line) => `${line.label}: ${line.value}`).join("\n");

  const copyMessage = async () => {
    await copy(messageText, "all");
    setFeedback("Скопировано — можно вставлять в мессенджер.");
  };

  const copyLine = (label: string, value: string) => {
    void copy(value, label);
    setFeedback(`${label} скопирован — можно вставлять.`);
  };

  return createPortal(
    <div
      data-closing={String(closing)}
      className="shbz-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 py-6"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-closing={String(closing)}
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
          className="ui-copy-row mt-2 rounded-[12px] border px-2 py-1.5 font-mono text-[14px]"
          style={{ background: "var(--shbz-soft-bg)", borderColor: "var(--shbz-soft-border)", cursor: "default" }}
          data-copied={String(copied === "all")}
        >
          {lines.map((line) => (
            <div
              key={line.label}
              className="ui-copy-row flex items-center gap-2 px-2 py-1.5"
              data-copied={String(copied === line.label)}
              role="button"
              tabIndex={0}
              title={`Скопировать: ${line.label.toLowerCase()}`}
              onClick={() => copyLine(line.label, line.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  copyLine(line.label, line.value);
                }
              }}
            >
              <span className="min-w-0 break-all">
                <span style={{ color: "var(--shbz-kicker)" }}>{line.label}: </span>
                <span className="font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
                  {line.value}
                </span>
              </span>
              <CopyIcon className="ui-copy-icon ml-auto" />
              <span className="ui-copy-pill">Скопировано</span>
            </div>
          ))}
        </div>

        <span role="status" aria-live="polite" className="sr-only">
          {feedback ?? ""}
        </span>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="shbz-btn-primary shbz-btn-primary--lg ui-copy-target"
            data-copied={String(copied === "all")}
            onClick={() => void copyMessage()}
          >
            Скопировать
            <span className="ui-copy-pill">Скопировано</span>
          </button>
          <button type="button" className="shbz-btn-outline shbz-btn-outline--lg" onClick={close}>
            Готово
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
