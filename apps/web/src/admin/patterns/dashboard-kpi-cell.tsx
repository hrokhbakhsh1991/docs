import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DashboardKpiCellProps = {
  readonly label: string;
  readonly value: ReactNode;
  readonly variant?: "default" | "finance";
};

/** Denali dashboard KPI tile — clamped label + tabular value (overflow-safe). */
export function DashboardKpiCell({
  label,
  value,
  variant = "default",
}: DashboardKpiCellProps) {
  return (
    <div
      className={cn(
        "flex min-h-[5.25rem] min-w-0 flex-col justify-between rounded-lg border border-border/60 bg-muted/25 p-3 text-start"
      )}
      {...(variant === "finance"
        ? { "data-denali-finance-kpi": true }
        : { "data-denali-kpi": true })}
    >
      <p className="line-clamp-2 break-words text-xs leading-snug text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold leading-none tabular-nums">{value}</p>
    </div>
  );
}

/** @deprecated Use `DashboardWidgetFooterLink` from `dashboard-widget-card`. */
export const DASHBOARD_WIDGET_FOOTER_LINK_CLASS =
  "inline-flex max-w-full break-words text-sm text-primary hover:underline";

export const DASHBOARD_CARD_DESCRIPTION_CLASS = "line-clamp-2 break-words text-start";
