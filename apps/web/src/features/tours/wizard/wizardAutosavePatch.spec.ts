import assert from "node:assert/strict";
import test from "node:test";

import { resolveTenantTourFormContract } from "@/features/tours/contracts/tenant-tour-form-contract";
import { buildTourCreateFormDefaultValues } from "@/features/tours/wizard/tourCreateFormDefaults";

import { mergeWizardAutosavePatch, pickTourCreateRootsForStep } from "./wizardAutosavePatch";

test("pickTourCreateRootsForStep returns only roots for the step primary group", () => {
  const values = buildTourCreateFormDefaultValues();
  values.overview.title = "t";
  values.itinerary.days = [{ dayNumber: 1, title: "d", segments: [] }];
  const basic = pickTourCreateRootsForStep(values, "basic");
  assert.ok("overview" in basic);
  assert.ok(!("itinerary" in basic));
  const itinerary = pickTourCreateRootsForStep(values, "itinerary");
  assert.ok("itinerary" in itinerary);
  assert.ok(!("overview" in itinerary));
});

test("mergeWizardAutosavePatch accumulates slices across steps", () => {
  const values = buildTourCreateFormDefaultValues();
  values.overview.title = "merged";
  values.pricing.basePrice = 99_000;
  const contract = resolveTenantTourFormContract(["form_builder", "finance"]);
  let patch = mergeWizardAutosavePatch(undefined, values, "basic", "general", contract);
  patch = mergeWizardAutosavePatch(patch, values, "capacity", "general", contract);
  assert.equal(patch.overview?.title, "merged");
  assert.equal(patch.pricing?.basePrice, 99_000);
});
