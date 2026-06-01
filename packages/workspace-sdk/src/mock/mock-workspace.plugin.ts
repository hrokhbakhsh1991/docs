import { noopWorkspaceValidationHooks } from "../plugin/workspace-validation";
import type { WorkspacePlugin } from "../plugin/workspace-plugin";
import { MOCK_WORKSPACE_PLUGIN_ID } from "../plugin/workspace-plugin-id";

const MOCK_FIELD_REGISTRY = {
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

const MOCK_RULE_SET = {
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

const MOCK_WIZARD_SURFACE = {
  wizardMode: "classic" as const,
  railId: "generic_base",
  roots: ["basics", "details"],
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
};

const MOCK_LIFECYCLE = {
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
};

/** Reference plugin for unit tests and API bridge experiments (Phase 1.2). */
export const mockWorkspacePlugin: WorkspacePlugin = {
  id: MOCK_WORKSPACE_PLUGIN_ID,
  version: 1,
  supportedProfiles: ["general"],
  fieldRegistry: MOCK_FIELD_REGISTRY,
  ruleSet: MOCK_RULE_SET,
  wizard: MOCK_WIZARD_SURFACE,
  validation: noopWorkspaceValidationHooks,
  lifecycle: MOCK_LIFECYCLE,
};
