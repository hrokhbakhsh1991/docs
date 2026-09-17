/**
 * HOME-UNIT — Denali Destinations compose (Slice 3).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveMarketingDestinationImageSrcSet } from "../src/home/resolve-marketing-destination-image-path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(repoRoot, rel), "utf8");
}

describe("home-destinations.spec.ts", () => {
  it("uses compact same-origin candidates without overriding custom stems", () => {
    assert.match(resolveMarketingDestinationImageSrcSet("alborz") ?? "", /alborz-480\.webp 480w/);
    assert.match(resolveMarketingDestinationImageSrcSet("alborz") ?? "", /alborz-800\.webp 800w/);
    assert.equal(
      resolveMarketingDestinationImageSrcSet("zardkuh", { zardkuh: "zardkooh" }),
      undefined
    );
  });

  it("renders the three existing destinations with a truthful all-tours fallback", () => {
    const source = readSrc("apps/marketing/src/home/home-destinations.tsx");
    const fullSource = readSrc("apps/marketing/src/home/guest-home-full.tsx");

    assert.match(source, /home\.full\.destinations\.\$\{id\}\.name/);
    assert.match(source, /home\.full\.hero\.spotlight\.\$\{id\}\.tagline/);
    assert.match(source, /home\.full\.hero\.spotlight\.\$\{id\}\.elevationValue/);
    assert.match(source, /home\.full\.hero\.spotlight\.\$\{id\}\.regionValue/);
    assert.match(source, /home\.full\.destinations\.\$\{id\}\.description/);
    assert.match(source, /home\.full\.destinations\.exploreAll/);
    assert.match(source, /resolveMarketingToursListPath\(locale\)/);
    assert.match(source, /data-marketing-home-destination-link/);
    assert.match(source, /aria-label=\{`\$\{explore\} — \$\{name\}`\}/);
    assert.match(source, /resolveMarketingDestinationImagePath\(id, destinationImageStems\)/);
    assert.match(source, /alt=""/);
    assert.doesNotMatch(source, /tabIndex/);
    assert.doesNotMatch(source, /destination=/);
    assert.doesNotMatch(source, /--mkt-destination-image/);
    assert.match(fullSource, /destinationImageStems=\{landing\.destinationImageStems\}/);
    assert.match(
      fullSource,
      /<HomeDestinations[\s\S]*destinationSlugs=\{landing\.destinationSlugs\}/
    );
  });

  it("Hero has no destination selector and does not invent destination filtering", () => {
    const hero = readSrc("apps/marketing/src/home/home-hero.tsx");
    assert.doesNotMatch(hero, /HomeHeroDestinationStage/);
    assert.doesNotMatch(hero, /role="radiogroup"/);
    assert.doesNotMatch(hero, /data-marketing-home-hero-selector/);
    assert.match(hero, /resolveMarketingToursListPath\(locale\)/);
    assert.doesNotMatch(hero, /resolveMarketingToursListPath\(locale, \{ q:/);
    assert.doesNotMatch(hero, /[?&]destination=/);
  });

  it("keeps destination queries scoped and preserves intentional motion", () => {
    const source = readSrc("apps/marketing/src/home/home-destinations.tsx");
    const programs = readSrc("apps/marketing/src/home/home-published-programs.tsx");
    const aggregator = readSrc("packages/workspaces/denali/theme/marketing/home-landing.css");
    const css = readSrc("packages/workspaces/denali/theme/marketing/home/destinations.css");

    assert.doesNotMatch(source, /destination=/);
    assert.match(programs, /export const PUBLISHED_PROGRAMS_MAX = 6/);
    assert.match(aggregator, /@import "\.\/home\/hero\.css"/);
    assert.match(aggregator, /@import "\.\/home\/programs\.css"/);
    assert.match(aggregator, /@import "\.\/home\/destinations\.css"/);
    assert.match(css, /repeat\(3, minmax\(0, 1fr\)\)/);
    assert.match(css, /@media \(min-width: 64rem\)/);
    assert.match(css, /@media \(min-width: 48rem\) and \(max-width: 63\.9375rem\)/);
    assert.match(css, /minmax\(14rem, 40%\) minmax\(0, 1fr\)/);
    assert.match(css, /-webkit-line-clamp: 2/);
    assert.match(css, /min-height: 44px/);
    assert.match(css, /--denali-mist-50/);
    assert.match(css, /background: transparent/);
    assert.doesNotMatch(css, /color-mix\(in srgb, var\(--denali-forest-600\)/);
    assert.doesNotMatch(css, /scroll-snap-type:\s*x/);
    assert.doesNotMatch(css, /flex:\s*1\.4/);
    assert.doesNotMatch(css, /max-height:\s*0/);
    assert.match(css, /denali-destination-card-in/);
    assert.match(css, /prefers-reduced-motion: reduce/);
  });
});
