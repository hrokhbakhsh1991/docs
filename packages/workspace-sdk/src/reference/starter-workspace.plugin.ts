import { noopWorkspaceValidationHooks } from "../plugin/workspace-validation";
import type { WorkspacePlugin } from "../plugin/workspace-plugin";
import { STARTER_WORKSPACE_PLUGIN_ID } from "../plugin/workspace-plugin-id";
import { STARTER_WORKSPACE_TYPE } from "../plugin/workspace-type";

const STARTER_FIELD_REGISTRY = {
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
      id: "details.summary",
      canonicalPath: "details.summary",
      stepId: "details",
      kind: "text" as const,
      required: false,
    },
  ],
};

const STARTER_RULE_SET = {
  version: 1,
  matrixDimensions: ["variant"],
  defaultCellId: "default",
  cells: [
    {
      cellId: "default",
      dimensions: { variant: "default" },
      fieldOverrides: [
        { fieldId: "basics.title", required: true, hidden: false },
        { fieldId: "details.summary", hidden: false },
      ],
    },
  ],
};

const STARTER_WIZARD_SURFACE = {
  wizardMode: "classic" as const,
  railId: "starter_base",
  roots: ["basics", "details"],
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
};

const STARTER_LIFECYCLE = {
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
};

/** Reference plugin for tests and phase-2 bootstrap (moves to `packages/workspaces/starter`). */
export const starterWorkspacePlugin: WorkspacePlugin = {
  id: STARTER_WORKSPACE_PLUGIN_ID,
  version: 1,
  supportedWorkspaceTypes: [STARTER_WORKSPACE_TYPE],
  fieldRegistry: STARTER_FIELD_REGISTRY,
  ruleSet: STARTER_RULE_SET,
  wizard: STARTER_WIZARD_SURFACE,
  validation: noopWorkspaceValidationHooks,
  lifecycle: STARTER_LIFECYCLE,
};
