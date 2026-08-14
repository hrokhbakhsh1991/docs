/**
 * PR15-A — Validation hardening proofs (allowlist, leakage, disabled, pilot, SoT independence).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { FINANCE_HTTP_ROUTE_MANIFEST } from "@app-tour/finance-http";

import type { CaseEncounterPresentation } from "./case-encounter-presentation.ts";
import {
  assertEncounterHttpNoForbiddenLeakage,
  assertFinanceCaseEncounterHttpOkKeys,
  FINANCE_CASE_ENCOUNTER_HTTP_OK_OPTIONAL_KEYS,
  FINANCE_CASE_ENCOUNTER_HTTP_OK_REQUIRED_KEYS,
} from "./encounter-http-ok-contract.ts";
import { isFinanceCaseEncounterEnabled } from "./finance-case-encounter-rollout.ts";
import { loadFinanceCaseEncounterHttp } from "./load-finance-case-encounter-http.ts";
import { assertPresentationBoundary } from "./to-case-encounter-presentation.ts";
import { isFinanceCaseShadowEnabled } from "../finance-case-feature-flag.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../../..");
const CONTRACTS = join(
  REPO_ROOT,
  "packages/finance-http-contracts/src/finance-case-encounter.contracts.ts"
);
const RUNBOOK = join(
  REPO_ROOT,
  "docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"
);

function operatorAuth(tenantId = "t1") {
  return {
    userId: "op-1",
    tenantId,
    role: "admin" as const,
    status: "ACTIVE" as const,
    workspaceId: "ws-1",
  };
}

function samplePresentation(): CaseEncounterPresentation {
  return {
    subjectId: "reg-1",
    subjectKind: "enrollment",
    caseKey: "enrollment:reg-1:primary",
    reading: "AWAITING_FINANCE",
    owner: "finance",
    lane: "daily",
    primaryPosture: "inspect",
    decisionReady: true,
    allow: ["approve_evidence", "reject_evidence"],
    forbid: ["create_payment_repair"],
    auditAltitude: false,
    explainability: {
      headline: "Evidence in review",
      reading: "AWAITING_FINANCE",
      owner: "finance",
      ownerSummary: "Finance owns evidence review",
      primaryPosture: "inspect",
      lane: "daily",
      decisionReady: true,
      auditAltitude: false,
    },
    confidence: {
      whyVisible: "v",
      whyMineOrNot: "m",
      ifIWait: "w",
      avoid: "a",
    },
    completeness: {
      completenessClass: "act_complete",
      actReady: true,
      waitComplete: false,
      inspectForced: false,
      escalateForced: false,
      displayToken: "act_complete",
    },
    discoveryAttention: null,
  };
}

describe("PR15-A Finance Case validation hardening", () => {
  it("1 — HTTP OK allowlist accepts commandCapability + optional meaningFingerprint", async () => {
    const presentation = samplePresentation();
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_ENABLED: "1" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: presentation,
        executionId: "exec-1",
        meaningFingerprint: "fp-test",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    assertFinanceCaseEncounterHttpOkKeys(result.body);
    assert.ok(result.body.commandCapability);
    assert.equal(result.body.meaningFingerprint, "fp-test");
    assert.deepEqual(result.body.commandCapability.supportedCommands, ["reviewReceipt"]);
    assertPresentationBoundary(result.body.encounter);
    assertEncounterHttpNoForbiddenLeakage(result.body);
    assert.ok(FINANCE_CASE_ENCOUNTER_HTTP_OK_REQUIRED_KEYS.includes("commandCapability"));
    assert.ok(FINANCE_CASE_ENCOUNTER_HTTP_OK_OPTIONAL_KEYS.includes("meaningFingerprint"));
  });

  it("2 — Presentation leakage prevention (CaseOutput / gateway ids)", async () => {
    const presentation: CaseEncounterPresentation = {
      ...samplePresentation(),
      discoveryAttention: {
        attentionClass: "reconciliation_attention",
        reasonCode: "GW_PAID_SOT_MISSING",
      },
    };
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: { FINANCE_CASE_ENCOUNTER_MODE: "full" },
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => ({
        encounter: presentation,
        executionId: "exec-leak",
      }),
    });
    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    assertFinanceCaseEncounterHttpOkKeys(result.body);
    assertEncounterHttpNoForbiddenLeakage(result.body);
    assert.doesNotMatch(JSON.stringify(result.body), /pi_secret|cus_secret|stripe/i);
    const contracts = readFileSync(CONTRACTS, "utf8");
    assert.match(contracts, /commandCapability/);
    assert.match(contracts, /meaningFingerprint/);
  });

  it("3 — Disabled mode zero Case execution", async () => {
    assert.equal(isFinanceCaseEncounterEnabled({}), false);
    assert.equal(isFinanceCaseShadowEnabled({}), false);
    let executed = 0;
    const result = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth(),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env: {},
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "x" };
      },
    });
    assert.equal(executed, 0);
    assert.notEqual(result.status, 200);
    if (result.status !== 200) {
      assert.equal(result.error.code, "CASE_ENCOUNTER_DISABLED");
    }
  });

  it("4 — Pilot tenant isolation", async () => {
    const env = {
      FINANCE_CASE_ENCOUNTER_MODE: "pilot",
      FINANCE_CASE_ENCOUNTER_PILOT_TENANTS: "pilot-a",
    };
    let executed = 0;
    const denied = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("other-tenant"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "x" };
      },
    });
    assert.equal(executed, 0);
    assert.notEqual(denied.status, 200);

    const allowed = await loadFinanceCaseEncounterHttp({
      auth: operatorAuth("pilot-a"),
      registrationId: "reg-1",
      counterpartyId: "cp",
      deps: {},
      env,
      authorization: { assertOperatorAccess() {} },
      warmFinanceService: async () => {},
      loadPresentation: async () => {
        executed += 1;
        return { encounter: samplePresentation(), executionId: "pilot-ok" };
      },
    });
    assert.equal(executed, 1);
    assert.equal(allowed.status, 200);
  });

  it("5 — FinanceService mutation path independence (static)", () => {
    const loadSrc = readFileSync(join(HERE, "load-finance-case-encounter-http.ts"), "utf8");
    assert.doesNotMatch(loadSrc, /reviewReceipt\(|createManualPayment\(|submitReceipt\(/);
    const rolloutSrc = readFileSync(join(HERE, "finance-case-encounter-rollout.ts"), "utf8");
    assert.match(rolloutSrc, /Never gates FinanceService mutations/);
  });

  it("6 — Validation smoke prep: finance routes + runbook discoverable", () => {
    const paths = FINANCE_HTTP_ROUTE_MANIFEST.map((r) => `${r.method} ${r.path}`);
    assert.ok(paths.includes("GET /finance/case/encounters/:registrationId"));
    assert.ok(paths.includes("POST /finance/case/commands/review-receipt"));
    assert.ok(paths.includes("POST /finance/payments/manual"));
    assert.ok(paths.includes("PATCH /finance/receipts/:receiptId/review"));
    const runbook = readFileSync(RUNBOOK, "utf8");
    assert.match(runbook, /Stage 1/);
    assert.match(runbook, /Stage 4/);
    assert.match(runbook, /FINANCE_CASE_ENCOUNTER_MODE=pilot/);
    assert.match(runbook, /Rollback procedure/);
  });
});
