/**
 * Phase 4+ — Denali draft systemic fixes closure guards (WEB-P11-CLOSE-*)
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

describe("denali-draft-systemic-closure.spec.ts — Phase 4", () => {
  it("WEB-P11-CLOSE-01 PATCH transport checks status before JSON parse", () => {
    const source = readWebSource("src/draft/workspace-draft-client.ts");
    const patchStart = source.indexOf("export async function patchWorkspaceDraftSnapshot");
    assert.ok(patchStart >= 0);
    const patchBody = source.slice(patchStart, patchStart + 2500);
    const status409 = patchBody.indexOf("response.status === 409");
    const statusOk = patchBody.indexOf("!response.ok");
    const successJsonCall = patchBody.lastIndexOf("readJsonResponseBody");
    assert.ok(status409 >= 0 && statusOk >= 0 && successJsonCall >= 0);
    assert.ok(status409 < successJsonCall);
    assert.ok(statusOk < successJsonCall);
  });

  it("WEB-P11-CLOSE-02 adapter supports keepalive push and abort supersession", () => {
    const source = readWebSource("src/draft/create-workspace-draft-adapter.ts");
    assert.match(source, /keepalive:\s*true/);
    assert.match(source, /WORKSPACE_DRAFT_PATCH_ABORTED/);
    assert.match(source, /pushOptions\?\.keepalive === true/);
  });

  it("WEB-P11-CLOSE-03 useWorkspaceDraft wires visibility flush hook", () => {
    const source = readWebSource("src/draft/use-workspace-draft.ts");
    assert.match(source, /useDraftVisibilityFlush/);
    assert.match(source, /flushKeepalive/);
    assert.match(source, /visibilityFlush !== false/);
  });

  it("WEB-P11-CLOSE-04 mapValidationResultToIssues forwards violation code", () => {
    const source = readRepoSource("packages/wizard-navigation/src/map-validation-result.ts");
    assert.match(source, /code:\s*violation\.code/);
  });

  it("WEB-P11-CLOSE-05 flat edit submit validation uses i18n list component", () => {
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    const listComponent = readWebSource("src/wizard/denali/denali-flat-edit-validation-list.tsx");
    assert.match(flatEdit, /DenaliFlatEditValidationList/);
    assert.doesNotMatch(flatEdit, /\{issue\.message\}/);
    assert.match(listComponent, /resolveWizardValidationIssueMessage/);
    assert.match(listComponent, /denali\.review\.validation/);
  });

  it("WEB-P11-CLOSE-06 draft-engine exposes QUARANTINED and schemaGate egress", () => {
    const types = readRepoSource("packages/draft-engine/src/types.ts");
    const engine = readRepoSource("packages/draft-engine/src/engine.ts");
    assert.match(types, /QUARANTINED/);
    assert.match(types, /DraftSchemaGate/);
    assert.match(engine, /buildPayloadForPush/);
  });

  it("WEB-P11-CLOSE-07 API tombstone invariant module has zero denali imports", () => {
    const source = readRepoSource(
      "apps/api/src/workspace-drafts/invariants/envelope-tombstone-invariants.ts"
    );
    assert.doesNotMatch(source, /@app-tour\/workspace-denali/);
    assert.match(source, /assertEnvelopeTombstoneInvariants/);
    assert.match(source, /ENVELOPE_TOMBSTONE_PATCH_NAMESPACES/);
  });

  it("WEB-P11-CLOSE-08 patchWorkspaceDraft invokes tombstone gate for operator.wizard", () => {
    const service = readRepoSource("apps/api/src/workspace-drafts/workspace-drafts.service.ts");
    assert.match(service, /assertEnvelopeTombstoneInvariants/);
    assert.match(service, /tombstone_violation/);
  });

  it("WEB-P11-CLOSE-09 DraftSyncChrome composes quarantine + sync chrome", () => {
    const chrome = readWebSource("src/draft/draft-sync-chrome.tsx");
    assert.match(chrome, /DraftQuarantineBanner/);
    assert.match(chrome, /DraftSyncIndicator/);
    assert.match(chrome, /DraftManualSyncButton/);
    assert.match(chrome, /onRevertQuarantine/);
    const quarantine = readWebSource("src/draft/draft-quarantine-banner.tsx");
    assert.match(quarantine, /draft-quarantine-revert/);
    const createTour = readWebSource("app/tours/new/new-tour-wizard-client.tsx");
    const flatEdit = readWebSource("app/(app)/tours/[id]/edit/denali-flat-edit-page-client.tsx");
    assert.match(createTour, /DraftSyncChrome/);
    assert.match(flatEdit, /DraftSyncChrome/);
  });

  it("WEB-P11-CLOSE-10 react useDraftEngine forwards schemaGate to engine", () => {
    const source = readRepoSource("packages/draft-engine/src/react.ts");
    assert.match(source, /get schemaGate\(\)/);
    assert.match(source, /configRef\.current\.schemaGate/);
  });

  it("WEB-P11-CLOSE-11 observability: onDiagnostic + intentId wiring", () => {
    const react = readRepoSource("packages/draft-engine/src/react.ts");
    const adapter = readWebSource("src/draft/create-workspace-draft-adapter.ts");
    const client = readWebSource("src/draft/workspace-draft-client.ts");
    const proxy = readWebSource("src/draft/proxy-workspace-draft-api.server.ts");
    assert.match(react, /get onDiagnostic\(\)/);
    assert.match(adapter, /onDiagnostic/);
    assert.match(adapter, /intentId:\s*pushOptions\?\.intentId/);
    assert.match(adapter, /onAbortInFlightPush/);
    assert.match(client, /Idempotency-Key/);
    assert.match(proxy, /Idempotency-Key/);
  });

  it("WEB-P11-CLOSE-12 clear-draft contract harness + sequence module", () => {
    const contract = readFileSync(join(WEB_ROOT, "test/denali-wizard-draft-contract.spec.ts"), "utf8");
    const fixtures = readFileSync(join(WEB_ROOT, "test/helpers/denali-wizard-draft-fixtures.ts"), "utf8");
    const sequence = readWebSource("src/draft/run-denali-wizard-clear-draft-sequence.ts");
    const hook = readWebSource("src/draft/use-denali-wizard-clear-draft.tsx");
    assert.match(contract, /DWC-CLR-01/);
    assert.match(contract, /denali-wizard-draft-contract/);
    assert.match(fixtures, /mock-workspace-draft-server/);
    assert.match(sequence, /runDenaliWizardClearDraftSequence/);
    assert.match(hook, /runDenaliWizardClearDraftSequence/);
  });
});
