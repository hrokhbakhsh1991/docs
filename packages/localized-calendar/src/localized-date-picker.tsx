"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@app-tour/ui-primitives/button";
import { formatIsoDateLabel } from "./calendar-format";
import { type AppLocale } from "./i18n-format";
import { cn } from "./cn";
import { SolarHijriCalendar } from "./solar-hijri-calendar";
import { useCalendarPopoverPlacement } from "./use-calendar-popover-placement";

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
  readonly name?: string;
  readonly value: string;
  readonly onChange: (isoDate: string) => void;
  readonly minIsoDate?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
  readonly className?: string;
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
  readonly "aria-describedby"?: string;
  /** Host-owned `data-*` attributes spread onto the trigger button. */
  readonly triggerDataAttributes?: Readonly<Record<string, string | undefined>>;
  readonly collisionSelectors?: readonly string[];
};

export function LocalizedDatePicker({
  id,
  name,
  value,
  onChange,
  minIsoDate,
  placeholder,
  disabled = false,
  required = false,
  invalid = false,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
  "aria-describedby": ariaDescribedBy,
  triggerDataAttributes,
  collisionSelectors,
}: LocalizedDatePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerId = useId();
  const placement = useCalendarPopoverPlacement(open, rootRef, collisionSelectors);
  const displayLabel = value.trim().length > 0 ? formatIsoDateLabel(value, locale) : null;

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root == null) {
        return;
      }
      const path = event.composedPath();
      if (path.some((node) => node === root)) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="operator-date-picker">
      <Button
        data-operator-date-picker
        id={id ?? triggerId}
        name={name}
        type="button"
        variant="ghost"
        disabled={disabled}
        data-testid={dataTestId}
        {...triggerDataAttributes}
        aria-label={ariaLabel ?? t("pickDate")}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={ariaDescribedBy}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "operator-date-picker-trigger",
          !displayLabel && "operator-date-picker-trigger--placeholder",
          className
        )}
      >
        <CalendarIcon className="operator-date-picker-trigger__icon" />
        <span className="operator-date-picker-trigger__label">
          {displayLabel ?? placeholder ?? t("pickDate")}
        </span>
      </Button>
      {open ? (
        <div
          data-operator-wizard-calendar-popover
          data-operator-wizard-calendar-placement={placement}
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <SolarHijriCalendar
            value={value}
            minIsoDate={minIsoDate}
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
