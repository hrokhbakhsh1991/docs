"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type WorkspaceMasterDetailLayoutProps = {
  readonly dir: "ltr" | "rtl";
  readonly list: ReactNode;
  readonly detail: ReactNode;
  readonly mobileDetail: ReactNode | null;
  readonly mobileDetailTitle?: string | null;
  readonly mobileOpen: boolean;
  readonly onMobileOpenChange: (open: boolean) => void;
  readonly desktopGridClassName?: string;
  readonly desktopListClassName?: string;
  readonly desktopDetailClassName?: string;
  readonly mobileSheetClassName?: string;
};

type WorkspaceStickyDetailCardProps = {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly testId?: string;
  readonly className?: string;
  readonly contentClassName?: string;
};

export function WorkspaceStickyDetailCard({
  title,
  description,
  children,
  testId,
  className,
  contentClassName,
}: WorkspaceStickyDetailCardProps) {
  return (
    <Card
      className={cn(
        "hidden min-w-0 shadow-none lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:overflow-hidden",
        className
      )}
      data-operator-surface="card"
      data-testid={testId}
    >
      <CardHeader className="shrink-0 space-y-1">
        <CardTitle>{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className={cn("space-y-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function WorkspaceMasterDetailLayout({
  dir,
  list,
  detail,
  mobileDetail,
  mobileDetailTitle,
  mobileOpen,
  onMobileOpenChange,
  desktopGridClassName,
  desktopListClassName,
  desktopDetailClassName,
  mobileSheetClassName,
}: WorkspaceMasterDetailLayoutProps) {
  const desktopList = (
    <div className={cn("min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pr-1", desktopListClassName)}>
      {list}
    </div>
  );
  const desktopDetail = (
    <div className={cn("min-w-0 lg:min-h-0", desktopDetailClassName)}>{detail}</div>
  );

  return (
    <>
      <div
        className={cn(
          "grid gap-4 lg:h-[calc(100vh-8rem)] lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-stretch",
          desktopGridClassName
        )}
      >
        {dir === "rtl" ? (
          <>
            {desktopList}
            {desktopDetail}
          </>
        ) : (
          <>
            {desktopDetail}
            {desktopList}
          </>
        )}
      </div>

      <Sheet open={mobileOpen && mobileDetail !== null} onOpenChange={onMobileOpenChange}>
        <SheetContent
          side="bottom"
          className={cn("max-h-[90vh] overflow-y-auto rounded-t-xl lg:hidden", mobileSheetClassName)}
        >
          {mobileDetail !== null ? (
            <>
              {mobileDetailTitle ? (
                <SheetHeader>
                  <SheetTitle>{mobileDetailTitle}</SheetTitle>
                </SheetHeader>
              ) : null}
              <div className={mobileDetailTitle ? "mt-4" : undefined}>{mobileDetail}</div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
