/**
 * Regression guards for Denali wizard draft save-loop fixes (INV-DENALI-WIZ-004).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali";
import { patchDenaliCanonicalBasics } from "@app-tour/workspace-denali/plugin";

import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { persistDenaliWizardDraftChange } from "@app-tour/workspace-denali/ui/chrome/draft-persist";
import { rebaseCategoryDraftChange } from "@app-tour/workspace-denali/ui/logic/denali-tour-kind-field-logic";
import {
  createDenaliWizardDraftTestEngine,
  denaliFreshStartEnvelope,
  journalMethodsAfter,
} from "./helpers/denali-wizard-draft-fixtures";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("denali-wizard-save-loop.spec.ts", () => {
  const restores: Array<() => void> = [];
  afterEach(() => {
    while (restores.length > 0) {
      restores.pop()?.();
    }
  });

  it("WEB-WIZ-LOOP-01 duplicate persist after flush stays IDLE with no extra PATCH", async () => {
    const sessionId = "loop-01";
    const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine({ sessionId });
    restores.push(restoreFetch);

    const envelope = denaliFreshStartEnvelope(sessionId);
    server.seed({
      data: envelope,
      version: 1,
      schemaVersion: 1,
      lastModified: Date.now(),
    });
    await engine.initialize();

    let current = envelope;
    const persist = (next: ReturnType<typeof emptyTourWizardDraft>) => {
      persistDenaliWizardDraftChange(next, {
        getEnvelope: () => current,
        setEnvelope: (prepared) => {
          current = prepared;
          engine.setDraftData(prepared);
        },
        denaliRules: null,
        denaliPlugin: null,
        wizardRuleEvalContext: undefined,
      });
    };

    const edited = setCanonicalStringValue(envelope.form, "title", "تور بدون حلقه");
    persist(edited);
    await engine.flush();
    assert.equal(engine.getState().status, "IDLE");

    const patchCountAfterFirst = journalMethodsAfter(server.journal, "PATCH", -1).length;
    assert.equal(patchCountAfterFirst, 1);

    persist(edited);
    persist(current.form);
    await sleep(600);
    assert.equal(engine.getState().status, "IDLE");
    assert.equal(journalMethodsAfter(server.journal, "PATCH", -1).length, patchCountAfterFirst);
  });

  it("WEB-WIZ-LOOP-02 prePush gate clone with freshStart does not re-dirty after push", async () => {
    const sessionId = "loop-02";
    const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine({
      sessionId,
      withMerge: true,
    });
    restores.push(restoreFetch);

    const envelope = denaliFreshStartEnvelope(sessionId);
    server.seed({
      data: envelope,
      version: 1,
      schemaVersion: 1,
      lastModified: Date.now(),
    });
    await engine.initialize();

    const withTitle = denaliPrepareDraftEnvelope(
      setCanonicalStringValue(envelope.form, "title", "تست prePush"),
      { ...envelope.meta, freshStart: true }
    );
    engine.setDraftData(withTitle);
    await engine.flush();
    assert.equal(engine.getState().status, "IDLE");

    const patchCount = journalMethodsAfter(server.journal, "PATCH", -1).length;
    assert.equal(patchCount, 1);
    assert.equal(
      getCanonicalStringValue(engine.getState().data?.form ?? emptyTourWizardDraft(), "title"),
      "تست prePush"
    );
  });

  it("WEB-WIZ-LOOP-03 duplicate category persist does not trigger extra PATCH", async () => {
    const sessionId = "loop-03";
    const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine({ sessionId });
    restores.push(restoreFetch);

    const envelope = denaliFreshStartEnvelope(sessionId);
    server.seed({
      data: envelope,
      version: 1,
      schemaVersion: 1,
      lastModified: Date.now(),
    });
    await engine.initialize();

    let current = envelope;
    const persist = (next: ReturnType<typeof emptyTourWizardDraft>) => {
      persistDenaliWizardDraftChange(next, {
        getEnvelope: () => current,
        setEnvelope: (prepared) => {
          current = prepared;
          engine.setDraftData(prepared);
        },
        denaliRules: null,
        denaliPlugin: null,
        wizardRuleEvalContext: undefined,
      });
    };

    const natureSlug = patchDenaliCanonicalBasics(undefined, {
      category: "nature",
      duration: "single_day",
    });
    persist(rebaseCategoryDraftChange(current.form, natureSlug));
    await engine.flush();
    assert.equal(engine.getState().status, "IDLE");

    const patchAfterCategory = journalMethodsAfter(server.journal, "PATCH", -1).length;
    assert.equal(patchAfterCategory, 1);

    persist(rebaseCategoryDraftChange(current.form, natureSlug));
    await sleep(600);
    assert.equal(engine.getState().status, "IDLE");
    assert.equal(journalMethodsAfter(server.journal, "PATCH", -1).length, patchAfterCategory);

    const mountainSlug = patchDenaliCanonicalBasics(natureSlug, { category: "mountain" });
    persist(rebaseCategoryDraftChange(current.form, mountainSlug));
    await engine.flush();
    assert.equal(engine.getState().status, "IDLE");
    assert.equal(journalMethodsAfter(server.journal, "PATCH", -1).length, patchAfterCategory + 1);
    assert.equal(getCanonicalStringValue(current.form, "category"), mountainSlug);
  });
});
