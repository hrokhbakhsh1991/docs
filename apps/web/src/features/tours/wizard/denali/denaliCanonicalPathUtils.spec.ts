import assert from "node:assert/strict";
import test from "node:test";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import {
  getDenaliCanonicalPathValue,
  isKnownDenaliCanonicalPath,
  resolveDenaliRegistryCanonicalPath,
} from "./denaliCanonicalPathUtils";

test("resolveDenaliRegistryCanonicalPath maps relocated content fields to program.*", () => {
  assert.equal(resolveDenaliRegistryCanonicalPath("programNature.themeIds"), "program.themeIds");
  assert.equal(
    resolveDenaliRegistryCanonicalPath("programNature.shortDescription"),
    "program.shortDescription",
  );
  assert.equal(
    resolveDenaliRegistryCanonicalPath("programNature.longDescription"),
    "program.longDescription",
  );
});

test("resolveDenaliRegistryCanonicalPath keeps itinerary and outdoor metrics on program.*", () => {
  assert.equal(
    resolveDenaliRegistryCanonicalPath("programNature.itinerary"),
    "program.itinerary",
  );
  assert.equal(
    resolveDenaliRegistryCanonicalPath("programNature.difficultyLevel"),
    "program.difficultyLevel",
  );
});

test("resolveDenaliRegistryCanonicalPath maps gallery and logistics aliases", () => {
  assert.equal(resolveDenaliRegistryCanonicalPath("photosData.photos"), "photos");
  assert.equal(
    resolveDenaliRegistryCanonicalPath("tripDetails.logistics.gatheringPoints"),
    "gatheringPoints",
  );
});

test("getDenaliCanonicalPathValue reads content via form aliases after step relocation", () => {
  const model = {
    program: {
      themeIds: ["theme-a"],
      shortDescription: "Short copy",
      longDescription: "Long copy",
      itinerary: [{ day: 1, activities: "Day one" }],
    },
    photos: [{ id: "p1", url: "https://cdn.example/p.jpg" }],
    gatheringPoints: [{ addressText: "Tehran", latitude: 35.7, longitude: 51.4 }],
  } as unknown as DenaliCanonicalTourModel;

  assert.deepEqual(
    getDenaliCanonicalPathValue(model, "programNature.themeIds"),
    ["theme-a"],
  );
  assert.equal(
    getDenaliCanonicalPathValue(model, "programNature.shortDescription"),
    "Short copy",
  );
  assert.deepEqual(getDenaliCanonicalPathValue(model, "photosData.photos"), model.photos);
  assert.deepEqual(
    getDenaliCanonicalPathValue(model, "tripDetails.logistics.gatheringPoints"),
    model.gatheringPoints,
  );
});

test("isKnownDenaliCanonicalPath accepts canonical registry leaves after relocation", () => {
  assert.equal(isKnownDenaliCanonicalPath("program.themeIds"), true);
  assert.equal(isKnownDenaliCanonicalPath("program.shortDescription"), true);
  assert.equal(isKnownDenaliCanonicalPath("program.itinerary"), true);
});
