import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[var(--radius)] border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border-transparent bg-muted text-muted-foreground",
        destructive:
          "border-[var(--color-danger)]/20 bg-[var(--color-danger-bg)] text-[var(--color-danger)]",
        success:
          "border-[var(--color-success)]/20 bg-[var(--color-success-bg)] text-[var(--color-success)]",
        warning:
          "border-[var(--color-warning)]/20 bg-[var(--color-warning-bg)] text-[var(--color-warning)]",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
