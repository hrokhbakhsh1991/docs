import type { HTMLAttributes } from "react";

/** Preset skeleton dimensions — styled in `animations.css` under workspace theme. */
export type OperatorSkeletonSize =
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

export type OperatorSkeletonProps = Omit<HTMLAttributes<HTMLDivElement>, "className"> & {
  readonly size: OperatorSkeletonSize;
};

/** Workspace-themed shimmer; size via `data-operator-skeleton-size`. */
export function OperatorSkeleton({ size, ...props }: OperatorSkeletonProps) {
  return <div data-operator-skeleton="shimmer" data-operator-skeleton-size={size} {...props} />;
}
