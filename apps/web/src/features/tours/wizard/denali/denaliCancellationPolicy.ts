import type { DenaliCanonicalTourModel } from "@repo/types/denali";

function trimToUndefined(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t === "" ? undefined : t;
}

/** Merges free-text policy with structured cancellation metrics for API `cancellationPolicy`. */
export function buildDenaliCancellationPolicyText(
  policies: DenaliCanonicalTourModel["policies"],
): string | undefined {
  const base = trimToUndefined(policies.policiesText);
  const hours = policies.cancellationDeadlineHours;
  const pct = policies.cancellationPenaltyPercentage;
  const structured =
    hours != null &&
    Number.isFinite(hours) &&
    hours > 0 &&
    pct != null &&
    Number.isFinite(pct) &&
    pct >= 0
      ? `Cancellation: ${hours} hours before departure — ${pct}% penalty`
      : undefined;

  if (base && structured) return `${base}\n\n${structured}`;
  return base ?? structured;
}
