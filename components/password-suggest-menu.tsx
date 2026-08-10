"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/*
 * Всплывающее меню с предложенным паролем: открывается над полем пароля
 * (как выпадашка ShbzSelect, только вверх) и подставляет пароль по клику.
 * Внутри поля ничего не рисуем — меню живёт в портале, поэтому не растягивает
 * колонку формы и не съезжает вместе с ней.
 */

type PasswordSuggestMenuProps = {
  anchorRef: React.RefObject<HTMLInputElement | null>;
  suggestion: string;
  onPick: (password: string) => void;
  onAnother: () => void;
  onClose: () => void;
};

type MenuPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
};

// Высота меню фиксирована по вёрстке — хватает, чтобы решить, поместится ли оно сверху.
const MENU_HEIGHT = 132;

export function PasswordSuggestMenu({ anchorRef, suggestion, onPick, onAnother, onClose }: PasswordSuggestMenuProps) {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;

    if (!anchor) {
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.max(rect.width, 240);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, viewportWidth - width - 8));
    // Открываем вверх; если сверху не помещается — падаем вниз, чтобы меню не ушло за экран.
    const openUp = rect.top >= MENU_HEIGHT + 16;

    setPosition({
      top: openUp ? undefined : rect.bottom + 8,
      bottom: openUp ? viewportHeight - rect.top + 8 : undefined,
      left,
      width
    });
  }, [anchorRef]);

  useEffect(() => {
    updatePosition();

    const onDocumentPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      if (!target || anchorRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  }, [anchorRef, onClose, updatePosition]);

  if (!position) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      data-shbz-portal=""
      role="dialog"
      aria-label="Предложенный пароль"
      // preventDefault: клик по меню не должен уводить фокус из поля пароля.
      onMouseDown={(event) => event.preventDefault()}
      className="fixed rounded-[12px] border p-1.5"
      style={{
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        zIndex: 1000,
        background: "var(--shbz-card-bg)",
        borderColor: "var(--shbz-card-border)",
        boxShadow: "0 4px 10px rgba(10,10,10,0.06), 0 20px 48px rgba(10,10,10,0.18)"
      }}
    >
      <p className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.04em]" style={{ color: "var(--shbz-kicker)" }}>
        Предлагаем пароль
      </p>

      <button
        type="button"
        onClick={() => onPick(suggestion)}
        className="block w-full rounded-[12px] px-2.5 py-2 text-left transition-colors"
        style={{ background: "transparent" }}
        onMouseEnter={(event) => {
          event.currentTarget.style.background = "var(--shbz-tab-hover)";
        }}
        onMouseLeave={(event) => {
          event.currentTarget.style.background = "transparent";
        }}
      >
        <span className="block text-[16px] font-semibold" style={{ color: "var(--shbz-text-strong)" }}>
          {suggestion}
        </span>
        <span className="mt-0.5 block text-[12px] font-medium" style={{ color: "var(--shbz-kicker)" }}>
          Нажмите, чтобы подставить
        </span>
      </button>

      <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-1">
        <button
          type="button"
          onClick={onAnother}
          className="text-[12.5px] font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--shbz-accent-solid)" }}
        >
          Другой вариант
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-[12.5px] font-semibold underline-offset-2 hover:underline"
          style={{ color: "var(--shbz-kicker)" }}
        >
          Ввести свой
        </button>
      </div>
    </div>,
    document.body
  );
}
