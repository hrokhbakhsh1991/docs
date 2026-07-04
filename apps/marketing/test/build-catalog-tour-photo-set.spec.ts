import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MARKETING_FALLBACK_TOUR_COVER_PATH,
  MARKETING_GALLERY_FALLBACK_PATHS,
} from "../src/home/home-marketing-assets";
import {
  buildCatalogTourPhotoSet,
  CATALOG_TOUR_DETAIL_GALLERY_MIN,
  readCatalogTourHeroGalleryPhotos,
  readCatalogTourOverflowGalleryPhotos,
  tourHasOverflowGalleryPhotos,
  tourUsesCatalogDetailPhotoFallbacks,
} from "../src/catalog/build-catalog-tour-photo-set";
import type { MarketingCatalogCard } from "../src/catalog/catalog-types";

const baseTour: MarketingCatalogCard = {
  id: "tour-1",
  title: "Trek",
  shortDescription: null,
  category: null,
  departureAt: null,
  endAt: null,
  priceAmount: null,
  priceCurrency: "IRR",
  coverImageUrl: "https://cdn.example/cover.jpg",
  totalCapacity: null,
};

const emptyPhotoTour: MarketingCatalogCard = {
  ...baseTour,
  coverImageUrl: null,
  photoUrls: undefined,
};

describe("buildCatalogTourPhotoSet", () => {
  it("PR-D-GLR-01 dedupes cover and photoUrls with cover first", () => {
    const photos = buildCatalogTourPhotoSet({
      ...baseTour,
      photoUrls: [
        "https://cdn.example/cover.jpg",
        "https://cdn.example/2.jpg",
        "https://cdn.example/3.jpg",
        "https://cdn.example/4.jpg",
      ],
    });

    assert.deepEqual(photos, [
      "https://cdn.example/cover.jpg",
      "https://cdn.example/2.jpg",
      "https://cdn.example/3.jpg",
      "https://cdn.example/4.jpg",
    ]);
    assert.equal(tourUsesCatalogDetailPhotoFallbacks({ ...baseTour, photoUrls: photos.slice(1) }), false);
  });

  it("PR-D-GLR-02 splits hero (3) and overflow galleries", () => {
    const photos = buildCatalogTourPhotoSet({
      ...baseTour,
      photoUrls: [
        "https://cdn.example/2.jpg",
        "https://cdn.example/3.jpg",
        "https://cdn.example/4.jpg",
        "https://cdn.example/5.jpg",
      ],
    });

    assert.equal(readCatalogTourHeroGalleryPhotos(photos).length, 3);
    assert.equal(readCatalogTourOverflowGalleryPhotos(photos).length, 2);
  });

  it("PR-D-GLR-03 detects overflow gallery section", () => {
    assert.equal(tourHasOverflowGalleryPhotos(emptyPhotoTour), true);
    assert.equal(
      tourHasOverflowGalleryPhotos({
        ...baseTour,
        photoUrls: [
          "https://cdn.example/2.jpg",
          "https://cdn.example/3.jpg",
          "https://cdn.example/4.jpg",
          "https://cdn.example/5.jpg",
        ],
      }),
      true,
    );
  });

  it("PR-D-GLR-04 pads with PR-9 static assets when API has no photos", () => {
    const photos = buildCatalogTourPhotoSet(emptyPhotoTour);

    assert.equal(tourUsesCatalogDetailPhotoFallbacks(emptyPhotoTour), true);
    assert.equal(photos.length, CATALOG_TOUR_DETAIL_GALLERY_MIN);
    assert.equal(photos[0], MARKETING_FALLBACK_TOUR_COVER_PATH);
    assert.equal(photos.includes(MARKETING_GALLERY_FALLBACK_PATHS[0]), true);
    assert.equal(readCatalogTourHeroGalleryPhotos(photos).length, 3);
    assert.equal(readCatalogTourOverflowGalleryPhotos(photos).length, 1);
  });

  it("PR-D-GLR-05 pads sparse API photos without replacing catalog URLs", () => {
    const photos = buildCatalogTourPhotoSet(baseTour);

    assert.equal(tourUsesCatalogDetailPhotoFallbacks(baseTour), true);
    assert.equal(photos[0], "https://cdn.example/cover.jpg");
    assert.equal(photos.length, CATALOG_TOUR_DETAIL_GALLERY_MIN);
  });
});
