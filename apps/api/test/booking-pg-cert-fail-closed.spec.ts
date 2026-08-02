import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

describe("MR-P0-015 booking PG cert fail-closed", () => {
  it("bookings-http-postgres honest-skips when DATABASE_URL missing", () => {
    const src = readFileSync(join(here, "bookings-http-postgres.spec.ts"), "utf8");
    assert.match(src, /BOOKING_HTTP_POSTGRES_REQUIRES_DATABASE/);
    assert.match(src, /skip:\s*postgresSkip/);
    assert.doesNotMatch(src, /if\s*\(\s*!hasDatabase\s*\)\s*\{\s*throw/);
  });

  it("capacity postgres proofs honest-skip when DATABASE_URL missing", () => {
    const capacity = readFileSync(
      join(here, "../src/bookings/booking-capacity-postgres-proof.spec.ts"),
      "utf8"
    );
    const stress = readFileSync(
      join(here, "../src/bookings/booking-capacity-stress.postgres.spec.ts"),
      "utf8"
    );
    assert.match(capacity, /BOOKING_CAPACITY_POSTGRES_REQUIRES_DATABASE/);
    assert.match(stress, /BOOKING_CAPACITY_STRESS_REQUIRES_DATABASE/);
    assert.match(capacity, /skip:\s*postgresSkip/);
    assert.match(stress, /skip:\s*postgresSkip/);
  });

  it("p6 product gate requires DATABASE_URL for HTTP-PG DoD", () => {
    const gate = readFileSync(join(here, "../../../scripts/p6-denali-product-gate.sh"), "utf8");
    assert.match(gate, /DATABASE_URL required for Booking P6 DoD/);
  });
});
