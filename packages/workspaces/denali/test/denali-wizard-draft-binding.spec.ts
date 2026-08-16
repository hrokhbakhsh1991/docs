import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDenaliCreateTourDiscardRemoteDraftInput,
  buildDenaliWizardFreshStartMeta,
  buildDenaliWizardStepZeroMeta,
  denaliCreateTourRemoteDraftIdentity,
  denaliEditTourDraftKey,
  denaliEditTourRemoteDraftIdentity,
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  DENALI_CREATE_TOUR_DRAFT_KEY,
  DENALI_CREATE_TOUR_SUPPORTS_CLONE,
  DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
  prepareDenaliCreateTourFreshStartEnvelope,
  readDenaliWizardSourceRowVersion,
} from "../src/draft/denali-wizard-draft-binding";

describe("denali-wizard-draft-binding.spec.ts — Phase 11.5", () => {
  it("WEB-P11-5-01 prepare clones form and meta", () => {
    const form = { data: { basics: { title: "Alpine" } } };
    const envelope = denaliPrepareDraftEnvelope(form, {
      currentStepIndex: 2,
      wizardSessionId: "session-1",
    });
    assert.notEqual(envelope.form, form);
    assert.deepEqual(envelope.form, form);
    assert.equal(envelope.meta.currentStepIndex, 2);
    assert.equal(envelope.meta.wizardSessionId, "session-1");
  });

  it("WEB-P11-5-02 hydrate uses remote step index", () => {
    const remote = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Remote" } } },
      { currentStepIndex: 3, wizardSessionId: "remote" }
    );
    const hydrated = denaliHydrateDraftEnvelope(
      remote,
      { data: { basics: { title: "Fallback" } } },
      { currentStepIndex: 0, wizardSessionId: "local" }
    );
    assert.equal(hydrated.meta.currentStepIndex, 3);
    assert.equal(hydrated.meta.wizardSessionId, "remote");
    assert.equal(hydrated.form.data.basics.title, "Remote");
  });

  it("WEB-P11-5-03 hydrate null falls back to template form", () => {
    const hydrated = denaliHydrateDraftEnvelope(
      null,
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 1, wizardSessionId: "ws-1" }
    );
    assert.equal(hydrated.meta.currentStepIndex, 1);
    assert.equal(hydrated.meta.wizardSessionId, "ws-1");
    assert.equal(hydrated.form.data.basics.title, "Seed");
  });

  it("WEB-P11-5-04 edit draft key is scoped per tour id", () => {
    assert.equal(denaliEditTourDraftKey("abc-123"), "denali-edit:abc-123");
    assert.equal(denaliEditTourDraftKey("  "), "denali-edit:unknown");
  });

  it("WEB-P11-5-05 prepare preserves freshStart meta flag", () => {
    const envelope = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 0, freshStart: true }
    );
    assert.equal(envelope.meta.freshStart, true);
  });

  it("WEB-P11-5-06 prepare and hydrate strip deletedRoots from client meta (Track B)", () => {
    const envelope = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 1, deletedRoots: ["details", "program"] }
    );
    assert.equal(envelope.meta.deletedRoots, undefined);
    const hydrated = denaliHydrateDraftEnvelope(
      {
        form: { data: { basics: { title: "Remote" } } },
        meta: { currentStepIndex: 2, deletedRoots: ["photos"] },
      },
      { data: { basics: { title: "Fallback" } } },
      { currentStepIndex: 0 }
    );
    assert.equal(hydrated.meta.deletedRoots, undefined);
    assert.equal(hydrated.meta.currentStepIndex, 2);
  });

  it("P2-C.7 step-zero and freshStart meta builders", () => {
    assert.deepEqual(buildDenaliWizardStepZeroMeta("ws-1"), {
      currentStepIndex: 0,
      wizardSessionId: "ws-1",
    });
    assert.deepEqual(buildDenaliWizardFreshStartMeta("ws-2"), {
      currentStepIndex: 0,
      wizardSessionId: "ws-2",
      freshStart: true,
    });
  });

  it("P2-C.13 create tour remote draft identity and discard input", () => {
    assert.deepEqual(denaliCreateTourRemoteDraftIdentity(), {
      namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
      draftKey: DENALI_CREATE_TOUR_DRAFT_KEY,
    });
    assert.deepEqual(buildDenaliCreateTourDiscardRemoteDraftInput("ws-9"), {
      workspaceId: "ws-9",
      namespace: "operator.wizard",
      draftKey: "denali-create",
    });
  });

  it("P2-C.14 supports-clone flag and fresh-start envelope helper", () => {
    assert.equal(DENALI_CREATE_TOUR_SUPPORTS_CLONE, true);
    const form = { data: { basics: { title: "Seed" } } };
    const envelope = prepareDenaliCreateTourFreshStartEnvelope(
      denaliPrepareDraftEnvelope,
      form,
      "ws-fresh"
    );
    assert.equal(envelope.meta.currentStepIndex, 0);
    assert.equal(envelope.meta.wizardSessionId, "ws-fresh");
    assert.equal(envelope.meta.freshStart, true);
    assert.equal(envelope.form.data.basics.title, "Seed");
  });

  it("WEB-P11-5-07 prepare and hydrate preserve sourceRowVersion (flat-edit stamp)", () => {
    const envelope = denaliPrepareDraftEnvelope(
      { data: { basics: { title: "Seed" } } },
      { currentStepIndex: 0, wizardSessionId: "edit-1", sourceRowVersion: 3 }
    );
    assert.equal(envelope.meta.sourceRowVersion, 3);
    const hydratedRemote = denaliHydrateDraftEnvelope(
      envelope,
      { data: { basics: { title: "Fallback" } } },
      { currentStepIndex: 0 }
    );
    assert.equal(hydratedRemote.meta.sourceRowVersion, 3);
    const hydratedNull = denaliHydrateDraftEnvelope(
      null,
      { data: { basics: { title: "From tour" } } },
      { currentStepIndex: 0, wizardSessionId: "edit-1", sourceRowVersion: 7 }
    );
    assert.equal(hydratedNull.meta.sourceRowVersion, 7);
    assert.equal(hydratedNull.form.data.basics.title, "From tour");
  });

  it("WEB-P11-5-08 sourceRowVersion reader keeps integers ≥ 0 and strips the rest", () => {
    assert.equal(readDenaliWizardSourceRowVersion(0), 0);
    assert.equal(readDenaliWizardSourceRowVersion(3), 3);
    assert.equal(readDenaliWizardSourceRowVersion(1.5), undefined);
    assert.equal(readDenaliWizardSourceRowVersion(Number.NaN), undefined);
    assert.equal(readDenaliWizardSourceRowVersion(-1), undefined);
    const stripped = denaliPrepareDraftEnvelope(
      { data: {} },
      { currentStepIndex: 0, sourceRowVersion: 1.5 as unknown as number }
    );
    assert.equal(stripped.meta.sourceRowVersion, undefined);
  });

  it("P2-C.15 edit tour remote draft identity scopes key per tour", () => {
    assert.deepEqual(denaliEditTourRemoteDraftIdentity("abc-123"), {
      namespace: DENALI_OPERATOR_WIZARD_DRAFT_NAMESPACE,
      draftKey: "denali-edit:abc-123",
    });
    assert.equal(denaliEditTourRemoteDraftIdentity("  ").draftKey, "denali-edit:unknown");
  });
});
