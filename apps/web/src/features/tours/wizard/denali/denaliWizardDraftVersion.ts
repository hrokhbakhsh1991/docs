import { denaliWizardSteps } from "@/features/tours/wizard/denaliStepConfig";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  DENALI_RULE_MODEL_VERSION,
  denaliRuleSet,
  type DenaliRuleSet,
} from "@/features/tours/wizard/denali/rules/denaliRuleModel";

/** Current draft envelope field for structural compatibility. */
export const DENALI_WIZARD_DRAFT_VERSION_HASH_KEY = "versionHash" as const;

/** @deprecated Read during migration from earlier drafts. */
export const DENALI_WIZARD_DRAFT_VERSION_HASH_KEY_LEGACY =
  "_wizardFormStructureVersionHash" as const;

function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, key) => {
          acc[key] = (v as Record<string, unknown>)[key];
          return acc;
        }, {});
    }
    return v;
  });
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function fingerprintDenaliRuleSet(ruleSet: DenaliRuleSet): unknown {
  const models: unknown[] = [];
  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = ruleSet[category][duration];
      if (model == null) {
        continue;
      }
      models.push({
        category,
        duration,
        fields: [...model.fields]
          .map((field) => ({
            path: field.path,
            required: field.required,
            hidden: field.hidden,
            step: field.step,
          }))
          .sort((a, b) => a.path.localeCompare(b.path)),
      });
    }
  }
  return models;
}

/** Fingerprint of {@link denaliWizardSteps} + {@link denaliRuleSet}. */
export function buildDenaliWizardDraftVersionFingerprint(): unknown {
  return {
    ruleModelVersion: DENALI_RULE_MODEL_VERSION,
    steps: [...denaliWizardSteps],
    ruleSet: fingerprintDenaliRuleSet(denaliRuleSet),
  };
}

export function computeDenaliWizardDraftVersionHash(
  fingerprint: unknown = buildDenaliWizardDraftVersionFingerprint(),
): string {
  return fnv1aHex(stableJson(fingerprint));
}

let cachedVersionHash: string | null = null;

export function getDenaliWizardDraftVersionHash(): string {
  if (cachedVersionHash == null) {
    cachedVersionHash = computeDenaliWizardDraftVersionHash();
  }
  return cachedVersionHash;
}

export function readDenaliWizardDraftVersionHashFromRecord(
  parsed: Record<string, unknown> | null | undefined,
): string | undefined {
  if (parsed == null || typeof parsed !== "object") {
    return undefined;
  }
  const raw =
    parsed[DENALI_WIZARD_DRAFT_VERSION_HASH_KEY] ??
    parsed[DENALI_WIZARD_DRAFT_VERSION_HASH_KEY_LEGACY];
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
}

export function isDenaliWizardDraftVersionCompatible(
  storedHash: string | undefined,
  currentHash: string = getDenaliWizardDraftVersionHash(),
): boolean {
  return storedHash != null && storedHash.trim() !== "" && storedHash === currentHash;
}
