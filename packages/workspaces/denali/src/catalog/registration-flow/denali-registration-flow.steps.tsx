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
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";

import {
  denaliCatalogTransportIntakeSurface,
  isDenaliIntakeDongOffered,
} from "../denali-catalog-transport-intake";
import {
  denaliCatalogRegistrationFlowSurface,
  readDenaliFlowData,
} from "./denali-registration-flow.surface";
import {
  denaliRequiredIntakeCopyField,
  denaliIntakeNationalIdChecksumIssue,
  findDuplicateOtherGuestMobile,
  parseCatalogRegistrationResponseBody,
} from "./denali-registration-intake-client-logic";

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
  code: "required" | "pattern" | "checksum"
): string {
  if (code === "checksum" && fieldId === "nationalId") {
    return t("intake.nationalIdChecksumInvalid");
  }
  if (code === "required") {
    const field = denaliRequiredIntakeCopyField(fieldId);
    if (field === "fullName") return t("errors.DISPLAY_NAME_REQUIRED");
    if (field === "phone") return t("errors.MOBILE_REQUIRED");
    if (field === "email") return t("intake.emailRequired");
    if (field === "fatherName") return t("intake.fatherNameInvalid");
    if (field === "nationalId") return t("intake.nationalIdInvalid");
    if (field === "birthDate") return t("intake.birthDateInvalid");
    return t("intake.partySizeInvalid");
  }
  if (fieldId === "phone") return t("errors.MOBILE_INVALID");
  if (fieldId === "nationalId") return t("intake.nationalIdInvalid");
  if (fieldId === "birthDate") return t("intake.birthDateInvalid");
  return t("intake.partySizeInvalid");
}

export function DenaliIntakeStep({
  context,
  state,
  dispatch,
  resolveError,
}: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const data = readDenaliFlowData(state);
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<{
    readonly scope: "self" | "other";
    readonly idx: number;
    readonly fieldId: string;
  } | null>(null);
  // Gate automation until client handlers are attached — SSR submit is a GET with
  // query-string field names and never hits /api/catalog/registrations.
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => {
    setClientReady(true);
  }, []);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (viewport == null) return;
    const syncKeyboard = (): void => {
      const overlap = window.innerHeight - viewport.height - viewport.offsetTop;
      formRef.current?.toggleAttribute("data-denali-keyboard-open", overlap > 120);
    };
    viewport.addEventListener("resize", syncKeyboard);
    viewport.addEventListener("scroll", syncKeyboard);
    return () => {
      viewport.removeEventListener("resize", syncKeyboard);
      viewport.removeEventListener("scroll", syncKeyboard);
    };
  }, []);
  useEffect(() => {
    if (invalidField === null) return;
    const prefix =
      invalidField.scope === "self"
        ? "denali-intake-self"
        : `denali-intake-other-${invalidField.idx}`;
    document.getElementById(`${prefix}-${invalidField.fieldId}`)?.focus();
  }, [invalidField]);
  const [submitResults, setSubmitResults] = useState<
    | readonly {
        readonly target: "self" | "other";
        readonly idx: number;
        readonly ok: boolean;
        readonly error?: string;
        /** Self duplicate safety net — show trips CTA when for-tour id is still unknown. */
        readonly kind?: "self_already";
      }[]
    | null
  >(null);

  const transportSurface = denaliCatalogTransportIntakeSurface;
  const existingSelfRegistrationId = context.existingSelfRegistrationId ?? null;
  const [discoveredSelfRegistrationId, setDiscoveredSelfRegistrationId] = useState<string | null>(
    null
  );
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
    // Phase 3: self-already must not auto-open a blank other-guest card.
    if (selfTabLocked) return [];
    if (data.registrantTarget !== "other") return [];
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

  const showKnownNameHintSelf = !effectiveSchemaSelf.fields.some(
    (field) => field.id === "fullName"
  );
  const personalCarOptInVisible = transportSurface.showPersonalCarOptIn(context.tourTransport);

  const estimatedPrice = useMemo(() => {
    const candidateTransportState = selfSelected
      ? selfDraft.transportState
      : (otherGuests[0]?.transportState ?? data.transportState);
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

  async function handleSubmit(event?: FormEvent): Promise<void> {
    event?.preventDefault();
    if (!selfSelected && otherGuests.length === 0) return;

    setLoading(true);
    setError(null);
    setInvalidField(null);
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
      if (findDuplicateOtherGuestMobile(otherGuests.map((guest) => guest.intakePhone)) !== null) {
        setError(t("errors.BOOKING_GUEST_DUPLICATE"));
        return;
      }

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
          setInvalidField({ scope: target, idx: p.idx, fieldId: firstIssue.fieldId });
          setError(intakeValidationMessage(t, firstIssue.fieldId, firstIssue.code));
          return;
        }

        const nationalIdChecksum = denaliIntakeNationalIdChecksumIssue({
          fieldInSchema: effectiveSchemaForTarget.fields.some((field) => field.id === "nationalId"),
          nationalId: merged.nationalId,
        });
        if (nationalIdChecksum !== null) {
          setInvalidField({ scope: target, idx: p.idx, fieldId: "nationalId" });
          setError(intakeValidationMessage(t, "nationalId", "checksum"));
          return;
        }

        if (target === "other") {
          const mobileCode = classifyPublicRegistrationMobileInput(
            (merged.phone as string | undefined) ?? p.draft.intakePhone
          );
          if (mobileCode === "MOBILE_REQUIRED") {
            setInvalidField({ scope: "other", idx: p.idx, fieldId: "phone" });
            setError(t("errors.MOBILE_REQUIRED"));
            return;
          }
          if (mobileCode === "MOBILE_INVALID") {
            setInvalidField({ scope: "other", idx: p.idx, fieldId: "phone" });
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
          target === "other"
            ? (((merged.phone ?? p.draft.intakePhone) as string) ?? "").trim()
            : "";
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

        const text = await res.text();
        const result = parseCatalogRegistrationResponseBody(text) ?? {};
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

  const selfDisplayName = (selfDraft.intakeName || data.intakeName).trim();
  const namedParty = [
    ...(selfSelected && selfDisplayName.length > 0 ? [selfDisplayName] : []),
    ...otherGuests.map((guest) => guest.intakeName.trim()).filter((name) => name.length > 0),
  ];
  const partyLineText =
    namedParty.length > 0
      ? namedParty.join(" · ")
      : t("intake.partyCount", { count: travelerDraftCount });
  const formattedPrice =
    estimatedPrice !== null ? estimatedPrice.toLocaleString() : null;
  const submitDisabled =
    loading || !clientReady || (!selfSelected && otherGuests.length === 0);
  const ctaAlert =
    error !== null && invalidField === null ? (
      <p id={errorId} role="alert" data-denali-cta-alert>
        {error}
      </p>
    ) : null;
  function fieldAlert(scope: "self" | "other", idx: number) {
    if (
      error === null ||
      invalidField === null ||
      invalidField.scope !== scope ||
      invalidField.idx !== idx
    ) {
      return null;
    }
    return (
      <p id={errorId} role="alert" data-denali-field-alert>
        {error}
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      data-public-registration-intake
      data-denali-registration-ledger
      data-registration-ready={clientReady ? "" : undefined}
      data-tour-id={context.tourId}
    >
      <a href="#denali-ledger-main" data-denali-skip>
        {t("intake.skipToForm")}
      </a>
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
      {travelerDraftCount > 0 ? (
        <p data-denali-party-line>
          {partyLineText}
          {formattedPrice !== null ? (
            <>
              {" · "}
              <strong>{t("intake.priceAmount", { amount: formattedPrice })}</strong>{" "}
              <span>{t("intake.perPerson")}</span>
            </>
          ) : null}
        </p>
      ) : null}

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
                <p
                  key={`${r.target}-${r.idx}`}
                  data-denali-submit-result-error
                  data-denali-self-duplicate-guide
                >
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
        <div data-denali-ledger-main id="denali-ledger-main">
        <section data-denali-intake-section data-denali-intake-section-kind="self">
          <div data-denali-self-ident>
            {selfDisplayName.length > 0 || showKnownNameHintSelf ? (
              <h2 data-denali-self-name>{selfDisplayName || data.intakeName}</h2>
            ) : (
              <h2 data-denali-self-name>{t("intake.selfSectionTitle")}</h2>
            )}
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
                    <span>{t("intake.inTour")}</span>
                  </label>
                </div>
              )}
            </div>
          </div>

          {selfSelected ? (
            <div data-denali-self-guest-card>
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
                idPrefix="denali-intake-self"
                errorId={errorId}
                invalidFieldId={
                  invalidField?.scope === "self" ? invalidField.fieldId : undefined
                }
              />

              {personalCarOptInVisible ? (
                <label
                  className="portal-registration-transport-opt-in"
                  data-public-registration-personal-car-opt-in
                >
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

              {transportSurface.showTransportFollowUp(
                context.tourTransport,
                selfDraft.transportState
              ) ? (
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
                                transportState: {
                                  ...prev.transportState,
                                  personalCarOccupants: count,
                                },
                              }))
                            }
                          />
                          {t(`intake.personalCarOccupants.${count}`)}
                        </label>
                      ))}
                    </div>
                  ) : null}

                  {selfDraft.transportState.hasPersonalCar === false &&
                  isDenaliIntakeDongOffered(context.tourTransport) ? (
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
              {fieldAlert("self", 0)}
            </div>
          ) : null}
        </section>

        <section
          data-registration-other-guest-list
          data-denali-other-guest-list
          {...(otherGuests.length === 0 ? { "data-denali-other-guest-empty": "" } : {})}
          aria-label={t("intake.otherGuestsTitle")}
        >
          <div data-denali-other-guest-header>
            <div
              data-denali-intake-section-header
              data-denali-intake-section-header-kind="guests"
            >
              <h2 data-denali-guests-legend>{t("intake.otherGuestsTitle")}</h2>
              <div data-denali-other-guest-toolbar>
                {canAddGuest ? (
                  <button
                    type="button"
                    data-denali-add-guest
                    data-denali-add-guest-variant={otherGuests.length === 0 ? "empty" : "inline"}
                    disabled={loading}
                    onClick={() =>
                      setOtherGuests((prev) =>
                        prev.length >= DENALI_MAX_OTHER_GUESTS
                          ? prev
                          : [...prev, createEmptyOtherDraft()]
                      )
                    }
                  >
                    {t("intake.addGuestShort")}
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

          {otherGuests.length > 0 ? (
            <div data-denali-other-guest-cards>
              {otherGuests.map((guest, guestIdx) => {
                const transportFollowUpVisible = transportSurface.showTransportFollowUp(
                  context.tourTransport,
                  guest.transportState
                );
                const guestName = guest.intakeName.trim();
                return (
                  <div key={guestIdx} data-denali-other-guest-card data-denali-guest-idx={guestIdx}>
                    {guestName.length > 0 ? (
                      <h3 data-denali-guest-name>{guestName}</h3>
                    ) : null}
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
                      idPrefix={`denali-intake-other-${guestIdx}`}
                      errorId={errorId}
                      invalidFieldId={
                        invalidField?.scope === "other" && invalidField.idx === guestIdx
                          ? invalidField.fieldId
                          : undefined
                      }
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

                        {guest.transportState.hasPersonalCar === false &&
                        isDenaliIntakeDongOffered(context.tourTransport) ? (
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
                                        ? {
                                            ...g,
                                            transportState: { ...g.transportState, paysDong: true },
                                          }
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
                                        ? {
                                            ...g,
                                            transportState: {
                                              ...g.transportState,
                                              paysDong: false,
                                            },
                                          }
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
                        onClick={() =>
                          setOtherGuests((prev) => prev.filter((_, idx) => idx !== guestIdx))
                        }
                      >
                        {t("intake.removeGuestShort")}
                      </button>
                    ) : null}
                    {fieldAlert("other", guestIdx)}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
        </div>

        <div data-denali-ledger-rail-col>
        <aside
          data-denali-intake-summary-card
          data-denali-ledger-rail
          aria-label={t("intake.summaryRailLabel")}
        >
          <p data-denali-intake-summary-title>{t("intake.summaryTitle")}</p>
          <ul data-denali-ledger-people>
            {selfSelected && (selfDisplayName.length > 0 || showKnownNameHintSelf) ? (
              <li>
                {selfDisplayName || data.intakeName}{" "}
                <span data-denali-person-tag>{t("intake.myselfTag")}</span>
              </li>
            ) : null}
            {otherGuests.map((guest, guestIdx) => {
              const name = guest.intakeName.trim();
              return (
                <li key={guestIdx}>
                  {name.length > 0 ? name : t("intake.unnamedPerson")}
                </li>
              );
            })}
          </ul>
          {formattedPrice !== null ? (
            <>
              <p data-registration-price-hint>
                {t("intake.priceAmount", { amount: formattedPrice })}
              </p>
              <p data-denali-price-per>{t("intake.perPerson")}</p>
            </>
          ) : null}
        </aside>

        <div
          data-denali-intake-submit-bar
          role="region"
          aria-label={t("intake.stickySubmitLabel")}
        >
          {ctaAlert}
          <div data-denali-intake-submit-actions>
            <button
              type="button"
              disabled={submitDisabled}
              data-action="intake-submit"
              onClick={() => void handleSubmit()}
            >
              {loading ? t("intake.submitting") : t("intake.submit")}
            </button>
          </div>
        </div>
        </div>
      </div>
    </form>
  );
}

export function DenaliDoneStep({ context, state }: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const attrs = denaliCatalogRegistrationFlowSurface.successDataAttributes?.(state, context) ?? {};
  return (
    <div data-public-registration-success data-denali-registration-ledger {...attrs}>
      <p data-denali-success-kicker>{t("intake.kicker")}</p>
      <h1 data-denali-success-title>{t("success.title")}</h1>
      <p data-denali-success-tour role="status">
        {t("success.message", { tourTitle: context.tourTitle })}
      </p>
      <div data-denali-success-actions>
        {context.memberModuleHref !== null ? (
          <p>
            <a data-denali-success-primary href={context.memberModuleHref}>
              {t("success.viewRegistrations")}
            </a>
          </p>
        ) : null}
        <p>
          <a data-denali-success-secondary href={context.backHref}>
            {t("success.backToTour")}
          </a>
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
