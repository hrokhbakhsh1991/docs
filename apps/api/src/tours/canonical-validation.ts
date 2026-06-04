import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  assertCanonicalDocument,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  type CanonicalDocument,
} from "@app-tour/workspace-sdk";

import { resolveWorkspacePluginForType } from "../workspace/resolve-workspace-plugin";
import type { CreateTourBody } from "./create-tour.schema";

export type ValidateBeforePersistInput = {
  readonly body: CreateTourBody;
  readonly tenantId: string;
  readonly workspaceType: string;
};

/** Per-call engine — no module singleton (CRIT-STATE-01). */
function createValidationEngine(workspaceType: string) {
  const plugin = resolveWorkspacePluginForType(workspaceType);
  return PlatformWizardEngine.create(plugin);
}

function defaultCanonicalData(pluginRoots: readonly string[]): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (pluginRoots.includes("basics")) {
    data.basics = { title: "Untitled tour" };
  }
  if (pluginRoots.includes("details")) {
    data.details = { summary: "" };
  }
  return data;
}

/**
 * RULE-003 / RULE-005 — assertCanonicalDocument + validateCanonical before any persist.
 */
export function validateCanonicalBeforePersist(
  input: ValidateBeforePersistInput,
): CanonicalDocument {
  const plugin = resolveWorkspacePluginForType(input.workspaceType);
  const engine = createValidationEngine(input.workspaceType);

  let document: CanonicalDocument;
  try {
    document = createCanonicalDocument({
      schemaVersion: input.body.schemaVersion ?? 1,
      roots: input.body.roots ?? [...plugin.wizard.roots],
      data: input.body.data ?? defaultCanonicalData(plugin.wizard.roots),
    });
  } catch (error) {
    if (error instanceof CanonicalDocumentValidationError) {
      throw new Error(`CANONICAL_VALIDATION_FAILED: ${error.code}: ${error.message}`);
    }
    throw error;
  }

  assertCanonicalDocument(document);

  const result = engine.validateCanonical(document, {
    tenantId: input.tenantId,
    dimensions: { variant: "default" },
  });

  if (!result.ok) {
    const message = result.violations.map((v) => v.message).join("; ");
    throw new Error(`CANONICAL_VALIDATION_FAILED: ${message}`);
  }

  return document;
}

export function buildValidatedCanonicalDocument(
  body: CreateTourBody,
  tenantId: string,
  workspaceType = "starter",
): CanonicalDocument {
  return validateCanonicalBeforePersist({ body, tenantId, workspaceType });
}
