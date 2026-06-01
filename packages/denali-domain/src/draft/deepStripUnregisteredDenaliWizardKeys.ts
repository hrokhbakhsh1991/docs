import { DENALI_ROOTS } from "@repo/shared-contracts";

import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliZodFieldKind,
} from "../registry/denaliFieldRegistryData";

/** Allowed keys on array elements when the registry path ends at the array field. */
export const ZOD_KIND_ARRAY_ELEMENT_KEYS: Partial<Record<DenaliZodFieldKind, readonly string[]>> = {
  gatheringPoints: ["id", "title", "time", "location"],
  itinerary: ["day", "title", "description", "location", "locationText", "activities", "photos"],
  gearItems: ["id", "name", "required"],
  photos: ["id", "assetId", "url", "filename", "size", "mimeType", "uploadedAt", "uploadStatus"],
};

const LOCATION_DATA_OBJECT_KEYS = ["id", "addressText", "latitude", "longitude"] as const;

function uniqueRegistryRhfPaths(): readonly string[] {
  return [...new Set(DENALI_FIELD_DEFINITIONS.map((field) => field.rhfPath))];
}

function buildRegistryAllowedChildKeysByPrefix(): Map<string, ReadonlySet<string>> {
  const map = new Map<string, Set<string>>();

  const add = (prefix: string, segment: string): void => {
    let bucket = map.get(prefix);
    if (!bucket) {
      bucket = new Set<string>();
      map.set(prefix, bucket);
    }
    bucket.add(segment);
  };

  for (const path of uniqueRegistryRhfPaths()) {
    const segments = path.split(".").filter((segment) => segment.length > 0);
    for (let index = 0; index < segments.length; index += 1) {
      const prefix = segments.slice(0, index).join(".");
      add(prefix, segments[index]!);
    }
  }

  for (const field of DENALI_FIELD_DEFINITIONS) {
    const elementKeys = ZOD_KIND_ARRAY_ELEMENT_KEYS[field.zodKind];
    if (!elementKeys) {
      continue;
    }
    for (const key of elementKeys) {
      add(field.rhfPath, key);
      if (key === "location") {
        for (const locKey of LOCATION_DATA_OBJECT_KEYS) {
          add(`${field.rhfPath}.location`, locKey);
        }
      }
    }
  }

  const rootKeys = map.get("") ?? new Set<string>();
  for (const root of DENALI_ROOTS) {
    rootKeys.add(root);
  }
  map.set("", rootKeys);

  const frozen = new Map<string, ReadonlySet<string>>();
  for (const [prefix, keys] of map) {
    frozen.set(prefix, keys);
  }
  return frozen;
}

const REGISTRY_ALLOWED_CHILD_KEYS = buildRegistryAllowedChildKeysByPrefix();

/**
 * Recursively removes object keys that are not the next segment of any registry `rhfPath`.
 * Array elements are deep-stripped using the parent array prefix (see {@link ZOD_KIND_ARRAY_ELEMENT_KEYS}).
 */
export function deepStripUnregisteredDenaliWizardKeys<T>(value: T): T {
  return deepStripAtPrefix(value, "") as T;
}

/** Deep-strip using the registry prefix of the parent container (e.g. `tripDetails.logistics.gatheringPoints`). */
export function deepStripUnregisteredDenaliWizardKeysAtPrefix<T>(value: T, prefix: string): T {
  return deepStripAtPrefix(value, prefix) as T;
}

function deepStripAtPrefix(value: unknown, prefix: string): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => deepStripAtPrefix(item, prefix));
  }

  if (typeof value !== "object") {
    return value;
  }

  const allowed = REGISTRY_ALLOWED_CHILD_KEYS.get(prefix);
  if (!allowed || allowed.size === 0) {
    return {};
  }

  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      continue;
    }
    const childPrefix = prefix.length > 0 ? `${prefix}.${key}` : key;
    next[key] = deepStripAtPrefix(record[key], childPrefix);
  }
  return next;
}
