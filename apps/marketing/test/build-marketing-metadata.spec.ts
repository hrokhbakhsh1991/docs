import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatCatalogCardDates,
  formatCatalogPrice,
} from "../src/catalog/format-catalog-display";
import { resolveLocaleFromCookieValue } from "../src/i18n/resolve-locale";
import {
  buildMarketingTourDetailMetadata,
  buildMarketingToursListMetadata,
  resolveMarketingPublicOrigin,
  shouldNoindexMarketingListPage,
} from "../src/seo/build-marketing-metadata";

describe("build-marketing-metadata", () => {
  it("MKT-13 resolves marketing origin from host", () => {
    assert.equal(
      resolveMarketingPublicOrigin("shop.operator.localhost:3002"),
      "http://shop.operator.localhost:3002"
    );
  });

  it("MKT-14 tours list metadata uses tenant display name", () => {
    const metadata = buildMarketingToursListMetadata({
      host: "shop.operator.localhost:3002",
      siteName: "Operator Smoke",
      title: "Operator Smoke — Tours",
      description: "Published tour catalog for Operator Smoke.",
    });
    assert.equal(metadata.title, "Operator Smoke — Tours");
    assert.equal(metadata.alternates?.canonical, "/tours");
  });

  it("MKT-15 tour detail metadata includes OG image", () => {
    const metadata = buildMarketingTourDetailMetadata({
      host: "shop.operator.localhost:3002",
      siteName: "Operator Smoke",
      pluginId: "denali",
      tour: {
        id: "t1",
        title: "North Ridge Trek",
        shortDescription: "Alpine trek",
        coverImageUrl: "https://cdn.example/trek.jpg",
      },
      tourId: "t1",
      defaultTourTitle: "Tour",
    });
    assert.equal(metadata.title, "North Ridge Trek");
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    assert.equal(images[0]?.url, "https://cdn.example/trek.jpg");
    assert.equal(metadata.twitter?.card, "summary_large_image");
    assert.equal(metadata.twitter?.title, "North Ridge Trek — Operator Smoke");
    const twitterImages = metadata.twitter?.images;
    assert.ok(Array.isArray(twitterImages));
    assert.equal(twitterImages[0], "https://cdn.example/trek.jpg");
  });

  it("MKT-32 tour detail OG image declares width and height", () => {
    const metadata = buildMarketingTourDetailMetadata({
      host: "shop.operator.localhost:3002",
      siteName: "Operator Smoke",
      pluginId: "denali",
      tour: {
        id: "t1",
        title: "North Ridge Trek",
        shortDescription: "Alpine trek",
        coverImageUrl: "https://cdn.example/trek.jpg",
      },
      tourId: "t1",
      defaultTourTitle: "Tour",
    });
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    assert.equal(images[0]?.width, 1200);
    assert.equal(images[0]?.height, 630);
    assert.equal(images[0]?.alt, "North Ridge Trek");
  });

  it("MKT-29 tours list metadata includes Twitter card", () => {
    const metadata = buildMarketingToursListMetadata({
      host: "shop.operator.localhost:3002",
      siteName: "Operator Smoke",
      title: "Operator Smoke — Tours",
      description: "Published tour catalog for Operator Smoke.",
    });
    assert.equal(metadata.twitter?.card, "summary");
    assert.equal(metadata.twitter?.title, "Operator Smoke — Tours");
    assert.equal(metadata.twitter?.description, "Published tour catalog for Operator Smoke.");
  });

  it("MKT-33 applies noindex follow when pagination query params are present", () => {
    assert.equal(
      shouldNoindexMarketingListPage({ cursor: "abc" }, ["cursor", "city"]),
      true
    );
    assert.equal(
      shouldNoindexMarketingListPage({ city: "Tehran" }, ["cursor", "city"]),
      true
    );
    assert.equal(shouldNoindexMarketingListPage({}, ["cursor", "city"]), false);
    assert.equal(
      shouldNoindexMarketingListPage({ cursor: "  " }, ["cursor"]),
      false
    );
  });

  it("MKT-33b list metadata forwards robots noindex policy", () => {
    const metadata = buildMarketingToursListMetadata({
      host: "shop.operator.localhost:3002",
      siteName: "Operator Smoke",
      title: "Tours",
      description: "List",
      robots: { index: false, follow: true },
    });
    assert.deepEqual(metadata.robots, { index: false, follow: true });
  });

  it("MKT-31 emits reciprocal hreflang alternates for English detail pages", () => {
    const metadata = buildMarketingTourDetailMetadata({
      host: "shop.operator.localhost:3002",
      siteName: "Operator Smoke",
      pluginId: "denali",
      locale: "en",
      tour: {
        id: "t1",
        title: "North Ridge Trek",
        shortDescription: "Alpine trek",
        coverImageUrl: null,
      },
      tourId: "t1",
      defaultTourTitle: "Tour",
    });

    assert.equal(metadata.alternates?.canonical, "/en/tours/t1");
    assert.equal(
      metadata.alternates?.languages?.["fa-IR"],
      "http://shop.operator.localhost:3002/tours/t1"
    );
    assert.equal(
      metadata.alternates?.languages?.["en-US"],
      "http://shop.operator.localhost:3002/en/tours/t1"
    );
    assert.equal(
      metadata.alternates?.languages?.["x-default"],
      "http://shop.operator.localhost:3002/tours/t1"
    );
  });
});

describe("resolveLocaleFromCookieValue", () => {
  it("MKT-16 accepts fa and en", () => {
    assert.equal(resolveLocaleFromCookieValue("fa"), "fa");
    assert.equal(resolveLocaleFromCookieValue("en"), "en");
    assert.equal(resolveLocaleFromCookieValue("de"), null);
  });
});
