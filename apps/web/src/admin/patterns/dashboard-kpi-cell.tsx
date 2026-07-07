import type { ReactNode } from "react";

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
      {...(variant === "finance"
        ? { "data-denali-finance-kpi": true }
        : { "data-denali-kpi": true })}
    >
      <p data-denali-kpi-label>{label}</p>
      <p data-denali-kpi-value>{value}</p>
    </div>
  );
}

/** @deprecated Use `DashboardWidgetFooterLink` from `dashboard-widget-card`. */
export const DASHBOARD_WIDGET_FOOTER_LINK_CLASS =
  "inline-flex max-w-full break-words text-sm text-primary hover:underline";

export const DASHBOARD_CARD_DESCRIPTION_CLASS = "line-clamp-2 break-words text-start";
