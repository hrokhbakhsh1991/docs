"use client";

import { RenderIntakeForm } from "@app-tour/catalog-intake-ui";
import {
  catalogRegistrationAuthFlowSteps,
  CatalogRegistrationOtpStep,
  CatalogRegistrationPhoneStep,
  CatalogRegistrationProfileStep,
} from "@app-tour/catalog-registration-flow-ui";
import {
  resolveEffectiveIntakeSchema,
  resolveIntakeSubmitValues,
  transitionFlowStep,
  validateIntakeSchemaValues,
  type IntakeField,
  type RegistrationFlowStepProps,
} from "@app-tour/workspace-sdk";
import { classifyPublicRegistrationMobileInput } from "@app-tour/catalog-registration-auth";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState, type FormEvent } from "react";

import { denaliCatalogTransportIntakeSurface } from "../denali-catalog-transport-intake";
import { denaliCatalogRegistrationFlowSurface, readDenaliFlowData } from "./denali-registration-flow.surface";

/** Product hard cap: other-guest cards per intake submit (self is separate). */
export const DENALI_MAX_OTHER_GUESTS = 10;

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
    if (fieldId === "phone") return t("errors.MOBILE_REQUIRED");
    if (fieldId === "email") return t("intake.emailRequired");
    if (fieldId === "fatherName") return t("intake.fatherNameInvalid");
    return t("intake.partySizeInvalid");
  }
  if (fieldId === "phone") return t("errors.MOBILE_INVALID");
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
  const [submitResults, setSubmitResults] = useState<
    readonly {
      readonly target: "self" | "other";
      readonly idx: number;
      readonly ok: boolean;
      readonly error?: string;
      /** Self duplicate safety net — show trips CTA when for-tour id is still unknown. */
      readonly kind?: "self_already";
    }[] | null
  >(null);

  const transportSurface = denaliCatalogTransportIntakeSurface;
  const existingSelfRegistrationId = context.existingSelfRegistrationId ?? null;
  const [discoveredSelfRegistrationId, setDiscoveredSelfRegistrationId] = useState<string | null>(null);
  /** True after a self POST duplicate even when for-tour cannot yet return an id. */
  const [selfLockedWithoutId, setSelfLockedWithoutId] = useState(false);
  const effectiveSelfRegistrationId =
    existingSelfRegistrationId !== null && existingSelfRegistrationId.length > 0
      ? existingSelfRegistrationId
      : discoveredSelfRegistrationId !== null && discoveredSelfRegistrationId.length > 0
        ? discoveredSelfRegistrationId
        : null;
  const selfTabLocked = effectiveSelfRegistrationId !== null || selfLockedWithoutId;

  type TransportState = typeof data.transportState;

  type ParticipantDraft = Readonly<{
    readonly intakeName: string;
    readonly intakePhone: string;
    readonly intakeNationalId: string;
    readonly intakeFatherName: string;
    readonly intakeBirthDate: string;
    readonly intakeEmail: string;
    readonly partySize: string;
    readonly notes: string;
    readonly transportState: TransportState;
  }>;

  function emptyTransportState(): TransportState {
    return {
      optInPersonalCar: false,
      hasPersonalCar: null,
      personalCarOccupants: null,
      paysDong: null,
    } as TransportState;
  }

  const [selfSelected, setSelfSelected] = useState<boolean>(
    () => !selfTabLocked && data.registrantTarget === "self"
  );
  const [selfDraft, setSelfDraft] = useState<ParticipantDraft>(() => ({
    intakeName: data.intakeName,
    intakePhone: "",
    intakeNationalId: data.intakeNationalId,
    intakeFatherName: data.intakeFatherName,
    intakeBirthDate: data.intakeBirthDate,
    intakeEmail: data.intakeEmail,
    // Denali registers one participant per submission; we keep partySize fixed to 1
    // so "4/10 guests" is represented by multiple guest cards (multiple POSTs).
    partySize: "1",
    notes: data.notes,
    transportState: data.transportState,
  }));

  const [otherGuests, setOtherGuests] = useState<ParticipantDraft[]>(() => {
    const includeOther = selfTabLocked || data.registrantTarget === "other";
    if (!includeOther) return [];
    return [
      {
        intakeName: "",
        intakePhone: "",
        intakeNationalId: "",
        intakeFatherName: "",
        intakeBirthDate: "",
        intakeEmail: data.intakeEmail,
        partySize: "1",
        notes: data.notes,
        transportState: data.transportState,
      },
    ];
  });

  function createEmptyOtherDraft(): ParticipantDraft {
    return {
      intakeName: "",
      intakePhone: "",
      intakeNationalId: "",
      intakeFatherName: "",
      intakeBirthDate: "",
      intakeEmail: data.intakeEmail,
      partySize: "1",
      notes: data.notes,
      transportState: emptyTransportState(),
    };
  }

  function isSelfAlreadyRegisteredApiCode(code: string): boolean {
    return code === "DENALI_REGISTRATION_DUPLICATE" || code === "BOOKING_GUEST_DUPLICATE";
  }

  async function refreshSelfRegistrationIdFromForTour(): Promise<string | null> {
    try {
      const res = await fetch(
        `/api/me/registrations/for-tour?tourId=${encodeURIComponent(context.tourId)}`,
        { credentials: "same-origin" }
      );
      const body = (await res.json()) as {
        readonly ok?: boolean;
        readonly data?: { readonly self?: { readonly id?: string } | null };
      };
      const id = body.data?.self?.id;
      return typeof id === "string" && id.length > 0 ? id : null;
    } catch {
      return null;
    }
  }

  function lockSelfAsAlreadyRegistered(registrationId: string | null): void {
    if (registrationId !== null) {
      setDiscoveredSelfRegistrationId(registrationId);
      setSelfLockedWithoutId(false);
    } else {
      setSelfLockedWithoutId(true);
    }
    setSelfSelected(false);
    setOtherGuests((guests) => (guests.length === 0 ? [createEmptyOtherDraft()] : guests));
  }

  const commonSessionContext = useMemo(
    () => ({
      fullName: data.intakeName,
      nationalId: data.sessionNationalId,
      fatherName: data.sessionFatherName,
      birthDate: data.sessionBirthDate,
      email: data.sessionEmail,
    }),
    [
      data.intakeName,
      data.sessionNationalId,
      data.sessionFatherName,
      data.sessionBirthDate,
      data.sessionEmail,
    ]
  );

  function resolveIntakeContext(target: "self" | "other") {
    return {
      registrantTarget: target,
      session: commonSessionContext,
      tourRequirements: context.tourRequirements,
    };
  }

  const effectiveSchemaSelf = useMemo(
    () => resolveEffectiveIntakeSchema(context.pluginId, resolveIntakeContext("self")),
    [context.pluginId, context.tourRequirements, commonSessionContext]
  );
  const effectiveSchemaOther = useMemo(
    () => resolveEffectiveIntakeSchema(context.pluginId, resolveIntakeContext("other")),
    [context.pluginId, context.tourRequirements, commonSessionContext]
  );

  const showKnownNameHintSelf = !effectiveSchemaSelf.fields.some((field) => field.id === "fullName");
  const personalCarOptInVisible = transportSurface.showPersonalCarOptIn(context.tourTransport);

  const estimatedPrice = useMemo(() => {
    const candidateTransportState = selfSelected
      ? selfDraft.transportState
      : otherGuests[0]?.transportState ?? data.transportState;
    const transportPayload = transportSurface.buildPayload(
      context.tourTransport,
      candidateTransportState
    );
    return transportSurface.computePricePerPerson({
      basePrice: context.tourPriceAmount ?? null,
      transport: context.tourTransport,
      transportKind: transportPayload?.kind ?? "primary",
    });
  }, [
    selfSelected,
    selfDraft.transportState,
    otherGuests,
    context.tourTransport,
    context.tourPriceAmount,
    data.transportState,
    transportSurface,
  ]);

  const travelerDraftCount = (selfSelected ? 1 : 0) + otherGuests.length;
  const guestDraftCount = otherGuests.length;
  const canAddGuest = !loading && otherGuests.length < DENALI_MAX_OTHER_GUESTS;

  function updateSelfField(fieldId: string, value: string): void {
    setSelfDraft((prev) => {
      switch (fieldId) {
        case "fullName":
          return { ...prev, intakeName: value };
        case "phone":
          return { ...prev, intakePhone: value };
        case "nationalId":
          return { ...prev, intakeNationalId: value };
        case "fatherName":
          return { ...prev, intakeFatherName: value };
        case "birthDate":
          return { ...prev, intakeBirthDate: value };
        case "email":
          return { ...prev, intakeEmail: value };
        case "notes":
          return { ...prev, notes: value };
        default:
          return prev;
      }
    });
  }

  function updateGuestField(guestIdx: number, fieldId: string, value: string): void {
    setOtherGuests((prev) =>
      prev.map((g, idx) => {
        if (idx !== guestIdx) return g;
        switch (fieldId) {
          case "fullName":
            return { ...g, intakeName: value };
          case "phone":
            return { ...g, intakePhone: value };
          case "nationalId":
            return { ...g, intakeNationalId: value };
          case "fatherName":
            return { ...g, intakeFatherName: value };
          case "birthDate":
            return { ...g, intakeBirthDate: value };
          case "email":
            return { ...g, intakeEmail: value };
          case "notes":
            return { ...g, notes: value };
          default:
            return g;
        }
      })
    );
  }

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!selfSelected && otherGuests.length === 0) return;

    setLoading(true);
    setError(null);
    setSubmitResults(null);

    const submitSeed =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `portal-denali-reg-${context.tourId}-${Date.now()}`;

    type ParticipantToPost =
      | { readonly target: "self"; readonly draft: ParticipantDraft; readonly idx: 0 }
      | { readonly target: "other"; readonly draft: ParticipantDraft; readonly idx: number };

    const participants: ParticipantToPost[] = [];
    // Never POST self when the gate already knows an active self registration.
    if (selfSelected && !selfTabLocked) {
      participants.push({ target: "self", draft: selfDraft, idx: 0 });
    }
    for (let i = 0; i < otherGuests.length; i++) {
      participants.push({ target: "other", draft: otherGuests[i]!, idx: i });
    }

    if (participants.length === 0) {
      setLoading(false);
      return;
    }

    const results: {
      readonly target: "self" | "other";
      readonly idx: number;
      readonly ok: boolean;
      readonly error?: string;
      readonly kind?: "self_already";
    }[] = [];

    try {
      for (const p of participants) {
        const target = p.target;
        const intakeContextForTarget = resolveIntakeContext(target);
        const effectiveSchemaForTarget =
          target === "self" ? effectiveSchemaSelf : effectiveSchemaOther;
        const schemaValuesForTarget = {
          fullName: p.draft.intakeName,
          phone: p.draft.intakePhone,
          nationalId: p.draft.intakeNationalId,
          fatherName: p.draft.intakeFatherName,
          birthDate: p.draft.intakeBirthDate,
          email: p.draft.intakeEmail,
          partySize: p.draft.partySize,
          notes: p.draft.notes,
        };

        const merged = resolveIntakeSubmitValues({
          pluginId: context.pluginId,
          context: intakeContextForTarget,
          formValues: schemaValuesForTarget,
        });

        const issues = validateIntakeSchemaValues(effectiveSchemaForTarget, merged);
        if (issues.length > 0) {
          const firstIssue = issues[0]!;
          setError(intakeValidationMessage(t, firstIssue.fieldId, firstIssue.code));
          return;
        }

        if (target === "other") {
          const mobileCode = classifyPublicRegistrationMobileInput(
            (merged.phone as string | undefined) ?? p.draft.intakePhone
          );
          if (mobileCode === "MOBILE_REQUIRED") {
            setError(t("errors.MOBILE_REQUIRED"));
            return;
          }
          if (mobileCode === "MOBILE_INVALID") {
            setError(t("errors.MOBILE_INVALID"));
            return;
          }
        }

        if (!transportSurface.isComplete(context.tourTransport, p.draft.transportState)) {
          setError(t("intake.transportIncomplete"));
          return;
        }

        const transportPayload = transportSurface.buildPayload(
          context.tourTransport,
          p.draft.transportState
        );

        // Denali registers one participant per submission.
        const partySize = 1;
        const guestPhone =
          target === "other" ? (((merged.phone ?? p.draft.intakePhone) as string) ?? "").trim() : "";
        const email = (((merged.email ?? data.sessionEmail) as string) ?? "").trim();

        const idempotencyKey = `portal-denali-reg-${context.tourId}-${target}-${p.idx}-${submitSeed}`;
        const res = await fetch("/api/catalog/registrations", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify({
            tourId: context.tourId,
            fullName: merged.fullName,
            partySize,
            registrantTarget: target,
            ...(guestPhone.length > 0 ? { phone: guestPhone } : {}),
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
          const apiErrCode = typeof result.code === "string" ? result.code : "network";
          if (target === "self" && isSelfAlreadyRegisteredApiCode(apiErrCode)) {
            // Confirm an actual self row before claiming "already registered yourself".
            // BOOKING_GUEST_DUPLICATE alone may be identity collision (nationalId/phone/name)
            // without a member self registration — do not false-lock or hide that fact.
            const id = await refreshSelfRegistrationIdFromForTour();
            if (id !== null) {
              lockSelfAsAlreadyRegistered(id);
              continue;
            }
            if (apiErrCode === "BOOKING_GUEST_DUPLICATE") {
              results.push({
                target,
                idx: p.idx,
                ok: false,
                error: t("errors.SELF_IDENTITY_DUPLICATE"),
              });
              continue;
            }
            // DENALI_REGISTRATION_DUPLICATE but for-tour still null (rare race):
            // show duplicate copy + trips CTA without inventing a detail id.
            results.push({
              target,
              idx: p.idx,
              ok: false,
              kind: "self_already",
              error: resolveError("DENALI_REGISTRATION_DUPLICATE"),
            });
            continue;
          }
          results.push({
            target,
            idx: p.idx,
            ok: false,
            error: resolveError(apiErrCode),
          });
          continue;
        }

        results.push({ target, idx: p.idx, ok: true });
      }
    } catch {
      setError(resolveError("network"));
      return;
    } finally {
      setLoading(false);
    }

    const allOk = results.length > 0 && results.every((r) => r.ok === true);
    if (!allOk) {
      if (results.length > 0) {
        setSubmitResults(results);
      }
      return;
    }
    transitionFlowStep(dispatch, "done");
  }

  return (
    <form onSubmit={handleSubmit} data-public-registration-intake data-tour-id={context.tourId}>
      <header data-denali-intake-header>
        <p data-denali-intake-stage-eyebrow>{t("intake.stageEyebrow")}</p>
        <h2>{t("intake.title")}</h2>
        <p data-denali-intake-stage-lede>{t("intake.stageLede")}</p>
        {selfTabLocked ? (
          <p data-registration-self-already role="status">
            {t("intake.selfAlreadyRegistered")}{" "}
            {effectiveSelfRegistrationId !== null ? (
              <a
                data-registration-self-already-detail
                href={`/me/registrations/${encodeURIComponent(effectiveSelfRegistrationId)}`}
              >
                {t("intake.viewOrEditRegistration")}
              </a>
            ) : null}
            {context.memberModuleHref !== null ? (
              <>
                {effectiveSelfRegistrationId !== null ? " · " : null}
                <a data-registration-self-already-trips href={context.memberModuleHref}>
                  {t("intake.viewMyTrips")}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
      </header>

      {submitResults !== null && submitResults.some((r) => !r.ok) ? (
        <div data-denali-submit-results role="alert" aria-live="polite">
          {submitResults.some((r) => r.ok) ? (
            <p data-denali-submit-partial-success>
              {t("intake.partialSuccess", {
                okCount: submitResults.filter((r) => r.ok).length,
                totalCount: submitResults.length,
              })}{" "}
              {context.memberModuleHref !== null ? (
                <a href={context.memberModuleHref}>{t("intake.viewMyRegistrations")}</a>
              ) : null}
            </p>
          ) : null}
          {submitResults.map((r) => {
            if (r.ok) return null;
            if (r.kind === "self_already") {
              return (
                <p key={`${r.target}-${r.idx}`} data-denali-submit-result-error data-denali-self-duplicate-guide>
                  {r.error ?? resolveError("DENALI_REGISTRATION_DUPLICATE")}
                  {context.memberModuleHref !== null ? (
                    <>
                      {" "}
                      <a href={context.memberModuleHref}>{t("intake.viewMyTrips")}</a>
                    </>
                  ) : null}
                </p>
              );
            }
            const label =
              r.target === "self"
                ? t("intake.forSelfTab")
                : t("intake.guestCardTitle", { index: r.idx + 1 });
            return (
              <p key={`${r.target}-${r.idx}`} data-denali-submit-result-error>
                {label}: {r.error ?? ""}
              </p>
            );
          })}
        </div>
      ) : null}

      <div data-denali-intake-layout>
        <section data-denali-intake-section data-denali-intake-section-kind="self">
          <div data-denali-intake-section-header data-denali-intake-section-header-kind="self">
            <div data-denali-intake-section-copy>
              <h3>{t("intake.selfSectionTitle")}</h3>
              <p data-denali-intake-section-description>{t("intake.selfSectionDescription")}</p>
            </div>
            <div data-denali-intake-section-control>
              {selfTabLocked ? (
                <p data-denali-self-locked-chip>{t("intake.selfSectionLocked")}</p>
              ) : (
                <div data-denali-registrant-self-toggle>
                  <label>
                    <input
                      type="checkbox"
                      checked={selfSelected}
                      disabled={selfTabLocked}
                      onChange={() => {
                        // Toggle from React state (not e.target.checked) so automation/DOM drift
                        // cannot leave selfSelected true while the native box looks unchecked.
                        setSelfSelected((prev) => {
                          const next = !prev;
                          if (!next) {
                            setOtherGuests((guests) =>
                              guests.length === 0 ? [createEmptyOtherDraft()] : guests
                            );
                          }
                          return next;
                        });
                      }}
                    />
                    <span>{t("intake.forSelfTab")}</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {selfSelected ? (
            <div data-denali-self-guest-card>
              {showKnownNameHintSelf ? (
                <p data-intake-known-name>{t("intake.knownNameHint", { name: data.intakeName })}</p>
              ) : null}
              <RenderIntakeForm
                schema={effectiveSchemaSelf}
                values={{
                  fullName: selfDraft.intakeName,
                  phone: selfDraft.intakePhone,
                  nationalId: selfDraft.intakeNationalId,
                  fatherName: selfDraft.intakeFatherName,
                  birthDate: selfDraft.intakeBirthDate,
                  email: selfDraft.intakeEmail,
                  partySize: selfDraft.partySize,
                  notes: selfDraft.notes,
                }}
                onChange={(fieldId, value) => updateSelfField(fieldId, value)}
                resolveLabel={(field: IntakeField) => t(field.labelKey)}
                errorId={errorId}
                hasError={error !== null}
              />

              {personalCarOptInVisible ? (
                <label className="portal-registration-transport-opt-in" data-public-registration-personal-car-opt-in>
                  <input
                    type="checkbox"
                    checked={selfDraft.transportState.optInPersonalCar}
                    onChange={(event) =>
                      setSelfDraft((prev) => ({
                        ...prev,
                        transportState: {
                          ...prev.transportState,
                          optInPersonalCar: event.target.checked,
                          hasPersonalCar: null,
                          personalCarOccupants: null,
                          paysDong: null,
                        },
                      }))
                    }
                  />
                  <span>{t("intake.personalCarOptIn")}</span>
                </label>
              ) : null}

              {transportSurface.showTransportFollowUp(context.tourTransport, selfDraft.transportState) ? (
                <fieldset data-public-registration-transport>
                  <legend>{t("intake.transportLegend")}</legend>
                  <p>{t("intake.hasPersonalCarQuestion")}</p>

                  <label>
                    <input
                      type="radio"
                      name="hasPersonalCar-self"
                      checked={selfDraft.transportState.hasPersonalCar === true}
                      onChange={() =>
                        setSelfDraft((prev) => ({
                          ...prev,
                          transportState: {
                            ...prev.transportState,
                            hasPersonalCar: true,
                            paysDong: null,
                          },
                        }))
                      }
                    />
                    {t("intake.hasPersonalCarYes")}
                  </label>

                  <label>
                    <input
                      type="radio"
                      name="hasPersonalCar-self"
                      checked={selfDraft.transportState.hasPersonalCar === false}
                      onChange={() =>
                        setSelfDraft((prev) => ({
                          ...prev,
                          transportState: {
                            ...prev.transportState,
                            hasPersonalCar: false,
                            personalCarOccupants: null,
                            paysDong: null,
                          },
                        }))
                      }
                    />
                    {t("intake.hasPersonalCarNo")}
                  </label>

                  {selfDraft.transportState.hasPersonalCar === true ? (
                    <div data-public-registration-transport-occupants>
                      <p>{t("intake.personalCarOccupantsLabel")}</p>
                      {([1, 2, 3] as const).map((count) => (
                        <label key={count}>
                          <input
                            type="radio"
                            name="personalCarOccupants-self"
                            checked={selfDraft.transportState.personalCarOccupants === count}
                            onChange={() =>
                              setSelfDraft((prev) => ({
                                ...prev,
                                transportState: { ...prev.transportState, personalCarOccupants: count },
                              }))
                            }
                          />
                          {t(`intake.personalCarOccupants.${count}`)}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {selfDraft.transportState.hasPersonalCar === false ? (
                    <div data-public-registration-transport-dong>
                      <p>{t("intake.paysDongQuestion")}</p>
                      <label>
                        <input
                          type="radio"
                          name="paysDong-self"
                          checked={selfDraft.transportState.paysDong === true}
                          onChange={() =>
                            setSelfDraft((prev) => ({
                              ...prev,
                              transportState: { ...prev.transportState, paysDong: true },
                            }))
                          }
                        />
                        {t("intake.paysDongYes")}
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="paysDong-self"
                          checked={selfDraft.transportState.paysDong === false}
                          onChange={() =>
                            setSelfDraft((prev) => ({
                              ...prev,
                              transportState: { ...prev.transportState, paysDong: false },
                            }))
                          }
                        />
                        {t("intake.paysDongNo")}
                      </label>
                    </div>
                  ) : null}
                </fieldset>
              ) : null}
            </div>
          ) : null}
        </section>

        {otherGuests.length === 0 ? (
          <section
            data-registration-other-guest-list
            data-denali-other-guest-list
            data-denali-other-guest-empty
            aria-label={t("intake.otherGuestsTitle")}
          >
            <div data-denali-intake-section-header data-denali-intake-section-header-kind="guests">
              <div data-denali-intake-section-copy>
                <h3>{t("intake.otherGuestsTitle")}</h3>
                <p data-denali-intake-section-description>{t("intake.otherGuestsDescription")}</p>
              </div>
              <div data-denali-other-guest-toolbar>
                <p data-denali-intake-section-badge>
                  {t("intake.guestCount", { count: guestDraftCount })}
                </p>
              </div>
            </div>
            <div data-denali-other-guest-empty-state>
              <p data-denali-other-guest-empty-lede>{t("intake.otherGuestsEmpty")}</p>
              <button
                type="button"
                data-denali-add-guest
                data-denali-add-guest-variant="empty"
                disabled={loading}
                onClick={() => setOtherGuests([createEmptyOtherDraft()])}
              >
                {t("intake.addGuest")}
              </button>
            </div>
          </section>
        ) : (
          <section
            data-registration-other-guest-list
            data-denali-other-guest-list
            aria-label={t("intake.otherGuestsTitle")}
          >
            <div data-denali-other-guest-header>
              <div data-denali-intake-section-header data-denali-intake-section-header-kind="guests">
                <div data-denali-intake-section-copy>
                  <h3>{t("intake.otherGuestsTitle")}</h3>
                  <p data-denali-intake-section-description>
                    {t("intake.otherGuestsDescription")}
                  </p>
                </div>
                <div data-denali-other-guest-toolbar>
                  <p data-denali-intake-section-badge>
                    {t("intake.guestCount", { count: guestDraftCount })}
                  </p>
                  {canAddGuest ? (
                    <button
                      type="button"
                      data-denali-add-guest
                      data-denali-add-guest-variant="inline"
                      onClick={() =>
                        setOtherGuests((prev) =>
                          prev.length >= DENALI_MAX_OTHER_GUESTS
                            ? prev
                            : [...prev, createEmptyOtherDraft()]
                        )
                      }
                    >
                      {t("intake.addGuest")}
                    </button>
                  ) : null}
                </div>
              </div>
              {otherGuests.length >= DENALI_MAX_OTHER_GUESTS ? (
                <p data-denali-guest-limit role="status">
                  {t("intake.guestLimitReached", { max: DENALI_MAX_OTHER_GUESTS })}
                </p>
              ) : null}
            </div>

            <div data-denali-other-guest-cards>
              {otherGuests.map((guest, guestIdx) => {
                const transportFollowUpVisible = transportSurface.showTransportFollowUp(
                  context.tourTransport,
                  guest.transportState
                );
                return (
                  <div key={guestIdx} data-denali-other-guest-card data-denali-guest-idx={guestIdx}>
                    <h4>{t("intake.guestCardTitle", { index: guestIdx + 1 })}</h4>
                    <RenderIntakeForm
                      schema={effectiveSchemaOther}
                      values={{
                        fullName: guest.intakeName,
                        phone: guest.intakePhone,
                        nationalId: guest.intakeNationalId,
                        fatherName: guest.intakeFatherName,
                        birthDate: guest.intakeBirthDate,
                        email: guest.intakeEmail,
                        partySize: guest.partySize,
                        notes: guest.notes,
                      }}
                      onChange={(fieldId, value) => updateGuestField(guestIdx, fieldId, value)}
                      resolveLabel={(field: IntakeField) => t(field.labelKey)}
                      errorId={errorId}
                      hasError={error !== null}
                    />

                    {personalCarOptInVisible ? (
                      <label
                        className="portal-registration-transport-opt-in"
                        data-public-registration-personal-car-opt-in
                        data-denali-guest-transport={guestIdx}
                      >
                        <input
                          type="checkbox"
                          checked={guest.transportState.optInPersonalCar}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setOtherGuests((prev) =>
                              prev.map((g, idx) => {
                                if (idx !== guestIdx) return g;
                                return {
                                  ...g,
                                  transportState: {
                                    ...g.transportState,
                                    optInPersonalCar: checked,
                                    hasPersonalCar: null,
                                    personalCarOccupants: null,
                                    paysDong: null,
                                  },
                                };
                              })
                            );
                          }}
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
                            name={`hasPersonalCar-${guestIdx}`}
                            checked={guest.transportState.hasPersonalCar === true}
                            onChange={() =>
                              setOtherGuests((prev) =>
                                prev.map((g, idx) =>
                                  idx === guestIdx
                                    ? {
                                        ...g,
                                        transportState: {
                                          ...g.transportState,
                                          hasPersonalCar: true,
                                          paysDong: null,
                                        },
                                      }
                                    : g
                                )
                              )
                            }
                          />
                          {t("intake.hasPersonalCarYes")}
                        </label>

                        <label>
                          <input
                            type="radio"
                            name={`hasPersonalCar-${guestIdx}`}
                            checked={guest.transportState.hasPersonalCar === false}
                            onChange={() =>
                              setOtherGuests((prev) =>
                                prev.map((g, idx) =>
                                  idx === guestIdx
                                    ? {
                                        ...g,
                                        transportState: {
                                          ...g.transportState,
                                          hasPersonalCar: false,
                                          personalCarOccupants: null,
                                          paysDong: null,
                                        },
                                      }
                                    : g
                                )
                              )
                            }
                          />
                          {t("intake.hasPersonalCarNo")}
                        </label>

                        {guest.transportState.hasPersonalCar === true ? (
                          <div data-public-registration-transport-occupants>
                            <p>{t("intake.personalCarOccupantsLabel")}</p>
                            {([1, 2, 3] as const).map((count) => (
                              <label key={count}>
                                <input
                                  type="radio"
                                  name={`personalCarOccupants-${guestIdx}`}
                                  checked={guest.transportState.personalCarOccupants === count}
                                  onChange={() =>
                                    setOtherGuests((prev) =>
                                      prev.map((g, idx) =>
                                        idx === guestIdx
                                          ? {
                                              ...g,
                                              transportState: {
                                                ...g.transportState,
                                                personalCarOccupants: count,
                                              },
                                            }
                                          : g
                                      )
                                    )
                                  }
                                />
                                {t(`intake.personalCarOccupants.${count}`)}
                              </label>
                            ))}
                          </div>
                        ) : null}

                        {guest.transportState.hasPersonalCar === false ? (
                          <div data-public-registration-transport-dong>
                            <p>{t("intake.paysDongQuestion")}</p>
                            <label>
                              <input
                                type="radio"
                                name={`paysDong-${guestIdx}`}
                                checked={guest.transportState.paysDong === true}
                                onChange={() =>
                                  setOtherGuests((prev) =>
                                    prev.map((g, idx) =>
                                      idx === guestIdx
                                        ? { ...g, transportState: { ...g.transportState, paysDong: true } }
                                        : g
                                    )
                                  )
                                }
                              />
                              {t("intake.paysDongYes")}
                            </label>
                            <label>
                              <input
                                type="radio"
                                name={`paysDong-${guestIdx}`}
                                checked={guest.transportState.paysDong === false}
                                onChange={() =>
                                  setOtherGuests((prev) =>
                                    prev.map((g, idx) =>
                                      idx === guestIdx
                                        ? { ...g, transportState: { ...g.transportState, paysDong: false } }
                                        : g
                                    )
                                  )
                                }
                              />
                              {t("intake.paysDongNo")}
                            </label>
                          </div>
                        ) : null}
                      </fieldset>
                    ) : null}

                    {otherGuests.length > 1 ? (
                      <button
                        type="button"
                        data-denali-remove-guest
                        onClick={() => setOtherGuests((prev) => prev.filter((_, idx) => idx !== guestIdx))}
                      >
                        {t("intake.removeGuest")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>

      <div data-denali-intake-submit-bar>
        <div data-denali-intake-summary-card>
          <div data-denali-intake-summary-topline>
            <p data-denali-intake-summary-title>{t("intake.summaryTitle")}</p>
            <div data-denali-intake-summary-stats>
              <p data-denali-intake-summary-stat>
                <span>{t("intake.summaryTravelersLabel")}</span>
                <strong>{travelerDraftCount}</strong>
              </p>
              <p data-denali-intake-summary-stat>
                <span>{t("intake.summaryGuestsLabel")}</span>
                <strong>{guestDraftCount}</strong>
              </p>
            </div>
          </div>
          {estimatedPrice !== null ? (
            <p data-registration-price-hint>
              {t("intake.estimatedPrice", { amount: estimatedPrice.toLocaleString() })}
            </p>
          ) : null}
          <p data-denali-intake-summary-label>{t("intake.submitHint")}</p>
        </div>

        {error !== null ? (
          <p id={errorId} role="alert">
            {error}
          </p>
        ) : null}

        <div data-denali-intake-submit-actions>
          <p data-denali-intake-submit-state>{t("intake.summaryReady")}</p>
          <button
            type="submit"
            disabled={loading || (!selfSelected && otherGuests.length === 0)}
            data-action="intake-submit"
          >
            {loading ? t("intake.submitting") : t("intake.submit")}
          </button>
        </div>
      </div>
    </form>
  );
}

export function DenaliDoneStep({ context, state }: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const attrs =
    denaliCatalogRegistrationFlowSurface.successDataAttributes?.(state, context) ?? {};
  return (
    <div data-public-registration-success {...attrs}>
      <div data-denali-success-card>
        <div data-denali-success-hero aria-hidden="true">
          <span data-denali-success-orbit="outer" />
          <span data-denali-success-orbit="inner" />
          <span data-denali-success-check>+</span>
        </div>
        <div data-denali-success-copy>
          <p data-denali-success-eyebrow>{t("success.eyebrow")}</p>
          <p role="status">{t("success.message", { tourTitle: context.tourTitle })}</p>
          <p data-denali-success-lede>{t("success.lede")}</p>
        </div>
      </div>
      <div data-denali-success-actions>
        {context.memberModuleHref !== null ? (
          <p>
            <a href={context.memberModuleHref}>{t("success.viewRegistrations")}</a>
          </p>
        ) : null}
        <p>
          <a href={context.backHref}>{t("success.backToTour")}</a>
        </p>
      </div>
    </div>
  );
}

export const denaliRegistrationFlowSteps = Object.freeze({
  ...catalogRegistrationAuthFlowSteps,
  intake: DenaliIntakeStep,
  done: DenaliDoneStep,
});
