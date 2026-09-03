export {
  TICKET_ATTACHMENT_SCAN_STATUSES,
  TICKET_LINK_ENTITY_TYPES,
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_MESSAGE_VISIBILITIES,
  TICKET_ACTOR_ROLES,
  TICKET_AUTHOR_ROLES,
  TICKET_TRANSITION_ACTORS,
  TICKET_EVENT_TYPES,
  DEFAULT_TICKET_PRIORITY,
  TICKET_SUBJECT_MIN_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
  TICKET_BODY_MIN_LENGTH,
  TICKET_BODY_MAX_LENGTH,
  TICKET_CATEGORY_CODE_MIN_LENGTH,
  TICKET_CATEGORY_CODE_MAX_LENGTH,
} from "./types";
export type {
  Ticket,
  TicketMessage,
  TicketAttachment,
  TicketLink,
  TicketAttachmentScanStatus,
  TicketLinkEntityType,
  TicketEvent,
  TicketEventType,
  TicketStatus,
  TicketPriority,
  TicketMessageVisibility,
  TicketActorRole,
  TicketAuthorRole,
  TicketTransitionActor,
  TicketCategoryCode,
  TicketTransition,
  TicketActorContext,
  TicketPermission,
  TicketCommandResult,
} from "./types";

export {
  TICKETING_ERROR_CODES,
  TicketLifecycleError,
  isTicketingErrorCode,
  ticketingErr,
  ticketingOk,
} from "./errors";
export type { TicketingDomainError, TicketingErrorCode, TicketingResult } from "./errors";

export {
  parseTicketPriority,
  parseTicketStatus,
  validateBody,
  validateCategoryCode,
  validateSubject,
  assertRequiredTenantId,
  assertRequiredUserId,
} from "./validation";

export {
  TICKET_STATUS_TRANSITIONS,
  applyStatusTimestamps,
  canActorTransitionStatus,
  canTransitionTicketStatus,
  getAllowedTicketTransitions,
  mapActorRoleToTransitionActors,
  resolveMemberMessageTargetStatus,
  transitionTicketStatus,
} from "./lifecycle";

export {
  assertTicketPermission,
  assertTenantContext,
  canAddInternalNote,
  canAssignTicket,
  canChangePriority,
  canChangeStatus,
  canCloseTicket,
  canCreateTicket,
  canListTicket,
  canReadTicket,
  canReopenTicket,
  canReplyToTicket,
  canManageTicketLinks,
  canCreateTicketLink,
  canUploadAttachment,
  canReadAttachment,
  canDeleteAttachment,
} from "./permissions";

export {
  assertAssigneeInTenant,
  assertInternalVisibilityAllowed,
  assertMemberCannotForgeVisibility,
  assertMemberOwnsTicket,
  assertMessageBelongsToTicket,
  assertRequiredTicketFields,
  assertTicketNotClosedForReply,
  assertTicketTenantMatch,
  assertViewerTenantMembership,
  assertWorkspaceTicketingEnabled,
  bumpTicketActivity,
  deriveTicketActivityTimestamp,
  withIncrementedRowVersion,
} from "./invariants";

export {
  MEMBER_VISIBLE_EVENT_TYPES,
  buildTicketEvent,
  filterEventsForMember,
  isMemberVisibleEvent,
} from "./events";

export {
  assertMemberSafeMessage,
  filterMessagesForMember,
  filterMessagesForViewer,
  filterAttachmentsForMember,
  filterAttachmentsForOperator,
  isPublicMessage,
} from "./visibility";
