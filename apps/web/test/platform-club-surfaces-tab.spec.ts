/**
 * P4-C — Super Admin Sites tab surface badges
 * @see docs/phase-17/platform-club-surfaces-config.mdoc (SF-01…SF-04)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("platform-club-surfaces-tab (P4-C SF-01…04)", () => {
  it("SF-01 Sites tab renders data-platform-club-sites", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-sites.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-platform-club-sites/);
    assert.match(source, /data-tab="sites"/);
  });

  it("SF-02 three surface rows present", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-sites.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-platform-surface=\{key\}/);
    assert.match(source, /\["admin", "marketing", "portal"\]/);
  });

  it("SF-03 each row shows enabled badge", () => {
    const source = readFileSync(
      new URL("../src/platform/club-detail/tab-sites.tsx", import.meta.url),
      "utf8"
    );
    assert.match(source, /data-platform-surface-badge/);
    assert.match(source, /enabled/);
    assert.match(source, /disabled/);
  });

  it("SF-04 URLs match provision response shape via sites prop", () => {
    const types = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail.types.ts", import.meta.url),
      "utf8"
    );
    const client = readFileSync(
      new URL("../src/platform/club-detail/platform-club-detail-client.tsx", import.meta.url),
      "utf8"
    );
    assert.match(types, /siteSurfaces/);
    assert.match(types, /sites:\s*\{/);
    assert.match(client, /siteSurfaces=\{detail\.siteSurfaces\}/);
  });
});
