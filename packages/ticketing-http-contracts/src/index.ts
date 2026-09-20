/**
 * Ticketing-owned HTTP contracts — TKT-001 Phase 1.
 */
export {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_MESSAGE_VISIBILITIES,
  TICKET_LIST_SORTS,
  DEFAULT_TICKET_LIST_LIMIT,
  MAX_TICKET_LIST_LIMIT,
  TICKET_SUBJECT_MIN_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
  TICKET_BODY_MIN_LENGTH,
  TICKET_BODY_MAX_LENGTH,
  TICKET_CATEGORY_CODE_MIN_LENGTH,
  TICKET_CATEGORY_CODE_MAX_LENGTH,
  type TicketStatus,
  type TicketPriority,
  type TicketMessageVisibility,
  type TicketListSort,
} from "./ticketing-enums";

export {
  uuidSchema,
  ticketStatusSchema,
  ticketPrioritySchema,
  categoryCodeSchema,
  ticketSubjectSchema,
  ticketBodySchema,
  rowVersionSchema,
  formatZodError,
  parseWithZod,
} from "./ticketing-validation";

export {
  TICKETING_IDEMPOTENCY_HEADER,
  TICKETING_IDEMPOTENCY_CONTRACT,
  assertTicketingIdempotencyKeyPresent,
  type TicketingIdempotencyHeaderContract,
} from "./ticketing-idempotency.contract";

export {
  memberCreateTicketInputSchema,
  memberAddMessageInputSchema,
  memberReopenTicketInputSchema,
  operatorReplyInputSchema,
  operatorInternalNoteInputSchema,
  ticketStatusUpdateInputSchema,
  ticketPriorityUpdateInputSchema,
  ticketAssignmentInputSchema,
  operatorTicketPatchInputSchema,
  operatorTicketBulkInputSchema,
  parseMemberCreateTicketInput,
  parseMemberAddMessageInput,
  parseMemberReopenTicketInput,
  parseOperatorReplyInput,
  parseOperatorInternalNoteInput,
  parseTicketStatusUpdateInput,
  parseTicketPriorityUpdateInput,
  parseTicketAssignmentInput,
  parseOperatorTicketPatchInput,
  parseOperatorTicketBulkInput,
  type MemberCreateTicketInput,
  type MemberAddMessageInput,
  type MemberReopenTicketInput,
  type OperatorReplyInput,
  type OperatorInternalNoteInput,
  type TicketStatusUpdateInput,
  type TicketPriorityUpdateInput,
  type TicketAssignmentInput,
  type OperatorTicketPatchInput,
  type OperatorTicketBulkInput,
} from "./ticketing-request.schemas";

export {
  ticketTagCreateInputSchema,
  ticketTagUpdateInputSchema,
  ticketQueueCreateInputSchema,
  ticketQueueUpdateInputSchema,
  ticketTeamCreateInputSchema,
  ticketTeamUpdateInputSchema,
  ticketAssignInputSchema,
  ticketQueueChangeInputSchema,
  ticketTagMutationInputSchema,
  parseTicketTagCreateInput,
  parseTicketTagUpdateInput,
  parseTicketQueueCreateInput,
  parseTicketQueueUpdateInput,
  parseTicketTeamCreateInput,
  parseTicketTeamUpdateInput,
  parseTicketAssignInput,
  parseTicketQueueChangeInput,
  parseTicketTagMutationInput,
  type TicketTagCreateInput,
  type TicketTagUpdateInput,
  type TicketQueueCreateInput,
  type TicketQueueUpdateInput,
  type TicketTeamCreateInput,
  type TicketTeamUpdateInput,
  type TicketAssignInput,
  type TicketQueueChangeInput,
  type TicketTagMutationInput,
} from "./ticketing-operational.schemas";

export {
  parseMemberTicketListQuery,
  parseOperatorTicketListQuery,
  parseTicketListLimit,
  type MemberTicketListQuery,
  type OperatorTicketListQuery,
} from "./ticketing-query.parsers";

export type {
  TicketSummaryHttp,
  MemberTicketListItemHttp,
  OperatorTicketSummaryHttp,
  MemberTicketMessageHttp,
  OperatorTicketMessageHttp,
  TicketEventHttp,
  MemberTicketDetailHttp,
  ViewerTicketDetailHttp,
  OperatorTicketDetailHttp,
  PaginatedMemberTicketListHttp,
  PaginatedOperatorTicketListHttp,
  MemberCreateTicketHttpResponse,
  MemberAddMessageHttpResponse,
  OperatorTicketMutationHttpResponse,
  OperatorMessageHttpResponse,
  OperatorTicketBulkItemResultHttp,
  OperatorTicketBulkHttpResponse,
} from "./ticketing-response.schemas";

export {
  TICKETING_HTTP_ERROR_CODES,
  isTicketingHttpErrorCode,
  type TicketingHttpErrorCode,
  type TicketingHttpErrorResponse,
} from "./ticketing-error.schemas";

export {
  TICKET_ATTACHMENT_ALLOWED_CONTENT_TYPES,
  parseTicketAttachmentIntentInput,
  type TicketAttachmentIntentInput,
  type TicketAttachmentIntentResponse,
  type TicketAttachmentCompleteResponse,
  type TicketAttachmentDownloadResponse,
  type TicketAttachmentHttp,
} from "./ticketing-attachment.schemas";

export {
  TICKET_LINK_ENTITY_TYPES,
  parseTicketLinkCreateInput,
  type TicketLinkCreateInput,
  type TicketLinkHttp,
  type TicketLinkListHttpResponse,
} from "./ticketing-link.schemas";
