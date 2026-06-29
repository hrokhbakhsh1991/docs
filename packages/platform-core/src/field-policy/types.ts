import type { FieldPolicyEntityState } from "./entity-state";

export type { FieldPolicyEntityState } from "./entity-state";

export type FieldPolicySurface =
  | "wizard"
  | "public_website"
  | "profile"
  | "admin_panel"
  | "delivery";

export type FieldPolicyState = "hidden" | "visible" | "required" | "readonly";

export type FieldDefinitionKind =
  | "text"
  | "number"
  | "date"
  | "enum"
  | "boolean"
  | "composite";

export type FieldDefinition = {
  readonly id: string;
  readonly workspaceType: string;
  readonly canonicalPath: string;
  readonly kind: FieldDefinitionKind;
  readonly labelKey?: string;
  readonly descriptionKey?: string;
  /** Admin-facing label for integration/settings surfaces (not i18n key). */
  readonly adminLabel?: string;
  readonly adminDescription?: string;
  readonly group?: string;
  readonly icon?: string;
  readonly tags?: readonly string[];
  readonly validation?: Readonly<Record<string, unknown>>;
  readonly version: number;
};

export type SimpleCondition =
  | { readonly kind: "always" }
  | {
      readonly kind: "equals";
      readonly path: string;
      readonly value: string | number | boolean | null;
    }
  | { readonly kind: "exists"; readonly path: string };

export type FieldPolicyRule = {
  readonly id: string;
  readonly workspaceType: string;
  readonly fieldId: string;
  readonly surface: FieldPolicySurface;
  readonly state: FieldPolicyState;
  readonly condition?: SimpleCondition;
  readonly priority: number;
  readonly enabled: boolean;
};

export type ResolveFieldStateInput = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly surface: FieldPolicySurface;
  readonly requestedFieldIds?: readonly string[];
  readonly entityState: FieldPolicyEntityState;
  readonly definitions: readonly FieldDefinition[];
  readonly rules: readonly FieldPolicyRule[];
};

export type ResolvedFieldState = {
  readonly fieldId: string;
  readonly canonicalPath: string;
  readonly state: FieldPolicyState;
  readonly reasonRuleId?: string;
};
