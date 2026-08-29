import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildDenaliPhotoDaySections,
  readDenaliPhotoGridColumnCount,
  resolveDenaliPhotoDay,
  shouldDenaliPhotoDayDefaultOpen,
} from "../src/ui/logic/denali-photo-day-grouping";
import { parseDenaliTourPhotos } from "../src/ui/logic/denali-photo-types";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");
const THEME_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../theme");

function fixturePhotos(dayCount: number, photosPerDay: number) {
  const photos = [];
  for (let day = 1; day <= dayCount; day += 1) {
    for (let index = 0; index < photosPerDay; index += 1) {
      photos.push({
        id: `d${day}-p${index}`,
        label: `Day ${day} photo ${index}`,
        day,
        url: `https://cdn.example/day-${day}-${index}.webp`,
      });
    }
  }
  return photos;
}

describe("denali-photo-multiday-layout.spec.ts", () => {
  it("DN-PHOTO-MD-01 one-day tours keep flat layout contract (no day sections)", () => {
    const source = readFileSync(join(SRC_ROOT, "ui/fields/denali-photos-field.tsx"), "utf8");
    assert.match(source, /denali-wizard-composite__photos-layout/);
    assert.match(source, /multiDay && dayCount != null \?/);
    assert.match(source, /DENALI_PHOTOS_TEST_IDS\.addPhoto/);
    assert.match(source, /DENALI_PHOTOS_TEST_IDS\.daySections/);
  });

  it("DN-PHOTO-MD-02 three-day grouping buckets photos by day", () => {
    const photos = fixturePhotos(3, 2);
    const sections = buildDenaliPhotoDaySections(photos, 3);
    assert.equal(sections.length, 3);
    assert.equal(sections[0]?.items.length, 2);
    assert.equal(sections[1]?.items.length, 2);
    assert.equal(sections[2]?.items.length, 2);
    assert.equal(sections[0]?.items[0]?.photo.id, "d1-p0");
    assert.equal(sections[2]?.items[1]?.photo.id, "d3-p1");
  });

  it("DN-PHOTO-MD-03 seven-day grouping preserves global cover index", () => {
    const photos = fixturePhotos(7, 1);
    const sections = buildDenaliPhotoDaySections(photos, 7);
    assert.equal(sections.length, 7);
    assert.equal(sections[0]?.items[0]?.globalIndex, 0);
    assert.equal(sections[6]?.items[0]?.globalIndex, 6);
    assert.equal(shouldDenaliPhotoDayDefaultOpen(1, 7), true);
    assert.equal(shouldDenaliPhotoDayDefaultOpen(2, 7), false);
    assert.equal(shouldDenaliPhotoDayDefaultOpen(7, 7), false);
  });

  it("DN-PHOTO-MD-04 resolveDenaliPhotoDay clamps invalid day to tour length", () => {
    assert.equal(resolveDenaliPhotoDay({ id: "a", day: 9 }, 3), 3);
    assert.equal(resolveDenaliPhotoDay({ id: "b" }, 3), 1);
    assert.equal(resolveDenaliPhotoDay({ id: "c", day: 2 }, 3), 2);
  });

  it("DN-PHOTO-MD-05 delete scope stays per photo id (source contract)", () => {
    const source = readFileSync(join(SRC_ROOT, "ui/fields/denali-photos-field.tsx"), "utf8");
    assert.match(source, /current\.filter\(\(photo\) => photo\.id\?\.trim\(\) !== normalizedId\)/);
    assert.match(source, /data-operator-photo-day=/);
  });

  it("DN-PHOTO-MD-06 responsive grid column contract", () => {
    assert.equal(readDenaliPhotoGridColumnCount(390), 1);
    assert.equal(readDenaliPhotoGridColumnCount(768), 2);
    assert.equal(readDenaliPhotoGridColumnCount(1440), 3);
  });

  it("DN-PHOTO-MD-07 preview hydration uses DenaliPhotoPreview (no placeholder corruption)", () => {
    const source = readFileSync(join(SRC_ROOT, "ui/fields/denali-photos-field.tsx"), "utf8");
    assert.match(source, /<DenaliPhotoPreview/);
    assert.equal(/initials/i.test(source), false);
    const hydrated = parseDenaliTourPhotos([
      { id: "p1", url: "https://cdn.example/cover.webp", label: "Summit" },
    ]);
    assert.equal(hydrated[0]?.url, "https://cdn.example/cover.webp");
  });

  it("DN-PHOTO-MD-08 multi-day UI uses collapsible day sections + per-day grids", () => {
    const source = readFileSync(join(SRC_ROOT, "ui/fields/denali-photos-field.tsx"), "utf8");
    const css = readFileSync(join(THEME_ROOT, "wizard-fields.css"), "utf8");
    assert.match(source, /denali-photo-day-section/);
    assert.match(source, /DENALI_PHOTOS_TEST_IDS\.daySection/);
    assert.match(source, /DENALI_PHOTOS_TEST_IDS\.dayGrid/);
    assert.match(source, /tourCoverBadge/);
    assert.match(css, /\.denali-wizard-composite__photos-day-grid/);
    assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
    assert.match(css, /\.denali-photo-day-section__summary::before/);
  });

  it("DN-PHOTO-MD-09 create/edit parity — composite-renderers shares DenaliPhotosField", () => {
    const composite = readFileSync(join(SRC_ROOT, "ui/surfaces/composite-renderers.tsx"), "utf8");
    assert.match(composite, /<DenaliPhotosField/);
    assert.equal(
      (composite.match(/<DenaliPhotosField/g) ?? []).length,
      1,
      "single shared photos field for create + edit surfaces"
    );
  });
});
