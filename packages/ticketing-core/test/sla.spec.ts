import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addBusinessMinutes,
  DEFAULT_BUSINESS_HOURS,
  isSlaDue,
  isSlaWarningDue,
  recalculateTicketSlaState,
  resolveSlaPolicyMatch,
} from "../src/domain/sla";

describe("ticketing-core sla", () => {
  const policy = {
    id: "policy-1",
    code: "default",
    workspaceType: "denali",
    categoryCode: null,
    priority: null,
    queueId: null,
    firstResponseMinutes: 60,
    nextResponseMinutes: 30,
    resolutionMinutes: 240,
    businessHours: {
      ...DEFAULT_BUSINESS_HOURS,
      weekly: {
        ...DEFAULT_BUSINESS_HOURS.weekly,
        mon: [{ start: "09:00", end: "17:00" }],
        tue: [],
        wed: [],
        thu: [],
        fri: [],
        sat: [],
        sun: [],
      },
    },
    escalationSteps: [],
    warningThresholdPercent: 80,
    enabled: true,
  };

  it("addBusinessMinutes stays within configured windows", () => {
    const due = addBusinessMinutes("2026-09-07T05:30:00.000Z", 60, policy.businessHours);
    assert.ok(Date.parse(due) > Date.parse("2026-09-07T05:30:00.000Z"));
  });

  it("resolveSlaPolicyMatch prefers specific queue policy", () => {
    const generic = { ...policy, id: "g", code: "generic", queueId: null };
    const queuePolicy = { ...policy, id: "q", code: "queue", queueId: "queue-1" };
    const matched = resolveSlaPolicyMatch([generic, queuePolicy], {
      workspaceType: "denali",
      categoryCode: "general",
      priority: "normal",
      queueId: "queue-1",
    });
    assert.equal(matched?.id, "q");
  });

  it("recalculateTicketSlaState is idempotent for same inputs", () => {
    const input = {
      policy,
      ticketCreatedAt: "2026-09-07T05:30:00.000Z",
      ticketStatus: "open",
      firstRespondedAt: null,
      lastMemberMessageAt: null,
      pausedAt: null,
      pausedMs: 0,
      nowIso: "2026-09-07T06:00:00.000Z",
    };
    const a = recalculateTicketSlaState(input);
    const b = recalculateTicketSlaState(input);
    assert.equal(a.firstResponseDueAt, b.firstResponseDueAt);
    assert.equal(a.resolutionDueAt, b.resolutionDueAt);
  });

  it("pause extends deadlines via pausedMs", () => {
    const running = recalculateTicketSlaState({
      policy,
      ticketCreatedAt: "2026-09-07T05:30:00.000Z",
      ticketStatus: "open",
      firstRespondedAt: null,
      lastMemberMessageAt: null,
      pausedAt: null,
      pausedMs: 0,
      nowIso: "2026-09-07T06:00:00.000Z",
    });
    const paused = recalculateTicketSlaState({
      policy,
      ticketCreatedAt: "2026-09-07T05:30:00.000Z",
      ticketStatus: "open",
      firstRespondedAt: null,
      lastMemberMessageAt: null,
      pausedAt: "2026-09-07T06:00:00.000Z",
      pausedMs: 120_000,
      nowIso: "2026-09-07T06:05:00.000Z",
    });
    assert.notEqual(running.firstResponseDueAt, paused.firstResponseDueAt);
    assert.ok(
      Date.parse(paused.firstResponseDueAt ?? "") > Date.parse(running.firstResponseDueAt ?? ""),
    );
  });

  it("warning and breach helpers respect due instants", () => {
    const due = "2026-09-07T10:00:00.000Z";
    assert.equal(isSlaDue(due, "2026-09-07T09:59:00.000Z"), false);
    assert.equal(isSlaDue(due, "2026-09-07T10:00:00.000Z"), true);
    assert.equal(
      isSlaWarningDue(
        "2026-09-07T08:00:00.000Z",
        due,
        80,
        "2026-09-07T09:36:00.000Z",
        null,
      ),
      true,
    );
  });
});
