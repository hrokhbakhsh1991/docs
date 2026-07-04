/**
 * HOME-UNIT-03 — empty catalogItems must not render latest block hook.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";
import { FULL_LANDING } from "./home-landing-fixtures";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("home-fail-soft.spec.ts — HOME-UNIT-03", () => {
  it("resolveHomeSectionVisibility hides latest when catalogItems is empty", () => {
    const visibility = resolveHomeSectionVisibility(FULL_LANDING, 0, 0, 0);
    assert.equal(visibility.latest, false);
    assert.equal(visibility.featured, false);
    assert.equal(visibility.gallery, false);
  });

  it("GuestHomeFull gates latest on catalogItems via resolveHomeSectionVisibility", () => {
    const fullSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"),
      "utf8"
    );
    const latestSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/home-latest-tours.tsx"),
      "utf8"
    );
    assert.match(fullSource, /resolveHomeSectionVisibility/);
    assert.match(fullSource, /sections\.latest/);
    assert.match(fullSource, /catalogItems/);
    assert.match(fullSource, /id="main-content"/);
    assert.match(latestSource, /data-marketing-home-latest/);
    assert.doesNotMatch(latestSource, /data-marketing-catalog-card/);
  });
});
