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

  it("zeros obligation before approval — no cash receipt path", async () => {
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
      assert.match(calls[0]!.url, /obligation-override/);
      assert.equal(calls[0]!.method, "PUT");
      assert.match(calls[1]!.url, /\/approve$/);
      assert.equal(calls[1]!.method, "POST");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("does not approve when the obligation override fails", async () => {
    const calls: { method: string; url: string }[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      calls.push({ method: init?.method ?? "GET", url: String(input) });
      return new Response("failed", { status: 500 });
    }) as typeof fetch;

    try {
      const { approveBookingWithoutPayment } = await import(
        "../src/features/bookings/booking-approve-actions-logic"
      );
      await assert.rejects(
        () => approveBookingWithoutPayment(BOOKING_ID),
        /SET_OBLIGATION_OVERRIDE_HTTP_500/
      );
      assert.equal(calls.length, 1);
      assert.match(calls[0]!.url, /obligation-override/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("reports approval failure after a successful waiver without retrying approval", async () => {
    const calls: { method: string; url: string }[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({ method, url });
      if (url.includes("/obligation-override") && method === "PUT") {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes("/approve") && method === "POST") {
        return new Response("capacity full", { status: 409 });
      }
      return new Response("not found", { status: 404 });
    }) as typeof fetch;

    try {
      const { approveBookingWithoutPayment } = await import(
        "../src/features/bookings/booking-approve-actions-logic"
      );
      await assert.rejects(
        () => approveBookingWithoutPayment(BOOKING_ID),
        /BOOKINGS_APPROVE_HTTP_409/
      );
      assert.equal(calls.length, 2);
      assert.match(calls[0]!.url, /obligation-override/);
      assert.match(calls[1]!.url, /\/approve$/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
