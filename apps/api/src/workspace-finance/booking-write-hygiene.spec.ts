import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("MR-P0-009 composite tenant write hygiene", () => {
  it("booking payment adapter raisePaidInTx uses updateMany with tenantId", () => {
    const src = readFileSync(join(here, "infrastructure/booking-payment.adapter.ts"), "utf8");
    assert.match(src, /operatorRegistration\.updateMany/);
    assert.match(src, /where:\s*\{\s*id:\s*registrationId,\s*tenantId\s*\}/);
    assert.doesNotMatch(src, /getBookingsRepository/);
    assert.match(src, /constructor\(private readonly bookings: BookingRepositoryPort\)/);
  });

  it("prisma bookings updatePaymentStatus uses updateMany with tenantId", () => {
    const src = readFileSync(
      join(here, "../bookings/prisma-bookings.repository.ts"),
      "utf8"
    );
    const fn = src.slice(src.indexOf("async updatePaymentStatus"));
    const body = fn.slice(0, fn.indexOf("\n  async "));
    assert.match(body, /operatorRegistration\.updateMany/);
    assert.match(body, /tenantId:\s*input\.tenantId/);
    assert.doesNotMatch(body, /operatorRegistration\.update\(\s*\{\s*where:\s*\{\s*id:/);
  });

  it("prisma finance payment/receipt writes use updateMany with tenantId", () => {
    const src = readFileSync(join(here, "infrastructure/prisma-finance.repository.ts"), "utf8");
    for (const method of ["async updateReceiptReview", "async markPaymentPaid", "async revertPaymentToPending"]) {
      const start = src.indexOf(method);
      assert.ok(start > 0, method);
      const body = src.slice(start, start + 900);
      assert.match(body, /updateMany/);
      assert.match(body, /tenantId/);
    }
  });

  it("finance-dependency-registry runtime does not import create-bookings-repository", () => {
    const src = readFileSync(join(here, "finance-dependency-registry.ts"), "utf8");
    assert.doesNotMatch(src, /create-bookings-repository/);
    assert.match(src, /createBookingPaymentPort/);
  });

  it("repair-handlers runtime does not import create-bookings-repository", () => {
    const src = readFileSync(join(here, "recon/repair-handlers.ts"), "utf8");
    assert.doesNotMatch(src, /create-bookings-repository/);
    assert.match(src, /createBookingPaymentPort/);
  });

});
