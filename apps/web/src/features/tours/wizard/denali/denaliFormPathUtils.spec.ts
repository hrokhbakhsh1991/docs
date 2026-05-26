import assert from "node:assert/strict";
import test from "node:test";

import { denaliFormToCanonical } from "./denaliCanonicalFormAdapter";
import { getDenaliFormPathValue, setDenaliFormPathValue } from "./denaliFormPathUtils";
import { writeDenaliFormFieldValue } from "./rules/denaliRuleRequired";
import { normalizeDenaliWizardForm } from "./validation/denaliRuleAccess";
import { buildDenaliTourCreateTestValues } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

test("get/set preserves tripDetails.logistics siblings when clearing gatheringPoints leaf", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";
  form.tripDetails = {
    logistics: {
      gatheringPoints: [
        { title: "A", location: { addressText: "Tehran", latitude: null, longitude: null } },
      ],
    },
    overview: { customServiceLabels: [] },
  };

  const sentinel = { futureField: "keep-me" };
  (form.tripDetails!.logistics as Record<string, unknown>).futureField = sentinel.futureField;

  setDenaliFormPathValue(form, "tripDetails.logistics.gatheringPoints", undefined);

  assert.equal(getDenaliFormPathValue(form, "tripDetails.logistics.gatheringPoints"), undefined);
  assert.equal(
    (form.tripDetails?.logistics as Record<string, unknown>).futureField,
    "keep-me",
    "sibling logistics keys must survive leaf clear",
  );
  assert.ok(form.tripDetails?.logistics != null && !Array.isArray(form.tripDetails.logistics));
});

test("writeDenaliFormFieldValue + denaliFormToCanonical: gatheringPoints round-trip", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "mountain_day";

  writeDenaliFormFieldValue(form, "gatheringPoints", [
    { title: "Station A", location: { addressText: "Tehran", latitude: null, longitude: null } },
  ]);

  assert.ok(!Array.isArray(form.tripDetails?.logistics));
  assert.equal(form.tripDetails?.logistics?.gatheringPoints?.length, 1);

  const canonical = denaliFormToCanonical(form);
  assert.equal(canonical.gatheringPoints?.length, 1);
});

test("normalizeDenaliWizardForm on event clears gatheringPoints without corrupting logistics shape", () => {
  const form = buildDenaliTourCreateTestValues();
  form.basicInfo.tourType = "event_cinema";
  form.tripDetails = {
    logistics: {
      gatheringPoints: [
        { title: "X", location: { addressText: "Y", latitude: null, longitude: null } },
      ],
    },
    overview: { customServiceLabels: [] },
  };
  (form.tripDetails.logistics as Record<string, unknown>).futureField = "persist";

  const normalized = normalizeDenaliWizardForm(form);

  assert.equal(normalized.tripDetails?.logistics?.gatheringPoints, undefined);
  assert.equal(
    (normalized.tripDetails?.logistics as Record<string, unknown> | undefined)?.futureField,
    "persist",
  );
  assert.equal(denaliFormToCanonical(normalized).gatheringPoints, undefined);
});
