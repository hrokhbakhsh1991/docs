import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("tours-list-server-prefetch.spec.ts", () => {
  it("TOURS-01 tours page prefetches list on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/tours/page.tsx"), "utf8");
    assert.match(pageSource, /fetchToursListServer/);
    assert.match(pageSource, /initialToursList/);
  });

  it("TOURS-02 tours client skips first fetch when initialToursList is provided", () => {
    const clientSource = readFileSync(resolve(WEB_ROOT, "app/(app)/tours/tours-page-client.tsx"), "utf8");
    assert.match(clientSource, /initialToursList/);
    assert.match(clientSource, /skipInitialFetchRef/);
  });
});
