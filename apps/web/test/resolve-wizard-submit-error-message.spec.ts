import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encodeTourActionSubmitError } from "@app-tour/workspace-denali/ui/logic/tour-action-submit-error-codec";

import { parsePlatformValidationMessage } from "../src/wizard/parse-platform-validation-segments";
import { resolveWizardSubmitErrorMessage } from "../src/wizard/resolve-wizard-submit-error-message";

describe("resolve-wizard-submit-error-message.spec.ts", () => {
  const t = {
    translate: (key: string, values?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "submit.validationSummary": "Fix before create:",
        "submit.validationFailed": "Fix highlighted fields.",
        "submit.errorUnknown": "Create failed.",
        "submit.http500": "Server error bucket.",
        "submit.errorDetailCode": "Code: {code}",
        "submit.errorDetailMessage": "Message: {message}",
        "submit.errorDetailCorrelation": "Correlation: {correlationId}",
        "submitEdit.lifecycleUnpublishRejected": "Unpublish not supported.",
        "submit.unknownField": "Field",
        "host.validation.codes.REQUIRED_FIELD_EMPTY": "{field} is required",
        "host.validation.codes.CANONICAL_TYPE_MISMATCH": "{field} is invalid",
        "validation.requiredField": "{field} is required",
        "validation.invalidText": "{field} must be valid text",
      };
      const template = map[key] ?? key;
      return template.replace(/\{(\w+)\}/g, (_, token: string) => String(values?.[token] ?? ""));
    },
    has: (key: string) =>
      key.startsWith("submit.") ||
      key.startsWith("submitEdit.") ||
      key.startsWith("host.validation.codes.") ||
      key.startsWith("validation."),
  };

  it("maps CANONICAL_VALIDATION_FAILED to field-level bullets", () => {
    const raw = encodeTourActionSubmitError({
      status: 400,
      code: "VALIDATION_FAILURE",
      message:
        'CANONICAL_VALIDATION_FAILED: No value at canonical path "title"; Canonical path "startPoint" expects kind "text" but got object',
    });
    const presentation = resolveWizardSubmitErrorMessage({
      raw,
      context: "create",
      translateFieldLabel: (path) => `Label:${path}`,
      t,
    });
    assert.equal(presentation?.summary, "Fix before create:");
    assert.equal(presentation?.details?.length, 2);
    assert.match(presentation?.details?.[0] ?? "", /Label:title/);
    assert.match(presentation?.details?.[1] ?? "", /Label:startPoint/);
  });

  it("shows API code, message, and correlation id for HTTP 500", () => {
    const raw = encodeTourActionSubmitError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "internal_error",
      correlationId: "8104fe81-3909-4563-b29f-97414e10abfa",
    });
    const presentation = resolveWizardSubmitErrorMessage({
      raw,
      context: "create",
      translateFieldLabel: (path) => path,
      t,
    });
    assert.equal(presentation?.summary, "Server error bucket.");
    assert.deepEqual(presentation?.details, [
      "Code: INTERNAL_ERROR",
      "Message: internal_error",
      "Correlation: 8104fe81-3909-4563-b29f-97414e10abfa",
    ]);
  });

  it("maps lifecycle unpublish rejection to operator copy", () => {
    const raw = encodeTourActionSubmitError({
      status: 400,
      code: "TOUR_LIFECYCLE_TRANSITION_REJECTED:OPEN->DRAFT",
      message: "TOUR_LIFECYCLE_TRANSITION_REJECTED:OPEN->DRAFT",
    });
    const presentation = resolveWizardSubmitErrorMessage({
      raw,
      context: "edit",
      translateFieldLabel: (path) => path,
      t,
    });
    assert.equal(presentation?.summary, "Unpublish not supported.");
    assert.equal(presentation?.details, undefined);
  });

  it("parses legacy ACTION prefix", () => {
    const segments = parsePlatformValidationMessage(
      'CANONICAL_VALIDATION_FAILED: Canonical path "participants.minRequiredPeaks" expects kind "text" but got number'
    );
    assert.equal(segments[0]?.path, "participants.minRequiredPeaks");
    assert.equal(segments[0]?.code, "CANONICAL_TYPE_MISMATCH");
  });
});
