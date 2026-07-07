/**
 * HOME-UNIT-01 — landing section gates from SDK manifest features.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";
import { FULL_LANDING, MINIMAL_LANDING } from "./home-landing-fixtures";

describe("home-landing-resolver.spec.ts — HOME-UNIT-01", () => {
  it("full landing with catalog items exposes hero, latest, trust, story, faq, final CTA", () => {
    assert.deepEqual(resolveHomeSectionVisibility(FULL_LANDING, 2, 0, 0), {
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

  it("full landing with zero items hides latest only", () => {
    assert.deepEqual(resolveHomeSectionVisibility(FULL_LANDING, 0, 0, 0), {
      hero: true,
      heroSearch: false,
      featured: false,
      latest: false,
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

  it("minimal landing hides all full-only sections", () => {
    assert.deepEqual(resolveHomeSectionVisibility(MINIMAL_LANDING, 99, 3, 2), {
      hero: false,
      heroSearch: false,
      featured: false,
      latest: false,
      categories: false,
      destinations: false,
      trust: false,
      whyDenali: false,
      journey: false,
      testimonials: false,
      gallery: false,
      equipment: false,
      blogTeaser: false,
      faq: false,
      finalCta: false,
    });
  });
});
