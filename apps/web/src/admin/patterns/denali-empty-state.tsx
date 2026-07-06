import { MapPin, Mountain, Trees, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const EMPTY_ICONS = {
  mountain: Mountain,
  trees: Trees,
  map: MapPin,
} as const satisfies Record<string, LucideIcon>;

export type DenaliEmptyStateIcon = keyof typeof EMPTY_ICONS;

export type DenaliEmptyStateProps = {
  readonly description: string;
  readonly icon?: DenaliEmptyStateIcon;
  readonly action?: ReactNode;
};

export function DenaliEmptyState({
  description,
  icon = "mountain",
  action,
}: DenaliEmptyStateProps) {
  const Icon = EMPTY_ICONS[icon];

  return (
    <div data-denali-empty-state>
      <div data-denali-empty-state-icon aria-hidden>
        <Icon />
      </div>
      <p data-denali-empty-state-text>{description}</p>
      {action ? <div data-denali-empty-state-action>{action}</div> : null}
    </div>
  );
}
