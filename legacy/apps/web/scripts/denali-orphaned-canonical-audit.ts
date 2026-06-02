/**
 * Checks registry coverage for flat-edit sections and template top-level keys.
 */
import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "@repo/types/denali";
import { DENALI_FIELD_DEFINITIONS } from "../../../packages/denali-domain/src/registry/denaliFieldRegistryData";
import {
  getDenaliFieldRegistryByStep,
  listDenaliRegistryCanonicalPaths,
} from "../../../packages/denali-domain/src/registry/DenaliFieldRegistry";

import {
  DENALI_EDIT_SECTION_IDS,
} from "../src/features/tours/denali/fields/denaliSectionSuppress";
import { shouldRenderDenaliRegistryField } from "../src/features/tours/denali/fields/denaliFieldRendererAnchors";

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
  const issues: string[] = [];

  for (const sectionId of DENALI_EDIT_SECTION_IDS) {
    const rows = getDenaliFieldRegistryByStep(sectionId).filter(
      (row) => row.inRuleModel !== false && shouldRenderDenaliRegistryField(row),
    );
    if (rows.length === 0) {
      issues.push(`flat-edit section has no renderable registry rows: ${sectionId}`);
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
      editSectionCount: DENALI_EDIT_SECTION_IDS.length,
      templateTopLevelKeys: DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS.length,
    }),
  );
}

main();
