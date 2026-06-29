import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ExposureCollapsibleSectionProps = {
  readonly title: string;
  readonly description?: string;
  readonly defaultOpen?: boolean;
  readonly badge?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
};

export function ExposureCollapsibleSection({
  title,
  description,
  defaultOpen = false,
  badge,
  children,
  className,
}: ExposureCollapsibleSectionProps) {
  return (
    <details
      className={cn(
        "group rounded-lg border border-border/70 bg-card text-card-foreground",
        className,
      )}
      open={defaultOpen ? true : undefined}
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description !== undefined && description.length > 0 ? (
            <p className="text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {badge !== undefined ? <div className="shrink-0">{badge}</div> : null}
      </summary>
      <div className="space-y-4 border-t border-border/60 px-4 py-4">{children}</div>
    </details>
  );
}
