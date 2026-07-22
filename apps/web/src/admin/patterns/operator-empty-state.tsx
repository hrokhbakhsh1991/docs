import { MapPin, Mountain, Trees, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const EMPTY_ICONS = {
  mountain: Mountain,
  trees: Trees,
  map: MapPin,
} as const satisfies Record<string, LucideIcon>;

export type OperatorEmptyStateIcon = keyof typeof EMPTY_ICONS;

export type OperatorEmptyStateProps = {
  readonly description: string;
  readonly icon?: OperatorEmptyStateIcon;
  readonly action?: ReactNode;
};

export function OperatorEmptyState({
  description,
  icon = "mountain",
  action,
}: OperatorEmptyStateProps) {
  const Icon = EMPTY_ICONS[icon];

  return (
    <div data-operator-empty-state>
      <div data-operator-empty-state-icon aria-hidden>
        <Icon />
      </div>
      <p data-operator-empty-state-text>{description}</p>
      {action ? <div data-operator-empty-state-action>{action}</div> : null}
    </div>
  );
}
