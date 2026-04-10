"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { cx } from "@/lib/utils";

type FileDropInputProps = {
  name: string;
  label: string;
  accept: string;
  helperText?: string;
  onFileSelect?: (file: File | null) => void;
};

export function FileDropInput({
  name,
  label,
  accept,
  helperText = "Перетащите файл сюда или нажмите, чтобы выбрать его вручную.",
  onFileSelect
}: FileDropInputProps) {
  const inputId = useId();
  const helperId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  const syncSelectedFile = (file: File | null) => {
    setSelectedFileName(file?.name ?? null);
    onFileSelect?.(file);
  };

  const updateInputFiles = (file: File | null) => {
    const input = inputRef.current;

    if (!input) {
      syncSelectedFile(file);
      return;
    }

    if (!file) {
      input.value = "";
      syncSelectedFile(null);
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    input.files = dataTransfer.files;
    syncSelectedFile(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    syncSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    updateInputFiles(event.dataTransfer.files?.[0] ?? null);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label htmlFor={inputId} className="ui-form-label">
          {label}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          onChange={handleInputChange}
          className="sr-only"
          aria-describedby={helperText ? helperId : undefined}
        />
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cx(
          "rounded-[20px] border border-dashed px-4 py-5 transition sm:px-5",
          isDragging
            ? "border-[var(--theme-accent-border)] bg-[var(--theme-accent-soft)] shadow-[0_14px_30px_rgba(59,130,246,0.12)]"
            : "ui-panel-soft"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--theme-text-strong)]" aria-live="polite">
              {selectedFileName ? selectedFileName : "Файл пока не выбран"}
            </p>
            <p id={helperId} className="ui-hint text-sm leading-6 text-[var(--theme-text-muted)]">
              {helperText}
            </p>
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="ui-pressable ui-button-primary inline-flex shrink-0 justify-center rounded-[14px] px-4 py-2 text-sm font-semibold transition"
          >
            {selectedFileName ? "Выбрать другой файл" : "Выбрать файл"}
          </button>
        </div>
      </div>
    </div>
  );
}
