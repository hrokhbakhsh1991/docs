import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveCreateTourCloneHydrateKey,
  runCreateTourCloneHydrateSequence,
} from "../src/ui/chrome/create-tour-clone-hydrate-sequence";

describe("create-tour-clone-hydrate-sequence.spec.ts — P15 clone orchestration", () => {
  it("P15-CLONE-01 resolveCreateTourCloneHydrateKey is stable per tour + session", () => {
    const key = resolveCreateTourCloneHydrateKey(
      "00000000-0000-4000-8000-000000000099",
      "11111111-1111-4111-8111-111111111111"
    );
    assert.equal(key, "00000000-0000-4000-8000-000000000099:11111111-1111-4111-8111-111111111111");
  });

  it("P15-CLONE-02 runCreateTourCloneHydrateSequence clears draft before apply", async () => {
    const events: string[] = [];
    const result = await runCreateTourCloneHydrateSequence({
      cloneTourId: "tour-1",
      pluginId: "denali",
      wizardSessionId: "session-1",
      hydrateCreateTourFromClone: async () => {
        events.push("hydrate");
        return { draft: { data: { title: "Clone" } } };
      },
      clearDraft: async () => {
        events.push("clear");
      },
      applyHydratedDraft: () => {
        events.push("apply");
      },
    });
    assert.deepEqual(events, ["hydrate", "clear", "apply"]);
    assert.equal(result.photoRemintFailed, false);
  });

  it("P15-CLONE-03 hydrate failure skips clear and apply", async () => {
    const events: string[] = [];
    await assert.rejects(
      () =>
        runCreateTourCloneHydrateSequence({
          cloneTourId: "tour-1",
          pluginId: "denali",
          wizardSessionId: "session-1",
          hydrateCreateTourFromClone: async () => {
            events.push("hydrate");
            throw new Error("TOUR_CLONE_HTTP_404");
          },
          clearDraft: async () => {
            events.push("clear");
          },
          applyHydratedDraft: () => {
            events.push("apply");
          },
        }),
      /TOUR_CLONE_HTTP_404/
    );
    assert.deepEqual(events, ["hydrate"]);
  });

  it("P15-CLONE-04 photoRemintFailed propagates from hydrate result", async () => {
    const result = await runCreateTourCloneHydrateSequence({
      cloneTourId: "tour-1",
      pluginId: "denali",
      wizardSessionId: "session-1",
      hydrateCreateTourFromClone: async () => ({
        draft: { data: { title: "Clone" } },
        photoRemintFailed: true,
      }),
      clearDraft: async () => {},
      applyHydratedDraft: () => {},
    });
    assert.equal(result.photoRemintFailed, true);
  });
});
