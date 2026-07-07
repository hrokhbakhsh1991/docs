import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";
import type {
  IntakeSchema,
  IntakeSchemaContext,
  IntakeSchemaValidationIssue,
} from "./intake-schema";
import { getWorkspaceIntakePlugin } from "./workspace-intake-plugin-registry";

export class IntakePluginNotRegisteredError extends Error {
  readonly code = "INTAKE_PLUGIN_NOT_REGISTERED" as const;

  constructor(pluginId: string) {
    super(`INTAKE_PLUGIN_NOT_REGISTERED:${pluginId}`);
    this.name = "IntakePluginNotRegisteredError";
  }
}

function requireRegisteredIntakePlugin(pluginId: WorkspacePluginId | string) {
  const registered = getWorkspaceIntakePlugin(pluginId);
  if (registered === null) {
    throw new IntakePluginNotRegisteredError(pluginId);
  }
  return registered.catalogIntake;
}

/** Resolves catalog intake schema from the workspace plugin registry. */
export function resolveIntakeSchema(pluginId: WorkspacePluginId | string): IntakeSchema {
  return requireRegisteredIntakePlugin(pluginId).schema();
}

/** Applies workspace-owned session/registrant context to produce the effective renderable schema. */
export function resolveEffectiveIntakeSchema(
  pluginId: WorkspacePluginId | string,
  context: IntakeSchemaContext
): IntakeSchema {
  return requireRegisteredIntakePlugin(pluginId).resolveEffectiveSchema(context);
}

/** Merges form values with session fallbacks for fields omitted from the effective schema. */
export function resolveIntakeSubmitValues(input: {
  readonly pluginId: WorkspacePluginId | string;
  readonly context: IntakeSchemaContext;
  readonly formValues: Readonly<Record<string, string>>;
}): Readonly<Record<string, string>> {
  return requireRegisteredIntakePlugin(input.pluginId).resolveSubmitValues({
    context: input.context,
    formValues: input.formValues,
  });
}

export function validateIntakeSchemaValues(
  schema: IntakeSchema,
  values: Readonly<Record<string, string>>
): readonly IntakeSchemaValidationIssue[] {
  const issues: IntakeSchemaValidationIssue[] = [];

  for (const field of schema.fields) {
    const value = values[field.id]?.trim() ?? "";
    if (field.required && value.length === 0) {
      issues.push({ fieldId: field.id, code: "required" });
      continue;
    }
    if (value.length === 0 || field.rules?.pattern === undefined) {
      continue;
    }
    const pattern = new RegExp(field.rules.pattern);
    if (!pattern.test(value)) {
      issues.push({ fieldId: field.id, code: "pattern" });
    }
  }

  return Object.freeze(issues);
}
