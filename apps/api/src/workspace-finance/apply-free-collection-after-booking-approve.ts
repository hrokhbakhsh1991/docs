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
  await finance.applyFreeCollectionPayment({
    tenantId: input.tenantId,
    registrationId: input.bookingId,
  });
}
