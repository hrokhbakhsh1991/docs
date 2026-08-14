/**
 * PR14-A — Production Command Bridge architecture proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CaseOutput } from "@app-tour/finance-core/case";

import {
  CASE_COMMAND_BRIDGE_FAILURE_CODES,
  FORBIDDEN_CASE_COMMAND_MUTATIONS,
  caseOutputMeaningFingerprint,
  isIntentStale,
  mapCaseCommandIntent,
  normalizeBridgeFailureReason,
  runReviewReceiptCommandBridge,
  toReviewReceiptBridgeIntent,
  type CaseCommandIntent,
  type ReviewReceiptSoTPort,
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

function caseIntent(patch: Partial<CaseCommandIntent> = {}): CaseCommandIntent {
  const allowed = caseOutput({
    allow: ["approve_evidence", "reject_evidence"],
    forbid: ["create_payment_repair"],
  });
  const fp = caseOutputMeaningFingerprint(allowed);
  return {
    caseKey: "enrollment:reg-1:primary",
    actor: {
      userId: "op-1",
      tenantId: "t1",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    },
    action: {
      command: "reviewReceipt",
      token: "approve_evidence",
      decision: "approve",
    },
    workspace: { workspaceId: "ws-1", tenantId: "t1" },
    source: {
      encounterExecutionId: "exec-view-1",
      encounterVersionHint: fp,
    },
    correlationId: "corr-14a",
    reviewReceipt: {
      registrationId: "reg-1",
      counterpartyId: "c1",
      receiptId: "rcpt-1",
    },
    ...patch,
  };
}

describe("PR14-A Production Command Bridge architecture", () => {
  it("1 — finance-core imports no commands", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src/case");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      const imports = src
        .split("\n")
        .filter((l) => /\bfrom\s+["']/.test(l) || /^\s*import\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(
          line,
          /reviewReceipt|createManualPayment|FinanceService|command-bridge|CaseCommandIntent/
        );
      }
    }
  });

  it("2 — Encounter UI cannot invoke SoT directly", () => {
    const uiRoot = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
    for (const file of walkTs(uiRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /FinanceService|createManualPayment|runReviewReceiptCommandBridge|CaseCommandIntent/);
      assert.doesNotMatch(src, /reviewReceipt\s*\(/);
    }
  });

  it("3 — authorization happens before mutation", async () => {
    let order: string[] = [];
    const intent = toReviewReceiptBridgeIntent(caseIntent());
    const result = await runReviewReceiptCommandBridge(intent, {
      authorization: {
        assertOperatorAccess() {
          order.push("authz");
          throw new Error("FORBIDDEN");
        },
      },
      finance: {
        async reviewReceipt() {
          order.push("sot");
          throw new Error("unreachable");
        },
      },
      loadEncounter: async () => {
        order.push("load");
        throw new Error("unreachable");
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "auth_denied");
    }
    assert.deepEqual(order, ["authz"]);
  });

  it("4 — Case cannot mutate state (forbidden mutations locked; no Case status)", () => {
    assert.ok(FORBIDDEN_CASE_COMMAND_MUTATIONS.includes("payment_capture"));
    assert.ok(FORBIDDEN_CASE_COMMAND_MUTATIONS.includes("refund"));
    assert.ok(FORBIDDEN_CASE_COMMAND_MUTATIONS.includes("settlement"));
    assert.ok(FORBIDDEN_CASE_COMMAND_MUTATIONS.includes("lifecycle_transition"));
    assert.ok(FORBIDDEN_CASE_COMMAND_MUTATIONS.includes("ownership_change"));
    assert.ok(FORBIDDEN_CASE_COMMAND_MUTATIONS.includes("automatic_actions"));

    const bridgeRoot = join(REPO_ROOT, "apps/api/src/workspace-finance/case/command-bridge");
    for (const file of walkTs(bridgeRoot)) {
      if (file.endsWith(".spec.ts")) continue;
      if (file.endsWith("case-command-intent.ts")) continue; // allowlist of forbidden names
      if (file.endsWith("command-bridge-telemetry.ts")) continue; // deny-list regex only
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /caseStatus|case_repository|prisma\.case|CaseRepository/);
      assert.doesNotMatch(src, /\bcreateRefund\b|\bsettlePayment\b|\bcapturePayment\b/);
    }
  });

  it("5 — successful command creates fresh Case interpretation", async () => {
    const pre = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: ["create_payment_repair"],
      interpretationSentence: "before",
    });
    const post = caseOutput({
      allow: ["wait"],
      forbid: ["create_payment_repair"],
      interpretationSentence: "after",
      reading: "SETTLED_CAPTURED",
      owner: "idle",
      whyOwner: "Settled",
      primaryPosture: "wait",
      decisionReady: false,
    });
    const bridgeIntent = toReviewReceiptBridgeIntent(
      caseIntent({
        source: {
          encounterExecutionId: "exec-view-1",
          encounterVersionHint: caseOutputMeaningFingerprint(pre),
        },
      })
    );
    const result = await runReviewReceiptCommandBridge(bridgeIntent, {
      authorization: {
        assertOperatorAccess() {
          /* ok */
        },
      },
      finance: {
        async reviewReceipt(_a, id) {
          return {
            id,
            status: "Approved",
            reviewNote: null,
            reviewedAt: "2026-08-07T00:00:00.000Z",
          };
        },
      },
      loadEncounter: async (phase) =>
        encounterFromCaseOutput(phase === "preflight" ? pre : post, `exec-${phase}`),
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.notEqual(
        result.preflight.caseOutput.interpretationSentence,
        result.post.caseOutput.interpretationSentence
      );
      assert.notEqual(result.preflight.executionId, result.post.executionId);
    }
  });

  it("6 — stale intent is rejected (no SoT call)", async () => {
    const allowed = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: ["create_payment_repair"],
    });
    const drifted = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: ["create_payment_repair"],
      interpretationSentence: "someone else acted",
    });
    let sotCalls = 0;
    const bridgeIntent = toReviewReceiptBridgeIntent(
      caseIntent({
        source: {
          encounterExecutionId: "exec-view-1",
          encounterVersionHint: caseOutputMeaningFingerprint(allowed),
        },
      })
    );
    const result = await runReviewReceiptCommandBridge(bridgeIntent, {
      authorization: {
        assertOperatorAccess() {
          /* ok */
        },
      },
      finance: {
        async reviewReceipt() {
          sotCalls += 1;
          throw new Error("unreachable");
        },
      },
      loadEncounter: async () => encounterFromCaseOutput(drifted, "exec-fresh"),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "concurrency_conflict");
    }
    assert.equal(sotCalls, 0);
    assert.equal(
      isIntentStale({
        caseKey: bridgeIntent.caseKey,
        source: {
          encounterExecutionId: bridgeIntent.sourceEncounterExecutionId,
          encounterVersionHint: bridgeIntent.sourceEncounterVersionHint,
        },
        fresh: encounterFromCaseOutput(drifted, "exec-fresh"),
      }),
      true
    );
  });

  it("7 — Denali path unchanged (reviewReceipt → injectable FinanceService-shaped port)", () => {
    const mapped = mapCaseCommandIntent(caseIntent());
    assert.equal(mapped.receiptId, "rcpt-1");
    assert.equal(mapped.body.decision, "approve");

    const denaliPort: ReviewReceiptSoTPort = {
      async reviewReceipt(_auth, receiptId, body) {
        assert.equal(body.decision, "approve");
        return {
          id: receiptId,
          status: "Approved",
          reviewNote: null,
          reviewedAt: null,
        };
      },
    };
    // Type-level Denali SoT shape — runtime smoke.
    void denaliPort;
    assert.deepEqual(
      [...CASE_COMMAND_BRIDGE_FAILURE_CODES].sort(),
      [
        "auth_denied",
        "concurrency_conflict",
        "intent_invalid",
        "provider_unavailable",
        "reexecute_failed",
        "sot_rejected",
        "vocabulary_denied",
      ].sort()
    );
    assert.equal(normalizeBridgeFailureReason("authz_denied"), "auth_denied");
    assert.equal(normalizeBridgeFailureReason("vocabulary_rejected"), "vocabulary_denied");
  });

  it("8 — second workspace compatibility preserved (no Denali imports in bridge contracts)", () => {
    const contractFiles = [
      "case-command-intent.ts",
      "command-bridge-failures.ts",
      "stale-intent-guard.ts",
      "map-case-command-intent.ts",
      "types.ts",
      "vocabulary-gate.ts",
      "authorize-case-command.ts",
    ];
    for (const name of contractFiles) {
      const src = readFileSync(join(HERE, name), "utf8");
      assert.doesNotMatch(src, /workspace-denali|@app-tour\/workspaces\/denali|packages\/workspaces\/denali/);
    }

    // Marketplace-shaped SoT port satisfies the same bridge contract.
    const marketplacePort: ReviewReceiptSoTPort = {
      async reviewReceipt(_auth, receiptId, body) {
        return {
          id: `mkt:${receiptId}`,
          status: body.decision === "approve" ? "APPROVED" : "REJECTED",
          reviewNote: null,
          reviewedAt: null,
        };
      },
    };
    void marketplacePort;
  });
});
