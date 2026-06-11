/**
 * Phase 11.14 — tour clone BFF proxy (DEC-P11-012)
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildServerCloneTourApiPath,
  proxyTourCloneApiRequest,
} from "../src/tours/proxy-tour-clone-api.server";
import { buildServerCloneTourUrl } from "../src/tours/clone-tour-client";

const TOUR_ID = "00000000-0000-4000-8000-000000000099";

describe("proxy-tour-clone-api.spec.ts — Phase 11.14", () => {
  it("WEB-P11-14-01 proxy returns 401 without session", async () => {
    const response = await proxyTourCloneApiRequest(
      new Request(`http://localhost/api/tours/${TOUR_ID}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      { tourId: TOUR_ID }
    );
    assert.equal(response.status, 401);
    const body = (await response.json()) as Record<string, unknown>;
    const error = body.error as Record<string, unknown>;
    assert.equal(error.code, "AUTH_UNAUTHENTICATED");
  });

  it("WEB-P11-14-02 buildServerCloneTourUrl encodes tour id", () => {
    const path = buildServerCloneTourApiPath(TOUR_ID);
    assert.equal(path, `/api/tours/${TOUR_ID}/clone`);
    assert.equal(buildServerCloneTourUrl(TOUR_ID), path);
  });
});
