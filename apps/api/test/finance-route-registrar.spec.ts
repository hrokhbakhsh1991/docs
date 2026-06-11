/**
 * Phase 10.4 — finance R1 routes dispatch via workspace registrar (not inline app.ts).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRequestListener } from "../src/app";
import { installHttpTestClient } from "./http-test-client";
import { installMemoryStorageDriverForDescribe } from "./test-helpers";

installMemoryStorageDriverForDescribe();

describe("finance route registrar (P4-T01)", () => {
  const client = installHttpTestClient(() => createRequestListener());

  it("GET /finance/reports/summary is handled (not 404)", async () => {
    const response = await client.requestJson("GET", "/finance/reports/summary", {
      headers: { "x-tenant-id": "00000000-0000-4000-8000-000000000001" },
    });
    assert.notEqual(response.status, 404);
  });
});
