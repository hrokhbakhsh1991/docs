/**
 * PR18-C — Host-side Command Bridge failure / isolation proofs (no vocabulary expand).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CaseOutput } from "@app-tour/finance-core/case";

import {
  caseOutputMeaningFingerprint,
  createInMemoryCaseCommandTelemetrySink,
  runFinanceCaseCommandReviewReceiptHttp,
  type ReviewReceiptBridgeResult,
} from "./index.ts";
import { resolveEncounterProductionDecision } from "../encounter/encounter-production-decision.ts";
import { loadFinanceCaseEncounterHttp } from "../encounter/load-finance-case-encounter-http.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOC = resolve(
  HERE,
  "../../../../../../docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"
);

const TENANT = "00000000-0000-4000-8000-000000000003";
const OTHER = "00000000-0000-4000-8000-000000000004";

const INTERNAL_ENV = {
  FINANCE_CASE_ENCOUNTER_MODE: "internal",
  FINANCE_CASE_ENCOUNTER_INTERNAL_TENANTS: TENANT,
  FINANCE_CASE_SHADOW_ENABLED: "false",
  FINANCE_CASE_ENCOUNTER_EMERGENCY_DISABLE: "false",
};

function caseOutput(partial: Partial<CaseOutput> & Pick<CaseOutput, "allow" | "forbid">): CaseOutput {
  return {
    subjectId: "reg-1",
    subjectKind: "enrollment",
    caseKey: "enrollment:reg-1:primary",
    reading: "AWAITING_FINANCE",
    interpretationSentence: "Evidence in review",
    decisionReady: true,
    owner: "finance",
    whyOwner: "Finance owns evidence review",
    lane: "daily",
    primaryPosture: "inspect",
    confidence: {
      whyVisible: "v",
      whyMineOrNot: "m",
      ifIWait: "w",
      avoid: "a",
    },
    completenessClass: "act_complete",
    auditAltitude: false,
    ...partial,
  };
}

const auth = {
  userId: "op-1",
  tenantId: TENANT,
  role: "admin" as const,
  status: "ACTIVE" as const,
  workspaceId: "ws-1",
};

function intentBody(fp: string, executionId = "exec-1") {
  return {
    caseKey: "enrollment:reg-1:primary",
    action: {
      command: "reviewReceipt" as const,
      token: "approve_evidence" as const,
      decision: "approve" as const,
    },
    source: {
      encounterExecutionId: executionId,
      encounterVersionHint: fp,
    },
    correlationId: "corr-18c",
    reviewReceipt: {
      registrationId: "reg-1",
      counterpartyId: "c1",
      receiptId: "rcpt-1",
    },
  };
}

describe("PR18-C Host command validation", () => {
  it("1 — non-allowlisted Encounter tenant zero Case execution", async () => {
    const decision = resolveEncounterProductionDecision({
      tenantId: OTHER,
      env: INTERNAL_ENV,
    });
    assert.equal(decision.run, false);

    let executed = 0;
    const denied = await loadFinanceCaseEncounterHttp({
      auth: {
        userId: "op",
        tenantId: OTHER,
        role: "admin",
        status: "ACTIVE",
        workspaceId: "ws",
      },
      registrationId: "reg-foreign",
      counterpartyId: "cp",
      deps: {},
      env: INTERNAL_ENV,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {
        executed += 1;
      },
      loadPresentation: async () => {
        executed += 1;
        return {
          encounter: {
            subjectId: "x",
            subjectKind: "enrollment",
            caseKey: "k",
            reading: "AWAITING_FINANCE",
            owner: "finance",
            lane: "daily",
            primaryPosture: "act",
            decisionReady: true,
            allow: [],
            forbid: [],
            auditAltitude: false,
            explainability: {
              headline: "h",
              reading: "AWAITING_FINANCE",
              owner: "finance",
              ownerSummary: "o",
              primaryPosture: "act",
              lane: "daily",
              decisionReady: true,
              auditAltitude: false,
            },
            confidence: { whyVisible: "a", whyMineOrNot: "b", ifIWait: "c", avoid: "d" },
            completeness: {
              inspectForced: false,
              completenessClass: "act_complete",
              displayToken: "act_complete",
            },
            discoveryAttention: null,
          },
          executionId: "leak",
        };
      },
    });
    assert.equal(denied.status, 503);
    assert.equal(executed, 0);
  });

  it("2 — auth_denied before SoT; sot_rejected; stale; reexecute_failed never 200 success", async () => {
    const allowed = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: [],
    });
    const fp = caseOutputMeaningFingerprint(allowed);
    const body = intentBody(fp);

    // Authz runs inside the bridge (not the HTTP wrapper). Inject auth_denied outcome.
    const authDenied = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body,
      deps: {},
      runBridge: async (): Promise<ReviewReceiptBridgeResult> => ({
        ok: false,
        correlationId: "corr-18c-auth",
        reason: "auth_denied",
        message: "CASE_COMMAND_AUTHZ_DENIED",
        encounter: null,
        preflight: null,
        post: null,
      }),
      telemetry: createInMemoryCaseCommandTelemetrySink(),
    });
    assert.equal(authDenied.status, 403);
    if (authDenied.status !== 200) {
      assert.equal(authDenied.error.code, "CASE_COMMAND_AUTH_DENIED");
    }

    const sotRejected = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body,
      deps: {},
      authorization: { assertOperatorAccess() {} },
      runBridge: async (): Promise<ReviewReceiptBridgeResult> => ({
        ok: false,
        correlationId: "corr-18c",
        reason: "sot_rejected",
        message: "receipt_not_pending",
        encounter: null,
        preflight: null,
        post: null,
      }),
      telemetry: createInMemoryCaseCommandTelemetrySink(),
    });
    assert.notEqual(sotRejected.status, 200);
    if (sotRejected.status !== 200) {
      assert.equal(sotRejected.error.code, "CASE_COMMAND_SOT_REJECTED");
    }

    const stale = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body,
      deps: {},
      authorization: { assertOperatorAccess() {} },
      runBridge: async (): Promise<ReviewReceiptBridgeResult> => ({
        ok: false,
        correlationId: "corr-18c",
        reason: "concurrency_conflict",
        message: "meaning_fingerprint_mismatch",
        encounter: null,
        preflight: null,
        post: null,
      }),
      telemetry: createInMemoryCaseCommandTelemetrySink(),
    });
    assert.notEqual(stale.status, 200);
    if (stale.status !== 200) {
      assert.equal(stale.error.code, "CASE_COMMAND_STALE");
    }

    const reexec = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body,
      deps: {},
      authorization: { assertOperatorAccess() {} },
      runBridge: async (): Promise<ReviewReceiptBridgeResult> => ({
        ok: false,
        correlationId: "corr-18c",
        reason: "reexecute_failed",
        message: "postflight",
        encounter: null,
        preflight: null,
        post: null,
      }),
      telemetry: createInMemoryCaseCommandTelemetrySink(),
    });
    assert.notEqual(reexec.status, 200);
    if (reexec.status !== 200) {
      assert.equal(reexec.error.code, "CASE_COMMAND_REEXECUTE_FAILED");
    }
  });

  it("3 — docs lock PR18-C; shadow remains false in validation config", () => {
    const doc = readFileSync(DOC, "utf8");
    assert.match(doc, /PR18-C/);
    assert.match(doc, /FINANCE_CASE_COMMAND_UI_TENANT/);
    assert.match(doc, /FINANCE_CASE_SHADOW_ENABLED=false/);
    assert.match(doc, /READY_FOR_CONTROLLED_PRODUCTION|CONTINUE|HOLD/);
    assert.match(doc, /Do \*\*not\*\* enable capture\/refund\/settlement UI/i);
  });
});
