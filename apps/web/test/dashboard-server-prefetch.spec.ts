import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

describe("dashboard-server-prefetch.spec.ts", () => {
  it("DASH-01 dashboard page prefetches widget data on the server", () => {
    const pageSource = readFileSync(resolve(WEB_ROOT, "app/(app)/dashboard/page.tsx"), "utf8");
    assert.match(pageSource, /fetchDashboardServerPrefetch/);
    assert.match(pageSource, /initialPrefetch/);
  });

  it("DASH-02 tours widget skips client fetch when initialTours is provided", () => {
    const widgetSource = readFileSync(
      resolve(WEB_ROOT, "src/admin/dashboard/dashboard-tours-widget.tsx"),
      "utf8"
    );
    assert.match(widgetSource, /initialTours/);
    assert.match(widgetSource, /initialTours === null/);
  });
});
