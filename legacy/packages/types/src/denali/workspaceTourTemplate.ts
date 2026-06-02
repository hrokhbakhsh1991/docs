import type { TourFormProfile } from "../tour-form-profile";

import type { DenaliCanonicalTemplateData } from "./denaliTemplateSchema";
import { DENALI_TEMPLATE_SCHEMA_VERSION } from "./denaliTemplateSchema";

/**
 * Workspace tour template / preset row aligned with {@link DenaliCanonicalTourModel}.
 * Stored as JSONB `canonical_data` on presets and workspace wizard templates.
 */
export type WorkspaceTourTemplateRecord = {
  id?: string;
  workspaceId?: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
  formProfile?: TourFormProfile;
  /** Rule-engine / wizard step config generation this payload conforms to. */
  schemaVersion: typeof DENALI_TEMPLATE_SCHEMA_VERSION;
  /** Authoritative partial canonical tour payload (no legacy wizard roots). */
  canonicalData: DenaliCanonicalTemplateData;
};

/** Input shape when reading persisted rows (may still carry discarded legacy columns). */
export type StoredWorkspaceTourTemplateRow = {
  id?: string;
  workspaceId?: string;
  name?: string;
  description?: string | null;
  isActive?: boolean;
  sortOrder?: number;
  matchTourType?: string | null;
  matchMainTourThemeId?: string | null;
  formProfile?: TourFormProfile | string;
  canonicalData?: unknown;
  /** @deprecated Ignored by {@link templateToCanonical}. */
  defaults?: unknown;
  /** @deprecated Ignored by {@link templateToCanonical}. */
  fieldRulesOverlay?: unknown;
  /** @deprecated Ignored by {@link templateToCanonical}. */
  stepOverrides?: unknown;
  schemaVersion?: string;
};
