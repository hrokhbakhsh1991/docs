/** Renderer-facing field kinds (Phase 3 platform-core renderer input). */
export type WorkspaceFieldKind =
  | "text"
  | "number"
  | "date"
  | "enum"
  | "boolean"
  | "composite";

/** One schema-driven field row in a workspace plugin registry. */
export interface WorkspaceFieldRegistryEntry {
  readonly id: string;
  readonly canonicalPath: string;
  readonly stepId: string;
  readonly kind: WorkspaceFieldKind;
  readonly required: boolean;
  readonly groupSlug?: string;
  readonly tags?: readonly string[];
}

export interface WorkspaceFieldRegistry {
  readonly version: number;
  readonly fields: readonly WorkspaceFieldRegistryEntry[];
}
