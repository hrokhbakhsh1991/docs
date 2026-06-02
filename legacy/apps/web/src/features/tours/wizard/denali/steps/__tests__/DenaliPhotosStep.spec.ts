import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

import {
  collectDenaliUnpersistedPhotoBlobIssues,
  formatDenaliPhotoPersistenceWarning,
  hasDenaliUnpersistedPhotoBlobs,
} from "../../denaliPhotoPersistence";
import { filterDenaliThemesByCategory } from "../../denaliThemeFilter";

function makeTheme(id: string, formProfile: SettingsTourThemeDto["formProfile"]): SettingsTourThemeDto {
  return {
    id,
    name: id,
    slug: id,
    description: null,
    isActive: true,
    sortOrder: 0,
    formProfile,
    createdAt: "",
    updatedAt: "",
  };
}

const themes: SettingsTourThemeDto[] = [
  makeTheme("mountain-1", "mountain_outdoor"),
  makeTheme("nature-1", "nature_trip"),
  makeTheme("urban-1", "urban_event"),
  makeTheme("cinema-1", "cinema_event"),
  makeTheme("cultural-1", "cultural_tour"),
  makeTheme("denali-1", "denali_pilot"),
  makeTheme("general-1", "general"),
];

describe("DenaliPhotosStep photo persistence", () => {
  it("detects gallery blob URLs", () => {
    const form = buildDenaliTourCreateTestValues();
    form.photosData.photos = [
      {
        id: "p1",
        url: "blob:http://localhost/abc",
        filename: "a.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: new Date().toISOString(),
      },
    ];
    assert.equal(hasDenaliUnpersistedPhotoBlobs(form), true);
    const issues = collectDenaliUnpersistedPhotoBlobIssues(form);
    assert.equal(issues.length, 1);
    assert.equal(issues[0]?.kind, "gallery");
    const message = formatDenaliPhotoPersistenceWarning(issues);
    assert.match(message, /blob/);
  });

  it("accepts https gallery URLs", () => {
    const form = buildDenaliTourCreateTestValues();
    form.photosData.photos = [
      {
        id: "p1",
        url: "https://cdn.example/photo.jpg",
        filename: "a.jpg",
        size: 1,
        mimeType: "image/jpeg",
        uploadedAt: new Date().toISOString(),
      },
    ];
    assert.equal(hasDenaliUnpersistedPhotoBlobs(form), false);
  });
});

describe("DenaliPhotosStep theme filter", () => {
  it("mountain: returns mountain_outdoor, denali_pilot, general", () => {
    const result = filterDenaliThemesByCategory(themes, "mountain");
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("mountain-1"), "mountain_outdoor theme missing");
    assert.ok(ids.includes("denali-1"), "denali_pilot theme missing");
    assert.ok(ids.includes("general-1"), "general theme missing");
    assert.ok(!ids.includes("urban-1"), "urban_event should be excluded");
  });

  it("event: returns urban_event, cinema_event, cultural_tour, general", () => {
    const result = filterDenaliThemesByCategory(themes, "event");
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("urban-1"), "urban_event missing");
    assert.ok(ids.includes("cinema-1"), "cinema_event missing");
    assert.ok(!ids.includes("mountain-1"), "mountain_outdoor should be excluded from event");
  });

  it("undefined category: returns all themes", () => {
    const result = filterDenaliThemesByCategory(themes, undefined);
    assert.strictEqual(result.length, themes.length);
  });
});
