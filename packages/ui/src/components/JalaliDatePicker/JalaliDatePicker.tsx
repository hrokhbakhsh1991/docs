"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Calendar, DateObject } from "react-multi-date-picker";
import gregorian from "react-date-object/calendars/gregorian";
import gregorian_en from "react-date-object/locales/gregorian_en";
import persian from "react-date-object/calendars/persian";
import persian_fa from "react-date-object/locales/persian_fa";

import { cn } from "../../utils/cn";
import styles from "./JalaliDatePicker.module.css";

export type JalaliDatePickerProps = {
  /** Gregorian ISO date `YYYY-MM-DD` for API / forms */
  value?: string;
  onChange: (gregorianYmd: string) => void;
  onBlur?: () => void;
  id?: string;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** Min/max as Gregorian `YYYY-MM-DD` */
  minDate?: string;
  maxDate?: string;
  className?: string;
  /** Persian labels (override if a different copy is needed) */
  confirmLabel?: string;
  cancelLabel?: string;
  clearLabel?: string;
  openCalendarAriaLabel?: string;
};

const DEFAULT_LABELS = {
  confirm: "تایید",
  cancel: "لغو",
  clear: "پاک کردن",
  openCalendar: "باز کردن تقویم شمسی",
} as const;

function parseGregorianYmd(ymd: string | undefined): DateObject | undefined {
  if (ymd == null || ymd.trim() === "") return undefined;
  try {
    const d = new DateObject({
      date: ymd.trim(),
      format: "YYYY-MM-DD",
      calendar: gregorian,
      locale: gregorian_en,
    });
    if (!d.isValid) return undefined;
    return d.convert(persian, persian_fa);
  } catch {
    return undefined;
  }
}

function persianToGregorianYmd(date: DateObject): string {
  return date.convert(gregorian, gregorian_en).format("YYYY-MM-DD");
}

function persianDisplay(date: DateObject | undefined): string {
  if (!date) return "";
  return date.format("YYYY/MM/DD");
}

export const JalaliDatePicker = forwardRef<HTMLInputElement, JalaliDatePickerProps>(
  function JalaliDatePicker(
    {
      value,
      onChange,
      onBlur,
      id,
      name,
      disabled,
      invalid,
      placeholder,
      minDate,
      maxDate,
      className,
      confirmLabel = DEFAULT_LABELS.confirm,
      cancelLabel = DEFAULT_LABELS.cancel,
      clearLabel = DEFAULT_LABELS.clear,
      openCalendarAriaLabel = DEFAULT_LABELS.openCalendar,
    },
    ref,
  ) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState<DateObject | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const committedValue = useMemo(() => parseGregorianYmd(value), [value]);
    const minObj = useMemo(() => parseGregorianYmd(minDate), [minDate]);
    const maxObj = useMemo(() => parseGregorianYmd(maxDate), [maxDate]);

    /** Re-seed the draft whenever the popover opens, so cancel really cancels. */
    useEffect(() => {
      if (open) setDraft(committedValue ?? null);
    }, [open, committedValue]);

    /** Outside-click + Escape close (no commit). */
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

    const togglePopover = useCallback(() => {
      if (disabled) return;
      setOpen((o) => !o);
    }, [disabled]);

    const handleCalendarChange = useCallback((picked: DateObject | DateObject[] | null) => {
      if (picked == null) {
        setDraft(null);
        return;
      }
      const single = Array.isArray(picked) ? picked[0] ?? null : picked;
      if (!single || !(single instanceof DateObject) || !single.isValid) {
        setDraft(null);
        return;
      }
      setDraft(single);
    }, []);

    const handleConfirm = () => {
      if (draft && draft.isValid) {
        onChange(persianToGregorianYmd(draft));
      }
      setOpen(false);
    };

    const handleCancel = () => {
      setOpen(false);
    };

    const handleClear = () => {
      onChange("");
      setOpen(false);
    };

    const display = persianDisplay(committedValue);

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
            aria-label={openCalendarAriaLabel}
            aria-expanded={open}
          >
            <CalendarGlyph />
          </button>
        </div>

        {open ? (
          <div className={styles.popover} role="dialog" aria-modal="false">
            <Calendar
              calendar={persian}
              locale={persian_fa}
              format="YYYY/MM/DD"
              value={draft ?? undefined}
              onChange={handleCalendarChange}
              minDate={minObj}
              maxDate={maxObj}
              shadow={false}
              className={styles.calendarSkin}
            />
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

function CalendarGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 3v2M17 3v2M4 9h16M6 5h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
