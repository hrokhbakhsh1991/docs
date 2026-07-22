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
    <article data-operator-dashboard-widget data-operator-surface="card" data-testid={testId}>
      <header data-operator-dashboard-widget-header>
        <h2 data-operator-dashboard-widget-title>{title}</h2>
        {description ? (
          <p data-operator-dashboard-widget-description>{description}</p>
        ) : null}
      </header>
      <div data-operator-dashboard-widget-body>
        <div data-operator-dashboard-widget-content>{children}</div>
        {footer ? (
          <div data-dashboard-widget-footer data-operator-dashboard-widget-footer>
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
    <Link href={href} data-operator-dashboard-widget-footer-link>
      <span data-operator-dashboard-widget-footer-label>{children}</span>
      <ChevronRight aria-hidden data-operator-dashboard-widget-footer-chevron />
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
    <div data-operator-dashboard-kpi-grid data-testid={testId}>
      {children}
    </div>
  );
}

/** Finance widget KPI strip — 1 col mobile, 3 col from sm. */
export function DashboardFinanceKpiGrid({ children, testId }: DashboardKpiGridProps) {
  return (
    <div data-operator-dashboard-finance-kpi-grid data-testid={testId}>
      {children}
    </div>
  );
}

type DashboardWidgetErrorProps = {
  readonly children: ReactNode;
};

export function DashboardWidgetError({ children }: DashboardWidgetErrorProps) {
  return (
    <p data-operator-dashboard-widget-error role="alert">
      {children}
    </p>
  );
}

type DashboardWidgetRowStackProps = {
  readonly children: ReactNode;
};

export function DashboardWidgetRowStack({ children }: DashboardWidgetRowStackProps) {
  return <div data-operator-dashboard-widget-row-stack>{children}</div>;
}

type DashboardWidgetListProps = {
  readonly children: ReactNode;
  readonly testId?: string;
};

export function DashboardWidgetList({ children, testId }: DashboardWidgetListProps) {
  return (
    <ul data-operator-dashboard-widget-list data-testid={testId}>
      {children}
    </ul>
  );
}

type DashboardWidgetListEmptyItemProps = {
  readonly children: ReactNode;
};

export function DashboardWidgetListEmptyItem({ children }: DashboardWidgetListEmptyItemProps) {
  return <li data-operator-dashboard-widget-list-empty>{children}</li>;
}

type DashboardTourListRowProps = {
  readonly href: string;
  readonly title: string;
  readonly statusLabel: string;
};

export function DashboardTourListRow({ href, title, statusLabel }: DashboardTourListRowProps) {
  return (
    <li data-operator-dashboard-tour-row>
      <Link href={href} data-operator-dashboard-tour-row-link>
        {title}
      </Link>
      <span data-operator-dashboard-tour-row-status>{statusLabel}</span>
    </li>
  );
}

type DashboardRegistrationListRowProps = {
  readonly title: string;
  readonly countLabel: string;
};

export function DashboardRegistrationListRow({
  title,
  countLabel,
}: DashboardRegistrationListRowProps) {
  return (
    <li data-operator-dashboard-registration-row>
      <span data-operator-dashboard-registration-row-title>{title}</span>
      <span data-operator-dashboard-registration-row-count>{countLabel}</span>
    </li>
  );
}
