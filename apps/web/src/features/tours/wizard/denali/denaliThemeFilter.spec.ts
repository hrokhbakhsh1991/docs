import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { filterDenaliThemesByCategory } from "./denaliThemeFilter";
import type { SettingsTourThemeDto } from "@/lib/settings-tour-themes.client";

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

describe("filterDenaliThemesByCategory", () => {
  it("mountain: returns mountain_outdoor, denali_pilot, general", () => {
    const result = filterDenaliThemesByCategory(themes, "mountain");
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("mountain-1"), "mountain_outdoor theme missing");
    assert.ok(ids.includes("denali-1"),   "denali_pilot theme missing");
    assert.ok(ids.includes("general-1"),  "general theme missing");
    assert.ok(!ids.includes("urban-1"),   "urban_event should be excluded");
    assert.ok(!ids.includes("cinema-1"),  "cinema_event should be excluded");
    assert.ok(!ids.includes("nature-1"),  "nature_trip should be excluded from mountain");
  });

  it("nature: returns nature_trip, denali_pilot, general; excludes mountain_outdoor", () => {
    const result = filterDenaliThemesByCategory(themes, "nature");
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("nature-1"),   "nature_trip theme missing");
    assert.ok(ids.includes("denali-1"),   "denali_pilot theme missing");
    assert.ok(ids.includes("general-1"),  "general theme missing");
    assert.ok(!ids.includes("mountain-1"), "mountain_outdoor should be excluded from nature");
    assert.ok(!ids.includes("urban-1"),   "urban_event should be excluded");
  });

  it("desert: returns nature_trip, denali_pilot, general (same as nature proxy)", () => {
    const result = filterDenaliThemesByCategory(themes, "desert");
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("nature-1"),  "nature_trip theme missing for desert");
    assert.ok(ids.includes("general-1"), "general theme missing");
    assert.ok(!ids.includes("urban-1"),  "urban_event excluded");
  });

  it("event: returns urban_event, cinema_event, cultural_tour, general; excludes outdoor themes", () => {
    const result = filterDenaliThemesByCategory(themes, "event");
    const ids = result.map((t) => t.id);
    assert.ok(ids.includes("urban-1"),    "urban_event missing");
    assert.ok(ids.includes("cinema-1"),   "cinema_event missing");
    assert.ok(ids.includes("cultural-1"), "cultural_tour missing");
    assert.ok(ids.includes("general-1"),  "general missing");
    assert.ok(!ids.includes("mountain-1"), "mountain_outdoor should be excluded from event");
    assert.ok(!ids.includes("nature-1"),   "nature_trip should be excluded from event");
    assert.ok(!ids.includes("denali-1"),   "denali_pilot should be excluded from event");
  });

  it("undefined category: returns all themes (safe fallback)", () => {
    const result = filterDenaliThemesByCategory(themes, undefined);
    assert.strictEqual(result.length, themes.length);
  });
});
