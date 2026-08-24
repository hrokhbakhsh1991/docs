/** DP1 — operator extend payment deadline action wiring. */
export async function extendOperatorPaymentDeadline(input: {
  readonly registrationId: string;
  readonly newDueAt: string;
}): Promise<{ readonly dueAt: string; readonly holdStatus: string }> {
  const response = await fetch(
    `/api/finance/payment-holds/${encodeURIComponent(input.registrationId)}/extend`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ newDueAt: input.newDueAt }),
    }
  );
  if (!response.ok) {
    throw new Error("PAYMENT_HOLD_EXTEND_FAILED");
  }
  return (await response.json()) as { dueAt: string; holdStatus: string };
}

export const OPERATOR_EXTEND_PAYMENT_DEADLINE_MARKER = "data-operator-extend-payment-deadline";
