import type { FinanceRegistrationPaymentPlan } from "@app-tour/finance-http-contracts";

export type StagedPaymentProjection = {
  readonly initialPaymentDueMinor: string;
  readonly amountDueNowMinor: string;
};

function parseMinorDigits(value: string): bigint {
  return BigInt(value.replace(/\D/g, "") || "0");
}

export function resolveStagedPaymentProjection(input: {
  readonly invoiceTotalMinor: string;
  readonly paidAmountMinor: string;
  readonly balanceDueMinor: string;
  readonly plan: FinanceRegistrationPaymentPlan | null;
}): StagedPaymentProjection {
  const total = parseMinorDigits(input.invoiceTotalMinor);
  const paid = parseMinorDigits(input.paidAmountMinor);
  const balance = parseMinorDigits(input.balanceDueMinor);
  const percent = input.plan?.enabled === true ? input.plan.percent : null;
  if (percent === null || percent === undefined || percent < 1 || percent > 100) {
    return { initialPaymentDueMinor: "0", amountDueNowMinor: balance.toString() };
  }
  const initial = (total * BigInt(percent)) / BigInt(100);
  const cappedInitial = initial > balance ? balance : initial;
  return {
    initialPaymentDueMinor: cappedInitial.toString(),
    amountDueNowMinor: paid > BigInt(0) ? balance.toString() : cappedInitial.toString(),
  };
}
