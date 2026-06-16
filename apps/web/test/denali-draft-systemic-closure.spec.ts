/**
 * Phase 4 — Denali draft systemic fixes closure guards (WEB-P11-CLOSE-*)
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
});
