import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type DashboardWidgetCardProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  readonly testId?: string;
};

/** Equal-height dashboard widget shell — header / body / pinned footer. */
export function DashboardWidgetCard({
  title,
  description,
  footer,
  children,
  testId,
}: DashboardWidgetCardProps) {
  return (
    <article data-denali-dashboard-widget data-denali-surface="card" data-testid={testId}>
      <header data-denali-dashboard-widget-header>
        <h2 data-denali-dashboard-widget-title>{title}</h2>
        {description ? (
          <p data-denali-dashboard-widget-description>{description}</p>
        ) : null}
      </header>
      <div data-denali-dashboard-widget-body>
        <div data-denali-dashboard-widget-content>{children}</div>
        {footer ? (
          <div data-dashboard-widget-footer data-denali-dashboard-widget-footer>
            {footer}
          </div>
        ) : null}
      </div>
    </article>
  );
}

type DashboardWidgetFooterLinkProps = {
  readonly href: string;
  readonly children: ReactNode;
};

export function DashboardWidgetFooterLink({ href, children }: DashboardWidgetFooterLinkProps) {
  return (
    <Link href={href} data-denali-dashboard-widget-footer-link>
      <span data-denali-dashboard-widget-footer-label>{children}</span>
      <ChevronRight aria-hidden data-denali-dashboard-widget-footer-chevron />
    </Link>
  );
}

type DashboardKpiGridProps = {
  readonly children: ReactNode;
  readonly testId?: string;
};

/** Two-column KPI grid inside dashboard widgets. */
export function DashboardKpiGrid({ children, testId }: DashboardKpiGridProps) {
  return (
    <div data-denali-dashboard-kpi-grid data-testid={testId}>
      {children}
    </div>
  );
}

/** Finance widget KPI strip — 1 col mobile, 3 col from sm. */
export function DashboardFinanceKpiGrid({ children, testId }: DashboardKpiGridProps) {
  return (
    <div data-denali-dashboard-finance-kpi-grid data-testid={testId}>
      {children}
    </div>
  );
}
