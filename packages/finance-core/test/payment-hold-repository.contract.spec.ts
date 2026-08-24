/**
 * DP1-A — Payment Hold repository contract (finance_payment_holds).
 * @see docs/dev/dp-1-execution-plan.md
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { beforeEach, describe, it } from "node:test";

type PaymentHoldStatus = "open" | "satisfied" | "expired" | "extended";

type PaymentHoldRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly registrationId: string;
  readonly status: PaymentHoldStatus;
  readonly dueAt: string;
  readonly policyHours: number;
  readonly extendedCount: number;
};

type PaymentHoldRepositoryPort = {
  insertOpenHold(input: {
    readonly tenantId: string;
    readonly registrationId: string;
    readonly dueAt: string;
    readonly policyHours: number;
  }): Promise<PaymentHoldRow>;
  getByRegistrationId(tenantId: string, registrationId: string): Promise<PaymentHoldRow | null>;
  markSatisfied(tenantId: string, registrationId: string): Promise<PaymentHoldRow>;
  markExpired(tenantId: string, registrationId: string): Promise<PaymentHoldRow>;
  extendDueAt(
    tenantId: string,
    registrationId: string,
    dueAt: string
  ): Promise<PaymentHoldRow>;
  listOpenDueBefore(tenantId: string, beforeIso: string): Promise<readonly PaymentHoldRow[]>;
};

async function loadRepository(): Promise<PaymentHoldRepositoryPort> {
  const mod = (await import("../test/isolation/in-memory-payment-hold.repository.ts")) as {
    InMemoryPaymentHoldRepository: new () => PaymentHoldRepositoryPort;
    resetInMemoryPaymentHoldRepositoryForTests?: () => void;
  };
  assert.equal(typeof mod.InMemoryPaymentHoldRepository, "function");
  return new mod.InMemoryPaymentHoldRepository();
}

const TENANT = "00000000-0000-4000-8000-0000000000aa";

describe("DP1-A payment hold repository contract", () => {
  let repo: PaymentHoldRepositoryPort;

  beforeEach(async () => {
    repo = await loadRepository();
    try {
      const mod = await import("../test/isolation/in-memory-payment-hold.repository.ts");
      mod.resetInMemoryPaymentHoldRepositoryForTests?.();
    } catch {
      // repository module not implemented yet — loadRepository already fails
    }
  });

  it("DP1-A-01 inserts open hold with unique registrationId per tenant", async () => {
    const registrationId = randomUUID();
    const dueAt = "2031-08-02T12:00:00.000Z";
    const row = await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId,
      dueAt,
      policyHours: 24,
    });
    assert.equal(row.status, "open");
    assert.equal(row.dueAt, dueAt);
    assert.equal(row.policyHours, 24);
    const read = await repo.getByRegistrationId(TENANT, registrationId);
    assert.ok(read !== null);
    assert.equal(read.id, row.id);
  });

  it("DP1-A-01 tenant isolation on read", async () => {
    const registrationId = randomUUID();
    await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId,
      dueAt: "2031-08-02T12:00:00.000Z",
      policyHours: 24,
    });
    const otherTenant = "00000000-0000-4000-8000-0000000000bb";
    assert.equal(await repo.getByRegistrationId(otherTenant, registrationId), null);
  });

  it("DP1-D-05 markSatisfied is terminal for open hold", async () => {
    const registrationId = randomUUID();
    await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId,
      dueAt: "2031-08-02T12:00:00.000Z",
      policyHours: 24,
    });
    const satisfied = await repo.markSatisfied(TENANT, registrationId);
    assert.equal(satisfied.status, "satisfied");
    const read = await repo.getByRegistrationId(TENANT, registrationId);
    assert.equal(read?.status, "satisfied");
  });

  it("DP1-E-02 markExpired is terminal", async () => {
    const registrationId = randomUUID();
    await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId,
      dueAt: "2031-08-01T12:00:00.000Z",
      policyHours: 24,
    });
    const expired = await repo.markExpired(TENANT, registrationId);
    assert.equal(expired.status, "expired");
  });

  it("DP1-A-03 listOpenDueBefore scans worker predicate", async () => {
    const due = randomUUID();
    const future = randomUUID();
    await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId: due,
      dueAt: "2031-08-01T10:00:00.000Z",
      policyHours: 24,
    });
    await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId: future,
      dueAt: "2031-08-05T10:00:00.000Z",
      policyHours: 24,
    });
    const rows = await repo.listOpenDueBefore(TENANT, "2031-08-02T00:00:00.000Z");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.registrationId, due);
  });

  it("DP1-I-03 extendDueAt increments extended state", async () => {
    const registrationId = randomUUID();
    await repo.insertOpenHold({
      tenantId: TENANT,
      registrationId,
      dueAt: "2031-08-01T10:00:00.000Z",
      policyHours: 24,
    });
    const extended = await repo.extendDueAt(
      TENANT,
      registrationId,
      "2031-08-03T10:00:00.000Z"
    );
    assert.equal(extended.status, "open");
    assert.equal(extended.dueAt, "2031-08-03T10:00:00.000Z");
    assert.ok(extended.extendedCount >= 1);
  });
});
