"use client";

import { CalendarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatIsoDateLabel } from "@/i18n/calendar-format";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export type LocalizedDatePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (isoDate: string) => void;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly invalid?: boolean;
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
  invalid = false,
  className,
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: LocalizedDatePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const [open, setOpen] = useState(false);
  const displayLabel = value.trim().length > 0 ? formatIsoDateLabel(value, locale) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          data-operator-date-picker
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          data-testid={dataTestId}
          aria-label={ariaLabel ?? t("pickDate")}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-10 min-h-11 w-full justify-start gap-2 px-3 font-normal",
            !displayLabel && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-70" />
          <span className="truncate">{displayLabel ?? placeholder ?? t("pickDate")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0" data-operator-wizard-calendar-popover>
        <Calendar
          value={value}
          onSelect={(iso) => {
            onChange(iso);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
