import { parseCanonicalDocumentFromStorage } from "@app-tour/workspace-sdk/ingress";
import type {
  CanonicalDocument,
  WorkspacePlugin,
} from "@app-tour/workspace-sdk/plugin-types";

import {
  mapCanonicalIngressFailure,
  validationResultFromPlatformError,
} from "../errors/ingress-bridge";
import type { RuleContextResolution } from "../types/rule-context-resolution";
import type { ValidationResult } from "../types/validation-result";
import type { FieldRegistryEngine } from "./field-registry.engine";
import type { RuleEngine } from "./rule.engine";
import { validateFieldValue } from "./validate-canonical-field";
import { createViolationCollector } from "./validation-status-map";

export function validateCanonicalDocument(args: {
  readonly plugin: WorkspacePlugin;
  readonly fieldEngine: FieldRegistryEngine;
  readonly ruleEngine: RuleEngine;
  readonly document: CanonicalDocument;
  readonly context: RuleContextResolution;
}): ValidationResult {
  const { plugin, fieldEngine, ruleEngine, document, context } = args;

  let sanitized: CanonicalDocument;
  try {
    sanitized = parseCanonicalDocumentFromStorage({
      schemaVersion: document.schemaVersion,
      roots: document.roots,
      data: document.data,
    });
  } catch (error: unknown) {
    const mapped = mapCanonicalIngressFailure(error);
    if (mapped != null && !mapped.ok) {
      return validationResultFromPlatformError(mapped.error);
    }
    throw error;
  }

  const validationStatus = createViolationCollector();
  const scope = ruleEngine.createScope(context);

  for (const field of fieldEngine.listAll()) {
    const effective = scope.resolveEffectiveField(field.id);

    if (
      field.groupSlug != null &&
      plugin.wizard.inactiveFieldGroups.includes(field.groupSlug)
    ) {
      continue;
    }

    validateFieldValue(field, sanitized.data, effective, validationStatus);
  }

  return validationStatus.finalize();
}
