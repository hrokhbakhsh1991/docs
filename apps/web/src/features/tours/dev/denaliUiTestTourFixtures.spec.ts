import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliCore.schema";

import {
  DENALI_UI_TEST_TOUR_FIXTURES,
  type DenaliUiTestTourCatalog,
} from "./denaliUiTestTourFixtures";
import { buildDenaliUiTestTourForm } from "./seedDenaliUiTestTours";

const MOCK_CATALOG: DenaliUiTestTourCatalog = {
  destinationId: buildDenaliTourCreateTestValues().basicInfo.destinationId!,
  themeId: buildDenaliTourCreateTestValues().programNature.themeIds[0]!,
  themeName: "Mock Theme",
};

test("buildDenaliUiTestTourForm produces submit-valid forms for all UI fixtures", () => {
  for (const fixture of DENALI_UI_TEST_TOUR_FIXTURES) {
    const form = buildDenaliUiTestTourForm(fixture, MOCK_CATALOG);
    assert.equal(form.basicInfo.title, fixture.title);
    assert.equal(form.basicInfo.tourType, fixture.tourType);
    assert.equal(form.basicInfo.capacityMax, fixture.capacityMax);
    assert.equal(form.photosData.photos.length, 0);
    assert.equal(form.programNature.themeIds[0], MOCK_CATALOG.themeId);
  }
});
