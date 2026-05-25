import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import { DENALI_FIELD_DEFINITIONS } from "./registry/denaliFieldRegistryData";

/**
 * Canonical model section roots — valid for spread reads/writes (`{ ...transport, mode }`).
 * Registry leaves live under these prefixes (e.g. `transport.mode`, `program.themeIds`).
 */
export const DENALI_CANONICAL_SECTION_ROOTS = [
  "program",
  "transport",
  "pricing",
  "participants",
  "policies",
] as const;

export type DenaliCanonicalSectionRoot = (typeof DENALI_CANONICAL_SECTION_ROOTS)[number];

function isDenaliCanonicalSectionPath(canonicalPath: string): boolean {
  for (const root of DENALI_CANONICAL_SECTION_ROOTS) {
    if (canonicalPath === root || canonicalPath.startsWith(`${root}.`)) {
      return true;
    }
  }
  return false;
}

/** Registry leaf, section root, path under a section root, or parent of registered leaves. */
export function isKnownDenaliCanonicalPath(canonicalPath: string): boolean {
  if (isDenaliCanonicalSectionPath(canonicalPath)) {
    return true;
  }
  if (DENALI_FIELD_DEFINITIONS.some((def) => def.canonicalPath === canonicalPath)) {
    return true;
  }
  const childPrefix = `${canonicalPath}.`;
  return DENALI_FIELD_DEFINITIONS.some((def) => def.canonicalPath.startsWith(childPrefix));
}

/**
 * Reads a registry `canonicalPath` on the Denali canonical tour model
 * (e.g. `transport.transportCost`, `program.themeIds`, or section `program`).
 */
export function getDenaliCanonicalPathValue(
  model: DenaliCanonicalTourModel,
  canonicalPath: string,
): unknown {
  if (process.env.NODE_ENV === "development" && !isKnownDenaliCanonicalPath(canonicalPath)) {
    console.warn(
      `[Denali] getDenaliCanonicalPathValue: unknown canonicalPath "${canonicalPath}"`,
    );
  }

  const segments = canonicalPath.split(".").filter((segment) => segment.length > 0);
  if (segments.length === 0) {
    return undefined;
  }

  let current: unknown = model;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
