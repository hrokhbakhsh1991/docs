/**
 * Tracks A–C — Denali draft unification closure guards (WEB-P11-UNIFY-*)
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = join(WEB_ROOT, "..", "..");

function readWebSource(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), "utf8");
}

function readRepoSource(relativePath: string): string {
  return readFileSync(join(REPO_ROOT, relativePath), "utf8");
}

describe("denali-draft-unification-closure.spec.ts — Tracks A–C", () => {
  it("WEB-P11-UNIFY-01 API PATCH recomputes tombstones via plugin binding", () => {
    const service = readRepoSource("apps/api/src/workspace-drafts/workspace-drafts.service.ts");
    const reapply = readRepoSource(
      "apps/api/src/workspace-drafts/reapply-server-envelope-tombstones.ts",
    );
    assert.match(service, /reapplyServerEnvelopeTombstones/);
    assert.match(service, /plugin\.draftTombstone/);
    assert.match(reapply, /resolveTombstoneRoots/);
    assert.match(reapply, /WorkspaceDraftTombstoneBinding/);
  });

  it("WEB-P11-UNIFY-02 WorkspacePlugin exposes optional draftTombstone hook", () => {
    const contract = readRepoSource("packages/workspace-sdk/src/plugin/workspace-plugin.contract.ts");
    const denali = readRepoSource("packages/workspaces/denali/src/denali.plugin.ts");
    assert.match(contract, /draftTombstone/);
    assert.match(denali, /denaliDraftTombstoneBinding/);
  });

  it("WEB-P11-UNIFY-03 create + flat-edit wire Track C flag helpers", () => {
    const createHook = readWebSource("src/wizard/use-create-tour-wizard.ts");
    const createChrome = readWebSource("src/wizard/create-tour-wizard-chrome.tsx");
    const flatEditHook = readWebSource("src/wizard/use-flat-edit-page.ts");
    const flatEditChrome = readWebSource("src/wizard/flat-edit-chrome.tsx");
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/flat-edit-page-client.tsx");
    for (const source of [createHook, flatEditHook]) {
      assert.match(source, /resolveOperatorDraftConflictStrategy/);
      assert.match(source, /resolveDenaliDraftMerge|resolveWizardDraftMerge/);
      assert.match(source, /createOperatorDraftOnPushSuccess/);
    }
    assert.match(createChrome, /conflictReloadNotice=\{props\.draftSync\.conflictReloadNotice\}/);
    assert.match(flatEditChrome, /conflictReloadNotice=\{props\.draftSync\.conflictReloadNotice\}/);
    assert.match(flatEdit, /draftSync=\{draftSyncEngine\}/);
  });

  it("WEB-P11-UNIFY-04 merge module has no mergeDeletedRoots union helper", () => {
    const merge = readRepoSource("packages/workspaces/denali/src/draft/merge-envelope.ts");
    assert.doesNotMatch(merge, /mergeDeletedRoots/);
    assert.match(merge, /readDeletedRoots\(server\.meta\)/);
    assert.doesNotMatch(merge, /\.\.\.\(deletedRoots !== undefined \? \{ deletedRoots \}/);
  });

  it("WEB-P11-UNIFY-05 DraftSyncChrome forwards conflictReloadNotice to conflict banner", () => {
    const chrome = readWebSource("src/draft/draft-sync-chrome.tsx");
    const banner = readWebSource("src/draft/draft-conflict-banner.tsx");
    assert.match(chrome, /conflictReloadNotice/);
    assert.match(banner, /serverReloaded/);
    assert.match(banner, /draftSync\.serverReloaded/);
  });

  it("WEB-P11-UNIFY-06 denali envelope helpers strip client deletedRoots (Track B)", () => {
    const binding = readRepoSource(
      "packages/workspaces/denali/src/draft/denali-wizard-draft-binding.ts",
    );
    assert.match(binding, /denaliPrepareDraftEnvelope/);
    assert.match(binding, /clientMetaFromInput/);
    assert.match(binding, /denaliHydrateDraftEnvelope/);
    assert.match(binding, /Server-persisted only — stripped on client hydrate\/prepare/);
  });

  it("WEB-P11-UNIFY-07 draftTombstone stripped before PlatformWizardEngine ingress", () => {
    const stripper = readRepoSource("packages/workspaces/denali/src/plugin-for-wizard-engine.ts");
    const engineStrip = readRepoSource("packages/platform-core/src/engine/platform-wizard.engine.ts");
    assert.match(stripper, /draftTombstone:\s*_draftTombstone/);
    assert.match(engineStrip, /draftTombstone:\s*_draftTombstone/);
  });

  it("WEB-P11-UNIFY-09 react live config forwards onPushSuccess (Track C shadow)", () => {
    const react = readRepoSource("packages/draft-engine/src/react.ts");
    assert.match(react, /get onPushSuccess\(\)/);
    assert.match(react, /configRef\.current\.onPushSuccess/);
  });

  it("WEB-P11-UNIFY-08 create + flat-edit wire normalizeRemote for B-8", () => {
    const createHook = readWebSource("src/wizard/use-create-tour-wizard.ts");
    const flatEditHook = readWebSource("src/wizard/use-flat-edit-page.ts");
    const normalize = readWebSource("src/draft/normalize-wizard-remote-envelope-for-plugin.ts");
    assert.match(normalize, /normalizeWizardRemoteEnvelopeForPlugin/);
    assert.match(normalize, /normalizeWizardRemoteEnvelope/);
    assert.match(createHook, /normalizeWizardRemoteEnvelope/);
    assert.match(createHook, /normalizeRemote:\s*normalizeRemoteEnvelope/);
    assert.match(flatEditHook, /normalizeWizardRemoteEnvelopeForPlugin/);
    assert.match(flatEditHook, /normalizeWizardRemoteEnvelopeForPlugin\(plugin/);
  });
});
