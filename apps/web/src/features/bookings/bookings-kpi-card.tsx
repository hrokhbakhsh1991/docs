"use client";

import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

type BookingsKpiCardProps = {
  readonly label: string;
  readonly value: number;
  readonly locale: AppLocale;
  readonly active?: boolean;
  readonly onClick?: () => void;
  /** UX-BKG-51 — optional accessible name for shortcut KPIs. */
  readonly ariaLabel?: string;
};

export function BookingsKpiCard({
  label,
  value,
  locale,
  active = false,
  onClick,
  ariaLabel,
}: BookingsKpiCardProps) {
  const content = (
    <>
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{formatLocalizedNumber(value, locale)}</p>
    </>
  );

  if (onClick === undefined) {
    return (
      <div className="inline-flex items-center gap-3 rounded-full border border-border/70 bg-muted/10 px-3 py-2">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={active}
      className={`inline-flex items-center text-start transition-colors ${
        active ? "ring-2 ring-primary" : "hover:opacity-90"
      }`}
    >
      <span
        className={`inline-flex items-center gap-3 rounded-full border px-3 py-2 ${
          active ? "border-primary bg-background" : "border-border/70 bg-muted/10"
        }`}
      >
        {content}
      </span>
    </button>
  );
}
