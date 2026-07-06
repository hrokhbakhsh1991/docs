import { decodeTourActionSubmitError } from "@/bootstrap/workspace-tour-action-submit-bindings.generated";

import { resolveDenaliValidationIssueLabel } from "@/wizard/denali/denali-validation-issue-label";
import { localizeDenaliValidationIssueMessage } from "@/wizard/denali/denali-localize-validation-message";
import { resolveWizardValidationIssueMessage } from "@/wizard/resolve-wizard-validation-issue-message";
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
    details.push(t.translate(`${prefix}.errorDetailCode`, { code }));
  }
  if (
    message.length > 0 &&
    message !== "unknown_error" &&
    message !== code &&
    !message.startsWith("CANONICAL_VALIDATION_FAILED")
  ) {
    details.push(t.translate(`${prefix}.errorDetailMessage`, { message }));
  }
  if (payload.correlationId != null && payload.correlationId.length > 0) {
    details.push(
      t.translate(`${prefix}.errorDetailCorrelation`, { correlationId: payload.correlationId })
    );
  }

  return details.length > 0 ? details : undefined;
}

function formatValidationSegments(input: {
  readonly message: string;
  readonly t: WizardSubmitErrorTranslator;
  readonly translateFieldLabel: (path: string) => string;
}): WizardSubmitErrorPresentation {
  const segments = parsePlatformValidationMessage(input.message);
  if (segments.length === 0) {
    return { summary: input.t.translate("submit.errorUnknown") };
  }

  const details = segments.map((segment) => {
    const fieldLabel =
      segment.path != null
        ? input.translateFieldLabel(segment.path)
        : input.t.translate("submit.unknownField");
    const issueMessage = resolveWizardValidationIssueMessage(
      { code: segment.code, message: segment.message, path: segment.path ?? "" },
      {
        has: input.t.has,
        translate: (code, values) => input.t.translate(`host.validation.codes.${code}`, values),
      },
      fieldLabel
    );
    return localizeDenaliValidationIssueMessage(
      (key, values) => input.t.translate(key, values),
      issueMessage,
      fieldLabel
    );
  });

  return {
    summary: input.t.translate("submit.validationSummary"),
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
  readonly raw: string | null | undefined;
  readonly t: WizardSubmitErrorTranslator;
  readonly translateFieldLabel: (path: string) => string;
  readonly context: "create" | "edit";
}): WizardSubmitErrorPresentation | null {
  const raw = input.raw?.trim();
  if (raw == null || raw.length === 0) {
    return null;
  }

  if (raw === "VALIDATION_FAILED") {
    return {
      summary: input.t.translate(
        input.context === "create" ? "submit.validationFailed" : "submitEdit.validationFailed"
      ),
    };
  }

  if (raw === "DENALI_RULES_NOT_READY") {
    return { summary: input.t.translate("submit.rulesNotReady") };
  }

  const payload =
    decodeTourActionSubmitError(raw) ?? parseLegacyActionSubmitError(raw);
  if (payload == null) {
    return { summary: raw };
  }

  const message = payload.message.trim();
  if (
    payload.code === "CANONICAL_VALIDATION_FAILED" ||
    message.startsWith("CANONICAL_VALIDATION_FAILED")
  ) {
    return formatValidationSegments({
      message,
      t: input.t,
      translateFieldLabel: input.translateFieldLabel,
    });
  }

  if (payload.code === "VALIDATION_FAILURE" && message.length > 0) {
    return formatValidationSegments({
      message,
      t: input.t,
      translateFieldLabel: input.translateFieldLabel,
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

  return {
    summary: resolveHttpSubmitSummary(payload.status, input.t, input.context),
    details: buildHttpSubmitErrorDetails(payload, input.t, input.context),
  };
}

export function createDenaliWizardSubmitFieldLabelResolver(
  translateDenali: (key: string) => string
): (path: string) => string {
  return (path: string) => resolveDenaliValidationIssueLabel(translateDenali, path);
}
