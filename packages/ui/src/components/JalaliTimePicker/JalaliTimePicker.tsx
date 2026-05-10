"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { toPersianDigits } from "@repo/digit-localization";

import { cn } from "../../utils/cn";
import styles from "./JalaliTimePicker.module.css";

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseHhmm(value: string | undefined): { h: number; m: number } | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number.parseInt(match[1] ?? "", 10);
  const m = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { h, m };
}

function formatHhmm(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}`;
}

export type JalaliTimePickerProps = {
  /** 24h `HH:MM` (English digits) — same shape as `<input type="time">` */
  value?: string;
  onChange: (hhmm: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Step (in minutes) for the minute column. Default 1. Common: 1, 5, 15, 30. */
  minuteStep?: number;
  className?: string;
  /** Persian labels (override if you need a different copy) */
  hourLabel?: string;
  minuteLabel?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  clearLabel?: string;
  openPickerAriaLabel?: string;
};

const DEFAULT_LABELS = {
  hour: "ساعت",
  minute: "دقیقه",
  confirm: "تایید",
  cancel: "لغو",
  clear: "پاک کردن",
  openPicker: "باز کردن انتخابگر زمان",
} as const;

export const JalaliTimePicker = forwardRef<HTMLInputElement, JalaliTimePickerProps>(
  function JalaliTimePicker(
    {
      value,
      onChange,
      onBlur,
      id,
      name,
      disabled,
      invalid,
      placeholder,
      minuteStep = 1,
      className,
      hourLabel = DEFAULT_LABELS.hour,
      minuteLabel = DEFAULT_LABELS.minute,
      confirmLabel = DEFAULT_LABELS.confirm,
      cancelLabel = DEFAULT_LABELS.cancel,
      clearLabel = DEFAULT_LABELS.clear,
      openPickerAriaLabel = DEFAULT_LABELS.openPicker,
    },
    ref,
  ) {
    const parsedValue = useMemo(() => parseHhmm(value), [value]);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<{ h: number; m: number }>(
      () => parsedValue ?? { h: 9, m: 0 },
    );

    const rootRef = useRef<HTMLDivElement>(null);
    const hourListRef = useRef<HTMLDivElement>(null);
    const minuteListRef = useRef<HTMLDivElement>(null);

    /** Snap minute value to the configured step grid. */
    const safeStep = Math.max(1, Math.floor(minuteStep));
    const minuteOptions = useMemo(() => {
      const out: number[] = [];
      for (let m = 0; m < 60; m += safeStep) out.push(m);
      return out;
    }, [safeStep]);
    const hourOptions = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);

    const snapMinute = useCallback(
      (m: number) => {
        if (safeStep === 1) return m;
        const idx = Math.round(m / safeStep);
        return Math.min(59, Math.max(0, idx * safeStep));
      },
      [safeStep],
    );

    /** Sync draft to the latest committed value whenever the popover opens. */
    useEffect(() => {
      if (!open) return;
      const next = parsedValue ?? { h: 9, m: 0 };
      setDraft({ h: next.h, m: snapMinute(next.m) });
    }, [open, parsedValue, snapMinute]);

    /**
     * Center the selected option inside its scrollable list — without scrolling the page.
     * `scrollIntoView` would also scroll ancestors/window; computing scrollTop manually keeps
     * the page anchored.
     */
    useLayoutEffect(() => {
      if (!open) return;
      const centerInContainer = (container: HTMLDivElement | null) => {
        if (!container) return;
        const selected = container.querySelector<HTMLButtonElement>(
          `.${styles.optionSelected}`,
        );
        if (!selected) return;
        const target =
          selected.offsetTop - container.clientHeight / 2 + selected.clientHeight / 2;
        container.scrollTop = Math.max(0, target);
      };
      centerInContainer(hourListRef.current);
      centerInContainer(minuteListRef.current);
    }, [open]);

    /** Outside click + Escape close. */
    useEffect(() => {
      if (!open) return;
      const onDocClick = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onDocClick);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDocClick);
        document.removeEventListener("keydown", onKey);
      };
    }, [open]);

    const display = parsedValue ? toPersianDigits(formatHhmm(parsedValue.h, parsedValue.m)) : "";

    const togglePopover = () => {
      if (disabled) return;
      setOpen((o) => !o);
    };

    const handleConfirm = () => {
      onChange(formatHhmm(draft.h, snapMinute(draft.m)));
      setOpen(false);
    };

    const handleCancel = () => {
      setOpen(false);
    };

    const handleClear = () => {
      onChange("");
      setOpen(false);
    };

    return (
      <div
        ref={rootRef}
        className={cn(styles.root, invalid && styles.rootInvalid, className)}
      >
        <div className={styles.fieldRow}>
          <input
            ref={ref}
            id={id}
            name={name}
            type="text"
            readOnly
            disabled={disabled}
            value={display}
            placeholder={placeholder}
            onClick={togglePopover}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                togglePopover();
              }
            }}
            onBlur={onBlur}
            className={styles.textInput}
            aria-invalid={invalid || undefined}
            aria-haspopup="dialog"
            aria-expanded={open}
            autoComplete="off"
            dir="rtl"
          />
          <button
            type="button"
            className={styles.iconBtn}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              togglePopover();
            }}
            aria-label={openPickerAriaLabel}
            aria-expanded={open}
          >
            <ClockGlyph />
          </button>
        </div>

        {open ? (
          <div className={styles.popover} role="dialog" aria-modal="false">
            <div className={styles.spinners} dir="ltr">
              <SpinnerColumn
                listRef={hourListRef}
                label={hourLabel}
                options={hourOptions}
                value={draft.h}
                onChange={(h) => setDraft((d) => ({ ...d, h }))}
              />
              <SpinnerColumn
                listRef={minuteListRef}
                label={minuteLabel}
                options={minuteOptions}
                value={snapMinute(draft.m)}
                onChange={(m) => setDraft((d) => ({ ...d, m }))}
              />
            </div>
            <div className={styles.actions}>
              {value ? (
                <button type="button" className={styles.btnDanger} onClick={handleClear}>
                  {clearLabel}
                </button>
              ) : null}
              <button type="button" className={styles.btnGhost} onClick={handleCancel}>
                {cancelLabel}
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleConfirm}>
                {confirmLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  },
);

function SpinnerColumn({
  listRef,
  label,
  options,
  value,
  onChange,
}: {
  listRef: React.RefObject<HTMLDivElement>;
  label: string;
  options: readonly number[];
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className={styles.column}>
      <span className={styles.columnLabel}>{label}</span>
      <div ref={listRef} className={styles.list} role="listbox" tabIndex={0}>
        {options.map((opt) => {
          const selected = opt === value;
          return (
            <button
              key={opt}
              type="button"
              role="option"
              aria-selected={selected}
              className={cn(styles.option, selected && styles.optionSelected)}
              onClick={() => onChange(opt)}
            >
              {toPersianDigits(pad2(opt))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ClockGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
