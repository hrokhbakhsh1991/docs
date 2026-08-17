/** Shared registry types (imported by data + helpers). */

import type { DenaliRuleModelCategory } from "../rules/denaliRuleModel.types";

export type {
  DenaliContextualRule,
  DenaliWorkspaceCapabilityFlag,
} from "./denali-contextual-rule.types";

export type DenaliFieldKind = "standard" | "asyncAsset";

export type DenaliFieldWireProjection =
  | { kind: "tripDetails.overview"; field: string }
  | { kind: "tripDetails.metrics"; field: string }
  | { kind: "tripDetails.logistics"; field: string }
  | { kind: "tripDetails.participation"; field: string }
  | { kind: "tripDetails"; field: "transport" | "photos" }
  | { kind: "createTourDto"; field: string }
  | { kind: "derived"; description: string };

/** Structural normalize rules (ghost purge, enforce, defaults) — evaluated in denaliInvariantEngine.ts. */
export type DenaliStructuralInvariant =
  | { readonly kind: "clearWhenNotVisible" }
  | { readonly kind: "defaultWhenVisible"; readonly value: unknown }
  | {
      readonly kind: "enforceValueWhenCategory";
      readonly category: DenaliRuleModelCategory;
      readonly value: unknown;
    };

/** Cross-field or algorithmic rules not tied to a single registry row visibility flag. */
export type DenaliGlobalStructuralInvariant =
  | { readonly kind: "syncProgramItineraryToDayCount" }
  | { readonly kind: "pruneItinerarySegmentPhotoIds" }
  | { readonly kind: "omitEmptyGatheringPoints" }
  | {
      readonly kind: "clearFieldWhenTransportMode";
      readonly targetCanonical: string;
      readonly modes: readonly string[];
    };
