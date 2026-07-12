import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMarketingDestinationImagePath } from "../src/home/resolve-marketing-destination-image-path";
import { resolveHomeHeroCarouselSlides } from "../src/home/resolve-home-hero-carousel-slides";

describe("resolve-marketing-destination-image-path", () => {
  it("MKT-HOME-CAROUSEL-01 maps slug to default webp path", () => {
    assert.equal(resolveMarketingDestinationImagePath("damavand"), "/home/destinations/damavand.webp");
  });

  it("MKT-HOME-CAROUSEL-02 honors manifest image stem overrides", () => {
    assert.equal(
      resolveMarketingDestinationImagePath("zardkuh", { zardkuh: "zardkooh" }),
      "/home/destinations/zardkooh.webp"
    );
  });
});

describe("resolve-home-hero-carousel-slides", () => {
  it("MKT-HOME-CAROUSEL-03 builds frames from manifest slugs only", () => {
    const slides = resolveHomeHeroCarouselSlides(
      "",
      ["alborz", "damavand"],
      {}
    );
    assert.deepEqual(slides, [
      "/home/hero.webp",
      "/home/destinations/alborz.webp",
      "/home/destinations/damavand.webp",
    ]);
  });
});
