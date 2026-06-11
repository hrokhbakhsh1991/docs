import type { WorkspaceFieldKind } from "../plugin-types";
import { createNoopWorkspaceValidationHooks } from "../plugin/workspace-validation";
import type { WorkspacePlugin } from "../plugin/workspace-plugin";
import { STARTER_WORKSPACE_PLUGIN_ID } from "../plugin/workspace-plugin-id";
import { STARTER_WORKSPACE_TYPE } from "../plugin/workspace-type";
import type { WorkspaceThemeContract } from "../theme/workspace-theme.contract";
import { starterOperatorSettingsSurface } from "./starter-settings.manifest";

/** Relative to workspace package root — published via `@app-tour/workspace-starter` exports. */
export const STARTER_THEME_TOKENS_STYLESHEET = "theme/tokens.css" as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

/** Phase 3 shell — kinds with ui-primitives wiring (3.3.x). */
export const STARTER_ALLOWED_FIELD_KINDS = [
  "text",
  "enum",
  "boolean",
] as const satisfies readonly WorkspaceFieldKind[];

function assertStarterFieldKinds(): void {
  for (const field of STARTER_FIELD_REGISTRY.fields) {
    if (!(STARTER_ALLOWED_FIELD_KINDS as readonly string[]).includes(field.kind)) {
      throw new Error(
        `Starter field "${field.id}" uses kind "${field.kind}"; allowed: ${STARTER_ALLOWED_FIELD_KINDS.join(", ")}`
      );
    }
  }
}

export const STARTER_FIELD_REGISTRY = deepFreeze({
  version: 1,
  fields: [
    {
      id: "basics.title",
      canonicalPath: "basics.title",
      stepId: "basics",
      kind: "text" as const,
      required: true,
      tags: ["core"],
    },
    {
      id: "basics.featured",
      canonicalPath: "basics.featured",
      stepId: "basics",
      kind: "boolean" as const,
      required: false,
    },
    {
      id: "details.summary",
      canonicalPath: "details.summary",
      stepId: "details",
      kind: "text" as const,
      required: false,
    },
    {
      id: "details.status",
      canonicalPath: "details.status",
      stepId: "details",
      kind: "enum" as const,
      required: false,
      enumOptions: ["draft", "open", "published"],
    },
  ],
});

assertStarterFieldKinds();

export const STARTER_RULE_SET = deepFreeze({
  version: 1,
  matrixDimensions: ["variant"],
  defaultCellId: "default",
  cells: [
    {
      cellId: "default",
      dimensions: { variant: "default" },
      fieldOverrides: [
        { fieldId: "basics.title", required: true, hidden: false },
        { fieldId: "basics.featured", hidden: false },
        { fieldId: "details.summary", hidden: false },
        { fieldId: "details.status", hidden: false },
      ],
    },
    {
      cellId: "basic",
      dimensions: { variant: "basic" },
      fieldOverrides: [
        { fieldId: "basics.title", required: false, hidden: false },
        { fieldId: "basics.featured", hidden: false },
        { fieldId: "details.summary", hidden: false },
        { fieldId: "details.status", hidden: false },
      ],
    },
  ],
});

export const STARTER_WIZARD_SURFACE = deepFreeze({
  wizardMode: "classic" as const,
  railId: "starter_base",
  roots: ["basics", "details"],
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
});

export const STARTER_LIFECYCLE = deepFreeze({
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
});

/** Single source for starter registry/rules/wizard/lifecycle — shared by SDK reference and workspace-starter. */
export function createStarterWorkspacePlugin(theme: WorkspaceThemeContract): WorkspacePlugin {
  return deepFreeze({
    id: STARTER_WORKSPACE_PLUGIN_ID,
    version: 1,
    contractVersion: 1,
    supportedWorkspaceTypes: deepFreeze([STARTER_WORKSPACE_TYPE]),
    fieldRegistry: STARTER_FIELD_REGISTRY,
    ruleSet: STARTER_RULE_SET,
    wizard: STARTER_WIZARD_SURFACE,
    validation: createNoopWorkspaceValidationHooks(),
    lifecycle: STARTER_LIFECYCLE,
    theme: deepFreeze({ ...theme }),
    operatorSettings: deepFreeze({ ...starterOperatorSettingsSurface }),
  });
}
