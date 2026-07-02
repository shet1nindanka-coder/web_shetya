"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { parseNumbersInput } from "@/lib/utils";

type TopicNumbersFieldProps = {
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  rows?: number;
  value?: string;
  initialValue?: string;
  onValueChange?: (value: string) => void;
};

function pluralizeNumbers(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) {
    return `${count} номер`;
  }

  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} номера`;
  }

  return `${count} номеров`;
}

function compressNumbersToRanges(numbers: number[]) {
  if (numbers.length === 0) {
    return "";
  }

  const segments: string[] = [];
  let rangeStart = numbers[0]!;
  let rangeEnd = numbers[0]!;

  for (const currentNumber of numbers.slice(1)) {
    if (currentNumber === rangeEnd + 1) {
      rangeEnd = currentNumber;
      continue;
    }

    segments.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);
    rangeStart = currentNumber;
    rangeEnd = currentNumber;
  }

  segments.push(rangeStart === rangeEnd ? String(rangeStart) : `${rangeStart}-${rangeEnd}`);

  return segments.join(", ");
}

function truncatePreview(value: string, maxLength = 120) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}...`;
}

export function TopicNumbersField({
  name,
  label = "Номера заданий",
  description = "Запятая, пробел, новая строка или диапазон через тире.",
  placeholder = "1-5, 8, 12-14",
  rows = 4,
  value,
  initialValue = "",
  onValueChange
}: TopicNumbersFieldProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const resolvedValue = value ?? internalValue;
  const deferredValue = useDeferredValue(resolvedValue);
  const parsedNumbers = useMemo(() => parseNumbersInput(deferredValue), [deferredValue]);
  const normalizedRanges = useMemo(() => compressNumbersToRanges(parsedNumbers), [parsedNumbers]);
  const hasInput = resolvedValue.trim().length > 0;
  const hasParsedNumbers = parsedNumbers.length > 0;
  const isComputing = deferredValue !== resolvedValue;

  const handleChange = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  return (
    <div>
      <span className="mb-[9px] block text-[13px] font-semibold" style={{ color: "var(--shbz-label)" }}>
        {label}
      </span>
      <textarea
        name={name}
        value={resolvedValue}
        onChange={(event) => handleChange(event.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="shbz-textarea"
        style={
          hasInput && !hasParsedNumbers
            ? { borderColor: "var(--shbz-danger-outline)", background: "var(--shbz-red-soft)" }
            : undefined
        }
        required
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="shbz-badge-muted">
          {hasParsedNumbers ? pluralizeNumbers(parsedNumbers.length) : "Пока нет номеров"}
        </span>
        {hasParsedNumbers ? (
          <span className="shbz-badge-muted">
            {`Диапазон ${parsedNumbers[0]}-${parsedNumbers[parsedNumbers.length - 1]}`}
          </span>
        ) : null}
      </div>

      {isComputing || (hasInput && !hasParsedNumbers) ? (
        <div
          className={
            hasInput && !hasParsedNumbers && !isComputing
              ? "shbz-notice-error mt-3 px-4 py-3 text-sm"
              : "shbz-panel-soft mt-3 px-4 py-3 text-sm"
          }
          style={hasInput && !hasParsedNumbers && !isComputing ? undefined : { color: "var(--shbz-text-muted)" }}
        >
          {isComputing ? (
            <p>Обновляем список номеров...</p>
          ) : (
            <p>Не удалось распознать номера. Используйте числа и диапазоны вроде 1-5.</p>
          )}
        </div>
      ) : hasParsedNumbers ? (
        <div className="ui-hint shbz-panel-soft mt-3 px-4 py-3 text-sm leading-6" style={{ color: "var(--shbz-text-muted)" }}>
          <p>{description}</p>
          <p className="mt-1" style={{ color: "var(--shbz-label)" }}>
            Итоговый список: {truncatePreview(normalizedRanges)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
