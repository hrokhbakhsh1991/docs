import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMarketingTourDetailJsonLdGraph } from "../src/seo/build-marketing-tour-detail-jsonld-graph";
import { serializeMarketingJsonLd } from "../src/seo/serialize-marketing-jsonld";
import { buildValidatedMarketingTourStructuredData } from "../src/seo/build-validated-marketing-structured-data";
import { enrichMarketingTourStructuredData } from "../src/seo/enrich-marketing-structured-data";
import { buildTourDetailBreadcrumbJsonLd } from "../src/seo/build-breadcrumb-jsonld";
import { buildMarketingLayoutJsonLd } from "../src/seo/build-layout-jsonld";
import { buildMarketingCatalogListJsonLd } from "../src/seo/build-marketing-catalog-list-jsonld";
import { buildMarketingToursListMetadata } from "../src/seo/build-marketing-metadata";

describe("marketing structured data helpers", () => {
  it("MKT-40 enriches workspace JSON-LD with absolute tour url", () => {
    const enriched = enrichMarketingTourStructuredData({
      host: "denali.localhost:3002",
      tourId: "tour-1",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "TouristTrip",
        name: "Trek",
      },
    });
    assert.equal(
      enriched.url,
      "http://denali.localhost:3002/tours/tour-1"
    );
  });

  it("MKT-41 builds breadcrumb JSON-LD for tour detail", () => {
    const breadcrumb = buildTourDetailBreadcrumbJsonLd({
      host: "denali.localhost:3002",
      tourId: "tour-1",
      tourTitle: "North Ridge Trek",
      toursLabel: "Tours",
      homeLabel: "Home",
    });
    assert.equal(breadcrumb["@type"], "BreadcrumbList");
    const items = breadcrumb.itemListElement as Array<{ position: number; name: string }>;
    assert.equal(items.length, 3);
    assert.equal(items[2]?.name, "North Ridge Trek");
  });

  it("MKT-42 validates enriched JSON-LD before render", () => {
    const valid = buildValidatedMarketingTourStructuredData({
      host: "denali.localhost:3002",
      tourId: "tour-1",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "TouristTrip",
        name: "Trek",
      },
    });
    assert.equal(valid?.url, "http://denali.localhost:3002/tours/tour-1");

    const invalid = buildValidatedMarketingTourStructuredData({
      host: "denali.localhost:3002",
      tourId: "tour-1",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "TouristTrip",
      },
    });
    assert.equal(invalid, null);
  });

  it("MKT-34 builds ItemList JSON-LD for catalog list first page", () => {
    const jsonLd = buildMarketingCatalogListJsonLd({
      host: "denali.localhost:3002",
      listLabel: "Tours",
      items: [
        { tourId: "tour-a", title: "North Ridge Trek" },
        { tourId: "tour-b", title: "City Walk" },
      ],
    });
    assert.equal(jsonLd["@type"], "ItemList");
    const elements = jsonLd.itemListElement as Array<{ position: number; name: string; url: string }>;
    assert.equal(elements.length, 2);
    assert.equal(elements[0]?.position, 1);
    assert.equal(elements[0]?.name, "North Ridge Trek");
    assert.equal(elements[0]?.url, "http://denali.localhost:3002/tours/tour-a");
  });

  it("MKT-44 builds Organization and WebSite layout JSON-LD", () => {
    const jsonLd = buildMarketingLayoutJsonLd({
      host: "denali.localhost:3002",
      siteName: "Denali Club",
    });
    assert.equal(jsonLd["@context"], "https://schema.org");
    assert.equal(jsonLd["@graph"][0]?.["@type"], "Organization");
    assert.equal(jsonLd["@graph"][1]?.["@type"], "WebSite");
    assert.equal(jsonLd["@graph"][0]?.url, "http://denali.localhost:3002");
  });

  it("MKT-45 bundles tour JSON-LD and breadcrumb into @graph", () => {
    const graph = buildMarketingTourDetailJsonLdGraph({
      structuredData: {
        "@context": "https://schema.org",
        "@type": "TouristTrip",
        name: "Trek",
        url: "http://denali.localhost:3002/tours/tour-1",
      },
      breadcrumbJsonLd: {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [],
      },
    });
    assert.equal(graph?.["@graph"]?.length, 2);
    assert.doesNotMatch(serializeMarketingJsonLd({ x: "<script>" }), /<script>/);
  });

  it("MKT-39 tours list openGraph declares locale", () => {
    const metadata = buildMarketingToursListMetadata({
      host: "denali.localhost:3002",
      siteName: "Denali Club",
      title: "Tours",
      description: "Published tours",
      locale: "en",
    });
    assert.equal(metadata.openGraph?.locale, "en_US");
  });
});
