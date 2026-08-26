"use client";

import type { ComponentProps } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Compact chip sizing shared across operator directory / inbox surfaces. */
export const OPERATOR_COMPACT_BADGE_CLASS = "h-5 px-1.5 text-[10px]";

type OperatorStatusBadgeProps = ComponentProps<typeof Badge>;

export function OperatorStatusBadge({ className, ...props }: OperatorStatusBadgeProps) {
  return (
    <Badge
      data-operator-status-badge
      className={cn(OPERATOR_COMPACT_BADGE_CLASS, className)}
      {...props}
    />
  );
}
