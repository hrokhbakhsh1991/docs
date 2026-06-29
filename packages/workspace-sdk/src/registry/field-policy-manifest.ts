import type { WorkspaceFieldKind } from "./field-registry";
import { assertNoLegacyDeliveryCandidateFieldIds } from "./guard-legacy-delivery-candidate-field-ids";

/** Surfaces supported by the platform field policy resolver. */
export type WorkspaceFieldPolicySurface =
  | "wizard"
  | "public_website"
  | "profile"
  | "admin_panel"
  | "delivery";

export type WorkspaceFieldPolicyState = "hidden" | "visible" | "required" | "readonly";

export type WorkspaceSimpleCondition =
  | { readonly kind: "always" }
  | {
      readonly kind: "equals";
      readonly path: string;
      readonly value: string | number | boolean | null;
    }
  | { readonly kind: "exists"; readonly path: string };

export type WorkspaceFieldPolicyDefinition = {
  readonly id: string;
  readonly canonicalPath: string;
  readonly kind: WorkspaceFieldKind;
  readonly labelKey?: string;
  readonly descriptionKey?: string;
  readonly tags?: readonly string[];
  readonly validation?: Readonly<Record<string, unknown>>;
};

export type WorkspaceFieldPolicyRule = {
  readonly id: string;
  readonly fieldId: string;
  readonly surface: WorkspaceFieldPolicySurface;
  readonly state: WorkspaceFieldPolicyState;
  readonly condition?: WorkspaceSimpleCondition;
  readonly priority: number;
  readonly enabled: boolean;
};

/**
 * Optional workspace field policy manifest.
 * Provider-agnostic: no Telegram/email/SMS identifiers or delivery formatting.
 */
export type WorkspaceFieldPolicyManifest = {
  readonly manifestVersion: 1;
  readonly definitions: readonly WorkspaceFieldPolicyDefinition[];
  readonly rules: readonly WorkspaceFieldPolicyRule[];
};

const FIELD_POLICY_SURFACES: readonly WorkspaceFieldPolicySurface[] = [
  "wizard",
  "public_website",
  "profile",
  "admin_panel",
  "delivery",
] as const;

const FIELD_POLICY_STATES: readonly WorkspaceFieldPolicyState[] = [
  "hidden",
  "visible",
  "required",
  "readonly",
] as const;

const FORBIDDEN_MANIFEST_TERMS = [
  "telegram",
  "email",
  "sms",
  "slack",
  "whatsapp",
  "formatter",
  "template",
  "FieldEventTrigger",
  "FieldDeliveryTarget",
  "FieldTimingRule",
] as const;

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`FIELD_POLICY_MANIFEST_INVALID:${label}`);
  }
  return value.trim();
}

function validateSimpleCondition(condition: WorkspaceSimpleCondition, label: string): void {
  if (condition.kind === "always") {
    return;
  }
  assertNonEmptyString(condition.path, `${label}.path`);
  if (condition.kind === "equals" && condition.value === undefined) {
    throw new Error(`FIELD_POLICY_MANIFEST_INVALID:${label}.value`);
  }
}

function assertNoForbiddenTerms(value: string, label: string): void {
  const lower = value.toLowerCase();
  for (const term of FORBIDDEN_MANIFEST_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      throw new Error(`FIELD_POLICY_MANIFEST_FORBIDDEN_TERM:${label}:${term}`);
    }
  }
}

/** Fail closed before plugin registry construction when fieldPolicy is present. */
export function validateFieldPolicyManifest(
  manifest: WorkspaceFieldPolicyManifest,
  knownFieldIds: ReadonlySet<string>,
): void {
  assertNoLegacyDeliveryCandidateFieldIds(manifest, "validateFieldPolicyManifest");

  if (manifest.manifestVersion !== 1) {
    throw new Error(`FIELD_POLICY_MANIFEST_INVALID_MANIFEST_VERSION:${manifest.manifestVersion}`);
  }

  const serialized = JSON.stringify(manifest);
  assertNoForbiddenTerms(serialized, "manifest");

  const definitionIds = new Set<string>();
  for (const definition of manifest.definitions) {
    const id = assertNonEmptyString(definition.id, "definition.id");
    if (definitionIds.has(id)) {
      throw new Error(`FIELD_POLICY_MANIFEST_DUPLICATE_DEFINITION:${id}`);
    }
    definitionIds.add(id);
    assertNonEmptyString(definition.canonicalPath, `definition.${id}.canonicalPath`);
  }

  const ruleIds = new Set<string>();
  for (const rule of manifest.rules) {
    const id = assertNonEmptyString(rule.id, "rule.id");
    if (ruleIds.has(id)) {
      throw new Error(`FIELD_POLICY_MANIFEST_DUPLICATE_RULE:${id}`);
    }
    ruleIds.add(id);
    const fieldId = assertNonEmptyString(rule.fieldId, `rule.${id}.fieldId`);
    if (!definitionIds.has(fieldId) && !knownFieldIds.has(fieldId)) {
      throw new Error(`FIELD_POLICY_MANIFEST_UNKNOWN_FIELD:${fieldId}`);
    }
    if (!(FIELD_POLICY_SURFACES as readonly string[]).includes(rule.surface)) {
      throw new Error(`FIELD_POLICY_MANIFEST_INVALID_SURFACE:${rule.surface}`);
    }
    if (!(FIELD_POLICY_STATES as readonly string[]).includes(rule.state)) {
      throw new Error(`FIELD_POLICY_MANIFEST_INVALID_STATE:${rule.state}`);
    }
    if (rule.condition != null) {
      validateSimpleCondition(rule.condition, `rule.${id}.condition`);
    }
    if (!Number.isFinite(rule.priority)) {
      throw new Error(`FIELD_POLICY_MANIFEST_INVALID_PRIORITY:${id}`);
    }
  }
}
