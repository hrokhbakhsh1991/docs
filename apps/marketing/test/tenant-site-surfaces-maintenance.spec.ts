/**
 * P4-C — marketing maintenance when site_surfaces.marketing is false
 * @see docs/phase-17/platform-club-surfaces-config.mdoc (SF-07)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it } from "node:test";

import {
  isMarketingSurfaceEnabled,
  normalizeMarketingSiteSurfaces,
  resolveDevMarketingSiteSurfaces,
} from "../src/tenant/marketing-site-surfaces";

describe("tenant-site-surfaces-maintenance (P4-C SF-07)", () => {
  afterEach(() => {
    delete process.env.TOUR_OPS_DEV_MARKETING_SURFACE;
  });

  it("SF-07a marketing false surfaces disable catalog shell", () => {
    const surfaces = normalizeMarketingSiteSurfaces({ marketing: false, portal: true });
    assert.equal(isMarketingSurfaceEnabled(surfaces), false);
  });

  it("SF-07b dev override TOUR_OPS_DEV_MARKETING_SURFACE=false", () => {
    process.env.TOUR_OPS_DEV_MARKETING_SURFACE = "false";
    const surfaces = resolveDevMarketingSiteSurfaces();
    assert.equal(surfaces.marketing, false);
    assert.equal(surfaces.admin, true);
  });

  it("SF-07c layout gates maintenance page when marketing disabled", () => {
    const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
    assert.match(layout, /resolveMarketingSiteSurfacesForHost/);
    assert.match(layout, /isMarketingSurfaceEnabled/);
    assert.match(layout, /data-marketing-surface-maintenance/);
    assert.match(layout, /MaintenancePage/);
  });
});
