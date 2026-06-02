import assert from "node:assert/strict";
import test from "node:test";

import { assertOutboundUrlsInOutboxPayload } from "../../src/modules/outbox/repositories/assert-outbound-urls-in-outbox-payload";
import { EgressUrlForbiddenError } from "@repo/security/egress-url";

test("assertOutboundUrlsInOutboxPayload allows payloads without outbound URLs", async () => {
  await assertOutboundUrlsInOutboxPayload({
    registrationId: "reg-1",
    note: "no urls here",
  });
});

test("assertOutboundUrlsInOutboxPayload blocks private webhook URLs", async () => {
  let caught: unknown;
  try {
    await assertOutboundUrlsInOutboxPayload({
      webhookUrl: "http://127.0.0.1/internal",
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof EgressUrlForbiddenError);
});

test("assertOutboundUrlsInOutboxPayload validates nested callback URLs", async () => {
  let caught: unknown;
  try {
    await assertOutboundUrlsInOutboxPayload({
      envelope: {
        callbackUrl: "http://169.254.169.254/latest/meta-data",
      },
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof EgressUrlForbiddenError);
});
