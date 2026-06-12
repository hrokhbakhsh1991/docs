"use client";

import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { normalizeClockTime } from "@/i18n/datetime-format";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { splitClockValue } from "./time-picker-logic";
import { TimePickerPanel } from "./time-picker-panel";

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

/** Popover time picker (scroll columns) — mirrors {@link LocalizedDatePicker} UX. */
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
  const displayLabel = useMemo(() => {
    const normalized = normalizeClockTime(value.trim());
    if (normalized.length === 0) {
      return null;
    }
    return toLocalizedDigits(normalized, locale);
  }, [locale, value]);

  const handleChange = (next: string) => {
    const normalized = normalizeClockTime(next);
    onChange(normalized.length > 0 ? normalized : next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-denali-time-picker
          data-denali-time-appearance={appearance}
          data-testid={dataTestId}
          dir="ltr"
          aria-label={ariaLabel ?? t("pickTime")}
          aria-required={required || undefined}
          className={cn(
            "denali-time-picker-trigger",
            appearance === "inline"
              ? "denali-time-picker-trigger--inline"
              : "denali-time-picker-trigger--field",
            !displayLabel && "text-muted-foreground",
            className
          )}
        >
          <Clock className="denali-time-picker-trigger__icon size-4 shrink-0 opacity-70" aria-hidden />
          <span className="truncate">{displayLabel ?? t("pickTime")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={appearance === "inline" ? "end" : "start"}
        className="w-auto p-0"
        data-denali-wizard-time-popover
      >
        <TimePickerPanel
          value={splitClockValue(value).hours.length > 0 ? value : "09:00"}
          onChange={handleChange}
          onConfirm={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
