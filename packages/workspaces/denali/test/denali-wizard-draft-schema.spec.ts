import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MAX_SANITY_ATTEMPTS } from "../src/draft/denali-wizard-draft-schema";
import { DenaliWizardDraftEnvelopeSchema } from "../src/draft/denali-wizard-draft-schema";
import { createDenaliDraftSchemaGate } from "../src/draft/create-denali-draft-schema-gate";
import type { DenaliWizardRulesModule } from "../src/wizard/denali-wizard-rules-module";

function minimalRules(): DenaliWizardRulesModule {
  return {
    canonicalToFormPathMap: {},
    buildDefaultForm: () => ({}),
    applyDenaliInvariantState: (form) => form,
  } as unknown as DenaliWizardRulesModule;
}

describe("denali-wizard-draft-schema.spec.ts — WEB-P11-HERMETIC-04", () => {
  it("MAX_SANITY_ATTEMPTS is 2", () => {
    assert.equal(MAX_SANITY_ATTEMPTS, 2);
  });

  it("rejects invalid envelope shape", () => {
    const gate = createDenaliDraftSchemaGate(minimalRules(), {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const result = gate({ form: { data: {} }, meta: { currentStepIndex: -1 } } as never, {
      phase: "prePush",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.ok(result.issues.length > 0);
    }
  });

  it("accepts minimal valid envelope", () => {
    const gate = createDenaliDraftSchemaGate(minimalRules(), {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const envelope = {
      form: { data: { program: { themeIds: [] } } },
      meta: { currentStepIndex: 0 },
    };
    const parsed = DenaliWizardDraftEnvelopeSchema.safeParse(envelope);
    assert.equal(parsed.success, true);

    const result = gate(envelope as never, { phase: "prePush" });
    assert.equal(result.ok, true);
  });

  it("prePush returns envelope unchanged (validate-only)", () => {
    const gate = createDenaliDraftSchemaGate(minimalRules(), {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const envelope = {
      form: { data: { program: { themeIds: [] } } },
      meta: { currentStepIndex: 0 },
    };
    const result = gate(envelope as never, { phase: "prePush" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(JSON.stringify(result.value.form), JSON.stringify(envelope.form));
      assert.equal(JSON.stringify(result.value.meta), JSON.stringify(envelope.meta));
    }
  });

  it("prePush freshStart without deletedRoots keeps envelope reference (INV-DENALI-WIZ-004)", () => {
    const gate = createDenaliDraftSchemaGate(minimalRules(), {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const envelope = {
      form: { data: { title: "Typed" } },
      meta: { currentStepIndex: 0, freshStart: true as const },
    };
    const result = gate(envelope as never, { phase: "prePush" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value, envelope);
    }
  });

  it("fixpoint loop is bounded by MAX_SANITY_ATTEMPTS in merge phase source", async () => {
    const { readFileSync } = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../src/draft/create-denali-draft-schema-gate.ts"),
      "utf8"
    );
    assert.match(source, /runMergePhaseGate/);
    assert.match(source, /for \(let attempt = 1; attempt <= MAX_SANITY_ATTEMPTS; attempt\+\+\)/);
    assert.match(source, /SANITIZE_FIXPOINT_EXCEEDED/);
  });

  it("freshStart clears deletedRoots before prePush gate pass", () => {
    const gate = createDenaliDraftSchemaGate(minimalRules(), {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const result = gate(
      {
        form: { data: {} },
        meta: { currentStepIndex: 0, freshStart: true, deletedRoots: ["program"] },
      } as never,
      { phase: "prePush" }
    );

    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.value.meta.deletedRoots, undefined);
    }
  });

  it("returns SANITIZE_FIXPOINT_EXCEEDED when sanitize never stabilizes on merge phase", () => {
    let toggle = false;
    const oscillatingRules = {
      canonicalToFormPathMap: { "basics.title": "basics.title" },
      buildDefaultForm: () => ({}),
      readCanonicalBasics: (slug: string) =>
        slug === "mountain_day"
          ? { category: "mountain" as const, duration: "single_day" as const }
          : null,
      applyDenaliInvariantState: (form: Record<string, unknown>) => {
        const basics = { ...(form.basics as Record<string, unknown> | undefined) };
        basics.title = toggle ? "alpha" : "beta";
        toggle = !toggle;
        return { ...form, basics };
      },
    } as unknown as DenaliWizardRulesModule;

    const gate = createDenaliDraftSchemaGate(oscillatingRules, {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const result = gate(
      {
        form: { data: { basics: { title: "seed" }, category: "mountain_day" } },
        meta: { currentStepIndex: 0 },
      } as never,
      { phase: "merge" }
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.issues[0]?.code, "SANITIZE_FIXPOINT_EXCEEDED");
    }
  });
});
