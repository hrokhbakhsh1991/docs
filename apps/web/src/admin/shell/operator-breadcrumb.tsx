"use client";

import Link from "next/link";
import { useAppPathname } from "@/navigation/app-navigation-hooks";
import { ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import {
  resolveOperatorBreadcrumbSegments,
  type OperatorBreadcrumbSegment,
} from "./operator-breadcrumb-logic";

function BreadcrumbLabel({ segment }: { readonly segment: OperatorBreadcrumbSegment }) {
  const tNav = useTranslations("nav");
  const tApp = useTranslations("app");
  const tSettings = useTranslations("settings");
  const tTours = useTranslations("tours");
  const tBookings = useTranslations("bookings");

  switch (segment.namespace) {
    case "nav":
      return tNav(segment.key);
    case "app":
      return tApp(segment.key);
    case "settings":
      return tSettings(segment.key);
    case "tours":
      return tTours(segment.key);
    case "bookings":
      return tBookings(segment.key);
    default:
      return segment.key;
  }
}

type OperatorBreadcrumbProps = {
  readonly className?: string;
};

export function OperatorBreadcrumb({ className }: OperatorBreadcrumbProps) {
  const pathname = useAppPathname();
  const segments = resolveOperatorBreadcrumbSegments(pathname);

  if (segments.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      data-operator-breadcrumb
      className={cn("flex min-w-0 items-center gap-1 text-sm", className)}
    >
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const content = <BreadcrumbLabel segment={segment} />;

        return (
          <span key={`${segment.namespace}:${segment.key}:${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : null}
            {segment.href !== undefined && !isLast ? (
              <Link
                href={segment.href}
                className="truncate font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {content}
              </Link>
            ) : (
              <span
                className={cn("truncate", isLast ? "font-semibold text-foreground" : "text-muted-foreground")}
                aria-current={isLast ? "page" : undefined}
              >
                {content}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
