"use client";

import { Card, CardContent } from "@/components/ui/card";
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
    <CardContent className="px-3 py-2.5">
      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{formatLocalizedNumber(value, locale)}</p>
    </CardContent>
  );

  if (onClick === undefined) {
    return <Card className="shadow-none">{content}</Card>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? label}
      aria-pressed={active}
      className={`rounded-lg text-start transition-colors ${
        active ? "ring-2 ring-primary" : "hover:opacity-90"
      }`}
    >
      <Card
        className={`shadow-none ${active ? "border-primary" : "border-border/70 bg-muted/20"}`}
      >
        {content}
      </Card>
    </button>
  );
}
