import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR } from "../src/composites/denali-composite-anchors";
import { DENALI_FIELD_DEFINITIONS } from "../src/field-registry/denaliFieldRegistryData";
import {
  getCanonicalStringFromDraft,
  setCanonicalValueOnDraft,
} from "../src/wizard/canonical-draft-access";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali-wizard-rule-eval-context";
import { loadDenaliWizardRulesModule } from "../src/wizard/denali-wizard-host-hooks";
import { sanitizeDenaliWizardDraftEnvelope } from "../src/wizard/denali-wizard-draft-sanitize";

describe("denali-transport-seat-preference-contract (INV-DENALI-WIZ-016)", () => {
  const seat = DENALI_FIELD_DEFINITIONS.find(
    (field) => field.canonicalPath === "transport.seatPreference"
  );

  it("DN-SEAT-01 settingsSurface deprecated does not drop wizard ownership", () => {
    assert.ok(seat != null);
    assert.equal(seat.settingsSurface, "deprecated");
    assert.deepEqual(seat.contextualRequired, { kind: "transportTrainSeatVisible" });
    assert.deepEqual(seat.contextualVisibility, { kind: "transportTrainSeatVisible" });
    assert.deepEqual(seat.structuralInvariant, { kind: "clearWhenNotVisible" });
    assert.match(seat.notes ?? "", /denali\.transport-mode/);
    assert.doesNotMatch(seat.notes ?? "", /no modern wizard input/i);
  });

  it("DN-SEAT-02 transport.mode composite dependents include seatPreference", () => {
    assert.ok(
      DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR["transport.mode"]?.includes(
        "transport.seatPreference"
      )
    );
  });

  it("DN-SEAT-03 sanitize clears seatPreference when mode leaves train", async () => {
    const rules = await loadDenaliWizardRulesModule();
    const ctx = buildDenaliWizardRuleEvalContext();
    let envelope = setCanonicalValueOnDraft({ data: {} }, "category", "mountain_day");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "train");
    envelope = setCanonicalValueOnDraft(envelope, "transport.seatPreference", "window");
    envelope = setCanonicalValueOnDraft(envelope, "transport.mode", "bus");

    const sanitized = sanitizeDenaliWizardDraftEnvelope(envelope, rules, ctx);
    assert.equal(getCanonicalStringFromDraft(sanitized, "transport.seatPreference"), "");
  });
});
