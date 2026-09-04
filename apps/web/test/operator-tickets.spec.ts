import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";

import {
  buildOperatorTicketDetailView,
  buildOperatorTicketListView,
} from "../src/features/tickets/operator-tickets-bff.server";
import {
  classifyOperatorTicketsBffFailure,
  mapOperatorTicketsMutationErrorCode,
} from "../src/features/tickets/classify-operator-tickets-bff-error";
import {
  buildOperatorTicketsApiQuery,
  parseOperatorTicketsCommandCenterQuery,
} from "../src/features/tickets/operator-tickets-command-center-logic";
import {
  canAccessTicketsInbox,
  canMutateTickets,
} from "../src/features/tickets/operator-tickets-types";

const WEB_ROOT = resolve(import.meta.dirname, "..");

function readWeb(relativePath: string): string {
  return readFileSync(resolve(WEB_ROOT, relativePath), "utf8");
}

describe("operator tickets inbox", () => {
  it("exposes /tickets route and BFF list path", () => {
    const page = readWeb("app/(app)/tickets/page.tsx");
    assert.match(page, /OperatorTicketsPageClient/);
    assert.match(page, /canAccessTicketsInbox/);
    const listRoute = readWeb("app/api/tickets/route.ts");
    assert.match(listRoute, /buildOperatorTicketListView/);
    assert.match(listRoute, /proxyTicketsApiGet/);
  });

  it("parses operator list query filters", () => {
    const query = parseOperatorTicketsCommandCenterQuery(
      new URLSearchParams(
        "status=open&priority=high&categoryCode=billing&queueCode=smoke-queue&unassigned=true&q=refund",
      ),
    );
    assert.equal(query.status, "open");
    assert.equal(query.priority, "high");
    assert.equal(query.categoryCode, "billing");
    assert.equal(query.queueCode, "smoke-queue");
    assert.equal(query.unassigned, true);
    assert.equal(query.search, "refund");
    const api = buildOperatorTicketsApiQuery(query);
    assert.match(api, /status=open/);
    assert.match(api, /priority=high/);
    assert.match(api, /q=refund/);
  });

  it("projects list/detail without raw upstream passthrough", () => {
    const list = buildOperatorTicketListView(
      {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000501",
            subject: "Billing question",
            requesterUserId: "00000000-0000-4000-8000-000000000103",
            categoryCode: "billing",
            priority: "high",
            status: "open",
            assigneeUserId: null,
            lastActivityAt: "2026-01-01T12:00:00.000Z",
            createdAt: "2026-01-01T11:00:00.000Z",
            updatedAt: "2026-01-01T12:00:00.000Z",
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
      "fa",
    );
    assert.equal(list.items.length, 1);
    assert.match(list.items[0]!.lastActivityLabel, /۱۴|2026/);
    assert.equal(list.items[0]!.statusLabelKey, "statuses.open");

    const detail = buildOperatorTicketDetailView(
      {
        ticket: {
          id: "00000000-0000-4000-8000-000000000501",
          subject: "Billing question",
          requesterUserId: "00000000-0000-4000-8000-000000000103",
          categoryCode: "billing",
          priority: "high",
          status: "open",
          assigneeUserId: null,
          lastActivityAt: "2026-01-01T12:00:00.000Z",
          createdAt: "2026-01-01T11:00:00.000Z",
          updatedAt: "2026-01-01T12:00:00.000Z",
        },
        messages: [
          {
            id: "00000000-0000-4000-8000-000000000601",
            ticketId: "00000000-0000-4000-8000-000000000501",
            authorUserId: "00000000-0000-4000-8000-000000000102",
            body: "internal only",
            visibility: "internal",
            createdAt: "2026-01-01T12:01:00.000Z",
          },
        ],
        events: [],
        rowVersion: 3,
      },
      "en",
    );
    assert.equal(detail.ticket.hasInternalNotes, true);
    assert.equal(detail.messages[0]!.visibility, "internal");
  });

  it("maps permission and error codes", () => {
    assert.equal(canMutateTickets("viewer"), false);
    assert.equal(canMutateTickets("admin"), true);
    assert.equal(canAccessTicketsInbox("member"), false);
    assert.equal(canAccessTicketsInbox("viewer"), true);
    assert.equal(classifyOperatorTicketsBffFailure(403, "TICKET_ACCESS_DENIED"), "forbidden");
    assert.equal(mapOperatorTicketsMutationErrorCode("ROW_VERSION_CONFLICT"), "versionConflict");
  });
});
