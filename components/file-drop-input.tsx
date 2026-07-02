"use client";

import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";

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
    <div>
      <label htmlFor={inputId} className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
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

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="flex items-center justify-between gap-3.5 rounded-[14px] border py-[13px] pl-[18px] pr-3.5 transition-shadow"
        style={{
          background: "var(--shbz-soft-bg)",
          borderColor: isDragging ? "var(--shbz-accent-solid)" : "var(--shbz-soft-border)",
          boxShadow: isDragging ? "0 0 0 4px var(--shbz-input-ring)" : "none"
        }}
      >
        <span
          className="min-w-0 truncate text-sm"
          style={{ color: selectedFileName ? "var(--shbz-text-strong)" : "var(--shbz-text-soft)", fontWeight: selectedFileName ? 600 : 400 }}
          aria-live="polite"
        >
          {selectedFileName ?? "Файл пока не выбран"}
        </span>

        <button type="button" onClick={() => inputRef.current?.click()} className="shbz-btn-dark">
          {selectedFileName ? "Заменить файл" : "Выбрать файл"}
        </button>
      </div>

      <p id={helperId} className="ui-hint mt-2 text-[12.5px] leading-[1.5]" style={{ color: "var(--shbz-kicker)" }}>
        {helperText}
      </p>
    </div>
  );
}
