import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isDenaliFlatEditDraftStaleVsTour,
  prepareDenaliFlatEditSeedEnvelope,
  replaceDenaliFlatEditDraftAfterSuccessfulPatch,
  resolveDenaliFlatEditWorkingEnvelope,
  shouldSeedDenaliFlatEditDraftFromTour,
} from "../src/ui/chrome/flat-edit-draft-authority.ts";
import { denaliPrepareDraftEnvelope } from "../src/draft/denali-wizard-draft-binding.ts";

const envelopeMeta = { currentStepIndex: 0, wizardSessionId: "sess-edit" };

describe("flat-edit-draft-authority.spec.ts — DEN-12.4-DRAFT", () => {
  it("DEN-12.4-DRAFT-01 stamps sourceRowVersion on seed envelopes", () => {
    const seed = prepareDenaliFlatEditSeedEnvelope(
      { data: { title: "Saved" } },
      envelopeMeta,
      4
    );
    assert.equal(seed.meta.sourceRowVersion, 4);
    assert.equal(seed.meta.wizardSessionId, "sess-edit");
    assert.equal(seed.form.data.title, "Saved");
  });

  it("DEN-12.4-DRAFT-02 keeps unsaved draft when stamp matches tour rowVersion", () => {
    const remote = prepareDenaliFlatEditSeedEnvelope(
      { data: { title: "Unsaved edit" } },
      envelopeMeta,
      2
    );
    const working = resolveDenaliFlatEditWorkingEnvelope({
      remoteDraft: remote,
      tourBaseline: { data: { title: "Saved" } },
      tourRowVersion: 2,
      envelopeMeta,
    });
    assert.equal(working?.form.data.title, "Unsaved edit");
  });

  it("DEN-12.4-DRAFT-03 discards draft when stamp is older than tour rowVersion", () => {
    const remote = prepareDenaliFlatEditSeedEnvelope(
      { data: { title: "Stale autosave" } },
      envelopeMeta,
      1
    );
    const working = resolveDenaliFlatEditWorkingEnvelope({
      remoteDraft: remote,
      tourBaseline: { data: { title: "Patched title" } },
      tourRowVersion: 2,
      envelopeMeta,
    });
    assert.equal(working?.form.data.title, "Patched title");
    assert.equal(working?.meta.sourceRowVersion, 2);
  });

  it("DEN-12.4-DRAFT-04 keeps unstamped drafts so pre-stamp unsaved work survives", () => {
    const remote = denaliPrepareDraftEnvelope(
      { data: { title: "Unstamped unsaved" } },
      envelopeMeta
    );
    assert.equal(remote.meta.sourceRowVersion, undefined);
    assert.equal(isDenaliFlatEditDraftStaleVsTour(remote, 2), false);
    const working = resolveDenaliFlatEditWorkingEnvelope({
      remoteDraft: remote,
      tourBaseline: { data: { title: "Canonical" } },
      tourRowVersion: 2,
      envelopeMeta,
    });
    assert.equal(working?.form.data.title, "Unstamped unsaved");
  });

  it("DEN-12.4-DRAFT-05 hydrates from tour when remote draft is absent", () => {
    const working = resolveDenaliFlatEditWorkingEnvelope({
      remoteDraft: null,
      tourBaseline: { data: { title: "From GET" } },
      tourRowVersion: 3,
      envelopeMeta,
    });
    assert.equal(working?.form.data.title, "From GET");
    assert.equal(working?.meta.sourceRowVersion, 3);
  });

  it("DEN-12.4-DRAFT-06 does not seed while draft engine is syncing", () => {
    assert.equal(
      shouldSeedDenaliFlatEditDraftFromTour({
        remoteDraft: null,
        tourRowVersion: 1,
        draftStatus: "SYNCING",
      }),
      false
    );
    assert.equal(
      shouldSeedDenaliFlatEditDraftFromTour({
        remoteDraft: null,
        tourRowVersion: 1,
        draftStatus: "READY",
      }),
      true
    );
    const stale = prepareDenaliFlatEditSeedEnvelope({ data: {} }, envelopeMeta, 1);
    assert.equal(
      shouldSeedDenaliFlatEditDraftFromTour({
        remoteDraft: stale,
        tourRowVersion: 2,
        draftStatus: "READY",
      }),
      true
    );
  });

  it("DEN-12.4-DRAFT-07 clearDraftAndReset seeds GET snapshot without a null gap", async () => {
    const events: string[] = [];
    let current: { data: { title: string } } | null = { data: { title: "Old baseline" } };
    await replaceDenaliFlatEditDraftAfterSuccessfulPatch({
      baseline: { data: { title: "GET after PATCH" } },
      envelopeMeta,
      tourRowVersion: 2,
      draftSync: {
        setData: (envelope) => {
          events.push(`setData:${envelope.form.data.title}:${envelope.meta.sourceRowVersion}`);
          current = envelope.form;
        },
        clearDraft: async () => {
          events.push("clearDraft");
          current = null;
        },
        clearDraftAndReset: async (reset) => {
          events.push(
            `clearDraftAndReset:${reset.form.data.title}:${reset.meta.sourceRowVersion}`
          );
          current = reset.form;
        },
      },
    });
    assert.deepEqual(events, ["clearDraftAndReset:GET after PATCH:2"]);
    assert.equal(current?.data.title, "GET after PATCH");
  });

  it("DEN-12.4-DRAFT-08 falls back to clear then setData when reset is unavailable", async () => {
    const events: string[] = [];
    await replaceDenaliFlatEditDraftAfterSuccessfulPatch({
      baseline: { data: { title: "GET after PATCH" } },
      envelopeMeta,
      tourRowVersion: 5,
      draftSync: {
        setData: (envelope) => {
          events.push(`setData:${envelope.form.data.title}:${envelope.meta.sourceRowVersion}`);
        },
        clearDraft: async () => {
          events.push("clearDraft");
        },
      },
    });
    assert.deepEqual(events, ["clearDraft", "setData:GET after PATCH:5"]);
  });
});
