"use client";

import { formatIranMobileForDisplay } from "@app-tour/iran-mobile";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import type { OperatorSessionContext } from "@/admin/require-operator-session";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import type { OperatorTourDetailResponse } from "@/features/tours/operator-tour-detail-types";
import type { UsersDirectoryRow } from "@/features/users/users-directory-types";
import type { AppLocale } from "@/i18n/routing";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";

import {
  ADMIN_ASSISTED_REGISTRATION_STEPS,
  buildAdminAssistedRegistrationPayload,
  createDefaultAdminAssistedRegistrationForm,
  extractWorkspaceAdminRegistrationRequirements,
  formatAdminAssistedMoneyLabel,
  resolveTransportChoices,
  stepHasVisibleRequirements,
  validateAdminAssistedRegistrationStep,
  type AdminAssistedRegistrationFormState,
  type AdminAssistedRegistrationStep,
} from "./admin-assisted-registration-logic";

type AdminAssistedRegistrationDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly session: OperatorSessionContext;
  readonly tourId: string;
  readonly detail: OperatorTourDetailResponse | null;
  readonly onCreated?: () => void;
};

function readErrorCode(payload: unknown, fallback: string): string {
  if (payload !== null && typeof payload === "object") {
    const code = "code" in payload ? payload.code : undefined;
    if (typeof code === "string" && code.trim().length > 0) {
      return code.trim();
    }
    const error = "error" in payload ? payload.error : undefined;
    if (typeof error === "string" && error.trim().length > 0) {
      return error.trim();
    }
  }
  return fallback;
}

function formatContactSummary(phone: string | null | undefined, email: string | null | undefined): string {
  const phoneLabel =
    (phone ?? "").trim().length > 0 ? formatIranMobileForDisplay(phone ?? "") : "";
  const emailLabel = (email ?? "").trim();
  return [phoneLabel, emailLabel].filter((value) => value.length > 0).join(" · ");
}

function StepRail({
  steps,
  activeStep,
}: {
  readonly steps: readonly AdminAssistedRegistrationStep[];
  readonly activeStep: AdminAssistedRegistrationStep;
}) {
  const t = useTranslations("bookings.adminDialog.steps");
  const activeIndex = steps.indexOf(activeStep);
  return (
    <ol
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      data-testid="operator-admin-registration-steps"
    >
      {steps.map((step, index) => {
        const state =
          index < activeIndex ? "complete" : index === activeIndex ? "current" : "upcoming";
        return (
          <li key={step} className="rounded-md border px-3 py-2 text-xs" data-step-state={state}>
            <div className="font-medium">{index + 1}</div>
            <div className="text-muted-foreground">{t(step)}</div>
          </li>
        );
      })}
    </ol>
  );
}

export function AdminAssistedRegistrationDialog({
  open,
  onOpenChange,
  session,
  tourId,
  detail,
  onCreated,
}: AdminAssistedRegistrationDialogProps) {
  const t = useTranslations("bookings.adminDialog");
  const tErrors = useTranslations("bookings.adminDialog.errors");
  const locale = useLocale() as AppLocale;
  const requirements = useMemo(
    () => (detail === null ? null : extractWorkspaceAdminRegistrationRequirements(detail)),
    [detail]
  );
  const visibleSteps = useMemo(
    () =>
      ADMIN_ASSISTED_REGISTRATION_STEPS.filter((step) =>
        step === "requirements"
          ? requirements !== null && stepHasVisibleRequirements(requirements)
          : true
      ),
    [requirements]
  );
  const [currentStep, setCurrentStep] = useState<AdminAssistedRegistrationStep>("identity");
  const [form, setForm] = useState<AdminAssistedRegistrationFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberResults, setMemberResults] = useState<readonly UsersDirectoryRow[]>([]);
  const [memberLoading, setMemberLoading] = useState(false);

  useEffect(() => {
    if (!open || requirements === null) {
      return;
    }
    setCurrentStep(visibleSteps[0] ?? "identity");
    setForm(createDefaultAdminAssistedRegistrationForm(requirements));
    setError(null);
    setSubmitting(false);
    setMemberSearch("");
    setMemberResults([]);
    setMemberLoading(false);
  }, [open, requirements, visibleSteps]);

  useEffect(() => {
    if (!open || form?.registrantMode !== "member") {
      return;
    }
    const search = memberSearch.trim();
    if (search.length < 2) {
      setMemberResults([]);
      setMemberLoading(false);
      return;
    }
    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      setMemberLoading(true);
      void fetch(`/api/users?search=${encodeURIComponent(search)}&status=active&limit=6`, {
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error(`USERS_LIST_HTTP_${response.status}`);
          }
          return (await response.json()) as { items?: readonly UsersDirectoryRow[] };
        })
        .then((payload) => {
          if (!cancelled) {
            setMemberResults(payload.items ?? []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setMemberResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setMemberLoading(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [form?.registrantMode, memberSearch, open]);

  const stepIndex = visibleSteps.indexOf(currentStep);
  const transportChoices = requirements === null ? [] : resolveTransportChoices(requirements);
  const basePriceLabel =
    requirements?.basePricePerPerson !== null && requirements?.basePricePerPerson !== undefined
      ? formatAdminAssistedMoneyLabel(requirements.basePricePerPerson)
      : null;

  const updateField = <K extends keyof AdminAssistedRegistrationFormState>(
    key: K,
    value: AdminAssistedRegistrationFormState[K]
  ) => {
    setForm((current) => (current === null ? current : { ...current, [key]: value }));
  };

  const selectMember = (user: UsersDirectoryRow) => {
    const displayName = user.displayName.trim();
    setForm((current) =>
      current === null
        ? current
        : {
            ...current,
            registrantMode: "member",
            memberUserId: user.userId,
            memberDisplayName: displayName,
            guestLabel: displayName,
            guestPhone: user.phone?.trim() ?? "",
            guestEmail: user.email?.trim() ?? "",
          }
    );
    setMemberSearch(displayName);
    setMemberResults([]);
  };

  const goNext = () => {
    if (requirements === null || form === null) {
      return;
    }
    const validation = validateAdminAssistedRegistrationStep({
      step: currentStep,
      form,
      requirements,
    });
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    setError(null);
    const nextStep = visibleSteps[stepIndex + 1];
    if (nextStep !== undefined) {
      setCurrentStep(nextStep);
    }
  };

  const goBack = () => {
    const previousStep = visibleSteps[stepIndex - 1];
    if (previousStep !== undefined) {
      setCurrentStep(previousStep);
    }
  };

  const handleSubmit = async (approveNow: boolean) => {
    if (requirements === null || form === null) {
      return;
    }
    for (const step of visibleSteps) {
      const validation = validateAdminAssistedRegistrationStep({
        step,
        form,
        requirements,
      });
      if (!validation.ok) {
        setCurrentStep(step);
        setError(validation.message);
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = buildAdminAssistedRegistrationPayload({
        tourId,
        form: { ...form, approveNow },
        requirements,
      });
      const createResponse = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const created = (await createResponse.json().catch(() => ({}))) as {
        id?: string;
        status?: string;
        code?: string;
        error?: string;
      };
      if (!createResponse.ok || typeof created.id !== "string") {
        throw new Error(readErrorCode(created, `BOOKING_CREATE_HTTP_${createResponse.status}`));
      }
      if (approveNow) {
        const approveResponse = await fetch(
          `/api/bookings/${encodeURIComponent(created.id)}/approve`,
          {
            method: "POST",
          }
        );
        if (!approveResponse.ok) {
          const approvePayload = (await approveResponse.json().catch(() => ({}))) as {
            code?: string;
            error?: string;
          };
          throw new Error(
            readErrorCode(approvePayload, `BOOKING_APPROVE_HTTP_${approveResponse.status}`)
          );
        }
      }
      onOpenChange(false);
      onCreated?.();
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : "BOOKING_CREATE_FAILED");
      setSubmitting(false);
    }
  };

  const localizedError =
    error === null ? null : (resolveCodedErrorMessage(tErrors, error) ?? error);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="operator-admin-registration-dialog"
        className="flex max-h-[92vh] max-w-3xl flex-col overflow-hidden p-0"
        data-testid="operator-admin-registration-dialog"
      >
        <DialogHeader className="border-b px-6 pb-4 pt-6">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 border-b px-6 py-4">
          {requirements === null ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{requirements.title}</span>
                <span aria-hidden="true">·</span>
                <span>{requirements.departureAt ?? t("unknownDeparture")}</span>
                {basePriceLabel !== null ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{t("basePrice", { amount: basePriceLabel })}</span>
                  </>
                ) : null}
              </div>
              <StepRail steps={visibleSteps} activeStep={currentStep} />
            </>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {requirements === null || form === null ? (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-36 w-full" />
            </div>
          ) : null}

          {requirements !== null && form !== null && currentStep === "identity" ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("sections.registrant")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["member", "guest"] as const).map((mode) => (
                    <Button
                      key={mode}
                      type="button"
                      size="sm"
                      variant={form.registrantMode === mode ? "default" : "outline"}
                      onClick={() => {
                        updateField("registrantMode", mode);
                        if (mode === "guest") {
                          updateField("memberUserId", "");
                          updateField("memberDisplayName", "");
                          setMemberResults([]);
                        }
                      }}
                    >
                      {t(`registrantMode.${mode}`)}
                    </Button>
                  ))}
                </div>
              </div>

              {form.registrantMode === "member" ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-registration-member-search">
                      {t("fields.memberSearch")}
                    </Label>
                    <Input
                      id="admin-registration-member-search"
                      value={memberSearch}
                      onChange={(event) => {
                        setMemberSearch(event.target.value);
                        updateField("memberUserId", "");
                        updateField("memberDisplayName", "");
                      }}
                      placeholder={t("fields.memberSearchPlaceholder")}
                    />
                  </div>
                  {form.memberUserId.trim().length > 0 ? (
                    <div className="rounded-md bg-muted/40 p-3 text-sm">
                      <p className="font-medium">{form.memberDisplayName || form.guestLabel}</p>
                      <p className="text-muted-foreground">
                        {formatContactSummary(form.guestPhone, form.guestEmail)}
                      </p>
                    </div>
                  ) : null}
                  {memberLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : null}
                  {!memberLoading && memberResults.length > 0 ? (
                    <div className="space-y-2">
                      {memberResults.map((user) => (
                        <button
                          key={user.userId}
                          type="button"
                          className="flex w-full items-start justify-between rounded-md border px-3 py-3 text-start transition-colors hover:bg-muted/40"
                          onClick={() => selectMember(user)}
                        >
                          <span>
                            <span className="block font-medium">{user.displayName}</span>
                            <span className="block text-xs text-muted-foreground">
                              {formatContactSummary(user.phone, user.email)}
                            </span>
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t("actions.select")}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {!memberLoading &&
                  memberSearch.trim().length >= 2 &&
                  memberResults.length === 0 &&
                  form.memberUserId.trim().length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("memberSearchEmpty")}</p>
                  ) : null}
                </div>
              ) : null}

              {form.registrantMode === "guest" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="admin-registration-name">{t("fields.fullName")}</Label>
                    <Input
                      id="admin-registration-name"
                      value={form.guestLabel}
                      onChange={(event) => updateField("guestLabel", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-registration-phone">{t("fields.phone")}</Label>
                    <LocalizedNumericInput
                      id="admin-registration-phone"
                      mode="phone"
                      value={form.guestPhone}
                      onChange={(value) => updateField("guestPhone", value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-registration-email">{t("fields.email")}</Label>
                    <Input
                      id="admin-registration-email"
                      type="email"
                      value={form.guestEmail}
                      onChange={(event) => updateField("guestEmail", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-registration-party">{t("fields.partySize")}</Label>
                    <LocalizedNumericInput
                      id="admin-registration-party"
                      mode="digits"
                      value={form.partySize}
                      onChange={(value) => updateField("partySize", value)}
                    />
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="admin-registration-party">{t("fields.partySize")}</Label>
                    <LocalizedNumericInput
                      id="admin-registration-party"
                      mode="digits"
                      value={form.partySize}
                      onChange={(value) => updateField("partySize", value)}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {requirements !== null && form !== null && currentStep === "requirements" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {requirements.participantRequirements.nationalIdRequired ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-registration-national-id">{t("fields.nationalId")}</Label>
                  <LocalizedNumericInput
                    id="admin-registration-national-id"
                    mode="digits"
                    value={form.nationalId}
                    onChange={(value) => updateField("nationalId", value)}
                  />
                </div>
              ) : null}
              {requirements.participantRequirements.fatherNameRequired ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-registration-father-name">{t("fields.fatherName")}</Label>
                  <Input
                    id="admin-registration-father-name"
                    value={form.fatherName}
                    onChange={(event) => updateField("fatherName", event.target.value)}
                  />
                </div>
              ) : null}
              {requirements.participantRequirements.birthDateRequired ? (
                <div className="space-y-2">
                  <Label htmlFor="admin-registration-birth-date">{t("fields.birthDate")}</Label>
                  <Input
                    id="admin-registration-birth-date"
                    type="date"
                    dir="ltr"
                    value={form.birthDate}
                    onChange={(event) => updateField("birthDate", event.target.value)}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {requirements !== null && form !== null && currentStep === "logistics" ? (
            <div className="space-y-6">
              <div className="space-y-3">
                <p className="text-sm font-medium">{t("sections.payment")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["unpaid", "partial", "paid"] as const).map((status) => (
                    <Button
                      key={status}
                      type="button"
                      size="sm"
                      variant={form.paymentStatus === status ? "default" : "outline"}
                      onClick={() => updateField("paymentStatus", status)}
                    >
                      {t(`paymentStatus.${status}`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">{t("sections.transport")}</p>
                <div className="flex flex-wrap gap-2">
                  {transportChoices.map((choice) => (
                    <Button
                      key={choice}
                      type="button"
                      size="sm"
                      variant={form.transportKind === choice ? "default" : "outline"}
                      onClick={() => updateField("transportKind", choice)}
                    >
                      {t(`transport.${choice}`)}
                    </Button>
                  ))}
                </div>
                {form.transportKind === "personal_car" ? (
                  <div className="space-y-2">
                    <Label>{t("fields.personalCarOccupants")}</Label>
                    <div className="flex gap-2">
                      {(["1", "2", "3"] as const).map((count) => (
                        <Button
                          key={count}
                          type="button"
                          size="sm"
                          variant={form.personalCarOccupants === count ? "default" : "outline"}
                          onClick={() => updateField("personalCarOccupants", count)}
                        >
                          {t("transport.occupants", { count: Number(count) })}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  {t("transportHint", {
                    mode: t(`transportModes.${requirements.transport.mode}`),
                  })}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">{t("sections.approval")}</p>
                <div className="flex flex-wrap gap-2">
                  {[false, true].map((approve) => (
                    <Button
                      key={String(approve)}
                      type="button"
                      size="sm"
                      variant={form.approveNow === approve ? "default" : "outline"}
                      onClick={() => updateField("approveNow", approve)}
                    >
                      {approve ? t("approval.approveNow") : t("approval.pending")}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {requirements !== null && form !== null && currentStep === "review" ? (
            <div className="space-y-4 text-sm">
              <div className="rounded-lg border p-4">
                <p className="font-medium">
                  {form.registrantMode === "member"
                    ? form.memberDisplayName || form.guestLabel
                    : form.guestLabel}
                </p>
                <p className="text-muted-foreground">
                  {formatContactSummary(form.guestPhone, form.guestEmail)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t(`registrantMode.${form.registrantMode}`)}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">{t("review.partySize")}</p>
                  <p className="font-medium">
                    {new Intl.NumberFormat(locale).format(Number(form.partySize || "0"))}
                  </p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">{t("review.paymentStatus")}</p>
                  <p className="font-medium">{t(`paymentStatus.${form.paymentStatus}`)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">{t("review.transport")}</p>
                  <p className="font-medium">{t(`transport.${form.transportKind}`)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-muted-foreground">{t("review.initialStatus")}</p>
                  <p className="font-medium">
                    {form.approveNow ? t("approval.approveNow") : t("approval.pending")}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {localizedError !== null ? (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {localizedError}
            </p>
          ) : null}
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("actions.cancel")}
          </Button>
          {stepIndex > 0 ? (
            <Button type="button" variant="outline" onClick={goBack} disabled={submitting}>
              {t("actions.back")}
            </Button>
          ) : null}
          {stepIndex < visibleSteps.length - 1 ? (
            <Button
              type="button"
              onClick={goNext}
              disabled={submitting || requirements === null || form === null}
            >
              {t("actions.next")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSubmit(false)}
                disabled={submitting || requirements === null || form === null}
              >
                {t("actions.createPending")}
              </Button>
              <Button
                type="button"
                onClick={() => void handleSubmit(true)}
                disabled={
                  submitting || requirements === null || form === null || session.role === "viewer"
                }
              >
                {t("actions.createAndApprove")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
