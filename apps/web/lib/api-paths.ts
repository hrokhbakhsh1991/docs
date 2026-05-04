/**
 * Canonical Tour-Ops HTTP paths under `/api/v2`.
 * Use with `NEXT_PUBLIC_API_URL` set to origin only (no `/api/v2`).
 */

export const API = {
  auth: {
    webSession: "/api/v2/auth/web/session",
    telegramSession: "/api/v2/auth/telegram/session",
    workspaces: "/api/v2/auth/workspaces",
    workspaceSession: "/api/v2/auth/workspace/session",
  },
  tours: "/api/v2/tours",
  toursQuery: (queryString: string) =>
    queryString.trim() ? `/api/v2/tours?${queryString}` : "/api/v2/tours",
  tour: (id: string) => `/api/v2/tours/${encodeURIComponent(id)}`,
  registrations: "/api/v2/registrations",
  registration: (id: string) => `/api/v2/registrations/${encodeURIComponent(id)}`,
  registrationPayment: (id: string) => `/api/v2/registrations/${encodeURIComponent(id)}/payment`,
  registrationStatus: (id: string) => `/api/v2/registrations/${encodeURIComponent(id)}/status`,
  tourRegister: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/register`,
  tourWaitlist: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/waitlist`,
  tourRegistrations: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/registrations`,
  tourWaitlistItems: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/waitlist-items`,
  waitlistItems: "/api/v2/waitlist-items",
  waitlistItemConvert: (id: string) => `/api/v2/waitlist-items/${encodeURIComponent(id)}/convert`,
  bookings: "/api/v2/bookings",
  users: "/api/v2/users",
  user: (id: string) => `/api/v2/users/${encodeURIComponent(id)}`,
  paymentsIntent: "/api/v2/payments/intent",
} as const;

/** Paths where the session cookie must not drive automatic Bearer attachment semantics. */
export const AUTH_SESSION_PATHS: readonly string[] = [API.auth.webSession, API.auth.telegramSession];
