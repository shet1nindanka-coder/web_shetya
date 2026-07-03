"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ShbzSelectOption = {
  value: string;
  label: string;
};

type ShbzSelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: ShbzSelectOption[];
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  size?: "md" | "sm" | "xs";
  className?: string;
  menuWidth?: number;
};

const SIZE_STYLES: Record<NonNullable<ShbzSelectProps["size"]>, { height: number; radius: number; fontSize: number; paddingX: number }> = {
  md: { height: 50, radius: 14, fontSize: 15, paddingX: 16 },
  sm: { height: 46, radius: 12, fontSize: 14, paddingX: 14 },
  xs: { height: 38, radius: 10, fontSize: 13, paddingX: 12 }
};

export function ShbzSelect({
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Выбрать",
  ariaLabel,
  size = "md",
  className,
  menuWidth
}: ShbzSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sizeStyle = SIZE_STYLES[size];
  const selectedOption = options.find((option) => option.value === value) ?? null;

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;

    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const width = Math.max(menuWidth ?? rect.width, 120);
    const viewportWidth = window.innerWidth;
    const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8));

    setMenuPosition({ top: rect.bottom + 6, left, width });
  }, [menuWidth]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updatePosition();

    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (!target) {
        return;
      }

      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const onReposition = () => updatePosition();

    document.addEventListener("mousedown", onDocumentPointerDown);
    document.addEventListener("keydown", onEscape);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("mousedown", onDocumentPointerDown);
      document.removeEventListener("keydown", onEscape);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 border-[1.5px] text-left font-semibold transition-[border-color,box-shadow] ${className ?? ""}`}
        style={{
          height: sizeStyle.height,
          borderRadius: sizeStyle.radius,
          fontSize: sizeStyle.fontSize,
          padding: `0 ${sizeStyle.paddingX}px`,
          background: "var(--shbz-input-bg)",
          borderColor: isOpen ? "var(--shbz-input-border-focus)" : "var(--shbz-input-border)",
          boxShadow: isOpen ? "0 0 0 4px var(--shbz-input-ring)" : "none",
          color: selectedOption ? "var(--shbz-text-strong)" : "var(--shbz-placeholder)",
          opacity: disabled ? 0.55 : 1,
          cursor: disabled ? "not-allowed" : "pointer"
        }}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--shbz-kicker)"
          strokeWidth="2.5"
          strokeLinecap="round"
          aria-hidden="true"
          className="shrink-0 transition-transform"
          style={{ transform: isOpen ? "rotate(180deg)" : "none" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {isOpen && menuPosition
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-shbz-portal=""
              className="fixed max-h-[300px] overflow-y-auto rounded-[14px] border p-1.5"
              style={{
                top: menuPosition.top,
                left: menuPosition.left,
                width: menuPosition.width,
                zIndex: 1000,
                background: "var(--shbz-card-bg)",
                borderColor: "var(--shbz-card-border)",
                boxShadow: "0 4px 10px rgba(10,10,10,0.06), 0 20px 48px rgba(10,10,10,0.18)"
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center justify-between gap-2.5 rounded-[10px] px-3 py-2.5 text-left font-semibold transition-colors"
                    style={{
                      fontSize: sizeStyle.fontSize,
                      background: isSelected ? "var(--theme-accent-soft)" : "transparent",
                      color: isSelected ? "var(--shbz-green-text)" : "var(--shbz-text-strong)"
                    }}
                    onMouseEnter={(event) => {
                      if (!isSelected) {
                        event.currentTarget.style.background = "var(--shbz-tab-hover)";
                      }
                    }}
                    onMouseLeave={(event) => {
                      if (!isSelected) {
                        event.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
