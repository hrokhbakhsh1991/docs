/**
 * PR9-B — Host reviewReceipt command bridge safety proofs.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { CaseOutput } from "@app-tour/finance-core/case";
import { projectCaseEncounter } from "@app-tour/finance-core/case";

import {
  authorizeCaseCommand,
  CaseCommandAuthzDeniedError,
  mapReviewReceiptIntent,
  runReviewReceiptCommandBridge,
  vocabularyAllows,
  type ReviewReceiptBridgeIntent,
} from "./index.ts";
import { encounterFromCaseOutput } from "./load-enrollment-encounter.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");

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

function intent(
  patch: Partial<ReviewReceiptBridgeIntent> = {}
): ReviewReceiptBridgeIntent {
  return {
    tenantId: "t1",
    caseKey: "enrollment:reg-1:primary",
    registrationId: "reg-1",
    counterpartyId: "c1",
    receiptId: "rcpt-1",
    actionToken: "approve_evidence",
    decision: "approve",
    correlationId: "corr-1",
    sourceEncounterExecutionId: "exec-preflight",
    auth: {
      userId: "op-1",
      tenantId: "t1",
      role: "admin",
      status: "ACTIVE",
      workspaceId: "ws-1",
    },
    ...patch,
  };
}

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

describe("PR9-B Host reviewReceipt command bridge", () => {
  it("1 — UI / encounter-ui cannot bypass Host bridge (no reviewReceipt imports)", () => {
    const uiRoot = join(REPO_ROOT, "packages/finance-case-encounter-ui/src");
    for (const file of walkTs(uiRoot)) {
      const src = readFileSync(file, "utf8");
      assert.doesNotMatch(src, /FinanceService|createManualPayment/);
      assert.doesNotMatch(src, /reviewReceipt\s*\(/);
      const imports = src.split("\n").filter((l) => /\bfrom\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /finance-core|workspace-finance|command-bridge/);
      }
    }
  });

  it("2 — finance-core case has no SoT command imports", () => {
    const caseRoot = join(REPO_ROOT, "packages/finance-core/src/case");
    for (const file of walkTs(caseRoot)) {
      const src = readFileSync(file, "utf8");
      const imports = src.split("\n").filter((l) => /\bfrom\s+["']/.test(l) || /^\s*import\s+["']/.test(l));
      for (const line of imports) {
        assert.doesNotMatch(line, /reviewReceipt|createManualPayment|FinanceService|application\/finance\.service/);
      }
    }
  });

  it("3 — authorization required (no SoT call when authz denied)", async () => {
    let sotCalls = 0;
    const result = await runReviewReceiptCommandBridge(intent(), {
      authorization: {
        assertOperatorAccess() {
          throw new Error("FORBIDDEN");
        },
      },
      finance: {
        async reviewReceipt() {
          sotCalls += 1;
          throw new Error("unreachable");
        },
      },
      loadEncounter: async () => {
        throw new Error("should_not_load");
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "auth_denied");
    }
    assert.equal(sotCalls, 0);
    assert.throws(
      () =>
        authorizeCaseCommand(
          {
            assertOperatorAccess() {
              throw new Error("nope");
            },
          },
          intent().auth
        ),
      CaseCommandAuthzDeniedError
    );
  });

  it("4 — failed SoT command creates no Case state (only ephemeral encounter reload)", async () => {
    const allowed = caseOutput({
      allow: ["approve_evidence", "reject_evidence", "inspect_evidence"],
      forbid: ["create_payment_repair"],
    });
    let caseWrites = 0;
    const result = await runReviewReceiptCommandBridge(intent(), {
      authorization: {
        assertOperatorAccess() {
          /* ok */
        },
      },
      finance: {
        async reviewReceipt() {
          throw new Error("ZOD_VALIDATION_FAILED: receipt already Approved");
        },
      },
      loadEncounter: async (phase) => {
        if (phase === "post") {
          // Simulate Host re-read — still no Case table write.
          caseWrites += 0;
        }
        return encounterFromCaseOutput(allowed, phase === "preflight" ? "exec-preflight" : "exec-post");
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "sot_rejected");
      assert.ok(result.preflight !== null);
      assert.ok(result.post !== null);
    }
    assert.equal(caseWrites, 0);
    // No Case persistence vocabulary in result payload keys.
    assert.doesNotMatch(JSON.stringify(result), /caseStatus|case_repository|case_table/i);
  });

  it("5 — success triggers fresh execution (post ≠ patched preflight identity)", async () => {
    const pre = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: ["create_payment_repair"],
      interpretationSentence: "before",
    });
    const post = caseOutput({
      allow: ["wait"],
      forbid: ["create_payment_repair"],
      reading: "SETTLED_CAPTURED",
      interpretationSentence: "after approve",
      owner: "idle",
      whyOwner: "Settled",
      primaryPosture: "wait",
      decisionReady: false,
    });

    const phases: string[] = [];
    const result = await runReviewReceiptCommandBridge(intent(), {
      authorization: {
        assertOperatorAccess() {
          /* ok */
        },
      },
      finance: {
        async reviewReceipt(_auth, receiptId) {
          return {
            id: receiptId,
            status: "Approved",
            reviewNote: null,
            reviewedAt: "2026-08-07T00:00:00.000Z",
          };
        },
      },
      loadEncounter: async (phase) => {
        phases.push(phase);
        return encounterFromCaseOutput(phase === "preflight" ? pre : post, `exec-${phase}`);
      },
    });
    assert.equal(result.ok, true);
    assert.deepEqual(phases, ["preflight", "post"]);
    if (result.ok) {
      assert.equal(result.preflight.executionId, "exec-preflight");
      assert.equal(result.post.executionId, "exec-post");
      assert.notEqual(
        result.preflight.caseOutput.interpretationSentence,
        result.post.caseOutput.interpretationSentence
      );
      assert.equal(result.sot.status, "Approved");
      assert.equal(result.post.encounter.explainability.headline, "after approve");
    }
  });

  it("6 — same CaseOutput facts produce same vocabulary / encounter projection", () => {
    const out = caseOutput({
      allow: ["approve_evidence", "reject_evidence"],
      forbid: ["create_payment_repair"],
    });
    assert.equal(vocabularyAllows(out, "approve_evidence"), true);
    assert.equal(vocabularyAllows(out, "approve_evidence"), true);
    assert.equal(vocabularyAllows(out, "reject_evidence"), true);
    const denied = caseOutput({
      allow: ["wait"],
      forbid: ["create_payment_repair"],
    });
    assert.equal(vocabularyAllows(denied, "approve_evidence"), false);
    assert.equal(vocabularyAllows(denied, "approve_evidence"), false);

    const a = projectCaseEncounter(out);
    const b = projectCaseEncounter(out);
    assert.deepEqual(a, b);
  });

  it("intent mapper rejects decision/token mismatch and tenant mismatch", () => {
    assert.throws(
      () =>
        mapReviewReceiptIntent(
          intent({ actionToken: "approve_evidence", decision: "reject" })
        ),
      /decision_token_mismatch/
    );
    assert.throws(
      () =>
        mapReviewReceiptIntent(
          intent({
            auth: { ...intent().auth, tenantId: "other" },
          })
        ),
      /tenant_mismatch/
    );
  });

  it("vocabulary gate blocks SoT when hint missing", async () => {
    let sotCalls = 0;
    const denied = caseOutput({
      allow: ["wait"],
      forbid: ["create_payment_repair"],
    });
    const result = await runReviewReceiptCommandBridge(intent(), {
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
      loadEncounter: async () => encounterFromCaseOutput(denied, "exec-preflight"),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.reason, "vocabulary_denied");
    }
    assert.equal(sotCalls, 0);
  });
});
