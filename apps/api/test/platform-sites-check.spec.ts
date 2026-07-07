import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { countUnhealthySiteChecks } from "../src/platform/check-tenant-sites-health.ts";

describe("platform sites check", () => {
  it("3 results ok boolean", () => {
    const source = readFileSync(
      new URL("../src/routes/platform/tenants-sites-check.ts", import.meta.url),
      "utf8"
    );
    assert.match(source, /checkTenantSitesHealth/);
    assert.match(source, /results/);

    const unhealthy = countUnhealthySiteChecks({
      marketing: { url: "https://a.test", ok: true, status: 200 },
      portal: { url: "https://b.test", ok: false, status: 503 },
      admin: { url: "https://c.test", ok: true, status: 200 },
    });
    assert.equal(unhealthy, 1);
  });
});
