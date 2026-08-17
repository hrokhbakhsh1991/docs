/**
 * HOME-UNIT-08 — PR-8 premium section gates + hooks.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { deriveHomeGalleryPhotos } from "../src/home/derive-home-gallery-photos";
import { resolveHomeCatalogFetchLimit } from "../src/home/resolve-home-catalog-fetch-limit";
import { resolveHomeSectionVisibility } from "../src/home/home-section-gates";
import { resolveHomeTourCoverUrl } from "../src/home/resolve-home-tour-cover-url";
import { MARKETING_FALLBACK_TOUR_COVER_PATH } from "../src/home/home-marketing-assets";
import { buildMarketingHomeJsonLd } from "../src/seo/build-marketing-home-jsonld";
import { resolveMarketingHeroImageUrl } from "../src/tenant/resolve-marketing-hero-image-url";
import { resolveHomeHeroCarouselSlides } from "../src/home/resolve-home-hero-carousel-slides";
import { FULL_LANDING, PREMIUM_LANDING } from "./home-landing-fixtures";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("home-section-gates-v4.spec.ts — HOME-UNIT-08", () => {
  it("resolveHomeCatalogFetchLimit uses gallery floor of 6", () => {
    const landing = {
      ...FULL_LANDING,
      sections: {
        ...FULL_LANDING.sections,
        latestTours: false,
        latestToursLimit: 0,
        featuredTours: false,
        featuredToursLimit: 0,
        categories: false,
        gallery: true,
      },
    };
    assert.equal(resolveHomeCatalogFetchLimit(landing), 6);
  });

  it("resolveHomeSectionVisibility gates PR-8 sections", () => {
    assert.deepEqual(resolveHomeSectionVisibility(PREMIUM_LANDING, 2, 1, 2), {
      hero: true,
      heroSearch: true,
      featured: true,
      latest: true,
      categories: true,
      destinations: true,
      trust: true,
      whySection: true,
      journey: true,
      testimonials: true,
      gallery: true,
      equipment: true,
      blogTeaser: false,
      faq: true,
      finalCta: true,
    });
  });

  it("deriveHomeGalleryPhotos returns static showcase set", () => {
    const photos = deriveHomeGalleryPhotos((key) => key);
    assert.equal(photos.length, 3);
    assert.equal(photos[0]?.id, "gallery-01");
    assert.equal(photos[0]?.src, "/home/gallery/01.webp");
    assert.equal(photos[0]?.alt, "home.full.gallery.photos.01");
  });

  it("resolveHomeTourCoverUrl falls back when catalog cover missing", () => {
    assert.equal(resolveHomeTourCoverUrl(null), MARKETING_FALLBACK_TOUR_COVER_PATH);
    assert.equal(resolveHomeTourCoverUrl("  "), MARKETING_FALLBACK_TOUR_COVER_PATH);
    assert.equal(resolveHomeTourCoverUrl("https://cdn/cover.jpg"), "https://cdn/cover.jpg");
    assert.equal(
      resolveHomeTourCoverUrl("https://cdn.example/north-ridge.jpg"),
      MARKETING_FALLBACK_TOUR_COVER_PATH
    );
  });

  it("resolveHomeHeroCarouselSlides dedupes and caps manifest destination frames", () => {
    const slides = resolveHomeHeroCarouselSlides(
      "/home/hero.webp",
      ["alborz", "damavand", "zardkuh"],
      { zardkuh: "zardkooh" }
    );
    assert.equal(slides.length, 4);
    assert.equal(slides[0], "/home/hero.webp");
    assert.equal(slides[3], "/home/destinations/zardkooh.webp");
    assert.equal(
      resolveHomeHeroCarouselSlides("https://cdn/custom-hero.jpg", [], {})[0],
      "https://cdn/custom-hero.jpg"
    );
  });

  it("resolveMarketingHeroImageUrl prefers branding override", () => {
    assert.equal(
      resolveMarketingHeroImageUrl({
        displayName: null,
        primaryColor: null,
        logoUrl: null,
        defaultLocale: null,
        marketingHeroUrl: "https://cdn/hero.jpg",
      }),
      "https://cdn/hero.jpg"
    );
    assert.equal(
      resolveMarketingHeroImageUrl({
        displayName: null,
        primaryColor: null,
        logoUrl: null,
        defaultLocale: null,
      }),
      "/home/hero.webp"
    );
  });

  it("buildMarketingHomeJsonLd emits ItemList", () => {
    const jsonLd = buildMarketingHomeJsonLd({
      host: "operator.localhost:3002",
      listLabel: "Latest",
      items: [{ tourId: "t1", title: "North Ridge" }],
    });
    assert.equal(jsonLd?.["@type"], "ItemList");
  });

  it("GuestHomeFull wires gallery, equipment, jsonld, hero image", () => {
    const fullSource = readFileSync(
      join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"),
      "utf8"
    );
    assert.match(fullSource, /sections\.gallery/);
    assert.match(fullSource, /sections\.equipment/);
    assert.match(fullSource, /<HomeGallery/);
    assert.match(fullSource, /<HomeEquipment/);
    assert.match(fullSource, /<HomePageJsonLd/);
    assert.match(fullSource, /heroImageUrl/);

    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-gallery.tsx"), "utf8"),
      /data-marketing-home-gallery/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-gallery-showcase.tsx"), "utf8"),
      /HomeGalleryShowcase/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-equipment.tsx"), "utf8"),
      /data-marketing-home-equipment/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-blog-teaser.tsx"), "utf8"),
      /data-marketing-home-blog/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"), "utf8"),
      /data-marketing-home/
    );
    assert.doesNotMatch(
      readFileSync(join(repoRoot, "apps/marketing/src/home/guest-home-full.tsx"), "utf8"),
      /id="main-content"/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-hero.tsx"), "utf8"),
      /data-marketing-home-hero-cinematic/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-hero.tsx"), "utf8"),
      /HomeHeroStaticParallax/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-hero.tsx"), "utf8"),
      /HomeHeroCarouselMedia/
    );
    assert.match(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-hero.tsx"), "utf8"),
      /data-marketing-home-hero-overlay-scrim/
    );
    assert.doesNotMatch(
      readFileSync(join(repoRoot, "apps/marketing/src/home/home-hero.tsx"), "utf8"),
      /HomeHeroMountainStageClient/
    );
    const heroMedia = readFileSync(
      join(repoRoot, "apps/marketing/src/home/hero-static/home-hero-carousel-media.tsx"),
      "utf8"
    );
    assert.match(heroMedia, /fetchPriority=\{index === 0 \? "high" : "low"\}/);
    assert.match(heroMedia, /loading=\{index === 0 \? "eager" : "lazy"\}/);
    assert.doesNotMatch(heroMedia, /from "next\/image"/);
  });
});
