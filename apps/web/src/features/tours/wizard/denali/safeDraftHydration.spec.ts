import assert from "node:assert/strict";
import test from "node:test";

import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import {
  parseDenaliWizardDraftRecord,
  serializeDenaliWizardDraft,
} from "@/features/tours/wizard/denaliWizardDraftEnvelope";

import { getDenaliWizardDraftVersionHash } from "./denaliWizardDraftVersion";
import {
  DenaliDraftVersionMismatchError,
  isDenaliWizardDraftLoadable,
  tryHydrateDraft,
} from "./safeDraftHydration";

test("tryHydrateDraft returns hydrated form when versionHash matches", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.title = "Safe hydration";

  const parsed = parseDenaliWizardDraftRecord(serializeDenaliWizardDraft(form, undefined));
  assert.ok(parsed);

  const hydrated = tryHydrateDraft(parsed, defaults);
  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.title, "Safe hydration");
});

test("tryHydrateDraft returns null when versionHash mismatches", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const parsed = parseDenaliWizardDraftRecord(
    JSON.stringify({
      _wizardRail: "denali",
      versionHash: "deadbeef",
      basicInfo: { title: "Stale draft" },
    }),
  );
  assert.ok(parsed);

  assert.equal(tryHydrateDraft(parsed, defaults), null);
  assert.equal(isDenaliWizardDraftLoadable(parsed), false);
});

test("tryHydrateDraft throws DenaliDraftVersionMismatchError when requested", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const parsed = parseDenaliWizardDraftRecord(
    JSON.stringify({
      _wizardRail: "denali",
      versionHash: "deadbeef",
      basicInfo: { title: "Stale draft" },
    }),
  );
  assert.ok(parsed);

  assert.throws(
    () => tryHydrateDraft(parsed, defaults, { throwOnVersionMismatch: true }),
    (err: unknown) => {
      assert.ok(err instanceof DenaliDraftVersionMismatchError);
      assert.equal(err.storedVersionHash, "deadbeef");
      assert.equal(err.currentVersionHash, getDenaliWizardDraftVersionHash());
      return true;
    },
  );
});

test("tryHydrateDraft clears ghost fields via rule engine", () => {
  const defaults = buildDenaliTourCreateDefaultValues();
  const form = buildDenaliTourCreateDefaultValues();
  form.basicInfo.tourType = "mountain_day";
  form.basicInfo.endDateTime = "2026-06-03T18:00:00.000Z";

  const parsed = parseDenaliWizardDraftRecord(serializeDenaliWizardDraft(form, undefined));
  const hydrated = tryHydrateDraft(parsed, defaults);

  assert.ok(hydrated);
  assert.equal(hydrated.formValues.basicInfo.endDateTime, undefined);
});
