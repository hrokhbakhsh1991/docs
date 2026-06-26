import { sdkOk, type SdkResult } from "../errors/sdk-result";
import type { WorkspaceFieldRegistry } from "../registry/field-registry";
import { validateWorkspaceFieldRegistry } from "../registry/validate-field-registry";
import { validateWorkspaceRuleSet } from "../registry/validate-rule-set";
import {
  fail,
  isPlainObject,
  requireArray,
  requireFiniteNumber,
  requireNonEmptyString,
  requirePlainObject,
  violation,
} from "../registry/schema-helper";
import type { WorkspaceLifecycleContract } from "./workspace-lifecycle";
import { validateLifecycleGraph } from "./workspace-lifecycle-validation";
import type { WorkspacePlugin } from "./workspace-plugin.contract";
import type { WorkspaceValidationHooks } from "./workspace-validation";
import type { WorkspaceWizardMode, WorkspaceWizardSurface } from "./workspace-wizard-surface";
import {
  throwWorkspaceValidationError,
  type WorkspaceSdkValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
import {
  safeParseWorkspaceCommerceConfig,
  type WorkspaceCommerceConfig,
} from "../metadata/commerce-schema.js";

export {
  throwWorkspaceValidationError,
  isWorkspaceSdkValidationError,
  workspaceSdkValidationErrorCode,
  WorkspaceHooksValidationError,
  WorkspaceLifecycleValidationError,
  WorkspacePluginShapeError,
  WorkspaceRegistryValidationError,
  WorkspaceRuleSetValidationError,
  WorkspaceThemeValidationError,
  WorkspaceWizardValidationError,
  type WorkspaceSdkValidationError,
  type WorkspaceSdkValidationErrorCode,
  type WorkspacePluginValidationErrorCode,
} from "../errors/workspace-validation-errors.js";
export {
  assertWorkspaceFieldRegistry,
  validateWorkspaceFieldRegistry,
} from "../registry/validate-field-registry";
export { assertWorkspaceRuleSet, validateWorkspaceRuleSet } from "../registry/validate-rule-set";

const WIZARD_MODES = new Set<WorkspaceWizardMode>(["classic", "schema"]);

type PluginResult = SdkResult<WorkspacePlugin, WorkspaceSdkValidationErrorCode>;

function throwOnError(result: SdkResult<unknown, WorkspaceSdkValidationErrorCode>): void {
  if (!result.ok) {
    throwWorkspaceValidationError(result.error.code, result.error.message, {
      cause: result.error.cause,
    });
  }
}

function validateWorkspaceWizardSurface(
  wizard: unknown
): SdkResult<WorkspaceWizardSurface, WorkspaceSdkValidationErrorCode> {
  const root = requirePlainObject(wizard, "wizard", "INVALID_WIZARD_SURFACE");
  if (!root.ok) return root;

  if (!WIZARD_MODES.has(root.value.wizardMode as WorkspaceWizardMode)) {
    return fail(
      violation("INVALID_WIZARD_SURFACE", 'wizard.wizardMode must be "classic" or "schema"')
    );
  }

  const railId = requireNonEmptyString(
    root.value.railId,
    "wizard.railId",
    "INVALID_WIZARD_SURFACE"
  );
  if (!railId.ok) return railId;

  const roots = requireArray(root.value.roots, "wizard.roots", "INVALID_WIZARD_SURFACE");
  if (!roots.ok) return roots;
  for (const [index, entry] of roots.value.entries()) {
    const rootName = requireNonEmptyString(
      entry,
      `wizard.roots[${index}]`,
      "INVALID_WIZARD_SURFACE"
    );
    if (!rootName.ok) return rootName;
  }

  const inactive = requireArray(
    root.value.inactiveFieldGroups,
    "wizard.inactiveFieldGroups",
    "INVALID_WIZARD_SURFACE"
  );
  if (!inactive.ok) return inactive;
  for (const [index, group] of inactive.value.entries()) {
    const groupName = requireNonEmptyString(
      group,
      `wizard.inactiveFieldGroups[${index}]`,
      "INVALID_WIZARD_SURFACE"
    );
    if (!groupName.ok) return groupName;
  }

  if (typeof root.value.wizardCapacityStepRedundant !== "boolean") {
    return fail(
      violation("INVALID_WIZARD_SURFACE", "wizard.wizardCapacityStepRedundant must be a boolean")
    );
  }

  return sdkOk(root.value as unknown as WorkspaceWizardSurface);
}

function validateWorkspaceValidationHooks(
  validation: unknown
): SdkResult<WorkspaceValidationHooks, WorkspaceSdkValidationErrorCode> {
  const root = requirePlainObject(validation, "validation", "INVALID_VALIDATION_HOOKS");
  if (!root.ok) return root;
  if (typeof root.value.checkCapacity !== "function") {
    return fail(
      violation("INVALID_VALIDATION_HOOKS", "validation.checkCapacity must be a function")
    );
  }
  if (typeof root.value.checkTripDetails !== "function") {
    return fail(
      violation("INVALID_VALIDATION_HOOKS", "validation.checkTripDetails must be a function")
    );
  }
  return sdkOk(root.value as unknown as WorkspaceValidationHooks);
}

function validateWorkspaceLifecycleContract(
  lifecycle: unknown
): SdkResult<WorkspaceLifecycleContract, WorkspaceSdkValidationErrorCode> {
  const root = requirePlainObject(lifecycle, "lifecycle", "INVALID_LIFECYCLE");
  if (!root.ok) return root;

  const initialStatus = requireNonEmptyString(
    root.value.initialStatus,
    "lifecycle.initialStatus",
    "INVALID_LIFECYCLE"
  );
  if (!initialStatus.ok) return initialStatus;

  const publishStatus = requireNonEmptyString(
    root.value.publishStatus,
    "lifecycle.publishStatus",
    "INVALID_LIFECYCLE"
  );
  if (!publishStatus.ok) return publishStatus;

  const transitions = requireArray(
    root.value.allowedTransitions,
    "lifecycle.allowedTransitions",
    "INVALID_LIFECYCLE"
  );
  if (!transitions.ok) return transitions;

  for (const [index, transition] of transitions.value.entries()) {
    if (!isPlainObject(transition)) {
      return fail(
        violation("INVALID_LIFECYCLE", `lifecycle.allowedTransitions[${index}] must be an object`)
      );
    }
    const from = requireNonEmptyString(
      transition.from,
      `lifecycle.allowedTransitions[${index}].from`,
      "INVALID_LIFECYCLE"
    );
    if (!from.ok) return from;
    const to = requireNonEmptyString(
      transition.to,
      `lifecycle.allowedTransitions[${index}].to`,
      "INVALID_LIFECYCLE"
    );
    if (!to.ok) return to;
  }

  const lifecycleResult = validateLifecycleGraph({
    initialStatus: initialStatus.value,
    publishStatus: publishStatus.value,
    allowedTransitions: transitions.value as WorkspaceLifecycleContract["allowedTransitions"],
  });
  if (!lifecycleResult.ok) {
    return fail(violation(lifecycleResult.error.code, lifecycleResult.error.message));
  }

  return sdkOk(root.value as unknown as WorkspaceLifecycleContract);
}

function validateCanonicalPathsAlignWithWizard(
  registry: WorkspaceFieldRegistry,
  wizard: WorkspaceWizardSurface
): SdkResult<null, WorkspaceSdkValidationErrorCode> {
  const rootSet = new Set(wizard.roots);

  for (const field of registry.fields) {
    const topLevel = field.canonicalPath.split(".")[0];
    if (!topLevel || !rootSet.has(topLevel)) {
      return fail(
        violation(
          "INVALID_FIELD_REGISTRY",
          `Field "${field.id}" canonicalPath root "${topLevel ?? ""}" is not in wizard.roots`
        )
      );
    }
  }

  for (const stepId of new Set(registry.fields.map((field) => field.stepId))) {
    if (!rootSet.has(stepId)) {
      return fail(
        violation(
          "INVALID_WIZARD_SURFACE",
          `stepId "${stepId}" has registry fields but is not listed in wizard.roots`
        )
      );
    }
  }

  return sdkOk(null);
}

/**
 * Headless validation pipeline: shape → registry → rules → wizard → lifecycle → hooks.
 * Theme/CSS validation is a separate ingress step (not JSON-persisted hook functions).
 */
export function validateWorkspacePluginCore(value: unknown): PluginResult {
  const root = requirePlainObject(value, "plugin", "PLUGIN_INVALID_SHAPE");
  if (!root.ok) return root;

  const id = requireNonEmptyString(root.value.id, "plugin.id", "PLUGIN_INVALID_SHAPE");
  if (!id.ok) return id;

  const version = requireFiniteNumber(root.value.version, "plugin.version", "PLUGIN_INVALID_SHAPE");
  if (!version.ok) return version;

  const contractVersion = requireFiniteNumber(
    root.value.contractVersion,
    "plugin.contractVersion",
    "PLUGIN_INVALID_SHAPE"
  );
  if (!contractVersion.ok) return contractVersion;
  if (contractVersion.value !== 1) {
    return fail(
      violation(
        "PLUGIN_INVALID_SHAPE",
        `plugin.contractVersion must be 1 (got ${contractVersion.value})`
      )
    );
  }

  const types = requireArray(
    root.value.supportedWorkspaceTypes,
    "plugin.supportedWorkspaceTypes",
    "PLUGIN_INVALID_SHAPE"
  );
  if (!types.ok) return types;
  for (const [index, workspaceType] of types.value.entries()) {
    const typeId = requireNonEmptyString(
      workspaceType,
      `plugin.supportedWorkspaceTypes[${index}]`,
      "PLUGIN_INVALID_SHAPE"
    );
    if (!typeId.ok) return typeId;
  }

  const registry = validateWorkspaceFieldRegistry(root.value.fieldRegistry);
  if (!registry.ok) return registry;

  const knownFieldIds = new Set(registry.value.fields.map((field) => field.id));
  const ruleSet = validateWorkspaceRuleSet(root.value.ruleSet, knownFieldIds);
  if (!ruleSet.ok) return ruleSet;

  const wizard = validateWorkspaceWizardSurface(root.value.wizard);
  if (!wizard.ok) return wizard;

  const alignment = validateCanonicalPathsAlignWithWizard(registry.value, wizard.value);
  if (!alignment.ok) return alignment;

  const validation = validateWorkspaceValidationHooks(root.value.validation);
  if (!validation.ok) return validation;

  const lifecycle = validateWorkspaceLifecycleContract(root.value.lifecycle);
  if (!lifecycle.ok) return lifecycle;

  return sdkOk(root.value as unknown as WorkspacePlugin);
}

/** Optional metadata theme block (P3-B — semantic CSS vars only). */
export type WorkspaceDefinitionThemePayload = {
  readonly tokens?: Readonly<Record<string, string>>;
};

/** Data-only workspace metadata persisted in P3-A (no hook functions). */
export type WorkspaceDefinitionPayload = Pick<
  WorkspacePlugin,
  | "id"
  | "version"
  | "contractVersion"
  | "supportedWorkspaceTypes"
  | "fieldRegistry"
  | "ruleSet"
  | "wizard"
> & {
  readonly theme?: WorkspaceDefinitionThemePayload;
  readonly commerce?: WorkspaceCommerceConfig;
};

const DEFINITION_FORBIDDEN_TOP_LEVEL_KEYS = [
  "validation",
  "lifecycle",
  "wizardHost",
  "wizardMedia",
  "registrationOps",
  "operatorSettings",
  "integrationSurface",
  "tourList",
  "publicCatalog",
  "tourClone",
  "draftTombstone",
] as const;

const WORKSPACE_DEFINITION_THEME_TOKEN_KEY = /^--ws-[a-z0-9-]+$/;

function validateDefinitionThemePayload(
  theme: unknown
): SdkResult<WorkspaceDefinitionThemePayload | undefined, WorkspaceSdkValidationErrorCode> {
  if (theme === undefined || theme === null) {
    return sdkOk(undefined);
  }
  const root = requirePlainObject(theme, "payload.theme", "PLUGIN_INVALID_SHAPE");
  if (!root.ok) {
    return root;
  }
  for (const key of Object.keys(root.value)) {
    if (key !== "tokens") {
      return fail(
        violation(
          "PLUGIN_INVALID_SHAPE",
          `payload.theme must only include "tokens" (unexpected "${key}")`
        )
      );
    }
  }
  if (root.value.tokens === undefined) {
    return sdkOk({});
  }
  const tokensRoot = requirePlainObject(
    root.value.tokens,
    "payload.theme.tokens",
    "PLUGIN_INVALID_SHAPE"
  );
  if (!tokensRoot.ok) {
    return tokensRoot;
  }
  const tokens: Record<string, string> = {};
  for (const [key, value] of Object.entries(tokensRoot.value)) {
    if (!WORKSPACE_DEFINITION_THEME_TOKEN_KEY.test(key)) {
      return fail(
        violation(
          "PLUGIN_INVALID_SHAPE",
          `payload.theme.tokens key must be semantic --ws-* (got "${key}")`
        )
      );
    }
    if (typeof value !== "string") {
      return fail(
        violation("PLUGIN_INVALID_SHAPE", `payload.theme.tokens.${key} must be a string`)
      );
    }
    tokens[key] = value;
  }
  return sdkOk({ tokens: Object.freeze(tokens) });
}

function validateDefinitionCommercePayload(
  commerce: unknown
): SdkResult<WorkspaceCommerceConfig | undefined, WorkspaceSdkValidationErrorCode> {
  if (commerce === undefined || commerce === null) {
    return sdkOk(undefined);
  }
  const parsed = safeParseWorkspaceCommerceConfig(commerce);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    return fail(violation("PLUGIN_INVALID_SHAPE", `payload.commerce invalid: ${message}`));
  }
  return sdkOk(parsed.data);
}

type DefinitionPayloadResult = SdkResult<
  WorkspaceDefinitionPayload,
  WorkspaceSdkValidationErrorCode
>;

function rejectDefinitionForbiddenKeys(
  record: Record<string, unknown>
): DefinitionPayloadResult | null {
  for (const key of DEFINITION_FORBIDDEN_TOP_LEVEL_KEYS) {
    if (key in record && record[key] !== undefined && record[key] !== null) {
      return fail(
        violation(
          "PLUGIN_FUNCTION_NOT_ALLOWED",
          `payload must not include "${key}" — persist data-only core; use package overlay for hooks`
        )
      );
    }
  }
  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "function") {
      return fail(
        violation("PLUGIN_FUNCTION_NOT_ALLOWED", `payload.${key} must not be a function`)
      );
    }
  }
  return null;
}

/**
 * P3-A — validate DB-persisted workspace definition JSON (fieldRegistry + ruleSet + wizard only).
 */
export function validateWorkspaceDefinitionPayload(value: unknown): DefinitionPayloadResult {
  const root = requirePlainObject(value, "payload", "PLUGIN_INVALID_SHAPE");
  if (!root.ok) return root;

  const forbidden = rejectDefinitionForbiddenKeys(root.value);
  if (forbidden) return forbidden;

  const id = requireNonEmptyString(root.value.id, "payload.id", "PLUGIN_INVALID_SHAPE");
  if (!id.ok) return id;

  const version = requireFiniteNumber(
    root.value.version,
    "payload.version",
    "PLUGIN_INVALID_SHAPE"
  );
  if (!version.ok) return version;

  const contractVersion = requireFiniteNumber(
    root.value.contractVersion,
    "payload.contractVersion",
    "PLUGIN_INVALID_SHAPE"
  );
  if (!contractVersion.ok) return contractVersion;
  if (contractVersion.value !== 1) {
    return fail(
      violation(
        "PLUGIN_INVALID_SHAPE",
        `payload.contractVersion must be 1 (got ${contractVersion.value})`
      )
    );
  }

  const types = requireArray(
    root.value.supportedWorkspaceTypes,
    "payload.supportedWorkspaceTypes",
    "PLUGIN_INVALID_SHAPE"
  );
  if (!types.ok) return types;
  for (const [index, workspaceType] of types.value.entries()) {
    const typeId = requireNonEmptyString(
      workspaceType,
      `payload.supportedWorkspaceTypes[${index}]`,
      "PLUGIN_INVALID_SHAPE"
    );
    if (!typeId.ok) return typeId;
  }

  const registry = validateWorkspaceFieldRegistry(root.value.fieldRegistry);
  if (!registry.ok) return registry;

  const knownFieldIds = new Set(registry.value.fields.map((field) => field.id));
  const ruleSet = validateWorkspaceRuleSet(root.value.ruleSet, knownFieldIds);
  if (!ruleSet.ok) return ruleSet;

  const wizard = validateWorkspaceWizardSurface(root.value.wizard);
  if (!wizard.ok) return wizard;

  const alignment = validateCanonicalPathsAlignWithWizard(registry.value, wizard.value);
  if (!alignment.ok) return alignment;

  const themeResult = validateDefinitionThemePayload(root.value.theme);
  if (!themeResult.ok) return themeResult;

  const commerceResult = validateDefinitionCommercePayload(root.value.commerce);
  if (!commerceResult.ok) return commerceResult;

  return sdkOk({
    id: id.value as WorkspacePlugin["id"],
    version: version.value,
    contractVersion: 1,
    supportedWorkspaceTypes: types.value as WorkspacePlugin["supportedWorkspaceTypes"],
    fieldRegistry: registry.value,
    ruleSet: ruleSet.value,
    wizard: wizard.value,
    ...(themeResult.value !== undefined ? { theme: themeResult.value } : {}),
    ...(commerceResult.value !== undefined ? { commerce: commerceResult.value } : {}),
  });
}

export function assertWorkspaceDefinitionPayload(
  value: unknown
): asserts value is WorkspaceDefinitionPayload {
  throwOnError(validateWorkspaceDefinitionPayload(value));
}

/**
 * Headless plugin validation (Phase 1 / platform-core ingress) — no theme/CSS module load.
 */
export function assertWorkspacePluginCore(value: unknown): asserts value is WorkspacePlugin {
  throwOnError(validateWorkspacePluginCore(value));
}
