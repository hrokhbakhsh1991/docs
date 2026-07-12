/**
 * HOME-UNIT-05 — PR-6 section gates (whyDenali, journey, testimonials).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";
import { PR7_SECTIONS_OFF, PR8_SECTIONS_OFF } from "./home-landing-fixtures";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const STORY_DISABLED: GuestLandingFeatures = {
  variant: "full",
  whySectionAnchor: "why-us",
  destinationSlugs: [],
  destinationImageStems: {},
  sections: {
    hero: true,
    latestTours: true,
    latestToursLimit: 6,
    trust: true,
    finalCta: true,
    faq: true,
    footer: true,
    whyDenali: false,
    journey: false,
    testimonials: false,
    ...PR7_SECTIONS_OFF,
    ...PR8_SECTIONS_OFF,
  },
  i18nProfile: "full",
};

const STORY_ENABLED: GuestLandingFeatures = {
  variant: "full",
  whySectionAnchor: "why-us",
  destinationSlugs: [],
  destinationImageStems: {},
  sections: {
    hero: true,
    latestTours: true,
    latestToursLimit: 6,
    trust: true,
    finalCta: true,
    faq: true,
    footer: true,
    whyDenali: true,
    journey: true,
    testimonials: true,
    ...PR7_SECTIONS_OFF,
    ...PR8_SECTIONS_OFF,
  },
  i18nProfile: "full",
};

describe("home-section-gates-v2.spec.ts — HOME-UNIT-05", () => {
  it("resolveHomeSectionVisibility gates PR-6 sections from manifest", () => {
    assert.deepEqual(resolveHomeSectionVisibility(STORY_DISABLED, 2, 0, 0), {
      hero: true,
      heroSearch: false,
      featured: false,
      latest: true,
      categories: false,
      destinations: false,
      trust: true,
      whyDenali: false,
      journey: false,
      testimonials: false,
      gallery: false,
      equipment: false,
      blogTeaser: false,
      faq: true,
      finalCta: true,
    });

    assert.deepEqual(resolveHomeSectionVisibility(STORY_ENABLED, 2, 0, 0), {
      hero: true,
      heroSearch: false,
      featured: false,
      latest: true,
      categories: false,
      destinations: false,
      trust: true,
      whyDenali: true,
      journey: true,
      testimonials: true,
      gallery: false,
      equipment: false,
      blogTeaser: false,
      faq: true,
      finalCta: true,
    });
  });

  it("GuestHomeFull wires why, journey, testimonials from section gates", () => {
    const fullSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"),
      "utf8"
    );
    assert.match(fullSource, /sections\.whyDenali/);
    assert.match(fullSource, /landing\.destinationSlugs/);
    assert.match(fullSource, /whySectionAnchor/);
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-why.tsx"), "utf8"),
      /home\.full\.why\.title.*siteName|siteName.*home\.full\.why\.title/s
    );
    assert.match(fullSource, /sections\.journey/);
    assert.match(fullSource, /sections\.testimonials/);
    assert.match(fullSource, /<HomeWhy/);
    assert.match(fullSource, /<HomeJourney/);
    assert.match(fullSource, /<HomeTestimonials/);
  });
});
