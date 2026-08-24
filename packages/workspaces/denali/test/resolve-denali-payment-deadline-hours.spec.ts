/**
 * DP1-B — payment deadline policy resolution (DEN-PROD-01).
 * @see docs/dev/dp-1-execution-plan.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

type ResolveInput = {
  readonly tourCanonical?: Readonly<Record<string, unknown>> | null;
  readonly workspacePolicyHours?: number | null;
  readonly workspaceManualNoExpiry?: boolean;
};

type ResolverModule = {
  resolveDenaliPaymentDeadlineHours(input: ResolveInput): number | null;
  computeDenaliPaymentDueAt(input: {
    readonly approvedAt: string;
    readonly policyHours: number;
  }): string;
};

async function loadResolver(): Promise<ResolverModule> {
  const mod = (await import("../src/finance/resolve-denali-payment-deadline-hours.ts")) as ResolverModule;
  assert.equal(typeof mod.resolveDenaliPaymentDeadlineHours, "function");
  assert.equal(typeof mod.computeDenaliPaymentDueAt, "function");
  return mod;
}

describe("DP1-B resolveDenaliPaymentDeadlineHours", () => {
  it("DP1-B-01 defaults to 24h workspace policy", async () => {
    const { resolveDenaliPaymentDeadlineHours } = await loadResolver();
    assert.equal(resolveDenaliPaymentDeadlineHours({ tourCanonical: { data: {} } }), 24);
    assert.equal(resolveDenaliPaymentDeadlineHours({ tourCanonical: null }), 24);
  });

  it("DP1-B-01 reads tour pricing.paymentDeadlineHours override", async () => {
    const { resolveDenaliPaymentDeadlineHours } = await loadResolver();
    assert.equal(
      resolveDenaliPaymentDeadlineHours({
        tourCanonical: { data: { pricing: { paymentDeadlineHours: 48 } } },
      }),
      48
    );
    assert.equal(
      resolveDenaliPaymentDeadlineHours({
        tourCanonical: { pricing: { paymentDeadlineHours: 6 } },
      }),
      6
    );
  });

  it("DP1-B-01 workspace policy hours override root when tour inherits", async () => {
    const { resolveDenaliPaymentDeadlineHours } = await loadResolver();
    assert.equal(
      resolveDenaliPaymentDeadlineHours({
        tourCanonical: { data: { pricing: {} } },
        workspacePolicyHours: 12,
      }),
      12
    );
  });

  it("DP1-B-01 manual no-expiry only when tour null hours AND workspace manual flag", async () => {
    const { resolveDenaliPaymentDeadlineHours } = await loadResolver();
    assert.equal(
      resolveDenaliPaymentDeadlineHours({
        tourCanonical: { data: { pricing: { paymentDeadlineHours: null } } },
        workspaceManualNoExpiry: true,
      }),
      null
    );
    assert.equal(
      resolveDenaliPaymentDeadlineHours({
        tourCanonical: { data: { pricing: { paymentDeadlineHours: null } } },
        workspaceManualNoExpiry: false,
      }),
      24
    );
  });

  it("DP1-B-02 dueAt = approvedAt + hours UTC (DST-safe instant)", async () => {
    const { computeDenaliPaymentDueAt } = await loadResolver();
    const approvedAt = "2031-03-29T01:30:00.000Z";
    assert.equal(computeDenaliPaymentDueAt({ approvedAt, policyHours: 24 }), "2031-03-30T01:30:00.000Z");
  });

  it("DP1-B-03 rejects non-positive tour override", async () => {
    const { resolveDenaliPaymentDeadlineHours } = await loadResolver();
    assert.throws(
      () =>
        resolveDenaliPaymentDeadlineHours({
          tourCanonical: { data: { pricing: { paymentDeadlineHours: 0 } } },
        }),
      /paymentDeadlineHours/
    );
  });
});
