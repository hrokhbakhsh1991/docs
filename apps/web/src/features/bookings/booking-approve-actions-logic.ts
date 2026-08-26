import { invalidateFinanceRegistrationCaches } from "@/finance/finance-registration-fetch-cache";

export type ApproveWithoutPaymentResult = {
  readonly registrationId: string;
};

/**
 * Approve registration then zero obligation — operator "free seat" path (case C).
 * Does not record cash; obligation override is the finance SoT for waived payable.
 */
export async function approveBookingWithoutPayment(
  bookingId: string,
  reason?: string
): Promise<ApproveWithoutPaymentResult> {
  const id = bookingId.trim();
  if (id.length < 32) {
    throw new Error("BOOKINGS_APPROVE_INVALID_ID");
  }

  const approveResponse = await fetch(`/api/bookings/${encodeURIComponent(id)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!approveResponse.ok) {
    throw new Error(`BOOKINGS_APPROVE_HTTP_${approveResponse.status}`);
  }

  const overrideResponse = await fetch(
    `/api/finance/registrations/${encodeURIComponent(id)}/obligation-override`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        obligationMinor: "0",
        ...(reason !== undefined && reason.trim().length > 0 ? { reason: reason.trim() } : {}),
      }),
    }
  );
  if (!overrideResponse.ok) {
    throw new Error(`SET_OBLIGATION_OVERRIDE_HTTP_${overrideResponse.status}`);
  }

  invalidateFinanceRegistrationCaches(id);
  return { registrationId: id };
}
