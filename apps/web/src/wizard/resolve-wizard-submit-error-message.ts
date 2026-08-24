import { decodeTourActionSubmitError } from "@/wizard/tour-action-submit-codec";
import {
  ensureGeneratedLabelResolver,
  resolveGeneratedLabelResolver,
} from "@/wizard/wizard-label-registry";

import {
  localizeWizardValidationIssueMessage,
  WIZARD_RULES_NOT_READY_CODE,
} from "@/wizard/wizard-host-adapter-registry";
import { parsePlatformValidationMessage } from "@/wizard/parse-platform-validation-segments";

export type WizardSubmitErrorPresentation = {
  readonly summary: string;
  readonly details?: readonly string[];
};

export type WizardSubmitErrorTranslator = {
  readonly translate: (key: string, values?: Record<string, string | number>) => string;
  readonly has: (key: string) => boolean;
};

function resolveHttpSubmitSummary(
  status: number,
  t: WizardSubmitErrorTranslator,
  context: "create" | "edit"
): string {
  if (status === 401) {
    return t.translate(context === "create" ? "submit.http401" : "submitEdit.http401");
  }
  if (status === 403) {
    return t.translate(context === "create" ? "submit.http403" : "submitEdit.http403");
  }
  if (status === 409) {
    return t.translate(context === "create" ? "submit.http409" : "submitEdit.http409");
  }
  if (status >= 500) {
    return t.translate(context === "create" ? "submit.http500" : "submitEdit.http500");
  }
  return t.translate(context === "create" ? "submit.errorUnknown" : "submitEdit.errorUnknown");
}

type HttpSubmitErrorPayload = {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly correlationId?: string;
};

function buildHttpSubmitErrorDetails(
  payload: HttpSubmitErrorPayload,
  t: WizardSubmitErrorTranslator,
  context: "create" | "edit"
): readonly string[] | undefined {
  const details: string[] = [];
  const code = payload.code.trim();
  const message = payload.message.trim();
  const prefix = context === "create" ? "submit" : "submitEdit";

  if (code.length > 0 && code !== "unknown_error") {
    const key = `${prefix}.errorDetailCode`;
    if (t.has(key)) details.push(t.translate(key, { code }));
  }
  if (
    message.length > 0 &&
    message !== "unknown_error" &&
    message !== code &&
    !message.startsWith("CANONICAL_VALIDATION_FAILED")
  ) {
    const key = `${prefix}.errorDetailMessage`;
    if (t.has(key)) details.push(t.translate(key, { message }));
  }
  if (payload.correlationId != null && payload.correlationId.length > 0) {
    const key = `${prefix}.errorDetailCorrelation`;
    if (t.has(key)) {
      details.push(t.translate(key, { correlationId: payload.correlationId }));
    }
  }

  return details.length > 0 ? details : undefined;
}

function formatValidationSegments(input: {
  readonly pluginId: string;
  readonly message: string;
  readonly t: WizardSubmitErrorTranslator;
  readonly translateFieldLabel: (path: string) => string;
  /** Workspace message namespace — product `validation.*` keys for localize adapter. */
  readonly translateWorkspace: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
  readonly context: "create" | "edit";
}): WizardSubmitErrorPresentation {
  const segments = parsePlatformValidationMessage(input.message);
  if (segments.length === 0) {
    return {
      summary: input.t.translate(
        input.context === "edit" ? "submitEdit.errorUnknown" : "submit.errorUnknown"
      ),
    };
  }

  const details = segments.map((segment) => {
    const fieldLabel =
      segment.path != null
        ? input.translateFieldLabel(segment.path)
        : input.t.translate("submit.unknownField");
    // Shell codes live under wizard.host.validation.codes.* — has() must use the same path.
    const codeKey = (code: string) => `host.validation.codes.${code}`;
    const code = segment.code?.trim();
    if (code != null && code.length > 0 && input.t.has(codeKey(code))) {
      return input.t.translate(codeKey(code), { field: fieldLabel });
    }
    // Unmapped platform prose → product localize (workspace validation.* keys).
    return localizeWizardValidationIssueMessage(
      input.pluginId,
      input.translateWorkspace,
      segment.message,
      fieldLabel
    );
  });

  return {
    summary: input.t.translate(
      input.context === "edit" ? "submitEdit.validationSummary" : "submit.validationSummary"
    ),
    details,
  };
}

function parseLegacyActionSubmitError(raw: string): { status: number; code: string; message: string } | null {
  if (!raw.startsWith("ACTION:")) {
    return null;
  }
  const rest = raw.slice("ACTION:".length);
  const firstColon = rest.indexOf(":");
  if (firstColon < 0) {
    return null;
  }
  const status = Number.parseInt(rest.slice(0, firstColon), 10);
  const message = rest.slice(firstColon + 1);
  if (!Number.isFinite(status) || message.length === 0) {
    return null;
  }
  const code = message.startsWith("CANONICAL_VALIDATION_FAILED")
    ? "CANONICAL_VALIDATION_FAILED"
    : message.split(":")[0]?.trim() ?? "unknown_error";
  return { status, code, message };
}

/** Map wizard submit error tokens to operator-facing copy (create + flat edit). */
export function resolveWizardSubmitErrorMessage(input: {
  readonly pluginId: string;
  readonly raw: string | null | undefined;
  readonly t: WizardSubmitErrorTranslator;
  readonly translateFieldLabel: (path: string) => string;
  /**
   * Workspace i18n for product `localizeWizardValidationIssueMessage` keys
   * (`validation.requiredField`, …). Defaults to shell `t` when omitted (tests).
   */
  readonly translateWorkspace?: (
    key: string,
    values?: Record<string, string | number>
  ) => string;
  readonly context: "create" | "edit";
}): WizardSubmitErrorPresentation | null {
  const raw = input.raw?.trim();
  if (raw == null || raw.length === 0) {
    return null;
  }

  const unknownKey = input.context === "create" ? "submit.errorUnknown" : "submitEdit.errorUnknown";
  const translateWorkspace =
    input.translateWorkspace ??
    ((key: string, values?: Record<string, string | number>) => input.t.translate(key, values));

  if (raw === "VALIDATION_FAILED") {
    return {
      summary: input.t.translate(
        input.context === "create" ? "submit.validationFailed" : "submitEdit.validationFailed"
      ),
    };
  }

  if (raw === WIZARD_RULES_NOT_READY_CODE) {
    return { summary: input.t.translate("submit.rulesNotReady") };
  }

  const payload =
    decodeTourActionSubmitError(raw) ?? parseLegacyActionSubmitError(raw);
  if (payload == null) {
    // Never show raw token to end users — map to a safe generic message.
    return { summary: input.t.translate(unknownKey) };
  }

  const message = payload.message.trim();
  if (
    payload.code === "CANONICAL_VALIDATION_FAILED" ||
    message.startsWith("CANONICAL_VALIDATION_FAILED")
  ) {
    return formatValidationSegments({
      pluginId: input.pluginId,
      message,
      t: input.t,
      translateFieldLabel: input.translateFieldLabel,
      translateWorkspace,
      context: input.context,
    });
  }

  if (payload.code === "VALIDATION_FAILURE" && message.length > 0) {
    return formatValidationSegments({
      pluginId: input.pluginId,
      message,
      t: input.t,
      translateFieldLabel: input.translateFieldLabel,
      translateWorkspace,
      context: input.context,
    });
  }

  if (payload.code.startsWith("TOUR_LIFECYCLE_TRANSITION_REJECTED")) {
    const unpublishRejected = payload.code.includes("OPEN->DRAFT");
    const lifecycleKey = unpublishRejected
      ? "submitEdit.lifecycleUnpublishRejected"
      : "submitEdit.lifecycleTransitionRejected";
    if (input.t.has(lifecycleKey)) {
      return { summary: input.t.translate(lifecycleKey) };
    }
  }

  if (
    payload.code === "DENALI_TOUR_MUTATION_BLOCKED" ||
    payload.code === "DENALI_TOUR_MUTATION_OVERRIDE_REQUIRED"
  ) {
    const reasonKey = `submitEdit.mutation.${payload.code}`;
    if (input.t.has(reasonKey)) {
      return { summary: input.t.translate(reasonKey) };
    }
  }

  return {
    summary: resolveHttpSubmitSummary(payload.status, input.t, input.context),
    details: buildHttpSubmitErrorDetails(payload, input.t, input.context),
  };
}

/**
 * Field-label translator for submit errors — uses warm label-resolver cache.
 * Call `ensureGeneratedLabelResolver(surfaceId)` before submit paths for product labels.
 */
export function createWizardSubmitFieldLabelResolver(
  surfaceId: string,
  translateWorkspace: (key: string) => string
): (path: string) => string {
  return (path: string) => {
    const resolver = resolveGeneratedLabelResolver(surfaceId);
    if (resolver?.resolveValidationIssueLabel != null) {
      return resolver.resolveValidationIssueLabel(translateWorkspace, path);
    }
    if (resolver != null) {
      return resolver.resolveFieldLabel(translateWorkspace, path);
    }
    return path;
  };
}

export { ensureGeneratedLabelResolver };
