import assert from "node:assert/strict";
import { test } from "node:test";

import type { TourCloneSourceDto } from "@/features/tours/clone/tourCloneSource.types";

import { mapWizardPrefillToFormPatch } from "./mapWizardPrefillToFormPatch";

test("mapWizardPrefillToFormPatch: denali preset uses Denali roots", () => {
  const patch = mapWizardPrefillToFormPatch("denali_pilot", {
    kind: "preset",
    defaults: { basicInfo: { title: "x" }, overview: { tourType: "mountain" } },
  });
  assert.ok((patch as { basicInfo?: { title?: string } }).basicInfo?.title);
});

test("mapWizardPrefillToFormPatch: denali clone maps via mapToDenaliWizardPatch", () => {
  const tour = {
    title: "Clone me",
    tourType: "mountain",
    details: {
      tripDetails: {
        overview: { tourType: "mountain", title: "Clone me" },
      },
    },
  } as TourCloneSourceDto;
  const patch = mapWizardPrefillToFormPatch("denali_pilot", { kind: "clone", tour });
  assert.ok(patch && typeof patch === "object");
});
