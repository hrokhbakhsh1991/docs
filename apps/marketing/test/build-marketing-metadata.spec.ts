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
      tour: {
        id: "t1",
        title: "North Ridge Trek",
        shortDescription: "Alpine trek",
        coverImageUrl: "https://cdn.example/trek.jpg",
      },
      tourId: "t1",
      pluginId: "denali",
      defaultTourTitle: "Tour",
    });
    assert.equal(metadata.title, "North Ridge Trek");
    const images = metadata.openGraph?.images;
    assert.ok(Array.isArray(images));
    assert.equal(images[0]?.url, "https://cdn.example/trek.jpg");
  });
});

describe("resolveLocaleFromCookieValue", () => {
  it("MKT-16 accepts fa and en", () => {
    assert.equal(resolveLocaleFromCookieValue("fa"), "fa");
    assert.equal(resolveLocaleFromCookieValue("en"), "en");
    assert.equal(resolveLocaleFromCookieValue("de"), null);
  });
});
