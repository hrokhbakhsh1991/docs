/** Shared registry types (imported by data + helpers). */

import type { DenaliRuleModelCategory } from "../rules/denaliRuleModel.types";

export type DenaliFieldKind = "standard" | "asyncAsset";

export type DenaliFieldWireProjection =
  | { kind: "tripDetails.overview"; field: string }
  | { kind: "tripDetails.metrics"; field: string }
  | { kind: "tripDetails.logistics"; field: string }
  | { kind: "tripDetails.participation"; field: string }
  | { kind: "tripDetails"; field: "transport" | "photos" }
  | { kind: "createTourDto"; field: string }
  | { kind: "derived"; description: string };

/**
 * Runtime visibility/required rule evaluated from registry (replaces denaliUIAdapter if-chains).
 * Transport kinds delegate to `@repo/types/denali` — do not duplicate mode logic here.
 */
/** Workspace UI flags from {@link getCapabilitiesForProfile} (not tour category × duration matrix). */
export type DenaliWorkspaceCapabilityFlag = "canDefineCustomServices";

export type DenaliContextualRule =
  | { readonly kind: "whenTruthy"; readonly watchCanonical: string }
  | { readonly kind: "capability"; readonly flag: DenaliWorkspaceCapabilityFlag }
  | { readonly kind: "transportOrganizedCostVisible" }
  | { readonly kind: "transportPersonalCarOptionVisible" }
  | { readonly kind: "transportDongVisible" }
  | { readonly kind: "transportAdminCapacityVisible" }
  | { readonly kind: "transportTrainSeatVisible" }
  | { readonly kind: "multiDayEndDateTimeRequired" }
  | { readonly kind: "peakExperienceVisible" };

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
  | {
      readonly kind: "clearFieldWhenTransportMode";
      readonly targetCanonical: string;
      readonly modes: readonly string[];
    };
