"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import {
  ensureOperatorUiComponentsSurface,
  resolveOperatorUiComponentsSurface,
  type OperatorUiComponentsSurface,
} from "@/bootstrap/workspace-operator-ui-components-bindings.generated";
import { joinDatetimeLocal, splitDatetimeLocal } from "@/i18n/datetime-format";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { useAppSession } from "@/providers/app-session-context";
import { Label } from "../ui/label";
import { LocalizedDatePicker } from "./localized-date-picker";

export type LocalizedTimeInputProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (time: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly variant?: "shadcn" | "primitive";
  readonly "aria-label"?: string;
};

function useOperatorUiSurface(): OperatorUiComponentsSurface | null {
  const session = useAppSession();
  const [surface, setSurface] = useState<OperatorUiComponentsSurface | null>(() =>
    resolveOperatorUiComponentsSurface(session.pluginId)
  );

  useEffect(() => {
    let cancelled = false;
    const cached = resolveOperatorUiComponentsSurface(session.pluginId);
    if (cached != null) {
      setSurface(cached);
      return;
    }
    void ensureOperatorUiComponentsSurface(session.pluginId).then((next) => {
      if (!cancelled) {
        setSurface(next);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session.pluginId]);

  return surface;
}

/** HH:mm — operator field style (wizard + settings). */
export function LocalizedTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  variant = "shadcn",
  "aria-label": ariaLabel,
}: LocalizedTimeInputProps) {
  const surface = useOperatorUiSurface();
  if (surface == null) {
    return null;
  }
  const WorkspaceTimeInput = surface.TimeInput;
  void variant;

  return (
    <WorkspaceTimeInput
      id={id}
      value={value}
      disabled={disabled}
      required={required}
      className={className}
      aria-label={ariaLabel}
      appearance="field"
      onChange={onChange}
    />
  );
}

export type LocalizedDatetimePickerProps = {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (datetimeLocal: string) => void;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly className?: string;
  readonly layout?: "default" | "wizard";
  readonly "data-testid"?: string;
  readonly "aria-label"?: string;
};

/** Persian/Gregorian date + HH:mm. Wizard layout: one shared control bar. */
export function LocalizedDatetimePicker({
  id,
  value,
  onChange,
  disabled = false,
  required = false,
  className,
  layout = "default",
  "data-testid": dataTestId,
  "aria-label": ariaLabel,
}: LocalizedDatetimePickerProps) {
  const locale = useLocale() as AppLocale;
  const t = useTranslations("common.calendar");
  const { date, time } = splitDatetimeLocal(value);
  const surface = useOperatorUiSurface();

  if (layout === "wizard") {
    if (surface == null) {
      return null;
    }
    const WorkspaceWizardDatetimePicker = surface.WizardDatetimePicker;
    return (
      <WorkspaceWizardDatetimePicker
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={className}
        data-testid={dataTestId}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]", className)}
      data-testid={dataTestId}
      dir={locale === "fa" ? "rtl" : "ltr"}
    >
      <LocalizedDatePicker
        id={id}
        value={date}
        disabled={disabled}
        required={required}
        aria-label={ariaLabel ?? t("pickDate")}
        onChange={(nextDate) => onChange(joinDatetimeLocal(nextDate, time))}
      />
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t("timeLabel")}</Label>
        <LocalizedTimeInput
          value={time}
          disabled={disabled}
          required={required}
          onChange={(nextTime) => onChange(joinDatetimeLocal(date, nextTime))}
        />
      </div>
    </div>
  );
}
