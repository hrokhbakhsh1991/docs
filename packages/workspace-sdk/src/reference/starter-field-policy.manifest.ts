import type { WorkspaceFieldPolicyManifest } from "../registry/field-policy-manifest";

/**
 * Reference starter field policy — provider-agnostic delivery/public surfaces only.
 * Workspace-specific wizard matrices remain on WorkspaceRuleSet; this manifest is additive.
 */
export const STARTER_FIELD_POLICY_MANIFEST = Object.freeze({
  manifestVersion: 1,
  definitions: Object.freeze([
    Object.freeze({
      id: "basics.title",
      canonicalPath: "basics.title",
      kind: "text" as const,
      labelKey: "starter.fields.basics.title",
      tags: Object.freeze(["core"]),
    }),
    Object.freeze({
      id: "basics.featured",
      canonicalPath: "basics.featured",
      kind: "boolean" as const,
      labelKey: "starter.fields.basics.featured",
    }),
    Object.freeze({
      id: "details.summary",
      canonicalPath: "details.summary",
      kind: "text" as const,
      labelKey: "starter.fields.details.summary",
    }),
    Object.freeze({
      id: "details.status",
      canonicalPath: "details.status",
      kind: "enum" as const,
      labelKey: "starter.fields.details.status",
      validation: Object.freeze({ enumOptions: ["draft", "open", "published"] }),
    }),
  ]),
  rules: Object.freeze([
    Object.freeze({
      id: "starter.public.title",
      fieldId: "basics.title",
      surface: "public_website" as const,
      state: "visible" as const,
      condition: Object.freeze({
        kind: "equals" as const,
        path: "tour.status",
        value: "OPEN",
      }),
      priority: 10,
      enabled: true,
    }),
    Object.freeze({
      id: "starter.public.summary",
      fieldId: "details.summary",
      surface: "public_website" as const,
      state: "visible" as const,
      condition: Object.freeze({
        kind: "equals" as const,
        path: "tour.status",
        value: "OPEN",
      }),
      priority: 10,
      enabled: true,
    }),
    Object.freeze({
      id: "starter.delivery.title",
      fieldId: "basics.title",
      surface: "delivery" as const,
      state: "visible" as const,
      condition: Object.freeze({ kind: "always" as const }),
      priority: 10,
      enabled: true,
    }),
    Object.freeze({
      id: "starter.delivery.summary",
      fieldId: "details.summary",
      surface: "delivery" as const,
      state: "visible" as const,
      condition: Object.freeze({ kind: "always" as const }),
      priority: 10,
      enabled: true,
    }),
    Object.freeze({
      id: "starter.delivery.featured.hidden",
      fieldId: "basics.featured",
      surface: "delivery" as const,
      state: "hidden" as const,
      condition: Object.freeze({ kind: "always" as const }),
      priority: 1,
      enabled: true,
    }),
  ]),
}) satisfies WorkspaceFieldPolicyManifest;
