/**
 * Urban catalog intake idempotency key — stable replay (M17 P2)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildUrbanIntakeIdempotencyKey } from "../src/urban/build-urban-intake-idempotency-key";

describe("build-urban-intake-idempotency-key.spec.ts", () => {
  it("URB-INTAKE-IDEM-01 same inputs produce same key", () => {
    const input = {
      tenantId: "00000000-0000-4000-8000-000000000004",
      tourId: "00000000-0000-4000-8000-000000000041",
      email: "Smoke@Example.COM",
      actorUserId: "00000000-0000-4000-8000-000000000099",
    };
    const first = buildUrbanIntakeIdempotencyKey(input);
    const second = buildUrbanIntakeIdempotencyKey({
      ...input,
      email: "  smoke@example.com  ",
    });
    assert.equal(first, second);
    assert.match(first, /^catalog-urban-intake-[a-f0-9]{32}$/);
  });

  it("URB-INTAKE-IDEM-02 different actor produces different key", () => {
    const base = {
      tenantId: "00000000-0000-4000-8000-000000000004",
      tourId: "00000000-0000-4000-8000-000000000041",
      email: "smoke@example.com",
    };
    const a = buildUrbanIntakeIdempotencyKey({
      ...base,
      actorUserId: "00000000-0000-4000-8000-000000000099",
    });
    const b = buildUrbanIntakeIdempotencyKey({
      ...base,
      actorUserId: "00000000-0000-4000-8000-000000000098",
    });
    assert.notEqual(a, b);
  });
});
