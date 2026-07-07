import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDenaliCreatePrefilledForm } from "../src/ui/chrome/draft-binding";
import { resolveDenaliCreateTourWizardScreen } from "../src/ui/chrome/create-tour-wizard-screen";
import { getCanonicalValue } from "../src/draft/denali-tour-wizard-draft";
import { DENALI_DEFAULT_TOUR_KIND } from "../src/ui/logic/denali-default-tour-kind";

describe("buildDenaliCreatePrefilledForm", () => {
  it("applies default tour kind then template prefill", () => {
    const gate = {
      seedLabel: "Seed",
      fieldOverlays: new Map<string, { defaultValue?: string }>(),
    };
    const result = buildDenaliCreatePrefilledForm(gate, (draft, g) => ({
      ...draft,
      title: g.seedLabel,
    }));
    assert.equal(result.title, "Seed");
    assert.equal(getCanonicalValue(result, "category"), DENALI_DEFAULT_TOUR_KIND);
  });
});

describe("resolveDenaliCreateTourWizardScreen", () => {
  it("returns clone-loading when clone is loading", () => {
    assert.equal(
      resolveDenaliCreateTourWizardScreen({
        gateLoading: false,
        gatePublished: true,
        cloneTourId: "tour-1",
        cloneStatus: "loading",
        denaliDraftReady: false,
      }),
      "clone-loading"
    );
  });

  it("returns gate-loading when integration runtime is loading", () => {
    assert.equal(
      resolveDenaliCreateTourWizardScreen({
        gateLoading: false,
        integrationRuntimeLoading: true,
        gatePublished: true,
        cloneTourId: null,
        cloneStatus: "idle",
        denaliDraftReady: true,
      }),
      "gate-loading"
    );
  });

  it("returns ready when gate published and draft ready", () => {
    assert.equal(
      resolveDenaliCreateTourWizardScreen({
        gateLoading: false,
        gatePublished: true,
        cloneTourId: null,
        cloneStatus: "idle",
        denaliDraftReady: true,
      }),
      "ready"
    );
  });
});
