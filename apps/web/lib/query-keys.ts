export const tourKeys = {
  all: ["tours"] as const,
  lists: () => [...tourKeys.all, "list"] as const,
  /** List cache key; optional `page` / `limit` align with `GET /api/v2/tours` query when present. */
  list: (params: { search: string; page?: number; limit?: number }) =>
    [
      ...tourKeys.lists(),
      {
        search: params.search,
        ...(params.page !== undefined ? { page: params.page } : {}),
        ...(params.limit !== undefined ? { limit: params.limit } : {}),
      },
    ] as const,
  details: () => [...tourKeys.all, "detail"] as const,
  detail: (id: string | number) => [...tourKeys.details(), String(id)] as const,
  /** Large page fetch for booking tour pickers. */
  catalog: () => [...tourKeys.all, "catalog"] as const,
};

export const bookingKeys = {
  all: ["bookings"] as const,
  /** `GET /api/v2/bookings` has no query parameters in OpenAPI. */
  lists: () => [...bookingKeys.all, "list"] as const,
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
  directoryList: (tenantId: string, params: { search: string; role: string; limit: number }) =>
    [...userKeys.directoryListRoot(tenantId), "directory", params] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (tenantScope: string, id: string | number) =>
    [...userKeys.details(), { tenantId: tenantScope }, String(id)] as const,
  roleHistory: (tenantScope: string, id: string | number) =>
    [...userKeys.all, "role-history", { tenantId: tenantScope }, String(id)] as const,
};

export const registrationKeys = {
  all: ["registrations"] as const,
  detail: (id: string) => [...registrationKeys.all, "detail", id] as const,
  tourRegistrations: (tourId: string) => [...registrationKeys.all, "tour", tourId] as const,
  tourWaitlist: (tourId: string) => [...registrationKeys.all, "tour", tourId, "waitlist"] as const,
};

export const settingsLocationsKeys = {
  all: ["settings", "locations"] as const,
  regions: () => [...settingsLocationsKeys.all, "regions"] as const,
  destinations: () => [...settingsLocationsKeys.all, "destinations"] as const,
};

export const settingsEquipmentKeys = {
  all: ["settings", "equipment"] as const,
  list: () => [...settingsEquipmentKeys.all, "list"] as const,
};

export const settingsTourThemesKeys = {
  all: ["settings", "tourThemes"] as const,
  list: () => [...settingsTourThemesKeys.all, "list"] as const,
};

export const settingsGuideLanguagesKeys = {
  all: ["settings", "guideLanguages"] as const,
  list: () => [...settingsGuideLanguagesKeys.all, "list"] as const,
};

export const settingsTourPresetsKeys = {
  all: ["settings", "tourPresets"] as const,
  list: () => [...settingsTourPresetsKeys.all, "list"] as const,
};

export const auditTrailKeys = {
  all: ["auditTrail"] as const,
  list: (tenantId: string, filters: Record<string, string>) =>
    [...auditTrailKeys.all, "list", tenantId, filters] as const,
};
