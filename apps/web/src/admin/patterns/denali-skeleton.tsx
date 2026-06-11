import type { HTMLAttributes } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type DenaliSkeletonProps = HTMLAttributes<HTMLDivElement>;

/** Denali shimmer when `body[data-workspace-plugin="denali"]`; otherwise shadcn pulse. */
export function DenaliSkeleton({ className, ...props }: DenaliSkeletonProps) {
  return (
    <Skeleton
      className={cn(className)}
      data-denali-skeleton="shimmer"
      {...props}
    />
  );
}
