import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../src");
const MESSAGES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../messages");

describe("denali-photo-empty.spec.ts (ED-PHOTO-EMPTY-01)", () => {
  it("DN-PHOTO-EMPTY-01 photos and itinerary empty notices are status, never alert", () => {
    const photos = readFileSync(join(SRC_ROOT, "ui/fields/denali-photos-field.tsx"), "utf8");
    const picker = readFileSync(
      join(SRC_ROOT, "ui/components/denali-itinerary-segment-photo-picker.tsx"),
      "utf8"
    );
    assert.match(photos, /DenaliOptionalEmptyNotice/);
    assert.match(photos, /composites\.photos\.dayEmpty/);
    assert.match(photos, /composites\.photos\.optionalEmpty/);
    assert.match(picker, /DenaliOptionalEmptyNotice/);
    assert.match(picker, /DENALI_ITINERARY_SEGMENT_PHOTO_TEST_IDS\.empty/);
    assert.match(picker, /composites\.itinerary\.segmentPhotosGoToPhotos/);
    assert.equal(/role="alert"/.test(picker), false);
  });

  it("DN-PHOTO-EMPTY-03 empty photos and segment photoIds stay optional on persist", () => {
    const registry = readFileSync(join(SRC_ROOT, "field-registry/denaliFieldRegistryData.ts"), "utf8");
    const photosBlock = registry.slice(registry.indexOf('canonicalPath: "photos"'));
    assert.match(photosBlock.slice(0, 500), /required:\s*false/);
    const itinerary = readFileSync(join(SRC_ROOT, "schemas/denaliItineraryDaySchema.ts"), "utf8");
    assert.match(itinerary, /photoIds: z\.array\(z\.string\(\)\.trim\(\)\.min\(1\)\)\.optional\(\)/);
    const photosSchema = readFileSync(join(SRC_ROOT, "schemas/denaliCore.schema.generated.ts"), "utf8");
    assert.match(photosSchema, /denaliPhotosSchema[\s\S]*?\.optional\(\)/);
    const projection = readFileSync(
      join(SRC_ROOT, "catalog/project-denali-catalog-itinerary.ts"),
      "utf8"
    );
    assert.match(projection, /photoIds == null \|\| photoIds\.length === 0/);
  });

  it("DN-PHOTO-EMPTY-02 i18n says day and itinerary photos are optional", () => {
    const fa = JSON.parse(readFileSync(join(MESSAGES_ROOT, "fa/wizard.json"), "utf8")) as {
      composites: {
        photos: { optionalEmpty: string; dayEmpty: string };
        itinerary: { segmentPhotosEmpty: string };
      };
    };
    const en = JSON.parse(readFileSync(join(MESSAGES_ROOT, "en/wizard.json"), "utf8")) as {
      composites: {
        photos: { optionalEmpty: string; dayEmpty: string };
        itinerary: { segmentPhotosEmpty: string };
      };
    };
    assert.match(fa.composites.photos.optionalEmpty, /اختیاری/);
    assert.match(fa.composites.photos.optionalEmpty, /ذخیره/);
    assert.match(fa.composites.photos.dayEmpty, /عکس روز/);
    assert.match(fa.composites.photos.dayEmpty, /مسدود نمی‌کند/);
    assert.match(fa.composites.itinerary.segmentPhotosEmpty, /برنامه روزانه/);
    assert.match(fa.composites.itinerary.segmentPhotosEmpty, /مسدود نمی‌کند/);
    assert.match(en.composites.photos.optionalEmpty, /optional/i);
    assert.match(en.composites.photos.dayEmpty, /day photos/i);
    assert.match(en.composites.itinerary.segmentPhotosEmpty, /optional/i);
  });
});
