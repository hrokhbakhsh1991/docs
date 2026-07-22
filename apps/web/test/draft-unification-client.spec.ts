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
  createOperatorDraftSchemaGate,
} from "@app-tour/workspace-denali/host/draft";

import { mergeDenaliWizardDraftEnvelope } from "@app-tour/workspace-denali/host/draft";
import { getDenaliWorkspacePlugin } from "@app-tour/workspace-denali/plugin";
import { normalizeWizardRemoteEnvelopeForPlugin } from "../src/draft/normalize-wizard-remote-envelope-for-plugin";
import { DraftEngine } from "@app-tour/draft-engine";
import type { DraftSyncPayload } from "@app-tour/draft-engine";

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
    const gate = createOperatorDraftSchemaGate(minimalRules(), {
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
    const source = readWebSource("app/tours/new/create-tour-wizard-client.tsx");
    assert.doesNotMatch(source, /trackDeletedCanonicalRoots/);
  });

  it("regression — flat edit must not import trackDeletedCanonicalRoots", () => {
    const source = readWebSource("app/(app)/tours/[id]/edit/flat-edit-page-client.tsx");
    assert.doesNotMatch(source, /trackDeletedCanonicalRoots/);
  });

  it("409 merge output omits deletedRoots from client meta (INV-2)", () => {
    const merged = mergeDenaliWizardDraftEnvelope(
      {
        form: { data: { basics: { title: "Local" } } },
        meta: { currentStepIndex: 2 },
      },
      {
        form: { data: { basics: { title: "Server" }, photos: [{ id: "p1" }] } },
        meta: { currentStepIndex: 0, deletedRoots: ["photos"] },
      }
    );
    assert.equal(merged.meta.deletedRoots, undefined);
    assert.equal((merged.form.data as Record<string, unknown>).photos, undefined);
  });

  it("engine source defines commitServerAck (Track B INV-6)", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/draft-engine/src/engine.ts"),
      "utf8"
    );
    assert.match(source, /commitServerAck/);
    assert.match(source, /ensureAckBeforePush/);
  });

  it("normalizeWizardRemoteEnvelopeForPlugin strips deletedRoots after engine remote hydrate (B-8)", async () => {
    type Envelope = {
      form: { data: Record<string, unknown> };
      meta: { currentStepIndex: number; deletedRoots?: readonly string[] };
    };

    const fetched: DraftSyncPayload<Envelope> = {
      data: {
        form: { data: { photos: [{ id: "p1" }] } },
        meta: { currentStepIndex: 1, deletedRoots: ["photos"] },
      },
      version: 2,
      schemaVersion: 1,
      lastModified: 5000,
    };

    const engine = new DraftEngine<Envelope>({
      id: "denali-b8",
      conflictStrategy: "SERVER_WINS",
      normalizeRemote: (envelope) =>
        normalizeWizardRemoteEnvelopeForPlugin(getDenaliWorkspacePlugin(), envelope as never) as Envelope,
      onFetch: async () => fetched,
      onPush: async (p) => p,
    });

    await engine.initialize();
    const state = engine.getState();
    assert.equal(state.data?.meta.deletedRoots, undefined);
    assert.equal(state.data?.meta.currentStepIndex, 1);
    assert.ok(Array.isArray((state.data?.form.data as Record<string, unknown>).photos));
  });
});
