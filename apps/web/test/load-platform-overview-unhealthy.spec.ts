import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  countUnhealthyFromSitesCheckBody,
  countUnhealthyFromSitesCheckResults,
} from "../src/platform/count-unhealthy-from-sites-check";

describe("load platform overview unhealthy", () => {
  it("counts failed surfaces", () => {
    assert.equal(
      countUnhealthyFromSitesCheckResults({
        marketing: { ok: true },
        portal: { ok: false },
        admin: { ok: false },
      }),
      2
    );
  });

  it("reads results wrapper", () => {
    assert.equal(
      countUnhealthyFromSitesCheckBody({
        results: {
          marketing: { ok: false },
          portal: { ok: true },
          admin: { ok: true },
        },
      }),
      1
    );
  });
});
