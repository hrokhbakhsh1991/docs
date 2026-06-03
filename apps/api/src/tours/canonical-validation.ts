import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  createCanonicalDocument,
  type CanonicalDocument,
} from "@app-tour/workspace-sdk";
import { getStarterWorkspacePlugin } from "@app-tour/workspace-starter";

import type { CreateTourBody } from "./create-tour.schema";

/** Per-call engine — no module singleton (CRIT-STATE-01). */
function createValidationEngine() {
  return PlatformWizardEngine.create(getStarterWorkspacePlugin());
}

export function buildValidatedCanonicalDocument(
  body: CreateTourBody,
  tenantId: string,
): CanonicalDocument {
  const engine = createValidationEngine();
  const document = createCanonicalDocument({
    schemaVersion: body.schemaVersion ?? 1,
    roots: body.roots ?? [...getStarterWorkspacePlugin().wizard.roots],
    data: body.data ?? {
      basics: { title: "Untitled tour" },
      details: { summary: "" },
    },
  });

  const result = engine.validateCanonical(document, {
    tenantId,
    dimensions: { variant: "default" },
  });

  if (!result.ok) {
    const message = result.violations.map((v) => v.message).join("; ");
    throw new Error(`CANONICAL_VALIDATION_FAILED: ${message}`);
  }

  return document;
}
