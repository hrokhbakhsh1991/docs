/**
 * PR14-B — Host Command Bridge production wiring security proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CaseOutput } from "@app-tour/finance-core/case";
import { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";
import {
  deriveFinanceCaseCommandCapability,
  parseFinanceCaseCommandReviewReceiptBody,
} from "@app-tour/finance-http-contracts";

import {
  caseOutputMeaningFingerprint,
  createInMemoryCaseCommandTelemetrySink,
  mapBridgeResultToHttp,
  runFinanceCaseCommandReviewReceiptHttp,
  toReviewReceiptBridgeIntent,
  type CaseCommandIntent,
  type ReviewReceiptBridgeResult,
} from "./index.ts";
import { encounterFromCaseOutput } from "./load-enrollment-encounter.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");

function walkTs(dir: string, files: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "dist") continue;
      walkTs(full, files);
    } else if (/\.(ts|tsx)$/.test(name)) {
      files.push(full);
    }
  }
  return files;
}

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
  tenantId: "t1",
  role: "admin" as const,
  status: "ACTIVE" as const,
  workspaceId: "ws-1",
};

function intentBody() {
  const allowed = caseOutput({
    allow: ["approve_evidence", "reject_evidence"],
    forbid: ["create_payment_repair"],
  });
  return {
    caseKey: "enrollment:reg-1:primary",
    action: {
      command: "reviewReceipt" as const,
      token: "approve_evidence" as const,
      decision: "approve" as const,
    },
    source: {
      encounterExecutionId: "exec-1",
      encounterVersionHint: caseOutputMeaningFingerprint(allowed),
    },
    correlationId: "corr-14b",
    reviewReceipt: {
      registrationId: "reg-1",
      counterpartyId: "c1",
      receiptId: "rcpt-1",
    },
  };
}

describe("PR14-B Host Command Bridge production wiring", () => {
  it("1 — UI cannot call FinanceService directly", () => {
    const uiRoot = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
    for (const file of walkTs(uiRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /FinanceService|createManualPayment|runReviewReceiptCommandBridge/);
      assert.doesNotMatch(src, /from\s+["']@app-tour\/finance-core/);
    }
    // capability seam has endpoint string only — not an SoT invoke
    const cap = readFileSync(join(uiRoot, "command-capability.ts"), "utf8");
    assert.match(cap, /\/finance\/case\/commands\/review-receipt/);
    assert.doesNotMatch(cap, /reviewReceipt\(/);
  });

  it("2 — missing auth context blocks mutation", async () => {
    const telemetry = createInMemoryCaseCommandTelemetrySink();
    const result = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body: intentBody(),
      deps: {},
      telemetry,
      runBridge: async () => ({
        ok: false,
        correlationId: "corr-14b",
        reason: "auth_denied",
        message: "CASE_COMMAND_AUTHZ_DENIED",
        encounter: null,
        preflight: null,
        post: null,
      }),
    });
    assert.equal(result.status, 403);
    if (result.status !== 200) {
      assert.equal(result.error.code, "CASE_COMMAND_AUTH_DENIED");
      assert.doesNotMatch(result.error.message, /prisma|ZOD|stack/i);
    }
    assert.ok(telemetry.events.some((e) => e.event === "command_requested"));
    assert.ok(telemetry.events.some((e) => e.event === "auth_denied"));
  });

  it("3 — stale Encounter blocks mutation", async () => {
    const telemetry = createInMemoryCaseCommandTelemetrySink();
    const result = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body: intentBody(),
      deps: {},
      telemetry,
      runBridge: async () => ({
        ok: false,
        correlationId: "corr-14b",
        reason: "concurrency_conflict",
        message: "CASE_COMMAND_CONCURRENCY_CONFLICT",
        encounter: null,
        preflight: null,
        post: null,
      }),
    });
    assert.equal(result.status, 409);
    if (result.status !== 200) {
      assert.equal(result.error.code, "CASE_COMMAND_STALE");
    }
    assert.ok(telemetry.events.some((e) => e.event === "stale_rejected"));
  });

  it("4 — vocabulary denial blocks mutation", async () => {
    const telemetry = createInMemoryCaseCommandTelemetrySink();
    const result = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body: intentBody(),
      deps: {},
      telemetry,
      runBridge: async () => ({
        ok: false,
        correlationId: "corr-14b",
        reason: "vocabulary_denied",
        message: "CASE_COMMAND_VOCABULARY_REJECTED",
        encounter: null,
        preflight: null,
        post: null,
      }),
    });
    assert.equal(result.status, 409);
    if (result.status !== 200) {
      assert.equal(result.error.code, "CASE_COMMAND_VOCABULARY_DENIED");
    }
    assert.ok(telemetry.events.some((e) => e.event === "vocabulary_denied"));
  });

  it("5 — SoT failure creates no fake Case result", async () => {
    const allowed = caseOutput({
      allow: ["approve_evidence"],
      forbid: [],
    });
    const pre = encounterFromCaseOutput(allowed, "exec-1");
    const bridgeFail: ReviewReceiptBridgeResult = {
      ok: false,
      correlationId: "corr-14b",
      reason: "sot_rejected",
      message: "ZOD_VALIDATION_FAILED: internal prisma detail",
      encounter: pre.encounter,
      preflight: pre,
      post: pre,
    };
    const http = mapBridgeResultToHttp(intentBody(), bridgeFail);
    assert.equal(http.status, 409);
    if (http.status !== 200) {
      assert.equal(http.error.code, "CASE_COMMAND_SOT_REJECTED");
      assert.doesNotMatch(http.error.message, /prisma|ZOD/i);
    }
    assert.doesNotMatch(JSON.stringify(http), /caseStatus|CaseOutput|FactSnapshot/);
  });

  it("6 — success returns fresh interpretation", async () => {
    const preOut = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: [],
      interpretationSentence: "before",
    });
    const postOut = caseOutput({
      allow: ["wait"],
      forbid: [],
      interpretationSentence: "after approve",
      reading: "SETTLED_CAPTURED",
      owner: "idle",
      whyOwner: "done",
      primaryPosture: "wait",
      decisionReady: false,
    });
    const pre = encounterFromCaseOutput(preOut, "exec-pre");
    const post = encounterFromCaseOutput(postOut, "exec-post");
    const telemetry = createInMemoryCaseCommandTelemetrySink();
    const result = await runFinanceCaseCommandReviewReceiptHttp({
      auth,
      body: intentBody(),
      deps: {},
      telemetry,
      runBridge: async () => ({
        ok: true,
        correlationId: "corr-14b",
        sot: {
          receiptId: "rcpt-1",
          decision: "approve",
          status: "Approved",
          reviewNote: null,
          reviewedAt: "2026-08-07T00:00:00.000Z",
        },
        preflight: pre,
        post,
        audit: {
          actionToken: "approve_evidence",
          caseKey: preOut.caseKey,
          receiptId: "rcpt-1",
          actorUserId: "op-1",
          tenantId: "t1",
        },
      }),
    });
    assert.equal(result.status, 200);
    if (result.status === 200) {
      assert.equal(result.body.executionId, "exec-post");
      assert.equal(result.body.encounter.explainability.headline, "after approve");
      assert.ok(result.body.meaningFingerprint.length > 0);
      assert.deepEqual(result.body.commandCapability.supportedCommands, ["reviewReceipt"]);
      assert.doesNotMatch(JSON.stringify(result.body), /CaseOutput|FactSnapshot|prisma/);
    }
    assert.ok(telemetry.events.some((e) => e.event === "succeeded"));
  });

  it("7 — finance-core has zero mutation imports", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src/case");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      const imports = src
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l) || /^\s*import\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(
          line,
          /reviewReceipt|FinanceService|command-bridge|createManualPayment|finance-http/
        );
      }
    }
  });

  it("8 — Denali and future workspace ports remain separated", () => {
    assert.ok(
      FINANCE_HTTP_ROUTE_MANIFEST.some(
        (r) => r.method === "POST" && r.path === "/finance/case/commands/review-receipt"
      )
    );
    const adapter = readFileSync(
      join(HERE, "finance-service-review-receipt-adapter.ts"),
      "utf8"
    );
    assert.match(adapter, /createFinanceServiceReviewReceiptAdapter/);
    assert.doesNotMatch(adapter, /workspace-denali|@app-tour\/workspaces\/denali/);

    const httpRunner = readFileSync(
      join(HERE, "run-finance-case-command-review-receipt-http.ts"),
      "utf8"
    );
    // Host Denali read deps are OK for live path; contract types stay portable.
    assert.match(httpRunner, /createFinanceServiceReviewReceiptAdapter/);
    assert.match(httpRunner, /ReviewReceiptCommandPort|financePort/);

    const parsed = parseFinanceCaseCommandReviewReceiptBody(intentBody());
    assert.equal(parsed.action.command, "reviewReceipt");
    const cap = deriveFinanceCaseCommandCapability(["approve_evidence", "wait"]);
    assert.deepEqual(cap.reviewReceipt.availableTokens, ["approve_evidence"]);

    // Intent builder ignores client actor — session is SoT for identity.
    const built: CaseCommandIntent = {
      caseKey: parsed.caseKey,
      actor: auth,
      action: parsed.action,
      workspace: { workspaceId: "ws-1", tenantId: "t1" },
      source: parsed.source,
      correlationId: "x",
      reviewReceipt: parsed.reviewReceipt,
    };
    const bridgeIntent = toReviewReceiptBridgeIntent(built);
    assert.equal(bridgeIntent.auth.userId, auth.userId);
  });
});
