/**
 * Binds authenticated tenantId to the BookingRuntime.workspaceType (Phase B2.0).
 * Application service calls this before any tenant-scoped work.
 */
export type BookingTenantWorkspaceBindingPort = {
  /**
   * Ensures `tenantId` owns `runtimeWorkspaceType`.
   * @throws BookingWorkspaceTenantMismatchError when owned type differs
   * @throws BookingWorkspaceUnsupportedError when tenant/workspace unsupported
   */
  assertTenantBoundToRuntime(
    tenantId: string,
    runtimeWorkspaceType: string
  ): Promise<void>;
};
