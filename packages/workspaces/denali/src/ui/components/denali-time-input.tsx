"use client";

import { Button } from "../adapters/platform-primitives";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { normalizeClockTime } from "../adapters/datetime-format";
import { toLocalizedDigits, type AppLocale } from "../adapters/i18n-format";
import { cn } from "../utils/cn";
import { splitClockValue } from "./time/time-picker-logic";
import { TimePickerPanel } from "./time/time-picker-panel";

function ClockIcon({ className }: { readonly className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

export type DenaliTimeInputAppearance = "field" | "inline";

export type DenaliTimeInputProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (time: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly appearance?: DenaliTimeInputAppearance;
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

/** Popover time picker (scroll columns) — mirrors localized date picker UX. */
export function DenaliTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  appearance = "field",
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: DenaliTimeInputProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayLabel = useMemo(() => {
    const normalized = normalizeClockTime(value.trim());
    if (normalized.length === 0) {
      return null;
    }
    return toLocalizedDigits(normalized, locale);
  }, [locale, value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  const handleChange = (next: string) => {
    const normalized = normalizeClockTime(next);
    onChange(normalized.length > 0 ? normalized : next);
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        id={id}
        type="button"
        variant="secondary"
        disabled={disabled}
        data-denali-time-picker
        data-denali-time-appearance={appearance}
        data-testid={dataTestId}
        dir="ltr"
        aria-label={ariaLabel ?? t("pickTime")}
        aria-required={required || undefined}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "denali-time-picker-trigger",
          appearance === "inline"
            ? "denali-time-picker-trigger--inline"
            : "denali-time-picker-trigger--field",
          !displayLabel && "text-muted-foreground",
          className
        )}
      >
        <ClockIcon className="denali-time-picker-trigger__icon size-4 shrink-0 opacity-70" />
        <span className="truncate">{displayLabel ?? t("pickTime")}</span>
      </Button>
      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-1 w-auto rounded-md border bg-popover p-0 shadow-md",
            appearance === "inline" ? "end-0" : "start-0"
          )}
          data-denali-wizard-time-popover
        >
          <TimePickerPanel
            value={splitClockValue(value).hours.length > 0 ? value : "09:00"}
            onChange={handleChange}
            onConfirm={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
