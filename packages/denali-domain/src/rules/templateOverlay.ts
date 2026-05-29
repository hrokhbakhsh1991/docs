import { mapDenaliCanonicalToFormPath } from "./denaliRuleRequired";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  denaliRuleSet,
  type DenaliRuleFieldDefinition,
  type DenaliRuleModel,
  type DenaliRuleSet,
} from "./denaliRuleModel";

export type FieldRuleOverlayPatch = {
  readonly visibility?: "always" | "active" | "hidden";
  readonly required?: "required" | "recommended" | "optional" | "forbidden";
};

const REQUIREDNESS: ReadonlySet<string> = new Set([
  "required",
  "recommended",
  "optional",
  "forbidden",
]);

const VISIBILITY: ReadonlySet<string> = new Set(["always", "active", "hidden"]);

export function parseFieldRulesOverlay(
  raw: Readonly<Record<string, unknown>> | undefined,
): ReadonlyMap<string, FieldRuleOverlayPatch> {
  const out = new Map<string, FieldRuleOverlayPatch>();
  if (!raw) {
    return out;
  }
  for (const [path, value] of Object.entries(raw)) {
    if (!path.trim() || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const o = value as Record<string, unknown>;
    const visibility =
      typeof o.visibility === "string" && VISIBILITY.has(o.visibility)
        ? (o.visibility as FieldRuleOverlayPatch["visibility"])
        : undefined;
    const required =
      typeof o.required === "string" && REQUIREDNESS.has(o.required)
        ? (o.required as FieldRuleOverlayPatch["required"])
        : undefined;
    if (visibility === undefined && required === undefined) {
      continue;
    }
    out.set(path, {
      ...(visibility !== undefined ? { visibility } : {}),
      ...(required !== undefined ? { required } : {}),
    });
  }
  return out;
}

function overlayPatchForPath(
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
  canonicalPath: string,
  formPath: string,
): FieldRuleOverlayPatch | undefined {
  return overlay.get(canonicalPath) ?? overlay.get(formPath);
}

function applyOverlayToField(
  field: DenaliRuleFieldDefinition,
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
): DenaliRuleFieldDefinition {
  const formPath = mapDenaliCanonicalToFormPath(field.path);
  const patch = overlayPatchForPath(overlay, field.path, formPath);
  if (patch == null) {
    return field;
  }

  let hidden = field.hidden;
  if (patch.visibility === "hidden") {
    hidden = true;
  } else if (patch.visibility === "always" || patch.visibility === "active") {
    hidden = false;
  }

  let required = field.required;
  if (patch.required === "required") {
    required = true;
  } else if (patch.required === "optional" || patch.required === "forbidden") {
    required = false;
  }

  return { ...field, hidden, required };
}

function cloneRuleModel(model: DenaliRuleModel): DenaliRuleModel {
  return {
    ...model,
    fields: model.fields.map((field) => ({ ...field })),
  };
}

export function applyOverlayToRuleSet(
  base: DenaliRuleSet,
  overlay: ReadonlyMap<string, FieldRuleOverlayPatch>,
): DenaliRuleSet {
  const next = {} as DenaliRuleSet;

  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    next[category] = {} as DenaliRuleSet[typeof category];
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = base[category][duration];
      if (model == null) {
        next[category][duration] = null;
        continue;
      }
      const cloned = cloneRuleModel(model);
      next[category][duration] = {
        ...cloned,
        fields: cloned.fields.map((field) => applyOverlayToField(field, overlay)),
      };
    }
  }

  return next;
}

export function resolveDenaliRuleSetFromOverlay(
  fieldRulesOverlay: Readonly<Record<string, unknown>> | undefined,
  base: DenaliRuleSet = denaliRuleSet,
): DenaliRuleSet {
  return applyOverlayToRuleSet(base, parseFieldRulesOverlay(fieldRulesOverlay));
}
