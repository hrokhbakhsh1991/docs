"use client";

import { useMemo } from "react";

import type { FinancePaymentRow } from "@/finance/finance-payments-logic";
import {
  FINANCE_REGISTRATION_CACHE_NS,
  readFinanceRegistrationCache,
} from "@/finance/finance-registration-fetch-cache";

type FinanceRegistrationFilterChipProps = {
  readonly registrationId: string;
  readonly filteredLabel: string;
  readonly clearLabel: string;
  readonly technicalIdLabel: string;
  readonly onClear: () => void;
  readonly testId?: string;
};

/**
 * Registration filter chrome — prefer Member · Tour from already-cached strip
 * payments (no new fetch). UUID remains secondary technical context.
 */
export function FinanceRegistrationFilterChip({
  registrationId,
  filteredLabel,
  clearLabel,
  technicalIdLabel,
  onClear,
  testId = "finance-registration-filter",
}: FinanceRegistrationFilterChipProps) {
  const identity = useMemo(() => {
    const cached = readFinanceRegistrationCache<readonly FinancePaymentRow[]>(
      FINANCE_REGISTRATION_CACHE_NS.stripPayments,
      registrationId
    );
    const ctx = cached?.find((row) => row.registrationContext !== null)?.registrationContext;
    return ctx ?? null;
  }, [registrationId]);

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
      data-testid={testId}
    >
      <span className="text-muted-foreground">{filteredLabel}</span>
      {identity !== null ? (
        <span className="font-medium text-foreground" data-testid="finance-registration-filter-identity">
          {identity.memberDisplayName}
          {" · "}
          {identity.tourTitle}
        </span>
      ) : null}
      <code
        className="font-mono text-[11px] text-muted-foreground"
        title={technicalIdLabel}
        data-testid="finance-registration-filter-id"
      >
        {registrationId}
      </code>
      <button
        type="button"
        className="text-primary underline-offset-2 hover:underline"
        onClick={onClear}
      >
        {clearLabel}
      </button>
    </div>
  );
}
