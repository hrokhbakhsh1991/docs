"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

type CancellationEligibility = {
  readonly eligible: boolean;
  readonly mode: string;
  readonly reasonCode?: string;
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
};

export function MemberCancellationPanel({ registrationId, registrationStatus }: Props) {
  const t = useTranslations("portalMember.cancellation");
  const router = useRouter();
  const [eligibility, setEligibility] = useState<CancellationEligibility | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (registrationStatus === "cancelled" || registrationStatus === "rejected") {
      return;
    }
    let cancelled = false;
    void fetch(`/api/me/registrations/${encodeURIComponent(registrationId)}/cancellation`, {
      cache: "no-store",
    })
      .then(async (res) => {
        if (!res.ok) {
          return null;
        }
        return (await res.json()) as CancellationEligibility;
      })
      .then((data) => {
        if (!cancelled && data !== null) {
          setEligibility(data);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [registrationId, registrationStatus]);

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
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }, [registrationId, router]);

  if (eligibility === null) {
    return null;
  }

  return (
    <section data-portal-member-cancel data-portal-member-cancel-eligible={eligibility.eligible}>
      {eligibility.refund !== undefined ? (
        <p data-portal-member-refund-eligible={eligibility.refund.eligibleRefundMinor}>
          {t("refundEligible", {
            amount: eligibility.refund.eligibleRefundMinor,
            currency: eligibility.refund.currency,
          })}
        </p>
      ) : null}
      {eligibility.eligible ? (
        <>
          <p data-portal-member-cancel-hint>
            {eligibility.mode === "request" ? t("requestHint") : t("withdrawHint")}
          </p>
          <button
            type="button"
            data-portal-member-cancel-submit
            disabled={submitting}
            onClick={() => void onCancel()}
          >
            {eligibility.mode === "request" ? t("requestAction") : t("withdrawAction")}
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
