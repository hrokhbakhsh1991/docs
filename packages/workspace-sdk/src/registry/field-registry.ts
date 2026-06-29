export type WorkspaceFieldKind =
  | "text"
  | "number"
  | "date"
  | "enum"
  | "boolean"
  | "composite";

export interface WorkspaceFieldRegistryEntry {
  readonly id: string;
  readonly canonicalPath: string;
  readonly stepId: string;
  readonly kind: WorkspaceFieldKind;
  readonly required: boolean;
  readonly groupSlug?: string;
  readonly tags?: readonly string[];
  /** Admin-facing label for integration/settings UI (not an i18n key). */
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  /** Presentation group for admin integration field pickers (e.g. Location, Schedule). */
  readonly group?: string;
  readonly icon?: string;
  /** When kind is `enum`, allowed stored values (validated at platform runtime). */
  readonly enumOptions?: readonly string[];
}

export interface WorkspaceFieldRegistry {
  readonly version: number;
  readonly fields: readonly WorkspaceFieldRegistryEntry[];
}
