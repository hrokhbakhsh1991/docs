import assert from "node:assert/strict";
import { describe, it } from "node:test";

const BOOKING_ID = "00000000-0000-4000-8000-000000000001";

describe("booking-approve-actions-logic.spec.ts", () => {
  it("rejects invalid booking ids", async () => {
    const { approveBookingWithoutPayment } = await import(
      "../src/features/bookings/booking-approve-actions-logic"
    );
    await assert.rejects(
      () => approveBookingWithoutPayment("short"),
      /BOOKINGS_APPROVE_INVALID_ID/
    );
  });

  it("approves then zeros obligation — no cash receipt path", async () => {
    const calls: { method: string; url: string; body?: unknown }[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" && init.body.length > 0
          ? JSON.parse(init.body)
          : undefined;
      calls.push({ method, url, body });
      if (url.includes("/approve") && method === "POST") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes("/obligation-override") && method === "PUT") {
        assert.equal((body as { obligationMinor: string }).obligationMinor, "0");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    try {
      const { approveBookingWithoutPayment } = await import(
        "../src/features/bookings/booking-approve-actions-logic"
      );
      const result = await approveBookingWithoutPayment(BOOKING_ID);
      assert.equal(result.registrationId, BOOKING_ID);
      assert.equal(calls.length, 2);
      assert.match(calls[0]!.url, /\/approve$/);
      assert.equal(calls[0]!.method, "POST");
      assert.match(calls[1]!.url, /obligation-override/);
      assert.equal(calls[1]!.method, "PUT");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
