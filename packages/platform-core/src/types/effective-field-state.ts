import type { WorkspaceFieldRegistryEntry } from "@app-tour/workspace-sdk";

export interface EffectiveFieldState {
  readonly fieldId: string;
  readonly entry: WorkspaceFieldRegistryEntry;
  readonly hidden: boolean;
  readonly required: boolean;
}
