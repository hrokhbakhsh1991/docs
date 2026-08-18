import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveMarketingDestinationImagePath } from "../src/home/resolve-marketing-destination-image-path";
import { resolveHomeHeroCarouselSlides } from "../src/home/resolve-home-hero-carousel-slides";
import { resolveHomeHeroDestinationStories } from "../src/home/resolve-home-hero-destination-stories";

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

describe("resolve-home-hero-destination-stories", () => {
  it("MKT-HOME-HERO-STORIES-01 maps destination slugs without the generic hero frame", () => {
    const stories = resolveHomeHeroDestinationStories(
      ["alborz", "damavand", "zardkuh"],
      { zardkuh: "zardkooh" }
    );
    assert.deepEqual(stories, [
      { slug: "alborz", src: "/home/destinations/alborz.webp" },
      { slug: "damavand", src: "/home/destinations/damavand.webp" },
      { slug: "zardkuh", src: "/home/destinations/zardkooh.webp" },
    ]);
  });

  it("MKT-HOME-HERO-STORIES-02 skips blank and duplicate slugs", () => {
    assert.deepEqual(resolveHomeHeroDestinationStories(["", "alborz", "alborz"], {}), [
      { slug: "alborz", src: "/home/destinations/alborz.webp" },
    ]);
    assert.deepEqual(resolveHomeHeroDestinationStories([], {}), []);
  });
});
