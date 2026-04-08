"use client";

import { useCallback, useRef, useState } from "react";

type CsvImportButtonProps = {
  studentId: string;
};

type ImportResult = {
  success: boolean;
  imported: number;
  skipped: number;
  total: number;
  errors?: string[];
  error?: string;
};

export function CsvImportButton({ studentId }: CsvImportButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];

      if (!file) {
        return;
      }

      setIsUploading(true);
      setResult(null);

      try {
        const formData = new FormData();
        formData.append("studentId", studentId);
        formData.append("file", file);

        const response = await fetch("/api/teacher/student-import-csv", {
          method: "POST",
          body: formData
        });

        const data: ImportResult = await response.json();

        if (!response.ok) {
          setResult({ success: false, imported: 0, skipped: 0, total: 0, error: data.error ?? "Ошибка импорта." });
        } else {
          setResult(data);
        }
      } catch {
        setResult({ success: false, imported: 0, skipped: 0, total: 0, error: "Не удалось отправить файл." });
      } finally {
        setIsUploading(false);

        if (fileRef.current) {
          fileRef.current.value = "";
        }
      }
    },
    [studentId]
  );

  const handleClick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const handleDismiss = useCallback(() => {
    setResult(null);
  }, []);

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.tsv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      <button
        type="button"
        disabled={isUploading}
        onClick={handleClick}
        className="ui-pressable ui-button-secondary inline-flex w-full justify-center rounded-[14px] px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50"
      >
        {isUploading ? "Импорт..." : "Импорт прогресса CSV"}
      </button>

      {result ? (
        <div
          className={
            result.success && result.imported > 0
              ? "ui-notice-success rounded-[12px] px-3.5 py-2.5 text-sm"
              : "ui-notice-error rounded-[12px] px-3.5 py-2.5 text-sm"
          }
        >
          {result.error ? (
            <p>{result.error}</p>
          ) : (
            <div className="space-y-1">
              <p>
                Импортировано: <strong>{result.imported}</strong> из {result.total}
                {result.skipped > 0 ? `, пропущено: ${result.skipped}` : ""}
              </p>
              {result.errors?.map((err, i) => (
                <p key={i} className="text-xs opacity-80">{err}</p>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="mt-1.5 text-xs font-medium underline underline-offset-2 opacity-70 hover:opacity-100"
          >
            Скрыть
          </button>
        </div>
      ) : null}
    </div>
  );
}
