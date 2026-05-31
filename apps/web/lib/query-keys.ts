export const tourKeys = {
  all: ["tours"] as const,
  lists: () => [...tourKeys.all, "list"] as const,
  /** Prefix for all list caches in a workspace (invalidation). */
  listRoot: (tenantId: string) => [...tourKeys.lists(), tenantId] as const,
  /** @deprecated Prefer {@link tourKeys.listRoot}. */
  listByWorkspace: (workspaceId: string) => tourKeys.listRoot(workspaceId),
  /** List cache key; optional `page` / `limit` align with `GET /api/v2/tours` query when present. */
  list: (
    tenantId: string,
    params: { search: string; page?: number; limit?: number }
  ) =>
    [
      ...tourKeys.listRoot(tenantId),
      {
        search: params.search,
        ...(params.page !== undefined ? { page: params.page } : {}),
        ...(params.limit !== undefined ? { limit: params.limit } : {}),
      },
    ] as const,
  details: () => [...tourKeys.all, "detail"] as const,
  detailRoot: (tenantId: string) => [...tourKeys.details(), tenantId] as const,
  detail: (tenantId: string, id: string | number) =>
    [...tourKeys.detailRoot(tenantId), String(id)] as const,
  /** Large page fetch for booking tour pickers. */
  catalog: (tenantId: string) => [...tourKeys.all, "catalog", tenantId] as const,
};

export const workspaceTourCrewMembersKeys = {
  all: ["workspace-tour-crew-members"] as const,
  detail: (tenantId: string) => [...workspaceTourCrewMembersKeys.all, tenantId] as const,
};

export const financeReportsSummaryKeys = {
  all: ["finance", "reports", "summary"] as const,
  detail: (tenantId: string) => [...financeReportsSummaryKeys.all, tenantId] as const,
};

export const bookingKeys = {
  all: ["bookings"] as const,
  /** Prefix for all booking list caches in a workspace (invalidation). */
  listRoot: (tenantId: string) => [...bookingKeys.all, tenantId] as const,
  /** `GET /api/v2/bookings` has no query parameters in OpenAPI. */
  list: (tenantId: string) => [...bookingKeys.listRoot(tenantId), "list"] as const,
  /** @deprecated Prefer {@link bookingKeys.list}. */
  lists: (tenantId: string) => bookingKeys.list(tenantId),
};

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  /**
   * Prefix for all user-directory list caches in a workspace. Use for invalidation so other
   * tenants' React Query caches are untouched (no cross-tenant invalidation).
   */
  directoryListRoot: (tenantId: string) => [...userKeys.all, "list", tenantId] as const,
  /**
   * Workspace user directory infinite list (`GET /api/v2/users`). `tenantId` must match JWT tenant.
   */
  directoryList: (
    tenantId: string,
    params: { search: string; role: string; limit: number; status?: string }
  ) => [...userKeys.directoryListRoot(tenantId), "directory", params] as const,
  pendingInvites: (tenantId: string) => [...userKeys.all, "pending-invites", tenantId] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (tenantScope: string, id: string | number) =>
    [...userKeys.details(), { tenantId: tenantScope }, String(id)] as const,
  roleHistory: (tenantScope: string, id: string | number) =>
    [...userKeys.all, "role-history", { tenantId: tenantScope }, String(id)] as const,
};

export const leaderDashboardSummaryKeys = {
  all: ["leader", "dashboard-summary"] as const,
  detail: (tenantId: string) => [...leaderDashboardSummaryKeys.all, tenantId] as const,
};

/** @deprecated Use {@link leaderDashboardSummaryKeys.detail} */
export const leaderDashboardSummaryKey = leaderDashboardSummaryKeys.all;

export const leaderRegistrationIndexKeys = {
  all: ["leader", "registration-index"] as const,
  listRoot: (tenantId: string) => [...leaderRegistrationIndexKeys.all, tenantId] as const,
  list: (tenantId: string) => [...leaderRegistrationIndexKeys.listRoot(tenantId), "list"] as const,
};

export const registrationKeys = {
  all: ["registrations"] as const,
  tenantRoot: (tenantId: string) => [...registrationKeys.all, tenantId] as const,
  detail: (tenantId: string, id: string) =>
    [...registrationKeys.tenantRoot(tenantId), "detail", id] as const,
  tourRegistrations: (tenantId: string, tourId: string) =>
    [...registrationKeys.tenantRoot(tenantId), "tour", tourId] as const,
  tourWaitlist: (tenantId: string, tourId: string) =>
    [...registrationKeys.tenantRoot(tenantId), "tour", tourId, "waitlist"] as const,
};

export const settingsLocationsKeys = {
  all: ["settings", "locations"] as const,
  regions: (tenantId: string) => [...settingsLocationsKeys.all, "regions", tenantId] as const,
  destinations: (tenantId: string) =>
    [...settingsLocationsKeys.all, "destinations", tenantId] as const,
};

export const settingsEquipmentKeys = {
  all: ["settings", "equipment"] as const,
  list: (tenantId: string) => [...settingsEquipmentKeys.all, "list", tenantId] as const,
};

export const settingsTourThemesKeys = {
  all: ["settings", "tourThemes"] as const,
  list: (tenantId: string) => [...settingsTourThemesKeys.all, "list", tenantId] as const,
};

export const settingsGuideLanguagesKeys = {
  all: ["settings", "guideLanguages"] as const,
  list: (tenantId: string) => [...settingsGuideLanguagesKeys.all, "list", tenantId] as const,
};

export const settingsTourPresetsKeys = {
  all: ["settings", "tourPresets"] as const,
  list: (tenantId: string) => [...settingsTourPresetsKeys.all, "list", tenantId] as const,
};

export const settingsTourWizardTemplateKeys = {
  all: ["settings", "tourWizardTemplate"] as const,
  detail: (tenantId: string) => [...settingsTourWizardTemplateKeys.all, tenantId] as const,
};

export const auditTrailKeys = {
  all: ["auditTrail"] as const,
  list: (tenantId: string, filters: Record<string, string>) =>
    [...auditTrailKeys.all, "list", tenantId, filters] as const,
  draftConflicts: (tenantId: string, filters: { from: string; to: string; limit: number }) =>
    [...auditTrailKeys.all, "draft-conflicts", tenantId, filters] as const,
};

export const reconciliationTriageKeys = {
  all: ["reconciliationTriage"] as const,
  list: (tenantId: string, filters: { status: string }) =>
    [...reconciliationTriageKeys.all, "list", tenantId, filters] as const,
};

export const tenantConfigKeys = {
  all: ["tenantConfig"] as const,
  detail: (tenantId: string) => [...tenantConfigKeys.all, tenantId] as const,
};

export const financeLedgerEventsKeys = {
  all: ["finance", "reports", "ledger-events"] as const,
  list: (tenantId: string) => [...financeLedgerEventsKeys.all, tenantId] as const,
};
