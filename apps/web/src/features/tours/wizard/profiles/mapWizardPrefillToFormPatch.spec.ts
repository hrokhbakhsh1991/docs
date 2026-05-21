import assert from "node:assert/strict";
import { test } from "node:test";

import type { TourCloneSourceDto } from "@/features/tours/clone/transformTourToWizardValues";

import { mapWizardPrefillToFormPatch } from "./mapWizardPrefillToFormPatch";

test("mapWizardPrefillToFormPatch: denali preset uses 6-tab roots", () => {
  const patch = mapWizardPrefillToFormPatch("denali_pilot", {
    kind: "preset",
    defaults: { basicInfo: { title: "x" }, overview: { tourType: "mountain" } },
  });
  assert.ok((patch as any).basicInfo);
  assert.equal((patch as { overview?: unknown }).overview, undefined);
});

test("mapWizardPrefillToFormPatch: classic preset uses overview roots", () => {
  const patch = mapWizardPrefillToFormPatch("mountain_outdoor", {
    kind: "preset",
    defaults: { overview: { tourType: "mountain" }, basicInfo: { title: "y" } },
  });
  assert.ok((patch as { overview?: { tourType?: string } }).overview?.tourType);
});

test("mapWizardPrefillToFormPatch: classic clone delegates to transformTourToWizardValues", () => {
  const tour = {
    title: "Clone me",
    tourType: "mountain",
    details: {
      tripDetails: {
        overview: { tourType: "mountain", title: "Clone me" },
      },
    },
  } as TourCloneSourceDto;
  const patch = mapWizardPrefillToFormPatch("mountain_outdoor", { kind: "clone", tour });
  assert.equal((patch as { overview?: { tourType?: string } }).overview?.tourType, "mountain");
});
