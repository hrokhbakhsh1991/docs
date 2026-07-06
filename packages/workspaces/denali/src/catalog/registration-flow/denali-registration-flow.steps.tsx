"use client";

import { RenderIntakeForm } from "@app-tour/catalog-intake-ui";
import {
  catalogRegistrationAuthFlowSteps,
  CatalogRegistrationOtpStep,
  CatalogRegistrationPhoneStep,
  CatalogRegistrationProfileStep,
} from "@app-tour/catalog-registration-flow-ui";
import {
  mergeFlowState,
  resolveEffectiveIntakeSchema,
  resolveIntakeSubmitValues,
  transitionFlowStep,
  validateIntakeSchemaValues,
  type IntakeField,
  type RegistrationFlowStepProps,
} from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent } from "react";

import { denaliCatalogTransportIntakeSurface } from "../denali-catalog-transport-intake";
import { denaliCatalogRegistrationFlowSurface, readDenaliFlowData } from "./denali-registration-flow.surface";

export {
  CatalogRegistrationPhoneStep as DenaliPhoneStep,
  CatalogRegistrationOtpStep as DenaliOtpStep,
  CatalogRegistrationProfileStep as DenaliProfileStep,
};

function intakeValidationMessage(
  t: ReturnType<typeof useTranslations>,
  fieldId: string,
  code: "required" | "pattern"
): string {
  if (code === "required") {
    if (fieldId === "fullName") return t("errors.DISPLAY_NAME_REQUIRED");
    if (fieldId === "email") return t("intake.emailRequired");
    if (fieldId === "fatherName") return t("intake.fatherNameInvalid");
    return t("intake.partySizeInvalid");
  }
  if (fieldId === "nationalId") return t("intake.nationalIdInvalid");
  if (fieldId === "birthDate") return t("intake.birthDateInvalid");
  return t("intake.partySizeInvalid");
}

export function DenaliIntakeStep({ context, state, dispatch, resolveError }: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const data = readDenaliFlowData(state);
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const transportSurface = denaliCatalogTransportIntakeSurface;

  const intakeContext = useMemo(
    () => ({
      registrantTarget: data.registrantTarget,
      session: {
        fullName: data.intakeName,
        nationalId: data.sessionNationalId,
        fatherName: data.sessionFatherName,
        birthDate: data.sessionBirthDate,
        email: data.sessionEmail,
      },
      tourRequirements: context.tourRequirements,
    }),
    [context.tourRequirements, data]
  );

  const effectiveSchema = useMemo(
    () => resolveEffectiveIntakeSchema(context.pluginId, intakeContext),
    [context.pluginId, intakeContext]
  );

  const schemaValues = useMemo(
    () => ({
      fullName: data.intakeName,
      nationalId: data.intakeNationalId,
      fatherName: data.intakeFatherName,
      birthDate: data.intakeBirthDate,
      email: data.intakeEmail,
      partySize: data.partySize,
      notes: data.notes,
    }),
    [data]
  );

  const transportPayload = transportSurface.buildPayload(context.tourTransport, data.transportState);
  const estimatedPrice = transportSurface.computePricePerPerson({
    basePrice: context.tourPriceAmount ?? null,
    transport: context.tourTransport,
    transportKind: transportPayload?.kind ?? "primary",
  });

  function handleRegistrantTargetChange(target: "self" | "other"): void {
    if (target === "other") {
      mergeFlowState(state, dispatch, {
        registrantTarget: target,
        intakeName: "",
        intakeNationalId: "",
        intakeFatherName: "",
        intakeBirthDate: "",
      });
      return;
    }
    mergeFlowState(state, dispatch, {
      registrantTarget: target,
      intakeName: data.savedSelfIntakeDefaults.name,
      intakeNationalId: data.savedSelfIntakeDefaults.nationalId,
      intakeFatherName: data.savedSelfIntakeDefaults.fatherName,
      intakeBirthDate: data.savedSelfIntakeDefaults.birthDate,
    });
  }

  function handleFieldChange(fieldId: string, value: string): void {
    const patch: Record<string, string> = {};
    if (fieldId === "fullName") patch.intakeName = value;
    else if (fieldId === "nationalId") patch.intakeNationalId = value;
    else if (fieldId === "fatherName") patch.intakeFatherName = value;
    else if (fieldId === "birthDate") patch.intakeBirthDate = value;
    else if (fieldId === "email") patch.intakeEmail = value;
    else if (fieldId === "partySize") patch.partySize = value;
    else if (fieldId === "notes") patch.notes = value;
    mergeFlowState(state, dispatch, patch);
  }

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
    // Denali registers one participant per submission (self or a single other
    // person); party size is no longer a UI field. Send a fixed 1 to satisfy the
    // unchanged API contract (denaliRegistrationPostSchema.partySize min 1).
    const partySize = 1;
    if (!transportSurface.isComplete(context.tourTransport, data.transportState)) {
      setError(t("intake.transportIncomplete"));
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
          registrantTarget: data.registrantTarget,
          ...(data.phone.length > 0 ? { phone: data.phone } : {}),
          ...(email.length > 0 ? { email } : {}),
          ...(merged.nationalId ? { nationalId: merged.nationalId } : {}),
          ...(merged.fatherName ? { fatherName: merged.fatherName } : {}),
          ...(merged.birthDate ? { birthDate: merged.birthDate } : {}),
          ...(merged.notes ? { notes: merged.notes } : {}),
          ...(transportPayload !== undefined ? { transport: transportPayload } : {}),
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

  const showKnownNameHint = !effectiveSchema.fields.some((field) => field.id === "fullName");
  const personalCarOptInVisible = transportSurface.showPersonalCarOptIn(context.tourTransport);
  const transportFollowUpVisible = transportSurface.showTransportFollowUp(
    context.tourTransport,
    data.transportState
  );

  return (
    <form onSubmit={handleSubmit} data-public-registration-intake data-tour-id={context.tourId}>
      <h2>{t("intake.title")}</h2>
      {effectiveSchema.features.registrantTargetTabs ? (
        <div role="tablist" aria-label={t("intake.registrantTabsLabel")} data-registration-target-tabs>
          <button
            type="button"
            role="tab"
            aria-selected={data.registrantTarget === "self"}
            data-registration-target="self"
            onClick={() => handleRegistrantTargetChange("self")}
          >
            {t("intake.forSelfTab")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={data.registrantTarget === "other"}
            data-registration-target="other"
            onClick={() => handleRegistrantTargetChange("other")}
          >
            {t("intake.forOtherTab")}
          </button>
        </div>
      ) : null}
      {estimatedPrice !== null ? (
        <p data-registration-price-hint>
          {t("intake.estimatedPrice", { amount: estimatedPrice.toLocaleString() })}
        </p>
      ) : null}
      {showKnownNameHint ? (
        <p data-intake-known-name>{t("intake.knownNameHint", { name: data.intakeName })}</p>
      ) : null}
      <RenderIntakeForm
        schema={effectiveSchema}
        values={schemaValues}
        onChange={handleFieldChange}
        resolveLabel={(field: IntakeField) => t(field.labelKey)}
        errorId={errorId}
        hasError={error !== null}
      />
      {personalCarOptInVisible ? (
        <label className="portal-registration-transport-opt-in" data-public-registration-personal-car-opt-in>
          <input
            type="checkbox"
            checked={data.transportState.optInPersonalCar}
            onChange={(event) =>
              mergeFlowState(state, dispatch, {
                transportState: {
                  ...data.transportState,
                  optInPersonalCar: event.target.checked,
                  hasPersonalCar: null,
                  personalCarOccupants: null,
                  paysDong: null,
                },
              })
            }
          />
          <span>{t("intake.personalCarOptIn")}</span>
        </label>
      ) : null}
      {transportFollowUpVisible ? (
        <fieldset data-public-registration-transport>
          <legend>{t("intake.transportLegend")}</legend>
          <p>{t("intake.hasPersonalCarQuestion")}</p>
          <label>
            <input
              type="radio"
              name="hasPersonalCar"
              checked={data.transportState.hasPersonalCar === true}
              onChange={() =>
                mergeFlowState(state, dispatch, {
                  transportState: { ...data.transportState, hasPersonalCar: true, paysDong: null },
                })
              }
            />
            {t("intake.hasPersonalCarYes")}
          </label>
          <label>
            <input
              type="radio"
              name="hasPersonalCar"
              checked={data.transportState.hasPersonalCar === false}
              onChange={() =>
                mergeFlowState(state, dispatch, {
                  transportState: {
                    ...data.transportState,
                    hasPersonalCar: false,
                    personalCarOccupants: null,
                    paysDong: null,
                  },
                })
              }
            />
            {t("intake.hasPersonalCarNo")}
          </label>
          {data.transportState.hasPersonalCar === true ? (
            <div data-public-registration-transport-occupants>
              <p>{t("intake.personalCarOccupantsLabel")}</p>
              {([1, 2, 3] as const).map((count) => (
                <label key={count}>
                  <input
                    type="radio"
                    name="personalCarOccupants"
                    checked={data.transportState.personalCarOccupants === count}
                    onChange={() =>
                      mergeFlowState(state, dispatch, {
                        transportState: {
                          ...data.transportState,
                          personalCarOccupants: count,
                        },
                      })
                    }
                  />
                  {t(`intake.personalCarOccupants.${count}`)}
                </label>
              ))}
            </div>
          ) : null}
          {data.transportState.hasPersonalCar === false ? (
            <div data-public-registration-transport-dong>
              <p>{t("intake.paysDongQuestion")}</p>
              <label>
                <input
                  type="radio"
                  name="paysDong"
                  checked={data.transportState.paysDong === true}
                  onChange={() =>
                    mergeFlowState(state, dispatch, {
                      transportState: { ...data.transportState, paysDong: true },
                    })
                  }
                />
                {t("intake.paysDongYes")}
              </label>
              <label>
                <input
                  type="radio"
                  name="paysDong"
                  checked={data.transportState.paysDong === false}
                  onChange={() =>
                    mergeFlowState(state, dispatch, {
                      transportState: { ...data.transportState, paysDong: false },
                    })
                  }
                />
                {t("intake.paysDongNo")}
              </label>
            </div>
          ) : null}
        </fieldset>
      ) : null}
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

export function DenaliDoneStep({ context, state }: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const attrs =
    denaliCatalogRegistrationFlowSurface.successDataAttributes?.(state, context) ?? {};
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

export const denaliRegistrationFlowSteps = Object.freeze({
  ...catalogRegistrationAuthFlowSteps,
  intake: DenaliIntakeStep,
  done: DenaliDoneStep,
});
