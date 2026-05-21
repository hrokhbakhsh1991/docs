import type { TourFormProfile } from "@repo/types";

export interface WorkspaceInvariantViolation {
  code: string;
  message: string;
}

/**
 * Strategy/Contract for a Tour Workspace (e.g. Denali, Arctic).
 * Aligned with map.md §B1 and §Phase 3.
 */
export interface TourWorkspaceDefinition {
  readonly profile: TourFormProfile;
  readonly version: number;
  
  /** Roots expected in DTOs and Presets (e.g. basicInfo, programNature for Denali). */
  readonly roots: readonly string[];

  /** UI Rail hint for the web wizard. */
  readonly ui: {
    readonly wizardMode: "classic" | "denali";
  };

  /** Invariant checks (logic rules beyond simple types). */
  readonly validation: {
    readonly checkCapacity: (capacity: number) => WorkspaceInvariantViolation | null;
    readonly checkTripDetails: (tripDetails: any, transportModes?: readonly string[] | null) => WorkspaceInvariantViolation | null;
  };

  /** Lifecycle contract (map.md §B4 and §Phase 4). */
  readonly lifecycle: {
    readonly initialStatus: string;
    readonly publishStatus: string;
    readonly allowedTransitions: readonly { from: string; to: string }[];
  };

  /** Workspace actions (map.md §Phase 1). */
  readonly actions?: {
    /** Apply workspace-specific invariants (normalization). */
    readonly applyInvariants?: <T>(form: T) => T;
  };
}
