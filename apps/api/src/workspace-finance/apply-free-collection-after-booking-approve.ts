/**
 * Phase 4 — after booking approve, mark free-collection registrations paid.
 * Dynamic import avoids boot cycles between bookings façade and finance composition.
 */
export async function applyFreeCollectionAfterBookingApprove(input: {
  readonly tenantId: string;
  readonly bookingId: string;
}): Promise<void> {
  const { resolveFinanceTenantWorkspaceRow } = await import(
    "./resolve-finance-workspace-type-for-tenant"
  );
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

  // The booking list intentionally does not infer WAIVED from `paid` alone.
  // Persist a dedicated collection marker so a free collection is not confused
  // with a manually-entered obligation override.
  const { getBookingsRepository } = await import("../bookings/create-bookings-repository");
  await getBookingsRepository().mergeRegistrationIntake({
    bookingId: input.bookingId,
    tenantId: input.tenantId,
    patch: { freeCollectionApplied: true },
  });
}
