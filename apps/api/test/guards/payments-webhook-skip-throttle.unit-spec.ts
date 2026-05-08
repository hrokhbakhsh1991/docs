import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

/**
 * Regression guard: NestJS ThrottlerGuard evaluates every named throttler unless skipped.
 * Webhook controller must skip `public-registration` so bursts do not exhaust registration limits.
 */
test("PaymentsWebhookController skips public-registration throttler bucket", () => {
  const path = join(__dirname, "../../src/modules/payments/payments.controller.ts");
  const src = readFileSync(path, "utf8");
  assert.ok(
    src.includes("@SkipThrottle({ \"public-registration\": true })"),
    "expected @SkipThrottle({ \"public-registration\": true }) on webhook controller"
  );
  assert.ok(
    src.includes("PaymentsWebhookController"),
    "expected PaymentsWebhookController in payments.controller.ts"
  );
});
