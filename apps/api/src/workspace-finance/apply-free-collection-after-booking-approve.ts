/**
 * Phase 4 — after booking approve, mark free-collection registrations paid.
 * Dynamic import avoids boot cycles between bookings façade and finance composition.
 */
export async function applyFreeCollectionAfterBookingApprove(input: {
  readonly tenantId: string;
  readonly bookingId: string;
}): Promise<void> {
  const { resolveFinanceTenantWorkspaceRow } =
    await import("./resolve-finance-workspace-type-for-tenant");
  const { isFinanceSupportedWorkspace } = await import("./workspace-finance-bindings.generated");
  const tenantWorkspace = await resolveFinanceTenantWorkspaceRow(input.tenantId);
  if (tenantWorkspace === null) {
    return;
  }
  const workspaceType = tenantWorkspace.workspaceType.trim().toLowerCase();
  if (!isFinanceSupportedWorkspace(workspaceType)) {
    return;
  }
  const { resolveFinanceServiceForTenant } = await import("../boot/lazy-finance-service");
  const finance = await resolveFinanceServiceForTenant(input.tenantId);
  const result = await finance.applyFreeCollectionPayment({
    tenantId: input.tenantId,
    registrationId: input.bookingId,
  });
  if (result.paymentStatus !== "paid") {
    return;
  }

  // Keep the booking projection in sync with the finance result. The booking
  // repositories own the canonical approved+paid => finalized transition;
  // bypassing them leaves a free registration operational but not final.
  const { getBookingsRepository } = await import("../bookings/create-bookings-repository");
  const bookings = getBookingsRepository();
  await bookings.updatePaymentStatus({
    bookingId: input.bookingId,
    tenantId: input.tenantId,
    paymentStatus: "paid",
  });

  // The booking list intentionally does not infer WAIVED from `paid` alone.
  // Persist a dedicated collection marker so a free collection is not confused
  // with a manually-entered obligation override.
  await bookings.mergeRegistrationIntake({
    bookingId: input.bookingId,
    tenantId: input.tenantId,
    patch: { freeCollectionApplied: true },
  });
}
