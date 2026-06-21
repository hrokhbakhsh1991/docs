/**
 * Denali create-wizard draft — behavioral contract (single source for web layer).
 *
 * Tiers in this file:
 * - defaults / step inference — pure functions, no I/O
 * - clear & reset — DraftEngine + mock BFF (replaces scattered INT/DEF/RESUME specs)
 *
 * Merge/tombstone envelopes: denali-wizard-draft-resume.spec.ts
 * Engine primitives: packages/draft-engine/test/engine.spec.ts
 * Step inference (workspace): packages/workspaces/denali/test/resolve-initial-step-index.spec.ts
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DraftEngine } from "@app-tour/draft-engine";
import { denaliPrepareDraftEnvelope } from "@app-tour/workspace-denali";

import { loadDenaliWizardRulesModule } from "../src/bootstrap/denali-wizard-rules";
import { mergeDenaliWizardDraftEnvelope } from "../src/draft/denali-wizard-draft-merge";
import {
  hasNonEmptyCanonicalValue,
  isDraftEssentiallyEmpty,
  readDenaliDraftFieldValue,
  resolveDenaliInitialStepIndex,
  resolveDenaliWizardResumeStepIndex,
} from "../src/draft/denali-wizard-resume-step";
import { runDenaliWizardClearDraftSequence } from "../src/draft/run-denali-wizard-clear-draft-sequence";
import { emptyTourWizardDraft } from "../src/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "../src/tours/tour-wizard-draft-path";
import { sanitizeDenaliWizardDraft } from "../src/wizard/denali/denali-draft-form-adapter";
import { buildDenaliWizardRuleEvalContext } from "../src/wizard/denali/denali-wizard-ui-context";
import {
  applyDenaliDefaultTourKind,
  DENALI_DEFAULT_TOUR_KIND,
} from "../src/wizard/denali/denali-default-tour-kind";
import {
  isDenaliTourKindChoiceActive,
  resolveDenaliTourKindUiBasics,
} from "../src/wizard/denali/denali-tour-kind-field-logic";
import {
  createDenaliWizardDraftMergeAdapter,
  createDenaliWizardDraftTestEngine,
  createFreshDenaliWizardDraftAdapter,
  createSlowPatchGate,
  denaliFreshStartEnvelope,
  DENALI_WIZARD_TEMPLATE_STEPS,
  denaliStepFiveEnvelope,
  journalMethodsAfter,
} from "./helpers/denali-wizard-draft-fixtures";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("denali-wizard-draft-contract", () => {
  describe("defaults — create wizard seed", () => {
    it("DWC-DEF-01 seeds mountain_day in canonical draft", () => {
      const draft = applyDenaliDefaultTourKind(emptyTourWizardDraft());
      assert.equal(getCanonicalStringValue(draft, "category"), DENALI_DEFAULT_TOUR_KIND);
    });

    it("DWC-DEF-02 default draft drives mountain + single_day UI selection", () => {
      const slug = getCanonicalStringValue(applyDenaliDefaultTourKind(emptyTourWizardDraft()), "category");
      const ui = resolveDenaliTourKindUiBasics(slug);

      assert.equal(ui.hasSelection, true);
      assert.deepEqual(ui.basics, { category: "mountain", duration: "single_day" });
      assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.category, "mountain"), true);
      assert.equal(isDenaliTourKindChoiceActive(ui.hasSelection, ui.basics?.duration, "single_day"), true);
    });

    it("DWC-DEF-03 sanitize keeps default category when title is edited", async () => {
      const rules = await loadDenaliWizardRulesModule();
      const ctx = buildDenaliWizardRuleEvalContext();
      let draft = applyDenaliDefaultTourKind(emptyTourWizardDraft());
      draft = setCanonicalStringValue(draft, "title", "Alborz day hike");

      const sanitized = sanitizeDenaliWizardDraft(draft, rules, ctx);
      assert.equal(getCanonicalStringValue(sanitized, "category"), DENALI_DEFAULT_TOUR_KIND);
      assert.equal(getCanonicalStringValue(sanitized, "title"), "Alborz day hike");
    });
  });

  describe("step — resume inference & merge meta", () => {
    it("DWC-STEP-01 merge keeps step 0 when local draft is essentially empty", () => {
      const local = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
        currentStepIndex: 0,
        wizardSessionId: "local",
      });
      const server = denaliPrepareDraftEnvelope(
        { data: { title: "Saved tour" } },
        { currentStepIndex: 3, wizardSessionId: "server" }
      );
      const merged = mergeDenaliWizardDraftEnvelope(local, server);
      assert.equal(merged.meta.currentStepIndex, 0);
    });

    it("DWC-STEP-02 merge keeps active local step during edit conflicts", () => {
      const local = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
        currentStepIndex: 4,
        wizardSessionId: "local",
      });
      const server = denaliPrepareDraftEnvelope(emptyTourWizardDraft(), {
        currentStepIndex: 2,
        wizardSessionId: "server",
      });
      const merged = mergeDenaliWizardDraftEnvelope(local, server);
      assert.equal(merged.meta.currentStepIndex, 4);
    });

    it("DWC-STEP-03 infers furthest step with field data when saved index is 0", () => {
      const draft = { data: { title: "My tour", program: { difficultyLevel: 6 } } };
      assert.equal(resolveDenaliWizardResumeStepIndex(draft, DENALI_WIZARD_TEMPLATE_STEPS, 0), 1);
      assert.equal(resolveDenaliWizardResumeStepIndex(draft, DENALI_WIZARD_TEMPLATE_STEPS, 2), 2);
    });

    it("DWC-STEP-04 freshStart suppresses field inference (no jump to step 5)", () => {
      const draft = { data: { title: "My tour", program: { difficultyLevel: 6 } } };
      assert.equal(
        resolveDenaliInitialStepIndex(
          draft as unknown as Record<string, unknown>,
          DENALI_WIZARD_TEMPLATE_STEPS,
          0,
          undefined,
          { skipFieldInference: true }
        ),
        0
      );
    });

    it("DWC-STEP-05 reads legacy nested paths for resume inference", () => {
      const draft = {
        data: {
          basicInfo: { title: "Legacy title" },
          programNature: { difficultyLevel: 7 },
        },
      };
      assert.equal(readDenaliDraftFieldValue(draft, "title"), "Legacy title");
      assert.equal(resolveDenaliWizardResumeStepIndex(draft, DENALI_WIZARD_TEMPLATE_STEPS, 0), 1);
    });

    it("DWC-STEP-06 hasNonEmptyCanonicalValue contract", () => {
      assert.equal(hasNonEmptyCanonicalValue(""), false);
      assert.equal(hasNonEmptyCanonicalValue("x"), true);
      assert.equal(hasNonEmptyCanonicalValue("false"), false);
      assert.equal(hasNonEmptyCanonicalValue("none"), false);
      assert.equal(hasNonEmptyCanonicalValue("5"), false);
      assert.equal(hasNonEmptyCanonicalValue([{ name: "A" }]), true);
      assert.equal(hasNonEmptyCanonicalValue([{}]), false);
    });

    it("DWC-STEP-07 phantom defaults do not infer past basics", () => {
      const draft = {
        data: {
          title: "تور جدید",
          category: "mountain_day",
          program: { difficultyLevel: "5" },
          transport: { mode: "none" },
          pricing: { requiresPayment: "false" },
          participants: { nationalIdRequired: "false" },
          publishStatus: "draft",
        },
      };
      assert.equal(isDraftEssentiallyEmpty(draft), true);
      assert.equal(resolveDenaliWizardResumeStepIndex(draft, DENALI_WIZARD_TEMPLATE_STEPS, 0), 0);
    });
  });

  describe("clear — engine + mock BFF", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it("DWC-CLR-01 clear during in-flight PATCH: refresh stays step 0 not step 5", async () => {
      const sessionId = "750f6c7f-35a9-4dc7-9fed-75053f1bc05a";
      const slowPatchGate = createSlowPatchGate();
      const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine({ slowPatchGate });

      try {
        server.seed({
          data: denaliStepFiveEnvelope(sessionId),
          version: 7,
          schemaVersion: 1,
          lastModified: Date.now(),
        });

        await engine.initialize();
        engine.setDraftData(denaliStepFiveEnvelope(sessionId));
        const stalePush = engine.flush();
        await sleep(5);

        const clearPromise = runDenaliWizardClearDraftSequence({
          clearDraftAndReset: (reset) => engine.clearDraftAndReset(reset),
          buildResetEnvelope: () => denaliFreshStartEnvelope(sessionId),
        });

        slowPatchGate.resolve();
        await Promise.allSettled([stalePush, clearPromise]);

        const deleteIndex = server.journal.findIndex((e) => e.method === "DELETE");
        assert.ok(deleteIndex >= 0, "DELETE must run during clear");

        const patchAfterDelete = journalMethodsAfter(server.journal, "PATCH", deleteIndex);
        const resurrectingPatch = patchAfterDelete.find(
          (entry) => entry.stepIndex === 4 && entry.freshStart !== true
        );
        assert.equal(resurrectingPatch, undefined);

        const refreshEngine = new DraftEngine(createFreshDenaliWizardDraftAdapter());
        await refreshEngine.initialize();
        const afterRefresh = refreshEngine.getState();
        assert.equal(afterRefresh.data?.meta.currentStepIndex, 0);
        assert.equal(afterRefresh.data?.meta.freshStart, true);
      } finally {
        restoreFetch();
      }
    });

    it("DWC-CLR-02 clear when no server row finishes IDLE at step 0 with default kind", async () => {
      const sessionId = "session-no-row";
      const { engine, restoreFetch } = createDenaliWizardDraftTestEngine();

      try {
        await engine.initialize();
        assert.equal(engine.getState().data, null);

        await runDenaliWizardClearDraftSequence({
          clearDraftAndReset: (reset) => engine.clearDraftAndReset(reset),
          buildResetEnvelope: () => denaliFreshStartEnvelope(sessionId),
        });

        const state = engine.getState();
        assert.equal(state.status, "IDLE");
        assert.equal(state.data?.meta.currentStepIndex, 0);
        assert.equal(state.data?.meta.freshStart, true);
        assert.equal(getCanonicalStringValue(state.data!.form, "category"), DENALI_DEFAULT_TOUR_KIND);
      } finally {
        restoreFetch();
      }
    });

    it("DWC-CLR-03 clearDraftAndReset never exposes data=null to subscribers", async () => {
      const sessionId = "session-atomic-reset";
      const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine();
      const snapshots: Array<ReturnType<typeof denaliFreshStartEnvelope> | null> = [];

      try {
        server.seed({
          data: denaliStepFiveEnvelope(sessionId),
          version: 2,
          schemaVersion: 1,
          lastModified: Date.now(),
        });
        await engine.initialize();
        engine.subscribe((state) => snapshots.push(state.data));

        snapshots.length = 0;
        await runDenaliWizardClearDraftSequence({
          clearDraftAndReset: (reset) => engine.clearDraftAndReset(reset),
          buildResetEnvelope: () => denaliFreshStartEnvelope(sessionId),
        });

        assert.equal(snapshots.includes(null), false);
        assert.equal(engine.getState().data?.meta.currentStepIndex, 0);
      } finally {
        restoreFetch();
      }
    });

    it("DWC-CLR-04 DELETE failure aborts before reset is applied", async () => {
      let resetCalls = 0;

      await assert.rejects(
        () =>
          runDenaliWizardClearDraftSequence({
            clearDraftAndReset: async () => {
              throw new Error("WORKSPACE_DRAFT_DELETE_FAILED:502");
            },
            buildResetEnvelope: () => {
              resetCalls += 1;
              return denaliFreshStartEnvelope("session");
            },
          }),
        /WORKSPACE_DRAFT_DELETE_FAILED:502/
      );

      assert.equal(resetCalls, 1);
    });

    it("DWC-CLR-05 journal order: DELETE then freshStart PATCH v0", async () => {
      const sessionId = "session-journal";
      const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine();

      try {
        server.seed({
          data: denaliStepFiveEnvelope(sessionId),
          version: 3,
          schemaVersion: 1,
          lastModified: Date.now(),
        });

        await engine.initialize();
        await runDenaliWizardClearDraftSequence({
          clearDraftAndReset: (reset) => engine.clearDraftAndReset(reset),
          buildResetEnvelope: () => denaliFreshStartEnvelope(sessionId),
        });

        const deleteIndex = server.journal.findIndex((e) => e.method === "DELETE");
        assert.ok(deleteIndex >= 0);

        const patchAfterDelete = journalMethodsAfter(server.journal, "PATCH", deleteIndex);
        assert.ok(patchAfterDelete.length >= 1);
        const freshPatch = patchAfterDelete[patchAfterDelete.length - 1];
        assert.equal(freshPatch?.version, 0);
        assert.equal(freshPatch?.stepIndex, 0);
        assert.equal(freshPatch?.freshStart, true);
      } finally {
        restoreFetch();
      }
    });

    it("DWC-CLR-06 freshStart PATCH uses version 0 after server had v7", async () => {
      const sessionId = "session-v0";
      const { engine, server, restoreFetch } = createDenaliWizardDraftTestEngine();

      try {
        server.seed({
          data: denaliStepFiveEnvelope(sessionId),
          version: 7,
          schemaVersion: 1,
          lastModified: Date.now(),
        });

        await engine.initialize();
        engine.setDraftData(denaliFreshStartEnvelope(sessionId));
        await engine.flush();

        const freshPatch = server.journal.findLast(
          (entry) => entry.method === "PATCH" && entry.freshStart === true
        );
        assert.equal(freshPatch?.version, 0);
      } finally {
        restoreFetch();
      }
    });

    it("DWC-CLR-07 recovers when freshStart seed PATCH 409s once", async () => {
      const sessionId = "session-409";
      let force409OnFreshStart = true;
      const { server, restoreFetch } = createDenaliWizardDraftTestEngine();

      const originalFetchInner = globalThis.fetch;
      globalThis.fetch = (async (input, init) => {
        const method = init?.method ?? "GET";
        if (method === "PATCH") {
          const body =
            init?.body != null && typeof init.body === "string"
              ? (JSON.parse(init.body) as {
                  version?: number;
                  data?: ReturnType<typeof denaliFreshStartEnvelope>;
                })
              : null;
          if (
            force409OnFreshStart &&
            body?.version === 0 &&
            body.data?.meta.freshStart === true
          ) {
            force409OnFreshStart = false;
            return new Response(
              JSON.stringify({
                data: denaliStepFiveEnvelope(sessionId),
                version: 7,
                schemaVersion: 1,
                lastModified: Date.now(),
              }),
              { status: 409, headers: { "Content-Type": "application/json" } }
            );
          }
        }
        return server.fetchImpl(input, init);
      }) as typeof fetch;

      try {
        const engine = new DraftEngine(createDenaliWizardDraftMergeAdapter());
        server.seed({
          data: denaliStepFiveEnvelope(sessionId),
          version: 7,
          schemaVersion: 1,
          lastModified: Date.now(),
        });
        await engine.initialize();

        await runDenaliWizardClearDraftSequence({
          clearDraftAndReset: (reset) => engine.clearDraftAndReset(reset),
          buildResetEnvelope: () => denaliFreshStartEnvelope(sessionId),
        });

        assert.ok(server.journal.filter((entry) => entry.method === "DELETE").length >= 2);
        assert.equal(engine.getState().status, "IDLE");
        assert.equal(engine.getState().data?.meta.currentStepIndex, 0);
        assert.equal(engine.getState().data?.meta.freshStart, true);
      } finally {
        globalThis.fetch = originalFetchInner;
        restoreFetch();
      }
    });
  });
});
