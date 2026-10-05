import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  InMemoryFinanceRepository,
  resetInMemoryFinanceRepositoryForTests,
} from "./isolation/in-memory-finance.repository.ts";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const TENANT_B = "00000000-0000-4000-8000-0000000000bb";

describe("T05-CARD-RACE destination history", () => {
  beforeEach(() => resetInMemoryFinanceRepositoryForTests());

  it("keeps A receipt snapshot after the current destination advances to B", async () => {
    const repo = new InMemoryFinanceRepository(null);
    const a = await repo.putPaymentDestinationRevision({
      tenantId: TENANT_A,
      cardNumber: "1111222233334444",
      cardHolderName: "A",
    });
    const payment = await repo.createManualPayment({
      tenantId: TENANT_A,
      registrationId: "reg-a",
      amount: "100",
      currency: "IRR",
      method: "Manual",
      provider: "manual",
      status: "Pending",
    });
    const receipt = await repo.createReceipt({
      tenantId: TENANT_A,
      paymentId: payment.id,
      fileKey: "proof/a.jpg",
      destinationSnapshot: {
        revision: a.revision,
        cardNumber: a.cardNumber,
        cardHolderName: a.cardHolderName,
        bankName: a.bankName,
        instructions: a.instructions,
      },
      idempotencyKeyHash: "retry-a",
    });
    await repo.putPaymentDestinationRevision({
      tenantId: TENANT_A,
      cardNumber: "5555666677778888",
      cardHolderName: "B",
    });

    assert.equal(
      (await repo.findPaymentDestinationRevision(TENANT_A))?.cardNumber,
      "5555666677778888"
    );
    assert.equal(
      (await repo.findPaymentReceiptDestinationSnapshot(TENANT_A, receipt.id))?.cardNumber,
      "1111222233334444"
    );
    assert.equal(
      (await repo.createReceipt({
        tenantId: TENANT_A,
        paymentId: payment.id,
        fileKey: "proof/a.jpg",
        destinationSnapshot: {
          revision: a.revision,
          cardNumber: a.cardNumber,
          cardHolderName: a.cardHolderName,
          bankName: a.bankName,
          instructions: a.instructions,
        },
        idempotencyKeyHash: "retry-a",
      })).id,
      receipt.id
    );
  });

  it("fails closed for unknown and cross-tenant revisions", async () => {
    const repo = new InMemoryFinanceRepository(null);
    const a = await repo.putPaymentDestinationRevision({
      tenantId: TENANT_A,
      cardNumber: "1111222233334444",
      cardHolderName: "A",
    });
    assert.equal(await repo.findPaymentDestinationRevision(TENANT_B, a.revision), null);
    assert.equal(await repo.findPaymentDestinationRevision(TENANT_A, "not-known"), null);
  });
});
