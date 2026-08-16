import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyDenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../src/draft/denali-tour-wizard-draft";
import type { DestinationResource } from "../src/ui/adapters/catalog-types";
import { persistDenaliWizardDraftChange } from "../src/ui/chrome/draft-persist";
import type { DenaliWizardDraftEnvelope } from "../src/draft/denali-wizard-draft-binding";
import type { DenaliTourWizardDraft } from "../src/draft/denali-tour-wizard-draft";

function destination(partial: Partial<DestinationResource>): DestinationResource {
  return {
    id: "dest-1",
    regionId: "region-1",
    name: "توچال",
    locationType: "peak",
    altitudeM: 3962,
    typicalTrailDistanceKm: null,
    isActive: true,
    sortOrder: 0,
    ...partial,
  };
}

describe("persistDenaliWizardDraftChange catalog seed (ED-CAT-SEED-01)", () => {
  it("DEN-CAT-SEED-02 persist writes locked peak when mountain cell returns", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalStringValue(draft, "destinationId", "dest-1");
    let stored: DenaliWizardDraftEnvelope<DenaliTourWizardDraft> = {
      form: draft,
      meta: { currentStepIndex: 0 },
    };

    persistDenaliWizardDraftChange(draft, {
      getEnvelope: () => stored,
      setEnvelope: (next) => {
        stored = next;
      },
      denaliRules: null,
      denaliPlugin: null,
      wizardRuleEvalContext: undefined,
      lookupDestination: (id) => (id === "dest-1" ? destination({}) : undefined),
    });

    assert.equal(
      getCanonicalStringValue(stored.form, "tripDetails.overview.peakHeight"),
      "3962"
    );
  });

  it("DEN-CAT-SEED-02b persist without lookup leaves empty peak", () => {
    let draft = setCanonicalStringValue(emptyDenaliTourWizardDraft(), "category", "mountain_day");
    draft = setCanonicalStringValue(draft, "destinationId", "dest-1");
    let stored: DenaliWizardDraftEnvelope<DenaliTourWizardDraft> | null = {
      form: draft,
      meta: { currentStepIndex: 0 },
    };

    persistDenaliWizardDraftChange(draft, {
      getEnvelope: () => stored,
      setEnvelope: (next) => {
        stored = next;
      },
      denaliRules: null,
      denaliPlugin: null,
      wizardRuleEvalContext: undefined,
    });

    assert.equal(getCanonicalStringValue(stored!.form, "tripDetails.overview.peakHeight"), "");
  });
});
