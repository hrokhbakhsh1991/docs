import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { DASHBOARD_CARD_DESCRIPTION_CLASS } from "./dashboard-kpi-cell";

export const DASHBOARD_WIDGET_MIN_HEIGHT_CLASS = "min-h-[18rem]";

type DashboardWidgetCardProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly className?: string;
};

/** Equal-height dashboard widget shell — header / body / pinned footer. */
export function DashboardWidgetCard({
  title,
  description,
  footer,
  children,
  testId,
  className,
}: DashboardWidgetCardProps) {
  return (
    <Card
      data-denali-surface="card"
      data-testid={testId}
      className={cn(
        "flex h-full flex-col shadow-sm",
        DASHBOARD_WIDGET_MIN_HEIGHT_CLASS,
        className
      )}
    >
      <CardHeader className="gap-1 space-y-0 border-b border-border/50 px-5 pb-3 pt-5">
        <CardTitle className="text-base font-semibold leading-snug">{title}</CardTitle>
        {description ? (
          <CardDescription className={cn(DASHBOARD_CARD_DESCRIPTION_CLASS, "text-start")}>
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        {footer ? (
          <div
            data-dashboard-widget-footer
            className="mt-auto shrink-0 border-t border-border/50 pt-3"
          >
            {footer}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

type DashboardWidgetFooterLinkProps = {
  readonly href: string;
  readonly children: ReactNode;
  readonly className?: string;
};

export function DashboardWidgetFooterLink({
  href,
  children,
  className,
}: DashboardWidgetFooterLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex w-full max-w-full items-center justify-between gap-2 text-sm font-medium text-primary hover:underline",
        className
      )}
    >
      <span className="min-w-0 break-words text-start">{children}</span>
      <ChevronRight className="h-4 w-4 shrink-0 opacity-70 rtl:rotate-180" aria-hidden />
    </Link>
  );
}

export const DASHBOARD_KPI_GRID_CLASS = "grid grid-cols-2 gap-3";
