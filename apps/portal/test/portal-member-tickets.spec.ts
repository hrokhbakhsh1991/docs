/**
 * TKT-F1 — member portal tickets module tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  listMemberPortalEntitlementKeys,
  resolveMemberPortalModuleByRoutePath,
  resolveMemberPortalModules,
} from "@app-tour/workspace-sdk";

import {
  buildMemberTicketDetailView,
  buildMemberTicketListView,
} from "../src/me/tickets/member-tickets-bff.server";
import {
  classifyMemberTicketsBffFailure,
  localizeMemberTicketsBffError,
} from "../src/me/tickets/classify-member-tickets-bff-error";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const portalRoot = join(repoRoot, "apps/portal");

function readPortal(relativePath: string): string {
  return readFileSync(join(portalRoot, relativePath), "utf8");
}

describe("portal-member-tickets — TKT-F1", () => {
  it("TKT-F1-01 Denali registry exposes tickets primary module", () => {
    const surface = resolveMemberPortalModules("denali");
    const tickets = surface.modules.find((module) => module.id === "tickets");
    assert.ok(tickets);
    assert.equal(tickets.routePath, "/me/tickets");
    assert.equal(tickets.nav.tier, "primary");
    assert.equal(tickets.nav.labelKey, "tickets");
  });

  it("TKT-F1-02 urban minimal contract omits tickets module", () => {
    const surface = resolveMemberPortalModules("urban");
    assert.equal(surface.modules.some((module) => module.id === "tickets"), false);
  });

  it("TKT-F1-03 entitlement keys include member.module.tickets for Denali", () => {
    const keys = listMemberPortalEntitlementKeys("denali");
    assert.ok(keys.includes("member.module.tickets"));
  });

  it("TKT-F1-04 static ticket routes registered", () => {
    assert.doesNotThrow(() =>
      resolveMemberPortalModuleByRoutePath("denali", "/me/tickets"),
    );
    const listPage = readPortal("app/me/tickets/page.tsx");
    assert.match(listPage, /MemberModuleEntitlementGate/);
    assert.match(listPage, /moduleId="tickets"/);
  });

  it("TKT-F1-05 BFF list route proxies upstream without tenant from query", () => {
    const route = readPortal("app/api/me/tickets/route.ts");
    assert.match(route, /resolveMemberTicketsRouteContext/);
    assert.match(route, /fetchTicketsUpstream/);
    assert.match(route, /\/member\/tickets/);
    assert.doesNotMatch(route, /searchParams\.get\(["']tenantId["']\)/);
    assert.doesNotMatch(route, /searchParams\.get\(["']userId["']\)/);
  });

  it("TKT-F1-06 upstream fetch uses session headers only", () => {
    const upstream = readPortal("src/me/tickets/fetch-tickets-upstream.server.ts");
    assert.match(upstream, /buildMemberApiHeaders/);
    assert.doesNotMatch(upstream, /x-user-id/);
  });

  it("TKT-F1-07 list BFF maps publicMessageCount", () => {
    const list = buildMemberTicketListView(
      {
        items: [
          {
            id: "00000000-0000-4000-8000-000000000501",
            subject: "Test",
            categoryCode: "general",
            priority: "normal",
            status: "open",
            assigneeUserId: null,
            lastActivityAt: "2026-09-03T10:00:00.000Z",
            createdAt: "2026-09-03T09:00:00.000Z",
            updatedAt: "2026-09-03T10:00:00.000Z",
            publicMessageCount: 2,
          },
        ],
        nextCursor: null,
        hasMore: false,
      },
      "fa",
    );
    assert.equal(list.items[0]?.publicMessageCount, 2);
    assert.ok((list.items[0]?.lastActivityLabel ?? "").length > 0);
  });

  it("TKT-F1-08 detail view never exposes visibility field on messages", () => {
    const detail = buildMemberTicketDetailView(
      {
        ticket: {
          id: "00000000-0000-4000-8000-000000000501",
          subject: "Test",
          categoryCode: "general",
          priority: "normal",
          status: "open",
          assigneeUserId: null,
          lastActivityAt: "2026-09-03T10:00:00.000Z",
          createdAt: "2026-09-03T09:00:00.000Z",
          updatedAt: "2026-09-03T10:00:00.000Z",
        },
        messages: [
          {
            id: "00000000-0000-4000-8000-000000000502",
            ticketId: "00000000-0000-4000-8000-000000000501",
            authorUserId: "00000000-0000-4000-8000-000000000010",
            body: "hello",
            createdAt: "2026-09-03T10:00:00.000Z",
          },
        ],
        events: [],
        rowVersion: 1,
      },
      "fa",
      "00000000-0000-4000-8000-000000000010",
    );
    assert.equal(detail.messages.length, 1);
    assert.equal("visibility" in (detail.messages[0] as object), false);
    assert.equal(detail.messages[0]?.isMemberAuthor, true);
  });

  it("TKT-F1-09 Persian error mapping for TICKET_CLOSED", () => {
    assert.match(localizeMemberTicketsBffError("TICKET_CLOSED", ""), /بسته/);
    assert.equal(classifyMemberTicketsBffFailure(404, "TICKET_MODULE_DISABLED"), "module_disabled");
  });

  it("TKT-F1-10 no Denali imports in tickets module tree", () => {
    const sources = [
      readPortal("src/me/tickets/member-tickets-list-panel.tsx"),
      readPortal("src/me/tickets/member-tickets-bff.server.ts"),
      readPortal("app/api/me/tickets/route.ts"),
    ].join("\n");
    assert.doesNotMatch(sources, /@app-tour\/workspace-denali/);
    assert.doesNotMatch(sources, /pluginId\s*===\s*["']denali["']/);
  });
});
