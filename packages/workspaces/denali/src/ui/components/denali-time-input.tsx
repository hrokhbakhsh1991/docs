"use client";

import { Button } from "../adapters/platform-primitives";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { normalizeClockTime } from "../adapters/datetime-format";
import { toLocalizedDigits, type AppLocale } from "../adapters/i18n-format";
import { cn } from "../utils/cn";
import { resolveTimePickerDraft } from "./time/time-picker-logic";
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
  readonly invalid?: boolean;
  readonly className?: string;
  readonly appearance?: DenaliTimeInputAppearance;
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

/** Popover time picker (scroll columns) — draft locally, commit on confirm. */
export function DenaliTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  invalid = false,
  className,
  appearance = "field",
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: DenaliTimeInputProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const [open, setOpen] = useState(false);
  const [draftTime, setDraftTime] = useState(() => resolveTimePickerDraft(value));
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
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
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
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  const openPicker = () => {
    setDraftTime(resolveTimePickerDraft(value));
    setOpen(true);
  };

  const commitDraft = () => {
    const normalized = normalizeClockTime(draftTime);
    if (normalized.length > 0) {
      onChange(normalized);
    }
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={cn(
        "operator-time-picker-host",
        appearance === "inline" && "operator-time-picker-host--inline",
        appearance === "field" && "operator-time-picker-host--field"
      )}
    >
      <Button
        id={id}
        type="button"
        variant={appearance === "inline" ? "ghost" : "secondary"}
        disabled={disabled}
        data-operator-time-picker
        data-operator-time-appearance={appearance}
        data-testid={dataTestId}
        dir="ltr"
        aria-label={ariaLabel ?? t("pickTime")}
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          openPicker();
        }}
        className={cn(
          "operator-time-picker-trigger",
          appearance === "inline"
            ? "operator-time-picker-trigger--inline"
            : "operator-time-picker-trigger--field",
          !displayLabel && "operator-time-picker-trigger--placeholder",
          className
        )}
      >
        <ClockIcon className="operator-time-picker-trigger__icon" />
        <span className="operator-time-picker-trigger__label">{displayLabel ?? t("pickTime")}</span>
      </Button>
      {open ? (
        <div
          data-operator-wizard-time-popover
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <TimePickerPanel
            value={draftTime}
            onChange={setDraftTime}
            onConfirm={commitDraft}
          />
        </div>
      ) : null}
    </div>
  );
}
