import { createCanonicalDocument, type CanonicalDocument } from "@app-tour/workspace-sdk";

import { DENALI_FIELD_DEFINITIONS } from "../field-registry/denaliFieldRegistryData";
import { DENALI_CANONICAL_OBJECT_ROOTS, buildDenaliWizardRoots } from "../denali-plugin-adapter";
import { stripSocialMediaLinkForSubmit } from "../ui/logic/denali-social-media-link-logic";
import {
  normalizeLegacyTripDetails,
  type LegacyTripDetailsBlob,
} from "./normalizeLegacyTripDetails";

/** Pre-migrate envelope root — staging only; must not remain after migrate (RULE-P6-010). */
export const LEGACY_TRIP_DETAILS_SOT_ROOT = "legacyTripDetailsSoT" as const;

export const DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION = 0;
export const DENALI_CURRENT_CANONICAL_SCHEMA_VERSION = 1;

function readPath(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = source;
  for (const part of parts) {
    if (current == null || typeof current !== "object" || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index]!;
    const existing = current[part];
    if (existing == null || typeof existing !== "object" || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

function isLegacyTripDetailsForm(value: unknown): value is Record<string, unknown> {
  return (
    value != null && typeof value === "object" && !Array.isArray(value) && "basicInfo" in value
  );
}

function buildDenaliCanonicalShell(): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const root of buildDenaliWizardRoots()) {
    if (DENALI_CANONICAL_OBJECT_ROOTS.has(root) || root.startsWith("denali_")) {
      data[root] = {};
      continue;
    }
    data[root] = null;
  }
  return data;
}

export function stripArraysForCanonicalIngress(value: unknown): unknown {
  if (Array.isArray(value)) {
    return undefined;
  }
  if (value != null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripArraysForCanonicalIngress(child);
      if (stripped !== undefined) {
        output[key] = stripped;
      }
    }
    return output;
  }
  return value;
}

/** Maps wizard RHF form → platform canonical `data` (nested roots; arrays retained). */
export function projectDenaliWizardFormToCanonicalData(
  form: Record<string, unknown>
): Record<string, unknown> {
  return projectLegacyFormToCanonicalData(form);
}

/** Wizard submit ingress — project form to canonical `data` (arrays retained — Phase 11.10). */
export function projectDenaliWizardFormToCanonicalIngressData(
  form: Record<string, unknown>
): Record<string, unknown> {
  return projectLegacyFormToCanonicalData(form);
}

/** 11.10 — operator submit artifact (canonical `data` before `createCanonicalDocument`). */
export function prepareDenaliSubmitArtifact(
  form: Record<string, unknown>
): Record<string, unknown> {
  const data = projectDenaliWizardFormToCanonicalIngressData(form);
  const link = readPath(data, "socialMediaLink");
  if (typeof link === "string") {
    writePath(data, "socialMediaLink", stripSocialMediaLinkForSubmit(link));
  }
  return data;
}

function projectLegacyFormToCanonicalData(
  legacyForm: Record<string, unknown>
): Record<string, unknown> {
  const data = buildDenaliCanonicalShell();

  for (const def of DENALI_FIELD_DEFINITIONS) {
    const value = readPath(legacyForm, def.zodPath);
    if (value === undefined) {
      continue;
    }
    writePath(data, def.canonicalPath, value);
  }

  const tripDetails = normalizeLegacyTripDetails(
    legacyForm.tripDetails as LegacyTripDetailsBlob | undefined
  );
  if (Object.keys(tripDetails).length > 0) {
    writePath(data, "tripDetails", tripDetails);
  }

  if (readPath(data, "pricing.paymentMode") === undefined) {
    writePath(data, "pricing.paymentMode", "offline_receipt");
  }

  if (readPath(data, "publishStatus") === undefined) {
    writePath(data, "publishStatus", "draft");
  }

  return data;
}

/**
 * MAP §8.3 — upgrade legacy `trip_details` blob to platform {@link CanonicalDocument}.
 * Phase 6.8: one-way cutover; no dual-write SoT.
 */
export function migrateDenaliCanonical(schemaVersion: number, data: unknown): CanonicalDocument {
  if (schemaVersion >= DENALI_CURRENT_CANONICAL_SCHEMA_VERSION) {
    if (
      data != null &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      "schemaVersion" in (data as Record<string, unknown>) &&
      "roots" in (data as Record<string, unknown>) &&
      "data" in (data as Record<string, unknown>)
    ) {
      const envelope = data as CanonicalDocument;
      return createCanonicalDocument({
        schemaVersion: envelope.schemaVersion,
        roots: [...envelope.roots],
        data: { ...envelope.data },
      });
    }
    throw new Error("MIGRATE_DENALI_CANONICAL_ALREADY_CURRENT");
  }

  let legacyForm: Record<string, unknown>;
  if (isLegacyTripDetailsForm(data)) {
    legacyForm = { ...data };
  } else if (
    data != null &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    LEGACY_TRIP_DETAILS_SOT_ROOT in (data as Record<string, unknown>)
  ) {
    const wrapped = (data as Record<string, unknown>)[LEGACY_TRIP_DETAILS_SOT_ROOT];
    if (!isLegacyTripDetailsForm(wrapped)) {
      throw new Error("MIGRATE_DENALI_LEGACY_ENVELOPE_INVALID");
    }
    legacyForm = { ...(wrapped as Record<string, unknown>) };
  } else {
    throw new Error("MIGRATE_DENALI_LEGACY_SHAPE_UNKNOWN");
  }

  const canonicalData = projectLegacyFormToCanonicalData(legacyForm);
  const roots = buildDenaliWizardRoots();

  return createCanonicalDocument({
    schemaVersion: DENALI_CURRENT_CANONICAL_SCHEMA_VERSION,
    roots: [...roots],
    data: canonicalData,
  });
}

/** Build pre-migrate storage envelope for controlled tenant backfill jobs. */
export function wrapLegacyTripDetailsForMigration(
  legacyForm: Record<string, unknown>
): CanonicalDocument {
  // Staging envelope intentionally skips strict ingress — legacy blobs may contain arrays.
  return {
    schemaVersion: DENALI_LEGACY_TRIP_DETAILS_SCHEMA_VERSION,
    roots: [LEGACY_TRIP_DETAILS_SOT_ROOT],
    data: {
      [LEGACY_TRIP_DETAILS_SOT_ROOT]: normalizeLegacyTripDetails(legacyForm),
    },
  };
}
