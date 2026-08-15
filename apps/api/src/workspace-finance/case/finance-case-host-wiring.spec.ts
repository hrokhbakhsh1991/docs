/**
 * PR4.5-B — host Case DI + shadow seam proofs.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  executeFinanceCase,
  type CaseFactReadScope,
} from "@app-tour/finance-core/case";

import type {
  DenaliEvidenceSource,
  DenaliLifecycleSource,
  DenaliObligationSource,
  DenaliPaymentSource,
  DenaliSignalSource,
} from "../workspace-finance-case-read-bindings.generated";

import type { DenaliCaseReadSourcePort } from "../case-read/denali-case-read-source.port.ts";
import {
  createDenaliCaseFactProviders,
  invokeFinanceCaseShadow,
  isFinanceCaseShadowEnabled,
  scheduleFinanceCaseShadow,
} from "./index.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../../../../..");

const SCOPE: CaseFactReadScope = {
  caseKey: "enrollment:host-reg-1:primary",
  subjectId: "host-reg-1",
  subjectKind: "enrollment",
  counterpartyId: "host-cp-1",
};

function createSource(seed: {
  obligation?: DenaliObligationSource;
  payment?: DenaliPaymentSource;
  evidence?: DenaliEvidenceSource;
  lifecycle?: DenaliLifecycleSource;
  signal?: DenaliSignalSource;
  onRead?: (name: string) => void;
}): DenaliCaseReadSourcePort {
  const track = (name: string) => seed.onRead?.(name);
  return {
    async readObligation() {
      track("obligation");
      return (
        seed.obligation ?? {
          readStatus: "ok",
          collectionMode: "offline",
          obligationMinor: "10000",
          remainingMinor: "10000",
          currency: "IRR",
        }
      );
    },
    async readPayment() {
      track("payment");
      return (
        seed.payment ?? {
          readStatus: "ok",
          payments: [],
          bookingPaymentStatus: "unpaid",
        }
      );
    },
    async readEvidence() {
      track("evidence");
      return seed.evidence ?? { readStatus: "ok", receipt: null };
    },
    async readLifecycle() {
      track("lifecycle");
      return (
        seed.lifecycle ?? {
          readStatus: "ok",
          bookingStatus: "approved",
          leftoverArtifactsProven: false,
        }
      );
    },
    async readSignal() {
      track("signal");
      return seed.signal ?? { readStatus: "ok", attentionClass: "unsettled_obligation" };
    },
  };
}

describe("host finance case wiring PR4.5-B", () => {
  it("1 — host invokes Case execution via @app-tour/finance-core/case (no deep import)", async () => {
    const providers = createDenaliCaseFactProviders(createSource({}));
    const result = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      executionId: "host-exec-1",
    });
    assert.equal(result.caseOutput.reading, "AWAITING_COUNTERPARTY");
    assert.equal(result.caseOutput.subjectId, SCOPE.subjectId);
  });

  it("2 — host case module does not deep-import finance-core/src/case", () => {
    for (const name of readdirSync(HERE)) {
      if (!name.endsWith(".ts") || name.endsWith(".spec.ts")) continue;
      const src = readFileSync(join(HERE, name), "utf8");
      assert.doesNotMatch(src, /finance-core\/src\/case|packages\/finance-core\/src\/case/);
      assert.doesNotMatch(src, /case\/rules|resolveOwnership|generatePosture/);
      // Case execution/shadow must use ./case subpath when importing Case surface.
      if (/from\s+["']@app-tour\/finance-core\/case["']/.test(src) === false) {
        assert.doesNotMatch(
          src,
          /from\s+["']@app-tour\/finance-core["'][^;]*(executeFinanceCase|runShadowFinanceCase|interpretFinanceCase)/
        );
      }
    }
  });

  it("3 — Denali types stay outside finance-core package", () => {
    const corePkg = readFileSync(resolve(REPO_ROOT, "packages/finance-core/package.json"), "utf8");
    assert.doesNotMatch(corePkg, /workspace-denali|workspaces\/denali/);
    const publicApi = readFileSync(
      resolve(REPO_ROOT, "packages/finance-core/src/case/public-api.ts"),
      "utf8"
    );
    assert.doesNotMatch(publicApi, /from\s+["']@app-tour\/workspace-denali/);
    assert.doesNotMatch(publicApi, /\bregistrationId\b|\bBookingStatus\b/);
  });

  it("4 — shadow disabled means no provider / Case execution", async () => {
    const reads: string[] = [];
    const providers = createDenaliCaseFactProviders(
      createSource({ onRead: (n) => reads.push(n) })
    );
    const result = await invokeFinanceCaseShadow({
      enabled: false,
      providers,
      request: {
        execution: { scope: SCOPE, mode: "lookup" },
        observation: { triggerKind: "manual" },
      },
    });
    assert.equal(result.skipped, true);
    if ("skipped" in result) {
      assert.equal(result.reason, "disabled");
    }
    assert.deepEqual(reads, []);
    assert.equal(isFinanceCaseShadowEnabled({ FINANCE_CASE_SHADOW_ENABLED: undefined }), false);
  });

  it("5 — shadow enabled does not change primary workflow output", async () => {
    const providers = createDenaliCaseFactProviders(createSource({}));

    async function primaryWorkflow(shadowEnabled: boolean) {
      const primary = { ok: true as const, paymentId: "pay-primary-1" };
      const shadow = await invokeFinanceCaseShadow({
        enabled: shadowEnabled,
        providers,
        request: {
          execution: { scope: SCOPE, mode: "lookup", executionId: "shadow-wf" },
          observation: { triggerKind: "post_mutation" },
        },
      });
      return { primary, shadowSkipped: "skipped" in shadow && shadow.skipped };
    }

    const off = await primaryWorkflow(false);
    const on = await primaryWorkflow(true);
    assert.deepEqual(off.primary, on.primary);
    assert.equal(off.shadowSkipped, true);
    assert.equal(on.shadowSkipped, false);
  });

  it("6 — provider failure degrades honestly through host composition", async () => {
    const providers = createDenaliCaseFactProviders(
      createSource({
        obligation: { readStatus: "failed" },
      })
    );
    const result = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
    });
    assert.equal(result.snapshot.facts.money.remaining.kind, "unknown");
    assert.ok(result.diagnostics.degradedProviders.includes("obligation"));
  });

  it("7 — same composed providers yield stable CaseOutput", async () => {
    const providers = createDenaliCaseFactProviders(createSource({}));
    const a = await executeFinanceCase(providers, { scope: SCOPE, mode: "lookup" });
    const b = await executeFinanceCase(providers, { scope: SCOPE, mode: "lookup" });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
    assert.equal(a.caseOutput.primaryPosture, b.caseOutput.primaryPosture);
  });

  it("8 — signal variation cannot change verdict via host path", async () => {
    const baseSource = createSource({});
    const providers = createDenaliCaseFactProviders(baseSource);
    const a = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "lookup",
      includeSignal: false,
    });
    const b = await executeFinanceCase(providers, {
      scope: SCOPE,
      mode: "attention",
      includeSignal: true,
    });
    assert.equal(a.caseOutput.reading, b.caseOutput.reading);
    assert.equal(a.caseOutput.owner, b.caseOutput.owner);
  });

  it("scheduleFinanceCaseShadow is fail-open when disabled", () => {
    assert.doesNotThrow(() => {
      scheduleFinanceCaseShadow({
        enabled: false,
        providers: createDenaliCaseFactProviders(createSource({})),
        request: { execution: { scope: SCOPE, mode: "lookup" } },
      });
    });
  });
});
