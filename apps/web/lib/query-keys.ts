export const tourKeys = {
  all: ["tours"] as const,
  lists: () => [...tourKeys.all, "list"] as const,
  /** Matches `GET /api/v2/tours` documented query params (`search` only). Pagination is client-side after fetch. */
  list: (params: { search: string }) => [...tourKeys.lists(), { search: params.search }] as const,
  /** Large page fetch for booking tour pickers. */
  catalog: () => [...tourKeys.all, "catalog"] as const,
  detail: (id: string | number) => ["tour", String(id)] as const,
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
  detail: (id: string | number) => [...userKeys.details(), id] as const,
};

export const registrationKeys = {
  all: ["registrations"] as const,
  detail: (id: string) => [...registrationKeys.all, "detail", id] as const,
  tourRegistrations: (tourId: string) => [...registrationKeys.all, "tour", tourId] as const,
  tourWaitlist: (tourId: string) => [...registrationKeys.all, "tour", tourId, "waitlist"] as const,
};
