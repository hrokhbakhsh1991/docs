/**
 * Canonical Tour-Ops HTTP paths under `/api/v2`.
 * Base URL comes from `resolveTourOpsApiBaseUrl()` (dynamic workspace host + API port).
 */

export const API = {
  auth: {
    webSession: "/api/v2/auth/web/session/otp",
    telegramSession: "/api/v2/auth/telegram/session",
    workspaces: "/api/v2/auth/workspaces",
    workspaceSession: "/api/v2/auth/workspace/session",
  },
  dashboardLeaderWorkspace: "/api/v2/dashboard/leader-workspace",
  dashboardLeaderSummary: "/api/v2/dashboard/leader-summary",
  dashboardLeaderRegistrationRows: "/api/v2/dashboard/leader-registration-rows",
  tours: "/api/v2/tours",
  toursQuery: (queryString: string) =>
    queryString.trim() ? `/api/v2/tours?${queryString}` : "/api/v2/tours",
  tour: (id: string) => `/api/v2/tours/${encodeURIComponent(id)}`,
  registrations: "/api/v2/registrations",
  registration: (id: string) => `/api/v2/registrations/${encodeURIComponent(id)}`,
  registrationPayment: (id: string) => `/api/v2/registrations/${encodeURIComponent(id)}/payment`,
  registrationStatus: (id: string) => `/api/v2/registrations/${encodeURIComponent(id)}/status`,
  tourRegister: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/register`,
  tourRegistrationIdempotencyKey: (tourId: string) =>
    `/api/v2/tours/${encodeURIComponent(tourId)}/registration-idempotency-key`,
  tourWaitlist: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/waitlist`,
  tourRegistrations: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/registrations`,
  tourWaitlistItems: (tourId: string) => `/api/v2/tours/${encodeURIComponent(tourId)}/waitlist-items`,
  waitlistItems: "/api/v2/waitlist-items",
  waitlistItemConvert: (id: string) => `/api/v2/waitlist-items/${encodeURIComponent(id)}/convert`,
  bookings: "/api/v2/bookings",
  users: "/api/v2/users",
  usersBulkRole: "/api/v2/users/bulk-role",
  user: (id: string) => `/api/v2/users/${encodeURIComponent(id)}`,
  userRoleHistory: (id: string) => `/api/v2/users/${encodeURIComponent(id)}/role-history`,
  paymentsIntent: "/api/v2/payments/intent",
  financePayments: "/api/v2/finance/payments",
  financePaymentsManual: "/api/v2/finance/payments/manual",
  financePaymentReceipt: (paymentId: string) =>
    `/api/v2/finance/payments/${encodeURIComponent(paymentId)}/receipt`,
  adminFinanceReceiptApprove: (receiptId: string) =>
    `/api/v2/admin/finance/receipts/${encodeURIComponent(receiptId)}/approve`,
  adminFinanceReceiptReject: (receiptId: string) =>
    `/api/v2/admin/finance/receipts/${encodeURIComponent(receiptId)}/reject`,
  adminFinanceReceiptUrl: (receiptId: string) =>
    `/api/v2/admin/finance/receipts/${encodeURIComponent(receiptId)}/url`,
  adminFinanceReceiptsPending: "/api/v2/admin/finance/receipts",
  financeReportsSummary: "/api/v2/finance/reports/summary",
  financeReportsOpenPayments: "/api/v2/finance/reports/open-payments",
  financeReportsLedgerEvents: "/api/v2/finance/reports/ledger-events",
  workspaceAuditEvents: (tenantId: string) =>
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/audit-events`,
  workspaceAuditEventsExport: (tenantId: string) =>
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/audit-events/export`,
  workspaceReconciliationFindings: (tenantId: string) =>
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/reconciliation-findings`,
  workspaceUserCapabilities: (tenantId: string, userId: string) =>
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/capabilities`,
  workspaceUserRole: (userId: string) =>
    `/api/v2/workspaces/users/${encodeURIComponent(userId)}/role`,
  workspaceUserRewards: (userId: string) =>
    `/api/v2/workspaces/users/${encodeURIComponent(userId)}/rewards`,
  workspaceUserSelectableLeader: (userId: string) =>
    `/api/v2/workspaces/users/${encodeURIComponent(userId)}/selectable-leader`,
  workspaceUserBookingSummary: (userId: string) =>
    `/api/v2/workspaces/users/${encodeURIComponent(userId)}/booking-summary`,
  workspaceSettingsModules: (tenantId: string) =>
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/settings/modules`,
  settingsRegions: "/api/v2/settings/regions",
} as const;

/** Same-origin Next.js BFF handlers under `app/api/*` (cookie session, Host from browser). */
export const BFF = {
  authLoginWebSession: "/api/auth/login-web-session",
  authWorkspaces: "/api/auth/workspaces",
  authWorkspaceSession: "/api/auth/workspace-session",
  authMembershipAbilityContext: "/api/auth/membership-ability-context",
  tours: "/api/tours",
  toursQuery: (queryString: string) =>
    queryString.trim() ? `/api/tours?${queryString}` : "/api/tours",
  tour: (id: string) => `/api/tours/${encodeURIComponent(id)}`,
  tourPhotos: (tourId: string) => `/api/tours/${encodeURIComponent(tourId)}/photos`,
  me: "/api/me",
  users: "/api/users",
  usersQuery: (queryString: string) =>
    queryString.trim() ? `/api/users?${queryString}` : "/api/users",
  user: (id: string) => `/api/users/${encodeURIComponent(id)}`,
  usersInvite: "/api/users/invite",
  usersInvites: "/api/users/invites",
  userInvite: (inviteId: string) => `/api/users/invites/${encodeURIComponent(inviteId)}`,
  userInviteResend: (inviteId: string) =>
    `/api/users/invites/${encodeURIComponent(inviteId)}/resend`,
  usersBulkRole: "/api/users/bulk-role",
  userAction: (userId: string, action: string) =>
    `/api/users/${encodeURIComponent(userId)}/${encodeURIComponent(action)}`,
  workspaceUserCapabilities: (tenantId: string, userId: string) =>
    `/api/workspaces/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/capabilities`,
  workspaceUserRole: (userId: string) =>
    `/api/workspaces/users/${encodeURIComponent(userId)}/role`,
  workspaceUserRewards: (userId: string) =>
    `/api/workspaces/users/${encodeURIComponent(userId)}/rewards`,
  workspaceUserSelectableLeader: (userId: string) =>
    `/api/workspaces/users/${encodeURIComponent(userId)}/selectable-leader`,
  workspaceUserBookingSummary: (userId: string) =>
    `/api/workspaces/users/${encodeURIComponent(userId)}/booking-summary`,
  bookings: "/api/bookings",
  registrations: "/api/registrations",
  registration: (id: string) => `/api/registrations/${encodeURIComponent(id)}`,
  registrationStatus: (id: string) => `/api/registrations/${encodeURIComponent(id)}/status`,
  registrationPayment: (id: string) => `/api/registrations/${encodeURIComponent(id)}/payment`,
  tourRegister: (tourId: string) => `/api/tours/${encodeURIComponent(tourId)}/register`,
  tourWaitlist: (tourId: string) => `/api/tours/${encodeURIComponent(tourId)}/waitlist`,
  tourRegistrations: (tourId: string) => `/api/tours/${encodeURIComponent(tourId)}/registrations`,
  tourWaitlistItems: (tourId: string) => `/api/tours/${encodeURIComponent(tourId)}/waitlist-items`,
  waitlistItems: "/api/waitlist-items",
  waitlistItemConvert: (id: string) => `/api/waitlist-items/${encodeURIComponent(id)}/convert`,
  paymentsIntent: "/api/payments/intent",
  financePayments: "/api/finance/payments",
  financePaymentsManual: "/api/finance/payments/manual",
  financePaymentReceipt: (paymentId: string) =>
    `/api/finance/payments/${encodeURIComponent(paymentId)}/receipt`,
  adminFinanceReceiptApprove: (receiptId: string) =>
    `/api/admin/finance/receipts/${encodeURIComponent(receiptId)}/approve`,
  adminFinanceReceiptReject: (receiptId: string) =>
    `/api/admin/finance/receipts/${encodeURIComponent(receiptId)}/reject`,
  adminFinanceReceiptUrl: (receiptId: string) =>
    `/api/admin/finance/receipts/${encodeURIComponent(receiptId)}/url`,
  adminFinanceReceiptsPending: "/api/admin/finance/receipts",
  financeReportsSummary: "/api/finance/reports/summary",
  financeReportsOpenPayments: "/api/finance/reports/open-payments",
  financeReportsLedgerEvents: "/api/finance/reports/ledger-events",
  dashboardLeaderWorkspace: "/api/dashboard/leader-workspace",
  dashboardLeaderSummary: "/api/dashboard/leader-summary",
  dashboardLeaderRegistrationRows: "/api/dashboard/leader-registration-rows",
  workspaceAuditEvents: (tenantId: string) =>
    `/api/workspaces/${encodeURIComponent(tenantId)}/audit-events`,
  workspaceAuditEventsExport: (tenantId: string) =>
    `/api/workspaces/${encodeURIComponent(tenantId)}/audit-events/export`,
  workspaceReconciliationFindings: (tenantId: string) =>
    `/api/workspaces/${encodeURIComponent(tenantId)}/reconciliation-findings`,
  reconciliationFindingAction: (tenantId: string, findingId: string, action: string) =>
    `/api/workspaces/${encodeURIComponent(tenantId)}/reconciliation-findings/${encodeURIComponent(findingId)}/${encodeURIComponent(action)}`,
  settingsRegions: "/api/settings/regions",
} as const;

/** Paths where the session cookie must not drive automatic Bearer attachment semantics. */
export const AUTH_SESSION_PATHS: readonly string[] = [API.auth.webSession, API.auth.telegramSession];
