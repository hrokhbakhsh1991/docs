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
  details: () => [...userKeys.all, "detail"] as const,
  detail: (tenantScope: string, id: string | number) =>
    [...userKeys.details(), { tenantScope }, String(id)] as const,
  roleHistory: (tenantScope: string, id: string | number) =>
    [...userKeys.all, "role-history", { tenantScope }, String(id)] as const,
};

export const registrationKeys = {
  all: ["registrations"] as const,
  detail: (id: string) => [...registrationKeys.all, "detail", id] as const,
  tourRegistrations: (tourId: string) => [...registrationKeys.all, "tour", tourId] as const,
  tourWaitlist: (tourId: string) => [...registrationKeys.all, "tour", tourId, "waitlist"] as const,
};
