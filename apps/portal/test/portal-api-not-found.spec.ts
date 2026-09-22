import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GET } from "../app/api/[...path]/route";

describe("portal API not-found fallback", () => {
  it("returns a JSON 404 instead of the global HTML 500", async () => {
    const response = GET();

    assert.equal(response.status, 404);
    assert.equal(response.headers.get("content-type"), "application/json");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), {
      ok: false,
      error: { code: "NOT_FOUND", message: "API route not found" },
    });
  });
});
