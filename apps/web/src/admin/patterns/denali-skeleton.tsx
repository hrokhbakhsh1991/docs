import type { HTMLAttributes } from "react";

/** Preset skeleton dimensions — styled in `animations.css` under denali workspace. */
export type DenaliSkeletonSize =
  | "kpi"
  | "row"
  | "block"
  | "panel"
  | "panel-xl"
  | "panel-lg"
  | "settings-card"
  | "user-card"
  | "search"
  | "chip-xs"
  | "chip-sm"
  | "chip-md"
  | "chip-lg"
  | "chip-xl"
  | "label-sm"
  | "label-md"
  | "label-lg"
  | "badge-sm"
  | "badge-md"
  | "badge-lg"
  | "title"
  | "subtitle"
  | "line-full"
  | "line-partial"
  | "hero";

export type DenaliSkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, "className"> & {
  readonly size: DenaliSkeletonSize;
};

/** Denali shimmer when `body[data-workspace-plugin="denali"]`; size via `data-denali-skeleton-size`. */
export function DenaliSkeleton({ size, ...props }: DenaliSkeletonProps) {
  return <div data-denali-skeleton="shimmer" data-denali-skeleton-size={size} {...props} />;
}
