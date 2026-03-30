"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/badge";
import { cx, parseNumbersInput } from "@/lib/utils";

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
  description = "Можно вводить через запятую, пробел, перенос строки или диапазоном через тире. Дубликаты будут убраны автоматически.",
  placeholder = "1-5, 8, 12-14",
  rows = 5,
  value,
  initialValue = "",
  onValueChange
}: TopicNumbersFieldProps) {
  const [internalValue, setInternalValue] = useState(initialValue);
  const resolvedValue = value ?? internalValue;
  const parsedNumbers = useMemo(() => parseNumbersInput(resolvedValue), [resolvedValue]);
  const normalizedRanges = useMemo(() => compressNumbersToRanges(parsedNumbers), [parsedNumbers]);
  const hasInput = resolvedValue.trim().length > 0;
  const hasParsedNumbers = parsedNumbers.length > 0;

  const handleChange = (nextValue: string) => {
    if (value === undefined) {
      setInternalValue(nextValue);
    }

    onValueChange?.(nextValue);
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <textarea
          name={name}
          value={resolvedValue}
          onChange={(event) => handleChange(event.target.value)}
          rows={rows}
          placeholder={placeholder}
          className={cx(
            "w-full rounded-2xl border bg-slate-50 px-4 py-3 outline-none transition focus:-translate-y-[1px] focus:border-brand-400 focus:bg-white",
            hasInput && !hasParsedNumbers ? "border-rose-300 bg-rose-50/60" : "border-slate-200"
          )}
          required
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge className="border-slate-200 bg-white text-slate-700">
          {hasParsedNumbers ? pluralizeNumbers(parsedNumbers.length) : "Пока нет номеров"}
        </Badge>
        {hasParsedNumbers ? (
          <Badge className="border-slate-200 bg-white text-slate-700">
            {`Диапазон ${parsedNumbers[0]}-${parsedNumbers[parsedNumbers.length - 1]}`}
          </Badge>
        ) : null}
      </div>

      <div
        className={cx(
          "rounded-2xl border px-4 py-4 text-sm leading-6",
          hasInput && !hasParsedNumbers
            ? "border-rose-200 bg-rose-50 text-rose-900"
            : "border-slate-200 bg-slate-50/80 text-slate-600"
        )}
      >
        {hasInput && !hasParsedNumbers ? (
          <p>Не удалось распознать номера. Используйте числа и диапазоны вроде `1-5`.</p>
        ) : (
          <div className="space-y-2">
            <p>{description}</p>
            {hasParsedNumbers ? (
              <p className="text-slate-700">
                Будет сохранено как: <span className="font-medium">{truncatePreview(normalizedRanges)}</span>
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
