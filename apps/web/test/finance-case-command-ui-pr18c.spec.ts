/**
 * PR18-C — Single-tenant Command UI validation proofs (automated).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  failureRequiresMeaningRefresh,
  mapCommandHttpCodeToFailureClass,
  parseFinanceCaseCommandClientResult,
} from "../src/finance/finance-case-command-review-receipt";
import {
  FINANCE_CASE_COMMAND_UI_ENABLED_ENV,
  FINANCE_CASE_COMMAND_UI_TENANT_ENV,
  isFinanceCaseCommandUiEnabledForTenant,
} from "../src/finance/finance-case-command-ui-rollout";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(WEB_ROOT, "../..");
const TENANT = "00000000-0000-4000-8000-000000000003";
const OTHER = "00000000-0000-4000-8000-000000000004";

describe("PR18-C single-tenant command UI validation", () => {
  it("1 — rollout isolation fail-closed", () => {
    assert.equal(
      isFinanceCaseCommandUiEnabledForTenant(TENANT, {
        [FINANCE_CASE_COMMAND_UI_ENABLED_ENV]: "true",
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: TENANT,
      }),
      true
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
        [FINANCE_CASE_COMMAND_UI_TENANT_ENV]: "",
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
  });

  it("2 — failure classes: auth / stale / sot / reexecute never claim success", () => {
    const auth = parseFinanceCaseCommandClientResult(403, {
      error: { code: "CASE_COMMAND_AUTH_DENIED", message: "no" },
    });
    assert.equal(auth.ok, false);
    if (!auth.ok) {
      assert.equal(auth.failureClass, "auth_denied");
      assert.equal(auth.forceRefresh, false);
    }

    const stale = parseFinanceCaseCommandClientResult(409, {
      error: { code: "CASE_COMMAND_STALE", message: "stale" },
    });
    assert.equal(stale.ok, false);
    if (!stale.ok) {
      assert.equal(stale.failureClass, "concurrency_conflict");
      assert.equal(stale.forceRefresh, true);
    }

    const sot = parseFinanceCaseCommandClientResult(409, {
      error: { code: "CASE_COMMAND_SOT_REJECTED", message: "bad" },
    });
    assert.equal(sot.ok, false);
    if (!sot.ok) assert.equal(sot.failureClass, "sot_rejected");

    assert.equal(mapCommandHttpCodeToFailureClass("CASE_COMMAND_PROVIDER_UNAVAILABLE"), "provider_unavailable");
    assert.equal(mapCommandHttpCodeToFailureClass("CASE_COMMAND_REEXECUTE_FAILED"), "reexecute_failed");
    assert.equal(failureRequiresMeaningRefresh("reexecute_failed"), true);
    assert.equal(failureRequiresMeaningRefresh("provider_unavailable"), false);

    const reexec = parseFinanceCaseCommandClientResult(503, {
      error: { code: "CASE_COMMAND_REEXECUTE_FAILED", message: "postflight" },
    });
    assert.equal(reexec.ok, false);
    if (!reexec.ok) {
      assert.equal(reexec.forceRefresh, true);
    }
  });

  it("3 — classic receipts + smoke script + docs lock; no vocabulary expand", () => {
    const receipts = readFileSync(join(WEB_ROOT, "src/finance/finance-receipts-panel.tsx"), "utf8");
    assert.match(receipts, /\/api\/finance\/receipts\//);
    assert.doesNotMatch(receipts, /case\/commands\/review-receipt/);

    const smoke = readFileSync(
      join(REPO_ROOT, "scripts/pr18c-denali-command-ui-smoke.sh"),
      "utf8"
    );
    assert.match(smoke, /FINANCE_CASE_COMMAND_UI_TENANT/);
    assert.match(smoke, /FINANCE_CASE_ENCOUNTER_MODE=internal|INTERNAL_TENANTS/);
    assert.match(smoke, /case\/commands\/review-receipt/);
    assert.match(smoke, /CASE_COMMAND_STALE|stale_command/);
    assert.match(smoke, /READY_FOR_CONTROLLED_PRODUCTION|CONTINUE|HOLD/);
    assert.doesNotMatch(smoke, /capture|refund|settlement/i);

    const bridge = readFileSync(
      join(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_COMMAND_BRIDGE.md"),
      "utf8"
    );
    assert.match(bridge, /PR18-C/);
    assert.match(bridge, /Single-tenant/);

    const runbook = readFileSync(
      join(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_VALIDATION_RUNBOOK.md"),
      "utf8"
    );
    assert.match(runbook, /PR18-C/);
    assert.match(runbook, /pr18c-denali-command-ui-smoke/);

    const boundary = readFileSync(
      join(REPO_ROOT, "docs/phase-20/p7/appendices/FINANCE_CASE_INTERPRETER_BOUNDARY.md"),
      "utf8"
    );
    assert.match(boundary, /v48|PR18-C/);
  });
});
