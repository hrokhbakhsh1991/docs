/** Deprecated listByTenant cap — delegates to listByTenantPage (not full tenant scan). */
export const MAX_BOOKINGS_LIST_BY_TENANT_DEPRECATED = 500;

/** Upper bound when listBySubmittedUser is called directly (non-summary paths). */
export const MAX_MEMBER_BOOKINGS_LIST_CAP = 500;

/** Recent trips in operator member booking summary UI. */
export const MAX_MEMBER_BOOKINGS_RECENT_TRIPS = 10;

export const CANCELLED_BOOKING_STATUSES = ["cancelled", "rejected"] as const;
