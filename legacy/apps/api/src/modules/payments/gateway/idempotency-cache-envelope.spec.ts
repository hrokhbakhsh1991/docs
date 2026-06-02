import assert from "node:assert/strict";
import test from "node:test";
import { SecurityIsolationBreachException } from "../../../common/errors/security-isolation-breach.exception";
import {
  assertIdempotencyTenantScope,
  unwrapIdempotencyCacheValue,
  wrapIdempotencyCacheValue,
} from "./idempotency-cache-envelope";

test("unwrapIdempotencyCacheValue returns value for matching tenant", () => {
  const envelope = wrapIdempotencyCacheValue("tenant-a", { ok: true });
  assert.deepEqual(unwrapIdempotencyCacheValue("tenant-a", envelope), { ok: true });
});

test("unwrapIdempotencyCacheValue rejects cross-tenant envelope", () => {
  const envelope = wrapIdempotencyCacheValue("tenant-a", { ok: true });
  assert.throws(
    () => unwrapIdempotencyCacheValue("tenant-b", envelope),
    (error: unknown) => error instanceof SecurityIsolationBreachException
  );
});

test("unwrapIdempotencyCacheValue rejects legacy un-enveloped payloads", () => {
  assert.throws(
    () => unwrapIdempotencyCacheValue("tenant-a", { ok: true }),
    (error: unknown) => error instanceof SecurityIsolationBreachException
  );
});

test("assertIdempotencyTenantScope compares tenant ids case-insensitively", () => {
  assert.doesNotThrow(() =>
    assertIdempotencyTenantScope("AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
  );
});
