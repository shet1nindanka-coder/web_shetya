"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { ConfirmDialog } from "@/components/confirm-dialog";

/*
 * Кнопка сохранения темы с предпросмотром разрушающей правки поля «Номера».
 *
 * До этого форма сохранялась молча, а всё, чего нет в новом списке, удалялось
 * каскадом вместе с прогрессом, заметками и дедлайнами всех учеников, LaTeX,
 * вердиктами ИИ и пунктами уроков (PROD-002). Теперь перед сохранением
 * спрашиваем сервер, что именно исчезнет, и показываем это списком.
 *
 * Настоящая защита — серверная: `updateTopicAction` пересчитывает план заново и
 * без подтверждения не сохраняет. Поэтому если предпросмотр не ответил (сеть),
 * форму всё равно отправляем: безопасную правку сервер примет, разрушающую —
 * отклонит с понятной ошибкой.
 */

type RemovedNumber = {
  number: string;
  summary: string;
  hasStudentWork: boolean;
  isAssigned: boolean;
};

type PreviewResponse = {
  keptCount: number;
  added: string[];
  requiresConfirmation: boolean;
  requiresAssignedConfirmation: boolean;
  removed: RemovedNumber[];
  error?: string;
};

export function TopicEditSubmitButton({ topicId }: { topicId: string }) {
  const { pending } = useFormStatus();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const allowAssignedRef = useRef<HTMLInputElement>(null);
  const [plan, setPlan] = useState<PreviewResponse | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [allowAssigned, setAllowAssigned] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isBusy = pending || isChecking;

  const submitForm = (confirmedNumbers: string[], assignedAllowed: boolean) => {
    const form = buttonRef.current?.form;

    if (!form) {
      return;
    }

    if (confirmRef.current) {
      confirmRef.current.value = confirmedNumbers.join(", ");
    }

    if (allowAssignedRef.current) {
      allowAssignedRef.current.value = assignedAllowed ? "1" : "";
    }

    form.requestSubmit();
  };

  const handleClick = async () => {
    const form = buttonRef.current?.form;

    if (!form || isBusy) {
      return;
    }

    // Пусть браузер сначала проверит обязательные поля — иначе предпросмотр
    // сработает на форме, которую всё равно не отправят.
    if (!form.reportValidity()) {
      return;
    }

    const numbersValue = String(new FormData(form).get("numbers") ?? "");

    setError(null);
    setIsChecking(true);

    try {
      const response = await fetch("/api/teacher/topic-numbers-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, numbers: numbersValue })
      });
      const result = (await response.json().catch(() => null)) as PreviewResponse | null;

      if (!response.ok || !result) {
        setError(result?.error ?? "Не удалось проверить изменения. Сохраняем как есть.");
        submitForm([], false);
        return;
      }

      if (!result.requiresConfirmation) {
        submitForm([], false);
        return;
      }

      setAllowAssigned(false);
      setPlan(result);
    } catch {
      setError("Не удалось проверить изменения. Сохраняем как есть.");
      submitForm([], false);
    } finally {
      setIsChecking(false);
    }
  };

  const dangerousNumbers = (plan?.removed ?? []).filter((entry) => entry.hasStudentWork);
  const assignedNumbers = (plan?.removed ?? []).filter((entry) => entry.isAssigned);
  const canConfirm = !plan?.requiresAssignedConfirmation || allowAssigned;

  return (
    <div className="space-y-2">
      <input ref={confirmRef} type="hidden" name="confirmNumbersRemoval" defaultValue="" />
      <input ref={allowAssignedRef} type="hidden" name="allowAssignedRemoval" defaultValue="" />

      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        disabled={isBusy}
        className="ui-pressable ui-button-primary rounded-2xl px-5 py-3 text-sm font-semibold transition"
      >
        {pending ? "Сохраняем изменения..." : isChecking ? "Проверяем изменения..." : "Сохранить изменения"}
      </button>

      <p aria-live="polite" className="ui-hint min-h-[1.25rem] text-sm text-[var(--theme-text-muted)]">
        {pending ? "Файлы и номера обновляются. Не закрывайте страницу." : (error ?? "")}
      </p>

      <ConfirmDialog
        open={plan !== null}
        title="Из темы исчезнут номера с работой учеников"
        description={
          <div className="space-y-3 text-sm">
            <p>
              Эти номера пропадут из темы, а вместе с ними — всё, что к ним привязано. Восстановить будет нечем.
            </p>

            <ul className="space-y-1.5">
              {dangerousNumbers.map((entry) => (
                <li key={entry.number}>
                  <span className="font-semibold">№ {entry.number}</span> — {entry.summary}
                </li>
              ))}
            </ul>

            {plan && plan.added.length > 0 ? <p>Появятся новые номера: {plan.added.join(", ")}.</p> : null}
            {plan ? <p>Останется без изменений: {plan.keptCount}.</p> : null}

            {plan?.requiresAssignedConfirmation ? (
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={allowAssigned}
                  onChange={(event) => setAllowAssigned(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  Понимаю, что {assignedNumbers.map((entry) => `№ ${entry.number}`).join(", ")} сейчас в активных ДЗ —
                  задание у ученика станет короче, и он об этом не узнает.
                </span>
              </label>
            ) : null}
          </div>
        }
        confirmLabel="Да, удалить эти номера"
        pendingLabel="Сохраняем..."
        isPending={pending}
        confirmDisabled={!canConfirm}
        wide
        onConfirm={() => {
          if (!plan || !canConfirm) {
            return;
          }

          const confirmed = dangerousNumbers.map((entry) => entry.number);

          setPlan(null);
          submitForm(confirmed, allowAssigned);
        }}
        onCancel={() => {
          if (!pending) {
            setPlan(null);
          }
        }}
      />
    </div>
  );
}
