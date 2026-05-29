/**
 * Checks flat-edit suppressed paths and template top-level keys against registry.
 */
import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "@repo/types/denali";
import { DENALI_FIELD_DEFINITIONS } from "../../../packages/denali-domain/src/registry/denaliFieldRegistryData";
import {
  getDenaliFieldRegistryByStep,
  listDenaliRegistryCanonicalPaths,
} from "../../../packages/denali-domain/src/registry/DenaliFieldRegistry";

import {
  DENALI_EDIT_SECTION_IDS,
  getSuppressedCanonicalPathsForSection,
  listEditFlatSuppressedCanonicalPaths,
} from "../src/features/tours/denali/fields/denaliSectionSuppress";

const TEMPLATE_CONTAINERS = new Set([
  "overview",
  "metrics",
  "program",
  "transport",
  "pricing",
  "participants",
  "policies",
  "photos",
  "gatheringPoints",
  "gatheringPoint",
  "startPoint",
  "summitPoint",
  "campPoint",
  "endPoint",
  "customServiceLabels",
  "meetingPoint",
]);

function main(): void {
  const registry = new Set(listDenaliRegistryCanonicalPaths());
  const suppressedUnion = new Set(listEditFlatSuppressedCanonicalPaths());
  const issues: string[] = [];

  for (const path of suppressedUnion) {
    if (!registry.has(path)) {
      issues.push(`flat-edit SUPPRESSED path not in registry: ${path}`);
    }
  }

  for (const sectionId of DENALI_EDIT_SECTION_IDS) {
    const suppressedForSection = getSuppressedCanonicalPathsForSection(sectionId);
    const rows = getDenaliFieldRegistryByStep(sectionId);
    for (const row of rows) {
      if (row.inRuleModel === false) continue;
      if (!suppressedForSection.has(row.canonicalPath)) {
        issues.push(
          `registry path not suppressed for flat-edit section ${sectionId}: ${row.canonicalPath}`,
        );
      }
    }
  }

  for (const key of DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS) {
    if (!registry.has(key) && !TEMPLATE_CONTAINERS.has(key)) {
      issues.push(`template top-level key orphaned: ${key}`);
    }
  }

  const defPaths = new Set(DENALI_FIELD_DEFINITIONS.map((d) => d.canonicalPath));
  for (const path of listDenaliRegistryCanonicalPaths()) {
    if (!defPaths.has(path)) {
      issues.push(`registry entry missing from DENALI_FIELD_DEFINITIONS: ${path}`);
    }
  }

  if (issues.length > 0) {
    console.error(JSON.stringify({ ok: false, issues }, null, 2));
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      ok: true,
      registryPathCount: registry.size,
      suppressedPathCount: suppressedUnion.size,
      templateTopLevelKeys: DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS.length,
    }),
  );
}

main();
