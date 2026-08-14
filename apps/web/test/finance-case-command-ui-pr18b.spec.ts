/**
 * PR18-B — reviewReceipt Command UI proofs.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildReviewReceiptCommandBody,
  canSubmitCommandFromPhase,
  decisionForCommandToken,
  failureRequiresMeaningRefresh,
  mapCommandHttpCodeToFailureClass,
  parseFinanceCaseCommandClientResult,
  requiresCommandConfirmation,
  FINANCE_CASE_COMMAND_REVIEW_RECEIPT_BFF_PATH,
} from "../src/finance/finance-case-command-review-receipt";
import {
  isFinanceCaseCommandUiEnabledForTenant,
  FINANCE_CASE_COMMAND_UI_ENABLED_ENV,
  FINANCE_CASE_COMMAND_UI_TENANT_ENV,
} from "../src/finance/finance-case-command-ui-rollout";
import {
  commandCapabilityGrantsPermission,
  projectCommandBridgeUxDiscovery,
} from "../src/finance/finance-command-bridge-ux-architecture";
import type { CaseCommandCapabilityContract } from "@app-tour/finance-case-encounter-ui";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const TENANT = "00000000-0000-4000-8000-000000000003";
const OTHER = "00000000-0000-4000-8000-000000000004";

describe("PR18-B reviewReceipt command UI", () => {
  it("1 — command discovery from capability; never grants permission", () => {
    const capability: CaseCommandCapabilityContract = {
      supportedCommands: ["reviewReceipt"],
      reviewReceipt: {
        availableTokens: ["approve_evidence", "reject_evidence"],
        endpoint: "/finance/case/commands/review-receipt",
      },
    };
    const discovery = projectCommandBridgeUxDiscovery(capability);
    assert.deepEqual(discovery.availableTokens, ["approve_evidence", "reject_evidence"]);
    assert.equal(discovery.grantsPermission, false);
    assert.equal(discovery.mayExecute, false);
    assert.equal(commandCapabilityGrantsPermission(capability), false);
    assert.equal(decisionForCommandToken("approve_evidence"), "approve");
    assert.equal(decisionForCommandToken("reject_evidence"), "reject");
  });

  it("2 — confirmation required before submit", () => {
    assert.equal(canSubmitCommandFromPhase("idle"), false);
    assert.equal(canSubmitCommandFromPhase("select"), false);
    assert.equal(canSubmitCommandFromPhase("confirm"), true);
    assert.equal(canSubmitCommandFromPhase("submitting"), false);
    assert.equal(requiresCommandConfirmation("confirm"), true);
    assert.equal(requiresCommandConfirmation("select"), false);
  });

  it("3 — success parse + failure classes force refresh when required", () => {
    const body = buildReviewReceiptCommandBody({
      caseKey: "enrollment:reg:primary",
      executionId: "exec-1",
      meaningFingerprint: "fp-1",
      token: "approve_evidence",
      registrationId: "reg-1",
      counterpartyId: "cp-1",
      receiptId: "rcpt-1",
    });
    assert.equal(body.action.command, "reviewReceipt");
    assert.equal(body.action.decision, "approve");
    assert.equal(body.source.encounterExecutionId, "exec-1");
    assert.equal(body.source.encounterVersionHint, "fp-1");
    assert.doesNotMatch(JSON.stringify(body), /CaseOutput|FactSnapshot|FinanceService/);

    const ok = parseFinanceCaseCommandClientResult(200, {
      executionId: "exec-2",
      meaningFingerprint: "fp-2",
      encounter: { caseKey: "enrollment:reg:primary" },
    });
    assert.equal(ok.ok, true);
    if (ok.ok) assert.equal(ok.executionId, "exec-2");

    assert.equal(mapCommandHttpCodeToFailureClass("CASE_COMMAND_AUTH_DENIED"), "auth_denied");
    assert.equal(mapCommandHttpCodeToFailureClass("CASE_COMMAND_STALE"), "concurrency_conflict");
    assert.equal(mapCommandHttpCodeToFailureClass("CASE_COMMAND_SOT_REJECTED"), "sot_rejected");
    assert.equal(failureRequiresMeaningRefresh("concurrency_conflict"), true);
    assert.equal(failureRequiresMeaningRefresh("reexecute_failed"), true);
    assert.equal(failureRequiresMeaningRefresh("auth_denied"), false);

    const stale = parseFinanceCaseCommandClientResult(409, {
      error: { code: "CASE_COMMAND_STALE", message: "stale" },
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.failureClass, "concurrency_conflict");
      assert.equal(stale.forceRefresh, true);
    }

    const auth = parseFinanceCaseCommandClientResult(403, {
      error: { code: "CASE_COMMAND_AUTH_DENIED", message: "nope" },
    });
    assert.equal(auth.ok, false);
    if (!auth.ok) {
      assert.equal(auth.failureClass, "auth_denied");
      assert.equal(auth.forceRefresh, false);
    }
  });

  it("4 — rollout fail-closed single tenant; UI posts BFF only", () => {
    assert.equal(isFinanceCaseCommandUiEnabledForTenant(TENANT, {}), false);
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
      }),
      false
    );
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: `${TENANT},${OTHER}`,
      }),
      false
    );
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(OTHER, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
      }),
      false
    );
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
      }),
      true
    );

    const ui = readFileSync(
      join(WEB_ROOT, "src/finance/finance-case-command-review-receipt-ui.tsx"),
      "utf8"
    );
    assert.match(ui, /FINANCE_CASE_COMMAND_REVIEW_RECEIPT_BFF_PATH/);
    assert.doesNotMatch(ui, /FinanceService|runReviewReceiptCommandBridge|from\s+["']@app-tour\/finance-core/);
    assert.doesNotMatch(ui, /CaseOutput|FactSnapshot/);
    assert.match(ui, /finance-case-command-confirm/);
    assert.match(ui, /onForceMeaningRefresh/);
    assert.equal(
      FINANCE_CASE_COMMAND_REVIEW_RECEIPT_BFF_PATH,
      "/api/finance/case/commands/review-receipt"
    );

    const bff = readFileSync(
      join(WEB_ROOT, "app/api/finance/case/commands/review-receipt/route.ts"),
      "utf8"
    );
    assert.match(bff, /proxyFinanceApiPost/);
    assert.match(bff, /isFinanceCaseCommandUiEnabledForTenant/);
    assert.doesNotMatch(bff, /FinanceService|finance-core/);
  });

  it("5 — classic receipts panel remains; Meaning wires flagged Command UI; docs lock", () => {
    const receipts = readFileSync(join(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(receipts, /\/api\/finance\/receipts\//);
    assert.match(receipts, /FINANCE_RECEIPTS_TEST_IDS|finance-receipts/);
    assert.doesNotMatch(receipts, /case\/commands\/review-receipt/);

    const center = readFileSync(
      join(WEB_ROOT, "app/(app)/finance/finance-command-center.tsx"),
      "utf8"
    );
    assert.match(center, /FinanceReceiptsPanel/);
    assert.match(center, /commandUiEnabled/);
    assert.match(center, /FinanceCommercialMeaningEmbed/);

    const embed = readFileSync(
      join(WEB_ROOT, "src/finance/finance-commercial-meaning-embed.tsx"),
      "utf8"
    );
    assert.match(embed, /FinanceCaseCommandReviewReceiptUi/);
    assert.match(embed, /reloadToken/);
    assert.doesNotMatch(embed, /patchEncounter|CaseOutput|FactSnapshot/);
    assert.match(embed, /No optimistic Meaning/);

    const bridgeDoc = readFileSync(
      join(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md"),
      "utf8"
    );
    assert.match(bridgeDoc, /PR18-B/);
    assert.match(bridgeDoc, /FINANCE_CASE_COMMAND_UI_ENABLED/);
    assert.match(bridgeDoc, /READY_FOR_INTERNAL_COMMAND_ROLLOUT|HOLD_FOR_FIX/);

    const opDoc = readFileSync(
      join(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_OPERATOR_EXPERIENCE.md"),
      "utf8"
    );
    assert.match(opDoc, /PR18-B/);
    assert.match(opDoc, /reviewReceipt/);
  });
});
