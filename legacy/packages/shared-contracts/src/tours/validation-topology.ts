/**
 * # Validation Topology (map.md §C1)
 *
 * Responsibility layers for tour data validation.
 *
 * 1. Structural: shape, types, basic constraints (DTO / Zod).
 * 2. Workspace Rules: business logic specific to a profile (WorkspaceDefinition).
 * 3. Canonical: cross-field domain rules on the merged JSON (Shared helpers).
 * 4. API Invariants: security and platform-level constraints (Service layer).
 * 5. Lifecycle: transition readiness (Publish gates).
 */

export const VALIDATION_LAYERS = {
  STRUCTURAL: "structural",
  WORKSPACE: "workspace",
  CANONICAL: "canonical",
  INVARIANTS: "invariants",
  LIFECYCLE: "lifecycle",
} as const;

export type ValidationLayer = (typeof VALIDATION_LAYERS)[keyof typeof VALIDATION_LAYERS];
