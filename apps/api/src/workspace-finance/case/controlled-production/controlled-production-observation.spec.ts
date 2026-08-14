/**
 * PR19 — Controlled production observation proofs (report-only).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createInMemoryCaseCommandTelemetrySink } from "../command-bridge/command-bridge-telemetry.ts";
import { resolveEncounterProductionDecision } from "../encounter/encounter-production-decision.ts";
import {
  buildControlledProductionHealthReport,
  evaluateControlledProductionRolloutSafety,
  normalizeDiscrepancyClass,
  recommendControlledProduction,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNBOOK = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"
);
const BRIDGE = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md"
);

const TENANT = "00000000-0000-4000-8000-000000000003";
const OTHER = "00000000-0000-4000-8000-000000000004";

describe("PR19 controlled production observation", () => {
  it("1 — rollout safety fail-closed (empty/multi/mismatch/emergency/shadow)", () => {
    assert.equal(
      evaluateControlledProductionRolloutSafety({
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: TENANT,
        commandUiEnabled: "true",
        commandUiTenant: TENANT,
        shadowEnabled: "false",
        emergencyDisable: "false",
      }).ok,
      true
    );

    assert.equal(
      evaluateControlledProductionRolloutSafety({
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: TENANT,
        commandUiEnabled: "true",
        commandUiTenant: "",
        shadowEnabled: "false",
        emergencyDisable: "false",
      }).commandUiAllowed,
      false
    );

    assert.equal(
      evaluateControlledProductionRolloutSafety({
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: TENANT,
        commandUiEnabled: "true",
        commandUiTenant: `${TENANT},${OTHER}`,
        shadowEnabled: "false",
        emergencyDisable: "false",
      }).commandUiAllowed,
      false
    );

    assert.equal(
      evaluateControlledProductionRolloutSafety({
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: OTHER,
        commandUiEnabled: "true",
        commandUiTenant: TENANT,
        shadowEnabled: "false",
        emergencyDisable: "false",
      }).ok,
      false
    );

    assert.equal(
      evaluateControlledProductionRolloutSafety({
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: TENANT,
        commandUiEnabled: "true",
        commandUiTenant: TENANT,
        shadowEnabled: "true",
        emergencyDisable: "false",
      }).shadowOff,
      false
    );

    assert.ok(
      evaluateControlledProductionRolloutSafety({
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: TENANT,
        commandUiEnabled: "true",
        commandUiTenant: TENANT,
        shadowEnabled: "false",
        emergencyDisable: "1",
      }).reasons.includes("emergency_disable")
    );
  });

  it("2 — health report composes Meaning + command + recommendation; never mutates flags", () => {
    const now = 1_700_000_000_000;
    const decision = resolveEncounterProductionDecision({
      env: {
        FINANCE_CASE_ENCOUNTER_MODE: "internal",
        FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT,
        FINANCE_CASE_SHADOW_ENABLED: "false",
      },
      tenantId: TENANT,
    });
    const host = createInMemoryCaseCommandTelemetrySink();
    host.emit({
      kind: "case_command",
      event: "command_requested",
      tenantId: TENANT,
      caseKey: "enrollment:r1:primary",
      command: "reviewReceipt",
      actionToken: "approve_evidence",
      correlationId: "c1",
      registrationId: "r1",
      recordedAtMs: now,
      durationMs: 10,
    });
    host.emit({
      kind: "case_command",
      event: "succeeded",
      tenantId: TENANT,
      caseKey: "enrollment:r1:primary",
      command: "reviewReceipt",
      actionToken: "approve_evidence",
      correlationId: "c1",
      registrationId: "r1",
      recordedAtMs: now + 40,
      durationMs: 40,
    });
    host.emit({
      kind: "case_command",
      event: "stale_rejected",
      tenantId: TENANT,
      caseKey: "enrollment:r2:primary",
      command: "reviewReceipt",
      actionToken: "approve_evidence",
      correlationId: "c2",
      registrationId: "r2",
      recordedAtMs: now + 50,
      durationMs: 12,
    });

    const report = buildControlledProductionHealthReport({
      tenantId: TENANT,
      startedAtMs: now - 60_000,
      endedAtMs: now,
      events: [],
      decision,
      internalTenants: [TENANT],
      meaningSamples: Array.from({ length: 6 }, (_, i) => ({
        tenantId: TENANT,
        registrationId: `r${i}`,
        reading: i === 5 ? "EXCEPTION" : "AWAITING_FINANCE",
        completenessClass: i === 5 ? "escalate_forced" : "act_complete",
      })),
      clientEvents: Array.from({ length: 6 }, (_, i) => ({
        name: "meaning_opened" as const,
        registrationId: `r${i}`,
        recordedAtMs: now,
      })).concat(
        Array.from({ length: 5 }, (_, i) => ({
          name: "meaning_viewed" as const,
          registrationId: `r${i}`,
          executionId: `e${i}`,
          surfaceState: "normal" as const,
          latencyMs: 100 + i * 10,
          recordedAtMs: now,
        }))
      ),
      hostCommandEvents: host.events,
      commandUiEvents: [
        { name: "command_discovered", registrationId: "r1" },
        { name: "command_confirmation_shown", registrationId: "r1" },
        { name: "command_submitted", registrationId: "r1", ok: true, latencyMs: 40 },
        { name: "classic_review_submitted", registrationId: "r9", ok: true },
      ],
      discrepancySamples: [
        {
          registrationId: "r-x",
          summary: "residual no_rule_matched paid+remaining",
          classification: normalizeDiscrepancyClass("HOST_MAPPING"),
          unresolvedNoRuleMatched: true,
        },
      ],
      decisionReadyCount: 5,
      meaningSampleCountForDecisionReady: 6,
      evidenceClasses: ["FIXTURE", "AUTOMATED"],
      safety: {
        sessionTenantId: TENANT,
        encounterMode: "internal",
        encounterInternalTenants: TENANT,
        commandUiEnabled: "true",
        commandUiTenant: TENANT,
        shadowEnabled: "false",
        emergencyDisable: "false",
      },
      minSamples: 1,
      now: () => now,
    });

    assert.equal(report.mutatesFlags, false);
    assert.equal(report.blocksFinanceService, false);
    assert.equal(report.safety.ok, true);
    assert.equal(report.command.succeeded, 1);
    assert.equal(report.command.concurrencyConflict, 1);
    assert.equal(report.command.classicReviewSubmitted, 1);
    assert.equal(report.interpretation.unresolvedNoRuleMatched, 1);
    assert.equal(report.interpretation.discrepancyClassCounts.HOST_MAPPING, 1);
    assert.ok(
      report.recommendation.kind === "CONTINUE" ||
        report.recommendation.kind === "HOLD" ||
        report.recommendation.kind === "READY_FOR_EXPANSION"
    );
    assert.equal(report.recommendation.mutatesFlags, false);
    assert.equal(report.recommendation.expandsTenants, false);
  });

  it("3 — CASE_INTERPRETER discrepancy forces HOLD; docs lock PR19", () => {
    const hold = recommendControlledProduction({
      safetyOk: true,
      requestCount: 20,
      commandSubmitted: 5,
      commandSuccessRate: 1,
      staleRate: 0,
      authDeniedRate: 0,
      meaningAvailability: 1,
      meaningTimeoutRate: 0,
      exceptionRate: 0,
      incompleteRate: 0,
      caseInterpreterDiscrepancyCount: 1,
    });
    assert.equal(hold.kind, "HOLD");

    const runbook = readFileSync(RUNBOOK, "utf8");
    const bridge = readFileSync(BRIDGE, "utf8");
    assert.match(runbook, /PR19/);
    assert.match(runbook, /READY_FOR_EXPANSION/);
    assert.match(runbook, /FINANCE_CASE_SHADOW_ENABLED=false/);
    assert.match(bridge, /Controlled production observation/i);
    assert.match(runbook, /Never auto-flip rollout flags/);
    assert.match(bridge, /Controlled production observation/i);
  });
});
