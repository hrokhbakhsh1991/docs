/**
 * TKT-001 Phase 1 — ticketing-http-contracts validation tests.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertTicketingIdempotencyKeyPresent,
  categoryCodeSchema,
  isTicketingHttpErrorCode,
  memberAddMessageInputSchema,
  memberCreateTicketInputSchema,
  operatorInternalNoteInputSchema,
  operatorReplyInputSchema,
  parseMemberCreateTicketInput,
  parseMemberAddMessageInput,
  parseMemberTicketListQuery,
  parseOperatorInternalNoteInput,
  parseOperatorReplyInput,
  parseOperatorTicketListQuery,
  parseTicketAssignmentInput,
  parseTicketListLimit,
  parseTicketPriorityUpdateInput,
  parseTicketStatusUpdateInput,
  ticketAssignmentInputSchema,
  ticketPriorityUpdateInputSchema,
  ticketStatusSchema,
  ticketPrioritySchema,
  TICKETING_HTTP_ERROR_CODES,
  TICKET_BODY_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
  type MemberTicketMessageHttp,
  type OperatorTicketMessageHttp,
  type PaginatedMemberTicketListHttp,
} from "../src/index";

const VALID_UUID = "00000000-0000-4000-8000-000000000001";

function validMemberCreate(overrides: Record<string, unknown> = {}) {
  return {
    categoryCode: "billing",
    subject: "Payment issue",
    body: "I was charged twice.",
    ...overrides,
  };
}

describe("ticketing-http-contracts", () => {
  describe("member create ticket", () => {
    it("accepts valid member create input", () => {
      const parsed = parseMemberCreateTicketInput(validMemberCreate());
      assert.equal(parsed.categoryCode, "billing");
      assert.equal(parsed.subject, "Payment issue");
      assert.equal(parsed.body, "I was charged twice.");
    });

    it("accepts optional relatedTourId and relatedRegistrationId", () => {
      const parsed = parseMemberCreateTicketInput(
        validMemberCreate({
          relatedTourId: VALID_UUID,
          relatedRegistrationId: "00000000-0000-4000-8000-000000000002",
        }),
      );
      assert.equal(parsed.relatedTourId, VALID_UUID);
      assert.equal(parsed.relatedRegistrationId, "00000000-0000-4000-8000-000000000002");
    });

    it("rejects empty subject", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ subject: "   " })),
      );
    });

    it("rejects empty body", () => {
      assert.throws(() => parseMemberCreateTicketInput(validMemberCreate({ body: "" })));
      assert.throws(() => parseMemberCreateTicketInput(validMemberCreate({ body: "  " })));
    });

    it("rejects subject over max length", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(
          validMemberCreate({ subject: "x".repeat(TICKET_SUBJECT_MAX_LENGTH + 1) }),
        ),
      );
    });

    it("rejects body over max length", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(
          validMemberCreate({ body: "x".repeat(TICKET_BODY_MAX_LENGTH + 1) }),
        ),
      );
    });

    it("rejects invalid categoryCode", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ categoryCode: "Billing" })),
      );
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ categoryCode: "پرداخت" })),
      );
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ categoryCode: "a" })),
      );
      assert.equal(categoryCodeSchema.safeParse("1bad").success, false);
    });

    it("rejects member attempt to set priority", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ priority: "high" })),
      );
    });

    it("rejects member attempt to set status", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ status: "open" })),
      );
    });

    it("rejects member attempt to set assignee", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(
          validMemberCreate({ assigneeUserId: VALID_UUID }),
        ),
      );
    });

    it("rejects member attempt to set visibility", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ visibility: "internal" })),
      );
    });

    it("rejects unknown keys on member create", () => {
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ tenantId: VALID_UUID })),
      );
      assert.throws(() =>
        parseMemberCreateTicketInput(validMemberCreate({ authorRole: "member" })),
      );
    });
  });

  describe("enums", () => {
    it("accepts valid ticket status values", () => {
      assert.equal(ticketStatusSchema.parse("open"), "open");
      assert.equal(ticketStatusSchema.parse("pending_member"), "pending_member");
      assert.equal(ticketStatusSchema.parse("resolved"), "resolved");
      assert.equal(ticketStatusSchema.parse("closed"), "closed");
    });

    it("rejects invalid status", () => {
      assert.throws(() => ticketStatusSchema.parse("new"));
      assert.throws(() => ticketStatusSchema.parse("on_hold"));
    });

    it("accepts valid priority values", () => {
      assert.equal(ticketPrioritySchema.parse("low"), "low");
      assert.equal(ticketPrioritySchema.parse("urgent"), "urgent");
    });

    it("rejects invalid priority", () => {
      assert.throws(() => ticketPrioritySchema.parse("critical"));
    });
  });

  describe("member add message", () => {
    it("accepts valid body only", () => {
      const parsed = parseMemberAddMessageInput({ body: "Follow-up details." });
      assert.equal(parsed.body, "Follow-up details.");
    });

    it("rejects member attempt to set visibility", () => {
      assert.throws(() =>
        parseMemberAddMessageInput({ body: "note", visibility: "internal" }),
      );
    });

    it("rejects forbidden member fields", () => {
      assert.throws(() =>
        parseMemberAddMessageInput({
          body: "note",
          authorUserId: VALID_UUID,
          status: "open",
          tenantId: VALID_UUID,
        }),
      );
    });

    it("rejects unknown keys", () => {
      const result = memberAddMessageInputSchema.safeParse({
        body: "ok",
        idempotencyKey: "should-be-header",
      });
      assert.equal(result.success, false);
    });
  });

  describe("operator mutations", () => {
    it("accepts valid operator reply", () => {
      const parsed = parseOperatorReplyInput({ body: "We are looking into this." });
      assert.equal(parsed.body, "We are looking into this.");
      assert.throws(() =>
        parseOperatorReplyInput({ body: "ok", visibility: "public" }),
      );
    });

    it("accepts valid internal note", () => {
      const parsed = parseOperatorInternalNoteInput({ body: "Escalate to billing." });
      assert.equal(parsed.body, "Escalate to billing.");
      assert.throws(() =>
        parseOperatorInternalNoteInput({ body: "ok", visibility: "internal" }),
      );
    });

    it("accepts valid status update with rowVersion", () => {
      const parsed = parseTicketStatusUpdateInput({ status: "resolved", rowVersion: 2 });
      assert.equal(parsed.status, "resolved");
      assert.equal(parsed.rowVersion, 2);
    });

    it("rejects status update missing rowVersion", () => {
      assert.throws(() => parseTicketStatusUpdateInput({ status: "closed" }));
      assert.throws(() =>
        ticketStatusUpdateInputSchema.safeParse({ status: "closed", rowVersion: 0 }).success,
      );
    });

    it("accepts valid priority update", () => {
      const parsed = parseTicketPriorityUpdateInput({ priority: "high", rowVersion: 3 });
      assert.equal(parsed.priority, "high");
      assert.equal(parsed.rowVersion, 3);
    });

    it("accepts nullable assignment", () => {
      const unassign = parseTicketAssignmentInput({
        assigneeUserId: null,
        rowVersion: 1,
      });
      assert.equal(unassign.assigneeUserId, null);

      const assign = parseTicketAssignmentInput({
        assigneeUserId: VALID_UUID,
        rowVersion: 1,
      });
      assert.equal(assign.assigneeUserId, VALID_UUID);
    });

    it("rejects assignment missing rowVersion", () => {
      assert.throws(() =>
        parseTicketAssignmentInput({ assigneeUserId: VALID_UUID }),
      );
      assert.equal(
        ticketAssignmentInputSchema.safeParse({ assigneeUserId: null }).success,
        false,
      );
    });
  });

  describe("list query pagination", () => {
    it("parses valid member pagination defaults", () => {
      const query = parseMemberTicketListQuery(new URL("http://x/member/tickets"));
      assert.equal(query.limit, 20);
      assert.equal(query.cursor, undefined);
      assert.equal(query.status, undefined);
    });

    it("parses valid member pagination with filters", () => {
      const query = parseMemberTicketListQuery(
        new URL("http://x/member/tickets?status=open&limit=10&cursor=abc"),
      );
      assert.equal(query.limit, 10);
      assert.equal(query.cursor, "abc");
      assert.equal(query.status, "open");
    });

    it("parses valid operator pagination with full filters", () => {
      const query = parseOperatorTicketListQuery(
        new URL(
          `http://x/tickets?status=open&priority=high&categoryCode=billing&assigneeUserId=${VALID_UUID}&q=refund&limit=25&sort=lastActivityAt`,
        ),
      );
      assert.equal(query.limit, 25);
      assert.equal(query.status, "open");
      assert.equal(query.priority, "high");
      assert.equal(query.categoryCode, "billing");
      assert.equal(query.assigneeUserId, VALID_UUID);
      assert.equal(query.q, "refund");
      assert.equal(query.sort, "lastActivityAt");
    });

    it("rejects invalid limit and clamps out-of-range values", () => {
      assert.throws(() => parseTicketListLimit("abc"));
      assert.equal(parseTicketListLimit("0"), 1);
      assert.equal(parseTicketListLimit("999"), 50);
      assert.equal(parseTicketListLimit(null), 20);
    });

    it("rejects invalid operator list status and priority", () => {
      assert.throws(() =>
        parseOperatorTicketListQuery(new URL("http://x/tickets?status=invalid")),
      );
      assert.throws(() =>
        parseOperatorTicketListQuery(new URL("http://x/tickets?priority=invalid")),
      );
    });
  });

  describe("idempotency contract", () => {
    it("requires Idempotency-Key header contract", () => {
      assert.throws(() => assertTicketingIdempotencyKeyPresent(undefined));
      assert.throws(() => assertTicketingIdempotencyKeyPresent(""));
      assert.throws(() => assertTicketingIdempotencyKeyPresent("short"));
      assert.doesNotThrow(() =>
        assertTicketingIdempotencyKeyPresent("idem-key-12345678"),
      );
    });
  });

  describe("response shape and visibility separation", () => {
    it("member message type excludes visibility", () => {
      const memberMessage: MemberTicketMessageHttp = {
        id: VALID_UUID,
        ticketId: "00000000-0000-4000-8000-000000000002",
        authorUserId: "00000000-0000-4000-8000-000000000003",
        body: "Public reply",
        createdAt: "2026-01-01T00:00:00.000Z",
      };
      assert.equal(memberMessage.body, "Public reply");
      // @ts-expect-error visibility must not exist on member message
      const _visibility = memberMessage.visibility;
      assert.equal(_visibility, undefined);
    });

    it("operator message type includes visibility", () => {
      const operatorMessage: OperatorTicketMessageHttp = {
        id: VALID_UUID,
        ticketId: "00000000-0000-4000-8000-000000000002",
        authorUserId: "00000000-0000-4000-8000-000000000003",
        body: "Internal note",
        visibility: "internal",
        createdAt: "2026-01-01T00:00:00.000Z",
      };
      assert.equal(operatorMessage.visibility, "internal");
    });

    it("paginated list response shape", () => {
      const list: PaginatedMemberTicketListHttp = {
        items: [
          {
            id: VALID_UUID,
            subject: "Help",
            categoryCode: "support",
            priority: "normal",
            status: "open",
            assigneeUserId: null,
            lastActivityAt: "2026-01-01T00:00:00.000Z",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        nextCursor: "cursor-2",
        hasMore: true,
      };
      assert.equal(list.items.length, 1);
      assert.equal(list.hasMore, true);
      assert.equal(list.nextCursor, "cursor-2");
    });
  });

  describe("error contract inventory", () => {
    it("exposes stable ticketing HTTP error codes", () => {
      assert.ok(TICKETING_HTTP_ERROR_CODES.includes("TICKET_NOT_FOUND"));
      assert.ok(TICKETING_HTTP_ERROR_CODES.includes("TICKET_VERSION_CONFLICT"));
      assert.ok(TICKETING_HTTP_ERROR_CODES.includes("IDEMPOTENCY_KEY_REQUIRED"));
      assert.ok(TICKETING_HTTP_ERROR_CODES.includes("ZOD_VALIDATION_FAILED"));
      assert.equal(isTicketingHttpErrorCode("TICKET_CLOSED"), true);
      assert.equal(isTicketingHttpErrorCode("UNKNOWN"), false);
    });
  });

  describe("member create strict schema", () => {
    it("rejects initialMessage alias — body is canonical per TKT-001", () => {
      const result = memberCreateTicketInputSchema.safeParse({
        categoryCode: "billing",
        subject: "Test",
        initialMessage: "Hello",
      });
      assert.equal(result.success, false);
    });
  });
});
