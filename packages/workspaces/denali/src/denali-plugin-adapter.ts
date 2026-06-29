import type { WorkspaceFieldRegistry, WorkspaceRuleSet } from "@app-tour/workspace-sdk";

import {
  denaliRegistryPresentationFields,
} from "./field-registry/denali-integration-field-presentation";
import { DENALI_FIELD_DEFINITIONS } from "./field-registry/denaliFieldRegistryData";
import {
  resolveDenaliCompositeRendererId,
  resolveDenaliFieldRenderer,
  resolveDenaliWorkspaceFieldRegistryKind,
} from "./composites/denali-composite-registry";
import { WIZARD_PALETTE_ROADMAP_TAG } from "./settings/denali-wizard-template-roadmap";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  type DenaliRuleSet,
} from "./rules/denaliRuleModel.types";
import { denaliRuleSet } from "./rules/denaliRuleModel";

function buildDenaliFieldIdByCanonicalPath(): Readonly<Record<string, string>> {
  const map: Record<string, string> = {};
  for (const def of DENALI_FIELD_DEFINITIONS) {
    const resolution = resolveDenaliFieldRenderer(def);
    if (resolution == null) continue;
    map[def.canonicalPath] = resolveDenaliCompositeRendererId(def) ?? def.canonicalPath;
  }
  return Object.freeze(map);
}

const DENALI_FIELD_ID_BY_CANONICAL_PATH = buildDenaliFieldIdByCanonicalPath();

/** INV-WIZ-002 — omitted from Settings wizard-template builder palette (Layer C). */
export const WIZARD_OVERLAY_EXCLUDE_TAG = "wizard_overlay_exclude" as const;

function denaliFieldRegistryTags(def: (typeof DENALI_FIELD_DEFINITIONS)[number]): readonly string[] | undefined {
  const surface = def.settingsSurface ?? "section";
  if (surface === "palette_roadmap") {
    const tags = [...def.tags, WIZARD_PALETTE_ROADMAP_TAG];
    return tags.length > 0 ? tags : [WIZARD_PALETTE_ROADMAP_TAG];
  }
  const tags =
    surface === "section" ? [...def.tags] : [...def.tags, WIZARD_OVERLAY_EXCLUDE_TAG];
  return tags.length > 0 ? tags : undefined;
}

function denaliRoadmapPaletteRegistryField(
  def: (typeof DENALI_FIELD_DEFINITIONS)[number]
): WorkspaceFieldRegistry["fields"][number] {
  return Object.freeze({
    id: def.canonicalPath,
    canonicalPath: def.canonicalPath,
    stepId: def.stepId,
    kind: "boolean" as const,
    required: false,
    tags: denaliFieldRegistryTags(def),
  });
}

export function denaliFieldIdForCanonicalPath(canonicalPath: string): string {
  return DENALI_FIELD_ID_BY_CANONICAL_PATH[canonicalPath] ?? canonicalPath;
}

export function buildDenaliWorkspaceFieldRegistry(): WorkspaceFieldRegistry {
  const fields = DENALI_FIELD_DEFINITIONS.flatMap((def) => {
    if ((def.settingsSurface ?? "section") === "palette_roadmap") {
      return [denaliRoadmapPaletteRegistryField(def)];
    }
    const resolution = resolveDenaliFieldRenderer(def);
    if (resolution == null) return [];

    const compositeRendererId = resolveDenaliCompositeRendererId(def);
    const fieldId = compositeRendererId ?? def.canonicalPath;
    const kind = resolveDenaliWorkspaceFieldRegistryKind(def, resolution);

    const tags = denaliFieldRegistryTags(def);
    const presentation = denaliRegistryPresentationFields({
      id: fieldId,
      canonicalPath: def.canonicalPath,
      tags,
    });

    return [
      Object.freeze({
        id: fieldId,
        canonicalPath: def.canonicalPath,
        stepId: def.stepId,
        kind,
        required: def.ruleDefaults.required,
        tags,
        ...presentation,
        ...(kind === "enum" && resolution.enumOptions != null
          ? { enumOptions: resolution.enumOptions }
          : {}),
      }),
    ];
  });

  return Object.freeze({
    version: 1,
    fields: Object.freeze(fields),
  });
}

export function buildDenaliWizardRoots(): readonly string[] {
  const roots = new Set<string>();
  for (const def of DENALI_FIELD_DEFINITIONS) {
    const topLevel = def.canonicalPath.split(".")[0];
    if (topLevel) roots.add(topLevel);
    roots.add(def.stepId);
  }
  return Object.freeze([...roots].sort());
}

/** Nested canonical containers only — not scalar top-level fields or wizard step ids. */
export const DENALI_CANONICAL_OBJECT_ROOTS = Object.freeze(
  new Set([
    "program",
    "transport",
    "pricing",
    "participants",
    "policies",
    "tripDetails",
    "photos",
    "gatheringPoints",
  ])
);

export function buildDenaliWorkspaceRuleSet(
  source: DenaliRuleSet = denaliRuleSet,
  registry: WorkspaceFieldRegistry = buildDenaliWorkspaceFieldRegistry()
): WorkspaceRuleSet {
  const registryFieldIds = new Set(registry.fields.map((field) => field.id));
  const cells = [];

  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = source[category][duration];
      if (model == null) continue;
      const fieldOverrides = model.fields
        .map((field) =>
          Object.freeze({
            fieldId: denaliFieldIdForCanonicalPath(field.path),
            required: field.required,
            hidden: field.hidden,
          })
        )
        .filter((override) => registryFieldIds.has(override.fieldId));

      cells.push(
        Object.freeze({
          cellId: `${category}:${duration}`,
          dimensions: Object.freeze({ category, duration }),
          fieldOverrides: Object.freeze(fieldOverrides),
        })
      );
    }
  }

  return Object.freeze({
    version: 1,
    matrixDimensions: Object.freeze(["category", "duration"]),
    defaultCellId: "mountain:single_day",
    cells: Object.freeze(cells),
  });
}
