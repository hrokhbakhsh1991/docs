"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { formatMemberMoney } from "@/me/format-member-money";

type CancellationEligibility = {
  readonly eligible: boolean;
  readonly mode: string;
  readonly reasonCode?: string;
  readonly request?: {
    readonly status: "pending" | "rejected";
    readonly requestedAt: string | null;
    readonly rejectedAt: string | null;
    readonly reasonNote: string | null;
  };
  readonly refund?: {
    readonly eligibleRefundMinor: string;
    readonly penaltyMinor: string;
    readonly currency: string;
    readonly hasOpenRefundRequest: boolean;
  };
};

type Props = {
  readonly registrationId: string;
  readonly registrationStatus: string;
  readonly paymentCollection?: "offline" | "free";
};

export function MemberCancellationPanel({
  registrationId,
  registrationStatus,
  paymentCollection = "offline",
}: Props) {
  const t = useTranslations("portalMember.cancellation");
  const router = useRouter();
  const [eligibility, setEligibility] = useState<CancellationEligibility | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEligibility = useCallback(async () => {
    const res = await fetch(
      `/api/me/registrations/${encodeURIComponent(registrationId)}/cancellation`,
      { cache: "no-store" }
    );
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as CancellationEligibility;
  }, [registrationId]);

  useEffect(() => {
    if (registrationStatus === "cancelled" || registrationStatus === "rejected") {
      return;
    }
    let cancelled = false;
    void loadEligibility()
      .then((data) => {
        if (!cancelled && data !== null) {
          setEligibility(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [loadEligibility, registrationStatus]);

  const onCancel = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/me/registrations/${encodeURIComponent(registrationId)}/cancellation`,
        { method: "POST" }
      );
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { code?: string };
        setError(payload.code ?? "submit_failed");
        return;
      }
      const nextEligibility = await loadEligibility();
      if (nextEligibility !== null) {
        setEligibility(nextEligibility);
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }, [loadEligibility, registrationId, router]);

  if (eligibility === null) {
    return null;
  }

  return (
    <section data-portal-member-cancel data-portal-member-cancel-eligible={eligibility.eligible}>
      {eligibility.refund !== undefined && paymentCollection !== "free" ? (
        <p data-portal-member-refund-eligible={eligibility.refund.eligibleRefundMinor}>
          {t("refundEligible", {
            amount: formatMemberMoney(
              eligibility.refund.eligibleRefundMinor,
              eligibility.refund.currency
            ),
          })}
        </p>
      ) : null}
      {eligibility.mode === "request_pending" ? (
        <p data-portal-member-cancel-pending>{t("requestPending")}</p>
      ) : eligibility.mode === "request_rejected" ? (
        <p data-portal-member-cancel-rejected>
          {eligibility.request?.reasonNote
            ? t("requestRejectedWithReason", { reason: eligibility.request.reasonNote })
            : t("requestRejected")}
        </p>
      ) : eligibility.eligible ? (
        <>
          <p data-portal-member-cancel-hint>
            {eligibility.mode === "request"
              ? paymentCollection === "free"
                ? t("freeRequestHint")
                : t("requestHint")
              : eligibility.mode === "self_cancel"
                ? t("selfCancelHint")
                : t("withdrawHint")}
          </p>
          <button
            type="button"
            data-portal-member-cancel-submit
            disabled={submitting}
            onClick={() => void onCancel()}
          >
            {eligibility.mode === "request"
              ? t("requestAction")
              : eligibility.mode === "self_cancel"
                ? t("selfCancelAction")
                : t("withdrawAction")}
          </button>
        </>
      ) : (
        <p data-portal-member-cancel-blocked data-reason={eligibility.reasonCode ?? "not_eligible"}>
          {t("blocked", { reason: eligibility.reasonCode ?? "not_eligible" })}
        </p>
      )}
      {error !== null ? (
        <p role="alert" data-portal-member-cancel-error>
          {t("error", { code: error })}
        </p>
      ) : null}
    </section>
  );
}
