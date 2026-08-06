import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { DENALI_WORKSPACE_PLUGIN_ID } from "@app-tour/workspace-denali";
import { ensureWizardHostAdapterSurface } from "@app-tour/workspace-denali/host/wizard/host-adapter-surface";

import { encodeTourActionSubmitError } from "../src/wizard/tour-action-submit-codec";

import { parsePlatformValidationMessage } from "../src/wizard/parse-platform-validation-segments";
import { resolveWizardSubmitErrorMessage } from "../src/wizard/resolve-wizard-submit-error-message";

describe("resolve-wizard-submit-error-message.spec.ts", () => {
  before(async () => {
    await ensureWizardHostAdapterSurface(DENALI_WORKSPACE_PLUGIN_ID);
  });
  const t = {
    translate: (key: string, values?: Record<string, string | number>) => {
      const map: Record<string, string> = {
        "submit.validationSummary": "Fix before create:",
        "submitEdit.validationSummary": "Fix before save:",
        "submit.validationFailed": "Fix highlighted fields.",
        "submit.errorUnknown": "Create failed.",
        "submitEdit.errorUnknown": "Save failed.",
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
        "validation.invalidValue": "{field} has an invalid value",
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
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
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

  it("uses submitEdit.validationSummary and workspace localize on edit context", () => {
    const raw = encodeTourActionSubmitError({
      status: 400,
      code: "VALIDATION_FAILURE",
      message: 'CANONICAL_VALIDATION_FAILED: No value at canonical path "pricing.paymentMode"',
    });
    // Shell has REQUIRED_FIELD_EMPTY — prefer host.validation.codes over product localize.
    const presentation = resolveWizardSubmitErrorMessage({
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
      raw,
      context: "edit",
      translateFieldLabel: (path) => `Label:${path}`,
      translateWorkspace: (key) => `WS:${key}`,
      t,
    });
    assert.equal(presentation?.summary, "Fix before save:");
    assert.equal(presentation?.details?.[0], "Label:pricing.paymentMode is required");
  });

  it("falls back to workspace localize when shell has no code mapping", () => {
    const raw = encodeTourActionSubmitError({
      status: 400,
      code: "VALIDATION_FAILURE",
      message: 'CANONICAL_VALIDATION_FAILED: No value at canonical path "pricing.paymentMode"',
    });
    const tWithoutCodes = {
      translate: t.translate,
      has: (key: string) =>
        key.startsWith("submit.") ||
        key.startsWith("submitEdit.") ||
        key.startsWith("validation."),
    };
    const presentation = resolveWizardSubmitErrorMessage({
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
      raw,
      context: "edit",
      translateFieldLabel: (path) => `Label:${path}`,
      translateWorkspace: (key, values) => {
        if (key === "validation.requiredField") {
          return `WS-required:${values?.field ?? ""}`;
        }
        return key;
      },
      t: tWithoutCodes,
    });
    assert.equal(presentation?.summary, "Fix before save:");
    assert.equal(presentation?.details?.[0], "WS-required:Label:pricing.paymentMode");
  });

  it("shows API code, message, and correlation id for HTTP 500", () => {
    const raw = encodeTourActionSubmitError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "internal_error",
      correlationId: "8104fe81-3909-4563-b29f-97414e10abfa",
    });
    const presentation = resolveWizardSubmitErrorMessage({
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
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
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
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

  it("maps unknown raw tokens to safe errorUnknown summary", () => {
    const presentation = resolveWizardSubmitErrorMessage({
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
      raw: "SOME_GARBAGE_TOKEN",
      context: "create",
      translateFieldLabel: (path) => `Label:${path}`,
      t,
    });
    assert.equal(presentation?.summary, "Create failed.");
  });

  it("omits HTTP detail rows when translator.has returns false", () => {
    const guardedT = {
      translate: t.translate,
      has: (key: string) =>
        key === "submit.http500" ||
        key === "submit.errorUnknown" ||
        key === "submitEdit.errorUnknown",
    };
    const raw = encodeTourActionSubmitError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "internal_error",
      correlationId: "8104fe81-3909-4563-b29f-97414e10abfa",
    });
    const presentation = resolveWizardSubmitErrorMessage({
      pluginId: DENALI_WORKSPACE_PLUGIN_ID,
      raw,
      context: "create",
      translateFieldLabel: (path) => path,
      t: guardedT,
    });
    assert.equal(presentation?.summary, "Server error bucket.");
    assert.equal(presentation?.details, undefined);
  });
});
