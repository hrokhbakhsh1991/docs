/**
 * Structural guard: template / preset canonical keys ↔ Denali field registry.
 */
import assert from "node:assert/strict";

import { DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS } from "@repo/types/denali";
import {
  listDenaliRegistryCanonicalPaths,
  listDenaliTemplateCanonicalFieldPaths,
} from "@repo/denali-domain";

import { listDenaliTemplateStorageFieldPaths } from "@repo/denali-domain";

import {
  DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS,
  getDenaliTemplateSeedFieldDefinition,
  templateSeedRhfPath,
} from "@/lib/validation/tour-wizard-template-builder-form";
import { resolveModernTemplateBuilderFieldPaths } from "@/app/(app)/settings/tour-wizard-template/tour-wizard-template-section-groups";
import { describeStructuralGuard } from "@/features/tours/wizard/testing/structural-guard";

/** Top-level canonical model keys that are containers, not 1:1 registry rows. */
const TEMPLATE_CONTAINER_KEYS = new Set([
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

describeStructuralGuard("denali template canonical registry", [
  {
    name: "every rule-model template field path exists in DENALI_FIELD_REGISTRY",
    run: () => {
      const registryPaths = new Set(listDenaliRegistryCanonicalPaths());
      const templatePaths = listDenaliTemplateCanonicalFieldPaths();
      const missing = templatePaths.filter((path) => !registryPaths.has(path));
      assert.deepEqual(missing, []);
    },
  },
  {
    name: "every DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEY is a registry path or known container",
    run: () => {
      const registryPaths = new Set(listDenaliRegistryCanonicalPaths());
      const unknown = DENALI_CANONICAL_TEMPLATE_TOP_LEVEL_KEYS.filter(
        (key) => !registryPaths.has(key) && !TEMPLATE_CONTAINER_KEYS.has(key),
      );
      assert.deepEqual(unknown, []);
    },
  },
  {
    name: "every settings builder seed storagePath maps to registry rhfPath",
    run: () => {
      const paths = resolveModernTemplateBuilderFieldPaths(listDenaliTemplateStorageFieldPaths());
      const missing: string[] = [];
      for (const storagePath of paths) {
        const definition = getDenaliTemplateSeedFieldDefinition(storagePath);
        if (!definition) {
          missing.push(storagePath);
          continue;
        }
        if (DENALI_TEMPLATE_SEED_COMPOSITE_ZOD_KINDS.has(definition.zodKind)) {
          continue;
        }
        if (templateSeedRhfPath(storagePath) !== definition.rhfPath) {
          missing.push(storagePath);
        }
      }
      assert.deepEqual(missing, []);
    },
  },
]);
