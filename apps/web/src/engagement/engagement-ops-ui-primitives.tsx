"use client";

import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { ENGAGEMENT_OPS_TEST_IDS } from "./engagement-ops-logic";
import type { EngagementLoadState } from "./engagement-ops-types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function EngagementNativeSelect({
  id,
  value,
  onChange,
  disabled,
  children,
}: {
  readonly id?: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <select
      id={id}
      className={selectClassName}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  );
}

export function EngagementStatusBadge({
  status,
  label,
}: {
  readonly status: "active" | "inactive" | "archived";
  readonly label: string;
}) {
  const variant =
    status === "active" ? "default" : status === "inactive" ? "secondary" : "outline";
  return <Badge variant={variant}>{label}</Badge>;
}

export function EngagementPanelState({
  state,
  loadingLabel,
  errorLabel,
  permissionDeniedLabel,
  emptyLabel,
  isEmpty,
  children,
  testIds,
}: {
  readonly state: EngagementLoadState;
  readonly loadingLabel: string;
  readonly errorLabel: string;
  readonly permissionDeniedLabel: string;
  readonly emptyLabel: string;
  readonly isEmpty: boolean;
  readonly children: ReactNode;
  readonly testIds: {
    readonly panel: string;
    readonly empty?: string;
  };
}) {
  if (state === "idle" || state === "loading") {
    return (
      <div data-testid={testIds.panel}>
        <Skeleton className="h-40 w-full" aria-label={loadingLabel} />
        <p className="sr-only">{loadingLabel}</p>
      </div>
    );
  }
  if (state === "permissionDenied") {
    return (
      <div data-testid={testIds.panel}>
        <p
          role="alert"
          className="text-destructive"
          data-testid={ENGAGEMENT_OPS_TEST_IDS.permissionDenied}
        >
          {permissionDeniedLabel}
        </p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div data-testid={testIds.panel}>
        <p role="alert" className="text-destructive">
          {errorLabel}
        </p>
      </div>
    );
  }
  if (state === "ready" && isEmpty) {
    return (
      <div data-testid={testIds.panel}>
        <p data-testid={testIds.empty} className="text-sm text-muted-foreground">
          {emptyLabel}
        </p>
      </div>
    );
  }
  return <div data-testid={testIds.panel}>{children}</div>;
}

export function engagementTabButtonClass(active: boolean): string {
  return cn(
    "shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-background text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground",
  );
}
