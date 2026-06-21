"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { formatIsoDateLabel } from "../adapters/calendar-format";
import { type AppLocale } from "../adapters/i18n-format";
import { Button } from "../adapters/platform-primitives";
import { cn } from "../utils/cn";
import { DenaliCalendar } from "./calendar/denali-calendar";

function CalendarIcon({ className }: { readonly className?: string }) {
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
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

export type LocalizedDatePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (isoDate: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

export function LocalizedDatePicker({
  id,
  value,
  onChange,
  placeholder,
  disabled = false,
  required = false,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: LocalizedDatePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const displayLabel = value.trim().length > 0 ? formatIsoDateLabel(value, locale) : null;

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

  return (
    <div ref={rootRef} className="relative">
      <Button
        data-denali-date-picker
        id={id}
        type="button"
        variant="secondary"
        disabled={disabled}
        data-testid={dataTestId}
        aria-label={ariaLabel ?? t("pickDate")}
        aria-required={required || undefined}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "denali-date-picker-trigger",
          !displayLabel && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="denali-date-picker-trigger__icon size-4 shrink-0 opacity-70" />
        <span className="truncate">{displayLabel ?? placeholder ?? t("pickDate")}</span>
      </Button>
      {open ? (
        <div
          className="absolute z-50 mt-1 start-0 w-auto rounded-md border bg-popover p-0 shadow-md"
          data-denali-wizard-calendar-popover
        >
          <DenaliCalendar
            value={value}
            onSelect={(iso) => {
              onChange(iso);
              setOpen(false);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
