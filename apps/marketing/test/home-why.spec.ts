/**
 * HOME-UNIT — Denali Why + Trust merge (Slice 4).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { HOME_WHY_TILE_IDS } from "../src/home/home-why-tile-ids";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("home-why.spec.ts", () => {
  it("nests Trust identity into Why and stops mounting a standalone Trust band when Why is on", () => {
    const fullSource = readSrc("apps/marketing/src/home/guest-home-full.tsx");
    const whySource = readSrc("apps/marketing/src/home/home-why.tsx");
    const trustSource = readSrc("apps/marketing/src/home/home-trust.tsx");

    assert.match(fullSource, /nestTrustInWhy = sections\.whySection && sections\.trust/);
    assert.match(fullSource, /sections\.trust && !nestTrustInWhy \? <HomeTrust/);
    assert.match(fullSource, /showTrustKicker=\{nestTrustInWhy\}/);
    assert.match(whySource, /showTrustKicker/);
    assert.match(whySource, /home\.full\.trust\.tagline/);
    assert.match(whySource, /data-marketing-home-why-kicker/);
    assert.match(whySource, /data-marketing-home-why-kicker-brand/);
    assert.match(whySource, /id=\{whySectionAnchor\}/);
    assert.match(whySource, /data-marketing-home-why-editorial/);
    assert.match(trustSource, /data-marketing-home-trust/);
    assert.match(fullSource, /<HomeTrust branding=\{branding\} \/>/);
  });

  it("keeps four supported values as a non-interactive rail with no CTA", () => {
    const whySource = readSrc("apps/marketing/src/home/home-why.tsx");
    const heroSource = readSrc("apps/marketing/src/home/home-hero.tsx");

    assert.deepEqual([...HOME_WHY_TILE_IDS], ["guide", "safety", "equipment", "community"]);
    assert.match(whySource, /home\.full\.why\.title/);
    assert.match(whySource, /home\.full\.why\.lead/);
    assert.match(whySource, /data-marketing-home-why-rail/);
    assert.match(whySource, /data-marketing-home-why-item/);
    assert.match(whySource, /home\.full\.why\.\$\{id\}\.title/);
    assert.match(whySource, /home\.full\.why\.\$\{id\}\.description/);
    assert.doesNotMatch(whySource, /data-marketing-home-why-tile/);
    assert.doesNotMatch(whySource, /data-marketing-home-why-grid/);
    assert.doesNotMatch(whySource, /<Link/);
    assert.doesNotMatch(whySource, /<a\s/);
    assert.doesNotMatch(whySource, /href=/);
    assert.doesNotMatch(whySource, /tabIndex/);
    assert.doesNotMatch(whySource, /home\.full\.finalCta/);
    assert.doesNotMatch(whySource, /home\.full\.latest\.viewAll/);
    assert.doesNotMatch(whySource, /home\.full\.destinations\.explore/);
    assert.match(heroSource, /data-marketing-home-cta-secondary/);
    assert.match(heroSource, /href=\{whySectionHref\}/);
  });

  it("owns Why CSS as a named landing partial and does not restyle locked sections", () => {
    const aggregator = readSrc("packages/workspaces/denali/theme/marketing/home-landing.css");
    const css = readSrc("packages/workspaces/denali/theme/marketing/home/why.css");
    const destinations = readSrc(
      "packages/workspaces/denali/theme/marketing/home/destinations.css"
    );
    const programs = readSrc("packages/workspaces/denali/theme/marketing/home/programs.css");
    const hero = readSrc("packages/workspaces/denali/theme/marketing/home/hero.css");

    assert.match(aggregator, /@import "\.\/home\/hero\.css"/);
    assert.match(aggregator, /@import "\.\/home\/programs\.css"/);
    assert.match(aggregator, /@import "\.\/home\/destinations\.css"/);
    assert.match(aggregator, /@import "\.\/home\/why\.css"/);
    assert.match(css, /data-marketing-home-why-rail/);
    assert.match(css, /repeat\(4, minmax\(0, 1fr\)\)/);
    assert.match(css, /repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /data-marketing-home-why-kicker/);
    assert.doesNotMatch(css, /box-shadow:\s*var\(--mkt-shadow-card\)/);
    assert.doesNotMatch(css, /backdrop-filter/);
    assert.doesNotMatch(destinations, /data-marketing-home-why/);
    assert.doesNotMatch(programs, /data-marketing-home-why/);
    assert.doesNotMatch(hero, /data-marketing-home-why/);
  });
});
