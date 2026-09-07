import type { IncomingMessage, ServerResponse } from "node:http";

import {
  handleApproveBooking,
  handleBulkApproveBookings,
  handleApproveMemberCancellation,
  handleCancelBooking,
  handleCancelTour,
  handleCreateBooking,
  handleGetBooking,
  handleGetBookingReceiptStatus,
  handleGetBookingsSummary,
  handleGetMemberCancellation,
  handleGetRefundEligibility,
  handleListBookings,
  handlePostBookingReceipt,
  handlePostMemberCancellation,
  handleRejectBooking,
  handleWaitlistBooking,
  handleMarkBookingAttendance,
} from "./bookings/bookings.routes";
import {
  handleMemberListNotifications,
  handleMemberMarkAllNotificationsRead,
  handleMemberMarkNotificationRead,
  handleMemberUnreadNotificationCount,
} from "./notifications/member-notification.routes";
import {
  handleMemberListTicketNotifications,
  handleMemberMarkAllTicketNotificationsRead,
  handleMemberMarkTicketNotificationRead,
  handleMemberUnreadTicketNotificationCount,
  handleOperatorListTicketNotifications,
  handleOperatorMarkAllTicketNotificationsRead,
  handleOperatorMarkTicketNotificationRead,
  handleOperatorUnreadTicketNotificationCount,
} from "./workspace-ticketing/ticket-notification.routes";
import {
  handleListTicketSlaPolicies,
  handleCreateTicketSlaPolicy,
  handleGetTicketSlaPolicy,
  handlePatchTicketSlaPolicy,
} from "./workspace-ticketing/ticket-sla.routes";
import {
  handleListTicketTemplates,
  handleGetTicketTemplate,
  handleCreateTicketTemplate,
  handlePatchTicketTemplate,
  handleRollbackTicketTemplate,
  handleListTicketTemplateRevisions,
  handlePreviewTicketTemplate,
} from "./workspace-ticketing/ticket-template.routes";
import {
  handleExportTicketReport,
  handleGetTicketReportSummary,
} from "./workspace-ticketing/ticket-report.routes";
import {
  handleGetTicketSettings,
  handlePatchTicketSettings,
} from "./workspace-ticketing/ticket-settings.routes";
import { loadLazyRouteHandlers } from "./boot/lazy-route-handlers";
import { resolveLazyToursService } from "./boot/lazy-tours-service";
import { resolveWorkspaceHttpHandler } from "./boot/lazy-workspace-finance-handlers";
import type { TourStorageRepository } from "./db/tour.repository";
import { handleHealth } from "./health/health.routes";
import "./http/configure-product-http-hosts";
import "./http/configure-finance-http-host";
import "./http/configure-wallet-http-host";
import "./http/configure-ticketing-http-host";
import "./http/configure-engagement-http-host";
import {
  handleTicketingMemberAddMessage,
  handleTicketingMemberCreateTicket,
  handleTicketingMemberGetTicket,
  handleTicketingMemberListTickets,
  handleTicketingMemberReopenTicket,
  handleTicketingOperatorGetTicket,
  handleTicketingOperatorInternalNote,
  handleTicketingOperatorListTickets,
  handleTicketingOperatorPatchTicket,
  handleTicketingOperatorReopenTicket,
  handleTicketingOperatorBulkTickets,
  handleTicketingOperatorReply,
  type TicketingRouteDeps,
  type TicketingServicePort,
  handleTicketingListCategories,
  handleTicketingListTags,
  handleTicketingCreateTag,
  handleTicketingUpdateTag,
  handleTicketingListQueues,
  handleTicketingCreateQueue,
  handleTicketingUpdateQueue,
  handleTicketingListTeams,
  handleTicketingCreateTeam,
  handleTicketingUpdateTeam,
  handleTicketingAssignTicket,
  handleTicketingChangeTicketQueue,
  handleTicketingAddTicketTag,
  handleTicketingRemoveTicketTag,
  handleTicketingMemberCreateAttachmentIntent,
  handleTicketingOperatorCreateAttachmentIntent,
  handleTicketingMemberUploadAttachment,
  handleTicketingOperatorUploadAttachment,
  handleTicketingMemberCompleteAttachment,
  handleTicketingOperatorCompleteAttachment,
  handleTicketingMemberGetAttachment,
  handleTicketingOperatorGetAttachment,
  handleTicketingMemberDeleteAttachment,
  handleTicketingOperatorDeleteAttachment,
  handleTicketingMemberListLinks,
  handleTicketingOperatorListLinks,
  handleTicketingMemberCreateLink,
  handleTicketingOperatorCreateLink,
  handleTicketingOperatorDeleteLink,
} from "@app-tour/ticketing-http";
import { tryDispatchPlatformRoutes } from "./http/platform-route-registrar";
import { rejectRequestDuringShutdown } from "./http/shutdown-ingress";
import { tryDispatchWorkspaceRoutes } from "./http/workspace-route-registrar";
import {
  handleGetAuthAbilityContext,
  handleGetAuthSession,
  handlePhonePreflight,
  handleRequestOtp,
  handleVerifyOtp,
} from "./identity/auth.routes";
import { handleAcceptInvite } from "./identity/invites.routes";
import { handleGetIdentityMe, handlePatchIdentityMe } from "./identity/me.routes";
import { handleGetIdentityMeEntitlements } from "./identity/me.entitlements.routes";
import {
  handlePublicPhonePreflight,
  handlePublicRegisterComplete,
  handlePublicRequestOtp,
  handlePublicVerifyOtp,
} from "./identity/public-auth.routes";
import {
  handleCatalogCommercialPricingPreview,
  handleCatalogCommercialPricingPreviews,
} from "./catalog/commercial-pricing-preview.routes";
import {
  handleBulkPatchUserRole,
  handleBulkReactivateUsers,
  handleBulkRemoveUsers,
  handleBulkSuspendUsers,
  handleGetUserBookingSummary,
  handleGetUserRoleHistory,
  handleInviteUser,
  handleListPendingInvites,
  handleListUsers,
  handlePatchUserRewards,
  handlePatchUserRole,
  handleReactivateUser,
  handleRemoveUser,
  handleResendInvite,
  handleRevokeInvite,
  handleSuspendUser,
  handleTransferWorkspaceOwnership,
} from "./identity/users.routes";
import type { ProvisioningService } from "./internal/provisioning.service";
import { handleHttpError, sendHttpError } from "./middleware/error-interceptor";
import { resolveTraceIdFromHeaders } from "./observability/resolve-trace-id";
import { runWithTraceContext } from "./observability/trace-request-context";
import type { MapEnrichRouteDeps } from "./routes/api-v2/map-enrich.routes";
import {
  handleCreateSettingsResource,
  handleDeleteSettingsResource,
  handleGetSettingsConfig,
  handleGetSettingsExplore,
  handleGetTourPresetsAdvancedAlias,
  handleGetTourWizardTemplateAlias,
  handleListSettingsModules,
  handleListSettingsResources,
  handleMutateSettingsExplore,
  handlePatchSettingsResource,
  handlePutSettingsConfig,
  handlePutTourPresetsAdvancedAlias,
  handlePutTourWizardTemplateAlias,
} from "./settings/settings.routes";
import type { ToursRouteDeps } from "./tours/tours.routes";
import type { UrbanProductRouteDeps } from "./http/configure-product-http-hosts";
import {
  handleDeleteWorkspaceDraft,
  handleGetWorkspaceDraft,
  handleListWorkspaceDraftEvents,
  handleListWorkspaceDrafts,
  handlePatchWorkspaceDraft,
} from "./workspace-drafts/workspace-drafts.routes";
import type { FinanceService } from "./workspace-finance/finance.service";

export type AppDeps = Partial<ToursRouteDeps> &
  Partial<UrbanProductRouteDeps> &
  MapEnrichRouteDeps & {
    readonly provisioningService?: ProvisioningService;
    readonly tourStore?: TourStorageRepository;
    readonly financeService?: FinanceService;
    readonly ticketingService?: TicketingServicePort;
  };

/** Phase 10 P7-T05 — compose finance API paths without `/finance/` string literals in app.ts. */
const FINANCE_API_PATH_PREFIX = "/finance";

async function dispatchRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: AppDeps
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  const method = req.method ?? "GET";

  if (method === "GET" && url.pathname === "/health") {
    await handleHealth(req, res);
    return;
  }

  const handlers = await loadLazyRouteHandlers();

  if (method === "GET" && url.pathname === "/internal/metrics") {
    await handlers.handleInternalMetrics(req, res);
    return;
  }

  if (
    url.pathname === "/internal/finance/recon/run" ||
    url.pathname === "/internal/finance/recon/findings" ||
    url.pathname === "/internal/finance/recon/repair-matrix" ||
    url.pathname.startsWith("/internal/finance/recon/findings/")
  ) {
    const { handleInternalFinanceRecon } = await import("./routes/internal/finance-recon");
    await handleInternalFinanceRecon(req, res);
    return;
  }

  if (
    method === "POST" &&
    (url.pathname === "/internal/portal-member-entitlements/plans/upsert" ||
      url.pathname === "/internal/portal-member-entitlements/apply-plan")
  ) {
    const { handlePortalMemberEntitlementsInternal } =
      await import("./routes/internal/portal-member-entitlements");
    await handlePortalMemberEntitlementsInternal(req, res, url.pathname);
    return;
  }

  if (method === "GET" && url.pathname === "/internal/consistency/migrations") {
    const { handleMigrationConsistency } = await import("./routes/internal/migration-consistency");
    await handleMigrationConsistency(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/cache/invalidate") {
    await handlers.handleCacheInvalidate(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/v2/tenant-config") {
    await handlers.handleTenantConfig(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/api/v2/map/enrich") {
    await handlers.handleMapEnrich(req, res, deps);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/tenants/provision") {
    const { ProvisioningService } = await import("./internal/provisioning.service");
    await handlers.handleProvisionTenant(req, res, {
      provisioningService: deps.provisioningService ?? new ProvisioningService(),
    });
    return;
  }

  if (method === "GET" && url.pathname === "/internal/test/db-pool-hold") {
    await handlers.handleDbPoolHold(req, res);
    return;
  }

  if (
    (method === "POST" && url.pathname === "/internal/outbox/replay") ||
    (method === "GET" && url.pathname.startsWith("/internal/outbox/replay/runs/"))
  ) {
    const { handleInternalOutboxReplay } = await import("./routes/internal/outbox-replay");
    await handleInternalOutboxReplay(req, res);
    return;
  }

  const outboxReplayMatch = url.pathname.match(/^\/internal\/outbox\/([^/]+)\/replay$/);
  if (method === "POST" && outboxReplayMatch) {
    await handlers.handleReplayOutbox(req, res, outboxReplayMatch[1]!);
    return;
  }

  if (method === "POST" && url.pathname === "/internal/payments/webhook") {
    const { handlePaymentsWebhook } =
      await import("./integrations/webhooks/payments-webhook.controller.ts");
    await handlePaymentsWebhook(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/auth/phone-preflight") {
    await handlePhonePreflight(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/auth/request-otp") {
    await handleRequestOtp(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/auth/verify-otp") {
    await handleVerifyOtp(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/auth/accept-platform-impersonation") {
    const { handleAcceptPlatformImpersonation } =
      await import("./identity/accept-platform-impersonation.ts");
    await handleAcceptPlatformImpersonation(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/public/auth/phone-preflight") {
    await handlePublicPhonePreflight(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/public/auth/request-otp") {
    await handlePublicRequestOtp(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/public/auth/verify-otp") {
    await handlePublicVerifyOtp(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/public/auth/register/complete") {
    await handlePublicRegisterComplete(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/catalog/pricing-preview") {
    await handleCatalogCommercialPricingPreview(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/catalog/pricing-previews") {
    await handleCatalogCommercialPricingPreviews(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/auth/session") {
    await handleGetAuthSession(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/auth/ability-context") {
    await handleGetAuthAbilityContext(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/identity/me") {
    await handleGetIdentityMe(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/identity/me/entitlements") {
    await handleGetIdentityMeEntitlements(req, res);
    return;
  }

  if (method === "PATCH" && url.pathname === "/identity/me") {
    await handlePatchIdentityMe(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/identity/me/avatar") {
    const { handleUploadIdentityMeAvatar } = await import("./identity/me.avatar.routes");
    await handleUploadIdentityMeAvatar(req, res);
    return;
  }

  if (method === "DELETE" && url.pathname === "/identity/me/avatar") {
    const { handleDeleteIdentityMeAvatar } = await import("./identity/me.avatar.routes");
    await handleDeleteIdentityMeAvatar(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/identity/me/avatar/url") {
    const { handleGetIdentityMeAvatarUrl } = await import("./identity/me.avatar.routes");
    await handleGetIdentityMeAvatarUrl(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/identity/me/mobile/request-otp") {
    const { handlePostIdentityMeMobileRequestOtp } = await import("./identity/me.mobile.routes");
    await handlePostIdentityMeMobileRequestOtp(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/identity/me/mobile/verify") {
    const { handlePostIdentityMeMobileVerify } = await import("./identity/me.mobile.routes");
    await handlePostIdentityMeMobileVerify(req, res);
    return;
  }

  const inviteAcceptMatch = url.pathname.match(/^\/auth\/invite\/([^/]+)\/accept$/);
  if (inviteAcceptMatch && method === "POST") {
    await handleAcceptInvite(req, res, inviteAcceptMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/users") {
    await handleListUsers(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/users/invite") {
    await handleInviteUser(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/users/invites") {
    await handleListPendingInvites(req, res);
    return;
  }

  if (method === "PATCH" && url.pathname === "/users/bulk/role") {
    await handleBulkPatchUserRole(req, res);
    return;
  }
  if (method === "PATCH" && url.pathname === "/users/bulk/suspend") {
    await handleBulkSuspendUsers(req, res);
    return;
  }
  if (method === "PATCH" && url.pathname === "/users/bulk/reactivate") {
    await handleBulkReactivateUsers(req, res);
    return;
  }
  if (method === "POST" && url.pathname === "/users/bulk/remove") {
    await handleBulkRemoveUsers(req, res);
    return;
  }

  const usersInviteMatch = url.pathname.match(/^\/users\/invites\/([^/]+)(?:\/(resend))?$/);
  if (usersInviteMatch) {
    const inviteId = usersInviteMatch[1]!;
    const action = usersInviteMatch[2];
    if (action === "resend" && method === "POST") {
      await handleResendInvite(req, res, inviteId);
      return;
    }
    if (action === undefined && method === "DELETE") {
      await handleRevokeInvite(req, res, inviteId);
      return;
    }
  }

  const usersMemberMatch = url.pathname.match(
    /^\/users\/([^/]+)(?:\/(role|rewards|suspend|reactivate|role-history|booking-summary))?$/
  );
  if (usersMemberMatch && usersMemberMatch[1] !== "invite" && usersMemberMatch[1] !== "invites") {
    const userId = usersMemberMatch[1]!;
    const action = usersMemberMatch[2];
    if (action === "role-history" && method === "GET") {
      await handleGetUserRoleHistory(req, res, userId);
      return;
    }
    if (action === "booking-summary" && method === "GET") {
      await handleGetUserBookingSummary(req, res, userId);
      return;
    }
    if (action === "role" && method === "PATCH") {
      await handlePatchUserRole(req, res, userId);
      return;
    }
    if (action === "rewards" && method === "PATCH") {
      await handlePatchUserRewards(req, res, userId);
      return;
    }
    if (action === "suspend" && method === "PATCH") {
      await handleSuspendUser(req, res, userId);
      return;
    }
    if (action === "reactivate" && method === "PATCH") {
      await handleReactivateUser(req, res, userId);
      return;
    }
    if (action === undefined && method === "DELETE") {
      await handleRemoveUser(req, res, userId);
      return;
    }
  }

  const ownershipTransferMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/ownership-transfer$/);
  if (ownershipTransferMatch && method === "POST") {
    await handleTransferWorkspaceOwnership(req, res, ownershipTransferMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/bookings") {
    await handleListBookings(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/bookings") {
    await handleCreateBooking(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/bookings/summary") {
    await handleGetBookingsSummary(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/bookings/bulk-approve") {
    await handleBulkApproveBookings(req, res);
    return;
  }

  const bookingGetMatch = url.pathname.match(/^\/bookings\/([^/]+)$/);
  if (method === "GET" && bookingGetMatch) {
    await handleGetBooking(req, res, bookingGetMatch[1]!);
    return;
  }

  const bookingApproveMatch = url.pathname.match(/^\/bookings\/([^/]+)\/approve$/);
  if (method === "POST" && bookingApproveMatch) {
    await handleApproveBooking(req, res, bookingApproveMatch[1]!);
    return;
  }

  const bookingRejectMatch = url.pathname.match(/^\/bookings\/([^/]+)\/reject$/);
  if (method === "POST" && bookingRejectMatch) {
    await handleRejectBooking(req, res, bookingRejectMatch[1]!);
    return;
  }

  const bookingWaitlistMatch = url.pathname.match(/^\/bookings\/([^/]+)\/waitlist$/);
  if (method === "POST" && bookingWaitlistMatch) {
    await handleWaitlistBooking(req, res, bookingWaitlistMatch[1]!);
    return;
  }

  const bookingAttendanceMatch = url.pathname.match(/^\/bookings\/([^/]+)\/attendance$/);
  if (method === "POST" && bookingAttendanceMatch) {
    await handleMarkBookingAttendance(req, res, bookingAttendanceMatch[1]!);
    return;
  }

  const bookingCancelMatch = url.pathname.match(/^\/bookings\/([^/]+)\/cancel$/);
  if (method === "POST" && bookingCancelMatch) {
    await handleCancelBooking(req, res, bookingCancelMatch[1]!);
    return;
  }

  const memberCancellationMatch = url.pathname.match(
    /^\/bookings\/([^/]+)\/member-cancellation$/
  );
  if (memberCancellationMatch) {
    if (method === "GET") {
      await handleGetMemberCancellation(req, res, memberCancellationMatch[1]!);
      return;
    }
    if (method === "POST") {
      await handlePostMemberCancellation(req, res, memberCancellationMatch[1]!);
      return;
    }
  }

  const memberCancellationApproveMatch = url.pathname.match(
    /^\/bookings\/([^/]+)\/member-cancellation\/approve$/
  );
  if (method === "POST" && memberCancellationApproveMatch) {
    await handleApproveMemberCancellation(req, res, memberCancellationApproveMatch[1]!);
    return;
  }

  const refundEligibilityMatch = url.pathname.match(/^\/bookings\/([^/]+)\/refund-eligibility$/);
  if (method === "GET" && refundEligibilityMatch) {
    await handleGetRefundEligibility(req, res, refundEligibilityMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/member/notifications") {
    await handleMemberListNotifications(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/member/notifications/unread-count") {
    await handleMemberUnreadNotificationCount(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/member/notifications/mark-all-read") {
    await handleMemberMarkAllNotificationsRead(req, res);
    return;
  }

  const memberNotificationReadMatch = url.pathname.match(
    /^\/member\/notifications\/([^/]+)\/read$/,
  );
  if (method === "PATCH" && memberNotificationReadMatch) {
    await handleMemberMarkNotificationRead(req, res, memberNotificationReadMatch[1]!);
    return;
  }

  const bookingReceiptMatch = url.pathname.match(/^\/bookings\/([^/]+)\/receipts$/);
  if (method === "POST" && bookingReceiptMatch) {
    await handlePostBookingReceipt(req, res, bookingReceiptMatch[1]!);
    return;
  }
  if (method === "GET" && bookingReceiptMatch) {
    await handleGetBookingReceiptStatus(req, res, bookingReceiptMatch[1]!);
    return;
  }

  const ticketingDeps: TicketingRouteDeps = {
    ticketingService: deps.ticketingService,
  };

  if (method === "GET" && url.pathname === "/member/tickets") {
    await handleTicketingMemberListTickets(req, res, ticketingDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/member/tickets") {
    await handleTicketingMemberCreateTicket(req, res, ticketingDeps);
    return;
  }

  const memberTicketGetMatch = url.pathname.match(/^\/member\/tickets\/([^/]+)$/);
  if (method === "GET" && memberTicketGetMatch) {
    await handleTicketingMemberGetTicket(req, res, ticketingDeps, memberTicketGetMatch[1]!);
    return;
  }

  const memberTicketMessageMatch = url.pathname.match(/^\/member\/tickets\/([^/]+)\/messages$/);
  if (method === "POST" && memberTicketMessageMatch) {
    await handleTicketingMemberAddMessage(req, res, ticketingDeps, memberTicketMessageMatch[1]!);
    return;
  }

  const memberTicketReopenMatch = url.pathname.match(/^\/member\/tickets\/([^/]+)\/reopen$/);
  if (method === "POST" && memberTicketReopenMatch) {
    await handleTicketingMemberReopenTicket(req, res, ticketingDeps, memberTicketReopenMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/member/ticket-notifications") {
    await handleMemberListTicketNotifications(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/member/ticket-notifications/unread-count") {
    await handleMemberUnreadTicketNotificationCount(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/member/ticket-notifications/mark-all-read") {
    await handleMemberMarkAllTicketNotificationsRead(req, res);
    return;
  }

  const memberTicketNotificationReadMatch = url.pathname.match(
    /^\/member\/ticket-notifications\/([^/]+)\/read$/,
  );
  if (method === "PATCH" && memberTicketNotificationReadMatch) {
    await handleMemberMarkTicketNotificationRead(req, res, memberTicketNotificationReadMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/tickets") {
    await handleTicketingOperatorListTickets(req, res, ticketingDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/tickets/bulk") {
    await handleTicketingOperatorBulkTickets(req, res, ticketingDeps);
    return;
  }

  const operatorTicketGetMatch = url.pathname.match(/^\/tickets\/([^/]+)$/);
  if (method === "GET" && operatorTicketGetMatch) {
    await handleTicketingOperatorGetTicket(req, res, ticketingDeps, operatorTicketGetMatch[1]!);
    return;
  }

  if (method === "PATCH" && operatorTicketGetMatch) {
    await handleTicketingOperatorPatchTicket(req, res, ticketingDeps, operatorTicketGetMatch[1]!);
    return;
  }

  const operatorTicketReplyMatch = url.pathname.match(/^\/tickets\/([^/]+)\/replies$/);
  if (method === "POST" && operatorTicketReplyMatch) {
    await handleTicketingOperatorReply(req, res, ticketingDeps, operatorTicketReplyMatch[1]!);
    return;
  }

  const operatorTicketNoteMatch = url.pathname.match(/^\/tickets\/([^/]+)\/internal-notes$/);
  if (method === "POST" && operatorTicketNoteMatch) {
    await handleTicketingOperatorInternalNote(req, res, ticketingDeps, operatorTicketNoteMatch[1]!);
    return;
  }

  const operatorTicketReopenMatch = url.pathname.match(/^\/tickets\/([^/]+)\/reopen$/);
  if (method === "POST" && operatorTicketReopenMatch) {
    await handleTicketingOperatorReopenTicket(req, res, ticketingDeps, operatorTicketReopenMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-notifications") {
    await handleOperatorListTicketNotifications(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-notifications/unread-count") {
    await handleOperatorUnreadTicketNotificationCount(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/ticket-notifications/mark-all-read") {
    await handleOperatorMarkAllTicketNotificationsRead(req, res);
    return;
  }

  const operatorTicketNotificationReadMatch = url.pathname.match(
    /^\/ticket-notifications\/([^/]+)\/read$/,
  );
  if (method === "PATCH" && operatorTicketNotificationReadMatch) {
    await handleOperatorMarkTicketNotificationRead(req, res, operatorTicketNotificationReadMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-sla-policies") {
    await handleListTicketSlaPolicies(req, res);
    return;
  }

  const ticketSlaPolicyMatch = url.pathname.match(/^\/ticket-sla-policies\/([^/]+)$/);
  if (method === "GET" && ticketSlaPolicyMatch) {
    await handleGetTicketSlaPolicy(req, res, ticketSlaPolicyMatch[1]!);
    return;
  }
  if (method === "POST" && ticketSlaPolicyMatch) {
    await handleCreateTicketSlaPolicy(req, res, ticketSlaPolicyMatch[1]!);
    return;
  }
  if (method === "PATCH" && ticketSlaPolicyMatch) {
    await handlePatchTicketSlaPolicy(req, res, ticketSlaPolicyMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-templates") {
    await handleListTicketTemplates(req, res);
    return;
  }

  const ticketTemplateMatch = url.pathname.match(/^\/ticket-templates\/([^/]+)$/);
  if (method === "GET" && ticketTemplateMatch) {
    await handleGetTicketTemplate(req, res, ticketTemplateMatch[1]!);
    return;
  }
  if (method === "POST" && ticketTemplateMatch) {
    await handleCreateTicketTemplate(req, res, ticketTemplateMatch[1]!);
    return;
  }
  if (method === "PATCH" && ticketTemplateMatch) {
    await handlePatchTicketTemplate(req, res, ticketTemplateMatch[1]!);
    return;
  }

  const ticketTemplateRollbackMatch = url.pathname.match(/^\/ticket-templates\/([^/]+)\/rollback$/);
  if (method === "POST" && ticketTemplateRollbackMatch) {
    await handleRollbackTicketTemplate(req, res, ticketTemplateRollbackMatch[1]!);
    return;
  }

  const ticketTemplateRevisionsMatch = url.pathname.match(/^\/ticket-templates\/([^/]+)\/revisions$/);
  if (method === "GET" && ticketTemplateRevisionsMatch) {
    await handleListTicketTemplateRevisions(req, res, ticketTemplateRevisionsMatch[1]!);
    return;
  }

  const ticketTemplatePreviewMatch = url.pathname.match(/^\/ticket-templates\/([^/]+)\/preview$/);
  if (method === "POST" && ticketTemplatePreviewMatch) {
    await handlePreviewTicketTemplate(req, res, ticketTemplatePreviewMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-reports/summary") {
    await handleGetTicketReportSummary(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-reports/export") {
    await handleExportTicketReport(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-settings") {
    await handleGetTicketSettings(req, res);
    return;
  }

  if (method === "PATCH" && url.pathname === "/ticket-settings") {
    await handlePatchTicketSettings(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-categories") {
    await handleTicketingListCategories(req, res, ticketingDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-tags") {
    await handleTicketingListTags(req, res, ticketingDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/ticket-tags") {
    await handleTicketingCreateTag(req, res, ticketingDeps);
    return;
  }

  const ticketTagPatchMatch = url.pathname.match(/^\/ticket-tags\/([^/]+)$/);
  if (method === "PATCH" && ticketTagPatchMatch) {
    await handleTicketingUpdateTag(req, res, ticketingDeps, ticketTagPatchMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-queues") {
    await handleTicketingListQueues(req, res, ticketingDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/ticket-queues") {
    await handleTicketingCreateQueue(req, res, ticketingDeps);
    return;
  }

  const ticketQueuePatchMatch = url.pathname.match(/^\/ticket-queues\/([^/]+)$/);
  if (method === "PATCH" && ticketQueuePatchMatch) {
    await handleTicketingUpdateQueue(req, res, ticketingDeps, ticketQueuePatchMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/ticket-teams") {
    await handleTicketingListTeams(req, res, ticketingDeps);
    return;
  }

  if (method === "POST" && url.pathname === "/ticket-teams") {
    await handleTicketingCreateTeam(req, res, ticketingDeps);
    return;
  }

  const ticketTeamPatchMatch = url.pathname.match(/^\/ticket-teams\/([^/]+)$/);
  if (method === "PATCH" && ticketTeamPatchMatch) {
    await handleTicketingUpdateTeam(req, res, ticketingDeps, ticketTeamPatchMatch[1]!);
    return;
  }

  const ticketAssignMatch = url.pathname.match(/^\/tickets\/([^/]+)\/assign$/);
  if (method === "POST" && ticketAssignMatch) {
    await handleTicketingAssignTicket(req, res, ticketingDeps, ticketAssignMatch[1]!);
    return;
  }

  const ticketQueueChangeMatch = url.pathname.match(/^\/tickets\/([^/]+)\/queue$/);
  if (method === "POST" && ticketQueueChangeMatch) {
    await handleTicketingChangeTicketQueue(req, res, ticketingDeps, ticketQueueChangeMatch[1]!);
    return;
  }

  const ticketTagAddMatch = url.pathname.match(/^\/tickets\/([^/]+)\/tags$/);
  if (method === "POST" && ticketTagAddMatch) {
    await handleTicketingAddTicketTag(req, res, ticketingDeps, ticketTagAddMatch[1]!);
    return;
  }

  const ticketTagRemoveMatch = url.pathname.match(/^\/tickets\/([^/]+)\/tags\/([^/]+)$/);
  if (method === "DELETE" && ticketTagRemoveMatch) {
    await handleTicketingRemoveTicketTag(
      req,
      res,
      ticketingDeps,
      ticketTagRemoveMatch[1]!,
      ticketTagRemoveMatch[2]!,
    );
    return;
  }

  const memberAttachmentIntentMatch = url.pathname.match(
    /^\/member\/tickets\/([^/]+)\/attachments\/intents$/,
  );
  if (method === "POST" && memberAttachmentIntentMatch) {
    await handleTicketingMemberCreateAttachmentIntent(
      req,
      res,
      ticketingDeps,
      memberAttachmentIntentMatch[1]!,
    );
    return;
  }

  const operatorAttachmentIntentMatch = url.pathname.match(
    /^\/tickets\/([^/]+)\/attachments\/intents$/,
  );
  if (method === "POST" && operatorAttachmentIntentMatch) {
    await handleTicketingOperatorCreateAttachmentIntent(
      req,
      res,
      ticketingDeps,
      operatorAttachmentIntentMatch[1]!,
    );
    return;
  }

  const memberAttachmentUploadMatch = url.pathname.match(
    /^\/member\/tickets\/([^/]+)\/attachments\/([^/]+)\/upload$/,
  );
  if (method === "PUT" && memberAttachmentUploadMatch) {
    await handleTicketingMemberUploadAttachment(
      req,
      res,
      ticketingDeps,
      memberAttachmentUploadMatch[1]!,
      memberAttachmentUploadMatch[2]!,
    );
    return;
  }

  const operatorAttachmentUploadMatch = url.pathname.match(
    /^\/tickets\/([^/]+)\/attachments\/([^/]+)\/upload$/,
  );
  if (method === "PUT" && operatorAttachmentUploadMatch) {
    await handleTicketingOperatorUploadAttachment(
      req,
      res,
      ticketingDeps,
      operatorAttachmentUploadMatch[1]!,
      operatorAttachmentUploadMatch[2]!,
    );
    return;
  }

  const memberAttachmentCompleteMatch = url.pathname.match(
    /^\/member\/tickets\/([^/]+)\/messages\/([^/]+)\/attachments\/([^/]+)\/complete$/,
  );
  if (method === "POST" && memberAttachmentCompleteMatch) {
    await handleTicketingMemberCompleteAttachment(
      req,
      res,
      ticketingDeps,
      memberAttachmentCompleteMatch[1]!,
      memberAttachmentCompleteMatch[2]!,
      memberAttachmentCompleteMatch[3]!,
    );
    return;
  }

  const operatorAttachmentCompleteMatch = url.pathname.match(
    /^\/tickets\/([^/]+)\/messages\/([^/]+)\/attachments\/([^/]+)\/complete$/,
  );
  if (method === "POST" && operatorAttachmentCompleteMatch) {
    await handleTicketingOperatorCompleteAttachment(
      req,
      res,
      ticketingDeps,
      operatorAttachmentCompleteMatch[1]!,
      operatorAttachmentCompleteMatch[2]!,
      operatorAttachmentCompleteMatch[3]!,
    );
    return;
  }

  const memberAttachmentGetMatch = url.pathname.match(
    /^\/member\/tickets\/([^/]+)\/attachments\/([^/]+)$/,
  );
  if (method === "GET" && memberAttachmentGetMatch) {
    await handleTicketingMemberGetAttachment(
      req,
      res,
      ticketingDeps,
      memberAttachmentGetMatch[1]!,
      memberAttachmentGetMatch[2]!,
    );
    return;
  }

  const operatorAttachmentGetMatch = url.pathname.match(/^\/tickets\/([^/]+)\/attachments\/([^/]+)$/);
  if (method === "GET" && operatorAttachmentGetMatch) {
    await handleTicketingOperatorGetAttachment(
      req,
      res,
      ticketingDeps,
      operatorAttachmentGetMatch[1]!,
      operatorAttachmentGetMatch[2]!,
    );
    return;
  }

  const memberAttachmentDeleteMatch = url.pathname.match(
    /^\/member\/tickets\/([^/]+)\/attachments\/([^/]+)$/,
  );
  if (method === "DELETE" && memberAttachmentDeleteMatch) {
    await handleTicketingMemberDeleteAttachment(
      req,
      res,
      ticketingDeps,
      memberAttachmentDeleteMatch[1]!,
      memberAttachmentDeleteMatch[2]!,
    );
    return;
  }

  const operatorAttachmentDeleteMatch = url.pathname.match(
    /^\/tickets\/([^/]+)\/attachments\/([^/]+)$/,
  );
  if (method === "DELETE" && operatorAttachmentDeleteMatch) {
    await handleTicketingOperatorDeleteAttachment(
      req,
      res,
      ticketingDeps,
      operatorAttachmentDeleteMatch[1]!,
      operatorAttachmentDeleteMatch[2]!,
    );
    return;
  }

  const memberTicketLinksMatch = url.pathname.match(/^\/member\/tickets\/([^/]+)\/links$/);
  if (memberTicketLinksMatch) {
    if (method === "GET") {
      await handleTicketingMemberListLinks(req, res, ticketingDeps, memberTicketLinksMatch[1]!);
      return;
    }
    if (method === "POST") {
      await handleTicketingMemberCreateLink(req, res, ticketingDeps, memberTicketLinksMatch[1]!);
      return;
    }
  }

  const operatorTicketLinksMatch = url.pathname.match(/^\/tickets\/([^/]+)\/links$/);
  if (operatorTicketLinksMatch) {
    if (method === "GET") {
      await handleTicketingOperatorListLinks(req, res, ticketingDeps, operatorTicketLinksMatch[1]!);
      return;
    }
    if (method === "POST") {
      await handleTicketingOperatorCreateLink(req, res, ticketingDeps, operatorTicketLinksMatch[1]!);
      return;
    }
  }

  const operatorTicketLinkDeleteMatch = url.pathname.match(/^\/tickets\/([^/]+)\/links\/([^/]+)$/);
  if (method === "DELETE" && operatorTicketLinkDeleteMatch) {
    await handleTicketingOperatorDeleteLink(
      req,
      res,
      ticketingDeps,
      operatorTicketLinkDeleteMatch[1]!,
      operatorTicketLinkDeleteMatch[2]!,
    );
    return;
  }

  const toursService = await resolveLazyToursService(deps.toursService);
  const tourDeps: ToursRouteDeps = { toursService };

  if (method === "POST" && url.pathname === "/tours/wizard-photos") {
    const { handleUploadWizardPhoto } = await import("./tours/tour-wizard-photos.routes");
    await handleUploadWizardPhoto(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/tours/wizard-photos/url") {
    const { handleGetWizardPhotoUrl } = await import("./tours/tour-wizard-photos.routes");
    await handleGetWizardPhotoUrl(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/tours/clone-photo-remint") {
    const { handleClonePhotoRemint } = await import("./tours/clone-photo-remint.routes");
    await handleClonePhotoRemint(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/tours") {
    await handlers.handleCreateTour(req, res, tourDeps);
    return;
  }

  if (method === "GET" && url.pathname === "/tours") {
    await handlers.handleListTours(req, res, tourDeps);
    return;
  }

  const tourCloneMatch = url.pathname?.match(/^\/tours\/([^/]+)\/clone$/);
  if (method === "POST" && tourCloneMatch) {
    await handlers.handleCloneTour(req, res, tourDeps, tourCloneMatch[1]!);
    return;
  }

  const tourCancelMatch = url.pathname?.match(/^\/tours\/([^/]+)\/cancel$/);
  if (method === "POST" && tourCancelMatch) {
    await handleCancelTour(req, res, tourCancelMatch[1]!);
    return;
  }

  const tourOperationalRosterMatch = url.pathname?.match(/^\/tours\/([^/]+)\/operational-roster$/);
  if (method === "GET" && tourOperationalRosterMatch) {
    const { handleGetTourOperationalRoster } = await import("./roster/operational-roster.routes.ts");
    await handleGetTourOperationalRoster(req, res, tourOperationalRosterMatch[1]!);
    return;
  }

  const tourExecutionBaseMatch = url.pathname?.match(/^\/tours\/([^/]+)\/execution(?:\/(.+))?$/);
  if (tourExecutionBaseMatch) {
    const tourId = tourExecutionBaseMatch[1]!;
    const subPath = tourExecutionBaseMatch[2] ?? "";
    const routes = await import("./tour-execution/tour-execution.routes.ts");
    if (method === "GET" && subPath === "") {
      await routes.handleGetTourExecution(req, res, tourId);
      return;
    }
    if (method === "POST" && subPath === "manifest/lock") {
      await routes.handleLockTourExecutionManifest(req, res, tourId);
      return;
    }
    if (method === "GET" && subPath === "manifest/export") {
      await routes.handleGetTourExecutionManifestExport(req, res, tourId);
      return;
    }
    if (method === "PATCH" && subPath === "state") {
      await routes.handlePatchTourExecutionState(req, res, tourId);
      return;
    }
    if (method === "PUT" && subPath === "groups") {
      await routes.handlePutTourExecutionGroups(req, res, tourId);
      return;
    }
    const manifestGroupMatch = subPath.match(/^manifest\/([^/]+)\/group$/);
    if (method === "PATCH" && manifestGroupMatch) {
      await routes.handlePatchTourExecutionManifestGroup(req, res, tourId, manifestGroupMatch[1]!);
      return;
    }
    const checklistMatch = subPath.match(/^checklist\/([^/]+)$/);
    if (method === "PATCH" && checklistMatch) {
      await routes.handlePatchTourExecutionChecklistItem(req, res, tourId, checklistMatch[1]!);
      return;
    }
    if (method === "POST" && subPath === "operational-events") {
      await routes.handlePostTourExecutionOperationalEvent(req, res, tourId);
      return;
    }
    if (method === "PATCH" && subPath === "schedule") {
      await routes.handlePatchTourExecutionSchedule(req, res, tourId);
      return;
    }
    if (method === "PATCH" && subPath === "location") {
      await routes.handlePatchTourExecutionLocation(req, res, tourId);
      return;
    }
    if (method === "PATCH" && subPath === "tour-leader") {
      await routes.handlePatchTourExecutionTourLeader(req, res, tourId);
      return;
    }
  }

  const memberTourExecutionSummaryMatch = url.pathname.match(
    /^\/member\/tours\/([^/]+)\/execution-summary$/,
  );
  if (method === "GET" && memberTourExecutionSummaryMatch) {
    const { handleGetMemberTourExecutionSummary } = await import(
      "./tour-execution/tour-execution.routes.ts"
    );
    await handleGetMemberTourExecutionSummary(req, res, memberTourExecutionSummaryMatch[1]!);
    return;
  }

  const tourTransportAllocationsMatch = url.pathname?.match(
    /^\/tours\/([^/]+)\/transport-allocations$/
  );
  if (tourTransportAllocationsMatch) {
    const tourId = tourTransportAllocationsMatch[1]!;
    const { handleGetTransportAllocations, handlePutTransportAllocations } = await import(
      "./transport/transport-allocation.routes.ts"
    );
    if (method === "GET") {
      await handleGetTransportAllocations(req, res, tourId);
      return;
    }
    if (method === "PUT") {
      await handlePutTransportAllocations(req, res, tourId);
      return;
    }
  }

  const tourRosterFreezeMatch = url.pathname?.match(/^\/tours\/([^/]+)\/roster\/freeze$/);
  if (method === "POST" && tourRosterFreezeMatch) {
    const { handleFreezeTourRoster } = await import("./settlement/driver-settlement.routes.ts");
    await handleFreezeTourRoster(req, res, tourRosterFreezeMatch[1]!);
    return;
  }

  const tourDriverSettlementsMatch = url.pathname?.match(/^\/tours\/([^/]+)\/driver-settlements$/);
  if (method === "GET" && tourDriverSettlementsMatch) {
    const { handleListDriverSettlements } = await import("./settlement/driver-settlement.routes.ts");
    await handleListDriverSettlements(req, res, tourDriverSettlementsMatch[1]!);
    return;
  }

  const tourDriverSettlementActionMatch = url.pathname?.match(
    /^\/tours\/([^/]+)\/driver-settlements\/([^/]+)\/(confirm|approve-payable|correction)$/
  );
  if (tourDriverSettlementActionMatch) {
    const tourId = tourDriverSettlementActionMatch[1]!;
    const settlementId = tourDriverSettlementActionMatch[2]!;
    const action = tourDriverSettlementActionMatch[3]!;
    const routes = await import("./settlement/driver-settlement.routes.ts");
    if (method === "POST" && action === "confirm") {
      await routes.handleConfirmDriverSettlement(req, res, tourId, settlementId);
      return;
    }
    if (method === "POST" && action === "approve-payable") {
      await routes.handleApproveDriverSettlementPayable(req, res, tourId, settlementId);
      return;
    }
    if (method === "POST" && action === "correction") {
      await routes.handleCreateDriverSettlementCorrection(req, res, tourId, settlementId);
      return;
    }
  }

  const paymentHoldExtendMatch = url.pathname.match(
    new RegExp(`^${FINANCE_API_PATH_PREFIX}/payment-holds/([^/]+)/extend$`)
  );
  if (method === "POST" && paymentHoldExtendMatch) {
    const { handleExtendPaymentHold } = await import("./finance/payment-hold-http.routes.ts");
    await handleExtendPaymentHold(req, res, paymentHoldExtendMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === `${FINANCE_API_PATH_PREFIX}/driver-payables`) {
    const { handleListDriverPayables } = await import("./finance/driver-payable.routes.ts");
    await handleListDriverPayables(req, res);
    return;
  }

  const driverPayableCompleteMatch = url.pathname?.match(
    new RegExp(`^${FINANCE_API_PATH_PREFIX}/driver-payables/([^/]+)/complete$`)
  );
  if (method === "POST" && driverPayableCompleteMatch) {
    const { handleCompleteDriverPayable } = await import("./finance/driver-payable.routes.ts");
    await handleCompleteDriverPayable(req, res, driverPayableCompleteMatch[1]!);
    return;
  }

  const tourMatch = url.pathname?.match(/^\/tours\/([^/]+)$/);
  if (method === "GET" && tourMatch) {
    await handlers.handleGetTour(req, res, tourDeps, tourMatch[1]!);
    return;
  }

  if (method === "PATCH" && tourMatch) {
    await handlers.handlePatchTour(req, res, tourDeps, tourMatch[1]!);
    return;
  }

  if (method === "GET" && url.pathname === "/public/tenant-branding") {
    const { handlePublicTenantBranding } = await import("./tenant/tenant-branding.routes");
    await handlePublicTenantBranding(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/public/tenant-context") {
    const { handlePublicTenantContext } = await import("./tenant/tenant-branding.routes");
    await handlePublicTenantContext(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/settings/branding") {
    const { handleGetTenantBranding } = await import("./tenant/tenant-branding.routes");
    await handleGetTenantBranding(req, res);
    return;
  }

  if (method === "PATCH" && url.pathname === "/settings/branding") {
    const { handlePatchTenantBranding } = await import("./tenant/tenant-branding.routes");
    await handlePatchTenantBranding(req, res);
    return;
  }

  if (method === "POST" && url.pathname === "/settings/branding/logo") {
    const { handleUploadTenantBrandLogo } = await import("./tenant/tenant-branding.routes");
    await handleUploadTenantBrandLogo(req, res);
    return;
  }

  if (method === "DELETE" && url.pathname === "/settings/branding/logo") {
    const { handleDeleteTenantBrandLogo } = await import("./tenant/tenant-branding.routes");
    await handleDeleteTenantBrandLogo(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/settings/branding/logo/url") {
    const { handleGetTenantBrandLogoUrl } = await import("./tenant/tenant-branding.routes");
    await handleGetTenantBrandLogoUrl(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/settings/modules") {
    await handleListSettingsModules(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/settings/tour-wizard-template") {
    await handleGetTourWizardTemplateAlias(req, res);
    return;
  }

  if (method === "PUT" && url.pathname === "/settings/tour-wizard-template") {
    await handlePutTourWizardTemplateAlias(req, res);
    return;
  }

  if (method === "GET" && url.pathname === "/settings/tour-presets/advanced") {
    await handleGetTourPresetsAdvancedAlias(req, res);
    return;
  }

  if (method === "PUT" && url.pathname === "/settings/tour-presets/advanced") {
    await handlePutTourPresetsAdvancedAlias(req, res);
    return;
  }

  const settingsExploreMatch = url.pathname.match(/^\/settings\/explore\/([^/]+)$/);
  if (settingsExploreMatch) {
    const moduleId = settingsExploreMatch[1]!;
    if (method === "GET") {
      await handleGetSettingsExplore(req, res, moduleId);
      return;
    }
    if (method === "PUT" || method === "POST" || method === "PATCH" || method === "DELETE") {
      await handleMutateSettingsExplore(req, res);
      return;
    }
  }

  const settingsConfigMatch = url.pathname.match(/^\/settings\/config\/([^/]+)$/);
  if (settingsConfigMatch) {
    const configKey = settingsConfigMatch[1]!;
    if (method === "GET") {
      await handleGetSettingsConfig(req, res, configKey);
      return;
    }
    if (method === "PUT") {
      await handlePutSettingsConfig(req, res, configKey);
      return;
    }
  }

  const settingsResourceItemMatch = url.pathname.match(/^\/settings\/resources\/([^/]+)\/([^/]+)$/);
  if (settingsResourceItemMatch) {
    const moduleId = settingsResourceItemMatch[1]!;
    const itemId = settingsResourceItemMatch[2]!;
    if (method === "PATCH") {
      await handlePatchSettingsResource(req, res, moduleId, itemId);
      return;
    }
    if (method === "DELETE") {
      await handleDeleteSettingsResource(req, res, moduleId, itemId);
      return;
    }
  }

  const settingsResourceMatch = url.pathname.match(/^\/settings\/resources\/([^/]+)$/);
  if (settingsResourceMatch) {
    const moduleId = settingsResourceMatch[1]!;
    if (method === "GET") {
      await handleListSettingsResources(req, res, moduleId);
      return;
    }
    if (method === "POST") {
      await handleCreateSettingsResource(req, res, moduleId);
      return;
    }
  }

  const workspaceDraftListMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/drafts$/);
  if (workspaceDraftListMatch && method === "GET") {
    await handleListWorkspaceDrafts(req, res, {
      workspaceId: decodeURIComponent(workspaceDraftListMatch[1]!),
    });
    return;
  }

  const workspaceDraftEventsMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/drafts\/([^/]+)\/([^/]+)\/events$/
  );
  if (workspaceDraftEventsMatch && method === "GET") {
    await handleListWorkspaceDraftEvents(req, res, {
      workspaceId: decodeURIComponent(workspaceDraftEventsMatch[1]!),
      draftNamespace: decodeURIComponent(workspaceDraftEventsMatch[2]!),
      draftKey: decodeURIComponent(workspaceDraftEventsMatch[3]!),
    });
    return;
  }

  const workspaceDraftMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/drafts\/([^/]+)\/([^/]+)$/
  );
  if (workspaceDraftMatch) {
    const params = {
      workspaceId: decodeURIComponent(workspaceDraftMatch[1]!),
      draftNamespace: decodeURIComponent(workspaceDraftMatch[2]!),
      draftKey: decodeURIComponent(workspaceDraftMatch[3]!),
    };
    if (method === "GET") {
      await handleGetWorkspaceDraft(req, res, params);
      return;
    }
    if (method === "PATCH") {
      await handlePatchWorkspaceDraft(req, res, params);
      return;
    }
    if (method === "DELETE") {
      await handleDeleteWorkspaceDraft(req, res, params);
      return;
    }
  }

  if (
    await tryDispatchWorkspaceRoutes(method, url.pathname, req, res, resolveWorkspaceHttpHandler, {
      tourStore: deps.tourStore,
      financeService: deps.financeService,
    })
  ) {
    return;
  }

  const workspaceIntegrationsMatch = url.pathname.match(/^\/workspaces\/([^/]+)\/integrations$/);
  if (workspaceIntegrationsMatch) {
    const workspaceId = decodeURIComponent(workspaceIntegrationsMatch[1]!);
    if (method === "POST") {
      const { handleCreateWorkspaceIntegration } =
        await import("./integrations/http/integrations.routes");
      await handleCreateWorkspaceIntegration(req, res, workspaceId);
      return;
    }
    if (method === "GET") {
      const { handleListWorkspaceIntegrations } =
        await import("./integrations/http/integrations.routes");
      await handleListWorkspaceIntegrations(req, res, workspaceId);
      return;
    }
  }

  const workspaceIntegrationsMetaMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/integrations\/meta$/
  );
  if (workspaceIntegrationsMetaMatch && method === "GET") {
    const { handleGetWorkspaceIntegrationMeta } =
      await import("./integrations/http/integrations.routes");
    await handleGetWorkspaceIntegrationMeta(
      req,
      res,
      decodeURIComponent(workspaceIntegrationsMetaMatch[1]!)
    );
    return;
  }

  const workspaceExposureCatalogMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/exposure\/catalog$/
  );
  if (workspaceExposureCatalogMatch && method === "GET") {
    const { handleGetWorkspaceExposureCatalog } = await import("./exposure/exposure.routes");
    await handleGetWorkspaceExposureCatalog(
      req,
      res,
      decodeURIComponent(workspaceExposureCatalogMatch[1]!)
    );
    return;
  }

  const workspaceExposureControlPlaneMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/exposure\/control-plane$/
  );
  if (workspaceExposureControlPlaneMatch && method === "GET") {
    const { handleGetWorkspaceExposureControlPlane } = await import("./exposure/exposure.routes");
    await handleGetWorkspaceExposureControlPlane(
      req,
      res,
      decodeURIComponent(workspaceExposureControlPlaneMatch[1]!)
    );
    return;
  }

  const workspaceExposureSurfacesMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/exposure\/surfaces$/
  );
  if (workspaceExposureSurfacesMatch && method === "GET") {
    const { handleGetWorkspaceExposureSurfaces } = await import("./exposure/exposure.routes");
    await handleGetWorkspaceExposureSurfaces(
      req,
      res,
      decodeURIComponent(workspaceExposureSurfacesMatch[1]!)
    );
    return;
  }

  const workspaceSurfaceExposureIntentMatch = url.pathname.match(
    /^\/workspaces\/([^/]+)\/exposure\/surfaces\/([^/]+)$/
  );
  if (workspaceSurfaceExposureIntentMatch && method === "PATCH") {
    const { handlePatchWorkspaceSurfaceExposureIntent } =
      await import("./exposure/exposure.routes");
    await handlePatchWorkspaceSurfaceExposureIntent(
      req,
      res,
      decodeURIComponent(workspaceSurfaceExposureIntentMatch[1]!),
      decodeURIComponent(workspaceSurfaceExposureIntentMatch[2]!)
    );
    return;
  }

  if (url.pathname === "/exposure/engine-preview" && method === "GET") {
    const { handleGetExposureEnginePreview } = await import("./exposure/exposure.routes");
    await handleGetExposureEnginePreview(req, res);
    return;
  }

  if (url.pathname === "/exposure/simulate" && method === "POST") {
    const { handlePostExposureSimulation } = await import("./exposure/exposure.routes");
    await handlePostExposureSimulation(req, res);
    return;
  }

  if (url.pathname === "/exposure/diff" && method === "POST") {
    const { handlePostExposureDiff } = await import("./exposure/exposure.routes");
    await handlePostExposureDiff(req, res);
    return;
  }

  const integrationByIdMatch = url.pathname.match(/^\/integrations\/([^/]+)$/);
  if (integrationByIdMatch) {
    const integrationId = decodeURIComponent(integrationByIdMatch[1]!);
    if (method === "GET") {
      const { handleGetIntegration } = await import("./integrations/http/integrations.routes");
      await handleGetIntegration(req, res, integrationId);
      return;
    }
    if (method === "PATCH") {
      const { handlePatchIntegration } = await import("./integrations/http/integrations.routes");
      await handlePatchIntegration(req, res, integrationId);
      return;
    }
    if (method === "DELETE") {
      const { handleDeleteIntegration } = await import("./integrations/http/integrations.routes");
      await handleDeleteIntegration(req, res, integrationId);
      return;
    }
  }

  const integrationEventPolicyMatch = url.pathname.match(
    /^\/integrations\/([^/]+)\/event-policies\/([^/]+)$/
  );
  if (method === "PATCH" && integrationEventPolicyMatch) {
    const { handlePatchIntegrationEventPolicy } =
      await import("./integrations/http/integrations.routes");
    await handlePatchIntegrationEventPolicy(
      req,
      res,
      decodeURIComponent(integrationEventPolicyMatch[1]!),
      decodeURIComponent(integrationEventPolicyMatch[2]!)
    );
    return;
  }

  const integrationExposureIntentMatch = url.pathname.match(
    /^\/integrations\/([^/]+)\/exposure-intents\/([^/]+)$/
  );
  if (method === "PATCH" && integrationExposureIntentMatch) {
    const { handlePatchConnectionExposureIntent } =
      await import("./integrations/http/integrations.routes");
    await handlePatchConnectionExposureIntent(
      req,
      res,
      decodeURIComponent(integrationExposureIntentMatch[1]!),
      decodeURIComponent(integrationExposureIntentMatch[2]!)
    );
    return;
  }

  const integrationTestMatch = url.pathname.match(/^\/integrations\/([^/]+)\/test-connection$/);
  if (method === "POST" && integrationTestMatch) {
    const { handleTestIntegrationConnection } =
      await import("./integrations/http/integrations.routes");
    await handleTestIntegrationConnection(req, res, decodeURIComponent(integrationTestMatch[1]!));
    return;
  }

  const integrationEnableMatch = url.pathname.match(/^\/integrations\/([^/]+)\/enable$/);
  if (method === "POST" && integrationEnableMatch) {
    const { handleEnableIntegration } = await import("./integrations/http/integrations.routes");
    await handleEnableIntegration(req, res, decodeURIComponent(integrationEnableMatch[1]!));
    return;
  }

  const integrationDisableMatch = url.pathname.match(/^\/integrations\/([^/]+)\/disable$/);
  if (method === "POST" && integrationDisableMatch) {
    const { handleDisableIntegration } = await import("./integrations/http/integrations.routes");
    await handleDisableIntegration(req, res, decodeURIComponent(integrationDisableMatch[1]!));
    return;
  }

  if (await tryDispatchPlatformRoutes(method, url.pathname, req, res)) {
    return;
  }

  sendHttpError(res, 404, { error: "not_found", code: "NOT_FOUND" });
}

export function createRequestListener(deps: AppDeps = {}) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (rejectRequestDuringShutdown(req, res)) {
      return;
    }
    const traceId = resolveTraceIdFromHeaders(req.headers);
    await runWithTraceContext(traceId, async () => {
      try {
        await dispatchRequest(req, res, deps);
      } catch (error) {
        handleHttpError(res, error);
      }
    });
  };
}
