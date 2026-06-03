import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";

import type { TourAuthHeaders } from "@app-tour/workspace-sdk";

import { FetchTourClient } from "../src/tours/fetch-tour-client";

const auth: TourAuthHeaders = {
  "x-tenant-id": "tenant-a",
  "x-authenticated-tenant-id": "tenant-a",
  "x-user-id": "u1",
  "x-actor-role": "admin",
  "x-membership-status": "ACTIVE",
  "x-workspace-id": "ws-1",
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

describe("FetchTourClient", () => {
  it("POST /tours with auth headers and payload", async () => {
    let capturedUrl = "";
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = async (input, init) => {
      capturedUrl = String(input);
      capturedInit = init;
      return new Response(
        JSON.stringify({
          id: "tour-1",
          tenantId: "tenant-a",
          canonical: { schemaVersion: 1, roots: ["basics"], data: {} },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    };

    const client = new FetchTourClient("http://127.0.0.1:3001");
    const record = await client.createTour(
      { data: { basics: { title: "A" }, details: { summary: "" } } },
      auth,
    );

    assert.equal(capturedUrl, "http://127.0.0.1:3001/tours");
    assert.equal(capturedInit?.method, "POST");
    assert.equal((capturedInit?.headers as Record<string, string>)["x-tenant-id"], "tenant-a");
    assert.equal(record.id, "tour-1");
  });
});
