"use client";

import { createCatalogRegistrationFlowInitialData } from "@app-tour/catalog-registration-auth";
import { RenderIntakeForm } from "@app-tour/catalog-intake-ui";
import {
  mergeFlowState,
  transitionFlowStep,
  resolveEffectiveIntakeSchema,
  resolveIntakeSubmitValues,
  validateIntakeSchemaValues,
  type IntakeField,
  type RegistrationFlowStepProps,
} from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent, type JSX } from "react";

import { readUrbanFlowData, urbanCatalogRegistrationFlowSurface } from "./urban-registration-flow.surface";

function intakeValidationMessage(
  t: ReturnType<typeof useTranslations>,
  fieldId: string,
  code: "required" | "pattern"
): string {
  if (code === "required") {
    if (fieldId === "fullName") return t("errors.DISPLAY_NAME_REQUIRED");
    if (fieldId === "email") return t("intake.emailRequired");
    return t("intake.partySizeInvalid");
  }
  return t("intake.partySizeInvalid");
}

export function UrbanIntakeStep({
  context,
  state,
  dispatch,
  resolveError,
}: RegistrationFlowStepProps): JSX.Element {
  const t = useTranslations("catalogRegistration");
  const data = readUrbanFlowData(state);
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intakeContext = useMemo(
    () => ({
      registrantTarget: "self" as const,
      session: { fullName: data.intakeName, email: data.sessionEmail },
    }),
    [data.intakeName, data.sessionEmail]
  );

  const effectiveSchema = useMemo(
    () => resolveEffectiveIntakeSchema(context.pluginId, intakeContext),
    [context.pluginId, intakeContext]
  );

  const schemaValues = useMemo(
    () => ({
      fullName: data.intakeName,
      email: data.intakeEmail,
      partySize: data.partySize,
      notes: data.notes,
    }),
    [data]
  );

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    const merged = resolveIntakeSubmitValues({
      pluginId: context.pluginId,
      context: intakeContext,
      formValues: schemaValues,
    });
    const issues = validateIntakeSchemaValues(effectiveSchema, merged);
    if (issues.length > 0) {
      const first = issues[0]!;
      setError(intakeValidationMessage(t, first.fieldId, first.code));
      return;
    }
    const partySize = Number.parseInt((merged.partySize ?? "").replace(/\D/g, ""), 10);
    if (!Number.isFinite(partySize) || partySize < 1) {
      setError(t("intake.partySizeInvalid"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const email = (merged.email ?? data.sessionEmail).trim();
      const res = await fetch("/api/catalog/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId: context.tourId,
          fullName: merged.fullName,
          partySize,
          registrantTarget: "self",
          ...(data.phone.length > 0 ? { phone: data.phone } : {}),
          ...(email.length > 0 ? { email } : {}),
          ...(merged.notes ? { notes: merged.notes } : {}),
        }),
      });
      const result = (await res.json()) as { ok?: boolean; code?: string };
      if (!res.ok || !result.ok) {
        setError(resolveError(typeof result.code === "string" ? result.code : "network"));
        return;
      }
      transitionFlowStep(dispatch, "done");
    } catch {
      setError(resolveError("network"));
    } finally {
      setLoading(false);
    }
  }

  function handleFieldChange(fieldId: string, value: string): void {
    const patch: Record<string, string> = {};
    if (fieldId === "fullName") patch.intakeName = value;
    else if (fieldId === "email") patch.intakeEmail = value;
    else if (fieldId === "partySize") patch.partySize = value;
    else if (fieldId === "notes") patch.notes = value;
    mergeFlowState(state, dispatch, patch);
  }

  return (
    <form onSubmit={handleSubmit} data-public-registration-intake data-tour-id={context.tourId}>
      <h2>{t("intake.title")}</h2>
      <RenderIntakeForm
        schema={effectiveSchema}
        values={schemaValues}
        onChange={handleFieldChange}
        resolveLabel={(field: IntakeField) => t(field.labelKey)}
        errorId={errorId}
        hasError={error !== null}
      />
      {error !== null ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading} data-action="intake-submit">
        {loading ? t("intake.submitting") : t("intake.submit")}
      </button>
    </form>
  );
}

export function UrbanDoneStep({ context }: RegistrationFlowStepProps): JSX.Element {
  const t = useTranslations("catalogRegistration");
  const attrs = urbanCatalogRegistrationFlowSurface.successDataAttributes?.(
    { currentStep: "done", data: createCatalogRegistrationFlowInitialData() },
    context
  ) ?? { "data-urban-registration-success": true };
  return (
    <div data-public-registration-success {...attrs}>
      <p role="status">{t("success.message", { tourTitle: context.tourTitle })}</p>
      {context.memberModuleHref !== null ? (
        <p>
          <a href={context.memberModuleHref}>{t("success.viewRegistrations")}</a>
        </p>
      ) : null}
      <p>
        <a href={context.backHref}>{t("success.backToTour")}</a>
      </p>
    </div>
  );
}
