/**
 * Track B — client tombstone cleanup + ack cache alignment
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import {
  denaliHydrateDraftEnvelope,
  denaliPrepareDraftEnvelope,
  createDenaliDraftSchemaGate,
} from "@app-tour/workspace-denali/draft";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

function readWebSource(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), "utf8");
}

function minimalRules() {
  return {
    canonicalToFormPathMap: {},
    buildDefaultForm: () => ({}),
    applyDenaliInvariantState: (form: Record<string, unknown>) => form,
  };
}

describe("draft-unification-client.spec.ts — Track B", () => {
  it("denaliPrepareDraftEnvelope omits deletedRoots from client meta", () => {
    const envelope = denaliPrepareDraftEnvelope(
      { data: { photos: [{ id: "p1" }] } },
      { currentStepIndex: 1, deletedRoots: ["photos"] }
    );
    assert.equal(envelope.meta.deletedRoots, undefined);
    assert.equal(envelope.meta.currentStepIndex, 1);
  });

  it("denaliHydrateDraftEnvelope strips server deletedRoots on hydrate", () => {
    const hydrated = denaliHydrateDraftEnvelope(
      {
        form: { data: { program: { themeIds: [] } } },
        meta: { currentStepIndex: 2, deletedRoots: ["photos"] },
      },
      { data: {} },
      { currentStepIndex: 0 }
    );
    assert.equal(hydrated.meta.deletedRoots, undefined);
    assert.equal(hydrated.meta.currentStepIndex, 2);
  });

  it("prePush schema gate does not mutate form JSON", () => {
    const gate = createDenaliDraftSchemaGate(minimalRules(), {
      uiOptions: {},
      ruleSet: "publish",
    } as never);

    const envelope = {
      form: { data: { program: { themeIds: ["t1"] } } },
      meta: { currentStepIndex: 0 },
    };
    const before = JSON.stringify(envelope.form);
    const result = gate(envelope as never, { phase: "prePush" });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(JSON.stringify(result.value.form), before);
    }
  });

  it("regression — create wizard must not import trackDeletedCanonicalRoots", () => {
    const source = readWebSource("app/tours/new/new-tour-wizard-client.tsx");
    assert.doesNotMatch(source, /trackDeletedCanonicalRoots/);
  });

  it("regression — flat edit must not import trackDeletedCanonicalRoots", () => {
    const source = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    assert.doesNotMatch(source, /trackDeletedCanonicalRoots/);
  });

  it("engine source defines commitServerAck (Track B INV-6)", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/draft-engine/src/engine.ts"),
      "utf8"
    );
    assert.match(source, /commitServerAck/);
    assert.match(source, /ensureAckBeforePush/);
  });
});
